// src/hooks/useTodaySnapshot.js
// 🌅 共享“当前地图中心”的天气、天象与附近点位聚合状态
// 供首页顶部焦点条 + 底部「今日光影与附近」卡片共用，保证单次天气请求与口径完全一致。

import { useState, useMemo, useEffect } from 'react';
import SunCalc from 'suncalc';
import { computeShootingBrief, formatLocalDateKey } from '../utils/shootingBrief';
import {
  buildTodayCard,
  currentAstroPhase,
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

export function fmtRemaining(end, now) {
  const mins = Math.max(1, Math.round((end.getTime() - now.getTime()) / 60000));
  if (mins < 60) return `剩余 ${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `剩余 ${h}h${m}m` : `剩余 ${h}h`;
}

export function useTodaySnapshot({ lat, lng, selectedDate = '', customPoints = [], basePoints = [] }) {
  // 按坐标键绑定天气结果，切换地点时立刻失效旧城市天气并进入加载态，绝不混显上一城数据
  const [weatherState, setWeatherState] = useState({ key: null, data: null });
  const [now, setNow] = useState(() => new Date());

  const valid = Number.isFinite(lat) && Number.isFinite(lng);
  const latKey = valid ? Math.round(lat * 100) / 100 : null;
  const lngKey = valid ? Math.round(lng * 100) / 100 : null;
  const coordKey = latKey !== null && lngKey !== null ? `${latKey},${lngKey}` : null;

  const localTodayKey = lngKey !== null ? formatLocalDateKey(now, lngKey) : '';
  const activeDateKey = selectedDate || localTodayKey;
  const isCustomDate = Boolean(selectedDate && localTodayKey && selectedDate !== localTodayKey);

  const weather = coordKey && weatherState.key === coordKey ? weatherState.data : null;
  const isWeatherLoading = Boolean(coordKey && weatherState.key !== coordKey);

  const brief = useMemo(() => {
    if (latKey === null || lngKey === null || !activeDateKey) return null;
    try {
      return computeShootingBrief({ lat: latKey, lon: lngKey, date: activeDateKey });
    } catch {
      return null;
    }
  }, [latKey, lngKey, activeDateKey]);

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

  const activeAstro = useMemo(() => {
    if (!brief || isCustomDate) return null;
    return currentAstroPhase(brief, now);
  }, [brief, isCustomDate, now]);

  useEffect(() => {
    if (!coordKey || latKey === null || lngKey === null) return undefined;
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${latKey}&lon=${lngKey}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setWeatherState({ key: coordKey, data: json?.current ?? null }))
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setWeatherState({ key: coordKey, data: null });
        }
      });
    return () => ctrl.abort();
  }, [coordKey, latKey, lngKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const trigger = useMemo(() => {
    if (!weather || isCustomDate || latKey === null || lngKey === null) return null;
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
  }, [weather, isCustomDate, latKey, lngKey, now]);

  const tzLabel = lngKey !== null ? formatUtcOffsetLabel(lngKey) : '';
  const fmtTime = (d) => (lngKey !== null ? formatLocalTimeByLon(d, lngKey) : '—');
  const zhWeather = card?.weatherLine ? translateWeatherCondition(card.weatherLine.condition) : '';
  const isPolar = brief ? (brief.sunrise === null && brief.sunset === null) : false;

  return {
    brief,
    card,
    activeAstro,
    trigger,
    now,
    tzLabel,
    zhWeather,
    isWeatherLoading,
    activeDateKey,
    localTodayKey,
    isCustomDate,
    morningGolden: brief?.morningGolden || null,
    eveningGolden: brief?.eveningGolden || null,
    morningBlue: brief?.morningBlue || null,
    eveningBlue: brief?.eveningBlue || null,
    isPolar,
    fmtTime,
  };
}
