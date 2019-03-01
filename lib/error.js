'use strict';

const uuid = require('node-uuid');

/**
 * Structured error containing context.
 * @extends Error
 */
class ServiceError {
	/**
	 * Create a structured error. Required properties are id, reporter, code and timestamp.
	 *
	 * @param {string} reporter The name of the entity which reports the error.
	 * @param {number} code System-wide unique integer that identifies a specific type of error.
	 * @param {object} details Information about the context of the error.
	 * @param {string} details.message Human-readable short error message.
	 * @param {ServiceError} details.cause The cause of the error.
	 * @param {object} details.metadata Error payload which provides additional context.
	 */
	constructor(reporter, code, { message, cause, metadata }) {
		Error.captureStackTrace(this, this.constructor);

		this.id = uuid.v4();
		this.reporter = reporter;
		this.code = code;
		this.message = message;
		this.cause = cause;
		this.metadata = metadata;
		this.timestamp = new Date();
	}

	/**
	 * Presents the error in an appropriate format.
	 * @returns {string}
	 */
	toString() {
		let output =
			`reporter: ${this.reporter}\n` + `code: ${this.code}\n` + `message: ${this.message}\n`;
		if (this.cause) {
			output += `cause: ${this.cause.code} ${this.cause.message}\n`;
		}
		return output + `metadata: ${JSON.stringify(this.metadata)}`;
	}

	logFields() {
		return {
			id: this.id,
			reporter: this.reporter,
			code: this.code,
			message: this.message,
			cause: this.cause,
			metadata: this.metadata,
			stack: this.stack,
			errorTimestamp: this.timestamp,
		};
	}
}

const codes = {
	InternalServerError: 100,
};

module.exports = ServiceError;

module.exports.AsServiceError = (err, reporter, code, metadata) => {
	code = code || code === 0 ? code : codes.InternalServerError;

	if (err instanceof ServiceError) {
		err.code = err.code || err.code === 0 ? err.code : codes.InternalServerError;
		if (reporter && err.reporter !== reporter) {
			return new ServiceError(reporter, err.code, {
				message: err.message,
				cause: err,
				metadata,
			});
		}
		return err;
	}

	// Check for a JSON-RPC error.
	if (err.hasOwnProperty('data')) {
		code = err.data.code || err.data.code === 0 ? err.data.code : code;
		return new ServiceError(reporter, code, {
			message: err.data.message,
			cause: err.data,
			metadata,
		});
	}

	if (err instanceof Error) {
		return new ServiceError(reporter, code, {
			message: err.message,
			metadata,
		});
	}

	return new ServiceError(reporter, code, {
		message: err,
		metadata,
	});
};
