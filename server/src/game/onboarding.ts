// Onboarding (docs/07 §13, rewritten for the phone by docs/23 item 79): the First Watch — five steps, one action each,
// the game's own loop (sail; «Атаковать»; «Огонь»; «На абордаж» and the hex battle; «В порт»), the HUD revealed a block
// at a time, a ship that cannot be lost in it (the Crown tows her home), contextual hints that come back on mistakes,
// the Captain's Goals afterwards, the funnel metrics of §13.3 — and the first quarter of an hour kept plain (docs/23
// item 83: tattoos, dice, the auction and the guilds open after it).
// Every text lives on the client under the ids sent from here, so the words can be localized.

import { XP_UNITS, lumpXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import type { HudBlock, OnboardingView } from '../../../shared/src/protocol.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { islandsNear } from '../../../shared/src/world/worldgen.ts';
import { midPrice } from './economy.ts';
import { armyForLevel, armyMen } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import type { Game } from './Game.ts';
import { addXp } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { pursuitOf, startPursuit } from './pursuit.ts';

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
  /** The watch's version (WATCH_V). */
  v?: number;
  /** docs/23 item 81: how many of the first fights are behind her (the first FIRST_FIGHTS are short and winnable). */
  easy?: number;
  /** docs/23 item 83: seconds aboard so far, up to FRESH_SECS (the optional things open after it). */
  played?: number;
}

export function newTutorial(on: boolean, now: number): Tutorial {
  return { on, stage: on ? 0 : STAGES.length, at: now, skipped: !on, base: 0, hits: 0, hints: {}, hintAt: {}, tip: null, edgeSeen: false, goals: { active: [], done: [], base: {}, hidden: false }, v: WATCH_V, easy: on ? 0 : FIRST_FIGHTS, played: on ? 0 : FRESH_SECS };
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
  // Saved before the first quarter of an hour was counted: an old hand, everything open and no easy fights.
  t.played ??= FRESH_SECS;
  t.easy ??= FIRST_FIGHTS;
  if (t.v !== WATCH_V) {
    // The nine steps of before (cast_off, gunnery, board, battle, recruit, skill, visit, lair, rescue) onto the five.
    // Past the old «recruit» (skill, visit, lair, rescue) she had been to port already: the watch is behind her — the
    // «В порт» step sent her back to a quay, the optional things shut and the HUD half hidden till then (docs/23 item 96).
    if (t.on && t.stage >= 5) {
      t.on = false;
      t.stage = STAGES.length;
    } else if (t.on) t.stage = [0, 1, 3, 3, 4][t.stage] ?? STAGES.length;
    t.v = WATCH_V;
  }
  if (t.stage > STAGES.length) t.stage = STAGES.length;
}

/** docs/23 item 81: this many of a captain's first fights are short and winnable (firstfights.ts). */
export const FIRST_FIGHTS = 3;
/** docs/23 item 83: the first quarter of an hour aboard, kept to the loop; the optional things open after it. */
export const FRESH_SECS = 900;
export type Optional = 'tattoos' | 'dice' | 'auction' | 'guilds';
export const OPTIONAL: Optional[] = ['tattoos', 'dice', 'auction', 'guilds'];

/** Still in the first quarter of an hour: the optional things are shut (the First Watch, then 15 minutes aboard). A
 *  level was no measure of it: the newcomer's run was at level 4 in a minute and forty seconds. */
export function fresh(p: Profile | null | undefined): boolean {
  if (!p?.tutorial) return false;
  const t = p.tutorial;
  if (t.on && t.stage < STAGES.length) return true;
  return (t.played ?? FRESH_SECS) < FRESH_SECS;
}

/** The server's word when a fresh captain reaches for one of them anyway (a stale button, a typed command). */
export const FRESH_REFUSAL = 'Opens after your first quarter of an hour at sea';

// ------------------------------------------------------------------ the First Watch

interface Stage {
  id: string;
  /** HUD blocks this step brings in. */
  reveal: HudBlock[];
  done(game: Game, s: PlayerSession, ship: ShipEntity, p: Profile): boolean;
  /** The step's starting mark. */
  mark?(p: Profile): number;
  begin?(game: Game, s: PlayerSession, ship: ShipEntity): void;
  /** Every second while the step is open: keep what it needs in the world (a restart or a stray broadside must not
   * leave a captain with nothing to do). */
  keep?(game: Game, s: PlayerSession, ship: ShipEntity): void;
}

const START_BLOCKS: HudBlock[] = ['ship', 'nav'];
export const ALL_BLOCKS: HudBlock[] = ['ship', 'nav', 'cargo', 'feed', 'target', 'guns', 'abilities', 'map', 'talents', 'wanted', 'captain', 'minimap'];

/** The watch's version: 2 is the phone's five steps (docs/23 item 79); a profile saved in the old nine is moved over. */
export const WATCH_V = 2;

// docs/23 item 79 (owner 2026-10-06: «mobile first… всё должно быть идеально просто»): five steps, one action each, the
// very loop of the game — sail, «Атаковать», «Огонь», «На абордаж» (and the hex battle), «В порт». A finger over the
// button says what to press; the words are a title of two or three.
export const STAGES: Stage[] = [
  {
    // The stick: off the quay and under way.
    id: 'sail',
    reveal: [],
    done: (_g, _s, ship) => !ship.docked && ship.state.speed > 2.5 && ship.state.sail > 0.2,
  },
  {
    // «Атаковать»: a raider comes; one tap and the helmsman closes on her.
    id: 'attack',
    reveal: ['target', 'feed', 'minimap'],
    // (Boarded already — alongside before «Атаковать», the grapples thrown — the steps up to the battle are done: the
    // newcomer's run did just that, and the watch then waited for an «Атаковать» that would never come.)
    done: (game, s, ship) => {
      const run = pursuitOf(ship);
      return (!!run && !!game.ships.get(run.target)?.npcRole) || !!ship.boarding || !!watchOf(s).fought;
    },
    begin: (game, s, ship) => practiceRaider(game, s, ship),
    keep: (game, s, ship) => keepRaider(game, s, ship),
  },
  {
    // «Огонь»: one broadside by her own hand (a tap that lays the guns on her counts: the volley follows as she bears);
    // the grapples thrown first end it too — no step may hold a captain who already did the next thing.
    id: 'fire',
    reveal: ['guns'],
    mark: (p) => p.tutorial.hits,
    done: (_g, s, ship, p) => (watchOf(s).fired && p.tutorial.hits > p.tutorial.base) || p.tutorial.hits > p.tutorial.base + 2 || !!ship.boarding || !!watchOf(s).fought,
    begin: (game, s, ship) => {
      watchOf(s).fired = false;
      // The helmsman lays her broadside on the raider for the lesson (closing nose-on, no gun of hers bore: a desk's Q
      // and E answered «not on your beam» and the step waited, QA 2026-10-07); «На абордаж» turns him in again.
      const run = pursuitOf(ship);
      if (run && run.roam === undefined && run.mode === 'board') startPursuit(game, s, run.target, 'guns');
    },
    keep: (game, s, ship) => keepRaider(game, s, ship),
  },
  {
    // «На абордаж», and the battle on the hexes fought to its end.
    id: 'board',
    reveal: [],
    done: (_g, s, ship) => {
      const w = watchOf(s);
      if (ship.boarding) w.fought = true;
      return !!w.fought && !ship.boarding;
    },
    begin: (game, s, ship) => {
      const w = watchOf(s);
      w.fought = !!w.fought || !!ship.boarding; // a battle fought in an earlier step counts
      // «Огонь» laid her broadside on (the pursuit «Бортами»): the helmsman closes in again for the grapples, so the
      // step is the one tap of «На абордаж» and not «Сблизиться» first.
      const run = pursuitOf(ship);
      if (run && run.roam === undefined && run.mode === 'guns') startPursuit(game, s, run.target, 'board');
    },
    keep: (game, s, ship) => {
      const w = watchOf(s);
      if (ship.boarding || w.fought) return;
      keepRaider(game, s, ship);
      // Nothing is lost in the First Watch: men lost to a stray boarding come back before the lesson's (the newcomer's
      // run boarded with a third of her men and had a 0 % chance).
      if (w.army && ship.crew < armyMen(w.army) * 0.6) ship.setArmy(w.army);
    },
  },
  {
    // «В порт»: home, the prize sold and the men to be signed on.
    id: 'port',
    reveal: ['cargo', 'captain', 'map'],
    done: (_g, _s, ship) => !!ship.docked,
    begin: (game, s, ship) => {
      // The lesson's raider, ransomed or let go, sails off and leaves her be: she no longer struck her colours to the
      // pupil on the way home (a second card of choices over the last step, QA 2026-10-07).
      const id = raiders.get(s);
      const b = id !== undefined ? game.npcs.get(id) : undefined;
      if (b) {
        b.practice = undefined;
        b.practiceFloor = undefined;
        b.chase = null;
        b.target = null;
        b.struck = true;
        b.spared.set(ship.id, game.now + 900);
      }
      watchOf(s).raiderAt = game.now;
    },
    keep: (game, s, ship) => {
      // …and once her reckoning is settled she is gone into the haze: a hostile sail beside her stopped the helmsman
      // taking her home («В порт» by autosail, QA 2026-10-07: three minutes and not home).
      const id = raiders.get(s);
      const r = id !== undefined ? game.ships.get(id) : undefined;
      if (!r || !r.alive || r.prize || s.pendingBoarding) return;
      if (Math.hypot(r.state.x - ship.state.x, r.state.y - ship.state.y) > 400 || game.now - watchOf(s).raiderAt > 12) {
        game.removeShip(r.id);
        raiders.delete(s);
      }
    },
  },
];

/** The practice raider is gone (sunk by another hand, lost in a restart, left far behind): another comes. */
function keepRaider(game: Game, s: PlayerSession, ship: ShipEntity): void {
  if (ship.docked || ship.boarding) return;
  const id = raiders.get(s);
  const r = id !== undefined ? game.ships.get(id) : undefined;
  if (r && r.alive && Math.hypot(r.state.x - ship.state.x, r.state.y - ship.state.y) < 3500) {
    // She keeps coming for as long as the lesson lasts.
    const b = game.npcs.get(r.id);
    if (b) {
      b.practice = ship.id;
      b.chase = { id: ship.id, until: game.now + 300 };
    }
    return;
  }
  // One already about (a raider that outlived a restart): she is the one.
  for (const x of game.ships.values()) {
    if (x.alive && x.name === 'Red Novice' && Math.hypot(x.state.x - ship.state.x, x.state.y - ship.state.y) < 3500) {
      raiders.set(s, x.id);
      const b = game.npcs.get(x.id);
      if (b) b.practiceFloor ??= Math.ceil(x.crew * PRACTICE_FLOOR);
      return;
    }
  }
  const w = watchOf(s);
  if (game.now < w.raiderAt) return;
  w.raiderAt = game.now + 45;
  practiceRaider(game, s, ship);
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
/** The share of the practice raider's men the lesson's guns leave her. */
export const PRACTICE_FLOOR = 0.7;
/** …and the share of her hull they leave her: she is there to be boarded, not sunk (docs/23 item 79). */
export const PRACTICE_HULL = 0.3;
/** Each novice's practice raider (entity id). */
const raiders = new WeakMap<PlayerSession, number>();

function practiceRaider(game: Game, s: PlayerSession, ship: ShipEntity): void {
  const wind = game.windFor(ship);
  for (const off of [0, 0.8, -0.8, 1.6, -1.6]) {
    const a = wind.dir + Math.PI + off;
    const x = ship.state.x + Math.sin(a) * 900, y = ship.state.y - Math.cos(a) * 900;
    if (coastLand(game, x, y)) continue;
    const r = game.spawnNpcShip('pirate', 'sloop', 'confederacy', x, y, a + Math.PI, { ship: 'Red Novice', captain: 'Jory Slack' });
    game.setNpcLevel(r, 1); // the first fight is an even one
    r.purse = 120;
    r.cargo = { rum: 4 };
    // A lesson, not a massacre: round shot only (no grape to cut down a novice's crew), and she never boards.
    for (const a of Object.keys(r.ammo) as (keyof typeof r.ammo)[]) r.ammo[a] = a === 'round' ? 400 : 0;
    // A crew thin enough for a novice's first boarding (docs/17 H5): two thirds of her level's.
    r.setArmy(armyForLevel(1, Math.max(6, Math.round(r.crew * 0.65)), r.armySlots, 'pirate'));
    const brain = game.npcs.get(r.id)!;
    brain.area = { x: ship.state.x, y: ship.state.y, r: 3000 };
    brain.chase = { id: ship.id, until: game.now + 300 };
    brain.target = ship.id;
    brain.practice = ship.id;
    brain.struck = true; // she fights the lesson out: no colours struck, no card of terms over it
    // The guns take at most three tenths of her: ten of fourteen are left for «the battle, turn by turn» — three or
    // four rounds a side (a pupil's 24 deckhands win it every time), not the one blow it was.
    brain.practiceFloor = Math.ceil(r.crew * PRACTICE_FLOOR);
    raiders.set(s, r.id);
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
    const lv = addXp(p, lumpXp(p.level, XP_UNITS.tutorialGoal));
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
const watch = new WeakMap<PlayerSession, { irons: number; misses: number; hurt: number; view: string; raiderAt: number; fought?: boolean; fired?: boolean; army?: ArmyStack[] | null }>();

export function onboardingSecond(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return;
  const t = p.tutorial;
  let changed = false;
  // The first quarter of an hour (docs/23 item 83): when it is over, the optional things open, told once.
  const wasFresh = fresh(p);
  if ((t.played ?? FRESH_SECS) < FRESH_SECS) t.played = (t.played ?? 0) + 1;
  if (t.on && t.stage < STAGES.length) {
    // Her men as they stood in port: a tow home gives back those the lesson's guns took (see onboardingRescue).
    if (ship.docked) watchOf(s).army = ship.army.map((x) => ({ ...x }));
    // A battle on the hexes in any step before «На абордаж» is that step's battle (the grapples thrown early).
    if (ship.boarding && STAGES[t.stage]?.id !== 'port') watchOf(s).fought = true;
    const st = STAGES[t.stage];
    if (st.done(game, s, ship, p)) {
      advance(game, s, 'done');
      changed = true;
    } else st.keep?.(game, s, ship);
  } else if (!t.on || t.stage >= STAGES.length) changed = stepGoals(game, s, p) || changed;
  // The edge of safe waters: once, for every captain.
  if (!t.edgeSeen && REGIONS[ship.region].safety !== 'safe' && !ship.docked) {
    t.edgeSeen = true;
    game.sendTo(s, { t: 'onb', kind: 'edge', id: ship.region });
  }
  contextHints(game, s, ship, p);
  if (wasFresh && !fresh(p)) {
    game.sendTo(s, { t: 'onb', kind: 'unlock', id: OPTIONAL.join(',') });
    changed = true;
  }
  const view = JSON.stringify(onboardingView(p));
  const w = watchOf(s);
  if (changed || view !== w.view) {
    w.view = view;
    game.sendTo(s, { t: 'onboarding', view: onboardingView(p) });
  }
}

function watchOf(s: PlayerSession) {
  let w = watch.get(s);
  if (!w) watch.set(s, (w = { irons: 0, misses: 0, hurt: 0, view: '', raiderAt: 0, army: null }));
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
    const lv = addXp(p, lumpXp(p.level, XP_UNITS.tutorialStage * (1 + 0.25 * t.stage)));
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
    tip: null,
    goals: !on && !t.goals.hidden ? t.goals.active : null,
    goalsDone: t.goals.done.length,
    hints: Object.keys(t.hints),
    locked: fresh(p) ? [...OPTIONAL] : [],
  };
}

// ------------------------------------------------------------------ contextual hints (§13.1)

/** The hints and how often at most (seconds). */
export const HINTS: Record<string, number> = { irons: 240, lead: 180, repair: 300, docking: 600, daily: 1e9, journal: 1e9, social: 1e9, tasks: 1e9 };

/** News for every captain, old hand or new (docs/11 P6), told once: the day's orders and the common cause on the
 *  first put-in, the journal and the gold pointer on the first quest taken. */
export function newsHint(game: Game, s: PlayerSession, id: 'daily' | 'journal' | 'social' | 'tasks'): void {
  if (!s.profile || (s.profile.tutorial.hints[id] ?? 0) > 0) return;
  // Not a First Watch hint: kept out of the watch's hint tally.
  s.profile.tutorial.hints[id] = 1;
  s.profile.tutorial.hintAt[id] = game.wallNow();
  game.sendTo(s, { t: 'onb', kind: 'hint', id });
}

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
  const inIrons = ship.state.sail > 0.3 && ship.state.speed < ship.stats.maxSpeed * 0.35 && relWindDeg(ship.state.heading, game.windFor(ship)) < ship.sailParams(false).noGoDeg;
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

/** The captain's own hand on the guns (a broadside by key, «Огонь», or «Огонь» laying the guns on a mark that does not
 *  bear yet): the First Watch's «Огонь» step waits for it. */
export function onboardingFire(s: PlayerSession | null | undefined): void {
  if (s?.profile?.tutorial.on) watchOf(s).fired = true;
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
  // «Nothing taken» means her men too: the ones the lesson's guns cut down come back with the tow (a novice was
  // towed home with 3 of her 24, and a long 9 wants four hands to fire).
  const army = watchOf(s).army;
  if (s.ship && army && armyMen(army) > s.ship.crew) s.ship.setArmy(army);
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

/** The funnel's store: the five steps' own (the nine steps' counts stay under 'onboarding', and were reported under the
 *  five's names, docs/23 item 96). */
const METRICS_KV = 'onboarding5';

function metrics(game: Game): OnboardingMetrics {
  const m = game.db.getKv<OnboardingMetrics>(METRICS_KV) ?? { started: 0, knewTheSea: 0, skippedMidway: 0, finished: 0, stageDone: [], stageSkipped: [], stageSecs: [], hints: {}, rescues: 0, cohort: {} };
  m.cohort ??= {};
  return m;
}

function saveMetrics(game: Game, m: OnboardingMetrics): void {
  game.db.setKv(METRICS_KV, m);
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
