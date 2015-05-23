var api = require("../../index.js");

api.proxy("http://localhost:3000/endpoint/1.0?proxy=JavaScript&localName=Tester", function(err, proxy) {
	if (err) {
		console.log(err);
		return;
	}
	var a = new proxy.Tester("http://localhost:3000/endpoint/1.0");

	a.sum(1, 2).then(function(result) {
		console.log(result);
	}, function(err) {
		console.log(err);
	});

	a.on('testEvent', function(data) {
		console.log(data);
	});
	a.on('testEvent2', function(data) {
		console.log(data);
	});
})