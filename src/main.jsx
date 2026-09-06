import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import * as Sentry from "@sentry/react";
import './utils/mapboxDebug'; // 🔍 加载 Mapbox 诊断工具

// 🛰️ Sentry 初始化：DSN 走环境变量，缺失时跳过（本地/未配置环境不报错）
// sendDefaultPii 设为 false：不再自动收集访客 IP 等默认 PII（最小化原则）
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,

    // (可选) 你还可以加上这个来监控性能，看看地图加载有多慢
    // tracesSampleRate: 1.0,
  });
}




// 📱 PWA Service Worker：应用外壳离线能力（UI/收藏点断网可用）。
// 仅生产注册——本地 dev 的 SW 会把热更新缓存住，弊大于利
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 注册失败不影响主应用 */ });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
