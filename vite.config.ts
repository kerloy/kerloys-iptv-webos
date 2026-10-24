import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Cache resolved 302 CDN redirect URLs for VOD (.mp4 / .mkv) streams for 10 minutes
 * so browser Range requests (seeking/buffering) hit the edge CDN token URL directly
 * instead of generating new tokens on the main Xtream portal on every chunk.
 */
const redirectCache = new Map<
  string,
  { finalUrl: string; cookies: string[]; expiresAt: number }
>();

function requestWithRedirects(
  targetUrl: string,
  options: {
    method: string;
    headers: Record<string, string>;
    maxRedirects?: number;
    cookies?: string[];
    originalTarget?: string;
  }
): Promise<{ res: IncomingMessage; finalUrl: string; req: http.ClientRequest }> {
  return new Promise((resolve, reject) => {
    const maxRedirects = options.maxRedirects ?? 8;
    const cookies = options.cookies ?? [];
    const originalTarget = options.originalTarget ?? targetUrl;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqHeaders: Record<string, string> = {
      ...options.headers,
      Host: parsedUrl.host,
    };
    if (cookies.length > 0) {
      reqHeaders['Cookie'] = cookies.join('; ');
    }

    const clientReq = transport.request(
      parsedUrl,
      {
        method: options.method,
        headers: reqHeaders,
        insecureHTTPParser: true,
        rejectUnauthorized: false,
        timeout: 25000,
      },
      (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 200;
        const location = upstreamRes.headers.location;

        const setCookie = upstreamRes.headers['set-cookie'];
        if (Array.isArray(setCookie)) {
          setCookie.forEach((c) => {
            const pair = c.split(';')[0];
            if (pair && !cookies.includes(pair)) cookies.push(pair);
          });
        }

        if (
          [301, 302, 303, 307, 308].includes(statusCode) &&
          location &&
          maxRedirects > 0
        ) {
          upstreamRes.resume();
          let nextUrl: string;
          try {
            nextUrl = new URL(location, targetUrl).toString();
          } catch {
            nextUrl = location;
          }
          console.log(`[IPTV Proxy] Redirect (${statusCode}) -> ${nextUrl}`);
          requestWithRedirects(nextUrl, {
            ...options,
            maxRedirects: maxRedirects - 1,
            cookies,
            originalTarget,
          }).then(resolve, reject);
          return;
        }

        // Cache resolved CDN URL if redirected on a VOD movie/series file
        if (
          targetUrl !== originalTarget &&
          statusCode >= 200 &&
          statusCode < 300 &&
          /\.(mp4|mkv|avi|mov)(\?|$)/i.test(targetUrl)
        ) {
          redirectCache.set(originalTarget, {
            finalUrl: targetUrl,
            cookies,
            expiresAt: Date.now() + 10 * 60_000,
          });
        }

        resolve({ res: upstreamRes, finalUrl: targetUrl, req: clientReq });
      }
    );

    clientReq.on('error', (err) => reject(err));
    clientReq.on('timeout', () => {
      clientReq.destroy(new Error('Upstream IPTV server connection timeout'));
    });
    clientReq.end();
  });
}

function corsProxyPlugin(): Plugin {
  return {
    name: 'local-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.end();
          return;
        }

        const reqUrl = new URL(req.url || '', 'http://localhost');
        const rawTarget = reqUrl.searchParams.get('url');
        const forceTranscode = reqUrl.searchParams.get('transcode'); // 'aac' | 'h264' | 'mp4' | 'off'
        const startOffsetSec = Number(reqUrl.searchParams.get('start') || 0);

        if (!rawTarget) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        // Check if we already have a cached CDN token URL for this VOD file
        const cached = redirectCache.get(rawTarget);
        const effectiveTarget =
          cached && cached.expiresAt > Date.now() ? cached.finalUrl : rawTarget;
        const initialCookies =
          cached && cached.expiresAt > Date.now() ? [...cached.cookies] : [];

        const lowerRawTarget = rawTarget.toLowerCase().split('?')[0];
        const isVodMkvOrAvi =
          lowerRawTarget.endsWith('.mkv') ||
          lowerRawTarget.endsWith('.avi') ||
          forceTranscode === 'mp4';

        // 1. For VOD .MKV / .AVI (or explicit mp4 remux), let ffmpeg read the resolved HTTP URL directly
        // and remux into hardware-accelerated Fragmented MP4 (-f mp4) for native <video> playback!
        if (isVodMkvOrAvi && ffmpegPath && forceTranscode !== 'off') {
          try {
            let vodFinalUrl = effectiveTarget;
            if (vodFinalUrl === rawTarget) {
              // Resolve the 302 redirect once so ffmpeg connects directly to the edge CDN
              const probe = await requestWithRedirects(rawTarget, {
                method: 'GET',
                headers: {
                  'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
                  Accept: '*/*',
                },
                originalTarget: rawTarget,
              });
              vodFinalUrl = probe.finalUrl;
              probe.res.destroy();
              probe.req.destroy();
            }

            const seekArgs =
              startOffsetSec > 0 ? ['-ss', String(Math.floor(startOffsetSec))] : [];

            const ffArgs = [
              '-hide_banner',
              '-loglevel',
              'error',
              '-user_agent',
              'VLC/3.0.20 LibVLC/3.0.20',
              '-reconnect',
              '1',
              '-reconnect_streamed',
              '1',
              '-reconnect_delay_max',
              '5',
              ...seekArgs,
              '-i',
              vodFinalUrl,
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-ac',
              '2',
              '-movflags',
              'frag_keyframe+empty_moov+default_base_moof',
              '-f',
              'mp4',
              'pipe:1',
            ];

            console.log(
              `[IPTV Proxy] VOD Fragmented-MP4 Remux (copy-video + AAC) via ffmpeg: ${lowerRawTarget.slice(-40)}`
            );

            const ffProc = spawn(ffmpegPath, ffArgs, {
              stdio: ['ignore', 'pipe', 'pipe'],
            });

            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'video/mp4');

            ffProc.stdout.pipe(res);
            ffProc.stderr.on('data', (errChunk: Buffer) => {
              const msg = errChunk.toString('utf8').trim();
              if (msg) console.warn(`[ffmpeg-vod] ${msg}`);
            });

            const cleanup = () => {
              try {
                ffProc.kill('SIGKILL');
              } catch {}
            };
            req.on('close', cleanup);
            res.on('close', cleanup);
            ffProc.on('close', () => {
              if (!res.writableEnded) res.end();
            });
            return;
          } catch (err) {
            console.error('[IPTV Proxy VOD Remux Error]', err);
          }
        }

        const forwardHeaders: Record<string, string> = {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
          Accept: '*/*',
          Connection: 'keep-alive',
        };

        if (req.headers.range && !forceTranscode) {
          forwardHeaders['Range'] = String(req.headers.range);
        }
        if (req.headers['api-key']) {
          forwardHeaders['Api-Key'] = String(req.headers['api-key']);
        }
        if (req.headers['content-type']) {
          forwardHeaders['Content-Type'] = String(req.headers['content-type']);
        }

        try {
          const {
            res: upstreamRes,
            finalUrl,
            req: upstreamReq,
          } = await requestWithRedirects(effectiveTarget, {
            method: req.method || 'GET',
            headers: forwardHeaders,
            cookies: initialCookies,
            originalTarget: rawTarget,
          });

          const statusCode = upstreamRes.statusCode || 200;
          const contentType = String(upstreamRes.headers['content-type'] || '').toLowerCase();

          // If cached CDN token expired (403/401/404), evict cache and retry once on rawTarget
          if (
            effectiveTarget !== rawTarget &&
            (statusCode === 401 || statusCode === 403 || statusCode === 404)
          ) {
            redirectCache.delete(rawTarget);
            upstreamRes.destroy();
            upstreamReq.destroy();
            res.statusCode = 502;
            res.end();
            return;
          }

          console.log(
            `[IPTV Proxy] ${statusCode} | ${contentType || 'stream'} | ${rawTarget.slice(0, 95)}`
          );

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader(
            'Access-Control-Expose-Headers',
            'Content-Length, Content-Range, Accept-Ranges, X-Final-Url'
          );
          res.setHeader('X-Final-Url', finalUrl);

          const lowerFinal = finalUrl.toLowerCase().split('?')[0];
          const isLiveMpegTs =
            contentType.includes('mp2t') ||
            lowerFinal.endsWith('.ts') ||
            lowerRawTarget.endsWith('.ts');

          // 2. For Live TV MPEG-TS (.ts) streams, remux Audio (AC-3/E-AC-3/MP2 -> AAC) via ffmpeg
          if (
            statusCode >= 200 &&
            statusCode < 300 &&
            ffmpegPath &&
            forceTranscode !== 'off' &&
            (isLiveMpegTs || forceTranscode === 'aac' || forceTranscode === 'h264')
          ) {
            const videoCodecArgs =
              forceTranscode === 'h264'
                ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency']
                : ['-c:v', 'copy', '-bsf:v', 'dump_extra'];

            const ffArgs = [
              '-hide_banner',
              '-loglevel',
              'error',
              '-fflags',
              '+genpts+igndts+discardcorrupt+nobuffer',
              '-flags',
              'low_delay',
              '-i',
              'pipe:0',
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              ...videoCodecArgs,
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-ac',
              '2',
              '-f',
              'mpegts',
              'pipe:1',
            ];

            console.log(
              `[IPTV Proxy] Live TS Audio->AAC (${forceTranscode || 'copy-video'}) via ffmpeg for ${lowerRawTarget.slice(-35)}`
            );

            const ffProc = spawn(ffmpegPath, ffArgs, {
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'video/mp2t');

            upstreamRes.pipe(ffProc.stdin);
            ffProc.stdout.pipe(res);

            ffProc.stdin.on('error', () => {});
            ffProc.stderr.on('data', (errChunk: Buffer) => {
              const msg = errChunk.toString('utf8').trim();
              if (msg && !msg.includes('non-existing PPS') && !msg.includes('decode_slice_header')) {
                console.warn(`[ffmpeg-ts] ${msg}`);
              }
            });

            const cleanup = () => {
              try {
                ffProc.kill('SIGKILL');
              } catch {}
              upstreamRes.destroy();
              upstreamReq.destroy();
            };

            req.on('close', cleanup);
            res.on('close', cleanup);
            ffProc.on('close', () => {
              if (!res.writableEnded) res.end();
            });
            return;
          }

          req.on('close', () => {
            upstreamRes.destroy();
            upstreamReq.destroy();
          });

          const isBinaryVideo =
            contentType.includes('video/') ||
            contentType.includes('audio/') ||
            contentType.includes('mp2t') ||
            contentType.includes('octet-stream') ||
            lowerFinal.endsWith('.ts') ||
            lowerFinal.endsWith('.mp4') ||
            lowerFinal.endsWith('.mkv');

          const mightBeHlsManifest =
            !isBinaryVideo &&
            (lowerFinal.includes('.m3u8') ||
              lowerRawTarget.includes('.m3u8') ||
              contentType.includes('mpegurl') ||
              contentType.includes('x-mpegurl'));

          if (mightBeHlsManifest) {
            const chunks: Buffer[] = [];
            let totalBytes = 0;
            let checkedFirstChunk = false;
            let isTextPlaylist = false;

            upstreamRes.on('data', (chunk: Buffer) => {
              if (!checkedFirstChunk) {
                checkedFirstChunk = true;
                const preview = chunk.subarray(0, 64).toString('utf8').trimStart();
                if (preview.startsWith('#EXTM3U')) {
                  isTextPlaylist = true;
                } else {
                  isTextPlaylist = false;
                  res.statusCode = statusCode;
                  res.setHeader('Content-Type', contentType || 'video/mp2t');
                  res.write(chunk);
                  return;
                }
              }

              if (isTextPlaylist) {
                chunks.push(chunk);
                totalBytes += chunk.length;
                if (totalBytes > 5 * 1024 * 1024) {
                  upstreamRes.destroy();
                }
              } else if (!res.writableEnded) {
                res.write(chunk);
              }
            });

            upstreamRes.on('end', () => {
              if (!checkedFirstChunk) {
                res.statusCode = statusCode;
                res.end();
                return;
              }

              if (!isTextPlaylist) {
                if (!res.writableEnded) res.end();
                return;
              }

              const fullText = Buffer.concat(chunks).toString('utf8');
              const rewritten = fullText
                .split(/\r?\n/)
                .map((line) => {
                  const trimmed = line.trim();
                  if (!trimmed) return line;

                  if (trimmed.startsWith('#')) {
                    return line.replace(/URI="([^"]+)"/gi, (_, uriVal: string) => {
                      try {
                        const resolved = new URL(uriVal, finalUrl).toString();
                        return `URI="/__proxy?url=${encodeURIComponent(resolved)}"`;
                      } catch {
                        return `URI="${uriVal}"`;
                      }
                    });
                  }

                  try {
                    const resolved = new URL(trimmed, finalUrl).toString();
                    return `/__proxy?url=${encodeURIComponent(resolved)}`;
                  } catch {
                    return line;
                  }
                })
                .join('\n');

              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
              res.end(rewritten);
            });

            upstreamRes.on('error', () => {
              if (!res.writableEnded) res.end();
            });
            return;
          }

          // Direct binary stream piping (.mp4 with Range headers, JSON, XML, etc.)
          res.statusCode = statusCode;
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }
          if (upstreamRes.headers['content-length']) {
            res.setHeader('Content-Length', upstreamRes.headers['content-length']);
          }
          if (upstreamRes.headers['content-range']) {
            res.setHeader('Content-Range', upstreamRes.headers['content-range']);
          }
          if (upstreamRes.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges']);
          }

          upstreamRes.pipe(res);
          upstreamRes.on('error', () => {
            if (!res.writableEnded) res.end();
          });
        } catch (err: unknown) {
          console.error(`[IPTV Proxy Error] ${rawTarget}:`, err);
          if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : 'Proxy request failed',
              })
            );
          } else if (!res.writableEnded) {
            res.end();
          }
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
