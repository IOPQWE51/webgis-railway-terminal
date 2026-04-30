import { Redis } from '@upstash/redis';

const DB_KEYS = {
  global: 'earth_terminal_global_points',
  dark2d: 'earth_terminal_dark2d_points',
};

export default async function handler(req, res) {
  try {
    const redis = Redis.fromEnv();
    const scope = req.query?.scope === 'dark2d' ? 'dark2d' : 'global';
    const dbKey = DB_KEYS[scope];

    if (req.method === 'GET') {
      const points = await redis.get(dbKey) || [];
      return res.status(200).json({ source: 'cloud', scope, data: points });
    }

    if (req.method === 'POST') {
      const newPoints = req.body;

      if (!Array.isArray(newPoints)) {
        return res.status(400).json({ error: '数据格式错误' });
      }

      await redis.set(dbKey, newPoints);
      return res.status(200).json({ success: true, scope, count: newPoints.length });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('云端同步故障:', error.message);
    return res.status(500).json({ error: '云端同步服务暂不可用' });
  }
}
