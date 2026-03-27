// src/utils/ruleMatcher.js
// 🎬 决定性瞬间规则匹配引擎
// 将转换后的环境数据与 100+ 摄影规则库进行智能匹配

import { decisiveMomentRules } from './decisiveMoments';

/**
 * 匹配单个条件字段
 * @param {any} ruleCondition - 规则库中定义的条件值
 * @param {any} inputData - 转换后的实际数据
 * @param {string} fieldName - 字段名称（用于调试）
 * @returns {boolean} 是否匹配
 */
const matchSingleCondition = (ruleCondition, inputData, fieldName) => {
    // 处理 undefined 或 null
    if (ruleCondition === undefined || ruleCondition === null) {
        return true; // 未定义条件则视为通过
    }
    
    // ========== 数组类型：取交集 ==========
    if (Array.isArray(ruleCondition)) {
        if (!Array.isArray(inputData)) {
            return false; // 规则期望数组但实际不是
        }
        
        // 检查是否有交集（至少有一个匹配）
        return ruleCondition.some(ruleVal => 
            inputData.some(inputVal => 
                String(ruleVal).toLowerCase() === String(inputVal).toLowerCase()
            )
        );
    }
    
    // ========== 数值类型：精确匹配或范围匹配 ==========
    if (typeof ruleCondition === 'number') {
        // 获取 min/max 字段进行范围判断
        return typeof inputData === 'number' && inputData === ruleCondition;
    }
    
    // ========== 布尔类型：精确匹配 ==========
    if (typeof ruleCondition === 'boolean') {
        return inputData === ruleCondition;
    }
    
    // ========== 字符串类型：不区分大小写匹配 ==========
    if (typeof ruleCondition === 'string') {
        return String(inputData).toLowerCase() === ruleCondition.toLowerCase();
    }
    
    // 其他类型的精确匹配
    return inputData === ruleCondition;
};

/**
 * 处理 min/max 范围条件
 * @param {string} baseFieldName - 基础字段名（如 'Humidity'）
 * @param {any} inputValue - 实际值
 * @param {any} minCondition - 规则中的最小值条件
 * @param {any} maxCondition - 规则中的最大值条件
 * @returns {boolean} 是否在范围内
 */
const matchRangeCondition = (baseFieldName, inputValue, minCondition, maxCondition) => {
    // 如果条件未定义，默认通过
    if (minCondition === undefined && maxCondition === undefined) {
        return true;
    }
    
    // 输入值必须是数字
    if (typeof inputValue !== 'number') {
        return false;
    }
    
    // 检查最小值
    if (minCondition !== undefined && typeof minCondition === 'number') {
        if (inputValue < minCondition) {
            return false;
        }
    }
    
    // 检查最大值
    if (maxCondition !== undefined && typeof maxCondition === 'number') {
        if (inputValue > maxCondition) {
            return false;
        }
    }
    
    return true;
};

/**
 * 规范化字段名（处理大小写变化）
 * @param {string} field - 原始字段名
 * @returns {string} 规范化后的字段名
 */
const normalizeFieldName = (field) => {
    return field.toLowerCase().replace(/[-_]/g, '');
};

/**
 * 检查所有条件是否满足
 * @param {Object} ruleConditions - 规则中定义的所有条件
 * @param {Object} envData - 转换后的环境数据
 * @returns {Object} {matched: boolean, details: {field: matchStatus}}
 */
export const checkConditions = (ruleConditions, envData) => {
    const details = {};
    let allMatched = true;
    
    // 遍历规则中的每个条件
    for (const [field, condition] of Object.entries(ruleConditions)) {
        let matched = false;
        
        // 处理 requires* 类型的条件（地理/季节特定的规则）
        // 现在这些条件已经在 ruleDataConverter 中被正确设置
        if (field.startsWith('requires')) {
            matched = envData[field] === condition;
            details[field] = { 
                status: matched ? 'passed' : 'failed',
                expected: condition,
                actual: envData[field],
                note: '地理/季节条件检查'
            };
            if (!matched) allMatched = false;
            continue;
        }
        
        // 处理 has* 类型的条件（布尔地标检测）
        if (field.startsWith('has')) {
            matched = envData[field] === condition;
            details[field] = { 
                status: matched ? 'passed' : 'failed',
                expected: condition,
                actual: envData[field]
            };
        }
        // 处理 is* 类型的条件（布尔状态）
        else if (field.startsWith('is')) {
            matched = envData[field] === condition;
            details[field] = {
                status: matched ? 'passed' : 'failed',
                expected: condition,
                actual: envData[field]
            };
        }
        // 处理 min* 和 max* 条件（范围）
        else if (field.startsWith('min') || field.startsWith('max')) {
            // 这些通常与 max*/min* 成对出现，在下面处理
            continue;
        }
        // 处理其他常规字段
        else {
            matched = matchSingleCondition(condition, envData[field], field);
            details[field] = {
                status: matched ? 'passed' : 'failed',
                expected: condition,
                actual: envData[field]
            };
        }
        
        if (!matched) {
            allMatched = false;
        }
    }
    
    // 额外处理 min*/max* 范围条件
    const processedRanges = new Set();
    for (const field of Object.keys(ruleConditions)) {
        if (field.startsWith('min') || field.startsWith('max')) {
            const baseFieldName = field.replace(/^(min|max)/, '');
            const normalizedBase = normalizeFieldName(baseFieldName);
            const rangeKey = normalizedBase;
            
            if (processedRanges.has(rangeKey)) continue;
            processedRanges.add(rangeKey);
            
            const minField = 'min' + baseFieldName;
            const maxField = 'max' + baseFieldName;
            const minCondition = ruleConditions[minField];
            const maxCondition = ruleConditions[maxField];
            
            // 在 envData 中查找对应字段（可能是小写或其他形式）
            let inputValue = envData[baseFieldName] || 
                            envData[normalizeFieldName(baseFieldName)] ||
                            envData[baseFieldName.toLowerCase()];
            
            if (inputValue !== undefined) {
                const rangeMatched = matchRangeCondition(
                    baseFieldName,
                    inputValue,
                    minCondition,
                    maxCondition
                );
                
                if (!rangeMatched) {
                    allMatched = false;
                }
                
                details[rangeKey] = {
                    status: rangeMatched ? 'passed' : 'failed',
                    min: minCondition,
                    max: maxCondition,
                    actual: inputValue
                };
            }
        }
    }
    
    return {
        matched: allMatched,
        details: details
    };
};

/**
 * 计算规则匹配度分数（0-100）
 * 用于排序多个匹配的规则
 * @param {Object} ruleConditions - 规则条件
 * @param {Object} envData - 环境数据
 * @param {Object} conditionCheck - checkConditions 的返回值
 * @returns {number} 0-100 的匹配分数
 */
export const calculateMatchScore = (ruleConditions, envData, conditionCheck) => {
    if (!conditionCheck.matched) {
        return 0; // 未匹配返回 0
    }
    
    // 基础分：完全匹配
    let score = 100;
    const details = conditionCheck.details;
    
    // 惩罚项：调整分数基于细节
    for (const [field, detail] of Object.entries(details)) {
        if (detail.status === 'optional') {
            // 可选条件不扣分
            continue;
        } else if (detail.status === 'failed') {
            score -= 5; // 失败条件扣 5 分
        }
    }
    
    // 加分项：特定条件增加权重
    if (details.weather?.status === 'passed') score += 10; // 天气匹配加分
    if (details.season?.status === 'passed') score += 5;   // 季节匹配加分
    if (details.timeWindow?.status === 'passed') score += 15; // 时间窗口很重要
    if (details.hasWaterfall?.status === 'passed' || 
        details.hasShrine?.status === 'passed') score += 8; // 地标匹配加分
    
    // 确保分数在 0-100 范围内
    return Math.max(0, Math.min(100, score));
};

/**
 * 主匹配函数：找出所有匹配的规则
 * @param {Object} envData - 转换后的环境数据
 * @param {Array} rules - 规则数组（默认使用 decisiveMomentRules）
 * @param {Object} options - 选项 {sortByScore: bool, minScore: number, verbose: bool}
 * @returns {Array} 匹配的规则数组（带评分信息）
 */
export const matchRules = (envData, rules = decisiveMomentRules, options = {}) => {
    const { 
        sortByScore = true,     // 是否按分数排序
        minScore = 50,          // 最低分数阈值
        verbose = false         // 是否输出详细日志
    } = options;
    
    const matches = [];
    
    for (const rule of rules) {
        if (!rule.conditions) continue;
        
        // 检查所有条件
        const conditionCheck = checkConditions(rule.conditions, envData);
        
        if (conditionCheck.matched) {
            // 计算匹配分数
            const score = calculateMatchScore(
                rule.conditions,
                envData,
                conditionCheck
            );
            
            // 只保留分数 >= 阈值的结果
            if (score >= minScore) {
                matches.push({
                    id: rule.id,
                    output: rule.output,
                    score: score,
                    conditions: rule.conditions,
                    details: conditionCheck.details,
                    rarity: extractRarity(rule.output) // 提取稀有度
                });
                
                if (verbose) {
                    console.log(
                        `✅ 匹配规则: ${rule.id} (分数: ${score})\n`,
                        `   输出: ${rule.output.substring(0, 50)}...`
                    );
                }
            }
        }
    }
    
    // 按分数排序（可选）
    if (sortByScore) {
        matches.sort((a, b) => b.score - a.score);
    }
    
    return matches;
};

/**
 * 从输出文本中提取稀有度星级
 * @param {string} output - 规则输出文本
 * @returns {number} 星级数量 (1-5)
 */
const extractRarity = (output) => {
    const match = output.match(/⭐{1,5}/);
    return match ? match[0].length : 3; // 默认 3 星
};

/**
 * 获取顶级建议
 * @param {Object} envData - 环境数据
 * @param {number} topN - 返回前 N 个建议
 * @param {Object} options - 选项
 * @returns {Array} 顶级建议列表
 */
export const getTopSuggestions = (envData, topN = 5, options = {}) => {
    const matches = matchRules(envData, decisiveMomentRules, options);
    return matches.slice(0, topN);
};

/**
 * 获取按稀有度分组的建议
 * @param {Object} envData - 环境数据
 * @returns {Object} {rare: [], uncommon: [], common: []}
 */
export const groupSuggestionsByRarity = (envData) => {
    const options = { sortByScore: true, minScore: 0, verbose: false };
    const matches = matchRules(envData, decisiveMomentRules, options);
    
    const grouped = {
        legendary: [],  // 5星
        epic: [],       // 4星
        rare: [],       // 3星
        uncommon: [],   // 2星
        common: []      // 1星
    };
    
    for (const match of matches) {
        if (match.rarity >= 5) grouped.legendary.push(match);
        else if (match.rarity === 4) grouped.epic.push(match);
        else if (match.rarity === 3) grouped.rare.push(match);
        else if (match.rarity === 2) grouped.uncommon.push(match);
        else grouped.common.push(match);
    }
    
    return grouped;
};

/**
 * 调试函数：打印详细的匹配报告
 * @param {Object} envData - 环境数据
 * @param {string} ruleId - 特定规则 ID（可选）
 */
export const debugMatchingReport = (envData, ruleId = null) => {
    console.group('🎬 规则匹配详细报告');
    
    const options = { sortByScore: true, minScore: 0, verbose: true };
    const matches = matchRules(envData, decisiveMomentRules, options);
    
    console.log(`📊 总匹配规则数: ${matches.length}`);
    console.log('─'.repeat(60));
    
    for (const match of matches.slice(0, 10)) {
        console.group(`${match.output.split('：')[0]} (ID: ${match.id})`);
        console.log(`分数: ${match.score} | 稀有度: ${'⭐'.repeat(match.rarity)}`);
        console.log('条件详情:', match.details);
        console.log('输出:', match.output);
        console.groupEnd();
    }
    
    if (ruleId) {
        const rule = decisiveMomentRules.find(r => r.id === ruleId);
        if (rule) {
            console.group(`🔍 规则详情: ${ruleId}`);
            const check = checkConditions(rule.conditions, envData);
            console.log('条件:', rule.conditions);
            console.log('匹配结果:', check);
            console.groupEnd();
        }
    }
    
    console.groupEnd();
};

/**
 * 统计当前环境满足的条件
 * @param {Object} envData - 环境数据
 * @returns {Object} 统计信息
 */
export const analyzeEnvironment = (envData) => {
    const stats = {
        weather: envData.weather || [],
        season: envData.season || [],
        timeWindow: envData.timeWindow || [],
        temperature: envData.minTemp,
        humidity: envData.minHumidity,
        moonPhase: (envData.minMoonPhase * 100).toFixed(1) + '%',
        sunAltitude: (envData.sunElevationMax || 0).toFixed(1) + '°',
        landmarks: {
            waterfall: envData.hasWaterfall || false,
            shrine: envData.hasShrine || false,
            bridge: envData.hasBridge || false
        },
        isNight: envData.isNight || false,
        isCoastal: envData.isCoastal || false,
        isForest: envData.isForest || false
    };
    
    console.table(stats);
    return stats;
};

export default {
    matchRules,
    checkConditions,
    calculateMatchScore,
    getTopSuggestions,
    groupSuggestionsByRarity,
    debugMatchingReport,
    analyzeEnvironment
};
