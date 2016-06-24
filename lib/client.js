/**
 * Client RPC Tunnels
 */
(function (exports) {
	'use strict';

	/**
	 * Performs a NodeJS require followed by a fallback function call on failure.
	 * @param module The name of a NodeJS module
	 * @param [fallback] Optional fallback function that must return a substitute.
	 */
	var safeRequire = function (module, fallback) {
		try {
			module = module.split('.');
			var required = require(module[0]);
			return module[1] ? required[module[1]] : required;
		} catch (e) {
			return fallback ? fallback() : null;
		}
	};

	var inherits = safeRequire('util.inherits',
		function () {
			return function (ctor, superCtor) {
				ctor.super_ = superCtor;
				ctor.prototype = Object.create(superCtor.prototype, {
					constructor: {
						value: ctor,
						enumerable: false,
						writable: true,
						configurable: true
					}
				});
			};
		});

	//jscs:disable
	var EventEmitter = safeRequire('events.EventEmitter',
		function () {
			// Copyright Joyent, Inc. and other Node contributors.
			//
			// Permission is hereby granted, free of charge, to any person obtaining a
			// copy of this software and associated documentation files (the
			// 'Software'), to deal in the Software without restriction, including
			// without limitation the rights to use, copy, modify, merge, publish,
			// distribute, sublicense, and/or sell copies of the Software, and to permit
			// persons to whom the Software is furnished to do so, subject to the
			// following conditions:
			//
			// The above copyright notice and this permission notice shall be included
			// in all copies or substantial portions of the Software.
			//
			// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS
			// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
			// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
			// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
			// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
			// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
			// USE OR OTHER DEALINGS IN THE SOFTWARE.

			function EventEmitter() {
				this._events = this._events || {};
				this._maxListeners = this._maxListeners || defaultMaxListeners;
			}

			// By default EventEmitters will print a warning if more than
			// 10 listeners are added to it. This is a useful default which
			// helps finding memory leaks.
			//
			// Obviously not all Emitters should be limited to 10. This function allows
			// that to be increased. Set to zero for unlimited.
			var defaultMaxListeners = 10;
			EventEmitter.prototype.setMaxListeners = function (n) {
				if (typeof n !== 'number' || n < 0)
					throw TypeError('n must be a positive number');
				this._maxListeners = n;
			};

			EventEmitter.prototype.emit = function (type) {
				var er, handler, len, args, i, listeners;

				if (!this._events)
					this._events = {};

				// If there is no 'error' event listener then throw.
				if (type === 'error') {
					if (!this._events.error ||
						(typeof this._events.error === 'object' && !this._events.error.length)) {
						er = arguments[1];
						if (er instanceof Error) {
							throw er; // Unhandled 'error' event
						} else {
							throw TypeError('Uncaught, unspecified \'error\' event.');
						}
						return false;
					}
				}

				handler = this._events[type];

				if (typeof handler === 'undefined')
					return false;

				if (typeof handler === 'function') {
					switch (arguments.length) {
						// fast cases
						case 1:
							handler.call(this);
							break;
						case 2:
							handler.call(this, arguments[1]);
							break;
						case 3:
							handler.call(this, arguments[1], arguments[2]);
							break;
						// slower
						default:
							len = arguments.length;
							args = new Array(len - 1);
							for (i = 1; i < len; i++)
								args[i - 1] = arguments[i];
							handler.apply(this, args);
					}
				} else if (typeof handler === 'object') {
					len = arguments.length;
					args = new Array(len - 1);
					for (i = 1; i < len; i++)
						args[i - 1] = arguments[i];

					listeners = handler.slice();
					len = listeners.length;
					for (i = 0; i < len; i++)
						listeners[i].apply(this, args);
				}

				return true;
			};

			EventEmitter.prototype.addListener = function (type, listener) {
				var m;

				if (typeof listener !== 'function')
					throw TypeError('listener must be a function');

				if (!this._events)
					this._events = {};

				// To avoid recursion in the case that type === 'newListener'! Before
				// adding it to the listeners, first emit 'newListener'.
				if (this._events.newListener)
					this.emit('newListener', type, typeof listener.listener === 'function' ?
						listener.listener : listener);

				if (!this._events[type])
				// Optimize the case of one listener. Don't need the extra array object.
					this._events[type] = listener;
				else if (typeof this._events[type] === 'object')
				// If we've already got an array, just append.
					this._events[type].push(listener);
				else
				// Adding the second element, need to change to array.
					this._events[type] = [this._events[type], listener];

				// Check for listener leak
				if (typeof this._events[type] === 'object' && !this._events[type].warned) {
					m = this._maxListeners;
					if (m && m > 0 && this._events[type].length > m) {
						this._events[type].warned = true;
						console.error('(node) warning: possible EventEmitter memory ' +
							'leak detected. %d listeners added. ' +
							'Use emitter.setMaxListeners() to increase limit.',
							this._events[type].length);
						console.trace();
					}
				}

				return this;
			};

			EventEmitter.prototype.on = EventEmitter.prototype.addListener;

			EventEmitter.prototype.once = function (type, listener) {
				if (typeof listener !== 'function')
					throw TypeError('listener must be a function');

				function g() {
					this.removeListener(type, g);
					listener.apply(this, arguments);
				}

				g.listener = listener;
				this.on(type, g);

				return this;
			};

			EventEmitter.prototype.removeListener = function (type, listener) {
				var list, position, length, i;

				if (typeof listener !== 'function')
					throw TypeError('listener must be a function');

				if (!this._events || !this._events[type])
					return this;

				list = this._events[type];
				length = list.length;
				position = -1;

				if (list === listener ||
					(typeof list.listener === 'function' && list.listener === listener)) {
					this._events[type] = undefined;
					if (this._events.removeListener)
						this.emit('removeListener', type, listener);

				} else if (typeof list === 'object') {
					for (i = length; i-- > 0;) {
						if (list[i] === listener ||
							(list[i].listener && list[i].listener === listener)) {
							position = i;
							break;
						}
					}

					if (position < 0)
						return this;

					if (list.length === 1) {
						list.length = 0;
						this._events[type] = undefined;
					} else {
						list.splice(position, 1);
					}

					if (this._events.removeListener)
						this.emit('removeListener', type, listener);
				}

				return this;
			};

			EventEmitter.prototype.removeAllListeners = function (type) {
				var key, listeners;

				if (!this._events)
					return this;

				// not listening for removeListener, no need to emit
				if (!this._events.removeListener) {
					if (arguments.length === 0)
						this._events = {};
					else if (this._events[type])
						this._events[type] = undefined;
					return this;
				}

				// emit removeListener for all listeners on all events
				if (arguments.length === 0) {
					for (key in this._events) {
						if (key === 'removeListener') continue;
						this.removeAllListeners(key);
					}
					this.removeAllListeners('removeListener');
					this._events = {};
					return this;
				}

				listeners = this._events[type];

				if (typeof listeners === 'function') {
					this.removeListener(type, listeners);
				} else {
					// LIFO order
					while (listeners.length)
						this.removeListener(type, listeners[listeners.length - 1]);
				}
				this._events[type] = undefined;

				return this;
			};

			EventEmitter.prototype.listeners = function (type) {
				var ret;
				if (!this._events || !this._events[type])
					ret = [];
				else if (typeof this._events[type] === 'function')
					ret = [this._events[type]];
				else
					ret = this._events[type].slice();
				return ret;
			};

			EventEmitter.listenerCount = function (emitter, type) {
				var ret;
				if (!emitter._events || !emitter._events[type])
					ret = 0;
				else if (typeof emitter._events[type] === 'function')
					ret = 1;
				else
					ret = emitter._events[type].length;
				return ret;
			};

			return EventEmitter;
		});

	// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
	/* utf.js - UTF-8 <=> UTF-16 convertion
	 *
	 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
	 * Version: 1.0
	 * LastModified: Dec 25 1999
	 * This library is free.  You can redistribute it and/or modify it.
	 */
	function utf8ArrayToStr(array) {
		var out, i, len, c;
		var char2, char3;

		out = '';
		len = array.length;
		i = 0;
		while (i < len) {
			c = array[i++];
			switch(c >> 4)
			{
				case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
				// 0xxxxxxx
				out += String.fromCharCode(c);
				break;
				case 12: case 13:
				// 110x xxxx   10xx xxxx
				char2 = array[i++];
				out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
				break;
				case 14:
					// 1110 xxxx  10xx xxxx  10xx xxxx
					char2 = array[i++];
					char3 = array[i++];
					out += String.fromCharCode(((c & 0x0F) << 12) |
					((char2 & 0x3F) << 6) |
					((char3 & 0x3F) << 0));
					break;
			}
		}

		return out;
	}
	//jscs:enable

	exports.RpcClient = {
		ports: {
			inherits: inherits,
			EventEmitter: EventEmitter
		}
	};

	var request = safeRequire('request');

	var webSocketSupportsSendCallback = true;
	var WebSocket = safeRequire('ws', function () {
		webSocketSupportsSendCallback = false;
		if (typeof exports.WebSocket === 'function') {
			return exports.WebSocket;
		} else if (typeof window !== 'undefined') {
			return window.WebSocket;
		} else {
			throw new Error('No WebSocket implementation available');
		}
	});

	/**
	 * HTTP tunnel transport
	 */
	function HttpTransport(url, sslSettings) {
		this.url = url;
		this.sslSettings = sslSettings || {};
		this.close = function () {};
	}
	inherits(HttpTransport, EventEmitter);

	HttpTransport.prototype.send = function (message, callback) {
		if (request) {
			var requestSettings = {
				body: JSON.stringify(message),
				encoding: null, // always get the body as a Buffer
				headers: { 'Content-Type': 'application/json' },
				url: this.url
			};
			for (var s in this.sslSettings) {
				if (this.sslSettings.hasOwnProperty(s)) {
					requestSettings[s] = this.sslSettings[s];
				}
			}
			request.post(requestSettings, function (error, response, body) {
				if (typeof callback === 'function') {
					if (error) {
						callback(error, null);
					} else if (body) {
						var contentType = response.headers['content-type'];
						if (contentType && contentType.indexOf('application/json') != -1) {
							var jsonBody = null;
							try {
								jsonBody = JSON.parse(body);
							} catch (jsonParseError) {
								callback(jsonParseError);
								return;
							}
							if (jsonBody.result !== undefined) {
								callback(null, jsonBody.result);
							} else if (jsonBody.error) {
								var jsonBodyError = jsonBody.error;
								var errorInstance = new Error(jsonBodyError.message + ': ' + jsonBodyError.data);
								errorInstance.data = jsonBodyError.data;
								errorInstance.code = jsonBodyError.code;
								callback(errorInstance);
							} else {
								callback(new Error('Empty response.'));
							}
						} else {
							// send buffer response
							callback(null, body);
						}
					} else {
						callback(new Error('Empty response.'));
					}
				}
			});
		} else {
			var xhr = new XMLHttpRequest();
			
			if (this.sslSettings.xhrFields) {
				for (var s in this.sslSettings.xhrFields) {
					if (this.sslSettings.xhrFields.hasOwnProperty(s)) {
						xhr[s] = this.sslSettings.xhrFields[s];
					}
				}
			}
			
			xhr.open('POST', this.url, true);
			xhr.responseType = 'arraybuffer';
			xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
			xhr.onreadystatechange = function () {
				if (xhr.readyState != 4) {
					return;
				}
				//request failed handling
				if (xhr.status === 0) {
					callback(new Error('Request failed'));
					return;
				}
				if (xhr.response && xhr.response.byteLength > 0) {
					if (xhr.getResponseHeader('content-type').indexOf('application/json') != -1) {
						var data = JSON.parse(utf8ArrayToStr(new Uint8Array(xhr.response)));
						if (data && data.result !== undefined) {
							callback(null, data.result);
						} else {
							var dataError = data.error;
							var errorInstance = new Error(dataError.message + ': ' + dataError.data);
							errorInstance.data = dataError.data;
							errorInstance.code = dataError.code;
							callback(errorInstance);
						}
					} else {
						callback(null, xhr.response);
					}
				} else {
					callback(xhr.statusText);
				}
			};
			xhr.send(JSON.stringify(message));
		}
	};

	/**
	 * WebSocket tunnel transport
	 */
	function WebSocketTransport(urlOrWs, sslSettings) {
		this.closed = false;
		this.sslSettings = sslSettings || {};
		if (typeof urlOrWs !== 'string') {
			this.ready = true;
			this.ws = urlOrWs;
		} else {
			this.ready = false;
			this.ws = new WebSocket(
				urlOrWs.replace('http:', 'ws:').replace('https:', 'wss:'),
				sslSettings
			);
		}
		this.attachEvents();
	}

	inherits(WebSocketTransport, EventEmitter);

	WebSocketTransport.prototype.attachEvents = function () {
		var self = this;
		var callbacks = this.callbacks = [];

		function on(event, fn) {
			if (typeof self.ws.on === 'function') {
				self.ws.on(event, fn);
			} else {
				self.ws['on' + event] = fn;
			}
		}

		on('message', function (event) {
			try {
				var msg = JSON.parse(event.data || event);

				if (msg.error) {
					var error = msg.error;
					var errorInstance = new Error(error.message + ': ' + error.data);
					errorInstance.data = error.data;
					errorInstance.code = error.code;
					msg.error = errorInstance;
				}

				if (Object.keys(msg).length === 0) {
					return;
				}
				var cb = callbacks[msg.id];
				if (cb) {
					delete callbacks[msg.id];
					cb(msg.error, msg.result);
				} else {
					self.emit('event', { name: msg.id, data: msg.result });
				}
			} catch (e) {
				self.emit('error', e);
			}
		});

		on('open', function () {
			self.ready = true;
		});

		on('close', function () {
			self.closed = true;
			self.emit('close');
		});

		on('error', function (err) {
			console.log(self.ws.url + ' -> ' + err);
			//if (err instanceof Error) self.emit('error', err);
		});
	};

	WebSocketTransport.prototype.send = function (message, callback) {
		var self = this;

		if (this.closed) {
			return;
		}

		if (!this.ready) {
			setTimeout(function () {
				self.send(message, callback);
			}, 50);
			return;
		}

		if (message.id !== undefined) {
			this.callbacks[message.id] = callback;
		}

		try {
			if (webSocketSupportsSendCallback) {
				this.ws.send(JSON.stringify(message), function (error) {
					if (error) {
						if (message.id !== undefined) {
							delete self.callbacks[message.id];
						}
						callback(error);
					}
				});
			} else {
				this.ws.send(JSON.stringify(message));
			}

		} catch (e) {
			callback(e);
		}
	};

	WebSocketTransport.prototype.close = function () {
		if (!this.closed) {
			this.ws.close();
		}
	};

	// Empty callback trap
	var noop = function() {};

	/**
	 * Client RPC tunnel
	 */
	var RpcTunnel = exports.RpcClient.tunnel = function RpcTunnel(url, sslSettings) {
		var self = this;
		if (! (this instanceof RpcTunnel)) {
			return new RpcTunnel(url, sslSettings);
		}
		if (url) {
			this.url = url;
			this.transports = {http: new HttpTransport(url, sslSettings)};

			Object.defineProperty(this.transports, 'ws', {
				enumerable: true, // JSWS-47 ensure we can discover the ws transport
				get: (function () {
					var webSocketTransport;
					return function () {
						if (!webSocketTransport) {
							webSocketTransport = new WebSocketTransport(url, sslSettings);
							webSocketTransport.on('event', function (e) {
								self.emit('event', e);
							});
						}
						return webSocketTransport;
					};
				}())
			});
		} else {
			this.WebSocketTransport = WebSocketTransport;
			this.transports = {};
		}
	};
	inherits(RpcTunnel, EventEmitter);

	RpcTunnel.prototype._nextId = (function () {
		var nextId = 0;
		return function () {
			return nextId++;
		};
	}());

	RpcTunnel.prototype.setToken = function(token) {
		this.token = token;
	};

	RpcTunnel.prototype.call = function (options, callback) {
		var method = options.method;
		var params = options.params;
		var expectReturn = !!options.expectReturn;
		var transport = options.transport || 'http';

		if (!method) {
			return;
		}

		if (!this.transports[transport]) {
			throw new Error('Invalid method transport requsted: ' + transport);
		}

		if (callback && typeof callback !== 'function') {
			throw new Error('Invalid callback function.');
		}

		var token = this.token;
		if (typeof window !== 'undefined') {
			if (!token && document.cookie) {
				var name = 'authnToken=';
				var cookies = document.cookie.split(';');
				for (var i = 0; i < cookies.length; i++) {
					var c = cookies[i].trim();
					if (c.indexOf(name) === 0) {
						token = c.substring(name.length, c.length);
						break;
					}
				}
			}
		} else {
			if (!token && global.token) {
				token = global.token;
			}
		}

		var msg = {
			'jsonrpc': '2.0',
			'method': method,
			'params': params,
			'token': token
		};

		if (expectReturn) {
			msg.id = this._nextId();
		}

		if (callback) {
			this.transports[transport].send(msg, callback);
		} else if (typeof Promise == 'function') {
			return new Promise(function(resolve, reject) {
				this.transports[transport].send(msg, function (error, result) {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				});
			}.bind(this));
		} else if (expectReturn) {
			throw new Error('No callback and no promises library.');
		} else {
			// JSONWS-6 The server does not produce a response for this call
			// We still need to make the call without notifying the client
			this.transports[transport].send(msg, noop);
		}
	};

	RpcTunnel.prototype.close = function () {
		Object.keys(this.transports).forEach(function (key) {
			this.transports[key].close();
		}.bind(this));
	};
}(typeof module !== 'undefined' ? module.exports : window));
