// api/_lib/kv.js
// ☁️ Upstash Redis 进程内单例 —— provider 适配层与 points 端点共用连接
// env 探测：KV_REST_API_URL/TOKEN 缺失时返回 null，调用方静默降级为直连

import { Redis } from '@upstash/redis';

let _redis = null;
let _checked = false;

/** 进程内单例：serverless 实例存续期间复用同一连接 */
export function getKV() {
  if (_checked) return _redis;
  _checked = true;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    _redis = new Redis({ url, token });
  }
  return _redis;
}

/** KV 是否可用（探测不建连） */
export function kvAvailable() {
  return getKV() !== null;
}
