'use strict';

// Example/test application

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const jsonws = require('../../index.js');
const transport = jsonws.transport;
const serviceApi = require('./api.js');
const path = require('path');

const expressApp = express();
const httpServer = http.createServer(expressApp);
const registry = jsonws.registry({
	rootPath: '/endpoint',
	httpServer,
	expressApp
});

expressApp.set('port', 3000);
expressApp.use(bodyParser.json());
expressApp.use(express.static(path.join(__dirname, '..', 'browser')));
registry.attachExpressRouter();

expressApp.get('/', function(req, res) {
	res.send('hello world');
});

expressApp.get('/test', function(req, res) {
	res.sendfile(path.join(__dirname, '..', 'browser', 'test.html'));
});

httpServer.listen(expressApp.get('port'), function () {
	registry.addTransport(transport.HTTP);
	registry.addService(serviceApi);
	console.log('Express server listening on ' + JSON.stringify(httpServer.address()));
});
