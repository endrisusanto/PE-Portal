import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ponytail: lightweight reverse proxy config forwarding real client IP to backend
const apiProxyConfig = {
  target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8085',
  changeOrigin: true,
  xfwd: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      const remote = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      const rawIp = (Array.isArray(remote) ? remote[0] : remote.split(',')[0]).trim();
      const cleanIp = rawIp.replace(/^::ffff:/, '');
      if (cleanIp) {
        proxyReq.setHeader('X-Real-IP', cleanIp);
        proxyReq.setHeader('X-Forwarded-For', cleanIp);
      }
    });
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3025,
    host: true,
    proxy: {
      '/api': apiProxyConfig,
    },
  },
  // ponytail: enable preview server with proxy for lightweight bare-metal deployment
  preview: {
    port: 3025,
    host: true,
    proxy: {
      '/api': apiProxyConfig,
    },
  },
})
