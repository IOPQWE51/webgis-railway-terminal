# 🚂 日本铁路地图系统 - 终端版

## 📁 项目结构

```
终端/
├── src/
│   ├── components/              # 组件目录
│   │   ├── index.js             # 组件统一导出
│   │   ├── MapEngine.jsx        # 地图渲染引擎
│   │   ├── DataCenter.jsx       # CSV 解析与管理
│   │   ├── ExchangeEngine.jsx   # 汇率引擎
│   │   └── RulesTab.jsx         # 规则展示
│   ├── config/                  # 配置文件目录
│   │   └── basePoints.js        # 基础坐标数据
│   ├── utils/                   # 工具函数目录（新增）
│   │   └── helpers.js           # 公共函数
│   ├── App.jsx                  # 主应用入口
│   ├── main.jsx                 # React 入口
│   └── index.css                # 全局样式
├── index.html                   # HTML 入口
├── package.json                 # 依赖配置
└── vite.config.js               # Vite 配置
```

---

## 🎯 设计原则

### 1. **高内聚低耦合**
- 每个组件独立负责单一功能领域
- 组件间通过清晰的 Props 接口通信
- 配置数据与业务逻辑分离

### 2. **关注点分离**
- **UI 层**: App.jsx - 负责整体布局和状态管理
- **业务层**: Components - 负责具体业务功能实现
- **数据层**: Config - 负责配置数据管理
- **服务层**: Utils - 负责通用工具函数

### 3. **渐进式重构**
- 小步拆分，逐步优化
- 避免一次性大规模重构
- 保持代码可维护性

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.0 | UI 框架 |
| Vite | 8.0.0-beta.13 | 构建工具 |
| Tailwind CSS | 4.2.1 | CSS 框架 |
| Lucide React | 0.577.0 | 图标库 |

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd 终端
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 访问应用

打开浏览器访问：
```
http://localhost:5173/
```

---

## 📝 待办事项

### 第一阶段：基础框架 ✅
- [x] 创建项目结构
- [x] 创建空文件
- [x] 配置 Vite 和 Tailwind
- [ ] 填充组件代码

### 第二阶段：核心功能 ⏳
- [ ] 实现 MapEngine 地图引擎
- [ ] 实现 DataCenter 数据中心
- [ ] 实现 ExchangeEngine 汇率引擎
- [ ] 实现 RulesTab 规则展示

### 第三阶段：优化改进 🔮
- [ ] 提取工具函数到 utils/helpers.js
- [ ] 添加错误边界
- [ ] 性能优化
- [ ] 单元测试

---

## 🎖️ 下一步行动

### 立即执行：

1. **进入项目目录**
   ```bash
   cd 终端
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **验证页面显示**
   - 应该看到 React 默认页面
   - 不再是白屏！

---

## 💡 为什么这样组织？

### 问题解决思路：

**原来的问题：**
```
❌ 白屏
❌ React 未加载
❌ Root 元素不存在
```

**新的结构：**
```
✅ 清晰的文件组织
✅ 职责分离
✅ 易于维护
✅ 渐进式开发
```

---

## 📞 获取帮助

如果遇到问题：

1. 检查 Node.js 版本（需要 18+）
2. 清除缓存：`npm cache clean --force`
3. 重新安装：`rm -rf node_modules && npm install`
4. 查看控制台错误信息

---

**创建时间**: 2026-03-12  
**项目状态**: 🆕 新建完成，等待填充代码  
**下一步**: 安装依赖并启动
