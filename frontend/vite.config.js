import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: 'VITE_',
  server: {
    port:process.env.VITE_PORT ?? 8050,
    host: process.env.VITE_URL ?? '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})