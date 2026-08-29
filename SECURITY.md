# Security policy

## Secrets

Do not commit API keys, personal access tokens, private Wi-Fi credentials, certificates, or private keys.

- Software secrets belong in `software/.env.local` or the server environment.
- Hardware network values belong in `hardware/firmware/trace_squeeze_wifi/trace_secrets.h`.
- Start from the committed `.example` files and keep the private copies local.

If a secret is committed accidentally, revoke or rotate it first, then remove it from Git history. Deleting only the latest file is not sufficient.

## Hardware safety

- Do not power a vibration motor directly from an ESP32 GPIO.
- Use a transistor or MOSFET driver and a flyback diode for an inductive motor.
- Power sensors from 3.3 V unless their datasheet explicitly requires otherwise.
- Disconnect power before changing wiring.

## Reporting

For the hackathon build, report security or privacy issues privately to the project owner before opening a public issue containing sensitive details.
