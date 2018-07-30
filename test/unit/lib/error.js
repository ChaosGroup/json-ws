'use strict';

const chai = require('chai');
const expect = chai.expect;

const ServiceError = require('../../../lib/error');
const { AsServiceError } = require('../../../lib/error');

describe('Converter', function() {
	const REPORTER = 'service';
	const ERROR_CODE = 432;
	const DEFAULT_ERROR_CODE = 100;
	const MESSAGE = 'something went wrong';
	const CAUSE_REPORTER = 'reporter';
	const CAUSE_CODE = 111;
	const CAUSE_MESSAGE = 'cause message';

	it('returns ServiceError as is', function() {
		const error = new ServiceError(REPORTER, ERROR_CODE, { message: MESSAGE });

		const actual = AsServiceError(error);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.id).to.be.ok;
		expect(actual.timestamp).to.be.ok;

		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(ERROR_CODE);
		expect(actual.message).to.equal(MESSAGE);
	});

	it('returns ServiceError with InternalServerError code', function() {
		const error = new ServiceError(REPORTER, undefined, {});

		const actual = AsServiceError(error);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(DEFAULT_ERROR_CODE);
	});

	it('wraps ServiceError with different reporter', function() {
		const error = new ServiceError('different', 111, {});

		const actual = AsServiceError(error, REPORTER);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(DEFAULT_ERROR_CODE);
		expect(actual.cause).to.equal(error);
	});

	it('returns ServiceError with zero error code', function() {
		const actual = AsServiceError('something went wrong', REPORTER, 0);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(0);
	});

	it('wraps ServiceError with zero error code', function() {
		const error = new ServiceError(REPORTER, 0, {});

		const actual = AsServiceError(error, REPORTER);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(0);
	});

	it('wraps Error', function() {
		const error = new Error(MESSAGE);

		const actual = AsServiceError(error, REPORTER);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.id).to.be.ok;
		expect(actual.timestamp).to.be.ok;

		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(DEFAULT_ERROR_CODE);
		expect(actual.message).to.equal(MESSAGE);
	});

	it('wraps Error with data property', function() {
		const error = new Error('some error message');
		error.data = {
			reporter: CAUSE_REPORTER,
			code: CAUSE_CODE,
			message: CAUSE_MESSAGE,
		};

		const actual = AsServiceError(error, REPORTER);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.id).to.be.ok;
		expect(actual.timestamp).to.be.ok;

		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(DEFAULT_ERROR_CODE);
		expect(actual.message).to.equal(CAUSE_MESSAGE);

		expect(actual.cause).to.be.defined;
		expect(actual.cause.reporter).to.equal(CAUSE_REPORTER);
		expect(actual.cause.code).to.equal(CAUSE_CODE);
		expect(actual.cause.message).to.equal(CAUSE_MESSAGE);
	});

	it('wraps JSON-RPC Error', function() {
		const error = {
			code: -32000,
			message: 'error message',
			data: {
				reporter: CAUSE_REPORTER,
				code: CAUSE_CODE,
				message: CAUSE_MESSAGE,
			},
		};

		const actual = AsServiceError(error, REPORTER);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.id).to.be.ok;
		expect(actual.timestamp).to.be.ok;

		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(DEFAULT_ERROR_CODE);

		expect(actual.cause).to.be.defined;
		expect(actual.cause.reporter).to.equal(CAUSE_REPORTER);
		expect(actual.cause.code).to.equal(CAUSE_CODE);
		expect(actual.cause.message).to.equal(CAUSE_MESSAGE);
	});

	it('wraps error message', function() {
		const error = 'String error message';

		const actual = AsServiceError(error, REPORTER);
		expect(actual).to.be.an.instanceof(ServiceError);
		expect(actual.id).to.be.ok;
		expect(actual.timestamp).to.be.ok;
		expect(actual.reporter).to.equal(REPORTER);
		expect(actual.code).to.equal(DEFAULT_ERROR_CODE);
		expect(actual.message).to.equal(error);
	});
});
