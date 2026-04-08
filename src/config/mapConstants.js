// src/config/mapConstants.js

// 🔑 OpenWeatherMap API Key - 从环境变量读取
export const OWM_API_KEY = import.meta.env.VITE_OWM_KEY || '';

if (!OWM_API_KEY) {
  console.warn('⚠️ OpenWeatherMap API Key 未设置，天气图层将不可用');
}

export const RAILWAY_LINES_CONFIG = [
    { points: ['wakkanai', 'nayoro', 'asahikawa', 'iwamizawa', 'sapporo', 'tomakomai', 'hakodate'], color: '#22c55e', dashArray: null },
    { points: ['hakodate', 'shin_hakodate', 'shin_aomori'], color: '#f97316', dashArray: '6, 6' },
    { points: ['shin_aomori', 'aomori', 'hachinohe', 'morioka', 'ichinoseki', 'sendai', 'shiroishi', 'fukushima', 'koriyama', 'utsunomiya', 'omiya', 'ueno', 'tokyo'], color: '#22c55e', dashArray: null },
    { points: ['tokyo', 'yokohama', 'odawara', 'atami', 'shizuoka', 'hamamatsu', 'toyohashi', 'nagoya', 'maibara', 'kyoto', 'osaka'], color: '#22c55e', dashArray: null },
    { points: ['osaka', 'kobe', 'himeji', 'okayama', 'hiroshima', 'yamaguchi', 'shimonoseki'], color: '#22c55e', dashArray: null },
    { points: ['shimonoseki', 'moji', 'kokura', 'hakata', 'kumamoto', 'kagoshima_chuo'], color: '#22c55e', dashArray: null },
    { points: ['asahikawa', 'higashi_nemuro'], color: '#4ade80', dashArray: '4, 4' },
    { points: ['hakata', 'sasebo'], color: '#4ade80', dashArray: '4, 4' },
    { points: ['kagoshima_chuo', 'nishi_oyama'], color: '#22c55e', dashArray: null },
    { points: ['okayama', 'takamatsu'], color: '#22c55e', dashArray: null },
    { points: ['okayama', 'sakaiminato', 'oki'], color: '#3b82f6', dashArray: '4, 4' },
    { points: ['hiroshima', 'miyajima_guchi', 'miyajima'], color: '#3b82f6', dashArray: '4, 4' }
];

export const TYPE_COLORS = { station: '#3b82f6', airport: '#8b5cf6', anime: '#ec4899', hotel: '#f97316', spot: '#06b6d4' };

export const GLOBAL_WEATHER_NODES = [
    { name: '北京', lat: 39.9042, lon: 116.4074 }, { name: '东京', lat: 35.6895, lon: 139.6917 }, 
    { name: '新加坡', lat: 1.3521, lon: 103.8198 }, { name: '悉尼', lat: -33.8688, lon: 151.2093 }, 
    { name: '伦敦', lat: 51.5074, lon: -0.1278 }, { name: '巴黎', lat: 48.8566, lon: 2.3522 },
    { name: '纽约', lat: 40.7128, lon: -74.0060 }, { name: '洛杉矶', lat: 34.0522, lon: -118.2437 }
];

export const BASE_MAPS = {
    topo: { name: 'Esri 拓扑', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
    satellite: { name: '高清卫星', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
    dark: { name: '暗黑终端', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: 'OSM' }
};

export const getPointFilterType = (pt) => {
    const source = pt.source || ''; const type = pt.category || '';
    if (source.includes('车站') || type === 'station') return 'station';
    if (source.includes('机场') || type === 'airport' || type === 'plane') return 'airport';
    if (source.includes('巡礼') || type === 'anime') return 'anime';
    if (source.includes('住宿') || type === 'hotel') return 'hotel';
    return 'spot';
};