/**
 * This module defines the base API for a JSON-RPC-based web service transport.
 * Valid transports can include HTTP (REST), Web Sockets, Socket.IO, ZMQ, etc.
 */

'use strict';

var jsonrpc = require("./json-rpc");
var events = require("events");

var Transport = module.exports.Transport = function Transport() {
	this.api = null;
	this.eventMap = new events.EventEmitter();
	this.eventMap.setMaxListeners(0);
	this.eventContextMap = {};
};

// Attach the transport to an API definition given a mount-point
Transport.prototype.attach = function (api) {
	this.api = api;
	this.auth = this.api.auth;
};

/**
 *
 * @param msg
 * @param context
 * @param [format]
 */
Transport.prototype.sendMessage = function (msg, context, format) {
};

Transport.prototype.onConnect = function (context) {
	this.trace.connect(context);
};

Transport.prototype.onDisconnect = function (context) {
	this.trace.disconnect(context);

	var self = this;
	var eventContextListener = this.eventContextMap[context];
	delete this.eventContextMap[context];

	// Un-subscribe events
	if (eventContextListener) {
		Object.keys(eventContextListener).forEach(function (eventName) {
			self.api.removeListener(eventName, eventContextListener[eventName]);
		});
	}
};

Transport.prototype.close = function() {
};

/*
 Process a message received on the transport
 Parse, validate, and run the requested method
 If needed, send response back to caller
 After successful authentication and authorization passes the called
 methods a 'context' argument with the following properties:
	- token: JWT token used to call the method
	- session: custom data associated with the token
	- user: { username, fullname, groups }
	- permissions: map of permission labels to object ids or '*' for all objects
*/
Transport.prototype.handleMessage = function(msg, context) {
	var self = this;
	context = context || {};
	// default versions so that implementation code keeps working
	context.checkPermissions = function () { };
	context.filterObjects = function (objects) { return objects; };

	// Parse and validate the message
	var req;
	try {
		req = typeof msg === 'string' ? JSON.parse(msg) : msg;
	} catch (ex) { // Parse error
		self.trace.error(context, null, ex);
		self.sendMessage(jsonrpc.response(null, jsonrpc.error(-32700, "Parse error", ex.toString())), context);
		return;
	}

	var err = jsonrpc.validateRequest(req, this.api);
	if (err) {
		self.trace.error(context, null, err);
		self.sendMessage(jsonrpc.response(req.id, err), context); // TBD id is not validated
		return;
	}

	var proceedAuthenticated = function () {
		var eventName, eventContext;
		if (req.method.indexOf('rpc.on') === 0) {
			// Event subscription
			eventName = req.params[0];
			eventContext = self.eventContextMap[context] || {};
			var eventInfo = self.api.eventMap[eventName];
			self.eventContextMap[context] = eventContext;
			if (!eventContext[eventName]) {
				eventContext[eventName] = function(eventData) {
					if (eventInfo.type/* && eventData*/) {
						eventData = self.convertResult(eventInfo.name, eventInfo.type, eventInfo.isArray, eventData);
					}
					self.sendMessage(jsonrpc.response(eventName, null, eventData), context);
					self.trace.event(context, eventInfo, eventData);
				};
				self.api.on(eventName, eventContext[eventName]);
				self.trace.subscribe(context, eventInfo);
			}
		} else if (req.method.indexOf('rpc.off') === 0) {
			// Cancel event subscription
			eventName = req.params[0];
			eventContext = self.eventContextMap[context] || {};
			eventInfo = self.api.eventMap[eventName];
			var fn = eventContext[eventName];
			if (fn) {
				delete eventContext[eventName];
				self.api.removeListener(eventName, fn);
			}
			self.trace.unsubscribe(context, eventInfo);
		} else {
			self.call(req, context);
		}
	};

	var methodInfo = this.api.methodMap[req.method];
	if (methodInfo && methodInfo.authenticate && this.auth) {
		if (req.token) {
			this.auth.authenticateRpcRequest(req.token, function(err, result) {
				if (err || !result) {
					self.sendMessage(jsonrpc.response(req.id, jsonrpc.error(-32100,
						"Invalid authentication token.")), context);
				} else {
					proceedAuthenticated();
				}
			}, context);
		} else {
			self.sendMessage(jsonrpc.response(req.id, jsonrpc.error(-32100,
				"Missing authentication token.")), context);
		}
	} else {
		proceedAuthenticated();
	}
};

Transport.prototype.convertResult = function (name, type, isArray, data) {
	var self = this;
	var typeInfo = self.api.type(type);
	if (isArray) {
		if (!Array.isArray(data)) {
			throw new Error('Expected an array from ' + name);
		}
		return data.map(function(arrayValue) {
			return typeInfo.convert(arrayValue, true);
		});
	} else {
		return typeInfo.convert(data, true);
	}
};

Transport.prototype.parseParams = function(methodInfo, params) {
	var self = this;
	params = params || [];
	var paramsInArray = Array.isArray(params);
	if (methodInfo.params.length > 0) {
		params = methodInfo.params.map(function (p, i) {
			var paramType = self.api.type(p.type);
			var paramValue = params[paramsInArray ? i : p.name];

			if (p.default !== undefined && paramValue === undefined) {
				// BH-144 Use parameter's default value is it's optional and no value was supplied on input
				paramValue = p.default;
			}

			if (p.isArray) {
				if (!Array.isArray(paramValue)) {
					try {
						paramValue = JSON.parse(paramValue);
					} catch (arrayParseError) {
						throw new Error('Parameter ' + p.name + ' must be an array.');
					}
				}
				return paramValue.map(function(arrayValue) {
					return paramType.convert(arrayValue);
				});
			} else {
				return paramType.convert(paramValue);
			}
		});
	}

	if (!Array.isArray(params)) {
		// The params could not be converted to an array using the method info
		// Force the object's properties to an array
		var arrayParams = [];
		var t = typeof params;
		if (t === "object") {
			Object.keys(params).forEach(function (key) {
				arrayParams.push(params[key]);
			});
		} else {
			arrayParams.push(t);
		}
		params = arrayParams;
	}
	return params;
};

Transport.prototype.call = function(request, context) {
	var self = this;
	var id = request.id;
	var methodName = request.method;
	var methodInfo = this.api.methodMap[methodName];

	var responseIsSent = false;

	var sendResponse = function (err, result, format) {
		if (responseIsSent) {
			throw new Error('Method ' + methodInfo.name + ' has already sent a response.');
		}
		responseIsSent = true;

		if (err) {
			self.trace.error(context, methodInfo, err);
		} else if (result) {
			self.trace.return(context, methodInfo, result);
		}

		var errorData;
		if (err && err.stack) {
			errorData = err.toString();
		} else if (err) {
			errorData = JSON.stringify(err);
		}
		if (methodInfo.returns) {
			try {
				result = self.convertResult(methodInfo.name, methodInfo.returns, methodInfo.returnsArray, result);
			} catch (resultConversionErr) {
				err = resultConversionErr;
				errorData = 'Result conversion error: ' + err.message;
				result = null;
				self.trace.error(context, methodInfo, resultConversionErr);
			}
		} else {
			result = null;
		}
		format = format || null;
		self.sendMessage(
			jsonrpc.response(id, err && jsonrpc.error(-32000, "Internal server error", errorData), result), context, format);
	};

	try {
		var params = self.parseParams(methodInfo, request.params);
		self.trace.call(context, methodInfo, params);

		var proceedAuthorized = function() {
			if ((methodInfo.async || methodInfo.returns) && methodInfo.callback) {
				params.push(sendResponse);
			}
			params.push(context);

			// See if the function returns a value
			// If so, send it back straight away
			// Otherwise assume that the function calls the callback
			var returnValue;
			try {
				returnValue = methodInfo.fn.apply(methodInfo["this"], params);
			} catch (methodInvocationEx) {
				sendResponse(methodInvocationEx, null);
				return;
			}
			if (returnValue && 'function' == typeof returnValue.then && (methodInfo.async || methodInfo.returns)) {
				// this is a Promise
				returnValue.then(function(returnValue) {
					sendResponse(null, returnValue);
				}).catch(function(error) {
					sendResponse(error);
				});
			} else if (methodInfo.returns) {
				if (returnValue !== undefined) {
					sendResponse(null, returnValue);
				}
			} else if (!methodInfo.async) {
				sendResponse(null, null);
			}
		};

		// TODO: 'getPermissions' hack prevents an endless loop, but needs to be fixed properly
		if (self.auth && methodInfo.authenticate && methodInfo.name != 'getPermissions') {
			var required = {};
			for (var i = 0; i < params.length; ++i) {
				var permissions = methodInfo.params[i].permissions;
				if (permissions.length != 0) {
					required[params[i]] = permissions;
				}
			}
			self.auth.authorizeRpcRequest(request.token, required, function (err, result) {
				if (err || !result) {
					self.sendMessage(jsonrpc.response(request.id, jsonrpc.error(-32100,
						"Permission to perform the operation denied.")), context);
				} else {
					proceedAuthorized();
				}
			}, context);
		} else {
			proceedAuthorized();
		}

	} catch (methodInvocationEx) {
		sendResponse(methodInvocationEx, null);
	}
};
