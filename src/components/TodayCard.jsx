// src/components/TodayCard.jsx
// 🗓️ 今日去这卡 —— 天文条 + 天气 + 下一个天象倒计时 + 今日触发器 + 附近点位
// 纯聚合零新数据源：astro/shootingBrief.js 本地计算，天气复用 /api/weather（边缘缓存），
// 附近点位来自收藏 + 基础点位 + 本地花火库。设计契约见 specs/2026-09-06-today-card-design.md

import { useState, useMemo, useEffect } from 'react';
import SunCalc from 'suncalc';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { computeShootingBrief } from '../utils/shootingBrief';
import { buildTodayCard, formatLocalTimeByLon, formatUtcOffsetLabel, translateWeatherCondition } from '../utils/todayCard';
import { convertToRuleFormat } from '../utils/ruleDataConverter';
import { getTopSuggestions } from '../utils/ruleMatcher';
import { getGlobalSeason } from '../utils/dataGateway';
import { HANABI_DATA, REGION_REGISTRY } from '../config/regions';

const fmtCountdown = (at, now) => {
  const mins = Math.round((at.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return '就是现在';
  if (mins < 60) return `${mins} 分钟后`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}m` : `${h}h`;
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
  // 默认收起为轻盈单行浅色胶囊，把视觉空间还给地图；用户主动展开后记住偏好
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('earth_terminal_today_expanded') === '1'; }
    catch { return false; }
  });
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const toggle = () => setExpanded((prev) => {
    const next = !prev;
    try { localStorage.setItem('earth_terminal_today_expanded', next ? '1' : '0'); }
    catch { /* 隐私模式等场景静默降级 */ }
    return next;
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

  // 倒计时每分钟刷新
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // 今日触发器：仅展开时计算展示
  const trigger = useMemo(() => {
    if (!expanded || !weather) return null;
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
  }, [expanded, weather, latKey, lngKey, now]);

  if (!brief) return null;

  const gold = pickRelevant(brief.goldenHours);
  const blue = pickRelevant(brief.blueHours);
  const isPolar = brief.sunrise === null && brief.sunset === null;
  const tzLabel = formatUtcOffsetLabel(lngKey);
  const fmtTime = (d) => formatLocalTimeByLon(d, lngKey);
  const zhWeather = card?.weatherLine ? translateWeatherCondition(card.weatherLine.condition) : '';

  // 🌤️ 默认态：轻盈单行浅色毛玻璃胶囊（融入天の川底色，不挡地图）
  if (!expanded) {
    return (
      <div className="absolute top-[60px] left-3.5 lg:top-3.5 lg:left-1/2 lg:-translate-x-1/2 z-[1050] max-w-[calc(100%-84px)]">
        <button
          type="button"
          onClick={toggle}
          aria-expanded="false"
          aria-label="展开当地天气与光影详情"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-paper-2/90 hover:bg-paper-2 backdrop-blur-md border border-line/90 shadow-lift text-xs text-ink transition-[background-color,box-shadow] duration-200 max-w-full"
        >
          {card?.weatherLine ? (
            <span className="flex items-center gap-1 shrink-0 font-bold text-ink">
              <span aria-hidden="true">{card.weatherLine.emoji}</span>
              <span className="hidden sm:inline">{zhWeather}</span>
              <span className="tnum font-mono text-sora-deep">{card.weatherLine.tempC}°C</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 shrink-0 font-bold text-ink">
              <span aria-hidden="true">🌅</span>
              <span className="tnum font-mono">{fmtTime(brief.sunrise)}</span>
            </span>
          )}

          <span className="text-line" aria-hidden="true">·</span>

          {isPolar ? (
            <span className="truncate text-ink-2">❄️ 极昼/极夜</span>
          ) : card?.nextAstro ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <span aria-hidden="true">{card.nextAstro.emoji}</span>
              <span className="tnum font-mono font-bold text-ink">{fmtTime(card.nextAstro.at)}</span>
              <span className="truncate text-ink-2 hidden sm:inline">{card.nextAstro.label}</span>
              <span className="tnum shrink-0 px-1.5 py-0.5 rounded-full bg-kouchou-soft text-ink text-[11px] font-bold">
                {fmtCountdown(card.nextAstro.at, now)}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-ink-2">
              <span>🌇 {fmtTime(brief.sunset)}</span>
              <span className="text-[10px] text-ink-3 font-mono">{tzLabel}</span>
            </span>
          )}

          <ChevronDown className="w-3.5 h-3.5 text-ink-3 shrink-0 ml-0.5" />
        </button>
      </div>
    );
  }

  // 📖 展开态：浅色毛玻璃信息卡（温和、清晰、不突兀）
  return (
    <div
      role="status"
      aria-label="当地天气与光影详情"
      className="absolute top-[60px] left-3.5 lg:top-3.5 lg:left-1/2 lg:-translate-x-1/2 z-[1150] w-[min(calc(100%-84px),340px)] rounded-2xl bg-paper-2/95 backdrop-blur-xl border border-line shadow-xl text-ink overflow-hidden"
    >
      {/* 顶栏：当地天气 + 收起 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-paper-3/60 border-b border-line/80">
        <div className="flex items-center gap-2 text-xs font-bold text-ink">
          {card?.weatherLine ? (
            <>
              <span className="text-base leading-none">{card.weatherLine.emoji}</span>
              <span>{zhWeather}</span>
              <span className="tnum font-mono text-sora-deep">{card.weatherLine.tempC}°C</span>
              {card.weatherLine.cloud !== null && (
                <span className="text-[11px] font-normal text-ink-3">云量 {card.weatherLine.cloud}%</span>
              )}
            </>
          ) : (
            <span>当地光影与附近</span>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold text-ink-3 hover:text-sora-deep hover:bg-sora-soft/50 transition-colors"
          aria-label="收起当地天气与光影详情"
        >
          收起 <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 天文五要素 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs font-mono text-ink-2 border-b border-line/60">
        {isPolar ? (
          <span className="font-sans">❄️ 极昼或极夜</span>
        ) : (
          <>
            <span title={`日出（当地时间 ${tzLabel}）`}>🌅 {fmtTime(brief.sunrise)}</span>
            <span title={`日落（当地时间 ${tzLabel}）`}>🌇 {fmtTime(brief.sunset)}</span>
            <span title={`黄金时刻（当地时间 ${tzLabel}）`}>✨ {fmtTime(gold?.start)}–{fmtTime(gold?.end)}</span>
            <span title={`蓝调时刻（当地时间 ${tzLabel}）`}>🌌 {fmtTime(blue?.start)}–{fmtTime(blue?.end)}</span>
            <span title={`月相：${brief.moon.phaseName}`}>
              {brief.moon.emoji} {Math.round(brief.moon.fraction * 100)}%
            </span>
            <span className="ml-auto text-[10px] text-ink-3 bg-paper-3 px-1.5 py-0.5 rounded">{tzLabel}</span>
          </>
        )}
      </div>

      {/* 下一个天象倒计时 */}
      {card?.nextAstro && (
        <div className="px-4 py-2.5 flex items-center gap-2 text-xs border-b border-line/60">
          <span>{card.nextAstro.emoji}</span>
          <span className="tnum font-mono font-bold text-sora-deep">{fmtTime(card.nextAstro.at)}</span>
          <span className="text-ink-2">{card.nextAstro.label}</span>
          <span className="ml-auto tnum px-2 py-0.5 rounded-full bg-kouchou-soft text-ink text-[11px] font-bold">
            {fmtCountdown(card.nextAstro.at, now)}
          </span>
        </div>
      )}

      {/* 今日触发器 */}
      {trigger && (
        <div
          className="mx-3 mt-2.5 rounded-xl bg-koi-soft/75 border border-koi/20 px-3 py-2 text-xs text-ink leading-relaxed"
          title={trigger.output}
        >
          {trigger.output.split('|')[0].trim()}
          <span className="ml-1 opacity-80">{'⭐'.repeat(trigger.rarity || 3)}</span>
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
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left text-xs hover:bg-sora-soft/50 transition-colors"
                    title={`${badge.title} · 点击定位`}
                  >
                    <span aria-hidden="true">{badge.emoji}</span>
                    <span className="truncate text-ink font-medium">{p.name}</span>
                    {p.date && p.date !== now.toISOString().slice(0, 10) && (
                      <span className="font-mono text-[10px] text-koi">{p.date}</span>
                    )}
                    <span className="ml-auto shrink-0 tnum font-mono text-sora-deep">
                      {p.distanceKm.toFixed(1)} km
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink-3">
              当前视野 50km 内暂无已收录节点，点击地图任意位置可查看光影或收藏
            </p>
            <div className="flex flex-wrap gap-1.5">
              {customPoints[0] && (
                <button
                  onClick={() => onFlyTo?.(customPoints[0].lat, customPoints[0].lon, 13)}
                  className="px-2.5 py-1 rounded-lg bg-sora-soft/70 hover:bg-sora-soft text-[11px] font-bold text-sora-deep transition-colors"
                >
                  ⭐ 跳到我的收藏
                </button>
              )}
              {REGION_REGISTRY.map((r) => (
                r.center && (
                  <button
                    key={r.id}
                    onClick={() => onFlyTo?.(r.center[0], r.center[1], r.zoom ?? 5.5)}
                    className="px-2.5 py-1 rounded-lg bg-wakaba-soft hover:bg-wakaba-soft/80 text-[11px] font-bold text-ink transition-colors"
                  >
                    {r.icon || '🌍'} 浏览{r.name}铁道
                  </button>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
