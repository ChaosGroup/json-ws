'use strict';

var format = require('util').format;
var url = require('url');

var Trace = function (logger) {
	this.enabled = !!logger;
	this.logger = logger;
};

function address(context) {
	var remoteAddress = '(unknown)';
	if (context.socket) {
		if (context.socket.remoteAddress) {
			remoteAddress = context.socket.remoteAddress + ':' + context.socket.remotePort;
		} else if (context.socket._peername){
			var peer = context.socket._peername;
			remoteAddress = peer.address + ':' + peer.port;
		}
	} else if (context.ws) {
		if (context.ws.socket) {
			remoteAddress = context.ws.socket.remoteAddress + ':' + context.ws.socket.remotePort;
		} else if (context.ws._socket) {
			var peer = context.ws._socket._peername;
			remoteAddress = peer.address + ':' + peer.port;
		}
	} else if (context.res) {
		var peer = context.res.req.connection._peername;
		remoteAddress = peer.address + ':' + peer.port;
	}
	return remoteAddress;
}

function stringify(object) {
	return JSON.stringify(object, function(key, value) {
		if (value instanceof Buffer) {
			return "(buffer)";
		} else if (value instanceof Array && value.length > 1000) {
			return "(large array)";
		} else if (typeof value == "string" && value.length > 1000) {
			return "(large string)";
		} else if (value instanceof url.Url) {
			return value.format();
		}
		return value;
	}, 2);
}

Trace.prototype.log = function (context, message, important) {
	if (!this.enabled) return;

	if (typeof important == "undefined" || important) {
		this.logger.debug(
			format('[JSON-RPC] client %s :: %s', address(context), message)
		);
	} else {
		this.logger.trace(
			format('[JSON-RPC] client %s :: %s', address(context), message)
		);
	}
};

Trace.prototype.connect = function (context) {
	this.log(context, 'connected', false);
};

Trace.prototype.disconnect = function (context) {
	this.log(context, 'disconnected', false);
};

Trace.prototype.call = function (context, methodInfo, args) {
	this.log(context, 'method "' + methodInfo.name + '"' +
		', arguments:\n' + stringify(args, null, 2));
};

Trace.prototype.return = function (context, methodInfo, value) {
	this.log(context, 'method "' + methodInfo.name + '"' +
		', return:\n' + stringify(value, null, 2));
};

Trace.prototype.error = function (context, methodInfo, error) {
	if (methodInfo) {
		this.log(context, 'method "' + methodInfo.name + '"' +
			', error:\n' + stringify(error, null, 2));
	} else {
		this.log(context, 'error:\n' + stringify(error, null, 2));
	}
};

Trace.prototype.event = function (context, eventInfo, args) {
	this.log(context, 'event "' + eventInfo.name + '"' +
		', arguments:\n' + stringify(args, null, 2));
};

Trace.prototype.subscribe = function (context, eventInfo) {
	this.log(context, 'subscribed to event "' + eventInfo.name + '"');
};

Trace.prototype.unsubscribe = function (context, eventInfo) {
	this.log(context, 'unsubscribed from event "' + eventInfo.name + '"');
};

module.exports = Trace;
