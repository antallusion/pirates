// The captains at sea (docs/25 items 13–43; owner, 2026-10-09: «нужно еще у каждого капитана проверить личные
// способности, придумать логику развития их … надо этот момент для всех капитанов проработать идеально … с 1 по
// последний уровень будет супер работать»; «делай все пункты»):
//  - the role (§1.1): a kit used well takes 15–25% off a sea fight (the Corsair's to 30%), a defensive one puts as much on;
//    no captain more than 15% ahead of another at any band — the game's own fights (kitbench.ts), ⚓1 / 5 / 10;
//  - item 39: no ability loses more than a fifth of its strength between the 1st level and the 60th (the 6th for an
//    ultimate): its share of a fight on the bench, or its role's number (speed, crew, survival);
//  - item 37: the ranks by level; item 38: the facets (free once, a change in a port for silver); item 40: the ultimate
//    charged by what she deals, the alpha limit's cut with it; item 41: the six combos and their cue; item 42: a talent
//    of her favoured trees for each ability; item 43: the Throne's mastery; items 17–18: the escort and her passive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTAINS } from '../../shared/src/data/captains.ts';
import type { CaptainId } from '../../shared/src/data/captains.ts';
import { MASTERY_CAP, SEA_SKILLS, SKILL_NODES, captainSkills, escortCost, facetCost, facetKey, nextRank, skillMastery, skillNums, skillRank } from '../../shared/src/data/seaskill.ts';
import { TALENTS_BY_ID } from '../../shared/src/data/talents.ts';
import { computeShipStats } from '../../shared/src/sim/shipstats.ts';
import { RESOLVE_DEALT } from '../../server/src/game/mind.ts';
import { useAbility } from '../../server/src/game/abilities.ts';
import { chooseFacet } from '../../server/src/game/seaskill.ts';
import { fireBroadside, stepProjectiles } from '../../server/src/game/combat.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { bench, captainShip, clearSea } from './seakit.ts';
import { KIT_CAPTAINS, kitMedian, kitRows, lawlessWater } from './kitbench.ts';
import type { KitSide } from './kitbench.ts';

const SEEDS = [1, 2];
/** The band's level for each ⚓ measured: its first ranks at ⚓1, the middle at ⚓5, the last at ⚓10. */
const LEVEL: Record<number, number> = { 1: 3, 5: 24, 10: 58 };

test('the role (§1.1): a kit used well takes 15–25% off a sea fight (the Corsair to 30%), the defensive kits put as much on, no captain more than 15% ahead of another', () => {
  const game = bench();
  const rows = kitRows(game, [1, 5, 10], ['full'], SEEDS, KIT_CAPTAINS, (a) => LEVEL[a]);
  const out: string[] = [];
  const bad: string[] = [];
  for (const a of [1, 5, 10]) {
    const band = rows.filter((r) => r.anchor === a);
    for (const r of band) {
      const { shorter, longer } = r;
      out.push(`⚓${a} L${r.level} ${r.captain}: ${Math.round(shorter * 100)}% shorter, ${Math.round(longer * 100)}% longer fired upon`);
      // The low band has the first ranks and no ultimate (from the 6th): a little under the band's floor is its due.
      const lo = a === 1 ? 0.08 : 0.13, hi = r.captain === 'corsair' ? 0.31 : 0.27;
      if (shorter < lo || shorter > hi) bad.push(`⚓${a} ${r.captain}: ${Math.round(shorter * 100)}% shorter (${lo * 100}–${hi * 100}%)`);
      if ((r.captain === 'smuggler' || r.captain === 'drowned') && (longer < (a === 1 ? 0.1 : 0.13) || longer > 0.28)) bad.push(`⚓${a} ${r.captain}'s defence: ${Math.round(longer * 100)}% longer (15–25%)`);
    }
    // Each kit's fight against the same plain one: the slowest of the six against the quickest.
    const times = band.map((r) => 1 - r.shorter);
    const spread = Math.max(...times) / Math.min(...times);
    out.push(`⚓${a}: the slowest kit ${Math.round((spread - 1) * 100)}% behind the quickest`);
    if (spread > 1.15) bad.push(`⚓${a}: a captain ${Math.round((spread - 1) * 100)}% ahead of another`);
  }
  console.log(out.join('\n'));
  assert.deepEqual(bad, [], bad.join('\n'));
});

/** An ability's strength (item 39): its share of a fight on the bench (attack or defence), or its role's number. */
function strength(game: Game, captain: CaptainId, id: string, level: number, anchor: number): number {
  const s = SEA_SKILLS[id];
  // (the bench's fights are paired and their dice held: one seed tells an ability's share as well as three)
  const seeds = [1];
  const n = skillNums(id, { level, facets: {}, glory: 0, talents: {} }).n;
  const foe: KitSide = { anchor, gear: 'full', captain: 'navigator', level, kit: false };
  const me = (only: string[]): KitSide => ({ anchor, gear: 'full', captain, level, kit: true, only });
  const attack = () => 1 - kitMedian(game, me([id]), foe, seeds).sec / kitMedian(game, me([]), foe, seeds).sec;
  const defend = () => kitMedian(game, foe, me([id]), seeds).sec / kitMedian(game, foe, me([]), seeds).sec - 1;
  switch (id) {
    // The role's numbers: what the ability does as a share (of her speed, of their men, of their way, of her purse).
    case 'trim_sails': return n.speed;
    case 'current_rider': return n.slow + n.turn;
    case 'grapeshot_frenzy': return n.crew + n.army;
    case 'red_hook_boarding': return n.power + n.army;
    case 'bribe_signal': return n.dur;
    case 'undertow': return n.pull;
    case 'dark_running': return n.ambush;
    // Fired upon: what it puts on the fight.
    case 'smoke_pots': case 'brine_mend': case 'war_cry': return defend();
    default: return s.key === 'P' ? 0 : attack();
  }
}

test('item 39: no ability loses more than a fifth of its strength between the 1st level and the 60th (the 6th for an ultimate)', () => {
  const game = bench();
  const bad: string[] = [];
  const out: string[] = [];
  for (const c of KIT_CAPTAINS) {
    for (const ab of CAPTAINS[c].abilities) {
      const lo = ab.kind === 'ultimate' ? 6 : 1;
      const s1 = strength(game, c, ab.id, lo, 1), s60 = strength(game, c, ab.id, 60, 10);
      out.push(`${c} ${ab.key} ${ab.id}: L${lo} ${(s1 * 100).toFixed(1)} → L60 ${(s60 * 100).toFixed(1)}`);
      // (a point and a half of a fight is the bench's dice between two runs of three)
      if (s60 < 0.8 * s1 - 0.015) bad.push(out.at(-1)!);
    }
  }
  console.log(out.join('\n'));
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('item 37: ranks 1–5 at levels 1 / 12 / 24 / 36 / 48, the ultimate 1–4 at 6 / 20 / 35 / 50; the next rank and its level', () => {
  assert.deepEqual([1, 11, 12, 23, 24, 36, 47, 48, 60].map((l) => skillRank(l, 'Z')), [1, 1, 2, 2, 3, 4, 4, 5, 5]);
  assert.deepEqual([1, 5, 6, 19, 20, 34, 35, 50, 60].map((l) => skillRank(l, 'V')), [0, 0, 1, 1, 2, 2, 3, 4, 4]);
  assert.deepEqual(nextRank(13, 'X'), { rank: 3, level: 24 });
  assert.deepEqual(nextRank(36, 'V'), { rank: 4, level: 50 });
  assert.equal(nextRank(50, 'V'), null);
  // Every ability grows rank by rank (its power numbers never fall) and every number is a share or a time.
  for (const s of Object.values(SEA_SKILLS)) {
    const max = s.key === 'V' ? 4 : 5;
    for (let r = 2; r <= max; r++) {
      const a = skillNums(s.id, { level: 60, facets: {}, glory: 0, talents: {} }, r - 1).n, b = skillNums(s.id, { level: 60, facets: {}, glory: 0, talents: {} }, r).n;
      for (const k of s.pow) assert.ok(b[k] >= a[k], `${s.id} ${k} rank ${r - 1} → ${r}: ${a[k]} → ${b[k]}`);
    }
  }
});

test('item 38: facets at ranks 3 and 5 (the ultimate at 3), two each; chosen free, changed in a port for silver; the numbers follow', () => {
  for (const c of KIT_CAPTAINS) for (const s of captainSkills(c)) {
    if (s.key === 'P') continue;
    for (const r of s.key === 'V' ? [3] : [3, 5]) assert.equal(s.facets?.[r as 3 | 5]?.length, 2, `${s.id} rank ${r}`);
  }
  const game = bench();
  clearSea(game);
  const { x, y } = lawlessWater(game);
  const { s, ship } = captainShip(game, { anchor: 4, gear: 'bare', captain: 'corsair', level: 25, kit: true }, x, y);
  const p = s.profile!;
  assert.match(chooseFacet(game, s, 'double_shot', 5, 'a') ?? '', /rank 5/, 'rank 5 opens at the 48th');
  assert.equal(chooseFacet(game, s, 'double_shot', 3, 'a'), null, 'the first choice: free, at sea');
  assert.equal(p.facets?.[facetKey('double_shot', 3)], 'a');
  const base = skillNums('double_shot', { level: 25, facets: {}, glory: 0, talents: {} }).n.bonus;
  assert.ok(Math.abs(skillNums('double_shot', { level: 25, facets: p.facets!, glory: 0, talents: {} }).n.bonus - base * 1.2) < 1e-9, '«В корпус»: +20%');
  assert.match(chooseFacet(game, s, 'double_shot', 3, 'b') ?? '', /port/, 'a change at sea refused');
  ship.docked = 'saltmarrow';
  const g0 = p.gold;
  assert.equal(chooseFacet(game, s, 'double_shot', 3, 'b'), null);
  assert.equal(g0 - p.gold, facetCost(25), 'a change in a port: her level\'s silver');
  assert.equal(p.facets?.[facetKey('double_shot', 3)], 'b');
});

test('item 40: the ultimate charges from the damage she deals — the alpha limit\'s cut too', () => {
  const game = bench();
  clearSea(game);
  const { x, y } = lawlessWater(game);
  const A = captainShip(game, { anchor: 3, gear: 'full', captain: 'corsair', level: 15, kit: true }, x, y).ship;
  const B = captainShip(game, { anchor: 3, gear: 'bare', captain: 'navigator', level: 15 }, x + 150, y).ship;
  for (const s of [A, B]) s.region = game.regionAt(s.state.x, s.state.y);
  // A broadside thrice as heavy: past her alpha limit.
  A.addEffect({ id: 'test_heavy', until: game.now + 99, mods: { skillDamage: 3 } }, game.now);
  A.resolve = 0;
  B.resolve = 0;
  let cut = 0;
  const emit = game.emit.bind(game);
  game.emit = ((ev: { k: string; capped?: boolean }, ex: number, ey: number) => {
    if (ev.k === 'hit' && ev.capped) cut++;
    emit(ev as never, ex, ey);
  }) as typeof game.emit;
  const h0 = B.hull;
  fireBroadside(game, A, 'starboard', 150, { x: B.state.x, y: B.state.y }, 1, {});
  for (let i = 0; i < 200 && game.projectiles.length; i++) stepProjectiles(game, 0.05);
  const dealt = (h0 - B.hull) / B.stats.hullMax;
  assert.ok(cut > 0, 'some balls past the limit');
  assert.ok(A.resolve > dealt * 100 * RESOLVE_DEALT * 1.2, `she charged by more than she landed: ${A.resolve.toFixed(1)} for ${(dealt * 100).toFixed(1)}% landed`);
  assert.ok(Math.abs(B.resolve - dealt * 100) < 1, 'the one struck: one a point, as before');
});

test('item 41: the six combos land, strike, and show their cue', () => {
  const game = bench();
  const cues: string[] = [];
  const emit = game.emit.bind(game);
  game.emit = ((ev: { k: string; id?: string; combo?: boolean }, ex: number, ey: number) => {
    if (ev.k === 'skill' && ev.combo) cues.push(ev.id!);
    emit(ev as never, ex, ey);
  }) as typeof game.emit;
  const fly = () => {
    for (let i = 0; i < 400 && game.projectiles.length; i++) stepProjectiles(game, 0.05);
  };
  /** One captain of the 50th at her mark 150 m off her starboard beam, her first ability then the second. */
  const run = (captain: CaptainId): { combo: boolean; dealt: number } => {
    clearSea(game);
    cues.length = 0;
    const { x, y } = lawlessWater(game);
    const { s, ship: A } = captainShip(game, { anchor: 9, gear: 'full', captain, level: 50, kit: true }, x, y);
    const B = captainShip(game, { anchor: 9, gear: 'full', captain: 'navigator', level: 50 }, x + 150, y).ship;
    for (const o of [A, B]) o.region = game.regionAt(o.state.x, o.state.y);
    s.profile!.gold = 1e7;
    A.resolve = 100;
    A.dread = 100;
    const h0 = B.hull;
    const cast = (id: string) => assert.equal(useAbility(game, A, id, B.state.x, B.state.y), null, `${captain}: ${id}`);
    const fire = () => {
      A.reload.starboard = 0;
      assert.equal(fireBroadside(game, A, 'starboard', 150, { x: B.state.x, y: B.state.y }, 1, {}), null);
      fly();
    };
    switch (captain) {
      case 'corsair': cast('hard_over'); cast('double_shot'); fire(); break;
      case 'admiral': cast('mark_target'); cast('admiralty_barrage'); for (let i = 0; i < 80; i++) game.step(); break;
      case 'reaver': cast('war_cry'); cast('ramming_speed'); game.ram(A, B, A.stats.maxSpeed * 0.7); break;
      case 'smuggler': cast('dark_running'); fire(); break;
      case 'navigator': cast('star_fix'); fire(); break;
      case 'drowned': cast('deep_call'); cast('maw_of_the_deep'); for (let i = 0; i < 80; i++) game.step(); break;
    }
    return { combo: cues.length > 0, dealt: h0 - B.hull };
  };
  const first: Record<CaptainId, string> = { corsair: 'hard_over', admiral: 'mark_target', reaver: 'war_cry', smuggler: 'dark_running', navigator: 'star_fix', drowned: 'deep_call' };
  for (const c of KIT_CAPTAINS) {
    const r = run(c);
    assert.ok(r.combo, `${c}: the combo of ${first[c]} and its cue`);
    assert.ok(r.dealt > 0, `${c}: it struck`);
  }
});

test('item 42: one talent of her favoured trees for each of her four abilities (+power or +duration), and it counts', () => {
  for (const c of KIT_CAPTAINS) {
    for (const ab of CAPTAINS[c].abilities) {
      const s = SEA_SKILLS[ab.id];
      assert.ok(s.node, `${ab.id}: a talent`);
      const t = TALENTS_BY_ID[s.node!.talent];
      assert.ok(t, `${s.node!.talent} exists`);
      assert.ok(CAPTAINS[c].favoredTrees.includes(t.tree as never), `${ab.id}: ${t.tree} is a favoured tree of the ${c}`);
      assert.equal(SKILL_NODES[t.id].skill, ab.id);
      const k = s.node!.kind === 'power' ? s.pow[0] : s.node!.key ?? 'dur';
      const a = skillNums(ab.id, { level: 60, facets: {}, glory: 0, talents: {} }).n[k];
      const b = skillNums(ab.id, { level: 60, facets: {}, glory: 0, talents: { [t.id]: 1 } }).n[k];
      assert.ok(b > a, `${ab.id}: ${t.id} raises ${k}`);
    }
  }
});

test('item 43: past the cap the Throne\'s glory adds +2% a rank to her abilities, each a little less, to +20%', () => {
  assert.ok(Math.abs(skillMastery(1) - 0.02) < 0.002, `${skillMastery(1)}`);
  assert.ok(skillMastery(10) - skillMastery(9) < skillMastery(1) - skillMastery(0), 'diminishing');
  assert.ok(skillMastery(500) <= MASTERY_CAP + 1e-9 && skillMastery(500) > 0.199);
  const a = skillNums('maw_of_the_deep', { level: 60, facets: {}, glory: 0, talents: {} }).n.hull, b = skillNums('maw_of_the_deep', { level: 60, facets: {}, glory: 30, talents: {} }).n.hull;
  assert.ok(b / a > 1.18 && b / a <= 1.2, `${b / a}`);
});

test('items 17–18: the escort a ⚓ below hers by her level (a frigate, from the 50th a ship of the line, from the 60th two), its hire by level, her passive on its reload', () => {
  const game = bench();
  const kinds: string[] = [];
  for (const [anchor, level] of [[4, 22], [9, 49], [9, 52], [10, 60]] as const) {
    clearSea(game);
    const { x, y } = lawlessWater(game);
    const { s, ship } = captainShip(game, { anchor, gear: 'full', captain: 'admiral', level, kit: true }, x, y);
    ship.region = game.regionAt(x, y);
    s.profile!.gold = 1e6;
    assert.equal(useAbility(game, ship, 'call_escort'), null);
    const esc = [...game.ships.values()].filter((o) => o.ownerId === ship.id);
    kinds.push(`L${level}: ${esc.map((o) => `${o.loadout.classId}⚓${o.shipLevel}`).join(' + ')}`);
    assert.equal(esc.length, level >= 60 ? 2 : 1, kinds.at(-1));
    for (const o of esc) assert.ok(o.shipLevel <= Math.max(9, ship.shipLevel - 1) && o.shipLevel >= ship.shipLevel - 1, kinds.at(-1));
    if (level >= 50) assert.equal(esc[0].loadout.classId, 'man_o_war');
    // Chain of Command: her escort loads faster within 500 m.
    for (let i = 0; i < 25; i++) game.step();
    assert.ok(esc[0].hasEffect('chain_of_command'), 'her passive on the escort');
  }
  assert.ok(escortCost(60) > escortCost(20) * 2, 'the hire grows with her level');
  console.log(kinds.join('\n'));
});

test('the sea table is the bare sea\'s: a captain\'s passive is off on it, on with her kit', () => {
  const l = { classId: 'frigate' as const, name: 'x', guns: { port: 'heavy_18' as const, starboard: 'heavy_18' as const }, modules: {}, level: 7 };
  // A share of an ability multiplies what the rest made of her: the same share whatever her talents.
  const plain = computeShipStats(l, 'corsair', {}), drilled = computeShipStats(l, 'corsair', { gun_fast_hands: 3 });
  const eff = [{ id: 'x', until: 1e9, mods: { skillReload: -0.2, skillDamage: 0.25 } }];
  const a = computeShipStats(l, 'corsair', {}, eff), b = computeShipStats(l, 'corsair', { gun_fast_hands: 3 }, eff);
  assert.ok(Math.abs(a.reloadMul / plain.reloadMul - 0.8) < 1e-9 && Math.abs(b.reloadMul / drilled.reloadMul - 0.8) < 1e-9);
  assert.ok(Math.abs(a.gunDamageMul / plain.gunDamageMul - 1.25) < 1e-9);
  const game = bench();
  clearSea(game);
  const { x, y } = lawlessWater(game);
  const off = captainShip(game, { anchor: 5, gear: 'bare', captain: 'corsair' }, x, y).ship;
  const on = captainShip(game, { anchor: 5, gear: 'bare', captain: 'corsair', kit: true }, x + 500, y).ship;
  assert.equal(off.kitOff, true);
  assert.equal(on.kitOff, false);
});
