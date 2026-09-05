import { describe, it, expect } from 'vitest';
import {
  parseViewHash,
  serializeViewHash,
  shouldRestoreSharedView,
  VISITED_MARKER,
  isOwnDeviceView,
  OWN_VIEW_FINGERPRINT,
} from '../src/utils/urlState.js';

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

describe('shouldRestoreSharedView（区分刷新 vs 分享打开）', () => {
  // sessionStorage 桩：只用到 getItem/setItem
  const fakeStore = (initial = {}) => {
    const m = new Map(Object.entries(initial));
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      _m: m,
    };
  };

  it('首次到访（无标记）= 分享/深链接打开，恢复视角并落标记', () => {
    const store = fakeStore();
    expect(shouldRestoreSharedView(store)).toBe(true);
    expect(store.getItem(VISITED_MARKER)).toBe('1');
  });

  it('同标签页刷新（已有标记）不恢复，被动哈希只当地址栏跟随', () => {
    const store = fakeStore({ [VISITED_MARKER]: '1' });
    expect(shouldRestoreSharedView(store)).toBe(false);
  });

  it('存储异常（隐私模式抛错）时保守放行恢复，不崩启动流程', () => {
    const throwing = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    };
    expect(shouldRestoreSharedView(throwing)).toBe(true);
  });

  it('标记值非 "1" 视为首次到访', () => {
    expect(shouldRestoreSharedView(fakeStore({ [VISITED_MARKER]: 'weird' }))).toBe(true);
  });
});

describe('isOwnDeviceView（本机指纹守卫：收藏夹 vs 真分享）', () => {
  const fakeStore = (initial = {}) => {
    const m = new Map(Object.entries(initial));
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      _m: m,
    };
  };
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };

  it('URL 哈希 == 本机上次写的哈希 → 是自己收藏的视角（安静恢复，不算分享）', () => {
    const store = fakeStore({ [OWN_VIEW_FINGERPRINT]: '#lat=35.68&lon=139.76&z=12' });
    expect(isOwnDeviceView('#lat=35.68&lon=139.76&z=12', store)).toBe(true);
  });

  it('URL 哈希 ≠ 本机记录（别人发来的链接）→ 不是本机视角', () => {
    const store = fakeStore({ [OWN_VIEW_FINGERPRINT]: '#lat=35.68&lon=139.76&z=12' });
    expect(isOwnDeviceView('#lat=41.5&lon=141.3&z=5', store)).toBe(false);
  });

  it('本机从没写过（首次/新设备/清缓存）→ 不是本机视角', () => {
    expect(isOwnDeviceView('#lat=1&lon=2&z=3', fakeStore())).toBe(false);
  });

  it('存储异常时保守返回 false（宁可当分享处理，不影响启动）', () => {
    expect(isOwnDeviceView('#lat=1&lon=2&z=3', throwing)).toBe(false);
  });
});
