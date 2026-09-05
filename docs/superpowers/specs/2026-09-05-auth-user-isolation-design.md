# 轻登录与数据隔离 + 猫站长登录页 · 设计文档

> 2026-09-05 · 状态：已确认（用户拍板：轻登录+数据隔离；登录 UI 采用"动画角色跟随表单"模式，本地化为猫站长）
> 前置讨论：全局点位池互踩 + 未鉴权整库覆盖（关闭《API 安全加固 — Token 鉴权》待办）；
> 朱印帐（下一迭代）将直接构建在本账户体系之上（stamps:<username>）。

## 1. 目标

1. 引入轻量账户体系（用户名 + 密码），会话用 JWT httpOnly Cookie。
2. 点位云端数据按用户隔离：`points:<username>`，终结"任何人可整库覆盖全局池"。
3. 登录页采用"动画角色跟随表单状态"模式，本地化为**猫站长**（铁路终端人设）。
4. 匿名体验降级为纯本地（localStorage），不再读写云端公共库。

## 2. 非目标

- 邮箱/手机注册、密码找回（个人产品：忘记密码 = 删档重注册，或联系管理员用 KV 控制台）
- 第三方 OAuth、多角色权限、邮箱验证、验证码
- 数据模型大改（points 条目 schema 不变，仅存储键变化）

## 3. 已确认的用户决策

| 决策点 | 结论 |
|---|---|
| 身份架构 | 轻登录 + 数据按用户隔离（否决：匿名设备ID / OAuth / 暂不改） |
| 登录 UI | "动画角色登录页"交互模式（参考 21st.dev animated-characters-login-page / careercompass），**不复制其画风** |
| 数据库 | 不新增——复用已投产的 Vercel KV（Upstash Redis） |
| 登录 UI 范围 | 本迭代交付登录/注册 + 猫站长；朱印帐下一迭代 |

## 4. 架构设计

### 4.1 凭据与存储（复用 KV，零新增基建）

- 用户名：3–24 字符，`/^[a-z0-9_-]+$/`（小写化后存储）
- 密码：8–72 字符；`bcryptjs`（纯 JS，避免 native 依赖）cost 12
- KV 键规划：
  - `user:<username>` → `{ hash, createdAt }`（JSON 字符串）
  - `points:<username>` → 经 `validatePointsPayload` 校验的点位数组（沿用现有 schema，MAX_POINTS=2000）
  - `earth_terminal_global_points` → 遗留公共库（见 4.4 迁移）
- 新依赖：`bcryptjs`、`jose`（JWT 签发/校验，Edge 兼容）——仅此两个

### 4.2 会话

- `POST /api/auth/login` 成功后签发 JWT（HS256，payload `{ sub: username, iat, exp }`，7 天）
- Cookie：`et_session`，`httpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
- 密钥：`process.env.JWT_SECRET`（≥32 字符；未配置时 auth 端点统一返回 503，不泄露具体原因）
- 生产 `Secure` 属性按 `VERCEL_ENV === 'production'` 开启（本地 http 调试可用）

### 4.3 端点契约（api/auth.js 单文件四个动作，或 auth.js + auth/[action].js）

| 端点 | 方法 | 入参 | 成功 | 失败 |
|---|---|---|---|---|
| `/api/auth/register` | POST | `{username, password}` | 201 `{ok:true, username}` | 400 校验失败 / 409 已存在 / 429 / 503 |
| `/api/auth/login` | POST | `{username, password}` | 200 `{ok:true, username}` + Set-Cookie | 401 凭据错误（统一文案，不区分"无此用户/密码错"）/ 429 / 503 |
| `/api/auth/logout` | POST | -（清 Cookie） | 200 `{ok:true}` | - |
| `/api/auth/me` | GET | -（读 Cookie） | 200 `{username}` | 401 未登录 |

- 限流：register/login 走 `strict` 档（防爆破），me/logout 走 `general`
- 登录失败统一 401 + 固定文案，不做用户枚举侧信道
- KV 不可用 → 503 `{error:'存储服务暂不可用'}`

### 4.4 `/api/points` 改造

- 身份来源：仅 `et_session` Cookie（去掉一切"信任客户端自称身份"的口子）
- 已登录：GET/POST 读写 `points:<username>`（POST 仍走 `validatePointsPayload` 全量硬校验）
- 匿名：GET/POST 一律 401 `{error:'需要登录'}`（匿名前端纯本地，不发云请求）
- **遗留库迁移（一次性）**：`register` 时若 `earth_terminal_global_points` 仍存在 →
  复制为该新用户的 `points:<username>` 初值，并将旧键改名为 `earth_terminal_global_points_claimed_<ts>`（标记已认领）。
  先到先得：部署后**站长立刻注册**即认领成功；`ALLOW_REGISTRATION=false` 时 register 返回 403（注册关闭开关，站长模式下防陌生人进入）

### 4.5 前端行为

- `App.jsx`：启动时 `GET /api/auth/me` 恢复会话；云同步逻辑分支——
  已登录：localStorage 乐观更新 + POST `/api/points`（现有链路，键随会话）；
  匿名：仅本地，云同步按钮/逻辑显示"未建立上行链路"状态
- 身份 UI：`数据解析与管理` 页新增**作战身份卡**（登录/注册表单、当前用户徽章、登出）；
  顶部 header 显示 `NODE: <用户名>` 徽章替代写死的 `03-JP`
- 路由：登录不做独立路由，做成全屏覆盖层（登录时主内容模糊化）

## 5. 猫站长登录页（本次迭代的视觉核心）

### 5.1 概念

铁路终端 × 猫站长（致敬日本"猫站长"文化）：一只穿站长制服、戴制帽的 SVG 三色猫，
作为"上行链路认证操作员"陪你完成登录。交互模式提取自参考项目（角色状态机跟随表单状态），画风完全原创。

### 5.2 角色状态机（LoginStationCat 组件）

| 状态 | 触发 | 表现 |
|---|---|---|
| `idle` | 初始/失焦 | 尾巴摆动循环 + 每 4s 眨眼 + 耳朵偶发抖动 |
| `watching` | 用户名框聚焦/输入 | 瞳孔跟随输入长度左右移动（translateX 随 value.length 映射，含 clamp），头部微倾 |
| `covering` | 密码框聚焦 | 双爪上移捂眼（隐私梗），耳朵压后 |
| `loading` | 提交中 | 视线飘向侧上方 + 头顶冒出旋转雷达小图标 |
| `error` | 401/400 | 摇头动画（keyframes rotate ±8°×3）+ 胡须抖动 + HUD 红色描边脉冲 + `SIGNAL LOST` 字样 |
| `success` | 201/200 | 尾巴竖起快速摆动 + 眼睛弯成月牙 + `ACCESS GRANTED` 打字机 + 短暂彩带粒子（琥珀金/朱红双色） |

### 5.3 技术约束

- 纯 SVG 分层绘制（躯干/头/瞳孔/眼睑/双爪/尾巴/制帽各自成 `<g>`）+ CSS transitions/keyframes + React 状态驱动 class —— **零新增动画依赖**（对比参考仓库的 Framer Motion/GSAP）
- 瞳孔位移、爪子升降用 `transform` 过渡（GPU 合成，不触发重排）
- `prefers-reduced-motion: reduce` 时全部循环动画停用，仅保留状态切换
- 表单无障碍：label 显式绑定、错误文案 `aria-live="polite"`、按钮禁用态完整
- 视觉基调：深色 HUD 框（琥珀金 #fbbf24 描边 + 扫描线）× 猫站长三色（茶白黑）× 朱红印章色点缀

## 6. 测试计划（TDD）

新增 `tests/api-auth.test.js`（纯函数层，不触网）：
- `validateCredentials`：用户名正则/长度边界（2/3/24/25）、密码 8/72 边界
- `sessionCookieOptions(env)`：生产含 Secure、本地不含
- `signSession/verifySession` 往返 + 篡改 payload 拒绝 + 过期拒绝
- `buildUserRecord`：bcrypt hash 往返验证

`tests/api-points-scope.test.js`：
- `resolvePointsKey(req)`：无会话 → null；有会话 → `points:<username>`
- `claimLegacyPool` 逻辑：首注册迁移 + 旧键改名 + 二次注册不再迁移

handler 级冒烟沿用现有模块导入图测试风格。猫站长组件为视觉件，状态机 reducer
抽为纯函数 `nextCatState(event, state)` 用 vitest 覆盖（focus/blur/submit/success/error）。

## 7. 验收清单（生产）

1. 注册站长账号 → 自动认领旧公共库（东京站/稚内站等出现在账下）
2. 登录后推送巡礼点 → 云端 `points:<username>` 增长，刷新/换浏览器登录后数据一致（跨设备）
3. 匿名访问 → 不发生任何云端读写；登录页猫站长六状态齐全
4. 错误密码 → 猫摇头 + SIGNAL LOST；正确 → ACCESS GRANTED 进主界面
5. `/api/points` 匿名 POST → 401；`ALLOW_REGISTRATION=false` 后 register → 403
6. 旧全局池被改名标记，不再被任何请求读写

## 8. 环境变量（Vercel 控制台，一次性）

| 变量 | 用途 | 状态 |
|---|---|---|
| `MAPBOX_ACCESS_TOKEN_PROD` | 修复跃迁搜索主链路（代码已上线待配置） | 待补 |
| `JWT_SECRET` | 登录会话签名（≥32 字符随机串） | 新增 |
| `ALLOW_REGISTRATION`（可选） | 站长注册后设为 `false` 关闭入口 | 可选 |

## 9. 里程碑

- **M1（本迭代）**：auth 四端点 + points 按用户隔离 + 遗留库认领 + 身份卡 UI
- **M2（本迭代）**：猫站长登录页（状态机 + SVG 角色 + 动效打磨，浏览器截图验收）
- **M3（下一迭代）**：朱印帐（`stamps:<username>` 服务端存储、GPS 实地章 + 遥拝印、
  次元中心内子页、战术×和风视觉）——spec 另行成文
