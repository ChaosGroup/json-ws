/**
 * JSON-WS Server test suite
 * Tests the API of the JSON-WS library
 */

'use strict';

const path = require('path');
const stream = require('stream');
const expect = require('chai').expect;
const jsonws = require('../index.js');
const Service = jsonws.service;

// TODO JSWS-53 Add test suite for generator functions once we migrate to io.js/node 0.12.x

describe('Constructor - Service()', function() {
	it('instantiates properly with valid arguments', function() {
		const api = new Service('1.0.0', 'Test API');
		expect(api.version).to.eq('1.0.0');
		expect(api.name).to.eq('Test API');
	});

	it('throws when no name is given', function() {
		expect(() => new Service('1.0.0')).to.throw(/Invalid name/);
	});

	it('throws when neither name nor version are given', function() {
		expect(() => new Service()).to.throw(/Invalid version/);
	});

	it('keeps the version property read-only', function() {
		const api = new Service('1.0.0', 'Test API');
		expect(function() {
			api.version = '1.1';
		}).to.throw(TypeError);
	});
});

describe('Enums - api.enum() and api.type(_, _, _, isEnum = true)', function() {
	const enumValues = {
		A: 0,
		B: 1,
	};

	const enumValuesAsArray = ['A', 'B'];
	let api;

	beforeEach(function() {
		api = new Service('1.0.0', 'Test API');
	});

	it('creates enums through enum() when name and values are given', function() {
		api.enum('Test', enumValues);
		expect(api.typeMap['Test'].struct).to.deep.eq(enumValues);
		expect(api.typeMap['Test'].description).to.be.empty;

		api.enum('TestArray', enumValuesAsArray);
		expect(api.typeMap['TestArray'].struct).to.deep.eq(enumValues);
		expect(api.typeMap['TestArray'].description).to.be.empty;
	});

	it('creates enums through type() when name and values are given', function() {
		api.type('Test', enumValues, 'Test description', true);
		expect(api.typeMap['Test'].enum).to.be.true;
		expect(api.typeMap['Test'].struct).to.deep.eq(enumValues);
		expect(api.typeMap['Test'].description).to.eq('Test description');
	});

	it('throws when enum() is called without values', function() {
		expect(api.enum.bind(api, 'Test')).to.throw(/Type .* is undefined/);
	});

	it('throws when type() is called without values', function() {
		expect(api.type.bind(api, 'Test')).to.throw(/Type .* is undefined/);
	});

	it('throws when type() is called with wrong isEnum flag', function() {
		expect(api.type.bind(api, 'Test', enumValues)).to.throw(/Invalid type field definition/);
	});

	it('throws when enum() is called with empty values', function() {
		expect(api.enum.bind(api, 'Test', {})).to.throw(/Empty enums are not allowed/);
	});

	it('throws when enum() is called with non-object values', function() {
		expect(api.enum.bind(api, 'Test', 'Invalid')).to.throw(/Enum definition must be an object/);
	});

	it('throws when enum() is called with non-numeric values', function() {
		expect(api.enum.bind(api, 'Test', { A: 'a', B: 'b' })).to.throw(
			/Enum values must be numbers/
		);
	});

	it('converts values to names and names to names', function() {
		api.enum('Test', enumValues);
		const enumType = api.type('Test');

		expect(enumType).to.not.be.null;
		expect(enumType.convert).to.be.a('function');
		expect(enumType.convert.bind(enumType, [])).to.throw(/only numbers or strings are allowed/);
		expect(enumType.convert.bind(enumType, {})).to.throw(/only numbers or strings are allowed/);
		expect(enumType.convert.bind(enumType, 0)).to.not.throw();
		expect(enumType.convert.bind(enumType, 1)).to.not.throw();
		expect(enumType.convert(0)).to.eq(0);
		expect(enumType.convert(1)).to.eq(1);
		expect(enumType.convert('A')).to.eq(0);
		expect(enumType.convert('B')).to.eq(1);
		expect(enumType.convert('A', true)).to.eq(0);
		expect(enumType.convert('B', true)).to.eq(1);
		expect(enumType.convert.bind(enumType, 2)).to.throw(/Unknown enum .* value/);
		expect(enumType.convert.bind(enumType, 'C')).to.throw(/Unknown enum .* value/);
	});

	it('allows the old behaviour, if set so - return string for enums', function() {
		api.enum('Test', enumValues);
		const enumType = api.type('Test');

		jsonws.setUseStringEnums(true);
		expect(enumType.convert(0)).to.eq('A');
		expect(enumType.convert(1)).to.eq('B');
		expect(enumType.convert('A')).to.eq('A');
		expect(enumType.convert('B')).to.eq('B');
		expect(enumType.convert('A', true)).to.eq('A');
		expect(enumType.convert('B', true)).to.eq('B');
		jsonws.setUseStringEnums(false);
	});

	it('allows the old behaviour to be turned off after turned on', function() {
		api.enum('Test', enumValues);
		const enumType = api.type('Test');

		jsonws.setUseStringEnums(true);
		expect(enumType.convert(0)).to.eq('A');
		jsonws.setUseStringEnums(false);
		expect(enumType.convert(0)).to.eq(0);
		expect(enumType.convert('A')).to.eq(0);
		expect(enumType.convert('A', true)).to.eq(0);
	});
});

describe('Types - api.type()', function() {
	let api;

	beforeEach(function() {
		api = new Service('1.0.0', 'Test');
	});

	it('creates type through type() when name and definition are given', function() {
		api.type('Test', { width: 'int' }, 'Sample descriptive text');
		expect(api.typeMap['Test']).to.not.be.undefined;
		expect(api.typeMap['Test'].enum).to.be.undefined;
		expect(api.typeMap['Test'].description).to.eq('Sample descriptive text');
		expect(api.typeMap['Test'].struct).to.deep.eq(
			{
				width: {
					name: 'width',
					type: 'int',
					isArray: false,
					required: true,
					default: undefined,
					description: '',
				},
			},
			'type struct'
		);
	});

	it('creates internal types - */any', function() {
		['*', 'any'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert()).to.be.undefined;
			expect(testType.convert(1)).to.eq(1);
			expect(testType.convert('1')).to.eq('1');
			const o = {};
			expect(testType.convert(o)).to.eq(o);
			const a = [];
			expect(testType.convert(a)).to.eq(a);
		});
	});

	it('creates internal types - int/integer', function() {
		['int', 'integer'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert(1)).to.eq(1);
			expect(testType.convert('1')).to.eq(1);
			expect(testType.convert(-1)).to.eq(-1);
			expect(testType.convert('-1')).to.eq(-1);
			expect(testType.convert(1.1)).to.eq(1);
			expect(testType.convert(1.6)).to.eq(1);
			expect(testType.convert('1.1')).to.eq(1);
			expect(testType.convert('1.6')).to.eq(1);
			expect(testType.convert('1.6 invalid')).to.eq(1);
			expect(isNaN(testType.convert('invalid'))).to.be.true;
			expect(testType.convert.bind(testType, {})).to.throw(/Invalid integer value/);
			expect(testType.convert.bind(testType, [])).to.throw(/Invalid integer value/);
		});
	});

	it('creates internal types - number/float/double', function() {
		['number', 'float', 'double'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert(1)).to.eq(1);
			expect(testType.convert('1')).to.eq(1);
			expect(testType.convert(1.1)).to.eq(1.1);
			expect(testType.convert('1.1')).to.eq(1.1);
			expect(testType.convert(-1.1)).to.eq(-1.1);
			expect(testType.convert(1.6)).to.eq(1.6);
			expect(testType.convert('-1.6')).to.eq(-1.6);
			expect(testType.convert('-1.6 invalid')).to.eq(-1.6);
			expect(testType.convert('invalid')).to.eq(0);
			expect(testType.convert.bind(testType, {})).to.throw(/Invalid number value/);
			expect(testType.convert.bind(testType, [])).to.throw(/Invalid number value/);
		});
	});

	it('creates internal types - date/time', function() {
		['date', 'time'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert()).to.be.undefined;
			const date = new Date();

			expect(testType.convert(date).toString()).to.eq(new Date(date).toString());
			expect(testType.convert(date.getTime()).toString()).to.eq(new Date(date).toString());
			expect(testType.convert(date.toString()).toString()).to.eq(new Date(date).toString());
			expect(testType.convert.bind(testType, [])).to.throw(/Invalid date value/);
			expect(testType.convert.bind(testType, {})).to.throw(/Invalid date value/);
		});
	});

	it('creates internal types - bool/boolean', function() {
		['bool', 'boolean'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert(true)).to.be.true;
			expect(testType.convert('true')).to.be.true;
			expect(testType.convert(false)).to.be.false;
			expect(testType.convert('false')).to.be.false;
			expect(testType.convert.bind(testType, 'wrong')).to.throw(/Invalid boolean value/);
			expect(testType.convert(1)).to.be.true;
			expect(testType.convert({})).to.be.true;
			expect(testType.convert(0)).to.be.false;
			expect(testType.convert(null)).to.be.false;
			expect(testType.convert()).to.be.false; // testType.convert(undefined)
		});
	});

	it('creates internal types - object/json', function() {
		['object', 'json'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert({ test: 'me' })).to.deep.eq({ test: 'me' });
			expect(testType.convert('{"test": "me"}')).to.deep.eq({ test: 'me' });
			expect(testType.convert('["string",{"key":"value"},1234]')).to.deep.eq([
				'string',
				{ key: 'value' },
				1234,
			]);
			expect(testType.convert(1234)).to.deep.eq(1234);
			expect(testType.convert.bind(testType, 'invalid json')).to.throw(/Unexpected token/);
		});
	});

	it('creates internal types - string', function() {
		const testType = api.type('string');
		expect(testType).to.be.ok;
		expect(testType.type).to.eq('string');
		expect(testType.convert).to.be.a('function');
		expect(testType.convert('test')).to.eq('test');
		expect(() => testType.convert({ test: 'me' })).to.throw(/Invalid string value/);
		expect(testType.convert({ test: 'me' }, true)).to.eq(JSON.stringify({ test: 'me' }));
		expect(() => testType.convert(1234)).to.throw(/Invalid string value/);
		expect(testType.convert(1234, true)).to.eq('1234');
	});

	it('creates internal types - url', function() {
		const url = require('url');
		const testUrl = 'http://test.org/path';
		const testType = api.type('url');
		expect(testType).to.be.ok;
		expect(testType.type).to.eq('url');
		expect(testType.convert).to.be.a('function');
		expect(testType.convert(null)).to.be.null;
		expect(testType.convert(testUrl)).to.deep.eq(url.parse(testUrl));
		expect(testType.convert(testUrl, true)).to.eq(testUrl);
		expect(testType.convert(testUrl)).to.be.instanceOf(url.Url);
		expect(testType.convert.bind(testType, '')).to.throw(/Invalid URL value/);
		expect(testType.convert.bind(testType, [])).to.throw(/Invalid URL value/);
		expect(testType.convert.bind(testType, {})).to.throw(/Invalid URL value/);
	});

	it('creates internal types - binary/buffer', function() {
		['binary', 'buffer'].forEach(function(name) {
			const testType = api.type(name);
			expect(testType).to.be.ok;
			expect(testType.type).to.eq(name);
			expect(testType.convert).to.be.a('function');
			expect(testType.convert(new Buffer('test')).toString('base64')).to.eq(
				new Buffer('test').toString('base64')
			);
			expect(
				testType.convert(new Buffer('test').toString('base64')).toString('base64')
			).to.eq(new Buffer('test').toString('base64'));
			expect(testType.convert.bind(testType, { test: 'me' })).to.throw(/Invalid buffer data/);
		});
	});

	it('creates internal types - stream', function() {
		const testType = api.type('stream');
		const readableStream = new stream.Readable();
		const writeableStream = new stream.Writable();
		const transformStream = new stream.Transform();
		const duplexStream = new stream.Duplex();
		expect(testType).to.be.ok;
		expect(testType.type).to.eq('stream');
		expect(testType.convert).to.be.a('function');
		expect(testType.convert(readableStream, true)).to.eq(readableStream);
		expect(() => testType.convert(writeableStream, true)).to.throw(/Readable stream expected/);
		expect(testType.convert(transformStream, true)).to.eq(transformStream);
		expect(testType.convert(duplexStream, true)).to.eq(duplexStream);
		expect(() => testType.convert(readableStream, false)).to.throw(
			/Input streams are not supported/
		);
	});

	it('creates internal types - error', function() {
		const testType = api.type('error');

		expect(testType).to.be.ok;
		expect(testType.type).to.eq('error');
		expect(testType.convert).to.be.a('function');
		expect(testType.convert(new Error('FooBar'))).to.deep.eq({
			name: 'Error',
			message: 'FooBar',
		});
		expect(testType.convert(new TypeError('FooBar'))).to.deep.eq({
			name: 'TypeError',
			message: 'FooBar',
		});
		expect(testType.convert('FooBar')).to.deep.eq({ name: 'Error', message: 'FooBar' });
		expect(testType.convert({ message: 'FooBar' })).to.deep.eq({
			name: 'Error',
			message: 'FooBar',
		});
		expect(testType.convert({ name: 'MyError', message: 'FooBar' })).to.deep.eq({
			name: 'MyError',
			message: 'FooBar',
		});
		expect(testType.convert.bind(testType, 123)).to.throw(/Invalid error: 123/);
		expect(testType.convert.bind(testType, { a: 1 })).to.throw(/Invalid error/);
	});

	it('throws when type() is called without name', function() {
		expect(api.type.bind(api)).to.throw(/Types must have a name/);
		expect(api.type.bind(api, null)).to.throw(/Types must have a name/);
	});

	it('throws when type() is called without definition', function() {
		expect(api.type.bind(api, 'Test')).to.throw(/Type .* is undefined/);
	});

	it('throws when type() is called to override already defined user types', function() {
		api.type('Test', { test: 'string' });
		expect(api.type.bind(api, 'Test', { test: 'string' })).to.throw(
			/Types cannot be overriden/
		);
	});

	it('throws when type() is called to override internal types', function() {
		[
			'*',
			'any',
			'int',
			'integer',
			'number',
			'float',
			'double',
			'date',
			'time',
			'bool',
			'boolean',
			'object',
			'json',
			'string',
			'url',
			'buffer',
			'binary',
			'stream',
			'error',
		].forEach(function(internalType) {
			expect(api.type.bind(api, internalType, {})).to.throw(
				/Internal types cannot be overriden/
			);
		});
	});

	it('throws when type() is called with invalid field types', function() {
		expect(api.type.bind(api, 'Test', { test: 'invalid' })).to.throw(
			/Referenced type .* is undefined/
		);
		expect(api.type.bind(api, 'Test', { test: {} })).to.throw(/Missing type for field/);
		expect(api.type.bind(api, 'Test', { test: 1234 })).to.throw(
			/Invalid type field definition/
		);
		expect(api.type.bind(api, 'Test', { test: {} })).to.throw(/Missing type for field/);
		expect(api.type.bind(api, 'Test', { test: { type: 1234 } })).to.throw(
			/Invalid type field definition/
		);
		expect(api.type.bind(api, 'Test', { test: { type: null } })).to.throw(
			/Missing type for field/
		);
		expect(api.type.bind(api, 'Test', { test: { type: {} } })).to.throw(
			/Invalid type field definition/
		);
		expect(api.type.bind(api, 'Test', { test: { type: [] } })).to.throw(
			/Missing type for field/
		);
		expect(api.type.bind(api, 'Test', { test: { type: [1234] } })).to.throw(
			/Invalid type field definition/
		);
		expect(api.type.bind(api, 'Test', { test: { type: [{}] } })).to.throw(
			/Invalid type field definition/
		);
	});

	it('throws when a type definition contains the stream type', function() {
		expect(() =>
			api.type('Test', {
				field: 'stream',
			})
		).to.throw(/Input streams are not supported/);
	});

	it('allows simple type definition (only internal types, no arrays or enums)', function() {
		api.type('Test', {
			s: 'string',
			n: 'int',
			o: 'object',
			notRequired: {
				type: 'int',
				required: false,
				description: 'my description',
				default: 1234,
			},
			notRequiredNoDefault: {
				type: 'int',
				required: false,
			},
		});

		const testType = api.type('Test');

		expect(testType.struct.notRequired.description).to.eq('my description');

		expect(testType.convert.bind(testType)).to.throw(/Simple value cannot be converted/);
		expect(testType.convert.bind(testType, 1234)).to.throw(/Simple value cannot be converted/);
		expect(testType.convert.bind(testType, 'invalid')).to.throw(
			/Simple value cannot be converted/
		);
		expect(testType.convert.bind(testType, {})).to.throw(/Required field has no value: s/);
		expect(testType.convert.bind(testType, { s: 's' })).to.throw(
			/Required field has no value: n/
		);
		expect(testType.convert.bind(testType, { s: 's', n: 1 })).to.throw(
			/Required field has no value: o/
		);
		expect(
			testType.convert.bind(testType, { s: 's', n: 1, o: { test: 'any' } })
		).not.to.throw();
		expect(testType.convert.bind(testType, { s: null, n: 1, o: { test: 'any' } })).to.throw(
			/Required field has no value/
		);
		expect(testType.convert.bind(testType, null)).not.to.throw;
		expect(testType.convert.bind(testType, void 0)).to.throw;
		expect(testType.convert.bind(testType, { s: '', n: 0, o: undefined })).to.throw(
			/Required field has no value/
		);
		expect(testType.convert({ s: 's', n: '1', o: '{"test": "any"}' })).to.deep.eq({
			s: 's',
			n: 1,
			o: { test: 'any' },
			notRequired: 1234,
			notRequiredNoDefault: undefined,
		});
	});

	it('allows complex type definition (refenced types, deep nesting)', function() {
		api.enum('TestMode', { A: 1, B: 2 });
		api.type('Options', {
			testMode: 'TestMode',
			parameter1: 'string',
			parameter2: 'double',
			parameter3: {
				type: 'int',
				required: false,
			},
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
					parameter3: 10,
				},
			},
		});

		const testType = api.type('Test');

		expect(
			testType.convert({
				name: 'test name',
				options: {
					testMode: 'A',
					parameter1: 'p1',
					parameter2: 0.0,
				},
			})
		).to.deep.eq({
			name: 'test name',
			options: {
				testMode: 1,
				parameter1: 'p1',
				parameter2: 0.0,
				parameter3: undefined,
			},
			defaultOptions: {
				testMode: 2,
				parameter1: 'string',
				parameter2: 1.1,
				parameter3: 10,
			},
		});

		expect(
			testType.convert.bind(testType, {
				name: 'test name',
				options: {
					testMode: 1,
					parameter1: 'p1',
					parameter2: 0.0,
				},
			})
		).to.not.throw();

		expect(
			testType.convert.bind(testType, {
				name: 'test name',
				options: {
					testMode: 1,
					parameter1: 'p1',
				},
			})
		).to.throw(/Required field has no value: parameter2/);

		expect(
			testType.convert.bind(testType, {
				name: 'test name',
				options: {
					testMode: 1,
				},
			})
		).to.throw(/Required field has no value: parameter1/);

		expect(
			testType.convert.bind(testType, {
				name: 'test name',
				options: {
					testMode: 0,
				},
			})
		).to.throw(/Unknown enum .* value/);

		expect(
			testType.convert.bind(testType, {
				name: 'test name',
			})
		).to.throw(/Required field has no value: options/);
	});

	it('allow complex type definition (arrays)', function() {
		api.type('Foo', { bar: 'string' });
		api.type('Test', {
			ints: ['int'],
			complex: {
				type: ['Foo'],
			},
		});
		api.type('OptionalTest', {
			ints: ['int'],
			field1: { type: 'Foo', required: false },
			field2: { type: ['Foo'], required: false },
		});

		let testType = api.type('Test');

		expect(
			testType.convert(
				{
					ints: [1, '2', '3.3', 4, 5],
					complex: [{ bar: 'string' }, { bar: [1234, 5678] }, { bar: 1234 }],
				},
				true
			)
		).to.deep.eq({
			ints: [1, 2, 3, 4, 5],
			complex: [{ bar: 'string' }, { bar: '[1234,5678]' }, { bar: '1234' }],
		});

		expect(
			testType.convert.bind(testType, {
				ints: 'invalid',
				complex: {},
			})
		).to.throw(/Field .* must be an array/);

		expect(
			testType.convert.bind(testType, {
				ints: [0, 1, 2],
				complex: {
					type: {}, // invalid
				},
			})
		).to.throw(/Field .* must be an array/);

		// Optional type test
		testType = api.type('OptionalTest');

		expect(testType.convert({ ints: [1, '2', '3.3', 4, 5] })).to.deep.eq({
			ints: [1, 2, 3, 4, 5],
			field1: undefined,
			field2: undefined,
		});

		expect(testType.convert({ ints: [1], field1: { bar: 'test' } })).to.deep.eq({
			ints: [1],
			field1: { bar: 'test' },
			field2: undefined,
		});

		expect(testType.convert({ ints: [1], field2: [{ bar: 'test' }] })).to.deep.eq({
			ints: [1],
			field1: undefined,
			field2: [{ bar: 'test' }],
		});
	});
});

describe('Events', function() {
	let api;

	beforeEach(function() {
		api = new Service('1.0.0', 'Test API');
		api.type('TestType', {
			a: 'int',
			b: 'string',
		});
	});

	it('works with valid definition - no type or description', function() {
		expect(api.event.bind(api, 'OnTestEvent')).not.to.throw();
		expect(api.eventMap['OnTestEvent']).to.be.ok;
		expect(api.eventMap['OnTestEvent']).to.deep.eq({
			name: 'OnTestEvent',
			type: null,
			isArray: false,
			description: '',
		});
	});

	it('works with valid definition - type and description', function() {
		expect(
			api.event.bind(api, 'OnOtherEvent', { type: 'int', description: 'Foobar' })
		).not.to.throw();
		expect(api.eventMap['OnOtherEvent']).to.be.ok;
		expect(api.eventMap['OnOtherEvent']).to.deep.eq({
			name: 'OnOtherEvent',
			type: 'int',
			isArray: false,
			description: 'Foobar',
		});
	});

	it('works with valid definition - only description', function() {
		expect(api.event.bind(api, 'OnEventWithDescription', 'Description')).not.to.throw();
		expect(api.eventMap['OnEventWithDescription']).to.be.ok;
		expect(api.eventMap['OnEventWithDescription']).to.deep.eq({
			name: 'OnEventWithDescription',
			type: null,
			isArray: false,
			description: 'Description',
		});
	});

	it('works with valid definition - namespaced event', function() {
		api.setNamespace('test.me');
		expect(api.event.bind(api, 'OnTestEvent')).not.to.throw();
		expect(api.eventMap['test.me.OnTestEvent']).to.be.ok;
		expect(api.eventMap['test.me.OnTestEvent']).to.deep.eq({
			name: 'test.me.OnTestEvent',
			type: null,
			isArray: false,
			description: '',
		});
	});

	it('does not work with invalid definitions', function() {
		expect(api.event.bind(api)).to.throw(/Service events MUST have a name/);
		expect(api.event.bind(api, 'OnEvent', ['invalid options'])).to.throw(
			/Event options must be an object/
		);
		expect(api.event.bind(api, 'OnEvent', 1234)).to.throw(/Event options must be an object/);
		expect(api.event.bind(api, 'OnEvent', { type: 'Unkown Type' })).to.throw(
			/Undefined event type/
		);
		api.event('OnEvent');
		expect(api.event('OnEvent')).to.deep.eq(api.eventMap['OnEvent']);
		expect(api.event.bind(api, 'OnEvent', { type: 'int' })).to.throw(
			/Overriding events is not allowed/
		);
		expect(api.define.bind(api, { name: 'OnEvent', event: true })).to.throw(
			/Registering events using the define method is obsolete/
		);
	});

	it('returns the event info when invoked with the event name without event definition', function() {
		const eventName = 'testEvent';
		api.event(eventName, { type: 'TestType' });
		expect(api.event(eventName)).to.deep.eq(api.eventMap[eventName]);
		expect(api.type(api.event(eventName).type)).to.deep.eq(api.type('TestType'));
	});
});

describe('Methods', function() {
	let api;

	beforeEach(function() {
		api = new Service('1.0.0', 'Test API');
	});

	it('supports empty definition with string, throws on usage', function() {
		api.define('method');

		expect(api.methodMap['method']).to.be.ok;
		expect(api.fn.method.bind(api.fn)).to.throw(/not yet implemented/);
	});

	it('supports empty definition with object, throws on usage', function() {
		api.define({ name: 'method' });

		expect(api.methodMap['method']).to.be.ok;
		expect(api.fn.method.bind(api.fn)).to.throw(/not yet implemented/);
	});

	it('supports definition with string name and function', function() {
		api.define('method', function() {
			return 1;
		});

		expect(api.methodMap['method']).to.be.ok;
		expect(api.fn.method.bind(api.fn)).not.to.throw();
		expect(api.fn.method()).to.eq(1);
	});

	it('does not work with invalid definitions', function() {
		expect(api.define.bind(api)).to.throw(/Invalid definition options/);
		expect(api.define.bind(api, ['invalid'])).to.throw(/Invalid definition options/);
		expect(api.define.bind(api, 1234)).to.throw(/Invalid definition options/);

		expect(api.define.bind(api, {})).to.throw(/Service methods MUST have a name/);
		expect(api.define.bind(api, { name: 'test', returns: 'invalid' })).to.throw(
			/Undefined return type/
		);
		expect(api.define.bind(api, { name: 'test', returns: [] })).to.throw(
			/Undefined return type/
		);

		expect(api.define.bind(api, { name: 'test', params: 'invalid' })).to.throw(
			/The params property must be an array/
		);
		expect(api.define.bind(api, { name: 'test', params: {} })).to.throw(
			/The params property must be an array/
		);
		expect(api.define.bind(api, { name: 'test', params: 1234 })).to.throw(
			/The params property must be an array/
		);

		expect(api.define.bind(api, { name: 'test', params: [{}] })).to.throw(
			/Unnamed method parameter/
		);
		expect(api.define.bind(api, { name: 'test', params: [{ type: 'string' }] })).to.throw(
			/Unnamed method parameter/
		);

		expect(
			api.define.bind(api, { name: 'test', params: [{ name: 'test', type: ['strings'] }] })
		).to.throw(/Undefined type/);
		expect(
			api.define.bind(api, { name: 'test', params: [{ name: 'test', type: [] }] })
		).to.throw(/Missing type for param test/);

		expect(
			api.define.bind(api, {
				name: 'test',
				params: [{ name: 'test', type: { name: 'invalid' } }],
			})
		).to.throw(/Inline type definitions are not supported/);
		expect(
			api.define.bind(api, { name: 'test', params: [{ name: 'test', type: 'invalid' }] })
		).to.throw(/Undefined type/);
		expect(
			api.define.bind(api, { name: 'test', params: [{ name: 'test', type: 'stream' }] })
		).to.throw(/Input streams are not supported/);
	});

	it('supports complex definitions - parameters and context this', function() {
		api.define(
			{
				name: 'test',
				params: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
			},
			function(a, b) {
				return a + b;
			}
		);
		expect(api.fn.test(2, 3)).to.eq(5);

		api.define(
			{
				name: 'test2',
				params: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }],
				this: {
					sum: function(a, b) {
						return a + b;
					},
				},
			},
			function(a, b) {
				return this.sum(a, b);
			}
		);
		expect(api.fn.test2(2, 3)).to.eq(5);

		api.define({
			name: 'sum',
			this: {
				sum: function(a, b) {
					return a + b;
				},
			},
		});
		expect(api.fn.sum(2, 3)).to.eq(5);

		api.define(
			{
				name: 'sumRemapped',
				this: {
					internalMethodToRemap: function(a, b) {
						return a + b;
					},
				},
			},
			'internalMethodToRemap'
		);
		expect(api.fn.sumRemapped(2, 3)).to.eq(5);

		api.define({
			name: 'fail',
			this: {
				fail: function() {
					throw new Error('Custom error');
				},
			},
		});
		expect(api.fn.fail.bind(api)).to.throw(/Custom error/);

		api.define({ name: 'fail', this: {} }, 'fail');
		expect(api.fn.fail.bind(api)).to.throw(/Invalid method invocation/);

		api.define({ name: 'missing', this: {} }, 'remappedMissing');
		expect(api.fn.missing.bind(api)).to.throw(/Invalid method invocation/);

		api.define({ name: 'testArrayParam', params: [{ name: 'test', type: ['string'] }] });
		expect(api.methodMap['testArrayParam'].params[0].isArray).to.be.true;
		expect(api.methodMap['testArrayParam'].params[0].type).to.eq('string');

		api.define({
			name: 'optionalArgs',
			params: [
				{ name: 'p1', type: 'int', default: 0 },
				{ name: 'required', type: 'bool' },
				{ name: 'p2', type: 'int', default: 1 },
			],
		});
		expect(api.methodMap['optionalArgs'].params[0].name).to.eq('required');
		expect(api.methodMap['optionalArgs'].params[1].name).to.eq('p1');
		expect(api.methodMap['optionalArgs'].params[2].name).to.eq('p2');
		expect(api.methodMap['optionalArgs'].params[1].default).to.eq(0);
		expect(api.methodMap['optionalArgs'].params[2].default).to.eq(1);
	});

	it('supports namespaces', function() {
		api.define('a.test');
		api.define('b.test');
		api.define('a.b.test');

		expect(api.fn.a.test).to.be.ok;
		expect(api.fn.b.test).to.be.ok;
		expect(api.fn.a.b.test).to.be.ok;

		expect(api.fn.a.test.bind(api.fn.a)).to.throw(/not yet implemented/);
		expect(api.fn.b.test.bind(api.fn.b)).to.throw(/not yet implemented/);
		expect(api.fn.a.b.test.bind(api.fn.a.b)).to.throw(/not yet implemented/);

		api.define('test.namespace.math.sum', function(a, b) {
			return a + b;
		});
		expect(api.fn.test.namespace.math.sum(2, 3)).to.eq(5);
	});
});

describe('Groups', function() {
	let api;

	beforeEach(function() {
		api = new Service('1.0.0', 'Test API');
	});

	it('uses the default group by default', function() {
		api.define('method');
		expect(api.groups['Default']).to.be.ok;
		expect(api.currentGroup.name).to.eq(api.groups['Default'].name);
		expect(api.groups['Default'].items[0]).to.eq('method:method');
	});

	it('supports multiple groups', function() {
		api.define('method');
		api.setGroup('Group1').define('method1');
		api.setGroup('Group2').define('method2');
		expect(api.groups['Group1']).to.be.ok;
		expect(api.groups['Group1'].items[0]).to.eq('method:method1');
		expect(api.groups['Group2']).to.be.ok;
		expect(api.groups['Group2'].items[0]).to.eq('method:method2');
	});

	it('supports group description, name, structure', function() {
		api.setGroup('Test', 'Test description');
		expect(api.groups['Test'].name).to.eq('Test');
		expect(api.groups['Test'].description).to.eq('Test description');
		expect(api.groups['Test'].items).to.be.an('array');
	});
});

describe('External definitions', function() {
	const implementations = {
		sum: function(a, b) {
			return a + b;
		},
		method1: function(a, b) {
			return a + b;
		},
		method2: function() {},
	};
	let api;

	beforeEach(function() {
		api = new Service('1.0.0', 'Test API');
	});

	it('allows external definitions using code', function() {
		api.import(path.resolve(__dirname, 'resources', 'server-def-code.js'));

		expect(api.fn.sum).to.be.ok;
		expect(api.fn.sum(2, 3)).to.eq(5);

		expect(api.typeMap['RenderMode']).to.be.ok;
		expect(api.typeMap['RenderOptions']).to.be.ok;

		expect(api.methodMap['sum'].description).to.eq('Returns the sum of two numbers');

		expect(api.eventMap['ontest']).to.be.ok;
		expect(api.eventMap['ontest'].description).to.eq('test event');
	});

	it('allows external definitions using JSON', function() {
		api.import(path.resolve(__dirname, 'resources', 'server-def-json.js'));
		api.defineAll(implementations);

		expect(api.fn.sum).to.be.ok;
		expect(api.fn.sum(2, 3)).to.eq(5);

		expect(api.typeMap['RenderMode']).to.be.ok;
		expect(api.typeMap['RenderOptions']).to.be.ok;

		expect(api.methodMap['sum'].description).to.eq('Returns the sum of two numbers');

		expect(api.eventMap['ontest']).to.be.ok;
		expect(api.eventMap['ontest'].description).to.eq('test event');
	});

	it('external definitions using JSON, import clause is at the top', function() {
		expect(() => {
			api.import(path.resolve(__dirname, 'resources', 'server-def-json-include-top.js'));
		}).to.not.throw();
	});

	it('external definitions using JSON, import clause is at the bottom', function() {
		expect(() => {
			api.import(path.resolve(__dirname, 'resources', 'server-def-json-include-bottom.js'));
		}).to.not.throw();
	});

	it('external definitions using object and allow recursive definition', function() {
		expect(() =>
			api.import({
				types: {
					AssetDescription: {
						struct: {
							name: {
								type: 'string',
								description: 'The name of the asset',
							},
							hash: {
								type: 'string',
								description: 'The hash of the asset if it is a file.',
								required: false,
							},
							contents: {
								type: ['AssetDescription'],
								description: 'The description of the contents (if directory)',
								required: false,
							},
						},
					},
				},
			})
		).to.not.throw();
		expect(api.type('AssetDescription')).to.be.ok;
	});

	function splitLines(text) {
		let arr;
		if (text.indexOf('\r\n') > -1) {
			arr = text.split('\r\n');
		} else {
			arr = text.split('\n');
		}
		return arr.splice(0, arr.length - 1);
	}

	function expectExamplesAndSnippets(api) {
		expect(api.methodMap['method1'].examples['JavaScript']).to.be.ok;
		expect(api.methodMap['method1'].examples['Java']).to.be.ok;
		expect(splitLines(api.methodMap['method1'].examples['HTTP'])).to.deep.eq(['[1, 2]']);
		expect(api.methodMap['method2'].examples['HTTP']).to.be.ok;
		expect(splitLines(api.methodMap['method2'].examples['JavaScript'])).to.deep.eq([
			'proxy.method2();',
		]);
		expect(api.snippetMap['snippet1']['JavaScript']).to.be.ok;
		expect(api.snippetMap['snippet1']['Java']).to.be.ok;
		expect(api.snippetMap['snippet1']['Node']).to.be.ok;
		expect(splitLines(api.snippetMap['snippet1']['Java'])).to.deep.eq([
			'int a = proxy.method1(1, 2).get();',
			'proxy.method2().get();',
		]);
		expect(api.snippetMap['snippet2']['JavaScript']).to.be.ok;
	}

	function importExamples(api) {
		api.examples(path.resolve(__dirname, 'resources', 'examples_snippets.js'));
		api.examples(path.resolve(__dirname, 'resources', 'examples_snippets.node.js'));
		api.examples(path.resolve(__dirname, 'resources', 'examples_snippets.java'));
		api.examples(path.resolve(__dirname, 'resources', 'examples.curl'));
	}

	it('imports examples and snippets before definitions', function() {
		importExamples(api);
		api.defineAll(implementations);
		expectExamplesAndSnippets(api);
	});

	it('imports examples and snippets after definitions', function() {
		api.defineAll(implementations);
		importExamples(api);
		expectExamplesAndSnippets(api);
	});
});
