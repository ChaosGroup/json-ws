'use strict';

const Service = require('../../../../lib/service/service.js');
const types = require('../../../../lib/service/types.js');
const expect = require('chai').expect;

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const util = require('util');
const Module = require('module');

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

	describe('import', function() {
		it('handles incorrect importSite string', function() {
			const invalidPath = './invalid/path';
			expect(() => {
				service.import(invalidPath);
			}).to.throw(new RegExp(`failed to parse import file.*${invalidPath}`, 'i'));
		});

		it('handles incorrect importSite type', function() {
			const invalidTypes = [42, function() {}, true];
			invalidTypes.forEach(el => {
				expect(() => {
					service.import(el);
				}).to.throw(/unsupported import site:/i);
			});
		});

		it('handles setup function', async function() {
			let setupFunctionCalled = false;

			// We need to requrie the service code again in order to provide a fake "require":
			// TODO: Use proxyquire and delete this:
			const serviceModule = { exports: {} };
			const readFileAsync = util.promisify(fs.readFile);
			const serviceCode = await readFileAsync(
				path.resolve(__dirname, '../../../../lib/service/service.js')
			);
			const serviceModuleFn = eval(Module.wrap(serviceCode));
			const customRequire = moduleName => {
				if (moduleName === 'my-defs') {
					return function() {
						setupFunctionCalled = true;
					};
				} else if (moduleName === './types') {
					return types;
				}

				return require(moduleName);
			};
			serviceModuleFn(serviceModule.exports, customRequire, serviceModule);
			const Service = serviceModule.exports;
			// End of setup

			const service = new Service('1.0.0', 'service');
			service.import('my-defs');
			expect(setupFunctionCalled).to.be.true;
		});
	});

	describe('examples', function() {
		const examplesDirectory = '../../../../../';
		const examples = [
			{
				fileName: 'javaTest.java',
				language: 'Java',
				methodNames: ['method1'],
				snippetNames: ['snippet1'],
			},
			{
				fileName: 'nodeTest.js',
				language: 'Node',
				methodNames: [],
				snippetNames: ['snippet1'],
			},
			{
				fileName: 'jsTest.js',
				language: 'JavaScript',
				methodNames: [],
				snippetNames: ['snippet1', 'snippet2'],
			},
			{
				fileName: 'csTest.cs',
				language: 'CSharp',
				methodNames: ['csMethod'],
				snippetNames: ['csSnippet'],
			},
			{
				fileName: 'pyTest.py',
				language: 'Python',
				methodNames: ['pyMethod'],
				snippetNames: ['snippet1'],
			},
			{
				fileName: 'cppTest.cpp',
				language: 'C++',
				methodNames: ['cppMethod'],
				snippetNames: ['cppSnippet'],
			},
			{
				fileName: 'cTest.c',
				language: 'C++',
				methodNames: ['cMethod'],
				snippetNames: ['cSnippet'],
			},
			{
				fileName: 'httpTest.curl',
				language: 'HTTP',
				methodNames: [],
				snippetNames: ['htmlSnippet'],
			},
		];

		const example = examples[0];
		const examplePath = path.resolve(__dirname, examplesDirectory, example.fileName);

		it('correctly defines method existance', function() {
			service.examples(examplePath);

			expect(service.languages.indexOf(example.language) > -1).to.be.true;
			example.methodNames.map(mehodName => {
				expect(service.methodMap[mehodName]).to.exist;
			});
			example.snippetNames.map(snippetName => {
				expect(service.snippetMap[snippetName][example.language]).to.exist;
			});
		});

		it('defines a language only once', function() {
			for (let i = 0; i < 100; i++) {
				service.examples(examplePath);
			}

			expect(
				service.languages.filter(function(x) {
					return x === example.language;
				}).length
			).to.eq(1);
		});

		it('correctly extracts method code', function() {
			service.examples(examplePath);
			expect(service.snippetMap[example.snippetNames[0]][example.language]).to.eq(
				'int a = proxy.method1(1, 2).get();\nproxy.method2().get();\nproxy.exampleFunction();\n'
			);
		});

		it('works correctly with all languages', function() {
			examples.forEach(example => {
				const fullPath = path.resolve(__dirname, examplesDirectory, example.fileName);
				service.examples(fullPath);

				expect(service.languages.indexOf(example.language) > -1).to.be.true;
				example.methodNames.map(mehodName => {
					expect(service.methodMap[mehodName]).to.exist;
				});
				example.snippetNames.map(snippetName => {
					expect(service.snippetMap[snippetName][example.language]).to.exist;
				});
			});
		});
	});

	describe('setUseStringEnums', function() {
		it('correctly sets the flag', function() {
			Service.setUseStringEnums(true);
			expect(Service._useStringEnums).to.be.true;

			Service.setUseStringEnums(false);
			expect(Service._useStringEnums).to.be.false;
		});
	});

	describe('constructor', function() {
		it('validates version', function() {
			expect(() => {
				new Service('version', 'name');
			}).to.throw(/invalid version:.*/i);

			expect(() => {
				new Service(42, 'name');
			}).to.throw(/invalid version:.*/i);

			expect(() => {
				new Service(null, 'name');
			}).to.throw(/invalid version:.*/i);

			expect(() => {
				new Service('1.0.0', 'name');
			}).not.to.throw(/invalid version:.*/i);
		});

		it('validates name', function() {
			expect(() => {
				new Service('1.0.0', {});
			}).to.throw(/invalid name:.*/i);

			expect(() => {
				new Service('1.0.0', 42);
			}).to.throw(/invalid name:.*/i);

			expect(() => {
				new Service('1.0.0');
			}).to.throw(/invalid name:.*/i);

			expect(() => {
				new Service('1.0.0', 'name');
			}).not.to.throw(/invalid name:.*/i);
		});

		it('validates request validator', function() {
			expect(() => {
				new Service('1.0.0', 'name', {});
			}).to.throw(/request validator must be a function/i);

			expect(() => {
				new Service('1.0.0', 'name', 42);
			}).to.throw(/request validator must be a function/i);

			expect(() => {
				new Service('1.0.0', 'name', function() {});
			}).not.to.throw(/request validator must be a function/i);
		});

		it("has correctly properties 'name' and 'version'", function() {
			const tempService = new Service('1.0.0', 'name');

			expect(tempService.name).to.eq('name');
			expect(tempService.version).to.eq('1.0.0');
		});
	});

	describe('setNamespace', function() {
		it('correctly sets non-empty string', function() {
			service.setNamespace('namespace');
			expect(service.currentNamespace).to.eq('namespace');
		});

		it('correctly sets empty string', function() {
			service.setNamespace();
			expect(service.currentNamespace).to.eq('');
		});
	});

	describe('setGroup', function() {
		const serviceInfo = { name: 'service', version: '1.0.0' };
		const service1 = new Service(serviceInfo.version, serviceInfo.name);
		const service2 = new Service(serviceInfo.version, serviceInfo.name);

		it('correctly ignores non-string values', function() {
			service2.setGroup();
			expect(service2).to.deep.eq(service1);

			service2.setGroup({});
			expect(service2).to.deep.eq(service1);

			service2.setGroup(42);
			expect(service2).to.deep.eq(service1);
		});

		it('correctly sets string values', function() {
			const groupName = 'GroupName';

			service2.setGroup(groupName);
			expect(service2).not.to.deep.eq(service1);
			expect(service2.currentGroup.name).to.eq(groupName);
			expect(service2.groups[groupName].name).to.eq(groupName);
		});
	});
});
