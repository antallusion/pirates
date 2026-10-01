// docs/16 Batch F on the server — progress and goals:
//  26. careers in the Crown, the League and the Brethren: points from standing and the deeds done for the flag (and
//      merit in its service); five ranks, each a title, and a price off, the quartermaster's gifts, the yards' next
//      class and the flag's pennant on the way;
//  27. the week's three challenges, each in a sea of its own, with their tables; the first three paid when the week
//      turns (by letter, so a captain ashore is paid too), the first also given a title;
//  28. the album: fish, wonders, omens, trophies, beasts and letters — a reward for each set made whole;
//  29. titles for feats, earned by what she has done, one chosen and flown with the ship's name;
//  30. back after twelve hours or more: what happened while she was away, and a gift by the time away (capped).
// Nothing here draws on the game's shared random stream; the quartermaster's gifts use their own seeded one.

import {
  AWAY_MIN_H, CAREER_DISCOUNT, CAREER_GIFTS, CAREER_IDS, CAREER_PENNANT_RANK, CAREER_POINTS, CAREER_REP, CAREER_YARD_RANK, CAREERS,
  DEED_BOARDED, DEED_RAIDER, DEED_SUNK, FEATS, SET_IDS, TRADE_PER_POINT, WEEKLY, WEEKLY_PRIZES, WEEKLY_TITLE, WEEKLY_TOP, WEEK_MS,
  awayGift, careerPoints, careerRank, careerTitle, setDefs, weekNumber, weeklyChallenges,
} from '../../../shared/src/data/renown.ts';
import type { CareerId, FeatStat, SetId, WeeklyKind } from '../../../shared/src/data/renown.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { SEA_LETTERS } from '../../../shared/src/data/encounters.ts';
import { itemName, makeItem } from '../../../shared/src/data/items.ts';
import { OMENS } from '../../../shared/src/data/omens.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { AwayView, CareerView, RenownView, SetView, WeeklyView } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { deliver, lettersSince } from './post.ts';
import { ownIsland } from './estate.ts';
import { todaysOmen } from './omens.ts';
import { wondersOf } from './wonders.ts';
import { grantSpeedups } from './base.ts';
import { giveGoods } from './director.ts';
import { BEAST_PLURAL, isCreature } from '../../../shared/src/data/bestiary.ts';
import type { CreatureId } from '../../../shared/src/data/bestiary.ts';

export interface RenownProfile {
  /** Ships sunk or taken by kind: 'crown', 'league', 'confederacy', 'brokers', 'pirate', 'ghost'. */
  kills: Record<string, number>;
  /** Deed points for each flag. */
  deeds: Partial<Record<CareerId, number>>;
  /** The highest rank reached in each (gifts and titles are given once). */
  ranks: Partial<Record<CareerId, number>>;
  /** Omens she has been at sea under. */
  omens: string[];
  /** Sets of the album rewarded; feats won; the week's first places given their title ("week:index"). */
  sets: string[];
  feats: string[];
  won: string[];
  /** When she went ashore, and her island then (docs/16 #30); the gift waiting. */
  away?: { at: number; goods: number; treasury: number } | null;
  gift?: { silver: number; speedups: number; provisions: number } | null;
  /** docs/18 #46: the creature kinds she has fought (the bestiary's pages, in the order they were written). */
  met?: string[];
}

export function rn(p: Profile): RenownProfile {
  const r = (p.renown ??= { kills: {}, deeds: {}, ranks: {}, omens: [], sets: [], feats: [], won: [] });
  r.kills ??= {};
  r.deeds ??= {};
  r.ranks ??= {};
  r.omens ??= [];
  r.sets ??= [];
  r.feats ??= [];
  r.won ??= [];
  return r;
}

const toast = (game: Game, s: PlayerSession, msg: string, kind: 'good' | 'gold' | 'info' = 'gold') => game.sendTo(s, { t: 'toast', msg, kind });

function earnTitle(game: Game, s: PlayerSession, title: string): void {
  const p = s.profile!;
  if (p.titles.includes(title)) return;
  p.titles.push(title);
  toast(game, s, `A new title: “${title}”. Choose it in the company window.`);
}

// ================================================================== 26. careers

export function careerOf(p: Profile, id: CareerId): { rep: number; deeds: number; merit: number; points: number; rank: number } {
  const rep = p.reputation[id] ?? 0;
  const deeds = rn(p).deeds[id] ?? 0;
  const merit = p.service && p.service.id === id ? p.service.merit : 0;
  const points = careerPoints(rep, deeds, merit);
  return { rep, deeds, merit, points, rank: careerRank(rep, points) };
}

const isCareer = (f: string): f is CareerId => (CAREER_IDS as string[]).includes(f);

/** The price of goods in a port of her flag, by her rank there now. */
export function careerBuyMul(p: Profile | undefined, faction: FactionId): number {
  if (!p || !isCareer(faction)) return 1;
  return 1 - CAREER_DISCOUNT[careerOf(p, faction).rank];
}

/** Her flag's yards build her one class above their own from rank 4. */
export function careerYardBonus(p: Profile | undefined, faction: FactionId): number {
  if (!p || !isCareer(faction)) return 0;
  return careerOf(p, faction).rank >= CAREER_YARD_RANK ? 1 : 0;
}

function addDeeds(p: Profile, id: CareerId, n: number): void {
  const r = rn(p);
  r.deeds[id] = (r.deeds[id] ?? 0) + n;
}

/** A new rank: its title (once), and its gifts. */
export function checkCareers(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const r = rn(p);
  for (const id of CAREER_IDS) {
    const { rank } = careerOf(p, id);
    const had = r.ranks[id] ?? 0;
    if (rank <= had) continue;
    for (let k = had + 1; k <= rank; k++) {
      const title = careerTitle(id, k);
      if (!p.titles.includes(title)) p.titles.push(title);
      toast(game, s, `A new rank: ${title} (${CAREERS[id].name[0]}).`);
      const rarity = CAREER_GIFTS[k];
      if (rarity && p.stash.length < 40) {
        const rng = new Rng((s.accountId * 2654435761 + k * 97 + id.length * 13) >>> 0);
        const it = makeItem(rng, p.itemSeq++, { ilvl: Math.max(1, s.ship?.shipLevel ?? p.loadout.level ?? 1), rarity });
        p.stash.push(it);
        toast(game, s, `${title}: the quartermaster sends you ${itemName(it)}.`, 'good');
      }
      if (k === CAREER_YARD_RANK) toast(game, s, `${title}: the yards of the flag build you a hull one class above their own.`, 'good');
      if (k === CAREER_PENNANT_RANK) {
        const flag = FACTIONS[id].flag;
        if (!p.pennants.includes(flag)) p.pennants.push(flag);
        toast(game, s, `${title}: your pennant is yours to fly.`, 'good');
      }
    }
    r.ranks[id] = rank;
  }
}

export function careerViews(p: Profile): CareerView[] {
  const r = rn(p);
  return CAREER_IDS.map((id) => {
    const c = careerOf(p, id);
    return {
      id, rank: c.rank, points: c.points, rep: Math.round(c.rep), deeds: Math.floor(c.deeds), merit: Math.floor(c.merit),
      next: c.rank < CAREER_POINTS.length ? { points: CAREER_POINTS[c.rank], rep: CAREER_REP[c.rank] } : null,
      discount: CAREER_DISCOUNT[c.rank], yard: c.rank >= CAREER_YARD_RANK,
      gifts: Object.keys(CAREER_GIFTS).map(Number).filter((k) => (r.ranks[id] ?? 0) >= k),
    };
  });
}

// ================================================================== 27. the week's challenges

interface WeekRow { name: string; v: number[] }
const dirty = new WeakMap<Game, { week: number; rows: Map<number, WeekRow> }>();

function currentWeek(game: Game): number {
  return weekNumber(game.wallNow());
}

function boardKey(week: number): string {
  return `weekly_board:${week}`;
}

function myRow(game: Game, s: PlayerSession): WeekRow {
  const week = currentWeek(game);
  let d = dirty.get(game);
  if (!d || d.week !== week) {
    if (d) flushWeek(game);
    dirty.set(game, (d = { week, rows: new Map() }));
  }
  let row = d.rows.get(s.accountId);
  if (!row) {
    const board = game.db.getKv<Record<string, WeekRow>>(boardKey(week)) ?? {};
    const was = board[s.accountId];
    row = { name: s.name, v: was ? [...was.v] : [0, 0, 0] };
    d.rows.set(s.accountId, row);
  }
  row.name = s.name;
  return row;
}

/** Counts toward the week's challenge of this kind, if it is set in this sea. */
export function weeklyAdd(game: Game, s: PlayerSession, kind: WeeklyKind, region: RegionId, n: number): void {
  if (!s.profile || !(n > 0)) return;
  const list = weeklyChallenges(currentWeek(game));
  const i = list.findIndex((c) => c.kind === kind && c.region === region);
  if (i < 0) return;
  const row = myRow(game, s);
  row.v[i] = WEEKLY[kind].best ? Math.max(row.v[i] ?? 0, n) : (row.v[i] ?? 0) + n;
}

function flushWeek(game: Game): void {
  const d = dirty.get(game);
  if (!d || !d.rows.size) return;
  const key = boardKey(d.week);
  const board = game.db.getKv<Record<string, WeekRow>>(key) ?? {};
  for (const [acct, row] of d.rows) {
    const was = board[acct]?.v ?? [0, 0, 0];
    // Another zone may have counted for her too: keep the larger of each.
    board[acct] = { name: row.name, v: row.v.map((x, i) => Math.max(x, was[i] ?? 0)) };
  }
  game.db.setKv(key, board);
  d.rows.clear();
}

function tops(board: Record<string, WeekRow>, i: number, n: number): { account: number; name: string; value: number }[] {
  return Object.entries(board)
    .map(([a, r]) => ({ account: Number(a), name: r.name, value: Math.round((r.v[i] ?? 0) * 10) / 10 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || a.account - b.account)
    .slice(0, n);
}

interface WeekHist { week: number; list: { kind: WeeklyKind; region: RegionId; top: { account: number; name: string; value: number }[] }[] }

/** The week is over: its tables into the book, the first three paid by letter. */
export function closeWeek(game: Game, week: number): void {
  const board = game.db.getKv<Record<string, WeekRow>>(boardKey(week)) ?? {};
  const list = weeklyChallenges(week).map((c, i) => ({ ...c, top: tops(board, i, WEEKLY_TOP) }));
  const hist = game.db.getKv<WeekHist[]>('weekly_hist') ?? [];
  if (hist.some((h) => h.week === week)) return;
  hist.push({ week, list });
  game.db.setKv('weekly_hist', hist.slice(-8));
  for (const c of list) {
    const what = WEEKLY[c.kind].text[0].replace('{r}', REGIONS[c.region].name);
    c.top.slice(0, WEEKLY_PRIZES.length).forEach((t, place) => {
      deliver(game, t.account, { from: 'The Harbour Masters', subject: `The week’s challenge: ${what} — place ${place + 1}.`, body: `You took place ${place + 1} in the week’s challenge “${what}”. The harbour masters send your prize.`, gold: WEEKLY_PRIZES[place], goods: null });
    });
  }
  const winners = list.filter((c) => c.top.length).map((c) => `${c.top[0].name}`);
  if (winners.length) chronicle(game, `The week’s challenges are closed: ${winners.join(', ')}.`);
  game.log(`[weekly] ${week} closed: ${Object.keys(board).length} captains`);
}

/** The first of a week's challenge: the title, once she is aboard. */
function applyWeekly(game: Game, s: PlayerSession): void {
  const r = rn(s.profile!);
  for (const h of game.db.getKv<WeekHist[]>('weekly_hist') ?? []) {
    h.list.forEach((c, i) => {
      if (c.top[0]?.account !== s.accountId) return;
      const key = `${h.week}:${i}`;
      if (r.won.includes(key)) return;
      r.won.push(key);
      earnTitle(game, s, WEEKLY_TITLE);
    });
  }
}

export function weeklyView(game: Game, s: PlayerSession): WeeklyView {
  const week = currentWeek(game);
  flushWeek(game);
  const board = game.db.getKv<Record<string, WeekRow>>(boardKey(week)) ?? {};
  const mine = board[s.accountId]?.v ?? [0, 0, 0];
  const challenges = weeklyChallenges(week).map((c, i) => {
    const all = tops(board, i, 10_000);
    const at = all.findIndex((x) => x.account === s.accountId);
    return { kind: c.kind, region: c.region, mine: Math.round((mine[i] ?? 0) * 10) / 10, place: at >= 0 ? at + 1 : null, top: all.slice(0, WEEKLY_TOP).map(({ name, value }) => ({ name, value })) };
  });
  const last = (game.db.getKv<WeekHist[]>('weekly_hist') ?? []).find((h) => h.week === week - 1);
  return {
    week, endsIn: Math.max(0, Math.round(((week + 1) * WEEK_MS - game.wallNow()) / 1000)), challenges,
    last: last ? last.list.map((c) => ({ kind: c.kind, region: c.region, top: c.top.slice(0, 3).map(({ name, value }) => ({ name, value })) })) : null,
    prizes: WEEKLY_PRIZES,
  };
}

// ================================================================== the deeds that count

/** A ship sunk or taken: the tallies of the feats, the flags' deeds, the week's pirates and prizes. */
export function renownKill(game: Game, s: PlayerSession, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
  const p = s.profile;
  if (!p) return;
  const r = rn(p);
  const bump = (k: string) => (r.kills[k] = (r.kills[k] ?? 0) + 1);
  const f = victim.faction;
  if (!victim.cls.monster || victim.npcRole === 'ghost') {
    if (f === 'crown' || f === 'league' || f === 'confederacy' || f === 'brokers') bump(f);
    if (victim.npcRole === 'pirate') bump('pirate');
    if (victim.npcRole === 'ghost') bump('ghost');
  }
  const deed = how === 'boarded' ? DEED_BOARDED : DEED_SUNK;
  if (victim.npcRole === 'pirate' || victim.npcRole === 'ghost' || f === 'confederacy' || f === 'brokers') addDeeds(p, 'crown', deed);
  if (victim.npcRole === 'pirate' || f === 'confederacy') addDeeds(p, 'league', DEED_RAIDER);
  if ((f === 'crown' || f === 'league') && !victim.cls.monster) addDeeds(p, 'confederacy', deed);
  if (victim.npcRole === 'pirate') weeklyAdd(game, s, 'pirates', victim.region, 1);
  if (how === 'boarded') weeklyAdd(game, s, 'prizes', victim.region, 1);
}

/** Silver changing hands in a port: the League's and the havens' deeds, the week's trade. */
export function renownTrade(game: Game, s: PlayerSession, port: Port, silver: number): void {
  const p = s.profile;
  if (!p || !(silver > 0)) return;
  if (port.faction === 'league' || port.faction === 'confederacy') addDeeds(p, port.faction, silver / TRADE_PER_POINT);
  weeklyAdd(game, s, 'trade', port.region, Math.round(silver));
}

/** A fish landed: the week's heaviest catch. */
export function renownCatch(game: Game, s: PlayerSession, kg: number): void {
  if (s.ship) weeklyAdd(game, s, 'catch', s.ship.region, Math.round(kg * 10) / 10);
}

/** Distance sailed, in km: the week's longest log. */
export function renownDistance(game: Game, s: PlayerSession, km: number): void {
  if (s.ship) weeklyAdd(game, s, 'distance', s.ship.region, km);
}

// ================================================================== 29. feats

export function featValue(p: Profile, stat: FeatStat): number {
  const k = rn(p).kills;
  switch (stat) {
    case 'league': return k.league ?? 0;
    case 'crown': return k.crown ?? 0;
    case 'pirates': return k.pirate ?? 0;
    case 'ghosts': return k.ghost ?? 0;
    case 'kraken': return p.bossKills.kraken ?? 0;
    case 'leviathan': return (p.bossKills.leviathan ?? 0) + (p.bossKills.ancient_leviathan ?? 0);
    case 'orca': return p.companion ? 1 : 0;
    case 'sunk': return p.stats.sunk;
    case 'boarded': return p.stats.boarded;
    case 'trade': return Math.floor(p.stats.tradeProfit);
    case 'distance': return Math.floor(p.stats.distance / 1000);
    case 'seas': return p.regionsSeen.length;
  }
}

export function checkFeats(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const r = rn(p);
  for (const f of FEATS) {
    if (r.feats.includes(f.id) || featValue(p, f.stat) < f.need) continue;
    r.feats.push(f.id);
    earnTitle(game, s, f.title[0]);
  }
}

// ================================================================== 28. the album

export function setHave(game: Game, p: Profile, id: SetId): string[] {
  switch (id) {
    case 'fish': return Object.entries(p.fishing?.caught ?? {}).filter(([, c]) => (c?.n ?? 0) > 0).map(([f]) => f);
    case 'wonders': {
      const byId = new Map(wondersOf(game).map((w) => [w.id, w.kind]));
      return [...new Set((p.wonders ?? []).map((w) => byId.get(w)).filter((k): k is NonNullable<typeof k> => !!k))];
    }
    case 'omens': return rn(p).omens;
    case 'trophies': return p.trophies;
    case 'beasts': return Object.entries(p.beasts ?? {}).filter(([, n]) => (n ?? 0) > 0).map(([b]) => b);
    case 'letters': return (p.seaLetters ?? []).map(String);
    case 'bestiary': return rn(p).met ?? [];
  }
}

export function setViews(game: Game, p: Profile): SetView[] {
  const defs = setDefs(SEA_LETTERS.length);
  const r = rn(p);
  return SET_IDS.map((id) => {
    const d = defs[id];
    const have = setHave(game, p, id).filter((x) => d.items.includes(x));
    return { id, have, items: d.items, done: r.sets.includes(id), silver: d.silver, title: d.title[0] };
  });
}

export function checkSets(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const r = rn(p);
  const defs = setDefs(SEA_LETTERS.length);
  for (const id of SET_IDS) {
    if (r.sets.includes(id)) continue;
    const d = defs[id];
    const have = new Set(setHave(game, p, id));
    if (!d.items.length || !d.items.every((x) => have.has(x))) continue;
    r.sets.push(id);
    p.gold += d.silver;
    game.db.ledger(s.accountId, 'album', d.silver, id);
    if (!p.titles.includes(d.title[0])) p.titles.push(d.title[0]);
    toast(game, s, `The album: ${d.name[0]} is complete! ${d.silver} silver and the title “${d.title[0]}”.`);
  }
}

/** docs/18 #46: a fight with creatures — the first with each kind writes its page of the bestiary. */
export function meetCreatures(game: Game, s: PlayerSession, units: readonly string[]): string[] {
  if (!s.profile) return [];
  const r = rn(s.profile);
  r.met ??= [];
  const fresh: string[] = [];
  for (const u of new Set(units)) {
    if (!isCreature(u) || r.met.includes(u)) continue;
    r.met.push(u);
    fresh.push(u);
  }
  for (const u of fresh) toast(game, s, `A new page of the bestiary: ${BEAST_PLURAL[u as CreatureId][0]}.`, 'info');
  if (fresh.length) sendRenown(game, s, true);
  return fresh;
}

/** At sea under the day's omen: into the album. */
function noteOmen(game: Game, s: PlayerSession): void {
  if (!s.ship || s.ship.docked) return;
  const id = todaysOmen(game);
  const r = rn(s.profile!);
  if (OMENS[id] && !r.omens.includes(id)) r.omens.push(id);
}

// ================================================================== the view, the step

export function renownView(game: Game, s: PlayerSession): RenownView {
  const p = s.profile!;
  return {
    careers: careerViews(p),
    feats: FEATS.map((f) => ({ id: f.id, value: Math.min(f.need, featValue(p, f.stat)), need: f.need, done: rn(p).feats.includes(f.id) })),
    sets: setViews(game, p),
    weekly: weeklyView(game, s),
    titles: p.titles,
    title: p.title,
  };
}

const sent = new WeakMap<PlayerSession, string>();
export function sendRenown(game: Game, s: PlayerSession, force = false): void {
  if (!s.profile) return;
  const v = renownView(game, s);
  const key = JSON.stringify(v).replace(/"endsIn":\d+/, '');
  if (!force && sent.get(s) === key) return;
  sent.set(s, key);
  game.sendTo(s, { t: 'renown', view: v });
}

const flushAt = new WeakMap<Game, number>();

/** Every five seconds: the omens sailed under, ranks, feats, sets; the tables written; the week turned by the lead. */
export function stepRenown(game: Game): void {
  for (const s of game.sessions) {
    if (!s.profile || s.disconnectedAt !== null) continue;
    noteOmen(game, s);
    checkCareers(game, s);
    checkFeats(game, s);
    checkSets(game, s);
    applyWeekly(game, s);
    sendRenown(game, s);
  }
  if ((flushAt.get(game) ?? 0) <= game.now) {
    flushAt.set(game, game.now + 30);
    flushWeek(game);
  }
  if (!game.zoneLead) return;
  const cur = currentWeek(game);
  const st = game.db.getKv<{ current: number }>('weekly_state');
  if (!st) return void game.db.setKv('weekly_state', { current: cur });
  if (st.current < cur) {
    flushWeek(game);
    for (let w = Math.max(st.current, cur - 4); w < cur; w++) closeWeek(game, w);
    game.db.setKv('weekly_state', { current: cur });
  }
}

// ================================================================== the world's chronicle

interface ChronicleLine { at: number; msg: string }

/** A line in the sea's book of great events (the bosses slain, the weeks closed), for those who were away. */
export function chronicle(game: Game, msg: string): void {
  const list = game.db.getKv<ChronicleLine[]>('world_chronicle') ?? [];
  const last = list[list.length - 1];
  if (last && last.msg === msg && game.wallNow() - last.at < 3_600_000) return; // same news twice is one line
  list.push({ at: game.wallNow(), msg });
  game.db.setKv('world_chronicle', list.slice(-40));
}

// ================================================================== 30. back after a break

function isleNow(game: Game, account: number): { name: string; goods: number; treasury: number } | null {
  const h = ownIsland(game, account);
  if (!h) return null;
  const goods = Object.values(h.store ?? {}).reduce((a, n) => a + (n ?? 0), 0);
  return { name: game.world.islands[h.island]?.name ?? '', goods: Math.floor(goods), treasury: Math.floor(h.treasury ?? 0) };
}

/** Going ashore: when, and how her island stood. */
export function awayMark(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p) return;
  const isle = isleNow(game, s.accountId);
  rn(p).away = { at: game.wallNow(), goods: isle?.goods ?? 0, treasury: isle?.treasury ?? 0 };
}

const ISLE_FROM = ['The island watch', 'Outposts'];
const AUCTION_FROM = ['The Auction House', 'Tidewrack Auction House'];

/** Back aboard: after twelve hours or more, what happened and a gift waiting. */
export function awayReturn(game: Game, s: PlayerSession): AwayView | null {
  const p = s.profile;
  if (!p) return null;
  const r = rn(p);
  const a = r.away;
  r.away = null;
  if (!a) return null;
  const hours = (game.wallNow() - a.at) / 3_600_000;
  if (hours < AWAY_MIN_H) return null;
  const letters = lettersSince(game, s.accountId, a.at);
  const isle = isleNow(game, s.accountId);
  const w = weeklyView(game, s);
  const hist = (game.db.getKv<WeekHist[]>('weekly_hist') ?? []).filter((h) => (h.week + 1) * WEEK_MS > a.at);
  const gift = awayGift(hours, p.level);
  r.gift = gift.silver > 0 ? gift : null;
  const view: AwayView = {
    hours: Math.round(hours),
    isle: isle ? { name: isle.name, goods: isle.goods - a.goods, treasury: isle.treasury - a.treasury, raids: letters.filter((l) => ISLE_FROM.includes(l.from)).map((l) => l.subject).slice(-4) } : null,
    auction: letters.filter((l) => AUCTION_FROM.includes(l.from)).map((l) => l.subject).slice(-4),
    letters: { n: letters.length, unread: letters.filter((l) => !l.read).length, from: [...new Set(letters.map((l) => l.from))].slice(0, 5) },
    world: (game.db.getKv<ChronicleLine[]>('world_chronicle') ?? []).filter((c) => c.at > a.at).map((c) => c.msg).filter((m, i, all) => all.indexOf(m) === i).slice(-6),
    weekly: w.challenges.map((c) => ({ kind: c.kind, region: c.region, place: c.place, value: c.mine, leader: c.top[0]?.name ?? null })),
    lastWeek: hist.flatMap((h) => h.list.filter((c) => c.top.length).map((c) => ({ kind: c.kind, region: c.region, winner: c.top[0].name }))).slice(-6),
    gift: r.gift ?? null,
  };
  toast(game, s, `Welcome back, captain: ${view.hours} h away. A gift waits for you.`, 'info');
  return view;
}

/** The welcome gift, taken. */
export function awayTake(game: Game, s: PlayerSession): string | null {
  const p = s.profile!;
  const r = rn(p);
  const g = r.gift;
  if (!g) return 'No gift waits for you.';
  r.gift = null;
  p.gold += g.silver;
  game.db.ledger(s.accountId, 'welcome_back', g.silver, '');
  if (g.speedups) grantSpeedups(p, g.speedups);
  if (g.provisions && s.ship) giveGoods(s.ship, 'provisions', g.provisions);
  toast(game, s, `The welcome gift: ${g.silver} silver.`, 'good');
  game.pushSelf(s, true);
  return null;
}
