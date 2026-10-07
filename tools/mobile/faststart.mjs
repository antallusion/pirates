// docs/23 item 88: a captain back on the same phone — from the title screen to the open sea, taps counted (812×375,
// touch). Twice: she left the game in port, and she left it at sea. A film on the way (leaving port) is waited out, not
// tapped away; the harbour's check (provisions short) is counted if it comes.
//   GPORT=58814 node tools/mobile/faststart.mjs
import * as L from './m0/lib.mjs';
import { writeFileSync } from 'node:fs';

const port = Number(process.env.GPORT ?? 58814), OUT = process.env.OUT ?? 'assets/raw/audit/m78';
const lang = process.env.LANG2 ?? 'ru';
const b = await L.browser();
const p = await L.page(b, L.SIZES.phone, { lang, films: true });
await L.login(p, { port, know: true });
await L.sleep(1500);
const rows = [];

async function back(label) {
  const t0 = Date.now();
  await p.reload({ waitUntil: 'domcontentloaded' });
  let taps = 0, shots = 0;
  const did = [];
  for (let i = 0; i < 120; i++) {
    await L.sleep(500);
    const v = await p.evaluate(() => {
      const g = globalThis.gravetide, s = g?.state;
      const vis = (q) => { const e = document.querySelector(q); return !!e && !e.closest('.hidden') && e.getClientRects().length > 0; };
      return { login: vis('#screen-login'), cont: vis('#login-continue'), film: !!document.querySelector('.film'), port: vis('[data-act="undock"]'), check: vis('[data-dp="sail"]'), atSea: !!s?.self && !s.self.dockedAt && !!s.you, inGame: vis('#hud') };
    });
    if (shots < 3 && (v.login || v.port)) await p.screenshot({ path: `${OUT}/faststart_${label}_${++shots}.png` });
    if (v.atSea && !v.film) break;
    if (v.film) continue; // waited out
    const tap = async (sel, what) => { const r = await p.evaluate((q) => { const e = document.querySelector(q); const b = e?.getBoundingClientRect(); return b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel); if (r) { await p.touchscreen.tap(r.x, r.y); taps++; did.push(what); await L.sleep(800); } };
    if (v.check) await tap('[data-dp="sail"]', 'check: sail anyway');
    else if (v.port) await tap('[data-act="undock"]', 'set sail');
    else if (v.login && v.cont && i > 4) await tap('#login-continue', 'continue'); // only if the page has not let her in by itself
  }
  const r = { label, taps, did, secs: Math.round((Date.now() - t0) / 100) / 10 };
  rows.push(r);
  L.log(JSON.stringify(r));
}
// 1. She left in port (a new captain starts there).
await back('port');
// 2. She left at sea.
await back('sea');
// 3. Her session was taken over (the page does not reconnect by itself): the title screen's «Продолжить».
const p2 = await p.ctx.newPage();
await p2.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded' });
await L.sleep(5000);
const kicked = await p.evaluate(() => ({ login: !document.querySelector('#screen-login')?.classList.contains('hidden'), cont: !document.querySelector('#login-continue')?.classList.contains('hidden'), conn: !document.querySelector('#connection')?.classList.contains('hidden') }));
await p.screenshot({ path: `${OUT}/faststart_taken_over.png` });
L.log('taken over elsewhere:', JSON.stringify(kicked));
await p2.close();
await L.sleep(1000);
// …and «Продолжить» takes her back: taps until she is at sea again on this page.
{
  let taps = 0;
  for (let i = 0; i < 40; i++) {
    const v = await p.evaluate(() => ({ cont: !document.querySelector('#login-continue')?.classList.contains('hidden') && !document.querySelector('#screen-login')?.classList.contains('hidden'), sea: !!globalThis.gravetide.state.self && !globalThis.gravetide.state.self.dockedAt && document.querySelector('#screen-login')?.classList.contains('hidden') }));
    if (v.sea && taps > 0) break;
    if (v.cont) { const r = await p.evaluate(() => { const b = document.querySelector('#login-continue').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); await p.touchscreen.tap(r.x, r.y); taps++; }
    await L.sleep(700);
  }
  rows.push({ label: 'taken over', taps });
  L.log('taken over: back at sea in', taps, 'taps');
}
writeFileSync(`${OUT}/faststart_${lang}.json`, JSON.stringify({ at: new Date().toISOString(), rows, kicked, errors: p.errors.slice(0, 5) }, null, 1));
await b.close();
