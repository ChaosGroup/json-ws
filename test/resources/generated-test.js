/**
 * @module GeneratedTest
 */
(function (module, require, define) {
	var EventEmitter = require('events');
	var inherits = require('util').inherits;
	var RpcTunnel = require('json-ws/client');

	/**
	 * @param {(url|Transport)} url - Either url of server (string) or Transport instance to be used as a sole transport.
	 * @constructor
	 * @alias module:GeneratedTest.GeneratedTest
	 */
	var GeneratedTest = exports.GeneratedTest = function GeneratedTest(url, sslSettings) {
		if (!this instanceof GeneratedTest) {
			return new GeneratedTest(url);
		}
		if (!url) {
			throw new Error('Invalid proxy URL');
		}
		if (typeof url !== 'string') {
			this._transport = url;
			this.defaultTransport = null;
			this.rpc = new RpcTunnel(url);
		} else {
			this._transport = null;
			this.rpc = new RpcTunnel(url, sslSettings);
			this.defaultTransport = 'http';
		}
		var self = this;
		this.rpc.on('event', function(e) {
			self.emit(e.name, e.data);
		});
		function rebind(obj) {
			var result = {};
			for (var i in obj) {
				var prop = obj[i];
				if (typeof prop === 'function') {
					result[i] = prop.bind(self);
				} else if (typeof prop === 'object') {
					result[i] = rebind(prop);
				}
			}
			return result;
		}
		for (var i in this) {
			if (this[i] && this[i]._ns) {
				this[i] = rebind(this[i]);
			}
		}
	};
	inherits(GeneratedTest, EventEmitter);
	Object.defineProperty(GeneratedTest, 'VERSION', { value: '1.0'});

	GeneratedTest.prototype.useHTTP = function() {
		if (this._transport !== null && this._transport.name !== 'http') {
			throw new Error('HTTP transport requested, but ' + this._transport.name + ' given.');
		} else {
			this.defaultTransport = 'http';
		}

		return this;
	};

	GeneratedTest.prototype.useWS = function() {
		if (this._transport !== null && this._transport.name !== 'ws') {
			throw new Error('WebSockets transport requested, but ' + this._transport.name + ' given.');
		} else {
			this.defaultTransport = 'ws';
		}

		return this;
	};

	GeneratedTest.prototype.close = function() {
		this.rpc.close();
	};

	GeneratedTest.prototype.on = GeneratedTest.prototype.addListener = function(type, listener) {
		if (this.listeners(type).length == 0) {
			if (this._transport && this._transport.supportEvents) {
				this.rpc.call({ method: 'rpc.on', params: [type], transport: this._transport.name });
			} else if (this._transport === null) {
				this.rpc.call({ method: 'rpc.on', params: [type], transport: 'ws'});
			}
		}
		EventEmitter.prototype.addListener.call(this, type, listener);
	};

	GeneratedTest.prototype.removeListener = function(type, listener) {
		EventEmitter.prototype.removeListener.call(this, type, listener);
		if (this.listeners(type).length == 0) {
			if (this._transport && this._transport.supportEvents) {
				this.rpc.call({ method: 'rpc.off', params: [type], transport: this._transport.name });
			} else if (this._transport === null) {
				this.rpc.call({ method: 'rpc.off', params: [type], transport: 'ws'});
			}
		}
	};

	GeneratedTest.prototype.removeAllListeners = function(type) {
		EventEmitter.prototype.removeAllListeners.call(this, type);
		if (this._transport && this._transport.supportEvents) {
			this.rpc.call({ method: 'rpc.off', params: [type], transport: this._transport.name });
		} else if (this._transport === null) {
			this.rpc.call({ method: 'rpc.off', params: [type], transport: 'ws'});
		}
	};

	GeneratedTest.RenderMode = function (val) {
		switch (val) {
			case 'Production': return -1;
			case 'RtCpu': return 0;
			case 'RtGpuCuda': return 5;
			case -1: return 'Production';
			case 0: return 'RtCpu';
			case 5: return 'RtGpuCuda';
		}
	};

	/**
	 * @enum {number}
	 * @alias module:GeneratedTest.GeneratedTest.RenderMode
	 */
	var RenderMode = {
		Production: -1,
		RtCpu: 0,
		RtGpuCuda: 5
	};

	GeneratedTest.RenderMode.Production = -1;
	GeneratedTest.RenderMode.RtCpu = 0;
	GeneratedTest.RenderMode.RtGpuCuda = 5
	Object.freeze(GeneratedTest.RenderMode);

	/**
	 * RenderOptions description
	 * @typedef {Object} module:GeneratedTest.GeneratedTest.RenderOptions
	 * @property {int} width The desired width for rendering
	 * @property {int} height
	 * @property {module:GeneratedTest.GeneratedTest.RenderMode} renderMode
	 */


	/**
	 * @typedef {Object} module:GeneratedTest.GeneratedTest.DefaultArray
	 * @property {string} property
	 */

	GeneratedTest.prototype.ns1 = {_ns:true};
	GeneratedTest.prototype.ns1.sub1 = {_ns:true};
	GeneratedTest.prototype.ns1.sub1.sub2 = {_ns:true};
	GeneratedTest.prototype.ns2 = {_ns:true};
	GeneratedTest.prototype.ns2.sub1 = {_ns:true};
	GeneratedTest.prototype.ns2.sub1.sub2 = {_ns:true};

	/**
	 * Some test method example,&#39; does int sum
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#sum
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	GeneratedTest.prototype.sum = function(a, b) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(2, args.length);
		return this.rpc.call({
			method: 'sum',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#sumReturn
	 */
	GeneratedTest.prototype.sumReturn = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'sumReturn',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#echo
	 * @param {module:GeneratedTest.GeneratedTest.RenderOptions} a
	 * @returns {module:GeneratedTest.GeneratedTest.RenderOptions}
	 */
	GeneratedTest.prototype.echo = function(a) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'echo',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#echoObject
	 * @param {object} a
	 * @returns {object}
	 */
	GeneratedTest.prototype.echoObject = function(a) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'echoObject',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#throwError
	 * @returns {number}
	 */
	GeneratedTest.prototype.throwError = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'throwError',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#throwUnexpectedError
	 * @returns {object[]}
	 */
	GeneratedTest.prototype.throwUnexpectedError = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'throwUnexpectedError',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 * A sample method.
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#testMe
	 * @returns {object}
	 */
	GeneratedTest.prototype.testMe = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'testMe',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#testMe1
	 */
	GeneratedTest.prototype.testMe1 = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'testMe1',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 * A sample method.
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#testMe2
	 * @param {string} a A simple string parameter.
	 * @returns {string}
	 */
	GeneratedTest.prototype.testMe2 = function(a) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'testMe2',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#testMe3
	 */
	GeneratedTest.prototype.testMe3 = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'testMe3',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#testMe4
	 */
	GeneratedTest.prototype.testMe4 = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'testMe4',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#getStream
	 * @returns {stream}
	 */
	GeneratedTest.prototype.getStream = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'getStream',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#TestDefaultArray
	 * @param {module:GeneratedTest.GeneratedTest.DefaultArray} p
	 */
	GeneratedTest.prototype.TestDefaultArray = function(p) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'TestDefaultArray',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#TestUrl
	 * @param {string} u
	 * @returns {string}
	 */
	GeneratedTest.prototype.TestUrl = function(u) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'TestUrl',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#getRenderOptions
	 * @returns {module:GeneratedTest.GeneratedTest.RenderOptions[]}
	 */
	GeneratedTest.prototype.getRenderOptions = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'getRenderOptions',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#echoStringAsBuffer
	 * @param {string} theString
	 * @returns {Uint8Array}
	 */
	GeneratedTest.prototype.echoStringAsBuffer = function(theString) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'echoStringAsBuffer',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#getBufferSize
	 * @param {Uint8Array} buffer
	 * @returns {number}
	 */
	GeneratedTest.prototype.getBufferSize = function(buffer) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'getBufferSize',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#returnFrom0ToN
	 * @param {number} n
	 * @returns {number[]}
	 */
	GeneratedTest.prototype.returnFrom0ToN = function(n) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'returnFrom0ToN',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#optionalArgs
	 * @param {boolean} required
	 * @param {number} [p1]
	 * @param {number} [p2]
	 */
	GeneratedTest.prototype.optionalArgs = function(required, p1, p2) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(3, args.length);
		return this.rpc.call({
			method: 'optionalArgs',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#sumArray
	 * @param {number[]} ints
	 * @returns {number}
	 */
	GeneratedTest.prototype.sumArray = function(ints) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'sumArray',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#testAny
	 * @param {object} a
	 * @returns {object}
	 */
	GeneratedTest.prototype.testAny = function(a) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'testAny',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#getSeconds
	 * @param {Date} timeParam
	 * @returns {number}
	 */
	GeneratedTest.prototype.getSeconds = function(timeParam) {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = Math.min(1, args.length);
		return this.rpc.call({
			method: 'getSeconds',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest#getNow
	 * @returns {Date}
	 */
	GeneratedTest.prototype.getNow = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'getNow',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest# "ns1.method1"
	 * @returns {string}
	 */
	GeneratedTest.prototype.ns1.method1 = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'ns1.method1',
			params: args,
			expectReturn: true,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest# "ns1.sub1.sub2.method1"
	 */
	GeneratedTest.prototype.ns1.sub1.sub2.method1 = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'ns1.sub1.sub2.method1',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 *
	 * @function
	 * @name module:GeneratedTest.GeneratedTest# "ns2.sub1.sub2.method1"
	 */
	GeneratedTest.prototype.ns2.sub1.sub2.method1 = function() {
		var args = Array.prototype.slice.call(arguments);
		var callback = null;
		if (args.length && typeof args[args.length - 1] === 'function') {
			callback = args.pop();
		}
		args.length = 0;
		return this.rpc.call({
			method: 'ns2.sub1.sub2.method1',
			params: args,
			expectReturn: false,
			transport: this._transport && this._transport.name || this.defaultTransport
		}, callback);
	};

	/**
	 * This event is fired every second, and returns a data count.
	 *
	 * @event module:GeneratedTest.GeneratedTest."testEvent"
	 * @type int
	 */

	/**
	 * @event module:GeneratedTest.GeneratedTest."testEvent2"
	 * @type module:GeneratedTest.GeneratedTest.RenderOptions
	 */

	/**
	 * @event module:GeneratedTest.GeneratedTest."testEvent3"
	 * @type json
	 */

	/**
	 * @event module:GeneratedTest.GeneratedTest."testEvent4"
	 * @type bool
	 */

	/**
	 * @event module:GeneratedTest.GeneratedTest."testBinaryEvent"
	 * @type binary
	 */

	/**
	 * @event module:GeneratedTest.GeneratedTest."ns1.testEvent1"
	 * @type null
	 */

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
