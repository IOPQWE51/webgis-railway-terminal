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

    // 在 return 之前，加一行算太阳高度角的黑科技 (单位：度)
    const sunPos = SunCalc.getPosition(now, lat, lon);
    const solarAltitude = sunPos.altitude * (180 / Math.PI); 

    // 为了兼容你的海量规则，把地形转化为 poiTypes 数组
    const poiTypes = [...terrainTags]; // 继承基础地形
    if (terrainTags.includes('water') || terrainTags.includes('beach')) poiTypes.push('coast', 'beach');
    if (terrainTags.includes('wood')) poiTypes.push('forest');
    if (terrainTags.includes('historic') || terrainTags.includes('place_of_worship')) poiTypes.push('shrine', 'temple', 'historical_building');
    if (terrainTags.includes('bridge')) poiTypes.push('bridge');
    if (terrainTags.includes('station')) poiTypes.push('station', 'neon_street', 'railway_station'); 
    
    return {
        astronomy: {
            now, times, moonPhase, solarAltitude, // 新增：太阳高度角
            isNight: now < times.dawn || now > times.dusk
        },
        climate: { season },
        ecology: {
            // 新增：接收后端的积温数据（如果后端传了的话）
            flowerGDD: weatherData?.ecology?.flowerGDD || 0 
        },
        weather: weatherData ? {
            condition: weatherData.current?.condition?.text || weatherData.condition, 
            clouds: weatherData.current?.cloud || weatherData.clouds, 
            visibility: (weatherData.current?.vis_km * 1000) || weatherData.visibility, 
            temp: weatherData.current?.temp_c || weatherData.temp, 
            humidity: weatherData.current?.humidity || weatherData.humidity, // 新增：湿度
            windKph: weatherData.current?.wind_kph || 0, // 新增：风速 (公里/小时)
            isRaining: (weatherData.current?.precip_mm > 0) || weatherData.isRaining
        } : null,
        terrain: {
            rawTags: terrainTags, 
            poiTypes: poiTypes // 新增：兼容你规则库里的 poiType 数组
        }
    };
};