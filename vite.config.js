import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // 📦 厂商分包：框架与地图引擎各自成块，
        // 业务代码迭代时用户无需重新下载大体积第三方库
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'mapbox-gl': ['mapbox-gl'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true, // 如果端口被占用则失败，而不是自动切换端口
    host: true
  }
})
