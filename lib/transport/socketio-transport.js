/**
 * Implementation of a SocketIO transport for the JSON-WS module
 */

'use strict';

const socketIO = require('socket.io');
const jsonrpc = require('./json-rpc');
const WebSocketBaseTransport = require('./web-socket-base-transport');
const url = require('url');
const stream = require('stream');

class SocketIOTransport extends WebSocketBaseTransport {
	static get type() {
		return 'SocketIO';
	}

	constructor(registry) {
		super(registry);
		this.nextConnectionId = 0;
		this.ensuredNamespaces = new Set();

		const socketIOServer = socketIO(registry.httpServer);
		this.ensuredNamespaces.add('/');
		socketIOServer.on('connection', sock => {
			sock.on('ensure_socketio_namespace', (newNamespaceName, cb) => {
				if (this.ensuredNamespaces.has(newNamespaceName)) {
					cb('namespace already registered');
					return;
				} else if (typeof newNamespaceName !== 'string' || !newNamespaceName) {
					throw new Error(`SocketIONamespace ${newNamespaceName} can't be registered.`);
				}
				this.ensuredNamespaces.add(newNamespaceName);
				// socket.io should be using the same webSocket connection behind the scenes
				// this is just a specific handler only for this particular namespace
				const newSocketServer = socketIOServer.of(newNamespaceName);
				this._setupHandlers(newSocketServer);
				cb('namespace registered successfully');
			});
		});
	}

	sendMessage(msg, context/*, format*/) {
		if (!(context && context.socket && context.socket.connected)) {
			return;
		}

		if (msg.id !== undefined) {
			try {
				if (msg.result && Buffer.isBuffer(msg.result)) {
					msg.result = msg.result.toString('base64');
				}

				if (msg.result && msg.result instanceof stream.Readable) {
					context.socket.send(JSON.stringify(
						jsonrpc.response(
							msg.id,
							jsonrpc.error(-32000, 'SocketIO', 'Streaming over SocketIO is not supported'))));
					msg.result.destroy();
				}

				context.socket.send(JSON.stringify(msg));
			} catch (e) {
				console.log(msg); //eslint-disable-line no-console
				console.log(e); //eslint-disable-line no-console
			}
		}
	}

	/**
	 * @param {SocketIO.Socket} socket
	 * @private
	 */
	attachEvents(socket) {
		const serviceAndParams = this._getServiceAndParams(socket.nsp.name);

		if (!(serviceAndParams && serviceAndParams.service)) {
			abortConnection(socket);
			return;
		}

		const connectionContext = {
			data: null,
			urlParams: serviceAndParams.params,
			service: serviceAndParams.service
		};

		this
			._verifyClient(connectionContext)
			.catch(() => {
				abortConnection(socket);
			})
			.then(() => {
				const connectionCtx = Object.create({}, {
					socket: {
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

				socket.on('message', (message, cb) => {
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
			});
	}

	_verifyClient(connectionContext) {
		return new Promise((resolve, reject) => {
			const continueImmediately = this.validateMessage(
				connectionContext.service, null, connectionContext.urlParams, (err, data) => {
					if (err) {
						reject(err);
					} else {
						connectionContext.data = data;
						resolve();
					}
				});

			if (continueImmediately) {
				resolve();
			}
		});
	}

	/**
	 * Init socketIOServer for specific namespace
	 * @param {SocketIO.Server} socketServer A handler for specific namespace.
	 * @private
	 */
	_setupHandlers(socketServer) {
		socketServer.on('connection', socket => {
			this.attachEvents(socket);
		});
	}
}

function abortConnection(socket) {
	try {
		socket.disconnect(true);
	} catch (e) { // ignore errors - we've aborted this connection
	}
}

module.exports = SocketIOTransport;
