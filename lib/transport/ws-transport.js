/**
 * Implementation of a WebSocket transport for the JSON-WS module
 */

'use strict';

const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const Transport = require('./base-transport').Transport;

class WebSocketTransport extends Transport {
	constructor(httpServer) {
		super();
		this.httpServer = httpServer;
		this.wsServer = null;
		this.connections = {};
		this.name = 'WebSocket';
		this.nextConnectionId = 0;
	}

	close () {
		const connections = this.connections;
		Object.keys(connections).forEach(function (id) {
			const ws = connections[id];
			ws.close();
		});
		try {
			this.wsServer && this.wsServer.close();
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

	attach(api, ws) {
		Transport.prototype.attach.call(this, api);
		if (typeof ws != 'undefined') {
			this.attachEvents(ws);
		} else {
			this.wsServer = new WebSocketServer({
				server: this.httpServer,
				path: this.api.path,
				perMessageDeflate: false // turn off message compression by default
			});
			this.wsServer.on('connection', this.attachEvents.bind(this));
		}
	}

	attachEvents(ws) {
		const connectionCtx = Object.create({}, {
			ws: {
				get: function () {
					return ws;
				}
			},
			objectId: {value: '!#ConnectionCtx:' + (this.nextConnectionId++)},
			toString: {
				value: () => this.objectId
			}
		});

		this.connections[connectionCtx.objectId] = ws;
		this.onConnect(connectionCtx);

		ws.on('message', (message) => {
			this.handleMessage(message, connectionCtx);
		});

		ws.on('close', () => {
			this.onDisconnect(connectionCtx);
			delete this.connections[connectionCtx.objectId];
			ws = null;
			//delete connectionCtx.ws;
		});

		ws.send('{}');
	}
}

module.exports = WebSocketTransport;
