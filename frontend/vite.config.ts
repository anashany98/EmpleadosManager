import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  plugins: [react()],
  server: {
    host: true,
    fs: {
      allow: ['..'],
    },
    allowedHosts: [
      '.lhr.life',
      '.loca.lt',
      '.trycloudflare.com',
      '.tunnelmole.net',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:16161',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // @ts-ignore
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  }
})
