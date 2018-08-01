const Service = require('../../../../lib/service/service.js');
const types = require('../../../../lib/service/types.js');
const expect = require('chai').expect;

describe.only('Service class', function() {
	describe('define', function() {
		const METHOD_NAME = 'method1';
		const METHOD_DESCR = 'method_description';

		let service;

		beforeEach(function() {
			service = new Service('1.0.0', 'service');
		});

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
});
