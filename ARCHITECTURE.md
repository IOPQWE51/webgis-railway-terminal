# Earth Terminal 代码架构文档

**版本:** v1.0.0 (基于 commit 176998c)
**项目:** railway-map-terminal
**构建工具:** Vite
**框架:** React 19.2.0
**地图库:** Leaflet + Mapbox GL

---

## 目录结构

```
src/
├── pages/           # 页面组件
├── components/      # UI 组件
├── hooks/           # React Hooks
├── utils/           # 工具函数
├── config/          # 配置文件
├── App.jsx          # 应用入口
└── main.jsx         # React 挂载点
```

---

## 核心模块

### 1. 应用入口 (`App.jsx`)

**职责:**
- 主应用状态管理
- 标签导航控制
- 全局通信桥接
- 战术模式切换

**核心状态:**
```javascript
- activeTab: 当前激活标签 ('map' | 'data' | 'rules' | 'tools' | 'sub-culture' | 'aviation')
- customPoints: 自定义点位数据
- isTacticalMode: 战术地图模式开关
- pendingMapTarget: 待定位的地点
```

**全局通信:**
- `window.__locatePointOnMap(pointId)`: 定位到指定点位

---

### 2. 主地图引擎 (`MapEngine.jsx`)

**职责:**
- Leaflet 地图容器管理
- 聚合标记渲染
- 测距工具集成
- 移动端控制面板抽屉

**核心依赖:**
- `useMapTools`: 地图工具 Hook
- `useMapLayers`: 图层管理 Hook

**UI 结构:**
```
┌─────────────────────────────────────┐
│  地图容器 (Leaflet)                  │
│  ├── 测距模式 HUD (顶部胶囊)         │
│  ├── 呼出战术中枢按钮 (移动端)       │
│  └── cyber-panel 右侧浮窗            │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  控制面板 (桌面端右侧)               │
│  └── 空间跃迁引擎                    │
└─────────────────────────────────────┘
```

---

### 3. 图层管理 Hook (`useMapLayers.js`)

**职责:**
- 基础站点渲染 (铁路骨架线)
- 自定义标记聚合显示
- 地图点击事件处理
- `openCyberPanel` 调用

**核心函数:**
```javascript
// 渲染基础站点和骨架线
renderBasePointsAndLines()

// 渲染自定义标记点 (聚合)
renderCustomMarkers()

// 地图点击处理
onMapPick(lat, lng) -> openCyberPanel()
```

**数据流:**
```
点击标记 -> generatePopupContent() -> openCyberPanel() -> 显示右侧浮窗
```

---

### 4. 地图工具 Hook (`useMapTools.js`)

**职责:**
- 空间跃迁搜索 (OSM Nominatim)
- 测距工具状态管理
- 用户定位功能

**搜索流程:**
```
输入关键词 -> Nominatim API -> flyTo() + 添加标记 + openCyberPanel()
```

---

### 5. 摄影引擎 (`photoEngine.js`)

**职责:**
- 生成弹出窗 HTML 内容
- 太阳时间计算 (SunCalc)
- 黄金时刻 / 蓝调时刻计算

**核心函数:**
```javascript
generatePopupContent(pointData, id, icon, name, desc) -> HTML
```

**输出内容:**
- 地点名称 + 描述
- 绝对太阳时间 (日出/日落)
- 黄金时刻时段
- 蓝调时刻时段
- 收藏入库按钮
- 全息雷达扫描按钮
- Google/Yahoo 导航链接

---

### 6. 面板控制 (`cyberPanel.js`)

**职责:**
- 控制 `#cyber-panel` 显示/隐藏
- 注入 HTML 内容到 `#cyber-panel-content`

```javascript
openCyberPanel(html)  // 显示面板
closeCyberPanel()     // 隐藏面板
```

---

## 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                         App.jsx                             │
│  • customPoints 状态                                         │
│  • activeTab 状态                                            │
│  • 全局通信桥接                                              │
└──────────────────┬────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐      ┌──────────────┐
│ MapTactical  │      │  MapEngine   │
│ (战术地图)    │      │  (主地图)     │
│              │      │              │
│ Mapbox GL    │      │ Leaflet      │
└──────────────┘      │ MarkerCluster│
                      │ useMapLayers │
                      │ useMapTools  │
                      └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ photoEngine  │
                      │              │
                      │ SunCalc      │
                      │ 天文计算     │
                      └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ cyberPanel   │
                      │              │
                      │ #cyber-panel │
                      │ 右侧浮窗     │
                      └──────────────┘
```

---

## 移动端适配状态

| 功能 | 桌面端 | 移动端 | 说明 |
|------|--------|--------|------|
| 点击地图标记 | ✅ cyberPanel | ⚠️ 未适配 | 显示右侧浮窗，不适合移动端 |
| 空间跃迁搜索 | ✅ cyberPanel + 标记 | ⚠️ 未适配 | 同上 |
| 控制面板 | ✅ 右侧固定 | ✅ 底部抽屉 | 已实现 |
| 战术地图 | ✅ 全屏 | ✅ 全屏 | 已实现 |

---

## 待实现功能

### 移动端地点详情底部抽屉

**需求:**
- 从底部弹出 (35% 高度)
- 支持拖动到全屏 (95% 高度)
- 琥珀金拖动指示器
- 战术视觉风格 (毛玻璃 + 发光边框)

**实现方案:**
```
拦截 openCyberPanel -> 移动端检测 -> TacticalBottomSheet 组件
                        ↓
                   桌面端保持原样
```

**需要修改的文件:**
1. 新建 `TacticalBottomSheet.jsx` - 抽屉组件
2. 修改 `MapEngine.jsx` - 添加拦截逻辑
3. 修改 `photoEngine.js` - 确保 data 属性正确

---

## 文件清单

### 页面组件 (1)
- `MapTactical.jsx` (339行) - 战术地图页面

### UI 组件 (11)
- `MapEngine.jsx` (230行) - 主地图引擎
- `MapboxMapTactical.jsx` (245行) - Mapbox 战术地图
- `ControlPanel.jsx` (120行) - 控制面板
- `DataCenter.jsx` (200行) - 数据中心
- `SearchNavEngine.jsx` (62行) - 空间跃迁引擎
- `AviationEngine.jsx` - 航线雷达
- `PilgrimageRadar.jsx` - 巡礼雷达
- `HanabiRadar.jsx` - 花火雷达
- `ExchangeEngine.jsx` - 汇率引擎
- `RulesTab.jsx` (184行) - 生存法则
- `index.js` (13行) - 组件导出

### Hooks (2)
- `useMapTools.js` (127行) - 地图工具
- `useMapLayers.js` (237行) - 图层管理

### 工具函数 (13)
- `photoEngine.js` (283行) - 摄影引擎
- `cyberPanel.js` (21行) - 面板控制
- `astronomyCalculator.js` (187行) - 天文计算
- `dataGateway.js` (382行) - 数据网关
- `ruleDataConverter.js` (400行) - 规则数据转换
- `ruleMatcher.js` (493行) - 规则匹配器
- `decisiveMoments.js` (1668行) - 决定性时刻库
- `performanceHelpers.js` (244行) - 性能辅助
- `helpers.js` (15行) - 通用辅助
- `debounce.js` (89行) - 防抖函数
- `mapboxDebug.js` (103行) - Mapbox 调试
- 以及其他...

### 配置文件 (2)
- `basePoints.js` (73行) - 基础点位配置
- `mapConstants.js` (46行) - 地图常量

---

**总代码量:** 约 6,681 行
**最后更新:** commit 176998c
