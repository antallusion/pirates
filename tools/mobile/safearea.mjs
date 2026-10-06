// docs/23 item 89: a phone on its side with a notch and a gesture bar — the safe area. Chromium is told the screen's
// insets (CDP Emulation.setSafeAreaInsetsOverride: env(safe-area-inset-*) as a phone gives them; the game's --sa-*
// variables are set from those), and on each screen every control is checked to lie inside: nothing to touch under the
// notch (left), the camera's side (right) or the gesture bar (bottom). Screens: the sea, a mark, the menu sheet, the
// harbour, the hex battle.
//   GPORT=58813 node tools/mobile/safearea.mjs
import * as L from './m0/lib.mjs';
import { writeFileSync } from 'node:fs';

const port = Number(process.env.GPORT ?? 58813), OUT = process.env.OUT ?? 'assets/raw/audit/m78';
const INS = { top: 0, left: 47, bottom: 21, right: 47 }; // an iPhone held sideways, notch to the left
const lang = process.env.LANG2 ?? 'ru';
const b = await L.browser();
const p = await L.page(b, L.SIZES.phone, { lang });
const cdp = await p.ctx.newCDPSession(p);
let how = 'cdp';
try {
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INS });
} catch (e) {
  how = 'css';
}
await L.login(p, { port, know: true });
if (how === 'css') await p.addStyleTag({ content: `:root { --sa-t: ${INS.top}px !important; --sa-l: ${INS.left}px !important; --sa-b: ${INS.bottom}px !important; --sa-r: ${INS.right}px !important; }` });
const env = await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:env(safe-area-inset-left,0px);bottom:env(safe-area-inset-bottom,0px)'; document.body.append(d); const cs = getComputedStyle(d); const r = { l: cs.left, b: cs.bottom, varL: getComputedStyle(document.documentElement).getPropertyValue('--sa-l') }; d.remove(); return r; });
L.log('insets by', how, JSON.stringify(env));
const rows = [];
async function check(tag) {
  await L.sleep(900);
  const bad = await p.evaluate((ins) => {
    const W = innerWidth, H = innerHeight, out = [];
    const sel = 'button, [role="button"], a.btn, input, select, #tc-stick, .minimap-frame, .k-tile, .tb-rb, .tb-turnb, .act-btn, .k-btn';
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      let hidden = false; for (let q = e; q; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) { hidden = true; break; } } if (hidden) continue;
      if (r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H) continue; // off the screen altogether (a scrolled list)
      // inside a box that scrolls: judged by the box (a list may run under the bar and be scrolled up)
      let sc = e.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      const box = sc ? sc.getBoundingClientRect() : r;
      const k = { l: Math.max(r.left, box.left), r: Math.min(r.right, box.right), b: Math.min(r.bottom, box.bottom) };
      const why = [];
      if (k.l < ins.left - 0.5 && r.top < H - ins.bottom) why.push(`left ${Math.round(k.l)}`);
      if (k.r > W - ins.right + 0.5) why.push(`right ${Math.round(W - k.r)}`);
      if (k.b > H - ins.bottom + 0.5) why.push(`bottom ${Math.round(H - k.b)}`);
      if (why.length) out.push(`${e.id || e.dataset.act || e.className.toString().slice(0, 28) || e.tagName} ${why.join(' ')}`);
    }
    return [...new Set(out)];
  }, INS);
  await p.screenshot({ path: `${OUT}/safe_${lang}_${tag}.png` });
  rows.push({ tag, bad });
  L.log(tag, bad.length ? JSON.stringify(bad) : 'inside');
}
await L.closeAll(p);
await p.evaluate(() => globalThis.gravetide.open('port'));
await check('port');
await L.closeAll(p);
await L.send(p, { t: 'undock' }); await L.sleep(2500); await L.closeAll(p);
await check('sea');
await L.say(p, '/foe pirate sloop 300'); await L.sleep(3000);
await check('mark');
await p.evaluate(() => globalThis.gravetide.seaHud.openMenu());
await check('menu');
await L.closeAll(p); await p.evaluate(() => globalThis.gravetide.seaHud.closeSheets());
await L.say(p, '/board pirate sloop 20');
await p.waitForFunction(() => globalThis.gravetide.state.boardTac, null, { timeout: 30000 }).catch(() => {});
await L.sleep(1500);
await check('battle');
writeFileSync(`${OUT}/safearea_${lang}.json`, JSON.stringify({ at: new Date().toISOString(), how, insets: INS, env, rows }, null, 1));
await b.close();
