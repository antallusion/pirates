// A captain's legend and the sea's book (docs/02 §14.A.7): trophies, monsters slain, the Abyss's chapters, and
// the first victories on the server. The Pantheon and the seasons (Phase 9) build on this.

import { BOSSES } from '../../../shared/src/data/bosses.ts';
import type { BossId } from '../../../shared/src/data/bosses.ts';
import type { LegendsView } from '../../../shared/src/protocol.ts';
import { CHAPTERS } from './abyss.ts';
import { seasonView } from './seasons.ts';
import { legendaryViews } from './legendary.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

export function legendsView(game: Game, s: PlayerSession): LegendsView {
  const p = s.profile!;
  const firsts = game.db.getKv<Record<string, { names: string[]; at: number }>>('boss_firsts') ?? {};
  return {
    trophies: p.trophies,
    bossKills: Object.entries(p.bossKills).filter(([id]) => BOSSES[id as BossId]).map(([id, n]) => ({ name: BOSSES[id as BossId].name, n })),
    chapters: CHAPTERS.filter((c) => p.chapters.includes(c.id)).map((c) => ({ title: c.title, text: c.text })),
    shards: p.ritualShards,
    season: seasonView(game, s),
    legendary: legendaryViews(game, s),
    firsts: Object.entries(firsts).filter(([id]) => BOSSES[id as BossId]).map(([id, f]) => ({ boss: BOSSES[id as BossId].name, names: f.names, at: f.at })),
  };
}
