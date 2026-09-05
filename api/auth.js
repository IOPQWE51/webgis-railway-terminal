// api/auth.js
// 🔐 轻登录与会话：用户名 + 密码（bcryptjs）+ JWT（jose，HS256，7 天）
// - 用户库与点位库均存 Vercel KV（Upstash Redis），键按用户名隔离：
//     user:<username>   → { hash, createdAt }
//     points:<username> → 点位数组（写入前经 validatePointsPayload 硬校验）
// - 会话 Cookie：et_session（HttpOnly / SameSite=Lax，生产追加 Secure）
// - 端点：POST ?action=register|login|logout、GET ?action=me（register/login 走 auth 限流防爆破）
// - 遗留迁移：首个注册用户自动认领旧全局池 earth_terminal_global_points 与
//   旧战术库 earth_terminal_dark2d_points（对称迁移，防孤儿键），旧键改名归档

import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { withRateLimit } from './_lib/rateLimiter.js';
import { validatePointsPayload, getClientIp } from './_lib/validation.js';

export const COOKIE_NAME = 'et_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const LEGACY_GLOBAL_KEY = 'earth_terminal_global_points';
const LEGACY_DARK2D_KEY = 'earth_terminal_dark2d_points';

// ---------- 纯函数层（tests/api-auth.test.js 覆盖） ----------

export function normalizeUsername(raw) {
    const u = String(raw ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(u)) return null;
    return u;
}

// 已知限制：72 为字符数而非 bcrypt 的 72 字节，超长多字节密码会被截断
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
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        // 🍪 Cookie 值客户端可控，畸形百分号编码（如裸 %）按无会话处理，绝不抛 URIError
        return null;
    }
}

// 🔑 弱密钥会让 HS256 签名可被暴力破解：任何入口遇到弱密钥立即拒绝，绝不静默降级
export function isStrongSecret(secret) {
    return typeof secret === 'string' && secret.length >= 32;
}

const assertSecret = (secret) => {
    if (!isStrongSecret(secret)) {
        throw new Error('JWT_SECRET 必须为至少 32 位的字符串');
    }
};

const secretKey = (secret) => new TextEncoder().encode(secret);

export async function signSession(username, secret, expiry = '7d') {
    assertSecret(secret);
    return new SignJWT({ sub: username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(secretKey(secret));
}

export async function verifySessionToken(token, secret) {
    if (!token || !secret) return null;
    try {
        assertSecret(secret);
        const { payload } = await jwtVerify(token, secretKey(secret));
        // 🧭 sub 过 normalizeUsername 规范化，防大小写变体分裂出平行用户命名空间
        return normalizeUsername(payload.sub);
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
    // 全局认领锁：跨用户并发注册时保证"先到先得"——仅靠 nx 占坑只能防同名并发，
    // 两个不同用户会在对方写入前都 get 到遗留池并各自 set 到自己的 points:<user> 键，
    // 遗留池被复制进两个账户；ex TTL 兜底持锁方崩溃后锁可自动恢复
    const lockKey = 'lock:legacy_pool_claim';
    const locked = await kv.set(lockKey, username, { nx: true, ex: 60 });
    if (locked !== 'OK') return 0;
    const legacy = await kv.get(LEGACY_GLOBAL_KEY);
    if (!Array.isArray(legacy)) return 0;
    const result = validatePointsPayload(legacy);
    // 🚧 整包校验失败：不搬不删，保留现场待人工处理——一条脏数据绝不清空整个遗留池
    if (!result.ok) {
        // 尽力释放锁（失败由 ex TTL 兜底）：运营清完脏数据后其他用户仍有机会认领
        try { await kv.delete(lockKey); } catch { /* 释放失败 60s 后锁自动过期 */ }
        return -1;
    }
    const points = result.points;
    // 🏁 nx 占坑防同名竞态：全局锁已保证跨用户先到先得，这里占坑失败说明该用户名下
    // 已有自己的点位库：归档遗留池后放弃写入，绝不覆盖既有数据
    // 成功路径保留锁作为永久认领标记，防止锁过期后被重复迁移
    const claimed = await kv.set(`points:${username}`, points, { nx: true }) === 'OK';
    await kv.set(`earth_terminal_global_points_claimed_${Date.now()}`, points);
    await kv.delete(LEGACY_GLOBAL_KEY);

    // 🕳️ dark2d 战术库对称认领：旧战术库与主池是同一批遗留数据，只认领主池会把
    //    战术库云副本永久变成孤儿键。两个池共用同一把全局锁——一次注册一次锁，
    //    一起处理，避免主池认领后锁被标记占用导致战术库永远轮不到认领。
    //    （键名与 pointsKeyFor 的 dark2d 规则保持一致；此处不 import points.js，
    //    因为 points.js 依赖本模块，反向引用会造成循环依赖）
    const legacyDark2d = await kv.get(LEGACY_DARK2D_KEY);
    if (Array.isArray(legacyDark2d)) {
        const darkResult = validatePointsPayload(legacyDark2d);
        // 🚧 与主池脏数据同语义：不搬不删保留现场待人工处理，尽力释放锁（失败由
        //    ex TTL 兜底）让后续用户仍有机会处理；主池刚完成的认领是已落库的事实，
        //    不受战术库脏数据影响
        if (!darkResult.ok) {
            try { await kv.delete(lockKey); } catch { /* 释放失败 60s 后锁自动过期 */ }
            return -1;
        }
        // 🏁 nx 占坑：该用户名下已有战术库则放弃写入但照常归档旧键（数据不丢）
        await kv.set(`points:${username}:dark2d`, darkResult.points, { nx: true });
        await kv.set(`earth_terminal_dark2d_points_claimed_${Date.now()}`, darkResult.points);
        await kv.delete(LEGACY_DARK2D_KEY);
    }

    return claimed ? points.length : 0;
}

// ---------- KV 单例（与 points.js / rateLimiter.js 相同的进程内复用模式） ----------

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
    // 防御纵深：注册/登录请求体不可能超过 10KB，超出即视为滥用
    if (Number(req.headers['content-length'] || 0) > 10_000) return null;
    // 🧩 Vercel Node 运行时没有 req.json()：平台已把 JSON 请求体解析进 req.body
    //    （与 points.js 同模式）；取不到说明体为空或畸形，按错误体统一拒绝
    return req.body ?? null;
}

// 🔑 密钥预检：缺失或弱密钥一律 503 fail-closed。不能等到 signSession 才暴露——
//    register 在签名之前就已写入 KV，半途抛错会留下"注册成功却拿不到会话"的半成品
function requireSecret(res) {
    if (!isStrongSecret(process.env.JWT_SECRET)) {
        res.status(503).json({ error: '认证服务暂不可用' });
        return false;
    }
    return true;
}

// ---------- 端点（register/login 走 auth 档防爆破） ----------

// 🤖 Turnstile 人机验证：配置了 TURNSTILE_SECRET_KEY 才强制校验（本地开发/灰度期优雅跳过）。
// 防的是"代理池换 IP 绕过 IP 限流"的分布式撞库——IP 限流挡不住的那一类。
export function turnstileEnforced() {
    return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Cloudflare 令牌单次有效：siteverify 会消费令牌，验证失败的调用方须重取新令牌
export async function verifyTurnstile(token, remoteip) {
    if (!turnstileEnforced()) return true;
    if (typeof token !== 'string' || token === '') return false;
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: process.env.TURNSTILE_SECRET_KEY,
                response: token,
                ...(remoteip ? { remoteip } : {})
            })
        });
        const data = await res.json();
        return data?.success === true;
    } catch {
        return false; // 验证服务失联视为未通过（fail-closed）
    }
}

const registerHandler = withRateLimit('auth')(async (req, res) => {
    if (!requireSecret(res)) return;
    if (process.env.ALLOW_REGISTRATION === 'false') {
        return res.status(403).json({ error: '注册通道已关闭' });
    }
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    // 人机验证放在凭据校验之前：fail-fast 且不给撞库脚本任何探测信号
    if (!(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return res.status(400).json({ error: '人机验证未通过，请刷新后重试' });
    }
    const creds = validateCredentials(body);
    if (!creds.ok) return res.status(400).json({ error: creds.error });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const record = await buildUserRecord(creds.password);
    // ⚛️ nx = 不存在才写入，规避"检查-写入"竞态（多实例并发注册同一代号）
    const created = await redis.set(`user:${creds.username}`, JSON.stringify(record), { nx: true });
    if (created !== 'OK') return res.status(409).json({ error: '该节点代号已被注册' });

    // 迁移是机会性收益（3 次 KV 往返）：任一网络抖动抛错若冒泡到顶层 catch 会 500，
    // 而用户行已写入——用户重试只会撞 409，留下"已注册但收到 500"的半成品；
    // 故认领失败只记日志，不影响注册结果
    try {
        await claimLegacyPool(redis, creds.username);
    } catch (e) {
        console.error('遗留池认领失败（不影响注册）:', e.message);
    }

    const token = await signSession(creds.username, process.env.JWT_SECRET);
    res.setHeader('Set-Cookie', serializeSessionCookie(token, isProduction()));
    return res.status(201).json({ ok: true, username: creds.username });
});

const loginHandler = withRateLimit('auth')(async (req, res) => {
    if (!requireSecret(res)) return;
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    if (!(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return res.status(400).json({ error: '人机验证未通过，请刷新后重试' });
    }
    const creds = validateCredentials(body);
    if (!creds.ok) return res.status(400).json({ error: creds.error });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    // Upstash REST 可能返回反序列化对象或原始字符串，两种形态都兼容
    const raw = await redis.get(`user:${creds.username}`);
    let record = null;
    try { record = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { record = null; }
    const valid = Boolean(record && typeof record.hash === 'string') && (await bcrypt.compare(creds.password, record.hash));
    // 🎭 统一 401 文案：不区分"代号不存在/密钥错误"，堵死用户枚举侧信道
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
