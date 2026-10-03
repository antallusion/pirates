// The ten bosses of 2026-10-03 (owner: «еще больше всяких там боссов»): the six at sea (server/src/game/bosses10.ts)
// rise in their own seas on the calendar and in their windows, play their mechanics, can be beaten and pay out; the four
// great ones ashore (server/src/game/shorebosses.ts) come ashore on their kind of island, are landed against, play their
// moves between the battle's turns, can be beaten, pay once a rising and stand calibrated against the captains of their
// levels; every line of theirs has its Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES } from '../shared/src/data/bosses.ts';
import type { BossId } from '../shared/src/data/bosses.ts';
import { BOSS_MONSTERS, BOSS_STAND_IN } from '../shared/src/data/bossmonsters.ts';
import type { BossClassId } from '../shared/src/data/bossmonsters.ts';
import { BOSS_UNITS, BOSS_UNIT_IDS, BOSS_UNIT_NAMES, BOSS_UNIT_STAND_IN } from '../shared/src/data/bossunits.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { UNITS, armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { SHORE_BOSSES, SHORE_BOSS_IDS, SHORE_CAL, SHORE_LOSS, SHORE_MOVES, shoreArmy, shorePay } from '../shared/src/data/shorebosses.ts';
import type { ShoreBossId, ShoreMove } from '../shared/src/data/shorebosses.ts';
import { hexDist, hexNeighbors, TAC_BLOCKING } from '../shared/src/data/tactical.ts';
import { DAY_LENGTH_SEC, isNight } from '../shared/src/constants.ts';
import { dist } from '../shared/src/math.ts';
import { Rng } from '../shared/src/rng.ts';
import type { BossZone } from '../shared/src/protocol.ts';
import { isleLevel, isleType } from '../shared/src/world/archipelago.ts';
import { regionAt } from '../shared/src/world/worldgen.ts';
import { risingPoint, summon } from '../server/src/game/bosses.ts';
import type { Fight } from '../server/src/game/bosses.ts';
import { tenWhere, tenZones } from '../server/src/game/bosses10.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { landFighting, landTac, closeFight } from '../server/src/game/beastlairs.ts';
import { eventViews } from '../server/src/game/events.ts';
import { adminShoreBoss, direct, duelOf, riseShore, shoreCalendar, shoreRisings, simulateShore, startDuel, stepShoreBosses } from '../server/src/game/shorebosses.ts';
import { modsOf, newBattle, stackById, tacHp, tacPush } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { DATA_RU } from '../client/src/lang/data.ts';
import { EN as BOSS_EN, RU as BOSS_RU } from '../client/src/lang/ui/bosses.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';
import { refParty } from './balance/lairs.ts';
import { shoreFight, shoreLevels } from './balance/shore.ts';

const SEC = 20;
const TEN: BossId[] = ['old_moorings', 'old_tithe', 'fog_changeling', 'cinder_ray', 'drowned_prelate', 'rime_twins'];
const CYR = /[А-Яа-яЁё]/;

// ================================================================================================ the six at sea

function arena(kind: BossId, n = 2): { game: Game; f: Fight; body: ShipEntity; caps: { c: FakeConn; s: PlayerSession; ship: ShipEntity }[] } {
  const { game } = makeGame();
  const def = BOSSES[kind];
  const spot = risingPoint(game, def, def.regions)!;
  assert.ok(spot, `${kind}: open water in its seas`);
  const f = summon(game, kind, spot.x, spot.y);
  const body = game.ships.get(f.id)!;
  const caps = [];
  for (let i = 0; i < n; i++) {
    const name = `Hunter ${'ABCDEFGH'[i]}`;
    const c = join(game, name);
    const s = game.sessionByName(name)!;
    const ship = s.ship!;
    ship.docked = null;
    s.profile!.docked = null;
    s.profile!.level = 30;
    ship.level = 30;
    at(game, ship, spot.x + 400 + i * 60, spot.y);
    ship.protectedUntil = 0;
    ship.region = f.region;
    caps.push({ c, s, ship });
  }
  return { game, f, body, caps };
}

function at(game: Game, ship: ShipEntity, x: number, y: number): void {
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.sail = 0;
  game.grid.upsert(ship.id, x, y);
}

const zonesOf = (game: Game, f: Fight, body: ShipEntity, s: PlayerSession): BossZone['k'][] => {
  const out: BossZone['k'][] = [];
  tenZones(game, f, body, s, (k) => out.push(k));
  return out;
};

test('the six rise in their own seas on the calendar; the Drowned Prelate only by night', () => {
  for (const kind of TEN) {
    const { game } = makeGame();
    const def = BOSSES[kind];
    assert.equal(def.regions.length, 1, `${kind}: one sea of its own`);
    for (let i = 0; i < 4; i++) {
      const p = risingPoint(game, def, def.regions)!;
      assert.ok(p && def.regions.includes(regionAt(game.world, p.x, p.y)), `${kind} rises in ${def.regions[0]}`);
    }
    assert.ok(SHIP_CLASSES[def.classId]?.monster, `${kind}: a monster class`);
  }
  // Each sea that had none (the Black Coast, Gravewater) or one has a boss of its own now.
  const seas = new Set(TEN.flatMap((k) => BOSSES[k].regions));
  for (const r of ['black_coast', 'gravewater', 'whispering', 'ashen_isles', 'drowned_crown', 'leviathan_reach']) assert.ok(seas.has(r as never), r);
  // The calendar: the taverns hear of it half an hour ahead, and it rises at its hour — by night, the Prelate.
  const { game } = makeGame();
  let wall = 3_000_000_000_000;
  game.wallNow = () => wall;
  const c = join(game, 'Bell Watcher');
  game.sessionByName('Bell Watcher')!.ship!.region = 'drowned_crown';
  const sc = game.bosses.schedule(game);
  for (const id of Object.keys(sc.next) as BossId[]) sc.next[id] = wall + 1e12;
  // A day and the night after it (the world's clock only goes forward: its seconds are counted as it runs).
  let day = 0, night = 0;
  for (let t = 0; t < DAY_LENGTH_SEC; t += 30) if (!isNight(t)) day = t;
  for (let t = day; t < day + DAY_LENGTH_SEC; t += 30) if (isNight(t)) {
    night = t;
    break;
  }
  game.now = day;
  sc.next.drowned_prelate = wall + 10 * 60 * 1000;
  steps(game, SEC * 2);
  assert.ok(sc.pending.drowned_prelate, 'announced');
  assert.ok(c.all('toast').some((t) => /Tavern talk: The Drowned Prelate stirs/.test(t.msg)), 'the taverns of its sea hear of it');
  wall += 11 * 60 * 1000;
  game.now = day;
  steps(game, SEC * 2);
  assert.equal([...game.bosses.fights.values()].filter((x) => x.kind === 'drowned_prelate').length, 0, 'not by day');
  game.now = night;
  steps(game, SEC * 2);
  const f = [...game.bosses.fights.values()].find((x) => x.kind === 'drowned_prelate');
  assert.ok(f, 'it rises by night');
  assert.equal([...f!.parts.values()].filter((p) => p === 'spire').length, 3, 'three bell spires');
});

test('Old Moorings: buried it cannot be touched; it rears under the slowest ship; a miss leaves it sprawled; wounded, it coils round what it strikes', () => {
  const { game, f, body, caps } = arena('old_moorings', 2);
  const [A, B] = caps;
  const st = f.ten!;
  assert.ok(body.hasEffect('submerged'), 'in the silt');
  const hp = body.hull;
  applyDamage(game, body, { hull: 500 }, A.ship);
  assert.equal(body.hull, hp, 'nothing touches it buried');
  // The slowest is marked: B lies still, A has way on.
  at(game, B.ship, body.state.x + 300, body.state.y);
  at(game, A.ship, body.state.x - 300, body.state.y);
  A.ship.state.speed = 12;
  game.wallNow = () => Date.now();
  steps(game, SEC + 2);
  A.ship.state.speed = 12;
  assert.ok(st.strike, 'a strike coming');
  assert.equal(st.strike!.target, B.ship.id, 'on the slowest ship');
  assert.ok(zonesOf(game, f, body, A.s).includes('telegraph'), 'marked on the water');
  // B gets way on: the strike finds empty water and it lies sprawled, half again as open to shot.
  at(game, B.ship, st.strike!.x + 400, st.strike!.y);
  st.strike!.at = game.now;
  steps(game, SEC + 1);
  assert.ok(st.sprawl && !body.hasEffect('submerged'), 'sprawled on the surface');
  let before = body.hull;
  applyDamage(game, body, { hull: 100 }, A.ship);
  assert.ok(Math.abs(before - body.hull - 150) < 1e-6, `×1.5 sprawled (${before - body.hull})`);
  // Wounded: what it strikes it coils round, until the others hurt it enough.
  body.hull = body.stats.hullMax * 0.4;
  steps(game, SEC + 1);
  assert.equal(f.phase, 1, 'the Moorings');
  st.up = 0;
  st.sprawl = false;
  st.strike = { x: B.ship.state.x, y: B.ship.state.y, at: game.now, target: B.ship.id };
  steps(game, SEC + 1);
  assert.ok(st.hold?.ship === B.ship.id && B.ship.hasEffect('moored'), 'B in its coils');
  before = body.hull;
  applyDamage(game, body, { hull: body.stats.hullMax * 0.05 }, A.ship);
  steps(game, SEC + 1);
  assert.equal(st.hold, null, 'it lets go');
  assert.ok(!B.ship.hasEffect('moored'), 'B free');
});

test('Old Tithe: it hunts the fullest hold and heals on its tithe; empty holds are left alone; at half its strength it disgorges', () => {
  const { game, f, body, caps } = arena('old_tithe', 2);
  const [A, B] = caps;
  const st = f.ten!;
  A.ship.cargo = { spices: 40, rum: 30 };
  B.ship.cargo = {};
  steps(game, SEC + 1);
  assert.equal(st.prey, A.ship.id, 'the laden ship is its prey');
  // A at its jaws: the tithe taken, and it feeds on it.
  body.hull = body.stats.hullMax * 0.8;
  const v = { x: Math.sin(body.state.heading), y: -Math.cos(body.state.heading) };
  at(game, A.ship, body.state.x + v.x * body.stats.length * 0.45, body.state.y + v.y * body.stats.length * 0.45);
  f.ready.tithe_bite = 0;
  const hull = body.hull;
  game.bosses.second(game);
  assert.ok((A.ship.cargo.spices ?? 0) < 40 && (A.ship.cargo.rum ?? 0) < 30, `a tithe of each: ${JSON.stringify(A.ship.cargo)}`);
  assert.ok((st.gut.spices ?? 0) > 0, 'in its gut');
  assert.ok(body.hull > hull, 'it feeds on it');
  // At half its strength: the tithes disgorged for anyone to fish up.
  const crates = game.loot.size;
  body.hull = body.stats.hullMax * 0.45;
  game.bosses.second(game);
  assert.equal(f.phase, 1, 'the Disgorging');
  assert.ok(game.loot.size >= crates + 6, 'the sea strewn with cargo');
  assert.deepEqual(st.gut, {}, 'its gut empty');
});

test('The Fog Changeling: false shapes burst into ink, the true one shows only to those close in; wounded, it seizes a bow turned on it', () => {
  const { game, f, body, caps } = arena('fog_changeling', 2);
  const [A, B] = caps;
  const st = f.ten!;
  const phantoms = [...f.parts].filter(([, p]) => p === 'phantom').map(([id]) => game.ships.get(id)!);
  assert.equal(phantoms.length, 3, 'three false shapes');
  assert.ok(phantoms.every((p) => p.cls.id === body.cls.id && p.name === body.name), 'each the same as the true one');
  // A shot into a false shape: no harm, ink where it was, the shape gone a while.
  const p0 = phantoms[0];
  const hp = p0.hull;
  applyDamage(game, p0, { hull: 500 }, A.ship);
  assert.equal(p0.hull, hp);
  assert.ok(st.phantoms.get(p0.id)! > game.now && p0.hasEffect('submerged') && f.inks.length > 0, 'burst into ink');
  // A harpoon in a false shape goes through fog.
  const p1 = phantoms[1];
  B.ship.tether = { target: p1.id, until: game.now + 60, length: 300, strain: 0 };
  game.bosses.second(game);
  assert.ok(B.ship.tether === null && st.phantoms.get(p1.id)! > game.now, 'the harpoon finds fog');
  // Only close in does the true one show where it is.
  at(game, A.ship, body.state.x + 200, body.state.y);
  at(game, B.ship, body.state.x + 1600, body.state.y);
  assert.equal(tenWhere(game, f, body, A.s), null, 'A sees it');
  assert.ok(zonesOf(game, f, body, A.s).includes('wake'), 'its wake shown to A');
  const shown = tenWhere(game, f, body, B.s);
  assert.ok(shown && dist(shown.x, shown.y, body.state.x, body.state.y) > 50, 'B is shown the middle of the circle');
  assert.ok(!zonesOf(game, f, body, B.s).includes('wake'));
  // The true one takes its harm.
  const h0 = body.hull;
  applyDamage(game, body, { hull: 500 }, A.ship);
  assert.ok(body.hull < h0);
  // Wounded: the false shapes fall away and a bow turned on it is seized.
  body.hull = body.stats.hullMax * 0.45;
  at(game, A.ship, body.state.x, body.state.y + 500);
  A.ship.state.heading = 0; // her bow straight at it (north)
  game.bosses.second(game);
  assert.equal(f.phase, 1, 'the Colours');
  assert.ok([...st.phantoms.values()].every((t) => t === Infinity), 'its shapes gone for good');
  assert.ok(A.ship.hasEffect('dazzled'), 'A\'s helm seized');
  assert.ok(zonesOf(game, f, body, A.s).includes('gaze'));
});

test('The Cinder Ray: a gun fired in its ash lights her own powder; it glides down on a ship and lies grounded, open to shot', () => {
  const { game, f, body, caps } = arena('cinder_ray', 2);
  const [A, B] = caps;
  const st = f.ten!;
  game.bosses.second(game);
  st.ash = { x: A.ship.state.x, y: A.ship.state.y, r: 320, until: game.now + 12 };
  game.bosses.second(game); // her guns seen
  A.ship.reload.port = 12; // a broadside fired
  const hull = A.ship.hull;
  st.ash.until = game.now + 12;
  game.bosses.second(game);
  assert.ok(A.ship.hasEffect('fire') && A.ship.hull < hull, 'her own powder alight');
  // The glide comes down on B: struck and set alight; the ray lies grounded, half again and more open to shot.
  st.ash = null;
  st.glide = { x: B.ship.state.x, y: B.ship.state.y, at: game.now };
  const bh = B.ship.hull;
  game.bosses.second(game);
  assert.ok(B.ship.hull < bh && B.ship.hasEffect('fire'), 'B under it');
  assert.ok(st.grounded > game.now, 'grounded');
  const before = body.hull;
  applyDamage(game, body, { hull: 100 }, A.ship);
  assert.ok(Math.abs(before - body.hull - 160) < 1e-6, `×1.6 grounded (${before - body.hull})`);
  assert.ok(zonesOf(game, f, body, A.s).length >= 0);
});

test('The Drowned Prelate: shot glances off it while its bells toll; a ship held beside a spire silences it, and a silent spire shelters from the sermon', () => {
  const { game, f, body, caps } = arena('drowned_prelate', 2);
  const [A, B] = caps;
  const st = f.ten!;
  assert.equal(st.spires.size, 3);
  let before = body.hull;
  applyDamage(game, body, { hull: 400 }, A.ship);
  assert.ok(Math.abs(before - body.hull - 100) < 1e-6, `three bells: a quarter lands (${before - body.hull})`);
  const [sid] = [...st.spires.keys()];
  const spire = game.ships.get(sid)!;
  applyDamage(game, spire, { hull: 500 }, A.ship);
  assert.equal(spire.hull, spire.stats.hullMax, 'shot does not silence a bell');
  // A holds beside the spire: eight seconds and it falls silent.
  at(game, A.ship, spire.state.x + 40, spire.state.y);
  for (let i = 0; i < 9; i++) game.bosses.second(game);
  assert.equal(st.spires.get(sid)!.lit, false, 'silent');
  assert.ok((f.contrib.get(A.s.accountId)?.control ?? 0) >= 40, 'control for it');
  before = body.hull;
  applyDamage(game, body, { hull: 400 }, A.ship);
  assert.ok(Math.abs(before - body.hull - 200) < 1e-6, `two bells: half lands (${before - body.hull})`);
  // The sermon: A in the sanctuary is spared, B is not.
  at(game, A.ship, spire.state.x + 60, spire.state.y);
  at(game, B.ship, body.state.x + 300, body.state.y);
  A.ship.morale = 80;
  B.ship.morale = 80;
  f.ready.prelate_sermon = 0;
  game.bosses.second(game);
  assert.equal(A.ship.morale, 80, 'sheltered');
  assert.ok(B.ship.morale < 80, 'B\'s crew on its knees');
  // The last rite: the bells ring again.
  body.hull = body.stats.hullMax * 0.35;
  game.bosses.second(game);
  assert.equal(f.phase, 1);
  assert.ok([...st.spires.values()].every((x) => x.lit), 'every bell tolls again');
});

test('The Rime Twins: the one that falls is sung back while its twin stands strong; brought down together, they pay', () => {
  const { game, f, body, caps } = arena('rime_twins', 2);
  const [A] = caps;
  const st = f.ten!;
  const twin = game.ships.get([...f.parts].find(([, p]) => p === 'twin')![0])!;
  assert.equal(twin.cls.id, body.cls.id, 'two of one kind');
  // The twin falls while the body stands strong: it goes under and rises again at half its strength.
  applyDamage(game, twin, { hull: twin.stats.hullMax * 5 }, A.ship);
  assert.ok(twin.alive && twin.hasEffect('submerged') && st.fallen.has(twin.id), 'sung back');
  assert.ok(game.bosses.fights.has(f.id));
  game.now += 21;
  game.bosses.second(game);
  assert.ok(!st.fallen.has(twin.id) && Math.abs(twin.hull - twin.stats.hullMax * 0.5) < 1, 'risen at half');
  assert.equal(f.phase, 1, 'the Freeze');
  // Both low: the body falls with its twin under a fifth — both go down, the fight won.
  twin.hull = twin.stats.hullMax * 0.1;
  applyDamage(game, body, { hull: body.stats.hullMax * 5 }, A.ship);
  assert.ok(!game.bosses.fights.has(f.id), 'slain');
  assert.ok(A.s.profile!.trophies.includes('The Twin Tusks'), 'its trophy');
  assert.equal(A.s.profile!.bossKills.rime_twins, 1);
});

test('each of the six can be beaten and pays: its trophy, its count, the spoils on the water', () => {
  for (const kind of TEN.filter((k) => k !== 'rime_twins')) {
    const { game, f, body, caps } = arena(kind, 1);
    const [A] = caps;
    if (kind === 'old_moorings') body.effects = body.effects.filter((e) => e.id !== 'submerged');
    const loot = game.loot.size;
    applyDamage(game, body, { hull: body.stats.hullMax * 20 }, A.ship);
    assert.ok(!game.bosses.fights.has(f.id), `${kind} slain`);
    assert.ok(A.s.profile!.trophies.includes(BOSSES[kind].trophy), `${kind}: ${BOSSES[kind].trophy}`);
    assert.equal(A.s.profile!.bossKills[kind], 1);
    assert.ok(game.loot.size > loot, `${kind}: its spoils float where it died`);
    assert.ok(BOSSES[kind].rare.length >= 2 && BOSSES[kind].xp > 0);
  }
});

// ================================================================================================ the four ashore

const capSide = (army: ArmyStack[]): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ ...x, src: x.u })), officers: [], skill: 3,
  morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});
const beastSide = (army: ArmyStack[]): TacSideInput => ({ ...capSide(army), name: 'Great one', ship: 'Isle', captain: null, morale: 50, noBook: true });

function duel(kind: ShoreBossId, L: number, seed = 11): { bt: TacBattle; rng: Rng; boss: () => TacStack; next: () => void } {
  const rng = new Rng(seed);
  const bt = newBattle(capSide(refParty(L)), beastSide(shoreArmy(kind, L)), seed, 0, rng, { land: SHORE_BOSSES[kind].types[0] });
  const d = startDuel(bt, kind, L);
  direct(bt, rng);
  return { bt, rng, boss: () => stackById(bt, d.boss)!, next: () => {
    bt.round++;
    direct(bt, rng);
  } };
}

const free = (bt: TacBattle, i: number) => !TAC_BLOCKING.has(bt.cells[i]) && !bt.stacks.some((x) => x.count > 0 && x.hex === i);

test('the great ones come ashore on their kind of island, in their seas and levels; the Abbess only by night; on the chart while they stand', () => {
  const { game } = makeGame();
  let wall = 4_000_000_000_000;
  game.wallNow = () => wall;
  const c = join(game, 'Shore Watcher');
  const next = shoreCalendar(game);
  for (const id of SHORE_BOSS_IDS) next[id] = wall + 1e12;
  let day = 0, night = 0;
  for (let t = 0; t < DAY_LENGTH_SEC; t += 30) {
    if (isNight(t)) night = t;
    else day = t;
  }
  for (const id of ['mire_mother', 'cinder_salamander', 'walrus_tyrant'] as ShoreBossId[]) next[id] = wall - 1;
  next.drowned_abbess = wall - 1;
  game.now = day;
  stepShoreBosses(game);
  const up = shoreRisings(game);
  assert.deepEqual(up.map((r) => r.kind).sort(), ['cinder_salamander', 'mire_mother', 'walrus_tyrant'], 'the Abbess waits for the night');
  for (const r of up) {
    const def = SHORE_BOSSES[r.kind];
    const is = game.world.islands[r.island];
    assert.ok(def.types.includes(isleType(is)), `${r.kind}: on ${isleType(is)}`);
    assert.ok(def.regions.includes(is.region), `${r.kind}: in ${is.region}`);
    const L = isleLevel(game.world, is);
    assert.ok(L >= def.lv[0] && L <= def.lv[1] && r.level === L, `${r.kind}: ⚓${L}`);
    assert.ok(r.until > wall);
  }
  assert.ok(c.all('toast').some((t) => /has come ashore on/.test(t.msg)), 'the sea hears of it');
  assert.ok(game.rumors.some((r) => /has come ashore on/.test(r.text)), 'the taverns too');
  const evs = eventViews(game).filter((e) => e.kind === 'boss_ashore');
  assert.equal(evs.length, 3, 'each on the chart');
  game.now = night;
  stepShoreBosses(game);
  assert.ok(shoreRisings(game).some((r) => r.kind === 'drowned_abbess'), 'by night, the Abbess');
  // Its hours run out: back into the sea.
  wall += 4 * 3600 * 1000;
  stepShoreBosses(game);
  assert.equal(shoreRisings(game).length, 0, 'gone back into the sea');
  assert.equal(eventViews(game).filter((e) => e.kind === 'boss_ashore').length, 0);
});

test('landing against a great one: the land key, the battle ashore with its moves, the spoils and the trophy once a rising', () => {
  const { game } = makeGame();
  join(game, 'Shore Hunter');
  const s = game.sessionByName('Shore Hunter')!;
  onHull(game, s.ship!, 'galleon', 10);
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 90;
  s.profile!.level = 40;
  const conn = (s as unknown as { conn: FakeConn }).conn;
  assert.match(adminShoreBoss(game, s, ['walrus_tyrant', 'go']), /Off the shore where Walrus Tyrant stands/);
  steps(game, 25);
  assert.equal(s.landable?.action, 'lair', 'the land key goes for it');
  assert.equal(s.landable?.feature, 'Walrus Tyrant');
  const gold = s.profile!.gold;
  conn.push({ t: 'land' });
  assert.ok(landFighting(game, s), 'ashore');
  const tac = conn.last('board_tac')?.view;
  assert.equal(tac?.land?.lair, 'walrus_tyrant');
  assert.ok(tac?.stacks.some((x) => x.unit === 'walrus_tyrant' && x.side === 1), 'the great one on the field');
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  const v = conn.last('board_tac')?.view;
  assert.equal(v?.over?.winner, 0, 'beaten');
  const loot = v?.result?.loot;
  assert.ok(loot?.shore?.kind === 'walrus_tyrant' && loot.shore.trophy, 'its trophy, the first time');
  assert.ok((loot?.silver ?? 0) > 0 && s.profile!.gold > gold, 'its silver');
  assert.ok(s.profile!.trophies.includes('Tusk of the Walrus Tyrant'));
  assert.equal(s.profile!.bossKills['shore:walrus_tyrant'], 1);
  assert.ok(loot?.shore?.first, 'the first on the seas');
  assert.ok(conn.all('toast').some((t) => /FIRST ON THE SEAS: Walrus Tyrant/.test(t.msg)));
  // Once a rising: the land key is shut on it now.
  closeFight(game, s);
  steps(game, 25);
  assert.ok(s.landable?.blocked && /already/.test(s.landable.blocked), 'beaten already');
  conn.push({ t: 'land' });
  assert.ok(!landFighting(game, s), 'no second fight this rising');
  // The tester's console lands against any of them at once (the /?battle=<kind> link).
  for (const k of SHORE_BOSS_IDS) {
    if (landFighting(game, s)) closeFight(game, s);
    const why = adminShoreBoss(game, s, [k, 'fight']);
    assert.match(why, /^Ashore: /, `${k}: ${why}`);
    assert.equal(conn.last('board_tac')?.view?.land?.lair, k);
    landTac(game, s, { a: 'quick' });
    steps(game, 2);
    closeFight(game, s);
  }
});

test('the Mire Mother: her tongue drags in the stack she marked — one beside a rock holds fast; her brood hatches', () => {
  let x = duel('mire_mother', 7);
  const d = duelOf(x.bt)!;
  const marked = stackById(x.bt, d.marked!)!;
  assert.ok(marked && marked.side === 0 && modsOf(x.bt, 0, marked.id).taken === 0, 'her farthest stack marked');
  for (const j of hexNeighbors(marked.hex)) if (x.bt.cells[j] === 'R' || x.bt.cells[j] === 'P') x.bt.cells[j] = '.';
  x.next();
  assert.equal(hexDist(marked.hex, x.boss().hex), 1, 'dragged in beside her');
  assert.ok(modsOf(x.bt, 0, marked.id).still, 'held in the mire this round');
  assert.equal(d.moves.tongue, 1);
  // Beside a rock, the marked one holds fast.
  x = duel('mire_mother', 7, 23);
  const d2 = duelOf(x.bt)!;
  const m2 = stackById(x.bt, d2.marked!)!;
  const hex = m2.hex;
  const nb = hexNeighbors(hex).find((j) => free(x.bt, j))!;
  x.bt.cells[nb] = 'R';
  x.next();
  assert.equal(m2.hex, hex, 'held fast');
  assert.equal(d2.moves.hold, 1);
  // The brood: every third round.
  const before = x.bt.stacks.length;
  x.next();
  assert.ok(x.bt.stacks.length > before && x.bt.stacks[x.bt.stacks.length - 1].unit === 'giant_toad', 'a brood hatched');
});

test('the Cinder Salamander: she breathes on the ground she marked — off it, a stack is spared; wounded, her hide burns the striker', () => {
  const x = duel('cinder_salamander', 8);
  const d = duelOf(x.bt)!;
  const warn = [...(x.bt.warn ?? [])];
  assert.ok(warn.length >= 2, 'the ground warned');
  const on = x.bt.stacks.filter((s) => s.side === 0 && s.count > 0 && warn.includes(s.hex));
  assert.ok(on.length >= 2);
  const [stay, go] = on;
  const away = x.bt.cells.findIndex((_, i) => free(x.bt, i) && !warn.includes(i) && hexDist(i, go.hex) > 2);
  go.hex = away;
  const hs = tacHp(stay), hg = tacHp(go);
  x.next();
  assert.ok(warn.every((i) => x.bt.cells[i] === 'F' || TAC_BLOCKING.has(x.bt.cells[i])), 'the warned ground burns');
  assert.ok(tacHp(stay) < hs, 'the one that stayed is burnt');
  assert.equal(tacHp(go), hg, 'the one that stepped off is spared');
  assert.equal(d.moves.breath, 1);
  // Wounded: a blow struck on her comes back as fire.
  const b = x.boss();
  b.count = 1;
  b.hpTop = Math.round(b.hpMax * 0.3);
  direct(x.bt, x.rng);
  assert.equal(d.phase, 1);
  const a = x.bt.stacks.find((s) => s.side === 0 && s.count > 0)!;
  const ha = tacHp(a);
  tacPush(x.bt, { k: 'hit', side: 0, s: a.id, t: b.id, dmg: 200, kills: 0, hex: b.hex });
  direct(x.bt, x.rng);
  assert.ok(tacHp(a) <= ha - 40, `the striker burnt (${ha - tacHp(a)})`);
});

test('the Abbess of the Drowned Bell: her ringers\' prayer shields her until they fall; her toll stills the living on the marked ground and raises her drowned', () => {
  const x = duel('drowned_abbess', 8);
  const d = duelOf(x.bt)!;
  const b = x.boss();
  assert.ok(Math.abs(modsOf(x.bt, 1, b.id).taken + 0.65) < 1e-9, 'warded while a bell-ringer stands');
  for (const s of x.bt.stacks) if (s.side === 1 && s.unit === 'cultist') s.count = 0;
  direct(x.bt, x.rng);
  assert.equal(modsOf(x.bt, 1, b.id).taken, 0, 'the prayer broken');
  assert.equal(d.moves.ward, 1);
  // Round two: the ground within two hexes of her warned; round three, the toll.
  x.next();
  const warn = [...(x.bt.warn ?? [])];
  assert.ok(warn.length > 0 && warn.every((i) => hexDist(i, b.hex) <= 2), 'her ring warned');
  const living = x.bt.stacks.find((s) => s.side === 0 && s.count > 0 && !s.sp.includes('undead'))!;
  living.hex = warn.find((i) => free(x.bt, i))!;
  const drowned = x.bt.stacks.find((s) => s.side === 1 && s.unit === 'surf_drowned')!;
  drowned.count = Math.max(1, Math.floor(drowned.start / 2));
  const n = drowned.count;
  x.next();
  assert.ok(modsOf(x.bt, 0, living.id).still, 'stilled by the toll');
  assert.ok(drowned.count > n, 'her drowned rise');
  assert.equal(d.moves.toll, 1);
});

test('the Walrus Tyrant: he charges the stack he marked; boxed in by rocks and her own, he breaks on the wall', () => {
  let x = duel('walrus_tyrant', 7);
  let d = duelOf(x.bt)!;
  const t = stackById(x.bt, d.marked!)!;
  assert.ok(t && t.side === 0, 'a stack marked');
  const ht = tacHp(t);
  x.next();
  assert.equal(hexDist(x.boss().hex, t.hex), 1, 'he comes down beside it');
  assert.ok(tacHp(t) < ht, 'the charge lands');
  assert.equal(d.moves.charge, 1);
  // Boxed in: no room beside it — he breaks on the wall.
  x = duel('walrus_tyrant', 7, 31);
  d = duelOf(x.bt)!;
  const t2 = stackById(x.bt, d.marked!)!;
  for (const j of hexNeighbors(t2.hex)) if (free(x.bt, j)) x.bt.cells[j] = 'R';
  const hb = tacHp(x.boss());
  x.next();
  assert.equal(d.moves.broke, 1, 'broken on the wall');
  assert.ok(tacHp(x.boss()) < hb, 'it costs him');
  assert.ok(modsOf(x.bt, 1, x.boss().id).still, 'dazed');
});

test('each great one can be beaten, and stands calibrated against the captain of its level (who knows none of the counterplay)', () => {
  for (const kind of SHORE_BOSS_IDS) {
    const def = SHORE_BOSSES[kind];
    let won = 0;
    for (let i = 0; i < 4; i++) if (simulateShore(kind, def.lv[0], refParty(10), 500 + i).won) won++;
    assert.ok(won >= 3, `${kind}: a strong captain beats it (${won}/4)`);
    for (const L of shoreLevels(kind)) {
      assert.ok(SHORE_CAL[kind][L] > 0, `${kind} ⚓${L} calibrated`);
      const f = shoreFight(kind, L);
      assert.ok(Math.abs(f.loss - SHORE_LOSS) <= 0.15, `${kind} ⚓${L}: costs ${Math.round(f.loss * 100)}% (target ${SHORE_LOSS * 100}%)`);
      assert.ok(f.win >= 0.5, `${kind} ⚓${L}: wins ${f.win}`);
      assert.ok(f.rounds >= 3, `${kind} ⚓${L}: long enough for its moves (${f.rounds} rounds)`);
      const pay = shorePay(kind, L, def.types[0]);
      assert.ok(pay.silver > 0 && pay.xp > 0 && Object.keys(pay.res).length > 0, `${kind} ⚓${L} pays`);
    }
    // Never handed out: no lair, tamer, drift or shop carries one.
    assert.ok(UNITS[kind].beast && !UNITS[kind].premium && !UNITS[kind].legend);
  }
});

// ================================================================================================ the words and the art

test('every boss of the ten speaks Russian: names, legends, phases, trophies, moves, hints and every line of theirs', () => {
  const table = serverTable();
  for (const kind of TEN) {
    const def = BOSSES[kind];
    assert.ok(CYR.test(DATA_RU[`bosses.BOSSES.${kind}.name`] ?? ''), `${kind} name`);
    assert.ok(CYR.test(DATA_RU[`bosses.BOSSES.${kind}.lore`] ?? ''), `${kind} lore`);
    for (const ph of def.phases) assert.ok(CYR.test(table[ph] ?? '') && CYR.test(table[`${ph}!`] ?? ''), `${kind} phase ${ph}`);
    assert.ok(CYR.test(table[def.trophy] ?? ''), `${kind} trophy`);
  }
  for (const c of Object.keys(BOSS_MONSTERS) as BossClassId[]) {
    for (const k of ['name', 'role', 'passive.name', 'passive.description']) assert.ok(CYR.test(DATA_RU[`ships.SHIP_CLASSES.${c}.${k}`] ?? ''), `${c}.${k}`);
    assert.ok(SHIP_CLASSES[BOSS_STAND_IN[c].cls], `${c}: a stand-in`);
  }
  for (const kind of SHORE_BOSS_IDS) {
    const def = SHORE_BOSSES[kind];
    for (const tr of [def.name, def.legend, def.hint, def.trophy, ...def.phases]) assert.ok(tr[0] && CYR.test(tr[1]), `${kind}: ${tr[0]}`);
    assert.ok(CYR.test(table[def.name[0]] ?? '') && CYR.test(table[def.hint[0]] ?? '') && CYR.test(table[def.trophy[0]] ?? ''), `${kind}: the server's words of it`);
    assert.ok(CYR.test(BOSS_UNIT_NAMES[kind].name[1]) && CYR.test(BOSS_UNIT_NAMES[kind].note[1]));
  }
  for (const m of Object.keys(SHORE_MOVES) as ShoreMove[]) assert.ok(CYR.test(SHORE_MOVES[m][1]), m);
  assert.deepEqual(Object.keys(BOSS_RU).sort(), Object.keys(BOSS_EN).sort());
});

test('the art: each new monster and great one is asked of the painter, with a stand-in until it is painted', async () => {
  const { readFileSync } = await import('node:fs');
  const py = readFileSync(new URL('../tools/art/bosses.py', import.meta.url), 'utf8');
  for (const c of Object.keys(BOSS_MONSTERS)) {
    assert.ok(py.includes(`('${c}'`), `${c} is painted`);
    assert.equal(BOSS_MONSTERS[c as BossClassId].sprite, `monster.${c}`);
  }
  for (const u of BOSS_UNIT_IDS) {
    assert.ok(py.includes(`('${u}'`), `${u} is painted`);
    assert.ok(BOSS_UNIT_STAND_IN[u].u in UNITS && BOSS_UNITS[u].art.startsWith('unit.'), `${u}: a stand-in figure`);
  }
  assert.ok(/q_bosses\.json/.test(py) && /sheets\.json/.test(py));
});
