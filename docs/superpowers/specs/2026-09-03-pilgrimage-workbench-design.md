# 次元情报中心 v1 —— 圣地巡礼工作台设计

> **日期**: 2026-09-03
> **状态**: 已与用户确认定稿
> **关联文件**: `src/components/PilgrimageRadar.jsx`、`api/`、`src/App.jsx`
> **数据源**: [anitabi 开放 API](https://github.com/anitabi/anitabi.cn-document/blob/main/api.md)（CC BY-NC-SA 4.0）、Bangumi API（api.bgm.tv）

---

## 1. 背景与现状

次元情报中心（`sub-culture` Tab 中的 `PilgrimageRadar.jsx`，共 77 行）目前只有一张跳转
anitabi.cn 的链接卡片和两条巡礼礼仪提示，没有任何数据能力，与项目内花火雷达、摄影规则引擎
等功能落差明显。

anitabi API 能力（已确认）：

- `GET https://api.anitabi.cn/bangumi/{subjectID}/lite` —— 一次返回：中文名、故事城市、封面、
  **主题色（color 字段）**、地图中心/缩放、前 10 个圣地（litePoints：id/cn/name/image/ep/s/geo）、
  巡礼点总数与图片总数、数据更新时间。
- `GET https://api.anitabi.cn/bangumi/{subjectID}/points/detail?haveImage=true` —— 全量圣地点位。
- 图片域 `https://image.anitabi.cn/`，缩略图方案 `?plan=h160`（列表）、`?plan=h360`（详情封面），
  全尺寸不推荐。
- **关键限制**：anitabi 无搜索接口，只能按 Bangumi subjectID 查询。番剧发现需借助
  Bangumi 搜索 API（`POST https://api.bgm.tv/v0/search/subjects`，type=2 动画），
  该 API 免钥但要求规范 User-Agent。

## 2. 目标与非目标

**目标（v1）**

1. 把次元情报中心升级为「圣地巡礼工作台」：精选番剧墙 + Bangumi 搜索 → 番剧巡礼详情卡
   （主题色渐变 + 封面 + 圣地列表）→ 圣地点位一键推送进主地图点位库（复用现有
   `customPoints` + `/api/points` 云同步）。
2. 完整的加载/空态/错误态；CC BY-NC-SA 署名合规。
3. TDD：去重合并与视图模型映射纯函数先行测试。

**非目标（v2 预留）**

- 巡礼路线规划（地理就近排序）、打卡进度。
- 单个圣地点位注入当地拍摄简报（日出/黄金时刻）。
- 推送后跨 Tab 自动跳转到地图页。
- Mapbox 上渲染巡礼专用图层。

## 3. 用户决策记录

| 决策点 | 结论 |
|--------|------|
| 产品定位 | 巡礼工作台（搜索/精选 → 详情 → 推送地图，与摄影引擎联动的独有卖点） |
| 番剧发现 | 内置精选名单 + Bangumi 搜索（双入口） |
| 地图联动 | 单点/全部推送到点位库（复用 `onPointsUpdate` 机制） |
| 数据链路 | 全部走 serverless 代理（复用 `api/weather.js` 模式：限流+缓存+CORS） |

## 4. 数据链路与 Serverless 设计

```
精选名单(config) ──┐
                    ├→ 番剧ID → GET /api/anitabi?type=bangumi&id=   → lite（前10圣地+封面+主题色）
搜索框 ─→ /api/bangumi?q= → 结果卡片 →┘                          └→ [查看全部] GET /api/anitabi?type=points&id=
                                                                    ↓
                                  推送 → onPointsUpdate(去重合并) → POST /api/points（现有云同步）
```

### `api/anitabi.js`（新增）

- 路由：`GET ?type=bangumi|points&id=<数字>`。
- `type=bangumi` → 转发 `https://api.anitabi.cn/bangumi/{id}/lite`；
  `type=points` → 转发 `.../points/detail?haveImage=true`。
- 参数校验：`id` 必须为正整数；`type` 白名单。校验失败 400（复用 `api/validation.js` 风格）。
- 缓存：生产环境 `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`
  （巡礼数据低频变动，lite 响应含 `modified` 可供观察）。
- 限流：复用 `withRateLimit` 读预设（与 points 读取同级）。
- CORS：`Access-Control-Allow-Origin: *`、`Allow-Methods: GET`（与 weather.js 一致）。
- 上游失败：502 + 简短错误信息，不泄露上游细节。

### `api/bangumi.js`（新增）

- 路由：`GET ?q=<关键词>`，`q` 长度 1~60，去除首尾空白。
- 转发：`POST https://api.bgm.tv/v0/search/subjects?limit=12`，body
  `{ "keyword": q, "filter": { "type": [2] } }`（契约以生产源码 bangumi/server handle.go 为准：
  `keyword` 单数必填、`type` 为整数数组），请求头带规范 UA：
  `EarthTerminal/{version} (https://github.com/IOPQWE51/webgis-railway-terminal)`。
- 响应压缩为 `{ list: [{ id, nameCn, name, date, coverSmall }] }`（最多取前 12 条），
  避免把 bgm.tv 原始大载荷透传给前端。
- 缓存：`s-maxage=3600`；限流：复用 `withRateLimit` 读预设（搜索成本略高，可独立预设）。

两个端点均为薄代理，不含业务加工；两个上游 API 均免密钥，不涉及环境变量。

## 5. 前端设计

### 文件结构

| 文件 | 职责 |
|------|------|
| `src/components/PilgrimageRadar.jsx` | 重写为工作台（Tab 挂载方式不变：仅激活时挂载） |
| `src/config/pilgrimagePicks.js` | 精选番剧名单（ID + 展示名），纯配置 |
| `src/utils/pilgrimageData.js` | 纯函数：响应→视图模型映射、去重合并、ID 构造、名称截断 |
| `src/components/index.js` | 导出不变（组件名沿用 PilgrimageRadar） |

### `src/config/pilgrimagePicks.js`（精选名单）

- 收录 8~12 部巡礼热门作品（《孤独摇滚》《摇曳露营》等）。
- **验收式要求**：每个收录的 subjectID 必须在实现期用 `/bangumi/{id}/lite` 实测返回有效
  巡礼数据（litePoints 非空）；未通过者替换为备选作品。实现完成后该名单即固化配置，
  不构成运行时依赖。

### 组件结构（PilgrimageRadar.jsx 内部三段式）

1. **发现区**（默认态）：精选番剧横向滚动卡（封面 `?plan=h160`、`loading="lazy"`）+
   搜索框。搜索结果为横向卡片流（封面 + 中文名 + 原名 + 年份），点击即选中。
2. **详情区**（选中番剧后）：封面 `?plan=h360`、中文名/原名、故事城市徽章、
   巡礼点/图片总数；顶部以 API `color` 字段渲染主题色渐变条（缺色回退项目粉色）。
   圣地列表（litePoints 前 10）：缩略图（h160，缺图占位块）+ 中文名/原名 + `EP/S` 标签 +
   坐标；行尾 [推送] 按钮。列表尾部 [查看全部 N 点] 懒加载 `type=points`。
3. **页尾**：保留现有「巡礼礼仪」卡片；新增固定署名条（见 §7）。

顶部提供 [← 返回发现区] 。组件 props 扩展为
`{ isActive, customPoints, onPointsUpdate }`（App.jsx 传入，与 DataCenter 同模式）。

### 状态管理

- `view: 'discover' | 'detail'`、`selectedSubject`、`detailData`、`searchResults`、
  `searchQuery`、`loading/error/searching/loadingMore`、`pushFeedback`。
- Tab 切走即卸载，返回重新拉取（可接受，数据有边缘缓存兜底）。

## 6. 点位推送与去重（TDD 核心）

字段映射到现有服务端硬校验 schema（`api/validation.js`：id≤64、name≤120、
category≤32、source≤32、lat/lon 有限数且在界内）：

```
id       = `pilg-${bangumiId}-${pointId}`     // 例：pilg-374498-1024
name     = 圣地中文名（>120 字符截断）
category = 'anime'
source   = 'anitabi'
lat/lon  = geo 数组 [lat, lon]
```

去重纯函数（`src/utils/pilgrimageData.js`，TDD 先行）：

```js
mergePilgrimagePoints(existingPoints, incomingPoints)
// 跳过条件（满足其一）：
//   1. 生成的 id 已存在于 existingPoints
//   2. existingPoints 中存在 source==='anitabi' 且同名
//      且 |latΔ|<1e-4 且 |lonΔ|<1e-4（约 11 米）的点
// 返回 { merged, added, skipped }
```

推送动作：单个 [推送] 传入该点；[全部推送] 传入当前已加载的全部点位。
调用 `onPointsUpdate(merged)`（内部走 App.jsx 现有 POST `/api/points` 全量覆盖同步），
组件内显示「已推送 N 个，跳过 M 个重复」横幅，并提示前往「战术地图」Tab 查看。
`DataCenter.jsx` 的 `getIconStyle` 补 `anime` 分类粉色图标映射（该函数已有 fallback，
无破坏风险）。

## 7. 错误处理与署名合规

| 场景 | UI |
|------|----|
| 搜索无结果 | 空态卡：换个关键词试试 |
| 选中番剧无巡礼数据（lite 404 或 litePoints 为空） | 空态卡 + anitabi 地图链接 |
| 限流（429）或网络错误 | 错误卡 + 重试按钮 |
| 图片缺失 | 灰色占位块（不破版） |

署名条（详情区页脚固定展示，许可证义务）：

> 圣地点位数据 © [anitabi.cn](https://anitabi.cn/map?bangumiId={id}) · CC BY-NC-SA 4.0

同时该链接是官方巡礼地图深度链接，作为「去官方地图看更多」出口。

## 8. 测试策略

- `tests/pilgrimage-data.test.js`（新增，TDD 先行）：
  - `mergePilgrimagePoints`：空表合并 / id 重复跳过 / 同源同名同坐标跳过（阈值边界
    1e-4 内外）/ 全新增量计数正确。
  - lite → 视图模型映射：字段齐全、缺 color/缺 image/缺 city 的容错、geo 解构。
  - bgm 搜索压缩映射：取前 12 条、缺 nameCn 回退 name、日期截取年份。
  - 名称截断与 id 构造。
- 两个 serverless 端点保持薄逻辑，参数校验复用已测的 `validation.js` 模式；
  不引入新依赖、不改动现有端点。

## 9. 验收标准

1. 不联网搜索也能浏览精选番剧墙并进入详情（精选 ID 实测全部有效）。
2. 搜索「孤独摇滚」能返回结果并选中进入详情卡。
3. 详情卡主题色随番剧变化；圣地列表含缩略图与 EP/S 标签。
4. 单点/全部推送后，地图 Tab 点位库出现对应点位（图标为 anime 样式），刷新页面仍存在
  （云同步生效）；重复推送计数为「跳过」。
5. 触发限流或断网时呈现对应错误态，不白屏。
6. 署名条可见且链接正确。
7. `npm run lint` 零错误、`npm test` 全绿、`npm run build` 通过。

## 10. 影响面与回滚

- 改动文件：新增 3（api/anitabi.js、api/bangumi.js、src/config/pilgrimagePicks.js）+
  纯函数 1（src/utils/pilgrimageData.js）+ 测试 1；重写 1（PilgrimageRadar.jsx）；
  微调 2（App.jsx 传 props、DataCenter.jsx getIconStyle 加一行）。
- 不改动：点位 schema、`/api/points` 契约、其他 Tab 组件。
- 回滚：还原 PilgrimageRadar.jsx 与 App.jsx props 即可回到链接卡片版，无数据迁移。
