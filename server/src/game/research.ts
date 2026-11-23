// The yard's tree of hulls (owner, 2026-10-04: «как в world of tanks… начинаешь с малого, зарабатываешь у малого опыт и
// дальше качаешься»; docs/20; shared/src/data/research.ts). Every experience the captain earns is earned by the hull she
// sails too; that experience researches the next tier of the hull's list, and a yard sells only what is researched.

import { CHILDREN, FREE_XP_SHARE, initialResearch, isResearched, needsResearch, researchPrice, researchQuote, spendResearch } from '../../../shared/src/data/research.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { lackMore } from '../../../shared/src/data/buyfail.ts';
import type { ResearchView } from '../../../shared/src/data/research.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

/** The hulls she owns: the one she sails and those in her berths. */
export function ownedHulls(p: Profile): ShipClassId[] {
  return [p.loadout.classId, ...p.berths.map((b) => b.loadout.classId)];
}

/** Her research, made the first time it is asked for (a save from before the tree keeps all her level could buy). */
export function researchOf(p: Profile): ResearchView {
  if (!p.research) p.research = { xp: {}, free: 0, done: initialResearch(p.level, ownedHulls(p)) };
  return p.research;
}

/** Experience earned: the hull she sails has it too, and a twentieth of it goes into the free pool. */
export function hullXp(p: Profile, amount: number): void {
  if (!(amount > 0) || !p.loadout) return;
  const r = researchOf(p);
  const c = p.loadout.classId;
  r.xp[c] = Math.round(((r.xp[c] ?? 0) + amount) * 10) / 10;
  r.free = Math.round((r.free + amount * FREE_XP_SHARE) * 10) / 10;
}

/** May a yard sell her this hull (researched, owned, or no research needed)? */
export function hullKnown(p: Profile, id: ShipClassId): boolean {
  return isResearched(researchOf(p), id, ownedHulls(p));
}

/** The yard's refusal of a hull not yet researched, or null. */
export function researchWhy(p: Profile, id: ShipClassId): string | null {
  return hullKnown(p, id) ? null : `Research the ${SHIP_CLASSES[id].name} first: the yard's tree of hulls`;
}

/** What the client is shown. */
export function researchView(p: Profile): ResearchView {
  const r = researchOf(p);
  return { xp: { ...r.xp }, free: Math.floor(r.free), done: [...r.done] };
}

/** Research a hull: her parents' experience (the richest first), then the free pool. Null on success. */
export function research(game: Game, s: PlayerSession, id: ShipClassId): string | null {
  const p = s.profile;
  const def = SHIP_CLASSES[id];
  if (!p || !def) return 'No such hull';
  if (!needsResearch(id)) return def.premium ? 'A hull sold for doubloons is not researched' : 'That hull needs no research';
  const r = researchOf(p);
  const owned = ownedHulls(p);
  if (isResearched(r, id, owned)) return 'Already researched';
  const q = researchQuote(r, id, owned);
  if (!q.known.length) return 'Research a hull of the tier below first: the tree of hulls shows which';
  if (!q.ready) return `Needs ${q.cost} experience on the hulls below and the free pool — ${q.pool} so far`;
  // Owner, 2026-11-23: beside the experience, silver (and from the third tier the yard's goods) paid at a shipyard.
  const price = researchPrice(id);
  const at = s.ship?.docked ? game.portById(s.ship.docked) : null;
  if ((price.silver || price.goods.length) && (!at || !(at.shipyardTier >= 1))) return 'A hull is researched at a shipyard: make port';
  if (p.gold < price.silver) return lackMore(`Needs ${price.silver} silver`, price.silver, p.gold);
  const cargo = s.ship?.cargo ?? p.cargo;
  const wh = at ? p.warehouses[at.id] : undefined;
  const have = (g: string) => Math.floor((cargo[g as 'iron'] ?? 0) + (wh?.[g as 'iron'] ?? 0));
  for (const g of price.goods) if (have(g.good) < g.qty) return `Needs ${g.qty} ${GOODS[g.good].name.toLowerCase()} (in the hold or your warehouse here)`;
  p.gold -= price.silver;
  if (price.silver) game.db.ledger(s.accountId, 'research', -price.silver, id);
  for (const g of price.goods) {
    let left = g.qty;
    const fromHold = Math.min(left, Math.floor(cargo[g.good] ?? 0));
    if (fromHold > 0) { cargo[g.good] = (cargo[g.good] ?? 0) - fromHold; if (!(cargo[g.good]! > 0)) delete cargo[g.good]; left -= fromHold; }
    if (left > 0 && wh) { wh[g.good] = (wh[g.good] ?? 0) - left; if (!(wh[g.good]! > 0)) delete wh[g.good]; }
  }
  spendResearch(r, id, owned);
  game.sendTo(s, { t: 'researched', classId: id });
  game.sendTo(s, { t: 'toast', msg: `Researched: the ${def.name}. Any yard that builds her sells her now.`, kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** The hulls her sailing hull leads to that her experience can research now. */
export function readyChildren(p: Profile): ShipClassId[] {
  const r = researchOf(p), owned = ownedHulls(p);
  return (CHILDREN[p.loadout.classId] ?? []).filter((c) => researchQuote(r, c, owned).ready);
}

/** Experience granted: a hull that has just come within reach is named once (docs/20). */
export function researchNews(game: Game, s: PlayerSession, before: ShipClassId[]): void {
  if (!s.profile) return;
  for (const c of readyChildren(s.profile)) {
    if (before.includes(c)) continue;
    game.sendTo(s, { t: 'toast', msg: `The ${SHIP_CLASSES[c].name} can be researched now: the tree of hulls.`, kind: 'good' });
  }
}
