// Fishing (docs/12 P3): shoals about every sea; nets through a shoal at a walking pace; trolling rods and the fight
// on the line, judged by replaying the captain's holds; pots on the shallows (anyone's to haul in lawless waters);
// a lamp by night; a deep line over the drop; salting; the craft and the sea's records.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST_COOLDOWN, FISH, FISH_IDS, HAUL_FLOATS, fightParams, fightStart, fightStep, fishingPatterns, haulParams, judgeHaul, playFight } from '../shared/src/data/fishing.ts';
import type { FishId } from '../shared/src/data/fishing.ts';
import type { Item } from '../shared/src/data/items.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { depthAt } from '../shared/src/world/worldgen.ts';
import { castNet, dropDeepLine, endFight, endHaul, haulTrap, saltCatch, setTrap, shoalAt, shoalsOf, stepFishing } from '../server/src/game/fishing.ts';
import { stepEvents } from '../server/src/game/events.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { JOBS } from '../shared/src/data/quests.ts';
import { happeningPatterns } from '../shared/src/data/happenings.ts';
import { isNight } from '../shared/src/constants.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { Shoal } from '../server/src/game/fishing.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const tackle = (base: string): Item => ({ uid: 1, base, ilvl: 1, rarity: 1, affixes: [], dur: 100 });

function fisher(game: Game, name: string, base: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  s.profile!.loadout.gear = { tackle: tackle(base) };
  ship.cargo = {};
  return { c, s };
}

/** A smart hand on the line: reels while it is slack enough, lets it run when it is taut. */
function smartHolds(fish: FishId, kg: number, seed: number, craft: number): [number, number][] {
  const p = fightParams(fish, kg, seed);
  let st = fightStart(p), h = false, start = 0;
  const holds: [number, number][] = [];
  while (!st.done) {
    const want = st.tension < 60;
    if (want && !h) {
      h = true;
      start = st.t;
    }
    if (!want && h) {
      h = false;
      holds.push([start, st.t]);
    }
    st = fightStep(p, st, h, craft);
  }
  if (h) holds.push([start, st.t + 1]);
  return holds;
}

test('the fish: fifteen kinds in both languages; the fight is the same wherever it is played', () => {
  assert.equal(FISH_IDS.length, 15);
  for (const id of FISH_IDS) assert.ok(FISH[id].name[0] && /[а-яё]/i.test(FISH[id].name[1]));
  const p = fightParams('swordfish', 300, 777);
  assert.deepEqual(p, fightParams('swordfish', 300, 777), 'a seed makes the same fish');
  assert.equal(playFight(p, [], 10).done, 'escaped', 'an idle hand loses it');
  assert.equal(playFight(p, [[0, 99]], 10).done, 'snapped', 'a hard hand snaps the line');
  assert.equal(playFight(p, smartHolds('swordfish', 300, 777, 10), 10).done, 'landed', 'a good hand lands it');
});

/** A net shoal for the captain, sat right on her with plenty in it. */
function netShoal(game: Game, s: PlayerSession): Shoal {
  let sh: Shoal | null = null;
  for (let k = 0; k < 40 && !sh; k++) {
    stepFishing(game);
    game.now += 10;
    sh = shoalsOf(game).find((a) => FISH[a.fish].methods.includes('net') && FISH[a.fish].skill <= 1) ?? null;
  }
  assert.ok(sh, 'a net shoal somewhere');
  const ship = s.ship!;
  ship.state.x = sh!.x;
  ship.state.y = sh!.y;
  sh!.vx = sh!.vy = 0;
  sh!.until = game.now + 99999;
  sh!.stock = sh!.max = 999;
  ship.state.speed = ship.stats.maxSpeed * 0.25;
  return sh!;
}

/** Casts, lets the floats play out and hauls with the given pulls; the fish that came up. */
function haul(game: Game, c: FakeConn, s: PlayerSession, pulls: (p: ReturnType<typeof haulParams>) => number[]): number {
  const ship = s.ship!;
  const before = (ship.cargo.fish ?? 0) + (ship.cargo.prime_fish ?? 0);
  assert.equal(castNet(game, s), null);
  const view = c.last('nethaul')!.view!;
  assert.ok(view, 'the haul is on her screen');
  const p = haulParams(view.seed, view.craft);
  assert.equal(endHaul(game, s, view.id, pulls(p)), 'The net is still out', 'not before the floats have dipped');
  game.now += Math.ceil(p.end);
  assert.equal(endHaul(game, s, view.id, pulls(p)), null);
  assert.equal(endHaul(game, s, view.id, []), 'That net is already in');
  return (ship.cargo.fish ?? 0) + (ship.cargo.prime_fish ?? 0) - before;
}

const perfect = (p: ReturnType<typeof haulParams>) => p.dips.map((d) => d + p.window / 2);

test('the floats: the same seed makes the same haul; only a pull on the dip counts, a pull too soon spooks it', () => {
  const p = haulParams(4242, 10);
  assert.deepEqual(p, haulParams(4242, 10));
  assert.equal(p.dips.length, HAUL_FLOATS);
  assert.ok(p.end < 10, `a quick haul: ${p.end} s`);
  for (let i = 1; i < p.dips.length; i++) assert.ok(p.dips[i] - p.dips[i - 1] > p.window + 0.9, 'the floats dip one by one');
  assert.ok(haulParams(4242, 50).window > p.window, 'the craft widens the dip');
  assert.equal(judgeHaul(p, perfect(p)).hits, 3);
  assert.equal(judgeHaul(p, []).hits, 0);
  assert.deepEqual(judgeHaul(p, [p.dips[0] - 0.3, p.dips[1] + 0.1]).marks, ['early', 'hit', 'missed']);
  // Mashing the button is no play: a pull every tenth of a second takes the floats too soon.
  const mash = Array.from({ length: 80 }, (_, i) => i * 0.1);
  assert.ok(judgeHaul(p, mash).hits <= 1, 'mashing is punished');
});

test('no fishing by itself: the net catches only when cast and hauled — the better the play, the bigger the haul', () => {
  const { game } = makeGame();
  const { c, s } = fisher(game, 'Netter Ned', 'drift_net');
  const ship = s.ship!;
  const sh = netShoal(game, s);
  // A minute idle in the shoal at a walking pace: nothing.
  for (let i = 0; i < 60; i++) {
    stepFishing(game);
    game.now += 1;
  }
  assert.equal((ship.cargo.fish ?? 0) + (ship.cargo.prime_fish ?? 0), 0, 'nothing without a cast');
  const stock0 = sh.stock, xp0 = s.profile!.fishing!.xp;
  const full = haul(game, c, s, perfect);
  assert.ok(full >= 3, `a full haul: ${full}`);
  assert.ok(sh.stock < stock0, 'the shoal thins');
  assert.ok(s.profile!.fishing!.xp > xp0 || s.profile!.fishing!.skill > 1, 'the craft is taught');
  assert.equal(c.last('nethaul')!.got?.hits, 3);
  // One haul at a time, and a pause between casts.
  game.now += CAST_COOLDOWN;
  const t0 = game.now;
  assert.equal(castNet(game, s), null);
  assert.equal(castNet(game, s), 'Your hands are full: finish this haul first');
  const v = c.last('nethaul')!.view!;
  game.now += 20;
  assert.equal(endHaul(game, s, v.id, []), null);
  game.now = t0 + 5;
  assert.equal(castNet(game, s), 'The net is still being made ready (5 s)');
  game.now = t0 + CAST_COOLDOWN + 30;
  // Every float missed: an empty net.
  assert.equal(haul(game, c, s, () => []), 0);
  assert.ok(c.all('toast').some((t) => t.msg === 'The net comes up empty: every float was missed.'));
  // Too fast: no cast.
  game.now += CAST_COOLDOWN;
  ship.state.speed = ship.stats.maxSpeed * 0.9;
  assert.equal(castNet(game, s), 'Too fast to cast: slow to a walking pace');
  // Out of the shoal: no cast.
  ship.state.speed = 1;
  ship.state.x += sh.r * 3;
  assert.equal(castNet(game, s), 'No shoal here: look for the gulls over the water');
  ship.state.x -= sh.r * 3;
  // A full hold: no cast.
  ship.cargo.timber = 1e6;
  assert.equal(castNet(game, s), 'The hold is full: no room for the catch');
});

test('the net keeps the old catch rate, a little better to an attentive hand', () => {
  const { game } = makeGame();
  const { c, s } = fisher(game, 'Steady Stan', 'drift_net');
  netShoal(game, s);
  // The old drift net: 1–3 fish every 5 s at craft 0 and skill 1 — 0.4 a second on average.
  const oldPerSec = 2 * 1.01 / 5;
  let fish = 0, secs = 0;
  for (let i = 0; i < 40; i++) {
    const t0 = game.now;
    fish += haul(game, c, s, perfect);
    game.now = Math.max(game.now + 2, t0 + CAST_COOLDOWN); // the hand is ready again a couple of seconds after
    secs += game.now - t0;
    s.ship!.cargo = {};
  }
  const perSec = fish / secs;
  assert.ok(perSec > oldPerSec * 1.0 && perSec < oldPerSec * 1.6, `perfect play ${perSec.toFixed(3)}/s against the old ${oldPerSec.toFixed(3)}/s`);
});

test('a rod on open water: a bite, the fight, landed by a good hand — a big one heard by all; an idle one gets away', () => {
  const { game } = makeGame();
  const { c, s } = fisher(game, 'Rodman Rex', 'trolling_rods');
  s.profile!.fishing!.skill = 60;
  const ship = s.ship!;
  // Open water in Gravewater by day.
  ship.state.x = 56000;
  ship.state.y = 60000;
  ship.region = 'gravewater';
  while (game.now % DAY_LENGTH_SEC > DAY_LENGTH_SEC * 0.3) game.now += 60;
  let view = null as null | { id: number; fish: FishId; kg: number; seed: number; craft: number };
  for (let i = 0; i < 400 && !view; i++) {
    ship.state.speed = ship.stats.maxSpeed * 0.55;
    stepFishing(game);
    game.now += 1;
    view = c.last('fishfight')?.view ?? null;
  }
  assert.ok(view, 'a bite within a few minutes');
  assert.equal(endFight(game, s, view!.id, smartHolds(view!.fish, view!.kg, view!.seed, view!.craft)), null);
  assert.ok((ship.cargo.prime_fish ?? 0) + (ship.cargo.fish ?? 0) > 0, 'landed');
  assert.ok(s.profile!.fishing!.caught[view!.fish]!.best > 0);
  // The next one, played by nobody.
  view = null;
  for (let i = 0; i < 400 && !view; i++) {
    ship.state.speed = ship.stats.maxSpeed * 0.55;
    stepFishing(game);
    game.now += 1;
    const v = c.last('fishfight')?.view ?? null;
    if (v && v.id !== c.all('fishfight').find((m) => m.view)?.view?.id) view = v;
  }
  if (view) {
    endFight(game, s, view.id, []);
    assert.equal(endFight(game, s, view.id, []), 'That fish is gone');
  }
});

test('pots on the shallows: too soon, then a haul; in lawless waters another captain may take them', () => {
  const { game } = makeGame();
  const { c, s } = fisher(game, 'Potter Pru', 'crab_traps');
  s.profile!.fishing!.skill = 20;
  const ship = s.ship!;
  // Out on open water first.
  for (let y = 5000; y < 95000; y += 2000) {
    let d = Infinity;
    for (const is of game.world.islands) d = Math.min(d, Math.hypot(is.x - 50000, is.y - y) - is.radius);
    if (d > 4000) {
      ship.state.x = 50000;
      ship.state.y = y;
      break;
    }
  }
  assert.equal(setTrap(game, s), 'Pots go down in the shallows, within a mile of land');
  const is = game.world.islands.find((x) => x.region === 'dead_mans_expanse' && !game.world.ports.some((p) => p.islandId === x.id))!;
  ship.state.x = is.x + is.radius + 300;
  ship.state.y = is.y;
  ship.region = 'dead_mans_expanse';
  assert.equal(setTrap(game, s), null);
  assert.match(haulTrap(game, s)!, /^Too soon/);
  // Half an hour later, another captain passing in lawless water hauls it.
  const t0 = Date.now();
  game.wallNow = () => t0 + 31 * 60_000;
  const { s: o } = fisher(game, 'Thief Theo', 'drift_net');
  o.ship!.state.x = ship.state.x;
  o.ship!.state.y = ship.state.y;
  o.ship!.region = 'dead_mans_expanse';
  assert.equal(haulTrap(game, o), null);
  assert.equal(s.profile!.fishing!.traps.length, 0);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Someone hauls your pot off')));
  assert.ok((o.ship!.cargo.fish ?? 0) + (o.ship!.cargo.prime_fish ?? 0) > 0);
});

test('a deep line wants the craft, a rod, still water over a drop; salting keeps the fresh catch', () => {
  const { game } = makeGame();
  const { s } = fisher(game, 'Deep Dee', 'trolling_rods');
  const ship = s.ship!;
  assert.match(dropDeepLine(game, s)!, /^Your craft is not up to it yet/);
  s.profile!.fishing!.skill = 60;
  ship.state.speed = 0;
  // Find deep water.
  let found = false;
  for (let y = 5000; y < 95000 && !found; y += 2500) for (let x = 5000; x < 95000 && !found; x += 2500) if (depthAt(game.world, x, y) >= 40) {
    ship.state.x = x;
    ship.state.y = y;
    found = true;
  }
  assert.ok(found);
  assert.equal(dropDeepLine(game, s), null);
  ship.cargo = { fish: 10, salt: 2 };
  assert.equal(saltCatch(game, s), null);
  assert.equal(ship.cargo.salted_fish, 8);
  assert.equal(ship.cargo.fish, 2);
  assert.equal(ship.cargo.salt, undefined);
  assert.equal(saltCatch(game, s), 'Nothing to salt: fresh fish and salt are both needed');
});

test('the fishing lines read in Russian', () => {
  setLang('ru');
  const lines = [
    'A bite! Play it: hold to reel in, let it run when the line is taut.', 'Landed: Swordfish, 212.5 kg.', 'The line snaps. It was a big one.', 'Your fishing craft rises to 12.',
    'WORLD: A new record: Ada, Swordfish 312 kg!', 'The pot comes up: 4 Crab.', 'Salted: 8 fish into 8 barrels.', 'Your craft is not up to it yet (5 of 60)',
  ].map((l) => serverText(l));
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Ada/g, ''))), []);
  assert.ok(fishingPatterns().length > 40);
});

/** Every calendar far off but the one wanted, which is due now; then ten seconds of the world. */
function due(game: Game, kind: string): void {
  const st = game.worldEvents.data(game);
  for (const k of ['silver_convoy', 'brethren', 'star', 'eclipse', 'festival', 'herring_run', 'red_tide']) st.next[k] = game.wallNow() + 1e12;
  st.next[kind] = game.wallNow() - 1;
  for (let i = 0; i < 10; i++) stepEvents(game);
}

test('fishing quests: an order counted by the catch; a trophy only fought on the line and heavy enough; a daily of fish', () => {
  const { game } = makeGame();
  const { s } = fisher(game, 'Quester Quill', 'drift_net');
  const order = JOBS.find((q) => q.template?.startsWith('fish_order.'))!;
  const trophy = JOBS.find((q) => q.template?.startsWith('trophy_fish.'))!;
  assert.ok(order && trophy, 'both plots are dealt out among the ports');
  assert.ok(JOBS.filter((q) => q.template?.startsWith('fish_order.') || q.template?.startsWith('trophy_fish.')).length >= 20);
  const st0 = order.steps[0];
  assert.equal(st0.type, 'catch');
  const need = st0.type === 'catch' ? st0.count : 0;
  const p = s.profile!;
  p.quests.active.push({ id: order.id, step: 0, progress: 0, startedAt: game.now });
  p.quests.active.push({ id: trophy.id, step: 0, progress: 0, startedAt: game.now });
  questEvent(game, s, { k: 'catch', units: need - 1, kg: 0.3, fought: false });
  const qo = () => p.quests.active.find((q) => q.id === order.id)!;
  const qt = () => p.quests.active.find((q) => q.id === trophy.id)!;
  assert.equal(qo().step, 0);
  questEvent(game, s, { k: 'catch', units: 2, kg: 0.3, fought: false });
  assert.equal(qo().step, 1, 'the order moves on to the delivery');
  const min = trophy.steps[0].type === 'catch' ? trophy.steps[0].minKg! : 0;
  assert.ok(min >= 6);
  questEvent(game, s, { k: 'catch', units: 1, kg: min + 50, fought: false });
  assert.equal(qt().step, 0, 'a net full of big fish is not a trophy on the line');
  questEvent(game, s, { k: 'catch', units: 1, kg: min - 1, fought: true });
  assert.equal(qt().step, 0, 'too light');
  questEvent(game, s, { k: 'catch', units: 1, kg: min + 1, fought: true });
  assert.equal(qt().step, 1, 'landed');
  // The day's order of fish.
  p.daily.orders = [{ kind: 'fish', need: 12, progress: 0, done: false }];
  questEvent(game, s, { k: 'catch', units: 7, kg: 0.3, fought: false });
  assert.equal(p.daily.orders[0].progress, 7);
  questEvent(game, s, { k: 'catch', units: 7, kg: 0.3, fought: false });
  assert.ok(p.daily.orders[0].done);
});

test('a herring run crowds a northern coast with herring; a red tide kills the shoals and nothing bites', () => {
  const { game } = makeGame();
  const { c, s } = fisher(game, 'Tide Tamsin', 'drift_net');
  while (isNight(game.now)) game.now += 60;
  due(game, 'herring_run');
  const run = game.worldEvents.active(game).find((e) => e.kind === 'herring_run')!;
  assert.ok(run, 'the herring are running');
  assert.ok(['black_coast', 'gravewater', 'leviathan_reach'].includes(run.region));
  const herring = shoalsOf(game).filter((x) => x.region === run.region && x.fish === 'herring');
  assert.ok(herring.length >= 4, `thick with herring: ${herring.length}`);
  assert.ok(herring.every((x) => x.max >= 70), 'fuller than a common shoal');
  // The red tide.
  due(game, 'red_tide');
  const tide = game.worldEvents.active(game).find((e) => e.kind === 'red_tide')!;
  assert.ok(tide, 'the sea turns red');
  const reg = tide.region;
  assert.equal(shoalsOf(game).filter((x) => x.region === reg).length, 0, 'every shoal there is dead');
  for (let i = 0; i < 25; i++) {
    stepFishing(game);
    game.now += 1;
  }
  assert.equal(shoalsOf(game).filter((x) => x.region === reg).length, 0, 'and none rise while it lasts');
  const ship = s.ship!;
  const [x, y] = REGIONS[reg].center;
  ship.state.x = x;
  ship.state.y = y;
  ship.region = reg;
  ship.state.speed = 1;
  for (let i = 0; i < 3; i++) {
    stepFishing(game);
    game.now += 1;
  }
  assert.ok(c.all('toast').some((t) => t.msg === 'The water is red and dead here: nothing bites.'));
  assert.equal(ship.cargo.fish ?? 0, 0);
  // Both read in Russian.
  setLang('ru');
  assert.match(serverText(`The herring run in ${REGIONS[run.region].name}`), /Ход сельди/);
  assert.match(serverText(`Red tide in ${REGIONS[reg].name}`), /Красный прилив/);
  assert.match(serverText('The water is red and dead here: nothing bites.'), /не клюёт/);
  setLang('en');
});
