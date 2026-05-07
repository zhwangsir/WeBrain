import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React 生态核心 — 最底层，不依赖任何其他 chunk
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react-core';
          // Ant Design 全家桶 — 只依赖 react-core
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('/rc-') || id.includes('dayjs')) return 'antd';
          // 动画库 — 只依赖 react-core
          if (id.includes('framer-motion')) return 'motion';
          // 状态管理 + HTTP — 只依赖 react-core
          if (id.includes('zustand') || id.includes('axios')) return 'state';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 8587,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/brain': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
