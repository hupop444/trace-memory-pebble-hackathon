# Contributing to TRACE

TRACE 同时包含体验软件、固件、网关、外壳与电子设计。任何修改都应维持 `trace.pebble.v1` 契约，并明确其对真实硬件、三用户隔离和现场演示的影响。

## 开发流程

1. 从 `main` 创建短生命周期分支。
2. 只提交源码和必要的验证资产；不要提交密钥、真实 Wi-Fi 凭据、依赖目录、工具链或构建缓存。
3. 修改协议前先更新 `hardware/software-integration/TEACHER_SOFTWARE_CONTRACT.md`。
4. 运行 `pwsh -File .\scripts\verify.ps1`。
5. Pull Request 中填写测试证据、硬件影响与回退方式。

## 交互质量门槛

- 压力输入必须去抖，且每次自然捏压只创建一个 Moment。
- 软件只从 `trace_event + squeeze` 创建内容，不能把遥测当作用户输入。
- 回放必须携带原始 `event_id`，确保触觉反馈返回原设备。
- 三个 `device_slot` 与 `traceProfile` 的数据、状态和本地存储必须隔离。
- 任何可见反馈都要说明触发条件、等待状态、完成状态、超时和恢复路径。

## 提交规范

使用清晰的 Conventional Commit 风格，例如：

- `feat: add slot-aware haptic replay`
- `fix: deduplicate squeeze events after reconnect`
- `docs: clarify field wiring and calibration`
- `chore: update verified dependencies`

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要创建公开 Issue。
