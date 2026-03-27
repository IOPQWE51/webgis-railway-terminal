# Vercel 部署指南

## 🚀 快速部署步骤

### 1️⃣ 准备本地环境
```bash
# 确保已提交所有更改
git add .
git commit -m "chore: fix Vite 7.3.1 compatibility for Vercel deployment"
git push origin main
```

### 2️⃣ Vercel 部署前检查清单
✅ `package.json` - 已更新 vite@^7.3.1  
✅ `.npmrc` - 已创建，配置 legacy-peer-deps  
✅ `vercel.json` - 已创建，指定构建配置  
✅ `.vercelignore` - 已创建，优化部署包大小  
✅ `.env` - 已配置环境变量  

### 3️⃣ 在 Vercel 上部署

#### 方案 A：通过 Vercel CLI (推荐)
```bash
# 全局安装 Vercel CLI
npm install -g vercel

# 在项目目录中部署
cd 'c:\Users\张\Desktop\github仓库\终端'
vercel

# 首次运行会提示输入：
# - Vercel 账户信息
# - 项目名称
# - 部署目录 (选择 dist)
```

#### 方案 B：连接 GitHub 到 Vercel (自动部署)
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账户登录
3. 导入项目：点击 "Add New Project"
4. 选择你的 GitHub 仓库 `终端`
5. 配置环境变量：
   - `VITE_OWM_KEY` = 你的 API Key
   - `VITE_WEATHER_API_KEY` = 你的 API Key
6. 点击 "Deploy"

### 4️⃣ 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```
VITE_OWM_KEY=f248f355671dcb0ffa5645c53823d4e5
VITE_WEATHER_API_KEY=17c3bd708a6a428ba7e45904262703
```

**注意**：不要将 `.env` 文件提交到 GitHub（已在 `.gitignore` 中）

### 5️⃣ 部署完成验证

✅ 部署成功标志：
- Vercel 显示绿色的 "Production" 状态
- 访问部署链接可以看到地图应用
- 控制台无错误信息

❌ 如果仍有错误，查看 Vercel 的"Logs"标签查看详细错误

---

## 🔧 如果仍然出现问题

### 问题：仍然显示 "peer vite" 错误
**解决**：
```bash
# 确保 .npmrc 文件存在且包含：
cat .npmrc
# 应显示：legacy-peer-deps=true

# 如果没有，手动创建：
echo "legacy-peer-deps=true" > .npmrc
```

### 问题：构建时超时或失败
**解决**：
```bash
# 1. 重建项目
vercel redeploy

# 2. 或者清除 Vercel 缓存
vercel rebuild

# 3. 或者从 Vercel 仪表板点击"Redeploy"按钮
```

### 问题：功能在部署版本中不可用
**检查清单**：
- [ ] 环境变量是否正确设置
- [ ] API 密钥是否有效且未过期
- [ ] 浏览器控制台中是否有 CORS 错误 (F12)
- [ ] OSM/WeatherAPI 是否可访问

---

## 📊 部署后的优化建议

### 1. 性能优化
- ✅ 已配置 Vite 生产构建
- ✅ 生产包大小：290.57 kB (gzip: 93.64 kB)
- 建议：启用 Vercel 的"Web Analytics"

### 2. CDN 缓存
Vercel 自动为以下资源启用 CDN 缓存：
- `/assets/*.js` - 365 天
- `/assets/*.css` - 365 天
- `/index.html` - 60 秒 (重新验证)

### 3. 自定义域名 (可选)
1. 在 Vercel 项目设置 → Domains
2. 添加你的自定义域名
3. 按说明配置 DNS 记录

---

## 📝 故障排查日志

如果部署失败，检查以下位置的日志：
- **Vercel 控制台**：https://vercel.com/dashboard → Projects → 本项目 → Deployments
- **本地构建日志**：运行 `npm run build` 查看详细错误
- **浏览器控制台**：在部署的应用中按 F12 查看客户端错误

---

## ✨ 后续更新流程

部署后，每次代码更新只需：
```bash
git add .
git commit -m "description of changes"
git push origin main
```

Vercel 将自动重新部署最新版本。

---

**最后更新**：2026 年 3 月 27 日  
**支持版本**：Vercel 推荐配置
