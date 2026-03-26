import React from 'react';
import { Loader2, CloudRain, Cloud, Map as MapIcon, Moon, Globe, Ruler, Layers, Target, Navigation, Crosshair } from 'lucide-react';
import SearchNavEngine from './SearchNavEngine';

const ControlPanel = ({
    // 状态
    isLocating, isMeasuring, measurePoints, measureDistance, baseMapType, weatherType, filters,
    // 操作方法
    handleSearchLocationFound, locatePlayer, setIsMeasuring, setMeasurePoints, setMeasureDistance, clearMeasurement, setBaseMapType, setWeatherType, toggleFilter
}) => {
    return (
        <div className="flex flex-col gap-4">
            {/* 1. 搜索中枢 */}
            <SearchNavEngine onLocationFound={handleSearchLocationFound} />

            {/* 2. 坐标注入 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                    <Navigation className="w-4 h-4 mr-2" /> 实体坐标同步
                </div>
                <button onClick={locatePlayer} disabled={isLocating} className="w-full py-2.5 rounded-xl font-bold text-sm bg-cyan-600 text-white flex justify-center items-center transition-all hover:bg-cyan-700">
                    {isLocating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crosshair className="w-4 h-4 mr-2" />}
                    {isLocating ? '连接卫星中...' : '注入真实坐标'}
                </button>
            </div>

            {/* 3. 测距雷达 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                    <Ruler className="w-4 h-4 mr-2" /> 战术雷达
                </div>
                <button onClick={() => { setIsMeasuring(!isMeasuring); setMeasurePoints([]); setMeasureDistance(0); }} className={`w-full py-2.5 rounded-xl font-bold text-sm flex justify-center items-center border-2 transition-all ${isMeasuring ? 'bg-yellow-50 text-yellow-700 border-yellow-400' : 'bg-zinc-900 text-yellow-400 border-zinc-900 hover:bg-zinc-800'}`}>
                    <Target className="w-4 h-4 mr-2" />
                    {isMeasuring ? '瞄准中...' : '启动测距雷达'}
                </button>
                {measurePoints.length === 2 && (
                    <div className="mt-3 flex justify-between items-center text-sm font-bold bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                        <span className="text-zinc-800">{(measureDistance / 1000).toFixed(2)} km</span>
                        <button onClick={clearMeasurement} className="text-red-500 hover:text-red-700 bg-red-50 px-3 py-1 rounded-md">清除</button>
                    </div>
                )}
            </div>

            {/* 4. 环境矩阵 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                    <Globe className="w-4 h-4 mr-2" /> 环境矩阵
                </div>
                <div className="flex bg-gray-100 p-1.5 rounded-xl mb-3">
                    <button onClick={() => setBaseMapType('topo')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'topo' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><MapIcon className="w-3 h-3 mr-1" /> 拓扑</button>
                    <button onClick={() => setBaseMapType('satellite')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'satellite' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Globe className="w-3 h-3 mr-1" /> 卫星</button>
                    <button onClick={() => setBaseMapType('dark')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${baseMapType === 'dark' ? 'bg-zinc-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Moon className="w-3 h-3 mr-1" /> 暗黑</button>
                </div>
                <div className="flex bg-rose-50 p-1.5 rounded-xl border border-rose-100">
                    <button onClick={() => setWeatherType('none')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${weatherType === 'none' ? 'bg-white text-rose-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}>关闭</button>
                    <button onClick={() => setWeatherType('precipitation_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${weatherType === 'precipitation_new' ? 'bg-white text-blue-600 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><CloudRain className="w-3 h-3 mr-1" /> 降雨</button>
                    <button onClick={() => setWeatherType('clouds_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center transition-all ${weatherType === 'clouds_new' ? 'bg-white text-gray-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'}`}><Cloud className="w-3 h-3 mr-1" /> 云层</button>
                </div>
            </div>

            {/* 5. 战术过滤 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 flex-1">
                <div className="flex items-center text-gray-500 font-bold text-xs uppercase tracking-wider mb-3">
                    <Layers className="w-4 h-4 mr-2" /> 战术图层
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => toggleFilter('framework')} className={`py-2 rounded-xl text-xs font-bold border transition-all ${filters.framework ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-gray-50 text-gray-400'}`}>🛤️ 骨架</button>
                    {[
                        { id: 'station', l: '🚉 车站', c: 'blue' },
                        { id: 'airport', l: '✈️ 机场', c: 'purple' },
                        { id: 'anime', l: '🌸 圣地', c: 'pink' },
                        { id: 'hotel', l: '🏨 住宿', c: 'orange' },
                        { id: 'spot', l: '📍 地标', c: 'cyan' }
                    ].map(b => (
                        <button key={b.id} onClick={() => toggleFilter(b.id)} className={`py-2 rounded-xl text-xs font-bold border transition-all ${filters[b.id] ? `bg-${b.c}-50 text-${b.c}-700 border-${b.c}-200 shadow-sm` : 'bg-gray-50 text-gray-400'}`}>{b.l}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;