// Asset delivery per scene (docs/33 §Ассеты): a phone (812×375, touch) on the «Slow 4G» line (150 ms, 1.6 Mbit/s down,
// 750 kbit/s up — as tools/mobile/boot/netprobe.mjs), cold cache (a new browser context: no HTTP cache, no service
// worker). The scenes one after another, as a new captain meets them: the start (title → the HUD in port), the open
// sea, a deck fight, her island. For each: requests and bytes (all, pictures, the background's warming), and the
// loading screen's own time (ui/loader.ts loadLog). Needs the admin server (the fight and the island are ordered).
//   GPORT=58988 TAG=before node tools/mobile/assets-measure.mjs
import * as L from './m0/lib.mjs';
import { writeFileSync } from 'node:fs';

const port = Number(process.env.GPORT ?? 58988), TAG = process.env.TAG ?? 'now';
const b = await L.browser();
const reqs = new Map();
const log = [];
let p;
/** A new phone: its own context (cold), the line throttled; NOWARM=1 turns the background's slow fill off (a «save
 *  data» line), so each scene's own pictures are what is counted. */
async function phone() {
  if (p) await p.ctx.close();
  // (no service worker: its own fetches are not the page's, and a cold first visit has none working yet anyway)
  const ctx = await b.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU', serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('gravetide.lang', 'ru'); } catch {} });
  await ctx.addInitScript(() => { setInterval(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))), 300); });
  p = await ctx.newPage();
  p.ctx = ctx;
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  if (process.env.NOWARM) await p.ctx.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }));
  const cdp = await p.ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  if (!process.env.FAST) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, type: e.type }));
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) log.push({ ...r, bytes: e.encodedDataLength }); });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) log.push({ ...r, bytes: 0, failed: true }); });
}
let mark = 0, t0 = Date.now();
const scenes = [];
const kb = (a) => Math.round(a.reduce((s, x) => s + x.bytes, 0) / 1024);
async function cut(scene) {
  if (process.env.SHOTS) await p.screenshot({ path: `${L.OUT}/assets-${TAG}-${scene}.png` }).catch(() => {});
  const loads = await p.evaluate(() => globalThis.gravetide?.assets().loads ?? []).catch(() => []);
  const seen = scenes.at(-1)?.page === p ? scenes.at(-1).loaderSeen : [];
  const part = log.slice(mark);
  mark = log.length;
  const pics = part.filter((x) => /\/assets\//.test(x.url) && x.type === 'Image');
  const warm = part.filter((x) => /\/assets\//.test(x.url) && x.type !== 'Image');
  const row = {
    scene, secs: Math.round((Date.now() - t0) / 100) / 10, requests: part.length, kb: kb(part), pictures: pics.length, picturesKb: kb(pics),
    avif: pics.filter((x) => /\.avif/.test(x.url)).length, sheets: pics.filter((x) => /\/sheets\//.test(x.url)).length, warm: warm.length, warmKb: kb(warm),
    loader: loads.filter((l) => !seen.includes(JSON.stringify(l))).map((l) => `${l.kind} ${l.ms} ms${l.timedOut ? ' (timeout)' : ''}`),
  };
  row.urls = pics.map((x) => `${x.bytes} ${x.url.replace(/^https?:\/\/[^/]+/, '')}`);
  row.loaderSeen = loads.map((l) => JSON.stringify(l));
  scenes.push(row);
  Object.defineProperty(row, 'page', { value: p, enumerable: false });
  L.log(JSON.stringify({ ...row, loaderSeen: undefined, urls: undefined }));
  t0 = Date.now();
}
const loaded = (kind, n = 1) => p.waitForFunction(([k, c]) => (globalThis.gravetide?.assets().loads ?? []).filter((l) => l.kind === k).length >= c, [kind, n], { timeout: 240000, polling: 500 });

// 1. the start (title, captain, the HUD in port) and 2. the open sea — one phone
await phone();
await L.login(p, { port, know: true });
await loaded('start').catch(() => L.log('no start load seen'));
await L.sleep(1500);
await cut('start');
await L.send(p, { t: 'undock' });
await loaded('sea').catch(() => L.log('no sea load seen'));
await L.sleep(1500);
await cut('sea');
// 3. a deck fight (the admin's orders, as /?battle does) — a new phone, its start not counted
await phone();
await L.login(p, { port, know: true });
await loaded('start').catch(() => {});
mark = log.length;
t0 = Date.now();
// /?battle: her frigate's marines and creatures board a Crown frigate (main.ts runTestBattle, the admin's orders)
await p.goto(`http://localhost:${port}/?battle`, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 90 && !(await p.evaluate(() => !!globalThis.gravetide?.state?.boardTac).catch(() => false)); i++) {
  await L.sleep(1000);
  if (i % 5 === 4) await p.evaluate(() => document.querySelector('#login-continue')?.click()).catch(() => {});
}
await loaded('battle').catch(() => L.log('no battle load seen'));
await L.sleep(1500);
await cut('battle');
// 4. her island — a new phone
await phone();
await L.login(p, { port, know: true });
await loaded('start').catch(() => {});
await L.say(p, '/isle 3');
await L.sleep(2500);
mark = log.length;
t0 = Date.now();
await L.open(p, 'base');
await loaded('isle').catch(() => L.log('no isle load seen'));
await L.sleep(1500);
await cut('isle');

const total = { requests: log.length, kb: kb(log), pictures: log.filter((x) => x.type === 'Image').length, picturesKb: kb(log.filter((x) => x.type === 'Image')) };
writeFileSync(`${L.OUT}/assets-${TAG}.json`, JSON.stringify({ at: new Date().toISOString(), tag: TAG, scenes: scenes.map((s) => ({ ...s, loaderSeen: undefined })), total, errors: p.errors.slice(0, 5), nowarm: !!process.env.NOWARM, urls: log.map((x) => `${x.type} ${x.bytes} ${x.url.replace(/^https?:\/\/[^/]+/, '')}`) }, null, 1));
L.log('total', JSON.stringify(total));
await b.close();
