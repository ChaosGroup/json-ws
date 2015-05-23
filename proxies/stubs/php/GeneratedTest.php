<?php
/**
 * Test API 1.0
 *
 * Part of the JSON-WS library - PHP Proxy
 * Copyright (c) 2014 ChaosGroup. All rights reserved.
 *
 * WebSockets transport and therefore events are not supported.
 */

require('./rpctunnel.php');

class GeneratedTest {
    /**
     * Proxy for json-ws web services.
     */

    static $RenderMode = array(
        'Production' => -1, '-1' => -1,
        'RtCpu' => 0, '0' => 0,
        'RtGpuCuda' => 5, '5' => 5,
    );

    static function RenderOptions($args) {
        return (object)$args;
    }

    static function DefaultArray($args) {
        return (object)$args;
    }


    /**
     * @param string $url The url of the web service
     */
    public function __construct($url) {
        // RpcTunnel
        $this->rpc = new RpcTunnel($url);
        // The default transport is HTTP
        $this->useHTTP();
    }

    public function ns1_sub1_sub2_method1() {
        return $this->rpc->call('ns1.sub1.sub2.method1', array());
    }

    public function ns1_method1() {
        return $this->rpc->call('ns1.method1', array());
    }

    public function ns2_sub1_sub2_method1() {
        return $this->rpc->call('ns2.sub1.sub2.method1', array());
    }

    /**
     * Some test method example, does int sum
     *
     * @param integer $a 
     * @param integer $b 
     *
     * @return integer
     */
    public function sum($a, $b) {
        return $this->rpc->call('sum', array($a, $b));
    }

    public function sumReturn() {
        return $this->rpc->call('sumReturn', array());
    }

    /**
     * @param RenderOptions $a 
     *
     * @return RenderOptions
     */
    public function echo_($a) {
        return $this->rpc->call('echo', array($a));
    }

    /**
     * @param object $a 
     *
     * @return object
     */
    public function echoObject($a) {
        return $this->rpc->call('echoObject', array($a));
    }

    public function throwError() {
        return $this->rpc->call('throwError', array());
    }

    public function testMe() {
        return $this->rpc->call('testMe', array());
    }

    public function testMe1() {
        return $this->rpc->call('testMe1', array());
    }

    /**
     * A sample method.
     *
     * @param string $a : A simple string parameter.
     *
     * @return string
     */
    public function testMe2($a) {
        return $this->rpc->call('testMe2', array($a));
    }

    public function testMe3() {
        return $this->rpc->call('testMe3', array());
    }

    public function testMe4() {
        return $this->rpc->call('testMe4', array());
    }

    /**
     * @param DefaultArray $p 
     */
    public function TestDefaultArray($p) {
        return $this->rpc->call('TestDefaultArray', array($p));
    }

    /**
     * @param string $u 
     *
     * @return string
     */
    public function TestUrl($u) {
        return $this->rpc->call('TestUrl', array($u));
    }

    public function getRenderOptions() {
        return $this->rpc->call('getRenderOptions', array());
    }

    /**
     * @param string $theString 
     *
     * @return string
     */
    public function echoStringAsBuffer($theString) {
        return $this->rpc->call('echoStringAsBuffer', array($theString));
    }

    /**
     * @param string $buffer 
     *
     * @return integer
     */
    public function getBufferSize($buffer) {
        return $this->rpc->call('getBufferSize', array(base64_encode($buffer)));
    }

    /**
     * @param integer $n 
     *
     * @return integer[]
     */
    public function returnFrom0ToN($n) {
        return $this->rpc->call('returnFrom0ToN', array($n));
    }

    /**
     * @param boolean $required 
     * @param integer $p1 
     * @param integer $p2 
     */
    public function optionalArgs($required, $p1=0, $p2=1) {
        return $this->rpc->call('optionalArgs', array($required, $p1, $p2));
    }

    /**
     * @param integer[] $ints 
     *
     * @return integer
     */
    public function sumArray(array $ints) {
        return $this->rpc->call('sumArray', array($ints));
    }

    /**
     * @param object $a 
     *
     * @return object
     */
    public function testAny($a) {
        return $this->rpc->call('testAny', array($a));
    }

    /**
     * @param DateTime $timeParam 
     *
     * @return integer
     */
    public function getSeconds(DateTime $timeParam) {
        return $this->rpc->call('getSeconds', array(new JSONDate($timeParam)));
    }

    public function getNow() {
        return $this->rpc->call('getNow', array(), 'RpcTunnel::toDateTime');
    }


    public function useHTTP() {
        $this->rpc->useHTTP();
    }
}
?>
