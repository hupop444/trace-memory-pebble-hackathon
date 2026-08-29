import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "bridge", "package.json"));
const WebSocket = require("ws");
const simulatorScript = resolve(import.meta.dirname, "trace-virtual-devices.mjs");
const gatewayScript = resolve(import.meta.dirname, "trace-software-gateway.mjs");
const simulatorPorts = [18900, 18901, 18902];
const gatewayPort = 18797;
const gatewayHttpPort = 18796;
const configPath = resolve(tmpdir(), `trace-contract-test-config-${process.pid}.js`);
const configs = simulatorPorts.map((port, index) => ({
  id: `trace-test-${index + 1}`,
  label: `Test Pebble ${index + 1}`,
  endpoint: `ws://127.0.0.1:${port}/trace`,
  kind: "simulator",
}));

await writeFile(configPath, `window.TRACE_PEBBLE_DEVICES = ${JSON.stringify(configs)};\n`, "utf8");
const simulator = spawn(process.execPath, [simulatorScript, ...simulatorPorts.map(String)], { stdio: ["ignore", "pipe", "pipe"] });
let gateway;

function waitForOutput(process, pattern, timeoutMs = 5000) {
  return new Promise((resolveOutput, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}`)), timeoutMs);
    process.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (!output.includes(pattern)) return;
      clearTimeout(timeout);
      resolveOutput(output);
    });
    process.once("error", reject);
  });
}

function openSocket(url) {
  return new Promise((resolveSocket, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolveSocket(socket));
    socket.once("error", reject);
  });
}

function waitForMessage(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for protocol message"));
    }, timeoutMs);
    function onMessage(payload) {
      const message = JSON.parse(payload.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolveMessage(message);
    }
    socket.on("message", onMessage);
  });
}

try {
  await waitForOutput(simulator, "ws://127.0.0.1:18902/trace");
  gateway = spawn(process.execPath, [gatewayScript, String(gatewayPort), String(gatewayHttpPort), configPath], { stdio: ["ignore", "pipe", "pipe"] });
  await waitForOutput(gateway, `ws://127.0.0.1:${gatewayPort}/trace`);

  const software = await openSocket(`ws://127.0.0.1:${gatewayPort}/trace`);
  const secondHardware = await openSocket(`ws://127.0.0.1:${simulatorPorts[1]}/trace`);

  const allConnected = waitForMessage(software, (message) =>
    message.type === "trace_devices" && message.devices.length === 3 && message.devices.every((device) => device.connected));
  software.send(JSON.stringify({ type: "get_devices" }));
  await allConnected;

  const eventPromise = waitForMessage(software, (message) => message.type === "trace_event");
  secondHardware.send(JSON.stringify({ type: "simulate" }));
  const event = await eventPromise;
  assert.equal(event.type, "trace_event");
  assert.equal(event.trigger, "squeeze");
  assert.equal(event.device_slot, 2);
  assert.equal(typeof event.pressure, "number");
  assert.equal(typeof event.duration, "number");
  assert.equal(typeof event.light, "number");
  assert.ok(event.event_id);
  assert.ok(event.device_id);

  const routePromise = waitForMessage(software, (message) => message.type === "trace_command_routed" && message.request_id === "test-replay");
  const ackPromise = waitForMessage(software, (message) => message.type === "trace_ack" && message.request_id === "test-replay");
  software.send(JSON.stringify({ type: "replay", event_id: event.event_id, request_id: "test-replay" }));
  const [route, ack] = await Promise.all([routePromise, ackPromise]);
  assert.equal(route.device_slot, 2);
  assert.equal(ack.device_slot, 2);
  assert.equal(ack.status, "ok");

  const fallbackAck = waitForMessage(software, (message) => message.type === "trace_ack" && message.request_id === "test-fallback");
  software.send(JSON.stringify({ type: "replay", request_id: "test-fallback" }));
  assert.equal((await fallbackAck).device_slot, 2);

  const calibrateAck = waitForMessage(software, (message) => message.type === "trace_status" && message.status === "calibrated" && message.device_slot === 3);
  software.send(JSON.stringify({ type: "calibrate", device_slot: 3, request_id: "test-calibrate" }));
  assert.equal((await calibrateAck).device_slot, 3);

  software.close();
  secondHardware.close();
  process.stdout.write("PASS legacy event fields preserved\n");
  process.stdout.write("PASS event_id routes replay to the originating Pebble\n");
  process.stdout.write("PASS untargeted legacy replay follows the latest active Pebble\n");
  process.stdout.write("PASS device_slot routes calibration independently\n");
} finally {
  gateway?.kill("SIGTERM");
  simulator.kill("SIGTERM");
  await unlink(configPath).catch(() => {});
}
