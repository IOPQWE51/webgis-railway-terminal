import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, X, Trash2, Ruler, MapPin, Train, Compass, ArrowUpRight, Database, Info, Calculator, Sparkles, Moon, List, Route, PlaneTakeoff } from 'lucide-react';
import TacticalBottomSheet from './TacticalBottomSheet'; // 引入底部详情抽屉

// 导入外部依赖
import ControlPanel from './ControlPanel';
import SearchNavEngine from './SearchNavEngine';
import { initPhotoEvalEngine, generatePopupContent } from '../utils/photoEngine';
import { closeCyberPanel, openCyberPanel } from '../utils/cyberPanel';
import { getPositionByIP } from '../utils/performanceHelpers';
import { REGION_REGISTRY } from '../config/regions';
import TodayCard from './TodayCard';
import RailDirectoryModal from './RailDirectoryModal';
import { buildItineraryDays } from '../utils/itinerary';
import { getIconStyle } from '../utils/helpers';

// 导入核心 Hooks
import { useMapTools } from '../hooks/useMapTools';
import { useMapLayers } from '../hooks/useMapLayers';
import { useTodaySnapshot, fmtCountdown, fmtRemaining } from '../hooks/useTodaySnapshot';

const MapEngine = ({ isActive, customPoints = [], basePoints = [], onDeletePoint, onPointsUpdate, pendingMapTarget = null, onTargetHandled = null, onEnterTactical = null, onSwitchTab = null, onOpenItinerary = null, activeFlightArc = null, onClearFlightArc = null, selectedDate: controlledSelectedDate, onSelectedDateChange = null, skipIpAutoLocate = false }) => {
    // 1. 核心引用与基础状态
    const mapRef = useRef(null);
    const ipLocateDoneRef = useRef(false);
    const userInteractedRef = useRef(false);
    const wheelHintTimerRef = useRef(null);
    const [leafletReady, setLeafletReady] = useState(false);
    const [, setShowDrawer] = useState(false); // 兼容 useMapTools 签名
    const [visitorGeo, setVisitorGeo] = useState(null); // 🌐 IP 自动识别到的访客城市与坐标
    const [focusLabel, setFocusLabel] = useState('全球视野'); // 顶部焦点条当前区域名称
    const [internalSelectedDate, setInternalSelectedDate] = useState(''); // 🗓️ 光影规划日期（空串 = 当地今天）
    const selectedDate = controlledSelectedDate !== undefined ? controlledSelectedDate : internalSelectedDate;
    const setSelectedDate = onSelectedDateChange || setInternalSelectedDate;
    const [selectedPoint, setSelectedPoint] = useState(null); // 📍 当前选中点位（用于分享链接附带机位）
    const [tileLoading, setTileLoading] = useState(false); // 🗺️ 瓦片加载指示
    const [wheelHint, setWheelHint] = useState(false); // 🖱️ 滚轮防误触轻提示
    const [railDirectoryOpen, setRailDirectoryOpen] = useState(false); // 🚆 铁道线路目录弹窗
    const [railDirectoryRegion, setRailDirectoryRegion] = useState('jp');
    
    // 💥 新增：地点详情的底部抽屉状态
    const [bottomSheetHtml, setBottomSheetHtml] = useState(null); 

    const [mapView, setMapView] = useState(null); // 🌅 拍摄简报用的地图中心
    const [baseMapType, setBaseMapType] = useState('topo'); 
    const [weatherType, setWeatherType] = useState('none'); 
    const [filters, setFilters] = useState({ framework: true, azimuth: true, camera: true, station: true, airport: true, anime: true, hotel: true, spot: true });
    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    const itinerarySummary = useMemo(() => buildItineraryDays(customPoints), [customPoints]);

    // 同步当前光影规划日期给地点弹窗（保证底部光影卡与右侧详情卡日期 100% 同源）
    useEffect(() => {
        window.__etSelectedDate = selectedDate;
    }, [selectedDate]);

    const handlePointSelect = useCallback((pt) => {
        setSelectedPoint(pt || null);
        if (pt?.name && !pt.name.startsWith('地图选点')) {
            setFocusLabel(pt.name);
        }
    }, []);

    // 💥 新增：全息雷达监听网络 (接收 cyberPanel 发来的抽屉开启指令)
    useEffect(() => {
        const handleOpenSheet = (e) => setBottomSheetHtml(e.detail);
        const handleCloseSheet = () => {
            setBottomSheetHtml(null);
            setSelectedPoint(null);
        };

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

        // 📥 全局收藏入库信号接收（支持机位拍摄属性 bestTime / focalLength / notes）
        window.__saveToCustomPoints = (name, lat, lon, category, btnElement, meta = {}) => {
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
                source: category === 'camera' ? '地图机位标记' : '雷达手动捕获',
                ...(category === 'camera' ? {
                    bestTime: meta?.bestTime || 'evening',
                    ...(meta?.focalLength?.trim() ? { focalLength: meta.focalLength.trim().slice(0, 32) } : {}),
                    ...(meta?.notes?.trim() ? { notes: meta.notes.trim().slice(0, 240) } : {}),
                } : {})
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
    const tools = useMapTools(leafletReady, mapRef, setShowDrawer, { onPointSelect: handlePointSelect });
    useMapLayers(
        leafletReady,
        mapRef,
        baseMapType,
        weatherType,
        filters,
        customPoints,
        basePoints,
        tools.isMeasuring,
        pendingMapTarget,
        onTargetHandled,
        {
            onTileLoadingChange: setTileLoading,
            onPointSelect: handlePointSelect,
            selectedPoint,
            selectedDate,
            activeFlightArc,
        }
    );

    // 🌅 共享当地天气/天象/附近点位状态（顶部焦点条 + 底部三栏左卡共用单路请求）
    const todaySnapshot = useTodaySnapshot({
        lat: mapView?.lat,
        lng: mapView?.lng,
        selectedDate,
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
                    setMapView({ lat: pos.latitude, lng: pos.longitude, zoom: 9 });
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
    const handleTodayFlyTo = (lat, lon, label = '', zoom = 13) => {
        if (label) setFocusLabel(label);
        setMapView({ lat, lng: lon, zoom });
        mapRef.current?.flyTo([lat, lon], zoom, { duration: 1.2 });
    };

    // 🧭 跳转到已接入的区域交通骨架包（顶部视野精确对齐地图中心城市与天气/光影数据）
    const handleJumpToRegion = (region) => {
        if (!region?.center || !mapRef.current) return;
        userInteractedRef.current = true;
        const z = region.zoom ?? 5.5;
        setFocusLabel(region.centerLabel || region.name);
        setMapView({ lat: region.center[0], lng: region.center[1], zoom: Math.round(z) });
        mapRef.current.flyTo(region.center, z, { duration: 1.2 });
    };

    // 搜索命中时立即同步顶部焦点地名与坐标（不等 1.2s 飞行动画结束，消除短暂显示上一城数据的滞后）
    const handleSearchWithLabel = (lat, lon, fullName, shortName) => {
        setFocusLabel(shortName || fullName?.split(',')[0] || '搜索位置');
        setMapView({ lat, lng: lon, zoom: 14 });
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

    // 🧭 同步当前地图中心与缩放供顶部焦点条、今日光影与按需分享使用；手动拖动时清空陈旧的焦点地名
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const map = mapRef.current;
        let timer = null;
        const sync = () => {
            const c = map.getCenter();
            setMapView({ lat: c.lat, lng: c.lng, zoom: Math.round(map.getZoom()) });
        };
        const debouncedSync = () => { clearTimeout(timer); timer = setTimeout(sync, 220); };
        const onDragEnd = () => {
            setFocusLabel('当前地图中心');
            sync();
        };
        map.on('moveend zoomend', debouncedSync);
        map.on('dragend', onDragEnd);
        sync();
        return () => {
            clearTimeout(timer);
            map.off('moveend zoomend', debouncedSync);
            map.off('dragend', onDragEnd);
        };
    }, [leafletReady]);

    // 🖱️ Google Maps 式滚轮保护：裸滚轮正常滚动页面不误缩地图，按住 Ctrl / ⌘ + 滚轮缩放地图
    useEffect(() => {
        if (!leafletReady || !mapRef.current) return;
        const map = mapRef.current;
        const container = map.getContainer();
        const onWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) map.zoomIn(1);
                else if (e.deltaY > 0) map.zoomOut(1);
                return;
            }
            setWheelHint(true);
            clearTimeout(wheelHintTimerRef.current);
            wheelHintTimerRef.current = setTimeout(() => setWheelHint(false), 1800);
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            clearTimeout(wheelHintTimerRef.current);
            container.removeEventListener('wheel', onWheel);
        };
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
                                onClick={() => handleTodayFlyTo(visitorGeo.lat, visitorGeo.lon, visitorGeo.city, 10)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-paper-3 text-ink-2 hover:text-sora-deep transition-colors"
                                title={`回到 IP 识别城市 ${visitorGeo.city}`}
                            >
                                <MapPin className="w-3 h-3 text-sora" /> {visitorGeo.city}
                            </button>
                        )}
                    </div>

                    <span className="hidden sm:inline text-line" aria-hidden="true">|</span>

                    {/* 实时天气 + 当前/下一光影焦点摘要 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                        {todaySnapshot.isWeatherLoading ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3 font-medium">
                                <Loader2 className="w-3 h-3 animate-spin text-sora" /> 同步当地天气…
                            </span>
                        ) : todaySnapshot.card?.weatherLine ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                                <span aria-hidden="true">{todaySnapshot.card.weatherLine.emoji}</span>
                                <span>{todaySnapshot.zhWeather}</span>
                                <span className="tnum font-mono text-sora-deep">{todaySnapshot.card.weatherLine.tempC}°C</span>
                            </span>
                        ) : (
                            <span className="font-mono text-[11px] text-ink-3">{coordText}</span>
                        )}

                        {!todaySnapshot.isPolar && todaySnapshot.isCustomDate && todaySnapshot.brief ? (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="text-line" aria-hidden="true">·</span>
                                <span className="px-2 py-0.5 rounded-full bg-sora-soft/80 text-sora-deep font-mono text-[11px] font-bold">
                                    📅 {todaySnapshot.activeDateKey}
                                </span>
                                <span className="tnum font-mono text-[11px] text-ink">
                                    🌅 {todaySnapshot.fmtTime(todaySnapshot.brief.sunrise)} / 🌇 {todaySnapshot.fmtTime(todaySnapshot.brief.sunset)}
                                </span>
                            </span>
                        ) : !todaySnapshot.isPolar && todaySnapshot.activeAstro ? (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="text-line" aria-hidden="true">·</span>
                                <span aria-hidden="true">{todaySnapshot.activeAstro.emoji}</span>
                                <span className="font-bold text-ink">{todaySnapshot.activeAstro.label}进行中</span>
                                <span className="tnum px-2 py-0.5 rounded-full bg-kouchou-soft text-ink text-[11px] font-bold">
                                    {fmtRemaining(todaySnapshot.activeAstro.end, todaySnapshot.now)}
                                </span>
                            </span>
                        ) : !todaySnapshot.isPolar && todaySnapshot.nextAstroEffective && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="text-line" aria-hidden="true">·</span>
                                <span aria-hidden="true">{todaySnapshot.nextAstroEffective.emoji}</span>
                                {todaySnapshot.nextAstroEffective.isTomorrow && (
                                    <span className="text-[11px] font-bold text-ink-3">明日</span>
                                )}
                                <span className="tnum font-mono font-bold text-ink">{todaySnapshot.fmtTime(todaySnapshot.nextAstroEffective.at)}</span>
                                <span>{todaySnapshot.nextAstroEffective.label}</span>
                                <span className="tnum px-2 py-0.5 rounded-full bg-kouchou-soft text-ink text-[11px] font-bold">
                                    {fmtCountdown(todaySnapshot.nextAstroEffective.at, todaySnapshot.now)}
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

            {/* ② 纯净通透的地图画布（网格底纹放在外层容器，严禁在 #real-map-container 上绑定动态 className，避免 React 覆盖 Leaflet 动态写入的 .leaflet-container 类） */}
            <div
                className={`relative rounded-3xl overflow-hidden shadow-lift border border-line/90 ${baseMapType === 'dark' ? 'map-canvas-grid-dark' : 'map-canvas-grid'} ${tileLoading ? 'map-canvas-loading' : ''}`}
                style={{ height: 'clamp(440px, 58dvh, 620px)' }}
            >
                <div id="real-map-container" className="w-full h-full z-10"></div>

                {/* 🛰️ 左上角轻量瞬时状态胶囊（瓦片加载中 / 定位反馈 / 滚轮防误触提示，平时完全隐身） */}
                {(tileLoading || tools.locateNotice || wheelHint) && (
                    <div className="absolute top-3.5 left-3.5 z-[1050] flex flex-col items-start gap-1.5 pointer-events-none">
                        {tileLoading && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-2/92 backdrop-blur-md border border-line shadow-sm text-[11px] font-bold text-ink-2">
                                <Loader2 className="w-3 h-3 animate-spin text-sora" /> 地图瓦片加载中…
                            </div>
                        )}
                        {tools.locateNotice && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-2/95 backdrop-blur-md border border-sora/35 shadow-sm text-[11px] font-bold text-ink">
                                <MapPin className="w-3 h-3 text-sora" /> {tools.locateNotice}
                            </div>
                        )}
                        {wheelHint && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink/82 backdrop-blur-md text-[11px] font-bold text-white shadow-sm">
                                按住 Ctrl + 滚轮缩放地图，或用右下角 +/−
                            </div>
                        )}
                    </div>
                )}

                {/* ✈️ 大圆航线悬浮条（从机票页绘制航线时出现，支持一键清除） */}
                {activeFlightArc?.from && activeFlightArc?.to && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1150] flex items-center gap-2.5 bg-paper-2/95 backdrop-blur-md border border-sora/40 rounded-full px-4 py-2 shadow-xl text-xs font-bold text-ink whitespace-nowrap">
                        <PlaneTakeoff className="w-3.5 h-3.5 text-sora shrink-0" />
                        <span>{activeFlightArc.from.code} {activeFlightArc.from.city} → {activeFlightArc.to.code} {activeFlightArc.to.city}</span>
                        {activeFlightArc.stats && (
                            <span className="font-mono text-sora-deep">
                                {activeFlightArc.stats.distanceKm.toLocaleString()} km · {activeFlightArc.stats.durationLabel}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => onClearFlightArc?.()}
                            className="p-1 rounded-full text-ink-3 hover:text-koi hover:bg-koi-soft transition-colors"
                            title="清除航线"
                            aria-label="清除航线"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

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
                        shareView={mapView ? { lat: mapView.lat, lon: mapView.lng, z: mapView.zoom, point: selectedPoint } : null}
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
                {/* 左卡：光影时刻与附近（支持任意日期规划） */}
                <TodayCard
                    snapshot={todaySnapshot}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onFlyTo={handleTodayFlyTo}
                />

                {/* 中卡：全球铁道骨架包切换 + 可展开线路/站点列表（支持 6 大区域紧凑 2 列呈现） */}
                <section className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-between gap-3.5">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                                <Train className="w-4 h-4 text-wakaba" />
                                全球铁道骨架
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRailDirectoryOpen(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-wakaba hover:text-ink bg-wakaba-soft/80 px-2.5 py-1 rounded-full border border-wakaba/30 transition-colors"
                            >
                                <List className="w-3 h-3" /> 线路目录
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {REGION_REGISTRY.map((region) => {
                                const stationCount = region.data?.STATIONS?.length || 0;
                                const lineCount = region.data?.RAILWAY_LINES?.length || 0;
                                return (
                                    <div key={region.id} className="flex items-stretch gap-1 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => handleJumpToRegion(region)}
                                            className="flex-1 min-w-0 text-left px-2.5 py-2 rounded-xl bg-paper-3/70 hover:bg-wakaba-soft/50 border border-line/70 hover:border-wakaba/40 transition-all flex items-center gap-2 group"
                                            title={`${region.name}：${region.description}`}
                                        >
                                            <span className="text-base leading-none shrink-0" aria-hidden="true">{region.icon || '🌍'}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-ink group-hover:text-sora-deep transition-colors truncate">
                                                    {region.name}
                                                </div>
                                                <div className="text-[10px] text-ink-3 truncate">
                                                    {stationCount}站 · {lineCount}线
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setRailDirectoryRegion(region.id); setRailDirectoryOpen(true); }}
                                            className="px-1.5 rounded-xl bg-paper-3/55 hover:bg-sora-soft/50 border border-line/70 text-ink-3 hover:text-sora-deep transition-colors shrink-0 flex items-center justify-center"
                                            title={`按线路查看${region.name}站点列表`}
                                            aria-label={`按线路查看${region.name}站点列表`}
                                        >
                                            <List className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="pt-2.5 border-t border-line/70 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-ink-3">
                        <span>已全面接入 {REGION_REGISTRY.length} 大区域 · {basePoints.length} 枢纽</span>
                        <button
                            type="button"
                            onClick={() => setRailDirectoryOpen(true)}
                            className="text-sora-deep font-bold hover:underline"
                        >
                            查官方时刻表 →
                        </button>
                    </div>
                </section>

                {/* 右卡：行程工作台速览（直达按天编排 + 实时里程摘要） */}
                <section className="bg-paper-2/92 backdrop-blur-md border border-line rounded-3xl p-5 shadow-lift flex flex-col justify-between gap-3.5">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                                <Compass className="w-4 h-4 text-sora" />
                                行程工作台
                            </h3>
                            <span className="text-[10px] font-bold text-sora-deep bg-sora-soft/70 px-2 py-0.5 rounded-full">
                                收藏 {customPoints.length} 点
                            </span>
                        </div>

                        {/* 行程按天编排直达入口 */}
                        <button
                            type="button"
                            onClick={() => (onOpenItinerary ? onOpenItinerary() : onSwitchTab?.('data'))}
                            className="w-full mb-2.5 text-left p-3 rounded-2xl bg-sora-soft/55 hover:bg-sora-soft/80 border border-sora/25 transition-colors flex items-center justify-between gap-2 group"
                        >
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-ink group-hover:text-sora-deep flex items-center gap-1.5">
                                    <Route className="w-3.5 h-3.5 text-sora shrink-0" />
                                    <span>行程按天编排</span>
                                </div>
                                <div className="text-[11px] text-ink-2 mt-0.5 truncate">
                                    {itinerarySummary.scheduledCount > 0
                                        ? `已排 ${itinerarySummary.days.length} 天 · ${itinerarySummary.scheduledCount} 站 · ${itinerarySummary.grandTotalKm.toFixed(1)} km`
                                        : '把收藏点位按天排序并计算段间里程'}
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-sora shrink-0" />
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'data', label: '收藏与导入', icon: Database, hint: 'CSV / GPX' },
                                { id: 'rules', label: '出行指南', icon: Info, hint: '8 国 / 通票估算' },
                                { id: 'tools', label: '汇率换算', icon: Calculator, hint: '参考 + 物价' },
                                { id: 'sub-culture', label: '季节与巡礼', icon: Sparkles, hint: '全球季节 / 巡礼' },
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

                    {onEnterTactical && (
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

            {/* 🚆 铁道骨架按线路展开目录弹窗 */}
            {railDirectoryOpen && (
                <RailDirectoryModal
                    key={railDirectoryRegion}
                    open={railDirectoryOpen}
                    initialRegionId={railDirectoryRegion}
                    customPoints={customPoints}
                    onClose={() => setRailDirectoryOpen(false)}
                    onSelectStation={(st) => {
                        handleTodayFlyTo(st.lat, st.lon, st.name, 12);
                        handlePointSelect({ lat: st.lat, lon: st.lon, name: st.name });
                        openCyberPanel(generatePopupContent(st, `base_${st.id}`, '🛤️', st.name, st.desc));
                    }}
                    onSelectFavorite={(pt) => {
                        const style = getIconStyle(pt.category, pt.source);
                        handleTodayFlyTo(pt.lat, pt.lon, pt.name, 14);
                        handlePointSelect({ lat: pt.lat, lon: pt.lon, name: pt.name });
                        openCyberPanel(generatePopupContent(pt, `custom_${pt.id}`, style.icon, pt.name, pt.source));
                    }}
                />
            )}

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