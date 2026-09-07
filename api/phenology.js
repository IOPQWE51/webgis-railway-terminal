// api/phenology.js
// 🌸 植物物候 API - 樱花积温 + 红叶冷刺激 + 残花判定

import { parseCoords } from './_lib/validation.js';
import { callProvider } from './_lib/provider.js';

// Open-Meteo 历史归档 provider（免钥；90 天温度序列，本地算积温）
const meteoArchiveProvider = {
  name: 'meteo-archive',
  cache: { ttl: 21600 }, // 窗口按日滚动，6h 足够新鲜
  request: async ({ lat, lon, start, end }) => ({
    url: `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
    headers: {},
  }),
  map: (raw) => raw,
};

export default async function handler(req, res) {
    // 📌 修复 1：加上原生跨域头，彻底解决前端调不通的问题
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const coords = parseCoords(req.query);
    if (!coords) {
        return res.status(400).json({ error: "缺少 lat/lon 参数" });
    }
    const { lat, lon } = coords;

    // 📌 缓存配置 - 7 天边缘缓存
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');

    try {
        const today = new Date();
        const past90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        // 📌 Open-Meteo 历史数据走 provider 三件套（#11）：90 天窗口按日变化 → 缓存 6h
        const meteoResult = await callProvider(meteoArchiveProvider, {
            lat, lon, start: past90Days, end: todayStr,
        });
        if (meteoResult.status !== 200) {
            throw new Error(`Open-Meteo API failed: ${meteoResult.status}`);
        }
        const meteoData = meteoResult.json;

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
        res.status(500).json({ error: "物候数据获取失败" });
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