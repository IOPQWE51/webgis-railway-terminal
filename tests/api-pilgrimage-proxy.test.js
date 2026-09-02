import { describe, it, expect } from 'vitest';
import anitabiHandler from '../api/anitabi.js';
import bangumiHandler from '../api/bangumi.js';

// api/ → ../src/ 的跨目录导入目前仅这两处，模块级导入失败只会在 Vercel 部署时才暴露，
// 用导入冒烟把它提前到 CI。
describe('巡礼代理模块冒烟', () => {
  it('api/anitabi.js 默认导出为函数（withRateLimit 包装后）', () => {
    expect(typeof anitabiHandler).toBe('function');
  });

  it('api/bangumi.js 默认导出为函数（withRateLimit 包装后）', () => {
    expect(typeof bangumiHandler).toBe('function');
  });
});
