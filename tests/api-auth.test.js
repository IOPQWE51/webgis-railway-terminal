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
