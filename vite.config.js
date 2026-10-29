import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend for the dev proxy (override with API_PROXY to run a second backend side by side)
const API = process.env.API_PROXY || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true
      },
      '/ws': {
        target: API.replace(/^http/, 'ws'),
        ws: true
      }
    }
  },
});
