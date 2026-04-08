#!/usr/bin/env node
// scripts/security-check.cjs
// 🔒 安全检查脚本 - 检查密钥泄露风险

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const risks = [];

console.log('🔒 开始安全检查...\n');

// 1️⃣ 检查 .gitignore
console.log('📋 检查 .gitignore...');
const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf-8') : '';
if (gitignore.includes('.env')) {
  console.log('  ✅ .env 在 .gitignore 中');
} else {
  console.log('  ❌ .env 不在 .gitignore 中！');
  risks.push('.env 不在 .gitignore 中');
}

// 2️⃣ 检查 Git 历史中是否有 .env
console.log('\n📜 检查 Git 历史...');
try {
  const result = execSync('git log --all --full-history -- "**/.env" --oneline', {
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  if (result.trim()) {
    console.log('  ❌ Git 历史中发现 .env 文件！');
    console.log('  运行以下命令删除：');
    console.log('  git filter-branch --force --index-filter \\');
    console.log('    "git rm --cached --ignore-unmatch .env" \\');
    console.log('    --prune-empty --tag-name-filter cat -- --all');
    risks.push('Git 历史中有 .env 文件');
  } else {
    console.log('  ✅ Git 历史中没有 .env 文件');
  }
} catch (error) {
  console.log('  ✅ Git 历史中没有 .env 文件');
}

// 3️⃣ 检查是否有硬编码密钥
console.log('\n🔍 检查硬编码密钥...');
const keyPatterns = [
  'sk\\.eyJ1',  // Mapbox Secret Token
  'pk\\.eyJ1',  // Mapbox Public Token
  'AIzaSy',     // Google API Key
  'AKIA',       // AWS Access Key
  'xoxb',       // Slack Bot Token
  'ghp_',       // GitHub Personal Access Token
  'gho_',       // GitHub OAuth Token
  'ghu_',       // GitHub User Token
  'ghs_',       // GitHub Server Token
  'ghr_',       // GitHub Refresh Token
];

const searchDirs = ['src', 'api', 'lib'];
let foundKeys = false;

searchDirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;

  const files = getAllFiles(dir);
  files.forEach(file => {
    if (!file.match(/\.(js|jsx|ts|tsx|json)$/)) return;

    try {
      const content = fs.readFileSync(file, 'utf-8');

      keyPatterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'g');
        if (regex.test(content) && !file.includes('.env')) {
          if (!foundKeys) {
            console.log('  ❌ 发现硬编码密钥：');
            foundKeys = true;
          }
          console.log(`    📄 ${file}`);
          risks.push(`硬编码密钥在 ${file}`);
        }
      });
    } catch (error) {
      // 忽略无法读取的文件
    }
  });
});

if (!foundKeys) {
  console.log('  ✅ 没有发现硬编码密钥');
}

// 4️⃣ 检查 VITE_ 前缀的变量
console.log('\n🌐 检查前端环境变量...');
try {
  const envExample = fs.readFileSync('.env.example', 'utf-8');
  const viteVars = envExample.match(/^VITE_/gm);
  if (viteVars && viteVars.length > 0) {
    console.log(`  ⚠️  发现 ${viteVars.length} 个前端环境变量`);
    console.log('  💡 提示：这些变量会打包到浏览器代码中，用户可以查看');
  } else {
    console.log('  ✅ 没有前端环境变量');
  }
} catch (error) {
  console.log('  ⚠️  未找到 .env.example 文件');
}

// 5️⃣ 检查敏感文件
console.log('\n📁 检查敏感文件...');
const sensitiveFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'config.js',
  'credentials.json',
  'secrets.json',
];

sensitiveFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const inGitignore = gitignore.includes(file);
    if (!inGitignore) {
      console.log(`  ❌ ${file} 存在但不在 .gitignore 中！`);
      risks.push(`${file} 不在 .gitignore 中`);
    }
  }
});

if (risks.filter(r => r.includes('.gitignore')).length === 0) {
  console.log('  ✅ 所有敏感文件都已保护');
}

// 6️⃣ 总结
console.log('\n' + '='.repeat(50));
if (risks.length === 0) {
  console.log('✅ 安全检查通过！没有发现风险。');
} else {
  console.log(`⚠️  发现 ${risks.length} 个安全风险：`);
  risks.forEach((risk, i) => {
    console.log(`  ${i + 1}. ${risk}`);
  });
  console.log('\n建议立即修复这些问题！');
  process.exit(1);
}

// 辅助函数：递归获取所有文件
function getAllFiles(dirPath) {
  const files = [];
  try {
    const items = fs.readdirSync(dirPath);

    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    });
  } catch (error) {
    // 忽略无法访问的目录
  }

  return files;
}
