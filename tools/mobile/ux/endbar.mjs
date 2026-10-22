// The battle's reckoning bar (owner, 2026-10-22: «плашка "почему" — её надо задизайнить как кнопку дальше»): «Почему»
// and «Повтор» the same button as «Дальше» — the same frame (border-image), height, font, padding — only its variant
// apart (secondary against the gold primary), and all of them centred on the bar's middle line. A boarding at sea and a
// fight ashore at a lair, each ended at once (quick; ashore with an auto-battle scroll), measured and shot at the sizes, RU and EN, in Telegram (TG=46).
//   GPORT=58640 SIZE=844x390,1093x481 LANG2=ru,en TG=46 OUT=assets/raw/audit/endbar node tools/mobile/ux/endbar.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const sizes = (process.env.SIZE ?? '844x390,1093x481').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANG2 ?? 'ru,en').split(',');
const port = Number(process.env.GPORT ?? 58640);
const tg = Number(process.env.TG ?? 46);
const OUT = process.env.OUT ?? 'assets/raw/audit/endbar';
const KINDS = (process.env.KINDS ?? 'land,sea').split(',');
mkdirSync(OUT, { recursive: true });

const b = await L.browser();
const rows = [];
let total = 0;
try {
  for (const lang of langs) {
    const [W0, H0] = sizes[0];
    const p = await L.page(b, [W0, H0], { lang, touch: W0 < 1000 });
    if (tg) await p.ctx.addInitScript((t) => {
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('tg-app');
        const r = document.documentElement.style;
        r.setProperty('--sa-t', `${t}px`);
        r.setProperty('--tg-top', `${t}px`);
      });
    }, tg);
    await L.login(p, { port, know: true });
    await L.closeAll(p);
    await L.send(p, { t: 'undock' });
    await L.sleep(3000);
    await L.closeAll(p);
    for (const c of ['/level 30', '/god', '/heal', '/army clear', '/army marine 40', '/army musketeer 20', '/noboard on', '/scrolls 20']) { await L.say(p, c); await L.sleep(500); }
    for (const kind of KINDS) {
      await p.setViewportSize({ width: W0, height: H0 });
      await L.say(p, '/tp 21000 70000');
      await L.sleep(2500);
      await L.closeAll(p);
      await L.say(p, '/heal');
      await L.say(p, kind === 'sea' ? '/board pirate sloop' : '/lair fight');
      for (let i = 0; i < 40 && !(await p.evaluate(() => document.body.classList.contains('tac'))); i++) await L.sleep(500);
      await L.sleep(2500);
      await L.send(p, { t: 'tac', act: { a: 'quick' } });
      let ok = false;
      for (let i = 0; i < 40 && !(ok = await p.evaluate(() => !!document.querySelector('#board-tac .tb-end [data-endbtn]')?.getBoundingClientRect().width)); i++) await L.sleep(500);
      await L.sleep(1500);
      if (!ok) { L.log(`FAIL ${lang} ${kind}: no reckoning bar`); total++; continue; }
      for (const [W, H] of sizes) {
        await p.setViewportSize({ width: W, height: H });
        await L.sleep(800);
        const v = await p.evaluate(MEASURE);
        const name = `${W}x${H}_${lang}${tg ? '_tg' : ''}_${kind}`;
        await p.screenshot({ path: `${OUT}/${name}.png` });
        // a crop of the bar itself, to see it close
        if (v.box) await p.screenshot({ path: `${OUT}/${name}_bar.png`, clip: { x: Math.max(0, v.box[0] - 6), y: Math.max(0, v.box[1] - 6), width: Math.min(W, v.box[2] - v.box[0] + 12), height: Math.min(H, v.box[3] - v.box[1] + 12) } });
        total += v.bad.length;
        rows.push({ name, ...v });
        L.log(`${v.bad.length ? 'FAIL' : 'ok  '} ${name}: ${v.btns.join(' | ')}${v.bad.length ? '\n     ' + v.bad.join('\n     ') : ''}`);
      }
      await p.evaluate(() => document.querySelector('#board-tac [data-endbtn]')?.click());
      await L.sleep(2500);
      await L.closeAll(p);
      await L.say(p, '/lair reset');
    }
    await p.ctx.close();
  }
} finally {
  await b.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
L.log(`${total} problems`);
process.exit(total ? 1 : 0);

function MEASURE() {
  const bar = document.querySelector('#board-tac .tb-end');
  const row = bar?.querySelector('.tb-endrow');
  if (!bar || !row) return { bad: ['no bar'], btns: [] };
  const main = row.querySelector('[data-endbtn]');
  const others = [...row.querySelectorAll('[data-why], [data-replay]')];
  const bad = [];
  const cs = (e) => getComputedStyle(e);
  const m = cs(main), mr = main.getBoundingClientRect();
  const btns = [main, ...others].map((e) => { const r = e.getBoundingClientRect(); const c = cs(e); return `«${e.textContent.trim()}» ${Math.round(r.width)}×${r.height.toFixed(1)} @${((r.top + r.bottom) / 2).toFixed(1)} ${c.fontSize} ${c.paddingLeft}/${c.paddingRight} ${/url/.test(c.borderImageSource) ? 'framed' : 'plain'}`; });
  if (!others.length && globalThis.gravetide.tactical.view?.result?.why) bad.push('no «Почему» on the bar though the result has its why');
  for (const e of others) {
    const c = cs(e), r = e.getBoundingClientRect(), t = e.textContent.trim();
    if (!/url/.test(c.borderImageSource)) bad.push(`«${t}» has no painted frame (a plain plate)`);
    if (c.borderImageSource !== m.borderImageSource) bad.push(`«${t}» frame differs from «Дальше»'s`);
    if (Math.abs(r.height - mr.height) > 0.5) bad.push(`«${t}» ${r.height.toFixed(1)} px tall, «Дальше» ${mr.height.toFixed(1)}`);
    for (const k of ['fontSize', 'fontFamily', 'fontWeight', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderLeftWidth', 'minHeight']) if (c[k] !== m[k]) bad.push(`«${t}» ${k} ${c[k]} against «Дальше»'s ${m[k]}`);
    if (Math.abs((r.top + r.bottom) / 2 - (mr.top + mr.bottom) / 2) > 1) bad.push(`«${t}» off «Дальше»'s middle line by ${((r.top + r.bottom) / 2 - (mr.top + mr.bottom) / 2).toFixed(1)} px`);
    if (!e.classList.contains('k-btn--secondary')) bad.push(`«${t}» is not the secondary variant`);
  }
  if (!main.classList.contains('k-btn--primary')) bad.push('«Дальше» is not the primary variant');
  // the buttons on the bar's middle line: at sea the bar is one band (its middle); ashore the row is its own line —
  // the buttons on the row's middle
  const br = bar.getBoundingClientRect(), rr = row.getBoundingClientRect();
  const sea = bar.classList.contains('sea');
  const mid = sea && rr.height > br.height * 0.6 ? (br.top + br.bottom) / 2 : (rr.top + rr.bottom) / 2;
  for (const e of [main, ...others]) {
    const r = e.getBoundingClientRect();
    const d = (r.top + r.bottom) / 2 - mid;
    if (Math.abs(d) > 1.5) bad.push(`«${e.textContent.trim()}» ${d.toFixed(1)} px off the bar's middle line`);
    if (r.top < br.top - 0.5 || r.bottom > br.bottom + 0.5 || r.left < br.left - 0.5 || r.right > br.right + 0.5) bad.push(`«${e.textContent.trim()}» out of the bar`);
  }
  return { bad, btns, box: [br.left, br.top, br.right, br.bottom].map(Math.round) };
}
