/**
 * Client RPC Tunnels
 */
/* eslint-disable */
(function (module, define) {
	// using non-strict mode, otherwise the re-assignment of require would throw TypeError
	if (typeof require !== 'function') {
		require = module.require;
	}

	module.exports = RpcTunnel;

	// Defined with this name to keep node.js compatibility:
	define('json-ws/client', RpcTunnel);

	// Empty callback trap
	var noop = function() {};

	/**
	 * Client RPC tunnel
	 */
	function RpcTunnel(url, sslSettings) {
		var self = this;
		if (! (this instanceof RpcTunnel)) {
			return new RpcTunnel(url, sslSettings);
		}

		this.transports = {};

		if (!url) {
			throw new Error('Missing url parameter, which should be either a URL or client transport.')
		}

		var transport = null;

		if (typeof url === 'string') {
			var HttpTransport = require('./transports/http');
			transport = new HttpTransport(url, sslSettings);

			// As a special case when adding an HTTP transport, set up the WebSocket transport
			// It is lazy-loaded, so the WebSocket connection is only created if/when the transport is used
			Object.defineProperty(this.transports, 'ws', {
				enumerable: true, // JSWS-47 ensure we can discover the ws transport
				get: (function () {
					var webSocketTransport;
					var WebSocketTransport = require('./transports/ws');
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
			transport = url;
			transport.on('event', function (e) {
				self.emit('event', e);
			});
		}

		transport.on('error', function(err) {
			self.emit('error', err);
		});

		this.url = transport.url;
		this.transports[transport.name] = transport;
	}

	var EventEmitter = require('events');
	var inherits = require('util').inherits;
	inherits(RpcTunnel, EventEmitter);

	RpcTunnel.prototype._nextId = (function () {
		var nextId = 0;
		return function () {
			return nextId++;
		};
	}());

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

		var msg = {
			'jsonrpc': '2.0',
			'method': method,
			'params': params
		};

		if (expectReturn) {
			msg.id = this._nextId();
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
			} else {
				throw new Error('No callback and no Promise support.');
			}
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
}.apply(null, (function() {
	'use strict';

	if (typeof module !== 'undefined') {
		// node.js and webpack
		return [module, function() {}];
	}

	if (typeof window !== 'undefined') {
		// browser
		if (typeof window.jsonws === 'undefined') {
			throw new Error('No json-ws polyfills found.');
		}

		var jsonws = window.jsonws;

		return [jsonws, jsonws.define];
	}

	throw new Error('Unknown environment, this code should be used in node.js/webpack/browser');
}())));
