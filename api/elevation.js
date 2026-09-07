// api/elevation.js
// 📌 Open-Meteo Elevation API - 海拔数据获取
// - 无需注册，完全免费；地形数据几乎不变 → KV 7 天缓存
// - 用于判断：山地、高原、平原等地形特征
// #11 收编 provider 三件套；降级保持原语义：500 + elevation 0（调用方容错已有依赖）

import { withRateLimit } from './_lib/rateLimiter.js';
import { callProvider } from './_lib/provider.js';
import { parseCoords } from './_lib/validation.js';

const elevationProvider = {
  name: 'elevation',
  cache: { ttl: 604800 }, // 7 天（地形数据永久不变）
  request: async ({ lat, lon }) => ({
    url: `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
    headers: {},
  }),
  // 只返回核心字段（上游多字段全裁掉）
  map: (raw) => ({ elevation: raw?.elevation ?? 0 }),
  // 降级语义与原实现一致：500 + 默认海拔 0
  fallback: () => ({ status: 500, json: { error: '海拔数据获取失败', elevation: 0 } }),
};

async function handleElevation(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const isProduction = process.env.VERCEL_ENV === 'production';
    if (isProduction) {
        res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=1209600');
    } else {
        res.setHeader('Cache-Control', 'no-cache');
    }

    const coords = parseCoords(req.query);
    if (!coords) return res.status(400).json({ error: "缺少经纬度参数" });

    const result = await callProvider(elevationProvider, coords);
    return res.status(result.status).json(result.json);
}

// 🛡️ 限流：上游免费但也不该被脚本白嫖刷量
export default withRateLimit('general')(handleElevation);
