// src/utils/shootingBrief.js
// 🌅 统一拍摄光影简报 —— 纯本地天文计算（零网络请求，离线可用）
//
// 黄金时刻：太阳高度角 ∈ (-4°, +6°]
// 蓝调时刻：太阳高度角 ∈ (-6°, -4°]
// 实现注记：按目标地经度估算当地太阳时午夜 [00:00, 24:00] 逐分钟采样，
// 避免在东八区查看欧美坐标时因浏览器本地午夜错位导致跨日或只扫到单场。
// 首页「今日光影」、顶部焦点条、地图选点弹窗统一复用本模块，保证零误差一致。

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

/** 按经度估算当地时区偏移（整数小时） */
export function getLocalOffsetHours(lon) {
  if (!Number.isFinite(lon)) return 0;
  return Math.round(lon / 15);
}

/** 将某时刻格式化为目标地当地时间 YYYY-MM-DD */
export function formatLocalDateKey(date, lon) {
  const d = date instanceof Date ? date : new Date(date);
  if (!validDate(d)) return '';
  const local = new Date(d.getTime() + getLocalOffsetHours(lon) * 3600000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 解析目标地日期输入（Date 或 'YYYY-MM-DD'）为目标地当地午夜与正午的 UTC 时间戳 */
function resolveLocalDayBounds(dateInput, lon) {
  const offsetMs = getLocalOffsetHours(lon) * 3600000;

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    const localMidnightUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs;
    if (!Number.isFinite(localMidnightUtc)) return null;
    return {
      dateKey: dateInput.trim(),
      dayStartMs: localMidnightUtc,
      noonDate: new Date(localMidnightUtc + 12 * 3600000),
    };
  }

  const base = new Date(dateInput);
  if (!validDate(base)) return null;
  const shifted = new Date(base.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const localMidnightUtc = Date.UTC(y, m, d, 0, 0, 0) - offsetMs;
  return {
    dateKey: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    dayStartMs: localMidnightUtc,
    noonDate: new Date(localMidnightUtc + 12 * 3600000),
  };
}

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

/** 将某日的多段黄金/蓝调区间按当地时间正午清晰拆分为早场与晚场 */
function splitMorningEvening(intervals, noonMs) {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return { morning: null, evening: null };
  }
  let morning = null;
  let evening = null;
  for (const seg of intervals) {
    const mid = (seg.start.getTime() + seg.end.getTime()) / 2;
    if (mid < noonMs) {
      if (!morning) morning = seg;
    } else if (!evening) {
      evening = seg;
    }
  }
  return { morning, evening };
}

/**
 * 计算指定坐标/日期的摄影天文简报
 * @param {{lat:number, lon:number, date?:Date|string}} options
 * @returns {{dateKey:string, sunrise:Date|null, sunset:Date|null,
 *            goldenHours:{start:Date,end:Date}[], blueHours:{start:Date,end:Date}[],
 *            morningGolden:{start:Date,end:Date}|null, eveningGolden:{start:Date,end:Date}|null,
 *            morningBlue:{start:Date,end:Date}|null, eveningBlue:{start:Date,end:Date}|null,
 *            moon:{fraction:number, phaseName:string, emoji:string}}|null}
 */
export function computeShootingBrief({ lat, lon, date = new Date() }) {
  if (!validCoords(lat, lon)) return null;
  const bounds = resolveLocalDayBounds(date, lon);
  if (!bounds) return null;

  const winStart = new Date(bounds.dayStartMs);
  const winEnd = new Date(bounds.dayStartMs + 24 * 3600000);
  const noonMs = bounds.noonDate.getTime();

  // 以目标地正午调用 SunCalc.getTimes，确保日出/日落严格归属目标地当天
  const times = SunCalc.getTimes(bounds.noonDate, lat, lon);
  const goldenHours = collectIntervals(winStart, winEnd, lat, lon, GOLDEN_ALT_MIN, GOLDEN_ALT_MAX);
  const blueHours = collectIntervals(winStart, winEnd, lat, lon, BLUE_ALT_MIN, BLUE_ALT_MAX);
  const { morning: morningGolden, evening: eveningGolden } = splitMorningEvening(goldenHours, noonMs);
  const { morning: morningBlue, evening: eveningBlue } = splitMorningEvening(blueHours, noonMs);

  return {
    dateKey: bounds.dateKey,
    sunrise: validDate(times.sunrise) ? times.sunrise : null,
    sunset: validDate(times.sunset) ? times.sunset : null,
    goldenHours,
    blueHours,
    morningGolden,
    eveningGolden,
    morningBlue,
    eveningBlue,
    moon: moonPhaseInfo(bounds.noonDate),
  };
}
