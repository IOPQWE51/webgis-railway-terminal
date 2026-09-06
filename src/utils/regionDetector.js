/**
 * Dark 2D 地区检测器 —— 双范式
 *
 * 范式 1（快路径）detectRegion：bbox 离线秒判，仅覆盖高频站（日本/中国/美国/欧洲）。
 *   ⚠️ 定位为"缓存性质"的提示值：resolved:false，边界重叠区可能误判（见下方沈阳回归）。
 * 范式 2（主路径）detectRegionOnline：服务端逆地理编码（/api/mapbox?type=reverse），
 *   全球任何坐标都能解析；失败时自动回退到快路径结果。
 * 调用方规则：能等网络的用 detectRegionOnline；需要离线立即可用的用 detectRegion，
 *   并把 resolved:false 显示成"待确认"而不是事实。
 */

import { reverseGeocode } from './geocode';

// 简化的地区边界框（用于快速判断）
// 格式: { name, continent, country, regions: [[minLat, minLon, maxLat, maxLon], ...] }
const REGION_BOUNDARIES = {
  // 日本
  japan: {
    name: '日本',
    enName: 'Japan',
    continent: 'Asia',
    country: 'JP',
    apiProvider: 'yahoo-transit',
    bounds: [
      [30.0, 128.0, 46.0, 146.0], // 本土（东界收紧到 128：旧框 [24,122] 与中国框重叠，沈阳/哈尔滨曾被误判为日本）
      [24.0, 122.0, 26.5, 132.0], // 冲绳（纬度带低于中国大陆南缘，不与中国框冲突）
    ],
    regions: {
      kanto: { name: '关东', bounds: [34.5, 138.5, 37.5, 140.5] },
      kansai: { name: '关西', bounds: [34.0, 135.0, 35.5, 136.5] },
      chubu: { name: '中部', bounds: [35.0, 136.5, 38.0, 139.5] },
      tohoku: { name: '东北', bounds: [37.0, 139.5, 41.5, 142.0] },
      hokkaido: { name: '北海道', bounds: [41.5, 139.5, 45.5, 146.0] },
      kyushu: { name: '九州', bounds: [31.0, 129.5, 34.0, 132.0] },
    }
  },
  // 中国
  china: {
    name: '中国',
    enName: 'China',
    continent: 'Asia',
    country: 'CN',
    apiProvider: 'amap', // 高德地图
    bounds: [
      [21.5, 78.0, 54.0, 135.0], // 大陆（南界抬到 21.5、西界收到 78：旧框 [18,73] 曾把清迈/缅北等东南亚吞进来）
      [22.0, 113.0, 23.0, 115.0], // 香港
    ],
    regions: {
      beijing: { name: '北京', bounds: [39.5, 115.5, 41.0, 117.5] },
      shanghai: { name: '上海', bounds: [30.5, 120.5, 31.8, 122.5] },
      guangzhou: { name: '广州', bounds: [22.5, 113.0, 23.8, 114.5] },
      shenzhen: { name: '深圳', bounds: [22.4, 113.8, 22.9, 114.6] },
    }
  },
  // 美国
  usa: {
    name: '美国',
    enName: 'United States',
    continent: 'North America',
    country: 'US',
    apiProvider: 'google-places',
    bounds: [
      [24.0, -125.0, 50.0, -66.0], // 本土
    ],
    regions: {
      northeast: { name: '东北部', bounds: [38.0, -80.0, 45.0, -70.0] },
      west: { name: '西海岸', bounds: [32.0, -125.0, 42.0, -114.0] },
    }
  },
  // 欧洲
  europe: {
    name: '欧洲',
    enName: 'Europe',
    continent: 'Europe',
    country: 'EU',
    apiProvider: 'citymapper',
    bounds: [
      [35.0, -10.0, 72.0, 40.0], // 大致欧洲范围
    ],
    regions: {
      uk: { name: '英国', bounds: [50.0, -8.0, 60.0, 2.0] },
      france: { name: '法国', bounds: [41.0, -5.0, 51.0, 10.0] },
      germany: { name: '德国', bounds: [47.0, 6.0, 55.0, 15.0] },
    }
  }
};

/**
 * 检测点是否在边界框内
 */
function isPointInBounds(lat, lon, bounds) {
  const [minLat, minLon, maxLat, maxLon] = bounds;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * 检测点所属的子区域
 */
function detectSubRegion(lat, lon, region) {
  if (!region.regions) return null;

  for (const [key, subRegion] of Object.entries(region.regions)) {
    if (isPointInBounds(lat, lon, subRegion.bounds)) {
      return { key, ...subRegion };
    }
  }
  return null;
}

/**
 * Unknown 占位（形状稳定：调用方可放心解构任何字段）
 */
export function UNKNOWN_REGION() {
  return {
    continent: 'Unknown',
    country: 'Unknown',
    countryCode: null,
    countryName: '未知地区',
    countryNameEn: 'Unknown',
    apiProvider: null,
    region: null,
    regionName: null,
    city: null,
    fullAddress: null,
    resolved: false,
    source: 'unknown',
  };
}

/**
 * 快路径：bbox 离线秒判（仅覆盖高频站，边界重叠区可能误判）
 *
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {object} 地区信息（resolved:false 表示未经主路径确认）
 *
 * @example
 * detectRegion(35.6812, 139.7671)
 * // => { countryName: '日本', regionName: '关东', source: 'bbox', resolved: false, ... }
 */
export function detectRegion(lat, lon) {
  for (const [, region] of Object.entries(REGION_BOUNDARIES)) {
    // 检查是否在该区域的任一边界框内
    const inAnyBounds = region.bounds.some(bounds =>
      isPointInBounds(lat, lon, bounds)
    );

    if (inAnyBounds) {
      const subRegion = detectSubRegion(lat, lon, region);

      return {
        continent: region.continent,
        country: region.country,
        countryCode: region.country,
        countryName: region.name,
        countryNameEn: region.enName,
        apiProvider: region.apiProvider,
        region: subRegion?.key || null,
        regionName: subRegion?.name || null,
        city: null,
        fullAddress: null,
        resolved: false, // ⚠️ 快路径未经主路径确认
        source: 'bbox',
      };
    }
  }

  // 未匹配到任何地区（全球大部分坐标在此——由 detectRegionOnline 主路径负责）
  return UNKNOWN_REGION();
}

/**
 * 主路径：服务端逆地理编码（全球覆盖，任何坐标都能解析）
 *
 * 失败时回退到 bbox 快路径结果；两者皆盲 → UNKNOWN_REGION 占位。
 * 注意：不做 bbox 命中即跳过网络的"优化"——bbox 只是缓存性质的快路径，
 * 与逆编码结果冲突时以逆编码为准（旧快路径在重叠区有误判前科）。
 *
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {Promise<object>} 地区信息（resolved:true = 主路径确认）
 *
 * @example
 * await detectRegionOnline(18.79, 98.98) // 清迈（bbox 盲区）
 * // => { countryName: 'Thailand', regionName: 'Chiang Mai', source: 'reverse', resolved: true, ... }
 */
export async function detectRegionOnline(lat, lon) {
  const geocoded = await reverseGeocode(lat, lon);

  if (geocoded) {
    return {
      continent: null, // Mapbox 逆编码不直接给大洲，需要时由调用方按 countryCode 映射
      country: geocoded.countryCode || 'Unknown',
      countryCode: geocoded.countryCode || null,
      countryName: geocoded.country || '未知',
      countryNameEn: geocoded.country || 'Unknown',
      apiProvider: null, // provider 适配层后续接入，见 transitIntel 规划
      region: geocoded.region || null,
      regionName: geocoded.region || null,
      city: geocoded.city || null,
      fullAddress: geocoded.fullAddress || null,
      resolved: true,
      source: 'reverse',
    };
  }

  // 主路径失联：回退 bbox 快路径（可能有值，可能盲区占位）
  return detectRegion(lat, lon);
}

/**
 * 格式化坐标显示
 */
export function formatCoordinate(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return {
    lat: `${Math.abs(lat).toFixed(4)}°${latDir}`,
    lon: `${Math.abs(lon).toFixed(4)}°${lonDir}`,
    full: `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`
  };
}
