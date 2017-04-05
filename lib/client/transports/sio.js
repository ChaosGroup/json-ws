/* eslint-disable */
(function(module, require, define) {
	'use strict';

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
	define('./transports/sio', SocketIoTransport);

	var SocketIO = require('socket.io-client');

	/**
	 *
	 * @param {string} url
	 * @param {object} options
	 * @param {string} options.serviceName Name of the service we need to establish socket connection
	 * @param {string} options.serviceVersion Version(two number type of version - 'x.y') of the service we need to establish socket connection
	 * @param {string} [options.serviceVersion] Path option to be given to the socket.io client.
	 * @param {object} [options.validationParams] Params that are necessary to validate the client. Send to the server only once on each connect/reconnect.
	 * @constructor
	 */
	function SocketIoTransport(url, options) {
		options = options || {};

		if (!options.serviceName) {
			throw new Error('option.serviceName is required');
		}
		if (!options.serviceVersion) {
			throw new Error('option.serviceVersion is required');
		}
		if (!options.path) {
			options.path = '/socket.io';
		}

		var validationParams = options.validationParams || {};

		var parsedUrl = parseUrl(url);
		if (!parsedUrl.host) {
			throw new Error('Invalid url and/or host: ' + url);
		}

		this.url = url;
		this.socket = SocketIO(parsedUrl.protocol + '//' + parsedUrl.host, {path: options.path});
		this._attachEvents(validationParams, options.serviceName, options.serviceVersion);

		this._contextAcknowledged = false;
	}

	inherits(SocketIoTransport, EventEmitter);

	Object.defineProperty(SocketIoTransport.prototype, 'name', {
		value: 'socket.io'
	});

	Object.defineProperty(SocketIoTransport.prototype, 'supportEvents', {
		get: function() { return true; }
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
		if (this.socket && this.socket.connected) {
			this.socket.close();
		}
	};

	SocketIoTransport.prototype._attachEvents = function(validationParams, serviceName, serviceVersion) {
		var self = this;
		var callbacks = this.callbacks = [];

		this.socket.on('message', function (event) {
			try {
				var msg = JSON.parse(event.data || event);

				if (msg.error) {
					var error = msg.error;
					var errorInstance = new Error(error.data || error.message);
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
				validationParams: validationParams,
				serviceName: serviceName,
				serviceVersion: serviceVersion
			}, function(/*ack*/) {
				self._contextAcknowledged = true;
			});
		});

		this.socket.on('disconnect', function () {
			self._contextAcknowledged = false;
			self.emit('close');
		});

		this.socket.on('error', function (err) {
			console.log(self.socket.io.uri + ' -> ' + err);
		});
	};

}.apply(null, (function() {
	'use strict';

	if (typeof window !== 'undefined') {
		if (typeof window.jsonws === 'undefined') {
			throw new Error('No json-ws polyfills found.');
		}

		var jsonws = window.jsonws;

		return [jsonws, jsonws.require, jsonws.define];
	}

	// else assume node.js:
	return [module, require, function() {}];
}())));
