// api/astronomy.js
// 🔭 天体位置查询（AstronomyAPI，付费凭证）
//
// 2026-08 审查加固：
// - 挂 strict 限流（10 次/小时/IP）：付费配额不能被脚本白嫖刷爆；
// - 坐标走 parseCoords 数值校验；日期强制 YYYY-MM-DD 格式，
//   防止把任意字符拼进上游 URL。

import { withRateLimit } from './_lib/rateLimiter.js';
import { parseCoords } from './_lib/validation.js';
import { callProvider } from './_lib/provider.js';

// 🔭 AstronomyAPI provider（付费凭证，仅服务端持有）
const astronomyProvider = {
  name: 'astronomy',
  cache: { ttl: 21600 }, // 天体位置按日恒定：6h KV 缓存
  request: async ({ lat, lon, date }) => {
    const authString = Buffer.from(`${process.env.ASTRO_APP_ID}:${process.env.ASTRO_APP_SECRET}`).toString('base64');
    return {
      url: `https://api.astronomyapi.com/api/v2/bodies/positions?latitude=${lat}&longitude=${lon}&elevation=0&from_date=${date}&to_date=${date}&time=12:00:00`,
      headers: { Authorization: `Basic ${authString}` },
    };
  },
  map: (raw) => raw,
};

async function handleAstronomy(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const coords = parseCoords(req.query);
    if (!coords) return res.status(400).json({ error: "缺少合法坐标" });
    const { lat, lon } = coords;

    const date = req.query.date;
    const targetDate =
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? date
            : new Date().toISOString().split('T')[0];

    // AstronomyAPI 凭证（仅服务端持有）
    const appId = process.env.ASTRO_APP_ID;
    const appSecret = process.env.ASTRO_APP_SECRET;
    if (!appId || !appSecret) {
        return res.status(500).json({ error: '服务端未配置 ASTRO 凭证' });
    }

    // #11 provider 三件套：天体位置按坐标+日期缓存 6h（付费配额保护）
    // fallback 空：调用方（详情卡）已有多层兜底，502 语义保持
    const result = await callProvider(astronomyProvider, { lat, lon, date: targetDate });
    return res.status(result.status).json(result.json);
}

// 🛡️ 严格限流：付费 API 配额保护（10 次/小时/IP）
export default withRateLimit('strict')(handleAstronomy);
