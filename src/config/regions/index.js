// src/config/regions/index.js
// 🌍 内容分区域打包注册表（#10）—— 区域 → 内容的映射在此收敛
// 一期（本版）：同步聚合导出，具名与历史 API 同形，消费方 import 只改路径零改逻辑
// 二期（数据量增大后）：本文件内部改 import() 动态加载，注册表存 loader；
//   消费方接口不变。扩张纪律：新区域 = 新文件 + 注册表加一行，别处永不感知
//
// 设计契约见 specs/2026-09-07-regional-content-packs-design.md

import * as china from './china.js';
import * as japan from './japan.js';
import * as korea from './korea.js';
import * as europe from './europe.js';
import * as uk from './uk.js';
import * as panasia from './panasia.js';

export const REGION_REGISTRY = [
    {
        id: china.CHINA_REGION.id,
        name: china.CHINA_REGION.name,
        centerLabel: china.CHINA_REGION.centerLabel,
        icon: china.CHINA_REGION.icon,
        center: china.CHINA_REGION.center,
        zoom: china.CHINA_REGION.zoom,
        description: china.CHINA_REGION.description,
        data: china,
    },
    {
        id: japan.JAPAN_REGION.id,
        name: japan.JAPAN_REGION.name,
        centerLabel: japan.JAPAN_REGION.centerLabel,
        icon: japan.JAPAN_REGION.icon,
        center: japan.JAPAN_REGION.center,
        zoom: japan.JAPAN_REGION.zoom,
        description: japan.JAPAN_REGION.description,
        data: japan,
    },
    {
        id: korea.KOREA_REGION.id,
        name: korea.KOREA_REGION.name,
        centerLabel: korea.KOREA_REGION.centerLabel,
        icon: korea.KOREA_REGION.icon,
        center: korea.KOREA_REGION.center,
        zoom: korea.KOREA_REGION.zoom,
        description: korea.KOREA_REGION.description,
        data: korea,
    },
    {
        id: europe.EUROPE_REGION.id,
        name: europe.EUROPE_REGION.name,
        centerLabel: europe.EUROPE_REGION.centerLabel,
        icon: europe.EUROPE_REGION.icon,
        center: europe.EUROPE_REGION.center,
        zoom: europe.EUROPE_REGION.zoom,
        description: europe.EUROPE_REGION.description,
        data: europe,
    },
    {
        id: uk.UK_REGION.id,
        name: uk.UK_REGION.name,
        centerLabel: uk.UK_REGION.centerLabel,
        icon: uk.UK_REGION.icon,
        center: uk.UK_REGION.center,
        zoom: uk.UK_REGION.zoom,
        description: uk.UK_REGION.description,
        data: uk,
    },
    {
        id: panasia.PANASIA_REGION.id,
        name: panasia.PANASIA_REGION.name,
        centerLabel: panasia.PANASIA_REGION.centerLabel,
        icon: panasia.PANASIA_REGION.icon,
        center: panasia.PANASIA_REGION.center,
        zoom: panasia.PANASIA_REGION.zoom,
        description: panasia.PANASIA_REGION.description,
        data: panasia,
    },
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
