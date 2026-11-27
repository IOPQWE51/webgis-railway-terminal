// src/utils/photoEngine.js
// 🎬 摄影引擎 v4.0 - 全局宽面板 SaaS 级定制版

import { fetchGlobalEnvironmentData } from './dataGateway'; 
import { convertToRuleFormat } from './ruleDataConverter';
import { getTopSuggestions } from './ruleMatcher';
import { computeShootingBrief, formatLocalDateKey } from './shootingBrief';
import { formatLocalTimeByLon, formatUtcOffsetLabel } from './todayCard';

/**
 * 格式化单个区间为 HH:MM–HH:MM；极区或缺失时返回优雅兜底
 */
const formatIntervalRange = (seg, lon) => {
    if (!seg?.start || !seg?.end) return '—';
    return `${formatLocalTimeByLon(seg.start, lon)}–${formatLocalTimeByLon(seg.end, lon)}`;
};

/**
 * SunCalc 在高纬/极区可能返回 null，数据层降级避免 UI 出现 --:--
 */
const escapeHtml = (str) =>
    String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const BEST_TIME_LABELS = {
    morning: '🌅 推荐朝场',
    evening: '🌇 推荐晚场',
    both: '✨ 朝晚皆宜',
    night: '🌃 夜景蓝调',
};

const getCameraWindowSummary = (bestTime, brief, lon) => {
    const mGold = formatIntervalRange(brief?.morningGolden, lon);
    const eGold = formatIntervalRange(brief?.eveningGolden, lon);
    const eBlue = formatIntervalRange(brief?.eveningBlue, lon);
    if (bestTime === 'morning') return `朝场黄金窗口：${mGold}`;
    if (bestTime === 'evening') return `晚场黄金窗口：${eGold}`;
    if (bestTime === 'night') return `晚场蓝调窗口：${eBlue}`;
    return `朝 ${mGold} · 晚 ${eGold}`;
};

const formatLocalTimeSafe = (date, lon, lat) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        const a = Math.abs(Number(lat) || 0);
        return a >= 62 ? '极昼/极夜' : '—';
    }
    return formatLocalTimeByLon(date, lon);
};

export const initPhotoEvalEngine = () => {
    window.__evalPhotoCondition = async (event, lat, lon, evalId, category = 'spot') => {
        if (event) { event.stopPropagation(); event.preventDefault(); }

        const btn = document.getElementById(`btn-${evalId}`);
        const resultDiv = document.getElementById(`result-${evalId}`);
        if (!resultDiv) return;
        
        if (btn) btn.style.display = 'none';
        
        // 加载动画
        resultDiv.innerHTML = `
            <div style="text-align:center; padding: 24px; background: rgba(255,255,255,0.6); border-radius: 16px; margin-top: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                <div style="font-size:24px; display:inline-block; animation:spin 1s linear infinite; margin-bottom:12px;">🛰️</div>
                <div style="font-size:13px; color:#475569; font-weight:800; letter-spacing:0.5px;">正在分析当地天气、光影与周边环境...</div>
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
            const evalBrief = computeShootingBrief({ lat, lon, date: evalNow });

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

            const inGoldenNow = (evalBrief?.goldenHours || []).some((s) => evalNow >= s.start && evalNow <= s.end);
            const inBlueNow = (evalBrief?.blueHours || []).some((s) => evalNow >= s.start && evalNow <= s.end);
            if (inGoldenNow) {
                score += 25; tags.push(makeTag('#fffbeb', '#d97706', '🌅 黄金时刻 (+25)'));
            } else if (inBlueNow) {
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

// 地点详情面板 HTML（与「今日光影」100% 复用同一套 computeShootingBrief 计算源，展示朝/晚双场并同步日期选择器）
export const generatePopupContent = (pt, ptId, iconStr, name, desc, dateOverride = '') => {
    const lat = pt.lat;
    const lon = pt.lon;
    const activeDate = dateOverride || (typeof window !== 'undefined' && window.__etSelectedDate) || formatLocalDateKey(new Date(), lon);
    const brief = computeShootingBrief({ lat, lon, date: activeDate });

    const sunrise = formatLocalTimeSafe(brief?.sunrise, lon, lat);
    const sunset = formatLocalTimeSafe(brief?.sunset, lon, lat);
    const morningGold = formatIntervalRange(brief?.morningGolden, lon);
    const eveningGold = formatIntervalRange(brief?.eveningGolden, lon);
    const morningBlue = formatIntervalRange(brief?.morningBlue, lon);
    const eveningBlue = formatIntervalRange(brief?.eveningBlue, lon);

    const evalId = Math.random().toString(36).substr(2, 9);
    const category = pt.category || 'spot';
    const utcLabel = formatUtcOffsetLabel(lon);
    const dateLabel = brief?.dateKey || activeDate;
    const isInJapan = lat >= 24 && lat <= 46 && lon >= 122 && lon <= 146;

    // 🆕 新增：判断是否已经是本地收藏的点位（排除搜索结果）
    const isSaved = String(ptId).startsWith('custom_') || String(ptId).startsWith('csv_') || String(ptId).startsWith('manual_');
    const isCameraSpot = category === 'camera';
    const cameraWindowText = isCameraSpot ? getCameraWindowSummary(pt.bestTime || 'both', brief, lon) : '';

    // 👇 下面是带有“加入收藏”面板的详情 HTML
    return `
        <div style="padding: 16px 20px 24px; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column;">
            
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <b style="font-size: 20px; color: #0f172a; display: flex; align-items: center; gap: 8px; letter-spacing: -0.5px;">${iconStr} ${escapeHtml(name)}</b>
                    ${desc ? `<div style="font-size: 13px; color: #64748b; margin-top: 8px; line-height: 1.6; font-weight: 600;">${escapeHtml(desc)}</div>` : ''}
                </div>
                
                ${String(ptId).startsWith('custom_') ? `
                <button 
                    onclick="window.__deleteCustomPoint('${pt.id}')" 
                    style="flex-shrink: 0; margin-left: 12px; background: rgba(239, 68, 68, 0.08); color: #ef4444; border: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; margin-top: 2px;"
                    onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.transform='scale(1.05)'" 
                    onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.transform='scale(1)'"
                    title="删除此收藏点"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
                ` : ''}
            </div>

            ${isCameraSpot ? `
            <div style="background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #fcd34d; border-radius: 14px; padding: 13px 14px; margin-bottom: 16px;">
                <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
                    <span style="font-size: 12px; font-weight: 900; color: #92400e;">📷 机位拍摄窗口 (${escapeHtml(dateLabel)})</span>
                    <span style="font-size: 11px; font-weight: 800; color: #b45309; background: rgba(255,255,255,0.75); padding: 2px 8px; border-radius: 999px;">${BEST_TIME_LABELS[pt.bestTime] || BEST_TIME_LABELS.both}</span>
                </div>
                <div style="font-family: monospace; font-size: 14px; font-weight: 900; color: #78350f; margin-bottom: ${pt.focalLength || pt.notes ? '8px' : '0'};">
                    ✨ ${escapeHtml(cameraWindowText)}
                </div>
                ${(pt.focalLength || pt.notes) ? `
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #78350f; border-top: 1px dashed rgba(180,83,9,0.25); padding-top: 8px;">
                    ${pt.focalLength ? `<div><strong>🎞️ 建议焦段：</strong>${escapeHtml(pt.focalLength)}</div>` : ''}
                    ${pt.notes ? `<div><strong>📝 机位备注：</strong>${escapeHtml(pt.notes)}</div>` : ''}
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <div style="background: linear-gradient(145deg, #0f172a, #1e293b); padding: 18px; border-radius: 16px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.2); margin-bottom: 18px; position: relative; overflow: hidden;">
                <div style="position:absolute; top:-30px; right:-30px; width:100px; height:100px; background:#38bdf8; filter:blur(40px); opacity:0.2; border-radius:50%;"></div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 14px; letter-spacing: 0.5px;">
                    <span>🌞 当地光影时刻</span>
                    <span style="font-family: monospace; color: #38bdf8;">${dateLabel} · ${utcLabel}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; font-weight: 700;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="color:#64748b; font-size: 11px;">日出 Sunrise</span> 
                        <span style="color:#f8fafc; font-size: 16px; font-variant-numeric: tabular-nums;">${sunrise}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="color:#64748b; font-size: 11px;">日落 Sunset</span> 
                        <span style="color:#f8fafc; font-size: 16px; font-variant-numeric: tabular-nums;">${sunset}</span>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); padding: 10px 12px; border-radius: 10px; grid-column: span 2; display: flex; flex-direction: column; gap: 6px;">
                        <span style="color:#fbbf24; font-size: 12px;">✨ 黄金时刻 (-4° ~ +6°)</span> 
                        <div style="display: flex; justify-content: space-between; gap: 8px; font-family: monospace; font-size: 13px; color:#fde68a;">
                            <span><em style="font-style:normal; color:#94a3b8; font-family:sans-serif; font-size:11px; margin-right:4px;">朝</em>${morningGold}</span>
                            <span><em style="font-style:normal; color:#94a3b8; font-family:sans-serif; font-size:11px; margin-right:4px;">晚</em>${eveningGold}</span>
                        </div>
                    </div>
                    <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); padding: 10px 12px; border-radius: 10px; grid-column: span 2; display: flex; flex-direction: column; gap: 6px;">
                        <span style="color:#38bdf8; font-size: 12px;">🌌 蓝调时刻 (-6° ~ -4°)</span> 
                        <div style="display: flex; justify-content: space-between; gap: 8px; font-family: monospace; font-size: 13px; color:#bae6fd;">
                            <span><em style="font-style:normal; color:#94a3b8; font-family:sans-serif; font-size:11px; margin-right:4px;">朝</em>${morningBlue}</span>
                            <span><em style="font-style:normal; color:#94a3b8; font-family:sans-serif; font-size:11px; margin-right:4px;">晚</em>${eveningBlue}</span>
                        </div>
                    </div>
                </div>
            </div>

            ${!isSaved ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; gap: 8px;">
                    <select id="save-cat-${evalId}" onchange="var ex=document.getElementById('cam-extra-${evalId}'); if(ex) ex.style.display=this.value==='camera'?'grid':'none';" style="flex: 1; background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; font-size: 13px; font-weight: 700; color: #475569; outline: none; cursor: pointer;">
                        <option value="spot">📍 地标</option>
                        <option value="camera">📷 机位</option>
                        <option value="station">🚉 车站</option>
                        <option value="airport">✈️ 机场</option>
                        <option value="hotel">🏨 住宿</option>
                        <option value="anime">🌸 巡礼</option>
                    </select>
                    <button 
                        onclick="if(window.__saveToCustomPoints) window.__saveToCustomPoints('${name.replace(/'/g, "\\'")}', ${lat}, ${lon}, document.getElementById('save-cat-${evalId}').value, this, { bestTime: document.getElementById('cam-time-${evalId}')?.value || '', focalLength: document.getElementById('cam-focal-${evalId}')?.value || '', notes: document.getElementById('cam-notes-${evalId}')?.value || '' })" 
                        style="flex: 1; background: #0f172a; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(15,23,42,0.15); display: flex; justify-content: center; align-items: center;"
                        onmousedown="this.style.transform='scale(0.96)'" 
                        onmouseup="this.style.transform='scale(1)'" 
                        onmouseleave="this.style.transform='scale(1)'"
                    >
                        ⭐ 加入收藏
                    </button>
                </div>
                <div id="cam-extra-${evalId}" style="display: none; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
                    <select id="cam-time-${evalId}" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; font-size: 12px; font-weight: 700; color: #475569; outline: none;">
                        <option value="evening">🌇 推荐晚场</option>
                        <option value="morning">🌅 推荐朝场</option>
                        <option value="both">✨ 朝晚皆宜</option>
                        <option value="night">🌃 夜景蓝调</option>
                    </select>
                    <input id="cam-focal-${evalId}" type="text" placeholder="建议焦段 如 24-70mm" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; font-size: 12px; color: #0f172a; outline: none;" />
                    <input id="cam-notes-${evalId}" type="text" placeholder="机位备注（机位朝向/三脚架/交通贴士）" style="grid-column: span 2; background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 8px; font-size: 12px; color: #0f172a; outline: none;" />
                </div>
            </div>
            ` : ''}

            <div style="margin-bottom: 8px;">
                <button id="btn-${evalId}" onclick="window.__evalPhotoCondition(event, ${pt.lat}, ${pt.lon}, '${evalId}', '${category}')" style="width: 100%; background: #0f172a; color: white; border: none; padding: 14px; border-radius: 14px; font-size: 14px; font-weight: 800; cursor: pointer; transition: transform 0.1s, box-shadow 0.2s; box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25); display: flex; justify-content: center; align-items: center; gap: 8px;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
                    <span style="font-size: 16px;">📷</span> 评估当前拍摄条件
                </button>
                <div id="result-${evalId}"></div>
            </div>

            <div style="display: flex; gap: 12px; padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 12px;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lon}" target="_blank" rel="noreferrer" style="flex: 1; text-align: center; background: white; color: #334155; padding: 12px 0; border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #cbd5e1;">📍 Google 导航</a>
                ${isInJapan
                    ? `<a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(name)}" target="_blank" rel="noreferrer" style="flex: 1; text-align: center; background: white; color: #334155; padding: 12px 0; border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #cbd5e1;">🚃 Yahoo 乘换</a>`
                    : `<a href="https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lon}&travelmode=transit" target="_blank" rel="noreferrer" style="flex: 1; text-align: center; background: white; color: #334155; padding: 12px 0; border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #cbd5e1;">🚆 公共交通路线</a>`
                }
            </div>
        </div>
    `;
};