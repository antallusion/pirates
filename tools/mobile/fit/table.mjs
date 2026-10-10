// The audit's table (audit.mjs writes it; `node tools/mobile/fit/table.mjs after` prints it): totals per size, then per
// screen at the phone sizes held sideways, «after» beside «before» when there is one, and what is left at 640×360 and
// 480×270 (RU).
import { readFileSync, existsSync } from 'node:fs';

const load = (ph) => (existsSync(`tools/mobile/fit/out/${ph}.json`) ? JSON.parse(readFileSync(`tools/mobile/fit/out/${ph}.json`, 'utf8')).rows : []);
const LAND = ['480x270', '568x320', '640x360', '740x360', '812x375', '844x390', '915x412'];
const ALL = [...LAND, '375x812', '270x480', '820x1180', '1500x600', '1440x900'];
const ok = (r) => r && !r.missing && !r.error;
const len = (r, k) => (Array.isArray(r[k]) ? r[k].length : r[k] ?? 0);
// taps under the size's limit (36 px from a 360 px short side, 32 below); an old row without it: under 36
const under = (r) => {
  const min = r.minTap ?? 36;
  return r.small.filter((z) => { const m = /(\d+)×(\d+)$/.exec(z); return m && Math.min(+m[1], +m[2]) < min - 0.5; }).length;
};
const scrolls = (r) => r.scroll.length > 0 || !!r.page;

function totals(rows, sizes) {
  const rs = rows.filter((r) => ok(r) && sizes.includes(r.size) && !r.rotate);
  return {
    m: rs.length,
    scroll: rs.filter(scrolls).length,
    out: rs.reduce((a, r) => a + len(r, 'out'), 0),
    cut: rs.reduce((a, r) => a + len(r, 'cut'), 0),
    under: rs.reduce((a, r) => a + under(r), 0),
    tiny: rs.reduce((a, r) => a + len(r, 'tiny'), 0),
    paged: rs.filter((r) => r.pages > 1).length,
    clean: rs.filter((r) => !scrolls(r) && !len(r, 'out') && !len(r, 'cut') && !under(r) && !len(r, 'tiny')).length,
  };
}

function screenStats(rows, screen) {
  const rs = rows.filter((r) => r.screen === screen && ok(r) && LAND.includes(r.size));
  const t = totals(rs, LAND);
  const s640 = rs.filter((r) => r.size === '640x360');
  const pages = rs.filter((r) => r.size === '640x360' && r.lang === 'ru').map((r) => r.pages || 1)[0];
  return { ...t, n: rs.length, share640: s640.length ? Math.max(...s640.map((r) => r.share)) : null, pages640: pages ?? null, missing: rows.filter((r) => r.screen === screen && !ok(r)).length };
}

export function table(phase) {
  const rows = load(phase);
  const before = phase === 'after' ? load('before') : null;
  const screens = [...new Set([...(before ?? []).map((r) => r.screen), ...rows.map((r) => r.screen)])];
  const o = [];
  o.push(`# Mobile fit audit — ${phase} (${new Date().toISOString().slice(0, 10)})`);
  o.push('');
  o.push('Measured by `tools/mobile/fit/audit.mjs` (the meter `measure.js` runs in the page). Phones held sideways: 480×270, 568×320, 640×360, 740×360, 812×375, 844×390, 915×412; upright 375×812 and 270×480; tablet 820×1180; desk 1500×600 and 1440×900; RU and EN; every screen and window opened afresh at every size.');
  o.push('');
  o.push('- **scroll** — measurements with a scroll box that overflows (in the window or around it) or a page that scrolls;');
  o.push('- **out** — words or taps past the screen; **cut** — words cut, ellipsised, clamped, clipped by a box, or spilling out of their own box;');
  o.push('- **taps** — tap targets under 36 px (under 32 px where the short side is under 360 px); **tiny** — words under 11 px (10 px below 360);');
  o.push('- **paged** — windows laid out in pages «‹ 1/3 ›» instead of a scroll (kit/fit.ts); **clean** — measurements with none of the above.');
  o.push('- Upright phones show the «turn your phone» prompt over everything (it is measured, the game under it is not counted).');
  o.push('');
  o.push('## Totals per size');
  o.push('');
  o.push(before ? '| size | measurements | scroll | out | cut | taps | tiny | paged | clean |' : '| size | measurements | scroll | out | cut | taps | tiny | paged | clean |');
  o.push('|---|---|---|---|---|---|---|---|---|');
  for (const s of ALL) {
    const t = totals(rows, [s]);
    const rot = rows.filter((r) => ok(r) && r.size === s && r.rotate).length;
    if (!t.m && !rot) continue;
    if (before) {
      const b = totals(before, [s]);
      const ba = (k) => `${b.m ? b[k] : '–'} → **${t[k]}**`;
      o.push(`| ${s}${rot ? ' (turn-the-phone prompt)' : ''} | ${t.m || rot} | ${ba('scroll')} | ${ba('out')} | ${ba('cut')} | ${ba('under')} | ${ba('tiny')} | ${ba('paged')} | ${ba('clean')} |`);
    } else {
      o.push(`| ${s}${rot ? ' (turn-the-phone prompt)' : ''} | ${t.m || rot} | ${t.scroll} | ${t.out} | ${t.cut} | ${t.under} | ${t.tiny} | ${t.paged} | ${t.clean} |`);
    }
  }
  const T = totals(rows, LAND), B = before ? totals(before, LAND) : null;
  const ba = (k) => (B ? `${B[k]} → **${T[k]}**` : `**${T[k]}**`);
  o.push('');
  o.push(`**All phones held sideways** (${T.m} measurements): scroll ${ba('scroll')} · out ${ba('out')} · cut ${ba('cut')} · taps ${ba('under')} · tiny ${ba('tiny')} · clean ${ba('clean')}`);
  o.push('');
  o.push('## Per screen, phones held sideways (all seven sizes, RU + EN)');
  o.push('');
  o.push('| screen | measured | scroll | out | cut | taps | tiny | pages at 640×360 | share at 640×360 |');
  o.push('|---|---|---|---|---|---|---|---|---|');
  for (const s of screens) {
    const z = screenStats(rows, s);
    if (before) {
      const a = screenStats(before, s);
      const c = (k) => `${a.n ? a[k] : '–'} → ${z.n ? z[k] : '–'}`;
      o.push(`| ${s} | ${z.n}${z.missing ? ` (+${z.missing} not opened)` : ''} | ${c('scroll')} | ${c('out')} | ${c('cut')} | ${c('under')} | ${c('tiny')} | ${z.pages640 ?? '–'} | ${a.share640 ?? '–'}% → ${z.share640 ?? '–'}% |`);
    } else {
      o.push(`| ${s} | ${z.n}${z.missing ? ` (+${z.missing} not opened)` : ''} | ${z.scroll} | ${z.out} | ${z.cut} | ${z.under} | ${z.tiny} | ${z.pages640 ?? '–'} | ${z.share640 ?? '–'}% |`);
    }
  }
  for (const size of ['640x360', '480x270']) {
    o.push('');
    o.push(`## What is left at ${size} (RU)`);
    o.push('');
    let any = false;
    for (const r of rows.filter((x) => x.size === size && x.lang === 'ru' && ok(x))) {
      const bits = [];
      if (r.page) bits.push(`page ${r.page}`);
      if (r.scroll.length) bits.push(`scroll: ${r.scroll.slice(0, 3).join('; ')}`);
      if (r.out.length) bits.push(`out: ${r.out.slice(0, 3).join('; ')}${r.out.length > 3 ? ` (+${r.out.length - 3})` : ''}`);
      if (r.cut.length) bits.push(`cut: ${r.cut.slice(0, 3).join('; ')}${r.cut.length > 3 ? ` (+${r.cut.length - 3})` : ''}`);
      if (under(r)) bits.push(`taps: ${under(r)}`);
      if (r.tiny.length) bits.push(`tiny: ${r.tiny.slice(0, 2).join('; ')}${r.tiny.length > 2 ? ` (+${r.tiny.length - 2})` : ''}`);
      if (bits.length) { any = true; o.push(`- **${r.screen}** — ${bits.join(' · ').replace(/\|/g, '/')}`); }
    }
    if (!any) o.push('Nothing.');
  }
  return o.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('table.mjs')) process.stdout.write(table(process.argv[2] ?? 'before'));
