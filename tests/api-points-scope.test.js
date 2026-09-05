import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import handler, { pointsKeyFor } from '../api/points.js';
import { signSession, parseSessionCookie, verifySessionToken, claimLegacyPool } from '../api/auth.js';

const SECRET = 'test-secret-32-chars-long-xxxxxxxx';

// 共享内存 KV：@upstash/redis 的 Redis 类被替换为"构造即得到同一块内存存储"，
// 让 points.js / rateLimiter.js 各自的进程内单例都落到这里，测试后可断言键名。
// reads 记录每次 get 的键名——读取路径没有写入痕迹，只能靠它断言"读了哪把键"。
const kv = vi.hoisted(() => ({ m: new Map(), reads: [] }));

vi.mock('@upstash/redis', () => {
    class FakeRedis {
        async get(k) { kv.reads.push(k); return kv.m.has(k) ? kv.m.get(k) : null; }
        async set(k, v, opts) {
            // 🔒 nx 占坑语义：键已存在时不写入并返回 null（对齐 Upstash Redis SET NX）
            if (opts?.nx && kv.m.has(k)) return null;
            kv.m.set(k, v);
            return 'OK';
        }
        async delete(k) { kv.m.delete(k); } async del(k) { kv.m.delete(k); }
        // rateLimiter 分布式档使用的最小 INCR/EXPIRE，保持限流路径可用而非走异常降级
        async incr(k) { const n = Number(kv.m.get(k) || 0) + 1; kv.m.set(k, n); return n; }
        async expire() { return 1; }
    }
    return { Redis: FakeRedis };
});

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

// getSessionUsername(req) 内部读 process.env.JWT_SECRET，端点级测试通过
// beforeAll 注入 JWT_SECRET=SECRET 后走真实链路；此处显式注入 secret 等价验证。
async function verifyForTest(req, secret) {
    return verifySessionToken(parseSessionCookie(req), secret);
}

// ---------- 端点级安全行为（handler 级） ----------

// 合法点位样本（通过 validatePointsPayload 校验的最小形态）
const point = (id, name) => ({ id, name, lat: 35.68, lon: 139.76, category: 'station', source: '手动捕获' });

// 链式 res 桩：对齐 Vercel 的 res.status(c).json(b) 与 rateLimiter 的 res.setHeader 用法
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

async function cookieFor(username) {
    const token = await signSession(username, SECRET);
    return `et_session=${encodeURIComponent(token)}`;
}

describe('points 端点级安全行为（handler 级）', () => {
    let savedUrl, savedToken;

    beforeAll(() => {
        process.env.JWT_SECRET = SECRET;
        savedUrl = process.env.KV_REST_API_URL;
        savedToken = process.env.KV_REST_API_TOKEN;
        // 先不配 KV 环境变量：匿名用例借此锁死"鉴权先于 KV 配置检查"——
        // 匿名 + KV 未配置必须 401（而非 500），不向探测者泄露基础设施配置状态
        delete process.env.KV_REST_API_URL;
        delete process.env.KV_REST_API_TOKEN;
    });

    afterAll(() => {
        // 还原现场，避免 env 泄漏影响同进程内其他测试
        if (savedUrl === undefined) delete process.env.KV_REST_API_URL; else process.env.KV_REST_API_URL = savedUrl;
        if (savedToken === undefined) delete process.env.KV_REST_API_TOKEN; else process.env.KV_REST_API_TOKEN = savedToken;
    });

    // 注意：以下两个匿名用例必须先于"已登录"用例执行——鉴权前置保证匿名请求
    // 不会触达 getRedis()，points.js 的模块级单例得以在 KV env 配置后才初始化
    it('匿名 GET → 401（KV 未配置也不得 500）', async () => {
        const res = mockRes();
        await handler({ method: 'GET', headers: {}, query: {} }, res);
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: '需要登录' });
    });

    it('匿名 POST（合法 body）→ 401', async () => {
        const res = mockRes();
        await handler({ method: 'POST', headers: {}, query: {}, body: [point('a', '点位')] }, res);
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: '需要登录' });
    });

    describe('已登录（KV env 指向内存桩）', () => {
        beforeAll(() => {
            process.env.KV_REST_API_URL = 'https://mock-kv.example.com';
            process.env.KV_REST_API_TOKEN = 'mock-token';
        });

        it('已登录 GET 读取的是 points:<自己>（键名断言）', async () => {
            const mine = [point('mine', '我的点位')];
            kv.m.set('points:zhang', mine);
            kv.m.set('points:other', [point('other', '别人的点位')]);
            kv.reads.length = 0;

            const res = mockRes();
            await handler({ method: 'GET', headers: { cookie: await cookieFor('zhang') }, query: {} }, res);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ source: 'cloud', scope: 'main', data: mine });
            // 🔍 键名断言：读的正是自己的键，从未触碰别人的键
            expect(kv.reads).toContain('points:zhang');
            expect(kv.reads).not.toContain('points:other');
        });

        it('已登录 POST 写入 points:<自己>，写不进别人的键', async () => {
            const otherPoints = [point('other', '别人的点位')];
            kv.m.set('points:other', otherPoints);
            const payload = [point('p1', '新点位一'), point('p2', '新点位二')];

            const res = mockRes();
            await handler({ method: 'POST', headers: { cookie: await cookieFor('zhang') }, query: {}, body: payload }, res);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true, scope: 'main', count: 2, limit: 2000 });
            expect(kv.m.get('points:zhang')).toEqual(payload);
            expect(kv.m.get('points:other')).toEqual(otherPoints);
            // 全库盘点：points: 前缀的键只有自己与他人既有两把，没有多出任何越权键
            const pointsKeys = [...kv.m.keys()].filter((k) => k.startsWith('points:'));
            expect(pointsKeys.sort()).toEqual(['points:other', 'points:zhang']);
        });
    });
});

// ---------- 遗留池认领纳入 dark2d（claimLegacyPool 对称迁移） ----------

// 内存 KV 桩（同 tests/api-auth.test.js 的 FakeKV 语义：nx 占坑 + get/set/delete）
class ClaimFakeKV {
    constructor() { this.m = new Map(); }
    async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
    async set(k, v, opts) {
        if (opts?.nx && this.m.has(k)) return null;
        this.m.set(k, v);
        return 'OK';
    }
    async delete(k) { this.m.delete(k); }
    async del(k) { this.m.delete(k); }
}

describe('claimLegacyPool 纳入 dark2d 战术库（对称认领防孤儿键）', () => {
    it('主池与 dark2d 池同时存在时一起迁移，dark2d 迁到 points:<u>:dark2d', async () => {
        const kv2 = new ClaimFakeKV();
        await kv2.set('earth_terminal_global_points', [point('a', '主池点位')]);
        await kv2.set('earth_terminal_dark2d_points', [point('d1', '战术点位')]);

        const n = await claimLegacyPool(kv2, 'zhang');

        // 返回值保持主池口径（向后兼容：现有调用方不看返回值）
        expect(n).toBe(1);
        expect(await kv2.get('points:zhang')).toHaveLength(1);
        expect(await kv2.get('points:zhang:dark2d')).toHaveLength(1);
        expect(await kv2.get('earth_terminal_dark2d_points')).toBe(null);
        const archived = [...kv2.m.keys()].find((k) => k.startsWith('earth_terminal_dark2d_points_claimed_'));
        expect(archived).toBeTruthy();
        expect(await kv2.get(archived)).toHaveLength(1);
    });

    it('dark2d 池为空时跳过不报错，主池照常认领', async () => {
        const kv2 = new ClaimFakeKV();
        await kv2.set('earth_terminal_global_points', [point('a', '主池点位')]);

        expect(await claimLegacyPool(kv2, 'zhang')).toBe(1);
        expect(await kv2.get('points:zhang')).toHaveLength(1);
        expect(await kv2.get('points:zhang:dark2d')).toBe(null);
    });

    it('dark2d 池整包脏数据：不搬不删返回 -1，主池已认领的结果不受影响', async () => {
        const kv2 = new ClaimFakeKV();
        await kv2.set('earth_terminal_global_points', [point('a', '主池点位')]);
        await kv2.set('earth_terminal_dark2d_points', [{ id: 'bad', name: '脏数据', lat: 999, lon: 0, category: 'station', source: '手动捕获' }]);

        expect(await claimLegacyPool(kv2, 'zhang')).toBe(-1);
        // 主池认领已落库，是既成事实
        expect(await kv2.get('points:zhang')).toHaveLength(1);
        expect(await kv2.get('earth_terminal_global_points')).toBe(null);
        // dark2d 保留现场待人工处理
        expect(await kv2.get('points:zhang:dark2d')).toBe(null);
        expect(await kv2.get('earth_terminal_dark2d_points')).toHaveLength(1);
        expect([...kv2.m.keys()].some((k) => k.startsWith('earth_terminal_dark2d_points_claimed_'))).toBe(false);
    });
});
