// src/utils/dataGateway.js
import SunCalc from 'suncalc';

const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

// 🌍 全球季节算法 (纯地理数学推算)
export const getGlobalSeason = (lat, month) => {
    const isNorthern = lat >= 0;
    const isTropics = Math.abs(lat) <= 23.5;
    if (isTropics) return (month >= 5 && month <= 10) ? (isNorthern ? 'wet' : 'dry') : (isNorthern ? 'dry' : 'wet');
    if (month >= 3 && month <= 5) return isNorthern ? 'spring' : 'autumn';
    if (month >= 6 && month <= 8) return isNorthern ? 'summer' : 'winter';
    if (month >= 9 && month <= 11) return isNorthern ? 'autumn' : 'spring';
    return isNorthern ? 'winter' : 'summer';
};

// 🛰️ 核心网关：多维数据融合抓取 (Local 版)
export const fetchGlobalEnvironmentData = async (lat, lon) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    // 1. 本地极速推演 (SunCalc + 季节模型)
    const times = SunCalc.getTimes(now, lat, lon);
    const moonPhase = SunCalc.getMoonIllumination(now).fraction; 
    const season = getGlobalSeason(lat, currentMonth);

    let weatherData = null;
    let terrainTags = [];

    try {
        // [请求 A] 获取 WeatherAPI 数据
        if (WEATHER_API_KEY) {
            const weatherRes = await fetch(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`);
            if (weatherRes.ok) weatherData = await weatherRes.json();
        }

        // [请求 B] OSM Overpass API 地形雷达
        const overpassQuery = `
            [out:json][timeout:5];
            (
              node["natural"~"water|beach|wood|peak"](around:500,${lat},${lon});
              way["natural"~"water|beach|wood"](around:500,${lat},${lon});
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
                    if (el.tags.natural && !terrainTags.includes(el.tags.natural)) {
                        terrainTags.push(el.tags.natural);
                    }
                });
            }
        }
    } catch (error) {
        console.error("🛰️ 网关数据抓取失败:", error);
    }

    return {
        astronomy: {
            now, times, moonPhase,
            isNight: now < times.dawn || now > times.dusk
        },
        climate: { season },
        weather: weatherData ? {
            condition: weatherData.current.condition.text, 
            clouds: weatherData.current.cloud, 
            visibility: weatherData.current.vis_km * 1000, 
            humidity: weatherData.current.humidity,
            wind: weatherData.current.wind_kph / 3.6, 
            isRaining: weatherData.current.precip_mm > 0
        } : null,
        terrain: {
            rawTags: terrainTags, 
            isCoastal: terrainTags.includes('water') || terrainTags.includes('beach'),
            isForest: terrainTags.includes('wood')
        }
    };
};