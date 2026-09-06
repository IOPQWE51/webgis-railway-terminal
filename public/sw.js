// sw.js — EarthTerminal 应用外壳 Service Worker
//
// 策略（刻意保守，遵守 Mapbox/Esri 条款：地图瓦片绝不缓存）：
// - 静态资源（/assets/*、图标、manifest、字体 CSS）：cache-first，带后台更新
// - HTML 导航：network-first，离线时回缓存壳（保证断网也能打开 UI 与本地收藏点）
// - /api/*：永不缓存（数据要新鲜，且含鉴权）
// - 第三方域（瓦片/字体文件/Mapbox JS）：永不缓存（版权 + 时效）
//
// 版本纪律：改外壳结构时 bump CACHE_VERSION，旧缓存会在 activate 时清理。

const CACHE_VERSION = 'et-shell-v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;

// 安装：预缓存当前外壳的核心入口（index.html + manifest + 图标 + favicon）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled([
        cache.add(new Request('/?source=pwa', { cache: 'reload' })),
        cache.add(new Request('/manifest.webmanifest', { cache: 'reload' })),
        cache.add(new Request('/favicon.svg', { cache: 'reload' })),
        cache.add(new Request('/icon-192.png', { cache: 'reload' })),
        cache.add(new Request('/icon-512.png', { cache: 'reload' })),
      ])
    ).then(() => self.skipWaiting())
  );
});

// 激活：清掉旧版本缓存，接管所有客户端
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 拦截：按资源类型分流
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只管自己的域；第三方（瓦片/字体文件/Mapbox JS/API）一律直连不缓存
  if (url.origin !== self.location.origin) return;

  // API 调用永远直连（数据新鲜 + 不缓存鉴权内容）
  if (url.pathname.startsWith('/api/')) return;

  // 构建产物（带内容哈希，永不失效）：cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 导航请求（HTML）：network-first，断网回退缓存壳
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/?source=pwa')))
    );
    return;
  }

  // 其余同源资源（图标/manifest 等）：cache-first + 后台刷新
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => hit);
      return hit || fetching;
    })
  );
});
