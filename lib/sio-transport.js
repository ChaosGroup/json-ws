/**
 * Socket-IO Transport for JSON-WS
 * DEPRECATED, ABOUT TO BE DELETED
 */

'use strict';

const util = require('util');
const io = require('socket.io');
const Transport = require('./transport').Transport;

function sioTransport(httpServer) {
	Transport.call(this);
	this.httpServer = httpServer;
	this.wsServer = null;
	this.connections = {};
	this.name = 'SocketIO';
}
util.inherits(sioTransport, Transport);

sioTransport.prototype.close = function() {
	const connections = this.connections;
	Object.keys(connections).forEach(function(id) {
		const ws = connections[id];
		ws.disconnect();
	});
};

sioTransport.prototype.sendMessage = function(msg, context/*, format*/) {
	if (!(context && context.ws && context.ws.connected)) {
		return;
	}

	if (typeof msg.id !== 'undefined') {
		try {
			context.ws.emit('message', msg);
		} catch (e) {
			console.log(msg); //eslint-disable-line no-console
			console.log(e); //eslint-disable-line no-console
		}
	}
};

sioTransport.prototype.attach = function(api) {
	Transport.prototype.attach.call(this, api);

	this.wsServer = io.listen(this.httpServer);

	let id = 0;
	this.wsServer.of(this.api.path).on('connection', (ws) => {
		const connectionCtx = { ws: ws };
		connectionCtx.objectId = '!#ConnectionCtx:' + (id++);
		connectionCtx.toString = () => this.objectId;

		this.connections[connectionCtx.objectId] = ws;
		this.onConnect(connectionCtx);

		ws.on('message', (message) => {
			this.handleMessage(message, connectionCtx);
		});

		ws.on('disconnect', () => {
			this.onDisconnect(connectionCtx);
			delete this.connections[connectionCtx.objectId];
			delete connectionCtx.ws;
		});
	});
};

module.exports = sioTransport;
