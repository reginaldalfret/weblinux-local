import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'configure-coop-coep-and-disk-proxy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Mandatory headers for SharedArrayBuffer & WebAssembly NOMMU multithreading
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

          // Proxy remote disk chunks when requested locally
          if (req.url && req.url.startsWith('/disk-proxy/')) {
            const remoteChunk = req.url.replace('/disk-proxy/', '');
            const targetUrl = `https://disk.plasmaontheweb.com/disk/${remoteChunk}`;
            
            fetch(targetUrl)
              .then(remoteRes => {
                res.statusCode = remoteRes.status;
                remoteRes.headers.forEach((val, key) => {
                  if (key.toLowerCase() !== 'content-encoding') {
                    res.setHeader(key, val);
                  }
                });
                // Ensure CORS and CORP headers are present
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                res.setHeader('Access-Control-Allow-Origin', '*');
                
                return remoteRes.arrayBuffer();
              })
              .then(buf => {
                res.end(Buffer.from(buf));
              })
              .catch(err => {
                console.error('[Disk Proxy Error]:', err);
                res.statusCode = 502;
                res.end('Disk proxy failed: ' + err.message);
              });
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
