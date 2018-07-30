// Documentation examples and snippets
const proxy = new Proxy();

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
const a = proxy.method1(1, 2);
proxy.method2();
// {snippet}

// {snippet:snippet2}
const b = proxy.method1(1, 2);
proxy.method2();
// {snippet}
