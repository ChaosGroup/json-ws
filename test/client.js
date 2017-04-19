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

const fs = require('fs');
const Promise = require('bluebird');
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const EventEmitter = require('events');

const jsonws = require('../index.js');
const request = Promise.promisifyAll(require('request'), {multiArgs: true});
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const Service = jsonws.service;
const ServiceRegistry = jsonws.registry.ServiceRegistry;
const SocketIOTransport = require('../lib/transport/socket-io-transport');
const WebSocketClientTransport = require('../lib/client/transports/ws');
const SocketIOClientTransport = require('../lib/client/transports/socket-io');

const AssertionError = chai.AssertionError;

function buildTestService() {
	const service = new Service('1.0.0', 'test');

	class TestAPI extends EventEmitter {
		sum(a, b) {
			return a + b;
		}

		getStream() {
			return fs.createReadStream(__filename);
		}

		asyncSum(a, b, callback) {
			callback(null, a + b);
		}

		throwError() {
			throw new Error('Throw error test');
		}

		throwUnexpectedError() {
			throw new Error('Throw unexpected error test');
		}

		returnError() {
			return new Error('FooBar');
		}
	}

	service.type('TestData', {
		a: 'int',
		b: 'string'
	});
	service.define({
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
	service.define({
		name: 'getStream',
		returns: 'stream'
	});
	service.define({
		name: 'throwError',
		returns: 'async'
	});
	service.define({
		name: 'throwUnexpectedError',
		returns: ['object']
	});
	service.define({
		name: 'testAsyncReturn',
		params: [ {name: 'throwError', type: 'bool'} ],
		returns: 'async'
	}, function(throwError, callback) {
		setImmediate(function() {
			callback(throwError ? new Error('Callback error') : null);
		});
	});
	service.define({
		name: 'sum',
		params: [
			{name: 'a', type: 'int'},
			{name: 'b', type: 'int'}
		],
		returns: 'int'
	});
	service.define({
		name: 'hello',
		returns: 'string'
	}, function() {
		return 'world';
	});
	service.define({
		name: 'asyncSum',
		params: [
			{name: 'a', type: '*'},
			{name: 'b', type: '*'}
		],
		returns: '*'
	});
	service.define({
		name: 'mul',
		params: [
			{name: 'a', type: 'int'},
			{name: 'b', type: 'int'}
		],
		returns: 'int'
	}, function(a, b) { return a * b; });
	service.define({
		name: 'sumArray',
		params: [
			{name: 'ints', type: ['int']}
		],
		returns: 'int'
	}, function(ints) { let sum = 0; ints.forEach(function(i){sum += i;}); return sum; });
	service.define({
		name: 'test.some.namespace.mul',
		params: [
			{name: 'a', type: 'int'},
			{name: 'b', type: 'int'}
		],
		returns: 'int'
	}, function(a, b) { return a * b; });
	service.define({
		name: 'dataTest',
		params: [{name: 'a', type: 'TestData'}],
		returns: 'TestData'
	}, function (a) { return a;	});
	service.define({
		name: 'returnError',
		returns: 'error'
	});
	service.event('testEvent');
	service.event('testDataEvent');
	service.event('test.the.namespace.event');
	service.event('testContextEvent');

	const testAPI = new TestAPI();
	service.defineAll(testAPI);

	setInterval(function () {
		testAPI.emit('testEvent');
		testAPI.emit('test.the.namespace.event');
	}, 100);
	setInterval(function () {
		testAPI.emit('testDataEvent', { hello: 'world' });
	}, 100);
	setInterval(function() {
		testAPI.emit('testContextEvent', {hello: 'hello1234'}, {ctxId: 'id1234'});
		testAPI.emit('testContextEvent', {hello: 'hello5678'}, {ctxId: 'id5678'});
	}, 100);

	return service;
}

let httpServer;
let serverUrl;
let serverWsUrl;
let httpProxyUrl;
let getContextUrl;

function startServer(done, options = {}) {
	const PORT = 3000;
	const rootPath = '/endpoint';
	const expressApp = express();

	const serveMetadata = (typeof options.serveMetadata === 'undefined') ? true : options.serveMetadata;

	httpServer = http.createServer(expressApp);
	const registry = new ServiceRegistry({
		rootPath,
		httpServer,
		expressApp,
		serveMetadata
	});

	expressApp.use(bodyParser.json());
	expressApp.use(registry.getRouter());

	registry.addRoute('/ctx/:ctxId');

	httpServer.listen(PORT, function () {
		try {
			registry.addTransport(jsonws.transport.HTTP);
		} catch (err) {
			// transport has already been added
		}
		if (options['socket-io']) {
			try {
				registry.addTransport(SocketIOTransport);
			} catch (err) {
				// transport has already been added
			}
		} else {
			try {
				registry.addTransport(jsonws.transport.WebSocket);
			} catch (err) {
				// transport has already been added
			}
		}
		const servicePathPrefix = registry.addService(buildTestService());
		const registryRootUrl = `http://localhost:${httpServer.address().port}${registry.rootPath}`;
		serverUrl = `${registryRootUrl}${servicePathPrefix}`;

		getContextUrl = function(ctxId) {
			return `${registryRootUrl}/ctx/${ctxId}${servicePathPrefix}`;
		};

		serverWsUrl = serverUrl.replace('http', 'ws');
		httpProxyUrl = `${serverUrl}?proxy=JavaScript&localName=Tester`;
		done();
	});

	httpServer.on('error', function (err) {
		console.log('???', err); //eslint-disable-line no-console
		process.exit();
	});
}

function setupServer(done, options) {
	httpServer ? done() : startServer(done, options);
}

function destroyServer(done) {
	if (httpServer) {
		httpServer.close(done);
		httpServer = null;
	} else {
		done();
	}
}

describe('Metadata Off', function() {
	before(function(done) {
		setupServer(done, {
			serveMetadata: false
		});
	});
	after(destroyServer);

	it('/ returns 404 with the registry flag serveMetadata=false', function() {
		return request.getAsync(serverUrl, {json: true}).then(function(result) {
			expect(result[0].statusCode).to.eq(404);
			expect(result[1]).to.match(/Cannot GET/);
		});
	});

	it('?json returns 404 with the registry flag serveMetadata=false', function() {
		return request.getAsync(serverUrl + '?json', {json: true}).then(function(result) {
			expect(result[0].statusCode).to.eq(404);
			expect(result[1]).to.match(/Cannot GET/);
		});
	});

	it('?viewer returns 404 with the registry flag serveMetadata=false', function() {
		return request.getAsync(serverUrl + '?viewer', {json: true}).then(function(result) {
			expect(result[0].statusCode).to.eq(404);
			expect(result[1]).to.match(/Cannot GET/);
		});
	});

	it('?proxy returns 404 with the registry flag serveMetadata=false', function() {
		return request.getAsync(serverUrl + '?proxy', {json: true}).then(function(result) {
			expect(result[0].statusCode).to.eq(404);
			expect(result[1]).to.match(/Cannot GET/);
		});
	});
});

describe('Metadata On', function() {
	before(setupServer);
	after(destroyServer);

	it('returns metadata in JSON format', function() {
		return request.getAsync(serverUrl + '?json', { json: true }).then(function(result) {
			const json = result[1]; // result === [response, body]
			expect(json.name).to.be.defined;
			expect(json.version).to.be.defined;
			expect(json.transports).to.be.defined;
			expect(json.types).to.be.defined;
			expect(json.events).to.be.defined;
			expect(json.methods).to.be.defined;
		});
	});

	it('returns proxies for the supported languages', function() {
		const languages = ['JavaScript', 'Java', 'CSharp', 'Python', 'Php'];
		const proxyRequests = languages.map(function (language) {
			return request.getAsync(serverUrl + '?proxy=' + language);
		});

		return Promise.all(proxyRequests).then(function(results) {
			results.forEach(function(result) { // result === [response, body]
				const r = result[0];
				expect(r.statusCode).to.eq(200, 'Missing proxy for ' + r.req.path.substr(20));
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
		const expected = [
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
		const expected = [
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
	after(destroyServer);

	it('works with legal method calls and event subscription', function(done) {
		this.timeout(4000);

		const ws = new WebSocket(serverWsUrl);
		let events = 0;
		let recCommands = 0;
		let expCommands;
		const expected = {
			'sum': 0,
			asyncSum: '12',
			hello: 'world',
			dataTest: {a: 5, b: 'test'},
			sumArray: 10,
			optionalArgs: 'AbC',
			returnError: {name: 'Error', message: 'FooBar'}
		};
		const results = {};

		function sendCommand(command, params) {
			const commandData = {
				id: command,
				method: command,
				params: params,
				jsonrpc: '2.0'
			};
			const request = JSON.stringify(commandData);
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
			const parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			expect(parsedData).not.to.be.null;
			if (parsedData.error) console.log(parsedData.error); //eslint-disable-line no-console
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

		let finalEvents = 0;
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
		const ws = new WebSocket(serverWsUrl);
		let id = 0;
		const expected = [-32600,
			-32601, -32601, -32601,
			-32602, -32602, -32602, -32602, -32602, -32602,
			-32000, -32000, -32000, -32000];
		const results = [];

		function sendCommand(command, params) {
			const commandData = {
				id: id++,
				method: command,
				params: params,
				jsonrpc: '2.0'
			};
			const request = JSON.stringify(commandData);

			return new Promise(function(resolve) {
				ws.send(request, resolve);
			});
		}

		function sendPartialCommand(commandData) {
			commandData.id = id++;
			const request = JSON.stringify(commandData);

			return new Promise(function(resolve) {
				ws.send(request, resolve);
			});
		}

		function sendCommands() {
			Promise.resolve([
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
			const parsedData = JSON.parse(data);
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
		const ws = new WebSocket(serverWsUrl);
		let messages = 0;
		ws.on('open', function () {
			ws.send('Parse Error must be returned.');
		});
		ws.on('message', function (data) {
			const parsedData = JSON.parse(data);
			if (Object.keys(parsedData).length == 0) return;
			messages++;
			expect(parsedData).not.to.be.null;
			expect(parsedData.error).not.to.be.null;
			expect(parsedData.error).to.be.defined;
			expect(parsedData.error.code).to.eq(-32700);
		});
		setTimeout(function () {
			expect(messages).to.eq(1);
			ws.close();
			done();
		}, 120);
	});
});

const TRANSPORT_CONSTRUCTION = {
	'HTTP': {
		plain: () => serverUrl,
		context: ctxId => getContextUrl(ctxId)
	},
	'WebSocket': {
		plain: () => new WebSocketClientTransport(serverUrl),
		context: ctxId => new WebSocketClientTransport(getContextUrl(ctxId))
	},
	'Socket.IO': {
		plain: () => new SocketIOClientTransport(serverUrl),
		context: ctxId => new SocketIOClientTransport(serverUrl, {validationParams: {ctxId}})
	}
};

['HTTP', 'WebSocket', 'Socket.IO'].forEach(transportName => describe(`node.js proxy - ${transportName} transport`, function() {
	// Note that the HTTP transport tests will still use WebSockets transport for events

	const transport = TRANSPORT_CONSTRUCTION[transportName];
	let Tester;

	before(function(done) {
		setupServer(function() {
			jsonws.proxy(httpProxyUrl, function(err, proxy) {
				if (err) {
					return done(err);
				}

				Tester = proxy.Tester;
				done();
			});
		}, {
			'socket-io': transportName === 'Socket.IO'
		});
	});

	after(destroyServer);

	/**
	 * getProxy() used together with Promise.using() ensures that the proxy is closed after the test is used.
	 *
	 * @param urlOrTransport
	 */
	function getProxy(urlOrTransport) {
		return Promise.resolve(new Tester(urlOrTransport)).disposer(function(proxy) {
			proxy.close();
		});
	}

	/**
	 * expectProxyEvent resolves if "proxy" receives "event" before "timeouts" milliseconds
	 * and rejects otherwise. The promise is resolved with the eventData.
	 */
	function expectProxyEvent(proxy, event, errorMessage, timeout = 1000) {
		return (
			new Promise(resolve => proxy.on(event, _.once(resolve)))
		).timeout(
			timeout,
			new AssertionError(errorMessage ? errorMessage : `No event "${event}" received for ${timeout} milliseconds`)
		);
	}

	/**
	 * expectNoProxyEvent rejects if "proxy" receives "event" after "delay" milliseconds.
	 */
	function expectNoProxyEvent(proxy, event, errorMessage, delay = 1000) {
		return Promise.race([
			Promise.delay(delay), // This waits for an event to occur
			new Promise((resolve, reject) => {
				proxy.on(event, () => {
					_.once(reject(
						new AssertionError(errorMessage ? errorMessage : `Unexpected event "${event}" received`)
					));
				});
			})
		]);
	}

	it('works with legal method calls', function() {
		return Promise.using(getProxy(transport.plain()), function(t) {
			const expected = [5, 6, 10, 6, 10, 25, {a: 5, b: 'test'}, 'Abc', 'ABc', 'ABC', 'world', {name: 'Error', message: 'FooBar'}];

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
		return Promise.using(getProxy(transport.plain()), function(t) {
			const expected = [-32000, -32602, -32602, 3, -32602, 'world'];
			const actual = [];

			return Promise.settle([
				t.throwError(),
				t.sum(1),
				t.sum(),
				t.sum(1, 2, 3),
				t.optionalArgs(),
				t.hello('fake', 'argument') // JavaScript proxies filter out unneeded arguments, so this won't throw
			]).then(function(results) {
				results.forEach(function(result) {
					if (result.isRejected()) {
						const reason = result.reason();
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

	it('works for async return methods', function() {
		return Promise.using(getProxy(transport.plain()), function(t) {
			return new Promise(function(resolve, reject) {
				t.testAsyncReturn(false, function(err) {
					if (err) {
						return reject(err);
					}

					t.testAsyncReturn(true, function(err) {
						expect(err).to.exist;
						resolve();
					});
				});
			});
		});
	});

	it('works with events', function() {
		this.timeout(5000);

		return Promise.using(getProxy(transport.plain()), function(t) {
			let h1 = 0;
			let h2 = 0;
			let h3 = 0;
			let data = null;

			function eventHandler1() {
				h1++;
			}

			function eventHandler2() {
				h2++;
			}

			function eventHandler3() {
				h3++;
			}

			t.on('testEvent', eventHandler1);
			t.on('testDataEvent', function (e) {
				data = e;
			});
			setTimeout(function () {
				t.on('testEvent', eventHandler2);
				t.on('test.the.namespace.event', eventHandler3);
			}, 500);

			setTimeout(function () {
				expect(h1).to.be.above(0);
				t.removeListener('testEvent', eventHandler1);
				h1 = 0;
			}, 1000);

			setTimeout(function () {
				expect(h2).to.be.above(0);
				expect(h3).to.be.above(0);
				t.removeAllListeners('testEvent');
				t.removeAllListeners('test.the.namespace.event');
				h2 = h3 = 0;
			}, 1500);

			return new Promise(function(resolve) {
				setTimeout(function () {
					expect(h1 + h2 + h3).to.eq(0);
					expect(data).to.deep.eq({hello: 'world'});
					resolve();
				}, 2000);
			});
		});
	});

	it('works with events for multiple clients', function() {
		return Promise.using(getProxy(transport.plain()), getProxy(transport.plain()), (proxy1, proxy2) => {
			return Promise.all([
				expectProxyEvent(proxy1, 'testEvent'),
				expectProxyEvent(proxy2, 'testEvent')
			]);
		});
	});

	it('works with contextualized events', function() {
		return Promise.using(
			getProxy(transport.plain()),
			getProxy(transport.context('id1234')),
			getProxy(transport.context('id5678')),
			getProxy(transport.context('id4321')),
			(proxy1, proxy2, proxy3, proxy4) => {
				return Promise.all([
					expectProxyEvent(proxy2, 'testContextEvent'),
					expectProxyEvent(proxy3, 'testContextEvent'),
					expectNoProxyEvent(proxy1, 'testContextEvent', '"testContextEvent" received without context'),
					expectNoProxyEvent(proxy4, 'testContextEvent', '"testContextEvent" received for wrong context')
				]).spread((proxy2EventData, proxy3EventData) => {
					expect(proxy2EventData).to.deep.eq({hello: 'hello1234'});
					expect(proxy3EventData).to.deep.eq({hello: 'hello5678'});
				});
			}
		);
	});
}));
