# 换乘与热门站点 API 待处理清单

> **用途**: Dark 2D 战术地图点击站点时显示可换乘线路和热门目的地

## 数据需求

点击站点时需要获取：
1. **换乘线路** - 该站可换乘的所有线路
2. **热门目的地** - 从该站可直达/换乘的热门站点

---

## 按地区划分的 API 方案

### 🇯🇵 日本

| 项目 | 状态 |
|------|------|
| **API** | Yahoo 乘换案内 (Transit API) |
| **文档** | https://transit.yahoo.co.jp/ |
| **是否需要Key** | 是 |
| **数据格式** | JSON |
| **接入状态** | ⚠️ 待接入 |

**备注**:
- 项目中已有 Yahoo 乘换入口（`photoEngine.js` 中）
- 需要构建 API 请求解析换乘数据

---

### 🇨🇳 中国

| 项目 | 状态 |
|------|------|
| **API 选项 1** | 高德地图 - 站点查询 & 路线规划 |
| **API 选项 2** | 百度地图 - 站点详情 |
| **文档** | https://lbs.amap.com/ / https://lbsyun.baidu.com/ |
| **是否需要Key** | 是 |
| **接入状态** | ⚠️ 待接入 |

---

### 🇪🇺 欧洲

| 项目 | 状态 |
|------|------|
| **API 选项 1** | Google Places API - Transit Station |
| **API 选项 2** | Citymapper API |
| **文档** | https://developers.google.com/maps / https://developer.citymapper.com/ |
| **是否需要Key** | 是 |
| **接入状态** | ⚠️ 待接入 |

---

### 🇺🇸 美国

| 项目 | 状态 |
|------|------|
| **API 选项 1** | Google Places API |
| **API 选项 2** | Transitland API (开源) |
| **文档** | https://transit.land/ |
| **是否需要Key** | 是 (Transitland 可选) |
| **接入状态** | ⚠️ 待接入 |

---

## 自建数据库方案（备选）

如果第三方 API 不可用，可考虑：

| 数据源 | 说明 | 获取方式 |
|--------|------|----------|
| **OpenStreetMap** | 开源地图数据，包含公交线路关系 | Overpass API |
| **GTFS 数据** | 各公共交通机构发布的标准格式数据 | GTFS Data Exchange |
| **Wikidata** | 结构化站点数据 | SPARQL 查询 |

---

## 当前实现状态

```
✅ 地区检测架构 (regionDetector.js) - 已规划
⚠️ HUD UI 组件 (DarkTacticalHUD.jsx) - 待创建
❌ API 适配层 - 待实现
❌ 数据缓存策略 - 待设计
```

---

## 后续任务

1. [ ] 实现地区检测逻辑
2. [ ] 为日本地区接入 Yahoo 乘换 API
3. [ ] 设计数据缓存策略（减少 API 调用）
4. [ ] 添加 API 错误处理和降级方案
