import { describe, it, expect } from 'vitest';
import { qrMatrix } from '../src/utils/qrEncode.js';

// 🔳 二维码矩阵生成器：视角分享链接 → 模块矩阵（Byte 模式，1-L/2-L/3-L 版本）
// 策略：短 URL 走小版本保持密度低（易扫），超长自动升版本
// 测试口径：矩阵是方阵、尺寸符合 QR 规范版本表、定位图案位置正确

describe('qrMatrix —— 视角分享链接编码', () => {
  it('eterm 短链接（~60 字符）返回合法矩阵', () => {
    const url = 'https://eterm.vercel.app/#lat=35.6812&lon=139.7671&z=12';
    const m = qrMatrix(url);
    expect(Array.isArray(m)).toBe(true);
    expect(m.length).toBeGreaterThan(20); // 最小版本 1 也是 21×21
    // 方阵
    for (const row of m) expect(row.length).toBe(m.length);
    // 每格非 0 即 1
    m.flat().forEach(v => expect(v === 0 || v === 1).toBe(true));
  });

  it('战术模式链接（带 mode=tactical）可编码', () => {
    const url = 'https://eterm.vercel.app/#lat=35.6812&lon=139.7671&z=14&mode=tactical';
    const m = qrMatrix(url);
    expect(m.length).toBeGreaterThanOrEqual(21);
  });

  it('长 URL（200+ 字符）自动升版本仍可编码', () => {
    const url = 'https://eterm.vercel.app/#lat=35.6812&lon=139.7671&z=12&mode=tactical&padding=' + 'x'.repeat(150);
    const m = qrMatrix(url);
    expect(m.length).toBeGreaterThan(25); // 升到版本 2+（25×25）
  });

  it('三个定位图案（左上/右上/左下）的 7×7 外框为全 1', () => {
    const m = qrMatrix('https://eterm.vercel.app/#lat=1&lon=2&z=3');
    const n = m.length;
    const checkFinder = (r0, c0) => {
      for (let i = 0; i < 7; i++) {
        expect(m[r0][c0 + i]).toBe(1); // 上边
        expect(m[r0 + 6][c0 + i]).toBe(1); // 下边
        expect(m[r0 + i][c0]).toBe(1); // 左边
        expect(m[r0 + i][c0 + 6]).toBe(1); // 右边
      }
      expect(m[r0 + 3][c0 + 3]).toBe(1); // 中心 3×3 实心
    };
    checkFinder(0, 0);
    checkFinder(0, n - 7);
    checkFinder(n - 7, 0);
  });

  it('时序行（row 6 / col 6）存在交替图案（定位图案之间）', () => {
    const m = qrMatrix('https://eterm.vercel.app/#lat=1&lon=2&z=3');
    const n = m.length;
    // row 6 在两个横向定位图案之间应从 1 开始交替（1010...）
    let expectOne = true;
    for (let c = 8; c < n - 8; c++) {
      expect(m[6][c]).toBe(expectOne ? 1 : 0);
      expectOne = !expectOne;
    }
  });

  it('空串/非法输入抛错（fail-fast，不产出坏码）', () => {
    expect(() => qrMatrix('')).toThrow();
    expect(() => qrMatrix(null)).toThrow();
    expect(() => qrMatrix(undefined)).toThrow();
  });
});
