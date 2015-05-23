/**
 * Implementation of a WebSocket transport for the JSON-WS module
 */

'use strict';

var util = require("util")
	, WebSocket = require("ws")
	, WebSocketServer = WebSocket.Server
	, events = require("events")
	, Transport = require("./transport").Transport;

function WebSocketTransport(httpServer) {
	Transport.call(this);
	this.httpServer = httpServer;
	this.wsServer = null;
	this.connections = {};
	this.name = "WebSocket";
	this.nextConnectionId = 0;
}
util.inherits(WebSocketTransport, Transport);

WebSocketTransport.prototype.close = function() {
	var connections = this.connections;
	Object.keys(connections).forEach(function(id) {
		var ws = connections[id];
		ws.close();
	});
	try {
		this.wsServer && this.wsServer.close();
		this.httpServer && this.httpServer.close();
	} catch (e) {
	}
};

WebSocketTransport.prototype.sendMessage = function(msg, context/*, format*/) {
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
			console.log(msg);
			console.log(e);
		}
	}
};

WebSocketTransport.prototype.attach = function(api, ws) {
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
};

WebSocketTransport.prototype.attachEvents = function (ws) {
	var self = this;
	var connectionCtx = Object.create({}, {
		ws: { get: function() { return ws } },
		objectId: { value: '!#ConnectionCtx:' + (self.nextConnectionId ++) },
		toString: {
			value: function () {
				return this.objectId;
			}
		}
	});

	self.connections[connectionCtx.objectId] = ws;
	self.onConnect(connectionCtx);

	ws.on('message', function(message) {
		self.handleMessage(message, connectionCtx);
	});

	ws.on('close', function() {
		self.onDisconnect(connectionCtx);
		delete self.connections[connectionCtx.objectId];
		ws = null;
		//delete connectionCtx.ws;
	});

	ws.send('{}');
};

module.exports = WebSocketTransport;