// «Каперский патент» on the server (the rules and numbers: shared/src/data/patent.ts). Hooks, each on the old road:
//   flaglaw.ts peaceBlocked   — the patent's prey is hers under the city flag; its own and allied ships refused; a ship
//                               neither enemy nor ally may be fired on (piracy, below);
//   colours.ts coloursBlocked — a privateer and a captain flying an enemy city's flag are fair game for each other;
//              hasPennant     — a privateer flies no Green Pennant;
//              coloursSecond  — other colours up: the patent is void;
//   pvp.ts legalTarget, pvpFlags (SF.PRIVATEER);  combat.ts registerAggression — piracy: the patent burnt, a skull;
//   npc.ts npcHostileTo      — the enemy's patrols and hunters come for her in their waters;
//   player.ts canDock        — the enemy's harbours shut;
//   Game.ts                  — the issuer's fifth of the purse, the ransom and the wreck's silver; standing on a kill;
//   pvprank.ts               — three quarters of the PvP points.

import { lackSilver } from '../../../shared/src/data/buyfail.ts';
import { FACTIONS, WANTED_THRESHOLDS, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { RANK_DISCOUNT } from '../../../shared/src/data/marque.ts';
import { SKULL_PAD } from '../../../shared/src/data/colours.ts';
import {
  PATENT_CUT, PATENT_LEVEL, PATENT_MAX_MS, PATENT_MS, PATENT_REP_BOARDED, PATENT_REP_SUNK, PATENT_SALLY_R, PATENT_SALLY_SEC, PATENT_SAY,
  PATENT_WATERS_R, isIssuer, patentAllies, patentBought, patentClash, patentEnemies, patentPrice, patentTithe, stanceOf,
} from '../../../shared/src/data/patent.ts';
import { resign, sanitizeService } from './marque.ts';
import type { ServiceRec } from './marque.ts';
import type { PatentIssuer } from '../../../shared/src/data/patent.ts';
import type { PatentOfferView, PatentView } from '../../../shared/src/protocol.ts';
import { dist } from '../../../shared/src/math.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { cityOf, coloursOf, lawless } from './colours.ts';
import type { Game } from './Game.ts';
import { captainBehind, peacefulNpc, sallyFrom } from './flaglaw.ts';
import { changeRep } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** Her patent in her save (p.pvp.patent): whose, and until when (wall ms). */
export interface PatentRec {
  by: PatentIssuer;
  until: number;
  since: number;
}

/** Her patent while it runs (and her colours are still its city's), else null. */
export function patentOf(game: Game, p: Profile | null | undefined): PatentRec | null {
  const r = p?.pvp?.patent;
  if (!r || r.until <= game.wallNow()) return null;
  if (coloursOf(p) !== 'faction' || p!.pvp.city !== r.by) return null;
  return r;
}

/** The flag a ship's captain holds a patent of (her own ship or one of hers), else null. */
export function privateerOf(game: Game, ship: ShipEntity | null | undefined): PatentIssuer | null {
  const cap = captainBehind(game, ship);
  return cap ? patentOf(game, game.profileOf(cap))?.by ?? null : null;
}

/** What `b` is to a privateer of `by`: her prey, a ship her patent protects, a ship whose taking is piracy, or none of
 *  these (the old rules decide: a monster, a captain under colours that are no business of the patent's). */
export type PatentMark = 'prey' | 'protected' | 'piracy' | null;
export function markFor(game: Game, by: PatentIssuer, b: ShipEntity): PatentMark {
  const capB = captainBehind(game, b);
  if (capB) {
    const pb = game.profileOf(capB);
    if (!pb) return null;
    const c = coloursOf(pb);
    if (c === 'pirate') return 'prey';
    if (c === 'faction' && stanceOf(by, cityOf(game, pb)) === 'enemy') return 'prey';
    return null;
  }
  if (b.isPlayer || b.cls.monster || b.npcRole === 'beast' || b.npcRole === 'ghost' || b.npcRole === 'boss') return null;
  if (b.npcRole === 'pirate') return 'prey';
  if (b.faction === 'player' || !FACTIONS[b.faction]) return null;
  const st = stanceOf(by, b.faction);
  if (st === 'enemy') return 'prey';
  if (!peacefulNpc(game, b)) return null;
  return st === 'other' ? 'piracy' : 'protected';
}

/** `a` (a privateer's ship or one of hers) and `b`: her patent's word on it, or null. */
export function patentMark(game: Game, a: ShipEntity, b: ShipEntity): PatentMark {
  const by = privateerOf(game, a);
  return by ? markFor(game, by, b) : null;
}

/** A privateer and a captain flying her enemies' city flag (either way round): fair game for each other. */
export function patentFoes(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  const one = (x: ShipEntity, y: ShipEntity): boolean => {
    const by = privateerOf(game, x);
    if (!by) return false;
    const py = game.profileOf(y);
    return !!py && coloursOf(py) === 'faction' && stanceOf(by, cityOf(game, py)) === 'enemy';
  };
  return one(a, b) || one(b, a);
}

/** Why the patent keeps `a` off the peaceful ship `b` (its own flag's or an ally's), null when it lets her (prey, or
 *  piracy by her own hand), or undefined when it has no word (no patent). An escort of hers commits no piracy. */
export function patentPeace(game: Game, a: ShipEntity, b: ShipEntity): string | null | undefined {
  const m = patentMark(game, a, b);
  if (m === 'prey') return null;
  if (m === 'protected') return PATENT_SAY.protectedShip;
  if (m === 'piracy') return a.isPlayer ? null : PATENT_SAY.protectedShip;
  return undefined;
}

/** The infamy an act of piracy lands her at (a skull and its pad), else 0 — and the patent is burnt. Asked on the
 *  engagement's first blow (combat.ts registerAggression). */
export function piracyBlow(game: Game, a: ShipEntity, b: ShipEntity): number {
  if (!a.isPlayer || lawless(b) || patentMark(game, a, b) !== 'piracy') return 0;
  const p = game.profileOf(a)!;
  const s = game.sessionOf(a);
  if (s) voidPatent(game, s, PATENT_SAY.piracy);
  const lvl = wantedLevel(p.infamy);
  if (lvl >= WANTED_THRESHOLDS.length - 1) return 0;
  return Math.max(0, WANTED_THRESHOLDS[lvl + 1] + SKULL_PAD - p.infamy);
}

/** The patent struck off her, with why. */
export function voidPatent(game: Game, s: PlayerSession, why: string): void {
  const p = s.profile;
  if (!p?.pvp.patent) return;
  p.pvp.patent = null;
  game.sendTo(s, { t: 'toast', msg: why, kind: 'bad' });
  game.pushSelf(s, true);
}

/** Its price for her here: by her level, less her service's discount when she serves the issuer. */
export function patentCost(p: Profile, by: PatentIssuer): number {
  const base = patentPrice(p.level);
  const sv = p.service;
  const off = sv && sv.id === by ? RANK_DISCOUNT[sv.rank] ?? 0 : 0;
  return Math.round((base * (1 - off)) / 50) * 50;
}

/** Why the harbour will not sell her its patent now, or null. */
export function patentBlocked(game: Game, s: PlayerSession, port: Port | null | undefined): string | null {
  const p = s.profile!;
  if (!port || port.raft || !isIssuer(port.faction)) return PATENT_SAY.notLawful;
  const by = port.faction;
  if (p.level < PATENT_LEVEL) return PATENT_SAY.level;
  if (p.oath === 'code') return PATENT_SAY.code;
  if (wantedLevel(p.infamy) >= 1) return PATENT_SAY.skulls;
  if ((p.reputation[by] ?? 0) < -10) return PATENT_SAY.rep;
  const held = p.pvp.patent && p.pvp.patent.until > game.wallNow() ? p.pvp.patent : null;
  if (held && held.by !== by) return PATENT_SAY.other;
  if (coloursOf(p) !== 'faction' || cityOf(game, p) !== by) return PATENT_SAY.colours;
  if (held && held.until - game.wallNow() > PATENT_MAX_MS - PATENT_MS) return PATENT_SAY.max;
  return null;
}

/** Her service, if this patent is its enemy's (patentClash): bought only once she has said yes, and it ends the service. */
export function patentServiceClash(p: Profile, by: PatentIssuer): ServiceRec | null {
  const sv = sanitizeService(p);
  return sv && patentClash(sv.id, by) ? sv : null;
}

/** Buy (or renew) the patent of the harbour she is in. Her service stands — its rank, merit, pay and titles — unless the
 *  issuer is its enemy (forum, Эдуард, post 70): then `confirm` must be given (the card's warning said what is lost),
 *  and she leaves the service first. */
export function buyPatent(game: Game, s: PlayerSession, confirm = false): string | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return 'No ship';
  if (!ship.docked) return 'Patents are sold in port.';
  const port = game.portById(ship.docked);
  const why = patentBlocked(game, s, port);
  if (why) return why;
  const by = port!.faction as PatentIssuer;
  const cost = patentCost(p, by);
  if (p.gold < cost) return lackSilver(cost, p.gold);
  const clash = patentServiceClash(p, by);
  if (clash && !confirm) return PATENT_SAY.clash;
  if (clash) resign(game, s);
  p.gold -= cost;
  game.db.ledger(s.accountId, 'patent', -cost, by);
  const now = game.wallNow();
  const held = p.pvp.patent && p.pvp.patent.until > now && p.pvp.patent.by === by ? p.pvp.patent : null;
  p.pvp.patent = held ? { ...held, until: Math.min(held.until + PATENT_MS, now + PATENT_MAX_MS) } : { by, until: now + PATENT_MS, since: now };
  const days = Math.round((p.pvp.patent.until - now) / 86_400_000);
  game.sendTo(s, { t: 'toast', msg: patentBought(by, days, cost, !!held), kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** A harbour the patent is at war with (canDock): its quay is shut to her while it runs. */
export function patentDockRefused(p: Profile, faction: FactionId): boolean {
  const r = p.pvp?.patent;
  return !!r && coloursOf(p) === 'faction' && stanceOf(r.by, faction) === 'enemy';
}

/** The enemy's patrols and hunters (not a captain's, not hired) come for a privateer in their waters: within
 *  PATENT_WATERS_R of a harbour of their flag. */
export function patentHunted(game: Game, npc: ShipEntity, other: ShipEntity): boolean {
  if (!other.isPlayer || npc.ownerId !== null || npc.hiredBy !== undefined || npc.faction === 'player') return false;
  const by = privateerOf(game, other);
  if (!by || stanceOf(by, npc.faction) !== 'enemy') return false;
  const port = game.nearestPort(other.state.x, other.state.y, (pt) => pt.faction === npc.faction && !pt.raft);
  return !!port && dist(port.x, port.y, other.state.x, other.state.y) <= PATENT_WATERS_R;
}

/** The silver a privateer takes from her prey, less the issuer's fifth (told her once a take). `victim`: the ship the
 *  silver came from; a captain's purse, ransom or a wreck's casks. */
export function titheOf(game: Game, s: PlayerSession, by: PatentIssuer | null, gold: number): number {
  if (!by || gold <= 0) return gold;
  const cut = Math.round(gold * PATENT_CUT);
  if (cut <= 0) return gold;
  game.db.ledger(s.accountId, 'patent_cut', -cut, by);
  game.sendTo(s, { t: 'toast', msg: patentTithe(by, cut), kind: 'info' });
  return gold - cut;
}

/** The issuer whose fifth is owed on silver she took from `victim` (her patent's prey), else null. */
export function titheFor(game: Game, s: PlayerSession, victim: ShipEntity): PatentIssuer | null {
  const by = s.ship ? privateerOf(game, s.ship) : null;
  return by && markFor(game, by, victim) === 'prey' ? by : null;
}

/** A ship of her prey sunk or taken (Game.creditKill): standing with the issuer. */
export function patentKill(game: Game, s: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const by = titheFor(game, s, victim);
  if (by) changeRep(s.profile!, by, how === 'boarded' ? PATENT_REP_BOARDED : PATENT_REP_SUNK);
}

/** When the enemy's harbours last sent a ship after her, and which (captain's ship id). */
const sallies = new WeakMap<Game, Map<number, { at: number; id: number }>>();

/** Every second: the patent runs out, or is void (other colours up, a skull); the enemy's harbours send ships after her. */
export function stepPatent(game: Game): void {
  const wall = game.wallNow();
  let book = sallies.get(game);
  for (const s of game.sessions) {
    const p = s.profile;
    const r = p?.pvp.patent;
    if (!p || !r) continue;
    if (r.until <= wall) {
      voidPatent(game, s, PATENT_SAY.expired);
      continue;
    }
    if (wantedLevel(p.infamy) >= 1) {
      voidPatent(game, s, PATENT_SAY.wanted);
      continue;
    }
    if (coloursOf(p) !== 'faction' || cityOf(game, p) !== r.by) {
      voidPatent(game, s, PATENT_SAY.struck);
      continue;
    }
    const ship = s.ship;
    if (!ship || !ship.alive || ship.docked) continue;
    const port = game.nearestPort(ship.state.x, ship.state.y, (pt) => !pt.raft && stanceOf(r.by, pt.faction) === 'enemy');
    if (!port || dist(port.x, port.y, ship.state.x, ship.state.y) > PATENT_SALLY_R) continue;
    if (!book) sallies.set(game, (book = new Map()));
    const rec = book.get(ship.id);
    if (rec && (game.now - rec.at < PATENT_SALLY_SEC || game.ships.get(rec.id)?.alive)) continue;
    const made = sallyFrom(game, port, ship);
    if (made) {
      book.set(ship.id, { at: game.now, id: made.id });
      game.toastShip(ship, PATENT_SAY.hunted, 'bad');
    }
  }
}

/** Her patent for the HUD and the flag card. */
export function patentView(game: Game, p: Profile): PatentView | null {
  const r = patentOf(game, p);
  return r ? { by: r.by, until: r.until, enemies: patentEnemies(r.by), allies: patentAllies(r.by) } : null;
}

/** The harbour's offer (a lawful harbour's only). */
export function patentOfferView(game: Game, s: PlayerSession): PatentOfferView | null {
  const p = s.profile, docked = s.ship?.docked;
  const port = docked ? game.portById(docked) : null;
  if (!p || !port || port.raft || !isIssuer(port.faction)) return null;
  const by = port.faction;
  const held = patentOf(game, p);
  const sv = sanitizeService(p);
  // (her service beside the offer: kept — rank and pay — or, the issuer its enemy, lost: forum post 70)
  const service = sv ? { id: sv.id, rank: sv.rank, keeps: !patentClash(sv.id, by) } : undefined;
  return { by, price: patentCost(p, by), days: PATENT_MS / 86_400_000, enemies: patentEnemies(by), allies: patentAllies(by), blocked: patentBlocked(game, s, port), renew: held?.by === by, level: PATENT_LEVEL, ...(service ? { service } : {}) };
}
