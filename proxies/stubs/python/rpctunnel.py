# Copyright (c) 2014 ChaosGroup. All rights reserved.

import json
import threading
import base64
from collections import defaultdict
from datetime import datetime
from enum import IntEnum

try:
    import asyncio
except ImportError:
    import trollius as asyncio

try:
    from urllib.error import HTTPError
    from urllib.request import (Request, urlopen)
    from urllib.parse import urlparse
except ImportError:
    # this is Python 2.7:
    from urllib2 import (Request, urlopen, HTTPError)
    from urlparse import urlparse

from autobahn.asyncio.websocket import (
    WebSocketClientProtocol,
    WebSocketClientFactory
)


__all__ = ['RpcTunnel', 'Optional', 'Type', 'Enum']


class Optional:
    '''
    A wrapper for optional arguments or fields, that remembers the type of
    those arguments or fields.
    '''

    def __init__(self, argument_type):
        self.type = argument_type

        if isinstance(argument_type, type):
            self.python_type = argument_type
        else:
            self.python_type = type(argument_type)


class Enum(IntEnum):
    '''
    A subclass of IntEnum with overriden __str__ to work with the default json
    encoder.
    '''

    def __str__(self):
        return '"{0}"'.format(self.name)


class Type(type):
    '''
    A named dictionary.

    >>> RenderOptions = Type('RenderOptions', {
    ...     'width' : int,
    ...     'height' : int,
    ...     'renderMode' : int,
    ... }, lambda: JobsProxy)
    >>> ro = RenderingOptions(width=320, height=240, renderMode=5)
    ... {'width' : 320, 'height' : 240, 'renderMode' : 5}
    >>> ro['width']
    ... 320
    '''

    def __new__(klass, name, field_types, get_root):
        def __init__(self, *args, **kwargs):
            fields = {}
            root = self._get_root()

            if len(args) == 1:
                kwargs = dict(args[0], **kwargs)

            for (field_name, field_type) in self._field_types.items():
                if field_name not in kwargs:
                    continue  # Assume Optional()

                field_value = kwargs[field_name]

                # Convert to any known types or enums, if necessary:
                if isinstance(field_type, str):
                    # We have a Type or Enum, get them from the root:
                    field_type = getattr(root, field_type)

                    if hasattr(field_type, '_Type'):
                        fields[field_name] = field_type(**field_value)
                    else:
                        if isinstance(field_value, int):  # skip long on python 2
                            fields[field_name] = field_type(field_value)
                        else:
                            fields[field_name] = getattr(field_type, field_value)
                else:
                    fields[field_name] = field_value

            dict.__init__(self, fields)

        return type(name, (dict,), {
            '__init__': __init__,
            '_Type': True,
            '_field_types': field_types,
            '_get_root': staticmethod(get_root)
        })


class RpcTunnel:
    '''
    The instances of this class are callable and do the actual sending of
    messages to the web service.
    '''

    HTTP = 'HTTP'
    WEB_SOCKET = 'WebSocket'

    counter = 0
    counter_lock = threading.Lock()

    __datetime_format = '%Y-%m-%dT%H:%M:%S.%fZ'

    class ExecutionException(BaseException):
        pass

    @staticmethod
    def convert(value, return_type):
        if isinstance(return_type, list):
            item_type = return_type[0]
            return [item_type(**item) if isinstance(item, dict) else item_type(item) for item in value]
        elif isinstance(value, dict):
            return return_type(**value)
        elif issubclass(return_type, datetime):
            return datetime.strptime(value, RpcTunnel.__datetime_format)
        else:
            return return_type(value)

    @staticmethod
    def set_or_raise(future, response_object, return_type=None):
        try:
            error = response_object.get('error', None)

            if error is None:
                if return_type is not None:
                    future.set_result(RpcTunnel.convert(response_object['result'], return_type))
                else:
                    future.set_result(response_object['result'])
            else:
                future.set_exception(RpcTunnel.ExecutionException(error['message']))
        except Exception as e:
            # Propagate any exception in the future:
            future.set_exception(e)

    @staticmethod
    def __default(data):
        if isinstance(data, Type):
            return data.data
        elif isinstance(data, bytearray):
            return base64.b64encode(data)
        elif isinstance(data, bytes):
            return data.decode('utf-8')
        elif isinstance(data, datetime):
            return data.strftime(RpcTunnel.__datetime_format)
        else:
            raise TypeError("{0} is not convertable to JSON".format(repr(data)))

    @staticmethod
    def dump_json(payload):
        '''
        Converts an object (possibly containing instances of known Types) to json

        Args:
            payload (object): The object to be converted
        Returns:
            str : String, containing the json
        '''

        result = json.dumps(payload, default=RpcTunnel.__default)

        if not isinstance(result, bytes):
            result = result.encode('utf-8')

        return result

    @staticmethod
    def parse_response(response):
        '''
        Converts a json string to an object, possibly fixing the encoding
        first.

        Args:
            response (str): The json that should be decoded
        Returns:
            object : The result from the parsing
        '''

        if (isinstance(response, bytes)):
            response = response.decode('utf-8')

        return json.loads(response)

    class HTTPTransport:
        HTTP_HEADERS = {'Content-Type' : 'application/json'}

        def __init__(self, url):
            self._url = url

        @asyncio.coroutine
        def __request(self, payload, future, return_type=None):
            try:
                payload = RpcTunnel.dump_json(payload)
                request = Request(self._url, data=payload, headers=self.HTTP_HEADERS)
                response = urlopen(request)
                response_contents = response.read()

                if hasattr(response, 'getheader'):
                    # Python >= 3.3
                    content_type = response.getheader('Content-Type')
                else:
                    # Python 2.7
                    content_type = response.headers.getheader('Content-Type')

                if 'application/json' in content_type:
                    RpcTunnel.set_or_raise(future, RpcTunnel.parse_response(response_contents), return_type)
                elif 'application/octet-stream' in content_type:
                    RpcTunnel.set_or_raise(future, {'result' : response_contents}, return_type)
            except HTTPError as httpError:
                if (httpError.code == 500):
                    future.set_exception(RpcTunnel.ExecutionException(httpError.read()))
                else:
                    future.set_exception(httpError)
            except Exception as e:
                future.set_exception(e)

        def send_message(self, payload, return_type=None):
            future = asyncio.Future()

            asyncio.Task(self.__request(payload, future, return_type))

            return future


    class WebSocketTransport:
        def __init__(self, url, event_handlers):
            self._event_handlers = event_handlers
            self._ws = asyncio.Future()
            self._pendingFutures = {}

            class ProxyWebSocketProtocol(WebSocketClientProtocol):
                def onConnect(this, response):
                    self._ws.set_result(this)

                def onMessage(this, message, isBinary):
                    result = RpcTunnel.parse_response(message)

                    result_id = result.get('id', None)

                    if result_id is None:
                        return

                    if isinstance(result_id, int):
                        return_type = self._pendingFutures[result_id]['return_type']

                        if return_type == bytearray:
                            result['result'] = base64.b64decode(result['result'])

                        RpcTunnel.set_or_raise(self._pendingFutures[result_id]['future'], result, return_type)
                    else:
                        # This is an event:
                        for callback_info in self._event_handlers[result_id]:
                            callback = callback_info['callback']
                            return_type = callback_info['return_type']

                            result = result.get('result', None)

                            if return_type is not None:
                                if return_type == bytearray:
                                    result = base64.b64decode(result)

                                callback(RpcTunnel.convert(result, return_type))
                            else:
                                callback(result)

            parsed_url = urlparse(url)
            # TODO: generate the websocket url nicely:
            self._url = url.replace('http', 'ws')

            factory = WebSocketClientFactory(self._url, debug = False)
            factory.protocol = ProxyWebSocketProtocol

            asyncio.Task(asyncio.get_event_loop().create_connection(factory, parsed_url.hostname, parsed_url.port))

        @asyncio.coroutine
        def __request(self, payload, future, return_type=None):
            try:
                self._pendingFutures[payload['id']] = {'future' : future, 'return_type' : return_type}

                payload = RpcTunnel.dump_json(payload)
                self._ws.add_done_callback(lambda ws: ws.result().sendMessage(payload))
            except Exception as e:
                future.set_exception(e)

        def send_message(self, payload, return_type=None):
            future = asyncio.Future()

            asyncio.Task(self.__request(payload, future, return_type))

            return future

    def __init__(self, url):
        '''
        Args:
            url (str): the url pointing to the web service.
            event_handlers (dict): dictionary of lists, containing callbacks
                                   for events.
        '''

        self._event_handlers = defaultdict(list)
        self._url = url
        self._transports = {}

        self.useHTTP()

    def __filter_optional(self, args):
        # TODO: work around the situation `def method(a, b=1, c=2): pass; method(10, c=15)`
        return [arg for arg in args if not isinstance(arg, Optional)]

    def __get_transport(self, transport_name):
        '''Get or initialize the desired transport.'''

        if transport_name in self._transports:
            return self._transports[transport_name]
        elif transport_name == self.HTTP:
            self._transports[transport_name] = self.HTTPTransport(self._url)
            return self._transports[transport_name]
        elif transport_name == self.WEB_SOCKET:
            self._transports[transport_name] = self.WebSocketTransport(self._url, self._event_handlers)
            return self._transports[transport_name]
        else:
            raise NotImplemented("Unknown transport: {0}".format(transport_name))

    def __call__(self, method_name, method_params, return_type=None, transport=None):
        '''
        Call method_name with method_params over transport. Returns a future
        object.

        Args:
            method_name (str): The name of the method to be called
            method_params (object): Iterable, or dict, containing the parameters
            return_type (object): the Python type, that the result should be converted to
            transport (string): The transport to use. Either RpcTunnel.HTTP or
                                RpcTunnel.WEB_SOCKET. If this is set to None the
                                current transport will be used.

        Returns:
            asyncio.Future : Future object, whose result() will contain the
                             result from the call.
        '''

        # TODO: ensure that method_params is either an iterable or a dict
        payload = {
            'jsonrpc' : '2.0',
            'method' : method_name,
            'params' : self.__filter_optional(method_params),
        }

        # We lock because we must be sure that we have unique ids:
        with self.counter_lock:
            payload['id'] = self.counter
            self.counter += 1

        if transport is None:
            return self.__get_transport(self.__current_transport).send_message(payload, return_type)

        return self.__get_transport(transport).send_message(payload, return_type)

    def event(self, event_name, callback, return_type=None):
        '''Subscribe/unsubscribe callbacks for events'''

        if callback is not None:
            self._event_handlers[event_name].append({
                'callback': callback,
                'return_type': return_type,
            })
            self('rpc.on', [event_name], transport=self.WEB_SOCKET)
        else:
            self('rpc.off', [event_name], transport=self.WEB_SOCKET)

    def useHTTP(self):
        '''Set the current transport to HTTP'''
        self.__current_transport = self.HTTP

    def useWS(self):
        '''Set the current transport to Websockets'''
        self.__current_transport = self.WEB_SOCKET
