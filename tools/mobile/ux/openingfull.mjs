// The owner's case (2026-10-21: «квест меня ведет к пополнению моряков в таверну, хотя у меня все забито»): a fresh
// captain fills her crew in the tavern first, then buys provisions and sailcloth — the step «пушки или матросы» is counted
// at once («Экипаж уже полон — шаг засчитан»), and the finger goes on to the market's good, never to the tavern.
//   GPORT=58640 SIZE=844x390 LANG2=ru,en OUT=assets/raw/audit/openingfull node tools/mobile/ux/openingfull.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const langs = (process.env.LANG2 ?? 'ru,en').split(',');
const port = Number(process.env.GPORT ?? 58640);
const OUT = process.env.OUT ?? 'assets/raw/audit/openingfull';
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
let bad = 0;
try {
  for (const lang of langs) {
    const p = await L.page(b, [W, H], { lang });
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    const step = () => p.evaluate(() => { const q = globalThis.gravetide.state.self?.quests?.find((x) => x.op); return q ? `${q.id}:${q.step}:${q.op}` : null; });
    L.log(`${lang} start: ${await step()}`);
    await L.say(p, '/silver 5000');
    await L.sleep(600);
    // the crew filled first (the hammocks all taken), then the market's provisions and sailcloth
    await L.send(p, { t: 'hire_crew', qty: 400, prof: 'sailor' });
    await L.sleep(800);
    await L.send(p, { t: 'trade', good: 'provisions', qty: 1 });
    await L.sleep(800);
    await L.send(p, { t: 'trade', good: 'sailcloth', qty: 1 });
    await L.sleep(2500);
    const st = await step();
    const crew = await p.evaluate(() => ({ crew: globalThis.gravetide.state.you?.crew, max: globalThis.gravetide.state.you?.crewMax }));
    const toasts = await p.evaluate(() => [...document.querySelectorAll('#toasts > .toast, .toast')].map((t) => t.textContent?.trim()));
    L.log(`${lang} crew ${crew.crew}/${crew.max}, step ${st}, toasts ${JSON.stringify(toasts)}`);
    if (!st?.endsWith('buy:trade')) { bad++; L.log(`FAIL ${lang}: the tavern's step was not counted`); }
    // the harbour's window at the tavern: where the finger points now
    await p.evaluate(() => globalThis.gravetide.open('port'));
    await L.sleep(1200);
    await p.evaluate(() => document.querySelector('#modal-panel [data-ptab="tavern"]')?.click());
    await L.sleep(1200);
    const finger = await p.evaluate(() => { const f = document.getElementById('tut-finger'); const t = document.querySelector('.tut-target'); return { finger: !!f && !f.classList.contains('hidden'), target: t ? (t.getAttribute('data-ptab') ?? t.getAttribute('data-act') ?? t.id ?? t.className) : null }; });
    L.log(`${lang} finger: ${JSON.stringify(finger)}`);
    if (finger.target === 'tavern') { bad++; L.log(`FAIL ${lang}: the finger on the tavern`); }
    await p.screenshot({ path: `${OUT}/${W}x${H}_${lang}_tavern.png` });
    await p.ctx.close();
  }
} finally {
  await b.close();
}
L.log(`${bad} failed`);
process.exit(bad ? 1 : 0);
