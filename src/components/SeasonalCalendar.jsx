import { useMemo, useState } from 'react';
import { Calendar, Compass, MapPin, Search, Sun, Train, Camera, RotateCcw } from 'lucide-react';
import {
    SEASONAL_THEMES,
    SEASONAL_WINDOWS,
    filterSeasonalWindows,
    resolveNextPeakDate,
} from '../config/seasonalWindows';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const THEME_MAP = Object.fromEntries(SEASONAL_THEMES.map((t) => [t.id, t]));

const SeasonalCalendar = ({ onExploreWindow }) => {
    const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
    const [selectedMonth, setSelectedMonth] = useState(0); // 0 = 全年
    const [selectedTheme, setSelectedTheme] = useState('all');
    const [query, setQuery] = useState('');

    const matchedWindows = useMemo(
        () => filterSeasonalWindows({ month: selectedMonth, theme: selectedTheme, query }),
        [selectedMonth, selectedTheme, query]
    );

    const monthCounts = useMemo(() => {
        const counts = {};
        for (const m of MONTHS) {
            counts[m] = SEASONAL_WINDOWS.filter((w) => w.months.includes(m)).length;
        }
        return counts;
    }, []);

    const hasActiveFilters = selectedMonth !== 0 || selectedTheme !== 'all' || query.trim() !== '';

    const handleReset = () => {
        setSelectedMonth(0);
        setSelectedTheme('all');
        setQuery('');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* 顶部控制面板：按计划出行月份 & 主题反查全球摄影与铁道黄金窗口 */}
            <section className="bg-paper-2/92 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 md:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="font-display text-2xl text-ink flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-sora" />
                            全球季节与光影窗口
                        </h3>
                        <p className="text-xs text-ink-3 mt-1">
                            按计划出行月份反查全球摄影与景观铁道黄金期，一键飞往地图并自动同步该窗口峰值日期的日出日落与太阳方位角。
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedMonth(selectedMonth === currentMonth ? 0 : currentMonth)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                                selectedMonth === currentMonth
                                    ? 'bg-kouchou-soft text-ink border-kouchou/50'
                                    : 'bg-paper-3 text-ink-2 border-line/80 hover:border-sora/40 hover:text-sora-deep'
                            }`}
                        >
                            {selectedMonth === currentMonth ? `✓ 当月 (${currentMonth}月)` : `看当月 (${currentMonth}月)`}
                        </button>
                        <span className="text-[11px] font-bold text-ink-3 bg-paper-3 px-3 py-1.5 rounded-full border border-line/70">
                            匹配 {matchedWindows.length} / {SEASONAL_WINDOWS.length} 处
                        </span>
                    </div>
                </div>

                {/* 1~12 月出行月份胶囊条 */}
                <div>
                    <div className="text-[11px] font-bold text-ink-3 mb-2">按计划出行月份筛选</div>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => setSelectedMonth(0)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                selectedMonth === 0
                                    ? 'bg-sora text-sora-ink border-sora shadow-sm'
                                    : 'bg-paper-3/70 text-ink-2 border-line/80 hover:bg-sora-soft/50 hover:text-ink'
                            }`}
                        >
                            全年
                        </button>
                        {MONTHS.map((m) => {
                            const active = selectedMonth === m;
                            const isNow = m === currentMonth;
                            return (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setSelectedMonth(m)}
                                    className={`relative px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                        active
                                            ? 'bg-sora text-sora-ink border-sora shadow-sm'
                                            : 'bg-paper-3/70 text-ink-2 border-line/80 hover:bg-sora-soft/50 hover:text-ink'
                                    }`}
                                    title={`${m}月共有 ${monthCounts[m]} 个推荐季节窗口`}
                                >
                                    <span>{m}月</span>
                                    <span className={`ml-1 text-[10px] font-mono ${active ? 'opacity-85' : 'text-ink-3'}`}>
                                        {monthCounts[m]}
                                    </span>
                                    {isNow && (
                                        <span
                                            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${active ? 'bg-kouchou' : 'bg-sora'}`}
                                            aria-label="当月"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 主题筛选 + 关键词搜索 */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-line/70">
                    <div className="flex flex-wrap gap-1.5">
                        {SEASONAL_THEMES.map((theme) => {
                            const active = selectedTheme === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setSelectedTheme(theme.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                        active
                                            ? 'bg-wakaba-soft text-ink border-wakaba/60 shadow-sm'
                                            : 'bg-paper-3/60 text-ink-2 border-line/70 hover:bg-wakaba-soft/40 hover:text-ink'
                                    }`}
                                >
                                    <span aria-hidden="true">{theme.icon}</span>
                                    <span>{theme.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative w-full lg:w-64 shrink-0">
                        <Search className="w-3.5 h-3.5 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜国家、城市、樱花、列车…"
                            aria-label="搜索全球季节窗口"
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-paper-3/80 border border-line/80 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-sora"
                        />
                    </div>
                </div>
            </section>

            {/* 季节窗口卡片网格 */}
            {matchedWindows.length === 0 ? (
                <div className="bg-paper-2/90 backdrop-blur-md rounded-3xl border border-line p-10 text-center space-y-3">
                    <Compass className="w-8 h-8 text-ink-3 mx-auto opacity-60" />
                    <p className="text-sm font-bold text-ink">当前筛选条件下暂无匹配的季节窗口</p>
                    <p className="text-xs text-ink-3">可以切换其他月份、放宽主题或清空关键词试试。</p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleReset}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sora text-sora-ink hover:opacity-95 transition-opacity"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> 重置筛选
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matchedWindows.map((w) => {
                        const themeInfo = THEME_MAP[w.theme] || { icon: '🌍', label: '季节' };
                        const peakDate = resolveNextPeakDate(w.peakMonth, w.peakDay);
                        return (
                            <article
                                key={w.id}
                                className="bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 flex flex-col justify-between gap-4 hover:border-sora/50 transition-colors"
                            >
                                <div className="space-y-3">
                                    {/* 头部标题与时间窗口 */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <span className="text-2xl leading-none shrink-0 mt-0.5" aria-hidden="true">
                                                {w.icon}
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-black text-ink leading-snug">
                                                    {w.name}
                                                </h4>
                                                <div className="text-[11px] text-ink-3 mt-0.5">
                                                    {w.country} · {w.region}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-paper-3 text-ink-2 border border-line/70">
                                            <span aria-hidden="true">{themeInfo.icon}</span>
                                            {themeInfo.label}
                                        </span>
                                    </div>

                                    {/* 最佳季节时间标签 */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sora-soft/80 text-sora-deep text-[11px] font-bold">
                                            <Calendar className="w-3 h-3" />
                                            {w.windowLabel}
                                        </span>
                                        <span className="text-[10px] font-mono text-ink-3 px-2 py-0.5 rounded-full bg-paper-3/70">
                                            峰值参考 {peakDate}
                                        </span>
                                    </div>

                                    {/* 铁道与光影两条核心干货 */}
                                    <div className="space-y-2 text-xs text-ink-2 leading-relaxed">
                                        <div className="p-2.5 rounded-2xl bg-wakaba-soft/35 border border-wakaba/20 flex items-start gap-2">
                                            <Train className="w-3.5 h-3.5 text-wakaba shrink-0 mt-0.5" />
                                            <span>{w.railTip}</span>
                                        </div>
                                        <div className="p-2.5 rounded-2xl bg-kouchou-soft/40 border border-kouchou/25 flex items-start gap-2">
                                            <Camera className="w-3.5 h-3.5 text-kouchou shrink-0 mt-0.5" />
                                            <span>{w.photoTip}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 底部动作：飞往地图并联动规划光影日期 */}
                                <div className="pt-3 border-t border-line/70 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-mono text-ink-3">
                                        {Math.abs(w.lat).toFixed(2)}°{w.lat >= 0 ? 'N' : 'S'}, {Math.abs(w.lon).toFixed(2)}°{w.lon >= 0 ? 'E' : 'W'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onExploreWindow?.({ ...w, planDate: peakDate })}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-sora text-sora-ink shadow-sm hover:opacity-95 transition-opacity"
                                        title={`飞往 ${w.name} 并将地图光影日期自动切换至 ${peakDate}`}
                                    >
                                        <Sun className="w-3.5 h-3.5" />
                                        <span>在地图看该窗口光影</span>
                                        <MapPin className="w-3 h-3 opacity-80" />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SeasonalCalendar;
