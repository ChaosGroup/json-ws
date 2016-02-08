/**
 * JSON-WS API definition module
 * Allows implementors to expose their APIs over some transport mechanism.
 */

'use strict';

const co = require('co');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const semver = require('semver');
const types = require('./types');

class Service extends EventEmitter {
	/**
	 * Service constructor
	 * @param {String} version Semver-compatible service version tag.
	 * @param {String} name A string which identifies the service.
	 * @param {Function} [requestValidator] Optional validator function which is called before all method invocations.
	 */
	constructor(version, name, requestValidator) {
		if (!version || !semver.valid(version)) {
			throw new Error(`Invalid version: ${version}`);
		}
		if (!name || typeof name !== 'string') {
			throw new Error(`Invalid name: ${name}`);
		}
		if (requestValidator && typeof requestValidator !== 'function') {
			throw new Error('Request validator must be a function.');
		}

		super();

		Object.defineProperty(this, 'name', { get: () => name });
		Object.defineProperty(this, 'version', { get: () => version });

		this.timeStamp = new Date().getTime(); // TODO move/rename, used only in registry/render
		this.description = '';

		this.groups = {};
		this.currentGroup = null;
		this.setGroup('Default');

		this.currentThisObj = null;
		this.currentNamespace = '';

		this.methodMap = {};
		this.methods = this.fn = {};

		this.typeMap = {};
		this.eventMap = {};

		this.snippetMap = {};
		this.languages = [];

		this.requestValidator = typeof requestValidator === 'function' ? requestValidator : null;
	}

	/**
	 * Marks the beginning of a new method group. If the group had been initialised previously it will be reused.
	 * @param {String} groupName The name of the group.
	 * @param {String} [description] Descriptive text for the group.
	 * @returns {Service} The current API instance.
	 */
	setGroup(groupName, description) {
		if (typeof groupName === 'string' && groupName.length) {
			this.currentGroup = this.groups[groupName] || (this.groups[groupName] = {
				name: groupName,
				description: description || '',
				items: []
			});
		}
		return this;
	}

	/**
	 * Marks the beginning of a new method namespace. All methods defined from this point on will reside in this namespace.
	 * @param {String} [namespace=""] A dot-separated namespace string, e.g. com.chaosgroup.jsonws.
	 * @returns {Service} The current API instance.
	 */
	setNamespace(namespace) {
		this.currentNamespace = namespace || '';
		return this;
	}

	/**
	 * Convenience method for setting the current "this" object pointer for a group of methods.
	 * @param {object} thisObj The this object.
	 * @returns {Service} The current API instance.
	 */
	setThis(thisObj) {
		this.currentThisObj = thisObj;
		return this;
	}

	/**
	 * Validates parameters, extracts types if necessary
	 * @param params
	 */
	_parseDefineParams(params) {
		if (params && !Array.isArray(params)) {
			throw new Error('The params property must be an array.');
		}
		const parsedParams = [];
		const defaultParams = [];
		(params || []).forEach((param) => {
			if (typeof param == 'string') {
				param = {
					'name': param,
					'type': '*'
				};
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

				if (!types.isInternal(param.type) && !this.typeMap[param.type]) {
					throw new Error('Undefined type: ' + param.type);
				}

				// Uncomment to add support for type inlining
				/*if (typeof param.type == 'object') {
				 this.type(param.type.name, param.type.struct);
				 param.type = param.type.name;
				 }*/

				/* Uncomment to parse the default param value at definition time
				 * As it is, the default value will be converted by the transport each time when the target method is called
				 if (param.default !== undefined) {
				 param.default = this.type(param.type).convert(param.default);
				 }*/
			}

			let permissions;
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
				'description': param.description || types.missingDocumentation,
				'permissions': permissions
			});
		});

		return parsedParams.concat(defaultParams);
	}

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
	define(options, fn) {
		if (options && options.event) {
			throw new Error('Registering events using the define method is obsolete. Please use the event method instead.');
		}

		const self = this;

		if (typeof options === 'string') {
			options = {name: options};
		} else if (typeof options != 'object' || Array.isArray(options)) {
			throw new Error('Invalid definition options.');
		}

		if (!options.name) {
			throw new Error('Service methods MUST have a name.');
		}

		let methodName = options.name;

		if (this.currentNamespace) {
			methodName = `${this.currentNamespace}.${methodName}`;
		}

		if (options.returns) {
			if (Array.isArray(options.returns)) {
				options.returns = options.returns[0];
				options.returnsArray = true;
			}
			if (!options.returns || (!types.isInternal(options.returns) && !this.typeMap[options.returns])) {
				throw new Error('Undefined return type for method ' + methodName + ': ' + options.returns);
			}
		}

		// Makes a method callable within the service
		function mapMethods(methodName, fn) {
			const namespaces = methodName.split('.');
			methodName = namespaces[namespaces.length - 1];
			let last = self.methods;
			for (let i = 0; i < namespaces.length - 1; i++) {
				last = last[namespaces[i]] = last[namespaces[i]] || {};
			}
			last[methodName] = fn;
		}

		if (!this.methodMap[methodName]) {
			this.currentGroup.items.push('method:' + methodName);
			this.methodMap[methodName] = {};
		}

		const methodInfo = this.methodMap[methodName];

		methodInfo.name = methodName;
		methodInfo.description = options.description || methodInfo.description || types.missingDocumentation;
		methodInfo.examples = methodInfo.examples || {};

		const requiresCallback = options.callback !== undefined ? options.callback : methodInfo.callback;
		methodInfo.callback = requiresCallback !== undefined ? requiresCallback : true;

		if (!methodInfo.hasOwnProperty('this')) {
			Object.defineProperty(methodInfo, 'this', {
				configurable: false,
				enumerable: false,
				writable: true
			});
		}
		methodInfo['this'] = options['this'] || this.currentThisObj || methodInfo['this'] || null;

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
				methodInfo.fn = options['this']
					? (function () {
						const originalThis = options['this'];
						const mappedMethodName = typeof fn === 'string' ? fn : methodName;
						const remappedFn = originalThis[mappedMethodName];
						if (typeof remappedFn !== 'function') {
							return function () {
								throw new Error(`Invalid method invocation: ${methodName}.`);
							};
						} else if (types.isGeneratorFunction(remappedFn)) {
							return co.wrap(remappedFn).bind(originalThis);
						} else {
							return remappedFn.bind(originalThis);
						}
					})()
					: types.methodNotImplemented(methodName);
			} else if (types.isGeneratorFunction(fn)) {
				methodInfo.fn = co.wrap(fn).bind(methodInfo['this']);
			} else {
				methodInfo.fn = fn.bind(methodInfo['this']);
			}

			mapMethods(methodName, methodInfo.fn);
		}

		return this;
	}

	/**
	 * Registers a type/enum or returns its metadata.
	 * @param {String} typeName The full name of the type.
	 * @param [typeDef] A type/enum definition object.
	 * @param {String} [description] Descriptive text.
	 * @param {Boolean} [isEnum] Flag indicating if we are registering an enum vs. an ordinary type (structure).
	 * @returns {{type: String, convert: Function}}
	 */
	type(typeName, typeDef, description, isEnum) {
		const self = this;

		if (!typeName) {
			throw new Error('Types must have a name.');
		}

		if (!typeDef) {
			if (types.isInternal(typeName) && !this.typeMap[typeName]) {
				return {type: typeName, convert: types.converter(typeName)};
			}
			if (!this.typeMap[typeName]) {
				throw new Error(`Type "${typeName}" is undefined.`);
			}
			return this.typeMap[typeName];
		}

		if (types.isInternal(typeName)) {
			throw new Error('Internal types cannot be overriden.');
		}

		if (self.typeMap[typeName]) {
			throw new Error('Types cannot be overriden.');
		}

		const typeStruct = isEnum ? typeDef : types.typeStructFromDef(typeName, typeDef, function (typeToCheck) {
			return !!self.typeMap[typeToCheck];
		});

		if (isEnum) {
			if (typeof typeStruct !== 'object') {
				throw new Error('Enum definition must be an object');
			}
			if (Object.keys(typeStruct).length == 0) {
				throw new Error('Empty enums are not allowed: ' + typeName);
			}
			if (Object.keys(typeStruct).some(enumKey => typeof typeStruct[enumKey] !== 'number')) {
				throw new Error('Enum values must be numbers.');
			}
		}

		this.typeMap[typeName] = {
			'name': typeName,
			'description': description || types.missingDocumentation,
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
				let returnValueAsKey = value;
				if (!Object.keys(typeStruct).some(enumKey => value === enumKey || (typeStruct[enumKey] === value && (returnValueAsKey = enumKey)))) {
					throw new Error('Unknown enum ' + typeName + ' value: ' + value);
				}
				return returnValueAsKey; // typeof value === 'number' ? value : typeStruct[value];
			}

			if (typeof value !== 'object') {
				throw new Error(`Simple value cannot be converted to type ${typeName}`);
			}

			if (value === null) {
				return null;
			}

			const result = {};
			Object.keys(typeStruct).forEach(function (field) {
				try {
					const fieldInfo = typeStruct[field];
					let fieldValue = value[field];

					if (fieldValue == null || fieldValue == undefined) {
						if (fieldInfo.required) {
							throw new Error(`Required field has no value: ${field}`);
						}
						fieldValue = fieldValue !== undefined ? fieldValue : fieldInfo.default;
					}

					if (fieldValue == null || fieldValue == undefined) {
						result[field] = types.isInternal(fieldInfo.type)
							? self.type(fieldInfo.type).convert(fieldValue, out)
							: fieldValue;
						return;
					}

					if (fieldInfo.isArray) {
						if (!Array.isArray(fieldValue)) {
							throw new Error(`Field ${field} must be an array.`);
						}
						const arrayType = self.type(fieldInfo.type);
						result[field] = fieldValue.map(function (arrayValue) {
							return arrayType.convert(arrayValue, out);
						});
					} else {
						result[field] = self.type(fieldInfo.type).convert(fieldValue, out);
					}
				} catch (err) {
					// Add the type name and field name to the error message:
					err.message = `[${typeName}.${field}] ${err.message}`;
					throw err;
				}

			});

			return result;
		}

		return this;
	}

	/**
	 * Defines an event that can be emitted to clients.
	 * @param {String} eventName the name of the event (e.g. 'imageReady')
	 * @param eventInfo A JSON structure with the event options, or a string holding descriptive text.
	 * @returns {Service} The current API instance.
	 */
	event(eventName, eventInfo) {
		if (!eventName) {
			throw new Error('Service events MUST have a name.');
		}

		if (this.currentNamespace) {
			eventName = `${this.currentNamespace}.${eventName}`;
		}

		if (this.eventMap[eventName]) {
			throw new Error(`Overriding events is not allowed: ${eventName}`);
		}

		eventInfo = eventInfo || {};

		if (typeof eventInfo === 'string') {
			eventInfo = {description: eventInfo};
		}

		if (typeof eventInfo !== 'object' || Array.isArray(eventInfo)) {
			throw new Error('Event options must be an object.');
		}

		if (eventInfo.type) {
			if (Array.isArray(eventInfo.type)) {
				eventInfo.type = eventInfo.type[0];
				eventInfo.isArray = true;
			}
			if (!eventInfo.type || (!types.isInternal(eventInfo.type) && !this.typeMap[eventInfo.type])) {
				throw new Error(`Undefined event type for event ${eventName}: ${eventInfo.type}`);
			}
		}

		this.eventMap[eventName] = {
			name: eventName,
			type: eventInfo.type || null,
			isArray: !!eventInfo.isArray,
			description: eventInfo.description || types.missingDocumentation
		};

		this.currentGroup.items.push(`event:${eventName}`);

		return this;
	}

	/**
	 * Defines an enum using a set of values
	 * @param {String} enumName The name of the new enum.
	 * @param [values] A JSON structure or an array of string literals which holds the enum's values .
	 * @param {String} [description] Enum descriptive text.
	 * @returns {{type: String, convert: Function}}
	 */
	enum(enumName, values, description) {
		if (Array.isArray(values)) {
			// BH-129 Remap array values to object keys
			values = (function () {
				const o = {};
				for (let i = 0; i < values.length; i++) {
					o[values[i]] = i;
				}
				return o;
			}());
		}
		return this.type(enumName, values, description, true);
	}

	/**
	 * Exposes methods of an object on the API
	 * @param {*} obj An object whose functions will be mapped on top of the API.
	 * @param {String[]} [methodNames] A list of method names to include from the target object.
	 * @returns {Service} The current API instance.
	 */
	defineAll(obj, methodNames) {
		if (!obj) {
			return this;
		}

		const oldThisObj = this.currentThisObj;
		this.setThis(obj);

		function checkSkipProperty(prop, name) {
			return (typeof prop !== 'function' || name.substr(0, 1) === '_' || (methodNames && methodNames.indexOf(name) == -1));
		}

		for (const i in obj) {
			if (!obj.hasOwnProperty(i) || checkSkipProperty(obj[i], i)) {
				continue;
			}
			this.define(i, obj[i]);
		}
		const systemStuff = Object.getOwnPropertyNames({}.constructor.prototype);
		Object.getOwnPropertyNames(obj.constructor.prototype).forEach(function (i) {
			if (systemStuff.indexOf(i) > -1 || obj.hasOwnProperty(i) || checkSkipProperty(obj[i], i)) {
				return;
			}
			this.define(i, obj[i]);
		}.bind(this));

		return this.setThis(oldThisObj);
	}

	/**
	 * Imports API metadata from an external file.
	 * @param {String|*} importSite Absolute path to the external file containing API definitions.
	 * @param {String[]} [whiteList]
	 * @returns {Service} The current API instance.
	 */
	import(importSite, whiteList) {
		const self = this;
		let defs;

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

		const deps = {};
		const lists = {
			enums: [],
			types: [],
			events: [],
			methods: []
		};
		const typePlaceHolder = '**__placeholder__**';
		let currentGroup = {name: 'Default', description: ''};
		const filterWhiteList = whiteList && Array.isArray(whiteList) && whiteList.length > 0 ? function (prefix, item) {
			return whiteList.indexOf(prefix + item.name) != -1;
		} : function () {
			return true;
		};

		function forward(typeName, typeInfo) {
			const typeDeps = deps[typeName] || (deps[typeName] = []);
			try {
				typeInfo = types.typeStructFromDef(typeName, typeInfo.struct, function () {
					return true;
				});
			} catch (typeInfoParseError) {
				throw typeInfoParseError;
			}
			for (const propertyName in typeInfo) {
				const propertyInfo = typeInfo[propertyName];
				const typeMapInfo = self.typeMap[propertyInfo.type];
				if (types.isInternal(propertyInfo.type) || (typeMapInfo && typeMapInfo !== typePlaceHolder)) {
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
							forward(typeName, defs.types[typeName]);
						}
						else {
							self.typeMap[typeName] = typePlaceHolder;
						}
						const lastIdx = lists.types.push({
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
					const importList = Array.isArray(defs[key]) ? defs[key] : [defs[key]];
					importList.forEach(function (importItem) {
						if (typeof importItem == 'object') {
							let whiteList = importItem.list;
							if (whiteList && !Array.isArray(whiteList)) {
								whiteList = [whiteList];
							}
							self.import(importItem.file, whiteList);
						} else { // Assume this is a file path
							self.import(importItem);
						}
					});
				} else {
					const oldGroup = currentGroup;
					currentGroup = {name: key, description: ''};
					prepass(defs[key], level + 1);
					currentGroup = oldGroup;
				}
			});
		}

		function applyGroup(group, fn) {
			const oldGroup = self.currentGroup;
			self.setGroup(group.name, group.description);
			fn();
			self.setGroup(oldGroup.name, oldGroup.description);
		}

		function importTypeWithDependencies(chain, item) {
			const typeName = item.name, typeInfo = item.data;
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
			let methodInfo = item.data;
			if (typeof methodInfo === 'string') {
				methodInfo = {description: methodInfo};
			}
			methodInfo.name = item.name;
			applyGroup(item.group, function () {
				self.define(methodInfo);
			});
		});

		return this;
	}

	/**
	 * Imports code snippets from an external file.
	 * @param {String} importSite Absolute path to the external file containing code examples and snippets.
	 * @returns {Service} The current API instance.
	 */
	examples(importSite) {
		let text = fs.readFileSync(importSite, 'utf8');
		if (text[text.length - 1] !== '\n') {
			text += '\n';
		}
		const fileExtension = importSite.substring(importSite.lastIndexOf('.') + 1);
		let language = fileExtension;
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

		let lineEnd = text.indexOf('\n');
		let name = null;
		let code = '';
		let initialIndentation = 0;
		let index = 0;

		while (lineEnd > -1) {
			let line = text.substring(0, lineEnd + 1);
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
	}

	get metadata() {
		return {
			name: this.name,
			description: this.description,
			version: this.version,
			groups: this.groups,
			types: this.typeMap,
			events: this.eventMap,
			methods: this.methodMap
		};
	}
}

module.exports = Service;
