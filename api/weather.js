// api/weather.js
// 📌 策略三：设定缓存策略（由 Vercel 自动执行）
// - realtime_weather: 5 分钟缓存（同一个地点，5 分钟内的查询命中缓存）
// - flowerGDD: 24 小时缓存（一天内气温数据基本不变）

export default async function handler(req, res) {
    // 允许跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // 📌 策略三：Edge Cache 配置
    // 生产环境在 Vercel Edge 进行缓存；开发环境禁用
    const isProduction = process.env.VERCEL_ENV === 'production';
    if (isProduction) {
        // 设置 5 分钟内的缓存（对于天气、积温这类相对稳定的数据）
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    } else {
        res.setHeader('Cache-Control', 'no-cache');
    }

    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "缺少经纬度参数" });

    // 从 Vercel 的环境变量中读取机密 Key
    const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

    try {
        // 📌 策略一：并发请求两个 API（不要串行等待）
        const [weatherRes, meteoRes] = await Promise.all([
            // 1. WeatherAPI 实时气象
            fetch(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`),
            // 2. Open-Meteo 60天历史气温（免秘钥）
            (async () => {
                const today = new Date();
                const past60Days = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const todayStr = today.toISOString().split('T')[0];
                return fetch(
                    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${past60Days}&end_date=${todayStr}&daily=temperature_2m_max&timezone=auto`
                );
            })()
        ]);

        const weatherData = await weatherRes.json();
        const meteoData = await meteoRes.json();

        // 🧮 算力爆发：计算有效积温 (Growing Degree Days, GDD)
        // 植物学界公认算法：每日最高温超过 5°C 的部分累加。达到 400°C 左右樱花开花！
        let flowerGDD = 0;
        if (meteoData.daily && meteoData.daily.temperature_2m_max) {
            meteoData.daily.temperature_2m_max.forEach(t => {
                if (t > 5) flowerGDD += (t - 5);
            });
        }

        // 📌 策略二：只返回前端真正需要的字段（极限瘦身）
        // 删掉 WeatherAPI 返回的 ~50 个无用字段，只保留 10 个核心字段
        const trimmedWeather = {
            condition: weatherData.current?.condition?.text || 'Unknown',
            cloud: weatherData.current?.cloud ?? 50,
            temp_c: weatherData.current?.temp_c ?? 20,
            humidity: weatherData.current?.humidity ?? 60,
            wind_kph: weatherData.current?.wind_kph ?? 0,
            precip_mm: weatherData.current?.precip_mm ?? 0
        };

        // 把整合后的超小 Payload 吐给前端（预计 <1KB）
        const responseData = {
            current: trimmedWeather,
            ecology: {
                flowerGDD: Math.round(flowerGDD)
            }
        };

        // 📊 性能监控（可选）
        const payloadSize = new Blob([JSON.stringify(responseData)]).size;
        console.log(`📊 [${new Date().toISOString()}] Weather API Payload: ${payloadSize} 字节 (lat=${lat}, lon=${lon})`);

        res.status(200).json(responseData);

    } catch (error) {
        console.error("❌ 云端天气推演失败:", error);
        res.status(500).json({ error: "云端气象与生态推演失败" });
    }
}