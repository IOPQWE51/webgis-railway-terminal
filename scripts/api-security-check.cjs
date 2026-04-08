// scripts/api-security-check.cjs
// 🛡️ API 安全检查工具

const fs = require('fs');
const path = require('path');

// 🚨 危险模式：不应该出现在前端代码中的 API Key 模式
const DANGEROUS_PATTERNS = [
  // Secret tokens (不应该在前端)
  { pattern: /sk\.eyJ1[\w-]+/g, name: 'Mapbox Secret Token', severity: 'HIGH' },
  { pattern: /AIza[A-Za-z0-9_-]{35}/g, name: 'Google Maps API Key', severity: 'MEDIUM' },

  // 具体的已泄露 Key（需要替换）
  { pattern: /AIzaSyAM_-jFNtzL35fAIIveC_qrvdcO8EnrcdQ/g, name: '⚠️ 硬编码 Google Maps Key', severity: 'CRITICAL' },
  { pattern: /f248f355671dcb0ffa5645c53823d4e5/g, name: '⚠️ 硬编码 OWM Key', severity: 'CRITICAL' },
];

// ✅ 忽略的模式（这些不是 API Key）
const IGNORE_PATTERNS = [
  /https:\/\/[a-f0-9]+@[a-z0-9\-]+\.ingest\.us\.sentry\.io\//g, // Sentry DSN
];

// ✅ 允许的文件（这些文件中的 API Key 是安全的）
const SAFE_FILES = [
  '.env',
  '.env.example',
  '.env.local',
  'node_modules',
  'dist',
  '.vercel',
  'api/', // Serverless 函数
];

// 🚫 需要检查的目录
const CHECK_DIRS = ['src', 'scripts'];

// 🎯 检查函数
function checkFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 移除忽略的内容
  IGNORE_PATTERNS.forEach(pattern => {
    content = content.replace(pattern, '');
  });

  const issues = [];

  DANGEROUS_PATTERNS.forEach(({ pattern, name, severity }) => {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        pattern: name,
        severity,
        count: matches.length,
        found: matches
      });
    }
  });

  return issues;
}

// 📁 递归扫描目录
function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过安全目录
      if (!SAFE_FILES.some(safe => filePath.includes(safe))) {
        scanDirectory(filePath, results);
      }
    } else if (file.match(/\.(js|jsx|ts|tsx|json)$/)) {
      // 检查源代码文件
      const issues = checkFile(filePath);
      if (issues.length > 0) {
        results.push({
          file: filePath,
          issues
        });
      }
    }
  });

  return results;
}

// 🚀 执行检查
console.log('🛡️  API 安全检查开始...\n');

const allResults = [];
CHECK_DIRS.forEach(dir => {
  if (fs.existsSync(dir)) {
    const results = scanDirectory(dir);
    allResults.push(...results);
  }
});

// 📊 生成报告
if (allResults.length === 0) {
  console.log('✅ 未发现安全问题！');
  console.log('\n💡 建议：');
  console.log('  1. 定期运行此检查');
  console.log('  2. 在 Google Cloud Console 设置 API Key 限制');
  console.log('  3. 监控 API 使用量');
} else {
  console.log(`⚠️  发现 ${allResults.length} 个文件可能存在安全问题：\n`);

  allResults.forEach(({ file, issues }) => {
    console.log(`📁 ${file}`);
    issues.forEach(({ pattern, severity, count }) => {
      const emoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡';
      console.log(`  ${emoji} ${pattern} (${severity} - 发现 ${count} 处)`);
    });
    console.log('');
  });

  console.log('📝 修复建议：');
  console.log('  1. 将硬编码的 API Key 移到 .env 文件');
  console.log('  2. 使用 import.meta.env.VITE_* 读取');
  console.log('  3. 在 API Provider 控制台设置限制');
  console.log('  4. 轮换已泄露的 API Key');
}

// 📈 统计信息
const totalIssues = allResults.reduce((sum, { issues }) => sum + issues.length, 0);
const criticalIssues = allResults.flatMap(({ issues }) => issues)
  .filter(issue => issue.severity === 'CRITICAL').length;

console.log(`\n📊 统计: 共发现 ${totalIssues} 个问题，其中 ${criticalIssues} 个严重`);

// 🚪 退出码
process.exit(criticalIssues > 0 ? 1 : 0);
