// src/utils/urlState.js
// 🔗 视角深链接：把地图视角编码进 URL 哈希，让"这个角度"可以复制粘贴分享。
//
// 格式: #lat=<纬度>&lon=<经度>&z=<缩放>&tab=<页签>
// 约定:
// - 坐标是成对的：纬纬度或经度任一缺失/越界，整对作废（半张地图没有意义）
// - tab 仅接受已知页签 id，未知值静默忽略
// - 序列化时坐标取 5 位小数（≈1 米精度）、缩放取整并夹取到 [0, 22]

const VALID_TABS = new Set(['map', 'data', 'rules', 'tools', 'sub-culture', 'aviation']);
const MAX_ZOOM = 22;

function toFiniteNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 解析 location.hash 为视角对象。
 * @param {string} hash - 形如 "#lat=..&lon=.." 的哈希串（可为空）
 * @returns {{lat:number|null, lon:number|null, z:number|null, tab:string|null}|null}
 *          无任何有效内容时返回 null
 */
export function parseViewHash(hash) {
  if (typeof hash !== 'string' || hash.length <= 1) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  let lat = toFiniteNumber(params.get('lat'));
  let lon = toFiniteNumber(params.get('lon'));
  let z = toFiniteNumber(params.get('z'));

  if (lat !== null && (lat < -90 || lat > 90)) lat = null;
  if (lon !== null && (lon < -180 || lon > 180)) lon = null;
  if (z !== null && (z < 0 || z > MAX_ZOOM)) z = null;

  // 坐标必须成对有效，否则整对作废
  if (lat === null || lon === null) {
    lat = null;
    lon = null;
    z = null;
  }

  const tabRaw = params.get('tab');
  const tab = tabRaw && VALID_TABS.has(tabRaw) ? tabRaw : null;

  const hasView = lat !== null || tab !== null;
  if (!hasView) return null;

  return { lat, lon, z, tab };
}

/**
 * 把视角对象序列化为 URL 哈希。
 * @param {{lat:number, lon:number, z?:number}} view
 * @returns {string} 形如 "#lat=..&lon=..&z=.."
 */
export function serializeViewHash({ lat, lon, z }) {
  const fmt = (n) => (Math.round(n * 100000) / 100000).toString();
  const clampZoom = Math.max(0, Math.min(MAX_ZOOM, Math.round(z ?? 0)));
  return `#lat=${fmt(lat)}&lon=${fmt(lon)}&z=${clampZoom}`;
}
