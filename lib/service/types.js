'use strict';

const url = require('url');

const internalTypes = (() => {
	// Converter functions take a value, parse it and return a proper value for the expected type
	// The optional second argument, out, will be set to true if the type converter is called when
	// the value is to be sent out to clients, otherwise the function is called when a client initiates
	// an RPC call to the service
	const converters = {
		anyConverter(value) { /*any*/
			return value;
		},
		intConverter(value) { /*int*/
			if (value === undefined) return value;
			const valueType = typeof value;
			if (valueType !== 'number' && valueType !== 'string') {
				throw new Error('Invalid integer value: ' + value);
			}
			return Math.floor(parseInt(value, 10));
		},
		numberConverter(value) { /*number*/
			if (value === undefined) return value;
			const valueType = typeof value;
			if (valueType !== 'number' && valueType !== 'string') {
				throw new Error('Invalid number value: ' + value);
			}
			return parseFloat(value) || 0.0;
		},
		dateConverter(value) { /*date*/
			if (value === undefined || value === null) return value;
			const valueType = typeof value;
			if (valueType !== 'number' && valueType !== 'string' && !(valueType == 'object' && value instanceof Date)) {
				throw new Error('Invalid date value: ' + value);
			}
			return new Date(value);
		},
		boolConverter(value) { /*bool*/
			if (typeof value === 'string') {
				const lowercase = value.toLowerCase().trim();
				if (lowercase == 'true') return true;
				if (lowercase == 'false') return false;
				throw new Error('Invalid boolean value: ' + value);
			} else {
				return !!value;
			}
		},
		objectConverter(value) { /*object*/
			return typeof value === 'string' ? JSON.parse(value) : value;
		},
		stringConverter(value, out) { /*string*/
			if (typeof value === 'string' || value == null) {
				return value;
			} else if (out) {
				return JSON.stringify(value);
			}
			throw new Error('Invalid string value.');
		},
		urlConverter(value, out) { /*url*/
			if (typeof value === 'string') {
				const parsedUrl = url.parse(value);
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
		binaryConverter(value) { /*binary*/
			if (typeof value === 'string') {
				return new Buffer(value, 'base64');
			}
			if (!Buffer.isBuffer(value)) {
				throw new Error('Invalid buffer data.');
			}
			return value;
		},
		errorConverter(value) { /* error */
			if (value === null || value === undefined) {
				return value;
			} else if (value instanceof Error || /Error$/.test(value.name) || typeof value.message !== 'undefined') {
				return {
					name: value.name || 'Error',
					message: value.message
				};
			} else if (typeof value === 'string') {
				return {
					name: 'Error',
					message: value
				};
			} else {
				throw new Error('Invalid error: ' + value);
			}
		}
	};

	return new Map([
		['*', converters.anyConverter],
		['any', converters.anyConverter],
		['int', converters.intConverter],
		['integer', converters.intConverter],
		['number', converters.numberConverter],
		['float', converters.numberConverter],
		['double', converters.numberConverter],
		['date', converters.dateConverter],
		['time', converters.dateConverter],
		['bool', converters.boolConverter],
		['boolean', converters.boolConverter],
		['object', converters.objectConverter],
		['json', converters.objectConverter],
		['string', converters.stringConverter],
		['url', converters.urlConverter],
		['buffer', converters.binaryConverter],
		['binary', converters.binaryConverter],
		['error', converters.errorConverter]
	]);
})();

/**
 * Check if `obj` is a generator.
 *
 * @param {*} obj
 * @return {Boolean}
 * @api private
 */
function isGenerator(obj) {
	return obj && 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Helpers dealing with internal types
 */
const typeHelpers = {
	get missingDocumentation() {
		return '';
	},

	/**
	 * Checks if a given type name is considered/handled as internal.
	 * @param {String} typeName The name of the type.
	 * @returns {boolean}
	 */
	isInternal(typeName) {
		return typeName === 'async' || internalTypes.has(typeName);
	},

	/**
	 * Gets a function which returns a raw value to an internal type.
	 * @param {String} typeName The name of the internal type.
	 * @returns {Function} The converter function.
	 */
	converter(typeName) {
		const typeConverterFunction = internalTypes.get(typeName);
		if (!typeConverterFunction) {
			throw new Error(`The specified type (${typeName}) is not internal.`);
		}
		return typeConverterFunction;
	},

	/**
	 * Creates a type descriptor struct out of a type definition.
	 * @param {String} typeName The name of the defined type.
 	 * @param {Object} typeDef A type definition object.
	 * @param {String} typeDef.type The name of the type.
	 * @param {Function} checkTypeExistsFn A function which must check if a given type is defined in the API
	 * @returns {}
	 */
	typeStructFromDef(typeName, typeDef, checkTypeExistsFn) {
		const struct = {};
		Object.keys(typeDef).forEach(field => {
			let fieldInfo = typeDef[field];
			if (typeof fieldInfo == 'string') {
				fieldInfo = {type: fieldInfo};
			} else if (Array.isArray(fieldInfo)) {
				fieldInfo = {
					type: fieldInfo[0],
					isArray: true
				};
			} else if (typeof fieldInfo !== 'object') {
				throw new Error(`Invalid type field definition: ${typeName}.${field}`);
			} else if (Array.isArray(fieldInfo.type)) {
				fieldInfo.type = fieldInfo.type[0];
				fieldInfo.isArray = true;
			}

			if (!fieldInfo.type) {
				throw new Error(`Missing type for field: ${field}`);
			}

			if (typeof fieldInfo.type !== 'string') {
				throw new Error(`Invalid type field definition: ${typeName}.${field}`);
			}

			if (!typeHelpers.isInternal(fieldInfo.type) && !checkTypeExistsFn(fieldInfo.type)) {
				throw new Error(`Referenced type "${fieldInfo.type}" is undefined.`);
			}

			struct[field] = {
				name: field,
				type: fieldInfo.type,
				isArray: !!fieldInfo.isArray,
				required: fieldInfo.required != undefined ? !!fieldInfo.required : true,
				default: fieldInfo.default,
				description: fieldInfo.description || typeHelpers.missingDocumentation
			};
		});
		return struct;
	},

	methodNotImplemented(name) {
		return function throwMethodNotImplementedException() {
			throw new Error(`"${name}" is not yet implemented.`);
		};
	},

	/**
	 * Check if `obj` is a promise.
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api private
	 */
	isPromise(obj) {
		return obj && 'function' == typeof obj.then;
	},

	/**
	 * Check if `obj` is a generator function.
	 *
	 * @param {*} obj
	 * @return {Boolean}
	 * @api private
	 */
	isGeneratorFunction(obj) {
		const constructor = obj.constructor;
		if (!constructor) {
			return false;
		}
		if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) {
			return true;
		}
		return isGenerator(constructor.prototype);
	},
};

module.exports = typeHelpers;
