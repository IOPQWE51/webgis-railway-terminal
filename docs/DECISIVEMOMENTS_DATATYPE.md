# decisiveMoments.js 数据类型参考

## 📊 数据流向图

```
dataGateway.fetchGlobalEnvironmentData()
    ↓
[ 原始数据 ]
├─ SunCalc.getTimes(date, lat, lon)
├─ SunCalc.getMoonIllumination(date)
├─ WeatherAPI / Vercel Backend
├─ OSM Overpass API
└─ 地理季节算法

    ↓ [数据融合与转换]

photoEngine.js 中的条件匹配
    ↓
decisiveMomentRules[] 规则库
```

---

## 🎯 提供给 decisiveMoments.js 的核心数据对象

### 1️⃣ **envData 对象** (来自 dataGateway.fetchGlobalEnvironmentData)

```javascript
{
  astronomy: {
    now: Date,                          // 当前时刻
    times: {
      sunrise: Date,                    // 日出时刻
      sunset: Date,                     // 日落时刻
      goldenHour: Date,                 // 黄金时刻开始
      goldenHourEnd: Date,              // 黄金时刻结束
      dusk: Date,                       // 暮色
      dawn: Date,                       // 晨曦
      nightStarting: Date,              // 完全黑暗时刻
      // ... SunCalc 的其他时刻定义
    },
    moonPhase: Number,                  // 0~1 (新月→满月→新月)
    isNight: Boolean                    // 是否为夜间
  },
  
  climate: {
    season: String                      // 'spring' | 'summer' | 'autumn' | 'winter' | 'wet' | 'dry'
  },
  
  weather: {
    condition: String,                  // "Rainy", "Sunny", "Cloudy", "Snowy", "Foggy" 等
    clouds: Number,                     // 0~100 云量百分比
    visibility: Number,                 // 可见度(米)，如 10000 = 10km
    temp: Number,                       // 温度 (°C)
    humidity: Number,                   // 0~100 湿度百分比
    isRaining: Boolean                  // 是否下雨
  },
  
  terrain: {
    rawTags: String[],                  // 原始地形标签数组
    isCoastal: Boolean,                 // 是否为海岸地点
    isForest: Boolean,                  // 是否为森林地点
    hasWaterfall: Boolean,              // 是否有瀑布
    hasShrine: Boolean,                 // 是否有神社/寺庙
    hasBridge: Boolean,                 // 是否有桥梁
    hasStation: Boolean                 // 是否有车站
  }
}
```

### 2️⃣ **category** 参数 (从标记点传入)

```javascript
category: String  // 'station' | 'airport' | 'anime' | 'hotel' | 'spot' | 其他自定义类别
```

---

## 📋 decisiveMomentRules 中可用的条件字段

### ✅ 当前已实现的条件

| 条件字段 | 数据类型 | 示例 | 来源 |
|---------|--------|------|------|
| `weather` | String[] | `['Rain', 'Snow']` | envData.weather.condition |
| `category` | String[] | `['anime', 'spot']` | category 参数 |
| `timeWindow` | [String, String] | `['golden Hour', 'sunset']` | envData.astronomy.times 的键 |
| `minHumidity` | Number | `85` | envData.weather.humidity |
| `maxVisibility` | Number | `5000` | envData.weather.visibility |
| `minClouds` | Number | `30` | envData.weather.clouds |
| `maxClouds` | Number | `70` | envData.weather.clouds |

### ⭐ 已支持但较少使用的条件

| 条件字段 | 数据类型 | 说明 |
|---------|--------|------|
| `tempMax` | Number | 最高温度限制 |
| `moonPhaseMin` | Number | 最小月相(0~1) |
| `hasWaterfall` | Boolean | 需要瀑布 |
| `hasShrine` | Boolean | 需要神社/寺庙 |
| `hasBridge` | Boolean | 需要桥梁 |
| `hasStation` | Boolean | 需要车站 |

---

## 🔍 条件匹配逻辑详解

### 当前的规则匹配代码 (photoEngine.js)

```javascript
for (const rule of decisiveMomentRules) {
    const c = rule.conditions;
    let isMatch = true;
    
    // ✅ 天气字段匹配：condition 包含任意一个指定词汇
    if (c.weather && !c.weather.some(w => 
        condition.toLowerCase().includes(w.toLowerCase())
    )) isMatch = false;
    
    // ✅ 分类匹配：category 必须在白名单中
    if (c.category && !c.category.includes(category)) 
        isMatch = false;
    
    // ✅ 时间窗口匹配：now 必须在 [times[startKey], times[endKey]] 范围内
    if (c.timeWindow) {
        const [startKey, endKey] = c.timeWindow;
        if (now < times[startKey] || now > times[endKey]) 
            isMatch = false;
    }
    
    // ✅ 温度/月相范围匹配
    if (c.tempMax !== undefined && temp !== undefined && temp > c.tempMax) 
        isMatch = false;
    if (c.moonPhaseMin !== undefined && moonPhase < c.moonPhaseMin) 
        isMatch = false;
    
    // ✅ 地形专属匹配：布尔值必须为 true
    if (c.hasWaterfall && !envData.terrain.hasWaterfall) isMatch = false;
    if (c.hasShrine && !envData.terrain.hasShrine) isMatch = false;
    if (c.hasBridge && !envData.terrain.hasBridge) isMatch = false;
    if (c.hasStation && !envData.terrain.hasStation) isMatch = false;
    
    if (isMatch) { decisiveMoment = rule.output; break; }
}
```

---

## 📚 可扩展添加的新条件字段

### 已预留但未实现的字段

基于 envData 的完整结构，以下字段**理论上可以添加**到 conditions 中：

```javascript
// 季节过滤
minSeason: String              // 'spring' | 'summer' 等
 
// 湿度过滤
minHumidity: Number            // 最小湿度
maxHumidity: Number            // 最大湿度

// 能见度过滤
minVisibility: Number          // 最小能见度(米)
maxVisibility: Number          // 最大能见度(米) ✓ 已用

// 温度过滤
minTemp: Number                // 最低温度
maxTemp: Number                // 最高温度 ✓ 已用

// 月相过滤
minMoonPhase: Number           // 最小月相 (0~1) ✓ 已用
maxMoonPhase: Number           // 最大月相 (0~1)

// 时间周期过滤
requiresNight: Boolean         // 必须为夜间
requiresDay: Boolean           // 必须为白天

// 地形综合过滤
requiresCoastal: Boolean       // 必须为海岸
requiresForest: Boolean        // 必须为森林
```

---

## 💡 实战示例：如何添加新规则

### 示例 1：山顶日出规则
```javascript
{
    id: "mountain_sunrise",
    conditions: {
        weatherAny: ['Clear', 'Sunny'],      // 晴天
        timeWindow: ['dawn', 'sunrise'],     // 日出前后
        hasStation: true,                    // 靠近车站的山区
        minElevation: 500                    // 需要新增：最小海拔
    },
    output: "🏔️ 山顶日出触发：登顶等待太阳升起，极端广角大片诞生！"
}
```

### 示例 2：夜行火车规则
```javascript
{
    id: "night_train_station",
    conditions: {
        category: ['station'],               // 车站
        requiresNight: true,                 // 必须夜间
        hasStation: true,
        minMoonPhase: 0.3,                   // 至少有月光
        maxMoonPhase: 0.8
    },
    output: "🌙 夜行列车触发：月下车站，寂寥列车咆哮而过，赛博风原声视频素材！"
}
```

### 示例 3：雾中古刹规则
```javascript
{
    id: "temple_fog",
    conditions: {
        hasShrine: true,                     // 神社/寺庙
        minHumidity: 90,                     // 极高湿度
        maxVisibility: 3000,                 // 能见度很低
        timeWindow: ['dawn', 'goldenHourEnd'] // 清晨~上午
    },
    output: "⛩️ 雾中古刹触发：湿度爆表叠加早晨，完美日本侘寂摄影时刻！"
}
```

---

## 🎯 SunCalc 时间点详解

来自 `SunCalc.getTimes()` 的所有可用时间点：

| 时间点 | 说明 | 典型用途 |
|-------|------|--------|
| `sunrise` | 日出 | 清晨摄影 |
| `sunset` | 日落 | 傍晚摄影 |
| `sunriseEnd` | 日出完成 | 晨曦结束 |
| `sunsetStart` | 日落开始 | 傍晚开始 |
| `dawn` | 晨曦开始 | 完全天黑→有光 |
| `dusk` | 暮色 | 有光→完全天黑 |
| `goldenHour` | 黄金时刻 | 柔和侧光 |
| `goldenHourEnd` | 黄金时刻结束 | 光线变硬 |
| `nightStarting` | 夜间开始 | 完全黑暗 |
| `nadir` | 午夜(太阳最低) | 午夜参考点 |
| `solarNoon` | 正午 | 硬光 |

---

## 📝 如何扩展 decisiveMoments.js

### 步骤 1：确认数据可用性

在 `photoEngine.js` 中检查 `envData` 对象是否包含所需字段：

```javascript
// 在 initPhotoEvalEngine 中添加调试
console.log('可用的 envData 字段:', {
  astronomy: { ...envData.astronomy },
  climate: { ...envData.climate },
  weather: { ...envData.weather },
  terrain: { ...envData.terrain }
});
```

### 步骤 2：在 photoEngine.js 中补充条件匹配逻辑

```javascript
// 补充新的条件类型到规则匹配循环中
if (c.myNewCondition !== undefined && /* 对比 envData 的相应字段 */) {
    isMatch = false;
}
```

### 步骤 3：在 decisiveMoments.js 中添加新规则

```javascript
{
    id: "my_custom_moment",
    conditions: {
        // 指定所有条件
    },
    output: "📍 我的自定义触发文本"
}
```

---

## ✅ 快速参考表：现有规则所用数据

| 规则 | 使用字段 | 数据来源 |
|------|--------|--------|
| cyberpunk_rain | weather.condition, category | envData.weather, 参数 |
| snow_anime | weather.condition, category | envData.weather, 参数 |
| morning_fog | weather.humidity, weather.visibility, astronomy.times | envData.weather/times |
| burning_clouds | weather.clouds, astronomy.times | envData.weather, envData.times |

---

**最后更新**：2026 年 3 月 27 日  
**文档版本**：v1.0
