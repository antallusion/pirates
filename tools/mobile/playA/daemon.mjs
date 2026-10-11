// Playthrough A (docs/30): one browser held open for the whole playthrough, driven step by step from the shell.
// The owner, 2026-10-12: «завести один тест аккаунт, врубить скорость х100 и от начала до конца полностью пройти игру».
// It opens the game at a phone held sideways (844×390, touch) and listens on localhost for snippets of JS run in Node
// with `p` (the page), `L` (tools/mobile/m0/lib.mjs), `tap(x,y)` (a real touch), `shot(name)` and `S` (a scratch object
// kept between calls). A snippet's value comes back as JSON.
//   GPORT=58981 CTL=58997 node tools/mobile/playA/daemon.mjs
//   node tools/mobile/playA/run.mjs "return await L.me(p)"
import * as L from '../m0/lib.mjs';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';

const GPORT = Number(process.env.GPORT ?? 58981), CTL = Number(process.env.CTL ?? 58997);
const SHOTS = process.env.SHOTS ?? 'docs/img/playA';
mkdirSync(SHOTS, { recursive: true });
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);

const b = await L.browser();
let p = await L.page(b, [W, H], { lang: 'ru', touch: true, films: process.env.FILMS === '1' });
let cdp = await p.ctx.newCDPSession(p);
const log = [];
const hook = (pg) => {
  pg.on('pageerror', (e) => log.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(m.type() + ': ' + m.text().slice(0, 300)); });
};
hook(p);
const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await L.sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const shot = async (name, full = false) => { const f = `${SHOTS}/${name}.png`; await p.screenshot({ path: f, fullPage: full }); return f; };
const S = {};
/** A new page at another size in the same browser and storage (the same captain), for a key screen check. */
const resize = async (w, h, touch = w < 1000) => {
  const st = await p.ctx.storageState();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, locale: 'ru-RU', storageState: st });
  const np = await ctx.newPage();
  hook(np);
  await p.ctx.close().catch(() => {});
  p = np; p.ctx = ctx; p.errors = [];
  cdp = await ctx.newCDPSession(p);
  await p.goto(`http://localhost:${GPORT}`, { waitUntil: 'domcontentloaded' });
  return 'ok';
};

createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  let out;
  try {
    const fn = new Function('p', 'L', 'tap', 'shot', 'S', 'log', 'resize', 'GPORT', 'cdp', `return (async () => { ${body} })();`);
    out = { ok: true, v: await fn(p, L, tap, shot, S, log, resize, GPORT, cdp) };
  } catch (e) { out = { ok: false, err: String(e?.stack ?? e).slice(0, 1500) }; }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(out, null, 1));
}).listen(CTL, '127.0.0.1', () => L.log(`playA daemon on ${CTL}, game ${GPORT}, ${W}x${H}`));
await p.goto(`http://localhost:${GPORT}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
