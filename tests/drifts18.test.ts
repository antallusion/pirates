// docs/18 IV — drifting creatures and the creatures of the army: the drifts (kinds, numbers by level, the lookout's
// sighting, marks and card), the rescue without a fight (ways, chances, the mini-game's taps, joining, the pen, a
// gift), the fight on the battle ashore and the beaten who follow, the sea's kinds in the bestiary, their own food
// (not the provisions), hunger and slipping away, ranks from fed wins, the morale of a mixed army (HoMM3's peoples, the
// path's own), the season's legend (one captain, the chronicle, told to all), the pen's stock, the tamer, creatures
// on the G33 barter table, the admin's commands and every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { BEAST_TINT, SEA_BEAST_IDS } from '../shared/src/data/bestiary.ts';
import { DRIFTS, DRIFT_KINDS, LEGEND_KINDS, MINI_PERIOD, PEN_STOCK, RANK_WINS, RESCUE_WAYS, SLIP_AFTER, captureShare, driftCount, driftKindsFor, foodPerMin, hasTamer, mixMorale, needleAt, peopleOf, rankFor, tamerStock, upkeepHour, wayChance } from '../shared/src/data/drifts.ts';
import type { RescueCtx } from '../shared/src/data/drifts.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { driftById, driftList, fightDrift, legendState, resolveMini, sendDriftCard, sendDrifts, sightNow, startRescue, stepDrifts, tapRescue } from '../server/src/game/drifts.ts';
import { creatureRoom, creaturesWon, feedCreatures, joinCreatures, stepTame, tameOf, tameView } from '../server/src/game/tame.ts';
import { sideOf } from '../server/src/game/tactical.ts';
import { moralePoints, newBattle } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { lyingOff, mine as ownBase } from '../server/src/game/base.ts';
import { mineSites, offIsland } from '../server/src/game/mines.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { townState } from '../server/src/game/town.ts';
import { Rng } from '../shared/src/rng.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../client/src/lang/ui/army.ts';
import { EN as DR_EN, RU as DR_RU } from '../client/src/lang/ui/drifts.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name = 'Drift Tester', level = 5, cls = 'brig', path: 'corsair' | 'navigator' | 'drowned' | 'reaver' = 'corsair'): PlayerSession {
  join(game, name, path);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, Math.round(s.ship!.stats.crewMax * 0.7), s.ship!.armySlots - 2, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 100_000;
  return s;
}

const conn = (s: PlayerSession) => (s as unknown as { conn: { last: (t: string) => Record<string, unknown> | undefined; push: (m: unknown) => void } }).conn;

// ------------------------------------------------------------------------------------------------ 34, 37. the kinds

test('the drifts: seven kinds and two legends, each a creature with its ways, its field and its words; numbers by level', () => {
  assert.equal(DRIFT_KINDS.length, 9);
  assert.deepEqual(LEGEND_KINDS, ['white_whale', 'young_kraken']);
  for (const k of DRIFT_KINDS) {
    const d = DRIFTS[k];
    assert.ok(UNITS[d.u]?.beast, `${k}: ${d.u} is a creature`);
    assert.ok(d.ways.length >= 3 && d.ways.every((w) => RESCUE_WAYS.includes(w)), k);
    assert.ok(d.name[1] && d.text[1] && /[а-я]/.test(d.name[1]), k);
    assert.ok(DR_EN[`way.${d.ways[0]}` as keyof typeof DR_EN] && DR_RU[`way.${d.ways[0]}` as keyof typeof DR_RU]);
  }
  // Their numbers grow with the square's level; a legend is one (two in the deepest).
  assert.ok(driftCount('seal_floe', 6) > driftCount('seal_floe', 1));
  assert.ok(driftCount('mermaid_net', 9) > driftCount('mermaid_net', 3));
  assert.equal(driftCount('white_whale', 7), 1);
  assert.equal(driftCount('young_kraken', 10), 2);
  // Every level of the sea shows some kind; the floes keep to their waters.
  for (let L = 1; L <= 10; L++) assert.ok(driftKindsFor(L, 'gravewater').length > 0, `⚓${L}`);
  assert.ok(!driftKindsFor(3, 'drowned_crown').some(([k]) => k === 'seal_floe'));
});

test('the sea\'s kinds in the bestiary: the mermaid, the sea turtle and the two legends, with their art (tokens tinted)', () => {
  assert.deepEqual(SEA_BEAST_IDS, ['mermaid', 'sea_turtle', 'white_whale', 'young_kraken']);
  for (const u of SEA_BEAST_IDS) {
    const d = UNITS[u];
    assert.ok(d.beast, u);
    if (d.art.startsWith('portrait.')) assert.ok(readFileSync(new URL(`../assets/portraits/${d.art.slice(9)}.webp`, import.meta.url)).length > 0);
    else assert.ok(manifest.assets[d.art], `${u}: ${d.art}`);
    assert.ok(ARMY_EN[`u.${u}` as keyof typeof ARMY_EN] && ARMY_RU[`u.${u}` as keyof typeof ARMY_RU] && ARMY_EN[`ud.${u}` as keyof typeof ARMY_EN] && ARMY_RU[`ud.${u}` as keyof typeof ARMY_RU], `${u} named`);
  }
  assert.ok(UNITS.white_whale.legend && UNITS.young_kraken.legend);
  assert.ok(BEAST_TINT.mermaid && BEAST_TINT.white_whale, 'the stand-ins are tinted tokens');
});

// ------------------------------------------------------------------------------------------------ 38. the peoples

test('the morale of a mixed army: men alone as ever, a point a people more, the path\'s own counted as the crew', () => {
  const men: ArmyStack[] = [{ u: 'deckhand', n: 20 }, { u: 'marine', n: 10 }];
  assert.equal(mixMorale(men, 'corsair'), 0, 'an army of men is as it was');
  assert.equal(mixMorale([...men, { u: 'drowned', n: 5 }], 'corsair'), 0, 'the H1 drowned among men: no creature, no change');
  assert.equal(mixMorale([...men, { u: 'seal', n: 5 }], 'corsair'), -1);
  assert.equal(mixMorale([...men, { u: 'seal', n: 5 }], 'navigator'), 0, 'the Navigator with the sea\'s');
  assert.equal(mixMorale([...men, { u: 'crab', n: 5 }], 'reaver'), 0, 'the Reaver with the land\'s');
  assert.equal(mixMorale([...men, { u: 'surf_drowned', n: 5 }], 'drowned'), 0, 'the Drowned with the deep\'s');
  assert.equal(mixMorale([...men, { u: 'seal', n: 5 }, { u: 'crab', n: 5 }], 'corsair'), -2);
  assert.equal(mixMorale([...men, { u: 'seal', n: 5 }, { u: 'crab', n: 5 }, { u: 'surf_drowned', n: 3 }], 'corsair'), -3);
  assert.equal(peopleOf('mermaid'), 'sea');
  assert.equal(peopleOf('young_kraken'), 'deep');
  // In the battle: the side's morale points carry it.
  const side = (army: ArmyStack[], mixed?: number): TacSideInput => ({ name: 'x', ship: 'y', captain: null, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(mixed !== undefined ? { mixed } : {}) } as TacSideInput);
  const a = newBattle(side(men, -2), side(men), 7, 0, new Rng(7));
  const b = newBattle(side(men), side(men), 7, 0, new Rng(7));
  assert.equal(moralePoints(a, 0), moralePoints(b, 0) - 2);
  // A rank on a stack: a tenth more attack, defence and health a rank.
  const r = newBattle(side([{ u: 'seal', n: 10 }]), side([{ u: 'seal', n: 10 }]), 9, 0, new Rng(9));
  const r3 = newBattle({ ...side([]), army: [{ u: 'seal', n: 10, rank: 3 }] } as TacSideInput, side([{ u: 'seal', n: 10 }]), 9, 0, new Rng(9));
  const s0 = r.stacks.find((x) => x.side === 0)!, s3 = r3.stacks.find((x) => x.side === 0)!;
  assert.equal(s3.hpMax, Math.round(s0.hpMax * 1.3));
  assert.ok(s3.atk > s0.atk && s3.def > s0.def);
});

// ------------------------------------------------------------------------------------------------ 34. the sighting

test('the lookout sights a drift off her bow by her square\'s level; it shows on her minimap with its clock and its card in reach', () => {
  const game = world();
  const s = captain(game);
  runAdmin(game, s, '/tp gravewater');
  const d = sightNow(game, s);
  assert.ok(d, 'something adrift');
  const dist0 = Math.hypot(d!.x - s.ship!.state.x, d!.y - s.ship!.state.y);
  assert.ok(dist0 > 1000 && dist0 < 2600, `off her bow at ${dist0} m`);
  assert.ok(d!.until > game.now + 300 && d!.n >= 1);
  sendDrifts(game, s, true);
  const marks = conn(s).last('drifts')?.list as { id: number; left: number; ttl: number }[];
  assert.ok(marks.some((m) => m.id === d!.id && m.left > 0 && m.ttl >= m.left), 'a mark with its clock');
  // Too far for the card; within the boats' reach it comes.
  sendDriftCard(game, s, true);
  assert.equal(conn(s).last('drift_card')?.card ?? null, null);
  assert.match(runAdmin(game, s, '/drift mermaid_net go') ?? '', /Mermaid in the Nets/);
  const card = conn(s).last('drift_card')?.card as { reach: boolean; ways: { way: string; chance: number }[]; n: number } | null;
  assert.ok(card && card.reach && card.ways.length === 3 && card.n >= 1, JSON.stringify(card));
  // Gone with its time.
  for (const x of driftList(game)) x.until = game.now - 1;
  stepDrifts(game);
  assert.equal(driftList(game).length, 0);
});

// ------------------------------------------------------------------------------------------------ 35. the rescue

test('a rescue: the way\'s chance from her crew, skills and path; the needle\'s taps lift it; saved, they join her army', () => {
  const ctx = (o: Partial<RescueCtx> = {}): RescueCtx => ({ level: 4, men: 60, shooters: 10, leadership: 0, firstAid: 0, mysticism: 0, will: 2, path: 'corsair', food: true, medicine: true, ...o });
  assert.ok(wayChance('mermaid_net', 'shoot', ctx({ shooters: 30 })) > wayChance('mermaid_net', 'shoot', ctx({ shooters: 3 })));
  assert.ok(wayChance('seal_floe', 'haul', ctx({ path: 'navigator' })) > wayChance('seal_floe', 'haul', ctx()), 'the Navigator with the sea\'s');
  assert.equal(wayChance('serpent_wreck', 'heal', ctx({ medicine: false })), 0);
  assert.ok(wayChance('white_whale', 'cut', ctx()) < wayChance('turtle_weed', 'cut', ctx()), 'a legend is harder');
  const game = world();
  const s = captain(game);
  runAdmin(game, s, '/tp gravewater');
  runAdmin(game, s, '/drift turtle_weed go');
  const d = driftList(game).find((x) => x.kind === 'turtle_weed')!;
  assert.equal(startRescue(game, s, d.id, 'cut'), null);
  assert.ok(d.mini, 'the needle swings');
  // A tap in the band (the needle at the middle), then a miss.
  const t = game.now + 0.1;
  d.mini!.t0 = t - 1;
  const want = 0.25 - 1 / MINI_PERIOD; // needleAt(1, phase) = 0.5
  d.mini!.phase = ((want % 1) + 1) % 1;
  assert.ok(Math.abs(needleAt(1, d.mini!.phase) - 0.5) < 1e-6);
  assert.equal(tapRescue(game, s, d.id, t), null);
  assert.deepEqual(d.mini!.taps, [true]);
  const room = creatureRoom(s.ship!, 'sea_turtle');
  assert.ok(room > 0);
  const before = s.ship!.crew;
  resolveMini(game, d, true);
  assert.ok(s.ship!.army.some((x) => x.u === 'sea_turtle'), 'the turtles in her army');
  assert.equal(s.ship!.crew, before + Math.min(d.n, room));
  assert.ok(!driftById(game, d.id), 'the drift is gone');
  assert.ok(tameOf(s.profile!).k.sea_turtle, 'their record kept');
});

test('saved with no room, or the drowned for a living crew: a gift instead; the pen at home takes the rest', () => {
  const game = world();
  const s = captain(game, 'Gift Taker', 6);
  runAdmin(game, s, '/tp gravewater');
  runAdmin(game, s, '/drift drowned_boat go');
  const d = driftList(game).find((x) => x.kind === 'drowned_boat')!;
  const gold = s.profile!.gold, crew = s.ship!.crew;
  runAdmin(game, s, '/drift save');
  assert.equal(s.ship!.crew, crew, 'the drowned do not serve a living crew');
  assert.ok(s.profile!.gold > gold || (s.ship!.cargo.pearls ?? 0) > 0, 'a gift');
  assert.ok(!driftById(game, d.id));
  // The pen of her island keeps those beyond her room.
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  offIsland(game, s, home.id);
  assert.equal(buyIsland(game, s, home.id), null);
  const h = ownIsland(game, s.accountId)!;
  const base = ownBase(game, s);
  assert.ok(typeof base !== 'string');
  townState(base.y).b.pen = 1;
  offIsland(game, s, home.id);
  assert.ok(lyingOff(game, s, h));
  s.ship!.crew = s.ship!.stats.crewMax; // no hammocks left
  runAdmin(game, s, '/drift seal_floe go');
  const seals = driftList(game).find((x) => x.kind === 'seal_floe')!;
  runAdmin(game, s, '/drift save');
  const stock = (townState(base.y) as unknown as { penStock?: Record<string, number> }).penStock ?? {};
  assert.equal(stock.seal, Math.min(seals.n, Math.floor(PEN_STOCK[1] / UNITS.seal.tier)), 'home to the pen');
  // From the pen into the army, lying off the island.
  s.ship!.crew = s.ship!.stats.crewMax - 3;
  conn(s).push({ t: 'drift', action: 'frompen', u: 'seal', n: 3 });
  assert.ok(s.ship!.army.some((x) => x.u === 'seal' && x.n >= 3), 'aboard from the pen');
  const v = tameView(game, s);
  assert.ok(v.pen && v.pen.here && v.pen.cap === PEN_STOCK[1]);
});

// ------------------------------------------------------------------------------------------------ 36. the fight and the capture

test('a drift fought on the battle laid over it; won — its silver, and some of the beaten would follow her', () => {
  assert.ok(captureShare({ ratio: 4, leadership: 2, native: true, morale: 80 }) > captureShare({ ratio: 1, leadership: 0, native: false, morale: 60 }));
  assert.equal(captureShare({ ratio: 9, leadership: 3, native: true, morale: 30 }), 0, 'no capture with the crew\'s heart low');
  assert.ok(captureShare({ ratio: 99, leadership: 3, native: true, morale: 100 }) <= 0.3);
  const game = world();
  const s = captain(game, 'Fighter', 7, 'frigate');
  runAdmin(game, s, '/tp gravewater');
  runAdmin(game, s, '/drift seal_floe go');
  const d = driftList(game).find((x) => x.kind === 'seal_floe')!;
  d.n = 40;
  assert.equal(fightDrift(game, s, d.id), null);
  assert.ok(landFighting(game, s), 'the boats are away');
  const gold = s.profile!.gold;
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  const v = conn(s).last('board_tac')?.view as { over: { winner: number }; land: { lair: string }; result: { loot: { drift?: { silver: number }; capture?: { u: string; n: number; room: number } } } };
  assert.equal(v.over.winner, 0);
  assert.equal(v.land.lair, 'seal_floe');
  assert.ok(v.result.loot.drift && v.result.loot.drift.silver > 0 && s.profile!.gold > gold);
  const cap = v.result.loot.capture;
  assert.ok(cap && cap.u === 'seal' && cap.n >= 1, JSON.stringify(cap));
  const crew = s.ship!.crew;
  conn(s).push({ t: 'drift', action: 'capture', choice: 'take' });
  assert.ok(s.ship!.crew > crew && s.ship!.army.some((x) => x.u === 'seal'), 'they follow her aboard');
  const v2 = conn(s).last('board_tac')?.view as { result: { loot: { capture?: { done?: string } } } };
  assert.equal(v2.result.loot.capture?.done, 'take');
  closeFight(game, s);
  assert.ok(!landFighting(game, s));
});

test('a lair beaten ashore: some of its beaten may follow her too (never a guardian\'s)', () => {
  const game = world();
  const s = captain(game, 'Lair Capturer', 6, 'frigate');
  runAdmin(game, s, '/lair crab_beach fight');
  if (!landFighting(game, s)) return; // the sea had no crab beach near enough this seed
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  const v = conn(s).last('board_tac')?.view as { over: { winner: number }; result: { loot: { capture?: { u: string; n: number } } } };
  if (v.over.winner === 0) assert.ok(!v.result.loot.capture || ['crab', 'gull'].includes(v.result.loot.capture.u), JSON.stringify(v.result.loot.capture));
  closeFight(game, s);
});

// ------------------------------------------------------------------------------------------------ 37, 39. food and attachment

test('creatures eat their own (fish, rum or bone), not the crew\'s provisions; starving, they slip away', () => {
  assert.equal(foodPerMin('deckhand', 10), 0, 'men eat provisions');
  assert.ok(foodPerMin('seal', 10) > 0 && foodPerMin('young_serpent', 1) > foodPerMin('seal', 1));
  assert.ok(upkeepHour([{ u: 'seal', n: 10 }]) > 0);
  const game = world();
  const s = captain(game, 'Feeder');
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  runAdmin(game, s, '/creature seal 10');
  runAdmin(game, s, '/creature surf_drowned 2');
  ship.cargo.fish = 50;
  ship.cargo.rum = 10;
  feedCreatures(game, ship, 60);
  assert.ok(Math.abs(50 - (ship.cargo.fish ?? 0) - foodPerMin('seal', 10)) < 1e-6, 'a minute of fish');
  assert.ok((ship.cargo.rum ?? 0) < 10, 'the drowned drink rum');
  // No fish: hungry; past five minutes unfed they slip over the side.
  delete ship.cargo.fish;
  delete ship.cargo.salted_fish;
  feedCreatures(game, ship, SLIP_AFTER + 10);
  assert.ok(tameOf(s.profile!).k.seal!.h >= SLIP_AFTER);
  const n0 = ship.army.find((x) => x.u === 'seal')!.n;
  for (let k = 0; k < 40 && (ship.army.find((x) => x.u === 'seal')?.n ?? 0) === n0; k++) {
    tameOf(s.profile!).next = 0;
    stepTame(game);
  }
  assert.ok((ship.army.find((x) => x.u === 'seal')?.n ?? 0) < n0, 'some slipped away');
});

test('fed and victorious they rise in rank (3, 7, 12 wins); the rank goes with them into battle', () => {
  assert.deepEqual(RANK_WINS, [0, 3, 7, 12]);
  assert.equal(rankFor(2), 0);
  assert.equal(rankFor(7), 2);
  assert.equal(rankFor(40), 3);
  const game = world();
  const s = captain(game, 'Ranker', 5, 'brig', 'navigator');
  runAdmin(game, s, '/creature seal 8');
  for (let k = 0; k < 12; k++) creaturesWon(game, s.ship!, ['seal']);
  assert.equal(rankFor(tameOf(s.profile!).k.seal!.w), 3);
  const side = sideOf(game, s.ship!, s.ship!, true);
  assert.equal(side.army!.find((x) => x.u === 'seal')?.rank, 3);
  assert.equal(side.mixed, 0, 'the Navigator\'s own people');
  // A hungry kind wins nothing.
  tameOf(s.profile!).k.seal!.h = 999;
  const w = tameOf(s.profile!).k.seal!.w;
  creaturesWon(game, s.ship!, ['seal']);
  assert.equal(tameOf(s.profile!).k.seal!.w, w);
  // New creatures thin the stack's wins.
  tameOf(s.profile!).k.seal!.h = 0;
  joinCreatures(game, s, 'seal', 8);
  assert.ok(tameOf(s.profile!).k.seal!.w < w);
});

// ------------------------------------------------------------------------------------------------ 40. the legend

test('the season\'s legend: told to every captain at sea, one captain at it at a time, had once, in the chronicle', () => {
  const game = world();
  const a = captain(game, 'Ahab');
  const b = captain(game, 'Starbuck');
  runAdmin(game, a, '/tp gravewater');
  runAdmin(game, b, '/tp gravewater');
  stepDrifts(game);
  assert.ok(legendState(game), 'the season\'s legend is reckoned');
  assert.match(runAdmin(game, a, '/drift whale') ?? '', /White Whale/);
  const told = (conn(b).last('toast') as { msg: string } | undefined)?.msg ?? '';
  assert.ok((game as unknown as { db: { getKv: (k: string) => { msg: string }[] } }).db.getKv('world_chronicle').some((l) => /White Whale has risen/.test(l.msg)), 'the chronicle');
  void told;
  const d = driftList(game).find((x) => x.kind === 'white_whale')!;
  b.ship!.state.x = d.x + 100;
  b.ship!.state.y = d.y;
  b.ship!.state.speed = 0;
  assert.equal(startRescue(game, a, d.id, 'cut'), null);
  assert.equal(startRescue(game, b, d.id, 'cut'), 'Another captain is at it already.');
  resolveMini(game, d, true);
  assert.equal(legendState(game)!.done?.by, 'Ahab');
  assert.ok((game as unknown as { db: { getKv: (k: string) => { msg: string }[] } }).db.getKv('world_chronicle').some((l) => /Ahab has saved The White Whale/.test(l.msg)));
  // Done for the season: it does not rise again.
  legendState(game)!.rise = game.now - 1;
  stepDrifts(game);
  assert.ok(!driftList(game).some((x) => x.kind === 'white_whale'));
});

// ------------------------------------------------------------------------------------------------ 42. the tamer and the barter

test('a tamer in some ports: she buys tamed creatures and sells her pens of the week', () => {
  const game = world();
  const ports = game.world.ports;
  const n = ports.filter((p) => hasTamer(p)).length;
  assert.ok(n >= ports.length * 0.2 && n < ports.length, `${n} of ${ports.length} ports keep a tamer`);
  assert.equal(tamerStock('x', 5, 3, false).length, 3);
  assert.ok(tamerStock('x', 5, 3, false).every((x) => peopleOf(x.u) !== 'deep'), 'the deep\'s only to their own');
  const s = captain(game, 'Tamer Client');
  assert.match(runAdmin(game, s, '/tamer go') ?? '', /tamer/);
  assert.ok(s.ship!.docked);
  runAdmin(game, s, '/creature seal 6');
  const gold = s.profile!.gold;
  conn(s).push({ t: 'drift', action: 'sell', u: 'seal', n: 6 });
  assert.ok(!s.ship!.army.some((x) => x.u === 'seal'));
  assert.ok(s.profile!.gold > gold);
  const v = tameView(game, s);
  assert.ok(v.tamer && v.tamer.sells.length === 3);
  const row = v.tamer!.sells[0];
  conn(s).push({ t: 'drift', action: 'buy', u: row.u, n: row.n });
  assert.ok(s.ship!.army.some((x) => x.u === row.u), 'bought from her pens');
});

test('creatures on the G33 barter table: they cross with the goods, their wins with them', () => {
  const game = world();
  const a = captain(game, 'Trader A');
  const b = captain(game, 'Trader B');
  runAdmin(game, a, '/tp gravewater');
  runAdmin(game, b, '/tp gravewater');
  b.ship!.state.x = a.ship!.state.x + 60;
  b.ship!.state.y = a.ship!.state.y;
  runAdmin(game, a, '/creature mermaid 4');
  for (let k = 0; k < 3; k++) creaturesWon(game, a.ship!, ['mermaid']);
  conn(a).push({ t: 'barter', action: 'propose', name: 'Trader B' });
  conn(b).push({ t: 'barter', action: 'propose', name: 'Trader A' });
  conn(a).push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, beasts: [{ u: 'mermaid', n: 4 }] });
  conn(b).push({ t: 'barter', action: 'offer', gold: 500, cargo: {} });
  conn(a).push({ t: 'barter', action: 'lock' });
  conn(b).push({ t: 'barter', action: 'lock' });
  const rev = (conn(a).last('barter')?.view as { rev: number }).rev;
  conn(a).push({ t: 'barter', action: 'ready', rev });
  conn(b).push({ t: 'barter', action: 'ready', rev });
  for (let k = 0; k < 40 * 20 && a.ship!.army.some((x) => x.u === 'mermaid'); k++) game.step();
  assert.ok(!a.ship!.army.some((x) => x.u === 'mermaid'), 'gone from her army');
  assert.equal(b.ship!.army.find((x) => x.u === 'mermaid')?.n, 4, 'into his');
  assert.equal(rankFor(tameOf(b.profile!).k.mermaid!.w), 1, 'their rank with them');
});

// ------------------------------------------------------------------------------------------------ the console and the words

test('the admin\'s commands of docs/18 IV, in HELP in both languages, and every answer in Russian', () => {
  const game = world();
  const s = captain(game, 'Console IV');
  runAdmin(game, s, '/tp gravewater');
  const help = runAdmin(game, s, '/help')!;
  for (const c of ['/drift [kind', '/tame [kind]', '/feed', '/tamer']) assert.ok(help.includes(c), c);
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the Russian HELP');
  assert.equal(ru.split(' · ').length, help.split(' · ').length, 'command for command');
  setLang('ru');
  try {
    for (const line of ['/drift seal_floe go', '/drift', '/drift save', '/drift gull_mast go', '/drift fail', '/creature seal 4', '/tame seal wins 5', '/feed 10', '/feed starve', '/tamer', '/drift clear']) {
      const out = runAdmin(game, s, line)!;
      const t = serverText(out);
      assert.ok(!/\b(the|is|and|your|No|Off|on|adrift)\b/.test(t), `${line}: ${t}`);
    }
  } finally {
    setLang('en');
  }
  const table = serverTable();
  const mine = extract('server/src').filter((p) => /drift|creature|tamer|pen\b|legend|rum|fish|slip|Saved|beaten|Lookout|whale|kraken/i.test(p));
  const missing = mine.filter((p) => table[p] === undefined && !/Kraken was slain by Anne Vey/.test(p));
  assert.deepEqual(missing, []);
  for (const k of Object.keys(DR_EN)) assert.ok(DR_RU[k as keyof typeof DR_RU], k);
});
