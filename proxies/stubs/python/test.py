from datetime import datetime
from GeneratedTest import GeneratedTest
from rpctunnel import RpcTunnel

try:
    import asyncio
except ImportError:
    import trollius as asyncio

print('Running tests...')
print('')

RenderOptions = GeneratedTest.RenderOptions
RenderMode = GeneratedTest.RenderMode
DefaultArray = GeneratedTest.DefaultArray

# Test the generated enums:
assert RenderMode.Production == -1
assert RenderMode.RtCpu == 0
assert RenderMode.RtGpuCuda == 5
assert RenderMode['Production'] == -1
assert RenderMode['RtCpu'] == 0
assert RenderMode['RtGpuCuda'] == 5
print('RenderMode OK')

# Test the generated types:
dictionary = {
    'width': 320,
    'height': 240,
    'renderMode': RenderMode.Production
}

renderOptions = RenderOptions(width=320,
                              height=240,
                              renderMode=RenderMode.Production)
assert renderOptions['renderMode'] == RenderMode.Production
assert renderOptions['width'] == 320
assert renderOptions['height'] == 240
assert renderOptions == RenderOptions(**dictionary)

print('RenderOptions OK')

print('')

with GeneratedTest('http://localhost:3000/endpoint/1.0') as proxy:
    loop = asyncio.get_event_loop()

    def result(future):
        return loop.run_until_complete(future)

    print('HTTP Transport:')

    renderOptions = RenderOptions(renderMode=RenderMode.RtGpuCuda, width=320, height=240)
    echoResult = result(proxy.echo(renderOptions))
    assert echoResult == renderOptions and isinstance(echoResult, RenderOptions)
    print('proxy.echo() OK')

    assert result(proxy.sum(2, 3)) == 5
    print('proxy.sum() OK')

    assert result(proxy.ns1.method1()) == 'test1'
    print('proxy.ns1.method1() OK')

    assert result(proxy.TestDefaultArray(DefaultArray(property=[1, 2, 3]))) is None
    print('proxy.TestDefaultArray() OK')

    renderOptionsList = result(proxy.getRenderOptions())
    assert len(renderOptionsList) == 3 and all([isinstance(item, RenderOptions) for item in renderOptionsList])
    print('proxy.getRenderOptions() OK')

    method1Raises = False
    try:
        result(proxy.ns1.sub1.sub2.method1())
    except RpcTunnel.ExecutionException as e:
        method1Raises = True
    assert method1Raises
    print('proxy.ns1.sub1.sub2.method1() OK')

    optionalArgsRaises = False
    try:
        result(proxy.optionalArgs(True, 1, 2))
        result(proxy.optionalArgs(True, 1))
        result(proxy.optionalArgs(True))
    except RpcTunnel.ExecutionException as e:
        optionalArgsRaises = True
    assert not optionalArgsRaises
    print('proxy.optionalArgs() OK')

    assert result(proxy.echoStringAsBuffer('Hello')) == bytearray('Hello', 'utf-8')
    print('proxy.echoStringAsBuffer() OK')

    assert result(proxy.getBufferSize(bytearray('abcd', 'utf-8'))) == 4
    print('proxy.getBufferSize() OK')

    assert result(proxy.getSeconds(datetime(2014, 5, 8, 10, 11, 12))) == 12
    print('proxy.getSeconds() OK')


    print('')
    print('WebSockets Transport:')
    proxy.useWS()

    assert result(proxy.testMe2('complete')) == 'test2complete'
    print('proxy.testMe2() OK')

    assert result(proxy.sumArray([1, 2, 3])) == 6
    print('proxy.sumArray() OK')

    assert result(proxy.returnFrom0ToN(3)) == [0, 1, 2]
    print('proxy.returnFrom0ToN() OK')

    assert result(proxy.TestDefaultArray(DefaultArray())) is None
    print('proxy.TestDefaultArray() OK')

    method1Raises = False
    try:
        result(proxy.ns2.sub1.sub2.method1())
    except RpcTunnel.ExecutionException as e:
        method1Raises = True
    assert method1Raises
    print('proxy.ns2.sub1.sub2.method1() OK')

    assert result(proxy.echoStringAsBuffer('Hello')) == bytearray('Hello', 'utf-8')
    print('proxy.echoStringAsBuffer() OK')

    assert result(proxy.getBufferSize(bytearray('abcd', 'utf-8'))) == 4
    print('proxy.getBufferSize() OK')

    assert isinstance(result(proxy.getNow()), datetime)
    print('proxy.getNow() OK')

    print('')
    print('Events:')

    @proxy.onTestEvent
    def testEventHandler(number):
        assert isinstance(number, int)
        print('testEvent OK')
        proxy.onTestEvent() # unsubscribe after the first result
    loop.run_until_complete(asyncio.sleep(1))

    @proxy.onTestEvent2
    def testEvent2Handler(list_of_options):
        assert len(list_of_options) == 1
        assert isinstance(list_of_options[0], RenderOptions)
        assert list_of_options[0]['width'] == 1
        print('testEvent2 OK')
        proxy.onTestEvent2() # unsubscribe after the first result
    loop.run_until_complete(asyncio.sleep(1))

    @proxy.onTestEvent3
    def testEvent3Handler(result):
        assert isinstance(result, dict) and result['a'] == 1
        print('testEvent3 OK')
        proxy.onTestEvent3() # unsubscribe after the first result
    loop.run_until_complete(asyncio.sleep(1))

    @proxy.onTestBinaryEvent
    def testBinaryEventHandler(result):
        assert isinstance(result, bytearray)
        print('testBinaryEvent OK')
        proxy.onTestBinaryEvent() # unsubscribe after the first result
    loop.run_until_complete(asyncio.sleep(1))

    @proxy.onNs1_testEvent1
    def ns1testEvent1Handler(result):
        assert result is None
        print('ns1.testEvent1 OK')
        proxy.onNs1_testEvent1() # unsubscribe after the first result
    loop.run_until_complete(asyncio.sleep(1))

    loop.stop()
    print('\nAll tests pass')
