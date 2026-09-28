// The sea's holidays (docs/12 P10 #18) on the server: which is on (the calendar, or an admin's), the word when one begins
// and ends, and each one's sport — the drowned rising after dark with their cursed gifts; herring in every sea and the
// fishing tournament; powder kegs off every harbour and fireworks over the ports; League Day's kinder prices — the
// tournaments' prizes by letter, the holiday flags, and the pet sellers' fair.

import { isNight } from '../../../shared/src/constants.ts';
import { PETS, PET_IDS, petsForSale } from '../../../shared/src/data/companions.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import {
  FAIR_PRICE, GHOST_RISE, HOLIDAYS, KEGS_PER_PORT, KEG_HIT_R, KEG_RING, TOURNAMENT_PRIZES, holidayAt, nextHoliday,
} from '../../../shared/src/data/holidays.ts';
import type { HolidayId } from '../../../shared/src/data/holidays.ts';
import { itemName, makeItem } from '../../../shared/src/data/items.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import type { HolidayView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { herringShoals } from './fishing.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { unlockDeed } from './looks.ts';
import { planWander } from './npc.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';

interface Scores {
  key: string;
  pts: Record<string, { name: string; pts: number }>;
  paid?: boolean;
}

interface HolidayState {
  key: string | null;
  kegs: Map<string, { id: number; x: number; y: number }[]>;
  seq: number;
  ghosts: Set<number>;
}

const states = new WeakMap<Game, HolidayState>();
function hs(game: Game): HolidayState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { key: null, kegs: new Map(), seq: 1, ghosts: new Set() }));
  return s;
}

/** The holiday on now: an admin's (for play-testing) or the calendar's. */
export function currentHoliday(game: Game): { id: HolidayId; start: number; end: number } | null {
  const f = game.db.getKv<{ id: HolidayId; until: number }>('holiday_force');
  if (f && f.until > game.wallNow() && HOLIDAYS[f.id]) return { id: f.id, start: f.until - 2 * 86_400_000, end: f.until };
  return holidayAt(game.wallNow());
}

export function holidayOn(game: Game, id: HolidayId): boolean {
  return currentHoliday(game)?.id === id;
}

function scores(game: Game, key: string): Scores {
  const s = game.db.getKv<Scores>('holiday_scores');
  return s?.key === key ? s : { key, pts: {} };
}

function addPoints(game: Game, s: PlayerSession, id: HolidayId, n: number): number {
  const h = currentHoliday(game);
  if (!h || h.id !== id) return 0;
  const sc = scores(game, `${h.id}:${h.start}`);
  const row = (sc.pts[s.accountId] ??= { name: s.name, pts: 0 });
  const before = row.pts;
  row.pts = Math.round((row.pts + n) * 10) / 10;
  game.db.setKv('holiday_scores', sc);
  // The holiday's flag, once the deed is done.
  if (before < HOLIDAYS[id].need && row.pts >= HOLIDAYS[id].need) unlockDeed(game, s, id);
  return row.pts;
}

/** Every five seconds: the word when a holiday begins and ends (and the prizes), and each holiday's sport. */
export function stepHolidays(game: Game): void {
  const S = hs(game);
  const h = currentHoliday(game);
  const key = h ? `${h.id}:${h.start}` : null;
  if (key !== S.key) {
    const prev = S.key;
    S.key = key;
    if (prev) endHoliday(game, prev);
    if (h) {
      const def = HOLIDAYS[h.id];
      for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: The holiday begins: ${def.name[0]}. ${def.text[0]}`, kind: 'gold' });
    }
    S.kegs.clear();
  }
  if (h) {
    const night = isNight(game.now);
    if (h.id === 'powder_night') stepPowder(game, night);
    if (h.id === 'drowned_night' && night && Math.floor(game.now) % 60 < 5) riseDrowned(game);
    if (h.id === 'herring_run' && Math.floor(game.now) % 300 < 5) {
      const seas = new Set<RegionId>();
      for (const o of game.sessions) if (o.ship && !o.ship.docked) seas.add(o.ship.region);
      for (const r of seas) herringShoals(game, r, 2);
    }
  }
  for (const o of game.sessions) sendHoliday(game, o);
}

function endHoliday(game: Game, key: string): void {
  const [id] = key.split(':') as [HolidayId];
  const def = HOLIDAYS[id];
  if (!def) return;
  for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: The holiday is over: ${def.name[0]}.`, kind: 'info' });
  const sc = game.db.getKv<Scores>('holiday_scores');
  if (!sc || sc.key !== key || sc.paid) return;
  sc.paid = true;
  game.db.setKv('holiday_scores', sc);
  if (id !== 'herring_run' && id !== 'powder_night') return;
  const top = Object.entries(sc.pts).sort((a, b) => b[1].pts - a[1].pts).slice(0, TOURNAMENT_PRIZES.length);
  top.forEach(([acct], i) => {
    const prize = TOURNAMENT_PRIZES[i];
    deliver(game, Number(acct), { from: def.name[0], subject: `${def.name[0]}: place ${i + 1} in the tournament.`, body: `Your prize for ${def.name[0]}: ${prize} silver.`, gold: prize, goods: null });
    game.db.ledger(Number(acct), 'holiday', prize, id);
  });
}

// ------------------------------------------------------------------ Powder Night

function spotOff(game: Game, p: Port): [number, number] | null {
  for (let k = 0; k < 20; k++) {
    const a = game.rng.float() * Math.PI * 2, r = KEG_RING[0] + game.rng.float() * (KEG_RING[1] - KEG_RING[0]);
    const x = p.x + Math.sin(a) * r, y = p.y - Math.cos(a) * r;
    if (!isLand(game.world, x, y)) return [Math.round(x), Math.round(y)];
  }
  return null;
}

/** Kegs off the harbours captains are near, and fireworks over them after dark. */
function stepPowder(game: Game, night: boolean): void {
  const S = hs(game);
  for (const p of game.world.ports) {
    if (![...game.sessions].some((o) => o.ship && Math.hypot(o.ship.state.x - p.x, o.ship.state.y - p.y) < 4000)) continue;
    const list = S.kegs.get(p.id) ?? [];
    while (list.length < KEGS_PER_PORT) {
      const at = spotOff(game, p);
      if (!at) break;
      list.push({ id: S.seq++, x: at[0], y: at[1] });
    }
    S.kegs.set(p.id, list);
    if (night) {
      const a = game.rng.float() * Math.PI * 2, r = 80 + game.rng.float() * 220;
      game.emit({ k: 'fx', fx: 'firework', x: Math.round(p.x + Math.cos(a) * r), y: Math.round(p.y + Math.sin(a) * r), r: 30 + game.rng.float() * 30 }, p.x, p.y);
    }
  }
}

/** A ball falls: a keg within reach of it bursts, a point to the gunner. */
export function kegImpact(game: Game, x: number, y: number, owner: number): void {
  const S = hs(game);
  if (!S.kegs.size) return;
  for (const [pid, list] of S.kegs) {
    const i = list.findIndex((k) => Math.hypot(k.x - x, k.y - y) <= KEG_HIT_R);
    if (i < 0) continue;
    const k = list.splice(i, 1)[0];
    S.kegs.set(pid, list);
    game.emit({ k: 'fx', fx: 'firework', x: k.x, y: k.y, r: 40 }, k.x, k.y);
    const shooter = game.ships.get(owner);
    const s = shooter ? game.sessionOf(shooter) : null;
    if (s) {
      const n = addPoints(game, s, 'powder_night', 1);
      game.sendTo(s, { t: 'toast', msg: `A keg bursts! (${n} this holiday)`, kind: 'gold' });
    }
    return;
  }
}

// ------------------------------------------------------------------ the Night of the Drowned

function riseDrowned(game: Game): void {
  const S = hs(game);
  for (const o of game.sessions) {
    const ship = o.ship;
    if (!ship?.alive || ship.docked || ship.protectedUntil > game.now || REGIONS[ship.region].safety === 'safe') continue;
    if (!game.rng.chance(GHOST_RISE)) continue;
    const a = game.rng.float() * Math.PI * 2;
    const x = ship.state.x + Math.sin(a) * 1100, y = ship.state.y - Math.cos(a) * 1100;
    if (isLand(game.world, x, y)) continue;
    const lv = Math.max(1, ship.shipLevel);
    const g = game.spawnNpcShip('ghost', game.rng.pick(hullsFor('ghost', lv)), 'choir', x, y, a + Math.PI);
    game.setNpcLevel(g, lv);
    const brain = game.npcs.get(g.id);
    if (brain) {
      brain.active = true;
      brain.chase = { id: ship.id, until: game.now + 600 };
      brain.expiresAt = game.now + 900;
      planWander(game, g, brain);
    }
    game.grid.upsert(g.id, x, y);
    S.ghosts.add(g.id);
    game.sendTo(o, { t: 'toast', msg: 'The drowned rise off your bow.', kind: 'bad' });
  }
}

/** A ghost sunk on the Night of the Drowned: its cursed gift. */
export function holidayGhostSunk(game: Game, s: PlayerSession, victim: ShipEntity): void {
  if (victim.npcRole !== 'ghost' || !holidayOn(game, 'drowned_night')) return;
  const p = s.profile!;
  const it = makeItem(game.rng, p.itemSeq++, { ilvl: Math.max(1, victim.shipLevel), rarity: (game.rng.chance(0.25) ? 4 : 3) as 3 });
  if (!takeItem(game, s, it)) return;
  p.curse = Math.min(100, (p.curse ?? 0) + 6);
  game.sendTo(s, { t: 'toast', msg: `A ghost’s gift: ${itemName(it)}. It is cold in your hand (+6 curse).`, kind: 'gold' });
  addPoints(game, s, 'drowned_night', 1);
  hs(game).ghosts.delete(victim.id);
}

// ------------------------------------------------------------------ the Herring Run, League Day

/** A catch in the Herring Run: its weight to the tournament. */
export function holidayCatch(game: Game, s: PlayerSession, kg: number): void {
  if (kg > 0) addPoints(game, s, 'herring_run', kg);
}

/** A sale in a League port on League Day: its worth toward the League's seal. */
export function holidaySale(game: Game, s: PlayerSession, port: Port, good: GoodId, n: number): void {
  if (port.faction !== 'league' || !holidayOn(game, 'league_day')) return;
  addPoints(game, s, 'league_day', (GOODS[good]?.basePrice ?? 0) * n);
}

/** League Day's prices in a League port (buy × 0.9, sell × 1.06). */
export function leagueDayMods(game: Game, port: Port): { buy: number; sell: number } | null {
  return port.faction === 'league' && holidayOn(game, 'league_day') ? { buy: 0.9, sell: 1.06 } : null;
}

/** The pet seller's stock: two of four on a weekday; on a holiday, the fair — all four at half price. */
export function petOffers(game: Game, portId: string): { pet: PetId; price: number }[] {
  if (currentHoliday(game)) return PET_IDS.map((pet) => ({ pet, price: Math.round(PETS[pet].price * FAIR_PRICE) }));
  return petsForSale(portId, Math.floor(game.wallNow() / 86_400_000)).map((pet) => ({ pet, price: PETS[pet].price }));
}

// ------------------------------------------------------------------ the view

function sendHoliday(game: Game, s: PlayerSession): void {
  const h = currentHoliday(game);
  const S = hs(game);
  let view: HolidayView;
  if (!h) {
    const n = nextHoliday(game.wallNow());
    view = { id: null, next: n.id, nextIn: Math.ceil((n.start - game.wallNow()) / 1000), endsIn: 0, board: [], mine: 0, kegs: [] };
  } else {
    const sc = scores(game, `${h.id}:${h.start}`);
    const board = Object.values(sc.pts).sort((a, b) => b.pts - a.pts).slice(0, 5);
    const ship = s.ship;
    const kegs: [number, number][] = [];
    if (ship && !ship.docked) for (const list of S.kegs.values()) for (const k of list) if (Math.hypot(k.x - ship.state.x, k.y - ship.state.y) < 3000) kegs.push([k.x, k.y]);
    view = { id: h.id, next: null, nextIn: 0, endsIn: Math.ceil((h.end - game.wallNow()) / 1000), board, mine: sc.pts[s.accountId]?.pts ?? 0, kegs };
  }
  game.sendTo(s, { t: 'holiday', view });
}
