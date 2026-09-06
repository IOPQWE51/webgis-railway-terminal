import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectRegion, detectRegionOnline, UNKNOWN_REGION } from '../src/utils/regionDetector';
import * as geocode from '../src/utils/geocode';

// 🌍 区域检测双范式测试：
// - detectRegion：bbox 快路径（离线秒判，仅覆盖高频站；沈阳曾被误判为日本的回归用例）
// - detectRegionOnline：服务端逆编码全球路径（主路径，任何坐标都能解析）

describe('bbox 快路径（离线秒判，仅高频站）', () => {
  it('东京 → 日本/关东', () => {
    const r = detectRegion(35.6812, 139.7671);
    expect(r.countryName).toBe('日本');
    expect(r.regionName).toBe('关东');
    expect(r.source).toBe('bbox');
  });

  it('沈阳不再被误判为日本（回归：旧 bbox 东经 122-135 与中国框重叠）', () => {
    const r = detectRegion(41.8, 123.4);
    expect(r.countryName).toBe('中国');
  });

  it('哈尔滨 → 中国（东经 126 附近，旧 bug 区）', () => {
    const r = detectRegion(45.8, 126.5);
    expect(r.countryName).toBe('中国');
  });

  it('全球盲区坐标（如清迈）→ Unknown 占位而非报错', () => {
    const r = detectRegion(18.79, 98.98);
    expect(r.countryName).toBe('未知地区');
    expect(r.source).toBe('unknown');
  });

  it('快路径结果带 resolved:false（提示调用方主路径未确认）', () => {
    expect(detectRegion(35.6812, 139.7671).resolved).toBe(false);
  });
});

describe('服务端逆编码全球路径（主路径）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('清迈：bbox 盲区 → 逆编码给出泰国', async () => {
    vi.spyOn(geocode, 'reverseGeocode').mockResolvedValue({
      country: 'Thailand', countryCode: 'TH', region: 'Chiang Mai', city: 'Mueang Chiang Mai', fullAddress: '清迈, 泰国'
    });
    const r = await detectRegionOnline(18.79, 98.98);
    expect(r.countryName).toBe('Thailand');
    expect(r.countryCode).toBe('TH');
    expect(r.regionName).toBe('Chiang Mai');
    expect(r.city).toBe('Mueang Chiang Mai');
    expect(r.resolved).toBe(true);
    expect(r.source).toBe('reverse');
  });

  it('沈阳：bbox 已正确判定，仍调主路径确认（bbox 只是缓存性质的快路径）', async () => {
    const spy = vi.spyOn(geocode, 'reverseGeocode').mockResolvedValue({
      country: '中国', countryCode: 'CN', region: '辽宁省', city: '沈阳市'
    });
    const r = await detectRegionOnline(41.8, 123.4);
    expect(r.countryName).toBe('中国');
    expect(r.source).toBe('reverse');
    expect(spy).toHaveBeenCalled();
  });

  it('逆编码失败时回退 bbox 快路径结果', async () => {
    vi.spyOn(geocode, 'reverseGeocode').mockResolvedValue(null);
    const r = await detectRegionOnline(35.6812, 139.7671);
    expect(r.countryName).toBe('日本');
    expect(r.resolved).toBe(false);
    expect(r.source).toBe('bbox');
  });

  it('盲区 + 逆编码也失败 → Unknown 占位（UNKNOWN_REGION 形状稳定）', async () => {
    vi.spyOn(geocode, 'reverseGeocode').mockResolvedValue(null);
    const r = await detectRegionOnline(18.79, 98.98);
    expect(r).toEqual(UNKNOWN_REGION());
  });
});
