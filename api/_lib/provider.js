// api/_lib/provider.js
// 🧩 Provider 适配层三件套（#11）—— "适配器 + KV 缓存 + 失败降级" 统一数据源接入
// 设计契约见 specs/2026-09-07-provider-layer-design.md
//
// 一个 provider 定义 = 一个数据源的全部接入知识：
//   { name, cache:{ttl}, request(input), map(raw,input), statusMap?, fallback?(input) }
// callProvider 统一执行：KV 读 → 上游（8s 超时 AbortController）→ map 瘦身 → KV 写；
// 失败链：过期缓存 stale 兜底 → provider.fallback 自定义降级 → 统一 502。
//
// 外部契约纪律：各端点响应 JSON 与状态码语义逐家保持，前端零改动。

import { getKV } from './kv.js';

const DEFAULT_TIMEOUT_MS = 8000;

/** 稳定缓存键：对象键序无关（JSON 排序序列化） */
export function stableKey(input) {
  if (input === null || typeof input !== 'object') return String(input);
  const sortDeep = (v) => {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((acc, k) => { acc[k] = sortDeep(v[k]); return acc; }, {});
    }
    return v;
  };
  return JSON.stringify(sortDeep(input));
}

const cacheKeyFor = (provider, input) => `provider:${provider.name}:${stableKey(input)}`;

const isFresh = (entry, ttl) =>
  entry && typeof entry.at === 'number' && (Date.now() - entry.at) < ttl * 1000;

/**
 * Provider 调用门面。
 * @returns {Promise<{status:number, json:*, cached?:boolean, stale?:boolean, degraded?:boolean}>}
 */
export async function callProvider(provider, input, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const kv = getKV();
  const cacheKey = provider.cache && provider.cache.ttl ? cacheKeyFor(provider, input) : null;

  // 1️⃣ KV 读缓存（新鲜命中直接返回，不打上游）
  if (kv && cacheKey) {
    try {
      const entry = await kv.get(cacheKey);
      if (isFresh(entry, provider.cache.ttl)) {
        return { status: 200, json: entry.v, cached: true };
      }
    } catch { /* KV 故障不阻断主链路 */ }
  }

  // 2️⃣ 上游请求（超时中断）
  let raw;
  try {
    const { url, headers, init } = await provider.request(input);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { headers: headers || {}, ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const mapped = provider.statusMap && provider.statusMap[res.status];
      if (mapped) {
        // 语义翻译类（如 anitabi 404：番剧无数据 —— 透传给前端渲染空态）
        return { status: mapped, json: { error: `上游返回 ${res.status}` } };
      }
      throw new Error(`上游异常 HTTP ${res.status}`);
    }
    raw = await res.json();
  } catch (err) {
    // 3️⃣ 失败降级链：过期缓存 stale 兜底 → fallback → 统一 502
    if (kv && cacheKey) {
      try {
        const entry = await kv.get(cacheKey);
        if (entry && entry.v !== undefined) {
          console.warn(`⚠️ [${provider.name}] 上游失败，返回过期缓存兜底:`, err.message);
          return { status: 200, json: entry.v, stale: true };
        }
      } catch { /* 双重故障：走 fallback */ }
    }
    if (typeof provider.fallback === 'function') {
      console.warn(`⚠️ [${provider.name}] 上游失败，走 fallback 降级:`, err.message);
      const fb = provider.fallback(input);
      return { ...fb, degraded: true };
    }
    console.error(`❌ [${provider.name}] 上游不可用:`, err.message);
    return { status: 502, json: { error: `${provider.name} 上游服务不可用` }, degraded: true };
  }

  // 4️⃣ map 瘦身 → 写 KV → 返回
  const json = typeof provider.map === 'function' ? provider.map(raw, input) : raw;
  if (kv && cacheKey) {
    try {
      await kv.set(cacheKey, { v: json, at: Date.now() });
    } catch { /* 缓存写失败不影响响应 */ }
  }
  return { status: 200, json };
}
