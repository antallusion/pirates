// The thank-you letter of 2026-10-28 (shared/src/data/gift.ts): 33 333 silver and a gift stack of 10 musketeers to
// every captain there was when it went out — bots, the NPCs' and the QA's accounts passed over (advice.ts
// notACaptain), the captains who sign on after it never. Sent once and only once: a kv mark a captain
// (`gift:2026-10-28:sent:<account>`, written with her letter in one transaction) and one for the whole send
// (`gift:2026-10-28:done`, its moment the cut-off for any later run). The server sends it by itself on boot when it
// has not gone yet (a deploy sends it); `/gift28 dry` counts who would get it and who has no room for the
// musketeers now, `/gift28 send` sends what is left, `/gift28 status` tells what went.

import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { armySlots } from '../../../shared/src/data/army.ts';
import { notACaptain } from '../../../shared/src/data/advice.ts';
import { GIFT28_FROM, GIFT28_ID, GIFT28_N, GIFT28_SILVER, GIFT28_UNIT, GIFT28_WORDS, giftRoom } from '../../../shared/src/data/gift.ts';
import { computeShipStats } from '../../../shared/src/sim/shipstats.ts';
import type { Db } from '../persistence/db.ts';
import type { Game } from './Game.ts';
import { deliver } from './post.ts';

export const GIFT28_DONE = `${GIFT28_ID}:done`;
export const giftSentKey = (acc: number): string => `${GIFT28_ID}:sent:${acc}`;

/** What the plan reads of the database (the server's, or a copy's in tools/gift28-dry.ts). */
export type GiftDb = Pick<Db, 'allCaptains' | 'seenOf' | 'getKv'>;

export interface GiftRow {
  acc: number;
  name: string;
  /** Room aboard now for the stack (a slot and the hammocks), as her save stands. */
  room: boolean;
}

/** Her room for the musketeers from her save (her ship's class, her stacks, her head count). */
export function roomOfSave(p: { loadout?: { classId?: string }; captain?: string; talents?: Record<string, number>; army?: unknown[]; crew?: number }): boolean {
  const cls = SHIP_CLASSES[p.loadout?.classId as keyof typeof SHIP_CLASSES];
  if (!cls || !p.loadout) return false;
  let crewMax = cls.crewMax;
  try {
    crewMax = computeShipStats(p.loadout as never, (p.captain ?? 'reaver') as never, (p.talents ?? {}) as never).crewMax;
  } catch {
    // (an old save the reckoning does not know: the class's own hammocks)
  }
  const stacks = Array.isArray(p.army) ? p.army.length : 0;
  return giftRoom(stacks, armySlots(cls.tier), Math.max(0, Math.floor(Number(p.crew) || 0)), crewMax);
}

/** Who gets the letter now: every saved captain (not a bot, an NPC, a QA or a test account) who signed up before the
 *  cut-off and has not had it. `cut`: the first send's moment, else now. */
export function giftPlan(db: GiftDb, now: number): GiftRow[] {
  const done = db.getKv<{ at: number; n: number }>(GIFT28_DONE);
  const cut = done?.at ?? now;
  const out: GiftRow[] = [];
  for (const row of db.allCaptains()) {
    if (notACaptain(row.name)) continue;
    if (db.getKv(giftSentKey(row.account_id)) !== undefined) continue;
    const seen = db.seenOf?.(row.account_id);
    if (seen && seen.created > cut) continue;
    let p: Parameters<typeof roomOfSave>[0] & { level?: unknown };
    try {
      p = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (!p || typeof p.level !== 'number') continue;
    out.push({ acc: row.account_id, name: row.name, room: roomOfSave(p) });
  }
  return out;
}

/** The letter in her box, her mark with it (one transaction): a captain online sees it arrive at once. */
function sendOne(game: Game, acc: number, at: number): boolean {
  let sent = false;
  game.db.transaction(() => {
    if (game.db.getKv(giftSentKey(acc)) !== undefined) return;
    const en = GIFT28_WORDS.en;
    deliver(game, acc, { from: GIFT28_FROM, subject: en.subject, body: en.body, gold: GIFT28_SILVER, goods: null, units: { u: GIFT28_UNIT, n: GIFT28_N, gift: 1 } });
    game.db.setKv(giftSentKey(acc), at);
    sent = true;
  });
  return sent;
}

/** Send the letter to all who have it due; the whole send marked done. How many got it. */
export function giftSend(game: Game): number {
  const now = game.wallNow();
  const plan = giftPlan(game.db, now);
  const cut = game.db.getKv<{ at: number; n: number }>(GIFT28_DONE)?.at ?? now;
  let n = 0;
  for (const r of plan) if (sendOne(game, r.acc, now)) n++;
  const was = game.db.getKv<{ at: number; n: number }>(GIFT28_DONE);
  game.db.setKv(GIFT28_DONE, { at: cut, n: (was?.n ?? 0) + n });
  return n;
}

/** Accounts that came after the send and get the letter all the same, each once (the owner's word). */
export const GIFT28_LATE: readonly number[] = [214];

/** On boot: the letter goes out once, if it has not (process.env.GIFT28=off holds it back). */
export function giftBoot(game: Game): void {
  if (process.env.GIFT28 === 'off') return;
  // Owner, 2026-10-29: «Нефигугум» came aboard five hours after the send and asked on the forum — his letter too.
  for (const acc of GIFT28_LATE) {
    try {
      if (sendOne(game, acc, game.wallNow())) console.log(`[gift28] the thank-you letter sent late to account ${acc}`);
    } catch (e) {
      console.log(`[gift28] ${(e as Error).message}`);
    }
  }
  if (game.db.getKv(GIFT28_DONE) !== undefined) return;
  try {
    const n = giftSend(game);
    console.log(`[gift28] the thank-you letter sent to ${n} captains`);
  } catch (e) {
    console.log(`[gift28] ${(e as Error).message}`);
  }
}

/** `/gift28 [dry | send | status]`. */
export function adminGift28(game: Game, args: string[]): string {
  const cmd = args[0] ?? 'dry';
  const done = game.db.getKv<{ at: number; n: number }>(GIFT28_DONE);
  if (cmd === 'send') {
    const n = giftSend(game);
    return `Gift letters sent: ${n}.`;
  }
  if (cmd === 'status') return done ? `Gift letters sent so far: ${done.n}.` : 'The gift letter has not gone out yet.';
  const plan = giftPlan(game.db, game.wallNow());
  return `Gift dry run: ${plan.length} captains would get the letter; ${plan.filter((r) => !r.room).length} of them have no room for the musketeers now.`;
}
