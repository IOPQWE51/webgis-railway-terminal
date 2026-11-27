// src/config/regions/northamerica.js
// 🇺🇸🇨🇦 北美区内容包 —— Amtrak 东北走廊 + 西部三大传奇景观专列 + 加拿大落基山脉线（WGS84）

export const STATIONS = [
    /* --- 东北走廊（高频客运）--- */
    { id: 'na_boston', name: '波士顿南站', type: 'shinkansen', lon: -71.0552, lat: 42.3519, desc: '东北走廊 Acela 起点，新英格兰铁道门户。' },
    { id: 'na_nyc', name: '纽约宾州车站 (Moynihan)', type: 'shinkansen', lon: -73.9935, lat: 40.7506, desc: '北美最繁忙铁路枢纽，通往波士顿、华盛顿与芝加哥。' },
    { id: 'na_philadelphia', name: '费城 30 街站', type: 'shinkansen', lon: -75.1820, lat: 39.9557, desc: '古典大厅地标车站，东北走廊核心中继站。' },
    { id: 'na_washington', name: '华盛顿联合车站', type: 'shinkansen', lon: -77.0063, lat: 38.8978, desc: '东北走廊南端终点，紧邻国会山。' },

    /* --- 芝加哥总枢纽 & 加州微风号 --- */
    { id: 'na_chicago', name: '芝加哥联合车站', type: 'shinkansen', lon: -87.6403, lat: 41.8787, desc: '美国中西部总枢纽，加州微风号与帝国建设者号起点。' },
    { id: 'na_denver', name: '丹佛联合车站', type: 'jr', lon: -105.0001, lat: 39.7530, desc: '落基山麓门户，加州微风号翻越分水岭前的核心站。' },
    { id: 'na_glenwood', name: '格伦伍德温泉站', type: 'jr', lon: -107.3248, lat: 39.5480, desc: '科罗拉多河红岩峡谷精华段，观景车厢必拍窗口。' },
    { id: 'na_salt_lake', name: '盐湖城站', type: 'jr', lon: -111.9086, lat: 40.7619, desc: '大盆地荒漠与雪山交界节点。' },
    { id: 'na_emeryville', name: '旧金山湾 (Emeryville)', type: 'jr', lon: -122.2918, lat: 37.8404, desc: '加州微风号西端终点，接驳巴士直抵旧金山市区。' },

    /* --- 太平洋海岸星光号 --- */
    { id: 'na_seattle', name: '西雅图国王街站', type: 'jr', lon: -122.3299, lat: 47.5984, desc: '太平洋西北枢纽，海岸星光号与帝国建设者号终点。' },
    { id: 'na_portland', name: '波特兰联合车站', type: 'jr', lon: -122.6766, lat: 45.5290, desc: '哥伦比亚河谷与喀斯喀特山脉门户。' },
    { id: 'na_santa_barbara', name: '圣巴巴拉海滨站', type: 'jr', lon: -119.6929, lat: 34.4136, desc: '海岸星光号紧贴太平洋悬崖海滩的绝佳日落路段。' },
    { id: 'na_los_angeles', name: '洛杉矶联合车站', type: 'jr', lon: -118.2365, lat: 34.0562, desc: '西班牙复兴风格传奇车站，海岸星光号南端终点。' },

    /* --- 冰川国家公园 & 加拿大 VIA Rail --- */
    { id: 'na_glacier_park', name: '冰川国家公园 (West Glacier)', type: 'jr', lon: -113.9806, lat: 48.4967, desc: '帝国建设者号穿越落基山冰川国家公园门户。' },
    { id: 'na_vancouver', name: '温哥华太平洋中央站', type: 'jr', lon: -123.0979, lat: 49.2737, desc: 'VIA Rail 加拿大人号与落基山登山者号西岸起点。' },
    { id: 'na_jasper', name: '贾斯珀站 (Jasper)', type: 'jr', lon: -118.0811, lat: 52.8752, desc: '落基山雪峰河谷景观站，观景穹顶车厢高光段。' },
    { id: 'na_banff', name: '班夫站 (Banff)', type: 'jr', lon: -115.5819, lat: 51.1818, desc: '落基山国家公园地标小镇车站。' },
    { id: 'na_toronto', name: '多伦多联合车站', type: 'shinkansen', lon: -79.3806, lat: 43.6452, desc: '加拿大最大铁路枢纽，VIA 走廊与跨洲线起点。' },
    { id: 'na_montreal', name: '蒙特利尔中央车站', type: 'shinkansen', lon: -73.5671, lat: 45.4998, desc: '魁北克法语区门户，衔接多伦多与纽约。' },
];

export const RAILWAY_LINES = [
    { id: 'na_nec', name: '东北走廊 (Acela 高速)', badge: '波士顿 → 华盛顿', points: ['na_boston', 'na_nyc', 'na_philadelphia', 'na_washington'], color: '#2563eb', dashArray: null },
    { id: 'na_zephyr', name: '加州微风号 (California Zephyr)', badge: '落基山峡谷观光', points: ['na_chicago', 'na_denver', 'na_glenwood', 'na_salt_lake', 'na_emeryville'], color: '#ea580c', dashArray: '6, 4' },
    { id: 'na_starlight', name: '海岸星光号 (Coast Starlight)', badge: '太平洋海岸线', points: ['na_seattle', 'na_portland', 'na_emeryville', 'na_santa_barbara', 'na_los_angeles'], color: '#0284c7', dashArray: '6, 4' },
    { id: 'na_empire', name: '帝国建设者号 (Empire Builder)', badge: '冰川国家公园', points: ['na_chicago', 'na_glacier_park', 'na_seattle'], color: '#16a34a', dashArray: '5, 5' },
    { id: 'na_canada_rockies', name: '加拿大落基山 & 东岸走廊', badge: 'VIA Rail 观光', points: ['na_vancouver', 'na_jasper', 'na_banff', 'na_toronto', 'na_montreal'], color: '#dc2626', dashArray: '5, 5' },
];

export const PILGRIMAGE_PICKS = [];
export const HANABI_EVENTS = [];

export const NORTHAMERICA_REGION = {
    id: 'na',
    name: '北美景观',
    centerLabel: '丹佛 · 北美',
    icon: '🇺🇸',
    center: [39.7530, -105.0001],
    zoom: 4,
    description: 'Amtrak 东北走廊 + 加州微风/海岸星光/冰川与加拿大落基山观光专列',
};
