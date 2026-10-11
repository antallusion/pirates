// ux2 · the type on a phone (owner, 2026-10-11: «я бы сделал 10 шрифт по умолчанию и даже какие-то снижал до 6-8пкс»):
// every window and sheet opened at a phone size, each visible word's computed size counted — the histogram, and the
// words over a limit with their full path (where the rule to change is). The Talents window's descriptions are
// measured on their own (the owner's «гиганские шрифты»).
//   PORT=58992 node tools/mobile/ux2/type.mjs [--size 844x390] [--over 12] [--only talents,journal] [--shots docs/img/ux2]
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SCREENS } from '../fit/screens.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(process.env.PORT ?? arg('port', 58992));
const [W, H] = arg('size', '844x390').split('x').map(Number);
const OVER = Number(arg('over', 12));
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const b = await L.browser();
const touch = W < 1000;
const p = await L.page(b, [W, H], { lang: 'ru', touch });
await L.login(p, { port: PORT, know: true, name: 'Шрифт' + Math.random().toString(36).slice(2, 6) });
await p.evaluate(() => document.body.classList.add('reduce-motion'));

const sizes = (root, over) => p.evaluate(([q, lim]) => {
  const path = (e) => { const out = []; for (let x = e; x && x !== document.body && out.length < 5; x = x.parentElement) out.unshift(x.id ? '#' + x.id : x.tagName.toLowerCase() + (typeof x.className === 'string' && x.className.trim() ? '.' + x.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return out.join(' > '); };
  const hist = {};
  const big = [];
  for (const r of document.querySelectorAll(q)) {
    for (const e of [r, ...r.querySelectorAll('*')]) {
      if (!e.getClientRects().length) continue;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent));
      if (!own) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const fs = Math.round(parseFloat(cs.fontSize) * 2) / 2;
      hist[fs] = (hist[fs] ?? 0) + 1;
      const head = !!e.closest('h1, h2, h3, h4, .w-title, .title, .title-sm, .card-h, .tree-h');
      if (fs > lim && !head) big.push(`${fs}px ${path(e)} «${e.textContent.trim().slice(0, 18)}»`);
    }
  }
  return { hist, big };
}, [root, over]);

const rows = [];
const ctx = { lang: 'ru', port: PORT, state: {} };
for (const s of SCREENS) {
  if (ONLY && !ONLY.some((o) => s.id === o || s.id.startsWith(o))) continue;
  if (/^(battle|land|sea:foe|lair-card|roam-card)/.test(s.id) && !ONLY) continue; // the fights: tools/mobile/fit/audit.mjs
  try {
    if (s.setup) await s.setup(p, ctx);
    const ok = await s.open(p, ctx);
    if (ok === false) { L.log('skip', s.id); continue; }
    await L.sleep(s.settle ?? 600);
    const r = await sizes(s.root ?? '#modal-panel', OVER);
    rows.push({ screen: s.id, ...r });
    const top = Object.entries(r.hist).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}px×${v}`).join(' ');
    L.log(`${s.id.padEnd(22)} ${top}${r.big.length ? `  over ${OVER}: ${r.big.length}` : ''}`);
    for (const x of r.big.slice(0, 3)) L.log('   ', x);
    if (SHOTS && ['talents', 'talents:tree', 'journal:quests', 'journal:company:group', 'hero:skills', 'depart', 'options'].includes(s.id)) await p.screenshot({ path: `${SHOTS}/${s.id.replace(/[:/]/g, '_')}__${W}x${H}.png` });
    if (s.after) await s.after(p, ctx);
  } catch (e) { L.log('FAIL', s.id, e.message.slice(0, 160)); }
}
// the talents' descriptions on their own
const tal = rows.find((r) => r.screen === 'talents:tree');
if (tal) {
  const d = await p.evaluate(() => [...document.querySelectorAll('#modal-panel .talent small')].filter((e) => e.getClientRects().length).map((e) => parseFloat(getComputedStyle(e).fontSize)));
  L.log(`talents' descriptions: ${d.length} lines at ${[...new Set(d)].join(', ')} px`);
}
const all = {};
for (const r of rows) for (const [k, v] of Object.entries(r.hist)) all[k] = (all[k] ?? 0) + v;
L.log('all words by size:', Object.entries(all).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k}:${v}`).join(' '));
writeFileSync(`assets/raw/audit/type_${W}x${H}.json`, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
await b.close();
