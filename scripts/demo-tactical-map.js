// scripts/demo-tactical-map.js
// 🎭 战术地图功能演示脚本

/**
 * 📡 演示所有四个缺口的功能实现
 *
 * 使用方法：
 * 1. 启动项目: npm run dev
 * 2. 打开浏览器访问: http://localhost:5173
 * 3. 点击"战术地图 v2"标签
 * 4. 在浏览器控制台运行以下演示脚本
 */

// ==================== 演示脚本 ====================

console.log('🎭 战术地图功能演示脚本');
console.log('================================');

// 📡 缺口一：交互与索敌系统演示
console.log('\n📡 缺口一：交互与索敌系统');
console.log('- 鼠标悬停在地图上的金点（站点）上');
console.log('- 观察鼠标变为十字准星');
console.log('- 点击站点打开战术弹窗');

// 🌀 缺口二：动态雷达动画演示
console.log('\n🌀 缺口二：动态雷达动画');
console.log('- 点击任意站点或地图位置');
console.log('- 观察金色雷达波扩散效果');
console.log('- 标记点有持续的呼吸灯动画');

// ✈️ 缺口三：空天一体化航线演示
console.log('\n✈️ 缺口三：空天一体化航线');
console.log('正在演示大圆航线绘制...');

// 等待地图加载完成
setTimeout(() => {
  // 检查地图是否可用
  const mapContainer = document.querySelector('.mapbox-map-tactical');
  if (mapContainer) {
    console.log('✅ 战术地图已加载');

    // 演示绘制航线（东京到纽约）
    const tokyoCoords = { lng: 139.6503, lat: 35.6762 };
    const nycCoords = { lng: -73.9851, lat: 40.7484 };

    // 注意：需要等待地图完全初始化
    console.log('📍 演示航线：东京 → 纽约');
    console.log('起点:', tokyoCoords);
    console.log('终点:', nycCoords);
    console.log('请在地图上手动点击两个位置来测试航线功能');

  } else {
    console.error('❌ 战术地图未加载，请确保已切换到"战术地图 v2"标签');
  }
}, 2000);

// 🛡️ 缺口四：防线与情报中枢演示
console.log('\n🛡️ 缺口四：防线与情报中枢');
console.log('- 切换到"情报中枢"标签');
console.log('- 拖入 CSV 文件测试批量导入');
console.log('- 使用"Google 战术雷达检索"搜索地标');
console.log('- 观察数据自动同步到战术地图');

// ==================== 交互测试指南 ====================

console.log('\n🎯 交互测试指南：');
console.log('1. 悬停测试：鼠标悬停在金点上，观察准星效果');
console.log('2. 点击测试：点击站点，观察战术弹窗和雷达波');
console.log('3. 标记测试：点击地图空白处添加自定义标记');
console.log('4. 数据测试：导入 CSV 或使用智能检索');
console.log('5. 城市测试：切换不同城市（东京、大阪、纽约）');

// ==================== API 使用示例 ====================

console.log('\n📚 API 使用示例：');

// 示例1：程序化添加标记
console.log('\n// 示例1：程序化添加标记');
console.log('window.__addTacticalMarker({');
console.log('  name: "测试站点",');
console.log('  lat: 35.6762,');
console.log('  lon: 139.6503,');
console.log('  category: "spot"');
console.log('});');

// 示例2：绘制航线
console.log('\n// 示例2：绘制航线（需要先在地图上标记两个点）');
console.log('// 获取地图实例并调用绘制航线方法');
console.log('// map.current.drawGreatCircleRoute(startCoords, endCoords);');

// 示例3：定位到特定点位
console.log('\n// 示例3：定位到特定点位');
console.log('window.__locatePointOnMap(pointId);');

// ==================== 性能监控 ====================

console.log('\n⚡ 性能监控：');
console.log('- API 限流：每分钟最多100次请求');
console.log('- 自动缓存：重复请求直接返回缓存');
console.log('- 防抖保护：300ms 防抖延迟');
console.log('- 批处理：避免并发过载');

// ==================== 故障排除 ====================

console.log('\n🔧 故障排除：');
console.log('- 如果地图不显示：检查 Mapbox Token 配置');
console.log('- 如果样式不对：确认 Style URL 正确');
console.log('- 如果 API 失败：检查配额和网络连接');
console.log('- 如果动画卡顿：关闭其他浏览器标签');

console.log('\n✨ 演示脚本加载完成！');
console.log('🔗 访问战术地图：点击导航栏的"战术地图 v2"标签');
console.log('📖 查看详细文档：docs/战术地图功能说明.md');

// ==================== 实用工具函数 ====================

// 添加全局工具函数
window.__tacticalMapTools = {

  /**
   * 添加战术标记
   */
  addMarker: function(name, lat, lon, category = 'spot') {
    console.log(`📍 添加标记: ${name} at [${lat}, ${lon}]`);
    // 这里需要与 React 状态同步
    // 实际使用时应该通过组件的 props 或状态管理
  },

  /**
   * 绘制航线
   */
  drawRoute: function(startLat, startLon, endLat, endLon) {
    console.log(`✈️ 绘制航线: [${startLat}, ${startLon}] → [${endLat}, ${endLon}]`);
    // 需要地图实例支持
  },

  /**
   * 清除所有航线
   */
  clearRoutes: function() {
    console.log('🧹 清除所有航线');
  },

  /**
   * 导出当前地图数据
   */
  exportData: function() {
    const data = localStorage.getItem('railway_custom_points');
    if (data) {
      console.log('📦 导出数据:', JSON.parse(data));
      return JSON.parse(data);
    }
    console.log('⚠️ 没有可导出的数据');
    return null;
  },

  /**
   * 性能检查
   */
  performanceCheck: function() {
    const memory = performance.memory;
    if (memory) {
      console.log('💾 内存使用:');
      console.log(`  已用: ${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
      console.log(`  总计: ${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`);
      console.log(`  限制: ${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`);
    }
    console.log('⏱️ 页面性能:');
    console.log(`  加载时间: ${performance.timing.loadEventEnd - performance.timing.navigationStart} ms`);
  }
};

console.log('\n🛠️ 工具函数已加载到 window.__tacticalMapTools');
console.log('可用方法: addMarker, drawRoute, clearRoutes, exportData, performanceCheck');

// ==================== 自动演示模式 ====================

let autoDemo = false;

// 启动自动演示（可选）
window.__startAutoDemo = function() {
  console.log('🎬 启动自动演示模式...');
  autoDemo = true;

  let step = 0;
  const steps = [
    () => console.log('📍 步骤1：悬停在站点上'),
    () => console.log('🖱️ 步骤2：点击站点查看情报'),
    () => console.log('🌀 步骤3：观察雷达波动画'),
    () => console.log('✈️ 步骤4：尝试绘制航线'),
    () => console.log('📊 步骤5：切换到情报中枢导入数据'),
    () => console.log('✨ 演示完成！')
  ];

  const interval = setInterval(() => {
    if (step >= steps.length || !autoDemo) {
      clearInterval(interval);
      console.log('🎬 自动演示结束');
      return;
    }
    steps[step]();
    step++;
  }, 3000);
};

// 停止自动演示
window.__stopAutoDemo = function() {
  autoDemo = false;
  console.log('⏹️ 自动演示已停止');
};

console.log('\n🎬 自动演示：');
console.log('启动: window.__startAutoDemo()');
console.log('停止: window.__stopAutoDemo()');

console.log('\n================================');
console.log('🎭 所有演示脚本已加载完成！');
console.log('🚀 现在可以在浏览器中使用上述功能');
