/**
 * Test API 1.0
 *
 * Part of the JSON-WS library - Java 1.7 Proxy
 * Copyright (c) 2013-2014 ChaosGroup. All rights reserved.
 *
 * This code uses the following libraries
 * 	- com.google.code.gson:gson:2.2.4
 *	- org.java-websocket:Java-WebSocket:1.3.0
 */

package com.chaosgroup.jsonws.stubs;

import java.net.MalformedURLException;
import java.net.URISyntaxException;
import java.net.URL;
import com.google.gson.*;

/**
 * Test API 1.0 Proxy
 */
public class GeneratedTest implements AutoCloseable {

	// RPC tunnel - all method calls are piped here
	private RpcTunnel rpcTunnel;
	// The transport mechanism used by the tunnel for each method call
	private RpcTunnel.Transport defaultTransport = RpcTunnel.Transport.HTTP;

	/**
	 * Constructs a new proxy using the specified URL
	 * @param url Full URL of the web service endpoint.
	 * @throws java.net.MalformedURLException
	 * @throws java.net.URISyntaxException
	 */
	public GeneratedTest(String url) throws MalformedURLException, URISyntaxException {
		rpcTunnel = new RpcTunnel(url, rpcEventHandler);
	}

	/**
	 * Sets the default transport mechanism to HTTP
	 */
	public GeneratedTest useHTTP() {
		defaultTransport = RpcTunnel.Transport.HTTP;
		return this;
	}

	/**
	 * Sets the default transport mechanism to WebSocket
	 */
	public GeneratedTest useWS() {
		defaultTransport = RpcTunnel.Transport.WebSocket;
		return this;
	}

	@Override
	public void close() throws Exception {
		rpcTunnel.close();
	}

	private TestEventHandler testEventHandler;
	public interface TestEventHandler {
		public static final String Name = "testEvent";
		void onTestEvent(Long data);
	}
	public void onTestEvent(TestEventHandler eventHandler) {
		testEventHandler = eventHandler;
		rpcTunnel.call(testEventHandler == null ? "rpc.off" : "rpc.on",
				new Object[] { TestEventHandler.Name }, false, RpcTunnel.Transport.WebSocket);
	}

	private TestEvent2Handler testEvent2Handler;
	public interface TestEvent2Handler {
		public static final String Name = "testEvent2";
		void onTestEvent2(RenderOptions[] data);
	}
	public void onTestEvent2(TestEvent2Handler eventHandler) {
		testEvent2Handler = eventHandler;
		rpcTunnel.call(testEvent2Handler == null ? "rpc.off" : "rpc.on",
				new Object[] { TestEvent2Handler.Name }, false, RpcTunnel.Transport.WebSocket);
	}

	private TestEvent3Handler testEvent3Handler;
	public interface TestEvent3Handler {
		public static final String Name = "testEvent3";
		void onTestEvent3(JsonObject data);
	}
	public void onTestEvent3(TestEvent3Handler eventHandler) {
		testEvent3Handler = eventHandler;
		rpcTunnel.call(testEvent3Handler == null ? "rpc.off" : "rpc.on",
				new Object[] { TestEvent3Handler.Name }, false, RpcTunnel.Transport.WebSocket);
	}

	private TestEvent4Handler testEvent4Handler;
	public interface TestEvent4Handler {
		public static final String Name = "testEvent4";
		void onTestEvent4(Boolean data);
	}
	public void onTestEvent4(TestEvent4Handler eventHandler) {
		testEvent4Handler = eventHandler;
		rpcTunnel.call(testEvent4Handler == null ? "rpc.off" : "rpc.on",
				new Object[] { TestEvent4Handler.Name }, false, RpcTunnel.Transport.WebSocket);
	}

	private TestBinaryEventHandler testBinaryEventHandler;
	public interface TestBinaryEventHandler {
		public static final String Name = "testBinaryEvent";
		void onTestBinaryEvent(byte[] data);
	}
	public void onTestBinaryEvent(TestBinaryEventHandler eventHandler) {
		testBinaryEventHandler = eventHandler;
		rpcTunnel.call(testBinaryEventHandler == null ? "rpc.off" : "rpc.on",
				new Object[] { TestBinaryEventHandler.Name }, false, RpcTunnel.Transport.WebSocket);
	}

	private Ns1_testEvent1Handler ns1_testEvent1Handler;
	public interface Ns1_testEvent1Handler {
		public static final String Name = "ns1.testEvent1";
		void onNs1_testEvent1();
	}
	public void onNs1_testEvent1(Ns1_testEvent1Handler eventHandler) {
		ns1_testEvent1Handler = eventHandler;
		rpcTunnel.call(ns1_testEvent1Handler == null ? "rpc.off" : "rpc.on",
				new Object[] { Ns1_testEvent1Handler.Name }, false, RpcTunnel.Transport.WebSocket);
	}


	@SuppressWarnings("FieldCanBeLocal")
	private final RpcTunnel.EventHandler rpcEventHandler = new RpcTunnel.EventHandler() {
		@Override
		public void onEvent(String eventId, JsonElement eventData) {
			switch (eventId) {

				case TestEventHandler.Name:
					if (testEventHandler != null) {
						testEventHandler.onTestEvent((Long) new Gson().fromJson(eventData, Long.class));
					}
					break;

				case TestEvent2Handler.Name:
					if (testEvent2Handler != null) {
						testEvent2Handler.onTestEvent2((RenderOptions[]) new Gson().fromJson(eventData, RenderOptions[].class));
					}
					break;

				case TestEvent3Handler.Name:
					if (testEvent3Handler != null) {
						testEvent3Handler.onTestEvent3(eventData.getAsJsonObject());
					}
					break;

				case TestEvent4Handler.Name:
					if (testEvent4Handler != null) {
						testEvent4Handler.onTestEvent4(eventData.getAsBoolean());
					}
					break;

				case TestBinaryEventHandler.Name:
					if (testBinaryEventHandler != null) {
						testBinaryEventHandler.onTestBinaryEvent(javax.xml.bind.DatatypeConverter.parseBase64Binary(eventData.getAsString()));
					}
					break;

				case Ns1_testEvent1Handler.Name:
					if (ns1_testEvent1Handler != null) {
						ns1_testEvent1Handler.onNs1_testEvent1();
					}
					break;

			}
		}
	};


	public static class BaseRpcObject {
		@Override
		public String toString() {
			return new Gson().toJson(this);
		}
	}

	/**
	 *
	 */
	public static enum RenderMode {
		Production, RtCpu, RtGpuCuda
	}

	/**
	 *
	 */
	public static class RenderOptions extends BaseRpcObject {
		//
		public Long width;
		//
		public Long height;
		//
		public RenderMode renderMode;
	}

	/**
	 *
	 */
	public static class DefaultArray extends BaseRpcObject {
		//
		public String[] property;
	}




	public final class ns1 {
		public final class sub1 {
			public final class sub2 {
				/**
				 *
				 */
				public void method1() {
					rpcTunnel.call("ns1.sub1.sub2.method1", new Object[] {  }, false, defaultTransport);
				}

			}
			public final sub2 sub2 = new sub2();

		}
		public final sub1 sub1 = new sub1();

		/**
		 *
		 */
		public ProxyFuture<String> method1() {
			return new ProxyFuture<String>(rpcTunnel.call("ns1.method1",
					new Object[] {  }, true, defaultTransport)) {
				@Override
				protected String convert(JsonElement result) {
					return result.getAsString();
				}
			};
		}

	}
	public final ns1 ns1 = new ns1();

	public final class ns2 {
		public final class sub1 {
			public final class sub2 {
				/**
				 *
				 */
				public void method1() {
					rpcTunnel.call("ns2.sub1.sub2.method1", new Object[] {  }, false, defaultTransport);
				}

			}
			public final sub2 sub2 = new sub2();

		}
		public final sub1 sub1 = new sub1();

	}
	public final ns2 ns2 = new ns2();

	/**
	 * Some test method example, does int sum
	 * @param a
	 * @param b
	 */
	public ProxyFuture<Long> sum(Long a, Long b) {
		return new ProxyFuture<Long>(rpcTunnel.call("sum",
				new Object[] { a, b }, true, defaultTransport)) {
			@Override
			protected Long convert(JsonElement result) {
				return (Long) new Gson().fromJson(result, Long.class);
			}
		};
	}

	/**
	 *
	 */
	public void sumReturn() {
		rpcTunnel.call("sumReturn", new Object[] {  }, false, defaultTransport);
	}

	/**
	 *
	 * @param a
	 */
	public ProxyFuture<RenderOptions> echo(RenderOptions a) {
		return new ProxyFuture<RenderOptions>(rpcTunnel.call("echo",
				new Object[] { a }, true, defaultTransport)) {
			@Override
			protected RenderOptions convert(JsonElement result) {
				return (RenderOptions) new Gson().fromJson(result, RenderOptions.class);
			}
		};
	}

	/**
	 *
	 * @param a
	 */
	public ProxyFuture<JsonObject> echoObject(JsonElement a) {
		return new ProxyFuture<JsonObject>(rpcTunnel.call("echoObject",
				new Object[] { a }, true, defaultTransport)) {
			@Override
			protected JsonObject convert(JsonElement result) {
				return result.getAsJsonObject();
			}
		};
	}

	/**
	 *
	 */
	public ProxyFuture<Long> throwError() {
		return new ProxyFuture<Long>(rpcTunnel.call("throwError",
				new Object[] {  }, true, defaultTransport)) {
			@Override
			protected Long convert(JsonElement result) {
				return (Long) new Gson().fromJson(result, Long.class);
			}
		};
	}

	/**
	 *
	 */
	public void testMe() {
		rpcTunnel.call("testMe", new Object[] {  }, false, defaultTransport);
	}

	/**
	 *
	 */
	public ProxyFuture<Void> testMe1() {
		return new ProxyFuture<Void>(rpcTunnel.call("testMe1",
				new Object[] {  }, true, defaultTransport)) {
			@Override
			protected Void convert(JsonElement result) {
				return null;
			}
		};
	}

	/**
	 * A sample method.
	 * @param a A simple string parameter.
	 */
	public ProxyFuture<String> testMe2(String a) {
		return new ProxyFuture<String>(rpcTunnel.call("testMe2",
				new Object[] { a }, true, defaultTransport)) {
			@Override
			protected String convert(JsonElement result) {
				return result.getAsString();
			}
		};
	}

	/**
	 *
	 */
	public void testMe3() {
		rpcTunnel.call("testMe3", new Object[] {  }, false, defaultTransport);
	}

	/**
	 *
	 */
	public void testMe4() {
		rpcTunnel.call("testMe4", new Object[] {  }, false, defaultTransport);
	}

	/**
	 *
	 * @param p
	 */
	public void TestDefaultArray(DefaultArray p) {
		rpcTunnel.call("TestDefaultArray", new Object[] { p }, false, defaultTransport);
	}

	/**
	 *
	 * @param u
	 */
	public ProxyFuture<URL> TestUrl(URL u) {
		return new ProxyFuture<URL>(rpcTunnel.call("TestUrl",
				new Object[] { u }, true, defaultTransport)) {
			@Override
			protected URL convert(JsonElement result) throws MalformedURLException {
				return new URL(result.getAsString());
			}
		};
	}

	/**
	 *
	 */
	public ProxyFuture<RenderOptions[]> getRenderOptions() {
		return new ProxyFuture<RenderOptions[]>(rpcTunnel.call("getRenderOptions",
				new Object[] {  }, true, defaultTransport)) {
			@Override
			protected RenderOptions[] convert(JsonElement result) {
				return (RenderOptions[]) new Gson().fromJson(result, RenderOptions[].class);
			}
		};
	}

	/**
	 *
	 * @param theString
	 */
	public ProxyFuture<byte[]> echoStringAsBuffer(String theString) {
		return new ProxyFuture<byte[]>(rpcTunnel.call("echoStringAsBuffer",
				new Object[] { theString }, true, defaultTransport)) {
			@Override
			protected byte[] convert(JsonElement result) {
				return javax.xml.bind.DatatypeConverter.parseBase64Binary(result.getAsString());
			}
		};
	}

	/**
	 *
	 * @param buffer
	 */
	public ProxyFuture<Long> getBufferSize(byte[] buffer) {
		return new ProxyFuture<Long>(rpcTunnel.call("getBufferSize",
				new Object[] { javax.xml.bind.DatatypeConverter.printBase64Binary(buffer) }, true, defaultTransport)) {
			@Override
			protected Long convert(JsonElement result) {
				return (Long) new Gson().fromJson(result, Long.class);
			}
		};
	}

	/**
	 *
	 * @param n
	 */
	public ProxyFuture<Long[]> returnFrom0ToN(Long n) {
		return new ProxyFuture<Long[]>(rpcTunnel.call("returnFrom0ToN",
				new Object[] { n }, true, defaultTransport)) {
			@Override
			protected Long[] convert(JsonElement result) {
				return (Long[]) new Gson().fromJson(result, Long[].class);
			}
		};
	}

	/**
	 *
	 * @param required
	 */
	public void optionalArgs(Boolean required) {
		rpcTunnel.call("optionalArgs", new Object[] { required }, false, defaultTransport);
	}

	/**
	 *
	 * @param required
	 * @param p1
	 */
	public void optionalArgs(Boolean required, Long p1) {
		rpcTunnel.call("optionalArgs", new Object[] { required, p1 }, false, defaultTransport);
	}

	/**
	 *
	 * @param required
	 * @param p1
	 * @param p2
	 */
	public void optionalArgs(Boolean required, Long p1, Long p2) {
		rpcTunnel.call("optionalArgs", new Object[] { required, p1, p2 }, false, defaultTransport);
	}

	/**
	 *
	 * @param ints
	 */
	public ProxyFuture<Long> sumArray(Long[] ints) {
		return new ProxyFuture<Long>(rpcTunnel.call("sumArray",
				new Object[] { ints }, true, defaultTransport)) {
			@Override
			protected Long convert(JsonElement result) {
				return (Long) new Gson().fromJson(result, Long.class);
			}
		};
	}

	/**
	 *
	 * @param a
	 */
	public ProxyFuture<JsonElement> testAny(JsonElement a) {
		return new ProxyFuture<JsonElement>(rpcTunnel.call("testAny",
				new Object[] { a }, true, defaultTransport)) {
			@Override
			protected JsonElement convert(JsonElement result) {
				return result;
			}
		};
	}

}
