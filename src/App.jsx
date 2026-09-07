import { lazy, Suspense, useState, useEffect } from 'react';
// 1. 新增了 PlaneTakeoff 图标
import { MapIcon, Database, Info, Calculator, MapPin, Sparkles, PlaneTakeoff, CloudFog } from 'lucide-react';
// 2. 新增了 AviationEngine 组件
import { MapEngine, DataCenter, ExchangeEngine, RulesTab, HanabiRadar, AviationEngine, PilgrimageRadar } from './components';
import { BASE_POINTS_CONFIG } from './config/basePoints';
import ErrorBoundary from './components/ErrorBoundary';
import LoginOverlay from './components/auth/LoginOverlay.jsx';

// 🛫 战术地图整棵子树（MapTactical → MapboxMapTactical → mapbox-gl ≈ 1.7MB）
// 按需加载：不进首屏 bundle，首次切入战术模式时才拉取异步块
const MapTactical = lazy(() => import('./pages/MapTactical'));
// 🛠️ 导入工具函数
import { parseViewHash, shouldRestoreSharedView, isOwnDeviceView } from './utils/urlState';
import { usePoints } from './hooks/usePoints';

const App = () => {
    const [activeTab, setActiveTab] = useState('map');
    const [pendingMapTarget, setPendingMapTarget] = useState(null); // 🆕 待定位的地点
    const [isTacticalMode, setIsTacticalMode] = useState(false); // 🎯 战术模式状态
    const [nodeMenuOpen, setNodeMenuOpen] = useState(false); // 顶栏 NODE 徽章快捷菜单
    const [authOverlayOpen, setAuthOverlayOpen] = useState(false);

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

    // 🔗 视角深链接：启动时读取 #lat=..&lon=..&z=..&tab=..&mode=..
    // 别人分享的链接打开后自动切页签、飞到目标坐标并弹出定位面板。
    // 🧭 仅"首次到访"恢复（shouldRestoreSharedView 用 sessionStorage 区分）：
    // 同标签页刷新时哈希只是被动跟随，不再绑架视角跳回旧位置
    // 🏠 本机指纹（isOwnDeviceView 用 localStorage 区分）：从自己收藏夹打开的链接
    //    静默摆到目标视角（不弹分享面板），朋友打开的真分享才走完整仪式感
    // 🎯 mode=tactical（战术轨道链接）：直接拉起 dark2d 战术模式，视角由
    //    MapTactical 自己从 hash 恢复（含本机"上次视角"记忆链），App 不越俎代庖
    useEffect(() => {
        if (!shouldRestoreSharedView(window.sessionStorage)) return;
        const view = parseViewHash(window.location.hash);
        if (!view) return;
        if (view.mode === 'tactical') {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- 启动恢复链：一次性条件切模式，非级联渲染
            setIsTacticalMode(true);
            return; // 战术轨道视角恢复全部由 MapTactical 内部处理
        }
        if (view.tab) setActiveTab(view.tab);
        if (view.lat !== null) {
            if (isOwnDeviceView(window.location.hash, window.localStorage)) {
                // 自家收藏视角：静默定位（仍走 pendingMapTarget 拿到坐标，但换"安静"来源标记）
                setPendingMapTarget({
                    id: `own_${Date.now()}`,
                    name: '上次视角',
                    lat: view.lat,
                    lon: view.lon,
                    category: 'spot',
                    source: '本机视角恢复',
                    silent: true,
                });
            } else {
                setPendingMapTarget({
                    id: `share_${Date.now()}`,
                    name: '分享坐标',
                    lat: view.lat,
                    lon: view.lon,
                    category: 'spot',
                    source: '视角分享链接',
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

    return (
        <>
            {/* 🎯 战术模式全屏覆盖 */}
            {isTacticalMode ? (
                <ErrorBoundary label="战术雷达" onReset={() => setIsTacticalMode(false)}>
                <Suspense
                    fallback={
                        <div
                            className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-cyan-300 font-mono"
                            role="status"
                            aria-label="战术雷达启动中"
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
                            <p className="text-sm tracking-[0.3em] animate-pulse">[ DARK_2D_RADAR 启动中... ]</p>
                        </div>
                    }
                >
                    <MapTactical
                        customPoints={customPoints}
                        onPointsUpdate={handlePointsUpdate} // 👈 接入云端同步
                        onExit={() => setIsTacticalMode(false)}
                    />
                </Suspense>
                </ErrorBoundary>
            ) : (
                <div className="min-h-screen p-4 md:p-8 text-gray-800">
                    <div className="max-w-6xl mx-auto">
                        <header className="mb-4">
                            <h1 className="flex flex-wrap items-end gap-x-3 gap-y-1 text-3xl md:text-4xl lg:text-5xl">
                                {/* 🌌 天の川字体：站名用手写展示体，副标语保持正文脸 */}
                                <span className="font-display text-sora-deep drop-shadow-[0_2px_0_oklch(0.94_0.045_5/0.5)]">Earth</span>
                                <span className="font-display text-ink">Terminal</span>
                            </h1>
                            <p className="text-ink-2 mt-2 flex items-center text-sm md:text-base">
                                <MapPin className="w-4 h-4 mr-1" /> 已开启 Esri 卫星地形层，加载青春18北至南 50 站骨架
                                {/* 选配：你可以加个云端状态小图标 */}
                                {isCloudSyncing && <CloudFog className="w-4 h-4 ml-3 text-cyan-500 animate-pulse" title="云端同步中..." />}
                                {session
                                    ? (
                                        // 🚪 顶栏 NODE 徽章 = 快捷菜单：退出不再藏在数据解析页深处
                                        <span className="relative ml-3">
                                            <button
                                                onClick={() => setNodeMenuOpen(v => !v)}
                                                aria-haspopup="menu"
                                                aria-expanded={nodeMenuOpen}
                                                title="节点菜单"
                                                className="tnum hud-label px-2 py-0.5 rounded-md bg-kouchou-soft text-kouchou border border-kouchou/40 text-xs font-bold hover:border-kouchou transition-colors"
                                            >
                                                NODE: {session} ▾
                                            </button>
                                            {nodeMenuOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setNodeMenuOpen(false)} />
                                                    <span role="menu" className="absolute right-0 top-8 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 px-1">
                                                        <button
                                                            onClick={() => { setNodeMenuOpen(false); handleLogout(); }}
                                                            role="menuitem"
                                                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        >
                                                            ⏏ 断开上行链路（退出）
                                                        </button>
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    )
                                    : <button onClick={() => setAuthOverlayOpen(true)} className="ml-3 text-xs font-bold text-sora hover:text-sora-deep underline underline-offset-4 transition-colors">建立上行链路</button>}
                            </p>
                        </header>

                        <nav
                            className="flex overflow-x-auto flex-nowrap bg-paper-2/90 backdrop-blur-sm p-2 rounded-2xl shadow-lift border border-line mb-4 gap-2 scrollbar-hide"
                            role="tablist"
                            ref={(el) => { window.__tabNav = el; }}
                        >
                    {[
                        { id: 'map', label: '高精度地形终端', icon: MapIcon },
                        { id: 'data', label: '数据解析与管理', icon: Database },
                        { id: 'rules', label: '系统生存法则', icon: Info },
                        { id: 'tools', label: '双向汇率引擎', icon: Calculator },
                        { id: 'sub-culture', label: '次元情报中心', icon: Sparkles },
                        { id: 'aviation', label: '跨国航线雷达', icon: PlaneTakeoff },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            /* 闸门 10：过渡只指定属性（bg/color/shadow），不动画 outline —— 焦点环即时出现 */
                            className={`shrink-0 flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-[background-color,color,box-shadow] duration-200 ease-out whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-sora text-sora-ink shadow-lift'
                                    : 'text-ink-2 hover:text-ink hover:bg-sora-soft/60'
                            }`}
                        >
                            <tab.icon className="w-4 h-4 mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <main>
                  <ErrorBoundary label="主控台">
                    <MapEngine
                        isActive={activeTab === 'map'}
                        customPoints={customPoints}
                        basePoints={BASE_POINTS_CONFIG}
                        // 👈 删除操作也必须走 handlePointsUpdate，否则删了云端又会弹回来
                        onDeletePoint={(pointId) => handlePointsUpdate(customPoints.filter(p => p.id !== pointId))}
                        onPointsUpdate={handlePointsUpdate} // 👈 接入云端同步
                        pendingMapTarget={pendingMapTarget}
                        onTargetHandled={() => setPendingMapTarget(null)}
                        onEnterTactical={() => setIsTacticalMode(true)}
                    />
                    
                    {/* 👈 接入云端同步 */}
                    <DataCenter isActive={activeTab === 'data'} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} session={session} onOpenAuth={() => setAuthOverlayOpen(true)} onLogout={handleLogout} />
                    
                    <RulesTab isActive={activeTab === 'rules'} />
                    <ExchangeEngine isActive={activeTab === 'tools'} />
                    {/* 4. 挂载跨国航线雷达模块 */}
                    <AviationEngine isActive={activeTab === 'aviation'} />

                        {activeTab === 'sub-culture' && (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                <PilgrimageRadar isActive={true} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} />

                {/* 极简分割线，增加空间感 */}
                <div className="flex items-center justify-center py-4">
                    <div className="h-px bg-line flex-1"></div>
                    <div className="mx-4 hud-label text-ink-3 text-xs">Dimension Divider</div>
                    <div className="h-px bg-line flex-1"></div>
                </div>

                <HanabiRadar isActive={true} />
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