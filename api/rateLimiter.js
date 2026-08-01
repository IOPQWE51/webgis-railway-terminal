// api/rateLimiter.js
// 🛡️ 分布式速率限制器（Vercel Serverless Functions）
//
// 优先使用 Upstash Redis 分布式限流（跨函数实例真正生效）；
// 当未配置 KV 环境变量时，降级到进程内存限流（仅本地/单实例有软兜底作用）。
//
// 💡 旧实现用 setInterval + 全局内存 Map：在 serverless 无持久进程内存的环境下，
//    多个函数实例不共享内存、setInterval 在实例冻结后不触发，限流近乎失效。
//    本实现移除 setInterval，改为 Redis 分布式计数或在 check() 中惰性清理过期记录。

import { Redis } from '@upstash/redis';

// ======== 限流器预设配置 ========
// 三层预设：按 Redis key 命名空间区分，各自互不影响。
export const RATE_LIMITERS = {
  // Mapbox API 速率限制器：每分钟最多 10 次请求
  mapbox: { maxRequests: 10, windowMs: 60_000 },
  // 通用 API 速率限制器：每分钟最多 60 次请求
  general: { maxRequests: 60, windowMs: 60_000 },
  // 严格速率限制器（用于昂贵的 API）：每小时最多 10 次请求
  strict: { maxRequests: 10, windowMs: 3_600_000 },
};

// ======== Upstash Redis 连接（进程内复用，缺失则降级） ========
let _redis = null;
let _redisChecked = false;
function getRedis() {
  if (_redisChecked) return _redis;
  _redisChecked = true;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    _redis = new Redis({ url: kvUrl, token: kvToken });
  }
  return _redis;
}

/**
 * Redis 分布式限流：固定窗口计数（INCR 原子递增 + 首次设 TTL）
 * @param {Redis} redis
 * @param {string} limiterName - 限流器名称（作为 key 命名空间）
 * @param {string} ip - 客户端 IP
 * @param {number} maxRequests
 * @param {number} windowMs
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
 */
async function checkRedisRateLimit(redis, limiterName, ip, maxRequests, windowMs) {
  const key = `ratelimit:${limiterName}:${ip}`;
  const count = await redis.incr(key); // 原子 +1
  if (count === 1) {
    // 仅窗口首次设过期，后续复用同一 key 不重置 TTL
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  const remaining = Math.max(0, maxRequests - count);
  const resetTime = Date.now() + windowMs; // 近似窗口结束时刻
  return {
    allowed: count <= maxRequests,
    remaining,
    resetTime,
  };
}

// ======== 内存降级限流器 ========
// 无 Redis 时使用。移除 setInterval 定时清理（serverless 下无效且会泄漏），
// 改为在 check() 中惰性清理该 IP 的过期记录（O(1)，不遍历全表）。
class MemoryRateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 10;
    this.windowMs = options.windowMs || 60_000;
    this.requests = new Map(); // Map<IP, { count, resetTime }>
  }

  /**
   * 检查是否允许请求
   * @param {string} ip - 客户端IP
   * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
   */
  check(ip) {
    const now = Date.now();
    const record = this.requests.get(ip);

    // 无记录或窗口已过 → 重置（惰性清理过期记录）
    if (!record || now > record.resetTime) {
      const resetTime = now + this.windowMs;
      this.requests.set(ip, { count: 1, resetTime });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime };
    }

    // 窗口内计数
    if (record.count < this.maxRequests) {
      record.count++;
      return {
        allowed: true,
        remaining: this.maxRequests - record.count,
        resetTime: record.resetTime,
      };
    }

    // 超过限制
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  /** 重置指定IP的记录（用于测试或手动清理） */
  reset(ip) {
    this.requests.delete(ip);
  }

  getStats() {
    return {
      totalIPs: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    };
  }
}

// 降级限流器实例缓存（按 limiterName 复用）
const _memoryLimiters = new Map();
function getMemoryLimiter(limiterName) {
  let limiter = _memoryLimiters.get(limiterName);
  if (!limiter) {
    const cfg = RATE_LIMITERS[limiterName];
    if (!cfg) throw new Error(`未知的限流器名称: ${limiterName}`);
    limiter = new MemoryRateLimiter(cfg);
    _memoryLimiters.set(limiterName, limiter);
  }
  return limiter;
}

// ======== 中间件包装 ========
// 入参：限流器名称字符串（如 'mapbox'），而非实例对象（旧版接口）
// 返回：(handler) => (req, res) 柯里化中间件
export const withRateLimit = (limiterName) => {
  const cfg = RATE_LIMITERS[limiterName];
  if (!cfg) {
    throw new Error(`未知的限流器名称: ${limiterName}，可选: ${Object.keys(RATE_LIMITERS).join(', ')}`);
  }

  return (handler) => async (req, res) => {
    // 获取客户端 IP
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      'unknown';

    // Redis 优先，缺失则内存降级
    const redis = getRedis();
    let result;
    if (redis) {
      try {
        result = await checkRedisRateLimit(redis, limiterName, ip, cfg.maxRequests, cfg.windowMs);
      } catch (err) {
        // Redis 故障时降级到内存，保证主链路不被限流组件拖垮
        console.error('⚠️ Redis 限流检查失败，降级到内存:', err.message);
        result = getMemoryLimiter(limiterName).check(ip);
      }
    } else {
      result = getMemoryLimiter(limiterName).check(ip);
    }

    // 响应头
    res.setHeader('X-RateLimit-Limit', String(cfg.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    // 超过限制 → 429
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many requests',
        message: `请稍后再试。约 ${retryAfter} 秒后重置。`,
        retryAfter,
      });
    }

    // 放行
    return handler(req, res);
  };
};

// 直接暴露内存类，便于测试
export { MemoryRateLimiter as RateLimiter };

export default MemoryRateLimiter;
