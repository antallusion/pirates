// How a ship stands to you (docs/07 §11.2), told by shape before colour: ring-and-dot for yourself, a circle for
// your group or guild, a square for neutrals, a diamond for enemies, a notched diamond for a price on their head.
// And the faction signs of §11.1, so no lantern is known by its colour alone.

import type { FactionId } from '../../../shared/src/data/factions.ts';
import { SF } from '../../../shared/src/protocol.ts';
import type { ClientState, RemoteShip } from '../state.ts';

export type Relation = 'me' | 'friend' | 'neutral' | 'enemy' | 'target';

export function relationOf(state: ClientState, s: RemoteShip): Relation {
  if (s.id === state.entityId) return 'me';
  const flags = s.cur.flags;
  if (flags & SF.BOUNTY) return 'target';
  if (flags & SF.HOSTILE) return 'enemy';
  const info = s.info;
  if (info?.isPlayer) {
    if (state.party?.members.some((m) => m.name === info.captainName)) return 'friend';
    if (state.guild && info.guild && info.guild === state.guild.tag) return 'friend';
  }
  return 'neutral';
}

export const RELATION_COLOR: Record<Relation, string> = { me: '#d8d2c4', friend: '#7fb0d0', neutral: '#c0c4c8', enemy: '#d4542b', target: '#e0b862' };

/** Draws the relation marker at (x, y), radius r. */
export function drawRelation(g: CanvasRenderingContext2D, rel: Relation, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  g.beginPath();
  switch (rel) {
    case 'me':
      g.arc(x, y, r + 1.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(x, y, r * 0.45, 0, Math.PI * 2);
      g.fill();
      return;
    case 'friend':
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      return;
    case 'neutral':
      g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      g.fill();
      return;
    case 'enemy':
    case 'target':
      g.moveTo(x, y - r * 1.25);
      g.lineTo(x + r * 1.1, y);
      g.lineTo(x, y + r * 1.25);
      g.lineTo(x - r * 1.1, y);
      g.closePath();
      g.fill();
      if (rel === 'target') {
        // The notch: a tick through the top point.
        g.beginPath();
        g.moveTo(x, y - r * 2.1);
        g.lineTo(x, y - r * 0.6);
        g.stroke();
      }
      return;
  }
}

/** Faction signs: crown, a barred coin, crossed sabres, a hood, a harpoon, a spiral, an anchor. */
export const FACTION_SIGN: Record<FactionId, string> = {
  crown: '♛',
  league: '⊖',
  confederacy: '⚔',
  brokers: 'Ω',
  harpoon: '↟',
  choir: '@',
  free: '⚓',
};
