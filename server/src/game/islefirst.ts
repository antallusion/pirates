// The island's first build, guided (owner, 2026-10-28: 28 islands on the live server, 23 with nothing but the town hall —
// «как будто никто не доплывает»). After the claim three steps, one at a time, each with its reward:
//   1. «Постройте Казарму морпехов» (dw2) — ordered from anywhere, paid from the treasury, the yard, then the purse;
//   2. «Наймите морпехов в любом порту» (any marines signed on);
//   3. «Постройте Стрельбище» (dw3).
// The governor's help, once: a captain whose island cannot pay its bunkhouse and its barracks gets what is missing
// (goods into the yard, silver into the treasury) — the live data had 0 coal on almost every new island.
// Captains past the claim before this get it on their next login (the step check runs every few seconds).

import { mightRoom, townCost } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { XP_UNITS, lumpXp } from '../../../shared/src/data/xpcurve.ts';
import type { IsleFirstView } from '../../../shared/src/protocol.ts';
import { ownIsland } from './estate.ts';
import { crewFree, purseOf, reckonBase, stock, yardOf } from './base.ts';
import type { Yard } from './base.ts';
import type { Game } from './Game.ts';
import type { Holding } from './holdings.ts';
import { addXp } from './player.ts';
import type { PlayerSession } from './player.ts';
import { townHooks, townLevel, townWhy } from './town.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import { roomFor, sansHands, swapOf } from './dwell.ts';

export interface IsleFirst {
  /** The step she is on (ISLE_FIRST.length: done). */
  step: number;
  /** The governor's help given. */
  help?: boolean;
}

export interface IsleFirstStep {
  id: 'dw2' | 'hire' | 'dw3';
  /** Silver to her purse, goods to the island's yard. */
  silver: number;
  goods: Partial<Record<GoodId, number>>;
}

/** The steps and their rewards: the barracks' brings the range's timber, iron and powder (the yard makes no powder). */
export const ISLE_FIRST: IsleFirstStep[] = [
  { id: 'dw2', silver: 300, goods: { timber: 12, iron: 10, gunpowder: 8 } },
  { id: 'hire', silver: 400, goods: {} },
  { id: 'dw3', silver: 600, goods: {} },
];

/** The first two buildings the governor's help makes sure of. */
export const HELP_FOR: TownId[] = ['dw1', 'dw2'];

const ordered = (y: Yard, id: TownId) => townLevel(y, id) > 0 || y.jobs.some((j) => j.what === `t:${id}`);

/** What the island still lacks for the bunkhouse and the barracks (those not yet ordered): goods and silver. */
export function helpNeeded(s: PlayerSession, h: Holding, y: Yard): { silver: number; goods: Partial<Record<GoodId, number>> } {
  let silver = 0;
  const goods: Partial<Record<GoodId, number>> = {};
  for (const id of HELP_FOR) {
    if (ordered(y, id)) continue;
    const c = townCost(id, 1);
    silver += c.silver;
    for (const [g, n] of Object.entries(c.goods) as [GoodId, number][]) goods[g] = (goods[g] ?? 0) + n;
  }
  const out: Partial<Record<GoodId, number>> = {};
  for (const [g, n] of Object.entries(goods) as [GoodId, number][]) {
    const have = Math.floor((y.res[g] ?? 0) + (h.store[g] ?? 0));
    if (have < n) out[g] = n - have;
  }
  return { silver: Math.max(0, silver - purseOf(s, h)), goods: out };
}

/** The governor's help, once (null: nothing was wanted). */
export function governorHelp(game: Game, s: PlayerSession, h: Holding, y: Yard): string | null {
  const f = s.profile!.isleFirst!;
  if (f.help) return null;
  f.help = true;
  if (ordered(y, 'dw2')) return null;
  const need = helpNeeded(s, h, y);
  const goods = Object.entries(need.goods) as [GoodId, number][];
  for (const [g, n] of goods) y.res[g] = (y.res[g] ?? 0) + n;
  if (need.silver > 0) h.treasury += need.silver;
  if (!goods.length && need.silver <= 0) return null;
  game.holdings.touch();
  game.db.ledger(s.accountId, 'isle_help', 0, `${h.island}:${need.silver}:${goods.map(([g, n]) => `${g}${n}`).join(',')}`);
  return 'The governor’s help: your island’s yard and treasury now pay for the bunkhouse and the marine barracks.';
}

function done(game: Game, s: PlayerSession, h: Holding, y: Yard): void {
  const p = s.profile!;
  const f = p.isleFirst!;
  const st = ISLE_FIRST[f.step];
  if (!st) return;
  f.step++;
  p.gold += st.silver;
  for (const [g, n] of Object.entries(st.goods) as [GoodId, number][]) y.res[g] = (y.res[g] ?? 0) + n;
  if (Object.keys(st.goods).length) game.holdings.touch();
  const lv = addXp(p, lumpXp(p.level, XP_UNITS.tutorialGoal));
  if (s.ship) s.ship.level = p.level;
  game.sendTo(s, { t: 'toast', msg: Object.keys(st.goods).length ? `Island step done: ${st.silver} silver to your purse; timber, iron and powder for the shooting range to the yard.` : `Island step done: ${st.silver} silver to your purse.`, kind: 'good' });
  if (lv) game.sendTo(s, { t: 'toast', msg: `Level ${p.level}!`, kind: 'xp' });
  game.pushSelf(s);
}

/** Her island and its yard, if she holds one. */
function holdingOf(game: Game, s: PlayerSession): { h: Holding; y: Yard } | null {
  const h = ownIsland(game, s.accountId);
  if (!h) return null;
  return { h, y: yardOf(game, h) };
}

/** Every few seconds (Game's tick) and after a build: start the steps once she holds an island; count the buildings. */
export function isleFirstCheck(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p || !s.ship) return;
  if (p.isleFirst && p.isleFirst.step >= ISLE_FIRST.length) return;
  const m = holdingOf(game, s);
  if (!m) return;
  const { h, y } = m;
  if (!p.isleFirst) {
    p.isleFirst = { step: 0 };
    reckonBase(game, h);
  }
  const help = governorHelp(game, s, h, y);
  if (help) game.sendTo(s, { t: 'toast', msg: help, kind: 'good' });
  const st = ISLE_FIRST[p.isleFirst.step];
  if (st && st.id !== 'hire' && ordered(y, st.id)) done(game, s, h, y);
  // no marine to be had, and her army holds marines or better already: the step is hers (never a nag)
  else if (st?.id === 'hire' && holdsMarines(s) && hireStuck(s)) done(game, s, h, y);
}

/** The marines' step when no marine can be had (owner, 2026-10-29: «у меня армия уже целиком, я не могу никого нанять,
 *  зачем меня спрашивает зайти и кого-то нанять?»): 'room' — no hammock even with the hands ashore, nor a slot;
 *  'might' — her army is over the might cap of her ship's level; 'silver' — not one marine's pay. Null: she can. */
export function hireStuck(s: PlayerSession): 'room' | 'might' | 'silver' | null {
  const ship = s.ship;
  if (!ship || !s.profile) return null;
  if (roomFor(s, 'marine') <= 0) {
    const hands = swapOf(ship.army, 2);
    const might = mightRoom(hands ? sansHands(ship.army) : ship.army, 'marine', ship.shipLevel, ship.stats.crewMax, ship.armySlots);
    return ship.stats.crewMax - ship.crew + hands > 0 && might <= 0 ? 'might' : 'room';
  }
  return s.profile.gold < UNITS.marine.cost ? 'silver' : null;
}
/** Nothing useful to hire anywhere (owner, 2026-10-29): no free hammock for a deckhand, and no room or no silver for
 *  the best kind her island opens (marines if none) — the hints keep off every hire window (client pointer.ts). */
export function noHire(s: PlayerSession, best: import('../../../shared/src/data/army.ts').UnitId | null | undefined): boolean {
  if (!s.ship || !s.profile) return false;
  const gold = s.profile.gold;
  for (const u of [best ?? 'marine', 'marine', 'deckhand'] as const) if (UNITS[u] && roomFor(s, u) > 0 && gold >= UNITS[u].cost) return false;
  return true;
}
/** Her army holds marines or better of her own (a gift's men and the beasts aside). */
const holdsMarines = (s: PlayerSession): boolean => !!s.ship?.army.some((x) => !x.g && UNITS[x.u] && UNITS[x.u].tier >= 2 && !UNITS[x.u].beast);

/** Men signed on (dwell.ts recruit): marines (tier 2) count for the second step. */
export function isleFirstHire(game: Game, s: PlayerSession, tier: number): void {
  const f = s.profile?.isleFirst;
  if (!f || ISLE_FIRST[f.step]?.id !== 'hire' || tier !== 2) return;
  const m = holdingOf(game, s);
  if (m) done(game, s, m.h, m.y);
}

/** The HUD's line: the step, and whether its button may be pressed now. */
export function isleFirstView(game: Game, s: PlayerSession): IsleFirstView | null {
  const f = s.profile?.isleFirst;
  if (!f || f.step >= ISLE_FIRST.length) return null;
  const m = holdingOf(game, s);
  if (!m) return null;
  const { h, y } = m;
  const st = ISLE_FIRST[f.step];
  const left = (id: TownId) => {
    const j = y.jobs.find((x) => x.what === `t:${id}`);
    return j ? Math.max(0, Math.ceil((j.end - game.wallNow()) / 1000)) : 0;
  };
  const base = { step: f.step, of: ISLE_FIRST.length, id: st.id, silver: st.silver, goods: st.goods };
  if (st.id === 'hire') {
    const stuck = hireStuck(s);
    return { ...base, open: 'dw2', ready: !stuck, wait: left('dw2'), ...(stuck ? { stuck } : {}) };
  }
  // the barracks ask the bunkhouse first: its card is the one to open while it is not ordered (its work: a wait)
  const id: 'dw1' | 'dw2' | 'dw3' = st.id === 'dw2' && !ordered(y, 'dw1') ? 'dw1' : st.id;
  const before: TownId = st.id === 'dw2' ? 'dw1' : 'dw2';
  const c = townCost(id, townLevel(y, id) + 1);
  const why = townWhy(game, s, h, y, id) ?? crewFree(h, y, game);
  const goods = (Object.entries(c.goods) as [GoodId, number][]).every(([g, n]) => stock(h, y, s, false, g) >= n);
  return { ...base, open: id, ready: !why && goods && purseOf(s, h) >= c.silver, wait: left(before), ...(why ? { why } : {}) };
}

/** Wired at start (Game's constructor): a level ordered counts at once. */
export function initIsleFirst(): void {
  townHooks.built = (game, s) => isleFirstCheck(game, s);
}
