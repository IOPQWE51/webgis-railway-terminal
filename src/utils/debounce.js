// src/utils/debounce.js
// 🛡️ 防抖工具 - 防止用户快速连续点击导致重复API调用

/**
 * 防抖函数 - 在指定时间内只执行最后一次调用
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export const debounce = (func, wait = 500) => {
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
 * 节流函数 - 在指定时间内只执行一次
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Function} 节流后的函数
 */
export const throttle = (func, limit = 1000) => {
  let inThrottle = false;

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Mapbox API 专用防抖
 * 同一坐标500ms内只发送最后一次请求
 */
let mapboxDebounceTimers = new Map(); // key: "lat,lon,type", value: timer

export const fetchMapboxWithDebounce = async (lat, lon, type = 'geocoding') => {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${type}`;

  // 清除之前的定时器
  if (mapboxDebounceTimers.has(key)) {
    clearTimeout(mapboxDebounceTimers.get(key));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mapbox?lat=${lat}&lon=${lon}&type=${type}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Mapbox API 请求失败');
        }

        resolve(data);

        // 清理定时器
        mapboxDebounceTimers.delete(key);
      } catch (error) {
        reject(error);
        mapboxDebounceTimers.delete(key);
      }
    }, 500); // 500ms 防抖

    mapboxDebounceTimers.set(key, timer);
  });
};

/**
 * 清理所有防抖定时器（组件卸载时调用）
 */
export const clearAllDebounceTimers = () => {
  mapboxDebounceTimers.forEach((timer) => clearTimeout(timer));
  mapboxDebounceTimers.clear();
};
