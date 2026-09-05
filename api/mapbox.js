// api/mapbox.js
// 📌 Mapbox API - 地理特征与交通流量
// - 免费额度：100,000次/月
// - 15分钟缓存（交通流量实时变化）
// - 用于判断：地点特征、交通流量、涂鸦墙等

import { withRateLimit } from './_lib/rateLimiter.js';

// 🔎 将 Mapbox geocoding 特征列表压平为前端友好的候选数组（最多 5 条）
// 注意：Mapbox center 顺序为 [lon, lat]，此处翻转为前端惯用的 lat/lon
export function compactGeocodeResults(raw) {
    if (!raw || !Array.isArray(raw.features)) return [];
    return raw.features.slice(0, 5)
        .map(f => ({
            name: f?.text || '',
            address: f?.place_name || '',
            lat: Number.isFinite(f?.center?.[1]) ? f.center[1] : null,
            lon: Number.isFinite(f?.center?.[0]) ? f.center[0] : null
        }))
        .filter(r => r.name && r.lat !== null && r.lon !== null);
}

// 🛡️ 应用速率限制：每个IP每分钟最多10次请求（rateLimiter.js 已改为 Redis 分布式限流）
export default withRateLimit('mapbox')(async function handler(req, res) {
    // 允许跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 📌 Edge Cache 配置：15分钟缓存（交通数据实时变化）
    const isProduction = process.env.VERCEL_ENV === 'production';
    if (isProduction) {
        res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    } else {
        res.setHeader('Cache-Control', 'no-cache');
    }

    const { lat, lon, type } = req.query;

    // 🔧 根据环境自动选择 Token
    // 开发环境使用 DEV Token（允许 localhost）
    // 生产环境使用 PROD Token（仅允许 Vercel 域名）
    // 兜底链：环境值可能残留粘贴时的空白字符（trim 兜底），
    // 均缺失时退回前端公开 token（VITE_ 变量同样注入 serverless 运行时）
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.VERCEL_ENV;
    const MAPBOX_TOKEN = [
        isDevelopment ? process.env.MAPBOX_ACCESS_TOKEN_DEV : process.env.MAPBOX_ACCESS_TOKEN_PROD,
        process.env.MAPBOX_ACCESS_TOKEN_DEV,
        process.env.MAPBOX_ACCESS_TOKEN_PROD,
        process.env.VITE_MAPBOX_ACCESS_TOKEN,
    ].map(v => (typeof v === 'string' ? v.trim() : '')).find(Boolean);

    if (!MAPBOX_TOKEN) {
        return res.status(500).json({ error: `未配置 Mapbox Access Token (环境: ${isDevelopment ? 'development' : 'production'})` });
    }

    // 🔎 顺向地理编码：地点关键词 → 坐标候选（供空间跃迁引擎使用）
    if (type === 'search') {
        const q = (req.query.q || '').trim();
        if (!q) return res.status(400).json({ error: '缺少搜索关键词' });
        if (q.length > 80) return res.status(400).json({ error: '搜索关键词过长' });

        const geoRes = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=zh`
        );
        if (!geoRes.ok) {
            // 只记录指纹（前缀/长度/尾4位），绝不输出完整 token
            const fp = `${MAPBOX_TOKEN.slice(0, 3)}…len=${MAPBOX_TOKEN.length}…${MAPBOX_TOKEN.slice(-4)}`;
            console.error(`❌ Mapbox 顺向地理编码上游异常: HTTP ${geoRes.status} token指纹[${fp}] 环境[${isDevelopment ? 'dev' : 'prod'}]`);
            return res.status(502).json({ error: '地理编码服务暂不可用' });
        }
        const raw = await geoRes.json();
        return res.status(200).json({ results: compactGeocodeResults(raw) });
    }

    if (!lat || !lon) return res.status(400).json({ error: "缺少经纬度参数" });

    try {
        let result = {};

        // 根据类型调用不同的 Mapbox API
        if (type === 'geocoding' || !type) {
            // 逆向地理编码：获取地点特征
            const geocodingRes = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,place,neighborhood`
            );

            if (geocodingRes.ok) {
                const geocodingData = await geocodingRes.json();
                result.features = geocodingData.features?.map(f => ({
                    type: f.place_type?.[0] || 'unknown',
                    text: f.text,
                    categories: f.properties?.category || 'unknown'
                })) || [];
            }
        }

        if (type === 'traffic') {
            // 获取交通流量数据（需要 Mapbox Traffic API）
            // 注意：这可能需要启用 Mapbox Traffic 扩展
            // 这里使用简化版本，基于道路类型推断
            const geocodingRes = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}`
            );

            if (geocodingRes.ok) {
                const data = await geocodingRes.json();

                // 简化推断：基于POI密度和道路类型
                const isUrbanArea = data.features?.some(f =>
                    f.place_type?.includes('place') ||
                    f.place_type?.includes('poi')
                );

                result.traffic = {
                    isUrbanArea,
                    level: isUrbanArea ? 'moderate' : 'low', // 简化版本
                    // 真实交通数据需要 Mapbox Traffic 扩展
                };
            }
        }

        // 📊 性能监控
        const payloadSize = new Blob([JSON.stringify(result)]).size;
        console.log(`📊 [${new Date().toISOString()}] Mapbox API Payload: ${payloadSize} 字节 (lat=${lat}, lon=${lon}, type=${type})`);

        res.status(200).json(result);

    } catch (error) {
        console.error("❌ Mapbox API 调用失败:", error);
        res.status(500).json({ error: "Mapbox 数据获取失败", features: [], traffic: { level: 'unknown' } });
    }
}); // 结束 withRateLimit 包装
