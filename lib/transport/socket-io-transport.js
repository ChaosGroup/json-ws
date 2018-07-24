/**
 * Implementation of a SocketIO transport for the JSON-WS module
 */

'use strict';

const socketIO = require('socket.io');
const jsonrpc = require('./json-rpc');
const BaseTransport = require('./base-transport');
const stream = require('stream');

class SocketIOTransport extends BaseTransport {
	static get type() {
		return 'SocketIO';
	}

	constructor(registry, path = '/socket.io') {
		super(registry);
		if (path[0] !== '/') {
			throw new Error("socket.io demands that 'path' begins with slash '/'");
		}
		this.nextConnectionId = 0;

		this._serviceNamespaces = new Map /* servicePrefix -> socketIONamespace*/();
		this._socketIO = socketIO(registry.httpServer, { path });

		for (const [servicePrefix, service] of registry.services.entries()) {
			this._addServiceNamespace(servicePrefix, service);
		}

		registry.on('service-added', ({ servicePrefix, service }) => {
			this._addServiceNamespace(servicePrefix, service);
		});
	}

	sendMessage(msg, context /*, format*/) {
		if (!(context && context.socket && context.socket.connected)) {
			return;
		}

		if (msg.id !== undefined) {
			try {
				if (msg.result && Buffer.isBuffer(msg.result)) {
					msg.result = msg.result.toString('base64');
				}

				if (msg.result && msg.result instanceof stream.Readable) {
					context.socket.send(
						JSON.stringify(
							jsonrpc.response(
								msg.id,
								jsonrpc.error(
									-32000,
									'SocketIO',
									'Streaming over SocketIO is not supported'
								)
							)
						)
					);
					msg.result.destroy();
				}

				context.socket.send(JSON.stringify(msg));
			} catch (e) {
				console.log(msg); //eslint-disable-line no-console
				console.log(e); //eslint-disable-line no-console
			}
		}
	}

	_connectionContextForService(socket, service) {
		const connectionContext = Object.create(
			{},
			{
				socket: {
					get() {
						return socket;
					},
				},
				service: {
					get() {
						return service;
					},
				},
				objectId: { value: `!#ConnectionCtx:${this.nextConnectionId++}` },
				toString: {
					value: () => this.objectId,
				},
			}
		);
		connectionContext.params = {};

		return connectionContext;
	}

	_addServiceNamespace(servicePrefix, service) {
		const serviceNamespace = this._socketIO.of(servicePrefix);
		this._serviceNamespaces.set(servicePrefix, serviceNamespace);

		serviceNamespace.on('connection', socket => {
			this._attachEvents(this._connectionContextForService(socket, service));
		});
	}

	/**
	 * @param {SocketIO.Socket} socket
	 * @private
	 */
	_attachEvents(connectionContext) {
		const socket = connectionContext.socket;
		this.onConnect(socket);

		let validationParamsReceived = false;
		socket.on('rpc.sio.setConnectionContext', ({ validationParams = {} }, cb) => {
			if (!validationParamsReceived) {
				connectionContext.params = validationParams;
				validationParamsReceived = true;
			}
			cb();
		});

		socket.on('message', message => {
			try {
				message = typeof message === 'string' ? JSON.parse(message) : message;
			} catch (ex) {
				// Parse error
				this.trace.error(connectionContext, null, ex);
				socket.send(
					jsonrpc.response(null, jsonrpc.error(-32700, 'Parse error', ex.toString()))
				);
				return;
			}

			const continueImmediately = this.validateMessage(
				connectionContext.service,
				message,
				connectionContext.params,
				(err, data) => {
					if (err) {
						socket.send(
							jsonrpc.response(
								message.id,
								jsonrpc.error(-32000, 'Bad Request', err.message)
							)
						);
					} else {
						connectionContext.data = data; // Update with the latest data from the validator.
						this.handleMessage(connectionContext.service, message, connectionContext);
					}
				}
			);

			if (continueImmediately) {
				this.handleMessage(connectionContext.service, message, connectionContext);
			}
		});

		socket.on('disconnect', () => {
			this.onDisconnect(connectionContext);
		});
	}
}

module.exports = SocketIOTransport;
