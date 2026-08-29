import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "bridge", "package.json"));
const { WebSocketServer, WebSocket } = require("ws");

const ports = (process.argv.slice(2).length ? process.argv.slice(2) : ["8801", "8802"])
  .map(Number)
  .filter(Number.isFinite);

function startVirtualDevice(port, deviceNumber) {
  const deviceId = `trace-sim-${String(deviceNumber).padStart(2, "0")}`;
  const deviceLabel = `Pebble ${String(deviceNumber).padStart(2, "0")}`;
  const wss = new WebSocketServer({ port, host: "0.0.0.0", path: "/trace" });
  let baseline = 1810 + deviceNumber * 37;
  let raw = baseline;
  let light = 0.22 + deviceNumber * 0.17;

  const withIdentity = (message) => ({
    ...message,
    device_id: deviceId,
    device_label: deviceLabel,
    simulated: true,
  });

  const broadcast = (message) => {
    const payload = JSON.stringify(withIdentity(message));
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  };

  const status = (state = "live") => withIdentity({
    type: "trace_status",
    status: state,
    raw,
    baseline,
    light: Number(light.toFixed(3)),
    light_raw: Math.round(light * 4095),
    motion: 0,
    imu: false,
    sta_connected: true,
    sta_ip: "127.0.0.1",
    ws_clients: wss.clients.size,
  });

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify(status("websocket_connected")));
    socket.on("message", (payload) => {
      let command;
      try {
        command = JSON.parse(payload.toString());
      } catch {
        return;
      }

      if (command.type === "replay") {
        broadcast({ type: "trace_ack", action: "replay", status: "ok" });
      } else if (command.type === "calibrate") {
        baseline = raw;
        broadcast({ type: "trace_status", status: "calibrated", baseline });
      } else if (command.type === "simulate") {
        raw = baseline + 1320;
        broadcast({ type: "trace_status", status: "squeeze_started", raw, baseline });
        setTimeout(() => {
          broadcast({
            type: "trace_event",
            trigger: "squeeze",
            pressure: 0.43 + deviceNumber * 0.12,
            duration: 330 + deviceNumber * 90,
            raw,
            baseline,
            light: Number(light.toFixed(3)),
            light_raw: Math.round(light * 4095),
            motion: 0,
          });
          raw = baseline;
        }, 180);
      }
    });
  });

  const timer = setInterval(() => {
    light += 0.018;
    if (light > 0.88) light = 0.18 + deviceNumber * 0.1;
    broadcast(status());
  }, 1000);

  wss.on("listening", () => {
    process.stdout.write(`${deviceId} ws://127.0.0.1:${port}/trace\n`);
  });

  return () => {
    clearInterval(timer);
    wss.close();
  };
}

const knownDeviceNumbers = new Map([[8800, 1], [8801, 2], [8802, 3], [18800, 1], [18801, 2], [18802, 3]]);
const stop = ports.map((port, index) => startVirtualDevice(port, knownDeviceNumbers.get(port) ?? index + 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop.forEach((close) => close());
    setTimeout(() => process.exit(0), 50);
  });
}
