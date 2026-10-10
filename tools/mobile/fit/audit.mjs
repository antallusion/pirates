// docs/23 · mobile fit (owner, 2026-10-10: «должно помещаться без прокрутов всяких»): every screen and window of the
// game at every size a player holds it, measured — scroll boxes that overflow, things past the screen, cut text, taps
// under 40 px, text under 11 px, the window's share of the screen.
//
//   PORT=58997 node tools/mobile/fit/audit.mjs --phase before            (all sizes, RU and EN)
//   node tools/mobile/fit/audit.mjs --phase after --sizes 640x360 --langs ru --only captain,port
//
// Writes tools/mobile/fit/out/<phase>.json (every row), the screenshots to docs/img/mobilefit/<phase>/ (640×360 RU and
// EN, 812×375 RU, 375×812 RU, 1440×900 RU), and docs/img/mobilefit/audit-<phase>.md (the table; «after» against
// «before» when there is one).
import * as L from '../m0/lib.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { SCREENS, PRE } from './screens.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PHASE = arg('phase', 'before');
const PORT = Number(process.env.PORT ?? arg('port', 58997));
const ALL_SIZES = ['640x360', '740x360', '812x375', '844x390', '915x412', '375x812', '820x1180', '1500x600', '1440x900'];
const SIZES = (arg('sizes', ALL_SIZES.join(','))).split(',');
const LANGS = arg('langs', 'ru,en').split(',');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const SHOTS = new Set((arg('shots', '640x360/ru,640x360/en,812x375/ru,375x812/ru,1440x900/ru')).split(','));
const FIT = readFileSync(new URL('./measure.js', import.meta.url), 'utf8');
const IMG = ['before', 'after'].includes(PHASE) ? `docs/img/mobilefit/${PHASE}` : `assets/raw/audit/fit/${PHASE}`;
const OUTD = 'tools/mobile/fit/out';
mkdirSync(IMG, { recursive: true });
mkdirSync(OUTD, { recursive: true });
const dim = (s) => s.split('x').map(Number);
const touchSize = (s) => dim(s)[0] < 1000;
const want = (id) => !ONLY || ONLY.some((o) => id === o || id.startsWith(o + ':') || id.startsWith(o));

const rows = [];
const outFile = `${OUTD}/${PHASE}.json`;
// a run of a few screens adds to the phase's file instead of replacing it
if (ONLY && existsSync(outFile)) for (const r of JSON.parse(readFileSync(outFile, 'utf8')).rows) if (!want(r.screen)) rows.push(r);

async function measure(p, id, size, lang, root) {
  await p.evaluate(FIT);
  const r = await p.evaluate((q) => globalThis.__fit(q), root);
  const shot = SHOTS.has(`${size}/${lang}`);
  if (shot) await p.screenshot({ path: `${IMG}/${id.replace(/[:/]/g, '_')}__${size}_${lang}.jpg`, type: 'jpeg', quality: 62 });
  const row = { screen: id, size, lang, root, scroll: r.scroll, out: r.out, cut: r.cut, small: r.small, under36: r.under36, tiny: r.tiny, share: r.share, page: r.page, pages: r.pages ?? null, rotate: r.rotate ?? null };
  rows.push(row);
  L.log(`${id.padEnd(26)} ${size.padEnd(9)} ${lang}  scroll ${r.scroll.length}${r.page ? '+page' : ''}  out ${r.out.length}  cut ${r.cut.length}  <40 ${r.small.length} (<36 ${r.under36})  tiny ${r.tiny.length}  ${r.share}%${r.pages ? '  pages ' + r.pages : ''}${r.rotate ? '  ROTATE' : ''}`);
  return row;
}

const b = await L.browser();
try {
  // 1. Before the game: the title, the captain's choice, the prologue — one page each, every size by resizing.
  for (const lang of LANGS) {
    for (const group of [SIZES.filter(touchSize), SIZES.filter((s) => !touchSize(s))]) {
      if (!group.length) continue;
      const p = await L.page(b, dim(group[0]), { lang, touch: touchSize(group[0]) });
      for (const s of PRE) {
        if (!want(s.id)) continue;
        try {
          await s.go(p, { port: PORT, lang });
          for (const size of group) {
            const [w, h] = dim(size);
            await p.setViewportSize({ width: w, height: h });
            if (s.resize) await s.resize(p);
            await L.sleep(s.settle ?? 500);
            await measure(p, s.id, size, lang, s.root);
          }
        } catch (e) { L.log('PRE FAIL', s.id, e.message.slice(0, 160)); }
      }
      await p.ctx.close();
    }
  }
  // 2. In the game: one captain per language and kind of device, every screen opened afresh at every size.
  for (const lang of LANGS) {
    for (const group of [SIZES.filter(touchSize), SIZES.filter((s) => !touchSize(s))]) {
      if (!group.length) continue;
      if (!SCREENS.some((s) => want(s.id))) continue;
      const p = await L.page(b, dim(group[0]), { lang, touch: touchSize(group[0]) });
      await L.login(p, { port: PORT, know: true, name: (lang === 'ru' ? 'Мера' : 'Fit') + Math.random().toString(36).slice(2, 6) });
      await p.evaluate(() => document.body.classList.add('reduce-motion'));
      const ctx = { lang, port: PORT, state: {} };
      for (const s of SCREENS) {
        if (!want(s.id)) continue;
        try {
          if (s.setup) await s.setup(p, ctx);
          for (const size of group) {
            const [w, h] = dim(size);
            await p.setViewportSize({ width: w, height: h });
            await L.sleep(250);
            const ok = await s.open(p, ctx);
            if (ok === false) { L.log('skip', s.id, size, '(not open)'); rows.push({ screen: s.id, size, lang, missing: true }); continue; }
            await L.sleep(s.settle ?? 700);
            await measure(p, s.id, size, lang, s.root ?? '#modal-panel');
          }
          if (s.after) await s.after(p, ctx);
        } catch (e) { L.log('FAIL', s.id, e.message.slice(0, 200)); rows.push({ screen: s.id, lang, error: e.message.slice(0, 200) }); }
      }
      if (p.errors.length) L.log('page errors', p.errors.slice(-5));
      await p.ctx.close();
    }
  }
} finally {
  await b.close();
}
writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), phase: PHASE, rows }, null, 1));
L.log('rows', rows.length, '→', outFile);
// The table.
const { table } = await import('./table.mjs');
writeFileSync(['before', 'after'].includes(PHASE) ? `docs/img/mobilefit/audit-${PHASE}.md` : `${OUTD}/audit-${PHASE}.md`, table(PHASE));
L.log('table → docs/img/mobilefit/audit-' + PHASE + '.md');
