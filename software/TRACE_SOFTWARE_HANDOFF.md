# TRACE 软件硬件接入交接

## 项目

- 项目路径：仓库内 `software/`
- 技术栈：React 19、Next.js App Router API、Vinext/Vite、TypeScript、Cloudflare Sites
- 包管理器：npm
- 开发启动：`npm run dev`
- 局域网联调：`npm run dev:lan`
- 构建：`npm run build`
- 代码检查：`npm run lint`

## 本次接入

软件新增 `TraceSoftwareAdapter`，默认连接统一 WebSocket 网关，并保留原来的 `BleCaptureAdapter` 作为备用路径。

默认网关：

```text
ws://127.0.0.1:8797/trace
```

可在 `.env.local` 中覆盖：

```text
VITE_TRACE_WS_URL=ws://127.0.0.1:8797/trace
```

也可使用查询参数：

- `traceGateway`：临时覆盖网关地址。
- `traceDeviceSlot=1|2|3`：当前软件实例只接收该槽位 Pebble 的事件。
- `traceProfile=trace-user-01|02|03`：隔离当前用户的 `localStorage`。
- `traceTransport=ble`：切回原 Web Bluetooth 连接；默认使用 WebSocket。

三人展示示例：

```text
http://127.0.0.1:3000/?traceDeviceSlot=1&traceProfile=trace-user-01
http://127.0.0.1:3000/?traceDeviceSlot=2&traceProfile=trace-user-02
http://127.0.0.1:3000/?traceDeviceSlot=3&traceProfile=trace-user-03
```

带 `traceDeviceSlot` 的展示实例会自动连接网关；普通单人页面仍由“连接 Pebble”按钮发起连接。断开后适配器自动重连。

## 数据映射

- `event_id` → `Trace.id` 与 `hardwareEventId`，用于持久化去重和 Replay 路由。
- `device_id` → `pebbleId`。
- `device_label` → `pebbleLabel`。
- `device_slot` → `pebbleSlot`。
- `captured_at` → `capturedAt`；缺失时仅作为兼容兜底使用本机接收时间。
- `pressure` → `pressure.peak`。
- `duration` → `pressure.durationMs`。
- `light` → `light`。
- `motion` → `motion`；缺失或 IMU 未接时为 `0`。

只有 `type=trace_event` 且 `trigger=squeeze` 的消息创建 Moment。`trace_status` 只作为遥测消息处理。

## 修改文件

- `lib/trace-software-adapter.ts`：网关连接、槽位过滤、重连、去重、Replay、校准及 Mock 注入。
- `app/page.tsx`：接收网关 Moment、四种连接状态、Replay、校准及用户隔离。
- `lib/types.ts`：补充硬件事件与设备字段。
- `lib/storage.ts`：按 `traceProfile` 隔离本地存储。
- `lib/showcase.ts`：刷新时保留 BLE 与 WebSocket 的真实硬件记录。
- `.env.example`：WebSocket 地址配置示例。
- `.gitignore`：允许提交 `.env.example`，继续忽略真实 `.env`。

## Mock 测试入口

开发环境浏览器控制台可调用：

```js
window.__TRACE_MOCK_EVENT__()
```

也可覆盖字段：

```js
window.__TRACE_MOCK_EVENT__({ device_slot: 2, event_id: 'manual-test-2' })
```

正式构建不会暴露该入口。

## 验证结果

- `npm run lint`：通过。
- `npm run build`：通过。
- 三槽位真实/虚拟网关联合测试：当前 Mac 上没有队友的 Windows 网关，尚未执行。
- Replay 路由联合测试：需要网关和虚拟或真实 Pebble 后执行。

## 联调依赖

队友 Windows 电脑需运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\hardware\tools\start-trace-demo.ps1
```

然后用 `npm run dev:lan` 在 Mac 启动项目，并在同一网络的 Windows 浏览器打开 Mac 的局域网 URL。虽然 HTML 来自 Mac，但 JavaScript 在 Windows 浏览器运行，因此默认 `ws://127.0.0.1:8797/trace` 会正确连接 Windows 本机网关。在线 HTTPS 演示页无法直接使用本机 `ws://` 网关，硬件联调应走本地 HTTP 页面。
