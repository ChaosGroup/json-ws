var request = require('request');
var fs = require('fs');

var serverUrl = 'http://10.0.0.137:50000/api/jobs/1.0';
var language = 'Java';
var localName = 'BeekeeperProxy';
var fileExtension = '.java';

requestUrl = serverUrl + '?proxy=' + language + '&localName=' + localName;
request.get(requestUrl, function(err, response, body) {
	if (err || response.statusCode != 200) {
		console.log(err || response.statusCode);
	} else {
		fs.writeFile(localName + fileExtension, body, function(err) {
			if (err) {
				console.log(err);
			}
		});
	}
});