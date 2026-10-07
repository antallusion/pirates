// The beasts' sea fight (owner, 2026-10-07: «акулы всякие они не должны убивать моих людей, как они команду могут
// убить? я вот уже сражаюсь с акулой минуты 2, это не нормально вообще. где баланс?»): a captain of ⚓L gives
// «Атаковать» on a beast of her level (its own levels kept: below its least level, the least one) 400 m off, and her
// helmsman and gun captains fight it as on a phone (tests/balance/beastfight.ts). Per beast and level: the fight's
// length from her first broadside and from the order (median, p90), the beasts killed and got away, her men lost
// (mean, most), her hull lost (mean), and the hunter's hour — what one kind is worth an hour hunted (huntHour: the
// search, the fight, the flensing; the carcass at the goods' base prices) against the sea's hour (seaHour(L)).
//
//   node --disable-warning=ExperimentalWarning tools/mobile/beast-time.ts [--n 20] [--levels 1,3,5,8] [--beasts shark,orca]
//     [--json out.json] [--before before.json]   (--before: the table «before → after» in markdown, by the rows of both)

import { readFileSync, writeFileSync } from 'node:fs';
import { BEASTS, BEAST_IDS } from '../../shared/src/data/beasts.ts';
import type { BeastId } from '../../shared/src/data/beasts.ts';
import { BEAST_BAND, beastRows, carcassValue, huntHour } from '../../tests/balance/beastfight.ts';
import type { BeastRow } from '../../tests/balance/beastfight.ts';
import { duelSea } from '../../tests/balance/duel.ts';
import { seaHour } from '../../tests/balance/island.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', '20'));
const LEVELS = arg('levels', '1,3,5,8').split(',').map(Number);
const ONLY = arg('beasts', BEAST_IDS.join(',')).split(',') as BeastId[];
const OUT = arg('json', '');
const BEFORE = arg('before', '');
const POD = process.argv.includes('--pod');

type Row = BeastRow & { value: number; hour: number; seaHour: number };

const hourOf = (r: BeastRow) => huntHour(r.beast, r.blevel, Number.isFinite(r.secMed) ? r.secMed : 180, r.killed / r.n);
const rows: Row[] = [];
if (!BEFORE || N > 0) {
  const game = duelSea();
  const t00 = Date.now();
  for (const lv of LEVELS) {
    for (const id of ONLY) {
      const [lo, hi] = BEASTS[id].level;
      // The beasts of her level: its own range, or the nearest it has a level or two off.
      if (lv < lo - 1 || lv > hi + 2) continue;
      const r = beastRows(game, id, lv, N, { pod: POD });
      const row: Row = { ...r, value: carcassValue(id, r.blevel), hour: hourOf(r), seaHour: seaHour(lv) };
      rows.push(row);
      const band = BEAST_BAND[id];
      console.log(`⚓${lv} ${id.padEnd(13)} ⚓${row.blevel}  killed ${row.killed}/${N} got away ${row.escaped}  from the first broadside ${row.fightMed}/${row.fightP90} s  from «Атаковать» ${row.secMed}/${row.secP90} s  [band ${band[0]}–${band[1]}]  men lost ${row.menMean} (most ${row.menMax})  hull lost ${Math.round(row.hullMean * 100)}%  carcass ${row.value}, hunted an hour ${row.hour} (${(row.hour / row.seaHour).toFixed(2)}× the sea's hour)   [${Math.round((Date.now() - t00) / 1000)}s]`);
    }
  }
}
if (OUT) writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), n: N, rows }, null, 1));
if (BEFORE) {
  const before = (JSON.parse(readFileSync(BEFORE, 'utf8')) as { rows: BeastRow[] }).rows;
  const s = (x: number) => (Number.isFinite(x) ? `${x}` : '—');
  console.log('\n| ⚓ | Beast | Fight from the first broadside, median / p90 | From «Атаковать» | Killed | Men lost, mean (most) | Hull lost | Hunted an hour, silver |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const a of rows) {
    const b = before.find((x) => x.level === a.level && x.beast === a.beast);
    if (!b) continue;
    const bh = (b as Row).hour ?? hourOf(b);
    const lv = (r: BeastRow) => (r.blevel === r.level ? '' : ` ⚓${r.blevel}`);
    console.log(`| ${a.level} | ${a.beast}${lv(b) === lv(a) ? lv(a) : `${lv(b) || ` ⚓${b.blevel}`} → ${lv(a) || `⚓${a.blevel}`}`} | ${s(b.fightMed)} / ${s(b.fightP90)} → **${s(a.fightMed)} / ${s(a.fightP90)} s** | ${s(b.secMed)} → ${s(a.secMed)} s | ${b.killed}/${b.n} → ${a.killed}/${a.n} | ${b.menMean} (${b.menMax}) → **${a.menMean} (${a.menMax})** | ${Math.round(b.hullMean * 100)} → ${Math.round(a.hullMean * 100)} % | ${bh} → ${a.hour} (×${bh ? (a.hour / bh).toFixed(2) : '∞'}) |`);
  }
}
