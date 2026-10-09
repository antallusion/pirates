// The sea's test matrix (docs/25 item 68, owner 2026-10-09: «должно быть 11-15 залпов при полном вооружении коробля и
// капитана, и где-то 21-25 залпов при голых короблях - но на высоких уровнях… Если это нпс то на 30% меньше»):
// broadsides to sink, ⚓1–10 × gear (bare / of her level / full / mixed) × against a captain, the sea's ship of her ⚓
// and an elite, by the game's own code (tests/balance/seakit.ts; the full table: node tools/balance-sea.ts). Bare and
// full against their like by the table ±1 broadside; gear of her level, mixed, the sea's ships and the elites by the
// formula (base(⚓) × defence / offence) ±15%. No ball that struck is reported at 0 (a splash to the eye). Her men a
// broadside 2–4% (grape twice), the target card's estimate near the measure, and the fights under way by the clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gearSource } from '../../shared/src/data/items.ts';
import { NPC_VOLLEYS, defRaw, gearDefCeil, gearDefence, gearOffCeil, gearOffence, halfGearDef, halfGearOff, seaBase } from '../../shared/src/data/seabalance.ts';
import { volleysToSink } from '../../shared/src/sim/volleys.ts';
import { computeShipStats } from '../../shared/src/sim/shipstats.ts';
import { useAbility } from '../../server/src/game/abilities.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { ANCHORS, CAPTAINS, bench, captainShip, clearSea, fightDistance, measure, npcShip, spot, tallyHits, underway } from './seakit.ts';
import type { Gear } from './seakit.ts';
import type { Game } from '../../server/src/game/Game.ts';

const N = 16;

function factors(ship: ShipEntity, anchor: number): { off: number; def: number } {
  const shipGear = Object.values(ship.loadout.gear ?? {}).filter((x) => !!x);
  const m = gearSource([...shipGear, ...ship.worn] as never).mods;
  return { off: gearOffence(m.gunDamageMul ?? 0, anchor), def: gearDefence(defRaw(m), anchor) };
}

/** `shooter`'s broadsides on `target`, laid beam on at the close fight's distance. */
function shoot(game: Game, shooter: ShipEntity, target: ShipEntity, ammo: 'round' | 'grape' = 'round', n = N) {
  const { x, y } = spot(game);
  const d = fightDistance(shooter);
  for (const [s, sx] of [[shooter, x], [target, x + d]] as const) {
    s.state.x = sx;
    s.state.y = y;
    s.state.heading = 0;
    game.grid.upsert(s.id, sx, y);
  }
  const m = measure(game, shooter, target, n, ammo);
  for (const [s, sx] of [[shooter, x - 5000], [target, x - 5600]] as const) {
    s.state.x = sx;
    game.grid.upsert(s.id, sx, y);
  }
  return m;
}

const near = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol;

test('the table (§1.1): bare against bare and full against full ±1 broadside at ⚓1–10; of her level, mixed, the sea\'s ships and the elites by the formula ±15%; no struck ball at 0', () => {
  const game = bench();
  const hits = tallyHits(game);
  const rows: string[] = [];
  const bad: string[] = [];
  for (const a of ANCHORS) {
    clearSea(game);
    const { x, y } = spot(game);
    const mk = (gear: Gear, seed = 1) => captainShip(game, { anchor: a, gear, seed }, x - 5000, y).ship;
    const bare = mk('bare'), bare2 = mk('bare'), full = mk('full'), full2 = mk('full'), lvl = mk('level', 11), lvl2 = mk('level', 11);
    const fB = factors(bare, a), fF = factors(full, a), fL = factors(lvl, a);
    const B = seaBase(a);
    const npc = npcShip(game, a, x - 5600, y), elite = npcShip(game, a, x - 5600, y, true);
    const cell = (row: string, s: ShipEntity, t: ShipEntity, want: number, tol: number) => {
      const got = shoot(game, s, t).volleys;
      rows.push(`⚓${a} ${row}: ${got.toFixed(1)} (the table ${want.toFixed(1)})`);
      if (!near(got, want, tol)) bad.push(rows.at(-1)!);
    };
    // The table itself: 6 + 2·(⚓−1) bare; ×(1 + 0.025·⚓) ÷ (1.1 + 0.11·⚓) in full gear.
    cell('bare → bare', bare, bare2, B, 1);
    cell('full → full', full, full2, (B * gearDefCeil(a)) / gearOffCeil(a), 1);
    // By the formula ±15%.
    const f = (want: number) => want * 0.15;
    cell('level → level', lvl, lvl2, (B * fL.def) / fL.off, f((B * fL.def) / fL.off));
    cell('full → bare', full, bare2, (B * fB.def) / fF.off, f((B * fB.def) / fF.off));
    cell('bare → full', bare, full2, (B * fF.def) / fB.off, f((B * fF.def) / fB.off));
    for (const [row, s, off] of [['bare → NPC', bare, fB.off], ['full → NPC', full, fF.off]] as const) cell(row, s, npc, (B * NPC_VOLLEYS * halfGearDef(a)) / off, f((B * NPC_VOLLEYS * halfGearDef(a)) / off));
    for (const [row, s, off] of [['bare → elite', bare, fB.off], ['full → elite', full, fF.off]] as const) cell(row, s, elite, (B * gearDefCeil(a)) / off, f((B * gearDefCeil(a)) / off));
    for (const [row, t, def] of [['NPC → bare', bare, fB.def], ['NPC → full', full, fF.def]] as const) cell(row, npc, t, (B * def) / halfGearOff(a), f((B * def) / halfGearOff(a)));
    cell('elite → full', elite, full, (B * fF.def) / gearOffCeil(a), f((B * fF.def) / gearOffCeil(a)));
  }
  console.log(rows.join('\n'));
  assert.deepEqual(bad, [], bad.join('\n'));
  // The owner's words at ⚓10: 11–15 in full, 21–25 bare; the sea's ships 30% fewer.
  const at10 = (row: string) => Number(rows.find((r) => r.startsWith(`⚓10 ${row}:`))!.split(': ')[1].split(' ')[0]);
  assert.ok(at10('full → full') >= 11 && at10('full → full') <= 15, `⚓10 in full: ${at10('full → full')}`);
  assert.ok(at10('bare → bare') >= 21 && at10('bare → bare') <= 25, `⚓10 bare: ${at10('bare → bare')}`);
  assert.ok(at10('bare → NPC') < at10('bare → bare') * 0.85, 'the sea\'s ship sinks the sooner');
  assert.ok(hits.hits > 1000, `${hits.hits} balls struck`);
  assert.equal(hits.zero, 0, 'no ball that struck reported at 0 (drawn as a splash)');
});

test('the six captains alike: their passives touch no broadside — bare and full against their like by the table at ⚓1, 5, 10', () => {
  const game = bench();
  const bad: string[] = [];
  for (const a of [1, 5, 10]) {
    clearSea(game);
    const { x, y } = spot(game);
    for (const captain of CAPTAINS) {
      for (const gear of ['bare', 'full'] as const) {
        const s = captainShip(game, { anchor: a, gear, captain }, x - 5000, y).ship, t = captainShip(game, { anchor: a, gear, captain: 'corsair' }, x - 5600, y).ship;
        const want = gear === 'bare' ? seaBase(a) : (seaBase(a) * gearDefCeil(a)) / gearOffCeil(a);
        const got = shoot(game, s, t).volleys;
        if (!near(got, want, 1)) bad.push(`⚓${a} ${captain} ${gear}: ${got.toFixed(1)} (the table ${want.toFixed(1)})`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('a broadside before the boarding (item 8): 2–4% of her men with round shot, twice that with grape', () => {
  const game = bench();
  for (const a of [1, 4, 7, 10]) {
    clearSea(game);
    const { x, y } = spot(game);
    const s = captainShip(game, { anchor: a, gear: 'bare' }, x - 5000, y).ship, t = captainShip(game, { anchor: a, gear: 'bare' }, x - 5600, y).ship;
    const round = shoot(game, s, t, 'round', 48).menShare, grape = shoot(game, s, t, 'grape', 48).menShare;
    // A sound side: 2% (4% through a shattered one, army.ts wallsOf); grape sweeps the open deck whatever her side.
    assert.ok(round >= 0.012 && round <= 0.03, `⚓${a}: round ${(round * 100).toFixed(1)}% of her men a broadside`);
    assert.ok(grape >= 0.04 && grape <= 0.08, `⚓${a}: grape ${(grape * 100).toFixed(1)}%`);
  }
});

test('«≈ N залпов» (item 12): the target card\'s estimate is near the broadsides measured', () => {
  const game = bench();
  for (const a of [1, 5, 10]) {
    clearSea(game);
    const { x, y } = spot(game);
    for (const [sg, tg, kind] of [['bare', 'bare', 'cap'], ['full', 'full', 'cap'], ['full', 'bare', 'npc']] as const) {
      const s = captainShip(game, { anchor: a, gear: sg }, x - 5000, y).ship;
      const t = kind === 'npc' ? npcShip(game, a, x - 5600, y) : captainShip(game, { anchor: a, gear: tg }, x - 5600, y).ship;
      const info = t.info();
      const est = volleysToSink(s.stats, s.loadout, { isPlayer: true, ironRain: s.rank('gun_iron_rain') > 0 }, { classId: info.classId, shipLevel: info.shipLevel!, isPlayer: info.isPlayer, hullMax: info.hullMax!, armor: info.armor!, inc: info.inc!, hullFrac: 1 })!;
      const got = shoot(game, s, t).volleys;
      assert.ok(Math.abs(est - Math.ceil(got)) <= Math.max(1, Math.ceil(got) * 0.2), `⚓${a} ${sg} → ${kind === 'npc' ? 'NPC' : tg}: «≈ ${est}», measured ${got.toFixed(1)}`);
    }
  }
});

test('Iron Rain (item 9) costs no reload now and goes through a tenth more armour; faster cooldowns (item 10) count on Z/X/C/V', () => {
  const l = { classId: 'frigate' as const, name: 'x', guns: { port: 'heavy_18' as const, starboard: 'heavy_18' as const }, modules: {}, level: 7 };
  const without = computeShipStats(l, 'corsair', {}), rain = computeShipStats(l, 'corsair', { gun_iron_rain: 1 });
  assert.ok(Math.abs(rain.reloadMul - without.reloadMul) < 1e-9, 'no reload cost');
  assert.ok(rain.gunDamageMul > without.gunDamageMul * 1.2, 'her broadside +25%');
  // The Signal Hoist banner: −5% to every cooldown, the captain's abilities' too.
  const game = bench();
  const { x, y } = spot(game);
  const { s, ship } = captainShip(game, { anchor: 5, gear: 'bare', captain: 'admiral' }, x, y);
  const cast = () => {
    s.profile!.cooldowns = {};
    assert.equal(useAbility(game, ship, 'form_line', x, y), null);
    return s.profile!.cooldowns.form_line - game.now;
  };
  const plain = cast();
  ship.loadout.gear = { banner: { uid: 77, base: 'signal_hoist', ilvl: 5, rarity: 4, affixes: [], dur: 100 } } as never;
  ship.recompute(game.now);
  assert.ok(ship.stats.cooldownMul < 1, 'the banner speeds cooldowns');
  assert.ok(Math.abs(cast() - plain * ship.stats.cooldownMul) < 1e-6, 'and the ability\'s with them');
});

test('under way, bot against bot in full gear (§1.1): about half a minute at ⚓1, about two minutes at ⚓10', () => {
  const game = bench();
  const med = (xs: number[]) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];
  for (const [a, lo, hi] of [[1, 15, 50], [10, 75, 180]] as const) {
    const fights: number[] = [];
    for (let k = 0; k < 3; k++) {
      clearSea(game);
      const { x, y } = spot(game);
      const A = captainShip(game, { anchor: a, gear: 'full' }, x, y).ship, B = captainShip(game, { anchor: a, gear: 'full' }, x + 900, y).ship;
      const r = underway(game, A, B, 300 + a * 17 + k);
      assert.ok(r.sunk, `⚓${a}: a sinking (duel ${k})`);
      fights.push(r.fight);
    }
    assert.ok(med(fights) >= lo && med(fights) <= hi, `⚓${a}: ${fights.join(', ')} s from the first broadside`);
  }
});
