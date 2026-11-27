import { describe, it, expect } from 'vitest';
import {
  buildItineraryDays,
  assignPointToDay,
  reorderDayPoints,
  nextDayLabel,
  compareDayLabels,
} from '../src/utils/itinerary.js';
import { validatePointsPayload } from '../api/_lib/validation.js';
import { getIconStyle } from '../src/utils/helpers.js';
import { getPointFilterType } from '../src/config/mapConstants.js';
import { RAILWAY_LINES_CONFIG } from '../src/config/regions/index.js';

const samplePoints = [
  { id: 'kyoto', name: '京都清水寺机位', lat: 34.9949, lon: 135.785, category: 'camera', bestTime: 'morning', focalLength: '24-70mm', notes: '产宁坂早起无路人', source: '地图机位标记', day: 'Day 1', dayOrder: 0 },
  { id: 'osaka', name: '大阪站', lat: 34.702, lon: 135.495, category: 'station', source: '手动', day: 'Day 1', dayOrder: 1 },
  { id: 'onomichi', name: '尾道千光寺展望台', lat: 34.4106, lon: 133.1995, category: 'camera', bestTime: 'evening', focalLength: '70-200mm', source: '地图机位标记', day: 'Day 2', dayOrder: 0 },
  { id: 'takamatsu', name: '高松港', lat: 34.351, lon: 134.049, category: 'spot', source: '手动', day: 'Day 2', dayOrder: 1 },
  { id: 'fukuoka', name: '博多运河城', lat: 33.5898, lon: 130.4108, category: 'spot', source: '手动' },
];

describe('itinerary 行程编排纯函数', () => {
  it('按天分组、自然排序、自动计算段间直线距离与全程里程', () => {
    const res = buildItineraryDays(samplePoints);
    expect(res.days.map((d) => d.day)).toEqual(['Day 1', 'Day 2']);
    expect(res.scheduledCount).toBe(4);
    expect(res.unassigned.map((p) => p.id)).toEqual(['fukuoka']);

    // 京都→大阪直线约 41-44 km
    expect(res.days[0].stops[0].legFromPrevKm).toBeNull();
    expect(res.days[0].stops[1].legFromPrevKm).toBeGreaterThan(38);
    expect(res.days[0].stops[1].legFromPrevKm).toBeLessThan(46);
    expect(res.days[0].totalDistanceKm).toBeCloseTo(res.days[0].stops[1].legFromPrevKm, 1);

    // 尾道→高松直线约 75-85 km
    expect(res.days[1].totalDistanceKm).toBeGreaterThan(72);
    expect(res.days[1].totalDistanceKm).toBeLessThan(86);
    expect(res.grandTotalKm).toBeGreaterThan(110);
  });

  it('Day 10 排在 Day 2 之后（自然数字序）', () => {
    expect(['Day 10', 'Day 2', 'Day 1'].sort(compareDayLabels)).toEqual(['Day 1', 'Day 2', 'Day 10']);
    expect(nextDayLabel(['Day 1', 'Day 3'])).toBe('Day 4');
  });

  it('assignPointToDay 可排入指定天并支持移出行程', () => {
    const added = assignPointToDay(samplePoints, 'fukuoka', 'Day 3');
    const fk = added.find((p) => p.id === 'fukuoka');
    expect(fk.day).toBe('Day 3');
    expect(fk.dayOrder).toBe(0);

    const removed = assignPointToDay(added, 'fukuoka', '');
    const fk2 = removed.find((p) => p.id === 'fukuoka');
    expect(fk2.day).toBeUndefined();
    expect(fk2.dayOrder).toBeUndefined();
  });

  it('reorderDayPoints 同天内重排顺序后 dayOrder 连续更新', () => {
    const swapped = reorderDayPoints(samplePoints, 'Day 1', 0, 1);
    const { days } = buildItineraryDays(swapped);
    expect(days[0].stops.map((s) => s.id)).toEqual(['osaka', 'kyoto']);
    expect(days[0].stops.map((s) => s.dayOrder)).toEqual([0, 1]);
  });
});

describe('v3 机位类型与云同步白名单校验', () => {
  it('camera 点位类型映射到专属图标与图层筛选', () => {
    expect(getIconStyle('camera').icon).toBe('📷');
    expect(getPointFilterType({ category: 'camera', source: '' })).toBe('camera');
  });

  it('validatePointsPayload 放行合法机位属性与行程编排字段', () => {
    const r = validatePointsPayload([samplePoints[0]]);
    expect(r.ok).toBe(true);
    expect(r.points[0].bestTime).toBe('morning');
    expect(r.points[0].focalLength).toBe('24-70mm');
    expect(r.points[0].notes).toBe('产宁坂早起无路人');
    expect(r.points[0].day).toBe('Day 1');
    expect(r.points[0].dayOrder).toBe(0);
  });

  it('validatePointsPayload 拒绝非法 bestTime 或负数 dayOrder', () => {
    expect(validatePointsPayload([{ ...samplePoints[0], bestTime: 'midnight' }]).ok).toBe(false);
    expect(validatePointsPayload([{ ...samplePoints[0], dayOrder: -1 }]).ok).toBe(false);
  });

  it('所有铁道干线均有可读中文名称，供线路目录列表展示', () => {
    expect(RAILWAY_LINES_CONFIG.length).toBeGreaterThanOrEqual(20);
    for (const line of RAILWAY_LINES_CONFIG) {
      expect(typeof line.name).toBe('string');
      expect(line.name.trim().length).toBeGreaterThan(0);
    }
  });
});
