import { useState } from 'react';
import { Train, CheckCircle2, XCircle, Globe, AlertTriangle, ShieldAlert, MapPin, Ticket } from 'lucide-react';
import { REGION_REGISTRY } from '../config/regions';
import RailPassCalculator from './RailPassCalculator';

/**
 * 按国家/地区划分的全球出行指南配置库 (交通票务 & 行为禁忌)
 */
const GLOBAL_RULES_CONFIG = [
    {
        id: 'china',
        regionPackId: 'cn',
        country: "中国",
        enName: "China",
        icon: "🇨🇳",
        subtitle: "国家铁路网与绿皮慢车探索指南",
        lastVerified: "2026-11",
        source: "12306 铁路客运规程 & 各地轨道交通安检规定",
        rules: [
            { name: "12306 实名购票", status: "yes", desc: "全路网实名制，高铁/普速统一在 12306 购票，无需打印纸质票，刷身份证直接进站。" },
            { name: "绿皮慢车 (普速列车)", status: "yes", desc: "K/T 字头慢车票价亲民，硬座穿越数省是感受中国大地的最优解，但旺季一票难求。" },
            { name: "地铁安检", status: "no", desc: "全国地铁进站均需安检（液体有时需试喝），高峰期预留 10 分钟排队时间。" }
        ],
        warnings: [
            { title: "火车禁烟零容忍", desc: "自 2026 年 5 月起全国普速列车（K/T/Z 字头）已全面实施全列禁烟，卫生间、车厢连接处、电子烟均禁止；高铁上吸烟触发警报可面临行政处罚。" },
            { title: "安检禁品清单", desc: "除了常规刀具易燃品，充电宝必须标称容量合规（≤100Wh）且随身携带不能托运，散装酒类不能带上车。" }
        ]
    },
    {
        id: 'japan',
        regionPackId: 'jp',
        country: "日本",
        enName: "Japan",
        icon: "🇯🇵",
        subtitle: "JR 铁道网络、青春 18 与日常礼仪",
        lastVerified: "2026-11",
        source: "JR 集团通票规则 & 日本公共交通礼仪指南",
        rules: [
            { name: "JR 青春 18 主干线", status: "yes", desc: "宗谷、函馆、东北、东海道、山阳、鹿儿岛本线等普通列车可按季通票无限次乘坐。" },
            { name: "JR 宫岛渡轮", status: "yes", desc: "JR 体系内的水上接驳，可直达广岛严岛神社。" },
            { name: "跨海新干线 / 特急", status: "no", desc: "如北海道新干线（函馆 - 新青森），普通通票不可直接乘坐，需另购特例票或改乘轮渡。" }
        ],
        warnings: [
            { title: "电车静音礼仪", desc: "在电车、公交内接打电话被视为严重失礼，乘车前建议将手机调至静音模式。" },
            { title: "无小费文化", desc: "日本没有小费文化，在餐桌留下零钱服务员大概率会追出来归还。" },
            { title: "街头禁烟与边走边吃", desc: "绝大多数城市街头严禁边走边吸烟（需到指定吸烟区），步行饮食在商店街外同样不礼貌。" }
        ]
    },
    {
        id: 'korea',
        regionPackId: 'kr',
        country: "韩国",
        enName: "South Korea",
        icon: "🇰🇷",
        subtitle: "KTX 高铁与首都圈地铁法则",
        lastVerified: "2026-11",
        source: "KORAIL 官网 & 首尔交通公社乘车规范",
        rules: [
            { name: "KTX 无闸口制", status: "yes", desc: "韩国车站不设剪票闸口，列车长在车厢内核对车票；KR Pass 持有人指定席划满时，可直接上 5-6 号自由座车厢找位。" },
            { name: "KR Pass 须提前划位", status: "yes", desc: "外国人专用的 KORAIL 通票，最早可在乘车日 31 天前线上划位；旺季指定席很快售罄，定了行程就立刻划。" },
            { name: "SRT 私铁不互通", status: "no", desc: "水西 SRT 由私铁 SR 公司运营，与 KORAIL 系统互不相通，KR Pass 不能乘坐，需另行购票；首尔地铁也要用 T-money 卡另算。" }
        ],
        warnings: [
            { title: "年龄即秩序", desc: "公共交通上主动给 60 岁以上长辈、孕妇、残障人士让座；聚餐时一般等桌上最年长者先动筷。" },
            { title: "优先席请留空", desc: "地铁老弱病孕优先席即使空着，年轻乘客通常也不坐，站着是常态。" }
        ]
    },
    {
        id: 'thailand',
        regionPackId: 'sea',
        country: "泰国",
        enName: "Thailand",
        icon: "🇹🇭",
        subtitle: "夜班卧铺火车与双条车生存手册",
        lastVerified: "2026-11",
        source: "泰国国家铁路 SRT D-Ticket & 旅游安全提示",
        rules: [
            { name: "国铁提前 60 天售票", status: "yes", desc: "泰国火车票全国联网，任一车站可买全程方向车票；按 1 等空调卧铺 / 2 等空调风扇卧铺 / 3 等风扇座分级。" },
            { name: "夜班卧铺是移动酒店", status: "yes", desc: "曼谷辐射清迈、合艾等线路的夜班卧铺体验极佳，提供毛毯；但空调开得非常冷，务必备厚外套。" }
        ],
        warnings: [
            { title: "尊重皇室法规", desc: "电影院放国歌时观众需起身致意；任何针对皇室成员的不当言论都可能触犯刑法，切勿拿来开玩笑。" },
            { title: "警惕“景点今天关闭”拉客", desc: "热门景点前若陌生人称大皇宫关闭、可低价带去别处，多为珠宝/消费圈套，直接礼貌拒绝并以官网信息为准。" }
        ]
    },
    {
        id: 'europe',
        regionPackId: 'eu',
        country: "欧洲",
        enName: "Europe",
        icon: "🇪🇺",
        subtitle: "Eurail 通票与申根区跨国铁道",
        lastVerified: "2026-11",
        source: "Eurail 官方订座规则 & 欧洲各国铁路实操整理",
        rules: [
            { name: "区域慢车 (Regional)", status: "yes", desc: "大多数区域慢车随时上车、无需订座，适合沿线慢游欧洲小镇。" },
            { name: "跨国高铁 (TGV / Eurostar)", status: "no", desc: "即使持有 Eurail 通票，跨国高速列车通常仍强制提前订座并加收订座费，旺季需尽早锁定。" }
        ],
        warnings: [
            { title: "纸质票上车前务必打卡 (Validating)", desc: "在意大利、法国等地使用纸质区域车票时，上车前必须在站台打卡机印上时间，否则查票将按逃票重罚。" },
            { title: "严格遵守交通信号", desc: "德国、瑞士等地红灯哪怕路上无车也不要闯行，可能面临当地罚款与严厉制止。" }
        ]
    },
    {
        id: 'uk',
        regionPackId: 'uk',
        country: "英国",
        enName: "United Kingdom",
        icon: "🇬🇧",
        subtitle: "高票价铁路网与拆分购票技巧",
        lastVerified: "2026-11",
        source: "National Rail Conditions of Travel & TfL 计费规则",
        rules: [
            { name: "拆分购票 (Split Ticketing) 合法", status: "yes", desc: "National Conditions of Carriage 第 14 条允许同一趟车拆成多段购票，常省 30% 以上，只要列车在分段站停靠即可。" },
            { name: "Advance 早鸟票抢法", status: "yes", desc: "行程确定后尽早买 Advance 票（最早提前约 12 周放票），叠加 Railcard 折扣卡可再省 1/3；错峰可选 Super Off-Peak。" },
            { name: "地铁进出站都要刷卡", status: "no", desc: "伦敦地铁进出站都须刷同一张实体卡或同一设备（iPhone 进 Apple Watch 出会按两张卡扣最高票价），公交只需上车刷一次。" }
        ],
        warnings: [
            { title: "部分列车门需手动按开", desc: "英国不少列车的车门到站不会自动打开，看到开门灯亮起时需自己按下车门按钮或拉手。" }
        ]
    },
    {
        id: 'usa',
        regionPackId: 'na',
        country: "美国",
        enName: "United States",
        icon: "🇺🇸",
        subtitle: "Amtrak 长途观光列车与日常规则",
        lastVerified: "2026-11",
        source: "Amtrak 乘车指南 & 北美出行常识",
        rules: [
            { name: "Amtrak 长途 = 移动观光酒店", status: "yes", desc: "卧铺包厢（Roomette/Bedroom）含餐车三餐与休息室，适合加州微风号等景观线路。" },
            { name: "餐车需预约", status: "no", desc: "餐车由乘务员按时段走访登记订座，座位票乘客也可前往观景车厢下层 Cafe 购买简餐。" },
            { name: "慢节奏观光定位", status: "no", desc: "除东北走廊（波士顿-纽约-华盛顿）外，美国铁路速度偏慢、班次少，更适合作为景观体验而非刚性通勤。" }
        ],
        warnings: [
            { title: "小费是服务业基本工资", desc: "堂食餐厅午餐通常 15-18%、晚餐 18-20%（按税前账单算）；6 人以上常已含 18% 服务费，付款前先核对账单。" }
        ]
    },
    {
        id: 'singapore',
        regionPackId: 'sea',
        country: "新加坡",
        enName: "Singapore",
        icon: "🇸🇬",
        subtitle: "高秩序城市公共交通与法规",
        lastVerified: "2026-11",
        source: "LTA SimplyGo & 新加坡公共法规手册",
        rules: [
            { name: "银行卡直接拍卡乘地铁", status: "yes", desc: "MRT 与公交全面支持 Visa/Mastercard 非接触式支付或 Apple Pay，无需特意购买交通卡。" }
        ],
        warnings: [
            { title: "口香糖入境限制", desc: "销售或携带过量口香糖入境属于违法行为，切勿在公共场所乱吐。" },
            { title: "地铁内严格禁食饮水", desc: "MRT 车厢及付费站区内喝白开水或吃零食都可能面临最高 500 新元罚款。" }
        ]
    }
];

const RulesTab = ({ isActive, onLocateRegion, customPoints = [] }) => {
    const [subView, setSubView] = useState('rules'); // 'rules' | 'pass'
    const [selectedId, setSelectedId] = useState('china');
    const activeRegion = GLOBAL_RULES_CONFIG.find((r) => r.id === selectedId) || GLOBAL_RULES_CONFIG[0];
    const linkedPack = activeRegion.regionPackId
        ? REGION_REGISTRY.find((r) => r.id === activeRegion.regionPackId)
        : null;

    return (
        <div className={`${isActive ? 'block' : 'hidden'} animate-in fade-in duration-300 max-w-5xl mx-auto space-y-5`}>
            {/* 子视图切换胶囊：出行规则指南 vs 铁路通票回本估算 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex bg-paper-2/90 backdrop-blur-md p-1 rounded-2xl border border-line shadow-sm gap-1">
                    <button
                        type="button"
                        onClick={() => setSubView('rules')}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            subView === 'rules'
                                ? 'bg-sora text-sora-ink shadow-sm'
                                : 'text-ink-2 hover:text-ink hover:bg-sora-soft/50'
                        }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        <span>8 国出行指南</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubView('pass')}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            subView === 'pass'
                                ? 'bg-sora text-sora-ink shadow-sm'
                                : 'text-ink-2 hover:text-ink hover:bg-sora-soft/50'
                        }`}
                    >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>铁路通票回本估算</span>
                    </button>
                </div>
                <span className="text-[11px] text-ink-3 hidden sm:inline">
                    {subView === 'rules'
                        ? '涵盖 8 个国家/地区的铁路票务与当地避坑要点'
                        : '聚焦日本 JR / 欧洲 Eurail 参考估算，支持从行程一键导入'}
                </span>
            </div>

            {subView === 'pass' ? (
                <RailPassCalculator customPoints={customPoints} />
            ) : (
                <>
            {/* 顶部轻盈导览 + 国家胶囊切换条 */}
            <div className="bg-paper-2/92 backdrop-blur-md rounded-3xl border border-line shadow-lift p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-display text-2xl text-ink flex items-center gap-2">
                            <Globe className="w-5 h-5 text-sora" />
                            全球铁道与出行指南
                        </h3>
                        <p className="text-xs text-ink-3 mt-1">
                            收录各地区铁道票务逻辑与极易踩坑的当地隐性规则，点击国家快速切换。
                        </p>
                    </div>
                    <span className="text-[11px] font-bold text-ink-3 bg-paper-3 px-3 py-1 rounded-full border border-line/70">
                        已收录 {GLOBAL_RULES_CONFIG.length} 个国家/地区
                    </span>
                </div>

                {/* 国家胶囊选择器 */}
                <div className="flex flex-wrap gap-2">
                    {GLOBAL_RULES_CONFIG.map((region) => {
                        const active = region.id === activeRegion.id;
                        return (
                            <button
                                key={region.id}
                                type="button"
                                onClick={() => setSelectedId(region.id)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                    active
                                        ? 'bg-sora text-sora-ink border-sora shadow-sm'
                                        : 'bg-paper-3/70 text-ink-2 border-line/80 hover:bg-sora-soft/50 hover:text-ink'
                                }`}
                            >
                                <span aria-hidden="true">{region.icon}</span>
                                <span>{region.country}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 当前选中地区的精读卡片（宽松双栏呼吸感） */}
            <div className="bg-paper-2/95 backdrop-blur-md rounded-3xl border border-line shadow-lift p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-line/80">
                    <div className="flex items-center gap-3.5">
                        <span className="text-4xl leading-none" aria-hidden="true">{activeRegion.icon}</span>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <h4 className="text-xl font-black text-ink">{activeRegion.country}</h4>
                                <span className="text-xs font-mono text-ink-3">{activeRegion.enName}</span>
                            </div>
                            <p className="text-xs text-ink-2 mt-1">{activeRegion.subtitle}</p>
                        </div>
                    </div>

                    {linkedPack && onLocateRegion && (
                        <button
                            type="button"
                            onClick={() => onLocateRegion(linkedPack)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-wakaba-soft text-ink border border-wakaba/40 hover:border-wakaba transition-colors"
                        >
                            <MapPin className="w-3.5 h-3.5 text-wakaba" />
                            在地图查看{linkedPack.name}铁道骨架
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左栏：交通网络与票务逻辑 */}
                    <div>
                        <h5 className="flex items-center text-sm font-bold text-ink mb-3.5">
                            <Train className="w-4 h-4 mr-2 text-sora" /> 交通网络与票务逻辑
                        </h5>
                        <div className="space-y-3">
                            {activeRegion.rules.map((line, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-2xl border ${
                                        line.status === 'yes'
                                            ? 'bg-wakaba-soft/45 border-wakaba/25'
                                            : 'bg-koi-soft/45 border-koi/25'
                                    }`}
                                >
                                    <div className="flex items-center mb-1.5">
                                        {line.status === 'yes'
                                            ? <CheckCircle2 className="text-wakaba mr-2 w-4 h-4 shrink-0" />
                                            : <XCircle className="text-koi mr-2 w-4 h-4 shrink-0" />}
                                        <span className="font-bold text-sm text-ink">{line.name}</span>
                                    </div>
                                    <p className="text-xs text-ink-2 leading-relaxed pl-6">{line.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 右栏：隐性法规与避坑提示 */}
                    <div>
                        <h5 className="flex items-center text-sm font-bold text-ink mb-3.5">
                            <ShieldAlert className="w-4 h-4 mr-2 text-kouchou" /> 隐性法规与避坑提示
                        </h5>
                        <div className="space-y-3">
                            {activeRegion.warnings.map((warn, idx) => (
                                <div key={idx} className="flex p-4 rounded-2xl bg-kouchou-soft/55 border border-kouchou/30">
                                    <AlertTriangle className="w-4 h-4 text-kouchou mr-2.5 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold text-sm text-ink block mb-1">{warn.title}</span>
                                        <p className="text-xs text-ink-2 leading-relaxed">{warn.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 来源与核验日期声明 */}
                <div className="mt-6 pt-4 border-t border-line/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
                    <span>参考来源：{activeRegion.source}</span>
                    <span className="font-mono">最后核验：{activeRegion.lastVerified} · 出行前请以当地最新公告为准</span>
                </div>
            </div>
                </>
            )}
        </div>
    );
};

export default RulesTab;