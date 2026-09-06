import { describe, it, expect } from 'vitest';
import { compactReverseResult, compactNominatimReverse } from '../api/mapbox.js';

// 🌍 逆向地理编码压缩：坐标 → { country, countryCode, region, city }
// 全球路径的数据说明：区域检测器不再依赖手画 bbox，任何坐标都能解析

describe('api/mapbox 逆向地理编码压缩（Mapbox）', () => {
  it('从 feature 列表抽出国家/省/城市', () => {
    const raw = {
      features: [
        { place_type: ['neighborhood'], text: '歌舞伎町', place_name: '歌舞伎町, 新宿区, 東京都' },
        { place_type: ['place'], text: '新宿区' },
        { place_type: ['region'], text: '東京都' },
        { place_type: ['country'], text: '日本', properties: { short_code: 'jp' } }
      ]
    };
    expect(compactReverseResult(raw)).toEqual({
      country: '日本',
      countryCode: 'JP',
      region: '東京都',
      city: '新宿区',
      fullAddress: '歌舞伎町, 新宿区, 東京都',
      provider: 'mapbox'
    });
  });

  it('countryCode 归一化为大写', () => {
    const raw = {
      features: [{ place_type: ['country'], text: 'France', properties: { short_code: 'fr' } }]
    };
    expect(compactReverseResult(raw).countryCode).toBe('FR');
  });

  it('缺国家的特征列表视为不可用，返回 null', () => {
    expect(compactReverseResult({ features: [{ place_type: ['poi'], text: '某公园' }] })).toBeNull();
    expect(compactReverseResult({ features: [] })).toBeNull();
    expect(compactReverseResult(null)).toBeNull();
  });

  it('region/city 缺失时留空字符串不报错', () => {
    const raw = {
      features: [{ place_type: ['country'], text: '冰岛', properties: { short_code: 'IS' } }]
    };
    const out = compactReverseResult(raw);
    expect(out.country).toBe('冰岛');
    expect(out.region).toBe('');
    expect(out.city).toBe('');
  });
});

describe('api/mapbox 逆向地理编码压缩（Nominatim 服务端兜底）', () => {
  it('从 address 对象抽出国家/省州/城市', () => {
    const data = {
      address: { country: 'Thailand', country_code: 'th', state: 'Chiang Mai', city: 'Mueang Chiang Mai' },
      display_name: '清迈古城, 清迈, 泰国'
    };
    expect(compactNominatimReverse(data)).toEqual({
      country: 'Thailand',
      countryCode: 'TH',
      region: 'Chiang Mai',
      city: 'Mueang Chiang Mai',
      fullAddress: '清迈古城, 清迈, 泰国',
      provider: 'nominatim'
    });
  });

  it('城市字段按 city→town→village→county 顺序回退', () => {
    const out = compactNominatimReverse({ address: { country: 'X', country_code: 'x', town: '小镇' } });
    expect(out.city).toBe('小镇');
    const out2 = compactNominatimReverse({ address: { country: 'X', country_code: 'x', county: '某县' } });
    expect(out2.city).toBe('某县');
  });

  it('缺国家时返回 null', () => {
    expect(compactNominatimReverse({ address: {} })).toBeNull();
    expect(compactNominatimReverse(null)).toBeNull();
  });
});
