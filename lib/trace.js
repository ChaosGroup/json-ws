'use strict';

const format = require('util').format;
const url = require('url');

function address(context) {
	let remoteAddress = '(unknown)';
	if (context.socket) {
		if (context.socket.remoteAddress) {
			remoteAddress = context.socket.remoteAddress + ':' + context.socket.remotePort;
		} else if (context.socket._peername){
			const peer = context.socket._peername;
			remoteAddress = peer.address + ':' + peer.port;
		}
	} else if (context.ws) {
		if (context.ws.socket) {
			remoteAddress = context.ws.socket.remoteAddress + ':' + context.ws.socket.remotePort;
		} else if (context.ws._socket) {
			const peer = context.ws._socket._peername;
			remoteAddress = peer.address + ':' + peer.port;
		}
	} else if (context.res) {
		const peer = context.res.req.connection._peername;
		remoteAddress = peer.address + ':' + peer.port;
	}
	return remoteAddress;
}

function stringify(object) {
	return JSON.stringify(object, function(key, value) {
		if (value instanceof Buffer) {
			return '(buffer)';
		} else if (value instanceof Array && value.length > 1000) {
			return '(large array)';
		} else if (typeof value == 'string' && value.length > 1000) {
			return '(large string)';
		} else if (value instanceof url.Url) {
			return value.format();
		}
		return value;
	}, 2);
}

class Trace {
	constructor(logger) {
		this.enabled = !!logger;
		this.logger = logger;
	}

	log(context, message, important) {
		if (!this.enabled) return;

		if (typeof important == 'undefined' || important) {
			this.logger.debug(
				format('[JSON-RPC] client %s :: %s', address(context), message)
			);
		} else {
			this.logger.trace(
				format('[JSON-RPC] client %s :: %s', address(context), message)
			);
		}
	}

	connect(context) {
		this.log(context, 'connected', false);
	}

	disconnect(context) {
		this.log(context, 'disconnected', false);
	}

	call(context, methodInfo, args) {
		this.log(context, 'method "' + methodInfo.name + '"' +
			', arguments:\n' + stringify(args, null, 2));
	}

	return(context, methodInfo, value) {
		this.log(context, 'method "' + methodInfo.name + '"' +
			', return:\n' + stringify(value, null, 2));
	}

	error(context, methodInfo, error) {
		if (methodInfo) {
			this.log(context, 'method "' + methodInfo.name + '"' +
				', error:\n' + stringify(error, null, 2));
		} else {
			this.log(context, 'error:\n' + stringify(error, null, 2));
		}
	}

	event(context, eventInfo, args) {
		this.log(context, 'event "' + eventInfo.name + '"' +
			', arguments:\n' + stringify(args, null, 2));
	}

	subscribe(context, eventInfo) {
		this.log(context, 'subscribed to event "' + eventInfo.name + '"');
	}

	unsubscribe(context, eventInfo) {
		this.log(context, 'unsubscribed from event "' + eventInfo.name + '"');
	}

}

module.exports = Trace;
