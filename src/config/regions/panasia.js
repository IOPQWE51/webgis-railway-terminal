// src/config/regions/panasia.js
// 🌏 泛亚纵贯内容包 —— 中老国际铁路 + 泰国 SRT 夜班卧铺 + 马来半岛 ETS → 新加坡（WGS84）

export const STATIONS = [
    /* --- 中老国际铁路 --- */
    { id: 'sea_xishuangbanna', name: '西双版纳站', type: 'shinkansen', lon: 100.7852, lat: 21.9768, desc: '中老铁路热带雨林重镇，向北直连昆明南站。' },
    { id: 'sea_luang_prabang', name: '琅勃拉邦站', type: 'shinkansen', lon: 102.2389, lat: 19.8981, desc: '世界遗产古都，湄公河清晨布施与落日机位。' },
    { id: 'sea_vang_vieng', name: '万荣站', type: 'shinkansen', lon: 102.4601, lat: 18.9389, desc: '喀斯特峰林与热气球日出谷地。' },
    { id: 'sea_vientiane', name: '万象站', type: 'shinkansen', lon: 102.6602, lat: 18.0672, desc: '老挝首都国际总站，南接泰老跨境铁路。' },

    /* --- 泰国国家铁路 SRT --- */
    { id: 'sea_nong_khai', name: '廊开站', type: 'jr', lon: 102.7316, lat: 17.8686, desc: '湄公河友谊大桥跨境口岸站，衔接老挝与曼谷夜车。' },
    { id: 'sea_chiang_mai', name: '清迈站', type: 'jr', lon: 99.0172, lat: 18.7834, desc: '泰北玫瑰终点站，经典 9/10 次夜班空调卧铺目的地。' },
    { id: 'sea_ayutthaya', name: '大城站', type: 'jr', lon: 100.5835, lat: 14.3568, desc: '古暹罗王朝遗迹门户，泰国北线与东北线交汇。' },
    { id: 'sea_bangkok', name: '曼谷阿皮瓦中央总站', type: 'shinkansen', lon: 100.5403, lat: 13.8037, desc: '东南亚最大现代化铁路总站，辐射清迈、廊开与马来半岛。' },
    { id: 'sea_hua_hin', name: '华欣站', type: 'jr', lon: 99.9547, lat: 12.5673, desc: '泰南滨海度假重镇，保留经典红白皇家候车亭。' },
    { id: 'sea_hat_yai', name: '合艾枢纽站', type: 'jr', lon: 100.4631, lat: 7.0044, desc: '泰南交通大站，通往马来西亚巴东勿刹口岸。' },

    /* --- 马来半岛 ETS → 新加坡 --- */
    { id: 'sea_butterworth', name: '北海站 (槟城渡轮口)', type: 'ferry', lon: 100.3666, lat: 5.3941, desc: '下火车步行即乘渡轮跨海前往槟城乔治市。' },
    { id: 'sea_ipoh', name: '怡保站', type: 'jr', lon: 101.0731, lat: 4.5973, desc: '“怡保泰姬陵”百年白色殖民建筑车站。' },
    { id: 'sea_kl_sentral', name: '吉隆坡 KL Sentral', type: 'shinkansen', lon: 101.6865, lat: 3.1344, desc: '马来西亚全国铁道与机场快线总枢纽。' },
    { id: 'sea_woodlands', name: '新加坡兀兰关卡站', type: 'jr', lon: 103.7694, lat: 1.4443, desc: '欧亚大陆泛亚铁路最南端陆路铁道终点，接驳新加坡 MRT。' },
];

export const RAILWAY_LINES = [
    { id: 'sea_china_laos', name: '中老国际铁路', badge: '西双版纳 → 万象', points: ['sea_xishuangbanna', 'sea_luang_prabang', 'sea_vang_vieng', 'sea_vientiane'], color: '#059669', dashArray: null },
    { id: 'sea_thai_ne', name: '泰老跨境东北线', badge: '万象 → 曼谷', points: ['sea_vientiane', 'sea_nong_khai', 'sea_ayutthaya', 'sea_bangkok'], color: '#0d9488', dashArray: '5, 5' },
    { id: 'sea_thai_north', name: '泰国北线（夜班卧铺）', badge: '曼谷 → 清迈', points: ['sea_bangkok', 'sea_ayutthaya', 'sea_chiang_mai'], color: '#ea580c', dashArray: null },
    { id: 'sea_malay_peninsula', name: '泰马新半岛纵贯线', badge: '曼谷 → 新加坡', points: ['sea_bangkok', 'sea_hua_hin', 'sea_hat_yai', 'sea_butterworth', 'sea_ipoh', 'sea_kl_sentral', 'sea_woodlands'], color: '#0284c7', dashArray: null },
];

export const PILGRIMAGE_PICKS = [];
export const HANABI_EVENTS = [];

export const PANASIA_REGION = {
    id: 'sea',
    name: '泛亚东南亚',
    icon: '🌏',
    center: [12.5, 101.5],
    zoom: 4.5,
    description: '中老铁路 · 泰国夜班卧铺 · 马来半岛直抵新加坡陆路大动脉',
};
