// api/auth.js —— 密钥找回（reset）链路测试
// 覆盖：邮箱校验纯函数、随机密钥生成、reset handler 各分支（无账号/未绑定/未配发信密钥/发信成功/发信失败回滚语义）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import handler, {
    resolveOptionalEmail,
    generateRandomPassword,
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
        async delete(k) { kv.m.delete(k); }
        async incr(k) { const n = Number(kv.m.get(k) || 0) + 1; kv.m.set(k, n); return n; }
        async expire() { return 1; }
        async keys(prefix) { return [...kv.m.keys()].filter(k => k.startsWith(prefix)); }
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

async function plantUser(username, password, email = null) {
    const record = {
        hash: await bcrypt.hash(password, 12),
        createdAt: new Date().toISOString(),
        ...(email ? { email } : {}),
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
});
