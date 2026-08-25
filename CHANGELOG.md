# 更新日志 / Changelog

本文件记录 EarthTerminal 的每个正式版本的变更摘要。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [v5.3.0] - 2026-08-25 · 安全加固 & 性能跃迁 & 视角分享

> 代号「Coral Reef」。本次发布包含 17 个提交：1 个 P0 安全修复、多项 P1 加固、
> 首屏体积削减 83%，以及全新的视角深链接功能。

### 🔒 安全

- **P0 · `/api/points` 写入端点加固**：字段白名单与类型/长度校验、经纬度范围检查、
  单次上限 2000 点 / 请求体 1MB、读写分离限流（写 30 次/分、读 60 次/分）、
  Redis 客户端进程内单例复用
- `rateLimiter` 客户端 IP 改取 `X-Forwarded-For` 链最后一跳（旧实现取首跳可被伪造绕过限流）；
  新增 `pointsWrite` 限流预设
- `api/astronomy` 挂严格限流（10 次/时/IP，付费配额保护）；
  weather / elevation / phenology 统一坐标数值校验并补充密钥存在性检查
- `usage-monitor` 移除 `'monitor_secret_change_me'` 默认密钥回退与错误详情泄露；
  孤儿测试脚本 `api/test-kv.js` 迁出 `api/` 目录，避免被部署为可触发的线上端点
- `api-security-check.cjs` 移除以"检测模式"名义写死的两个真实泄露密钥完整值，
  改用通用特征正则（⚠️ 历史泄露的钥匙仍需在服务商后台作废轮换）
- `vercel.json`：删除 URL 明文携带默认密钥的 cron 与无效预热任务；
  `/api/*` 缓存作用域收窄（points no-store、astronomy 显式 1h）；
  新增 HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
  Permissions-Policy 安全响应头

### ⚡ 性能

- 首屏 JavaScript **2185KB → 364KB（gzip 约 116KB，削减 83%）**：
  - react / react-dom 与 mapbox-gl 厂商分包，跨版本长期缓存
  - 战术子树（MapTactical → MapboxMapTactical → mapbox-gl ≈1.8MB）
    改为 React.lazy 按需加载，首次进入战术模式才拉取
- 云端点位接口改为 `no-store`，天文接口显式 1 小时边缘缓存

### ✨ 新功能

- **视角深链接**：地图移动/缩放后实时写入 `#lat&lon&z&tab` 哈希，
  复制地址栏即可把"当前这个角度"分享给任何人；
  打开分享链接自动切换页签、飞行定位到目标坐标并弹出详情卡
  （含日出日落、黄金时刻、蓝调时刻等摄影决策信息，可一键收藏入星标库）

### 🐛 修复

- 点击站点时 `targetLng/targetLat` 未定义的 ReferenceError —— 白色脉冲坐标方框
  功能自上线以来静默失效的根因
- `useMapLayers` 两颗潜伏时序雷：
  定位消费效果声明于地图创建之前导致启动期目标被静默跳过；
  初始化窗口期内发动的动画式 panTo 被 Leaflet 静默吞掉（信标落了镜头不动）
- `DarkTacticalHUD` 切换目标时残留上一站地区信息的瑕疵
- 循环标签导航的克隆副本补充 `aria-hidden` 与焦点屏蔽（辅助技术不再读到 18 个标签）
- 补充战术风 favicon，消除控制台 `/vite.svg` 404
- 清零全仓 28 条存量 lint 错误（unused-vars / no-undef / hooks 规则逐条处置）

### 🧰 工程化

- 引入 vitest：**58 条单元测试**
  （服务端输入校验模块 + ruleMatcher 评分引擎特征化测试网，含 0°C falsy 短路、
  camelCase 字段配对两处回归哨兵）
- 新增 GitHub Actions CI 三道闸门：eslint 零错误 → vitest → 生产构建

## [v5.2.0] 及更早

参见 README「版本历史」章节。
