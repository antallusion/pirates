// The third batch (owner, 2026-10-04: «еще больше … существ и кораблей»): eight more hulls for doubloons, two a list at
// the tiers where her list's premium choice was thinnest, each with a gift and a creature kind of her own; twelve
// creatures for the islands' lairs where an island's kind and level had the fewest to choose from; twelve more kinds
// for the shop, the third tier opened; every one named in both languages, drawn by a painted kindred till its own is
// cut, and queued for the painter four kinds to a sheet and four hulls to a sheet with their decks
// (tools/art/fleet_b3.py) — no blood, bones, skulls nor gore in the words, and no game named in a prompt. The rules of
// the premium forty and of the shop's kinds hold them too (tests/fleet80, tests/beasts100, tests/premium).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, armyWeight, isPremiumUnit } from '../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { BEASTS, BEAST_IDS, BEAST_PLURAL } from '../shared/src/data/bestiary.ts';
import type { BeastId } from '../shared/src/data/bestiary.ts';
import { isBossUnit } from '../shared/src/data/bossunits.ts';
import { peopleOf } from '../shared/src/data/drifts.ts';
import { FLEET, HULL_STAND_IN, OLD_HULLS, silverKin } from '../shared/src/data/fleet.ts';
import { LAIRS, LAIR_CAL, LAIR_KINDS, lairKindsFor } from '../shared/src/data/lairs.ts';
import type { LairKind, LairRole } from '../shared/src/data/lairs.ts';
import { premiumLeaks, premiumShips, premiumUnits } from '../shared/src/data/premium.ts';
import { PREMIUM_BEAST_IDS, PREMIUM_NAMES, PREMIUM_PEOPLE, premiumFrom } from '../shared/src/data/premiumbeasts.ts';
import type { PremiumBeastId } from '../shared/src/data/premiumbeasts.ts';
import { SHIP_BEAST_DEFS, isShipBeast } from '../shared/src/data/shipbeasts.ts';
import type { ShipBeastId } from '../shared/src/data/shipbeasts.ts';
import { GIFT_KINDS, giftOf } from '../shared/src/data/shipgifts.ts';
import { HULL_ROLE, LEVEL_RANGE } from '../shared/src/data/shiplevel.ts';
import { FLEET_LISTS, SHIP_CLASSES } from '../shared/src/data/ships.ts';
import type { FleetClassId, FleetList } from '../shared/src/data/ships.ts';
import { FIGURES, figureStandIn } from '../shared/src/data/unitart.ts';
import type { IsleType } from '../shared/src/world/archipelago.ts';
import { Rng } from '../shared/src/rng.ts';
import { luckOf, newBattle } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { DATA_RU } from '../client/src/lang/data.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../client/src/lang/ui/army.ts';

/** The eight hulls, list by list. */
const HULLS: FleetClassId[] = ['bulldog', 'saint_elmo', 'lantern_sampan', 'golden_lion', 'dolphin', 'sailfish', 'mimic_barge', 'icebound_hulk'];
/** Their own kinds, hull by hull. */
const OWN: ShipBeastId[] = ['war_mastiff', 'corposant', 'cormorant', 'winged_lion', 'dolphin_pod', 'marlin', 'cask_mimic', 'ice_bear'];
/** The islands' twelve. */
const WILD: BeastId[] = ['poison_frog', 'bilge_rat', 'marine_iguana', 'ghost_crab', 'giant_centipede', 'jungle_spider', 'feral_bull', 'cinder_hound', 'cliff_harpy', 'banshee', 'plumed_serpent', 'wreck_titan'];
/** Their lairs. */
const NEW_LAIRS: LairKind[] = ['frog_pools', 'rat_wreck', 'iguana_rocks', 'ghost_strand', 'centipede_ravine', 'spider_grove', 'bull_savanna', 'cinder_slopes', 'harpy_crags', 'banshee_hollow', 'titan_wreck', 'serpent_temple'];
/** The shop's twelve. */
const SHOP: PremiumBeastId[] = ['war_parrot', 'electric_eel', 'sea_otter', 'flying_squid', 'selkie', 'kelp_golem', 'giant_lobster', 'manticore', 'sea_cyclops', 'sea_hydra', 'coral_colossus', 'cloud_whale'];
const ALL: UnitId[] = [...WILD, ...SHOP, ...OWN];

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const painted = (kind: string) => !!manifest.assets[`unit.${kind}`];
const py = readFileSync(new URL('../tools/art/creatures.py', import.meta.url), 'utf8');
/** tools/art/creatures.py's entries: id → faction, tier and the whole line of its words (read, not run). */
const ART = new Map([...py.matchAll(/^c\('([a-z_]+)', '([a-z_]+)', (\d+),.*$/gm)].map((m) => [m[1], { faction: m[2], tier: Number(m[3]), line: m[0] }]));
const shipsPy = readFileSync(new URL('../tools/art/ships.py', import.meta.url), 'utf8');
/** tools/art/ships.py's third batch: id → list and tier, and the words of her sprite and deck. */
const B3_ART = new Map([...shipsPy.matchAll(/^s_b3\('([a-z_]+)', '([a-z]+)', (\d+),.*$/gm)].map((m) => [m[1], { cat: m[2], tier: Number(m[3]), line: m[0] }]));
const b3py = readFileSync(new URL('../tools/art/fleet_b3.py', import.meta.url), 'utf8');
type Sheet = { grid: number[]; split?: string; ids: string[]; painting?: boolean; cut?: string; prompt: string; creatures?: { id: string; tier: number; body: string; faction: string }[] };
const sheets = JSON.parse(readFileSync(new URL('../tools/art/sheets.json', import.meta.url), 'utf8')) as Record<string, Sheet>;
const ru = (s: string) => /[а-яё]/i.test(s);
const w1 = (u: UnitId) => armyWeight([{ u, n: 1 }]);
const BAD_WORDS = /blood|bone|skull|skelet|gore|corpse|wound/i;
const GAMES = /heroes of might|warcraft|homm/i;

// ------------------------------------------------------------------------------------------------ the eight hulls

test('eight hulls for doubloons, two a list, at the tiers where her list\'s premium choice was thinnest', () => {
  const d = (c: FleetClassId) => SHIP_CLASSES[c];
  assert.deepEqual(HULLS.map((c) => `${d(c).list}${d(c).tier}`), ['combat1', 'combat2', 'trade1', 'trade5', 'fast1', 'fast5', 'hauler2', 'hauler3']);
  for (const l of FLEET_LISTS) {
    // The list's premium hulls by tier before the batch: the batch's two stand at the two thinnest.
    const before = [1, 2, 3, 4, 5].map((t) => FLEET[l].filter((c) => SHIP_CLASSES[c].premium && SHIP_CLASSES[c].tier === t && !HULLS.includes(c as FleetClassId)).length);
    const second = [...before].sort((a, b) => a - b)[1];
    const mine = HULLS.filter((c) => d(c).list === l);
    assert.equal(mine.length, 2, l);
    for (const c of mine) assert.ok(before[d(c).tier - 1] <= second, `${c}: tier ${d(c).tier} of the ${l} list had ${before[d(c).tier - 1]} premium hulls (${before.join('/')})`);
  }
  const band: Record<number, [number, number]> = { 1: [300, 600], 2: [600, 1000], 3: [1000, 1800], 4: [2000, 3000], 5: [3000, 5000] };
  for (const c of HULLS) {
    const x = d(c);
    // Never for silver; priced by her tier in doubloons; a gift and a kind of her own; the levels and the role of her tier.
    assert.ok(!x.purchasable && x.premium && !x.factions && !x.fixedMount, `${c}: sold for doubloons only`);
    assert.ok(x.premium!.price >= band[x.tier][0] && x.premium!.price <= band[x.tier][1], `${c}: ${x.premium!.price} doubloons at tier ${x.tier}`);
    assert.ok(premiumShips().includes(c), `${c}: in the shop`);
    assert.deepEqual(LEVEL_RANGE[c], { 1: [1, 3], 2: [3, 5], 3: [5, 7], 4: [7, 9], 5: [9, 10] }[x.tier]);
    assert.equal(HULL_ROLE[c], { combat: 'war', trade: 'trade', fast: 'all', hauler: 'trade' }[x.list as FleetList]);
    assert.ok(x.passive.mods || x.passive.id === 'sweeps', `${c}: her trait is a real line on her stats`);
    // The sea sails her silver kin of her list; an old hull of her list stands in for her art.
    const k = silverKin(c);
    assert.ok(SHIP_CLASSES[k].purchasable && SHIP_CLASSES[k].list === x.list && Math.abs(SHIP_CLASSES[k].tier - x.tier) <= 1, `${c} → ${k}`);
    assert.ok(OLD_HULLS.includes(HULL_STAND_IN[c]) && SHIP_CLASSES[HULL_STAND_IN[c]].list === x.list, `${c}: stands in as ${HULL_STAND_IN[c]}`);
  }
  assert.deepEqual(premiumLeaks(), []);
  // Seven kinds of gift among the eight, and a kind of her own aboard each, in her hammocks.
  assert.deepEqual([...new Set(HULLS.map((c) => giftOf(c)!.kind))].sort(), [...GIFT_KINDS].sort());
  HULLS.forEach((c, i) => {
    const b = d(c).premium!.beasts!;
    assert.deepEqual(b.map((x) => x.u), [OWN[i]], c);
    assert.equal(SHIP_BEAST_DEFS[OWN[i]].hull, c);
    assert.ok(isShipBeast(OWN[i]) && !premiumUnits().includes(OWN[i]), `${OWN[i]}: had only with her`);
  });
});

test('the eight in Russian, and on the painter\'s sheets with their decks', () => {
  const names = new Set<string>();
  for (const c of HULLS) {
    for (const k of ['name', 'role', 'passive.name', 'passive.description']) assert.ok(ru(DATA_RU[`ships.SHIP_CLASSES.${c}.${k}`] ?? ''), `${c}.${k}`);
    names.add(DATA_RU[`ships.SHIP_CLASSES.${c}.name`]);
    const g = giftOf(c)!;
    assert.ok(ru(g.name[1]) && ru(g.text[1]) && ru(SHIP_CLASSES[c].premium!.note[1]), c);
    // tools/art/ships.py paints her as the game lists her.
    const a = B3_ART.get(c);
    assert.ok(a, `${c}: in tools/art/ships.py B3`);
    assert.deepEqual([a!.cat, a!.tier], [SHIP_CLASSES[c].list, SHIP_CLASSES[c].tier], c);
    assert.ok(!BAD_WORDS.test(a!.line) && !GAMES.test(a!.line), a!.line);
  }
  assert.equal(names.size, HULLS.length, 'no two share a Russian name');
  // Two sheets of four, in the painter's queue till they are cut; their decks are queued by the same generator.
  const ships = [sheets.ships_21, sheets.ships_22];
  assert.deepEqual(ships.flatMap((s) => s.ids).sort(), HULLS.map((c) => SHIP_CLASSES[c].sprite).sort());
  for (const s of ships) {
    assert.deepEqual(s.grid, [4, 1]);
    assert.ok(s.painting || s.cut);
    assert.ok(/STRICTLY TOP-DOWN/.test(s.prompt) && /magenta/.test(s.prompt) && !GAMES.test(s.prompt));
  }
  assert.match(b3py, /bg\.deck_/);
  assert.match(b3py, /q_gpt_b3\.json/);
});

// ------------------------------------------------------------------------------------------------ the islands' twelve

test('twelve creatures for the islands, each the face of a lair where an island\'s kind and level had the fewest to choose from', () => {
  assert.equal(new Set(WILD).size, 12);
  for (const u of WILD) {
    const d = UNITS[u];
    assert.ok(d && d.beast && !isPremiumUnit(u) && BEAST_IDS.includes(u), u);
    assert.equal(ART.get(u)?.faction, 'wild', `${u}: in the wild beasts' section of tools/art/creatures.py`);
    assert.equal(ART.get(u)?.tier, d.tier, `${u}: the art's tier`);
    // A tier's peer: no heavier than the heaviest of its tier before it (the shop's kinds stay over them).
    const peers = (Object.keys(UNITS) as UnitId[]).filter((x) => UNITS[x].tier === d.tier && !UNITS[x].premium && !UNITS[x].legend && !UNITS[x].roster && !isBossUnit(x) && !WILD.includes(x as BeastId));
    assert.ok(w1(u) <= Math.max(...peers.map(w1)), `${u}: ${w1(u).toFixed(2)} a head at tier ${d.tier}`);
    assert.ok(w1(u) >= 0.6 * Math.max(...peers.map(w1)), `${u}: not a weakling of its tier`);
    assert.ok(['land', 'sea', 'deep'].includes(peopleOf(u)), `${u}: a people`);
    // Its own lair, and its lair's calibration over exactly its levels.
    const own = NEW_LAIRS.filter((k) => LAIRS[k].mix[0][0] === u);
    assert.equal(own.length, 1, `${u}: the face of one new lair`);
  }
  for (const k of NEW_LAIRS) {
    assert.ok(LAIR_KINDS.includes(k), k);
    const { lv, mix } = LAIRS[k];
    for (let L = 1; L <= 10; L++) assert.equal(LAIR_CAL[k][L][1] > 0, L >= lv[0] && L <= lv[1], `${k} ⚓${L}: calibrated`);
    assert.ok(mix.every(([u]) => !isPremiumUnit(u)), `${k}: nothing of the shop's`);
  }
  // Where they stand: the swamps' first levels had one kind of shore lair, the dead isles two, the graveyards' and the
  // dead isles' chains one grotto and one guardian each, the swamps one guardian, the deepest volcanic and swampy
  // shores none.
  const n = (t: IsleType, L: number, role: LairRole) => lairKindsFor(t, L, role).length;
  const fresh = (t: IsleType, L: number, role: LairRole) => lairKindsFor(t, L, role).filter((k) => NEW_LAIRS.includes(k)).length;
  for (const L of [1, 2]) assert.ok(n('swamp', L, 'shore') >= 3 && fresh('swamp', L, 'shore') >= 2, `swamp ⚓${L}`);
  for (const L of [5, 6, 7]) assert.ok(n('dead', L, 'shore') >= 3, `dead ⚓${L}`);
  for (const t of ['dead', 'graveyard'] as IsleType[]) for (let L = 6; L <= 10; L++) assert.ok(n(t, L, 'grotto') >= 2 && n(t, L, 'guardian') >= 2, `${t} ⚓${L}: two grottos and two guardians`);
  for (let L = 6; L <= 10; L++) assert.ok(n('swamp', L, 'guardian') >= 2, `swamp ⚓${L}: two guardians`);
  for (const t of ['volcanic', 'swamp', 'tropical'] as IsleType[]) for (const L of [9, 10]) assert.ok(n(t, L, 'shore') >= 1, `${t} ⚓${L}: a shore lair`);
  assert.ok(n('volcanic', 1, 'shore') >= 3, 'volcanic ⚓1');
});

// ------------------------------------------------------------------------------------------------ the shop's twelve

test('twelve more for the shop: the third tier opened, each body and craft no other kind of the shop has', () => {
  assert.equal(new Set(SHOP).size, 12);
  assert.deepEqual([3, 4, 5, 6, 7].map((t) => SHOP.filter((u) => UNITS[u].tier === t).length), [3, 2, 3, 1, 3]);
  assert.equal(premiumFrom(3), 2, 'the third tier from ⚓2');
  for (const u of SHOP) {
    assert.ok(PREMIUM_BEAST_IDS.includes(u) && isPremiumUnit(u) && UNITS[u].beast && premiumUnits().includes(u), `${u}: on the shelf`);
    assert.equal(ART.get(u)?.faction, 'premium', `${u}: in the shop's section of tools/art/creatures.py`);
    assert.equal(ART.get(u)?.tier, UNITS[u].tier, `${u}: the art's tier`);
    assert.ok(PREMIUM_PEOPLE[u] === 'sea' || PREMIUM_PEOPLE[u] === 'land', u);
    assert.equal(UNITS[u].premium!.n, UNITS[u].tier === 7 ? 1 : 2, `${u}: a pair, or one great beast`);
  }
  const look = (u: PremiumBeastId) => `${FIGURES[u]?.body}:${[...UNITS[u].specials].sort().join('+')}`;
  for (const u of SHOP) assert.deepEqual(PREMIUM_BEAST_IDS.filter((x) => look(x) === look(u)), [u], `${u}: ${look(u)}`);
});

// ------------------------------------------------------------------------------------------------ words and figures

test('the thirty-two in both languages, drawn by a painted kindred of their body till their own figures are cut', () => {
  for (const u of WILD) {
    assert.ok(ARMY_EN[`u.${u}` as keyof typeof ARMY_EN] && ru(ARMY_RU[`u.${u}` as keyof typeof ARMY_RU] ?? ''), `${u}: named`);
    assert.ok((ARMY_EN[`ud.${u}` as keyof typeof ARMY_EN] ?? '').length > 20 && ru(ARMY_RU[`ud.${u}` as keyof typeof ARMY_RU] ?? ''), `${u}: told`);
    assert.ok(ru(BEAST_PLURAL[u][1]), `${u}: the server's words`);
    assert.equal(BEASTS[u].art, `unit.${u}`);
  }
  for (const k of NEW_LAIRS) assert.ok(ru(LAIRS[k].name[1]) && ru(LAIRS[k].text[1]) && !BAD_WORDS.test(LAIRS[k].text[0]), k);
  for (const u of SHOP) {
    const n = PREMIUM_NAMES[u];
    assert.ok(n && ru(n[1]) && n[2].length > 20 && ru(n[3]) && !BAD_WORDS.test(n[2]), `${u}: names`);
    assert.ok(UNITS[u].premium!.note[0].length > 20 && ru(UNITS[u].premium!.note[1]), `${u}: the card's line`);
  }
  for (const u of OWN) {
    const n = SHIP_BEAST_DEFS[u].names;
    assert.ok(ru(n[1]) && n[2].length > 20 && ru(n[3]) && !BAD_WORDS.test(n[2]), `${u}: names`);
  }
  // The islands' and the shop's kinds stand in as a painted kind of their body (the hulls' own as fleet80 holds).
  for (const u of [...WILD, ...SHOP] as UnitId[]) {
    const f = FIGURES[u];
    assert.ok(f && f.size >= 0.8 && f.size <= 1.85, `${u}: a figure's height`);
    if (painted(u)) continue;
    const stand = figureStandIn(u, painted);
    assert.ok(stand && painted(stand) && manifest.assets[`unit.${stand}_atk`], `${u}: stands in as ${stand}`);
    assert.equal(FIGURES[stand as UnitId]?.body ?? f!.body, f!.body, `${u}: a figure of its body`);
  }
});

test('painted four kinds to a sheet, a row of four poses each, in the painter\'s queue — no blood, bones, skulls nor gore in their words, no game named', () => {
  const quads = Object.entries(sheets).filter(([k]) => /^anim5_\d+$/.test(k));
  assert.equal(quads.length, 8);
  const on: string[] = [];
  for (const [key, sh] of quads) {
    assert.deepEqual(sh.grid, [4, 4], key);
    assert.equal(sh.split, 'blobs', key);
    assert.equal(sh.creatures?.length, 4, key);
    assert.deepEqual(sh.ids, sh.creatures!.flatMap((c) => ['', '_b', '_atk', '_hit'].map((f) => `unit.${c.id}${f}`)), key);
    for (const c of sh.creatures!) {
      on.push(c.id);
      const body = FIGURES[c.id as UnitId]?.body ?? (isShipBeast(c.id) ? SHIP_BEAST_DEFS[c.id].body : undefined);
      assert.equal(c.body, body, `${c.id}: painted in the body it stands in as`);
      assert.equal(c.tier, UNITS[c.id as UnitId].tier, c.id);
      assert.equal(c.faction, ART.get(c.id)?.faction, c.id);
      if (!painted(c.id)) assert.ok(sh.painting, `${key}: in the painter's queue till it is cut`);
    }
    assert.match(sh.prompt, /magenta/);
    assert.ok(!GAMES.test(sh.prompt), `${key}: no game named`);
  }
  assert.deepEqual(on.sort(), [...ALL].sort(), 'each of the thirty-two on one sheet');
  for (const k of ALL) {
    const line = ART.get(k)!.line;
    assert.ok(!BAD_WORDS.test(line) && !GAMES.test(line), `${k}: ${line}`);
  }
});

// ------------------------------------------------------------------------------------------------ the field

const side = (army: ArmyStack[]): TacSideInput => ({
  name: 'x', ship: 'y', captain: null, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0,
  blooded: 0, castle: false, struck: false, human: false,
} as TacSideInput);

test('their crafts are the battle\'s own: the war parrots and the cormorants bring luck, and every one of the thirty-two takes the field', () => {
  for (const u of ['war_parrot', 'cormorant'] as UnitId[]) {
    const bt = newBattle(side([{ u, n: 2 }, { u: 'sailor', n: 20 }]), side([{ u: 'sailor', n: 20 }]), 5, 0, new Rng(5));
    assert.equal(luckOf(bt, 0), luckOf(bt, 1) + 1, `${u}: luck`);
  }
  for (const u of ALL) {
    const b = newBattle(side([{ u, n: 3 }]), side([{ u: 'sailor', n: 20 }]), 9, 0, new Rng(9));
    assert.ok(b.stacks.some((s) => s.unit === u && s.count === 3), u);
  }
});
