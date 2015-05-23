/**
 * JSON-WS Server test suite
 * Tests the API of the JSON-WS library
 */

'use strict';

var assert = require('chai').assert;
var jsonws = require('../index.js');

// TODO JSWS-53 Add test suite for generator functions once we migrate to io.js/node 0.12.x

suite('Constructor', function() {
	test('Valid constructor', function(done) {
		jsonws.api('1.0', 'Test API');
		done();
	});

	test('Constructor with version, no name', function(done) {
		var err;
		try {
			jsonws.api('1.0');
		} catch (ex) {
			err = ex;
		}
		assert(err != null, 'API must fail without a name');
		done();
	});

	test('Constructor with neither version nor name', function(done) {
		var err;
		try {
			jsonws.api();
		} catch (ex) {
			err = ex;
		}
		assert(err != null, 'API must fail without a name');
		done();
	});

	test('Version property must be read-only', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() {api.version = '1.1'}, TypeError);
		done();
	});
});

suite('Enums', function() {

	var enumValues = {
		A: 0,
		B: 1
	};

	var enumValuesAsArray = [ 'A', 'B' ];

	test('Valid definition (name and values) using enum()', function(done) {
		var api = jsonws.api('1.0', 'Test');

		api.enum('Test', enumValues);
		assert.deepEqual(api.typeMap['Test'].struct, enumValues);
		assert.equal(api.typeMap['Test'].description, '');

		api.enum('TestArray', enumValuesAsArray);
		assert.deepEqual(api.typeMap['TestArray'].struct, enumValues);
		assert.equal(api.typeMap['TestArray'].description, '');

		done();
	});

	test('Valid definition (name and values) using type()', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.type('Test', enumValues, 'Test description', true);
		assert.isTrue(api.typeMap['Test'].enum);
		assert.deepEqual(api.typeMap['Test'].struct, enumValues);
		done();
	});

	test('Invalid definition (name, NO values) using enum()', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.enum('Test') }, /Type .* is undefined/);
		done();
	});

	test('Invalid definition (name, NO values) using type()', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.type('Test') }, /Type .* is undefined/);
		done();
	});

	test('Invalid definition (name, values, but passing wrong isEnum flag)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.type('Test', enumValues) }, /Invalid type field struct/);
		done();
	});

	test('Invalid definition (empty values)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.enum('Test', {}) }, /Empty enums are not allowed/);
		done();
	});

	test('Invalid definition (non-object values)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.enum('Test', 'Invalid') }, /Enum definition must be an object/);
		done();
	});

	test('Invalid definition (non-numeric values)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.enum('Test', {A: 'a', B: 'b'}) }, /Enum values must be numbers/);
		done();
	});

	test('Converter', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.enum('Test', enumValues);
		var enumType = api.type('Test');
		assert.isNotNull(enumType);
		assert.isFunction(enumType.convert);
		assert.throws(function() { enumType.convert([]) }, /only numbers or strings are allowed/);
		assert.throws(function() { enumType.convert({}) }, /only numbers or strings are allowed/);
		assert.doesNotThrow(function() { enumType.convert(0) });
		assert.doesNotThrow(function() { enumType.convert(1) });
		assert.strictEqual(enumType.convert(0), 'A');
		assert.strictEqual(enumType.convert(1), 'B');
		assert.strictEqual(enumType.convert('A'), 'A');
		assert.strictEqual(enumType.convert('B'), 'B');
		assert.throws(function() { enumType.convert(2) }, /Unknown enum .* value/);
		assert.throws(function() { enumType.convert('C') }, /Unknown enum .* value/);
		done();
	});
});

suite('Types', function() {
	test('Valid definition (name and def)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.type('Test', { width: 'int' }, 'Sample descriptive text');
		assert.isDefined(api.typeMap['Test']);
		assert.isUndefined(api.typeMap['Test'].enum);
		assert.equal(api.typeMap['Test'].description, 'Sample descriptive text');
		assert.deepEqual(api.typeMap['Test'].struct, {
			width: {
				name: 'width',
				type: 'int',
				isArray: false,
				required: true,
				default: undefined,
				description: ''
			}
		}, 'type struct');
		done();
	});

	test('Internal types - */any', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['*', 'any'].forEach(function(name) {
			var type = api.type(name);
			assert.ok(type);
			assert.equal(type.type, name);
			assert.isFunction(type.convert);
			assert.strictEqual(type.convert(), undefined);
			assert.strictEqual(type.convert(1), 1);
			assert.strictEqual(type.convert('1'), '1');
			var o = {};
			assert.strictEqual(type.convert(o), o);
			var a = [];
			assert.strictEqual(type.convert(a), a);
		});
		done();
	});

	test('Internal types - int/integer', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['int', 'integer'].forEach(function(name) {
			var type = api.type(name);
			assert.ok(type);
			assert.equal(type.type, name);
			assert.isFunction(type.convert);
			assert.strictEqual(type.convert(1), 1);
			assert.strictEqual(type.convert('1'), 1);
			assert.strictEqual(type.convert(-1), -1);
			assert.strictEqual(type.convert('-1'), -1);
			assert.strictEqual(type.convert(1.1), 1);
			assert.strictEqual(type.convert(1.6), 1);
			assert.strictEqual(type.convert('1.1'), 1);
			assert.strictEqual(type.convert('1.6'), 1);
			assert.strictEqual(type.convert('1.6 invalid'), 1);
			assert.equal(type.convert('invalid').toString(), 'NaN');
			assert.throws(function(){type.convert({})}, /Invalid integer value/);
			assert.throws(function(){type.convert([])}, /Invalid integer value/);
		});
		done();
	});

	test('Internal types - number/float/double', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['number', 'float', 'double'].forEach(function(name) {
			var type = api.type(name);
			assert.ok(type);
			assert.equal(type.type, name);
			assert.isFunction(type.convert);
			assert.strictEqual(type.convert(1), 1);
			assert.strictEqual(type.convert('1'), 1);
			assert.strictEqual(type.convert(1.1), 1.1);
			assert.strictEqual(type.convert(1.6), 1.6);
			assert.strictEqual(type.convert('1.1'), 1.1);
			assert.strictEqual(type.convert(-1.1), -1.1);
			assert.strictEqual(type.convert('1.6'), 1.6);
			assert.strictEqual(type.convert('-1.6'), -1.6);
			assert.strictEqual(type.convert('-1.6 invalid'), -1.6);
			assert.strictEqual(type.convert('invalid'), 0);
			assert.throws(function(){type.convert({})}, /Invalid number value/);
			assert.throws(function(){type.convert([])}, /Invalid number value/);
		});
		done();
	});

	test('Internal types - date/time', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['date', 'time'].forEach(function(name) {
			var type = api.type(name);
			assert.ok(type);
			assert.equal(type.type, name);
			assert.isFunction(type.convert);
			assert.strictEqual(type.convert(), undefined);
			var date = new Date();
			assert.strictEqual(type.convert(date).toString(), new Date(date).toString());
			assert.strictEqual(type.convert(date.getTime()).toString(), new Date(date).toString());
			assert.strictEqual(type.convert(date.toString()).toString(), new Date(date).toString());
			assert.throws(function(){type.convert([])}, /Invalid date value/);
			assert.throws(function(){type.convert({})}, /Invalid date value/);
		});
		done();
	});

	test('Internal types - bool/boolean', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['bool', 'boolean'].forEach(function(name) {
			var type = api.type(name);
			assert.ok(type);
			assert.equal(type.type, name);
			assert.isFunction(type.convert);
			assert.isTrue(type.convert(true));
			assert.isTrue(type.convert('true'));
			assert.isFalse(type.convert(false));
			assert.isFalse(type.convert('false'));
			assert.throws(function() { type.convert('wrong') }, /Invalid boolean value/);
			assert.isTrue(type.convert({}));
			assert.isTrue(type.convert(1));
			assert.isFalse(type.convert(0));
			assert.isFalse(type.convert(null));
			assert.isFalse(type.convert(/*undefined*/));
		});
		done();
	});

	test('Internal types - object/json', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['object', 'json'].forEach(function(name) {
			var type = api.type(name);
			assert.ok(type);
			assert.equal(type.type, name);
			assert.isFunction(type.convert);
			assert.deepEqual(type.convert({test: 'me'}), {test: 'me'});
			assert.deepEqual(type.convert('{"test": "me"}'), {test: 'me'});
			assert.deepEqual(type.convert('["string",{"key":"value"},1234]'), ['string', { key: 'value'}, 1234]);
			assert.equal(type.convert(1234), 1234);
			assert.throws(function() { type.convert('invalid json') }, /Unexpected token/);
		});
		done();
	});

	test('Internal types - string', function(done) {
		var api = jsonws.api('1.0', 'Test');
		var type = api.type('string');
		assert.ok(type);
		assert.equal(type.type, 'string');
		assert.isFunction(type.convert);
		assert.strictEqual(type.convert('test'), 'test');
		assert.strictEqual(type.convert({test: 'me'}), JSON.stringify({test: 'me'}));
		assert.strictEqual(type.convert(1234), '1234');
		done();
	});

	test('Internal types - url', function(done) {
		var api = jsonws.api('1.0', 'Test');
		var type = api.type('url');
		var url = require('url');
		var testUrl = 'http://test.org/path';
		assert.ok(type);
		assert.equal(type.type, 'url');
		assert.isFunction(type.convert);
		assert.strictEqual(type.convert(null), null);
		assert.deepEqual(type.convert(testUrl), url.parse(testUrl));
		assert.strictEqual(type.convert(testUrl, true), testUrl);
		assert.ok(type.convert(testUrl) instanceof url.Url);
		assert.throws(function(){type.convert('')}, /Invalid URL value/);
		assert.throws(function(){type.convert([])}, /Invalid URL value/);
		assert.throws(function(){type.convert({})}, /Invalid URL value/);
		done();
	});

	test('Internal types - binary/buffer', function(done) {
		var api = jsonws.api('1.0', 'Test');
		var type = api.type('buffer');
		assert.ok(type);
		assert.equal(type.type, 'buffer');
		assert.isFunction(type.convert);
		assert.strictEqual(type.convert(new Buffer('test')).toString('base64'), new Buffer('test').toString('base64'));
		assert.strictEqual(type.convert(new Buffer('test').toString('base64')).toString('base64'), new Buffer('test').toString('base64'));
		assert.throws(function() { type.convert({test: 'me'}) }, /Invalid buffer data/);
		done();
	});

	test('Invalid definition (no name)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.type() }, /Types must have a name/);
		assert.throws(function() { api.type(null) }, /Types must have a name/);
		done();
	});

	test('Invalid definition (name, NO def)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.type('Test') }, /Type .* is undefined/);
		done();
	});

	test('Invalid definition (override user types)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.type('Test', { test: 'string'});
		assert.throws(function() { api.type('Test', { test: 'string' }) }, /Types cannot be overriden/);
		done();
	});

	test('Invalid definition (override internal types)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		['*', 'any', 'int', 'integer', 'number', 'float', 'double',
		 'date', 'time', 'bool', 'boolean', 'object', 'json',
		 'string', 'url', 'buffer', 'binary'].forEach(
			function(internalType) {
				assert.throws(function() { api.type(internalType, {}) }, /Internal types cannot be overriden/);
			});
		done();
	});

	test('Invalid definition (invalid field types)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.type('Test', { test: 'invalid' }) }, /Referenced type .* is undefined/);
		assert.throws(function() { api.type('Test', { test: {} }) }, /Missing type for field/);
		assert.throws(function() { api.type('Test', { test: 1234 }) }, /Invalid type field struct/);
		assert.throws(function() { api.type('Test', { test: {} }) }, /Missing type for field/);
		assert.throws(function() { api.type('Test', { test: {type: 1234}}) }, /Invalid type field struct/);
		assert.throws(function() { api.type('Test', { test: {type: null}}) }, /Missing type for field/);
		assert.throws(function() { api.type('Test', { test: {type: {}}}) }, /Invalid type field struct/);
		assert.throws(function() { api.type('Test', { test: {type: []}}) }, /Missing type for field/);
		assert.throws(function() { api.type('Test', { test: {type: [1234]} }) }, /Invalid type field struct/);
		assert.throws(function() { api.type('Test', { test: {type: [{}]} }) }, /Invalid type field struct/);
		done();
	});

	test('Simple type definition (only internal types, no arrays or enums)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.type('Test', {
			s: 'string',
			n: 'int',
			o: 'object',
			notRequired: {
				type: 'int',
				required: false,
				description: 'my description',
				default: 1234
			},
			notRequiredNoDefault: {
				type: 'int',
				required: false
			}
		});

		var type = api.type('Test');

		assert.strictEqual(type.struct.notRequired.description, 'my description');

		assert.throws(function() { type.convert() }, /Simple value cannot be converted/);
		assert.throws(function() { type.convert(1234) }, /Simple value cannot be converted/);
		assert.throws(function() { type.convert('invalid') }, /Simple value cannot be converted/);
		assert.throws(function() { type.convert({}) }, /Required field has no value: s/);
		assert.throws(function() { type.convert({s: 's'}) }, /Required field has no value: n/);
		assert.throws(function() { type.convert({s: 's', n: 1}) }, /Required field has no value: o/);
		assert.doesNotThrow(function() { type.convert({s: 's', n: 1, o: {test: 'any'}}) });

		assert.throws(function() { type.convert({s: null, n: 1, o: {test: 'any'}}) }, /Required field has no value/);
		assert.throws(function() { type.convert({s: '', n: 0, o: undefined}) }, /Required field has no value/);

		assert.deepEqual(type.convert(
			{
				s: 's',
				n: '1',
				o: '{"test": "any"}'
			}),
			{
				s: 's',
				n: 1,
				o: {test: 'any'},
				notRequired: 1234,
				notRequiredNoDefault: undefined
			}
		);

		done();
	});

	test('Complex type definition (referenced types, deep nesting)', function(done) {
		var api = jsonws.api('1.0', 'Test');

		api.enum('TestMode', {A: 1, B: 2});
		api.type('Options', {
			testMode: 'TestMode',
			parameter1: 'string',
			parameter2: 'double',
			parameter3: {
				type: 'int',
				required: false
			}
		});
		api.type('Test', {
			name: 'string',
			options: 'Options',
			defaultOptions: {
				type: 'Options',
				required: false,
				default: {
					testMode: 2,
					parameter1: 'string',
					parameter2: 1.1,
					parameter3: 10
				}
			}
		});

		var testType = api.type('Test');

		assert.deepEqual(
			testType.convert({
				name: 'test name',
				options: {
					testMode: 1,
					parameter1: 'p1',
					parameter2: 0.0
				}
			}),
			{
				name: 'test name',
				options: {
					testMode: 'A',
					parameter1: 'p1',
					parameter2: 0.0,
					parameter3: undefined
				},
				defaultOptions: {
					testMode: 'B',
					parameter1: 'string',
					parameter2: 1.1,
					parameter3: 10
				}
			}
		);

		assert.doesNotThrow(function() {
			testType.convert({
				name: 'test name',
				options: {
					testMode: 1,
					parameter1: 'p1',
					parameter2: 0.0
				}
			});
		});

		assert.throws(function() {
			testType.convert({
				name: 'test name',
				options: {
					testMode: 1,
					parameter1: 'p1'
				}
			});
		}, /Required field has no value: parameter2/);

		assert.throws(function() {
			testType.convert({
				name: 'test name',
				options: {
					testMode: 1
				}
			});
		}, /Required field has no value: parameter1/);

		assert.throws(function() {
			testType.convert({
				name: 'test name',
				options: {
					testMode: 0
				}
			});
		}, /Unknown enum .* value/);

		assert.throws(function() {
			testType.convert({
				name: 'test name'
			});
		}, /Required field has no value: options/);

		done();
	});

    test('Complex type definition (arrays)', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.type('Foo', { bar: 'string'	});
		api.type('Test', {
			ints: ['int'],
			complex: {
				type: ['Foo']
			}
		});
		api.type('OptionalTest', {
			ints: ['int'],
			field1: { type: 'Foo', required: false },
			field2: { type: ['Foo'], required: false }
		});

		var testType = api.type('Test');

		assert.deepEqual(testType.convert({
			ints: [1, '2', '3.3', 4, 5],
			complex: [{ "bar": "string" }, { bar: [1234, 5678] }, { bar: 1234 }]
		}), {
			ints: [1, 2, 3, 4, 5],
			complex: [ {bar: 'string'} , {bar: '[1234,5678]'}, { bar: '1234' } ]
		});

		assert.throws(function() {
			testType.convert({
				ints: 'invalid',
				complex: {}
			});
		}, /Field .* must be an array/);

		assert.throws(function() {
			testType.convert({
				ints: [0, 1, 2],
				complex: {
					type: {} // invalid
				}
			});
		}, /Field .* must be an array/);

		// Optional type test
		testType = api.type('OptionalTest');

		assert.deepEqual(testType.convert({
			ints: [1, '2', '3.3', 4, 5]
		}), {
			ints: [1, 2, 3, 4, 5],
			field1: undefined,
			field2: undefined
		});

		assert.deepEqual(testType.convert({	ints: [1], field1: { bar: 'test'} }), {
			ints: [1],
			field1: { bar: 'test'},
			field2: undefined
		});

		assert.deepEqual(testType.convert({	ints: [1], field2: [{ bar: 'test'}] }), {
			ints: [1],
			field1: undefined,
			field2: [{ bar: 'test'}]
		});

		done();
	});
});

suite('Events', function() {
	test('Valid definition', function (done) {
		var api = jsonws.api('1.0', 'Test');

		assert.doesNotThrow(function() { api.event('OnTestEvent') });
		assert.ok(api.eventMap['OnTestEvent']);
		assert.deepEqual(api.eventMap['OnTestEvent'], {
			name: 'OnTestEvent',
			type: null,
			isArray: false,
			description: ''
		});

		assert.doesNotThrow(function() { api.event('OnOtherEvent', { type: 'int', description: 'Foobar' }) });
		assert.ok(api.eventMap['OnOtherEvent']);
		assert.deepEqual(api.eventMap['OnOtherEvent'], {
			name: 'OnOtherEvent',
			type: 'int',
			isArray: false,
			description: 'Foobar'
		});

		assert.doesNotThrow(function() { api.event('OnEventWithDescription', 'Description') });
		assert.ok(api.eventMap['OnEventWithDescription']);
		assert.deepEqual(api.eventMap['OnEventWithDescription'], {
			name: 'OnEventWithDescription',
			type: null,
			isArray: false,
			description: 'Description'
		});

		assert.doesNotThrow(function() { api.namespace('test.me'); api.event('OnTestEvent') });
		assert.ok(api.eventMap['test.me.OnTestEvent']);
		assert.deepEqual(api.eventMap['test.me.OnTestEvent'], {
			name: 'test.me.OnTestEvent',
			type: null,
			isArray: false,
			description: ''
		});

		done();
	});

	test('Invalid definition', function(done) {
		var api = jsonws.api('1.0', 'Test');
		assert.throws(function() { api.event() }, /Service events MUST have a name/);
		assert.throws(function() { api.event('OnEvent', ['invalid options']) }, /Event options must be an object/);
		assert.throws(function() { api.event('OnEvent', 1234) }, /Event options must be an object/);
		assert.throws(function() { api.event('OnEvent', {type:'Unkown Type'}) }, /Undefined event type/);
		assert.throws(function() { api.event('OnEvent'); api.event('OnEvent') }, /Overriding events is not allowed/);
		assert.throws(function() { api.define({ name: 'OnEvent', event: true }); }, /Registering events using the define method is obsolete/);
		done();
	});
});

suite('Methods', function() {
	test('Empty definition', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.define('method');
		assert.ok(api.methodMap['method']);
		assert.throws(function(){ api.fn.method() }, /not yet implemented/);

		api = jsonws.api('1.0', 'Test');
		api.define({ name: 'method' });
		assert.ok(api.methodMap['method']);
		assert.throws(function(){ api.fn.method() }, /not yet implemented/);

		done();
	});

	test('String name, function', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.define('method', function() {return 1;});
		assert.ok(api.methodMap['method']);
		assert.doesNotThrow(function(){ api.fn.method() });
		assert.equal(api.fn.method(), 1);
		done();
	});

	test('Invalid definition', function(done) {
		var api = jsonws.api('1.0', 'Test');

		assert.throws(function() { api.define() }, /Invalid definition options/);
		assert.throws(function() { api.define(['invalid']) }, /Invalid definition options/);
		assert.throws(function() { api.define(1234) }, /Invalid definition options/);

		assert.throws(function() { api.define({}) }, /Service methods MUST have a name/);
		assert.throws(function() { api.define({name: 'test', returns: 'invalid'}) }, /Undefined return type/);
		assert.throws(function() { api.define({name: 'test', returns: []}) }, /Undefined return type/);

		assert.throws(function() { api.define({name: 'test', params: 'invalid'}) }, /The params property must be an array/);
		assert.throws(function() { api.define({name: 'test', params: {}}) }, /The params property must be an array/);
		assert.throws(function() { api.define({name: 'test', params: 1234}) }, /The params property must be an array/);

		assert.throws(function() { api.define({name: 'test', params: [{}]}) }, /Unnamed method parameter/);
		assert.throws(function() { api.define({name: 'test', params: [{type: 'string'}]}) }, /Unnamed method parameter/);

		assert.throws(function() { api.define({name: 'test', params: [{name: 'test', type: ['strings'] }]}) }, /Undefined type/);
		assert.throws(function() { api.define({name: 'test', params: [{name: 'test', type: [] }]}) }, /Missing type for param test/);

		assert.throws(function() { api.define({name: 'test', params: [{name: 'test', type: { name: 'invalid' }}]}) }, /Inline type definitions are not supported/);
		assert.throws(function() { api.define({name: 'test', params: [{name: 'test', type: 'invalid'}]}) }, /Undefined type/);

		done();
	});

	test('Complex definitions (parameters and context this)', function(done) {
		var api = jsonws.api('1.0', 'Test');

		api.define({
			name: 'test',
			params: [{name: 'a', type: 'int'},{name: 'b', type: 'int'}]
		}, function(a, b) { return a + b });
		assert.strictEqual(api.fn.test(2, 3), 5);

		api.define({
			name: 'test2',
			params: [{name: 'a', type: 'int'},{name: 'b', type: 'int'}],
			'this': { sum: function(a, b) { return a + b }}
		}, function(a, b) { return this.sum(a, b) });
		assert.strictEqual(api.fn.test2(2, 3), 5);

		api.define({
			name: 'sum',
			'this': { sum: function(a, b) { return a + b }}
		});
		assert.strictEqual(api.fn.sum(2, 3), 5);

		api.define({
			name: 'sumRemapped',
			'this': { internalMethodToRemap: function(a, b) { return a + b }}
		}, 'internalMethodToRemap');
		assert.strictEqual(api.fn.sumRemapped(2, 3), 5);

		api.define({
			name: 'fail',
			'this': { fail: function() { throw new Error('Custom error') }}
		});
		assert.throws(function() { api.fn.fail() }, /Custom error/);

		api.define({
			name: 'fail',
			'this': {}
		}, 'fail');
		assert.throws(function() { api.fn.fail() }, /Invalid method invocation/);

		api.define({
			name: 'missing',
			'this': { }
		}, 'remappedMissing');
		assert.throws(function() { api.fn.missing() }, /Invalid method invocation/);

		api.define({name: 'testArrayParam', params: [{name: 'test', type: ['string'] }]});
		assert.strictEqual(api.methodMap['testArrayParam'].params[0].isArray, true);
		assert.strictEqual(api.methodMap['testArrayParam'].params[0].type, 'string');

		api.define({
			name: 'optionalArgs',
			params: [
				{ name: 'p1', type: 'int', default: 0 },
				{ name: 'required', type: 'bool' },
				{ name: 'p2', type: 'int', default: 1 }
			]
		});
		assert.strictEqual(api.methodMap['optionalArgs'].params[0].name, 'required');
		assert.strictEqual(api.methodMap['optionalArgs'].params[1].name, 'p1');
		assert.strictEqual(api.methodMap['optionalArgs'].params[2].name, 'p2');
		assert.strictEqual(api.methodMap['optionalArgs'].params[1].default, 0);
		assert.strictEqual(api.methodMap['optionalArgs'].params[2].default, 1);

		done();
	});

	test('Namespaces', function(done) {
		var api = jsonws.api('1.0', 'Test');

		api.define('a.test');
		api.define('b.test');
		api.define('a.b.test');

		assert.ok(api.fn.a.test);
		assert.ok(api.fn.b.test);
		assert.ok(api.fn.a.b.test);

		assert.throws(function() { api.fn.a.test() }, /not yet implemented/);
		assert.throws(function() { api.fn.b.test() }, /not yet implemented/);
		assert.throws(function() { api.fn.a.b.test() }, /not yet implemented/);

		api.define('test.namespace.math.sum', function(a, b) { return a + b });
		assert.equal(api.fn.test.namespace.math.sum(2, 3), 5);

		done();
	});

	test('Define all / from object', function(done) {
		done();
	});
});

suite('Groups', function() {

	test('Default', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.define('method');
		assert.ok(api.groups['Default']);
		assert.equal(api.currentGroup.name, api.groups['Default'].name);
		assert.equal(api.groups['Default'].items[0], 'method:method');
		done();
	});

	test('Multiple', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.define('method');
		api.group('Group1').define('method1');
		api.group('Group2').define('method2');
		assert.ok(api.groups['Group1']);
		assert.equal(api.groups['Group1'].items[0], 'method:method1');
		assert.ok(api.groups['Group2']);
		assert.equal(api.groups['Group2'].items[0], 'method:method2');
		done();
	});

	test('Description, name, valid structure', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.group('Test', 'Test description');
		assert.equal(api.groups['Test'].name, 'Test');
		assert.equal(api.groups['Test'].description, 'Test description');
		assert.ok(Array.isArray(api.groups['Test'].items));
		done();
	});

});

suite('External definitions', function() {
	var path = require('path');
	var implementations = {
		sum: function(a, b) { return a + b },
		method1: function(a, b) { return a + b},
		method2: function() {}
	};

	test('Using code', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.import(path.resolve(__dirname, 'resources', 'server-def-code.js'));

		assert.ok(api.fn.sum);
		assert.equal(api.fn.sum(2, 3), 5);

		assert.ok(api.typeMap['RenderMode']);
		assert.ok(api.typeMap['RenderOptions']);

		assert.equal(api.methodMap['sum'].description, 'Returns the sum of two numbers');

		assert.ok(api.eventMap['ontest']);
		assert.equal(api.eventMap['ontest'].description, 'test event');

		done();
	});

	test('Using JSON', function(done) {
		var api = jsonws.api('1.0', 'Test');
		api.import(path.resolve(__dirname, 'resources', 'server-def-json.js'));
		api.defineAll(implementations);

		assert.ok(api.fn.sum, 'sum');
		assert.equal(api.fn.sum(2, 3), 5);

		assert.ok(api.typeMap['RenderMode'], 'RenderMode');
		assert.ok(api.typeMap['RenderOptions'], 'RenderOptions');

		assert.equal(api.methodMap['sum'].description, 'Returns the sum of two numbers');

		assert.ok(api.eventMap['ontest']);
		assert.equal(api.eventMap['ontest'].description, 'test event');

		done();
	});

	function splitLines(text) {
		var arr;
		if (text.indexOf('\r\n') > -1) {
			arr = text.split('\r\n');
		} else {
			arr = text.split('\n');
		}
		return arr.splice(0, arr.length - 1);
	}

	function assertExamplesAndSnippets(api) {
		assert.ok(api.methodMap['method1'].examples['JavaScript']);
		assert.ok(api.methodMap['method1'].examples['Java']);
		assert.deepEqual(splitLines(api.methodMap['method1'].examples['HTTP']), ['[1, 2]']);
		assert.ok(api.methodMap['method2'].examples['HTTP']);
		assert.deepEqual(splitLines(api.methodMap['method2'].examples['JavaScript']),
			['proxy.method2();']);
		assert.ok(api.snippetMap['snippet1']['JavaScript']);
		assert.ok(api.snippetMap['snippet1']['Java']);
		assert.ok(api.snippetMap['snippet1']['Node']);
		assert.deepEqual(splitLines(api.snippetMap['snippet1']['Java']),
			['int a = proxy.method1(1, 2).get();', 'proxy.method2().get();']);
		assert.ok(api.snippetMap['snippet2']['JavaScript']);

	};

	function importExamples(api) {
		api.examples(path.resolve(__dirname, 'resources', 'examples_snippets.js'));
		api.examples(path.resolve(__dirname, 'resources', 'examples_snippets.node.js'));
		api.examples(path.resolve(__dirname, 'resources', 'examples_snippets.java'));
		api.examples(path.resolve(__dirname, 'resources', 'examples.curl'));
	}

	test('Import examples and snippets before definitions', function() {
		var api = jsonws.api('1.0', 'Test');
		importExamples(api);
		api.defineAll(implementations);
		assertExamplesAndSnippets(api);
	});

	test('Import examples and snippets after definitions', function() {
		var api = jsonws.api('1.0', 'Test');
		api.defineAll(implementations);
		importExamples(api);
		assertExamplesAndSnippets(api);
	});
});
