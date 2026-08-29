# TRACE Pebble software handoff

## Teacher software entry points

- Bridge Wi-Fi: `TRACE-Bridge` (Windows 2.4 GHz mobile hotspot)
- Unified software WebSocket: `ws://127.0.0.1:8797/trace`
- Gateway status: `http://127.0.0.1:8796/status`
- Three-user stage: `http://127.0.0.1:8789/software-stage.html`
- Hardware dashboard: `http://127.0.0.1:8789/`

Run `hardware/tools/start-trace-demo.ps1` from the repository to start the hotspot, discover up to three devices, fill missing slots with simulators, and start the gateway and test UI. Teacher software connects only to the unified WebSocket; it must not store individual ESP32 IP addresses.

## Verified protocol

The following checks passed on 2026-08-29:

1. HTTP status returned `sta_connected: true`, `sta_ssid: TRACE-Bridge`.
2. WebSocket opened and returned `websocket_connected`.
3. Sending `{"type":"replay"}` returned `{"type":"trace_ack","action":"replay","status":"ok","source":"websocket"}`.
4. Live telemetry arrived at 1 Hz with pressure, light, connection, and client fields.

The physical vibration confirmation is pending. Pressure currently reports approximately `raw: 0`, `baseline: 4`, so pressure wiring must be corrected before squeeze-event acceptance.

## Integrate into the application

Copy `trace-software-adapter.js` into the application source. Each displayed software instance receives its assigned slot and profile in the URL.

```js
import { TraceSoftwareAdapter } from "./trace-software-adapter.js";

const trace = TraceSoftwareAdapter.fromLocation();

trace.addEventListener("moment", ({ detail }) => {
  createMemoryMoment(detail);
});

trace.connect();
```

Bind replay to `trace.replay(currentMoment)`. The adapter filters by `traceDeviceSlot`, adds `profileId`, and deduplicates `event_id`. Namespace browser storage with `trace.storageKey("memories")` so three same-origin sessions do not share content.

## Files required from the application owner

Provide the complete project folder or Git repository, including:

- `package.json` and its lockfile
- source files and public assets
- build and run instructions
- `.env.example` with secret values removed
- the current Codex handoff or implementation notes

Do not send screenshots alone. Source files are required for direct integration.

Individual hardware addresses are assigned by DHCP and can change after a hotspot restart. The gateway handles that routing; the teacher software endpoint remains fixed.
