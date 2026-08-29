# TRACE_SOFTWARE_SYNC_REPLY

```text
project_root: software/
framework: React 19 + Vinext/Vite + TypeScript
package_manager: npm
run_command: npm run dev
app_url: http://127.0.0.1:3000/
current_run_status: PASS

moment_input_file: app/page.tsx
moment_input_function: receiveGatewayMoment
moment_model_file: lib/types.ts
persistence: localStorage
persistence_location_or_api: trace.memories.v1:<traceProfile>
dedupe_field: hardwareEventId / event_id

replay_handler_file: app/page.tsx
replay_handler_function: replayTrace
save_or_grow_handlers: submitClaim, growMemory, saveTraces
calibrate_handler: calibratePebble

multi_profile_support: YES
profile_identifier: traceProfile query parameter
iframe_allowed: UNKNOWN
blocking_headers: Local response-header probe was unavailable; no CSP or X-Frame-Options is configured in project source.

adapter_copied_to: lib/trace-software-adapter.ts
files_changed: app/page.tsx, lib/trace-software-adapter.ts, lib/types.ts, lib/storage.ts, lib/showcase.ts, .env.example, .gitignore, TRACE_SOFTWARE_HANDOFF.md, TRACE_SOFTWARE_SYNC_REPLY.md
integration_status: PARTIAL

tests_run: npm run lint; npm run build
slot_1_result: BLOCKED - Windows gateway not present on this Mac
slot_2_result: BLOCKED - Windows gateway not present on this Mac
slot_3_result: BLOCKED - Windows gateway not present on this Mac
cross_user_isolation_result: IMPLEMENTED - namespaced localStorage; gateway E2E pending
replay_routing_result: IMPLEMENTED - event_id routing and trace_ack handling; gateway E2E pending

remaining_blockers: Run the supplied Windows gateway and three virtual or real Pebbles for end-to-end verification.
exact_next_action: From the repository root, start .\hardware\tools\start-trace-demo.ps1 on the Windows machine, serve software/ there, load three traceDeviceSlot/traceProfile URLs, then execute the six acceptance checks in TEACHER_SOFTWARE_CONTRACT.md.
```
