// Look into windows on a phone: the paged pane's parts and heights, a screenshot of its first pages.
//   node tools/mobile/fit/pages.mjs port:harbour,talents [640x360] [ru] [pagesToShoot]
import * as L from '../m0/lib.mjs';
import { SCREENS } from './screens.mjs';
const [ids, size = '640x360', lang = 'ru', shots = '3'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const b = await L.browser();
const p = await L.page(b, [W, H], { lang });
const t = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 600000);
await L.login(p, { port: 58997, know: true });
await p.evaluate(() => document.body.classList.add('reduce-motion'));
const ctx = { lang, port: 58997, state: {} };
const want = ids.split(',');
for (const s of SCREENS) {
  if (!want.some((w) => s.id === w || s.id.startsWith(w + ':'))) continue;
  if (s.setup) await s.setup(p, ctx);
  if ((await s.open(p, ctx)) === false) { console.log(s.id, 'NOT OPEN'); continue; }
  await L.sleep(800);
  const info = await p.evaluate(() => {
    const out = [];
    for (const pane of document.querySelectorAll('.fit-paged, #modal-panel .modal-body, .k-sheet-body')) {
      if (!pane.getClientRects().length) continue;
      const kids = [...pane.children].map((k) => { const r = k.getBoundingClientRect(); return `${k.tagName.toLowerCase()}.${String(k.className).split(' ').slice(0, 2).join('.')} ${Math.round(r.width)}×${Math.round(r.height)}`; });
      out.push(`${pane.className} ${pane.clientWidth}×${pane.clientHeight} sw ${pane.scrollWidth} | ${kids.slice(0, 14).join(' | ')}${kids.length > 14 ? ` | …${kids.length}` : ''}`);
    }
    return out;
  });
  console.log('==', s.id, '\n  ' + info.join('\n  '));
  const n = Number(shots);
  for (let i = 0; i < n; i++) {
    await p.screenshot({ path: `assets/raw/audit/fit/pg_${s.id.replace(/:/g, '_')}_${i}.png` });
    const more = await p.evaluate(() => { const b = [...document.querySelectorAll('.fit-pager [data-fitpg="1"]')].find((x) => x.getClientRects().length && !x.disabled); if (!b) return false; b.click(); return true; });
    if (!more) break;
    await L.sleep(300);
  }
  if (s.after) await s.after(p, ctx);
}
clearTimeout(t);
await b.close();
