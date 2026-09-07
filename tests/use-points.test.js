// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePoints } from '../src/hooks/usePoints';

// usePoints(scope) 统一 hook 的行为测试 —— localStorage/fetch 全 mock

const storageMock = (() => {
  let map = new Map();
  return {
    __reset: () => { map = new Map(); },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
})();

const fetchMock = vi.fn();

vi.stubGlobal('localStorage', storageMock);
vi.stubGlobal('fetch', fetchMock);

const mkPoint = (id, over = {}) => ({ id, name: `点${id}`, lat: 35, lon: 139, category: 'spot', source: '测试', ...over });

function okJson(data) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ source: 'cloud', data }) });
}

function okJsonLike(obj) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj) });
}

describe('usePoints(scope) 统一点位 hook', () => {
  it('scope=main 用主库键，scope=dark2d 用战术库键', async () => {
    storageMock.__reset();
    fetchMock.mockReset();
    localStorage.setItem('earth_terminal_custom_points', JSON.stringify([mkPoint('m1')]));
    localStorage.setItem('earth_terminal_dark2d_points', JSON.stringify([mkPoint('d1')]));

    const main = renderHook(() => usePoints('main'));
    expect(main.result.current.points).toHaveLength(1);
    expect(main.result.current.points[0].id).toBe('m1');

    const dark = renderHook(() => usePoints('dark2d'));
    expect(dark.result.current.points[0].id).toBe('d1');
  });

  it('匿名模式：更新只落本地，不发云请求', async () => {
    storageMock.__reset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okJson([])); // me 探测返回无用户

    const { result } = renderHook(() => usePoints('main'));
    await waitFor(() => expect(result.current.sessionChecked).toBe(true));
    fetchMock.mockClear();

    act(() => {
      result.current.updatePoints([mkPoint('x1')]);
    });
    expect(result.current.points[0].id).toBe('x1');
    // 本地已存
    expect(JSON.parse(localStorage.getItem('earth_terminal_custom_points'))[0].id).toBe('x1');
    // 无任何写云调用
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('登录拉云：v2 LWW 合并生效（云端新者胜）+ 差异回推', async () => {
    storageMock.__reset();
    fetchMock.mockReset();
    // 本地旧值
    localStorage.setItem('earth_terminal_custom_points', JSON.stringify([
      mkPoint('a', { name: '本地旧', updatedAt: 100 }),
      mkPoint('b'),
    ]));
    // 按 URL+method 路由
    fetchMock.mockImplementation((url, init = {}) => {
      if (String(url).includes('auth') && init.method !== 'POST') {
        return okJsonLike({ username: '站长' });
      }
      if (String(url).includes('points') && init.method === 'POST') {
        return okJsonLike([]);
      }
      if (String(url).includes('points')) {
        return okJson([mkPoint('a', { name: '云端新', updatedAt: 200 }), mkPoint('c')]);
      }
      return okJsonLike({});
    });

    const { result } = renderHook(() => usePoints('main'));
    // 等合并结果落定（c 是云端独有点，出现即证明拉云合并完成）
    await waitFor(() => expect(result.current.points.map((p) => p.id)).toContain('c'));
    const ids = result.current.points.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(result.current.points.find((p) => p.id === 'a').name).toBe('云端新');
    // 合并与云端不同 → 回推发生
    const posts = fetchMock.mock.calls.filter((c) => c[1] && c[1].method === 'POST' && String(c[0]).includes('points'));
    expect(posts.length).toBeGreaterThanOrEqual(1);
  });

  it('空云库守卫：云端 [] 不清空本地', async () => {
    storageMock.__reset();
    fetchMock.mockReset();
    localStorage.setItem('earth_terminal_custom_points', JSON.stringify([mkPoint('keep')]));
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ username: '站长' }) })
      .mockResolvedValueOnce(okJson([]));

    const { result } = renderHook(() => usePoints('main'));
    await waitFor(() => expect(result.current.isCloudSyncing).toBe(false));
    expect(result.current.points.map((p) => p.id)).toEqual(['keep']);
  });

  it('会话过期自愈：写云 401 → session 置空', async () => {
    storageMock.__reset();
    fetchMock.mockReset();
    fetchMock.mockImplementation((url, init = {}) => {
      if (String(url).includes('auth')) {
        return okJsonLike({ username: '站长' });
      }
      if (String(url).includes('points') && init.method === 'POST') {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
      }
      return okJson([mkPoint('seed')]);
    });

    const { result } = renderHook(() => usePoints('main'));
    await waitFor(() => expect(result.current.session).toBe('站长'));

    act(() => {
      result.current.updatePoints([mkPoint('seed', { name: '改名' })]);
    });
    await waitFor(() => expect(result.current.session).toBeNull());
    // 点位更新保留在本地
    expect(result.current.points[0].name).toBe('改名');
  });

  it('登出：清 session，点位保留', async () => {
    storageMock.__reset();
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ username: '站长' }) })
      .mockResolvedValueOnce(okJson([]));
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });

    const { result } = renderHook(() => usePoints('main'));
    await waitFor(() => expect(result.current.session).toBe('站长'));

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.session).toBeNull();
    expect(Array.isArray(result.current.points)).toBe(true);
  });
});
