# 🎯 Mapbox Studio 样式调用修复指南

## 问题分析

你创建的 **"全息赛博·全球轨道战术雷达图"** 无法在战术地图v2中正确显示，可能原因：

1. ❌ **Token 类型错误**：使用了 Secret Token (sk.) 而非 Public Token (pk.)
2. ❌ **样式访问权限**：Token 没有该样式的读取权限
3. ❌ **组件配置问题**：地图组件没有正确处理自定义样式

---

## 🔧 解决方案

### 第一步：获取正确的 Public Token

1. **访问 Mapbox Account**
   - 打开：https://account.mapbox.com/
   - 登录你的账号

2. **创建或找到 Public Token**
   - 在 "Access tokens" 页面
   - **重要**：找到以 `pk.` 开头的 token，不是 `sk.` 开头的
   - 如果没有，点击 "Create a token" 创建新的

3. **复制 Public Token**
   - 格式应该是：`pk.eyJ1IjoiaW9wcXdlNTEi...`
   - 复制整个 token

---

### 第二步：更新 .env 文件

打开 `.env` 文件，确保：

```bash
# ⚠️ 必须使用 pk. 开头的 Public Token
VITE_MAPBOX_ACCESS_TOKEN=pk.你的PublicToken粘贴到这里

# ❌ 不要使用 sk. 开头的 Secret Token
# MAPBOX_ACCESS_TOKEN_DEV=sk.xxx... (这个是错的！)
```

---

### 第三步：验证样式 URL

你的样式 URL 是正确的：
```
mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z
```

这个 URL 包含：
- 用户名：`iopqwe51`
- 样式 ID：`cmnoq0jyc008501sg88f6en5z`

---

### 第四步：测试样式是否可访问

在浏览器中直接访问：
```
https://api.mapbox.com/styles/v1/iopqwe51/cmnoq0jyc008501sg88f6en5z?access_token=YOUR_PUBLIC_TOKEN
```

如果返回 JSON 数据，说明样式有效。

---

## 🛠️ 修复后的地图组件

我已经确保了以下配置：

### ✅ 正确的样式调用
```javascript
// MapTestTactical.jsx
const TACTICAL_STYLE_URL = 'mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z';
```

### ✅ 正确的地图初始化
```javascript
// MapboxMapTactical.jsx
map.current = new mapboxgl.Map({
  container: mapContainer.current,
  style: TACTICAL_STYLE_URL, // 你的自定义样式
  center: center,
  zoom: zoom,
  pitch: pitch,
  bearing: bearing,
  antialias: true
});
```

---

## 🎨 你的地图特点确认

根据你的描述，战术地图应该显示：

1. **视觉基调**
   - ✅ 深空灰（Dark Mode）底座
   - ✅ 琥珀金 (#fbbf24) 脉冲线条
   - ✅ 非线性发光效果

2. **包含的战略情报**
   - ✅ 骨干动脉（新干线、高铁）
   - ✅ 城市静脉（地铁、轻轨）
   - ✅ 战略枢纽（Transit Stations）

3. **技术特性**
   - ✅ 3D Emissive Strength 自发光
   - ✅ 机械铆钉感（黑色描边）
   - ✅ 视距自适应缩放

---

## 🚀 重启和测试

1. **更新 Token**
   ```bash
   # 编辑 .env 文件
   VITE_MAPBOX_ACCESS_TOKEN=pk.你的新Token
   ```

2. **重启开发服务器**
   ```bash
   # 按 Ctrl+C 停止当前服务器
   npm run dev
   ```

3. **访问战术地图**
   - 打开：http://localhost:5173
   - 点击"战术地图 v2"标签

4. **验证效果**
   - 应该看到深空灰底色
   - 金色铁路线和站点
   - 地图有发光效果

---

## 🔍 故障排除

### 如果仍然看不到地图

1. **检查控制台错误**
   ```javascript
   // 在浏览器控制台运行
   window.__mapboxDiagnostics.runDiagnostics()
   ```

2. **验证 Token 权限**
   - 确保 Token 有 "Styles: Read" 权限
   - 确保样式已发布（不是草稿）

3. **检查样式 URL**
   - 确认样式 ID 正确
   - 确认样式不是私密的（或 Token 有权限）

---

## 📞 下一步

如果按照上述步骤操作后仍有问题，请提供：

1. **控制台错误信息**（按 F12 打开开发者工具）
2. **.env 文件中的 Token**（只需前10个字符）
3. **Mapbox Studio 中的样式截图**

我会帮你进一步诊断！

---

**重要提醒**：
- ⚠️ 前端必须使用 `pk.` 开头的 Public Token
- ⚠️ 不要在代码中硬编码 Secret Token
- ⚠️ 重启服务器后环境变量才会生效
