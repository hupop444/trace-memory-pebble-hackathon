import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "bridge", "package.json"));
const { WebSocket, WebSocketServer } = require("ws");

const gatewayPort = Number(process.argv[2] || 8797);
const httpPort = Number(process.argv[3] || 8796);
const configPath = resolve(process.argv[4] || resolve(root, "software-integration", "trace-device-config.js"));
const softwareClients = new Set();
const eventRoutes = new Map();
const pendingCommands = new Map();
const pendingCommandTtlMs = 10000;
let devices = [];
let configModifiedAt = 0;
let lastActiveSlot = 1;
let eventSequence = 0;

function broadcast(payload) {
  const text = JSON.stringify(payload);
  for (const client of softwareClients) {
    if (client.readyState === WebSocket.OPEN) client.send(text);
  }
}

function deviceSummary(device) {
  return {
    device_id: device.runtimeId || device.id,
    device_label: device.runtimeLabel || device.label,
    device_slot: device.slot,
    kind: device.kind,
    endpoint: device.endpoint,
    connected: device.socket?.readyState === WebSocket.OPEN,
  };
}

function deviceListMessage() {
  return {
    type: "trace_devices",
    protocol: "trace.pebble.v1",
    devices: devices.map(deviceSummary),
  };
}

function commandKey(slot, action) {
  return `${slot}:${action}`;
}

function rememberPending(device, action, requestId) {
  const key = commandKey(device.slot, action);
  const now = Date.now();
  const queue = (pendingCommands.get(key) || []).filter((entry) => entry.expiresAt > now);
  queue.push({ requestId, expiresAt: now + pendingCommandTtlMs });
  pendingCommands.set(key, queue.slice(-12));
}

function consumePending(device, action) {
  const key = commandKey(device.slot, action);
  const now = Date.now();
  const queue = (pendingCommands.get(key) || []).filter((entry) => entry.expiresAt > now);
  const entry = queue.shift();
  if (queue.length) pendingCommands.set(key, queue);
  else pendingCommands.delete(key);
  return entry?.requestId;
}

function clearPending(device) {
  for (const action of ["replay", "calibrate"]) {
    pendingCommands.delete(commandKey(device.slot, action));
  }
}

function normalizeMessage(message, device) {
  device.runtimeId = message.device_id || device.runtimeId || device.id;
  device.runtimeLabel = message.device_label || device.runtimeLabel || device.label;
  const normalized = {
    ...message,
    protocol: "trace.pebble.v1",
    device_id: device.runtimeId,
    device_label: device.runtimeLabel,
    device_slot: device.slot,
    device_kind: device.kind,
    received_at: new Date().toISOString(),
  };

  if (message.duration !== undefined && normalized.duration_ms === undefined) {
    normalized.duration_ms = Number(message.duration);
  }

  if (message.type === "trace_event") {
    const eventId = message.event_id || `${device.runtimeId}-${Date.now()}-${++eventSequence}`;
    normalized.event_id = eventId;
    normalized.captured_at = message.captured_at || normalized.received_at;
    normalized.pressure = Math.max(0, Math.min(1, Number(message.pressure) || 0));
    normalized.duration = Number(message.duration) || 0;
    normalized.duration_ms = normalized.duration;
    eventRoutes.set(eventId, device.slot);
    while (eventRoutes.size > 200) eventRoutes.delete(eventRoutes.keys().next().value);
    lastActiveSlot = device.slot;
  }

  if (message.type === "trace_ack" && message.action) {
    normalized.request_id = message.request_id || consumePending(device, message.action) || null;
  }

  // Current Pebble firmware reports calibration as trace_status rather than
  // trace_ack. Correlate that status with the originating UI request so the
  // software can distinguish a confirmed calibration from ordinary telemetry.
  if (message.type === "trace_status" && message.status === "calibrated") {
    normalized.action = "calibrate";
    normalized.request_id = message.request_id || consumePending(device, "calibrate") || null;
  }

  return normalized;
}

function connectDevice(device, generation) {
  const socket = new WebSocket(device.endpoint);
  device.socket = socket;

  socket.on("open", () => {
    broadcast({
      type: "trace_device_connection",
      protocol: "trace.pebble.v1",
      status: "connected",
      ...deviceSummary(device),
    });
    broadcast(deviceListMessage());
  });

  socket.on("message", (payload) => {
    let message;
    try {
      message = JSON.parse(payload.toString());
    } catch {
      return;
    }
    broadcast(normalizeMessage(message, device));
  });

  socket.on("close", () => {
    if (device.generation !== generation) return;
    clearPending(device);
    broadcast({
      type: "trace_device_connection",
      protocol: "trace.pebble.v1",
      status: "disconnected",
      ...deviceSummary(device),
    });
    broadcast(deviceListMessage());
    setTimeout(() => {
      if (device.generation === generation) connectDevice(device, generation);
    }, 1200);
  });
  socket.on("error", () => socket.close());
}

function parseConfig(source) {
  const match = source.match(/window\.TRACE_PEBBLE_DEVICES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error("TRACE_PEBBLE_DEVICES is missing from device config");
  return JSON.parse(match[1]);
}

async function loadConfig() {
  const metadata = await stat(configPath);
  if (metadata.mtimeMs === configModifiedAt) return;
  const nextConfigs = parseConfig(await readFile(configPath, "utf8"));
  configModifiedAt = metadata.mtimeMs;

  for (const device of devices) {
    device.generation = -1;
    clearPending(device);
    device.socket?.close();
  }

  const generation = Date.now();
  devices = nextConfigs.slice(0, 3).map((config, index) => ({
    ...config,
    slot: index + 1,
    generation,
    runtimeId: config.id,
    runtimeLabel: config.label,
    socket: null,
  }));
  devices.forEach((device) => connectDevice(device, generation));
  broadcast(deviceListMessage());
}

function resolveTarget(command) {
  const eventSlot = command.event_id ? eventRoutes.get(command.event_id) : null;
  if (eventSlot) return devices.find((device) => device.slot === eventSlot);
  if (command.device_id) {
    return devices.find((device) => device.id === command.device_id || device.runtimeId === command.device_id);
  }
  const slot = Number(command.device_slot || lastActiveSlot || 1);
  return devices.find((device) => device.slot === slot);
}

function routeCommand(client, command) {
  const supported = new Set(["replay", "calibrate", "simulate"]);
  if (!supported.has(command.type)) {
    client.send(JSON.stringify({
      type: "trace_protocol_error",
      protocol: "trace.pebble.v1",
      status: "unsupported_command",
      command: command.type || null,
    }));
    return;
  }

  const target = resolveTarget(command);
  const requestId = command.request_id || `trace-request-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  if (!target || target.socket?.readyState !== WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: "trace_ack",
      protocol: "trace.pebble.v1",
      action: command.type,
      status: "device_unavailable",
      request_id: requestId,
      device_id: target?.runtimeId || command.device_id || null,
      device_slot: target?.slot || Number(command.device_slot) || null,
    }));
    return;
  }

  if (command.type !== "simulate") rememberPending(target, command.type, requestId);
  target.socket.send(JSON.stringify({ ...command, request_id: requestId }));
  client.send(JSON.stringify({
    type: "trace_command_routed",
    protocol: "trace.pebble.v1",
    action: command.type,
    status: "sent",
    request_id: requestId,
    device_id: target.runtimeId,
    device_label: target.runtimeLabel,
    device_slot: target.slot,
  }));
}

const wss = new WebSocketServer({ port: gatewayPort, host: "0.0.0.0" });
wss.on("connection", (socket) => {
  softwareClients.add(socket);
  socket.send(JSON.stringify({
    type: "bridge_status",
    protocol: "trace.pebble.v1",
    status: "connected",
    gateway: `ws://127.0.0.1:${gatewayPort}/trace`,
  }));
  socket.send(JSON.stringify(deviceListMessage()));
  socket.on("message", (payload) => {
    let command;
    try {
      command = JSON.parse(payload.toString());
    } catch {
      socket.send(JSON.stringify({ type: "trace_protocol_error", status: "invalid_json" }));
      return;
    }
    if (command.type === "get_devices") socket.send(JSON.stringify(deviceListMessage()));
    else routeCommand(socket, command);
  });
  socket.on("close", () => softwareClients.delete(socket));
});

const httpServer = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.url === "/health" || request.url === "/status") {
    response.writeHead(200);
    response.end(JSON.stringify({
      ok: true,
      protocol: "trace.pebble.v1",
      websocket: `ws://127.0.0.1:${gatewayPort}/trace`,
      software_clients: softwareClients.size,
      devices: devices.map(deviceSummary),
    }));
    return;
  }
  response.writeHead(404);
  response.end(JSON.stringify({ error: "not_found" }));
});

wss.on("listening", () => process.stdout.write(`TRACE software gateway: ws://127.0.0.1:${gatewayPort}/trace\n`));
httpServer.listen(httpPort, "0.0.0.0", () => process.stdout.write(`TRACE gateway status: http://127.0.0.1:${httpPort}/status\n`));

await loadConfig();
setInterval(() => loadConfig().catch((error) => process.stderr.write(`${error.message}\n`)), 1000);
