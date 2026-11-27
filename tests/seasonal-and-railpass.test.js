import { describe, it, expect } from 'vitest';
import {
  SEASONAL_THEMES,
  SEASONAL_WINDOWS,
  resolveNextPeakDate,
  filterSeasonalWindows,
} from '../src/config/seasonalWindows';
import {
  PASS_SYSTEMS,
  evaluatePassComparison,
  buildLegsFromItinerary,
} from '../src/utils/railPassCalc';

describe('seasonalWindows: 全球季节与光影窗口库', () => {
  it('覆盖全年 1~12 月且每个点位坐标、月份与峰值日期合法', () => {
    const validThemes = new Set(SEASONAL_THEMES.filter((t) => t.id !== 'all').map((t) => t.id));
    const ids = new Set();

    for (const w of SEASONAL_WINDOWS) {
      expect(ids.has(w.id)).toBe(false);
      ids.add(w.id);
      expect(validThemes.has(w.theme)).toBe(true);
      expect(w.lat).toBeGreaterThanOrEqual(-90);
      expect(w.lat).toBeLessThanOrEqual(90);
      expect(w.lon).toBeGreaterThanOrEqual(-180);
      expect(w.lon).toBeLessThanOrEqual(180);
      expect(w.months.length).toBeGreaterThan(0);
      for (const m of w.months) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
      }
      expect(w.peakMonth).toBeGreaterThanOrEqual(1);
      expect(w.peakMonth).toBeLessThanOrEqual(12);
      expect(w.peakDay).toBeGreaterThanOrEqual(1);
      expect(w.peakDay).toBeLessThanOrEqual(31);
    }

    for (let month = 1; month <= 12; month += 1) {
      const matched = filterSeasonalWindows({ month });
      expect(matched.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolveNextPeakDate 尚未到来的日期返回当年，已过日期顺延明年', () => {
    const refNow = new Date(2026, 5, 15); // 2026-06-15
    expect(resolveNextPeakDate(7, 16, refNow)).toBe('2026-07-16');
    expect(resolveNextPeakDate(6, 15, refNow)).toBe('2026-06-15');
    expect(resolveNextPeakDate(4, 2, refNow)).toBe('2027-04-02');
    expect(resolveNextPeakDate(null, 2, refNow)).toBe('');
  });

  it('filterSeasonalWindows 支持按月份、主题与关键词组合筛选', () => {
    const aprilSakura = filterSeasonalWindows({ month: 4, theme: 'sakura' });
    expect(aprilSakura.length).toBeGreaterThanOrEqual(2);
    expect(aprilSakura.every((w) => w.theme === 'sakura' && w.months.includes(4))).toBe(true);

    const swissQuery = filterSeasonalWindows({ query: '瑞士' });
    expect(swissQuery.length).toBeGreaterThanOrEqual(2);
    expect(swissQuery.every((w) => w.country.includes('瑞士'))).toBe(true);
  });
});

describe('railPassCalc: 铁路通票半自动回本估算器', () => {
  it('evaluatePassComparison 正确判定划算、打平与建议单买', () => {
    const pass = PASS_SYSTEMS.jp.passes.find((p) => p.id === 'jr_kansai_hiroshima_5'); // ¥17,000
    expect(pass).toBeTruthy();

    // 空区段
    const empty = evaluatePassComparison(pass, []);
    expect(empty.singleTotal).toBe(0);
    expect(empty.worthwhile).toBe(false);

    // 往返新大阪↔广岛（10630 * 2 = 21260 > 17000，省 4260，>15%）
    const worthy = evaluatePassComparison(pass, [{ fare: 10630, count: 2 }]);
    expect(worthy.singleTotal).toBe(21260);
    expect(worthy.worthwhile).toBe(true);
    expect(worthy.savings).toBe(4260);
    expect(worthy.verdict).toContain('非常划算');

    // 单买更省（10630 < 17000）
    const singleBetter = evaluatePassComparison(pass, [{ fare: 10630, count: 1 }]);
    expect(singleBetter.worthwhile).toBe(false);
    expect(singleBetter.loss).toBe(6370);
    expect(singleBetter.verdict).toContain('建议单买');
  });

  it('buildLegsFromItinerary 仅提取 ≥5km 的铁道/未指定跨城段并跳过步行与航班', () => {
    const pts = [
      { id: 'p1', name: '东京站', lat: 35.6812, lon: 139.7671, day: 'Day 1', dayOrder: 0 },
      // 同城近距（<5km），应跳过
      { id: 'p2', name: '秋叶原', lat: 35.6984, lon: 139.7731, day: 'Day 1', dayOrder: 1, transitMode: 'rail' },
      // 跨城铁道（约 360km），应生成估算票价
      { id: 'p3', name: '京都站', lat: 34.9858, lon: 135.7588, day: 'Day 1', dayOrder: 2, transitMode: 'rail' },
      // 跨城航班，应跳过
      { id: 'p4', name: '札幌新千岁', lat: 42.7752, lon: 141.6923, day: 'Day 1', dayOrder: 3, transitMode: 'flight' },
      // 未指定交通方式的长距离跨城段（Day 2）
      { id: 'p5', name: '苏黎世', lat: 47.3779, lon: 8.5402, day: 'Day 2', dayOrder: 0 },
      { id: 'p6', name: '米兰中央站', lat: 45.4859, lon: 9.2043, day: 'Day 2', dayOrder: 1 },
    ];

    const jpLegs = buildLegsFromItinerary(pts, 'jp');
    expect(jpLegs.length).toBe(2);
    expect(jpLegs[0].label).toContain('秋叶原 → 京都站');
    expect(jpLegs[0].fare).toBeGreaterThanOrEqual(PASS_SYSTEMS.jp.minLegFare);
    expect(jpLegs[0].fare % PASS_SYSTEMS.jp.roundStep).toBe(0);

    const euLegs = buildLegsFromItinerary(pts, 'eu');
    expect(euLegs.length).toBe(2);
    expect(euLegs[1].label).toContain('苏黎世 → 米兰中央站');
    expect(euLegs[1].fare).toBeGreaterThanOrEqual(PASS_SYSTEMS.eu.minLegFare);
    expect(euLegs[1].fare % PASS_SYSTEMS.eu.roundStep).toBe(0);
  });
});
