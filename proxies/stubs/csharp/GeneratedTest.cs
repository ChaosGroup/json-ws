using System;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;

namespace ChaosGroup.JsonWS.Proxies
{
	/// <summary>
	/// Test API 1.0
	///
	/// Part of the JSON-WS library - .NET 4.0 Proxy
	/// Copyright (c) 2013-2014 ChaosGroup. All rights reserved.
	/// This library depends on the following third party modules:
	/// - Newtonsoft.Json: http://json.codeplex.com/
	/// - WebSocket4Net: http://websocket4net.codeplex.com/
	/// </summary>
	public class GeneratedTest : IDisposable, IRpcEventHandler
	{
		// RPC tunnel - all method calls are piped here
		private RpcTunnel _rpcTunnel;
		// The transport mechanism used by the tunnel for each method call
		private RpcTransport _defaultTransport = RpcTransport.HTTP;

		public GeneratedTest(string url)
		{
			_rpcTunnel = new RpcTunnel(url, this);
		}

		/// <summary>
		/// Sets the default transport mechanism to HTTP
		/// </summary>
		public GeneratedTest UseHTTP()
		{
			_defaultTransport = RpcTransport.HTTP;
			return this;
		}

		/// <summary>
		/// Sets the default transport mechanism to WebSocket
		/// </summary>
		public GeneratedTest UseWS()
		{
			_defaultTransport = RpcTransport.WebSocket;
			return this;
		}

		public void Dispose()
		{
			_rpcTunnel.Dispose();
		}

		#region Types

		public class BaseRpcObject
		{
			public override string ToString()
			{
				return JsonConvert.SerializeObject(this);
			}
		}


		/// <summary>
		///
		/// </summary>
		public enum RenderMode
		{
			Production = -1, RtCpu = 0, RtGpuCuda = 5
		}

		/// <summary>
		///
		/// </summary>
		public class RenderOptions : BaseRpcObject
		{
			//
			public long width;
			//
			public long height;
			//
			public RenderMode renderMode;
		}

		/// <summary>
		///
		/// </summary>
		public class DefaultArray : BaseRpcObject
		{
			//
			public string[] property;
		}

		#endregion

		///
		/// Namespace Ns1 stub
		///
		public class Ns1
		{
			private readonly GeneratedTest _proxy;
			public Ns1(GeneratedTest p)
			{
				_proxy = p;
			}


			///
			/// Namespace Sub1 stub
			///
			public class Sub1
			{
				private readonly GeneratedTest _proxy;
				public Sub1(GeneratedTest p)
				{
					_proxy = p;
				}


				///
				/// Namespace Sub2 stub
				///
				public class Sub2
				{
					private readonly GeneratedTest _proxy;
					public Sub2(GeneratedTest p)
					{
						_proxy = p;
					}

					#region Methods

					/// <summary>
					///
					/// </summary>
					public void Method1()
					{
						_proxy._rpcTunnel.Call("ns1.sub1.sub2.method1", new object[] { }, false, _proxy._defaultTransport);
					}
					#endregion


				}

				// Namespace Sub2 stub instance variable
				private Sub2 __sub2;
				public Sub2 sub2
				{
					get { return __sub2 ?? (__sub2 = new Sub2(_proxy)); }
				}
				#region Methods
				#endregion


			}

			// Namespace Sub1 stub instance variable
			private Sub1 __sub1;
			public Sub1 sub1
			{
				get { return __sub1 ?? (__sub1 = new Sub1(_proxy)); }
			}
			#region Methods

			/// <summary>
			///
			/// </summary>
			public Task<string> Method1()
			{
				return _proxy._rpcTunnel.Call("ns1.method1",
					new object[] { }, true, _proxy._defaultTransport)
					.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<string>());
			}
			#endregion


		}

		// Namespace Ns1 stub instance variable
		private Ns1 __ns1;
		public Ns1 ns1
		{
			get { return __ns1 ?? (__ns1 = new Ns1(this)); }
		}

		///
		/// Namespace Ns2 stub
		///
		public class Ns2
		{
			private readonly GeneratedTest _proxy;
			public Ns2(GeneratedTest p)
			{
				_proxy = p;
			}


			///
			/// Namespace Sub1 stub
			///
			public class Sub1
			{
				private readonly GeneratedTest _proxy;
				public Sub1(GeneratedTest p)
				{
					_proxy = p;
				}


				///
				/// Namespace Sub2 stub
				///
				public class Sub2
				{
					private readonly GeneratedTest _proxy;
					public Sub2(GeneratedTest p)
					{
						_proxy = p;
					}

					#region Methods

					/// <summary>
					///
					/// </summary>
					public void Method1()
					{
						_proxy._rpcTunnel.Call("ns2.sub1.sub2.method1", new object[] { }, false, _proxy._defaultTransport);
					}
					#endregion


				}

				// Namespace Sub2 stub instance variable
				private Sub2 __sub2;
				public Sub2 sub2
				{
					get { return __sub2 ?? (__sub2 = new Sub2(_proxy)); }
				}
				#region Methods
				#endregion


			}

			// Namespace Sub1 stub instance variable
			private Sub1 __sub1;
			public Sub1 sub1
			{
				get { return __sub1 ?? (__sub1 = new Sub1(_proxy)); }
			}
			#region Methods
			#endregion


		}

		// Namespace Ns2 stub instance variable
		private Ns2 __ns2;
		public Ns2 ns2
		{
			get { return __ns2 ?? (__ns2 = new Ns2(this)); }
		}
		#region Methods

		/// <summary>
		/// Some test method example, does int sum
		/// </summary>
		/// <param name="a"></param>
		/// <param name="b"></param>
		public Task<long> Sum(long a, long b)
		{
			return _rpcTunnel.Call("sum",
				new object[] { a, b }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<long>());
		}

		/// <summary>
		///
		/// </summary>
		public void SumReturn()
		{
			_rpcTunnel.Call("sumReturn", new object[] { }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="a"></param>
		public Task<RenderOptions> Echo(RenderOptions a)
		{
			return _rpcTunnel.Call("echo",
				new object[] { a }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<RenderOptions>());
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="a"></param>
		public Task<JObject> EchoObject(JObject a)
		{
			return _rpcTunnel.Call("echoObject",
				new object[] { a }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<JObject>());
		}

		/// <summary>
		///
		/// </summary>
		public Task<long> ThrowError()
		{
			return _rpcTunnel.Call("throwError",
				new object[] { }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<long>());
		}

		/// <summary>
		///
		/// </summary>
		public void TestMe()
		{
			_rpcTunnel.Call("testMe", new object[] { }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		public Task TestMe1()
		{
			return _rpcTunnel.Call("testMe1",
				new object[] { }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.Error);
		}

		/// <summary>
		/// A sample method.
		/// </summary>
		/// <param name="a">A simple string parameter.</param>
		public Task<string> TestMe2(string a)
		{
			return _rpcTunnel.Call("testMe2",
				new object[] { a }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<string>());
		}

		/// <summary>
		///
		/// </summary>
		public void TestMe3()
		{
			_rpcTunnel.Call("testMe3", new object[] { }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		public void TestMe4()
		{
			_rpcTunnel.Call("testMe4", new object[] { }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="p"></param>
		public void TestDefaultArray(DefaultArray p)
		{
			_rpcTunnel.Call("TestDefaultArray", new object[] { p }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="u"></param>
		public Task<Uri> TestUrl(Uri u)
		{
			return _rpcTunnel.Call("TestUrl",
				new object[] { u }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<Uri>());
		}

		/// <summary>
		///
		/// </summary>
		public Task<RenderOptions[]> GetRenderOptions()
		{
			return _rpcTunnel.Call("getRenderOptions",
				new object[] { }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<RenderOptions[]>());
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="theString"></param>
		public Task<byte[]> EchoStringAsBuffer(string theString)
		{
			return _rpcTunnel.Call("echoStringAsBuffer",
				new object[] { theString }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<byte[]>());
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="buffer"></param>
		public Task<long> GetBufferSize(byte[] buffer)
		{
			return _rpcTunnel.Call("getBufferSize",
				new object[] { Convert.ToBase64String(buffer) }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<long>());
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="n"></param>
		public Task<long[]> ReturnFrom0ToN(long n)
		{
			return _rpcTunnel.Call("returnFrom0ToN",
				new object[] { n }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<long[]>());
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="required"></param>
		public void OptionalArgs(bool required)
		{
			_rpcTunnel.Call("optionalArgs", new object[] { required }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="required"></param>
		/// <param name="p1"></param>
		public void OptionalArgs(bool required, long p1)
		{
			_rpcTunnel.Call("optionalArgs", new object[] { required, p1 }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="required"></param>
		/// <param name="p1"></param>
		/// <param name="p2"></param>
		public void OptionalArgs(bool required, long p1, long p2)
		{
			_rpcTunnel.Call("optionalArgs", new object[] { required, p1, p2 }, false, _defaultTransport);
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="ints"></param>
		public Task<long> SumArray(long[] ints)
		{
			return _rpcTunnel.Call("sumArray",
				new object[] { ints }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<long>());
		}

		/// <summary>
		///
		/// </summary>
		/// <param name="a"></param>
		public Task<JObject> TestAny(JObject a)
		{
			return _rpcTunnel.Call("testAny",
				new object[] { a }, true, _defaultTransport)
				.ContinueWith(rpcMessage => rpcMessage.Result.GetResult<JObject>());
		}
		#endregion


		#region Events

		public class DataEventArgs<T> : EventArgs
		{
			public T Data { get; private set; }
			public DataEventArgs(T data)
			{
				Data = data;
			}
		}

		private EventHandler<DataEventArgs<long>> _testEventHandler;
		public event EventHandler<DataEventArgs<long>> TestEvent
		{
			add
			{
				_rpcTunnel.Call("rpc.on", new object[] { "testEvent" }, false, RpcTransport.WebSocket);
				_testEventHandler += value;
			}
			remove
			{
				_rpcTunnel.Call("rpc.off", new object[] { "testEvent" }, false, RpcTransport.WebSocket);
				_testEventHandler -= value;
			}
		}

		private EventHandler<DataEventArgs<RenderOptions[]>> _testEvent2Handler;
		public event EventHandler<DataEventArgs<RenderOptions[]>> TestEvent2
		{
			add
			{
				_rpcTunnel.Call("rpc.on", new object[] { "testEvent2" }, false, RpcTransport.WebSocket);
				_testEvent2Handler += value;
			}
			remove
			{
				_rpcTunnel.Call("rpc.off", new object[] { "testEvent2" }, false, RpcTransport.WebSocket);
				_testEvent2Handler -= value;
			}
		}

		private EventHandler<DataEventArgs<JObject>> _testEvent3Handler;
		public event EventHandler<DataEventArgs<JObject>> TestEvent3
		{
			add
			{
				_rpcTunnel.Call("rpc.on", new object[] { "testEvent3" }, false, RpcTransport.WebSocket);
				_testEvent3Handler += value;
			}
			remove
			{
				_rpcTunnel.Call("rpc.off", new object[] { "testEvent3" }, false, RpcTransport.WebSocket);
				_testEvent3Handler -= value;
			}
		}

		private EventHandler<DataEventArgs<bool>> _testEvent4Handler;
		public event EventHandler<DataEventArgs<bool>> TestEvent4
		{
			add
			{
				_rpcTunnel.Call("rpc.on", new object[] { "testEvent4" }, false, RpcTransport.WebSocket);
				_testEvent4Handler += value;
			}
			remove
			{
				_rpcTunnel.Call("rpc.off", new object[] { "testEvent4" }, false, RpcTransport.WebSocket);
				_testEvent4Handler -= value;
			}
		}

		private EventHandler<DataEventArgs<byte[]>> _testBinaryEventHandler;
		public event EventHandler<DataEventArgs<byte[]>> TestBinaryEvent
		{
			add
			{
				_rpcTunnel.Call("rpc.on", new object[] { "testBinaryEvent" }, false, RpcTransport.WebSocket);
				_testBinaryEventHandler += value;
			}
			remove
			{
				_rpcTunnel.Call("rpc.off", new object[] { "testBinaryEvent" }, false, RpcTransport.WebSocket);
				_testBinaryEventHandler -= value;
			}
		}

		private EventHandler _ns1_testEvent1Handler;
		public event EventHandler Ns1_testEvent1
		{
			add
			{
				_rpcTunnel.Call("rpc.on", new object[] { "ns1.testEvent1" }, false, RpcTransport.WebSocket);
				_ns1_testEvent1Handler += value;
			}
			remove
			{
				_rpcTunnel.Call("rpc.off", new object[] { "ns1.testEvent1" }, false, RpcTransport.WebSocket);
				_ns1_testEvent1Handler -= value;
			}
		}

		#endregion

		public void HandleRpcEvent(string eventId, JToken eventData)
		{
			switch (eventId)
			{

				case "testEvent":
					var testEventHandler = _testEventHandler;
					if (testEventHandler != null)
					{
						var data = (long)JsonConvert.DeserializeObject(eventData.ToString(), typeof(long));
						testEventHandler(this, new DataEventArgs<long>(data));
					}
					break;

				case "testEvent2":
					var testEvent2Handler = _testEvent2Handler;
					if (testEvent2Handler != null)
					{
						var data = (RenderOptions[])JsonConvert.DeserializeObject(eventData.ToString(), typeof(RenderOptions[]));
						testEvent2Handler(this, new DataEventArgs<RenderOptions[]>(data));
					}
					break;

				case "testEvent3":
					var testEvent3Handler = _testEvent3Handler;
					if (testEvent3Handler != null)
					{
						var data = eventData.Value<JObject>();
						testEvent3Handler(this, new DataEventArgs<JObject>(data));
					}
					break;

				case "testEvent4":
					var testEvent4Handler = _testEvent4Handler;
					if (testEvent4Handler != null)
					{
						var data = eventData.Value<bool>();
						testEvent4Handler(this, new DataEventArgs<bool>(data));
					}
					break;

				case "testBinaryEvent":
					var testBinaryEventHandler = _testBinaryEventHandler;
					if (testBinaryEventHandler != null)
					{
						var data = Convert.FromBase64String(eventData.ToString());
						testBinaryEventHandler(this, new DataEventArgs<byte[]>(data));
					}
					break;

				case "ns1.testEvent1":
					var ns1_testEvent1Handler = _ns1_testEvent1Handler;
					if (ns1_testEvent1Handler != null)
					{

						ns1_testEvent1Handler(this, null);
					}
					break;

			}
		}


	}
}
