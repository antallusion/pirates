// The audit's table: per screen, the worst size, and the totals; «after» beside «before».
import { readFileSync, existsSync } from 'node:fs';

const load = (ph) => (existsSync(`tools/mobile/fit/out/${ph}.json`) ? JSON.parse(readFileSync(`tools/mobile/fit/out/${ph}.json`, 'utf8')).rows : []);
const LAND = ['640x360', '740x360', '812x375', '844x390', '915x412'];
const n = (r, k) => (r && !r.missing && !r.error ? (Array.isArray(r[k]) ? r[k].length : r[k] ?? 0) : null);
const sum = (rs, k) => rs.reduce((a, r) => a + (n(r, k) ?? 0), 0);

function stats(rows, screen) {
  const rs = rows.filter((r) => r.screen === screen && !r.missing && !r.error);
  const land = rs.filter((r) => LAND.includes(r.size));
  const at = (size) => rs.filter((r) => r.size === size);
  const s640 = at('640x360');
  return {
    n: rs.length,
    scrollLand: land.filter((r) => r.scroll.length || r.page).length,
    scrollAll: rs.filter((r) => r.scroll.length || r.page).length,
    out: sum(land, 'out'), cut: sum(land, 'cut'), small: sum(land, 'small'), under36: sum(land, 'under36'), tiny: sum(land, 'tiny'),
    deskBad: rs.filter((r) => !LAND.includes(r.size) && (r.out.length || r.cut.length)).length,
    share640: s640.length ? Math.max(...s640.map((r) => r.share)) : null,
    scroll640: s640.map((r) => r.scroll.map((x) => x.replace(/^.*?([↕↔])/, '$1')).join(' ')).filter(Boolean)[0] ?? '',
    missing: rows.filter((r) => r.screen === screen && (r.missing || r.error)).length,
  };
}

export function table(phase) {
  const rows = load(phase);
  const before = phase === 'after' ? load('before') : null;
  const screens = [...new Set([...(before ?? []).map((r) => r.screen), ...rows.map((r) => r.screen)])];
  const out = [];
  out.push(`# Mobile fit audit — ${phase} (${new Date().toISOString().slice(0, 10)})`);
  out.push('');
  out.push('Measured by `tools/mobile/fit/audit.mjs` (`measure.js` in the page). Landscape phones: 640×360, 740×360, 812×375, 844×390, 915×412; also 375×812, 820×1180, 1500×600, 1440×900; RU and EN.');
  out.push('');
  out.push('- **scroll** — measurements (screen × size × language) at the phone sizes with a scroll box that overflows or a page that scrolls;');
  out.push('- **out / cut / <40 / <36 / tiny** — sums over the phone sizes: elements past the screen, cut or ellipsised text, tap targets under 40 and 36 px, text under 11 px;');
  out.push('- **share** — the window\'s share of the screen at 640×360; **desk** — measurements at the other sizes with something out or cut.');
  out.push('');
  const tot = (rs) => {
    const land = rs.filter((r) => LAND.includes(r.size) && !r.missing && !r.error);
    return { m: land.length, scroll: land.filter((r) => r.scroll.length || r.page).length, out: sum(land, 'out'), cut: sum(land, 'cut'), small: sum(land, 'small'), under36: sum(land, 'under36'), tiny: sum(land, 'tiny') };
  };
  const T = tot(rows), B = before ? tot(before) : null;
  const ba = (k) => (B ? `${B[k]} → **${T[k]}**` : `${T[k]}`);
  out.push(`**Totals at the phone sizes** (${T.m} measurements): scroll ${ba('scroll')} · out ${ba('out')} · cut ${ba('cut')} · <40 px ${ba('small')} · <36 px ${ba('under36')} · text <11 px ${ba('tiny')}`);
  out.push('');
  if (before) {
    out.push('| screen | scroll (phones) | out | cut | <40 px | <36 px | tiny | share 640 | desk out/cut | 640×360 scroll before |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const s of screens) {
      const a = stats(before, s), z = stats(rows, s);
      const c = (k) => `${a.n ? a[k] : '–'} → ${z.n ? z[k] : '–'}`;
      out.push(`| ${s} | ${c('scrollLand')} | ${c('out')} | ${c('cut')} | ${c('small')} | ${c('under36')} | ${c('tiny')} | ${a.share640 ?? '–'}% → ${z.share640 ?? '–'}% | ${c('deskBad')} | ${a.scroll640 || '—'} |`);
    }
  } else {
    out.push('| screen | measured | scroll (phones) | out | cut | <40 px | <36 px | tiny | share 640 | desk out/cut | 640×360 scroll |');
    out.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const s of screens) {
      const z = stats(rows, s);
      out.push(`| ${s} | ${z.n}${z.missing ? ` (+${z.missing} not opened)` : ''} | ${z.scrollLand} | ${z.out} | ${z.cut} | ${z.small} | ${z.under36} | ${z.tiny} | ${z.share640 ?? '–'}% | ${z.deskBad} | ${z.scroll640 || '—'} |`);
    }
  }
  out.push('');
  // The details at 640×360 RU: what exactly overflows, is cut or too small.
  out.push('## Details at 640×360 (RU)');
  out.push('');
  for (const r of rows.filter((x) => x.size === '640x360' && x.lang === 'ru' && !x.missing && !x.error)) {
    const bits = [];
    if (r.page) bits.push(`page ${r.page}`);
    if (r.scroll.length) bits.push(`scroll: ${r.scroll.slice(0, 4).join('; ')}`);
    if (r.out.length) bits.push(`out: ${r.out.slice(0, 3).join('; ')}${r.out.length > 3 ? ` (+${r.out.length - 3})` : ''}`);
    if (r.cut.length) bits.push(`cut: ${r.cut.slice(0, 3).join('; ')}${r.cut.length > 3 ? ` (+${r.cut.length - 3})` : ''}`);
    if (r.small.length) bits.push(`<40: ${r.small.slice(0, 3).join('; ')}${r.small.length > 3 ? ` (+${r.small.length - 3})` : ''}`);
    if (r.tiny.length) bits.push(`tiny: ${r.tiny.slice(0, 2).join('; ')}${r.tiny.length > 2 ? ` (+${r.tiny.length - 2})` : ''}`);
    if (bits.length) out.push(`- **${r.screen}** — ${bits.join(' · ').replace(/\|/g, '/')}`);
  }
  return out.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('table.mjs')) process.stdout.write(table(process.argv[2] ?? 'before'));
