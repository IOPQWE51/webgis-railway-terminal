// api/phenology.js
// 🌸 植物物候 API - 樱花积温 + 红叶冷刺激 + 残花判定

export default async function handler(req, res) {
    // 📌 修复 1：加上原生跨域头，彻底解决前端调不通的问题
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
        return res.status(400).json({ error: "缺少 lat/lon 参数" });
    }

    // 📌 缓存配置 - 7 天边缘缓存
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');

    try {
        const today = new Date();
        const past90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        // 📌 Open-Meteo API - 参数拼装
        const meteoUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
        meteoUrl.searchParams.append('latitude', lat);
        meteoUrl.searchParams.append('longitude', lon);
        meteoUrl.searchParams.append('start_date', past90Days);
        meteoUrl.searchParams.append('end_date', todayStr);
        meteoUrl.searchParams.append('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
        meteoUrl.searchParams.append('timezone', 'auto');

        const meteoRes = await fetch(meteoUrl.toString());
        
        if (!meteoRes.ok) {
            throw new Error(`Open-Meteo API failed: ${meteoRes.status}`);
        }

        const meteoData = await meteoRes.json();

        // =========== 🌸 第一步：樱花积温计算 (GDD) ===========
        let sakuraGDD = 0;
        let sakuraBloomDay = null;
        const GDD_THRESHOLD = 400;  

        if (meteoData.daily && meteoData.daily.temperature_2m_max) {
            meteoData.daily.temperature_2m_max.forEach((temp, idx) => {
                // 修复 2：拦截 null 值陷阱
                if (temp !== null && temp > 5) {
                    sakuraGDD += (temp - 5);
                    if (sakuraGDD >= GDD_THRESHOLD && !sakuraBloomDay) {
                        const bloomDate = new Date(today.getTime() - (meteoData.daily.temperature_2m_max.length - idx - 1) * 24 * 60 * 60 * 1000);
                        sakuraBloomDay = bloomDate.toISOString().split('T')[0];
                    }
                }
            });
        }

        let sakuraBloomStage = 0;
        if (sakuraGDD < 400) sakuraBloomStage = 0; 
        else if (sakuraGDD < 600) sakuraBloomStage = Math.round((sakuraGDD - 400) / 200 * 100); 
        else if (sakuraGDD < 800) sakuraBloomStage = 100; 
        else sakuraBloomStage = Math.max(0, 100 - (sakuraGDD - 800) / 100); 

        // =========== 🍁 第二步：红叶冷刺激判定 ===========
        let mapleBloomStage = 0;
        let coldStressConsecutiveDays = 0;
        let hasTriggeredMaple = false; // 修复 3：永久记录是否曾经触发过变红
        const COLD_THRESHOLD = 8;  
        const CONSECUTIVE_DAYS_NEEDED = 3;  

        if (meteoData.daily && meteoData.daily.temperature_2m_min) {
            const recentMinTemps = meteoData.daily.temperature_2m_min.slice(-30); 
            
            for (let i = 0; i < recentMinTemps.length; i++) {
                const temp = recentMinTemps[i];
                // 修复 2：拦截 null < 8 的致命陷阱
                if (temp !== null && temp < COLD_THRESHOLD) {
                    coldStressConsecutiveDays++;
                } else {
                    coldStressConsecutiveDays = 0; 
                }

                if (coldStressConsecutiveDays >= CONSECUTIVE_DAYS_NEEDED) {
                    hasTriggeredMaple = true; // 一旦变红，不可逆转！
                    mapleBloomStage = Math.min(100, coldStressConsecutiveDays * 10);
                }
            }
        }

        // =========== 🌧️ 第三步：残花/落叶判定 ===========
        let flowerCondition = 'pristine'; 
        let precipitationLast48h = 0;

        if (meteoData.daily && meteoData.daily.precipitation_sum) {
            const recentPrecip = meteoData.daily.precipitation_sum.slice(-2); 
            // 修复 2：防止 null 参与数学计算
            precipitationLast48h = recentPrecip.reduce((a, b) => a + (b || 0), 0);
        }

        if (sakuraBloomStage > 80) { 
            if (precipitationLast48h > 20) flowerCondition = 'heavy_rain'; 
            else if (precipitationLast48h > 5) flowerCondition = 'light_rain'; 
            else flowerCondition = 'pristine'; 
        } else if (sakuraBloomStage > 20) { 
            if (precipitationLast48h > 30) flowerCondition = 'fallen'; 
        }

        // =========== 📊 第四步：返回给前端 ===========
        res.status(200).json({
            sakura: {
                gdd: Math.round(sakuraGDD),                          
                bloom_day: sakuraBloomDay,                          
                bloom_stage: sakuraBloomStage,                      
                bloom_stage_name: getBloomStageName(sakuraBloomStage),
                condition: flowerCondition                          
            },
            maple: {
                cold_stress_days: coldStressConsecutiveDays,        
                leaf_change_stage: mapleBloomStage,                 
                leaf_change_ready: hasTriggeredMaple // 使用永久锁定状态
            },
            weather_impact: {
                precipitation_48h: Math.round(precipitationLast48h * 10) / 10,  
                flower_impact: flowerCondition
            },
            metadata: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon),
                data_date: todayStr
            }
        });

    } catch (error) {
        console.error('❌ 物候数据获取失败:', error);
        res.status(500).json({ error: "物候数据获取失败", message: error.message });
    }
}

function getBloomStageName(percentage) {
    if (percentage < 10) return "未开";
    if (percentage < 30) return "初开";
    if (percentage < 50) return "盛开中";
    if (percentage < 70) return "满开";
    if (percentage < 90) return "满开";
    if (percentage < 100) return "开始落花";
    return "已落花";
}