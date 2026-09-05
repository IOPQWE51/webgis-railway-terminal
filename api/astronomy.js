// api/astronomy.js
// 🔭 天体位置查询（AstronomyAPI，付费凭证）
//
// 2026-08 审查加固：
// - 挂 strict 限流（10 次/小时/IP）：付费配额不能被脚本白嫖刷爆；
// - 坐标走 parseCoords 数值校验；日期强制 YYYY-MM-DD 格式，
//   防止把任意字符拼进上游 URL。

import { withRateLimit } from './_lib/rateLimiter.js';
import { parseCoords } from './_lib/validation.js';

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

    try {
        const authString = Buffer.from(`${appId}:${appSecret}`).toString('base64');
        const apiUrl = `https://api.astronomyapi.com/api/v2/bodies/positions?latitude=${lat}&longitude=${lon}&elevation=0&from_date=${targetDate}&to_date=${targetDate}&time=12:00:00`;

        const astroRes = await fetch(apiUrl, {
            headers: { Authorization: `Basic ${authString}` },
        });

        if (!astroRes.ok) {
            console.error(`AstronomyAPI 上游错误: ${astroRes.status}`);
            return res.status(502).json({ error: '上游天文数据服务异常' });
        }

        const astroData = await astroRes.json();
        res.status(200).json(astroData);
    } catch (error) {
        console.error('天文台连接失败:', error.message);
        res.status(500).json({ error: '云端天文台连接失败' });
    }
}

// 🛡️ 严格限流：付费 API 配额保护（10 次/小时/IP）
export default withRateLimit('strict')(handleAstronomy);
