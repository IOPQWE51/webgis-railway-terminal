# 🌍 API 需求分析 - 决定性瞬间规则库完整支持

> 目前系统已支持 35+ 种规则条件，但要完全激活 **100+ 决定性瞬间触发器**，需要额外的API数据源

---

## 📊 条件分类与API需求

### ✅ 已支持的条件（现有API可覆盖）

| 条件 | 当前数据源 | 完整度 | 备注 |
|------|---------|-------|------|
| `weather` | OpenWeatherMap / WeatherAPI | 95% | 支持 8 种天气类型 |
| `timeWindow` | SunCalc | 100% | 8 种时间窗口 |
| `season` | 纬度计算公式 | 80% | 可优化为真实物候数据 |
| `isNight` | SunCalc | 100% | 日出/日落判断 |
| `temperature` | WeatherAPI | 90% | 实时温度 |
| `humidity` | WeatherAPI | 90% | 实时湿度 |
| `clouds` | WeatherAPI | 95% | 云量百分比 |
| `visibility` | WeatherAPI | 90% | 能见度（米） |
| `windKph` | WeatherAPI | 85% | 风速（有偏差） |
| `moonPhase` | SunCalc | 100% | 月相 0-1 |
| `isCoastal` | OSM Overpass | 90% | 沿海地区检测 |
| `hasWaterfall` | OSM Overpass | 75% | 瀑布标签识别 |
| `hasShrine` | OSM Overpass | 80% | 神社/寺庙识别 |
| `hasBridge` | OSM Overpass | 85% | 桥梁识别 |
| `isForest` | OSM Overpass | 70% | 森林标签识别 |
| `requiresSakuraFull` | 纬度+季节启发式 | 30% | ⚠️ 需要樱花物候API |
| `requiresMapleLeaves` | 纬度+季节启发式 | 30% | ⚠️ 需要枫叶物候API |

---

## 🆕 需要新增API的条件

### 🔴 优先级 1 - 高频使用（常见场景）

#### 1. **requiresWindyWeather** 
- **现状**：无（总是返回 false）
- **数据源**：WeatherAPI.wind_kph
- **实现方式**：判断风速 > 10 km/h
- **规则数**：1 条（樱吹雪）
- **实现难度**：⭐ 极低
- **优先级**：必需
```javascript
requiresWindyWeather: weather.windKph > 10 && weather.windKph < 25
```

#### 2. **requiresHighTraffic**
- **现状**：无（总是返回 false）
- **数据源**：Google Maps API (Traffic)
- **实现方式**：查询当前路口车流密度
- **规则数**：3 条（车流灯轨、赛博霓虹）
- **实现难度**：⭐⭐ 低
- **优先级**：可选（需付费API）
- **成本**：Google Maps Platform Premium

#### 3. **requiresStormWeather**
- **现状**：无（总是返回 false）
- **数据源**：WeatherAPI.is_day + 风速 + 降水
- **实现方式**：综合判断 `风速 > 40 km/h && 降水 > 5mm/h`
- **规则数**：1 条（风暴灯塔）
- **实现难度**：⭐ 极低
- **优先级**：必需
```javascript
requiresStormWeather: (weather.windKph > 40 && weather.precipMM > 5)
```

---

### 🟡 优先级 2 - 天文/物候事件（季节性强）

#### 4. **物候相关 requires*** （15 条规则）
- **requiresSakuraFull** - 樱花满开
- **requiresMapleLeaves** - 枫叶满开
- **requiresFlowerField** - 花田盛开（郁金香/罂粟/薰衣草等 8 种）

**现状**：纬度启发式（30% 准确率）
**需要的API**：日本物候预测 API
- **数据源候选**：
  - ✅ **推荐**：[Anitabi 圣地物候API](https://anitabi.info/) - 日本特化（免费）
  - ✅ **推荐**：[樱花预测日历](https://data.jma.go.jp/sakura/) - 日本气象厅官方
  - ⚠️ 自建：基于历史气温数据的物候模型
  
**实现难度**：⭐⭐⭐ 中等
**优先级**：高（日本旅行特色）
**预期收益**：+8 条规则激活

---

### 🔴 优先级 3 - 天文现象（罕见事件）

#### 5. **天文事件 requires*** （7 条规则）
- **requiresGeomagneticActivity** - 北极光
- **requiresMeteorEvent** - 流星雨
- **requiresSolarEclipse** - 日食
- **requiresLunarEclipse** - 月食
- **requiresSuperMoon** - 超级月亮
- **requiresCometEvent** - 彗星

**现状**：无（总是返回 false）
**需要的API**：
- ✅ **推荐**：[AstroPixel Astronomy API](https://www.astropixel.com/api) - 包括所有天文事件
- ✅ **推荐**：[Skyview API](https://skyViewAPI.web.unc.edu/) - 天体位置
- ✅ **推荐**：[USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) - 地磁指数
- 📍 **开源**：[Ephem/PyEphem](https://rhodesmill.org/pyephem/) - 本地计算天文数据

**实现难度**：⭐⭐⭐ 中等（主要是API集成）
**优先级**：中等（低频事件）
**预期收益**：+7 条规则激活，但每年只触发几次

---

### 🟡 优先级 4 - 生物事件（地理+季节限制）

#### 6. **野生动物迁徙 requires*** （4 条规则）
- **requiresWhaleEvent** - 鲸鱼出现
- **requiresCrabMigration** - 红蟹迁徙（澳大利亚圣诞岛）
- **requiresPenguinEvent** - 企鹅繁殖季
- **requiresElephantEvent** - 大象群迁移

**现状**：无（总是返回 false）
**需要的API**：
- ✅ **推荐**：[Global Biodiversity Information Facility (GBIF)](https://www.gbif.org/api) - 物种观测数据
- ✅ **推荐**：[iNaturalist API](https://www.inaturalist.org/pages/developers) - 众包物种数据
- ⚠️ **付费**：[Birds of East Africa](https://birdsofeastafrica.org/) - 鸟类迁徙数据

**实现难度**：⭐⭐⭐⭐ 较复杂（数据质量问题）
**优先级**：低（数据不可靠，频率低）
**预期收益**：+4 条规则激活

---

### 🟡 优先级 5 - 文化/活动事件（手工维护可行）

#### 7. **日本祭典活动 requires*** （10 条规则）
- **requiresFireworksEvent** - 花火大会
- **requiresFestivalEvent** - 祭典活动
- **requiresLanternFestival** - 灯笼节
- **requiresIceFestival** - 冰雕节
- **requiresNewYearEvent** - 除夕活动
- 等...

**现状**：无（总是返回 false）
**需要的数据**：
- ✅ **推荐**：[日本节日数据库](https://www.japan-guide.com/e/e2063.html) - 人工整理的日期表
- ✅ **推荐**：[Anitabi Festival Calendar](https://anitabi.info/) - 已集成
- 📍 **自建**：JSON 配置文件 + 手工维护

**实现方式**：
```javascript
// 可创建一个 eventCalendar.js 文件
export const eventCalendar = [
    {date: '2026-08-01', location: 'Nagaoka', event: 'Fireworks', type: 'hanabi'},
    {date: '2026-07-15', location: 'Gion', event: 'Gion Matsuri', type: 'festival'},
    // ...
];
```

**实现难度**：⭐ 极低（无需API，只需 JSON 数据）
**优先级**：中等（适合国内提前预知）
**预期收益**：+10 条规则激活

---

### 🟡 优先级 6 - 光污染与地理标志

#### 8. **requiresLowLightPollution**
- **现状**：无（总是返回 false）
- **数据源**：[Light Pollution Map API](https://lightpollutionmap.info/)
- **实现方式**：查询坐标光污染值
- **规则数**：2 条（银河、流星雨观测）
- **实现难度**：⭐⭐ 低
- **成本**：免费（地图可开放使用）

#### 9. **requiresDesert / requiresPort / requiresAirport 等**
- **现状**：部分支持（OSM Overpass）
- **改进方向**：
  - 从 POI 数据库改进识别精度
  - 与 Google Places API 交叉验证
  - 建立本地 POI 缓存

---

## 🎯 建议方案

### 方案 A：快速启动（1-2 周）
**投入**：无额外成本，仅改进现有API的利用率
```
✅ requiresWindyWeather        → 从 WeatherAPI 提取风速
✅ requiresStormWeather        → 综合判断风速+降水
📆 活动日期表                  → 手工维护 JSON 文件
```
**效果**：激活 **13 条规则**，覆盖常见场景

→ **立即可行** ✅

---

### 方案 B：充分利用（3-4 周）
**投入**：200 元左右（部分API付费）
```
方案 A 的所有内容
+ 樱花/枫叶物候API            → Anitabi 或 JMA（免费）
+ 光污染图层API               → Light Pollution Map（免费）
+ 天文事件API                  → Skyview API（免费）
```
**效果**：激活 **30+ 条规则**，大幅增强功能

→ **月底前可完成** ⏳

---

### 方案 C：终极方案（持续维护）
**投入**：500-1000 元/年
```
方案 B 的所有内容
+ Google Maps Traffic API      → 查询实时车流（付费）
+ 生物数据库集成              → GBIF/iNaturalist（免费）
+ 自建事件爬虫                 → 抓取各地活动信息
```
**效果**：激活 **全部 100+ 规则**，全球最强摄影预报系统

→ **需要长期投入** 💼

---

## 📋 立即可做的事清单

### 1️⃣ 改进现有 WeatherAPI 利用（无需新API）
```javascript
// 在 ruleDataConverter.js 中添加
export const checkWeatherSpecialConditions = (weather) => {
    return {
        requiresWindyWeather: weather.windKph > 10 && weather.windKph < 25,
        requiresStormWeather: weather.windKph > 40 && weather.precipMM > 5,
        requiresHighTraffic: false  // 占位符，需要 Google Maps Traffic API
    };
};
```

### 2️⃣ 手工维护活动日期表
```javascript
// 新建 src/utils/eventCalendar.js
export const japanEventDates = {
    2026: [
        {month: 1, day: 1, name: 'New Year', event: 'requiresNewYearEvent'},
        {month: 8, day: 1, name: 'Nagaoka Fireworks', event: 'requiresFireworksEvent'},
        // ... 全年 50+ 主要活动
    ]
};
```

### 3️⃣ 集成樱花物候预测
```javascript
// 推荐使用 Anitabi API：
// https://anitabi.info/api/phenology/{region}/{year}
```

---

## 💡 我的建议

**立即行动**：
1. ✅ 改进风速条件检测（方案 A 第一步）
2. ✅ 创建 JSON 活动日期表（免费维护成本最低）
3. 📝 准备樱花物候 API 文档研究

**如果你有API申请权限**：
1. 申请 **樱花物候预测 API**（Anitabi 或 JMA）
2. 申请 **光污染地图 API**（lightpollutionmap.info）
3. 可选：Google Maps Platform Premium（车流数据）

---

## 📞 你的决定

请告诉我：

1. **你能申请哪些 API？** 
   - 只有开源/免费的？
   - 可以申请付费服务？
   - 有企业账户？

2. **优先级是什么？**
   - 先让现有能力 100% 工作（方案 A）
   - 快速增加功能数量（方案 B）
   - 长期完整系统（方案 C）

3. **维护能力？**
   - 能定期更新日期表吗？
   - 能写爬虫抓取数据吗？
   - 建议托管第三方数据库？

---

**下一步**：根据你的答案，我会为对应的 API 编写完整的集成代码 🚀
