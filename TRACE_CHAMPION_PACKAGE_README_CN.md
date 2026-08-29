# TRACE 黑客松冠军级视觉与 CAD 交付包

版本：2026-08-30 / Reference-Locked

## 当前唯一视觉基线

以用户锁定效果图中的产品为唯一产品真值：自然不对称鹅卵石轮廓、连续清透至柔雾半透明软硅胶、乳白柔边、暖琥珀内部光、光滑正面与 TRACE 小号标识。旧版黑边、斜槽、圆孔和外露挂环方案已退出正式视觉线。

## 交付内容

- `renders/TRACE_film_locked_2.39_20260829/master_2048x858/`：8 张统一 2048 × 858、2.39:1 电影关键帧。
- `renders/TRACE_film_locked_2.39_20260829/TRACE_8shot_contactsheet_2048x1716.png`：8 镜头总览。
- `renders/TRACE_film_locked_2.39_20260829/TRACE_CINEMATIC_RENDER_WORKFLOW_CN.md`：20 秒叙事、相机、景深、色深、物理渲染、Veo/Runway/Firefly 动作提示与审片标准。
- `cad/TRACE_pebble_parametric.scad`：三尺寸参数化 CAD 母版，默认 `visual_style="reference_locked"`。
- `cad/README_PRINT_CN.md`：材料、装配、隐藏挂载、人体工学与打印说明。
- `exports/`：三款产品的前壳、背壳、传感器座与板卡禁入体 STL，锁定版装配预览及网格验证报告。

## 三款尺寸

| 型号 | 尺寸 | 场景 | 挂载 |
|---|---:|---|---|
| `bag_esp32` | 86 × 66 × 34 mm | 包挂、手持主机 | 背面隐藏式 24 mm 桥 |
| `badge_mini` | 74 × 46 × 21 mm | 工牌、胸前吊挂 | 背面隐藏式 18 mm 桥 |
| `clip_mini` | 70 × 46 × 21 mm | 衣物任意位置 | 背面双穿带/磁吸适配桥 |

## 验证状态

- 8 张正式关键帧：已统一 2.39:1 与文件尺寸。
- 12 个 STL：全部 `watertight=true`、`components=1`、`degenerate_triangles=0`。
- 当前概念 PNG：用于构图、叙事与 image-to-video 输入。
- 最终广告母版：按工作流使用 CAD 物理渲染 32-bit EXR、ACEScg 与 12-bit ProRes 4444 XQ 完成，Logo 与标题使用后期矢量资产。

## 使用顺序

1. 先查看 8 镜头总览并锁定叙事顺序。
2. 按电影工作流对每张关键帧分别生成 2–4 秒低幅运动候选。
3. 以产品几何与 Logo 保持率挑片；任何轮廓漂移、黑边、按钮或错误附件直接淘汰。
4. 用参数化 CAD 和真实硅胶样片完成最终产品层替换。
5. 在 DaVinci Resolve 的 ACES 项目中完成镜头匹配、声音、标题和 4K DCI Scope 母版。
