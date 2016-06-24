'use strict';

const vm = require('vm');
const Module = require('module');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

try {
	require.resolve('json-ws');
} catch (err) {
	// Import error, make json-ws requireable (for require('json-ws/client') in proxies):
	module.paths.unshift(path.resolve(__dirname, '..'));
}

module.exports.service = require('./lib/service/service.js');

module.exports.client = require('./lib/client.js').RpcClient;

module.exports.registry = require('./lib/registry');

module.exports.getLanguageProxy = require('./lib/get-language-proxy');

module.exports.transport = {
	HTTP: require('./lib/transport/http-transport'),
	WebSocket: require('./lib/transport/ws-transport')
};

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

	const parsedProxyUrl = url.parse(proxyUrl);
	const useHttps = Object.keys(sslSettings).length > 0;

	const requestSettings = {
		protocol: parsedProxyUrl.protocol,
		hostname: parsedProxyUrl.hostname,
		port: parsedProxyUrl.port,
		path: parsedProxyUrl.path
	};

	for (const s in sslSettings) {
		if (sslSettings.hasOwnProperty(s)) {
			requestSettings[s] = sslSettings[s];
		}
	}

	if (useHttps) {
		requestSettings.agent = new https.Agent(requestSettings);
	}

	const req = (useHttps ? https : http).request(requestSettings, function(res) {
		if (res.statusCode !== 200) {
			callback(new Error('Proxy not available at ' + proxyUrl));
			return;
		}

		const responseSize = Number(res.headers['content-length']);
		if (isNaN(responseSize) || responseSize <= 0) {
			callback(new Error('Empty response'));
			return;
		}
		const responseBuffer = new Buffer(responseSize);
		let offset = 0;

		res.on('data', chunk => {
			offset += chunk.copy(responseBuffer, offset);
		});
		res.on('end', () => {
			const proxyCode = responseBuffer.toString('utf8');
			const proxyModule = {exports: {}};

			try {
				const moduleWrapper = vm.runInThisContext(Module.wrap(proxyCode), {filename: proxyUrl});
				moduleWrapper(proxyModule.exports, require, proxyModule);
			} catch (vmError) {
				const err = new Error('Error loading proxy');
				err.stack = vmError.stack;
				callback(err);
				return;
			}

			callback(null, proxyModule.exports);
		});
	});
	req.end();
};

module.exports.getClientProxy = function(apiRoot, apiType, version, sslSettings, callback) {
	if (!callback) {
		callback = sslSettings;
		sslSettings = {};
	}
	const serviceUrl = apiRoot + '/' + apiType + '/' + version;
	const proxyClassName = apiType.split(/\W+/).map(function(string) {
		return string[0].toUpperCase() + string.slice(1).toLowerCase();
	}).join('') + 'Proxy';
	const proxyUrl = serviceUrl + '?proxy=JavaScript&localName=' + proxyClassName;
	module.exports.proxy(proxyUrl, sslSettings, function(err, proxy) {
		if (err) {
			callback(err, null);
		} else {
			const ProxyClass = proxy[proxyClassName];
			if (ProxyClass) {
				callback(null, new ProxyClass(serviceUrl, sslSettings));
			} else {
				callback(new Error('Proxy not available'));
			}
		}
	});
};
