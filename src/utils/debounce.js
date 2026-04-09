// src/utils/debounce.js
// 🛡️ 防抖工具 - 从 performanceHelpers 重新导出 + Mapbox 专用功能

// 从 performanceHelpers 重新导出通用函数
export { debounce, throttle } from './performanceHelpers.js';

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
