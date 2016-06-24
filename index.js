'use strict';

var Trace = require("./lib/trace.js");
var vm = require('vm');
var Module = require('module');
var path = require('path');
var request = require('request');
var debugLogger;

try {
	require.resolve('json-ws');
} catch(err) {
	// Import error, make json-ws requireable (for require('json-ws/client') in proxies):
	module.paths.unshift(path.resolve(__dirname, '..'));
}

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

	HTTP: function(httpServer, expressApp, options) {
		if (!httpServer || !expressApp) {
			throw new Error('HTTP transport requires an HTTP server and an Express application instance.');
		}
		var transport = require("./lib/rest-transport");
		transport = new transport(httpServer, expressApp, options);
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

	request(proxyUrl, {
		agentOptions: sslSettings
	}, function(err, response, body) {
		if (err) { callback(err); return; }

		if (response.statusCode !== 200) {
			callback(new Error('Proxy not available at ' + proxyUrl));
			return;
		}

		var proxyModule = {exports: {}};

		try {
			var moduleWrapper = vm.runInThisContext(Module.wrap(body), {filename: proxyUrl});
			moduleWrapper(proxyModule.exports, require, proxyModule);
		} catch (vmError) {
			var err = new Error('Error loading proxy');
			err.stack = vmError.stack;
			callback(err);
			return;
		}

		callback(null, proxyModule.exports);
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
