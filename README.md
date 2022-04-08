# New relic integration recipes

## integration-docker
- Integration for docker

Official integration: https://github.com/newrelic/nri-docker
> cgroup v2 not supported

Get infomation from `docker stats` command.

EventType: `customDockerSample`

|Property name|type|
|:--|:--|
|containerId|string|
|containerName|string|
|cpuPercent|number|
|memUsageBytes|number|
|memLimitBytes|number|
|memPercent|number|
|networkRxBytes|number|
|networkTxBytes|number|
|ioReadBytes|number|
|ioWriteBytes|number|

## integration-plug
> Hidden - env injection is not working...why?
- Integration for SwitchBot Plug mini

SwitchBot API: https://github.com/OpenWonderLabs/SwitchBotAPI#get-device-status

EventType: `pcPlugStatusSample`
|Property name|type|info|
|:--|:--|:--|
|deviceId|string||
|deviceType|string||
|hubDeviceId|string||
|power|number|on = 0, off = 1|
|voltage|number||
|weight|number||
|electricityOfDay|number||
|electricCurrent|number||

## integration-speedtest
- Integration for speedtest (fastcom)

Fast-cli: https://github.com/sindresorhus/fast-cli

EventType: `speedtestSample`
|Property name|type|
|:--|:--|
|downloadSpeed|number|
|uploadSpeed|number|
|downloaded|number|
|uploaded|number|
|latency|number|
|bufferBloat|number|

## integration-ups
- Integration for UPS

Network UPS Tools: https://networkupstools.org/

EventType: `upsSample`
Refer: https://wiki.archlinux.jp/index.php/Network_UPS_Tools
> `upsc` command output sample

## metric-storage
- Integration for HPE storages (Metric API)

ssacli: https://www.hpe.com/jp/ja/servers/linux/soft/ssacli.html

|Property name|
|:--|
|host.storage.array.multiDomain.status|
|host.storage.array.status|
|host.storage.controller.cacheModule.temperature|
|host.storage.controller.status|
|host.storage.controller.temperature|
|host.storage.physicalDrive.status|
|host.storage.physicalDrive.temperature|
