# 🚀 功能1：矢量着色器定制 - 快速开始

## ✅ 已完成的工作

### 1. 代码实现（完成✅）

- ✅ 创建了 [MapboxMap.jsx](src/components/MapboxMap.jsx) 组件
- ✅ 创建了 [MapTest.jsx](src/pages/MapTest.jsx) 测试页面
- ✅ 安装了 mapbox-gl 依赖
- ✅ 支持4种地图样式切换
- ✅ 支持添加自定义标记
- ✅ 支持点击地图添加标记

### 2. 文档（完成✅）

- ✅ [Mapbox Studio 指南](docs/MAPBOX_STUDIO_GUIDE.md) - 如何创建自定义样式
- ✅ [前端集成指南](docs/MAPBOX_FRONTEND_INTEGRATION.md) - 代码使用说明
- ✅ [使用示例](docs/MAPBOX_USAGE_EXAMPLE.md) - 各种使用场景

---

## 🎯 现在你需要做的

### 方案A：使用默认样式（5分钟）

**可以直接测试，无需 Mapbox Studio！**

1. **启动开发服务器**：
```bash
npm run dev
```

2. **访问测试页面**：
```
http://localhost:3000/map-test
```

3. **测试功能**：
- ✅ 切换城市（东京/大阪/纽约）
- ✅ 切换样式（默认/暗色/卫星/明亮）
- ✅ 点击地图添加标记
- ✅ 查看预设的铁路站点标记

**预期效果**：地图正常显示，可以交互 ✅

---

### 方案B：创建霓虹金样式（30-45分钟）⭐

**按照 [Mapbox Studio 指南](docs/MAPBOX_STUDIO_GUIDE.md) 操作**：

#### 步骤1：打开 Mapbox Studio
```
https://studio.mapbox.com/
```

#### 步骤2：创建新样式
- 选择 "Mapbox Streets" 作为基础
- 点击 "Use this template"

#### 步骤3：定制铁路样式
1. 搜索图层：`rail`
2. 选择 `road rail` 图层
3. 修改样式：
   - Line Color: `#fbbf24`（琥珀金）
   - Line Width: `2.0`
   - Line Opacity: `0.9`
4. 重复其他铁路图层：`road rail narrow`, `bridge rail`, `tunnel rail`

#### 步骤4：调整水体颜色（可选）
1. 搜索图层：`water`
2. Color: `#1e293b`（深空灰）

#### 步骤5：发布样式
1. 点击右上角 "Save"
2. 输入名称：`Tactical Terminal - Neon Amber Gold`
3. 点击 "Publish"
4. **复制 Style URL**（格式：`mapbox://styles/iopqwe51/xxxxxxxx`）

#### 步骤6：更新代码
在 [src/pages/MapTest.jsx](src/pages/MapTest.jsx) 中：

```javascript
const mapStyles = {
  default: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  light: 'mapbox://styles/mapbox/light-v11',
  neon: 'mapbox://styles/iopqwe51/xxxxxxxx' // 🌟 粘贴你的 Style URL
};
```

然后刷新页面，点击 "霓虹" 按钮！

---

## 🧪 测试清单

### 基础测试（方案A）

- [ ] 地图正常加载
- [ ] 可以切换城市
- [ ] 可以切换样式
- [ ] 可以点击地图添加标记
- [ ] 可以看到预设的标记点
- [ ] 标记有脉冲动画效果

### 霓虹金样式测试（方案B）

- [ ] 铁路显示为琥珀金色
- [ ] 铁路比默认样式更宽
- [ ] 水体显示为深空灰色
- [ ] 车站标记突出显示
- [ ] 整体视觉风格统一
- [ ] 没有明显的性能问题

---

## 🎨 效果预览

### 默认样式（当前）
- 铁路：浅灰色，不显眼
- 水体：蓝色
- 视觉：普通地图

### 霓虹金样式（创建后）
- 铁路：**琥珀金色 (#fbbf24)，突出显示**
- 水体：**深空灰 (#1e293b)**
- 视觉：**战术全息终端风格** ✨

---

## 📝 路由配置（如果需要）

如果你的项目使用路由器，需要添加测试页面路由：

### React Router 示例

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MapTest from '@/pages/MapTest';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/map-test" element={<MapTest />} />
        {/* 其他路由 */}
      </Routes>
    </BrowserRouter>
  );
}
```

### 或者直接在浏览器访问

如果使用 Vite，可以直接访问文件路径：
```
http://localhost:3000/src/pages/MapTest.jsx
```

或者临时修改 [main.jsx](src/main.jsx)：

```jsx
import MapTest from './pages/MapTest.jsx';

createRoot(document.getElementById('root')).render(
  <MapTest />
);
```

---

## 🐛 常见问题

### Q1: 地图不显示？

**检查**：
1. 浏览器控制台是否有错误
2. `VITE_MAPBOX_ACCESS_TOKEN` 是否设置
3. 网络连接是否正常

**解决**：
```bash
# 检查环境变量
echo $VITE_MAPBOX_ACCESS_TOKEN

# 如果为空，在 .env 文件中添加：
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiaW9wcXdlNTEi...
```

### Q2: Token 权限不足？

**错误**：`403 Forbidden`

**解决**：
- 确认 Token 有 `styles:tiles` 和 `styles:read` 权限
- 确认 Token 的 URL 限制包含 `localhost`

### Q3: 霓虹金样式不生效？

**检查**：
1. Style URL 是否正确
2. 样式是否在 Mapbox Studio 发布成功
3. 清除浏览器缓存

---

## 📊 性能检查

### 查看地图加载性能

打开浏览器控制台 → Performance 标签：

1. 点击 "Record"
2. 刷新页面
3. 等待地图加载完成
4. 停止录制
5. 查看 Flame Graph

**预期**：
- 地图初始化：< 2秒
- 样式加载：< 1秒
- 标记渲染：< 500ms

---

## 🎯 下一步

完成功能1测试后：

1. ✅ 告诉我测试结果
2. ✅ 如果正常，我们继续实现功能2（三维地形）
3. ✅ 如果有问题，我会帮你调试

---

**预计测试时间**：
- 方案A（默认样式）：5分钟
- 方案B（霓虹金样式）：30-45分钟

**准备好了吗？现在就可以测试！** 🚀

---

**维护者**: IOPQWE51
**版本**: v1.0
**最后更新**: 2026-04-07
