#!/usr/bin/env python3
"""Render the TRACE sensor schematic as A3 PDF and SVG from one scene graph."""

from __future__ import annotations

import html
import math
import os
from dataclasses import dataclass, field
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.units import mm


BASE = Path(__file__).resolve().parents[1]
PDF_PATH = BASE / "output" / "pdf" / "TRACE_ESP32S3_SensorHub_Schematic.pdf"
SVG_PATH = BASE / "exports" / "TRACE_ESP32S3_SensorHub_Schematic.svg"
W, H = 420.0, 297.0

NAVY = "#102334"
INK = "#1D2B36"
MUTED = "#60717E"
GRID = "#D9E0E5"
PALE = "#F4F7F8"
ORANGE = "#F07832"
ORANGE_PALE = "#FFF3EA"
GREEN = "#147A66"
GREEN_PALE = "#EAF6F2"
BLUE = "#2376A8"
BLUE_PALE = "#EAF3F8"
WHITE = "#FFFFFF"
RED = "#B33B32"


@dataclass
class Scene:
    items: list[dict] = field(default_factory=list)

    def line(self, x1, y1, x2, y2, stroke=INK, width=0.35, dash=None):
        self.items.append(dict(kind="line", x1=x1, y1=y1, x2=x2, y2=y2, stroke=stroke, width=width, dash=dash))

    def rect(self, x, y, w, h, stroke=INK, width=0.35, fill="none", radius=0.0, dash=None):
        self.items.append(dict(kind="rect", x=x, y=y, w=w, h=h, stroke=stroke, width=width, fill=fill, radius=radius, dash=dash))

    def circle(self, x, y, r, stroke=INK, width=0.35, fill="none"):
        self.items.append(dict(kind="circle", x=x, y=y, r=r, stroke=stroke, width=width, fill=fill))

    def polyline(self, pts, stroke=INK, width=0.35, fill="none", close=False, dash=None):
        self.items.append(dict(kind="polyline", pts=pts, stroke=stroke, width=width, fill=fill, close=close, dash=dash))

    def text(self, x, y, value, size=8.0, color=INK, weight="regular", anchor="start", rotate=0.0, family="ui"):
        self.items.append(dict(kind="text", x=x, y=y, value=value, size=size, color=color, weight=weight, anchor=anchor, rotate=rotate, family=family))


S = Scene()


def label(x, y, value, color=INK, fill=WHITE, anchor="start"):
    width = max(14, len(value) * 1.55 + 4)
    if anchor == "end":
        x0 = x - width
    elif anchor == "middle":
        x0 = x - width / 2
    else:
        x0 = x
    S.rect(x0, y - 3.0, width, 5.4, stroke="none", fill=fill, radius=1.4)
    S.text(x if anchor != "middle" else x, y + 0.7, value, size=6.5, color=color, weight="bold", anchor=anchor)


def junction(x, y, color=INK):
    S.circle(x, y, 0.9, stroke=color, fill=color, width=0.2)


def ground(x, y, color=INK):
    S.line(x, y, x, y + 2.5, color)
    S.line(x - 3.4, y + 2.5, x + 3.4, y + 2.5, color)
    S.line(x - 2.2, y + 4.0, x + 2.2, y + 4.0, color)
    S.line(x - 1.0, y + 5.4, x + 1.0, y + 5.4, color)


def power_3v3(x, y, color=GREEN):
    S.line(x, y, x, y - 4.0, color, 0.5)
    S.polyline([(x, y - 6.5), (x - 2.8, y - 3.2), (x + 2.8, y - 3.2)], stroke=color, fill=color, close=True)
    S.text(x + 3.8, y - 4.1, "+3V3", size=5.5, color=color, weight="bold")


def resistor_h(x1, x2, y, ref, value, color=INK):
    body_w = 14.0
    cx = (x1 + x2) / 2
    S.line(x1, y, cx - body_w / 2, y, color)
    S.rect(cx - body_w / 2, y - 2.8, body_w, 5.6, stroke=color, fill=WHITE, radius=0.6)
    S.line(cx + body_w / 2, y, x2, y, color)
    S.text(cx, y - 4.6, ref, size=6.2, weight="bold", anchor="middle")
    S.text(cx, y + 6.6, value, size=6.0, color=MUTED, anchor="middle")


def resistor_v(x, y1, y2, ref, value, color=INK):
    body_h = 13.0
    cy = (y1 + y2) / 2
    S.line(x, y1, x, cy - body_h / 2, color)
    S.rect(x - 2.8, cy - body_h / 2, 5.6, body_h, stroke=color, fill=WHITE, radius=0.6)
    S.line(x, cy + body_h / 2, x, y2, color)
    S.text(x + 4.4, cy - 0.4, ref, size=6.0, weight="bold")
    S.text(x + 4.4, cy + 3.6, value, size=5.8, color=MUTED)


def capacitor_v(x, y1, y2, ref, value, color=INK):
    cy = (y1 + y2) / 2
    S.line(x, y1, x, cy - 1.8, color)
    S.line(x - 4.0, cy - 1.8, x + 4.0, cy - 1.8, color, 0.5)
    S.line(x - 4.0, cy + 1.8, x + 4.0, cy + 1.8, color, 0.5)
    S.line(x, cy + 1.8, x, y2, color)
    S.text(x + 5.2, cy - 0.5, ref, size=6.0, weight="bold")
    S.text(x + 5.2, cy + 3.6, value, size=5.8, color=MUTED)


def diode_h(x1, x2, y, ref, value, color=INK):
    cx = (x1 + x2) / 2
    S.line(x1, y, cx - 5.0, y, color)
    S.polyline([(cx - 5.0, y - 4.0), (cx + 1.2, y), (cx - 5.0, y + 4.0)], stroke=color, fill="none", close=True)
    S.line(cx + 1.4, y - 4.2, cx + 1.4, y + 4.2, color, 0.55)
    S.line(cx + 1.4, y, x2, y, color)
    S.text(cx, y - 5.5, ref, size=6.0, weight="bold", anchor="middle")
    S.text(cx, y + 7.2, value, size=5.8, color=MUTED, anchor="middle")


def adc_badge(x, y, line1, line2):
    S.rect(x, y - 7.0, 41, 14, stroke=BLUE, fill=BLUE_PALE, radius=2.0, width=0.5)
    S.text(x + 3, y - 1.0, line1, size=7.0, weight="bold", color=BLUE)
    S.text(x + 3, y + 4.1, line2, size=5.8, color=MUTED)


def connector(x, y, ref, name, pin1, pin2, accent):
    S.rect(x, y - 9, 16, 18, stroke=accent, fill=WHITE, radius=1.5, width=0.55)
    S.circle(x + 4.8, y - 4, 1.3, stroke=accent, fill=accent)
    S.circle(x + 4.8, y + 4, 1.3, stroke=accent, fill=WHITE)
    S.line(x + 6.1, y - 4, x + 16, y - 4, accent)
    S.line(x + 6.1, y + 4, x + 16, y + 4, accent)
    S.text(x + 8, y - 11.8, ref, size=6.2, weight="bold", anchor="middle", color=accent)
    S.text(x + 8, y + 14.0, name, size=5.5, color=MUTED, anchor="middle")
    S.text(x + 1.0, y - 3.0, "1", size=5.2, color=WHITE, weight="bold", anchor="middle")
    S.text(x + 1.0, y + 5.0, "2", size=5.2, color=accent, weight="bold", anchor="middle")
    S.text(x - 2.0, y - 3.0, pin1, size=5.5, color=MUTED, anchor="end")
    S.text(x - 2.0, y + 5.0, pin2, size=5.5, color=MUTED, anchor="end")


def external_resistive_sensor(x, y, ref, name, accent, arrows=False, fsr=False):
    S.rect(x - 20, y - 15, 37, 30, stroke=accent, fill=WHITE, radius=2.5, dash=[2, 1], width=0.5)
    S.text(x - 17, y - 10, "EXTERNAL", size=5.2, color=accent, weight="bold")
    S.line(x - 7, y - 4, x - 7, y - 2.8, accent)
    S.rect(x - 10, y - 2.8, 6, 5.6, stroke=accent, fill="none", width=0.5)
    S.line(x - 7, y + 2.8, x - 7, y + 4, accent)
    S.line(x - 7, y - 4, x + 7, y - 4, accent)
    S.line(x - 7, y + 4, x + 7, y + 4, accent)
    if arrows:
        for dx in (2, 7):
            S.line(x + dx, y - 8, x - 1 + dx, y - 3, accent, 0.45)
            S.polyline([(x - 1 + dx, y - 3), (x - 0.3 + dx, y - 5.0), (x - 2.0 + dx, y - 4.6)], stroke=accent, fill=accent, close=True)
    if fsr:
        S.circle(x + 5, y + 2.2, 4.6, stroke=accent, fill="none", width=0.45)
        S.text(x + 5, y + 4.0, "F", size=6.5, color=accent, weight="bold", anchor="middle")
    S.text(x - 17, y + 13, ref, size=6.0, weight="bold", color=accent)
    S.text(x + 14, y + 13, name, size=5.6, color=MUTED, anchor="end")


def external_piezo(x, y, accent):
    S.rect(x - 20, y - 15, 37, 30, stroke=accent, fill=WHITE, radius=2.5, dash=[2, 1], width=0.5)
    S.text(x - 17, y - 10, "EXTERNAL", size=5.2, color=accent, weight="bold")
    S.circle(x - 2, y + 1, 8, stroke=accent, fill="none", width=0.6)
    S.line(x - 4, y - 7, x - 4, y + 9, accent, 0.45)
    S.line(x + 2, y - 5, x + 2, y + 7, accent, 0.45)
    S.line(x + 2, y - 4, x + 7, y - 4, accent)
    S.line(x + 2, y + 4, x + 7, y + 4, accent)
    S.text(x - 17, y + 13, "PZ1", size=6.0, weight="bold", color=accent)
    S.text(x + 14, y + 13, "PIEZO", size=5.6, color=MUTED, anchor="end")


def draw_header():
    S.rect(0, 0, W, H, stroke="none", fill=WHITE)
    S.rect(0, 0, W, 33, stroke="none", fill=NAVY)
    S.rect(0, 33, W, 2.2, stroke="none", fill=ORANGE)
    S.text(16, 14.0, "TRACE", size=19, color=WHITE, weight="bold")
    S.text(16, 24.5, "INTERACTION HARDWARE / ENGINEERING RELEASE", size=6.5, color="#BFD0DB", weight="bold")
    S.text(91, 14.5, "ESP32-S3 SENSOR FRONT-END", size=20, color=WHITE, weight="bold")
    S.text(91, 25.0, "AMBIENT LIGHT  ·  THIN-FILM PRESSURE  ·  VIBRATION ENVELOPE", size=7.5, color="#BFD0DB")
    S.text(403, 13.0, "REV A", size=9, color=WHITE, weight="bold", anchor="end")
    S.text(403, 24.5, "2026-08-30  /  A3", size=6.5, color="#BFD0DB", anchor="end")


def draw_board_and_power():
    S.rect(101, 43, 303, 180, stroke=NAVY, fill=PALE, radius=3, width=0.65)
    S.text(105, 49.8, "CARRIER PCB / SENSOR CONDITIONING", size=6.5, color=NAVY, weight="bold")
    S.text(399, 49.8, "3.3 V ANALOG DOMAIN", size=6.5, color=GREEN, weight="bold", anchor="end")
    S.line(112, 58, 334, 58, GREEN, 0.65)
    S.line(112, 211, 309, 211, INK, 0.65)
    label(112, 55.8, "+3V3", color=GREEN, fill=PALE)
    label(112, 208.5, "GND", color=INK, fill=PALE)
    # Bulk and local rail decoupling.
    capacitor_v(270, 58, 70, "C5", "10uF", GREEN)
    ground(270, 70)
    capacitor_v(294, 58, 70, "C6", "100nF", GREEN)
    ground(294, 70)
    S.text(282, 54.5, "SENSOR RAIL DECOUPLING", size=5.2, color=MUTED, weight="bold", anchor="middle")


def draw_light_channel():
    y = 85
    accent = ORANGE
    external_resistive_sensor(55, y, "LS1", "LDR", accent, arrows=True)
    connector(102, y, "J2", "JST-PH 2P", "3V3", "SENSE", accent)
    # Cable lines.
    S.line(62, y - 4, 102, y - 4, accent)
    S.line(62, y + 4, 102, y + 4, accent)
    # Connector pin 1 to 3V3 rail; pin 2 to divider.
    S.line(118, y - 4, 126, y - 4, GREEN)
    power_3v3(126, y - 4)
    S.line(118, y + 4, 142, y + 4, accent, 0.55)
    junction(142, y + 4, accent)
    resistor_v(142, y + 4, y + 27, "R1", "10k")
    ground(142, y + 27)
    resistor_h(142, 184, y + 4, "R2", "1k")
    junction(184, y + 4, BLUE)
    capacitor_v(204, y + 4, y + 27, "C1", "100nF")
    ground(204, y + 27)
    S.line(184, y + 4, 309, y + 4, BLUE, 0.55)
    label(144, y + 0.7, "LDR_SENSE", color=accent, fill=PALE)
    label(229, y + 0.7, "LIGHT_ADC", color=BLUE, fill=PALE)
    adc_badge(263, y - 3, "GPIO4", "ADC1_CH3")


def draw_pressure_channel():
    y = 131
    accent = GREEN
    external_resistive_sensor(55, y, "FS1", "FSR 402", accent, fsr=True)
    connector(102, y, "J3", "JST-PH 2P", "3V3", "SENSE", accent)
    S.line(62, y - 4, 102, y - 4, accent)
    S.line(62, y + 4, 102, y + 4, accent)
    S.line(118, y - 4, 126, y - 4, GREEN)
    power_3v3(126, y - 4)
    S.line(118, y + 4, 142, y + 4, accent, 0.55)
    junction(142, y + 4, accent)
    resistor_v(142, y + 4, y + 27, "R3", "22k")
    ground(142, y + 27)
    resistor_h(142, 184, y + 4, "R4", "1k")
    junction(184, y + 4, BLUE)
    capacitor_v(204, y + 4, y + 27, "C2", "100nF")
    ground(204, y + 27)
    S.line(184, y + 4, 309, y + 4, BLUE, 0.55)
    label(144, y + 0.7, "FSR_SENSE", color=accent, fill=PALE)
    label(229, y + 0.7, "FSR_ADC", color=BLUE, fill=PALE)
    adc_badge(263, y - 3, "GPIO5", "ADC1_CH4")


def draw_vibration_channel():
    y = 178
    accent = RED
    external_piezo(55, y, accent)
    connector(102, y, "J4", "JST-PH 2P", "PIEZO+", "GND", accent)
    S.line(62, y - 4, 102, y - 4, accent)
    S.line(62, y + 4, 102, y + 4, accent)
    S.line(118, y + 4, 118, 211, INK)
    S.line(118, y - 4, 130, y - 4, accent, 0.55)
    junction(130, y - 4, accent)
    resistor_v(130, y - 4, 211, "R5", "1M")
    resistor_h(130, 165, y - 4, "R6", "47k", accent)
    diode_h(165, 193, y - 4, "D1", "BAT54", accent)
    junction(193, y - 4, accent)
    resistor_v(193, y - 4, 211, "R7", "470k")
    capacitor_v(215, y - 4, 211, "C3", "100nF")
    # High clamp to 3V3 (anode at VIB_ENV, cathode at rail).
    S.line(193, y - 4, 227, y - 4, accent)
    S.line(227, y - 4, 227, 154, accent)
    diode_h(227, 249, 154, "D2", "BAT54", accent)
    power_3v3(249, 154)
    resistor_h(227, 264, y - 4, "R8", "1k", accent)
    junction(264, y - 4, BLUE)
    capacitor_v(276, y - 4, 211, "C4", "100nF")
    S.line(264, y - 4, 309, y - 4, BLUE, 0.55)
    label(132, y - 7.3, "PIEZO_RAW", color=accent, fill=PALE)
    label(195, y - 7.3, "VIB_ENV", color=accent, fill=PALE)
    label(275, y - 7.3, "VIB_ADC", color=BLUE, fill=PALE, anchor="middle")
    adc_badge(263, y + 8, "GPIO6", "ADC1_CH5")
    S.text(211, 202.6, "ENVELOPE τ ≈ 47 ms", size=5.6, color=accent, weight="bold", anchor="middle")


def draw_mcu():
    x, y, w, h = 309, 59, 86, 153
    S.rect(x, y, w, h, stroke=NAVY, fill=WHITE, radius=3, width=0.75)
    S.rect(x, y, w, 24, stroke="none", fill=NAVY, radius=3)
    S.rect(x, y + 20, w, 4, stroke="none", fill=NAVY)
    S.text(x + 6, y + 10, "U1", size=7, color="#BFD0DB", weight="bold")
    S.text(x + 6, y + 18, "ESP32-S3", size=13.5, color=WHITE, weight="bold")
    S.text(x + 80, y + 18, "DevKitC-1", size=7, color="#BFD0DB", anchor="end")
    # Used pins on the left side.
    pins = [
        (89, "J1-4", "GPIO4 / ADC1_CH3", "LIGHT_ADC"),
        (135, "J1-5", "GPIO5 / ADC1_CH4", "FSR_ADC"),
        (174, "J1-6", "GPIO6 / ADC1_CH5", "VIB_ADC"),
    ]
    for py, hdr, pname, net in pins:
        S.circle(x, py, 1.4, stroke=BLUE, fill=BLUE)
        S.text(x + 5, py - 1.2, hdr, size=5.5, color=MUTED, weight="bold")
        S.text(x + 5, py + 4.0, pname, size=6.4, color=NAVY, weight="bold")
        S.text(x + 80, py + 4.0, net, size=5.8, color=BLUE, anchor="end")
    # Power and USB summary.
    S.line(x + 25, 58, x + 25, y, GREEN, 0.65)
    S.circle(x + 25, y, 1.4, stroke=GREEN, fill=GREEN)
    S.text(x + 29, y + 4.8, "3V3 OUT / J1-1,2", size=5.8, color=GREEN, weight="bold")
    S.line(x, 211, x, y + h - 12, INK, 0.65)
    S.circle(x, y + h - 12, 1.4, stroke=INK, fill=INK)
    S.text(x + 5, y + h - 9.5, "GND / J1-22, J3-1,21,22", size=5.8, color=MUTED)
    S.rect(x + 51, y + h - 28, 27, 10, stroke=ORANGE, fill=ORANGE_PALE, radius=2)
    S.text(x + 64.5, y + h - 21.5, "USB-C POWER", size=5.8, color=ORANGE, weight="bold", anchor="middle")


def draw_footer():
    y = 231
    S.line(16, y, 404, y, NAVY, 0.6)
    S.text(16, y + 8, "DESIGN INTENT", size=7.2, color=NAVY, weight="bold")
    notes = [
        ("01", "ADC1 only", "GPIO4 / GPIO5 / GPIO6 avoid USB D-/D+ and follow Espressif's ADC1 preference."),
        ("02", "Protected piezo", "R6 limits current; D1 rectifies; C3/R7 hold the peak; D2 clamps to the 3V3 rail."),
        ("03", "Human calibration", "LDR and FSR thresholds must be learned from the installed enclosure and real users."),
        ("04", "Keyed harnesses", "JST-PH 2P, square-pad Pin 1, fixed wire colors, common 3V3/GND domain."),
    ]
    x_positions = [16, 114, 212, 310]
    for x, (num, title, body) in zip(x_positions, notes):
        S.circle(x + 4, y + 21, 4, stroke=ORANGE, fill=ORANGE)
        S.text(x + 4, y + 22.5, num, size=5.5, color=WHITE, weight="bold", anchor="middle")
        S.text(x + 11, y + 19.5, title, size=7.0, color=NAVY, weight="bold")
        # Two manually wrapped lines for deterministic layout.
        words = body.split()
        lines, current = [], ""
        for word in words:
            candidate = (current + " " + word).strip()
            if len(candidate) > 39:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        for i, line in enumerate(lines[:3]):
            S.text(x, y + 28 + i * 4.6, line, size=5.4, color=MUTED)
    # Formal title block.
    S.rect(16, 279, 388, 9, stroke=NAVY, fill=NAVY, radius=1.2)
    S.text(20, 285.2, "TRACE / ESP32-S3 SENSOR FRONT-END", size=6.4, color=WHITE, weight="bold")
    S.text(205, 285.2, "SCHEMATIC 01 OF 01", size=6.0, color="#BFD0DB", anchor="middle")
    S.text(400, 285.2, "REV A  ·  2026-08-30", size=6.0, color=WHITE, weight="bold", anchor="end")


def build_scene():
    draw_header()
    draw_board_and_power()
    draw_light_channel()
    draw_pressure_channel()
    draw_vibration_channel()
    draw_mcu()
    draw_footer()


def svg_render(scene: Scene, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
        '<title>TRACE ESP32-S3 Sensor Front-End Schematic</title>',
        '<desc>Engineering schematic for LDR, FSR 402 and piezo vibration sensor connections to ESP32-S3 DevKitC-1.</desc>',
    ]
    for it in scene.items:
        k = it["kind"]
        if k == "line":
            dash = f' stroke-dasharray="{",".join(map(str, it["dash"]))}"' if it.get("dash") else ""
            parts.append(f'<line x1="{it["x1"]}" y1="{it["y1"]}" x2="{it["x2"]}" y2="{it["y2"]}" stroke="{it["stroke"]}" stroke-width="{it["width"]}" stroke-linecap="round"{dash}/>' )
        elif k == "rect":
            dash = f' stroke-dasharray="{",".join(map(str, it["dash"]))}"' if it.get("dash") else ""
            fill = it["fill"]
            stroke = it["stroke"]
            parts.append(f'<rect x="{it["x"]}" y="{it["y"]}" width="{it["w"]}" height="{it["h"]}" rx="{it["radius"]}" fill="{fill}" stroke="{stroke}" stroke-width="{it["width"]}"{dash}/>' )
        elif k == "circle":
            parts.append(f'<circle cx="{it["x"]}" cy="{it["y"]}" r="{it["r"]}" fill="{it["fill"]}" stroke="{it["stroke"]}" stroke-width="{it["width"]}"/>' )
        elif k == "polyline":
            tag = "polygon" if it.get("close") else "polyline"
            pts = " ".join(f'{x},{y}' for x, y in it["pts"])
            dash = f' stroke-dasharray="{",".join(map(str, it["dash"]))}"' if it.get("dash") else ""
            parts.append(f'<{tag} points="{pts}" fill="{it["fill"]}" stroke="{it["stroke"]}" stroke-width="{it["width"]}" stroke-linejoin="round"{dash}/>' )
        elif k == "text":
            family = "Microsoft YaHei, Arial, sans-serif" if it["family"] == "ui" else "Consolas, monospace"
            anchor = {"start": "start", "middle": "middle", "end": "end"}[it["anchor"]]
            weight = "700" if it["weight"] == "bold" else "400"
            transform = f' transform="rotate({it["rotate"]} {it["x"]} {it["y"]})"' if it["rotate"] else ""
            lines = str(it["value"]).split("\n")
            if len(lines) == 1:
                content = html.escape(lines[0])
            else:
                content = "".join(f'<tspan x="{it["x"]}" dy="{0 if idx == 0 else 4.2}">{html.escape(line)}</tspan>' for idx, line in enumerate(lines))
            parts.append(f'<text x="{it["x"]}" y="{it["y"]}" fill="{it["color"]}" font-family="{family}" font-size="{it["size"]}px" font-weight="{weight}" text-anchor="{anchor}"{transform}>{content}</text>')
    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")


def _hex_rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))


def _register_pdf_fonts():
    regular_candidates = [
        os.environ.get("TRACE_PDF_FONT_REGULAR"),
        Path(os.environ.get("WINDIR", "")) / "Fonts" / "msyh.ttc",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ]
    bold_candidates = [
        os.environ.get("TRACE_PDF_FONT_BOLD"),
        Path(os.environ.get("WINDIR", "")) / "Fonts" / "msyhbd.ttc",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    ]

    regular = next((Path(item) for item in regular_candidates if item and Path(item).is_file()), None)
    bold = next((Path(item) for item in bold_candidates if item and Path(item).is_file()), regular)
    if not regular:
        return "Helvetica", "Helvetica-Bold"

    pdfmetrics.registerFont(TTFont("TRACE-Regular", str(regular), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("TRACE-Bold", str(bold), subfontIndex=0))
    return "TRACE-Regular", "TRACE-Bold"


def pdf_render(scene: Scene, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    regular_font, bold_font = _register_pdf_fonts()
    c = pdfcanvas.Canvas(str(path), pagesize=(W * mm, H * mm), pageCompression=1)
    c.setTitle("TRACE ESP32-S3 Sensor Front-End Schematic")
    c.setAuthor("TRACE / Interaction Hardware")
    c.setSubject("ESP32-S3 connection schematic for LDR, FSR 402 and piezo vibration sensing")

    def px(x):
        return x * mm

    def py(y):
        return (H - y) * mm

    for it in scene.items:
        k = it["kind"]
        if k in {"line", "rect", "circle", "polyline"}:
            if it.get("stroke") and it["stroke"] != "none":
                c.setStrokeColorRGB(*_hex_rgb(it["stroke"]))
            if it.get("fill") and it["fill"] != "none":
                c.setFillColorRGB(*_hex_rgb(it["fill"]))
            c.setLineWidth(it.get("width", 0.35) * mm)
            dash = it.get("dash")
            c.setDash([d * mm for d in dash] if dash else [])
        if k == "line":
            c.line(px(it["x1"]), py(it["y1"]), px(it["x2"]), py(it["y2"]))
        elif k == "rect":
            fill = 1 if it["fill"] != "none" else 0
            stroke = 1 if it["stroke"] != "none" else 0
            c.roundRect(px(it["x"]), py(it["y"] + it["h"]), px(it["w"]), px(it["h"]), px(it["radius"]), fill=fill, stroke=stroke)
        elif k == "circle":
            c.circle(px(it["x"]), py(it["y"]), px(it["r"]), fill=1 if it["fill"] != "none" else 0, stroke=1 if it["stroke"] != "none" else 0)
        elif k == "polyline":
            p = c.beginPath()
            x0, y0 = it["pts"][0]
            p.moveTo(px(x0), py(y0))
            for x, y in it["pts"][1:]:
                p.lineTo(px(x), py(y))
            if it.get("close"):
                p.close()
            c.drawPath(p, fill=1 if it["fill"] != "none" else 0, stroke=1 if it["stroke"] != "none" else 0)
        elif k == "text":
            c.saveState()
            c.setFillColorRGB(*_hex_rgb(it["color"]))
            font = bold_font if it["weight"] == "bold" else regular_font
            c.setFont(font, it["size"])
            x, y = px(it["x"]), py(it["y"])
            c.translate(x, y)
            if it["rotate"]:
                c.rotate(-it["rotate"])
            lines = str(it["value"]).split("\n")
            for idx, line in enumerate(lines):
                yy = -idx * 4.2 * mm
                if it["anchor"] == "middle":
                    c.drawCentredString(0, yy, line)
                elif it["anchor"] == "end":
                    c.drawRightString(0, yy, line)
                else:
                    c.drawString(0, yy, line)
            c.restoreState()
    c.showPage()
    c.save()


def main():
    build_scene()
    svg_render(S, SVG_PATH)
    pdf_render(S, PDF_PATH)
    print(f"SVG: {SVG_PATH}")
    print(f"PDF: {PDF_PATH}")
    print(f"Scene items: {len(S.items)}")


if __name__ == "__main__":
    main()
