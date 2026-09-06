# 今日去这卡（Today Card）设计文档

- 日期：2026-09-06
- 状态：待主人审阅
- 负责鱼：大肥鱼 🐋
- 上游计划：桌面《方向.md》第二批 #7「今日行程聚合」

---

## 1. 背景与目标

拍摄简报（🌅 胶囊卡）已上线，但它是"天空的简报"——用户真正要的是
"**今天去这**"：现在这片天怎么样、下一个天象什么时候来、附近有什么值得顺路踩的点。

本功能把四路现成数据**纯聚合**成一张卡，零新数据源、零新 API：

| 路 | 数据 | 来源 | 网络 |
|---|---|---|---|
| 天文 | 日出/日落/黄金/蓝调/月相 | `utils/shootingBrief.js`（本地计算） | 零 |
| 天气 | 天气状况/温度/云量/风 | `dataGateway.fetchGlobalEnvironmentData`（已有缓存+降级） | 复用（缓存吸收） |
| 摄影触发器 | "火烧云预警"等 | `ruleDataConverter` + `ruleMatcher.getTopSuggestions` | 零（复用天气数据） |
| 附近点位 | 收藏点 + 基础点位 + 花火大会 | `customPoints` / `basePoints` props + `config/hanabiData.js` | 零 |

### 非目标（明确不做）

- anitabi 附近巡礼点实时查询（代理无 geo 接口，属第三批 #11 范畴；
  本期附近点位以本地 basePoints 的 anime 类 + 收藏点覆盖）
- 路线规划/行程排序 —— 只做"聚合展示 + 点击跃迁"
- 新端点、新 KV 结构

## 2. 需求

| # | 需求 | 来源 |
|---|------|------|
| R1 | 卡片 = 天文条（原简报五要素）+ 天气行 + 下一个天象 + 今日触发器 + 附近点位列表 | 方向.md #7 |
| R2 | 附近点位按距地图中心距离排序，默认半径 50km、最多 5 条 | 方案定义 |
| R3 | 点击附近点位 → 地图 flyTo 跃迁 | 出行场景刚需 |
| R4 | 收起态沿用 🌅 圆钮 + 现有持久化键 `earth_terminal_brief_collapsed` | 与原简报兼容 |
| R5 | 天气/触发器加载失败优雅降级（对应行消失，卡不崩） | 边界要求 |
| R6 | 极昼/极夜文案沿用原简报口径 | 一致性 |

## 3. 架构

```
MapEngine.jsx
  └─ <TodayCard lat lng customPoints basePoints onFlyTo />   ← 替换 ShootingBrief 挂载

src/utils/todayCard.js      ← 纯函数核心（TDD）
src/components/TodayCard.jsx ← 展示组件（吸收原 ShootingBrief 的胶囊形态）
src/config/hanabiData.js    ← 花火数据抽离出 HanabiRadar.jsx（补经纬度）
tests/today-card.test.js
```

- `ShootingBrief.jsx` 移除（其折叠/持久化/五要素逻辑全部进入 TodayCard，
  `utils/shootingBrief.js` 纯函数层原样复用）
- 触发器链路：`fetchGlobalEnvironmentData` → `convertToRuleFormat` →
  `getTopSuggestions(env, 1)`，取第 1 条；组件内一次请求 + 失败静默

### 3.1 `utils/todayCard.js`（纯函数）

```js
haversineKm(lat1, lon1, lat2, lon2)          // 大圆距离，km
nextAstroEvent(brief, now = new Date())      // → {key,label,emoji,at:Date}|null
// 候选：sunrise/sunset/goldenHours*/blueHours* 的各段 start（end 已过则该段不计），
// 取 now 之后最近者；全部已过 → null
filterNearby({ lat, lon, points, radiusKm = 50, limit = 5 })
// → [{...pt, distanceKm}] 距离升序；非法坐标（非有限数）丢弃
buildTodayCard({ lat, lon, brief, weather, points, now })
// → { nextAstro, weatherLine: {emoji,condition,tempC,cloud}|null, nearby }
```

约定：
- `points` 每项 `{id, name, lat, lon, kind, color?}`，kind ∈ `favorite|base|hanabi`
- 天气 emoji 映射 `mapWeatherEmoji(condition)`：晴☀️/云⛅/雨🌧️/雪❄️/雷⛈️/雾🌫️，未知 🌍
- 所有函数对 null/异常入参安全降级，绝不抛出

### 3.2 `components/TodayCard.jsx`

- 收起态：36px 🌅 圆钮（top 居中，z-[1500]，与原简报同位同键）
- 展开态：`max-w-sm` 玻璃拟态卡（zinc-900/90 + backdrop-blur + cyan 边框），
  自上而下：天文条 → 天气行 → 下一个天象（倒计时）→ 触发器（可选）→ 附近列表
- 附近行：类型徽章（⭐收藏 / 分类色点 / 🎆花火）+ 名称 + 距离；点击 `onFlyTo(lat, lon)`
- 空状态："50km 内空空如也，拖动地图去别处看看"
- 无障碍：展开态 role="status"，附近列表语义化按钮

### 3.3 MapEngine 改动（最小侵入）

- import 换 TodayCard；传 `onFlyTo={(lat, lon) => map.flyTo([lat,lon], 14)}`
- 其余不动，不新增地图事件监听

## 4. 错误处理

| 场景 | 行为 |
|------|------|
| 天气请求失败/超时 | 天气行与触发器不渲染，天文与附近照常 |
| brief 为 null（非法坐标） | 整卡不渲染 |
| 附近无点位 | 显示空状态文案 |
| localStorage 不可用 | try/catch，默认展开态（沿用原逻辑） |

## 5. 测试计划（TDD）

`tests/today-card.test.js`：

1. haversine：东京站→横滨站 ≈ 27km（±3）；同点 = 0；对称性
2. nextAstroEvent：构造 brief 固定时间 → 选 now 后最近段；全过 → null；空区间 → null
3. filterNearby：半径截断、limit、距离升序、非法坐标丢弃
4. buildTodayCard：weather=null 降级；brief=null → null；正常路径聚合结构
5. mapWeatherEmoji：已知条件映射 + 未知兜底
6. hanabiData：4 条大会均有合法经纬度与 ISO 日期

## 6. 验收标准

- 打开首页 → 🌅 圆钮；展开即见五要素 + 天气 + 下一个天象 + 附近点位
- 点击附近项，地图 1.5s 内 flyTo 跃迁
- 断网/天气接口 5xx 时卡片仅缺天气行，无白屏无报错
- `npx vitest run` 全绿、`npx eslint .` 零错误、生产构建通过
