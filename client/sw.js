// GRAVETIDE's service worker (owner, 2026-10-15: «все должно подгружаться быстро»): the game's pictures and its code
// kept on the phone, so a second visit shows them at once.
//  - The versioned pictures (`/assets/…?v=…`, client/src/assets.ts) are kept: an address that never changes, so they
//    are served from the store first and never go stale. A reworked picture is a new address. That takes in the AVIF
//    twins and the sheets (docs/33: tools/art/pack_assets.py), and a CDN's host when ASSET_ORIGIN sets one.
//  - The bundle's files (`/dist/<name>-<hash>.js`, tools/build-client.ts; prod 2026-10-25: phones on mobile data could
//    not start the game) the same way: named by their content, kept, served from the store first; a visit on a weak
//    network then fetches nothing of the code at all. The page sends this build's list once the game is up, and the
//    files of the older builds go.
//  - Never the page, the modules of the sources, the styles, the manifest, the films (asked in ranges), the API or the
//    socket: those go to the network as they would without this worker (the server's ETag answers «not modified»).
//  - Its stores have a version: a new worker drops the stores of the old ones; the page sends the manifest's addresses
//    now and then, and pictures no longer in it are dropped.

const STORE = 'gt-art-v1';
const CODE = 'gt-code-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== STORE && k !== CODE && k.startsWith('gt-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

const KEEP = /\.(webp|png|jpg|avif)$/;
const BUNDLE = /^\/dist\/[\w-]+-[A-Z0-9]{8}\.js$/;

/** From the store first; else from the network, kept when it came whole. */
async function kept(storeName, req, key) {
  const store = await caches.open(storeName);
  const hit = await store.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200 && res.type !== 'opaque') store.put(key, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && BUNDLE.test(url.pathname)) {
    // (a retried import's `?r=` is the same file)
    e.respondWith(kept(CODE, req, url.origin + url.pathname));
    return;
  }
  // (this page's host, or the pictures' CDN — ASSET_ORIGIN, docs/33: asked with CORS, so its answers can be kept)
  if (!url.pathname.startsWith('/assets/') || !url.searchParams.has('v') || !KEEP.test(url.pathname)) return;
  if (url.origin !== self.location.origin && req.mode !== 'cors') return;
  e.respondWith(kept(STORE, req, url.href));
});

// The page's lists: of the pictures it may still ask for (the rest of the store goes), and of this build's code files.
self.addEventListener('message', (e) => {
  const m = e.data;
  if (!m || !Array.isArray(m.keep) || (m.t !== 'prune' && m.t !== 'code')) return;
  e.waitUntil((async () => {
    const keep = new Set(m.keep.map((p) => new URL(p, self.location.origin).href));
    const store = await caches.open(m.t === 'code' ? CODE : STORE);
    for (const r of await store.keys()) if (!keep.has(r.url)) await store.delete(r);
  })());
});
