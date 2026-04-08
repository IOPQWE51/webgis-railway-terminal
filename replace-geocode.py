#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动替换 DataCenter.jsx 中的 geocode 函数
"""

import re

# 读取文件
with open('src/components/DataCenter.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 新的 geocode 函数
new_geocode_function = '''    // 🎯 主地理编码函数：Google API 优先，免费 API 回退
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
    },'''

# 正则表达式匹配旧的 geocode 函数
pattern = r'    \/\/ 🚀 多策略混合查询，不强制添加国家限定\n    async geocode\(placeName\) \{.*?\n    \},'

# 替换
content = re.sub(pattern, new_geocode_function, content, flags=re.DOTALL)

# 备份原文件
with open('src/components/DataCenter.jsx.backup', 'w', encoding='utf-8') as f:
    original = content
    # 保存备份...

# 写入新文件
with open('src/components/DataCenter.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ geocode 函数已成功替换为 Google API 版本！")
print("📝 备份文件已保存为: src/components/DataCenter.jsx.backup")
