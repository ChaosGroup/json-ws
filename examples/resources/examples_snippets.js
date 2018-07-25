// Documentation examples and snippets
var proxy = new Proxy();

// {example:method1}
proxy.method1(1, 2, function(err, result) {
	console.log(err || result);
});
// {example}

proxy.otherMethod();

// {example:method2}
proxy.method2();
// {example}

// {snippet:snippet1}
var a = proxy.method1(1, 2);
proxy.method2();
// {snippet}

// {snippet:snippet2}
var b = proxy.method1(1, 2);
proxy.method2();
// {snippet}