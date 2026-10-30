// PvP points and the monthly season (owner, 2026-10-30: «введи еще рейтинг пвп … сколько заработано баллов, сколько
// убито игроков, сделай какие-то ежемесячные награды … это должно на сайте в рейтинге тоже отображаться»). The rules
// and numbers are shared/src/data/pvprank.ts; this module keeps the score and closes the season.
//  - Her record rides in her save (`Profile.pvpr`): this month's tally (and the last month's, kept when the month
//    turns under her), all time, her streak and her best, and the victims of the last day (the diminishing points).
//  - Hooks: Game.creditKill (a captain sunk or taken; the assists from the victim's attackers of the last minute) and
//    pvp.ts endDuel (a 1v1 duel won). Nothing else of the game changes.
//  - The season's turn runs in the lead zone only: the month's table read from every save, written with its payments in
//    the kv `pvprank` in one go (the open month moved on with it), then paid one by one, each payment marked as it goes
//    — a restart resumes and never pays twice (the doubloons have their own reference besides). Then the news: the
//    world's feed and an official post in the forum's News.
//  - The top three's title (cosmetics, `only: 'pvp_season'`) is given and taken back in the zone she sails in, every
//    few seconds: worn through the month after her season, then off; the season's banner stays.

import {
  PVP_ASSIST_WINDOW_S, PVP_CLOTH, PVP_LETTER_FROM, PVP_REPEAT_MS, PVP_REWARDS, PVP_REWARD_MIN, PVP_TITLES, MONTH_NAMES,
  assistPoints, daysLeft, monthLabel, monthOf, rewardFor, winPoints,
} from '../../../shared/src/data/pvprank.ts';
import type { PvpWin } from '../../../shared/src/data/pvprank.ts';
import { titleOf } from '../../../shared/src/data/cosmetics.ts';
import type { PvpRankView, PvpRow, PvpTally } from '../../../shared/src/pvprankproto.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { cosSync, ownsCos } from './cosmetics.ts';
import type { Game } from './Game.ts';
import { atWar } from './guilds.ts';
import { sameGroupAccounts } from './party.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import { creditPremium } from './premium.ts';
import { battleRating, captainShip } from './pvp.ts';
import type { ShipEntity } from './ship.ts';
import { TEST_NAME } from './siterating.ts';

const DAY = 86_400_000;
const KEY = 'pvprank';
/** The month's table is read afresh at most this often (every save is read). */
export const TABLE_TTL = 60_000;
/** Seasons kept (the site's «Прошлые сезоны»). */
const KEEP = 12;

/** Her record (in her save). */
export interface PvpRank {
  /** The month of `season`. */
  m: number;
  season: PvpTally;
  all: PvpTally;
  streak: number;
  best: number;
  /** Her victories of the last day: the victim's account and when (the diminishing points). */
  recent: { v: number; t: number }[];
  /** The month before, kept when the month turned under her (the season's table reads it). */
  prev?: { m: number; t: PvpTally };
}

export const zeroTally = (): PvpTally => ({ pts: 0, kills: 0, sunk: 0, boarded: 0, deaths: 0, duels: 0, assists: 0 });

const n0 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
function tallyOf(raw: unknown): PvpTally {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { pts: n0(r.pts), kills: n0(r.kills), sunk: n0(r.sunk), boarded: n0(r.boarded), deaths: n0(r.deaths), duels: n0(r.duels), assists: n0(r.assists) };
}

/** Her record, made sound and turned to this month (the month before kept as `prev`). */
const sound = new WeakSet<object>();
export function rankOf(game: Game, p: Profile): PvpRank {
  const m = monthOf(game.wallNow());
  if (p.pvpr && sound.has(p.pvpr)) {
    // (made sound once: only the month's turn and the day's victims kept fresh)
    const r = p.pvpr;
    if (r.m !== m) {
      if (r.m < m) r.prev = { m: r.m, t: r.season };
      r.m = m;
      r.season = zeroTally();
    }
    if (r.recent.length && game.wallNow() - r.recent[0].t >= PVP_REPEAT_MS) r.recent = r.recent.filter((x) => game.wallNow() - x.t < PVP_REPEAT_MS);
    return r;
  }
  const raw = (p.pvpr && typeof p.pvpr === 'object' ? p.pvpr : {}) as Partial<PvpRank>;
  const r: PvpRank = {
    m: typeof raw.m === 'number' ? raw.m : m, season: tallyOf(raw.season), all: tallyOf(raw.all), streak: n0(raw.streak), best: n0(raw.best),
    recent: Array.isArray(raw.recent) ? raw.recent.filter((x) => x && typeof x.v === 'number' && typeof x.t === 'number' && game.wallNow() - x.t < PVP_REPEAT_MS).slice(-60) : [],
    ...(raw.prev && typeof raw.prev.m === 'number' ? { prev: { m: raw.prev.m, t: tallyOf(raw.prev.t) } } : {}),
  };
  if (r.m !== m) {
    if (r.m < m) r.prev = { m: r.m, t: r.season };
    r.m = m;
    r.season = zeroTally();
  }
  p.pvpr = r;
  sound.add(r);
  return r;
}

/** A save's tally for a month (null: none) — read only, the save untouched. */
export function monthTally(raw: unknown, m: number): PvpTally | null {
  const r = raw && typeof raw === 'object' ? (raw as Partial<PvpRank>) : null;
  if (!r) return null;
  if (r.m === m) return tallyOf(r.season);
  if (r.prev && r.prev.m === m) return tallyOf(r.prev.t);
  return null;
}

// ------------------------------------------------------------------------------------------------ the farm's rule

/** Why two captains' fights earn nothing (null: they do): one group, one guild or its allies and pacts, friends on
 *  either list, tied by a barter or a voyage together in the last day, or the same address. */
export function farmBlock(game: Game, a: PlayerSession, b: PlayerSession): 'self' | 'group' | 'guild' | 'friend' | 'tie' | 'address' | null {
  if (a.accountId === b.accountId) return 'self';
  if (sameGroupAccounts(game, a.accountId, b.accountId)) return 'group';
  const ga = game.guilds.of(game, a.accountId), gb = game.guilds.of(game, b.accountId);
  if (ga && gb && (ga.id === gb.id || ga.alliance.includes(gb.id) || ga.pacts.includes(gb.id))) return 'guild';
  const pa = a.profile, pb = b.profile;
  if (pa?.friends?.some((f) => f.id === b.accountId) || pb?.friends?.some((f) => f.id === a.accountId)) return 'friend';
  const now = game.wallNow();
  const ta = pa?.pvp.ties[b.accountId], tb = pb?.pvp.ties[a.accountId];
  if ((ta !== undefined && now - ta < DAY) || (tb !== undefined && now - tb < DAY)) return 'tie';
  const ra = a.conn?.remote, rb = b.conn?.remote;
  if (ra && ra === rb && publicAddress(ra)) return 'address';
  return null;
}

/** An address that tells two players apart (a proxy's own, a loopback or a private one tells nothing: every player
 *  behind it would look the same). */
export function publicAddress(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, '').trim().toLowerCase();
  if (!v || v === '?' || v === 'test' || v === '::1' || v === 'localhost') return false;
  if (/^(127|10)\./.test(v) || /^192\.168\./.test(v) || /^172\.(1[6-9]|2\d|3[01])\./.test(v) || /^169\.254\./.test(v)) return false;
  if (/^f[cd][0-9a-f]{2}:/.test(v) || /^fe80:/.test(v)) return false;
  return true;
}

const repeatsOf = (r: PvpRank, victim: number, now: number): number => r.recent.filter((x) => x.v === victim && now - x.t < PVP_REPEAT_MS).length;

function credit(r: PvpRank, pts: number, kind: PvpWin | 'assist', victim: number, now: number): void {
  for (const t of [r.season, r.all]) {
    t.pts += pts;
    if (kind === 'sunk' || kind === 'boarded') {
      t.kills++;
      t[kind]++;
    } else if (kind === 'duel') t.duels++;
    else t.assists++;
  }
  if (kind === 'sunk' || kind === 'boarded') {
    r.streak++;
    r.best = Math.max(r.best, r.streak);
  }
  r.recent = [...r.recent.filter((x) => now - x.t < PVP_REPEAT_MS), { v: victim, t: now }].slice(-60);
}

function say(game: Game, s: PlayerSession, msg: string, kind: 'gold' | 'info' = 'gold'): void {
  game.sendTo(s, { t: 'toast', msg, kind });
}

/** A captain sank or took another captain (Game.creditKill, after pvp.ts onPlayerKill). `killer` is her own ship;
 *  `repaid`: a prize taken and then scuttled (counted once, when taken). */
export function pvpRankKill(game: Game, killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded', repaid = false): void {
  if (repaid || !victim.isPlayer) return;
  const ks = game.sessionOf(killer), vs = game.sessionOf(victim);
  if (!ks?.profile || !vs?.profile || farmBlock(game, ks, vs)) return;
  const now = game.wallNow();
  const vr = rankOf(game, vs.profile);
  vr.season.deaths++;
  vr.all.deaths++;
  vr.streak = 0;
  const war = atWar(game, killer, victim);
  const vBR = battleRating(game, victim);
  const kr = rankOf(game, ks.profile);
  const ratio = vBR / Math.max(0.1, battleRating(game, killer));
  const rep = repeatsOf(kr, vs.accountId, now);
  const pts = winPoints(how, ratio, rep, war);
  credit(kr, pts, how, vs.accountId, now);
  if (pts > 0) say(game, ks, `PvP: +${pts} points for ${vs.name}.`);
  else say(game, ks, rep >= 3 ? `PvP: no points for ${vs.name} — beaten too often today.` : `PvP: no points for ${vs.name} — she was far weaker than you.`, 'info');
  // The assists: the other captains whose shots (or escorts') landed on her in the last minute.
  const done = new Set<number>([ks.accountId, vs.accountId]);
  for (const [id, t] of victim.attackers) {
    if (t < game.now - PVP_ASSIST_WINDOW_S) continue;
    const cap = captainShip(game, game.ships.get(id) ?? null);
    const hs = cap ? game.sessionOf(cap) : null;
    if (!cap || !hs?.profile || done.has(hs.accountId)) continue;
    done.add(hs.accountId);
    if (farmBlock(game, hs, vs)) continue;
    const hr = rankOf(game, hs.profile);
    const a = assistPoints(how, vBR / Math.max(0.1, battleRating(game, cap)), repeatsOf(hr, vs.accountId, now), atWar(game, cap, victim));
    credit(hr, a, 'assist', vs.accountId, now);
    if (a > 0) say(game, hs, `PvP: +${a} points, an assist on ${vs.name}.`);
  }
}

/** A 1v1 duel won (pvp.ts endDuel): her points by the levels. */
export function pvpRankDuel(game: Game, winner: number, loser: number): void {
  const ws = game.sessionByAccount(winner), ls = game.sessionByAccount(loser);
  if (!ws?.profile || !ls?.profile || farmBlock(game, ws, ls)) return;
  const now = game.wallNow();
  const wr = rankOf(game, ws.profile);
  const lw = ws.ship?.combatLevel ?? ws.profile.level, ll = ls.ship?.combatLevel ?? ls.profile.level;
  const rep = repeatsOf(wr, loser, now);
  const pts = winPoints('duel', 1.45 ** (ll - lw), rep);
  credit(wr, pts, 'duel', loser, now);
  if (pts > 0) say(game, ws, `PvP: +${pts} points for the duel with ${ls.name}.`);
}

// ------------------------------------------------------------------------------------------------ the month's table

interface Entry { acc: number; name: string; captain: string; level: number; guild: string | null; t: PvpTally }

interface ProfileLike { captain?: string; level?: number; pvpr?: unknown }

/** Kept off the tables: the load-test's and the testers' accounts, and any the owner hides (siterating.ts's rule). */
function hiddenCap(game: Game, acc: number, name: string): boolean {
  if (TEST_NAME.test(name.trim())) return true;
  const list = [...(process.env.SITE_HIDDEN ?? '').split(','), ...(game.db.getKv<(string | number)[]>('site_hidden') ?? [])].map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return list.includes(String(acc)) || list.includes(name.trim().toLowerCase());
}

const sortEntries = (a: Entry, b: Entry) => b.t.pts - a.t.pts || b.t.kills - a.t.kills || a.t.deaths - b.t.deaths || a.name.localeCompare(b.name);

/** Every captain's tally of a month (points above nought), the best first: the saves, and the live state of those aboard. */
export function readMonth(game: Game, m: number): Entry[] {
  const out: Entry[] = [];
  for (const row of game.db.allCaptains()) {
    if (!row.name || hiddenCap(game, row.account_id, row.name)) continue;
    let p = game.sessionByAccount(row.account_id)?.profile as ProfileLike | null | undefined;
    if (!p) {
      try {
        p = JSON.parse(row.data) as ProfileLike;
      } catch {
        continue;
      }
    }
    const t = monthTally(p?.pvpr, m);
    if (!p || !t || t.pts <= 0) continue;
    const captain = typeof p.captain === 'string' && Object.hasOwn(CAPTAINS, p.captain) ? p.captain : 'pirate';
    out.push({ acc: row.account_id, name: row.name, captain, level: Math.max(1, n0(p.level)), guild: game.guilds.of(game, row.account_id)?.tag ?? null, t });
  }
  return out.sort(sortEntries);
}

const tables = new WeakMap<Game, { at: number; m: number; list: Entry[] }>();
/** This month's table (a minute's snapshot). */
export function monthTable(game: Game): Entry[] {
  const m = monthOf(game.wallNow());
  const c = tables.get(game);
  if (c && c.m === m && game.wallNow() - c.at < TABLE_TTL) return c.list;
  const list = readMonth(game, m);
  tables.set(game, { at: game.wallNow(), m, list });
  return list;
}
/** For the tests: the snapshot forgotten. */
export const forgetPvpTable = (game: Game): void => void tables.delete(game);

const rowOf = (e: Entry, rank: number): PvpRow => ({ rank, name: e.name, captain: e.captain, level: e.level, pts: e.t.pts, kills: e.t.kills, deaths: e.t.deaths });

// ------------------------------------------------------------------------------------------------ the season's turn

/** A closed season: its top ten (the payments while they are being made). */
export interface Season {
  m: number;
  top: (PvpRow & { acc: number; guild: string | null; title?: string })[];
  /** Everyone owed (cleared once all are paid). */
  pay?: { acc: number; name: string; place: number; pts: number }[];
  paid?: number[];
  announced?: boolean;
  done?: boolean;
}

export interface PvpStore {
  v: 1;
  /** The month being played (closed when the calendar has passed it). */
  open: number;
  seasons: Season[];
}

function load(game: Game): PvpStore | null {
  const s = game.db.getKv<PvpStore>(KEY);
  return s && s.v === 1 && Array.isArray(s.seasons) && typeof s.open === 'number' ? s : null;
}
const save = (game: Game, s: PvpStore) => {
  game.db.setKv(KEY, s);
  stores.set(game, { at: game.wallNow(), s });
};
const stores = new WeakMap<Game, { at: number; s: PvpStore | null }>();
/** The store as the other zones see it (read again every half minute). */
function cached(game: Game): PvpStore | null {
  const c = stores.get(game);
  if (c && game.wallNow() - c.at < 30_000) return c.s;
  const s = load(game);
  stores.set(game, { at: game.wallNow(), s });
  return s;
}

/** The forum's News (main.ts wires it: an official topic). */
let newsHook: ((title: string, body: string) => void) | null = null;
export function setPvpNews(fn: ((title: string, body: string) => void) | null): void {
  newsHook = fn;
}

const monthRu = (m: number) => `${MONTH_NAMES[m % 12][1]} ${Math.floor(m / 12)}`;

/** The season's turn when the calendar has passed the open month (the lead zone, every few seconds); a turn begun and
 *  cut short is finished. */
export function closeSeasonIfDue(game: Game): void {
  const cur = monthOf(game.wallNow());
  let st = load(game);
  if (!st) {
    save(game, (st = { v: 1, open: cur, seasons: [] }));
    return;
  }
  if (st.open < cur && !st.seasons.some((x) => x.m === st!.open)) {
    st.seasons.push(buildSeason(game, st.open));
    st.seasons = st.seasons.slice(-KEEP);
  }
  if (st.open < cur) {
    st.open = cur;
    save(game, st);
  }
  for (const se of st.seasons) if (!se.done) finishSeason(game, st, se);
}

/** The season's table and who is owed. */
export function buildSeason(game: Game, m: number): Season {
  const list = readMonth(game, m);
  const top = list.slice(0, 10).map((e, i) => {
    const rw = rewardFor(i + 1, e.t.pts);
    return { ...rowOf(e, i + 1), acc: e.acc, guild: e.guild, ...(rw?.title ? { title: rw.title } : {}) };
  });
  const pay = list.map((e, i) => ({ acc: e.acc, name: e.name, place: i + 1, pts: e.t.pts })).filter((x) => x.pts >= PVP_REWARD_MIN);
  return { m, top, pay, paid: [] };
}

function finishSeason(game: Game, st: PvpStore, se: Season): void {
  const label = monthLabel(se.m);
  for (const x of se.pay ?? []) {
    if (se.paid?.includes(x.acc)) continue;
    (se.paid ??= []).push(x.acc);
    save(game, st); // marked before the letter goes: a crash between costs her one letter, never two
    payOne(game, label, se.m, x);
  }
  if (!se.announced) {
    se.announced = true;
    save(game, st);
    announce(game, se);
  }
  se.done = true;
  delete se.pay;
  delete se.paid;
  save(game, st);
}

function payOne(game: Game, label: string, m: number, x: { acc: number; place: number; pts: number }): void {
  const rw = rewardFor(x.place, x.pts);
  if (!rw) return;
  const top = x.place <= PVP_REWARDS.length;
  let dbl = 0;
  if (rw.doubloons > 0 && creditPremium(game, x.acc, rw.doubloons, 'gift', `pvp:${m}:${x.place}`, true) !== null) dbl = rw.doubloons;
  const title = rw.title ? titleOf(rw.title)?.name[0] : undefined;
  const body = title
    ? `The PvP season ${label} is over. You took place ${x.place} with ${x.pts} points. Enclosed: ${rw.silver} silver; ${dbl} doubloons are on your account. The title «${title}» is yours for the month, and the season’s banner for good.`
    : dbl > 0
      ? `The PvP season ${label} is over. You took place ${x.place} with ${x.pts} points. Enclosed: ${rw.silver} silver; ${dbl} doubloons are on your account.`
      : `The PvP season ${label} is over. You took place ${x.place} with ${x.pts} points. Enclosed: ${rw.silver} silver.`;
  deliver(game, x.acc, { from: PVP_LETTER_FROM, subject: top ? `PvP season ${label}: place ${x.place}` : `PvP season ${label}: your share`, body, gold: rw.silver, goods: null });
}

function announce(game: Game, se: Season): void {
  const label = monthLabel(se.m);
  const t = se.top;
  if (t.length) {
    const msg = t.length >= 3 ? `WORLD: The PvP season ${label} is over. 1st ${t[0].name}, 2nd ${t[1].name}, 3rd ${t[2].name}.` : `WORLD: The PvP season ${label} is over. The champion: ${t[0].name}.`;
    for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg, kind: 'gold' });
  }
  if (!newsHook) return;
  const rows = t.map((r) => `| ${r.rank} | ${r.name}${r.guild ? ` [${r.guild}]` : ''} | ${r.pts} | ${r.kills} | ${r.deaths} |`).join('\n');
  const prizes = PVP_REWARDS.length;
  const body = `ПвП-сезон **${monthRu(se.m)}** завершён. Спасибо всем, кто выходил в море против капитанов!

${t.length ? `### Лучшие капитаны сезона\n\n| Место | Капитан | Очки | Убито | Смертей |\n|---|---|---|---|---|\n${rows}` : 'В этом сезоне никто не набрал очков.'}

### Награды
- **1–3 место:** звания «Гроза морей», «Морской ястреб» и «Абордажник» на весь следующий месяц, знамя сезона навсегда, ${PVP_REWARDS[0].doubloons} / ${PVP_REWARDS[1].doubloons} / ${PVP_REWARDS[2].doubloons} дублонов и серебро.
- **4–${prizes} место:** от ${PVP_REWARDS[3].silver.toLocaleString('ru-RU')} до ${PVP_REWARDS[prizes - 1].silver.toLocaleString('ru-RU')} серебра и немного дублонов.
- **Все, кто набрал ${PVP_REWARD_MIN}+ очков:** доля серебра.

Награды уже лежат в письмах («Журнал» → «Письма»). Новый сезон начался — очки обнулены. Рейтинг: [/site/rating/?board=pvp](/site/rating/?board=pvp).`;
  try {
    newsHook(`Итоги ПвП-сезона: ${monthRu(se.m)}`, body);
  } catch {
    // the forum's trouble is not the season's: the payments are made
  }
}

/** The closed seasons for the site (newest first): no account ids. */
export function pastSeasons(game: Game, hidden?: (acc: number, name: string) => boolean): { month: number; label: string; top: (PvpRow & { guild: string | null })[] }[] {
  const st = cached(game);
  if (!st) return [];
  return [...st.seasons].filter((x) => x.done).reverse().map((x) => ({
    month: x.m, label: monthLabel(x.m),
    top: x.top.filter((r) => !hidden?.(r.acc, r.name)).map((r) => ({ rank: r.rank, name: r.name, captain: r.captain, level: r.level, pts: r.pts, kills: r.kills, deaths: r.deaths, guild: r.guild })),
  }));
}

// ------------------------------------------------------------------------------------------------ the title's month

/** The season's title she should wear now and whether the banner is hers (by the closed seasons). */
export function seasonHonours(game: Game, acc: number): { title: string | null; banner: boolean } {
  const st = cached(game);
  if (!st) return { title: null, banner: false };
  const cur = monthOf(game.wallNow());
  let title: string | null = null, banner = false;
  for (const se of st.seasons) for (const r of se.top) {
    if (r.acc !== acc || !r.title) continue;
    banner = true;
    if (se.m === cur - 1 || se.m === cur) title = r.title; // (this month's: only the tester's early close)
  }
  return { title, banner };
}

function syncHonours(game: Game, s: PlayerSession): void {
  const h = seasonHonours(game, s.accountId);
  const add: string[] = [], drop: string[] = [];
  for (const id of PVP_TITLES) (id === h.title ? add : drop).push(`title:${id}`);
  if (h.banner) add.push(`cloth:${PVP_CLOTH}`);
  const had = new Set(add.filter((k) => cosOwned(game, s, k)));
  if (!cosSync(game, s, add, drop)) return;
  if (h.title && !had.has(`title:${h.title}`)) say(game, s, `The season’s title «${titleOf(h.title)?.name[0] ?? ''}» is yours this month.`);
  if (h.banner && !had.has(`cloth:${PVP_CLOTH}`)) say(game, s, 'The season’s banner is yours.');
}
const cosOwned = (game: Game, s: PlayerSession, k: string): boolean => ownsCos(game, s.accountId, k);

let lastStep = new WeakMap<Game, number>();
/** Every second (Game.everySecond): every ten, the season's turn (the lead zone) and the honours of those aboard. */
export function stepPvpRank(game: Game): void {
  const now = game.wallNow();
  if (now - (lastStep.get(game) ?? 0) < 10_000) return;
  lastStep.set(game, now);
  if (game.zoneLead) closeSeasonIfDue(game);
  for (const s of game.sessions) if (s.profile && s.authed && s.disconnectedAt === null) syncHonours(game, s);
}
/** For the tests. */
export const forgetPvpRank = (game: Game): void => {
  stores.delete(game);
  tables.delete(game);
  lastStep = new WeakMap();
};

// ------------------------------------------------------------------------------------------------ her page

export function pvpRankView(game: Game, s: PlayerSession): PvpRankView {
  const r = rankOf(game, s.profile!);
  const list = monthTable(game);
  const others = list.filter((e) => e.acc !== s.accountId);
  const me: Entry | null = r.season.pts > 0 ? { acc: s.accountId, name: s.name, captain: s.profile!.captain, level: s.profile!.level, guild: null, t: r.season } : null;
  const merged = me ? [...others, me].sort(sortEntries) : others;
  const st = cached(game);
  const last = st?.seasons.filter((x) => x.done).at(-1);
  return {
    month: r.m, daysLeft: daysLeft(game.wallNow()), season: { ...r.season }, all: { ...r.all },
    rank: me ? merged.indexOf(me) + 1 : null, streak: r.streak, best: r.best,
    top: merged.slice(0, 10).map((e, i) => rowOf(e, i + 1)), ranked: merged.length,
    last: last ? { month: last.m, top: last.top.slice(0, 3).map((x) => ({ rank: x.rank, name: x.name, captain: x.captain, level: x.level, pts: x.pts, kills: x.kills, deaths: x.deaths })) } : null,
  };
}

export function pvpRankMessage(game: Game, s: PlayerSession, msg: { action?: string }): void {
  if (!s.profile || msg.action !== 'view') return;
  game.sendTo(s, { t: 'pvprank', view: pvpRankView(game, s) });
}

/** The tester's console: `/pvprank` her record; `add <points> [kills]`; `close` the season now (the current month
 *  closed and paid as if it were over; the real turn of this month is then only its news). */
export function adminPvpRank(game: Game, s: PlayerSession, args: string[]): string {
  const r = rankOf(game, s.profile!);
  if (args[0] === 'add') {
    const pts = Math.max(0, Math.min(100_000, Math.floor(Number(args[1]) || 0)));
    const kills = Math.max(0, Math.min(10_000, Math.floor(Number(args[2]) || 0)));
    for (const t of [r.season, r.all]) {
      t.pts += pts;
      t.kills += kills;
      t.sunk += kills;
    }
    r.best = Math.max(r.best, kills);
    forgetPvpTable(game);
    return `PvP: ${r.season.pts} points this month, ${r.all.pts} in all.`;
  }
  if (args[0] === 'close') {
    const st = load(game) ?? { v: 1 as const, open: r.m, seasons: [] };
    if (!st.seasons.some((x) => x.m === r.m)) st.seasons.push(buildSeason(game, r.m));
    save(game, st);
    for (const se of st.seasons) if (!se.done) finishSeason(game, st, se);
    return `PvP season ${monthLabel(r.m)} closed.`;
  }
  return `PvP: ${r.season.pts} points this month, ${r.all.pts} in all.`;
}
