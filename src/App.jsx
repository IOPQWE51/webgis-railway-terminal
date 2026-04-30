import { useState, useEffect } from 'react';
// 1. 新增了 PlaneTakeoff 图标
import { MapIcon, Database, Info, Calculator, MapPin, Sparkles, PlaneTakeoff, CloudFog } from 'lucide-react';
// 2. 新增了 AviationEngine 组件
import { MapEngine, DataCenter, ExchangeEngine, RulesTab, HanabiRadar, AviationEngine, PilgrimageRadar } from './components';
// 🆕 导入战术地图组件
import MapTactical from './pages/MapTactical';
import { BASE_POINTS_CONFIG } from './config/basePoints';
// 🛠️ 导入工具函数
import { storage } from './utils/performanceHelpers';

const App = () => {
    const [activeTab, setActiveTab] = useState('map');
    const [pendingMapTarget, setPendingMapTarget] = useState(null); // 🆕 待定位的地点
    const [isTacticalMode, setIsTacticalMode] = useState(false); // 🎯 战术模式状态

    // ☁️ 云端同步状态指示器 (可选：你可以在界面上展示它)
    const [isCloudSyncing, setIsCloudSyncing] = useState(false);

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

    // 2. 🟢 挂载时：尝试从云端数据库拉取最新情报，覆盖本地
    useEffect(() => {
        const fetchCloudPoints = async () => {
            setIsCloudSyncing(true);
            try {
                const res = await fetch('/api/points');
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && Array.isArray(json.data)) {
                        setCustomPoints(json.data);
                        storage.save('earth_terminal_custom_points', json.data); // 同步刷新本地缓存
                    }
                }
            } catch (error) {
                // 数据库还没建的时候会走到这里，直接忽略，使用上面的本地兜底数据即可
                console.log('📡 云端数据库尚未连接，当前运行在本地沙盒模式。');
            } finally {
                setIsCloudSyncing(false);
            }
        };

        fetchCloudPoints();
    }, []);

    // 3. 🔵 数据更新中枢：同步更新 UI、本地硬盘 和 云端数据库
    const handlePointsUpdate = async (newPointsArray) => {
        // ⚡️ 乐观更新：不等云端返回，先瞬间更新本地界面，保持极致丝滑
        setCustomPoints(newPointsArray);
        storage.save('earth_terminal_custom_points', newPointsArray);

        // ☁️ 异步推送到云端
        try {
            const res = await fetch('/api/points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPointsArray)
            });
            if (!res.ok) throw new Error('云端写入失败');
        } catch (error) {
            // 如果报错（比如目前没建数据库），只打印不弹窗，不打断用户体验
            console.warn('⚠️ 战术节点云端备份失败 (如果是本地测试则正常):', error.message);
        }
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
                <MapTactical
                    customPoints={customPoints}
                    onPointsUpdate={handlePointsUpdate} // 👈 接入云端同步
                    onExit={() => setIsTacticalMode(false)}
                />
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
                    <DataCenter isActive={activeTab === 'data'} customPoints={customPoints} onPointsUpdate={handlePointsUpdate} />
                    
                    <RulesTab isActive={activeTab === 'rules'} />
                    <ExchangeEngine isActive={activeTab === 'tools'} />
                    {/* 4. 挂载跨国航线雷达模块 */}
                    <AviationEngine isActive={activeTab === 'aviation'} />

                        {activeTab === 'sub-culture' && (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                <PilgrimageRadar isActive={true} />

                {/* 极简分割线，增加空间感 */}
                <div className="flex items-center justify-center py-4">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <div className="mx-4 text-gray-400 text-xs font-bold tracking-widest uppercase">Dimension Divider</div>
                    <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <HanabiRadar isActive={true} />
            </div>
        )}

                    </main>
                </div>
            </div>
        )}
    </>
    );
};

export default App;