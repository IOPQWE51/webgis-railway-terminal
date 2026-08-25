// api/validation.js
// 🛡️ Serverless 端点的服务端输入校验与通用工具。
// 全部为纯函数，配套测试：tests/api-validation.test.js
//
// 设计约定：
// - 校验失败时返回整体拒绝（{ ok:false, error }），不做静默修补，
//   避免脏数据半进半出污染云端库。
// - getClientIp 取 X-Forwarded-For 链的最后一跳：
//   首跳可由客户端任意伪造，Vercel 边缘会把真实连接 IP 追加在链尾。

export const MAX_POINTS = 2000;
const MAX_ID_LEN = 64;
const MAX_NAME_LEN = 120;
const MAX_CATEGORY_LEN = 32;
const MAX_SOURCE_LEN = 32;

/** 数值或数字字符串 → 有限数值；否则 NaN */
function asFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/** 合法字符串（含长度上限）→ 原样；否则 null。空串由调用方决定去留。 */
function asBoundedString(value, maxLen) {
  if (typeof value !== 'string') return null;
  return value.length <= maxLen ? value : null;
}

/**
 * 校验前端推送的整包点位数组。
 * @param {*} body - 期望为点位对象数组
 * @returns {{ok:true, points:Array}|{ok:false, error:string}}
 */
export function validatePointsPayload(body) {
  if (!Array.isArray(body)) {
    return { ok: false, error: '数据格式错误：请求体必须是点位数组' };
  }
  if (body.length > MAX_POINTS) {
    return { ok: false, error: `点位数量超出上限（最多 ${MAX_POINTS} 条）` };
  }

  const points = [];
  for (let i = 0; i < body.length; i++) {
    const raw = body[i];
    const at = `第 ${i + 1} 个点位`;

    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: `${at}不是合法对象` };
    }

    // 文本字段：白名单 + 类型 + 长度上限；id/name/category 必填，source 允许空串
    const id = asBoundedString(raw.id, MAX_ID_LEN);
    const name = asBoundedString(raw.name, MAX_NAME_LEN);
    const category = asBoundedString(raw.category, MAX_CATEGORY_LEN);
    const source = asBoundedString(raw.source, MAX_SOURCE_LEN);
    if (!id || !name || !category || source === null) {
      return {
        ok: false,
        error: `${at}文本字段缺失或超长（id≤64、name≤120、category≤32 必填，source≤32 可空）`,
      };
    }

    // 坐标字段：强制转数值并做地理范围校验
    const lat = asFiniteNumber(raw.lat);
    const lon = asFiniteNumber(raw.lon);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      return { ok: false, error: `${at}纬度不合法（需为 -90 ~ 90 的数值）` };
    }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) {
      return { ok: false, error: `${at}经度不合法（需为 -180 ~ 180 的数值）` };
    }

    // 只输出白名单字段，多余字段（如 isAdmin）在此被剥离
    points.push({ id, name, lat, lon, category, source });
  }

  return { ok: true, points };
}

/**
 * 从请求头提取客户端真实 IP。
 * @param {Record<string,string>} headers - 已小写化的请求头对象（req.headers）
 * @returns {string} IP 或 'unknown'
 */
export function getClientIp(headers = {}) {
  const xff = headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim() !== '') {
    const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim() !== '') {
    return realIp.trim();
  }
  return 'unknown';
}

/**
 * 校验 lat/lon 查询参数。
 * @param {Record<string,*>} query - req.query
 * @returns {{lat:number, lon:number}|null} 非法或越界时返回 null
 */
export function parseCoords(query = {}) {
  const lat = asFiniteNumber(query.lat);
  const lon = asFiniteNumber(query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * 用量监控端点的密钥校验。
 * 服务端未配置密钥时一律拒绝 —— 绝不回退到任何硬编码默认值。
 */
export function isMonitorAuthorized(queryKey, envKey) {
  if (typeof envKey !== 'string' || envKey.length === 0) return false;
  return queryKey === envKey;
}
