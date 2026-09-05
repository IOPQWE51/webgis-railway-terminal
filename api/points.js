// api/points.js
// ☁️ 点位云端同步端点（Upstash Redis / Vercel KV）
//
// 安全模型（2026-08 审查加固）：
// - GET 保持公开读取；
// - POST 开放写入，但必须通过 validatePointsPayload 硬校验：
//   字段白名单、类型与长度上限、坐标范围、总量上限（MAX_POINTS），
//   多余字段一律剥离，防止脏数据/注入载荷进入云端库；
// - 读写分别限流：读走 general（60/min），写走 pointsWrite（30/min），
//   IP 取 XFF 链最后一跳（首跳可伪造）；
// - Redis 客户端进程内单例复用，避免每次请求重建连接；
// - 2026-09 起按用户隔离：读写在 et_session 会话之下进行（points:<username>），
//   匿名请求一律 401；旧全局池由 api/auth.js 注册认领机制一次性迁移。

import { Redis } from '@upstash/redis';
import { withRateLimit } from './rateLimiter.js';
import { validatePointsPayload, MAX_POINTS } from './validation.js';
import { getSessionUsername } from './auth.js';

// 点位键按用户名隔离：主库 points:<u>，战术库 points:<u>:dark2d
export function pointsKeyFor(username, scope) {
  return scope === 'dark2d' ? `points:${username}:dark2d` : `points:${username}`;
}

const MAX_BODY_BYTES = 1_000_000; // 2000 条点位远小于此值；超出即视为滥用

// 进程内单例：serverless 实例存续期间复用同一连接
let _redis = null;
let _redisChecked = false;
function getRedis() {
  if (_redisChecked) return _redis;
  _redisChecked = true;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    _redis = new Redis({ url: kvUrl, token: kvToken });
  }
  return _redis;
}

async function readPoints(req, res) {
  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: 'KV 数据库未配置，请在 Vercel 控制台连接 KV 实例' });
  }
  const username = await getSessionUsername(req);
  if (!username) {
    return res.status(401).json({ error: '需要登录' });
  }
  const scope = req.query?.scope === 'dark2d' ? 'dark2d' : 'main';
  const points = (await redis.get(pointsKeyFor(username, scope))) || [];
  return res.status(200).json({ source: 'cloud', scope, data: points });
}

async function writePoints(req, res) {
  // 防御纵深：请求体大小硬上限（Vercel 本身也有 4.5MB 上限）
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: '请求体过大' });
  }

  const result = validatePointsPayload(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: 'KV 数据库未配置，请在 Vercel 控制台连接 KV 实例' });
  }

  const username = await getSessionUsername(req);
  if (!username) {
    return res.status(401).json({ error: '需要登录' });
  }
  const scope = req.query?.scope === 'dark2d' ? 'dark2d' : 'main';
  const dbKey = pointsKeyFor(username, scope);
  await redis.set(dbKey, result.points);
  return res.status(200).json({
    success: true,
    scope,
    count: result.points.length,
    limit: MAX_POINTS,
  });
}

const readHandler = withRateLimit('general')(readPoints);
const writeHandler = withRateLimit('pointsWrite')(writePoints);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await readHandler(req, res);
    if (req.method === 'POST') return await writeHandler(req, res);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    // 只记录服务端日志，不向客户端泄露内部错误细节
    console.error('云端同步故障:', error.message);
    return res.status(500).json({ error: '云端同步服务暂不可用' });
  }
}
