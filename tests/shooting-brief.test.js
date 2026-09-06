import { describe, it, expect } from 'vitest';
import {
  computeShootingBrief,
  moonPhaseInfo,
  phaseMeta,
} from '../src/utils/shootingBrief.js';

const TOKYO = { lat: 35.6812, lon: 139.7671 };

describe('computeShootingBrief · 真实值锚定', () => {
  const brief = computeShootingBrief({
    ...TOKYO,
    date: new Date('2026-08-25T12:00:00+09:00'),
  });

  it('东京站日出 ≈ 05:08 JST（±6min，与线上 v5.3.0 详情卡交叉验证）', () => {
    const anchor = new Date('2026-08-24T20:08:00Z');
    expect(Math.abs(brief.sunrise - anchor)).toBeLessThan(6 * 60000);
  });

  it('东京站日落 ≈ 18:19 JST（±6min）', () => {
    const anchor = new Date('2026-08-25T09:19:00Z');
    expect(Math.abs(brief.sunset - anchor)).toBeLessThan(6 * 60000);
  });

  it('傍晚存在一段黄金时刻，且结束于日落前后 90 分钟内', () => {
    // 时区无关筛法：取"结束时刻离日落最近"的一段即傍晚段。
    // （此前用本地 getHours()>=11 筛段，在 UTC 时区的 CI 上会筛错段，断言出 11 小时级偏差）
    const ev = [...brief.goldenHours]
      .sort((a, b) => Math.abs(a.end - brief.sunset) - Math.abs(b.end - brief.sunset))[0];
    expect(ev).toBeTruthy();
    expect(Math.abs(ev.end.getTime() - brief.sunset.getTime()))
      .toBeLessThanOrEqual(90 * 60000);
  });

  it('晚侧蓝调段紧贴黄金段外沿（|gold.end − blue.start| ≤ 5min）', () => {
    const nearest = (arr, t) => [...arr]
      .sort((a, b) => Math.abs(a.start - t) - Math.abs(b.start - t))[0];
    const evGold = nearest(brief.goldenHours, brief.sunset); // 结束贴日落的黄金段
    const evBlue = nearest(brief.blueHours, evGold.end);      // 起点贴它外沿的蓝调段
    expect(evGold).toBeTruthy();
    expect(evBlue).toBeTruthy();
    expect(Math.abs(evGold.end.getTime() - evBlue.start.getTime()))
      .toBeLessThanOrEqual(5 * 60000);
  });
});

describe('computeShootingBrief · 极端天象', () => {
  it('Svalbard 极夜（2025-12-21）：日出日落为空、黄金段为空、不抛异常', () => {
    const b = computeShootingBrief({ lat: 78.2, lon: 15.6, date: new Date('2025-12-21T12:00:00Z') });
    expect(b).not.toBeNull();
    expect(b.sunrise).toBeNull();
    expect(b.goldenHours).toHaveLength(0);
    expect(Array.isArray(b.blueHours)).toBe(true);
  });

  it('Svalbard 极昼（2026-06-21）：日落为空、结构完整、不抛异常', () => {
    const b = computeShootingBrief({ lat: 78.2, lon: 15.6, date: new Date('2026-06-21T12:00:00Z') });
    expect(b.sunset).toBeNull();
    expect(Array.isArray(b.goldenHours)).toBe(true);
    expect(b.moon.fraction).toBeGreaterThanOrEqual(0);
  });
});

describe('computeShootingBrief · 输入防御', () => {
  it('非法坐标返回 null', () => {
    expect(computeShootingBrief({ lat: 91, lon: 200 })).toBeNull();
    expect(computeShootingBrief({ lat: NaN, lon: 0 })).toBeNull();
    expect(computeShootingBrief({ lat: 35 })).toBeNull();
  });

  it('非法日期返回 null', () => {
    expect(computeShootingBrief({ ...TOKYO, date: new Date('not-a-date') })).toBeNull();
  });
});

describe('moonPhaseInfo / phaseMeta', () => {
  it('phaseMeta 相位表边界正确', () => {
    expect(phaseMeta(0.0).emoji).toBe('🌑');
    expect(phaseMeta(0.99).name).toBe('新月');
    expect(phaseMeta(0.1).name).toBe('娥眉月');
    expect(phaseMeta(0.25).emoji).toBe('🌓');
    expect(phaseMeta(0.5).name).toBe('满月');
    expect(phaseMeta(0.75).emoji).toBe('🌗');
  });

  it('moonPhaseInfo 返回结构完整', () => {
    const m = moonPhaseInfo(new Date('2026-08-25T12:00:00Z'));
    expect(m).toHaveProperty('fraction');
    expect(m).toHaveProperty('phaseName');
    expect(m).toHaveProperty('emoji');
    expect(m.fraction).toBeGreaterThanOrEqual(0);
    expect(m.fraction).toBeLessThanOrEqual(1);
  });
});
