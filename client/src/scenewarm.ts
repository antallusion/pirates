// The next scene's pictures fetched before it is asked for (owner, 2026-10-15: «все должно подгружаться быстро»):
// while she sails, the cache is warmed with what she will likely see next (assets.ts prefetchAssets — fetched, not
// decoded): her island's map and buildings, so the island screen opens at once; a boarding's decks, her own men's
// figures and the battle's effects when a hostile sail is near, so the grapples find the battle ready. And the
// service worker (client/sw.js) that keeps every picture for the next visit.

import { ISO_MAP_OF, isoSheet } from '../../shared/src/data/isleiso.ts';
import { deckArt } from '../../shared/src/data/fleet.ts';
import { SF } from '../../shared/src/protocol.ts';
import { armyForLevel } from '../../shared/src/data/army.ts';
import { assetFor, assetIds, ensureAssets, keepUrls, loadManifest, prefetchAssets, warmAll, assetUrl } from './assets.ts';
import type { ClientState } from './state.ts';
import { filmDue } from './ui/cutscene.ts';

const filmsWarmed = new Set<string>();
/** A film due at the next moment, fetched into the cache (it starts at once instead of buffering on a slow line). */
function warmFilm(id: string): void {
  if (filmsWarmed.has(id) || !filmDue(id)) return;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData || /2g/.test(c?.effectiveType ?? '')) return;
  filmsWarmed.add(id);
  fetch(`/assets/video/${id}.mp4`, { priority: 'low' } as RequestInit).then((r) => r.arrayBuffer()).catch(() => undefined);
}

/** The service worker: on a secure page only (the browsers' rule; localhost counts). */
export function artStore(): void {
  const nav = navigator as Navigator & { serviceWorker?: ServiceWorkerContainer };
  if (!nav.serviceWorker || !(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  if (new URLSearchParams(location.search).has('nosw')) return;
  nav.serviceWorker.register('/sw.js').catch(() => undefined);
}

let warmedAll = false;
/** Once the game is in: the rest of the pictures slowly into the cache, and the worker's store pruned of old ones. */
export function startWarm(): void {
  if (warmedAll) return;
  warmedAll = true;
  setTimeout(() => warmAll(), 4000);
  setTimeout(() => {
    void loadManifest().then(() => {
      const sw = (navigator as Navigator & { serviceWorker?: ServiceWorkerContainer }).serviceWorker?.controller;
      if (!sw) return;
      // (every picture's address as this browser asks for it — its AVIF twin, its sheet: docs/33)
      sw.postMessage({ t: 'prune', keep: keepUrls() });
    });
  }, 90000);
}

let lastAt = -1e9;
let isleKey = '';
let watchWarmed = false;

/** The First Watch's practice boarding (server/src/game/onboarding.ts: a level-1 pirate sloop), its opening frame
 *  loaded and decoded while she sails out to it — the night sea, both decks, her men's and the pirates' figures — and
 *  the battle's effects into the cache: the lesson's battle opens at once, not on a loading screen (tel_load 2026-10:
 *  battle loads timed out on Windows and Android). */
export function watchBattleIds(ownClass: string, army: readonly { u: string }[]): { first: string[]; later: string[] } {
  const figs = new Set<string>();
  for (const a of army) figs.add(`unit.${a.u}`);
  for (const a of armyForLevel(1, 12, 7, 'pirate')) figs.add(`unit.${a.u}`);
  const first = ['bg.battle_sea', deckArt(ownClass), deckArt('sloop'), ...figs];
  const later = [...assetIds('part.'), ...assetIds('fx.bt_'), 'bg.spellbook'];
  for (const f of figs) for (const pose of ['_atk', '_b', '_hit']) later.push(f + pose);
  const res = (ids: string[]) => [...new Set(ids.map((id) => assetFor(id)).filter((x): x is string => !!x))];
  return { first: res(first), later: res(later) };
}
const shipsSeen = new Set<number>();

/** Each frame from the sea's loop: at most every two seconds, the likely next scene warmed. */
export function sceneWarm(state: ClientState, t: number): void {
  if (t - lastAt < 2000) return;
  lastAt = t;
  const self = state.self;
  if (!self) return;
  // her island: its map and its buildings at their stages
  const home = self.homeIsle;
  if (home !== null && home !== undefined) {
    const isl = state.islands.get(home);
    const v = state.base;
    const key = `${home}|${isl?.biome ?? ''}|${v ? v.cells.map((c) => `${c.what}${c.level}${c.job ? 'j' : ''}`).join(',') : ''}`;
    if (key !== isleKey) {
      isleKey = key;
      const ids: string[] = [];
      const biome = v?.biome ?? isl?.biome;
      if (biome) ids.push(`isle.map.${ISO_MAP_OF[biome] ?? 'temperate'}`);
      if (v) {
        for (const c of v.cells) {
          const sheet = c.what ? isoSheet(c.what) : null;
          if (sheet) ids.push(`isle.${sheet}.l${Math.max(1, Math.min(5, c.level || 1))}`, ...(c.job ? [`isle.${sheet}.up`, `isle.${sheet}.s0`, `isle.${sheet}.s1`] : []));
        }
        for (const th of v.town?.things ?? []) {
          const sheet = isoSheet(th.id);
          if (sheet) ids.push(`isle.${sheet}.${th.level > 0 ? `l${Math.min(5, th.level)}` : 's0'}`);
        }
      }
      prefetchAssets(ids);
    }
  }
  // the films of the next moments: putting to sea from a harbour, the first harbour from the sea
  if (self.dockedAt) warmFilm('cut_launch');
  else if (state.ownDisplay && state.ports.some((p) => Math.hypot(p.x - state.ownDisplay!.x, p.y - state.ownDisplay!.y) < 2500)) warmFilm('cut_port');
  // the First Watch: its practice boarding's pictures, from its first step on
  const stage = state.onboarding?.stage;
  if (!watchWarmed && (stage === 'sail' || stage === 'attack' || stage === 'fire' || stage === 'board')) {
    watchWarmed = true;
    const { first, later } = watchBattleIds(self.loadout.classId, self.company?.army ?? []);
    void ensureAssets(first, { prio: 1 }).then(() => prefetchAssets(later));
  }
  // a hostile sail near: the boarding's pictures
  const own = state.ownDisplay;
  if (!own || self.dockedAt || state.boardTac) return;
  for (const sh of state.ships.values()) {
    if (sh.id === state.entityId || !(sh.cur.flags & SF.HOSTILE) || shipsSeen.has(sh.id)) continue;
    if (Math.hypot(sh.cur.x - own.x, sh.cur.y - own.y) > 1600) continue;
    shipsSeen.add(sh.id);
    const ids = [...assetIds('part.'), ...assetIds('fx.bt_'), 'bg.battle_sea', deckArt(self.loadout.classId)];
    const cls = (sh.info as { classId?: string } | undefined)?.classId;
    if (cls) ids.push(deckArt(cls));
    for (const a of self.company?.army ?? []) for (const pose of ['', '_atk', '_b', '_hit']) ids.push(`unit.${a.u}${pose}`);
    prefetchAssets(ids);
  }
}
