// The Descent into the Abyss (docs/12 P10 #17) on the server: the week's Maelstrom Stair in one sea (the same for a
// seed and a week); a captain (and her group near) goes down; each tier brings a new mix of the deep's creatures, a
// current and a darkness; cleared, it pays and the leader takes a blessing or a curse; leaving the arena, sinking or
// going home ends it; the deepest descents of the week go on the board.

import { itemName, makeItem } from '../../../shared/src/data/items.ts';
import {
  ARENA_R, BLESSINGS, BOONS, BREATH_SEC, CHOICE_SEC, CURRENTS, CURRENT_IDS, CURSES, DARKS, DARK_IDS, GATE_R, GROUP_R, HOSTS, HOST_IDS,
  OUT_SEC, TIER_SEC, WEEK_MS, glory, tierCount, tierLevelBonus, tierSilver,
} from '../../../shared/src/data/descent.ts';
import type { BoonId, CurrentId, DarkId, HostId } from '../../../shared/src/data/descent.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import type { DescentView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { setBeastPrey, spawnGroup } from './beasts.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { planWander } from './npc.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { sagaNote } from './saga.ts';

interface Run {
  id: number;
  members: number[];
  names: Map<number, string>;
  leader: number;
  tier: number;
  cleared: number;
  phase: 'fight' | 'choice' | 'breath';
  until: number;
  hosts: HostId[];
  current: CurrentId;
  dark: DarkId;
  ripDir: number;
  boons: BoonId[];
  offers: BoonId[] | null;
  enemies: number[];
  level: number;
  out: Map<number, number>;
}

interface Gate {
  week: number;
  x: number;
  y: number;
  region: RegionId;
}

interface DescentState {
  gate: Gate | null;
  runs: Map<number, Run>;
  byAccount: Map<number, number>;
  seq: number;
  sent: WeakSet<PlayerSession>;
  warned: Set<string>;
}

const states = new WeakMap<Game, DescentState>();
function ds(game: Game): DescentState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { gate: null, runs: new Map(), byAccount: new Map(), seq: 1, sent: new WeakSet(), warned: new Set() }));
  return s;
}

const SEAS: RegionId[] = ['gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'dead_mans_expanse', 'drowned_crown'];

/** The week's Stair: open water, clear of land for the whole arena, in one of six seas. */
export function gateOf(game: Game): Gate {
  const S = ds(game);
  const week = Math.floor(game.wallNow() / WEEK_MS);
  if (S.gate?.week === week) return S.gate;
  const rng = new Rng((game.world.seed * 131 + week * 7919 + 3) >>> 0);
  const seas = [...SEAS].sort(() => rng.float() - 0.5).filter((r) => !game.zone || game.zone.regions.has(r));
  let gate: Gate | null = null;
  for (const region of seas.length ? seas : SEAS) {
    const isl = game.world.islands.filter((i) => i.region === region);
    for (let k = 0; k < 80 && !gate; k++) {
      const is = isl[Math.floor(rng.float() * isl.length)];
      if (!is) break;
      const a = rng.float() * Math.PI * 2, r = is.radius + ARENA_R + 400 + rng.float() * 1500;
      const x = is.x + Math.sin(a) * r, y = is.y - Math.cos(a) * r;
      let clear = !isLand(game.world, x, y);
      for (let j = 0; clear && j < 12; j++) {
        const b = (j / 12) * Math.PI * 2;
        if (isLand(game.world, x + Math.sin(b) * ARENA_R, y - Math.cos(b) * ARENA_R) || isLand(game.world, x + Math.sin(b) * ARENA_R * 0.5, y - Math.cos(b) * ARENA_R * 0.5)) clear = false;
      }
      if (clear) gate = { week, x: Math.round(x), y: Math.round(y), region };
    }
    if (gate) break;
  }
  S.gate = gate ?? { week, x: 54000, y: 44000, region: 'dead_mans_expanse' };
  return S.gate;
}

function runOf(game: Game, account: number): Run | null {
  const S = ds(game);
  const id = S.byAccount.get(account);
  return id === undefined ? null : S.runs.get(id) ?? null;
}

export function inDescent(game: Game, account: number): boolean {
  return !!runOf(game, account);
}

/** What the land key does by the Stair. */
export function descentLandable(game: Game, s: PlayerSession): { island: string; feature: string; action: 'descent' } | null {
  const ship = s.ship;
  if (!ship || ship.docked || runOf(game, s.accountId)) return null;
  const g = gateOf(game);
  return Math.hypot(ship.state.x - g.x, ship.state.y - g.y) <= GATE_R ? { island: 'The Maelstrom Stair', feature: 'the way down', action: 'descent' } : null;
}

/** She goes down, and her group near with her. */
export function startDescent(game: Game, s: PlayerSession): string | null {
  const S = ds(game);
  const ship = s.ship;
  if (!ship || ship.docked || !ship.alive) return 'The Stair is not here.';
  if (runOf(game, s.accountId)) return 'You are already going down.';
  const g = gateOf(game);
  if (Math.hypot(ship.state.x - g.x, ship.state.y - g.y) > GATE_R) return 'The Stair is not here.';
  const members = [s.accountId];
  const group = groupOfAccount(game, s.accountId);
  for (const m of group?.members ?? []) {
    if (m === s.accountId || runOf(game, m)) continue;
    const o = game.sessionByAccount(m);
    if (o?.ship?.alive && !o.ship.docked && Math.hypot(o.ship.state.x - g.x, o.ship.state.y - g.y) <= GROUP_R) members.push(m);
  }
  const run: Run = {
    id: S.seq++, members, names: new Map(members.map((m) => [m, game.sessionByAccount(m)?.name ?? '?'])), leader: s.accountId,
    tier: 0, cleared: 0, phase: 'breath', until: game.now, hosts: [], current: 'still', dark: 'moonlit', ripDir: 0,
    boons: [], offers: null, enemies: [], level: 1, out: new Map(),
  };
  run.level = Math.max(...members.map((m) => game.sessionByAccount(m)?.ship?.shipLevel ?? 1));
  S.runs.set(run.id, run);
  for (const m of members) S.byAccount.set(m, run.id);
  tell(game, run, 'The descent begins: tier 1.', 'info');
  nextTier(game, run);
  return null;
}

function tell(game: Game, run: Run, msg: string, kind: 'info' | 'good' | 'bad' | 'gold'): void {
  for (const m of run.members) {
    const o = game.sessionByAccount(m);
    if (o) game.sendTo(o, { t: 'toast', msg, kind });
  }
}

function spot(game: Game, g: Gate, rng: Rng): [number, number] | null {
  for (let k = 0; k < 30; k++) {
    const a = rng.float() * Math.PI * 2, r = 900 + rng.float() * 600;
    const x = g.x + Math.sin(a) * r, y = g.y - Math.cos(a) * r;
    if (!isLand(game.world, x, y)) return [x, y];
  }
  return null;
}

/** The next tier: its creatures, its current, its darkness. */
function nextTier(game: Game, run: Run): void {
  const g = gateOf(game);
  const rng = game.rng;
  run.tier++;
  run.hosts = [rng.pick(HOST_IDS)];
  if (run.tier >= 4) {
    const second = rng.pick(HOST_IDS);
    if (second !== run.hosts[0]) run.hosts.push(second);
  }
  run.current = run.tier === 1 ? 'still' : rng.pick(CURRENT_IDS);
  run.ripDir = rng.float() * Math.PI * 2;
  run.dark = run.boons.includes('black_water') ? 'pitch' : run.tier === 1 ? 'moonlit' : rng.pick(DARK_IDS);
  const bite = run.boons.includes('lantern') ? 0 : DARKS[run.dark].bite;
  const lv = Math.min(10, run.level + tierLevelBonus(run.tier));
  let count = tierCount(run.tier) + run.boons.filter((b) => b === 'blood_in_water').length;
  run.enemies = [];
  const prey = () => run.members.map((m) => game.sessionByAccount(m)?.ship).filter((x): x is ShipEntity => !!x?.alive);
  for (let i = 0; count > 0 && i < 20; i++) {
    const host = run.hosts[i % run.hosts.length];
    const at = spot(game, g, rng);
    if (!at) continue;
    let spawned: ShipEntity[] = [];
    if (host === 'echoes' || host === 'reavers') {
      const role = host === 'echoes' ? 'ghost' : 'pirate';
      const npc = game.spawnNpcShip(role, rng.pick(hullsFor(role, lv)), host === 'echoes' ? 'choir' : 'confederacy', at[0], at[1], rng.float() * Math.PI * 2);
      game.setNpcLevel(npc, lv);
      const brain = game.npcs.get(npc.id);
      if (brain) {
        brain.active = true;
        brain.area = { x: g.x, y: g.y, r: ARENA_R };
        brain.expiresAt = game.now + TIER_SEC + 120;
        const p = prey();
        if (p.length) brain.chase = { id: rng.pick(p).id, until: game.now + TIER_SEC };
        planWander(game, npc, brain);
      }
      spawned = [npc];
      count--;
    } else {
      const id = host === 'sharks' ? 'shark' : host === 'orcas' ? 'orca' : 'young_serpent';
      const n = host === 'serpent' ? 1 : Math.min(count, 2 + (rng.chance(0.5) ? 1 : 0));
      spawned = spawnGroup(game, id, at[0], at[1], lv, n);
      const p = prey();
      for (const b of spawned) if (p.length) setBeastPrey(game, b.id, rng.pick(p).id);
      count -= host === 'serpent' ? 2 : spawned.length || 1;
    }
    for (const e of spawned) {
      if (bite) e.addEffect({ id: 'descent_dark', until: game.now + TIER_SEC + 120, mods: { gunDamageMul: bite } }, game.now);
      game.grid.upsert(e.id, e.state.x, e.state.y);
      run.enemies.push(e.id);
    }
  }
  run.phase = 'fight';
  run.until = game.now + TIER_SEC;
  const cur = CURRENTS[run.current].name[0], dark = DARKS[run.dark].name[0];
  tell(game, run, run.hosts.length > 1
    ? `Tier ${run.tier}: ${HOSTS[run.hosts[0]].name[0]} and ${HOSTS[run.hosts[1]].name[0]}; ${cur}; ${dark}.`
    : `Tier ${run.tier}: ${HOSTS[run.hosts[0]].name[0]}; ${cur}; ${dark}.`, 'info');
}

function offers(game: Game, run: Run): BoonId[] {
  const once: BoonId[] = ['lantern'];
  const bless = BLESSINGS.filter((b) => !(once.includes(b) && run.boons.includes(b))).sort(() => game.rng.float() - 0.5).slice(0, 2);
  const curse = CURSES.filter((c) => !run.boons.includes(c) || c === 'blood_in_water');
  return [...bless, ...(curse.length ? [game.rng.pick(curse)] : [])];
}

/** The leader takes a blessing or a curse; the next tier comes after a breath. */
export function chooseBoon(game: Game, s: PlayerSession, pick: BoonId): string | null {
  const run = runOf(game, s.accountId);
  if (!run || run.phase !== 'choice' || !run.offers) return 'Nothing to choose now.';
  if (run.leader !== s.accountId) return 'Only the leader chooses.';
  if (!run.offers.includes(pick)) return 'Nothing to choose now.';
  take(game, run, pick);
  return null;
}

function take(game: Game, run: Run, pick: BoonId): void {
  run.boons.push(pick);
  run.offers = null;
  const def = BOONS[pick];
  for (const m of run.members) {
    const ship = game.sessionByAccount(m)?.ship;
    if (!ship?.alive) continue;
    if (def.mods) ship.addEffect({ id: `descent_${pick}_${run.boons.length}`, until: game.now + 7200, mods: def.mods }, game.now);
    if (pick === 'tide_mending') {
      ship.hull = Math.min(ship.stats.hullMax, ship.hull + ship.stats.hullMax / 3);
      ship.sails = Math.min(ship.stats.sailHpMax, ship.sails + ship.stats.sailHpMax / 3);
    }
  }
  tell(game, run, `${def.name[0]} is chosen.`, def.curse ? 'bad' : 'good');
  run.phase = 'breath';
  run.until = game.now + BREATH_SEC;
}

function clearTier(game: Game, run: Run, whole: boolean): void {
  for (const id of run.enemies) {
    const e = game.ships.get(id);
    if (e?.alive) game.removeShip(id);
  }
  run.enemies = [];
  run.cleared = run.tier;
  if (whole) {
    const pay = tierSilver(run.tier, run.level);
    for (const m of run.members) {
      const o = game.sessionByAccount(m);
      if (!o?.profile) continue;
      o.profile.gold += pay;
      game.db.ledger(m, 'descent', pay, `tier ${run.tier}`);
    }
    tell(game, run, `Tier ${run.tier} is cleared: ${pay} silver.`, 'gold');
  } else tell(game, run, `The deep takes the rest: tier ${run.tier} is behind you.`, 'info');
  run.phase = 'choice';
  run.offers = offers(game, run);
  run.until = game.now + CHOICE_SEC;
}

/** One captain out of her descent: its prizes, her boons gone. */
function finishMember(game: Game, run: Run, account: number): void {
  const S = ds(game);
  S.byAccount.delete(account);
  run.members = run.members.filter((m) => m !== account);
  const o = game.sessionByAccount(account);
  if (o?.ship) {
    o.ship.effects = o.ship.effects.filter((e) => !e.id.startsWith('descent_'));
    o.ship.recompute(game.now);
  }
  const depth = run.cleared;
  const gl = glory(depth, run.boons);
  if (o?.profile) {
    if (depth >= 3) {
      const it = makeItem(game.rng, o.profile.itemSeq++, { ilvl: run.level, rarity: (depth >= 9 ? 4 : depth >= 6 ? 3 : 2) as 2 });
      if (takeItem(game, o, it)) game.sendTo(o, { t: 'toast', msg: `The deep gives up ${itemName(it)}.`, kind: 'gold' });
    }
    if (depth >= 1 && o.ship) o.ship.cargo.abyssal_ore = (o.ship.cargo.abyssal_ore ?? 0) + depth * 2;
    if (depth >= 3) sagaNote(game, o, 'descent', [], depth);
    game.sendTo(o, { t: 'toast', msg: `The descent is over at tier ${depth} (glory ${gl}).`, kind: 'info' });
    game.pushSelf(o, true);
    S.sent.add(o);
  }
  if (run.leader === account && run.members.length) run.leader = run.members[0];
}

function endRun(game: Game, run: Run): void {
  const S = ds(game);
  const names = [...run.names.values()];
  for (const m of [...run.members]) finishMember(game, run, m);
  for (const id of run.enemies) if (game.ships.get(id)?.alive) game.removeShip(id);
  S.runs.delete(run.id);
  record(game, names, run.cleared, glory(run.cleared, run.boons));
}

function record(game: Game, names: string[], depth: number, gl: number): void {
  if (depth <= 0) return;
  const week = Math.floor(game.wallNow() / WEEK_MS);
  const b = game.db.getKv<{ week: number; rows: { names: string[]; depth: number; glory: number }[] }>('descent_board');
  const rows = b?.week === week ? b.rows : [];
  const key = [...names].sort().join('|');
  const same = rows.find((r) => [...r.names].sort().join('|') === key);
  if (same) {
    if (gl > same.glory) Object.assign(same, { depth, glory: gl });
  } else rows.push({ names, depth, glory: gl });
  rows.sort((a, c) => c.glory - a.glory || c.depth - a.depth);
  game.db.setKv('descent_board', { week, rows: rows.slice(0, 10) });
}

export function weekBoard(game: Game): { names: string[]; depth: number; glory: number }[] {
  const b = game.db.getKv<{ week: number; rows: { names: string[]; depth: number; glory: number }[] }>('descent_board');
  return b?.week === Math.floor(game.wallNow() / WEEK_MS) ? b.rows : [];
}

/** She leaves of her own will. */
export function leaveDescent(game: Game, s: PlayerSession): string | null {
  const run = runOf(game, s.accountId);
  if (!run) return 'Nothing to choose now.';
  finishMember(game, run, s.accountId);
  if (!run.members.length) endRun(game, run);
  return null;
}

/** Once a second: who is still down, the tier's creatures, the choice's clock, the next tier; everyone near told. */
export function stepDescent(game: Game): void {
  const S = ds(game);
  const g = gateOf(game);
  for (const run of [...S.runs.values()]) {
    for (const m of [...run.members]) {
      const o = game.sessionByAccount(m);
      const ship = o?.ship;
      if (!ship?.alive || ship.docked) {
        finishMember(game, run, m);
        continue;
      }
      const d = Math.hypot(ship.state.x - g.x, ship.state.y - g.y);
      if (d > ARENA_R) {
        const since = run.out.get(m) ?? game.now;
        run.out.set(m, since);
        if (since === game.now) game.sendTo(o!, { t: 'toast', msg: 'Back to the arena, or your descent ends!', kind: 'bad' });
        if (game.now - since > OUT_SEC) {
          game.sendTo(o!, { t: 'toast', msg: 'You have left the arena: your descent is over.', kind: 'bad' });
          run.out.delete(m);
          finishMember(game, run, m);
        }
      } else run.out.delete(m);
    }
    if (!run.members.length) {
      endRun(game, run);
      continue;
    }
    if (run.phase === 'fight') {
      run.enemies = run.enemies.filter((id) => {
        const e = game.ships.get(id);
        if (!e?.alive) return false;
        if (Math.hypot(e.state.x - g.x, e.state.y - g.y) > ARENA_R + 600) {
          game.removeShip(id);
          return false;
        }
        return true;
      });
      if (!run.enemies.length) clearTier(game, run, true);
      else if (game.now > run.until) clearTier(game, run, false);
    } else if (run.phase === 'choice') {
      if (game.now > run.until && run.offers?.length) take(game, run, run.offers[0]);
    } else if (run.phase === 'breath' && game.now >= run.until) nextTier(game, run);
  }
  // The views: every second to those going down, every five to those near the Stair.
  const board = weekBoard(game);
  const five = Math.floor(game.now) % 5 === 0;
  for (const s of game.sessions) {
    const run = runOf(game, s.accountId);
    const ship = s.ship;
    const near = !!ship && !ship.docked && Math.hypot(ship.state.x - g.x, ship.state.y - g.y) < 9000;
    if (!run && !near) {
      if (S.sent.has(s)) {
        S.sent.delete(s);
        game.sendTo(s, { t: 'descent', view: null });
      }
      continue;
    }
    if (!run && !five && S.sent.has(s)) continue;
    const view: DescentView = {
      gate: { x: g.x, y: g.y, region: g.region, r: ARENA_R },
      run: run ? {
        tier: run.tier, phase: run.phase, hosts: run.hosts, current: run.current, dark: run.dark, boons: run.boons,
        offers: run.leader === s.accountId ? run.offers : null, leader: run.leader === s.accountId,
        left: Math.max(0, Math.ceil(run.until - game.now)), enemies: run.enemies.length,
        members: [...run.names.entries()].filter(([m]) => run.members.includes(m)).map(([, n]) => n),
        glory: glory(run.cleared, run.boons), ripDir: run.ripDir,
      } : null,
      week: board,
    };
    game.sendTo(s, { t: 'descent', view });
    S.sent.add(s);
  }
}

/** Every tick: the tier's current carries every hull in the arena. */
export function stepDescentSea(game: Game, dt: number): void {
  const S = ds(game);
  if (!S.runs.size) return;
  const g = gateOf(game);
  const flows = [...S.runs.values()].filter((r) => r.phase === 'fight' && r.current !== 'still');
  if (!flows.length) return;
  const run = flows[0];
  const k = run.boons.includes('undertow_curse') ? 2 : 1;
  game.forShipsNear(g.x, g.y, ARENA_R, (o) => {
    if (!o.alive || o.docked) return;
    const dx = o.state.x - g.x, dy = o.state.y - g.y, d = Math.hypot(dx, dy) || 1;
    let vx = 0, vy = 0;
    if (run.current === 'eddy') {
      vx = (-dy / d) * 1.6;
      vy = (dx / d) * 1.6;
    } else if (run.current === 'undertow') {
      const f = 0.6 + 0.8 * (d / ARENA_R);
      vx = (-dx / d) * 1.2 * f;
      vy = (-dy / d) * 1.2 * f;
    } else {
      vx = Math.sin(run.ripDir) * 2;
      vy = -Math.cos(run.ripDir) * 2;
    }
    o.state.x += vx * k * dt;
    o.state.y += vy * k * dt;
  });
}
