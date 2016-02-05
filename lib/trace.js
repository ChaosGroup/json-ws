'use strict';

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
	// todo if context.http
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
	constructor(bunyanLogger) {
		this._enabled = !!bunyanLogger;
		this._logger = bunyanLogger;
	}

	_log(context, message, important) {
		if (!this._enabled) {
			return;
		}
		if (typeof important == 'undefined' || important) {
			this._logger.debug(`[JSON-WS] client ${address(context)} :: ${message}`);
		} else {
			this._logger.trace(`[JSON-WS] client ${address(context)} :: ${message}`);
		}
	}

	connect(context) {
		this._log(context, 'connected', false);
	}

	disconnect(context) {
		this._log(context, 'disconnected', false);
	}

	call(context, methodInfo, args) {
		this._log(context, `method "${methodInfo.name}", arguments:\n ${stringify(args, null, 2)}`);
	}

	response(context, methodInfo, value) {
		this._log(context, `method "${methodInfo.name}", return:\n${stringify(value, null, 2)}`);
	}

	error(context, methodInfo, error) {
		if (methodInfo) {
			this._log(context, `method "${methodInfo.name}", error:\n${error.stack}`);
		} else {
			this._log(context, `error:\n${stringify(error, null, 2)}`);
		}
	}

	event(context, eventInfo, args) {
		this._log(context, `event "${eventInfo.name}", arguments:\n${stringify(args, null, 2)}`);
	}

	subscribe(context, eventInfo) {
		this._log(context, `subscribed to event "${eventInfo.name}"`);
	}

	unsubscribe(context, eventInfo) {
		this._log(context, `unsubscribed from event "${eventInfo.name}"`);
	}

}

module.exports = Trace;
