// Onboarding (docs/07 §13): the First Watch — seven steps through The Black Coast that teach by doing, the HUD
// revealed a block at a time, a ship that cannot be lost in chapter one (the Crown tows her home), contextual
// hints that come back on mistakes, the Captain's Goals afterwards, and the funnel metrics of §13.3.
// Every text lives on the client under the ids sent from here, so the words can be localized.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import type { HudBlock, OnboardingView } from '../../../shared/src/protocol.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import { midPrice } from './economy.ts';
import type { Game } from './Game.ts';
import { addXp } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

export interface Tutorial {
  on: boolean; // walking the First Watch
  stage: number; // index into STAGES; STAGES.length = done
  at: number; // wall time the stage began
  skipped: boolean; // "I know the sea", or skipped part-way
  base: number; // the stage's starting mark (sales so far, and the like)
  hits: number; // broadsides that found a hull (the first fight)
  hints: Record<string, number>; // hint → times shown
  hintAt: Record<string, number>; // hint → wall time last shown
  tip: { good: GoodId; port: string; hours: number } | null;
  edgeSeen: boolean;
  goals: { active: string[]; done: string[]; base: Record<string, number>; hidden: boolean };
}

export function newTutorial(on: boolean, now: number): Tutorial {
  return { on, stage: on ? 0 : STAGES.length, at: now, skipped: !on, base: 0, hits: 0, hints: {}, hintAt: {}, tip: null, edgeSeen: false, goals: { active: [], done: [], base: {}, hidden: false } };
}

/** An old profile, made before the First Watch: an old hand, all the HUD, goals only if still young. */
export function sanitizeTutorial(p: Profile): void {
  if (!p.tutorial) p.tutorial = { ...newTutorial(false, 0), skipped: false };
  const t = p.tutorial;
  t.hints ??= {};
  t.hits ??= 0;
  t.hintAt ??= {};
  t.goals ??= { active: [], done: [], base: {}, hidden: false };
  t.goals.base ??= {};
}

// ------------------------------------------------------------------ the First Watch

interface Stage {
  id: string;
  /** HUD blocks this step brings in. */
  reveal: HudBlock[];
  done(game: Game, s: PlayerSession, ship: ShipEntity, p: Profile): boolean;
  /** The step's starting mark. */
  mark?(p: Profile): number;
  begin?(game: Game, s: PlayerSession, ship: ShipEntity): void;
}

const START_BLOCKS: HudBlock[] = ['ship', 'nav'];
export const ALL_BLOCKS: HudBlock[] = ['ship', 'nav', 'cargo', 'feed', 'target', 'guns', 'abilities', 'map', 'talents', 'wanted', 'captain', 'minimap'];

export const STAGES: Stage[] = [
  {
    // Rudder, sail levels, the wind relative to the ship.
    id: 'cast_off',
    reveal: [],
    done: (_g, _s, ship) => !ship.docked && ship.state.speed > 2.5 && ship.state.sail > 0.2,
  },
  {
    // The market, a note from the tavern with an aged price.
    id: 'first_trade',
    reveal: ['cargo', 'captain'],
    mark: (p) => p.stats.sold,
    done: (_g, _s, _ship, p) => p.stats.sold > p.tutorial.base,
    begin: (game, s) => {
      s.profile!.tutorial.tip = tradeTip(game, s);
    },
  },
  {
    // Lantern halos in the fog: a League convoy's paired amber, a lone red raider.
    id: 'lights',
    reveal: ['feed', 'target', 'minimap'],
    done: (game, _s, ship) => {
      let seen = false;
      game.forShipsNear(ship.state.x, ship.state.y, 700, (o) => {
        if (o !== ship && !o.isPlayer && !o.cls.monster && !o.bossOf && (o.faction === 'league' || o.faction === 'confederacy' || o.faction === 'crown')) seen = true;
      });
      return seen && !ship.docked;
    },
  },
  {
    // Broadside, reload arcs, lead, ammunition — against a raider under the eye of a Crown patrol.
    id: 'first_fight',
    reveal: ['guns', 'abilities'],
    mark: (p) => p.tutorial.hits,
    done: (_g, _s, _ship, p) => p.tutorial.hits > p.tutorial.base,
    begin: (game, _s, ship) => practiceRaider(game, ship),
  },
  {
    // The capital: the yard, the licence exchange, the first talents, the contract board.
    id: 'gravesend',
    reveal: ['map', 'talents'],
    done: (_g, _s, ship) => ship.docked === 'gravesend',
  },
  {
    // A hidden cove at night: plankton light, a wreck in the coral, a whisper. No fight, no explanation.
    id: 'strange',
    reveal: [],
    done: (game, s, ship) => {
      if (ship.docked || ship.region !== 'black_coast' || ship.state.speed > 1.5 || !isNight(game.now)) return false;
      if (coastDistance(game, ship) > 350) return false;
      game.sendTo(s, { t: 'ev', list: [{ k: 'fx', fx: 'plankton', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 220 }] });
      return true;
    },
  },
  {
    // The edge of safe waters: the Gravewater line.
    id: 'edge',
    reveal: ['wanted'],
    done: (_g, _s, ship) => REGIONS[ship.region].safety !== 'safe',
  },
];

function coastDistance(game: Game, ship: ShipEntity): number {
  let best = Infinity;
  for (const id of islandsNear(game.world, ship.state.x, ship.state.y)) {
    const is = game.world.islands[id];
    best = Math.min(best, Math.sqrt(closestOnPolygon(ship.state.x, ship.state.y, is.poly).d2));
  }
  return best;
}

/** The tavern note: the dearest safe-water port for something in the hold (or the port's cheapest staple). */
export function tradeTip(game: Game, s: PlayerSession): Tutorial['tip'] {
  const ship = s.ship!;
  const here = game.portById(s.profile!.lastPort);
  const goods = Object.keys(ship.cargo).filter((g) => (ship.cargo[g as GoodId] ?? 0) > 0) as GoodId[];
  let best: Tutorial['tip'] = null, bestP = 0;
  for (const port of game.world.ports) {
    if (port.id === here?.id || REGIONS[port.region].safety !== 'safe') continue;
    const m = game.markets.get(port.id);
    if (!m) continue;
    for (const g of goods) {
      const gm = m.goods[g];
      if (!gm || GOODS[g].contraband) continue;
      const p = midPrice(g, gm) / GOODS[g].basePrice;
      if (p > bestP) {
        bestP = p;
        best = { good: g, port: port.id, hours: 1 + (s.accountId % 4) };
      }
    }
  }
  return best;
}

/** A lone Confederacy sloop that comes for the novice in safe water — where the Crown's patrols are near. */
function practiceRaider(game: Game, ship: ShipEntity): void {
  const wind = game.windFor(ship);
  for (const off of [0, 0.8, -0.8, 1.6, -1.6]) {
    const a = wind.dir + Math.PI + off;
    const x = ship.state.x + Math.sin(a) * 900, y = ship.state.y - Math.cos(a) * 900;
    if (coastLand(game, x, y)) continue;
    const r = game.spawnNpcShip('pirate', 'sloop', 'confederacy', x, y, a + Math.PI, { ship: 'Red Novice', captain: 'Jory Slack' });
    r.purse = 120;
    r.cargo = { rum: 4 };
    const brain = game.npcs.get(r.id)!;
    brain.area = { x: ship.state.x, y: ship.state.y, r: 3000 };
    brain.chase = { id: ship.id, until: game.now + 300 };
    brain.target = ship.id;
    return;
  }
}

function coastLand(game: Game, x: number, y: number): boolean {
  for (const id of islandsNear(game.world, x, y)) {
    const is = game.world.islands[id];
    if (Math.sqrt(closestOnPolygon(x, y, is.poly).d2) < 200) return true;
  }
  return false;
}

// ------------------------------------------------------------------ the Captain's Goals (§13.4)

interface GoalDef {
  id: string;
  metric(p: Profile): number;
}

const G = (id: string, metric: (p: Profile) => number): GoalDef => ({ id, metric });
const talentsSpent = (p: Profile) => Object.values(p.talents).reduce((a, b) => a + (b ?? 0), 0);

export const GOALS: Record<string, GoalDef> = Object.fromEntries(
  [
    G('g_fog_run', (p) => p.stats.fogContraband),
    G('g_first_board', (p) => p.stats.boarded),
    G('g_first_island', (p) => p.discovered.length),
    G('g_duel', (p) => p.pvp.duelWins),
    G('g_first_dive', (p) => Object.keys(p.explore.dived).length),
    G('g_first_prize', (p) => p.stats.boarded + p.stats.sunk),
    G('g_talent', talentsSpent),
    G('g_contract', (p) => p.contracts.length + (p.stats.harpoonContracts ?? 0)),
    G('g_module', (p) => Object.keys(p.loadout.modules).length),
    G('g_insure', (p) => (p.policy ? 1 : 0)),
    G('g_sink', (p) => p.stats.sunk),
    G('g_level5', (p) => (p.level >= 5 ? 1 : 0)),
    G('g_profit', (p) => (p.stats.tradeProfit >= 1000 ? 1 : 0)),
  ].map((g) => [g.id, g]),
);

/** Each captain's list, their calling first. */
export const GOAL_ORDER: Record<CaptainId, string[]> = {
  smuggler: ['g_fog_run', 'g_talent', 'g_contract', 'g_profit', 'g_module', 'g_insure', 'g_level5'],
  reaver: ['g_first_board', 'g_talent', 'g_sink', 'g_module', 'g_contract', 'g_insure', 'g_level5'],
  navigator: ['g_first_island', 'g_talent', 'g_contract', 'g_profit', 'g_module', 'g_insure', 'g_level5'],
  corsair: ['g_duel', 'g_talent', 'g_sink', 'g_module', 'g_contract', 'g_insure', 'g_level5'],
  drowned: ['g_first_dive', 'g_talent', 'g_sink', 'g_contract', 'g_module', 'g_insure', 'g_level5'],
  admiral: ['g_first_prize', 'g_talent', 'g_contract', 'g_module', 'g_sink', 'g_insure', 'g_level5'],
};

function fillGoals(p: Profile): void {
  const g = p.tutorial.goals;
  const order = GOAL_ORDER[p.captain] ?? GOAL_ORDER.corsair;
  for (const id of order) {
    if (g.active.length >= 3) break;
    if (g.active.includes(id) || g.done.includes(id)) continue;
    g.active.push(id);
    // Measured from now: what was done before does not count — except the flags (level, a policy, profit).
    g.base[id] = /^g_(level5|insure|profit)$/.test(id) ? 0 : GOALS[id].metric(p);
  }
}

function stepGoals(game: Game, s: PlayerSession, p: Profile): boolean {
  const g = p.tutorial.goals;
  if (g.hidden) return false;
  if (!g.active.length && !g.done.length) fillGoals(p);
  let changed = false;
  for (const id of [...g.active]) {
    const def = GOALS[id];
    if (!def || def.metric(p) <= (g.base[id] ?? 0)) continue;
    g.active = g.active.filter((x) => x !== id);
    g.done.push(id);
    const lv = addXp(p, 120);
    s.ship && (s.ship.level = p.level);
    game.sendTo(s, { t: 'onb', kind: 'goal', id });
    if (lv) game.sendTo(s, { t: 'toast', msg: `Level ${p.level}!`, kind: 'xp' });
    changed = true;
  }
  if (changed) fillGoals(p);
  return changed;
}

// ------------------------------------------------------------------ the step, once a second

/** Seconds in irons, missed volleys in a row, seconds of neglected damage — per session, never saved. */
const watch = new WeakMap<PlayerSession, { irons: number; misses: number; hurt: number; view: string }>();

export function onboardingSecond(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  const t = p.tutorial;
  let changed = false;
  if (t.on && t.stage < STAGES.length) {
    const st = STAGES[t.stage];
    if (st.done(game, s, ship, p)) {
      advance(game, s, 'done');
      changed = true;
    }
  } else if (!t.on || t.stage >= STAGES.length) changed = stepGoals(game, s, p) || changed;
  // The edge of safe waters: once, for every captain.
  if (!t.edgeSeen && REGIONS[ship.region].safety !== 'safe' && !ship.docked) {
    t.edgeSeen = true;
    game.sendTo(s, { t: 'onb', kind: 'edge', id: ship.region });
  }
  contextHints(game, s, ship, p);
  const view = JSON.stringify(onboardingView(p));
  const w = watchOf(s);
  if (changed || view !== w.view) {
    w.view = view;
    game.sendTo(s, { t: 'onboarding', view: onboardingView(p) });
  }
}

function watchOf(s: PlayerSession) {
  let w = watch.get(s);
  if (!w) watch.set(s, (w = { irons: 0, misses: 0, hurt: 0, view: '' }));
  return w;
}

function advance(game: Game, s: PlayerSession, how: 'done' | 'skip'): void {
  const p = s.profile!, ship = s.ship!;
  const t = p.tutorial;
  const secs = Math.max(0, (game.wallNow() - t.at) / 1000);
  const m = metrics(game);
  m.stageSecs[t.stage] = (m.stageSecs[t.stage] ?? 0) + secs;
  m.stageDone[t.stage] = (m.stageDone[t.stage] ?? 0) + 1;
  if (how === 'skip') m.stageSkipped[t.stage] = (m.stageSkipped[t.stage] ?? 0) + 1;
  if (how === 'done') {
    const lv = addXp(p, 40 + t.stage * 15);
    ship.level = p.level;
    p.gold += 50;
    game.db.ledger(s.accountId, 'tutorial', 50, STAGES[t.stage].id);
    if (lv) game.sendTo(s, { t: 'toast', msg: `Level ${p.level}!`, kind: 'xp' });
  }
  game.sendTo(s, { t: 'onb', kind: how === 'done' ? 'stage' : 'skip', id: STAGES[t.stage].id });
  t.stage++;
  t.at = game.wallNow();
  if (t.stage >= STAGES.length) {
    t.on = false;
    m.finished++;
    fillGoals(p);
  } else {
    t.base = STAGES[t.stage].mark?.(p) ?? 0;
    STAGES[t.stage].begin?.(game, s, ship);
  }
  saveMetrics(game, m);
}

/** A client's choice: skip a step, skip the whole watch, hide or show the goals. */
export function onboardingAction(game: Game, s: PlayerSession, action: 'skip_stage' | 'skip_all' | 'hide_goals'): void {
  const p = s.profile;
  if (!p || !s.ship) return;
  const t = p.tutorial;
  if (action === 'skip_stage' && t.on && t.stage < STAGES.length) advance(game, s, 'skip');
  else if (action === 'skip_all' && t.on) {
    while (t.on && t.stage < STAGES.length) advance(game, s, 'skip');
    t.skipped = true;
    const m = metrics(game);
    m.skippedMidway++;
    const c = m.cohort[s.accountId];
    if (c) c.skipped = true;
    saveMetrics(game, m);
  } else if (action === 'hide_goals') t.goals.hidden = true;
  game.sendTo(s, { t: 'onboarding', view: onboardingView(p) });
}

export function onboardingView(p: Profile): OnboardingView {
  const t = p.tutorial;
  const on = t.on && t.stage < STAGES.length;
  const blocks = new Set<HudBlock>(START_BLOCKS);
  if (on) for (let i = 0; i <= t.stage; i++) for (const b of STAGES[i].reveal) blocks.add(b);
  return {
    stage: on ? STAGES[t.stage].id : null,
    index: Math.min(t.stage, STAGES.length),
    of: STAGES.length,
    hud: on ? [...blocks] : null,
    tip: on && STAGES[t.stage].id === 'first_trade' && t.tip ? { good: GOODS[t.tip.good].name, port: t.tip.port, hours: t.tip.hours } : null,
    goals: !on && !t.goals.hidden ? t.goals.active : null,
    goalsDone: t.goals.done.length,
    hints: Object.keys(t.hints),
  };
}

// ------------------------------------------------------------------ contextual hints (§13.1)

/** The hints and how often at most (seconds). */
export const HINTS: Record<string, number> = { irons: 240, lead: 180, repair: 300, docking: 600 };

function hint(game: Game, s: PlayerSession, id: string): void {
  const t = s.profile!.tutorial;
  const now = game.wallNow();
  if (now - (t.hintAt[id] ?? -Infinity) < HINTS[id] * 1000) return;
  t.hintAt[id] = now;
  t.hints[id] = (t.hints[id] ?? 0) + 1;
  const m = metrics(game);
  m.hints[id] = (m.hints[id] ?? 0) + 1;
  saveMetrics(game, m);
  game.sendTo(s, { t: 'onb', kind: 'hint', id });
}

function contextHints(game: Game, s: PlayerSession, ship: ShipEntity, p: Profile): void {
  if (p.tutorial.skipped && !p.tutorial.on) return; // an old hand hears none of it
  const w = watchOf(s);
  if (ship.docked || ship.sinkingUntil) {
    w.irons = w.hurt = 0;
    return;
  }
  // Ten seconds in irons: the wind.
  const inIrons = ship.state.sail > 0.3 && ship.state.speed < 1 && relWindDeg(ship.state.heading, game.windFor(ship)) < ship.sailParams(false).noGoDeg;
  w.irons = inIrons ? w.irons + 1 : 0;
  if (w.irons >= 10) {
    hint(game, s, 'irons');
    w.irons = 0;
  }
  // Damage left to fester out of a fight: the carpenters.
  const hurt = ship.hull < ship.stats.hullMax * 0.5 && !ship.repairing && !ship.inCombat(game.now);
  w.hurt = hurt ? w.hurt + 1 : 0;
  if (w.hurt >= 12) {
    hint(game, s, 'repair');
    w.hurt = 0;
  }
  // Near a port with nobody at the quay: how to come in.
  if (p.tutorial.on) {
    const port = game.nearestPort(ship.state.x, ship.state.y);
    if (port && dist(port.x, port.y, ship.state.x, ship.state.y) < 450 && ship.state.speed < 1.2) hint(game, s, 'docking');
  }
}

/** A broadside has come down: three in a row into the sea — the lead. */
export function onboardingVolley(game: Game, owner: ShipEntity, hits: number): void {
  const s = game.sessionOf(owner);
  if (!s?.profile) return;
  const t = s.profile.tutorial;
  const w = watchOf(s);
  if (hits > 0) {
    w.misses = 0;
    t.hits++;
    return;
  }
  if (t.skipped && !t.on) return;
  if (++w.misses >= 3) {
    hint(game, s, 'lead');
    w.misses = 0;
  }
}

// ------------------------------------------------------------------ chapter one: no ship is lost

/** Whether this captain is still in the First Watch, where nothing can be lost. */
export function onboardingProtected(s: PlayerSession | null): boolean {
  const t = s?.profile?.tutorial;
  return !!t && t.on && t.stage < STAGES.length;
}

/** In the First Watch a sunk ship is towed home by a Crown patrol: the soft loss screen, nothing taken. */
export function onboardingRescue(game: Game, s: PlayerSession): boolean {
  if (!onboardingProtected(s)) return false;
  const m = metrics(game);
  m.rescues++;
  saveMetrics(game, m);
  return true;
}

// ------------------------------------------------------------------ metrics (§13.3)

export interface OnboardingMetrics {
  started: number; // took the First Watch
  knewTheSea: number; // skipped it at the start
  skippedMidway: number;
  finished: number;
  stageDone: number[];
  stageSkipped: number[];
  stageSecs: number[];
  hints: Record<string, number>;
  rescues: number;
  cohort: Record<number, { created: number; last: number; skipped: boolean }>;
}

function metrics(game: Game): OnboardingMetrics {
  const m = game.db.getKv<OnboardingMetrics>('onboarding') ?? { started: 0, knewTheSea: 0, skippedMidway: 0, finished: 0, stageDone: [], stageSkipped: [], stageSecs: [], hints: {}, rescues: 0, cohort: {} };
  m.cohort ??= {};
  return m;
}

function saveMetrics(game: Game, m: OnboardingMetrics): void {
  game.db.setKv('onboarding', m);
}

/** A captain is made: with the First Watch, or "I know the sea". */
export function onboardingStart(game: Game, s: PlayerSession, tutorial: boolean): void {
  const p = s.profile!;
  p.tutorial = newTutorial(tutorial, game.wallNow());
  const m = metrics(game);
  if (tutorial) m.started++;
  else m.knewTheSea++;
  m.cohort[s.accountId] = { created: game.wallNow(), last: game.wallNow(), skipped: !tutorial };
  saveMetrics(game, m);
  if (!tutorial) fillGoals(p);
}

/** A captain comes aboard: the retention record. */
export function onboardingSeen(game: Game, s: PlayerSession): void {
  const m = metrics(game);
  const c = m.cohort[s.accountId];
  if (!c) return;
  c.last = game.wallNow();
  saveMetrics(game, m);
}

/** The funnel for GET /onboarding. */
export function onboardingReport(game: Game) {
  const m = metrics(game);
  const now = game.wallNow();
  const DAY = 86400_000;
  const retained = (skipped: boolean) => {
    const old = Object.values(m.cohort).filter((c) => c.skipped === skipped && now - c.created >= DAY);
    return { captains: old.length, day1: old.length ? Math.round((old.filter((c) => c.last - c.created >= DAY).length / old.length) * 100) / 100 : null };
  };
  return {
    started: m.started,
    knewTheSea: m.knewTheSea,
    skippedMidway: m.skippedMidway,
    finished: m.finished,
    skipShare: m.started + m.knewTheSea ? Math.round(((m.knewTheSea + m.skippedMidway) / (m.started + m.knewTheSea)) * 100) / 100 : 0,
    funnel: STAGES.map((st, i) => ({
      stage: st.id,
      passed: m.stageDone[i] ?? 0,
      skipped: m.stageSkipped[i] ?? 0,
      avgSecs: m.stageDone[i] ? Math.round((m.stageSecs[i] ?? 0) / m.stageDone[i]) : null,
    })),
    hints: Object.entries(m.hints).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
    rescues: m.rescues,
    retention: { firstWatch: retained(false), skipped: retained(true) },
    captains: Object.keys(CAPTAINS).length,
  };
}
