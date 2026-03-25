// 基础坐标数据配置
/**
 * 基础地理拓扑节点配置
 * 包含全日本青春 18 铁路骨架的关键站点
 * 坐标系统：WGS84 GPS 经纬度
 */
export const BASE_POINTS_CONFIG = [
    /* --- 极端节点 --- */
    { id: 'wakkanai', name: "稚内站", type: "jr", lon: 141.673, lat: 45.416, desc: "【最北端】日本铁路最北端，宗谷本线起点。" },
    { id: 'higashi_nemuro', name: "东根室站", type: "jr", lon: 145.597, lat: 43.323, desc: "【最东端】系统的东部绝对边界。" },
    { id: 'sasebo', name: "佐世保站", type: "jr", lon: 129.728, lat: 33.165, desc: "【最西端】JR 日本最西端车站。" },
    { id: 'nishi_oyama', name: "西大山站", type: "jr", lon: 130.579, lat: 31.188, desc: "【最南端】JR 日本最南端车站。" },

    /* --- 1. 北海道北端 --- */
    { id: 'nayoro', name: "名寄站", type: "jr", lon: 142.457, lat: 44.350, desc: "宗谷本线途经点。" },
    { id: 'asahikawa', name: "旭川站", type: "jr", lon: 142.358, lat: 43.762, desc: "宗谷本线与函馆本线交汇枢纽。" },
    { id: 'iwamizawa', name: "岩见泽站", type: "jr", lon: 141.759, lat: 43.204, desc: "函馆本线途经点。" },
    { id: 'sapporo', name: "札幌站", type: "jr", lon: 141.350, lat: 43.068, desc: "北海道绝对中枢节点。" },
    { id: 'tomakomai', name: "苫小牧站", type: "jr", lon: 141.596, lat: 42.639, desc: "函馆本线途经点。" },
    { id: 'hakodate', name: "函馆站", type: "jr", lon: 140.726, lat: 41.773, desc: "北海道主干终点，铁路无法直接跨越津轻海峡。" },

    /* --- 2. 北海道 → 本州 (跨海断点) --- */
    { id: 'shin_hakodate', name: "新函馆北斗", type: "shinkansen", lon: 140.648, lat: 41.904, desc: "北海道新干线起点 (不适用青春18)。" },
    { id: 'shin_aomori', name: "新青森站", type: "jr", lon: 140.693, lat: 40.827, desc: "跨海后本州北端，东北骨架起点。" },

    /* --- 3 & 4. 东北骨架 (青森 → 东京) --- */
    { id: 'aomori', name: "青森站", type: "jr", lon: 140.734, lat: 40.829, desc: "东北本线及奥羽本线起点。" },
    { id: 'hachinohe', name: "八户站", type: "jr", lon: 141.436, lat: 40.509, desc: "东北干线途经点。" },
    { id: 'morioka', name: "盛冈站", type: "jr", lon: 141.136, lat: 39.701, desc: "东北本线重要枢纽。" },
    { id: 'ichinoseki', name: "一关站", type: "jr", lon: 141.137, lat: 38.926, desc: "东北本线途经点。" },
    { id: 'sendai', name: "仙台站", type: "jr", lon: 140.882, lat: 38.260, desc: "东北区域最大中枢。" },
    { id: 'shiroishi', name: "白石站", type: "jr", lon: 140.623, lat: 38.002, desc: "东北本线继续向南。" },
    { id: 'fukushima', name: "福岛站", type: "jr", lon: 140.458, lat: 37.754, desc: "东北本线途经点。" },
    { id: 'koriyama', name: "郡山站", type: "jr", lon: 140.388, lat: 37.398, desc: "东北本线途经点。" },
    { id: 'utsunomiya', name: "宇都宫站", type: "jr", lon: 139.897, lat: 36.559, desc: "关东门户。" },
    { id: 'omiya', name: "大宫站", type: "jr", lon: 139.624, lat: 35.906, desc: "多条线路交汇的超级枢纽。" },
    { id: 'ueno', name: "上野站", type: "jr", lon: 139.777, lat: 35.713, desc: "传统意义上的东京北大门。" },
    { id: 'tokyo', name: "东京站", type: "jr", lon: 139.767, lat: 35.681, desc: "日本原点，东海道本线起点。" },

    /* --- 5. 东海道本线 (东京 → 大阪主干) --- */
    { id: 'yokohama', name: "横滨站", type: "jr", lon: 139.622, lat: 35.465, desc: "东海道本线重镇。" },
    { id: 'odawara', name: "小田原站", type: "jr", lon: 139.155, lat: 35.256, desc: "东海道本线途经点。" },
    { id: 'atami', name: "热海站", type: "jr", lon: 139.077, lat: 35.103, desc: "JR 东日本与 JR 东海的分界点。" },
    { id: 'shizuoka', name: "静冈站", type: "jr", lon: 138.389, lat: 34.971, desc: "横跨静冈县的漫长中继线。" },
    { id: 'hamamatsu', name: "滨松站", type: "jr", lon: 137.734, lat: 34.703, desc: "东海道本线途经点。" },
    { id: 'toyohashi', name: "丰桥站", type: "jr", lon: 137.381, lat: 34.762, desc: "东海道本线途经点。" },
    { id: 'nagoya', name: "名古屋站", type: "jr", lon: 136.881, lat: 35.170, desc: "中部区域核心枢纽。" },
    { id: 'maibara', name: "米原站", type: "jr", lon: 136.290, lat: 35.314, desc: "JR 东海与 JR 西日本的分界点。" },
    { id: 'kyoto', name: "京都站", type: "jr", lon: 135.758, lat: 34.985, desc: "关西重镇，东海道本线途经点。" },
    { id: 'osaka', name: "大阪站", type: "jr", lon: 135.495, lat: 34.702, desc: "东海道本线终点，山阳本线起点。" },

    /* --- 6. 山阳本线 (大阪 → 下关) --- */
    { id: 'kobe', name: "神户站", type: "jr", lon: 135.178, lat: 34.679, desc: "山阳本线途经点。" },
    { id: 'himeji', name: "姬路站", type: "jr", lon: 134.690, lat: 34.827, desc: "山阳本线途经点。" },
    { id: 'okayama', name: "冈山站", type: "jr", lon: 133.918, lat: 34.666, desc: "山阳本线枢纽，进入四国的铁路入口。" },
    { id: 'hiroshima', name: "广岛站", type: "jr", lon: 132.455, lat: 34.397, desc: "山阳本线核心大站。" },
    { id: 'yamaguchi', name: "新山口站", type: "jr", lon: 131.398, lat: 34.094, desc: "山阳本线途经点。" },
    { id: 'shimonoseki', name: "下关站", type: "jr", lon: 130.925, lat: 33.950, desc: "本州最西端，前往九州的关门隧道入口。" },

    /* --- 7 & 8. 九州主干 (门司 → 鹿儿岛) --- */
    { id: 'moji', name: "门司站", type: "jr", lon: 130.941, lat: 33.904, desc: "穿越关门隧道，正式进入九州。" },
    { id: 'kokura', name: "北九州(小仓)", type: "jr", lon: 130.882, lat: 33.886, desc: "九州门户，鹿儿岛本线起点方向。" },
    { id: 'hakata', name: "博多站", type: "jr", lon: 130.420, lat: 33.589, desc: "九州绝对中枢干线。" },
    { id: 'kumamoto', name: "熊本站", type: "jr", lon: 130.689, lat: 32.789, desc: "鹿儿岛本线途经点。" },
    { id: 'kagoshima_chuo', name: "鹿儿岛中央", type: "jr", lon: 130.541, lat: 31.583, desc: "JR 铁路最南主干终点。" },

    /* --- 无法直达的额外节点 --- */
    { id: 'sakaiminato', name: "境港站", type: "jr", lon: 133.233, lat: 35.544, desc: "隐岐诸岛渡轮接驳站。" },
    { id: 'oki', name: "隐岐诸岛", type: "ferry", lon: 133.097, lat: 36.082, desc: "需至境港或七类港换乘 🚢 渡轮。" },
    { id: 'miyajima_guchi', name: "宫岛口站", type: "jr", lon: 132.303, lat: 34.312, desc: "山阳本线接驳，准备换乘渡轮。" },
    { id: 'miyajima', name: "严岛神社", type: "ferry", lon: 132.318, lat: 34.296, desc: "可使用青春18乘坐 🚢 JR宫岛渡轮 抵达。" },
    { id: 'takamatsu', name: "高松站", type: "jr", lon: 134.046, lat: 34.342, desc: "通过濑户大桥线进入四国的门户。" },
    { id: 'naha', name: "那霸", type: "plane", lon: 127.679, lat: 26.212, desc: "铁路无法覆盖，必须乘坐 ✈ 飞机。" }
];