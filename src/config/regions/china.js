// src/config/regions/china.js
// 🇨🇳 中国区内容包 —— 国家铁路骨干网络（高铁 + 经典普速干线，WGS84）
// 与 japan.js 同构导出，经 regions/index.js 聚合供地图与今日卡消费。

export const STATIONS = [
    /* --- 华北 / 京津冀 --- */
    { id: 'cn_beijing', name: '北京南站', type: 'shinkansen', lon: 116.3789, lat: 39.8651, desc: '京沪高铁与京津城际起点，华北核心高铁枢纽。' },
    { id: 'cn_tianjin', name: '天津站', type: 'shinkansen', lon: 117.2102, lat: 39.1356, desc: '渤海湾门户，京津城际与津秦高铁交汇。' },
    { id: 'cn_jinan', name: '济南西站', type: 'shinkansen', lon: 116.8913, lat: 36.6687, desc: '京沪高铁华东华北中继枢纽。' },

    /* --- 华东 / 长三角 --- */
    { id: 'cn_nanjing', name: '南京南站', type: 'shinkansen', lon: 118.7978, lat: 31.9692, desc: '亚洲大型高铁枢纽之一，京沪与沪汉蓉交汇。' },
    { id: 'cn_shanghai', name: '上海虹桥站', type: 'shinkansen', lon: 121.3201, lat: 31.1940, desc: '长三角绝对中枢，京沪与沪昆高铁交汇点。' },
    { id: 'cn_hangzhou', name: '杭州东站', type: 'shinkansen', lon: 120.2129, lat: 30.2909, desc: '江南铁道门户，通达东南沿海与沪昆干线。' },
    { id: 'cn_fuzhou', name: '福州站', type: 'shinkansen', lon: 119.3207, lat: 26.1149, desc: '东南沿海铁路干线核心节点。' },

    /* --- 华中 / 华南（京广骨架）--- */
    { id: 'cn_zhengzhou', name: '郑州东站', type: 'shinkansen', lon: 113.7789, lat: 34.7590, desc: '“米”字形高铁网心脏，京广与陇海/徐兰十字交汇。' },
    { id: 'cn_wuhan', name: '武汉站', type: 'shinkansen', lon: 114.4246, lat: 30.6073, desc: '九省通衢，长江中游高铁枢纽。' },
    { id: 'cn_changsha', name: '长沙南站', type: 'shinkansen', lon: 113.0654, lat: 28.1469, desc: '京广与沪昆两条十字动脉黄金交汇点。' },
    { id: 'cn_guangzhou', name: '广州南站', type: 'shinkansen', lon: 113.2690, lat: 22.9890, desc: '粤港澳大湾区核心枢纽，京广高铁南端。' },
    { id: 'cn_shenzhen', name: '深圳北站', type: 'shinkansen', lon: 114.0294, lat: 22.6097, desc: '广深港高铁关键站，直通香港西九龙。' },

    /* --- 西南（成渝 / 云贵）--- */
    { id: 'cn_chengdu', name: '成都东站', type: 'shinkansen', lon: 104.1411, lat: 30.6305, desc: '西南铁路最大中枢，川渝与西成高铁交汇。' },
    { id: 'cn_chongqing', name: '重庆北站', type: 'shinkansen', lon: 106.5499, lat: 29.6095, desc: '山城立体铁路枢纽，衔接成渝与渝贵干线。' },
    { id: 'cn_guiyang', name: '贵阳北站', type: 'shinkansen', lon: 106.6743, lat: 26.6184, desc: '西南喀斯特高桥隧高铁枢纽。' },
    { id: 'cn_kunming', name: '昆明南站', type: 'shinkansen', lon: 102.8565, lat: 24.8648, desc: '沪昆高铁终点，中老铁路国际漫游起点。' },

    /* --- 西北与青藏（丝路与雪域天路）--- */
    { id: 'cn_xian', name: '西安北站', type: 'shinkansen', lon: 108.9388, lat: 34.3767, desc: '西北门户，西成与徐兰高铁交汇。' },
    { id: 'cn_lanzhou', name: '兰州西站', type: 'shinkansen', lon: 103.7501, lat: 36.0649, desc: '黄河穿城，兰新与青藏方向总枢纽。' },
    { id: 'cn_xining', name: '西宁站', type: 'jr', lon: 101.8124, lat: 36.6203, desc: '青藏铁路起点，高原天路换乘站。' },
    { id: 'cn_lhasa', name: '拉萨站', type: 'jr', lon: 91.0715, lat: 29.6263, desc: '世界屋脊铁路终点，海拔 3641 米。' },
    { id: 'cn_urumqi', name: '乌鲁木齐站', type: 'shinkansen', lon: 87.5289, lat: 43.8414, desc: '兰新高铁终点，丝绸之路经济带铁路重镇。' },

    /* --- 东北（哈大骨架）--- */
    { id: 'cn_shenyang', name: '沈阳北站', type: 'shinkansen', lon: 123.4342, lat: 41.8172, desc: '东北铁路南大门，进出山海关必经枢纽。' },
    { id: 'cn_changchun', name: '长春站', type: 'shinkansen', lon: 125.3245, lat: 43.9090, desc: '东北腹地节点，哈大高铁中段。' },
    { id: 'cn_harbin', name: '哈尔滨西站', type: 'shinkansen', lon: 126.5740, lat: 45.7061, desc: '高寒高铁代表枢纽，冰雪北国门户。' },
];

export const RAILWAY_LINES = [
    { id: 'cn_jinghu', name: '京沪高铁', badge: '高铁干线', points: ['cn_beijing', 'cn_tianjin', 'cn_jinan', 'cn_nanjing', 'cn_shanghai'], color: '#f97316', dashArray: null },
    { id: 'cn_jingguang', name: '京广 - 广深高铁', badge: '南北大动脉', points: ['cn_beijing', 'cn_zhengzhou', 'cn_wuhan', 'cn_changsha', 'cn_guangzhou', 'cn_shenzhen'], color: '#f97316', dashArray: null },
    { id: 'cn_hukun', name: '沪昆干线', badge: '东西主轴', points: ['cn_shanghai', 'cn_hangzhou', 'cn_changsha', 'cn_guiyang', 'cn_kunming'], color: '#0284c7', dashArray: null },
    { id: 'cn_coastal', name: '东南沿海通道', badge: '沿海线', points: ['cn_hangzhou', 'cn_fuzhou', 'cn_shenzhen'], color: '#0284c7', dashArray: '6, 6' },
    { id: 'cn_silkroad', name: '西北丝路干线', badge: '徐兰 - 兰新', points: ['cn_zhengzhou', 'cn_xian', 'cn_lanzhou', 'cn_urumqi'], color: '#10b981', dashArray: null },
    { id: 'cn_southwest', name: '西成 - 成渝 - 渝贵', badge: '西南纵线', points: ['cn_xian', 'cn_chengdu', 'cn_chongqing', 'cn_guiyang'], color: '#10b981', dashArray: null },
    { id: 'cn_qinghai_tibet', name: '青藏高原天路', badge: '高海拔普速', points: ['cn_lanzhou', 'cn_xining', 'cn_lhasa'], color: '#3b82f6', dashArray: '5, 5' },
    { id: 'cn_northeast', name: '东北高寒干线', badge: '京哈 - 哈大', points: ['cn_beijing', 'cn_shenyang', 'cn_changchun', 'cn_harbin'], color: '#f97316', dashArray: null },
];

export const PILGRIMAGE_PICKS = [];
export const HANABI_EVENTS = [];

export const CHINA_REGION = {
    id: 'cn',
    name: '中国',
    icon: '🇨🇳',
    center: [34.5, 108.5],
    zoom: 4.5,
    description: '京沪/京广/沪昆/丝路与青藏铁路骨干网络',
};
