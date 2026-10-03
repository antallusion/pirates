// Static file server for the browser client. TypeScript sources (client + shared) are served as
// JavaScript by stripping types with Node's built-in `module.stripTypeScriptTypes` — no bundler,
// no build step, identical source for server and client. Output is cached per file mtime.

import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

interface Mount {
  prefix: string;
  dir: string;
}

const cache = new Map<string, { mtime: number; body: Buffer }>();

export function createStaticHandler(root: string) {
  const mounts: Mount[] = [
    { prefix: '/shared/', dir: resolve(root, 'shared') },
    { prefix: '/assets/', dir: resolve(root, 'assets') },
    { prefix: '/', dir: resolve(root, 'client') },
  ];

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const url = new URL(req.url ?? '/', 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const mount = mounts.find((m) => path.startsWith(m.prefix));
    if (!mount) return false;
    const rel = normalize(path.slice(mount.prefix.length));
    const file = join(mount.dir, rel);
    if (!file.startsWith(mount.dir + sep) && file !== mount.dir) {
      res.writeHead(403).end();
      return true;
    }
    try {
      const st = await stat(file);
      if (!st.isFile()) return false;
      const ext = extname(file);
      let entry = cache.get(file);
      if (!entry || entry.mtime !== st.mtimeMs) {
        let body = await readFile(file);
        if (ext === '.ts') {
          body = Buffer.from(stripTypeScriptTypes(body.toString('utf8'), { mode: 'strip' }), 'utf8');
        }
        entry = { mtime: st.mtimeMs, body };
        cache.set(file, entry);
      }
      // Films are served in ranges (a browser seeks in them, and iOS will not play one served whole).
      const range = ext === '.mp4' ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '') : null;
      if (range) {
        const size = entry.body.length;
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
        if (start >= size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
          return true;
        }
        res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
        if (req.method === 'HEAD') res.end();
        else res.end(entry.body.subarray(start, end + 1));
        return true;
      }
      res.writeHead(200, {
        ...(ext === '.mp4' ? { 'Accept-Ranges': 'bytes' } : {}),
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Content-Length': entry.body.length,
        'Cache-Control': ext === '.png' || ext === '.webp' || ext === '.mp4' ? 'public, max-age=86400' : 'no-cache',
      });
      if (req.method === 'HEAD') res.end();
      else res.end(entry.body);
      return true;
    } catch {
      return false;
    }
  };
}
