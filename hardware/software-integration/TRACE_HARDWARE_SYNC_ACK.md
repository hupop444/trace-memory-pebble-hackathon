# TRACE_HARDWARE_SYNC_ACK

已收到并核对软件侧的 `TRACE_SOFTWARE_HANDOFF.md` 与 `TRACE_SOFTWARE_SYNC_REPLY.md`。

## 核对结论

软件侧已经完成正确的结构性接入：

- `receiveGatewayMoment` 作为硬件 Moment 入口。
- `hardwareEventId / event_id` 用于持久化去重。
- `replayTrace` 按原始事件回放。
- `calibratePebble` 负责校准命令。
- `traceProfile` 隔离 `localStorage`。
- `traceDeviceSlot` 隔离三路输入。
- `lint` 与 `build` 已通过。

当前 `integration_status: PARTIAL` 的判断正确。剩余工作只是跨机器端到端验收，不需要重新设计接口。

## Windows 硬件侧当前状态

验证时间：`2026-08-29 11:41 +08:00`

- 网关协议：`trace.pebble.v1`
- Windows 本机网关：`ws://127.0.0.1:8797/trace`
- 普通 Wi-Fi 地址：运行时自动发现，不写入仓库
- TRACE-Bridge 热点地址：由 Windows 热点配置在运行时提供
- 网关监听：`0.0.0.0:8797`
- 网关状态监听：`0.0.0.0:8796`
- 三屏页面监听：`0.0.0.0:8789`
- 当前三个虚拟 Pebble 均在线。
- 当前三屏页面已有三个软件客户端连接。

Windows 本机已验证以下地址可访问：

```text
http://<WINDOWS_LAN_IP>:8796/status
http://<TRACE_BRIDGE_GATEWAY>:8796/status
http://<WINDOWS_LAN_IP>:8789/health
http://<TRACE_BRIDGE_GATEWAY>:8789/health
```

## 最快联合拓扑

正式展示浏览器运行在 Windows；Mac 只负责临时托管老师的软件开发服务器。

```text
Mac 软件 dev server
        |
        | HTTP
        v
Windows 三屏浏览器 -> ws://127.0.0.1:8797/trace -> Windows 网关 -> 三个 Pebble
```

在这种拓扑中，`traceGateway=ws://127.0.0.1:8797/trace` 是正确的，因为软件 JavaScript 实际运行在 Windows 浏览器中，即使 HTML 是从 Mac 加载的。

## 软件侧 Codex 现在执行

1. 保证所有已描述改动已经保存。
2. 报告 Git 分支、提交号以及是否仍有未提交改动。
3. 用项目支持的参数把开发服务器绑定到 `0.0.0.0`，而不是只监听 Mac 的 `127.0.0.1`。
4. 查询 Mac 当前局域网 IPv4 地址。
5. 从 Windows 浏览器验证 `http://<MAC_IP>:3000/` 可打开。
6. 若普通 Wi-Fi 存在客户端隔离，让 Mac 连接 Windows 热点 `TRACE-Bridge`，再提供其 `192.168.137.x` 地址。
7. 若两种网络都无法从 Windows访问，立即把完整项目源码压缩并传到 Windows，不再继续排查场馆网络。

不要让最终三屏在 Mac 浏览器里使用 `127.0.0.1:8797`，那会指向 Mac 自己。只有最终浏览器运行在 Mac 时，网关才应改为：

```text
ws://<WINDOWS_LAN_IP>:8797/trace
```

或者 Mac 连接 `TRACE-Bridge` 时使用：

```text
ws://<TRACE_BRIDGE_GATEWAY>:8797/trace
```

## 对方 Codex 下一条回复格式

```text
TRACE_NETWORK_READY_REPLY

git_branch:
git_commit:
uncommitted_changes:
dev_server_bind:
mac_ipv4:
windows_reachable_app_url:
windows_http_test: PASS | FAIL
iframe_test: PASS | FAIL | NOT_RUN
fallback_source_archive:
exact_blocker:
```

一旦 `windows_reachable_app_url` 可用，硬件侧会把它填入：

```text
http://127.0.0.1:8789/software-stage.html
```

然后执行：三槽位输入隔离、刷新后用户隔离、Replay 精确路由、校准路由、断线重连和 iframe 兼容性六项验收。
