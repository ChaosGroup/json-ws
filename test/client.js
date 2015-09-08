/**
 * JSON-WS RPC client test suite
 */

'use strict';

/* error codes:
 -32600: jsonrpc not 2.0
 -32601: method not found
 -32602: invalid parameters
 -32000: internal server error
 -32700: parse error
 */

var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var async = require('async');
var Q = require('q');

if (typeof global.Promise != 'function') {
	// Polyfill Promise for Node 0.10.x
	global.Promise = function Promise(callback) {
		var deferred = Q.defer();
		callback(deferred.resolve.bind(deferred), deferred.reject.bind(deferred));
		this.then = deferred.promise.then.bind(deferred.promise);
		this.catch = deferred.promise.catch.bind(deferred.promise);
	};
}
var jsonws = require('../index.js');
var request = require('request');
var WebSocket = require('ws');
var http = require('http');
var express = require('express');

function buildTestApi() {
	var api = require('../index.js').api('1.0', 'Test');

	function TestAPI() {
	}

	TestAPI.prototype.sum = function (a, b) {
		return a + b;
	};
	TestAPI.prototype.asyncSum = function (a, b, callback) {
		callback(null, a + b);
	};
	TestAPI.prototype.throwError = function () {
		throw new Error('Throw error test');
	};

	api.defineAll(new TestAPI());
	api.type('TestData', {
		a: 'int',
		b: 'string'
	});
	api.define({
		name: 'optionalArgs',
		params: [
			{ name: 'a', type: 'string' },
			{ name: 'b', type: 'string', default: 'b' },
			{ name: 'c', type: 'string', default: 'c' }
		],
		returns: 'string'
	}, function(a, b, c) {
		return [a, b, c].join('');
	});
	api.define({
		name: 'throwError',
		returns: 'object'
	});
	api.define({
		name: 'testAsyncReturn',
		params: [ {name: 'throwError', type: 'bool'} ],
		returns: 'async'
	}, function(throwError, callback) {
		setImmediate(function() {
			callback(throwError ? new Error('Callback error') : null);
		})
	});
	api.define({
		name: 'sum',
		params: [
			{name: 'a', type: 'int'},
			{name: 'b', type: 'int'}
		],
		returns: 'int'
	});
	api.define({
		name: 'hello',
		returns: 'string'
	}, function() {
		return 'world'
	});
	api.define({
		name: 'asyncSum',
		params: [
			{name: 'a', type: '*'},
			{name: 'b', type: '*'}
		],
		returns: '*'
	});
	api.define({
		name: 'mul',
		params: [
			{name: 'a', type: 'int'},
			{name: 'b', type: 'int'}
		],
		returns: 'int'
	}, function(a, b) { return a * b });
	api.define({
		name: 'sumArray',
		params: [
			{name: 'ints', type: ['int']}
		],
		returns: 'int'
	}, function(ints) { var sum = 0; ints.forEach(function(i){sum += i}); return sum; });
	api.define({
		name: 'test.some.namespace.mul',
		params: [
			{name: 'a', type: 'int'},
			{name: 'b', type: 'int'}
		],
		returns: 'int'
	}, function(a, b) { return a * b });
	api.define({
		name: 'dataTest',
		params: [{name: 'a', type: 'TestData'}],
		returns: 'TestData'
	}, function (a) { return a;	});
	api.event('testEvent');
	api.event('testDataEvent');
	api.event('test.the.namespace.event');

	setInterval(function () {
		api.emit('testEvent');
		api.emit('test.the.namespace.event');
	}, 100);
	setInterval(function () {
		api.emit('testDataEvent', { hello: 'world' })
	}, 100);

	return api;
}

var srv;
var serverUrl;
var serverWsUrl;
var httpProxyUrl;

function startServer(done) {
	var PORT = 3000;
	var PATH = '/endpoint';
	var app = express();
	var registry = jsonws.registry(PATH);

	app.use(express.json());
	app.use(express.urlencoded());
	app.use(registry.router());

	var api = buildTestApi();

	srv = http.createServer(app).listen(PORT, function () {
		api.listen(PATH, [jsonws.transport.HTTP(srv, app), jsonws.transport.WebSocket(srv)]);
		serverUrl = 'http://localhost:' + srv.address().port + api.path;
		serverWsUrl = serverUrl.replace('http', 'ws');
		httpProxyUrl = serverUrl + '?proxy=JavaScript&localName=Tester';
		done();
	});

	srv.on('error', function (err) {
		console.log(err);
		process.exit();
	});
}

function setup() {
	suiteSetup(function (done) {
		srv ? done() : startServer(done);
	});
}

/*suite('test', function() {
 setup();
 test('-', function(done){this.timeout(0)});
 });*/

suite('Metadata', function () {
	setup();

	test('Metadata in JSON format', function (done) {
		request.get(serverUrl + '?json', function (err, response, body) {
			assert.isNull(err);
			var json = JSON.parse(body);
			assert.isDefined(json.name);
			assert.isDefined(json.version);
			assert.isDefined(json.transports);
			assert.isDefined(json.types);
			assert.isDefined(json.events);
			assert.isDefined(json.methods);
			done();
		});
	});

	test('Proxies: languages', function (done) {
		var languages = ['JavaScript', 'Java', 'CSharp', 'Python'];
		var proxyUrls = languages.map(function (language) {
			return serverUrl + '?proxy=' + language;
		});
		async.map(proxyUrls, request.get.bind(request), function (err, results) {
			expect(err).to.not.exist;
			results.forEach(function (r) {
				assert.equal(r.statusCode, 200, 'Missing proxy for ' + r.req.path.substr(20))
			});
			done();
		});
	});
});

suite('RPC over HTTP', function () {
	setup();

	function get(method) {
		return async.apply(request.get.bind(request), { url: serverUrl + '/' + method });
	}

	function post(method, json) {
		return async.apply(request.post.bind(request), {
			url: serverUrl + '/' + method,
			json: json || {}
		})
	}

	test('HTTP Requests: legal method calls', function (done) {
		var expected = [
			3, 3, 3, '12', 3, 6, 12,
			{a: 12, b: 'hello'}, 10, 11, 12, 13,
			'world', 'world',
			'Abc', 'ABc', 'AbC', 'ABC',
			'Abc', 'ABc', 'ABC',
			'Abc', 'ABc', 'AbC', 'ABC', 'ABC'
		];
		async.parallel([
			post('sum', {params: {b: 1, a: 2}}),
			post('asyncSum?id=1', {params: [2, 1]}),
			get('sum?a=2&b=1'),
			post('asyncSum', {params: ['1', '2']}),
			get('sum?params=["1", "2"]'),
			get('mul?params=["3", "2"]'),
			post('mul', {params: {a: 4, b: 3}}),
			get('dataTest?params=[{"a": 12, "b": "hello"}]'),
			get('sumArray?params=[[1,2,3,4]]'),
			get('sumArray?ints=[1,2,3,5]'),
			post('sumArray', {params: { ints: [1,2,3,6] } }),
			post('sumArray', {params: [ [1,2,3,7] ] }),
			get('hello'),
			post('hello'),
			get('optionalArgs?a=A'),
			get('optionalArgs?a=A&b=B'),
			get('optionalArgs?a=A&c=C'),
			get('optionalArgs?a=A&b=B&c=C'),
			get('optionalArgs?params=["A"]'),
			get('optionalArgs?params=["A", "B"]'),
			get('optionalArgs?params=["A", "B", "C"]'),
			post('optionalArgs', { params: ['A']}),
			post('optionalArgs', { params: ['A', 'B']}),
			post('optionalArgs', { params: { a: 'A', c: 'C' } }),
			post('optionalArgs', { params: ['A', 'B', 'C'] }),
			post('optionalArgs', { params: { a: 'A', b: 'B', c: 'C' } })
		], function (err, results) {
			results = results.map(function (r) { // r[0] - response, r[1] - body
				if (typeof r[1] === 'string') {
					r[1] = JSON.parse(r[1]);
				}
				return r[1].result;
			});
			assert.deepEqual(results, expected);
			done();
		});
	});

	test('HTTP Requests: error codes', function (done) {
		var expected = [
			-32601, -32601, -32601,	 // method not found
			-32602, -32602, -32602,  // invalid parameters
			-32602, -32602,
			-32000, -32000, -32602, -32602, -32000	 // internal server error
		];

		async.parallel([
			get('inexistingMethod'),
			post('inexistingMethod'),
			post('?'),
			get('sum?params={"c":1, "a":2}'),
			get('sum?a=2&c=1'),
			get('sum?params=[2]'),
			get('optionalArgs'),
			get('optionalArgs?b=b&c=c'),
			get('sumArray?ints=1234'),
			get('throwError'),
			get('hello?params=["fake"]'),
			post('hello', {params:['fake']}),
			get('dataTest?params=[1234]')
		], function (err, results) {
			results = results.map(function (r) { // r[0] - response, r[1] - body
				if (typeof r[1] === 'string') {
					r[1] = JSON.parse(r[1]);
				}
				//console.log(r[1]);
				assert.isDefined(r[1].error);
				assert.isNotNull(r[1].error);
				return r[1].error.code;
			});
			assert.deepEqual(results, expected);
			done();
		});
	});
});

suite('RPC over WebSocket', function () {
	setup();

	test('WebSocket: legal method calls and event subscription', function (done) {
		this.timeout(4000);

		var ws = new WebSocket(serverWsUrl);
		var events = 0;
		var recCommands = 0;
		var expCommands;
		var expected = {
			'sum': 0,
			asyncSum: '12',
			hello: 'world',
			dataTest: {a: 5, b: 'test'},
			sumArray: 10,
			optionalArgs: 'AbC'
		};
		var results = {};

		function sendCommand(command, params, callback) {
			var commandData = {
				id: command,
				method: command,
				params: params,
				jsonrpc: '2.0'
			};
			var request = JSON.stringify(commandData);
			ws.send(request, callback);
		}

		ws.on('open', function () {
			ws.send(JSON.stringify({
				'jsonrpc': '2.0',
				'method': 'rpc.on',
				'params': ['testEvent']
			}));

			async.parallel([
				async.apply(sendCommand, 'sum', [2, -2]),
				async.apply(sendCommand, 'sum', {'a': 2, 'b': -2}),
				async.apply(sendCommand, 'hello', null),
				async.apply(sendCommand, 'asyncSum', ['1', '2']),
				async.apply(sendCommand, 'dataTest', { a: { a: 5, b: 'test', extra: 'true' }}),
				async.apply(sendCommand, 'sumArray', { ints: [1, 2, 3, 4]}),
				async.apply(sendCommand, 'sumArray', [ [1, 2, 3, 4] ]),
				async.apply(sendCommand, 'optionalArgs', { a: 'A', c: 'C' })
			], function (err, result) {
				expCommands = result.length;
			});
		});

		ws.on('message', function (data) {
			var parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			assert.isNotNull(parsedData);
			if (parsedData.error) console.log(parsedData.error);
			assert.isUndefined(parsedData.error);
			assert.isDefined(parsedData.id);
			if (parsedData.id == 'testEvent') {
				events++;
			} else {
				recCommands++;
				if (typeof parsedData.result === 'object') {
					assert.deepEqual(parsedData.result, expected[parsedData.id]);
				} else {
					assert.strictEqual(parsedData.result, expected[parsedData.id]);
				}
				results[parsedData.id] = parsedData.result;
			}
		});

		var finalEvents = 0;
		setTimeout(function () {
			assert.deepEqual(expected, results);
			assert.equal(recCommands, expCommands);
			assert.isTrue(events > 0, 'events > 0');
			ws.send(JSON.stringify({
				'jsonrpc': '2.0',
				'method': 'rpc.off',
				'params': ['testEvent']
			}));
			finalEvents = events;
		}, 1200);

		setTimeout(function() {
			finalEvents = events;
		}, 2000);

		setTimeout(function () {
			assert.equal(events, finalEvents, 'events do not fire after unsubscribe');
			ws.close();
			done();
		}, 3000);
	});

	test('WebSocket: error codes', function (done) {
		this.timeout(660);
		var ws = new WebSocket(serverWsUrl);
		var id = 0;
		var expected = [-32600,
			-32601, -32601, -32601,
			-32602, -32602, -32602, -32602, -32602, -32602,
			-32000, -32000, -32000, -32000];
		var results = [];

		function sendCommand(command, params, callback) {
			var commandData = {
				id: id++,
				method: command,
				params: params,
				jsonrpc: '2.0'
			};
			var request = JSON.stringify(commandData);
			var cb = callback || params || command;
			ws.send(request, cb);
		}

		function sendPartialCommand(commandData, callback) {
			commandData.id = id++;
			var request = JSON.stringify(commandData);
			ws.send(request, callback);
		}

		function sendCommands() {
			async.series([
				async.apply(sendPartialCommand, {'jsonrpc': '1.0'}),
				async.apply(sendCommand, 'inexistingMethod'),
				async.apply(sendCommand),
				async.apply(sendPartialCommand, {'jsonrpc': '2.0'}),
				async.apply(sendPartialCommand, {'jsonrpc': '2.0', 'method': 'sum'}),
				async.apply(sendCommand, 'sum'),
				async.apply(sendCommand, 'sum', [2]),
				async.apply(sendCommand, 'sum', {'a': 2, 'c': 1}),
				async.apply(sendCommand, 'optionalArgs', []),
				async.apply(sendCommand, 'hello', ['fake']),
				async.apply(sendCommand, 'throwError'),
				async.apply(sendCommand, 'dataTest', ['invalid']),
				async.apply(sendCommand, 'dataTest', [1234]),
				async.apply(sendCommand, 'sumArray', [1234])
			]);
		}

		ws.on('open', function () {
			sendCommands();
		});
		ws.on('message', function (data) {
			var parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			assert.isNotNull(parsedData);
			assert.isDefined(parsedData.error);
			assert.isNotNull(parsedData.error);
			assert.isDefined(parsedData.id);
			assert.isNotNull(parsedData.id);
			results[parsedData.id] = parsedData.error.code;
		});

		setTimeout(function () {
			assert.deepEqual(expected, results);
			ws.close();
			done();
		}, 500);
	});

	test('WebSocket: parse error', function (done) {
		this.timeout(150);
		var ws = new WebSocket(serverWsUrl);
		var messages = 0;
		ws.on('open', function () {
			ws.send('Parse Error must be returned.');
		});
		ws.on('message', function (data) {
			var parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			messages++;
			assert.isNotNull(parsedData);
			assert.isDefined(parsedData.error);
			assert.isNotNull(parsedData.error);
			assert.equal(parsedData.error.code, -32700);
		});
		setTimeout(function () {
			assert.equal(messages, 1);
			done();
		}, 120);
	});
});

suite('Node.JS proxy', function () {
	setup();

	test('Legal method calls', function (done) {
		jsonws.proxy(httpProxyUrl, function (err, proxy) {
			assert.notOk(err, 'error obtaining proxy');
			assert.ok(proxy, 'invalid proxy object');

			if (err) {
				done();
				return;
			}

			var t = new proxy.Tester(serverUrl);
			var expected = [5, 6, 10, 6, 10, 25, {a: 5, b: 'test'}, 'Abc', 'ABc', 'ABC', 'world'];

			Q.all([
				t.sum(2, 3),
				t.sum('2', 4),
				t.sumArray([1, 2, 3, 4]),
				t.mul(2, 3),
				t.mul(2, '5'),
				t.test.some.namespace.mul(5, 5),
				t.dataTest({a: '5', b: 'test'}),
				t.optionalArgs('A'),
				t.optionalArgs('A', 'B'),
				t.optionalArgs('A', 'B', 'C'),
				t.hello()
			]).then(function (results) {
				assert.deepEqual(results, expected, 'invalid results');
			}).finally(done)
			.done();
		});
	});

	test('Error codes', function (done) {
		jsonws.proxy(httpProxyUrl, function (err, proxy) {
			assert.notOk(err, 'error obtaining proxy');
			assert.ok(proxy, 'invalid proxy object');

			if (err) {
				done();
				return;
			}

			var t = new proxy.Tester(serverUrl);
			var expected = [-32000, -32602, -32602, 3, -32602, 'world'];
			var actual = [];

			Q.allSettled([
				t.throwError(),
				t.sum(1),
				t.sum(),
				t.sum(1, 2, 3),
				t.optionalArgs(),
				t.hello('fake', 'argument') // JavaScript proxies filter out unneeded arguments, so this won't throw
			]).then(function (results) {
				results.forEach(function (result) {
					if (result.state === "rejected") {
						actual.push(result.reason.code);
					} else {
						actual.push(result.value);
					}
				});
			}).finally(function() {
				assert.deepEqual(expected, actual);
				done();
			}).done();
		});
	});

	test('Events', function (done) {
		this.timeout(5000);

		jsonws.proxy(httpProxyUrl, function (err, proxy) {
			assert.notOk(err, 'error obtaining proxy');
			assert.ok(proxy, 'invalid proxy object');

			if (err) {
				done();
				return;
			}

			var t = new proxy.Tester(serverUrl);
			var h1 = 0;
			var h2 = 0;
			var h3 = 0;
			var data = null;
			function eventHandler1() { h1++; }
			function eventHandler2() { h2++; }
			function eventHandler3() { h3++; }

			t.on('testEvent', eventHandler1);
			t.on('testDataEvent', function(e) { data = e; });
			setTimeout(function () {
				t.on('testEvent', eventHandler2);
				t.on('test.the.namespace.event', eventHandler3);
			}, 500);

			setTimeout(function () {
				assert.isTrue(h1 > 0);
				t.removeListener('testEvent', eventHandler1);
				h1 = 0;
			}, 1000);

			setTimeout(function () {
				assert.isTrue(h2 > 0);
				assert.isTrue(h3 > 0);
				t.removeAllListeners('testEvent');
				t.removeAllListeners('test.the.namespace.event');
				h2 = h3 = 0;
			}, 1500);

			setTimeout(function () {
				assert.equal(h1 + h2 + h3, 0);
				assert.deepEqual(data, { hello: 'world'});
				done();
			}, 2000);
		});
	});

	test('Async return', function (done) {
		this.timeout(1000);
		jsonws.proxy(httpProxyUrl, function (err, proxy) {
			assert.notOk(err, 'error obtaining proxy');
			assert.ok(proxy, 'invalid proxy object');

			if (err) {
				done();
				return;
			}

			var t = new proxy.Tester(serverUrl);
			t.testAsyncReturn(false, function() {
				t.testAsyncReturn(true, function(err) {
					assert.ok(err);
					done();
				});
			});
		});
	});
});
