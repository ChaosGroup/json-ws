using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using WebSocket4Net;
using ErrorEventArgs = SuperSocket.ClientEngine.ErrorEventArgs;

namespace ChaosGroup.JsonWS.Proxies
{
	/// <summary>
	/// Copyright (c) Chaos Software Ltd. 2013-2016. All rights reserved.
	/// </summary>
	class RpcTunnel : IDisposable
	{
		private bool _isDisposed;

		private int _nextMessageId;
		private readonly Dictionary<RpcTransport, IRpcTransport> _transports = new Dictionary<RpcTransport, IRpcTransport>();

		public RpcTunnel(string httpUrl, IRpcEventHandler rpcEventHandler)
		{
			_transports.Add(RpcTransport.HTTP, new HttpTransport(httpUrl));
			_transports.Add(RpcTransport.WebSocket, new WebSocketTransport(httpUrl, rpcEventHandler));
		}

		public void Dispose()
		{
			if (_isDisposed)
			{
				return;
			}
			_isDisposed = true;
			foreach (var transport in _transports.Values)
			{
				transport.Dispose();
			}
			GC.SuppressFinalize(this);
		}

		public Task<RpcMessage> Call(string method, Object[] parameters, bool expectReturn, RpcTransport rpcTransport)
		{
			var json = new JObject();
			json["jsonrpc"] = "2.0";
			if (expectReturn)
			{
				json["id"] = Interlocked.Increment(ref _nextMessageId);
			}
			json["method"] = method;
			json["params"] = JToken.FromObject(parameters);
			return _transports[rpcTransport].SendMessage(json);
		}
	}

	public enum RpcTransport
	{
		HTTP,
		WebSocket
	}

	public class RpcMessage
	{
		public RpcMessage(JObject json)
		{
			JsonMessage = json;
		}

		public RpcMessage(byte[] bytes)
		{
			BinaryMessage = bytes;
		}

		public JObject JsonMessage { get; private set; }

		public byte[] BinaryMessage { get; private set; }

		public Exception Error
		{
			get
			{
				if (JsonMessage != null && JsonMessage["error"] != null)
				{
					throw new Exception(JsonMessage["error"].ToString());
				}
				return null;
			}
		}

		public T GetResult<T>()
		{
			if (Error != null) return default(T);
			if (JsonMessage == null) return (T)Convert.ChangeType(BinaryMessage, typeof(T));
			if (typeof(T).IsPrimitive)
			{
				return JsonMessage["result"].Value<T>();
			}
			if (typeof(T) == typeof(byte[]))
			{
				return (T)Convert.ChangeType(Convert.FromBase64String(JsonMessage["result"].ToString()), typeof(T));
			}
			return (T)JsonConvert.DeserializeObject(JsonMessage["result"].ToString(), typeof(T));
		}
	}

	public interface IRpcEventHandler
	{
		void HandleRpcEvent(String eventId, JToken eventData);
	}

	internal interface IRpcTransport : IDisposable
	{
		Task<RpcMessage> SendMessage(JObject message);
	}

	internal class HttpTransport : IRpcTransport
	{
		private readonly Uri _uri;

		public HttpTransport(string httpUrl)
		{
			_uri = new Uri(httpUrl);
		}

		public Task<RpcMessage> SendMessage(JObject message)
		{
			return Task<RpcMessage>.Factory.StartNew(() =>
			{
				var postBytes = Encoding.Default.GetBytes(message.ToString());
				var webReq = (HttpWebRequest)WebRequest.Create(_uri);
				webReq.Method = "POST";
				webReq.ContentType = "application/json";
				webReq.ContentLength = postBytes.Length;

				using (var postStream = webReq.GetRequestStream())
				{
					postStream.Write(postBytes, 0, postBytes.Length);
				}
				try
				{
					using (var response = webReq.GetResponse())
					using (var responseStream = response.GetResponseStream())
					{
						var isResponseDataJson = response.ContentType.StartsWith("application/json",
							StringComparison.InvariantCultureIgnoreCase);
						return isResponseDataJson
							? new RpcMessage(ReadJsonInputStream(responseStream))
							: new RpcMessage(ReadBinaryInputStream(responseStream));
					}
				}
				catch (WebException ex)
				{
					if (ex.Response != null && ex.Response.ContentLength != 0)
					{
						var isResponseDataJson = ex.Response.ContentType.StartsWith("application/json",
							StringComparison.InvariantCultureIgnoreCase);
						var statusCode = ((HttpWebResponse)ex.Response).StatusCode;
						if (isResponseDataJson && statusCode == HttpStatusCode.InternalServerError)
						{
							using (var responseStream = ex.Response.GetResponseStream())
							{
								return new RpcMessage(ReadJsonInputStream(responseStream));
							}
						}
					}
                    throw new InvalidOperationException("Failed to open HTTP transport.", ex); ;
				}
			}, TaskCreationOptions.LongRunning | TaskCreationOptions.PreferFairness);
		}

		public void Dispose()
		{
		}

		private static JObject ReadJsonInputStream(Stream stream)
		{
			using (var reader = new StreamReader(stream))
			{
				return JObject.Parse(reader.ReadToEnd());
			}
		}

		private static byte[] ReadBinaryInputStream(Stream stream)
		{
			var buffer = new byte[16 * 1024];
			using (var ms = new MemoryStream())
			{
				int read;
				while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
				{
					ms.Write(buffer, 0, read);
				}
				return ms.ToArray();
			}
		}
	}

	internal class WebSocketTransport : IRpcTransport
	{
		/// <summary>
		/// Keeps track of async method invocations
		/// </summary>
		private readonly ConcurrentDictionary<int, AutoResetEvent> _messageLocks =
			new ConcurrentDictionary<int, AutoResetEvent>();

		/// <summary>
		/// Keeps track of async method results
		/// </summary>
		private readonly ConcurrentDictionary<int, JObject> _messageResults = new ConcurrentDictionary<int, JObject>();

		private readonly ManualResetEvent _openEvent = new ManualResetEvent(false);
		private readonly WebSocket _webSocketClient;

		private bool _isClosed;
		private Exception _lastError;
		private readonly IRpcEventHandler _rpcEventHandler;

		public WebSocketTransport(string httpUrl, IRpcEventHandler rpcEventHandler)
		{
			httpUrl = httpUrl.Replace("http://", "ws://").Replace("https://", "wss://");
			_rpcEventHandler = rpcEventHandler;
			_webSocketClient = new WebSocket(httpUrl);
			_webSocketClient.Opened += webSocketClient_Opened;
			_webSocketClient.MessageReceived += webSocketClient_MessageReceived;
			_webSocketClient.Closed += webSocketClient_Closed;
			_webSocketClient.Error += webSocketClient_Error;
			_webSocketClient.Open();
		}

		private void WaitForOpenedOrFail()
		{
			if (_webSocketClient.State == WebSocketState.Open)
			{
				return;
			}

			if (_lastError != null)
			{
				throw new InvalidOperationException("Failed to open the web socket transport.", _lastError);
			}

			_openEvent.WaitOne();

			if (_lastError != null || _webSocketClient.State != WebSocketState.Open)
			{
				throw new InvalidOperationException("Failed to open the web socket transport.", _lastError);
			}
		}

		public Task<RpcMessage> SendMessage(JObject message)
		{
			return Task<RpcMessage>.Factory.StartNew(() =>
			{
				WaitForOpenedOrFail();
				lock (_webSocketClient)
				{
					_webSocketClient.Send(message.ToString());
				}
				if (message["id"] == null)
				{
					return null;
				}

				var id = (int)message["id"];
				if (!_messageResults.ContainsKey(id))
				{
                    var autoResetEvent = new AutoResetEvent(false);
				    _messageLocks[id] = autoResetEvent;
					autoResetEvent.WaitOne();
				}
				JObject result;
				return _messageResults.TryRemove(id, out result) ? new RpcMessage(result) : null;
			}, TaskCreationOptions.LongRunning | TaskCreationOptions.PreferFairness);
		}

		public void Dispose()
		{
			if (_isClosed)
			{
				return;
			}
			_isClosed = true;
			_openEvent.Set();
			//_openEvent.Reset();
			if (_webSocketClient.State == WebSocketState.Open)
			{
				_webSocketClient.Close();
			}
			GC.SuppressFinalize(this);
		}

		private void webSocketClient_Opened(object sender, EventArgs e)
		{
			_openEvent.Set();
		}

		private void webSocketClient_Error(object sender, ErrorEventArgs e)
		{
			_lastError = e.Exception;
			_openEvent.Set();
		}

		private void webSocketClient_Closed(object sender, EventArgs e)
		{
			Dispose();
		}

		private void webSocketClient_MessageReceived(object sender, MessageReceivedEventArgs e)
		{
			var json = JObject.Parse(e.Message);
			if (json["id"] == null)
			{
				return;
			}

			if (json["id"].Type == JTokenType.Integer)
			{
				var id = (int)json["id"];
				_messageResults.TryAdd(id, json);
				AutoResetEvent autoResetEvent;
				if (_messageLocks.TryRemove(id, out autoResetEvent))
				{
					autoResetEvent.Set();
				}
			}
			else if (_rpcEventHandler != null)
			{
				_rpcEventHandler.HandleRpcEvent((string)json["id"], json["result"]);
			}
		}
	}
}
