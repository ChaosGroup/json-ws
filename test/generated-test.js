(function (exports) {
	var RpcClient = (function () {
		try {
			return require('json-ws/client');
		} catch (e) {
			return exports.RpcClient;
		}
	}());
	var inherits = RpcClient.ports.inherits;
	var EventEmitter = RpcClient.ports.EventEmitter;
	var RpcTunnel = RpcClient.tunnel;

	var GeneratedTest = exports.GeneratedTest = function GeneratedTest(url, sslSettings) {
		if (!this instanceof GeneratedTest) {
			return new GeneratedTest(url);
		}
		if (!url || typeof url !== 'string') {
			throw new Error('Invalid proxy URL');
		}
		var self = this;
		this.defaultTransport = 'http';
		this.rpc = new RpcTunnel(url, sslSettings);
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

	GeneratedTest.prototype.useHTTP = function() {
		this.defaultTransport = 'http';
		return this;
	};

	GeneratedTest.prototype.useWS = function() {
		this.defaultTransport = 'ws';
		return this;
	};

	GeneratedTest.prototype.close = function() {
		this.rpc.close();
	};

	GeneratedTest.prototype.on = GeneratedTest.prototype.addListener = function(type, listener) {
		if (this.listeners(type).length == 0) {
			this.rpc.call({ method: 'rpc.on', params: [type], transport: 'ws' });
		}
		EventEmitter.prototype.addListener.call(this, type, listener);
	};

	GeneratedTest.prototype.removeListener = function(type, listener) {
		EventEmitter.prototype.removeListener.call(this, type, listener);
		if (this.listeners(type).length == 0) {
			this.rpc.call({ method: 'rpc.off', params: [type], transport: 'ws' });
		}
	};

	GeneratedTest.prototype.removeAllListeners = function(type) {
		EventEmitter.prototype.removeAllListeners.call(this, type);
		this.rpc.call({ method: 'rpc.off', params: [type], transport: 'ws' });
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
	GeneratedTest.RenderMode.Production = -1;
	GeneratedTest.RenderMode.RtCpu = 0;
	GeneratedTest.RenderMode.RtGpuCuda = 5
	Object.freeze(GeneratedTest.RenderMode);

	GeneratedTest.prototype.ns1 = {_ns:true};
	GeneratedTest.prototype.ns1.sub1 = {_ns:true};
	GeneratedTest.prototype.ns1.sub1.sub2 = {_ns:true};
	GeneratedTest.prototype.ns2 = {_ns:true};
	GeneratedTest.prototype.ns2.sub1 = {_ns:true};
	GeneratedTest.prototype.ns2.sub1.sub2 = {_ns:true};

	/**
	 * Some test method example, does int sum
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
	 * @param {RenderOptions} a 
	 * @returns {RenderOptions}
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * A sample method.
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * A sample method.
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
	 * @param {DefaultArray} p 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
	 * @returns {RenderOptions[]}
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

	/**
	 * 
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
			transport: this.defaultTransport
		}, callback);
	};

}(typeof module !== 'undefined' ? module.exports : window));
