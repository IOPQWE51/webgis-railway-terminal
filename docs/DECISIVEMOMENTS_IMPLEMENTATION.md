# decisiveMoments.js v2.0+ 扩展实现指南

## 🎉 新增内容概览

已将 100+ 全球摄影触发规则添加到 `decisiveMoments.js`，包含：

- 🌌 极地与天体现象 (10 个)
- 💧 水景与瀑布 (4 个)
- 🌸 樱花与春季 (6 个)
- 🍁 秋季枫叶 (5 个)
- ❄️ 冬季与雪景 (7 个)
- 🌼 花海与花季 (10 个)
- 🔥 火焰与光影 (4 个)
- 🦋 生物与非洲 (8 个)
- 🏰 地标与建筑 (20+ 个)
- ⛰️ 山水风景 (15+ 个)
- 🎆 特殊活动与节日 (10 个)
- 🌆 城市与夜景 (8 个)
- 🌪️ 沙漠与极端环境 (3 个)

---

## ⚠️ 关键问题：需要在 photoEngine.js 中补充的条件匹配逻辑

### 1️⃣ 新的条件字段 & 所需的匹配代码

在 `photoEngine.js` 的 `initPhotoEvalEngine()` 函数中，现有的规则匹配循环必须扩展以支持这些新字段：

#### 现在只有这些匹配逻辑：
```javascript
// 旧的
if (c.weather && !c.weather.some(w => condition.toLowerCase().includes(w.toLowerCase()))) isMatch = false;
if (c.category && !c.category.includes(category)) isMatch = false;
if (c.timeWindow) { ... }
if (c.tempMax !== undefined && temp !== undefined && temp > c.tempMax) isMatch = false;
if (c.moonPhaseMin !== undefined && moonPhase < c.moonPhaseMin) isMatch = false;
if (c.hasWaterfall && !envData.terrain.hasWaterfall) isMatch = false;
// ... 其他地形字段
```

#### 需要补充的新匹配逻辑：
```javascript
// 新增：纬度检查
if (c.minLatitude !== undefined && lat !== undefined && lat < c.minLatitude) isMatch = false;
if (c.maxLatitude !== undefined && lat !== undefined && lat > c.maxLatitude) isMatch = false;

// 新增：季节检查
if (c.season && Array.isArray(c.season) && !c.season.includes(season)) isMatch = false;

// 新增：最小月相范围 (满月约 0.8~1)
if (c.minMoonPhase !== undefined && moonPhase < c.minMoonPhase) isMatch = false;
if (c.maxMoonPhase !== undefined && moonPhase > c.maxMoonPhase) isMatch = false;

// 新增：天气类型精确匹配
if (c.weather && Array.isArray(c.weather)) {
    if (!c.weather.some(w => condition.toLowerCase().includes(w.toLowerCase()))) isMatch = false;
}

// 新增：布尔值条件
if (c.isNight !== undefined && isNight !== c.isNight) isMatch = false;
if (c.requiresWindyWeather !== undefined && c.requiresWindyWeather === true) {
    // 需要在 envData 中添加风速数据
    // if (!envData.weather.wind || envData.weather.wind < 3) isMatch = false;
}

// 新增：特殊事件标记 (需要额外的事件数据源)
if (c.requiresGeomagneticActivity) {
    // 需要地磁活动API数据
    // if (!envData.geomagnetism || envData.geomagnetism.kpIndex < 4) isMatch = false;
}

if (c.requiresFireworksEvent) {
    // 需要日程表数据
    // if (!eventCalendar.hasFireworks(lat, lon, now)) isMatch = false;
}

// ... 其他特殊事件检查
```

---

## 📡 需要在 dataGateway.js 中补充的数据源

### 新增数据字段到 `fetchGlobalEnvironmentData()` 返回值：

```javascript
// 在返回对象中添加：

{
  // 现有的...
  
  // 新增：地磁数据
  geomagnetism: {
    kpIndex: Number,              // 0~9 (0=无极光, 5+=强极光)
    isActive: Boolean             // 是否有地磁风暴
  },
  
  // 新增：坐标数据
  coordinates: {
    lat: Number,
    lon: Number
  },
  
  // 新增：特殊地标类型
  landmarks: {
    hasDesert: Boolean,
    requiresLowLightPollution: Boolean,
    ??? [根据实际需要添加] 
  },
  
  // 新增：风速数据
  weather: {
    // 现有的...
    wind: Number,                // 风速 (m/s)
    windDirection: Number        // 风向 (0-360°)
  }
}
```

### API 数据源映射

| 数据字段 | API 来源 | 状态 | 成本 |
|--------|--------|------|------|
| 地磁活动 (KP Index) | NOAA SWPC | ❌ 未集成 | 免费 |
| 事件日程 (花火/祭典) | 社区众构 | ❌ 未集成 | 手动维护 |
| 极光预报 | Aurora Forecast | ❌ 未集成 | 免费 |
| 天体事件 (日食/月食) | NASA API | ❌ 未集成 | 免费 |
| 风速数据 | WeatherAPI | ✅ 已有 | 免费 |
| 海洋生物事件 | GBIF | ❌ 未集成 | 免费 |

---

## 🛠️ 分阶段实现路线图

### Phase 1: 核心条件匹配 (优先级：高 ⭐⭐⭐)

在 `photoEngine.js` 中补充这些条件检查（**立即可做**）：

```javascript
// 在决定性瞬间匹配循环中添加：
const c = rule.conditions;
let isMatch = true;

// 已有的条件...

// 新增简单条件检查
if (c.minLatitude && lat < c.minLatitude) isMatch = false;
if (c.maxLatitude && lat > c.maxLatitude) isMatch = false;

if (c.season && c.season.length > 0) {
    if (!c.season.includes(season)) isMatch = false;
}

if (c.isNight !== undefined && isNight !== c.isNight) isMatch = false;

if (c.minMoonPhase !== undefined && moonPhase < c.minMoonPhase) isMatch = false;
if (c.maxMoonPhase !== undefined && moonPhase > c.maxMoonPhase) isMatch = false;

if (c.minTemp !== undefined && temp !== undefined && temp < c.minTemp) isMatch = false;
if (c.maxTemp !== undefined && temp !== undefined && temp > c.maxTemp) isMatch = false;
```

### Phase 2: 扩展数据收集 (优先级：中 ⭐⭐)

在 `dataGateway.js` 中添加：

```javascript
export const fetchGlobalEnvironmentData = async (lat, lon) => {
    // 现有代码...
    
    // 新增：获取风速 (WeatherAPI 已有)
    const wind = weatherData.current?.wind_kph / 3.6; // 转换为 m/s
    
    // 新增：获取地磁数据 (可选，NOAA API 需申请)
    let geomagnetism = null;
    try {
        const geoRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        if (geoRes.ok) {
            const geoData = await geoRes.json();
            geomagnetism = {
                kpIndex: geoData[geoData.length - 1][1],
                isActive: geoData[geoData.length - 1][1] >= 4
            };
        }
    } catch (err) { console.warn('地磁数据获取失败'); }
    
    return {
        // 现有数据...
        geomagnetism,
        coordinates: { lat, lon },
        weather: {
            // 现有...
            wind,
            windDirection: weatherData.current?.wind_degree
        }
    };
};
```

### Phase 3: 事件日程系统 (优先级：低 ⭐)

创建新文件 `src/data/eventCalendar.js`：

```javascript
export const globalEventCalendar = {
    fireworks: [
        { name: '长冈花火', lat: 37.44, lon: 138.84, date: '8月2-3日', active: true },
        { name: '大曲花火', lat: 39.14, lon: 140.57, date: '8月第3周周六', active: true },
        { name: '隅田川花火', lat: 35.72, lon: 139.77, date: '7月最后周末', active: true },
        // ... 更多
    ],
    festivals: [
        { name: '祇園祭', lat: 35.00, lon: 135.77, month: 7, type: 'matsuri' },
        // ... 更多
    ],
    celestialEvents: [
        { type: 'solar_eclipse', date: '2026-08-12', paths: [[lat, lon], ...] },
        { type: 'meteor_shower', name: 'Perseid', peak: '8月11-13', radiant: [45, 58] },
        // ... 更多
    ]
};

export const hasEventNearby = (eventType, lat, lon, date) => {
    // 实现逻辑
};
```

---

## 🚨 需要手动处理的规则

某些规则无法自动触发，需要人工输入或特殊 API：

| 规则 ID | 问题 | 解决方案 |
|--------|------|--------|
| `requiresWhaleEvent` | 无法自动获知鲸鱼位置 | 社区众构 / 季节启发式 |
| `requiresGeomagneticActivity` | 需要 NOAA 地磁数据 | 集成 SWPC API |
| `requiresCometEvent` | 需要天文事件数据 | 集成 NASA API |
| `requiresFireworksEvent` | 需要各国花火日程 | 维护事件数据库 |
| `requiresPenguinEvent` | 企鹅迁徙时间 | 生物学数据库 |
| 等等... | 特殊事件 | 按需集成 |

---

## 📝 临时解决方案

对于暂时无法获取数据的规则，建议在 `photoEngine.js` 中条件性启用：

```javascript
// 方案：设置功能开关
const ADVANCED_FEATURES_ENABLED = {
    geomagnetism: false,          // 禁用极光规则
    celestialEvents: false,       // 禁用天体事件
    animalMigration: false,       // 禁用动物迁徙
    firestormsFireworks: false    // 禁用事件日程
};

// 在规则匹配时检查：
if (c.requiresGeomagneticActivity && !ADVANCED_FEATURES_ENABLED.geomagnetism) {
    isMatch = false; // 跳过此规则
}
```

---

## 🎯 快速实现清单

### 第一阶段（本周）
- [ ] 在 photoEngine.js 补充 Phase 1 的条件匹配逻辑
- [ ] 测试现有规则是否能正常触发
- [ ] 更新文档

### 第二阶段（本月）
- [ ] 在 dataGateway.js 添加风速和温度数据
- [ ] 创建 eventCalendar.js
- [ ] 手动维护基础事件日程 (樱花、枫叶、花火等)

### 第三阶段（后续）
- [ ] 集成 NOAA 地磁 API （北极光规则）
- [ ] 集成 NASA 天体事件 API （日食、流星雨）
- [ ] 构建社区众构事件数据库

---

## 🧪 测试建议

### 测试规则触发
```javascript
// 在浏览器控制台测试
const mockEnvData = {
    astronomy: {
        now: new Date('2026-03-21 06:00'),
        times: { /* ... */ },
        moonPhase: 0.95,  // 接近满月
        isNight: true
    },
    climate: { season: 'spring' },
    weather: {
        condition: 'Clear',
        clouds: 20,
        visibility: 20000,
        temp: -10,
        humidity: 30,
        isRaining: false,
        wind: 2.5
    },
    terrain: { /* ... */ },
    geomagnetism: { kpIndex: 6, isActive: true },
    coordinates: { lat: 65, lon: 15 }
};

// 模拟规则匹配
decisiveMomentRules
    .filter(rule => {
        // 运行规则匹配逻辑
    })
    .forEach(rule => console.log(`✓ 触发: ${rule.id}`));
```

---

## 📊 性能考虑

- 规则数量从 4 增加到 100+
- 每个规则匹配的时间复杂度：O(1) ~ O(n) 取决于条件数量
- 建议使用条件缓存或规则索引以优化性能
- 考虑在生产环境中分层启用规则（按区域/季节）

---

## 📞 获取帮助

如有问题，查看：
1. `DECISIVEMOMENTS_DATATYPE.md` - 数据类型参考
2. `2.0-README.md` - 功能文档
3. GitHub Issues - 社区讨论

---

**最后更新**：2026 年 3 月 27 日  
**文档版本**：v2.0  
**规则总数**：100+
