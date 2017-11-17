/* eslint-disable */
(function(module, define) {
	// using non-strict mode, otherwise the re-assignment of require would throw TypeError
	if (typeof require !== 'function') {
		require = module.require;
	}

	define('socket.io-client', function SocketIO() {
		var args = Array.prototype.slice.call(arguments);
		// 'socket.io-client' exposes 'io'
		// you must have window.io included separately
		if (window.io) {
			return window.io.apply(window, args);
		} else {
			throw new Error('No socket.io-client implementation available');
		}
	});

	var EventEmitter = require('events');
	var inherits = require('util').inherits;
	var parseUrl = require('url').parse;

	module.exports = SocketIoTransport;
	// Defined with this name to keep node.js compatibility:
	define('./transports/socket-io', SocketIoTransport);

	var SocketIO = require('socket.io-client');

	/**
	 *
	 * @param {string} url
	 * @param {object} options
	 * @param {string} [options.path] Path option to be given to the socket.io client.
	 * @param {object} [options.validationParams] Params that are necessary to validate the client. Send to the server only once on each connect/reconnect.
	 * @constructor
	 */
	function SocketIoTransport(url, options) {
		options = options || {};

		if (!options.path) {
			options.path = '/socket.io';
		}

		if (options.path[0] !== '/') {
			throw new Error("socket.io demands that 'options.path' begins with slash '/'");
		}

		var servicePrefixMatch = url.match(/(\/[^\/]+\/v\d+)$/);

		if (!servicePrefixMatch) {
			throw new Error('Invalid url, it should end in /<serviceName>/v<version.major>');
		}

		var serviceNamespace = servicePrefixMatch[0];

		var validationParams = options.validationParams || {};

		var parsedUrl = parseUrl(url);
		if (!parsedUrl.host) {
			throw new Error('Invalid url and/or host: ' + url);
		}

		this.url = url;
		this.socket = SocketIO(parsedUrl.protocol + '//' + parsedUrl.host + serviceNamespace, {path: options.path});
		this._attachEvents(validationParams);

		this._contextAcknowledged = false;
	}

	inherits(SocketIoTransport, EventEmitter);

	Object.defineProperty(SocketIoTransport.prototype, 'name', {
		value: 'socket.io'
	});

	/**
	 * @param {object} message - rpc message to send
	 * @param callback
	 */
	SocketIoTransport.prototype.send = function(message, callback) {
		var self = this;

		if (!this.socket || this.socket.disconnected || !self._contextAcknowledged) {
			setTimeout(function () {
				self.send(message, callback);
			}, 50);
			return;
		}

		if (message.id !== undefined) {
			this.callbacks[message.id] = callback;
		}

		try {
			this.socket.send(JSON.stringify(message), function (error) {
				if (error) {
					if (message.id !== undefined) {
						delete self.callbacks[message.id];
					}
					callback(error);
				}
			});
		} catch (e) {
			callback(e);
		}
	};

	SocketIoTransport.prototype.close = function() {
		this.socket.disconnect();
	};

	SocketIoTransport.prototype._attachEvents = function(validationParams) {
		var self = this;
		var callbacks = this.callbacks = [];

		this.socket.on('message', function (event) {
			try {
				if (typeof event === 'string')  {
					event = JSON.parse(event);
				}

				var msg = event.data || event;

				if (msg.error) {
					var error = msg.error;
					var errorMessage = error.data && error.data.message;
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

		this.socket.on('connect', function () {
			self.socket.emit('rpc.sio.setConnectionContext', {
				validationParams: validationParams
			}, function(/*ack*/) {
				self._contextAcknowledged = true;
			});
		});

		this.socket.on('disconnect', function () {
			self._contextAcknowledged = false;
			self.emit('close');
		});

		this.socket.on('error', function (err) {
			self.emit(err);
		});
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
