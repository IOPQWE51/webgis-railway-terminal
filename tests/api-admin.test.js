import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    safeEqualStrings,
    verifyAdminCredentials,
    compactUserRecords,
    serializeAdminCookie,
    serializeAdminClearedCookie,
    readCookie,
    signAdminSession,
    getAdminUsername
} from '../api/admin.js';

const SECRET = 'test-secret-32-chars-long-xxxxxxxx';

describe('safeEqualStrings 常量时间比较', () => {
    it('相同字符串返回 true', () => {
        expect(safeEqualStrings('admin', 'admin')).toBe(true);
        expect(safeEqualStrings('', '')).toBe(true);
    });
    it('不同内容/不同长度返回 false', () => {
        expect(safeEqualStrings('admin', 'Admin')).toBe(false);
        expect(safeEqualStrings('admin', 'adminx')).toBe(false);
        expect(safeEqualStrings('a', 'b')).toBe(false);
    });
    it('非字符串入参一律 false', () => {
        expect(safeEqualStrings(null, 'x')).toBe(false);
        expect(safeEqualStrings('x', undefined)).toBe(false);
        expect(safeEqualStrings(123, 123)).toBe(false);
    });
});

describe('verifyAdminCredentials 环境变量凭据校验', () => {
    const OLD_ENV = { ...process.env };
    beforeEach(() => {
        process.env.ADMIN_USERNAME = 'boss';
        process.env.ADMIN_PASSWORD = 'hunter2-secret';
    });
    afterEach(() => { process.env = { ...OLD_ENV }; });

    it('凭据匹配返回 true', () => {
        expect(verifyAdminCredentials({ username: 'boss', password: 'hunter2-secret' })).toBe(true);
    });
    it('用户名带首尾空白仍可匹配（trim 归一）', () => {
        expect(verifyAdminCredentials({ username: ' boss ', password: 'hunter2-secret' })).toBe(true);
    });
    it('任一字段错误返回 false', () => {
        expect(verifyAdminCredentials({ username: 'boss', password: 'wrong' })).toBe(false);
        expect(verifyAdminCredentials({ username: 'hacker', password: 'hunter2-secret' })).toBe(false);
    });
    it('环境变量未配置时 fail-closed 返回 false', () => {
        delete process.env.ADMIN_USERNAME;
        expect(verifyAdminCredentials({ username: 'boss', password: 'hunter2-secret' })).toBe(false);
    });
    it('非对象 body 安全返回 false', () => {
        expect(verifyAdminCredentials(null)).toBe(false);
        expect(verifyAdminCredentials('x')).toBe(false);
    });
});

describe('compactUserRecords 用户列表压缩', () => {
    it('剥离 user: 前缀、脱敏 hash、带点位计数', () => {
        const out = compactUserRecords([
            { key: 'user:zhang', record: { hash: '$2a$12$xxx', createdAt: '2026-09-05T10:00:00Z' }, pointsCount: 12 },
            { key: 'user:amy', record: { hash: '$2a$12$yyy' }, pointsCount: 0 }
        ]);
        expect(out).toEqual([
            { username: 'amy', createdAt: null, pointsCount: 0 },
            { username: 'zhang', createdAt: '2026-09-05T10:00:00Z', pointsCount: 12 }
        ]);
    });
    it('忽略非 user: 前缀的键', () => {
        const out = compactUserRecords([
            { key: 'points:zhang', record: null, pointsCount: 5 },
            { key: 'user:zhang', record: null, pointsCount: null }
        ]);
        expect(out).toEqual([{ username: 'zhang', createdAt: null, pointsCount: null }]);
    });
});

describe('admin 会话独立域（用户令牌不可重放为管理令牌）', () => {
    const OLD_SECRET = process.env.JWT_SECRET;
    beforeEach(() => { process.env.JWT_SECRET = SECRET; });
    afterEach(() => {
        if (OLD_SECRET === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = OLD_SECRET;
    });

    it('signAdminSession 签发 → Cookie → getAdminUsername 往返成立', async () => {
        const token = await signAdminSession('boss');
        const cookie = serializeAdminCookie(token);
        expect(cookie).toContain('et_admin=');
        expect(cookie).toContain('Path=/api/admin');
        expect(cookie).toContain('HttpOnly');
        const req = { headers: { cookie: `${cookie}` } };
        expect(await getAdminUsername(req)).toBe('boss');
    });
    it('用户会话令牌放进管理 Cookie 必须被拒（密钥域分隔）', async () => {
        const { signSession } = await import('../api/auth.js');
        const userToken = await signSession('zhang', SECRET);
        const req = { headers: { cookie: `et_admin=${encodeURIComponent(userToken)}` } };
        expect(await getAdminUsername(req)).toBe(null);
    });
    it('清除 Cookie 序列化含 Max-Age=0', () => {
        expect(serializeAdminClearedCookie()).toContain('Max-Age=0');
    });
    it('readCookie 解析多段 Cookie 并容错畸形段', async () => {
        const token = await signAdminSession('boss');
        const req = { headers: { cookie: `foo=bar; et_admin=${encodeURIComponent(token)}; badsegment; baz=qux` } };
        expect(await getAdminUsername(req)).toBe('boss');
        expect(readCookie({ headers: { cookie: 'a=1' } }, 'et_admin')).toBe(null);
        expect(readCookie({ headers: {} }, 'et_admin')).toBe(null);
    });
});
