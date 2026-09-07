// src/components/TodayCard.jsx
// 🗓️ 今日去这卡 —— 天文条 + 天气 + 下一个天象倒计时 + 今日触发器 + 附近点位
// 纯聚合零新数据源：astro/shootingBrief.js 本地计算，天气复用 /api/weather（边缘缓存），
// 附近点位来自收藏 + 基础点位 + 本地花火库。设计契约见 specs/2026-09-06-today-card-design.md

import { useState, useMemo, useEffect } from 'react';
import SunCalc from 'suncalc';
import { computeShootingBrief } from '../utils/shootingBrief';
import { buildTodayCard } from '../utils/todayCard';
import { convertToRuleFormat } from '../utils/ruleDataConverter';
import { getTopSuggestions } from '../utils/ruleMatcher';
import { getGlobalSeason } from '../utils/dataGateway';
import { HANABI_DATA } from '../config/regions';

const fmtTime = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '—';

const fmtCountdown = (at, now) => {
  const mins = Math.round((at.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return '就是现在';
  if (mins < 60) return `${mins} 分钟后`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} 小时 ${m} 分后` : `${h} 小时后`;
};

const KIND_BADGE = {
  favorite: { emoji: '⭐', title: '我的收藏' },
  base: { emoji: '🚉', title: '铁道节点' },
  hanabi: { emoji: '🎆', title: '花火大会' }
};

/** 取"当前正在进行或最近一段"，无则取最早段（沿用原简报口径） */
function pickRelevant(intervals) {
  if (!intervals || intervals.length === 0) return null;
  const now = Date.now();
  return intervals.find((i) => i.end.getTime() >= now) || intervals[0];
}

export default function TodayCard({ lat, lng, customPoints = [], basePoints = [], onFlyTo }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('earth_terminal_brief_collapsed') === '1'; }
    catch { return false; }
  });
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(() => new Date()); // 每分钟跳动的"当前时刻"：倒计时/花火过滤/触发器共用

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem('earth_terminal_brief_collapsed', c ? '0' : '1'); }
    catch { /* 隐私模式等场景静默降级 */ }
    return !c;
  });

  const latKey = Math.round(lat * 100) / 100;
  const lngKey = Math.round(lng * 100) / 100;

  const brief = useMemo(() => {
    try {
      return computeShootingBrief({ lat: latKey, lon: lngKey, date: new Date() });
    } catch (e) {
      console.warn('今日卡天文计算失败:', e.message);
      return null;
    }
  }, [latKey, lngKey]);

  // 附近点位池：收藏 + 铁道节点 + 未来 7 天内的花火大会（过期的花火不上榜）
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
    if (!brief) return null;
    try {
      return buildTodayCard({ lat: latKey, lon: lngKey, brief, weather, points: nearbyPool, now });
    } catch (e) {
      console.warn('今日卡聚合失败:', e.message);
      return null;
    }
  }, [brief, weather, nearbyPool, latKey, lngKey, now]);

  // 天气：单请求（/api/weather 生产边缘缓存 5min），失败静默降级
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${latKey}&lon=${lngKey}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setWeather(json?.current ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [latKey, lngKey]);

  // 倒计时每分钟刷新（仅展开时）
  useEffect(() => {
    if (collapsed) return undefined;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [collapsed]);

  // 今日触发器：本地天文 + 单路天气喂给决定性瞬间规则引擎，取最稀有的一条
  const trigger = useMemo(() => {
    if (!weather) return null;
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

  if (!brief) return null;

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        aria-label="展开今日去这卡"
        className="absolute top-4 left-1/2 -translate-x-1/2 z-[1500] w-9 h-9 rounded-full bg-zinc-900/85 backdrop-blur-md border border-cyan-500/30 text-lg leading-none hover:border-cyan-400 transition-colors"
      >
        🌅
      </button>
    );
  }

  const gold = pickRelevant(brief.goldenHours);
  const blue = pickRelevant(brief.blueHours);
  const isPolar = brief.sunrise === null && brief.sunset === null;

  return (
    <div
      role="status"
      aria-label="今日去这卡"
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[1500] w-[min(92vw,360px)] rounded-2xl bg-zinc-950/85 backdrop-blur-md border border-cyan-400/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-zinc-100 overflow-hidden"
    >
      {/* 天文条（原简报五要素作卡头） */}
      <div className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-8 pt-3 pb-2 text-xs font-mono text-cyan-50 border-b border-white/5">
        {isPolar ? (
          <span title="极地天象">❄️ 极昼或极夜，太阳今天不上班</span>
        ) : (
          <>
            <span title="日出">🌅 {fmtTime(brief.sunrise)}</span>
            <span title="日落">🌇 {fmtTime(brief.sunset)}</span>
            <span title="黄金时刻">✨ {fmtTime(gold?.start)}–{fmtTime(gold?.end)}</span>
            <span title="蓝调时刻">🌌 {fmtTime(blue?.start)}–{fmtTime(blue?.end)}</span>
            <span title={`月相：${brief.moon.phaseName}`}>
              {brief.moon.emoji} {Math.round(brief.moon.fraction * 100)}%
            </span>
          </>
        )}
        <button
          onClick={toggle}
          className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-cyan-300 transition-colors"
          aria-label="收起今日去这卡"
        >
          ×
        </button>
      </div>

      {/* 下一个天象倒计时 */}
      {card?.nextAstro && (
        <div className="px-4 py-3 flex items-baseline gap-2 border-b border-white/5">
          <span className="text-base">{card.nextAstro.emoji}</span>
          <span className="font-mono text-sm text-cyan-300">{fmtTime(card.nextAstro.at)}</span>
          <span className="text-xs text-zinc-300">{card.nextAstro.label}</span>
          <span className="ml-auto text-xs font-mono text-amber-300">
            {fmtCountdown(card.nextAstro.at, now)}
          </span>
        </div>
      )}

      {/* 天气行 */}
      {card?.weatherLine && (
        <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-zinc-300 border-b border-white/5">
          <span className="text-base leading-none">{card.weatherLine.emoji}</span>
          <span>{card.weatherLine.condition}</span>
          <span className="font-mono">{card.weatherLine.tempC}°C</span>
          {card.weatherLine.cloud !== null && (
            <span className="ml-auto font-mono text-zinc-500">云量 {card.weatherLine.cloud}%</span>
          )}
        </div>
      )}

      {/* 今日触发器（决定性瞬间规则引擎最稀有的一条） */}
      {trigger && (
        <div
          className="mx-3 mt-3 rounded-xl bg-rose-500/10 border border-rose-400/20 px-3 py-2 text-xs text-rose-200 leading-relaxed"
          title={trigger.output}
        >
          {trigger.output.split('|')[0].trim()}
          <span className="ml-1 opacity-70">{'⭐'.repeat(trigger.rarity || 3)}</span>
        </div>
      )}

      {/* 附近点位 */}
      <div className="px-4 py-3">
        {card?.nearby?.length > 0 ? (
          <ul className="space-y-1">
            {card.nearby.map((p) => {
              const badge = KIND_BADGE[p.kind] || KIND_BADGE.base;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onFlyTo?.(p.lat, p.lon)}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left text-xs hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-cyan-400"
                    title={`${badge.title} · 点击跃迁`}
                  >
                    <span aria-hidden="true">{badge.emoji}</span>
                    <span className="truncate text-zinc-200">{p.name}</span>
                    {p.date && p.date !== now.toISOString().slice(0, 10) && (
                      <span className="font-mono text-[10px] text-rose-300/80">{p.date}</span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-cyan-300/80">
                      {p.distanceKm.toFixed(1)} km
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-1.5 text-xs text-zinc-500">
            50km 内暂时空空如也 —— 拖动地图，去别处看看
          </p>
        )}
      </div>
    </div>
  );
}
