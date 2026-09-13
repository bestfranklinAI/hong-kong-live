import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const cesiumRoot = dirname(require.resolve('cesium/package.json'));
const allowedHosts = ['franklins-macbook-pro.seagull-tet.ts.net', 'franklin.seagull-tet.ts.net'];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ['Workers', 'Assets', 'Widgets', 'ThirdParty'].map((directory) => ({
        src: normalizePath(join(cesiumRoot, 'Build/Cesium', directory)),
        dest: 'cesium',
      })),
    }),
  ],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
  server: {
    allowedHosts,
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  preview: {
    allowedHosts,
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: { target: 'es2022' },
});
