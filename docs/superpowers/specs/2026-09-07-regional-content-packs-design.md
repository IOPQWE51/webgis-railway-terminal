# 内容分区域打包（#10）设计文档

- 日期：2026-09-07
- 状态：已施工
- 上游计划：桌面《方向.md》第三批 #10「内容分区域打包」

---

## 1. 背景与体量真相

现状全部内容数据都在 `src/config/` 全局数组里，App 启动即全量进主 bundle：

| 数据 | 行数 | 区域属性 |
|---|---|---|
| `BASE_POINTS_CONFIG` 51 站铁道骨架 | 73 | 日本 |
| `RAILWAY_LINES_CONFIG` 12 条线 | mapConstants 内嵌 | 日本 |
| `PILGRIMAGE_PICKS` 8 番剧 | 14 | 日本 |
| `HANABI_DATA` 4 场大会 | 8 | 日本 |
| `TACTICAL_STYLES` 样式常量 | ~110 | **非内容，不拆** |

判断：当前体量（<10KB）拆懒加载**省不了体积**，价值在于**扩张结构** ——
以后加"欧洲铁道""北美花火"时按区域文件纯增量，主 bundle 永不膨胀。

## 2. 设计：区域注册表 + 同步归位（一期）+ 懒加载预留（二期）

### 一期（本次）：目录归位 + 注册表

```
src/config/regions/
  ├── index.js          ← REGION_REGISTRY：区域元数据 + 聚合导出
  └── japan.js          ← 日本区内容包：stations/railwayLines/pilgrimagePicks/hanabi
```

- `japan.js` 单文件集中本区全部内容（点位/线/巡礼/花火），字段名即内容类型
- `REGION_REGISTRY`：`[{ id:'jp', name:'日本', data: japan }]` —— 新国家 = 新文件 + 注册表加一行
- **消费方改动最小化**：App/useMapLayers/PilgrimageRadar/HanabiRadar/TodayCard 的
  import 路径从 `config/basePoints` 等改为 `config/regions`（经注册表聚合导出，
  具名导出与原数组同形：`BASE_POINTS_CONFIG`、`RAILWAY_LINES_CONFIG`、
  `PILGRIMAGE_PICKS`、`HANABI_DATA`）—— diff 只动 import 行，运行时零变化
- `mapConstants.js` 里的 `RAILWAY_LINES_CONFIG` 迁出到 japan.js；
  样式/底图/天气节点等**非区域内容**留在 mapConstants
- 删除空占位 `transitIntel.js`（无消费者）
- **原文件 `basePoints.js` / `pilgrimagePicks.js` / `hanabiData.js` 删除**
  （数据整体搬家，不留双源）；`tests/today-card.test.js` 等改引新路径

### 二期（数据量长大后）：真懒加载

- 区域包改 `import()` 动态导入，注册表存 loader 函数而非 data
- 触发：`detectRegion`（#3 已有的双范式区域检测）判出区域 → 只加载对应包
- 一期结构已把"区域 → 内容"的映射收敛到注册表，二期只改注册表内部形态，
  消费方接口（聚合具名导出）不变

## 3. 验收

- import 路径迁移后：`npx vitest run` 全绿（today-card 契约测试改新路径仍过）
- build 体积不退化（±2KB 内）
- 生产站点行为零变化（今日卡附近列表/花火 tab/巡礼 tab 正常）
