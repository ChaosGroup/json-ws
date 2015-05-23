﻿using System;
using System.Threading;
﻿using ChaosGroup.JsonWS.Proxies;
﻿using Newtonsoft.Json.Linq;

namespace csharp
{
	internal class Program
	{
		private static void TestMethods()
		{
			using (var proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0"))
			{
				try
				{
					Console.WriteLine(proxy/*.UseWS()*/.ThrowError().Result);
				}
				catch (Exception e)
				{
					Console.WriteLine(e.ToString());
				}

				var task = proxy.Sum(1, 2);
				Console.WriteLine(task.Result);

				var r = new GeneratedTest.RenderOptions {width = 1, height = 2, renderMode = GeneratedTest.RenderMode.Production};
				var taskEcho = proxy.Echo(r);
				Console.WriteLine(taskEcho.Result.ToString());

				var o = new JObject();
				o["a"] = JToken.FromObject(new[] { 1, 2 });
				var taskEcho2 = proxy.EchoObject(o);
				Console.WriteLine(taskEcho2.Result.ToString());

				// binary message
				var bytes = proxy.EchoStringAsBuffer("binary").Result;
				Console.WriteLine("bytes: {0}, message: {1}", bytes.Length,
					System.Text.Encoding.Default.GetString(bytes));

				var bytesLength = proxy.GetBufferSize(bytes).Result;
				Console.WriteLine("bytes buffer size: {0}", bytesLength);
			}
		}

		private static void TestEvents()
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

				for (long i = 0, prev = i; i < 20; i++)
				{
					Console.WriteLine(prev = proxy.UseWS().Sum(i, prev).Result);
				}

				Thread.Sleep(10000);
				Console.WriteLine("{0}, {1}, {2}", n1, n2, n3);
			}
		}

		private static void TestUnsubscribe()
		{
			var proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0");
			int n1 = 0;
			EventHandler<GeneratedTest.DataEventArgs<long>> testEventHandler = (sender, data) =>
			{
				Console.WriteLine("event1:{0}", data.Data);
				n1++;
			};

			proxy.TestEvent += testEventHandler;
			Thread.Sleep(5000);
			Console.WriteLine(n1);

			proxy.TestEvent -= testEventHandler;
			Thread.Sleep(5000);
			Console.WriteLine(n1);
		}

		private static void Main(string[] args)
		{
			//TestUnsubscribe();
			//TestEvents();
			TestMethods();
		}
	}
}
