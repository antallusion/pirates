// Tasks of the sea on the server (docs/11 P6): a few pirate nests by islands about the map, each for 45 minutes,
// kept stocked with pirates while it lasts. Every captain's pirate sunk within the nest's reach counts on their own
// tally (a groupmate's kill too, through the quest events); a full tally is paid once.

import { hullsFor, shipLevelForCaptain } from '../../../shared/src/data/shiplevel.ts';
import { TASKS_AT_ONCE, TASK_KINDS, TASK_NEED, TASK_RADIUS, TASK_SEC, taskLevel, taskName, taskNeed, taskReward } from '../../../shared/src/data/worldtasks.ts';
import type { TaskKind, TaskView } from '../../../shared/src/data/worldtasks.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { planWander } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export interface WorldTask {
  id: number;
  kind: TaskKind;
  island: string;
  region: RegionId;
  x: number;
  y: number;
  until: number; // game seconds
  level: number;
  tally: Map<number, number>; // account → pirates sunk here
  done: Set<number>;
  pirates: number[]; // ship ids of the nest
  crates: number[]; // loot ids of the wreck field
}

interface TaskState {
  list: WorldTask[];
  nextId: number;
  lastBroadcast: number;
}

const states = new WeakMap<Game, TaskState>();
function st(game: Game): TaskState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { list: [], nextId: 1, lastBroadcast: -1e9 }));
  return s;
}

export function activeTasks(game: Game): WorldTask[] {
  return st(game).list;
}

/** A nest by an island in open water, clear of ports: none in the Abyss. */
function placeTask(game: Game, kind: TaskKind): WorldTask | null {
  const islands = game.world.islands.filter((is) => is.region !== 'the_abyss' && !is.minor);
  for (let k = 0; k < 40; k++) {
    const is = islands[Math.floor(game.rng.float() * islands.length)];
    if (!is) return null;
    const a = game.rng.float() * Math.PI * 2, r = is.radius + 350 + game.rng.float() * 500;
    const x = is.x + Math.cos(a) * r, y = is.y + Math.sin(a) * r;
    // In this process's own waters (the world may be split between zones).
    if (isLand(game.world, x, y) || !game.inZone(x, y) || !game.inZone(is.x, is.y)) continue;
    if (game.world.ports.some((p) => Math.hypot(p.x - x, p.y - y) < 3500)) continue;
    if (st(game).list.some((t) => Math.hypot(t.x - x, t.y - y) < 8000)) continue;
    const level = taskLevel(REGIONS[is.region].safety);
    return { id: st(game).nextId++, kind, island: is.name, region: is.region, x, y, until: game.now + TASK_SEC, level, tally: new Map(), done: new Set(), pirates: [], crates: [] };
  }
  return null;
}

/** Keep a wreck field strewn: five crates afloat at the least. */
const SALVAGE: GoodId[] = ['timber', 'rum', 'provisions', 'cloth', 'iron'];
function strew(game: Game, t: WorldTask): void {
  t.crates = t.crates.filter((id) => game.loot.has(id));
  for (let k = 0; t.crates.length < 5 && k < 12; k++) {
    const a = game.rng.float() * Math.PI * 2, r = 150 + game.rng.float() * 900;
    const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
    if (isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const good = SALVAGE[Math.floor(game.rng.float() * SALVAGE.length)];
    t.crates.push(game.dropTaskCrate(x, y, { [good]: 2 + Math.floor(game.rng.float() * 4) }, t.id, t.until - game.now));
  }
}

/** Keep haunted waters haunted: two of the drowned afloat at the least. */
function haunt(game: Game, t: WorldTask): void {
  t.pirates = t.pirates.filter((id) => game.ships.get(id)?.alive);
  for (let k = 0; t.pirates.length < 2 && k < 10; k++) {
    const a = game.rng.float() * Math.PI * 2, r = 200 + game.rng.float() * 700;
    const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
    if (isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const lv = shipLevelForCaptain(t.level) + 1;
    const ship = game.spawnNpcShip('ghost', game.rng.pick(hullsFor('ghost', lv)), 'choir', x, y, game.rng.float() * Math.PI * 2);
    game.setNpcLevel(ship, lv);
    const brain = game.npcs.get(ship.id);
    if (brain) {
      brain.area = { x: t.x, y: t.y, r: 1100 };
      brain.expiresAt = t.until + 60;
      planWander(game, ship, brain);
    }
    t.pirates.push(ship.id);
  }
}

/** Keep a nest stocked: three of its pirates at sea at the least. */
function stock(game: Game, t: WorldTask): void {
  t.pirates = t.pirates.filter((id) => game.ships.get(id)?.alive);
  for (let k = 0; t.pirates.length < 3 && k < 10; k++) {
    const a = game.rng.float() * Math.PI * 2, r = 200 + game.rng.float() * 700;
    const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
    if (isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const lv = shipLevelForCaptain(t.level);
    const ship = game.spawnNpcShip('pirate', game.rng.pick(hullsFor('pirate', lv)), 'confederacy', x, y, game.rng.float() * Math.PI * 2);
    game.setNpcLevel(ship, lv);
    const brain = game.npcs.get(ship.id);
    if (brain) {
      brain.area = { x: t.x, y: t.y, r: 1100 };
      brain.expiresAt = t.until + 60;
      planWander(game, ship, brain);
    }
    t.pirates.push(ship.id);
  }
}

/** Every second: the old nests lapse, new ones are found, the nests are kept stocked; the map is told each minute
 *  and whenever the tasks change. */
export function stepTasks(game: Game): void {
  const s = st(game);
  const before = s.list.length;
  s.list = s.list.filter((t) => t.until > game.now);
  let changed = s.list.length !== before;
  while (s.list.length < TASKS_AT_ONCE) {
    // The kinds by turns: the kind there are fewest of (nests first on a tie).
    const count = (k: TaskKind) => s.list.filter((x) => x.kind === k).length;
    const kind = [...TASK_KINDS].sort((a, b) => count(a) - count(b))[0];
    const t = placeTask(game, kind);
    if (!t) break;
    s.list.push(t);
    changed = true;
    for (const o of game.sessions) {
      if (o.ship?.region !== t.region) continue;
      const region = REGIONS[t.region].name;
      const news = t.kind === 'wreck' ? `News of the sea: a wreck field off ${t.island} in ${region}. Fish ${TASK_NEED} crates out of it within 45 min — anyone may.`
        : t.kind === 'haunt' ? `News of the sea: the drowned sail again off ${t.island} in ${region}. Sink ${taskNeed('haunt')} of their ships within 45 min — anyone may.`
        : `News of the sea: pirates nest off ${t.island} in ${region}. Sink ${TASK_NEED} of them there within 45 min — anyone may.`;
      game.sendTo(o, { t: 'toast', msg: news, kind: 'info' });
    }
  }
  if (Math.floor(game.now) % 10 === 0) for (const t of s.list) (t.kind === 'wreck' ? strew : t.kind === 'haunt' ? haunt : stock)(game, t);
  if (changed || game.now - s.lastBroadcast >= 60) {
    s.lastBroadcast = game.now;
    for (const o of game.sessions) if (o.profile) pushTasks(game, o);
  }
}

export function taskViews(game: Game, accountId: number): TaskView[] {
  return st(game).list.map((t) => ({ id: t.id, kind: t.kind, island: t.island, region: t.region, x: Math.round(t.x), y: Math.round(t.y), r: TASK_RADIUS, need: taskNeed(t.kind), mine: Math.min(taskNeed(t.kind), t.tally.get(accountId) ?? 0), done: t.done.has(accountId), endsIn: Math.max(0, Math.round(t.until - game.now)) }));
}

export function pushTasks(game: Game, s: PlayerSession): void {
  game.sendTo(s, { t: 'tasks', list: taskViews(game, s.accountId) });
}

/** One more on a captain's tally at a task: paid when it is full. */
function tallyUp(game: Game, s: PlayerSession, t: WorldTask): void {
  const name = taskName(t.kind, t.island);
  const need = taskNeed(t.kind);
  const n = (t.tally.get(s.accountId) ?? 0) + 1;
  t.tally.set(s.accountId, n);
  if (n >= need) {
    t.done.add(s.accountId);
    const r = taskReward(t.level);
    s.profile!.gold += r.silver;
    game.db.ledger(s.accountId, 'task', r.silver, `${t.kind} ${t.island}`);
    game.grantXp(s, r.xp, null);
    game.sendTo(s, { t: 'toast', msg: `Task of the sea done — ${name}: +${r.silver} silver, +${r.xp} XP.`, kind: 'gold' });
  } else game.sendTo(s, { t: 'toast', msg: `${name}: ${n}/${need}.`, kind: 'info' });
  pushTasks(game, s);
}

/** A pirate (or one of the drowned) sunk by the captain or a groupmate: on the tally of every nest (or haunted
 *  waters) within reach of her. */
export function taskEvent(game: Game, s: PlayerSession, victim: ShipEntity): void {
  const kind: TaskKind | null = victim.npcRole === 'pirate' ? 'nest' : victim.npcRole === 'ghost' ? 'haunt' : null;
  if (!kind || !s.profile) return;
  for (const t of st(game).list) {
    if (t.kind !== kind || t.done.has(s.accountId) || Math.hypot(victim.state.x - t.x, victim.state.y - t.y) > TASK_RADIUS) continue;
    tallyUp(game, s, t);
  }
}

/** A crate of a wreck field fished up: on the captain's tally there. */
export function taskSalvage(game: Game, s: PlayerSession, taskId: number): void {
  const t = st(game).list.find((x) => x.id === taskId);
  if (!t || !s.profile || t.done.has(s.accountId)) return;
  tallyUp(game, s, t);
}

/** Whether a point is within some task's reach (for the first word of them). */
export function nearTask(game: Game, x: number, y: number): boolean {
  return st(game).list.some((t) => Math.hypot(t.x - x, t.y - y) <= TASK_RADIUS * 1.5);
}

/** For tests: forget the tasks of a game. */
export function resetTasks(game: Game): void {
  states.delete(game);
}
