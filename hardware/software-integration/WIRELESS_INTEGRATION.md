# TRACE Pebble wireless integration

## Connection modes

Preferred exhibition mode:

1. Keep the computer on its internet Wi-Fi.
2. Start the Windows 2.4 GHz hotspot with `hardware/tools/start-trace-demo.ps1` and private credentials supplied at runtime.
3. Connect all ESP32 boards to `TRACE-Bridge`.
4. On the exhibition computer, run the local gateway and connect the app to `ws://127.0.0.1:8797/trace`.

The current device endpoints are written to ignored runtime state at `hardware/.runtime/trace-device-config.js`. The demo server exposes that file only at runtime, while the tracked `trace-device-config.js` remains a safe simulator fallback. The start script rediscovers devices whenever DHCP changes their addresses; the software continues using the fixed gateway endpoint.

Router-free single-device fallback:

1. Connect the phone or computer to Wi-Fi `TRACE-Pebble`.
2. Open `http://192.168.4.1`.
3. Connect the app to `ws://192.168.4.1:8797/trace`.

The direct fallback address is only for testing one Pebble. The formal three-user computer display must use the local gateway and fixed `device_slot` mappings.

## Hardware to software

A completed squeeze emits:

```json
{
  "type": "trace_event",
  "trigger": "squeeze",
  "pressure": 0.73,
  "duration": 640,
  "raw": 2050,
  "baseline": 12,
  "motion": 0.0,
  "light": 0.42,
  "light_raw": 1720
}
```

`pressure` is normalized to `0..1`; `duration` is milliseconds. Create the memory interaction only for `type === "trace_event"` and `trigger === "squeeze"`. The 1 Hz `trace_status` messages are telemetry, not new memories.

## Software to hardware

Trigger the physical replay vibration:

```json
{"type":"replay"}
```

Recalibrate the pressure baseline while the Pebble is not being touched:

```json
{"type":"calibrate"}
```

Successful replay acknowledgement:

```json
{"type":"trace_ack","action":"replay","status":"ok","source":"websocket"}
```

## Browser integration

```js
import { TraceSoftwareAdapter } from "./trace-software-adapter.js";

const trace = TraceSoftwareAdapter.fromLocation();

trace.addEventListener("connection", ({ detail }) => {
  setPebbleConnected(detail.connected);
});

trace.addEventListener("moment", ({ detail }) => {
  createMemoryMoment(detail);
});

trace.connect();

// Existing replay button:
replayButton.addEventListener("click", () => trace.replay(currentMoment));
```

If the app page itself is served over HTTPS, browsers normally block plain `ws://` as mixed content. For the hackathon build, serve the local app over HTTP on the same trusted LAN, package it as a native app, or add a WSS bridge. Do not discover the Pebble by assuming the computer's IP.

## Final acceptance test

1. The app shows connected after opening the WebSocket.
2. Squeezing once creates exactly one memory event.
3. The app's replay control causes a physical vibration and receives `trace_ack`.
4. Disconnecting/reconnecting Wi-Fi recovers without refreshing the app.
5. Phone and computer can connect simultaneously; firmware supports up to three WebSocket clients.
