// src/utils/geocode.js
// 🛰️ 地理编码统一入口：主链走自有 Serverless 代理（服务端持 key、出口网络稳），
// 兜底走 Nominatim——同样在服务端兜（浏览器直连在国内网络环境下时通时断）。
// 两条地图轨道（Leaflet 主地图 / Mapbox dark2d）全部经由本模块，杜绝各写一套。

/**
 * 顺向地理编码：地点关键词 → { lat, lon, displayName, shortName } | null
 */
export async function searchPlace(query) {
    const q = (query || '').trim();
    if (!q) return null;

    // 主链：自有代理（Mapbox 服务端调用）
    try {
        const res = await fetch(`/api/mapbox?type=search&q=${encodeURIComponent(q)}`);
        if (res.ok) {
            const data = await res.json();
            const first = Array.isArray(data.results) ? data.results[0] : null;
            if (first) {
                return { lat: first.lat, lon: first.lon, displayName: first.address, shortName: first.name };
            }
        }
    } catch (_ignored) {
        // 主链失联时走兜底
    }

    // 兜底链：Nominatim 浏览器直连（本地开发/代理异常场景的最后防线）
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
            headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' }
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            return {
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                displayName: display_name,
                shortName: display_name.split(',')[0]
            };
        }
    } catch (_ignored) {
        // 全链路失联，返回 null 由调用方给出提示
    }

    return null;
}

/**
 * 逆向地理编码：坐标 → { country, countryCode, region, city, fullAddress } | null
 * 全球路径：不依赖任何手画 bbox，任何坐标都能解析（含服务端 Nominatim 兜底）
 */
export async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(`/api/mapbox?type=reverse&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.country) return data;
        }
    } catch (_ignored) {
        // 网络异常：返回 null，调用方回退到 bbox 快路径
    }
    return null;
}
