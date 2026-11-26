// src/hooks/useTodaySnapshot.js
// 🌅 共享“当前地图中心”的天气、天象与附近点位聚合状态
// 供首页顶部焦点条 + 底部「今日光影与附近」卡片共用，保证单次天气请求与口径完全一致。

import { useState, useMemo, useEffect } from 'react';
import SunCalc from 'suncalc';
import { computeShootingBrief } from '../utils/shootingBrief';
import {
  buildTodayCard,
  formatLocalTimeByLon,
  formatUtcOffsetLabel,
  translateWeatherCondition
} from '../utils/todayCard';
import { convertToRuleFormat } from '../utils/ruleDataConverter';
import { getTopSuggestions } from '../utils/ruleMatcher';
import { getGlobalSeason } from '../utils/dataGateway';
import { HANABI_DATA } from '../config/regions';

export function fmtCountdown(at, now) {
  const mins = Math.round((at.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return '就是现在';
  if (mins < 60) return `${mins} 分钟后`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

function pickRelevant(intervals) {
  if (!intervals || intervals.length === 0) return null;
  const now = Date.now();
  return intervals.find((i) => i.end.getTime() >= now) || intervals[0];
}

export function useTodaySnapshot({ lat, lng, customPoints = [], basePoints = [] }) {
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const valid = Number.isFinite(lat) && Number.isFinite(lng);
  const latKey = valid ? Math.round(lat * 100) / 100 : null;
  const lngKey = valid ? Math.round(lng * 100) / 100 : null;

  const brief = useMemo(() => {
    if (latKey === null || lngKey === null) return null;
    try {
      return computeShootingBrief({ lat: latKey, lon: lngKey, date: new Date() });
    } catch {
      return null;
    }
  }, [latKey, lngKey]);

  const nearbyPool = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);
    const weekLater = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const favs = customPoints.map((p) => ({ id: `fav-${p.id}`, name: p.name, lat: p.lat, lon: p.lon, kind: 'favorite' }));
    const bases = basePoints.map((p) => ({ id: `base-${p.id}`, name: p.name, lat: p.lat, lon: p.lon, kind: 'base' }));
    const hanabi = HANABI_DATA
      .filter((e) => e.date >= todayStr && e.date <= weekLater)
      .map((e) => ({ id: `hanabi-${e.id}`, name: e.name, lat: e.lat, lon: e.lon, kind: 'hanabi', date: e.date }));
    return [...favs, ...bases, ...hanabi];
  }, [customPoints, basePoints, now]);

  const card = useMemo(() => {
    if (!brief || latKey === null || lngKey === null) return null;
    try {
      return buildTodayCard({ lat: latKey, lon: lngKey, brief, weather, points: nearbyPool, now });
    } catch {
      return null;
    }
  }, [brief, weather, nearbyPool, latKey, lngKey, now]);

  useEffect(() => {
    if (latKey === null || lngKey === null) return undefined;
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${latKey}&lon=${lngKey}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setWeather(json?.current ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [latKey, lngKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const trigger = useMemo(() => {
    if (!weather || latKey === null || lngKey === null) return null;
    try {
      const altitude = SunCalc.getPosition(now, latKey, lngKey).altitude * (180 / Math.PI);
      const moonPhase = SunCalc.getMoonIllumination(now).fraction;
      const env = {
        astronomy: { now: now.getTime(), solarAltitude: altitude, isNight: altitude < -6, moonPhase },
        climate: { season: getGlobalSeason(latKey, now.getMonth() + 1) },
        weather: {
          condition: weather.condition, clouds: weather.cloud,
          humidity: weather.humidity, visibility: 10000, windKph: weather.wind_kph,
          temp: weather.temp_c
        },
        terrain: { rawTags: [], poiTypes: [] }
      };
      const ruleData = convertToRuleFormat(env, latKey, lngKey);
      return getTopSuggestions(ruleData, 1, { minScore: 0, sortByScore: true })[0] || null;
    } catch {
      return null;
    }
  }, [weather, latKey, lngKey, now]);

  const tzLabel = lngKey !== null ? formatUtcOffsetLabel(lngKey) : '';
  const fmtTime = (d) => (lngKey !== null ? formatLocalTimeByLon(d, lngKey) : '—');
  const zhWeather = card?.weatherLine ? translateWeatherCondition(card.weatherLine.condition) : '';
  const gold = brief ? pickRelevant(brief.goldenHours) : null;
  const blue = brief ? pickRelevant(brief.blueHours) : null;
  const isPolar = brief ? (brief.sunrise === null && brief.sunset === null) : false;

  return {
    brief,
    card,
    trigger,
    now,
    tzLabel,
    zhWeather,
    gold,
    blue,
    isPolar,
    fmtTime,
  };
}
