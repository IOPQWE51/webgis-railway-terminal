import { useState, useEffect, useRef } from 'react';
import { Loader2, X, ChevronUp } from 'lucide-react';

// 导入外部依赖 (配置、渲染面板、打分系统)
import ControlPanel from './ControlPanel'; 
import { initPhotoEvalEngine } from '../utils/photoEngine';
import { closeCyberPanel } from '../utils/cyberPanel';

// 导入核心 Hooks
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

    // 2. 初始化核心系统环境
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
    useMapLayers(leafletReady, mapRef, baseMapType, weatherType, filters, customPoints, basePoints, tools.isMeasuring);

    // 处理窗口尺寸变化
    useEffect(() => { if (isActive && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200); }, [isActive]);

    // 🌌 新增：动态光标引擎 (测距模式强制替换为顶级战术 HUD 准星)
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const container = mapRef.current.getContainer();

        // 幽灵狙击 HUD 准星 (32x32)：赛博青外框 + 极光紫十字 + 纯白像素准心
        const cyberCrosshair = `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNOCAxMlY4SDEyIiBzdHJva2U9IiMyMmQzZWUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0ic3F1YXJlIi8+PHBhdGggZD0iTTI0IDEyVjhIMjAiIHN0cm9rZT0iIzIyZDNlZSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJzcXVhcmUiLz48cGF0aCBkPSJNOCAyMFYyNEgxMiIgc3Ryb2tlPSIjMjJkM2VlIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InNxdWFyZSIvPjxwYXRoIGQ9Ik0yNCAyMFYyNEgyMCIgc3Ryb2tlPSIjMjJkM2VlIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InNxdWFyZSIvPjxsaW5lIHgxPSIxNiIgeTE9IjQiIHgyPSIxNiIgeTI9IjEwIiBzdHJva2U9IiNhODU1ZjciIHN0cm9rZS13aWR0aD0iMS41Ii8+PGxpbmUgeDE9IjE2IiB5MT0iMjIiIHgyPSIxNiIgeTI9IjI4IiBzdHJva2U9IiNhODU1ZjciIHN0cm9rZS13aWR0aD0iMS41Ii8+PGxpbmUgeDE9IjQiIHkxPSIxNiIgeDI9IjEwIiB5Mj0iMTYiIHN0cm9rZT0iI2E4NTVmNyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48bGluZSB4MT0iMjIiIHkxPSIxNiIgeDI9IjI4IiB5Mj0iMTYiIHN0cm9rZT0iI2E4NTVmNyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxLjUiIGZpbGw9IiNmZmZmZmYiLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIzIiBzdHJva2U9IiMyMmQzZWUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC42Ii8+PC9zdmc+') 16 16, crosshair`;

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

                    <button onClick={() => setShowDrawer(true)} className="lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm border border-zinc-700/50 hover:bg-black transition-all animate-bounce">
                        <ChevronUp className="w-4 h-4 text-cyan-400" /> 呼出战术中枢
                    </button>
                    {!leafletReady && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>}
                </div>

                {/* PC 右侧控制台 */}
                <div className="hidden lg:flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300 relative z-0">
                    <ControlPanel baseMapType={baseMapType} setBaseMapType={setBaseMapType} weatherType={weatherType} setWeatherType={setWeatherType} filters={filters} toggleFilter={toggleFilter} {...tools} />
                </div>

                {/* 地点详情 Panel */}
                <div id="cyber-panel" className="cyber-panel cyber-panel--map-dock hidden" role="dialog" aria-modal="false" aria-hidden="true" aria-label="地点详情">
                    <button type="button" className="cyber-panel-close" onClick={() => closeCyberPanel()} aria-label="关闭面板">×</button>
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