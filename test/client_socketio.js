/**
 * JSON-WS RPC client test suite
 * Testing SocketIO client
 */
'use strict';

const fs = require('fs');
const Bluebird = require('bluebird');
const chai = require('chai');
const expect = chai.expect;
const EventEmitter = require('events');

const jsonws = require('../index.js');
const request = Bluebird.promisifyAll(require('request'), {multiArgs: true});
const io = require('socket.io-client');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const Service = jsonws.service;
const ServiceRegistry = jsonws.registry.ServiceRegistry;

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
let serviceInstance;

let serveMetadata = false;

function startServer(done) {
	const PORT = 3000;
	const rootPath = '/endpoint';
	const expressApp = express();

	httpServer = http.createServer(expressApp);
	const registry = new ServiceRegistry({ rootPath, httpServer, expressApp, serveMetadata });

	expressApp.use(bodyParser.json());
	expressApp.use(registry.getRouter());

	registry.addRoute('/ctx/:ctxId');

	httpServer.listen(PORT, function () {
		serviceInstance = buildTestService();
		const servicePathPrefix = registry.addService(serviceInstance);
		try {
			registry.addTransport(jsonws.transport.HTTP);
		} catch (err) {
			// transport has already been added
		}
		try {
			registry.addTransport(new jsonws.transport.SocketIO(registry, serviceInstance.name, servicePathPrefix));
		} catch (err) {
			// transport has already been added
		}
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

/**
 * Returns the origin(protocol://host:port) and pathname(/some/path/after/origin)
 * @param {string} url
 * @returns {{origin: string, pathname: string}}
 */
function getOriginAndPathname(url) {
	const re = /((ws|http)s?:\/+|)(\S+:\d+)(\/.*)/;
	const reUrl = re.exec(url);
	if (!reUrl) {
		throw new Error(`Count not parse url: '${url}'`);
	}
	const origin = reUrl[1] + reUrl[3];
	const pathname = reUrl[4];
	return { origin, pathname };
}

describe('RPC over SocketIO', function() {
	before(done => {
		serveMetadata = true;
		setupServer(done);
	});

	const url = 'ws://localhost:3000/endpoint/test/1.0';
	let socket;

	beforeEach(done => {
		const origin = getOriginAndPathname(url).origin;
		const socketToRootPath = io.connect(origin);
		socketToRootPath.on('connect', function(/*socketRoot*/) {
			const connectionContextPayload = {
				validationParams: null,
				serviceName: 'test',
				serviceVersion: '1.0'
			};
			socketToRootPath.emit('rpc.sio.setConnectionContext', connectionContextPayload, function(/*ack*/) {
				socket = socketToRootPath;
				done();
			});
		});
	});

	it('works with legal method calls and event subscription', function(done) {
		const timeouts = [ 1200, 2000, 3000 ];
		const timeout = Math.max(...timeouts) + 1000;
		this.timeout(timeout);

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
			return new Promise(resolve => {
				socket.send(request, () => {});
				resolve();
			});
		}

		socket.send(JSON.stringify({
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

		socket.on('message', function (data) {
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
			socket.send(JSON.stringify({
				'jsonrpc': '2.0',
				'method': 'rpc.off',
				'params': ['testEvent']
			}));
			finalEvents = events;
		}, timeouts[0]);

		setTimeout(function() {
			finalEvents = events;
		}, timeouts[1]);

		setTimeout(function () {
			expect(events).to.eq(finalEvents, 'events do not fire after unsubscribe');
			socket.close();
			done();
		}, timeouts[2]);
	});

	it('returns error codes', function(done) {
		const timeouts = [ 500 ];
		const timeout = Math.max(...timeouts) + 200;
		this.timeout(timeout);
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
			return new Promise(resolve => {
				socket.send(request, () => {});
				resolve();
			});
		}

		function sendPartialCommand(commandData) {
			commandData.id = id++;
			const request = JSON.stringify(commandData);
			return new Promise(resolve => {
				socket.send(request, () => {});
				resolve();
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

		sendCommands();

		socket.on('message', function (data) {
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
			socket.close();
			done();
		}, timeouts[0]);
	});

	it('returns parse error for malformed JSON', function(done) {
		const timeouts = [ 120 ];
		const timeout = Math.max(...timeouts) + 200;
		this.timeout(timeout);
		let messages = 0;

		socket.send('Parse Error must be returned.');
		socket.on('message', function (data) {
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
		}, timeouts[0]);
	});
});

describe('node.js proxy', function() {
	let opts, transport;
	before(done => {
		serveMetadata = true;
		setupServer(done);
	});

	const getProxy = Bluebird.promisify(jsonws.proxy, jsonws);
	const SocketIoTransport = jsonws.client.transports.SocketIO;

	beforeEach(() => {
		opts = {
			serviceName: serviceInstance.name,
			serviceVersion: '1.0'
		};
		transport = new SocketIoTransport(serverUrl, Object.assign({}, opts));
	});

	it('works with legal method calls', function () {
		return getProxy(httpProxyUrl).then(function (proxy) {
			expect(proxy).to.be.ok;
			const t = new proxy.Tester(transport);
			const expected = [5, 6, 10, 6, 10, 25, {a: 5, b: 'test'}, 'Abc', 'ABc', 'ABC', 'world', {
				name: 'Error',
				message: 'FooBar'
			}];

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
			]).then(function (results) {
				expect(results).to.deep.eq(expected, 'invalid results');
			});
		});
	});

	it('returns error codes', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;
			const t = new proxy.Tester(transport);
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

	it('returns error codes on the Socket.IO Transport', function() {
		return getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;
			const t = new proxy.Tester(transport);
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
		const timeouts = [ 500, 1000, 1500, 2000 ];
		const timeout = Math.max(...timeouts) + 1000;
		this.timeout(timeout);
		getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;
			const t = new proxy.Tester(transport);
			let [ h1, h2, h3 ] = [0, 0, 0];
			let data = null;
			function eventHandler1() { h1++; }
			function eventHandler2() { h2++; }
			function eventHandler3() { h3++; }

			t.on('testEvent', eventHandler1);
			t.on('testDataEvent', function(e) { data = e; });
			setTimeout(function() {
				t.on('testEvent', eventHandler2);
				t.on('test.the.namespace.event', eventHandler3);
			}, timeouts[0]);

			setTimeout(function() {
				expect(h1).to.be.above(0);
				t.removeListener('testEvent', eventHandler1);
				h1 = 0;
				done();
			}, timeouts[1]);

			setTimeout(function() {
				expect(h2).to.be.above(0);
				expect(h3).to.be.above(0);
				t.removeAllListeners('testEvent');
				t.removeAllListeners('test.the.namespace.event');
				h2 = h3 = 0;
			}, timeouts[2]);

			setTimeout(function() {
				expect(h1 + h2 + h3).to.eq(0);
				expect(data).to.deep.eq({ hello: 'world'});
				done();
			}, timeouts[3]);
		}).catch(done);
	});

	it('works for async return methods', function(done) {
		this.timeout(1000);
		getProxy(httpProxyUrl).then(function(proxy) {
			expect(proxy).to.be.ok;
			const t = new proxy.Tester(transport);
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

			const transport1 = new SocketIoTransport(serverUrl, Object.assign({}, opts));
			const transport2 = new SocketIoTransport(serverUrl, Object.assign({}, opts));

			const proxy1 = new proxies[0].Tester(transport1);
			const proxy2 = new proxies[1].Tester(transport2);

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
			expect(proxies[3]).to.be.ok;

			const transport1 = new SocketIoTransport(serverUrl, Object.assign({}, opts));
			const transport2 = new SocketIoTransport(serverUrl, Object.assign({ validationParams: { ctxId: 'id1234'} }, opts));
			const transport3 = new SocketIoTransport(serverUrl, Object.assign({ validationParams: { ctxId: 'id5678'} }, opts));
			const transport4 = new SocketIoTransport(serverUrl, Object.assign({ validationParams: { ctxId: 'id4321'} }, opts));

			const proxy1 = new proxies[0].Tester(transport1);
			const proxy2 = new proxies[1].Tester(transport2);
			const proxy3 = new proxies[2].Tester(transport3);
			const proxy4 = new proxies[3].Tester(transport4);

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
