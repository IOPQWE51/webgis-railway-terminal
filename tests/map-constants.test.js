import { describe, it, expect } from 'vitest';
import { BASE_MAPS } from '../src/config/mapConstants.js';
import { REGION_REGISTRY, BASE_POINTS_CONFIG, RAILWAY_LINES_CONFIG } from '../src/config/regions/index.js';

describe('BASE_MAPS 底图配置', () => {
  it('暗黑底图已迁移到 Esri 免 key 服务（Carto 老端点 2025 起对匿名请求下发 API KEY REQUIRED 占位瓦片，回归守卫）', () => {
    expect(BASE_MAPS.dark.url).not.toContain('cartocdn.com');
    expect(BASE_MAPS.dark.url).toContain('arcgisonline.com');
    expect(BASE_MAPS.dark.url).toContain('World_Dark_Gray_Base');
  });

  it('拓扑与卫星底图保持 Esri 服务不变', () => {
    expect(BASE_MAPS.topo.url).toContain('World_Topo_Map');
    expect(BASE_MAPS.satellite.url).toContain('World_Imagery');
  });

  it('三种底图都配置了名称与署名', () => {
    for (const key of ['topo', 'satellite', 'dark']) {
      expect(typeof BASE_MAPS[key].name).toBe('string');
      expect(BASE_MAPS[key].name.length).toBeGreaterThan(0);
      expect(typeof BASE_MAPS[key].attribution).toBe('string');
      expect(BASE_MAPS[key].attribution.length).toBeGreaterThan(0);
    }
  });
});

describe('REGION_REGISTRY 多国交通骨架包契约', () => {
  it('已注册中/日/韩/欧/英/泛亚/北美七大区域内容包，且中心点、缩放与官方时刻表合法', () => {
    const ids = REGION_REGISTRY.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['cn', 'jp', 'kr', 'eu', 'uk', 'sea', 'na']));
    for (const region of REGION_REGISTRY) {
      expect(Array.isArray(region.center)).toBe(true);
      expect(region.center).toHaveLength(2);
      expect(Number.isFinite(region.center[0]) && Math.abs(region.center[0]) <= 90).toBe(true);
      expect(Number.isFinite(region.center[1]) && Math.abs(region.center[1]) <= 180).toBe(true);
      expect(Number.isFinite(region.zoom)).toBe(true);
      expect(typeof region.timetableUrl).toBe('string');
      expect(region.timetableUrl.startsWith('https://')).toBe(true);
    }
  });

  it('所有铁道干线引用的站点 ID 均在对应区域与聚合站点表中存在（防悬空连线）', () => {
    const stationIds = new Set(BASE_POINTS_CONFIG.map((s) => s.id));
    expect(stationIds.size).toBeGreaterThanOrEqual(155);
    for (const region of REGION_REGISTRY) {
      const localIds = new Set((region.data.STATIONS || []).map((s) => s.id));
      for (const line of region.data.RAILWAY_LINES || []) {
        expect(line.points.length).toBeGreaterThanOrEqual(2);
        expect(typeof line.name).toBe('string');
        expect(line.name.trim().length).toBeGreaterThan(0);
        for (const id of line.points) {
          expect(localIds.has(id)).toBe(true);
          expect(stationIds.has(id)).toBe(true);
        }
      }
    }
    expect(RAILWAY_LINES_CONFIG.length).toBeGreaterThanOrEqual(44);
  });
});
