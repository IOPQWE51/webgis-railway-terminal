import { useMemo, useState } from 'react';
import { PlaneTakeoff, ExternalLink, AlertTriangle, Info, Ticket, BaggageClaim, Globe, ArrowLeftRight, Map as MapIcon, Compass } from 'lucide-react';
import {
    AIRPORT_HUBS,
    POPULAR_FLIGHT_PAIRS,
    estimateFlightStats,
    findNearestAirportHub
} from '../utils/flightArc';
import { buildItineraryDays } from '../utils/itinerary';

const FLIGHT_PORTALS = [
    {
        name: '天巡 Skyscanner',
        tag: '整月低价日历',
        desc: '支持「出发地 → 探索世界各地」模糊比价，适合提前找全年低价窗口。',
        url: 'https://www.tianxun.com/',
        cta: '打开天巡',
    },
    {
        name: 'Google Flights',
        tag: '路线图 + 价格趋势',
        desc: '全球航司直连速度快、历史价格曲线直观，适合筛选直飞与跨洲中转。',
        url: 'https://www.google.com/travel/flights',
        cta: '打开 Google Flights',
    },
    {
        name: 'Kiwi.com',
        tag: '跨航司自由拼接',
        desc: '擅长把多家廉航与铁路拼成低价联程方案，适合欧洲/东南亚跳岛行程。',
        url: 'https://www.kiwi.com/',
        cta: '打开 Kiwi',
    },
];

const LCC_GUIDES = [
    {
        code: '9C 春秋',
        region: '东亚航线',
        badgeCls: 'text-emerald-700 bg-wakaba-soft',
        title: '行李额度的绝对红线',
        body: <>春秋的行李额包含<strong className="text-ink">手提+托运总计</strong>（通常 15kg 或 20kg），登机口称重与体积检查非常严格，超重逾重费高昂，务必提前在线加购。</>,
        meta: '随身限 1 件 (7kg 内 · 20×30×40cm)',
        icon: BaggageClaim,
    },
    {
        code: 'MM 乐桃',
        region: '日本航线',
        badgeCls: 'text-rose-700 bg-koi-soft',
        title: '远机位与独立航站楼',
        body: <>在大阪关西机场 (KIX)，乐桃独占偏远的 <strong className="text-ink">T2 航站楼</strong>，需从 T1 乘免费接驳巴士（约 10 分钟），务必多预留至少 40 分钟。</>,
        meta: 'KIX T2 / NRT T1 北翼',
        icon: Info,
    },
    {
        code: 'FR / U2 欧廉',
        region: '欧洲航线',
        badgeCls: 'text-sky-700 bg-sora-soft',
        title: '线上值机与随身包尺寸铁律',
        body: <>瑞安 (Ryanair) 等欧洲廉航要求<strong className="text-ink">起飞前线上值机</strong>，到机场柜台补办会收取数十欧元高额手续费；免费随身包仅限小背包。</>,
        meta: '起飞前 24h 内记得 App 值机',
        icon: BaggageClaim,
    },
    {
        code: 'AK 亚航',
        region: '东南亚航线',
        badgeCls: 'text-amber-800 bg-kouchou-soft',
        title: '7kg 手提复称与 KLIA2 步行距离',
        body: <>亚航登机口常对随身行李做<strong className="text-ink">二次复称</strong>（主包+随身小包合计 ≤7kg）；吉隆坡 KLIA2 航站楼动线极长，转机预留充足步行与过关时间。</>,
        meta: 'KUL KLIA2 / 随身合计 ≤7kg',
        icon: Info,
    },
];

const AviationEngine = ({ isActive, customPoints = [], onShowFlightArc = null }) => {
    const [fromCode, setFromCode] = useState('PVG');
    const [toCode, setToCode] = useState('KIX');

    const fromHub = useMemo(() => AIRPORT_HUBS.find((h) => h.code === fromCode) || AIRPORT_HUBS[0], [fromCode]);
    const toHub = useMemo(() => AIRPORT_HUBS.find((h) => h.code === toCode) || AIRPORT_HUBS[1], [toCode]);
    const stats = useMemo(
        () => (fromHub && toHub && fromHub.code !== toHub.code ? estimateFlightStats(fromHub.lat, fromHub.lon, toHub.lat, toHub.lon) : null),
        [fromHub, toHub]
    );

    const itineraryAnchors = useMemo(() => {
        const { days } = buildItineraryDays(customPoints);
        const allStops = days.flatMap((d) => d.stops);
        if (allStops.length < 2) return null;
        const first = findNearestAirportHub(allStops[0].lat, allStops[0].lon);
        const last = findNearestAirportHub(allStops[allStops.length - 1].lat, allStops[allStops.length - 1].lon);
        if (!first || !last || first.code === last.code) return null;
        return { first, last };
    }, [customPoints]);

    const dynamicGoogleFlightsUrl = fromHub && toHub
        ? `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${fromHub.code} to ${toHub.code}`)}`
        : 'https://www.google.com/travel/flights';

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in fade-in duration-300 max-w-5xl mx-auto space-y-5`}>
            {/* 大圆航线地图联动卡 */}
            <div className="bg-paper-2/95 backdrop-blur-md border border-line rounded-3xl p-6 md:p-8 shadow-lift">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div>
                        <h3 className="font-display text-2xl text-ink flex items-center gap-2">
                            <PlaneTakeoff className="w-5 h-5 text-sora" />
                            全球机票与大圆航线
                        </h3>
                        <p className="text-xs text-ink-3 mt-1">选择起降枢纽估算大圆航程与飞行时间，一键在地图绘制跨洲航线弧线并跳转比价。</p>
                    </div>
                    {itineraryAnchors && (
                        <button
                            type="button"
                            onClick={() => {
                                setFromCode(itineraryAnchors.first.code);
                                setToCode(itineraryAnchors.last.code);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-wakaba-soft text-ink border border-wakaba/35 hover:border-wakaba transition-colors"
                        >
                            <Compass className="w-3.5 h-3.5 text-wakaba" />
                            联动行程起终点 ({itineraryAnchors.first.code} → {itineraryAnchors.last.code})
                        </button>
                    )}
                </div>

                {/* 起降枢纽选择器 */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center mb-4">
                    <div className="bg-paper-3/70 border border-line rounded-2xl px-3.5 py-2.5">
                        <div className="text-[10px] font-bold text-ink-3 mb-1">出发枢纽 Origin</div>
                        <select
                            value={fromCode}
                            onChange={(e) => setFromCode(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-ink outline-none cursor-pointer"
                        >
                            {AIRPORT_HUBS.map((h) => (
                                <option key={h.code} value={h.code}>{h.code} · {h.name} ({h.region})</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => { setFromCode(toCode); setToCode(fromCode); }}
                        className="mx-auto p-2.5 rounded-full bg-paper-3 hover:bg-sora-soft text-ink-2 hover:text-sora-deep border border-line transition-colors"
                        title="交换起降机场"
                        aria-label="交换起降机场"
                    >
                        <ArrowLeftRight className="w-4 h-4" />
                    </button>

                    <div className="bg-paper-3/70 border border-line rounded-2xl px-3.5 py-2.5">
                        <div className="text-[10px] font-bold text-ink-3 mb-1">到达枢纽 Destination</div>
                        <select
                            value={toCode}
                            onChange={(e) => setToCode(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-ink outline-none cursor-pointer"
                        >
                            {AIRPORT_HUBS.map((h) => (
                                <option key={h.code} value={h.code}>{h.code} · {h.name} ({h.region})</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        disabled={!stats || !onShowFlightArc}
                        onClick={() => onShowFlightArc?.({ from: fromHub, to: toHub, stats })}
                        className="h-full px-5 py-3 rounded-2xl bg-sora hover:bg-sora-deep disabled:opacity-45 text-sora-ink text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                        <MapIcon className="w-4 h-4" /> 在地图绘制航线
                    </button>
                </div>

                {/* 航程概览 + 热门快捷组合 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/70">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {POPULAR_FLIGHT_PAIRS.map((pair) => (
                            <button
                                key={`${pair.from}-${pair.to}`}
                                type="button"
                                onClick={() => { setFromCode(pair.from); setToCode(pair.to); }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                                    fromCode === pair.from && toCode === pair.to
                                        ? 'bg-sora text-sora-ink border-sora'
                                        : 'bg-paper-3/70 text-ink-2 border-line/80 hover:border-sora/50'
                                }`}
                            >
                                {pair.label}
                            </button>
                        ))}
                    </div>

                    {stats ? (
                        <div className="flex items-center gap-3 text-xs font-mono font-bold text-ink bg-sora-soft/60 px-3.5 py-1.5 rounded-xl border border-sora/25">
                            <span>大圆航距 {stats.distanceKm.toLocaleString()} km</span>
                            <span className="text-line">|</span>
                            <span className="text-sora-deep">直飞 {stats.durationLabel}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-ink-3">请选择两个不同的机场枢纽</span>
                    )}
                </div>
            </div>

            {/* 全球比价入口 */}
            <div className="bg-paper-2/95 backdrop-blur-md border border-line rounded-3xl p-6 md:p-8 shadow-lift">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-sora" /> 常用跨国比价工具
                    </h4>
                    <span className="text-[11px] text-ink-3">Google Flights 链接已自动带入当前 {fromCode} → {toCode}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {FLIGHT_PORTALS.map((portal) => {
                        const targetUrl = portal.name === 'Google Flights' ? dynamicGoogleFlightsUrl : portal.url;
                        return (
                            <div key={portal.name} className="bg-paper-3/65 border border-line/80 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-sora/50 transition-colors">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
                                            <Ticket className="w-4 h-4 text-sora" /> {portal.name}
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sora-soft text-sora-deep">
                                            {portal.tag}
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-2 leading-relaxed">{portal.desc}</p>
                                </div>
                                <a
                                    href={targetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-paper-2 hover:bg-sora hover:text-sora-ink text-sora-deep border border-sora/30 text-xs font-bold transition-colors"
                                >
                                    {portal.cta} <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 全球廉航避坑卡片 */}
            <div className="bg-paper-2/95 backdrop-blur-md border border-line rounded-3xl p-6 md:p-8 shadow-lift">
                <div className="flex items-center justify-between mb-5">
                    <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-kouchou" />
                        全球常见廉价航空 (LCC) 避坑参考
                    </h4>
                    <span className="text-[11px] text-ink-3 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> 东亚 · 欧洲 · 东南亚
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {LCC_GUIDES.map((item) => {
                        const MetaIcon = item.icon;
                        return (
                            <div key={item.code} className="bg-paper-3/60 p-4 rounded-2xl border border-line/80">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-black px-2 py-0.5 rounded-md text-xs ${item.badgeCls}`}>{item.code}</span>
                                        <span className="font-bold text-ink text-sm">{item.title}</span>
                                    </div>
                                    <span className="text-[10px] text-ink-3 shrink-0">{item.region}</span>
                                </div>
                                <p className="text-xs text-ink-2 leading-relaxed mb-2.5">{item.body}</p>
                                <p className="text-[11px] text-ink-3 flex items-center font-mono">
                                    <MetaIcon className="w-3 h-3 mr-1.5 shrink-0" /> {item.meta}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AviationEngine;