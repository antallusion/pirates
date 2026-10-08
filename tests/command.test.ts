import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALENTS } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { killOfficer, officerBerths, recruitCost, stepCompany } from '../server/src/game/crew.ts';
import { admiralsEye, escortSlots, escortsOf, lashInPort, stepFleet } from '../server/src/game/fleet.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';

// Ten points in Command open the first escort berth.
const TEN: TalentRanks = { cmd_steady_voice: 3, cmd_fair_share: 2, cmd_officers_mess: 2, cmd_press_gang: 2, cmd_signal_flags: 1 };

function captain(game: Game, name: string, talents: TalentRanks) {
  const c = join(game, name, 'admiral');
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function dockAt(game: Game, s: PlayerSession, id?: string) {
  const port = id ? game.portById(id)! : game.world.ports.find((x) => x.shipyardTier >= 3)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  return port;
}

function toSea(game: Game, s: PlayerSession, x = 30000, y = 80000): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, x, y);
}

test('command tree data: 24 talents, 36 ranks, exclusive keystones', () => {
  const list = TALENTS.filter((t) => t.tree === 'command');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 36);
  assert.deepEqual(list.filter((t) => t.keystone).map((t) => t.excludes).sort(), ['cmd_admirals_pennant', 'cmd_rule_of_the_lash']);
});

test('escorts: berths from Command, hired in port, sail in formation, anchor with their damage, and can be lost', () => {
  const { game } = makeGame();
  const none = captain(game, 'Landlubber', {});
  assert.equal(escortSlots(none.p, none.ship), 0);
  const { c, s, ship, p } = captain(game, 'Dray', { ...TEN, cmd_escort_captain: 1 });
  assert.equal(escortSlots(p, ship), 2);
  dockAt(game, s);
  c.push({ t: 'escort', action: 'hire', classId: 'brig' });
  c.push({ t: 'escort', action: 'hire', classId: 'cutter' });
  c.push({ t: 'escort', action: 'hire', classId: 'cutter' });
  assert.equal(p.fleet.escorts.length, 2, 'two berths');
  c.push({ t: 'undock' });
  const esc = escortsOf(game, ship);
  assert.equal(esc.length, 2);
  assert.ok(esc.every((e) => e.ownerId === ship.id && e.fleetId));
  // They keep station astern in line.
  steps(game, 20 * 20);
  for (const e of escortsOf(game, ship)) assert.ok(Math.hypot(e.state.x - ship.state.x, e.state.y - ship.state.y) < 700, 'kept station');
  // Damage is remembered when she anchors.
  const e0 = escortsOf(game, ship)[0];
  e0.hull = e0.stats.hullMax * 0.5;
  const port = game.world.ports.find((x) => x.shipyardTier >= 3)!;
  p.gold = 0; // the yard cannot be paid
  ship.state.x = port.x;
  ship.state.y = port.y;
  ship.state.speed = 0;
  ship.lastCombat = -999;
  c.push({ t: 'dock', bribe: false });
  assert.ok(ship.docked);
  assert.equal(escortsOf(game, ship).length, 0, 'anchored');
  assert.ok(p.fleet.escorts.some((e) => e.hull < 0.6), 'still damaged');
  // Lost at sea.
  p.gold = 1e6;
  c.push({ t: 'undock' });
  const lost = escortsOf(game, ship)[0];
  lost.hull = 0;
  game.beginSinking(lost);
  steps(game, 20 * 12);
  assert.equal(p.fleet.escorts.length, 1);
});

test('formations and the Admiral\'s Pennant change the squadron; Line of Battle fires with you', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Pennant', { ...TEN, cmd_escort_captain: 1, cmd_line_of_battle: 1, cmd_admirals_pennant: 1 });
  dockAt(game, s);
  c.push({ t: 'escort', action: 'hire', classId: 'brig' });
  c.push({ t: 'undock' });
  const [e] = escortsOf(game, ship);
  game.now += 5;
  stepFleet(game, s);
  assert.ok(e.stats.hullMax > computeShipStats(e.loadout, e.captain, {}).hullMax, 'pennant: +20% hull');
  const own = computeShipStats(ship.loadout, 'admiral', {});
  assert.ok(ship.stats.gunDamageMul < own.gunDamageMul - 0.2, 'your own guns −30%');
  c.push({ t: 'formation', formation: 'wedge' });
  assert.equal(p.fleet.formation, 'wedge');
  game.now += 5;
  stepFleet(game, s);
  assert.ok((e.effects.find((x) => x.id === 'squadron')?.mods?.maxSpeed ?? 0) > 0);
  // Line of Battle: a target abeam; the escort fires with the flagship.
  c.push({ t: 'formation', formation: 'line' });
  toSea(game, s);
  e.state.x = ship.state.x;
  e.state.y = ship.state.y + 150;
  e.state.heading = ship.state.heading;
  const v = { x: Math.cos(ship.state.heading), y: Math.sin(ship.state.heading) };
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + v.x * 250, ship.state.y + v.y * 250, 0);
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  ship.reload.starboard = 0;
  ship.reload.port = 0;
  e.reload.port = 0;
  e.reload.starboard = 0;
  c.push({ t: 'fire', side: 'starboard', dist: 250 });
  assert.ok(e.reload.port > 0 || e.reload.starboard > 0, 'the escort fired in the same instant');
});

test('Screen the Flagship: the nearest escort takes a quarter of the blow', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Screened', { ...TEN, cmd_escort_captain: 1, cmd_screen_the_flagship: 1 });
  dockAt(game, s);
  c.push({ t: 'escort', action: 'hire', classId: 'brig' });
  c.push({ t: 'undock' });
  const [e] = escortsOf(game, ship);
  e.state.x = ship.state.x + 50;
  e.state.y = ship.state.y;
  const h0 = ship.hull, e0 = e.hull;
  applyDamage(game, ship, { hull: 100 }, null);
  assert.equal(h0 - ship.hull, 75);
  assert.equal(e0 - e.hull, 25);
});

test('crew talents: Steady Voice, Fair Share, Press Gang, Veteran Officers, Drill Master, Iron Discipline', () => {
  const { game } = makeGame();
  const plain = captain(game, 'Plain', {});
  const cmd = captain(game, 'Commander', { cmd_steady_voice: 3, cmd_fair_share: 2, cmd_press_gang: 2, cmd_officers_mess: 1, cmd_veteran_officers: 1, cmd_drill_master: 2, cmd_iron_discipline: 2 });
  toSea(game, plain.s);
  toSea(game, cmd.s, 40000, 80000);
  plain.ship.morale = cmd.ship.morale = 80;
  applyDamage(game, plain.ship, { morale: 20 }, null);
  applyDamage(game, cmd.ship, { morale: 20 }, null);
  assert.ok(cmd.ship.morale > plain.ship.morale + 2, 'Steady Voice');
  const port = game.world.ports[0];
  assert.ok(recruitCost(game, port, cmd.p, 'sailor', cmd.ship) < recruitCost(game, port, plain.p, 'sailor', plain.ship));
  assert.equal(officerBerths(cmd.ship), officerBerths(plain.ship) + 1);
  // Fair Share: the wage bill is lower.
  cmd.p.company.owed = 0;
  plain.p.company.owed = 0;
  cmd.p.company.pools = { ...plain.p.company.pools };
  stepCompany(game, plain.s);
  stepCompany(game, cmd.s);
  assert.ok(cmd.p.company.owed < plain.p.company.owed);
  // Iron Discipline above 70 morale; Drill Master with a veteran crew.
  cmd.ship.morale = 90;
  stepFleet(game, cmd.s);
  assert.ok(cmd.ship.hasEffect('iron_discipline'));
  cmd.p.company.skill = 4;
  cmd.ship.companyKey = '';
  stepCompany(game, cmd.s);
  const mods = cmd.ship.effects.find((e) => e.id === 'company')!.mods!;
  assert.ok((mods.repairRate ?? 0) > 0);
});

test('the dregs of a lawless port: half price and morale 30 (Press Gang 2)', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Dregs', { cmd_press_gang: 2 });
  const lawless = game.world.ports.find((x) => REGIONS[x.region].safety === 'lawless')!;
  dockAt(game, s, lawless.id);
  ship.crew = 10;
  ship.morale = 80;
  const g0 = p.gold;
  c.push({ t: 'hire_crew', qty: 10, prof: 'sailor', dregs: true });
  assert.equal(ship.crew, 20);
  assert.ok(ship.morale < 60);
  assert.ok(g0 - p.gold <= 10 * recruitCost(game, lawless, p, 'sailor', ship) * 0.5 + 1);
});

test('orders: Rally, Sea Shanty (not under fire), Cat-o\'-Nine-Tails, Concentrate Fire, Black Flag', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Tyrant', { cmd_rally: 1, cmd_sea_shanty: 2, cmd_cat_o_nine_tails: 1, cmd_concentrate_fire: 1, cmd_black_flag: 1 });
  toSea(game, s);
  ship.morale = 30;
  c.push({ t: 'talent_active', id: 'cmd_rally' });
  assert.equal(ship.morale, 50);
  ship.lastHitAt = game.now; // under another ship's fire: the song waits for the shot to stop
  c.push({ t: 'talent_active', id: 'cmd_sea_shanty' });
  assert.ok(!p.talentCooldowns.cmd_sea_shanty, 'not under fire');
  assert.ok(s.whenClear, 'held, not refused');
  ship.lastHitAt = -999;
  ship.sanity = 50;
  c.push({ t: 'talent_active', id: 'cmd_sea_shanty' });
  assert.equal(ship.sanity, 65);
  assert.ok(p.talentCooldowns.cmd_sea_shanty - game.now <= 361, 'rank 2: six minutes');
  const crew0 = ship.crew;
  ship.morale = 20;
  c.push({ t: 'talent_active', id: 'cmd_cat_o_nine_tails' });
  assert.equal(ship.morale, 50);
  assert.ok(ship.crew < crew0);
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 300, ship.state.y, 0);
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  c.push({ t: 'talent_active', id: 'cmd_concentrate_fire', x: foe.state.x, y: foe.state.y });
  assert.ok(foe.hasEffect('marked'));
  // Black Flag: a frightened merchant strikes or runs.
  const m = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x - 200, ship.state.y, 0);
  game.grid.upsert(m.id, m.state.x, m.state.y);
  m.morale = 40;
  c.push({ t: 'talent_active', id: 'cmd_black_flag' });
  assert.ok(m.surrendered || game.npcs.get(m.id)?.fleeFrom === ship.id);
  assert.ok(m.morale <= 30);
});

test('Black Flag in contested water: the first attack costs a wanted level', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Jolly', { cmd_black_flag: 1 });
  const contested = REGIONS.gravewater.center;
  toSea(game, s, contested[0], contested[1]);
  steps(game, 1);
  c.push({ t: 'talent_active', id: 'cmd_black_flag' });
  assert.ok(ship.hasEffect('aggressor'));
  const m = game.spawnNpcShip('merchant', 'brig', 'free', ship.state.x + 200, ship.state.y, 0);
  const i0 = p.infamy;
  applyDamage(game, m, { hull: 10 }, ship);
  assert.ok(p.infamy - i0 >= 20, `infamy +${p.infamy - i0}`);
});

test('Admiral\'s Eye reads the ships around; Legend at the Helm frightens pirates', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Eye', { cmd_admirals_eye: 1, cmd_legend_at_the_helm: 1 });
  toSea(game, s);
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 400, ship.state.y, 0);
  game.grid.upsert(pirate.id, pirate.state.x, pirate.state.y);
  const seen = admiralsEye(game, ship);
  assert.ok(seen.some((x) => x.id === pirate.id && x.crew === pirate.crew));
  const m0 = pirate.morale;
  stepFleet(game, s);
  assert.equal(pirate.morale, m0 - 15);
  stepFleet(game, s);
  assert.equal(pirate.morale, m0 - 15, 'once per meeting');
});

test('Rule of the Lash: morale holds at 50 in a fight, sours out of it, and ports cost a fear bonus', () => {
  const { game } = makeGame();
  const { s, ship, p } = captain(game, 'Lash', { cmd_rule_of_the_lash: 1 });
  toSea(game, s);
  ship.morale = 55;
  applyDamage(game, ship, { morale: 40 }, null);
  assert.equal(ship.morale, 50);
  ship.lastCombat = -999;
  ship.morale = 90;
  stepFleet(game, s);
  assert.equal(ship.morale, 60);
  // In port: pay the fear bonus or lose men.
  const crew0 = ship.crew;
  p.gold = 1e4;
  lashInPort(game, s);
  assert.equal(ship.crew, crew0);
  assert.equal(p.gold, 1e4 - crew0 * 10);
  p.gold = 0;
  lashInPort(game, s);
  assert.ok(ship.crew < crew0);
});

test('Field Promotion: a fallen officer is replaced for the rest of the fight', () => {
  const { game } = makeGame();
  const { s, ship, p } = captain(game, 'Promoted', { cmd_field_promotion: 2 });
  toSea(game, s);
  p.company.officers.push({ id: 'mg', name: 'Gunner Kell', role: 'master_gunner', level: 1, xp: 0, traits: ['sharp_eyed', 'drunkard'], loyalty: 60, wound: null, hiredAt: 0, orderReady: 0 });
  ship.lastCombat = game.now;
  killOfficer(game, s, p.company.officers[0], 'a test');
  assert.ok(p.company.officers.some((o) => o.acting));
  ship.lastCombat = -999;
  stepCompany(game, s);
  assert.ok(!p.company.officers.some((o) => o.acting), 'steps down after the fight');
});
