// src/utils/photoEngine.js
// 🎬 摄影引擎 v4.0 - 外科手术式重构版本 + 极致 UI 优化版

import SunCalc from 'suncalc';
import { fetchGlobalEnvironmentData } from './dataGateway'; 
import { convertToRuleFormat } from './ruleDataConverter';
import { getTopSuggestions } from './ruleMatcher';

// 🌐 根据经纬度，推算当地时间
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
        
        // 加载动画
        resultDiv.innerHTML = `
            <div style="text-align:center; padding: 16px; background: #f8fafc; border-radius: 12px; margin-top: 12px;">
                <div style="font-size:16px; display:inline-block; animation:spin 1s linear infinite; margin-bottom:8px;">🛰️</div>
                <div style="font-size:12px; color:#64748b; font-weight:700; letter-spacing:1px;">双引擎雷达演算中...</div>
            </div>
            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        `;

        try {
            // ============ 三行代码核心流程 ============
            const rawEnvData = await fetchGlobalEnvironmentData(lat, lon);
            const standardData = convertToRuleFormat(rawEnvData, lat, lon);
            
            // 补丁：融合前端的类别标识
            if (category && !standardData.category.includes(category)) {
                standardData.category.push(category);
            }
            
            const topMatches = getTopSuggestions(standardData, 5, { minScore: 0 });
            // =========================================

            const { season } = rawEnvData.climate;
            const { condition, clouds, visibility, isRaining, temp } = rawEnvData.weather;
            const { moonPhase, isNight } = rawEnvData.astronomy;
            const evalNow = new Date(rawEnvData.astronomy.now);
            const scTimes = SunCalc.getTimes(evalNow, lat, lon);
            const { isCoastal } = rawEnvData.terrain;

            // ========== 综合摄影指数计算 ==========
            let score = 50; 
            let tags = [];
            
            // UI 优化的 Tag 生成器
            const makeTag = (bg, color, border, text) => 
                `<span style="background:${bg}; color:${color}; border:1px solid ${border}; padding:3px 8px; border-radius:6px; font-weight:700; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,0.02);">${text}</span>`;

            const seasonLabels = { spring: '🌸 春', summer: '🌿 夏', autumn: '🍁 秋', winter: '❄️ 冬', wet: '☔ 雨季', dry: '☀️ 旱季' };
            tags.push(makeTag('#f1f5f9', '#475569', '#e2e8f0', seasonLabels[season] || '🌍 当前季'));
            if (temp !== undefined) tags.push(makeTag('#fef2f2', '#ef4444', '#fee2e2', `🌡️ ${temp}°C`));

            if (evalNow >= scTimes.goldenHour && evalNow <= scTimes.sunset) {
                score += 25; tags.push(makeTag('#fffbeb', '#d97706', '#fef3c7', '🌅 黄金时刻 (+25)'));
            } else if (evalNow >= scTimes.sunset && evalNow <= scTimes.night) {
                score += 20; tags.push(makeTag('#eff6ff', '#2563eb', '#dbeafe', '🌌 蓝调时刻 (+20)'));
            } else if (clouds > 70 && !isRaining) {
                score += 15; tags.push(makeTag('#f8fafc', '#64748b', '#e2e8f0', '☁️ 阴天柔光 (+15)'));
            } else {
                score += 5; tags.push(makeTag('#fffbeb', '#d97706', '#fef3c7', '☀️ 普通光线 (+5)'));
            }

            if (typeof visibility === 'number' && visibility < 2000) {
                score += 25; tags.push(makeTag('#faf5ff', '#9333ea', '#f3e8ff', '🌫️ 浓雾梦幻 (+25)'));
            } else if (condition && condition.toLowerCase().includes('snow')) {
                score += 20; tags.push(makeTag('#f0f9ff', '#0284c7', '#e0f2fe', '❄️ 降雪 (+20)'));
            } else if (isRaining) {
                score += 15; tags.push(makeTag('#ecfdf5', '#059669', '#d1fae5', '🌧️ 雨中 (+15)'));
            }

            if (isNight) {
                if (moonPhase < 0.2 && clouds < 20) {
                    score += 15; tags.push(makeTag('#faf5ff', '#9333ea', '#f3e8ff', '✨ 绝佳观星 (+15)'));
                } else if (moonPhase > 0.8 && isCoastal) {
                    score += 10; tags.push(makeTag('#fffbeb', '#d97706', '#fef3c7', '🌕 海上满月 (+10)'));
                }
            }

            // ========== 决定性瞬间提取 ==========
            const decisiveRecommendations = topMatches.slice(0, 2); // 提取前2个神仙瞬间
            const decisiveMomentHtml = decisiveRecommendations.length > 0 
                ? decisiveRecommendations.map(match => `
                    <div style="background: var(--accent-bg); border: 1px solid var(--accent-border); border-radius: 8px; padding: 12px; margin-top: 8px; position: relative; overflow: hidden;">
                        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent-color);"></div>
                        <div style="font-size: 11px; font-weight: 900; color: var(--accent-color); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span>✨</span> 决定性瞬间
                        </div>
                        <div style="font-size: 12px; color: #1e293b; font-weight: 700; line-height: 1.5;">
                            ${match.output}
                        </div>
                    </div>
                `).join('')
                : `<div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 700; margin-top: 8px;">当前时段暂无特殊环境化学反应</div>`;

            // ========== 评级系统 ==========
            score = Math.min(score, 100);
            let grade, vColor, vBg, verdict;
            if (score >= 90) { grade = 'S'; vColor = '#8b5cf6'; vBg = '#f5f3ff'; verdict = '绝佳时刻 (强烈推荐)'; }
            else if (score >= 75) { grade = 'A'; vColor = '#10b981'; vBg = '#ecfdf5'; verdict = '出片率极高 (条件优越)'; }
            else if (score >= 60) { grade = 'B'; vColor = '#f59e0b'; vBg = '#fffbeb'; verdict = '适合记录 (光影普通)'; }
            else { grade = 'C'; vColor = '#ef4444'; vBg = '#fef2f2'; verdict = '建议踩点 (光线较差)'; }

            // 渲染全新结果 UI
            resultDiv.innerHTML = `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin-top: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); --accent-color: ${vColor}; --accent-bg: ${vBg}; --accent-border: ${vColor}30;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-size: 10px; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">综合出片指数</span>
                            <span style="font-weight: 900; color: ${vColor}; font-size: 14px;">🎯 评级: ${grade}</span>
                        </div>
                        <div style="text-align: right; line-height: 0.9;">
                            <span style="font-size: 28px; font-weight: 900; color: ${vColor};">${score}</span>
                            <span style="font-size: 12px; color: #cbd5e1; font-weight: 800;">/100</span>
                        </div>
                    </div>
                    
                    <div style="font-weight: 800; color: #334155; font-size: 12px; margin-bottom: 12px;">
                        ${verdict}
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 10px; margin-bottom: 4px;">
                        ${tags.join('')}
                    </div>

                    ${decisiveMomentHtml}
                </div>
            `;
        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = `<div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; color:#ef4444; font-size:12px; text-align:center; padding:12px; font-weight:800; margin-top: 12px;">⚠️ 卫星数据链路断开或获取超时</div>`;
            if (btn) btn.style.display = 'block'; 
        }
    };
};

// 2. 生成全新界面的 HTML
export const generatePopupContent = (pt, ptId, iconStr, name, desc) => {
    const times = SunCalc.getTimes(new Date(), pt.lat, pt.lon);
    
    const sunrise = formatLocalTimeByLon(times.sunrise, pt.lon); 
    const sunset = formatLocalTimeByLon(times.sunset, pt.lon);
    const goldenHour = formatLocalTimeByLon(times.goldenHour, pt.lon); 
    // SunCalc 字段名为 night（天文昏影终 / 入夜），非 nightStarting
    const blueHourEnd = formatLocalTimeByLon(times.night, pt.lon);

    const evalId = Math.random().toString(36).substr(2, 9);
    const category = pt.category || 'spot';

    return `
        <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif; padding: 4px 2px;">
            
            <div style="margin-bottom: 12px;">
                <b style="font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 6px;">${iconStr} ${name}</b>
                ${desc ? `<div style="font-size: 11px; color: #64748b; margin-top: 6px; background: #f8fafc; padding: 6px 10px; border-radius: 6px; font-weight: 600; line-height: 1.4; border: 1px solid #f1f5f9;">${desc}</div>` : ''}
            </div>
            
            <div style="background: #0f172a; padding: 12px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 12px;">
                <div style="font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 10px; letter-spacing: 0.5px;">🌞 当地绝对光影坐标</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; font-weight: 700;">
                    <div style="background: rgba(255,255,255,0.06); padding: 6px 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 2px;">
                        <span style="color:#64748b; font-size: 10px;">日出</span> 
                        <span style="color:#f8fafc;">${sunrise}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.06); padding: 6px 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 2px;">
                        <span style="color:#64748b; font-size: 10px;">日落</span> 
                        <span style="color:#f8fafc;">${sunset}</span>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); padding: 6px 8px; border-radius: 6px; grid-column: span 2; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color:#fbbf24; font-size: 11px;">✨ 黄金时刻</span> 
                        <span style="color:#fde68a;">${goldenHour} - ${sunset}</span>
                    </div>
                    <div style="background: rgba(56, 189, 248, 0.1); padding: 6px 8px; border-radius: 6px; grid-column: span 2; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color:#38bdf8; font-size: 11px;">🌌 蓝调时刻</span> 
                        <span style="color:#bae6fd;">${sunset} - ${blueHourEnd}</span>
                    </div>
                </div>
            </div>

            <div>
                <button id="btn-${evalId}" onclick="window.__evalPhotoCondition(event, ${pt.lat}, ${pt.lon}, '${evalId}', '${category}')" style="width: 100%; background: #1e293b; color: white; border: 1px solid #334155; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer; transition: background 0.2s; display: flex; justify-content: center; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <span style="font-size: 14px;">🔮</span> 启动双引擎雷达演算
                </button>
                <div id="result-${evalId}"></div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 12px;">
                <a href="https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lon}" target="_blank" style="flex: 1; text-align: center; background: #f1f5f9; color: #475569; padding: 8px 0; border-radius: 8px; font-size: 12px; font-weight: 800; text-decoration: none; border: 1px solid #e2e8f0; transition: background 0.2s;">📍 Google</a>
                <a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(name)}" target="_blank" style="flex: 1; text-align: center; background: #f1f5f9; color: #475569; padding: 8px 0; border-radius: 8px; font-size: 12px; font-weight: 800; text-decoration: none; border: 1px solid #e2e8f0; transition: background 0.2s;">🚃 Yahoo!</a>
            </div>
        </div>
    `;
};