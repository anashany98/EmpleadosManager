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
    // MED-011: Vite copia los archivos de `public/` al build
    // output SIN procesarlos (no pasa por Babel/esbuild), así
    // que el `__BUILD_HASH__` no se reemplaza. Este plugin
    // hace la sustitución textual de `__BUILD_HASH__` en
    // `public/sw.js` durante la fase de generación del
    // bundle. Es seguro porque `__BUILD_HASH__` es un
    // identificador único que no aparece en código legítimo
    // del SW.
    {
      name: 'inject-build-hash-into-sw',
      apply: 'build',
      generateBundle(_options, bundle) {
        const buildHash = process.env.GITHUB_SHA
          ? process.env.GITHUB_SHA.slice(0, 12)
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        for (const file of Object.values(bundle)) {
          if (file.type === 'asset' && file.fileName === 'sw.js' && typeof file.source === 'string') {
            file.source = file.source.replace(/__BUILD_HASH__/g, buildHash);
          }
        }
      }
    },
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
        // Vite dev-server proxies /api/* to the backend.
        //
        // Two valid setups:
        //   - Backend running natively:   target = http://localhost:3000  (default)
        //                                 (cd backend && npm run dev)
        //   - Backend running in Docker:  target = http://localhost:16161
        //                                 (the docker-compose.yml port mapping
        //                                 "127.0.0.1:16161:3000")
        //
        // Override with VITE_API_PROXY_TARGET env var when launching the dev
        // server, e.g.:
        //   VITE_API_PROXY_TARGET=http://localhost:16161 npm run dev
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
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
    // Strip `console.log/info/debug` (NOT `console.warn` or
    // `console.error` — those are kept because they are typically
    // used for production error reporting). This is a defense-in-depth
    // measure: even if a developer leaves a `console.log` in the
    // codebase, it will not leak to end users in the production
    // bundle.
    //
    // esbuild's `drop: ['console']` removes ALL console calls, so
    // we use a small esbuild plugin instead to keep `console.warn`
    // and `console.error` intact.
    esbuild: {
      plugins: process.env.NODE_ENV === 'production' ? [
        {
          name: 'strip-debug-console',
          setup(build) {
            build.onLoad({ filter: /\.(ts|tsx|js|jsx)$/ }, async (args) => {
              const fs = await import('node:fs/promises');
              const source = await fs.readFile(args.path, 'utf8');
              // Remove only `console.log(...)` and `console.debug(...)` calls.
              // We deliberately keep `console.warn` and `console.error` for
              // production error visibility.
              const stripped = source
                .replace(/console\.log\s*\(/g, '/* eslint-disable-next-line no-console */ void 0(')
                .replace(/console\.debug\s*\(/g, '/* eslint-disable-next-line no-console */ void 0(')
                .replace(/console\.info\s*\(/g, '/* eslint-disable-next-line no-console */ void 0(');
              return { contents: stripped, loader: 'tsx' };
            });
          }
        }
      ] : []
    },
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
