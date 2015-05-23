using System;
using System.Text;
using System.Threading;
using ChaosGroup;
using ChaosGroup.JsonWS.Proxies;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json.Linq;

namespace tests
{
	[TestClass]
	public class Tests
	{
		private void TestMethods(GeneratedTest proxy)
		{
			try
			{
				Console.WriteLine(proxy.ThrowError().Result);
				Assert.Fail("Server-side exception was not rethrown on the client");
			}
			catch (Exception)
			{
			}

			var task = proxy.Sum(1, 2);
			Assert.AreEqual(task.Result, 3);

			var r = new GeneratedTest.RenderOptions { width = 1, height = 2, renderMode = GeneratedTest.RenderMode.Production };
			var taskEcho = proxy.Echo(r);
			Assert.AreEqual(r.width, taskEcho.Result.width);
			Assert.AreEqual(r.height, taskEcho.Result.height);
			Assert.AreEqual(r.renderMode, taskEcho.Result.renderMode);

			var o = new JObject();
			o["a"] = JToken.FromObject(new[] { 1, 2 });
			var taskEcho2 = proxy.EchoObject(o);
			Assert.AreEqual(o["a"].ToString(), taskEcho2.Result["a"].ToString());

			var bytes = proxy.EchoStringAsBuffer("binary").Result;
			Assert.AreEqual("binary", Encoding.UTF8.GetString(bytes));

			var bytesLength = proxy.GetBufferSize(bytes).Result;
			Assert.AreEqual(bytes.LongLength, bytesLength);
		}

		[TestMethod]
		public void TestMethodsWS()
		{
			using (var proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0").UseWS())
			{
				TestMethods(proxy);
			}
		}

		[TestMethod]
		public void TestMethodsHTTP()
		{
			using (var proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0").UseHTTP())
			{
				TestMethods(proxy);
			}
		}

		[TestMethod]
		public void TestEvents()
		{
			using (var proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0"))
			{
				int n1 = 0;
				int n2 = 0;
				int n3 = 0;

				proxy.TestEvent2 += (sender, data) =>
				{
					Console.WriteLine("event2:{0}", data.Data[0].width);
					n2++;
				};

				proxy.TestEvent += (sender, data) =>
				{
					Console.WriteLine("event1:{0}", data.Data);
					n1++;
				};

				proxy.TestEvent3 += (sender, data) =>
				{
					Console.WriteLine("event3:{0}", data.Data);
					n3++;
				};

				string s = null;
				proxy.TestBinaryEvent += (sender, data) =>
				{
					s = Encoding.UTF8.GetString(data.Data);
					Console.WriteLine(s);
				};

				Thread.Sleep(6000);
				Assert.IsTrue(n1 > 0);
				Assert.IsTrue(n2 > 0);
				Assert.IsTrue(n3 > 0);
				Assert.AreEqual(s, "test binary event");
			}
		}

		[TestMethod]
		public void TestUnsubscribe()
		{
			var proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0");
			var n1 = 0;
			EventHandler<GeneratedTest.DataEventArgs<long>> testEventHandler = (sender, data) =>
			{
				n1++;
			};
			proxy.TestEvent += testEventHandler;
			Thread.Sleep(1500);
			proxy.TestEvent -= testEventHandler;
			Thread.Sleep(2000);
			Assert.AreEqual(n1, 1);
		}
	}
}
