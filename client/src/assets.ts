// Asset loading (owner, 2026-10-15: «все должно подгружаться быстро и игрок должен видеть уже загрузившиеся ассеты без
// всяких голых текстур»). Images are optional; the game must always render even when every download fails — the
// renderer draws a stand-in while a picture is not in.
//
// Before, the boot asked for all ~3300 pictures at once (167 MB) and measured each on the main thread: the title's key
// art came after the last one (a quarter of an hour on a slow phone line), and every scene's own pictures waited in that
// queue. Now nothing is asked for that is not needed:
//  - a scene's loading screen asks for its list first (priority 0, ui/loader.ts) and waits for it, decoded;
//  - a picture a renderer draws and does not have is asked for next (priority 1): what is on screen comes first;
//  - once the game is in, the rest is fetched slowly in the background into the cache only (no decoding, nothing kept
//    in memory), never on a saving or 2G line — so the next scene's pictures are a cache hit.
// Every file's address carries its version (the server's manifest, server/src/net/static.ts), so the browser and the
// service worker (client/sw.js) keep them for good and a reworked picture is a new address.

import { ICON_STAND_IN } from '../../shared/src/data/armsart.ts';
import { figureStandIn as unitStandIn } from '../../shared/src/data/unitart.ts';
import { FLEET_STAND_IN } from '../../shared/src/data/fleet.ts';

/** Art id → the painted kindred drawn while it is not painted: the yard's new icons (armsart.ts), the fleet of eighty's
 *  new hulls and decks and the premium hulls' creatures (fleet.ts). Painted art always wins. */
const STAND_IN: Record<string, string> = { ...ICON_STAND_IN, ...FLEET_STAND_IN };

interface ManifestEntry {
  local: string;
  remote?: string;
  /** Bumped when the local file is reworked in place (a day's browser cache would keep the old one). */
  rev?: number;
  /** The file's version from the server (its size and time): the address changes with the file. */
  v?: string;
  /** Its phone's half-size copy's version, when there is one. */
  m?: string;
  /** Its AVIF twin's version (tools/art/pack_assets.py), and the half-size copy's: asked for when the browser decodes
   *  AVIF (docs/33). */
  a?: string;
  ma?: string;
  /** Packed in a sheet (tools/art/pack_assets.py): [sheet, x, y, w, h] — a canvas's sprite comes cut from the sheet; an
   *  <img> still asks for its own file. */
  s?: [string, number, number, number, number];
  /** A port painting's slips between its piers: [middle x, width, top y, depth] as shares of the painting. */
  slips?: [number, number, number, number][];
  /** The island screen's pictures (tools/art/isle_iso.py): the plot diamond's bottom vertex in the file, and its plot. */
  anchor?: [number, number];
  foot?: number;
}

interface Manifest {
  cdn?: string;
  /** Where the pictures are served from (ASSET_ORIGIN on the server: a CDN's host), '' for this page's own. */
  origin?: string;
  assets: Record<string, ManifestEntry>;
  sheets?: Record<string, { file: string; v?: string; a?: string; w: number; h: number }>;
}

export interface Sprite {
  img: HTMLImageElement;
  /** Fraction of the image height occupied by the subject (for scaling ships to hull length). */
  extentY: number;
  extentX: number;
  cx: number; // subject centre in image fraction
  cy: number;
}

type Box = Pick<Sprite, 'extentX' | 'extentY' | 'cx' | 'cy'>;

/** A loaded picture; its subject's box is measured the first time it is asked for (most never are). */
class Pic implements Sprite {
  img: HTMLImageElement;
  private box: Box | null = null;
  constructor(img: HTMLImageElement) {
    this.img = img;
  }
  private get b(): Box {
    return (this.box ??= measure(this.img));
  }
  get extentX(): number { return this.b.extentX; }
  get extentY(): number { return this.b.extentY; }
  get cx(): number { return this.b.cx; }
  get cy(): number { return this.b.cy; }
}

const images = new Map<string, Sprite>();
const patterns = new Map<string, CanvasPattern>();
let manifest: Manifest | null = null;
let manifestP: Promise<boolean> | null = null;

function measure(img: HTMLImageElement): Box {
  // Alpha bounding box (works for same-origin or CORS-enabled images; otherwise sensible defaults).
  try {
    const w = 128, h = Math.max(1, Math.round((128 * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) throw new Error('empty');
    return { extentX: (x1 - x0 + 1) / w, extentY: (y1 - y0 + 1) / h, cx: (x0 + x1 + 1) / 2 / w, cy: (y0 + y1 + 1) / 2 / h };
  } catch {
    return { extentX: 0.6, extentY: 0.9, cx: 0.5, cy: 0.5 };
  }
}

// ------------------------------------------------------------------------------------------------ the queue

/** 0: a scene's loading screen waits for it; 1: drawn and missing. (The background's warming is a queue of its own.) */
export type Prio = 0 | 1;

interface Job {
  id: string;
  prio: Prio;
  started: boolean;
  done: Promise<boolean>;
  settle: (ok: boolean) => void;
}

const jobs = new Map<string, Job>();
const queues: [Job[], Job[]] = [[], []];
/** The background's ids to fetch into the cache, and those being fetched. */
const warmQ: string[] = [];
const warming = new Map<string, Promise<void>>();
const warmed = new Set<string>();
/** At most this many pictures in flight at once: HTTP/1.1's six to a host; over HTTP/2 or 3 (one connection, the requests
 *  side by side: gravetidegame.com's nginx) sixteen — on a slow line each picture's round trip was waited out six at a
 *  time (docs/33). */
const MAX_LIVE = (() => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return /^h[23]/.test(nav?.nextHopProtocol ?? '') ? 16 : 6;
  } catch {
    return 6;
  }
})();
/** The background's share: two, and only while no screen is waiting for a picture. */
const MAX_WARM = 2;
let live = 0;
const failed = new Set<string>();
/** Pictures loaded since the page opened (QA, the scenes' static layers). */
let epoch = 0;
const stats = { loaded: 0, warmed: 0, failed: 0, warmBytes: 0 };

/** A phone (a touch screen whose canvas is capped small, renderer.ts): the sea's tiles come at half size. */
const PHONE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && Math.max(screen.width, screen.height) * Math.min(1.5, devicePixelRatio || 1) <= 1800;

/** The browser decodes AVIF (a one-pixel picture tried once, before the manifest is read): the AVIF twins are asked for. */
let AVIF = false;
const avifProbe: Promise<void> = typeof Image === 'undefined' ? Promise.resolve() : new Promise<void>((done) => {
  const img = new Image();
  const t = setTimeout(done, 1500);
  img.onload = () => {
    AVIF = img.naturalWidth > 0;
    clearTimeout(t);
    done();
  };
  img.onerror = () => {
    clearTimeout(t);
    done();
  };
  img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKAAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAMG1kYXQSAAoIGAAGiAhoNCAyGhlHh4Yhh5555oAAAJBAyRxhSytNj1FFTqSg'; // (1×1, Pillow's AVIF)
});

/** The pictures' host: ASSET_ORIGIN's (a CDN) or this page's. */
const origin = () => manifest?.origin ?? '';

/** A file's address with its version: its AVIF twin when the browser takes AVIF (docs/33), a phone's half-size copy
 *  when there is one (tools/art/small_tex.py). */
export function fileUrl(e: ManifestEntry): string {
  const o = origin();
  if (e.m && PHONE) return o + '/assets/' + (AVIF && e.ma ? e.local.replace(/\.webp$/, '.m.avif') + `?v=${e.ma}` : e.local.replace(/\.webp$/, '.m.webp') + `?v=${e.m}`);
  if (AVIF && e.a) return o + '/assets/' + e.local.replace(/\.(webp|png|jpg)$/, '.avif') + `?v=${e.a}`;
  const v = e.v ?? (e.rev ? String(e.rev) : '');
  return o + '/assets/' + e.local + (v ? `?v=${v}` : '');
}

/** A sheet's address (its AVIF twin when the browser takes AVIF). */
function sheetUrl(name: string): string | null {
  const sh = manifest?.sheets?.[name];
  if (!sh) return null;
  return origin() + '/assets/' + (AVIF && sh.a ? sh.file.replace(/\.webp$/, '.avif') + `?v=${sh.a}` : sh.file + (sh.v ? `?v=${sh.v}` : ''));
}

function loadImage(src: string, high: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    // (from a CDN's host: asked with CORS, so the canvas that measures and cuts it is not tainted)
    if (origin()) img.crossOrigin = 'anonymous';
    if (high) (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
    img.onload = () => {
      // decoded off the main thread before it is first drawn (no hitch on the frame that shows it)
      if (img.decode) img.decode().then(() => resolve(img), () => resolve(img));
      else resolve(img);
    };
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function pump(): void {
  // a loading screen's pictures may go past the line's usual share (the browser takes them first: fetchPriority high);
  // the drawn-and-missing ones keep to it
  while (live < MAX_LIVE + 4) {
    let job: Job | undefined;
    for (let p = 0; p < 2 && !job; p++) {
      if (p === 1 && live >= MAX_LIVE) break;
      const q = queues[p];
      while (q.length && !job) {
        const j = q.shift()!;
        if (!j.started && j.prio === p) job = j;
      }
    }
    if (!job) break;
    run(job);
  }
  // the background: only while no screen waits
  if (performance.now() < hushUntil) {
    if (warmQ.length && !hushTimer) hushTimer = setTimeout(() => ((hushTimer = 0), pump()), hushUntil - performance.now() + 20) as unknown as number;
    return;
  }
  while (!live && warming.size < MAX_WARM && warmQ.length) {
    const id = warmQ.shift()!;
    if (images.has(id) || jobs.has(id) || warming.has(id) || warmed.has(id)) continue;
    warm(id);
  }
}

let hushUntil = 0;
let hushTimer = 0;
/** No background fetching for a while (a loading screen is up: its pictures take the whole line); those in flight are
 *  called off and asked again later. */
export function hushWarming(ms: number, after = false): void {
  // (`after`: a loading screen is done — the quiet ends this long from now, whatever it was asked for)
  hushUntil = after ? performance.now() + ms : Math.max(hushUntil, performance.now() + ms);
  if (!after) stopWarming('');
}

/** The background's fetches in flight can be called off: a screen's own pictures take the whole line. */
const warmCtl = new Map<string, AbortController>();
function stopWarming(keep: string): void {
  for (const [id, c] of warmCtl) {
    if (id === keep) continue;
    c.abort();
    warmQ.unshift(id);
  }
}

function warm(id: string): void {
  const e = manifest!.assets[id];
  // a sheet's picture: the sheet is fetched (once for all its pictures)
  const url = (e.s && sheetUrl(e.s[0])) || fileUrl(e);
  if (e.s) for (const [k, x] of Object.entries(manifest!.assets)) if (x.s?.[0] === e.s[0] && k !== id) warmed.add(k);
  const ctl = new AbortController();
  warmCtl.set(id, ctl);
  const p = fetch(url, { priority: 'low', signal: ctl.signal, ...(origin() ? { mode: 'cors' } : {}) } as RequestInit).then(async (r) => {
    if (!r.ok) return;
    const b = await r.arrayBuffer();
    stats.warmed++;
    stats.warmBytes += b.byteLength;
    warmed.add(id);
  }).catch(() => undefined).finally(() => {
    warming.delete(id);
    warmCtl.delete(id);
    // the next one when the line is quiet
    if (warmQ.length) idle(pump);
  });
  warming.set(id, p);
}

const idle = (f: () => void) => ((globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((g: () => void) => setTimeout(g, 50)))(f, { timeout: 1000 });

function run(job: Job): void {
  job.started = true;
  live++;
  const e = manifest?.assets[job.id];
  const finish = (ok: boolean) => {
    live--;
    jobs.delete(job.id);
    job.settle(ok);
    pump();
  };
  if (!e) return finish(false);
  if (e.s && manifest?.sheets?.[e.s[0]]) {
    // packed in a sheet: the sheet once, every picture of it cut out (a canvas the size of the picture)
    fromSheet(e.s[0], job.prio === 0).then((ok) => {
      if (ok && images.has(job.id)) return finish(true);
      // the sheet failed (or lacks it): the picture's own file
      loadImage(fileUrl(e), job.prio === 0).then((img) => {
        images.set(job.id, new Pic(img));
        stats.loaded++;
        epoch++;
        finish(true);
      }, () => {
        failed.add(job.id);
        stats.failed++;
        finish(false);
      });
    });
    return;
  }
  const src = fileUrl(e);
  // being fetched into the cache already: a cache hit once that is in
  const before = warming.get(job.id) ?? Promise.resolve();
  const high = job.prio === 0;
  // our own server only (2026-10-11): a slow first load tries the same file once more
  before.then(() => loadImage(src, high)).catch(() => loadImage(src, high)).then((img) => {
    images.set(job.id, new Pic(img));
    patterns.delete(job.id);
    stats.loaded++;
    epoch++;
    finish(true);
  }, () => {
    failed.add(job.id);
    stats.failed++;
    finish(false);
  });
}

const sheetsIn = new Map<string, Promise<boolean>>();
/** A sheet loaded and cut into its pictures (each a canvas that stands for an <img>: naturalWidth/Height as the image
 *  had — the renderers draw and measure it unchanged). */
function fromSheet(name: string, high: boolean): Promise<boolean> {
  let p = sheetsIn.get(name);
  if (p) return p;
  const url = sheetUrl(name)!;
  p = loadImage(url, high).catch(() => loadImage(url, high)).then((sheet) => {
    for (const [id, e] of Object.entries(manifest!.assets)) {
      if (e.s?.[0] !== name || images.has(id)) continue;
      const [, x, y, w, h] = e.s;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(sheet, x, y, w, h, 0, 0, w, h);
      Object.defineProperties(c, { naturalWidth: { value: w }, naturalHeight: { value: h }, complete: { value: true } });
      images.set(id, new Pic(c as unknown as HTMLImageElement));
      patterns.delete(id);
      stats.loaded++;
    }
    epoch++;
    return true;
  }, () => {
    sheetsIn.delete(name); // (asked again next time; the pictures' own files meanwhile)
    return false;
  });
  sheetsIn.set(name, p);
  return p;
}

/** Ask for a picture at a priority (a higher ask moves a waiting one up). */
function want(id: string, prio: Prio): Promise<boolean> {
  if (images.has(id)) return Promise.resolve(true);
  if (!manifest?.assets[id] || failed.has(id)) return Promise.resolve(false);
  let j = jobs.get(id);
  if (prio === 0 && warmCtl.size) stopWarming(id);
  if (!j) {
    let settle!: (ok: boolean) => void;
    const done = new Promise<boolean>((r) => (settle = r));
    j = { id, prio, started: false, done, settle };
    jobs.set(id, j);
    queues[prio].push(j);
  } else if (!j.started && prio < j.prio) {
    j.prio = prio;
    queues[prio].push(j);
  }
  pump();
  return j.done;
}

// ------------------------------------------------------------------------------------------------ the manifest

/** The manifest (once): the server's own with every file's version, the plain one if that is not there. */
export function loadManifest(): Promise<boolean> {
  manifestP ??= (async () => {
    for (const url of ['/assets/manifest.v.json', '/assets/manifest.json']) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        manifest = (await r.json()) as Manifest;
        await avifProbe;
        return true;
      } catch {
        /* the next */
      }
    }
    return false;
  })();
  return manifestP;
}

/** The boot's few (ui/kit/demo.ts and main.ts): `ids` loaded and decoded, or — with null — the manifest only. */
export async function loadAssets(ids: string[] | null, onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!(await loadManifest())) return;
  if (ids) await ensureAssets(ids, { onProgress });
}

export interface EnsureResult {
  total: number;
  loaded: number;
  timedOut: boolean;
}

/** Load these pictures first and wait for them (a scene's loading screen): the progress as they come; at the timeout
 *  the scene goes on with what is in. Ids not in the manifest are skipped. */
export async function ensureAssets(ids: Iterable<string>, o: { timeout?: number; onProgress?: (done: number, total: number) => void; prio?: Prio } = {}): Promise<EnsureResult> {
  await loadManifest();
  const list = [...new Set(ids)].filter((id) => manifest?.assets[id] && !failed.has(id));
  const total = list.length;
  let done = 0;
  for (const id of list) if (images.has(id)) done++;
  o.onProgress?.(done, total);
  if (done === total) return { total, loaded: done, timedOut: false };
  const all = Promise.all(list.filter((id) => !images.has(id)).map((id) => want(id, o.prio ?? 0).then(() => o.onProgress?.(++done, total))));
  let timedOut = false;
  if (o.timeout) {
    let t: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([all, new Promise<void>((r) => (t = setTimeout(() => ((timedOut = true), r()), o.timeout)))]);
    clearTimeout(t);
  } else await all;
  return { total, loaded: list.filter((id) => images.has(id)).length, timedOut };
}

/** Of these, how many are in. */
export function assetsIn(ids: Iterable<string>): { total: number; loaded: number } {
  let total = 0, loaded = 0;
  for (const id of new Set(ids)) {
    if (!manifest?.assets[id] || failed.has(id)) continue;
    total++;
    if (images.has(id)) loaded++;
  }
  return { total, loaded };
}

/** Pictures the screens draw and wait for, still in flight or queued. */
export function assetsBusy(): number {
  return jobs.size;
}

/** Warm the cache with these in the background (the likely next scene): first in the background's line. */
export function prefetchAssets(ids: Iterable<string>, first = true): void {
  if (!manifest || slowLine()) return;
  const add: string[] = [];
  for (const id of ids) if (manifest.assets[id] && !images.has(id) && !warmed.has(id) && !warming.has(id)) add.push(id);
  if (first) warmQ.unshift(...add);
  else warmQ.push(...add);
  idle(pump);
}

/** The ids of the manifest under a prefix (`unit.`, `isle.`). */
export function assetIds(prefix: string): string[] {
  return manifest ? Object.keys(manifest.assets).filter((id) => id.startsWith(prefix)) : [];
}

/** Whether the picture exists at all (painted, in the manifest) — loaded or not. */
export function hasAsset(id: string): boolean {
  return !!manifest?.assets[id];
}

/** A saving or slow line: no background fetching. */
function slowLine(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (!!c.saveData || c.effectiveType === '2g' || c.effectiveType === 'slow-2g');
}

/** The batch of the owner's sheets of 2026-10-24 (tools/art/pack_oct24.py REV). */
const OCT24_REV = 20261024120000;

/** The background's slow fill (once the game is in): the rest of the pictures into the cache, the likeliest first.
 *  The island screen's pictures and the reference art stay out (the island's own are warmed near her island). */
export function warmAll(): void {
  if (!manifest || slowLine()) return;
  const order = ['ship.', 'flag.', 'fx.', 'part.', 'tex.', 'icon.', 'portrait.', 'unit.', 'card.', 'monster.', 'creature.', 'prop.', 'bg.'];
  const rank = (id: string) => {
    const k = order.findIndex((p) => id.startsWith(p));
    return k < 0 ? order.length : k;
  };
  // (the paintings of 2026-10-24 that only a window shows — the 90-odd harbour headers, the story's cards, the mini-games'
  //  and the hand-overs' scenes, ~12 MB — stay out too: each is fetched when its window opens, docs/ART_TODO.md)
  const shownOnly = (id: string) => (id.startsWith('bg.') || id.startsWith('card.')) && manifest!.assets[id].rev === OCT24_REV;
  const ids = Object.keys(manifest.assets).filter((id) => !id.startsWith('art.reference') && !id.startsWith('isle.') && !shownOnly(id));
  ids.sort((a, b) => rank(a) - rank(b));
  prefetchAssets(ids, false);
}

/** QA: the pictures loaded, by their kind (`unit`, `icon`, …), and those still asked for. */
export function assetKinds(): { loaded: Record<string, number>; asked: string[] } {
  const loaded: Record<string, number> = {};
  for (const id of images.keys()) {
    const k = id.split('.')[0];
    loaded[k] = (loaded[k] ?? 0) + 1;
  }
  return { loaded, asked: [...jobs.keys()] };
}

/** QA: what the loader has done. */
export function assetStats(): { loaded: number; warmed: number; failed: number; warmBytes: number; busy: number; warmQueue: number; epoch: number } {
  return { ...stats, busy: jobs.size, warmQueue: warmQ.length, epoch };
}

/** Pictures loaded so far (a static layer drawn before its art came is drawn again). */
export function assetEpoch(): number {
  return epoch;
}

// ------------------------------------------------------------------------------------------------ the lookups

/** What the manifest says of an asset (its slips, for a port). */
export function assetMeta(id: string): ManifestEntry | null {
  return manifest?.assets[id] ?? null;
}

/** An asset, or — while its sheet is being painted — the painted kindred that stands in for it (shared/src/data/armsart.ts,
 *  shared/src/data/fleet.ts). A painted one not loaded yet is asked for (it is on screen) and null until it comes. */
export function sprite(id: string): Sprite | null {
  const s = images.get(id);
  if (s) return s;
  if (manifest?.assets[id]) {
    if (!jobs.has(id) && !failed.has(id)) void want(id, 1);
    return null;
  }
  const si = STAND_IN[id];
  if (si) return sprite(si);
  return figureStandIn(id);
}

/** A battle figure in the painter's queue (`unit.<kind>` and its poses `_b`, `_atk`, `_hit`): the same pose of the
 *  painted kind of its body that stands in for it (shared/src/data/unitart.ts) — its own once its sheet is cut. */
function figureStandIn(id: string): Sprite | null {
  const pose = figurePose(id);
  return pose ? sprite(pose) : null;
}

function figurePose(id: string): string | null {
  const m = /^unit\.(.+?)(_b|_atk|_hit)?$/.exec(id);
  if (!m) return null;
  const stand = unitStandIn(m[1], (k) => hasAsset(`unit.${k}`));
  if (!stand) return null;
  const pose = `unit.${stand}${m[2] ?? ''}`;
  return hasAsset(pose) ? pose : `unit.${stand}`;
}

/** The id that is drawn for this one: itself when painted, else its stand-in's (a scene's list to load). */
export function assetFor(id: string): string | null {
  if (manifest?.assets[id]) return id;
  const si = STAND_IN[id];
  if (si) return assetFor(si);
  return figurePose(id);
}

/** Every address the pictures may be asked by now (the service worker keeps these and drops the rest: scenewarm.ts). */
export function keepUrls(): string[] {
  if (!manifest) return [];
  const out = Object.values(manifest.assets).map(fileUrl);
  for (const name of Object.keys(manifest.sheets ?? {})) out.push(sheetUrl(name)!);
  return out;
}

/** The asset's address (an <img> or a CSS background loads it itself) — the stand-in's for one not painted. */
export function assetUrl(id: string): string | null {
  const real = assetFor(id);
  const e = real ? manifest?.assets[real] : null;
  return e ? fileUrl(e) : null;
}

export function pattern(g: CanvasRenderingContext2D, id: string): CanvasPattern | null {
  let p = patterns.get(id);
  if (p) return p;
  const s = sprite(id);
  if (!s) return null;
  p = g.createPattern(s.img, 'repeat') ?? undefined;
  if (p) patterns.set(id, p);
  return p ?? null;
}
