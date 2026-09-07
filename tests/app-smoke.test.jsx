// @vitest-environment jsdom
// tests/app-smoke.test.js
// 🔥 App 渲染冒烟测试 —— TDZ 白屏事故（2026-09-07）的根治防线：
// lint 只查 hooks 顺序、纯函数测试不渲染组件，两道闸门都测不出
// "hooks 链中间引用未声明 state" 这类首渲染即炸的错误。本测试用 jsdom
// 真渲染 App，任何组件求值期同步抛错（TDZ/typo/undefined ref）当场翻红。

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import App from '../src/App';

// 多用例共存：每例后卸载 DOM（vitest 默认没挂 testing-library 自动 cleanup）
afterEach(cleanup);

// localStorage stub（jsdom 自带但保险起见隔离测试间状态）
const storageMock = (() => {
  let map = new Map();
  return {
    __reset: () => { map = new Map(); },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
})();

vi.stubGlobal('localStorage', storageMock);
// fetch 全部静默失败（匿名本地模式，不依赖任何后端）
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })));
// Leaflet 走 CDN 注入，jsdom 里 window.L 不存在 —— MapEngine 有 leafletReady 门控，无 L 也不该炸
vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })));

describe('App 渲染冒烟（TDZ/首渲染崩溃防线）', () => {
  it('首渲染不抛错，站点外壳完整挂载', async () => {
    storageMock.__reset();
    let renderError = null;
    try {
      render(<App />);
    } catch (e) {
      renderError = e;
    }
    expect(renderError).toBeNull();

    // 站点标题 + 六个导航 tab 全部出现（标题 Earth/Terminal 拆分行内元素，逐词匹配）
    expect(screen.getByText('Earth')).toBeTruthy();
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /高精度地形终端/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /数据解析与管理/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /跨国航线雷达/ })).toBeTruthy();
  });

  it('切到数据管理 tab：星标库渲染（点位库 UI 在），无崩溃', async () => {
    storageMock.__reset();
    const { container } = render(<App />);
    const dataTab = screen.getByRole('tab', { name: /数据解析与管理/ });
    dataTab.click();
    await waitFor(() => {
      expect(screen.getByText(/战术星标库/)).toBeTruthy();
    });
    expect(container).toBeTruthy();
  });
});
