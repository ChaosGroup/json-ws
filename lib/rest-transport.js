/**
 * Implementation of an HTTP/REST transport for the JSON-WS module.
 */

'use strict';

var util = require('util');
var cookie = require('cookie');
var jsonrpc = require('./json-rpc');
var	Transport = require('./transport').Transport;

function param(req, name, defaultValue) {
	var params = req.params || {};
	var body = req.body || {};
	var query = req.query || {};
	if (params[name] !== null && params[name] !== undefined && params.hasOwnProperty(name)) {
		return params[name];
	}
	if (body[name] !== null && body[name] !== undefined) {
		return body[name];
	}
	if (query[name] !== null && query[name] !== undefined) {
		return query[name];
	}
	return defaultValue;
}

var RestTransport = module.exports = function RestTransport(httpServer, expressApp, options) {
	Transport.call(this);

	this.options = options || {};
	this.options.disableCors = !!this.options.disableCors;

	this.srv = httpServer;
	this.app = expressApp;
	this.name = 'HTTP';
	var sockets = this.sockets = [];
	var self = this;

	var id = 0;
	this.srv.setMaxListeners(0);
	this.srv.on('connection', function (socket) {
		socket.setMaxListeners(0);
		var connectionCtx = { socket: socket };
		connectionCtx.objectId = '!#ConnectionCtx:' + (id++);
		connectionCtx.toString = function() {
			return this.objectId;
		};
		self.onConnect(connectionCtx);

		sockets.push(socket);
		socket.on('close', function () {
			self.onDisconnect(connectionCtx);
			sockets.splice(sockets.indexOf(socket), 1);
		});
	});
};
util.inherits(RestTransport, Transport);

RestTransport.prototype.close = function() {
	if (this.srv) {
		try {
			this.srv.close();
			for (var i = 0; i < this.sockets.length; i++) {
				this.sockets[i].destroy();
			}
			this.srv = null;
		} catch (e) {
		}
	}
};

// HTTP-specific sendMessage
RestTransport.prototype.sendMessage = function(msg, context, format) {
	var res = context.http.response;

	if (!this.options.disableCors) {
		res.set('Access-Control-Allow-Origin', '*');
	}

	var isSent = false;
	try {
		if (msg.error) {
			res.set('Content-Type', 'application/json');
			res.status(500).send(JSON.stringify(msg));
			isSent = true;
		} else if (msg.id !== undefined && msg.id !== null) {
			// For now, assume that no format means JSON
			// otherwise simply dump the message as-is into the response stream
			// This can be extended with custom formatters if required
			var messageData = format || Buffer.isBuffer(msg.result) ? msg.result : JSON.stringify(msg);
			res.set('Content-Type',	format || (Buffer.isBuffer(messageData) ? 'application/octet-stream' : 'application/json'));
			res.send(messageData);
			isSent = true;
		}
	} finally {
		if (!isSent) {
			res.end();
		}
	}
};

// Override the attach method
// Set up Express routes
RestTransport.prototype.attach = function(api, path) {
	Transport.prototype.attach.call(this, api, path);
	var restHandler = function (req, res) {
		var methodName = req.params.methodName || param(req, 'method') || null;
		var methodInfo = this.api.methodMap[methodName];

		var json = jsonrpc.jsonrpc({
			method: methodName
		});

		var id = param(req, 'id');
		if (id !== undefined && id !== null) {
			json.id = id;
		} else if (!methodInfo || methodInfo.returns || methodInfo.async) {
			// auto-assign a message ID if the method has a declared return type (or is declared as async)
			// and no ID was given on input. Also, if the method was NOT found, assign an ID so
			// the error is always returned to the clients
			json.id = methodName;
		}

		var params = param(req, 'params');
		if (params !== undefined) {
			json.params = params;
			if (typeof json.params === 'string') {
				try {
					json.params = JSON.parse(json.params);
				} catch (unnamedJsonParseErr) {
				}
			}
		} else if (methodInfo && methodInfo.params) {
			json.params = {};
			for (var i = 0; i < methodInfo.params.length; i++) {
				var parName = methodInfo.params[i].name;
				var paramValue = param(req, parName);
				if (typeof paramValue !== 'undefined') {
					json.params[parName] = paramValue;
					if (typeof json.params[parName] === 'string') {
						try {
							json.params[parName] = JSON.parse(json.params[parName]);
						} catch (namedJsonParseErr) {
						}
					}
				}
			}
			if (Object.keys(json.params).length === 0) {
				delete json.params;
			}
		}

		var token = param(req, 'token');
		if (token) {
			json.token = token;
		} else if (req.body && req.body.token) {
			json.token = req.body.token;
		} else if (req.cookies && req.cookies.authnToken) {
			json.token = req.cookies.authnToken;
		} else if (req.headers.cookie) {
			json.token = cookie.parse(req.headers.cookie).authnToken;
		}

		this.handleMessage(json, {
			http: {
				request: req,
				response: res
			}
		});
	}.bind(this);
	this.app.post(this.api.path, restHandler);
	this.app.all(util.format('%s/:methodName', this.api.path), restHandler);
};
