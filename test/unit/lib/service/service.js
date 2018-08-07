'use strict';

const Service = require('../../../../lib/service/service.js');
const types = require('../../../../lib/service/types.js');
const expect = require('chai').expect;

const EventEmitter = require('events');

describe.only('Service class', function() {
	let service;

	beforeEach(function() {
		service = new Service('1.0.0', 'service');
	});

	describe('define', function() {
		const METHOD_NAME = 'method1';
		const METHOD_DESCR = 'method_description';

		it('does not allow registering of events', function() {
			expect(() => service.define({ event: {} })).to.throw(/registering events.*obsolete/i);
		});

		it('validates the options type', function() {
			expect(() => service.define(42)).to.throw(/invalid.*options/i);
			expect(() => service.define([])).to.throw(/invalid.*options/i);

			expect(() => service.define({})).not.to.throw(/invalid.*options/i);
			expect(() => service.define('foo')).not.to.throw();
		});

		it('validates that the method has a name', function() {
			expect(() => service.define({})).to.throw(/must have a name/i);
			expect(() => service.define('')).to.throw(/must have a name/i);
		});

		it('changes the method name base on the namespace', function() {
			service.define(METHOD_NAME); // Define a method in the global namespace
			service.setNamespace('namespace1'); // change the namespace
			service.define('method2'); // Define a method in the namespace "namespace1"

			expect(service.methodMap).to.have.keys([METHOD_NAME, 'namespace1.method2']);
		});

		it('extracts return type from options type correctly', function() {
			service.define({ name: METHOD_NAME, returns: ['number', 'string'] });

			expect(service.methodMap[METHOD_NAME].returnsArray).to.be.true;
			expect(service.methodMap[METHOD_NAME]._returns).to.eq('number');
		});

		it('handles invalid return type from options type', function() {
			expect(function() {
				service.define({ name: METHOD_NAME, returns: 'non-exist-type' });
			}).to.throw(/Undefined return type for method.*/i);
		});

		it('handles callbacks in options type', function() {
			const callback = function() {};
			service.define({ name: METHOD_NAME, callback: callback });

			expect(service.methodMap[METHOD_NAME].callback).to.be.a('function');
		});

		it('handles callbacks in options type', function() {
			const callback = function() {};
			service.define({ name: METHOD_NAME, callback: callback });

			expect(service.methodMap[METHOD_NAME].callback).to.be.a('function');
		});

		describe('define - methodInfo object', function() {
			it('sets the method name', function() {
				service.define(METHOD_NAME);
				expect(service.methodMap[METHOD_NAME].name).to.eq(METHOD_NAME);
			});

			it('sets default description when none is given', function() {
				service.define(METHOD_NAME);
				expect(service.methodMap[METHOD_NAME].description).to.eq(
					types.missingDocumentation
				);
			});

			it('sets the given description', function() {
				service.define({ name: METHOD_NAME, description: METHOD_DESCR });
				expect(service.methodMap[METHOD_NAME].description).to.eq(METHOD_DESCR);
			});

			it('creates a default "examples" object', function() {
				service.define(METHOD_NAME);
				expect(service.methodMap[METHOD_NAME].examples).to.be.an('object');
			});

			it('returns correct return type', function() {
				service.define({ name: METHOD_NAME, returns: ['number'] });
				expect(service.methodMap[METHOD_NAME].returns).to.eq('number');

				service.define({ name: METHOD_NAME + '_1', returns: 'async' });
				expect(service.methodMap[METHOD_NAME + '_1'].returns).to.eq(undefined);
				//expect(service.methodMap[METHOD_NAME + '_1'].async).to.eq(true);
			});

			it('returns correctly if it returns "async"', function() {
				service.define({ name: METHOD_NAME, returns: 'async' });
				expect(service.methodMap[METHOD_NAME].async).to.be.true;

				service.define({ name: METHOD_NAME + '_1', returns: 'number' });
				expect(service.methodMap[METHOD_NAME + '_1'].async).to.be.false;
			});
		});

		describe('immediate function definition', function() {
			it('defaults this to null', function() {
				let actualThis;

				const fn = function() {
					actualThis = this;
					return 42;
				};

				service.define(METHOD_NAME, fn);

				expect(service.methodMap[METHOD_NAME].fn).to.be.a('function');
				expect(actualThis).to.be.undefined;
				expect(service.methodMap[METHOD_NAME].fn()).to.eq(42);
				expect(actualThis).to.be.null;
			});

			it('converts generators to async functions', async function() {
				let actualThis;

				const fn = function*() {
					actualThis = this;
					return 42;
				};

				service.define(METHOD_NAME, fn);

				expect(service.methodMap[METHOD_NAME].fn).to.be.a('function');
				expect(actualThis).to.be.undefined;
				expect(await service.methodMap[METHOD_NAME].fn()).to.eq(42);
				expect(actualThis).to.be.null;
			});
		});

		describe('define - redefining a method', function() {
			it('does not define a method twice', function() {
				service.define(METHOD_NAME);
				service.define({ name: METHOD_NAME, returns: 'int' });

				expect(service.currentGroup.items).to.deep.eq(['method:method1']);
			});

			it('keeps the previous description when no new description is given', function() {
				service.define({ name: METHOD_NAME, description: METHOD_DESCR });
				service.define(METHOD_NAME); // no new description given
				expect(service.methodMap[METHOD_NAME].description).to.eq(METHOD_DESCR);
			});

			it('overwrites the previous description when a new description is given', function() {
				service.define({ name: METHOD_NAME, description: METHOD_DESCR });
				service.define({ name: METHOD_NAME, description: 'method_description_new' });
				expect(service.methodMap[METHOD_NAME].description).to.eq('method_description_new');
			});

			it('keeps the previous examples after redefinition', function() {
				service.define(METHOD_NAME);

				const examples = service.methodMap[METHOD_NAME].examples;
				service.define(METHOD_NAME);

				expect(service.methodMap[METHOD_NAME].examples).to.eq(examples);
			});
		});

		describe("define's _parseDefineParams", function() {
			it('validates that params is an array', function() {
				const options = { name: 'setName' };

				options['params'] = 42;
				expect(() => {
					service.define(options);
				}).to.throw(/the params property must be an array/i);

				options['params'] = {};
				expect(() => {
					service.define(options);
				}).to.throw(/the params property must be an array/i);

				options['params'] = '42';
				expect(() => {
					service.define(options);
				}).to.throw(/the params property must be an array/i);
			});

			it('validates that params have a name property', function() {
				const options = {
					name: 'setName',
					params: [{ name: null, type: 'string' }],
				};

				expect(() => {
					service.define(options);
				}).to.throw(/unnamed method parameter/i);
			});

			it('handles param with no type specified', function() {
				const options = {
					name: 'setName',
					params: [{ name: 'string' }],
				};

				expect(() => {
					service.define(options);
				}).not.to.throw();
			});

			it('ensures that no inline type definitions are used', function() {
				const options = {
					name: 'setName',
					params: [{ name: 'name', type: {} }],
				};

				expect(() => {
					service.define(options);
				}).to.throw(/inline type definitions are not supported/i);
			});

			it('ensures that params types are valid', function() {
				const options = {
					name: 'setName',
					params: [{ name: 'name', type: 'unexisting-type' }],
				};

				expect(() => {
					service.define(options);
				}).to.throw(/undefined type/i);
			});

			it("ensures that if param type is an array it's non-empty", function() {
				const options = {
					name: 'setName',
					params: [{ name: 'name', type: [] }],
				};

				expect(() => {
					service.define(options);
				}).to.throw(/missing type for param.*/i);
			});

			it('ensures that no param type is a stream', function() {
				const options = {
					name: 'setName',
					params: [{ name: 'name', type: ['stream'] }],
				};

				expect(() => {
					service.define(options);
				}).to.throw(/input streams are not supported/i);
			});

			it('handles string params', function() {
				const options = {
					name: 'setName',
					params: ['age'],
				};

				expect(() => {
					service.define(options);
				}).to.not.throw();
			});

			it('handles params string permissions', function() {
				const options = {
					name: 'setName',
					params: [{ name: 'name', type: ['string'], permissions: 'private' }],
				};

				expect(() => {
					service.define(options);
				}).to.not.throw();
			});

			it('handles params array permissions', function() {
				const options = {
					name: 'setName',
					params: [
						{
							name: 'name',
							type: ['string'],
							permissions: ['private', 'protected'],
							default: 'Ivan',
						},
					],
				};

				expect(() => {
					service.define(options);
				}).to.not.throw();
			});

			it('handles non-(array|string) object for param permissions', function() {
				const options = {
					name: 'setName',
					params: [
						{
							name: 'name',
							type: ['string'],
							permissions: { permission1: 'protected' },
							default: 'Ivan',
						},
					],
				};

				expect(() => {
					service.define(options);
				}).to.not.throw();
			});
		});
	});

	describe('type', function() {
		it('verifies that type has a name', function() {
			expect(() => {
				service.type();
			}).to.throw(/types must have a name./i);
		});

		it('returns the correct type with no type definition provided', function() {
			const type = service.type('number');
			expect(type.type).to.eq('number');
			expect(type.convert).to.be.a('function');
		});

		it('handles unexisting types', function() {
			expect(() => service.type('unexisting-type')).to.throw(/type.*is undefined/i);
		});

		it('forbids internal type overriding', function() {
			expect(() => {
				service.type('number', 'descr');
			}).to.throw(/internal types cannot.*overriden.*/i);
		});

		it('forbids type overriding', function() {
			service.type('Cars', { model: 'string' });

			expect(() => {
				service.type('Cars', { name: 'string' });
			}).to.throw(/types cannot be overriden/i);
		});

		it('verifies that enum definitions are objects', function() {
			expect(() =>
				service.type('example-name', 'type-definition', 'description', true)
			).to.throw(/enum definition must be an object/i);
		});

		it('verifies that enum definitions are not empty', function() {
			expect(() => service.type('example-name', {}, 'description', true)).to.throw(
				/empty enums are not allowed.*/i
			);
		});

		it('verifies that enum values are numbers', function() {
			expect(() =>
				service.type('example-name', { val1: 'str' }, 'description', true)
			).to.throw(/enum values must be numbers.*/i);
		});

		it('creates a valid enum', function() {
			expect(() =>
				service.type('test-enum', { val1: 0, val1: 1 }, 'description', true)
			).not.to.throw();
		});

		it('creates a valid structure', function() {
			expect(() => {
				service.type('test-enum', { field1: 'number', field2: 'string' }, undefined);
			}).not.to.throw();
		});

		it('returns already defined type', function() {
			service.type('Cars', { model: 'string' });
			service.type('Cars');
		});

		describe('typeInfo.convert()', function() {
			const EXAMPLE_ENUM_NAME = 'People';
			const EXAMPLE_ENUM = {
				Programmers: 0,
				Teachers: 1,
				Gamers: 2,
			};
			const EXAMPLE_STRUCT_NAME = 'Person';
			const EXAMPLE_STRUCT = {
				name: 'string',
				age: 'int',
				nickname: {
					type: 'string',
					required: false,
				},
			};

			it('converts simple struct types', function() {
				service.type(EXAMPLE_STRUCT_NAME, EXAMPLE_STRUCT);
				expect(
					service.typeMap[EXAMPLE_STRUCT_NAME].convert({
						name: 'Ivan',
						age: '25',
						nickname: 'Vankata',
					})
				).to.deep.eq({
					name: 'Ivan',
					age: 25,
					nickname: 'Vankata',
				});
			});

			it('converts simple enum types', function() {
				service.type(EXAMPLE_ENUM_NAME, EXAMPLE_ENUM, 'description', true);

				expect(
					service.typeMap[EXAMPLE_ENUM_NAME].convert(Object.keys(EXAMPLE_ENUM)[0])
				).to.eq(0);
				expect(
					service.typeMap[EXAMPLE_ENUM_NAME].convert(Object.keys(EXAMPLE_ENUM)[1])
				).to.eq(1);
				expect(
					service.typeMap[EXAMPLE_ENUM_NAME].convert(Object.keys(EXAMPLE_ENUM)[2])
				).to.eq(2);
			});

			it('validates required fieds', function() {
				service.type(EXAMPLE_STRUCT_NAME, EXAMPLE_STRUCT);

				expect(() =>
					service.typeMap[EXAMPLE_STRUCT_NAME].convert({ name: 'Ivan' })
				).to.throw(/required field has no value: age/i);
				expect(() =>
					service.typeMap[EXAMPLE_STRUCT_NAME].convert({ name: 'Ivan', age: 25 })
				).not.to.throw(/required field/i);
				expect(() =>
					service.typeMap[EXAMPLE_STRUCT_NAME].convert({
						name: 'Ivan',
						age: 25,
						nickname: null,
					})
				).not.to.throw(/required field/i);
			});

			it('ensures valid enum convert value types', function() {
				service.type(EXAMPLE_ENUM_NAME, EXAMPLE_ENUM, 'description', true);

				const err = /Invalid value for enum.*only numbers or strings.*/;

				expect(() => {
					service.typeMap[EXAMPLE_ENUM_NAME].convert({ 0: 'Programmers' });
				}).to.throw(err);

				expect(() => {
					service.typeMap[EXAMPLE_ENUM_NAME].convert([1, 2, 3]);
				}).to.throw(err);

				expect(() => {
					service.typeMap[EXAMPLE_ENUM_NAME].convert(function(x) {
						return x * x;
					});
				}).to.throw(err);
			});

			it('ensures valid enum convert values', function() {
				service.type(EXAMPLE_ENUM_NAME, EXAMPLE_ENUM, 'description', true);

				const testValue = 'Lumberjack';

				expect(!EXAMPLE_ENUM[testValue]).to.be.true;
				expect(() => {
					service.typeMap[EXAMPLE_ENUM_NAME].convert(testValue);
				}).to.throw(/unknown enum.*value.*/i);
			});

			it('ensures valid struct convert values', function() {
				service.type(EXAMPLE_STRUCT_NAME, EXAMPLE_STRUCT);

				expect(() => {
					service.typeMap[EXAMPLE_STRUCT_NAME].convert('Mincho');
				}).to.throw(/Simple value cannot be converted to type.*/);
			});

			it.skip('ensures a valid usage of string enums', function() {
				service.type(EXAMPLE_ENUM_NAME, EXAMPLE_ENUM, 'description', true);
			});

			it('converts types with array fields', function() {
				service.type('Post', { tags: ['string'] });
				expect(service.typeMap['Post'].convert({ tags: ['foo'] })).to.deep.eq({
					tags: ['foo'],
				});
			});

			it('returns null if value is null', function() {
				service.type(EXAMPLE_STRUCT_NAME, EXAMPLE_STRUCT);

				expect(service.typeMap[EXAMPLE_STRUCT_NAME].convert(null)).to.eq(null);
			});

			it('validates that array fields are actual arrays', function() {
				service.type('Person', {
					name: 'string',
					children: { type: 'object', isArray: true },
				});

				expect(() =>
					service.typeMap[EXAMPLE_STRUCT_NAME].convert({
						name: 'Ivan',
						children: 'Danio',
					})
				).to.throw(/field children must be an array/i);
			});
		});
	});

	describe('event', function() {
		const EVENT_NAME = 'exampleEvent';

		it('verifies that service events have a name', function() {
			expect(() => {
				service.event();
			}).to.throw(/service events must have a name/i);
		});

		it('forbids event overriding', function() {
			expect(() => {
				service.event(EVENT_NAME, {});
				service.event(EVENT_NAME, {});
			}).to.throw(/overriding events is not allowed/i);
		});

		it('returns an already defined event', function() {
			service.event(EVENT_NAME, {});
			const event1 = service.eventMap[EVENT_NAME];
			const event2 = service.event(EVENT_NAME);

			expect(event1).to.eq(event2);
		});

		it('handles namespaces correctly', function() {
			service.setNamespace('namespace');
			service.event(EVENT_NAME);

			expect(service.eventMap[`namespace.${EVENT_NAME}`]).to.exist;
			expect(service.eventMap[`namespace.${EVENT_NAME}`].name).to.eq(
				`namespace.${EVENT_NAME}`
			);
		});

		it("accepts a string for event's eventInfo", function() {
			service.event(EVENT_NAME, 'description');

			expect(service.eventMap[EVENT_NAME].description).to.eq('description');
		});

		it("ensures that event's eventInfo is an object if not a string", function() {
			expect(() => {
				service.event(EVENT_NAME, []);
			}).to.throw(/event options must be an object/i);

			expect(() => {
				service.event(EVENT_NAME, 42);
			}).to.throw(/event options must be an object/i);

			expect(() => {
				service.event(EVENT_NAME, function() {});
			}).to.throw(/event options must be an object/i);
		});

		it('handles eventInfo with unexisting type property', function() {
			expect(() => {
				service.event(EVENT_NAME, { type: 'ivan' });
			}).to.throw(new RegExp(`undefined event type for event ${EVENT_NAME}: ivan`, 'i'));
		});

		it('handles correctly eventInfo with existing type property', function() {
			service.event(EVENT_NAME, { type: 'number' });

			expect(service.eventMap[EVENT_NAME].type).to.eq('number');
		});

		it('handles correctly eventInfo with existing type property array', function() {
			service.event(EVENT_NAME, { type: ['number', 'string'] });

			expect(service.eventMap[EVENT_NAME].type).to.eq('number');
			expect(service.eventMap[EVENT_NAME].isArray).to.be.true;
		});
	});

	describe('enum', function() {
		const ENUM_NAME = 'People';
		const ENUM_DESCRIPTION = 'description';

		it('creates a valid enum from array', function() {
			service.enum(ENUM_NAME, ['Programmers', 'Lumberjacks', 'Gamers'], ENUM_DESCRIPTION);
			expect(service.typeMap[ENUM_NAME].description).to.eq(ENUM_DESCRIPTION);
			expect(service.typeMap[ENUM_NAME].name).to.eq(ENUM_NAME);
			expect(service.typeMap[ENUM_NAME].enum).to.be.true;
			expect(service.typeMap[ENUM_NAME].struct).to.deep.eq({
				Programmers: 0,
				Lumberjacks: 1,
				Gamers: 2,
			});
		});

		it('creates a valid enum from object', function() {
			service.enum(ENUM_NAME, { Programmers: 0, Lumberjacks: 1, Gamers: 2 });
			expect(service.typeMap[ENUM_NAME].description).to.eq(types.missingDocumentation);
			expect(service.typeMap[ENUM_NAME].name).to.eq(ENUM_NAME);
			expect(service.typeMap[ENUM_NAME].enum).to.be.true;
			expect(service.typeMap[ENUM_NAME].struct).to.deep.eq({
				Programmers: 0,
				Lumberjacks: 1,
				Gamers: 2,
			});
		});
	});

	describe('defineAll', function() {
		it('returns current service if no parameters are provided', function() {
			expect(service.defineAll()).to.deep.eq(service);
		});

		it('correctly skips object properties', function() {
			service.defineAll({
				notOkProp1: {},
				notOkProp2: 42,
				notOkProp3: 'string',
				_notOkProp4: function() {},
			});
			expect(service.methodMap).to.deep.eq({});

			service.defineAll(
				{
					prop: function() {},
				},
				['NOT-prop']
			);
			expect(service.methodMap).to.deep.eq({});
		});

		it('correctly defines provided methods', function() {
			service.defineAll(
				{
					method1: function() {},
					method2: function() {},
				},
				['method1']
			);

			expect(service.methodMap['method1']).to.exist;
			expect(service.methods['method1']).to.exist;
			expect(service.fn['method1']).to.exist;
			expect(service.fn['method2']).to.not.exist;
		});

		it('handle non-trivial objects', function() {
			const existanceChecker = function(methodName) {
				expect(service.methodMap[methodName]).to.exist;
				expect(service.methods[methodName]).to.exist;
				expect(service.fn[methodName]).to.exist;
			};

			const CustomObject = function() {
				this.prop1 = 'randomString';
				this.prop2 = 42;
				this.prop3 = function() {};
			};
			CustomObject.prototype['func1'] = function() {};
			CustomObject.prototype['func2'] = function() {};

			const customObject = new CustomObject();
			service.defineAll(customObject);

			existanceChecker('func1');
			existanceChecker('func2');
			existanceChecker('prop3');
		});

		it('handles EventEmitter objects', function(done) {
			class CustomObject extends EventEmitter {
				constructor() {
					super();
					this.prop1 = 'randomString';
					this.prop2 = 42;
					this.prop3 = function() {};
				}
			}

			const customObject = new CustomObject();
			service.event('testEvent');
			service.defineAll(customObject);

			const EVENT_OBJECT = {};
			service.on('testEvent', e => {
				expect(e).to.eq(EVENT_OBJECT);
				done();
			});

			customObject.emit('testEvent', EVENT_OBJECT);
		});
	});
});
