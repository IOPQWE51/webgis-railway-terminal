# Mapbox POI 点击面板问题

**状态**: ❌ 暂时无法解决
**日期**: 2025-04-09
**优先级**: 中

---

## 问题描述

在 Dark 2D 战术地图中，点击 Mapbox 自带的交通站点黄点（POI）时，无法正确获取站点信息并显示在右侧面板中。

---

## 当前行为

1. **点击黄点后**：
   - 拉取的不是对应站点的信息
   - 多点两次甚至不显示面板
   - 控制台只显示普通地图点击日志

2. **移动端问题**：
   - `hasDispatchedMobileRef` 阻止重复发射
   - 已修复：每次 `stationData` 变化时重置标志

---

## 已尝试的方案

### 方案 1: `queryRenderedFeatures` 查询所有图层

```javascript
const poiFeatures = map.current.queryRenderedFeatures(e.point, {
  layers: [] // 空数组 = 查询所有图层
});
```

**问题**: 无法区分点击的是哪个图层，获取的数据不是站点信息。

### 方案 2: 过滤站点相关图层

```javascript
const stationFeature = poiFeatures.find(f => {
  const layerId = f.layer?.id || '';
  const props = f.properties || {};
  return layerId.includes('station') ||
         layerId.includes('poi') ||
         // ...
});
```

**问题**: Mapbox 自定义样式的图层命名不确定，无法准确匹配。

---

## 根本原因

1. **自定义样式结构未知** - `mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z` 是自定义样式，图层数据结构未知
2. **POI 数据字段不确定** - 不知道站点信息存储在哪些字段中
3. **图层叠加关系复杂** - 多个图层可能重叠，无法确定点击的是哪一层

---

## 需要调试信息

点击黄点后，控制台需要输出：

```
🔍 点击位置检测到要素数量: X
📋 要素列表: [
  { layer: "xxx", type: "symbol", properties: {...} },
  { layer: "yyy", type: "circle", properties: {...} },
  ...
]
```

通过分析这些数据，才能确定：
1. 黄点属于哪个图层
2. 站点名称存储在哪个字段
3. 如何正确提取数据

---

## 可能的解决方案（待验证）

### 方案 A: 在 Mapbox Studio 中检查图层

1. 登录 Mapbox Studio
2. 打开自定义样式 `cmnoq0jyc008501sg88f6en5z`
3. 查看交通站点图层的：
   - 图层 ID
   - 数据源
   - 字段结构

### 方案 B: 使用 Mapbox Geocoding API

点击位置后，使用逆地理编码获取最近的 POI：

```javascript
const response = await fetch(
  `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi`
);
```

### 方案 C: 禁用 Mapbox POI，使用自定义数据

1. 在 Mapbox Studio 中关闭交通站点图层
2. 通过 DataCenter 导入自己的站点数据
3. 完全控制数据结构

---

## 当前状态

- ✅ 移动端重复发射问题已修复
- ⏳ 等待用户点击黄点后提供调试日志
- ⏳ 需要确定 Mapbox 自定义样式的图层结构

---

## 下一步

1. 用户刷新页面，点击黄点
2. 提供控制台输出的要素列表数据
3. 根据数据结构调整代码
