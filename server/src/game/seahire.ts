// A ship of the sea hired at sea as a guard for 10–20 minutes (owner, 2026-10-25; the numbers in
// shared/src/data/seahire.ts). She taps a peaceful ship of her own ⚓ within the hail — «Нанять в охрану» — sees the ship,
// the three contracts and their prices against her silver, and pays. The ship then:
//  - leaves her course and keeps station off her captain's beam (npc.ts hireStation), through autosail and every course;
//  - answers whoever fires on her captain or on her, and her captain's own mark once she fires on it or orders the attack
//    (npc.ts hiredFoe); starts nothing herself, and never fires on a captain in safe water — elsewhere her captain's
//    colours rule her guns (combat.ts damageBlocked → pvp.ts, captainShip);
//  - keeps out of the battles (inbattle.ts): her captain at the rails or ashore is nobody's to touch, the ship grappled
//    with her nobody's either — the escort lies by her and guards her hull, she cannot join the fight;
//  - does not follow into port: she lies off the harbour (npc.ts waitOffHarbour), the clock running;
//  - sunk: the contract is over, nothing back; dismissed early: nothing back; the time out: she says goodbye and goes back
//    to her own course (npc.ts resumeCourse).
// What she sinks is her captain's as a group mate's is (Game.ts creditKill): a share of the lesson and the quest's count,
// not the kill's prize nor the claim on its wreck — unless her captain fought that ship herself.
// No exploits: the price goes nowhere a captain can take it back from (the ship's purse is untouched); no refund ever, so
// no dismiss-and-rehire loop pays; the same ship will not sign on with the same captain again for REHIRE_SEC; a ship in
// any fight, fired on by anyone, or on another's business cannot be hired (no stealing another captain's prey).

import { HIRE_MINUTES, HIRE_REACH, HIRE_ROLES, REHIRE_SEC, hirePrice, hireRefund, hireSlots, powerMul } from '../../../shared/src/data/seahire.ts';
import type { HireEscort, HireOffer, HireView, SavedHire } from '../../../shared/src/data/seahire.ts';
import { hullOf, hullsGap } from '../../../shared/src/data/reach.ts';
import { shipBandOf } from '../../../shared/src/data/xpcurve.ts';
import { NPC_VOLLEYS } from '../../../shared/src/data/seabalance.ts';
import { SELF_IN_BATTLE_WHY, untouchable } from './inbattle.ts';
import { HIRE_WAIT_R, hireStation, npcHostileTo, openSea, resumeCourse } from './npc.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { fightingPower } from './struck.ts';
import type { Game } from './Game.ts';
import type { NpcRole, ShipEntity } from './ship.ts';
import type { PlayerSession } from './player.ts';

/** What she was before the contract, put back after it. */
interface Saved {
  role: NpcRole;
  npcRole: NpcRole | null;
  expiresAt: number;
}

export interface Hire {
  shipId: number;
  account: number;
  until: number;
  minutes: number;
  paid: number;
  saved: Saved;
  /** The last «under fire» said. */
  warnedAt: number;
}

interface HireBook {
  /** account → her contracts. */
  by: Map<number, Hire[]>;
  /** `${account}:${shipId}` → no new contract before. */
  rest: Map<string, number>;
}

const books = new WeakMap<Game, HireBook>();
function book(game: Game): HireBook {
  let b = books.get(game);
  if (!b) books.set(game, (b = { by: new Map(), rest: new Map() }));
  return b;
}

/** Her contracts now. */
export function hiresOf(game: Game, account: number): Hire[] {
  return book(game).by.get(account) ?? [];
}

/** The contract a ship is under, if any. */
export function hireOfShip(game: Game, ship: ShipEntity): Hire | undefined {
  return ship.hiredBy !== undefined ? hiresOf(game, ship.hiredBy).find((h) => h.shipId === ship.id) : undefined;
}

/** The fight left in her against her whole (0..1). */
function condition(npc: ShipEntity): number {
  const whole = Math.max(1, npc.stats.hullMax) * (1 + npc.stats.gunsPerSide * 2);
  return Math.min(1, fightingPower(npc) / whole);
}

/** The prices of HIRE_MINUTES of her. */
export function pricesOf(npc: ShipEntity): number[] {
  const pw = powerMul(npc.loadout.classId, npc.shipLevel, !!npc.elite);
  const c = condition(npc);
  return HIRE_MINUTES.map((m) => hirePrice(npc.shipLevel, m, pw, c));
}

/** Why she will not sign on with this captain now (a reason the card shows), or null. The captain's own state first. */
export function hireWhy(game: Game, s: PlayerSession, npc: ShipEntity | undefined): string | null {
  const ship = s.ship, p = s.profile;
  if (!ship || !p || !ship.alive || ship.docked || ship.landing) return 'Cannot do that now';
  if (untouchable(game, ship)) return SELF_IN_BATTLE_WHY;
  if (ship.inCombat(game.now) || ship.underFire(game.now)) return 'Not under fire: hire a guard when the sea is quiet';
  if (!npc || !npc.alive || npc.isPlayer || npc.ghost || npc.sinkingUntil) return 'She is not for hire';
  if (npc.hiredBy !== undefined) return npc.hiredBy === s.accountId ? 'She sails with you already' : 'She is hired by another captain';
  if (!npc.npcRole || !(HIRE_ROLES as readonly string[]).includes(npc.npcRole) || npc.cls.monster || !npc.onLadder) return 'She is not for hire';
  const b = game.npcs.get(npc.id);
  if (!b) return 'She is not for hire';
  // on other business: a convoy's, a caravan's, a guard's, a lair's, a named rover's, one sent after somebody, a prize
  if (npc.ownerId !== null || npc.prize || npc.fleetId || npc.convoyId !== undefined || npc.convoyOf || npc.escortOf !== undefined || npc.caravanId || npc.caravanOf !== null
    || npc.guardOf || npc.lairGuard || npc.named || npc.namedMate || npc.invader || npc.bossOf || npc.bossPart || npc.zoneBoss || npc.dutchman || npc.yardOf || npc.abyssSpawn || npc.elite
    || npc.softFor !== undefined || npc.lootLockedFor !== null || b.practice !== undefined || b.huntFor !== undefined || b.huntAccount !== null || b.keep || b.fireship !== undefined) return 'She sails on other orders: not for hire';
  if (npcHostileTo(game, npc, ship) || game.isHostile(ship, npc) || (npc.attackers.get(ship.id) ?? -999) > game.now - 300) return 'She is hostile to you: no hire';
  if (npc.surrendered || npc.boarding || npc.grappled || npc.inCombat(game.now) || npc.underFire(game.now) || b.target !== null || b.fleeFrom !== null) return 'She is in a fight: no hire now';
  // (anyone's shot at her lately — no hiring another captain's prey out from under her guns)
  for (const t of npc.attackers.values()) if (t > game.now - 120) return 'She is in a fight: no hire now';
  const band = shipBandOf(p.level);
  if (npc.shipLevel !== band) return `Only a ship of your own level (⚓${band}) will sign on: she is ⚓${npc.shipLevel}`;
  if (hullsGap(hullOf(npc), hullOf(ship)) > HIRE_REACH) return 'She is too far off to hail';
  if ((book(game).rest.get(`${s.accountId}:${npc.id}`) ?? 0) > game.now) return 'She served you only now: she keeps her own course a while';
  if (hiresOf(game, s.accountId).length >= hireSlots(band)) return hireSlots(band) > 1 ? 'Two guards sail with you already' : 'A guard sails with you already: dismiss her first';
  return null;
}

/** The card: the ship, her prices, the captain's silver, why not. */
export function hireOffer(game: Game, s: PlayerSession, npc: ShipEntity): HireOffer {
  const why = hireWhy(game, s, npc);
  // her hull as she will sail as a captain's guard (ship.ts recompute: no discount of the sea's on a captain's own)
  const asGuard = npc.seaScale && !npc.elite && npc.ownerId === null ? 1 / NPC_VOLLEYS : 1;
  return {
    id: npc.id, name: npc.name, classId: npc.loadout.classId, shipLevel: npc.shipLevel,
    guns: npc.stats.gunsPerSide, crew: npc.crew, crewMax: npc.stats.crewMax, hull: Math.round(npc.hull * asGuard), hullMax: Math.round(npc.stats.hullMax * asGuard),
    band: shipBandOf(s.profile?.level ?? 1), prices: pricesOf(npc), silver: Math.max(0, Math.floor(s.profile?.gold ?? 0)),
    ok: why === null, ...(why ? { why } : {}),
  };
}

/** Every captain who sees her looks again at her (her trade changed: an escort now, or her own again). */
function reinfo(game: Game, id: number): void {
  for (const x of game.sessions) {
    x.knownEntities.delete(id);
    x.sentRows.delete(id);
  }
}

/** She signs on: paid, her course left, her captain's from now for `minutes`. A string: why not (nothing taken). */
export function hire(game: Game, s: PlayerSession, id: number, minutes: number): string | null {
  const npc = game.ships.get(id);
  const why = hireWhy(game, s, npc);
  if (why) return why;
  const i = HIRE_MINUTES.indexOf(minutes as (typeof HIRE_MINUTES)[number]);
  if (i < 0) return 'Choose 10, 15 or 20 minutes';
  const n = npc!, ship = s.ship!, p = s.profile!;
  const price = pricesOf(n)[i];
  const gold = Math.floor(p.gold);
  if (gold < price) return `Not enough silver: ${price} asked, you have ${gold}`;
  p.gold -= price;
  game.db.ledger(s.accountId, 'sea_hire', -price, `${n.name} ${minutes} min`.slice(0, 120));
  bind(game, s, n, minutes, price, game.now + minutes * 60);
  game.toastShip(ship, `${n.name} signs on as your guard for ${minutes} minutes (${price} silver).`, 'good');
  game.pushSelf(s, true);
  sendHires(game, s);
  return null;
}

/** She is her captain's until `until`: the contract booked and kept with the profile, her course left. */
function bind(game: Game, s: PlayerSession, n: ShipEntity, minutes: number, price: number, until: number, back?: Partial<Saved>): Hire {
  const ship = s.ship!;
  const b = game.npcs.get(n.id)!;
  const list = hiresOf(game, s.accountId);
  const used = new Set(list.map((h) => game.ships.get(h.shipId)?.hireSlot));
  const slot = used.has(0) ? 1 : 0;
  const h: Hire = { shipId: n.id, account: s.accountId, until, minutes, paid: price, saved: { role: b.role, npcRole: n.npcRole, expiresAt: b.expiresAt, ...back }, warnedAt: -999 };
  book(game).by.set(s.accountId, [...list, h]);
  // Her captain's from now: her hull as a captain's own escort's (ship.ts recompute: no discount of the sea's), her
  // wounds kept as a share; the traffic's end of her life put off; a guard's trade for the others to see.
  const frac = n.hull / Math.max(1, n.stats.hullMax);
  n.ownerId = ship.id;
  n.hiredBy = s.accountId;
  n.hireSlot = slot;
  n.npcRole = 'escort';
  b.role = 'escort';
  b.expiresAt = 0;
  b.target = null;
  b.chase = null;
  b.fleeFrom = null;
  b.active = true;
  n.recompute(game.now);
  n.hull = Math.max(1, Math.round(n.stats.hullMax * frac));
  reinfo(game, n.id);
  keep(game, s);
  return h;
}

/** Her contracts as the profile keeps them (the real seconds left of each). */
export function keep(game: Game, s: PlayerSession): void {
  if (!s.profile) return;
  const out: SavedHire[] = [];
  for (const h of hiresOf(game, s.accountId)) {
    const n = game.ships.get(h.shipId);
    if (!n) continue;
    out.push({ classId: n.loadout.classId, level: n.shipLevel, role: h.saved.npcRole ?? h.saved.role, faction: n.faction, name: n.name, captain: n.captainName, minutes: h.minutes, paid: h.paid, left: Math.max(0, Math.round(h.until - game.now)) });
  }
  s.profile.seaHire = out;
}

/** Her captain back at sea (a restart, a relog, a crossing): every contract the profile keeps sails again with the time
 *  left - beside her, or off the harbour when she is in port; one that cannot be put on the water gives back the unused
 *  share of its price. */
export function restoreHires(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  const saved = Array.isArray(p?.seaHire) ? p!.seaHire! : [];
  if (!p || !ship || !saved.length || hiresOf(game, s.accountId).length) return;
  p.seaHire = [];
  for (const r of saved) {
    if (r.left < 5 || !SHIP_CLASSES[r.classId]) continue;
    const spot = restoreSpot(game, ship, hiresOf(game, s.accountId).length);
    if (!spot) {
      const back = hireRefund(r);
      if (back > 0) {
        p.gold += back;
        game.db.ledger(s.accountId, 'sea_hire_back', back, r.name.slice(0, 120));
      }
      game.toastShip(ship, `${r.name} could not rejoin you: ${back} silver of the contract is returned.`, 'info');
      continue;
    }
    const role = (HIRE_ROLES as readonly string[]).includes(r.role) ? (r.role as NpcRole) : 'merchant';
    const n = game.spawnNpcShip(role, r.classId, (r.faction in FACTIONS ? r.faction : 'league') as FactionId, spot.x, spot.y, ship.state.heading, { ship: r.name, captain: r.captain });
    game.setNpcLevel(n, r.level);
    n.region = game.regionAt(spot.x, spot.y);
    game.grid.upsert(n.id, spot.x, spot.y);
    // (once the contract is done she is the sea's own, and goes when no captain is near)
    bind(game, s, n, r.minutes, r.paid, game.now + r.left, { expiresAt: game.now + 120 });
    game.toastShip(ship, `${r.name} rejoins you: ${Math.ceil(r.left / 60)} min left of her contract.`, 'good');
  }
  keep(game, s);
  sendHires(game, s);
}

/** Open water for a guard put back: off her beam at sea, off the harbour in port; null when there is none. */
function restoreSpot(game: Game, ship: ShipEntity, slot: number): { x: number; y: number } | null {
  if (ship.docked) {
    const port = game.portById(ship.docked) ?? game.nearestPort(ship.state.x, ship.state.y);
    if (!port) return null;
    for (const r of [HIRE_WAIT_R, HIRE_WAIT_R + 200, HIRE_WAIT_R + 450]) for (let a = 0; a < 24; a++) {
      const x = port.x + Math.sin(a * 0.2618) * r, y = port.y - Math.cos(a * 0.2618) * r;
      if (openSea(game, x, y)) return { x, y };
    }
    return null;
  }
  const f = headingVec(ship.state.heading), rv = headingVec(ship.state.heading + Math.PI / 2);
  const st = hireStation(slot);
  for (const k of [1, 1.6, 2.4, 3.5]) {
    for (const side of [1, -1]) {
      const x = ship.state.x + f.x * st.y * k + rv.x * st.x * k * side, y = ship.state.y + f.y * st.y * k + rv.y * st.x * k * side;
      if (openSea(game, x, y)) return { x, y };
    }
  }
  return null;
}

/** The contract is over (`how`): she is her own again — her trade, her course, her hull as the sea's. Nothing back. */
export function endHire(game: Game, h: Hire, how: 'time' | 'dismissed' | 'sunk' | 'gone' | 'lost' | 'away'): void {
  const b0 = book(game);
  const list = (b0.by.get(h.account) ?? []).filter((x) => x !== h);
  if (list.length) b0.by.set(h.account, list);
  else b0.by.delete(h.account);
  b0.rest.set(`${h.account}:${h.shipId}`, game.now + REHIRE_SEC);
  const s = game.sessionByAccount(h.account);
  const npc = game.ships.get(h.shipId);
  const own = s?.ship ?? null;
  if (npc) {
    const frac = npc.hull / Math.max(1, npc.stats.hullMax);
    npc.effects = npc.effects.filter((e) => e.id !== 'hire_pace');
    npc.ownerId = null;
    npc.hiredBy = undefined;
    npc.hireSlot = 0;
    npc.npcRole = h.saved.npcRole;
    const b = game.npcs.get(npc.id);
    if (b) {
      b.role = h.saved.role;
      b.expiresAt = h.saved.expiresAt;
      if (how !== 'sunk') {
        // (she does not turn on her late captain for a while, whatever she was)
        b.spared.set(own?.id ?? -1, game.now + 120);
        resumeCourse(game, npc, b);
      }
    }
    npc.recompute(game.now);
    if (npc.alive) npc.hull = Math.max(1, Math.round(npc.stats.hullMax * frac));
    reinfo(game, npc.id);
  }
  const name = npc?.name ?? 'Your guard';
  if (own) {
    if (how === 'time') game.toastShip(own, `${name}: «Our contract is done, captain. Fair winds!» She returns to her course.`, 'info');
    else if (how === 'dismissed') game.toastShip(own, `${name} is dismissed and returns to her course. Nothing is refunded.`, 'info');
    else if (how === 'sunk') game.toastShip(own, `Your guard ${name} is sunk: the contract is over, nothing is refunded.`, 'bad');
    else if (how === 'gone') game.toastShip(own, `${name} lost sight of you and returns to her course.`, 'info');
  }
  // (her captain gone ashore for the night or into other waters: the profile keeps the contract, hiresAway)
  if (s && how !== 'away') {
    keep(game, s);
    sendHires(game, s);
  }
}

/** She sends a hired guard away early: nothing back. */
export function dismiss(game: Game, s: PlayerSession, id: number): string | null {
  const h = hiresOf(game, s.accountId).find((x) => x.shipId === id) ?? (id < 0 ? hiresOf(game, s.accountId)[0] : undefined);
  if (!h) return 'No guard of yours';
  endHire(game, h, 'dismissed');
  return null;
}

/** A hired guard goes down (Game.ts sink): before the sea's own bookkeeping, so she is the sea's again. */
export function hireSunk(game: Game, npc: ShipEntity): void {
  const h = hireOfShip(game, npc);
  if (h) endHire(game, h, 'sunk');
}

/** Her captain's ship is sunk: every guard goes, nothing back. */
export function hiresEnd(game: Game, account: number): void {
  for (const h of [...hiresOf(game, account)]) endHire(game, h, 'lost');
}

/** Her captain leaves the sea for now (logs off, crosses into another zone's waters): the guards go back to their
 *  courses here, but the profile keeps every contract with its time left, and it sails again with her (restoreHires). */
export function hiresAway(game: Game, s: PlayerSession): void {
  if (!hiresOf(game, s.accountId).length) return;
  keep(game, s);
  for (const h of [...hiresOf(game, s.accountId)]) endHire(game, h, 'away');
}

/** What the HUD's chip shows. */
export function hireView(game: Game, s: PlayerSession): HireView {
  const out: HireEscort[] = [];
  for (const h of hiresOf(game, s.accountId)) {
    const n = game.ships.get(h.shipId);
    if (!n) continue;
    out.push({ id: n.id, name: n.name, classId: n.loadout.classId, shipLevel: n.shipLevel, until: Math.round(h.until), hull: Math.round(n.hull), hullMax: n.stats.hullMax, x: Math.round(n.state.x), y: Math.round(n.state.y), ...(s.ship?.docked ? { waiting: true } : {}) });
  }
  return { escorts: out, slots: hireSlots(shipBandOf(s.profile?.level ?? 1)) };
}

export function sendHires(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'seahire', view: hireView(game, s) });
}

/** Once a second: the clock, her guard's hull for the chip, «under fire», a guard far behind brought up (a course her
 *  guard could not follow), a captain gone. */
export function stepHires(game: Game): void {
  const now = game.now;
  for (const [acc, list] of [...book(game).by]) {
    const s = game.sessionByAccount(acc);
    const own = s?.ship ?? null;
    for (const h of [...list]) {
      const n = game.ships.get(h.shipId);
      if (!n || !n.alive) {
        if (!n) endHire(game, h, 'gone');
        continue; // (going down: the sink's own hook ends it)
      }
      if (!s || !own || !own.alive) {
        endHire(game, h, 'lost');
        continue;
      }
      if (n.ownerId !== own.id) n.ownerId = own.id; // (a new hull of hers under the same captain)
      if (now >= h.until) {
        endHire(game, h, 'time');
        continue;
      }
      // She keeps up with her captain (QA 2026-10-25: a brig of the sea trailed a captain's tuned hull by two cables under
      // full sail): her way lifted to a tenth over her captain's, never cut below her own.
      const cur = n.effects.find((e) => e.id === 'hire_pace')?.mods?.maxSpeed ?? 0;
      const base = n.stats.maxSpeed / Math.max(0.2, 1 + cur);
      const want = Math.max(0, Math.min(1, (own.stats.maxSpeed * 1.1) / Math.max(0.1, base) - 1));
      if (Math.abs(want - cur) > 0.02) n.addEffect({ id: 'hire_pace', until: Infinity, mods: { maxSpeed: Math.round(want * 100) / 100 } }, now);
      if (n.underFire(now) && now - h.warnedAt > 20) {
        h.warnedAt = now;
        game.toastShip(own, `Your guard ${n.name} is under fire!`, 'bad');
      }
      // Far behind her (a passage, a long run she could not keep up with): brought up off her beam, out of any fight only.
      if (!own.docked && !n.inCombat(now) && Math.hypot(n.state.x - own.state.x, n.state.y - own.state.y) > 1800) {
        const st = hireStation(n.hireSlot), f = headingVec(own.state.heading), r = headingVec(own.state.heading + Math.PI / 2);
        n.state.x = own.state.x + f.x * st.y + r.x * st.x;
        n.state.y = own.state.y + f.y * st.y + r.y * st.x;
        n.state.heading = own.state.heading;
        game.grid.upsert(n.id, n.state.x, n.state.y);
      }
    }
    if (s) keep(game, s);
    if (s && Math.floor(now) % 2 === 0) sendHires(game, s);
  }
}

/** The client's messages: `quote` a ship, `hire` her for minutes, `dismiss` a guard. */
export function seaHireMessage(game: Game, s: PlayerSession, msg: { op?: unknown; id?: unknown; minutes?: unknown }): void {
  const id = Math.trunc(Number(msg.id));
  if (msg.op === 'dismiss') {
    const err = dismiss(game, s, Number.isFinite(id) ? id : -1);
    if (err) game.sendTo(s, { t: 'toast', msg: err, kind: 'bad' });
    return;
  }
  const npc = Number.isFinite(id) ? game.ships.get(id) : undefined;
  if (msg.op === 'hire') {
    const err = hire(game, s, id, Math.trunc(Number(msg.minutes)));
    if (err) {
      game.sendTo(s, { t: 'toast', msg: err, kind: 'bad' });
      if (npc) game.sendTo(s, { t: 'seahire_offer', offer: hireOffer(game, s, npc) });
    } else game.sendTo(s, { t: 'seahire_offer', offer: null });
    return;
  }
  if (!npc || npc.isPlayer || !npc.npcRole) {
    game.sendTo(s, { t: 'toast', msg: 'She is not for hire', kind: 'bad' });
    return;
  }
  game.sendTo(s, { t: 'seahire_offer', offer: hireOffer(game, s, npc) });
}

/** Tests: forget every contract and rest. */
export function resetHires(game: Game): void {
  books.delete(game);
}
