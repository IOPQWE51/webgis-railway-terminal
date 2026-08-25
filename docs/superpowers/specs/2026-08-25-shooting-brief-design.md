# 今日拍摄简报（Shooting Brief）设计文档

- 日期：2026-08-25
- 状态：待主人审阅
- 负责鱼：大肥鱼 🐋

---

## 1. 背景与目标

EarthTerminal 已有日出日落等天文信息的**点状展示**（点击坐标后弹出的详情卡），
但用户打开地图的第一眼看不到"现在/今晚这片天适合拍什么"。

本功能在地图顶部增加一条**可收起的天文胶囊卡**，实时显示当前地图中心位置的：
日出、日落、黄金时刻、蓝调时刻、月相照度。

**设计原则**：零网络请求、纯本地计算（SunCalc）、离线可用——
为将来的 PWA 离线包打底。

## 2. 需求

| # | 需求 | 来源 |
|---|------|------|
| R1 | 内容 = 纯天文五项：日出 / 日落 / 黄金时刻 / 蓝调时刻 / 月相 | 主人拍板 |
| R2 | 位置基准 = 跟随地图中心，防抖更新 | 主人拍板 |
| R3 | 可收起，收起偏好持久化（localStorage） | 方案 A 定义 |
| R4 | 极昼/极夜等极端天象优雅降级（区间为空而非报错） | 边界要求 |

### 非目标（明确不做）

- 天气聚合（云量/降水）—— 未来版本
- ruleMatcher 规则推荐接入 —— 未来版本
- PWA manifest / Service Worker —— 独立后续项目

## 3. 架构

```
MapEngine.jsx
  ├─ (已有) moveend 监听 → 哈希同步          [不改动逻辑，仅共用同一回调]
  ├─ (新增) 同一监听内 setMapView({lat,lng}) 600ms 防抖
  └─ <ShootingBrief lat={..} lng={..} />      [仅 isActive 且 leafletReady 时渲染]

src/utils/shootingBrief.js     ← 纯函数核心（TDD）
src/components/ShootingBrief.jsx ← 展示组件
tests/shooting-brief.test.js   ← 单元测试
```

### 3.1 `utils/shootingBrief.js`（纯函数）

```js
computeShootingBrief({ lat, lon, date = new Date() })
// 返回 Brief：
{
  sunrise: Date|null,        // 当日日出（浏览器本地时区墙钟）
  sunset: Date|null,
  goldenHours: [{start,end}], // 太阳高度角 ∈ (-4°, +6°)，可能早晚各一段
  blueHours:   [{start,end}], // 太阳高度角 ∈ (-6°, -4°]
  moon: { fraction: 0-1, name: '娥眉月', emoji: '🌒' },
}
```

计算方式：
- 日出/日落：`SunCalc.getTimes(date, lat, lon)`
- 黄金/蓝调：从当日本地 00:00 前 2h 到次日 02:00，每 **5 分钟**采样
  `SunCalc.getPosition(date, lat, lon).altitude`，按高度角阈值切连续区间；
  区间两端做 1 分钟级二分细化到 ±1 分钟精度
- 月相照度：`SunCalc.getMoonIllumination(date).fraction`；
  名称/emoji 用内置 8 相位映射表（新月→满月→残月循环）

约定与边界：
- 时间一律为 JS Date，**以浏览器本地时区显示**（与现有详情卡口径一致；
  SunCalc 的天体位置计算本身与查看者时区无关）
- 坐标非法（越界/NaN）→ 返回 null；极昼极夜 → sunrise/sunset 为 null、
  对应区间为空数组，组件显示"极昼/极夜"提示文案
- 黄金/蓝调阈值常量导出（GOLDEN_ALT_MIN=-4 等），供测试与未来调参

### 3.2 `components/ShootingBrief.jsx`

- props：`{ lat, lng }`
- 计算缓存：`useMemo(key = `${lat.toFixed(2)},${lon.toFixed(2)},${dateKey}`)`
  （2 位小数 ≈ 1.1km 内不重算；dateKey 为当日 yyyy-mm-dd，跨天自动刷新）
- 形态：
  - 收起态：一枚 36px 圆形悬浮按钮（🌅），固定在地图容器顶端中央
    （z-index 低于测距 HUD，位于哈希同步层之上）
  - 展开态：胶囊横条，逐项展示五要素；月相 emoji + 百分比
- 持久化键：`earth_terminal_brief_collapsed`
- 无障碍：按钮 aria-label="今日拍摄简报"，展开态 role="status"

### 3.3 MapEngine 改动（最小侵入）

现有 moveend 监听回调内追加一行 `setMapView({lat, lng})`（共用同一次防抖），
新增 `mapView` state 传给 ShootingBrief。不新增第二个地图事件监听。

## 4. 错误处理

| 场景 | 行为 |
|------|------|
| 坐标非法 | 组件返回 null（不渲染） |
| computeShootingBrief 抛异常（理论不可能） | try/catch 兜底 → 不渲染并 console.warn |
| 极昼/极夜 | 显示对应提示文案，其余字段正常 |
| localStorage 不可用（隐私模式） | try/catch，默认展开态 |

## 5. 测试计划（TDD）

`tests/shooting-brief.test.js`：

1. **真实值锚定**：东京站 (35.6812,139.7671) 2026-08-25 →
   日出 ≈ 05:08±5min JST、日落 ≈ 18:20±5min（与线上 v5.3.0 详情卡实测值交叉验证）
2. 黄金/蓝调区间结构：有序、不重叠、蓝调紧贴日出前/日落后的黄金段外侧
3. 高纬极昼：Svalbard (78.2, 15.6) 2026-06-21 → sunrise=null、goldenHours 覆盖全天或为空、不抛异常
4. 高纬极夜：同地 2025-12-21 → 全部区间空、sunrise/sunset null
5. 非法输入：(91, 200) / NaN → null
6. 月相映射：fraction=0 → 新月 🌑；0.99 → 满月 🌕；边界值单调

## 6. 验收标准

- 打开首页即见收起态胶囊；展开显示五要素且数值与详情卡一致
- 拖动地图 ≥1.1km 后松手，约 1 秒内简报刷新为新中心的天象
- 刷新页面收起状态保持
- `npm test` 全绿、`npx eslint .` 零错误、生产构建通过
