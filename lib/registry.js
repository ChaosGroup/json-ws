/**
 * JSON-WS Service Registry
 */

'use strict';

const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const ujs = require('uglify-js');
const url = require('url');
const crypto = require('crypto');
const express = require('express');
const semver = require('semver');

const getLanguageProxy = require('./get-language-proxy');
const Trace = require('./trace');

const BaseTransport = require('./transport/base-transport');

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
	constructor(options) {
		this.rootPath = options.rootPath.replace(/\/*$/, '');
		this.httpServer = options.httpServer;
		this.trace = new Trace(options.logger);
		this.services = new Map(/*serviceRootPrefix:Service*/);
		this.transports = new Set(/*Transport*/);
		this.routes = new Set(/* rootPath-prefixed routes */);

		this.router = express.Router({caseSensitive: true}); // eslint-disable-line new-cap
		this.router.use((req, res, next) => { this._routeHandler(req, res, next); });
		this.rootRouter = express.Router({caseSensitive: true}); // eslint-disable-line new-cap
		this.rootRouter.use(this.rootPath, (req, res, next) => { req.originalParams = req.params; next(); });
		this.rootRouter.use(this.rootPath, this.router);

		this._customRootHandler = null;
		this.rootRouter.use(this.rootPath, (req, res, next) => {
			if (typeof this._customRootHandler === 'function') {
				this._customRootHandler(req, res, next);
			} else {
				next();
			}
		});

		this.addRoute(''); // Handle the rootPath
	}

	setCustomRootHandler(handler) {
		if (typeof handler === 'function') {
			this._customRootHandler = handler;
		} else {
			throw new Error('The custom root handler must be a function');
		}
	}

	getRouter() {
		return this.rootRouter;
	}

	addRoute(route) {
		route = route.replace(/\/*$/, '');
		const rootPathPrefixedRoute = `${this.rootPath}${route}`;

		// Don't add routes more than once:
		if (this.routes.has(rootPathPrefixedRoute)) {
			return;
		}

		this.routes.add(rootPathPrefixedRoute);
		this.router.all(`${route}/*`, (req, res, next) => {
			req.originalParams = Object.assign({}, req.originalParams, req.params);
			next();
		});
		this.rootRouter.use(rootPathPrefixedRoute, this.router);
	}

	addService(service) {
		const version = semver(service.version);
		const rootPrefix = `/${service.name}/${version.major}.${version.minor}`;
		this.services.set(rootPrefix, service);
		return rootPrefix;
	}

	addTransport(constructorOrInstance) {
		let transportInstance, TransportConstructor;
		if (constructorOrInstance instanceof BaseTransport) {
			transportInstance = constructorOrInstance;
			TransportConstructor = transportInstance.constructor;
		} else if (BaseTransport.isPrototypeOf(constructorOrInstance)) {
			TransportConstructor = constructorOrInstance;
		} else {
			throw new Error('Invalid transport.');
		}
		// Don't add a transport more than once
		for (const transport of this.transports.values()) {
			if (transport.constructor === TransportConstructor) {
				throw new Error(`Transport ${TransportConstructor.type} has already been added.`);
			}
		}
		if (!transportInstance) {
			transportInstance = new TransportConstructor(this);
		}
		this.transports.add(transportInstance);
		return transportInstance;
	}

	_renderMetadataPage(service, req, res) {
		if (req.query.json !== undefined) {
			// Handle the "?json" query, return an API description in JSON format
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.write(JSON.stringify(service.metadata));
			res.end();
			return;
		}

		if (req.query.proxy !== undefined) {
			// Generate a proxy file
			let signature = service.timeStamp;
			['proxy', 'namespace', 'localName'].forEach(param => {
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
				localName: req.query.setNamespace || req.query.localName
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
				title: `${service.name} ${service.version.raw}`,
				url: service.path,
				examples,
				snippets,
				code,
				client: fs.readFileSync(__dirname + '/../lib/client.js')
			}, { _with: false }, function (err, file) {
				res.send(err ? err.toString() : file);
			});
		} else {
			// Find out list of proxy generators
			fs.readdir(__dirname + '/../proxies/', (err, files) => {
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
					}, {_with: false}, (err, html) => {
						if (err) {
							res.status(500).send(err.toString());
						} else {
							res.send(html);
						}
					});
			});
		}
	}

	_routeHandler(req, res, next) {
		if (req.method.toUpperCase() == 'OPTIONS') {
			res.set('Access-Control-Allow-Origin', '*');
			res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
			res.set('Access-Control-Max-Age', 1000);
			res.set('Access-Control-Allow-Headers', 'origin, x-csrftoken, content-type, accept');
			res.end();
			return;
		}

		const requestUrl = url.parse(req.path).pathname || '';
		if (requestUrl === '/') {
			if (typeof this._customRootHandler === 'function') {
				this._customRootHandler(req, res, next);
			} else {
				ejs.renderFile(__dirname + '/../templates/services.ejs', {
					services: Array.from(this.services.entries()).map(entry => ({
						path: `${req.baseUrl}${entry[0]}`,
						metadata: entry[1]
					}))
				}, {_with: false}, function (err, html) {
					if (err) {
						res.status(500).send(err.toString());
					} else {
						res.set('Content-Type', 'text/html');
						res.set('Content-Length', html.length);
						res.set('Cache-Control', 'must-revalidate');
						res.send(html);
					}
				});
			}
		} else if (requestUrl == '/client' || requestUrl == '/client.js') {
			fs.readFile(__dirname + '/../lib/client.js', {encoding: 'utf-8'}, function (err, text) {
				if (err) res.status(404).send('Error reading client library\n\n' + err);
				else {
					res.set('Content-Type', 'application/javascript');
					res.send(uglify(text, 'full'));
				}
			});
		} else if (requestUrl.indexOf('/static/') != -1) {
			const fileName = requestUrl.substring(requestUrl.lastIndexOf('/') + 1);
			if (fileName.indexOf('.js') != -1) {
				res.set('Content-Type', 'application/javascript');
			} else if (fileName.indexOf('.css') != -1) {
				res.set('Content-Type', 'text/css');
			}
			res.sendFile(path.resolve(__dirname + '/../static/' + fileName));
		} else {
			const serviceInstance = this.getService(requestUrl);
			if (serviceInstance && req.method.toUpperCase() == 'GET') {
				this._renderMetadataPage(serviceInstance, req, res);
			} else {
				next();
			}
		}
	}

	getService(pathPrefix) {
		return this.services.get(pathPrefix);
	}
}

const registries = new Map(); // rootPath: string -> registry: ServiceRegistry

/**
 * API Registry middleware for Express/Connect
 * Responds to OPTIONS request, renders a page listing all registered services
 * and serves the NodeJS/browser client library.
 * @param {String} rootPath Mount point of the service registry.
 */
module.exports = function(options) {
	let registry = registries.get(options.rootPath);
	if (!registry) {
		registry = new ServiceRegistry(options);
		registries.set(options.rootPath, registry);
	}
	return registry;
};
