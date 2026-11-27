// src/config/regions/korea.js
// 🇰🇷 韩国区内容包 —— KTX 高铁骨干网络与东海海岸线（WGS84）

export const STATIONS = [
    { id: 'kr_incheon_airport', name: '仁川机场 T1', type: 'plane', lon: 126.4525, lat: 37.4475, desc: '韩国空中门户，AREX 机场快线直达首尔站。' },
    { id: 'kr_seoul', name: '首尔站', type: 'shinkansen', lon: 126.9707, lat: 37.5547, desc: '韩国铁道总枢纽，京釜/湖南/江陵 KTX 起点。' },
    { id: 'kr_suwon', name: '水原站', type: 'jr', lon: 127.0001, lat: 37.2659, desc: '京畿道核心枢纽，水原华城门户。' },
    { id: 'kr_daejeon', name: '大田站', type: 'shinkansen', lon: 127.4342, lat: 36.3325, desc: '韩国中部十字枢纽，京釜线与湖南线分岔重镇。' },
    { id: 'kr_dongdaegu', name: '东大邱站', type: 'shinkansen', lon: 128.6285, lat: 35.8797, desc: '岭南腹地最大高铁枢纽。' },
    { id: 'kr_gyeongju', name: '庆州站', type: 'shinkansen', lon: 129.1397, lat: 35.7983, desc: '千年新罗古都门户，佛国寺与大陵苑换乘站。' },
    { id: 'kr_busan', name: '釜山站', type: 'shinkansen', lon: 129.0422, lat: 35.1152, desc: '京釜高铁南端终点，海港山城与跨海渡轮枢纽。' },
    { id: 'kr_jeonju', name: '全州站', type: 'shinkansen', lon: 127.1619, lat: 35.8498, desc: '韩屋村文化古城，全罗线 KTX 必经站。' },
    { id: 'kr_gwangju', name: '光州松汀站', type: 'shinkansen', lon: 126.7910, lat: 35.1375, desc: '西南核心城市高铁枢纽。' },
    { id: 'kr_mokpo', name: '木浦站', type: 'shinkansen', lon: 126.3865, lat: 34.7912, desc: '湖南线终点，多岛海与济州方向港口门户。' },
    { id: 'kr_yeosu', name: '丽水世博站', type: 'shinkansen', lon: 127.7491, lat: 34.7530, desc: '南海海岸港城终点，夜景海湾机位密集。' },
    { id: 'kr_pyeongchang', name: '平昌站', type: 'shinkansen', lon: 128.4307, lat: 37.5624, desc: '江原道高原雪季门户，江陵线高山中继站。' },
    { id: 'kr_gangneung', name: '江陵站', type: 'shinkansen', lon: 128.8992, lat: 37.7638, desc: '江陵线东海海岸终点，正东津日出与海滨公路入口。' },
];

export const RAILWAY_LINES = [
    { id: 'kr_gyeongbu', name: '京釜 KTX 干线', badge: '首尔 → 釜山', points: ['kr_seoul', 'kr_suwon', 'kr_daejeon', 'kr_dongdaegu', 'kr_gyeongju', 'kr_busan'], color: '#2563eb', dashArray: null },
    { id: 'kr_honam', name: '湖南 KTX 干线', badge: '首尔 → 木浦', points: ['kr_seoul', 'kr_daejeon', 'kr_gwangju', 'kr_mokpo'], color: '#0ea5e9', dashArray: null },
    { id: 'kr_jeolla', name: '全罗线 KTX', badge: '全州 → 丽水海港', points: ['kr_daejeon', 'kr_jeonju', 'kr_yeosu'], color: '#14b8a6', dashArray: '5, 5' },
    { id: 'kr_gangneung', name: '仁川 - 江陵线', badge: '机场与东海海岸', points: ['kr_incheon_airport', 'kr_seoul', 'kr_pyeongchang', 'kr_gangneung'], color: '#6366f1', dashArray: null },
];

export const PILGRIMAGE_PICKS = [];
export const HANABI_EVENTS = [];

export const KOREA_REGION = {
    id: 'kr',
    name: '韩国',
    centerLabel: '大田 · 韩国',
    icon: '🇰🇷',
    center: [36.3325, 127.4342],
    zoom: 6.5,
    description: 'KTX 京釜 / 湖南 / 全罗 / 江陵东海海岸骨架',
};
