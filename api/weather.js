// api/weather.js
export default async function handler(req, res) {
    // 允许跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "缺少经纬度参数" });

    // 从 Vercel 的环境变量中读取机密 Key
    const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

    try {
        // 1. 获取 WeatherAPI 实时气象 (能见度、沙尘、起雾等)
        const weatherRes = await fetch(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`);
        const weatherData = await weatherRes.json();

        // 2. 🌸 独家黑科技：Open-Meteo 60天历史气温拉取 (免秘钥)
        const today = new Date();
        const past60Days = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        // 请求过去 60 天的每日最高气温
        const meteoUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${past60Days}&end_date=${todayStr}&daily=temperature_2m_max&timezone=auto`;
        const meteoRes = await fetch(meteoUrl);
        const meteoData = await meteoRes.json();

        // 🧮 算力爆发：计算有效积温 (Growing Degree Days, GDD)
        // 植物学界公认算法：每日最高温超过 5°C 的部分累加。达到 400°C 左右樱花开花！
        let flowerGDD = 0;
        if (meteoData.daily && meteoData.daily.temperature_2m_max) {
            meteoData.daily.temperature_2m_max.forEach(t => {
                if (t > 5) flowerGDD += (t - 5);
            });
        }

        // 把整合后的神仙数据吐给前端
        res.status(200).json({
            current: weatherData.current,
            ecology: {
                flowerGDD: Math.round(flowerGDD) // 你的前端拿到这个值，就能判断花开了没！
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "云端气象与生态推演失败" });
    }
}