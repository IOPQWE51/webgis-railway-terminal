# Provider 适配层基建（#11）设计文档

- 日期：2026-09-07
- 状态：已施工
- 上游计划：桌面《方向.md》第三批 #11「provider 适配层基建」

---

## 1. 现状盘点（8 个数据代理端点）

| 端点 | 上游 | 缓存 | 降级行为 | 免费额度 |
|---|---|---|---|---|
| mapbox | Mapbox（100k/月） | Cache-Control 头 15min | 502 | 付费敏感 |
| weather | WeatherAPI + Open-Meteo | 头 5min | 500 | 付费敏感 |
| anitabi | api.anitabi.cn | **无** | 502 | 社区免费 |
| bangumi | api.bgm.tv | **无** | 502 | 免费礼仪 |
| elevation | Open-Meteo | 头 7d?（无，误） | **200 + 默认值 0** | 免费 |
| phenology | Open-Meteo archive | 头 7d | 500 | 免费 |
| aurora | NOAA SWPC | 无 | 500 | 公开 |
| astronomy | AstronomyAPI | 无 | 502/500 | 付费凭证 |

痛点：每家手写一套 fetch/ok 检查/错误映射；anitabi、bangumi、aurora
**零缓存**（同参数重复请求全打上游）；降级行为三种方言（502/500/200 默认值）；
将来接 Overpass/ODPT/GTFS 又要再抄一遍。

## 2. 设计：`api/_lib/provider.js` 三件套

```js
// 一个 provider 定义 = 数据源的全部接入知识
const anitabiProvider = {
  name: 'anitabi',
  cache: { ttl: 3600 },          // KV 缓存 TTL（秒）；null = 不缓存
  request: async (input) => ({    // 输入 → 上游 fetch 配置
    url, headers, init
  }),
  map: (raw, input) => data,      // 上游原始响应 → 前端载荷（瘦身/压平）
  statusMap: { 404: 404 },        // 上游状态码 → 本端点状态码映射（可选）
};

// 一个调用门面 = 缓存 + 限流之外的第三层
const { status, json } = await callProvider(anitabiProvider, input);
```

`callProvider` 统一执行四步：
1. **KV 读缓存**（`provider:<name>:<inputKey>` 命中即返回，TTL 由 provider 定义）
2. **上游请求**（超时 8sAbortController；按 statusMap 翻译非 2xx）
3. **map 瘦身** → 写 KV 缓存 → 返回 200
4. **失败降级**：上游抛错/超时 → 命中过期缓存则返回过期数据（stale-while-error）；
   无缓存可用 → 返回 provider 定义的错误载荷（或 fallback 数据）

KV 复用 api/points.js 的 Upstash 单例模式（进程内单例 + env 探测 + 未配置静默降级为直连）。

## 3. 改造范围（本次实际执行）

**已收编 6 家**（provider 定义 + callProvider）：
- anitabi（1h KV 缓存 + 404 语义保持）
- bangumi（1h KV 缓存，关键词维度）
- aurora（**单键缓存 10min** —— 全坐标共享一份 NOAA 网格，坐标匹配在 map 内做）
- elevation（7d 缓存 + 500/海拔0 降级语义保持）
- weather（WeatherAPI 走 provider 5min；Open-Meteo 历史直连保持）
- astronomy（6h 缓存，付费配额保护）
- phenology（Open-Meteo 归档走 provider 6h）

**留原样 1 家**：
- mapbox —— 多分支 + Nominatim 双链兜底 + token 指纹日志结构复杂，
  边缘缓存头（15min）已兜住重复请求，KV 增量收益低、改造风险高于收益。
  待未来真需要时再收编，callProvider 接口已就绪。

**外部 API 契约全部不变**（前端零改动）：响应结构、状态码语义逐端点保持。

## 4. 测试计划（TDD）

`tests/api-provider.test.js`：
1. callProvider 缓存命中：第二次同 input 不打上游（fetch 计数）
2. 缓存 miss → 上游请求 → KV 写入
3. 上游 404 按 statusMap 翻译；无映射的非 2xx → 降级错误
4. 上游超时/抛错 → 过期缓存兜底返回
5. 无缓存可用 → provider 定义的错误载荷
6. KV 未配置 → 直连不缓存不报错
7. anitabi/bangumi provider 定义单元：输入校验 + map 瘦身正确性

## 5. 验收

- 全套测试绿 + lint 0 + build 过
- 生产实测：anitabi 代理经 KV 缓存后重复请求 ms 级返回（缓存命中日志）
- 前端零改动：今日卡/巡礼/花火/汇率全功能原样
