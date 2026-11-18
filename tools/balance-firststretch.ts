// VK 4.1.6.4 (2026-11-18): a fresh captain's first stretch — the First Watch's raider and the campaign's first quests —
// fought once each at no skill; how many are won at the first try (tests/balance/firststretch.ts).
//   node --disable-warning=ExperimentalWarning tools/balance-firststretch.ts [runs=6] [slots=22]
import { firstStretch } from '../tests/balance/firststretch.ts';
import type { StretchFight } from '../tests/balance/firststretch.ts';

const runs = Number(process.argv[2] ?? 6), slots = Number(process.argv[3] ?? 22);
const all: StretchFight[][] = [];
for (let k = 0; k < runs; k++) {
  const r = firstStretch(101 + k * 17, slots);
  all.push(r);
  console.error(`run ${k + 1}: ${r.map((f) => `${f.quest}:${f.kind}${f.won ? '+' : '−'}`).join(' ')}`);
}
const by = new Map<string, { n: number; won: number; foes: Set<string>; level: number }>();
for (const r of all) for (const f of r) {
  const key = `${f.quest} ${f.kind}`;
  const e = by.get(key) ?? { n: 0, won: 0, foes: new Set(), level: f.level };
  e.n++;
  if (f.won) e.won++;
  e.foes.add(f.foe);
  by.set(key, e);
}
console.log('| Шаг | Ур. | Бой | Выиграно с первого раза | Противник |');
console.log('|---|---|---|---|---|');
for (const [k, e] of by) console.log(`| ${k.split(' ')[0]} | ${e.level} | ${k.split(' ')[1]} | ${e.won}/${e.n} (${Math.round((100 * e.won) / e.n)}%) | ${[...e.foes].slice(0, 4).join('; ')} |`);
const first3 = all.map((r) => r.slice(0, 3).every((f) => f.won));
console.log(`\nthe first three fights all won: ${first3.filter(Boolean).length}/${runs}`);
const total = all.flat();
console.log(`every fight of the stretch: ${total.filter((f) => f.won).length}/${total.length} won`);
