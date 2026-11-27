// src/config/regions/europe.js
// 🇪🇺 欧洲区内容包 —— Eurail 核心跨国高速网 + 瑞士阿尔卑斯观景铁道（WGS84）

export const STATIONS = [
    /* --- 西欧核心（法 / 比 / 荷）--- */
    { id: 'eu_paris', name: '巴黎北/里昂站', type: 'shinkansen', lon: 2.3553, lat: 48.8809, desc: '欧洲西线心脏，Eurostar / TGV 辐射全欧。' },
    { id: 'eu_brussels', name: '布鲁塞尔南站', type: 'shinkansen', lon: 4.3365, lat: 50.8357, desc: '西欧国际高铁十字枢纽，衔接伦敦、巴黎、阿姆斯特丹与科隆。' },
    { id: 'eu_amsterdam', name: '阿姆斯特丹中央', type: 'shinkansen', lon: 4.9003, lat: 52.3791, desc: '运河古城水陆总站，Eurostar 与 ICE 终点之一。' },
    { id: 'eu_lyon', name: '里昂帕尔迪厄', type: 'shinkansen', lon: 4.8594, lat: 45.7606, desc: '法国东南高铁枢纽，衔接阿尔卑斯与地中海方向。' },
    { id: 'eu_marseille', name: '马赛圣夏尔', type: 'shinkansen', lon: 5.3804, lat: 43.3028, desc: '地中海蔚蓝海岸门户，TGV 南部枢纽。' },
    { id: 'eu_nice', name: '尼斯城站', type: 'jr', lon: 7.2619, lat: 43.7046, desc: '蔚蓝海岸精华终点，邻近摩纳哥与芒通海岸机位。' },

    /* --- 中欧骨架（德 / 奥 / 捷）--- */
    { id: 'eu_cologne', name: '科隆中央站', type: 'shinkansen', lon: 6.9587, lat: 50.9432, desc: '出站即见科隆大教堂，莱茵河 ICE 主干枢纽。' },
    { id: 'eu_frankfurt', name: '法兰克福中央', type: 'shinkansen', lon: 8.6638, lat: 50.1072, desc: '德国铁路第一枢纽，南北东西 ICE 交汇点。' },
    { id: 'eu_berlin', name: '柏林中央站', type: 'shinkansen', lon: 13.3694, lat: 52.5251, desc: '多层立体玻璃枢纽，中北欧干线核心。' },
    { id: 'eu_munich', name: '慕尼黑中央站', type: 'shinkansen', lon: 11.5583, lat: 48.1402, desc: '巴伐利亚与阿尔卑斯北麓门户，通往奥地利与意大利。' },
    { id: 'eu_salzburg', name: '萨尔茨堡中央', type: 'shinkansen', lon: 13.0458, lat: 47.8130, desc: '奥地利湖区与哈尔施塔特换乘门户。' },
    { id: 'eu_vienna', name: '维也纳中央站', type: 'shinkansen', lon: 16.3765, lat: 48.1852, desc: '中东欧 Railjet 枢纽，衔接布拉格、布达佩斯与瑞士。' },
    { id: 'eu_prague', name: '布拉格中央站', type: 'jr', lon: 14.4353, lat: 50.0831, desc: '波西米亚古城总站，柏林—维也纳复古铁道节点。' },

    /* --- 瑞士阿尔卑斯观景网 --- */
    { id: 'eu_zurich', name: '苏黎世中央站', type: 'shinkansen', lon: 8.5402, lat: 47.3779, desc: '瑞士精密钟表级换乘总枢，直通法德意奥。' },
    { id: 'eu_interlaken', name: '因特拉肯东站', type: 'jr', lon: 7.8689, lat: 46.6906, desc: '少女峰地区大门，黄金山口快车核心节点。' },
    { id: 'eu_zermatt', name: '采尔马特站', type: 'jr', lon: 7.7484, lat: 46.0243, desc: '马特洪峰无车小镇，冰川快车西端起点。' },
    { id: 'eu_chur', name: '库尔站', type: 'jr', lon: 9.5289, lat: 46.8531, desc: '瑞士最古老城市，冰川快车与伯尔尼纳快车交汇换乘点。' },
    { id: 'eu_st_moritz', name: '圣莫里茨站', type: 'jr', lon: 9.8461, lat: 46.4979, desc: '恩嘎丁高原湖畔名城，两大传奇观景列车枢纽。' },

    /* --- 南欧（意 / 西）--- */
    { id: 'eu_tirano', name: '蒂拉诺站', type: 'jr', lon: 10.1684, lat: 46.2156, desc: '伯尔尼纳快车穿越阿尔卑斯后的意大利终点站。' },
    { id: 'eu_milan', name: '米兰中央站', type: 'shinkansen', lon: 9.2043, lat: 45.4859, desc: '意北铁道总枢纽，连接瑞士、威尼斯与罗马红箭高铁。' },
    { id: 'eu_venice', name: '威尼斯圣露西亚', type: 'shinkansen', lon: 12.3210, lat: 45.4411, desc: '出站一步即大运河，世界上最浪漫的铁道终点之一。' },
    { id: 'eu_florence', name: '佛罗伦萨 SMN', type: 'shinkansen', lon: 11.2479, lat: 43.7764, desc: '托斯卡纳文艺复兴枢纽，红箭高铁中继站。' },
    { id: 'eu_rome', name: '罗马特米尼', type: 'shinkansen', lon: 12.5018, lat: 41.9010, desc: '意大利最大铁路枢纽，贯穿南北半岛。' },
    { id: 'eu_barcelona', name: '巴塞罗那桑茨', type: 'shinkansen', lon: 2.1401, lat: 41.3791, desc: '加泰罗尼亚 AVE 高铁枢纽，跨境直通法国。' },
    { id: 'eu_madrid', name: '马德里阿托查', type: 'shinkansen', lon: -3.6906, lat: 40.4068, desc: '拥有热带雨林中庭的西班牙高铁总站。' },
];

export const RAILWAY_LINES = [
    { id: 'eu_west_hsr', name: '西欧高速轴（巴黎 - 荷比德）', badge: 'Eurostar / ICE', points: ['eu_paris', 'eu_brussels', 'eu_amsterdam'], color: '#7c3aed', dashArray: null },
    { id: 'eu_rhine_ice', name: '莱茵 - 巴黎跨国 ICE', badge: '法德快线', points: ['eu_paris', 'eu_brussels', 'eu_cologne', 'eu_frankfurt'], color: '#6366f1', dashArray: null },
    { id: 'eu_tgv_med', name: '法国地中海 TGV', badge: '巴黎 → 蔚蓝海岸', points: ['eu_paris', 'eu_lyon', 'eu_marseille', 'eu_nice'], color: '#2563eb', dashArray: null },
    { id: 'eu_central_ice', name: '德奥捷中欧干线', badge: 'ICE / Railjet', points: ['eu_berlin', 'eu_prague', 'eu_vienna', 'eu_salzburg', 'eu_munich', 'eu_frankfurt'], color: '#ef4444', dashArray: null },
    { id: 'eu_glacier', name: '瑞士冰川快车 & 少女峰线', badge: '阿尔卑斯观景', points: ['eu_zurich', 'eu_interlaken', 'eu_zermatt', 'eu_chur', 'eu_st_moritz'], color: '#dc2626', dashArray: '6, 4' },
    { id: 'eu_bernina', name: '伯尔尼纳快车（跨阿尔卑斯）', badge: '世界遗产铁道', points: ['eu_zurich', 'eu_chur', 'eu_st_moritz', 'eu_tirano', 'eu_milan'], color: '#f59e0b', dashArray: '5, 5' },
    { id: 'eu_italy_hsr', name: '意大利红箭高铁', badge: 'Frecciarossa', points: ['eu_venice', 'eu_milan', 'eu_florence', 'eu_rome'], color: '#e11d48', dashArray: null },
    { id: 'eu_iberia_ave', name: '法西跨国 AVE 高铁', badge: '里昂 → 马德里', points: ['eu_lyon', 'eu_barcelona', 'eu_madrid'], color: '#0ea5e9', dashArray: null },
];

export const PILGRIMAGE_PICKS = [];
export const HANABI_EVENTS = [];

export const EUROPE_REGION = {
    id: 'eu',
    name: '欧洲',
    icon: '🇪🇺',
    center: [47.2, 9.5],
    zoom: 4.5,
    description: 'Eurail 西中南欧高铁网 + 冰川/伯尔尼纳阿尔卑斯观景线',
};
