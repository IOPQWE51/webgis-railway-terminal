// src/utils/ruleDataConverter.js
// 🎬 规则库数据格式转换器
// 将 dataGateway 的环境数据转换为 decisiveMoments 规则库可用的格式

import SunCalc from 'suncalc';
import { checkAstronomyEvents } from './astronomyCalculator';

/**
 * 根据当前时间和太阳位置计算时间窗口类型
 * @param {Date} now - 当前时间
 * @param {Object} times - SunCalc.getTimes() 返回的时间对象
 * @param {number} solarAltitude - 太阳高度角（度数）
 * @returns {string[]} 时间窗口数组 如 ['dawn', 'sunrise', 'goldenHour']
 */
export const computeTimeWindow = (now, times, solarAltitude) => {
    const windows = [];
    const GOLDEN_THRESHOLD = 6; // 太阳高度 < 6° 为黄金时刻/蓝调时刻
    
    // 时间判断逻辑（按顺序检查每个时段）
    if (now >= times.night && now < times.dawn) {
        windows.push('night');
    }
    
    if (now >= times.dawn && now < times.sunrise) {
        windows.push('dawn');
    }
    
    // 日出附近
    if (now >= times.sunrise && now < times.sunriseEnd) {
        windows.push('sunrise');
    }
    
    // 上午黄金时刻（日出后到上午，太阳高度 < 6°）
    if (now >= times.sunriseEnd && now < times.solarNoon) {
        if (solarAltitude > 0 && solarAltitude < GOLDEN_THRESHOLD) {
            windows.push('goldenHour', 'goldenHourEnd');
        }
    }
    
    // 正午
    const midDayStart = new Date(times.solarNoon.getTime() - 3600000); // ±1小时
    const midDayEnd = new Date(times.solarNoon.getTime() + 3600000);
    if (now >= midDayStart && now <= midDayEnd) {
        windows.push('solarNoon');
    }
    
    // 下午黄金时刻（下午，太阳高度 < 6°）
    if (now > times.solarNoon && now < times.sunsetStart) {
        if (solarAltitude > 0 && solarAltitude < GOLDEN_THRESHOLD) {
            windows.push('goldenHour');
        }
    }
    
    // 日落前（太阳高度逐渐下降）
    if (now >= times.sunsetStart && now < times.sunset) {
        windows.push('goldenHour', 'sunset');
    }
    
    // 日落
    if (now >= times.sunset && now < times.dusk) {
        windows.push('sunset');
    }
    
    // 蓝调时刻（日落后到完全天黑，天空呈深蓝色）
    if (now >= times.dusk && now < times.night) {
        windows.push('dusk', 'nightStarting');
    }
    
    return [...new Set(windows)]; // 去重
};

/**
 * 天气状态到规则库格式的映射表
 */
const weatherConditionMap = {
    'Clear': ['clear', 'sunny', 'fine'],
    'Cloudy': ['cloudy', 'overcast', 'partly cloudy'],
    'Rain': ['rain', 'moderate rain', 'light rain', 'drizzle', 'shower'],
    'Snow': ['snow', 'light snow', 'heavy snow', 'sleet'],
    'Rainy': ['rainy', 'light rain', 'moderate rain'],
    'Dust': ['dust', 'dusty', 'sandstorm', 'dust storm'],
    'Fog': ['fog', 'mist'],
    'Thunderstorm': ['thunderstorm', 'thunder', 'lightning']
};

/**
 * 将天气字符串转换为规则库样式
 * @param {string} condition - 从 API 获取的天气状态字符串
 * @returns {string[]} 规则库格式的天气数组
 */
export const mapWeatherCondition = (condition) => {
    if (!condition) return [];
    
    const conditionLower = condition.toLowerCase();
    const result = [];
    
    for (const [ruleFormat, apiVariants] of Object.entries(weatherConditionMap)) {
        if (apiVariants.some(variant => conditionLower.includes(variant))) {
            result.push(ruleFormat);
        }
    }
    
    return result.length > 0 ? result : ['Unknown'];
};

/**
 * 根据地形标签判断是否满足特定条件
 * @param {string[]} terrainTags - 原始地形标签数组
 * @param {string[]} poiTypes - POI 类型数组
 * @returns {Object} 地标布尔值对象
 */
export const extractLandmarkConditions = (terrainTags = [], poiTypes = []) => {
    return {
        hasWaterfall: terrainTags.includes('waterfall'),
        hasShrine: terrainTags.includes('shrine_temple'),
        hasBridge: terrainTags.includes('bridge'),
        hasForest: poiTypes.includes('forest') || terrainTags.includes('wood'),
        hasCoast: poiTypes.includes('coast') || poiTypes.includes('beach'),
        hasDesert: poiTypes.includes('desert')
    };
};

/**
 * 从 poiTypes 提取符合规则库 category 的类别
 * @param {string[]} poiTypes - POI 类型数组
 * @returns {string[]} 规则库兼容的 category 数组
 */
export const extractCategory = (poiTypes = []) => {
    const validCategories = ['spot', 'station', 'anime', 'airport'];
    return poiTypes.filter(type => validCategories.includes(type));
};

/** 与富士山主峰（近似坐标）的大圆距离，单位公里 */
const distanceKmToMountFuji = (lat, lon) => {
    const fujiLat = 35.360556;
    const fujiLon = 138.727778;
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat - fujiLat);
    const dLon = toRad(lon - fujiLon);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(fujiLat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * 检测特殊地理和季节条件（requires* 字段）
 * 🌍 全球化版本：支持所有地区，不限于日本
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @param {string} season - 季节字符串 ('spring', 'summer', 'autumn', 'winter')
 * @param {Object} gatewayData - dataGateway 的完整数据
 * @returns {Object} 包含所有 requires* 条件的布尔值对象
 */
export const checkRequiredConditions = (lat, lon, season, gatewayData = {}) => {
    const absLat = Math.abs(lat);
    const isNorthernHemisphere = lat >= 0;

    // 🌍 全球化地理范围判定
    const isTemperateZone = absLat >= 25 && absLat <= 60; // 温带地区（适合樱花、枫叶）
    const isSnowRegion = absLat >= 35; // 会下雪的地区

    // 🗻 富士山题材：仅日本周边约 150km
    const requiresMountFuji = distanceKmToMountFuji(lat, lon) <= 150;

    // 🌸 樱花满开条件：全球温带/亚热带地区
    // 北半球：3-5月（春季） | 南半球：9-11月（春季）
    // 覆盖：中国、日本、韩国、美国华盛顿州/法国等
    const sakuraBloomStage = gatewayData.ecology?.sakura?.bloom_stage || 0;
    const isSakuraSeason = isNorthernHemisphere ? season === 'spring' : season === 'autumn';
    const requiresSakuraFull = isSakuraSeason && isTemperateZone && sakuraBloomStage >= 70;

    // 🍁 枫叶红叶条件：全球温带/寒带地区
    // 北半球：9-11月（秋季） | 南半球：3-5月（秋季）
    // 覆盖：日本、加拿大、美国新英格兰、中国东北等
    const mapleLeafStage = gatewayData.ecology?.maple?.leaf_change_stage || 0;
    const isMapleSeason = isNorthernHemisphere ? season === 'autumn' : season === 'spring';
    const requiresMapleLeaves = isMapleSeason && isTemperateZone && mapleLeafStage >= 50;

    // 🌊 微风天气判断：全球通用
    const windKph = gatewayData.weather?.windKph || 0;
    const requiresWindyWeather = windKph > 10; // > 10 km/h 为微风

    // 🌠 天文事件：全球通用
    const astroEvents = checkAstronomyEvents(new Date());

    // ❄️ 冬季特定条件（冰雪景观）
    const isWinterSeason = isNorthernHemisphere ? season === 'winter' : season === 'summer';
    // isSnowRegion 已在上面第162行声明，这里复用

    // 🏔️ 新增：海拔和地形条件
    const elevation = gatewayData.terrain?.elevation || 0;
    const isMountainous = elevation > 500; // 海拔>500米为山区
    const isHighland = elevation > 1000; // 海拔>1000米为高原

    // 🚗 新增：交通和城市条件
    const trafficLevel = gatewayData.mapbox?.trafficLevel || 'unknown';
    const requiresHighTraffic = trafficLevel === 'high' || trafficLevel === 'moderate';

    // 🎨 新增：涂鸦墙和街头艺术
    const hasStreetArt = gatewayData.mapbox?.hasStreetArt || false;

    return {
        requiresSakuraFull,
        requiresMapleLeaves,
        requiresMountFuji,
        requiresWindyWeather,

        // ❄️ 冬季雪景条件（全球）
        requiresSnowyWeather: isWinterSeason && isSnowRegion,

        // 🌌 低光污染（需要外部 API 判断，暂设为 false）
        requiresLowLightPollution: false,

        // ⛰️ 地磁/极光：由 convertToRuleFormat 根据 gatewayData.aurora 覆盖
        requiresGeomagneticActivity: false,

        // 🌠 天文事件（自动计算）
        requiresMeteorEvent: astroEvents.requiresMeteorEvent,
        requiresSolarEclipse: astroEvents.requiresSolarEclipse,
        requiresLunarEclipse: astroEvents.requiresLunarEclipse,
        requiresSuperMoon: astroEvents.requiresSuperMoon,
        requiresCometEvent: astroEvents.requiresCometEvent,

        // 🆕 新增：海拔和地形
        requiresMountainous: isMountainous,
        requiresHighland: isHighland,
        requiresElevationGain: isMountainous, // 地形起伏判断（用于瀑布等）

        // 🆕 新增：交通和城市
        requiresHighTraffic,
        requiresStreetArt: hasStreetArt,
    };
};

/**
 * 主转换函数：将 dataGateway 输出转换为规则库可用格式
 * @param {Object} gatewayData - fetchGlobalEnvironmentData 的返回值
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {Object} 规则库格式的条件对象
 */
export const convertToRuleFormat = (gatewayData, lat, lon) => {
    const { astronomy, climate, weather, terrain } = gatewayData;
    
    // dataGateway 只序列化了部分 times；computeTimeWindow 需要 SunCalc 完整时刻（含 solarNoon、night 等）
    const nowDate = new Date(astronomy.now);
    const fullSunTimes = SunCalc.getTimes(nowDate, lat, lon);
    const timeWindow = computeTimeWindow(nowDate, fullSunTimes, astronomy.solarAltitude);
    
    // 转换天气条件
    const weatherArray = weather 
        ? mapWeatherCondition(weather.condition)
        : [];
    
    // 提取地标条件
    const landmarkConditions = extractLandmarkConditions(
        terrain.rawTags,
        terrain.poiTypes
    );
    
    // 提取分类
    const category = extractCategory(terrain.poiTypes);

    // ✨ 检测特殊地理条件（樱花、枫叶等地区特定规则）
    // 🆕 传入完整的 gatewayData 以获取风速和物候数据
    const requiredConditions = checkRequiredConditions(lat, lon, climate.season, gatewayData);

    // NOAA OVATION 格点值当前观测量级约 0–25；≥8 视为「有可用极光信号」
    const auroraProb = Number(gatewayData.aurora?.probability) || 0;
    const requiresGeomagneticActivity = auroraProb >= 8;
    
    return {
        // ========== 时间与季节 ==========
        weather: weatherArray,
        timeWindow: timeWindow,
        season: [climate.season],
        isNight: astronomy.isNight,

        // ========== 地理位置 ==========
        latitude: lat,
        longitude: lon,
        minLatitude: lat,
        maxLatitude: lat,
        isCoastal: landmarkConditions.hasCoast,
        isForest: landmarkConditions.hasForest,
        category: category,

        // ========== 地标与特征 ==========
        hasWaterfall: landmarkConditions.hasWaterfall,
        hasShrine: landmarkConditions.hasShrine,
        hasBridge: landmarkConditions.hasBridge,

        // ========== 🆕 海拔与地形 ==========
        elevation: gatewayData.terrain?.elevation || 0,
        isMountainous: gatewayData.terrain?.isMountainous || false,
        isHighland: gatewayData.terrain?.isHighland || false,

        // ========== 气象数据（数值） ==========
        minHumidity: weather?.humidity || 0,
        maxHumidity: weather?.humidity || 100,
        maxVisibility: weather?.visibility || 10000, // 米
        minClouds: weather?.clouds || 0,
        maxClouds: weather?.clouds || 100,
        minTemp: weather?.temp || 0,
        maxTemp: weather?.temp || 30,
        windKph: weather?.windKph || 0,

        // ========== 天体数据 ==========
        minMoonPhase: astronomy.moonPhase,
        maxMoonPhase: astronomy.moonPhase,
        sunElevationMax: astronomy.solarAltitude,

        // ========== 特殊地理条件（requires* 字段）🌏 ==========
        requiresSakuraFull: requiredConditions.requiresSakuraFull,
        requiresMapleLeaves: requiredConditions.requiresMapleLeaves,
        requiresWindyWeather: requiredConditions.requiresWindyWeather,
        requiresLowLightPollution: requiredConditions.requiresLowLightPollution,
        requiresGeomagneticActivity,
        requiresMeteorEvent: requiredConditions.requiresMeteorEvent,
        requiresSolarEclipse: requiredConditions.requiresSolarEclipse,
        requiresLunarEclipse: requiredConditions.requiresLunarEclipse,
        requiresSuperMoon: requiredConditions.requiresSuperMoon,
        requiresCometEvent: requiredConditions.requiresCometEvent,
        requiresMountFuji: requiredConditions.requiresMountFuji,

        // ========== 🆕 新增条件（海拔、交通、艺术） ==========
        requiresMountainous: requiredConditions.requiresMountainous,
        requiresHighland: requiredConditions.requiresHighland,
        requiresElevationGain: requiredConditions.requiresElevationGain,
        requiresHighTraffic: requiredConditions.requiresHighTraffic,
        requiresStreetArt: requiredConditions.requiresStreetArt,

        // ========== 🆕 Mapbox 数据 ==========
        trafficLevel: gatewayData.mapbox?.trafficLevel || 'unknown',
        isUrbanArea: gatewayData.mapbox?.isUrbanArea || false,
        hasStreetArt: gatewayData.mapbox?.hasStreetArt || false,

        // ========== 🆕 物候详细数据（用于规则匹配） ==========
        sakuraBloomStage: gatewayData.ecology?.sakura?.bloom_stage || 0,
        mapleLeafStage: gatewayData.ecology?.maple?.leaf_change_stage || 0,
        flowerCondition: gatewayData.ecology?.weather_impact?.flower_impact || 'pristine',

        // ========== 原始数据（保留备用） ==========
        _raw: gatewayData,
        _lat: lat,
        _lon: lon,
        _timestamp: new Date(astronomy.now).toISOString()
    };
};

/**
 * 批量转换多个位置的数据
 * @param {Array} locations - [{lat, lon, data}] 数组
 * @returns {Array} 转换后的规则格式数据
 */
export const convertMultipleLocations = (locations) => {
    return locations.map(({ lat, lon, data }) => 
        convertToRuleFormat(data, lat, lon)
    );
};

/**
 * 调试用：打印转换后的数据摘要
 * @param {Object} ruleData - convertToRuleFormat 的返回值
 */
export const debugPrintRuleData = (ruleData) => {
    if (!import.meta.env.DEV) return;
    console.group('🎬 规则库数据转换结果');
    console.log('⏰ 时间窗口:', ruleData.timeWindow);
    console.log('🌤️ 天气:', ruleData.weather);
    console.log('📅 季节:', ruleData.season);
    console.log('🌙 月相:', ruleData.minMoonPhase?.toFixed(2));
    console.log('☀️ 太阳高度角:', ruleData.sunElevationMax?.toFixed(1), '°');
    console.log('💧 湿度:', ruleData.minHumidity, '%');
    console.log('🌡️ 温度:', ruleData.minTemp, '°C');
    console.log('💨 风速:', ruleData.windKph, 'kph');
    console.log('🏷️ 分类:', ruleData.category);
    console.log('🏗️ 地标:', {
        waterfall: ruleData.hasWaterfall,
        shrine: ruleData.hasShrine,
        bridge: ruleData.hasBridge
    });
    console.log('🌸 樱花盛开度:', ruleData.sakuraBloomStage, '%');
    console.log('🍁 枫叶变红度:', ruleData.mapleLeafStage, '%');
    console.log('💨 微风判断:', ruleData.requiresWindyWeather);
    console.log('🌠 流星雨:', ruleData.requiresMeteorEvent);
    console.log('🌙 超级月亮:', ruleData.requiresSuperMoon);
    console.groupEnd();
};

export default {
    computeTimeWindow,
    mapWeatherCondition,
    extractLandmarkConditions,
    extractCategory,
    convertToRuleFormat,
    convertMultipleLocations,
    debugPrintRuleData
};
