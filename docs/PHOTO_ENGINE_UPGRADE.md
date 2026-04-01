# 🎬 摄影判定条件优化 - v4.2.1+ 升级

## 📝 修改日期
2026-03-31

## 🎯 优化目标
让摄影判定更智能、更精准，无需手动维护数据

---

## ✅ 已完成的优化

### 1. 🌬️ requiresWindyWeather - 微风判断
**文件**: `src/utils/ruleDataConverter.js`
**修改位置**: `checkRequiredConditions` 函数

**改动前**:
```javascript
requiresWindyWeather: false, // 永远不触发
```

**改动后**:
```javascript
const windKph = gatewayData.weather?.windKph || 0;
const requiresWindyWeather = windKph > 10; // > 10 km/h 触发
```

**影响的摄影规则**:
- `sakura_blossom_rain` 🌸 樱吹雪（樱花满开 + 微风）
- 其他需要微风条件的规则

---

### 2. 🌸 requiresSakuraFull - 樱花满开精准判定
**文件**: `src/utils/ruleDataConverter.js`

**改动前**:
```javascript
requiresSakuraFull: season === 'spring' && isJapanRegion // 只看季节
```

**改动后**:
```javascript
const sakuraBloomStage = gatewayData.ecology?.sakura?.bloom_stage || 0;
const requiresSakuraFull = season === 'spring' && isJapanRegion && sakuraBloomStage >= 70;
```

**说明**: 结合 phenology API 的实际盛开度数据（0-100%），只在 70% 以上时触发

**影响的摄影规则**:
- `sakura_blossom_rain` 🌸 樱吹雪
- `sakura_rain` 🌸 雨打樱花
- `sakura_golden` 🌸 樱花金粉
- `sakura_blue` 🌸 夜樱蓝调
- `sakura_night_illumination` 🌸 夜樱灯光
- `cherry_blossom_river` 🌸 花瓣河面
- `train_sakura` 🚂 列车樱花隧道

---

### 3. 🍁 requiresMapleLeaves - 枫叶变红精准判定
**文件**: `src/utils/ruleDataConverter.js`

**改动前**:
```javascript
requiresMapleLeaves: season === 'autumn' && isJapanRegion // 只看季节
```

**改动后**:
```javascript
const mapleLeafStage = gatewayData.ecology?.maple?.leaf_change_stage || 0;
const requiresMapleLeaves = season === 'autumn' && isJapanRegion && mapleLeafStage >= 50;
```

**说明**: 结合 phenology API 的变红度数据（0-100%），只在 50% 以上时触发

**影响的摄影规则**:
- `autumn_leaves_fog` 🍁 雾中红叶
- `autumn_leaves_golden` 🍁 枫叶金光
- `autumn_leaves_illumination` 🍁 夜枫灯光
- `maple_tunnel` 🍁 枫叶隧道

---

### 4. 🌠 天文事件自动计算器
**新增文件**: `src/utils/astronomyCalculator.js`

**功能**:
- ✅ **流星雨自动判定** - 每年固定日期，无需维护
- ✅ **超级月亮计算** - 基于月地距离算法
- ✅ **完整的9大流星雨数据**:
  - 象限仪座 (1月3日, ZHR=120)
  - 天琴座 (4月22日, ZHR=20)
  - η宝瓶座 (5月6日, ZHR=50)
  - 英仙座 (8月12日, ZHR=150) ⭐ 最著名
  - 天龙座 (10月8日, ZHR=10)
  - 猎户座 (10月21日, ZHR=20)
  - 狮子座 (11月17日, ZHR=15)
  - 双子座 (12月14日, ZHR=120) ⭐ 最稳定
  - 小熊座 (12月22日, ZHR=10)

**超级月亮算法**:
```javascript
const moonIllum = SunCalc.getMoonIllumination(date);
const moonPhase = moonIllum.fraction; // 月相 0-1
const moonDistance = moonIllum.distance; // 月地距离 km

// 超级月亮：满月 + 近地点 (< 357,000 km)
return moonPhase > 0.95 && moonDistance < 357000;
```

**影响的摄影规则**:
- `meteor_shower` 💫 流星划空
- `super_moon` 🌕 超级月亮（多个规则）

---

## 📊 数据流图

```
┌─────────────────────────────────────────────────────────────┐
│                    dataGateway.js                           │
│  • 调用 phenology API (樱花/枫叶盛开度)                      │
│  • 调用 weather API (风速数据)                               │
│  • 调用 aurora API (极光数据)                               │
└────────────────────┬────────────────────────────────────────┘
                     │ gatewayData
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          ruleDataConverter.js (已升级)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ checkRequiredConditions():                           │  │
│  │  ✅ 风速 > 10km/h → requiresWindyWeather             │  │
│  │  ✅ 樱花盛开度 >= 70% → requiresSakuraFull           │  │
│  │  ✅ 枫叶变红度 >= 50% → requiresMapleLeaves          │  │
│  │  ✅ 调用 astronomyCalculator → 天文事件              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ ruleData
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                ruleMatcher.js                               │
│  • 将 ruleData 与 100+ 摄影规则匹配                          │
│  • 触发相应的"决定性瞬间"预警                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 测试方法

### 测试1: 微风判断
```javascript
// 在樱花季 (4月) + 日本地区
// 当风速 > 10km/h 时，应该触发 "樱吹雪" 规则
const testWindSpeed = 15; // kph
// 预期: requiresWindyWeather = true
```

### 测试2: 樱花盛开度
```javascript
// 当 phenology API 返回 bloom_stage = 85 时
// 应该触发所有樱花相关规则
const testBloomStage = 85;
// 预期: requiresSakuraFull = true
```

### 测试3: 流星雨判定
```javascript
// 在 8月12日 ± 7天范围内
const date = new Date(2026, 7, 12); // 英仙座流星雨峰值
const result = checkAstronomyEvents(date);
// 预期: requiresMeteorEvent = true, meteorShowerName = '英仙座流星雨'
```

### 测试4: 超级月亮
```javascript
// 计算某个满月日期
const date = new Date(2026, 9, 18); // 10月18日
const isSuper = calculateSuperMoon(date);
// 如果是近地点满月: true
```

---

## 🎯 性能优化

1. **零外部依赖** - 所有计算基于 SunCalc（已集成）
2. **无网络请求** - 天文事件本地计算，无需API调用
3. **缓存友好** - phenology 数据已缓存 7 天
4. **O(1) 时间复杂度** - 所有条件判断都是即时计算

---

## 📈 未来可扩展项

### 暂未实现（可选）：
1. **日月食精确日期** - 可接入 NASA Eclipse API
2. **光污染地图** - 可接入 Light Pollution Map API
3. **彗星出现** - 非常罕见，可用天文API

### 已明确不实现：
- ❌ 花火大会精确日期 - 用户已有外链方案
- ❌ 动物迁徙事件 - 需要专用API，ROI低

---

## ✅ 验证清单

- [x] requiresWindyWeather 使用实际风速数据
- [x] requiresSakuraFull 结合盛开度数据
- [x] requiresMapleLeaves 结合变红度数据
- [x] 天文事件自动计算器（9大流星雨）
- [x] 超级月亮算法（月地距离）
- [x] 调试函数包含所有新字段
- [x] 无需手动维护任何数据

---

## 📝 相关文件清单

### 新增文件:
- `src/utils/astronomyCalculator.js` (220 行)

### 修改文件:
- `src/utils/ruleDataConverter.js` (3 处修改)

### 无需修改:
- `src/utils/ruleMatcher.js` (无需改动)
- `src/utils/decisiveMoments.js` (无需改动)
- `src/utils/dataGateway.js` (无需改动)

---

## 🚀 部署说明

1. **无需额外配置** - 所有改动都是代码层面
2. **向后兼容** - 不影响现有功能
3. **立即可用** - 部署后立即生效

---

**维护者**: IOPQWE51
**版本**: v4.2.1+
**最后更新**: 2026-03-31
