import { Loader2, CloudRain, Cloud, Map as MapIcon, Moon, Globe, Ruler, Layers, Target, Navigation, Crosshair, Radar, Compass } from 'lucide-react';
import SearchNavEngine from './SearchNavEngine';
import QrViewShare from './QrViewShare';
import { REGION_REGISTRY } from '../config/regions';

const ControlPanel = ({
    // 状态
    isLocating, isMeasuring, measurePoints, measureDistance, baseMapType, weatherType, filters, visitorCity,
    // 操作方法
    handleSearchLocationFound, locatePlayer, setIsMeasuring, setMeasurePoints, setMeasureDistance, clearMeasurement, setBaseMapType, setWeatherType, toggleFilter, onEnterTactical, onJumpToRegion
}) => {
    return (
        <div className="flex flex-col gap-4">
            {/* 1. 全球地点搜索 */}
            <SearchNavEngine onLocationFound={handleSearchLocationFound} />

            {/* 2. 我的位置与分享 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center justify-between text-gray-500 font-bold text-xs tracking-wide mb-3">
                    <span className="flex items-center"><Navigation className="w-4 h-4 mr-2" /> 我的位置与分享</span>
                    {visitorCity && <span className="text-[11px] font-medium text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full truncate max-w-[130px]" title={`IP 识别位置：${visitorCity}`}>IP: {visitorCity}</span>}
                </div>
                <button onClick={locatePlayer} disabled={isLocating} className="w-full py-2.5 rounded-xl font-bold text-sm bg-cyan-600 text-white flex justify-center items-center transition-all hover:bg-cyan-700">
                    {isLocating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crosshair className="w-4 h-4 mr-2" />}
                    {isLocating ? '正在获取定位...' : '定位到当前位置'}
                </button>
                {/* 🔳 视角二维码：当前视角深链接扫码带走（弹出向上展开，不占面板流） */}
                <div className="mt-3">
                    <QrViewShare variant="light" />
                </div>
            </div>

            {/* 3. 距离测量 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center text-gray-500 font-bold text-xs tracking-wide mb-3">
                    <Ruler className="w-4 h-4 mr-2" /> 距离测量
                </div>
                <button onClick={() => { setIsMeasuring(!isMeasuring); setMeasurePoints([]); setMeasureDistance(0); }} className={`w-full py-2.5 rounded-xl font-bold text-sm flex justify-center items-center border-2 transition-all ${isMeasuring ? 'bg-yellow-50 text-yellow-700 border-yellow-400' : 'bg-zinc-900 text-yellow-400 border-zinc-900 hover:bg-zinc-800'}`}>
                    <Target className="w-4 h-4 mr-2" />
                    {isMeasuring ? '测距模式中（点地图选两点）' : '开始测距'}
                </button>
                {measurePoints.length === 2 && (
                    <div className="mt-3 flex justify-between items-center text-sm font-bold bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                        <span className="text-zinc-800">{measureDistance} km</span>
                        <button onClick={clearMeasurement} className="text-red-500 hover:text-red-700 bg-red-50 px-3 py-1 rounded-md">清除</button>
                    </div>
                )}
            </div>

            {/* 4. 底图与气象（含 Dark 2D 专业地图入口） */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center text-gray-500 font-bold text-xs tracking-wide mb-3">
                    <Globe className="w-4 h-4 mr-2" /> 底图与气象
                </div>
                {/* 基础底图切换 */}
                <div className="flex bg-gray-100 p-1.5 rounded-xl mb-3">
                    <button onClick={() => setBaseMapType('topo')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'topo' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><MapIcon className="w-3 h-3 mr-1" /> 地形</button>
                    <button onClick={() => setBaseMapType('satellite')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'satellite' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Globe className="w-3 h-3 mr-1" /> 卫星</button>
                    <button onClick={() => setBaseMapType('dark')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'dark' ? 'bg-zinc-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Moon className="w-3 h-3 mr-1" /> 暗黑</button>
                </div>
                {/* 天气图层切换 */}
                <div className="flex bg-rose-50 p-1.5 rounded-xl border border-rose-100">
                    <button onClick={() => setWeatherType('none')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${weatherType === 'none' ? 'bg-white text-rose-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}>关闭</button>
                    <button onClick={() => setWeatherType('precipitation_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${weatherType === 'precipitation_new' ? 'bg-white text-blue-600 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><CloudRain className="w-3 h-3 mr-1" /> 降雨</button>
                    <button onClick={() => setWeatherType('clouds_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${weatherType === 'clouds_new' ? 'bg-white text-gray-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><Cloud className="w-3 h-3 mr-1" /> 云层</button>
                </div>

                {/* 💥 Dark 2D 专业暗黑地图入口 */}
                {onEnterTactical && (
                    <>
                        <div className="h-px bg-gray-100 my-4 w-full"></div>
                        <button
                            onClick={onEnterTactical}
                            className="group relative w-full py-2.5 px-4 bg-zinc-900 hover:bg-black text-[#fbbf24] font-bold text-xs tracking-wide rounded-xl shadow-md border border-zinc-800 transition-all duration-300 overflow-hidden flex items-center justify-center gap-2"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                            <Radar className="w-4 h-4" />
                            <span>切换暗黑专业地图 (Dark 2D)</span>
                        </button>
                    </>
                )}
            </div>

            {/* 5. 区域交通骨架（按注册表动态展示，方便后续扩展多国铁道网络） */}
            {onJumpToRegion && REGION_REGISTRY.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between text-gray-500 font-bold text-xs tracking-wide mb-2.5">
                        <span className="flex items-center"><Compass className="w-4 h-4 mr-2" /> 交通骨架专题</span>
                        <span className="text-[10px] text-gray-400">全球持续扩展</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {REGION_REGISTRY.map((region) => (
                            <button
                                key={region.id}
                                onClick={() => onJumpToRegion(region)}
                                title={region.description || `查看${region.name}交通骨架`}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                            >
                                <span>{region.icon || '🌍'}</span>
                                <span>{region.name}铁道</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 6. 显示图层 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 flex-1">
                <div className="flex items-center text-gray-500 font-bold text-xs tracking-wide mb-3">
                    <Layers className="w-4 h-4 mr-2" /> 显示图层
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => toggleFilter('framework')} className={`py-2 rounded-xl text-xs font-bold border transition-all ${filters.framework ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-gray-50 text-gray-400'}`}>🛤️ 交通骨架</button>
                    {[
                        { id: 'station', l: '🚉 车站', activeCls: 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' },
                        { id: 'airport', l: '✈️ 机场', activeCls: 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm' },
                        { id: 'anime', l: '🌸 巡礼', activeCls: 'bg-pink-50 text-pink-700 border-pink-200 shadow-sm' },
                        { id: 'hotel', l: '🏨 住宿', activeCls: 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm' },
                        { id: 'spot', l: '📍 地标', activeCls: 'bg-cyan-50 text-cyan-700 border-cyan-200 shadow-sm' }
                    ].map(b => (
                        <button key={b.id} onClick={() => toggleFilter(b.id)} className={`py-2 rounded-xl text-xs font-bold border transition-all ${filters[b.id] ? b.activeCls : 'bg-gray-50 text-gray-400'}`}>{b.l}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;