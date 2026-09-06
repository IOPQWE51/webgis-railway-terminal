import { describe, it, expect } from 'vitest';
import { mergeOnPull } from '../src/utils/pointsMerge';

const pt = (id, over = {}) => ({ id, name: `点${id}`, lat: 35, lon: 139, category: 'spot', source: '测试', ...over });

describe('mergeOnPull 多设备 LWW 合并', () => {
  it('同 id：updatedAt 新者胜', () => {
    const local = [pt('a', { name: '本地旧名', updatedAt: 100 }), pt('b', { updatedAt: 50 })];
    const cloud = [pt('a', { name: '云端新名', updatedAt: 200 }), pt('c')];
    const out = mergeOnPull(local, cloud);
    const a = out.find((p) => p.id === 'a');
    expect(a.name).toBe('云端新名');
    expect(a.updatedAt).toBe(200);
    // 单侧保留：b（仅本地）、c（仅云端）都在
    expect(out.some((p) => p.id === 'b')).toBe(true);
    expect(out.some((p) => p.id === 'c')).toBe(true);
    expect(out).toHaveLength(3);
  });

  it('同 id：本地新于云端 → 本地胜', () => {
    const local = [pt('x', { name: '本地新', updatedAt: 999 })];
    const cloud = [pt('x', { name: '云端旧', updatedAt: 1 })];
    expect(mergeOnPull(local, cloud)[0].name).toBe('本地新');
  });

  it('旧数据双方都无 updatedAt：保留本地版本（稳定不丢点）', () => {
    const local = [pt('old', { name: '本地版本' })];
    const cloud = [pt('old', { name: '云端版本' })];
    const out = mergeOnPull(local, cloud);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('本地版本');
  });

  it('一侧无 updatedAt 一侧有：有 updatedAt 的一方胜（缺省视为最老）', () => {
    const local = [pt('m', { name: '本地无时间' })];
    const cloud = [pt('m', { name: '云端带时间', updatedAt: 1 })];
    expect(mergeOnPull(local, cloud)[0].name).toBe('云端带时间');
  });

  it('合并顺序：本地序优先，云端独有点追加在后（UI 少跳动）', () => {
    const local = [pt('a'), pt('b')];
    const cloud = [pt('b'), pt('c'), pt('d')];
    expect(mergeOnPull(local, cloud).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('空/异常入参安全', () => {
    expect(mergeOnPull([], [pt('c')])).toEqual([pt('c')]);
    expect(mergeOnPull([pt('l')], [])).toEqual([pt('l')]);
    expect(mergeOnPull(null, [pt('c')])).toEqual([pt('c')]);
    expect(mergeOnPull([pt('l')], null)).toEqual([pt('l')]);
    expect(mergeOnPull(null, null)).toEqual([]);
  });

  it('非法点位条目（非对象）被跳过不炸', () => {
    const local = [pt('a'), 'garbage', null];
    const cloud = [pt('b'), 42];
    const out = mergeOnPull(local, cloud);
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('v2 字段随胜者整条带回（group 不丢）', () => {
    const local = [pt('g', { group: '关东之行', updatedAt: 10 })];
    const cloud = [pt('g', { group: '关东之行', updatedAt: 20, name: '新名' })];
    const out = mergeOnPull(local, cloud);
    expect(out[0].group).toBe('关东之行');
    expect(out[0].name).toBe('新名');
  });
});
