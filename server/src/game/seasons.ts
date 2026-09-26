// Seasons, the Legends of the Ocean and the Pantheon (docs/02 §14.A.6–7). Three months each on the wall clock;
// a theme that changes the world; a free season path (titles and pennant colours only); season tables kept as
// captains play; at the season's end the top three of each hall enter the Pantheon forever, with a title and the
// right to name an island. Bards in the taverns sing of the season's legends.

import { HALLS, SEASON_DAYS, SEASON_EPOCH, SEASON_XP_SHARE, STAT_NAMES, THEMES, THEME_ORDER, TRACK_LEVELS, TRACK_XP, trackReward } from '../../../shared/src/data/seasons.ts';
import type { HallId, SeasonStat, SeasonTheme } from '../../../shared/src/data/seasons.ts';
import type { SeasonView } from '../../../shared/src/protocol.ts';
import { islandChunkKeys } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

const DAY = 24 * 3600_000;
const SEASON_MS = SEASON_DAYS * DAY;

interface BoardRow {
  name: string;
  stats: Partial<Record<SeasonStat, number>>;
}

export interface PantheonMember {
  account: number;
  name: string;
  hall: HallId;
  season: number;
  value: number;
}

interface SeasonHistory {
  season: number;
  theme: SeasonTheme;
  tables: Partial<Record<SeasonStat, { name: string; value: number }[]>>;
  war?: { winner: 'crown' | 'confederacy' | 'none'; crown: number; confederacy: number };
}

export function seasonId(game: Game): number {
  return Math.max(0, Math.floor((game.wallNow() - SEASON_EPOCH) / SEASON_MS));
}

export function themeOf(season: number): SeasonTheme {
  return THEME_ORDER[season % THEME_ORDER.length];
}

export function seasonTheme(game: Game): SeasonTheme {
  return themeOf(seasonId(game));
}

/** What the season's theme does to the world (read by weather, the director and the boss calendar). */
export function seasonMods(game: Game): { stormMul: number; ghostMul: number; ghostsEverywhere: boolean; pirateMul: number; migration: boolean } {
  const theme = seasonTheme(game);
  const war = game.db.getKv<{ winner: string; season: number }>('war_outcome');
  const pirateMul = war && war.season === seasonId(game) ? (war.winner === 'crown' ? 0.7 : war.winner === 'confederacy' ? 1.4 : 1) : 1;
  return { stormMul: theme === 'storm' ? 2.5 : 1, ghostMul: theme === 'dead_tide' ? 4 : 1, ghostsEverywhere: theme === 'dead_tide', pirateMul, migration: theme === 'migration' };
}

/** A captain's season record, reset when a new season begins. */
export function seasonOf(game: Game, p: Profile): Profile['season'] {
  const id = seasonId(game);
  if (!p.season || p.season.id !== id) p.season = { id, xp: 0, level: 0, stats: {} };
  return p.season;
}

const dirty = new WeakMap<Game, Map<number, BoardRow>>();

/** Count toward the season tables. */
export function seasonStat(game: Game, s: PlayerSession | null, stat: SeasonStat, n: number): void {
  if (!s?.profile || !(n > 0)) return;
  const se = seasonOf(game, s.profile);
  se.stats[stat] = (se.stats[stat] ?? 0) + n;
  let d = dirty.get(game);
  if (!d) dirty.set(game, (d = new Map()));
  d.set(s.accountId, { name: s.name, stats: se.stats });
}

/** A tenth of all experience also walks the season path. */
export function seasonXp(game: Game, s: PlayerSession, xp: number): void {
  const p = s.profile!;
  const se = seasonOf(game, p);
  se.xp += xp * SEASON_XP_SHARE;
  while (se.level < TRACK_LEVELS && se.xp >= (se.level + 1) * TRACK_XP) {
    se.level++;
    const r = trackReward(se.level, themeOf(se.id));
    if (!r) continue;
    if (r.title && !p.titles.includes(r.title)) p.titles.push(r.title);
    if (r.pennant && !p.pennants.includes(r.pennant)) p.pennants.push(r.pennant);
    game.sendTo(s, { t: 'toast', msg: `Season path ${se.level}: ${r.title ? `the title "${r.title}"` : ''}${r.title && r.pennant ? ' and ' : ''}${r.pennant ? 'a new pennant colour' : ''}. (Legends tab)`, kind: 'gold' });
  }
}

/** The Crown and the Confederacy keep score in the season of war. */
export function warKill(game: Game, victim: ShipEntity): void {
  if (seasonTheme(game) !== 'war') return;
  const side = victim.faction === 'confederacy' ? 'crown' : victim.faction === 'crown' ? 'confederacy' : null;
  if (!side) return;
  const key = `season_war:${seasonId(game)}`;
  const w = game.db.getKv<{ crown: number; confederacy: number }>(key) ?? { crown: 0, confederacy: 0 };
  w[side]++;
  game.db.setKv(key, w);
}

// ================================================================== the calendar

const flushAt = new WeakMap<Game, number>();

export function stepSeasons(game: Game): void {
  const now = game.now;
  if ((flushAt.get(game) ?? 0) <= now) {
    flushAt.set(game, now + 60);
    flushBoard(game);
  }
  if (!game.zoneLead) return;
  const cur = seasonId(game);
  const st = game.db.getKv<{ current: number }>('season_state');
  if (!st) return void game.db.setKv('season_state', { current: cur });
  if (st.current < cur) {
    flushBoard(game);
    for (let id = st.current; id < cur; id++) closeSeason(game, id);
    game.db.setKv('season_state', { current: cur });
    const th = THEMES[seasonTheme(game)];
    for (const s of game.sessions) {
      game.sendTo(s, { t: 'toast', msg: `A NEW SEASON: ${th.name}. ${th.text}`, kind: 'gold' });
      applyPantheon(game, s);
    }
  }
}

function flushBoard(game: Game): void {
  const d = dirty.get(game);
  if (!d || !d.size) return;
  const key = `season_board:${seasonId(game)}`;
  const board = game.db.getKv<Record<string, BoardRow>>(key) ?? {};
  for (const [acct, row] of d) board[acct] = { name: row.name, stats: { ...row.stats } };
  d.clear();
  game.db.setKv(key, board);
}

function tops(board: Record<string, BoardRow>, stat: SeasonStat, n: number): { account: number; name: string; value: number }[] {
  return Object.entries(board)
    .map(([a, r]) => ({ account: Number(a), name: r.name, value: Math.round(r.stats[stat] ?? 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** The season is over: its tables go into the book, the three of each hall into the Pantheon. */
export function closeSeason(game: Game, id: number): void {
  const board = game.db.getKv<Record<string, BoardRow>>(`season_board:${id}`) ?? {};
  const tables: SeasonHistory['tables'] = {};
  for (const stat of Object.keys(STAT_NAMES) as SeasonStat[]) tables[stat] = tops(board, stat, 10).map(({ name, value }) => ({ name, value }));
  const hist: SeasonHistory = { season: id, theme: themeOf(id), tables };
  if (themeOf(id) === 'war') {
    const w = game.db.getKv<{ crown: number; confederacy: number }>(`season_war:${id}`) ?? { crown: 0, confederacy: 0 };
    const winner = w.crown > w.confederacy ? 'crown' : w.confederacy > w.crown ? 'confederacy' : 'none';
    hist.war = { winner, ...w };
    game.db.setKv('war_outcome', { winner, season: id + 1 });
  }
  const history = game.db.getKv<SeasonHistory[]>('season_history') ?? [];
  history.push(hist);
  game.db.setKv('season_history', history.slice(-40));
  const pantheon = game.db.getKv<PantheonMember[]>('pantheon') ?? [];
  for (const [hall, def] of Object.entries(HALLS) as [HallId, (typeof HALLS)[HallId]][]) {
    for (const t of tops(board, def.stat, 3)) {
      if (pantheon.some((m) => m.account === t.account && m.hall === hall && m.season === id)) continue;
      pantheon.push({ account: t.account, name: t.name, hall, season: id, value: t.value });
    }
  }
  game.db.setKv('pantheon', pantheon);
  game.log(`[season] ${id} closed: ${Object.keys(board).length} captains on the tables`);
}

/** Entering the Pantheon: a title for ever, and the right to name an island. */
export function applyPantheon(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p) return;
  for (const m of game.db.getKv<PantheonMember[]>('pantheon') ?? []) {
    if (m.account !== s.accountId) continue;
    const key = `${m.hall}:${m.season}`;
    if (p.pantheon.includes(key)) continue;
    p.pantheon.push(key);
    const title = `${s.name.split(' ')[0]} ${HALLS[m.hall].title}`;
    if (!p.titles.includes(title)) p.titles.push(title);
    p.title = title;
    p.nameRights++;
    game.sendTo(s, { t: 'toast', msg: `You enter the Pantheon: ${HALLS[m.hall].name}. A statue, a title, and the right to name an island of the sea.`, kind: 'gold' });
  }
}

// ================================================================== names, titles, pennants

const NAME_RE = /^[A-Za-z][A-Za-z' -]{2,23}$/;

export function seasonAction(game: Game, s: PlayerSession, action: string, value?: string, islandId?: number): string | null {
  const p = s.profile!;
  switch (action) {
    case 'title':
      if (value && !p.titles.includes(value)) return 'You have not earned that title';
      p.title = value || null;
      refreshBadge(game, s);
      return null;
    case 'pennant':
      if (value && !p.pennants.includes(value)) return 'You have not earned that pennant';
      p.pennant = value || null;
      refreshBadge(game, s);
      return null;
    case 'name': {
      if (p.nameRights <= 0) return 'Only a captain of the Pantheon may name the sea';
      const is = islandId !== undefined ? game.world.islands[islandId] : undefined;
      if (!is) return 'No such island';
      if (!s.discovered.has(is.id)) return 'You must have charted her yourself';
      if (is.portId) return 'Ports keep their names';
      const names = game.db.getKv<Record<string, string>>('island_names') ?? {};
      if (names[is.id]) return `She is already named ${names[is.id]}`;
      const name = String(value ?? '').trim().replace(/\s+/g, ' ');
      if (!NAME_RE.test(name)) return 'Three to twenty-four letters, spaces or apostrophes';
      if (game.world.islands.some((i) => i.name.toLowerCase() === name.toLowerCase())) return 'The sea already has an island of that name';
      names[is.id] = name;
      game.db.setKv('island_names', names);
      const old = is.name;
      is.name = name;
      p.nameRights--;
      for (const o of game.sessions) {
        for (const k of islandChunkKeys(is)) o.knownChunks.delete(k);
        game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} of the Pantheon renames ${old} — she is ${name} now.`, kind: 'info' });
      }
      game.addRumor(is.x, is.y, `${old} is called ${name} now, by the word of ${s.name}.`);
      return null;
    }
  }
  return 'Unknown order';
}

/** Names the Pantheon gave the sea, laid over the world at boot (and when another zone writes one). */
export function applyIslandNames(game: Game): void {
  for (const [id, name] of Object.entries(game.db.getKv<Record<string, string>>('island_names') ?? {})) {
    const is = game.world.islands[Number(id)];
    if (is) is.name = name;
  }
}

function refreshBadge(game: Game, s: PlayerSession): void {
  if (!s.ship) return;
  s.ship.title = s.profile!.title;
  s.ship.pennant = s.profile!.pennant;
  game.refreshInfo(s.ship);
}

// ================================================================== the bard, the view

/** The bard's shanty: last season's legends by name, or this season's leaders if the book is empty. */
export function shanty(game: Game): string | null {
  const hist = (game.db.getKv<SeasonHistory[]>('season_history') ?? []).at(-1);
  const t = hist?.tables ?? {};
  const pick = (stat: SeasonStat) => t[stat]?.[0]?.name;
  const lines: string[] = [];
  if (pick('sunk')) lines.push(`Oh, ${pick('sunk')} sent them down, a-hundred ships and more`);
  if (pick('monsters')) lines.push(`and ${pick('monsters')} took the beast that none had took before`);
  if (pick('trade')) lines.push(`while ${pick('trade')} bought the harbour and sold it back for gold`);
  if (pick('abyss')) lines.push(`and ${pick('abyss')} sailed the Abyss where the stars are wrong and cold`);
  if (!lines.length) return null;
  return `♪ ${lines.join(', ')} — heave away, me lads, heave away! ♪`;
}

export function seasonView(game: Game, s: PlayerSession): SeasonView {
  const p = s.profile!;
  const se = seasonOf(game, p);
  const id = seasonId(game);
  const theme = themeOf(id);
  flushBoard(game);
  const board = game.db.getKv<Record<string, BoardRow>>(`season_board:${id}`) ?? {};
  const tables = (Object.keys(STAT_NAMES) as SeasonStat[]).map((stat) => ({ stat: STAT_NAMES[stat], rows: tops(board, stat, 5).map(({ name, value }) => ({ name, value })) }));
  const pantheon = game.db.getKv<PantheonMember[]>('pantheon') ?? [];
  const halls = (Object.keys(HALLS) as HallId[]).map((h) => ({ hall: HALLS[h].name, members: pantheon.filter((m) => m.hall === h).map((m) => ({ name: m.name, season: m.season + 1 })) }));
  let next: { level: number; reward: string } | null = null;
  for (let l = se.level + 1; l <= TRACK_LEVELS; l++) {
    const r = trackReward(l, theme);
    if (r) {
      next = { level: l, reward: r.title ? `the title "${r.title}"` : 'a pennant colour' };
      break;
    }
  }
  const war = theme === 'war' ? game.db.getKv<{ crown: number; confederacy: number }>(`season_war:${id}`) ?? { crown: 0, confederacy: 0 } : undefined;
  return {
    season: id + 1, theme: THEMES[theme].name, themeText: THEMES[theme].text, endsIn: Math.max(0, Math.round((SEASON_EPOCH + (id + 1) * SEASON_MS - game.wallNow()) / 1000)),
    level: se.level, xp: Math.floor(se.xp), levelXp: TRACK_XP, maxLevel: TRACK_LEVELS, next, mine: Object.entries(se.stats).map(([k, v]) => ({ stat: STAT_NAMES[k as SeasonStat], value: Math.round(v ?? 0) })),
    tables, halls, war, titles: p.titles, title: p.title, pennants: p.pennants, pennant: p.pennant, nameRights: p.nameRights,
  };
}
