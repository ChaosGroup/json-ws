/**
 * Socket-IO Transport for JSON-WS
 * DEPRECATED, ABOUT TO BE DELETED
 */

'use strict';

var util = require('util')
	, io = require('socket.io')
	, events = require('events')
	, Transport = require('./transport').Transport;

function sioTransport(httpServer) {
	Transport.call(this);
	this.httpServer = httpServer;
	this.wsServer = null;
	this.connections = {};
	this.name = "SocketIO";
}
util.inherits(sioTransport, Transport);

sioTransport.prototype.close = function() {
	var connections = this.connections;
	Object.keys(connections).forEach(function(id) {
		var ws = connections[id];
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
			console.log(msg);
			console.log(e);
		}
	}
};

sioTransport.prototype.attach = function(api) {
	Transport.prototype.attach.call(this, api);

	this.wsServer = io.listen(this.httpServer);

	var self = this;
	var id = 0;
	this.wsServer.of(this.api.path).on('connection', function(ws) {
		var connectionCtx = { ws: ws };
		connectionCtx.objectId = '!#ConnectionCtx:' + (id++);
		connectionCtx.toString = function() {
			return this.objectId;
		};

		self.connections[connectionCtx.objectId] = ws;
		self.onConnect(connectionCtx);

		ws.on('message', function(message) {
			self.handleMessage(message, connectionCtx);
		});

		ws.on('disconnect', function() {
			self.onDisconnect(connectionCtx);
			delete self.connections[connectionCtx.objectId];
			delete connectionCtx.ws;
		});
	});
};

module.exports = sioTransport;
