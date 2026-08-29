const query = new URLSearchParams(location.search);
const form = document.querySelector("[data-app-form]");
const input = document.querySelector("[data-app-url]");
const viewports = [...document.querySelectorAll("[data-session]")];
const gateway = query.get("gateway") || "ws://127.0.0.1:8797/trace";

function sessionUrl(baseUrl, slot) {
  const url = new URL(baseUrl);
  url.searchParams.set("traceDeviceSlot", String(slot));
  url.searchParams.set("traceProfile", `trace-user-${String(slot).padStart(2, "0")}`);
  url.searchParams.set("traceGateway", gateway);
  return url.href;
}

function loadSoftware(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    input.setCustomValidity("请输入完整的 http:// 或 https:// 地址");
    input.reportValidity();
    return;
  }
  input.setCustomValidity("");
  localStorage.setItem("trace-stage-app-url", parsed.href);
  history.replaceState(null, "", `?app=${encodeURIComponent(parsed.href)}&gateway=${encodeURIComponent(gateway)}`);
  for (const [index, viewport] of viewports.entries()) {
    const frame = viewport.querySelector("iframe");
    frame.src = sessionUrl(parsed.href, index + 1);
    frame.hidden = false;
    viewport.querySelector("[data-empty]").hidden = true;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadSoftware(input.value.trim());
});

const diagnosticUrl = `${location.origin}/software-contract-session.html`;
const initialUrl = query.get("app") || localStorage.getItem("trace-stage-app-url") || diagnosticUrl;
input.value = initialUrl;
loadSoftware(initialUrl);
