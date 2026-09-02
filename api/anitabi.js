// api/anitabi.js
// anitabi 圣地巡礼数据代理（免钥上游，CC BY-NC-SA 4.0 —— 署名条在前端 PilgrimageRadar 页尾）
// 为什么走代理：不赌上游 CORS 策略；边缘缓存 24h 吸收重复请求；限流防刷。

import { withRateLimit } from './rateLimiter.js';

const UPSTREAM = 'https://api.anitabi.cn';
const UA = 'EarthTerminal/5.3.1 (https://github.com/IOPQWE51/webgis-railway-terminal)';

async function handleAnitabi(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 巡礼数据低频变动：生产 24h 边缘缓存 + 7 天 SWR
  const isProduction = process.env.VERCEL_ENV === 'production';
  res.setHeader('Cache-Control', isProduction
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'no-cache');

  const { type, id } = req.query;
  const numericId = Number(id);
  if ((type !== 'bangumi' && type !== 'points') || !Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ error: '参数非法：type 须为 bangumi|points，id 须为正整数' });
  }

  const upstreamUrl = type === 'bangumi'
    ? `${UPSTREAM}/bangumi/${numericId}/lite`
    : `${UPSTREAM}/bangumi/${numericId}/points/detail?haveImage=true`;

  try {
    const upstream = await fetch(upstreamUrl, { headers: { 'User-Agent': UA } });
    if (upstream.status === 404) {
      // 该番剧在 anitabi 无巡礼地图（前端渲染"暂无巡礼数据"空态）
      return res.status(404).json({ error: '该作品暂无巡礼数据' });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: 'anitabi 上游服务异常' });
    }
    return res.status(200).json(await upstream.json());
  } catch (err) {
    console.error('❌ anitabi 上游连接失败:', err);
    return res.status(502).json({ error: 'anitabi 上游连接失败' });
  }
}

// 🛡️ 限流：与 weather/elevation 同级（60 次/分钟/IP），边缘缓存先行吸收
export default withRateLimit('general')(handleAnitabi);
