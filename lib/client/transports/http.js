/* eslint-disable */
(function(module, define) {
	// using non-strict mode, otherwise the re-assignment of require would throw TypeError
	if (typeof require !== 'function') {
		require = module.require;
	}

	// Polyfill request with null in the browser,
	// to use XMLHttpRequest in the "send" method below:
	define('request', null);

	var EventEmitter = require('events');
	var inherits = require('util').inherits;
	var request = require('request');

	// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
	/* utf.js - UTF-8 <=> UTF-16 convertion
	 *
	 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
	 * Version: 1.0
	 * LastModified: Dec 25 1999
	 * This library is free.  You can redistribute it and/or modify it.
	 */
	function utf8ArrayToStr(array) {
		var out, i, len, c;
		var char2, char3;

		out = '';
		len = array.length;
		i = 0;
		while (i < len) {
			c = array[i++];
			switch(c >> 4)
			{
				case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
				// 0xxxxxxx
				out += String.fromCharCode(c);
				break;
				case 12: case 13:
				// 110x xxxx   10xx xxxx
				char2 = array[i++];
				out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
				break;
				case 14:
					// 1110 xxxx  10xx xxxx  10xx xxxx
					char2 = array[i++];
					char3 = array[i++];
					out += String.fromCharCode(((c & 0x0F) << 12) |
						((char2 & 0x3F) << 6) |
						((char3 & 0x3F) << 0));
					break;
			}
		}

		return out;
	}

	module.exports = HttpTransport;
	// Defined with this name to keep node.js compatibility:
	define('./transports/http', HttpTransport);

	function HttpTransport(url, settings) {
		this.url = url;
		this.settings = settings || {};
	}
	inherits(HttpTransport, EventEmitter);

	Object.defineProperty(HttpTransport.prototype, 'name', {
		value: 'http'
	});

	HttpTransport.prototype.close = function() {};

	HttpTransport.prototype.send = function (message, callback) {
		// checking for XMLHttpRequest first, it's the default for the browser
		// On older Safari browser the type of XMLHttpRequest is "object"...
		if (typeof XMLHttpRequest === 'function' || typeof XMLHttpRequest === 'object') {
			var xhr = new XMLHttpRequest();
			xhr.open('POST', this.url, true);
			if (this.settings.xhrFields) {
				for (var s in this.settings.xhrFields) {
					if (this.settings.xhrFields.hasOwnProperty(s)) {
						xhr[s] = this.settings.xhrFields[s];
					}
				}
			}
			xhr.responseType = 'arraybuffer';
			xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
			xhr.onreadystatechange = function () {
				if (xhr.readyState != 4) {
					return;
				}
				//request failed handling
				if (xhr.status === 0) {
					callback(new Error('Request failed'));
					return;
				}
				if (xhr.response && xhr.response.byteLength > 0) {
					var contentType = xhr.getResponseHeader('content-type');
					if (contentType && contentType.indexOf('application/json') !== -1) {
						var data = JSON.parse(utf8ArrayToStr(new Uint8Array(xhr.response)));
						if (data && data.result !== undefined) {
							callback(null, data.result);
						} else {
							var error = data.error;
							var errorMessage = error.data && error.data.message;
							var errorInstance = new Error(errorMessage || error.message);
							errorInstance.data = error.data;
							errorInstance.code = error.code;
							callback(errorInstance);
						}
					} else {
						callback(null, xhr.response);
					}
				} else {
					callback(xhr.statusText);
				}
			};
			xhr.send(JSON.stringify(message));
		} else if (typeof request === 'function') {
			var requestSettings = {
				body: JSON.stringify(message),
				encoding: null, // always get the body as a Buffer
				headers: { 'Content-Type': 'application/json' },
				url: this.url
			};
			for (var s in this.settings) {
				if (this.settings.hasOwnProperty(s)) {
					requestSettings[s] = this.settings[s];
				}
			}
			request.post(requestSettings, function (error, response, body) {
				if (typeof callback === 'function') {
					var contentType = response ? response.headers['content-type'] : null;
					var isJSON = contentType && contentType.indexOf('application/json') !== -1;
					if (error || (response && response.statusCode !== 200 && !isJSON)) {
						callback(error || new Error(requestSettings.url + ' responded with ' + response.statusCode), null);
					} else if (body) {
						if (!isJSON) {
							// send buffer response
							callback(null, body);
							return;
						}
						var jsonBody = null;
						try {
							jsonBody = JSON.parse(body);
						} catch (jsonParseError) {
							callback(jsonParseError);
							return;
						}
						if (jsonBody.result !== undefined) {
							callback(null, jsonBody.result);
						} else if (jsonBody.error) {
							var jsonError = jsonBody.error;
							var errorMessage = jsonError.data && jsonError.data.message;
							var errorInstance = new Error(errorMessage || jsonError.message);
							errorInstance.data = jsonError.data;
							errorInstance.code = jsonError.code;
							callback(errorInstance);
						} else {
							callback(new Error('Empty response.'));
						}
					} else {
						callback(new Error('Empty response.'));
					}
				}
			});
		} else {
			throw new Error('json-ws client transport http needs a way to make requests - "XMLHttpRequest" or "request".');
		}
	};
}.apply(null, (function() {
	'use strict';

	if (typeof module !== 'undefined') {
		// node.js and webpack
		return [module, function() {}];
	}

	if (typeof window !== 'undefined') {
		// browser
		if (typeof window.jsonws === 'undefined') {
			throw new Error('No json-ws polyfills found.');
		}

		var jsonws = window.jsonws;

		return [jsonws, jsonws.define];
	}

	throw new Error('Unknown environment, this code should be used in node.js/webpack/browser');
}())));
