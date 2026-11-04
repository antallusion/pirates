// docs/38 §2.4 variant B (owner, 2026-11-03): the elite kinds of the island's dwellings of level 8 and up — a fair price.
//
// A man of an elite kind is some +35–50% over the upgraded kind of his tier in every number and brings a craft more
// (owner 2026-11-04: the price ×1.6 of the upgraded kind, «давай поднимем» — the numbers raised to match it),
// so a hammock holds more fight with him; but a silver's worth of them is no stronger than a silver's worth of the
// upgraded kind (the battle's own square law, armyWeight, within ~10%), and the ladder's armies with every upgraded
// stack swapped for its tier's elite at the same silver win about half their boardings against the same armies
// without — 50–60% on the whole. (At ×1.6 with only +25% they lost 0–28%: the square law makes a man +25% in every number
// worth ~×1.3 the silver, so ×1.6 asks some +40%.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELITE_IDS, TIER_ELITE, UNITS, UNIT_IDS, armyCost, armyForLevel, armyPower, armyTidy, armyWeight, isElite } from '../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import { BAND, CREW, side, wins } from './creatures.ts';

const upOf = (e: UnitId): UnitId => UNITS[UNITS[e].base].upgrade!;

test('docs/38 §2.4 B: an elite kind for each of the seven tiers — over the upgraded kind of its tier, not of the sea’s own', () => {
  assert.equal(ELITE_IDS.length, 7);
  for (let t = 1; t <= 7; t++) {
    const e = TIER_ELITE[t]!;
    const d = UNITS[e], up = UNITS[upOf(e)];
    assert.ok(isElite(e) && d.elite && d.up && d.tier === t && d.upgrade === null && !UNIT_IDS.includes(e as never), `${e}: the third kind of tier ${t}`);
    assert.equal(UNITS[d.base].upgrade, up.id, `${e}: the plain and upgraded pair kept`);
    assert.equal(!!d.deep, !!up.deep, `${e}: the deep's own as its tier's`);
    // its numbers some +20–25% over the upgraded kind's (the pace and the shots not less), a craft more
    for (const k of ['atk', 'def', 'hp'] as const) assert.ok(d[k] >= up[k] * 1.3 && d[k] <= up[k] * 1.7, `${e}: ${k} ${d[k]} over ${up[k]}`);
    assert.ok(d.dmin + d.dmax >= (up.dmin + up.dmax) * 1.1, `${e}: its blow`);
    assert.ok(d.speed >= up.speed && d.init >= up.init && d.shots >= up.shots, `${e}: pace, initiative, shots`);
    assert.ok(up.specials.every((s) => d.specials.includes(s)) && d.specials.length > up.specials.length, `${e}: the upgraded kind's craft and one more`);
    assert.ok(d.cost >= up.cost * 1.55 && d.cost <= up.cost * 1.65, `${e}: ${d.cost} silver over ${up.cost}`);
  }
  // the strongest of its tier first in the army's row
  assert.deepEqual(armyTidy([{ u: 'marine', n: 5 }, { u: 'sea_grenadier', n: 2 }, { u: 'sea_guard', n: 3 }]).map((x) => x.u), ['sea_grenadier', 'sea_guard', 'marine']);
});

test('docs/38 §2.4 B: a silver’s worth of an elite is no more than ~10% over a silver’s worth of the upgraded kind (the square law), a man of it more', () => {
  for (const e of ELITE_IDS) {
    const up = upOf(e);
    const per = (u: UnitId) => armyWeight([{ u, n: 1000 }]) / (1000 * UNITS[u].cost);
    const r = per(e) / per(up);
    assert.ok(r >= 0.85 && r <= 1.1, `${e}: ${r.toFixed(3)} of ${up}'s weight a silver`);
    assert.ok(armyWeight([{ u: e, n: 100 }]) > armyWeight([{ u: up, n: 100 }]) * 1.15, `${e}: a man of it worth more in a fight`);
    assert.ok(armyPower([{ u: e, n: 1 }]) > armyPower([{ u: up, n: 1 }]) * 1.3, `${e}: and in the sea's reckoning`);
  }
});

test('docs/38 §2.4 B: the ladder’s armies with their upgraded stacks swapped for the elites at the same silver win about half — 50–60% on the whole', (t) => {
  const swap = (a: ArmyStack[]): ArmyStack[] => a.map((x) => {
    const d = UNITS[x.u];
    if (!d.up || d.elite) return { ...x };
    const e = TIER_ELITE[d.tier]!;
    return { u: e, n: Math.max(1, Math.round((x.n * d.cost) / UNITS[e].cost)) };
  });
  // a town-bred army of ⚓10 with its life guard and its deep's spawn (the ladder's own folds them away)
  const town = (M: number): ArmyStack[] => {
    const a = armyForLevel(10, M, 7, 'player');
    const i = a.findIndex((x) => x.u === 'marine'), j = a.findIndex((x) => x.u === 'deckhand');
    const silver = a[i].n * UNITS.marine.cost + a[j].n * UNITS.deckhand.cost;
    a[i] = { u: 'life_guard', n: Math.round((silver * 0.5) / UNITS.life_guard.cost) };
    a[j] = { u: 'deep_spawn', n: Math.round((silver * 0.5) / UNITS.deep_spawn.cost) };
    return a;
  };
  const out: string[] = [];
  let all = 0;
  const cases: [string, (M: number) => ArmyStack[], number][] = [[`⚓4`, (M) => armyForLevel(4, M, 7, 'player'), CREW[4]], [`⚓6`, (M) => armyForLevel(6, M, 7, 'player'), CREW[6]], [`⚓8`, (M) => armyForLevel(8, M, 7, 'player'), CREW[8]], [`⚓10`, (M) => armyForLevel(10, M, 7, 'player'), CREW[10]], ['town ⚓10', town, CREW[10]]];
  for (const [name, make, crew] of cases) {
    let w = 0;
    for (const f of BAND) {
      const a = make(Math.round(crew * f));
      const b = swap(a);
      assert.ok(Math.abs(armyCost(b) / armyCost(a) - 1) < 0.04, `${name}: the same silver (${armyCost(a)} / ${armyCost(b)})`);
      assert.ok(b.some((x) => UNITS[x.u].elite), `${name}: elites in it`);
      // both sides of the hexes, the same dice
      w += (wins(side(b), side(a), 40) + 1 - wins(side(a), side(b), 40, 11)) / 2 / BAND.length;
    }
    out.push(`${name} ${Math.round(w * 100)}%`);
    all += w / cases.length;
    assert.ok(w >= 0.35 && w <= 0.75, `${name}: ${w.toFixed(2)} (${out.join(', ')})`);
  }
  t.diagnostic(`${out.join(', ')}; on the whole ${Math.round(all * 100)}%`);
  assert.ok(all >= 0.47 && all <= 0.62, `on the whole ${all.toFixed(2)} (${out.join(', ')})`);
});
