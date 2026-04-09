/**
 * Dark 2D 地区检测器
 *
 * 根据经纬度检测站点所属地区，为后续 API 适配做准备
 * 返回地区信息，便于选择合适的交通 API
 */

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
      [24.0, 122.0, 46.0, 146.0], // 本土
      [24.0, 141.0, 26.0, 145.0], // 冲绳
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
      [18.0, 73.0, 54.0, 135.0], // 大陆
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
 * 根据经纬度检测地区信息
 *
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {object} 地区信息
 *
 * @example
 * detectRegion(35.6812, 139.7671)
 * // => {
 * //   continent: 'Asia',
 * //   country: 'JP',
 * //   countryName: '日本',
 * //   region: 'kanto',
 * //   regionName: '关东',
 * //   apiProvider: 'yahoo-transit'
 * // }
 */
export function detectRegion(lat, lon) {
  for (const [key, region] of Object.entries(REGION_BOUNDARIES)) {
    // 检查是否在该区域的任一边界框内
    const inAnyBounds = region.bounds.some(bounds =>
      isPointInBounds(lat, lon, bounds)
    );

    if (inAnyBounds) {
      const subRegion = detectSubRegion(lat, lon, region);

      return {
        continent: region.continent,
        country: region.country,
        countryName: region.name,
        countryNameEn: region.enName,
        apiProvider: region.apiProvider,
        region: subRegion?.key || null,
        regionName: subRegion?.name || null,
      };
    }
  }

  // 未匹配到任何地区
  return {
    continent: 'Unknown',
    country: 'Unknown',
    countryName: '未知地区',
    countryNameEn: 'Unknown',
    apiProvider: null,
    region: null,
    regionName: null,
  };
}

/**
 * 使用逆地理编码 API 获取更精确的地区信息（备用方案）
 *
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {Promise<object>} 地区信息
 */
export async function detectRegionByGeocoding(lat, lon) {
  try {
    // 使用 Nominatim (OSM) 免费逆地理编码
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-CN,en`,
      {
        headers: {
          'User-Agent': 'EarthTerminal/5.0.1'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    const address = data.address || {};

    // 解析 OSM 返回的地址信息
    const countryCode = address.country_code?.toUpperCase() || 'Unknown';
    const city = address.city || address.town || address.village || address.county || '';

    return {
      continent: address.continent || null,
      country: countryCode,
      countryName: address.country || '未知',
      city: city,
      fullAddress: data.display_name || '',
      osmType: data.osm_type,
      osmId: data.osm_id,
    };
  } catch (error) {
    console.error('逆地理编码失败:', error);
    return null;
  }
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
