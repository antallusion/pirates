// The sea's calendar of the Heroes (docs/17 H3 item 10). The day is the world's day of 48 real minutes, dawning at six
// on its clock; seven make a week (see shared/src/data/week.ts for why). Each dawn the mines pay and the town halls take
// in their silver; each seventh the herald names the week (its own dice, seeded by the week's number, so the sea's rng
// is never touched) and the dwellings' new men are counted when next they are looked at. The admin's `/week next` moves
// the calendar on a week without touching the world's clock, and `/week <kind>` names this week anew.

import { supplyWeekly } from './isles18.ts';
import { DAY_LENGTH_SEC } from '../../../shared/src/constants.ts';
import { WEEKS, WEEK_DAYS, WEEK_KINDS, dayIndex, secsToDawn, weekKind, weekOfDay } from '../../../shared/src/data/week.ts';
import type { WeekKind } from '../../../shared/src/data/week.ts';
import type { WeekView } from '../../../shared/src/h3proto.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { hallsDay } from './town.ts';
import { minesDay, minesVersion, minesView } from './mines.ts';

interface Cal {
  /** Days the admin has moved the calendar on (the world's clock untouched). */
  offset: number;
  /** Weeks named by the admin. */
  forced: Record<string, WeekKind>;
  /** The last day reckoned (its dawn's pay made). */
  lastDay: number | null;
}

const KEY = 'h3:cal';
const cals = new WeakMap<Game, Cal>();
const sent = new WeakMap<PlayerSession, string>();
const sentMines = new WeakMap<PlayerSession, number>();

function cal(game: Game): Cal {
  let c = cals.get(game);
  if (!c) {
    const saved = game.db.getKv<Cal>(KEY);
    c = { offset: Number(saved?.offset) || 0, forced: saved?.forced ?? {}, lastDay: Number.isFinite(saved?.lastDay) ? Number(saved!.lastDay) : null };
    cals.set(game, c);
  }
  return c;
}

const save = (game: Game) => game.db.setKv(KEY, cal(game));

/** The sea's day (from 0). */
export function today(game: Game): number {
  return dayIndex(game.now) + cal(game).offset;
}

/** The sea's week (from 0). */
export function thisWeek(game: Game): number {
  return weekOfDay(today(game));
}

/** What a week is named for: the admin's word, else its own dice. */
export function kindOfWeek(game: Game, week: number): WeekKind {
  return cal(game).forced[String(week)] ?? weekKind(week);
}

export function weekNow(game: Game): WeekKind {
  return kindOfWeek(game, thisWeek(game));
}

export function weekView(game: Game): WeekView {
  const d = today(game);
  const day = d - weekOfDay(d) * WEEK_DAYS;
  return { n: weekOfDay(d) + 1, day: day + 1, kind: weekNow(game), nextIn: Math.round(secsToDawn(game.now) + (WEEK_DAYS - 1 - day) * DAY_LENGTH_SEC) };
}

/** The herald's cry for a week: its number, its name and what it does. */
export function weekCry(game: Game): string {
  const k = weekNow(game);
  return `Week ${thisWeek(game) + 1} begins: ${WEEKS[k].name[0]}. ${WEEKS[k].text[0]}`;
}

function dawn(game: Game, day: number): void {
  minesDay(game, day);
  hallsDay(game, day);
  if (day % WEEK_DAYS === 0) {
    supplyWeekly(game, weekOfDay(day)); // docs/18 #32: the supply routes deliver
    const cry = weekCry(game);
    for (const s of game.sessions) if (s.profile) game.sendTo(s, { t: 'toast', msg: cry, kind: 'info' });
  }
}

/** Every few seconds: the dawns since the last look (a week at most at once), and the calendar to those who have not
 *  seen today's, and the mines' flags to those who have not seen the latest. */
export function stepCalendar(game: Game): void {
  const c = cal(game);
  const d = today(game);
  if (c.lastDay === null || d < c.lastDay) {
    c.lastDay = d;
    save(game);
  }
  if (d > c.lastDay) {
    const from = Math.max(c.lastDay + 1, d - WEEK_DAYS + 1);
    for (let k = from; k <= d; k++) dawn(game, k);
    c.lastDay = d;
    save(game);
  }
  const key = `${d}:${weekNow(game)}`;
  const mv = minesVersion(game);
  for (const s of game.sessions) {
    if (!s.profile) continue;
    if (sent.get(s) !== key) {
      sent.set(s, key);
      game.sendTo(s, { t: 'week', view: weekView(game) });
    }
    if (sentMines.get(s) !== mv) {
      sentMines.set(s, mv);
      game.sendTo(s, { t: 'mines', list: minesView(game, s) });
    }
  }
}

/** The admin: the calendar a week on (to the next week's first dawn), or this week named anew. */
export function adminWeek(game: Game, arg: string): string {
  const c = cal(game);
  if (arg === 'next') {
    const d = today(game);
    c.offset += WEEK_DAYS - (d - weekOfDay(d) * WEEK_DAYS);
    save(game);
    stepCalendar(game);
    return weekCry(game);
  }
  if ((WEEK_KINDS as string[]).includes(arg)) {
    c.forced[String(thisWeek(game))] = arg as WeekKind;
    // Keep the admin's words for the last few weeks only.
    for (const k of Object.keys(c.forced)) if (Number(k) < thisWeek(game) - 8) delete c.forced[k];
    save(game);
    const cry = weekCry(game);
    for (const s of game.sessions) if (s.profile) game.sendTo(s, { t: 'toast', msg: cry, kind: 'info' });
    stepCalendar(game);
    return cry;
  }
  const v = weekView(game);
  return `Week ${v.n}, day ${v.day}: ${WEEKS[v.kind].name[0]}. Next week in ${Math.ceil(v.nextIn / 60)} min.`;
}
