import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { TALENTS, canLearn } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { bloodAndSalt, exoticBonus, ghostTraderMul, grandBattery, nightRaider, noteExoticPurchase, stepBridges } from '../server/src/game/bridgefx.ts';
import { canBoard, startBoarding } from '../server/src/game/boarding.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { escortsOf, stepFleet } from '../server/src/game/fleet.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks, cap: CaptainId = 'corsair') {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
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

test('twelve bridges; each needs points in two trees; three at most', () => {
  const list = TALENTS.filter((t) => t.tree === 'bridge');
  assert.equal(list.length, 12);
  const trees = new Map<string, number>();
  for (const b of list) for (const t of b.bridge!.trees) trees.set(t, (trees.get(t) ?? 0) + 1);
  assert.equal(trees.size, 10, 'every tree takes part');
  for (const n of trees.values()) assert.ok(n >= 2);
  const ten = (tree: string) => Object.fromEntries(TALENTS.filter((t) => t.tree === tree && t.tier === 1).map((t) => [t.id, t.maxRank]));
  const ranks: TalentRanks = { ...ten('gunnery'), ...ten('boarding') };
  assert.equal(canLearn({}, 'brg_chain_and_grapple', 1), 'Requires 10 points in Gunnery and Boarding');
  assert.equal(canLearn(ranks, 'brg_chain_and_grapple', 1), null);
  assert.match(canLearn({ ...ranks, brg_storm_gunner: 1, brg_ghost_trader: 1, brg_night_raider: 1 }, 'brg_chain_and_grapple', 1)!, /three bridges/);
});

test('Chain and Grapple: a tangled ship is boarded from further and at any speed', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Grapple', { brg_chain_and_grapple: 1 });
  toSea(game, s);
  const foe = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + 55, ship.state.y, 0);
  foe.hull = foe.stats.hullMax * 0.4;
  foe.state.speed = 9;
  assert.ok(canBoard(game, ship, foe) !== null);
  foe.addEffect({ id: 'tangled', until: game.now + 6, mods: { turnRate: -0.35 } }, game.now);
  assert.equal(canBoard(game, ship, foe), null);
});

test('Ghost Trader and Exotic Goods', () => {
  const { game } = makeGame();
  const { ship, p } = captain(game, 'Ghost', { brg_ghost_trader: 1, brg_exotic_goods: 1 });
  ship.cargo = { sugar: 150, dreamleaf: 5 };
  assert.ok(Math.abs(ghostTraderMul(ship) - 0.85) < 1e-9);
  ship.cargo = { sugar: 1000 };
  assert.ok(Math.abs(ghostTraderMul(ship) - 0.75) < 1e-9, 'capped at −25%');
  const lawless = game.world.ports.find((x) => REGIONS[x.region].safety === 'lawless')!;
  const safe = game.world.ports.find((x) => REGIONS[x.region].safety === 'safe')!;
  noteExoticPurchase(p, lawless, 'spices', 10);
  assert.equal(exoticBonus(ship, p, safe, 'spices', 10, 1000), 100);
  assert.equal(p.exotic.spices, undefined);
  assert.equal(exoticBonus(ship, p, lawless, 'cursed_relics', 1, 300), 45);
});

test('Blood and Salt mends the victor; Drowned Boarders send the dead first', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Blood', { brg_blood_and_salt: 1, brg_drowned_boarders: 1 });
  toSea(game, s);
  const foe = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + 20, ship.state.y, 0);
  ship.hull = ship.stats.hullMax * 0.5;
  ship.crew = 10;
  const crew0 = ship.crew;
  startBoarding(game, ship, foe, 'standard');
  assert.equal(ship.crew, crew0 + 5, 'five drowned rise at the grapple');
  const h = ship.hull;
  bloodAndSalt(ship, 10);
  assert.ok(Math.abs(ship.hull - h - ship.stats.hullMax * 0.03) < 0.01);
  bloodAndSalt(ship, 1000);
  assert.ok(ship.hull - h <= ship.stats.hullMax * 0.1 + 0.01, 'at most 10% a boarding');
});

test('Grand Battery: three allied ships on one target within two seconds', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Battery', { brg_grand_battery: 1 });
  toSea(game, s);
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 300, ship.state.y, 0);
  const e1 = game.spawnNpcShip('escort', 'brig', 'free', ship.state.x, ship.state.y + 100, 0);
  const e2 = game.spawnNpcShip('escort', 'brig', 'free', ship.state.x, ship.state.y - 100, 0);
  e1.ownerId = ship.id;
  e2.ownerId = ship.id;
  assert.equal(grandBattery(game, ship, foe), false);
  foe.recentHits.push({ t: game.now, dir: 0, shooter: e1.id }, { t: game.now, dir: 0, shooter: e2.id });
  assert.equal(grandBattery(game, ship, foe), true);
  game.now += 3;
  assert.equal(grandBattery(game, ship, foe), false, 'only within two seconds');
});

test('Iron Will: steady crews shrug off hits, sound hulls keep their nerve', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Will', { brg_iron_will: 1 });
  const plain = captain(game, 'Weak', {});
  toSea(game, s);
  toSea(game, plain.s, 40000, 80000);
  ship.morale = plain.ship.morale = 80;
  stepBridges(game, s);
  assert.ok(ship.stats.incomingDamageMul < plain.ship.stats.incomingDamageMul);
  applyDamage(game, ship, { morale: 20 }, null);
  applyDamage(game, plain.ship, { morale: 20 }, null);
  assert.ok(ship.morale > plain.ship.morale);
});

test('Flagship Yard: escorts share your fittings', () => {
  const { game } = makeGame();
  const TEN: TalentRanks = { cmd_steady_voice: 3, cmd_fair_share: 2, cmd_officers_mess: 2, cmd_press_gang: 2, cmd_signal_flags: 1, brg_flagship_yard: 1 };
  const { c, s, ship } = captain(game, 'Yard', TEN, 'admiral');
  ship.loadout.modules = { hull_plating: 3 };
  ship.recompute(game.now);
  const port = game.world.ports.find((x) => x.shipyardTier >= 3)!;
  ship.docked = port.id;
  s.profile!.docked = port.id;
  c.push({ t: 'escort', action: 'hire', classId: 'brig' });
  c.push({ t: 'undock' });
  const [e] = escortsOf(game, ship);
  const h0 = e.stats.hullMax;
  stepFleet(game, s);
  assert.ok(e.stats.hullMax > h0, 'plated like the flagship');
});

test('Salvage King: raise a hull that just went down and tow her home', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Salvor', { brg_salvage_king: 1 });
  toSea(game, s);
  const wreck = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + 80, ship.state.y, 0);
  wreck.hull = 0;
  game.beginSinking(wreck);
  steps(game, 20 * 8);
  assert.ok(game.sunkHulls.length > 0);
  c.push({ t: 'land' });
  const raised = [...game.ships.values()].find((x) => x.towed && x.ownerId === ship.id);
  assert.ok(raised, 'she is raised');
  assert.ok(raised!.prize);
  assert.ok(Math.abs(raised!.hull - raised!.stats.hullMax * 0.1) < 1);
  stepBridges(game, s);
  assert.ok(ship.hasEffect('towing'));
  assert.equal(p.salvageDay, Math.floor(game.now / 7200));
});

test('Night Raider: the first broadside from the dark hits harder; Tide Whisperer: the deep carries you', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Raider', { brg_night_raider: 1, brg_tide_whisperer: 1 });
  const abyss = REGIONS.the_abyss.center;
  toSea(game, s, abyss[0], abyss[1]);
  steps(game, 1);
  ship.state.sail = 1;
  ship.input = { rudder: 0, sailTarget: 1 };
  steps(game, 20);
  assert.ok(ship.state.speed >= ship.stats.maxSpeed * 0.55, `carried at ${ship.state.speed}`);
  const prey = game.spawnNpcShip('merchant', 'brig', 'free', ship.state.x + 300, ship.state.y, 0);
  assert.equal(nightRaider(game, ship, prey, false), 1, 'only from the dark');
  assert.equal(nightRaider(game, ship, prey, true), 1.25);
  assert.ok(ship.hasEffect('night_raider'), 'and away at speed');
  ship.attackers.set(prey.id, game.now);
  assert.equal(nightRaider(game, ship, prey, true), 1, 'not once she has seen you');
});
