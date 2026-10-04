// The hundred creatures (owner, 2026-10-03: «нужно еще премиум существ за премиум валюту много … около 100 существ
// разной фракции»; docs/18 VII): the premium shop's twenty kinds — real battle units, each with its craft, priced by
// its might, sold in the shop's Creatures tab from the ship level of their tier and handed out by nothing at sea, never
// slipping away, never sold back nor traded; the factions' twenty-one new kinds, each carried by its own faction's
// ships where they carry men, the elites worth no more than the places they take; their numbers against the tiers;
// their names in both languages, their figures' heights and the painted kinds that stand in for them; and the seven
// new crafts fought out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, armyForLevel, armyWeight, armyPower, isPremiumUnit } from '../shared/src/data/army.ts';
import type { ArmyMix, ArmyStack, UnitId, UnitSpecial } from '../shared/src/data/army.ts';
import { isBossUnit } from '../shared/src/data/bossunits.ts';
import { REF_MEN } from '../shared/src/data/advmap.ts';
import { DRIFTS, SLIP_AFTER, driftKindsFor, tamerStock } from '../shared/src/data/drifts.ts';
import { FACTION_ELITES, FACTION_KINDS, FACTION_NAMES, rosterArmy, rosterKind } from '../shared/src/data/factionunits.ts';
import type { FactionKindId, Roster } from '../shared/src/data/factionunits.ts';
import { LAIRS, lairKindsFor } from '../shared/src/data/lairs.ts';
import type { LairRole } from '../shared/src/data/lairs.ts';
import { premiumLeaks, premiumUnits } from '../shared/src/data/premium.ts';
import { PREMIUM_BEASTS, PREMIUM_BEAST_IDS, PREMIUM_NAMES, premiumFrom } from '../shared/src/data/premiumbeasts.ts';
import type { PremiumBeastId } from '../shared/src/data/premiumbeasts.ts';
import { ROAMS, roamKindsFor } from '../shared/src/data/roamers.ts';
import { FIGURES, figureStandIn } from '../shared/src/data/unitart.ts';
import { Rng } from '../shared/src/rng.ts';
import { ISLE_TYPES } from '../shared/src/world/archipelago.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { clearOutposts } from '../server/src/game/estate.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { act, aiAct, luckOf, newBattle } from '../server/src/game/tacbattle.ts';
import { TAC_W, hexDist, hexIndex } from '../shared/src/data/tactical.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { captureOffer, feedCreatures, stepTame, tameOf, tameView, toPen } from '../server/src/game/tame.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../client/src/lang/ui/army.ts';
import { EN as PM_EN, RU as PM_RU } from '../client/src/lang/ui/premium.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, onHull } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const painted = (kind: string) => !!manifest.assets[`unit.${kind}`];
/** tools/art/creatures.py's entries: id → faction and tier (read, not run). */
const ART = new Map([...readFileSync(new URL('../tools/art/creatures.py', import.meta.url), 'utf8').matchAll(/^c\('([a-z_]+)', '([a-z_]+)', (\d+),/gm)].map((m) => [m[1], { faction: m[2], tier: Number(m[3]) }]));

/** The factions' new kinds (three a roster), and the two painted figures the game had not used. */
const NEW_KINDS: FactionKindId[] = [
  'crown_surgeon', 'crown_midshipman', 'crown_provost',
  'brine_sister', 'choir_toller', 'lamprey_zealot',
  'harpoon_commander', 'try_pot', 'harpoon_preceptor',
  'fog_cutpurse', 'fog_cardsharp', 'fog_viper',
  'company_cannoneer', 'petardier', 'ledger_factor',
  'island_elder', 'shark_dancer', 'reef_raider',
  'dutchman_bulwark', 'ghost_marksman', 'ghost_cutthroat',
];
const FOUND: FactionKindId[] = ['abyss_ascendant', 'volcano_guardian'];

/** The mixes each roster's ships sail with (server/src/game/army.ts npcMixOf; the spawners of npc.ts): the Crown's
 *  patrols and fishers, the Choir's and the Dutchman's deep, the Harpoon's patrols and hunters, the Brokers'
 *  smugglers, the Ledger's merchants and patrols, the Free Harbors' merchants, fishers and escorts. */
const MIXES: Record<Roster, ArmyMix[]> = { crown: ['navy', 'merchant'], choir: ['deep'], harpoon: ['navy'], brokers: ['merchant'], league: ['merchant', 'navy'], free: ['merchant', 'navy'], dutchman: ['deep'] };

const ru = (s: string) => /[а-яё]/i.test(s);
const w1 = (u: UnitId) => armyWeight([{ u, n: 1 }]);
const p1 = (u: UnitId) => armyPower([{ u, n: 1 }]);

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name: string, level: number, cls = 'brig'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, Math.round(s.ship!.stats.crewMax * 0.6), s.ship!.armySlots - 2, 'player'));
  s.ship!.morale = 80;
  return s;
}

const conn = (s: PlayerSession) => (s as unknown as { conn: { last: (t: string) => Record<string, unknown> | undefined; push: (m: unknown) => void } }).conn;

// ------------------------------------------------------------------------------------------------ the shop's twenty

test('the shop\'s twenty: battle units of the art queue\'s premium faction, each with its offer and a craft of its own', () => {
  assert.equal(PREMIUM_BEAST_IDS.length, 20 + 12 + 12, 'the twenty, the second dozen and the third of 2026-10-04 (tests/creatures24, tests/batch3)');
  const art = [...ART].filter(([, a]) => a.faction === 'premium').map(([id]) => id).sort();
  assert.deepEqual([...PREMIUM_BEAST_IDS].sort(), art, 'the shop\'s kinds of tools/art/creatures.py');
  const body = new Set<UnitSpecial>(['flying', 'diving', 'shooter']);
  for (const id of PREMIUM_BEAST_IDS) {
    const d = UNITS[id];
    assert.ok(d && d.beast && isPremiumUnit(id), id);
    assert.equal(d.tier, ART.get(id)!.tier, `${id}: the art's tier`);
    assert.ok(d.tier >= 3 && d.tier <= 7 && d.cost > 0 && d.art === `unit.${id}`, id); // the third tier opened by the third dozen
    const o = d.premium!;
    assert.ok(o.price > 0 && o.n >= 1 && Number.isInteger(o.price) && Number.isInteger(o.n), id);
    assert.ok(o.note[0].length > 20 && ru(o.note[1]), `${id}: the card's line in both languages`);
    assert.ok(d.specials.some((x) => !body.has(x)), `${id}: a craft beyond its body`);
  }
  // A single great beast of the seventh tier, a pair of the others.
  assert.ok(PREMIUM_BEAST_IDS.every((id) => PREMIUM_BEASTS[id].premium!.n === (PREMIUM_BEASTS[id].tier === 7 ? 1 : 2)));
  for (const id of PREMIUM_BEAST_IDS) assert.ok(premiumUnits().includes(id), id);
});

test('their numbers by tier: above the best of the sea\'s own, below the next tier\'s; priced by might, dearer a point the higher the tier', () => {
  const own = (t: number) => (Object.keys(UNITS) as UnitId[]).filter((u) => UNITS[u].tier === t && !UNITS[u].premium && !UNITS[u].legend && !UNITS[u].roster && !isBossUnit(u)); // the great ones ashore are never hired
  const best = (t: number) => Math.max(...own(t).map(w1));
  const legends = Math.min(...(Object.keys(UNITS) as UnitId[]).filter((u) => UNITS[u].legend).map(w1));
  for (const id of PREMIUM_BEAST_IDS) {
    const t = UNITS[id].tier, w = w1(id);
    assert.ok(w > best(t) && w <= best(t) * 1.5, `${id}: ${w.toFixed(1)} a head against the best of tier ${t}, ${best(t).toFixed(1)}`);
    assert.ok(w < (t < 7 ? best(t + 1) : legends), `${id}: below the next tier`);
  }
  // Every purchase of a tier costs more than every purchase of the tier below; a point of might dearer the higher.
  const buy = (id: PremiumBeastId) => armyWeight([{ u: id, n: PREMIUM_BEASTS[id].premium!.n }]);
  const of = (t: number) => PREMIUM_BEAST_IDS.filter((id) => UNITS[id].tier === t);
  let rate = 0;
  for (const t of [3, 4, 5, 6, 7]) {
    if (t > 3) assert.ok(Math.min(...of(t).map((id) => UNITS[id].premium!.price)) > Math.max(...of(t - 1).map((id) => UNITS[id].premium!.price)), `tier ${t} dearer`);
    const r = of(t).reduce((a, id) => a + UNITS[id].premium!.price / buy(id), 0) / of(t).length;
    assert.ok(r > rate, `tier ${t}: ${r.toFixed(1)} doubloons a deckhand's worth`);
    rate = r;
  }
  // Worth the money, not an auto-win: a purchase is a tenth to three tenths of the army of the level it is first sold at.
  for (const id of PREMIUM_BEAST_IDS) {
    const L = premiumFrom(UNITS[id].tier);
    const share = buy(id) / armyWeight(armyForLevel(L, REF_MEN[L], 7, 'player'));
    assert.ok(share >= 0.1 && share <= 0.3, `${id}: ${(share * 100).toFixed(0)}% of a ⚓${L} army`);
  }
  assert.deepEqual([3, 4, 5, 6, 7].map(premiumFrom), [2, 3, 4, 5, 6]);
});

test('bought in the shop\'s Creatures tab from their tier\'s ship level — and nothing at sea hands one out', () => {
  assert.deepEqual(premiumLeaks(), []);
  const ids = new Set<string>(PREMIUM_BEAST_IDS);
  for (let w = 0; w < 40; w++) for (const L of [3, 6, 10]) assert.ok(!tamerStock(`port_${w % 9}`, L, w, true).some((x) => ids.has(x.u)), 'the tamers\' pens');
  for (const r of REGION_IDS) for (let L = 1; L <= 10; L++) {
    assert.ok(!driftKindsFor(L, r).some(([k]) => ids.has(DRIFTS[k].u)), 'the drifts');
    assert.ok(!roamKindsFor(L, r).some(([k]) => ids.has(ROAMS[k].u)), 'the roaming stacks');
  }
  for (const t of ISLE_TYPES) for (let L = 1; L <= 10; L++) for (const role of ['shore', 'grotto', 'guardian'] as LairRole[]) assert.ok(!lairKindsFor(t, L, role).some((k) => LAIRS[k].mix.some(([u]) => ids.has(u))), 'the lairs');
  const game = world();
  const s = captain(game, 'Shop Window', 1, 'sloop');
  // The beaten's offer passes a premium kind over.
  assert.equal(captureOffer(game, s, [{ u: 'sea_wolf', n: 30 }], 4, 'yes'), undefined, 'no capture');
  creditPremium(game, s.accountId, 3000, 'pay', 'p-100');
  conn(s).push({ t: 'premium', action: 'view' });
  const v = conn(s).last('premium')!.view as { units: { id: UnitId; price: number; n: number; note: [string, string]; lv: number; why: string | null }[] };
  for (const id of PREMIUM_BEAST_IDS) {
    const c = v.units.find((x) => x.id === id)!;
    assert.ok(c, `${id} on the shelf`);
    assert.deepEqual([c.price, c.n, c.note, c.lv], [UNITS[id].premium!.price, UNITS[id].premium!.n, UNITS[id].premium!.note, premiumFrom(UNITS[id].tier)]);
    assert.equal(c.why, 'tier', `${id}: not for a ⚓1 sloop`);
  }
  conn(s).push({ t: 'premium', action: 'buy_unit', id: 'golden_crab' });
  assert.match(String(conn(s).last('toast')!.msg), /Creatures of tier 4 serve a ship of level 3 and up/);
  assert.equal(game.db.doubloons(s.accountId), 3000, 'nothing charged');
  // On a ⚓6 brig: the great beasts are hers.
  onHull(game, s.ship!, 'brig', 6);
  conn(s).push({ t: 'premium', action: 'view' });
  const w = conn(s).last('premium')!.view as typeof v;
  assert.ok(PREMIUM_BEAST_IDS.every((id) => w.units.find((x) => x.id === id)!.why === null), 'every one of them on sale to her');
  conn(s).push({ t: 'premium', action: 'buy_unit', id: 'sea_dragon' });
  conn(s).push({ t: 'premium', action: 'buy_unit', id: 'sea_dragon' });
  assert.equal(s.ship!.army.find((x) => x.u === 'sea_dragon')?.n, 2, 'a second purchase joins the first');
  assert.equal(game.db.doubloons(s.accountId), 3000 - 2 * UNITS.sea_dragon.premium!.price);
  conn(s).push({ t: 'premium', action: 'buy_unit', id: 'golden_crab' });
  assert.equal(s.ship!.army.find((x) => x.u === 'golden_crab')?.n, 2);
});

test('the shop\'s creatures stay hers: they never slip away, no tamer buys them back, they do not change hands', () => {
  const game = world();
  const s = captain(game, 'Keeper', 6);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  runAdmin(game, s, '/army sea_wolf 6');
  runAdmin(game, s, '/creature seal 8');
  assert.equal(ship.army.find((x) => x.u === 'sea_wolf')?.n, 6);
  // Starving and unhappy: the seals slip over the side, the wolves stay.
  delete ship.cargo.fish;
  delete ship.cargo.salted_fish;
  delete ship.cargo.smoked_fish;
  delete ship.cargo.prime_fish;
  feedCreatures(game, ship, SLIP_AFTER + 10);
  assert.ok(tameOf(s.profile!).k.sea_wolf!.h >= SLIP_AFTER, 'they are kept and go hungry as any creature');
  ship.morale = 10;
  const seals = ship.army.find((x) => x.u === 'seal')!.n;
  for (let k = 0; k < 60; k++) {
    tameOf(s.profile!).next = 0;
    stepTame(game);
  }
  assert.ok((ship.army.find((x) => x.u === 'seal')?.n ?? 0) < seals, 'the tamed slip away');
  assert.equal(ship.army.find((x) => x.u === 'sea_wolf')?.n, 6, 'the bought stay');
  // The pen takes them as any creature (she has no island here: refused for that, not for what they are).
  assert.notEqual(toPen(game, s, 'sea_wolf', 2), 'No such creatures aboard');
  // The tamer: they are not on her list, and she will not take them.
  ship.morale = 80;
  assert.match(runAdmin(game, s, '/tamer go') ?? '', /tamer/);
  assert.ok(!tameView(game, s).tamer!.buys.some((x) => x.u === 'sea_wolf'));
  conn(s).push({ t: 'drift', action: 'sell', u: 'sea_wolf', n: 6 });
  assert.match(String(conn(s).last('toast')!.msg), /tamer will not buy the shop’s creatures/);
  assert.equal(ship.army.find((x) => x.u === 'sea_wolf')?.n, 6);
  // The barter table.
  const b = captain(game, 'Other Trader', 6);
  b.ship!.state = { ...b.ship!.state, x: ship.state.x + 60, y: ship.state.y };
  b.ship!.docked = ship.docked;
  conn(s).push({ t: 'barter', action: 'propose', name: 'Other Trader' });
  conn(b).push({ t: 'barter', action: 'propose', name: 'Keeper' });
  conn(s).push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, beasts: [{ u: 'sea_wolf', n: 2 }] });
  assert.match(String(conn(s).last('toast')?.msg), /shop’s creatures do not change hands/);
});

// ------------------------------------------------------------------------------------------------ the factions' new kinds

test('twenty-one new kinds, three for each of the seven, each carried by its own faction\'s ships', () => {
  assert.equal(NEW_KINDS.length, 21);
  const by = new Map<Roster, number>();
  for (const k of NEW_KINDS) by.set(FACTION_KINDS[k].roster, (by.get(FACTION_KINDS[k].roster) ?? 0) + 1);
  assert.deepEqual([...by.values()], [3, 3, 3, 3, 3, 3, 3]);
  for (const k of [...NEW_KINDS, ...FOUND]) {
    const r = FACTION_KINDS[k].roster;
    assert.equal(ART.get(k)?.faction, r, `${k}: its figure in its faction's section of tools/art/creatures.py`);
    assert.equal(UNITS[k].roster, r);
    let carried = false;
    for (const mix of MIXES[r]) for (let L = 1; L <= 10 && !carried; L++) for (const [men, slots] of [[60, 5], [120, 6], [250, 7]]) if (rosterArmy(r, armyForLevel(L, men, slots, mix), L).some((x) => x.u === k)) carried = true;
    assert.ok(carried, `${k}: carried by the ${r}'s ships`);
  }
  // And so at sea: a Crown patrol of ⚓8, a ghost of ⚓9.
  const { game } = makeGame();
  const pat = game.spawnNpcShip('patrol', 'frigate', 'crown', 30000, 80000, 0);
  game.setNpcLevel(pat, 8);
  for (const k of ['crown_surgeon', 'crown_midshipman', 'crown_provost'] as UnitId[]) assert.ok(pat.army.some((x) => x.u === k), `${k} aboard: ${JSON.stringify(pat.army)}`);
  const ghost = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', 31000, 80000, 0);
  game.setNpcLevel(ghost, 9);
  for (const k of ['dutchman_bulwark', 'ghost_marksman', 'ghost_cutthroat'] as UnitId[]) assert.ok(ghost.army.some((x) => x.u === k), `${k} aboard: ${JSON.stringify(ghost.army)}`);
});

test('the gaps filled fight as their siblings do; the elites keep the place\'s health, defence and pace and are worth no more than it', () => {
  for (const k of [...NEW_KINDS, ...FOUND]) {
    const { roster, as } = FACTION_KINDS[k];
    const d = UNITS[k], t = UNITS[as];
    assert.equal(d.tier, t.tier, `${k}: the tier of its place`);
    assert.deepEqual([d.hp, d.def, d.speed, d.init, d.cost], [t.hp, t.def, t.speed, t.init, t.cost], `${k}: the place's health, defence, pace and worth`);
    const e = FACTION_ELITES[k];
    if (!e) {
      assert.deepEqual([d.atk, d.dmin, d.dmax, d.shots, d.specials], [t.atk, t.dmin, t.dmax, t.shots, t.specials], `${k}: the pirate kind's numbers`);
      assert.equal(rosterKind(roster, as), k);
      continue;
    }
    const wr = w1(k) / w1(as), pr = p1(k) / p1(as);
    assert.ok(wr >= 0.8 && wr <= 1.05 && pr <= 1.05, `${k}: ${wr.toFixed(2)} of the ${as}'s weight, ${pr.toFixed(2)} of its power`);
    assert.notDeepEqual(d.specials, t.specials, `${k}: a craft of its own`);
    assert.equal(rosterKind(roster, as, e.from - 1), rosterKind(roster, as), `${k}: not below ⚓${e.from}`);
    assert.equal(rosterKind(roster, as, e.from), k, `${k}: from ⚓${e.from}`);
  }
  // One elite to a place.
  const places = Object.keys(FACTION_ELITES).map((k) => `${FACTION_KINDS[k as FactionKindId].roster}:${FACTION_KINDS[k as FactionKindId].as}`);
  assert.equal(new Set(places).size, places.length);
});

// ------------------------------------------------------------------------------------------------ words and figures

test('every new kind: its names and line in both languages, a figure\'s height, a painted kind standing in till its own is cut', () => {
  const kinds: UnitId[] = [...NEW_KINDS, ...FOUND, ...PREMIUM_BEAST_IDS];
  for (const k of kinds) {
    const n = UNITS[k].roster ? FACTION_NAMES[k as FactionKindId] : PREMIUM_NAMES[k as PremiumBeastId];
    assert.ok(n && /[a-z]/i.test(n[0]) && ru(n[1]) && /[a-z]/i.test(n[2]) && ru(n[3]), `${k}: names`);
    const f = FIGURES[k]!;
    assert.ok(f && f.size >= 1 && f.size <= 1.85, `${k}: a figure's height`);
    if (painted(k)) continue;
    const stand = figureStandIn(k, painted);
    assert.ok(stand && painted(stand) && manifest.assets[`unit.${stand}_atk`], `${k}: stands in as ${stand}`);
    assert.equal(FIGURES[stand as UnitId]?.body ?? f.body, f.body, `${k}: a figure of its body`);
  }
  // The crafts and the shop's words in both languages.
  for (const x of ['mend', 'bind', 'chill', 'drain', 'breath', 'chain', 'fortune']) {
    for (const p of ['sp', 'spd']) assert.ok(ARMY_EN[`${p}.${x}` as keyof typeof ARMY_EN] && ru(ARMY_RU[`${p}.${x}` as keyof typeof ARMY_RU]), `${p}.${x}`);
  }
  assert.ok(PM_EN['why.tier'] && ru(PM_RU['why.tier']) && ru(PM_RU.ulv));
  const table = serverTable();
  const mine = extract('server/src/game').filter((x) => /shop’s creatures|win no ranks|serve a ship of level/.test(x));
  assert.ok(mine.length >= 4, `the new sentences found (${mine.length})`);
  for (const x of mine) assert.ok(table[x] !== undefined, `untranslated: ${x}`);
  setLang('ru');
  try {
    assert.match(serverText('2 sea dragons join your army for 980 doubloons.'), /морские драконы/);
    assert.match(serverText('Creatures of tier 7 serve a ship of level 6 and up.'), /уровня 7.*уровня 6/);
    assert.match(serverText('You let 3 cardsharps go.'), /шулеры/);
  } finally {
    setLang('en');
  }
});

// ------------------------------------------------------------------------------------------------ the crafts in battle

const side = (army: ArmyStack[]): TacSideInput => ({
  name: 'x', ship: 'y', captain: null, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0,
  blooded: 0, castle: false, struck: false, human: false,
} as TacSideInput);

/** Fights it out, every event counted as it happens (the log keeps the last forty); `each` looks at the battle after
 *  every turn. */
function fight(a: ArmyStack[], b: ArmyStack[], seeds: number, each?: (bt: TacBattle) => void): Map<string, number> {
  const seen = new Map<string, number>();
  for (let k = 0; k < seeds; k++) {
    const rng = new Rng(700 + k);
    const bt = newBattle(side(a), side(b), 31 + k, 0, rng);
    let last = 0;
    for (let i = 0; i < 4000 && !bt.over && bt.active !== null; i++) {
      aiAct(bt, 0, rng);
      each?.(bt);
      for (const e of bt.log) {
        if (e.i <= last) continue;
        last = e.i;
        const key = `${e.k}:${e.id ?? ''}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }
  return seen;
}

/** One of hers against two of the other side's in a row on the far deck — her, the struck, the one behind — and her
 *  turn: what her blow or her shot (from her own deck) lays on each. */
function staged(u: UnitId, how: 'attack' | 'shoot'): { struck: number; behind: number; ids: (string | undefined)[] } {
  const rng = new Rng(9);
  const bt = newBattle(side([{ u, n: 2 }]), side([{ u: 'sailor', n: 30 }, { u: 'marine', n: 20 }]), 77, 0, rng);
  const [a, t, o] = [bt.stacks.find((s) => s.unit === u)!, bt.stacks.find((s) => s.unit === 'sailor')!, bt.stacks.find((s) => s.unit === 'marine')!];
  const y = 4;
  for (const x of [TAC_W - 4, TAC_W - 3, TAC_W - 2, 1]) bt.cells[hexIndex(x, y)] = '.';
  a.hex = how === 'attack' ? hexIndex(TAC_W - 4, y) : hexIndex(1, y);
  t.hex = hexIndex(TAC_W - 3, y);
  o.hex = hexIndex(TAC_W - 2, y);
  assert.ok(hexDist(t.hex, o.hex) === 1 && hexDist(a.hex, o.hex) >= 2);
  bt.queue = bt.queue.filter((id) => id !== a.id);
  bt.active = a.id;
  const was = bt.events;
  const hp = (s: typeof a) => (s.count - 1) * s.hpMax + s.hpTop;
  const [t0, o0] = [hp(t), hp(o)];
  assert.equal(act(bt, 0, how === 'attack' ? { a: 'attack', target: t.id, from: a.hex } : { a: 'shoot', target: t.id }, 0, rng), null);
  return { struck: t0 - hp(t), behind: o0 - hp(o), ids: bt.log.filter((e) => e.i > was && e.s === a.id).map((e) => e.id) };
}

test('the seven crafts fought out: a healer mends, a binder holds, a chill slows, a drinker drinks, a breath and a chain spill, fortune lifts luck', () => {
  const foes: ArmyStack[] = [{ u: 'sailor', n: 40 }, { u: 'marine', n: 25 }, { u: 'sea_guard', n: 15 }, { u: 'musketeer', n: 12 }];
  assert.ok((fight([{ u: 'tidal_elemental', n: 2 }, { u: 'marine', n: 20 }, { u: 'sea_guard', n: 15 }], foes, 4).get('regen:mend') ?? 0) > 0, 'mended');
  assert.ok((fight([{ u: 'island_elder', n: 30 }, { u: 'marine', n: 20 }, { u: 'sea_guard', n: 15 }], foes, 4).get('regen:mend') ?? 0) > 0, 'an elder mends too');
  assert.ok((fight([{ u: 'abyss_knight', n: 2 }], foes, 4).get('regen:drain') ?? 0) > 0, 'drained');
  // A breath scalds the one behind the struck stack; a bolt leaps to the one beside it — half as hard.
  const br = staged('sea_dragon', 'attack');
  assert.ok(br.ids.includes('breath') && br.behind > 0 && br.behind < br.struck, `breath: ${JSON.stringify(br)}`);
  const ch = staged('thunderbird', 'shoot');
  assert.ok(ch.ids.includes('chain') && ch.behind > 0 && ch.behind < ch.struck, `chain: ${JSON.stringify(ch)}`);
  const plain = staged('storm_eagle', 'attack');
  assert.equal(plain.behind, 0, 'no craft, no spill');
  assert.ok((fight([{ u: 'coral_basilisk', n: 6 }, { u: 'siren_queen', n: 3 }], foes, 6).get('fear:still') ?? 0) > 0, 'a bound stack loses its turn');
  let chilled = 0;
  fight([{ u: 'frost_serpent', n: 3 }], foes, 3, (bt) => {
    if (bt.heroes[0].fx.some((f) => f.id === 'chill')) chilled++;
  });
  assert.ok(chilled > 0, 'a chill laid on her stacks');
  // Fortune: a point more luck while a luck-bringer stands.
  const bt = newBattle(side([{ u: 'golden_crab', n: 2 }, { u: 'sailor', n: 20 }]), side([{ u: 'sailor', n: 20 }]), 5, 0, new Rng(5));
  assert.equal(luckOf(bt, 0), luckOf(bt, 1) + 1);
  for (const s of bt.stacks) if (s.unit === 'golden_crab') s.count = 0;
  assert.equal(luckOf(bt, 0), luckOf(bt, 1), 'and none once it has fallen');
});
