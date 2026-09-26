import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { TALENTS, canLearn, canUnlearn, validateBuild } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { computeShipStats, sailTalents } from '../shared/src/sim/shipstats.ts';
import { stepSailing, targetSpeed } from '../shared/src/sim/sailing.ts';
import type { SailParams } from '../shared/src/sim/sailing.ts';
import { fireBroadside } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { grantDeed } from '../server/src/game/progression.ts';
import { join, makeGame, steps } from './helpers.ts';

const LVL = { level: 60, abyssOpen: true };

/** Every navigation talent below the keystones at full rank: 41 ranks. */
function fullNav(): TalentRanks {
  const r: TalentRanks = {};
  for (const t of TALENTS) if (t.tree === 'navigation' && !t.keystone) r[t.id] = t.maxRank;
  return r;
}

function atSea(game: Game, name: string): { s: PlayerSession; ship: ShipEntity; c: ReturnType<typeof join> } {
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
  return { s, ship, c };
}

function setTalents(game: Game, s: PlayerSession, ranks: TalentRanks): void {
  s.profile!.level = 60;
  s.profile!.talents = ranks;
  s.ship!.talents = ranks;
  s.ship!.recompute(game.now);
}

function enemyAbeam(game: Game, ship: ShipEntity, distance: number, cls: 'fluyt' | 'brig' = 'fluyt'): ShipEntity {
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const npc = game.spawnNpcShip('pirate', cls, 'confederacy', ship.state.x + v.x * distance, ship.state.y + v.y * distance, ship.state.heading);
  game.npcs.delete(npc.id); // a hulk that holds still
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

// ------------------------------------------------------------------ rules

test('talent data: complete trees have 26 talents, two exclusive keystones, valid parents', () => {
  for (const tree of ['navigation', 'gunnery'] as const) {
    const list = TALENTS.filter((t) => t.tree === tree);
    assert.equal(list.length, 26, tree);
    const ks = list.filter((t) => t.keystone);
    assert.equal(ks.length, 2);
    assert.equal(ks[0].excludes, ks[1].id);
    const ranks = list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0);
    assert.ok(ranks >= 36 && ranks <= 42, `${tree}: ${ranks} ranks`);
    for (const t of list) if (t.requires) assert.ok(TALENTS.some((x) => x.id === t.requires), t.requires);
  }
  assert.equal(new Set(TALENTS.map((t) => t.id)).size, TALENTS.length, 'unique ids');
});

test('talent gates: lower tiers open higher ones, keystones need 25 points and level 25, one per tree', () => {
  // Points in the same tier do not open that tier.
  assert.match(canLearn({ nav_night_runner: 2, nav_sweeps: 1, nav_current_reader: 1, nav_weather_gauge: 1 }, 'nav_shallow_draft', 5, LVL) ?? '', /Requires 5/);
  assert.equal(canLearn({ nav_close_hauled: 3, nav_quick_trim: 2 }, 'nav_shallow_draft', 5, LVL), null);
  assert.equal(canLearn({ nav_close_hauled: 3, nav_quick_trim: 2 }, 'nav_tacking_drill', 5, LVL), null);
  assert.match(canLearn({ nav_helmsmans_hands: 3, nav_quick_trim: 2 }, 'nav_tacking_drill', 5, LVL) ?? '', /Close-Hauled/);
  const nav = fullNav();
  assert.equal(canLearn(nav, 'nav_windborn', 1, LVL), null);
  assert.match(canLearn(nav, 'nav_windborn', 1, { level: 24, abyssOpen: false }) ?? '', /level 25/);
  assert.match(canLearn({ ...nav, nav_windborn: 1 }, 'nav_storm_rider', 1, LVL) ?? '', /Cannot be combined/);
  // Parent talents and ranks.
  const noParent = { ...nav };
  delete noParent.nav_helmsmans_hands;
  assert.match(canLearn({ ...noParent, nav_spill_the_wind: 0 }, 'nav_spill_the_wind', 1, LVL) ?? '', /Helmsman/);
});

test('retention rule: a talent that holds up others cannot be forgotten; builds validate', () => {
  const r: TalentRanks = { nav_close_hauled: 3, nav_quick_trim: 2, nav_tacking_drill: 1 };
  assert.match(canUnlearn(r, 'nav_close_hauled') ?? '', /depends/);
  assert.equal(canUnlearn(r, 'nav_tacking_drill'), null);
  assert.equal(validateBuild(r, 10), null);
  assert.match(validateBuild(r, 5) ?? '', /More points/);
  assert.match(validateBuild({ nav_tacking_drill: 1 }, 10) ?? '', /Requires/);
});

test('stat caps: speed +20% (Windborn +35%), reload floor −25%, prices capped', () => {
  const lo = { classId: 'brig' as const, name: 'x', guns: { port: 'long_9' as const, starboard: 'long_9' as const }, modules: {} };
  const base = computeShipStats(lo, 'reaver', {});
  const fast = computeShipStats(lo, 'reaver', { nav_flying_jib: 2 }, [{ mods: { maxSpeed: 0.5 } }]);
  // Effects (abilities) stack on top of the cap; the talent part is capped.
  assert.ok(Math.abs(fast.maxSpeed - base.maxSpeed * 1.56) < 0.01, `${fast.maxSpeed} vs ${base.maxSpeed}`);
  const capped = computeShipStats(lo, 'reaver', { nav_flying_jib: 2, nav_windborn: 1 });
  assert.ok(Math.abs(capped.maxSpeed - base.maxSpeed * 1.21) < 0.01);
  const reload = computeShipStats(lo, 'reaver', { gun_fast_hands: 3 }, []);
  assert.ok(Math.abs(reload.reloadMul - 0.85) < 1e-9);
  const hot = computeShipStats(lo, 'reaver', { gun_fast_hands: 3, gun_red_hot_barrels: 1 });
  assert.ok(Math.abs(hot.reloadMul - 0.55) < 1e-9, 'Red-Hot lifts the reload floor to −45%');
});

// ------------------------------------------------------------------ sailing talents (shared sim)

test('sailing talents: Master of Sail, Storm Rider, Sweeps and heavy seas', () => {
  const lo = { classId: 'schooner' as const, name: 'x', guns: { port: 'light_6' as const, starboard: 'light_6' as const }, modules: {} };
  const mk = (ranks: TalentRanks): SailParams => {
    const st = computeShipStats(lo, 'navigator', ranks);
    return { rig: st.rig, maxSpeed: st.maxSpeed, accel: st.accel, turnRate: st.turnRate, noGoDeg: st.noGoDeg, sailChangeRate: st.sailChangeRate, currentMul: 0, sailHealth: 1, rudderHealth: 1, crewFactor: 1, loadFactor: 1, speedMul: 1, personalWind: false, weatherly: false, talent: sailTalents(st) };
  };
  const state = { x: 0, y: 0, heading: 0, speed: 0, sail: 1, rudder: 0 };
  const beat = { dir: Math.PI + 0.9, strength: 0.6 }; // close-hauled
  assert.ok(targetSpeed(state, mk({ nav_master_of_sail: 2 }), beat) > targetSpeed(state, mk({}), beat));
  const storm = { dir: Math.PI / 2, strength: 1.1 }, calm = { dir: Math.PI / 2, strength: 0.25 };
  assert.ok(targetSpeed(state, mk({ nav_storm_rider: 1 }), storm) > targetSpeed(state, mk({}), storm) * 1.15);
  assert.ok(targetSpeed(state, mk({ nav_storm_rider: 1 }), calm) < targetSpeed(state, mk({}), calm) * 0.75);
  assert.ok(targetSpeed(state, mk({ nav_sea_legs: 2 }), storm) > targetSpeed(state, mk({}), storm), 'Sea Legs');
  // Sweeps: a schooner head to wind rows at about 2 kn instead of lying in irons.
  const dead = { dir: Math.PI, strength: 0.5 }; // wind from the north, bow north
  let s = { ...state, heading: 0 };
  for (let i = 0; i < 400; i++) s = stepSailing(s, { rudder: 0, sailTarget: 1 }, mk({ nav_sweeps: 1 }), dead, { x: 0, y: 0 }, 0.05);
  assert.ok(s.speed > 1.8, `rowing ${s.speed}`);
  let n = { ...state, heading: 0 };
  for (let i = 0; i < 400; i++) n = stepSailing(n, { rudder: 0, sailTarget: 1 }, mk({}), dead, { x: 0, y: 0 }, 0.05);
  assert.ok(s.speed > n.speed + 0.8, `oars ${s.speed} vs drifting ${n.speed}`);
});

// ------------------------------------------------------------------ progression

test('progression: deeds add points (16 count), respec modes, tokens at level 20', () => {
  const { game } = makeGame();
  const c = join(game, 'Deed Doer');
  const s = [...game.sessions][0];
  const p = s.profile!;
  p.level = 10;
  const pts0 = game.talentPoints(p);
  grantDeed(game, s, 'deed_last_plank');
  grantDeed(game, s, 'deed_last_plank');
  assert.equal(game.talentPoints(p), pts0 + 1, 'a deed is one point, once');
  for (const d of ['deed_ice_edge', 'deed_first_prize', 'deed_ship_of_the_line', 'deed_hundred_wrecks', 'deed_convoy_breaker', 'deed_captain_killer', 'deed_hundred_thousand', 'deed_grand_circuit', 'deed_fog_courier', 'deed_ledger_partner', 'deed_black_flag_oath', 'deed_whispering_chart', 'deed_expanse_crossing', 'deed_legendary_hoard', 'deed_leviathan_slain', 'deed_harpoon_contracts', 'deed_black_storm']) grantDeed(game, s, d);
  assert.equal(game.talentPoints(p), p.level - 1 + 16, 'only 16 deeds count');
  // Below 20 respec is free.
  c.push({ t: 'learn_talent', id: 'nav_close_hauled' });
  c.push({ t: 'learn_talent', id: 'nav_close_hauled' });
  assert.equal(p.talents.nav_close_hauled, 2);
  const g0 = p.gold;
  c.push({ t: 'respec', mode: 'full' });
  assert.equal(Object.keys(p.talents).length, 0);
  assert.equal(p.gold, g0);
  // Level 20: a token and paid respecs.
  game.grantXp(s, 1e7, null);
  assert.ok(p.level >= 20);
  assert.ok(p.tokens >= 1, 'Clean Logbook token at level 20');
  c.push({ t: 'learn_talent', id: 'gun_range_finder' });
  c.push({ t: 'learn_talent', id: 'nav_close_hauled' });
  p.gold = 1e6;
  // Forget a lesson: free in the native trees of a corsair (gunnery, navigation).
  c.push({ t: 'respec', mode: 'forget', id: 'gun_range_finder' });
  assert.equal(p.talents.gun_range_finder, undefined);
  assert.equal(p.gold, 1e6);
  // Clean slate: paid, then on cooldown; a token ignores the cooldown.
  c.push({ t: 'respec', mode: 'full' });
  assert.equal(p.gold, 1e6 - 20 * p.level * p.level);
  c.push({ t: 'learn_talent', id: 'nav_close_hauled' });
  c.push({ t: 'respec', mode: 'full' });
  assert.equal(p.talents.nav_close_hauled, 1, 'clean slate is on cooldown');
  const tokens = p.tokens;
  c.push({ t: 'respec', mode: 'token' });
  assert.equal(p.tokens, tokens - 1);
  assert.equal(Object.keys(p.talents).length, 0);
});

test('loadouts: two slots at 20, switch in port with a cooldown, pools keep their share', () => {
  const { game } = makeGame();
  const c = join(game, 'Two Faced');
  const s = [...game.sessions][0];
  const p = s.profile!;
  game.grantXp(s, 3e6, null);
  assert.ok(p.level >= 20);
  c.push({ t: 'learn_talent', id: 'srv_iron_hull' });
  c.push({ t: 'learn_talent', id: 'srv_iron_hull' });
  const ship = s.ship!;
  ship.hull = Math.round(ship.stats.hullMax / 2);
  c.push({ t: 'loadout', slot: 1 });
  assert.equal(p.activeLoadout, 1);
  assert.deepEqual(p.talents, {});
  assert.equal(p.loadouts[0].srv_iron_hull, 2, 'first build stored');
  assert.ok(Math.abs(ship.hull / ship.stats.hullMax - 0.5) < 0.01, 'hull keeps its share');
  c.push({ t: 'loadout', slot: 0 });
  assert.equal(p.activeLoadout, 1, 'cooldown');
  p.loadoutSwitchAt = 0;
  // An Honest Merchant build cannot sail with contraband aboard.
  p.loadouts[0] = { ...p.loadouts[0] };
  ship.cargo.dreamleaf = 2;
  p.loadouts[0] = { trd_haggler: 3, trd_packer: 2, trd_honest_merchant: 1 };
  c.push({ t: 'loadout', slot: 0 });
  assert.equal(p.activeLoadout, 1);
  delete ship.cargo.dreamleaf;
  c.push({ t: 'loadout', slot: 0 });
  assert.equal(p.activeLoadout, 0);
  assert.equal(p.talents.trd_honest_merchant, 1);
});

test('deeds from the world: Last Plank on docking, Ice Edge, Grand Circuit', () => {
  const { game } = makeGame();
  const { s, ship, c } = atSea(game, 'Deep North');
  ship.state.x = 32000;
  ship.state.y = 3000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  steps(game, 25);
  assert.ok(s.profile!.deeds.includes('deed_ice_edge'));
  const port = game.world.ports[0];
  ship.hull = ship.stats.hullMax * 0.03;
  (game as unknown as { dockShip(s: PlayerSession, p: typeof port): void }).dockShip(s, port);
  assert.ok(s.profile!.deeds.includes('deed_last_plank'));
  s.profile!.deedState.voyagePorts = ['a', 'b', 'c', 'd', 'e'];
  ship.cargo.salt = 5;
  c.push({ t: 'trade', good: 'salt', qty: -5 });
  assert.ok(s.profile!.deeds.includes('deed_grand_circuit'));
});

// ------------------------------------------------------------------ situational navigation talents

test('Weather Gauge and Stolen Wind: holding the wind speeds you and steals hers', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Gauge Holder');
  setTalents(game, s, { ...fullNav() });
  // Contested Gravewater: pirates attack on sight there.
  ship.state.x = 56000;
  ship.state.y = 70000;
  ship.region = game.regionAt(ship.state.x, ship.state.y);
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const wind = game.windFor(ship);
  const v = headingVec(wind.dir); // downwind
  const npc = game.spawnNpcShip('pirate', 'fluyt', 'confederacy', ship.state.x + v.x * 200, ship.state.y + v.y * 200, 0);
  game.npcs.delete(npc.id);
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  const hostile = game.isHostile(npc, ship);
  assert.ok(hostile, 'pirates are hostile');
  steps(game, 25);
  assert.ok(ship.hasEffect('weather_gauge'));
  assert.ok(npc.hasEffect('stolen_wind'));
});

test('Serpentine: shot aimed at a ship slewing hard under rudder can fall wide', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Snake');
  const npc = enemyAbeam(game, ship, 150, 'brig');
  npc.state.heading = ship.state.heading + Math.PI; // our side faces her side
  // An evasion of 100% makes every ball miss while the helm is hard over.
  ship.addEffect({ id: 'test_evasion', until: game.now + 999, mods: { evasion: 1 } }, game.now);
  ship.state.rudder = 1;
  ship.input.rudder = 1;
  const hull0 = ship.hull;
  npc.reload.port = 0;
  npc.reload.starboard = 0;
  fireBroadside(game, npc, 'port', 150);
  fireBroadside(game, npc, 'starboard', 150);
  steps(game, 60);
  assert.equal(ship.hull, hull0);
});

test('actives: Spill the Wind and Anchor Pivot with cooldowns', () => {
  const { game } = makeGame();
  const { s, ship, c } = atSea(game, 'Pivot Pat');
  setTalents(game, s, fullNav());
  ship.state.speed = 8;
  c.push({ t: 'talent_active', id: 'nav_spill_the_wind' });
  assert.ok(ship.state.speed <= 4.01 && ship.hasEffect('spill_turn'));
  c.push({ t: 'talent_active', id: 'nav_spill_the_wind' });
  assert.ok(c.all('toast').some((t) => /not ready/.test(t.msg)));
  ship.state.speed = 8;
  const h0 = ship.state.heading;
  ship.input = { rudder: 0.5, sailTarget: 1 };
  c.push({ t: 'talent_active', id: 'nav_anchor_pivot' });
  ship.input = { rudder: 0, sailTarget: 0 };
  steps(game, 60);
  assert.ok(ship.state.speed < 2, 'stopped dead');
  const turned = Math.abs(((ship.state.heading - h0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert.ok(turned > Math.PI * 0.6, `pivoted ${turned}`);
});

// ------------------------------------------------------------------ gunnery talents

test('Red-Hot Barrels: fast reloads build heat until a gun bursts', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Hot Hands');
  setTalents(game, s, { gun_red_hot_barrels: 1 });
  ship.ammo.round = 500;
  let burst = false;
  for (let i = 0; i < 12 && !burst; i++) {
    ship.reload.port = 0;
    fireBroadside(game, ship, 'port', 200);
    burst = ship.gunsDisabled.port > 0;
  }
  assert.ok(burst, 'a gun burst');
  assert.equal(ship.heat.port, 50);
});

test('Thunderous Broadside and Spotter: every ball home stuns; three volleys range in', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Thunder');
  setTalents(game, s, { gun_thunder_broadside: 1, gun_spotter: 1 });
  ship.loadout = { ...ship.loadout, classId: 'brig' };
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.ammo.round = 500;
  ship.addEffect({ id: 'test_aim', until: game.now + 999, mods: { spreadMul: -0.95 } }, game.now);
  const npc = enemyAbeam(game, ship, 120, 'brig');
  npc.hull = 1e6;
  for (let i = 0; i < 3; i++) {
    ship.reload.starboard = 0;
    fireBroadside(game, ship, 'starboard', 120);
    steps(game, 40);
  }
  assert.ok(npc.hasEffect('stunned_crew'), 'stunned');
  assert.ok(npc.hasEffect('ranged_in'), 'ranged in');
});

test('Mast Breaker, Waterline breach, Swivel Guns, Quick Swap', () => {
  const { game } = makeGame();
  const { s, ship, c } = atSea(game, 'Rigger');
  setTalents(game, s, { gun_swivel_guns: 2, gun_quick_swap: 2 });
  ship.addEffect({ id: 'test', until: game.now + 999, mods: { mastBreak: 1, breachChance: 1, spreadMul: -0.95 } }, game.now);
  ship.ammo.chain = 100;
  ship.ammo.round = 100;
  const npc = enemyAbeam(game, ship, 50);
  npc.hull = 1e6;
  npc.sails = npc.stats.sailHpMax * 0.3;
  ship.ammoSel = 'chain';
  ship.reload.starboard = 0;
  fireBroadside(game, ship, 'starboard', 50);
  steps(game, 30);
  assert.ok(npc.hasEffect('broken_mast'), 'mast down');
  const crew0 = npc.crew;
  steps(game, 20 * 9);
  assert.ok(npc.crew < crew0, 'swivels picked off sailors');
  ship.ammoSel = 'round';
  ship.reload.starboard = 0;
  fireBroadside(game, ship, 'starboard', 50);
  steps(game, 30);
  assert.ok(npc.hasEffect('breach'), 'breached');
  // Quick Swap: changing shot while loaded costs only a sliver of a reload.
  ship.reload.port = 0;
  c.push({ t: 'ammo', ammo: 'grape' });
  assert.ok(ship.reload.port > 0 && ship.reload.port < 3, `swap penalty ${ship.reload.port}`);
  assert.ok(ship.swapBonus);
});
