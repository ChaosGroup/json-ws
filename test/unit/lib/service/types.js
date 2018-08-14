'use strict';

const types = require('../../../../lib/service/types.js');
const expect = require('chai').expect;
const url = require('url');
const stream = require('stream');

describe('Types', function() {
	describe('typeHelpers', function() {
		describe('missingDocumentation', function() {
			it('returns an empty documentation', function() {
				expect(types.missingDocumentation).to.eq('');
			});
		});

		describe('isInternal', function() {
			it('returns whether a type is internal', function() {
				const internalTypes = [
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
					'async',
				];
				const nonInternalTypes = ['cat', 'dog', 'spinach', 'car'];

				expect(internalTypes.filter(val => types.isInternal(val)).length).to.eq(
					internalTypes.length
				);
				expect(nonInternalTypes.filter(val => types.isInternal(val)).length).to.eq(0);
			});
		});

		describe('converter', function() {
			it('throws if the type is not internal', function() {
				expect(() => {
					types.converter('car');
				}).to.throw(/The specified type.*is not internal/i);
			});

			it('returns a converter for the specified type', function() {
				expect(types.converter('number')('24')).to.eq(24);
			});
		});

		describe('typeStructFromDef', function() {
			it('ensures that every field has a type property', function() {
				const invalidTypeDef = {
					object: {},
				};
				const validTypeDef = {
					object: 'string',
				};

				expect(() => {
					types.typeStructFromDef('type', invalidTypeDef, function() {});
				}).to.throw(/missing type for field/i);
				expect(() => {
					types.typeStructFromDef('type', validTypeDef, function() {});
				}).not.to.throw(/missing type for field/i);
			});

			it('ensures that every type property is a string', function() {
				const invalidTypeDef = {
					object: { type: {} },
				};
				const validTypeDef = {
					object: { type: 'number' },
				};

				expect(() => {
					types.typeStructFromDef('type', invalidTypeDef);
				}).to.throw(/invalid type field definition/i);
				expect(() => {
					types.typeStructFromDef('type', validTypeDef);
				}).not.to.throw(/invalid type field definition/i);
			});

			it('ensures that type property types are defined', function() {
				const validTypeDef = {
					object: { type: 'string' },
				};
				const invalidTypeDef = {
					object: { type: 'ivan' },
				};

				expect(() => {
					types.typeStructFromDef('type', validTypeDef, function() {
						return false;
					});
				}).not.to.throw(/referenced type .* is undefined/i);
				expect(() => {
					types.typeStructFromDef('type', invalidTypeDef, function() {
						return false;
					});
				}).to.throw(/referenced type .* is undefined/i);
			});

			it('ensures that no stream type properties are used', function() {
				const invalidTypeDef = {
					object: { type: 'stream' },
				};

				expect(() => {
					types.typeStructFromDef('type', invalidTypeDef, function() {
						return true;
					});
				}).to.throw(/input streams are not supported/i);
			});

			it('validates the type of a field definiton', function() {
				const invalidTypeDef = {
					invalidField: 42,
				};
				const validTypeDef = {
					validField: { type: 'number' },
				};

				expect(() => {
					types.typeStructFromDef('vtypeDef', invalidTypeDef, function() {
						return false;
					});
				}).to.throw(/invalid type field definition.*/i);
				expect(() => {
					types.typeStructFromDef('invtypeDef', validTypeDef, function() {
						return false;
					});
				}).not.to.throw(/invalid type field definition.*/i);
			});

			it('correctly defines a type struct', function() {
				const carTypeDef = {
					owner: 'string',
					plateNumber: ['string', 'number'],
					model: { type: ['string', 'number'], required: true },
				};

				const result = types.typeStructFromDef('car', carTypeDef, function() {
					return false;
				});

				const expected = {
					owner: {
						name: 'owner',
						type: 'string',
						isArray: false,
						required: true,
						default: undefined,
						description: '',
					},
					plateNumber: {
						name: 'plateNumber',
						type: 'string',
						isArray: true,
						required: true,
						default: undefined,
						description: '',
					},
					model: {
						name: 'model',
						type: 'string',
						isArray: true,
						required: true,
						default: undefined,
						description: '',
					},
				};

				expect(result).to.deep.eq(expected);
			});
		});

		describe('methodNotImplemented', function() {
			it('returns a function that throws', function() {
				const exampleMethodNames = ['getName', 'getAge', 'getMother'];

				exampleMethodNames.map(name => {
					const throwFunc = types.methodNotImplemented(name);
					expect(() => {
						throwFunc();
					}).to.throw(new RegExp(`"${name}" is not yet implemented`, 'i'));
				});
			});
		});

		describe('isPromise', function() {
			it('returns whether an object is a promise', function() {
				expect(
					types.isPromise(
						new Promise((res, rej) => {
							res(42);
						})
					)
				).to.be.true;

				const falseValues = [42, '42', { val: 42 }, function() {}, Object.create(null)];
				falseValues.forEach(val => {
					expect(types.isPromise(val)).to.be.false;
				});

				expect(types.isPromise(null)).to.not.exist;
			});
		});

		describe('isGeneratorFunction', function() {
			it('returns whether an object is a generator function', function() {
				expect(types.isGeneratorFunction(function*() {})).to.be.true;

				const falseValues = [Object.create(null), function() {}, 42, '42', { val: 42 }];
				falseValues.forEach(val => {
					expect(types.isGeneratorFunction(val)).to.be.false;
				});
			});
		});
	});

	describe('converters', function() {
		describe('anyConverter', function() {
			it('correctly coverts values', function() {
				const vals = [{}, 42, 'string', function() {}];
				vals.forEach(val => {
					expect(types.converter('any')(val)).to.eq(val);
				});
			});
		});

		describe('intConverter', function() {
			const converter = types.converter('int');

			it('handles null values', function() {
				expect(converter()).to.eq(undefined);
			});

			it('validates value type to be string or number', function() {
				const invalidValues = [{ obj: 'str' }, function() {}, []];
				invalidValues.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid integer value/i);
				});
			});

			it('correctly converts values', function() {
				const values = ['42', 17, '15.2'];
				values.forEach(val => {
					expect(converter(val)).to.eq(Math.floor(Number(val)));
				});
			});
		});

		describe('numberConverter', function() {
			const converter = types.converter('number');

			it('handles null values', function() {
				expect(converter()).to.eq(undefined);
			});

			it('validates value type to be string or number', function() {
				const invalidValues = [{ obj: 'str' }, function() {}, []];
				invalidValues.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid number value/i);
				});
			});

			it('correctly converts values', function() {
				const values = ['42', 17, '-15.2', 'cat'];
				values.forEach(val => {
					expect(converter(val)).to.eq(parseFloat(val) || 0.0);
				});
			});
		});

		describe('dateConverter', function() {
			const converter = types.converter('date');

			it('handles null values', function() {
				expect(converter()).to.eq(undefined);
			});

			it('validates value type to be string, number or Date object', function() {
				const invalidValues = [{ obj: 'str' }, function() {}, []];
				invalidValues.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid date value/i);
				});
			});

			it('correctly converts values', function() {
				const values = ['42', 17, '-15.2', 'cat', new Date(15)];
				values.forEach(val => {
					expect(converter(val)).to.deep.eq(new Date(val));
				});
			});
		});

		describe('boolConverter', function() {
			const converter = types.converter('bool');

			it('validates string value if string provided', function() {
				const invalidValues = ['cat', 'dog'];
				invalidValues.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid boolean value/i);
				});
			});

			it('correctly converts values', function() {
				const truthyValues = ['true', '   true ', 15, {}, function() {}, []];
				truthyValues.forEach(val => {
					expect(converter(val)).to.eq(true);
				});

				const falsyValues = ['false', '  false ', 0, NaN, undefined, null];
				falsyValues.forEach(val => {
					expect(converter(val)).to.eq(false);
				});
			});
		});

		describe('objectConverter', function() {
			const converter = types.converter('object');

			it('correctly converts values', function() {
				const jsonString = '{"name":"Ivan","nickname":"Vankata"}';
				const expectedObj = {
					name: 'Ivan',
					nickname: 'Vankata',
				};
				expect(converter(jsonString)).to.deep.eq(expectedObj);

				const nonStringValues = [function() {}, 42, {}, []];
				nonStringValues.forEach(val => {
					expect(converter(val)).to.eq(val);
				});
			});
		});

		describe('stringConverter', function() {
			const converter = types.converter('string');

			it('validates string values', function() {
				const nonOutValues = [42, {}, function() {}, []];
				nonOutValues.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid string value/i);
				});
			});

			it('correctly converts values', function() {
				const nonStrValues = [{ obj: 'string' }, 42, [1, 2, 3]];
				nonStrValues.forEach(val => {
					expect(converter(val, true)).to.eq(JSON.stringify(val));
				});

				const strAndFalsyValues = ['string', 'cat', null, undefined];
				strAndFalsyValues.forEach(val => {
					expect(converter(val)).to.eq(val);
				});
			});
		});

		describe('urlConverter', function() {
			const converter = types.converter('url');

			it('validates url values', function() {
				const invalidValues = ['google.bg', 'https://', {}, function() {}, 42, []];
				invalidValues.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid URL value:/i);
				});
			});

			it('correctly converts values', function() {
				const validStrs = ['https://www.youtube.com/'];
				validStrs.forEach(val => {
					expect(converter(val, true)).to.eq(url.parse(val).format());
					expect(converter(val)).to.deep.eq(url.parse(val));
				});

				[null, undefined].forEach(val => {
					expect(converter(val)).to.eq(null);
				});

				const validUrls = [url.parse('http://google.bg')];
				validUrls.forEach(val => {
					expect(converter(val)).to.eq(val.format());
				});
			});
		});

		describe('binaryConverter', function() {
			const converter = types.converter('binary');

			it('validates buffer', function() {
				const nonBuffers = [null, 42, function() {}, {}, []];
				nonBuffers.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid buffer data/i);
				});
			});

			it('correctly converts values', function() {
				const stringValue = 'string';
				expect(converter(stringValue)).to.deep.eq(new Buffer(stringValue, 'base64'));

				const bufferValue = new Buffer(42);
				expect(converter(bufferValue)).to.deep.eq(bufferValue);
			});
		});

		describe('streamConverter', function() {
			const converter = types.converter('stream');

			it('handles non-readable stream input', function() {
				const tempWriteStream = new stream.Writable();
				expect(() => {
					converter(tempWriteStream, true);
				}).to.throw(/readable stream expected/i);
				expect(() => {
					converter(tempWriteStream);
				}).to.throw(/input streams are not supported/i);

				const tempReadStream = new stream.Readable();
				expect(() => {
					converter(tempReadStream);
				}).to.throw(/input streams are not supported/i);
			});

			it('correctly converts values', function() {
				const tempReadStream = new stream.Readable();
				expect(converter(tempReadStream, true)).to.eq(tempReadStream);
			});
		});

		describe('errorConverter', function() {
			const converter = types.converter('error');

			it('handles null values', function() {
				[null, undefined].forEach(val => {
					expect(converter(val)).to.eq(val);
				});
			});

			it('validates error type', function() {
				const invalidErrorTypes = [42, { name: 'Ivan' }, [], function() {}];
				invalidErrorTypes.forEach(val => {
					expect(() => {
						converter(val);
					}).to.throw(/invalid error/i);
				});
			});

			it('correctly converts values', function() {
				const strError = 'Too popular name: Ivan';
				const expectedResult = {
					name: 'Error',
					message: strError,
				};
				expect(converter(strError)).to.deep.eq(expectedResult);

				const errorError = new Error(strError);
				expect(converter(errorError)).to.deep.eq(expectedResult);

				const objWithMessage = {
					message: strError,
				};
				expect(converter(objWithMessage)).to.deep.eq(expectedResult);
			});
		});
	});
});
