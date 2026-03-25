import React from 'react';
import { Camera, ExternalLink, AlertTriangle, HeartHandshake, MapPin } from 'lucide-react';

const PilgrimageRadar = ({ isActive }) => {
    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
                
                {/* 模块标题 */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <Camera className="w-6 h-6 mr-2 text-pink-500" />
                            次元边界：圣地巡礼雷达
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Anime Pilgrimage Engine</p>
                    </div>
                </div>

                {/* Anitabi 主引擎入口 */}
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-100 mb-8 relative overflow-hidden">
                    <Camera className="absolute -right-4 -bottom-4 w-32 h-32 text-pink-500 opacity-10" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h4 className="font-black text-pink-900 text-lg flex items-center mb-2">
                                <MapPin className="w-5 h-5 mr-2 text-pink-600" /> Anitabi (巡礼之途) 检索网络
                            </h4>
                            <p className="text-sm text-pink-700 font-medium">
                                全球最全的 ACG 圣地巡礼地图库。你可以在这里检索番剧坐标，然后提取经纬度，录入到我们的主干地形终端中进行聚合分析。
                            </p>
                        </div>
                        <a 
                            href="https://www.anitabi.cn/map" 
                            target="_blank" 
                            rel="noreferrer"
                            className="shrink-0 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center active:scale-95"
                        >
                            启动次元跃迁 <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                    </div>
                </div>

                {/* 巡礼生存法则 */}
                <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                        <HeartHandshake className="w-4 h-4 mr-2 text-rose-500" />
                        次元交汇法则 (巡礼潜规则)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-pink-200 transition-colors">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs mr-2">禁忌</span>
                                <span className="font-bold text-gray-900 text-sm">校园与住宅区的结界</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                绝大部分校园背景**禁止外部人员入内**。上课期间严禁在校门外徘徊拍照（极易被报警）。在住宅区取景时，请保持绝对安静，**绝对不可将相机镜头对准私人住宅的窗户或当地居民**。
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-pink-200 transition-colors">
                            <div className="flex items-center mb-2">
                                <span className="font-black text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs mr-2">守则</span>
                                <span className="font-bold text-gray-900 text-sm">微小的在地回馈</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                如果巡礼点在当地的神社、商店或自动贩卖机附近，尽可能在当地**消费一点点**（买瓶水、投个赛钱、买个护身符）。这能极大地改善当地居民对阿宅群体的包容度，保护圣地不被封闭。
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PilgrimageRadar;