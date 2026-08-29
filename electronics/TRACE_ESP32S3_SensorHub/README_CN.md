# TRACE ESP32-S3 三传感器前端

这是一套面向 `ESP32-S3-DevKitC-1` 的可编辑 KiCad 原理图与作品集级矢量展示文件。电路把三个外置、两线制传感元件接入开发板：

- 光敏电阻：`LDR / GL5528 类`，接入 `GPIO4 / ADC1_CH3`；
- 薄膜压力传感器：`Interlink FSR 402`，接入 `GPIO5 / ADC1_CH4`；
- 压电振动片：原始压电片，经过限流、肖特基半波整流、峰值保持和过压钳位后接入 `GPIO6 / ADC1_CH5`。

## 交付文件

- `TRACE_ESP32S3_SensorHub.kicad_sch`：KiCad 9/10 可编辑原理图，ESP32-S3 开发板符号来自 Espressif 官方 KiCad 库；
- `output/pdf/TRACE_ESP32S3_SensorHub_Schematic.pdf`：A3 横向矢量原理图；
- `exports/TRACE_ESP32S3_SensorHub_Schematic.svg`：作品集与网页排版用矢量文件；
- `renders/TRACE_ESP32S3_SensorHub_Schematic.png`：经 Poppler 渲染检查的高清预览；
- `bom/TRACE_ESP32S3_SensorHub_BOM.csv`：器件清单；
- `CONNECTIONS_CN.md`：接线、极性、标定和禁止事项。

`TRACE_ESP32S3_SensorHub.kicad_sch` 已嵌入本项目使用的全部符号，因此即使目标电脑尚未安装 Espressif PCM 库，也可直接打开和查看；若要更新官方符号或继续进行 PCB 设计，再从 KiCad 的 Plugin and Content Manager 安装 Espressif Library。

## 核心设计决定

1. 三路模拟输入全部使用 ADC1。ESP32-S3 官方硬件指南推荐 ADC1，并建议在 ADC 管脚到地放置 0.1 uF 滤波电容。
2. 光敏和压力通道均使用 3.3 V 激励，静态输出不会超过 MCU 电源域。
3. 压电片不是电阻型传感器，受敲击时会产生正负高压尖峰；必须经过 `R6 + D1 + D2 + C3 + R7` 调理，不能直接接 GPIO。
4. `R3 = 22 kΩ` 是 FSR 402 的起始标定值。若产品的主要力度区间不同，可在 10 kΩ、22 kΩ、47 kΩ 中实测后锁定。
5. 所有外置传感器使用 JST-PH 2P 防松连接器，并在丝印/线束上固定 Pin 1 方向。

## 输入假设

这版明确面向“原始两线传感元件”：光敏电阻、FSR 402、无源压电片。如果你手上的实物是带比较器或运放的三针/四针模块（例如带 `VCC/GND/AO/DO` 的光敏或震动模块），不要照抄本图，需要按模块的实际型号和输出电压重做接口页。

## 固件读取建议

- LDR 与 FSR：建议 100-200 Hz 采样，8-16 点中位数或截尾均值滤波；启动后记录环境基线。
- 压电振动：`R7 x C3 = 470 kΩ x 100 nF ≈ 47 ms`，GPIO6 读取的是正向冲击包络，不是原始交流波形。
- FSR 不是精密称重器件。用于“触碰/按压强度”时应做个体标定、迟滞处理和舒适力度测试，不应直接换算为绝对牛顿值。

## 参考资料

- Espressif ESP32-S3-DevKitC-1 用户指南与官方管脚表；
- Espressif ESP32-S3 Hardware Design Guidelines，ADC 章节；
- Interlink Electronics FSR 400 Series Datasheet / Integration Guide；
- Espressif 官方 KiCad Libraries 中的 `ESP32-S3-DevKitC` 符号与封装。
