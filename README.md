# 🌍 EarthTerminal v5.2.0 - 全球战术地理信息终端

> **代号**: Tactical Horizon (战术地平线)
> **发布日期**: 2026-04-10
> **项目类型**: 开源 WebGIS 地理信息系统
> **定位**: 全方位地球战术终端 + 摄影决策引擎
> **许可证**: MIT

---

## 📋 目录

- [版本概述](#-版本概述)
- [核心特性](#-核心特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [开发指南](#-开发指南)
- [部署说明](#-部署说明)
- [版本历史](#-版本历史)
- [贡献指南](#-贡献指南)

---

## 🎯 版本概述

### v5.2.0 最新更新

| 项目 | 信息 |
|------|------|
| 版本号 | v5.2.0 |
| 前一版本 | v5.1.0 |
| React 版本 | 19.2.0 |
| 构建工具 | Vite 7.3.1 |
| 代码规模 | ~8,500+ 行 |

### 核心变化

- **移动端抽屉优化**: GPU 加速的 transform 位移，修复高度计算问题
- **手势交互增强**: touchAction 防护，消除浏览器下拉刷新干扰
- **云端数据同步**: Upstash Redis (Vercel KV) 双向同步
- **架构文档完善**: ARCHITECTURE.md 系统白皮书更新

---

## 🌟 核心特性

### 地图引擎
- ✅ **引擎支持**: Mapbox GL
- ✅ **Dark 2D 样式**: 自定义战术风格地图
- ✅ **多图层切换**: 地形/暗色/亮色/街道/卫星
- ✅ **智能标记聚类**: MarkerCluster 自动聚合
- ✅ **实时测距工具**: 战术 HUD 距离显示
- ✅ **战术方框标记**: 白色发光点击标记
- ✅ **幽灵蓝定位**: 用户位置雷达波纹

### 战术系统
- ✅ **全息 HUD 面板**: 右侧悬浮信息窗
- ✅ **地区智能检测**: 自动识别国家/地区
- ✅ **API 自动适配**: 根据地区选择最佳 API
- ✅ **脉冲动画系统**: 目标锁定视觉效果

### 摄影引擎
- ✅ **215+ 决定性瞬间规则**: 全球化摄影时机捕捉
- ✅ **稀有度优先系统**: ⭐⭐⭐⭐⭐ 加权排序
- ✅ **天文事件计算**: 流星雨、超级月亮自动计算
- ✅ **环境感知**: 时间、天气、地形综合判断

### 数据管理
- ✅ **独立存储系统**: Dark 2D 点位独立存储
- ✅ **CSV 批量导入**: 大规模坐标数据导入
- ✅ **Google Geocoding**: 地名转精确坐标
- ✅ **本地持久化**: localStorage 数据存储
- ✅ **云端同步**: Upstash Redis 自动备份

---

## 🛠️ 技术栈

### 前端核心

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.0 | UI 框架 |
| Vite | 7.3.1 | 构建工具 |
| Tailwind CSS | 4.2.1 | 样式系统 |
| Lucide React | 0.577.0 | 图标库 |

### 地图引擎

| 技术 | 版本 | 用途 |
|------|------|------|
| Mapbox GL | 3.21.0 | 地图渲染引擎 |

### 工具库

| 技术 | 版本 | 用途 |
|------|------|------|
| SunCalc | 1.9.0 | 天文计算 |
| Sentry | 10.46.0 | 错误监控 |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/IOPQWE51/webgis-railway-terminal.git
cd webgis-railway-terminal

# 安装依赖
npm install
```

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 生产构建

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

---

## 📖 开发指南

### 项目结构

```
earth-terminal/
├── src/
│   ├── components/          # React 组件
│   │   ├── MapEngine.jsx              # 地图引擎核心
│   │   ├── MapboxMapTactical.jsx      # 战术地图
│   │   ├── ControlPanel.jsx           # 控制面板
│   │   ├── TacticalBottomSheet.jsx    # 战术抽屉
│   │   ├── DarkTacticalHUD.jsx        # 全息悬浮窗
│   │   └── ...
│   ├── pages/              # 页面组件
│   │   └── MapTactical.jsx            # 战术地图页
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useMapTools.js             # 地图工具
│   │   └── useMapLayers.js            # 图层管理
│   ├── utils/              # 工具函数
│   │   ├── photoEngine.js             # 摄影引擎
│   │   ├── regionDetector.js          # 地区检测
│   │   ├── performanceHelpers.js      # 性能工具
│   │   └── ...
│   ├── config/             # 配置文件
│   │   ├── basePoints.js              # 基础坐标
│   │   └── mapConstants.js            # 地图常量
│   ├── App.jsx             # 主应用
│   └── main.jsx            # 入口文件
```

### 六大核心模块

#### 1. 🗺️ 高精度地形终端
- Leaflet + Esri 卫星地形
- 动态底图切换
- 智能过滤系统
- 实时测距工具

#### 2. 💾 数据解析与管理
- CSV 批量导入
- Google Geocoding
- 本地持久化存储
- 云端数据同步

#### 3. 📜 系统生存法则
- 215+ 摄影规则
- 智能匹配评分
- 稀有度优先排序
- 天文事件计算

#### 4. 💱 双向汇率引擎
- 实时汇率转换
- 多货币支持
- 动态货币切换

#### 5. ✨ 次元情报中心
- 花火大会雷达
- 朝圣地图导航

#### 6. ✈️ 跨国航线雷达
- 大圆航线算法
- 流光动画效果
- 3D 可视化

---

## 🚢 部署说明

### Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署到 Vercel
vercel --prod
```

### 环境变量

创建 `.env` 文件：

```bash
# Mapbox Access Token (必需)
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# Google Maps API Key (可选)
VITE_GOOGLE_MAPS_API_KEY=your_google_api_key_here

# Vercel KV 数据库 (Upstash Redis)
KV_REST_API_URL=your_kv_rest_url
KV_REST_API_TOKEN=your_kv_rest_token
```

---

## 📜 版本历史

### v5.2.0 (2026-04-10)
- 🔧 移动端抽屉高度计算修复 (GPU transform)
- 📱 手势交互优化 (touchAction 防护)
- 📚 文档完善更新

### v5.1.0 (2026-04-09)
- ✨ Dark 2D 战术系统
- ✨ 地区检测引擎
- ✨ 双重定位系统 (GPS + IP)
- 📱 移动端战术抽屉完善

### v5.0.2 (2026-04-08)
- 移动端战术抽屉系统
- 四档磁吸锚点

### v5.0.1 (2026-04-07)
- 架构升级: Railway Map → Earth Terminal
- 6大核心模块

---

## 🤝 贡献指南

欢迎贡献代码！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: 添加某个功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

MIT License

---

## 👥 维护团队

**项目维护者**: IOPQWE51 & Gemini & Claude

**特别感谢**:
- Mapbox Team - 优秀的地图工具
- Leaflet Team - 开源的地图引擎
- Esri Team - 高质量的卫星地形数据
- OpenStreetMap - 免费的地理数据

---

## 🔗 相关链接

- **GitHub 仓库**: https://github.com/IOPQWE51/webgis-railway-terminal
- **在线演示**: https://eterm.vercel.app
- **问题反馈**: https://github.com/IOPQWE51/webgis-railway-terminal/issues

---

**Earth Terminal v5.2.0**

*> "在移动端的战场上，每一像素的响应都至关重要。"*
