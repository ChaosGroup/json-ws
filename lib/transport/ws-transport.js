/**
 * Implementation of a WebSocket transport for the JSON-WS module
 */

'use strict';

const WebSocket = require('ws');
const jsonrpc = require('./json-rpc');
const BaseTransport = require('./base-transport');
const pathToRegExp = require('path-to-regexp');

const WebSocketServer = WebSocket.Server;

function abortConnection(socket, code, name) {
	// From here: https://github.com/websockets/ws/blob/9dc7e6b4651711d47bd87bbeddb6446e5aa429e1/lib/WebSocketServer.js#L503
	try {
		socket.write(`HTTP/1.1 ${code} ${name}\r\nContent-type: text/html\r\n\r\n`);
	} catch (e) { // ignore errors - we've aborted this connection
	} finally {
		// ensure that an early aborted connection is shut down completely
		try {
			socket.destroy();
		} catch (e) {} //eslint-disable-line no-empty
	}
}

class WebSocketTransport extends BaseTransport {
	static get type() {
		return 'WebSocket';
	}

	constructor(registry) {
		super(registry);
		this.registry = registry;
		this.httpServer = registry.httpServer;
		this.wsServer = null;
		this.connectionContexts = new WeakMap();
		this.nextConnectionId = 0;
		this._setupHandlers();
	}

	sendMessage(msg, context/*, format*/) {
		if (!(context && context.ws && context.ws.readyState == WebSocket.OPEN)) {
			return;
		}

		if (msg.id !== undefined) {
			try {
				if (msg.result && Buffer.isBuffer(msg.result)) {
					msg.result = msg.result.toString('base64');
				}
				context.ws.send(JSON.stringify(msg));
			} catch (e) {
				console.log(msg); //eslint-disable-line no-console
				console.log(e); //eslint-disable-line no-console
			}
		}
	}

	_getServiceAndParams(url) {
		for (const route of this.registry.routes) {
			const routeParser = pathToRegExp(`${route}/:_service/:_version`);
			const execResult = routeParser.exec(url);

			if (!execResult) {
				continue;
			}

			const result = routeParser.keys.reduce(function(current, paramKey, paramIndex) {
				current[paramKey.name] = execResult[paramIndex + 1];

				return current;
			}, {});

			const service = this.registry.getService(`/${result._service}/${result._version}`);
			if (service) {
				delete result._service;
				delete result._version;
				return {
					params: result,
					service
				};
			}
		}

		return null;
	}

	_setupHandlers() {
		this.httpServer.on('upgrade', (req, socket) => {
			const serviceAndParams = this._getServiceAndParams(req.url);

			if (!serviceAndParams) {
				abortConnection(socket, 400, 'Bad Request');
				return;
			}

			this.connectionContexts.set(req, {
				data: null,
				urlParams: serviceAndParams.params,
				service: serviceAndParams.service
			});
		});

		this.wsServer = new WebSocketServer({
			server: this.httpServer,
			perMessageDeflate: false, // turn off message compression by default
			verifyClient: (info, callback) => {
				const connectionContext = this.connectionContexts.get(info.req);
				if (!connectionContext) {
					callback(false, 400, 'Bad Request');
					return;
				}

				const continueImmediately = this.validateMessage(connectionContext.service, null, connectionContext.urlParams, (err, data) => {
					if (err) {
						callback(false, 400, 'Bad Request');
					} else {
						connectionContext.data = data;
						callback(true);
					}
				});

				if (continueImmediately) {
					callback(true);
				}
			}
		});
		this.wsServer.on('connection', (ws) => {
			this.attachEvents(ws);
		});
	}

	attachEvents(ws) {
		const connectionContext = this.connectionContexts.get(ws.upgradeReq);

		const connectionCtx = Object.create({}, {
			ws: {
				get: () => ws
			},
			objectId: {value: `!#ConnectionCtx:${this.nextConnectionId++}`},
			toString: {
				value: () => this.objectId
			}
		});
		connectionCtx.data = connectionContext.data;
		connectionCtx.params = connectionContext.urlParams;

		this.onConnect(connectionCtx);

		ws.on('message', (message) => {
			try {
				message = typeof message === 'string' ? JSON.parse(message) : message;
			} catch (ex) { // Parse error
				this.trace.error(connectionCtx, null, ex);
				this.sendMessage(
					jsonrpc.response(
						null,
						jsonrpc.error(-32700, 'Parse error', ex.toString())
					),
					connectionCtx);
				return;
			}
			const continueImmediately = this.validateMessage(connectionContext.service, message.method, connectionContext.urlParams, (err, data) => {
				if (err) {
					ws.send(jsonrpc.response(
						message.id,
						jsonrpc.error(-32000, 'Bad Request', err.message)));
				} else {
					connectionCtx.data = data; // Update with the latest data from the validator.
					this.handleMessage(connectionContext.service, message, connectionCtx);
				}
			});

			if (continueImmediately) {
				this.handleMessage(connectionContext.service, message, connectionCtx);
			}
		});

		ws.on('close', () => {
			this.onDisconnect(connectionCtx);
		});

		ws.send('{}');
	}
}

module.exports = WebSocketTransport;
