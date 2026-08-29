# Hardware mapping

## ESP32-S3 Pebble (slot 1)

| Function | GPIO | Wiring |
|---|---:|---|
| Pressure signal | 1 | Sensor `S` → GPIO1 |
| Light signal | 2 | Sensor signal → GPIO2 |
| Haptic control | 8 | GPIO8 → driver input |
| Power | 3V3 | Sensor `V` → 3V3 |
| Ground | GND | All grounds common |

## ESP32-C3 SuperMini Pebble (slot 2)

| Function | GPIO | Wiring |
|---|---:|---|
| Pressure signal | 0 | Sensor `S` → GPIO0 |
| Light signal | 1 | Sensor signal → GPIO1 |
| Haptic control | 5 | GPIO5 → driver input |
| Power | 3V3 | Sensor `V` → 3V3 |
| Ground | GND | All grounds common |

## Haptic driver

Use a transistor or logic-level MOSFET, a current-limiting gate/base resistor, common ground and a flyback diode across the vibration motor. The GPIO is a control signal only.

## Sensor semantics

- Pressure starts and ends the capture gesture.
- Duration and peak pressure become tactile context in software.
- Light is sampled at capture time and becomes environmental context.
- Valid capture uses a short acknowledgement pulse.
- Memory replay uses a distinguishable two-pulse pattern.
