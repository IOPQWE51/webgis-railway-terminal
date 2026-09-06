// src/utils/pointsMerge.js
// 🔄 点位多设备合并（客户端 LWW）—— 设计契约见 specs/2026-09-06-points-model-v2-design.md §3.1
// 语义：同 id 点位 updatedAt 新者胜（缺省视为 0，即最老）；单侧点保留；
// 顺序遵循本地序优先、云端独有点追加在后（减少 UI 跳动）。
// 已知属性（无墓碑 LWW）：A 设备清空云库不会传播删除，B 拉云合并后点会"复活"
// ——测试数据阶段可接受，注释在此留档。

const ts = (p) => Number(p?.updatedAt) || 0;
const isPointLike = (p) => p !== null && typeof p === 'object' && typeof p.id !== 'undefined';

/**
 * 拉云合并：本地缓存 vs 云端库 → 合并结果（新数组，不修改入参）
 * 任一侧 null/undefined 视为空数组；非法条目跳过。
 */
export function mergeOnPull(localPoints, cloudPoints) {
  const local = Array.isArray(localPoints) ? localPoints.filter(isPointLike) : [];
  const cloud = Array.isArray(cloudPoints) ? cloudPoints.filter(isPointLike) : [];
  if (local.length === 0) return [...cloud];
  if (cloud.length === 0) return [...local];

  const cloudById = new Map(cloud.map((p) => [String(p.id), p]));
  const merged = [];
  const seen = new Set();

  for (const lp of local) {
    const key = String(lp.id);
    const cp = cloudById.get(key);
    merged.push(ts(cp) > ts(lp) ? cp : lp);
    seen.add(key);
  }
  for (const cp of cloud) {
    if (!seen.has(String(cp.id))) merged.push(cp);
  }
  return merged;
}
