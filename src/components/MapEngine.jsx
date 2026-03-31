import { useState, useEffect, useRef } from 'react';
import { Loader2, X, ChevronUp,Trash2, Ruler } from 'lucide-react';

// 导入外部依赖 (配置、渲染面板、打分系统)
import ControlPanel from './ControlPanel'; 
import { initPhotoEvalEngine } from '../utils/photoEngine';
import { closeCyberPanel } from '../utils/cyberPanel';

// 导入核心 Hooks
import { useMapTools } from '../hooks/useMapTools';
import { useMapLayers } from '../hooks/useMapLayers';

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint, onPointsUpdate, pendingMapTarget = null, onTargetHandled = null }) => {
    // 1. 核心引用与基础状态
    const mapRef = useRef(null);
    const [leafletReady, setLeafletReady] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    
    const [baseMapType, setBaseMapType] = useState('topo'); 
    const [weatherType, setWeatherType] = useState('none'); 
    const [filters, setFilters] = useState({ framework: true, station: true, airport: true, anime: true, hotel: true, spot: true });
    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    // 2. 初始化核心系统环境 (增强版：加入全局入库与删除)
    useEffect(() => {
        initPhotoEvalEngine(); 
        
        // 🗑️ 全局删除信号接收
        window.__deleteCustomPoint = (id) => {
            if (window.confirm('⚠️ 确定删除此坐标点吗？')) {
                if (onDeletePoint) onDeletePoint(id);
                closeCyberPanel();
            }
        };

        // 📥 🆕 全局收藏入库信号接收 (这就是我们要加的！)
        window.__saveToCustomPoints = (name, lat, lon, category, btnElement) => {
            const newPt = {
                id: `custom_${Date.now()}`,
                name: name,
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                category: category,
                source: '雷达手动捕获'
            };
            
            // 触发更新，App.jsx 会自动帮你存进 localStorage！
            if (onPointsUpdate) {
                onPointsUpdate(prev => [...prev, newPt]);
            }
            
            // 极客视觉反馈：变绿锁定
            if (btnElement) {
                btnElement.innerHTML = '✅ 编入成功';
                btnElement.style.background = '#10b981'; // 变成翡翠绿
                btnElement.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
                btnElement.style.pointerEvents = 'none'; // 防止连点
            }
        };

        // 卸载时打扫战场
        return () => { 
            delete window.__deleteCustomPoint; 
            delete window.__evalPhotoCondition; 
            delete window.__saveToCustomPoints; // 🧹 清理新增的全局函数
        };
    }, [onDeletePoint, onPointsUpdate]);

    // 3. 异步注入 Leaflet 核心库
    useEffect(() => {
        const init = async () => {
            const urls = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css', 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css'];
            urls.forEach(url => { if (!document.querySelector(`link[href="${url}"]`)) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; document.head.appendChild(link); } });
            if (!window.L) { await new Promise(r => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = r; document.head.appendChild(s); }); }
            if (!window.L.markerClusterGroup) { await new Promise(r => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'; s.onload = r; document.head.appendChild(s); }); }
            setLeafletReady(true);
        }; init();
    }, []);

    // 4. 🪝 启动抽离出的核心 Hooks
    const tools = useMapTools(leafletReady, mapRef, setShowDrawer);
    useMapLayers(leafletReady, mapRef, baseMapType, weatherType, filters, customPoints, basePoints, tools.isMeasuring, pendingMapTarget, onTargetHandled);

    // 处理窗口尺寸变化
    useEffect(() => { if (isActive && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200); }, [isActive]);

    // 🌌 动态光标引擎：黑金重装版 (解决浅色地图不可见问题)
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const container = mapRef.current.getContainer();

        const svgCursor = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 12V8H12" stroke="#1e293b" stroke-width="1.5" stroke-linecap="square"/>
            <path d="M24 12V8H20" stroke="#1e293b" stroke-width="1.5" stroke-linecap="square"/>
            <path d="M8 20V24H12" stroke="#1e293b" stroke-width="1.5" stroke-linecap="square"/>
            <path d="M24 20V24H20" stroke="#1e293b" stroke-width="1.5" stroke-linecap="square"/>
            
            <line x1="16" y1="4" x2="16" y2="10" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="16" y1="22" x2="16" y2="28" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="4" y1="16" x2="10" y2="16" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="22" y1="16" x2="28" y2="16" stroke="#fbbf24" stroke-width="1.5"/>
            
            <circle cx="16" cy="16" r="1.5" fill="#1e293b"/>
            <circle cx="16" cy="16" r="3" stroke="#1e293b" stroke-width="1.5" opacity="0.4"/>
        </svg>`;

        const cyberCrosshair = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgCursor)}') 16 16, crosshair`;

        if (tools.isMeasuring) {
            container.style.cursor = cyberCrosshair;
        } else {
            container.style.cursor = '';
        }
    }, [leafletReady, tools.isMeasuring]);

    // 5. 渲染视图层
    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500`}>
            <div className="flex flex-col lg:flex-row gap-5 relative" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
                
                {/* 左侧/全屏 地图容器 */}
                <div className="flex-1 relative rounded-[2rem] overflow-hidden shadow-2xl border border-gray-200">
                    <div id="real-map-container" className="w-full h-full z-10" style={{ background: baseMapType === 'dark' ? '#1a1a1a' : '#e5e5f7' }}></div>

                    {/* 📏 极简战术 HUD：测距模式专属顶部胶囊 */}
{tools.isMeasuring && (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center bg-zinc-900/90 backdrop-blur-md rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-cyan-500/30 px-3 py-1.5 animate-in slide-in-from-top-2 whitespace-nowrap">
        
        {/* 数据区：尺子图标 + 固定宽度的距离数值 */}
        <div className="flex items-center gap-2 pr-3">
            <Ruler className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-mono font-bold text-sm min-w-[60px] text-center tracking-wider">
                {tools.measureDistance || '0.00'} <span className="text-[10px] text-zinc-400 font-sans">km</span>
            </span>
        </div>

        {/* 分割线 */}
        <div className="w-[1px] h-4 bg-zinc-700 mx-1"></div>

        {/* 操作区：清除与退出 (全图标，零废话) */}
        <div className="flex items-center gap-1 pl-2">
            <button
                onClick={tools.clearMeasurement} // 🗑️ 保持不变，但现在它只会清空线，不会退出模式了！
                className="p-1.5 rounded-full text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition-colors"
                title="清除连线"
            >
                <Trash2 className="w-4 h-4" />
            </button>
            <button
                onClick={tools.exitMeasurement} // 🛑 核心替换：换成咱们刚导出的 exitMeasurement 专用退出函数！
                className="p-1.5 rounded-full text-red-400 hover:text-white hover:bg-red-500/80 transition-colors ml-1"
                title="退出测距"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    </div>
)}

                    <button onClick={() => setShowDrawer(true)} className="lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm border border-zinc-700/50 hover:bg-black transition-all animate-bounce">
                        <ChevronUp className="w-4 h-4 text-cyan-400" /> 呼出战术中枢
                    </button>
                    {!leafletReady && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>}
                </div>

                {/* PC 右侧：空间跃迁 / 战术控制台（340px） */}
                <div className="hidden lg:flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300 relative z-0">
                    <ControlPanel baseMapType={baseMapType} setBaseMapType={setBaseMapType} weatherType={weatherType} setWeatherType={setWeatherType} filters={filters} toggleFilter={toggleFilter} {...tools} />
                </div>

                {/* 地点详情：叠在最右侧战术列上（与控制台同宽、right:0 对齐整行右缘） */}
                <div
                    id="cyber-panel"
                    className="cyber-panel cyber-panel--map-dock hidden"
                    role="dialog"
                    aria-modal="false"
                    aria-hidden="true"
                    aria-label="地点详情"
                >
                    <button type="button" className="cyber-panel-close" onClick={() => closeCyberPanel()} aria-label="关闭面板">
                        ×
                    </button>
                    <div id="cyber-panel-content" />
                </div>

                {/* 移动端底部抽屉 */}
                {showDrawer && (
                    <div className="lg:hidden fixed inset-0 z-[2000] flex flex-col justify-end">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowDrawer(false)}></div>
                        <div className="relative bg-zinc-50 w-full rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-full max-h-[85vh] overflow-y-auto pb-10">
                            <div className="flex justify-between items-center mb-6"><h3 className="font-black text-xl">战术控制中心</h3><button onClick={() => setShowDrawer(false)} className="bg-zinc-200 p-2 rounded-full"><X className="w-5 h-5" /></button></div>
                            <ControlPanel baseMapType={baseMapType} setBaseMapType={setBaseMapType} weatherType={weatherType} setWeatherType={setWeatherType} filters={filters} toggleFilter={toggleFilter} {...tools} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default MapEngine;