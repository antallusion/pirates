// docs/16 Batch A — battle and boarding: aim with the wind, critical hits on her parts, a ship that strikes her
// colours, the win streak, the named trophy ship.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec, wrapAngle } from '../shared/src/math.ts';
import { WIND_DRIFT, windDrift, windDriftAngle } from '../shared/src/data/gunnery.ts';
import { AMMO } from '../shared/src/data/ships.ts';
import type { GameEvent } from '../shared/src/protocol.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { fireBroadside, shotDrift, stepProjectiles } from '../server/src/game/combat.ts';
import { SURRENDER_RANGE, canStrike, strikeColours, struck, wouldStrike } from '../server/src/game/struck.ts';
import { streakAhead, streakCounts, streakMul } from '../server/src/game/streak.ts';
import { sellPrizes } from '../server/src/game/prizes.ts';
import type { NpcBrain } from '../server/src/game/npc.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull } from './helpers.ts';
import { dailyRollover } from '../server/src/game/dailies.ts';

function atSea(game: Game, name: string): { c: FakeConn; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
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

/** A steady wind for the test, blowing toward `dir` at `strength`. */
function wind(game: Game, dir: number, strength: number): void {
  game.windFor = () => ({ dir, strength });
}

// ------------------------------------------------------------------ 1. aim with the wind

test('the cross wind carries a ball a few metres downwind at long range, nothing along the wind, more in a storm', () => {
  const speed = AMMO.round.speed;
  const long = windDrift(Math.PI / 2, 1, 0, 460, speed); // wind to the east, ball laid north, a long gun's reach
  assert.ok(long > 4 && long < 12, `a few metres at long range (${long.toFixed(1)})`);
  assert.ok(Math.abs(windDrift(0, 1, 0, 460, speed)) < 1e-9, 'a head or following wind does not push her sideways');
  assert.ok(windDrift(-Math.PI / 2, 1, 0, 460, speed) < 0, 'a wind from the other side, the other way');
  assert.ok(Math.abs(windDrift(Math.PI / 2, 1, 0, 150, speed)) < long / 5, 'short range: next to nothing (the square of the flight)');
  assert.ok(windDrift(Math.PI / 2, 1.3, 0, 460, speed) > long * 1.25, 'a storm pushes more');
  assert.equal(windDrift(Math.PI / 2, 1, 0, 460, speed), WIND_DRIFT * (460 / speed) ** 2);
});

test('a broadside flies downwind of where it is laid by the same reckoning the aim mark shows; the sea\'s gunners allow for it', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Windward');
  ship.reload.starboard = 0;
  ship.reload.port = 0;
  wind(game, 0, 1.2); // the wind blows north; the starboard battery fires east: a full cross wind from the south
  game.rng.gauss = () => 0; // no scatter: the line is the line she laid
  const evs = events(game);
  assert.equal(fireBroadside(game, ship, 'starboard', 400), null);
  const v = evs.find((e) => e.k === 'volley') as Extract<GameEvent, { k: 'volley' }>;
  const laid = wrapAngle(ship.state.heading + Math.PI / 2);
  const want = windDriftAngle(0, 1.2, laid, 400, AMMO[ship.ammoSel].speed);
  assert.ok(want < 0, 'blown north, to the left of an eastward ball');
  for (const b of v.balls) assert.ok(Math.abs(wrapAngle(b[2] - laid) - want) < 0.002, 'every ball turned by the drift');
  // Where the ball falls: as far off her line as the aim mark says.
  const p = game.projectiles[game.projectiles.length - 1];
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 200 && game.projectiles.includes(p); i++) stepProjectiles(game, 0.05);
  const along = headingVec(laid), side = headingVec(laid + Math.PI / 2); // side: to the right of her line
  const off = (p.x - x0) * side.x + (p.y - y0) * side.y;
  const drift = windDrift(0, 1.2, laid, 400, AMMO[ship.ammoSel].speed);
  assert.ok(Math.abs(off - drift) < 3.5, `falls ${off.toFixed(1)} m off her line; the mark said ${drift.toFixed(1)} m`);
  assert.ok((p.x - x0) * along.x + (p.y - y0) * along.y > 350, 'at the range she laid');
  // Her gunners who allow for all of it lay straight on.
  assert.ok(Math.abs(shotDrift(game, ship, laid, 400, 'round', 1)) < 1e-12);
  assert.ok(Math.abs(shotDrift(game, ship, laid, 400, 'round', 0.5) - want / 2) < 1e-9);
});

// ------------------------------------------------------------------ 2. critical hits on her parts

/** A merchant lying off her starboard beam at `d` metres, on even terms. */
function mark(game: Game, ship: ShipEntity, d: number): ShipEntity {
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + v.x * d, ship.state.y + v.y * d, ship.state.heading);
  onHull(game, ship, 'brig', npc.shipLevel);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

/** One ball from her side square into the target's waist. */
function ballInto(game: Game, ship: ShipEntity, target: ShipEntity, ammo: 'chain' | 'heavy' | 'round'): Extract<GameEvent, { k: 'hit' }> | undefined {
  const evs = events(game);
  const h = Math.atan2(target.state.x - ship.state.x, -(target.state.y - ship.state.y));
  const d = Math.hypot(target.state.x - ship.state.x, target.state.y - ship.state.y);
  game.projectiles.push({ owner: ship.id, x: ship.state.x, y: ship.state.y, heading: h, speed: 500, dist: d + 40, traveled: 0, ammo, damage: 60, maxRange: 400, delay: 0 });
  for (let i = 0; i < 40 && game.projectiles.length; i++) stepProjectiles(game, 0.02);
  return evs.find((e) => e.k === 'hit') as Extract<GameEvent, { k: 'hit' }> | undefined;
}

test('chain shot into torn rigging brings the topmast down: a MAST critical, the canvas with it, and she is slower for a while', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Mastbreaker');
  const t = mark(game, ship, 150);
  t.sails = t.stats.sailHpMax * 0.4;
  const speed = t.stats.maxSpeed;
  game.rng.chance = (p: number) => p > 0; // every chance that exists at all comes up
  const hit = ballInto(game, ship, t, 'chain');
  assert.equal(hit?.crit, 'mast');
  assert.ok(t.hasEffect('topmast_down'));
  assert.ok(t.stats.maxSpeed < speed * 0.95, 'she loses way');
  // Whole rigging is not shot away that way.
  const t2 = mark(game, ship, 150);
  t2.state.y -= 400;
  game.grid.upsert(t2.id, t2.state.x, t2.state.y);
  const hit2 = ballInto(game, ship, t2, 'chain');
  assert.notEqual(hit2?.crit, 'mast', 'rigging still whole: no mast');
});

test('a forged ball amidships may find the powder room: a MAGAZINE critical with its blast; a sealed magazine is safer', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Deepshot');
  const t = mark(game, ship, 150);
  t.cargo = {};
  t.ammo.incendiary = 0;
  const hull = t.hull;
  game.rng.chance = (p: number) => p > 0;
  const hit = ballInto(game, ship, t, 'heavy');
  assert.equal(hit?.crit, 'powder');
  assert.ok(t.hull < hull - t.stats.hullMax * 0.1, 'the blast tears her');
  assert.ok(t.hasEffect('fire'));
  // Round shot does not reach it (only her hold's powder can go up).
  const t2 = mark(game, ship, 150);
  t2.state.y -= 400;
  t2.cargo = {};
  t2.ammo.incendiary = 0;
  game.grid.upsert(t2.id, t2.state.x, t2.state.y);
  let seen = 0;
  game.rng.chance = (p: number) => p > 0 && p < 0.02 && p > 0.005; // only the smallest odds come up: the magazine's
  const r = ballInto(game, ship, t2, 'round');
  if (r?.crit === 'powder') seen++;
  assert.equal(seen, 0);
});

test('a critical on one of her parts goes up over the target as a plate with its word; lesser ones stay a number', async () => {
  const { Fx } = await import('../client/src/render/fx.ts');
  const fx = new Fx();
  fx.onEvent({ k: 'hit', x: 100, y: 100, ship: 7, dmg: 42, ammo: 'chain', crit: 'mast' }, 1);
  const plate = fx.particles.find((p) => p.badge === 'mast');
  assert.ok(plate, 'a plate for the mast');
  assert.ok(plate!.text === 'Mast!' || plate!.text === 'Мачта!', plate!.text);
  assert.ok(plate!.y < 100 - 20, 'over the ship, above the damage');
  assert.ok(fx.particles.some((p) => p.kind === 'text' && p.text === '42'), 'the damage still reads');
  // The same part on the same ship does not stack plates in one moment.
  fx.onEvent({ k: 'hit', x: 102, y: 100, ship: 7, dmg: 30, ammo: 'chain', crit: 'mast' }, 1);
  assert.equal(fx.particles.filter((p) => p.badge === 'mast').length, 1);
  for (const part of ['rudder', 'powder'] as const) {
    fx.onEvent({ k: 'hit', x: 300, y: 300, ship: 8, dmg: 10, ammo: 'round', crit: part }, 1);
    assert.ok(fx.particles.some((p) => p.badge === part), part);
  }
  fx.onEvent({ k: 'hit', x: 500, y: 500, ship: 9, dmg: 10, ammo: 'round', crit: 'raked' }, 1);
  assert.ok(!fx.particles.some((p) => p.ship === 9 && p.badge), 'a raking shot is no part');
});

// ------------------------------------------------------------------ 3. striking the colours

/** A warship of `role` off her beam at `d` metres, battered or whole, fighting the captain. */
function foe(game: Game, ship: ShipEntity, role: 'pirate' | 'patrol' | 'merchant', d: number, hullFrac: number): { npc: ShipEntity; brain: NpcBrain } {
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const npc = game.spawnNpcShip(role, 'brig', role === 'patrol' ? 'crown' : role === 'pirate' ? 'confederacy' : 'league', ship.state.x + v.x * d, ship.state.y + v.y * d, ship.state.heading);
  onHull(game, ship, 'brig', npc.shipLevel);
  ship.crew = ship.stats.crewMax; // hands enough for a prize crew
  npc.hull = npc.stats.hullMax * hullFrac;
  npc.state.speed = 0;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.attackers.set(ship.id, game.now);
  npc.lastCombat = game.now;
  ship.lastCombat = game.now;
  const brain = game.npcs.get(npc.id)!;
  brain.active = true;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return { npc, brain };
}

test('a warship strikes her colours only battered and outgunned by a captain on her; never the named', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Terms');
  const whole = foe(game, ship, 'pirate', 200, 1);
  assert.equal(wouldStrike(game, whole.npc, ship), false, 'a whole ship fights on');
  const beaten = foe(game, ship, 'pirate', 250, 0.18);
  assert.equal(wouldStrike(game, beaten.npc, ship), true, 'battered and outgunned');
  ship.hull = ship.stats.hullMax * 0.15;
  assert.equal(wouldStrike(game, beaten.npc, ship), false, 'a captain just as battered does not frighten her');
  ship.hull = ship.stats.hullMax;
  const idle = foe(game, ship, 'pirate', 300, 0.18);
  idle.npc.attackers.clear();
  assert.equal(wouldStrike(game, idle.npc, ship), false, 'not while the captain holds her fire');
  const pat = foe(game, ship, 'patrol', 320, 0.2);
  assert.equal(wouldStrike(game, pat.npc, ship), true, 'a patrol strikes too');
  pat.npc.named = 'nemesis';
  assert.equal(canStrike(pat.npc), false, 'a named captain never strikes');
  // Only once in her life: having thought better of it she fights on.
  game.rng.chance = () => true;
  assert.equal(strikeColours(game, beaten.npc, beaten.brain, ship), true);
  assert.ok(beaten.npc.surrendered);
  beaten.npc.surrendered = false;
  assert.equal(strikeColours(game, beaten.npc, beaten.brain, ship), false);
});

test('the captain she strikes to gets the card: ransom, her hold or her as a prize; taken only alongside', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Quarter');
  const s = [...game.sessions].find((x) => x.name === 'Quarter')!;
  const { npc, brain } = foe(game, ship, 'pirate', 900, 0.15);
  npc.cargo = { rum: 6 };
  npc.purse = 120;
  const real = game.rng.chance.bind(game.rng);
  game.rng.chance = () => true;
  assert.ok(strikeColours(game, npc, brain, ship));
  game.rng.chance = real;
  const offer = c.last('surrender_offer')?.offer;
  assert.ok(offer, 'the card');
  assert.equal(offer!.id, npc.id);
  assert.equal(offer!.cargo, 6);
  assert.ok(offer!.ransom > 0 && offer!.prize && offer!.prize.crew > 0);
  assert.equal(offer!.range, SURRENDER_RANGE);
  // Too far: she waits for you to come alongside.
  c.push({ t: 'surrender', id: npc.id, fate: 'ransom' });
  assert.match(c.last('toast')!.msg, /Come within 400 m/);
  assert.ok(npc.surrendered);
  // Alongside: released for her ransom. Her purse and the ransom come aboard; she sails home; the card goes.
  npc.state.x = ship.state.x + 250;
  npc.state.y = ship.state.y;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  const gold = s.profile!.gold;
  c.push({ t: 'surrender', id: npc.id, fate: 'ransom' });
  assert.ok(s.profile!.gold > gold + offer!.ransom * 0.5, 'the ransom paid');
  assert.equal(npc.surrendered, false, 'released');
  assert.ok(npc.protectedUntil > game.now, 'she goes in peace');
  assert.equal(c.last('surrender_offer')?.offer, null, 'the card closes');
  assert.equal(s.pendingBoarding, null, 'nothing left alongside');
});

test('her cargo: the hold opens as after a boarding, nothing lost; a prize: a prize crew aboard', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Plunder');
  const s = [...game.sessions].find((x) => x.name === 'Plunder')!;
  const m = foe(game, ship, 'merchant', 200, 0.3);
  m.npc.cargo = { rum: 10, sugar: 4 };
  struck(game, m.npc, m.brain, ship);
  c.push({ t: 'surrender', id: m.npc.id, fate: 'cargo' });
  const r = c.last('boarding')?.result;
  assert.ok(r && r.struck, 'the plunder card, marked as struck');
  assert.deepEqual(r!.destroyed, {}, 'nothing lost in a fight that never was');
  assert.equal(r!.cargo.rum, 10);
  c.push({ t: 'loot_take', take: { rum: 10 }, fate: 'release' });
  assert.equal(s.ship!.cargo.rum, 10);
  // A pirate taken as a prize.
  const p = foe(game, ship, 'pirate', 220, 0.15);
  p.npc.state.y -= 300;
  game.grid.upsert(p.npc.id, p.npc.state.x, p.npc.state.y);
  struck(game, p.npc, p.brain, ship);
  const was = p.npc.name;
  c.push({ t: 'surrender', id: p.npc.id, fate: 'prize' });
  assert.ok(p.npc.prize, 'a prize crew aboard');
  assert.equal(p.npc.ownerId, ship.id);
  assert.equal(p.npc.name, `Prize ${was}`, 'for the court');
  assert.ok(!p.npc.trophy);
});

// ------------------------------------------------------------------ 4. the win streak

test('ships in a row without making port: from the third a growing bonus to plunder and experience, capped; port ends it', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 12].map(streakMul), [1, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.5, 1.5]);
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Streak');
  const s = [...game.sessions].find((x) => x.name === 'Streak')!;
  // The day's orders done beforehand: one finished by a kill (whichever the calendar rolls) would lift her level mid-streak.
  dailyRollover(game, s);
  for (const o of s.profile!.daily.orders) o.done = true;
  const xp: number[] = [];
  const grant = game.grantXp.bind(game);
  game.grantXp = (ses, amount, reason, battle) => {
    // The kills' own experience: a daily order done by one of them (whichever the day rolls) pays apart.
    if (ses === s && reason?.startsWith('Sank ')) xp.push(amount);
    grant(ses, amount, reason, battle);
  };
  const credit = (v: ShipEntity) => (game as unknown as { creditKill: (a: ShipEntity, b: ShipEntity, how: 'sunk' | 'boarded') => void }).creditKill(ship, v, 'sunk');
  const victims = [0, 1, 2, 3].map((i) => foe(game, ship, 'patrol', 300 + i * 60, 1).npc);
  onHull(game, ship, 'brig', victims[0].shipLevel);
  for (const v of victims) game.setNpcLevel(v, victims[0].shipLevel);
  for (const v of victims) credit(v);
  assert.equal(s.profile!.streak, 4);
  assert.ok(Math.abs(xp[2] / xp[0] - 1.1) < 1e-6, `the third ×1.1 (${(xp[2] / xp[0]).toFixed(3)})`);
  assert.ok(Math.abs(xp[3] / xp[0] - 1.2) < 1e-6, 'the fourth ×1.2');
  credit(victims[3]);
  assert.equal(s.profile!.streak, 4, 'a ship counts once (boarded, then scuttled)');
  assert.equal(streakAhead(game, ship, victims[0]), 1.2, 'her wreck as the streak stands');
  const fresh = foe(game, ship, 'patrol', 700, 1).npc;
  game.setNpcLevel(fresh, victims[0].shipLevel);
  assert.equal(streakAhead(game, ship, fresh), 1.3, 'the next one brings the next step');
  assert.ok(c.all('toast').some((m) => /in a row without making port/.test(m.msg)));
  // The HUD's badge.
  (game as unknown as { pushSelf: (x: typeof s, full: boolean) => void }).pushSelf(s, true);
  assert.deepEqual(c.last('self')!.self.streak, { n: 4, mul: 1.2 });
  // Making port ends it.
  (game as unknown as { dockShip: (x: typeof s, p: unknown) => void }).dockShip(s, game.portById('saltmarrow'));
  assert.equal(s.profile!.streak, 0);
  assert.ok(c.all('toast').some((m) => /streak of 4 ships ends/.test(m.msg)));
});

test('a grey ship far below her does not count toward a streak; the streak swells a boarding\'s purse', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Greyhunter');
  const s = [...game.sessions].find((x) => x.name === 'Greyhunter')!;
  const v = foe(game, ship, 'patrol', 300, 1).npc;
  onHull(game, ship, 'frigate', 10);
  s.profile!.level = 56; // a captain of her ship's level: the colours go by her level (docs/26)
  game.setNpcLevel(v, 1);
  assert.equal(streakCounts(game, ship, v), false, 'grey');
  s.profile!.level = 1;
  s.profile!.streak = 4;
  const m = foe(game, ship, 'merchant', 200, 0.3);
  m.npc.purse = 1000;
  struck(game, m.npc, m.brain, ship);
  assert.equal(game.acceptSurrender(s, m.npc.id, 'cargo'), null);
  assert.equal(s.pendingBoarding!.result.gold, 1300, 'the fifth ship: ×1.3 on her purse');
});

// ------------------------------------------------------------------ 5. the named trophy

test('a trophy keeps her name and her story, and goes to a berth at the next port with a yard', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Collector');
  const s = [...game.sessions].find((x) => x.name === 'Collector')!;
  const { npc, brain } = foe(game, ship, 'pirate', 200, 0.15);
  const name = npc.name, captain = npc.captainName;
  struck(game, npc, brain, ship);
  assert.equal(c.last('surrender_offer')!.offer!.trophy, true, 'a berth is free');
  c.push({ t: 'surrender', id: npc.id, fate: 'trophy' });
  assert.ok(npc.prize && npc.trophy, 'taken to be kept');
  assert.equal(npc.name, name, 'she keeps her name');
  assert.equal(npc.trophy!.was, name);
  assert.equal(npc.trophy!.by, 'Collector');
  assert.equal(npc.trophy!.captain, captain);
  assert.equal(npc.trophy!.how, 'struck');
  assert.equal(npc.trophy!.faction, 'confederacy');
  assert.ok(npc.trophy!.place && npc.trophy!.region);
  // Into port: a berth, not the prize court.
  const port = game.portById('saltmarrow')!;
  npc.state.x = port.x + 200;
  npc.state.y = port.y;
  const gold = s.profile!.gold;
  sellPrizes(game, s, port);
  assert.equal(s.profile!.gold, gold, 'not sold');
  const b = s.profile!.berths.at(-1)!;
  assert.equal(b.port, port.id);
  assert.equal(b.loadout.name, name);
  assert.equal(b.loadout.trophy!.was, name);
  assert.equal(b.loadout.classId, 'brig');
  assert.ok(!game.ships.has(npc.id), 'she lies in her berth now');
  (game as unknown as { pushSelf: (x: typeof s, full: boolean) => void }).pushSelf(s, true);
  assert.equal(c.last('self')!.self.berths.at(-1)!.trophy!.was, name, 'the berth list shows her story');
});

test('a trophy with every berth taken goes to the prize court after all; the story reads in both languages', async () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Full');
  const s = [...game.sessions].find((x) => x.name === 'Full')!;
  const { npc, brain } = foe(game, ship, 'pirate', 200, 0.15);
  struck(game, npc, brain, ship);
  assert.equal(game.acceptSurrender(s, npc.id, 'trophy'), null);
  assert.ok(npc.trophy);
  for (let i = 0; i < 3; i++) s.profile!.berths.push({ port: 'saltmarrow', loadout: { ...s.profile!.loadout, name: `Spare ${i}` }, hull: 1 });
  const port = game.portById('saltmarrow')!;
  npc.state.x = port.x + 200;
  npc.state.y = port.y;
  const gold = s.profile!.gold;
  sellPrizes(game, s, port);
  assert.ok(s.profile!.gold > gold, 'the court buys her');
  assert.equal(s.profile!.berths.length, 3);
  const { trophyLine } = await import('../client/src/ui/surrender.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const t = { was: 'Grey Widow', cls: 'brig' as const, faction: 'confederacy', role: 'pirate', captain: 'Silas Morrow', by: 'Full', region: 'black_coast', place: 'Saltmarrow', at: Date.UTC(2026, 8, 30), how: 'struck' as const };
  setLang('en');
  const en = trophyLine(t);
  assert.match(en, /Grey Widow/);
  assert.match(en, /struck her colours/);
  assert.match(en, /by Full/);
  setLang('ru');
  const ru = trophyLine(t);
  assert.match(ru, /после сдачи/);
  assert.match(ru, /Full/);
  setLang('en');
});
