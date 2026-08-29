import { TracePebbleClient } from "./trace-pebble-client.js";

const search = new URLSearchParams(location.search);
const configuredDevices = Array.isArray(window.TRACE_PEBBLE_DEVICES)
  ? window.TRACE_PEBBLE_DEVICES
  : [];
const legacyEndpoint = search.get("endpoint") || window.TRACE_PEBBLE_ENDPOINT;
const defaultDevices = [
  legacyEndpoint && {
    id: "trace-hardware-01",
    label: "Pebble 01",
    endpoint: legacyEndpoint,
    kind: "hardware",
  },
  { id: "trace-sim-02", label: "Pebble 02", endpoint: "ws://127.0.0.1:8801/trace", kind: "simulator" },
  { id: "trace-sim-03", label: "Pebble 03", endpoint: "ws://127.0.0.1:8802/trace", kind: "simulator" },
].filter(Boolean);

const devices = (configuredDevices.length ? configuredDevices : defaultDevices).slice(0, 3);
const elements = {
  summary: document.querySelector("[data-summary]"),
  connectedCount: document.querySelector("[data-connected-count]"),
  totalEvents: document.querySelector("[data-total-events]"),
  deviceList: document.querySelector("[data-device-list]"),
  log: document.querySelector("[data-log]"),
};

const states = [];
let totalEvents = 0;

function appendLog(state, message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const row = document.createElement("div");
  const label = state?.labelElement?.textContent || state?.config?.label || "SYSTEM";
  row.textContent = `${time}  [${label}]  ${message}`;
  elements.log.prepend(row);
  while (elements.log.children.length > 40) elements.log.lastElementChild.remove();
}

function updateSummary() {
  const connected = states.filter((state) => state.connected).length;
  elements.connectedCount.textContent = `${connected} / ${states.length}`;
  elements.summary.textContent = connected === states.length ? "全部在线" : `${connected} 台在线`;
  elements.summary.dataset.connected = String(connected === states.length && states.length > 0);
}

function makeDevicePanel(config, index) {
  const panel = document.createElement("article");
  panel.className = "device";
  panel.innerHTML = `
    <div class="device-head">
      <div>
        <p class="eyebrow">DEVICE ${String(index + 1).padStart(2, "0")}</p>
        <h2 data-label></h2>
      </div>
      <span class="device-status" data-device-status>连接中</span>
    </div>
    <p class="device-id" data-device-id></p>
    <p class="endpoint" data-endpoint></p>
    <div class="device-metrics">
      <div><span>压力</span><strong data-raw>--</strong></div>
      <div><span>基线</span><strong data-baseline>--</strong></div>
      <div><span>环境光</span><strong data-light>--</strong></div>
      <div><span>事件</span><strong data-events>0</strong></div>
    </div>
    <p class="last-event"><span>最近捏压</span><strong data-last-event>--</strong></p>
    <div class="actions">
      <button class="primary" data-replay disabled title="只让这块 Pebble 振动">振动回放</button>
      <button data-calibrate disabled title="只重新校准这块 Pebble 的压力基线">校准压力</button>
      <button data-simulate hidden disabled title="生成一次只属于这台虚拟设备的捏压事件">模拟捏压</button>
      <button data-reconnect title="重新连接这块 Pebble">重连</button>
    </div>`;

  const state = {
    config,
    panel,
    connected: false,
    eventCount: 0,
    labelElement: panel.querySelector("[data-label]"),
    statusElement: panel.querySelector("[data-device-status]"),
    idElement: panel.querySelector("[data-device-id]"),
    rawElement: panel.querySelector("[data-raw]"),
    baselineElement: panel.querySelector("[data-baseline]"),
    lightElement: panel.querySelector("[data-light]"),
    eventsElement: panel.querySelector("[data-events]"),
    lastEventElement: panel.querySelector("[data-last-event]"),
    replayButton: panel.querySelector("[data-replay]"),
    calibrateButton: panel.querySelector("[data-calibrate]"),
    simulateButton: panel.querySelector("[data-simulate]"),
    reconnectButton: panel.querySelector("[data-reconnect]"),
  };
  state.labelElement.textContent = config.label;
  state.idElement.textContent = config.id;
  panel.querySelector("[data-endpoint]").textContent = config.endpoint;
  state.simulateButton.hidden = config.kind !== "simulator";
  elements.deviceList.append(panel);
  return state;
}

function setConnected(state, connected) {
  state.connected = connected;
  state.statusElement.textContent = connected ? "已连接" : "连接中";
  state.statusElement.dataset.connected = String(connected);
  state.replayButton.disabled = !connected;
  state.calibrateButton.disabled = !connected;
  state.simulateButton.disabled = !connected;
  updateSummary();
}

function updateTelemetry(state, message) {
  if (message.device_id) state.idElement.textContent = message.device_id;
  if (message.device_label) state.labelElement.textContent = message.device_label;
  if (message.raw !== undefined) state.rawElement.textContent = message.raw;
  if (message.baseline !== undefined) state.baselineElement.textContent = message.baseline;
  if (message.light !== undefined) state.lightElement.textContent = Number(message.light).toFixed(3);
}

for (const [index, config] of devices.entries()) {
  const state = makeDevicePanel(config, index);
  const client = new TracePebbleClient(config.endpoint, { id: config.id, label: config.label });
  state.client = client;
  states.push(state);
  setConnected(state, false);

  client.addEventListener("connection", ({ detail }) => {
    setConnected(state, detail.connected);
    appendLog(state, detail.connected ? "WebSocket connected" : "WebSocket disconnected");
  });

  client.addEventListener("message", ({ detail }) => {
    updateTelemetry(state, detail);
    if (detail.type === "trace_ack") appendLog(state, `ACK ${detail.action}: ${detail.status}`);
    if (detail.status === "calibrated") appendLog(state, `Calibrated baseline: ${detail.baseline}`);
  });

  client.addEventListener("trace", ({ detail }) => {
    state.eventCount += 1;
    totalEvents += 1;
    state.eventsElement.textContent = state.eventCount;
    elements.totalEvents.textContent = totalEvents;
    state.lastEventElement.textContent = `${Math.round(detail.pressure * 100)}% / ${detail.duration} ms`;
    appendLog(state, `Squeeze ${state.lastEventElement.textContent}`);
  });

  client.addEventListener("protocol-error", () => appendLog(state, "Invalid protocol message"));
  state.replayButton.addEventListener("click", () => {
    client.replay();
    appendLog(state, "Replay sent");
  });
  state.calibrateButton.addEventListener("click", () => {
    client.calibrate();
    appendLog(state, "Calibrate sent");
  });
  state.simulateButton.addEventListener("click", () => {
    client.simulate();
    appendLog(state, "Simulated squeeze sent");
  });
  state.reconnectButton.addEventListener("click", () => {
    client.disconnect();
    setConnected(state, false);
    setTimeout(() => client.connect(), 100);
  });
  client.connect();
}

elements.totalEvents.textContent = totalEvents;
updateSummary();
