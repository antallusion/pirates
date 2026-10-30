// «Мощь» (owner, 2026-10-31: «рейтинг должен строиться на мощи: 1) армии 2) корабля 3) апгрейдов зданий» — «и вещей» —
// «выводи в рейтинг именно по этой мощи»): shared/src/data/power.ts — the four parts on one scale, the weights, an upgrade
// never lowering a part, a known captain's numbers; server/src/game/siterating.ts — «power» the first and default board,
// a captain's place there everywhere; server/src/game/power.ts — the Captain window's page; the inspect card.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POWER_PARTS, POWER_TOP, POWER_WEIGHTS, armyScore, gearScore, isleScore, powerOf, shipScore, totalOf } from '../shared/src/data/power.ts';
import type { PowerInput } from '../shared/src/data/power.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import type { Item } from '../shared/src/data/items.ts';
import type { ShipLoadout } from '../shared/src/sim/shipstats.ts';
import { BOARDS, DEFAULT_BOARD, SiteRating } from '../server/src/game/siterating.ts';
import type { RatingRow } from '../server/src/game/siterating.ts';
import { join, makeGame } from './helpers.ts';
import { inspectView } from '../server/src/game/friends.ts';

const ship = (classId: string, level: number, modules: Record<string, number> = {}, gear?: ShipLoadout['gear']): ShipLoadout =>
  ({ classId, name: 'Test', guns: { port: 'medium_12', starboard: 'medium_12' }, modules, level, ...(gear ? { gear } : {}) }) as ShipLoadout;
let uid = 1;
const item = (base: string, ilvl: number, rarity: 0 | 1 | 2 | 3 | 4, extra: Partial<Item> = {}): Item => ({ uid: uid++, base, ilvl, rarity, affixes: [], dur: 100, ...extra });

/** A known captain: a level-26 corsair on a ⚓6 frigate with an island of hall 3. */
const KNOWN: PowerInput = {
  captain: 'corsair',
  army: [{ u: 'sailor', n: 60 }, { u: 'marine', n: 30 }, { u: 'musketeer', n: 20 }, { u: 'gunner', n: 10 }] as ArmyStack[],
  loadout: ship('frigate', 7, { hull_plating: 2, sail_plan: 1, crew_quarters: 1 }, { sails: item('canvas_sails', 6, 2), plating: item('oak_plating', 6, 3) }),
  captainGear: [item('tricorne', 6, 2), item('admiral_hat', 5, 1, { temper: 2 })],
  isle: { town: { hall: 3, keep: 2, market: 1, dw1: 3, dw2: 2, dw3: 1, warehouse: 2, shipyard: 1 }, other: [{ id: 'p:lumber', level: 3 }, { id: 'p:quarry', level: 2 }, { id: 'tavern', level: 1 }] },
};

test('the weights sum to one; nothing is nought; the references are the top', () => {
  assert.equal(Math.round(POWER_PARTS.reduce((s, k) => s + POWER_WEIGHTS[k], 0) * 1000), 1000);
  assert.deepEqual(powerOf({ captain: 'corsair', army: [], loadout: null, captainGear: [], isle: null }), { total: 0, army: 0, ship: 0, isle: 0, gear: 0 });
  assert.equal(shipScore(ship('ship_of_the_line', 10, { hull_plating: 3, sail_plan: 3, rudder: 2, hold_expansion: 2, crew_quarters: 2 }), 'navigator') > 0, true);
  // the greatest island is exactly the top
  const full: Record<string, number> = { hall: 5, keep: 5, market: 5, guild: 5, dw1: 5, dw2: 5, dw3: 5, dw4: 5, dw5: 5, dw6: 5, dw7: 5, warehouse: 5, shipyard: 5, battery: 5, fort: 5, grail: 1, pen: 2 };
  assert.equal(isleScore({ town: full, other: [] }), POWER_TOP);
  assert.equal(isleScore({ town: full, other: [{ id: 'p:lumber', level: 5 }, { id: 'tavern', level: 5 }] }), POWER_TOP, 'capped at the top');
  assert.equal(totalOf({ army: POWER_TOP, ship: POWER_TOP, isle: POWER_TOP, gear: POWER_TOP }), POWER_TOP);
});

test('a known captain: her four parts and the total', () => {
  const p = powerOf(KNOWN);
  assert.deepEqual(p, { total: 1554, army: 961, ship: 3721, isle: 1084, gear: 352 });
  assert.equal(p.total, totalOf(p));
  assert.equal(p.total, Math.round(0.35 * 961 + 0.25 * 3721 + 0.2 * 1084 + 0.2 * 352));
});

test('an upgrade never lowers a part: men, tiers, the ship’s level and fittings, buildings, items, sets', () => {
  const up = (a: number, b: number, what: string) => assert.ok(b >= a, `${what}: ${a} → ${b}`);
  const upStrict = (a: number, b: number, what: string) => assert.ok(b > a, `${what}: ${a} → ${b}`);
  // the army: a man more, an upgraded kind, a higher tier
  upStrict(armyScore([{ u: 'deckhand', n: 50 }]), armyScore([{ u: 'deckhand', n: 51 }]), 'a man more');
  upStrict(armyScore([{ u: 'deckhand', n: 50 }]), armyScore([{ u: 'sailor', n: 50 }]), 'upgraded');
  upStrict(armyScore([{ u: 'marine', n: 10 }]), armyScore([{ u: 'guard', n: 10 }]), 'a higher tier');
  // the ship: every level of every hull on the ladder, every fitting a level
  for (const cls of ['sloop', 'schooner', 'brig', 'frigate', 'galleon', 'man_o_war', 'ship_of_the_line']) {
    for (let l = 1; l < 10; l++) up(shipScore(ship(cls, l), 'corsair'), shipScore(ship(cls, l + 1), 'corsair'), `${cls} ⚓${l}→${l + 1}`);
  }
  for (const m of ['hull_plating', 'sail_plan', 'rudder', 'hold_expansion', 'crew_quarters', 'bone_culverin', 'serpent_scale', 'gun_carriages', 'iron_masts']) {
    upStrict(shipScore(ship('frigate', 7), 'corsair'), shipScore(ship('frigate', 7, { [m]: 1 }), 'corsair'), `fitting ${m}`);
  }
  upStrict(shipScore(ship('frigate', 7, { hull_plating: 1 }), 'corsair'), shipScore(ship('frigate', 7, { hull_plating: 2 }), 'corsair'), 'a fitting a level up');
  upStrict(shipScore(ship('frigate', 7, {}), 'corsair'), shipScore({ ...ship('frigate', 7), guns: { port: 'heavy_18', starboard: 'heavy_18' } }, 'corsair'), 'heavier guns');
  upStrict(shipScore(ship('brig', 7), 'corsair'), shipScore(ship('frigate', 7), 'corsair'), 'a greater hull at the same ⚓');
  // her ship's gear is GEAR's, not SHIP's
  assert.equal(shipScore(ship('frigate', 7, {}, { plating: item('iron_belt', 10, 4) }), 'corsair'), shipScore(ship('frigate', 7), 'corsair'));
  // the island: every building a level
  const base = { hall: 2, keep: 1, dw1: 2, warehouse: 1 };
  for (const id of ['hall', 'keep', 'market', 'guild', 'dw1', 'dw4', 'dw7', 'warehouse', 'shipyard', 'battery', 'fort', 'grail', 'pen']) {
    upStrict(isleScore({ town: base, other: [] }), isleScore({ town: { ...base, [id]: ((base as Record<string, number>)[id] ?? 0) + 1 }, other: [] }), `building ${id}`);
  }
  upStrict(isleScore({ town: base, other: [] }), isleScore({ town: base, other: [{ id: 'p:mine', level: 1 }] }), 'a working');
  upStrict(isleScore({ town: base, other: [{ id: 'p:mine', level: 1 }] }), isleScore({ town: base, other: [{ id: 'p:mine', level: 2 }] }), 'a working a level up');
  // the gear: the level, the rarity, Excellent, tempering, a piece more, a set's bonus
  upStrict(gearScore([item('tricorne', 5, 2)]), gearScore([item('tricorne', 6, 2)]), 'ilvl');
  upStrict(gearScore([item('tricorne', 5, 2)]), gearScore([item('tricorne', 5, 3)]), 'rarity');
  upStrict(gearScore([item('tricorne', 5, 2)]), gearScore([item('tricorne', 5, 2, { excellent: true })]), 'Excellent');
  upStrict(gearScore([item('tricorne', 5, 2, { temper: 1 })]), gearScore([item('tricorne', 5, 2, { temper: 2 })]), 'tempered');
  const one = item('tricorne', 5, 3, { set: 'bounty_hunter' });
  const two = item('admiral_hat', 5, 3, { set: 'bounty_hunter' });
  assert.ok(gearScore([one, two]) > 2 * gearScore([one]), 'a set’s bonus in force counts on top of its pieces');
  // a ship's slot not yet opened by her level is not worn
  assert.equal(powerOf({ ...KNOWN, loadout: ship('sloop', 1, {}, { relic: item('canvas_sails', 10, 4) }) }).gear, gearScore(KNOWN.captainGear as Item[]));
});

type G = ReturnType<typeof makeGame>;
function cap(g: G, name: string, p: Record<string, unknown>): number {
  const id = g.db.createAccount(name, `h-${name}`);
  g.db.saveCaptain(id, { captain: 'corsair', level: 1, xp: 0, stats: { boarded: 0 }, ...p }, 0, 0, 0);
  return id;
}

test('the site: «power» is the first and the default board, by the total, each row with its parts; the place told everywhere', () => {
  assert.equal(BOARDS[0], 'power');
  assert.equal(DEFAULT_BOARD, 'power');
  for (const b of ['army', 'ship', 'isle', 'gear', 'level', 'pvp', 'guilds'] as const) assert.ok(BOARDS.includes(b), `${b} kept`);
  const g = makeGame();
  cap(g, 'High Level', { level: 50, army: [{ u: 'deckhand', n: 10 }] });
  cap(g, 'Big Army', { level: 20, army: [{ u: 'guard', n: 40 }, { u: 'gunner', n: 40 }], loadout: ship('brig', 6) });
  cap(g, 'Fine Ship', { level: 30, army: [{ u: 'marine', n: 20 }], loadout: ship('galleon', 9, { hull_plating: 3 }) });
  const r = new SiteRating(g.game);
  const rows = r.board('power').rows as RatingRow[];
  assert.deepEqual(rows.map((x) => x.rank), [1, 2, 3]);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].value >= rows[i].value, 'the mightiest first');
  for (const x of rows) {
    assert.ok(x.pw, 'the breakdown goes with the row');
    assert.equal(x.value, x.pw!.total);
  }
  assert.equal(rows[rows.length - 1].name, 'High Level', 'the level alone does not make might');
  const army = r.board('army').rows as RatingRow[];
  assert.equal(army[0].name, 'Big Army');
  assert.equal(army[0].value, army[0].pw!.army);
  const sh = r.board('ship').rows as RatingRow[];
  assert.deepEqual(sh.map((x) => x.name), ['Fine Ship', 'Big Army'], 'nobody without a ship on the ship board');
  assert.equal((r.board('isle').rows as RatingRow[]).length, 0, 'no island: not on the island board');
  // a captain found by name: her card is the power board's, her place there
  const f = r.find('fine ship')!;
  assert.equal(f.captain.rank, f.ranks.power);
  assert.equal(f.captain.value, f.captain.pw!.total);
  assert.equal(f.ranks.ship, 1);
  // the Captain window's places
  const acc = g.db.accountByName('Big Army')!.id;
  const pb = r.powerBoard(acc);
  assert.equal(pb.ranks.army, 1);
  assert.equal(pb.ranked, 3);
  assert.equal(pb.top.length, 3);
  assert.equal(pb.top[0].pw.total, rows[0].value);
});

test('in the game: the Captain window’s «Мощь» page and the inspect card carry her might and her place', () => {
  const g = makeGame();
  cap(g, 'Saved Strong', { level: 40, army: [{ u: 'guard', n: 60 }], loadout: ship('galleon', 9) });
  const conn = join(g.game, 'Live Gull');
  const r = new SiteRating(g.game);
  g.game.powerBoard = (acc) => r.powerBoard(acc);
  conn.push({ t: 'power', action: 'view' });
  const m = conn.last('power');
  assert.ok(m, 'the page answers');
  assert.ok(m.view.me.total > 0 && m.view.me.army > 0, 'her live army counts');
  assert.equal(m.view.ranks.power, 2);
  assert.equal(m.view.ranked, 2);
  assert.equal(m.view.top[0].name, 'Saved Strong');
  // the inspect card another captain opens
  join(g.game, 'Other Eye');
  const o = g.game.sessionByName('Other Eye')!;
  const v = inspectView(g.game, o, 'Live Gull');
  assert.ok(typeof v !== 'string', String(v));
  assert.equal(v.power?.total, m.view.me.total);
  assert.equal(v.power?.rank, 2);
});
