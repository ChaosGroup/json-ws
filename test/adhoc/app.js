'use strict';

// Example/test application

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const jsonws = require('../../index.js');
const transport = jsonws.transport;
const serviceApi = require('./api.js');
const path = require('path');

const app = express();
const srv = http.createServer(app);
const registry = jsonws.registry('/endpoint', srv, app);

app.set('port', 3000);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'browser')));
registry.attachExpressRouter();

app.get('/', function(req, res) {
	res.send('hello world');
});

app.get('/test', function(req, res) {
	res.sendfile(path.join(__dirname, '..', 'browser', 'test.html'));
});

srv.listen(app.get('port'), function () {
	registry.addTransport(transport.HTTP);
	registry.addService(serviceApi);
	console.log('Express server listening on ' + JSON.stringify(srv.address()));
});
