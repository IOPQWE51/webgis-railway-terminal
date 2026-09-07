import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  nextAstroEvent,
  filterNearby,
  buildTodayCard,
  mapWeatherEmoji
} from '../src/utils/todayCard';
import { HANABI_DATA } from '../src/config/regions';

const TOKYO = { lat: 35.6812, lon: 139.7671 };
const YOKOHAMA = { lat: 35.4437, lon: 139.6380 };

describe('haversineKm 大圆距离', () => {
  it('东京站→横滨站 ≈ 27km（±3）', () => {
    const d = haversineKm(TOKYO.lat, TOKYO.lon, YOKOHAMA.lat, YOKOHAMA.lon);
    expect(d).toBeGreaterThan(24);
    expect(d).toBeLessThan(30);
  });

  it('同一点为 0，且距离对称', () => {
    expect(haversineKm(TOKYO.lat, TOKYO.lon, TOKYO.lat, TOKYO.lon)).toBe(0);
    const ab = haversineKm(TOKYO.lat, TOKYO.lon, YOKOHAMA.lat, YOKOHAMA.lon);
    const ba = haversineKm(YOKOHAMA.lat, YOKOHAMA.lon, TOKYO.lat, TOKYO.lon);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('非法入参返回 null 而非 NaN', () => {
    expect(haversineKm(NaN, 139, 35, 139)).toBeNull();
    expect(haversineKm(35, 139, undefined, 139)).toBeNull();
  });
});

describe('nextAstroEvent 下一个天象', () => {
  // 固定时区无关的构造：全部用同一份 Date 实例推进
  const mk = (h, m) => new Date(2026, 8, 6, h, m); // 本地 2026-09-06
  const brief = {
    sunrise: mk(5, 40),
    sunset: mk(18, 0),
    goldenHours: [
      { start: mk(5, 10), end: mk(6, 50) },
      { start: mk(17, 0), end: mk(18, 40) }
    ],
    blueHours: [
      { start: mk(4, 40), end: mk(5, 10) },
      { start: mk(18, 40), end: mk(19, 10) }
    ]
  };

  it('正午时下一个天象是傍晚黄金段起点', () => {
    const ev = nextAstroEvent(brief, mk(12, 0));
    expect(ev.key).toBe('golden');
    expect(ev.at.getTime()).toBe(mk(17, 0).getTime());
  });

  it('清晨 5:20 时下一个天象是日出', () => {
    const ev = nextAstroEvent(brief, mk(5, 20));
    expect(ev.key).toBe('sunrise');
    expect(ev.at.getTime()).toBe(mk(5, 40).getTime());
  });

  it('19:30 全部段已过 → null', () => {
    expect(nextAstroEvent(brief, mk(19, 30))).toBeNull();
  });

  it('空区间/缺字段的简报安全返回 null', () => {
    expect(nextAstroEvent({}, mk(12, 0))).toBeNull();
    expect(nextAstroEvent(null)).toBeNull();
  });
});

describe('filterNearby 附近点位过滤', () => {
  const center = TOKYO;
  const points = [
    { id: 'far', name: '远方', lat: 43.068, lon: 141.35, kind: 'base' },      // 札幌 ~800km
    { id: 'near1', name: '近处甲', lat: 35.4437, lon: 139.638, kind: 'favorite' }, // 横滨 ~27km
    { id: 'bad', name: '坏坐标', lat: NaN, lon: 139, kind: 'base' },
    { id: 'near2', name: '近处乙', lat: 35.7101, lon: 139.8016, kind: 'hanabi' }, // 隅田川 ~15km
    { id: 'edge', name: '半径边缘', lat: 36.0836, lon: 140.2, kind: 'base' }   // 土浦 ~60km
  ];

  it('按距离升序、截断半径、丢弃非法坐标', () => {
    const out = filterNearby({ ...center, points, radiusKm: 50, limit: 5 });
    expect(out.map((p) => p.id)).toEqual(['near2', 'near1']);
    expect(out[0].distanceKm).toBeLessThan(out[1].distanceKm);
  });

  it('limit 截取前 N 条', () => {
    const out = filterNearby({ ...center, points, radiusKm: 50, limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('near2');
  });

  it('空/异常入参安全返回空数组', () => {
    expect(filterNearby(null)).toEqual([]);
    expect(filterNearby({ ...center, points: 'nope' })).toEqual([]);
  });
});

describe('mapWeatherEmoji 天气映射', () => {
  it('已知条件映射正确', () => {
    expect(mapWeatherEmoji('Sunny')).toBe('☀️');
    expect(mapWeatherEmoji('Partly cloudy')).toBe('⛅');
    expect(mapWeatherEmoji('Moderate rain')).toBe('🌧️');
    expect(mapWeatherEmoji('Light snow')).toBe('❄️');
    expect(mapWeatherEmoji('Thunder')).toBe('⛈️');
    expect(mapWeatherEmoji('Fog')).toBe('🌫️');
  });

  it('未知条件兜底 🌍', () => {
    expect(mapWeatherEmoji('Mystery')).toBe('🌍');
    expect(mapWeatherEmoji(undefined)).toBe('🌍');
  });
});

describe('buildTodayCard 聚合', () => {
  const now = new Date(2026, 8, 6, 12, 0);
  const brief = {
    sunrise: new Date(2026, 8, 6, 5, 40),
    sunset: new Date(2026, 8, 6, 18, 0),
    goldenHours: [{ start: new Date(2026, 8, 6, 17, 0), end: new Date(2026, 8, 6, 18, 40) }],
    blueHours: [{ start: new Date(2026, 8, 6, 18, 40), end: new Date(2026, 8, 6, 19, 10) }],
    moon: { fraction: 0.4, phaseName: '娥眉月', emoji: '🌒' }
  };
  const weather = { condition: 'Clear', temp_c: 24, cloud: 10 };
  const points = [
    { id: 'p1', name: '近处', lat: 35.7101, lon: 139.8016, kind: 'favorite' }
  ];

  it('正常路径：聚合天气/天象/附近', () => {
    const card = buildTodayCard({ ...TOKYO, brief, weather, points, now });
    expect(card.weatherLine).toEqual({ emoji: '☀️', condition: 'Clear', tempC: 24, cloud: 10 });
    expect(card.nextAstro.key).toBe('golden');
    expect(card.nearby).toHaveLength(1);
    expect(card.nearby[0].kind).toBe('favorite');
  });

  it('weather 为 null → weatherLine 降级为 null，其余正常', () => {
    const card = buildTodayCard({ ...TOKYO, brief, weather: null, points, now });
    expect(card.weatherLine).toBeNull();
    expect(card.nearby).toHaveLength(1);
  });

  it('brief 为 null → 整卡 null（坐标非法场景）', () => {
    expect(buildTodayCard({ ...TOKYO, brief: null, weather, points, now })).toBeNull();
  });
});

describe('hanabiData 花火数据契约', () => {
  it('每条大会都有合法经纬度与 ISO 日期', () => {
    expect(HANABI_DATA.length).toBeGreaterThanOrEqual(4);
    for (const ev of HANABI_DATA) {
      expect(Number.isFinite(ev.lat)).toBe(true);
      expect(Number.isFinite(ev.lon)).toBe(true);
      expect(Math.abs(ev.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(ev.lon)).toBeLessThanOrEqual(180);
      expect(ev.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.name.length).toBeGreaterThan(0);
    }
  });
});
