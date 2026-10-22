// Route to the nearest place a goal is done (owner, 2026-10-15: «нажимая на цель из журнала я должен плыть к ближайшей
// точке выполнения, будь это квест потопить кого-то, цель капитана или промысел. вообще все должно меня вести
// автоматом к ближайшей подходящей точке»).
//
// The client sends a goal's key (one per tap: `{t:'goto', key}`); the server — the only one that knows where the sea's
// ships are — finds the nearest place that goal can be progressed, by the water (nav.ts seaField, one Dijkstra pass
// over the coarse grid kept a while), and the helmsman takes her there (autosail.ts). While the run lasts the place is
// looked at again every couple of seconds: a ship it follows is followed, a ship sunk or gone gives way to the next
// nearest, a quest's next step to its own place; the goal met ends the run. Her own hand on the wheel, another course,
// the pill's stop end it too. A course broken off by a fight is the helmsman's to take up again (autosail.ts); once the
// sea is quiet after a ship of the goal was reached, the next is sailed for by itself.
//
// Keys (GOAL_KEYS): `q:<quest>` a quest's step (the Admiralty's contracts and the arcs are quests), `c:<contract>` a
// contract of a port's board, `t:<task>` a task of the sea, `d:<kind>` a daily order, `w:<id>` a goal of the sea,
// `r:<kind>:<region>` the week's challenge, `cm` the common goal, `inv` the Choir's invasion, `g:<id>` a captain's goal,
// `f` her trade (the fishing: by her tackle), `b:<group>` the beasts, `zb:<region>` a zone boss, `boss` the sea's bosses.

import { ownStockOf } from './ownstock.ts';
import { BEASTS, beastOfClass } from '../../../shared/src/data/beasts.ts';
import type { BeastGroup } from '../../../shared/src/data/beasts.ts';
import type { DailyKind } from '../../../shared/src/data/dailies.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import type { RouteView } from '../../../shared/src/protocol.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId, Safety } from '../../../shared/src/world/regions.ts';
import { SECTOR_SIZE, sectorAt, sectorGrid } from '../../../shared/src/world/sectors.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { AUTOSAIL_ARRIVE } from '../../../shared/src/data/autosail.ts';
import { REACH_DOCK, landingPoint } from '../../../shared/src/data/reach.ts';
import { autosailOf, helmTouched, lastStopOf, pathView, pausedCourse, planFrom, startAutosail, stopAutosail } from './autosail.ts';
import { beastsAlive } from './beasts.ts';
import { commonView } from './commongoal.ts';
import { canDive } from './explorefx.ts';
import { ensurePortShoals, fishingView, shoalsOf } from './fishing.ts';
import type { Game } from './Game.ts';
import { fieldDist, seaField } from './nav.ts';
import { onboardingProtected } from './onboarding.ts';
import type { PlayerSession } from './player.ts';
import { findsOf } from './seafinds.ts';
import type { ShipEntity } from './ship.ts';
import { worldGoals } from './worldgoals.ts';
import { campaignFoes } from './campaign.ts'; // docs/36
import { ownIsland } from './estate.ts';
import { roamFighter, roamUp, roamWhere, roamersAbout } from './roamers.ts';
import { castawaysOf } from './castaways.ts';
import { liveNamed } from './wanted.ts';
import { activeTasks } from './worldtasks.ts';
import { ensureDailyQuarry, ensureQuarry, localHomeOf, nearHome } from './questlocal.ts'; // owner, 2026-10-18
import type { Home } from './questlocal.ts';
import { openSea } from './wrecks.ts';

/** The live ships of a goal looked for within this of her (her lookout's reach on a clear day, about). */
export const ROUTE_VIEW = 6000;
/** A captain below this level is a newcomer: lawless water is the last pick, and said so on the chip. */
export const ROUTE_NEWBIE = 12;
/** The place is looked at again this often while the run lasts (seconds). */
export const ROUTE_CHECK = 2;
/** A tap of the same goal within this is the same tap (seconds). */
export const ROUTE_TAP = 1;
/** The sailing distances are computed for this many of the nearest candidates in a straight line. */
const ROUTE_CANDS = 8;

/** The words she is told (translated on the client, server.ru.route.ts). */
export const ROUTE_WORDS = {
  done: 'The goal is met: the helmsman gives you the wheel.',
  none: 'Nowhere on the sea to work at that goal now.',
  noShip: 'No ship',
  unknown: 'That goal is gone from the log.',
  noPlace: 'That goal is not done at sea: see its window.',
  noTackle: 'No fishing tackle aboard: fit a net or a rod at a port.',
  duel: 'A duel is fought with another captain: challenge one at a port.',
  retarget: 'The mark is gone: the helmsman takes her on to the next one.',
  afterPort: 'The course is set: the helmsman takes her there once she casts off.',
  here: 'You are there already: it is done in this port.',
  again: 'You are in that port already: cast off and put in again to make the step.',
} as const;

/** The trades' lines shown on arrival (English; translated on the client). */
export const ROUTE_HINTS = {
  net: 'Gulls over a shoal: slow down and cast the net.',
  rod: 'Keep a steady pace on open water, far from land: the rod works.',
  lamp: 'At night lie still and light the lamp.',
  trap: 'Set the traps close by the shore.',
  deep: 'Lie still over deep water and drop the line.',
  dive: 'Heave to over the wreck and send the divers down.',
  board: 'Come alongside and board her.',
  beast: 'Close in and harpoon it.',
} as const;

/** A place the goal can be worked at. `w` weighs its distance (a second choice: above 1). */
interface Cand {
  x: number;
  y: number;
  r: number;
  kind: RouteView['kind'];
  name: string;
  act?: 'dock' | 'land';
  port?: string;
  island?: number;
  region?: RegionId;
  ship?: number;
  hint?: string;
  w?: number;
}

/** What a goal's key resolves to: its places, the goal met, or why there is none. */
type Resolved = { cands: Cand[] } | { done: true } | { none: string };

// ------------------------------------------------------------------ the distances by the water

interface FieldCache {
  x: number;
  y: number;
  at: number;
  limit: number;
  field: Float32Array;
}
const fields = new WeakMap<PlayerSession, FieldCache>();
/** One pass of the whole sea per tick at most (the tick's budget, 3 ms at 40 captains): the rest wait on the field they
 *  have, however old, and the run's looks again (not a tap) on one 5 km / 2 min old. */
let passTick = -1;

/** Her distances by the water from about where she is (kept 30 s and 1.2 km for a tap, 2 min and 5 km while a run
 *  looks again: a pass is a few tens of ms). Null: none to be had this tick (straight lines then). */
function fieldFor(game: Game, s: PlayerSession, x: number, y: number, limit: number, again: boolean): Float32Array | null {
  const c = fields.get(s);
  const [age, off] = again ? [120, 5000] : [30, 1200];
  if (c && game.now - c.at < age && Math.hypot(c.x - x, c.y - y) < off && c.limit >= limit) return c.field;
  const tick = Math.round(game.now * 20);
  if (again && passTick === tick) return c?.field ?? null;
  passTick = tick;
  const field = seaField(game.world, x, y, limit);
  fields.set(s, { x, y, at: game.now, limit, field });
  return field;
}

/** Where she is (in port: the port). */
function hereOf(game: Game, s: PlayerSession): { x: number; y: number } | null {
  const ship = s.ship;
  if (!ship) return null;
  if (ship.docked) {
    const p = game.portById(ship.docked);
    if (p) return p;
  }
  return { x: ship.state.x, y: ship.state.y };
}

/** How dangerous a place's waters are for her: the square's ship level, and 0 fine / 1 above her ship / 2 lawless
 *  water for a newcomer. */
export function riskAt(game: Game, s: PlayerSession, x: number, y: number): { level: number; risk: 0 | 1 | 2 } {
  const level = sectorAt(game.world, x, y).level;
  const mine = s.ship?.shipLevel ?? 1;
  const newbie = onboardingProtected(s) || (s.profile?.level ?? 1) < ROUTE_NEWBIE;
  const lawless = REGIONS[game.regionAt(x, y)].safety === 'lawless';
  return { level, risk: lawless && newbie ? 2 : level >= mine + 2 ? 1 : 0 };
}

/** The nearest of the places by the water (a newcomer kept out of lawless water while there is another choice, a ship
 *  out of the reach of hers last). */
export function pickNearest(game: Game, s: PlayerSession, cands: Cand[], again = false): RouteView | null {
  const here = hereOf(game, s);
  if (!here || !cands.length) return null;
  const scored = cands.map((c) => ({ c, d: Math.hypot(c.x - here.x, c.y - here.y), k: riskAt(game, s, c.x, c.y) }));
  const weigh = (o: (typeof scored)[number], d: number) => d * (o.c.w ?? 1) * (o.k.risk === 2 ? 4 : o.k.risk === 1 ? 1.6 : 1);
  scored.sort((a, b) => weigh(a, a.d) - weigh(b, b.d));
  const top = scored.slice(0, ROUTE_CANDS);
  const limit = Math.max(...top.map((o) => o.d)) * 2.5 + 8000;
  const field = fieldFor(game, s, here.x, here.y, limit, again);
  let best: (typeof top)[number] | null = null, bw = Infinity, bd = 0;
  for (const o of top) {
    // a place within a few hundred metres is there already, whatever the grid says
    // (and one in sight over open water within a mile or so: the coarse grid's 400 m cells reckon a harbour's own water
    // two and three times over — a shoal 500 m off the quays came out at 2.5 km)
    let d = o.d < 600 || !field || (o.d < NEAR_SIGHT && openWay(game, here.x, here.y, o.c.x, o.c.y, s.ship?.docked ? 0.35 : 0.05)) ? o.d : fieldDist(game.world, field, o.c.x, o.c.y);
    if (!Number.isFinite(d)) d = o.d * 3; // no way the grid knows (a cove, a lagoon): last, not never
    const w = weigh(o, d);
    if (w < bw) [best, bw, bd] = [o, w, d];
  }
  if (!best) return null;
  let c = best.c;
  // An island to land on (owner, 2026-10-22: the landing is thirty metres from her hull): the beach nearest her, a little
  // out from it, not the island's middle — the run ends inside the boats' reach.
  if (c.act === 'land' && c.island !== undefined) {
    const is = game.world.islands[c.island];
    if (is) {
      const b = landingPoint(is.poly, here.x, here.y);
      const nx = b.x - is.x, ny = b.y - is.y, l = Math.hypot(nx, ny) || 1;
      c = { ...c, x: b.x + (nx / l) * 18, y: b.y + (ny / l) * 18, r: 60 };
    }
  }
  return {
    x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r), kind: c.kind, name: c.name, dist: Math.round(bd), level: best.k.level, risk: best.k.risk,
    ...(c.act ? { act: c.act } : {}), ...(c.port ? { port: c.port } : {}), ...(c.island !== undefined ? { island: c.island } : {}),
    ...(c.region ? { region: c.region } : {}), ...(c.ship !== undefined ? { ship: c.ship } : {}), ...(c.hint ? { hint: c.hint } : {}),
  };
}

/** Within this a place seen over open water is reckoned straight (m). */
const NEAR_SIGHT = 1800;

/** Open water on the way from a point to another, from `from` of the way on (in port: past her own quay and the
 *  harbour's mouth). */
function openWay(game: Game, x0: number, y0: number, x1: number, y1: number, from: number): boolean {
  for (let f = from; f <= 1.001; f += 0.05) if (isLand(game.world, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)) return false;
  return true;
}

// ------------------------------------------------------------------ the places

const portCand = (p: { id: string; name: string; x: number; y: number }, w?: number): Cand => ({ x: p.x, y: p.y, r: 400, kind: 'port', name: p.name, act: 'dock', port: p.id, ...(w ? { w } : {}) });

function ports(game: Game, pred: (p: Game['world']['ports'][number]) => boolean = () => true): Cand[] {
  return game.world.ports.filter(pred).map((p) => portCand(p));
}

/** The islands one may chart or land on (not the rocks, the rafts, the hidden or the empty places). */
function islands(game: Game, pred: (i: Game['world']['islands'][number]) => boolean, act?: 'land'): Cand[] {
  const out: Cand[] = [];
  for (const i of game.world.islands) {
    if (i.minor || i.raft || i.hidden || i.slot || !pred(i)) continue;
    out.push({ x: i.x, y: i.y, r: i.radius + (act ? 300 : 600), kind: 'island', name: i.name, island: i.id, ...(act ? { act } : {}) });
  }
  return out;
}

/** What a sea's ship of a goal is. */
type ShipKind = 'pirates' | 'choir' | 'ghosts' | 'merchants' | 'patrols' | 'hunters' | 'hostile' | 'confederacy' | 'any';

function shipFits(game: Game, me: ShipEntity, o: ShipEntity, k: ShipKind): boolean {
  if (o.isPlayer || !o.alive || o.docked || o.ghost || o.surrendered || o.prize || o.npcRole === 'beast' || o.npcRole === 'boss' || o.zoneBoss || o.cls.monster) return false;
  switch (k) {
    case 'pirates':
      return o.npcRole === 'pirate';
    case 'choir':
      return o.faction === 'choir';
    case 'ghosts':
      return o.npcRole === 'ghost';
    case 'merchants':
      return o.npcRole === 'merchant';
    case 'patrols':
      return o.npcRole === 'patrol' || o.npcRole === 'hunter';
    case 'hunters':
      return o.npcRole === 'hunter';
    case 'confederacy':
      return o.faction === 'confederacy';
    case 'hostile':
      return o.npcRole === 'pirate' || o.npcRole === 'ghost' || game.isHostile(o, me);
    case 'any':
      return true;
  }
}

/** The live ships of a kind within her lookout's reach. */
function liveShips(game: Game, s: PlayerSession, k: ShipKind, pred: (o: ShipEntity) => boolean = () => true): Cand[] {
  const me = s.ship;
  const here = hereOf(game, s);
  if (!me || !here) return [];
  const out: Cand[] = [];
  game.forShipsNear(here.x, here.y, ROUTE_VIEW, (o) => {
    if (o.id === me.id || !shipFits(game, me, o, k) || !pred(o)) return;
    if (Math.hypot(o.state.x - here.x, o.state.y - here.y) > ROUTE_VIEW) return;
    out.push({ x: o.state.x, y: o.state.y, r: 250, kind: 'ships', name: k, ship: o.id });
  });
  return out;
}

/** The waters such ships put out in (traffic.ts MIX: no pirates or hunters in the Crown's waters, no patrols in the
 *  lawless; the ghosts in the drowned seas; the Choir's in its tides). */
const SPAWN: Record<ShipKind, (r: RegionId, safety: Safety) => boolean> = {
  pirates: (_r, sf) => sf !== 'safe',
  confederacy: (_r, sf) => sf !== 'safe',
  hunters: (_r, sf) => sf !== 'safe',
  hostile: (_r, sf) => sf !== 'safe',
  patrols: (_r, sf) => sf !== 'lawless',
  merchants: () => true,
  any: () => true,
  ghosts: (r) => r === 'drowned_crown' || r === 'dead_mans_expanse' || r === 'the_abyss',
  choir: (r) => r === 'drowned_crown' || r === 'dead_mans_expanse' || r === 'the_abyss',
};

/** The heart of each square of the sea whose waters pass (the hunting grounds: a square, not a region's far heart). */
function squares(game: Game, pred: (r: RegionId) => boolean, k: string, w = 1.15): Cand[] {
  const out: Cand[] = [];
  for (const sq of sectorGrid(game.world)) {
    if (!pred(sq.region)) continue;
    const x = (sq.sx + 0.5) * SECTOR_SIZE, y = (sq.sy + 0.5) * SECTOR_SIZE;
    if (game.regionAt(x, y) !== sq.region) continue;
    out.push({ x, y, r: 1500, kind: 'region', name: k, w });
  }
  return out;
}

/** The Choir where it is now: the invasion's gathering, its tides' patrols. */
function choirEvents(game: Game): Cand[] {
  const out: Cand[] = [];
  const cur = game.invasions.store?.cur;
  if (cur && cur.startAt <= game.wallNow() + 3600_000) out.push({ x: cur.x, y: cur.y, r: 1200, kind: 'event', name: 'invasion' });
  for (const [, ids] of game.invasions.patrols) {
    for (const id of ids) {
      const o = game.ships.get(id);
      if (o?.alive) out.push({ x: o.state.x, y: o.state.y, r: 250, kind: 'ships', name: 'choir', ship: o.id, w: 1.1 });
    }
  }
  return out;
}

/** Ships of a kind: one in sight, else the Choir's gathering (for its ships), else the waters they put out in. */
function hunt(game: Game, s: PlayerSession, k: ShipKind, region?: RegionId, pred?: (o: ShipEntity) => boolean): Cand[] {
  const near = liveShips(game, s, k, (o) => (!region || o.region === region) && (!pred || pred(o)));
  if (near.length) return near;
  if (k === 'choir') {
    const ev = choirEvents(game);
    if (ev.length) return ev;
  }
  return squares(game, (r) => (!region || r === region) && SPAWN[k](r, REGIONS[r].safety), region ?? k);
}

/** The sea's beasts of a group (or any): one alive, else the waters they swim in. */
function beasts(game: Game, group?: BeastGroup | 'any'): Cand[] {
  const fits = (id: string) => !group || group === 'any' || BEASTS[id as keyof typeof BEASTS]?.group === group;
  const out: Cand[] = [];
  for (const b of beastsAlive(game)) {
    const id = beastOfClass(b.loadout.classId as never);
    if (!id || !fits(id)) continue;
    out.push({ x: b.state.x, y: b.state.y, r: 300, kind: 'ships', name: `beast:${id}`, ship: b.id, hint: ROUTE_HINTS.beast });
  }
  if (out.length) return out;
  const seas = new Set<RegionId>();
  for (const def of Object.values(BEASTS)) if (fits(def.id)) for (const r of def.regions) seas.add(r);
  return squares(game, (r) => seas.has(r), 'beasts');
}

/** The wrecks her divers can go down to (else the nearest at all: a deeper bell wanted). */
function wrecks(game: Game, s: PlayerSession): Cand[] {
  const p = s.profile!;
  const ok: Cand[] = [], any: Cand[] = [];
  for (const w of game.wrecks) {
    const c: Cand = { x: w.x, y: w.y, r: 60, kind: 'wreck', name: 'wreck', hint: ROUTE_HINTS.dive };
    if (!canDive(game, s, w)) ok.push(c);
    else if (game.now - (p.explore.dived[w.id] ?? -1e9) >= 7200) any.push(c);
  }
  return ok.length ? ok : any;
}

/** Her trade's water: the fishing, by the tackle she carries. */
function fishing(game: Game, s: PlayerSession): Resolved {
  const p = s.profile!;
  const m = fishingView(p).method;
  if (!m) return { cands: ports(game).map((c) => ({ ...c, hint: ROUTE_WORDS.noTackle })) };
  const here = hereOf(game, s)!;
  if (m === 'net') {
    const out: Cand[] = shoalsOf(game).map((sh) => ({ x: sh.x, y: sh.y, r: Math.max(60, sh.r * 0.6), kind: 'shoal' as const, name: 'shoal', hint: ROUTE_HINTS.net }));
    for (const f of findsOf(game, s)) if (f.kind === 'gulls') out.push({ x: f.x, y: f.y, r: 80, kind: 'shoal', name: 'gulls', hint: ROUTE_HINTS.net });
    if (out.length) return { cands: out };
    // no shoal on the sea: the coasts the shoals keep to (the gulls show over one as she sails)
    return { cands: islands(game, () => true).map((c) => ({ ...c, kind: 'shoal' as const, name: 'coast', r: c.r + 400, act: undefined, hint: ROUTE_HINTS.net, w: 1.2 })) };
  }
  if (m === 'trap') return { cands: islands(game, () => true).map((c) => ({ ...c, r: c.r + 600, act: undefined, hint: ROUTE_HINTS.trap })) };
  // the rod, the deep line, the lamp: open water away from land — the nearest open-sea point on the four points
  // of the compass a few kilometres out
  const out: Cand[] = [];
  for (const k of [0, 3500, 7000]) {
    for (let a = 0; a < 8; a++) {
      const x = here.x + Math.cos((a * Math.PI) / 4) * k, y = here.y + Math.sin((a * Math.PI) / 4) * k;
      if (openWater(game, x, y)) out.push({ x, y, r: 400, kind: 'place', name: 'open_sea', hint: ROUTE_HINTS[m === 'deep' ? 'deep' : m === 'lamp' ? 'lamp' : 'rod'] });
    }
    if (out.length) break;
  }
  return out.length ? { cands: out } : { none: ROUTE_WORDS.none };
}

/** No island within 3 km. */
function openWater(game: Game, x: number, y: number): boolean {
  for (const i of game.world.islands) if (Math.hypot(i.x - x, i.y - y) < i.radius + 3000) return false;
  return x > 3000 && y > 3000 && x < 93_000 && y < 93_000;
}

// ------------------------------------------------------------------ the goals

// ------------------------------------------------------------------ near the port (questlocal.ts)

/** A port's goal's places kept near the port (owner, 2026-10-18: «все что берется в портах, должно делаться недалеко
 *  от них, в районе 1,5км максимум»): the ones within LOCAL_R of it; none there — what is fought or caught put out
 *  there (`make`); nothing to be had there either — the nearest of them to the port, not to her. */
function localize(game: Game, home: Home, cands: Cand[], make: () => Cand[]): Cand[] {
  // (not the sea's hunting grounds, nor «the coasts the shoals keep to» when no shoal is afloat: a place, not a guess)
  const inside = cands.filter((c) => c.kind !== 'region' && c.name !== 'coast' && nearHome(home, c.x, c.y, c.r));
  if (inside.length) return inside;
  const made = make();
  if (made.length) return made;
  const by = (c: Cand) => Math.hypot(c.x - home.x, c.y - home.y);
  return [...cands].sort((a, b) => by(a) - by(b)).slice(0, 3);
}

const shipCand = (o: ShipEntity, hint?: string): Cand => (o.npcRole === 'beast'
  ? { x: o.state.x, y: o.state.y, r: 300, kind: 'ships', name: `beast:${beastOfClass(o.loadout.classId as never) ?? 'shark'}`, ship: o.id, hint: ROUTE_HINTS.beast }
  : { x: o.state.x, y: o.state.y, r: 250, kind: 'ships', name: o.npcRole === 'merchant' ? 'merchants' : o.npcRole === 'ghost' ? 'ghosts' : 'pirates', ship: o.id, ...(hint ? { hint } : {}) });

/** Her trade's place near a port: the harbour's own shoals for a net, its water for a rod or a lamp, its shore for pots. */
function localFishing(game: Game, s: PlayerSession, home: Home): Cand[] {
  const m = fishingView(s.profile!).method;
  if (!m) return [];
  if (m === 'net') {
    const id = home.port ?? `isle:${home.island ?? 0}`;
    return ensurePortShoals(game, { id, x: home.x, y: home.y }).map((sh) => ({ x: sh.x, y: sh.y, r: Math.max(60, sh.r * 0.6), kind: 'shoal' as const, name: 'shoal', hint: ROUTE_HINTS.net }));
  }
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI) / 4 + (k >> 3) * 0.4, d = 700 + (k >> 3) * 250;
    const x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d;
    if (!openSea(game, x, y)) continue;
    return [{ x, y, r: 300, kind: 'place', name: m === 'trap' ? 'coast' : 'open_sea', hint: ROUTE_HINTS[m === 'deep' ? 'deep' : m === 'lamp' ? 'lamp' : m === 'trap' ? 'trap' : 'rod'] }];
  }
  return [];
}

/** A quest's step: where it is done — a port's quest's step done anywhere, near its port. */
function questPlaces(game: Game, s: PlayerSession, id: string): Resolved {
  const res = questPlacesAnywhere(game, s, id);
  const qs = s.profile!.quests.active.find((q) => q.id === id);
  if (!qs || !('cands' in res)) return res;
  const home = localHomeOf(game, qs);
  if (!home) return res;
  const st = QUESTS_BY_ID[id].steps[qs.step];
  const hint = st.type === 'board' || st.type === 'prize' ? ROUTE_HINTS.board : undefined;
  return { cands: localize(game, home, res.cands, () => (st.type === 'catch' ? localFishing(game, s, home) : ensureQuarry(game, s, qs, true).map((o) => shipCand(o, hint)))) };
}

/** A quest's step: where it is done, anywhere on the sea. */
function questPlacesAnywhere(game: Game, s: PlayerSession, id: string): Resolved {
  const p = s.profile!;
  const qs = p.quests.active.find((q) => q.id === id);
  // docs/36: a campaign quest behind her is done (the campaign keeps its place, not a list of ids)
  const cmp = QUESTS_BY_ID[id]?.campaign;
  if (!qs) return p.quests.done.includes(id) || (cmp && cmp.slot < (p.campaign?.at ?? 0)) ? { done: true } : { none: ROUTE_WORDS.unknown };
  const st = QUESTS_BY_ID[id]?.steps[qs.step];
  if (!st) return { done: true };
  const ship = s.ship!;
  const t = game.questTargets(s)[id];
  switch (st.type) {
    case 'sink': {
      if (cmp) {
        const foes = campaignFoes(game, s).map((fid) => game.ships.get(fid)!).map((o): Cand => ({ x: o.state.x, y: o.state.y, r: 250, kind: 'ships', name: 'pirates', ship: o.id, w: 0.7 }));
        if (foes.length) return { cands: foes };
        if (st.near) return { cands: [{ x: st.near.x, y: st.near.y, r: Math.round(st.near.r * 0.6), kind: 'region', name: 'campaign' }] };
      }
      if (t && !st.region) return { cands: [{ x: t.x, y: t.y, r: t.r ?? 250, kind: 'ships', name: 'leader', ...(qs.leader !== undefined ? { ship: qs.leader } : {}) }] };
      const k: ShipKind = st.role === 'pirate' ? 'pirates' : st.role === 'ghost' ? 'ghosts' : st.role === 'merchant' ? 'merchants' : st.role === 'patrol' ? 'patrols' : st.role === 'hunter' ? 'hunters' : 'hostile';
      return { cands: hunt(game, s, k, st.region, st.minTier ? (o) => o.cls.tier >= st.minTier! : undefined) };
    }
    case 'board':
    case 'prize': {
      // docs/36: the campaign's own foes first (they come for her)
      const foes = st.type === 'board' && cmp ? campaignFoes(game, s).map((fid) => game.ships.get(fid)!).map((o): Cand => ({ x: o.state.x, y: o.state.y, r: 250, kind: 'ships', name: 'pirates', ship: o.id, hint: ROUTE_HINTS.board, w: 0.7 })) : [];
      // docs/36: the location's waters, where its fight puts out
      if (st.type === 'board' && st.near) return { cands: foes.length ? foes : [{ x: st.near.x, y: st.near.y, r: Math.round(st.near.r * 0.6), kind: 'region', name: 'campaign' }] };
      return { cands: [...foes, ...hunt(game, s, 'pirates'), ...liveShips(game, s, 'merchants').map((c) => ({ ...c, w: 1.4, hint: ROUTE_HINTS.board }))] };
    }
    case 'named': {
      // a wanted captain at sea (the Hunters' Guild's), else the pirates' waters
      const out: Cand[] = [];
      for (const n of liveNamed(game)) {
        const o = game.ships.get(n.ship);
        if (o?.alive) out.push({ x: o.state.x, y: o.state.y, r: 250, kind: 'ships', name: 'pirates', ship: o.id });
      }
      return { cands: out.length ? out : hunt(game, s, 'pirates') };
    }
    case 'rescue': {
      // a castaway on a spar of hers, else the open water where they are met
      const cast = castawaysOf(game, s).map((c): Cand => ({ x: c.x, y: c.y, r: 80, kind: 'place', name: 'castaway' }));
      return { cands: cast.length ? cast : squares(game, () => true, 'sea', 1.3) };
    }
    case 'tribute':
      // a merchant to stop and make pay (the Brethren's raid, docs/12 P6)
      return { cands: hunt(game, s, 'merchants') };
    case 'claim':
      // docs/36: an island of her own — the nearest she may claim; the opening's town, its own island (owner, 2026-10-19)
      if (st.island !== undefined && !ownIsland(game, s.accountId)) return { cands: islands(game, (i) => i.id === st.island, 'land') };
      return { cands: islands(game, (i) => !i.portId, 'land') };
    case 'buy':
      // the opening's lesson of the shops: the start's harbour, the quest's (any harbour's shops do it, the words name this one)
      return { cands: [portCand(game.portById(QUESTS_BY_ID[id].port) ?? game.world.ports[0])] };
    case 'neutral': {
      // the opening: a standing stack of the sea's creatures on the lane (its `near`), else the nearest standing one
      const up = (x: number, y: number, r: number): Cand[] => roamersAbout(game, x, y, r).filter((sp) => roamUp(game, sp.id) && roamFighter(game, sp.id) === null).map((sp) => {
        const w = roamWhere(game, sp);
        return { x: w.x, y: w.y, r: 60, kind: 'place' as const, name: 'stack' };
      });
      const lane = st.near ? up(st.near.x, st.near.y, st.near.r) : [];
      return { cands: lane.length ? lane : up(ship.state.x, ship.state.y, 6000) };
    }
    case 'recruit':
      return { cands: ports(game) };
    case 'deliver': {
      const port = game.portById(st.port);
      if (!port) break;
      if ((ship.cargo[st.good] ?? 0) >= st.qty) return { cands: [portCand(port)] };
      // not aboard: a port that sells it, else the port that waits for it (they say what they want there)
      const sells = game.world.ports.filter((pt) => ownStockOf(game, p, pt, st.good) >= st.qty && pt.id !== st.port); // her own stock (ownstock.ts)
      return { cands: sells.length ? sells.map((pt) => portCand(pt)) : [portCand(port)] };
    }
    case 'chart':
      return { cands: islands(game, (i) => !p.discovered.includes(i.id)) };
    case 'catch':
      return fishing(game, s);
    case 'beast': {
      if (st.near) {
        const n = st.near;
        const here = beasts(game, st.group as BeastGroup | 'any').filter((c) => c.ship !== undefined && Math.hypot(c.x - n.x, c.y - n.y) <= n.r + 1500);
        return { cands: here.length ? here : [{ x: n.x, y: n.y, r: Math.round(n.r * 0.6), kind: 'region', name: 'beasts' }] };
      }
      return { cands: beasts(game, st.group as BeastGroup | 'any') };
    }
    case 'dive': {
      const w = st.wreck !== undefined ? game.wrecks[st.wreck] : undefined;
      if (w) return { cands: [{ x: w.x, y: w.y, r: 60, kind: 'wreck', name: 'wreck', hint: ROUTE_HINTS.dive }] };
      return { cands: wrecks(game, s) };
    }
    case 'sell_contraband':
      if (!st.port) return { cands: ports(game, (pt) => pt.blackMarket) };
      break;
    case 'letters':
      return { cands: findsOf(game, s).filter((f) => f.kind === 'bottle').map((f) => ({ x: f.x, y: f.y, r: 80, kind: 'place' as const, name: 'bottle' })) };
    case 'customs':
      return { cands: hunt(game, s, 'patrols') };
    default:
      break;
  }
  if (t) {
    const isl = t.island !== undefined ? game.world.islands[t.island] : undefined;
    const name = t.port ? game.portById(t.port)?.name ?? '' : isl ? isl.name : t.region ? REGIONS[t.region].name : 'place';
    const kind: RouteView['kind'] = t.port ? 'port' : st.type === 'lair' ? 'lair' : isl ? 'island' : t.region ? 'region' : 'place';
    return { cands: [{ x: t.x, y: t.y, r: t.r ?? 400, kind, name, ...(t.act ? { act: t.act } : {}), ...(t.port ? { port: t.port } : {}), ...(t.island !== undefined ? { island: t.island } : {}), ...(t.region ? { region: t.region } : {}) }] };
  }
  return { none: ROUTE_WORDS.noPlace };
}

/** A contract of a port's board. */
function contractPlaces(game: Game, s: PlayerSession, id: string): Resolved {
  const c = s.profile!.contracts.find((x) => x.id === id);
  if (!c) return { done: true };
  const ship = s.ship!;
  if (c.kind === 'bounty') {
    // a port's bounty: about its port (questlocal.ts), its raider put out there when none is
    const cands = hunt(game, s, c.targetFaction === 'confederacy' ? 'confederacy' : 'pirates');
    const pt = game.portById(c.fromPort);
    if (!pt) return { cands };
    const home: Home = { x: pt.x, y: pt.y, port: pt.id };
    return { cands: localize(game, home, cands, () => ensureDailyQuarry(game, s, `c:${c.id}`, Math.max(1, (c.kills ?? 1) - (c.progress ?? 0)), home).map((o) => shipCand(o))) };
  }
  const to = c.toPort ? game.portById(c.toPort) : undefined;
  const from = game.portById(c.fromPort);
  if (c.kind === 'delivery' && c.good && (ship.cargo[c.good] ?? 0) < (c.qty ?? 1) && from) return { cands: [portCand(from)] };
  if (to) return { cands: [portCand(to)] };
  return from ? { cands: [portCand(from)] } : { none: ROUTE_WORDS.none };
}

/** A day's order: about the port nearest her (owner, 2026-10-18 — the day's work near a harbour, not across the sea). */
function dailyPlaces(game: Game, s: PlayerSession, kind: string): Resolved {
  const res = dailyPlacesAnywhere(game, s, kind);
  const o = s.profile!.daily.orders.find((x) => x.kind === kind);
  const here = hereOf(game, s);
  if (!o || !here || !('cands' in res) || kind === 'ports' || kind === 'contraband' || kind === 'chart' || kind === 'land') return res;
  const pt = game.nearestPort(here.x, here.y, (p) => !p.raft);
  if (!pt) return res;
  const home: Home = { x: pt.x, y: pt.y, port: pt.id };
  const hint = kind === 'board' || kind === 'prize' ? ROUTE_HINTS.board : undefined;
  return { cands: localize(game, home, res.cands, () => (kind === 'fish' ? localFishing(game, s, home) : ensureDailyQuarry(game, s, kind, Math.max(1, o.need - (o.progress ?? 0)), home).map((x) => shipCand(x, hint)))) };
}

function dailyPlacesAnywhere(game: Game, s: PlayerSession, kind: string): Resolved {
  const p = s.profile!;
  const o = p.daily.orders.find((x) => x.kind === kind);
  if (!o || o.done) return { done: true };
  switch (o.kind as DailyKind) {
    case 'sink':
      return { cands: hunt(game, s, 'hostile') };
    case 'sink_pirates':
      return { cands: hunt(game, s, 'pirates') };
    case 'board':
    case 'prize':
      return { cands: [...hunt(game, s, 'pirates'), ...liveShips(game, s, 'merchants').map((c) => ({ ...c, w: 1.4, hint: ROUTE_HINTS.board }))] };
    case 'land':
      return { cands: islands(game, (i) => !i.portId, 'land') };
    case 'chart':
      return { cands: islands(game, (i) => !p.discovered.includes(i.id)) };
    case 'ports': {
      const seen = new Set(o.seen ?? []);
      if (s.ship?.docked) seen.add(s.ship.docked);
      return { cands: ports(game, (pt) => !seen.has(pt.id)) };
    }
    case 'contraband':
      return { cands: ports(game, (pt) => pt.blackMarket) };
    case 'dive':
      return { cands: wrecks(game, s) };
    case 'fish':
      return fishing(game, s);
    case 'beast':
      return { cands: beasts(game, 'any') };
    case 'fleet':
      return { cands: hunt(game, s, 'pirates') };
  }
  return { none: ROUTE_WORDS.none };
}

function worldGoalPlaces(game: Game, s: PlayerSession, id: number): Resolved {
  const g = worldGoals(game).goals.find((x) => x.id === id);
  if (!g || g.done) return { done: true };
  switch (g.kind) {
    case 'choir':
      return { cands: hunt(game, s, 'choir') };
    case 'pirates':
      return { cands: hunt(game, s, 'pirates') };
    case 'deliver': {
      const pt = g.port ? game.portById(g.port) : undefined;
      return pt ? { cands: [portCand(pt)] } : { none: ROUTE_WORDS.none };
    }
    case 'beasts':
      return { cands: beasts(game, 'any') };
    case 'catch':
      return fishing(game, s);
  }
  return { none: ROUTE_WORDS.none };
}

/** The week's challenge: its deed, in its sea. */
function weeklyPlaces(game: Game, s: PlayerSession, kind: string, region: RegionId): Resolved {
  if (!REGIONS[region]) return { none: ROUTE_WORDS.unknown };
  if (kind === 'pirates') return { cands: hunt(game, s, 'pirates', region) };
  if (kind === 'prizes') return { cands: hunt(game, s, 'pirates', region) };
  if (kind === 'trade') return { cands: ports(game, (pt) => pt.region === region) };
  if (kind === 'catch') {
    const f = fishing(game, s);
    if ('cands' in f) {
      const inside = f.cands.filter((c) => game.regionAt(c.x, c.y) === region);
      if (inside.length) return { cands: inside };
    }
  }
  return { cands: squares(game, (r) => r === region, region, 1).map((c) => ({ ...c, region })) };
}

function commonPlaces(game: Game, s: PlayerSession): Resolved {
  const v = commonView(game, s.accountId);
  return v.done ? { done: true } : commonFor(game, s, v.kind);
}

function commonFor(game: Game, s: PlayerSession, kind: string | null): Resolved {
  const p = s.profile!;
  switch (kind) {
    case 'pirates':
      return { cands: hunt(game, s, 'pirates') };
    case 'charts':
      return { cands: islands(game, (i) => !p.discovered.includes(i.id)) };
    case 'landings':
      return { cands: islands(game, (i) => !i.portId, 'land') };
    case 'prizes':
    case 'boardings':
      return { cands: [...hunt(game, s, 'pirates'), ...liveShips(game, s, 'merchants').map((c) => ({ ...c, w: 1.4, hint: ROUTE_HINTS.board }))] };
  }
  return { none: ROUTE_WORDS.none };
}

/** A captain's goal (onboarding.ts GOALS). */
function captainGoalPlaces(game: Game, s: PlayerSession, id: string): Resolved {
  const p = s.profile!;
  const g = p.tutorial?.goals;
  if (g && !g.active.includes(id)) return g.done.includes(id) ? { done: true } : { none: ROUTE_WORDS.unknown };
  switch (id) {
    case 'g_contract':
      // the board is every harbour's; a bounty only at a lawful one — the nearest harbour of a lawful flag first
      return { cands: game.world.ports.filter((pt) => !pt.raft).map((pt) => portCand(pt, pt.faction === 'confederacy' || pt.faction === 'choir' ? 1.5 : 1)) };
    case 'g_fog_run':
      return { cands: ports(game, (pt) => pt.blackMarket) };
    case 'g_first_board':
    case 'g_first_prize':
      return { cands: [...hunt(game, s, 'pirates'), ...liveShips(game, s, 'merchants').map((c) => ({ ...c, w: 1.4, hint: ROUTE_HINTS.board }))] };
    case 'g_sink':
      return { cands: hunt(game, s, 'hostile') };
    case 'g_first_island':
      return { cands: islands(game, (i) => !p.discovered.includes(i.id)) };
    case 'g_first_dive':
      return { cands: wrecks(game, s) };
    case 'g_duel':
      return { none: ROUTE_WORDS.duel };
    case 'g_module':
    case 'g_insure':
    case 'g_profit':
      return { cands: ports(game, (pt) => !pt.raft) };
    case 'g_level5':
      return { cands: hunt(game, s, 'hostile') };
    case 'g_talent':
      return { none: ROUTE_WORDS.noPlace };
  }
  return { none: ROUTE_WORDS.none };
}

function bossPlaces(game: Game, region?: RegionId): Resolved {
  const out: Cand[] = [];
  for (const [r, l] of game.zoneBosses.live) {
    if (region && r !== region) continue;
    const b = game.ships.get(l.id);
    if (b?.alive) out.push({ x: b.state.x, y: b.state.y, r: 400, kind: 'boss', name: b.captainName || REGIONS[r].name, ship: b.id });
  }
  if (!region) {
    for (const f of game.bosses.fights.values()) {
      const b = game.ships.get(f.id);
      if (b?.alive) out.push({ x: b.state.x, y: b.state.y, r: 500, kind: 'boss', name: f.def.name, ship: b.id });
    }
  }
  if (out.length) return { cands: out };
  // not up: its sea
  if (region) return { cands: squares(game, (r) => r === region, region, 1) };
  return { none: ROUTE_WORDS.none };
}

/** Every key a goal is routed by (the client builds them; anything else is refused). */
export const GOAL_KEYS = ['q', 'c', 't', 'd', 'w', 'r', 'cm', 'inv', 'g', 'f', 'b', 'zb', 'boss', 'dv'] as const;

/** The places a goal's key names now. */
export function resolveGoal(game: Game, s: PlayerSession, key: string): Resolved {
  if (!s.profile || !s.ship) return { none: ROUTE_WORDS.noShip };
  const [kind, ...rest] = String(key).slice(0, 80).split(':');
  const id = rest.join(':');
  switch (kind) {
    case 'q':
      return questPlaces(game, s, id);
    case 'c':
      return contractPlaces(game, s, id);
    case 't': {
      const t = activeTasks(game).find((x) => x.id === Number(id));
      if (!t || t.done.has(s.accountId)) return { done: true };
      if (t.kind !== 'wreck') {
        // the nest's or the haunt's ships themselves, while they are afloat
        const live = t.pirates.map((sid) => game.ships.get(sid)).filter((o): o is ShipEntity => !!o?.alive);
        if (live.length) return { cands: live.map((o) => ({ x: o.state.x, y: o.state.y, r: 250, kind: 'ships' as const, name: t.kind === 'haunt' ? 'ghosts' : 'pirates', ship: o.id })) };
      }
      return { cands: [{ x: t.x, y: t.y, r: 400, kind: 'event', name: t.island }] };
    }
    case 'd':
      return dailyPlaces(game, s, id);
    case 'w':
      return worldGoalPlaces(game, s, Number(id));
    case 'r': {
      const [wk, region] = id.split(':');
      return weeklyPlaces(game, s, wk, region as RegionId);
    }
    case 'cm':
      return commonPlaces(game, s);
    case 'inv': {
      const ev = choirEvents(game);
      return ev.length ? { cands: ev } : { cands: hunt(game, s, 'choir') };
    }
    case 'g':
      return captainGoalPlaces(game, s, id);
    case 'f':
      return fishing(game, s);
    case 'b':
      return { cands: beasts(game, (id || 'any') as BeastGroup | 'any') };
    case 'dv':
      return { cands: wrecks(game, s) };
    case 'zb':
      return bossPlaces(game, REGION_IDS.includes(id as RegionId) ? (id as RegionId) : undefined);
    case 'boss':
      return bossPlaces(game);
    case 'p': {
      // a harbour by name (owner, 2026-10-21: «не продаётся здесь» — the nearest port that sells it, a course there)
      const pt = game.portById(id);
      if (!pt) return { none: ROUTE_WORDS.unknown };
      if (s.ship.docked === pt.id) return { done: true };
      return { cands: [portCand(pt)] };
    }
    case 'own': {
      // the island button (owner, 2026-10-19: «кнопка острова… или я еще остров не отрыл»): her own island, or before
      // she holds one the nearest wild island to found her town on (docs/29: any but a port's, the first free)
      const h = ownIsland(game, s.accountId);
      return { cands: islands(game, h ? (i) => i.id === h.island : (i) => !i.portId, 'land') };
    }
  }
  return { none: ROUTE_WORDS.unknown };
}

/** The nearest place of a goal now: the place, the goal met, or why none. */
export function routeFor(game: Game, s: PlayerSession, key: string, again = false): RouteView | { done: true } | { none: string } {
  const r = resolveGoal(game, s, key);
  if (!('cands' in r)) return r;
  return pickNearest(game, s, r.cands, again) ?? { none: ROUTE_WORDS.none };
}

// ------------------------------------------------------------------ the run

interface Follow {
  key: string;
  view: RouteView;
  /** When the helmsman was last given this course (sea's clock), and the course. */
  sentAt: number;
  sent: { x: number; y: number } | null;
  checkAt: number;
  /** When she came to a ship of the goal (or a fight broke the course off): the next is sailed for once the sea is quiet. */
  reachedAt: number | null;
}

const runs = new WeakMap<Game, Map<PlayerSession, Follow>>();
const taps = new WeakMap<PlayerSession, { key: string; at: number }>();

function book(game: Game): Map<PlayerSession, Follow> {
  let m = runs.get(game);
  if (!m) runs.set(game, (m = new Map()));
  return m;
}

/** The run to a goal she has, if any (tests, the HUD). */
export function routeOf(game: Game, s: PlayerSession): { key: string; view: RouteView } | null {
  const f = runs.get(game)?.get(s);
  return f ? { key: f.key, view: f.view } : null;
}

/** How near the helmsman brings her to a place of this reach. */
function arriveOf(v: RouteView): number {
  // (owner, 2026-10-22: the reaches are thirty metres from her hull now — reach.ts — so the run ends inside them: a
  // harbour's anchorage within REACH_DOCK, a thing within REACH_OBJ)
  if (v.act === 'dock') return REACH_DOCK - 10;
  return Math.max(24, Math.min(AUTOSAIL_ARRIVE, Math.round(v.r * 0.4)));
}

/** The place said to her screen (owner, 2026-10-18: «всегда должно быть показано направление линией и путь»): while
 *  no helmsman sails for it (in port, refused a moment, a course broken off) with the way there by the water — the
 *  helmsman's own run sends his plan itself. */
function sendView(game: Game, s: PlayerSession, f: Follow): void {
  const ship = s.ship;
  const run = autosailOf(ship);
  let view = f.view;
  if (ship && !(run && Math.hypot(run.x - view.x, run.y - view.y) < 60)) {
    const here = hereOf(game, s);
    const p = here ? planFrom(game, ship, here.x, here.y, view.x, view.y) : null;
    if (p && p.length >= 2) view = { ...view, path: pathView(p) };
  }
  game.sendTo(s, { t: 'route', key: f.key, on: true, view });
}

/** Gives the helmsman the course (null when he has it, else why not). */
function steer(game: Game, s: PlayerSession, f: Follow): string | null {
  const e = startAutosail(game, s, f.view.x, f.view.y, undefined, arriveOf(f.view));
  f.sentAt = game.now;
  f.sent = e === null ? { x: f.view.x, y: f.view.y } : null;
  return e;
}

/** A tap on a goal: the nearest place it is done, and the helmsman takes her there. Null when the run is on (or the
 *  same tap again); else why not (the toast's words). */
export function gotoGoal(game: Game, s: PlayerSession, key: string): string | null {
  const k = String(key ?? '').slice(0, 80);
  const last = taps.get(s);
  // One request per tap: a finger that bounces, a button pressed twice in a second, do nothing more.
  if (last && last.key === k && game.now - last.at < ROUTE_TAP) return null;
  taps.set(s, { key: k, at: game.now });
  const r = routeFor(game, s, k);
  if ('done' in r) {
    endRoute(game, s, 'done');
    return ROUTE_WORDS.done;
  }
  if ('none' in r) {
    game.sendTo(s, { t: 'route', key: k, on: false, why: 'none' });
    return r.none;
  }
  // in the very port the goal asks for (the board of «Взять контракт», a delivery's quay): nowhere to sail
  if (s.ship!.docked && r.port === s.ship!.docked) {
    game.sendTo(s, { t: 'route', key: k, on: false, why: 'none' });
    // a quest's «arrive at» step taken in this very port: she must put in again (quests.ts, the fresh dock)
    const qs = k.startsWith('q:') ? s.profile!.quests.active.find((a) => a.id === k.slice(2)) : undefined;
    const st = qs ? QUESTS_BY_ID[qs.id]?.steps[qs.step] : undefined;
    game.sendTo(s, { t: 'toast', msg: st?.type === 'visit' ? ROUTE_WORDS.again : ROUTE_WORDS.here, kind: 'info' });
    return null;
  }
  const f: Follow = { key: k, view: r, sentAt: game.now, sent: null, checkAt: game.now + ROUTE_CHECK, reachedAt: null };
  const m = book(game);
  m.set(s, f);
  const ship = s.ship!;
  if (ship.docked) {
    sendView(game, s, f); // (the way from her harbour)
    game.sendTo(s, { t: 'toast', msg: ROUTE_WORDS.afterPort, kind: 'info' });
    return null;
  }
  game.sendTo(s, { t: 'route', key: k, on: true, view: r });
  if (Math.hypot(r.x - ship.state.x, r.y - ship.state.y) <= arriveOf(r) + 20) return null; // there already
  const e = steer(game, s, f);
  if (e) sendView(game, s, f); // refused a moment (a hostile sail, a weak hull): the way is drawn all the same
  // (refused — a hostile sail, a weak hull: the run stays and the course is set once he can; she is told why)
  return e;
}

/** The run ends (the goal met, her hand, the pill): said to the client. */
export function endRoute(game: Game, s: PlayerSession, why: 'done' | 'off'): void {
  const m = runs.get(game);
  const f = m?.get(s);
  if (!f) return;
  m!.delete(s);
  game.sendTo(s, { t: 'route', key: f.key, on: false, why });
  if (why === 'done') {
    const run = autosailOf(s.ship);
    if (run && f.sent && Math.hypot(run.x - f.sent.x, run.y - f.sent.y) < 60) stopAutosail(game, s, 'arrived');
    game.sendTo(s, { t: 'toast', msg: ROUTE_WORDS.done, kind: 'good' });
  }
}

/** Her own course or the pill's stop: the run lets go (quietly: the client asked for it). */
export function cancelRoute(game: Game, s: PlayerSession): void {
  endRoute(game, s, 'off');
}

/** The stops that end a run (her hand, the yard's hull, a reef he cannot pass); a fight only breaks it off. */
const ENDING = new Set(['manual', 'off', 'helm', 'lost', 'hull', 'reef', 'stuck']);

/** Every tick (cheap: only the captains with a run, each looked at every ROUTE_CHECK seconds or when its ship moves). */
export function stepRoutes(game: Game): void {
  const m = runs.get(game);
  if (!m || !m.size) return;
  for (const [s, f] of m) {
    const ship = s.ship;
    if (!ship || !s.profile || s.disconnectedAt !== null || !game.sessions.has(s)) {
      m.delete(s);
      continue;
    }
    if (!ship.alive) {
      endRoute(game, s, 'off');
      continue;
    }
    const run = autosailOf(ship);
    // another course (her mark on the chart, «Атаковать», an order sailed to): the run lets go
    if (run && f.sent && Math.hypot(run.x - f.sent.x, run.y - f.sent.y) > 60 && !(f.view.ship !== undefined && Math.hypot(run.x - f.view.x, run.y - f.view.y) < 60)) {
      endRoute(game, s, 'off');
      continue;
    }
    if (!run && !ship.docked) {
      const st = lastStopOf(ship);
      if (st && st.at >= f.sentAt && ENDING.has(st.why)) {
        endRoute(game, s, 'off');
        continue;
      }
    }
    // a ship it follows: the course follows her every tick it moves far enough
    if (f.view.ship !== undefined) {
      const o = game.ships.get(f.view.ship);
      if (o?.alive && !o.docked) {
        if (Math.hypot(o.state.x - f.view.x, o.state.y - f.view.y) > 150) {
          f.view = { ...f.view, x: Math.round(o.state.x), y: Math.round(o.state.y) };
          if (run && f.sent) steer(game, s, f);
          sendView(game, s, f);
        }
      } else f.checkAt = game.now; // sunk or gone: the next one now
    }
    if (game.now < f.checkAt) continue;
    f.checkAt = game.now + ROUTE_CHECK;
    const r = routeFor(game, s, f.key, true);
    if ('done' in r) {
      endRoute(game, s, 'done');
      continue;
    }
    if ('none' in r) {
      // nothing left on the sea for it now: she keeps her course (if any) and the run lets go
      endRoute(game, s, 'off');
      continue;
    }
    const moved = Math.hypot(r.x - f.view.x, r.y - f.view.y) > 150 || r.ship !== f.view.ship;
    const gone = f.view.ship !== undefined && !game.ships.get(f.view.ship)?.alive;
    if (moved) {
      f.view = r;
      if (run && !ship.docked && Math.hypot(r.x - ship.state.x, r.y - ship.state.y) > arriveOf(r) + 20) steer(game, s, f); // (his plan is the line)
      sendView(game, s, f);
      if (gone) game.sendTo(s, { t: 'toast', msg: ROUTE_WORDS.retarget, kind: 'info' });
    }
    if (ship.docked) continue;
    const d = Math.hypot(f.view.x - ship.state.x, f.view.y - ship.state.y);
    const near = arriveOf(f.view) + 20;
    if (run) continue; // (a new place was steered for above, as it was said)
    // No course on: after a port (cast off), after a fight, after a ship of the goal reached and dealt with — the next
    // place is sailed for once the sea is quiet and her hand is off the wheel; never a place she is at.
    if (pausedCourse(ship)) continue; // the helmsman takes up the broken-off course himself
    if (d <= Math.max(near, f.view.r)) {
      if (f.view.ship !== undefined) f.reachedAt ??= game.now;
      continue;
    }
    const st = lastStopOf(ship);
    const arrivedHere = st?.why === 'arrived' && f.sent && Math.hypot(f.sent.x - f.view.x, f.sent.y - f.view.y) < 150 && st.at >= f.sentAt;
    if (arrivedHere && f.view.ship === undefined && !f.view.region) continue; // brought in: what is done here is hers
    if (game.now - helmTouched(ship) < 5) continue;
    if (steer(game, s, f) === null) f.reachedAt = null;
  }
}
