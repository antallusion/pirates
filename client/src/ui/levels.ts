// Ship levels on the page (canon D12): a chip ⚓N in the colour of how far it stands above your own ship — grey
// for no match, green for easy, yellow for even, orange and red for danger, a skull where no shot of yours tells.

import { THREAT_COLOR, combatLevelOf, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import type { Threat } from '../../../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { esc } from './dom.ts';

let mine = 1;

/** Note your own ship's fighting level whenever your papers change. */
export function noteOwnShip(loadout: { classId: ShipClassId; level?: number }): void {
  mine = combatLevelOf(loadout.classId, shipLevelOf(loadout));
}

export function threatTo(level: number, classId?: ShipClassId): Threat {
  return threatOf(mine, classId ? combatLevelOf(classId, level) : level);
}

/** ⚓N as a chip; the class, when given, shifts a merchant's fighting level below her own. */
export function levelChip(level: number, classId?: ShipClassId, title?: string): string {
  const t = threatTo(level, classId);
  return `<span class="lvl-chip lvl-${t}" style="color:${THREAT_COLOR[t]}"${title ? ` title="${esc(title)}"` : ''}>${t === 'skull' ? '☠' : ''}⚓${level}</span>`;
}

/** Your own ship's level: the chip in brass, no danger in it. */
export function ownLevelChip(level: number): string {
  return `<span class="lvl-chip lvl-own" style="color:#e8c46a">⚓${level}</span>`;
}
