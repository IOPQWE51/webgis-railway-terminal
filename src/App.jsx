import { useState, useEffect } from 'react';
// 1. 新增了 PlaneTakeoff 图标
import { MapIcon, Database, Info, Calculator, MapPin, Sparkles, PlaneTakeoff } from 'lucide-react';
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

    const [customPoints, setCustomPoints] = useState(() => {
        // 🆕 尝试从新系统键读取
        let saved = storage.load('earth_terminal_custom_points', null);

        // 🔄 如果新系统没有数据，尝试从旧系统迁移
        if (!saved) {
            const oldData = storage.load('railway_custom_points', null);
            if (oldData) {
                console.log('🔄 发现旧系统数据，正在迁移到 EarthTerminal...');
                storage.save('earth_terminal_custom_points', oldData);
                saved = oldData;
                console.log('✅ 数据迁移完成');
            }
        }

        return saved || [];
    });

    useEffect(() => {
        storage.save('earth_terminal_custom_points', customPoints);
    }, [customPoints]);

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
                    onPointsUpdate={setCustomPoints}
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
                    {/* 顺手补上了 onDeletePoint，确保地图删除功能正常工作 */}
                    <MapEngine
                        isActive={activeTab === 'map'}
                        customPoints={customPoints}
                        basePoints={BASE_POINTS_CONFIG}
                        onDeletePoint={(pointId) => setCustomPoints(prev => prev.filter(p => p.id !== pointId))}
                        onPointsUpdate={setCustomPoints}
                        pendingMapTarget={pendingMapTarget}
                        onTargetHandled={() => setPendingMapTarget(null)}
                        onEnterTactical={() => setIsTacticalMode(true)}
                    />
                    <DataCenter isActive={activeTab === 'data'} customPoints={customPoints} onPointsUpdate={setCustomPoints} />
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


