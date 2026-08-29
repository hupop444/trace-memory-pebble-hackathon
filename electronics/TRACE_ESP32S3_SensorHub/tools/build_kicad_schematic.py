#!/usr/bin/env python3
"""Build the editable KiCad schematic from official KiCad/Espressif symbols.

Required environment variables:
  KICAD_SCH_API_PATH     directory containing the kicad_sch_api package
  KICAD_SYMBOLS_V9_DIR  directory containing KiCad 9 monolithic symbol libraries
  ESPRESSIF_SYMBOL_LIB  Espressif.kicad_sym from the official PCM package
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


BASE = Path(__file__).resolve().parents[1]
API_PATH_VALUE = os.environ.get("KICAD_SCH_API_PATH")
KICAD_LIBS_VALUE = os.environ.get("KICAD_SYMBOLS_V9_DIR")
ESP_LIB_VALUE = os.environ.get("ESPRESSIF_SYMBOL_LIB")
API_PATH = Path(API_PATH_VALUE) if API_PATH_VALUE else None
KICAD_LIBS = Path(KICAD_LIBS_VALUE) if KICAD_LIBS_VALUE else None
ESP_LIB = Path(ESP_LIB_VALUE) if ESP_LIB_VALUE else None

if API_PATH:
    sys.path.insert(0, str(API_PATH))

import kicad_sch_api as ksa  # noqa: E402
from kicad_sch_api.library.cache import get_symbol_cache  # noqa: E402


def add_net_label(sch, ref: str, pin: str, net: str) -> None:
    sch.add_label(net, pin=(ref, pin), size=1.27)


def add_two_terminal(sch, lib_id, ref, value, position, net1, net2, rotation=0, footprint=""):
    sch.components.add(
        lib_id=lib_id,
        reference=ref,
        value=value,
        position=position,
        rotation=rotation,
        footprint=footprint or None,
        Tolerance="1%" if ref.startswith("R") else "10%",
    )
    add_net_label(sch, ref, "1", net1)
    add_net_label(sch, ref, "2", net2)


def main() -> None:
    missing_env = [
        name
        for name, value in (
            ("KICAD_SYMBOLS_V9_DIR", KICAD_LIBS),
            ("ESPRESSIF_SYMBOL_LIB", ESP_LIB),
        )
        if value is None
    ]
    if missing_env:
        raise RuntimeError("Set required environment variables: " + ", ".join(missing_env))

    cache = get_symbol_cache()
    required_libraries = [
        KICAD_LIBS / "Device.kicad_sym",
        KICAD_LIBS / "Connector_Generic.kicad_sym",
        KICAD_LIBS / "power.kicad_sym",
        ESP_LIB,
    ]
    missing = [str(p) for p in required_libraries if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing official symbol libraries:\n" + "\n".join(missing))
    for library in required_libraries:
        cache.add_library_path(library)

    sch = ksa.create_schematic("TRACE ESP32-S3 Sensor Hub")
    sch.set_paper_size("A3")
    sch.set_title_block(
        title="TRACE ESP32-S3 / LDR + FSR + PIEZO SENSOR FRONT-END",
        date="2026-08-30",
        rev="A",
        company="TRACE / Interaction Hardware",
        comments=[
            "ADC1 only: GPIO4 / GPIO5 / GPIO6",
            "3V3 analog domain; USB-C power via DevKitC-1",
            "Piezo input includes rectifier, envelope and rail clamp",
            "Portfolio release / engineering reference",
        ],
    )

    # Sensor connectors. Each sensor is remote and connected by a keyed JST-PH 2P harness.
    connector_fp = "Connector_JST:JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical"
    for ref, value, pos, nets in [
        ("J2", "LIGHT / LDR 2-WIRE", (45.72, 66.04), ("+3V3", "LDR_SENSE")),
        ("J3", "PRESSURE / FSR402 2-WIRE", (45.72, 121.92), ("+3V3", "FSR_SENSE")),
        ("J4", "VIBRATION / PIEZO 2-WIRE", (45.72, 177.80), ("PIEZO_RAW", "GND")),
    ]:
        sch.components.add(
            "Connector_Generic:Conn_01x02",
            ref,
            value,
            position=pos,
            rotation=180,
            footprint=connector_fp,
            Connector="JST-PH 2.0 mm",
            Harness="Keyed, color-coded",
        )
        add_net_label(sch, ref, "1", nets[0])
        add_net_label(sch, ref, "2", nets[1])

    # Light channel: LDR -> divider -> series isolation -> ADC filter.
    add_two_terminal(sch, "Device:R", "R1", "10k", (96.52, 76.20), "LDR_SENSE", "GND")
    add_two_terminal(sch, "Device:R", "R2", "1k", (124.46, 66.04), "LDR_SENSE", "LIGHT_ADC", rotation=90)
    add_two_terminal(sch, "Device:C", "C1", "100nF", (154.94, 76.20), "LIGHT_ADC", "GND")

    # Pressure channel: FSR402 -> divider -> series isolation -> ADC filter.
    add_two_terminal(sch, "Device:R", "R3", "22k", (96.52, 132.08), "FSR_SENSE", "GND")
    add_two_terminal(sch, "Device:R", "R4", "1k", (124.46, 121.92), "FSR_SENSE", "FSR_ADC", rotation=90)
    add_two_terminal(sch, "Device:C", "C2", "100nF", (154.94, 132.08), "FSR_ADC", "GND")

    # Piezo channel: discharge, current limiting, Schottky rectifier, envelope and clamp.
    add_two_terminal(sch, "Device:R", "R5", "1M", (81.28, 187.96), "PIEZO_RAW", "GND")
    add_two_terminal(sch, "Device:R", "R6", "47k", (111.76, 177.80), "PIEZO_RAW", "PIEZO_LIMITED", rotation=90)
    add_two_terminal(sch, "Device:D_Schottky", "D1", "BAT54", (142.24, 177.80), "VIB_ENV", "PIEZO_LIMITED")
    add_two_terminal(sch, "Device:R", "R7", "470k", (170.18, 187.96), "VIB_ENV", "GND")
    add_two_terminal(sch, "Device:C", "C3", "100nF", (193.04, 187.96), "VIB_ENV", "GND")
    add_two_terminal(sch, "Device:D_Schottky", "D2", "BAT54", (218.44, 165.10), "+3V3", "VIB_ENV")
    add_two_terminal(sch, "Device:R", "R8", "1k", (243.84, 177.80), "VIB_ENV", "VIB_ADC", rotation=90)
    add_two_terminal(sch, "Device:C", "C4", "100nF", (269.24, 187.96), "VIB_ADC", "GND")

    # Local 3V3 sensor rail decoupling.
    add_two_terminal(sch, "Device:C", "C5", "10uF", (218.44, 76.20), "+3V3", "GND")
    add_two_terminal(sch, "Device:C", "C6", "100nF", (243.84, 76.20), "+3V3", "GND")

    # Official Espressif development-board symbol.
    sch.components.add(
        "Espressif:ESP32-S3-DevKitC",
        "U1",
        "ESP32-S3-DevKitC-1",
        position=(340.36, 124.46),
        footprint="PCM_Espressif:ESP32-S3-DevKitC",
        Datasheet="https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/",
        BoardRevision="v1.0 / v1.1 pin-compatible used pins",
    )
    for pin, net in [("1", "+3V3"), ("2", "+3V3"), ("4", "LIGHT_ADC"), ("5", "FSR_ADC"), ("6", "VIB_ADC"), ("22", "GND"), ("23", "GND"), ("24", "GND")]:
        add_net_label(sch, "U1", pin, net)

    # Explicitly mark unused DevKit header pins to keep ERC intent unambiguous.
    u1 = sch.components.get("U1")
    used = {"1", "2", "4", "5", "6", "22", "23", "24"}
    seen_positions = set()
    for pin in u1.pins:
        if pin.number in used:
            continue
        p = sch.get_component_pin_position("U1", pin.number)
        if not p:
            continue
        key = (round(p.x, 3), round(p.y, 3))
        if key not in seen_positions:
            sch.no_connects.add((p.x, p.y))
            seen_positions.add(key)

    # Readable grouping and engineering notes inside the native schematic.
    sch.add_text("01 / AMBIENT LIGHT - resistance divider, output rises with light", (35.56, 48.26), size=1.778, bold=True)
    sch.add_text("02 / TOUCH PRESSURE - FSR 402 divider, R3 is calibration-selectable", (35.56, 104.14), size=1.778, bold=True)
    sch.add_text("03 / VIBRATION - raw piezo protection + half-wave peak envelope", (35.56, 160.02), size=1.778, bold=True)
    sch.add_text("ADC1 ROUTING: GPIO4 = LIGHT / GPIO5 = PRESSURE / GPIO6 = VIBRATION", (236.22, 48.26), size=1.778, bold=True)
    sch.add_text("D2 clamps VIB_ENV to 3V3; R6 limits transient current. Never connect raw piezo to GPIO.", (73.66, 215.90), size=1.27)
    sch.add_text("C1, C2 and C4 are the 100 nF ADC pin capacitors recommended by Espressif.", (73.66, 220.98), size=1.27)

    output = BASE / "TRACE_ESP32S3_SensorHub.kicad_sch"
    sch.save(output)

    issues = sch.validate()
    report = {
        "file": str(output),
        "components": len(sch.components),
        "labels": len(sch.labels),
        "no_connects": len(sch.no_connects),
        "validation_issue_count": len(issues),
        "issues": [str(issue) for issue in issues],
        "used_adc_pins": {
            "GPIO4": "ADC1_CH3 / LIGHT_ADC",
            "GPIO5": "ADC1_CH4 / FSR_ADC",
            "GPIO6": "ADC1_CH5 / VIB_ADC",
        },
    }
    (BASE / "TRACE_ESP32S3_SensorHub_validation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
