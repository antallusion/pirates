// A captain's «Мощь» read off the server (owner, 2026-10-31: the rating built on the might of the army, the ship, the
// island's buildings and the gear; shared/src/data/power.ts has the formulas). Her save (her live state when aboard) and
// her island as the holdings keep it. The site's rating (siterating.ts) reads every captain through `powerOfSave` once a
// minute; the Captain window's «Мощь» page asks `power` → `powerMessage` (her parts, her places, the top ten).

import { powerOf } from '../../../shared/src/data/power.ts';
import type { PowerIsle, PowerScore } from '../../../shared/src/data/power.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import type { PowerRankView } from '../../../shared/src/powerproto.ts';
import { ownIsland } from './estate.ts';
import { yardOf } from './base.ts';
import { townLevel, treeLevels } from './town.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** What the power reads of a save (any older save: what is missing counts nought). */
export interface PowerSave {
  captain?: string;
  army?: ArmyStack[];
  loadout?: ShipLoadout;
  captainGear?: Partial<Record<string, Item>>;
}

/** Her island's town, its base and the rest on it (null: no island of her own). */
export function powerIsle(game: Game, acc: number): PowerIsle | null {
  try {
    const h = ownIsland(game, acc);
    if (!h) return null;
    const y = yardOf(game, h);
    const town: Partial<Record<string, number>> = {};
    for (const [k, n] of treeLevels(h, y)) town[k] = n;
    town.grail = townLevel(y, 'grail');
    town.pen = townLevel(y, 'pen');
    const other = [
      ...(y.producers ?? []).map((x) => ({ id: `p:${x.kind}`, level: Math.max(1, x.level ?? 1) })),
      ...(h.buildings ?? []).map((b) => ({ id: b.id as string, level: Math.max(1, b.level ?? 1) })),
    ];
    return { town, other };
  } catch {
    return null;
  }
}

/** Her power from her save (`army` given: her live army aboard). */
export function powerOfSave(game: Game, acc: number, p: PowerSave, army?: readonly ArmyStack[]): PowerScore {
  return powerOf({
    captain: typeof p.captain === 'string' ? p.captain : 'corsair',
    army: army ?? (Array.isArray(p.army) ? p.army : []),
    loadout: p.loadout && typeof p.loadout === 'object' && p.loadout.classId ? p.loadout : null,
    captainGear: Object.values(p.captainGear ?? {}),
    isle: powerIsle(game, acc),
  });
}

/** Her power now, aboard. */
export function powerOfSession(game: Game, s: PlayerSession): PowerScore | null {
  if (!s.profile) return null;
  return powerOfSave(game, s.accountId, s.profile as unknown as PowerSave, s.ship?.army);
}

/** The Captain window's «Мощь» page: her four parts and the total, her places on the five boards, the top ten. */
export function powerRankView(game: Game, s: PlayerSession): PowerRankView | null {
  const me = powerOfSession(game, s);
  if (!me) return null;
  const board = game.powerBoard?.(s.accountId) ?? null;
  return { me, ranks: board?.ranks ?? { power: null, army: null, ship: null, isle: null, gear: null }, ranked: board?.ranked ?? 0, top: board?.top ?? [] };
}

export function powerMessage(game: Game, s: PlayerSession, msg: { action?: string }): void {
  if (!s.profile || msg.action !== 'view') return;
  const view = powerRankView(game, s);
  if (view) game.sendTo(s, { t: 'power', view });
}
