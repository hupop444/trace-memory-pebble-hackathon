# Release QA

- Native schematic: KiCad format `20250114`, generator version `9.0`, A3 landscape.
- Native schematic reload: 20 components, 46 labels, 36 explicit no-connect markers.
- API validation: 0 issues.
- Required functional nets present: `+3V3`, `GND`, `LDR_SENSE`, `LIGHT_ADC`, `FSR_SENSE`, `FSR_ADC`, `PIEZO_RAW`, `PIEZO_LIMITED`, `VIB_ENV`, `VIB_ADC`.
- PDF: one A3 vector page with embedded Microsoft YaHei fonts and document metadata.
- PDF visual QA: rendered with Poppler at 150 dpi; checked for clipping, missing glyphs, accidental junctions, rail/signal ambiguity, and title-block alignment.
- Final preview resolution: 2481 x 1754 px.
- Electrical intent check: GPIO4/5/6 map to ADC1_CH3/4/5; piezo diode polarity is `PIEZO_LIMITED -> D1 anode / VIB_ENV -> D1 cathode` and `VIB_ENV -> D2 anode / +3V3 -> D2 cathode`.
