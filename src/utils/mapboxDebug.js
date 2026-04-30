// src/utils/mapboxDebug.js
// 🔍 Mapbox 诊断工具

/**
 * 检查 Mapbox 配置是否正确
 */
export const checkMapboxConfig = () => {
  console.log('🔍 Mapbox 配置诊断');
  console.log('================');

  // 检查 Token
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  console.log('🔑 Token 状态:', token ? '已设置' : '❌ 未设置');
  if (token) {
    console.log('🔑 Token 类型:', token.startsWith('pk.') ? '✅ Public Token' : '⚠️ 可能不是 Public Token');
  }

  // 检查 mapbox-gl 是否加载
  console.log('📦 mapbox-gl:', typeof mapboxgl !== 'undefined' ? '✅ 已加载' : '❌ 未加载');
  if (typeof mapboxgl !== 'undefined') {
    console.log('📦 mapboxgl.version:', mapboxgl.version);
  }

  return {
    token: !!token,
    tokenValid: token && token.startsWith('pk.'),
    mapboxgl: typeof mapboxgl !== 'undefined'
  };
};

/**
 * 测试 Mapbox 样式 URL
 */
export const testStyleUrl = async (styleUrl) => {
  console.log('🎨 测试样式 URL:', styleUrl);

  try {
    // 尝试获取样式信息
    const response = await fetch(`https://api.mapbox.com/styles/v1/${styleUrl.split('/').pop()}?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 样式有效:', data.name || data);
      return true;
    } else {
      console.error('❌ 样式无效:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ 样式测试失败:', error);
    return false;
  }
};

/**
 * 在控制台输出诊断信息
 */
export const runDiagnostics = async () => {
  console.log('🚀 Mapbox 诊断工具');
  console.log('================\n');

  const config = checkMapboxConfig();

  if (!config.token) {
    console.error('❌ 致命错误: Mapbox Token 未设置!');
    console.log('请在 .env 文件中设置 VITE_MAPBOX_ACCESS_TOKEN');
    return;
  }

  if (!config.tokenValid) {
    console.warn('⚠️ 警告: Token 可能不是 Public Token');
    console.log('Public Token 应该以 "pk." 开头');
  }

  if (!config.mapboxgl) {
    console.error('❌ 致命错误: mapbox-gl 未加载!');
    return;
  }

  // 测试默认样式
  console.log('\n🎨 测试默认样式...');
  await testStyleUrl('mapbox://styles/mapbox/streets-v12');

  // 测试战术样式
  console.log('\n🎨 测试战术样式...');
  await testStyleUrl('mapbox://styles/iopqwe51/cmnoq0jyc008501sg88f6en5z');

  console.log('\n✅ 诊断完成!');
};

// 自动运行诊断（在开发环境）
if (import.meta.env.DEV) {
  window.__mapboxDiagnostics = {
    checkConfig: checkMapboxConfig,
    testStyle: testStyleUrl,
    runDiagnostics: runDiagnostics
  };
}
