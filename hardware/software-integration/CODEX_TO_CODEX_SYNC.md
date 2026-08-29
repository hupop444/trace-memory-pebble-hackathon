# TRACE Codex-to-Codex 同步包

请将本文件全文发送给负责交互软件的 Codex。它应先读取并遵守下面的既有契约，然后检查软件项目，按末尾模板回复。不要仅回复建议或重述需求；需要给出实际文件路径、函数位置、修改内容和测试结果。

## 共同目标

把已经可交互的 TRACE 软件接到三块独立 Pebble 硬件。最终关系必须是：

```text
Pebble 01 -> User 01 -> Software Session 01 -> User 01 独立内容
Pebble 02 -> User 02 -> Software Session 02 -> User 02 独立内容
Pebble 03 -> User 03 -> Software Session 03 -> User 03 独立内容
```

三个软件实例界面相同，但输入频次、Moment 内容、后续生长和回放状态必须完全隔离。目标是接通现有软件，不重新设计界面。

## 硬件侧当前事实

- 硬件工程根目录：仓库内 `hardware/`
- 协议版本：`trace.pebble.v1`
- 软件只连接统一网关：`ws://127.0.0.1:8797/trace`
- 网关状态：`http://127.0.0.1:8796/status`
- 三人展示页：`http://127.0.0.1:8789/software-stage.html`
- 硬件测试页：`http://127.0.0.1:8789/`
- 启动命令：

```powershell
powershell -ExecutionPolicy Bypass -File .\hardware\tools\start-trace-demo.ps1
```

2026-08-29 11:41 +08:00 的运行状态：网关在线，三路软件客户端已连接，三个虚拟 Pebble 在线。虚拟设备只用于软件联调；真实设备接入后仍使用相同协议、槽位和软件代码。

## 已完成并验证的能力

1. 三设备统一发现、重连和命令路由。
2. 保留旧字段 `type`、`trigger`、`pressure`、`duration`、`light`。
3. 新增 `device_id`、`device_label`、`device_slot`、`event_id`、`captured_at`。
4. `event_id` 可把回放精确路由到产生该 Moment 的 Pebble。
5. 三个软件实例固定使用 `traceDeviceSlot=1/2/3`。
6. 三个用户固定使用 `traceProfile=trace-user-01/02/03`。
7. 适配器自动过滤槽位、为本地存储生成用户命名空间，并对 `event_id` 去重。
8. 浏览器端自动测试已经逐屏触发输入，最终计数为 `1/1/1`，没有串屏。
9. 网关契约测试全部通过：旧字段兼容、按事件回放、旧式无目标回放、按槽位校准。

## 软件必须遵守的输入规则

只有下面的消息可以创建一个 Moment：

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

- `trace_status` 仅更新遥测，不得创建 Moment。
- `duration` 单位为毫秒。
- `pressure` 与 `light` 范围为 `0..1`。
- Moment 必须保存 `hardwareEventId = event_id`、`pebbleId = device_id`、`pebbleSlot = device_slot`。

## 软件必须遵守的输出规则

推荐按 Moment 的原始硬件事件回放：

```json
{
  "type": "replay",
  "event_id": "trace-a1b2c3-1787952340000-7",
  "request_id": "ui-replay-1042"
}
```

校准指定设备：

```json
{"type":"calibrate","device_slot":2,"request_id":"ui-calibrate-1043"}
```

软件必须等待同一 `request_id` 的 `trace_ack` 再显示命令完成。不要把某个 ESP32 的局域网 IP 写进软件。

## 可直接接入的软件适配器

权威文件：`hardware/software-integration/trace-software-adapter.js`

将它复制到软件项目自身的源码目录，再在软件的真实入口中使用：

```js
import { TraceSoftwareAdapter } from "./trace-software-adapter.js";

const trace = TraceSoftwareAdapter.fromLocation();

trace.addEventListener("moment", ({ detail: moment }) => {
  createMemoryMoment(moment);
});

replayButton.addEventListener("click", () => {
  trace.replay(currentMoment);
});

trace.connect();
```

如果软件使用 `localStorage` 或 IndexedDB，必须按 `trace.profileId` 隔离，`localStorage` 推荐：

```js
const memoriesKey = trace.storageKey("memories");
```

如果软件有后端，所有读取、写入和订阅都必须按 `traceProfile` 对应的用户ID过滤。

## 对方 Codex 现在要执行的任务

1. 找到交互软件项目根目录，并确认它能在本机启动。
2. 记录框架、启动命令、实际URL和构建错误。
3. 找到当前模拟输入产生 Moment 的文件与函数。
4. 找到 Moment 的数据模型、保存位置和去重方式。
5. 找到振动回放、生长、保存、校准等真实按钮的处理函数。
6. 判断三个相同软件实例能否通过查询参数隔离；检查 iframe 的 CSP / `X-Frame-Options`。
7. 在不改变现有视觉和交互逻辑的前提下接入适配器。
8. 确保每个实例只接收自己的 `device_slot`，并只显示自己的 `traceProfile` 数据。
9. 把软件URL填入三人展示页，使用三台虚拟 Pebble 做端到端测试。
10. 返回实际改动文件、测试证据和剩余阻塞，不要只返回实施方案。

## 不要做的事情

- 不要让软件分别直连三个 ESP32 IP。
- 不要把 1 Hz `trace_status` 当成用户输入。
- 不要用到达时间或数组位置代替 `event_id` 去重。
- 不要让三个 iframe 共用无命名空间的本地数据。
- 不要重做老师已经完成的界面。
- 不要改网关或固件来迁就尚未定位的软件问题，除非先提供可复现的协议不兼容证据。

## 对方 Codex 必须按此格式回复

```text
TRACE_SOFTWARE_SYNC_REPLY

project_root:
framework:
package_manager:
run_command:
app_url:
current_run_status: PASS | FAIL

moment_input_file:
moment_input_function:
moment_model_file:
persistence: localStorage | IndexedDB | backend | memory-only | other
persistence_location_or_api:
dedupe_field:

replay_handler_file:
replay_handler_function:
save_or_grow_handlers:
calibrate_handler:

multi_profile_support: YES | NO | PARTIAL
profile_identifier:
iframe_allowed: YES | NO | UNKNOWN
blocking_headers:

adapter_copied_to:
files_changed:
integration_status: PASS | PARTIAL | FAIL

tests_run:
slot_1_result:
slot_2_result:
slot_3_result:
cross_user_isolation_result:
replay_routing_result:

remaining_blockers:
exact_next_action:
```

## 供对方 Codex 阅读的权威资料

- `hardware/software-integration/TEACHER_SOFTWARE_CONTRACT.md`
- `hardware/software-integration/CODEX_HANDOFF.md`
- `hardware/software-integration/trace-software-adapter.js`
- `hardware/tools/trace-software-gateway.mjs`
- `hardware/tools/test-software-contract.mjs`

回复后，请将完整 `TRACE_SOFTWARE_SYNC_REPLY` 原样交回硬件侧 Codex。硬件侧将据此核对接口、运行联合测试，并只在有证据时调整协议。
