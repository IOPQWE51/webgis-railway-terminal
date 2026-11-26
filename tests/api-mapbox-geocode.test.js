import { describe, it, expect } from 'vitest';
import { compactGeocodeResults, extractVercelIpGeo } from '../api/mapbox.js';

const feature = (text, place_name, lon, lat) => ({ text, place_name, center: [lon, lat] });

describe('api/mapbox 顺向地理编码结果压缩', () => {
  it('压平 Mapbox 特征并翻转 center 的 lon,lat 顺序', () => {
    const out = compactGeocodeResults({
      features: [feature('東京駅', '東京駅, 丸の内一丁目, 千代田区, 東京都, 日本', 139.7671, 35.6812)]
    });
    expect(out).toEqual([
      { name: '東京駅', address: '東京駅, 丸の内一丁目, 千代田区, 東京都, 日本', lat: 35.6812, lon: 139.7671 }
    ]);
  });

  it('最多返回 5 条候选', () => {
    const features = Array.from({ length: 9 }, (_, i) => feature(`p${i}`, `p${i}`, i, i));
    expect(compactGeocodeResults({ features })).toHaveLength(5);
  });

  it('丢弃无名称或坐标非法的特征（含 NaN 与缺 center）', () => {
    const out = compactGeocodeResults({
      features: [
        feature('', '无名称', 1, 2),
        feature('无坐标', '无坐标', undefined, 3),
        feature('NaN', 'NaN', Number.NaN, Number.NaN),
        feature('无center', '无center'),
        feature('ok', 'ok', 139.7, 35.6)
      ]
    });
    expect(out).toEqual([{ name: 'ok', address: 'ok', lat: 35.6, lon: 139.7 }]);
  });

  it('非正常入参安全返回空数组', () => {
    expect(compactGeocodeResults(null)).toEqual([]);
    expect(compactGeocodeResults(undefined)).toEqual([]);
    expect(compactGeocodeResults({})).toEqual([]);
    expect(compactGeocodeResults({ features: 'nope' })).toEqual([]);
  });
});

describe('api/mapbox Vercel IP 地理头解析', () => {
  it('正常提取并解码 URL 编码的城市名与时区', () => {
    const geo = extractVercelIpGeo({
      'x-vercel-ip-latitude': '31.2304',
      'x-vercel-ip-longitude': '121.4737',
      'x-vercel-ip-city': 'Shanghai%20City',
      'x-vercel-ip-country': 'cn',
      'x-vercel-ip-country-region': 'SH',
      'x-vercel-ip-timezone': 'Asia%2FShanghai',
    });
    expect(geo).toEqual({
      lat: 31.2304,
      lon: 121.4737,
      city: 'Shanghai City',
      region: 'SH',
      country: 'CN',
      timezone: 'Asia/Shanghai',
      source: 'vercel-ip',
    });
  });

  it('缺失或越界坐标返回 null', () => {
    expect(extractVercelIpGeo({})).toBeNull();
    expect(extractVercelIpGeo({ 'x-vercel-ip-latitude': '95', 'x-vercel-ip-longitude': '10' })).toBeNull();
    expect(extractVercelIpGeo({ 'x-vercel-ip-latitude': 'abc', 'x-vercel-ip-longitude': '10' })).toBeNull();
  });
});
