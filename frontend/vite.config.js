import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3025,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8085',
        changeOrigin: true,
      },
    },
  },
  // ponytail: enable preview server with proxy for lightweight bare-metal deployment
  preview: {
    port: 3025,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8085',
        changeOrigin: true,
      },
    },
  },
})
