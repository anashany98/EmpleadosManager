import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { frontmanPlugin } from '@frontman-ai/vite';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  plugins: [
    frontmanPlugin({
      host: 'api.frontman.sh',
      projectRoot: path.resolve(__dirname),
      sourceRoot: path.resolve(__dirname, '..'),
    }),
    react()
  ],
  server: {
    host: true,
    fs: {
      allow: ['..'],
    },
    allowedHosts: [
      '.lhr.life',
      '.local.lt',
      '.trycloudflare.com',
      '.tunnelmole.net',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:16161',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Fix MIME types for ES modules
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
    esbuildOptions: {
      loader: {
        '.js': 'js',
        '.mjs': 'js',
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('node_modules')) {
            return undefined;
          }

          if (normalizedId.includes('/node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/@remix-run/router/') ||
            normalizedId.includes('/node_modules/scheduler/') ||
            normalizedId.includes('/node_modules/react-is/') ||
            normalizedId.includes('/node_modules/use-sync-external-store/')
          ) {
            return 'vendor-react';
          }
          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'vendor-charts';
          }
          if (
            normalizedId.includes('/node_modules/jspdf/') ||
            normalizedId.includes('/node_modules/jspdf-autotable/') ||
            normalizedId.includes('/node_modules/html2canvas/')
          ) {
            return 'vendor-pdf';
          }
          if (normalizedId.includes('/node_modules/date-fns/')) {
            return 'vendor-utils';
          }
          if (normalizedId.includes('/node_modules/framer-motion/') || normalizedId.includes('/node_modules/sonner/')) {
            return 'vendor-ui';
          }
          if (
            normalizedId.includes('/node_modules/axios/') ||
            normalizedId.includes('/node_modules/socket.io-client/') ||
            normalizedId.includes('/node_modules/engine.io-client/')
          ) {
            return 'vendor-network';
          }
          return 'vendor-misc';
        },
      },
    },
  },
  // @ts-expect-error vitest config is consumed by the test runner, not Vite's app config type.
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
