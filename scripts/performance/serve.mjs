// Serve production builds for a controlled local comparison. This models the
// active nginx gzip_types; use --gzip-js to include application/javascript.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const [directory, port = '4173', ...flags] = process.argv.slice(2);
if (!directory) throw new Error('Usage: bun scripts/performance/serve.mjs BUILD_DIR [PORT] [--gzip-js]');
const root = path.resolve(directory);
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt' };
// Public runtime configuration only. No private keys or authenticated data.
const config = flags.includes('--public-only') ? 'window.ENV = {};' : await fetch('https://www.talea.website/config.js').then(response => {
  if (!response.ok) throw new Error(`Runtime config: ${response.status}`);
  return response.text();
});
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    let body;
    if (pathname === '/config.js') body = Buffer.from(config);
    else {
      try { body = await readFile(file); }
      catch {
        if (path.extname(pathname)) { response.writeHead(404).end(); return; }
        file = path.join(root, 'index.html');
        body = await readFile(file);
      }
    }
    const type = mime[path.extname(file)] || 'application/octet-stream';
    const compress = body.length >= 1024 && /gzip/.test(request.headers['accept-encoding'] || '')
      && (type.startsWith('text/') || type === 'application/json' || (flags.includes('--gzip-js') && type === 'application/javascript'));
    if (compress) body = gzipSync(body);
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length,
      'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding', ...(compress ? { 'Content-Encoding': 'gzip' } : {}) });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(500).end(); }
}).listen(Number(port), '127.0.0.1', () => console.log(`Performance preview: http://127.0.0.1:${port}`));
