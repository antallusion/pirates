// docs/16 Batch B — the living sea: League convoys on visible routes (raid them or sign on as escort), the pirate
// lairs with their guns, garrison and chest, the good omens that swim alongside, and the storm fronts everyone can
// read on the chart, with a warning when one will cross her course.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONVOY_INFAMY, CONVOY_SPOT_R, convoyStrongbox, escortPay } from '../shared/src/data/raiding.ts';
import type { GameEvent } from '../shared/src/protocol.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { convoysAt, escortOffer, raidView, sailConvoy, signEscort, stepRaiding } from '../server/src/game/raiding.ts';
import { lairAdmin, lairGarrison, lairImpact, lairLanding, lairOf, stepWanted, wantedView } from '../server/src/game/wanted.ts';
import { namedPirates } from '../shared/src/data/pirates.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { PODS, effectId, podJoins, podOf, stepPods } from '../server/src/game/omenpod.ts';
import { stepCompanions } from '../server/src/game/companion.ts';
import { frontOnCourse } from '../server/src/game/weather.ts';
import type { Front } from '../server/src/game/weather.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function captain(game: Game, name: string, region: RegionId, cls = 'brig', level = 6): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, cls, level);
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 400; k++) {
    const x = cx + ((k * 7919) % 16000) - 8000, y = cy + ((k * 104729) % 16000) - 8000;
    if (regionAt(game.world, x, y) !== region || isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

function events(game: Game): GameEvent[] {
  const list: GameEvent[] = [];
  const emit = game.emit.bind(game);
  game.emit = (e: GameEvent, x: number, y: number) => {
    list.push(e);
    emit(e, x, y);
  };
  return list;
}

function beside(game: Game, ship: ShipEntity, o: ShipEntity, d: number): void {
  ship.state.x = o.state.x + d;
  ship.state.y = o.state.y;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

// ------------------------------------------------------------------ 6. convoys

test('a League convoy sails 3–5 hulls with 1–2 escorts at its square’s level; its route is on the chart of those who heard of it or saw it', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Near Nell', 'gravewater');
  const far = captain(game, 'Far Fen', 'black_coast');
  for (let i = 0; i < 6; i++) {
    const cv = sailConvoy(game, 'gravewater')!;
    assert.ok(cv.members.length >= 3 && cv.members.length <= 5, 'three to five merchantmen');
    assert.ok(cv.escorts.length >= 1 && cv.escorts.length <= 2);
    const from = game.portById(cv.from)!;
    const band = sectorAt(game.world, from.x, from.y).band;
    assert.ok(cv.level >= band[0] && cv.level <= band[1], 'the level of the square it sails from');
    assert.ok(game.ships.get(cv.members[0])!.purse >= 500, 'the League’s silver aboard');
  }
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('A League convoy of')), 'the word of its sailing');
  const v = raidView(game, s).known;
  assert.equal(v.length, 6, 'those in its sea know of it');
  assert.ok(v[0].route.length >= 2 && v[0].route.length <= 20, 'a few points of its route');
  assert.equal(raidView(game, far.s).known.length, 0, 'a captain in another sea does not');
  // Seen: she sails within sight of one.
  const lead = game.ships.get(convoysAt(game)[0].members[0])!;
  beside(game, far.ship, lead, CONVOY_SPOT_R - 500);
  stepRaiding(game);
  const seen = raidView(game, far.s).known.find((k) => k.id === convoysAt(game)[0].id);
  assert.ok(seen, 'seen, it goes on her chart');
  assert.equal(seen.seen, true);
});

test('escort: she signs on by a convoy, the sea sends raiders at it, and she is paid on arrival by the hulls brought in', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Escort Esme', 'gravewater');
  const cv = sailConvoy(game, 'gravewater')!;
  const lead = game.ships.get(cv.members[0])!;
  assert.equal(escortOffer(game, s), null, 'too far to hail');
  beside(game, ship, lead, 600);
  const o = escortOffer(game, s)!;
  assert.ok(o && !o.blocked);
  assert.equal(o.pay, escortPay(cv.level));
  assert.equal(signEscort(game, s), null);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('You sign on as escort of the League convoy for')));
  assert.equal(escortOffer(game, s), null, 'signed on once');
  const mine = raidView(game, s).known.find((k) => k.id === cv.id)!;
  assert.equal(mine.mine, true);
  // A minute on, near her: raiders.
  game.npcs.get(lead.id)!.active = true;
  const pirates0 = [...game.ships.values()].filter((x) => x.npcRole === 'pirate').length;
  game.now += 60;
  stepRaiding(game);
  const pirates = [...game.ships.values()].filter((x) => x.npcRole === 'pirate');
  assert.ok(pirates.length >= pirates0 + 1, 'the sea sends raiders');
  assert.ok(game.npcs.get(pirates[pirates.length - 1].id)!.chase?.id === lead.id, 'at the convoy');
  assert.ok(c.all('toast').some((t) => t.msg === 'Sails on the horizon: raiders bear down on the convoy!'));
  // One merchantman lost; the rest come in with her alongside.
  game.removeShip(cv.members[1]);
  const gold0 = s.profile!.gold;
  const league0 = s.profile!.reputation.league ?? 0;
  game.npcs.get(lead.id)!.destPort = 'elsewhere'; // in port, planning her next voyage
  stepRaiding(game);
  const standing = cv.members.length - 1;
  const want = Math.round(o.pay * (0.5 + 0.5 * (standing / cv.size)));
  assert.equal(s.profile!.gold - gold0, want, 'paid by the share of hulls brought in');
  assert.ok((s.profile!.reputation.league ?? 0) > league0, 'the League remembers');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('The League convoy is in at')));
  assert.equal(convoysAt(game).length, 0, 'its story ends');
});

test('raiding a convoy: the League marks her name, the escorts answer, her contract is void; broken, its strongbox is hers', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Raider Rook', 'gravewater');
  const cv = sailConvoy(game, 'gravewater')!;
  const lead = game.ships.get(cv.members[0])!;
  beside(game, ship, lead, 500);
  assert.equal(signEscort(game, s), null);
  const league0 = s.profile!.reputation.league ?? 0;
  lead.attackers.set(ship.id, game.now);
  stepRaiding(game);
  assert.ok((s.profile!.reputation.league ?? 0) <= league0 - CONVOY_INFAMY + 0.01, 'League infamy');
  assert.ok(c.all('toast').some((t) => t.msg === 'You turned on the convoy you were paid to guard: the contract is void.'));
  assert.equal(npcHostileTo(game, game.ships.get(cv.escorts[0])!, ship), true, 'the escorts answer');
  assert.equal(escortOffer(game, s)?.blocked, 'the commodore does not sign on those who fired on his ships');
  const gold0 = s.profile!.gold;
  for (const id of cv.members) {
    const m = game.ships.get(id)!;
    m.surrendered = true;
    m.state.x = ship.state.x + 300;
    m.state.y = ship.state.y;
  }
  stepRaiding(game);
  assert.equal(s.profile!.gold - gold0, convoyStrongbox(cv.level), 'the strongbox');
  assert.ok(c.all('toast').some((t) => t.msg === `The convoy's strongbox: ${convoyStrongbox(cv.level)} silver.`));
});

// ------------------------------------------------------------------ 7. lairs

function lairScene(game: Game) {
  const np = namedPirates().find((p) => p.region === 'dead_mans_expanse' && !p.baron && lairOf(game, p.id))!;
  const lair = lairOf(game, np.id)!;
  game.directorOn = true; // the garrison is the sea's own doing, like the director's
  const who = captain(game, 'Storm Sal', 'dead_mans_expanse', 'frigate', 8);
  who.ship.state.x = lair.x + 300;
  who.ship.state.y = lair.y;
  game.grid.upsert(who.ship.id, who.ship.state.x, who.ship.state.y);
  return { np, lair, ...who };
}

test('a lair has three guns on its island’s shore; each fires on its own, the ball seen from the gun, and misses as well as hits', () => {
  const { game } = makeGame();
  const { lair, ship } = lairScene(game);
  const island = game.world.islands[lair.island];
  assert.equal(lair.guns.length, 3);
  for (const [gx, gy] of lair.guns) {
    assert.ok(Math.hypot(gx - island.x, gy - island.y) < island.radius * 1.6 + 200, 'on its island');
  }
  const evs = events(game);
  const hull0 = ship.hull;
  for (let i = 0; i < 20; i++) {
    game.now += 1;
    stepWanted(game);
  }
  const shots = evs.filter((e): e is Extract<GameEvent, { k: 'fx' }> => e.k === 'fx' && e.fx === 'lair_gun');
  assert.ok(shots.length >= 4, `the guns fire (${shots.length})`);
  const from = new Set(shots.map((e) => `${e.x},${e.y}`));
  assert.ok(from.size >= 2, 'from more than one gun');
  for (const e of shots) assert.ok(lair.guns.some(([gx, gy]) => gx === e.x && gy === e.y) && typeof e.dir === 'number' && (e.r ?? 0) > 0);
  assert.ok(shots.some((e) => e.hit) && ship.hull < hull0, 'hits tell on her hull');
  const v = wantedView(game, game.sessionByName('Storm Sal')!).lairs.find((l) => l.id === lair.id)!;
  assert.equal(v.guns.length, 3);
  assert.ok(v.name && v.captain && v.level >= 1);
});

test('a lair’s garrison puts out as she comes and goes for her; the boats cannot land till it is sunk; the chest holds silver, gear and a map', () => {
  const { game } = makeGame();
  const { np, lair, c, s, ship } = lairScene(game);
  game.now += 1;
  stepWanted(game);
  const gar = lairGarrison(game, np.id);
  assert.ok(gar.length >= 2 && gar.length <= 3, 'two or three ships');
  const g = game.ships.get(gar[0])!;
  assert.equal(g.lairGuard, np.id);
  s.profile!.reputation.confederacy = 50; // even a friend of the Brethren
  assert.equal(npcHostileTo(game, g, ship), true, 'the garrison goes for any captain at its lair');
  assert.equal(wantedView(game, s).lairs[0].garrison, gar.length);
  // Silence the battery: the garrison still keeps the boats off.
  for (let i = 0; i < 400; i++) lairImpact(game, lair.x, lair.y, 100, ship.id);
  assert.ok(c.all('toast').some((t) => t.msg === `The lair’s battery on ${lair.name} is silenced. Sink its garrison, then land.`));
  const island = game.world.islands[lair.island];
  assert.equal(lairLanding(game, s, island), true);
  assert.ok(c.all('toast').some((t) => t.msg === `The garrison’s ships still guard the lair on ${lair.name}: sink them first.`));
  // Sunk.
  for (const id of gar) game.removeShip(id);
  game.now += 1;
  stepWanted(game);
  assert.ok(c.all('toast').some((t) => t.msg === `The garrison of the lair on ${lair.name} is sunk. Land now — the lair is open.`));
  assert.equal(wantedView(game, s).lairs[0].open, true);
  const gold0 = s.profile!.gold, maps0 = s.profile!.explore.maps.length, items0 = s.profile!.stash.length;
  ship.crew = 30;
  assert.equal(lairLanding(game, s, island), true);
  const chest = c.last('lairchest')!.view;
  assert.ok(chest.silver >= 1000 && s.profile!.gold - gold0 === chest.silver, 'silver');
  assert.ok(chest.item && s.profile!.stash.length - items0 === 1 + s.profile!.stash.slice(items0).filter((x) => x.art).length, 'a piece of gear (and the garrison's artifact now and then, docs/17 H2)');
  assert.ok(chest.map && s.profile!.explore.maps.length === maps0 + 1, 'a treasure map');
  assert.equal(chest.captain, np.name[0]);
  // Stormed: empty, no garrison, until it is rebuilt.
  const v = wantedView(game, s).lairs[0];
  assert.equal(v.stormed, true);
  assert.equal(lairLanding(game, s, island), false, 'an empty camp');
  for (let i = 0; i < 3; i++) {
    game.now += 1;
    stepWanted(game);
  }
  assert.equal(lairGarrison(game, np.id).length, 0, 'no garrison for an empty lair');
  const t0 = game.wallNow();
  game.wallNow = () => t0 + 6 * 3600_000 + 1000;
  game.now += 1;
  stepWanted(game);
  assert.equal(wantedView(game, s).lairs[0].hp, 1, 'rebuilt after its cooldown');
  game.now += 1;
  stepWanted(game);
  assert.ok(lairGarrison(game, np.id).length >= 2, 'and manned again');
  lairAdmin(game, np.id, 'sink');
  assert.equal(lairGarrison(game, np.id).length, 0);
});

// ------------------------------------------------------------------ 9. good omens alongside

test('dolphins alongside: a toast, a small speed bonus while they swim with her, morale point by point; gunfire scares them off', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Omen Ona', 'black_coast');
  ship.lastCombat = -1e9;
  const speed0 = ship.stats.maxSpeed;
  const morale0 = (ship.morale = 50);
  assert.equal(podJoins(game, s, 'dolphins'), true);
  assert.ok(c.all('toast').some((t) => t.msg === 'Dolphins run alongside — a good omen.'));
  assert.ok(ship.effects.some((e) => e.id === effectId('dolphins')));
  assert.ok(Math.abs(ship.stats.maxSpeed / speed0 - (1 + PODS.dolphins.speed)) < 0.02, 'a little faster');
  assert.equal(podJoins(game, s, 'humpback'), false, 'one pod at a time');
  for (let i = 0; i < 60; i++) {
    game.now += 1;
    stepPods(game);
  }
  assert.ok(ship.morale > morale0 + 3 && ship.morale <= morale0 + PODS.dolphins.morale, `morale rises (${ship.morale})`);
  // Seen by the sea: the pod goes with her view.
  game.now = Math.ceil(game.now / 3) * 3;
  stepCompanions(game);
  assert.ok(c.last('pets')!.list.some((p) => p.ship === ship.id && p.pod === 'dolphins'));
  ship.lastCombat = game.now;
  game.now += 1;
  stepPods(game);
  assert.equal(podOf(game, s.accountId), undefined);
  assert.ok(!ship.effects.some((e) => e.id.startsWith('omen_pod_')));
  assert.ok(Math.abs(ship.stats.maxSpeed - speed0) < 1e-6, 'the bonus goes with them');
  assert.ok(c.all('toast').some((t) => t.msg === 'The guns scare the dolphins off.'));
  setLang('ru');
  assert.equal(serverText('Dolphins run alongside — a good omen.').replace(/ /g, ' '), 'Дельфины идут у борта — добрый знак.');
  setLang('en');
});

test('a humpback or orcas keep with her their while, then go; none come in the strange deeps', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Whale Wyn', 'gravewater');
  ship.lastCombat = -1e9;
  assert.equal(podJoins(game, s, 'humpback'), true);
  const until = podOf(game, s.accountId)!.until;
  assert.ok(until - game.now >= PODS.humpback.stay[0] && until - game.now <= PODS.humpback.stay[1]);
  game.now = until + 1;
  stepPods(game);
  assert.ok(c.all('toast').some((t) => t.msg === 'The humpback sounds and is gone.'));
  const deep = captain(game, 'Deep Dora', 'the_abyss');
  deep.ship.lastCombat = -1e9;
  assert.equal(podJoins(game, deep.s), false, 'nothing kind in the Abyss');
});

// ------------------------------------------------------------------ 10. storm fronts

test('a storm front on her course: when it will reach her, none when it drifts away or she is in it', () => {
  const f = (x: number, y: number, vx: number, vy: number, r = 4000): Front => ({ id: 1, kind: 'storm', x, y, vx, vy, radius: r, until: 5000 });
  // 10 km north, coming south at 5 m/s, she sails north at 5 m/s: the edge (4 km) closes 6 km at 10 m/s → 600 s.
  const hit = frontOnCourse([f(0, -10000, 0, 5)], 0, 0, 0, 0, -5, 900)!;
  assert.ok(hit && Math.abs(hit.sec - 600) < 1, `${hit?.sec}`);
  assert.equal(frontOnCourse([f(0, -10000, 0, 5)], 0, 0, 0, 0, -5, 300), null, 'beyond the horizon');
  assert.equal(frontOnCourse([f(0, -10000, 0, -8)], 0, 0, 0, 0, -5), null, 'drifting away faster than she sails');
  assert.equal(frontOnCourse([f(0, -10000, 8, 0)], 0, 0, 0, 0, 0), null, 'passing well to the side');
  assert.equal(frontOnCourse([f(0, -1000, 0, 5)], 0, 0, 0, 0, -5), null, 'she is in it');
  assert.equal(frontOnCourse([{ ...f(0, -8000, 0, 5), kind: 'fog' }], 0, 0, 0, 0, -5), null, 'fog is no storm');
});

test('every captain reads which way the fronts drift; one on her course is called out once, with the choice', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Front Fay', 'gravewater');
  ship.state.heading = 0;
  ship.state.speed = 6;
  game.fronts = [{ id: 77, kind: 'storm', x: ship.state.x, y: ship.state.y - 9000, vx: 0, vy: 4, radius: 4000, until: game.now + 2000 }];
  const send = () => (game as unknown as { sendFronts(s: PlayerSession): void }).sendFronts(s);
  send();
  const m = c.last('fronts')!;
  assert.equal(m.forecast, false, 'not a navigator');
  assert.equal(m.list[0].vy, 4, 'but she sees its drift');
  assert.equal(m.list[0].ttl, 0, 'not how long it lasts');
  assert.ok(m.warn && m.warn.id === 77 && m.warn.sec > 0 && m.warn.sec < 480);
  send();
  const told = c.all('toast').filter((t) => t.msg.startsWith('A storm front will cross your course'));
  assert.equal(told.length, 1, 'called out once');
  assert.ok(told[0].msg.includes('from the north'));
  setLang('ru');
  assert.ok(/Штормовой фронт пересечёт ваш курс/.test(serverText(told[0].msg)), serverText(told[0].msg));
  setLang('en');
  ship.state.heading = Math.PI; // she turns away and outruns it
  ship.state.speed = 12;
  game.fronts[0].vy = 1;
  send();
  assert.equal(c.last('fronts')!.warn, null);
});
