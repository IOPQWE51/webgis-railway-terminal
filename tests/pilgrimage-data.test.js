import { describe, it, expect } from 'vitest';
import {
  buildPointId,
  truncateName,
  withPlan,
  mapPointCommon,
  mapLiteToViewModel,
  compactSearchResults,
  toCustomPoint,
  mergePilgrimagePoints,
} from '../src/utils/pilgrimageData.js';

const LITE_FIXTURE = {
  id: 10440,
  cn: '我们仍未知道那天所看见的花的名字。',
  title: 'あの日見た花の名前を僕達はまだ知らない。',
  city: '秩父市',
  cover: 'https://image.anitabi.cn/bangumi/10440.jpg?plan=h160',
  color: '#002aaa',
  geo: [35.994, 138.99],
  zoom: 11,
  modified: 1673007748617,
  litePoints: [
    { id: 'a4yyy6kt', cn: '旧秩父桥', name: '旧秩父橋',
      image: 'https://image.anitabi.cn/user/1000/bangumi/10440/points/a4yyy6kt.jpg?plan=h160',
      ep: 1, s: 230, geo: [36.0187, 139.0863] },
  ],
  pointsLength: 94,
  imagesLength: 93,
};

describe('buildPointId / truncateName / withPlan', () => {
  it('点位 ID 格式为 pilg-{番剧ID}-{点位ID}', () => {
    expect(buildPointId(10440, 'a4yyy6kt')).toBe('pilg-10440-a4yyy6kt');
  });

  it('名称 ≤120 原样返回，超长截断且不超上限', () => {
    const short = '旧秩父桥';
    expect(truncateName(short)).toBe(short);
    const long = '聖'.repeat(150);
    const cut = truncateName(long);
    expect(cut.length).toBeLessThanOrEqual(120);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('withPlan 替换既有 plan 参数、补齐缺失场景', () => {
    expect(withPlan('https://x/b.jpg?plan=h160', 'h360')).toBe('https://x/b.jpg?plan=h360');
    expect(withPlan('https://x/b.jpg', 'h360')).toBe('https://x/b.jpg?plan=h360');
    expect(withPlan('https://x/b.jpg?a=1', 'h360')).toBe('https://x/b.jpg?a=1&plan=h360');
    expect(withPlan('', 'h360')).toBe('');
    expect(withPlan(null, 'h360')).toBe(null);
  });
});

describe('mapPointCommon · 巡礼点视图模型', () => {
  it('lite/detail 通用映射：cn 优先、geo 解构、origin 透传', () => {
    const vm = mapPointCommon({
      id: 'a4yyy6kt', cn: '旧秩父桥', name: '旧秩父橋',
      image: 'https://x.jpg?plan=h160', ep: 1, s: 230,
      geo: [36.0187, 139.0863], origin: 'Anitabi@卜卜口', originURL: 'https://anitabi.cn/',
    });
    expect(vm).toEqual({
      id: 'a4yyy6kt', name: '旧秩父桥', nameOriginal: '旧秩父橋',
      image: 'https://x.jpg?plan=h160', ep: 1, s: 230,
      lat: 36.0187, lon: 139.0863,
      origin: 'Anitabi@卜卜口', originURL: 'https://anitabi.cn/',
    });
  });

  it('缺图、缺 ep/s、缺 origin 时给安全兜底值', () => {
    const vm = mapPointCommon({ id: 'p2', cn: '某神社', geo: [1.23, 4.56] });
    expect(vm.image).toBe('');
    expect(vm.ep).toBe(null);
    expect(vm.s).toBe(null);
    expect(vm.origin).toBe('');
    expect(vm.nameOriginal).toBe('');
  });

  it('geo 缺失时 lat/lon 为 null（推送层会过滤）', () => {
    const vm = mapPointCommon({ id: 'p3', cn: '无名点' });
    expect(vm.lat).toBe(null);
    expect(vm.lon).toBe(null);
  });
});

describe('mapLiteToViewModel · 番剧详情视图模型', () => {
  it('完整字段映射与 h360 封面升级', () => {
    const vm = mapLiteToViewModel(LITE_FIXTURE);
    expect(vm.id).toBe(10440);
    expect(vm.titleCn).toBe('我们仍未知道那天所看见的花的名字。');
    expect(vm.titleOriginal).toBe('あの日見た花の名前を僕達はまだ知らない。');
    expect(vm.city).toBe('秩父市');
    expect(vm.cover).toBe('https://image.anitabi.cn/bangumi/10440.jpg?plan=h360');
    expect(vm.color).toBe('#002aaa');
    expect(vm.pointsLength).toBe(94);
    expect(vm.mapUrl).toBe('https://anitabi.cn/map?bangumiId=10440');
    expect(vm.points).toHaveLength(1);
    expect(vm.points[0].name).toBe('旧秩父桥');
  });

  it('color 非法/缺失回退项目粉 #ec4899；cn 缺失回退 title', () => {
    expect(mapLiteToViewModel({ ...LITE_FIXTURE, color: 'javascript:alert(1)' }).color).toBe('#ec4899');
    expect(mapLiteToViewModel({ ...LITE_FIXTURE, color: undefined }).color).toBe('#ec4899');
    const noCn = mapLiteToViewModel({ ...LITE_FIXTURE, cn: '' });
    expect(noCn.titleCn).toBe(LITE_FIXTURE.title);
  });
});

describe('compactSearchResults · Bangumi 搜索压缩', () => {
  it('取前 12 条，压缩为卡片所需字段，date 截取年份', () => {
    const raw = { data: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1, name: `けいおん!${i}`, name_cn: `轻音少女${i}`,
      date: '2009-04-02', images: { common: `https://lain.bgm.tv/pic/cover/c/${i}.jpg` },
    })) };
    const list = compactSearchResults(raw);
    expect(list).toHaveLength(12);
    expect(list[0]).toEqual({
      id: 1, titleCn: '轻音少女0', titleOriginal: 'けいおん!0',
      date: '2009', cover: 'https://lain.bgm.tv/pic/cover/c/0.jpg',
    });
  });

  it('name_cn 缺失回退 name；data 缺失返回空数组', () => {
    const list = compactSearchResults({ data: [{ id: 9, name: 'らき☆すた', date: null, images: {} }] });
    expect(list[0].titleCn).toBe('らき☆すた');
    expect(list[0].date).toBe('');
    expect(list[0].cover).toBe('');
    expect(compactSearchResults(null)).toEqual([]);
  });
});

describe('toCustomPoint / mergePilgrimagePoints · 推送与去重', () => {
  const pt = (id, name, lat, lon) => ({ id, name, nameOriginal: '', image: '', ep: 1, s: 1, lat, lon, origin: '', originURL: '' });

  it('toCustomPoint 映射到服务端硬校验 schema（category=anime, source=anitabi）', () => {
    const p = toCustomPoint(10440, pt('a4yyy6kt', '旧秩父桥', 36.0187, 139.0863));
    expect(p).toEqual({ id: 'pilg-10440-a4yyy6kt', name: '旧秩父桥', lat: 36.0187, lon: 139.0863, category: 'anime', source: 'anitabi' });
  });

  it('全新点位全部增量合并，计数正确', () => {
    const { merged, added, skipped } = mergePilgrimagePoints([], [pt('p1', 'A', 1, 1), pt('p2', 'B', 2, 2)]);
    expect(merged).toHaveLength(2);
    expect(added).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it('生成 ID 已存在 → 跳过（重复推送同一番剧）', () => {
    const existing = [toCustomPoint(10440, pt('a4yyy6kt', '旧秩父桥', 36.0187, 139.0863))];
    const incoming = [pt('a4yyy6kt', '旧秩父桥', 36.0187, 139.0863)];
    const { merged, added, skipped } = mergePilgrimagePoints(existing, incoming.map(p => toCustomPoint(10440, p)));
    expect(merged).toHaveLength(1);
    expect(added).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('同名同源坐标差 <1e-4 跳过；恰好 ≥1e-4 视为不同点', () => {
    const existing = [{ id: 'pilg-1-x', name: '神社', lat: 35.00001, lon: 139.00001, category: 'anime', source: 'anitabi' }];
    const inside = mergePilgrimagePoints(existing, [pt('new1', '神社', 35.000015, 139.000015)]);
    expect(inside.added).toHaveLength(0);
    const outside = mergePilgrimagePoints(existing, [pt('new2', '神社', 35.00011, 139.00001)]);
    expect(outside.added).toHaveLength(1);
  });

  it('非 anitabi 来源的同名同坐标点位不参与去重', () => {
    const existing = [{ id: 'user-1', name: '神社', lat: 35.0, lon: 139.0, category: 'spot', source: '' }];
    const { added } = mergePilgrimagePoints(existing, [pt('new3', '神社', 35.0, 139.0)]);
    expect(added).toHaveLength(1);
  });

  it('坐标非法（null/NaN）直接跳过不入库', () => {
    const { added, skipped } = mergePilgrimagePoints([], [pt('p9', '坏点', null, 139.0), pt('p10', '坏点2', Number.NaN, 1)]);
    expect(added).toHaveLength(0);
    expect(skipped).toBe(2);
  });
});
