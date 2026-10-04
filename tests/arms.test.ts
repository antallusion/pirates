// The yard's wider trade (owner, 2026-10-03): a hundred new pieces of a ship's gear — guns, shot, fittings, deck
// mounts, figureheads, gear for her slots and the captain's, and two sets. Each does a thing of its own (no piece is a
// neighbour with bigger numbers), each is to be had somewhere (a yard by its rank and flag, the chandler, the sea's
// wrecks, a boss's hoard), each weighs about what its neighbours weigh, and each has a picture — painted, or a painted
// kindred standing in for it till its sheet is cut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AMMO, AMMO_IDS, GUNS, GUN_IDS, MODULES, MODULE_IDS, MOUNTS, MOUNT_IDS, SHIP_CLASSES, emptyAmmo } from '../shared/src/data/ships.ts';
import type { AmmoId, GunId, ModuleId, MountId } from '../shared/src/data/ships.ts';
import { FIGUREHEADS, carvedAt } from '../shared/src/data/shipbuild.ts';
import type { FigureheadId } from '../shared/src/data/shipbuild.ts';
import { CAPTAIN_SLOTS, ITEM_BASES, SETS, SET_IDS, SHIP_SLOTS, gearSource, setBonuses } from '../shared/src/data/items.ts';
import { BOARDED_SLOTS, SUNK_SLOTS } from '../server/src/game/gear.ts';
import type { Item, Slot } from '../shared/src/data/items.ts';
import { ITEM_ART } from '../shared/src/data/itemart.ts';
import { ARMS_ART, ICON_STAND_IN } from '../shared/src/data/armsart.ts';
import { BOSSES } from '../shared/src/data/bosses.ts';
import { KEY_PORTS } from '../shared/src/world/regions.ts';
import { computeShipStats, tx } from '../shared/src/sim/shipstats.ts';
import type { ShipLoadout } from '../shared/src/sim/shipstats.ts';
import { fireBroadside, stepProjectiles } from '../server/src/game/combat.ts';
import { fireMount } from '../server/src/game/mounts.ts';
import { stepStrikes } from '../server/src/game/abilities.ts';
import { stepTalents } from '../server/src/game/talentfx.ts';
import { ammoPrice, buildPortView, castHere, fitsHere, shipyardGuns, shipyardModule } from '../server/src/game/ports.ts';
import { buyFigurehead } from '../server/src/game/shipbuilding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame } from './helpers.ts';

// What there was before (the strictness of the art stays with these: each is painted).
const OLD_GUNS = ['light_6', 'long_9', 'medium_12', 'heavy_18', 'carronade_24'];
const OLD_AMMO = ['round', 'chain', 'grape', 'incendiary', 'heavy', 'cursed'];
const OLD_MODULES = ['hull_plating', 'sail_plan', 'rudder', 'hold_expansion', 'crew_quarters', 'figurehead_kraken', 'ghost_timbers', 'choir_bell', 'lightning_rod', 'false_bulwark', 'bone_culverin', 'kraken_beak', 'lantern_cannon', 'serpent_scale', 'crown_old_pattern', 'galleass_sweeps', 'storm_glass', 'lantern_gland'];
const OLD_MOUNTS = ['mortar', 'harpoon', 'chain_gun', 'abyssal_lance', 'fire_charge'];
const OLD_FIGUREHEADS = ['fh_crown_lion', 'fh_red_devil', 'fh_weeping_widow', 'fh_fog_owl', 'fh_harpooneer', 'fh_gilded_scale', 'fh_drowned_man', 'fh_serpent', 'fh_saint_of_wrecks', 'fh_white_orca', 'fh_dutchman'];
const OLD_SETS = ['bounty_hunter', 'whaler', 'fisher', 'league', 'sea_terror', 'admiralty', 'drowned', 'storm'];
const OLD_BASES = ITEM_ART.slice(0, 64).map((r) => r[0]).filter((id) => ITEM_BASES[id]);

const fresh = <T extends string>(all: readonly T[], old: string[]) => all.filter((x) => !old.includes(x));
const NEW_GUNS = fresh(GUN_IDS, OLD_GUNS);
const NEW_AMMO = fresh(AMMO_IDS, OLD_AMMO);
const NEW_MODULES = fresh(MODULE_IDS, OLD_MODULES);
const NEW_MOUNTS = fresh(MOUNT_IDS, OLD_MOUNTS);
const NEW_FIGUREHEADS = fresh(Object.keys(FIGUREHEADS) as FigureheadId[], OLD_FIGUREHEADS);
const NEW_SETS = fresh(SET_IDS, OLD_SETS);
const NEW_BASES = fresh(Object.keys(ITEM_BASES), OLD_BASES);

const ROOT = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8')) as { assets: Record<string, { local: string }> };
const baked = (id: string) => !!manifest.assets[id] && fs.existsSync(path.join(ROOT, 'assets', manifest.assets[id].local));

test('a hundred new pieces: guns, shot, fittings, mounts, figureheads, gear and two sets', () => {
  assert.deepEqual([NEW_GUNS.length, NEW_AMMO.length, NEW_MODULES.length, NEW_MOUNTS.length, NEW_FIGUREHEADS.length, NEW_BASES.length, NEW_SETS.length], [8, 6, 24, 8, 14, 40, 2]);
  // The old shot keeps its place on the wire and under the keys 1–5.
  assert.deepEqual(AMMO_IDS.slice(0, 6), OLD_AMMO);
  assert.deepEqual(Object.keys(emptyAmmo()).sort(), [...AMMO_IDS].sort());
  // Some of the fittings are plans out of the bosses' hoards; the rest any yard of the rank fits.
  assert.equal(NEW_MODULES.filter((m) => MODULES[m].blueprint).length, 9);
  // The gear goes mostly to her slots, some to the captain's.
  const ship = NEW_BASES.filter((b) => (SHIP_SLOTS as string[]).includes(ITEM_BASES[b].slot)).length;
  assert.ok(ship > NEW_BASES.length / 2 && NEW_BASES.length - ship >= 10, `${ship} for her, ${NEW_BASES.length - ship} for the captain`);
});

test('no piece is a neighbour with bigger numbers: each does a thing of its own', () => {
  // Guns: a gun with a trade of its own (pierce, shatter, shells…) stands apart; among the plain ones of a rank none is
  // as good or better on every count.
  const trade = (g: GunId) => ['pierce', 'crewMul', 'sailMul', 'fire', 'dismount', 'morale', 'monster', 'shotSpeed'].some((k) => k in GUNS[g]);
  const plain = GUN_IDS.filter((g) => !trade(g));
  for (const a of plain) for (const b of plain) {
    if (a === b || GUNS[a].minTier !== GUNS[b].minTier) continue;
    const A = GUNS[a], B = GUNS[b];
    const dominates = A.damage / A.reload >= B.damage / B.reload && A.range >= B.range && A.spreadDeg <= B.spreadDeg && A.weight <= B.weight && A.crewPerGun <= B.crewPerGun;
    assert.ok(!dominates, `${a} is ${b} with bigger numbers`);
  }
  assert.ok(NEW_GUNS.filter(trade).length >= 7, 'all but the little minion have a trade of their own');
  // Shot, fittings, figureheads, gear: the lines of each new piece are its own.
  const sigAmmo = (a: AmmoId) => JSON.stringify([AMMO[a].hullMul, AMMO[a].sailMul, AMMO[a].crewKill, AMMO[a].rangeMul]);
  for (const a of NEW_AMMO) assert.equal(AMMO_IDS.filter((b) => sigAmmo(b) === sigAmmo(a)).length, 1, a);
  assert.equal(Math.max(...AMMO_IDS.map((a) => AMMO[a].rangeMul)), AMMO.long_shot.rangeMul, 'long shot reaches furthest');
  const sigMod = (m: ModuleId) => [...Object.keys(MODULES[m].perLevel), ...Object.keys(MODULES[m].mods ?? {}), ...(MODULES[m].flags ?? [])].sort().join();
  for (const m of NEW_MODULES) {
    assert.ok(sigMod(m), `${m} does something`);
    assert.equal(MODULE_IDS.filter((n) => sigMod(n) === sigMod(m)).length, 1, `${m} does what another fitting does`);
  }
  const sigFh = (f: FigureheadId) => [...Object.keys(FIGUREHEADS[f].mods), ...(FIGUREHEADS[f].flags ?? [])].sort().join();
  for (const f of NEW_FIGUREHEADS) assert.equal((Object.keys(FIGUREHEADS) as FigureheadId[]).filter((g) => sigFh(g) === sigFh(f)).length, 1, f);
  const sigBase = (id: string) => [...Object.keys(ITEM_BASES[id].main ?? {}), ...Object.keys(ITEM_BASES[id].cap ?? {})].sort().join();
  for (const b of NEW_BASES) {
    const slot = ITEM_BASES[b].slot;
    assert.equal(Object.keys(ITEM_BASES).filter((x) => ITEM_BASES[x].slot === slot && sigBase(x) === sigBase(b)).length, 1, `${b}: its lines are another ${slot}'s`);
  }
});

test('each weighs about what its neighbours weigh', () => {
  // Guns: a long gun's weight of shot a second stays near the 18-pounder's (the rank above it a little more).
  const dps = (g: GunId) => GUNS[g].damage / GUNS[g].reload;
  for (const g of GUN_IDS.filter((x) => GUNS[x].range >= 300)) assert.ok(dps(g) <= dps('heavy_18') * (1 + 0.15 * Math.max(0, GUNS[g].minTier - 3)) + 1e-9, `${g}: ${dps(g).toFixed(2)}`);
  for (const g of NEW_GUNS) assert.ok(dps(g) >= dps('long_9') * 0.6 && GUNS[g].price >= 200 && GUNS[g].price <= 3600, g);
  // The carvers' figures cost what the old ones do; a captain's piece carries five points, three beside a ship's line.
  for (const f of NEW_FIGUREHEADS) if (FIGUREHEADS[f].port) assert.ok(FIGUREHEADS[f].price >= 600 && FIGUREHEADS[f].price <= 1200, f);
  for (const b of Object.keys(ITEM_BASES)) {
    const it = ITEM_BASES[b];
    if (!(CAPTAIN_SLOTS as string[]).includes(it.slot)) continue;
    const pts = Object.values(it.cap ?? {}).reduce((x, y) => x + (y ?? 0), 0);
    assert.ok(pts <= (it.main ? 3 : 5), `${b}: ${pts} points`);
  }
  // Fittings and mounts: the yard's prices of their kind.
  for (const m of NEW_MODULES) assert.ok(MODULES[m].blueprint ? MODULES[m].baseCost >= 2600 && MODULES[m].baseCost <= 4000 : MODULES[m].baseCost >= 500 && MODULES[m].baseCost <= 1500, m);
  for (const m of NEW_MOUNTS) assert.ok(MOUNTS[m].price >= 1000 && MOUNTS[m].price <= 3600 && MOUNTS[m].reload >= 9, m);
});

test('each is to be had: a yard by its rank and flag, the chandler, the sea, a boss', () => {
  const { game } = makeGame();
  const ports = KEY_PORTS.map((p) => game.portById(p.id)!);
  const hulls = Object.values(SHIP_CLASSES).filter((c) => c.purchasable);
  for (const g of NEW_GUNS) assert.ok(ports.some((p) => Math.max(1, p.shipyardTier) >= GUNS[g].minTier && castHere(p, g)) && hulls.some((c) => c.tier >= GUNS[g].minTier), `${g}: cast nowhere`);
  for (const a of NEW_AMMO) assert.ok(ports.some((p) => ammoPrice(game, p, a) > 0), `${a}: sold nowhere`);
  // The rarer shot is not sold everywhere: where its trade is.
  const at = (id: string) => game.portById(id)!;
  assert.equal(ammoPrice(game, at('saltmarrow'), 'salt'), 0);
  assert.ok(ammoPrice(game, at('saint_maw'), 'salt') > 0 && ammoPrice(game, at('harpoon_rest'), 'salt') > 0);
  assert.equal(ammoPrice(game, at('gravesend'), 'stinkpot'), 0);
  assert.ok(ammoPrice(game, at('fogmouth'), 'stinkpot') > 0, 'a black market sells stinkpots');
  assert.equal(ammoPrice(game, at('saltmarrow'), 'star'), 0);
  assert.ok(ammoPrice(game, at('saltmarrow'), 'bar') > 0, 'bar shot everywhere');
  for (const m of NEW_MODULES) {
    if (MODULES[m].blueprint) assert.ok(Object.values(BOSSES).some((b) => b.rare.some((r) => r.kind === 'module' && r.id === m)), `${m}: no boss holds the plans`);
    else assert.ok(ports.some((p) => p.shipyardTier >= (MODULES[m].yard ?? 0)), m);
  }
  const c = join(game, 'Fitter Fen');
  const s = game.sessionByName('Fitter Fen')!;
  const ship = s.ship!;
  for (const m of NEW_MOUNTS) {
    ship.loadout.classId = 'brig';
    ship.recompute(game.now);
    assert.ok(ports.some((p) => buildPortView(game, s, p).shipyard.mounts.some((o) => o.mount === m)), `${m}: no yard fits it`);
  }
  void c;
  for (const f of NEW_FIGUREHEADS) {
    const fh = FIGUREHEADS[f];
    assert.ok(fh.port ? carvedAt(fh.port).includes(f) : Object.values(BOSSES).some((b) => b.rare.some((r) => r.kind === 'figurehead' && r.id === f)), `${f}: neither carved nor taken`);
  }
  // Every port has a carver, and most two.
  for (const p of ports) assert.ok(carvedAt(p.id).length >= 1, p.id);
  // Gear: the chandler sells some of each kind; everything but tackle is found at sea (gear.ts rollDrop): the ship's
  // in the wrecks the guns leave, the captain's aboard a ship taken by boarding (docs/21 §5).
  const sold = NEW_BASES.filter((b) => ITEM_BASES[b].sold);
  assert.ok(sold.some((b) => (SHIP_SLOTS as string[]).includes(ITEM_BASES[b].slot)) && sold.some((b) => (CAPTAIN_SLOTS as string[]).includes(ITEM_BASES[b].slot)));
  const found = new Set<Slot>([...SUNK_SLOTS, ...BOARDED_SLOTS]);
  assert.deepEqual([...found].sort(), [...SHIP_SLOTS.filter((x) => x !== 'tackle'), ...CAPTAIN_SLOTS].sort());
  for (const b of NEW_BASES) assert.ok(found.has(ITEM_BASES[b].slot), b);
});

test('each has a picture: painted, or a painted kindred standing in till its sheet is cut', () => {
  const icons = [
    ...GUN_IDS.map((g) => `icon.gun_${g}`), ...AMMO_IDS.map((a) => `icon.ammo_${a}`), ...MODULE_IDS.map((m) => `icon.mod_${m}`), ...MOUNT_IDS.map((m) => `icon.mount_${m}`),
    ...Object.keys(FIGUREHEADS).map((f) => `icon.${f}`), ...SET_IDS.map((x) => `icon.set_${x}`), ...Object.keys(ITEM_BASES).map((b) => `icon.item_${b}`),
  ];
  for (const id of icons) assert.ok(baked(id) || (ICON_STAND_IN[id] && baked(ICON_STAND_IN[id])), `${id}: neither painted nor stood in for`);
  // What was painted before stays painted: no stand-in for it.
  const old = [...OLD_GUNS.map((g) => `icon.gun_${g}`), ...OLD_AMMO.map((a) => `icon.ammo_${a}`), ...OLD_MODULES.map((m) => `icon.mod_${m}`), ...OLD_MOUNTS.map((m) => `icon.mount_${m}`), ...OLD_FIGUREHEADS.map((f) => `icon.${f}`), ...OLD_SETS.map((x) => `icon.set_${x}`), ...OLD_BASES.map((b) => `icon.item_${b}`)];
  for (const id of old) assert.ok(baked(id) && !ICON_STAND_IN[id], id);
  // Every stand-in is a painted icon; the painter's list (sheets of sixteen) holds every new icon once, with its look.
  for (const [id, stand] of Object.entries(ICON_STAND_IN)) assert.ok(baked(stand), `${id} → ${stand}`);
  const listed = [...ARMS_ART.map((r) => r[0]), ...ITEM_ART.slice(64).map((r) => `icon.item_${r[0]}`)];
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual([...listed].sort(), icons.filter((id) => !old.includes(id)).sort());
  for (const [, , look] of ARMS_ART) assert.ok(look.length > 20 && !/\b(text|letters?|blood|skull|skeleton)\b/i.test(look), look);
});

// ------------------------------------------------------------------------------------------------ at work

/** A ship lying to in open water, her keel north–south, her hold and cargo bare (no powder to go up). */
function target(game: Game, role: 'merchant' | 'patrol' | 'ghost' | 'pirate', classId: 'fluyt' | 'frigate' | 'brig', x = 40000, y = 40000): ShipEntity {
  const t = game.spawnNpcShip(role, classId, role === 'pirate' ? 'confederacy' : 'league', x, y, 0);
  game.npcs.delete(t.id);
  t.input = { rudder: 0, sailTarget: 0 };
  t.state.speed = 0;
  t.cargo = {};
  t.ammo = emptyAmmo();
  t.protectedUntil = 0;
  game.grid.upsert(t.id, t.state.x, t.state.y);
  return t;
}

/** One ball from abeam (from the east, flying west), `along` metres toward her stern. */
function shoot(game: Game, t: ShipEntity, ammo: AmmoId, gun?: GunId, along = 0, damage = 80): void {
  game.projectiles.push({ owner: 0, x: t.state.x + 40, y: t.state.y + along, heading: -Math.PI / 2, speed: 3000, dist: 80, traveled: 0, ammo, damage, maxRange: 1000, delay: 0, gun });
  stepProjectiles(game, 0.05);
}

function atSea(game: Game, name: string): { s: NonNullable<ReturnType<Game['sessionByName']>>; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { s, ship };
}

test('the guns at work: pierce, stone, shells, the gunbreaker, the bomb-lance, the culverin', () => {
  const { game } = makeGame();
  const t = target(game, 'patrol', 'frigate');
  const hull = (ammo: AmmoId, gun?: GunId) => {
    t.hull = t.stats.hullMax;
    shoot(game, t, ammo, gun);
    return t.stats.hullMax - t.hull;
  };
  const sails = (gun?: GunId) => {
    t.sails = t.stats.sailHpMax;
    shoot(game, t, 'round', gun);
    return t.stats.sailHpMax - t.sails;
  };
  assert.ok(t.stats.armor > 0.1);
  assert.ok(hull('round', 'demi_cannon_32') > hull('round', 'heavy_18') * 1.04, 'the demi-cannon goes through a quarter of her armour');
  assert.ok(Math.abs(sails('perrier') / sails('heavy_18') - 1.5) < 0.01, 'stone shot tears canvas half again');
  // A shell gun's ball sets her afire now and then; a plain gun's round shot never.
  const fires = (gun: GunId) => {
    let n = 0;
    for (let i = 0; i < 200; i++) {
      t.effects = t.effects.filter((e) => e.id !== 'fire');
      t.hull = t.stats.hullMax;
      shoot(game, t, 'round', gun);
      if (t.hasEffect('fire')) n++;
    }
    return n;
  };
  assert.equal(fires('heavy_18'), 0);
  assert.ok(fires('shell_gun') > 0, 'shells start fires');
  // The gunbreaker dismounts a gun three times as often.
  const dismounts = (gun: GunId) => {
    let n = 0;
    for (let i = 0; i < 300; i++) {
      t.gunsDisabled = { port: 0, starboard: 0 };
      t.hull = t.stats.hullMax;
      shoot(game, t, 'round', gun);
      n += t.gunsDisabled.port + t.gunsDisabled.starboard;
    }
    return n;
  };
  const gb = dismounts('gunbreaker_14'), hv = dismounts('heavy_18');
  assert.ok(gb > hv + 15, `gunbreaker ${gb}, 18-pounder ${hv}`);
  // The bomb-lance gun and blessed salt: against the dead half again a plain gun's round shot; salt is weak on oak.
  const ghost = target(game, 'ghost', 'brig', 42000, 40000);
  const on = (ship: ShipEntity, ammo: AmmoId, gun?: GunId) => {
    ship.hull = ship.stats.hullMax;
    shoot(game, ship, ammo, gun);
    return ship.stats.hullMax - ship.hull;
  };
  assert.ok(Math.abs(on(ghost, 'round', 'whaling_gun') / on(ghost, 'round', 'heavy_18') - 1.5) < 0.02);
  assert.ok(Math.abs(on(t, 'round', 'whaling_gun') / on(t, 'round', 'heavy_18') - 1) < 0.02);
  assert.ok(Math.abs(on(ghost, 'salt') / on(ghost, 'round') - 1.5) < 0.02, 'salt on the dead');
  assert.ok(Math.abs(on(t, 'salt') / on(t, 'round') - 0.6) < 0.02, 'salt on a ship');
  // The culverin's ball flies a quarter faster than a long gun's.
  const { ship } = atSea(game, 'Gunner Gil');
  ship.ammo.round = 100;
  const speed = (gun: GunId) => {
    ship.loadout.guns.port = gun;
    ship.reload.port = 0;
    ship.recompute(game.now);
    const n = game.projectiles.length;
    assert.equal(fireBroadside(game, ship, 'port', 300), null);
    return game.projectiles[n].speed;
  };
  assert.ok(Math.abs(speed('culverin_8') / speed('long_9') - 1.25) < 1e-9);
});

test('the rarer shot at work: a star lights her, a stinkpot chokes her guns, a drag hook slows her, bar fouls her rudder', () => {
  const { game } = makeGame();
  const t = target(game, 'merchant', 'fluyt');
  t.addEffect({ id: 'shadow', until: game.now + 30, flags: ['hidden'] }, game.now);
  assert.ok(t.hasFlag('hidden'));
  shoot(game, t, 'star');
  assert.ok(t.hasEffect('starlit') && t.hasEffect('ranged_in') && !t.hasFlag('hidden'), 'lit up, and nothing hides her');
  const reload = t.stats.reloadMul, way = t.stats.maxSpeed;
  shoot(game, t, 'stinkpot');
  assert.ok(Math.abs(t.stats.reloadMul - reload - 0.3) < 1e-9, 'her reloads 30% slower');
  shoot(game, t, 'drag');
  assert.ok(t.stats.maxSpeed < way * 0.9, 'dragging a hook');
  // Bar shot astern fouls the rudder twice as often as round shot.
  const fouls = (ammo: AmmoId) => {
    let n = 0;
    for (let i = 0; i < 300; i++) {
      t.rudderHp = 1;
      t.hull = t.stats.hullMax;
      shoot(game, t, ammo, undefined, t.stats.length * 0.42);
      if (t.rudderHp < 1) n++;
    }
    return n;
  };
  const bar = fouls('bar'), round = fouls('round');
  assert.ok(bar > round * 1.4, `bar ${bar}, round ${round}`);
});

test('the new deck mounts at work', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Pivot Pia');
  const fit = (m: MountId) => {
    ship.loadout.mount = m;
    ship.mountReload = 0;
  };
  // The musketoons take grape from the hold, three balls a blast.
  fit('swivel_gun');
  ship.ammo.grape = 1;
  assert.equal(fireMount(game, ship, ship.state.x + 150, ship.state.y), 'The musketoons need grapeshot');
  ship.ammo.grape = 10;
  let n = game.projectiles.length;
  assert.equal(fireMount(game, ship, ship.state.x + 150, ship.state.y), null);
  assert.equal(ship.ammo.grape, 8);
  assert.equal(game.projectiles.length - n, 3);
  // The Long Tom: one heavy ball, far out, of round shot.
  fit('long_tom');
  ship.ammo.round = 3;
  n = game.projectiles.length;
  assert.equal(fireMount(game, ship, ship.state.x + 600, ship.state.y), null);
  assert.equal(ship.ammo.round, 2);
  assert.ok(Math.abs(game.projectiles[n].damage - 130 * ship.stats.gunDamageMul) < 1e-9);
  // Rockets: six over a point, not under 200 m; they strike and now and then set a ship afire.
  fit('rocket_frame');
  assert.match(fireMount(game, ship, ship.state.x + 100, ship.state.y) ?? '', /Too close/);
  const prey = target(game, 'merchant', 'fluyt', ship.state.x, ship.state.y - 450);
  let burnt = false, hurt = false;
  for (let i = 0; i < 12 && !burnt; i++) {
    ship.mountReload = 0;
    prey.hull = prey.stats.hullMax;
    assert.equal(fireMount(game, ship, prey.state.x, prey.state.y), null);
    const st = game.strikes.at(-1)!;
    assert.equal(st.shells, 6);
    st.at = game.now;
    st.radius = 4; // every rocket on her
    stepStrikes(game);
    hurt ||= prey.hull < prey.stats.hullMax;
    burnt = prey.hasEffect('fire');
  }
  assert.ok(hurt && burnt, 'rockets struck and set her afire');
  // The fire siphon: whale oil from the hold, a cone of fire close aboard.
  fit('fire_siphon');
  const near = target(game, 'merchant', 'fluyt', ship.state.x, ship.state.y - 90);
  assert.match(fireMount(game, ship, near.state.x, near.state.y) ?? '', /whale oil/);
  ship.cargo.whale_oil = 3;
  assert.equal(fireMount(game, ship, near.state.x, near.state.y), null);
  assert.ok(near.hasEffect('fire') && near.hull < near.stats.hullMax, 'burning');
  assert.equal(ship.cargo.whale_oil, 1);
  // The net thrower: her rigging fouled — slower, stiffer, unhurt.
  fit('net_thrower');
  const way = near.stats.maxSpeed, turn = near.stats.turnRate;
  assert.equal(fireMount(game, ship, near.state.x, near.state.y), null);
  assert.ok(near.hasEffect('netted') && near.stats.maxSpeed < way && near.stats.turnRate < turn);
  // Smoke pots: hidden, and the shot at her flies wide for a moment.
  fit('smoke_pots');
  assert.equal(fireMount(game, ship, ship.state.x, ship.state.y), null);
  assert.ok(ship.hasFlag('hidden') && ship.hasFlag('evasive'));
  // Kegs: two over the stern, of gunpowder from the hold.
  fit('powder_kegs');
  assert.match(fireMount(game, ship, ship.state.x, ship.state.y) ?? '', /gunpowder/);
  ship.cargo.gunpowder = 2;
  n = game.strikes.length;
  assert.equal(fireMount(game, ship, ship.state.x, ship.state.y), null);
  const kegs = game.strikes.slice(n);
  assert.equal(kegs.length, 2);
  assert.ok(kegs.every((k) => k.y > ship.state.y), 'astern (she heads north)');
  assert.equal(ship.cargo.gunpowder ?? 0, 0);
  // War drums: her crew's heart up, a foe's down.
  fit('war_drums');
  const foe = target(game, 'pirate', 'brig', ship.state.x + 200, ship.state.y);
  foe.attackers.set(ship.id, game.now); // shots already exchanged
  ship.attackers.set(foe.id, game.now);
  ship.morale = 50;
  foe.morale = 50;
  assert.ok(game.isHostile(foe, ship));
  assert.equal(fireMount(game, ship, ship.state.x, ship.state.y), null);
  assert.equal(ship.morale, 60);
  assert.equal(foe.morale, 44);
  assert.ok(ship.hasEffect('war_drums'));
});

test('the new fittings: their lines, the yards that fit them, the Kraken\'s ink', () => {
  const lo = (modules: ShipLoadout['modules']): ShipLoadout => ({ classId: 'brig', name: 'x', guns: { port: 'medium_12', starboard: 'medium_12' }, modules });
  const base = computeShipStats(lo({}), 'corsair', {});
  const st = computeShipStats(lo({ gun_carriages: 2, bilge_keels: 2, magazine_lining: 1, iron_masts: 1, leviathan_ribs: 1, serpent_spine: 1, mortar_bed: 1, chain_pumps: 2 }), 'corsair', {});
  assert.equal(tx(st, 'gunTrain'), 8);
  assert.equal(tx(st, 'seaPenalty'), -0.5);
  assert.equal(tx(st, 'turnDrag'), -0.3);
  assert.equal(tx(st, 'leakInflow'), -0.3);
  assert.equal(tx(st, 'bulkheads'), 1);
  assert.ok(['sealed_magazine', 'ironbound_masts', 'mortar_lore'].every((f) => st.flags.has(f as never)));
  assert.ok(st.hullMax > base.hullMax * 1.04 && st.turnRate > base.turnRate && st.maxSpeed < base.maxSpeed);
  // A small yard has no furnace for hot shot, nor a well for a mortar; a bigger one does. Plans only with the plans.
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Yard Yuri');
  s.profile!.gold = 1_000_000;
  const at = (id: string) => game.portById(id)!;
  const offered = (id: string) => buildPortView(game, s, at(id)).shipyard.modules.map((m) => m.module);
  assert.ok(!offered('saltmarrow').includes('shot_furnace') && offered('saltmarrow').includes('chain_pumps'));
  assert.ok(offered('blackwater').includes('shot_furnace'));
  assert.ok(!fitsHere(ship, at('saltmarrow'), 'mortar_bed'));
  assert.match(shipyardModule(game, s, at('saltmarrow'), 'shot_furnace') ?? '', /rank 2/);
  assert.ok(!offered('gravesend').includes('ink_sacs'));
  s.profile!.blueprints.push('ink_sacs');
  assert.ok(offered('gravesend').includes('ink_sacs'));
  // A faction's gun only in its yards.
  assert.ok(!castHere(at('saltmarrow'), 'perrier') && castHere(at('tidewrack'), 'perrier'));
  assert.match(shipyardGuns(game, s, at('saltmarrow'), 'port', 'perrier') ?? '', /does not cast/);
  // The Kraken's ink: low in the water, she is gone in a black cloud, once in two minutes.
  ship.loadout.modules.ink_sacs = 1;
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax * 0.2;
  stepTalents(game, ship);
  assert.ok(ship.hasEffect('ink_cloud') && ship.hasFlag('hidden') && ship.hasFlag('evasive'));
  ship.effects = ship.effects.filter((e) => e.id !== 'ink_cloud');
  stepTalents(game, ship);
  assert.ok(!ship.hasEffect('ink_cloud'), 'not again so soon');
});

test('figureheads: two carvers in a port, bought by name; the bosses give up theirs', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Carver Cass');
  s.profile!.gold = 100_000;
  const tide = game.portById('tidewrack')!;
  assert.deepEqual(buildPortView(game, s, tide).yard.figureheads.sort(), ['fh_jolly_jack', 'fh_weeping_widow']);
  assert.equal(buyFigurehead(game, s, tide, 'fh_doge'), 'That figurehead is carved elsewhere');
  assert.equal(buyFigurehead(game, s, tide, 'fh_jolly_jack'), null);
  assert.equal(ship.loadout.build?.figurehead, 'fh_jolly_jack');
  assert.ok(tx(ship.stats, 'grapeMorale') >= 0.4);
  assert.equal(buyFigurehead(game, s, tide), null, 'the first carver, unnamed');
  assert.equal(ship.loadout.build?.figurehead, 'fh_weeping_widow');
  // The found ones come from the bosses.
  const taken = Object.values(BOSSES).flatMap((b) => b.rare.filter((r) => r.kind === 'figurehead').map((r) => r.id));
  for (const f of ['fh_leviathan', 'fh_storm_widow', 'fh_hermit_crab', 'fh_hollow_admiral']) assert.ok(taken.includes(f as FigureheadId), f);
});

test('the new gear: its lines, the captain\'s pairings, the two new sets', () => {
  const item = (base: string, extra: Partial<Item> = {}): Item => ({ uid: 0, base, ilvl: 1, rarity: 0, affixes: [], dur: 100, ...extra });
  assert.equal(gearSource([item('studding_sails')]).mods.polarBoost, 0.08);
  const lateen = gearSource([item('lateen_sails')]).mods;
  assert.equal(lateen.noGoDeg, -2);
  assert.equal(lateen.maxSpeed, -0.01);
  assert.deepEqual(gearSource([item('officer_sabre')]).cap, { fencing: 3, leadership: 2 });
  // A ship's line on her stats: a stem shod in iron rams harder; the False Bottom now hides (it was found more often).
  const lo: ShipLoadout = { classId: 'brig', name: 'x', guns: { port: 'medium_12', starboard: 'medium_12' }, modules: {}, level: 4, gear: { plating: item('iron_stem'), hold: item('false_hold') } };
  const st = computeShipStats(lo, 'corsair', {});
  assert.ok(tx(st, 'ramDealt') > 0.1 && tx(st, 'ramTaken') < 0 && tx(st, 'hiddenSearch') < 0);
  // The sets: six pieces of the Master Gunner skip their shot; six of the Smuggler run dark.
  const pieces = (set: 'master_gunner' | 'smuggler') => (Object.keys(SETS[set].pieces) as Slot[]).map((slot) => item(Object.values(ITEM_BASES).find((b) => b.slot === slot)!.id, { rarity: 3, set }));
  assert.ok(setBonuses(pieces('master_gunner')).flags.includes('skipping_shot'));
  assert.ok(!setBonuses(pieces('master_gunner').slice(0, 4)).flags.includes('skipping_shot'));
  assert.ok(setBonuses(pieces('smuggler')).flags.includes('dark_lanterns'));
  assert.ok(setBonuses(pieces('smuggler').slice(0, 2)).mods.hiddenSearch! < 0);
});
