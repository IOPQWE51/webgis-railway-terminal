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

// 🧭 视角恢复守卫：URL 哈希既是"分享载体"也是"被动跟随"（地图一动就写入），
// 单看 URL 无法区分"别人发我的分享链接"和"我自己刷新页面"。
// 用 sessionStorage 标记化解歧：本标签页到访过（有标记）= 刷新，不恢复旧视角；
// 无标记 = 新标签页/新设备打开的分享链接，恢复视角并落标记。
// 隐私模式等存储异常时保守放行（宁可多恢复一次，不可崩启动）。
export const VISITED_MARKER = 'et_view_visited';

export function shouldRestoreSharedView(storage) {
  try {
    const visited = storage.getItem(VISITED_MARKER);
    storage.setItem(VISITED_MARKER, '1');
    return visited !== '1';
  } catch {
    return true;
  }
}

// 🏠 本机指纹守卫：收藏夹打开自己的链接 vs 朋友打开分享链接，输入完全相同
// （同 URL、新标签页、无 session 标记）——唯一能区分的信息是"这个哈希是不是
// 本机自己写下的"。MapEngine 每次更新地址栏时同步把哈希记进 localStorage（按
// 设备持久），启动时比对：一致 = 自家收藏，静默摆放视角、不弹分享面板；
// 不一致/没记录 = 真分享，保留完整仪式感（飞行 + 分享坐标面板）。
export const OWN_VIEW_FINGERPRINT = 'et_own_view_fingerprint';

export function isOwnDeviceView(hash, storage) {
  try {
    const mine = storage.getItem(OWN_VIEW_FINGERPRINT);
    return typeof hash === 'string' && typeof mine === 'string' && mine !== '' && hash === mine;
  } catch {
    return false; // 存储异常保守当分享处理（不影响启动，只是多点一次面板）
  }
}
