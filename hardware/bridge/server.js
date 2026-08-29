import http from 'node:http';
import os from 'node:os';
import { SerialPort } from 'serialport';
import { WebSocketServer } from 'ws';

const serialPath = process.env.TRACE_SERIAL_PORT || process.argv[2] || 'COM3';
const baudRate = Number(process.env.TRACE_BAUD || 115200);
const wsPort = Number(process.env.TRACE_WS_PORT || process.argv[3] || 8787);
const httpPort = Number(process.env.TRACE_HTTP_PORT || process.argv[4] || 8788);
const mock = process.env.TRACE_MOCK === '1' || process.argv.includes('--mock');

const clients = new Set();
let serial = null;
let serialBuffer = '';
let reconnectTimer = null;

function localIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

function sendToClients(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(text);
    }
  }
  console.log(`[out] ${text}`);
}

function sendToHardware(payload) {
  const text = `${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n`;
  if (serial?.isOpen && serial.writable) {
    serial.write(text);
    console.log(`[serial<=] ${text.trim()}`);
  }
}

function handleSerialData(chunk) {
  serialBuffer += chunk.toString('utf8');
  let index;
  while ((index = serialBuffer.indexOf('\n')) >= 0) {
    const line = serialBuffer.slice(0, index).trim();
    serialBuffer = serialBuffer.slice(index + 1);
    if (!line) continue;

    console.log(`[serial=>] ${line}`);
    try {
      sendToClients(JSON.parse(line));
    } catch {
      sendToClients({ type: 'serial_line', line });
    }
  }
}

function scheduleSerialReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSerial();
  }, 1500);
}

function connectSerial() {
  if (mock || serial?.isOpen) return;

  serialBuffer = '';
  const nextSerial = new SerialPort({ path: serialPath, baudRate, autoOpen: false });
  serial = nextSerial;
  nextSerial.on('data', handleSerialData);
  nextSerial.on('error', (error) => console.error(`[serial] ${error.message}`));
  nextSerial.on('close', () => {
    console.warn(`[serial] ${serialPath} disconnected; retrying`);
    sendToClients({ type: 'bridge_status', status: 'serial_disconnected', serialPath, mock });
    scheduleSerialReconnect();
  });
  nextSerial.open((error) => {
    if (error) {
      console.error(`[serial] failed to open ${serialPath}: ${error.message}; retrying`);
      scheduleSerialReconnect();
      return;
    }
    console.log(`[serial] opened ${serialPath} @ ${baudRate}`);
    sendToClients({ type: 'bridge_status', status: 'serial_live', serialPath, mock });
  });
}

const page = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TRACE Bridge</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 24px; background: #f6f7f9; color: #14161a; }
    main { max-width: 840px; margin: 0 auto; display: grid; gap: 16px; }
    h1 { font-size: 24px; margin: 0; }
    .panel { background: white; border: 1px solid #dcdfe5; border-radius: 8px; padding: 16px; }
    code, pre { background: #eef1f5; border-radius: 6px; padding: 2px 5px; }
    pre { padding: 12px; overflow: auto; min-height: 220px; white-space: pre-wrap; }
    button { border: 0; border-radius: 6px; padding: 10px 14px; background: #1a73e8; color: white; font-weight: 650; cursor: pointer; }
    button.secondary { background: #5f6368; }
  </style>
</head>
<body>
  <main>
    <h1>TRACE Hardware Bridge</h1>
    <section class="panel">
      <div>WebSocket: <code id="ws-url"></code></div>
      <p>收到硬件 <code>trace_event</code> 后，软件创建 Moment。点击 Replay 会向硬件发回 <code>replay</code>。</p>
      <button id="replay">Replay</button>
      <button class="secondary" id="calibrate">Calibrate</button>
      <button class="secondary" id="mock">Mock Squeeze</button>
    </section>
    <section class="panel">
      <pre id="log"></pre>
    </section>
  </main>
  <script>
    const wsUrl = "ws://" + location.hostname + ":${wsPort}";
    document.getElementById("ws-url").textContent = wsUrl;
    const log = document.getElementById("log");
    const ws = new WebSocket(wsUrl);
    function add(line) {
      log.textContent = new Date().toLocaleTimeString() + "  " + line + "\\n" + log.textContent;
    }
    ws.addEventListener("open", () => add("connected"));
    ws.addEventListener("message", (event) => add(event.data));
    ws.addEventListener("close", () => add("closed"));
    document.getElementById("replay").onclick = () => ws.send(JSON.stringify({ type: "replay", intensity: 0.6, pattern: "soft" }));
    document.getElementById("calibrate").onclick = () => ws.send(JSON.stringify({ type: "calibrate" }));
    document.getElementById("mock").onclick = () => ws.send(JSON.stringify({ type: "mock_squeeze" }));
  </script>
</body>
</html>`;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page);
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      serialPath,
      baudRate,
      clients: clients.size,
      mock,
      serialOpen: mock || Boolean(serial?.isOpen),
    }));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

const wss = new WebSocketServer({ port: wsPort });
wss.on('connection', (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: 'bridge_status', status: 'connected', serialPath, mock }));

  socket.on('message', (message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      return;
    }

    if (payload.type === 'replay') {
      sendToHardware(payload);
      sendToClients({ type: 'trace_ack', action: 'replay', source: 'bridge' });
    }

    if (payload.type === 'calibrate') {
      sendToHardware('calibrate');
      sendToClients({ type: 'trace_ack', action: 'calibrate', source: 'bridge' });
    }

    if (payload.type === 'mock_squeeze') {
      sendToClients({ type: 'trace_event', trigger: 'squeeze', pressure: 0.72, duration: 640, source: 'mock' });
    }
  });

  socket.on('close', () => clients.delete(socket));
});

if (mock) {
  setInterval(() => {
    sendToClients({ type: 'trace_status', status: 'mock_live', raw: 0, baseline: 0 });
  }, 1000);
} else {
  connectSerial();
}

httpServer.listen(httpPort, '0.0.0.0', () => {
  console.log(`[http] http://127.0.0.1:${httpPort}`);
  for (const ip of localIps()) {
    console.log(`[http] http://${ip}:${httpPort}`);
    console.log(`[ws]   ws://${ip}:${wsPort}`);
  }
  console.log(`[ws]   ws://127.0.0.1:${wsPort}`);
});
