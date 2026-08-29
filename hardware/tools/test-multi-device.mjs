import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "bridge", "package.json"));
const WebSocket = require("ws");
const simulator = resolve(import.meta.dirname, "trace-virtual-devices.mjs");
const ports = [18801, 18802];
const child = spawn(process.execPath, [simulator, ...ports.map(String)], { stdio: ["ignore", "pipe", "pipe"] });

function openDevice(port) {
  return new Promise((resolveSocket, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/trace`);
    socket.once("open", () => resolveSocket(socket));
    socket.once("error", reject);
  });
}

function waitFor(socket, predicate, timeoutMs = 1800) {
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket message"));
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
  await new Promise((resolveReady, reject) => {
    let ready = 0;
    const timeout = setTimeout(() => reject(new Error("Simulator did not start")), 2500);
    child.stdout.on("data", (chunk) => {
      ready += chunk.toString().split("\n").filter((line) => line.includes("ws://")).length;
      if (ready >= ports.length) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
    child.once("error", reject);
  });

  const [first, second] = await Promise.all(ports.map(openDevice));
  const firstLive = waitFor(first, (message) => message.status === "live");
  const secondLive = waitFor(second, (message) => message.status === "live");
  const [firstStatus, secondStatus] = await Promise.all([firstLive, secondLive]);
  assert.notEqual(firstStatus.device_id, secondStatus.device_id, "device ids must be unique");

  let leakedReplay = false;
  const watchReplay = (payload) => {
    const message = JSON.parse(payload.toString());
    if (message.type === "trace_ack" && message.action === "replay") leakedReplay = true;
  };
  second.on("message", watchReplay);
  const firstAck = waitFor(first, (message) => message.type === "trace_ack" && message.action === "replay");
  first.send(JSON.stringify({ type: "replay" }));
  assert.equal((await firstAck).device_id, firstStatus.device_id);
  await delay(120);
  assert.equal(leakedReplay, false, "replay acknowledgement leaked to another device");
  second.off("message", watchReplay);

  let leakedEvent = false;
  const watchEvent = (payload) => {
    if (JSON.parse(payload.toString()).type === "trace_event") leakedEvent = true;
  };
  first.on("message", watchEvent);
  const secondEvent = waitFor(second, (message) => message.type === "trace_event");
  second.send(JSON.stringify({ type: "simulate" }));
  assert.equal((await secondEvent).device_id, secondStatus.device_id);
  await delay(120);
  assert.equal(leakedEvent, false, "sensor event leaked to another device");

  first.close();
  second.close();
  process.stdout.write(`PASS unique devices: ${firstStatus.device_id}, ${secondStatus.device_id}\n`);
  process.stdout.write("PASS replay and sensor events stay on their target device\n");
} finally {
  child.kill("SIGTERM");
}
