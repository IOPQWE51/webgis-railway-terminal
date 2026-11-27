// src/utils/sunAzimuth.js
// 🧭 太阳方位角与射线几何计算 —— 供地图机位光影射线（Azimuth Overlay）与详情卡复用

import SunCalc from 'suncalc';
import { computeShootingBrief } from './shootingBrief';

const EARTH_R_KM = 6371;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** 将 SunCalc 的弧度方位角（以正南为 0，顺时针为正）转换为罗盘方位角（以正北为 0°，0~360°） */
export function sunCalcAzimuthToBearingDeg(azimuthRad) {
  if (!Number.isFinite(azimuthRad)) return null;
  const deg = ((azimuthRad * RAD2DEG) + 180) % 360;
  return Math.round(((deg + 360) % 360) * 10) / 10;
}

/** 方位角（0~360°）→ 八方位中文标签 */
export function bearingToCompassZh(bearingDeg) {
  if (!Number.isFinite(bearingDeg)) return '';
  const dirs = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
  const idx = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

/** 球面正算：给定起点、真北罗盘方位角（度）与距离（km），计算终点坐标 */
export function projectPointByBearing(lat, lon, bearingDeg, distanceKm) {
  if (![lat, lon, bearingDeg, distanceKm].every(Number.isFinite)) return null;
  const lat1 = lat * DEG2RAD;
  const lon1 = lon * DEG2RAD;
  const theta = bearingDeg * DEG2RAD;
  const delta = distanceKm / EARTH_R_KM;

  const sinLat2 = Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const lon2 = lon1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
    Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { lat: lat2 * RAD2DEG, lon: lon2 * RAD2DEG };
}

/** 按当前地图缩放级估算合适的射线长度（km），保证不同缩放级别下射线比例都清晰美观 */
export function rayLengthKmForZoom(zoom = 12) {
  const z = Number.isFinite(zoom) ? zoom : 12;
  const raw = 14000 / Math.pow(2, z);
  return Math.max(0.25, Math.min(120, raw));
}

/**
 * 计算指定点位与日期的日出、日落及当前太阳方位角（正北 0° 顺时针）。
 */
export function computeSolarAzimuths({ lat, lon, date = new Date(), now = new Date() }) {
  const brief = computeShootingBrief({ lat, lon, date });
  if (!brief) return null;

  const sunriseBearing = brief.sunrise
    ? sunCalcAzimuthToBearingDeg(SunCalc.getPosition(brief.sunrise, lat, lon).azimuth)
    : null;
  const sunsetBearing = brief.sunset
    ? sunCalcAzimuthToBearingDeg(SunCalc.getPosition(brief.sunset, lat, lon).azimuth)
    : null;

  const nowPos = SunCalc.getPosition(now, lat, lon);
  const currentAltDeg = nowPos.altitude * RAD2DEG;
  const currentBearing = currentAltDeg > -6
    ? sunCalcAzimuthToBearingDeg(nowPos.azimuth)
    : null;

  return {
    dateKey: brief.dateKey,
    sunrise: sunriseBearing !== null
      ? { bearingDeg: sunriseBearing, compass: bearingToCompassZh(sunriseBearing), at: brief.sunrise }
      : null,
    sunset: sunsetBearing !== null
      ? { bearingDeg: sunsetBearing, compass: bearingToCompassZh(sunsetBearing), at: brief.sunset }
      : null,
    current: currentBearing !== null
      ? { bearingDeg: currentBearing, compass: bearingToCompassZh(currentBearing), altitudeDeg: Math.round(currentAltDeg * 10) / 10 }
      : null,
  };
}
