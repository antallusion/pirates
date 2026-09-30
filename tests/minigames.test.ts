// Island scenes and mini-games (2026-09-30): more islands, every one with something ashore, and twenty short games in
// one window — riddles, the stars, dice, a coin, three shells, calls to repeat, a needle to time, a haggle and tales.
// The server rolls and checks everything; rewards stay in the sea director's range; an island's haunt rests half an
// hour between a captain's games there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HAUNT_IDS, HAUNT_NAMES, MINIGAMES, MINIGAME_IDS, MINI_SILVER_CAP, islandHaunt } from '../shared/src/data/minigames.ts';
import type { MinigameDef, MinigameId, Tr } from '../shared/src/data/minigames.ts';
import type { MinigameView } from '../shared/src/protocol.ts';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { BIOME_MIX, REGION_IDS } from '../shared/src/world/regions.ts';
import { generateWorld, outerIslandCount, portLanes } from '../shared/src/world/worldgen.ts';
import { LANDABLE, SCENE_COOLDOWN, exploredKey, findLandable, islandScene, lifeOf } from '../server/src/game/exploration.ts';
import type { LandableFeature } from '../server/src/game/exploration.ts';
import { needleAt, openMinigame, pickMinigame, playMinigame, shellsEnd, startMinigame, stepMinigames, wearyOf } from '../server/src/game/minigames.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };

function texts(d: MinigameDef): Tr[] {
  const out: Tr[] = [d.title, d.text];
  for (const q of d.questions ?? []) out.push(q.q, ...q.options);
  for (const st of Object.values(d.steps ?? {})) out.push(st.text, ...st.choices.map((c) => c.label));
  for (const c of d.choices ?? []) out.push(c.label);
  for (const s of d.symbols ?? []) out.push(s);
  for (const o of Object.values(d.outcomes)) out.push(o.text);
  return out;
}

test('twenty games: both languages, real art, sound data', () => {
  assert.equal(MINIGAME_IDS.length, 20);
  const kinds = new Set(MINIGAME_IDS.map((id) => MINIGAMES[id].kind));
  for (const k of ['riddle', 'stars', 'dice', 'anchor', 'coin', 'shells', 'memory', 'timing', 'haggle', 'quest'] as const) assert.ok(kinds.has(k), `a ${k} game`);
  let riddles = 0;
  for (const id of MINIGAME_IDS) {
    const d = MINIGAMES[id];
    assert.equal(d.id, id);
    for (const t of texts(d)) {
      assert.ok(t[0] && t[1], `${id}: both languages (${t[0]})`);
      assert.doesNotMatch(t[1].replace(/\{\w+\}/g, ''), /[A-Za-z]{4,}/, `${id}: ${t[1]}`);
      const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      assert.equal(holes(t[1]), holes(t[0]), `${id}: placeholders of ${t[0]}`);
    }
    assert.ok(manifest.assets[d.art] && /^card\./.test(d.art), `${id}: art ${d.art} is an existing card`);
    assert.ok(manifest.assets[d.face], `${id}: face ${d.face} is in the manifest`);
    assert.ok(d.outcomes.walk, `${id}: one may walk away`);
    assert.ok(d.haunts.length || d.sea, `${id}: found somewhere`);
    for (const q of d.questions ?? []) assert.ok(q.answer >= 0 && q.answer < q.options.length && q.options.length >= 3 && q.options.length <= 4, `${id}: ${q.q[0]}`);
    if (d.kind === 'riddle' || d.kind === 'stars') {
      riddles += d.questions!.length;
      for (let r = 0; r <= (d.rounds ?? 1); r++) assert.ok(d.outcomes[`r${r}`], `${id}: r${r}`);
    }
    if (d.kind === 'quest') {
      assert.ok(d.steps![d.start!], `${id}: its first step`);
      for (const st of Object.values(d.steps!)) {
        assert.ok(st.choices.length >= 2, `${id}: a real choice`);
        for (const c of st.choices) {
          if (c.go) assert.ok(d.steps![c.go], `${id}/${c.id} → ${c.go}`);
          else if (c.to) assert.ok(d.outcomes[c.to], `${id}/${c.id} → ${c.to}`);
          else assert.ok(d.outcomes[c.win!] && d.outcomes[c.lose!] && c.chance! > 0 && c.chance! < 1, `${id}/${c.id}: a roll`);
        }
      }
    }
    if (d.kind === 'timing') for (let t = 0; t <= d.tries!; t++) assert.ok(d.outcomes[`t${t}`], `${id}: t${t}`);
    if (d.kind === 'anchor') for (let h = 0; h <= 3; h++) assert.ok(d.outcomes[`h${h}`], `${id}: h${h}`);
  }
  assert.ok(riddles >= 10, `${riddles} riddles and questions of the sea`);
  // Every haunt has games enough that none comes twice running; a passing boat has a handful.
  for (const h of HAUNT_IDS) assert.ok(MINIGAME_IDS.filter((id) => MINIGAMES[id].haunts.includes(h)).length >= 5, h);
  assert.ok(MINIGAME_IDS.filter((id) => MINIGAMES[id].sea).length >= 5);
  // The haunts' names, as the server says them, are in Russian for the client.
  const table = serverTable();
  for (const h of HAUNT_IDS) assert.equal(table[HAUNT_NAMES[h][0]], HAUNT_NAMES[h][1]);
});

test('rewards stay bounded: in the sea director\'s range, and losses small', () => {
  for (const id of MINIGAME_IDS) {
    for (const [k, o] of Object.entries(MINIGAMES[id].outcomes)) {
      const p = o.pay;
      if (p.silver) assert.ok(p.silver[0] <= p.silver[1] && p.silver[1] <= MINI_SILVER_CAP, `${id}/${k}: silver`);
      if (p.loseSilver) assert.ok(p.loseSilver[1] <= 150, `${id}/${k}: a small loss`);
      if (p.stake) assert.ok(Math.abs(p.stake) <= 3, `${id}/${k}: stake`);
      assert.ok((p.crew ?? 0) <= 2, `${id}/${k}: at most two hands lost`);
      assert.ok((p.xp ?? 0) <= 100, `${id}/${k}: xp`);
      assert.ok(Math.abs(p.morale ?? 0) <= 10 && (p.curse ?? 0) <= 20 && Math.abs(p.sanity ?? 0) <= 15, `${id}/${k}: the crew's spirits`);
      if (p.goods) assert.ok(p.goods[2] <= 16, `${id}/${k}: goods`);
      if (!o.win) assert.ok(!p.silver || p.silver[1] <= 250, `${id}/${k}: a loss pays little`);
    }
  }
});

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  s.profile!.gold = 50_000;
  return { c, s };
}

/** Plays a game out through the protocol: the right answer, the first choice, or a random one. */
function playOut(game: Game, c: FakeConn, s: PlayerSession, id: MinigameId, how: 'right' | 'random'): MinigameView {
  s.msgCount = 0; // the flood guard counts by the wall clock; a test plays hundreds of moves in a second
  const live = startMinigame(game, s, { def: id, haunt: MINIGAMES[id].haunts[0], sea: MINIGAMES[id].haunts.length === 0 })!;
  assert.ok(live, `${id} opens`);
  return finish(game, c, live.id, how);
}

/** Plays the open game to its end. */
function finish(game: Game, c: FakeConn, liveId: number, how: 'right' | 'random'): MinigameView {
  const d = MINIGAMES[c.last('minigame')!.view!.def];
  const id = d.id;
  for (let guard = 0; guard < 12; guard++) {
    const v = c.last('minigame')!.view!;
    assert.equal(v.id, liveId);
    if (v.result) return v;
    let pick = 'walk';
    let extra: { ms?: number; seq?: number[] } = {};
    const rnd = <T>(a: T[]) => a[game.rng.int(0, a.length - 1)];
    switch (d.kind) {
      case 'riddle':
      case 'stars': {
        const q = d.questions![v.q![v.qi!]];
        pick = String(how === 'right' ? q.answer : rnd(v.order![v.qi!]));
        break;
      }
      case 'dice': pick = rnd(['liar', 'raise']); break;
      case 'anchor': pick = String(game.rng.int(0, 5)); break;
      case 'coin': pick = rnd(['crown', 'ship', 'inspect']); break;
      case 'shells': pick = how === 'right' ? String(shellsEnd(v.pea!, v.swaps!)) : rnd(['0', '1', '2', 'wrist']); break;
      case 'memory': pick = 'seq'; extra = { seq: how === 'right' ? v.seq! : v.seq!.map(() => game.rng.int(0, 3)) }; break;
      case 'timing': {
        const i = v.hits!.length;
        // The needle crosses the zone's heart where the swing is 0.
        const hit = ((((0.5 - v.phase![i]) % 0.5) + 0.5) % 0.5) * v.period![i];
        pick = 'stop';
        extra = { ms: how === 'right' ? Math.round(hit) : game.rng.int(0, 5000) };
        if (how === 'right') assert.ok(Math.abs(needleAt(v.period![i], v.phase![i], extra.ms!)) < 0.05);
        break;
      }
      case 'haggle': pick = v.step === 'counter' ? 'accept' : how === 'right' ? 'pay' : rnd(['pay', 'o80', 'o60']); break;
      case 'quest': pick = rnd(d.steps![v.step].choices).id; break;
    }
    c.push({ t: 'minigame', id: v.id, pick, ...extra });
  }
  assert.fail(`${id} never settled`);
}

test('every game can be played to an outcome through the protocol, and the server keeps the purse honest', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Player Pru');
  onHull(game, s.ship!, 'brig');
  const cap = Math.round(MINI_SILVER_CAP * (1 + 0.5 * (s.ship!.shipLevel - 1)));
  for (const id of MINIGAME_IDS) {
    const seen = new Set<string>();
    for (let k = 0; k < 14; k++) {
      s.profile!.gold = 50_000;
      s.ship!.crew = Math.max(30, s.ship!.crew);
      s.profile!.stash.length = 0;
      const g0 = s.profile!.gold;
      const v = playOut(game, c, s, id, k % 3 === 0 ? 'right' : 'random');
      assert.ok(MINIGAMES[id].outcomes[v.result!.outcome], `${id}: ${v.result!.outcome}`);
      seen.add(v.result!.outcome);
      const dg = s.profile!.gold - g0;
      // A haggle spends on gear; everything else wins or loses within bounds.
      if (MINIGAMES[id].kind !== 'haggle') assert.ok(dg <= cap * 3 && dg >= -cap, `${id}: ${dg} silver`);
      assert.equal(openMinigame(game, s), null, 'settled');
      stepMinigames(game);
    }
    assert.ok(seen.size >= 1);
  }
});

test('the server checks answers: the right one wins, a wrong one loses; the shells and the needle obey skill', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Sage Sal');
  for (let k = 0; k < 6; k++) {
    assert.equal(playOut(game, c, s, 'talking_skull', 'right').result!.outcome, 'r1');
    assert.equal(playOut(game, c, s, 'bosuns_lore', 'right').result!.outcome, 'r2');
    assert.equal(playOut(game, c, s, 'compass_needle', 'right').result!.outcome, 't3');
    assert.equal(playOut(game, c, s, 'flag_hoist', 'right').result!.outcome, 'win');
  }
  // A wrong answer on purpose.
  const live = startMinigame(game, s, { def: 'drowned_ferryman', haunt: 'cairn' })!;
  const v = c.last('minigame')!.view!;
  const q = MINIGAMES.drowned_ferryman.questions![v.q![0]];
  c.push({ t: 'minigame', id: live.id, pick: String((q.answer + 1) % q.options.length) });
  assert.equal(c.last('minigame')!.view!.result!.outcome, 'r0');
  // The pearl found where the swaps leave it — unless it was palmed.
  let found = 0;
  for (let k = 0; k < 20; k++) if (['win', 'palmed'].includes(playOut(game, c, s, 'three_shells', 'right').result!.outcome)) found++;
  assert.equal(found, 20);
  // What the captain sees never holds the keeper's dice or the trader's floor.
  startMinigame(game, s, { def: 'liars_dice', haunt: 'shack' });
  const dv = c.last('minigame')!.view! as unknown as Record<string, unknown>;
  assert.ok(Array.isArray(dv.dice) && !('keeper' in dv) && !('reserve' in dv) && !('palmed' in dv));
  // A game one did not answer lapses by itself.
  game.now += 200;
  stepMinigames(game);
  assert.equal(openMinigame(game, s), null);
  assert.equal(c.last('minigame')!.view!.result!.outcome, 'walk');
});

test('never the same game twice running; the shores tire of a captain who plays too often', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Restless Ren');
  let last: MinigameId | null = null;
  for (let k = 0; k < 40; k++) {
    const h = HAUNT_IDS[k % HAUNT_IDS.length];
    const id = pickMinigame(game, s, { haunt: h });
    assert.ok(id && MINIGAMES[id].haunts.includes(h));
    const live = startMinigame(game, s, { def: id!, haunt: h })!;
    assert.notEqual(live.def, last, 'not twice running');
    last = live.def;
    s.profile!.gold = 50_000;
    startMinigame(game, s, { haunt: h }); // one open at a time
    assert.equal(openMinigame(game, s)!.id, live.id);
    game.now += 1;
    assert.equal(playMinigame(game, s, live.id, 'walk'), null);
  }
  assert.ok(wearyOf(game, s) < 1, 'forty games in a few minutes: the purses shrink');
  game.now += 31 * 60;
  assert.equal(wearyOf(game, s), 1, 'rested');
  // At sea, only the games a passing boat may offer.
  for (let k = 0; k < 20; k++) assert.ok(MINIGAMES[pickMinigame(game, s, { sea: true })!].sea);
});

test('more islands: some 45% more, appended; clear of ports, lanes and each other; every island has something ashore', () => {
  for (const seed of [WORLD_SEED, 1337]) {
    const w = generateWorld(seed);
    const outer = w.islands.slice(w.outerFrom, w.minorFrom); // the dense sea's stacks and floating towns come after (docs/16 P3)
    assert.ok(outer.length >= w.outerFrom * 0.4, `${outer.length} outer islands to ${w.outerFrom}`);
    assert.ok(outer.length <= REGION_IDS.reduce((a, r) => a + outerIslandCount(r), 0));
    const lanes = portLanes(w.ports.filter((p) => !p.raft)); // the lanes as the outer islands were laid (before the floating towns)
    for (const is of outer) {
      assert.ok(!is.portId);
      assert.ok(BIOME_MIX[is.region].some(([b]) => b === is.biome), `${is.name}: her region's biome`);
      for (const p of w.ports.filter((q) => !q.raft)) assert.ok(Math.hypot(p.x - is.x, p.y - is.y) > is.radius + 2000, `${is.name} off ${p.name}`);
      for (const o of w.islands) if (o !== is) assert.ok(Math.hypot(o.x - is.x, o.y - is.y) > o.radius + is.radius, `${is.name} clear of ${o.name}`);
      for (const [ax, ay, bx, by] of lanes) {
        const abx = bx - ax, aby = by - ay, t = Math.max(0, Math.min(1, ((is.x - ax) * abx + (is.y - ay) * aby) / (abx * abx + aby * aby)));
        assert.ok(Math.hypot(ax + abx * t - is.x, ay + aby * t - is.y) > is.radius + 800, `${is.name} off the lanes`);
      }
    }
    // Every island that is not a port offers something: a feature, her people or beasts, or her haunt's games.
    for (const is of w.islands) {
      if (is.portId) continue;
      const own = [...is.features, ...lifeOf(is).map((x) => x.kind)].some((f) => LANDABLE.includes(f as LandableFeature));
      assert.ok(own || islandScene(is), `${is.name} (${is.id}) has an activity`);
      if (!own) assert.equal(islandScene(is), islandHaunt(is.id), 'her haunt is fixed by her id');
    }
  }
});

function parkOff(game: Game, s: PlayerSession, isId: number): void {
  const is = game.world.islands[isId];
  const ship = s.ship!;
  const px = is.poly[0], py = is.poly[1];
  const dx = px - is.x, dy = py - is.y, l = Math.hypot(dx, dy);
  ship.state.x = px + (dx / l) * 110;
  ship.state.y = py + (dy / l) * 110;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  ship.lastCombat = -999;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

test('a landing party at an island\'s haunt: the game opens, pays, counts as a landing; the haunt rests half an hour', () => {
  const { game } = makeGame();
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  const { c, s } = captain(game, 'Lander Lou');
  const p = s.profile!;
  // A bare island some way from any other.
  const is = game.world.islands.find((i) => islandScene(i) && game.world.islands.every((o) => o === i || Math.hypot(o.x - i.x, o.y - i.y) > o.radius + i.radius + 900))!;
  assert.ok(is, 'a bare island');
  parkOff(game, s, is.id);
  steps(game, 25);
  const found = findLandable(game, s);
  assert.equal(found?.feature, 'scene');
  assert.equal(found?.island.id, is.id);
  assert.ok(s.landable && s.landable.island === is.name, 'the HUD offers it');
  c.push({ t: 'land' });
  assert.equal(s.ship!.landing?.feature, 'scene');
  steps(game, 20 * 14);
  assert.equal(s.ship!.landing, null, 'back aboard');
  const live = openMinigame(game, s);
  assert.ok(live && MINIGAMES[live.def].haunts.includes(islandHaunt(is.id)), 'her haunt\'s game opens');
  assert.ok(c.last('minigame')?.view, 'the window opens');
  assert.ok(p.explored[exploredKey(is.id, 'scene')] > 0, 'the haunt is stamped');
  // Played out: it counts for the day's orders as a landing, and nothing more is there for half an hour.
  p.daily.orders = [{ kind: 'land', need: 9, progress: 0, done: false } as (typeof p.daily.orders)[number]];
  const v = finish(game, c, live!.id, 'random');
  assert.ok(v.result && v.result.outcome !== 'walk');
  assert.equal(p.daily.orders[0].progress, 1, 'a landing for the dailies');
  assert.equal(openMinigame(game, s), null);
  steps(game, 25);
  assert.equal(findLandable(game, s), null, 'the haunt rests');
  game.now += SCENE_COOLDOWN + 1;
  assert.equal(findLandable(game, s)?.feature, 'scene', 'half an hour later, a new game');
});
