# TRACE《Living Moments》电影级渲染与 AIGC 视频制作规范

版本：2026-08-29 / Reference-Locked v1
画面母题：Capture → Grow → Re-embody
当前概念关键帧：8 张，全部统一为 2048 × 858、2.39:1

## 1. 唯一产品真值

产品外观以用户锁定的参考效果图为唯一真值。后续镜头允许改变环境、机位、光线、手部动作和背面隐藏附件，不允许重新设计产品。

- 大号：86 × 66 × 34 mm，用于包挂和手持。
- 工牌 Mini：74 × 46 × 21 mm。
- 衣物 Mini：70 × 46 × 21 mm。
- 轮廓：自然、轻微不对称的鹅卵石/卵形；保留参考图的高宽比、上窄下丰和柔和鼓面。
- 外层：连续、无黑边的清透至柔雾渐变软硅胶；边缘乳白发光，内部暖琥珀光低饱和扩散。
- 正面：完整光滑。没有斜槽、圆环、按钮、孔洞、端口、黑色背圈或可见拼缝。
- 标识：TRACE 小号高字距标识，位置固定在正面上方。正式 3D 渲染必须使用矢量贴花；AIGC 生成文字仅用于预演。
- 挂载：包挂绳、工牌桥接、衣物磁吸夹全部藏在背面；正面轮廓不受附件影响。
- 触感结构：外层建议 2.5–3.0 mm 铂金硫化半透明硅胶，视觉目标 Shore A 20–25；内部采用薄型承力骨架包住 PCB，使按压区发生约 1.5–2.0 mm 局部柔性形变，而整体不塌陷。

### 全局禁止项

硬塑料、亚克力、玻璃、湿亮橡胶、果冻/糖果感、机械凹槽、圆形按钮、黑边、外露挂环、产品漂浮、比例漂移、Logo 漂移、同镜头产品克隆、极端浅景深、浓烈青橙色调、假镜头光斑、过量雾化、AI 同心纹、蜡质皮肤、错误手指、在生成阶段写入标题正文。

## 2. 2026 顶级工具路线

最高质量采用“物理产品真值 + AIGC 场景/运动 + 专业后期”的混合管线。纯文本生图不作为最终产品几何依据。

1. **几何与产品真值：KeyShot Studio 2026.2**

   导入参数化 CAD/STL/STEP；用真实尺度、物理灯光、路径追踪和相机参数生成产品层。KeyShot 官方说明其工作流以 CAD 为起点，支持物理正确的全局照明、科学材料、实时光追、ACES、32-bit EXR、Cryptomatte 与多类渲染通道。
   官方依据：[KeyShot Studio](https://www.keyshot.com/keyshot-studio/)、[KeyShot 2026.2 支持格式](https://manuals.keyshot.com/kss2026/en-us/manual/supported-file-formats.html)、[EXR 与渲染通道](https://manuals.keyshot.com/kss2026/en-us/manual/layers-and-passes-Render-Pass-Output.html)

2. **材质标定：KeyShot Plastic (Cloudy) / Advanced + Substance 3D Painter**

   KeyShot 的 Cloudy Plastic 提供 Transmission、Roughness、IOR、Transparency Distance、Cloudiness 与散射方向，可作为半透明硅胶视觉起点；Substance 用于非重复微粗糙、物理尺寸和 PBR 贴图。最终参数必须用真实硅胶样片校准。
   官方依据：[Cloudy Plastic 参数](https://manuals.keyshot.com/kss2026/en-us/manual/plastic-cloudy.html)、[Substance 3D Painter](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/home?lang=en)

3. **主视频生成：Google Flow / Veo 3.1**

   用每张锁定关键帧做 image-to-video；优先使用 reference ingredients、首尾帧、camera controls 与原生音频。产品片不从空白文本开始生成。
   官方依据：[Google DeepMind Veo 3.1](https://deepmind.google/models/veo/)

4. **精确运动备选：Runway Gen-4.5**

   适合 2–10 秒低幅产品运动、重复生成与镜头选择；专业管线可输出 ProRes、PNG 序列、10-bit SDR/HDR。
   官方依据：[Runway Gen-4.5](https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5)、[Runway 模型与专业格式](https://docs.dev.runwayml.com/guides/models/)

5. **商业安全备选：Adobe Firefly Video**

   使用首尾关键帧进行品牌安全的 image-to-video 版本，适合需要 Adobe 商用合规链路的交付。
   官方依据：[Firefly 使用关键帧生成视频](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-images.html)

6. **剪辑、调色与母版：DaVinci Resolve Studio**

   统一 ACES 项目、镜头匹配、肤色与发光保护、细颗粒、声音和最终多格式输出。标题、Logo、功能标注只在后期添加。

## 3. 物理渲染基准

### 材质起始窗口

这些是 LookDev 起点，不是未经样片验证的最终材料数据。

- 外层厚度：2.8 mm；折射率起点 1.41。
- 表面 Roughness：0.32–0.42；必须产生宽而柔的高光，不出现亮硬边。
- Cloudiness：0.35–0.55；Transparency Distance：7–11 mm。
- Transmission：暖中性乳白，避免纯白导致塑料感。
- 微粗糙尺度：0.08–0.18 mm、强度极低、非重复；不得出现可识别噪声纹理。
- 内部扩散片：0.6–0.8 mm；暖琥珀 LED 不直接可见，不产生点状热点。
- 实物验证：至少制作三枚 30 × 30 × 3 mm 硅胶样片，在 5600 K 软光和内部暖光下拍摄，对照调整透光、雾度和粗糙度。

### 灯光与相机

- 母画幅：2.39:1。概念帧 2048 × 858；最终 DCI Scope 母版 4096 × 1716。
- 帧率：24.000 fps；快门基准 180°（1/48 秒）。行走镜头可用 1/96 控制产品清晰度。
- 影像语言：ARRI Alexa 35 / LogC4 参考；ACES 管理。
- 镜头：产品特写 65–75 mm 球面镜头；环境动作 50–65 mm。采用球面镜头再裁成 Scope，避免变形破坏产品轮廓。
- 光圈：单品 T5.6–T8；人手互动 T4–T4.5；家族镜头 T8。
- 空间：每镜必须有前景、主体、背景三层；背景可识别但不能抢主体。
- 对比：主体到最亮窗景控制在约 5–6 档；白边不剪切，黑衣仍保留织物细节。
- 主光：大面积 book light；白卡塑形；负补光只负责轮廓，不制造黑边。

### 渲染输出

- 静帧：32-bit EXR，ACEScg；另出 Beauty、Diffuse、Lighting、GI、Reflection、Refraction、Shadow、Depth、Cryptomatte。
- 视频产品层：16/32-bit EXR 序列；禁止直接以 H.264 作为中间母版。
- 最终片：ProRes 4444 XQ 12-bit，4096 × 1716，24 fps；另交 Rec.709 Gamma 2.4 审片版。
- AIGC PNG 是构图与叙事关键帧，不代表真实 10/12/32-bit 色深。最终色深来自物理渲染、视频模型高质量输出和后期母版。

## 4. 20 秒叙事与镜头运动

| 时间 | 关键帧 | 叙事功能 | 相机与动作 | 声音 |
|---|---|---|---|---|
| 0.0–2.4 s | S01 Stillness | 产品处于静息，建立“有生命的物” | 75 mm，T5.6，1.5% 缓慢推进；环境曝光不变，内部暖光从 5% 到 12% | 清晨房间底噪 + 很轻的材料呼吸 |
| 2.4–5.4 s | S02 Capture | 人的按压被捕捉 | 65 mm，T4.5；拇指在 0.8 s 内压入 1.5 mm，暖光到 42%，其余几何锁定 | 软硅胶触碰 + 低频触觉脉冲 |
| 5.4–7.9 s | S03 Bag Charm | 证明大号随身携带 | 50 mm 平行跟拍；包体小幅摆动，产品只允许 ±1.5° 惯性摆动 | 脚步、织物摩擦、微弱碰触 |
| 7.9–10.2 s | S04 Badge Mini | 工牌场景中的快速捕捉 | 75 mm；呼吸产生毫米级布料位移，手指触碰后暖光响应 | 会场远景底噪 + 单次轻脉冲 |
| 10.2–12.5 s | S05 Garment Mini | 表达任意衣物位置佩戴 | 65 mm；背景缓慢横移，产品保持稳定，局部按压 1.0 mm | 室外风声 + 衣料细响 |
| 12.5–15.8 s | S06 Replay | 记忆以色彩回到身体 | 65 mm 固定机位；暖琥珀缓慢过渡到尘玫瑰与珍珠蓝，绝不变成彩虹 | 三层柔和音色：记忆、呼吸、回响 |
| 15.8–18.0 s | S07 Family | 揭示三种尺寸是一套系统 | 65 mm，T8，顺时针 6° 微弧；三件产品完全静止 | 空间感上扬但不做胜利号角 |
| 18.0–20.0 s | S08 End Frame | 品牌与主张收束 | 75 mm，T8，缓慢退出 1%；暖光回到 18%，后期淡入标题 | 单一低频脉冲后归于安静 |

## 5. Image-to-Video 全局锁定提示词

每个镜头都以对应 PNG 作为起始图；下列锁定段落放在每条运动提示词末尾。

```text
Lock the exact product geometry, scale, translucent soft-silicone material, smooth front surface and TRACE wordmark from the input keyframe. Motion only. No redesign, no morphing, no new seam, no black rim, no groove, no button, no visible mount, no logo drift, no extra product, no camera wobble, no skin or finger mutation. Preserve the 2.39:1 composition, title-safe negative space, controlled depth planes, natural filmic exposure and restrained color.
```

### S01

```text
An almost imperceptible 1.5 percent dolly-in. The curtain moves by only a few millimeters. The inner amber ember rises slowly from 5 to 12 percent. The product and all props stay physically still.
```

### S02

```text
The thumb compresses the silicone by 1.5 millimeters over 0.8 seconds with a broad smooth deformation gradient; the amber core blooms gently and then settles. Fingers, palm and overall product silhouette remain stable. One subtle haptic micro-motion only.
```

### S03

```text
Slow parallel camera tracking at walking speed. The bag fabric moves naturally and the product performs a restrained plus-or-minus 1.5 degree pendulum response with a taut rear tether. Keep the product sharp and the background slightly motion-soft.
```

### S04

```text
Minute breathing movement shifts the overshirt and lanyard. The index finger contacts the product once; amber light responds in one soft pulse. Keep the hidden mount, badge and product alignment stable.
```

### S05

```text
The background glides laterally with gentle parallax. Two fingers press the silicone locally by 1 millimeter while the magnetic rear mount keeps the product fixed to the fabric. No sliding or floating.
```

### S06

```text
Locked camera with a one percent push. The internal light breathes from warm amber to a whisper of dusty rose and pearl blue, then returns toward amber. The colors diffuse volumetrically inside the silicone; no LED dots, rings or rainbow.
```

### S07

```text
A slow six-degree clockwise camera arc and a two-centimeter downward crane. All three products stay static, preserve exact relative sizes and remain on their plinths. Reflections and highlights move naturally with camera parallax only.
```

### S08

```text
An extremely slow one percent dolly-out. The warm core settles to a quiet 18 percent intensity. Keep the product completely still. Add no generated text; final typography fades in during post-production.
```

## 6. 生成与挑片纪律

- 每镜生成 4 个候选，优先选择“产品几何保持率最高”的版本，不选择运动最夸张的版本。
- 运动幅度采用低档；单镜 2–4 秒。禁止用长镜头迫使模型持续猜测产品结构。
- 手部镜头逐帧检查：指头数量、关节、指甲、压痕位置、Logo 和产品轮廓。
- 佩戴镜头逐帧检查：重量、绳/布料受力、接触阴影和产品尺寸。
- 任何一帧出现黑边、机械按钮、Logo 漂移或轮廓变化，该候选整段淘汰，不用局部遮掩掩盖产品错误。
- 标题、功能引线、奖项陈述和 UI 全部后期完成；生成画面只承担物、身体、空间和光。

## 7. 设计奖级别审片清单

iF 2027 官方评审维度为 Idea、Form、Function、Differentiation、Sustainability；本片对应检查如下：[iF 官方评审标准](https://ifdesign.com/en/if-design-award-and-jury)

- Idea：镜头是否明确表达“按压捕捉短暂感受，随后以光和触觉重现”。
- Form：鹅卵石形状、柔软材料、光与 Logo 是否始终一致且可制造。
- Function：包挂、工牌、衣物佩戴是否一眼可懂；按压响应是否符合人体动作。
- Differentiation：产品是否以身体记忆和柔性光反馈建立独特品牌语言。
- Sustainability：可拆维修的内部骨架、可更换外皮、低功耗光源和材料策略是否能被实物与说明证实。

画面不能替代产品证据。最终提交还应补充：爆炸结构、可拆维修路径、材料样片、按压力曲线、重量、佩戴稳定性和至少一轮真人测试。
