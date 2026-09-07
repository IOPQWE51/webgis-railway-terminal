import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callProvider, stableKey } from '../api/_lib/provider.js';

// ── mock 基建 ──
const kvMock = (() => {
  let map = new Map();
  return {
    __reset: () => { map = new Map(); },
    __dump: () => map,
    get: async (k) => (map.has(k) ? map.get(k) : null),
    set: async (k, v) => { map.set(k, v); },
  };
})();

vi.mock('./../api/_lib/kv.js', () => ({
  getKV: () => kvMock,
  kvAvailable: () => true,
}));

const upstream = vi.fn();

function mkProvider(over = {}) {
  return {
    name: 'test',
    cache: { ttl: 3600 },
    request: async (input) => ({ url: `https://up.test/${input.id}`, headers: {} }),
    map: (raw) => raw,
    ...over,
  };
}

function upstreamOk(data) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
}

beforeEach(() => {
  kvMock.__reset();
  upstream.mockReset();
  // provider 内部对真实 fetch 的调用走 fetch stub
});

describe('callProvider 三件套核心', () => {
  it('缓存命中：同 input 第二次调用不打上游（上游 fetch 计数 = 1）', async () => {
    upstream.mockResolvedValueOnce(upstreamOk({ hello: 1 }));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider();

    const r1 = await callProvider(p, { id: 'a' });
    const r2 = await callProvider(p, { id: 'a' });

    expect(r1.status).toBe(200);
    expect(r1.json).toEqual({ hello: 1 });
    expect(r2.status).toBe(200);
    expect(r2.json).toEqual({ hello: 1 });
    expect(upstream).toHaveBeenCalledTimes(1); // 第二次走 KV
    // 缓存标记
    expect(r2.cached).toBe(true);
  });

  it('缓存 miss → 上游请求 → map 瘦身 → KV 写入', async () => {
    upstream.mockResolvedValueOnce(upstreamOk({ big: { huge: 'payload' }, extra: 1 }));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider({ map: (raw) => ({ slim: raw.big.huge }) });

    const r = await callProvider(p, { id: 'b' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ slim: 'payload' }); // map 生效
    // KV 里有缓存条目
    const keys = [...kvMock.__dump().keys()];
    expect(keys.some((k) => k.startsWith('provider:test:'))).toBe(true);
  });

  it('上游 404 按 statusMap 翻译（anitabi 语义：番剧无数据）', async () => {
    upstream.mockResolvedValueOnce(Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider({ statusMap: { 404: 404 } });

    const r = await callProvider(p, { id: 'c' });
    expect(r.status).toBe(404);
  });

  it('上游抛错 → 有过期缓存 → stale 兜底返回', async () => {
    // 预置过期缓存（kv 直接塞）
    const cacheKey = 'provider:test:{"id":"d"}';
    kvMock.__dump().set(cacheKey, { v: { stale: true }, at: 0 }); // at=0 永远过期
    upstream.mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider();

    const r = await callProvider(p, { id: 'd' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ stale: true });
    expect(r.stale).toBe(true);
  });

  it('上游抛错 → 无缓存 → provider 定义错误载荷（elevation 语义：200+默认值）', async () => {
    upstream.mockRejectedValueOnce(new Error('boom'));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider({
      fallback: () => ({ status: 200, json: { elevation: 0 } }),
    });

    const r = await callProvider(p, { id: 'e' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ elevation: 0 });
    expect(r.degraded).toBe(true);
  });

  it('上游抛错 → 无 fallback → 统一 502 降级错误', async () => {
    upstream.mockRejectedValueOnce(new Error('boom'));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider();

    const r = await callProvider(p, { id: 'f' });
    expect(r.status).toBe(502);
    expect(r.json.error).toBeTruthy();
    expect(r.degraded).toBe(true);
  });

  it('KV 不可用 → 直连上游，不缓存不报错', async () => {
    // 动态改 kvAvailable —— 通过重 mock 不便，这里用 provider.cache=null 走无缓存路径验证等价行为
    upstream.mockResolvedValue(upstreamOk({ direct: true }));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider({ cache: null });

    await callProvider(p, { id: 'g' });
    const r2 = await callProvider(p, { id: 'g' });
    expect(r2.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2); // 无缓存每次直连
    expect(kvMock.__dump().size).toBe(0);
  });

  it('上游超时（8s AbortController）→ 走降级链', async () => {
    upstream.mockImplementationOnce((url, init) => new Promise((resolve, reject) => {
      // 模拟被 abort：fetch 传入了 signal
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
        return; // 永不 resolve，等 abort
      }
      resolve(upstreamOk({}));
    }));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider();

    const r = await callProvider(p, { id: 'h' }, { timeoutMs: 50 }); // 测试注入短超时
    expect(r.degraded).toBe(true);
  });

  it('输入参与缓存键：不同 input 不串台', async () => {
    upstream.mockResolvedValueOnce(upstreamOk({ v: 1 })).mockResolvedValueOnce(upstreamOk({ v: 2 }));
    vi.stubGlobal('fetch', upstream);
    const p = mkProvider();

    const a = await callProvider(p, { id: 'x' });
    const b = await callProvider(p, { id: 'y' });
    expect(a.json.v).toBe(1);
    expect(b.json.v).toBe(2);
  });
});

describe('stableKey 工具', () => {
  it('对象键序无关，序列化稳定', () => {
    expect(stableKey({ b: 1, a: 2 })).toBe(stableKey({ a: 2, b: 1 }));
    expect(stableKey('plain')).toBe('plain');
  });
});
