package com.chaosgroup.jsonws.stubs;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.chaosgroup.jsonws.stubs.GeneratedTest.*;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;
import java.util.concurrent.ExecutionException;

public class Main {
    public static void main(String[] args) throws Exception {

        /*SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        System.out.println("Date: " + sdf.format(new Date(System.currentTimeMillis())));
        String dateString = "2013-11-27T10:39:45.197Z";
        //Date date = sdf.parse(dateString);
        Date date = javax.xml.bind.DatatypeConverter.parseDateTime(dateString).getTime();
        System.out.println("Date: " + date);
        if (true) return;*/

        GeneratedTest.RenderOptions r = new GeneratedTest.RenderOptions();
        r.width = 640L;
        r.height = 360L;
        r.renderMode = RenderMode.RtGpuCuda;

        try (GeneratedTest proxy = new GeneratedTest("http://localhost:3000/endpoint/1.0")) {
            GeneratedTest.RenderOptions echoed = proxy.useHTTP().echo(r).get();
            System.out.println("HTTP RenderOptions: " + new Gson().toJson(echoed));
            r.width = 800L;
            r.height = 600L;
            r.renderMode = RenderMode.RtCpu;

            System.out.println("WS RenderOptions: " + new Gson().toJson(proxy.useWS().echo(r).get()));
            proxy.onTestEvent(new GeneratedTest.TestEventHandler() {
                @Override
                public void onTestEvent(Long data) {
                    System.out.println("Test event data " + data);
                }
            });

            System.out.println("HTTP Echo object: " +
                    proxy.useHTTP().echoObject(
                            (JsonObject) new Gson().toJsonTree(r, GeneratedTest.RenderOptions.class)).get());

            System.out.println("HTTP Sum = " + proxy.sum(5L, 6L).get());

            System.out.println("HTTP Array Sum = " + proxy.sumArray(new Long[]{1L, 2L, 3L, 4L}).get());

            Long[] numsTo20 = proxy.returnFrom0ToN(20L).get();
            for (long n : numsTo20) System.out.println("N = " + n);

            RenderOptions[] options = proxy.getRenderOptions().get();
            for (RenderOptions o : options) {
                System.out.println(new Gson().toJsonTree(o, GeneratedTest.RenderOptions.class));
            }

            byte[] stringBytes = proxy.useHTTP().echoStringAsBuffer("Hello, HTTP world!").get();
            System.out.println(new String(stringBytes, "UTF-8"));

            stringBytes = proxy.useWS().echoStringAsBuffer("Hello, WS world!").get();
            System.out.println(new String(stringBytes, "UTF-8"));

			System.out.println("Original string bytes length: " + stringBytes.length);
			System.out.println("HTTP String bytes length: " + proxy.useHTTP().getBufferSize(stringBytes).get());
			System.out.println("WS String bytes length: " + proxy.useWS().getBufferSize(stringBytes).get());

            timeHttp(proxy);
            timeWS(proxy);

            long prev = 1, curr = 1;
            for (int i = 0; i < 5; i++) {
                long pprev = prev;
                prev = curr;
                curr = proxy.useWS().sum(pprev, curr).get();
                System.out.println("WS Fib = " + curr);
            }

            System.out.println("HTTP Sum = " + proxy.useHTTP().sum(2L, 2L).get());

            // Test namespaces
            System.out.println("ns1.method1: " + proxy.ns1.method1().get());

            Thread.sleep(5000);
        }
    }

    private static void timeHttp(GeneratedTest proxy) {
        long startTime = System.currentTimeMillis();
        try {
            for (int i = 0; i < 10; i++) {
                proxy.useHTTP().echoStringAsBuffer("Hello, world!").get();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        System.out.println("HTTP took " + (System.currentTimeMillis() - startTime) + " ms");
    }

    private static void timeWS(GeneratedTest proxy) {
        long startTime = System.currentTimeMillis();
        try {
            for (int i = 0; i < 10; i++) {
                proxy.useWS().echoStringAsBuffer("Hello, world!").get();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        System.out.println("WS took " + (System.currentTimeMillis() - startTime) + " ms");
    }
}
