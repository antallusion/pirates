// How long the start takes on a slow phone network (cold cache): the requests, the time to the game's script.
import { browser, sleep } from '../m0/lib.mjs';
const URL = process.argv[2] ?? 'http://localhost:58990/';
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
if (!process.env.FAST) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
let n = 0, bytes = 0; const big = [];
p.on('requestfinished', async (r) => { n++; try { const s = (await r.sizes()).responseBodySize; bytes += s; if (s > 60000) big.push(`${Math.round(s / 1024)}k ${r.url().slice(0, 100)}`); } catch {} });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
const t0 = Date.now();
await p.goto(URL, { waitUntil: 'commit' });
for (let i = 0; i < 1200; i++) { if (await p.evaluate(() => !!globalThis.__gtReady).catch(() => false)) break; await sleep(100); }
console.log('ready at', Date.now() - t0, 'ms; requests', n, 'bytes', Math.round(bytes / 1024), 'k');
await sleep(3000);
console.log('after +3s requests', n, Math.round(bytes / 1024), 'k'); console.log(big.join('\n'));
await b.close();
