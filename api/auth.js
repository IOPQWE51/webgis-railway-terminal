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
