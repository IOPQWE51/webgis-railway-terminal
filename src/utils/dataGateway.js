// src/utils/dataGateway.js
import SunCalc from 'suncalc';

// 智能环境识别：Vite 提供的内置变量
const isLocalDev = import.meta.env.DEV; 
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

// 📌 策略三：合理缓存机制
// 不同数据的 TTL（生存时间）
const CACHE_TTL = {
    realtime_weather: 5 * 60 * 1000,        // 5 分钟：天气变化快
    daily_solar_track: 24 * 60 * 60 * 1000, // 24 小时：太阳轨迹基本不变
    monthly_gdd: 24 * 60 * 60 * 1000,       // 24 小时：积温一天一更
    const_terrain: 7 * 24 * 60 * 60 * 1000, // 7 天：地形数据几乎不变
    plant_phenology: 7 * 24 * 60 * 60 * 1000 // 🌸 7 天：樱花/枫叶物候数据稳定
};

// 内存缓存存储库
const cacheStore = new Map();

/**
 * 获取缓存的数据（如果有效则返回，否则返回 null）
 */
const getCachedData = (key, maxAge) => {
    const cached = cacheStore.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > maxAge) {
        cacheStore.delete(key);
        return null;
    }
    return cached.data;
};

/**
 * 设置缓存数据
 */
const setCachedData = (key, data) => {
    cacheStore.set(key, { data, timestamp: Date.now() });
};

export const getGlobalSeason = (lat, month) => {
    const isNorthern = lat >= 0;
    const isTropics = Math.abs(lat) <= 23.5;
    if (isTropics) return (month >= 5 && month <= 10) ? (isNorthern ? 'wet' : 'dry') : (isNorthern ? 'dry' : 'wet');
    if (month >= 3 && month <= 5) return isNorthern ? 'spring' : 'autumn';
    if (month >= 6 && month <= 8) return isNorthern ? 'summer' : 'winter';
    if (month >= 9 && month <= 11) return isNorthern ? 'autumn' : 'spring';
    return isNorthern ? 'winter' : 'summer';
};

/**
 * 📌 策略二：数据瘦身 - 只提取 ruleDataConverter 需要的字段
 */
const trimWeatherPayload = (fullData) => {
    return {
        condition: fullData.current?.condition?.text || fullData.condition || 'Unknown',
        cloud: fullData.current?.cloud ?? 50,
        temp_c: fullData.current?.temp_c ?? 20,
        humidity: fullData.current?.humidity ?? 60,
        wind_kph: fullData.current?.wind_kph ?? 0,
        precip_mm: fullData.current?.precip_mm ?? 0,
        // 仅保留必要字段，删除：UV 指数、压力、露点、风向等冗余数据
    };
};

/**
 * 📌 策略二：地形数据瘦身 - 只提取类型标签，不要完整的 OSM 元数据
 */
const trimTerrainPayload = (osmData) => {
    const terrainTags = [];
    
    if (osmData?.elements) {
        osmData.elements.forEach(el => {
            const t = el.tags;
            if (t?.natural) terrainTags.push(t.natural);
            if (t?.waterway === 'waterfall') terrainTags.push('waterfall');
            if (t?.historic || t?.amenity === 'place_of_worship') terrainTags.push('shrine_temple');
            if (t?.man_made === 'bridge') terrainTags.push('bridge');
            if (t?.railway === 'station') terrainTags.push('station');
        });
    }
    
    return [...new Set(terrainTags)]; // 去重
};

/**
 * 📌 策略一：并发请求优化 - 使用 Promise.all 同时发出多个请求
 */
const fetchWeatherConcurrently = async (lat, lon) => {
    let weatherUrl = '';
    if (isLocalDev) {
        weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
        console.log("🛠️ 本地开发模式：直连 WeatherAPI");
    } else {
        weatherUrl = `/api/weather?lat=${lat}&lon=${lon}`;
        console.log("☁️ 生产模式：通过 Serverless 后端获取气象");
    }

    try {
        const res = await fetch(weatherUrl);
        if (res.ok) {
            const fullData = await res.json();
            return trimWeatherPayload(fullData);
        }
    } catch (error) {
        console.warn("⚠️ 天气获取失败:", error);
    }
    return null;
};

const fetchTerrainConcurrently = async (lat, lon) => {
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

    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery
        });
        
        if (res.ok) {
            const osmData = await res.json();
            return trimTerrainPayload(osmData);
        }
    } catch (error) {
        console.warn("⚠️ 地形获取失败:", error);
    }
    return [];
};

/**
 * 物候 API 并行请求 - 获取樱花积温、红叶冷刺激、残花判定
 */
const fetchPhenologyConcurrently = async (lat, lon) => {
    try {
        // 与生产一致走同源 /api（本地请用 `vercel dev`，或为 Vite 配置 proxy）
        const phenologyUrl = `/api/phenology?lat=${lat}&lon=${lon}`;

        const res = await fetch(phenologyUrl);
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (error) {
        console.warn("⚠️ 物候数据获取失败:", error);
    }
    return null;
};

// 🌌 新增：极光数据并发获取函数 (带错误降级)
const fetchAuroraConcurrently = async (lat, lon) => {
    try {
        const res = await fetch(`/api/aurora?lat=${lat}&lon=${lon}`);
        if (!res.ok) return { probability: 0 };
        return await res.json();
    } catch (e) {
        return { probability: 0 }; 
    }
};

export const fetchGlobalEnvironmentData = async (lat, lon) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    // 本地计算（不需要 API）：太阳位置、月相
    const times = SunCalc.getTimes(now, lat, lon);
    const moonPhase = SunCalc.getMoonIllumination(now).fraction; 
    const season = getGlobalSeason(lat, currentMonth);
    const sunPos = SunCalc.getPosition(now, lat, lon);
    const solarAltitude = sunPos.altitude * (180 / Math.PI);

    // 📌 策略三：先查缓存，减少不必要的 API 调用
    const weatherCacheKey = `weather_${Math.round(lat)}_${Math.round(lon)}`;
    const terrainCacheKey = `terrain_${Math.round(lat)}_${Math.round(lon)}`;
    const phenologyCacheKey = `phenology_${Math.round(lat)}_${Math.round(lon)}`;
    const auroraCacheKey = `aurora_${Math.round(lat)}_${Math.round(lon)}`; // 🌌 极光缓存键
    
    let weatherData = getCachedData(weatherCacheKey, CACHE_TTL.realtime_weather);
    let terrainTags = getCachedData(terrainCacheKey, CACHE_TTL.const_terrain);
    let phenologyData = getCachedData(phenologyCacheKey, CACHE_TTL.plant_phenology);
    // 🌌 极光缓存 TTL 建议与天气相同 (15-30分钟)
    let auroraData = getCachedData(auroraCacheKey, CACHE_TTL.realtime_weather); 

    // 📌 策略一：对缺失的数据使用 Promise.all 并发请求
    const fetchPromises = [];
    
    if (!weatherData) {
        fetchPromises.push(
            fetchWeatherConcurrently(lat, lon).then(data => {
                weatherData = data;
                if (data) setCachedData(weatherCacheKey, data);
            })
        );
    }

    if (!terrainTags) {
        fetchPromises.push(
            fetchTerrainConcurrently(lat, lon).then(data => {
                terrainTags = data;
                if (data) setCachedData(terrainCacheKey, data);
            })
        );
    }

    // 🌸 物候 API：樱花积温、红叶冷刺激、残花判定
    if (!phenologyData) {
        fetchPromises.push(
            fetchPhenologyConcurrently(lat, lon).then(data => {
                phenologyData = data;
                if (data) setCachedData(phenologyCacheKey, data);
            })
        );
    }

    // 🌌 极光 API：NOAA OVATION Prime 预警模型
    if (!auroraData) {
        fetchPromises.push(
            fetchAuroraConcurrently(lat, lon).then(data => {
                auroraData = data;
                if (data) setCachedData(auroraCacheKey, data);
            })
        );
    }

    // 等待所有请求完成（如果同时发出）
    if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
    }

    // 安全的默认值
    weatherData = weatherData || {};
    terrainTags = terrainTags || [];
    phenologyData = phenologyData || {};
    auroraData = auroraData || { probability: 0 }; // 🌌 极光安全兜底

    // 为了兼容规则库的 poiTypes 需求
    const poiTypes = [...terrainTags]; // 继承基础地形
    if (terrainTags.includes('water') || terrainTags.includes('beach')) poiTypes.push('coast', 'beach');
    if (terrainTags.includes('wood')) poiTypes.push('forest');
    if (terrainTags.includes('shrine_temple')) poiTypes.push('shrine', 'temple', 'historical_building');
    if (terrainTags.includes('bridge')) poiTypes.push('bridge');
    if (terrainTags.includes('station')) poiTypes.push('station', 'railway_station');

    // 📌 策略二：只返回超小 Payload（几 KB 级别）
    const result = {
        astronomy: {
            now: now.toISOString(),  // 用 ISO 字符串，避免日期对象序列化问题
            times: {
                sunrise: times.sunrise?.toISOString(),
                sunset: times.sunset?.toISOString(),
                dawn: times.dawn?.toISOString(),
                dusk: times.dusk?.toISOString(),
            },
            moonPhase,
            solarAltitude,
            isNight: now < times.dawn || now > times.dusk
        },
        climate: { season },
        ecology: {
            // 天气数据中的积温
            flowerGDD: weatherData?.flowerGDD || 0,
            // 🌸 樱花物候数据（Open-Meteo）
            sakura: phenologyData?.sakura || {},
            // 🍁 红叶物候数据（Open-Meteo）
            maple: phenologyData?.maple || {},
            // 💧 降水对花的影响
            weatherImpact: phenologyData?.weather_impact || {}
        },
        weather: {
            condition: weatherData?.condition || 'Unknown',
            clouds: weatherData?.cloud ?? 50,
            temp: weatherData?.temp_c ?? 20,
            humidity: weatherData?.humidity ?? 60,
            windKph: weatherData?.wind_kph ?? 0,
            precip: weatherData?.precip_mm ?? 0
        },
        terrain: {
            rawTags: terrainTags,
            poiTypes: [...new Set(poiTypes)] // 最后再去重
        },
        // 🌌 极光预警数据暴露给上层雷达
        aurora: {
            probability: auroraData.probability,
            forecastTime: auroraData.forecastTime
        }
    };

    // 📌 性能监控：打印数据大小（在生产环境中可以移除）
    if (isLocalDev) {
        const payloadSize = new Blob([JSON.stringify(result)]).size;
        console.log(`📊 Payload 大小: ${payloadSize} 字节 (目标: <5KB)`);
    }

    return result;
};