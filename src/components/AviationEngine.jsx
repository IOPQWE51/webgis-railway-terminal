import React from 'react';
import { PlaneTakeoff, ExternalLink, AlertTriangle, Info, Ticket, BaggageClaim } from 'lucide-react';

const AviationEngine = ({ isActive }) => {
    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
                
                {/* 模块标题 */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <PlaneTakeoff className="w-6 h-6 mr-2 text-indigo-500" />
                            跨国航线与票务雷达
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Global Aviation & LCC Engine</p>
                    </div>
                </div>

                {/* 天巡主引擎入口 */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100 mb-8 relative overflow-hidden">
                    <PlaneTakeoff className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500 opacity-10" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h4 className="font-black text-indigo-900 text-lg flex items-center mb-2">
                                <Ticket className="w-5 h-5 mr-2 text-indigo-600" /> 天巡 (Skyscanner) 票务检索网络
                            </h4>
                            <p className="text-sm text-indigo-700 font-medium">
                                全球最强大的多源机票比价引擎。建议使用此端口进行模糊搜索（如：上海 - 整个日本，按整月查看最低票价）。
                            </p>
                        </div>
                        <a 
                            href="https://www.tianxun.com/" 
                            target="_blank" 
                            rel="noreferrer"
                            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center active:scale-95"
                        >
                            启动检索雷达 <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                    </div>
                </div>

                {/* 廉航 (LCC) 生存法则 */}
                <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                        中日航线：廉价航空 (LCC) 避坑与生存法则
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 春秋航空 */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs mr-2">9C 春秋</span>
                                <span className="font-bold text-gray-900 text-sm">行李额度的绝对红线</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                春秋的行李额包含**手提+托运总计**（通常是 15kg 或 20kg）。登机口会进行极其严格的“地狱级”称重与体积测算，超重需支付极为高昂的逾重费。千万不要抱有侥幸心理。
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center font-mono">
                                <BaggageClaim className="w-3 h-3 mr-1" /> 随身行李限 1 件 (7kg内, 20x30x40cm)
                            </p>
                        </div>

                        {/* 乐桃航空 */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded text-xs mr-2">MM 乐桃</span>
                                <span className="font-bold text-gray-900 text-sm">迷宫般的远机位与航站楼</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                在大阪关西机场 (KIX)，乐桃航空独占偏远的 **T2 航站楼**。你需要从 T1 乘坐免费接驳巴士（约10分钟）才能到达。务必比常规航班多预留至少 40 分钟的时间，否则极易误机。
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center font-mono">
                                <Info className="w-3 h-3 mr-1" /> KIX T2 / NRT T1 北翼
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AviationEngine;