<?php

require('./GeneratedTest.php');

class JSONWSProxyTest extends PHPUnit_Framework_TestCase {
	public function setUp() {
		$this->gt = new GeneratedTest('http://localhost:3000/endpoint/1.0');
	}

	public function testEcho() {
		$renderOptions = GeneratedTest::RenderOptions(array(
			'renderMode' => 'RtGpuCuda',
			'width' => 320,
			'height' => 240
		));

		$result = $this->gt->echo_($renderOptions);

		$this->assertEquals($renderOptions, $result);
	}

	public function testSum() {
		$result = $this->gt->sum(2, 3);

		$this->assertEquals(5, $result);
	}

	public function testEchoObject() {
		$obj = (object) array('foo' => 'bar');
		$result = $this->gt->echoObject($obj);

		$this->assertEquals($obj, $result);
	}

	public function testNs1Method1() {
		$result = $this->gt->ns1_method1();

		$this->assertEquals('test1', $result);
	}

	public function testTestDefaultArray() {
		$result = $this->gt->testDefaultArray(GeneratedTest::DefaultArray(array(
			'property' => array(1, 2, 3)
		)));

		$this->assertEquals(NULL, $result);
	}

	public function testGetRenderOptions() {
		$result = $this->gt->getRenderOptions();

		$this->assertEquals(count($result), 3);
		$this->assertEquals((object) array(
			'width' => 640,
			'height' => 360,
			'renderMode' => 'RtCpu'
		), $result[0]);
	}

	public function testNs1Sub1Sub2Method1() {
		$this->setExpectedException('ExecutionException');

		$result = $this->gt->ns1_sub1_sub2_method1();
	}

	public function testOptionalArgs() {
		$this->gt->optionalArgs(true, 1, 2);
		$this->gt->optionalArgs(true, 1);
		$this->gt->optionalArgs(true);
	}

	public function testEchoStringAsBuffer() {
		$result = $this->gt->echoStringAsBuffer('abcd');

		$this->assertEquals('abcd', $result);
	}

	public function testGetBufferSize() {
		$result = $this->gt->getBufferSize('abcd');

		$this->assertEquals(4, $result);
	}

	public function testGetSeconds() {
		$result = $this->gt->getSeconds(new DateTime('2012-12-21 11:14:12'));

		$this->assertEquals(12, $result);
	}

	public function testGetNow() {
		$result = $this->gt->getNow();

		$this->assertInstanceOf('DateTime', $result);
	}
}

?>
