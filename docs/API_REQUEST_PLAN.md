# 🌐 API 需求清单与缓存策略

## 整体策略

根据系统中缺失的 **requires* 条件**，现在需要补齐 6 大类 API，每类有不同的**更新频率**和**缓存策略**。

---

## 📋 API 需求总表

| # | API 名称 | 主要用途 | 更新频率 | 缓存建议 | 费用 | 状态 |
|---|---------|--------|--------|--------|------|------|
| 1️⃣ | 🌸 **植物物候库** (**已实现** ✅) | 樱花/枫叶盛开度 | **1-7 天** | **7 天** | 💚 免费 | **✅ 已部署** |
| 2️⃣ | 🌌 **极光/地磁 API** | 地磁活动指数 | **实时** | **1 小时** | 💚 免费 | ⏳ 申请中 |
| 3️⃣ | ⭐ **天文事历库** | 流星雨、日月食 | **1 年** | **30 天** | 💚 免费 | ⏳ 申请中 |
| 4️⃣ | 🌃 **光污染地图 API** | 夜空亮度判断 | **每月** | **30 天** | 💚 免费 | ⏳ 申请中 |
| 5️⃣ | 💨 **风速细化 API** | 风速等级判断 | **实时** | **依赖天气** | 💚 免费 | ✅ 已有 |
| 6️⃣ | 🎆 **事件日历库** | 烟火/冰雕节 | **1-3 月** | **7 天** | 💰 付费 | ⏳ 申请中 |

---

## 🌸 1. 植物物候 API（樱花/枫叶盛开度）

### ✅ 已实现

**参数选择理由**：
```javascript
// 为什么选择这三个参数？

1️⃣ Maximum Temperature (2 m) ⭐⭐⭐
   为什么：樱花积温（GDD）的绝对核心
   原理：樱花树春天苏醒靠的就是每天最高气温超过 5°C 的累加值
   应用：
   - GDD < 400°C：未开
   - GDD 400-600°C：盛开中（0-100% 线性）
   - GDD 600-800°C：满开
   - GDD > 800°C：开始落花

2️⃣ Minimum Temperature (2 m) ⭐⭐⭐
   为什么：红叶（枫叶）见顷的绝对核心
   原理：红叶不需要高温，恰恰相反需要秋季的"冷刺激"
   应用：
   - 最低温连续 3 天 < 8°C：触发红叶色素变红
   - 冷刺激天数越多，枫叶变红度越深

3️⃣ Precipitation Sum ⭐⭐
   为什么：判定"残花/落叶"状态
   应用：
   - 花满开（stage > 80%）+ 暴雨（>20mm）= 花瓣落地
   - 花满开 + 小雨（5-20mm）= 花瓣部分脱落
   - 这样防止出现"满开樱花却在暴雨后仍然推荐拍摄"的尴尬
```

### 推荐服务
| 平台 | API 名称 | 覆盖范围 | 精准度 | 成本 | 申请状态 |
|------|---------|--------|--------|------|---------|
| **🥇 首选** | OpenMeteo 历史天气 | 全球 | 高（积温算法） | 💚 免费 | ✅ **已使用** |
| 备选 | JMA（日本気象協会） | 日本樱花 | 极高（官方） | 💰 付费 | ⏳ 可选升级 |
| 备选 | Plantin.io | 欧洲花期 | 中等 | 💰 付费 | ⏳ 可选升级 |

### 实际 API 端点
```
https://archive-api.open-meteo.com/v1/archive
```

### 请求参数
```javascript
GET /archive?
  latitude=35.6762&
  longitude=139.6503&
  start_date=2024-02-01&
  end_date=2024-03-28&
  daily=temperature_2m_max,temperature_2m_min,precipitation_sum&
  timezone=auto
```

### 响应示例
```javascript
{
    "daily": {
        "time": ["2024-02-01", "2024-02-02", ...],
        "temperature_2m_max": [12.5, 13.2, 14.1, ...],     // 最高温
        "temperature_2m_min": [5.2, 5.8, 6.1, ...],        // 最低温
        "precipitation_sum": [0, 2.1, 0, 5.5, ...]         // 降水量 (mm)
    }
}

### 核心计算逻辑

#### 🌸 樱花积温 (GDD) 计算
```javascript
let sakuraGDD = 0;
const GDD_THRESHOLD = 400;  // 樱花开花需要 ~400°C 积温

meteoData.daily.temperature_2m_max.forEach(temp => {
    // GDD 算法：每日最高温超过 5°C 的部分累加
    if (temp > 5) {
        sakuraGDD += (temp - 5);
    }
});

// 根据 GDD 计算盛开度
if (sakuraGDD < 400) bloom = 0%;      // 未开
if (sakuraGDD < 600) bloom = (gdd-400)/200 * 100;  // 开花中
if (sakuraGDD < 800) bloom = 100%;    // 满开
else bloom = 100 - (gdd-800)/100;     // 落花
```

#### 🍁 红叶冷刺激判定
```javascript
let coldStressConsecutiveDays = 0;
const COLD_THRESHOLD = 8;             // 最低温 < 8°C

// 检查最近 30 天的夜间最低温
meteoData.daily.temperature_2m_min.slice(-30).forEach(minTemp => {
    if (minTemp < COLD_THRESHOLD) {
        coldStressConsecutiveDays++;
    } else {
        coldStressConsecutiveDays = 0;  // 重置
    }
});

// 连续冷刺激 ≥ 3 天 → 触发红叶变红
if (coldStressConsecutiveDays >= 3) {
    mapleLeafChangeStage = coldStressConsecutiveDays * 10;  // 线性增长
}
```

#### 💧 残花/落叶判定
```javascript
let flowerCondition = 'pristine';
const precipitationLast48h = meteoData.daily.precipitation_sum.slice(-2).sum();

if (sakuraBloomStage > 80) {          // 满开状态
    if (precipitationLast48h > 20) {
        flowerCondition = 'heavy_rain';  // 花瓣大量脱落（>20mm）
    } else if (precipitationLast48h > 5) {
        flowerCondition = 'light_rain';  // 花瓣部分脱落（5-20mm）
    } else {
        flowerCondition = 'pristine';    // 完美无瑕
    }
}
```

### 集成代码

#### api/phenology.js（已创建 ✅）
```javascript
// 返回值示例
{
    "sakura": {
        "gdd": 450,                        // 有效积温（°C）
        "bloom_day": "2024-04-15",         // 开花日期
        "bloom_stage": 85,                 // 0-100% 盛开度
        "bloom_stage_name": "满开",         // 易读名称
        "condition": "pristine"             // pristine / light_rain / heavy_rain / fallen
    },
    "maple": {
        "cold_stress_days": 5,             // 连续冷刺激天数
        "leaf_change_stage": 50,           // 0-100% 变红度
        "leaf_change_ready": true          // 是否已触发变红
    },
    "weather_impact": {
        "precipitation_48h": 12.5,         // 最近 48h 降水 (mm)
        "flower_impact": "pristine"        // pristine / light_rain / heavy_rain / fallen
    },
    "metadata": {
        "latitude": 35.6762,
        "longitude": 139.6503,
        "data_date": "2024-03-28",
        "generated_at": "2024-03-28T12:00:00Z"
    }
}
```

#### dataGateway.js 集成（已更新 ✅）
```javascript
// CACHE_TTL 中添加了
plant_phenology: 7 * 24 * 60 * 60 * 1000  // 7 天缓存

// fetchGlobalEnvironmentData 中并行调用
const fetchPromises = [
    fetchWeatherConcurrently(lat, lon),
    fetchTerrainConcurrently(lat, lon),
    fetchPhenologyConcurrently(lat, lon)  // 新增：并行获取物候
];

// 返回结果中加入
ecology: {
    sakura: phenologyData?.sakura,        // 樱花数据
    maple: phenologyData?.maple,          // 红叶数据
    weatherImpact: phenologyData?.weather_impact  // 降水影响
}
```

---

## 🌌 2. 地磁活动 API（极光预报）

### 用途
```javascript
requiresGeomagneticActivity: true  // 极光预报
```

### 推荐服务
| 平台 | API 名称 | 覆盖范围 | 成本 |
|------|---------|--------|------|
| **🥇 首选** | NOAA Space Weather | 全球 | 💚 免费（官方） |
| 备选 | Swedish Institute Space | 北欧 | 💚 免费 |
| 备选 | Aurora FC | 预测精准 | 💰 付费 |

### Kp 指数解读
```
Kp 0-4：无极光或微弱（不推荐）
Kp 5-6：弱极光（中高纬度可见）
Kp 7-8：强极光（北欧、加拿大常见）
Kp 9：极强极光（非常罕见！）
```

### 更新策略
```
更新频率：每 15 分钟（实时数据）
缓存周期：1 小时（Kp 指数相对稳定）
实施位置：
  • api/geomagnet.js：获取最新 Kp 指数
  • dataGateway.js：缓存 1 小时
  • ruleMatcher.js：kpIndex 作为匹配条件
```

### 集成代码
```javascript
// api/geomagnet.js（新建 Serverless 端点）
export default async function handler(req, res) {
    // 缓存：1 小时
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    
    try {
        // NOAA 实时 Kp 预测
        const noaaUrl = 'https://services.swpc.noaa.gov/json/planetary_k_index_forecast.json';
        const data = await fetch(noaaUrl).then(r => r.json());
        
        // 提取最新 Kp 值
        const latestKp = data[data.length - 1].Kp;
        
        res.status(200).json({
            kp_index: latestKp,
            updated_at: new Date().toISOString(),
            aurora_probability: calculateAuroraProbability(latestKp)
        });
    } catch (error) {
        res.status(500).json({ error: "地磁数据获取失败" });
    }
}

function calculateAuroraProbability(kp) {
    if (kp < 5) return '0%';
    if (kp < 7) return '50%';
    if (kp < 9) return '80%';
    return '99%';
}
```

---

## ⭐ 3. 天文事历库（流星雨、日月食、彗星）

### 用途
```javascript
requiresMeteorEvent: true          // 流星雨极大期
requiresSolarEclipse: true         // 日全食
requiresLunarEclipse: true         // 月全食
requiresSuperMoon: true            // 超级月亮
requiresCometEvent: true           // 彗星出现
```

### 推荐服务
| 平台 | API 名称 | 覆盖范围 | 成本 |
|------|---------|--------|------|
| **🥇 首选** | NASA API (AstroDB) | 全球天文事件 | 💚 免费（注册） |
| 备选 | In-The-Sky.org API | 月度详细日历 | 💚 免费 |
| 备选 | Skyfield + Ephemeris | 精密计算 | 💚 免费（图书馆） |

### 数据格式
```javascript
{
    "meteor_showers": [
        {
            "name": "Perseid Meteor Shower",
            "peak_date": "2024-08-12",
            "peak_rate": 150,           // ZHR (每小时天顶流星数)
            "best_time": "02:00-05:00", // 北半球
            "radiant": { "ra": 48, "dec": 58 }
        }
    ],
    "eclipses": [
        {
            "type": "solar",
            "date": "2024-04-08",
            "max_duration": "4m 28s",
            "path": "Mexico, USA, Canada"
        }
    ]
}
```

### 更新策略
```
更新频率：1 年（天文事件固定，预售后不变）
缓存周期：30 天（下载整年数据，本地缓存）
实施位置：
  • api/astronomy-calendar.js（预热夹）
  • dataGateway.js：CACHE_TTL.yearly_events = 30 天
  • 本地存储：可 hardcode 今年的关键日期
```

### 集成代码
```javascript
// api/astronomy-calendar.js
export default async function handler(req, res) {
    // 缓存：30 天
    res.setHeader('Cache-Control', 'public, s-maxage=2592000');
    
    try {
        const nasaUrl = 'https://api.nasa.gov/planetary/earth/assets/';
        
        // 或使用 In-The-Sky 的月度文件
        const skyUrl = 'https://in-the-sky.org/apirest/2024/events.txt';
        
        // 简化：本地硬编码 2024-2026 的关键日期
        const events = {
            "meteor_showers": [
                { name: "Perseid", peak: "2024-08-12", zhr: 150 },
                { name: "Geminid", peak: "2024-12-14", zhr: 120 }
            ],
            "eclipses": [
                { type: "solar", date: "2024-04-08", path: "North America" },
                { type: "lunar", date: "2024-09-18", path: "Global" }
            ]
        };
        
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ error: "天文日历获取失败" });
    }
}
```

### 本地硬编码备选方案
```javascript
// utils/astronomyCalendar.js - 离线数据库
export const keyAstronomyEvents = {
    2024: {
        "meteor_showers": [
            { name: "Perseid", start: "2024-07-17", peak: "2024-08-12", end: "2024-08-24", zhr: 150 },
            { name: "Geminid", start: "2024-12-07", peak: "2024-12-14", end: "2024-12-17", zhr: 120 }
        ],
        "eclipses": [
            { type: "solar", date: "2024-04-08", magnitude: 1.0, path: "Mexico, USA, Canada" },
            { type: "lunar", date: "2024-09-18", magnitude: 1.076 }
        ],
        "super_moons": [
            "2024-09-18", "2024-10-18", "2024-11-15"
        ]
    },
    2025: { /* ... */ },
    2026: { /* ... */ }
};
```

---

## 🌃 4. 光污染地图 API（银河可见性）

### 用途
```javascript
requiresLowLightPollution: true    // 银河拱桥观景
```

### 推荐服务
| 平台 | API 名称 | 覆盖范围 | 成本 |
|------|---------|--------|------|
| **🥇 首选** | Light Pollution Map (Lighttrends) | 全球 | 💚 免费 |
| 备选 | Earth Observation Group (NOAA) | 全球卫星 | 💚 免费 |
| 备选 | Overpass QL (OSM) | POI 级 | 💚 免费 |

### 亮度指数
```
Sky Quality Meter (SQM) 值：
21.0+：极佳（城市外 50+ km）
20.5-21.0：很好
20.0-20.5：良好
18.0-20.0：中等
< 18：严重光污染（不适合星空摄影）

推荐阈值：> 20.0（能看到银河）
```

### 更新策略
```
更新频率：每月 1 次（地图数据相对稳定）
缓存周期：30 天
实施位置：
  • utils/lightPollutionCache.js：本地缓存库
  • ruleDataConverter.js：计算 sqmValue，判断 canSeeMilkyway
```

### 集成代码
```javascript
// utils/lightPollutionLookup.js
import polytile from 'polytile';  // 开源库

export function getSkySQM(lat, lon) {
    // 使用 Light Pollution Map 的网格数据
    // 或本地缓存的 GeoJSON
    
    try {
        const tileUrl = `https://lighttrends.lightpollutionmap.info/img/tiles/`;
        const zoom = 10;
        const tile = polytile.getTile(lat, lon, zoom);
        
        // 从网格中查询亮度值
        const sqmValue = querySQMDatabase(tile);
        
        return {
            sqm_value: sqmValue,
            suitable_for_milkyway: sqmValue > 20.0,
            light_pollution_level: sqmValue > 20 ? 'low' : 'high'
        };
    } catch (error) {
        console.warn('光污染数据查询失败，使用默认值');
        return { sqm_value: 21.0 };  // 假设是最佳情景
    }
}
```

---

## 💨 5. 风速细化 API（微风判断）

### 用途
```javascript
requiresWindyWeather: true         // 樱吹雪需要微风
```

### 当前现状
✅ **已有**：OpenWeather 提供 `wind_kph`  
✅ **已有**：ruleDataConverter 填充 `windSpeed`

### 需要的细化
```javascript
// 不只要风速，还要风向
windDirection: 'NW',               // 北偏西
windGusts: 15,                     // 阵风速度
windVariability: 'stable'          // 风势稳定性
```

### 集成到现有系统
```javascript
// api/weather.js 已有的修改
const trimmedWeather = {
    // ... 已有的字段
    wind_kph: weatherData.current?.wind_kph ?? 0,
    wind_degree: weatherData.current?.wind_degree ?? 0,    // 新增
    wind_gust: weatherData.current?.gust_kph ?? 0,         // 新增
};

// ruleDataConverter.js
export function convertToRuleFormat(rawEnvData, lat, lon) {
    return {
        // ...
        windSpeed: rawEnvData.weather?.wind_kph,
        windDirection: degreeToCardinal(rawEnvData.weather?.wind_degree),  // 转换为 N/S/E/W
        windGust: rawEnvData.weather?.wind_gust,
        isWindyWeather: (rawEnvData.weather?.wind_kph || 0) > 10  // > 10 km/h 为微风
    };
}

function degreeToCardinal(degree) {
    if (!degree) return 'N';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(degree / 22.5) % 16];
}
```

---

## 🎆 6. 事件日历库（烟火大会、冰雕节等）

### 用途
```javascript
requiresFireworksEvent: true       // 烟火大会
requiresIceScultureFestival: true  // 冰雕节
requiresMarketEvent: true          // 市集/庙会
```

### 推荐服务
| 平台 | 覆盖范围 | 更新频率 | 成本 | 备注 |
|------|--------|--------|------|------|
| **日本** | 全国烟火大会カレンダー | 3 月前 | 💚 免费 | 官方已有 API |
| **中国** | 民俗活动日历 API | 1-2 月 | 💰 付费 | 文化部数据库 |
| **欧洲** | Local Events API | 每月更新 | 💰 付费 | Eventbrite 集成 |
| **全球** | Google Calendar API | 实时 | 💚 免费 | 各地组织者发布 |

### 更新策略
```
更新频率：1-3 月（虽然前期公布，但细节在临近时会调整）
缓存周期：7 天
实施位置：
  • utils/eventCalendar.js：维护本地事件库
  • 每月手工更新季节性活动
```

### 集成代码
```javascript
// utils/eventCalendar.js
export const majorEventsByMonth = {
    "2024-02": [
        { name: "冰雕节", location: "札幌", start: "2024-02-05", end: "2024-02-11", type: "ice_sculpture" }
    ],
    "2024-07": [
        { name: "隅田川烟火大会", location: "东京", date: "2024-07-27", type: "fireworks" },
        { name: "长冈烟火大会", location: "新潟", date: "2024-08-02", type: "fireworks" }
    ],
    "2024-11": [
        { name: "红叶祭", location: "京都", start: "2024-11-01", end: "2024-11-30", type: "market" }
    ]
};

export function getEventsNearby(lat, lon, withinDays = 30) {
    const today = new Date();
    const events = [];
    
    // 遍历本地事件库，计算距离和日期
    for (const monthEvents of Object.values(majorEventsByMonth)) {
        monthEvents.forEach(event => {
            const eventDate = new Date(event.start);
            const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntil > 0 && daysUntil <= withinDays) {
                const distance = calculateDistance(lat, lon, event.location);
                if (distance < 100) {  // 100 km 范围内
                    events.push({ ...event, daysUntil, distance });
                }
            }
        });
    }
    
    return events.sort((a, b) => a.daysUntil - b.daysUntil);
}
```

---

## 📊 成本评估与优先级

### 按优先级排列

| 优先级 | API | 成本 | 工作量 | ROI | 建议时间 |
|--------|-----|------|--------|-----|---------|
| 🥇 高 | 植物物候 + 极光 | $0-50/月 | 2-3 天 | 极高 | **立即** |
| 🥈 中 | 天文事历 | $0 | 1 天（硬编码） | 高 | **本周** |
| 🥉 低 | 光污染地图 | $0 | 2 天 | 中 | **下周** |
| ⭐ 加分 | 事件日历 | $0-100/月 | 1 周（手工） | 中 | **后续** |

### 月度成本估算
```
最小化方案（推荐）：
  • OpenMeteo 物候：$0（免费）
  • NOAA 地磁：$0（免费）
  • NASA 天文：$0（免费）
  • 光污染地图：$0（免费）
  ——————————————
  月度成本：$0 ✅

高级方案（后期优化）：
  • JMA 樱花预报：$50/月（高精准）
  • Aurora FC：$30/月（极光预测）
  • 事件日历 API：$50/月
  ——————————————
  月度成本：$130/月
```

---

## 🛠️ 实施路线图

### Phase 1（本周）- 核心 API 部署
```
Week 1:
  [ ] 注册 NOAA 账户，获取地磁 API key
  [ ] 测试 Open-Meteo 物候端点
  [ ] 创建 api/geomagnet.js 和 api/phenology.js
  [ ] 更新 dataGateway.js 并行调用
  [ ] 本地测试：金门大桥樱花预报
```

### Phase 2（2-3 周）- 天文事件补充
```
Week 2-3:
  [ ] 硬编码 2024-2026 关键天文事件
  [ ] 创建 utils/astronomyCalendar.js
  [ ] 更新 ruleMatcher.js 判断流星雨/日月食
  [ ] 集成极光预报触发规则
```

### Phase 3（后续）- 完全补全
```
Week 4+:
  [ ] 光污染地图集成
  [ ] 事件日历维护系统
  [ ] 升级为付费 API（可选）
  [ ] 用户通知系统（推送特殊事件）
```

---

## 💾 缓存策略总结

```javascript
// dataGateway.js 中的完整 CACHE_TTL 定义
const CACHE_TTL = {
    realtime_weather: 5 * 60 * 1000,                // 天气：5 分钟
    daily_solar_track: 24 * 60 * 60 * 1000,         // 太阳轨迹：24 小时
    plant_phenology: 7 * 24 * 60 * 60 * 1000,       // 🌸 樱花/枫叶：7 天
    geomagnet_forecast: 60 * 60 * 1000,             // 🌌 极光：1 小时
    const_terrain: 7 * 24 * 60 * 60 * 1000,         // 地形：7 天
    astronomy_events: 30 * 24 * 60 * 60 * 1000,     // ⭐ 流星雨/日月食：30 天
    light_pollution: 30 * 24 * 60 * 60 * 1000,      // 🌃 光污染：30 天
    events_calendar: 7 * 24 * 60 * 60 * 1000        // 🎆 烟火大会：7 天
};
```

---

## 📝 下一步行动

1. **立即申请**：
   - ✅ NOAA Space Weather (已有官网，即插即用)
   - ✅ OpenMeteo 物候（检查 API 额度）
   - ✅ NASA API key（注册表单）

2. **代码准备**：
   - 创建 `api/geomagnet.js`
   - 创建 `api/phenology.js`
   - 更新 `vercel.json` 的缓存配置

3. **集成测试**：
   - 验证金门大桥樱花预报逻辑
   - 验证极光预警触发
   - 验证缓存命中率

