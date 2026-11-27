// src/config/regions/uk.js
// 🇬🇧 英国区内容包 —— National Rail 东西海岸干线 + 苏格兰西高地观景铁道（WGS84）

export const STATIONS = [
    { id: 'uk_london_kgx', name: '伦敦国王十字 / 圣潘克拉斯', type: 'shinkansen', lon: -0.1233, lat: 51.5319, desc: '东海岸干线与欧洲之星国际总站。' },
    { id: 'uk_london_pad', name: '伦敦帕丁顿站', type: 'shinkansen', lon: -0.1755, lat: 51.5154, desc: '大西部干线起点，希思罗快线接驳站。' },
    { id: 'uk_cambridge', name: '剑桥站', type: 'jr', lon: 0.1375, lat: 52.1942, desc: '学院古城，东英格兰铁路重镇。' },
    { id: 'uk_york', name: '约克站', type: 'shinkansen', lon: -1.0932, lat: 53.9580, desc: '中世纪城墙古城，大英铁路博物馆所在地。' },
    { id: 'uk_newcastle', name: '纽卡斯尔中央', type: 'shinkansen', lon: -1.6171, lat: 54.9685, desc: '泰恩河七桥奇观，东海岸干线北段枢纽。' },
    { id: 'uk_edinburgh', name: '爱丁堡威瓦利站', type: 'shinkansen', lon: -3.1890, lat: 55.9520, desc: '藏身老城与新城谷底的传奇车站，苏格兰首府门户。' },
    { id: 'uk_oxford', name: '牛津站', type: 'jr', lon: -1.2700, lat: 51.7535, desc: '牛津大学城，大西部干线支点。' },
    { id: 'uk_bath', name: '巴斯温泉站', type: 'jr', lon: -2.3570, lat: 51.3776, desc: '罗马浴场与乔治亚蜜色建筑世界遗产古城。' },
    { id: 'uk_penzance', name: '彭赞斯站', type: 'jr', lon: -5.5326, lat: 50.1217, desc: '英格兰最西南铁路终点，圣迈克尔山与康沃尔海岸入口。' },
    { id: 'uk_manchester', name: '曼彻斯特皮卡迪利', type: 'shinkansen', lon: -2.2309, lat: 53.4774, desc: '英格兰北部交通心脏，西海岸干线核心枢纽。' },
    { id: 'uk_liverpool', name: '利物浦莱姆街', type: 'jr', lon: -2.9776, lat: 53.4073, desc: '披头士与海港遗产名城。' },
    { id: 'uk_glasgow', name: '格拉斯哥中央/皇后街', type: 'shinkansen', lon: -4.2512, lat: 55.8623, desc: '西海岸干线北端终点，前往高地西高地线的起点。' },
    { id: 'uk_fort_william', name: '威廉堡站', type: 'jr', lon: -5.1052, lat: 56.8198, desc: '本尼维斯山脚，雅各比特蒸汽火车出发站。' },
    { id: 'uk_mallaig', name: '马莱格站', type: 'ferry', lon: -5.8286, lat: 57.0067, desc: '西高地线终点渔港，途经格伦芬南高架桥（天空岛渡轮口）。' },
];

export const RAILWAY_LINES = [
    { id: 'uk_ecml', name: '东海岸干线 (ECML)', badge: '伦敦 → 爱丁堡', points: ['uk_london_kgx', 'uk_cambridge', 'uk_york', 'uk_newcastle', 'uk_edinburgh'], color: '#dc2626', dashArray: null },
    { id: 'uk_wcml', name: '西海岸干线 (WCML)', badge: '伦敦 → 格拉斯哥', points: ['uk_london_kgx', 'uk_manchester', 'uk_liverpool', 'uk_glasgow'], color: '#2563eb', dashArray: null },
    { id: 'uk_gwr', name: '大西部干线 (GWR)', badge: '伦敦 → 康沃尔', points: ['uk_london_pad', 'uk_oxford', 'uk_bath', 'uk_penzance'], color: '#15803d', dashArray: null },
    { id: 'uk_west_highland', name: '苏格兰西高地观光线', badge: '格伦芬南高架桥', points: ['uk_edinburgh', 'uk_glasgow', 'uk_fort_william', 'uk_mallaig'], color: '#7c3aed', dashArray: '5, 5' },
];

export const PILGRIMAGE_PICKS = [];
export const HANABI_EVENTS = [];

export const UK_REGION = {
    id: 'uk',
    name: '英国',
    icon: '🇬🇧',
    center: [54.2, -2.5],
    zoom: 5.5,
    description: '东西海岸干线 + 大西部线 + 苏格兰西高地蒸汽火车观光线',
};
