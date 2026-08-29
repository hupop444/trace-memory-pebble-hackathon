## Outcome

Describe the user-visible or engineering outcome.

## Scope

- [ ] Software experience
- [ ] Firmware / sensor mapping
- [ ] Gateway / protocol
- [ ] CAD / electronics
- [ ] Documentation only

## Verification

- [ ] `pwsh -File .\scripts\verify.ps1`
- [ ] Three-slot isolation remains intact
- [ ] Replay returns to the originating Pebble
- [ ] No secrets, local paths, dependencies, caches, or toolchains are committed

Evidence and exact test environment:

## Hardware impact and rollback

State required rewiring, reflashing, calibration, migration, or rollback steps. Write `None` when not applicable.
