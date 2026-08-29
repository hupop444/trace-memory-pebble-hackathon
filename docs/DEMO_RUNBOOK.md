# Demo runbook

## Preflight

1. Charge the power bank and verify both USB data cables.
2. Confirm the S3 and C3 wiring against `HARDWARE_MAPPING.md`.
3. Keep all sensors released during boot calibration.
4. Confirm Node.js 22.13+ and run `scripts/setup.ps1` once.
5. Put private credentials only in ignored local files.

## Simulator rehearsal

```powershell
pwsh -File .\scripts\start-demo.ps1 -Mode Simulator
```

This creates three isolated devices, the unified gateway, the three-screen stage and the software app without requiring hardware.

## Physical demo

```powershell
pwsh -File .\scripts\start-demo.ps1 -Mode Hardware
```

脚本会以隐藏输入安全询问 Windows 热点口令，不把口令写入命令历史或子进程参数。

The gateway fills real devices first and simulator slots second. The software URL never changes.

## Acceptance sequence

1. Gateway status shows three connected slots.
2. Squeeze slot 1: only user 1 receives one new Moment and the physical Pebble gives a short pulse.
3. Squeeze slot 2: only user 2 receives one new Moment.
4. Claim the Moment with one sentence and wait for the living-memory result.
5. Open its detail and replay: the originating Pebble gives the two-pulse pattern.
6. Calibrate while the pressure sensor is untouched and confirm the matching ACK.
7. Cover/uncover the light sensor and confirm that captured Moments preserve different environmental context.

## Presentation fallback

- If one board drops, keep the same software URL; the gateway reconnects automatically.
- If a board cannot recover, restart in simulator mode and continue the full narrative honestly as a rehearsal fallback.
- Never claim a simulated slot is physical hardware.
