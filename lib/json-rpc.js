/**
 * Utilities to parse/generate valid JSON-RPC 2.0 messages.
 * For more information please visit http://www.jsonrpc.org/specification.
 */
'use strict';

var jsonrpc = module.exports = {
	// Make sure our messages always have the 2.0 version tag
	jsonrpc: function (o) {
		o.jsonrpc = "2.0";
		return o;
	},

	/**
	 * Generates a JSON-RPC response object
	 * @param id The ID of the message
	 * @param err
	 * @param [result]
	 * @returns {jsonrpc} A JSON-RPC 2.0-formatted object
	 */
	response: function (id, err, result) {
		var res = {
			"id": typeof id === 'undefined' ? null : id
		};
		if (err) {
			res.error = err;
		} else if (typeof result !== 'undefined') {
			res.result = result;
		}
		return jsonrpc.jsonrpc(res);
	},

	// Generates an error object, part of the response
	error: function (code, message, data) {
		return {
			"code": code,
			"message": message,
			"data": data
		};
	},

	// Check if a JSON message is a valid JSON-RPC request
	// @param methodMap Contains a map with valid method names and parameters for the request
	validateRequest: function (req, api) {
		if (!req.hasOwnProperty("jsonrpc") || req.jsonrpc !== '2.0') {
			return jsonrpc.error(-32600, 
				"Invalid request", "jsonrpc protocol version MUST be '2.0'");
		}
		
		if (!req.hasOwnProperty("method") || !!req.method == false) {
			return jsonrpc.error(-32601, 
				"Method not found", "The 'method' property is undefined or empty");
		}

		if (req.method.indexOf("rpc.") == 0) {
			var eventName = req.params[0];
			if (!eventName) {
				return jsonrpc.error(-32601, "Invalid event operation");
			}
			if (!api.eventMap.hasOwnProperty(eventName)) {
				return jsonrpc.error(-32601, "Event not found", eventName);
			}
			return null;
		}

		if (!api.methodMap.hasOwnProperty(req.method)) {
			return jsonrpc.error(-32601, "Method not found", req.method);
		}

		var methodInfoParams = api.methodMap[req.method].params;
		/* BH-178 Methods with no parameters do not enforce input parameters length check
		if (methodInfoParams.length == 0) {
			return null;
		}*/

		var requriedParamsCount = methodInfoParams.reduce(function(prev, param) {
			return prev + (param.default === undefined ? 1 : 0)
		}, 0);

		if (requriedParamsCount > 0 && (!req.hasOwnProperty("params") || !!req.params == false)) {
			return jsonrpc.error(-32602, "Missing parameters", req.method);
		}

		if (Array.isArray(req.params)) {
			if (req.params.length < requriedParamsCount || req.params.length > methodInfoParams.length) {
				return jsonrpc.error(-32602,
					"Invalid parameters", "The specified number of parameters does not match the method signature");
			}
		} else if (typeof req.params === 'object') {
			for (var i = 0; i < methodInfoParams.length; i++) {
				if (i < requriedParamsCount && !req.params.hasOwnProperty(methodInfoParams[i].name)) {
					return jsonrpc.error(-32602,
						"Invalid parameters", "The specified parameters do not match the method signature");
				}
			}
			/*var paramsContainInvalidKey = Object.keys(req.params).some(function(p) {
				return !methodInfoParams.hasOwnProperty(p)
			});
			if (paramsContainInvalidKey) {
				return jsonrpc.error(-32602,
					"Invalid parameters", "The specified parameter names do not match the method signature");
			}*/
		}

		return null;
	}
};