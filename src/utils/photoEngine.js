// src/utils/photoEngine.js
// 🎬 摄影引擎 v4.0 - 外科手术式重构版本
// 核心流程由三行代码驱动：拿数据 → 洗数据 → 出结果

import SunCalc from 'suncalc';
import { OWM_API_KEY } from '../config/mapConstants';
import { fetchGlobalEnvironmentData } from './dataGateway'; 
import { convertToRuleFormat, debugPrintRuleData } from './ruleDataConverter';
import { getTopSuggestions, groupSuggestionsByRarity } from './ruleMatcher';

// 🌐 核心魔法：根据经纬度，推算当地时间
const formatLocalTimeByLon = (date, lon) => {
    if (!date || isNaN(date.getTime())) return '--:--';
    const offsetHours = Math.round(lon / 15);
    const offsetMs = offsetHours * 60 * 60 * 1000;
    const localDate = new Date(date.getTime() + offsetMs);
    const h = String(localDate.getUTCHours()).padStart(2, '0');
    const m = String(localDate.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

// 1. 注册 V4.0 全局打分引擎
export const initPhotoEvalEngine = () => {
    window.__evalPhotoCondition = async (event, lat, lon, evalId, category = 'spot') => {
        if (event) { event.stopPropagation(); event.preventDefault(); }

        const btn = document.getElementById(`btn-${evalId}`);
        const resultDiv = document.getElementById(`result-${evalId}`);
        if (!resultDiv) return;
        
        if (btn) btn.style.display = 'none';
        resultDiv.innerHTML = `<div style="text-align:center; padding: 10px; font-size:12px; color:#6b7280; font-weight:bold;"><span style="display:inline-block; animation:spin 1s linear infinite;">🛰️</span> 正在调用双引擎超级雷达...</div>`;

        try {
            // ============ 外科手术式换心：三行代码核心流程 ============
            // Line 1: 拿数据 - 从网关获取原始环境数据
            const rawEnvData = await fetchGlobalEnvironmentData(lat, lon);
            
            // Line 2: 洗数据 - 转换为规则库标准格式
            const standardData = convertToRuleFormat(rawEnvData, lat, lon);
            
            // Line 3: 出结果 - 匹配规则库，获取顶级建议
            const topMatches = getTopSuggestions(standardData, 5, { minScore: 0 });
            
            // =========================================================

            // 提取基础信息用于 UI 渲染
            if (!rawEnvData.weather) throw new Error("气象节点无响应");

            const { season } = rawEnvData.climate;
            const { condition, clouds, visibility, isRaining, temp } = rawEnvData.weather;
            const { now, times, moonPhase, isNight } = rawEnvData.astronomy;
            const { isCoastal } = rawEnvData.terrain;

            // ========== 综合摄影指数计算（保留原有评分逻辑）==========
            let score = 50; 
            let tags = [];
            
            const seasonLabels = { spring: '🌸 春', summer: '🌿 夏', autumn: '🍁 秋', winter: '❄️ 冬', wet: '☔ 雨季', dry: '☀️ 旱季' };
            tags.push(`<span style="background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px;">${seasonLabels[season] || '🌍 当前季'}</span>`);
            if (temp !== undefined) tags.push(`<span style="background:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:4px;">🌡️ ${temp}°C</span>`);

            if (now >= times.goldenHour && now <= times.sunset) {
                score += 25; tags.push(`<span style="color:#fbbf24;">🌅 黄金时刻 (+25)</span>`);
            } else if (now >= times.sunset && now <= times.nightStarting) {
                score += 20; tags.push(`<span style="color:#60a5fa;">🌌 蓝调时刻 (+20)</span>`);
            } else if (clouds > 70 && !isRaining) {
                score += 15; tags.push(`<span style="color:#94a3b8;">☁️ 阴天柔光 (+15)</span>`);
            } else {
                score += 5; tags.push(`<span style="color:#f59e0b;">☀️ 普通光线 (+5)</span>`);
            }

            if (visibility < 2000) {
                score += 25; tags.push(`<span style="color:#a78bfa;">🌫️ 浓雾梦幻 (+25)</span>`);
            } else if (condition && condition.toLowerCase().includes('snow')) {
                score += 20; tags.push(`<span style="color:#38bdf8;">❄️ 降雪 (+20)</span>`);
            } else if (isRaining) {
                score += 15; tags.push(`<span style="color:#34d399;">🌧️ 雨中 (+15)</span>`);
            }

            if (isNight) {
                if (moonPhase < 0.2 && clouds < 20) {
                    score += 15; tags.push(`<span style="color:#c084fc;">✨ 绝佳观星 (+15)</span>`);
                } else if (moonPhase > 0.8 && isCoastal) {
                    score += 10; tags.push(`<span style="color:#fcd34d;">🌕 海上满月 (+10)</span>`);
                }
            }

            // ========== 决定性瞬间推荐（由新的匹配引擎提供）==========
            const decisiveRecommendations = topMatches.slice(0, 1);
            const decisiveMoment = decisiveRecommendations.length > 0 
                ? decisiveRecommendations[0].output 
                : null;

            score = Math.min(score, 100);
            let grade, vColor, verdict;
            if (score >= 90) { grade = 'S'; vColor = '#8b5cf6'; verdict = '绝佳决定性瞬间 (强烈推荐)'; }
            else if (score >= 75) { grade = 'A'; vColor = '#10b981'; verdict = '出片率极高 (条件优越)'; }
            else if (score >= 60) { grade = 'B'; vColor = '#f59e0b'; verdict = '适合记录 (光影普通)'; }
            else { grade = 'C'; vColor = '#ef4444'; verdict = '不推荐强求 (建议现场踩点)'; }

            resultDiv.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; margin-top: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid ${vColor}30; padding-bottom: 6px; margin-bottom: 8px;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:10px; color:#64748b; font-weight:bold;">综合摄影指数</span>
                            <span style="font-weight:900; color:${vColor}; font-size:14px;">🎯 评级: ${grade}</span>
                        </div>
                        <span style="font-size:24px; font-weight:900; color:${vColor}; line-height:0.9;">${score}<span style="font-size:12px; color:#94a3b8;">/100</span></span>
                    </div>
                    <div style="font-weight:bold; color:#1e293b; font-size:12px; margin-bottom:8px;">${verdict}</div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px; font-size:10px; font-weight:bold; margin-bottom:8px;">
                        ${tags.join('')}
                    </div>
                    ${decisiveMoment ? `
                        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fbbf24; padding: 8px; border-radius: 6px; font-size: 11px; font-weight: bold; border-left: 3px solid #fbbf24;">
                            <div style="margin-bottom: 4px; color: #f8fafc;">✨ 决定性瞬间预警</div>
                            ${decisiveMoment}
                        </div>
                    ` : `
                        <div style="background: #ffffff; color: #64748b; padding: 6px; border-radius: 6px; font-size: 10px; border: 1px dashed #cbd5e1; text-align: center;">当前时段暂无特殊环境化学反应</div>
                    `}
                </div>
            `;
        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center; padding:10px; font-weight:bold;">⚠️ 卫星数据链路断开</div>`;
            if (btn) btn.style.display = 'block'; 
        }
    };
};

// 2. 生成带光影计算的弹窗 HTML
export const generatePopupContent = (pt, ptId, iconStr, name, desc) => {
    const times = SunCalc.getTimes(new Date(), pt.lat, pt.lon);
    
    const sunrise = formatLocalTimeByLon(times.sunrise, pt.lon); 
    const sunset = formatLocalTimeByLon(times.sunset, pt.lon);
    const goldenHour = formatLocalTimeByLon(times.goldenHour, pt.lon); 
    const blueHour = formatLocalTimeByLon(times.nightStarting, pt.lon);

    const evalId = Math.random().toString(36).substr(2, 9);
    const category = pt.category || 'spot';

    return `
        <div style="min-width: 240px; font-family: sans-serif; padding-top: 4px;">
            <b style="font-size:16px; color:#1f2937; display:flex; align-items:center; gap:6px;">${iconStr} ${name}</b>
            ${desc ? `<div style="font-size:11px; color:#6b7280; margin: 4px 0 8px 0; background:#f3f4f6; padding:4px 8px; border-radius:4px; font-weight:bold;">${desc}</div>` : ''}
            
            <div style="margin-top: 10px; padding: 10px; background: #1e293b; color: #f8fafc; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 900; color: #38bdf8; margin-bottom: 8px;">🌞 当地绝对光影坐标</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; font-weight: bold;">
                    <div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.1); padding: 4px 6px; border-radius: 4px;"><span style="color:#94a3b8;">日出</span> <span style="color:#f8fafc;">${sunrise}</span></div>
                    <div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.1); padding: 4px 6px; border-radius: 4px;"><span style="color:#94a3b8;">日落</span> <span style="color:#f8fafc;">${sunset}</span></div>
                    <div style="display: flex; justify-content: space-between; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); padding: 4px 6px; border-radius: 4px; grid-column: span 2;"><span style="color:#fbbf24;">✨ 黄金时刻</span> <span style="color:#fbbf24;">${goldenHour} - ${sunset}</span></div>
                    <div style="display: flex; justify-content: space-between; background: rgba(96, 165, 250, 0.15); border: 1px solid rgba(96, 165, 250, 0.3); padding: 4px 6px; border-radius: 4px; grid-column: span 2;"><span style="color:#60a5fa;">🌌 蓝调时刻</span> <span style="color:#60a5fa;">${sunset} - ${blueHour}</span></div>
                </div>
            </div>

            <div style="margin-top: 10px;">
                <button id="btn-${evalId}" onclick="window.__evalPhotoCondition(event, ${pt.lat}, ${pt.lon}, '${evalId}', '${category}')" style="width: 100%; background: linear-gradient(135deg, #10b981, #06b6d4); color: white; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 900; cursor: pointer;">
                    🔮 启动双引擎雷达演算
                </button>
                <div id="result-${evalId}"></div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 12px;">
                <a href="https://www.google.com/maps?q=${pt.lat},${pt.lon}" target="_blank" style="flex: 1; text-align: center; background-color: #f1f5f9; color: #3b82f6; border: 1px solid #bfdbfe; padding: 8px 0; border-radius: 6px; font-size: 12px; font-weight: 900; text-decoration: none;">📍 Google</a>
                <a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(name)}" target="_blank" style="flex: 1; text-align: center; background-color: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 8px 0; border-radius: 6px; font-size: 12px; font-weight: 900; text-decoration: none;">🚃 Yahoo!</a>
            </div>
        </div>
    `;
};
