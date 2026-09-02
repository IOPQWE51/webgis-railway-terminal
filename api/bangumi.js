// api/bangumi.js
// Bangumi 番剧搜索代理（免钥上游；规范 User-Agent 是 bgm.tv API 的礼仪硬要求）
// 注意：api.bgm.tv 在部分国内网络不可达，本地 dev 报"上游连接失败"属预期，生产 Vercel 正常。

import { withRateLimit } from './rateLimiter.js';
import { compactSearchResults } from '../src/utils/pilgrimageData.js';

const UA = 'EarthTerminal/5.3.1 (https://github.com/IOPQWE51/webgis-railway-terminal)';

async function handleBangumiSearch(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 同一关键词 1 小时边缘缓存（番剧搜索结果基本不变）
  const isProduction = process.env.VERCEL_ENV === 'production';
  res.setHeader('Cache-Control', isProduction
    ? 'public, s-maxage=3600, stale-while-revalidate=86400'
    : 'no-cache');

  const q = String(req.query.q || '').trim();
  if (q.length < 1 || q.length > 60) {
    return res.status(400).json({ error: '参数非法：q 须为 1~60 字符的关键词' });
  }

  try {
    const upstream = await fetch('https://api.bgm.tv/v0/search/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ keywords: q, filter: { type: 2 } }), // type=2 动画
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Bangumi 上游服务异常' });
    }
    // 极限瘦身：原始响应数百 KB → 12 张卡片所需字段
    const raw = await upstream.json();
    return res.status(200).json({ list: compactSearchResults(raw) });
  } catch (err) {
    console.error('❌ Bangumi 上游连接失败:', err);
    return res.status(502).json({ error: 'Bangumi 上游连接失败（本地网络可能无法访问 bgm.tv，生产环境正常）' });
  }
}

// 🛡️ 限流：搜索比 lite 略贵，仍是 general 档（60 次/分钟/IP）
export default withRateLimit('general')(handleBangumiSearch);
