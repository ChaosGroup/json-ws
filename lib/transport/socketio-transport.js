/**
 * Implementation of a SocketIO transport for the JSON-WS module
 */

'use strict';

const socketIO = require('socket.io');
const jsonrpc = require('./json-rpc');
const BaseTransport = require('./base-transport');
const url = require('url');
const stream = require('stream');

class SocketIOTransport extends BaseTransport {
	static get type() {
		return 'SocketIO';
	}

	constructor(registry) {
		super(registry);
		this.nextConnectionId = 0;

		const path = '/socket.io';

		const socketIOServer = socketIO(registry.httpServer, { path });

		socketIOServer.on('connection', sock => {
			this.attachEvents(sock);
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
		const connectionContext = Object.create({}, {
			socket: {
				get: () => socket
			},
			objectId: {value: `!#ConnectionCtx:${this.nextConnectionId++}`},
			toString: {
				value: () => this.objectId
			}
		});
		connectionContext.service = null;
		connectionContext.params = null;

		this.onConnect(socket);

		socket.on('rpc.sio.setConnectionContext', ({validationParams, serviceName, serviceVersion}, cb) => {
			if (!(serviceName && serviceVersion)) {
				const errMsg = "No 'serviceName' or 'serviceVersion' provided to socket.io implementation.";
				cb(errMsg);
				throw new Error(errMsg);
			}


			const service = this.registry.getService(`/${serviceName}/${serviceVersion}`);
			if (!service) {
				abortConnection(socket);
				return;
			}

			connectionContext.service = service;
			connectionContext.params = validationParams;
			cb();
		});

		socket.on('message', (message, cb) => {
			if (!connectionContext.service) {
				const errMsg = `No connection context set yet ${message}.`;
				cb(errMsg);
				throw new Error(errMsg);
			}

			try {
				message = typeof message === 'string' ? JSON.parse(message) : message;
			} catch (ex) { // Parse error
				this.trace.error(connectionContext, null, ex);
				this.sendMessage(
					jsonrpc.response(
						null,
						jsonrpc.error(-32700, 'Parse error', ex.toString())
					),
					connectionContext);
				return;
			}

			const continueImmediately = this.validateMessage(
				connectionContext.service, message, connectionContext.params, (err, data) => {
					if (err) {
						socket.send(jsonrpc.response(
							message.id,
							jsonrpc.error(-32000, 'Bad Request', err.message)));
					} else {
						connectionContext.data = data; // Update with the latest data from the validator.

						this.handleMessage(connectionContext.service, message, connectionContext);
					}
				});

			if (continueImmediately) {
				this.handleMessage(connectionContext.service, message, connectionContext);
			}
		});

		socket.on('disconnect', () => {
			this.onDisconnect(connectionContext);
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
