// The nemesis (docs/12 P10 #1): the named pirate who sank a captain, or got away from her hurt, keeps her in mind.
// Each meeting ranks him up against her (one to five) and leaves a scar; the first gives him the name he goes by
// with her ("Crane Two-Fingers"). He writes to mock her, finds her wake in his sea (in any pirate sea once he is her
// Sworn Foe), sails levels above his own, and falls on her caravans. Sunk by her at last: revenge — silver from his
// cabin by his rank, a fine or better piece, and his head among her trophies. Another captain sinking him ends
// nothing: the Brethren's captains come back.

import { EPITHETS, NEMESIS_LETTERS, NEMESIS_LEVEL_BONUS, NEMESIS_MAX, NEMESIS_MAX_RANK, NEMESIS_RANKS, nemesisName, surnameOf, epithetOf } from '../../../shared/src/data/nemesis.ts';
import type { NemesisCause } from '../../../shared/src/data/nemesis.ts';
import { PIRATE_SEAS, pirateById } from '../../../shared/src/data/pirates.ts';
import type { NamedPirate } from '../../../shared/src/data/pirates.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import type { NemesisView } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';
import { liveNamed, namedRecord, putToSea } from './wanted.ts';

export interface NemesisRec {
  rank: number;
  /** The name the first meeting gave him ("boarding:0"). */
  epithet: string;
  scars: NemesisCause[];
  /** His wins over her, hers over him (revenge ends the grudge), his escapes. */
  lost: number;
  fled: number;
  lastAt: number;
  letterAt: number;
  /** Game time he last came looking for her. */
  huntAt: number;
}

const LETTER_GAP_MS = 10 * 60_000;
const HUNT_GAP_S = 15 * 60;

export function sanitizeNemeses(p: Profile): Record<string, NemesisRec> {
  p.nemeses ??= {};
  p.nemesisHeads ??= 0;
  return p.nemeses;
}

function pick<T>(game: Game, list: T[]): T {
  return list[game.rng.int(0, list.length - 1)];
}

/** A meeting that ended in his favour: a new grudge, or an old one deeper. */
function grow(game: Game, s: PlayerSession, np: NamedPirate, cause: NemesisCause): NemesisRec {
  const p = s.profile!;
  const all = sanitizeNemeses(p);
  let rec = all[np.id];
  const wall = game.wallNow();
  if (!rec) {
    // Room for him: the weakest grudge makes way.
    const ids = Object.keys(all);
    if (ids.length >= NEMESIS_MAX) {
      const weakest = ids.sort((a, b) => all[a].rank - all[b].rank || all[a].lastAt - all[b].lastAt)[0];
      delete all[weakest];
    }
    rec = all[np.id] = { rank: 1, epithet: `${cause}:${game.rng.int(0, EPITHETS[cause].length - 1)}`, scars: [cause], lost: 0, fled: 0, lastAt: wall, letterAt: 0, huntAt: game.now };
    game.sendTo(s, { t: 'toast', msg: `${np.name[0]} will remember you: a new nemesis.`, kind: 'bad' });
  } else {
    rec.rank = Math.min(NEMESIS_MAX_RANK, rec.rank + 1);
    if (!rec.scars.includes(cause) || rec.scars.length < 6) rec.scars.push(cause);
    rec.scars = rec.scars.slice(-6);
    rec.lastAt = wall;
    const [sur, ep] = [surnameOf(np)[0], epithetOf(rec.epithet)?.[0] ?? ''];
    game.sendTo(s, { t: 'toast', msg: `Your nemesis ${sur} ${ep} rises: ${NEMESIS_RANKS[rec.rank - 1][0]}.`, kind: 'bad' });
  }
  if (cause === 'sank_you') rec.lost++;
  if (cause === 'fled') rec.fled++;
  // A letter to mock her (not more than one in ten minutes).
  if (wall - rec.letterAt > LETTER_GAP_MS) {
    rec.letterAt = wall;
    const kind = cause === 'sank_you' ? 'sank_you' : cause === 'fled' ? 'fled' : 'scar';
    const l = pick(game, NEMESIS_LETTERS[kind]);
    deliver(game, s.accountId, { from: `${surnameOf(np)[0]} ${epithetOf(rec.epithet)?.[0] ?? ''}, your nemesis`, subject: l.subject[0], body: l.body[0].replace('{0}', s.name), gold: 0, goods: null }, 30_000);
  }
  return rec;
}

/** A named pirate (or one of his mates) sank her. */
export function nemesisSankYou(game: Game, victim: ShipEntity, killer: ShipEntity): void {
  const s = game.sessionOf(victim);
  const id = killer.named ?? killer.namedMate?.split('#')[0];
  const np = id ? pirateById(id) : undefined;
  if (!s?.profile || !np) return;
  grow(game, s, np, 'sank_you');
}

/** A named pirate sails out of the story hurt: the captains who hurt him have a grudge to settle — and so has he. */
export function nemesisEscaped(game: Game, np: NamedPirate, ship: ShipEntity): void {
  if (ship.hull > ship.stats.hullMax * 0.9) return;
  for (const [id, t] of ship.attackers) {
    if (t < game.now - 600) continue;
    const o = game.ships.get(id);
    const s = o?.isPlayer ? game.sessionOf(o) : null;
    if (!s?.profile) continue;
    grow(game, s, np, ship.scar ?? 'fled');
    if (ship.scar) sanitizeNemeses(s.profile)[np.id].fled++;
  }
}

/** The extra levels a named pirate sails at when he comes for a captain who is his to hunt. */
export function nemesisBonus(game: Game, np: NamedPirate, near: ShipEntity): number {
  const s = near.isPlayer ? game.sessionOf(near) : null;
  const rec = s?.profile?.nemeses?.[np.id];
  return rec ? NEMESIS_LEVEL_BONUS[rec.rank] ?? 0 : 0;
}

/** She sinks her nemesis: the grudge is settled, and it pays. True when he was hers. */
export function nemesisRevenge(game: Game, s: PlayerSession, np: NamedPirate): boolean {
  const p = s.profile!;
  const all = sanitizeNemeses(p);
  const rec = all[np.id];
  if (!rec) return false;
  delete all[np.id];
  p.nemesisHeads = (p.nemesisHeads ?? 0) + 1;
  const [sur, ep] = [surnameOf(np)[0], epithetOf(rec.epithet)?.[0] ?? ''];
  const silver = Math.round(np.bounty * 0.5 * rec.rank);
  p.gold += silver;
  game.db.ledger(s.accountId, 'nemesis', silver, np.id);
  game.sendTo(s, { t: 'toast', msg: `Revenge! ${sur} ${ep} goes down at last.`, kind: 'gold' });
  game.sendTo(s, { t: 'toast', msg: `Revenge pays: ${silver} silver from the cabin.`, kind: 'gold' });
  takeItem(game, s, makeItem(game.rng, p.itemSeq++, { ilvl: np.level, rarity: rec.rank >= 3 ? 4 : 3 }));
  const head = `The head of ${sur} ${ep}, your nemesis`;
  if (!p.trophies.includes(head)) p.trophies.push(head);
  for (const o of game.sessions) if (o !== s && o.ship?.region === np.region) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} took revenge on ${sur} ${ep}.`, kind: 'gold' });
  game.grantXp(s, 150 * np.level * rec.rank, `Revenge on ${np.name[0]}`, true);
  return true;
}

/** Once a minute: a nemesis at liberty finds his captain's wake in his sea (in any pirate sea at Sworn Foe). */
export function stepNemesis(game: Game): void {
  const wall = game.wallNow();
  const live = new Set(liveNamed(game).map((l) => l.id));
  for (const s of game.sessions) {
    const ship = s.ship, p = s.profile;
    if (!ship || !p?.nemeses || ship.docked || !ship.alive) continue;
    for (const [id, rec] of Object.entries(p.nemeses)) {
      const np = pirateById(id);
      if (!np || live.has(id) || (namedRecord(game, id)?.respawnAt ?? 0) > wall || game.now - rec.huntAt < HUNT_GAP_S) continue;
      const inSea = ship.region === np.region || (rec.rank >= 3 && PIRATE_SEAS.includes(ship.region));
      if (!inSea || !game.rng.chance(0.1 + 0.04 * rec.rank)) continue;
      rec.huntAt = game.now;
      if (!putToSea(game, np, ship)) continue;
      live.add(id);
      game.sendTo(s, { t: 'toast', msg: `Your nemesis ${surnameOf(np)[0]} ${epithetOf(rec.epithet)?.[0] ?? ''} has found your wake!`, kind: 'bad' });
    }
  }
}

/** The nemesis who falls on a captain's caravan, when one of hers is Rival or worse (half the time). */
export function caravanNemesis(game: Game, owner: number): { np: NamedPirate; rec: NemesisRec } | null {
  const p = game.sessionByAccount(owner)?.profile;
  if (!p?.nemeses) return null;
  const ids = Object.keys(p.nemeses).filter((id) => p.nemeses![id].rank >= 2);
  if (!ids.length || !game.rng.chance(0.5)) return null;
  const id = ids[game.rng.int(0, ids.length - 1)];
  const np = pirateById(id);
  return np ? { np, rec: p.nemeses[id] } : null;
}

/** The line a caravan's skipper writes when her nemesis is the one. */
export function caravanNemesisLine(np: NamedPirate, rec: NemesisRec, caravan: string, place: string): string {
  return `${surnameOf(np)[0]} ${epithetOf(rec.epithet)?.[0] ?? ''}, your nemesis, falls on caravan ${caravan} near ${place}!`;
}

export function nemesisViews(p: Profile): NemesisView[] {
  return Object.entries(p.nemeses ?? {}).map(([id, r]) => ({ id, rank: r.rank, epithet: r.epithet, scars: [...r.scars], lost: r.lost, fled: r.fled, lastAt: r.lastAt }));
}

/** For the dossier and the tests: a nemesis's name as the captain knows him. */
export function nemesisTitle(np: NamedPirate, rec: NemesisRec): string {
  return nemesisName(np, rec.epithet)[0];
}

