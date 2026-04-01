// api/elevation.js
// 📌 Open-Meteo Elevation API - 海拔数据获取
// - 无需注册，完全免费
// - 7天缓存（地形数据几乎不变）
// - 用于判断：山地、高原、平原等地形特征

export default async function handler(req, res) {
    // 允许跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 📌 Edge Cache 配置：7天缓存（地形数据永久不变）
    const isProduction = process.env.VERCEL_ENV === 'production';
    if (isProduction) {
        res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=1209600');
    } else {
        res.setHeader('Cache-Control', 'no-cache');
    }

    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "缺少经纬度参数" });

    try {
        // Open-Meteo Elevation API（无需API Key）
        const response = await fetch(
            `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
        );

        if (!response.ok) {
            throw new Error(`Open-Meteo API 返回错误: ${response.status}`);
        }

        const data = await response.json();

        // 📌 策略：只返回核心字段
        const trimmedData = {
            elevation: data.elevation ?? 0, // 海拔（米）
            // 如果有需要，可以添加更多字段
        };

        // 📊 性能监控
        const payloadSize = new Blob([JSON.stringify(trimmedData)]).size;
        console.log(`📊 [${new Date().toISOString()}] Elevation API Payload: ${payloadSize} 字节 (lat=${lat}, lon=${lon})`);

        res.status(200).json(trimmedData);

    } catch (error) {
        console.error("❌ 海拔数据获取失败:", error);
        res.status(500).json({ error: "海拔数据获取失败", elevation: 0 });
    }
}
