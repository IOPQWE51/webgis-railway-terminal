import { PlaneTakeoff, ExternalLink, AlertTriangle, Info, Ticket, BaggageClaim, Globe } from 'lucide-react';

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

const AviationEngine = ({ isActive }) => {
    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in fade-in duration-300 max-w-5xl mx-auto space-y-5`}>
            {/* 全球比价入口 */}
            <div className="bg-paper-2/95 backdrop-blur-md border border-line rounded-3xl p-6 md:p-8 shadow-lift">
                <div className="mb-6">
                    <h3 className="font-display text-2xl text-ink flex items-center gap-2">
                        <PlaneTakeoff className="w-5 h-5 text-sora" />
                        全球机票与航线指南
                    </h3>
                    <p className="text-xs text-ink-3 mt-1">常用跨国比价工具与各区域廉价航空 (LCC) 乘机避坑速查。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {FLIGHT_PORTALS.map((portal) => (
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
                                href={portal.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-paper-2 hover:bg-sora hover:text-sora-ink text-sora-deep border border-sora/30 text-xs font-bold transition-colors"
                            >
                                {portal.cta} <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    ))}
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