/* eslint-disable */
(function(module, define) {
	// using non-strict mode, otherwise the re-assignment of require would throw TypeError
	if (typeof require !== 'function') {
		require = module.require;
	}

	var webSocketSupportsSendCallback = true;
	define('ws', function WebSocket(url, protocols) {
		webSocketSupportsSendCallback = false;

		if (typeof window.WebSocket === 'function') {
			return new window.WebSocket(url, protocols);
		} else {
			throw new Error('No WebSocket implementation available');
		}
	});

	var EventEmitter = require('events');
	var inherits = require('util').inherits;
	var WS = require('ws');

	module.exports = WebSocketTransport;

	// Defined with this name to keep node.js compatibility:
	define('./transports/ws', WebSocketTransport);

	function WebSocketTransport(url, settings) {
		this.closed = false;
		this.settings = settings || {};
		this.url = url;
		this.ready = false;
		this.ws = new WS(
			url.replace('http:', 'ws:').replace('https:', 'wss:'),
			settings
		);

		this.attachEvents();
	}
	inherits(WebSocketTransport, EventEmitter);

	Object.defineProperty(WebSocketTransport.prototype, 'name', {
		value: 'ws'
	});

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
					var errorMessage = error.data && (error.data.message || error.data);
					var errorInstance = new Error(errorMessage || error.message);
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
			self.emit('error', err);
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
