// 圣地巡礼工作台 · 纯函数层
// 上游契约见 docs/superpowers/specs/2026-09-03-pilgrimage-workbench-design.md §执行者须知
// 职责：anitabi/Bangumi 响应 → 视图模型；推送点位构造与去重合并。无副作用、无网络。

const DEFAULT_COLOR = '#ec4899'; // 项目粉色（次元情报中心主题色）
const MAX_NAME_LEN = 120;        // 与 api/validation.js 的 MAX_NAME_LEN 对齐
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** 推送点位 ID：pilg-{番剧ID}-{点位ID}（服务端上限 64 字符；pointId 超长截断兜底） */
export const buildPointId = (bangumiId, pointId) => `pilg-${bangumiId}-${String(pointId).slice(0, 40)}`;

/** 名称超长截断（服务端 400 硬校验是 name≤120，宁可截断也不让整批推送失败） */
export const truncateName = (name, max = MAX_NAME_LEN) =>
  name.length <= max ? name : `${name.slice(0, max - 1)}…`;

/**
 * anitabi 图片 URL 已带 ?plan=h160；这里替换或补齐为所需规格
 * （h160 列表缩略图 / h360 详情封面，全尺寸被官方劝退）
 */
export function withPlan(url, plan = 'h160') {
  if (!url) return url;
  if (/[?&]plan=/.test(url)) return url.replace(/([?&])plan=[^&]*/, `$1plan=${plan}`);
  return url.includes('?') ? `${url}&plan=${plan}` : `${url}?plan=${plan}`;
}

/** lite 与 points/detail 的点位通用映射（两者字段一致：id/cn/name/image/ep/s/geo/origin） */
export function mapPointCommon(p) {
  const geo = Array.isArray(p?.geo) ? p.geo : null;
  return {
    id: String(p?.id ?? ''),
    name: p?.cn || p?.name || '未命名圣地',
    nameOriginal: p?.cn && p?.name && p.name !== p.cn ? p.name : '',
    image: p?.image || '',
    ep: p?.ep ?? null,
    s: p?.s ?? null,
    lat: Number.isFinite(geo?.[0]) ? geo[0] : null,
    lon: Number.isFinite(geo?.[1]) ? geo[1] : null,
    origin: p?.origin || '',
    originURL: p?.originURL || '',
  };
}

/** lite 响应 → 详情卡视图模型（缺字段全部兜底，绝不让 UI 崩） */
export function mapLiteToViewModel(lite) {
  const id = lite?.id;
  return {
    id,
    titleCn: lite?.cn || lite?.title || '未知作品',
    titleOriginal: lite?.cn && lite?.title && lite.title !== lite.cn ? lite.title : '',
    city: lite?.city || '',
    cover: withPlan(lite?.cover, 'h360'),
    color: COLOR_RE.test(lite?.color || '') ? lite.color : DEFAULT_COLOR,
    pointsLength: lite?.pointsLength ?? lite?.litePoints?.length ?? 0,
    imagesLength: lite?.imagesLength ?? 0,
    mapUrl: id ? `https://anitabi.cn/map?bangumiId=${id}` : 'https://anitabi.cn/map',
    points: (lite?.litePoints || []).map(mapPointCommon),
  };
}

/** Bangumi 搜索原始响应 → 前端卡片所需的压缩列表（最多 12 条） */
export function compactSearchResults(raw) {
  const data = Array.isArray(raw?.data) ? raw.data.filter(Boolean) : [];
  return data.slice(0, 12).map((s) => ({
    id: s.id,
    titleCn: s.name_cn || s.name || '未知作品',
    titleOriginal: s.name_cn && s.name && s.name !== s.name_cn ? s.name : '',
    date: s.date ? String(s.date).slice(0, 4) : '',
    cover: s.images?.common || s.images?.medium || s.images?.small || '',
  }));
}

/** 视图模型点位 → 服务端硬校验 schema（api/validation.js：id≤64 name≤120 category≤32 source≤32） */
export const toCustomPoint = (bangumiId, pt) => ({
  id: buildPointId(bangumiId, pt.id),
  name: truncateName(pt.name),
  lat: pt.lat,
  lon: pt.lon,
  category: 'anime',
  source: 'anitabi',
});

/**
 * 去重合并（幂等：重复推送同一番剧不会产生脏数据）
 * 跳过条件：坐标非法 | 生成 ID 已存在 | anitabi 来源且同名且坐标差 <1e-4（约 11 米）
 * @returns {{ merged: Array, added: Array, skipped: number }}
 */
export function mergePilgrimagePoints(existingPoints, incomingPoints) {
  const existingIds = new Set(existingPoints.map((p) => p.id));
  const anitabiExisting = existingPoints.filter((p) => p.source === 'anitabi');
  const added = [];
  let skipped = 0;

  for (const pt of incomingPoints) {
    // Number.isFinite(null/undefined/NaN/Infinity) 全为 false，单一谓词覆盖整类非法坐标
    const badCoord = !Number.isFinite(pt.lat) || !Number.isFinite(pt.lon);
    if (badCoord || existingIds.has(pt.id)) {
      skipped += 1;
      continue;
    }
    // 十进制差恰好 1e-4 时二进制浮点实差为 9.99999…e-5（略小于阈值），
    // 直接比较会把"恰好 ≥1e-4"误判为重复，故减去 1e-12 表示误差容差
    const dup = anitabiExisting.some(
      (e) =>
        e.name === pt.name &&
        Math.abs(e.lat - pt.lat) < 1e-4 - 1e-12 &&
        Math.abs(e.lon - pt.lon) < 1e-4 - 1e-12,
    );
    if (dup) {
      skipped += 1;
      continue;
    }
    added.push(pt);
  }
  return { merged: [...existingPoints, ...added], added, skipped };
}
