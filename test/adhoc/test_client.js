var WebSocket = require('ws');
var ws = new WebSocket('ws://localhost:3000/endpoint/1.0');

ws.on('message', function(data, flags) {
    console.log(data);
});

ws.on('open', function() {
  /*for (var i = 0; i < 10; i++)
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: i,
      method: "sum",
      params: [1, 2]
    }));*/
    
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "rpc.on",
      params: ['testEvent']
    }));
});
