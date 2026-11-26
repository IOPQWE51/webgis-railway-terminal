import { useState, useMemo } from 'react';
import { Calendar, MapPin, Sparkles, ExternalLink, Navigation } from 'lucide-react';
import { HANABI_DATA } from '../config/regions';

const getEventTiming = (dateStr, todayStr) => {
    if (!dateStr) return { isPast: false, label: '待定', cls: 'bg-slate-100 text-slate-600' };
    if (dateStr < todayStr) {
        return { isPast: true, label: '已结束', cls: 'bg-slate-200 text-slate-500' };
    }
    if (dateStr === todayStr) {
        return { isPast: false, label: '今日举办', cls: 'bg-rose-100 text-rose-700' };
    }
    const diffDays = Math.ceil((new Date(`${dateStr}T00:00:00Z`) - new Date(`${todayStr}T00:00:00Z`)) / 86400000);
    return {
        isPast: false,
        label: diffDays <= 60 ? `${diffDays} 天后` : '即将举办',
        cls: 'bg-green-100 text-green-700'
    };
};

const HanabiRadar = ({ isActive, onLocateOnMap }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [onlyUpcoming, setOnlyUpcoming] = useState(false);
    const todayStr = new Date().toISOString().slice(0, 10);

    const filteredData = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return HANABI_DATA
            .map((event) => ({ ...event, timing: getEventTiming(event.date, todayStr) }))
            .filter((event) => {
                if (onlyUpcoming && event.timing.isPast) return false;
                if (!q) return true;
                return event.name.toLowerCase().includes(q) || event.location.toLowerCase().includes(q);
            })
            .sort((a, b) => {
                if (a.timing.isPast !== b.timing.isPast) return a.timing.isPast ? 1 : -1;
                return a.date.localeCompare(b.date);
            });
    }, [searchQuery, onlyUpcoming, todayStr]);

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto`}>
            <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
                
                {/* 模块标题 */}
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <div>
                        <h3 className="font-black text-2xl text-gray-900 flex items-center">
                            <Sparkles className="w-6 h-6 mr-2 text-rose-500" />
                            花火大会日程（日本专题）
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-widest uppercase">Hanabi Schedule & Map Links</p>
                    </div>
                    <a 
                        href="https://hanabi.cloud/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center px-4 py-2 bg-rose-50 text-rose-600 rounded-full text-sm font-bold hover:bg-rose-100 transition-colors"
                    >
                        数据源: Hanabi.cloud <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                </div>

                {/* 搜索与时间过滤 */}
                <div className="mb-6 flex flex-col sm:flex-row gap-3">
                    <input 
                        type="text" 
                        placeholder="搜索花火大会名称或地点..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setOnlyUpcoming((v) => !v)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors shrink-0 ${
                            onlyUpcoming
                                ? 'bg-rose-50 text-rose-600 border-rose-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        {onlyUpcoming ? '✓ 仅看未开始' : '隐藏已结束'}
                    </button>
                </div>

                {/* 数据列表 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredData.map((event) => (
                        <div key={event.id} className={`bg-slate-50 p-5 rounded-2xl border border-slate-200 hover:border-rose-200 hover:shadow-md transition-all group ${event.timing.isPast ? 'opacity-75' : ''}`}>
                            <div className="flex justify-between items-start gap-2 mb-3">
                                <h4 className="font-bold text-gray-900 text-lg group-hover:text-rose-600 transition-colors">{event.name}</h4>
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded ${event.timing.cls}`}>
                                    {event.timing.label}
                                </span>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600 font-medium">
                                <p className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-400" /> {event.date}</p>
                                <p className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400" /> {event.location}</p>
                                <p className="flex items-center"><Sparkles className="w-4 h-4 mr-2 text-rose-400" /> {event.scale}</p>
                            </div>
                            {onLocateOnMap && Number.isFinite(event.lat) && Number.isFinite(event.lon) && (
                                <button
                                    type="button"
                                    onClick={() => onLocateOnMap({
                                        id: `hanabi_${event.id}`,
                                        name: event.name,
                                        lat: event.lat,
                                        lon: event.lon,
                                        category: 'spot',
                                        source: `${event.date} · ${event.location}`
                                    })}
                                    className="mt-4 w-full py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <Navigation className="w-3.5 h-3.5" /> 在地图上查看
                                </button>
                            )}
                        </div>
                    ))}
                    {filteredData.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-400 font-bold">
                            {onlyUpcoming ? '当前年度已收录场次均已结束，关闭筛选可查看历史日程' : '没有找到匹配的花火大会记录'}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default HanabiRadar;