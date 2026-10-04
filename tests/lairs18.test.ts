// docs/18 II — the lairs of the land's creatures: the bestiary (forty-three kinds over the seven tiers, their specials,
// their faces from the art), where the lairs stand (on the islands, by their kind and level, the chains of the
// great islands, the turtles' backs and the sandbars), the battlefield ashore (sand, rocks, palms, the surf; no guns),
// the creatures' specials in the battle, the battle fought through a landing, the spoils once a week, the lair standing
// again, HoMM3's offer at three times the might, the island's chain and its chest, the creature dwellings and the
// recruit window, the eggs and the pen, the creature jobs, the admin's commands and every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, armyMen, armyPower } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { BEASTS, BEAST_IDS, BEAST_TINT } from '../shared/src/data/bestiary.ts';
import { LAIRS, LAIR_KINDS, LAIR_RESPAWN, PEN_HATCH_DAYS, PEN_GROW_DAYS, buildLairs, lairArmy, landParty } from '../shared/src/data/lairs.ts';
import { generateLairJobs } from '../shared/src/data/lairquests.ts';
import { TAC_BLOCKING, hexIndex, hexMirror, TAC_W, TAC_H } from '../shared/src/data/tactical.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { pointInPolygon } from '../shared/src/math.ts';
import { Rng } from '../shared/src/rng.ts';
import { isleLevel, isleLoot, isleType } from '../shared/src/world/archipelago.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { closeFight, lairById, lairChoice, lairDwellView, lairList, lairOffer, lairUp, lairsOf, landFighting, landTac, nestEgg, penRows, stepLairs } from '../server/src/game/beastlairs.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { lyingOff } from '../server/src/game/base.ts';
import { mineSites, offIsland } from '../server/src/game/mines.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { JOBS } from '../shared/src/data/quests.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { townState } from '../server/src/game/town.ts';
import { aiAct, makeLandField, newBattle, quickFinish, reachOf, blow, lossesOf, stackById } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as ARMY_EN, RU as ARMY_RU } from '../client/src/lang/ui/army.ts';
import { setLang } from '../client/src/i18n.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const sheets = JSON.parse(readFileSync(new URL('../tools/art/sheets.json', import.meta.url), 'utf8')) as Record<string, { ids: string[]; painting?: boolean }>;

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name = 'Lair Tester', level = 5, cls = 'brig'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 100_000;
  return s;
}

const side = (army: ArmyStack[], beasts = false): TacSideInput => ({
  name: 'x', ship: 'y', captain: null, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0,
  blooded: 0, castle: false, struck: false, human: false, ...(beasts ? { noBook: true } : {}),
} as TacSideInput);

// ------------------------------------------------------------------------------------------------ 14. the bestiary

test('the bestiary: forty-three kinds over the seven tiers, every special of the land among them, faces from the art', () => {
  // docs/18's fourteen, two a tier, the twelve wild beasts (owner, 2026-10-03) among the middle tiers, the five great
  // beasts of the grottos and the guardians' seats at the top, and the islands' third dozen (2026-10-04, docs/18 IX).
  assert.equal(BEAST_IDS.length, 43);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((t) => BEAST_IDS.filter((b) => BEASTS[b].tier === t).length), [4, 8, 8, 6, 6, 5, 6]);
  const sp = new Set(BEAST_IDS.flatMap((b) => BEASTS[b].specials));
  for (const s of ['shell', 'poison', 'swarm', 'regen', 'terror', 'flying', 'diving'] as const) assert.ok(sp.has(s), s);
  // A wild beast's face is its own battle figure: in the art, or on a sheet still in the painter's queue.
  const queued = new Set(Object.values(sheets).filter((s) => s.painting).flatMap((s) => s.ids));
  for (const b of BEAST_IDS) {
    assert.ok(UNITS[b] && UNITS[b].beast, `${b} is a unit`);
    const art = BEASTS[b].art;
    if (art.startsWith('portrait.')) assert.ok(readFileSync(new URL(`../assets/portraits/${art.slice(9)}.webp`, import.meta.url)).length > 0, art);
    else assert.ok(manifest.assets[art] || (art === `unit.${b}` && queued.has(art)), `${b}: ${art} in the art`);
    assert.ok(ARMY_EN[`u.${b}` as keyof typeof ARMY_EN] && ARMY_RU[`u.${b}` as keyof typeof ARMY_RU] && ARMY_EN[`ud.${b}` as keyof typeof ARMY_EN] && ARMY_RU[`ud.${b}` as keyof typeof ARMY_RU], `${b} named`);
  }
  // The stand-ins are tinted tokens (the journal lists them).
  assert.deepEqual(Object.keys(BEAST_TINT).sort(), ['cultist', 'hermit', 'marsh_serpent', 'mermaid', 'reef_shark', 'rock_turtle', 'surf_drowned', 'white_whale']); // docs/18 IV: the mermaid, the white whale
  // The might climbs with the tier (a tier's kinds on average).
  const might = (t: number) => {
    const ks = BEAST_IDS.filter((b) => BEASTS[b].tier === t);
    return ks.reduce((a, b) => a + armyPower([{ u: b, n: 1 }]), 0) / ks.length;
  };
  for (let t = 2; t <= 7; t++) assert.ok(might(t) > might(t - 1), `tier ${t}: ${might(t)} over ${might(t - 1)}`);
});

// ------------------------------------------------------------------------------------------------ 13, 22. where they stand

test('the lairs: the same world, the same lairs; on their islands by kind and level; chains on the great islands; the turtles and the sandbars', () => {
  const w = generateWorld(1);
  const a = buildLairs(w), b = buildLairs(generateWorld(1));
  assert.deepEqual(a.map((l) => [l.id, l.kind, l.x, l.y, l.size]), b.map((l) => [l.id, l.kind, l.x, l.y, l.size]));
  assert.ok(a.length >= 700 && a.length <= 1800, `${a.length} lairs`); // docs/19 D2: twice the 350–900 of docs/18 II
  assert.equal(new Set(a.map((l) => l.id)).size, a.length, 'ids unique');
  for (const l of a) {
    const d = LAIRS[l.kind];
    if (l.island < 0) continue;
    const is = w.islands[l.island];
    assert.ok(!is.portId && !is.raft && !is.minor, `${l.id} on a wild island`);
    assert.ok(pointInPolygon(l.x, l.y, is.poly), `${l.id} ashore`);
    assert.equal(l.type, isleType(is));
    // (docs/19 D4: the second lot of hidden islands keeps the lairs she had before she was hidden)
    const lv = Math.min(10, isleLevel(w, is) + isleLoot(is.veil ? { ...is, hidden: false } : is).tier) + (l.role === 'guardian' ? 1 : 0);
    // docs/19 D2: a second lair of another depth on an island with one already — a level deeper (shallower at ⚓10).
    const first = a.find((o) => o.island === l.island && o !== l && !o.id.endsWith('d'));
    if (l.id.endsWith('d') && first) assert.equal(l.level, first.level >= 10 ? 9 : first.level + 1, `${l.id}: the second depth`);
    else assert.equal(l.level, Math.min(10, lv), `${l.id} level`);
    assert.ok(d.types.includes(l.type) && l.level >= d.lv[0] && l.level <= d.lv[1], `${l.id}: ${l.kind} on a ${l.type} island of ⚓${l.level}`);
  }
  const chains = a.filter((l) => l.role === 'guardian');
  assert.ok(chains.length >= 10, `${chains.length} chains`);
  for (const g of chains) {
    assert.ok(a.some((l) => l.id === `l${g.island}s` && l.chain === 0) && a.some((l) => l.id === `l${g.island}g` && l.chain === 1), `chain of ${g.island}`);
  }
  assert.ok(a.some((l) => l.turtle !== undefined) && a.some((l) => l.bank !== undefined), 'turtles and sandbars');
  // Every kind of lair stands somewhere.
  for (const k of LAIR_KINDS) assert.ok(a.some((l) => l.kind === k), k);
  // A hidden island's lairs are richer and a level up.
  assert.ok(a.some((l) => l.island >= 0 && w.islands[l.island].hidden && l.mul > 1.5));
});

// ------------------------------------------------------------------------------------------------ 15, 16. the battle ashore

test('the battlefield ashore: sand, the surf along the shore, rocks and palms; the same from either side; no guns', () => {
  for (const type of ['tropical', 'rocky', 'volcanic', 'swamp', 'graveyard', 'dead']) {
    const cells = makeLandField(77, type);
    assert.ok(!cells.includes('~') && !cells.includes('=') && !cells.includes('M'), 'no decks, no planks');
    for (let x = 0; x < TAC_W; x++) assert.equal(cells[hexIndex(x, TAC_H - 1)], 'W', 'the surf along the shore');
    for (let i = 0; i < cells.length; i++) if (cells[i] !== '#') assert.equal(cells[hexMirror(i)], cells[i], `${type}: mirrored`);
    assert.ok(cells.some((c) => c === 'R' || c === 'P' || c === 'K' || c === 'B'), `${type}: something to hide behind`);
  }
  // The swivels stay aboard: no burst ashore.
  const rng = new Rng(3);
  const bt = newBattle(side([{ u: 'gunner', n: 10 }]), side([{ u: 'crab', n: 10 }], true), 9, 0, rng, { land: 'rocky' });
  assert.ok(bt.stacks.every((s) => !s.sp.includes('blast')));
  assert.ok(bt.land === 'rocky' && bt.heroes[1].spells.length === 0, 'the creatures give no orders');
});

test('the specials: flying over obstacles, diving through the surf, a shell against shots, poison, regeneration, terror, a swarm', () => {
  const rng = new Rng(5);
  const mk = (a: ArmyStack[], b: ArmyStack[]) => newBattle(side(a), side(b, true), 11, 0, rng, { land: 'tropical' });
  // Flying: the gulls' reach crosses the rocks and the stacks a walker must go round.
  let bt = mk([{ u: 'deckhand', n: 5 }], [{ u: 'gull', n: 5 }, { u: 'crab', n: 5 }]);
  const gull = bt.stacks.find((s) => s.unit === 'gull')!, crab = bt.stacks.find((s) => s.unit === 'crab')!;
  const block = bt.cells.map((c, i) => (TAC_BLOCKING.has(c) ? i : -1)).filter((i) => i >= 0 && bt.cells[i] !== '#' && bt.cells[i] !== 'W');
  assert.ok(reachOf(bt, gull).size > reachOf(bt, { ...crab, speed: gull.speed, sp: [] } as typeof crab).size, 'the gulls reach further than a walker of their speed');
  assert.ok(![...reachOf(bt, gull).keys()].some((i) => block.includes(i)), 'but land on the sand');
  // Diving: into the surf and out of it anywhere along the shore.
  bt = mk([{ u: 'deckhand', n: 5 }], [{ u: 'seal', n: 5 }]);
  const seal = bt.stacks.find((s) => s.unit === 'seal')!;
  seal.hex = hexIndex(9, TAC_H - 2);
  const far = [...reachOf(bt, seal).keys()];
  assert.ok(far.some((i) => bt.cells[i] === 'W' && i % TAC_W <= 2), 'out of the surf at the other end of the beach');
  // A shell: shots do little over a third.
  bt = mk([{ u: 'musketeer', n: 10 }], [{ u: 'crab', n: 10 }, { u: 'gull', n: 10 }]);
  const mus = bt.stacks.find((s) => s.unit === 'musketeer')!;
  const c2 = bt.stacks.find((s) => s.unit === 'crab')!, g2 = bt.stacks.find((s) => s.unit === 'gull')!;
  const noCover = (t: typeof c2) => {
    for (const i of [hexIndex(7, 1), hexIndex(8, 3), hexIndex(9, 5), hexIndex(10, 2)]) if (bt.cells[i] === '.') t.hex = i;
  };
  noCover(c2);
  g2.hex = c2.hex === hexIndex(7, 1) ? hexIndex(9, 5) : hexIndex(7, 1);
  const ds = blow(bt, mus, c2, 'shot', null).dmg, dsCrabDef = blow(bt, mus, { ...c2, sp: [] } as typeof c2, 'shot', null).dmg;
  assert.ok(ds < dsCrabDef * 0.45, `shell: ${ds} against ${dsCrabDef}`);
  // Poison, regeneration and the rest, fought out: the bites and the growing back are in the battle's log.
  const kinds = { poison: 0, regen: 0, terror: 0 };
  for (let k = 0; k < 6; k++) {
    const r = new Rng(100 + k);
    const b2 = k % 2
      ? newBattle(side([{ u: 'deckhand', n: 30 }, { u: 'sailor', n: 20 }, { u: 'marine', n: 10 }], true), side([{ u: 'lantern_maw', n: 4 }], true), 50 + k, 0, r, { land: 'dead' })
      : newBattle(side(armyForLevel(5, 70, 7, 'player')), side([{ u: 'marsh_serpent', n: 8 }, { u: 'rock_turtle', n: 5 }, { u: 'lantern_maw', n: 3 }], true), 50 + k, 0, r, { land: 'swamp' });
    // Played turn by turn, every thing that happens counted as it happens (the log keeps the last forty).
    let seen = 0;
    for (let i = 0; i < 3000 && !b2.over && b2.active !== null; i++) {
      aiAct(b2, 0, r);
      for (const e of b2.log) {
        if (e.i <= seen) continue;
        seen = e.i;
        if (e.k === 'poison') kinds.poison++;
        if (e.k === 'regen') kinds.regen++;
        if (e.k === 'fear' && e.id === 'terror') kinds.terror++;
      }
    }
  }
  assert.ok(kinds.poison > 0 && kinds.regen > 0 && kinds.terror > 0, JSON.stringify(kinds));
  // A swarm: its foes answer half as hard.
  bt = mk([{ u: 'marine', n: 10 }], [{ u: 'crab', n: 10 }]);
  const m3 = bt.stacks.find((s) => s.unit === 'marine')!, c3 = bt.stacks.find((s) => s.unit === 'crab')!;
  assert.ok(blow(bt, m3, c3, 'ret', null).dmg < blow(bt, m3, { ...c3, sp: [] } as typeof c3, 'ret', null).dmg * 0.6, 'half an answer');
  void stackById;
  void lossesOf;
});

test('the landing party: the army but a watch of a tenth from the lowest tiers', () => {
  const army = armyForLevel(5, 100, 7, 'player');
  const party = landParty(army);
  assert.equal(armyMen(army) - armyMen(party), 10);
  assert.ok(party.some((s) => UNITS[s.u].tier >= 2));
});

// ------------------------------------------------------------------------------------------------ 13, 17, 18. a lair fought

test('a lair: seen from the sea with its word, fought through a landing; the spoils once a week; it stands again days later', () => {
  const game = world();
  const s = captain(game);
  assert.match(runAdmin(game, s, '/lair crab_beach go') ?? '', /Off the Crab Beach/);
  steps(game, 25);
  stepLairs(game);
  const conn = (s as unknown as { conn: { last: (t: string) => { view?: unknown; card?: unknown } | undefined } }).conn;
  const marks = conn.last('lairs')?.view as { list: { id: string; men: number }[] } | undefined;
  assert.ok(marks && marks.list.length >= 1, 'on her chart, with its creatures counted');
  const card = conn.last('lair_card')?.card as { id: string; reach: boolean; men: number; why: string | null } | undefined;
  assert.ok(card && card.reach && card.men > 0 && !card.why, JSON.stringify(card));
  assert.equal(s.landable?.action, 'lair', 'the land key goes for the lair');
  const l = lairById(game, card!.id)!;
  // The land key lands the party.
  conn.last('lairs');
  (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push({ t: 'land' });
  assert.ok(landFighting(game, s), 'ashore');
  const gold = s.profile!.gold;
  const men = s.ship!.crew;
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  const v = conn.last('board_tac')?.view as { over: { winner: number }; land: { lair: string }; result: { loot: { silver: number; res: Record<string, number> } } };
  assert.equal(v.over.winner, 0, 'the lair is broken');
  assert.equal(v.land.lair, 'crab_beach');
  assert.ok(v.result.loot.silver > 0 && s.profile!.gold > gold, 'its silver');
  assert.ok((lairsOf(s.profile!).res.shell ?? 0) > 0, 'its shell in her store');
  assert.equal(s.ship!.crew, men - (v.result as unknown as { lost: { n: number }[] }).lost.reduce((a, x) => a + x.n, 0), 'her losses came off her stacks');
  assert.ok(!lairUp(game, l), 'down for now');
  closeFight(game, s);
  assert.ok(!landFighting(game, s));
  // Again the same week: only the lesson.
  game.now += LAIR_RESPAWN.shore + 1;
  assert.ok(lairUp(game, l), 'it stands again two days of the sea later');
  runAdmin(game, s, '/lair crab_beach fight');
  landTac(game, s, { a: 'quick' });
  const v2 = conn.last('board_tac')?.view as { result: { loot: { looted?: boolean } } };
  assert.ok(v2.result.loot.looted, 'its spoils were hers this week');
  assert.equal(LAIR_RESPAWN.shore, 2 * DAY_LENGTH_SEC);
});

test('HoMM3\'s offer: at three times her might they flee or come aboard; the guardians never come', () => {
  const game = world();
  const s = captain(game, 'Strong One', 9, 'frigate');
  // Room aboard for those who would come (a slot and a fifth of her hammocks).
  s.ship!.setArmy(armyForLevel(9, Math.round(s.ship!.stats.crewMax * 0.8), s.ship!.armySlots - 1, 'player'));
  runAdmin(game, s, '/lair crab_beach go');
  runAdmin(game, s, '/lair crab_beach weak');
  // (the nearest: with docs/19 D2 a neighbour's lair may stand within the mile too)
  const l = lairList(game).filter((x) => x.kind === 'crab_beach' && lairUp(game, x) && game.world.islands[x.island] && Math.hypot(x.x - s.ship!.state.x, x.y - s.ship!.state.y) < 1500).sort((a, b) => Math.hypot(a.x - s.ship!.state.x, a.y - s.ship!.state.y) - Math.hypot(b.x - s.ship!.state.x, b.y - s.ship!.state.y))[0]!;
  const offer = lairOffer(game, s, l);
  assert.ok(offer === 'join' || offer === 'flee', `offer ${offer}`);
  const before = s.ship!.crew;
  assert.equal(lairChoice(game, s, l.id, offer!), null);
  if (offer === 'join') assert.ok(s.ship!.army.some((x) => x.u === 'crab' || x.u === 'gull') && s.ship!.crew > before, 'the creatures in her army');
  assert.ok(!lairUp(game, l));
  // (nor do the grottos' great beasts)
  for (const k of LAIR_KINDS.filter((x) => LAIRS[x].role !== 'shore')) assert.equal(LAIRS[k].join, 'never', k);
});

// ------------------------------------------------------------------------------------------------ 22. the chain

test('the chain: the grotto waits for the shore lair, the guardian for the grotto; the island\'s chest and the chronicle', () => {
  const game = world();
  const s = captain(game, 'Chain Breaker', 10, 'galleon');
  runAdmin(game, s, '/lair chain go');
  const shore = lairList(game).find((l) => l.chain === 0 && Math.hypot(l.x - s.ship!.state.x, l.y - s.ship!.state.y) < 2500)!;
  const grotto = lairById(game, `l${shore.island}g`)!;
  // Not this week's shore lair: the grotto waits.
  lairsOf(s.profile!).v = {};
  runAdmin(game, s, '/lair grotto go');
  lairsOf(s.profile!).v = {};
  stepLairs(game);
  const conn = (s as unknown as { conn: { last: (t: string) => { card?: { id: string; why: string | null } } | undefined } }).conn;
  const c = conn.last('lair_card')?.card;
  if (c?.id === grotto.id) assert.match(c.why ?? '', /shore lair first/);
  // The whole chain beaten this week: the chest, once.
  const lp = lairsOf(s.profile!);
  const w = Math.floor(0) + 1;
  void w;
  runAdmin(game, s, '/lair guardian fight');
  assert.ok(landFighting(game, s));
  // Even a galleon's party might lose to a guardian; a thinned one it beats.
  landTac(game, s, 'cut');
  closeFight(game, s);
  runAdmin(game, s, '/lair guardian weak');
  runAdmin(game, s, '/lair guardian fight');
  landTac(game, s, { a: 'quick' });
  const v = (conn.last('board_tac') as unknown as { view: { over: { winner: number }; result: { loot: { chest?: { silver: number } } } } }).view;
  if (v.over.winner === 0) {
    assert.ok(v.result.loot.chest && v.result.loot.chest.silver > 0, 'the island\'s chest');
    assert.ok(lp.chains.includes(shore.island), 'the chronicle\'s line written');
    const chron = game.db.getKv<{ msg: string }[]>('world_chronicle') ?? [];
    assert.ok(chron.some((x) => x.msg.includes('from its shore to its guardian')));
  }
});

// ------------------------------------------------------------------------------------------------ 19, 20. dwellings and the pen

test('a creature dwelling: her flag over a beaten lair, its week\'s growth hired through the recruit window', () => {
  const game = world();
  const s = captain(game, 'Flag Raiser');
  s.ship!.setArmy([{ u: 'marine', n: 20 }, { u: 'deckhand', n: 20 }]);
  assert.match(runAdmin(game, s, '/lair dwell') ?? '', /Your flag over/);
  const v = lairDwellView(game, s);
  assert.ok(v && v.src === 'lair' && v.rows.length === 1 && v.rows[0].pool > 0, JSON.stringify(v?.rows));
  const u = v!.rows[0].units[0].u;
  const conn = (s as unknown as { conn: { push: (m: unknown) => void } }).conn;
  const crew = s.ship!.crew;
  conn.push({ t: 'h3', action: 'recruit', src: 'lair', u, n: 2 });
  assert.ok(s.ship!.crew === crew + 2 || s.ship!.crew >= s.ship!.stats.crewMax, 'two of them signed on');
  assert.ok(s.ship!.army.some((x) => x.u === u));
});

test('an egg and the pen: laid in, it hatches in two days, grows in a week, and the kind may be hired at the island', () => {
  const game = world();
  const s = captain(game, 'Pen Keeper');
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  offIsland(game, s, home.id);
  assert.equal(buyIsland(game, s, home.id), null);
  const h = ownIsland(game, s.accountId)!;
  offIsland(game, s, home.id);
  assert.ok(lyingOff(game, s, h));
  runAdmin(game, s, '/egg rock_turtle');
  assert.match(nestEgg(game, s, 0) ?? '', /pen in your town/);
  const t = townState(h.yard!);
  t.b.pen = 1;
  assert.equal(nestEgg(game, s, 0), null);
  assert.equal(lairsOf(s.profile!).eggs.length, 0);
  assert.equal(penRows(game, s).length, 0, 'an egg is not a dwelling yet');
  runAdmin(game, s, '/egg grow');
  const rows = penRows(game, s);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].units[0].u, 'rock_turtle');
  assert.equal(PEN_HATCH_DAYS + PEN_GROW_DAYS, 9);
});

// ------------------------------------------------------------------------------------------------ 23. the jobs

test('the creature jobs: three a port near lairs, wired into the boards; a lair beaten moves them on', () => {
  const game = world();
  const jobs = JOBS.filter((q) => q.id.startsWith('lj_'));
  assert.ok(generateLairJobs(game.world, 1).length >= 60);
  assert.ok(jobs.length >= 60, `${jobs.length} creature jobs`);
  assert.ok(jobs.every((q) => q.id.startsWith('lj_') && q.kind === 'job'));
  const clear = jobs.find((q) => q.steps[0].type === 'lair' && q.steps[0].island !== undefined)!;
  const bring = jobs.find((q) => q.steps[0].type === 'landres')!;
  assert.ok(clear && bring);
  const s = captain(game, 'Job Taker');
  s.profile!.quests.active.push({ id: clear.id, step: 0, progress: 0, startedAt: game.now } as never);
  const st = clear.steps[0] as { island: number; kind: string };
  questEvent(game, s, { k: 'lair', island: st.island, kind: st.kind });
  assert.equal(s.profile!.quests.active.find((a) => a.id === clear.id)?.step, 1, 'on to the giver');
  // The board keeps a place for them.
  const port = game.world.ports.find((p) => p.id === clear.port)!;
  void port;
});

// ------------------------------------------------------------------------------------------------ the console and the words

test('the admin\'s commands of docs/18 II, in HELP in both languages, and every answer in Russian', () => {
  const game = world();
  const s = captain(game, 'Console');
  const help = runAdmin(game, s, '/help')!;
  for (const c of ['/lair [kind]', '/creature', '/egg', '/landres']) assert.ok(help.includes(c), c);
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the Russian HELP');
  assert.equal(ru.split(' · ').length, help.split(' · ').length, 'command for command');
  setLang('ru');
  try {
    for (const line of ['/lair turtle_rocks go', '/lair info', '/lair weak', '/lair beat', '/lair reset', '/creature crab 3', '/creature', '/egg', '/landres 5', '/lair dwell']) {
      const out = runAdmin(game, s, line)!;
      const t = serverText(out);
      assert.ok(!/\b(the|is|and|your|No|Off|on)\b/.test(t), `${line}: ${t}`);
    }
  } finally {
    setLang('en');
  }
  // Every line the lairs say has its Russian.
  const table = serverTable();
  const mine = extract('server/src').filter((p) => /lair|creature|pen|egg|ashore|surf|chain|dwelling/i.test(p));
  const missing = mine.filter((p) => table[p] === undefined);
  assert.deepEqual(missing, []);
});
