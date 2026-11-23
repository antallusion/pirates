// The Admiralty's warrants for ⚓9 and ⚓10 (owner, 2026-11-23; shared/src/data/warrant.ts): the experience earned in
// command of the rate below, the fortune handed in at a great yard a part at a time, the gate on every way a ship of
// those rates comes to a captain, and the warrants given once to the captains who held such ships on the day.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { WARRANTS, warrantFor } from '../../../shared/src/data/warrant.ts';
import type { WarrantRate, WarrantState, WarrantView } from '../../../shared/src/data/warrant.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';

/** A great yard (tier 4 or more) keeps an Admiralty office: the warrants are handed in there. */
export function warrantOffice(port: Port): boolean {
  return port.shipyardTier >= 4;
}

function state(p: Profile): WarrantState {
  return (p.warrant ??= { has: 0, xp: {}, paid: {} });
}

/** The day the rule came: a captain whose ships (the one she sails and her berths) include ⚓9 or ⚓10 keeps them —
 *  the warrants they need are hers. Once a captain, at her first sign-in after it. */
export function warrantSeen(p: Profile): void {
  const w = state(p);
  if (w.seen) return;
  w.seen = 1;
  let top = 0;
  for (const l of [p.loadout, ...(p.berths ?? []).map((b) => b.loadout)]) if (l) top = Math.max(top, shipLevelOf(l));
  const rate = warrantFor(top);
  if (rate && w.has < rate) w.has = rate;
}

/** The experience a captain earns counts toward the warrant above her when she commands a ship of its rate below. */
export function warrantXp(p: Profile, amount: number): void {
  if (!(amount > 0) || !p.loadout) return;
  const w = state(p);
  const level = shipLevelOf(p.loadout);
  for (const rate of [9, 10] as WarrantRate[]) {
    const def = WARRANTS[rate];
    if (w.has >= rate || level < def.earnedOn) continue;
    if (rate === 10 && w.has < 9) continue; // the admiral's after the first rate's
    w.xp[rate] = Math.min(def.xp, Math.round((w.xp[rate] ?? 0) + amount));
  }
}

/** Why she may not take command of a ship of this level (null: she may). */
export function warrantWhy(p: Profile, shipLevel: number): string | null {
  const rate = warrantFor(shipLevel);
  if (!rate || state(p).has >= rate) return null;
  return `A ship of level ${rate} is commanded only under the ${WARRANTS[rate].name}: the Admiralty office at a great shipyard`;
}

/** …the same for a hull of a class at a level (none given: the class's first). */
export function warrantWhyFor(p: Profile, classId: ShipClassId, level?: number): string | null {
  return warrantWhy(p, shipLevelOf({ classId, level }));
}

/** The warrant she works toward next (null: both held). */
function nextRate(p: Profile): WarrantRate | null {
  const has = state(p).has;
  return has >= 10 ? null : has >= 9 ? 10 : 9;
}

function have(s: PlayerSession, port: Port, good: GoodId): number {
  const cargo = s.ship?.cargo ?? s.profile!.cargo;
  return Math.floor((cargo[good] ?? 0) + (s.profile!.warehouses[port.id]?.[good] ?? 0));
}

/** The shipyard's card: from captain level 41 (the ⚓8's) or a ship of ⚓8, the warrant she works toward. */
export function warrantView(s: PlayerSession, port: Port): WarrantView | undefined {
  const p = s.profile!;
  const rate = nextRate(p);
  if (!rate) return undefined;
  if (p.level < 41 && shipLevelOf(p.loadout) < 8) return undefined;
  const def = WARRANTS[rate];
  const w = state(p);
  const paid = w.paid[rate] ?? { silver: 0, goods: {}, hearts: 0 };
  return {
    rate, name: def.name, xp: w.xp[rate] ?? 0, xpNeed: def.xp, silver: paid.silver, silverNeed: def.silver,
    goods: (Object.entries(def.goods) as [GoodId, number][]).map(([good, need]) => ({ good, paid: paid.goods[good] ?? 0, need, have: have(s, port, good) })),
    hearts: paid.hearts, heartsNeed: def.hearts, heartsHave: p.stormHearts ?? 0, here: warrantOffice(port),
  };
}

/** «Hand in»: what she has toward the warrant — silver (all that is still asked, as far as her purse goes), the goods
 *  from her hold and her warehouse here, the hearts of the storm. Granted when all is in. Only once the experience is
 *  earned (owner, 2026-11-23: «делай как лучше, чтобы баланс соблюдался» — a captain of 47 put 460 000 silver in
 *  hundreds of hours before the warrant could be hers, silver gone from her trade and her ship for all that time). */
export function warrantHandIn(game: Game, s: PlayerSession, port: Port): string | null {
  const p = s.profile!;
  if (!warrantOffice(port)) return 'The Admiralty keeps its offices at the great shipyards only';
  const rate = nextRate(p);
  if (!rate) return 'You hold every warrant there is';
  const def = WARRANTS[rate];
  const w = state(p);
  if ((w.xp[rate] ?? 0) < def.xp) return `The Admiralty takes the fortune once the experience is earned: in command of a ship of level ${def.earnedOn}`;
  const paid = (w.paid[rate] ??= { silver: 0, goods: {}, hearts: 0 });
  const brought: string[] = [];
  const silver = Math.max(0, Math.min(def.silver - paid.silver, Math.floor(p.gold)));
  if (silver > 0) {
    p.gold -= silver;
    paid.silver += silver;
    game.db.ledger(s.accountId, 'warrant', -silver, `${rate}`);
    brought.push(`${silver} silver`);
  }
  const cargo = s.ship?.cargo ?? p.cargo;
  for (const [g, need] of Object.entries(def.goods) as [GoodId, number][]) {
    let left = Math.min(need - (paid.goods[g] ?? 0), have(s, port, g));
    if (left <= 0) continue;
    paid.goods[g] = (paid.goods[g] ?? 0) + left;
    brought.push(`${left} ${GOODS[g].name.toLowerCase()}`);
    const fromHold = Math.min(left, Math.floor(cargo[g] ?? 0));
    if (fromHold > 0) {
      cargo[g] = (cargo[g] ?? 0) - fromHold;
      if (!(cargo[g]! > 0)) delete cargo[g];
      left -= fromHold;
    }
    const wh = p.warehouses[port.id];
    if (left > 0 && wh) {
      wh[g] = (wh[g] ?? 0) - left;
      if (!(wh[g]! > 0)) delete wh[g];
    }
  }
  const hearts = Math.max(0, Math.min(def.hearts - paid.hearts, p.stormHearts ?? 0));
  if (hearts > 0) {
    p.stormHearts = (p.stormHearts ?? 0) - hearts;
    paid.hearts += hearts;
    brought.push(`${hearts} hearts of the storm`);
  }
  const allIn = paid.silver >= def.silver && paid.hearts >= def.hearts && (Object.entries(def.goods) as [GoodId, number][]).every(([g, n]) => (paid.goods[g] ?? 0) >= n);
  const earned = (w.xp[rate] ?? 0) >= def.xp;
  if (!brought.length && !(allIn && earned)) return 'You bring nothing the warrant still asks';
  if (brought.length) game.toastShip(s.ship!, `The Admiralty takes ${brought.join(', ')} toward the ${def.name}.`, 'gold');
  if (allIn && earned) {
    w.has = rate;
    delete w.paid[rate];
    game.db.ledger(s.accountId, 'warrant_granted', 0, `${rate}`);
    game.toastShip(s.ship!, `The Admiralty seals your ${def.name}: ships of level ${rate} are yours to command.`, 'good');
    for (const q of game.world.ports) game.addRumor(q.x, q.y, `${s.name} is granted the ${def.name} by the Admiralty.`);
  }
  game.saveSession(s);
  return null;
}

/** On sign-in: what was handed in toward a warrant before its experience was earned (the rule before 2026-11-23 took
 *  it at once) goes back to her in a letter — silver, goods and hearts — taken in any port. */
export function warrantRefundEarly(game: Game, s: PlayerSession): void {
  const p = s.profile;
  const w = p?.warrant;
  if (!p || !w) return;
  for (const rate of [9, 10] as WarrantRate[]) {
    const paid = w.paid[rate];
    if (!paid || (w.xp[rate] ?? 0) >= WARRANTS[rate].xp) continue;
    delete w.paid[rate];
    const goods = (Object.entries(paid.goods) as [GoodId, number][]).filter(([, n]) => n > 0);
    if (paid.hearts > 0) p.stormHearts = (p.stormHearts ?? 0) + paid.hearts;
    if (!(paid.silver > 0) && !goods.length) continue;
    // The goods wait at the harbour she lies in (at sea: the nearest great yard); a letter carries one good, so one
    // letter each after the first.
    const ship = s.ship;
    const at = ship?.docked ?? (ship ? game.world.ports.filter(warrantOffice).sort((a, b) => Math.hypot(a.x - ship.state.x, a.y - ship.state.y) - Math.hypot(b.x - ship.state.x, b.y - ship.state.y))[0]?.id : undefined) ?? game.world.ports[0].id;
    const body = `The Admiralty now takes the fortune for the ${WARRANTS[rate].name} only once its experience is earned. What you handed in comes back to you.`;
    const parts = goods.length ? goods : [null];
    parts.forEach((g, i) => deliver(game, s.accountId, {
      from: 'The Admiralty', subject: 'Your warrant payment returned', body,
      gold: i === 0 ? Math.round(paid.silver) : 0, goods: g ? { good: g[0], qty: Math.round(g[1]), port: at } : null,
    }));
    game.db.ledger(s.accountId, 'warrant_refund', Math.round(paid.silver), `${rate}`);
    console.log(`[warrant] refund ${s.accountId}: ${Math.round(paid.silver)} silver, ${JSON.stringify(goods)} at ${at}, ${paid.hearts} hearts`);
  }
}
