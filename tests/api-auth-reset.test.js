// api/auth.js —— 密钥找回（reset）链路测试
// 覆盖：邮箱校验纯函数、随机密钥生成、reset handler 各分支（无账号/未绑定/未配发信密钥/发信成功/发信失败回滚语义）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import handler, {
    resolveOptionalEmail,
    generateRandomPassword,
    generateEmailCode,
    sendVerifyEmail,
    signSession,
} from '../api/auth.js';

const SECRET = 'test-secret-32-chars-long-xxxxxxxx';

// 同 api-points-scope.test.js 的内存 KV 桩范式：构造即共享同一块内存
const kv = vi.hoisted(() => ({ m: new Map() }));
vi.mock('@upstash/redis', () => {
    class FakeRedis {
        async get(k) { return kv.m.has(k) ? kv.m.get(k) : null; }
        async set(k, v, opts) {
            if (opts?.nx && kv.m.has(k)) return null;
            kv.m.set(k, v);
            return 'OK';
        }
        async delete(k) { kv.m.delete(k); } async del(k) { kv.m.delete(k); }
        async incr(k) { const n = Number(kv.m.get(k) || 0) + 1; kv.m.set(k, n); return n; }
        async expire() { return 1; }
        // keys('user:*') 是 glob 模式语义：* 匹配任意后缀（handler 的反查扫描依赖此行为）
        async keys(pattern) {
            const prefix = pattern.replace(/\*/g, '');
            return [...kv.m.keys()].filter(k => k.startsWith(prefix));
        }
    }
    return { Redis: FakeRedis };
});

function mockRes() {
    return {
        statusCode: null,
        body: null,
        headers: {},
        setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
}

async function plantUser(username, password, email = null, { verified = true } = {}) {
    // verified 默认 true 模拟"完成 verify-email 的用户"；验证闭环分支用例显式传 false
    const record = {
        hash: await bcrypt.hash(password, 12),
        createdAt: new Date().toISOString(),
        ...(email ? { email, emailVerified: verified } : {}),
    };
    kv.m.set(`user:${username}`, JSON.stringify(record));
}

const resetReq = (username, extra = {}) => ({
    method: 'POST',
    query: { action: 'reset' },
    headers: { 'x-forwarded-for': '10.0.0.1' },
    body: { username, ...extra },
});

describe('resolveOptionalEmail（可选邮箱）', () => {
    it('未填/空白 → ok:null', () => {
        expect(resolveOptionalEmail(undefined)).toEqual({ ok: true, email: null });
        expect(resolveOptionalEmail(null)).toEqual({ ok: true, email: null });
        expect(resolveOptionalEmail('')).toEqual({ ok: true, email: null });
        expect(resolveOptionalEmail('   ')).toEqual({ ok: true, email: null });
    });
    it('合法邮箱归一化为小写', () => {
        expect(resolveOptionalEmail('  Meow@Example.COM ')).toEqual({ ok: true, email: 'meow@example.com' });
    });
    it('脏注入一律拒绝', () => {
        expect(resolveOptionalEmail('not-an-email').ok).toBe(false);
        expect(resolveOptionalEmail('a@b').ok).toBe(false);
        expect(resolveOptionalEmail('<script>@x.io').ok).toBe(false);
        expect(resolveOptionalEmail(123).ok).toBe(false);
        expect(resolveOptionalEmail('a'.repeat(201) + '@b.co').ok).toBe(false);
    });
});

describe('generateRandomPassword（重置随机密钥）', () => {
    it('12 字符 base64url，仅无歧义字符', () => {
        const p = generateRandomPassword();
        expect(p).toHaveLength(12);
        expect(p).toMatch(/^[A-Za-z0-9_-]{12}$/);
    });
    it('两次生成互不相同（96 bit 熵）', () => {
        expect(generateRandomPassword()).not.toBe(generateRandomPassword());
    });
});

describe('POST /api/auth?action=reset（密钥找回）', () => {
    beforeEach(() => {
        kv.m.clear();
        process.env.JWT_SECRET = SECRET;
        process.env.KV_REST_API_URL = 'https://mock-kv.example.com';
        process.env.KV_REST_API_TOKEN = 'mock-token';
        process.env.RESEND_API_KEY = 're_test_key';
        // Turnstile：测试环境不配 secret → 优雅跳过；不走 fetch 假桩以免撞到 Resend
        delete process.env.TURNSTILE_SECRET_KEY;
        delete process.env.ALLOW_REGISTRATION;
        delete process.env.REGISTRATION_CAP;
    });

    it('找回后新旧 hash 不同、新密钥可 bcrypt 验证、email/createdAt 保留', async () => {
        await plantUser('zhang', 'old-password-1', 'cat@example.com');
        const before = JSON.parse(kv.m.get('user:zhang'));

        globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'mail_1' }) }));
        const res = mockRes();
        await handler(resetReq('zhang'), res);
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);

        const after = JSON.parse(kv.m.get('user:zhang'));
        expect(after.hash).not.toBe(before.hash);
        expect(after.email).toBe('cat@example.com');
        expect(after.createdAt).toBe(before.createdAt);
        // 发信载荷校验：Bearer + 收件人 + 新密钥入信
        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer re_test_key');
        const payload = JSON.parse(init.body);
        expect(payload.to).toEqual(['cat@example.com']);
        expect(payload.html).toContain('zhang');
        // 新密钥从邮件 HTML 的 <strong> 块精准取出（正文里另有 ≥12 字符的英文单词，宽松正则会误取）
        const m = payload.html.match(/<strong>([A-Za-z0-9_-]{12})<\/strong>/);
        expect(m).toBeTruthy();
        expect(await bcrypt.compare(m[1], after.hash)).toBe(true);
        vi.unstubAllGlobals?.();
        delete globalThis.fetch;
    });

    it('账号不存在 → 404', async () => {
        const res = mockRes();
        await handler(resetReq('ghost'), res);
        expect(res.statusCode).toBe(404);
    });

    it('账号存在但未绑定邮箱 → 400 提示找站长', async () => {
        await plantUser('noemail', 'password-123', null);
        const res = mockRes();
        await handler(resetReq('noemail'), res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('未绑定邮箱');
    });

    it('未配 RESEND_API_KEY → 503 邮件服务暂不可用', async () => {
        delete process.env.RESEND_API_KEY;
        await plantUser('zhang', 'password-123', 'cat@example.com');
        const res = mockRes();
        await handler(resetReq('zhang'), res);
        expect(res.statusCode).toBe(503);
    });

    it('发信失败 → 502 且旧密钥哈希不动（先发信后落库语义）', async () => {
        await plantUser('zhang', 'password-123', 'cat@example.com');
        const before = JSON.parse(kv.m.get('user:zhang'));
        globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ statusCode: 401 }) }));
        const res = mockRes();
        await handler(resetReq('zhang'), res);
        expect(res.statusCode).toBe(502);
        const after = JSON.parse(kv.m.get('user:zhang'));
        expect(after.hash).toBe(before.hash);
        delete globalThis.fetch;
    });

    it('非法用户名输入 → 400', async () => {
        const res = mockRes();
        await handler(resetReq('bad name!'), res);
        expect(res.statusCode).toBe(400);
    });

    it('GET action=reset → 405（只收 POST）', async () => {
        const res = mockRes();
        await handler({ method: 'GET', query: { action: 'reset' }, headers: {} }, res);
        expect(res.statusCode).toBe(405);
    });

    // ---- 邮箱验证闭环（防拿别人邮箱注册骚扰）----
    const verifyReq = (username, extra = {}) => ({
        method: 'POST',
        query: { action: 'verify-email' },
        headers: { 'x-forwarded-for': '10.0.0.1' },
        body: { username, ...extra },
    });

    it('未验证邮箱的账号 reset → 400 提示先完成验证（骚扰链路被掐断）', async () => {
        await plantUser('newbie', 'password-123', 'new@example.com', { verified: false });
        const res = mockRes();
        await handler(resetReq('newbie'), res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('尚未完成绑定验证');
    });

    it('verify-email 收码正确 → emailVerified=true，随后 reset 放行', async () => {
        await plantUser('newbie', 'password-123', 'new@example.com', { verified: false });
        kv.m.set('emailcode:newbie', '654321');
        const res = mockRes();
        await handler(verifyReq('newbie', { code: '654321' }), res);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(kv.m.get('user:newbie')).emailVerified).toBe(true);
        // 验证码取到即焚
        expect(kv.m.has('emailcode:newbie')).toBe(false);

        // 随后 reset 真放行（真实发信）
        globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'm2' }) }));
        const r2 = mockRes();
        await handler(resetReq('newbie'), r2);
        expect(r2.statusCode).toBe(200);
        delete globalThis.fetch;
    });

    it('verify-email 码错误 → 400 且 emailVerified 不变', async () => {
        await plantUser('newbie', 'password-123', 'new@example.com', { verified: false });
        kv.m.set('emailcode:newbie', '654321');
        const res = mockRes();
        await handler(verifyReq('newbie', { code: '111111' }), res);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(kv.m.get('user:newbie')).emailVerified).toBe(false);
    });

    it('verify-email 重发 → 60s 冷却键占坑，二连发 429', async () => {
        await plantUser('newbie', 'password-123', 'new@example.com', { verified: false });
        globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'm3' }) }));
        const r1 = mockRes();
        await handler(verifyReq('newbie', { resend: '1' }), r1);
        expect(r1.statusCode).toBe(200);
        expect(kv.m.get('emailcode:newbie')).toBeTruthy(); // 新码已落 KV
        const r2 = mockRes();
        await handler(verifyReq('newbie', { resend: '1' }), r2);
        expect(r2.statusCode).toBe(429);
        delete globalThis.fetch;
    });

    it('verify-email 已验证账号 → 幂等 200；未绑邮箱账号 → 400 无需验证', async () => {
        await plantUser('done', 'password-123', 'ok@example.com');
        kv.m.set('user:done', JSON.stringify({ ...JSON.parse(kv.m.get('user:done')), emailVerified: true }));
        const r1 = mockRes();
        await handler(verifyReq('done', { code: '000000' }), r1);
        expect(r1.statusCode).toBe(200);

        await plantUser('noemail', 'password-123', null);
        const r2 = mockRes();
        await handler(verifyReq('noemail'), r2);
        expect(r2.statusCode).toBe(400);
    });

    // ---- 邮箱反查代号（用户名遗忘自救）----
    it('reset 只填邮箱（代号留空）→ 反查到账号并发信，邮件里含代号', async () => {
        await plantUser('forgetful', 'password-123', 'me@example.com');
        kv.m.set('user:forgetful', JSON.stringify({ ...JSON.parse(kv.m.get('user:forgetful')), emailVerified: true }));
        globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'm4' }) }));
        const res = mockRes();
        await handler({ method: 'POST', query: { action: 'reset' }, headers: {}, body: { email: 'me@example.com' } }, res);
        expect(res.statusCode).toBe(200);
        const [, init] = globalThis.fetch.mock.calls[0];
        expect(JSON.parse(init.body).html).toContain('forgetful');
        delete globalThis.fetch;
    });

    it('reset 代号与邮箱都空 → 400；邮箱匹配不到任何账号 → 404', async () => {
        const r1 = mockRes();
        await handler({ method: 'POST', query: { action: 'reset' }, headers: {}, body: {} }, r1);
        expect(r1.statusCode).toBe(400);
        const r2 = mockRes();
        await handler({ method: 'POST', query: { action: 'reset' }, headers: {}, body: { email: 'ghost@example.com' } }, r2);
        expect(r2.statusCode).toBe(404);
    });

    it('generateEmailCode 6 位数字 + sendVerifyEmail 载荷含验证码', async () => {
        const c = generateEmailCode();
        expect(c).toMatch(/^\d{6}$/);
        globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'm5' }) }));
        expect(await sendVerifyEmail('a@b.co', 'cat', '123456')).toBe(true);
        const [, init] = globalThis.fetch.mock.calls[0];
        const payload = JSON.parse(init.body);
        expect(payload.subject).toContain('验证码');
        expect(payload.html).toContain('123456');
        delete globalThis.fetch;
    });
});
