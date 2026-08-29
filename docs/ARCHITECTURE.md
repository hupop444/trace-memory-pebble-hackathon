# TRACE system architecture

## Interaction invariant

The physical squeeze is the only capture trigger. Light, motion and pressure duration describe the moment; they do not independently create a memory. A capture is identified by `event_id`, assigned to `device_slot`, and stored in one `traceProfile` space.

## Capture path

1. ESP32 samples pressure every 10 ms and environmental context every 50 ms.
2. Crossing the calibrated squeeze threshold starts an event.
3. Release finalizes pressure peak, duration, light and timestamp.
4. The Pebble emits one `trace_event` and gives a short local haptic acknowledgement.
5. The unified gateway normalizes identity, slot and timestamp fields.
6. Each software view accepts only its assigned slot and deduplicates `event_id`.
7. The user writes one sentence; Memory Gardener returns structured title, echo and visual seed.

## Replay path

1. A detail view sends `replay` with the original `event_id` and a new `request_id`.
2. The gateway resolves the event back to its originating device.
3. The Pebble performs a distinct two-pulse haptic pattern.
4. The UI changes state only after a matching acknowledgement; stale or unrelated ACKs are ignored.

## Failure handling

- Hardware and software reconnect automatically.
- The gateway publishes per-slot connection state.
- Missing physical slots receive isolated simulators for rehearsals.
- Agent failure falls back to local gentle copy while preserving the user's original sentence.
- A six-second command timeout leaves a clear retry state rather than claiming success.

## Trust boundaries

- Browser clients connect only to `ws://127.0.0.1:8797/trace`.
- Individual ESP32 IP addresses stay inside the local gateway configuration.
- API credentials remain server-side.
- Runtime hardware discovery rewrites only the generated device configuration.
