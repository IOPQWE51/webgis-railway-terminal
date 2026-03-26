import SunCalc from 'suncalc';
import { OWM_API_KEY } from '../config/mapConstants';

// 🌐 核心魔法：根据机位所在经度，自动推算该地点的当地时间
const formatLocalTimeByLon = (date, lon) => {
    if (!date || isNaN(date.getTime())) return '--:--';
    
    // 1. 地球每跨越 15 度经度，相差一个时区（四舍五入得出理论时区偏移量）
    const offsetHours = Math.round(lon / 15);
    
    // 2. 将世界协调时间 (UTC) 加上该机位的偏移毫秒数
    const offsetMs = offsetHours * 60 * 60 * 1000;
    const localDate = new Date(date.getTime() + offsetMs);
    
    // 3. 提取出极其精准的“当地”小时与分钟
    const h = String(localDate.getUTCHours()).padStart(2, '0');
    const m = String(localDate.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
};

// 1. 注册全局打分环境
export const initPhotoEvalEngine = () => {
    // 接收 event 对象，用来阻止事件击穿
    window.__evalPhotoCondition = async (event, lat, lon, evalId) => {
        
        // 🛡️ 物理护盾：拦截点击事件，防止穿透到地图导致气泡关闭！
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        const btn = document.getElementById(`btn-${evalId}`);
        const resultDiv = document.getElementById(`result-${evalId}`);
        
        if (!resultDiv) return;
        
        // 优雅处理：隐藏按钮，在下方专属盒子中显示 Loading
        if (btn) btn.style.display = 'none';
        resultDiv.innerHTML = `<div style="text-align:center; padding: 10px; font-size:12px; color:#6b7280; font-weight:bold;"><span style="display:inline-block; animation:spin 1s linear infinite;">⚙️</span> 链接气象卫星分析中...</div>`;

        try {
            if (!OWM_API_KEY || OWM_API_KEY === 'YOUR_API_KEY_HERE') throw new Error("Need API Key");
            
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=zh_cn`);
            const data = await res.json();

            let score = 0; let reasonsHTML = '';
            const clouds = data.clouds?.all || 0; 
            const wind = data.wind?.speed || 0; 
            const vis = data.visibility || 10000;

            // 打分算法开始
            if (clouds >= 30 && clouds <= 70) { score += 4; reasonsHTML += `<div style="color:#10b981; margin-bottom:2px;">✔ 云层极佳 (${clouds}%)：绝佳火烧云条件</div>`; }
            else if (clouds < 30) { score += 2; reasonsHTML += `<div style="color:#f59e0b; margin-bottom:2px;">➖ 晴空万里 (${clouds}%)：日落光线较单调</div>`; }
            else { score += 0; reasonsHTML += `<div style="color:#ef4444; margin-bottom:2px;">✖ 云层过厚 (${clouds}%)：可能遮挡光线</div>`; }

            if (wind < 5) { score += 3; reasonsHTML += `<div style="color:#10b981; margin-bottom:2px;">✔ 微风 (${wind}m/s)：极度适合长曝光与倒影</div>`; }
            else { score += 1; reasonsHTML += `<div style="color:#ef4444; margin-bottom:2px;">✖ 风力较大 (${wind}m/s)：注意三脚架避震</div>`; }

            if (vis >= 10000) { score += 3; reasonsHTML += `<div style="color:#10b981; margin-bottom:2px;">✔ 空气透亮：拥有绝佳的远景视距</div>`; }
            else if (vis > 5000) { score += 2; reasonsHTML += `<div style="color:#f59e0b; margin-bottom:2px;">➖ 能见度一般：建议避开超远摄构图</div>`; }
            else { score += 0; reasonsHTML += `<div style="color:#ef4444; margin-bottom:2px;">✖ 低能见度：仅适合近景特写或赛博夜景</div>`; }

            let verdict = ''; let vColor = '';
            if (score >= 8) { verdict = '强烈推荐前往 (出大片预警)'; vColor = '#10b981'; }
            else if (score >= 6) { verdict = '适合拍摄 (环境条件良好)'; vColor = '#f59e0b'; }
            else { verdict = '不推荐强求 (现场踩点为主)'; vColor = '#ef4444'; }

            // 渲染结果到专属盒子中
            resultDiv.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 12px; margin-top: 5px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); animation: fadeIn 0.3s ease-out;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
                        <span style="font-weight:900; color:#1e293b; font-size:13px;">📸 综合出片指数</span>
                        <span style="font-size:18px; font-weight:900; color:${vColor}; line-height:1;">${score}<span style="font-size:10px; color:#94a3b8;">/10</span></span>
                    </div>
                    <div style="font-weight:900; color:${vColor}; margin-bottom: 8px; font-size: 13px;">🎯 结论: ${verdict}</div>
                    <div style="display:flex; flex-direction:column; font-size:11px; font-weight: bold; background: #ffffff; padding: 6px; border-radius: 4px; border: 1px dashed #cbd5e1;">${reasonsHTML}</div>
                </div>
            `;
        } catch (err) {
            console.error("引擎请求错误:", err);
            resultDiv.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center; padding:10px; font-weight:bold;">⚠️ 气象终端未响应或脱机</div>`;
            if (btn) btn.style.display = 'block'; // 如果报错，把按钮恢复，允许用户重新点击
        }
    };
};

// 2. 生成带光影计算的弹窗 HTML
export const generatePopupContent = (pt, ptId, iconStr, name, desc) => {
    // 调用 SunCalc 获取世界绝对时间
    const times = SunCalc.getTimes(new Date(), pt.lat, pt.lon);
    
    // 强制转换为该机位所在的“当地时间”！
    const sunrise = formatLocalTimeByLon(times.sunrise, pt.lon); 
    const sunset = formatLocalTimeByLon(times.sunset, pt.lon);
    const goldenHour = formatLocalTimeByLon(times.goldenHour, pt.lon); 
    const blueHour = formatLocalTimeByLon(times.nightStarting, pt.lon);

    // 生成绝对安全的 9 位随机字符串 ID，彻底杜绝中文或特殊字符带来的解析问题
    const evalId = Math.random().toString(36).substr(2, 9);

    return `
        <div style="min-width: 220px; font-family: sans-serif; padding-top: 4px;">
            <b style="font-size:16px; color:#1f2937; display:flex; align-items:center; gap:6px;">${iconStr} ${name}</b>
            ${desc ? `<div style="font-size:11px; color:#6b7280; margin: 4px 0 8px 0; background:#f3f4f6; padding:4px 8px; border-radius:4px; font-weight:bold;">${desc}</div>` : ''}
            
            <div style="margin-top: 10px; padding: 10px; background: #1e293b; color: #f8fafc; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 900; color: #38bdf8; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span>🌞 核心光影坐标</span>
                    <span style="font-size: 9px; color: #94a3b8; font-weight: normal; border: 1px solid #475569; padding: 2px 4px; border-radius: 4px;">当地时区</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; font-weight: bold;">
                    <div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.1); padding: 4px 6px; border-radius: 4px;"><span style="color:#94a3b8;">日出</span> <span style="color:#f8fafc;">${sunrise}</span></div>
                    <div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.1); padding: 4px 6px; border-radius: 4px;"><span style="color:#94a3b8;">日落</span> <span style="color:#f8fafc;">${sunset}</span></div>
                    <div style="display: flex; justify-content: space-between; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); padding: 4px 6px; border-radius: 4px; grid-column: span 2;"><span style="color:#fbbf24;">✨ 黄金时刻</span> <span style="color:#fbbf24;">${goldenHour} - ${sunset}</span></div>
                    <div style="display: flex; justify-content: space-between; background: rgba(96, 165, 250, 0.15); border: 1px solid rgba(96, 165, 250, 0.3); padding: 4px 6px; border-radius: 4px; grid-column: span 2;"><span style="color:#60a5fa;">🌌 蓝调时刻</span> <span style="color:#60a5fa;">${sunset} - ${blueHour}</span></div>
                </div>
            </div>

            <div style="margin-top: 10px;">
                <button id="btn-${evalId}" onclick="window.__evalPhotoCondition(event, ${pt.lat}, ${pt.lon}, '${evalId}')" style="width: 100%; background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: white; border: none; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3);">
                    🔮 启动气象出片率分析
                </button>
                <div id="result-${evalId}"></div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 12px;">
                <a href="https://www.google.com/maps?q=${pt.lat},${pt.lon}" target="_blank" style="flex: 1; text-align: center; background-color: #f1f5f9; color: #3b82f6; border: 1px solid #bfdbfe; padding: 8px 0; border-radius: 6px; font-size: 12px; font-weight: 900; text-decoration: none;">📍 Google</a>
                <a href="https://transit.yahoo.co.jp/search/result?to=${encodeURIComponent(name)}" target="_blank" style="flex: 1; text-align: center; background-color: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 8px 0; border-radius: 6px; font-size: 12px; font-weight: 900; text-decoration: none;">🚃 Yahoo!</a>
            </div>

            ${ptId.startsWith('custom') ? `
            <div style="margin-top: 12px; border-top: 1px dashed #e5e7eb; padding-top: 10px;">
                <button onclick="window.__deleteCustomPoint('${pt.id}')" style="background-color: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 6px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; width: 100%;">🗑️ 抹除此机位坐标</button>
            </div>` : ''}
        </div>
    `;
};