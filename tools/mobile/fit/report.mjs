// The findings of a run, one line a screen and size: node tools/mobile/fit/report.mjs [phase] [all]
import { readFileSync } from 'node:fs';
const [phase = 'dev', all] = process.argv.slice(2);
const r = JSON.parse(readFileSync(`tools/mobile/fit/out/${phase}.json`, 'utf8')).rows;
for (const x of r) {
  if (x.missing || x.error) { console.log(x.screen, x.size, x.lang, 'MISSING', x.error ?? ''); continue; }
  const b = [];
  if (x.pages) b.push('P' + x.pages);
  if (x.page) b.push('PAGE ' + x.page);
  if (x.scroll.length) b.push('S: ' + x.scroll.join('; '));
  if (x.cut.length) b.push('C' + x.cut.length + ': ' + x.cut.slice(0, 3).join('; '));
  if (x.out.length) b.push('O' + x.out.length + ': ' + x.out.slice(0, 2).join('; '));
  if (x.tiny.length) b.push('T' + x.tiny.length + ': ' + x.tiny.slice(0, 3).join('; '));
  const min = x.minTap ?? 36;
  const under = x.small.filter((z) => { const m = /(\d+)×(\d+)$/.exec(z); return m && Math.min(+m[1], +m[2]) < min - 0.5; });
  if (under.length) b.push('U' + under.length + ': ' + under.slice(0, 4).join('; '));
  if (all || b.some((z) => !/^P\d/.test(z))) console.log(x.screen, x.size, x.lang, '|', b.join(' | ').slice(0, 420));
}
