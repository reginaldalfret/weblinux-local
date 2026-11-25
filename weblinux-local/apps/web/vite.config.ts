import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

const DISK_CACHE_DIR = path.resolve(__dirname, '.disk-cache');
if (!fs.existsSync(DISK_CACHE_DIR)) {
  fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'configure-coop-coep-and-disk-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Mandatory headers for SharedArrayBuffer & WebAssembly NOMMU multithreading
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

          const rawUrl = req.url ? req.url.split('?')[0] : '';

          // 1. Intercept /disk/... requests (manifests and ext4 chunks)
          if (rawUrl.startsWith('/disk/')) {
            const diskSubpath = rawUrl.replace(/^\/disk\//, '');
            const localPublicDiskFile = path.resolve(__dirname, 'public/disk', diskSubpath);
            const targetUrl = `https://plasmaontheweb.com/disk/${diskSubpath}`;
            const localCacheFile = path.join(DISK_CACHE_DIR, diskSubpath.replace(/\//g, '_'));

            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // 1.1 First check if the file exists directly in public/disk/
            if (fs.existsSync(localPublicDiskFile)) {
              try {
                const stat = fs.statSync(localPublicDiskFile);
                if (stat.isFile()) {
                  const totalSize = stat.size;
                  const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
                  res.setHeader('Content-Type', diskSubpath.endsWith('.json') ? 'application/json' : 'application/octet-stream');
                  res.setHeader('Accept-Ranges', 'bytes');
                  res.setHeader('ETag', etag);
                  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

                  const rangeHeader = req.headers.range;
                  if (typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
                    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
                    if (!m) {
                      res.statusCode = 416;
                      res.setHeader('Content-Range', `bytes */${totalSize}`);
                      res.end();
                      return;
                    }
                    const start = m[1] === '' ? Math.max(0, totalSize - Number(m[2])) : Number(m[1]);
                    const end = m[2] === '' ? totalSize - 1 : Math.min(totalSize - 1, Number(m[2]));
                    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || end >= totalSize) {
                      res.statusCode = 416;
                      res.setHeader('Content-Range', `bytes */${totalSize}`);
                      res.end();
                      return;
                    }
                    res.statusCode = 206;
                    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
                    res.setHeader('Content-Length', end - start + 1);
                    fs.createReadStream(localPublicDiskFile, { start, end }).pipe(res);
                    return;
                  }

                  res.statusCode = 200;
                  res.setHeader('Content-Length', totalSize);
                  fs.createReadStream(localPublicDiskFile).pipe(res);
                  return;
                }
              } catch (readErr) {
                console.error('[Local Disk Serve Error]:', readErr);
              }
            }

            // Handle manifest.json
            if (diskSubpath.endsWith('manifest.json')) {
              try {
                const remoteRes = await fetch(targetUrl, { cache: 'no-store' });
                if (!remoteRes.ok) {
                  res.statusCode = remoteRes.status;
                  res.end(`Remote manifest returned status ${remoteRes.status}`);
                  return;
                }
                const manifest = await remoteRes.json();
                // Strip remote base so disk-worker.js uses same-origin chunk fetching directly
                delete manifest.base;
                const body = Buffer.from(JSON.stringify(manifest));
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Length', body.length);
                res.statusCode = 200;
                res.end(body);
                return;
              } catch (err: any) {
                console.error('[Manifest Proxy Error]:', err);
                res.statusCode = 502;
                res.end(`Manifest fetch failed: ${err.message}`);
                return;
              }
            }

            // Handle binary chunk files (e.g. 000000, 000001, etc.)
            if (fs.existsSync(localCacheFile)) {
              try {
                const cachedBuf = fs.readFileSync(localCacheFile);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Length', cachedBuf.length);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.statusCode = 200;
                res.end(cachedBuf);
                return;
              } catch (readErr) {
                // fallback to fetch if file read fails
              }
            }

            // Fetch chunk from upstream and cache locally
            try {
              const remoteRes = await fetch(targetUrl);
              if (!remoteRes.ok) {
                res.statusCode = remoteRes.status;
                res.end(`Remote chunk returned ${remoteRes.status}`);
                return;
              }
              const arrayBuf = await remoteRes.arrayBuffer();
              const chunkBuf = Buffer.from(arrayBuf);
              
              // Cache to disk asynchronously
              try {
                fs.writeFileSync(localCacheFile, chunkBuf);
              } catch (writeErr) {
                console.warn('[Disk Cache Write Failed]:', writeErr);
              }

              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', chunkBuf.length);
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.statusCode = 200;
              res.end(chunkBuf);
              return;
            } catch (err: any) {
              console.error('[Chunk Proxy Error]:', err);
              res.statusCode = 502;
              res.end(`Chunk fetch failed: ${err.message}`);
              return;
            }
          }

          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use(async (req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

          const rawUrl = req.url ? req.url.split('?')[0] : '';
          if (rawUrl.startsWith('/disk/')) {
            const diskSubpath = rawUrl.replace(/^\/disk\//, '');
            const localPublicDiskFile = path.resolve(__dirname, 'public/disk', diskSubpath);
            const targetUrl = `https://plasmaontheweb.com/disk/${diskSubpath}`;
            const localCacheFile = path.join(DISK_CACHE_DIR, diskSubpath.replace(/\//g, '_'));

            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (fs.existsSync(localPublicDiskFile)) {
              try {
                const fileBuf = fs.readFileSync(localPublicDiskFile);
                res.setHeader('Content-Type', diskSubpath.endsWith('.json') ? 'application/json' : 'application/octet-stream');
                res.setHeader('Content-Length', fileBuf.length);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.statusCode = 200;
                res.end(fileBuf);
                return;
              } catch (readErr) {}
            }

            if (diskSubpath.endsWith('manifest.json')) {
              try {
                const remoteRes = await fetch(targetUrl, { cache: 'no-store' });
                if (!remoteRes.ok) {
                  res.statusCode = remoteRes.status;
                  res.end(`Remote manifest returned status ${remoteRes.status}`);
                  return;
                }
                const manifest = await remoteRes.json();
                delete manifest.base;
                const body = Buffer.from(JSON.stringify(manifest));
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Length', body.length);
                res.statusCode = 200;
                res.end(body);
                return;
              } catch (err: any) {
                res.statusCode = 502;
                res.end(`Manifest fetch failed: ${err.message}`);
                return;
              }
            }

            if (fs.existsSync(localCacheFile)) {
              try {
                const cachedBuf = fs.readFileSync(localCacheFile);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Length', cachedBuf.length);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.statusCode = 200;
                res.end(cachedBuf);
                return;
              } catch (readErr) {}
            }

            try {
              const remoteRes = await fetch(targetUrl);
              if (!remoteRes.ok) {
                res.statusCode = remoteRes.status;
                res.end(`Chunk fetch status ${remoteRes.status}`);
                return;
              }
              const chunkBuf = Buffer.from(await remoteRes.arrayBuffer());
              try {
                fs.writeFileSync(localCacheFile, chunkBuf);
              } catch (writeErr) {}

              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', chunkBuf.length);
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.statusCode = 200;
              res.end(chunkBuf);
              return;
            } catch (err: any) {
              res.statusCode = 502;
              res.end(`Chunk fetch failed: ${err.message}`);
              return;
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
