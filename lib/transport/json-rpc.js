/**
 * Utilities to parse/generate valid JSON-RPC 2.0 messages.
 * For more information please visit http://www.jsonrpc.org/specification.
 */
'use strict';

const { AsServiceError } = require('../error');

const jsonrpc = module.exports = {
	// Make sure our messages always have the 2.0 version tag
	jsonrpc: function (o) {
		o.jsonrpc = '2.0';
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
		const res = {
			id: typeof id === 'undefined' ? null : id
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
		return { code, message, data };
	},

	// Check if a JSON message is a valid JSON-RPC request
	// @param methodMap Contains a map with valid method names and parameters for the request
	validateRequest: function (req, api) {
		const name = api.name;
		if (!req.hasOwnProperty('jsonrpc') || req.jsonrpc !== '2.0') {
			return jsonrpc.error(-32600,
				'Invalid request',
				AsServiceError('jsonrpc protocol version MUST be \'2.0\'', name));
		}

		if (!req.hasOwnProperty('method') || !!req.method == false) {
			return jsonrpc.error(-32601,
				'Method not found',
				AsServiceError('The \'method\' property is undefined or empty', name));
		}

		if (req.method.indexOf('rpc.') === 0) {
			const eventName = req.params[0];
			if (!eventName) {
				return jsonrpc.error(-32601, 'Invalid event operation');
			}
			if (!api.eventMap.hasOwnProperty(eventName)) {
				return jsonrpc.error(-32601, 'Event not found', AsServiceError(eventName, name));
			}
			return null;
		}

		if (!api.methodMap.hasOwnProperty(req.method)) {
			return jsonrpc.error(-32601, 'Method not found', AsServiceError(req.method, name));
		}

		const methodInfoParams = api.methodMap[req.method].params;
		/* BH-178 Methods with no parameters do not enforce input parameters length check
		if (methodInfoParams.length == 0) {
			return null;
		}*/

		const requiredParamsCount = methodInfoParams.reduce(function(prev, param) {
			return prev + (param.default === undefined ? 1 : 0);
		}, 0);

		if (requiredParamsCount > 0 && (!req.hasOwnProperty('params') || !req.params)) {
			return jsonrpc.error(-32602, 'Missing parameters', AsServiceError(req.method, name));
		}

		if (Array.isArray(req.params)) {
			if (req.params.length < requiredParamsCount || req.params.length > methodInfoParams.length) {
				return jsonrpc.error(-32602,
					'Invalid parameters',
					AsServiceError('The specified number of parameters does not match the method signature', name));
			}
		} else if (typeof req.params === 'object') {
			for (let i = 0; i < methodInfoParams.length; i++) {
				if (i < requiredParamsCount && !req.params.hasOwnProperty(methodInfoParams[i].name)) {
					return jsonrpc.error(-32602,
						'Invalid parameters',
						AsServiceError('The specified parameters do not match the method signature', name));
				}
			}
			/*var paramsContainInvalidKey = Object.keys(req.params).some(function(p) {
				return !methodInfoParams.hasOwnProperty(p)
			});
			if (paramsContainInvalidKey) {
				return jsonrpc.error(-32602,
					"Invalid parameters",
					AsServiceError("The specified parameter names do not match the method signature", name));
			}*/
		}

		return null;
	}
};
