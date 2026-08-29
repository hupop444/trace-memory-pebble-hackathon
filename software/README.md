# TRACE · Memory Pebble 手机端原型

这是 TRACE 黑客松 P0 的手机端产品 Demo。演示时在电脑浏览器中打开，但界面、导航和交互始终按约 390px 宽的手机 App 设计。当前已经支持：

- 真实 Pebble 捏取后的 BLE 同步；
- 今天的未认领 TRACE；
- 一句话认领；
- Memory Gardener Agent 结构化输出；
- Agent 失败时的本地温柔兜底；
- 生长动效、记忆详情与治愈花园；
- 本周拾光、本月年轮、时间来信与“后来的话”；
- 浏览器本地保存；
- Web Bluetooth 连接入口与统一 BLE 协议骨架。

## 路演账号

当前默认启用固定路演账号。每次刷新都会恢复三条“今天待认领”的 TRACE、十二条本月记忆，以及一套跨越一个月前和去年今日的记忆花园。月度年轮、主题数量和“本月拾光图”均由这些记录实时计算，不是写死的展示数字。

路演时应明确说明这是“已经使用一段时间的演示账号”。它用于稳定呈现长期价值，不代表演讲者的真实生活数据。真实 Pebble 产生的 BLE 记录仍会保留；产品界面不会出现模拟按钮。

## 第一次运行

打开终端，进入本目录：

```bash
cd software
npm ci
npm run dev:lan
```

然后打开：

```text
http://localhost:3000
```

## 后端到底是什么

前端是你看得到和点击的页面；后端是藏在页面后面、替页面安全调用 AI 的部分。

本项目的后端只有两个入口：

- `GET /api/health`：检查后端和 Agent 配置；
- `POST /api/memories/grow`：把用户的一句话交给 Memory Gardener，返回标题、回声和视觉种子。

API Key 只存在服务器环境里，不能写进 `app/page.tsx`，也不能使用 `NEXT_PUBLIC_` 前缀。

## 配置 OpenAI API Key

不要把 Key 发在聊天里，也不要提交到 Git。复制被 Git 忽略的本地环境文件，并仅在其中填写服务端变量：

```powershell
Copy-Item .env.example .env.local
# 在本地编辑器中填写 .env.local 的 OPENAI_API_KEY；不要提交该文件。
npm run dev:lan
```

如果暂时没有 Key，原型仍能完整运行，只是记忆文案会标明“当前使用本地温柔兜底”。

## 页面到后端的流程

```text
用户写一句话
  → 前端 POST /api/memories/grow
  → Memory Gardener Agent
  → 固定 JSON 结果
  → 前端生成记忆生命

任何一步失败
  → 前端本地兜底
  → 主流程仍然完成
```

## 软件与硬件的边界

页面只认适配器，不直接依赖 ESP32-C3 或 S3。

- `BleCaptureAdapter`：产品路径，连接真实 Pebble；
- `TraceSoftwareAdapter`：现场路径，通过统一 WebSocket 网关映射三块 Pebble；
- Mock 事件生成器：只保留在开发和自动测试层，不出现在用户界面。

BLE 事件示例：

```json
{
  "protocolVersion": 1,
  "eventId": "device-001-42",
  "capturedAt": "2026-08-28T10:32:11+08:00",
  "durationMs": 740,
  "pressurePeak": 0.63,
  "batteryLevel": 86
}
```

服务和特征 UUID 集中放在 `lib/capture.ts` 的 `TRACE_BLE` 中。硬件负责人只需和这里对齐，不需要修改页面。

## 开发自查

```bash
npm run lint
npm run build
```

现场演示从真实 Pebble 捏取开始。若硬件临时故障，开发者可以在测试层注入预置数据恢复现场，但手机界面不会出现“模拟”入口，也不会改变产品交互。
