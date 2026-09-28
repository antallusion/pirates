// Refits (canon D12, docs/12 P0): a yard takes a ship one level up — silver, timber, iron and canvas (bone of the
// deep for the highest), and the yard's time, during which she does not leave the harbour. The captain's level must
// be up to the ship's. The work goes on by the wall clock, so a refit ordered before a night's sleep is done by
// morning.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { captainLevelFor, levelRange, refitCost } from '../../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { RefitView } from '../../../shared/src/protocol.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

export interface RefitOrder {
  port: string;
  /** The level she is being raised to. */
  to: number;
  /** Wall-clock ms when the yard is done. */
  until: number;
}

/** Whether a yard can take this hull in hand: the same tiers it builds. */
function yardTakes(port: Port, classId: ShipClassId): boolean {
  return SHIP_CLASSES[classId].tier <= port.shipyardTier;
}

/** What she has of a good for the work: in her hold and in the captain's warehouse here. */
function have(s: PlayerSession, port: Port, good: GoodId): number {
  const cargo = s.ship?.cargo ?? s.profile!.cargo;
  return Math.floor((cargo[good] ?? 0) + (s.profile!.warehouses[port.id]?.[good] ?? 0));
}

/** The yard's page on a refit: the next level, what it costs and whether it can be done here and now. */
export function refitView(game: Game, s: PlayerSession, port: Port): RefitView {
  const p = s.profile!;
  const l = p.loadout;
  const [lo, hi] = levelRange(l.classId);
  const level = Math.max(lo, Math.min(hi, l.level ?? lo));
  const busy = p.refit && p.refit.until > game.wallNow() ? { to: p.refit.to, left: Math.ceil((p.refit.until - game.wallNow()) / 1000), port: p.refit.port } : null;
  if (level >= hi) return { level, max: hi, next: null, busy, blocked: busy ? null : 'She is at the height of her class: only a bigger hull goes higher' };
  const cost = refitCost(level + 1)!;
  const next = {
    to: level + 1,
    silver: cost.silver,
    goods: cost.goods.map((g) => ({ good: g.good, qty: g.qty, have: have(s, port, g.good) })),
    sec: cost.sec,
    captain: captainLevelFor(level + 1),
  };
  return { level, max: hi, next, busy, blocked: busy ? null : refitBlocked(game, s, port) };
}

function refitBlocked(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  const l = p.loadout;
  const [lo, hi] = levelRange(l.classId);
  const level = Math.max(lo, Math.min(hi, l.level ?? lo));
  if (level >= hi) return 'She is at the height of her class: only a bigger hull goes higher';
  if (p.refit && p.refit.until > game.wallNow()) return 'The yard is already at work on her';
  if (!yardTakes(port, l.classId)) return `${port.name} cannot take a ${SHIP_CLASSES[l.classId].name} in hand`;
  if (l.legendary) return 'A legendary ship is not rebuilt';
  if (l.guild) return 'A guild hull on loan is not yours to rebuild';
  const need = captainLevelFor(level + 1);
  if (p.level < need) return `Captain level ${need} is needed to command her at level ${level + 1}`;
  const cost = refitCost(level + 1)!;
  if (p.gold < cost.silver) return `Needs ${cost.silver} silver`;
  for (const g of cost.goods) if (have(s, port, g.good) < g.qty) return `Needs ${g.qty} ${GOODS[g.good].name.toLowerCase()} (in the hold or your warehouse here)`;
  return null;
}

/** Orders the refit: pays, takes the materials (the hold first, then the warehouse) and starts the yard's clock. */
export function orderRefit(game: Game, s: PlayerSession, port: Port): string | null {
  const why = refitBlocked(game, s, port);
  if (why) return why;
  const p = s.profile!;
  const l = p.loadout;
  const to = Math.max(levelRange(l.classId)[0], l.level ?? 0) + 1;
  const cost = refitCost(to)!;
  p.gold -= cost.silver;
  game.db.ledger(s.accountId, 'refit', -cost.silver, `${l.classId}:${to}`);
  for (const g of cost.goods) {
    let left = g.qty;
    const cargo = s.ship?.cargo ?? p.cargo;
    const fromHold = Math.min(left, Math.floor(cargo[g.good] ?? 0));
    if (fromHold) {
      cargo[g.good] = (cargo[g.good] ?? 0) - fromHold;
      if (!cargo[g.good]) delete cargo[g.good];
      left -= fromHold;
    }
    const wh = p.warehouses[port.id];
    if (left > 0 && wh) {
      wh[g.good] = (wh[g.good] ?? 0) - left;
      if (!wh[g.good]) delete wh[g.good];
    }
  }
  p.refit = { port: port.id, to, until: game.wallNow() + cost.sec * 1000 };
  game.sendTo(s, { t: 'toast', msg: `The yard takes the ${l.name} in hand: level ${to} in ${Math.ceil(cost.sec / 60)} min. She stays in harbour till then.`, kind: 'info' });
  return null;
}

/** Why she may not leave harbour (the yard at work), or null. */
export function refitHolds(game: Game, p: Profile): string | null {
  if (!p.refit || p.refit.until <= game.wallNow()) return null;
  return `The yard is still at work on her: ${Math.ceil((p.refit.until - game.wallNow()) / 60000)} min more`;
}

/** The yard's work done: she is a level higher. Called every second for captains aboard and on coming aboard. */
export function stepRefit(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p?.refit || p.refit.until > game.wallNow()) return;
  const to = p.refit.to;
  p.refit = null;
  p.loadout.level = Math.max(p.loadout.level ?? 0, to);
  if (s.ship) {
    s.ship.loadout = p.loadout;
    s.ship.recompute(game.now);
    s.ship.hull = s.ship.stats.hullMax;
    s.ship.sails = s.ship.stats.sailHpMax;
  }
  game.sendTo(s, { t: 'toast', msg: `The yard is done: the ${p.loadout.name} is level ${to} now.`, kind: 'gold' });
  game.pushSelf(s, true);
}
