# 三个架构缺陷修复 — 设计文档

**日期**: 2026-08-01
**分支**: `fix/three-architecture-bugs`
**回滚策略**: 每个 Fix 独立提交为 git 节点，可随时 `git revert <hash>` 单独回滚任一阶段。

## 背景与动机

项目扫描中发现三处架构级缺陷，彼此独立、互不依赖，但都会在生产环境造成真实危害：

1. **MapTactical.jsx**: `useEffect` 被误写成 `useState`，副作用依赖数组形同虚设；且与主 App 注册同名的 `window.__locatePointOnMap` 全局方法，存在双重注册/覆盖冲突。
2. **rateLimiter.js**: 用 `setInterval` + 内存 `Map` 做限流，在 Vercel serverless 无持久进程内存的环境下实际近乎失效。
3. **main.jsx**: Sentry DSN 硬编码，且 `sendDefaultPii:true` 会自动收集用户 IP。

## 范围与非目标

**范围**: 仅修这三处缺陷，外加实现 Fix 2 所必需的最小新模块（Redis 限流器）与 `.env.example` 占位。

**非目标**:
- 不重构 photoEngine / 规则匹配器 / 地图渲染等无关子系统
- 不动 `.env` / `.env.local`（含真实密钥），仅更新 `.env.example`
- 不变更 API 调用方签名（`withRateLimit` 接口保持兼容）
- 不引入新的运行时依赖（`@upstash/redis` 已在 `package.json` 中）

---

## Fix 1 — MapTactical.jsx：useState → useEffect + 解决全局名冲突

### 当前问题

`src/pages/MapTactical.jsx:186`

```js
// ❌ 把 useEffect 写成了 useState
useState(() => {
  window.__locatePointOnMap = (pointId) => {
    const point = customPoints.find(p => p.id === pointId);
    if (point) {
      setMapCenter([point.lon, point.lat]);
      setMapZoom(15);
      setActiveTab('map');
    }
  };
}, [customPoints]);  // ← 依赖数组挂在一个惰性初始化器上，从不生效
```

两层危害：
- (a) 该代码块只在组件首次渲染时执行一次；`customPoints` 变化时闭包内捕获的是**旧的** `customPoints`，定位会指向过期点位集合。
- (b) `window.__locatePointOnMap` 在 `App.jsx:80` 也被注册（查找主地图点位 `earth_terminal_custom_points`）。进入 Dark 2D 模式挂载 `MapTactical` 时，这边会**覆盖**主 App 的实现；退出战术模式 (`onExit` → `isTacticalMode=false`) `MapTactical` 卸载时却未 `delete`，留下一个已卸载组件的闭包作为野指针，仍指向 Dark 2D 的 `customPoints` 与 `setMapCenter`（已失效的 setter）。

### 设计

将误用的 `useState` 改回 `useEffect`，并补齐卸载清理：

```js
useEffect(() => {
  window.__locatePointOnMap = (pointId) => {
    const point = customPoints.find(p => p.id === pointId);
    if (point) {
      setMapCenter([point.lon, point.lat]);
      setMapZoom(15);
      setActiveTab('map');
    }
  };
  return () => {
    delete window.__locatePointOnMap;  // 卸载时清理，避免野指针
  };
}, [customPoints]);
```

行为变化：
- `customPoints` 变化时正确重注册，闭包始终拿到最新点位。
- 卸载时删除全局方法 → 退回常规模式时不再残留指向失效 setter / 旧点位的闭包。下次主 App 的 `useEffect`（依赖 `['app_customPoints']`）会重新挂回自己的实现。

### 关于"全局名冲突"的取舍（已确认采用最小修复）

理论上更彻底的做法是给全局名加 scope 区分（如 `__locateDark2dPoint` / `__locateAppPoint`），但会牵动跨组件调用点，超出本次范围。本设计采用**最小且自洽**的修复：靠卸载清理消除"野指针"这一真正会出 bug 的部分；同名覆盖属于运行时只有一个组件活跃的互斥场景（主 App 与战术模式二选一全屏），覆盖本身不构成 bug。

### 验证

- `npm run lint` 通过
- 手测心智模型：进入 Dark 2D → 点 DataCenter 列表项 → 地图 flyTo → 退出 → 进常规地图 → 点列表项仍能定位（无野指针报错）

---

## Fix 2 — rateLimiter.js：内存限流 → Upstash Redis 分布式限流

### 当前问题

`api/rateLimiter.js:8-93` 的 `RateLimiter` 类：
- 用进程内存 `Map<IP, {count, resetTime}>` 存计数
- 用 `setInterval` 每 5 分钟清理过期记录

在 Vercel serverless 下：
- 每个 API 路由是独立的无状态函数实例，多个实例不共享内存 → 同一 IP 的请求分散到不同实例，各自的计数都从 0 开始 → **限流总数远超设定阈值**。
- 实例在请求间隙被冻结/回收，`setInterval` 根本不触发 → 过期记录不会被清理。
- 结论：文档宣称的"10次/分钟"在生产几乎不生效，对 Mapbox/WeatherAPI 等按量计费上游失去兜底。

### 设计

新增基于 `@upstash/redis` 的分布式限流，复用 `api/points.js` 已验证的 Upstash 连接方式。保留三层预设限流器（按 Redis key 命名空间区分）。

#### 数据结构

每个限流器 = 一个 Redis key 命名空间，key 内用 **Redis hash 或单个字符串计数器 + TTL**。

采用最简且原子正确的方案：**固定窗口计数器**
- key: `ratelimit:{limiterName}:{ip}` （如 `ratelimit:mapbox:1.2.3.4`）
- 值：在该窗口内的请求次数
- 用 `INCR` + `EXPIRE`（仅当 key 新建时设过期）实现；INCR 原子递增保证并发安全

伪代码：

```js
import { Redis } from '@upstash/redis';

export async function checkRedisRateLimit(redis, limiterName, ip, maxRequests, windowMs) {
  const key = `ratelimit:${limiterName}:${ip}`;
  const count = await redis.incr(key);          // 原子 +1
  if (count === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));  // 首次设 TTL
  }
  const remaining = Math.max(0, maxRequests - count);
  return { allowed: count <= maxRequests, remaining, limit: maxRequests };
}
```

> 选固定窗口而非滑动窗口/令牌桶的原因：实现最简、原子操作友好、对"防止滥用配额"这个兜底目标已足够；小时级精度误差可接受。如未来需要更平滑可再升级。

#### 连接复用

`withRateLimit` 在被调用时读取 `process.env.KV_REST_API_URL` / `KV_REST_API_TOKEN`：
- 均存在 → 用 Redis 路径
- 任一缺失 → 降级到内存版（供本地 `vercel dev` / 离线开发）

#### 优雅降级：内存版

保留原 `RateLimiter` 类作为降级实现，但**移除 `setInterval` 定时清理**（serverless 无效且会泄漏），改为在 `check()` 命中时惰性清理该 IP 的过期记录即可（O(1)，不遍历全表）。

#### 预设限流器配置化

原 `mapboxRateLimiter` / `generalRateLimiter` / `strictRateLimiter` 三个实例不再导出"有状态对象"，改为导出**配置常量**：

```js
export const RATE_LIMITERS = {
  mapbox:   { maxRequests: 10, windowMs: 60_000 },     // 每分钟 10 次
  general:  { maxRequests: 60, windowMs: 60_000 },     // 每分钟 60 次
  strict:   { maxRequests: 10, windowMs: 3_600_000 },   // 每小时 10 次
};
```

#### 中间件签名（窄变更）

`withRateLimit` 的**入参从"限流器实例对象"改为"限流器名称字符串"**，但返回的 `(req,res)=>...` 高阶函数形状不变，调用方仅需把传参从对象改为字符串：

```js
export const withRateLimit = (limiterName) => (handler) => async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown';
  // Redis 优先，缺失则内存降级
  ...
  res.setHeader('X-RateLimit-Limit', ...);
  res.setHeader('X-RateLimit-Remaining', ...);
  if (!result.allowed) return res.status(429).json({ error: 'Too many requests', ... });
  return handler(req, res);
};
```

**调用方需改（全仓库仅 1 处）**: `api/mapbox.js:10` 的
`withRateLimit(mapboxRateLimiter)` → `withRateLimit('mapbox')`

> 三层 `export const mapboxRateLimiter / generalRateLimiter / strictRateLimiter` 实例导出会被移除（改为上节的 `RATE_LIMITERS` 配置常量）；若 grep 显示这些导出在别处被引用，则在实现时按需保留包装，但当前扫描未见其它引用。

### 验证

- `npm run lint`、`npm run build` 通过
- 无 KV env 时降级路径不报错（本地 `vite` 无关；`vercel dev` 可测）
- 逻辑自检：连续调 `withRateLimit('mapbox')` 11 次后第 11 次应 429（Redis 在场时跨实例一致，内存降级时单进程内一致）

---

## Fix 3 — main.jsx + .env.example：Sentry DSN 走 env + 关闭 PII

### 当前问题

`src/main.jsx:8-15`：

```js
Sentry.init({
  dsn: "https://80107cfb684f4223ceb1c5bf60295fca@o4511120233398272.ingest.us.sentry.io/4511120259284992", // 硬编码
  sendDefaultPii: true,  // 自动收集 IP
});
```

- DSN 硬编码：fork/复用代码、轮换密钥都不便；DSN 本身非机密，但硬编码仍是反模式。
- `sendDefaultPii: true`：默认收集用户 IP 及部分浏览器 PII。对一个开源、面向公网的旅行地图应用，自动收集访客 IP 不符合最小化原则。

### 设计

```js
import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,   // 不再自动收集 IP
  });
}
```

- 缺失 `VITE_SENTRY_DSN` 时跳过 `Sentry.init()`，本地/未配置环境不报错。
- `.env.example` 追加 `VITE_SENTRY_DSN=` 占位（注释说明本地可留空）。
- **不动** `.env` / `.env.local`；用户需在 Vercel 项目设置与本地 `.env.local` 手动补上该变量（值即原硬编码 DSN，或新轮换的 DSN）。

### 验证

- `npm run lint`、`npm run build` 通过
- 缺 DSN 时不崩、无副作用；有 DSN 时正常初始化但不再发送 PII

---

## 实现顺序与提交节点

每个 Fix 一个独立提交，便于单独回滚：

1. `fix(MapTactical): useState 误写为 useEffect，补卸载清理` → Fix 1
2. `fix(sentry): DSN 迁移到 env，关闭 sendDefaultPii` → Fix 3（简单，先于限流）
3. `feat(rateLimiter): 内存限流改为 Upstash Redis 分布式限流，内存版降级保留` → Fix 2
4. `chore(env): .env.example 补充 VITE_SENTRY_DSN` → 可并入 Fix 3 提交

> 顺序上先做 Fix 1、3（局部、低风险）建立"已修复"节点，再投入 Fix 2（最重）。

## 整体验证

- 各 Fix 单独 `npm run lint` 通过
- 末尾 `npm run build` 整体通过
- 全程在 `fix/three-architecture-bugs` 分支；不动 `main`
