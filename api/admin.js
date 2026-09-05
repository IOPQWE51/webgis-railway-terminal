// api/admin.js
// 🛡️ 管理端点：为 /admin 独立页提供用户账号的轻量管理能力（列表/删除）
//
// 安全模型（2026-09）：
// - 管理员凭据来自环境变量 ADMIN_USERNAME / ADMIN_PASSWORD（个人产品，改密=改 env+重部署），
//   比较走 sha256 归一 + timingSafeEqual，不暴露长度侧信道；
// - 管理会话是独立 Cookie（et_admin），签名密钥 = JWT_SECRET + 域分隔后缀，
//   用户会话令牌即使泄露也无法重放为管理令牌；
// - Cookie Path 限定 /api/admin，永不随其他路径请求外发；
// - login 走 auth 限流档防爆破；list/del 需要有效管理会话，匿名一律 401。

import { timingSafeEqual, createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { withRateLimit } from './_lib/rateLimiter.js';
import {
    signSession,
    verifySessionToken,
    normalizeUsername
} from './auth.js';

const ADMIN_COOKIE = 'et_admin';
const isProduction = () => process.env.VERCEL_ENV === 'production';

// ---------- KV 单例（与 points.js/auth.js 相同的进程内复用模式） ----------

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

// ---------- 凭据校验 ----------

function adminEnvConfigured() {
    return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

// ⏱️ 常量时间字符串比较：先 sha256 归一等长，规避 timingSafeEqual 的长度前置校验泄露
export function safeEqualStrings(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
}

export function verifyAdminCredentials(body) {
    if (!adminEnvConfigured()) return false;
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    return safeEqualStrings(username, process.env.ADMIN_USERNAME.trim())
        && safeEqualStrings(password, process.env.ADMIN_PASSWORD);
}

// ---------- 管理会话（独立签名域：JWT_SECRET + 域分隔后缀） ----------

function adminSecret() {
    // 域分隔：与用户会话共用主密钥但派生出独立签名域，
    // 用户的 et_session 令牌即使拿到也无法在管理端通过校验
    return process.env.JWT_SECRET + '|et-admin';
}

export async function signAdminSession(username) {
    return signSession(username, adminSecret());
}

export function serializeAdminCookie(token) {
    const parts = [`${ADMIN_COOKIE}=${token}`, 'Path=/api/admin', 'HttpOnly', 'SameSite=Lax', 'Max-Age=7200'];
    if (isProduction()) parts.push('Secure');
    return parts.join('; ');
}

export function serializeAdminClearedCookie() {
    const parts = [`${ADMIN_COOKIE}=`, 'Path=/api/admin', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (isProduction()) parts.push('Secure');
    return parts.join('; ');
}

export function readCookie(req, name) {
    const header = req.headers?.cookie || '';
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(idx + 1).trim());
        } catch {
            return null; // 畸形百分号编码容错（同 auth.js 的教训）
        }
    }
    return null;
}

export async function getAdminUsername(req) {
    try {
        const token = readCookie(req, ADMIN_COOKIE);
        if (!token) return null;
        return verifySessionToken(token, adminSecret());
    } catch {
        return null; // 密钥缺失/弱密钥时 fail-closed 为未登录
    }
}

// ---------- 用户列表压缩 ----------

// 把 KV 原始行压成前端表格行：username 从键名剥离，hash 永不出端点
export function compactUserRecords(entries) {
    return entries
        .filter(e => e.key.startsWith('user:'))
        .map(e => ({
            username: e.key.slice('user:'.length),
            createdAt: e.record?.createdAt ?? null,
            pointsCount: typeof e.pointsCount === 'number' ? e.pointsCount : null
        }))
        .sort((a, b) => (a.username < b.username ? -1 : 1));
}

async function readJsonBody(req) {
    if (Number(req.headers['content-length'] || 0) > 10_000) return null;
    try { return req.body ?? null; } catch { return null; }
}

// ---------- 端点 ----------

const loginHandler = withRateLimit('auth')(async (req, res) => {
    if (!process.env.JWT_SECRET || !adminEnvConfigured()) {
        return res.status(503).json({ error: '管理服务暂不可用' });
    }
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    if (!verifyAdminCredentials(body)) {
        return res.status(401).json({ error: '管理认证失败' });
    }
    const token = await signAdminSession(process.env.ADMIN_USERNAME.trim());
    res.setHeader('Set-Cookie', serializeAdminCookie(token));
    return res.status(200).json({ ok: true });
});

const logoutHandler = withRateLimit('general')(async (req, res) => {
    res.setHeader('Set-Cookie', serializeAdminClearedCookie());
    return res.status(200).json({ ok: true });
});

const listHandler = withRateLimit('general')(async (req, res) => {
    if (!(await getAdminUsername(req))) return res.status(401).json({ error: '需要管理员登录' });
    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const keys = await redis.keys('user:*');
    const entries = [];
    for (const key of Array.isArray(keys) ? keys : []) {
        // 逐用户取档案与点位计数；用户量级为个人产品（个位数到十位数），串行足够
        const raw = await redis.get(key);
        let record = null;
        try { record = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { record = null; }
        const username = key.slice('user:'.length);
        const points = await redis.get(`points:${username}`);
        entries.push({
            key,
            record,
            pointsCount: Array.isArray(points) ? points.length : null
        });
    }
    return res.status(200).json({ users: compactUserRecords(entries) });
});

const deleteHandler = withRateLimit('auth')(async (req, res) => {
    if (!(await getAdminUsername(req))) return res.status(401).json({ error: '需要管理员登录' });
    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const body = await readJsonBody(req);
    const username = normalizeUsername(body?.username);
    if (!username) return res.status(400).json({ error: '用户名格式非法' });

    // 连同主库与战术库一起清理（键名契约见 points.js 的 pointsKeyFor）
    await redis.del(`user:${username}`, `points:${username}`, `points:${username}:dark2d`);
    return res.status(200).json({ ok: true, username });
});

export default async function handler(req, res) {
    try {
        const action = req.query?.action;
        if (req.method === 'POST' && action === 'login') return await loginHandler(req, res);
        if (req.method === 'POST' && action === 'logout') return await logoutHandler(req, res);
        if (req.method === 'POST' && action === 'delete') return await deleteHandler(req, res);
        if (req.method === 'GET' && action === 'list') return await listHandler(req, res);
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        // 只记录服务端日志，不向客户端泄露内部细节
        console.error('管理服务故障:', error.message);
        return res.status(500).json({ error: '管理服务暂不可用' });
    }
}
