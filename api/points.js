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
// - Redis 客户端进程内单例复用，避免每次请求重建连接。

import { Redis } from '@upstash/redis';
import { withRateLimit } from './rateLimiter.js';
import { validatePointsPayload, MAX_POINTS } from './validation.js';

const DB_KEYS = {
  global: 'earth_terminal_global_points',
  dark2d: 'earth_terminal_dark2d_points',
};

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

function resolveDbKey(req) {
  const scope = req.query?.scope === 'dark2d' ? 'dark2d' : 'global';
  return { scope, dbKey: DB_KEYS[scope] };
}

async function readPoints(req, res) {
  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: 'KV 数据库未配置，请在 Vercel 控制台连接 KV 实例' });
  }
  const { scope, dbKey } = resolveDbKey(req);
  const points = (await redis.get(dbKey)) || [];
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

  const { scope, dbKey } = resolveDbKey(req);
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
