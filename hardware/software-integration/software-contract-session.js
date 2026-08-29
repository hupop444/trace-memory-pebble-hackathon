import { TraceSoftwareAdapter } from "./trace-software-adapter.js";

const trace = TraceSoftwareAdapter.fromLocation();
const output = {
  connection: document.querySelector("[data-connection]"),
  device: document.querySelector("[data-device]"),
  count: document.querySelector("[data-count]"),
  pressure: document.querySelector("[data-pressure]"),
  duration: document.querySelector("[data-duration]"),
  light: document.querySelector("[data-light]"),
  event: document.querySelector("[data-event]"),
  ack: document.querySelector("[data-ack]"),
};
const countKey = trace.storageKey("trace-contract-moment-count");
let momentCount = Number(localStorage.getItem(countKey)) || 0;
let lastMoment = null;

document.querySelector("[data-slot]").textContent = String(trace.deviceSlot || "ALL").padStart(2, "0");
document.querySelector("[data-profile]").textContent = trace.profileId;
output.count.textContent = String(momentCount);

trace.addEventListener("connection", ({ detail }) => {
  output.connection.textContent = detail.connected ? "网关已连接" : "正在重连";
  output.connection.dataset.online = String(detail.connected);
});

trace.addEventListener("devices", ({ detail }) => {
  const device = detail.find((candidate) => Number(candidate.device_slot) === trace.deviceSlot);
  output.device.textContent = device
    ? `${device.device_label || device.device_id} / ${device.connected ? "在线" : "离线"}`
    : "等待设备";
});

trace.addEventListener("moment", ({ detail }) => {
  lastMoment = detail;
  momentCount += 1;
  localStorage.setItem(countKey, String(momentCount));
  output.count.textContent = String(momentCount);
  output.pressure.textContent = Number(detail.pressure).toFixed(2);
  output.duration.textContent = `${Math.round(detail.durationMs)} ms`;
  output.light.textContent = Number(detail.light).toFixed(2);
  output.event.textContent = detail.hardwareEventId || "legacy-event";
  window.__TRACE_DIAGNOSTIC__.lastMoment = detail;
  window.__TRACE_DIAGNOSTIC__.momentCount = momentCount;
});

trace.addEventListener("ack", ({ detail }) => {
  output.ack.textContent = `${detail.action || "command"}: ${detail.status || "ok"}`;
});

function runCommand(action) {
  try {
    output.ack.textContent = "命令发送中";
    action();
  } catch (error) {
    output.ack.textContent = error.message;
  }
}

document.querySelector("[data-simulate]").addEventListener("click", () => runCommand(() => trace.send("simulate")));
document.querySelector("[data-replay]").addEventListener("click", () => runCommand(() => trace.replay(lastMoment || {})));
document.querySelector("[data-calibrate]").addEventListener("click", () => runCommand(() => trace.calibrate({})));
document.querySelector("[data-clear]").addEventListener("click", () => {
  momentCount = 0;
  lastMoment = null;
  localStorage.removeItem(countKey);
  output.count.textContent = "0";
  output.pressure.textContent = "--";
  output.duration.textContent = "--";
  output.light.textContent = "--";
  output.event.textContent = "等待本设备输入";
  window.__TRACE_DIAGNOSTIC__.lastMoment = null;
  window.__TRACE_DIAGNOSTIC__.momentCount = 0;
});

window.__TRACE_DIAGNOSTIC__ = {
  deviceSlot: trace.deviceSlot,
  profileId: trace.profileId,
  momentCount,
  lastMoment,
};

trace.connect();
