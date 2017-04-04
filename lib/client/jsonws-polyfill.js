/* eslint-disable */
(function() {
	'use strict';

	if (typeof window === 'undefined') {
		throw new Error('jsonws-polyfill is meant to be used only in browser');
	}

	var modules = {};

	var jsonws = window.jsonws = {
		define: function(newModuleName, newModule) {
			modules[newModuleName] = newModule;
		},
		require: function(moduleName) {
			if (modules.hasOwnProperty(moduleName)) {
				return modules[moduleName];
			}

			throw new Error('No polyfill registered for module "' + moduleName + '"');
		},
		set exports(v) {
			// Nothing, in browser "define" is used
		}
	};

	jsonws.define('url', {
		parse: function parse(url) {
			var link = document.createElement('a');
			link.setAttribute('href', url);

			return link;
		}
	});

	jsonws.define('util', {
		inherits: function inherits(ctor, superCtor) {
			ctor.super_ = superCtor;
			ctor.prototype = Object.create(superCtor.prototype, {
				constructor: {
					value: ctor,
					enumerable: false,
					writable: true,
					configurable: true
				}
			});
		}
	});

	jsonws.define('events', EventEmitter);
	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// 'Software'), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	function EventEmitter() {
		this._events = this._events || {};
		this._maxListeners = this._maxListeners || defaultMaxListeners;
	}

	// By default EventEmitters will print a warning if more than
	// 10 listeners are added to it. This is a useful default which
	// helps finding memory leaks.
	//
	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	var defaultMaxListeners = 10;
	EventEmitter.prototype.setMaxListeners = function (n) {
		if (typeof n !== 'number' || n < 0)
			throw TypeError('n must be a positive number');
		this._maxListeners = n;
	};

	EventEmitter.prototype.emit = function (type) {
		var er, handler, len, args, i, listeners;

		if (!this._events)
			this._events = {};

		// If there is no 'error' event listener then throw.
		if (type === 'error') {
			if (!this._events.error ||
				(typeof this._events.error === 'object' && !this._events.error.length)) {
				er = arguments[1];
				if (er instanceof Error) {
					throw er; // Unhandled 'error' event
				} else {
					throw TypeError('Uncaught, unspecified \'error\' event.');
				}
				return false;
			}
		}

		handler = this._events[type];

		if (typeof handler === 'undefined')
			return false;

		if (typeof handler === 'function') {
			switch (arguments.length) {
				// fast cases
				case 1:
					handler.call(this);
					break;
				case 2:
					handler.call(this, arguments[1]);
					break;
				case 3:
					handler.call(this, arguments[1], arguments[2]);
					break;
				// slower
				default:
					len = arguments.length;
					args = new Array(len - 1);
					for (i = 1; i < len; i++)
						args[i - 1] = arguments[i];
					handler.apply(this, args);
			}
		} else if (typeof handler === 'object') {
			len = arguments.length;
			args = new Array(len - 1);
			for (i = 1; i < len; i++)
				args[i - 1] = arguments[i];

			listeners = handler.slice();
			len = listeners.length;
			for (i = 0; i < len; i++)
				listeners[i].apply(this, args);
		}

		return true;
	};

	EventEmitter.prototype.addListener = function (type, listener) {
		var m;

		if (typeof listener !== 'function')
			throw TypeError('listener must be a function');

		if (!this._events)
			this._events = {};

		// To avoid recursion in the case that type === 'newListener'! Before
		// adding it to the listeners, first emit 'newListener'.
		if (this._events.newListener)
			this.emit('newListener', type, typeof listener.listener === 'function' ?
				listener.listener : listener);

		if (!this._events[type])
		// Optimize the case of one listener. Don't need the extra array object.
			this._events[type] = listener;
		else if (typeof this._events[type] === 'object')
		// If we've already got an array, just append.
			this._events[type].push(listener);
		else
		// Adding the second element, need to change to array.
			this._events[type] = [this._events[type], listener];

		// Check for listener leak
		if (typeof this._events[type] === 'object' && !this._events[type].warned) {
			m = this._maxListeners;
			if (m && m > 0 && this._events[type].length > m) {
				this._events[type].warned = true;
				console.error('(node) warning: possible EventEmitter memory ' +
					'leak detected. %d listeners added. ' +
					'Use emitter.setMaxListeners() to increase limit.',
					this._events[type].length);
				console.trace();
			}
		}

		return this;
	};

	EventEmitter.prototype.on = EventEmitter.prototype.addListener;

	EventEmitter.prototype.once = function (type, listener) {
		if (typeof listener !== 'function')
			throw TypeError('listener must be a function');

		function g() {
			this.removeListener(type, g);
			listener.apply(this, arguments);
		}

		g.listener = listener;
		this.on(type, g);

		return this;
	};

	EventEmitter.prototype.removeListener = function (type, listener) {
		var list, position, length, i;

		if (typeof listener !== 'function')
			throw TypeError('listener must be a function');

		if (!this._events || !this._events[type])
			return this;

		list = this._events[type];
		length = list.length;
		position = -1;

		if (list === listener ||
			(typeof list.listener === 'function' && list.listener === listener)) {
			this._events[type] = undefined;
			if (this._events.removeListener)
				this.emit('removeListener', type, listener);

		} else if (typeof list === 'object') {
			for (i = length; i-- > 0;) {
				if (list[i] === listener ||
					(list[i].listener && list[i].listener === listener)) {
					position = i;
					break;
				}
			}

			if (position < 0)
				return this;

			if (list.length === 1) {
				list.length = 0;
				this._events[type] = undefined;
			} else {
				list.splice(position, 1);
			}

			if (this._events.removeListener)
				this.emit('removeListener', type, listener);
		}

		return this;
	};

	EventEmitter.prototype.removeAllListeners = function (type) {
		var key, listeners;

		if (!this._events)
			return this;

		// not listening for removeListener, no need to emit
		if (!this._events.removeListener) {
			if (arguments.length === 0)
				this._events = {};
			else if (this._events[type])
				this._events[type] = undefined;
			return this;
		}

		// emit removeListener for all listeners on all events
		if (arguments.length === 0) {
			for (key in this._events) {
				if (key === 'removeListener') continue;
				this.removeAllListeners(key);
			}
			this.removeAllListeners('removeListener');
			this._events = {};
			return this;
		}

		listeners = this._events[type];

		if (typeof listeners === 'function') {
			this.removeListener(type, listeners);
		} else {
			// LIFO order
			while (listeners.length)
				this.removeListener(type, listeners[listeners.length - 1]);
		}
		this._events[type] = undefined;

		return this;
	};

	EventEmitter.prototype.listeners = function (type) {
		var ret;
		if (!this._events || !this._events[type])
			ret = [];
		else if (typeof this._events[type] === 'function')
			ret = [this._events[type]];
		else
			ret = this._events[type].slice();
		return ret;
	};

	EventEmitter.listenerCount = function (emitter, type) {
		var ret;
		if (!emitter._events || !emitter._events[type])
			ret = 0;
		else if (typeof emitter._events[type] === 'function')
			ret = 1;
		else
			ret = emitter._events[type].length;
		return ret;
	};

	/**@license MIT-promiscuous-©Ruben Verborgh*/
	(function (func, obj) {
		if (typeof window.Promise === 'function') {
			return;
		}

		// Type checking utility function
		function is(type, item) { return (typeof item)[0] == type; }

		// Creates a promise, calling callback(resolve, reject), ignoring other parameters.
		function Promise(callback, handler) {
			// The `handler` variable points to the function that will
			// 1) handle a .then(resolved, rejected) call
			// 2) handle a resolve or reject call (if the first argument === `is`)
			// Before 2), `handler` holds a queue of callbacks.
			// After 2), `handler` is a finalized .then handler.
			handler = function pendingHandler(resolved, rejected, value, queue, then, i) {
				queue = pendingHandler.q;

				// Case 1) handle a .then(resolved, rejected) call
				if (resolved != is) {
					return Promise(function (resolve, reject) {
						queue.push({ p: this, r: resolve, j: reject, 1: resolved, 0: rejected });
					});
				}

				// Case 2) handle a resolve or reject call
				// (`resolved` === `is` acts as a sentinel)
				// The actual function signature is
				// .re[ject|solve](<is>, success, value)

				// Check if the value is a promise and try to obtain its `then` method
				if (value && (is(func, value) | is(obj, value))) {
					try { then = value.then; }
					catch (reason) { rejected = 0; value = reason; }
				}
				// If the value is a promise, take over its state
				if (is(func, then)) {
					function valueHandler(resolved) {
						return function (value) { then && (then = 0, pendingHandler(is, resolved, value)); };
					}
					try { then.call(value, valueHandler(1), rejected = valueHandler(0)); }
					catch (reason) { rejected(reason); }
				}
				// The value is not a promise; handle resolve/reject
				else {
					// Replace this handler with a finalized resolved/rejected handler
					handler = function (Resolved, Rejected) {
						// If the Resolved or Rejected parameter is not a function,
						// return the original promise (now stored in the `callback` variable)
						if (!is(func, (Resolved = rejected ? Resolved : Rejected)))
							return callback;
						// Otherwise, return a finalized promise, transforming the value with the function
						return Promise(function (resolve, reject) { finalize(this, resolve, reject, value, Resolved); });
					};
					// Resolve/reject pending callbacks
					i = 0;
					while (i < queue.length) {
						then = queue[i++];
						// If no callback, just resolve/reject the promise
						if (!is(func, resolved = then[rejected]))
							(rejected ? then.r : then.j)(value);
						// Otherwise, resolve/reject the promise with the result of the callback
						else
							finalize(then.p, then.r, then.j, value, resolved);
					}
				}
			};
			// The queue of pending callbacks; garbage-collected when handler is resolved/rejected
			handler.q = [];

			// Create and return the promise (reusing the callback variable)
			callback.call(callback = { then:    function (resolved, rejected) { return handler(resolved, rejected); },
					"catch": function (rejected)           { return handler(0,        rejected); } },
				function (value)  { handler(is, 1,  value); },
				function (reason) { handler(is, 0, reason); });
			return callback;
		}

		// Finalizes the promise by resolving/rejecting it with the transformed value
		function finalize(promise, resolve, reject, value, transform) {
			setTimeout(function () {
				try {
					// Transform the value through and check whether it's a promise
					value = transform(value);
					transform = value && (is(obj, value) | is(func, value)) && value.then;
					// Return the result if it's not a promise
					if (!is(func, transform))
						resolve(value);
					// If it's a promise, make sure it's not circular
					else if (value == promise)
						reject(TypeError());
					// Take over the promise's state
					else
						transform.call(value, resolve, reject);
				}
				catch (error) { reject(error); }
			});
		}

		// Export the main module
		window.Promise = Promise;

		// Creates a resolved promise
		Promise.resolve = ResolvedPromise;
		function ResolvedPromise(value) { return Promise(function (resolve) { resolve(value); }); }

		// Creates a rejected promise
		Promise.reject = function (reason) { return Promise(function (resolve, reject) { reject(reason); }); };

		// Transforms an array of promises into a promise for an array
		Promise.all = function (promises) {
			return Promise(function (resolve, reject, count, values) {
				// Array of collected values
				values = [];
				// Resolve immediately if there are no promises
				count = promises.length || resolve(values);
				// Transform all elements (`map` is shorter than `forEach`)
				promises.map(function (promise, index) {
					ResolvedPromise(promise).then(
						// Store the value and resolve if it was the last
						function (value) {
							values[index] = value;
							--count || resolve(values);
						},
						// Reject if one element fails
						reject);
				});
			});
		};

		// Returns a promise that resolves or rejects as soon as one promise in the array does
		Promise.race = function (promises) {
			return Promise(function (resolve, reject) {
				// Register to all promises in the array
				promises.map(function (promise) {
					ResolvedPromise(promise).then(resolve, reject);
				});
			});
		};
	})('f', 'o');
}());
