// api/anitabi.js
// anitabi 圣地巡礼数据代理（免钥上游，CC BY-NC-SA 4.0 —— 署名条在前端 PilgrimageRadar 页尾）
// 为什么走代理：不赌上游 CORS 策略；缓存层吸收重复请求；限流防刷。
// #11 收编 provider 三件套：KV 缓存（1h）+ 8s 超时 + 过期缓存兜底。
// 外部契约不变：404 语义（番剧无数据）与响应结构原样。

import { withRateLimit } from './_lib/rateLimiter.js';
import { callProvider } from './_lib/provider.js';

const UPSTREAM = 'https://api.anitabi.cn';
const UA = 'EarthTerminal/5.3.1 (https://github.com/IOPQWE51/webgis-railway-terminal)';

const anitabiProvider = {
  name: 'anitabi',
  // 巡礼点位数据也会被官方更新（图片补充等），1h KV 缓存 + 头部 SWR 组合足够
  cache: { ttl: 3600 },
  request: async ({ type, id }) => {
    const url = type === 'bangumi'
      ? `${UPSTREAM}/bangumi/${id}/lite`
      : `${UPSTREAM}/bangumi/${id}/points/detail?haveImage=true`;
    return { url, headers: { 'User-Agent': UA } };
  },
  map: (raw) => raw, // anitabi 响应已按 lite/detail 规格瘦身，透传
  statusMap: { 404: 404 }, // 番剧无巡礼地图 → 前端渲染"暂无巡礼数据"空态
};

async function handleAnitabi(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 边缘缓存头与 KV 缓存互补：边缘 SWR 兜区域聚合，KV 兜边缘失效窗口
  const isProduction = process.env.VERCEL_ENV === 'production';
  res.setHeader('Cache-Control', isProduction
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'no-cache');

  const { type, id } = req.query;
  const numericId = Number(id);
  if ((type !== 'bangumi' && type !== 'points') || !Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ error: '参数非法：type 须为 bangumi|points，id 须为正整数' });
  }

  const result = await callProvider(anitabiProvider, { type, id: numericId });
  return res.status(result.status).json(result.json);
}

// 🛡️ 限流：与 weather/elevation 同级（60 次/分钟/IP），边缘缓存先行吸收
export default withRateLimit('general')(handleAnitabi);
