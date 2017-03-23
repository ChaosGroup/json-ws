/**
 * Abstract class to be extended by Web Socket transports
 */

'use strict';

const BaseTransport = require('./base-transport');
const pathToRegExp = require('path-to-regexp');

class WebSocketBaseTransport extends BaseTransport {
	constructor(registry) {
		super(registry);
		this.registry.httpServer.on('connection', socket => {
			this.onConnect(socket);
			socket.on('close', () => {
				this.onDisconnect(socket);
			});
		});
	}

	onConnect(context) {
		this.trace.connect(context);
		this.emit('connect', context);
	}

	onDisconnect(context) {
		this.trace.disconnect(context);
		this.emit('disconnect', context);

		// Un-subscribe events:
		for (const eventContextMapEntry of this.eventContextMap.entries()) {
			const eventContextMapKey = eventContextMapEntry[0];
			const eventContextSet = eventContextMapEntry[1];

			if (eventContextSet.has(context)) {
				eventContextSet.delete(context);

				if (eventContextSet.size === 0) {
					const eventListener = this.eventListeners.get(eventContextMapKey);
					const service = this.eventContextServices.get(eventContextMapKey);

					if (eventListener) {
						const eventName = eventContextMapKey.substr(eventContextMapKey.indexOf(':') + 1);
						service.removeListener(eventName, eventListener);
					}

					this.eventContextMap.delete(eventContextMapKey);
					this.eventListeners.delete(eventContextMapKey);
					this.eventContextServices.delete(eventContextMapKey);
				}
			}
		}
	}

	/**
	 * @param url
	 * @returns {*}
	 * @private
	 */
	_getServiceAndParams(url) {
		for (const route of this.registry.routes) {
			const routeParser = pathToRegExp(`${route}/:_service/:_version`);
			const execResult = routeParser.exec(url);

			if (!execResult) {
				continue;
			}

			const result = routeParser.keys.reduce(function(current, paramKey, paramIndex) {
				current[paramKey.name] = execResult[paramIndex + 1];

				return current;
			}, {});

			const service = this.registry.getService(`/${result._service}/${result._version}`);
			if (service) {
				delete result._service;
				delete result._version;
				return {
					params: result,
					service
				};
			}
		}

		return null;
	}
}

module.exports = WebSocketBaseTransport;
