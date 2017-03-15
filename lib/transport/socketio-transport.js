/**
 * Implementation of a WebSocket transport for the JSON-WS module
 */

'use strict';

const socketIO = require('socket.io');
const jsonrpc = require('./json-rpc');
const BaseTransport = require('./base-transport');
const url = require('url');

class SocketIOTransport extends BaseTransport {
	static get type() {
		return 'SocketIO';
	}

	constructor(registry) {
		super(registry);
		this.socketIOServer = socketIO(registry.httpServer);
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

				if (msg.result && msg.result instanceof stream.Readable) {
					context.ws.send(JSON.stringify(
						jsonrpc.response(
							msg.id,
							jsonrpc.error(-32000, 'WebSocket', 'Streaming over WebSockets is not supported'))));
					msg.result.destroy();
				}

				context.ws.send(JSON.stringify(msg));
			} catch (e) {
				console.log(msg); //eslint-disable-line no-console
				console.log(e); //eslint-disable-line no-console
			}
		}
	}

	attachEvents(socket) {
		const serviceAndParams = this._getServiceAndParams(socket.request.url);

		if (!serviceAndParams) {
			abortConnection(socket);
			return;
		}

		const connectionContext = {
			data: null,
			urlParams: serviceAndParams.params,
			service: serviceAndParams.service
		};

		if (!this._verifyClient(connectionContext)) {
			abortConnection(socket);
			return;
		}

		const connectionCtx = Object.create({}, {
			ws: {
				get: () => socket
			},
			objectId: {value: `!#ConnectionCtx:${this.nextConnectionId++}`},
			toString: {
				value: () => this.objectId
			}
		});
		connectionCtx.data = connectionContext.data;
		connectionCtx.params = connectionContext.urlParams;

		this.onConnect(connectionCtx);

		socket.on('message', message => {
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
			const continueImmediately = this.validateMessage(
					connectionContext.service, message.method, connectionContext.urlParams, (err, data) => {
				if (err) {
					socket.send(jsonrpc.response(
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

		socket.on('disconnect', () => {
			this.onDisconnect(connectionCtx);
		});

		socket.send('{}');
	}

	_verifyClient(connectionContext) {
		const continueImmediately = this.validateMessage(
				connectionContext.service, null, connectionContext.urlParams, (err, data) => {
			if (err) {
				return false;
			} else {
				connectionContext.data = data;
				return true;
			}
		});

		if (continueImmediately) {
			return true;
		}
	}

	_setupHandlers() {
		this.socketIOServer.on('connection', socket => {
			this.attachEvents(socket);
		});
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
}

function abortConnection(socket) {
	try {
		socket.disconnect(true);
	} catch (e) { // ignore errors - we've aborted this connection
	}
}

module.exports = SocketIOTransport;
