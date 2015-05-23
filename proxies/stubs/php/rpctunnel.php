<?php

class ExecutionException extends Exception {
}

class JSONDate implements JsonSerializable {
	private $timeString;
	const TIME_FORMAT = 'Y-m-d\\TH:i:s.u\\Z';

	public function __construct(DateTime $d) {
		$this->timeString = $d->format(self::TIME_FORMAT);
	}

	public function jsonSerialize() {
		return $this->timeString;
	}
}

class HTTPTransport {
	private $handle;

	private static $HEADERS = array();

	public function __construct($url) {
		$this->handle = curl_init($url);

		if (!$this->handle) {
			throw new Exception('Unable to create curl handle to ' . $url);
		}

		curl_setopt($this->handle, CURLOPT_CUSTOMREQUEST, 'POST');
		curl_setopt($this->handle, CURLOPT_RETURNTRANSFER, true);
	}

	public function sendMessage(array $payload, $convertTo = NULL) {
		$payload = json_encode($payload);

		curl_setopt($this->handle, CURLOPT_POSTFIELDS, $payload);
		curl_setopt($this->handle, CURLOPT_HTTPHEADER, array(
			'Content-Type: application/json',
			'Content-Length: ' . strlen($payload)
		));

		return $this->parseResponse(curl_exec($this->handle));
	}

	private function parseResponse($response) {
		$curlInfo = curl_getinfo($this->handle);

		if ($curlInfo['http_code'] == 500) {
			$json = json_decode($response);

			throw new ExecutionException($json->error->message);
		}

		if (stristr($curlInfo['content_type'], 'application/json')) {
			$json = json_decode($response);

			return $json->result;
		}


		if (stristr($curlInfo['content_type'], 'application/octet-stream')) {
			return $response;
		}

		throw new ExecutionException('Unsupported response type: ' . $curlInfo['content_type']);
	}
}

class RpcTunnel {
    private $url;
	private $transport;
	private $transportCache = array();
	const HTTP_TRANSPORT = 'HTTP_TRANSPORT';

	public static function toDateTime($timeString) {
		return new DateTime($timeString);
	}

    public function __construct($url) {
        $this->url = $url;
		$this->useHTTP();
    }

	public function call($method_name, array $method_params, callable $convertTo = NULL) {
		$payload = array(
			'jsonrpc' => '2.0',
			'method' => $method_name,
			'params' => $method_params,
			'id' => uniqid()
		);

		$result = $this->transport->sendMessage($payload);

		if (is_callable($convertTo)) {
			return call_user_func($convertTo, $result);
		} else {
			return $result;
		}
	}

	public function useHTTP() {
		$this->transport = $this->getTransport(self::HTTP_TRANSPORT);
	}

	private function getTransport($transportName) {
		if (!in_array($transportName, $this->transportCache)) {
			switch ($transportName) {
			case self::HTTP_TRANSPORT:
				$this->transportCache[$transportName] = new HTTPTransport($this->url);
				break;
			default:
				throw new Exception('Transport ' . $transportName . ' not implemented');
			}
		}

		return $this->transportCache[$transportName];
	}
}

?>
