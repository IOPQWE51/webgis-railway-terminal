import { describe, it, expect, vi, afterEach } from 'vitest';
import handler, { compactGeocodeResults, extractVercelIpGeo } from '../api/mapbox.js';
import { getPositionByIP } from '../src/utils/performanceHelpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('type=ip 走独立 general(60/min) 限流桶并强制 private, no-store', async () => {
    const headers = {};
    let statusCode = 0;
    let body = null;
    const req = {
      query: { type: 'ip' },
      headers: {
        'x-forwarded-for': '203.0.113.9',
        'x-vercel-ip-latitude': '51.5074',
        'x-vercel-ip-longitude': '-0.1278',
        'x-vercel-ip-city': 'London',
        'x-vercel-ip-country': 'gb',
      },
    };
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      status: (code) => { statusCode = code; return res; },
      json: (data) => { body = data; return res; },
    };

    await handler(req, res);
    expect(statusCode).toBe(200);
    expect(headers['Cache-Control']).toBe('private, no-store');
    expect(headers['X-RateLimit-Limit']).toBe('60');
    expect(body).toMatchObject({ ok: true, lat: 51.5074, lon: -0.1278, city: 'London', country: 'GB', source: 'vercel-ip' });
  });
});

describe('getPositionByIP 优先自有边缘头 + ipapi.co 兜底链', () => {
  it('/api/mapbox?type=ip 成功时直接返回 vercel-ip，不打外部 ipapi.co', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, lat: 31.23, lon: 121.47, city: 'Shanghai', country: 'CN', region: 'SH', timezone: 'Asia/Shanghai' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const pos = await getPositionByIP();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/mapbox?type=ip');
    expect(pos).toMatchObject({ latitude: 31.23, longitude: 121.47, city: 'Shanghai', method: 'vercel-ip' });
  });

  it('/api/mapbox?type=ip 返回 429 或 ok:false 时静默降级到 ipapi.co', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'Too many requests' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ latitude: 48.8566, longitude: 2.3522, city: 'Paris', country_name: 'France', region: 'IDF', timezone: 'Europe/Paris' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pos = await getPositionByIP();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://ipapi.co/json/');
    expect(pos).toMatchObject({ latitude: 48.8566, longitude: 2.3522, city: 'Paris', country: 'France', method: 'ip' });
  });

  it('两条 IP 链路均不可用时抛出明确错误', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, source: 'none' }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPositionByIP()).rejects.toThrow(/IP 定位失败/);
  });
});
