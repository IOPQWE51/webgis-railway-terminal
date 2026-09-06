# 点位数据模型升级（v2）设计文档

- 日期：2026-09-06
- 状态：待主人审阅
- 上游计划：桌面《方向.md》第三批 #8「点位数据模型升级」
- 前置事实：现有云端收藏均为测试数据，存储语义可放心变更

---

## 1. 背景与目标

现状三个痛点：
1. **整库覆盖写**：`POST /api/points` 是全量 set，多设备并发使用时后写覆盖前写
   （A 设备导入 100 点的同时 B 设备删 1 点 → A 的旧快照把删除冲回来）
2. **无分组语义**：点位只有 `source`（来源文件名/功能名）一种字符串维度，
   "关东之行"这类行程分组的用户诉求无处安放；UI 侧 `groupedPoints` 也是按 source 凑合的
3. **无导出**：数据只进不出，云端数据无法带走

v2 升级三件套：**`updatedAt` 多设备合并 + 行程分组 + JSON/CSV 一键导出**。

### 非目标

- 不改 KV 键布局（`points:<u>` 不动）—— 分组字段内嵌在点位对象里
- 不做服务端合并（Upstash 无原生条件写）；合并放客户端，服务端只管校验与存储
- 不做"软删除墓碑"（deletedAt）—— 测试数据阶段不值得，见 §5 取舍
- 不动 dark2d 战术库（points:<u>:dark2d 由 #9 usePoints 统一时再动）

## 2. 数据契约（v2 点位对象）

在 v1 白名单（id/name/lat/lon/category/source）之上新增三个可选字段：

```js
{
  id: 'csv_1725..._0_3',      // 不变
  name: '清水寺',              // 不变
  lat: 34.9949, lon: 135.7850,// 不变
  category: 'anime',           // 不变
  source: '关东之旅.csv',      // 不变（来源语义保留）
  // ── v2 新增 ──
  group: '关东之行',           // 行程分组（≤24 字符，可空/缺省）
  updatedAt: 1725628800000,   // 毫秒时间戳（多设备合并依据）
  importedAt: 1725542400000,  // CSV 导入已有此字段，纳入白名单（仅本地合并用）
}
```

- **服务端白名单扩展**：`validatePointsPayload` 放行 `group`（string≤24）与
  `updatedAt`/`importedAt`（有限数值时间戳）；仍是白名单剥离式校验，多余字段照旧剥离
- **兼容读**：旧点位（无新字段）全部合法，group 视为"未分组"

## 3. 三件套设计

### 3.1 多设备合并（updatedAt 客户端 LWW）

合并时机：登录拉云（`fetchCloudPoints`）与写云前（`handlePointsUpdate`）。

```
拉云合并 mergeOnPull(local, cloud)：
  按 id 分桶 → 同 id 双方都有：updatedAt 新者胜（缺省视为 0，即"最老"，
  旧数据永远被有 updatedAt 的一方覆盖——测试数据语义下安全）→
  只在一侧：保留 → 结果 setCustomPoints + 存本地 + 立即回推云端（把合并结果落库）
```

- 空云库守卫保持：云端 `[]` 仍视为"无数据"不清空本地（既有语义）
- A 设备清空不再传播删除（无墓碑）：接受。合并语义下 B 拉云时 B 本地仍有那些点，
  回推后点会"复活"——这是无墓碑 LWW 的已知属性，测试数据阶段可接受，注释写明

### 3.2 行程分组

- DataCenter"战术星标库"分组维度从 source 改为 **group 优先、source 兜底**：
  `const g = pt.group || pt.source || '未分类'`
- 点位行内提供轻量分组编辑：点开的组头有"重命名分组"，组内点位行尾"移入分组…"
  （prompt 式小交互，符合现有 DataCenter 的朴素交互风格）
- 手动添加/智能检索新增点位默认 `group: '默认分组'`？——**否**：默认不带 group，
  落到 source 分组（"手动修正录入"/"Google 智能检索"），用户显式移动才建组
- 分组名非全局唯一键，纯展示聚合维度（省去组表管理，符合"纯增量不重构"）

### 3.3 一键导出（JSON + CSV）

星标库标题行加"导出 JSON / 导出 CSV"两枚按钮：
- **JSON**：全量点位（含 v2 字段），`earth-terminal-points-YYYYMMDD.json`，
  可直接作为未来导入格式（本次不做导入 UI，JSON 结构留好）
- **CSV**：`name,lat,lon,category,group,source` 六列 UTF-8 BOM（Excel 中文不乱码），
  `earth-terminal-points-YYYYMMDD.csv`
- 导出纯前端 Blob 下载，零网络请求

## 4. 架构与文件

```
src/utils/pointsMerge.js     ← 纯函数：mergeOnPull（TDD 核心）
src/utils/pointsExport.js    ← 纯函数：toCSV/toJSON + download 触发（TDD）
api/_lib/validation.js       ← 白名单 + group/updatedAt/importedAt
src/App.jsx                  ← fetchCloudPoints/handlePointsUpdate 接合并
src/components/DataCenter.jsx← 分组维度 + 分组编辑 + 导出按钮
tests/points-merge.test.js   ← 合并语义矩阵
tests/points-export.test.js  ← CSV 转义/BOM/文件名
tests/validation 的既有文件扩展 group/时间戳用例
```

## 5. 测试计划（TDD）

1. mergeOnPull：同 id updatedAt 新者胜 / 旧者负；单侧保留；双方都无 updatedAt（旧数据）
   → 任一稳定结果且不丢点；空数组入参安全
2. mergeOnPull 排序稳定性：合并结果 id 顺序遵循"本地序优先"（减少 UI 跳动）
3. validate：group 超长被剥/被拒（与现有文本字段同策略：剥到白名单外即拒）；
   updatedAt 非数值被拒；importedAt 保留
4. toCSV：含逗号/引号/换行的 name 正确转义；BOM 头；表头顺序
5. toJSON：完整字段序列化
6. 文件名：YYYYMMDD 格式

## 6. 验收标准

- 双设备语义：同一账号，A 改点 B 拉 → B 拿到 A 的新值（updatedAt 生效）
- 分组：点位可归入"关东之行"，DataCenter 按 group 聚合显示，旧数据按 source 兜底
- 导出：CSV 打开 Excel 中文不乱码；JSON 结构完整
- 全部测试绿、lint 0 错、build 通过；生产部署后旧点位（无新字段）读取无异常
