# 圣地巡礼工作台（次元情报中心 v1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把次元情报中心从"一张跳转链接"升级为圣地巡礼工作台：精选番剧墙 + Bangumi 搜索 → 主题色详情卡 → 圣地点位去重后一键推送进主地图点位库。

**Architecture:** 前端重写 `PilgrimageRadar.jsx`（三段式：发现区/详情区/署名页尾），新增两个薄 serverless 代理 `api/anitabi.js`、`api/bangumi.js`（复用 weather.js 的限流+缓存+CORS 模式），纯函数（映射/去重/ID 构造）抽到 `src/utils/pilgrimageData.js` 走 TDD。点位推送复用 App.jsx 现有 `handlePointsUpdate`（localStorage + POST /api/points 云同步）。

**Tech Stack:** React 19 + Vite 7 + Tailwind 4（无新依赖）；Vercel Serverless；vitest；上游 API：anitabi（免钥，CC BY-NC-SA 4.0）、Bangumi v0 搜索（免钥，需规范 UA）。

**Spec:** `docs/superpowers/specs/2026-09-03-pilgrimage-workbench-design.md`（已定稿，用户已确认）

---

## 执行者须知（零上下文必备）

- 仓库根：`C:\Users\张\Desktop\github仓库\终端`，Windows + Git Bash，分支 `main`。
- 命令：`npm test`（vitest 全量）、`npx vitest run tests/pilgrimage-data.test.js`（单文件）、`npm run lint`（ESLint 必须零错误）、`npm run build`。
- serverless 模式：`api/` 下每个 `.js` 默认导出 `withRateLimit('<preset>')(handler)`；可用预设 `mapbox / general / strict / pointsWrite`（见 `api/rateLimiter.js:16`）。
- 本地网络现实：**api.bgm.tv 从本机不可达**（生产 Vercel 可达），api.anitabi.cn 本地可达。本地全栈调试用 `npm run dev:stack`（vercel dev，端口 3000）；纯 `npm run dev`（端口 5173）没有 `/api` 代理，所有 API 均不可用，属既有架构非本次缺陷。
- 提交纪律：**只 `git add <具体文件>`**，禁止 `git add -A`（工作区有维护者未提交的待办文档）。
- Git Bash 下 git 报 `LF will be replaced by CRLF` 警告属正常，忽略即可。

### 上游 API 已实测契约（2026-09-03 真实探针验证，直接照用，勿凭记忆改）

**`GET https://api.anitabi.cn/bangumi/{id}/lite`** →

```json
{
  "id": 10440,
  "cn": "我们仍未知道那天所看见的花的名字。",
  "title": "あの日見た花の名前を僕達はまだ知らない。",
  "city": "秩父市",
  "cover": "https://image.anitabi.cn/bangumi/10440.jpg?plan=h160",
  "color": "#002aaa",
  "geo": [35.994, 138.99],
  "zoom": 11,
  "modified": 1673007748617,
  "litePoints": [
    { "id": "a4yyy6kt", "cn": "旧秩父桥", "name": "旧秩父橋",
      "image": "https://image.anitabi.cn/user/1000/bangumi/10440/points/a4yyy6kt-1673007748617.jpg?plan=h160",
      "ep": 1, "s": 230, "geo": [36.0187, 139.0863] }
  ],
  "pointsLength": 94, "imagesLength": 93
}
```

**`GET https://api.anitabi.cn/bangumi/{id}/points/detail?haveImage=true`** → 数组：

```json
[{ "id": "a4yyy6kt", "cn": "旧秩父桥", "name": "旧秩父橋",
   "image": "https://image.anitabi.cn/.../a4yyy6kt-....jpg?plan=h160",
   "ep": 1, "s": 230, "geo": [36.0187, 139.0863],
   "origin": "Anitabi@卜卜口", "originURL": "https://anitabi.cn/" }]
```

要点：图片是**绝对 URL 且已带 `?plan=h160`**（换清晰度就替换 plan 参数值，`h360` 用于详情封面）；无数据的 ID 返回 HTTP 404；点位 `id` 是短字符串（`a4yyy6kt`），根级番剧 `id` 是数字。

**`POST https://api.bgm.tv/v0/search/subjects`** body `{"keyword": q, "filter": {"type": [2]}}`（⚠️ `keyword` 单数、`type` 为整数数组 —— 生产源码 bangumi/server handle.go 实证；早期文本误写为 `keywords`+`type:2`，会让每次搜索 400）→ `{ data: [{ id, name, name_cn, date, images: { common, medium, small } }] }`（`?limit=12` 可调单页数量，默认 10、最大 20）。

### 精选名单（8 部，全部实测有效，直接烤进配置）

| bangumiId | 作品 | 城市 | 主题色 | 圣地数 |
|-----------|------|------|--------|--------|
| 328609 | 孤独摇滚！ | 东京都 | #ff428e | 414 |
| 207195 | 摇曳露营△ | 山梨县 | #6a55aa | 684 |
| 262897 | 摇曳露营△ 二期 | 静冈县 | #634e47 | 738 |
| 115908 | 吹响吧！上低音号 | 宇治市 | #02a7bd | 577 |
| 160209 | 你的名字。 | 高山市 | #0080ff | 113 |
| 10440 | 未闻花名 | 秩父市 | #002aaa | 94 |
| 485 | 凉宫春日的忧郁 | 西宫市 | #e7170c | 76 |
| 126461 | 樱子小姐的脚下埋着尸体 | 旭川市 | #b03faf | 67 |

### 文件结构（职责边界）

| 文件 | 动作 | 唯一职责 |
|------|------|----------|
| `tests/pilgrimage-data.test.js` | 新建 | 纯函数行为锚定 |
| `src/utils/pilgrimageData.js` | 新建 | 响应→视图模型映射、去重合并、ID/截断/plan 工具 |
| `api/anitabi.js` | 新建 | anitabi lite/detail 转发 + 缓存 + 限流 |
| `api/bangumi.js` | 新建 | Bangumi 搜索转发 + 压缩 + 限流 |
| `src/config/pilgrimagePicks.js` | 新建 | 精选名单纯配置 |
| `src/components/PilgrimageRadar.jsx` | 重写 | 工作台全部 UI 与交互 |
| `src/App.jsx` | 微改 | 给 PilgrimageRadar 传 `customPoints`/`onPointsUpdate` 两个 props |

**不需要改**：`src/utils/helpers.js` 的 `getIconStyle` 已内置 `anime` 粉色樱花图标映射（`helpers.js:13`），推送的点位 `category: 'anime'` 开箱即用。

---

### Task 1: 纯函数核心 `pilgrimageData.js`（TDD）

**Files:**
- Create: `tests/pilgrimage-data.test.js`
- Create: `src/utils/pilgrimageData.js`

- [ ] **Step 1: 写失败测试**

创建 `tests/pilgrimage-data.test.js`：

```js
import { describe, it, expect } from 'vitest';
import {
  buildPointId,
  truncateName,
  withPlan,
  mapPointCommon,
  mapLiteToViewModel,
  compactSearchResults,
  toCustomPoint,
  mergePilgrimagePoints,
} from '../src/utils/pilgrimageData.js';

const LITE_FIXTURE = {
  id: 10440,
  cn: '我们仍未知道那天所看见的花的名字。',
  title: 'あの日見た花の名前を僕達はまだ知らない。',
  city: '秩父市',
  cover: 'https://image.anitabi.cn/bangumi/10440.jpg?plan=h160',
  color: '#002aaa',
  geo: [35.994, 138.99],
  zoom: 11,
  modified: 1673007748617,
  litePoints: [
    { id: 'a4yyy6kt', cn: '旧秩父桥', name: '旧秩父橋',
      image: 'https://image.anitabi.cn/user/1000/bangumi/10440/points/a4yyy6kt.jpg?plan=h160',
      ep: 1, s: 230, geo: [36.0187, 139.0863] },
  ],
  pointsLength: 94,
  imagesLength: 93,
};

describe('buildPointId / truncateName / withPlan', () => {
  it('点位 ID 格式为 pilg-{番剧ID}-{点位ID}', () => {
    expect(buildPointId(10440, 'a4yyy6kt')).toBe('pilg-10440-a4yyy6kt');
  });

  it('名称 ≤120 原样返回，超长截断且不超上限', () => {
    const short = '旧秩父桥';
    expect(truncateName(short)).toBe(short);
    const long = '聖'.repeat(150);
    const cut = truncateName(long);
    expect(cut.length).toBeLessThanOrEqual(120);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('withPlan 替换既有 plan 参数、补齐缺失场景', () => {
    expect(withPlan('https://x/b.jpg?plan=h160', 'h360')).toBe('https://x/b.jpg?plan=h360');
    expect(withPlan('https://x/b.jpg', 'h360')).toBe('https://x/b.jpg?plan=h360');
    expect(withPlan('https://x/b.jpg?a=1', 'h360')).toBe('https://x/b.jpg?a=1&plan=h360');
    expect(withPlan('', 'h360')).toBe('');
    expect(withPlan(null, 'h360')).toBe(null);
  });
});

describe('mapPointCommon · 巡礼点视图模型', () => {
  it('lite/detail 通用映射：cn 优先、geo 解构、origin 透传', () => {
    const vm = mapPointCommon({
      id: 'a4yyy6kt', cn: '旧秩父桥', name: '旧秩父橋',
      image: 'https://x.jpg?plan=h160', ep: 1, s: 230,
      geo: [36.0187, 139.0863], origin: 'Anitabi@卜卜口', originURL: 'https://anitabi.cn/',
    });
    expect(vm).toEqual({
      id: 'a4yyy6kt', name: '旧秩父桥', nameOriginal: '旧秩父橋',
      image: 'https://x.jpg?plan=h160', ep: 1, s: 230,
      lat: 36.0187, lon: 139.0863,
      origin: 'Anitabi@卜卜口', originURL: 'https://anitabi.cn/',
    });
  });

  it('缺图、缺 ep/s、缺 origin 时给安全兜底值', () => {
    const vm = mapPointCommon({ id: 'p2', cn: '某神社', geo: [1.23, 4.56] });
    expect(vm.image).toBe('');
    expect(vm.ep).toBe(null);
    expect(vm.s).toBe(null);
    expect(vm.origin).toBe('');
    expect(vm.nameOriginal).toBe('');
  });

  it('geo 缺失时 lat/lon 为 null（推送层会过滤）', () => {
    const vm = mapPointCommon({ id: 'p3', cn: '无名点' });
    expect(vm.lat).toBe(null);
    expect(vm.lon).toBe(null);
  });
});

describe('mapLiteToViewModel · 番剧详情视图模型', () => {
  it('完整字段映射与 h360 封面升级', () => {
    const vm = mapLiteToViewModel(LITE_FIXTURE);
    expect(vm.id).toBe(10440);
    expect(vm.titleCn).toBe('我们仍未知道那天所看见的花的名字。');
    expect(vm.titleOriginal).toBe('あの日見た花の名前を僕達はまだ知らない。');
    expect(vm.city).toBe('秩父市');
    expect(vm.cover).toBe('https://image.anitabi.cn/bangumi/10440.jpg?plan=h360');
    expect(vm.color).toBe('#002aaa');
    expect(vm.pointsLength).toBe(94);
    expect(vm.mapUrl).toBe('https://anitabi.cn/map?bangumiId=10440');
    expect(vm.points).toHaveLength(1);
    expect(vm.points[0].name).toBe('旧秩父桥');
  });

  it('color 非法/缺失回退项目粉 #ec4899；cn 缺失回退 title', () => {
    expect(mapLiteToViewModel({ ...LITE_FIXTURE, color: 'javascript:alert(1)' }).color).toBe('#ec4899');
    expect(mapLiteToViewModel({ ...LITE_FIXTURE, color: undefined }).color).toBe('#ec4899');
    const noCn = mapLiteToViewModel({ ...LITE_FIXTURE, cn: '' });
    expect(noCn.titleCn).toBe(LITE_FIXTURE.title);
  });
});

describe('compactSearchResults · Bangumi 搜索压缩', () => {
  it('取前 12 条，压缩为卡片所需字段，date 截取年份', () => {
    const raw = { data: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1, name: `けいおん!${i}`, name_cn: `轻音少女${i}`,
      date: '2009-04-02', images: { common: `https://lain.bgm.tv/pic/cover/c/${i}.jpg` },
    })) };
    const list = compactSearchResults(raw);
    expect(list).toHaveLength(12);
    expect(list[0]).toEqual({
      id: 1, titleCn: '轻音少女0', titleOriginal: 'けいおん!0',
      date: '2009', cover: 'https://lain.bgm.tv/pic/cover/c/0.jpg',
    });
  });

  it('name_cn 缺失回退 name；data 缺失返回空数组', () => {
    const list = compactSearchResults({ data: [{ id: 9, name: 'らき☆すた', date: null, images: {} }] });
    expect(list[0].titleCn).toBe('らき☆すた');
    expect(list[0].date).toBe('');
    expect(list[0].cover).toBe('');
    expect(compactSearchResults(null)).toEqual([]);
  });
});

describe('toCustomPoint / mergePilgrimagePoints · 推送与去重', () => {
  const pt = (id, name, lat, lon) => ({ id, name, nameOriginal: '', image: '', ep: 1, s: 1, lat, lon, origin: '', originURL: '' });

  it('toCustomPoint 映射到服务端硬校验 schema（category=anime, source=anitabi）', () => {
    const p = toCustomPoint(10440, pt('a4yyy6kt', '旧秩父桥', 36.0187, 139.0863));
    expect(p).toEqual({ id: 'pilg-10440-a4yyy6kt', name: '旧秩父桥', lat: 36.0187, lon: 139.0863, category: 'anime', source: 'anitabi' });
  });

  it('全新点位全部增量合并，计数正确', () => {
    const { merged, added, skipped } = mergePilgrimagePoints([], [pt('p1', 'A', 1, 1), pt('p2', 'B', 2, 2)]);
    expect(merged).toHaveLength(2);
    expect(added).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it('生成 ID 已存在 → 跳过（重复推送同一番剧）', () => {
    const existing = [toCustomPoint(10440, pt('a4yyy6kt', '旧秩父桥', 36.0187, 139.0863))];
    const incoming = [pt('a4yyy6kt', '旧秩父桥', 36.0187, 139.0863)];
    const { merged, added, skipped } = mergePilgrimagePoints(existing, incoming.map(p => toCustomPoint(10440, p)));
    expect(merged).toHaveLength(1);
    expect(added).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('同名同源坐标差 <1e-4 跳过；恰好 ≥1e-4 视为不同点', () => {
    const existing = [{ id: 'pilg-1-x', name: '神社', lat: 35.00001, lon: 139.00001, category: 'anime', source: 'anitabi' }];
    const inside = mergePilgrimagePoints(existing, [pt('new1', '神社', 35.000015, 139.000015)]);
    expect(inside.added).toHaveLength(0);
    const outside = mergePilgrimagePoints(existing, [pt('new2', '神社', 35.00011, 139.00001)]);
    expect(outside.added).toHaveLength(1);
  });

  it('非 anitabi 来源的同名同坐标点位不参与去重', () => {
    const existing = [{ id: 'user-1', name: '神社', lat: 35.0, lon: 139.0, category: 'spot', source: '' }];
    const { added } = mergePilgrimagePoints(existing, [pt('new3', '神社', 35.0, 139.0)]);
    expect(added).toHaveLength(1);
  });

  it('坐标非法（null/NaN）直接跳过不入库', () => {
    const { added, skipped } = mergePilgrimagePoints([], [pt('p9', '坏点', null, 139.0), pt('p10', '坏点2', Number.NaN, 1)]);
    expect(added).toHaveLength(0);
    expect(skipped).toBe(2);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/pilgrimage-data.test.js`
Expected: FAIL —— `Failed to resolve import "../src/utils/pilgrimageData.js"`（模块尚不存在）

- [ ] **Step 3: 实现 `src/utils/pilgrimageData.js`**

```js
// 圣地巡礼工作台 · 纯函数层
// 上游契约见 docs/superpowers/specs/2026-09-03-pilgrimage-workbench-design.md §执行者须知
// 职责：anitabi/Bangumi 响应 → 视图模型；推送点位构造与去重合并。无副作用、无网络。

const DEFAULT_COLOR = '#ec4899'; // 项目粉色（次元情报中心主题色）
const MAX_NAME_LEN = 120;        // 与 api/validation.js 的 MAX_NAME_LEN 对齐
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** 推送点位 ID：pilg-{番剧ID}-{点位ID}（服务端上限 64 字符，实测最长约 30） */
export const buildPointId = (bangumiId, pointId) => `pilg-${bangumiId}-${pointId}`;

/** 名称超长截断（服务端 400 硬校验是 name≤120，宁可截断也不让整批推送失败） */
export const truncateName = (name, max = MAX_NAME_LEN) =>
  name.length <= max ? name : `${name.slice(0, max - 1)}…`;

/**
 * anitabi 图片 URL 已带 ?plan=h160；这里替换或补齐为所需规格
 * （h160 列表缩略图 / h360 详情封面，全尺寸被官方劝退）
 */
export function withPlan(url, plan = 'h160') {
  if (!url) return url;
  if (/[?&]plan=/.test(url)) return url.replace(/([?&])plan=[^&]*/, `$1plan=${plan}`);
  return url.includes('?') ? `${url}&plan=${plan}` : `${url}?plan=${plan}`;
}

/** lite 与 points/detail 的点位通用映射（两者字段一致：id/cn/name/image/ep/s/geo/origin） */
export function mapPointCommon(p) {
  const geo = Array.isArray(p?.geo) ? p.geo : null;
  return {
    id: String(p?.id ?? ''),
    name: p?.cn || p?.name || '未命名圣地',
    nameOriginal: p?.name && p.name !== p?.cn ? p.name : '',
    image: p?.image || '',
    ep: p?.ep ?? null,
    s: p?.s ?? null,
    lat: geo ? geo[0] : null,
    lon: geo ? geo[1] : null,
    origin: p?.origin || '',
    originURL: p?.originURL || '',
  };
}

/** lite 响应 → 详情卡视图模型（缺字段全部兜底，绝不让 UI 崩） */
export function mapLiteToViewModel(lite) {
  const id = lite?.id;
  return {
    id,
    titleCn: lite?.cn || lite?.title || '未知作品',
    titleOriginal: lite?.title && lite.title !== lite?.cn ? lite.title : '',
    city: lite?.city || '',
    cover: withPlan(lite?.cover, 'h360'),
    color: COLOR_RE.test(lite?.color || '') ? lite.color : DEFAULT_COLOR,
    pointsLength: lite?.pointsLength ?? lite?.litePoints?.length ?? 0,
    imagesLength: lite?.imagesLength ?? 0,
    mapUrl: id ? `https://anitabi.cn/map?bangumiId=${id}` : 'https://anitabi.cn/map',
    points: (lite?.litePoints || []).map(mapPointCommon),
  };
}

/** Bangumi 搜索原始响应 → 前端卡片所需的压缩列表（最多 12 条） */
export function compactSearchResults(raw) {
  return (raw?.data || []).slice(0, 12).map((s) => ({
    id: s.id,
    titleCn: s.name_cn || s.name || '未知作品',
    titleOriginal: s.name && s.name !== s.name_cn ? s.name : '',
    date: s.date ? String(s.date).slice(0, 4) : '',
    cover: s.images?.common || s.images?.medium || s.images?.small || '',
  }));
}

/** 视图模型点位 → 服务端硬校验 schema（api/validation.js：id≤64 name≤120 category≤32 source≤32） */
export const toCustomPoint = (bangumiId, pt) => ({
  id: buildPointId(bangumiId, pt.id),
  name: truncateName(pt.name),
  lat: pt.lat,
  lon: pt.lon,
  category: 'anime',
  source: 'anitabi',
});

/**
 * 去重合并（幂等：重复推送同一番剧不会产生脏数据）
 * 跳过条件：坐标非法 | 生成 ID 已存在 | anitabi 来源且同名且坐标差 <1e-4（约 11 米）
 * @returns {{ merged: Array, added: Array, skipped: number }}
 */
export function mergePilgrimagePoints(existingPoints, incomingPoints) {
  const existingIds = new Set(existingPoints.map((p) => p.id));
  const anitabiExisting = existingPoints.filter((p) => p.source === 'anitabi');
  const added = [];
  let skipped = 0;

  for (const pt of incomingPoints) {
    const badCoord =
      pt.lat === null || pt.lon === null || Number.isNaN(pt.lat) || Number.isNaN(pt.lon);
    if (badCoord || existingIds.has(pt.id)) {
      skipped += 1;
      continue;
    }
    const dup = anitabiExisting.some(
      (e) => e.name === pt.name && Math.abs(e.lat - pt.lat) < 1e-4 && Math.abs(e.lon - pt.lon) < 1e-4,
    );
    if (dup) {
      skipped += 1;
      continue;
    }
    added.push(pt);
  }
  return { merged: [...existingPoints, ...added], added, skipped };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/pilgrimage-data.test.js`
Expected: PASS，全部用例绿

- [ ] **Step 5: lint + 提交**

Run: `npm run lint`
Expected: 零错误

```bash
git add src/utils/pilgrimageData.js tests/pilgrimage-data.test.js
git commit -m "feat(pilgrimage): 巡礼纯函数层 —— 视图模型映射/去重合并/推送ID（TDD）"
```

---

### Task 2: serverless 代理 `api/anitabi.js`

**Files:**
- Create: `api/anitabi.js`

- [ ] **Step 1: 实现代理**

创建 `api/anitabi.js`：

```js
// api/anitabi.js
// anitabi 圣地巡礼数据代理（免钥上游，CC BY-NC-SA 4.0 —— 署名条在前端 PilgrimageRadar 页尾）
// 为什么走代理：不赌上游 CORS 策略；边缘缓存 24h 吸收重复请求；限流防刷。

import { withRateLimit } from './rateLimiter.js';

const UPSTREAM = 'https://api.anitabi.cn';
const UA = 'EarthTerminal/5.3.1 (https://github.com/IOPQWE51/webgis-railway-terminal)';

async function handleAnitabi(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 巡礼数据低频变动：生产 24h 边缘缓存 + 7 天 SWR
  const isProduction = process.env.VERCEL_ENV === 'production';
  res.setHeader('Cache-Control', isProduction
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'no-cache');

  const { type, id } = req.query;
  const numericId = Number(id);
  if ((type !== 'bangumi' && type !== 'points') || !Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ error: '参数非法：type 须为 bangumi|points，id 须为正整数' });
  }

  const upstreamUrl = type === 'bangumi'
    ? `${UPSTREAM}/bangumi/${numericId}/lite`
    : `${UPSTREAM}/bangumi/${numericId}/points/detail?haveImage=true`;

  try {
    const upstream = await fetch(upstreamUrl, { headers: { 'User-Agent': UA } });
    if (upstream.status === 404) {
      // 该番剧在 anitabi 无巡礼地图（前端渲染"暂无巡礼数据"空态）
      return res.status(404).json({ error: '该作品暂无巡礼数据' });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: 'anitabi 上游服务异常' });
    }
    return res.status(200).json(await upstream.json());
  } catch {
    return res.status(502).json({ error: 'anitabi 上游连接失败' });
  }
}

// 🛡️ 限流：与 weather/elevation 同级（60 次/分钟/IP），边缘缓存先行吸收
export default withRateLimit('general')(handleAnitabi);
```

- [ ] **Step 2: lint + 提交**

Run: `npm run lint`
Expected: 零错误

```bash
git add api/anitabi.js
git commit -m "feat(api): anitabi 巡礼数据代理 —— lite/全量点位转发 + 24h 边缘缓存 + 限流"
```

---

### Task 3: serverless 代理 `api/bangumi.js`

**Files:**
- Create: `api/bangumi.js`

- [ ] **Step 1: 实现搜索代理**

创建 `api/bangumi.js`：

```js
// api/bangumi.js
// Bangumi 番剧搜索代理（免钥上游；规范 User-Agent 是 bgm.tv API 的礼仪硬要求）
// 注意：api.bgm.tv 在部分国内网络不可达，本地 dev 报"上游连接失败"属预期，生产 Vercel 正常。

import { withRateLimit } from './rateLimiter.js';
import { compactSearchResults } from '../src/utils/pilgrimageData.js';

const UA = 'EarthTerminal/5.3.1 (https://github.com/IOPQWE51/webgis-railway-terminal)';

async function handleBangumiSearch(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 同一关键词 1 小时边缘缓存（番剧搜索结果基本不变）
  const isProduction = process.env.VERCEL_ENV === 'production';
  res.setHeader('Cache-Control', isProduction
    ? 'public, s-maxage=3600, stale-while-revalidate=86400'
    : 'no-cache');

  const q = String(req.query.q || '').trim();
  if (q.length < 1 || q.length > 60) {
    return res.status(400).json({ error: '参数非法：q 须为 1~60 字符的关键词' });
  }

  try {
    const upstream = await fetch('https://api.bgm.tv/v0/search/subjects?limit=12', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ keyword: q, filter: { type: [2] } }), // 契约：keyword 单数 + type 整数数组（生产源码实证）；limit=12 对齐前端卡片上限
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Bangumi 上游服务异常' });
    }
    // 极限瘦身：原始响应数百 KB → 12 张卡片所需字段
    const raw = await upstream.json();
    return res.status(200).json({ list: compactSearchResults(raw) });
  } catch {
    return res.status(502).json({ error: 'Bangumi 上游连接失败（本地网络可能无法访问 bgm.tv，生产环境正常）' });
  }
}

// 🛡️ 限流：搜索比 lite 略贵，仍是 general 档（60 次/分钟/IP）
export default withRateLimit('general')(handleBangumiSearch);
```

- [ ] **Step 2: lint + 提交**

Run: `npm run lint`
Expected: 零错误（若 eslint 对 serverless 导入 src/ 报 import 路径类规则，运行 `npx eslint api/bangumi.js` 看具体规则再处理；项目 eslint.config.js 允许 api/ 内既有相对导入，此路径属同仓库模块，不应触发规则）

```bash
git add api/bangumi.js
git commit -m "feat(api): Bangumi 番剧搜索代理 —— type=2 动画过滤 + 12 条压缩 + 1h 缓存"
```

---

### Task 4: 精选名单配置

**Files:**
- Create: `src/config/pilgrimagePicks.js`

- [ ] **Step 1: 写入实测通过的名单**

创建 `src/config/pilgrimagePicks.js`：

```js
// 精选巡礼番剧名单 —— 纯配置，无运行时依赖
// 全部 bangumiId 已于 2026-09-03 通过 GET api.anitabi.cn/bangumi/{id}/lite 实测验证
//（lite 返回 200 且 litePoints 非空）；points 数为当日巡礼点总量。
// 展示名取 anitabi cn 字段；新增作品前先跑一次 lite 验证再收录。
export const PILGRIMAGE_PICKS = [
  { id: 328609, name: '孤独摇滚！', city: '东京都', color: '#ff428e', points: 414 },
  { id: 207195, name: '摇曳露营△', city: '山梨县', color: '#6a55aa', points: 684 },
  { id: 262897, name: '摇曳露营△ 二期', city: '静冈县', color: '#634e47', points: 738 },
  { id: 115908, name: '吹响吧！上低音号', city: '宇治市', color: '#02a7bd', points: 577 },
  { id: 160209, name: '你的名字。', city: '高山市', color: '#0080ff', points: 113 },
  { id: 10440, name: '未闻花名', city: '秩父市', color: '#002aaa', points: 94 },
  { id: 485, name: '凉宫春日的忧郁', city: '西宫市', color: '#e7170c', points: 76 },
  { id: 126461, name: '樱子小姐的脚下埋着尸体', city: '旭川市', color: '#b03faf', points: 67 },
];
```

- [ ] **Step 2: lint + 提交**

Run: `npm run lint`（Expected: 零错误）

```bash
git add src/config/pilgrimagePicks.js
git commit -m "feat(config): 精选巡礼番剧名单 —— 8 部实测有效的 anitabi 高热度作品"
```

---

### Task 5: 重写 `PilgrimageRadar.jsx` 工作台 + App 接线

**Files:**
- Rewrite: `src/components/PilgrimageRadar.jsx`（全量替换）
- Modify: `src/App.jsx`（一处：传 props）

- [ ] **Step 1: 全量替换组件**

> **⚠️ 执行修订注记**（规格审查发现计划参考代码的缺陷，以修订为准，已落盘于实现）：
> 1. UPSTREAM 错误卡的"重试"按钮引用 `selected?.id`，但进入错误态时 `selected` 已被置 null → 死按钮。已改为 `lastOpenedId` state 记录最近请求 id。
> 2. `openDetail`/`loadAllPoints` 增加请求序号守卫（`openSeqRef`），丢弃过期响应，防慢请求覆盖新视图；`openDetail` 重置时补 `setLoadingMore(false)`。
> 3. `handleSearch` 增加 `searching` 守卫，Enter 键不再绕过防重复。
> 4. 计划文本原稿中圣地行的 `S{s}` 为笔误（变量是 `p`），实现为 `S{p.s}`。
> 组件顶部的 state 区相应新增 `openSeqRef` 与 `lastOpenedId`，import 增加 `useRef`。

用以下内容**整体替换** `src/components/PilgrimageRadar.jsx`：

```jsx
import { useEffect, useState } from 'react';
import {
  Camera, ExternalLink, HeartHandshake, MapPin, Search,
  ArrowLeft, Send, Layers, Loader2, AlertTriangle,
} from 'lucide-react';
import { PILGRIMAGE_PICKS } from '../config/pilgrimagePicks';
import {
  mapLiteToViewModel,
  mapPointCommon,
  mergePilgrimagePoints,
  toCustomPoint,
} from '../utils/pilgrimageData';

// ===== 数据访问（全走自家代理，见 api/anitabi.js / api/bangumi.js）=====
async function fetchLite(id) {
    const res = await fetch(`/api/anitabi?type=bangumi&id=${id}`);
    if (res.status === 404) throw new Error('NO_DATA');
    if (!res.ok) throw new Error('UPSTREAM');
    return mapLiteToViewModel(await res.json());
}

async function fetchAllPoints(id) {
    const res = await fetch(`/api/anitabi?type=points&id=${id}`);
    if (!res.ok) throw new Error('UPSTREAM');
    const raw = await res.json();
    return (Array.isArray(raw) ? raw : []).map(mapPointCommon);
}

async function searchBangumi(q) {
    const res = await fetch(`/api/bangumi?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('SEARCH_FAIL');
    const json = await res.json();
    return json.list || [];
}

const PilgrimageRadar = ({ isActive, customPoints = [], onPointsUpdate }) => {
    const [view, setView] = useState('discover'); // discover | detail
    const [selected, setSelected] = useState(null); // 详情卡视图模型
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null); // null | 'NO_DATA' | 'UPSTREAM'

    const [pickCovers, setPickCovers] = useState({}); // { [id]: { cover, color } }
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null | []
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);

    const [allPoints, setAllPoints] = useState(null); // null=前10 | 数组=已加载全量
    const [loadingMore, setLoadingMore] = useState(false);
    const [pushFeedback, setPushFeedback] = useState(null); // { added, skipped }

    // 精选墙封面预热（各自独立失败不互相拖垮；生产命中边缘缓存）
    useEffect(() => {
        PILGRIMAGE_PICKS.forEach((p) => {
            fetchLite(p.id)
                .then((vm) => setPickCovers((prev) => ({ ...prev, [p.id]: { cover: vm.cover, color: vm.color } })))
                .catch(() => {});
        });
    }, []);

    const openDetail = async (id) => {
        setView('detail');
        setDetailLoading(true);
        setDetailError(null);
        setAllPoints(null);
        setPushFeedback(null);
        setSearchResults(null);
        try {
            setSelected(await fetchLite(id));
        } catch (e) {
            setSelected(null);
            setDetailError(e.message === 'NO_DATA' ? 'NO_DATA' : 'UPSTREAM');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleSearch = async () => {
        const q = searchQuery.trim();
        if (!q) return;
        setSearching(true);
        setSearchError(false);
        try {
            setSearchResults(await searchBangumi(q));
        } catch {
            setSearchResults(null);
            setSearchError(true);
        } finally {
            setSearching(false);
        }
    };

    const loadAllPoints = async () => {
        if (!selected || loadingMore) return;
        setLoadingMore(true);
        try {
            setAllPoints(await fetchAllPoints(selected.id));
        } catch {
            // 全量加载失败保持前 10 展示，不打断
        } finally {
            setLoadingMore(false);
        }
    };

    // 执行变更注：Task 1 质量审查发现精选总量 2763 > 服务端 MAX_POINTS=2000
    //（api/validation.js 整库硬上限），故推送层增加容量守卫，超限部分计入反馈。
    const MAX_POINTS = 2000; // 与 api/validation.js 的 MAX_POINTS 对齐（整库硬上限）

    const pushPoints = (vmPoints) => {
        if (!selected || !onPointsUpdate) return;
        const incoming = vmPoints
            .filter((p) => p.lat !== null && p.lon !== null)
            .map((p) => toCustomPoint(selected.id, p));
        const capacity = Math.max(0, MAX_POINTS - customPoints.length);
        const capped = incoming.slice(0, capacity);
        const { merged, added, skipped } = mergePilgrimagePoints(customPoints, capped);
        if (added.length > 0) onPointsUpdate(merged);
        setPushFeedback({
            added: added.length,
            skipped,
            capped: incoming.length - capped.length,
        });
    };

    const displayedPoints = allPoints || selected?.points || [];

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            <div className="bg-white border border-gray-200 rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden">

                {/* ===== 标题栏 ===== */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <Camera className="w-6 h-6 mr-2 text-pink-500" />
                            次元边界：圣地巡礼工作台
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Anime Pilgrimage Workbench</p>
                    </div>
                    {view === 'detail' && (
                        <button
                            onClick={() => { setView('discover'); setSelected(null); setSearchResults(null); }}
                            className="flex items-center text-sm font-bold text-gray-600 hover:text-pink-600 transition-colors active:scale-95"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" /> 返回发现区
                        </button>
                    )}
                </div>

                {view === 'discover' && (
                    <>
                        {/* ===== 搜索 ===== */}
                        <div className="flex gap-2 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="搜索番剧名（如：孤独摇滚、摇曳露营）"
                                    className="w-full pl-9 pr-3 py-2.5 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={searching || !searchQuery.trim()}
                                className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold px-5 rounded-xl shadow-md transition-all active:scale-95 flex items-center"
                            >
                                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : '检索'}
                            </button>
                        </div>

                        {searchError && (
                            <div className="mb-6 flex items-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                                搜索服务暂时不可用（本地网络可能无法访问 Bangumi，部署到 Vercel 后正常），请稍后重试。
                            </div>
                        )}
                        {searchResults && searchResults.length === 0 && (
                            <div className="mb-6 text-sm text-gray-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                没有找到相关动画条目，换个关键词试试。
                            </div>
                        )}
                        {searchResults && searchResults.length > 0 && (
                            <div className="mb-8">
                                <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">Search Results</p>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {searchResults.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => openDetail(s.id)}
                                            className="shrink-0 w-32 text-left group"
                                        >
                                            <div className="w-32 h-44 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:border-pink-300 group-hover:shadow-lg transition-all bg-slate-100">
                                                {s.cover ? (
                                                    <img src={s.cover} alt={s.titleCn} loading="lazy" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-3xl">🌸</div>
                                                )}
                                            </div>
                                            <p className="mt-1.5 text-xs font-bold text-gray-800 truncate">{s.titleCn}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">{s.date} · {s.titleOriginal || '动画'}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ===== 精选番剧墙 ===== */}
                        <div className="mb-8">
                            <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">Featured Pilgrimage · 精选巡礼</p>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {PILGRIMAGE_PICKS.map((p) => {
                                    const meta = pickCovers[p.id];
                                    return (
                                        <button key={p.id} onClick={() => openDetail(p.id)} className="shrink-0 w-40 text-left group">
                                            <div
                                                className="w-40 h-56 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:border-pink-300 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all"
                                                style={!meta ? { background: `linear-gradient(135deg, ${p.color}22, ${p.color}55)` } : undefined}
                                            >
                                                {meta?.cover ? (
                                                    <img src={meta.cover} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                        <Camera className="w-8 h-8 opacity-40" style={{ color: p.color }} />
                                                        <span className="text-[10px] font-bold text-gray-500">巡礼加载中…</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1.5 text-sm font-black text-gray-900 truncate">{p.name}</p>
                                            <p className="text-[10px] text-gray-500 font-bold flex items-center">
                                                <MapPin className="w-3 h-3 mr-0.5 text-pink-500" />{p.city} · {p.points} 圣地
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {view === 'detail' && (
                    <>
                        {detailLoading && (
                            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin text-pink-400 mb-3" />
                                <p className="text-sm font-bold">正在跨越次元边界…</p>
                            </div>
                        )}

                        {!detailLoading && detailError === 'NO_DATA' && (
                            <div className="py-12 text-center border border-dashed border-slate-300 rounded-2xl mb-6">
                                <p className="text-4xl mb-3">🗺️</p>
                                <p className="font-bold text-gray-700 mb-1">该作品暂无巡礼数据</p>
                                <p className="text-xs text-gray-400 mb-4">anitabi 还没有收录这部作品的圣地坐标</p>
                                <a href="https://anitabi.cn/map" target="_blank" rel="noreferrer"
                                    className="inline-flex items-center text-sm font-bold text-pink-600 hover:text-pink-700">
                                    去 anitabi 官方地图看看 <ExternalLink className="w-3.5 h-3.5 ml-1" />
                                </a>
                            </div>
                        )}

                        {!detailLoading && detailError === 'UPSTREAM' && (
                            <div className="py-12 text-center border border-dashed border-red-200 bg-red-50/50 rounded-2xl mb-6">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
                                <p className="font-bold text-gray-700 mb-4">巡礼数据加载失败</p>
                                <button
                                    onClick={() => selected?.id ? openDetail(selected.id) : null}
                                    className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold py-2 px-5 rounded-xl transition-all active:scale-95"
                                >
                                    重试
                                </button>
                            </div>
                        )}

                        {!detailLoading && selected && (
                            <>
                                {/* ===== 番剧头卡（主题色渐变） ===== */}
                                <div className="relative rounded-2xl overflow-hidden border border-slate-200 mb-5">
                                    <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${selected.color}26, transparent 60%)` }} />
                                    <div className="relative flex gap-4 p-4">
                                        <div className="shrink-0 w-28 h-40 rounded-xl overflow-hidden shadow-md bg-slate-100">
                                            {selected.cover ? (
                                                <img src={selected.cover} alt={selected.titleCn} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl">🌸</div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1 py-1">
                                            <h4 className="font-black text-lg text-gray-900 leading-snug">{selected.titleCn}</h4>
                                            {selected.titleOriginal && <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{selected.titleOriginal}</p>}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {selected.city && (
                                                    <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-lg flex items-center">
                                                        <MapPin className="w-3 h-3 mr-1" />{selected.city}
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                    📍 {selected.pointsLength} 巡礼点
                                                </span>
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                    🖼️ {selected.imagesLength} 截图
                                                </span>
                                            </div>
                                            <a href={selected.mapUrl} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center mt-3 text-xs font-bold text-gray-500 hover:text-pink-600 transition-colors">
                                                anitabi 官方巡礼地图 <ExternalLink className="w-3 h-3 ml-1" />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${selected.color}, ${selected.color}44)` }} />
                                </div>

                                {/* ===== 推送控制条 ===== */}
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">
                                        Sacred Spots · 已加载 {displayedPoints.length} / {selected.pointsLength}
                                    </p>
                                    <button
                                        onClick={() => pushPoints(displayedPoints)}
                                        className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold py-2 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center"
                                    >
                                        <Send className="w-4 h-4 mr-1.5" /> 全部推送到战术地图
                                    </button>
                                </div>

                                {pushFeedback && (
                                    <div className="mb-4 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                        ✅ 已推送 {pushFeedback.added} 个圣地到点位库{pushFeedback.skipped > 0 ? `，跳过 ${pushFeedback.skipped} 个重复` : ''}{pushFeedback.capped > 0 ? `；点位库已达 2000 上限，${pushFeedback.capped} 个未推送` : ''}。切换到「战术地图」页即可查看。
                                    </div>
                                )}

                                {/* ===== 圣地列表 ===== */}
                                <div className="space-y-2.5 mb-5">
                                    {displayedPoints.map((p) => (
                                        <div key={p.id} className="flex items-center gap-3 bg-slate-50 hover:bg-pink-50/50 border border-slate-200 hover:border-pink-200 rounded-xl px-3 py-2.5 transition-colors">
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} loading="lazy" className="shrink-0 w-14 h-14 rounded-lg object-cover border border-slate-200" />
                                            ) : (
                                                <div className="shrink-0 w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">🌸</div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                                                <p className="text-[11px] text-gray-500 font-medium truncate">
                                                    {p.nameOriginal && <span className="mr-1.5">{p.nameOriginal}</span>}
                                                    {p.ep !== null && <span className="mr-1.5 text-pink-600 font-bold">EP{p.ep}</span>}
                                                    {p.s !== null && <span className="mr-1.5 text-pink-600 font-bold">S{s}</span>}
                                                    <span className="font-mono">{p.lat?.toFixed(4)}, {p.lon?.toFixed(4)}</span>
                                                    {p.origin && (
                                                        <> · 截图 <a href={p.originURL || 'https://anitabi.cn/'} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-pink-600">{p.origin}</a></>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => pushPoints([p])}
                                                className="shrink-0 text-xs font-bold text-pink-600 bg-pink-100 hover:bg-pink-500 hover:text-white px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center"
                                            >
                                                <Send className="w-3 h-3 mr-1" />推送
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {allPoints === null && selected.pointsLength > selected.points.length && (
                                    <button
                                        onClick={loadAllPoints}
                                        disabled={loadingMore}
                                        className="w-full py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.99] flex items-center justify-center"
                                    >
                                        {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Layers className="w-4 h-4 mr-1.5" />}
                                        查看全部 {selected.pointsLength} 个圣地
                                    </button>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ===== 巡礼生存法则 ===== */}
                <div className="border-t border-gray-100 pt-6 mt-8">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                        <HeartHandshake className="w-4 h-4 mr-2 text-rose-500" />
                        次元交汇法则 (巡礼潜规则)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-pink-200 transition-colors">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs mr-2">禁忌</span>
                                <span className="font-bold text-gray-900 text-sm">校园与住宅区的结界</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                绝大部分校园背景**禁止外部人员入内**。上课期间严禁在校门外徘徊拍照（极易被报警）。在住宅区取景时，请保持绝对安静，**绝对不可将相机镜头对准私人住宅的窗户或当地居民**。
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-pink-200 transition-colors">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs mr-2">守则</span>
                                <span className="font-bold text-gray-900 text-sm">微小的在地回馈</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                如果巡礼点在当地的神社、商店或自动贩卖机附近，尽可能在当地**消费一点点**（买瓶水、投个赛钱、买个护身符）。这能极大地改善当地居民对阿宅群体的包容度，保护圣地不被封闭。
                            </p>
                        </div>
                    </div>
                </div>

                {/* ===== 署名条（CC BY-NC-SA 4.0 许可证义务） ===== */}
                <p className="mt-6 pt-4 border-t border-gray-100 text-[11px] text-gray-400 font-medium">
                    圣地点位与截图数据 ©{' '}
                    <a href="https://www.anitabi.cn/" target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-pink-500">anitabi.cn 巡礼之途</a>
                    {' '}· CC BY-NC-SA 4.0
                </p>
            </div>
        </div>
    );
};

export default PilgrimageRadar;
```

- [ ] **Step 2: App.jsx 接线（唯一一处修改）**

`src/App.jsx` 中找到（约 267 行，sub-culture 分支内）：

```jsx
                <PilgrimageRadar isActive={true} />
```

替换为：

```jsx
                <PilgrimageRadar isActive={true} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} />
```

- [ ] **Step 3: lint + 全量测试 + 构建**

Run: `npm run lint && npm test && npm run build`
Expected: lint 零错误；vitest 全绿（含 Task 1 的 pilgrimage-data 套件）；vite build 成功

- [ ] **Step 4: 本地手动验收（best-effort）**

Run: `npm run dev:stack`（vercel dev，端口 3000；需要 .vercel 项目链接，仓库已有）
浏览器打开 `http://localhost:3000` → 次元情报中心 Tab，核对：

1. 精选墙 8 张卡出现封面（或颜色占位），点击"孤独摇滚！"进入详情卡，主题色为 `#ff428e` 粉
2. 详情卡显示"东京都 · 414 巡礼点"，前 10 圣地带缩略图
3. 点 [全部推送到战术地图] → 绿色反馈条"已推送 10 个"；再点一次 → "跳过 10 个重复"
4. 战术地图页点位列表出现"旧秩父桥"式樱花🌸点位（ anime 图标来自 helpers.js 既有映射）
5. 搜索框输入任意关键词 → 本地预期报"搜索服务暂时不可用"（bgm.tv 本地不可达，生产正常），不白屏

若 `npm run dev:stack` 因环境（vercel 登录/链接）无法启动，跳过本步并在交接说明中注明，交付后由用户在部署环境验收。

- [ ] **Step 5: 提交**

```bash
git add src/components/PilgrimageRadar.jsx src/App.jsx
git commit -m "feat(pilgrimage): 圣地巡礼工作台 —— 精选墙+搜索+主题色详情卡+一键推送点位库"
```

---

### Task 6: 全量回归与收尾

- [ ] **Step 1: 三件套全绿**

Run: `npm run lint && npm test && npm run build`
Expected: 全部通过；build 输出中主包体积无异常增长（新增均为按需挂载组件代码，约 +10KB 源码量级）

- [ ] **Step 2: 交接说明**

向用户报告：
1. 功能清单与使用路径（次元情报中心 → 精选/搜索 → 详情 → 推送 → 战术地图）
2. 本地网络限制说明：搜索仅在 Vercel 生产可用；精选墙/详情/推送本地全流程可用（`npm run dev:stack`）
3. 部署后生产验收清单：`https://<生产域>/api/anitabi?type=bangumi&id=328609` 返回 lite JSON；搜索"孤独摇滚"返回结果；推送后刷新页面点位仍在（云同步）
4. 后续可选迭代（v2 预留）：巡礼路线规划、单点拍摄简报注入、推送后跨 Tab 自动跳转

---

## Self-Review 记录

1. **Spec 覆盖**：§4 两个代理 → Task 2/3；§5 前端三段式+精选+搜索+主题色 → Task 4/5；§6 推送去重 → Task 1/5（`mergePilgrimagePoints` + `toCustomPoint`）；§7 错误态+署名 → Task 5（NO_DATA/UPSTREAM/搜索错误三态 + 署名条 + 截图 origin 标注，后者为对 CC 许可的加强，超出 spec 处已注明）；§8 测试 → Task 1；§9 验收 → Task 5 Step 4 / Task 6。
2. **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码；精选名单为实测值非占位。
3. **类型一致性**：`mapPointCommon` 返回 `{id,name,nameOriginal,image,ep,s,lat,lon,origin,originURL}` 与 Task 5 组件用法（`p.lat?.toFixed`、`p.image`、`p.origin`）一致；`compactSearchResults` 返回 `{id,titleCn,titleOriginal,date,cover}` 与搜索卡渲染字段一致；`toCustomPoint` 输出与 `api/validation.js` 校验 schema 一致；api/bangumi.js 返回 `{list}` 与组件 `json.list` 一致。
