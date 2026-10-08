// Shipwright rules (docs/03_TALENT_TREES.md §4.8) that are not plain numbers: the Field Forge, salvage from
// wrecks (and the boneyard plans of the Expanse).

import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { CraftRecipe } from '../../../shared/src/protocol.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** What one batch costs and yields. */
export const RECIPES: Record<CraftRecipe, { needs: Cargo; yields: { ammo?: 'round' | 'chain' | 'grape'; good?: GoodId; n: number }; name: string }> = {
  round: { needs: { iron: 1, gunpowder: 1 }, yields: { ammo: 'round', n: 12 }, name: 'round shot' },
  chain: { needs: { iron: 1, gunpowder: 1 }, yields: { ammo: 'chain', n: 8 }, name: 'chain shot' },
  grape: { needs: { iron: 1, gunpowder: 1 }, yields: { ammo: 'grape', n: 14 }, name: 'grapeshot' },
  planks: { needs: { timber: 1 }, yields: { good: 'planks', n: 1 }, name: 'planks & pitch' },
};

/** Field Forge: craft `n` batches at sea from the hold. */
export function craft(game: Game, s: PlayerSession, recipe: CraftRecipe, n: number): string | null {
  const ship = s.ship!;
  if (!ship.hasFlag('field_forge')) return 'You need the Field Forge talent';
  const r = RECIPES[recipe];
  if (!r || !Number.isInteger(n) || n < 1 || n > 50) return 'Bad order';
  if (ship.underFire(game.now)) return 'The forge is cold while the guns speak';
  let batches = n;
  for (const g in r.needs) batches = Math.min(batches, Math.floor((ship.cargo[g as GoodId] ?? 0) / (r.needs[g as GoodId] ?? 1)));
  if (batches <= 0) return `Needs ${Object.entries(r.needs).map(([g, q]) => `${q} ${GOODS[g as GoodId].name.toLowerCase()}`).join(' and ')} per batch`;
  for (const g in r.needs) {
    const id = g as GoodId;
    ship.cargo[id] = (ship.cargo[id] ?? 0) - (r.needs[id] ?? 0) * batches;
    if ((ship.cargo[id] ?? 0) <= 0) delete ship.cargo[id];
  }
  if (r.yields.ammo) ship.ammo[r.yields.ammo] += r.yields.n * batches;
  if (r.yields.good) ship.cargo[r.yields.good] = (ship.cargo[r.yields.good] ?? 0) + r.yields.n * batches;
  game.toastShip(ship, `The forge turns out ${r.yields.n * batches} ${r.name}.`, 'good');
  return null;
}

/** What a sunk hull leaves floating besides her cargo: timbers, canvas, iron and a little powder. */
export function wreckSalvage(ship: ShipEntity): Cargo {
  const t = ship.cls.tier;
  return { planks: 2 * t, sailcloth: t, iron: t, gunpowder: Math.max(1, Math.floor(t / 2)) };
}

const MATERIALS: GoodId[] = ['planks', 'sailcloth', 'iron', 'gunpowder'];

/** Salvager: more of every material off a wreck. Boneyard Secrets: plans in Dead Man's Expanse. */
export function salvageBonus(game: Game, s: PlayerSession, cargo: Cargo, region: string): void {
  const ship = s.ship!;
  const bonus = tx(ship.stats, 'salvage');
  if (bonus > 0) {
    for (const g of MATERIALS) if (cargo[g]) cargo[g] = Math.round((cargo[g] ?? 0) * (1 + bonus));
  }
  if (ship.hasFlag('boneyard_secrets') && region === 'dead_mans_expanse' && !s.profile!.blueprints.includes('ghost_timbers') && game.rng.chance(0.01)) {
    s.profile!.blueprints.push('ghost_timbers');
    game.sendTo(s, { t: 'toast', msg: 'Among the bones of a wreck: the plans of Ghost Timbers. Any yard can fit them now.', kind: 'gold' });
  }
}

