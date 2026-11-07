// «Услуга контрабандиста» on the server (the rules and numbers: shared/src/data/smuggler.ts; forum, Эдуард, post 92).
// Hooks, each on the old road:
//   player.ts canDock  — its refusal says which kind it is (`smuggle`: the patent's enemy, a flag that holds her an enemy);
//   Game.ts tryDock    — at a harbour that shuts its quay to her so: the refusal tells the three ways in and offers the
//                        boat (the 'smuggler' message: her screen asks yes or no); her yes (`dock` with `smuggle`) pays
//                        and the dock goes on as for any captain, the pass standing in for the harbour master's leave
//                        (dockOverride's 'smuggler': no customs, no search).

import { lackSilver } from '../../../shared/src/data/buyfail.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { SMUGGLE_PASS_MS, SMUGGLE_SAY, smugglePrice } from '../../../shared/src/data/smuggler.ts';
import type { SmuggleOffer, SmuggleWhy } from '../../../shared/src/data/smuggler.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

/** Her pass (p.smuggle.pass): the harbour and until when (wall ms). */
export interface SmugglePass {
  port: string;
  until: number;
}

type WithPass = { pass?: SmugglePass | null };

/** Her pass for this harbour while it runs. */
export function smugglePass(game: Game, p: Profile, port: string): boolean {
  const r = (p.smuggle as WithPass).pass;
  return !!r && r.port === port && r.until > game.wallNow();
}

/** A step of one of her quests waits in this harbour (a visit, a delivery, a pickup, a race's end, a landing's goods). */
export function questAt(p: Profile, port: string): boolean {
  return p.quests.active.some((q) => {
    const st = QUESTS_BY_ID[q.id]?.steps[q.step] as { port?: string } | undefined;
    return !!st && st.port === port;
  });
}

/** The days her patent has still to run (rounded up). */
function patentDays(game: Game, p: Profile): number {
  const r = p.pvp?.patent;
  return r ? Math.max(1, Math.ceil((r.until - game.wallNow()) / 86_400_000)) : 0;
}

export function smuggleOffer(game: Game, p: Profile, port: Port, why: SmuggleWhy): SmuggleOffer {
  const quest = questAt(p, port.id);
  return { port: port.id, price: smugglePrice(p.level, quest), quest, why, days: why === 'patent' ? patentDays(game, p) : 0, mins: SMUGGLE_PASS_MS / 60_000 };
}

/** The refusal with its ways in, in one sentence. */
export function smuggleWays(game: Game, p: Profile, port: Port, why: SmuggleWhy): string {
  return why === 'patent'
    ? SMUGGLE_SAY.patentWays.replace('{0}', String(patentDays(game, p)))
    : SMUGGLE_SAY.standingWays.replace('{0}', FACTIONS[port.faction].name);
}

/** Pay the boat: the pass for this harbour. */
export function buySmuggle(game: Game, s: PlayerSession, port: Port, why: SmuggleWhy): string | null {
  const p = s.profile!;
  const o = smuggleOffer(game, p, port, why);
  if (p.gold < o.price) return lackSilver(o.price, p.gold);
  p.gold -= o.price;
  game.db.ledger(s.accountId, 'smuggler', -o.price, port.id);
  (p.smuggle as WithPass).pass = { port: port.id, until: game.wallNow() + SMUGGLE_PASS_MS };
  game.sendTo(s, { t: 'toast', msg: SMUGGLE_SAY.landed.replace('{0}', String(o.price)).replace('{1}', String(o.mins)), kind: 'good' });
  game.pushSelf(s, true);
  return null;
}

/** At a harbour that refused her (`why` of canDock): null when she goes in (her pass, or her yes paid now), else the
 *  refusal — with its ways in, and the boat offered to her screen. `buy`: her yes. */
export function smuggleGate(game: Game, s: PlayerSession, port: Port, why: SmuggleWhy | undefined, reason: string, buy: boolean): string | null {
  const p = s.profile!;
  if (!why) return reason;
  if (smugglePass(game, p, port.id)) return null;
  if (buy) return buySmuggle(game, s, port, why);
  game.sendTo(s, { t: 'smuggler', offer: smuggleOffer(game, p, port, why) });
  return smuggleWays(game, p, port, why);
}
