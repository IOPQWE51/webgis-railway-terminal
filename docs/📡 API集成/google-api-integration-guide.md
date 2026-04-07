# 🔧 Google Maps API 集成指南

## ✅ 已完成的修改

1. ✅ 添加了 Google API Key
2. ✅ 添加了 `extractPlaceId` 函数
3. ✅ 添加了 `geocodeWithGoogle` 函数
4. ✅ 添加了缓存机制 `geocodeCache`
5. ✅ 修改了 CSV 导入，传递 URL 给 geocode 函数

## ⚠️ 需要手动替换的代码

在 `src/components/DataCenter.jsx` 中，找到第 73 行开始的旧 `geocode` 函数，替换为以下代码：

### 📍 查找位置
第 73-144 行（从 `async geocode(placeName) {` 到 `},` 结束）

### 🔧 替换为新代码：

```javascript
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
                    return { lat: parseFloat(osmData[0].lat), lon: parseFloat(osmData[0].lon) }];
                }
            } catch (_e) { }

            console.warn(`[全部失败] ${placeName}`);
            return null;
        } catch (error) {
            console.error(`[免费 API 失败] ${placeName}:`, error);
            return null;
        }
    },
```

## 🎯 测试步骤

1. 保存文件
2. 运行 `npm run dev`
3. 上传包含 Google Maps URL 的 CSV 文件
4. 查看浏览器控制台，应该看到：
   ```
   [Place ID 检测] 清水断崖 -> 0x34662bbc59bb7d23:0x418f58180968f4b
   [Google API 命中] 0x34662bbc59bb7d23:0x418f58180968f4b -> 24.1, 121.6
   ```

## 📊 预期结果

- ✅ 清水断崖 → 台湾（不是兰州）
- ✅ 毛里求斯 → 非洲
- ✅ 法罗群岛 → 丹麦
- ✅ 宫崎机场 → 日本（准确）
- ✅ 所有带 Place ID 的地点 100% 准确

## 💰 费用

15 个地点 ≈ $0.075（完全在免费额度内）
