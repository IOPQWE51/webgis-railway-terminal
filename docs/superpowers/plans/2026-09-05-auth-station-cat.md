# 轻登录与数据隔离 + 猫站长登录页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 EarthTerminal 建立用户名+密码登录（JWT httpOnly Cookie）、点位云端数据按用户隔离，并交付"猫站长"动画登录页（角色状态机跟随表单）。

**Architecture:** 复用已投产的 Vercel KV（Upstash Redis）存用户与按用户隔离的点位（`user:<u>` / `points:<u>` / `points:<u>:dark2d`）；新增 `api/auth.js` 四端点；`api/points.js` 改为会话驱动；前端会话状态提升到 App.jsx，云同步跟随会话；登录为全屏覆盖层（纯 SVG+CSS 猫站长，零新动画依赖）。

**Tech Stack:** React 19 · jose（JWT）· bcryptjs · Vitest · Vercel Serverless · Upstash Redis

**Spec:** `docs/superpowers/specs/2026-09-05-auth-user-isolation-design.md`

---

## 执行者须知（每个 subagent 必读）

- 工作目录：`C:\Users\张\Desktop\github仓库\终端`；**直接在 main 上工作，逐任务提交**。
- **只 `git add <具体文件>`，严禁 `git add -A` / `git add .`**——工作区有维护者未提交的私有文件（`docs/📋 待办事项/` 下两个 md、`.vault-stage/`、`docs/superpowers/specs/handoff-run-lint-and-commit.md`），绝不能进提交。
- 测试命令：`npm test`（vitest，当前 106 用例全绿）；lint：`npm run lint`。
- 测试风格参考 `tests/api-pilgrimage-proxy.test.js`（可 import api 模块与纯函数）；纯函数优先，不触网、不连真 Redis。
- 注释风格：中文，带 emoji 前缀，说明"为什么"；沿用各文件现有密度。
- 完成每步后勾选对应 checkbox 并提交。

## 已核实事实（2026-09-05 主控验证，勿再猜测）

| 事实 | 值 |
|---|---|
| 限流档位 `api/rateLimiter.js` | `mapbox` 10/60s · `general` 60/60s · `strict` 10/3600s · `pointsWrite` 30/60s |
| KV 环境变量 | `KV_REST_API_URL` / `KV_REST_API_TOKEN`（生产已配置，points.js:30-36 的单例模式照抄） |
| `api/validation.js` 导出 | `MAX_POINTS`、`validatePointsPayload(body)`、`getClientIp`、`parseCoords`、`isMonitorAuthorized` |
| `App.jsx` 锚点 | L22 `isCloudSyncing`；L43-53 localStorage 初始化；L55-77 挂载时匿名云同步 effect（将替换）；L80-97 `handlePointsUpdate`；L147-152 header 段落；L258 DataCenter props；L283-284 非战术分支收尾 `)}` |
| `DataCenter.jsx` 锚点 | L198 `const DataCenter = ({ isActive, customPoints, onPointsUpdate })`；L2 lucide import；L412 `<div className="grid md:grid-cols-5 gap-6">`；L513 战术星标库 |
| `MapTactical.jsx` 容错 | L53-58 读：`if (res.ok)` 才写本地；L72-76 写：`.catch(() => {})` 不看响应 → 401 时优雅退化为纯本地，**无需改动** |
| `SearchNavEngine` | 由 `ControlPanel.jsx:13` 渲染，`NODE: 03-JP` 为装饰文本，本迭代**不改**（NODE 徽章放 App header） |
| `storage` 工具 | `src/utils/performanceHelpers` 导出 `storage.load/save` |
| 组件 barrel | `src/components/index.js`（新组件直接深路径 import，不动 barrel） |
| 遗留全局键 | `earth_terminal_global_points`（生产现存 2 条用户数据，注册认领机制见 Task 2） |

---

### Task 1: 安装依赖 + api/auth.js 纯函数层

**Files:**
- Modify: `package.json`（npm install 自动写入）
- Create: `api/auth.js`（本任务只写纯函数层 + KV 单例，端点在 Task 2）
- Test: `tests/api-auth.test.js`

- [ ] **Step 1: 安装依赖**

```bash
npm install bcryptjs jose
```

预期：package.json dependencies 出现 `bcryptjs` 与 `jose`。

- [ ] **Step 2: 写失败测试**

`tests/api-auth.test.js`：

```js
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import {
    normalizeUsername,
    validatePassword,
    validateCredentials,
    sessionCookieOptions,
    serializeSessionCookie,
    serializeClearedCookie,
    parseSessionCookie,
    signSession,
    verifySessionToken,
    buildUserRecord,
    claimLegacyPool
} from '../api/auth.js';

const SECRET = 'test-secret-32-chars-long-xxxxxxxx';

// 内存 KV 桩：实现 auth.js 用到的 get/set/delete
class FakeKV {
    constructor() { this.m = new Map(); }
    async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
    async set(k, v) { this.m.set(k, v); return 'OK'; }
    async delete(k) { this.m.delete(k); }
}

describe('normalizeUsername', () => {
    it('小写化并去除首尾空白', () => {
        expect(normalizeUsername('  Zhang_San ')).toBe('zhang_san');
    });
    it('接受 3-24 位合法字符', () => {
        expect(normalizeUsername('abc')).toBe('abc');
        expect(normalizeUsername('a'.repeat(24))).toBe('a'.repeat(24));
        expect(normalizeUsername('user-1_2')).toBe('user-1_2');
    });
    it('拒绝过短/过长/非法字符', () => {
        expect(normalizeUsername('ab')).toBe(null);
        expect(normalizeUsername('a'.repeat(25))).toBe(null);
        expect(normalizeUsername('有汉字')).toBe(null);
        expect(normalizeUsername('bad space')).toBe(null);
        expect(normalizeUsername('')).toBe(null);
        expect(normalizeUsername(null)).toBe(null);
        expect(normalizeUsername(undefined)).toBe(null);
    });
});

describe('validatePassword', () => {
    it('接受 8-72 位', () => {
        expect(validatePassword('a'.repeat(8))).toBe('a'.repeat(8));
        expect(validatePassword('a'.repeat(72))).toBe('a'.repeat(72));
    });
    it('拒绝 7 位与 73 位及非字符串', () => {
        expect(validatePassword('a'.repeat(7))).toBe(null);
        expect(validatePassword('a'.repeat(73))).toBe(null);
        expect(validatePassword(null)).toBe(null);
    });
});

describe('validateCredentials', () => {
    it('合法凭据返回小写用户名与密码', () => {
        const r = validateCredentials({ username: 'Zhang', password: 'password1' });
        expect(r).toEqual({ ok: true, username: 'zhang', password: 'password1' });
    });
    it('非法入参带中文错误文案', () => {
        expect(validateCredentials(null).ok).toBe(false);
        expect(validateCredentials({ username: 'x', password: 'password1' }).error).toContain('用户名');
        expect(validateCredentials({ username: 'zhang', password: 'short' }).error).toContain('密码');
    });
});

describe('会话 Cookie', () => {
    it('生产 Cookie 含 Secure，本地不含', () => {
        expect(serializeSessionCookie('tok', true)).toContain('Secure');
        expect(serializeSessionCookie('tok', false)).not.toContain('Secure');
        expect(serializeSessionCookie('tok', true)).toContain('HttpOnly');
        expect(serializeSessionCookie('tok', true)).toContain('SameSite=Lax');
        expect(serializeSessionCookie('tok', true)).toContain('Max-Age=604800');
    });
    it('清除 Cookie 的 Max-Age=0', () => {
        expect(serializeClearedCookie(true)).toContain('Max-Age=0');
    });
    it('sessionCookieOptions 返回安全属性', () => {
        const o = sessionCookieOptions(true);
        expect(o).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 604800 });
    });
    it('parseSessionCookie 解出 et_session 值，无 Cookie 得 null', () => {
        expect(parseSessionCookie({ headers: { cookie: 'a=1; et_session=tok%20x' } })).toBe('tok x');
        expect(parseSessionCookie({ headers: {} })).toBe(null);
    });
});

describe('JWT 签发与校验', () => {
    it('签发后可校验出用户名', async () => {
        const token = await signSession('zhang', SECRET);
        expect(await verifySessionToken(token, SECRET)).toBe('zhang');
    });
    it('密钥不符返回 null', async () => {
        const token = await signSession('zhang', SECRET);
        expect(await verifySessionToken(token, 'another-secret-32-chars-long-xxxx')).toBe(null);
    });
    it('篡改 token 返回 null', async () => {
        const token = await signSession('zhang', SECRET);
        const tampered = token.slice(0, -3) + 'aaa';
        expect(await verifySessionToken(tampered, SECRET)).toBe(null);
    });
    it('过期 token 返回 null', async () => {
        const token = await signSession('zhang', SECRET, '1s');
        await new Promise(r => setTimeout(r, 1100));
        expect(await verifySessionToken(token, SECRET)).toBe(null);
    });
    it('空入参安全返回 null', async () => {
        expect(await verifySessionToken(null, SECRET)).toBe(null);
        expect(await verifySessionToken('tok', '')).toBe(null);
    });
});

describe('buildUserRecord（bcrypt 往返）', () => {
    it('hash 可验证原密码、拒绝错误密码', async () => {
        const rec = await buildUserRecord('password1');
        expect(rec.createdAt).toBeTruthy();
        expect(await bcrypt.compare('password1', rec.hash)).toBe(true);
        expect(await bcrypt.compare('wrongpass', rec.hash)).toBe(false);
    });
});

describe('claimLegacyPool（遗留全局池一次性认领）', () => {
    it('把旧全局池搬进新用户名下并归档旧键', async () => {
        const kv = new FakeKV();
        await kv.set('earth_terminal_global_points', [
            { id: 'a', name: '东京站', lat: 35.68, lon: 139.76, category: 'station', source: '手动捕获' }
        ]);
        const n = await claimLegacyPool(kv, 'zhang');
        expect(n).toBe(1);
        expect(await kv.get('points:zhang')).toHaveLength(1);
        expect(await kv.get('earth_terminal_global_points')).toBe(null);
        const archivedKey = [...kv.m.keys()].find(k => k.startsWith('earth_terminal_global_points_claimed_'));
        expect(archivedKey).toBeTruthy();
        expect(await kv.get(archivedKey)).toHaveLength(1);
    });
    it('旧池不存在时返回 0 且不写用户键', async () => {
        const kv = new FakeKV();
        expect(await claimLegacyPool(kv, 'x')).toBe(0);
        expect(await kv.get('points:x')).toBe(null);
    });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/api-auth.test.js`
预期：FAIL（`api/auth.js` 不存在，导入报错）。

- [ ] **Step 4: 实现 api/auth.js 纯函数层**

创建 `api/auth.js`（本任务先不含默认导出端点，Task 2 再加）：

```js
// api/auth.js
// 🔐 轻登录与会话：用户名 + 密码（bcryptjs）+ JWT（jose，HS256，7 天）
// - 用户库与点位库均存 Vercel KV（Upstash Redis），键按用户名隔离：
//     user:<username>   → { hash, createdAt }
//     points:<username> → 点位数组（写入前经 validatePointsPayload 硬校验）
// - 会话 Cookie：et_session（HttpOnly / SameSite=Lax，生产追加 Secure）
// - 遗留迁移：首个注册用户自动认领旧全局池 earth_terminal_global_points，旧键改名归档

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { validatePointsPayload } from './validation.js';

export const COOKIE_NAME = 'et_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const LEGACY_GLOBAL_KEY = 'earth_terminal_global_points';

// ---------- 纯函数层（tests/api-auth.test.js 覆盖） ----------

export function normalizeUsername(raw) {
    const u = String(raw ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(u)) return null;
    return u;
}

export function validatePassword(raw) {
    const p = String(raw ?? '');
    return p.length >= 8 && p.length <= 72 ? p : null;
}

export function validateCredentials(body) {
    if (!body || typeof body !== 'object') return { ok: false, error: '请求体格式错误' };
    const username = normalizeUsername(body.username);
    if (!username) return { ok: false, error: '用户名需为 3-24 位小写字母、数字、- 或 _' };
    const password = validatePassword(body.password);
    if (!password) return { ok: false, error: '密码长度需为 8-72 位' };
    return { ok: true, username, password };
}

export function sessionCookieOptions(isProduction) {
    return { httpOnly: true, secure: Boolean(isProduction), sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE };
}

export function serializeSessionCookie(token, isProduction) {
    const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', `Max-Age=${SESSION_MAX_AGE}`, 'SameSite=Lax'];
    if (isProduction) parts.push('Secure');
    return parts.join('; ');
}

export function serializeClearedCookie(isProduction) {
    const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
    if (isProduction) parts.push('Secure');
    return parts.join('; ');
}

export function parseSessionCookie(req) {
    const header = String(req.headers?.cookie || '');
    const m = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
}

const secretKey = (secret) => new TextEncoder().encode(secret);

export async function signSession(username, secret, expiry = '7d') {
    return new SignJWT({ sub: username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(secretKey(secret));
}

export async function verifySessionToken(token, secret) {
    if (!token || !secret) return null;
    try {
        const { payload } = await jwtVerify(token, secretKey(secret));
        return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
    } catch {
        return null;
    }
}

export async function getSessionUsername(req) {
    const token = parseSessionCookie(req);
    return verifySessionToken(token, process.env.JWT_SECRET);
}

export async function buildUserRecord(password) {
    return { hash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
}

// 一次性迁移：旧全局池搬进新注册用户名下，旧键改名归档（先到先得）
export async function claimLegacyPool(kv, username) {
    const legacy = await kv.get(LEGACY_GLOBAL_KEY);
    if (!Array.isArray(legacy)) return 0;
    const result = validatePointsPayload(legacy);
    const points = result.ok ? result.points : [];
    await kv.set(`points:${username}`, points);
    await kv.set(`earth_terminal_global_points_claimed_${Date.now()}`, points);
    await kv.delete(LEGACY_GLOBAL_KEY);
    return points.length;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/api-auth.test.js`
预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add api/auth.js tests/api-auth.test.js package.json package-lock.json
git commit -m "feat(auth): 轻登录纯函数层 —— 凭据校验/JWT 会话/遗留池认领（TDD）"
```

---

### Task 2: api/auth.js 四端点（register/login/logout/me）

**Files:**
- Modify: `api/auth.js`（追加 KV 单例与端点）

- [x] **Step 1: 在 api/auth.js 追加 KV 单例与四个端点**

在文件末尾追加（import 区补充 `import { Redis } from '@upstash/redis';` 与 `import { withRateLimit } from './rateLimiter.js';`）：

```js
// ---------- KV 单例（与 points.js 相同的进程内复用模式） ----------

let _redis = null;
let _redisChecked = false;
function getRedis() {
    if (_redisChecked) return _redis;
    _redisChecked = true;
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (kvUrl && kvToken) {
        _redis = new Redis({ url: kvUrl, token: kvToken });
    }
    return _redis;
}

const isProduction = () => process.env.VERCEL_ENV === 'production';

async function readJsonBody(req) {
    // 防御纵深：注册/登录请求体不可能超过 10KB
    if (Number(req.headers['content-length'] || 0) > 10_000) return null;
    try { return await req.json(); } catch { return null; }
}

function requireSecret(res) {
    if (!process.env.JWT_SECRET) {
        res.status(503).json({ error: '认证服务暂不可用' });
        return false;
    }
    return true;
}

// ---------- 端点（register/login 走 strict 档防爆破） ----------

const registerHandler = withRateLimit('strict')(async (req, res) => {
    if (!requireSecret(res)) return;
    if (process.env.ALLOW_REGISTRATION === 'false') {
        return res.status(403).json({ error: '注册通道已关闭' });
    }
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    const creds = validateCredentials(body);
    if (!creds.ok) return res.status(400).json({ error: creds.error });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const record = await buildUserRecord(creds.password);
    // nx = 不存在才写入，规避检查-写入竞态
    const created = await redis.set(`user:${creds.username}`, JSON.stringify(record), { nx: true });
    if (created !== 'OK') return res.status(409).json({ error: '该节点代号已被注册' });

    await claimLegacyPool(redis, creds.username);

    const token = await signSession(creds.username, process.env.JWT_SECRET);
    res.setHeader('Set-Cookie', serializeSessionCookie(token, isProduction()));
    return res.status(201).json({ ok: true, username: creds.username });
});

const loginHandler = withRateLimit('strict')(async (req, res) => {
    if (!requireSecret(res)) return;
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    const creds = validateCredentials(body);
    if (!creds.ok) return res.status(400).json({ error: creds.error });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const raw = await redis.get(`user:${creds.username}`);
    let record = null;
    try { record = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { record = null; }
    const valid = Boolean(record && typeof record.hash === 'string') && (await bcrypt.compare(creds.password, record.hash));
    // 统一 401 文案，不做用户枚举侧信道
    if (!valid) return res.status(401).json({ error: '认证失败，节点代号或访问密钥有误' });

    const token = await signSession(creds.username, process.env.JWT_SECRET);
    res.setHeader('Set-Cookie', serializeSessionCookie(token, isProduction()));
    return res.status(200).json({ ok: true, username: creds.username });
});

const logoutHandler = withRateLimit('general')(async (req, res) => {
    res.setHeader('Set-Cookie', serializeClearedCookie(isProduction()));
    return res.status(200).json({ ok: true });
});

const meHandler = withRateLimit('general')(async (req, res) => {
    const username = await getSessionUsername(req);
    if (!username) return res.status(401).json({ error: '未登录' });
    return res.status(200).json({ username });
});

export default async function handler(req, res) {
    try {
        const action = req.query?.action;
        if (req.method === 'POST' && action === 'register') return await registerHandler(req, res);
        if (req.method === 'POST' && action === 'login') return await loginHandler(req, res);
        if (req.method === 'POST' && action === 'logout') return await logoutHandler(req, res);
        if (req.method === 'GET' && action === 'me') return await meHandler(req, res);
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        // 只记录服务端日志，不向客户端泄露内部细节
        console.error('认证服务故障:', error.message);
        return res.status(500).json({ error: '认证服务暂不可用' });
    }
}
```

注意：`getSessionUsername` 在本文件上方已导出（Task 1），此处直接使用；import 区需确认包含 `Redis`、`withRateLimit`。

- [x] **Step 2: 跑全量测试确认无回归**

Run: `npm test`
预期：全部 PASS（Task 1 的测试仍绿，无导入破坏）。

- [x] **Step 3: lint**

Run: `npm run lint`
预期：无错误。

- [x] **Step 4: 提交**

```bash
git add api/auth.js
git commit -m "feat(auth): register/login/logout/me 四端点 —— nx 原子注册、统一 401 文案、strict 限流"
```

---

### Task 3: api/points.js 会话隔离改造

**Files:**
- Modify: `api/points.js`
- Test: `tests/api-points-scope.test.js`

- [x] **Step 1: 写失败测试**

`tests/api-points-scope.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { pointsKeyFor } from '../api/points.js';
import { signSession, parseSessionCookie, getSessionUsername } from '../api/auth.js';

const SECRET = 'test-secret-32-chars-long-xxxxxxxx';

describe('points 键按用户隔离', () => {
    it('主库绑定用户名', () => {
        expect(pointsKeyFor('zhang', 'main')).toBe('points:zhang');
    });
    it('战术库独立子键', () => {
        expect(pointsKeyFor('zhang', 'dark2d')).toBe('points:zhang:dark2d');
    });
    it('不同用户键互不相通', () => {
        expect(pointsKeyFor('a', 'main')).not.toBe(pointsKeyFor('b', 'main'));
    });
});

describe('Cookie → 用户名解析', () => {
    it('有效会话 Cookie 解出用户名', async () => {
        const token = await signSession('zhang', SECRET);
        const req = { headers: { cookie: `et_session=${encodeURIComponent(token)}` } };
        expect(await verifyForTest(req, SECRET)).toBe('zhang');
    });
    it('匿名请求（无 Cookie）解析为 null', async () => {
        expect(await verifyForTest({ headers: {} }, SECRET)).toBe(null);
    });
});

// getSessionUsername 内部读 process.env.JWT_SECRET；测试用注入 secret 的等价链路
async function verifyForTest(req, secret) {
    const token = parseSessionCookie(req);
    const { verifySessionToken } = await import('../api/auth.js');
    return verifySessionToken(token, secret);
}
```

- [x] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/api-points-scope.test.js`
预期：FAIL（`pointsKeyFor` 不存在）。

- [x] **Step 3: 改造 api/points.js**

修改点（保持文件其余部分不动）：

(a) import 区追加：

```js
import { getSessionUsername } from './auth.js';
```

(b) 新增纯函数（放在 `DB_KEYS` 定义处，删除 `DB_KEYS` 与 `resolveDbKey`）：

```js
// 点位键按用户名隔离：主库 points:<u>，战术库 points:<u>:dark2d
export function pointsKeyFor(username, scope) {
    return scope === 'dark2d' ? `points:${username}:dark2d` : `points:${username}`;
}
```

(c) `readPoints` 整体替换为：

```js
async function readPoints(req, res) {
    const redis = getRedis();
    if (!redis) {
        return res.status(500).json({ error: 'KV 数据库未配置，请在 Vercel 控制台连接 KV 实例' });
    }
    const username = await getSessionUsername(req);
    if (!username) {
        return res.status(401).json({ error: '需要登录' });
    }
    const scope = req.query?.scope === 'dark2d' ? 'dark2d' : 'main';
    const points = (await redis.get(pointsKeyFor(username, scope))) || [];
    return res.status(200).json({ source: 'cloud', scope, data: points });
}
```

(d) `writePoints` 中 `const { scope, dbKey } = resolveDbKey(req);` 一段替换为：

```js
    const username = await getSessionUsername(req);
    if (!username) {
        return res.status(401).json({ error: '需要登录' });
    }
    const scope = req.query?.scope === 'dark2d' ? 'dark2d' : 'main';
    const dbKey = pointsKeyFor(username, scope);
```

(e) 文件头注释"安全模型"补一行：

```js
// - 2026-09 起按用户隔离：读写在 et_session 会话之下进行（points:<username>），
//   匿名请求一律 401；旧全局池由 api/auth.js 注册认领机制一次性迁移。
```

- [x] **Step 4: 跑全量测试**

Run: `npm test`
预期：全部 PASS（含既有 106 用例——无测试引用旧的全局读行为）。

- [x] **Step 5: 提交**

```bash
git add api/points.js tests/api-points-scope.test.js
git commit -m "feat(points): 云端点位按用户隔离 —— 会话驱动键名，匿名一律 401（关闭未鉴权整库覆盖隐患）"
```

---

### Task 4: 猫站长状态机（纯 reducer）

**Files:**
- Create: `src/components/auth/catStateMachine.js`
- Test: `tests/cat-state-machine.test.js`

- [x] **Step 1: 写失败测试**

`tests/cat-state-machine.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { nextCatState, CAT_STATES } from '../src/components/auth/catStateMachine.js';

const IDLE = { name: 'idle', inputLength: 0 };

describe('猫站长状态机', () => {
    it('暴露六种状态', () => {
        expect(CAT_STATES).toEqual(['idle', 'watching', 'covering', 'loading', 'error', 'success']);
    });
    it('聚焦用户名 → watching 并携带输入长度', () => {
        expect(nextCatState({ type: 'USERNAME_FOCUS', inputLength: 3 }, IDLE))
            .toEqual({ name: 'watching', inputLength: 3 });
    });
    it('watching 中输入更新长度；其他状态忽略 INPUT', () => {
        const watching = { name: 'watching', inputLength: 2 };
        expect(nextCatState({ type: 'USERNAME_INPUT', inputLength: 5 }, watching))
            .toEqual({ name: 'watching', inputLength: 5 });
        expect(nextCatState({ type: 'USERNAME_INPUT', inputLength: 5 }, IDLE)).toBe(IDLE);
    });
    it('用户名失焦回 idle；covering 时忽略', () => {
        expect(nextCatState({ type: 'USERNAME_BLUR' }, { name: 'watching', inputLength: 9 })).toEqual(IDLE);
        expect(nextCatState({ type: 'USERNAME_BLUR' }, { name: 'covering', inputLength: 0 })).toEqual({ name: 'covering', inputLength: 0 });
    });
    it('聚焦密码 → covering（loading/success 中不覆盖）', () => {
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, IDLE)).toEqual({ name: 'covering', inputLength: 0 });
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, { name: 'error', inputLength: 0 })).toEqual({ name: 'covering', inputLength: 0 });
        const loading = { name: 'loading', inputLength: 0 };
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, loading)).toBe(loading);
        const success = { name: 'success', inputLength: 0 };
        expect(nextCatState({ type: 'PASSWORD_FOCUS' }, success)).toBe(success);
    });
    it('密码失焦回 idle；提交进入 loading；失败→error；成功→success；RESET 归位', () => {
        expect(nextCatState({ type: 'PASSWORD_BLUR' }, { name: 'covering', inputLength: 0 })).toEqual(IDLE);
        expect(nextCatState({ type: 'SUBMIT' }, IDLE)).toEqual({ name: 'loading', inputLength: 0 });
        expect(nextCatState({ type: 'SUBMIT_FAIL' }, { name: 'loading', inputLength: 0 })).toEqual({ name: 'error', inputLength: 0 });
        expect(nextCatState({ type: 'SUBMIT_SUCCESS' }, { name: 'loading', inputLength: 0 })).toEqual({ name: 'success', inputLength: 0 });
        expect(nextCatState({ type: 'RESET' }, { name: 'error', inputLength: 0 })).toEqual(IDLE);
    });
    it('未知事件原样返回', () => {
        expect(nextCatState({ type: 'NOPE' }, IDLE)).toBe(IDLE);
    });
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/cat-state-machine.test.js`
预期：FAIL（模块不存在）。

- [x] **Step 3: 实现 reducer**

`src/components/auth/catStateMachine.js`：

```js
// 🐱 猫站长状态机：纯函数 reducer，跟随登录表单事件在六态间流转
// idle 待机 / watching 盯输入 / covering 捂眼 / loading 呼叫卫星 / error 摇头 / success 庆祝

export const CAT_STATES = ['idle', 'watching', 'covering', 'loading', 'error', 'success'];

export function nextCatState(event, state) {
    switch (event.type) {
        case 'USERNAME_FOCUS':
            return { name: 'watching', inputLength: event.inputLength ?? 0 };
        case 'USERNAME_INPUT':
            return state.name === 'watching' ? { ...state, inputLength: event.inputLength ?? 0 } : state;
        case 'USERNAME_BLUR':
            return state.name === 'watching' ? { name: 'idle', inputLength: 0 } : state;
        case 'PASSWORD_FOCUS':
            return state.name === 'loading' || state.name === 'success'
                ? state
                : { name: 'covering', inputLength: 0 };
        case 'PASSWORD_BLUR':
            return state.name === 'covering' ? { name: 'idle', inputLength: 0 } : state;
        case 'SUBMIT':
            return { name: 'loading', inputLength: 0 };
        case 'SUBMIT_FAIL':
            return { name: 'error', inputLength: 0 };
        case 'SUBMIT_SUCCESS':
            return { name: 'success', inputLength: 0 };
        case 'RESET':
            return { name: 'idle', inputLength: 0 };
        default:
            return state;
    }
}
```

- [x] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/cat-state-machine.test.js`
预期：全部 PASS。

- [x] **Step 5: 提交**

```bash
git add src/components/auth/catStateMachine.js tests/cat-state-machine.test.js
git commit -m "feat(auth): 猫站长六态状态机纯 reducer（TDD）"
```

---

### Task 5: StationMasterCat SVG 角色 + LoginOverlay 覆盖层

**Files:**
- Create: `src/components/auth/StationMasterCat.jsx`
- Create: `src/components/auth/StationMasterCat.css`
- Create: `src/components/auth/LoginOverlay.jsx`

视觉件（无单测，Task 7 用浏览器截图验收六态）。三个文件完整代码如下。

- [x] **Step 1: 创建 StationMasterCat.css**

```css
/* 🐱 猫站长样式：所有循环动画可被 prefers-reduced-motion 关停 */

.smc { width: 210px; margin: 0 auto; position: relative; }
.smc__svg { width: 100%; display: block; }

.smc__happy { opacity: 0; }
.smc__radar { opacity: 0; transform-origin: 166px 52px; }
.smc__alert-ring { opacity: 0; transform-origin: 110px 110px; }
.smc__pupil { transition: transform 0.25s ease-out; }
.smc__paw { transition: transform 0.28s ease-out; }

/* 尾巴慢摆 */
.smc__tail { transform-origin: 158px 168px; animation: smc-tail-sway 3.2s ease-in-out infinite; }
@keyframes smc-tail-sway { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(8deg); } }

/* 每 4s 眨一次眼（眼睑平时上收） */
.smc__lid { transform: translateY(-20px); animation: smc-blink 4s ease-in-out infinite; }
@keyframes smc-blink { 0%, 92%, 100% { transform: translateY(-20px); } 95% { transform: translateY(0px); } }

/* covering：双爪上移捂眼 + 闭眼 */
.smc--covering .smc__paw--l { transform: translate(7px, -52px); }
.smc--covering .smc__paw--r { transform: translate(-7px, -52px); }
.smc--covering .smc__lid { transform: translateY(0); animation: none; }

/* loading：头顶雷达旋转 + 视线飘向侧上 */
.smc--loading .smc__radar { opacity: 1; animation: smc-radar-spin 1.2s linear infinite; }
@keyframes smc-radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.smc--loading .smc__pupil { transform: translate(3px, -3px) !important; }

/* error：摇头 + 胡须抖 + 红环脉冲 */
.smc--error .smc__head { animation: smc-head-shake 0.5s ease-in-out 2; transform-origin: 110px 130px; }
@keyframes smc-head-shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-7deg); } 75% { transform: rotate(7deg); } }
.smc--error .smc__whiskers { animation: smc-whisker-jitter 0.12s linear 8; }
@keyframes smc-whisker-jitter { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1.5px); } }
.smc--error .smc__alert-ring { opacity: 1; animation: smc-ring-pulse 0.9s ease-out 2; }
@keyframes smc-ring-pulse { 0% { opacity: 0.9; transform: scale(0.98); } 100% { opacity: 0; transform: scale(1.06); } }
.smc--error .smc__lid { transform: translateY(-6px); animation: none; }

/* success：弯月眼 + 尾巴快摆 */
.smc--success .smc__happy { opacity: 1; }
.smc--success .smc__pupil, .smc--success .smc__lid { opacity: 0; }
.smc--success .smc__tail { animation: smc-tail-wag 0.35s ease-in-out 6; }
@keyframes smc-tail-wag { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(16deg); } }

@media (prefers-reduced-motion: reduce) {
    .smc__tail, .smc__lid, .smc__radar, .smc__alert-ring, .smc__head, .smc__whiskers { animation: none !important; }
}
```

- [x] **Step 2: 创建 StationMasterCat.jsx**

```jsx
import './StationMasterCat.css';

// 🐱 猫站长：SVG 分层角色，state 由 catStateMachine 驱动
// inputLength 用于瞳孔跟随输入（0-24 映射到 ±6px 视线偏移）
const StationMasterCat = ({ state = 'idle', inputLength = 0 }) => {
    const pupilShift = Math.max(-6, Math.min(6, (Math.min(inputLength, 24) / 24) * 12 - 6));
    return (
        <div className={`smc smc--${state}`} aria-hidden="true">
            <svg viewBox="0 0 220 210" className="smc__svg">
                {/* 尾巴 */}
                <g className="smc__tail">
                    <path d="M158 168 Q 196 160 190 122" fill="none" stroke="#e8a13d" strokeWidth="14" strokeLinecap="round" />
                    <path d="M190 122 Q 188 110 178 108" fill="none" stroke="#6b5b4e" strokeWidth="14" strokeLinecap="round" />
                </g>
                {/* 身体与花斑 */}
                <ellipse cx="110" cy="165" rx="50" ry="36" fill="#f5e9d7" />
                <ellipse cx="86" cy="150" rx="16" ry="20" fill="#e8a13d" opacity="0.85" />
                <ellipse cx="134" cy="172" rx="14" ry="16" fill="#6b5b4e" opacity="0.8" />
                {/* 站长领巾 + 铃铛 */}
                <path d="M84 138 Q 110 152 136 138 L 136 150 Q 110 164 84 150 Z" fill="#c2452d" />
                <circle cx="110" cy="152" r="5" fill="#fbbf24" />
                {/* 双爪（covering 时上移捂眼） */}
                <g className="smc__paw smc__paw--l"><ellipse cx="86" cy="150" rx="13" ry="10" fill="#f5e9d7" stroke="#d9c6a8" /></g>
                <g className="smc__paw smc__paw--r"><ellipse cx="134" cy="150" rx="13" ry="10" fill="#f5e9d7" stroke="#d9c6a8" /></g>
                {/* 头 */}
                <g className="smc__head">
                    <path d="M76 66 L84 30 L108 56 Z" fill="#f5e9d7" />
                    <path d="M82 58 L86 40 L100 55 Z" fill="#e8a1a1" />
                    <path d="M144 66 L136 30 L112 56 Z" fill="#f5e9d7" />
                    <path d="M138 58 L134 40 L120 55 Z" fill="#e8a1a1" />
                    <circle cx="110" cy="95" r="44" fill="#f5e9d7" />
                    <path d="M70 80 Q 84 60 104 66 L 96 96 Q 78 96 70 80 Z" fill="#e8a13d" opacity="0.9" />
                    <path d="M150 80 Q 136 60 116 66 L 124 96 Q 142 96 150 80 Z" fill="#6b5b4e" opacity="0.85" />
                    {/* 左眼 */}
                    <g className="smc__eye">
                        <ellipse cx="93" cy="92" rx="9" ry="10" fill="#fffdf6" />
                        <g className="smc__pupil" style={{ transform: `translateX(${pupilShift}px)` }}>
                            <circle cx="93" cy="93" r="4.5" fill="#2b2620" />
                            <circle cx="94.5" cy="91.5" r="1.4" fill="#fff" />
                        </g>
                        <rect className="smc__lid" x="83" y="82" width="20" height="20" fill="#f5e9d7" />
                    </g>
                    {/* 右眼 */}
                    <g className="smc__eye">
                        <ellipse cx="127" cy="92" rx="9" ry="10" fill="#fffdf6" />
                        <g className="smc__pupil" style={{ transform: `translateX(${pupilShift}px)` }}>
                            <circle cx="127" cy="93" r="4.5" fill="#2b2620" />
                            <circle cx="128.5" cy="91.5" r="1.4" fill="#fff" />
                        </g>
                        <rect className="smc__lid" x="117" y="82" width="20" height="20" fill="#f5e9d7" />
                    </g>
                    {/* success 弯月眼 */}
                    <g className="smc__happy">
                        <path d="M86 93 Q 93 86 100 93" fill="none" stroke="#2b2620" strokeWidth="3" strokeLinecap="round" />
                        <path d="M120 93 Q 127 86 134 93" fill="none" stroke="#2b2620" strokeWidth="3" strokeLinecap="round" />
                    </g>
                    {/* 鼻与嘴 */}
                    <path d="M106 106 L114 106 L110 111 Z" fill="#e88b8b" />
                    <path d="M110 111 Q 110 116 104 117 M110 111 Q 110 116 116 117" fill="none" stroke="#8a7a63" strokeWidth="1.6" strokeLinecap="round" />
                    {/* 胡须 */}
                    <g className="smc__whiskers" stroke="#b7a689" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M74 104 L52 100" /><path d="M74 110 L54 112" /><path d="M74 116 L56 122" />
                        <path d="M146 104 L168 100" /><path d="M146 110 L166 112" /><path d="M146 116 L164 122" />
                    </g>
                    {/* 站长制帽 */}
                    <path d="M78 56 Q 110 34 142 56 L 142 64 Q 110 46 78 64 Z" fill="#1e293b" />
                    <rect x="74" y="58" width="72" height="9" rx="4" fill="#0f172a" />
                    <circle cx="110" cy="44" r="6" fill="#fbbf24" />
                    {/* loading 头顶雷达 */}
                    <g className="smc__radar">
                        <circle cx="166" cy="52" r="10" fill="none" stroke="#fbbf24" strokeWidth="2" />
                        <line x1="166" y1="52" x2="166" y2="42" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                    </g>
                </g>
                {/* error HUD 红环 */}
                <circle className="smc__alert-ring" cx="110" cy="110" r="86" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6 10" />
            </svg>
        </div>
    );
};

export default StationMasterCat;
```

- [x] **Step 3: 创建 LoginOverlay.jsx**

```jsx
import { useReducer, useState } from 'react';
import { X } from 'lucide-react';
import StationMasterCat from './StationMasterCat.jsx';
import { nextCatState } from './catStateMachine.js';

// 🛰️ 全屏认证覆盖层：猫站长陪你建立上行链路
export default function LoginOverlay({ onClose, onAuthenticated }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState(null); // { type: 'error' | 'ok', text }
    const [busy, setBusy] = useState(false);
    const [cat, dispatchCat] = useReducer(nextCatState, { name: 'idle', inputLength: 0 });

    const switchMode = (next) => {
        setMode(next);
        setMessage(null);
        dispatchCat({ type: 'RESET' });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage(null);
        dispatchCat({ type: 'SUBMIT' });
        try {
            const res = await fetch(`/api/auth?action=${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                dispatchCat({ type: 'SUBMIT_SUCCESS' });
                setMessage({
                    type: 'ok',
                    text: mode === 'register' ? `节点 ${data.username} 已注册，正在认领点位库...` : 'ACCESS GRANTED — 上行链路已建立'
                });
                setTimeout(() => onAuthenticated(data.username), 1100);
                return;
            }
            dispatchCat({ type: 'SUBMIT_FAIL' });
            setMessage({ type: 'error', text: data.error || '请求失败，请稍后再试' });
        } catch {
            dispatchCat({ type: 'SUBMIT_FAIL' });
            setMessage({ type: 'error', text: '跃迁引擎链路异常，请检查网络连接' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-label="身份认证">
            <div className="relative w-full max-w-md bg-zinc-900 border border-amber-400/40 rounded-3xl shadow-2xl p-8 font-mono">
                <button onClick={onClose} aria-label="关闭" className="absolute top-4 right-4 w-8 h-8 rounded-lg border border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-400/50 transition-colors">
                    <X className="w-4 h-4 mx-auto" />
                </button>

                <p className="text-amber-400 text-[10px] tracking-[0.35em] uppercase mb-1">UPLINK TERMINAL</p>
                <h2 className="text-amber-300 text-xl font-black tracking-widest mb-1">
                    {mode === 'login' ? '建立上行链路' : '注册新终端节点'}
                </h2>
                <p className="text-zinc-500 text-xs mb-4">STATION MASTER ON DUTY · 猫站长值机中</p>

                <StationMasterCat state={cat.name} inputLength={cat.inputLength} />

                <form onSubmit={submit} className="space-y-3 mt-2">
                    <label className="block">
                        <span className="text-zinc-400 text-[10px] tracking-[0.25em] uppercase">节点代号 NODE ID</span>
                        <input
                            type="text"
                            value={username}
                            autoComplete="username"
                            spellCheck="false"
                            disabled={busy}
                            onChange={(e) => { setUsername(e.target.value); dispatchCat({ type: 'USERNAME_INPUT', inputLength: e.target.value.length }); }}
                            onFocus={() => dispatchCat({ type: 'USERNAME_FOCUS', inputLength: username.length })}
                            onBlur={() => dispatchCat({ type: 'USERNAME_BLUR' })}
                            className="mt-1 w-full bg-black/60 border border-zinc-700 focus:border-amber-400/60 rounded-xl px-4 py-2.5 text-amber-200 text-sm outline-none transition-colors"
                        />
                    </label>
                    <label className="block">
                        <span className="text-zinc-400 text-[10px] tracking-[0.25em] uppercase">访问密钥 ACCESS KEY</span>
                        <input
                            type="password"
                            value={password}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            disabled={busy}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => dispatchCat({ type: 'PASSWORD_FOCUS' })}
                            onBlur={() => dispatchCat({ type: 'PASSWORD_BLUR' })}
                            className="mt-1 w-full bg-black/60 border border-zinc-700 focus:border-amber-400/60 rounded-xl px-4 py-2.5 text-amber-200 text-sm outline-none transition-colors"
                        />
                    </label>

                    {message && (
                        <p aria-live="polite" className={`text-xs font-bold ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {message.type === 'error' ? '> SIGNAL LOST: ' : '> '}{message.text}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy || !username || !password}
                        className="w-full py-3 rounded-xl bg-amber-400 text-zinc-900 font-black tracking-[0.3em] text-sm hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {mode === 'login' ? '▶ 建立上行链路' : '▸ 注册新节点'}
                    </button>
                </form>

                <div className="flex justify-center gap-2 mt-4">
                    <button onClick={() => switchMode('login')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'login' ? 'border-amber-400/60 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>登录</button>
                    <button onClick={() => switchMode('register')} className={`px-4 py-1.5 rounded-lg text-[10px] tracking-[0.25em] uppercase border transition-colors ${mode === 'register' ? 'border-amber-400/60 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>注册</button>
                </div>
                <p className="text-zinc-600 text-[10px] text-center mt-4 tracking-wider">匿名模式下数据仅保存在本机 · 建立链路后跨设备漫游</p>
            </div>
        </div>
    );
}
```

- [x] **Step 4: lint + 全量测试**

Run: `npm run lint && npm test`
预期：无错误、全部 PASS。

- [x] **Step 5: 提交**

```bash
git add src/components/auth/StationMasterCat.jsx src/components/auth/StationMasterCat.css src/components/auth/LoginOverlay.jsx
git commit -m "feat(auth): 猫站长 SVG 角色与全屏认证覆盖层（六态动效，零新依赖）"
```

---

### Task 6: App.jsx 会话接线 + DataCenter 作战身份卡

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/DataCenter.jsx`

- [x] **Step 1: App.jsx —— 引入与状态**

(a) import 区（L7 ErrorBoundary 之后）追加：

```js
import LoginOverlay from './components/auth/LoginOverlay.jsx';
```

(b) L22 `isCloudSyncing` 之后追加三个状态：

```js
    // 🔐 会话状态：null = 匿名（纯本地模式）
    const [session, setSession] = useState(null);
    const [authOverlayOpen, setAuthOverlayOpen] = useState(false);
```

- [x] **Step 2: App.jsx —— 替换挂载云同步 effect 为会话驱动**

将 L55-77 的 `useEffect`（匿名拉取 `/api/points`）整体替换为：

```js
    // 🛰️ 挂载时恢复会话（Cookie 会话，GET /api/auth?action=me）
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/auth?action=me');
                if (res.ok) {
                    const json = await res.json();
                    if (json.username) setSession(json.username);
                }
            } catch {
                console.log('📡 认证服务未连接，当前运行在本地沙盒模式。');
            }
        })();
    }, []);

    // ☁️ 已登录：从自己的云端点位库拉取并覆盖本地缓存；匿名：纯本地，不发云请求
    useEffect(() => {
        if (!session) return undefined;
        const fetchCloudPoints = async () => {
            setIsCloudSyncing(true);
            try {
                const res = await fetch('/api/points');
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && Array.isArray(json.data)) {
                        setCustomPoints(json.data);
                        storage.save('earth_terminal_custom_points', json.data);
                    }
                }
            } catch {
                console.log('📡 云端数据库尚未连接，当前运行在本地沙盒模式。');
            } finally {
                setIsCloudSyncing(false);
            }
        };
        fetchCloudPoints();
    }, [session]);
```

- [x] **Step 3: App.jsx —— handlePointsUpdate 匿名短路 + 登出**

(a) `handlePointsUpdate` 中 `storage.save(...)`（L83）之后、`try` 云端推送之前插入：

```js
        // 🔒 匿名模式：仅本地，不打扰云端
        if (!session) {
            console.info('🔒 本地模式：建立上行链路后点位将自动云端同步');
            return;
        }
```

(b) `handlePointsUpdate` 定义之后追加：

```js
    // 🚪 断开上行链路（服务端清 Cookie，本地点位数据保留）
    const handleLogout = async () => {
        try { await fetch('/api/auth?action=logout', { method: 'POST' }); } catch { /* 忽略网络错误 */ }
        setSession(null);
    };
```

- [x] **Step 4: App.jsx —— header 身份徽章**

L150 `{isCloudSyncing && ...}` 之后追加：

```js
                                {session
                                    ? <span className="ml-3 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold font-mono" title="已建立上行链路">NODE: {session}</span>
                                    : <button onClick={() => setAuthOverlayOpen(true)} className="ml-3 text-xs font-bold text-cyan-600 hover:text-cyan-500 underline underline-offset-4">建立上行链路</button>}
```

- [x] **Step 5: App.jsx —— DataCenter 传参与覆盖层**

(a) L258 DataCenter 追加 props：

```js
                    <DataCenter isActive={activeTab === 'data'} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} session={session} onOpenAuth={() => setAuthOverlayOpen(true)} onLogout={handleLogout} />
```

(b) 非战术分支收尾 `)}`（L283）之后、`</>` 之前插入覆盖层（战术模式内也可弹出）：

```jsx
            {authOverlayOpen && (
                <LoginOverlay
                    onClose={() => setAuthOverlayOpen(false)}
                    onAuthenticated={(u) => { setSession(u); setAuthOverlayOpen(false); }}
                />
            )}
```

- [x] **Step 6: DataCenter 作战身份卡**

(a) L2 lucide import 追加 `ShieldCheck`：

```js
import { UploadCloud, Server, Loader2, CheckCircle2, Trash2, AlertCircle, Plus, Search, MapPin, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
```

(b) L198 组件签名改为：

```js
const DataCenter = ({ isActive, customPoints, onPointsUpdate, session, onOpenAuth, onLogout }) => {
```

(c) L412 `<div className="grid md:grid-cols-5 gap-6">` 之前插入：

```jsx
            {/* 🔐 作战身份卡：上行链路状态 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 mr-2" /> 作战身份
                    </div>
                    {session ? (
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold font-mono">NODE: {session}</span>
                            <button onClick={onLogout} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">断开链路</button>
                        </div>
                    ) : (
                        <button onClick={onOpenAuth} className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-zinc-900 hover:bg-amber-300 shadow-sm transition-colors">⚡ 建立上行链路</button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    {session ? '云端同步已就绪：点位库按用户隔离，跨设备保持一致。' : '匿名模式：数据仅保存在本机浏览器。建立上行链路后可云端同步与跨设备漫游。'}
                </p>
            </div>
```

- [x] **Step 7: lint + 全量测试**

Run: `npm run lint && npm test`
预期：无错误、全部 PASS。

- [x] **Step 8: 提交**

```bash
git add src/App.jsx src/components/DataCenter.jsx
git commit -m "feat(app): 会话接线与作战身份卡 —— 匿名纯本地/登录云同步分支，猫站长覆盖层挂载"
```

---

### Task 7: 全量验证 + 部署 + 生产验收（主控亲自执行，不派 subagent）

- [ ] **Step 1: `npm test` 全绿 + `npm run lint` 干净**
- [ ] **Step 2: `git push origin main`** → Vercel 自动部署，等待 ~2 分钟
- [ ] **Step 3: 内置浏览器生产验收**（需用户已在 Vercel 配好 `JWT_SECRET`）：
  1. 匿名打开站点 → 不发生云端读写；点"建立上行链路"→ 猫站长出现
  2. 输入用户名 → 猫瞳孔跟随；聚焦密码 → 双爪捂眼
  3. 注册 `zhang`（示例）→ ACCESS GRANTED → 认领旧全局池（东京站/稚内站入账）
  4. 推送巡礼点 → 云端 `points:zhang` 增长；登出→再登录 → 数据一致（跨设备）
  5. 错误密码 → 猫摇头 + SIGNAL LOST
  6. 匿名 POST `/api/points` → 401
  7. curl 探针（质量审查补充）：重复注册同一用户名 → 409；畸形/非 JSON body → 4xx
  8. 截图存档六态
- [ ] **Step 4: 验收报告 + spec 勾选**

---

## Self-Review 记录

- **Spec 覆盖**：4.1 键规划（T1/T2）、4.2 会话（T1/T2）、4.3 四端点（T2）、4.4 points 隔离+迁移（T2/T3）、4.5 前端行为（T6）、5 猫站长（T4/T5）、6 测试计划（T1-T4）、8 环境变量（Task 7 验收前置，用户操作）——无缺口。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码。
- **类型一致性**：`nextCatState(event, state)`、`claimLegacyPool(kv, username)`、`pointsKeyFor(username, scope)`、`signSession(username, secret, expiry='7d')` 各任务间签名一致。
- **已知偏差**：spec 4.5 说"header 徽章替代写死的 03-JP"——03-JP 位于 SearchNavEngine（经 ControlPanel 深层渲染），为避免三层 prop 钻孔，本计划在 App header 增设徽章、SearchNavEngine 装饰文本保持原样（spec 修订随验收记录）。
