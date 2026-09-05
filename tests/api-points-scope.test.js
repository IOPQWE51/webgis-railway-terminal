import { describe, it, expect } from 'vitest';
import { pointsKeyFor } from '../api/points.js';
import { signSession, parseSessionCookie } from '../api/auth.js';

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

// getSessionUsername(req) 内部读 process.env.JWT_SECRET，测试无法注入密钥；
// 故走同一链路 parseSessionCookie → verifySessionToken（显式注入 secret）等价验证。
// （计划原样含 getSessionUsername import，因 lint no-unused-vars 移除——本文件不直接调用它）
async function verifyForTest(req, secret) {
    const token = parseSessionCookie(req);
    const { verifySessionToken } = await import('../api/auth.js');
    return verifySessionToken(token, secret);
}
