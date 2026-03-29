// src/utils/photoEngine.js
// 🎬 摄影引擎 v4.0 - 全局宽面板 SaaS 级定制版

import SunCalc from 'suncalc';
import { fetchGlobalEnvironmentData } from './dataGateway'; 
import { convertToRuleFormat } from './ruleDataConverter';
import { getTopSuggestions } from './ruleMatcher';

const formatLocalTimeByLon = (date, lon) => {
    if (!date || isNaN(date.getTime())) return '--:--';
    const offsetHours = Math.round(lon / 15);
    const offsetMs = offsetHours * 60 * 60 * 1000;
    const localDate = new Date(date.getTime() + offsetMs);
    const h = String(localDate.getUTCHours()).padStart(2, '0');
    const m = String(localDate.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

/**
 * SunCalc 在高纬/极区可能返回 Invalid Date，或跨日时刻导致格式化失败。
 * 数据层降级：无效则显示固定文案，避免 UI 出现 --:--。
 */
const formatLocalTimeByLonSafe = (date, lon, lat) => {
    if (date == null || !(date instanceof Date) || Number.isNaN(date.getTime())) {
        const a = Math.abs(Number(lat) || 0);
        return a >= 62 ? '极昼无终点' : '持续至次日';
    }
    const s = formatLocalTimeByLon(date, lon);
    if (s === '--:--') {
        const a = Math.abs(Number(lat) || 0);
        return a >= 62 ? '极昼无终点' : '持续至次日';
    }
    return s;
};

export const initPhotoEvalEngine = () => {
    window.__evalPhotoCondition = async (event, lat, lon, evalId, category = 'spot') => {
        if (event) { event.stopPropagation(); event.preventDefault(); }

        const btn = document.getElementById(`btn-${evalId}`);
        const resultDiv = document.getElementById(`result-${evalId}`);
        if (!resultDiv) return;
        
        if (btn) btn.style.display = 'none';
        
        // 极客加载动画
        resultDiv.innerHTML = `
            <div style="text-align:center; padding: 24px; background: rgba(255,255,255,0.6); border-radius: 16px; margin-top: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                <div style="font-size:24px; display:inline-block; animation:spin 1s linear infinite; margin-bottom:12px;">🛰️</div>
                <div style="font-size:13px; color:#475569; font-weight:800; letter-spacing:1px;">双引擎雷达深度扫描中...</div>
            </div>
            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        `;

        try {
            const rawEnvData = await fetchGlobalEnvironmentData(lat, lon);
            const standardData = convertToRuleFormat(rawEnvData, lat, lon);
            if (category && !standardData.category.includes(category)) {
                standardData.category.push(category);
            }
            const topMatches = getTopSuggestions(standardData, 5, { minScore: 0 });

            if (!rawEnvData.weather || typeof rawEnvData.weather !== 'object') {
                throw new Error('气象节点无响应');
            }

            const evalNow = new Date(rawEnvData.astronomy.now);
            const scTimes = SunCalc.getTimes(evalNow, lat, lon);

            const { season } = rawEnvData.climate;
            const weather = rawEnvData.weather;
            const { condition, clouds, temp } = weather;
            const precip = weather.precip ?? 0;
            const visibility = weather.visibility ?? 10000;
            const isRaining =
                /rain|drizzle|shower|暴雨|雨/i.test(String(condition || '')) || precip > 0.5;
            const { moonPhase, isNight } = rawEnvData.astronomy;
            const poiTypes = rawEnvData.terrain?.poiTypes || [];
            const isCoastal = poiTypes.includes('coast') || poiTypes.includes('beach');

            let score = 50;
            let tags = [];

            const makeTag = (bg, color, text) =>
                `<span style="background:${bg}; color:${color}; padding:6px 10px; border-radius:8px; font-weight:800; font-size:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">${text}</span>`;

            // NOAA OVATION 格点强度（与 ruleDataConverter requiresGeomagneticActivity 阈值一致）
            const auroraProb = Number(rawEnvData.aurora?.probability) || 0;
            if (isNight && auroraProb >= 8) {
                score += 50;
                tags.unshift(
                    makeTag('#2e1065', '#d8b4fe', `🌌 极光活动预警 (OVATION ${auroraProb})`)
                );
            }

            const seasonLabels = { spring: '🌸 春', summer: '🌿 夏', autumn: '🍁 秋', winter: '❄️ 冬', wet: '☔ 雨季', dry: '☀️ 旱季' };
            tags.push(makeTag('#f1f5f9', '#475569', seasonLabels[season] || '🌍 当前季'));
            if (temp !== undefined) tags.push(makeTag('#fef2f2', '#ef4444', `🌡️ ${temp}°C`));

            if (evalNow >= scTimes.goldenHour && evalNow <= scTimes.sunset) {
                score += 25; tags.push(makeTag('#fffbeb', '#d97706', '🌅 黄金时刻 (+25)'));
            } else if (evalNow >= scTimes.sunset && evalNow <= scTimes.night) {
                score += 20; tags.push(makeTag('#eff6ff', '#2563eb', '🌌 蓝调时刻 (+20)'));
            } else if (clouds > 70 && !isRaining) {
                score += 15; tags.push(makeTag('#f8fafc', '#64748b', '☁️ 阴天柔光 (+15)'));
            } else {
                score += 5; tags.push(makeTag('#fffbeb', '#d97706', '☀️ 普通光线 (+5)'));
            }

            if (visibility < 2000) {
                score += 25; tags.push(makeTag('#faf5ff', '#9333ea', '🌫️ 浓雾梦幻 (+25)'));
            } else if (condition && String(condition).toLowerCase().includes('snow')) {
                score += 20; tags.push(makeTag('#f0f9ff', '#0284c7', '❄️ 降雪 (+20)'));
            } else if (isRaining) {
                score += 15; tags.push(makeTag('#ecfdf5', '#059669', '🌧️ 雨中 (+15)'));
            }

            if (isNight) {
                if (moonPhase < 0.2 && clouds < 20) {
                    score += 15; tags.push(makeTag('#faf5ff', '#9333ea', '✨ 绝佳观星 (+15)'));
                } else if (moonPhase > 0.8 && isCoastal) {
                    score += 10; tags.push(makeTag('#fffbeb', '#d97706', '🌕 海上满月 (+10)'));
                }
            }

            const decisiveRecommendations = topMatches.slice(0, 2);

            score = Math.min(score, 100);
            let grade, vColor, vBg, verdict;
            if (score >= 90) { grade = 'S'; vColor = '#8b5cf6'; vBg = '#f5f3ff'; verdict = '绝佳时刻，光影与气象产生完美化学反应，建议立刻出机！'; }
            else if (score >= 75) { grade = 'A'; vColor = '#10b981'; vBg = '#ecfdf5'; verdict = '出片率极高，当前环境条件非常优越。'; }
            else if (score >= 60) { grade = 'B'; vColor = '#f59e0b'; vBg = '#fffbeb'; verdict = '光线环境普通，适合记录性打卡拍摄。'; }
            else { grade = 'C'; vColor = '#ef4444'; vBg = '#fef2f2'; verdict = '不推荐强求，建议现场踩点或等待更好时机。'; }

            resultDiv.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.04); margin-top: 16px; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: ${vColor}; filter: blur(45px); opacity: 0.15; border-radius: 50%;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; position: relative; z-index: 10;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <span style="font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">综合出片指数</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="background: ${vBg}; color: ${vColor}; padding: 4px 12px; border-radius: 8px; font-weight: 900; font-size: 18px;">${grade}</span>
                                <span style="font-weight: 800; color: #334155; font-size: 14px;">级推荐</span>
                            </div>
                        </div>
                        <div style="text-align: right; line-height: 0.8;">
                            <span style="font-size: 46px; font-weight: 900; color: ${vColor}; letter-spacing: -2px;">${score}</span>
                            <span style="font-size: 14px; color: #cbd5e1; font-weight: 800;">/100</span>
                        </div>
                    </div>
                    
                    <div style="font-weight: 700; color: #475569; font-size: 13px; margin-bottom: 20px; line-height: 1.6; position: relative; z-index: 10;">
                        ${verdict}
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; position: relative; z-index: 10;">
                        ${tags.join('')}
                    </div>
                </div>

                ${decisiveRecommendations.length > 0 ? `
                    <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
                        ${decisiveRecommendations.map(match => `
                            <div style="background: white; border-left: 4px solid ${vColor}; border-radius: 12px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                                <div style="font-size: 12px; font-weight: 900; color: ${vColor}; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                    <span>✨</span> 决定性瞬间预警
                                </div>
                                <div style="font-size: 13px; color: #1e293b; font-weight: 700; line-height: 1.6;">
                                    ${match.output}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = `<div style="background: white; border-left: 4px solid #ef4444; border-radius: 12px; color:#ef4444; font-size:13px; padding:16px; font-weight:800; margin-top: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">⚠️ 卫星数据链路断开或获取超时</div>`;
            if (btn) btn.style.display = 'flex'; 
        }
    };
};

export const generatePopupContent = (pt, ptId, iconStr, name, desc) => {
    const times = SunCalc.getTimes(new Date(), pt.lat, pt.lon);
    const lat = pt.lat;
    const lon = pt.lon;

    // 日出/日落/黄金：防御性格式化
    const sunrise = formatLocalTimeByLonSafe(times.sunrise, lon, lat);
    const sunset = formatLocalTimeByLonSafe(times.sunset, lon, lat);
    const goldenHour = formatLocalTimeByLonSafe(times.goldenHour, lon, lat);
    // 蓝调结束：SunCalc 为民用昏线终（太阳高度 -6°），非 night（-18°）。旧代码误用不存在的 nightStarting。
    const blueHourEnd = formatLocalTimeByLonSafe(times.dusk, lon, lat);

    const evalId = Math.random().toString(36).substr(2, 9);
    const category = pt.category || 'spot';

    return `
        <div style="padding: 24px 20px; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column;">
            
            <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <b style="font-size: 22px; color: #0f172a; display: flex; align-items: center; gap: 8px; letter-spacing: -0.5px;">${iconStr} ${name}</b>
                    ${desc ? `<div style="font-size: 13px; color: #64748b; margin-top: 10px; line-height: 1.6; font-weight: 600;">${desc}</div>` : ''}
                </div>
                
                ${String(ptId).startsWith('custom_') ? `
                <button 
                    onclick="window.__deleteCustomPoint('${pt.id}')" 
                    style="flex-shrink: 0; margin-left: 12px; background: rgba(239, 68, 68, 0.08); color: #ef4444; border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; margin-top: 2px;"
                    onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.transform='scale(1.05)'" 
                    onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.transform='scale(1)'"
                    title="删除此坐标点"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
                ` : ''}
            </div>
            
            <div style="background: linear-gradient(145deg, #0f172a, #1e293b); padding: 20px; border-radius: 16px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.2); margin-bottom: 20px; position: relative; overflow: hidden;">
                <div style="position:absolute; top:-30px; right:-30px; width:100px; height:100px; background:#38bdf8; filter:blur(40px); opacity:0.2; border-radius:50%;"></div>
                
                <div style="font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 16px; letter-spacing: 1px; text-transform: uppercase;">🌞 Absolute Solar Time</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; font-weight: 700;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="color:#64748b; font-size: 11px;">日出 Sunrise</span> 
                        <span style="color:#f8fafc; font-size: 16px;">${sunrise}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="color:#64748b; font-size: 11px;">日落 Sunset</span> 
                        <span style="color:#f8fafc; font-size: 16px;">${sunset}</span>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); padding: 10px 12px; border-radius: 10px; grid-column: span 2; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color:#fbbf24; font-size: 13px;">✨ 黄金时刻</span> 
                        <span style="color:#fde68a; font-size: 14px;">${goldenHour} - ${sunset}</span>
                    </div>
                    <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); padding: 10px 12px; border-radius: 10px; grid-column: span 2; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color:#38bdf8; font-size: 13px;">🌌 蓝调时刻</span> 
                        <span style="color:#bae6fd; font-size: 14px;">${sunset} - ${blueHourEnd}</span>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 8px;">
                <button id="btn-${evalId}" onclick="window.__evalPhotoCondition(event, ${pt.lat}, ${pt.lon}, '${evalId}', '${category}')" style="width: 100%; background: #0f172a; color: white; border: none; padding: 16px; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; transition: transform 0.1s, box-shadow 0.2s; box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25); display: flex; justify-content: center; align-items: center; gap: 8px;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
                    <span style="font-size: 18px;">🔮</span> 启动全息雷达扫描
                </button>
                <div id="result-${evalId}"></div>
            </div>

            <div style="display: flex; gap: 12px; padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 12px;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lon}" target="_blank" style="flex: 1; text-align: center; background: white; color: #334155; padding: 12px 0; border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #cbd5e1;">📍 Google 导航</a>
                <a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(name)}" target="_blank" style="flex: 1; text-align: center; background: white; color: #334155; padding: 12px 0; border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #cbd5e1;">🚃 Yahoo 乘换</a>
            </div>
        </div>
    `;
};