// The forum's window on the running game (docs/32_FORUM.md): a member's captain (class, level, ship, deeds) from her
// session when she is at sea or from her save, her guild and its members. Saves are read at most once in two minutes
// per account.

import type { Game } from '../game/Game.ts';
import type { Db } from '../persistence/db.ts';
import type { CharInfo, GameLink } from './service.ts';

interface ProfileLike { captain?: string; level?: number; shipName?: string; loadout?: { name?: string }; deeds?: string[] }

const TTL = 120_000;

export function gameLink(game: Game, db: Db): GameLink {
  const cache = new Map<number, { at: number; c: CharInfo | null }>();
  const fromProfile = (p: ProfileLike | null | undefined): CharInfo | null =>
    p && p.captain ? { captain: String(p.captain), level: Number(p.level ?? 1), ship: String(p.shipName ?? p.loadout?.name ?? ''), deeds: Array.isArray(p.deeds) ? p.deeds.map(String) : [] } : null;
  return {
    accountName: (id) => db.accountById(id)?.name ?? null,
    character(id) {
      const live = game.sessionByAccount(id)?.profile as ProfileLike | null | undefined;
      if (live) return fromProfile(live);
      const now = Date.now();
      const hit = cache.get(id);
      if (hit && now - hit.at < TTL) return hit.c;
      let c: CharInfo | null = null;
      try {
        const row = db.loadCaptain(id);
        c = row ? fromProfile(JSON.parse(row.data) as ProfileLike) : null;
      } catch {
        c = null;
      }
      if (cache.size > 5000) cache.clear();
      cache.set(id, { at: now, c });
      return c;
    },
    guildOf(id) {
      const g = game.guilds.of(game, id);
      if (!g) return null;
      const m = g.members.find((x) => x.account === id);
      return { id: g.id, name: g.name, tag: g.tag, rank: m?.rank ?? 'sailor' };
    },
    guild(tag) {
      const g = Object.values(game.guilds.store(game).guilds).find((x) => x.tag === tag);
      return g ? { id: g.id, name: g.name, tag: g.tag, members: g.members.map((m) => ({ account: m.account, name: m.name, rank: m.rank })) } : null;
    },
    online: (id) => !!game.sessionByAccount(id),
    inGame: () => game.sessions.size,
  };
}
