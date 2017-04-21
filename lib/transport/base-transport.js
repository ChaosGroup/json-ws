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
		this.eventContextMap = new Map(); // "service:eventName" -> Set.<eventContext>
		this.eventListeners = new Map(); // "service:eventName" -> function
		this.eventContextServices = new Map(); // "service:eventName" -> service
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

		// Un-subscribe events:
		for (const eventContextMapEntry of this.eventContextMap.entries()) {
			const eventContextMapKey = eventContextMapEntry[0];
			const eventContextSet = eventContextMapEntry[1];

			if (eventContextSet.has(context)) {
				eventContextSet.delete(context);

				if (eventContextSet.size === 0) {
					const eventListener = this.eventListeners.get(eventContextMapKey);
					const service = this.eventContextServices.get(eventContextMapKey);

					if (eventListener) {
						const eventName = eventContextMapKey.substr(eventContextMapKey.indexOf(':') + 1);
						service.removeListener(eventName, eventListener);
					}

					this.eventContextMap.delete(eventContextMapKey);
					this.eventListeners.delete(eventContextMapKey);
					this.eventContextServices.delete(eventContextMapKey);
				}
			}
		}
	}

	validateMessage(service, methodName, options, callback) {
		if (service.requestValidator) {
			const promise = service.requestValidator(methodName, options, callback);
			if (promise instanceof Promise) {
				promise.then(result =>  {
					callback(null, result);
					// All we need here is to invoke the callback - we are not going to return another Promise to
					// continue the chain here - see the Bluebird warning for this below
					// http://bluebirdjs.com/docs/warning-explanations.html#warning-a-promise-was-created-in-a-handler-but-was-not-returned-from-it
					return null;
				}).catch(err => callback(err));
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

		const err = jsonrpc.validateRequest(msg, service);
		if (err) {
			this.trace.error(context, null, err);
			this.sendMessage(jsonrpc.response(msg.id, err), context); // TBD id is not validated
			return;
		}

		let eventName;
		if (msg.method.startsWith('rpc.on')) {
			// Event subscription
			eventName = msg.params[0];
			const eventInfo = service.eventMap[eventName];
			const eventContextMapKey = `${service.name}:${eventName}`;
			let eventContextSet = this.eventContextMap.get(eventContextMapKey);

			if (!eventContextSet) {
				// First subscriber for this event, create context set and add listener:
				eventContextSet = new Set();
				this.eventContextMap.set(eventContextMapKey, eventContextSet);

				const eventListener = (eventData, matchContextParams) => {
					if (eventInfo.type/* && eventData*/) {
						eventData = this.convertResult(service, eventInfo.name, eventInfo.type, eventInfo.isArray, eventData);
					}

					for (const eventContext of eventContextSet) {
						const eventContextParams = eventContext.params || {};

						if (typeof matchContextParams === 'object') {
							let contextMatchFailed = false;

							// Ensure that the given matchContextParams match the current context params:
							for (const contextKey in matchContextParams) {
								if (matchContextParams.hasOwnProperty(contextKey) &&
									eventContextParams[contextKey] !== matchContextParams[contextKey]) {

									contextMatchFailed = true;
									break;
								}
							}

							if (contextMatchFailed) {
								// Skip sending events for this context
								continue;
							}
						}

						this.sendMessage(jsonrpc.response(eventName, null, eventData), eventContext);
						this.trace.event(eventContext, eventInfo, eventData);
					}
				};
				this.eventListeners.set(eventContextMapKey, eventListener);
				this.eventContextServices.set(eventContextMapKey, service);
				service.on(eventName, eventListener);
			}

			if (!eventContextSet.has(context)) {
				eventContextSet.add(context);
				this.trace.subscribe(context, eventInfo);
			}
		} else if (msg.method.startsWith('rpc.off')) {
			// Cancel event subscription
			eventName = msg.params[0];
			const eventContextMapKey = `${service.name}:${eventName}`;
			const eventContextSet = this.eventContextMap.get(eventContextMapKey);
			const eventInfo = service.eventMap[eventName];

			if (eventContextSet) {
				eventContextSet.delete(context);
				this.trace.unsubscribe(context, eventInfo);

				if (eventContextSet.size === 0) {
					const eventListener = this.eventListeners.get(eventContextMapKey);

					if (eventListener) {
						service.removeListener(eventName, eventListener);
					}

					this.eventContextMap.delete(eventContextMapKey);
					this.eventListeners.delete(eventContextMapKey);
					this.eventContextServices.delete(eventContextMapKey);
				}
			}
		} else {
			this.call(service, msg, context);
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
				errorData = err instanceof Error ? err.message : JSON.stringify(err);
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
