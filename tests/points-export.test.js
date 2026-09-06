import { describe, it, expect } from 'vitest';
import { toCSV, toJSON, exportFileName, csvEscape } from '../src/utils/pointsExport';

const pts = [
  { id: 'a', name: '清水寺', lat: 34.9949, lon: 135.785, category: 'anime', group: '关西', source: '手动修正录入', updatedAt: 100 },
  { id: 'b', name: '含,逗号 "引号" 和\n换行', lat: 35.1, lon: 139.2, category: 'spot', source: '测试' }
];

describe('csvEscape CSV 单元格转义', () => {
  it('普通文本原样返回', () => {
    expect(csvEscape('清水寺')).toBe('清水寺');
  });
  it('含逗号/引号/换行 → 双引号包裹并转义内部引号', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('l1\nl2')).toBe('"l1\nl2"');
  });
});

describe('toCSV', () => {
  const csv = toCSV(pts);
  it('UTF-8 BOM 头 + 固定表头', () => {
    expect(csv.startsWith('\uFEFFname,lat,lon,category,group,source')).toBe(true);
  });
  it('正常点位一行，缺失 group 显空串（引号内换行由 csvEscape 整体包裹）', () => {
    // 含换行的单元格整体被双引号包裹，按行 split 会被拆开 —— 用逐断言验证
    expect(csv).toContain('清水寺,34.9949,135.785,anime,关西,手动修正录入');
    expect(csv).toContain('"含,逗号 ""引号"" 和\n换行",35.1,139.2,spot,,测试');
    expect(csv.endsWith('\n')).toBe(false);
  });
  it('空/非数组入参 → 仅表头', () => {
    expect(toCSV([])).toBe('\uFEFFname,lat,lon,category,group,source');
    expect(toCSV(null)).toBe('\uFEFFname,lat,lon,category,group,source');
  });
});

describe('toJSON / exportFileName', () => {
  it('JSON 序列化保留完整字段，可被 JSON.parse 回来', () => {
    const json = toJSON(pts);
    const back = JSON.parse(json);
    expect(back).toEqual(pts);
  });
  it('空入参 → 空数组 JSON', () => {
    expect(JSON.parse(toJSON([]))).toEqual([]);
  });
  it('文件名 YYYYMMDD 格式', () => {
    expect(exportFileName('earth-terminal-points', 'json', new Date(2026, 8, 6)))
      .toBe('earth-terminal-points-20260906.json');
  });
});
