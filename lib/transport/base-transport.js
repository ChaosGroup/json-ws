/**
 * This module defines the base API for a JSON-RPC-based web service transport.
 * Valid transports can include HTTP (REST), Web Sockets, Socket.IO, ZMQ, etc.
 */

'use strict';

const jsonrpc = require('./json-rpc');
const EventEmitter = require('events').EventEmitter;

class BaseTransport extends EventEmitter {
	constructor(registry) {
		super();
		this.registry = registry;
		this.trace = registry.trace;
		this.eventMap = new EventEmitter();
		this.eventMap.setMaxListeners(0);
		this.eventContextMap = {};
		this.eventContextService = new WeakMap(); // <eventContext -> service>
		//this.registry.httpServer.setMaxListeners(0);
		this.registry.httpServer.on('connection', (socket) => {
			//socket.setMaxListeners(0);
			this.onConnect(socket);
			socket.on('close', () => {
				this.onDisconnect(socket);
			});
		});
	}

	/**
	 *
	 * @param msg
	 * @param context
	 * @param [format]
	 */
	sendMessage(/*msg, context, format*/) {
	}

	onConnect(context) {
		this.trace.connect(context);
		this.emit('connect', context);
	}

	onDisconnect(context) {
		this.trace.disconnect(context);
		this.emit('disconnect', context);

		const eventContextListener = this.eventContextMap[context];
		delete this.eventContextMap[context];

		// Un-subscribe events
		if (eventContextListener) {
			const service = this.eventContextService.get(eventContextListener);
			Object.keys(eventContextListener).forEach((eventName) => {
				service.removeListener(eventName, eventContextListener[eventName]);
			});
			this.eventContextService.delete(eventContextListener);
		}
	}

	validateMessage(service, options, callback) {
		if (service.requestValidator) {
			const promise = service.requestValidator(options, callback);
			if (promise instanceof Promise) {
				promise.then(result => callback(null, result)).catch(err => callback(err));
			}
			return false;
		} else {
			return true;
		}
	}

	/**
	 * Process a message received on the transport
	 * Parse, validate, and run the requested method
	 * If needed, send response back to caller
	 * After successful authentication and authorization passes the called
	 * methods a 'context' argument with the following properties:
	 * 	- token: JWT token used to call the method
	 * 	- session: custom data associated with the token
	 * 	- user: { username, fullname, groups }
	 * 	- permissions: map of permission labels to object ids or '*' for all objects
	 * @param service
	 * @param msg
	 * @param context
	 */
	handleMessage(service, msg, context) {
		context = context || {};

		// Parse and validate the message
		let req;
		try {
			req = typeof msg === 'string' ? JSON.parse(msg) : msg;
		} catch (ex) { // Parse error
			this.trace.error(context, null, ex);
			this.sendMessage(
				jsonrpc.response(
					null,
					jsonrpc.error(-32700, 'Parse error', ex.toString())
				),
				context);
			return;
		}

		const err = jsonrpc.validateRequest(req, service);
		if (err) {
			this.trace.error(context, null, err);
			this.sendMessage(jsonrpc.response(req.id, err), context); // TBD id is not validated
			return;
		}

		let eventName, eventContext;
		if (req.method.indexOf('rpc.on') === 0) {
			// Event subscription
			eventName = req.params[0];
			eventContext = this.eventContextMap[context] || {};
			const eventInfo = service.eventMap[eventName];
			this.eventContextMap[context] = eventContext;
			if (!eventContext[eventName]) {
				eventContext[eventName] = (eventData) => {
					if (eventInfo.type/* && eventData*/) {
						eventData = this.convertResult(service, eventInfo.name, eventInfo.type, eventInfo.isArray, eventData);
					}
					this.sendMessage(jsonrpc.response(eventName, null, eventData), context);
					this.trace.event(context, eventInfo, eventData);
				};
				this.eventContextService.set(eventContext, service);
				service.on(eventName, eventContext[eventName]);
				this.trace.subscribe(context, eventInfo);
			}
		} else if (req.method.indexOf('rpc.off') === 0) {
			// Cancel event subscription
			eventName = req.params[0];
			eventContext = this.eventContextMap[context] || {};
			const eventInfo = service.eventMap[eventName];
			const fn = eventContext[eventName];
			if (fn) {
				delete eventContext[eventName];
				service.removeListener(eventName, fn);
			}
			this.trace.unsubscribe(context, eventInfo);
		} else {
			this.call(service, req, context);
		}
	}

	convertResult(service, name, type, isArray, data) {
		const typeInfo = service.type(type);
		if (isArray) {
			if (!Array.isArray(data)) {
				throw new Error('Expected an array from ' + name);
			}
			return data.map(arrayValue => typeInfo.convert(arrayValue, true));
		} else {
			return typeInfo.convert(data, true);
		}
	}

	parseParams(service, methodInfo, params) {
		params = params || [];
		const paramsInArray = Array.isArray(params);
		if (methodInfo.params.length > 0) {
			params = methodInfo.params.map((p, i) => {
				const paramType = service.type(p.type);
				let paramValue = params[paramsInArray ? i : p.name];

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
					return paramValue.map(arrayValue => paramType.convert(arrayValue));
				} else {
					return paramType.convert(paramValue);
				}
			});
		}

		if (!Array.isArray(params)) {
			// The params could not be converted to an array using the method info
			// Force the object's properties to an array
			const arrayParams = [];
			const t = typeof params;
			if (t === 'object') {
				Object.keys(params).forEach(function (key) {
					arrayParams.push(params[key]);
				});
			} else {
				arrayParams.push(t);
			}
			params = arrayParams;
		}
		return params;
	}

	call(service, request, context) {
		const id = request.id;
		const methodName = request.method;
		const methodInfo = service.methodMap[methodName];

		let responseIsSent = false;

		const sendResponse = (err, result, format) => {
			if (responseIsSent) {
				throw new Error('Method ' + methodInfo.name + ' has already sent a response.');
			}

			if (err) {
				this.trace.error(context, methodInfo, err);
			} else if (result) {
				this.trace.response(context, methodInfo, result);
			}

			let errorData;
			if (err) {
				errorData = err.stack ? err.toString() : JSON.stringify(err);
				result = null;
			} else if (methodInfo.returns) {
				try {
					result = this.convertResult(service, methodInfo.name, methodInfo.returns, methodInfo.returnsArray, result);
				} catch (resultConversionErr) {
					err = resultConversionErr;
					errorData = 'Result conversion error: ' + err.message;
					result = null;
					this.trace.error(context, methodInfo, resultConversionErr);
				}
			} else {
				result = null;
			}
			format = format || null;
			this.sendMessage(
				jsonrpc.response(
					id,
					err && jsonrpc.error(-32000, 'Internal server error', errorData),
					result),
				context, format);
			responseIsSent = true;
		};

		try {
			const params = this.parseParams(service, methodInfo, request.params);
			this.trace.call(context, methodInfo, params);

			if ((methodInfo.async || methodInfo.returns) && methodInfo.callback) {
				params.push(sendResponse);
			}
			params.push(context);

			// See if the function returns a value
			// If so, send it back straight away
			// Otherwise assume that the function calls the callback
			let returnValue;
			try {
				returnValue = methodInfo.fn.apply(methodInfo['this'], params);
			} catch (methodInvocationEx) {
				sendResponse(methodInvocationEx, null);
				return;
			}
			if (returnValue && 'function' == typeof returnValue.then && (methodInfo.async || methodInfo.returns)) {
				// this is a Promise
				returnValue.then(function(_returnValue) {
					sendResponse(null, _returnValue);
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
		} catch (methodInvocationEx) {
			sendResponse(methodInvocationEx, null);
		}
	}
}

module.exports = BaseTransport;
