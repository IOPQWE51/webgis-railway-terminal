// src/utils/flightArc.js
// ✈️ 大圆航线几何插值、飞行里程/耗时估算与全球主要航空枢纽字典

import { haversineKm } from './todayCard';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const AIRPORT_HUBS = [
  { code: 'PEK', name: '北京首都', city: '北京', region: '中国', lat: 40.0799, lon: 116.6031 },
  { code: 'PVG', name: '上海浦东', city: '上海', region: '中国', lat: 31.1443, lon: 121.8083 },
  { code: 'CAN', name: '广州白云', city: '广州', region: '中国', lat: 23.3924, lon: 113.2988 },
  { code: 'HKG', name: '香港国际', city: '香港', region: '中国香港', lat: 22.3080, lon: 113.9185 },
  { code: 'TPE', name: '台北桃园', city: '台北', region: '中国台湾', lat: 25.0797, lon: 121.2342 },
  { code: 'HND', name: '东京羽田', city: '东京', region: '日本', lat: 35.5494, lon: 139.7798 },
  { code: 'NRT', name: '东京成田', city: '东京', region: '日本', lat: 35.7720, lon: 140.3929 },
  { code: 'KIX', name: '大阪关西', city: '大阪', region: '日本', lat: 34.4347, lon: 135.2441 },
  { code: 'FUK', name: '福冈国际', city: '福冈', region: '日本', lat: 33.5859, lon: 130.4511 },
  { code: 'CTS', name: '札幌新千岁', city: '札幌', region: '日本', lat: 42.7752, lon: 141.6923 },
  { code: 'ICN', name: '首尔仁川', city: '首尔', region: '韩国', lat: 37.4602, lon: 126.4407 },
  { code: 'SIN', name: '新加坡樟宜', city: '新加坡', region: '东南亚', lat: 1.3644, lon: 103.9915 },
  { code: 'BKK', name: '曼谷素万那普', city: '曼谷', region: '东南亚', lat: 13.6900, lon: 100.7501 },
  { code: 'KUL', name: '吉隆坡国际', city: '吉隆坡', region: '东南亚', lat: 2.7456, lon: 101.7099 },
  { code: 'LHR', name: '伦敦希思罗', city: '伦敦', region: '欧洲', lat: 51.4700, lon: -0.4543 },
  { code: 'CDG', name: '巴黎戴高乐', city: '巴黎', region: '欧洲', lat: 49.0097, lon: 2.5479 },
  { code: 'FRA', name: '法兰克福', city: '法兰克福', region: '欧洲', lat: 50.0379, lon: 8.5622 },
  { code: 'ZRH', name: '苏黎世', city: '苏黎世', region: '欧洲', lat: 47.4582, lon: 8.5555 },
  { code: 'FCO', name: '罗马菲乌米奇诺', city: '罗马', region: '欧洲', lat: 41.8003, lon: 12.2389 },
  { code: 'JFK', name: '纽约肯尼迪', city: '纽约', region: '北美', lat: 40.6413, lon: -73.7781 },
  { code: 'SFO', name: '旧金山国际', city: '旧金山', region: '北美', lat: 37.6213, lon: -122.3790 },
  { code: 'LAX', name: '洛杉矶国际', city: '洛杉矶', region: '北美', lat: 33.9416, lon: -118.4085 },
  { code: 'YVR', name: '温哥华国际', city: '温哥华', region: '北美', lat: 49.1967, lon: -123.1815 },
  { code: 'SYD', name: '悉尼金斯福德', city: '悉尼', region: '大洋洲', lat: -33.9399, lon: 151.1753 },
];

export const POPULAR_FLIGHT_PAIRS = [
  { from: 'PVG', to: 'KIX', label: '上海 → 大阪' },
  { from: 'PEK', to: 'HND', label: '北京 → 东京' },
  { from: 'PVG', to: 'SIN', label: '上海 → 新加坡' },
  { from: 'PEK', to: 'ZRH', label: '北京 → 苏黎世' },
  { from: 'HND', to: 'SFO', label: '东京 → 旧金山' },
  { from: 'HKG', to: 'LHR', label: '香港 → 伦敦' },
];

/** 球面线性插值（SLERP）生成大圆航线点列，自动展开跨日期变更线的经度避免折返横线 */
export function computeGreatCirclePoints(lat1, lon1, lat2, lon2, segments = 48) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return [];
  const p1 = lat1 * DEG2RAD;
  const l1 = lon1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const l2 = lon2 * DEG2RAD;

  const x1 = Math.cos(p1) * Math.cos(l1);
  const y1 = Math.cos(p1) * Math.sin(l1);
  const z1 = Math.sin(p1);
  const x2 = Math.cos(p2) * Math.cos(l2);
  const y2 = Math.cos(p2) * Math.sin(l2);
  const z2 = Math.sin(p2);

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments;
    let x, y, z;
    if (sinOmega < 1e-6) {
      x = x1 + f * (x2 - x1);
      y = y1 + f * (y2 - y1);
      z = z1 + f * (z2 - z1);
    } else {
      const a = Math.sin((1 - f) * omega) / sinOmega;
      const b = Math.sin(f * omega) / sinOmega;
      x = a * x1 + b * x2;
      y = a * y1 + b * y2;
      z = a * z1 + b * z2;
    }
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD2DEG;
    let lon = Math.atan2(y, x) * RAD2DEG;

    // 跨 ±180° 经线时连续展开经度，保证 Leaflet 跨太平洋航线平滑成弧
    if (pts.length > 0) {
      const prevLon = pts[pts.length - 1][1];
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    pts.push([lat, lon]);
  }
  return pts;
}

/** 估算直飞大圆里程（km）与大致飞行时长（按 840 km/h 巡航 + 35min 起降滑行） */
export function estimateFlightStats(lat1, lon1, lat2, lon2) {
  const dist = haversineKm(lat1, lon1, lat2, lon2);
  if (dist === null) return null;
  const distanceKm = Math.round(dist);
  const totalMin = Math.round((distanceKm / 840) * 60 + 35);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return {
    distanceKm,
    durationMin: totalMin,
    durationLabel: h > 0 ? `约 ${h}h ${String(m).padStart(2, '0')}m` : `约 ${m} 分钟`,
  };
}

/** 为任意坐标匹配最近的大型航空枢纽 */
export function findNearestAirportHub(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null;
  let bestDist = Infinity;
  for (const hub of AIRPORT_HUBS) {
    const d = haversineKm(lat, lon, hub.lat, hub.lon);
    if (d !== null && d < bestDist) {
      bestDist = d;
      best = hub;
    }
  }
  return best;
}
