import { useState, useEffect } from 'react';
// 1. 新增了 PlaneTakeoff 图标
import { MapIcon, Database, Info, Calculator, MapPin, Sparkles, PlaneTakeoff } from 'lucide-react';
// 2. 新增了 AviationEngine 组件
import { MapEngine, DataCenter, ExchangeEngine, RulesTab, HanabiRadar, AviationEngine, PilgrimageRadar } from './components';
import { BASE_POINTS_CONFIG } from './config/basePoints';

const App = () => {
    const [activeTab, setActiveTab] = useState('map');

    const [customPoints, setCustomPoints] = useState(() => {
        try {
            const saved = localStorage.getItem('railway_custom_points');
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed;
            }
            return [];
        } catch (e) {
            console.error('❌ 读取本地存储失败:', e);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('railway_custom_points', JSON.stringify(customPoints));
        } catch (e) {
            console.error('❌ 保存本地存储失败:', e);
        }
    }, [customPoints]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans selection:bg-green-200 text-gray-800">
            <div className="max-w-6xl mx-auto">
                <header className="mb-4">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 flex flex-wrap items-end gap-x-3 gap-y-1">
    <span>WebGIS</span>
                        <span>WebGIS</span>
                        <span className="text-cyan-600">主干地形图终端</span>
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium flex items-center">
                        <MapPin className="w-4 h-4 mr-1" /> 已开启 Esri 卫星地形层，加载青春18北至南 50 站骨架
                    </p>
                </header>

                <nav className="flex overflow-x-auto flex-nowrap bg-white p-2 rounded-2xl shadow-sm border border-gray-100 mb-4 gap-2 scrollbar-hide" role="tablist">
                    {[
                        { id: 'map', label: '高精度地形终端', icon: MapIcon },
                        { id: 'data', label: '数据解析与管理', icon: Database },
                        { id: 'rules', label: '系统生存法则', icon: Info },
                        { id: 'tools', label: '双向汇率引擎', icon: Calculator },
                        { id: 'sub-culture', label: '次元情报中心', icon: Sparkles },
                        // 3. 在这里加上跨国航线雷达的入口
                        { id: 'aviation', label: '跨国航线雷达', icon: PlaneTakeoff },
                    ].map((tab) => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
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
    );
};

export default App;


