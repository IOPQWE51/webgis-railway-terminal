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

// 🎨 Dark 2D 战术风格通用样式常量
export const TACTICAL_STYLES = {
    // 颜色
    colors: {
        amber: '#fbbf24',
        amberGlow: 'rgba(251, 191, 36, 0.6)',
        amberBorder: 'rgba(251, 191, 36, 0.3)',
        amberBg: 'rgba(251, 191, 36, 0.1)',
        slateDark: '#050505',
        slatePanel: 'rgba(15, 23, 42, 0.4)',
        slatePanelHover: 'rgba(15, 23, 42, 0.6)',
        grayText: '#64748b',
        cyanBlue: '#0ea5e9',
        cyanBlueBg: 'rgba(14, 165, 233, 0.15)',
        cyanBlueBorder: '#0ea5e9',
        redAlert: '#ef4444',
        redAlertBg: 'rgba(239, 68, 68, 0.2)',
        greenStatus: '#22c55e',
        whiteText: '#f8fafc',
        whiteBg: '#ffffff'
    },

    // 按钮样式
    button: {
        base: {
            padding: '4px 12px',
            fontSize: '10px',
            letterSpacing: '1px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: '1px solid',
            whiteSpace: 'nowrap'
        },
        primary: {
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            color: '#fbbf24',
            borderColor: 'rgba(251, 191, 36, 0.3)'
        },
        primaryHover: {
            backgroundColor: 'rgba(251, 191, 36, 0.2)',
            borderColor: '#fbbf24'
        },
        secondary: {
            backgroundColor: 'transparent',
            color: '#64748b',
            borderColor: 'rgba(100, 116, 139, 0.3)'
        },
        danger: {
            backgroundColor: 'transparent',
            color: '#ef4444',
            borderColor: '#ef4444'
        },
        active: {
            backgroundColor: 'rgba(14, 165, 233, 0.15)',
            color: '#0ea5e9',
            borderColor: '#0ea5e9'
        },
        disabled: {
            opacity: 0.7,
            cursor: 'not-allowed'
        }
    },

    // 输入框样式
    input: {
        base: {
            padding: '4px 10px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            color: '#fbbf24',
            fontSize: '10px',
            letterSpacing: '1px',
            outline: 'none',
            fontFamily: '"Courier New", Courier, monospace'
        },
        focus: {
            borderColor: '#fbbf24'
        }
    },

    // 面板样式
    panel: {
        base: {
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            borderTop: '1px solid rgba(251, 191, 36, 0.2)',
            borderRight: '1px solid rgba(251, 191, 36, 0.2)',
            borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
            borderLeft: '4px solid #fbbf24',
            boxShadow: 'inset 0 0 20px rgba(251, 191, 36, 0.05)',
            padding: '12px 15px'
        }
    },

    // 地图容器样式
    mapContainer: {
        border: '1px solid rgba(251, 191, 36, 0.4)',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)',
        backgroundColor: '#000',
        position: 'relative'
    },

    // 角标装饰
    cornerMarker: (position = 'top-left') => ({
        position: 'absolute',
        width: '15px',
        height: '15px',
        ...(position === 'top-left' && { borderTop: '2px solid #fbbf24', borderLeft: '2px solid #fbbf24', top: 0, left: 0 }),
        ...(position === 'bottom-right' && { borderBottom: '2px solid #fbbf24', borderRight: '2px solid #fbbf24', bottom: 0, right: 0 }),
        zIndex: 10
    })
};