'use strict';

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

/**
 * Return a language proxy for the specified service instance and
 * @param options
 * @param options.serviceInstance {object} JSON-WS service instance
 * @param options.language {string} target language, e.g. "JavaScript" or "Python"
 * @param [options.localName] {string} the name of the proxy class. Defaults to "Proxy"
 * @returns {object} Promise
 */
function getLanguageProxy(options) {
	// Try and find if one is available
	const proxyScript = path.resolve(__dirname, '..', 'proxies', options.language + '.ejs');

	return new Promise(function(resolve, reject) {
		fs.stat(proxyScript, function(err) {
			if (err) {
				return reject(err);
			}

			ejs.renderFile(proxyScript, {
				metadata: options.serviceInstance.getMetadata(),
				localName: options.localName || 'Proxy'
			}, function(err, html) {
				if (err) {
					return reject(err);
				}

				resolve(html);
			});
		});
	});
}

module.exports = getLanguageProxy;
