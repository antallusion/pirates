// Letters of marque (docs/12 P10 #15) on the server: enlisting at a port of the flag (the Crown, the League or the
// Brethren), merit and ranks from midshipman to commodore (and the title that goes with each), the day's pay drawn in
// the service's ports, fleet orders to be done by sunset (intercept a quarry off a port, sink the flag's enemies in a
// sea, bring goods, patrol off a port), the service's quartermaster, the livery, and the letter revoked for crimes.

import { DAY_LENGTH_SEC, timeOfDay } from '../../../shared/src/constants.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { itemValue, makeItem } from '../../../shared/src/data/items.ts';
import { encodeLook } from '../../../shared/src/data/looks.ts';
import {
  BAN_MS, MARK_R, ORDER_FAIL_MERIT, ORDER_MIN_SEC, ORDER_NEED, ORDER_PAY, QUARRY_R, RANK_DISCOUNT, RANK_PAY, RANK_RARITY,
  RANKS, SERVICES, SERVICE_IDS, SUNSET_HOUR, liveryOf, rankOf, serviceTitle,
} from '../../../shared/src/data/marque.ts';
import type { OrderKind, ServiceId } from '../../../shared/src/data/marque.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { wantedLevel } from '../../../shared/src/data/factions.ts';
import type { ServiceOrderView, ServicePortView, ServiceView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { planWander } from './npc.ts';
import { unlockDeed } from './looks.ts';
import { changeRep } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

export interface ServiceOrder {
  kind: OrderKind;
  port: string;
  region: RegionId;
  n: number;
  need: number;
  /** Game seconds: sunset. */
  until: number;
  good?: GoodId;
  marks?: [number, number][];
  passed?: number[];
  target?: number | null;
}

export interface ServiceRec {
  id: ServiceId;
  merit: number;
  rank: number;
  /** The wall-clock day her pay was last drawn. */
  payDay: number;
  order: ServiceOrder | null;
  /** The quartermaster's pieces bought ("day:port:index"). */
  bought: string[];
}

const DAY_MS = 86_400_000;
const today = (game: Game) => Math.floor(game.wallNow() / DAY_MS);

/** An old Crown letter (the oath at Gravesend) is the Crown's service at its first rank. */
export function sanitizeService(p: Profile): ServiceRec | null {
  if (!p.service && p.oath === 'marque') p.service = { id: 'crown', merit: 0, rank: 0, payDay: -1, order: null, bought: [] };
  if (p.service) {
    p.service.bought ??= [];
    p.service.rank ??= rankOf(p.service.merit);
  }
  return p.service ?? null;
}

function portService(port: Port): ServiceId | null {
  return (SERVICE_IDS as string[]).includes(port.faction) ? (port.faction as ServiceId) : null;
}

/** Why she may not enlist here (null: she may). */
export function enlistBlocked(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  const id = portService(port);
  if (!id) return 'No service is taken here.';
  if (sanitizeService(p)) return 'You already serve.';
  if ((p.serviceBan ?? 0) > game.wallNow()) return 'No service takes you yet: wait a day after losing a letter.';
  const def = SERVICES[id];
  if ((p.reputation[id] ?? 0) < def.rep) return `Your standing is too low (needs ${def.rep}).`;
  if (wantedLevel(p.infamy) > Math.min(def.maxWanted, id === 'confederacy' ? 5 : 0)) return 'Not while you are wanted.';
  if (id !== 'confederacy' && p.oath === 'code') return 'A captain sworn to the Code serves no lawful flag.';
  if (id === 'confederacy' && p.oath === 'marque') return 'A captain under a Crown letter does not serve the Brethren.';
  return null;
}

function setTitle(p: Profile, id: ServiceId, rank: number): void {
  const mine = new Set(RANKS.map((_, r) => serviceTitle(id, r)));
  const had = p.title && mine.has(p.title);
  p.titles = p.titles.filter((t) => !mine.has(t));
  const t = serviceTitle(id, rank);
  p.titles.push(t);
  if (had || !p.title) p.title = t;
}

function dropTitles(p: Profile): void {
  const all = new Set(SERVICE_IDS.flatMap((id) => RANKS.map((_, r) => serviceTitle(id, r))));
  p.titles = p.titles.filter((t) => !all.has(t));
  if (p.title && all.has(p.title)) p.title = null;
}

function refresh(game: Game, s: PlayerSession): void {
  if (s.ship) {
    s.ship.title = s.profile!.title;
    game.refreshInfo(s.ship);
  }
  game.pushSelf(s, true);
}

export function enlist(game: Game, s: PlayerSession, port: Port): string | null {
  const why = enlistBlocked(game, s, port);
  if (why) return why;
  const p = s.profile!;
  const id = portService(port)!;
  p.service = { id, merit: 0, rank: 0, payDay: -1, order: null, bought: [] };
  if (id === 'crown' && !p.oath) p.oath = 'marque';
  changeRep(p, id, 5);
  setTitle(p, id, 0);
  game.sendTo(s, { t: 'toast', msg: `You enter the service: ${SERVICES[id].name[0]}.`, kind: 'good' });
  payDay(game, s, port);
  refresh(game, s);
  return null;
}

function leave(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const sv = p.service;
  if (!sv) return;
  const quarry = sv.order?.target ? game.ships.get(sv.order.target) : null;
  if (quarry?.alive) game.removeShip(quarry.id);
  // The livery comes down with the letter.
  const liv = SERVICE_IDS.flatMap((id) => [0, 3, 4].map((r) => encodeLook(liveryOf(id, r))));
  if (p.look && liv.includes(encodeLook(p.look))) {
    delete p.look;
    if (s.ship) s.ship.look = null;
  }
  if (p.oath === 'marque') p.oath = null;
  p.service = null;
  dropTitles(p);
}

export function resign(game: Game, s: PlayerSession): string | null {
  if (!sanitizeService(s.profile!)) return 'You serve no one.';
  leave(game, s);
  game.sendTo(s, { t: 'toast', msg: 'You leave the service.', kind: 'info' });
  refresh(game, s);
  return null;
}

/** The letter taken away: the service's standing lost, a day before any flag takes her again. */
export function revoke(game: Game, s: PlayerSession, reason: string): void {
  const p = s.profile!;
  const sv = p.service;
  if (!sv) return;
  changeRep(p, sv.id, -30);
  leave(game, s);
  p.serviceBan = game.wallNow() + BAN_MS;
  game.sendTo(s, { t: 'toast', msg: `Your letter of marque is revoked: ${reason}.`, kind: 'bad' });
  refresh(game, s);
}

function payDay(game: Game, s: PlayerSession, port: Port): void {
  const sv = s.profile!.service;
  if (!sv || portService(port) !== sv.id || sv.payDay === today(game)) return;
  sv.payDay = today(game);
  const pay = RANK_PAY[sv.rank];
  s.profile!.gold += pay;
  game.db.ledger(s.accountId, 'service_pay', pay, sv.id);
  game.sendTo(s, { t: 'toast', msg: `Your pay: ${pay} silver.`, kind: 'gold' });
}

/** Game seconds of the next sunset at least a quarter of an hour away. */
export function sunsetAfter(now: number): number {
  const tod = timeOfDay(now);
  let dt = ((SUNSET_HOUR / 24 - tod + 1) % 1) * DAY_LENGTH_SEC;
  if (dt < ORDER_MIN_SEC) dt += DAY_LENGTH_SEC;
  return now + dt;
}

function openAround(game: Game, x: number, y: number, r0: number, r1: number, rng: Rng): [number, number] | null {
  for (let k = 0; k < 40; k++) {
    const a = rng.float() * Math.PI * 2, r = r0 + rng.float() * (r1 - r0);
    const px = x + Math.sin(a) * r, py = y - Math.cos(a) * r;
    if (!isLand(game.world, px, py) && game.inZone(px, py)) return [Math.round(px), Math.round(py)];
  }
  return null;
}

/** A fleet order at a port of the service: by sunset. */
export function takeOrder(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  const sv = sanitizeService(p);
  if (!sv) return 'You serve no one.';
  if (portService(port) !== sv.id) return 'This is not a port of your service.';
  if (sv.order) return 'You already have an order.';
  const def = SERVICES[sv.id];
  const rng = game.rng;
  const kind = rng.pick(def.orders);
  const local = game.world.ports.filter((x) => x.region === port.region);
  let at = rng.pick(local.length ? local : [port]);
  const order: ServiceOrder = { kind, port: at.id, region: at.region, n: 0, need: ORDER_NEED[kind], until: sunsetAfter(game.now) };
  if (kind === 'deliver') {
    const ours = game.world.ports.filter((x) => x.faction === sv.id && x.id !== port.id).sort((a, b) => Math.hypot(a.x - port.x, a.y - port.y) - Math.hypot(b.x - port.x, b.y - port.y));
    at = ours.length ? rng.pick(ours.slice(0, 3)) : port;
    order.port = at.id;
    order.region = at.region;
    order.good = rng.pick(def.wants);
  }
  if (kind === 'patrol') {
    const marks: [number, number][] = [];
    for (let k = 0; k < 3; k++) {
      const m = openAround(game, at.x, at.y, 1500, 3200, rng);
      if (m) marks.push(m);
    }
    if (!marks.length) marks.push([Math.round(at.x), Math.round(at.y)]);
    order.marks = marks;
    order.passed = [];
    order.need = marks.length;
  }
  if (kind === 'intercept') order.target = null;
  sv.order = order;
  game.sendTo(s, { t: 'toast', msg: orderText(game, sv.id, order), kind: 'info' });
  game.pushSelf(s, true);
  return null;
}

export function orderText(game: Game, id: ServiceId, o: ServiceOrder): string {
  const port = game.portById(o.port)?.name ?? o.port;
  switch (o.kind) {
    case 'intercept':
      return `Intercept ${SERVICES[id].quarry.what[0]} off ${port} by sunset.`;
    case 'hunt':
      return `Sink ${o.need} enemy ships in ${REGIONS[o.region].name} by sunset.`;
    case 'deliver':
      return `Bring ${o.need} ${GOODS[o.good!].name} to ${port} by sunset.`;
    case 'patrol':
      return `Patrol off ${port}: pass ${o.need} marks by sunset.`;
  }
}

function merit(game: Game, s: PlayerSession, d: number): void {
  const p = s.profile!;
  const sv = p.service!;
  sv.merit = Math.max(0, sv.merit + d);
  const r = rankOf(sv.merit);
  if (r > sv.rank) {
    sv.rank = r;
    setTitle(p, sv.id, r);
    changeRep(p, sv.id, 5);
    game.sendTo(s, { t: 'toast', msg: `You are promoted: ${serviceTitle(sv.id, r)}.`, kind: 'gold' });
    for (let k = 1; k <= r; k++) unlockDeed(game, s, `${sv.id}_${k}`); // the service's flags by rank (docs/12 P10 #12)
    refresh(game, s);
  }
}

function complete(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const sv = p.service!;
  const o = sv.order!;
  const pay = Math.round(ORDER_PAY[o.kind].silver * (1 + 0.25 * sv.rank));
  p.gold += pay;
  game.db.ledger(s.accountId, 'service_order', pay, o.kind);
  sv.order = null;
  changeRep(p, sv.id, 2);
  game.sendTo(s, { t: 'toast', msg: `Order done: ${pay} silver and merit.`, kind: 'gold' });
  merit(game, s, ORDER_PAY[o.kind].merit);
  game.pushSelf(s, true);
}

/** Every two seconds: the law's eye on the lawful services' officers; sunsets; the patrol marks; the quarry sails. */
export function stepService(game: Game): void {
  for (const s of game.sessions) {
    const p = s.profile;
    const sv = p ? sanitizeService(p) : null;
    if (!p || !sv) continue;
    if (wantedLevel(p.infamy) > SERVICES[sv.id].maxWanted) {
      revoke(game, s, 'you are wanted');
      continue;
    }
    const o = sv.order;
    if (!o) continue;
    if (game.now > o.until) {
      const q = o.target ? game.ships.get(o.target) : null;
      if (q?.alive) game.removeShip(q.id);
      sv.order = null;
      sv.merit = Math.max(0, sv.merit - ORDER_FAIL_MERIT);
      game.sendTo(s, { t: 'toast', msg: 'The order is failed: sunset came first.', kind: 'bad' });
      game.pushSelf(s, true);
      continue;
    }
    const ship = s.ship;
    if (!ship || ship.docked || !ship.alive) continue;
    if (o.kind === 'patrol' && o.marks) {
      o.passed ??= [];
      o.marks.forEach(([mx, my], i) => {
        if (!o.passed!.includes(i) && Math.hypot(ship.state.x - mx, ship.state.y - my) <= MARK_R) {
          o.passed!.push(i);
          o.n = o.passed!.length;
          game.pushSelf(s, true);
        }
      });
      if (o.n >= o.need) complete(game, s);
    }
    if (o.kind === 'intercept') {
      const port = game.portById(o.port);
      const q = o.target ? game.ships.get(o.target) : null;
      if (o.target && !q?.alive) o.target = null; // lost or sunk by another: another comes out
      if (!o.target && port && Math.hypot(ship.state.x - port.x, ship.state.y - port.y) < 7000) {
        const spot = openAround(game, port.x, port.y, 900, QUARRY_R, game.rng);
        if (!spot) continue;
        const def = SERVICES[sv.id];
        const lv = Math.max(1, ship.shipLevel);
        const cls = game.rng.pick(hullsFor(def.quarry.role, lv));
        const npc = game.spawnNpcShip(def.quarry.role, cls, def.quarry.faction, spot[0], spot[1], game.rng.float() * Math.PI * 2);
        game.setNpcLevel(npc, lv);
        if (def.quarry.role === 'merchant') npc.cargo = sv.id === 'crown' ? { dreamleaf: 12, rum: 10 } : { spices: 14, cloth: 12 };
        const brain = game.npcs.get(npc.id);
        if (brain) {
          brain.active = true;
          brain.area = { x: port.x, y: port.y, r: QUARRY_R };
          brain.expiresAt = o.until + 60;
          planWander(game, npc, brain);
        }
        game.grid.upsert(npc.id, npc.state.x, npc.state.y);
        o.target = npc.id;
        game.sendTo(s, { t: 'toast', msg: `Your quarry is at sea off ${port.name}.`, kind: 'info' });
        game.pushSelf(s, true);
      }
    }
  }
}

/** A ship sunk or taken by her: the flag's enemies pay and count; her own flag's ships cost her the letter. */
export function serviceKill(game: Game, s: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const p = s.profile!;
  const sv = sanitizeService(p);
  if (!sv || victim.isPlayer || victim.cls.monster) return;
  const def = SERVICES[sv.id];
  const o = sv.order;
  if (o?.kind === 'intercept' && victim.id === o.target) {
    o.n = 1;
    complete(game, s);
    return;
  }
  if (victim.faction === sv.id) {
    revoke(game, s, 'you fired on your own flag');
    return;
  }
  const enemy = def.enemies.includes(victim.faction as never) || (sv.id !== 'confederacy' && victim.npcRole === 'pirate');
  if (!enemy) return;
  const pay = 50 * victim.cls.tier;
  p.gold += pay;
  game.db.ledger(s.accountId, 'marque', pay, victim.name);
  changeRep(p, sv.id, 1);
  merit(game, s, 2 * victim.cls.tier + (how === 'boarded' ? 2 : 0));
  if (o?.kind === 'hunt' && victim.region === o.region) {
    o.n++;
    if (o.n >= o.need) complete(game, s);
    else game.pushSelf(s, true);
  }
}

/** In port: the day's pay at the service's ports; goods of an order handed over at its port. */
export function serviceOnDock(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!;
  const sv = sanitizeService(p);
  if (!sv) return;
  payDay(game, s, port);
  const o = sv.order;
  if (o?.kind === 'deliver' && o.port === port.id && o.good && s.ship) {
    const have = Math.floor(s.ship.cargo[o.good] ?? 0);
    const n = Math.min(have, o.need - o.n);
    if (n > 0) {
      s.ship.cargo[o.good] = have - n;
      if (!s.ship.cargo[o.good]) delete s.ship.cargo[o.good];
      o.n += n;
      game.sendTo(s, { t: 'toast', msg: `Delivered for the service: ${n} ${GOODS[o.good].name}.`, kind: 'good' });
      if (o.n >= o.need) complete(game, s);
    }
  }
}

/** The quartermaster's stores today at this port: three pieces for her rank, bound, at her rank's discount. */
function wares(game: Game, s: PlayerSession, port: Port): { item: ReturnType<typeof makeItem>; price: number; key: string }[] {
  const p = s.profile!;
  const sv = p.service!;
  const day = today(game);
  const rng = new Rng((s.accountId * 7919 + day * 104729 + port.id.length * 31 + port.id.charCodeAt(0)) >>> 0);
  const lv = Math.max(1, s.ship?.shipLevel ?? p.loadout.level ?? 1);
  return [0, 1, 2].map((i) => {
    const it = makeItem(rng, -(i + 1), { ilvl: lv, rarity: RANK_RARITY[sv.rank] as 1 });
    it.bound = true;
    return { item: it, price: Math.round(itemValue(it) * (1 - RANK_DISCOUNT[sv.rank])), key: `${day}:${port.id}:${i}` };
  });
}

export function buyWare(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const sv = sanitizeService(p);
  if (!sv) return 'You serve no one.';
  if (portService(port) !== sv.id) return 'This is not a port of your service.';
  const w = wares(game, s, port)[index];
  if (!w || sv.bought.includes(w.key)) return 'The quartermaster has nothing more for you today.';
  if (p.stash.length >= 40) return 'Your locker is full';
  if (p.gold < w.price) return 'Not enough silver';
  p.gold -= w.price;
  game.db.ledger(s.accountId, 'service_store', -w.price, w.item.base);
  p.stash.push({ ...w.item, uid: p.itemSeq++ });
  sv.bought = [...sv.bought.filter((k) => k.startsWith(`${today(game)}:`)), w.key];
  return null;
}

/** The service's colours on her ship, in port. */
export function flyLivery(game: Game, s: PlayerSession): string | null {
  const p = s.profile!;
  const sv = sanitizeService(p);
  if (!sv) return 'You serve no one.';
  if (!s.ship?.docked) return 'The livery is flown in port.';
  p.look = liveryOf(sv.id, sv.rank);
  s.ship.look = encodeLook(p.look);
  game.refreshInfo(s.ship);
  game.sendTo(s, { t: 'toast', msg: 'The service livery is flown.', kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

export function serviceView(game: Game, p: Profile): ServiceView | null {
  const sv = sanitizeService(p);
  if (!sv) return null;
  const o = sv.order;
  let order: ServiceOrderView | null = null;
  if (o) {
    const port = game.portById(o.port);
    const q = o.target ? game.ships.get(o.target) : null;
    order = {
      kind: o.kind, text: orderText(game, sv.id, o), n: o.n, need: o.need, until: o.until, port: o.port,
      x: Math.round(q?.alive ? q.state.x : port?.x ?? 0), y: Math.round(q?.alive ? q.state.y : port?.y ?? 0),
      ...(o.marks ? { marks: o.marks.filter((_, i) => !(o.passed ?? []).includes(i)) } : {}),
      ...(o.kind === 'intercept' ? { target: o.target ?? null } : {}),
    };
  }
  return { id: sv.id, rank: sv.rank, merit: sv.merit, order };
}

export function servicePortView(game: Game, s: PlayerSession, port: Port): ServicePortView {
  const p = s.profile!;
  const sv = sanitizeService(p);
  const offer = portService(port);
  const mine = !!sv && sv.id === offer;
  return {
    offer,
    blocked: sv ? null : offer ? enlistBlocked(game, s, port) : null,
    pay: sv ? RANK_PAY[sv.rank] : offer ? RANK_PAY[0] : 0,
    payReady: mine && sv!.payDay !== today(game),
    wares: mine ? wares(game, s, port).map((w) => ({ item: w.item, price: w.price, sold: sv!.bought.includes(w.key) })) : [],
  };
}
