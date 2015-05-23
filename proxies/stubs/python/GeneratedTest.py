#
# Test API 1.0
#
# Part of the JSON-WS library - Python Proxy
# Copyright (c) 2014 ChaosGroup. All rights reserved.
#
# This code uses the following libraries:
#   - autobahn.asyncio.websocket (https://pypi.python.org/pypi/autobahn/0.9.3)
#
# For asyncio and enum support in Python <= 3.3 install trollius and enum34:
#   - https://pypi.python.org/pypi/trollius/1.0.2
#   - https://pypi.python.org/pypi/enum34/1.0.3


from datetime import datetime
from rpctunnel import RpcTunnel, Optional, Type, Enum


class GeneratedTest:
    '''
    Proxy for json-ws web services. Instances can be used as context managers.
    '''

    RenderMode = Enum('RenderMode', {
        'Production' : -1,
        'RtCpu' : 0,
        'RtGpuCuda' : 5,
    })

    RenderOptions = Type('RenderOptions', {
        'width' : int,
        'height' : int,
        'renderMode' : 'RenderMode',
    }, lambda: GeneratedTest)

    DefaultArray = Type('DefaultArray', {
        'property' : [str],
    }, lambda: GeneratedTest)


    class ns1:
        class sub1:
            class sub2:
                def __init__(self, root):
                    self.root = root

                def method1(self):
                    return self.root._rpc('ns1.sub1.sub2.method1', [], return_type=None)

            def __init__(self, root):
                self.root = root
                self.sub2 = self.sub2(root)

        def __init__(self, root):
            self.root = root
            self.sub1 = self.sub1(root)

        def method1(self):
            return self.root._rpc('ns1.method1', [], return_type=str)

    class ns2:
        class sub1:
            class sub2:
                def __init__(self, root):
                    self.root = root

                def method1(self):
                    return self.root._rpc('ns2.sub1.sub2.method1', [], return_type=None)

            def __init__(self, root):
                self.root = root
                self.sub2 = self.sub2(root)

        def __init__(self, root):
            self.root = root
            self.sub1 = self.sub1(root)

    def __init__(self, url):
        '''
        Args:
            url (string): The url of the web service
        '''

        # RpcTunnel
        self._rpc = RpcTunnel(url)
        # The default transport is HTTP
        self.useHTTP()
        self.ns1 = self.ns1(self)
        self.ns2 = self.ns2(self)

    def sum(self, a, b):
        '''
        Some test method example, does int sum

        Args:
            a (int)
            b (int)
        Returns:
            int
        '''

        return self._rpc('sum', [a, b], return_type=int)

    def sumReturn(self):
        return self._rpc('sumReturn', [], return_type=None)

    def echo(self, a):
        '''
        Args:
            a (self.RenderOptions)
        Returns:
            self.RenderOptions
        '''

        return self._rpc('echo', [a], return_type=self.RenderOptions)

    def echoObject(self, a):
        '''
        Args:
            a (object)
        Returns:
            dict
        '''

        return self._rpc('echoObject', [a], return_type=dict)

    def throwError(self):
        return self._rpc('throwError', [], return_type=int)

    def testMe(self):
        return self._rpc('testMe', [], return_type=None)

    def testMe1(self):
        return self._rpc('testMe1', [], return_type=None)

    def testMe2(self, a):
        '''
        A sample method.

        Args:
            a (str): A simple string parameter.
        Returns:
            str
        '''

        return self._rpc('testMe2', [a], return_type=str)

    def testMe3(self):
        return self._rpc('testMe3', [], return_type=None)

    def testMe4(self):
        return self._rpc('testMe4', [], return_type=None)

    def TestDefaultArray(self, p):
        '''
        Args:
            p (self.DefaultArray)
        '''

        return self._rpc('TestDefaultArray', [p], return_type=None)

    def TestUrl(self, u):
        '''
        Args:
            u (str)
        Returns:
            str
        '''

        return self._rpc('TestUrl', [u], return_type=str)

    def getRenderOptions(self):
        return self._rpc('getRenderOptions', [], return_type=[self.RenderOptions])

    def echoStringAsBuffer(self, theString):
        '''
        Args:
            theString (str)
        Returns:
            bytearray
        '''

        return self._rpc('echoStringAsBuffer', [theString], return_type=bytearray)

    def getBufferSize(self, buffer):
        '''
        Args:
            buffer (bytearray)
        Returns:
            int
        '''

        return self._rpc('getBufferSize', [buffer], return_type=int)

    def returnFrom0ToN(self, n):
        '''
        Args:
            n (int)
        Returns:
            [int]
        '''

        return self._rpc('returnFrom0ToN', [n], return_type=[int])

    def optionalArgs(self, required, p1=Optional(int), p2=Optional(int)):
        '''
        Args:
            required (bool)
            p1 (Optional(int))
            p2 (Optional(int))
        '''

        return self._rpc('optionalArgs', [required, p1, p2], return_type=None)

    def sumArray(self, ints):
        '''
        Args:
            ints ([int])
        Returns:
            int
        '''

        return self._rpc('sumArray', [ints], return_type=int)

    def testAny(self, a):
        '''
        Args:
            a (object)
        Returns:
            object
        '''

        return self._rpc('testAny', [a], return_type=object)

    def getSeconds(self, timeParam):
        '''
        Args:
            timeParam (datetime)
        Returns:
            int
        '''

        return self._rpc('getSeconds', [timeParam], return_type=int)

    def getNow(self):
        return self._rpc('getNow', [], return_type=datetime)

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        pass

    def useHTTP(self):
        self._rpc.useHTTP()

    def useWS(self):
        self._rpc.useWS()

    def onTestEvent(self, callback=None):
        self._rpc.event('testEvent', callback, return_type=int)

    def onTestEvent2(self, callback=None):
        self._rpc.event('testEvent2', callback, return_type=[GeneratedTest.RenderOptions])

    def onTestEvent3(self, callback=None):
        self._rpc.event('testEvent3', callback, return_type=dict)

    def onTestEvent4(self, callback=None):
        self._rpc.event('testEvent4', callback, return_type=bool)

    def onTestBinaryEvent(self, callback=None):
        self._rpc.event('testBinaryEvent', callback, return_type=bytearray)

    def onNs1_testEvent1(self, callback=None):
        self._rpc.event('ns1.testEvent1', callback, return_type=None)
