// api/bangumi.js
// Bangumi 番剧搜索代理（免钥上游；规范 User-Agent 是 bgm.tv API 的礼仪硬要求）
// 注意：api.bgm.tv 在部分国内网络不可达，本地 dev 报"上游连接失败"属预期，生产 Vercel 正常。
// #11 收编 provider 三件套：KV 缓存（1h，关键词维度）+ 8s 超时 + 过期缓存兜底。

import { withRateLimit } from './_lib/rateLimiter.js';
import { callProvider } from './_lib/provider.js';
import { compactSearchResults } from '../src/utils/pilgrimageData.js';

const UA = 'EarthTerminal/5.3.1 (https://github.com/IOPQWE51/webgis-railway-terminal)';

const bangumiProvider = {
  name: 'bangumi',
  cache: { ttl: 3600 }, // 同一关键词 1h（番剧搜索结果基本不变）
  request: async ({ q }) => ({
    url: 'https://api.bgm.tv/v0/search/subjects?limit=12',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    init: {
      method: 'POST',
      // 契约见 bangumi/server handle.go：keyword 单数、type 为整数数组；limit=12 与前端卡片上限对齐（服务端默认仅返回 10）
      body: JSON.stringify({ keyword: q, filter: { type: [2] } }),
    },
  }),
  // 极限瘦身：原始响应数百 KB → 12 张卡片所需字段
  map: (raw) => ({ list: compactSearchResults(raw) }),
};

async function handleBangumiSearch(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const isProduction = process.env.VERCEL_ENV === 'production';
  res.setHeader('Cache-Control', isProduction
    ? 'public, s-maxage=3600, stale-while-revalidate=86400'
    : 'no-cache');

  const q = String(req.query.q || '').trim();
  if (q.length < 1 || q.length > 60) {
    return res.status(400).json({ error: '参数非法：q 须为 1~60 字符的关键词' });
  }

  const result = await callProvider(bangumiProvider, { q });
  return res.status(result.status).json(result.json);
}

// 🛡️ 限流：搜索比 lite 略贵，仍是 general 档（60 次/分钟/IP）
export default withRateLimit('general')(handleBangumiSearch);
