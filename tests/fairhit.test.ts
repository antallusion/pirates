// Owner, 2026-10-10: «9 матросов убили 20 моих матросов с одного удара. что за бред? где баланс? это отвратительно...
// чини атаку всем, чини баланс … должно быть все идеально.» A blow is what the stacks' stats say (HoMM3): the men of the
// stack × a man's roll × her Attack against the other's Defense (docs/25 item 45: +5% a point to +100%, −2.5% a point
// to −50%) × what the player sees — luck, a blow into the side or from behind, cover, the orders and pages laid, and her
// captain's own gifts shown on the stack card (stackBonus). No hidden lift by the battle's level, by the sea's mind,
// by round 1, by a group's pace or by the rounds gone. The attack preview is reckoned by the same hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { UNITS, UNIT_IDS } from '../shared/src/data/army.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import { flankOf, hexNeighbors } from '../shared/src/data/tactical.ts';
import { npcHeroBattle } from '../shared/src/data/hero.ts';
import { adMod, blow, newBattle, previewBlow, stackBonus } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacStack } from '../server/src/game/tacbattle.ts';
import { captainAt, side, slOf } from './balance/boardlen.ts';

/** A boarding at level L: her stack of `mine` men of `u` against `theirs` of `v` — the other a ship of the sea (her
 *  captain the sea's of her waters) or (`pvp`) a captain of her level. `bare`: no skills, no artifacts on either (the
 *  sea's mind then plays a captain of her level as her primaries make her). */
function duel(L: number, u: UnitId, mine: number, v: UnitId, theirs: number, pvp: boolean, bare = false): TacBattle {
  const me = side([{ u, n: mine }], captainAt('corsair', L, 11, bare), 'corsair', true);
  const foe = pvp || bare ? side([{ u: v, n: theirs }], captainAt('admiral', L, 5, bare), 'admiral', pvp) : side([{ u: v, n: theirs }], npcHeroBattle(slOf(L), null), null, false);
  return newBattle(me, foe, 7, 0, new Rng(7), { len: 'board', level: L });
}
const stackOf = (bt: TacBattle, x: 0 | 1): TacStack => bt.stacks.find((s) => s.side === x)!;
/** A hex beside `t` in front of her (a blow from there comes into her face: no flank). */
function frontOf(bt: TacBattle, t: TacStack): number {
  return hexNeighbors(t.hex).find((h) => flankOf(t.face, t.hex, h) === 0 && !bt.stacks.some((o) => o.count > 0 && o.hex === h))!;
}
/** Men a blow of `dmg` fells of `t`. */
const fells = (t: TacStack, dmg: number): number => {
  const hp = (t.count - 1) * t.hpMax + t.hpTop;
  return dmg >= hp ? t.count : t.count - Math.ceil((hp - dmg) / t.hpMax);
};
/** The stat formula a player reckons from the two stack cards: men × a man's mean roll × Attack − Defense × her shown
 *  lift on the blow × the other's shown guard. */
function statDmg(bt: TacBattle, s: TacStack, t: TacStack, roll: 'min' | 'mean' | 'max' = 'mean'): number {
  const per = roll === 'min' ? s.dmin : roll === 'max' ? s.dmax : (s.dmin + s.dmax) / 2;
  const b = stackBonus(bt, s), g = stackBonus(bt, t);
  return s.count * per * adMod(s.atk, t.def) * b.melee * g.taken;
}

test('the owner\'s case: a ship of the sea\'s 9 deckhands strike her 20 at levels 1–10 — the blow is the stats\' (9 × 1–2 × A−D), never a whole stack', () => {
  for (const L of [1, 3, 5, 8, 10]) {
    const bt = duel(L, 'deckhand', 20, 'deckhand', 9, false);
    const mine = stackOf(bt, 0), sea = stackOf(bt, 1);
    const from = frontOf(bt, mine);
    for (let seed = 1; seed <= 40; seed++) {
      const r = blow(bt, sea, mine, 'melee', new Rng(seed), from);
      const k = r.lucky ? 2 : 1;
      const lo = Math.round(statDmg(bt, sea, mine, 'min') * k), hi = Math.round(statDmg(bt, sea, mine, 'max') * k);
      assert.ok(r.dmg >= lo - 1 && r.dmg <= hi + 1, `level ${L}, dice ${seed}: ${r.dmg} harm (the stats ${lo}–${hi})`);
      assert.ok(fells(mine, r.dmg) <= Math.ceil(hi / mine.hpMax), `level ${L}: ${fells(mine, r.dmg)} fell`);
    }
    // 9 deckhands' mean blow fells about 9 × 1.5 × A−D ÷ 5 — two to five of her twenty, not all of them.
    const mean = blow(bt, sea, mine, 'melee', null, from).dmg;
    assert.ok(Math.abs(mean - statDmg(bt, sea, mine)) <= 1, `level ${L}: ${mean} against ${statDmg(bt, sea, mine).toFixed(1)}`);
    assert.ok(fells(mine, mean) <= 6, `level ${L}: the mean blow fells ${fells(mine, mean)} of 20`);
  }
});

test('the stat formula holds for every pair of men at levels 1, 15, 30, 45 and 60, against the sea and against a captain (±25%)', () => {
  const out: string[] = [];
  for (const L of [1, 15, 30, 45, 60]) for (const pvp of [false, true]) for (const u of UNIT_IDS) for (const v of UNIT_IDS) {
    const bt = duel(L, u, 30, v, 30, pvp);
    const s = stackOf(bt, 0), t = stackOf(bt, 1);
    const want = statDmg(bt, s, t);
    const got = blow(bt, s, t, 'melee', null, frontOf(bt, t)).dmg;
    // A shooter's club is half her shot (a musket is a poor club): the card tells it.
    const club = UNITS[u].specials.includes('shooter') && !UNITS[u].specials.includes('no_penalty') ? 0.5 : 1;
    const w = want * club;
    if (Math.abs(got - w) > Math.max(1, 0.25 * w)) out.push(`L${L} ${pvp ? 'pvp' : 'sea'} ${u}→${v}: ${got} against ${w.toFixed(1)}`);
    const kw = fells(t, w), kg = fells(t, got);
    if (Math.abs(kg - kw) > Math.max(1, 0.25 * kw)) out.push(`L${L} ${pvp ? 'pvp' : 'sea'} ${u}→${v}: ${kg} fell against ${kw}`);
  }
  assert.deepEqual(out.slice(0, 20), []);
});

// The captains as their primaries make them (no skills, no artifacts: those are shown on the card as her +% and the
// formula above holds with them — an expert in Boarding with the Red Hook's arms strikes half as hard again, as HoMM3's
// Offense and its artifacts do). Both ways: hers on the sea's or the other captain's, and theirs on hers.
test('one stack never fells more than ~60% of an equal stack of the same men in one blow without an order or a page', () => {
  const out: string[] = [];
  for (const L of [1, 15, 30, 45, 60]) for (const pvp of [false, true]) for (const u of UNIT_IDS) for (const x of [0, 1] as const) {
    const bt = duel(L, u, 40, u, 40, pvp, true);
    const s = stackOf(bt, x), t = stackOf(bt, (1 - x) as 0 | 1);
    const share = fells(t, blow(bt, s, t, 'melee', null, frontOf(bt, t)).dmg) / t.count;
    if (share > 0.6) out.push(`L${L} ${pvp ? 'pvp' : 'sea'} ${x ? 'theirs' : 'hers'} ${u}: ${Math.round(share * 100)}%`);
  }
  assert.deepEqual(out, []);
});

test('the attack preview is the blow: every blow falls inside the preview\'s harm and fallen (twice it when lucky)', () => {
  for (const L of [1, 8, 25, 40, 60]) for (const pvp of [false, true]) for (const [u, v] of [['deckhand', 'deckhand'], ['marine', 'sailor'], ['boarder', 'guard'], ['musketeer', 'marine']] as [UnitId, UnitId][]) {
    const bt = duel(L, u, 25, v, 25, pvp);
    const s = stackOf(bt, 0), t = stackOf(bt, 1);
    const from = frontOf(bt, t);
    const how = UNITS[u].specials.includes('shooter') ? 'shot' : 'melee';
    const pv = previewBlow(bt, s, t, how, from);
    for (let seed = 1; seed <= 25; seed++) {
      const r = blow(bt, s, t, how, new Rng(seed * 3), how === 'melee' ? from : s.hex);
      const k = r.lucky ? 2 : 1;
      assert.ok(r.dmg >= pv.dmg[0] * k - 1 && r.dmg <= pv.dmg[1] * k + 1, `L${L} ${u}→${v}: ${r.dmg} outside ${pv.dmg.join('–')}${r.lucky ? ' ×2' : ''}`);
    }
    // The preview tells the player what the cards say: her Attack against the other's Defense.
    assert.equal(pv.ad, Math.round((adMod(s.atk, t.def) - 1) * 100));
  }
});

test('no lift by the battle\'s level or by the sea\'s mind: the same stacks strike the same at level 1 and level 60, against the sea and a captain', () => {
  const at = (L: number, pvp: boolean) => {
    const me = side([{ u: 'sailor', n: 20 }], undefined, null, true);
    const foe = side([{ u: 'sailor', n: 20 }], undefined, null, pvp);
    const bt = newBattle(me, foe, 7, 0, new Rng(7), { len: 'board', level: L });
    return blow(bt, stackOf(bt, 1), stackOf(bt, 0), 'melee', null, frontOf(bt, stackOf(bt, 0))).dmg;
  };
  const base = at(1, true);
  assert.equal(base, 42, '20 sailors × 2 (their mean roll) × 1.05 (Attack 4 against Defense 3: +5%)');
  for (const L of [1, 10, 20, 30, 45, 60]) for (const pvp of [false, true]) assert.equal(at(L, pvp), base, `level ${L} ${pvp ? 'between captains' : 'against the sea'}`);
});
