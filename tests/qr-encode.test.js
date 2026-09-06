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

  it('版本选择必须计入协议开销（回归：55 字节曾被塞进 v3 导致截断）', () => {
    // 55 字节内容 + mode 4 位 + len 8 位 + 终止 4 位 = 需要 57 字节 > v3-L 容量 55
    // → 必须选 v4（33×33）。教训：裸字节数对比会差 2 字节余量、码不可解
    const url55 = 'https://eterm.vercel.app/#lat=35.6812&lon=139.7671&z=12'; // 恰 55 字节
    expect(Buffer.byteLength(url55, 'utf8')).toBe(55);
    const m = qrMatrix(url55);
    expect(m.length).toBe(33); // 版本 4，不是版本 3 的 29
  });

  it('真实视角链接可被独立解码器还原（jsqr 交叉验证，真机可扫性守卫）', async () => {
    const { createRequire } = await import('node:module');
    // jsqr/qrcode 仅在本地验证时存在（--no-save 安装），CI 缺失时跳过而非挂红
    let jsQR;
    try {
      jsQR = createRequire(import.meta.url)('jsqr');
    } catch {
      console.warn('jsqr 未安装，跳过交叉验证（本地 npm i --no-save jsqr 可启用）');
      return;
    }
    const url = 'https://eterm.vercel.app/#lat=35.6812&lon=139.7671&z=12&mode=tactical';
    const m = qrMatrix(url);
    const scale = 6, quiet = 4, n = m.length, W = (n + quiet * 2) * scale;
    const rgba = new Uint8ClampedArray(W * W * 4);
    for (let r = 0; r < W; r++) {
      for (let c = 0; c < W; c++) {
        const mr = Math.floor(r / scale) - quiet, mc = Math.floor(c / scale) - quiet;
        const v = (mr >= 0 && mr < n && mc >= 0 && mc < n) ? (m[mr][mc] === 1 ? 0 : 255) : 255;
        const i = (r * W + c) * 4;
        rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
      }
    }
    const result = jsQR(rgba, W, W);
    expect(result && result.data).toBe(url);
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
