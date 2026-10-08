// The zone bosses (owner, 2026-10-04; docs/21): one great warship for each sea. Each rises every twelve hours by the
// wall clock (the seas 90 minutes apart by their index), sails her sea for an hour and leaves into the fog. The world
// hears of her a quarter of an hour ahead, as she rises, as she dies and as she goes. Her decks cannot be taken; her
// broadsides answer every ship that fires on her, the round spread over all of them (a crowd lives, one alone does
// not). The spoils are ship gear, by each captain's part of her death (2% earns a share), the best part a second
// piece; experience and silver by the part. A slain slot is kept (kv `zboss:<region>`) so a restart cannot raise her
// twice. The model is bosses.ts (BossHub), called beside it in Game.everySecond.

import { ZONE_BOSS_UNITS, targetXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { ZB_GRUDGE, ZB_LIFE, ZB_MIN_SHARE, ZB_REACH, ZB_ROAM, ZB_WARN, ZONE_BOSSES, zbSlot, zbSlotStart } from '../../../shared/src/data/zonebosses.ts';
import type { ZoneBossDef } from '../../../shared/src/data/zonebosses.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { SHIP_SLOTS, makeItem } from '../../../shared/src/data/items.ts';
import type { Item, Slot } from '../../../shared/src/data/items.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';
import { clamp, dist, headingVec, wrapAngle } from '../../../shared/src/math.ts';
import type { WorldEventView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { depthAt, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import { eventsChanged } from './events.ts';
import { takeItem } from './gear.ts';
import { deliver } from './post.ts';
import { logNote } from './captainlog.ts';
import { tattooCount } from './tattoos.ts';
import { chronicle } from './renown.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';
import type { PlayerSession } from './player.ts';

/** What a ship that is a zone boss carries (ShipEntity.zoneBoss). */
export interface ZoneBossTag {
  region: RegionId;
  slot: number;
  /** Wall-clock ms when she leaves. */
  endsAt: number;
}

interface Part {
  name: string;
  dmg: number;
}

/** A boss at sea: her ship, the wander and every captain's part of her. */
export interface ZbLive {
  id: number;
  region: RegionId;
  slot: number;
  endsAt: number;
  anchor: { x: number; y: number };
  goal: { x: number; y: number };
  contrib: Map<number, Part>;
  nextVolley: number; // game time
  lastEvents: number;
}

/** The refusal to a captain who throws grapples at her (docs/21 §3). */
export const ZB_NO_BOARD = 'Her decks cannot be taken — guns only';

// The zone bosses' own dice (where she rises, where she wanders, what she drops): the sea's stream (game.rng, which
// the balance sims replay) is left alone.
const rngs = new WeakMap<Game, Rng>();
function zr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng((game.world.seed ^ 0x2b05) >>> 0)));
  return r;
}

const kvKey = (region: RegionId) => `zboss:${region}`;

export class ZoneBossHub {
  /** The calendar runs (tests of other systems keep it still: tests/helpers.ts; the bosses at sea still sail). */
  on = true;
  live = new Map<RegionId, ZbLive>();
  /** The slot each region was last warned of (so the warning is said once). */
  private warned = new Map<RegionId, number>();
  /** The slot each region's boss last left in (sent away early by an admin: not raised again in it). */
  left = new Map<RegionId, number>();

  /** The regions this server raises: its own zone's (all of them with no zones). */
  regions(game: Game): RegionId[] {
    return REGION_IDS.filter((r) => !game.zone || game.zone.regions.has(r));
  }

  /** The slot she was slain in last (kv: it survives a restart). */
  killedSlot(game: Game, region: RegionId): number {
    return game.db.getKv<{ slot: number }>(kvKey(region))?.slot ?? -Infinity;
  }

  /** The boss of a ship, if she is one at sea now. */
  of(ship: ShipEntity): ZbLive | null {
    const t = ship.zoneBoss;
    if (!t) return null;
    const l = this.live.get(t.region);
    return l && l.id === ship.id ? l : null;
  }

  /** Once a second: the calendar, then each boss's mind and guns. */
  second(game: Game): void {
    const wall = game.wallNow();
    for (const region of this.regions(game)) {
      const live = this.live.get(region);
      if (live) {
        const ship = game.ships.get(live.id);
        if (!ship || !ship.alive) {
          if (!ship) this.live.delete(region); // gone without a word (an admin's hand): nothing to say
          continue;
        }
        if (wall >= live.endsAt) {
          leave(game, live, ship);
          continue;
        }
        zbSecond(game, live, ship);
        continue;
      }
      if (!this.on) continue;
      const slot = zbSlot(wall, region);
      const start = zbSlotStart(slot, region);
      // A quarter of an hour before the next rising: the world hears of it.
      const next = zbSlotStart(slot + 1, region);
      if (wall >= next - ZB_WARN && this.warned.get(region) !== slot + 1) {
        this.warned.set(region, slot + 1);
        announce(game, region, Math.max(1, Math.round((next - wall) / 60000)));
      }
      // Her hour: up, unless she was slain in it already.
      if (wall >= start && wall < start + ZB_LIFE && this.killedSlot(game, region) < slot && this.left.get(region) !== slot) rise(game, region, slot, start + ZB_LIFE);
    }
  }
}

// ================================================================== the calendar

/** «On the horizon of <sea> — <name> sets sail in 15 minutes». */
export function announce(game: Game, region: RegionId, mins: number): void {
  const def = ZONE_BOSSES[region];
  const name = SHIP_CLASSES[def.classId].name;
  const sea = REGIONS[region].name;
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: On the horizon of ${sea}: ${name} sets sail in ${mins} min.`, kind: 'info' });
  game.log(`[zboss] ${region} announced (in ${mins} min)`);
}

/** Open deep water in her sea, clear of the ports, in this server's zone. */
function risingPoint(game: Game, region: RegionId): { x: number; y: number } | null {
  const rng = zr(game);
  const [cx, cy] = REGIONS[region].center;
  for (let i = 0; i < 80; i++) {
    const r = i < 40 ? 6000 : 12000;
    const x = cx + rng.range(-r, r), y = cy + rng.range(-r, r);
    if (deepWater(game, region, x, y)) return { x, y };
  }
  return null;
}

function deepWater(game: Game, region: RegionId, x: number, y: number): boolean {
  if (regionAt(game.world, x, y) !== region || !game.inZone(x, y)) return false;
  if (isLand(game.world, x, y) || depthAt(game.world, x, y) < 12) return false;
  return !game.world.ports.some((p) => dist(p.x, p.y, x, y) < 2500);
}

/** She rises now (the calendar, an admin, a test). Returns her ship, or null with no water for her. */
export function rise(game: Game, region: RegionId, slot: number, endsAt: number, at?: { x: number; y: number }): ShipEntity | null {
  const hub = game.zoneBosses;
  const old = hub.live.get(region);
  if (old) {
    const o = game.ships.get(old.id);
    if (o?.alive) return o;
    hub.live.delete(region);
  }
  const spot = at ?? risingPoint(game, region);
  if (!spot) return null;
  const def = ZONE_BOSSES[region];
  const cls = SHIP_CLASSES[def.classId];
  const ship = game.spawnNpcShip('pirate', def.classId, 'free', spot.x, spot.y, zr(game).range(0, Math.PI * 2), { ship: cls.name, captain: 'the Sea' });
  game.npcs.delete(ship.id); // moved and fought here (always awake: no LOD ever puts her to sleep)
  ship.npcRole = 'boss'; // outside the law and the ladder, no collisions
  ship.zoneBoss = { region, slot, endsAt };
  game.setNpcLevel(ship, def.level);
  ship.level = def.level * 5;
  ship.crew = ship.stats.crewMax;
  ship.morale = 100;
  ship.hull = ship.stats.hullMax;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.sail = 0.6;
  game.grid.upsert(ship.id, spot.x, spot.y);
  const live: ZbLive = { id: ship.id, region, slot, endsAt, anchor: { ...spot }, goal: { ...spot }, contrib: new Map(), nextVolley: game.now + 3, lastEvents: game.now };
  hub.live.set(region, live);
  const sea = REGIONS[region].name;
  game.addRumor(spot.x, spot.y, `${cls.name} sails ${sea}.`);
  for (const s of game.sessions) {
    game.sendTo(s, { t: 'toast', msg: `WORLD: ${cls.name} has risen in ${sea}. Captains, to her! Guns only — she leaves in an hour.`, kind: 'bad' });
    // Her film, the first time a captain sees her rise in her own sea (the client plays each film once).
    const sh = s.ship;
    if (sh && !sh.docked && sh.region === region) game.sendTo(s, { t: 'film', id: `cut_zboss_${region}` });
  }
  game.emit({ k: 'fx', fx: 'boss_roar', x: Math.round(spot.x), y: Math.round(spot.y), r: 400 }, spot.x, spot.y);
  eventsChanged(game);
  game.log(`[zboss] ${region} rose at ${Math.round(spot.x)},${Math.round(spot.y)} (slot ${slot})`);
  return ship;
}

/** Her hour is up: she goes back into the fog, unbeaten. */
export function leave(game: Game, live: ZbLive, ship: ShipEntity | null): void {
  const hub = game.zoneBosses;
  hub.live.delete(live.region);
  hub.left.set(live.region, live.slot);
  const name = ship?.name ?? SHIP_CLASSES[ZONE_BOSSES[live.region].classId].name;
  if (ship) game.removeShip(ship.id);
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${name} has gone into the fog of ${REGIONS[live.region].name}, unbeaten.`, kind: 'info' });
  eventsChanged(game);
  game.log(`[zboss] ${live.region} left unbeaten`);
}

// ================================================================== her mind and her guns

/** Ships that have fired on her lately, within reach of her guns. */
export function underHerGuns(game: Game, ship: ShipEntity, r = ZB_REACH): ShipEntity[] {
  const out: ShipEntity[] = [];
  game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
    if (o === ship || !o.alive || o.docked || o.ghost || o.zoneBoss) return;
    if (!(o.isPlayer || o.ownerId !== null)) return;
    if ((ship.attackers.get(o.id) ?? -Infinity) < game.now - ZB_GRUDGE) return;
    if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) <= r) out.push(o);
  });
  return out;
}

/** The hull one of her balls' share takes off a ship, after her armour and her braces (the sim reckons the same). */
export function zbHullHit(target: ShipEntity, share: number): number {
  return share * (1 - Math.min(0.85, target.stats.armor)) * Math.max(0.1, target.stats.incomingDamageMul);
}

function zbSecond(game: Game, live: ZbLive, ship: ShipEntity): void {
  const def = ZONE_BOSSES[live.region];
  // A great ship of the sea: her people do not run short, nor her nerve break, nor her pumps fail.
  ship.crew = Math.max(ship.crew, Math.round(ship.stats.crewMax * 0.75));
  ship.morale = 100;
  ship.leaks = 0;
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  ship.surrendered = false;
  // Her guns: a round every few seconds, its weight shared among all who fire on her.
  const foes = underHerGuns(game, ship);
  if (foes.length && game.now >= live.nextVolley) {
    live.nextVolley = game.now + def.every;
    volley(game, ship, def, foes);
  }
  // The chart's mark follows her (the list goes out only when it changes, events.ts).
  if (game.now - live.lastEvents >= 15) {
    live.lastEvents = game.now;
    eventsChanged(game);
  }
}

function volley(game: Game, ship: ShipEntity, def: ZoneBossDef, foes: ShipEntity[]): void {
  const share = def.volley / foes.length;
  for (const o of foes) {
    const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y);
    const h = Math.atan2(o.state.x - ship.state.x, -(o.state.y - ship.state.y));
    const side = wrapAngle(h - ship.state.heading) < 0 ? 'port' : 'starboard';
    const balls: [number, number, number, number, number][] = [];
    for (let i = 0; i < 6; i++) balls.push([Math.round(ship.state.x), Math.round(ship.state.y), Math.round((h + (i - 2.5) * 0.012) * 1000) / 1000, Math.round(d), i * 70]);
    game.emit({ k: 'volley', ship: ship.id, side, ammo: 'round', balls }, ship.state.x, ship.state.y);
    const hull = zbHullHit(o, share);
    game.emit({ k: 'hit', x: Math.round(o.state.x), y: Math.round(o.state.y), ship: o.id, dmg: Math.round(hull), ammo: 'round' }, o.state.x, o.state.y);
    applyDamage(game, o, { hull, sails: share * 0.05 }, ship);
  }
}

/** Every tick: she sails (by her own hand, not the wind's: a great ship of the sea goes where she will). */
export function stepZoneBosses(game: Game, dt: number): void {
  for (const live of game.zoneBosses.live.values()) {
    const ship = game.ships.get(live.id);
    if (!ship || !ship.alive || ship.sinkingUntil) continue;
    const foes = underHerGuns(game, ship, 4000);
    let tx = live.goal.x, ty = live.goal.y, speed = 15;
    let near: ShipEntity | null = null, nd = Infinity;
    for (const o of foes) {
      const d = dist(o.state.x, o.state.y, ship.state.x, ship.state.y);
      if (d < nd) {
        nd = d;
        near = o;
      }
    }
    if (near) {
      // The nearest who fired on her: closer if far, broadside on when within her reach.
      const toward = Math.atan2(near.state.x - ship.state.x, -(near.state.y - ship.state.y));
      if (nd > ZB_REACH * 0.6) {
        tx = near.state.x;
        ty = near.state.y;
        speed = 15;
      } else {
        const off = wrapAngle(ship.state.heading - toward) >= 0 ? Math.PI / 2 : -Math.PI / 2;
        const v = headingVec(toward + off);
        tx = ship.state.x + v.x * 400;
        ty = ship.state.y + v.y * 400;
        speed = 7;
      }
      if (dist(tx, ty, live.anchor.x, live.anchor.y) > ZB_ROAM * 1.3) {
        tx = live.anchor.x;
        ty = live.anchor.y;
      }
    } else if (dist(ship.state.x, ship.state.y, tx, ty) < 300) {
      newGoal(game, live);
      tx = live.goal.x;
      ty = live.goal.y;
    }
    sail(game, live, ship, tx, ty, speed, dt);
  }
}

function newGoal(game: Game, live: ZbLive): void {
  const rng = zr(game);
  for (let i = 0; i < 30; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(1500, ZB_ROAM);
    const x = live.anchor.x + Math.sin(a) * r, y = live.anchor.y - Math.cos(a) * r;
    if (deepWater(game, live.region, x, y)) {
      live.goal = { x, y };
      return;
    }
  }
  live.goal = { ...live.anchor };
}

/** Steer and sail toward a point, turning like a great ship, keeping off the shoals and inside her sea. */
function sail(game: Game, live: ZbLive, s: ShipEntity, tx: number, ty: number, speed: number, dt: number): void {
  let want = Math.atan2(tx - s.state.x, -(ty - s.state.y));
  const look = 260;
  const bad = (h: number) => {
    const v = headingVec(h);
    for (const k of [0.5, 1]) {
      const x = s.state.x + v.x * look * k, y = s.state.y + v.y * look * k;
      if (depthAt(game.world, x, y) < s.cls.draft + 2 || regionAt(game.world, x, y) !== live.region || !game.inZone(x, y)) return true;
    }
    return false;
  };
  if (bad(want)) {
    let found = false;
    for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      if (!bad(want + off)) {
        want = wrapAngle(want + off);
        found = true;
        break;
      }
    }
    if (!found) speed = 0;
    else if (live.goal.x === tx && live.goal.y === ty) newGoal(game, live);
  }
  const turn = 0.12; // rad/s
  s.state.heading = wrapAngle(s.state.heading + clamp(wrapAngle(want - s.state.heading), -turn * dt, turn * dt));
  const d = dist(s.state.x, s.state.y, tx, ty);
  const v = Math.min(speed, d / Math.max(dt, 1e-3));
  const h = headingVec(s.state.heading);
  const nx = s.state.x + h.x * v * dt, ny = s.state.y + h.y * v * dt;
  if (depthAt(game.world, nx, ny) >= s.cls.draft) {
    s.state.x = nx;
    s.state.y = ny;
    s.state.speed = v / SPEED_SCALE;
  } else s.state.speed = 0;
  s.state.sail = v > 0 ? 0.6 : 0;
  s.input = { rudder: 0, sailTarget: s.state.sail };
  game.grid.upsert(s.id, s.state.x, s.state.y);
}

// ================================================================== her death and the spoils

/** A captain's ship (or her escort's) as the account it counts for. */
function accountOf(game: Game, s: ShipEntity | null): { id: number; name: string } | null {
  if (!s) return null;
  if (s.accountId !== null) return { id: s.accountId, name: s.captainName };
  if (s.ownerId !== null) return accountOf(game, game.ships.get(s.ownerId) ?? null);
  return null;
}

/** The hull a hit took off her, to the account of whoever fired it (applyDamage, combat.ts). */
export function zbCredit(game: Game, target: ShipEntity, source: ShipEntity | null, hull: number): void {
  const live = game.zoneBosses.of(target);
  const a = accountOf(game, source);
  if (!live || !a || !(hull > 0)) return;
  let p = live.contrib.get(a.id);
  if (!p) live.contrib.set(a.id, (p = { name: a.name, dmg: 0 }));
  p.dmg += hull;
}

/** She goes down (Game.beginSinking): no wreck, the spoils by each captain's part. True when it was hers. */
export function zoneBossSinking(game: Game, ship: ShipEntity): boolean {
  const live = game.zoneBosses.of(ship);
  if (!live) return false;
  game.zoneBosses.live.delete(live.region);
  game.db.setKv(kvKey(live.region), { slot: live.slot, at: game.wallNow() }); // a restart does not raise her again this slot
  ship.sinkingUntil = game.now + 8;
  ship.boarding = null;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.emit({ k: 'sunk', ship: ship.id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), name: ship.name }, ship.state.x, ship.state.y);
  spoils(game, live, ship);
  eventsChanged(game);
  return true;
}

/** The ship slots her gear comes in: every one but the tackle (docs/21 §5). */
export const ZB_SLOTS: Slot[] = SHIP_SLOTS.filter((x) => x !== 'tackle');

export interface ZbShare {
  account: number;
  name: string;
  share: number;
  items: number;
  xp: number;
  silver: number;
}

/** Who gets what: everyone with 2% of the damage and more, by the part; the best part a second piece. */
export function zbShares(def: ZoneBossDef, contrib: Map<number, Part>): ZbShare[] {
  let total = 0;
  for (const p of contrib.values()) total += p.dmg;
  if (total <= 0) return [];
  const ranked = [...contrib.entries()].sort((a, b) => b[1].dmg - a[1].dmg);
  const out: ZbShare[] = [];
  for (const [account, p] of ranked) {
    const share = p.dmg / total;
    if (share < ZB_MIN_SHARE) continue;
    out.push({ account, name: p.name, share, items: out.length === 0 ? 2 : 1, xp: Math.round(def.xp * share), silver: Math.round(def.silver * share) });
  }
  return out;
}

function spoils(game: Game, live: ZbLive, ship: ShipEntity): void {
  const def = ZONE_BOSSES[live.region];
  const shares = zbShares(def, live.contrib);
  const rng = zr(game);
  const names = shares.map((x) => x.name);
  for (const sh of shares) {
    const s = game.sessionByAccount(sh.account);
    const p = s?.profile;
    if (!s || !p) continue;
    const items: Item[] = [];
    for (let i = 0; i < sh.items; i++) items.push(makeItem(rng, 0, { ilvl: def.level, source: 'boss', slots: ZB_SLOTS }));
    for (const it of items) {
      // Into the locker (its own toast names the piece); a full locker leaves it floating where she sank, for this
      // captain alone.
      if (takeItem(game, s, it)) continue;
      const id = game.allocId();
      game.loot.set(id, { id, x: ship.state.x, y: ship.state.y, cargo: {}, gold: 0, expires: game.now + 900, ownerOnly: sh.account, items: [it] });
    }
    sh.xp = targetXp(p.level, def.level, ZONE_BOSS_UNITS * sh.share); // docs/26: her part of the boss's lesson, at her level
    game.grantXp(s, sh.xp, null); // (told in the one line below: the toasts of a sinking are many already)
    const pct = Math.max(1, Math.round(sh.share * 100));
    // The silver comes by letter, a draft on the League (any port pays it).
    deliver(game, sh.account, { from: 'The Admiralty Prize Court', subject: `The spoils of ${ship.name}`, body: `Your part of her: ${pct}%. Pieces of ship gear taken from her: ${items.length}. Your share of her prize money is enclosed.`, gold: sh.silver, goods: null });
    game.sendTo(s, { t: 'toast', msg: `${ship.name} is sunk! Your part ${pct}%, +${sh.xp} XP, ship gear ×${items.length}, prize money by letter.`, kind: 'gold' });
    logNote(game, s, 'boss', [ship.name]);
    tattooCount(game, s, 'boss');
    game.saveSession(s);
    game.pushSelf(s, true);
  }
  const who = names.slice(0, 4).join(', ') + (names.length > 4 ? ` +${names.length - 4}` : ''); // (names and a count read in any tongue)
  const sea = REGIONS[live.region].name;
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${ship.name} is sunk in ${sea} by ${who || 'captains unknown'}.`, kind: 'gold' });
  if (names.length) chronicle(game, `${ship.name} was sunk in ${sea} by ${who}.`);
  game.addRumor(ship.state.x, ship.state.y, `${ship.name} lies on the bottom of ${sea}.`);
  game.log(`[zboss] ${live.region} slain by ${names.length} captains (slot ${live.slot})`);
}

// ================================================================== the chart and the rules

/** Each boss at sea, a mark on the chart with her name and the time till she leaves (events.ts). */
export function zoneBossEvents(game: Game): WorldEventView[] {
  const out: WorldEventView[] = [];
  const wall = game.wallNow();
  for (const live of game.zoneBosses.live.values()) {
    const ship = game.ships.get(live.id);
    if (!ship || !ship.alive) continue;
    out.push({ id: -2000 - REGION_IDS.indexOf(live.region), kind: 'zone_boss', title: ship.name, region: live.region, x: Math.round(ship.state.x), y: Math.round(ship.state.y), endsIn: Math.max(0, Math.round((live.endsAt - wall) / 1000)) });
  }
  return out;
}

/** No grapples on her (canBoard, startBoarding). */
export function zbBoardBlocked(b: ShipEntity): string | null {
  return b.zoneBoss ? ZB_NO_BOARD : null;
}

// ================================================================== the admin's hand (QA)

/** `/zboss [region] [rise|here|leave|kill|announce|reset]`: the calendar at a glance, or one sea's boss raised now
 *  (out in her sea, or `here` beside the admin), sent away, sunk by the admin's guns alone, announced, or her slain
 *  slot forgotten. */
export function adminZoneBoss(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  const hub = game.zoneBosses;
  const wall = game.wallNow();
  let region = ship.region;
  let i = 0;
  if (args[0] && (REGION_IDS as string[]).includes(args[0])) {
    region = args[0] as RegionId;
    i = 1;
  }
  const act = (args[i] ?? '').toLowerCase();
  const def = ZONE_BOSSES[region];
  const name = SHIP_CLASSES[def.classId].name;
  const sea = REGIONS[region].name;
  const live = hub.live.get(region);
  switch (act) {
    case '': {
      // A line a sea (each its own toast: each reads in the captain's tongue), and the count.
      const rows = hub.regions(game).map((r) => {
        const l = hub.live.get(r);
        const nm = SHIP_CLASSES[ZONE_BOSSES[r].classId].name;
        if (l) {
          const b = game.ships.get(l.id);
          return `${nm}: at sea, ${Math.round(((b?.hull ?? 0) / Math.max(1, b?.stats.hullMax ?? 1)) * 100)}% hull, ${Math.max(0, Math.ceil((l.endsAt - wall) / 60000))} min left`;
        }
        return `${nm}: rises in ${Math.max(0, Math.ceil((zbNextRiseAfter(game, r, wall) - wall) / 60000))} min`;
      });
      for (const row of rows) game.sendTo(s, { t: 'toast', msg: row, kind: 'info' });
      return `Zone bosses: ${hub.live.size} at sea of ${rows.length}.`;
    }
    case 'rise':
    case 'here': {
      if (live) return `${name} is already at sea.`;
      if (game.zone && !game.zone.regions.has(region)) return `${sea} is not in this zone.`;
      let at: { x: number; y: number } | undefined;
      if (act === 'here') {
        const h = headingVec(ship.state.heading + Math.PI / 2);
        at = { x: ship.state.x + h.x * 1400, y: ship.state.y + h.y * 1400 };
        if (depthAt(game.world, at.x, at.y) < 12) at = { x: ship.state.x - h.x * 1400, y: ship.state.y - h.y * 1400 };
        if (depthAt(game.world, at.x, at.y) < 12) return 'No deep water beside you for her.';
      }
      const b = rise(game, region, zbSlot(wall, region), wall + ZB_LIFE, at);
      return b ? `${name} rises in ${sea}: an hour at sea.` : `No open water for ${name} in ${sea}.`;
    }
    case 'leave':
      if (!live) return `${name} is not at sea.`;
      leave(game, live, game.ships.get(live.id) ?? null);
      return `${name} goes into the fog.`;
    case 'kill': {
      const b = live ? game.ships.get(live.id) : undefined;
      if (!live || !b) return `${name} is not at sea.`;
      zbCredit(game, b, ship, b.hull);
      b.hull = 0;
      b.attackers.set(ship.id, game.now);
      game.beginSinking(b);
      return `${name} is sunk by your guns alone.`;
    }
    case 'announce':
      announce(game, region, 15);
      return `${name}: announced.`;
    case 'reset':
      game.db.setKv(kvKey(region), { slot: -1, at: 0 });
      hub.left.delete(region);
      return `${name}: her slain slot is forgotten.`;
    default:
      return 'Usage: /zboss [region] [rise|here|leave|kill|announce|reset]';
  }
}

/** When she next rises after `wall` (the calendar's next slot, past one she was slain or sent away in). */
function zbNextRiseAfter(game: Game, region: RegionId, wall: number): number {
  const slot = zbSlot(wall, region);
  const start = zbSlotStart(slot, region);
  const done = game.zoneBosses.killedSlot(game, region) >= slot || game.zoneBosses.left.get(region) === slot;
  return wall < start + ZB_LIFE && !done ? start : zbSlotStart(slot + 1, region);
}

