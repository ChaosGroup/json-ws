package com.chaosgroup.jsonws.stubs;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ServerHandshake;

import java.io.*;
import java.net.*;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class RpcTunnel implements AutoCloseable {

	public enum Transport {
		HTTP, WebSocket
	}

	private final AtomicInteger nextId = new AtomicInteger(0);
	private final Map<Transport, RpcTransport> transports = new HashMap<>();

	public RpcTunnel(String httpUrl, EventHandler eventHandler) throws MalformedURLException, URISyntaxException {
		transports.put(Transport.HTTP, new HttpTransport(httpUrl));
		transports.put(Transport.WebSocket, new WebSocketTransport(httpUrl, eventHandler));
	}

	public Future<RpcMessage> call(String method, Object[] params, boolean expectReturn, final Transport transport) {
		final JsonObject json = new JsonObject();
		json.addProperty("jsonrpc", "2.0");
		if (expectReturn) {
			json.addProperty("id", nextId.getAndIncrement());
		}
		json.addProperty("method", method);
		json.add("params", new Gson().toJsonTree(params));
		return transports.get(transport).sendMessage(json);
	}

	@Override
	public void close() throws Exception {
		for (RpcTransport transport : transports.values()) {
			transport.close();
		}
	}

	public interface EventHandler {
		public void onEvent(String eventId, JsonElement eventData);
	}
}

final class RpcMessage {
	private JsonObject jsonMessage;
	private byte[] binaryMessage;

	public RpcMessage(JsonObject json) {
		jsonMessage = json;
	}

	public RpcMessage(byte[] rawBytes) {
		binaryMessage = rawBytes;
	}

	public boolean hasJsonMessage() {
		return jsonMessage != null;
	}

	public JsonObject getJsonMessage() {
		if (jsonMessage == null) {
			throw new IllegalStateException();
		}
		return jsonMessage;
	}

	public byte[] getBinaryMessage() {
		if (binaryMessage == null) {
			throw new IllegalStateException();
		}
		return binaryMessage;
	}
}

interface RpcTransport extends AutoCloseable {
	Future<RpcMessage> sendMessage(final JsonObject message);
}

final class HttpTransport implements RpcTransport {

	private URL url;

	private ExecutorService executor =
			new ThreadPoolExecutor(1, 10, 10, TimeUnit.SECONDS, new LinkedBlockingQueue<Runnable>());

	public HttpTransport(String httpUrl) throws MalformedURLException {
		url = new URL(httpUrl);
	}

	@Override
	public Future<RpcMessage> sendMessage(final JsonObject message) {
		return executor.submit(new Callable<RpcMessage>() {
			@Override
			public RpcMessage call() throws Exception {
				return executePost(message.toString());
			}
		});
	}

	private RpcMessage executePost(String jsonBody) throws Exception {
		HttpURLConnection connection = null;
		boolean isResponseDataJson = false;
		try {
			connection = (HttpURLConnection) url.openConnection();
			connection.setRequestMethod("POST");
			connection.setRequestProperty("Content-Type", "application/json");
			connection.setRequestProperty("Content-Length", Integer.toString(jsonBody.getBytes().length));
			connection.setUseCaches(false);
			connection.setDoInput(true);
			connection.setDoOutput(true);
			DataOutputStream wr = new DataOutputStream(connection.getOutputStream());
			wr.writeBytes(jsonBody);
			wr.flush();
			wr.close();
			InputStream inputStream = connection.getInputStream();
			isResponseDataJson = connection.getHeaderField("Content-Type").equalsIgnoreCase("application/json");
			return isResponseDataJson
					? new RpcMessage(readJsonInputStream(inputStream))
					: new RpcMessage(readBinaryInputStream(inputStream));
		} catch (IOException ex) {
			isResponseDataJson = connection != null && connection.getHeaderField("Content-Type").equalsIgnoreCase("application/json");
			if (isResponseDataJson && connection.getResponseCode() == 500) {
				return new RpcMessage(readJsonInputStream(connection.getErrorStream()));
			}
			throw ex;
		} finally {
			if (connection != null) {
				connection.disconnect();
			}
		}
	}

	private static JsonObject readJsonInputStream(InputStream is) throws IOException {
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
			return (JsonObject) new JsonParser().parse(reader);
		}
	}

	private static byte[] readBinaryInputStream(InputStream is) throws IOException {
		ByteArrayOutputStream buffer = new ByteArrayOutputStream();
		int bytesRead;
		byte[] data = new byte[16384];
		while ((bytesRead = is.read(data, 0, data.length)) != -1) {
			buffer.write(data, 0, bytesRead);
		}
		buffer.flush();
		return buffer.toByteArray();
	}

	@Override
	public void close() throws Exception {
		executor.shutdownNow();
	}
}

final class WebSocketTransport implements RpcTransport {

	private final WebSocketClient webSocketClient;
	private final RpcTunnel.EventHandler eventHandler;

	private ExecutorService executor =
			new ThreadPoolExecutor(1, 10, 10, TimeUnit.SECONDS, new LinkedBlockingQueue<Runnable>());

	private final CountDownLatch openEvent = new CountDownLatch(1);
	private final Map<Integer, CountDownLatch> messageLocks = new ConcurrentHashMap<>();
	private final ConcurrentHashMap<Integer, JsonObject> messageResults = new ConcurrentHashMap<>();

	private class WebSocketClient extends org.java_websocket.client.WebSocketClient {

		private Throwable lastError = null;

		public WebSocketClient(URI serverURI) {
			super(serverURI);
			this.connect();
		}

		@Override
		public void onOpen(ServerHandshake serverHandshake) {
			openEvent.countDown();
		}

		@Override
		public void onMessage(String message) {
			JsonObject jsonMessage = (JsonObject) new JsonParser().parse(message);
			if (!jsonMessage.has("id")) {
				return;
			}
			if (jsonMessage.get("id").getAsJsonPrimitive().isString()) {
				String eventId = jsonMessage.get("id").getAsString();
				eventHandler.onEvent(eventId, jsonMessage.get("result"));
			} else {
				int id = jsonMessage.get("id").getAsInt();
				messageResults.putIfAbsent(id, jsonMessage);
				CountDownLatch messageLock = messageLocks.get(id);
				if (messageLock != null) {
					messageLock.countDown();
				}
			}
		}

		@Override
		public void onClose(int code, String reason, boolean remote) {
			lastError = new Exception("WebSocket closed");
			WebSocketTransport.this.close();
		}

		@Override
		public void onError(Exception e) {
			lastError = e;
			openEvent.countDown();
		}

		@Override
		public void send(String text) {
			super.send(text);
		}
	}

	private void waitForOpenedOrFail() throws InterruptedException {
		if (webSocketClient.getReadyState() == WebSocket.READYSTATE.OPEN) {
			return;
		}
		if (webSocketClient.lastError != null) {
			throw new InterruptedException();
		}
		openEvent.await();
		if (webSocketClient.lastError != null || webSocketClient.getReadyState() != WebSocket.READYSTATE.OPEN) {
			throw new InterruptedException();
		}
	}

	public WebSocketTransport(String httpUrl, RpcTunnel.EventHandler eventHandler) throws URISyntaxException {
		httpUrl = httpUrl.replace("http://", "ws://").replace("https://", "wss://");
		this.eventHandler = eventHandler;
		webSocketClient = new WebSocketClient(new URI(httpUrl));
	}

	@Override
	public Future<RpcMessage> sendMessage(final JsonObject message) {

		Future<RpcMessage> future = executor.submit(new Callable<RpcMessage>() {
			@Override
			public RpcMessage call() throws Exception {
				waitForOpenedOrFail();
				webSocketClient.send(message.toString());
				if (!message.has("id")) {
					return null;
				}
				int id = message.get("id").getAsInt();
				if (!messageResults.containsKey(id)) {
					CountDownLatch messageLock = new CountDownLatch(1);
					messageLocks.put(id, messageLock);
					messageLock.await();
				}
				return new RpcMessage(messageResults.remove(id));
			}
		});
		return message.has("id") ? future : null;
	}

	@Override
	public void close() {
		openEvent.countDown();
		executor.shutdownNow();
		webSocketClient.close();
	}
}

abstract class ProxyFuture<T> implements Future<T> {
	Future<RpcMessage> innerFuture;

	public ProxyFuture(Future<RpcMessage> innerFuture) {
		this.innerFuture = innerFuture;
	}

	@Override
	public boolean cancel(boolean mayInterruptIfRunning) {
		return innerFuture.cancel(mayInterruptIfRunning);
	}

	@Override
	public boolean isCancelled() {
		return innerFuture.isCancelled();
	}

	@Override
	public boolean isDone() {
		return innerFuture.isDone();
	}

	@Override
	public T get() throws InterruptedException, ExecutionException {
		return innerConvert(innerFuture.get());
	}

	@Override
	public T get(long timeout, TimeUnit unit) throws InterruptedException, ExecutionException, TimeoutException {
		return innerConvert(innerFuture.get(timeout, unit));
	}

	private T innerConvert(RpcMessage result) throws ExecutionException {
		if (result == null) {
			throw new ExecutionException("Empty result", null);
		}

		if (result.hasJsonMessage()) {
			JsonObject jsonResult = result.getJsonMessage();
			if (jsonResult.has("error") && !jsonResult.get("error").isJsonNull()) {
				throw new ExecutionException(jsonResult.get("error").toString(), null);
			}
			try {
				return convert(jsonResult.get("result"));
			} catch (Exception convertException) {
				throw new RuntimeException("Failed to convert result", convertException);
			}
		} else {
			return (T) result.getBinaryMessage();
		}
	}

	abstract T convert(JsonElement result) throws Exception;
}
