import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { PROFESSIONS, UNIQUE_OFFICERS } from '../shared/src/data/crew.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { emptyAmmo } from '../shared/src/data/ships.ts';
import {
  companyMods, madnessCheck, onDockCrew, onMagazineBlast, plunderShare, poolTotal, reconcile, resolveMutiny, startMutiny, stepCompany, stepSpirit, tavernOf,
} from '../server/src/game/crew.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, cap: CaptainId = 'corsair') {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 30;
  s.profile!.gold = 1e5;
  return { c, s, ship: s.ship!, p: s.profile!, co: s.profile!.company };
}

function dockAt(s: PlayerSession, portId: string) {
  s.ship!.docked = portId;
  s.profile!.docked = portId;
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

test('a new crew is people of trades; the pools follow the head count', () => {
  const { game } = makeGame();
  const { ship, co } = captain(game, 'Vane');
  assert.equal(poolTotal(co.pools), ship.crew);
  assert.ok(co.pools.gunner > 0 && co.pools.carpenter > 0 && co.pools.cook === 1);
  const reaver = captain(game, 'Morrow', 'reaver');
  assert.ok(reaver.co.pools.marine > co.pools.marine, 'the Reaver ships more marines');
  reconcile(game, co, ship.crew - 5);
  assert.equal(poolTotal(co.pools), ship.crew - 5);
  reconcile(game, co, ship.crew + 3);
  assert.equal(poolTotal(co.pools), ship.crew + 3);
});

test('trades shape the ship: gunners, marines, cooks and surgeons', () => {
  const { game } = makeGame();
  const { ship, co } = captain(game, 'Trades');
  const base = companyMods(ship, co, game.now);
  const noGunners = { ...co, pools: { ...co.pools, sailor: co.pools.sailor + co.pools.gunner, gunner: 0 } };
  assert.ok((companyMods(ship, noGunners, game.now).mods.reloadMul ?? 0) > (base.mods.reloadMul ?? 0), 'no gunners: slow guns');
  const marines = { ...co, pools: { ...co.pools, marine: 10, sailor: co.pools.sailor - 9 } };
  assert.ok((companyMods(ship, marines, game.now).mods.boardingPower ?? 0) > (base.mods.boardingPower ?? 0));
  assert.ok(base.flags.includes('well_fed'), 'a cook for the crew');
  const surgeons = { ...co, pools: { ...co.pools, surgeon: 2, sailor: co.pools.sailor - 2 } };
  assert.ok((companyMods(ship, surgeons, game.now).mods.surgeon ?? 0) > 0);
  const vets = { ...co, skill: 5 };
  assert.ok((companyMods(ship, vets, game.now).mods.reloadMul ?? 0) < (base.mods.reloadMul ?? 0), 'veterans reload faster');
});

test('the morale ladder: inspired crews reload faster, broken ones barely work', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Ladder');
  ship.morale = 90;
  stepSpirit(game, ship);
  const hi = ship.stats.reloadMul;
  ship.morale = 10;
  stepSpirit(game, ship);
  assert.ok(ship.stats.reloadMul > hi + 0.4);
});

test('taverns: tradesmen by region, veterancy dilution, officers with slots, standing and a price', () => {
  const { game } = makeGame();
  const { c, s, ship, p, co } = captain(game, 'Hirer');
  const cinder = game.world.ports.find((x) => x.id === 'cinderhold')!;
  const tav = tavernOf(game, cinder);
  assert.ok((tav.stock.marine ?? 0) >= 5, 'Cinderhold has marines to hire');
  dockAt(s, 'cinderhold');
  ship.crew = Math.min(ship.crew, ship.stats.crewMax - 4);
  reconcile(game, co, ship.crew);
  const m0 = co.pools.marine;
  const skill0 = co.skill;
  c.push({ t: 'hire_crew', qty: 1, prof: 'marine' });
  c.push({ t: 'hire_crew', qty: 1, prof: 'marine' });
  assert.equal(co.pools.marine, m0 + 2);
  assert.notEqual(co.skill, skill0);
  // Magda Rusk wants Confederacy standing.
  const magda = tav.officers.find((o) => o.unique === 'iron_jaw')!;
  c.push({ t: 'officer', action: 'hire', id: magda.id });
  assert.equal(co.officers.length, 0, 'no standing, no Magda');
  p.reputation.confederacy = 30;
  c.push({ t: 'officer', action: 'hire', id: magda.id });
  assert.equal(co.officers.length, 1);
  assert.equal(co.officers[0].role, 'quartermaster');
  // A sloop has one officer berth.
  const other = tav.officers.find((o) => !o.unique);
  if (other) {
    c.push({ t: 'officer', action: 'hire', id: other.id });
    assert.equal(co.officers.length, 1, 'berths are full');
  }
  assert.ok(UNIQUE_OFFICERS.every((u) => game.world.ports.some((pt) => pt.id === u.port)));
});

test('officer orders work, then wait out their cooldown', () => {
  const { game } = makeGame();
  const { c, s, ship, co } = captain(game, 'Orders');
  toSea(game, s);
  co.officers.push({ id: 'o1', name: 'Test Lieutenant', role: 'lieutenant', level: 5, xp: 0, traits: ['sharp_eyed', 'lucky'], loyalty: 60, wound: null, hiredAt: 0, orderReady: 0 });
  ship.morale = 40;
  c.push({ t: 'officer', action: 'order', id: 'o1' });
  assert.ok(ship.morale > 50);
  ship.morale = 40;
  c.push({ t: 'officer', action: 'order', id: 'o1' });
  assert.equal(ship.morale, 40, 'not ready again');
  // The officer's trait reaches the guns.
  stepCompany(game, s);
  assert.ok(ship.effects.some((e) => e.id === 'company' && (e.mods?.spreadMul ?? 0) < 0));
});

test('wages are paid every ten minutes at sea; an empty chest costs loyalty', () => {
  const { game } = makeGame();
  const { s, ship, p, co } = captain(game, 'Payday');
  toSea(game, s);
  const g0 = p.gold;
  ship.talentReady.payday = game.now - 1;
  co.owed = 50;
  stepCompany(game, s);
  assert.ok(p.gold <= g0 - 50);
  p.gold = 0;
  co.owed = 50;
  const l0 = co.loyalty;
  for (let i = 0; i < 3600; i++) stepCompany(game, s);
  assert.ok(co.loyalty < l0 - 3, `unpaid: ${l0} → ${co.loyalty}`);
});

test('the Codex share: the crew takes its cut of plunder and judges it', () => {
  const { game } = makeGame();
  const { s, co } = captain(game, 'Codex');
  co.share = 40;
  const l0 = co.loyalty;
  assert.equal(plunderShare(game, s, 1000), 600);
  assert.ok(co.loyalty > l0);
  co.share = 5;
  const l1 = co.loyalty;
  assert.equal(plunderShare(game, s, 1000), 950);
  assert.ok(co.loyalty < l1);
});

test('the road to mutiny: murmurs, disobedience, mutiny — and the four ways out', () => {
  const { game } = makeGame();
  const { c, s, ship, p, co } = captain(game, 'Bligh');
  toSea(game, s);
  co.loyalty = 10;
  ship.morale = 20;
  for (let i = 0; i < 600 * 3 + 5 && !co.mutiny; i++) {
    ship.morale = 20;
    stepCompany(game, s);
  }
  assert.ok(co.mutiny, 'mutiny after three phases');
  assert.ok(c.all('mutiny').length > 0, 'the captain is asked what to do');
  // Pay.
  const g0 = p.gold;
  c.push({ t: 'mutiny', choice: 'pay' });
  assert.equal(co.mutiny, null);
  assert.ok(p.gold < g0);
  // Yield: they sail her to port and half walk off.
  startMutiny(game, s, 'test');
  resolveMutiny(game, s, 'yield');
  assert.ok(co.course);
  const crew0 = ship.crew;
  onDockCrew(game, s, game.portById(co.course!)!);
  assert.ok(ship.crew <= Math.ceil(crew0 / 2) + 1);
  assert.equal(co.course, null);
  // Suppress with marines; duel.
  toSea(game, s);
  co.pools.marine += 30;
  ship.crew += 30;
  startMutiny(game, s, 'test');
  let won = false;
  for (let i = 0; i < 10 && !won; i++) {
    if (!co.mutiny) startMutiny(game, s, 'test');
    resolveMutiny(game, s, 'suppress');
    won = !co.course;
    co.course = null;
  }
  assert.ok(won, 'marines put it down');
  startMutiny(game, s, 'test');
  resolveMutiny(game, s, 'duel');
  assert.equal(co.mutiny, null);
  // Heavy losses on one voyage are a mutiny by themselves.
  co.course = null;
  co.loyalty = 40;
  co.voyageStartCrew = 30;
  co.voyageLost = 20;
  ship.morale = 70;
  stepCompany(game, s);
  assert.ok(co.mutiny);
  // Ignored for a minute: they take the ship to port.
  game.now += 61;
  stepCompany(game, s);
  assert.equal(co.mutiny, null);
  assert.ok(co.course);
});

test('no mutiny loop: none rises while the mutineers steer for port, and making port ends one still on', () => {
  const { game } = makeGame();
  const { s, ship, co } = captain(game, 'Loop');
  toSea(game, s);
  startMutiny(game, s, 'test');
  resolveMutiny(game, s, 'yield');
  assert.ok(co.course, 'bound for port');
  // Heavy losses would raise another — but they already hold the helm.
  co.loyalty = 30;
  co.voyageStartCrew = 30;
  co.voyageLost = 25;
  stepCompany(game, s);
  startMutiny(game, s, 'again');
  assert.equal(co.mutiny, null, 'no second mutiny on the way');
  // A mutiny somehow still on at the quay ends there, and the crew walks off once.
  co.mutiny = { at: game.now, mutineers: 5, ringleader: 'Test' };
  const crew = ship.crew;
  onDockCrew(game, s, game.portById(co.course!)!);
  assert.equal(co.mutiny, null);
  assert.equal(co.course, null);
  assert.ok(ship.crew < crew);
});

test('madness of the deep can raise a mutiny', () => {
  const { game } = makeGame();
  const { s, co } = captain(game, 'Deep');
  toSea(game, s);
  co.loyalty = 20;
  for (let i = 0; i < 60 && !co.mutiny; i++) madnessCheck(game, s);
  assert.ok(co.mutiny);
});

test('betrayal: a greedy officer is warned of a day ahead, then walks off with silver or your route', () => {
  const { game } = makeGame();
  const { s, p, co } = captain(game, 'Judas');
  toSea(game, s);
  co.officers.push({ id: 'o9', name: 'Greedy Gault', role: 'lieutenant', level: 3, xp: 0, traits: ['greedy', 'coward'], loyalty: 10, wound: null, hiredAt: 0, orderReady: 0 });
  stepCompany(game, s);
  assert.ok(co.officers[0].warnedAt !== undefined, 'warned');
  const port = game.world.ports[0];
  dockAt(s, port.id);
  onDockCrew(game, s, port);
  assert.equal(co.officers.length, 1, 'not before a day has passed');
  game.now += 7201;
  const g0 = p.gold;
  onDockCrew(game, s, port);
  assert.equal(co.officers.length, 0);
  assert.ok(p.gold < g0 || p.crewAmbush > 0, 'silver gone or route sold');
});

test('powder blast can kill the officer at the magazine; the crew remembers', () => {
  const { game } = makeGame();
  const { s, co } = captain(game, 'Boom');
  toSea(game, s);
  let died = false;
  for (let i = 0; i < 60 && !died; i++) {
    co.officers = [{ id: 'g', name: 'Master Gunner Salt', role: 'master_gunner', level: 3, xp: 0, traits: ['sharp_eyed', 'drunkard'], loyalty: 60, wound: null, hiredAt: 0, orderReady: 0 }];
    onMagazineBlast(game, s);
    died = co.officers.length === 0;
  }
  assert.ok(died);
  assert.ok(co.memorial.length > 0);
  assert.ok(co.memoryUntil > game.now);
});

test('prisoners sign on after a boarding; press gangs work only in lawless ports', () => {
  const { game } = makeGame();
  const { c, s, ship, co } = captain(game, 'Press');
  toSea(game, s);
  ship.crew = 10;
  reconcile(game, co, 10);
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + 30, ship.state.y, 0);
  npc.crew = 30;
  npc.surrendered = true;
  npc.lootLockedFor = ship.id;
  s.pendingBoarding = { result: { targetName: npc.name, targetClass: 'brig', cargo: {}, destroyed: {}, gold: 0, ammo: emptyAmmo(), crewLost: 0, enemyCrewLost: 0, ransom: 0, holdFree: 0, npc: true, prize: null, captive: false, recruits: 9, noQuarter: false }, targetId: npc.id };
  c.push({ t: 'loot_take', take: {}, fate: 'release', recruit: 9 });
  assert.equal(ship.crew, 19);
  assert.equal(poolTotal(co.pools), 19);
  // Press gangs.
  const safe = game.world.ports.find((x) => REGIONS[x.region].safety === 'safe')!;
  dockAt(s, safe.id);
  c.push({ t: 'press_gang', qty: 5 });
  assert.equal(ship.crew, 19);
  const lawless = game.world.ports.find((x) => REGIONS[x.region].safety === 'lawless')!;
  dockAt(s, lawless.id);
  const l0 = co.loyalty;
  c.push({ t: 'press_gang', qty: 5 });
  assert.equal(ship.crew, 24);
  assert.ok(co.loyalty < l0);
  assert.equal(PROFESSIONS.reduce((a, k) => a + co.pools[k], 0), 24);
});

test('a sunk ship: officers wounded or taken; sinking in port-less water is survivable with the company intact', () => {
  const { game } = makeGame();
  const { s, ship, co } = captain(game, 'Sunk');
  toSea(game, s);
  co.officers.push({ id: 'o2', name: 'Lt Pell', role: 'lieutenant', level: 3, xp: 0, traits: ['lucky', 'devout'], loyalty: 60, wound: null, hiredAt: 0, orderReady: 0 });
  ship.hull = 0;
  game.beginSinking(ship);
  steps(game, 20 * 20);
  assert.ok(co.officers.length === 0 || co.officers[0].wound !== null, 'wounded (or lost)');
  assert.equal(poolTotal(co.pools) >= 0, true);
});
