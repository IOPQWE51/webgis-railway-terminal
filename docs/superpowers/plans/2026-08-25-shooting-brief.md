# 今日拍摄简报（Shooting Brief）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在地图顶部加一条可收起的天文胶囊卡，实时显示地图中心位置的日出/日落/黄金时刻/蓝调时刻/月相，纯本地计算零网络。

**Architecture:** 纯函数核心 `utils/shootingBrief.js`（SunCalc 逐分钟采样高度角切区间）+ 展示组件 `components/ShootingBrief.jsx`；MapEngine 既有 moveend 防抖回调顺手喂出中心坐标，不新增事件监听。

**Tech Stack:** React 19 / SunCalc 1.9（已有依赖）/ vitest。

**规格文件:** `docs/superpowers/specs/2026-08-25-shooting-brief-design.md`

---

### Task 1: 天文计算纯函数（TDD）

**Files:**
- Create: `src/utils/shootingBrief.js`
- Test: `tests/shooting-brief.test.js`

- [ ] **Step 1.1: 写失败测试**

创建 `tests/shooting-brief.test.js`：

```js
import { describe, it, expect } from 'vitest';
import {
  computeShootingBrief,
  moonPhaseInfo,
  phaseMeta,
} from '../src/utils/shootingBrief.js';

const TOKYO = { lat: 35.6812, lon: 139.7671 };

describe('computeShootingBrief · 真实值锚定', () => {
  const brief = computeShootingBrief({
    ...TOKYO,
    date: new Date('2026-08-25T12:00:00+09:00'),
  });

  it('东京站日出 ≈ 05:08 JST（±6min，与线上 v5.3.0 详情卡交叉验证）', () => {
    const anchor = new Date('2026-08-24T20:08:00Z');
    expect(Math.abs(brief.sunrise - anchor)).toBeLessThan(6 * 60000);
  });

  it('东京站日落 ≈ 18:19 JST（±6min）', () => {
    const anchor = new Date('2026-08-25T09:19:00Z');
    expect(Math.abs(brief.sunset - anchor)).toBeLessThan(6 * 60000);
  });

  it('傍晚存在一段黄金时刻，且结束于日落前后 90 分钟内', () => {
    const ev = brief.goldenHours.filter(g => g.start.getHours() >= 11).pop();
    expect(ev).toBeTruthy();
    expect(Math.abs(ev.end.getTime() - brief.sunset.getTime()))
      .toBeLessThanOrEqual(90 * 60000);
  });

  it('晚侧蓝调段紧贴黄金段外沿（|gold.end − blue.start| ≤ 5min）', () => {
    const evGold = brief.goldenHours.filter(g => g.start.getHours() >= 11).pop();
    const evBlue = brief.blueHours.filter(b => b.start.getHours() >= 11).pop();
    expect(evGold).toBeTruthy();
    expect(evBlue).toBeTruthy();
    expect(Math.abs(evGold.end.getTime() - evBlue.start.getTime()))
      .toBeLessThanOrEqual(5 * 60000);
  });
});

describe('computeShootingBrief · 极端天象', () => {
  it('Svalbard 极夜（2025-12-21）：日出日落为空、黄金段为空、不抛异常', () => {
    const b = computeShootingBrief({ lat: 78.2, lon: 15.6, date: new Date('2025-12-21T12:00:00Z') });
    expect(b).not.toBeNull();
    expect(b.sunrise).toBeNull();
    expect(b.goldenHours).toHaveLength(0);
    expect(Array.isArray(b.blueHours)).toBe(true);
  });

  it('Svalbard 极昼（2026-06-21）：日落为空、结构完整、不抛异常', () => {
    const b = computeShootingBrief({ lat: 78.2, lon: 15.6, date: new Date('2026-06-21T12:00:00Z') });
    expect(b.sunset).toBeNull();
    expect(Array.isArray(b.goldenHours)).toBe(true);
    expect(b.moon.fraction).toBeGreaterThanOrEqual(0);
  });
});

describe('computeShootingBrief · 输入防御', () => {
  it('非法坐标返回 null', () => {
    expect(computeShootingBrief({ lat: 91, lon: 200 })).toBeNull();
    expect(computeShootingBrief({ lat: NaN, lon: 0 })).toBeNull();
    expect(computeShootingBrief({ lat: 35 })).toBeNull();
  });

  it('非法日期返回 null', () => {
    expect(computeShootingBrief({ ...TOKYO, date: new Date('not-a-date') })).toBeNull();
  });
});

describe('moonPhaseInfo / phaseMeta', () => {
  it('phaseMeta 相位表边界正确', () => {
    expect(phaseMeta(0.0).emoji).toBe('🌑');
    expect(phaseMeta(0.99).name).toBe('新月');
    expect(phaseMeta(0.1).name).toBe('娥眉月');
    expect(phaseMeta(0.25).emoji).toBe('🌓');
    expect(phaseMeta(0.5).name).toBe('满月');
    expect(phaseMeta(0.75).emoji).toBe('🌗');
  });

  it('moonPhaseInfo 返回结构完整', () => {
    const m = moonPhaseInfo(new Date('2026-08-25T12:00:00Z'));
    expect(m).toHaveProperty('fraction');
    expect(m).toHaveProperty('phaseName');
    expect(m).toHaveProperty('emoji');
    expect(m.fraction).toBeGreaterThanOrEqual(0);
    expect(m.fraction).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 1.2: 建桩让测试红**

创建 `src/utils/shootingBrief.js`：

```js
// src/utils/shootingBrief.js
// 🧪 TDD 脚手架桩：先红后绿
export function computeShootingBrief() { return null; }
export function moonPhaseInfo() { return {}; }
export function phaseMeta() { return {}; }
```

运行：`npx vitest run tests/shooting-brief.test.js`
预期：FAIL（锚定断言全部失败，null ≠ Date）

- [ ] **Step 1.3: 最小实现**

替换 `src/utils/shootingBrief.js` 全文：

```js
// src/utils/shootingBrief.js
// 🌅 今日拍摄简报 —— 纯本地天文计算（零网络请求，离线可用）
//
// 黄金时刻：太阳高度角 ∈ (-4°, +6°]
// 蓝调时刻：太阳高度角 ∈ (-6°, -4°]
// 实现注记：全程 1 分钟步进采样（约 1700 次getPosition，毫秒级开销），
// 边界精度即 ±1 分钟，无需额外二分。
// 时间均为 JS Date，显示时使用浏览器本地时区（与现有详情卡口径一致）。

import SunCalc from 'suncalc';

export const GOLDEN_ALT_MIN = -4;
export const GOLDEN_ALT_MAX = 6;
export const BLUE_ALT_MIN = -6;
export const BLUE_ALT_MAX = -4;

const validCoords = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) &&
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

const validDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

const inBand = (alt, min, max) => alt > min && alt <= max;

/** 相位周期(0-1) → 中文名 + emoji */
export function phaseMeta(phase) {
  if (phase < 0.03 || phase >= 0.97) return { name: '新月', emoji: '🌑' };
  if (phase < 0.22) return { name: '娥眉月', emoji: '🌒' };
  if (phase < 0.28) return { name: '上弦月', emoji: '🌓' };
  if (phase < 0.47) return { name: '盈凸月', emoji: '🌔' };
  if (phase < 0.53) return { name: '满月', emoji: '🌕' };
  if (phase < 0.72) return { name: '亏凸月', emoji: '🌖' };
  if (phase < 0.78) return { name: '下弦月', emoji: '🌗' };
  return { name: '残月', emoji: '🌘' };
}

export function moonPhaseInfo(date) {
  const ill = SunCalc.getMoonIllumination(date);
  return { fraction: +(ill.fraction ?? 0).toFixed(2), ...phaseMeta(ill.phase ?? 0) };
}

/** 在 [winStart, winEnd] 内逐分钟扫描，切出满足高度角带的连续区间 */
function collectIntervals(winStart, winEnd, lat, lon, min, max) {
  const out = [];
  let runStart = null;
  let prevIn = false;
  for (let t = winStart.getTime(); t <= winEnd.getTime(); t += 60000) {
    const d = new Date(t);
    const ok = inBand(SunCalc.getPosition(d, lat, lon).altitude, min, max);
    if (ok && !prevIn) runStart = d;
    if (!ok && prevIn) out.push({ start: runStart, end: d });
    prevIn = ok;
  }
  if (prevIn) out.push({ start: runStart, end: new Date(winEnd.getTime()) });
  return out;
}

/**
 * 计算指定坐标/日期的摄影天文简报
 * @returns {{sunrise:Date|null, sunset:Date|null,
 *            goldenHours:{start:Date,end:Date}[], blueHours:{start:Date,end:Date}[],
 *            moon:{fraction:number, phaseName:string, emoji:string}}|null}
 */
export function computeShootingBrief({ lat, lon, date = new Date() }) {
  if (!validCoords(lat, lon)) return null;
  const base = new Date(date);
  if (!validDate(base)) return null;

  const dayStart = new Date(base);
  dayStart.setHours(0, 0, 0, 0);
  const winStart = new Date(dayStart.getTime() - 2 * 3600000); // 当日 00:00 前 2h
  const winEnd = new Date(dayStart.getTime() + 26 * 3600000);  // 次日 02:00

  const times = SunCalc.getTimes(base, lat, lon);

  return {
    sunrise: validDate(times.sunrise) ? times.sunrise : null,
    sunset: validDate(times.sunset) ? times.sunset : null,
    goldenHours: collectIntervals(winStart, winEnd, lat, lon, GOLDEN_ALT_MIN, GOLDEN_ALT_MAX),
    blueHours: collectIntervals(winStart, winEnd, lat, lon, BLUE_ALT_MIN, BLUE_ALT_MAX),
    moon: moonPhaseInfo(base),
  };
}
```

- [ ] **Step 1.4: 跑测试确认全绿**

运行：`npx vitest run tests/shooting-brief.test.js`
预期：PASS（若锚定断言差几分钟属正常，容差已设 ±6min）

- [ ] **Step 1.5: 提交**

```bash
git add src/utils/shootingBrief.js tests/shooting-brief.test.js
git commit -m "feat(brief): 拍摄简报天文计算核心（SunCalc 高度角采样切区间，TDD）"
```

---

### Task 2: 胶囊组件 + MapEngine 接线

**Files:**
- Create: `src/components/ShootingBrief.jsx`
- Modify: `src/components/MapEngine.jsx`

- [ ] **Step 2.1: 创建展示组件**

创建 `src/components/ShootingBrief.jsx`：

```jsx
// src/components/ShootingBrief.jsx
// 🌅 今日拍摄简报胶囊 —— 收起时是一枚小圆钮，展开是五要素横条
// 数据来自 utils/shootingBrief.js 纯本地计算，跟随地图中心（1.1km 内缓存）

import { useState, useMemo } from 'react';
import { computeShootingBrief } from '../utils/shootingBrief';

const fmtTime = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '—';

/** 取"当前正在进行或最近一段"，无则取最早段 */
function pickRelevant(intervals) {
  if (!intervals || intervals.length === 0) return null;
  const now = Date.now();
  return intervals.find((i) => i.end.getTime() >= now) || intervals[0];
}

export default function ShootingBrief({ lat, lng }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('earth_terminal_brief_collapsed') === '1'; }
    catch { return false; }
  });

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem('earth_terminal_brief_collapsed', c ? '0' : '1'); }
    catch { /* 隐私模式等场景静默降级 */ }
    return !c;
  });

  const latKey = Math.round(lat * 100) / 100;
  const lngKey = Math.round(lng * 100) / 100;

  const brief = useMemo(() => {
    try {
      return computeShootingBrief({ lat: latKey, lon: lngKey, date: new Date() });
    } catch (e) {
      console.warn('拍摄简报计算失败:', e.message);
      return null;
    }
  }, [latKey, lngKey]);

  if (!brief) return null;

  const gold = pickRelevant(brief.goldenHours);
  const blue = pickRelevant(brief.blueHours);
  const isPolar = brief.sunrise === null && brief.sunset === null;

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        aria-label="展开今日拍摄简报"
        className="absolute top-4 left-1/2 -translate-x-1/2 z-[1500] w-9 h-9 rounded-full bg-zinc-900/85 backdrop-blur-md border border-cyan-500/30 text-lg leading-none hover:border-cyan-400 transition-colors"
      >
        🌅
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-label="今日拍摄简报"
      className="absolute top-14 left-1/2 -translate-x-1/2 z-[1500] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-zinc-900/90 backdrop-blur-md rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-cyan-500/30 px-4 py-2 text-xs font-mono text-cyan-50 whitespace-nowrap"
    >
      {isPolar ? (
        <span title="极地天象">❄️ 极昼或极夜，太阳今天不上班</span>
      ) : (
        <>
          <span title="日出">🌅 {fmtTime(brief.sunrise)}</span>
          <span title="日落">🌇 {fmtTime(brief.sunset)}</span>
          <span title="黄金时刻">✨ {fmtTime(gold?.start)}–{fmtTime(gold?.end)}</span>
          <span title="蓝调时刻">🌌 {fmtTime(blue?.start)}–{fmtTime(blue?.end)}</span>
        </>
      )}
      <span title={`月相：${brief.moon.phaseName}`}>
        {brief.moon.emoji} {Math.round(brief.moon.fraction * 100)}%
      </span>
      <button
        onClick={toggle}
        className="ml-1 text-zinc-400 hover:text-cyan-300 transition-colors"
        aria-label="收起拍摄简报"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2.2: 接入 MapEngine**

修改 `src/components/MapEngine.jsx`：

① 导入区追加：

```jsx
import ShootingBrief from './ShootingBrief';
```

② 组件状态区（`const [baseMapType, setBaseMapType] = useState('topo');` 之前）新增：

```jsx
const [mapView, setMapView] = useState(null); // 🌅 拍摄简报用的地图中心
```

③ 视角深链接 effect 的 `sync()` 内追加一行（共享同一次防抖）：

```jsx
const sync = () => {
    const c = map.getCenter();
    setMapView({ lat: c.lat, lng: c.lng });
    const next = serializeViewHash({ lat: c.lat, lon: c.lng, z: map.getZoom() });
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
};
```

④ 渲染层：在测距 HUD 条件块 `)}` 之后、"呼出战术中枢"按钮之前插入：

```jsx
{mapView && leafletReady && (
    <ShootingBrief lat={mapView.lat} lng={mapView.lng} />
)}
```

- [ ] **Step 2.3: 更新更新说明与版本号**

`CHANGELOG.md` 顶部新增章节（置于 v5.3.0 之前）：

```markdown
## [v5.3.1] - 2026-08-25 · 今日拍摄简报

### ✨ 新功能
- 地图顶部新增可收起的**天文胶囊卡**：实时显示地图中心的日出/日落/
  黄金时刻/蓝调时刻/月相照度，纯本地 SunCalc 计算零网络请求，
  为 PWA 离线包打底；极昼极夜优雅降级
- 附带修复：定位信标的镜头联动在初始化窗口期被 Leaflet 吞动画的问题
  （随上一版深链接一并根治）
```

`package.json` 版本号改为 5.3.1：

```bash
npm pkg set version=5.3.1
```

- [ ] **Step 2.4: 全量验证**

```bash
npx eslint .          # 预期 exit 0
npx vitest run        # 预期 全部 PASS（含新简报测试）
npm run build         # 预期 built in ~9s 无错误
```

- [ ] **Step 2.5: 本地预览冒烟（Chrome）**

```bash
npm run preview   # 后台
```

Chrome 打开 `http://localhost:4173/#lat=35.6812&lon=139.7671&z=13&tab=map`：
- 地图顶部出现 🌅 圆钮 → 点击展开五要素横条
- 数值应与定位面板详情卡一致（日出 05:08 / 日落 18:20 左右）
- 刷新后保持收起/展开状态

- [ ] **Step 2.6: 提交**

```bash
git add src/components/ShootingBrief.jsx src/components/MapEngine.jsx CHANGELOG.md package.json
git commit -m "feat(brief): 地图顶部天文胶囊卡 —— 日出/日落/黄金/蓝调/月相实时简报"
```

---

## 自查记录

- 规格覆盖：R1 内容→Task1；R2 跟随中心→Task2 Step2.2③；R3 收起持久化→Step2.1；
  R4 极端天象→测试极夜用例 + isPolar 文案 ✓
- 无占位符；类型一致性：computeShootingBrief 返回字段与组件读取字段一一对应 ✓
