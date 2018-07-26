/**
 * Tests the API of the JSON-WS library
 */

'use strict';

const expect = require('chai').expect;
const jsonws = require('../../../index.js');
const Service = jsonws.service;

describe('Converters', function() {
	let api;
	let testType;
	const converting = function(value) {
		return function() {
			testType.convert(value);
		};
	};

	beforeEach(function() {
		api = new Service('1.0.0', 'test-api');
		api.type('TestType', {
			intField: {
				type: 'int',
				required: false,
			},
			floatField: {
				type: 'float',
				required: false,
			},
			booleanField: {
				type: 'boolean',
				required: false,
			},
			dateField: {
				type: 'date',
				required: false,
			},
			urlField: {
				type: 'url',
				required: false,
			},
			bufferField: {
				type: 'buffer',
				required: false,
			},
			errorField: {
				type: 'error',
				required: false,
			},
		});

		testType = api.type('TestType');
	});

	it('adds the field name for invalid integer values', function() {
		expect(converting({ intField: null })).to.throw(/\[TestType.intField\].*invalid integer/i);
	});

	it('adds the field name for invalid float values', function() {
		expect(converting({ floatField: null })).to.throw(
			/\[TestType.floatField\].*invalid number/i
		);
	});

	it('adds the field name for invalid boolean values', function() {
		expect(converting({ booleanField: 'INVALID_BOOLEAN' })).to.throw(
			/\[TestType.booleanField\].*invalid boolean/i
		);
	});

	it('adds the field name for invalid date values', function() {
		expect(converting({ dateField: { INVALID_DATE: true } })).to.throw(
			/\[TestType.dateField\].*invalid date/i
		);
	});

	it('adds the field name for invalid url values', function() {
		expect(converting({ urlField: 1234 })).to.throw(/\[TestType.urlField\].*invalid URL/i);
	});

	it('adds the field name for invalid buffer values', function() {
		expect(converting({ bufferField: null })).to.throw(
			/\[TestType.bufferField\].*invalid buffer/i
		);
	});

	it('adds the field name for invalid error values', function() {
		expect(converting({ bufferField: '', errorField: 42 })).to.throw(
			/\[TestType.errorField\].*invalid error/i
		);
	});
});
