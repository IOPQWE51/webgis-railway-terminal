# Earth Terminal 代码架构文档

**版本:** v5.2.0
**项目代号:** Tactical Horizon (战术地平线)
**项目:** earth-terminal
**构建工具:** Vite 7.3.1
**框架:** React 19.2.0
**地图库:** Mapbox GL 3.21.0
**发布日期:** 2026-04-10

---

## 目录结构

```
src/
├── pages/           # 页面组件
│   └── MapTactical.jsx         # 战术地图页面
├── components/      # UI 组件
│   ├── MapEngine.jsx           # 主地图引擎
│   ├── MapboxMapTactical.jsx   # Mapbox 战术地图
│   ├── ControlPanel.jsx        # 控制面板
│   ├── TacticalBottomSheet.jsx # 移动端战术抽屉
│   ├── DarkTacticalHUD.jsx     # 全息悬浮窗
│   ├── DataCenter.jsx          # 数据中心
│   ├── SearchNavEngine.jsx     # 空间跃迁引擎
│   ├── AviationEngine.jsx      # 航线雷达
│   ├── PilgrimageRadar.jsx     # 朝圣雷达
│   ├── HanabiRadar.jsx         # 花火雷达
│   ├── ExchangeEngine.jsx      # 汇率引擎
│   ├── RulesTab.jsx            # 生存法则
│   └── index.js                # 组件导出
├── hooks/           # React Hooks
│   ├── useMapTools.js          # 地图工具
│   └── useMapLayers.js         # 图层管理
├── utils/           # 工具函数
│   ├── photoEngine.js          # 摄影引擎
│   ├── cyberPanel.js           # 面板控制网关
│   ├── regionDetector.js       # 地区检测
│   ├── performanceHelpers.js   # 性能工具库
│   ├── astronomyCalculator.js  # 天文计算
│   ├── dataGateway.js          # 数据网关
│   ├── ruleDataConverter.js    # 规则数据转换
│   ├── ruleMatcher.js          # 规则匹配器
│   ├── decisiveMoments.js      # 决定性时刻库
│   ├── debounce.js             # 防抖函数
│   ├── helpers.js              # 通用辅助
│   └── mapboxDebug.js          # Mapbox 调试
├── config/          # 配置文件
│   ├── basePoints.js           # 基础点位配置
│   ├── mapConstants.js         # 地图常量
│   └── transitIntel.js         # 换乘情报
├── App.jsx          # 应用入口
└── main.jsx         # React 挂载点
```

---

## 核心模块

### 1. 应用入口 (`App.jsx`)

**职责:**
- 主应用状态管理
- 标签导航控制（循环滚动）
- 全局通信桥接
- 战术模式切换
- 云端数据同步

**核心状态:**
```javascript
- activeTab: 当前激活标签 ('map' | 'data' | 'rules' | 'tools' | 'sub-culture' | 'aviation')
- customPoints: 自定义点位数据
- isTacticalMode: 战术地图模式开关
- pendingMapTarget: 待定位的地点
- isCloudSyncing: 云端同步状态
```

**全局通信接口:**
```javascript
window.__locatePointOnMap(pointId)    // 定位到指定点位
window.__deleteCustomPoint(id)        // 删除自定义点位
window.__saveToCustomPoints(...)      // 保存新坐标
```

**云端同步架构:**
```
┌─────────────────────────────────────────────────────┐
│                   App.jsx                           │
│  ┌───────────────────────────────────────────────┐  │
│  │  1. localStorage 瞬间加载 (兜底)              │  │
│  │  2. 挂载时 /api/points 拉取云端最新          │  │
│  │  3. 更新时 /api/points POST 推送云端         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
   本地持久化                Upstash Redis (Vercel KV)
```

---

### 2. 战术地图页面 (`MapTactical.jsx`)

**职责:**
- Dark 2D 战术地图容器
- 独立点位存储系统
- 地图样式切换
- 空间跃迁搜索
- GPS/IP 双重定位

**核心状态:**
```javascript
- customPoints: Dark 2D 独立点位存储
- mapCenter: 地图中心坐标
- mapZoom: 缩放级别
- currentStyle: 当前地图样式 (dark2D | dark | light | streets)
- clickedCoord: 点击的坐标
- userLocation: 用户当前位置 (幽灵蓝标记)
- bottomSheetOpen: 移动端抽屉状态
```

**独立存储键:**
```javascript
'earth_terminal_dark2d_points' // Dark 2D 点位独立存储
```

---

### 3. Mapbox 战术地图 (`MapboxMapTactical.jsx`)

**职责:**
- Mapbox GL 地图渲染
- Dark 2D 样式支持
- 战术标记渲染
- 点击事件处理
- 限流保护

**样式限流:**
```javascript
STYLE_CHANGE_COOLDOWN = 2000 // 2秒冷却时间
```

**标记类型:**
1. **雷达准星标记** - 中心十字准星
2. **战术方框标记** - 白色发光四角 (点击坐标)
3. **幽灵蓝定位标记** - 用户位置雷达波纹

---

### 4. Dark 战术 HUD (`DarkTacticalHUD.jsx`)

**职责:**
- 全息悬浮信息窗
- 地区信息展示
- 脉冲动画效果
- 移动端事件分发

**视觉风格:**
```javascript
深空暗场: #050505 / #0f172a
琥珀鎏金: #fbbf24
机甲切割: 24px 圆角、锐利边框
幽灵视效: 背景模糊、半透明
```

**功能模块:**
- 目标锁定状态指示
- 坐标信息显示
- 地区信息标签
- 换乘线路 (待接入 API)
- 热门目的地 (待接入 API)

**移动端适配:**
```javascript
// 移动端发射事件到战术抽屉
window.dispatchEvent(new CustomEvent('openTacticalBottomSheet', { detail: html }));
```

---

### 5. 地区检测器 (`regionDetector.js`)

**职责:**
- 坐标地区识别
- API 提供商映射
- 子区域检测
- 逆地理编码备用

**支持地区:**
```javascript
{
  japan: {
    apiProvider: 'yahoo-transit',
    regions: ['kanto', 'kansai', 'chubu', 'tohoku', 'hokkaido', 'kyushu']
  },
  china: {
    apiProvider: 'amap', // 高德地图
    regions: ['beijing', 'shanghai', 'guangzhou', 'shenzhen']
  },
  usa: {
    apiProvider: 'google-places',
    regions: ['northeast', 'west']
  },
  europe: {
    apiProvider: 'citymapper',
    regions: ['uk', 'france', 'germany']
  }
}
```

**核心函数:**
```javascript
detectRegion(lat, lon)              // 边界框匹配
detectRegionByGeocoding(lat, lon)   // 逆地理编码
formatCoordinate(lat, lon)          // 坐标格式化
```

---

### 6. 性能工具库 (`performanceHelpers.js`)

**职责:**
- API 请求保护
- 性能监控
- 重试机制
- 定位服务

**核心功能:**

| 函数 | 说明 |
|------|------|
| `debounce(func, wait)` | 防抖函数 |
| `throttle(func, limit)` | 节流函数 |
| `createRateLimiter(max, perMinutes)` | API 限流器 |
| `storage.save/load/remove/clear` | 本地存储包装 |
| `performanceMonitor.measure(label, fn)` | 性能监控 |
| `batchProcessor.process(items, fn)` | 批处理 |
| `retryMechanism.execute(fn, maxRetries)` | 重试机制 |
| `geocodeRequest(query, provider)` | 地理编码 |
| `getCurrentPosition(options)` | GPS/IP 双重定位 |

**定位系统:**
```javascript
// 智能定位 (优先 GPS，失败则 IP)
const position = await getCurrentPosition({
  preferGPS: true,
  fallbackToIP: true,
  gpsTimeout: 15000
});

// GPS 定位
{ latitude, longitude, accuracy: 'high', method: 'gps' }

// IP 定位
{ latitude, longitude, city, country, accuracy: 'low', method: 'ip' }
```

---

### 7. 战术样式常量 (`mapConstants.js`)

**职责:**
- 战术颜色定义
- 按钮样式
- 输入框样式
- 面板样式
- 角标装饰

**颜色系统:**
```javascript
TACTICAL_STYLES.colors = {
  amber: '#fbbf24',           // 主色调
  amberGlow: 'rgba(251, 191, 36, 0.6)',
  cyanBlue: '#0ea5e9',        // 次色调
  slateDark: '#050505',       // 背景色
  grayText: '#64748b',        // 文本色
  redAlert: '#ef4444',        // 警告色
  greenStatus: '#22c55e'      // 状态色
}
```

---

### 8. 移动端战术抽屉 (`TacticalBottomSheet.jsx`)

**职责:**
- 移动端地点详情展示
- 手势拖动交互
- 四档磁吸锚点

**锚点配置:**
```javascript
SNAP_POINTS = {
  HIDDEN: 0,    // 隐藏档
  SCOUT: 25,    // 侦察档 (默认)
  MIDDLE: 55,   // 中间档
  BATTLE: 92    // 作战档 (全屏)
}
```

**手势处理:**
- `touchAction: 'none'` 阻止浏览器默认行为
- `passive: false` 条件性阻止默认行为
- GPU 加速的 `transform` 位移实现

**高度计算修正:**
```javascript
// 2026-04-10 修复：使用固定高度 + transform 位移
height: '100dvh'  // 固定全屏
transform: `translateY(${100 - sheetHeight}dvh)`  // 动态位移
```

---

### 9. 面板控制网关 (`cyberPanel.js`)

**职责:**
- 设备检测与分发
- 桌面端 `#cyber-panel` 控制
- 移动端自定义事件发射

```javascript
export const openCyberPanel = (html) => {
    if (window.innerWidth < 1024) {
        // 移动端：发射自定义事件
        window.dispatchEvent(new CustomEvent('openTacticalBottomSheet', { detail: html }));
    } else {
        // 桌面端：DOM 操作
        // ...
    }
};
```

---

## 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                         App.jsx                             │
│  • customPoints 状态                                         │
│  • activeTab 状态                                            │
│  • 全局通信桥接                                              │
│  • isTacticalMode 切换                                       │
│  • 云端同步 (/api/points)                                    │
└──────────────────┬────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐      ┌──────────────┐
│ MapTactical  │      │  MapEngine   │
│ (战术地图)    │      │  (主地图)     │
│              │      │              │
│ Dark 2D      │      │ Mapbox GL    │
│ 云同步        │      │ 暗色主题     │
│ 空间跃迁      │      │ useMapLayers │
│ 双重定位      │      │ useMapTools  │
└──────────────┘      └──────────────┘
       │                     │
       ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ DarkTactical │      │ photoEngine  │
│ HUD          │      │              │
│              │      │ SunCalc      │
│ 地区检测     │      │ 天文计算     │
│ regionDetect │      └──────────────┘
└──────┬───────┘             │
       │                     ▼
       │              ┌──────────────┐
       │              │ cyberPanel   │
       │              │              │
       ▼              │ 设备检测     │
┌──────────────┐      │ 网关分发     │
│ mobile sheet │      └──────┬───────┘
│ desktop HUD  │             │
└──────────────┘    ┌────────┴────────┐
                    ▼                 ▼
            ┌──────────────┐  ┌──────────────┐
            │  桌面端      │  │  移动端      │
            │ #cyber-panel │  │ 自定义事件   │
            │  右侧浮窗    │  │ TacticalSheet │
            └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    performanceHelpers                        │
│  • API 限流  • 重试机制  • 性能监控  • 批处理  • 定位       │
└─────────────────────────────────────────────────────────────┘
```

---

## 存储架构

### localStorage 键名

| 键名 | 用途 | 作用域 |
|------|------|--------|
| `earth_terminal_custom_points` | 主地图自定义点位 | 常规模式 |
| `earth_terminal_dark2d_points` | Dark 2D 独立点位 | 战术模式 |
| `railway_custom_points` | 旧系统点位 (已迁移) | 向后兼容 |

---

## 移动端适配状态

| 功能 | 桌面端 (>1024px) | 移动端 (<1024px) | 状态 |
|------|-----------------|-----------------|------|
| 点击地图标记 | ✅ DarkTacticalHUD | ✅ TacticalBottomSheet | ✅ 已适配 |
| 地区检测 | ✅ HUD 显示 | ✅ 抽屉显示 | ✅ 已适配 |
| 空间跃迁搜索 | ✅ HUD + 标记 | ✅ 抽屉 + 标记 | ✅ 已适配 |
| GPS 定位 | ✅ 幽灵蓝标记 | ✅ 幽灵蓝标记 | ✅ 已适配 |
| IP 定位 | ✅ 备份定位 | ✅ 备份定位 | ✅ 已适配 |
| 控制面板 | ✅ 右侧固定面板 | ✅ 底部抽屉集成 | ✅ 已适配 |
| 战术地图 | ✅ 全屏沉浸式 | ✅ 全屏沉浸式 | ✅ 已适配 |
| 测距工具 | ✅ 顶部 HUD | ✅ 顶部 HUD | ✅ 已适配 |
| 手势交互 | ❌ 不适用 | ✅ 四档磁吸拖动 | ✅ 已适配 |
| 抽屉高度 | ❌ 不适用 | ✅ GPU transform | ✅ 已修复 |

---

## 双模式架构

### 常规模式
```
┌─────────────────────────────────────┐
│  导航栏 (循环滚动)                   │
├─────────────────────────────────────┤
│  内容区 (六大模块)                   │
│  • 地形终端 (Mapbox GL)                │
│  • 数据中心                          │
│  • 摄影法则                          │
│  • 汇率引擎                          │
│  • 次元情报                          │
│  • 航线雷达                          │
└─────────────────────────────────────┘
```

### 战术模式 (Dark 2D)
```
┌─────────────────────────────────────┐
│  [ DARK_2D_RADAR ] 控制台           │
│  ┌────────────────────────────┐    │
│  │ ZONE 搜索 │ LOCATE 定位     │    │
│  │ MODE 样式 │ TACTICAL/DATA   │    │
│  └────────────────────────────┘    │
├─────────────────────────────────────┤
│                                      │
│         全屏 Mapbox Dark 2D         │
│         战术方框标记                 │
│         幽灵蓝定位标记               │
│                                      │
└─────────────────────────────────────┘
│  LAT: xx.xxxx // LNG: xx.xxxx // Z  │
└─────────────────────────────────────┘
```

---

## 视觉设计规范

### 战术色彩系统
```css
/* 主色调 */
--tactical-amber: #fbbf24;
--tactical-amber-glow: rgba(251, 191, 36, 0.6);
--tactical-amber-border: rgba(251, 191, 36, 0.3);

/* 次色调 */
--tactical-cyan: #0ea5e9;
--tactical-cyan-bg: rgba(14, 165, 233, 0.15);

/* 背景色 */
--tactical-dark: #050505;
--tactical-panel: rgba(15, 23, 42, 0.4);
--tactical-slate: #0f172a;

/* 功能色 */
--tactical-gray: #64748b;
--tactical-red: #ef4444;
--tactical-green: #22c55e;
--tactical-white: #f8fafc;
```

### 交互反馈
| 交互 | 反馈效果 |
|------|----------|
| 拖动中 | 指示器变粗 (5px → 8px) |
| 吸附锚点 | 自动过渡动画 (300ms) |
| 点击标记 | HUD/抽屉弹出 + 脉冲动画 |
| 目标锁定 | 琥珀金闪烁状态灯 |
| 测距模式 | 顶部 HUD 显示距离 |

---

## 文件清单

### 页面组件 (1)
- `MapTactical.jsx` (417 行) - 战术地图页面

### UI 组件 (13)
- `MapEngine.jsx` (230+ 行) - 主地图引擎
- `MapboxMapTactical.jsx` (250+ 行) - Mapbox 战术地图
- `ControlPanel.jsx` (99 行) - 控制面板
- `TacticalBottomSheet.jsx` (185 行) - 移动端战术抽屉
- `DarkTacticalHUD.jsx` (464 行) - 全息悬浮窗
- `DataCenter.jsx` (200+ 行) - 数据中心
- `SearchNavEngine.jsx` (62 行) - 空间跃迁引擎
- `AviationEngine.jsx` - 航线雷达
- `PilgrimageRadar.jsx` - 朝圣雷达
- `HanabiRadar.jsx` - 花火雷达
- `ExchangeEngine.jsx` - 汇率引擎
- `RulesTab.jsx` (184 行) - 生存法则
- `index.js` (13 行) - 组件导出

### Hooks (2)
- `useMapTools.js` (127 行) - 地图工具
- `useMapLayers.js` (237 行) - 图层管理

### 工具函数 (13)
- `photoEngine.js` (283 行) - 摄影引擎
- `cyberPanel.js` (50+ 行) - 面板控制网关
- `regionDetector.js` (213 行) - 地区检测
- `performanceHelpers.js` (473 行) - 性能工具库
- `astronomyCalculator.js` (187 行) - 天文计算
- `dataGateway.js` (382 行) - 数据网关
- `ruleDataConverter.js` (400 行) - 规则数据转换
- `ruleMatcher.js` (493 行) - 规则匹配器
- `decisiveMoments.js` (1668 行) - 决定性时刻库
- `helpers.js` (15 行) - 通用辅助
- `debounce.js` (89 行) - 防抖函数
- `mapboxDebug.js` (103 行) - Mapbox 调试

### 配置文件 (3)
- `basePoints.js` (73 行) - 基础点位配置
- `mapConstants.js` (160 行) - 地图常量
- `transitIntel.js` - 换乘情报库 (框架)

---

## API 适配架构

### 地区检测与 API 映射

```
坐标输入 → detectRegion(lat, lon)
    ↓
边界框匹配 → 地区识别
    ↓
┌───┴──────────────────────────────────┐
│  日本 │ 中国 │ 美国 │ 欧洲 │ 其他    │
└───┬────┴──┬────┴──┬────┴──┬────┴──┐
    ↓       ↓       ↓       ↓       ↓
Yahoo  高德   Google  Citymapper  N/A
Transit Maps
```

### 待接入 API

| 地区 | API | 状态 | 用途 |
|------|-----|------|------|
| 日本 | Yahoo Transit | 待接入 | 换乘路线 |
| 中国 | 高德地图 | 待接入 | 换乘路线 |
| 美国 | Google Places | 待接入 | 热门目的地 |
| 欧洲 | Citymapper | 待接入 | 换乘路线 |

---

## 性能优化

### 代码分割
- Mapbox GL 异步加载
- 路由级别懒加载

### 渲染优化
- 虚拟滚动 (大列表)
- 标记聚合 (减少 DOM)
- 防抖节流 (搜索/滚动)

### API 保护
- 限流器 (防止过度请求)
- 重试机制 (失败自动重试)
- 批处理 (大量数据分批)

### 样式切换限流
```javascript
STYLE_CHANGE_COOLDOWN = 2000 // 防止频繁切换消耗配额
```

---

## 安全措施

- ✅ Token 分离: Public/Secret 隔离
- ✅ 速率限制: 10次/分钟
- ✅ 前端防抖: 500ms
- ✅ URL 限制: 生产 Token 仅允许 Vercel 域名
- ✅ 定位权限: 智能降级 (GPS → IP)

---

## 版本历史

### v5.2.0 (2026-04-10)
- 🔧 移动端抽屉高度计算修复 (GPU transform)
- 📱 手势交互优化 (touchAction 防护)
- 📚 文档完善更新

### v5.1.0 (2026-04-09)
- ✨ Dark 2D 战术系统
- ✨ 地区检测引擎
- ✨ 双重定位系统
- ✨ 性能工具库
- ✨ 战术方框标记
- ✨ 幽灵蓝定位标记
- 📱 移动端战术抽屉完善
- 🐛 手势劫持修复

### v5.0.2 (2026-04-08)
- 移动端战术抽屉系统
- 四档磁吸锚点
- 琥珀金发光拖动指示器

### v5.0.1 (2026-04-07)
- 架构升级: Railway Map → Earth Terminal
- 6大核心模块
- 双模式系统

---

**总代码量:** 约 8,500+ 行
**最后更新:** v5.2.0 (2026-04-10)
