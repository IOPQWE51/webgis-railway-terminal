# 🚀 API扩展计划 - 摄影判定系统增强

## 📊 当前状态评估

### ✅ 已优化项
- **并发请求**: Promise.all 实现（4个API同时发出）
- **智能缓存**: 分级缓存（5分钟-7天）
- **错误降级**: 任一API失败不影响整体
- **数据瘦身**: 响应 <5KB

### 🎯 覆盖的API（4个）
1. WeatherAPI - 天气、云量、风速
2. Overpass API - 地形（500m范围）
3. Phenology API - 樱花/枫叶物候
4. Aurora API - 极光概率

---

## 🆕 建议新增API（优先级排序）

### 🥇 第一批（立即价值，低成本）

#### 1. 🌿 植被覆盖度 (NDVI)
**ROI**: ⭐⭐⭐⭐⭐
**成本**: $0
**工作量**: 2小时

推荐API: **MODIS NDVI (NASA)**
- 免费API: https://modis.gsfc.nasa.gov/data/
- 更新频率: 每8天
- 空间分辨率: 250m

实现方案:
```javascript
// 新增 api/vegetation.js
export default async function handler(req, res) {
    const { lat, lon } = req.query;

    // 使用 MODIS NDVI 数据（NASA免费）
    const apiUrl = `https://modis.umd.edu/lab/api/ndvi?lat=${lat}&lon=${lon}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        res.setHeader('Cache-Control', 'public, s-maxage=604800'); // 7天缓存

        res.status(200).json({
            ndvi: data.ndvi || 0,           // -1到1, >0.6=茂盛
            vegetation_health: data.ndvi > 0.6 ? 'high' :
                              data.ndvi > 0.3 ? 'medium' : 'low',
            greenness_percentage: Math.max(0, (data.ndvi + 1) / 2 * 100),
            date: data.date
        });
    } catch (error) {
        res.status(200).json({ ndvi: 0, vegetation_health: 'unknown' });
    }
}
```

新增摄影规则:
- 🌼 "野花草甸" + NDVI>0.6 + 夏季 → 推荐
- 🌾 "金色芒草" + NDVI下降中 + 秋季 → 推荐
- 🌲 "森林光影" + NDVI>0.7 + 清晨 → 推荐

---

#### 2. 🚗 实时交通流量
**ROI**: ⭐⭐⭐⭐
**成本**: $0
**工作量**: 3小时

推荐API: **Mapbox Traffic (免费层: 100K次/月)**
- 免费额度: 100,000次/月
- 更新频率: 实时
- 覆盖范围: 全球

实现方案:
```javascript
// 新增 api/traffic.js
export default async function handler(req, res) {
    const { lat, lon } = req.query;

    // 使用 Mapbox Traffic API
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    const apiUrl = `https://api.mapbox.com/tiles/v1/mapbox/traffic-pattern-v1/${lon},${lat}/12?access_token=${mapboxToken}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        res.setHeader('Cache-Control', 'public, s-maxage=900'); // 15分钟缓存

        // 解析交通拥堵数据
        const congestionLevel = analyzeCongestion(data);

        res.status(200).json({
            traffic_level: congestionLevel,      // light/moderate/heavy
            congestion_index: congestionLevel === 'heavy' ? 75 :
                             congestionLevel === 'moderate' ? 50 : 25,
            peak_hours: [8, 9, 18, 19],           // 从历史数据获取
            current_cars_per_minute: estimateTrafficVolume(congestionLevel)
        });
    } catch (error) {
        res.status(200).json({ traffic_level: 'unknown', congestion_index: 0 });
    }
}
```

新增摄影规则:
- ✨ "车流灯轨" + 交通量>high + 蓝调时刻 + 桥梁 → 推荐
- 🌃 "空城夜景" + 交通量<low + 深夜 → 推荐（干净画面）

---

### 🥈 第二批（优化体验，中成本）

#### 3. 👥 人流密度
**ROI**: ⭐⭐⭐
**成本**: $0 (Foursquare免费层)
**工作量**: 4小时

推荐API: **Foursquare Venue Popularity**
- 免费额度: 100K次/月
- 实时人流数据
- 覆盖主要城市

实现方案:
```javascript
// 新增 api/crowd.js
export default async function handler(req, res) {
    const { lat, lon } = req.query;

    const foursquareId = process.env.FOURSQUARE_CLIENT_ID;
    const foursquareSecret = process.env.FOURSQUARE_CLIENT_SECRET;

    // 获取附近 venues 的人气数据
    const apiUrl = `https://api.foursquare.com/v2/venues/search?ll=${lat},${lon}&client_id=${foursquareId}&client_secret=${foursquareSecret}&v=20260331`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        res.setHeader('Cache-Control', 'public, s-maxage=1800'); // 30分钟缓存

        // 计算平均人流密度
        const venues = data.response?.venues || [];
        const avgCrowd = venues.reduce((sum, v) => sum + (v.stats?.usersCount || 0), 0) / venues.length;

        res.status(200).json({
            current_crowd_level: avgCrowd > 100 ? 'high' :
                               avgCrowd > 50 ? 'moderate' : 'low',
            busiest_hours: [10, 11, 15, 16],
            quietest_hours: [6, 7, 22, 23],
            relative_crowd: avgCrowd  // 相对于历史平均
        });
    } catch (error) {
        res.status(200).json({ current_crowd_level: 'unknown' });
    }
}
```

新增摄影规则:
- 🏯 "空城古刹" + 人流<low + 清晨 → 推荐
- 🏪 "热闹市集" + 人流>high + 白天 → 推荐

---

#### 4. 🌆 光污染数据
**ROI**: ⭐⭐⭐⭐
**成本**: $0
**工作量**: 2小时

推荐API: **Light Pollution Map (免费)**
- 免费API: https://www.lightpollutionmap.info/api
- 更新频率: 每月
- 覆盖范围: 全球

实现方案:
```javascript
// 新增 api/lightpollution.js
export default async function handler(req, res) {
    const { lat, lon } = req.query;

    // 使用 Light Pollution Map 的瓦片数据
    const zoom = 10;
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI / 2) * Math.pow(2, zoom));

    const tileUrl = `https://lighttrends.lightpollutionmap.info/img/tiles/${zoom}/${x}/${y}.png`;

    try {
        // 下载瓦片并解析像素值
        const imageBuffer = await fetch(tileUrl).then(r => r.arrayBuffer());
        const avgBrightness = analyzeImageBrightness(imageBuffer);

        res.setHeader('Cache-Control', 'public, s-maxage=2592000'); // 30天缓存

        res.status(200).json({
            sqm_value: avgBrightness < 50 ? 21.5 :
                      avgBrightness < 100 ? 20.0 :
                      avgBrightness < 150 ? 18.0 : 15.0,
            bortle_scale: avgBrightness < 50 ? 3 :
                         avgBrightness < 100 ? 4 :
                         avgBrightness < 150 ? 6 : 9,
            can_see_milkyway: avgBrightness < 100
        });
    } catch (error) {
        res.status(200).json({ sqm_value: 18, bortle_scale: 6, can_see_milkyway: false });
    }
}
```

新增摄影规则:
- 🌠 "银河拱桥" + SQM>21 + 新月 + 夏季 → 推荐
- 🌌 "极光星空" + SQM>20 + 极光 + 冬季 → 推荐

---

## 📊 完整集成方案

### 修改 dataGateway.js

```javascript
export const fetchGlobalEnvironmentData = async (lat, lon) => {
    // ... 现有代码 ...

    // 🆕 新增API并发请求
    const vegetationCacheKey = `vegetation_${Math.round(lat)}_${Math.round(lon)}`;
    const trafficCacheKey = `traffic_${Math.round(lat)}_${Math.round(lon)}`;
    const crowdCacheKey = `crowd_${Math.round(lat)}_${Math.round(lon)}`;
    const lightPollutionCacheKey = `lightpollution_${Math.round(lat)}_${Math.round(lon)}`;

    let vegetationData = getCachedData(vegetationCacheKey, CACHE_TTL.vegetation);
    let trafficData = getCachedData(trafficCacheKey, CACHE_TTL.traffic);
    let crowdData = getCachedData(crowdCacheKey, CACHE_TTL.crowd);
    let lightPollutionData = getCachedData(lightPollutionCacheKey, CACHE_TTL.light_pollution);

    const fetchPromises = [];

    // 现有的4个API...
    if (!weatherData) fetchPromises.push(fetchWeatherConcurrently());
    if (!terrainTags) fetchPromises.push(fetchTerrainConcurrently());
    if (!phenologyData) fetchPromises.push(fetchPhenologyConcurrently());
    if (!auroraData) fetchPromises.push(fetchAuroraConcurrently());

    // 🆕 新增的4个API
    if (!vegetationData) {
        fetchPromises.push(
            fetchVegetationConcurrently(lat, lon).then(data => {
                vegetationData = data;
                if (data) setCachedData(vegetationCacheKey, data);
            })
        );
    }

    if (!trafficData) {
        fetchPromises.push(
            fetchTrafficConcurrently(lat, lon).then(data => {
                trafficData = data;
                if (data) setCachedData(trafficCacheKey, data);
            })
        );
    }

    if (!crowdData) {
        fetchPromises.push(
            fetchCrowdConcurrently(lat, lon).then(data => {
                crowdData = data;
                if (data) setCachedData(crowdCacheKey, data);
            })
        );
    }

    if (!lightPollutionData) {
        fetchPromises.push(
            fetchLightPollutionConcurrently(lat, lon).then(data => {
                lightPollutionData = data;
                if (data) setCachedData(lightPollutionCacheKey, data);
            })
        );
    }

    // 等待所有8个API完成（如果同时发出）
    if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
    }

    return {
        // ... 现有字段 ...

        // 🆕 新增字段
        vegetation: {
            ndvi: vegetationData?.ndvi || 0,
            health: vegetationData?.vegetation_health || 'unknown'
        },
        traffic: {
            level: trafficData?.traffic_level || 'unknown',
            congestion: trafficData?.congestion_index || 0
        },
        crowd: {
            level: crowdData?.current_crowd_level || 'unknown'
        },
        lightPollution: {
            sqm: lightPollutionData?.sqm_value || 18,
            canSeeMilkyway: lightPollutionData?.can_see_milkyway || false
        }
    };
};
```

---

## 🎯 缓存策略更新

```javascript
const CACHE_TTL = {
    // 现有
    realtime_weather: 5 * 60 * 1000,        // 5 分钟
    daily_solar_track: 24 * 60 * 60 * 1000, // 24 小时
    monthly_gdd: 24 * 60 * 60 * 1000,
    const_terrain: 7 * 24 * 60 * 60 * 1000, // 7 天
    plant_phenology: 7 * 24 * 60 * 60 * 1000,

    // 🆕 新增
    vegetation: 7 * 24 * 60 * 60 * 1000,    // 🌿 7天（植被变化慢）
    traffic: 15 * 60 * 1000,                // 🚗 15分钟（交通变化快）
    crowd: 30 * 60 * 1000,                  // 👥 30分钟（人流变化中等）
    light_pollution: 30 * 24 * 60 * 60 * 1000 // 🌆 30天（光污染几乎不变）
};
```

---

## 📊 性能与成本分析

### API总数
- **当前**: 4个API
- **新增后**: 8个API

### 并发性能
- **当前**: 1-2秒（4个并发）
- **新增后**: 2-3秒（8个并发）
- **影响**: +1秒，可接受

### 月度成本
- **当前**: $0（全免费）
- **新增后**: $0（全免费）
- **免费额度**:
  - MODIS: 无限制
  - Mapbox: 100K次/月
  - Foursquare: 100K次/月
  - Light Pollution: 免费

### 缓存命中率
- **预计**: 从85% → 90%（更多数据源，更多缓存机会）

---

## 🚀 实施时间线

### 第1周（第一批）
- [ ] 集成植被API（2小时）
- [ ] 集成交通API（3小时）
- [ ] 更新缓存策略（1小时）
- [ ] 测试并优化（2小时）

### 第2周（第二批）
- [ ] 集成人流API（4小时）
- [ ] 集成光污染API（2小时）
- [ ] 新增摄影规则（3小时）
- [ ] 文档更新（1小时）

### 第3周（优化）
- [ ] 性能监控
- [ ] 用户反馈收集
- [ ] 缓存策略微调

---

## 📝 额外好处

1. **更精准的摄影建议**
   - 知道植被茂盛度 → 更准确的花海推荐
   - 知道交通流量 → 更精准的灯轨推荐
   - 知道人流密度 → 更好的空城意境推荐

2. **更智能的规则匹配**
   - 8个维度的环境数据
   - 100+ 条规则更精准触发
   - 减少误触发和漏触发

3. **用户粘性提升**
   - 更贴心的建议
   - 更高的命中率
   - 更强的实用性

---

## ⚠️ 注意事项

1. **API Key管理**
   - 所有Key存储在环境变量
   - 不要提交到Git

2. **错误降级**
   - 任一API失败不影响整体
   - 提供默认值

3. **监控与告警**
   - 监控API用量
   - 避免超出免费额度

---

**维护者**: IOPQWE51
**版本**: v4.3.0 计划
**最后更新**: 2026-03-31
**预计完成**: 2026-04-21
