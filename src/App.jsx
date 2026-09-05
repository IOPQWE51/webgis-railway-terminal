import { lazy, Suspense, useState, useEffect, useRef } from 'react';
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
import { storage } from './utils/performanceHelpers';
import { parseViewHash, shouldRestoreSharedView } from './utils/urlState';

const App = () => {
    const [activeTab, setActiveTab] = useState('map');
    const [pendingMapTarget, setPendingMapTarget] = useState(null); // 🆕 待定位的地点
    const [isTacticalMode, setIsTacticalMode] = useState(false); // 🎯 战术模式状态

    // ☁️ 云端同步状态指示器 (可选：你可以在界面上展示它)
    const [isCloudSyncing, setIsCloudSyncing] = useState(false);

    // 🔐 会话状态：null = 匿名（纯本地模式）
    const [session, setSession] = useState(null);
    // 🛡️ 会话快照：CSV 批量解析是数分钟级长任务，完成时回调里的旧闭包 session 可能
    // 早已换人（登出/换号）。推送前用快照比对当前闭包值即可识别（见 handlePointsUpdate 守卫）
    const sessionRef = useRef(session);
    // 渲染期直接同步而非 useEffect：避免会话变更后到 effect 执行之间留出一帧守卫盲窗
    sessionRef.current = session;
    const [authOverlayOpen, setAuthOverlayOpen] = useState(false);

    // 🔗 视角深链接：启动时读取 #lat=..&lon=..&z=..&tab=..
    // 别人分享的链接打开后自动切页签、飞到目标坐标并弹出定位面板。
    // 🧭 仅"首次到访"恢复（shouldRestoreSharedView 用 sessionStorage 区分）：
    // 同标签页刷新时哈希只是被动跟随，不再绑架视角跳回旧位置
    useEffect(() => {
        if (!shouldRestoreSharedView(window.sessionStorage)) return;
        const view = parseViewHash(window.location.hash);
        if (!view) return;
        if (view.tab) setActiveTab(view.tab);
        if (view.lat !== null) {
            setPendingMapTarget({
                id: `share_${Date.now()}`,
                name: '分享坐标',
                lat: view.lat,
                lon: view.lon,
                category: 'spot',
                source: '视角分享链接',
            });
        }
    }, []);

    // 1. 🛡️ 初始状态：先用本地 localStorage 垫底，保证画面瞬间渲染
    const [customPoints, setCustomPoints] = useState(() => {
        let saved = storage.load('earth_terminal_custom_points', null);
        if (!saved) {
            const oldData = storage.load('railway_custom_points', null);
            if (oldData) {
                storage.save('earth_terminal_custom_points', oldData);
                saved = oldData;
            }
        }
        return saved || [];
    });

    // 🛰️ 挂载时恢复会话（Cookie 会话，GET /api/auth?action=me）
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/auth?action=me');
                if (res.ok) {
                    const json = await res.json();
                    if (json.username) setSession(json.username);
                }
            } catch {
                console.log('📡 认证服务未连接，当前运行在本地沙盒模式。');
            }
        })();
    }, []);

    // ☁️ 已登录：从自己的云端点位库拉取并覆盖本地缓存；匿名：纯本地，不发云请求
    useEffect(() => {
        if (!session) return undefined;
        const fetchCloudPoints = async () => {
            setIsCloudSyncing(true);
            try {
                const res = await fetch('/api/points');
                if (res.ok) {
                    const json = await res.json();
                    // 🈳 空云库守卫：空数组视为"云端还没有数据"而非"清空指令"，
                    // 否则新注册用户登录到空库会清掉本地积累的全部点位。
                    // 取舍：在 A 设备清空云库不会传播删除到 B 设备，远轻于误清空本地
                    // （对齐同仓先例 MapTactical.jsx 的同款 length > 0 守卫）。
                    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                        setCustomPoints(json.data);
                        storage.save('earth_terminal_custom_points', json.data);
                    }
                }
            } catch {
                console.log('📡 云端数据库尚未连接，当前运行在本地沙盒模式。');
            } finally {
                setIsCloudSyncing(false);
            }
        };
        fetchCloudPoints();
    }, [session]);

    // 3. 🔵 数据更新中枢：同步更新 UI、本地硬盘 和 云端数据库
    const handlePointsUpdate = async (newPointsArray) => {
        // ⚡️ 乐观更新：不等云端返回，先瞬间更新本地界面，保持极致丝滑
        setCustomPoints(newPointsArray);
        storage.save('earth_terminal_custom_points', newPointsArray);

        // 🔒 匿名模式：仅本地，不打扰云端
        if (!session) {
            console.info('🔒 本地模式：建立上行链路后点位将自动云端同步');
            return;
        }

        // 🛡️ 长任务闭包守卫：批次开始时的会话与当前会话不一致（登出/换号）则放弃上行，
        // 防止旧闭包把前用户点位写进新用户的云库
        if (sessionRef.current !== session) {
            console.warn('🛡️ 会话已变更，本次点位变更仅保留在本地');
            return;
        }

        // ☁️ 异步推送到云端
        try {
            const res = await fetch('/api/points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPointsArray)
            });
            // 🔑 会话过期自愈：JWT 失效（401）时主动翻回匿名，
            // header 徽章随即变回"建立上行链路"，后续点位变更自然走匿名本地分支，
            // 避免之后每次更新都带着失效 Cookie 白跑一趟
            if (res.status === 401) {
                console.warn('🔑 上行链路会话已过期，已自动降级为本地模式');
                setSession(null);
            }
            if (!res.ok) throw new Error('云端写入失败');
        } catch (error) {
            // 如果报错（比如目前没建数据库），只打印不弹窗，不打断用户体验
            console.warn('⚠️ 战术节点云端备份失败 (如果是本地测试则正常):', error.message);
        }
    };

    // 🚪 断开上行链路（服务端清 Cookie，本地点位数据保留）
    const handleLogout = async () => {
        try { await fetch('/api/auth?action=logout', { method: 'POST' }); } catch { /* 忽略网络错误 */ }
        setSession(null);
    };


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
                <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans selection:bg-green-200 text-gray-800">
                    <div className="max-w-6xl mx-auto">
                        <header className="mb-4">
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 flex flex-wrap items-end gap-x-3 gap-y-1">
                                <span className="text-cyan-600">Earth</span>
                                <span>Terminal</span>
                            </h1>
                            <p className="text-gray-500 mt-2 font-medium flex items-center">
                                <MapPin className="w-4 h-4 mr-1" /> 已开启 Esri 卫星地形层，加载青春18北至南 50 站骨架
                                {/* 选配：你可以加个云端状态小图标 */}
                                {isCloudSyncing && <CloudFog className="w-4 h-4 ml-3 text-cyan-500 animate-pulse" title="云端同步中..." />}
                                {session
                                    ? <span className="ml-3 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold font-mono" title="已建立上行链路">NODE: {session}</span>
                                    : <button onClick={() => setAuthOverlayOpen(true)} className="ml-3 text-xs font-bold text-cyan-600 hover:text-cyan-500 underline underline-offset-4">建立上行链路</button>}
                            </p>
                        </header>

                        <nav
                            className="flex overflow-x-auto flex-nowrap bg-white p-2 rounded-2xl shadow-sm border border-gray-100 mb-4 gap-2 scrollbar-hide"
                            role="tablist"
                            ref={(el) => {
                                if (el && !el.dataset.centered) {
                                    // 🎯 默认将"高精度地形终端"居中显示
                                    const tabs = el.querySelectorAll('button[role="tab"]');
                                    const mapTabs = Array.from(tabs).filter(tab => tab.textContent.includes('高精度地形'));

                                    // 找到中间组的"高精度地形终端"
                                    if (mapTabs.length >= 2) {
                                        const centerTab = mapTabs[Math.floor(mapTabs.length / 2)];
                                        const scrollLeft = centerTab.offsetLeft - (el.clientWidth / 2) + (centerTab.clientWidth / 2);
                                        el.scrollLeft = scrollLeft;
                                        el.dataset.centered = 'true';

                                        // 🔄 实现无缝循环滑动
                                        let isScrolling = false;
                                        const handleScroll = () => {
                                            if (isScrolling) return;

                                            const maxScroll = el.scrollWidth - el.clientWidth;
                                            const threshold = 50; // 触发循环的阈值

                                            // 到达最左端，跳转到最右端
                                            if (el.scrollLeft < threshold) {
                                                isScrolling = true;
                                                el.scrollLeft = maxScroll - threshold;
                                                setTimeout(() => { isScrolling = false; }, 100);
                                            }
                                            // 到达最右端，跳转到最左端
                                            else if (el.scrollLeft > maxScroll - threshold) {
                                                isScrolling = true;
                                                el.scrollLeft = threshold;
                                                setTimeout(() => { isScrolling = false; }, 100);
                                            }
                                        };

                                        el.addEventListener('scroll', handleScroll, { passive: true });
                                    }

                                    // 💾 保存nav元素引用供点击使用
                                    el.dataset.navRef = 'true';
                                    window.__tabNav = el;
                                }
                            }}
                        >
                    {Array(3).fill(null).flatMap(() => [
                        { id: 'map', label: '高精度地形终端', icon: MapIcon },
                        { id: 'data', label: '数据解析与管理', icon: Database },
                        { id: 'rules', label: '系统生存法则', icon: Info },
                        { id: 'tools', label: '双向汇率引擎', icon: Calculator },
                        { id: 'sub-culture', label: '次元情报中心', icon: Sparkles },
                        { id: 'aviation', label: '跨国航线雷达', icon: PlaneTakeoff },
                    ]).map((tab, index) => (
                        // 无缝循环滑动共渲染 3 组标签；第 2、3 组（index>=6）只是视觉填充，
                        // 对读屏器与键盘焦点隐藏，避免辅助技术读到 18 个重复 tab
                        <button
                            key={`${tab.id}-${index}`}
                            onClick={(e) => {
                                setActiveTab(tab.id);

                                // 🎯 点击时将tab滚动到中心位置
                                const nav = window.__tabNav;
                                if (nav) {
                                    const button = e.currentTarget;
                                    const scrollLeft = button.offsetLeft - (nav.clientWidth / 2) + (button.clientWidth / 2);
                                    nav.scrollTo({
                                        left: scrollLeft,
                                        behavior: 'smooth'
                                    });
                                }
                            }}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-hidden={index >= 6 ? true : undefined}
                            tabIndex={index >= 6 ? -1 : 0}
                            className={`shrink-0 flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-zinc-900 text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <div className="mx-4 text-gray-400 text-xs font-bold tracking-widest uppercase">Dimension Divider</div>
                    <div className="h-px bg-gray-200 flex-1"></div>
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