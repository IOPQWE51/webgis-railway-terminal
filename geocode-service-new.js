// 🔑 Google Maps API Key - 从环境变量读取
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ Google Maps API Key 未设置，地理编码功能将不可用');
}

// 🗂️ 地理编码缓存（防止重复查询）
const geocodeCache = new Map();

const geocodeService = {
    // 🔧 从 Google Maps URL 提取 Place ID
    extractPlaceId(url) {
        if (!url) return null;
        // 匹配格式：!1s{place_id}
        const match = url.match(/!1s([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    },

    // 🚀 使用 Google Geocoding API 查询（优先）
    async geocodeWithGoogle(placeIdOrName) {
        try {
            // 检查缓存
            const cacheKey = placeIdOrName;
            if (geocodeCache.has(cacheKey)) {
                console.log(`[缓存命中] ${placeIdOrName}`);
                return geocodeCache.get(cacheKey);
            }

            let url;

            // 判断是 Place ID 还是地名
            if (placeIdOrName.match(/^0x[a-fA-F0-9]+:[a-fA-F0-9]+$/) || placeIdOrName.length > 20) {
                // Place ID 查询
                url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeIdOrName)}&key=${GOOGLE_MAPS_API_KEY}`;
            } else {
                // 地名查询
                url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeIdOrName)}&key=${GOOGLE_MAPS_API_KEY}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
                const location = data.results[0].geometry.location;
                const result = {
                    lat: location.lat,
                    lon: location.lng
                };

                // 存入缓存
                geocodeCache.set(cacheKey, result);
                console.log(`[Google API 命中] ${placeIdOrName} -> ${result.lat}, ${result.lon}`);

                return result;
            } else if (data.status === 'ZERO_RESULTS') {
                console.warn(`[Google API] 未找到: ${placeIdOrName}`);
                return null;
            } else {
                console.error(`[Google API 错误] ${placeIdOrName}:`, data.status, data.error_message);
                return null;
            }
        } catch (error) {
            console.error(`[Google API 失败] ${placeIdOrName}:`, error);
            return null;
        }
    },

    // 🎯 主地理编码函数：Google API 优先，免费 API 回退
    async geocode(placeName, url = null) {
        try {
            // 🚀 策略 1：如果有 URL，优先提取 Place ID 并使用 Google API
            if (url) {
                const placeId = this.extractPlaceId(url);
                if (placeId) {
                    console.log(`[Place ID 检测] ${placeName} -> ${placeId}`);
                    const result = await this.geocodeWithGoogle(placeId);
                    if (result) return result;
                }
            }

            // 🚀 策略 2：直接使用 Google API 查询地名
            console.log(`[Google API 查询] ${placeName}`);
            const result = await this.geocodeWithGoogle(placeName);
            if (result) return result;

            // 🚀 策略 3：Google API 失败，回退到免费 API（Photon、ArcGIS、OSM）
            console.log(`[回退到免费 API] ${placeName}`);
            return await this.geocodeWithFallback(placeName);

        } catch (error) {
            console.error(`[地理编码失败] ${placeName}:`, error);
            return null;
        }
    },

    // 🔄 免费回退方案（Photon + ArcGIS + OSM）
    async geocodeWithFallback(placeName) {
        try {
            // 引擎 A：Photon
            try {
                const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(placeName)}&limit=1`;
                const photonRes = await fetch(photonUrl);
                const photonData = await photonRes.json();
                if (photonData?.features?.length > 0) {
                    const coords = photonData.features[0].geometry.coordinates;
                    console.log(`[Photon 命中] ${placeName} -> ${coords[1]}, ${coords[0]}`);
                    return { lat: coords[1], lon: coords[0] };
                }
            } catch (_e) { }

            // 引擎 B：ArcGIS
            try {
                const arcGisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(placeName)}&maxLocations=1`;
                const arcRes = await fetch(arcGisUrl);
                const arcData = await arcRes.json();
                if (arcData?.candidates?.length > 0) {
                    const location = arcData.candidates[0].location;
                    console.log(`[ArcGIS 命中] ${placeName} -> ${location.y}, ${location.x}`);
                    return { lat: location.y, lon: location.x };
                }
            } catch (_e) { }

            // 引擎 C：OSM Nominatim
            try {
                const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1&accept-language=zh-CN,ja,en-US`;
                const osmRes = await fetch(osmUrl);
                const osmData = await osmRes.json();
                if (osmData?.length > 0) {
                    console.log(`[OSM 命中] ${placeName} -> ${osmData[0].lat}, ${osmData[0].lon}`);
                    return { lat: parseFloat(osmData[0].lat), lon: parseFloat(osmData[0].lon) };
                }
            } catch (_e) { }

            console.warn(`[全部失败] ${placeName}`);
            return null;
        } catch (error) {
            console.error(`[免费 API 失败] ${placeName}:`, error);
            return null;
        }
    },
};
