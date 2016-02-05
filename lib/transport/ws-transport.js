/**
 * Implementation of a WebSocket transport for the JSON-WS module
 */

'use strict';

const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const BaseTransport = require('./base-transport');
const pathToRegExp = require('path-to-regexp');

const servicePathParser = pathToRegExp('/:service/:version');

class WebSocketTransport extends BaseTransport {
	constructor(registry) {
		super(registry);
		this.registry = registry;
		this.httpServer = registry.httpServer;
		this.wsServer = null;
		this.connections = new Map();
		this.connectionContexts = new WeakMap();
		this.name = 'WebSocket';
		this.nextConnectionId = 0;

		const rootPath = this.registry.rootPath;
		const firstColonIndex = rootPath.indexOf(':'); // Handle path patterns like "/root/api/:foo/:bar"

		this.listenPath = (firstColonIndex != -1 ? rootPath.slice(0, firstColonIndex) : rootPath);
		this.rootPathParser = pathToRegExp(`${rootPath}${rootPath.endsWith('/') ? '' : '/' }*`);

		this._setupHandlers();
	}

	close () {
		for (const connection of this.connections.values()) {
			connection.close();
		}

		try {
			this.wsServer && this.wsServer.close();
		} catch (e) { //eslint-disable-line no-empty-blocks
		}
		try {
			this.httpServer && this.httpServer.close();
		} catch (e) { //eslint-disable-line no-empty-blocks
		}
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

	_gatherPathParams(url) {
		const execResult = this.rootPathParser.exec(url);

		return this.rootPathParser.keys.reduce(function(result, paramKey, paramIndex) {
			result[paramKey.name] = execResult[paramIndex + 1];

			return result;
		}, {});
	}

	_setupHandlers() {
		this.httpServer.on('upgrade', (req, socket) => {
			const connectionContext = {data: null};
			this.connectionContexts.set(req, connectionContext);
			let serviceUrl;

			if (req.url.startsWith(this.listenPath)) {
				connectionContext.urlParams = this._gatherPathParams(req.url);
				serviceUrl = `/${connectionContext.urlParams['0']}`;

				req.url = this.listenPath;
			} else {
				serviceUrl = req.url;
			}

			const servicePath = servicePathParser.exec(serviceUrl);
			if (!servicePath) {
				// TODO: abort the upgrade request and exit the handler
			}

			const service = this.registry.getService(servicePath[0]);
			if (!service) {
				// TODO: abort the upgrade request and exit the handler
			}

			connectionContext.service = service;
		});

		this.wsServer = new WebSocketServer({
			server: this.httpServer,
			path: this.listenPath,
			perMessageDeflate: false, // turn off message compression by default
			verifyClient: (info, callback) => {
				const connectionContext = this.connectionContexts.get(info.req);

				if (!connectionContext) {
					callback(false, 404, 'Not Found');
					return;
				}

				const continueImmediately = this.validateMessage(connectionContext.service, connectionContext.urlParams, (err, data) => {
					if (err) {
						callback(false, 403, 'Unauthorized.');
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

		this.connections.set(connectionCtx.objectId, ws);
		this.onConnect(connectionCtx);

		ws.on('message', (message) => {
			this.handleMessage(connectionContext.service, message, connectionCtx);
		});

		ws.on('close', () => {
			this.onDisconnect(connectionCtx);
			this.connections.delete(connectionCtx.objectId);
			ws = null;
			//delete connectionCtx.ws;
		});

		ws.send('{}');
	}
}

module.exports = WebSocketTransport;
