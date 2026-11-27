// src/utils/itinerary.js
// 🧳 行程编排纯函数层 —— 按天分组、顺序重排、自动计算段间直线距离与总里程

import { haversineKm } from './todayCard';

/** 自然排序天数标签：Day 1 < Day 2 < Day 10；其余按字典序 */
export function compareDayLabels(a, b) {
  const ma = /^day\s*(\d+)$/i.exec(String(a || '').trim());
  const mb = /^day\s*(\d+)$/i.exec(String(b || '').trim());
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  if (ma) return -1;
  if (mb) return 1;
  return String(a || '').localeCompare(String(b || ''), 'zh-CN');
}

/** 生成下一个默认天数名称（如已有 Day 1、Day 2 → Day 3） */
export function nextDayLabel(existingDayNames = []) {
  let maxNum = 0;
  for (const name of existingDayNames) {
    const m = /^day\s*(\d+)$/i.exec(String(name || '').trim());
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  return `Day ${maxNum + 1}`;
}

/**
 * 将点位数组聚合为按天行程模型，自动计算相邻点位直线距离与当日/全程总里程。
 * @param {Array} points
 * @returns {{ days: Array<{day:string, stops:Array, totalDistanceKm:number}>, unassigned: Array, scheduledCount: number, grandTotalKm: number }}
 */
export function buildItineraryDays(points = []) {
  const list = Array.isArray(points) ? points : [];
  const dayBuckets = new Map();
  const unassigned = [];

  for (const pt of list) {
    const day = typeof pt?.day === 'string' ? pt.day.trim() : '';
    if (!day) {
      unassigned.push(pt);
      continue;
    }
    if (!dayBuckets.has(day)) dayBuckets.set(day, []);
    dayBuckets.get(day).push(pt);
  }

  const dayNames = [...dayBuckets.keys()].sort(compareDayLabels);
  let grandTotalKm = 0;
  let scheduledCount = 0;

  const days = dayNames.map((day) => {
    const rawStops = dayBuckets.get(day);
    const sorted = [...rawStops].sort((a, b) => {
      const oa = Number.isFinite(a?.dayOrder) ? a.dayOrder : Number.MAX_SAFE_INTEGER;
      const ob = Number.isFinite(b?.dayOrder) ? b.dayOrder : Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
    });

    let dayTotal = 0;
    const stops = sorted.map((pt, idx) => {
      let legFromPrevKm = null;
      if (idx > 0) {
        const prev = sorted[idx - 1];
        const d = haversineKm(prev.lat, prev.lon, pt.lat, pt.lon);
        if (d !== null) {
          legFromPrevKm = Math.round(d * 10) / 10;
          dayTotal += d;
        }
      }
      return { ...pt, legFromPrevKm };
    });

    const totalDistanceKm = Math.round(dayTotal * 10) / 10;
    grandTotalKm += dayTotal;
    scheduledCount += stops.length;
    return { day, stops, totalDistanceKm };
  });

  return {
    days,
    unassigned,
    scheduledCount,
    grandTotalKm: Math.round(grandTotalKm * 10) / 10,
  };
}

/** 把某个点位排入指定天数（空串表示移出行程），并规范写入 dayOrder */
export function assignPointToDay(allPoints, pointId, targetDay) {
  const dayStr = String(targetDay || '').trim().slice(0, 16);
  const existingInTarget = dayStr
    ? allPoints.filter((p) => String(p.id) !== String(pointId) && (p.day || '').trim() === dayStr)
    : [];
  const nextOrder = existingInTarget.length;

  return allPoints.map((p) => {
    if (String(p.id) !== String(pointId)) return p;
    if (!dayStr) {
      const rest = { ...p };
      delete rest.day;
      delete rest.dayOrder;
      return rest;
    }
    return { ...p, day: dayStr, dayOrder: nextOrder };
  });
}

/** 在指定天数内重排顺序（支持拖拽与上移/下移按钮），返回更新后的完整点位数组 */
export function reorderDayPoints(allPoints, dayName, fromIndex, toIndex) {
  const { days } = buildItineraryDays(allPoints);
  const target = days.find((d) => d.day === dayName);
  if (!target) return allPoints;
  const stops = [...target.stops];
  if (
    fromIndex < 0 || fromIndex >= stops.length ||
    toIndex < 0 || toIndex >= stops.length ||
    fromIndex === toIndex
  ) {
    return allPoints;
  }

  const [moved] = stops.splice(fromIndex, 1);
  stops.splice(toIndex, 0, moved);

  const orderById = new Map(stops.map((s, idx) => [String(s.id), idx]));
  return allPoints.map((p) => {
    const nextOrder = orderById.get(String(p.id));
    if (nextOrder === undefined) return p;
    return { ...p, day: dayName, dayOrder: nextOrder };
  });
}
