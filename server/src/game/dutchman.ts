// The Flying Dutchman (docs/12 P10 #10) on the server: the week's five pages and his battle island (the same for a
// seed and a week), one page shown a day; pages taken by sailing to them (and shared with the group near); all five
// name his island; there he rises for the captain who has them; the first to sink him this week wins his figurehead
// and a title; after that, his echo pays silver.

import { unlockDeed } from './looks.ts';
import { BATTLE_R, DAY_MS, DUTCHMAN_TITLE, PAGES, PAGE_R, RIDDLES, SHARE_R, WEEK_MS } from '../../../shared/src/data/dutchman.ts';
import type { DutchmanView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { sagaNote } from './saga.ts';

interface Spot {
  x: number;
  y: number;
  island: number;
}

interface WeekPlan {
  week: number;
  pages: Spot[];
  battle: Spot;
  riddle: number;
}

interface DutchState {
  plan: WeekPlan | null;
  ship: number | null;
}

const states = new WeakMap<Game, DutchState>();
function ds(game: Game): DutchState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { plan: null, ship: null }));
  return s;
}

const SEAS: RegionId[] = ['black_coast', 'gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'dead_mans_expanse', 'drowned_crown'];

function spotNear(game: Game, rng: Rng, region: RegionId): Spot | null {
  const isl = game.world.islands.filter((is) => is.region === region && !is.portId && !is.hidden && !is.minor && is.radius > 120);
  for (let k = 0; k < 40 && isl.length; k++) {
    const is = isl[Math.floor(rng.float() * isl.length)];
    const a = rng.float() * Math.PI * 2, r = is.radius + 700;
    const x = is.x + Math.sin(a) * r, y = is.y - Math.cos(a) * r;
    if (!isLand(game.world, x, y)) return { x: Math.round(x), y: Math.round(y), island: is.id };
  }
  return null;
}

/** The week's plan: five pages in five seas, his island in a sixth. */
export function weekPlan(game: Game): WeekPlan {
  const S = ds(game);
  const week = Math.floor(game.wallNow() / WEEK_MS);
  if (S.plan?.week === week) return S.plan;
  const rng = new Rng((game.world.seed * 7919 + week * 104729) >>> 0);
  const seas = [...SEAS].sort(() => rng.float() - 0.5);
  const pages: Spot[] = [];
  for (const sea of seas) {
    if (pages.length >= PAGES) break;
    const sp = spotNear(game, rng, sea);
    if (sp) pages.push(sp);
  }
  const battle = spotNear(game, rng, seas[PAGES] ?? 'dead_mans_expanse') ?? pages[0];
  S.plan = { week, pages, battle, riddle: week % RIDDLES.length };
  S.ship = null;
  return S.plan;
}

/** How many of the week's pages the sea has shown so far (one a day). */
export function pagesShown(game: Game): number {
  const into = game.wallNow() - weekPlan(game).week * WEEK_MS;
  return Math.min(PAGES, 1 + Math.floor(into / DAY_MS));
}

function progress(game: Game, p: Profile): number[] {
  const w = weekPlan(game).week;
  if (!p.dutchman || p.dutchman.week !== w) p.dutchman = { week: w, pages: [] };
  return p.dutchman.pages;
}

function winnerOf(game: Game): string | null {
  const rec = game.db.getKv<{ week: number; winner: string }>('dutchman_won');
  return rec && rec.week === weekPlan(game).week ? rec.winner : null;
}

function takePage(game: Game, s: PlayerSession, i: number): void {
  const pages = progress(game, s.profile!);
  if (pages.includes(i)) return;
  pages.push(i);
  game.sendTo(s, { t: 'toast', msg: `A torn page of the Dutchman’s log (${pages.length} of 5).`, kind: 'gold' });
  if (pages.length >= PAGES) {
    const plan = weekPlan(game);
    game.sendTo(s, { t: 'toast', msg: `All five pages: the Dutchman waits off ${game.world.islands[plan.battle.island]?.name ?? '?'}. Go there, and he will come.`, kind: 'gold' });
  }
  sendDutchman(game, s, true);
}

/** Every five seconds: pages taken, a new page's sighting told, the Dutchman risen for her who has all five. */
export function stepDutchman(game: Game): void {
  const plan = weekPlan(game);
  const shown = pagesShown(game);
  const told = game.db.getKv<{ week: number; n: number }>('dutchman_told');
  if (!told || told.week !== plan.week || told.n < shown) {
    const pg = plan.pages[shown - 1];
    if (pg) for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `The Flying Dutchman was seen near ${game.world.islands[pg.island]?.name ?? '?'}: a green lantern burns on the water there.`, kind: 'info' });
    game.db.setKv('dutchman_told', { week: plan.week, n: shown });
  }
  for (const s of game.sessions) {
    const ship = s.ship, p = s.profile;
    if (p) sendDutchman(game, s); // her journal's page, in port or at sea
    if (!ship || !p || ship.docked || !ship.alive) continue;
    for (let i = 0; i < shown; i++) {
      const pg = plan.pages[i];
      if (!pg || Math.hypot(pg.x - ship.state.x, pg.y - ship.state.y) > PAGE_R) continue;
      takePage(game, s, i);
      // Her group near her takes it with her.
      const g = groupOfAccount(game, s.accountId);
      if (g) for (const acc of g.members) {
        const m = acc !== s.accountId ? game.sessionByAccount(acc) : undefined;
        if (m?.ship && m.profile && Math.hypot(m.ship.state.x - ship.state.x, m.ship.state.y - ship.state.y) < SHARE_R) takePage(game, m, i);
      }
    }
    // All five pages and at his island: he rises (one Dutchman at a time).
    const S = ds(game);
    const live = S.ship !== null && game.ships.get(S.ship)?.alive;
    if (!live && progress(game, p).length >= PAGES && Math.hypot(plan.battle.x - ship.state.x, plan.battle.y - ship.state.y) < BATTLE_R) rise(game, s, plan);
  }
}

function rise(game: Game, s: PlayerSession, plan: WeekPlan): void {
  const S = ds(game);
  const ship = s.ship!;
  const a = Math.atan2(ship.state.x - plan.battle.x, -(ship.state.y - plan.battle.y));
  const d = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', plan.battle.x, plan.battle.y, a, { ship: 'The Flying Dutchman', captain: 'Van der Decken' });
  game.setNpcLevel(d, 10);
  d.elite = true;
  d.dutchman = true;
  d.hull = d.stats.hullMax;
  d.crew = d.stats.crewMax;
  d.morale = 100;
  d.removeAt = game.now + 1800;
  const brain = game.npcs.get(d.id);
  if (brain) {
    brain.active = true;
    brain.target = ship.id;
  }
  game.grid.upsert(d.id, d.state.x, d.state.y);
  S.ship = d.id;
  for (const o of game.sessions) if (o.ship && Math.hypot(o.ship.state.x - d.state.x, o.ship.state.y - d.state.y) < 6000) game.sendTo(o, { t: 'toast', msg: 'The Flying Dutchman rises from the sea!', kind: 'bad' });
}

/** He goes down: the first this week wins his figurehead and the title; after that, silver from his echo. */
export function dutchmanSunk(game: Game, victim: ShipEntity, killer: ShipEntity | null): void {
  if (!victim.dutchman) return;
  ds(game).ship = null;
  const s = killer ? game.sessionOf(killer) : null;
  if (!s?.profile) return;
  const g = groupOfAccount(game, s.accountId);
  const crew = [s, ...(g ? g.members.filter((a) => a !== s.accountId).map((a) => game.sessionByAccount(a)).filter((m): m is PlayerSession => !!m?.ship && Math.hypot(m.ship.state.x - victim.state.x, m.ship.state.y - victim.state.y) < SHARE_R) : [])];
  const first = !winnerOf(game);
  if (first) {
    game.db.setKv('dutchman_won', { week: weekPlan(game).week, winner: s.name });
    for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} sent the Flying Dutchman to his rest — until next week.`, kind: 'gold' });
  }
  for (const m of crew) {
    const p = m.profile!;
    if (first) {
      if (!p.figureheads.includes('fh_dutchman')) p.figureheads.push('fh_dutchman');
      unlockDeed(game, m, 'dutchman');
      if (!p.titles.includes(DUTCHMAN_TITLE)) p.titles.push(DUTCHMAN_TITLE);
      sagaNote(game, m, 'dutchman');
      game.sendTo(m, { t: 'toast', msg: 'The Dutchman’s figurehead is yours.', kind: 'gold' });
      game.grantXp(m, 5000, 'The Flying Dutchman', true);
    } else {
      p.gold += 3000;
      game.db.ledger(m.accountId, 'dutchman_echo', 3000, '');
      game.sendTo(m, { t: 'toast', msg: 'The Dutchman has gone down this week already; his echo pays you in silver.', kind: 'gold' });
      game.grantXp(m, 1500, 'The Dutchman’s echo', true);
    }
    game.pushSelf(m, true);
  }
}

export function dutchmanView(game: Game, s: PlayerSession): DutchmanView {
  const plan = weekPlan(game);
  const shown = pagesShown(game);
  const mine = progress(game, s.profile!);
  const isle = game.world.islands[plan.battle.island]?.name ?? '?';
  const riddle = RIDDLES[plan.riddle];
  return {
    week: plan.week,
    pages: plan.pages.slice(0, shown).map((pg, i) => ({ i, x: pg.x, y: pg.y, island: game.world.islands[pg.island]?.name ?? '?', taken: mine.includes(i), text: mine.includes(i) ? riddle[i][0].replace('{isle}', isle) : null })),
    battle: mine.length >= PAGES ? { x: plan.battle.x, y: plan.battle.y, island: isle } : null,
    winner: winnerOf(game),
    nextIn: shown < PAGES ? Math.ceil(((plan.week * WEEK_MS + shown * DAY_MS) - game.wallNow()) / 1000) : null,
  };
}

const sent = new WeakMap<PlayerSession, string>();
export function sendDutchman(game: Game, s: PlayerSession, force = false): void {
  if (!s.profile) return;
  const v = dutchmanView(game, s);
  const key = JSON.stringify({ ...v, nextIn: null });
  if (!force && sent.get(s) === key) return;
  sent.set(s, key);
  game.sendTo(s, { t: 'dutchman', view: v });
}
