// 公共函数和工具方法
export const ICON_STYLE_MAP = {
    station: { color: '#3b82f6', icon: '🚉' },
    airport: { color: '#8b5cf6', icon: '✈️' },
    anime: { color: '#ec4899', icon: '🌸' },
    hotel: { color: '#f97316', icon: '🏨' },
    default: { color: '#06b6d4', icon: '📍' }
};

export const getIconStyle = (type, source = '') => {
    if (source.includes('车站') || type === 'station') return ICON_STYLE_MAP.station;
    if (source.includes('机场') || type === 'airport' || type === 'plane') return ICON_STYLE_MAP.airport;
    if (source.includes('圣地') || type === 'anime') return ICON_STYLE_MAP.anime;
    if (source.includes('住') || type === 'hotel') return ICON_STYLE_MAP.hotel;
    return ICON_STYLE_MAP.default;
};