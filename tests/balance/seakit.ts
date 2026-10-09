// The sea table's bench (docs/25 §1.1, items 1–12 and 68): captains of each ⚓ built as a captain of her band builds
// (a gunnery-first talent build her points buy, artillery and armour as her hero's skills), bare, in gear of her level
// (rare pieces, seeded) or in full gear (the reference kit of shared/src/data/seabalance.ts), and the sea's own ships of
// her ⚓; broadsides fired and resolved by the game's own code (fireBroadside → stepProjectiles → resolveHit →
// applyDamage), lying still, beam on, at the close fight's distance, auto-fire's lay. Used by tools/balance-sea.ts and
// tests/balance/sea.test.ts. (Grown from the audit's scratch harness, qa-gt/capaudit-sea/lib.ts.)

import { closeRange } from '../../shared/src/data/gunnery.ts';
import { CAPTAIN_SLOTS, ITEM_BASES, SHIP_SLOTS, SLOT_OPENS, makeItem } from '../../shared/src/data/items.ts';
import type { Item, Rarity, ShipSlot, Slot } from '../../shared/src/data/items.ts';
import { armyForLevel } from '../../shared/src/data/army.ts';
import { referenceKit } from '../../shared/src/data/seabalance.ts';
import { canLearn } from '../../shared/src/data/talents.ts';
import type { TalentRanks } from '../../shared/src/data/talents.ts';
import { skillSeaMods } from '../../shared/src/data/hero.ts';
import type { SkillSlot } from '../../shared/src/data/hero.ts';
import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import type { GunId, ShipClassId } from '../../shared/src/data/ships.ts';
import type { CaptainId } from '../../shared/src/data/captains.ts';
import { refLevel } from '../../shared/src/data/xpcurve.ts';
import { Rng } from '../../shared/src/rng.ts';
import { runAdmin } from '../../server/src/game/admin.ts';
import { effectiveRange, fireBroadside, reloadTime, stepProjectiles } from '../../server/src/game/combat.ts';
import type { VolleyRec } from '../../server/src/game/combat.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { newBrain, engage } from '../../server/src/game/npc.ts';
import type { NpcBrain } from '../../server/src/game/npc.ts';
import type { PlayerSession } from '../../server/src/game/player.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { join } from '../helpers.ts';
import { CRAFT, duelSea, openWater } from './duel.ts';

export const ANCHORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const CAPTAINS: CaptainId[] = ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'];
export type Gear = 'bare' | 'level' | 'full';

/** The warship of her ⚓ (the sea's pirate line, the man-o'-war for ⚓9–10). */
export function refHull(anchor: number): ShipClassId {
  return (['sloop', 'sloop', 'sloop', 'schooner', 'brigantine', 'brig', 'brig', 'frigate', 'frigate', 'man_o_war', 'man_o_war'] as ShipClassId[])[anchor];
}
/** Her guns: the heaviest long gun her tier carries. */
export function refGun(cls: ShipClassId): GunId {
  const t = SHIP_CLASSES[cls].tier;
  return t >= 4 ? 'demi_cannon_32' : t >= 3 ? 'heavy_18' : t >= 2 ? 'medium_12' : 'light_6';
}

const OFFENSE: string[] = [
  'gun_fast_hands', 'gun_fast_hands', 'gun_fast_hands', 'gun_steady_aim', 'gun_steady_aim', 'gun_steady_aim',
  'gun_range_finder', 'gun_range_finder', 'gun_crew_drill', 'gun_crew_drill',
  'gun_double_charge', 'gun_raking_fire', 'gun_raking_fire', 'gun_waterline', 'gun_waterline',
  'gun_spotter', 'gun_splinter_storm', 'gun_chaser_master', 'gun_chaser_master', 'gun_quick_swap',
  'gun_powder_mastery', 'gun_powder_mastery', 'gun_thunder_broadside', 'gun_crossfire', 'gun_heated_shot', 'gun_iron_rain',
  'shp_sound_timbers', 'shp_sound_timbers', 'shp_sound_timbers', 'shp_salvager', 'shp_salvager',
  'srv_carpenters', 'srv_carpenters', 'srv_carpenters', 'srv_bucket_brigade', 'srv_bucket_brigade', 'srv_iron_hull', 'srv_iron_hull', 'srv_iron_hull',
];
/** A gunnery-first build her points buy at this level (the same for all six: their kits differ, not this). */
export function talentBuild(level: number): TalentRanks {
  const ranks: TalentRanks = {};
  let pts = Math.max(0, level - 1);
  for (const id of OFFENSE) {
    if (pts <= 0) break;
    if (canLearn(ranks, id, pts, { level, abyssOpen: false })) continue;
    ranks[id] = (ranks[id] ?? 0) + 1;
    pts--;
  }
  return ranks;
}
/** Her hero's sea skills: artillery first, armour second, by her level. */
export function heroMods(level: number): { mods: ReturnType<typeof skillSeaMods> } {
  const art = level >= 10 ? 3 : level >= 5 ? 2 : 1;
  const arm = level >= 20 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
  const sk: SkillSlot[] = [{ id: 'artillery', r: art as SkillSlot['r'] }];
  if (arm) sk.push({ id: 'armor', r: arm as SkillSlot['r'] });
  return { mods: skillSeaMods(sk) };
}

/** Her kit: none, rare pieces of her ⚓ in every open slot (seeded), or the reference full kit. */
export function kitFor(anchor: number, gear: Gear, seed = 1): { ship: Partial<Record<ShipSlot, Item>>; worn: Item[] } {
  const ship: Partial<Record<ShipSlot, Item>> = {};
  const worn: Item[] = [];
  if (gear === 'bare') return { ship, worn };
  if (gear === 'full') {
    for (const it of referenceKit(anchor)) {
      const sl = ITEM_BASES[it.base].slot;
      if ((SHIP_SLOTS as readonly string[]).includes(sl)) ship[sl as ShipSlot] = it;
      else worn.push(it);
    }
    return { ship, worn };
  }
  const rng = new Rng(seed);
  let uid = 5000;
  for (const sl of SHIP_SLOTS) {
    if (sl === 'tackle' || anchor < SLOT_OPENS[sl]) continue;
    ship[sl] = makeItem(rng, uid++, { ilvl: anchor, rarity: 2 as Rarity, slot: sl as Slot });
  }
  for (const sl of CAPTAIN_SLOTS) worn.push(makeItem(rng, uid++, { ilvl: anchor, rarity: 2 as Rarity, slot: sl as Slot }));
  return { ship, worn };
}

let seq = 0;
export interface CaptainCfg {
  anchor: number;
  gear: Gear;
  captain?: CaptainId;
  seed?: number;
  level?: number;
}

/** A captain's warship of her ⚓ as configured, at (x, y), heading north (her starboard battery faces east), in lawless
 *  water (any captain may fire on her). Her first fights long behind her. */
export function captainShip(game: Game, cfg: CaptainCfg, x: number, y: number, heading = 0): { s: PlayerSession; ship: ShipEntity } {
  const name = `SeaCap${++seq}`;
  const conn = join(game, name, cfg.captain ?? 'corsair');
  const s = game.sessionByName(name)!;
  // Her line goes quiet: the bench reads the game, not her inbox (a run of fights kept every snapshot in it).
  conn.inbox.length = 0;
  conn.send = () => {};
  conn.sendBinary = () => {};
  const p = s.profile!;
  if (p.tutorial) {
    p.tutorial.on = false;
    p.tutorial.easy = 99;
  }
  const level = cfg.level ?? refLevel(cfg.anchor);
  runAdmin(game, s, `/level ${level}`);
  const cls = refHull(cfg.anchor);
  runAdmin(game, s, `/ship ${cls} ${cfg.anchor}`);
  const ship = s.ship!;
  const gun = refGun(cls);
  ship.loadout.guns = { port: gun, starboard: gun };
  for (const k of Object.keys(ship.talents)) delete ship.talents[k];
  Object.assign(ship.talents, talentBuild(level));
  ship.hero = heroMods(level);
  const kit = kitFor(cfg.anchor, cfg.gear, cfg.seed);
  ship.loadout.gear = kit.ship;
  ship.worn = kit.worn;
  ship.docked = null;
  p.docked = null; // (her sheet at sea too: a ship out of a port her sheet still lay in was put back at its mouth)
  ship.protectedUntil = 0;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.heading = heading;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.recompute(game.now);
  ship.setArmy(armyForLevel(cfg.anchor, ship.stats.crewMax, ship.armySlots, 'player'));
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  ship.morale = 100;
  ship.ammo.round = 99999;
  ship.ammo.grape = 99999;
  ship.ammoSel = 'round';
  ship.region = 'the_abyss';
  game.grid.upsert(ship.id, x, y);
  p.gold = 1e7;
  return { s, ship };
}

/** The sea's pirate of her ⚓ on her warship (an elite if asked), lying still, her brain asleep. */
export function npcShip(game: Game, anchor: number, x: number, y: number, elite = false, heading = 0): ShipEntity {
  const o = game.spawnNpcShip('pirate', refHull(anchor), 'confederacy', x, y, heading);
  if (elite) o.elite = true;
  game.setNpcLevel(o, anchor);
  o.state.speed = 0;
  o.state.sail = 0;
  o.input = { rudder: 0, sailTarget: 0 };
  o.region = 'the_abyss';
  o.crew = o.stats.crewMax;
  o.setArmy(armyForLevel(anchor, o.stats.crewMax, o.armySlots, 'pirate'));
  o.hull = o.stats.hullMax;
  o.ammo.round = 99999;
  const b = game.npcs.get(o.id);
  if (b) b.active = false;
  game.grid.upsert(o.id, x, y);
  return o;
}

/** Her ship as she was: hull, canvas, leaks, the effects of a fight gone. */
export function restore(t: ShipEntity, army?: { u: string; n: number }[]): void {
  if (army) t.setArmy(army.map((x) => ({ ...x })) as never);
  t.hull = t.stats.hullMax;
  t.sails = t.stats.sailHpMax;
  t.leaks = 0;
  t.rudderHp = 1;
  t.water = 0;
  t.gunsDisabled = { port: 0, starboard: 0 };
  t.effects = t.effects.filter((e) => e.id === 'npc_craft' || e.id === 'elite');
  t.recompute(0);
  t.hull = t.stats.hullMax;
  t.surrendered = false;
  t.sinkingUntil = 0; // a broadside that sank her is undone too
  t.lastStandUntil = 0;
  t.attackers.clear();
  t.morale = 100;
  t.crew = t.stats.crewMax;
}

/** Every ball that strikes, and those reported at 0 (a splash to the eye). */
export interface HitTally { hits: number; zero: number; capped: number }
export function tallyHits(game: Game): HitTally {
  const t: HitTally = { hits: 0, zero: 0, capped: 0 };
  const emit = game.emit.bind(game);
  game.emit = ((ev: { k: string; dmg?: number; evaded?: boolean; capped?: boolean }, x: number, y: number) => {
    if (ev.k === 'hit' && !ev.evaded) {
      t.hits++;
      if ((ev.dmg ?? 0) <= 0) t.zero++;
      if (ev.capped) t.capped++;
    }
    emit(ev as never, x, y);
  }) as typeof game.emit;
  return t;
}

/** One broadside from `ship`'s starboard battery onto `t`, laid by her gun captains, resolved to its last ball.
 *  The hull she lost and the men. */
export function volley(game: Game, ship: ShipEntity, t: ShipEntity, ammo: 'round' | 'grape' = 'round'): { hull: number; men: number; balls: number } {
  ship.reload.starboard = 0;
  ship.reload.port = 0;
  ship.aimStart.starboard = -1;
  ship.ammoSel = ammo;
  ship.ammo[ammo] = 99999;
  const h0 = t.hull, m0 = t.crew;
  const before = game.projectiles.length;
  const why = fireBroadside(game, ship, 'starboard', Math.hypot(t.state.x - ship.state.x, t.state.y - ship.state.y), { x: t.state.x, y: t.state.y }, 1, {});
  if (why) throw new Error('fire: ' + why);
  const balls = game.projectiles.length - before;
  for (let i = 0; i < 400 && game.projectiles.length; i++) stepProjectiles(game, 0.05);
  game.projectiles.length = 0;
  ship.ammoSel = 'round';
  return { hull: h0 - t.hull, men: m0 - t.crew, balls };
}

/** The close fight's distance for her guns. */
export function fightDistance(ship: ShipEntity): number {
  return Math.round(closeRange(effectiveRange(ship, 'starboard', 'round')).best);
}

export interface Measure {
  /** Broadsides to sink her (her hull over the mean broadside). */
  volleys: number;
  /** Hull a broadside, mean. */
  dmg: number;
  hullMax: number;
  /** Men of hers a broadside, as a share of her men. */
  menShare: number;
  /** Seconds to sink her lying still, one battery: (⌈volleys⌉ − 1) × her reload. */
  sec: number;
  reload: number;
}

/** `n` broadsides of `ship` on `t` (her restored before each): broadsides to sink her, and the men each costs her. */
export function measure(game: Game, ship: ShipEntity, t: ShipEntity, n = 8, ammo: 'round' | 'grape' = 'round'): Measure {
  const army = t.army.map((x) => ({ ...x }));
  const dm: number[] = [], men: number[] = [];
  for (let i = 0; i < n; i++) {
    restore(t, army);
    ship.hull = ship.stats.hullMax;
    ship.crew = ship.stats.crewMax;
    ship.morale = 100;
    ship.effects = ship.effects.filter((e) => e.id === 'npc_craft' || e.id === 'elite');
    ship.recompute(game.now);
    const r = volley(game, ship, t, ammo);
    dm.push(r.hull);
    men.push(r.men / Math.max(1, t.stats.crewMax));
  }
  restore(t, army);
  const dmg = dm.reduce((a, b) => a + b, 0) / n;
  const volleys = t.stats.hullMax / Math.max(1e-6, dmg);
  ship.reload.port = 0;
  ship.reload.starboard = 0;
  const reload = reloadTime(ship, 'starboard', game.now);
  return { volleys, dmg, hullMax: t.stats.hullMax, menShare: men.reduce((a, b) => a + b, 0) / n, sec: (Math.ceil(volleys) - 1) * reload, reload };
}

/** A sea emptied for the bench. */
export function bench(): Game {
  return duelSea();
}
export function clearSea(game: Game): void {
  // The bench's captains go with their ships (a session left without one is brought home to a port, and the bench's sea
  // has none of the islands a port's view reads).
  for (const s of [...game.sessions]) game.sessions.delete(s);
  game.pvp.duelOf.clear();
  for (const id of [...game.ships.keys()]) game.removeShip(id);
  game.projectiles.length = 0;
  game.strikes.length = 0;
}
export function spot(game: Game): { x: number; y: number } {
  return openWater(game, 1);
}

// ------------------------------------------------------------------------------------------------ under way

export interface Underway {
  /** Seconds from the start, 900 m apart; and from the first broadside either way (the fight itself). */
  sec: number;
  fight: number;
  sunk: boolean;
  volleysA: number;
  volleysB: number;
  winner: 'a' | 'b' | 'draw';
  /** The winner's canvas left at the end, as a share. */
  sails: number;
}

/** Two ships under way, 900 m apart at a cruise, each fought by the sea's fighting mind (`engage`) with an average
 *  captain's craft (a captain's ship) or her own (a bot), broadsides only, until one is sunk or `maxSec` runs out. The
 *  broadsides each landed (one ball home or more) counted. */
export function underway(game: Game, A: ShipEntity, B: ShipEntity, k: number, maxSec = 400): Underway {
  const at = openWater(game, k);
  const h = (k * 2.399) % (Math.PI * 2);
  const place = (s: ShipEntity, x: number, y: number, hd: number) => {
    s.state.x = x;
    s.state.y = y;
    s.state.heading = hd;
    s.state.speed = s.stats.maxSpeed * 0.7;
    s.input = { rudder: 0, sailTarget: 0.75 };
    s.region = game.regionAt(x, y);
    game.grid.upsert(s.id, x, y);
  };
  place(A, at.x, at.y, h);
  place(B, at.x + Math.sin(h + 1.3) * 900, at.y - Math.cos(h + 1.3) * 900, h + Math.PI);
  // Two captains fight a duel by consent (pvp.ts: duel_ok), so the waters' rules stand aside.
  if (A.isPlayer && B.isPlayer) {
    const d = { id: 1, sides: [[A.accountId!], [B.accountId!]] as [number[], number[]], cx: at.x, cy: at.y, r: 1e6, startAt: -1, endAt: 1e15, struck: new Set<number>(), outside: new Map(), snaps: new Map(), ranked: false };
    game.pvp.duelOf.set(A.accountId!, d as never);
    game.pvp.duelOf.set(B.accountId!, d as never);
  }
  const brains = new Map<number, NpcBrain>();
  for (const s of [A, B]) {
    const b = newBrain(s.id, 'hunter', game.now);
    b.active = true;
    if (s.isPlayer) b.skill = CRAFT.average;
    brains.set(s.id, b);
    game.npcs.delete(s.id);
  }
  // Landed broadsides: a broadside's record settles with its hits (combat.ts VolleyRec).
  const landed = new Map<number, number>();
  const vol = game.volleys;
  let first = -1;
  const set = vol.set.bind(vol);
  vol.set = (key: number, rec: VolleyRec) => {
    if (first < 0 && (rec.owner === A.id || rec.owner === B.id)) first = game.now;
    return set(key, rec);
  };
  const del = vol.delete.bind(vol);
  vol.delete = (key: number) => {
    const rec = vol.get(key);
    if (rec && rec.counts) {
      let n = 0;
      for (const v of rec.hits.values()) n += v;
      if (n > 0) landed.set(rec.owner, (landed.get(rec.owner) ?? 0) + 1);
    }
    return del(key);
  };
  const t0 = game.now;
  const next = new Map<number, number>();
  const think = (me: ShipEntity, foe: ShipEntity) => {
    const b = brains.get(me.id)!;
    if ((next.get(me.id) ?? 0) > game.now) return;
    next.set(me.id, game.now + (b.skill?.react ?? 0.5));
    engage(game, me, b, foe, Math.hypot(foe.state.x - me.state.x, foe.state.y - me.state.y));
  };
  for (const s of [A, B]) s.lastStandUntil = 0;
  const companies = [A, B].map((s) => game.sessionOf(s)?.profile?.company).filter((c) => !!c);
  // Down: sunk, or beaten to her last plank (a duel between captains ends there, the loser striking, pvp.ts).
  const down = (s: ShipEntity) => !s.alive || s.hull <= 1 || s.surrendered;
  while (game.now - t0 < maxSec && !down(A) && !down(B)) {
    think(A, B);
    think(B, A);
    // The bench's crews are content (no mutiny sails her off to port mid-fight).
    for (const c of companies) {
      c!.course = null;
      c!.mutiny = null;
      c!.loyalty = 100;
      c!.unrest = { phase: 0, t: 0 };
    }
    game.step();
  }
  vol.delete = del;
  const aDown = down(A), bDown = down(B);
  vol.set = set;
  const win = bDown && !aDown ? A : aDown && !bDown ? B : null;
  return { sec: Math.round(game.now - t0), fight: Math.round(game.now - (first >= 0 ? first : t0)), sails: win ? win.sails / win.stats.sailHpMax : NaN, sunk: aDown || bDown, volleysA: landed.get(A.id) ?? 0, volleysB: landed.get(B.id) ?? 0, winner: bDown && !aDown ? 'a' : aDown && !bDown ? 'b' : 'draw' };
}
