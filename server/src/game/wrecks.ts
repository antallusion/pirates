// Wreckage of her own (seaux, owner 2026-10-11: «Обломки разные на карте должны привязываться к игроку, и
// генерироваться к игроку, чтобы у каждого были свои обломки и респаун у них должен быть 48 часов. И я всегда должен их
// подбирать»). shared/src/data/wrecks.ts has the numbers.
//
// Each captain's spots come from her own dice per cell of the sea (her account and the cell: the same spots every time
// she passes, and nobody else's), on open water clear of anything solid her hull would strike (so every one can be
// reached). She sees the spots of the 3 × 3 cells round her (one message when that changes), takes one by passing
// through it — the line she sailed since the last look, so a fast pass is never missed — and it is gone for her 48
// hours, kept on her profile (saved with her captain: a restart forgets nothing). A full hold still takes it: what
// will not fit is broken up for its silver. Cost: once a second, her nine cells' few spots, worked out once per cell she
// enters — no scan of the whole sea, no scan of every captain against every spot.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import {
  WRECK_AGAIN_MS, WRECK_CELL, WRECK_CELLS, WRECK_CLEAR, WRECK_GOODS, WRECK_PER_CELL, WRECK_PICK, wreckCount, wreckId, wreckValue,
} from '../../../shared/src/data/wrecks.ts';
import type { WreckView } from '../../../shared/src/data/wrecks.ts';
import { Rng, hash2 } from '../../../shared/src/rng.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { clearAt } from '../../../shared/src/world/solids.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

export interface WreckSpot {
  id: number;
  x: number;
  y: number;
  good: GoodId;
  n: number;
  value: number;
}

interface Watch {
  /** Her cell, the spots of the cells round her (by cell key), what was last sent, where she was last looked at. */
  cell: number;
  cells: Map<number, WreckSpot[]>;
  sent: string;
  x: number;
  y: number;
}

const watch = new WeakMap<PlayerSession, Watch>();

/** The spots a cell lays for a captain (her own dice: account × cell), on clear open water only. */
export function cellSpots(game: Game, account: number, cx: number, cy: number): WreckSpot[] {
  if (cx < 0 || cy < 0 || cx >= WRECK_CELLS || cy >= WRECK_CELLS) return [];
  const rng = new Rng(hash2(cx, cy, (account * 0x9e3779b1) ^ 0x5eaa11));
  const u = rng.float();
  const count = u < WRECK_PER_CELL[0] ? 0 : u < WRECK_PER_CELL[0] + WRECK_PER_CELL[1] ? 1 : 2;
  const out: WreckSpot[] = [];
  for (let k = 0; k < count; k++) {
    // (a few tries for open water; a cell of land and reef lays nothing)
    for (let t = 0; t < 4; t++) {
      const x = (cx + rng.range(0.08, 0.92)) * WRECK_CELL, y = (cy + rng.range(0.08, 0.92)) * WRECK_CELL;
      const [good, [lo, hi]] = rng.weighted(WRECK_GOODS.map((g) => [g, g[2]] as [typeof g, number]));
      const roll = rng.float();
      if (!openSea(game, x, y)) continue;
      const n = wreckCount(lo, hi, roll, sectorAt(game.world, x, y).level);
      out.push({ id: wreckId(cx, cy, k), x: Math.round(x), y: Math.round(y), good, n, value: wreckValue(good, n) });
      break;
    }
  }
  return out;
}

/** Open water a hull can come to: no land, nothing solid within WRECK_CLEAR, inside the sea's zone. */
export function openSea(game: Game, x: number, y: number): boolean {
  return game.inZone(x, y) && !isLand(game.world, x, y) && !isLand(game.world, x + WRECK_CLEAR, y) && !isLand(game.world, x - WRECK_CLEAR, y)
    && !isLand(game.world, x, y + WRECK_CLEAR) && !isLand(game.world, x, y - WRECK_CLEAR) && clearAt(game.world, x, y, WRECK_CLEAR);
}

/** Loot put on a hulk, a skerry or the shore's edge: the open water nearest it (null: where it is will do). */
export function lootSpot(game: Game, x: number, y: number): { x: number; y: number } | null {
  const ok = (px: number, py: number) => !isLand(game.world, px, py) && clearAt(game.world, px, py, 45);
  if (ok(x, y)) return null;
  for (let r = 40; r <= 480; r += 40) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (ok(px, py)) return { x: Math.round(px), y: Math.round(py) };
    }
  }
  return null;
}

/** The spots she took and when (real milliseconds), those 48 hours old let go. */
export function wrecksTaken(game: Game, p: Profile): Record<string, number> {
  const rec = (p.wrecks ??= {});
  const now = game.wallNow();
  for (const [k, at] of Object.entries(rec)) if (!(typeof at === 'number' && now - at < WRECK_AGAIN_MS)) delete rec[k];
  return rec;
}

const cellOf = (x: number, y: number): [number, number] => [Math.floor(x / WRECK_CELL), Math.floor(y / WRECK_CELL)];

/** The spots she sees now (the 3 × 3 cells round her, those she has not taken within 48 hours). */
export function wrecksOf(game: Game, s: PlayerSession): WreckSpot[] {
  const ship = s.ship, p = s.profile;
  if (!ship || !p) return [];
  const w = look(game, s);
  const taken = wrecksTaken(game, p);
  const out: WreckSpot[] = [];
  for (const list of w.cells.values()) for (const sp of list) if (taken[String(sp.id)] === undefined) out.push(sp);
  return out;
}

/** Her watch, its cells brought up to where she is (worked out only for the cells she has newly come to). */
function look(game: Game, s: PlayerSession): Watch {
  const ship = s.ship!;
  const [cx, cy] = cellOf(ship.state.x, ship.state.y);
  const cell = cy * WRECK_CELLS + cx;
  let w = watch.get(s);
  if (!w) watch.set(s, (w = { cell: -1, cells: new Map(), sent: '', x: ship.state.x, y: ship.state.y }));
  if (w.cell !== cell) {
    w.cell = cell;
    const keep = new Map<number, WreckSpot[]>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = (cy + dy) * WRECK_CELLS + (cx + dx);
        keep.set(k, w.cells.get(k) ?? cellSpots(game, s.accountId, cx + dx, cy + dy));
      }
    }
    w.cells = keep;
  }
  return w;
}

/** The distance from a point to the line she sailed (a → b). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)) : 0;
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** She takes a spot: its goods into the hold (what will not fit broken up for its silver), gone for her 48 hours. */
export function takeWreck(game: Game, s: PlayerSession, sp: WreckSpot): void {
  const ship = s.ship!, p = s.profile!;
  wrecksTaken(game, p)[String(sp.id)] = game.wallNow();
  const g = GOODS[sp.good];
  const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
  const per = g.volume * (g.contraband ? ship.stats.contrabandVolumeMul : 1);
  const n = Math.max(0, Math.min(sp.n, Math.floor((free + 1e-6) / Math.max(1e-6, per))));
  if (n > 0) ship.cargo[sp.good] = (ship.cargo[sp.good] ?? 0) + n;
  const silver = Math.round(g.basePrice * (sp.n - n) * 0.5);
  if (silver > 0) {
    p.gold += silver;
    game.db.ledger(s.accountId, 'loot', silver, 'wreck');
  }
  const words = [n > 0 ? `${n} ${g.name}` : '', silver > 0 ? `${silver} silver` : ''].filter(Boolean).join(', ');
  game.toastShip(ship, n < sp.n ? `Salvaged from the wreckage: ${words} (no room in the hold for the rest: broken up for its silver).` : `Salvaged from the wreckage: ${words}.`, 'gold');
}

/** Every second, each captain at sea: the spots she passed through taken, her view sent when it changed. */
export function stepWrecks(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || s.disconnectedAt !== null) continue;
    const w = look(game, s);
    const atSea = ship.alive && !ship.docked && !ship.ghost && !ship.boarding && !ship.hasEffect('submerged');
    let took = false;
    // (a jump — the tester's /tp, a tow home — is no line sailed: only where she is now)
    const jump = Math.hypot(ship.state.x - w.x, ship.state.y - w.y) > 250;
    if (jump) [w.x, w.y] = [ship.state.x, ship.state.y];
    if (atSea) {
      const reach = ship.stats.length / 2 + WRECK_PICK;
      for (const sp of wrecksOf(game, s)) {
        if (Math.abs(sp.x - ship.state.x) > 400 && Math.abs(sp.x - w.x) > 400) continue;
        if (segDist(sp.x, sp.y, w.x, w.y, ship.state.x, ship.state.y) > reach) continue;
        takeWreck(game, s, sp);
        took = true;
      }
    }
    w.x = ship.state.x;
    w.y = ship.state.y;
    sendWrecks(game, s, took);
  }
}

/** Her spots to her client, when they changed. */
export function sendWrecks(game: Game, s: PlayerSession, force = false): void {
  const w = watch.get(s);
  if (!w || !s.ship) return;
  const list: WreckView[] = s.ship.docked ? [] : wrecksOf(game, s).map((sp) => ({ id: sp.id, x: sp.x, y: sp.y, value: sp.value }));
  const key = list.map((x) => x.id).join(',');
  if (!force && key === w.sent) return;
  w.sent = key;
  game.sendTo(s, { t: 'wrecks', list });
}
