# TRACE Hardware Link

P0 target for the hackathon:

1. ESP32-S3 reads FSR pressure.
2. ESP32-S3 sends JSON lines over USB Serial.
3. The local bridge reads Serial and broadcasts WebSocket JSON for the software.
4. The software sends `replay` back over WebSocket; the bridge forwards it to ESP32 Serial.

## Three-device demo

Start the local dashboard and device discovery:

```powershell
pwsh -File .\tools\start-trace-demo.ps1
```

Open `http://127.0.0.1:8789/`. Real Pebbles discovered on `TRACE-Bridge` fill the first slots; any missing boards are represented by isolated virtual devices so the three-device software remains testable.

Open `http://127.0.0.1:8789/software-stage.html` for three permanently mapped software sessions. It starts with the protocol acceptance UI; paste the teacher software's full URL into the top field to replace all three panels with isolated real sessions.

The arrival wiring and acceptance sequence is in `SUPERMINI_ARRIVAL_CHECKLIST.md`.

Compile and flash one connected C3 SuperMini:

```powershell
Copy-Item .\firmware\trace_squeeze_wifi\trace_secrets.h.example `
  .\firmware\trace_squeeze_wifi\trace_secrets.h
# Edit the private copy before flashing; TRACE_AP_PASSWORD must be at least 8 characters.
pwsh -File .\tools\flash-trace-pebble.ps1 -Board C3 -Port COM5
```

## Wiring

FSR module:

- `G` -> ESP32-S3 `GND`
- `V` -> ESP32-S3 `3V3`
- `S` -> ESP32-S3 `GPIO1`

Haptic output:

- `GPIO8` -> `1k` resistor -> transistor or MOSFET gate/base
- Motor must not be powered directly from an ESP32 GPIO.
- Add a flyback diode across the motor if using a coin vibration motor.

Optional simple LED:

- Many ESP32-S3 boards expose built-in RGB/LED on `GPIO48`.
- If that does not light, wire an external LED module to `GPIO9` and change `LED_PIN`.

## WebSocket Contract

Start the real USB bridge:

```powershell
pwsh -File .\start-real-bridge.ps1
```

Current prototype endpoints:

- Test page: `http://127.0.0.1:8798`
- Designer software on this PC: `ws://127.0.0.1:8797/trace`
- ESP32 UART: select the detected COM port at `115200`

The bridge automatically retries when the ESP32 USB cable is disconnected and reconnected.
Use the `Calibrate` button while the FSR is untouched whenever its resting value changes.

Hardware to software:

```json
{
  "type": "trace_event",
  "trigger": "squeeze",
  "pressure": 0.78,
  "duration": 620
}
```

Software to hardware:

```json
{
  "type": "replay",
  "intensity": 0.6,
  "pattern": "soft"
}
```
