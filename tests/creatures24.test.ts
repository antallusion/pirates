// The second dozen of creatures and the shop's (owner, 2026-10-04: «еще больше роликов генерируй, существ и кораблей»):
// twelve elites more for the world's armies — every faction among them, each in a place of its ships that no elite of
// its faction held, carried where those ships carry men — and twelve more kinds for the shop, filling its thin tiers
// on its own rules (tests/beasts100 holds those rules for all thirty-two); every one named in both languages, drawn by
// a painted kindred of its body till its own figure is cut, and painted four kinds to a sheet (tools/art/fleet_next.py)
// with no blood, bones, skulls nor gore in the words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, armyForLevel, armyPower, armyWeight, isPremiumUnit } from '../shared/src/data/army.ts';
import type { ArmyMix, ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { FACTION_ELITES, FACTION_KINDS, FACTION_NAMES, rosterArmy, rosterKind } from '../shared/src/data/factionunits.ts';
import type { FactionKindId, Roster } from '../shared/src/data/factionunits.ts';
import { premiumLeaks, premiumUnits } from '../shared/src/data/premium.ts';
import { PREMIUM_BEAST_IDS, PREMIUM_NAMES, PREMIUM_PEOPLE } from '../shared/src/data/premiumbeasts.ts';
import type { PremiumBeastId } from '../shared/src/data/premiumbeasts.ts';
import { FIGURES, figureStandIn } from '../shared/src/data/unitart.ts';
import { Rng } from '../shared/src/rng.ts';
import { luckOf, newBattle } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { makeGame } from './helpers.ts';

const FACTION_NEW: FactionKindId[] = ['crown_pikeman', 'rime_witch', 'line_harpooner', 'hunt_master', 'fog_chemist', 'bounty_hunter', 'stone_axeman', 'mask_archer', 'island_chief', 'frostbound', 'ghost_bomber', 'ghost_commodore'];
const SHOP_NEW: PremiumBeastId[] = ['lantern_jelly', 'mantis_shrimp', 'hammerhead', 'walrus_bull', 'merrow_warden', 'sea_naga', 'brass_automaton', 'storm_giant', 'ember_phoenix', 'megalodon', 'marid', 'ice_wyvern'];
const ALL: UnitId[] = [...FACTION_NEW, ...SHOP_NEW];

/** The mixes each roster's ships sail with (as tests/beasts100 reads server/src/game/army.ts). */
const MIXES: Record<Roster, ArmyMix[]> = { crown: ['navy', 'merchant'], choir: ['deep'], harpoon: ['navy'], brokers: ['merchant'], league: ['merchant', 'navy'], free: ['merchant', 'navy'], dutchman: ['deep'] };

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const painted = (kind: string) => !!manifest.assets[`unit.${kind}`];
const py = readFileSync(new URL('../tools/art/creatures.py', import.meta.url), 'utf8');
/** tools/art/creatures.py's entries: id → faction, tier and the whole line of its words (read, not run). */
const ART = new Map([...py.matchAll(/^c\('([a-z_]+)', '([a-z_]+)', (\d+),.*$/gm)].map((m) => [m[1], { faction: m[2], tier: Number(m[3]), line: m[0] }]));
const sheets = JSON.parse(readFileSync(new URL('../tools/art/sheets.json', import.meta.url), 'utf8')) as Record<string, { grid: number[]; split?: string; ids: string[]; painting?: boolean; prompt: string; creatures?: { id: string; tier: number; body: string; faction: string }[] }>;
const ru = (s: string) => /[а-яё]/i.test(s);
const w1 = (u: UnitId) => armyWeight([{ u, n: 1 }]);
const p1 = (u: UnitId) => armyPower([{ u, n: 1 }]);

test('twelve elites more for the world\'s armies: every faction among them, each in a place no elite of its faction held, carried by its own ships', () => {
  assert.equal(new Set(FACTION_NEW).size, 12);
  assert.deepEqual([...new Set(FACTION_NEW.map((k) => FACTION_KINDS[k].roster))].sort(), ['brokers', 'choir', 'crown', 'dutchman', 'free', 'harpoon', 'league']);
  for (const k of FACTION_NEW) {
    const { roster, as } = FACTION_KINDS[k];
    const e = FACTION_ELITES[k]!;
    const d = UNITS[k], t = UNITS[as];
    assert.ok(e, `${k}: an elite (no hole is left where a faction's ships carry men)`);
    assert.equal(ART.get(k)?.faction, roster, `${k}: its figure in its faction's section of tools/art/creatures.py`);
    assert.equal(d.roster, roster);
    // The place's health, defence, pace and worth (the sea's gunnery does not move); its own blows and craft.
    assert.deepEqual([d.tier, d.hp, d.def, d.speed, d.init, d.cost], [t.tier, t.hp, t.def, t.speed, t.init, t.cost], `${k}: the ${as}'s place`);
    const wr = w1(k) / w1(as), pr = p1(k) / p1(as);
    assert.ok(wr >= 0.8 && wr <= 1.05 && pr <= 1.05, `${k}: ${wr.toFixed(2)} of the ${as}'s weight, ${pr.toFixed(2)} of its power`);
    assert.notDeepEqual(d.specials, t.specials, `${k}: a craft of its own`);
    assert.ok(!d.specials.includes('shooter') || d.shots > 0, `${k}: a shooter carries shots`);
    assert.equal(rosterKind(roster, as, e.from - 1), rosterKind(roster, as), `${k}: not below ⚓${e.from}`);
    assert.equal(rosterKind(roster, as, e.from), k, `${k}: from ⚓${e.from}`);
    let carried = false;
    for (const mix of MIXES[roster]) for (let L = e.from; L <= 10 && !carried; L++) for (const [men, slots] of [[60, 5], [120, 6], [250, 7]]) if (rosterArmy(roster, armyForLevel(L, men, slots, mix), L).some((x) => x.u === k)) carried = true;
    assert.ok(carried, `${k}: carried by the ${roster}'s ships`);
  }
  // One elite to a place, the old and the new together.
  const places = Object.keys(FACTION_ELITES).map((k) => `${FACTION_KINDS[k as FactionKindId].roster}:${FACTION_KINDS[k as FactionKindId].as}`);
  assert.equal(new Set(places).size, places.length);
  // And so at sea: a Crown patrol of ⚓8 with its pikemen, a ghost of ⚓9 under its commodores.
  const { game } = makeGame();
  const pat = game.spawnNpcShip('patrol', 'frigate', 'crown', 30000, 80000, 0);
  game.setNpcLevel(pat, 8);
  assert.ok(pat.army.some((x) => x.u === 'crown_pikeman'), `pikemen aboard: ${JSON.stringify(pat.army)}`);
  const ghost = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', 31000, 80000, 0);
  game.setNpcLevel(ghost, 9);
  assert.ok(ghost.army.some((x) => x.u === 'ghost_commodore'), `commodores aboard: ${JSON.stringify(ghost.army)}`);
});

test('twelve more for the shop: its thin tiers filled, sold from the shelf, handed out by nothing at sea', () => {
  assert.equal(new Set(SHOP_NEW).size, 12);
  for (const u of SHOP_NEW) {
    assert.ok(PREMIUM_BEAST_IDS.includes(u) && isPremiumUnit(u) && UNITS[u].beast, u);
    assert.ok(premiumUnits().includes(u), `${u}: on the shelf`);
    assert.equal(ART.get(u)?.faction, 'premium', `${u}: in the shop's section of tools/art/creatures.py`);
    assert.equal(ART.get(u)?.tier, UNITS[u].tier, `${u}: the art's tier`);
    assert.ok(PREMIUM_PEOPLE[u] === 'sea' || PREMIUM_PEOPLE[u] === 'land', `${u}: a people`);
  }
  // Three of the fourth tier, four of the fifth (it had two), two of the sixth, three of the seventh.
  assert.deepEqual([4, 5, 6, 7].map((t) => SHOP_NEW.filter((u) => UNITS[u].tier === t).length), [3, 4, 2, 3]);
  // (with the third dozen of the same day: 3 of the third tier, 9 of the fourth, 9 of the fifth, 13 of the sixth, 10 of
  // the seventh — tests/batch3)
  assert.deepEqual([3, 4, 5, 6, 7].map((t) => PREMIUM_BEAST_IDS.filter((u) => UNITS[u].tier === t).length), [3, 9, 9, 13, 10]);
  // Each new kind brings something of its own: no other kind of the shop has its body and its crafts both.
  const look = (u: PremiumBeastId) => `${FIGURES[u]?.body}:${[...UNITS[u].specials].sort().join('+')}`;
  for (const u of SHOP_NEW) assert.deepEqual(PREMIUM_BEAST_IDS.filter((x) => look(x) === look(u)), [u], `${u}: ${look(u)}`);
  assert.deepEqual(premiumLeaks(), []);
});

test('the twenty-four in both languages, drawn by a painted kindred of their body till their own figures are cut', () => {
  for (const k of ALL) {
    const n = UNITS[k].roster ? FACTION_NAMES[k as FactionKindId] : PREMIUM_NAMES[k as PremiumBeastId];
    assert.ok(n && /[a-z]/i.test(n[0]) && ru(n[1]) && n[2].length > 20 && ru(n[3]), `${k}: names`);
    if (UNITS[k].premium) assert.ok(UNITS[k].premium!.note[0].length > 20 && ru(UNITS[k].premium!.note[1]), `${k}: the card's line`);
    const f = FIGURES[k]!;
    assert.ok(f && f.size >= 1 && f.size <= 1.85, `${k}: a figure's height`);
    if (painted(k)) continue;
    const stand = figureStandIn(k, painted);
    assert.ok(stand && painted(stand) && manifest.assets[`unit.${stand}_atk`], `${k}: stands in as ${stand}`);
    assert.equal(FIGURES[stand as UnitId]?.body ?? f.body, f.body, `${k}: a figure of its body`);
  }
});

test('painted four kinds to a sheet, a row of four poses each, in the painter\'s queue — and no blood, bones, skulls nor gore in their words', () => {
  const quads = Object.entries(sheets).filter(([k]) => /^anim4_\d+$/.test(k));
  assert.equal(quads.length, 6);
  const on: string[] = [];
  for (const [key, sh] of quads) {
    assert.deepEqual(sh.grid, [4, 4], key);
    assert.equal(sh.split, 'blobs', `${key}: cut by its shapes, row by row`);
    assert.equal(sh.creatures?.length, 4, key);
    // Row by row: a kind's idle, its breath, its attack, its hit.
    assert.deepEqual(sh.ids, sh.creatures!.flatMap((c) => ['', '_b', '_atk', '_hit'].map((f) => `unit.${c.id}${f}`)), key);
    for (const c of sh.creatures!) {
      on.push(c.id);
      assert.equal(c.body, FIGURES[c.id as UnitId]?.body, `${c.id}: painted in the body it stands in as`);
      assert.equal(c.tier, ART.get(c.id)?.tier, c.id);
      if (!painted(c.id)) assert.ok(sh.painting, `${key}: in the painter's queue till it is cut`);
    }
    assert.match(sh.prompt, /magenta/);
  }
  assert.deepEqual(on.sort(), [...ALL].sort(), 'each of the twenty-four on one sheet');
  for (const k of ALL) {
    const line = ART.get(k)!.line;
    assert.ok(!/blood|bone|skull|skelet|gore|corpse|wound/i.test(line), `${k}: ${line}`);
  }
});

const side = (army: ArmyStack[]): TacSideInput => ({
  name: 'x', ship: 'y', captain: null, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0,
  blooded: 0, castle: false, struck: false, human: false,
} as TacSideInput);

test('their crafts are the battle\'s own: the masked archers bring luck, and every one of the twenty-four takes the field', () => {
  const bt = newBattle(side([{ u: 'mask_archer', n: 10 }, { u: 'sailor', n: 20 }]), side([{ u: 'sailor', n: 20 }]), 5, 0, new Rng(5));
  assert.equal(luckOf(bt, 0), luckOf(bt, 1) + 1, 'the spirits\' luck');
  for (const s of bt.stacks) if (s.unit === 'mask_archer') s.count = 0;
  assert.equal(luckOf(bt, 0), luckOf(bt, 1), 'and none once they have fallen');
  // Every new kind comes onto the field as a stack of its own.
  for (const u of ALL) {
    const b = newBattle(side([{ u, n: 3 }]), side([{ u: 'sailor', n: 20 }]), 9, 0, new Rng(9));
    assert.ok(b.stacks.some((s) => s.unit === u && s.count === 3), u);
  }
});
