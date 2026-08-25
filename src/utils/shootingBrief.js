// src/utils/shootingBrief.js
// 🌅 今日拍摄简报 —— 纯本地天文计算（零网络请求，离线可用）
//
// 黄金时刻：太阳高度角 ∈ (-4°, +6°]
// 蓝调时刻：太阳高度角 ∈ (-6°, -4°]
// 实现注记：全程 1 分钟步进采样（约 1700 次 getPosition，毫秒级开销），
// 边界精度即 ±1 分钟，无需额外二分。
// 时间均为 JS Date，显示时使用浏览器本地时区（与现有详情卡口径一致）。

import SunCalc from 'suncalc';

export const GOLDEN_ALT_MIN = -4;
export const GOLDEN_ALT_MAX = 6;
export const BLUE_ALT_MIN = -6;
export const BLUE_ALT_MAX = -4;

const validCoords = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) &&
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

const validDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

const inBand = (alt, min, max) => alt > min && alt <= max;

/** 相位周期(0-1) → 中文名 + emoji */
export function phaseMeta(phase) {
  if (phase < 0.03 || phase >= 0.97) return { name: '新月', emoji: '🌑' };
  if (phase < 0.22) return { name: '娥眉月', emoji: '🌒' };
  if (phase < 0.28) return { name: '上弦月', emoji: '🌓' };
  if (phase < 0.47) return { name: '盈凸月', emoji: '🌔' };
  if (phase < 0.53) return { name: '满月', emoji: '🌕' };
  if (phase < 0.72) return { name: '亏凸月', emoji: '🌖' };
  if (phase < 0.78) return { name: '下弦月', emoji: '🌗' };
  return { name: '残月', emoji: '🌘' };
}

export function moonPhaseInfo(date) {
  const ill = SunCalc.getMoonIllumination(date);
  const meta = phaseMeta(ill.phase ?? 0);
  // 对外统一叫 phaseName；SunCalc 的 phase 是周期(0-1)
  return { fraction: +(ill.fraction ?? 0).toFixed(2), phaseName: meta.name, emoji: meta.emoji };
}

/** 在 [winStart, winEnd] 内逐分钟扫描，切出满足高度角带的连续区间
 *  ⚠️ SunCalc.getPosition().altitude 单位是【弧度】，必须转成度再比对阈值 */
function collectIntervals(winStart, winEnd, lat, lon, min, max) {
  const out = [];
  let runStart = null;
  let prevIn = false;
  const RAD2DEG = 180 / Math.PI;
  for (let t = winStart.getTime(); t <= winEnd.getTime(); t += 60000) {
    const d = new Date(t);
    const altDeg = SunCalc.getPosition(d, lat, lon).altitude * RAD2DEG;
    const ok = inBand(altDeg, min, max);
    if (ok && !prevIn) runStart = d;
    if (!ok && prevIn) out.push({ start: runStart, end: d });
    prevIn = ok;
  }
  if (prevIn) out.push({ start: runStart, end: new Date(winEnd.getTime()) });
  return out;
}

/**
 * 计算指定坐标/日期的摄影天文简报
 * @returns {{sunrise:Date|null, sunset:Date|null,
 *            goldenHours:{start:Date,end:Date}[], blueHours:{start:Date,end:Date}[],
 *            moon:{fraction:number, phaseName:string, emoji:string}}|null}
 */
export function computeShootingBrief({ lat, lon, date = new Date() }) {
  if (!validCoords(lat, lon)) return null;
  const base = new Date(date);
  if (!validDate(base)) return null;

  const dayStart = new Date(base);
  dayStart.setHours(0, 0, 0, 0);
  const winStart = new Date(dayStart.getTime() - 2 * 3600000); // 当日 00:00 前 2h
  const winEnd = new Date(dayStart.getTime() + 26 * 3600000);  // 次日 02:00

  const times = SunCalc.getTimes(base, lat, lon);

  return {
    sunrise: validDate(times.sunrise) ? times.sunrise : null,
    sunset: validDate(times.sunset) ? times.sunset : null,
    goldenHours: collectIntervals(winStart, winEnd, lat, lon, GOLDEN_ALT_MIN, GOLDEN_ALT_MAX),
    blueHours: collectIntervals(winStart, winEnd, lat, lon, BLUE_ALT_MIN, BLUE_ALT_MAX),
    moon: moonPhaseInfo(base),
  };
}
