// 文件路径: /api/points.js
// ☁️ 战术点位云端同步网关

import { kv } from '@vercel/kv';

// 设定一个全局的数据键名
const DB_KEY = 'earth_terminal_global_points';

export default async function handler(req, res) {
  try {
    // 🟢 GET 请求：前端刚打开网页时，拉取云端所有点位
    if (req.method === 'GET') {
      // 从 KV 获取数据，如果没有则返回空数组
      const points = await kv.get(DB_KEY) || [];
      return res.status(200).json({ source: 'cloud', data: points });
    }

    // 🔵 POST 请求：前端新增/删除/修改点位后，将最新数组覆盖到云端
    if (req.method === 'POST') {
      const newPoints = req.body;
      
      // 验证数据格式
      if (!Array.isArray(newPoints)) {
        return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
      }

      // 写入云端数据库
      await kv.set(DB_KEY, newPoints);
      
      return res.status(200).json({ success: true, count: newPoints.length });
    }

    // 🔴 拒绝其他请求方法
    return res.status(405).json({ error: 'Method Not Allowed' });
    
  } catch (error) {
    console.error('Database Sync Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}