// api/aurora.js
// 🌌 极光概率查询（NOAA SWPC OVATION 公开数据）
// #11 收编 provider 三件套。特殊形态：所有坐标共享同一份 NOAA 全网格数据 →
// KV 缓存挂在数据源本身（单键 'ovation'，10min TTL），坐标匹配在 map 里做，
// 任意坐标的第二波请求全走缓存不打 NOAA。降级 = probability 0（原语义）。

import { callProvider } from './_lib/provider.js';

const noaaProvider = {
  name: 'aurora',
  cache: { ttl: 600 }, // OVATION 约 10 分钟发布一轮，对齐刷新节奏
  request: async () => ({
    url: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
    headers: {},
  }),
  // map：全网格数据按查询坐标就近取点（1 度网格），只回传该点概率
  map: (raw, { lat, lon }) => {
    const noaaLon = lon < 0 ? lon + 360 : lon; // NOAA 经度系 0~360
    const roundedLon = Math.round(noaaLon);
    const roundedLat = Math.round(lat);
    let probability = 0;
    const coordinates = Array.isArray(raw && raw.coordinates) ? raw.coordinates : [];
    for (const point of coordinates) {
      if (point[0] === roundedLon && point[1] === roundedLat) {
        probability = point[2];
        break;
      }
    }
    return {
      probability,
      forecastTime: (raw && raw['Forecast Time']) || new Date().toISOString(),
    };
  },
  // NOAA 挂了：概率归零不阻断主链路（ruleMatcher 极光规则自然不命中）
  fallback: () => ({ status: 200, json: { probability: 0, error: 'NOAA service unavailable' } }),
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { lat, lon } = req.query;
    const targetLat = parseFloat(lat);
    const targetLon = parseFloat(lon);
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLon)) {
        return res.status(400).json({ error: 'Missing lat or lon' });
    }

    // NOAA 只预测高纬极光：|lat| < 40 直接归零，不打上游
    if (Math.abs(targetLat) < 40) {
        res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
        return res.status(200).json({ probability: 0, forecastTime: new Date().toISOString() });
    }

    const result = await callProvider(noaaProvider, { lat: targetLat, lon: targetLon });
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(result.status).json(result.json);
}
