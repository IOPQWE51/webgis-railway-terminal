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
const assertSecret = (secret) => {
    if (typeof secret !== 'string' || secret.length < 32) {
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
    const legacy = await kv.get(LEGACY_GLOBAL_KEY);
    if (!Array.isArray(legacy)) return 0;
    const result = validatePointsPayload(legacy);
    // 🚧 整包校验失败：不搬不删，保留现场待人工处理——一条脏数据绝不清空整个遗留池
    if (!result.ok) return -1;
    const points = result.points;
    // 🏁 nx 占坑防认领竞态：多实例同时迁移时只有一方写入成功
    const claimed = await kv.set(`points:${username}`, points, { nx: true }) === 'OK';
    await kv.set(`earth_terminal_global_points_claimed_${Date.now()}`, points);
    await kv.delete(LEGACY_GLOBAL_KEY);
    // 占坑失败说明该用户名下已有自己的点位库：归档遗留池后放弃写入，绝不覆盖既有数据
    return claimed ? points.length : 0;
}
