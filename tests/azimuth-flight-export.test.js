import { describe, it, expect } from 'vitest';
import {
  sunCalcAzimuthToBearingDeg,
  bearingToCompassZh,
  projectPointByBearing,
  computeSolarAzimuths,
} from '../src/utils/sunAzimuth.js';
import {
  computeGreatCirclePoints,
  estimateFlightStats,
  findNearestAirportHub,
} from '../src/utils/flightArc.js';
import { toGPX, toKML, toICS } from '../src/utils/pointsExport.js';
import {
  buildItineraryDays,
  estimateLegDurationMin,
  summarizeBudgetCNY,
} from '../src/utils/itinerary.js';
import { validatePointsPayload } from '../api/_lib/validation.js';

describe('sunAzimuth 太阳方位角与射线几何', () => {
  it('SunCalc 南基准弧度准确换算为正北罗盘度（东=90°, 南=180°, 西=270°）', () => {
    expect(sunCalcAzimuthToBearingDeg(-Math.PI / 2)).toBe(90);
    expect(sunCalcAzimuthToBearingDeg(0)).toBe(180);
    expect(sunCalcAzimuthToBearingDeg(Math.PI / 2)).toBe(270);
    expect(bearingToCompassZh(90)).toBe('正东');
    expect(bearingToCompassZh(245)).toBe('西南');
  });

  it('东京春分日出在正东附近（~90°）、日落在正西附近（~270°）', () => {
    const az = computeSolarAzimuths({ lat: 35.6812, lon: 139.7671, date: '2027-03-21' });
    expect(az).not.toBeNull();
    expect(az.sunrise.bearingDeg).toBeGreaterThan(80);
    expect(az.sunrise.bearingDeg).toBeLessThan(100);
    expect(az.sunset.bearingDeg).toBeGreaterThan(260);
    expect(az.sunset.bearingDeg).toBeLessThan(280);
  });

  it('projectPointByBearing 向正北投射 111km 纬度增加约 1°', () => {
    const dst = projectPointByBearing(35, 139, 0, 111.19);
    expect(dst.lat).toBeGreaterThan(35.95);
    expect(dst.lat).toBeLessThan(36.05);
    expect(Math.abs(dst.lon - 139)).toBeLessThan(0.01);
  });
});

describe('flightArc 大圆航线与跨太平洋经度展开', () => {
  it('东京→旧金山跨太平洋大圆弧线经度连续单调，不出现 360° 折返跳变', () => {
    const pts = computeGreatCirclePoints(35.5494, 139.7798, 37.6213, -122.3790, 48);
    expect(pts).toHaveLength(49);
    for (let i = 1; i < pts.length; i += 1) {
      expect(Math.abs(pts[i][1] - pts[i - 1][1])).toBeLessThan(15);
    }
    const stats = estimateFlightStats(35.5494, 139.7798, 37.6213, -122.3790);
    expect(stats.distanceKm).toBeGreaterThan(8000);
    expect(stats.distanceKm).toBeLessThan(8600);
  });

  it('findNearestAirportHub 为京都精准匹配大阪关西机场 KIX', () => {
    expect(findNearestAirportHub(34.985, 135.758)?.code).toBe('KIX');
  });
});

describe('多格式导出（GPX / KML / ICS）与行程预算/耗时', () => {
  const pts = [
    {
      id: 's1', name: '京都清水寺', lat: 34.9949, lon: 135.785, category: 'camera',
      source: '地图机位标记', day: 'Day 1', dayOrder: 0, timeSlot: '06:30',
      transitMode: 'rail', budget: 2000, currency: 'JPY', notes: '产宁坂早场'
    },
    {
      id: 's2', name: '大阪站', lat: 34.702, lon: 135.495, category: 'station',
      source: '手动', day: 'Day 1', dayOrder: 1, timeSlot: '10:00',
      transitMode: 'rail', budget: 100, currency: 'CNY'
    },
  ];

  it('toGPX / toKML / toICS 输出结构合法且包含关键信息', () => {
    const gpx = toGPX(pts);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('<wpt lat="34.9949" lon="135.785">');
    expect(gpx).toContain('产宁坂早场');

    const kml = toKML(pts);
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<coordinates>135.785,34.9949,0</coordinates>');

    const { days } = buildItineraryDays(pts);
    const ics = toICS(days, '2027-04-02');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270402');
    expect(ics).toContain('京都清水寺');
  });

  it('预算汇总按汇率折合人民币 + 交通耗时估算合理 + 后端校验放行 v3 行程字段', () => {
    const budget = summarizeBudgetCNY(pts, { JPY: 20 });
    expect(budget).toEqual({ totalCNY: 200, count: 2 });
    expect(estimateLegDurationMin(42, 'rail')).toBeGreaterThan(25);
    expect(estimateLegDurationMin(42, 'rail')).toBeLessThan(60);

    const v = validatePointsPayload(pts);
    expect(v.ok).toBe(true);
    expect(v.points[0].timeSlot).toBe('06:30');
    expect(v.points[0].transitMode).toBe('rail');
    expect(v.points[0].budget).toBe(2000);
    expect(v.points[0].currency).toBe('JPY');
  });
});
