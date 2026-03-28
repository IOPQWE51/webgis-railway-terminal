import { useState } from 'react';
import { Train, CheckCircle2, XCircle, Globe, ChevronDown, ChevronUp, Map, Compass, AlertTriangle, ShieldAlert } from 'lucide-react';

/**
 * 按国家/地区划分的系统规则配置库 (支持交通法则 & 行为禁忌)
 */
const GLOBAL_RULES_CONFIG = [
    {
        id: 'japan',
        country: "日本 (Japan)",
        icon: "🇯🇵",
        subtitle: "基于「青春18」与 JR 铁道网络的漫游法则",
        tag: "Active",
        rules: [
            { name: "JR 青春 18 主干线", status: "yes", desc: "宗谷、函馆、东北、东海道、山阳、鹿儿岛本线等。可无限次乘坐。" },
            { name: "JR 宫岛渡轮", status: "yes", desc: "唯一可使用的水上交通，直达广岛严岛神社。" },
            { name: "跨海新干线/特急", status: "no", desc: "如北海道新干线 (函馆 - 新青森)。青春 18 绝对禁区，需另购特例票或乘船。" }
        ],
        warnings: [
            { title: "电车静音法则", desc: "在电车、公交内接打电话被视为严重违反礼仪，需将手机调至静音（Manner Mode）。" },
            { title: "绝对的无小费文化", desc: "日本没有任何小费文化。如果你在桌上留下零钱，服务员大概率会追出一条街还给你。" },
            { title: "街头禁烟与边走边吃", desc: "绝大多数城市街头严禁边走边吸烟（需在指定吸烟区），边走边吃也被视为极度不雅。" }
        ]
    },
    {
        id: 'europe',
        country: "欧洲 (Europe)",
        icon: "🇪🇺",
        subtitle: "Eurail 欧洲铁路通票与申根区跨国法则",
        tag: "Coming Soon",
        rules: [
            { name: "跨国高铁 (TGV/Eurostar)", status: "no", desc: "通常需要强制提前订座并支付高额订座费。" },
            { name: "区域慢车 (Regional)", status: "yes", desc: "随时上车，无需订座，是感受欧洲乡镇的最优解。" }
        ],
        warnings: [
            { title: "车票打卡陷阱 (Validating)", desc: "在意大利或法国，即使买了纸质车票，上车前如果不找打卡机印上时间，遇到查票将被视为逃票并处以重罚（高达数十甚至上百欧元）。" },
            { title: "严禁乱穿马路 (Jaywalking)", desc: "在德国等国家，红灯时哪怕街上完全没车也绝对不能过马路，不仅会被当地人鄙视，还可能面临高额罚款。" }
        ]
    },
    {
        id: 'singapore',
        country: "新加坡 (Singapore)",
        icon: "🇸🇬",
        subtitle: "极度严苛的城市法典",
        tag: "Active",
        rules: [],
        warnings: [
            { title: "口香糖禁令", desc: "走私或销售口香糖是非法的，甚至携带过量入境都可能被罚款。乱吐口香糖更是会被重罚。" },
            { title: "地铁内绝对禁食", desc: "在 MRT (地铁) 车厢甚至车站范围内，喝一口白开水或吃一口小零食，都可能面临高达 500 新币的罚款。" }
        ]
    },
    {
        id: 'china',
        country: "中国 (China)",
        icon: "🇨🇳",
        subtitle: "国家铁路网与绿皮慢车探索指南",
        tag: "Planning",
        rules: [],
        warnings: []
    }
];

const RulesTab = ({ isActive }) => {
    const [openSections, setOpenSections] = useState({ 'japan': true });

    const toggleSection = (id) => {
        setOpenSections(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className={`${isActive ? 'block' : 'hidden'} space-y-6 animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            
            <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-2xl font-black flex items-center mb-2">
                        <Globe className="w-7 h-7 mr-3 text-cyan-400" /> 
                        全球铁道与漫游生存法则
                    </h3>
                    <p className="text-zinc-400 text-sm">
                        此终端不仅定义了交通系统的通行逻辑，更收录了各地极易触雷的隐性法规与文化禁忌。
                    </p>
                </div>
                <Compass className="absolute -right-6 -bottom-8 w-40 h-40 text-zinc-800 opacity-50 rotate-12 pointer-events-none" />
            </div>

            <div className="space-y-4">
                {GLOBAL_RULES_CONFIG.map((region) => {
                    const isOpen = openSections[region.id];
                    const hasRules = region.rules && region.rules.length > 0;
                    const hasWarnings = region.warnings && region.warnings.length > 0;
                    const isEmpty = !hasRules && !hasWarnings;

                    return (
                        <div key={region.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300">
                            
                            <button 
                                onClick={() => toggleSection(region.id)}
                                className={`w-full text-left p-5 flex items-center justify-between transition-colors ${isOpen ? 'bg-slate-50' : 'hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center space-x-4">
                                    <span className="text-3xl" aria-hidden="true">{region.icon}</span>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h4 className="text-lg font-bold text-gray-900">{region.country}</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                                region.tag === 'Active' ? 'bg-green-100 text-green-700' :
                                                region.tag === 'Coming Soon' ? 'bg-blue-100 text-blue-700' : 
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {region.tag}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{region.subtitle}</p>
                                    </div>
                                </div>
                                <div className="text-gray-400">
                                    {isOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                                </div>
                            </button>

                            {isOpen && (
                                <div className="p-5 border-t border-gray-100 bg-white">
                                    
                                    {/* 交通通行法则区块 */}
                                    {hasRules && (
                                        <div className="mb-6">
                                            <h5 className="flex items-center text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">
                                                <Train className="w-4 h-4 mr-2 text-cyan-600" /> 交通网络与票务逻辑
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {region.rules.map((line, idx) => (
                                                    <div key={idx} className={`p-3 rounded-xl border transition-colors ${line.status === 'yes' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                                        <div className="flex items-center mb-1.5">
                                                            {line.status === 'yes' ? <CheckCircle2 className="text-green-600 mr-1.5 w-4 h-4 shrink-0" /> : <XCircle className="text-red-600 mr-1.5 w-4 h-4 shrink-0" />}
                                                            <span className="font-bold text-sm text-gray-900">{line.name}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 leading-relaxed pl-5">{line.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 高危警告与文化禁忌区块 */}
                                    {hasWarnings && (
                                        <div>
                                            <h5 className="flex items-center text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">
                                                <ShieldAlert className="w-4 h-4 mr-2 text-amber-500" /> 生存禁忌与隐性法规
                                            </h5>
                                            <div className="grid grid-cols-1 gap-3">
                                                {region.warnings.map((warn, idx) => (
                                                    <div key={idx} className="flex p-3 rounded-xl bg-amber-50 border border-amber-100/50 hover:border-amber-200 transition-colors">
                                                        <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold text-sm text-amber-900 block mb-1">{warn.title}</span>
                                                            <p className="text-xs text-amber-700/80 leading-relaxed">{warn.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 无数据时的占位提示 */}
                                    {isEmpty && (
                                        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <Map className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm font-bold text-gray-500">该区域拓扑系统与法典正在构建中</p>
                                            <p className="text-xs text-gray-400 mt-1">Data collection in progress...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RulesTab;