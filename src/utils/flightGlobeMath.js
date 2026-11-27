// src/utils/flightGlobeMath.js
// 🌐 3D 航线地球球面数学与昼夜晨昏线纯函数（无 Three.js 依赖，支持独立单测）

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * 将经纬度 (deg) 转换为与 Three.js SphereGeometry UV 完全对齐的右手笛卡尔坐标
 * - North Pole (+90°N) -> (0, +R, 0)
 * - Equator Prime Meridian (0°, 0°) -> (+R, 0, 0)
 * - Equator 90°E (0°, +90°) -> (0, 0, -R)
 */
export function latLonToCartesian(latDeg, lonDeg, radius = 1) {
  const phi = (90 - latDeg) * DEG2RAD;
  const theta = (lonDeg + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  return {
    x: -radius * sinPhi * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * sinPhi * Math.sin(theta),
  };
}

/** 根据日期与 UTC 小时偏移计算当前太阳直射点经纬度及单位方向向量 */
export function computeSubsolarPoint(date = new Date(), overrideUtcHours = null) {
  const d = date instanceof Date ? date : new Date(date);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear) / 86400000) + 1;

  // 太阳赤纬（近似公式，误差 < 1°，足以精准渲染地球昼夜晨昏线）
  const declDeg = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));

  const utcHours =
    Number.isFinite(overrideUtcHours)
      ? ((overrideUtcHours % 24) + 24) % 24
      : d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;

  // UTC 12:00 时太阳直射 0° 经线，每小时向西移动 15°
  let lonDeg = (12 - utcHours) * 15;
  if (lonDeg > 180) lonDeg -= 360;
  if (lonDeg < -180) lonDeg += 360;

  return {
    lat: declDeg,
    lon: lonDeg,
    utcHours,
    direction: latLonToCartesian(declDeg, lonDeg, 1),
  };
}

/** 球面线性插值采样 3D 大圆航线（附带爬升-巡航-进近抛物线高度） */
export function sampleFlightArc3D(from, to, { segments = 96, earthRadius = 1, maxAltitude = null } = {}) {
  if (!from || !to) return [];
  const a = latLonToCartesian(from.lat, from.lon, 1);
  const b = latLonToCartesian(to.lat, to.lon, 1);

  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  // 根据航段跨度自适应弧顶高度（短途精致贴地、跨洋柔和优雅）
  const peakAlt =
    Number.isFinite(maxAltitude)
      ? maxAltitude
      : Math.min(0.24, Math.max(0.055, 0.045 + omega * 0.13));

  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    let ux;
    let uy;
    let uz;
    if (sinOmega < 1e-5) {
      ux = a.x;
      uy = a.y;
      uz = a.z;
    } else {
      const k1 = Math.sin((1 - t) * omega) / sinOmega;
      const k2 = Math.sin(t * omega) / sinOmega;
      ux = k1 * a.x + k2 * b.x;
      uy = k1 * a.y + k2 * b.y;
      uz = k1 * a.z + k2 * b.z;
      const len = Math.hypot(ux, uy, uz) || 1;
      ux /= len;
      uy /= len;
      uz /= len;
    }
    const lift = Math.pow(Math.sin(Math.PI * t), 0.82) * peakAlt;
    const r = earthRadius + lift;
    points.push({ x: ux * r, y: uy * r, z: uz * r, ux, uy, uz, t });
  }
  return points;
}

/** 计算给定飞行进度 t∈[0,1] 的阶段、参考巡航高度、俯仰姿态与所在昼夜空域 */
export function computeFlightTelemetry(t, distanceKm = 1500, radialUnit = { x: 1, y: 0, z: 0 }, sunDir = { x: 1, y: 0, z: 0 }) {
  const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
  const totalKm = Math.max(1, Number(distanceKm) || 1500);
  const cruiseFt = totalKm >= 4000 ? 39000 : totalKm >= 1500 ? 36000 : 31000;

  let phase = '平飞巡航';
  let pitchDeg = 0;
  let altRatio = 1;

  if (clampedT < 0.14) {
    phase = '起飞爬升';
    const p = clampedT / 0.14;
    altRatio = Math.sin((p * Math.PI) / 2);
    pitchDeg = 14 * (1 - p * 0.45);
  } else if (clampedT > 0.86) {
    phase = '下降进近';
    const p = (clampedT - 0.86) / 0.14;
    altRatio = Math.cos((p * Math.PI) / 2);
    pitchDeg = -9 * (0.55 + p * 0.45);
  } else {
    phase = '平飞巡航';
    altRatio = 0.96 + 0.04 * Math.sin(((clampedT - 0.14) / 0.72) * Math.PI);
    pitchDeg = 0;
  }

  const sunDot = radialUnit.x * sunDir.x + radialUnit.y * sunDir.y + radialUnit.z * sunDir.z;
  let lightingZone = '☀️ 白昼空域';
  if (sunDot < -0.1) lightingZone = '🌙 夜间空域';
  else if (sunDot < 0.12) lightingZone = '🌅 晨昏交界带';

  const doneKm = Math.round(totalKm * clampedT);
  return {
    progressPct: Math.round(clampedT * 100),
    phase,
    altitudeFt: Math.round((cruiseFt * altRatio) / 100) * 100,
    pitchDeg: Math.round(pitchDeg * 10) / 10,
    pitchRad: pitchDeg * DEG2RAD,
    distanceDoneKm: doneKm,
    distanceRemainKm: Math.max(0, Math.round(totalKm) - doneKm),
    lightingZone,
    sunElevDeg: Math.round(Math.asin(Math.max(-1, Math.min(1, sunDot))) * RAD2DEG),
  };
}

export function formatUtcClock(utcHours) {
  const hNorm = ((Number(utcHours) || 0) % 24 + 24) % 24;
  const h = Math.floor(hNorm);
  const m = Math.floor((hNorm - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UTC`;
}
