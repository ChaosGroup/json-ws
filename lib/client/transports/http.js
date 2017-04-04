/* eslint-disable */
(function(module, require, define) {
	'use strict';

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

	function HttpTransport(url, sslSettings) {
		this.url = url;
		this.sslSettings = sslSettings || {};
		this.close = function () {};
	}
	inherits(HttpTransport, EventEmitter);

	HttpTransport.prototype.send = function (message, callback) {
		if (request) {
			var requestSettings = {
				body: JSON.stringify(message),
				encoding: null, // always get the body as a Buffer
				headers: { 'Content-Type': 'application/json' },
				url: this.url
			};
			for (var s in this.sslSettings) {
				if (this.sslSettings.hasOwnProperty(s)) {
					requestSettings[s] = this.sslSettings[s];
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
							var jsonBodyError = jsonBody.error;
							var errorInstance = new Error(jsonBodyError.data || jsonBody.message);
							errorInstance.data = jsonBodyError.data;
							errorInstance.code = jsonBodyError.code;
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
			var xhr = new XMLHttpRequest();
			xhr.open('POST', this.url, true);
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
					if (contentType && contentType.indexOf('application/json') != -1) {
						var data = JSON.parse(utf8ArrayToStr(new Uint8Array(xhr.response)));
						if (data && data.result !== undefined) {
							callback(null, data.result);
						} else {
							var dataError = data.error;
							var errorInstance = new Error(dataError.data || dataError.message);
							errorInstance.data = dataError.data;
							errorInstance.code = dataError.code;
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
		}
	};
}.apply(null, (function() {
	'use strict';

	if (typeof window !== 'undefined') {
		if (typeof window.jsonws === 'undefined') {
			throw new Error('No json-ws polyfills found.');
		}

		var jsonws = window.jsonws;

		return [jsonws, jsonws.require, jsonws.define];
	}

	// else assume node.js:
	return [module, require, function() {}];
}())));
