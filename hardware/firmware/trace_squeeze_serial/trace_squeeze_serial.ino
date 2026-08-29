#include <Arduino.h>
#include <Wire.h>

// TRACE P0 wiring:
// FSR module: G -> GND, V -> 3V3, S -> GPIO1.
// Haptic driver input: GPIO8 -> 1k resistor -> transistor/MOSFET gate/base.
// Simple LED output: GPIO48 on many ESP32-S3 dev boards, or wire an external LED to GPIO9.
static const int PRESSURE_PIN = 1;
static const int LIGHT_PIN = 2;
static const int I2C_SDA_PIN = 6;
static const int I2C_SCL_PIN = 7;
static const int HAPTIC_PIN = 8;
static const int LED_PIN = 48;

static const int SAMPLE_MS = 10;
static const int BASELINE_SAMPLES = 120;
static const int TRIGGER_DELTA = 450;
static const int RELEASE_DELTA = 180;
static const int MIN_DURATION_MS = 120;
static const int MAX_EVENT_MS = 3500;
static const int CONTEXT_SAMPLE_MS = 50;

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

bool readImuBytes(uint8_t reg, uint8_t* data, size_t length) {
  if (!imuAddress) {
    return false;
  }

  Wire.beginTransmission(imuAddress);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  size_t received = Wire.requestFrom((int)imuAddress, (int)length, true);
  if (received != length) {
    return false;
  }
  for (size_t i = 0; i < length; i++) {
    data[i] = Wire.read();
  }
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
  if (now - lastContextSampleMs < CONTEXT_SAMPLE_MS) {
    return;
  }
  lastContextSampleMs = now;

  lightRaw = analogRead(LIGHT_PIN);
  lightLevel = constrain(lightRaw / 4095.0f, 0.0f, 1.0f);

  uint8_t bytes[14];
  if (!imuAvailable || !readImuBytes(0x3B, bytes, sizeof(bytes))) {
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
  float accelerationDelta = fabsf(acceleration - 1.0f);
  float rotationDps = sqrtf((float)gx * gx + (float)gy * gy + (float)gz * gz) / 131.0f;
  motionLevel = constrain(accelerationDelta * 1.6f + rotationDps / 250.0f, 0.0f, 1.0f);
}

void pulseOutput(int strength, int durationMs) {
  strength = constrain(strength, 0, 255);
  durationMs = constrain(durationMs, 20, 1200);

  analogWrite(HAPTIC_PIN, strength);
  rgbLedWrite(LED_PIN, strength, strength / 3, 0);
  delay(durationMs);
  analogWrite(HAPTIC_PIN, 0);
  rgbLedWrite(LED_PIN, 0, 0, 0);
}

void sendJsonEvent(const char* type, const char* trigger, float pressure, unsigned long durationMs, int raw, int base) {
  Serial.print("{\"type\":\"");
  Serial.print(type);
  Serial.print("\",\"trigger\":\"");
  Serial.print(trigger);
  Serial.print("\",\"pressure\":");
  Serial.print(pressure, 3);
  Serial.print(",\"duration\":");
  Serial.print(durationMs);
  Serial.print(",\"raw\":");
  Serial.print(raw);
  Serial.print(",\"baseline\":");
  Serial.print(base);
  Serial.print(",\"motion\":");
  Serial.print(motionLevel, 3);
  Serial.print(",\"light\":");
  Serial.print(lightLevel, 3);
  Serial.print(",\"light_raw\":");
  Serial.print(lightRaw);
  Serial.println("}");
}

void calibrateBaseline() {
  long total = 0;
  for (int i = 0; i < BASELINE_SAMPLES; i++) {
    total += analogRead(PRESSURE_PIN);
    delay(5);
  }
  baseline = total / BASELINE_SAMPLES;
}

void handleSerialCommand() {
  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command.indexOf("replay") >= 0) {
    pulseOutput(170, 180);
    delay(90);
    pulseOutput(110, 260);
    Serial.println("{\"type\":\"trace_ack\",\"action\":\"replay\",\"status\":\"ok\"}");
  } else if (command == "calibrate") {
    calibrateBaseline();
    Serial.print("{\"type\":\"trace_status\",\"status\":\"calibrated\",\"baseline\":");
    Serial.print(baseline);
    Serial.println("}");
  }
}

void setup() {
  pinMode(PRESSURE_PIN, INPUT);
  pinMode(LIGHT_PIN, INPUT);
  pinMode(HAPTIC_PIN, OUTPUT);
  analogWrite(HAPTIC_PIN, 0);
  rgbLedWrite(LED_PIN, 0, 0, 0);

  Serial.begin(115200);
  delay(800);

  analogReadResolution(12);
  analogSetPinAttenuation(PRESSURE_PIN, ADC_11db);
  analogSetPinAttenuation(LIGHT_PIN, ADC_11db);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  imuAvailable = initializeImu();
  calibrateBaseline();

  Serial.print("{\"type\":\"trace_status\",\"status\":\"ready\",\"firmware\":\"trace_squeeze_serial\",\"pressure_pin\":");
  Serial.print(PRESSURE_PIN);
  Serial.print(",\"haptic_pin\":");
  Serial.print(HAPTIC_PIN);
  Serial.print(",\"led_pin\":");
  Serial.print(LED_PIN);
  Serial.print(",\"light_pin\":");
  Serial.print(LIGHT_PIN);
  Serial.print(",\"imu_sda_pin\":");
  Serial.print(I2C_SDA_PIN);
  Serial.print(",\"imu_scl_pin\":");
  Serial.print(I2C_SCL_PIN);
  Serial.print(",\"imu\":");
  Serial.print(imuAvailable ? "true" : "false");
  Serial.print(",\"imu_address\":");
  Serial.print(imuAddress);
  Serial.print(",\"imu_whoami\":");
  Serial.print(imuWhoAmI);
  Serial.print(",\"baseline\":");
  Serial.print(baseline);
  Serial.println("}");

  pulseOutput(90, 100);
}

void loop() {
  handleSerialCommand();
  updateContextSensors();

  unsigned long now = millis();
  if (now - lastSampleMs < SAMPLE_MS) {
    return;
  }
  lastSampleMs = now;

  lastRaw = analogRead(PRESSURE_PIN);
  int delta = abs(lastRaw - baseline);

  if (!squeezing && delta >= TRIGGER_DELTA) {
    squeezing = true;
    squeezeStartMs = now;
    peakRaw = lastRaw;
    Serial.print("{\"type\":\"trace_status\",\"status\":\"squeeze_started\",\"raw\":");
    Serial.print(lastRaw);
    Serial.println("}");
  }

  if (squeezing) {
    if (abs(lastRaw - baseline) > abs(peakRaw - baseline)) {
      peakRaw = lastRaw;
    }

    unsigned long durationMs = now - squeezeStartMs;
    bool released = delta <= RELEASE_DELTA && durationMs >= MIN_DURATION_MS;
    bool timeout = durationMs >= MAX_EVENT_MS;

    if (released || timeout) {
      int peakDelta = abs(peakRaw - baseline);
      float pressure = constrain(peakDelta / 2400.0f, 0.0f, 1.0f);

      sendJsonEvent("trace_event", "squeeze", pressure, durationMs, peakRaw, baseline);
      pulseOutput((int)(90 + pressure * 140), 130);

      squeezing = false;
      squeezeStartMs = 0;
      peakRaw = lastRaw;
    }
  }

  if (now - lastHeartbeatMs > 1000) {
    lastHeartbeatMs = now;
    Serial.print("{\"type\":\"trace_status\",\"status\":\"live\",\"raw\":");
    Serial.print(lastRaw);
    Serial.print(",\"baseline\":");
    Serial.print(baseline);
    Serial.print(",\"motion\":");
    Serial.print(motionLevel, 3);
    Serial.print(",\"light\":");
    Serial.print(lightLevel, 3);
    Serial.print(",\"light_raw\":");
    Serial.print(lightRaw);
    Serial.print(",\"imu\":");
    Serial.print(imuAvailable ? "true" : "false");
    Serial.print(",\"imu_address\":");
    Serial.print(imuAddress);
    Serial.print(",\"imu_whoami\":");
    Serial.print(imuWhoAmI);
    Serial.println("}");
  }
}
