import { useState, useEffect, useRef } from 'react';
import { CloudRain, Cloud, Map as MapIcon, Moon, Globe, Ruler, Layers, Compass } from 'lucide-react';
import QrViewShare from './QrViewShare';
import { REGION_REGISTRY } from '../config/regions';

/**
 * 🧭 悬浮轻量工具条（天の川浅色毛玻璃）
 * 收起所有低频配置，点按才向左侧弹出轻量浮层，把最大面积还给地图。
 */
const ControlPanel = ({
    isMeasuring, baseMapType, weatherType, filters, shareView,
    setIsMeasuring, setMeasurePoints, setMeasureDistance, setBaseMapType, setWeatherType, toggleFilter, onEnterTactical, onJumpToRegion
}) => {
    const [openPanel, setOpenPanel] = useState(null); // null | 'map' | 'layers'
    const dockRef = useRef(null);

    useEffect(() => {
        if (!openPanel) return undefined;
        const onPointerDown = (e) => {
            if (dockRef.current && !dockRef.current.contains(e.target)) {
                setOpenPanel(null);
            }
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setOpenPanel(null);
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [openPanel]);

    const togglePanel = (name) => setOpenPanel((cur) => (cur === name ? null : name));

    return (
        <div ref={dockRef} className="relative flex items-start gap-2">
            {/* 左侧弹出的轻量配置浮层 */}
            {openPanel === 'map' && (
                <div className="w-[248px] rounded-2xl bg-paper-2/95 backdrop-blur-xl border border-line shadow-xl p-3.5 text-ink animate-in fade-in duration-150">
                    <div className="text-xs font-bold text-ink-2 mb-2.5 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-sora" /> 底图样式
                    </div>
                    <div className="flex bg-paper-3 p-1 rounded-xl mb-3.5">
                        <button type="button" onClick={() => setBaseMapType('topo')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all ${baseMapType === 'topo' ? 'bg-paper-2 text-sora-deep shadow-sm' : 'text-ink-3 hover:text-ink'}`}>
                            <MapIcon className="w-3 h-3" /> 地形
                        </button>
                        <button type="button" onClick={() => setBaseMapType('satellite')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all ${baseMapType === 'satellite' ? 'bg-paper-2 text-sora-deep shadow-sm' : 'text-ink-3 hover:text-ink'}`}>
                            <Globe className="w-3 h-3" /> 卫星
                        </button>
                        <button type="button" onClick={() => setBaseMapType('dark')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all ${baseMapType === 'dark' ? 'bg-ink text-white shadow-sm' : 'text-ink-3 hover:text-ink'}`}>
                            <Moon className="w-3 h-3" /> 暗黑
                        </button>
                    </div>

                    <div className="text-xs font-bold text-ink-2 mb-2 flex items-center gap-1.5">
                        <CloudRain className="w-3.5 h-3.5 text-sora" /> 气象雷达叠加
                    </div>
                    <div className="flex bg-paper-3 p-1 rounded-xl">
                        <button type="button" onClick={() => setWeatherType('none')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${weatherType === 'none' ? 'bg-paper-2 text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}>关闭</button>
                        <button type="button" onClick={() => setWeatherType('precipitation_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all ${weatherType === 'precipitation_new' ? 'bg-paper-2 text-sora-deep shadow-sm' : 'text-ink-3 hover:text-ink'}`}>
                            <CloudRain className="w-3 h-3" /> 降雨
                        </button>
                        <button type="button" onClick={() => setWeatherType('clouds_new')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex justify-center items-center gap-1 transition-all ${weatherType === 'clouds_new' ? 'bg-paper-2 text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}>
                            <Cloud className="w-3 h-3" /> 云层
                        </button>
                    </div>
                </div>
            )}

            {openPanel === 'layers' && (
                <div className="w-[248px] rounded-2xl bg-paper-2/95 backdrop-blur-xl border border-line shadow-xl p-3.5 text-ink animate-in fade-in duration-150">
                    <div className="text-xs font-bold text-ink-2 mb-2.5 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-sora" /> 显示图层
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => toggleFilter('framework')} className={`py-2 rounded-xl text-xs font-bold border transition-all ${filters.framework ? 'bg-wakaba-soft text-ink border-wakaba/40 shadow-sm' : 'bg-paper-3/60 text-ink-3 border-transparent'}`}>
                            🛤️ 交通骨架
                        </button>
                        {[
                            { id: 'camera', l: '📷 机位', activeCls: 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm' },
                            { id: 'station', l: '🚉 车站', activeCls: 'bg-sora-soft text-sora-deep border-sora/30 shadow-sm' },
                            { id: 'airport', l: '✈️ 机场', activeCls: 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm' },
                            { id: 'anime', l: '🌸 巡礼', activeCls: 'bg-koi-soft text-ink border-koi/30 shadow-sm' },
                            { id: 'hotel', l: '🏨 住宿', activeCls: 'bg-kouchou-soft text-ink border-kouchou/40 shadow-sm' },
                            { id: 'spot', l: '📍 地标', activeCls: 'bg-cyan-50 text-cyan-700 border-cyan-200 shadow-sm' }
                        ].map((b) => (
                            <button key={b.id} type="button" onClick={() => toggleFilter(b.id)} className={`py-2 rounded-xl text-xs font-bold border transition-all ${filters[b.id] ? b.activeCls : 'bg-paper-3/60 text-ink-3 border-transparent'}`}>
                                {b.l}
                            </button>
                        ))}
                    </div>

                    {onJumpToRegion && REGION_REGISTRY.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-line/70">
                            <div className="text-[11px] font-bold text-ink-3 mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1"><Compass className="w-3 h-3" /> 区域交通骨架</span>
                                <span>持续扩展</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {REGION_REGISTRY.map((region) => (
                                    <button
                                        key={region.id}
                                        type="button"
                                        onClick={() => { onJumpToRegion(region); setOpenPanel(null); }}
                                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-wakaba-soft text-ink border border-wakaba/30 hover:border-wakaba transition-colors flex items-center gap-1"
                                    >
                                        <span>{region.icon || '🌍'}</span>
                                        <span>{region.name}铁道</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 右侧细长竖排悬浮工具条（零滚动条、轻盈直观） */}
            <div className="flex flex-col gap-1 p-1.5 rounded-2xl bg-paper-2/90 backdrop-blur-md border border-line/90 shadow-lift">
                <button
                    type="button"
                    onClick={() => togglePanel('map')}
                    aria-expanded={openPanel === 'map'}
                    title="切换底图与气象图层"
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${openPanel === 'map' || weatherType !== 'none' ? 'bg-sora text-sora-ink shadow-sm' : 'text-ink-2 hover:bg-sora-soft/60 hover:text-sora-deep'}`}
                >
                    <Globe className="w-4 h-4" />
                    <span>底图</span>
                </button>

                <button
                    type="button"
                    onClick={() => togglePanel('layers')}
                    aria-expanded={openPanel === 'layers'}
                    title="筛选图层与交通骨架"
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${openPanel === 'layers' ? 'bg-sora text-sora-ink shadow-sm' : 'text-ink-2 hover:bg-sora-soft/60 hover:text-sora-deep'}`}
                >
                    <Layers className="w-4 h-4" />
                    <span>图层</span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setOpenPanel(null);
                        setIsMeasuring(!isMeasuring);
                        setMeasurePoints([]);
                        setMeasureDistance(0);
                    }}
                    aria-pressed={isMeasuring}
                    title={isMeasuring ? '退出测距模式' : '两点测距'}
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${isMeasuring ? 'bg-kouchou-soft text-ink ring-1 ring-kouchou shadow-sm' : 'text-ink-2 hover:bg-sora-soft/60 hover:text-sora-deep'}`}
                >
                    <Ruler className="w-4 h-4" />
                    <span>测距</span>
                </button>

                <QrViewShare variant="light" compact={true} view={shareView} />

                {onEnterTactical && (
                    <>
                        <div className="h-px bg-line/80 mx-1.5 my-0.5" />
                        <button
                            type="button"
                            onClick={onEnterTactical}
                            title="切换暗黑专业地图 (Dark 2D)"
                            className="w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-ink-2 hover:bg-ink hover:text-amber-300 transition-colors"
                        >
                            <Moon className="w-4 h-4" />
                            <span>暗黑</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ControlPanel;