var request = require('request');

request.post({
		url : "http://localhost:3000/endpoint/1.0",
		json : {
            method: "echo",
			params: [[1,2,3,4]],
			id: 1
			//,params: [1, 2]
		}
	}, function(error, response, body) {
    console.log(error);   
    console.log(body);
});
