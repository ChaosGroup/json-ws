const TestApi = require('TestApi');

const sioTransport = require('./transports/sio');

const proxy = new TestApi(
	new sioTransport('http://localhost:3000/endpoint/tralala/test-api/1.0', {
		serviceName: 'test-api',
		serviceVersion: '1.0',
		path: '/test-api/socket.io',
		validationParams: {
			sessionId: 'tralala',
		},
	})
);

proxy.sum(2, 3, function(err, result) {
	console.log(err || result);
});
