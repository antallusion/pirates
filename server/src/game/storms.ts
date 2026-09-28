// Storm chasers (docs/12 P10 #14) on the server: while the Storm of the Century rages, its heart wanders the region's
// open water. Near it a bolt falls every few seconds on a ship (those holding in its core first: the charge draws the
// lightning); a lightning rod grounds most of it. A captain who holds in the core long enough catches the heart, and
// the sky takes a while to make another. Hearts are forged into the Storm-Chaser set, and one goes into a ship's keel
// for her tenth level (refit.ts).

import { BOLT, CHARGE_NEED, CORE_R, HEARTS_PER_STORM, HEART_R, HEART_REST, HEART_SPEED, STORM_FORGE, STORM_SLOTS, STRIKE_EVERY } from '../../../shared/src/data/storms.ts';
import { CAPTAIN_SLOTS, STASH_SIZE, captainIlvl, itemName, makeItem } from '../../../shared/src/data/items.ts';
import type { Slot } from '../../../shared/src/data/items.ts';
import type { StormView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { applyDamage } from './combat.ts';
import { unlockDeed } from './looks.ts';
import type { WorldEvent } from './events.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

interface Heart {
  path: { x: number; y: number }[];
  /** Metres along the loop at each waypoint, and the loop's length. */
  at: number[];
  len: number;
  charge: Map<number, number>;
  caught: Map<number, number>;
  /** Wall-clock ms till the sky makes another heart. */
  rest: number;
  lastBolt: number;
  told: Set<string>;
}

interface StormState {
  hearts: Map<number, Heart>;
  sent: WeakSet<PlayerSession>;
}

const states = new WeakMap<Game, StormState>();
function ss(game: Game): StormState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { hearts: new Map(), sent: new WeakSet() }));
  return s;
}

function storms(game: Game): WorldEvent[] {
  return game.worldEvents.active(game).filter((e) => e.kind === 'storm_century' && e.stage === 'storm');
}

/** The heart's loop over the region's open water: eight waypoints about the storm's centre, the same for a storm. */
function heartOf(game: Game, e: WorldEvent): Heart {
  const S = ss(game);
  let h = S.hearts.get(e.id);
  if (h) return h;
  const rng = new Rng((game.world.seed * 31 + e.id * 7919 + 17) >>> 0);
  const path: { x: number; y: number }[] = [];
  for (let k = 0; path.length < 8 && k < 400; k++) {
    const a = (path.length / 8) * Math.PI * 2 + (rng.float() - 0.5) * 0.6;
    const r = 1500 + rng.float() * 3500 + k * 20;
    const x = e.x + Math.sin(a) * r, y = e.y - Math.cos(a) * r;
    if (!isLand(game.world, x, y)) path.push({ x: Math.round(x), y: Math.round(y) });
  }
  if (!path.length) path.push({ x: e.x, y: e.y });
  const at: number[] = [];
  let len = 0;
  for (let i = 0; i < path.length; i++) {
    at.push(len);
    const b = path[(i + 1) % path.length];
    len += Math.hypot(b.x - path[i].x, b.y - path[i].y);
  }
  h = { path, at, len: Math.max(1, len), charge: new Map(), caught: new Map(), rest: 0, lastBolt: 0, told: new Set() };
  S.hearts.set(e.id, h);
  return h;
}

/** Where the heart is now: along its loop at its own pace from the storm's first hour. */
export function heartAt(game: Game, e: WorldEvent): { x: number; y: number } {
  const h = heartOf(game, e);
  const d = ((((game.wallNow() - e.started) / 1000) * HEART_SPEED) % h.len + h.len) % h.len;
  let i = h.at.length - 1;
  while (i > 0 && h.at[i] > d) i--;
  const a = h.path[i], b = h.path[(i + 1) % h.path.length];
  const seg = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const f = Math.min(1, (d - h.at[i]) / seg);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function shipsNear(game: Game, x: number, y: number, r: number): ShipEntity[] {
  const out: ShipEntity[] = [];
  game.grid.query(x, y, r, (id) => {
    const s = game.ships.get(id);
    if (s && s.alive && !s.docked && !s.cls.monster && Math.hypot(s.state.x - x, s.state.y - y) <= r) out.push(s);
  });
  return out;
}

/** A bolt on a ship: a share of her hull and canvas and a few hands; a lightning rod grounds most of it. */
export function strike(game: Game, t: ShipEntity): void {
  const rod = t.hasFlag('lightning_rod') ? BOLT.rod : 1;
  applyDamage(game, t, { hull: t.stats.hullMax * BOLT.hull * rod, sails: t.stats.sailHpMax * BOLT.sails * rod, crew: BOLT.crew * rod }, null);
  if (rod === 1 && game.rng.chance(BOLT.fire)) t.addEffect({ id: 'fire', until: game.now + 6 }, game.now);
  game.emit({ k: 'fx', fx: 'lightning', x: Math.round(t.state.x), y: Math.round(t.state.y), r: 30 }, t.state.x, t.state.y);
  if (t.isPlayer) game.toastShip(t, rod < 1 ? 'Lightning! The rod takes most of it.' : 'Lightning strikes your mainmast! (A Lightning Rod would ground it.)', 'bad');
}

/** Once a second: the bolts, the charge, the catch; each captain in a storm's region told where its heart is. */
export function stepStorms(game: Game): void {
  const S = ss(game);
  const list = storms(game);
  for (const id of [...S.hearts.keys()]) if (!list.some((e) => e.id === id)) S.hearts.delete(id);
  const told = new Set<PlayerSession>();
  for (const e of list) {
    const h = heartOf(game, e);
    const pos = heartAt(game, e);
    const resting = h.rest > game.wallNow();
    if (!resting) {
      const near = shipsNear(game, pos.x, pos.y, HEART_R);
      const core = near.filter((s) => Math.hypot(s.state.x - pos.x, s.state.y - pos.y) <= CORE_R);
      // The bolts: the charged first, else the tallest masts.
      if (near.length && game.now - h.lastBolt >= STRIKE_EVERY) {
        h.lastBolt = game.now;
        let pool = core.length && game.rng.chance(0.6) ? core : near;
        const top = Math.max(...pool.map((s) => s.cls.tier));
        pool = pool.filter((s) => s.cls.tier === top);
        strike(game, game.rng.pick(pool));
      }
      // The charge: held in the core it builds; out of it, it bleeds away.
      const inCore = new Set<number>();
      for (const ship of core) {
        const s = ship.isPlayer ? game.sessionOf(ship) : null;
        if (!s?.profile) continue;
        const caught = h.caught.get(s.accountId) ?? 0;
        if (caught >= HEARTS_PER_STORM) {
          if (!h.told.has(`${s.accountId}:all`)) {
            h.told.add(`${s.accountId}:all`);
            game.sendTo(s, { t: 'toast', msg: 'You have caught all this storm will give you.', kind: 'info' });
          }
          continue;
        }
        inCore.add(s.accountId);
        const c = (h.charge.get(s.accountId) ?? 0) + 1;
        h.charge.set(s.accountId, c);
        if (!h.told.has(String(s.accountId))) {
          h.told.add(String(s.accountId));
          game.sendTo(s, { t: 'toast', msg: 'You are in the heart of the storm: hold here to catch it.', kind: 'info' });
        }
        if (c >= CHARGE_NEED) {
          catchHeart(game, s, e, h, pos);
          break;
        }
      }
      for (const [acct, c] of h.charge) if (!inCore.has(acct)) {
        if (c <= 2) h.charge.delete(acct);
        else h.charge.set(acct, c - 2);
      }
    }
    // Everyone at sea in the region sees the heart (or where it will be).
    for (const s of game.sessions) {
      const ship = s.ship;
      if (!ship || ship.docked || ship.region !== e.region || told.has(s)) continue;
      told.add(s);
      const view: StormView = {
        x: Math.round(pos.x), y: Math.round(pos.y), r: HEART_R, core: CORE_R,
        charge: h.charge.get(s.accountId) ?? 0, need: CHARGE_NEED,
        rest: Math.max(0, Math.ceil((h.rest - game.wallNow()) / 1000)),
        hearts: s.profile?.stormHearts ?? 0, caught: h.caught.get(s.accountId) ?? 0, max: HEARTS_PER_STORM,
      };
      game.sendTo(s, { t: 'storm', view });
      S.sent.add(s);
    }
  }
  for (const s of game.sessions) {
    if (told.has(s) || !S.sent.has(s)) continue;
    S.sent.delete(s);
    game.sendTo(s, { t: 'storm', view: null });
  }
}

function catchHeart(game: Game, s: PlayerSession, e: WorldEvent, h: Heart, pos: { x: number; y: number }): void {
  const p = s.profile!;
  p.stormHearts = (p.stormHearts ?? 0) + 1;
  h.caught.set(s.accountId, (h.caught.get(s.accountId) ?? 0) + 1);
  h.charge.clear();
  h.told.clear();
  h.rest = game.wallNow() + HEART_REST * 1000;
  game.emit({ k: 'fx', fx: 'lightning', x: Math.round(pos.x), y: Math.round(pos.y), r: 140 }, pos.x, pos.y);
  game.sendTo(s, { t: 'toast', msg: `You have caught the heart of the storm! (${p.stormHearts} in all)`, kind: 'gold' });
  const news = `${s.name} has caught the heart of the storm over ${REGIONS[e.region].name}.`;
  game.addRumor(pos.x, pos.y, news);
  for (const o of game.sessions) {
    if (o === s || o.ship?.region !== e.region) continue;
    game.sendTo(o, { t: 'toast', msg: news, kind: 'info' });
    game.sendTo(o, { t: 'toast', msg: 'The heart of the storm is gone; the sky will make another.', kind: 'info' });
  }
  unlockDeed(game, s, 'storm'); // the Storm Heart flag (docs/12 P10 #12)
  game.pushSelf(s, true);
}

/** A piece of the Storm-Chaser set at a forge: two hearts and silver; her ship's level (her own for her own gear). */
export function forgeStorm(game: Game, s: PlayerSession, port: Port, slot: Slot): string | null {
  const p = s.profile!;
  if (port.shipyardTier < 2) return 'No forge here: the Storm-Chaser set wants a yard of the second rank or better';
  if (!STORM_SLOTS.includes(slot)) return 'That is not a piece of the Storm-Chaser set';
  if ((p.stormHearts ?? 0) < STORM_FORGE.hearts) return `Needs ${STORM_FORGE.hearts} hearts of the storm`;
  if (p.gold < STORM_FORGE.silver) return 'Not enough silver';
  if (p.stash.length >= STASH_SIZE) return 'Your locker is full';
  const captain = (CAPTAIN_SLOTS as readonly Slot[]).includes(slot);
  const ilvl = captain ? captainIlvl(p.level) : Math.max(1, p.loadout.level ?? s.ship?.shipLevel ?? 1);
  const it = makeItem(game.rng, p.itemSeq++, { ilvl, rarity: 3, slot });
  delete it.legendary;
  it.set = 'storm';
  it.bound = true;
  p.stormHearts = (p.stormHearts ?? 0) - STORM_FORGE.hearts;
  p.gold -= STORM_FORGE.silver;
  game.db.ledger(s.accountId, 'storm_forge', -STORM_FORGE.silver, slot);
  p.stash.push(it);
  game.sendTo(s, { t: 'toast', msg: `The forge makes ${itemName(it)} of the storm’s heart.`, kind: 'gold' });
  return null;
}
