// Probe: start upright on a phone, turn it, see what is on screen.
import { browser, sleep } from '../m0/lib.mjs';
const URL = process.argv[2] ?? 'http://localhost:58990/';
const OUT = process.env.OUT ?? 'assets/raw/audit/boot';
import { mkdirSync } from 'node:fs'; mkdirSync(OUT, { recursive: true });
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ru-RU',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
const cdp = await ctx.newCDPSession(p);
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(4000);
const look = () => p.evaluate(() => {
  const vis = (id) => { const e = document.getElementById(id); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return `${cs.display}/${cs.visibility}/${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`; };
  return { w: innerWidth, h: innerHeight, ready: globalThis.__gtReady, login: vis('screen-login'), panel: vis('login-panel') ?? (() => { const e = document.querySelector('.login-panel'); const r = e?.getBoundingClientRect(); return r && `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`; })(), rot: vis('rotate-lock'), load: vis('gt-load'), tgboot: vis('tg-boot'), canvas: vis('world'), top: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.outerHTML.slice(0, 120) };
});
console.log('portrait', await look());
await p.screenshot({ path: `${OUT}/probe-0-portrait.png` });
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 812, height: 375, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
await p.setViewportSize({ width: 812, height: 375 });
await p.evaluate(() => { dispatchEvent(new Event('orientationchange')); dispatchEvent(new Event('resize')); });
await sleep(2500);
console.log('landscape', await look());
await p.screenshot({ path: `${OUT}/probe-1-landscape.png` });
await b.close();
