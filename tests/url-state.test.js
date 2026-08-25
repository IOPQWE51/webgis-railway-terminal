import { describe, it, expect } from 'vitest';
import { parseViewHash, serializeViewHash } from '../src/utils/urlState.js';

describe('parseViewHash', () => {
  it('解析完整的视角哈希', () => {
    expect(parseViewHash('#lat=35.6812&lon=139.7671&z=12&tab=map')).toEqual({
      lat: 35.6812,
      lon: 139.7671,
      z: 12,
      tab: 'map',
    });
  });

  it('空串/无有效内容返回 null', () => {
    expect(parseViewHash('')).toBeNull();
    expect(parseViewHash('#')).toBeNull();
    expect(parseViewHash('#foo=bar')).toBeNull();
  });

  it('只有坐标时 tab 为 null；只有合法 tab 时坐标为 null', () => {
    expect(parseViewHash('#lat=10&lon=20')).toEqual({ lat: 10, lon: 20, z: null, tab: null });
    expect(parseViewHash('#tab=data')).toEqual({ lat: null, lon: null, z: null, tab: 'data' });
  });

  it('越界坐标被拒绝（但同串里的合法 tab 仍保留）', () => {
    expect(parseViewHash('#lat=91&lon=20&tab=rules')).toEqual({
      lat: null,
      lon: null,
      z: null,
      tab: 'rules',
    });
    expect(parseViewHash('#lat=10&lon=-181')).toBeNull(); // 坐标对残缺且无 tab → 整体视为无内容
    expect(parseViewHash('#lat=10&lon=-181&z=5')).toBeNull();
  });

  it('非法数值与未知 tab 被忽略', () => {
    expect(parseViewHash('#lat=abc&lon=20')).toBeNull();
    expect(parseViewHash('#tab=hacker')).toBeNull();
    expect(parseViewHash('#lat=10&lon=20&z=99')).toEqual({ lat: 10, lon: 20, z: null, tab: null });
  });
});

describe('serializeViewHash', () => {
  it('坐标取 5 位小数、缩放取整', () => {
    expect(serializeViewHash({ lat: 35.68123456, lon: 139.76712345, z: 12.4 })).toBe(
      '#lat=35.68123&lon=139.76712&z=12'
    );
  });

  it('负坐标与负缩放正确输出/夹取', () => {
    expect(serializeViewHash({ lat: -33.9, lon: -70.5, z: 4 })).toBe('#lat=-33.9&lon=-70.5&z=4');
    expect(serializeViewHash({ lat: 10, lon: 20, z: -3 })).toBe('#lat=10&lon=20&z=0');
  });

  it('与 parse 构成往返', () => {
    const view = { lat: 35.68123, lon: 139.76712, z: 12 };
    const back = parseViewHash(serializeViewHash(view));
    expect(back).toEqual({ ...view, tab: null });
  });
});
