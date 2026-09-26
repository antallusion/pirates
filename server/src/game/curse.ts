// Curse: the deep slowly claims ships that linger in strange waters, carry relics or sail under a drowned
// captain. Four stages: barnacles and bone (armour, lost speed, uneasy crews), then the glow in the planks
// that makes enemy crews falter. The 80/20 rule: most ships never go past stage 1. See docs/06 §curse stages.

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { StatMods } from '../../../shared/src/data/stats.ts';
import { curseStage } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export const CURSE_MODS: Record<1 | 2 | 3, StatMods> = {
  1: { armor: 0.03 },
  2: { armor: 0.06, maxSpeed: -0.04 },
  3: { armor: 0.1, maxSpeed: -0.08 },
};

export const CURSE_MORALE = [0, 5, 10, 18];

/** Per-second curse drift for a ship at sea (or in port). */
export function curseRate(game: Game, ship: ShipEntity): number {
  const strange = REGIONS[ship.region].strangeness;
  let rate = 0;
  if (strange > 0.2) rate += strange * 0.12;
  rate += (ship.cargo.cursed_relics ?? 0) * 0.01;
  if (game.weatherOf(ship) === 'black_storm') rate += 0.1;
  if (ship.captain === 'drowned') rate += 0.02;
  if (rate === 0) rate = ship.docked ? -0.05 : strange < 0.15 ? -0.02 : 0;
  return rate;
}

/** Apply drift and keep the stat effect in sync with the stage. Returns true if the stage changed. */
export function stepCurse(game: Game, ship: ShipEntity, drift = true): boolean {
  if (!drift) {
    // Sync the stage effect only.
  } else if (ship.npcRole === 'ghost') {
    ship.curse = 100;
  } else {
    const floor = ship.captain === 'drowned' ? 30 : 0; // Ilse Harrow never quite dries out
    ship.curse = Math.max(floor, Math.min(100, ship.curse + curseRate(game, ship)));
  }
  const stage = curseStage(ship.curse);
  const current = ship.effects.find((e) => e.id === 'curse');
  const had = current ? Number(current.source ?? 0) : 0;
  if (stage === had && (stage === 0 || current)) return false;
  ship.effects = ship.effects.filter((e) => e.id !== 'curse');
  if (stage > 0) ship.effects.push({ id: 'curse', until: Infinity, mods: CURSE_MODS[stage as 1 | 2 | 3], source: stage });
  ship.recompute(game.now);
  return had !== stage;
}

/** Stage 2+: enemy crews within 300 m lose their nerve. */
export function curseAura(game: Game, ship: ShipEntity): void {
  const stage = curseStage(ship.curse);
  if (stage < 2) return;
  game.forShipsNear(ship.state.x, ship.state.y, 300, (o) => {
    if (o.id !== ship.id && o.alive && game.isHostile(o, ship) && o.cls.passive.id !== 'dead_crew') o.morale = Math.max(0, o.morale - (stage - 1) * 0.3);
  });
}

export function cleanseCost(ship: ShipEntity): number {
  return Math.round(ship.curse * 8 * (0.6 + ship.cls.tier * 0.4));
}

/** Harpoon chapels and Crown/League shipwrights scrape and bless a hull. The Choir will not. */
export function cleanse(game: Game, s: PlayerSession, port: Port): string | null {
  const ship = s.ship!;
  if (!['harpoon', 'crown', 'league'].includes(port.faction)) return `No one in ${FACTIONS[port.faction].short} waters will scrape a cursed hull`;
  const floor = ship.captain === 'drowned' ? 30 : 0;
  if (ship.curse <= floor + 1) return 'The hull is as clean as it will ever be';
  const cost = cleanseCost(ship);
  if (s.profile!.gold < cost) return `Scraping and blessing costs ${cost} silver`;
  s.profile!.gold -= cost;
  ship.curse = floor;
  stepCurse(game, ship, false);
  game.db.ledger(s.accountId, 'cleanse', -cost, port.id);
  return null;
}
