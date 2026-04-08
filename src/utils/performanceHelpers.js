// src/utils/performanceHelpers.js
// 🛡️ 性能与安全工具函数库

/**
 * 📡 防抖函数 (Debounce)
 * 延迟执行函数，如果在延迟时间内再次调用则重新计时
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * ⏱️ 节流函数 (Throttle)
 * 限制函数在指定时间内只能执行一次
 * @param {Function} func - 需要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export const throttle = (func, limit = 100) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * 🔐 API 请求限流器
 * 保护 API 免受过度请求
 * @param {number} maxRequests - 最大请求数量
 * @param {number} perMinutes - 时间窗口（分钟）
 * @returns {Function} 限流包装函数
 */
export const createRateLimiter = (maxRequests = 100, perMinutes = 1) => {
  const requests = []; // 请求时间戳队列

  return async (fn) => {
    const now = Date.now();
    const cutoff = now - perMinutes * 60 * 1000;

    // 清理过期的请求记录
    requests.splice(0, requests.findIndex(r => r > cutoff) + 1);

    // 检查是否超过限流
    if (requests.length >= maxRequests) {
      const waitTime = requests[0] + perMinutes * 60 * 1000 - now;
      console.warn(`⚠️ API 限流：等待 ${Math.ceil(waitTime / 1000)} 秒`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // 记录此次请求
    requests.push(now);

    try {
      return await fn();
    } catch (error) {
      console.error('❌ API 请求失败:', error);
      throw error;
    }
  };
};

/**
 * 💾 本地存储包装器
 * 提供安全的本地存储操作
 */
export const storage = {
  /**
   * 保存数据到本地存储
   * @param {string} key - 存储键
   * @param {any} value - 要存储的值
   * @returns {boolean} 是否成功
   */
  save: (key, value) => {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`❌ 保存到本地存储失败 (${key}):`, error);
      return false;
    }
  },

  /**
   * 从本地存储读取数据
   * @param {string} key - 存储键
   * @param {any} defaultValue - 默认值
   * @returns {any} 存储的值或默认值
   */
  load: (key, defaultValue = null) => {
    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) {
        return defaultValue;
      }
      return JSON.parse(serialized);
    } catch (error) {
      console.error(`❌ 从本地存储读取失败 (${key}):`, error);
      return defaultValue;
    }
  },

  /**
   * 从本地存储删除数据
   * @param {string} key - 存储键
   * @returns {boolean} 是否成功
   */
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`❌ 从本地存储删除失败 (${key}):`, error);
      return false;
    }
  },

  /**
   * 清空所有本地存储数据
   * @returns {boolean} 是否成功
   */
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('❌ 清空本地存储失败:', error);
      return false;
    }
  }
};

/**
 * 📊 性能监控器
 * 监控函数执行时间
 */
export const performanceMonitor = {
  /**
   * 监控函数执行时间
   * @param {string} label - 标签
   * @param {Function} fn - 要监控的函数
   * @returns {any} 函数执行结果
   */
  measure: async (label, fn) => {
    const startTime = performance.now();
    console.log(`⏱️ 开始执行: ${label}`);

    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      console.log(`✅ 完成执行: ${label} (${duration}ms)`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      console.error(`❌ 执行失败: ${label} (${duration}ms)`, error);
      throw error;
    }
  },

  /**
   * 创建一个监控包装器
   * @param {string} label - 标签
   * @returns {Function} 监控包装函数
   */
  wrap: (label) => (fn) => {
    return async (...args) => {
      return performanceMonitor.measure(label, () => fn(...args));
    };
  }
};

/**
 * 🎯 批处理处理器
 * 将多个操作批量处理以提高性能
 */
export const batchProcessor = {
  /**
   * 批量处理数组
   * @param {Array} items - 要处理的项目
   * @param {Function} processor - 处理函数
   * @param {number} batchSize - 批次大小
   * @param {number} delay - 批次间延迟（毫秒）
   * @returns {Promise<Array>} 处理结果
   */
  process: async (items, processor, batchSize = 10, delay = 100) => {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);

      // 在批次之间添加延迟，避免过载
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return results;
  }
};

/**
 * 🔄 重试机制
 * 为失败的操作提供重试功能
 */
export const retryMechanism = {
  /**
   * 带重试的异步操作
   * @param {Function} fn - 要执行的函数
   * @param {number} maxRetries - 最大重试次数
   * @param {number} delay - 重试延迟（毫秒）
   * @returns {Promise<any>} 操作结果
   */
  execute: async (fn, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries) {
          console.error(`❌ 操作失败，已重试 ${maxRetries} 次:`, error);
          throw error;
        }
        console.warn(`⚠️ 操作失败，${delay}ms 后重试 (${i + 1}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // 指数退避
      }
    }
  }
};
