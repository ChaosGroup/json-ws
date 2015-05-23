var request = require('request');
var fs = require('fs');

var serverUrl = 'http://localhost:3000/endpoint/1.0';
var language = 'Python';
var localName = 'GeneratedTest';

requestUrl = serverUrl + '?proxy=' + language + '&localName=' + localName;
request.get(requestUrl, function(err, response, body) {
	if (err || response.statusCode != 200) {
		console.log(err || response.statusCode);
	} else {
		console.log(body);
	}
});
