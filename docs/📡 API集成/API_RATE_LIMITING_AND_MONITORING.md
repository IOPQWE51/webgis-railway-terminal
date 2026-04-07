# 🛡️ API速率限制与用量监控

## 📋 功能概述

本项目实现了三层API保护机制：

1. **前端防抖** - 防止用户快速连续点击
2. **后端速率限制** - 防止恶意刷接口
3. **用量监控** - 自动监控API使用情况

---

## 🔧 功能1：前端防抖

### 使用方法

```javascript
import { fetchMapboxWithDebounce } from '@/utils/debounce';

// 在组件中使用
const handleMapboxRequest = async () => {
  try {
    const data = await fetchMapboxWithDebounce(lat, lon, 'geocoding');
    console.log(data);
  } catch (error) {
    console.error('Mapbox请求失败:', error);
  }
};

// 组件卸载时清理定时器
useEffect(() => {
  return () => {
    const { clearAllDebounceTimers } = require('@/utils/debounce');
    clearAllDebounceTimers();
  };
}, []);
```

### 参数说明

- `lat`: 纬度
- `lon`: 经度
- `type`: API类型（'geocoding' 或 'traffic'）
- **防抖时间**: 500ms（同一坐标500ms内只发送最后一次请求）

---

## 🔧 功能2：后端速率限制

### 已配置的速率限制器

| API | 限制 | 说明 |
|-----|------|------|
| `/api/mapbox` | 10次/分钟 | Mapbox API |
| 通用API | 60次/分钟 | 其他API（可选） |
| 严格限制 | 10次/小时 | 昂贵的API（可选） |

### 速率限制响应头

当请求被限制时，返回以下响应头：

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-01T12:00:00.000Z
Retry-After: 45
```

### 错误响应

```json
{
  "error": "Too many requests",
  "message": "请稍后再试。45秒后重置。",
  "retryAfter": 45
}
```

### 自定义速率限制

如需为其他API添加速率限制：

```javascript
// api/your-api.js
import { withRateLimit, generalRateLimiter } from './rateLimiter.js';

export default withRateLimit(generalRateLimiter)(async function handler(req, res) {
  // 你的API逻辑
});
```

---

## 🔧 功能3：用量监控

### 自动监控

Vercel Cron Job 每周一上午9点自动运行：

```bash
GET /api/usage-monitor?key=monitor_secret_change_me
```

### 手动检查

```bash
curl "https://jprail.vercel.app/api/usage-monitor?key=monitor_secret_change_me"
```

### 响应示例

```json
{
  "timestamp": "2024-01-01T09:00:00.000Z",
  "apis": {
    "mapbox": {
      "currentMonth": 9000,
      "limit": 100000,
      "percentage": "9%",
      "projected": 9000,
      "status": "healthy"
    },
    "weather": {
      "currentMonth": 9000,
      "limit": 1000000,
      "percentage": "0.9%",
      "projected": 9000,
      "status": "healthy"
    }
  },
  "alerts": [
    {
      "api": "mapbox",
      "level": "info",
      "message": "ℹ️ Mapbox用量已达 9000/100000 (9%)",
      "recommendation": "用量正常，继续监控"
    }
  ],
  "summary": {
    "totalAPIs": 2,
    "alertsCount": 1,
    "status": "healthy"
  }
}
```

### 警告级别

| 级别 | Mapbox阈值 | WeatherAPI阈值 | 说明 |
|------|-----------|---------------|------|
| `critical` | >95,000 | >950,000 | 需要立即处理 |
| `warning` | >85,000 | >850,000 | 需要关注 |
| `info` | >70,000 | >700,000 | 信息提示 |

---

## 🔐 配置监控密钥

### 修改默认密钥

在 `.env` 文件中：

```bash
MONITOR_SECRET_KEY=your_random_secret_key_here
```

### 生成随机密钥

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📊 监控Dashboard

### Mapbox用量统计

访问：https://account.mapbox.com/statistics/

查看：
- 当前API调用次数
- 热门端点
- 错误率
- 地理分布

### Vercel Analytics

访问：https://vercel.com/dashboard → 你的项目 → Analytics

查看：
- 函数执行时间
- 错误率
- 请求量趋势

---

## 🚨 异常处理

### 如果用量激增

1. **检查速率限制**：确认速率限制器正常工作
2. **检查缓存**：确认缓存策略生效（15分钟）
3. **检查日志**：Vercel Dashboard → Function Logs
4. **启用更严格限制**：调整 `rateLimiter.js` 中的参数

### 如果收到429错误

```javascript
// 前端重试逻辑
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const retryAfter = error.retryAfter || 60;
        console.log(`Rate limited, retrying after ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        throw error;
      }
    }
  }
};
```

---

## 📈 性能优化建议

### 1. 延长缓存时间

如果API用量过高，可以延长缓存时间：

```javascript
// api/mapbox.js
res.setHeader('Cache-Control', 'public, s-maxage=1800'); // 从900秒改为1800秒（30分钟）
```

### 2. 减少请求频率

在前端增加节流：

```javascript
import { throttle } from '@/utils/debounce';

const throttledRequest = throttle(async () => {
  // API调用
}, 2000); // 2秒内只执行一次
```

### 3. 批量请求

合并多个请求为一个：

```javascript
// ❌ 不好：3次请求
const mapbox1 = await fetchMapbox(lat, lon, 'geocoding');
const mapbox2 = await fetchMapbox(lat, lon, 'traffic');
const elevation = await fetchElevation(lat, lon);

// ✅ 好：1次请求（在后端合并）
const combined = await fetch('/api/combined?lat=35.6762&lon=139.6503');
```

---

## 🔍 调试技巧

### 查看速率限制状态

```javascript
import { mapboxRateLimiter } from '@/utils/rateLimiter';

console.log(mapboxRateLimiter.getStats());
// 输出：{ totalIPs: 5, windowMs: 60000, maxRequests: 10 }
```

### 查看防抖定时器

```javascript
import { mapboxDebounceTimers } from '@/utils/debounce';

console.log('活跃的防抖定时器:', mapboxDebounceTimers.size);
```

---

## 📝 维护清单

### 每周（5分钟）
- [ ] 检查 Mapbox Dashboard 用量
- [ ] 检查 Vercel Analytics 错误率
- [ ] 查看监控邮件（如启用）

### 每月（10分钟）
- [ ] 分析用量趋势
- [ ] 调整速率限制（如需要）
- [ ] 优化缓存策略

### 用量异常时
- [ ] 检查日志找出异常请求
- [ ] 临时启用更严格的限制
- [ ] 联系支持（Mapbox/Vercel）

---

## 🆘 常见问题

### Q1: 速率限制不生效？
**A**: 检查：
- Vercel是否重新部署（环境变量修改后必须重新部署）
- 检查 `rateLimiter.js` 是否正确导入

### Q2: 监控邮件没有收到？
**A**:
- 检查 `MONITOR_SECRET_KEY` 是否正确
- 监控只在每周一运行（可在 `vercel.json` 修改）
- 需要配置邮件发送服务（`usage-monitor.js` 中TODO部分）

### Q3: 如何临时禁用速率限制？
**A**:
注释掉 `api/mapbox.js` 中的速率限制包装：
```javascript
// export default withRateLimit(mapboxRateLimiter)(async function handler(req, res) {
export default async function handler(req, res) {
```

---

## 📞 需要帮助？

如果遇到问题：
1. 查看 Vercel Function Logs
2. 检查浏览器控制台错误
3. 查看本文档的调试部分

---

**维护者**: IOPQWE51
**版本**: v1.0
**最后更新**: 2026-04-01
