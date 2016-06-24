/**
 * JSON-WS Service Registry
 */

'use strict';

var fs = require('fs');
var os = require('os');
var ejs = require('ejs');
var path = require('path');
var util = require('util');
var ujs = require("uglify-js");
var crypto = require('crypto');
var getLanguageProxy = require('./get-language-proxy');

function uglify(script, level) {
	if (level !== 'none') {
		var ast = ujs.parse(script);
		ast.figure_out_scope();
		if (level == 'fast') {
			ast = ast.transform(ujs.Compressor({
				conditionals  : false,
				comparisons   : false,
				warnings      : false
			}, false));
		} else {
			ast = ast.transform(ujs.Compressor({warnings: false}));
		}
		ast.figure_out_scope();
		if (level !== 'fast') {
			ast.compute_char_frequency();
		}
		ast.mangle_names();
		return ast.print_to_string();
	} else {
		return script;
	}
}

function ServiceRegistry(rootPath) {
	this.services = [];
	this.rootPath = rootPath.replace(/\/*$/gi, '');
}

ServiceRegistry.prototype.renderMetadataPage = function (service, req, res) {
	if (req.query.json !== undefined) {
		// Handle the "?json" query, return an API description in JSON format
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.write(JSON.stringify(service.getMetadata()));
		res.end();
		return;
	}

	if (req.query.proxy !== undefined) {
		// Generate a proxy file
		var signature = service.timeStamp;
		['proxy', 'namespace', 'localName'].forEach(function (param) {
			if (req.query.hasOwnProperty(param)) {
				signature += ';' + req.query[param];
			}
		});

		var sha1 = crypto.createHash('sha1');
		sha1.update(signature);
		var etag = sha1.digest('hex');
		if (req.headers['if-none-match'] === etag) {
			res.status(304).end();
			return;
		}

		// Request for a proxy generator
		getLanguageProxy({
			serviceInstance: service,
			language: req.query.proxy,
			localName: req.query.namespace || req.query.localName
		}).then(function(html) {
			var contentType = 'text/plain';
			var proxyType = req.query.proxy.toLowerCase();
			if (proxyType.indexOf('javascript') != -1) {
				contentType = 'application/javascript';
				html = uglify(html, 'full');
			} else if (proxyType.indexOf('java') != -1) {
				contentType = 'text/java';
			}
			res.writeHead(200, {
				'Content-Type': contentType,
				'Content-Length': html.length,
				'Cache-Control': 'must-revalidate',
				'ETag': etag
			});
			res.write(html);
			res.end();
		}).catch(function(err) {
			if (err.code === 'ENOENT') {
				res.status(404).send('Proxy generator not found.');
			} else {
				res.status(500).send(err.toString());
			}
			res.end();
		});
	} else if (req.query.viewer !== undefined) {
		var token = '';
		
		// Render viewer/experiment page
		var examples = [];
		for(var method in service.methodMap) {
			if (service.methodMap[method].examples['JavaScript']) {
				examples.push(method);
			}
		}
		var snippets = [];
		for (var snippet in service.snippetMap) {
			if (service.snippetMap[snippet]['JavaScript']) {
				snippets.push(snippet);
			}
		}
		var code = null;
		var name = req.query.example;
		if (examples.indexOf(name) > -1) {
			code = service.methodMap[name].examples['JavaScript'];
		} else {
			name = req.query.snippet;
			if (snippets.indexOf(name) > -1) {
				code = service.snippetMap[name]['JavaScript'];
			}
		}
		ejs.renderFile(__dirname + '/../templates/viewer.ejs', {
			root: this.rootPath,
			title: service.friendlyName + ' ' + service.version,
			url: service.path,
			examples: examples,
			snippets: snippets,
			code: code,
			token: token
		}, function (err, file) {
			res.send(err ? err.toString() : file);
		});
	} else {
		// Find out list of proxy generators
		var proxies = [];
		fs.readdirSync(__dirname + '/../proxies/').forEach(function (f) {
			var ext = f.slice(-4);
			if (ext === ".ejs") {
				proxies.push(f.substr(0, f.length - 4));
			}
		});

		// Render the metadata template
		ejs.renderFile(
			__dirname + '/../templates/metadata.ejs',
			{
				metadata: service,
				ejs: ejs,
				ujs: ujs,
				proxies: proxies,
				root: this.rootPath
			}, function (err, html) {
				if (err) {
					res.status(500).send(err.toString());
				} else {
					res.send(html);
				}
			});
	}
};

/**
 * @param {object} [options]
 * @param {boolean} [options.disableCors=false]
 */
ServiceRegistry.prototype.router = function (options) {
	var self = this, options = options || {};

	options.disableCors = !!options.disableCors;

	return function (req, res, next) {
		var url = req.path.replace(/\/\//ig, '/').replace(/\/*$/gi, '');
		url = require('url').parse(url).pathname || '';
		//console.log('root = ' + self.rootPath + ', url = ' + url);

		if (!options.disableCors && req.method.toUpperCase() == 'OPTIONS' && url.substr(0, self.rootPath.length) == self.rootPath) {
			res.set('Access-Control-Allow-Origin', '*');
			res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
			res.set('Access-Control-Max-Age', 1000);
			res.set('Access-Control-Allow-Headers', 'origin, x-csrftoken, content-type, accept');
			res.end();
			return;
		}

		if (url === self.rootPath) {
			ejs.renderFile(__dirname + '/../templates/services.ejs', {
				services: self.getServices(self.rootPath).map(function (s) {
					return s.getMetadata()
				})
			}, function (err, html) {
				if (err) {
					res.status(500).send(err.toString());
				} else {
					res.set('Content-Type', 'text/html');
					res.set('Content-Length', html.length);
					res.set('Cache-Control', 'must-revalidate');
					res.send(html);
				}
			});
		} else if (url == self.rootPath + '/client' || url == self.rootPath + '/client.js') {
			fs.readFile(__dirname + '/../lib/client.js', { encoding: 'utf-8' }, function (err, text) {
				if (err) res.status(404).send('Error reading client library\n\n' + err);
				else {
					res.set('Content-Type', 'application/javascript');
					res.send(uglify(text, 'full'));
				}
			});
		} else if (url.indexOf(self.rootPath + '/static/') != -1) {
			var fileName = url.substring(url.lastIndexOf('/') + 1);
			if (fileName.indexOf('.js') != -1) {
				res.set('Content-Type', 'application/javascript');
			} else if (fileName.indexOf('.css') != -1) {
				res.set('Content-Type', 'text/css');
			}
			res.sendfile(path.resolve(__dirname + '/../static/' + fileName));
		} else {
			var serviceInstance = self.getServices(url);
			if (serviceInstance && req.method.toUpperCase() == 'GET' && serviceInstance.length == 1 && serviceInstance[0].path === url) {
				self.renderMetadataPage(serviceInstance[0], req, res);
			} else {
				next();
			}
		}
	};
};

ServiceRegistry.prototype.addService = function (serviceInstance) {
	this.services.push(serviceInstance);
};

ServiceRegistry.prototype.getServices = function (pathPrefix) {
	if (!pathPrefix) return this.services;
	return this.services.filter(function (service) {
		return service.path.substr(0, pathPrefix.length) === pathPrefix
	});
};

module.exports = (function() {
	var registries = {};
	return function(rootPath) {
		if (!registries[rootPath]) {
			registries[rootPath] = new ServiceRegistry(rootPath);
		}
		return registries[rootPath];
	};
}());
