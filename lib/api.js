/**
 * JSON-WS API definition module
 * Allows implementors to expose their APIs over some transport mechanism.
 */

'use strict';

var util = require("util");
var events = require("events");
var fs = require("fs");
var url = require('url');

try {
	var cowrap = (function() {
		var co = require('co');
		return co.wrap.bind(co);
	})()
} catch (requireError) {
	// automatic wrap of generator functions disabled
}

/**
 * Internal helpers dealing with methods and types
 */
var internals = (function () {
	var types = [
		['*', 'any'],
		['int', 'integer'],
		['number', 'float', 'double'],
		['date', 'time'],
		['bool', 'boolean'],
		['object', 'json'],
		'string',
		'url',
		['buffer', 'binary']
	];

	// Converter functions take a value, parse it and return a proper value for the expected type
	// The optional second argument, out, will be set to true if the type converter is called when
	// the value is to be sent out to clients, otherwise the function is called when a client initiates
	// an RPC call to the service

	var converters = [
		function (value) { /*any*/
			return value;
		},
		function (value) { /*int*/
			if (value === undefined) return value;
			var valueType = typeof value;
			if (valueType !== 'number' && valueType !== 'string') {
				throw new Error('Invalid integer value: ' + value);
			}
			return Math.floor(parseInt(value, 10))
		},
		function (value) { /*number*/
			if (value === undefined) return value;
			var valueType = typeof value;
			if (valueType !== 'number' && valueType !== 'string') {
				throw new Error('Invalid number value: ' + value);
			}
			return parseFloat(value) || 0.0
		},
		function (value) { /*date*/
			if (value === undefined || value === null) return value;
			var valueType = typeof value;
			if (valueType !== 'number' && valueType !== 'string' &&
				!(valueType == "object" && value instanceof Date)) {
				throw new Error('Invalid date value: ' + value);
			}
			return new Date(value);
		},
		function (value) { /*bool*/
			if (typeof value === 'string') {
				var lowercase = value.toLowerCase().trim();
				if (lowercase == 'true') return true;
				if (lowercase == 'false') return false;
				throw new Error('Invalid boolean value: ' + value);
			} else {
				return !!value;
			}
		},
		function (value) { /*object*/
			return typeof value === 'string' ? JSON.parse(value) : value;
		},
		function (value) { /*string*/
			return (typeof value === 'string' || value == null) ? value : JSON.stringify(value);
		},
		function (value, out) { /*url*/
			if (typeof value === 'string') {
				var parsedUrl = url.parse(value);
				if (!parsedUrl.protocol || !parsedUrl.hostname || !parsedUrl.path) {
					throw new Error('Invalid URL value: ' + value);
				}
				return out === true ? parsedUrl.format() : parsedUrl;
			} else if (value instanceof url.Url) {
				return value.format();
			} else if (value == null) {
				return null;
			} else {
				throw new Error('Invalid URL value: ' + value);
			}
		},
		function (value) { /*binary*/
			if (typeof value === 'string') {
				return new Buffer(value, 'base64');
			}
			if (!Buffer.isBuffer(value)) {
				throw new Error('Invalid buffer data.');
			}
			return value;
		}
	];

	var memo = {};

	function findType(typeName) {
		if (memo[typeName] != undefined) return memo[typeName];
		var typeIndex = -1;
		types.some(function (type, index) {
			var result = (Array.isArray(type) && type.indexOf(typeName) != -1) || (type === typeName);
			if (result)   typeIndex = index;
			return result;
		});
		return memo[typeName] = typeIndex;
	}

	var internals = {
		/**
		 * Checks if a given type name is considered/handled as internal.
		 * @param {String} typeName The name of the type.
		 * @returns {boolean}
		 */
		isInternal: function (typeName) {
			return typeName === 'async' || findType(typeName) != -1;
		},

		/**
		 * Gets a function which returns a raw value to an internal type.
		 * @param {String} typeName The name of the internal type.
		 * @returns {Function} The converter function.
		 */
		converter: function (typeName) {
			var typeIndex = findType(typeName);
			if (typeIndex == -1) throw new Error('The specified type (' + typeName + ') is not internal.');
			return converters[typeIndex];
		},

		/**
		 * Creates a type descriptor struct out of a type definition.
		 * @param typeDef A type definition object.
		 * @param {String} typeDef.type The name of the type.
		 * @param {Function} checkTypeExistsFn A function which must check if a given type is defined in the API
		 * @returns {{}}
		 */
		typeStructFromDef: function (typeDef, checkTypeExistsFn) {
			var struct = {};
			Object.keys(typeDef).forEach(function (field) {
				var fieldInfo = typeDef[field];
				if (typeof fieldInfo == 'string') {
					fieldInfo = { type: fieldInfo };
				} else if (Array.isArray(fieldInfo)) {
					fieldInfo = { type: fieldInfo[0], isArray: true };
				} else if (typeof fieldInfo !== 'object') {
					throw new Error('Invalid type field struct for field: ' + fieldInfo);
				} else if (Array.isArray(fieldInfo.type)) {
					fieldInfo.type = fieldInfo.type[0];
					fieldInfo.isArray = true;
				}

				if (!fieldInfo.type) {
					throw new Error('Missing type for field: ' + field);
				}

				if (typeof fieldInfo.type !== 'string') {
					throw new Error('Invalid type field struct for field: ' + fieldInfo);
				}

				if (!internals.isInternal(fieldInfo.type) && !checkTypeExistsFn(fieldInfo.type)) {
					throw new Error('Referenced type "' + fieldInfo.type + '" is undefined.');
				}

				struct[field] = {
					'name': field,
					'type': fieldInfo.type,
					'isArray': !!fieldInfo.isArray,
					'required': fieldInfo.required != undefined ? !!fieldInfo.required : true,
					'default': fieldInfo.default,
					'description': fieldInfo.description || internals.missingDocumentation
				};
			});
			return struct;
		},

		methodNotImplemented: function (name) {
			return function () {
				throw new Error("'" + name + "' is not yet implemented.");
			};
		},

		/**
		 * Check if `obj` is a promise.
		 *
		 * @param {Object} obj
		 * @return {Boolean}
		 * @api private
		 */
		isPromise: function isPromise(obj) {
			return 'function' == typeof obj.then;
		},

		/**
		 * Check if `obj` is a generator.
		 *
		 * @param {Mixed} obj
		 * @return {Boolean}
		 * @api private
		 */
		isGenerator: function isGenerator(obj) {
			return 'function' == typeof obj.next && 'function' == typeof obj.throw;
		},

		/**
		 * Check if `obj` is a generator function.
		 *
		 * @param {Mixed} obj
		 * @return {Boolean}
		 * @api private
		 */
		isGeneratorFunction: function isGeneratorFunction(obj) {
			var constructor = obj.constructor;
			if (!constructor) return false;
			if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
			return internals.isGenerator(constructor.prototype);
		}
	};

	Object.defineProperty(internals, 'missingDocumentation', {
		get: function () {
			return '';
		}
	});

	return internals;
}());

/**
 * API constructor
 * @param {String} version The API version tag.
 * @param {String} friendlyName A string which identifies the API.
 */
function Service(version, friendlyName) {
	if (!version || !friendlyName) {
		throw new Error('API version and name must be supplied.');
	}

	Object.defineProperty(this, "version", {
		get: function () {
			return version
		}
	});
	this.friendlyName = friendlyName;
	this.timeStamp = new Date().getTime();
	this.description = '';

	this.groups = {};
	this.currentGroup = null;
	this.group('Default');

	this.currentThisObj = null;
	this.currentNamespace = "";

	this.methodMap = {};
	this.methods = this.fn = {};

	this.typeMap = {};
	this.eventMap = {};

	this.transports = [];
	this.path = "";
	this.snippetMap = {};
	this.languages = [];
}
util.inherits(Service, events.EventEmitter);

/**
 * Marks the beginning of a new method group. If the group had been initialised previously it will be reused.
 * @param {String} groupName The name of the group.
 * @param {String} [description] Descriptive text for the group.
 * @returns {Service} The current API instance.
 */
Service.prototype.group = function (groupName, description) {
	if (typeof groupName === 'string' && groupName.length) {
		this.currentGroup = this.groups[groupName] || (this.groups[groupName] = {
			name: groupName,
			description: description || '',
			items: []
		});
	}
	return this;
};

/**
 * Marks the beginning of a new method namespace. All methods defined from this point on will reside in this namespace.
 * @param {String} [namespace=""] A dot-separated namespace string, e.g. com.chaosgroup.jsonws.
 * @returns {Service} The current API instance.
 */
Service.prototype.namespace = function (namespace) {
	this.currentNamespace = namespace || "";
	return this;
};

/**
 * Convenience method for setting the current "this" object pointer for a group of methods.
 * @param {object} thisObj The this object.
 * @returns {Service} The current API instance.
 */
Service.prototype.setThis = function (thisObj) {
	this.currentThisObj = thisObj;
	return this;
};

/**
 * Validates parameters, extracts types if necessary
 * @param params
 */
Service.prototype._parseDefineParams = function (params) {
	var self = this;
	if (params && !Array.isArray(params)) {
		throw new Error('The params property must be an array.');
	}
	var parsedParams = [];
	var defaultParams = [];
	(params || []).forEach(function (param) {
		if (typeof param == 'string') {
			param = {
				'name': param,
				'type': '*'
			}
		}

		if (!param.name) {
			throw new Error('Unnamed method parameter.');
		}

		if (param.type) {
			if (Array.isArray(param.type)) {
				if (!param.type[0]) {
					throw new Error('Missing type for param ' + param.name);
				}
				param.type = param.type[0];
				param.isArray = true;
			}

			if (typeof param.type !== 'string') {
				throw new Error('Inline type definitions are not supported.');
			}

			if (!internals.isInternal(param.type) && !self.typeMap[param.type]) {
				throw new Error('Undefined type: ' + param.type);
			}

			// Uncomment to add support for type inlining
			/*if (typeof param.type == 'object') {
			 self.type(param.type.name, param.type.struct);
			 param.type = param.type.name;
			 }*/

			/* Uncomment to parse the default param value at definition time
			 * As it is, the default value will be converted by the transport each time when the target method is called
			 if (param.default !== undefined) {
			 param.default = self.type(param.type).convert(param.default);
			 }*/
		}

		var permissions;
		if (typeof param.permissions === 'undefined') {
			permissions = [];
		} else if (typeof param.permissions === 'string') {
			permissions = [param.permissions];
		} else if (Array.isArray(param.permissions)) {
			permissions = param.permissions;
		}
		(param.default !== undefined ? defaultParams : parsedParams).push({
			'name': param.name,
			'type': param.type || '*',
			'isArray': !!param.isArray,
			'default': param.default, // BH-144 Providing a default param value automatically makes this param optional
			'description': param.description || internals.missingDocumentation,
			'permissions': permissions
		});
	});

	return parsedParams.concat(defaultParams);
};

/**
 * Defines an RPC endpoint (method).
 * @param {*|String} options Either a string (the method's name) or an options object.
 * @param {String} options.name The name of the method.
 * @param {String} [options.description] Text describing the method.
 * @param {Boolean} [options.callback] Flag which specifies if a callback function should be given to this method.
 * If false, a value can be sent back to clients by returning a value, a Promise, or using a generator function.
 * True by default.
 *
 * @param [options.params] An array of JSON structures, each of which describes an input parameter
 * @param options.params.name The parameter's name.
 * @param options.params.type The parameter's type. If omitted 'any' is assumed.
 * @param options.params.default Optional default value for the parameter. If specified, the parameter becomes optional.
 * @param options.params.description Descriptive text for the parameter.
 *
 * @param {String} options.returns The method's return type, or 'async' if the method doesn't return a value, but still wants to notify its caller when its activity has finished.
 * @param {*} [options.this] An optional object that will be used as the 'this' object pointer during the RPC call.
 *
 * @param {Function} [fn] The function that will be called when an client makes an RPC call to this method.
 *
 * @returns {Service} The current API instance.
 */
Service.prototype.define = function (options, fn) {
	if (options && options.event) {
		throw new Error('Registering events using the define method is obsolete. Please use the event method instead.');
	}

	var self = this;

	if (typeof options === 'string') {
		options = {name: options};
	} else if (typeof options != 'object' || Array.isArray(options)) {
		throw new Error('Invalid definition options.');
	}

	if (!options.name) {
		throw new Error("Service methods MUST have a name.");
	}

	var methodName = options.name;

	if (this.currentNamespace) {
		methodName = this.currentNamespace + "." + methodName;
	}

	if (options.returns) {
		if (Array.isArray(options.returns)) {
			options.returns = options.returns[0];
			options.returnsArray = true;
		}
		if (!options.returns || (!internals.isInternal(options.returns) && !this.typeMap[options.returns])) {
			throw new Error('Undefined return type for method ' + methodName + ': ' + options.returns);
		}
	}

	// Makes a method callable within the service
	function mapMethods(methodName, fn) {
		var namespaces = methodName.split(".");
		methodName = namespaces[namespaces.length - 1];
		var last = self.methods;
		for (var i = 0; i < namespaces.length - 1; i++) {
			last = last[namespaces[i]] = last[namespaces[i]] || {};
		}
		last[methodName] = fn;
	}

	if (!this.methodMap[methodName]) {
		this.currentGroup.items.push('method:' + methodName);
		this.methodMap[methodName] = {};
	}

	var methodInfo = this.methodMap[methodName];

	methodInfo.name = methodName;
	methodInfo.description = options.description || methodInfo.description || internals.missingDocumentation;
	methodInfo.examples = methodInfo.examples || {};
	methodInfo.callback = options.callback !== undefined ? options.callback : true;

	if (!methodInfo.hasOwnProperty('this')) {
		Object.defineProperty(methodInfo, 'this', {
			configurable: false,
			enumerable: false,
			writable: true
		});
	}
	methodInfo["this"] = options["this"] || this.currentThisObj || methodInfo["this"] || null;

	if (!methodInfo.hasOwnProperty('_returns')) {
		Object.defineProperty(methodInfo, '_returns', {
			configurable: false,
			enumerable: false,
			writable: true
		});
	}
	methodInfo._returns = options.returns || methodInfo._returns || null;

	if (!methodInfo.hasOwnProperty('returns') && methodInfo._returns) {
		Object.defineProperty(methodInfo, 'returns', {
			configurable: false,
			enumerable: true,
			get: function () {
				return methodInfo._returns === 'async' ? undefined : methodInfo._returns;
			}
		});
		methodInfo.returnsArray = !!(options.returnsArray || methodInfo.returnsArray);
	}

	if (!methodInfo.hasOwnProperty('async')) {
		Object.defineProperty(methodInfo, 'async', {
			configurable: false,
			enumerable: false,
			get: function () {
				return methodInfo._returns === 'async';
			}
		});
	}

	if (!methodInfo.params || methodInfo.params.length == 0) {
		methodInfo.params = this._parseDefineParams(options.params);
	}

	if (methodInfo.fn == undefined || fn) {
		if (!fn || typeof fn !== 'function') {
			methodInfo.fn = options["this"]
				? (function() {
					var self = options["this"];
					var mappedMethodName = typeof fn === 'string' ? fn: methodName;
					var remappedFn = self[mappedMethodName];
					if (typeof remappedFn !== 'function') {
						return function() {
							throw new Error(util.format("Invalid method invocation: %s.", methodName));
						};
					} else if (cowrap && internals.isGeneratorFunction(remappedFn)) {
						return cowrap(remappedFn).bind(self);
					} else {
						return remappedFn.bind(self);
					}
				})()
				: internals.methodNotImplemented(methodName);
		} else if (cowrap && internals.isGeneratorFunction(fn)) {
			methodInfo.fn = cowrap(fn).bind(methodInfo["this"]);
		} else {
			methodInfo.fn = fn.bind(methodInfo["this"]);
		}

		mapMethods(methodName, methodInfo.fn);
	}

	if (!methodInfo.hasOwnProperty('authenticate')) {
		methodInfo.authenticate = options.security !== "anonymous";
	}

	return this;
};

/**
 * Registers a type/enum or returns its metadata.
 * @param {String} typeName The full name of the type.
 * @param [typeDef] A type/enum definition object.
 * @param {String} [description] Descriptive text.
 * @param {Boolean} [isEnum] Flag indicating if we are registering an enum vs. an ordinary type (structure).
 * @returns {{type: String, convert: Function}}
 */
Service.prototype.type = function (typeName, typeDef, description, isEnum) {
	var self = this;

	if (!typeName) {
		throw new Error('Types must have a name.');
	}

	if (!typeDef) {
		if (internals.isInternal(typeName) && !this.typeMap[typeName]) {
			return { type: typeName, convert: internals.converter(typeName) };
		}
		if (!this.typeMap[typeName]) {
			throw new Error('Type "' + typeName + '" is undefined.');
		}
		return this.typeMap[typeName];
	}

	if (internals.isInternal(typeName)) {
		throw new Error('Internal types cannot be overriden.');
	}

	if (self.typeMap[typeName]) {
		throw new Error('Types cannot be overriden.');
	}

	var typeStruct = isEnum ? typeDef : internals.typeStructFromDef(typeDef, function (typeToCheck) {
		return !!self.typeMap[typeToCheck];
	});

	if (isEnum) {
		if (typeof typeStruct !== 'object') {
			throw new Error('Enum definition must be an object');
		}
		if (Object.keys(typeStruct).length == 0) {
			throw new Error('Empty enums are not allowed: ' + typeName);
		}
		if (Object.keys(typeStruct).some(function (enumKey) {
			return typeof typeStruct[enumKey] !== 'number'
		})) {
			throw new Error('Enum values must be numbers.');
		}
	}

	this.typeMap[typeName] = {
		'name': typeName,
		'description': description || internals.missingDocumentation,
		'enum': isEnum,
		'struct': typeStruct,
		'convert': typeConverter
	};

	this.currentGroup.items.push('type:' + typeName);

	function typeConverter(value, out) {
		if (isEnum) {
			if (typeof value !== 'number' && typeof value !== 'string') {
				throw new Error('Invalid value for enum ' + typeName + ' - only numbers or strings are allowed.');
			}
			var returnValueAsKey = value;
			if (!Object.keys(typeStruct).some(function (enumKey) {
				return value === enumKey || (typeStruct[enumKey] === value && (returnValueAsKey = enumKey))
			})) {
				throw new Error('Unknown enum ' + typeName + ' value: ' + value);
			}
			return returnValueAsKey; // typeof value === 'number' ? value : typeStruct[value];
		}

		if (typeof value !== 'object') {
			throw new Error('Simple value cannot be converted to type ' + typeName);
		}

		var result = {};
		Object.keys(typeStruct).forEach(function (field) {
			var fieldInfo = typeStruct[field];
			var fieldValue = value[field];

			if (fieldValue == null || fieldValue == undefined) {
				if (fieldInfo.required) {
					throw new Error('Required field has no value: ' + field);
				}
				fieldValue = fieldValue !== undefined ? fieldValue : fieldInfo.default;
			}

			if (fieldValue == null || fieldValue == undefined) {
				result[field] = internals.isInternal(fieldInfo.type)
					? self.type(fieldInfo.type).convert(fieldValue, out)
					: fieldValue;
				return;
			}

			if (fieldInfo.isArray) {
				if (!Array.isArray(fieldValue)) {
					throw new Error('Field ' + field + ' must be an array.');
				}
				var arrayType = self.type(fieldInfo.type);
				result[field] = fieldValue.map(function (arrayValue) {
					return arrayType.convert(arrayValue, out);
				});
			} else {
				result[field] = self.type(fieldInfo.type).convert(fieldValue, out);
			}
		});

		return result;
	}

	return this;
};

/**
 * Defines an event that can be emitted to clients.
 * @param {String} eventName the name of the event (e.g. 'imageReady')
 * @param eventInfo A JSON structure with the event options, or a string holding descriptive text.
 * @returns {Service} The current API instance.
 */
Service.prototype.event = function (eventName, eventInfo) {
	if (!eventName) {
		throw new Error("Service events MUST have a name.");
	}

	if (this.currentNamespace) {
		eventName = this.currentNamespace + "." + eventName;
	}

	if (this.eventMap[eventName]) {
		throw new Error("Overriding events is not allowed: " + eventName);
	}

	eventInfo = eventInfo || {};

	if (typeof eventInfo === 'string') {
		eventInfo = { description: eventInfo };
	}

	if (typeof eventInfo !== 'object' || Array.isArray(eventInfo)) {
		throw new Error('Event options must be an object.');
	}

	if (eventInfo.type) {
		if (Array.isArray(eventInfo.type)) {
			eventInfo.type = eventInfo.type[0];
			eventInfo.isArray = true;
		}
		if (!eventInfo.type || (!internals.isInternal(eventInfo.type) && !this.typeMap[eventInfo.type])) {
			throw new Error('Undefined event type for event ' + eventName + ': ' + eventInfo.type);
		}
	}

	this.eventMap[eventName] = {
		name: eventName,
		type: eventInfo.type || null,
		isArray: !!eventInfo.isArray,
		description: eventInfo.description || internals.missingDocumentation
	};

	this.currentGroup.items.push('event:' + eventName);

	return this;
};

/**
 * Defines an enum using a set of values
 * @param {String} enumName The name of the new enum.
 * @param [values] A JSON structure or an array of string literals which holds the enum's values .
 * @param {String} [description] Enum descriptive text.
 * @returns {{type: String, convert: Function}}
 */
Service.prototype.enum = function (enumName, values, description) {
	if (Array.isArray(values)) {
		// BH-129 Remap array values to object keys
		values = (function () {
			var o = {};
			for (var i = 0; i < values.length; i++) {
				o[values[i]] = i;
			}
			return o;
		}());
	}
	return this.type(enumName, values, description, true);
};

/**
 * Exposes methods of an object on the API
 * @param {*} obj An object whose functions will be mapped on top of the API.
 * @param {String[]} [methodNames] A list of method names to include from the target object.
 * @returns {Service} The current API instance.
 */
Service.prototype.defineAll = function (obj, methodNames) {
	if (!obj) return this;
	var oldThisObj = this.currentThisObj;
	this.setThis(obj);
	for (var i in obj) {
		if (typeof obj[i] !== 'function' || i.substr(0, 1) === '_' || (methodNames && methodNames.indexOf(i) == -1)) {
			continue;
		}
		this.define(i, obj[i]);
	}
	return this.setThis(oldThisObj);
};

/**
 * Imports API metadata from an external file.
 * @param {String|*} importSite Absolute path to the external file containing API definitions.
 * @param {String[]} [whiteList]
 * @returns {Service} The current API instance.
 */
Service.prototype.import = function (importSite, whiteList) {
	var self = this;
	var defs;

	if (typeof importSite === 'string') {
		try {
			defs = require(importSite);
		} catch (err) {
			throw new Error('Failed to parse import file: ' + importSite);
		}

		if (typeof defs === 'function') {
			// External file defines a setup function -- call this giving it the current API instance
			defs(this);
			return this;
		}

		if (typeof defs !== 'object') {
			throw new Error('Import file contains invalid data: ' + importSite);
		}
	} else if (typeof importSite === 'object') {
		defs = importSite;
	} else {
		throw new Error('Unsupported import site: ' + importSite);
	}

	var deps = {};
	var lists = {
		enums: [],
		types: [],
		events: [],
		methods: []
	};
	var typePlaceHolder = '**__placeholder__**';
	var currentGroup = { name: 'Default', description: '' };
	var filterWhiteList = whiteList && Array.isArray(whiteList) && whiteList.length > 0 ? function (prefix, item) {
		return whiteList.indexOf(prefix + item.name) != -1;
	} : function () {
		return true;
	};

	function forward(typeName, typeInfo) {
		var typeDeps = deps[typeName] || (deps[typeName] = []);
		try {
			typeInfo = internals.typeStructFromDef(typeInfo.struct, function () {
				return true;
			});
		} catch (typeInfoParseError) {
			throw typeInfoParseError;
		}
		for (var propertyName in typeInfo) {
			var propertyInfo = typeInfo[propertyName];
			var typeMapInfo = self.typeMap[propertyInfo.type];
			if (internals.isInternal(propertyInfo.type) || (typeMapInfo && typeMapInfo !== typePlaceHolder)) {
				// skip internal types or ones which are already defined
				continue;
			}
			if (typeDeps.indexOf(propertyInfo.type) == -1) {
				typeDeps.push(propertyInfo.type);
				self.typeMap[propertyInfo.type] = typePlaceHolder;
			}
		}
	}

	function prepass(defs, level) {
		Object.keys(defs).forEach(function (key) {
			if (key == 'events' || key == 'methods') {
				Object.keys(defs[key])
					.forEach(function (name) {
						lists[key].push({
							name: name,
							group: currentGroup,
							data: defs[key][name]
						});
					});
			} else if (key == 'enums' || key == 'types') {
				Object.keys(defs[key]).forEach(function (typeName) {
					if (key == 'types') {
						forward(typeName, defs.types[typeName])
					}
					else {
						self.typeMap[typeName] = typePlaceHolder
					}
					var lastIdx = lists.types.push({
						name: typeName,
						group: currentGroup,
						isEnum: key == 'enums',
						data: defs[key][typeName]
					});
					lists.types[typeName] = lists.types[lastIdx - 1];
				});
			} else if (key == 'description') {
				if (typeof defs[key] === 'string') {
					(level == 0 ? self : currentGroup).description = defs[key];
				}
			} else if (key == 'import') {
				var importList = Array.isArray(defs[key]) ? defs[key] : [defs[key]];
				importList.forEach(function(importItem) {
					if (typeof importItem == 'object') {
						var whiteList = importItem.list;
						if (whiteList && !Array.isArray(whiteList)) {
							whiteList = [whiteList];
						}
						self.import(importItem.file, whiteList);
					} else { // Assume this is a file path
						self.import(importItem);
					}
				});
			} else {
				var oldGroup = currentGroup;
				currentGroup = { name: key, description: '' };
				prepass(defs[key], level + 1);
				currentGroup = oldGroup;
			}
		});
	}

	function applyGroup(group, fn) {
		var oldGroup = self.currentGroup;
		self.group(group.name, group.description);
		fn();
		self.group(oldGroup.name, oldGroup.description);
	}

	function importTypeWithDependencies(chain, item) {
		var typeName = item.name, typeInfo = item.data;
		if (chain.indexOf(typeName) != -1) {
			// Note: Uncomment the code below to disallow circular references
			/*console.log(chain, ' -> ', typeName)
			 throw new Error('Circular references are not allowed');*/
			return;
		}
		applyGroup(item.group, function () {
			chain.push(typeName);
			(deps[typeName] || []).forEach(function (referencedType) {
				if (self.typeMap[referencedType] === typePlaceHolder) {
					if (!lists.types[referencedType]) {
						throw new Error('Could not find a declaration for the following type: ' + referencedType);
					}
					importTypeWithDependencies(chain, lists.types[referencedType]);
				}
			});
			if (!self.typeMap[typeName] || self.typeMap[typeName] === typePlaceHolder) {
				delete self.typeMap[typeName];
				self[item.isEnum ? 'enum' : 'type'](typeName, typeInfo.struct, typeInfo.description);
			}
			chain.pop();
		});
	}

	prepass(defs, 0);

	lists.enums.filter(filterWhiteList.bind(null, 'enum:')).forEach(function (item) {
		applyGroup(item.group, function () {
			self.enum(item.name, item.data.struct, item.data.description);
		});
	});

	lists.types.filter(filterWhiteList.bind(null, 'type:')).forEach(importTypeWithDependencies.bind(null, []));

	Object.keys(self.typeMap).forEach(function (typeName) {
		if (self.typeMap[typeName] == typePlaceHolder) {
			if (filterWhiteList('type:', typeName) || filterWhiteList('enum:', typeName)) {
				throw new Error('Failed to import type: ' + typeName);
			}
			delete self.typeMap[typeName];
		}
	});

	lists.events.filter(filterWhiteList.bind(null, 'event:')).forEach(function (item) {
		applyGroup(item.group, function () {
			self.event(item.name, item.data);
		});
	});

	lists.methods.filter(filterWhiteList.bind(null, 'method:')).forEach(function (item) {
		// Externally-described methods can't specify the implementation functions
		var methodInfo = item.data;
		if (typeof methodInfo === 'string') {
			methodInfo = { description: methodInfo };
		}
		methodInfo.name = item.name;
		applyGroup(item.group, function () {
			self.define(methodInfo);
		});
	});

	return this;
};

/**
 * Imports code snippets from an external file.
 * @param {String} importSite Absolute path to the external file containing code examples and snippets.
 * @returns {Service} The current API instance.
 */
Service.prototype.examples = function (importSite) {
	var text = fs.readFileSync(importSite, 'utf8');
	if (text[text.length - 1] !== '\n') {
		text += '\n';
	}
	var fileExtension = importSite.substring(importSite.lastIndexOf('.') + 1);
	var language = fileExtension;
	if (fileExtension == 'js') {
		if (text.indexOf('{node}') !== -1) {
			language = 'Node';
		} else {
			language = 'JavaScript';
		}
	} else if (fileExtension == 'java') {
		language = 'Java';
	} else if (fileExtension == 'cs') {
		language = 'CSharp';
	} else if (fileExtension == 'py') {
		language = 'Python';
	} else if (fileExtension == 'cpp' || fileExtension == 'c') {
		language = 'C++';
	} else if (fileExtension == 'curl') {
		language = 'HTTP';
	}
	if (this.languages.indexOf(language) === -1) {
		this.languages.push(language);
	}

	var lineEnd = text.indexOf('\n');
	var name = null;
	var code = '';
	var initialIndentation = 0;
	var index = 0;

	while (lineEnd > -1) {
		var line = text.substring(0, lineEnd + 1);
		if (name) {  // inside an example or a snippet
			if (line.indexOf('{example}') > -1) {  // end of the example
				if (!this.methodMap[name]) {
					this.methodMap[name] = {'examples': {}, params: []};
				}
				this.methodMap[name].examples[language] = code;
				name = null;
			} else if (line.indexOf('{snippet}') > -1) {  // end of the snippet
				if (!this.snippetMap[name]) {
					this.snippetMap[name] = {};
				}
				this.snippetMap[name][language] = code;
				name = null;
			} else {
				line = line.replace(/\t/g, '    ');  // easier indentation
				if (code === '') { // first line of code
					while (line[index] === ' ') {
						initialIndentation++;
						index++;
					}
				}
				// trim whitespace at the beginning of each line (equal to the indentation of the first line)
				index = 0;
				while (index < initialIndentation && line[index] === ' ') {
					index++;
				}
				code += line.substring(index);
			}
		} else {
			index = line.indexOf('{example:');
			if (index == -1) {
				index = line.indexOf('{snippet:');
			}
			if (index !== -1) { // beginning of an example or a snippet
				name = line.substring(index + 9, line.lastIndexOf('}'));
				code = '';
				initialIndentation = 0;
			}
		}

		text = text.substring(lineEnd + 1);
		lineEnd = text.indexOf('\n');
	}
	return this;
};

/**
 * Attaches the configured transports to the given path (e.g. /api/services).
 * @param {String} path The REST path that the API will be attached to.
 * @param {Transport|Transport[]} transport A single transport or an array of transports that will be available.
 * @param [registry] Optional API registry to use. If not provided, one using the base path will be created.
 * @param [AuthHelper] AuthHelper instance to handle requests.
 * @returns {Service} The current API instance.
 */
Service.prototype.listen = function (path, transport, registry, auth) {
	var transports = this.transports;

	if (!path || typeof path !== 'string') {
		throw new Error('Invalid service path.');
	}

	if (!Array.isArray(transport)) {
		transport = [transport];
	}

	transport.forEach(function (t) {
		if (transports.map(function (t) {
			return t.name
		}).indexOf(t.type) > -1) {
			throw new Error("Duplicate transport types are not allowed.");
		}
		transports.push(t);
	});

	if (transports.length == 0) {
		throw new Error("At least one valid transport must be provided.");
	}

	this.auth = auth;
	this.path = util.format("%s/%s", path, this.version);
	transports.forEach(function (t) {
		t.attach(this);
	}.bind(this));

	registry = registry || require('./registry')(path);
	registry.addService(this);

	return this;
};

Service.prototype.getMetadata = function () {
	return {
		'name': this.friendlyName,
		'description': this.description,
		'version': this.version,
		'path': this.path,
		'transports': this.transports.map(function (t) {
			return t.name
		}),
		'groups': this.groups,
		'types': this.typeMap,
		'events': this.eventMap,
		'methods': this.methodMap
	};
};

/**
 * Shuts down all listening transports. Communication is not possible after calling this.
 */
Service.prototype.close = function () {
	this.transports.forEach(function (t) {
		t.close()
	});
};

module.exports = function (version, friendlyName) {
	return new Service(version, friendlyName);
};
