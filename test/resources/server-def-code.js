module.exports = function setup(api) {
	api.enum('RenderMode', {
		'Production': -1,
		'RtCpu': 0
	});

	api.type('RenderOptions', {
		'mode': 'RenderMode',
		'width': 'int',
		'height': 'int'
	});

	api.event('ontest', 'test event');

	api.define({name: 'sum', description: 'Returns the sum of two numbers'}, function(a, b) {
		return a + b;
	});
};