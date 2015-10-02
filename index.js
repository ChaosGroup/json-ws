'use strict';

var Trace = require("./lib/trace.js");
var debugLogger;

module.exports = function(logger) {
	debugLogger = logger;
	return module.exports;
}

module.exports.api = require("./lib/api.js");

module.exports.client = require("./lib/client.js").RpcClient;

module.exports.transport = {
	WebSocket: function(httpServer) {
		var transport = require("./lib/ws-transport");
		transport = new transport(httpServer);
		transport.trace = new Trace(debugLogger);
		return transport;
	},

	HTTP: function(httpServer, expressApp) {
		if (!httpServer || !expressApp) {
			throw new Error('HTTP transport requires an HTTP server and an Express application instance.');
		}
		var transport = require("./lib/rest-transport");
		transport = new transport(httpServer, expressApp);
		transport.trace = new Trace(debugLogger);
		return transport;
	}
};

module.exports.transport.WebSocket.type = 'WebSocket';
module.exports.transport.HTTP.type = 'HTTP';

/**
 * Fetches proxy code from a URL
 * Attempts to run the script in the VM and return to result to the caller
 * @param {String} proxyUrl
 * @param {Object} sslSettings
 * @param {Function} callback
 */
module.exports.proxy = function(proxyUrl, sslSettings, callback) {
	if (!callback) {
		callback = sslSettings;
		sslSettings = {};
	}
	var request = require('request');
	request(proxyUrl, {
		agentOptions: sslSettings
	}, function(err, response, body) {
		if (err) { callback(err); return; }

		if (response.statusCode !== 200) {
			callback(new Error('Proxy not available at ' + proxyUrl));
			return;
		}

		var fileName = proxyUrl.substring(0, proxyUrl.indexOf('?'));
		var proxyExports = {};

		var vm = require('vm');
		try {
			vm.runInNewContext(body, {
				module: {exports: proxyExports},
				require: function(moduleName) {
					if ('json-ws' === moduleName) {
						return module.exports;
					} else if ('json-ws/client' === moduleName) {
						return module.exports.client;
					} else {
						return require(moduleName);
					}
				}
			}, fileName);
		} catch (vmError) {
			callback(new TypeError('Error loading proxy: ' + vmError.message));
			return;
		}

		callback(null, proxyExports);
	});
};

module.exports.getClientProxy = function(apiRoot, apiType, version, sslSettings, callback) {
	if (!callback) {
		callback = sslSettings;
		sslSettings = {};
	}
	var serviceUrl = apiRoot + '/' + apiType + '/' + version;
	var proxyClassName = apiType.split(/\W+/).map(function(string) {
		return string[0].toUpperCase() + string.slice(1).toLowerCase();
	}).join('') + 'Proxy';
	var proxyUrl = serviceUrl + '?proxy=JavaScript&localName=' + proxyClassName;
	module.exports.proxy(proxyUrl, sslSettings, function(err, proxy) {
		if (err) {
			callback(err, null);
		} else {
			var proxyClass = proxy[proxyClassName];
			if (proxyClass) {
				callback(null, new proxyClass(serviceUrl, sslSettings));
			} else {
				callback(new Error('Proxy not available'));
			}
		}
	});
}

/**
 * API Registry middleware for Express/Connect
 * Responds to OPTIONS request, renders a page listing all registered services
 * and serves the NodeJS/browser client library.
 * @param {String} rootPath Mount point of the service registry.
 */
module.exports.registry = function(rootPath) {
	var registry = require('./lib/registry');
	return registry(rootPath);
};

module.exports.getLanguageProxy = require('./lib/get-language-proxy');
