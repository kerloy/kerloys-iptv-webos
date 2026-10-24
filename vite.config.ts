import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import type { Plugin } from 'vite';

/**
 * Local dev proxy middleware so browser testing at http://localhost:5173
 * can fetch Xtream Codes, M3U playlists, and Subtitle URLs without CORS errors.
 * On actual LG webOS TVs, apps run from file:// and bypass CORS natively.
 */
function corsProxyPlugin(): Plugin {
  return {
    name: 'local-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const target = reqUrl.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }
          const response = await fetch(target, {
            method: req.method || 'GET',
            headers: {
              'User-Agent': 'KerloyIPTV-webOS/1.0 (LG SmartTV; webOS 5.x)',
              Accept: '*/*',
            },
          });
          res.statusCode = response.status;
          res.setHeader('Access-Control-Allow-Origin', '*');
          const contentType = response.headers.get('content-type');
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }
          const arrayBuffer = await response.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err: unknown) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Proxy request failed',
            })
          );
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    legacy({
      // webOS 5.x (2020 LG TVs) runs Chromium 68
      targets: ['chrome >= 68'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
    }),
    corsProxyPlugin(),
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    host: true,
  },
});
