import { useState, useEffect, useRef } from 'react';
import { Loader2, X, Trash2, Ruler, MapPin } from 'lucide-react';
import TacticalBottomSheet from './TacticalBottomSheet'; // 引入底部详情抽屉

// 导入外部依赖
import ControlPanel from './ControlPanel';
import SearchNavEngine from './SearchNavEngine';
import { initPhotoEvalEngine } from '../utils/photoEngine';
import { closeCyberPanel } from '../utils/cyberPanel';
import { serializeViewHash, OWN_VIEW_FINGERPRINT } from '../utils/urlState';
import { getPositionByIP } from '../utils/performanceHelpers';
import { REGION_REGISTRY } from '../config/regions';
import TodayCard from './TodayCard';

// 导入核心 Hooks
import { useMapTools } from '../hooks/useMapTools';
import { useMapLayers } from '../hooks/useMapLayers';

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint, onPointsUpdate, pendingMapTarget = null, onTargetHandled = null, onEnterTactical = null, skipIpAutoLocate = false }) => {
    // 1. 核心引用与基础状态
    const mapRef = useRef(null);
    const ipLocateDoneRef = useRef(false);
    const userInteractedRef = useRef(false);
    const [leafletReady, setLeafletReady] = useState(false);
    const [, setShowDrawer] = useState(false); // 兼容 useMapTools 签名
    const [visitorGeo, setVisitorGeo] = useState(null); // 🌐 IP 自动识别到的访客城市与坐标
    
    // 💥 新增：地点详情的底部抽屉状态
    const [bottomSheetHtml, setBottomSheetHtml] = useState(null); 

    const [mapView, setMapView] = useState(null); // 🌅 拍摄简报用的地图中心
    const [baseMapType, setBaseMapType] = useState('topo'); 
    const [weatherType, setWeatherType] = useState('none'); 
    const [filters, setFilters] = useState({ framework: true, station: true, airport: true, anime: true, hotel: true, spot: true });
    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    // 💥 新增：全息雷达监听网络 (接收 cyberPanel 发来的抽屉开启指令)
    useEffect(() => {
        const handleOpenSheet = (e) => setBottomSheetHtml(e.detail);
        const handleCloseSheet = () => setBottomSheetHtml(null);

        window.addEventListener('openTacticalBottomSheet', handleOpenSheet);
        window.addEventListener('closeTacticalBottomSheet', handleCloseSheet);

        return () => {
            window.removeEventListener('openTacticalBottomSheet', handleOpenSheet);
            window.removeEventListener('closeTacticalBottomSheet', handleCloseSheet);
        };
    }, []);

    // 2. 初始化核心系统环境
    useEffect(() => {
        initPhotoEvalEngine(); 
        
        // 🗑️ 全局删除信号接收
        window.__deleteCustomPoint = (id) => {
            if (window.confirm('⚠️ 确定删除此坐标点吗？')) {
                if (onDeletePoint) onDeletePoint(id);
                closeCyberPanel(); // 这里也会触发关闭抽屉的事件
            }
        };

        // 📥 全局收藏入库信号接收
        window.__saveToCustomPoints = (name, lat, lon, category, btnElement) => {
            const targetLat = parseFloat(lat);
            const targetLon = parseFloat(lon);

            // 检查是否已存在相同坐标的点位（0.0001度约10米精度）
            const exists = customPoints.some(p =>
                Math.abs(p.lat - targetLat) < 0.0001 &&
                Math.abs(p.lon - targetLon) < 0.0001
            );

            if (exists) {
                if (btnElement) {
                    btnElement.innerHTML = '⚠️ 已存在';
                    btnElement.style.background = '#f59e0b';
                    btnElement.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.4)';
                    btnElement.style.pointerEvents = 'none';
                }
                return;
            }

            const newPt = {
                id: `custom_${Date.now()}`,
                name: name,
                lat: targetLat,
                lon: targetLon,
                category: category,
                source: '雷达手动捕获'
            };

            if (onPointsUpdate) {
                onPointsUpdate([...customPoints, newPt]);
            }

            if (btnElement) {
                btnElement.innerHTML = '✅ 编入成功';
                btnElement.style.background = '#10b981';
                btnElement.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
                btnElement.style.pointerEvents = 'none';
            }
        };

        return () => {
            delete window.__deleteCustomPoint;
            delete window.__evalPhotoCondition;
            delete window.__saveToCustomPoints;
        };
    }, [onDeletePoint, onPointsUpdate, customPoints]);

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

    // ⌨️ 按 Escape 快速关闭右侧地点详情面板，方便回到地图工具栏
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') closeCyberPanel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // 🌐 首次加载按访客网络 IP 自动定位：
    // - 仅监听真实用户指针/滚轮输入来判断"已手动交互"（避免初始化期 zoomstart 误伤）
    // - 使用 animate: false 瞬移，避免 Leaflet 初始化窗口期吞掉平移/缩放动画
    useEffect(() => {
        if (!leafletReady || !mapRef.current || skipIpAutoLocate || ipLocateDoneRef.current) return;
        const map = mapRef.current;
        const container = map.getContainer();
        const markInteracted = () => { userInteractedRef.current = true; };
        container.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
        container.addEventListener('wheel', markInteracted, { once: true, passive: true });
        container.addEventListener('touchstart', markInteracted, { once: true, passive: true });

        let cancelled = false;
        ipLocateDoneRef.current = true;

        getPositionByIP()
            .then((pos) => {
                if (cancelled || !pos || !Number.isFinite(pos.latitude) || !Number.isFinite(pos.longitude)) return;
                const city = pos.city || pos.region || pos.country || '';
                setVisitorGeo({ lat: pos.latitude, lon: pos.longitude, city });
                if (userInteractedRef.current) return;
                const applyIpView = () => {
                    if (cancelled || userInteractedRef.current) return;
                    map.setView([pos.latitude, pos.longitude], 9, { animate: false });
                    setMapView({ lat: pos.latitude, lng: pos.longitude });
                };
                if (map._loaded) {
                    applyIpView();
                } else {
                    map.once('load', applyIpView);
                }
            })
            .catch(() => {
                // IP 定位不可用时静默保持全球概览视角
            });

        return () => {
            cancelled = true;
            container.removeEventListener('pointerdown', markInteracted);
            container.removeEventListener('wheel', markInteracted);
            container.removeEventListener('touchstart', markInteracted);
        };
    }, [leafletReady, skipIpAutoLocate]);

    // 🗓️ 今日去这卡：点击附近点位或区域包快捷跳转
    const handleTodayFlyTo = (lat, lon, zoom = 13) => mapRef.current?.flyTo([lat, lon], zoom, { duration: 1.5 });

    // 🧭 跳转到已接入的区域交通骨架包
    const handleJumpToRegion = (region) => {
        if (!region?.center || !mapRef.current) return;
        userInteractedRef.current = true;
        mapRef.current.flyTo(region.center, region.zoom ?? 5.5, { duration: 1.5 });
    };

    // 🌑 切入 Dark 2D 时把当前主图视角原样带过去
    const handleEnterTacticalWithView = onEnterTactical
        ? () => {
            const map = mapRef.current;
            if (map) {
                const c = map.getCenter();
                onEnterTactical({ lat: c.lat, lon: c.lng, zoom: Math.round(map.getZoom()) });
            } else {
                onEnterTactical(null);
            }
        }
        : null;

    // 🔗 视角深链接：地图移动/缩放后把当前视角写进 URL 哈希
    // 用 replaceState 不产生历史记录，直接复制地址栏即可分享当前视角
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const map = mapRef.current;
        let timer = null;
        const sync = () => {
            const c = map.getCenter();
            setMapView({ lat: c.lat, lng: c.lng });
            const next = serializeViewHash({ lat: c.lat, lon: c.lng, z: map.getZoom() });
            if (window.location.hash !== next) window.history.replaceState(null, '', next);
            // 🏠 同步记本机指纹：下次从收藏夹打开同哈希 = 自家视角，静默恢复不弹分享面板
            try { window.localStorage.setItem(OWN_VIEW_FINGERPRINT, next); } catch { /* 隐私模式忽略 */ }
        };
        const debouncedSync = () => { clearTimeout(timer); timer = setTimeout(sync, 600); };
        map.on('moveend zoomend', debouncedSync);
        sync();
        return () => { clearTimeout(timer); map.off('moveend zoomend', debouncedSync); };
    }, [leafletReady]);

    // 🌌 动态光标引擎
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

    // 5. 渲染视图层（全宽沉浸画布 + 天の川浅色毛玻璃悬浮控件）
    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in fade-in duration-300`}>
            <div className="relative rounded-[1.75rem] overflow-hidden shadow-lift border border-line/90 bg-paper-2" style={{ height: 'calc(100dvh - 104px)', minHeight: '560px' }}>
                <div id="real-map-container" className="w-full h-full z-10" style={{ background: baseMapType === 'dark' ? '#1a1a1a' : '#eef4fa' }}></div>

                {/* 🔍 左上角：只保留极简浅色搜索栏（内置定位），把上半画布留白还给地图 */}
                <div className="absolute top-3.5 left-3.5 z-[1100] w-[min(calc(100%-84px),276px)]">
                    <SearchNavEngine
                        onLocationFound={tools.handleSearchLocationFound}
                        onLocate={tools.locatePlayer}
                        isLocating={tools.isLocating}
                    />
                </div>

                {/* 🧭 左下角：安静的区域骨架与 IP 快捷芯片，不与顶部争抢视线 */}
                <div className="absolute bottom-4 left-3.5 z-[1050] flex flex-wrap items-center gap-1.5 max-w-[calc(100%-96px)]">
                    {visitorGeo?.city && (
                        <button
                            type="button"
                            onClick={() => handleTodayFlyTo(visitorGeo.lat, visitorGeo.lon, 10)}
                            title={`IP 识别城市：${visitorGeo.city}，点击回到附近`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-paper-2/88 hover:bg-paper-2 backdrop-blur-md border border-line/80 shadow-sm text-ink-2 hover:text-sora-deep transition-colors"
                        >
                            <MapPin className="w-3 h-3 text-sora" />
                            <span>{visitorGeo.city}</span>
                        </button>
                    )}
                    {REGION_REGISTRY.map((region) => (
                        region.center && (
                            <button
                                key={region.id}
                                type="button"
                                onClick={() => handleJumpToRegion(region)}
                                title={region.description || `查看${region.name}铁道骨架`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-paper-2/88 hover:bg-paper-2 backdrop-blur-md border border-line/80 shadow-sm text-ink-2 hover:text-ink transition-colors"
                            >
                                <span>{region.icon || '🌍'}</span>
                                <span>{region.name}铁道</span>
                            </button>
                        )
                    ))}
                </div>

                {/* 📏 测距模式悬浮胶囊（浅色毛玻璃 + 暖琥珀提示） */}
                {tools.isMeasuring && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1200] flex items-center bg-paper-2/95 backdrop-blur-md rounded-full shadow-xl border border-kouchou/50 px-3.5 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-2 pr-3">
                            <Ruler className="w-4 h-4 text-kouchou" />
                            <span className="text-ink tnum font-mono font-bold text-sm min-w-[60px] text-center">
                                {tools.measureDistance || '0.00'} <span className="text-[11px] text-ink-3 font-sans">km</span>
                            </span>
                        </div>
                        <div className="w-[1px] h-4 bg-line mx-1"></div>
                        <div className="flex items-center gap-1 pl-1.5">
                            <button
                                type="button"
                                onClick={tools.clearMeasurement}
                                className="p-1.5 rounded-full text-ink-3 hover:text-sora-deep hover:bg-sora-soft/50 transition-colors"
                                title="清除连线"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={tools.exitMeasurement}
                                className="p-1.5 rounded-full text-koi hover:bg-koi-soft transition-colors"
                                title="退出测距"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* 🌤️ 顶部居中：浅色毛玻璃单行光影天气胶囊（默认极轻，点开才展详情） */}
                {mapView && leafletReady && (
                    <TodayCard
                        lat={mapView.lat}
                        lng={mapView.lng}
                        customPoints={customPoints}
                        basePoints={basePoints}
                        onFlyTo={handleTodayFlyTo}
                    />
                )}

                {/* 🧭 右侧悬浮窄轨工具条 */}
                <div className="absolute top-3 right-3 z-[1100]">
                    <ControlPanel
                        baseMapType={baseMapType} setBaseMapType={setBaseMapType}
                        weatherType={weatherType} setWeatherType={setWeatherType}
                        filters={filters} toggleFilter={toggleFilter}
                        onJumpToRegion={handleJumpToRegion}
                        onEnterTactical={handleEnterTacticalWithView}
                        {...tools}
                    />
                </div>

                {/* 💻 PC端：右侧滑出地点详情面板（点地图/搜地点时按需出现，不常驻占地） */}
                <div
                    id="cyber-panel"
                    className="cyber-panel cyber-panel--map-dock hidden"
                    role="dialog"
                    aria-modal="false"
                    aria-hidden="true"
                    aria-label="地点详情"
                >
                    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 bg-white/90 backdrop-blur-md border-b border-slate-100">
                        <button
                            type="button"
                            onClick={() => closeCyberPanel()}
                            className="text-xs font-bold text-slate-500 hover:text-cyan-700 transition-colors"
                        >
                            ← 收起详情
                        </button>
                        <button type="button" className="cyber-panel-close !static !float-none !m-0 !w-7 !h-7 !text-lg" onClick={() => closeCyberPanel()} aria-label="关闭面板">
                            ×
                        </button>
                    </div>
                    <div id="cyber-panel-content" />
                </div>

                {!leafletReady && (
                    <div className="absolute inset-0 bg-paper/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <Loader2 className="w-7 h-7 animate-spin text-sora" />
                    </div>
                )}
            </div>

            {/* 📱 移动端地点详情底部抽屉 */}
            <TacticalBottomSheet
                open={!!bottomSheetHtml}
                htmlContent={bottomSheetHtml}
                onDismiss={() => setBottomSheetHtml(null)}
            />
        </div>
    );
};
export default MapEngine;