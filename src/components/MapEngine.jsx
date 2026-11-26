import { useState, useEffect, useRef } from 'react';
import { Loader2, X, Trash2, Ruler, MapPin, Train, Compass, ArrowUpRight, Database, Info, Calculator, Sparkles, Moon } from 'lucide-react';
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
import { useTodaySnapshot, fmtCountdown } from '../hooks/useTodaySnapshot';

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint, onPointsUpdate, pendingMapTarget = null, onTargetHandled = null, onEnterTactical = null, onSwitchTab = null, skipIpAutoLocate = false }) => {
    // 1. 核心引用与基础状态
    const mapRef = useRef(null);
    const ipLocateDoneRef = useRef(false);
    const userInteractedRef = useRef(false);
    const [leafletReady, setLeafletReady] = useState(false);
    const [, setShowDrawer] = useState(false); // 兼容 useMapTools 签名
    const [visitorGeo, setVisitorGeo] = useState(null); // 🌐 IP 自动识别到的访客城市与坐标
    const [focusLabel, setFocusLabel] = useState('全球视野'); // 顶部焦点条当前区域名称
    
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

    // 🌅 共享当地天气/天象/附近点位状态（顶部焦点条 + 底部三栏左卡共用单路请求）
    const todaySnapshot = useTodaySnapshot({
        lat: mapView?.lat,
        lng: mapView?.lng,
        customPoints,
        basePoints,
    });

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
                    if (city) setFocusLabel(city);
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
        setFocusLabel(`${region.name}铁道骨架`);
        mapRef.current.flyTo(region.center, region.zoom ?? 5.5, { duration: 1.4 });
    };

    // 搜索命中时同步更新顶部焦点地名
    const handleSearchWithLabel = (lat, lon, fullName, shortName) => {
        setFocusLabel(shortName || fullName?.split(',')[0] || '搜索位置');
        tools.handleSearchLocationFound(lat, lon, fullName, shortName);
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

    // 5. 渲染视图层：三段式呼吸感工作台（顶部焦点条 + 纯净地图画布 + 底部三栏中和带）
    const coordText = mapView
        ? `${Math.abs(mapView.lat).toFixed(2)}°${mapView.lat >= 0 ? 'N' : 'S'}, ${Math.abs(mapView.lng).toFixed(2)}°${mapView.lng >= 0 ? 'E' : 'W'}`
        : '准备就绪';

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in fade-in duration-300 space-y-4`}>
            {/* ① 顶部视觉停靠焦点条：第一眼看清当前视野、天气与下一光影时刻，右侧直接搜索/定位 */}
            <div className="bg-paper-2/92 backdrop-blur-md border border-line rounded-2xl px-4 py-3 md:px-5 md:py-3.5 shadow-lift flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                    {/* 当前聚焦位置 */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-sora shadow-[0_0_0_4px_oklch(0.93_0.04_240)]" aria-hidden="true" />
                        <span className="text-xs font-bold text-ink-3">当前视野</span>
                        <span className="text-sm md:text-base font-black text-ink truncate max-w-[180px]">{focusLabel}</span>
                        {visitorGeo?.city && focusLabel !== visitorGeo.city && (
                            <button
                                type="button"
                                onClick={() => { setFocusLabel(visitorGeo.city); handleTodayFlyTo(visitorGeo.lat, visitorGeo.lon, 10); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-paper-3 text-ink-2 hover:text-sora-deep transition-colors"
                                title={`回到 IP 识别城市 ${visitorGeo.city}`}
                            >
                                <MapPin className="w-3 h-3 text-sora" /> {visitorGeo.city}
                            </button>
                        )}
                    </div>

                    <span className="hidden sm:inline text-line" aria-hidden="true">|</span>

                    {/* 实时天气 + 下一光影焦点摘要 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                        {todaySnapshot.card?.weatherLine ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                                <span aria-hidden="true">{todaySnapshot.card.weatherLine.emoji}</span>
                                <span>{todaySnapshot.zhWeather}</span>
                                <span className="tnum font-mono text-sora-deep">{todaySnapshot.card.weatherLine.tempC}°C</span>
                            </span>
                        ) : (
                            <span className="font-mono text-[11px] text-ink-3">{coordText}</span>
                        )}

                        {!todaySnapshot.isPolar && todaySnapshot.card?.nextAstro && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="text-line" aria-hidden="true">·</span>
                                <span aria-hidden="true">{todaySnapshot.card.nextAstro.emoji}</span>
                                <span className="tnum font-mono font-bold text-ink">{todaySnapshot.fmtTime(todaySnapshot.card.nextAstro.at)}</span>
                                <span>{todaySnapshot.card.nextAstro.label}</span>
                                <span className="tnum px-2 py-0.5 rounded-full bg-kouchou-soft text-ink text-[11px] font-bold">
                                    {fmtCountdown(todaySnapshot.card.nextAstro.at, todaySnapshot.now)}
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* 右侧：融入焦点条的轻盈搜索栏（内置定位按钮） */}
                <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0">
                    <SearchNavEngine
                        onLocationFound={handleSearchWithLabel}
                        onLocate={tools.locatePlayer}
                        isLocating={tools.isLocating}
                    />
                </div>
            </div>

            {/* ② 纯净通透的地图画布（清空左上/顶中/左下贴纸，把画面还给地图本身） */}
            <div
                className="relative rounded-3xl overflow-hidden shadow-lift border border-line/90 bg-paper-2"
                style={{ height: 'clamp(440px, 58dvh, 620px)' }}
            >
                <div id="real-map-container" className="w-full h-full z-10" style={{ background: baseMapType === 'dark' ? '#1a1a1a' : '#eef4fa' }}></div>

                {/* 📏 测距模式悬浮胶囊（仅开启测距时出现） */}
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

                {/* 🧭 右侧极简悬浮工具条 */}
                <div className="absolute top-3.5 right-3.5 z-[1100]">
                    <ControlPanel
                        baseMapType={baseMapType} setBaseMapType={setBaseMapType}
                        weatherType={weatherType} setWeatherType={setWeatherType}
                        filters={filters} toggleFilter={toggleFilter}
                        onJumpToRegion={handleJumpToRegion}
                        onEnterTactical={handleEnterTacticalWithView}
                        {...tools}
                    />
                </div>

                {/* 💻 PC端：右侧滑出地点详情面板 */}
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

            {/* ③ 底部三栏平衡中和带：稳住页面重心，让光影、铁道骨架与工作台自然衔接 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 左卡：今日光影与附近 */}
                <TodayCard snapshot={todaySnapshot} onFlyTo={handleTodayFlyTo} />

                {/* 中卡：全球铁道骨架包切换 */}
                <section className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-between gap-3.5">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                                <Train className="w-4 h-4 text-wakaba" />
                                全球铁道骨架
                            </h3>
                            <span className="text-[10px] font-bold text-ink-3 bg-paper-3 px-2 py-0.5 rounded-full border border-line/70">
                                已接入 {REGION_REGISTRY.length} 国
                            </span>
                        </div>
                        <div className="space-y-2">
                            {REGION_REGISTRY.map((region) => {
                                const stationCount = region.data?.STATIONS?.length || 0;
                                const lineCount = region.data?.RAILWAY_LINES?.length || 0;
                                return (
                                    <button
                                        key={region.id}
                                        type="button"
                                        onClick={() => handleJumpToRegion(region)}
                                        className="w-full text-left p-3 rounded-2xl bg-paper-3/70 hover:bg-wakaba-soft/50 border border-line/70 hover:border-wakaba/40 transition-all flex items-center justify-between gap-3 group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-xl leading-none shrink-0" aria-hidden="true">{region.icon || '🌍'}</span>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-ink group-hover:text-sora-deep transition-colors">
                                                    {region.name}铁道骨架
                                                </div>
                                                <div className="text-[11px] text-ink-3 truncate">
                                                    {stationCount} 枢纽 · {lineCount} 条干线
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowUpRight className="w-4 h-4 text-ink-3 group-hover:text-sora-deep shrink-0 transition-colors" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-[11px] text-ink-3 pt-2.5 border-t border-line/70">
                        欧洲 Eurail · 韩国 KTX 等区域骨架持续扩展中
                    </p>
                </section>

                {/* 右卡：行程工作台速览 */}
                <section className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-between gap-3.5">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                                <Compass className="w-4 h-4 text-sora" />
                                行程工作台
                            </h3>
                            <span className="text-[10px] font-bold text-sora-deep bg-sora-soft/70 px-2 py-0.5 rounded-full">
                                收藏 {customPoints.length} 个点位
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'data', label: '收藏与导入', icon: Database, hint: 'CSV / 导出' },
                                { id: 'rules', label: '出行指南', icon: Info, hint: '8 国交通规则' },
                                { id: 'tools', label: '汇率换算', icon: Calculator, hint: '实时 + 物价' },
                                { id: 'sub-culture', label: '巡礼与活动', icon: Sparkles, hint: '圣地 / 花火' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSwitchTab?.(item.id)}
                                    className="text-left p-2.5 rounded-xl bg-paper-3/70 hover:bg-sora-soft/55 border border-line/70 hover:border-sora/35 transition-colors group"
                                >
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink group-hover:text-sora-deep">
                                        <item.icon className="w-3.5 h-3.5 text-sora shrink-0" />
                                        <span>{item.label}</span>
                                    </div>
                                    <div className="text-[10px] text-ink-3 mt-0.5">{item.hint}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {handleEnterTacticalWithView && (
                        <button
                            type="button"
                            onClick={handleEnterTacticalWithView}
                            className="w-full pt-2.5 border-t border-line/70 flex items-center justify-between text-xs font-bold text-ink-2 hover:text-ink transition-colors"
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <Moon className="w-3.5 h-3.5 text-ink-3" /> 切换暗黑专业地图 (Dark 2D)
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-ink-3" />
                        </button>
                    )}
                </section>
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