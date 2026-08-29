# TRACE 三设备软件接口

## 老师软件只连接一个地址

```text
ws://127.0.0.1:8797/trace
```

统一网关负责连接三块 Pebble、设备重连、IP 变化和命令路由。老师的软件不应保存 ESP32 的 IP，也不需要建立三个 WebSocket。

协议版本：`trace.pebble.v1`

## 与原单设备代码完全兼容的字段

一次完整捏压只输出一次 `trace_event`：

```json
{
  "type": "trace_event",
  "trigger": "squeeze",
  "pressure": 0.73,
  "duration": 640,
  "light": 0.42,
  "device_id": "trace-a1b2c3",
  "device_label": "Pebble-A1B2C3",
  "device_slot": 2,
  "event_id": "trace-a1b2c3-1787952340000-7",
  "captured_at": "2026-08-29T03:25:40.000Z"
}
```

原字段 `type`、`trigger`、`pressure`、`duration`、`light` 不变。老师原先的单设备监听逻辑可以继续工作；新增字段用于三设备映射。

## 软件 Moment 的固定映射

| 硬件事件 | 软件 Moment |
| --- | --- |
| `event_id` | `hardwareEventId`，用于去重和回放定位 |
| `device_id` | `pebbleId`，设备永久身份 |
| `device_label` | `pebbleLabel`，显示名称 |
| `device_slot` | `pebbleSlot`，界面中的 1 / 2 / 3 号 |
| `captured_at` | `capturedAt` |
| `pressure` | `pressure`，范围 `0..1` |
| `duration` | `durationMs`，单位毫秒 |
| `light` | `light`，范围 `0..1` |

只允许 `type === "trace_event" && trigger === "squeeze"` 创建 Moment。`trace_status` 只更新实时状态，不能创建内容。

## 每个软件交互的输入输出

| 软件交互 | 发给网关 | 网关/硬件返回 | 软件行为 |
| --- | --- | --- | --- |
| 打开软件 | 建立 WebSocket | `bridge_status`、`trace_devices` | 显示 1/2/3 在线状态 |
| 捏压 Pebble | 无需按钮 | `trace_event` | 创建且只创建一个 Moment |
| “让它生长”/保存 | 不发硬件命令 | 无 | 保存当前 Moment 与 `hardwareEventId/pebbleId` |
| “振动回放” | `replay + event_id` | `trace_command_routed`，随后 `trace_ack` | 只振动产生该 Moment 的 Pebble |
| “重新校准压力” | `calibrate + device_slot` | `trace_command_routed`，随后校准状态 | 只校准选中的 Pebble |
| 设备断线 | 无需按钮 | `trace_device_connection` | 标记该设备离线，不影响另外两台 |

## 精确回放命令

推荐使用保存于 Moment 的 `hardwareEventId`：

```json
{
  "type": "replay",
  "event_id": "trace-a1b2c3-1787952340000-7",
  "request_id": "ui-replay-1042"
}
```

也可以按设备发送：

```json
{"type":"replay","device_slot":2,"request_id":"ui-replay-1043"}
```

旧软件发送 `{"type":"replay"}` 仍然有效，网关会路由到最近产生捏压事件的 Pebble。正式版本应优先携带 `event_id`，避免多人同时操作时产生歧义。

成功回执：

```json
{
  "type": "trace_ack",
  "action": "replay",
  "status": "ok",
  "request_id": "ui-replay-1042",
  "device_id": "trace-a1b2c3",
  "device_slot": 2
}
```

## 可直接放进老师项目的代码

```js
import { TraceSoftwareAdapter } from "./trace-software-adapter.js";

const trace = new TraceSoftwareAdapter("ws://127.0.0.1:8797/trace");

trace.addEventListener("devices", ({ detail }) => {
  setPebbleDevices(detail);
});

trace.addEventListener("moment", ({ detail: moment }) => {
  createMemoryMoment(moment);
});

trace.addEventListener("ack", ({ detail }) => {
  if (detail.action === "replay" && detail.status === "ok") {
    markReplayComplete(detail.request_id);
  }
});

replayButton.addEventListener("click", () => trace.replay(currentMoment));
trace.connect();
```

适配器文件：`software-integration/trace-software-adapter.js`

## 三人展示与数据隔离

正式展示使用三个真实软件实例，而不是把同一个状态画三遍。统一展示页：

```text
http://127.0.0.1:8789/software-stage.html
```

展示页会把老师软件地址分别加载为：

```text
?traceDeviceSlot=1&traceProfile=trace-user-01
?traceDeviceSlot=2&traceProfile=trace-user-02
?traceDeviceSlot=3&traceProfile=trace-user-03
```

老师软件每个实例使用 `TraceSoftwareAdapter.fromLocation()`，这样只接收分配给自己的 Pebble 事件，未显式指定目标的回放和校准也只发给该 Pebble。

```js
const trace = TraceSoftwareAdapter.fromLocation();
const memoriesKey = trace.storageKey("memories");
trace.addEventListener("moment", ({ detail }) => createMemoryMoment(detail));
trace.connect();
```

如果软件用 `localStorage`，所有键必须通过 `trace.storageKey(...)` 加上 `traceProfile` 命名空间；如果软件有后端，读写记录必须按 `traceProfile` 或对应用户账号过滤。否则三个同源 iframe 会共享数据。

当前默认加载的是明确标注的接口验收页，可分别点击三屏的“测试输入”，确认只有本屏 Moment 增加。老师软件到场后，在顶部输入其完整 URL 并点击“加载三屏”即可原位替换。

## 到场后的六项联合验收

1. 老师软件只连接 `ws://127.0.0.1:8797/trace`。
2. 三块设备显示三个不同 `device_id`，但协议版本一致。
3. 分别捏压 1、2、3 号，每次只创建一个 Moment，Moment 保存正确 `pebbleSlot`。
4. 点击某个 Moment 的回放，只对应设备振动。
5. 同时操作两块设备，事件不覆盖，依靠 `event_id` 去重。
6. 拔掉任意一块，另外两块继续工作，插回后自动重连。
7. 三个软件实例分别保存不同内容；刷新后也不得互相出现对方数据。
