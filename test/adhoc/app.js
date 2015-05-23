var express = require('express');
var http = require('http');
var jsonws = require('../../index.js');
var transport = jsonws.transport;
var api = require('./api.js');
var path = require('path');

var registry = jsonws.registry('/endpoint');
var app = express();
app.set('port', 3000);
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(path.join(__dirname, '..', 'browser')));
app.use(registry.router());
app.use(express.logger('dev'));

app.get('/', function(req, res) {
	res.send('hello world');
});

app.get('/test', function(req, res) {
	res.sendfile(path.join(__dirname, '..', 'browser', 'test.html'));
});

var srv = http.createServer(app).listen(app.get('port'), function () {
	api.listen('/endpoint', [transport.HTTP(srv, app), transport.WebSocket(srv)], registry);
	console.log('Express server listening on ' + JSON.stringify(srv.address()));
});
