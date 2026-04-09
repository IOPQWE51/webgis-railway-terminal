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
  let timeout = null;

  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

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

/**
 * 🌐 通用 API 请求工具
 * 统一处理 fetch 请求、错误处理和响应解析
 */
export const apiRequest = async (url, options = {}) => {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeout = 10000,
    retries = 2
  } = options;

  // 构建请求配置
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(body && { body: JSON.stringify(body) })
  };

  // 带重试的请求执行
  return retryMechanism.execute(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      throw error;
    }
  }, retries);
};

/**
 * 🌐 地理编码 API 请求
 * 专门用于地址转坐标的 API 请求
 */
export const geocodeRequest = async (query, provider = 'nominatim') => {
  const providers = {
    nominatim: {
      url: (q) => `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      headers: { 'User-Agent': 'EarthTerminal/5.0.1' }
    }
    // 可扩展其他提供商
  };

  const providerConfig = providers[provider];
  if (!providerConfig) {
    throw new Error(`不支持的地理编码提供商: ${provider}`);
  }

  const results = await apiRequest(providerConfig.url(query), {
    headers: providerConfig.headers,
    timeout: 10000
  });

  if (!results || results.length === 0) {
    return null;
  }

  const { lat, lon, display_name } = results[0];
  return {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    displayName: display_name
  };
};

/**
 * 🌐 IP 地址定位（备用方案）
 * 通过 IP 地址获取大致位置，无需用户授权
 * @returns {Promise<{latitude: number, longitude: number, city: string, country: string}>}
 */
export const getPositionByIP = async () => {
  console.log('🌐 使用 IP 地址定位...');

  try {
    // 使用免费的 IP 定位 API
    const response = await fetch('https://ipapi.co/json/', {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`IP 定位服务响应错误: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.reason || 'IP 定位失败');
    }

    // ipapi.co 返回的字段
    const position = {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city || '未知城市',
      country: data.country_name || data.country || '',
      region: data.region || '',
      accuracy: 'low', // IP 定位精度较低
      method: 'ip'
    };

    console.log('✅ IP 定位成功:', position);
    return position;
  } catch (error) {
    console.error('❌ IP 定位失败:', error);
    throw new Error(`IP 定位失败: ${error.message}`);
  }
};

/**
 * 📍 浏览器地理定位工具
 * 获取用户当前位置
 * @param {Object} options - 定位选项
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getPositionByGPS = (options = {}) => {
  const {
    enableHighAccuracy = false,
    timeout = 15000,
    maximumAge = 60000
  } = options;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('BROWSER_NOT_SUPPORTED'));
      return;
    }

    console.log('🛰️ 使用 GPS 定位...', { enableHighAccuracy, timeout, maximumAge });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ GPS 定位成功:', position.coords);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          method: 'gps'
        });
      },
      (error) => {
        const errorTypes = {
          1: 'PERMISSION_DENIED',
          2: 'POSITION_UNAVAILABLE',
          3: 'TIMEOUT'
        };
        reject(new Error(errorTypes[error.code] || 'UNKNOWN'));
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
};

/**
 * 🎯 智能定位（优先 GPS，失败则 IP）
 * 自动选择最佳定位方式
 * @param {Object} options - 定位选项
 * @returns {Promise<{latitude: number, longitude: number, method: string}>}
 */
export const getCurrentPosition = async (options = {}) => {
  const {
    preferGPS = true,
    fallbackToIP = true,
    gpsTimeout = 15000
  } = options;

  // 优先尝试 GPS 定位
  if (preferGPS && navigator.geolocation) {
    try {
      console.log('📍 启动智能定位（优先 GPS）...');
      const position = await getPositionByGPS({ ...options, timeout: gpsTimeout });
      return position;
    } catch (error) {
      console.warn('⚠️ GPS 定位失败:', error.message);

      // 如果是权限被拒绝，不再尝试 IP 定位
      if (error.message === 'PERMISSION_DENIED') {
        throw new Error('定位权限被拒绝，请在浏览器设置中允许定位');
      }

      // 其他错误，尝试 IP 定位
      if (!fallbackToIP) {
        throw error;
      }
    }
  }

  // GPS 失败，尝试 IP 定位
  if (fallbackToIP) {
    console.log('🔄 GPS 失败，降级到 IP 定位...');
    try {
      const position = await getPositionByIP();
      position.warning = 'IP 定位精度较低，仅供参考';
      return position;
    } catch (ipError) {
      throw new Error(`所有定位方式均失败：${ipError.message}`);
    }
  }

  throw new Error('无可用的定位方式');
};
