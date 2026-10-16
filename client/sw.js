// GRAVETIDE's service worker (owner, 2026-10-15: «все должно подгружаться быстро»): the game's pictures kept on the
// phone, so a second visit shows them at once.
//  - Only the versioned pictures (`/assets/…?v=…`, client/src/assets.ts) are kept: an address that never changes, so
//    they are served from the store first and never go stale. A reworked picture is a new address. That takes in the
//    AVIF twins and the sheets (docs/33: tools/art/pack_assets.py), and a CDN's host when ASSET_ORIGIN sets one.
//  - Never the page, the code, the styles, the manifest, the films (asked in ranges), the API or the socket: those go
//    to the network as they would without this worker (the server's ETag answers «not modified»).
//  - Its store has a version: a new worker drops the stores of the old ones; the page sends the manifest's addresses
//    now and then, and pictures no longer in it are dropped.

const STORE = 'gt-art-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== STORE && k.startsWith('gt-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

const KEEP = /\.(webp|png|jpg|avif)$/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // (this page's host, or the pictures' CDN — ASSET_ORIGIN, docs/33: asked with CORS, so its answers can be kept)
  if (!url.pathname.startsWith('/assets/') || !url.searchParams.has('v') || !KEEP.test(url.pathname)) return;
  if (url.origin !== self.location.origin && req.mode !== 'cors') return;
  e.respondWith((async () => {
    const store = await caches.open(STORE);
    const hit = await store.match(url.href);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.status === 200 && res.type !== 'opaque') store.put(url.href, res.clone()).catch(() => {});
    return res;
  })());
});

// The page's list of the pictures it may still ask for: the rest of the store goes.
self.addEventListener('message', (e) => {
  const m = e.data;
  if (!m || m.t !== 'prune' || !Array.isArray(m.keep)) return;
  e.waitUntil((async () => {
    const keep = new Set(m.keep.map((p) => new URL(p, self.location.origin).href));
    const store = await caches.open(STORE);
    for (const r of await store.keys()) if (!keep.has(r.url)) await store.delete(r);
  })());
});
