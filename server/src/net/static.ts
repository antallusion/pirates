// Static file server for the browser client. TypeScript sources (client + shared) are served as
// JavaScript by stripping types with Node's built-in `module.stripTypeScriptTypes` — no bundler,
// no build step, identical source for server and client. Output is cached per file mtime.
//
// Speed (owner, 2026-10-15: «все должно подгружаться быстро»):
//  - the code and the styles go compressed (brotli or gzip, made once per file off the game's thread) and answer «not
//    modified» to a browser that has them (ETag): the ~420 modules were sent whole and uncompressed on every visit;
//  - index.html names every module of the game up front (`modulepreload`), so a phone asks for them all at once
//    instead of one import level after another;
//  - /assets/manifest.v.json is the manifest with every file's version (its size and time): the client asks for
//    `file?v=…`, and such an address is kept by the browser for a year (`immutable`) — a reworked file is a new one.

import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants as zc, gzip } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

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

/** Worth compressing (the pictures and films are compressed already). */
const TEXT = new Set(['.html', '.js', '.ts', '.css', '.json', '.svg']);

interface Mount {
  prefix: string;
  dir: string;
}

interface Entry {
  mtime: number;
  body: Buffer;
  etag: string;
  br?: Promise<Buffer>;
  gz?: Promise<Buffer>;
}

const cache = new Map<string, Entry>();

/** A body compressed for this request (made once per file, in the thread pool, and kept). */
async function encoded(e: Entry, req: IncomingMessage): Promise<{ body: Buffer; enc: string | null }> {
  if (e.body.length < 1024) return { body: e.body, enc: null };
  const ae = String(req.headers['accept-encoding'] ?? '');
  try {
    if (/\bbr\b/.test(ae)) {
      e.br ??= brotli(e.body, { params: { [zc.BROTLI_PARAM_QUALITY]: 8, [zc.BROTLI_PARAM_SIZE_HINT]: e.body.length } });
      return { body: await e.br, enc: 'br' };
    }
    if (/\bgzip\b/.test(ae)) {
      e.gz ??= gz(e.body, { level: 9 });
      return { body: await e.gz, enc: 'gzip' };
    }
  } catch {
    /* sent as it is */
  }
  return { body: e.body, enc: null };
}

export function createStaticHandler(root: string) {
  const mounts: Mount[] = [
    { prefix: '/shared/', dir: resolve(root, 'shared') },
    { prefix: '/assets/', dir: resolve(root, 'assets') },
    { prefix: '/', dir: resolve(root, 'client') },
  ];
  const clientDir = resolve(root, 'client');
  const sharedDir = resolve(root, 'shared');
  const assetsDir = resolve(root, 'assets');

  // ---- the versioned manifest (looked at again at most once a minute)
  let vman: { at: number; mtime: number; entry: Entry } | null = null;
  let vmanBusy: Promise<Entry> | null = null;
  async function versionedManifest(): Promise<Entry> {
    const file = join(assetsDir, 'manifest.json');
    const st = await stat(file);
    if (vman && vman.mtime === st.mtimeMs && Date.now() - vman.at < 60_000) return vman.entry;
    vmanBusy ??= (async () => {
      try {
        const m = JSON.parse(await readFile(file, 'utf8')) as { assets: Record<string, { local: string; rev?: number }> };
        const out: { assets: Record<string, unknown> } = { assets: {} };
        await Promise.all(Object.entries(m.assets).map(async ([id, e]) => {
          // what the client reads only (the painter's job ids and the dead CDN's addresses stay home)
          const rest: Record<string, unknown> = { local: e.local };
          for (const k of ['rev', 'slips', 'anchor', 'foot'] as const) if ((e as Record<string, unknown>)[k] !== undefined) rest[k] = (e as Record<string, unknown>)[k];
          try {
            const s = await stat(join(assetsDir, e.local));
            rest.v = `${e.rev ? `${e.rev}.` : ''}${s.size.toString(36)}${Math.floor(s.mtimeMs / 1000).toString(36)}`;
            // a phone's half-size copy beside it (tools/art/small_tex.py): its own version
            const half = e.local.replace(/\.webp$/, '.m.webp');
            if (half !== e.local) {
              const h = await stat(join(assetsDir, half)).catch(() => null);
              if (h) rest.m = `${h.size.toString(36)}${Math.floor(h.mtimeMs / 1000).toString(36)}`;
            }
          } catch {
            /* a file not there: its plain address */
          }
          out.assets[id] = rest;
        }));
        const body = Buffer.from(JSON.stringify(out), 'utf8');
        const entry: Entry = { mtime: st.mtimeMs, body, etag: `W/"m${hash(body)}"` };
        vman = { at: Date.now(), mtime: st.mtimeMs, entry };
        return entry;
      } finally {
        vmanBusy = null;
      }
    })();
    return vmanBusy;
  }

  // ---- the modules of the game, for index.html's preload list (looked at again at most every ten seconds)
  // The build: one version for all the modules (their times and sizes). The page asks for `main.ts?b=<build>`, and each
  // module served so has its own imports carried to the same build — every address of a build never changes, so the
  // browser keeps them for good: a second visit asks the server for no module at all (before: some 420 «not modified»).
  let graph: { at: number; list: string[]; build: string } | null = null;
  async function moduleList(): Promise<string[]> {
    return (await moduleGraph()).list;
  }
  async function moduleGraph(): Promise<{ list: string[]; build: string }> {
    if (graph && Date.now() - graph.at < 10_000) return graph;
    const seen = new Set<string>();
    const order: string[] = [];
    const stamps = new Map<string, string>();
    const walk = async (url: string): Promise<void> => {
      if (seen.has(url)) return;
      seen.add(url);
      const file = url.startsWith('/shared/') ? join(sharedDir, url.slice(8)) : join(clientDir, url.slice(1));
      let src: string;
      try {
        src = await readFile(file, 'utf8');
      } catch {
        return;
      }
      order.push(url);
      try {
        const st = await stat(file);
        stamps.set(url, `${st.size}.${Math.floor(st.mtimeMs)}`);
      } catch {
        /* gone since */
      }
      const deps: string[] = [];
      // the static imports and re-exports that stay once the types are stripped (`import type` goes)
      const re = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+\.ts)['"]/gm;
      for (let m = re.exec(src); m; m = re.exec(src)) deps.push(new URL(m[1], 'http://x' + url).pathname);
      await Promise.all(deps.map(walk));
    };
    await walk('/src/main.ts');
    const build = hash(Buffer.from([...stamps.entries()].sort().map(([u, v]) => `${u}=${v}`).join('|'), 'utf8'));
    graph = { at: Date.now(), list: order, build };
    return graph;
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const url = new URL(req.url ?? '/', 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    if (path === '/assets/manifest.v.json') {
      try {
        return await send(req, res, await versionedManifest(), '.json', 'no-cache');
      } catch {
        return false;
      }
    }
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
        entry = { mtime: st.mtimeMs, body, etag: `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"` };
        cache.set(file, entry);
      }
      if (path === '/index.html' && !url.searchParams.has('kit')) {
        // every module named up front (the list changes with the code: the page's tag with it)
        const { list, build } = await moduleGraph().catch(() => ({ list: [] as string[], build: '' }));
        const bq = build ? `?b=${build}` : '';
        const links = list.map((u) => `<link rel="modulepreload" href="${u}${bq}">`).join('');
        // the title's key art painted with the page itself, before the game's script is in
        const art = await versionedManifest().then((m) => (JSON.parse(m.body.toString('utf8')) as { assets: Record<string, { local: string; v?: string }> }).assets['art.keyart'], () => undefined);
        const ka = art ? `/assets/${art.local}${art.v ? `?v=${art.v}` : ''}` : '';
        let html = entry.body.toString('utf8').replace('</head>', `${ka ? `<link rel="preload" as="image" href="${ka}" fetchpriority="high">` : ''}${links}\n</head>`);
        if (bq) html = html.replace("import('/src/main.ts')", `import('/src/main.ts${bq}')`);
        if (ka) html = html.replace('<div class="keyart" data-asset="art.keyart">', `<div class="keyart" data-asset="art.keyart" style="background-image:url('${ka}')">`);
        const body = Buffer.from(html, 'utf8');
        const key = `${file}#pre`;
        let pe = cache.get(key);
        if (!pe || pe.etag !== `W/"i${hash(body)}"`) cache.set(key, (pe = { mtime: entry.mtime, body, etag: `W/"i${hash(body)}"` }));
        return await send(req, res, pe, ext, 'no-cache');
      }
      // a module of a build: its imports carried to the same build, kept for good
      const b = ext === '.ts' ? url.searchParams.get('b') : null;
      if (b && /^[a-z0-9]{1,24}$/.test(b)) {
        const key = `${file}?b=${b}`;
        let be = cache.get(key);
        if (!be || be.mtime !== entry.mtime) {
          const body = Buffer.from(withBuild(entry.body.toString('utf8'), b), 'utf8');
          be = { mtime: entry.mtime, body, etag: `W/"b${b}-${hash(body)}"` };
          // (only the build of now is kept in memory; an old page's asks are made afresh)
          if (b === graph?.build) cache.set(key, be);
        }
        return await send(req, res, be, ext, 'public, max-age=31536000, immutable');
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
      // a versioned asset (the manifest's `?v=`) never changes at its address; the rest is asked again each time
      const picture = ext === '.png' || ext === '.webp' || ext === '.jpg' || ext === '.mp4';
      const cc = mount.prefix === '/assets/' && url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : picture ? 'public, max-age=86400' : 'no-cache';
      return await send(req, res, entry, ext, cc);
    } catch {
      return false;
    }
  };
}

/** A module's own imports and re-exports carried to a build (`./x.ts` → `./x.ts?b=…`): the static ones, the dynamic
 *  ones and the bare side-effect ones — the types are stripped already, so only the code's own are left. */
export function withBuild(js: string, b: string): string {
  return js.replace(/(\b(?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"\n]+?\.ts)\2/g, `$1$2$3?b=${b}$2`);
}

/** Answer with a body: «not modified» to a browser that has it, compressed when it is text. */
async function send(req: IncomingMessage, res: ServerResponse, entry: Entry, ext: string, cacheControl: string): Promise<true> {
  const head: Record<string, string | number> = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': cacheControl,
    ETag: entry.etag,
  };
  if (ext === '.mp4') head['Accept-Ranges'] = 'bytes';
  if (TEXT.has(ext)) head['Vary'] = 'Accept-Encoding';
  const inm = req.headers['if-none-match'];
  if (inm && inm.split(/\s*,\s*/).includes(entry.etag)) {
    res.writeHead(304, head).end();
    return true;
  }
  const { body, enc } = TEXT.has(ext) ? await encoded(entry, req) : { body: entry.body, enc: null };
  if (enc) head['Content-Encoding'] = enc;
  head['Content-Length'] = body.length;
  res.writeHead(200, head);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
  return true;
}

/** A short hash of a body (FNV-1a over its bytes). */
function hash(b: Buffer): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) {
    h ^= b[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + b.length.toString(36);
}
