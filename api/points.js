// 文件路径: /api/points.js
import { kv } from '@vercel/kv';

const DB_KEY = 'earth_terminal_global_points';

export default async function handler(req, res) {
  try {
    // 🟢 侦察模式：拉取云端点位
    if (req.method === 'GET') {
      const points = await kv.get(DB_KEY) || [];
      return res.status(200).json({ source: 'cloud', data: points });
    }

    // 🔵 锁定模式：推送最新点位
    if (req.method === 'POST') {
      const newPoints = req.body;
      
      if (!Array.isArray(newPoints)) {
        return res.status(400).json({ error: '数据格式错误' });
      }

      await kv.set(DB_KEY, newPoints);
      return res.status(200).json({ success: true, count: newPoints.length });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
    
  } catch (error) {
    console.error('云端同步故障:', error);
    return res.status(500).json({ error: error.message });
  }
}