// src/utils/dataGateway.js
import SunCalc from 'suncalc';

// 智能环境识别：Vite 提供的内置变量
const isLocalDev = import.meta.env.DEV; 
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

export const getGlobalSeason = (lat, month) => {
    const isNorthern = lat >= 0;
    const isTropics = Math.abs(lat) <= 23.5;
    if (isTropics) return (month >= 5 && month <= 10) ? (isNorthern ? 'wet' : 'dry') : (isNorthern ? 'dry' : 'wet');
    if (month >= 3 && month <= 5) return isNorthern ? 'spring' : 'autumn';
    if (month >= 6 && month <= 8) return isNorthern ? 'summer' : 'winter';
    if (month >= 9 && month <= 11) return isNorthern ? 'autumn' : 'spring';
    return isNorthern ? 'winter' : 'summer';
};

export const fetchGlobalEnvironmentData = async (lat, lon) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    const times = SunCalc.getTimes(now, lat, lon);
    const moonPhase = SunCalc.getMoonIllumination(now).fraction; 
    const season = getGlobalSeason(lat, currentMonth);

    let weatherData = null;
    let terrainTags = [];

    try {
        // 🌟 双引擎架构：根据环境决定去哪拿天气！
        let weatherUrl = '';
        if (isLocalDev) {
            // 本地开发：直接连真实 API，方便调试
            weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
            console.log("🛠️ 本地开发模式：直连 WeatherAPI");
        } else {
            // 线上生产：连到 Vercel 的安全后端，隐藏秘钥
            weatherUrl = `/api/weather?lat=${lat}&lon=${lon}`;
            console.log("☁️ 生产模式：通过 Serverless 后端获取气象");
        }

        const weatherRes = await fetch(weatherUrl);
        if (weatherRes.ok) weatherData = await weatherRes.json();

        // 🛰️ OSM 雷达升级：加入神社、桥梁、瀑布、车站等扫描
        const overpassQuery = `
            [out:json][timeout:5];
            (
              node["natural"~"water|beach|wood|peak"](around:500,${lat},${lon});
              way["natural"~"water|beach|wood"](around:500,${lat},${lon});
              node["waterway"~"waterfall"](around:500,${lat},${lon});
              node["historic"~"yes|temple|shrine|castle"](around:500,${lat},${lon});
              node["amenity"~"place_of_worship"](around:500,${lat},${lon});
              way["man_made"~"bridge|tower"](around:500,${lat},${lon});
              node["railway"~"station"](around:500,${lat},${lon});
            );
            out tags;
        `;
        const osmRes = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery
        });
        
        if (osmRes.ok) {
            const osmData = await osmRes.json();
            if (osmData.elements) {
                osmData.elements.forEach(el => {
                    const t = el.tags;
                    if (t.natural) terrainTags.push(t.natural);
                    if (t.waterway === 'waterfall') terrainTags.push('waterfall');
                    if (t.historic || t.amenity === 'place_of_worship') terrainTags.push('shrine_temple');
                    if (t.man_made === 'bridge') terrainTags.push('bridge');
                    if (t.railway === 'station') terrainTags.push('station');
                });
            }
        }
    } catch (error) {
        console.error("🛰️ 网关数据抓取失败:", error);
    }

    // 去重
    terrainTags = [...new Set(terrainTags)];

    return {
        astronomy: {
            now, times, moonPhase,
            isNight: now < times.dawn || now > times.dusk
        },
        climate: { season },
        weather: weatherData ? {
            // 兼容直接 API 和咱们自己后端的返回格式
            condition: weatherData.current?.condition?.text || weatherData.condition, 
            clouds: weatherData.current?.cloud || weatherData.clouds, 
            visibility: (weatherData.current?.vis_km * 1000) || weatherData.visibility, 
            temp: weatherData.current?.temp_c || weatherData.temp, // 新增温度
            humidity: weatherData.current?.humidity || weatherData.humidity, // 新增湿度
            isRaining: (weatherData.current?.precip_mm > 0) || weatherData.isRaining
        } : null,
        terrain: {
            rawTags: terrainTags, 
            isCoastal: terrainTags.includes('water') || terrainTags.includes('beach'),
            isForest: terrainTags.includes('wood'),
            hasWaterfall: terrainTags.includes('waterfall'),
            hasShrine: terrainTags.includes('shrine_temple'),
            hasBridge: terrainTags.includes('bridge'),
            hasStation: terrainTags.includes('station')
        }
    };
};