import { useState, useEffect, useRef } from 'react';
import { Loader2, X, ChevronUp } from 'lucide-react';

// 导入外部依赖 (配置、渲染面板、打分系统)
import ControlPanel from './ControlPanel'; 
import { initPhotoEvalEngine } from '../utils/photoEngine';
import { closeCyberPanel } from '../utils/cyberPanel';

// 导入我们刚写好的核心 Hooks
import { useMapTools } from '../hooks/useMapTools';
import { useMapLayers } from '../hooks/useMapLayers';

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint }) => {
    // 1. 核心引用与基础状态
    const mapRef = useRef(null);
    const [leafletReady, setLeafletReady] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    
    const [baseMapType, setBaseMapType] = useState('topo'); 
    const [weatherType, setWeatherType] = useState('none'); 
    const [filters, setFilters] = useState({ framework: true, station: true, airport: true, anime: true, hotel: true, spot: true });
    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    // 2. 初始化核心系统环境 (挂载打分引擎与删除功能)
    useEffect(() => {
        initPhotoEvalEngine(); 
        window.__deleteCustomPoint = (id) => {
            if (window.confirm('⚠️ 确定删除此坐标点吗？')) {
                if (onDeletePoint) onDeletePoint(id);
                closeCyberPanel();
            }
        };
        return () => { delete window.__deleteCustomPoint; delete window.__evalPhotoCondition; };
    }, [onDeletePoint]);

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
    useMapLayers(leafletReady, mapRef, baseMapType, weatherType, filters, customPoints, basePoints);

    // 处理窗口尺寸变化
    useEffect(() => { if (isActive && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200); }, [isActive]);

    // 5. 渲染视图层
    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500`}>
            <div className="flex flex-col lg:flex-row gap-5 relative" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
                
                {/* 左侧/全屏 地图容器 */}
                <div className="flex-1 relative rounded-[2rem] overflow-hidden shadow-2xl border border-gray-200">
                    <div id="real-map-container" className="w-full h-full z-10" style={{ background: baseMapType === 'dark' ? '#1a1a1a' : '#e5e5f7' }}></div>
                    
                    {/* 🎯 赛博全息机械准星 (绝对居中，无视鼠标点击穿透) */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none flex items-center justify-center opacity-80 transition-opacity duration-300 hover:opacity-100">
                        {/* 外圈雷达 */}
                        <div className="w-10 h-10 border-2 border-cyan-400/80 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                            {/* 内核光点 */}
                            <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full shadow-[0_0_10px_#fff] animate-pulse"></div>
                        </div>
                        {/* 机械十字线 */}
                        <div className="absolute w-16 h-[2px] bg-cyan-400/60 shadow-[0_0_8px_#22d3ee]"></div>
                        <div className="absolute h-16 w-[2px] bg-cyan-400/60 shadow-[0_0_8px_#22d3ee]"></div>
                    </div>
                    {/* 👆 准星代码结束 */}


                    <button onClick={() => setShowDrawer(true)} className="lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm border border-zinc-700/50 hover:bg-black transition-all animate-bounce">
                        <ChevronUp className="w-4 h-4 text-cyan-400" /> 呼出战术中枢
                    </button>
                    {!leafletReady && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>}
                </div>

                {/* PC 右侧控制台（POI 详情层叠在此列之上） */}
                <div className="hidden lg:flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300 relative z-0">
                    <ControlPanel baseMapType={baseMapType} setBaseMapType={setBaseMapType} weatherType={weatherType} setWeatherType={setWeatherType} filters={filters} toggleFilter={toggleFilter} {...tools} />
                </div>

                {/* 地点详情：大屏盖住右侧战术列；小屏为 viewport 底部抽屉 */}
                <div
                    id="cyber-panel"
                    className="cyber-panel cyber-panel--map-dock hidden"
                    role="dialog"
                    aria-modal="false"
                    aria-hidden="true"
                    aria-label="地点详情"
                >
                    <button
                        type="button"
                        className="cyber-panel-close"
                        onClick={() => closeCyberPanel()}
                        aria-label="关闭面板"
                    >
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