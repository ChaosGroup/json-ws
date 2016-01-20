/**
 * JSON-WS RPC client test suite
 */
'use strict';

// error codes:
// -32600: jsonrpc not 2.0
// -32601: method not found
// -32602: invalid parameters
// -32000: internal server error
// -32700: parse error

var Bluebird = require('bluebird');
var _ = require('lodash');
var chai = require('chai');
var expect = chai.expect;

if (typeof global.Promise != 'function') {
	// Polyfill Promise for Node 0.10.x
	global.Promise = Bluebird;
}
var jsonws = require('../index.js');
var request = Bluebird.promisifyAll(require('request'));
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
	TestAPI.prototype.throwUnexpectedError = function () {
		throw new Error('Throw unexpected error test');
	};
	TestAPI.prototype.returnError = function() {
		return new Error('FooBar');
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
		returns: 'async'
	});
	api.define({
		name: 'throwUnexpectedError',
		returns: ['object']
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
	api.define({
		name: 'returnError',
		returns: 'error'
	});
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

function setupServer(done) {
	srv ? done() : startServer(done);
}

describe('Metadata', function() {
	before(setupServer);

	it('returns metadata in JSON format', function() {
		return request.getAsync(serverUrl + '?json', { json: true }).then(function(result) {
			var json = result[1]; // result === [response, body]
			expect(json.name).to.be.defined;
			expect(json.version).to.be.defined;
			expect(json.transports).to.be.defined;
			expect(json.types).to.be.defined;
			expect(json.events).to.be.defined;
			expect(json.methods).to.be.defined;
		});
	});

	it('returns proxies for the supported languages', function() {
		var languages = ['JavaScript', 'Java', 'CSharp', 'Python', 'Php'];
		var proxyRequests = languages.map(function (language) {
			return request.getAsync(serverUrl + '?proxy=' + language);
		});

		return Promise.all(proxyRequests).then(function(results) {
			results.forEach(function(result) { // result === [response, body]
				var r = result[0];
				expect(r.statusCode).to.eq(200, 'Missing proxy for ' + r.req.path.substr(20))
			});
		});
	});
});

describe('RPC over HTTP', function() {
	before(setupServer);

	function getAsync(method) {
		return request.getAsync({
			url: serverUrl + '/' + method
		});
	}

	function postAsync(method, json) {
		return request.postAsync({
			url: serverUrl + '/' + method,
			json: json || {}
		});
	}

	it('works with legal method calls', function() {
		var expected = [
			3, 3, 3, '12', 3, 6, 12,
			{a: 12, b: 'hello'}, 10, 11, 12, 13,
			'world', 'world',
			'Abc', 'ABc', 'AbC', 'ABC',
			'Abc', 'ABc', 'ABC',
			'Abc', 'ABc', 'AbC', 'ABC', 'ABC',
			{name: 'Error', message: 'FooBar'}, {name: 'Error', message: 'FooBar'}
		];
		return Promise.all([
			postAsync('sum', {params: {b: 1, a: 2}}),
			postAsync('asyncSum?id=1', {params: [2, 1]}),
			getAsync('sum?a=2&b=1'),
			postAsync('asyncSum', {params: ['1', '2']}),
			getAsync('sum?params=["1", "2"]'),
			getAsync('mul?params=["3", "2"]'),
			postAsync('mul', {params: {a: 4, b: 3}}),
			getAsync('dataTest?params=[{"a": 12, "b": "hello"}]'),
			getAsync('sumArray?params=[[1,2,3,4]]'),
			getAsync('sumArray?ints=[1,2,3,5]'),
			postAsync('sumArray', {params: { ints: [1,2,3,6] } }),
			postAsync('sumArray', {params: [ [1,2,3,7] ] }),
			getAsync('hello'),
			postAsync('hello'),
			getAsync('optionalArgs?a=A'),
			getAsync('optionalArgs?a=A&b=B'),
			getAsync('optionalArgs?a=A&c=C'),
			getAsync('optionalArgs?a=A&b=B&c=C'),
			getAsync('optionalArgs?params=["A"]'),
			getAsync('optionalArgs?params=["A", "B"]'),
			getAsync('optionalArgs?params=["A", "B", "C"]'),
			postAsync('optionalArgs', { params: ['A']}),
			postAsync('optionalArgs', { params: ['A', 'B']}),
			postAsync('optionalArgs', { params: { a: 'A', c: 'C' } }),
			postAsync('optionalArgs', { params: ['A', 'B', 'C'] }),
			postAsync('optionalArgs', { params: { a: 'A', b: 'B', c: 'C' } }),
			getAsync('returnError'),
			postAsync('returnError')
		]).then(function(results) {
			results = results.map(function(r) { // r === [response, body]
				if (typeof r[1] === 'string') {
					r[1] = JSON.parse(r[1]);
				}
				return r[1].result;
			});
			expect(results).to.deep.eq(expected);
		});
	});

	it('returns error codes', function() {
		var expected = [
			-32601, -32601, -32601,	 // method not found
			-32602, -32602, -32602,  // invalid parameters
			-32602, -32602,
			-32000, -32000, -32000, -32602, -32602, -32000	 // internal server error
		];

		return Promise.all([
			getAsync('inexistingMethod'),
			postAsync('inexistingMethod'),
			postAsync('?'),
			getAsync('sum?params={"c":1, "a":2}'),
			getAsync('sum?a=2&c=1'),
			getAsync('sum?params=[2]'),
			getAsync('optionalArgs'),
			getAsync('optionalArgs?b=b&c=c'),
			getAsync('sumArray?ints=1234'),
			getAsync('throwError'),
			getAsync('throwUnexpectedError'),
			getAsync('hello?params=["fake"]'),
			postAsync('hello', {params:['fake']}),
			getAsync('dataTest?params=[1234]')
		]).then(function(results) {
			results = results.map(function (r) { // r === [response, body]
				if (typeof r[1] === 'string') {
					r[1] = JSON.parse(r[1]);
				}
				expect(r[1].error).to.be.defined;
				expect(r[1].error).not.to.be.null;
				if (r[1].id == 'throwUnexpectedError') {
					expect(r[1].error.data).to.match(/unexpected error/);
				}
				return r[1].error.code;
			});
			expect(results).to.deep.eq(expected);
		});
	});
});

describe('RPC over WebSocket', function() {
	before(setupServer);

	it('works with legal method calls and event subscription', function(done) {
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
			optionalArgs: 'AbC',
			returnError: {name: 'Error', message: 'FooBar'}
		};
		var results = {};

		function sendCommand(command, params) {
			var commandData = {
				id: command,
				method: command,
				params: params,
				jsonrpc: '2.0'
			};
			var request = JSON.stringify(commandData);
			return new Promise(function(resolve) {
				ws.send(request, resolve);
			});
		}

		ws.on('open', function () {
			ws.send(JSON.stringify({
				'jsonrpc': '2.0',
				'method': 'rpc.on',
				'params': ['testEvent']
			}));

			Promise.all([
				sendCommand('sum', [2, -2]),
				sendCommand('sum', {'a': 2, 'b': -2}),
				sendCommand('hello', null),
				sendCommand('asyncSum', ['1', '2']),
				sendCommand('dataTest', { a: { a: 5, b: 'test', extra: 'true' }}),
				sendCommand('sumArray', { ints: [1, 2, 3, 4]}),
				sendCommand('sumArray', [ [1, 2, 3, 4] ]),
				sendCommand('optionalArgs', { a: 'A', c: 'C' }),
				sendCommand('returnError')
			]).then(function(result) {
				expCommands = result.length;
			});
		});

		ws.on('message', function (data) {
			var parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			expect(parsedData).not.to.be.null;
			if (parsedData.error) console.log(parsedData.error);
			expect(parsedData.error).to.be.undefined;
			expect(parsedData.id).to.be.defined;
			if (parsedData.id == 'testEvent') {
				events++;
			} else {
				recCommands++;
				if (typeof parsedData.result === 'object') {
					expect(parsedData.result).to.deep.eq(expected[parsedData.id]);
				} else {
					expect(parsedData.result).to.eq(expected[parsedData.id]);
				}
				results[parsedData.id] = parsedData.result;
			}
		});

		var finalEvents = 0;
		setTimeout(function () {
			expect(expected).to.deep.eq(results);
			expect(recCommands).to.eq(expCommands);
			expect(events).to.be.above(0);
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
			expect(events).to.eq(finalEvents, 'events do not fire after unsubscribe');
			ws.close();
			done();
		}, 3000);
	});

	it('returns error codes', function(done) {
		this.timeout(660);
		var ws = new WebSocket(serverWsUrl);
		var id = 0;
		var expected = [-32600,
			-32601, -32601, -32601,
			-32602, -32602, -32602, -32602, -32602, -32602,
			-32000, -32000, -32000, -32000];
		var results = [];

		function sendCommand(command, params) {
			var commandData = {
				id: id++,
				method: command,
				params: params,
				jsonrpc: '2.0'
			};
			var request = JSON.stringify(commandData);

			return new Promise(function(resolve) {
				ws.send(request, resolve);
			});
		}

		function sendPartialCommand(commandData) {
			commandData.id = id++;
			var request = JSON.stringify(commandData);

			return new Promise(function(resolve) {
				ws.send(request, resolve);
			});
		}

		function sendCommands() {
			Bluebird.resolve([
				sendPartialCommand.bind(null, {'jsonrpc': '1.0'}),
				sendCommand.bind(null, 'inexistingMethod'),
				sendCommand.bind(null),
				sendPartialCommand.bind(null, {'jsonrpc': '2.0'}),
				sendPartialCommand.bind(null, {'jsonrpc': '2.0', 'method': 'sum'}),
				sendCommand.bind(null, 'sum'),
				sendCommand.bind(null, 'sum', [2]),
				sendCommand.bind(null, 'sum', {'a': 2, 'c': 1}),
				sendCommand.bind(null, 'optionalArgs', []),
				sendCommand.bind(null, 'hello', ['fake']),
				sendCommand.bind(null, 'throwError'),
				sendCommand.bind(null, 'dataTest', ['invalid']),
				sendCommand.bind(null, 'dataTest', [1234]),
				sendCommand.bind(null, 'sumArray', [1234])
			]).each(function(func) {
				return func();
			});
		}

		ws.on('open', function () {
			sendCommands();
		});
		ws.on('message', function (data) {
			var parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			expect(parsedData).not.to.be.null;
			expect(parsedData.error).to.be.defined;
			expect(parsedData.error).not.to.be.null;
			expect(parsedData.id).to.be.defined;
			expect(parsedData.id).not.to.be.null;
			results[parsedData.id] = parsedData.error.code;
		});

		setTimeout(function () {
			expect(expected).to.deep.eq(results);
			ws.close();
			done();
		}, 500);
	});

	it('returns parse error for malformed JSON', function(done) {
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
			expect(parsedData).not.to.be.null;
			expect(parsedData.error).not.to.be.null;
			expect(parsedData.error).to.be.defined;
			expect(parsedData.error.code).to.eq(-32700);
		});
		setTimeout(function () {
			expect(messages).to.eq(1);
			done();
		}, 120);
	});
});

describe('node.js proxy', function() {
	before(setupServer);

	var getProxy = Bluebird.promisify(jsonws.proxy, jsonws);

	it('works with legal method calls', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			var t = new proxy.Tester(serverUrl);
			var expected = [5, 6, 10, 6, 10, 25, {a: 5, b: 'test'}, 'Abc', 'ABc', 'ABC', 'world', {name: 'Error', message: 'FooBar'}];

			return Promise.all([
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
				t.hello(),
				t.returnError()
			]).then(function(results) {
				expect(results).to.deep.eq(expected, 'invalid results');
			});
		});
	});

	it('returns error codes', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			var t = new proxy.Tester(serverUrl);
			var expected = [-32000, -32602, -32602, 3, -32602, 'world'];
			var actual = [];

			return Bluebird.settle([
				t.throwError(),
				t.sum(1),
				t.sum(),
				t.sum(1, 2, 3),
				t.optionalArgs(),
				t.hello('fake', 'argument') // JavaScript proxies filter out unneeded arguments, so this won't throw
			]).then(function(results) {
				results.forEach(function(result) {
					if (result.isRejected()) {
						var reason = result.reason();
						expect(reason).to.be.instanceof(Error);
						expect(reason.data).to.be.ok;
						expect(reason.code).to.be.a('number');
						actual.push(reason.code);
					} else {
						actual.push(result.value());
					}
				});

				expect(expected).to.deep.eq(actual);
			});
		});
	});

	it('returns error codes on the WebSockets Transport', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			var t = new proxy.Tester(serverUrl);
			t.useWS();
			var expected = [-32000, -32602, -32602, 3, -32602, 'world'];
			var actual = [];

			return Bluebird.settle([
				t.throwError(),
				t.sum(1),
				t.sum(),
				t.sum(1, 2, 3),
				t.optionalArgs(),
				t.hello('fake', 'argument') // JavaScript proxies filter out unneeded arguments, so this won't throw
			]).then(function(results) {
				results.forEach(function(result) {
					if (result.isRejected()) {
						var reason = result.reason();
						expect(reason).to.be.instanceof(Error);
						expect(reason.data).to.be.ok;
						expect(reason.code).to.be.a('number');
						actual.push(reason.code);
					} else {
						actual.push(result.value());
					}
				});

				expect(expected).to.deep.eq(actual);
			});
		});
	});

	it('works with events', function(done) {
		this.timeout(5000);

		getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

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
			setTimeout(function() {
				t.on('testEvent', eventHandler2);
				t.on('test.the.namespace.event', eventHandler3);
			}, 500);

			setTimeout(function() {
				expect(h1).to.be.above(0);
				t.removeListener('testEvent', eventHandler1);
				h1 = 0;
			}, 1000);

			setTimeout(function() {
				expect(h2).to.be.above(0);
				expect(h3).to.be.above(0);
				t.removeAllListeners('testEvent');
				t.removeAllListeners('test.the.namespace.event');
				h2 = h3 = 0;
			}, 1500);

			setTimeout(function() {
				expect(h1 + h2 + h3).to.eq(0);
				expect(data).to.deep.eq({ hello: 'world'});
				done();
			}, 2000);
		}).catch(done);
	});

	it('works for async return methods', function(done) {
		this.timeout(1000);
		getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			var t = new proxy.Tester(serverUrl);
			t.testAsyncReturn(false, function() {
				t.testAsyncReturn(true, function(err) {
					expect(err).to.be.ok;
					done();
				});
			});
		}).catch(done);
	});
});
