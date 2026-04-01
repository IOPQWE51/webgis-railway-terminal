// api/rateLimiter.js
// 🛡️ 简单的内存速率限制器（适用于 Vercel Serverless Functions）

/**
 * 速率限制器类
 * 使用内存存储每个IP的请求次数
 */
class RateLimiter {
  constructor(options = {}) {
    // 每个时间窗口的最大请求数
    this.maxRequests = options.maxRequests || 10;
    // 时间窗口（毫秒）
    this.windowMs = options.windowMs || 60000; // 默认1分钟
    // 存储结构：Map<IP, { count: number, resetTime: timestamp }>
    this.requests = new Map();

    // 定期清理过期记录（每5分钟）
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * 检查是否允许请求
   * @param {string} ip - 客户端IP
   * @returns {Object} { allowed: boolean, remaining: number }
   */
  check(ip) {
    const now = Date.now();
    const record = this.requests.get(ip);

    // 如果没有记录或时间窗口已过，重置
    if (!record || now > record.resetTime) {
      this.requests.set(ip, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs
      };
    }

    // 如果在时间窗口内，增加计数
    if (record.count < this.maxRequests) {
      record.count++;
      return {
        allowed: true,
        remaining: this.maxRequests - record.count,
        resetTime: record.resetTime
      };
    }

    // 超过限制
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  /**
   * 清理过期记录
   */
  cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(ip);
      }
    }
  }

  /**
   * 重置指定IP的记录（用于测试或手动清理）
   * @param {string} ip - 客户端IP
   */
  reset(ip) {
    this.requests.delete(ip);
  }

  /**
   * 获取当前统计信息
   */
  getStats() {
    return {
      totalIPs: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }
}

// ======== 预定义的速率限制器实例 ========

/**
 * Mapbox API 速率限制器
 * 每分钟最多10次请求
 */
export const mapboxRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000 // 1分钟
});

/**
 * 通用API速率限制器
 * 每分钟最多60次请求
 */
export const generalRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60000 // 1分钟
});

/**
 * 严格速率限制器（用于昂贵的API）
 * 每小时最多10次请求
 */
export const strictRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 3600000 // 1小时
});

/**
 * 中间件包装函数 - 在API路由中使用
 * @param {RateLimiter} limiter - 速率限制器实例
 * @returns {Function} 中间件函数
 */
export const withRateLimit = (limiter) => {
  return (handler) => {
    return async (req, res) => {
      // 获取客户端IP
      const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
                 req.headers['x-real-ip'] ||
                 'unknown';

      // 检查速率限制
      const result = limiter.check(ip);

      // 添加速率限制响应头
      res.setHeader('X-RateLimit-Limit', limiter.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      // 如果超过限制，返回 429
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          error: 'Too many requests',
          message: `请稍后再试。${retryAfter}秒后重置。`,
          retryAfter
        });
      }

      // 允许请求，继续执行
      return handler(req, res);
    };
  };
};

export default RateLimiter;
