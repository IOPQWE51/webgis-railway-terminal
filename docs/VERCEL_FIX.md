# Vercel 部署修复指南

## 🔴 问题描述

**错误信息**：
```
Build Failed
The 'vercel.json' schema validation failed with the following message: env should be object
```

**原因**：`vercel.json` 中 `env` 字段的格式不正确（使用了数组而非对象）

---

## ✅ 修复步骤

### 1. 本地修复已完成
✅ `vercel.json` 已更新为正确格式：
```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

✅ 已提交并推送到 GitHub：
```
Commit: 69adeec
Message: fix: correct vercel.json schema
```

---

### 2. 在 Vercel 中配置环境变量 (必须步骤！)

#### 访问 Vercel 项目设置

1. 打开 [Vercel 仪表板](https://vercel.com/dashboard)
2. 找到你的项目 `webgis-railway-terminal`
3. 点击项目进入

#### 添加环境变量

4. 点击上方菜单栏中的 **Settings** (设置)

5. 在左侧菜单找到 **Environment Variables** (环境变量)

6. 点击 **Add New** (添加新的) 按钮

7. 添加以下两个变量：

**变量 1**：
```
Name: VITE_OWM_KEY
Value: f248f355671dcb0ffa5645c53823d4e5
Environments: Production, Preview, Development
```

**变量 2**：
```
Name: VITE_WEATHER_API_KEY
Value: 17c3bd708a6a428ba7e45904262703
Environments: Production, Preview, Development
```

8. 每个添加后点击 **Save** (保存)

> **提示**：确保为所有环境 (Production/Preview/Development) 都勾选开启

---

### 3. 重新部署

#### 方式 A：从 Vercel 仪表板重新部署

1. 返回 **Deployments** (部署) 标签
2. 点击最新部署 (你刚才失败的那个)
3. 点击右上角的 **Redeploy** (重新部署) 按钮
4. 选择 **Redeploy** 确认

#### 方式 B：通过 GitHub push 自动部署

```bash
# 在本地项目中做任意修改后：
git add .
git commit -m "trigger redeploy"
git push origin main

# Vercel 会自动检测到新的 push 并自动部署
```

---

## 📊 监控部署进度

1. 打开 [Vercel Deployments 页面](https://vercel.com/dashboard/deployments)
2. 实时查看部署状态：
   - 🔵 **Building** - 正在构建
   - 🟢 **Ready** - 部署成功
   - 🔴 **Error** - 部署失败

3. 点击部署项目查看日志：
   - **Logs** 标签 - 构建和部署日志
   - 如有错误会显示详细信息

---

## ✨ 部署成功的标志

✅ Status 显示 **Deployed**（绿色）
✅ 可以访问部署链接：
```
https://webgis-railway-terminal-*.vercel.app
```

✅ 地图应用正常加载
✅ 所有功能可用：搜索、地图、气象等

---

## 🐛 如果仍然失败

### 检查清单

- [ ] 环境变量是否已在 Vercel UI 中正确添加？
- [ ] 变量名是否完全匹配（大小写敏感）？
  - ✅ 正确：`VITE_OWM_KEY`
  - ❌ 错误：`vite_owm_key` 或 `VITE_OWM_key`
- [ ] 变量值是否为正确的 API Key？
- [ ] 是否至少选择了一个环境 (Production)?

### 查看详细错误

1. 点击失败的部署
2. 点击 **Logs** 标签
3. 滚动查看完整的错误信息

常见错误信息：
```
ENOENT: no such file or directory      # 文件缺失 - 检查 import 路径
SyntaxError                             # 代码语法错误 - 检查 JS/JSX
ENOMEM                                  # 内存不足 - 尝试 Redeploy
```

---

## 📝 完整清单

部署时确保已完成以下步骤：

- [x] `package.json` - Vite 版本已更新到 7.3.1
- [x] `.npmrc` - 已创建 (legacy-peer-deps=true)
- [x] `vercel.json` - 已修复为正确格式
- [ ] 环境变量 - **需要在 Vercel UI 中手动添加** ⚠️
- [x] 代码已推送 GitHub

---

## 🎯 成功后的下一步

部署成功后，每次代码更新只需：
```bash
git add .
git commit -m "your changes"
git push origin main
```

Vercel 会自动检测 GitHub 更新并部署！

---

**最后更新**：2026 年 3 月 27 日
