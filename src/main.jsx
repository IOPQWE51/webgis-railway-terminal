import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://80107cfb684f4223ceb1c5bf60295fca@o4511120233398272.ingest.us.sentry.io/4511120259284992",
  // 允许收集用户默认 PII 数据（比如 IP 地址，方便定位是哪个国家的用户崩了）
  sendDefaultPii: true, 
  
  // (可选) 你还可以加上这个来监控性能，看看地图加载有多慢
  // tracesSampleRate: 1.0, 
});




createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
