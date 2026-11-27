// src/utils/todayCard.js
// 🗓️ 今日去这卡 · 纯函数聚合层
// 四路数据聚合成视图模型：天文（本地）+ 天气（上游已缓存）+ 附近点位（收藏/基础/花火）
// 设计契约见 docs/superpowers/specs/2026-09-06-today-card-design.md §3.1

const EARTH_R_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** 大圆距离（km）；任一坐标非法返回 null */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const nums = [lat1, lon1, lat2, lon2];
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const ASTRO_EVENT_META = {
  sunrise: { label: '日出', emoji: '🌅' },
  sunset: { label: '日落', emoji: '🌇' },
  golden: { label: '黄金时刻', emoji: '✨' },
  blue: { label: '蓝调时刻', emoji: '🌌' }
};

/**
 * 当前正处于黄金或蓝调时刻内时，返回进行中的窗口信息（用于顶部状态栏显示“进行中 · 剩余 X 分钟”，避免与下方时段矛盾）
 */
export function currentAstroPhase(brief, now = new Date()) {
  if (!brief || !(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const t = now.getTime();
  for (const seg of brief.goldenHours || []) {
    if (seg?.start instanceof Date && seg?.end instanceof Date && t >= seg.start.getTime() && t < seg.end.getTime()) {
      return { key: 'golden', ...ASTRO_EVENT_META.golden, start: seg.start, end: seg.end };
    }
  }
  for (const seg of brief.blueHours || []) {
    if (seg?.start instanceof Date && seg?.end instanceof Date && t >= seg.start.getTime() && t < seg.end.getTime()) {
      return { key: 'blue', ...ASTRO_EVENT_META.blue, start: seg.start, end: seg.end };
    }
  }
  return null;
}

/**
 * 下一个天象：候选为日出/日落/各黄金·蓝调段的起点，取 now 之后最近者。
 * 全部已过或简报为空 → null
 */
export function nextAstroEvent(brief, now = new Date()) {
  if (!brief || !(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const candidates = [];
  const push = (key, at) => {
    if (at instanceof Date && !Number.isNaN(at.getTime()) && at.getTime() > now.getTime()) {
      candidates.push({ key, ...ASTRO_EVENT_META[key], at });
    }
  };
  push('sunrise', brief.sunrise);
  push('sunset', brief.sunset);
  for (const seg of brief.goldenHours || []) push('golden', seg?.start);
  for (const seg of brief.blueHours || []) push('blue', seg?.start);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidates[0];
}

/**
 * 附近点位：按距中心距离升序，radiusKm 截断、limit 截取、非法坐标丢弃。
 * 入参 points 每项 {id,name,lat,lon,kind,...}；输出附带 distanceKm（1 位小数）
 */
export function filterNearby(options) {
  const { lat, lon, points, radiusKm = 50, limit = 5 } = options || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Array.isArray(points)) return [];
  return points
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))
    .map((p) => ({ ...p, distanceKm: haversineKm(lat, lon, p.lat, p.lon) }))
    .filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(0, limit))
    .map((p) => ({ ...p, distanceKm: Math.round(p.distanceKm * 10) / 10 }));
}

const WEATHER_EMOJI_RULES = [
  [/thunder|storm/i, '⛈️'],
  [/snow|sleet|blizzard|ice/i, '❄️'],
  [/rain|drizzle|shower/i, '🌧️'],
  [/fog|mist|smoke|haze/i, '🌫️'],
  [/partly/i, '⛅'],
  [/overcast|cloudy/i, '☁️'],
  [/sun|clear/i, '☀️']
];

/** 天气条件 → emoji；未知兜底 🌍 */
export function mapWeatherEmoji(condition) {
  const text = String(condition ?? '');
  for (const [re, emoji] of WEATHER_EMOJI_RULES) {
    if (re.test(text)) return emoji;
  }
  return '🌍';
}

const WEATHER_ZH_RULES = [
  [/patchy rain nearby/i, '周边零星小雨'],
  [/patchy light rain/i, '局地小雨'],
  [/light rain shower/i, '小阵雨'],
  [/light rain/i, '小雨'],
  [/moderate rain/i, '中雨'],
  [/heavy rain/i, '大雨'],
  [/torrential rain/i, '暴雨'],
  [/light drizzle|patchy light drizzle/i, '毛毛雨'],
  [/thunder/i, '雷雨'],
  [/light snow|patchy snow/i, '小雪'],
  [/moderate snow/i, '中雪'],
  [/heavy snow|blizzard/i, '大雪'],
  [/sleet/i, '雨夹雪'],
  [/partly cloudy/i, '局部多云'],
  [/overcast/i, '阴天'],
  [/cloudy/i, '多云'],
  [/sunny/i, '晴天'],
  [/clear/i, '晴朗'],
  [/mist/i, '薄雾'],
  [/fog/i, '大雾'],
  [/haze/i, '霾']
];

/** 常见英文天气词转中文（未命中时保留原文，确保全球天气可读） */
export function translateWeatherCondition(condition) {
  const text = String(condition ?? '').trim();
  if (!text) return '';
  for (const [re, zh] of WEATHER_ZH_RULES) {
    if (re.test(text)) return zh;
  }
  return text;
}

/** 按经度估算当地太阳时偏移（小时），与 photoEngine 口径一致 */
export function getUtcOffsetByLon(lon) {
  if (!Number.isFinite(lon)) return 0;
  return Math.round(lon / 15);
}

/** 格式化时区标签（如 UTC+8 / UTC+9 / UTC-5） */
export function formatUtcOffsetLabel(lon) {
  const offset = getUtcOffsetByLon(lon);
  return offset >= 0 ? `UTC+${offset}` : `UTC${offset}`;
}

/** 按目标地经度格式化当地时间 HH:MM（避免国内看海外坐标时出现浏览器时区错位） */
export function formatLocalTimeByLon(date, lon) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  const offsetMs = getUtcOffsetByLon(lon) * 3600000;
  const local = new Date(date.getTime() + offsetMs);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * 聚合入口：brief 非法（坐标不可算）→ 整卡 null；
 * weather 缺失 → weatherLine 降级为 null，其余路照常
 */
export function buildTodayCard({ lat, lon, brief, weather, points = [], now = new Date() }) {
  if (!brief) return null;
  return {
    nextAstro: nextAstroEvent(brief, now),
    weatherLine:
      weather && Number.isFinite(weather.temp_c)
        ? {
            emoji: mapWeatherEmoji(weather.condition),
            condition: weather.condition ?? '',
            tempC: Math.round(weather.temp_c),
            cloud: Number.isFinite(weather.cloud) ? Math.round(weather.cloud) : null
          }
        : null,
    nearby: filterNearby({ lat, lon, points, radiusKm: 50, limit: 5 })
  };
}
