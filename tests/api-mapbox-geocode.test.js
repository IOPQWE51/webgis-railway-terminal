import { describe, it, expect } from 'vitest';
import { compactGeocodeResults } from '../api/mapbox.js';

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
