'use strict';

const ejs = require('ejs');
const _ = require('lodash');
const getFilesContent = require('./file-utils').getFilesContent;

/**
 * Returns the html of the rendered metadata page.
 * @param options
 * @param options.isStatic {boolean} Indicates if the page should be static.
 * @param options.service {object} JSON-WS service instance.
 * @param options.root {string} Mount point of the service registry.
 * @returns {object} Promise
 */
function getPlaygroundPage(options) {

	return new Promise(function(resolve, reject) {
		// Render viewer/experiment page
		const examples = [];
		const service = options.service;
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
		let name = options.example;
		if (examples.indexOf(name) > -1) {
			code = service.methodMap[name].examples['JavaScript'];
		} else {
			name = options.snippet;
			if (snippets.indexOf(name) > -1) {
				code = service.snippetMap[name]['JavaScript'];
			}
		}

		let socketIoBackendTransportInstanceRegistered = false;
		if (options.registry && options.registry.transports) {
			for (const transport of options.registry.transports.values()) {
				if (transport.constructor.type === 'SocketIO') {
					socketIoBackendTransportInstanceRegistered = true;
					break;
				}
			}
		}

		const jsFiles = [
			'./client/jsonws-polyfill.js',
			'./client/transports/http.js',
			'./client/transports/ws.js',
			'./client/index.js'
		];

		if (socketIoBackendTransportInstanceRegistered) {
			// unminified use 'socket.io-client/dist/socket.io.js'
			jsFiles.push(require.resolve('socket.io-client/dist/socket.io.min.js'));
			jsFiles.push('./client/transports/socket-io.js');
		}

		const templateData = {
			metadata: service,
			constructorName: _.upperFirst(_.camelCase(service.name)),
			ejs,
			code,
			title: `${service.name} ${service.version}`,
			examples,
			snippets,
			jsFiles: getFilesContent(jsFiles)
		};

		// Render the metadata template
		ejs.renderFile(
			__dirname + '/../templates/viewer.ejs',
			templateData,
			{_with: false},
			(err, html) => {
				if (err) {
					return reject(err);
				}
				resolve(html);
			}
		);
	});
}

module.exports = getPlaygroundPage;
