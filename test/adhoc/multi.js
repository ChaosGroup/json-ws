var express = require("express")
	, http = require("http")
	, jsonws = require("../../index.js")
	, transport = jsonws.transport
	, path = require('path');

var apis = [1, 2, 3, 4, 5].map(function(i) {
	var api =  jsonws.api('1.0', 'test' + i);
	var i = 0;
	api.event('test', {type: 'int'});
	api.define({ name: 'foo', returns: 'int' }, function() {
		return i;
	}).define('trigger', function() { api.emit('test', i++) });
	return api;
});
var registries = apis.map(function(api) {
	return jsonws.registry('/' + api.friendlyName);
});

var app = express();
app.configure(function () {
	app.set('port', 3000);
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(express.static(path.join(__dirname, '..', 'browser')));
	registries.forEach(function(r) { app.use(r.router()) });
    app.use(express.logger('dev'));
});

app.configure('development', function(){
    app.use(express.errorHandler());
});

app.get('/', function(req, res){
  res.send('hello world');
});

app.get('/test', function(req, res) {
	res.sendfile(path.join(__dirname, '..', 'browser', 'test.html'));
});

var srv = http.createServer(app).listen(app.get('port'), function () {
	apis.forEach(function(api, idx) {		
		api.listen("/" + api.friendlyName, [transport.HTTP(srv, app), transport.WebSocket(srv)], registries[idx]);
		console.log(api.friendlyName + ' ' + api.path);
	});	
	
	console.log("Express server listening on " + JSON.stringify(srv.address()));
});
