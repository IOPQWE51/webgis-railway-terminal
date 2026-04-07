# 🔐 API 密钥与环境配置完整指南

## 📋 .env 文件结构

### 原则
```
✅ 可以写进 .env 再交到 GitHub：
   - 已停用/轮换的旧 key
   - 开发机密设置（仅本机）
   - 注明"示例"的虚拟值

❌ 绝对不能交到 GitHub：
   - 活跃的 API key
   - 服务器密钥
   - OAuth tokens
   - 数据库密码

→ 使用 .gitignore 保护 .env 文件（已配置）
```

---

## 🔧 当前 .env 配置

### 前端公开部分（安全）
```bash
# ======== 前端公开可用 (本地调试用) ========
VITE_OWM_KEY=f248f355671dcb0ffa5645c53823d4e5
VITE_WEATHER_API_KEY=17c3bd708a6a428ba7e45904262703

# 说明：这些 key 会暴露在前端代码中，使用免费/配额有限的入门 key
# 如果超额会导致服务降级，但不会造成数据泄露
```

**在哪些文件中使用**：
```javascript
// src/config/mapConstants.js
export const OWM_API_KEY = import.meta.env.VITE_OWM_KEY;

// src/utils/dataGateway.js (本地开发模式)
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
```

### 后端私密部分（机密）
```bash
# ======== 绝对机密！仅限云端后端读取 (不要带 VITE_ 前缀) ========

# 天气 API
WEATHER_API_KEY=17c3bd708a6a428ba7e45904262703

# 天文库
ASTRO_APP_ID=6164bfee-f1c6-47fb-823c-365a0ffe07b2
ASTRO_APP_SECRET=4f44ffe80a6c99ac8ba3efac379ba5fe8efbde1b73bbeff35b205d6845910094d40c89a877890758221013e65fb64d8f02ea44c03246b7c933fd1da2543693712cced70a70bc901efda15c6ddf2f3f8c6eeaa3002f465af5d67d6b0144dc287461a7d451aaa6efa9022f3a4f810eef4e

# NASA API
NASA_API_KEY=uFiyY5uKdvmW2FwkGLEMgzp2GrWoEMFVPJxuVMAY
```

**在哪些文件中使用**：
```javascript
// api/weather.js (Vercel Serverless)
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// api/geomagnet.js (NOAA 不需要 key，该 API 完全公开)
// NOAA 无需 key，直接访问

// api/astronomy-calendar.js (NASA)
const NASA_API_KEY = process.env.NASA_API_KEY;
```

---

## 📝 添加新 API 时的步骤

### Step 1️⃣：获取 API Key

在对应的平台申请，得到密钥。

### Step 2️⃣：更新 .env

根据密钥的用途添加到 .env 文件：

```bash
# 如果在前端（React 组件）中使用 → VITE_ 前缀
VITE_NEW_API_KEY=xxxxxxxxxxxxx

# 如果仅在后端（api/*.js）中使用 → 无前缀
NEW_API_KEY=xxxxxxxxxxxxx

# 示例：极光预报 API（后端）
AURORA_FC_API_KEY=sk_live_xxxxxxxxxxxxx

# 示例：地磁 NOAA（无需 key，但如果有高级版本）
NOAA_API_KEY=  # 留空（NOAA 基础版完全公开）
```

### Step 3️⃣：更新代码

在适当的文件中读取密钥：

**前端调用** (`src/utils/dataGateway.js`):
```javascript
const NEW_API_KEY = import.meta.env.VITE_NEW_API_KEY;
```

**后端调用** (`api/newendpoint.js`):
```javascript
const NEW_API_KEY = process.env.NEW_API_KEY;
```

### Step 4️⃣：更新 vercel.json

为新 API 端点配置缓存策略（见下一节）。

### Step 5️⃣：Vercel 部署设置

在 Vercel 仪表板添加环境变量：
```
Vercel Settings → Environment Variables
  ├─ NEW_API_KEY = xxxxxxxxxxxxx
  ├─ 设置为 "Production" (or "Preview")
  └─ 点击 "Save"
```

---

## ⚙️ Vercel.json 配置模板

### 当前配置
```json
{
  "headers": [
    {
      "source": "/api/weather",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, s-maxage=300, stale-while-revalidate=600"
        }
      ]
    }
  ],
  "builds": [
    {
      "src": "api/**.js",
      "use": "@vercel/node",
      "config": {
        "maxDuration": 10
      }
    }
  ]
}
```

### 添加新 API 端点的步骤

每次增加新的 Serverless 函数（`api/newapi.js`），需要在 `vercel.json` 的 headers 中添加对应的缓存配置。

**模板**：
```json
{
  "source": "/api/newapi",            // ← 修改为你的端点名称
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, s-maxage=604800"  // ← 修改为适当的缓存时间
    }
  ]
}
```

### 常见缓存时间参考

| API 类型 | TTL | s-maxage 值 | 说明 |
|---------|-----|-----------|------|
| 实时天气 | 5 分钟 | 300 | 变化快 |
| 精准地点 | 1 小时 | 3600 | 相对稳定 |
| 地磁指数 | 1 小时 | 3600 | 预测数据 |
| 樱花积温 | 7 天 | 604800 | 缓慢变化 |
| 流星雨日期 | 30 天 | 2592000 | 年度固定 |
| 光污染地图 | 30 天 | 2592000 | 月度更新 |

### 完整的 vercel.json 示例（未来完全配置）

```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  
  "headers": [
    // 实时天气
    {
      "source": "/api/weather",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=300, stale-while-revalidate=600" }
      ]
    },
    // 樱花物候
    {
      "source": "/api/phenology",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=604800" }
      ]
    },
    // 极光预报（NOAA）
    {
      "source": "/api/geomagnet",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=3600" }
      ]
    },
    // 天文事历
    {
      "source": "/api/astronomy-calendar",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=2592000" }
      ]
    },
    // 光污染地图
    {
      "source": "/api/light-pollution",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=2592000" }
      ]
    }
  ],
  
  "builds": [
    {
      "src": "api/**.js",
      "use": "@vercel/node",
      "config": {
        "maxDuration": 10
      }
    }
  ],
  
  "crons": [
    {
      "path": "/api/weather?lat=0&lon=0",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## 🌍 时区处理

### ✅ 已实现的时区自动化

#### api/phenology.js
```javascript
// ✅ 已添加
const meteoUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
meteoUrl.searchParams.append('timezone', 'auto');  // ← 自动检测用户当地时区

// 效果：
// - 日本用户 (135°E) → UTC+9
// - 纽约用户 (74°W) → UTC-5
// - 伦敦用户 (0°) → UTC+0
// 返回的温度数据都基于当地时间，无需手工转换
```

#### src/utils/dataGateway.js
```javascript
// 太阳计算也自动处理时zone，但使用不同的方式
const times = SunCalc.getTimes(now, lat, lon);
// SunCalc 基于 UTC now，自动用经度计算本地时间

// 显示本地时间的函数
const formatLocalTimeByLon = (date, lon) => {
    const offsetHours = Math.round(lon / 15);  // 每 15° = 1 小时
    const offsetMs = offsetHours * 60 * 60 * 1000;
    const localDate = new Date(date.getTime() + offsetMs);
    // 转换为当地时间
};
```

### 需要改进的地方

虽然 phenology API 用了 `timezone=auto`，但其他 API 也需要明确支持时区：

#### api/weather.js（已有，确认）
```javascript
// ✅ 检查：WeatherAPI 是否返回当地时间？
// 通常 API 会根据 lat/lon 自动返回当地时间
// 如果不确定，可以检查响应体中的 "time_zone" 字段
```

#### 未来的 API（需要检查）
```javascript
// NOAA 地磁 API - 通常是 UTC，需要手工转换为当地
// NASA 天文 API - 通常是 UTC，需要手工转换
// 光污染 API - 通常是全局网格，无时区问题
```

---

## ✅ 完整检查清单

添加新 API 时，请按这个清单操作：

- [ ] 1. 在服务平台申请 API Key
- [ ] 2. 根据使用场景决定（前端 vs 后端）
  - [ ] 前端：添加 `VITE_` 前缀到 .env
  - [ ] 后端：添加无前缀的 Key 到 .env
- [ ] 3. 在 Vercel 仪表板配置环境变量
- [ ] 4. 创建 `api/newapi.js` Serverless 函数
- [ ] 5. **核心：在函数中配置 `timezone=auto` 或手工时区转换**
- [ ] 6. 更新 `vercel.json` 的 headers 部分，添加缓存策略
- [ ] 7. 在 `src/utils/dataGateway.js` 的 `fetchPromises` 中添加并行调用
- [ ] 8. 更新 `CACHE_TTL` 常数
- [ ] 9. 在 `src/utils/ruleDataConverter.js` 中填充对应字段
- [ ] 10. 测试：本地 + 生产环境

---

## 📝 安全提示

### .gitignore 已配置吗？
```bash
# .gitignore 应该包含
.env           # ✅ 本地环境变量
.env.*.local   # ✅ 本地建立文件
.env.production.local  # ✅ 不上传到 Git
.env.development.local # ✅ 同上
```

### 检查命令
```bash
# 确认 .env 不在 Git 追踪中
git status

# 如果 .env 已经被上传，需要清除历史
git rm --cached .env
git commit -m "remove .env from git"
git push
```

### Vercel 安全
```
✅ 绝对不要在 vercel.json 中硬编码密钥
✅ 所有密钥必须在 Vercel 仪表板中配置
✅ Vercel 仪表板会自动加密并隔离环境变量
✅ 定期轮换 API 密钥（尤其是付费的）
```

---

## 🚀 下一步

1. **立即**：确认 .gitignore 正确保护 .env
2. **本周**：按照清单添加第二个 API（NOAA 极光预报）
3. **后续**：建立"API 轮换"计划（每季度检查一次过期的 key）

