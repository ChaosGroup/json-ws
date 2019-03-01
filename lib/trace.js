'use strict';

const url = require('url');
const ServiceError = require('./error');

class Trace {
	constructor(bunyanLogger) {
		this._enabled = !!bunyanLogger;
		this._logger = bunyanLogger;
	}

	_stringify(object) {
		if (!this._enabled) {
			return null;
		}

		return JSON.stringify(
			object,
			function(key, value) {
				if (value instanceof Buffer) {
					return '(buffer)';
				} else if (value instanceof Array && value.length > 1000) {
					return '(large array)';
				} else if (typeof value == 'string' && value.length > 1000) {
					return '(large string)';
				} else if (value instanceof url.Url) {
					return value.format();
				}
				return value;
			},
			2
		);
	}

	/**
	 * Logs the given message if the logger is enabled, using the appropriate logLevel
	 * The default logLevel is "trace"
	 *
	 * @param {object} context
	 * @param {string} message
	 * @param {object} [logFields={}]
	 * @param {string} [logLevel="trace"]
	 * @private
	 */
	_log(context, message, logFields = {}, logLevel = 'trace') {
		if (this._enabled) {
			this._logger[logLevel](logFields, `[JSON-WS] client :: ${message}`);
		}
	}

	connect(context) {
		this._log(context, 'connected');
	}

	disconnect(context) {
		this._log(context, 'disconnected');
	}

	call(context, methodInfo, args) {
		this._log(context, `method "${methodInfo.name}" call`, {
			method: methodInfo.name,
			args: this._stringify(args, null, 2),
		});
	}

	response(context, methodInfo, value) {
		this._log(context, `method "${methodInfo.name}" response`, {
			method: methodInfo.name,
			return: this._stringify(value, null, 2),
		});
	}

	error(context, methodInfo, error) {
		let logFields = { stack: error.stack };

		if (error instanceof ServiceError) {
			logFields = error.logFields();
		}
		if (methodInfo) {
			logFields.method = methodInfo.name;
		}

		this._log(context, error.message, logFields, 'error');
	}

	event(context, eventInfo, args) {
		this._log(context, `event: "${eventInfo.name}"`, {
			event: eventInfo.name,
			args: this._stringify(args, null, 2),
		});
	}

	subscribe(context, eventInfo) {
		this._log(context, `subscribed to event "${eventInfo.name}"`, { event: eventInfo.name });
	}

	unsubscribe(context, eventInfo) {
		this._log(context, `unsubscribed from event "${eventInfo.name}"`, {
			event: eventInfo.name,
		});
	}
}

module.exports = Trace;
