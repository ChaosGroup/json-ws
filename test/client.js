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
const Bluebird = require('bluebird');
const chai = require('chai');
const expect = chai.expect;
const EventEmitter = require('events');

const jsonws = require('../index.js');
const request = Bluebird.promisifyAll(require('request'), {multiArgs: true});
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const Service = jsonws.service;

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

function startServer(done) {
	const PORT = 3000;
	const rootPath = '/endpoint';
	const expressApp = express();

	httpServer = http.createServer(expressApp);
	const registry = jsonws.registry({ rootPath, httpServer, expressApp });

	expressApp.use(bodyParser.json());
	expressApp.use(registry.getRouter());

	registry.addRoute('/ctx/:ctxId');

	httpServer.listen(PORT, function () {
		registry.addTransport(jsonws.transport.HTTP);
		registry.addTransport(jsonws.transport.WebSocket);
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
		console.log(err); //eslint-disable-line no-console
		process.exit();
	});
}

function setupServer(done) {
	httpServer ? done() : startServer(done);
}

describe('Metadata', function() {
	before(setupServer);

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
			done();
		}, 120);
	});
});

describe('node.js proxy', function() {
	before(setupServer);

	const getProxy = Bluebird.promisify(jsonws.proxy, jsonws);

	it('works with legal method calls', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			const t = new proxy.Tester(serverUrl);
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
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			const t = new proxy.Tester(serverUrl);
			const expected = [-32000, -32602, -32602, 3, -32602, 'world'];
			const actual = [];

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

	it('returns error codes on the WebSockets Transport', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			const t = new proxy.Tester(serverUrl);
			t.useWS();
			const expected = [-32000, -32602, -32602, 3, -32000, -32602, 'world'];
			const actual = [];

			return Bluebird.settle([
				t.throwError(),
				t.sum(1),
				t.sum(),
				t.sum(1, 2, 3),
				t.getStream(),
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

	it('works with events', function(done) {
		this.timeout(5000);

		getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;

			const t = new proxy.Tester(serverUrl);
			let h1 = 0;
			let h2 = 0;
			let h3 = 0;
			let data = null;
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

			const t = new proxy.Tester(serverUrl);
			t.testAsyncReturn(false, function() {
				t.testAsyncReturn(true, function(err) {
					expect(err).to.be.ok;
					done();
				});
			});
		}).catch(done);
	});

	it('works with events for multiple clients', function(done) {
		Promise.all([
			getProxy(httpProxyUrl),
			getProxy(httpProxyUrl)
		]).then(function(proxies) {
			expect(proxies[0]).to.be.ok;
			expect(proxies[1]).to.be.ok;

			const proxy1 = new proxies[0].Tester(serverUrl);
			const proxy2 = new proxies[1].Tester(serverUrl);

			let handler1Called = false;
			let handler2Called = false;
			let callCount = 0;
			function eventHandler1() {
				if (handler1Called) {
					return;
				}

				handler1Called = true;
				callCount++;
				if (callCount == 2) {
					done();
				}
			}

			function eventHandler2() {
				if (handler2Called) {
					return;
				}

				handler2Called = true;
				callCount++;
				if (callCount == 2) {
					done();
				}
			}

			proxy1.on('testEvent', eventHandler1);
			proxy2.on('testEvent', eventHandler2);
		}).catch(done);
	});

	it('works with contextualized events', function(done) {
		Promise.all([
			getProxy(httpProxyUrl),
			getProxy(httpProxyUrl),
			getProxy(httpProxyUrl),
			getProxy(httpProxyUrl)
		]).then(function(proxies) {
			expect(proxies[0]).to.be.ok;
			expect(proxies[1]).to.be.ok;
			expect(proxies[2]).to.be.ok;

			const proxy1 = new proxies[0].Tester(serverUrl);
			const proxy2 = new proxies[1].Tester(getContextUrl('id1234'));
			const proxy3 = new proxies[2].Tester(getContextUrl('id5678'));
			const proxy4 = new proxies[2].Tester(getContextUrl('id4321'));

			let handler2Called = false;
			let handler3Called = false;
			let callCount = 0;

			// Give time to ensure the event handler is not called:
			setTimeout(function() {
				callCount++;

				if (callCount == 3) {
					done();
				}
			}, 500);

			function eventHandler2(data) {
				expect(data.hello).to.eq('hello1234');
				if (!handler2Called) {
					handler2Called = true;
					callCount++;
					if (callCount == 3) {
						done();
					}
				}
			}

			function eventHandler3(data) {
				expect(data.hello).to.eq('hello5678');

				if (!handler3Called) {
					handler3Called = true;
					callCount++;
					if (callCount == 3) {
						done();
					}
				}
			}

			proxy1.on('testContextEvent', function() { done(new Error('testContextEvent received without context')); });
			proxy2.on('testContextEvent', eventHandler2);
			proxy3.on('testContextEvent', eventHandler3);
			proxy4.on('testContextEvent', function() { done(new Error('testContextEvent received for wrong context')); });
		}).catch(done);
	});
});
