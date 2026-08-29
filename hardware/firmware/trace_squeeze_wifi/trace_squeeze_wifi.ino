#include <Arduino.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>
#include "mbedtls/base64.h"
#include "mbedtls/sha1.h"

// Copy trace_secrets.h.example to trace_secrets.h for a private deployment.
// The private file is ignored by Git. Build flags may override these macros.
#if __has_include("trace_secrets.h")
  #include "trace_secrets.h"
#endif

#ifndef TRACE_AP_PASSWORD
  #error "Define TRACE_AP_PASSWORD in private trace_secrets.h (minimum 8 characters)."
#endif
#ifndef TRACE_STA_SSID
  #define TRACE_STA_SSID ""
#endif
#ifndef TRACE_STA_PASSWORD
  #define TRACE_STA_PASSWORD ""
#endif

static_assert(sizeof(TRACE_AP_PASSWORD) >= 9, "TRACE_AP_PASSWORD must contain at least 8 characters.");

// One firmware supports the current ESP32-S3 and the incoming ESP32-C3 SuperMini.
// Pin values can still be overridden with TRACE_* build defines.
#if CONFIG_IDF_TARGET_ESP32C3
  #ifndef TRACE_PRESSURE_PIN
    #define TRACE_PRESSURE_PIN 0
  #endif
  #ifndef TRACE_LIGHT_PIN
    #define TRACE_LIGHT_PIN 1
  #endif
  #ifndef TRACE_HAPTIC_PIN
    #define TRACE_HAPTIC_PIN 5
  #endif
  #ifndef TRACE_LED_PIN
    #define TRACE_LED_PIN 8
  #endif
#else
  #ifndef TRACE_PRESSURE_PIN
    #define TRACE_PRESSURE_PIN 1
  #endif
  #ifndef TRACE_LIGHT_PIN
    #define TRACE_LIGHT_PIN 2
  #endif
  #ifndef TRACE_HAPTIC_PIN
    #define TRACE_HAPTIC_PIN 8
  #endif
  #ifndef TRACE_LED_PIN
    #define TRACE_LED_PIN 48
  #endif
#endif

#ifndef TRACE_ENABLE_IMU
  #define TRACE_ENABLE_IMU 0
#endif

static const int PRESSURE_PIN = TRACE_PRESSURE_PIN;
static const int LIGHT_PIN = TRACE_LIGHT_PIN;
static const int I2C_SDA_PIN = 6;
static const int I2C_SCL_PIN = 7;
static const int HAPTIC_PIN = TRACE_HAPTIC_PIN;
static const int LED_PIN = TRACE_LED_PIN;
static const bool ENABLE_IMU = TRACE_ENABLE_IMU != 0;

static const int SAMPLE_MS = 10;
static const int BASELINE_SAMPLES = 120;
static const int TRIGGER_DELTA = 450;
static const int RELEASE_DELTA = 180;
static const int MIN_DURATION_MS = 120;
static const int MAX_EVENT_MS = 3500;
static const int CONTEXT_SAMPLE_MS = 50;
static const unsigned long STA_RETRY_MS = 8000;

static const char* AP_PASSWORD = TRACE_AP_PASSWORD;
static const char* DEFAULT_STA_SSID = TRACE_STA_SSID;
static const char* DEFAULT_STA_PASSWORD = TRACE_STA_PASSWORD;
static const uint16_t WEB_PORT = 80;
static const uint16_t WS_PORT = 8797;
static const int MAX_WS_CLIENTS = 3;
static const size_t MAX_WS_PAYLOAD = 1024;

WebServer webServer(WEB_PORT);
WiFiServer wsServer(WS_PORT);
WiFiClient wsClients[MAX_WS_CLIENTS];
Preferences preferences;

int baseline = 0;
bool squeezing = false;
unsigned long squeezeStartMs = 0;
int peakRaw = 0;
int lastRaw = 0;
unsigned long lastSampleMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastContextSampleMs = 0;
uint8_t imuAddress = 0;
uint8_t imuWhoAmI = 0;
bool imuAvailable = false;
int lightRaw = 0;
float lightLevel = 0.0f;
float motionLevel = 0.0f;

String savedSsid;
String savedPassword;
String deviceId;
String deviceLabel;
String apSsid;
unsigned long staConnectStartedMs = 0;
unsigned long lastStaRetryMs = 0;

static const char SETUP_PAGE[] PROGMEM = R"HTML(
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TRACE Pebble</title>
  <style>
    :root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#342f2b;background:#f6f2ee}
    body{margin:0;padding:24px;max-width:720px;margin:auto}
    h1{font-size:28px;margin:8px 0 4px} h2{font-size:18px;margin:26px 0 10px}
    .muted{color:#756c65}.status{padding:14px 0;border-top:1px solid #d8d0c9;border-bottom:1px solid #d8d0c9;line-height:1.7}
    .ok{color:#197348;font-weight:700}.bad{color:#a13c2d;font-weight:700}
    .controls{display:flex;gap:10px;flex-wrap:wrap}.field{display:grid;gap:6px;margin:12px 0}
    input,button{font:inherit;padding:12px;border:1px solid #bcb2aa;border-radius:6px;background:#fff}
    button{cursor:pointer;background:#403934;color:#fff;border-color:#403934}.secondary{background:#fff;color:#403934}
    pre{min-height:150px;max-height:280px;overflow:auto;white-space:pre-wrap;background:#211f1d;color:#e9e0d7;padding:14px;border-radius:6px}
  </style>
</head>
<body>
  <h1>TRACE Pebble</h1>
  <p class="muted">ESP32 无线硬件接口</p>
  <div id="status" class="status">正在读取状态...</div>

  <h2>硬件测试</h2>
  <div class="controls">
    <button id="replay">振动回放</button>
    <button id="calibrate" class="secondary">重新校准压力</button>
  </div>

  <h2>加入同一局域网</h2>
  <p class="muted">凭据写入当前 ESP32 的本地存储，且不会回显到状态或日志；正式部署还应启用 Flash Encryption。</p>
  <form method="post" action="/wifi">
    <label class="field">Wi-Fi 名称（SSID）<input name="ssid" required maxlength="32" autocomplete="off"></label>
    <label class="field">Wi-Fi 密码<input name="password" type="password" maxlength="64" autocomplete="new-password"></label>
    <button type="submit">保存并连接</button>
  </form>
  <form method="post" action="/forget" style="margin-top:10px"><button class="secondary" type="submit">忘记局域网</button></form>

  <h2>实时数据</h2>
  <pre id="log">等待 WebSocket...</pre>
  <script>
    const log = document.querySelector('#log');
    const statusBox = document.querySelector('#status');
    let socket;
    function line(value){log.textContent=(value+'\n'+log.textContent).slice(0,7000)}
    function send(type){if(socket&&socket.readyState===1)socket.send(JSON.stringify({type}))}
    function connect(){
      socket=new WebSocket(`ws://${location.hostname}:8797/trace`);
      socket.onopen=()=>line('WebSocket 已连接');
      socket.onmessage=e=>line(e.data);
      socket.onclose=()=>{line('WebSocket 已断开，正在重连');setTimeout(connect,1200)};
    }
    async function refresh(){
      try{
        const s=await (await fetch('/status',{cache:'no-store'})).json();
        const sta=s.sta_connected?`<span class="ok">已连接</span> ${s.sta_ssid} / ${s.sta_ip}`:`<span class="bad">未连接</span>`;
        statusBox.innerHTML=`设备：<b>${s.device_label}</b> / ${s.device_id}<br>热点：<b>${s.ap_ssid}</b><br>热点地址：${s.ap_ip}<br>局域网：${sta}<br>WebSocket：<b>ws://${location.hostname}:${s.ws_port}</b><br>客户端：${s.ws_clients}`;
      }catch(e){statusBox.textContent='状态读取失败：'+e.message}
    }
    document.querySelector('#replay').onclick=()=>send('replay');
    document.querySelector('#calibrate').onclick=()=>send('calibrate');
    connect(); refresh(); setInterval(refresh,2000);
  </script>
</body>
</html>
)HTML";

bool readImuBytes(uint8_t reg, uint8_t* data, size_t length) {
  if (!imuAddress) return false;
  Wire.beginTransmission(imuAddress);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  size_t received = Wire.requestFrom((int)imuAddress, (int)length, true);
  if (received != length) return false;
  for (size_t i = 0; i < length; i++) data[i] = Wire.read();
  return true;
}

bool writeImuByte(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(imuAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission(true) == 0;
}

bool initializeImu() {
  const uint8_t candidates[] = {0x68, 0x69};
  for (uint8_t address : candidates) {
    imuAddress = address;
    uint8_t whoAmI = 0;
    if (readImuBytes(0x75, &whoAmI, 1) && whoAmI != 0x00 && whoAmI != 0xFF) {
      imuWhoAmI = whoAmI;
      return writeImuByte(0x6B, 0x00);
    }
  }
  imuAddress = 0;
  imuWhoAmI = 0;
  return false;
}

void updateContextSensors() {
  unsigned long now = millis();
  if (now - lastContextSampleMs < CONTEXT_SAMPLE_MS) return;
  lastContextSampleMs = now;

  lightRaw = analogRead(LIGHT_PIN);
  lightLevel = constrain(lightRaw / 4095.0f, 0.0f, 1.0f);

  uint8_t bytes[14];
  if (!ENABLE_IMU || !imuAvailable || !readImuBytes(0x3B, bytes, sizeof(bytes))) {
    motionLevel = 0.0f;
    return;
  }
  int16_t ax = (int16_t)((bytes[0] << 8) | bytes[1]);
  int16_t ay = (int16_t)((bytes[2] << 8) | bytes[3]);
  int16_t az = (int16_t)((bytes[4] << 8) | bytes[5]);
  int16_t gx = (int16_t)((bytes[8] << 8) | bytes[9]);
  int16_t gy = (int16_t)((bytes[10] << 8) | bytes[11]);
  int16_t gz = (int16_t)((bytes[12] << 8) | bytes[13]);
  float acceleration = sqrtf((float)ax * ax + (float)ay * ay + (float)az * az) / 16384.0f;
  float rotationDps = sqrtf((float)gx * gx + (float)gy * gy + (float)gz * gz) / 131.0f;
  motionLevel = constrain(fabsf(acceleration - 1.0f) * 1.6f + rotationDps / 250.0f, 0.0f, 1.0f);
}

void pulseOutput(int strength, int durationMs) {
  strength = constrain(strength, 0, 255);
  durationMs = constrain(durationMs, 20, 1200);
  analogWrite(HAPTIC_PIN, strength);
  if (LED_PIN >= 0) rgbLedWrite(LED_PIN, strength, strength / 3, 0);
  delay(durationMs);
  analogWrite(HAPTIC_PIN, 0);
  if (LED_PIN >= 0) rgbLedWrite(LED_PIN, 0, 0, 0);
}

void configureDeviceIdentity() {
  uint32_t suffix = (uint32_t)(ESP.getEfuseMac() & 0xFFFFFF);
  char serial[7];
  snprintf(serial, sizeof(serial), "%06lX", (unsigned long)suffix);
  deviceId = "trace-" + String(serial);
  deviceId.toLowerCase();
  deviceLabel = "Pebble-" + String(serial);
  apSsid = "TRACE-Pebble-" + String(serial);
}

String withDeviceIdentity(const String& message) {
  int closingBrace = message.lastIndexOf('}');
  if (closingBrace < 0) return message;
  String enriched = message.substring(0, closingBrace);
  enriched += ",\"device_id\":\"" + deviceId + "\",\"device_label\":\"" + deviceLabel + "\"";
  enriched += message.substring(closingBrace);
  return enriched;
}

void wsSendFrame(WiFiClient& client, uint8_t opcode, const uint8_t* data, size_t length) {
  if (!client.connected()) return;
  uint8_t header[10];
  size_t headerLength = 0;
  header[headerLength++] = 0x80 | (opcode & 0x0F);
  if (length < 126) {
    header[headerLength++] = (uint8_t)length;
  } else if (length <= 0xFFFF) {
    header[headerLength++] = 126;
    header[headerLength++] = (length >> 8) & 0xFF;
    header[headerLength++] = length & 0xFF;
  } else {
    return;
  }
  client.write(header, headerLength);
  if (length) client.write(data, length);
}

void wsSendText(WiFiClient& client, const String& message) {
  wsSendFrame(client, 0x1, (const uint8_t*)message.c_str(), message.length());
}

int websocketClientCount() {
  int count = 0;
  for (int i = 0; i < MAX_WS_CLIENTS; i++) {
    if (wsClients[i] && wsClients[i].connected()) count++;
  }
  return count;
}

void broadcastJson(const String& message) {
  String enriched = withDeviceIdentity(message);
  Serial.println(enriched);
  for (int i = 0; i < MAX_WS_CLIENTS; i++) {
    if (wsClients[i] && wsClients[i].connected()) {
      wsSendText(wsClients[i], enriched);
    }
  }
}

String websocketAcceptKey(const String& clientKey) {
  String source = clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  unsigned char digest[20];
  unsigned char encoded[40];
  size_t encodedLength = 0;
  if (mbedtls_sha1((const unsigned char*)source.c_str(), source.length(), digest) != 0) return "";
  if (mbedtls_base64_encode(encoded, sizeof(encoded) - 1, &encodedLength, digest, sizeof(digest)) != 0) return "";
  encoded[encodedLength] = '\0';
  return String((char*)encoded);
}

String headerValue(const String& headers, const String& name) {
  String needle = name + ":";
  int start = headers.indexOf(needle);
  if (start < 0) return "";
  start += needle.length();
  int end = headers.indexOf("\r\n", start);
  if (end < 0) return "";
  String value = headers.substring(start, end);
  value.trim();
  return value;
}

void acceptWebsocketClient() {
  WiFiClient incoming = wsServer.accept();
  if (!incoming) return;

  int slot = -1;
  for (int i = 0; i < MAX_WS_CLIENTS; i++) {
    if (!wsClients[i] || !wsClients[i].connected()) {
      if (wsClients[i]) wsClients[i].stop();
      slot = i;
      break;
    }
  }
  if (slot < 0) {
    incoming.stop();
    return;
  }

  incoming.setTimeout(350);
  String headers;
  unsigned long started = millis();
  while (incoming.connected() && millis() - started < 500 && headers.indexOf("\r\n\r\n") < 0) {
    while (incoming.available()) {
      headers += (char)incoming.read();
      if (headers.length() > 2048) break;
    }
    delay(1);
  }
  String key = headerValue(headers, "Sec-WebSocket-Key");
  String acceptKey = websocketAcceptKey(key);
  if (key.isEmpty() || acceptKey.isEmpty()) {
    incoming.stop();
    return;
  }

  incoming.print("HTTP/1.1 101 Switching Protocols\r\n");
  incoming.print("Upgrade: websocket\r\n");
  incoming.print("Connection: Upgrade\r\n");
  incoming.print("Sec-WebSocket-Accept: ");
  incoming.print(acceptKey);
  incoming.print("\r\n\r\n");
  incoming.setTimeout(10);
  incoming.setNoDelay(true);
  wsClients[slot] = incoming;
  wsSendText(wsClients[slot], withDeviceIdentity("{\"type\":\"trace_status\",\"status\":\"websocket_connected\",\"firmware\":\"trace_squeeze_wifi_multi\"}"));
}

void calibrateBaseline();

void handleCommand(const String& message, const char* source) {
  String command = message;
  command.toLowerCase();
  if (command.indexOf("replay") >= 0) {
    pulseOutput(170, 180);
    delay(90);
    pulseOutput(110, 260);
    broadcastJson(String("{\"type\":\"trace_ack\",\"action\":\"replay\",\"status\":\"ok\",\"source\":\"") + source + "\"}");
  } else if (command.indexOf("calibrate") >= 0) {
    calibrateBaseline();
    broadcastJson(String("{\"type\":\"trace_status\",\"status\":\"calibrated\",\"baseline\":") + baseline + ",\"source\":\"" + source + "\"}");
  }
}

void processWebsocketClient(WiFiClient& client) {
  if (!client || !client.connected() || client.available() < 2) return;
  uint8_t first = client.read();
  uint8_t second = client.read();
  uint8_t opcode = first & 0x0F;
  bool masked = (second & 0x80) != 0;
  uint64_t length = second & 0x7F;

  if (length == 126) {
    if (client.available() < 2) return;
    length = ((uint16_t)client.read() << 8) | client.read();
  } else if (length == 127) {
    client.stop();
    return;
  }
  if (length > MAX_WS_PAYLOAD) {
    client.stop();
    return;
  }

  uint8_t mask[4] = {0, 0, 0, 0};
  if (masked) {
    if (client.readBytes(mask, 4) != 4) return;
  }

  uint8_t payload[MAX_WS_PAYLOAD + 1];
  size_t received = length ? client.readBytes(payload, (size_t)length) : 0;
  if (received != length) return;
  for (size_t i = 0; i < received; i++) {
    if (masked) payload[i] ^= mask[i % 4];
  }
  payload[received] = '\0';

  if (opcode == 0x8) {
    wsSendFrame(client, 0x8, payload, received);
    client.stop();
  } else if (opcode == 0x9) {
    wsSendFrame(client, 0xA, payload, received);
  } else if (opcode == 0x1) {
    handleCommand(String((char*)payload), "websocket");
  }
}

void serviceWebsockets() {
  acceptWebsocketClient();
  for (int i = 0; i < MAX_WS_CLIENTS; i++) {
    if (wsClients[i] && wsClients[i].connected()) {
      processWebsocketClient(wsClients[i]);
    } else if (wsClients[i]) {
      wsClients[i].stop();
    }
  }
}

String networkStatusJson() {
  bool connected = WiFi.status() == WL_CONNECTED;
  String json = "{\"device_id\":\"" + deviceId + "\",\"device_label\":\"" + deviceLabel;
  json += "\",\"ap_ssid\":\"" + apSsid + "\",\"ap_ip\":\"" + WiFi.softAPIP().toString();
  json += "\",\"sta_connected\":" + String(connected ? "true" : "false");
  json += ",\"sta_ssid\":\"" + String(connected ? WiFi.SSID() : savedSsid) + "\"";
  json += ",\"sta_ip\":\"" + String(connected ? WiFi.localIP().toString() : "-") + "\"";
  json += ",\"ws_port\":" + String(WS_PORT);
  json += ",\"ws_clients\":" + String(websocketClientCount()) + "}";
  return json;
}

void configureWebServer() {
  webServer.on("/", HTTP_GET, []() {
    webServer.sendHeader("Cache-Control", "no-store");
    webServer.send_P(200, "text/html; charset=utf-8", SETUP_PAGE);
  });
  webServer.on("/status", HTTP_GET, []() {
    webServer.sendHeader("Cache-Control", "no-store");
    webServer.send(200, "application/json", networkStatusJson());
  });
  webServer.on("/wifi", HTTP_POST, []() {
    String ssid = webServer.arg("ssid");
    String password = webServer.arg("password");
    ssid.trim();
    if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 64) {
      webServer.send(400, "text/plain; charset=utf-8", "Wi-Fi 信息无效");
      return;
    }
    preferences.putString("ssid", ssid);
    preferences.putString("pass", password);
    savedSsid = ssid;
    savedPassword = password;
    WiFi.disconnect(false, false);
    WiFi.begin(savedSsid.c_str(), savedPassword.c_str());
    staConnectStartedMs = millis();
    lastStaRetryMs = staConnectStartedMs;
    webServer.sendHeader("Location", "/", true);
    webServer.send(303, "text/plain", "Connecting");
    broadcastJson("{\"type\":\"trace_status\",\"status\":\"wifi_connecting\"}");
  });
  webServer.on("/forget", HTTP_POST, []() {
    preferences.remove("ssid");
    preferences.remove("pass");
    savedSsid = "";
    savedPassword = "";
    WiFi.disconnect(false, true);
    webServer.sendHeader("Location", "/", true);
    webServer.send(303, "text/plain", "Forgotten");
    broadcastJson("{\"type\":\"trace_status\",\"status\":\"wifi_forgotten\"}");
  });
  webServer.onNotFound([]() { webServer.send(404, "text/plain", "TRACE Pebble: not found"); });
  webServer.begin();
}

void configureWifi() {
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  WiFi.softAP(apSsid.c_str(), AP_PASSWORD, 6, false, 4);
  savedSsid = preferences.getString("ssid", "");
  savedPassword = preferences.getString("pass", "");
  if (savedSsid.isEmpty()) {
    savedSsid = DEFAULT_STA_SSID;
    savedPassword = DEFAULT_STA_PASSWORD;
  }
  if (!savedSsid.isEmpty()) {
    WiFi.begin(savedSsid.c_str(), savedPassword.c_str());
    staConnectStartedMs = millis();
    lastStaRetryMs = staConnectStartedMs;
  }
  configureWebServer();
  wsServer.begin();
  wsServer.setNoDelay(true);
}

String eventJson(const char* type, const char* trigger, float pressure, unsigned long durationMs, int raw, int base) {
  String json = String("{\"type\":\"") + type + "\",\"trigger\":\"" + trigger + "\",\"pressure\":" + String(pressure, 3);
  json += ",\"duration\":" + String(durationMs) + ",\"raw\":" + String(raw) + ",\"baseline\":" + String(base);
  json += ",\"motion\":" + String(motionLevel, 3) + ",\"light\":" + String(lightLevel, 3) + ",\"light_raw\":" + String(lightRaw) + "}";
  return json;
}

void calibrateBaseline() {
  long total = 0;
  for (int i = 0; i < BASELINE_SAMPLES; i++) {
    total += analogRead(PRESSURE_PIN);
    serviceWebsockets();
    webServer.handleClient();
    delay(5);
  }
  baseline = total / BASELINE_SAMPLES;
}

void handleSerialCommand() {
  if (!Serial.available()) return;
  String command = Serial.readStringUntil('\n');
  command.trim();
  handleCommand(command, "serial");
}

void setup() {
  pinMode(PRESSURE_PIN, INPUT);
  pinMode(LIGHT_PIN, INPUT);
  pinMode(HAPTIC_PIN, OUTPUT);
  analogWrite(HAPTIC_PIN, 0);
  if (LED_PIN >= 0) rgbLedWrite(LED_PIN, 0, 0, 0);

  Serial.begin(115200);
  delay(700);
  analogReadResolution(12);
  analogSetPinAttenuation(PRESSURE_PIN, ADC_11db);
  analogSetPinAttenuation(LIGHT_PIN, ADC_11db);
  configureDeviceIdentity();
  if (ENABLE_IMU) {
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    Wire.setClock(100000);
    imuAvailable = initializeImu();
  }
  preferences.begin("trace-wifi", false);
  configureWifi();
  calibrateBaseline();

  String ready = "{\"type\":\"trace_status\",\"status\":\"ready\",\"firmware\":\"trace_squeeze_wifi_multi\"";
  ready += ",\"ap_ssid\":\"" + apSsid + "\",\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\",\"ws_port\":" + String(WS_PORT);
  ready += ",\"baseline\":" + String(baseline) + ",\"imu\":" + String(imuAvailable ? "true" : "false") + "}";
  broadcastJson(ready);
  pulseOutput(90, 100);
}

void loop() {
  webServer.handleClient();
  serviceWebsockets();
  handleSerialCommand();
  updateContextSensors();

  unsigned long now = millis();
  if (!savedSsid.isEmpty() && WiFi.status() != WL_CONNECTED &&
      now - lastStaRetryMs >= STA_RETRY_MS) {
    lastStaRetryMs = now;
    WiFi.disconnect(false, false);
    WiFi.begin(savedSsid.c_str(), savedPassword.c_str());
    broadcastJson("{\"type\":\"trace_status\",\"status\":\"wifi_retrying\"}");
  }
  if (now - lastSampleMs < SAMPLE_MS) return;
  lastSampleMs = now;
  lastRaw = analogRead(PRESSURE_PIN);
  int delta = abs(lastRaw - baseline);

  if (!squeezing && delta >= TRIGGER_DELTA) {
    squeezing = true;
    squeezeStartMs = now;
    peakRaw = lastRaw;
    broadcastJson(String("{\"type\":\"trace_status\",\"status\":\"squeeze_started\",\"raw\":") + lastRaw + "}");
  }

  if (squeezing) {
    if (abs(lastRaw - baseline) > abs(peakRaw - baseline)) peakRaw = lastRaw;
    unsigned long durationMs = now - squeezeStartMs;
    bool released = delta <= RELEASE_DELTA && durationMs >= MIN_DURATION_MS;
    bool timeout = durationMs >= MAX_EVENT_MS;
    if (released || timeout) {
      int peakDelta = abs(peakRaw - baseline);
      float pressure = constrain(peakDelta / 2400.0f, 0.0f, 1.0f);
      broadcastJson(eventJson("trace_event", "squeeze", pressure, durationMs, peakRaw, baseline));
      pulseOutput((int)(90 + pressure * 140), 130);
      squeezing = false;
      squeezeStartMs = 0;
      peakRaw = lastRaw;
    }
  }

  if (now - lastHeartbeatMs > 1000) {
    lastHeartbeatMs = now;
    String heartbeat = String("{\"type\":\"trace_status\",\"status\":\"live\",\"raw\":") + lastRaw + ",\"baseline\":" + baseline;
    heartbeat += ",\"motion\":" + String(motionLevel, 3) + ",\"light\":" + String(lightLevel, 3) + ",\"light_raw\":" + lightRaw;
    heartbeat += ",\"imu\":" + String(imuAvailable ? "true" : "false") + ",\"ap_ip\":\"" + WiFi.softAPIP().toString() + "\"";
    heartbeat += ",\"sta_connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
    heartbeat += ",\"sta_ip\":\"" + String(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "-") + "\",\"ws_clients\":" + websocketClientCount() + "}";
    broadcastJson(heartbeat);
  }
}
