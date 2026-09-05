import { describe, it, expect } from 'vitest';
import { BASE_MAPS } from '../src/config/mapConstants.js';

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
