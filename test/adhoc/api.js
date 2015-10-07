var api = require('../../index.js').api('1.0', 'Test API');

function test() {
}

test.prototype.sum = function sum(a, b, callback) {
	setTimeout(function() { callback(null, a + b); }, 0);
};

test.prototype.sumReturn = function sumReturn(a, b) {
	console.log('A + B = ' + (a + b));
	return a + b;
};

test.prototype.echo = function echo(a) {
	console.log(a);
	var RenderMode = api.type('RenderMode').struct;
	console.log('RenderMode value: '+ RenderMode[a.renderMode]);
	return a;
};

test.prototype.echoObject = function echoObject(a, callback) {
	callback(null, a);
};

test.prototype.throwError = function throwError(callback) {
	callback({'stack': 'error executing method'});
};

test.prototype.throwUnexpectedError = function throwError() {
	throw new Error('Unexpected error');
};

test.prototype.testMe = function testMe(callback) {
	callback(null, {
			'property1': 'int',
			'asdf': 'Аз съм Сънчо',
			'complex' : {
				a: 1,
				b: 3
			}});
};

test.prototype.testMe1 = function testMe1(callback) {
	callback(null, 'test1');
};

test.prototype.testMe2 = function testMe2(a, callback) {
	callback(null, 'test2' + a);
};

test.prototype.testMe3 = function testMe3(callback) {
	callback(null, 'Some async method test 3');
};

test.prototype.testMe4 = function testMe4(callback) {
	callback(null, 'Some async method test 4');
};

var c = 0;

setInterval(function() {
	var data = {testData: c++};
	api.emit('testEvent', data.testData);
	api.emit('testEvent3', {
		'a': 1
	});
	api.emit('ns1.testEvent1');
	api.emit('testBinaryEvent', new Buffer('test binary event'));
}, 1000);

setInterval(function() {
	api.emit('testEvent2', [{
		width: 1,
		height: 2,
		renderMode: 0
	}]);
}, 2000);

var testObj = new test();

module.exports = function() {
	api
	.group('All Methods', 'Every single method is here')
	.event('testEvent',{
		'description': 'This event is fired every second, and returns a data count.',
		'type': 'int'
	})
	.namespace('')
	.defineAll(testObj)
	.enum('RenderMode', {
		Production: -1,
		RtCpu: 0,
		RtGpuCuda: 5
	})
	.type('RenderOptions', {
		width: 'int',
		height: 'int',
		renderMode: 'RenderMode'
	})
	.type('DefaultArray', {
		property: {
			type: ['string'],
			required: false,
			default: []
		}
	})
	.define({ name: 'TestDefaultArray', params: [{ name: 'p', type: 'DefaultArray' }] }, function(p) {
		console.log(p);
	})
	.define({ name: 'TestUrl', params: [{ name: 'u', type: 'url' }], returns: 'url' }, function(u) {
		console.log(u);
		return u.format();
	})
	.define({
		name: 'testMe',
		returns: 'json',
		description: 'A sample method.'
	})
	.define({
		name: 'testMe2',
		params: [
			{ name: 'a', type: 'string', description: 'A simple string parameter.'}
		],
		returns: 'string',
		description: 'A sample method.'
	})
	.define({name: 'echo', params: [{ 'name' : 'a', 'type' : 'RenderOptions'}], returns: 'RenderOptions'})
	.define({name: 'getRenderOptions', returns: ['RenderOptions']}, function() {
		var renderOptions = {
			width: 640, height: 360,
			renderMode: 'RtCpu'
		};
		return [renderOptions, renderOptions, renderOptions];
	})
	.define({name: 'echoObject', params: ['a'], returns: 'json'})
	.group('Other methods')
	.define({name: 'echoStringAsBuffer', params: [{ name: 'theString', type: 'string' }], returns: 'binary'}, function(theString) {
		return new Buffer(theString);
	})
	.define({name: 'getBufferSize', params: [{ name: 'buffer', type: 'binary'}], returns: 'int'}, function(buffer) {
		console.log(buffer, buffer.length);
		return buffer.length;
	 })
	.define({name: 'throwError', returns: 'int'})
	.define({name: 'throwUnexpectedError', returns: ['object']})
	.define({
		'name': 'sum',
		'description': 'Some test method example, does int sum',
		'params': [{ 'name' : 'a', 'type' : 'int'}, { 'name' : 'b', 'type' : 'int'}],
		'returns': 'int'
	});
	api.define({
		name: 'returnFrom0ToN',
		params: [{name: 'n', type: 'int'}],
		returns: ['int']
	}, function(n) {
		var arr = new Array(n);
		for (var i = 0; i < n; i++) {
			arr[i] = i;
		}
		return arr;
	});
	api.define({
		name: 'optionalArgs',
		params: [
			{ name: 'required', type: 'bool' },
			{ name: 'p1', type: 'int', default: 0 },
			{ name: 'p2', type: 'int', default: 1 }
		]
	}, function(required, p1, p2) { console.log('optionalArgs called with', arguments); });
	api.define({
		name: 'sumArray',
		params: [
			{name: 'ints', type: ['int']}
		],
		returns: 'int'
	}, function(ints) {
		var sum = 0;
		ints.forEach(function(i) {
			sum += i;
		});
		return sum;
	})
	.define({
		'name': 'testAny',
		'params': [{ 'name': 'a', 'type': '*'}],
		'returns': 'any'
	})
	.define({
		name: 'getSeconds',
		params: [{ name: 'timeParam', type: 'date'}],
		returns: 'int'
	}, function(time) { return time.getSeconds(); })
	.define({
		name: 'getNow',
		params: [],
		returns: 'date'
	}, function() { return Date.now(); })
	.event('testEvent2', {
		'type': ['RenderOptions']
	})
	.event('testEvent3', {
		'type': 'json'
	})
	.event('testEvent4', {
		'type': 'bool'
	})
	.event('testBinaryEvent', {
		'type': 'binary'
	})
	.define({name: 'testMe1', returns: 'async'})

	.namespace('ns1')
	.define({
			'name': 'method1',
			'returns': 'string'
		}, testObj.testMe1)
	.event('testEvent1')

	.namespace('ns1.sub1.sub2')
	.define('method1')

	.namespace('ns2.sub1.sub2')
	.define('method1');
	//	.examples(path.resolve('test.examples.js'))
	//	.examples(path.resolve('test.examples.node.js'))
	//	.examples(path.resolve('test.examples.java'))
	//	.examples(path.resolve('test.examples.curl'))
	return api;
}();
