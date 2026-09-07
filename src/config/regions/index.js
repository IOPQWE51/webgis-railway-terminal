// src/config/regions/index.js
// 🌍 内容分区域打包注册表（#10）—— 区域 → 内容的映射在此收敛
// 一期（本版）：同步聚合导出，具名与历史 API 同形，消费方 import 只改路径零改逻辑
// 二期（数据量增大后）：本文件内部改 import() 动态加载，注册表存 loader；
//   消费方接口不变。扩张纪律：新区域 = 新文件 + 注册表加一行，别处永不感知
//
// 设计契约见 specs/2026-09-07-regional-content-packs-design.md

import * as japan from './japan.js';

export const REGION_REGISTRY = [
    { id: japan.JAPAN_REGION.id, name: japan.JAPAN_REGION.name, data: japan },
    // 🆕 新区域模板：
    // import * as europe from './europe.js';
    // { id: europe.EUROPE_REGION.id, name: ..., data: europe },
];

// ── 聚合导出：与迁移前的全局数组同形同名（消费方无感迁移）──
export const BASE_POINTS_CONFIG = REGION_REGISTRY.flatMap((r) => r.data.STATIONS || []);
export const RAILWAY_LINES_CONFIG = REGION_REGISTRY.flatMap((r) => r.data.RAILWAY_LINES || []);
export const PILGRIMAGE_PICKS = REGION_REGISTRY.flatMap((r) => r.data.PILGRIMAGE_PICKS || []);
export const HANABI_DATA = REGION_REGISTRY.flatMap((r) => r.data.HANABI_EVENTS || []);

/** 按区域 id 取内容包（未来单区域懒加载的入口雏形） */
export function getRegionPack(regionId) {
    const region = REGION_REGISTRY.find((r) => r.id === regionId);
    return region ? region.data : null;
}
