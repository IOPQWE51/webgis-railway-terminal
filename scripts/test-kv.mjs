// 测试 Vercel KV（Upstash Redis）连接
// 使用: node scripts/test-kv.mjs
//
// ⚠️ 本脚本是 CLI 工具，不是 serverless 函数！
// 它原本放在 api/ 目录，会被 Vercel 当成线上端点部署，
// 且 import 时就会执行写入逻辑 —— 已于 2026-08 审查后迁出到 scripts/。
//
// 同时把依赖从未安装的 @vercel/kv 换成项目实际使用的 @upstash/redis，
// 环境变量不变：KV_REST_API_URL / KV_REST_API_TOKEN

import 'dotenv/config';
import { Redis } from '@upstash/redis';

const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

if (!kvUrl || !kvToken) {
  console.error('❌ 缺少 KV_REST_API_URL / KV_REST_API_TOKEN 环境变量（可配置在 .env）');
  process.exit(1);
}

const kv = new Redis({ url: kvUrl, token: kvToken });

async function testConnection() {
  console.log('🔗 测试 Upstash Redis 连接...\n');

  try {
    // 测试写入
    console.log('1️⃣ 测试写入...');
    await kv.set('test_key', { message: 'Hello from Earth Terminal!', timestamp: Date.now() });
    console.log('   ✅ 写入成功\n');

    // 测试读取
    console.log('2️⃣ 测试读取...');
    const data = await kv.get('test_key');
    console.log('   ✅ 读取成功:', data);
    console.log('');

    // 清理测试数据（不再触碰生产点位 key！）
    console.log('3️⃣ 清理测试数据...');
    await kv.del('test_key');
    console.log('   ✅ 清理完成\n');

    console.log('🎉 所有测试通过！KV 连接正常。');
    return true;
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('\n可能的原因:');
    console.error('  1. KV_REST_API_URL / KV_REST_API_TOKEN 未配置或已过期');
    console.error('  2. Upstash 数据库未创建');
    return false;
  }
}

testConnection().then((success) => {
  process.exit(success ? 0 : 1);
});
