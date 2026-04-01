// src/utils/astronomyCalculator.js
// 🌠 天文事件自动计算器 - 无需手动维护数据

import SunCalc from 'suncalc';

/**
 * 🌠 流星雨数据库（每年固定日期）
 * month: 0-11 (0=1月, 11=12月)
 * day: 日期
 * zhr: 天顶每小时流星数（ZHR）
 * durationDays: 前后持续时间（天）
 */
const METEOR_SHOWERS = [
    { name: '象限仪座流星雨', english: 'Quadrantids', month: 0, day: 3, zhr: 120, durationDays: 2 },
    { name: '天琴座流星雨', english: 'Lyrids', month: 3, day: 22, zhr: 20, durationDays: 3 },
    { name: 'η宝瓶座流星雨', english: 'Eta Aquariids', month: 4, day: 6, zhr: 50, durationDays: 5 },
    { name: '英仙座流星雨', english: 'Perseids', month: 7, day: 12, zhr: 150, durationDays: 7 }, // 最著名
    { name: '天龙座流星雨', english: 'Draconids', month: 9, day: 8, zhr: 10, durationDays: 3 },
    { name: '猎户座流星雨', english: 'Orionids', month: 9, day: 21, zhr: 20, durationDays: 5 },
    { name: '狮子座流星雨', english: 'Leonids', month: 10, day: 17, zhr: 15, durationDays: 3 },
    { name: '双子座流星雨', english: 'Geminids', month: 11, day: 14, zhr: 120, durationDays: 7 }, // 最稳定
    { name: '小熊座流星雨', english: 'Ursids', month: 11, day: 22, zhr: 10, durationDays: 2 }
];

/**
 * 🌙 计算是否为超级月亮
 * 超级月亮定义：满月时月球距离地球 < 357,000 km（近地点满月）
 * @param {Date} date - 检查日期
 * @returns {boolean}
 */
export const calculateSuperMoon = (date = new Date()) => {
    try {
        const moonIllum = SunCalc.getMoonIllumination(date);
        const moonPhase = moonIllum.fraction; // 月相 0-1 (1=满月)
        const moonDistance = moonIllum.distance; // 月地距离（km）

        // 超级月亮判定：满月 + 近地点
        // 满月：月相 > 0.95 (95%照明)
        // 近地点：距离 < 357,000 km
        const isFullMoon = moonPhase > 0.95;
        const isNearPerigee = moonDistance < 357000;

        return isFullMoon && isNearPerigee;
    } catch (error) {
        console.warn('计算超级月亮失败:', error);
        return false;
    }
};

/**
 * 🌠 检查当前是否在流星雨活跃期
 * @param {Date} date - 检查日期
 * @returns {Object|null} 流星雨信息或null
 */
export const checkMeteorShower = (date = new Date()) => {
    const month = date.getMonth();
    const day = date.getDate();

    // 检查是否在任何流星雨的时间窗口内
    for (const shower of METEOR_SHOWERS) {
        const daysDiff = Math.abs(
            (new Date(date.getFullYear(), month, day) -
             new Date(date.getFullYear(), shower.month, shower.day)) /
            (1000 * 60 * 60 * 24)
        );

        if (daysDiff <= shower.durationDays) {
            return {
                name: shower.name,
                english: shower.english,
                zhr: shower.zhr,
                peakDays: daysDiff, // 距离峰值还有几天
                isActive: true
            };
        }
    }

    return null;
};

/**
 * 🔍 综合检查所有天文事件
 * @param {Date} date - 检查日期
 * @returns {Object} 所有天文事件的布尔值和详情
 */
export const checkAstronomyEvents = (date = new Date()) => {
    const meteorShower = checkMeteorShower(date);
    const isSuperMoon = calculateSuperMoon(date);

    // 日月食数据比较复杂，暂时设为false
    // 如果需要，可以调用 NASA Eclipse API: https://eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/SE2053-Aug-12T.gif
    // 或者使用 https://api.astronomyapi.com/v1/events

    return {
        // 🌠 流星雨
        requiresMeteorEvent: !!meteorShower,
        meteorShowerName: meteorShower?.name || null,
        meteorShowerZHR: meteorShower?.zhr || 0,
        meteorShowerPeakDays: meteorShower?.peakDays || null,

        // 🌙 超级月亮
        requiresSuperMoon: isSuperMoon,

        // ☀️🌑 日月食（暂未实现，需要专用API）
        requiresSolarEclipse: false,
        requiresLunarEclipse: false,

        // ☄️ 彗星（非常罕见，暂时不处理）
        requiresCometEvent: false
    };
};

/**
 * 📅 获取今年所有重要的天文事件日期
 * 用于生成日历或预告
 * @param {number} year - 年份
 * @returns {Array} 天文事件列表
 */
export const getYearlyAstronomyEvents = (year = new Date().getFullYear()) => {
    const events = [];

    // 流星雨
    for (const shower of METEOR_SHOWERS) {
        const peakDate = new Date(year, shower.month, shower.day);
        events.push({
            type: 'meteor_shower',
            name: shower.name,
            english: shower.english,
            date: peakDate.toISOString().split('T')[0],
            zhr: shower.zhr,
            durationDays: shower.durationDays,
            bestTime: '02:00-05:00', // 北半球最佳观测时间
            rarity: shower.zhr >= 100 ? 5 : shower.zhr >= 50 ? 4 : 3
        });
    }

    // 每月的满月日期（检查是否有超级月亮）
    for (let month = 0; month < 12; month++) {
        const monthDate = new Date(year, month, 1);
        // 查找该月的满月（简化版：每个月检查15号左右）
        for (let day = 10; day <= 20; day++) {
            const checkDate = new Date(year, month, day);
            if (calculateSuperMoon(checkDate)) {
                events.push({
                    type: 'super_moon',
                    name: '超级月亮',
                    date: checkDate.toISOString().split('T')[0],
                    bestTime: '月出/月落时刻',
                    rarity: 4
                });
                break; // 每月最多一个
            }
        }
    }

    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
};

/**
 * 🎯 判断当前时刻是否为天文摄影黄金时刻
 * 考虑：月相、光污染、天气等综合因素
 * @param {Date} date - 检查日期
 * @param {number} moonPhase - 月相 0-1
 * @param {boolean} isClear - 是否晴朗
 * @returns {boolean}
 */
export const isAstrophotographyGoldenTime = (date, moonPhase, isClear = true) => {
    const astroEvents = checkAstronomyEvents(date);

    // 判断条件：
    // 1. 夜晚
    // 2. 无月或新月 (moonPhase < 0.2)
    // 3. 天气晴朗
    // 4. (可选) 有流星雨活跃
    const nightTime = date.getHours() >= 22 || date.getHours() <= 4;
    const darkMoon = moonPhase < 0.2;

    return nightTime && darkMoon && isClear && (astroEvents.requiresMeteorEvent || true);
};

export default {
    calculateSuperMoon,
    checkMeteorShower,
    checkAstronomyEvents,
    getYearlyAstronomyEvents,
    isAstrophotographyGoldenTime
};
