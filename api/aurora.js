// api/aurora.js
export default async function handler(req, res) {
    // 1. 允许跨域 (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat or lon' });
        }

        const targetLat = parseFloat(lat);
        const targetLon = parseFloat(lon);

        // 2. NOAA 数据只预测高纬度极光，为了节省性能，纬度绝对值小于 40 度的直接返回 0
        if (Math.abs(targetLat) < 40) {
            return res.status(200).json({ probability: 0, forecastTime: new Date().toISOString() });
        }

        // 3. 核心：坐标系跃迁转换 (-180~180 转 0~360)
        let noaaLon = targetLon < 0 ? targetLon + 360 : targetLon;

        // 4. 拉取 NOAA 官方 OVATION Prime 数据
        const response = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
        if (!response.ok) throw new Error('NOAA API 响应异常');
        
        const rawData = await response.json();
        
        // 5. 寻找最近的网格点 (NOAA 数据是按 1 度网格划分的)
        // 数据格式: "coordinates": [ [Lon, Lat, Probability], ... ]
        const roundedLon = Math.round(noaaLon);
        const roundedLat = Math.round(targetLat);

        let auroraProbability = 0;
        
        // 极速遍历寻找匹配点
        for (const point of rawData.coordinates) {
            if (point[0] === roundedLon && point[1] === roundedLat) {
                auroraProbability = point[2];
                break;
            }
        }

        // 6. 开启 Vercel 边缘缓存 (缓存 15 分钟，降低 NOAA 服务器压力)
        res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

        return res.status(200).json({
            probability: auroraProbability,
            forecastTime: rawData["Forecast Time"] || new Date().toISOString()
        });

    } catch (error) {
        console.error('极光雷达探测失败:', error);
        // 降级处理，不影响主链路
        return res.status(200).json({ probability: 0, error: 'NOAA service unavailable' });
    }
}