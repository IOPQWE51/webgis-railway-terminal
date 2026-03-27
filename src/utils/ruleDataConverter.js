// src/utils/ruleDataConverter.js
// 🎬 规则库数据格式转换器
// 将 dataGateway 的环境数据转换为 decisiveMoments 规则库可用的格式

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

/**
 * 检测特殊地理和季节条件（requires* 字段）
 * 用于判断是否应该应用特定地区的规则（如日本樱花、枫叶）
 * @param {number} lat - 纬度
 * @param {string} season - 季节字符串 ('spring', 'summer', 'autumn', 'winter')
 * @returns {Object} 包含所有 requires* 条件的布尔值对象
 */
export const checkRequiredConditions = (lat, season) => {
    // 🎌 日本地理范围：北纬约 24° ~ 45°
    const isJapanRegion = lat >= 24 && lat <= 45;
    
    return {
        // 🌸 樱花满开条件：春季 + 日本地区
        requiresSakuraFull: season === 'spring' && isJapanRegion,
        
        // 🍁 枫叶条件：秋季 + 日本地区
        requiresMapleLeaves: season === 'autumn' && isJapanRegion,
        
        // 🌊 微风天气（这个需要从天气数据判断，暂设为 false，交由匹配器处理）
        requiresWindyWeather: false, // 在 ruleMatcher 中通过 windKph 字段判断
        
        // 🌌 低光污染（需要外部 API 判断，暂设为 false）
        requiresLowLightPollution: false,
        
        // ⛰️ 其他天文事件（需要实时天文数据 API，暂设为 false）
        requiresGeomagneticActivity: false, // 北极光，需要实时地磁数据
        requiresMeteorEvent: false,         // 流星雨，需要事件日期数据
        requiresSolarEclipse: false,        // 日食，需要事件日期数据
        requiresLunarEclipse: false,        // 月食，需要事件日期数据
        requiresSuperMoon: false,           // 超级月亮，需要事件日期数据
        requiresCometEvent: false           // 彗星，需要事件日期数据
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
    
    // 提取时间窗口
    const timeWindow = computeTimeWindow(
        astronomy.now,
        astronomy.times,
        astronomy.solarAltitude
    );
    
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
    const requiredConditions = checkRequiredConditions(lat, climate.season);
    
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
        requiresGeomagneticActivity: requiredConditions.requiresGeomagneticActivity,
        requiresMeteorEvent: requiredConditions.requiresMeteorEvent,
        requiresSolarEclipse: requiredConditions.requiresSolarEclipse,
        requiresLunarEclipse: requiredConditions.requiresLunarEclipse,
        requiresSuperMoon: requiredConditions.requiresSuperMoon,
        requiresCometEvent: requiredConditions.requiresCometEvent,
        
        // ========== 原始数据（保留备用） ==========
        _raw: gatewayData,
        _lat: lat,
        _lon: lon,
        _timestamp: astronomy.now.toISOString()
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
