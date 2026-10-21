// The big round «В море» in port (owner, 2026-10-21: «отцентруй по вертикали иконку и текст „В море“, оно щас слишком
// внизу»): its sail and its word together against the ring's hole (ring.mjs RING), and every other round button of the
// harbour and the sea (RING_ALL), at the phone's sizes and a desk's, RU and EN, in the browser and in Telegram (TG=1).
//   GPORT=58640 SIZE=844x390,480x270,1440x900 LANG2=ru,en TG=0 OUT=assets/raw/audit/castring node tools/mobile/ux/castring.mjs
import * as L from '../m0/lib.mjs';
import { RING } from './ring.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const sizes = (process.env.SIZE ?? '844x390,480x270,1440x900').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru,en').split(',');
const port = Number(process.env.GPORT ?? 58640);
const tg = Number(process.env.TG ?? 0);
const OUT = process.env.OUT ?? 'assets/raw/audit/castring';
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let bad = 0;
try {
  for (const lang of langs) {
    for (const [W, H] of sizes) {
      const p = await L.page(b, [W, H], { lang });
      if (tg) await p.ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('tg-app')));
      await L.login(p, { port, know: true });
      await L.closeAll(p);
      await L.sleep(800);
      const name = `${W}x${H}_${lang}${tg ? '_tg' : ''}`;
      for (const [k, all] of [['held', false], ['all', true]]) {
        const v = await p.evaluate(RING, { tol: 1, all });
        bad += k === 'held' ? v.bad.length : 0;
        L.log(`${name} ${k}: ${v.n} measured\n  ${v.list.join('\n  ')}`);
      }
      const r = await p.evaluate(() => { const e = document.getElementById('tc-cast'); const x = e?.getBoundingClientRect(); return x && x.width ? { x: x.left, y: x.top, w: x.width, h: x.height } : null; });
      if (r) await p.screenshot({ path: `${OUT}/${name}_cast.png`, clip: { x: Math.max(0, r.x - r.w * 0.4), y: Math.max(0, r.y - r.h * 0.4), width: Math.min(W - Math.max(0, r.x - r.w * 0.4), r.w * 1.8), height: Math.min(H - Math.max(0, r.y - r.h * 0.4), r.h * 1.8) } });
      else L.log(`${name}: no «В море» on the screen`);
      await p.screenshot({ path: `${OUT}/${name}.png` });
      await p.ctx.close();
    }
  }
} finally {
  await b.close();
}
L.log(`${bad} off the ring's middle`);
process.exit(bad ? 1 : 0);
