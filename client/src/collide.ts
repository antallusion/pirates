// The client's half of the hull against the coast (owner, 2026-10-08: «корабли не чувствуют границ островов»): her
// prediction strikes what the server's step strikes (shared/src/sim/hull.ts, shared/src/world/solids.ts), from what
// the chunks have brought — the coasts as drawn, the marks, the skerries, the wonders, a graveyard's hulks, the quays.
// Without it she was reckoned on into the land for a fifth of a second each frame and snapped back by the snapshots.
// (A hidden island's mist is not her coast: the server keeps her off it.)

import type { TurtleView } from '../../shared/src/isleproto.ts';
import type { IslandData, PortPublic, SeaMarkData, TidalView } from '../../shared/src/protocol.ts';
import type { Blocker } from '../../shared/src/sim/hull.ts';
import { SHORE_PAD } from '../../shared/src/sim/hull.ts';
import { turtlePos } from '../../shared/src/world/drift.ts';
import { bankBlockers, hulkBlockers, islandBlockers, markBlockers, quayBlockers, skerryBlockers, turtleBlocker, wonderBlockers } from '../../shared/src/world/solids.ts';

export interface CollideSource {
  islands: Map<number, IslandData>;
  seaMarks: Map<number, SeaMarkData>;
  ports: PortPublic[];
  adv: { objs: { x: number; y: number }[] } | null;
  wonders: { near: { id: string; kind: string; x: number; y: number }[] } | null;
  /** The banks the tide has bared, and the turtle islands (where they swim at `now`). */
  isles?: { tidal: TidalView[] } | null;
  turtles?: TurtleView[];
}

let portIsles = new Map<string, IslandData>();
let portIslesFrom = -1;

/** Every blocker the client knows within `reach` of a point, into `out` (cleared). */
export function clientBlockers(src: CollideSource, x: number, y: number, reach: number, out: Blocker[], now = 0): Blocker[] {
  out.length = 0;
  const near = (b: Blocker) => Math.abs(b.x - x) <= b.reach + reach && Math.abs(b.y - y) <= b.reach + reach;
  for (const is of src.islands.values()) {
    if (is.mist) continue;
    if (Math.abs(is.x - x) > is.r + reach + SHORE_PAD || Math.abs(is.y - y) > is.r + reach + SHORE_PAD) continue;
    for (const b of islandBlockers(is)) out.push(b);
    if (is.ty === 'graveyard' && !is.raft) for (const b of hulkBlockers(is)) if (near(b)) out.push(b);
  }
  for (const m of src.seaMarks.values()) {
    if (Math.abs(m.x - x) > m.r * 2 + reach || Math.abs(m.y - y) > m.r * 2 + reach) continue;
    for (const b of markBlockers(m)) if (near(b)) out.push(b);
  }
  for (const o of src.adv?.objs ?? []) {
    if (Math.abs(o.x - x) > 60 + reach || Math.abs(o.y - y) > 60 + reach) continue;
    for (const b of skerryBlockers(o)) if (near(b)) out.push(b);
  }
  for (const w of src.wonders?.near ?? []) {
    if (Math.abs(w.x - x) > 80 + reach || Math.abs(w.y - y) > 80 + reach) continue;
    for (const b of wonderBlockers(w)) if (near(b)) out.push(b);
  }
  for (const b of src.isles?.tidal ?? []) {
    if (!b.up || !b.poly || Math.abs(b.x - x) > b.r * 1.2 + reach || Math.abs(b.y - y) > b.r * 1.2 + reach) continue;
    for (const q of bankBlockers(b as { r: number; poly: number[] })) out.push(q);
  }
  for (const t of src.turtles ?? []) {
    if (!t.up) continue;
    const p = turtlePos({ id: t.id, name: ['', ''], region: 'gravewater', cx: t.cx, cy: t.cy, rx: t.rx, ry: t.ry, rot: t.rot, lap: t.lap, ph: t.ph, r: t.r, cph: 0 }, now);
    if (Math.abs(p.x - x) > t.r * 1.2 + reach || Math.abs(p.y - y) > t.r * 1.2 + reach) continue;
    out.push(turtleBlocker(p.x, p.y, t.r));
  }
  if (src.ports.length) {
    if (portIslesFrom !== src.islands.size) {
      portIsles = new Map();
      for (const is of src.islands.values()) if (is.portId) portIsles.set(is.portId, is);
      portIslesFrom = src.islands.size;
    }
    for (const p of src.ports) {
      if (p.raft || Math.abs(p.x - x) > 700 + reach || Math.abs(p.y - y) > 700 + reach) continue;
      const is = portIsles.get(p.id);
      if (!is) continue;
      for (const b of quayBlockers(p, is)) if (near(b)) out.push(b);
    }
  }
  return out;
}
