import { lazy, Suspense, useState, useEffect } from 'react';
import { MapIcon, Database, Info, Calculator, Sparkles, PlaneTakeoff, CloudFog, User } from 'lucide-react';
import { MapEngine, DataCenter, ExchangeEngine, RulesTab, HanabiRadar, AviationEngine, PilgrimageRadar } from './components';
import { BASE_POINTS_CONFIG } from './config/regions';
import ErrorBoundary from './components/ErrorBoundary';
import LoginOverlay from './components/auth/LoginOverlay.jsx';

// 🛫 暗黑专业地图整棵子树（MapTactical → MapboxMapTactical → mapbox-gl ≈ 1.7MB）
// 按需加载：不进首屏 bundle，首次切入 Dark 2D 模式时才拉取异步块
const MapTactical = lazy(() => import('./pages/MapTactical'));
// 🛠️ 导入工具函数
import { parseViewHash, shouldRestoreSharedView, isOwnDeviceView } from './utils/urlState';
import { usePoints } from './hooks/usePoints';

const App = () => {
    const [activeTab, setActiveTab] = useState('map');
    const [pendingMapTarget, setPendingMapTarget] = useState(null); // 🆕 待定位的地点
    const [isTacticalMode, setIsTacticalMode] = useState(false); // 🎯 暗黑专业地图模式状态
    const [tacticalInitialView, setTacticalInitialView] = useState(null); // 切入 Dark 2D 时继承主图视角
    const [accountMenuOpen, setAccountMenuOpen] = useState(false); // 顶栏账号快捷菜单
    const [authOverlayOpen, setAuthOverlayOpen] = useState(false);
    const [dataSubView, setDataSubView] = useState('library'); // 收藏与导入子视图：'library' | 'itinerary'
    // 记录首屏是否携带坐标分享链接（若携带则优先还原链接视角，不被 IP 自动定位覆盖）
    const [hasInitialHashView] = useState(() => {
        const view = parseViewHash(window.location.hash);
        return Boolean(view && view.lat !== null && view.lon !== null);
    });

    // 🎯 主轨点位 + 会话全部走统一 hook（#9 usePoints）：
    // 会话探测/拉云 LWW 合并/写前盖戳/空库守卫/401 自愈/登出全在 hook 内
    const {
        points: customPoints,
        updatePoints: handlePointsUpdate,
        session,
        setSession,
        isCloudSyncing,
        logout: handleLogout,
    } = usePoints('main');

    // 🔗 视角深链接：启动时读取 #lat=..&lon=..&z=..&tab=..&mode=..（可选含选中点 plat/plon/pname）
    useEffect(() => {
        if (!shouldRestoreSharedView(window.sessionStorage)) return;
        const rawHash = window.location.hash;
        const view = parseViewHash(rawHash);
        if (!view) return;
        // 消费完分享哈希后立即清理地址栏，保持域名干净
        if (rawHash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        if (view.mode === 'tactical') {
            if (view.lat !== null && view.lon !== null) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- 启动恢复链：一次性传递战术深链接视角
                setTacticalInitialView({ lat: view.lat, lon: view.lon, zoom: view.z ?? 12 });
            }
            setIsTacticalMode(true);
            return;
        }
        if (view.tab) setActiveTab(view.tab);
        if (view.point) {
            setPendingMapTarget({
                id: `share_pt_${Date.now()}`,
                name: view.point.name || '分享点位',
                lat: view.point.lat,
                lon: view.point.lon,
                zoom: view.z ?? 13,
                category: 'spot',
                source: '分享链接点位',
            });
        } else if (view.lat !== null) {
            if (isOwnDeviceView(rawHash, window.localStorage)) {
                setPendingMapTarget({
                    id: `own_${Date.now()}`,
                    name: '上次浏览位置',
                    lat: view.lat,
                    lon: view.lon,
                    zoom: view.z ?? undefined,
                    category: 'spot',
                    source: '本机视角恢复',
                    silent: true,
                });
            } else {
                setPendingMapTarget({
                    id: `share_${Date.now()}`,
                    name: '分享位置',
                    lat: view.lat,
                    lon: view.lon,
                    zoom: view.z ?? undefined,
                    category: 'spot',
                    source: '分享链接',
                });
            }
        }
    }, []);

    // 🆕 全局通信：从外部触发地图定位并弹出面板
    useEffect(() => {
        window.__locatePointOnMap = (pointId) => {
            const point = customPoints.find(p => p.id === pointId);
            if (point) {
                setPendingMapTarget(point);
                setActiveTab('map');
            }
        };

        return () => {
            delete window.__locatePointOnMap;
        };
    }, [customPoints]);

    const handleLocateExternal = (pt) => {
        if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lon)) return;
        setPendingMapTarget(pt);
        setActiveTab('map');
    };

    const handleEnterTactical = (view = null) => {
        setTacticalInitialView(view);
        setIsTacticalMode(true);
    };

    return (
        <>
            {/* 🎯 暗黑专业地图全屏覆盖 */}
            {isTacticalMode ? (
                <ErrorBoundary label="暗黑地图" onReset={() => setIsTacticalMode(false)}>
                <Suspense
                    fallback={
                        <div
                            className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-cyan-300 font-mono"
                            role="status"
                            aria-label="暗黑地图加载中"
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
                            <p className="text-sm tracking-[0.2em] animate-pulse">正在加载 Dark 2D 专业地图...</p>
                        </div>
                    }
                >
                    <MapTactical
                        customPoints={customPoints}
                        onPointsUpdate={handlePointsUpdate}
                        initialView={tacticalInitialView}
                        onExit={() => setIsTacticalMode(false)}
                    />
                </Suspense>
                </ErrorBoundary>
            ) : (
                <div className="min-h-screen px-4 py-3.5 md:px-6 md:py-5 text-ink">
                    <div className="max-w-[1380px] mx-auto">
                        {/* 🌌 单行轻盈顶栏：留出充足留白与呼吸感 */}
                        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 shrink-0">
                                <h1 className="flex items-baseline gap-1.5 text-2xl md:text-[26px] leading-none select-none">
                                    <span className="font-display text-sora-deep drop-shadow-[0_1.5px_0_oklch(0.94_0.045_5/0.6)]">Earth</span>
                                    <span className="font-display text-ink">Terminal</span>
                                </h1>
                                {isCloudSyncing && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-sora font-medium" title="云端同步中...">
                                        <CloudFog className="w-3.5 h-3.5 animate-pulse" />
                                    </span>
                                )}
                            </div>

                            {/* 中央导航胶囊条：桌面端同行居中，小屏自动换行满宽 */}
                            <nav
                                className="order-3 xl:order-2 w-full xl:w-auto flex overflow-x-auto flex-nowrap bg-paper-2/85 backdrop-blur-md p-1 rounded-2xl shadow-lift border border-line/80 gap-0.5 scrollbar-hide"
                                role="tablist"
                                ref={(el) => { window.__tabNav = el; }}
                            >
                                {[
                                    { id: 'map', label: '探索地图', icon: MapIcon },
                                    { id: 'data', label: '收藏与导入', icon: Database },
                                    { id: 'rules', label: '出行指南', icon: Info },
                                    { id: 'tools', label: '汇率换算', icon: Calculator },
                                    { id: 'sub-culture', label: '巡礼与活动', icon: Sparkles },
                                    { id: 'aviation', label: '机票航线', icon: PlaneTakeoff },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                        className={`shrink-0 flex items-center px-3 py-1.5 rounded-xl text-[13px] font-bold transition-[background-color,color,box-shadow] duration-200 ease-out whitespace-nowrap ${
                                            activeTab === tab.id
                                                ? 'bg-sora text-sora-ink shadow-sm'
                                                : 'text-ink-2 hover:text-ink hover:bg-sora-soft/60'
                                        }`}
                                    >
                                        <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>

                            {/* 🔐 账号登录与云同步入口 */}
                            <div className="order-2 xl:order-3 flex items-center shrink-0">
                                {session ? (
                                    <span className="relative">
                                        <button
                                            onClick={() => setAccountMenuOpen(v => !v)}
                                            aria-haspopup="menu"
                                            aria-expanded={accountMenuOpen}
                                            title="账号与云端同步"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-wakaba-soft text-ink border border-wakaba/40 text-xs font-bold hover:border-wakaba transition-colors"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-wakaba" aria-hidden="true" />
                                            <span>{session}</span>
                                            <span className="opacity-60">▾</span>
                                        </button>
                                        {accountMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
                                                <span role="menu" className="absolute right-0 top-10 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 px-1">
                                                    <span className="block px-3 py-1.5 text-[11px] text-slate-400 border-b border-slate-100 mb-1">
                                                        云端同步已开启
                                                    </span>
                                                    <button
                                                        onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                                                        role="menuitem"
                                                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    >
                                                        退出登录
                                                    </button>
                                                </span>
                                            </>
                                        )}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setAuthOverlayOpen(true)}
                                        title="登录后可在多设备间云端同步你的收藏地点"
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-paper-2/90 text-sora-deep border border-sora/30 shadow-sm hover:bg-sora-soft/70 hover:border-sora transition-colors"
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        登录 / 云同步
                                    </button>
                                )}
                            </div>
                        </header>

                <main>
                  <ErrorBoundary label="主控台">
                    <MapEngine
                        isActive={activeTab === 'map'}
                        customPoints={customPoints}
                        basePoints={BASE_POINTS_CONFIG}
                        onDeletePoint={(pointId) => handlePointsUpdate(customPoints.filter(p => p.id !== pointId))}
                        onPointsUpdate={handlePointsUpdate}
                        pendingMapTarget={pendingMapTarget}
                        onTargetHandled={() => setPendingMapTarget(null)}
                        onEnterTactical={handleEnterTactical}
                        onSwitchTab={setActiveTab}
                        onOpenItinerary={() => { setDataSubView('itinerary'); setActiveTab('data'); }}
                        skipIpAutoLocate={hasInitialHashView}
                    />
                    
                    <DataCenter isActive={activeTab === 'data'} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} session={session} onOpenAuth={() => setAuthOverlayOpen(true)} onLogout={handleLogout} subView={dataSubView} onSubViewChange={setDataSubView} />
                    
                    <RulesTab isActive={activeTab === 'rules'} onLocateRegion={(region) => handleLocateExternal({ id: `region_${region.id}`, name: `${region.name}全境`, lat: region.center[0], lon: region.center[1], zoom: region.zoom ?? 5, viewOnly: true })} />
                    <ExchangeEngine isActive={activeTab === 'tools'} />
                    <AviationEngine isActive={activeTab === 'aviation'} />

                        {activeTab === 'sub-culture' && (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                <PilgrimageRadar isActive={true} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} />

                <div className="flex items-center justify-center py-4">
                    <div className="h-px bg-line flex-1"></div>
                    <div className="mx-4 text-ink-3 text-xs font-bold tracking-wider">季节活动 · 地区专题</div>
                    <div className="h-px bg-line flex-1"></div>
                </div>

                <HanabiRadar isActive={true} onLocateOnMap={handleLocateExternal} />
            </div>
        )}
                  </ErrorBoundary>
                    </main>
                </div>
            </div>
        )}
            {authOverlayOpen && (
                <LoginOverlay
                    onClose={() => setAuthOverlayOpen(false)}
                    onAuthenticated={(u) => { setSession(u); setAuthOverlayOpen(false); }}
                />
            )}
    </>
    );
};

export default App;