/**
 * JSON-WS Service Registry
 */

'use strict';

const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const ujs = require('uglify-js');
const crypto = require('crypto');
const getLanguageProxy = require('./get-language-proxy');

function uglify(script, level) {
	if (level !== 'none') {
		let ast = ujs.parse(script);
		ast.figure_out_scope();
		if (level == 'fast') {
			ast = ast.transform(ujs.Compressor({ // eslint-disable-line new-cap
				conditionals  : false,
				comparisons   : false,
				warnings      : false
			}, false));
		} else {
			ast = ast.transform(ujs.Compressor({warnings: false})); // eslint-disable-line new-cap
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

class ServiceRegistry {
	constructor(rootPath) {
		this.services = [];
		this.rootPath = rootPath.replace(/\/*$/gi, '');
	}

	renderMetadataPage(service, req, res) {
		if (req.query.json !== undefined) {
			// Handle the "?json" query, return an API description in JSON format
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.write(JSON.stringify(service.getMetadata()));
			res.end();
			return;
		}

		if (req.query.proxy !== undefined) {
			// Generate a proxy file
			let signature = service.timeStamp;
			['proxy', 'namespace', 'localName'].forEach(function (param) {
				if (req.query.hasOwnProperty(param)) {
					signature += ';' + req.query[param];
				}
			});

			const sha1 = crypto.createHash('sha1');
			sha1.update(signature);
			const etag = sha1.digest('hex');
			if (req.headers['if-none-match'] === etag) {
				res.status(304).end();
				return;
			}

			// Request for a proxy generator
			getLanguageProxy({
				serviceInstance: service,
				language: req.query.proxy,
				localName: req.query.namespace || req.query.localName
			}).then(function (html) {
				let contentType = 'text/plain';
				const proxyType = req.query.proxy.toLowerCase();
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
			}).catch(function (err) {
				if (err.code === 'ENOENT') {
					res.status(404).send('Proxy generator not found.');
				} else {
					res.status(500).send(err.toString());
				}
				res.end();
			});
		} else if (req.query.viewer !== undefined) {
			// Render viewer/experiment page
			const examples = [];
			// TODO: update these loops when methodMap and snippetMap become maps:
			for (const method in service.methodMap) {
				if (service.methodMap[method].examples['JavaScript']) {
					examples.push(method);
				}
			}
			const snippets = [];
			for (const snippet in service.snippetMap) {
				if (service.snippetMap[snippet]['JavaScript']) {
					snippets.push(snippet);
				}
			}
			let code = null;
			let name = req.query.example;
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
				title: `${service.friendlyName} ${service.version}`,
				url: service.path,
				examples,
				snippets,
				code
			}, function (err, file) {
				res.send(err ? err.toString() : file);
			});
		} else {
			// Find out list of proxy generators
			fs.readdir(__dirname + '/../proxies/', function(files) {
				const proxies = files.filter(f => f.endsWith('.ejs')).map(f => f.substr(0, f.length - 4));

				// Render the metadata template
				ejs.renderFile(
					__dirname + '/../templates/metadata.ejs',
					{
						metadata: service,
						ejs,
						ujs,
						proxies,
						root: this.rootPath
					}, {_with: false}, function (err, html) {
						if (err) {
							res.status(500).send(err.toString());
						} else {
							res.send(html);
						}
					});
			});
		}
	}

	router() {
		return (req, res, next) => {
			let url = req.path.replace(/\/\//ig, '/').replace(/\/*$/gi, '');
			url = require('url').parse(url).pathname || '';
			//console.log('root = ' + self.rootPath + ', url = ' + url);

			if (req.method.toUpperCase() == 'OPTIONS' && url.startsWith(this.rootPath)) {
				res.set('Access-Control-Allow-Origin', '*');
				res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
				res.set('Access-Control-Max-Age', 1000);
				res.set('Access-Control-Allow-Headers', 'origin, x-csrftoken, content-type, accept');
				res.end();
				return;
			}

			if (url === this.rootPath) {
				ejs.renderFile(__dirname + '/../templates/services.ejs', {
					services: this.getServices(this.rootPath).map(s => s.getMetadata())
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
			} else if (url == this.rootPath + '/client' || url == this.rootPath + '/client.js') {
				fs.readFile(__dirname + '/../lib/client.js', {encoding: 'utf-8'}, function (err, text) {
					if (err) res.status(404).send('Error reading client library\n\n' + err);
					else {
						res.set('Content-Type', 'application/javascript');
						res.send(uglify(text, 'full'));
					}
				});
			} else if (url.indexOf(this.rootPath + '/static/') != -1) {
				const fileName = url.substring(url.lastIndexOf('/') + 1);

				if (fileName.indexOf('.js') != -1) {
					res.set('Content-Type', 'application/javascript');
				} else if (fileName.indexOf('.css') != -1) {
					res.set('Content-Type', 'text/css');
				}
				res.sendfile(path.resolve(__dirname + '/../static/' + fileName));
			} else {
				const serviceInstance = this.getServices(url);
				if (serviceInstance && req.method.toUpperCase() == 'GET' && serviceInstance.length == 1 && serviceInstance[0].path === url) {
					this.renderMetadataPage(serviceInstance[0], req, res);
				} else {
					next();
				}
			}
		};
	}

	addService(serviceInstance) {
		this.services.push(serviceInstance);
	}

	getServices(pathPrefix) {
		if (!pathPrefix) return this.services;

		return this.services.filter(service => service.path.startsWith(pathPrefix));
	}
}

const registries = new Map(); // rootPath: string -> registry: ServiceRegistry

module.exports = function(rootPath) {
	let registry = registries.get(rootPath);
	if (!registry) {
		registry = new ServiceRegistry(rootPath);
		registries.set(rootPath, registry);
	}
	return registry;
};
