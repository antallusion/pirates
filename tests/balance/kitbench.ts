// The captains' kits at sea (docs/25 items 13–43): a fight of two equals of her ⚓, lying beam on at the close fight's
// distance, one firing every broadside she loads at the other till she sinks or strikes, by the game's own code and
// clock (game.step: the shot in flight, the effects and their ends, the strikes, the zones, the leaks and fires), with
// her captain's kit off or used as a captain who knows it uses it (castKit: each ability when it serves, the ultimate
// when her resolve is full, the combos in their windows). The seconds from her first broadside to the end, with and
// without the kit, give the share of the fight her kit takes off it; the kit on the side fired upon gives what her
// defence adds to it. Used by tools/balance-sea.ts --abilities and tests/balance/captains-sea.test.ts.

import type { CaptainId } from '../../shared/src/data/captains.ts';
import { CAPTAINS } from '../../shared/src/data/captains.ts';
import { Rng } from '../../shared/src/rng.ts';
import { fireBroadside } from '../../server/src/game/combat.ts';
import { useAbility } from '../../server/src/game/abilities.ts';
import { gainDread } from '../../server/src/game/mind.ts';
import { kitNums } from '../../server/src/game/seaskill.ts';
import type { Game } from '../../server/src/game/Game.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { captainShip, clearSea, fightDistance, spot } from './seakit.ts';
import { depthAt, isLand } from '../../shared/src/world/worldgen.ts';
import type { Gear } from './seakit.ts';

export interface KitSide {
  anchor: number;
  gear: Gear;
  captain: CaptainId;
  level?: number;
  /** Her kit in use (her passive with it); off, she fights as a captain without one. */
  kit: boolean;
  /** Only these of her abilities (ids) are used (the rest kept); all when absent. */
  only?: string[];
  /** Her chosen facets (ability id @ rank → 'a' | 'b'). */
  facets?: Record<string, 'a' | 'b'>;
  /** Her glory past the cap (docs/19 E1): the mastery of her abilities. */
  glory?: number;
}

export interface KitFight {
  /** Seconds from the first broadside to the end, to a fraction of a reload (maxSec when she held). */
  sec: number;
  /** …as the clock had it. */
  raw: number;
  /** Her broadsides fired. */
  volleys: number;
  sunk: boolean;
  /** The abilities cast, by id. */
  casts: Record<string, number>;
}

/** The ram's run-in: her way into the mark as a share of her top speed (both under way, she does not meet her at rest). */
export const RAM_CLOSING = 0.7;
/** …and the time she needs to come about and run in again after a ram. */
export const RAM_AGAIN = 45;

/** One fight: `a` fires on `b` till `b` sinks or strikes. Either side's kit as asked; the sea's dice by `seed`. */
export function kitFight(game: Game, a: KitSide, b: KitSide, seed = 1, maxSec = 900): KitFight {
  clearSea(game);
  Object.assign(game.rng, new Rng(seed * 7919 + 13));
  // Lawless water (the Ashen Isles): two captains fight there as they please, and the Admiral's escort with them (a duel
  // bars every escort). Her mark lies downwind of her, beam on (the weather gauge is the Navigator's to hold).
  const { x, y } = lawlessWater(game);
  const A = captainShip(game, { anchor: a.anchor, gear: a.gear, captain: a.captain, level: a.level }, x, y).ship;
  const d = fightDistance(A);
  const wind = game.windFor(A).dir;
  const bx = x + Math.sin(wind) * d, by = y - Math.cos(wind) * d;
  const B = captainShip(game, { anchor: b.anchor, gear: b.gear, captain: b.captain, level: b.level }, bx, by).ship;
  for (const s of [A, B]) s.state.heading = wind - Math.PI / 2; // her starboard battery toward her mark
  const at = new Map([[A, [x, y]], [B, [bx, by]]] as const);
  for (const [s, side] of [[A, a], [B, b]] as const) {
    s.resolve = 0;
    s.dread = 0;
    s.region = game.regionAt(s.state.x, s.state.y);
    const p = game.profileOf(s)!;
    s.kitOff = !side.kit;
    (p as { facets?: Record<string, string> }).facets = { ...(side.facets ?? {}) };
    if (side.glory) p.throne = { ...(p.throne ?? {}), rank: side.glory } as never;
    s.recompute(game.now);
    s.hull = s.stats.hullMax;
  }
  const casts: Record<string, number> = {};
  const t0 = game.now;
  let first = -1, volleys = 0;
  const companies = [A, B].map((s) => game.sessionOf(s)?.profile?.company).filter((c) => !!c);
  // Down: sunk, or beaten to her last plank (a duel between captains ends there, the loser striking, pvp.ts).
  const down = (s: ShipEntity) => !s.alive || s.hull <= 1 || s.surrendered;
  const memo = { lastRam: -1e9, hullB: B.hull };
  // Her broadsides' moments and the hull left the moment each was fired (the fight's length to a fraction of a reload).
  const fires: [number, number][] = [];
  while (game.now - t0 < maxSec && !down(B)) {
    for (const s of [A, B]) {
      s.state.speed = 0;
      s.input = { rudder: 0, sailTarget: 0 };
      // (held where she lies: the sea's currents would part them in a long fight)
      const [px, py] = at.get(s)!;
      s.state.x = px;
      s.state.y = py;
      s.state.heading = wind - Math.PI / 2;
      game.grid.upsert(s.id, px, py);
    }
    // The dice's slow fires: a fire, a breach or a leak a ball starts burns on for many seconds and swung one fight of
    // equals by a third against the next; the bench's crews put them out at once (both kits alike), so what an ability
    // adds is not lost in them. (Her own leak — the Deep Call's — is an ability's, and runs.)
    if (B.leaks || B.effects.some((e) => e.id === 'fire' || e.id === 'breach')) {
      B.leaks = 0;
      B.water = 0;
      B.effects = B.effects.filter((e) => e.id !== 'fire' && e.id !== 'breach');
    }
    if (a.kit) castKit(game, A, B, a, casts, memo, 'attack');
    if (b.kit) castKit(game, B, A, b, casts, memo, 'defend');
    if (A.reload.starboard <= 0) {
      const why = fireBroadside(game, A, 'starboard', Math.hypot(B.state.x - A.state.x, B.state.y - A.state.y), { x: B.state.x, y: B.state.y }, 1, {});
      if (!why) {
        volleys++;
        if (first < 0) first = game.now;
        fires.push([game.now, B.hull]);
      }
    }
    escorts(game, A, B);
    // A one-sided fight: her Dread as if she had taken what she gave (both bleed alike in a fight of equals).
    if (A.captain === 'drowned' && a.kit && B.hull < memo.hullB) gainDread(game, A, ((memo.hullB - B.hull) / B.stats.hullMax) * 50);
    memo.hullB = B.hull;
    for (const c of companies) {
      c!.course = null;
      c!.mutiny = null;
      c!.loyalty = 100;
      c!.unrest = { phase: 0, t: 0 };
    }
    game.step();
  }
  return { sec: Math.round(fractional(fires, game.now, down(B), first >= 0 ? first : t0) * 10) / 10, raw: Math.round((game.now - (first >= 0 ? first : t0)) * 10) / 10, volleys, sunk: down(B), casts };
}

/** The fight's length to a fraction of a reload: a broadside that finished her with half its weight to spare finished a
 *  fight half a reload shorter than the one that took all of it (a whole broadside's step otherwise drowned what an
 *  ability adds in the noise of which broadside it was), and her first broadside's loading with it (n broadsides are n
 *  reloads: a fight of five is not «four»). Sunk by a fire or a leak between broadsides: as it came. */
function fractional(fires: [number, number][], end: number, sunk: boolean, first: number): number {
  const k = fires.length - 1;
  const load = k >= 1 ? fires[1][0] - fires[0][0] : 0;
  if (!sunk || k < 1 || end - fires[k][0] > 3) return end - first + load;
  const mean = (fires[0][1] - fires[k][1]) / k;
  const f = mean > 0 ? Math.max(0, Math.min(1, fires[k][1] / mean)) : 1;
  return fires[k - 1][0] - first + f * (fires[k][0] - fires[k - 1][0]) + load;
}

/** Open water of the Ashen Isles, clear of land and shoals for a mile (lawless: any captain fires on any). */
const lawless = new WeakMap<Game, { x: number; y: number }>();
export function lawlessWater(game: Game): { x: number; y: number } {
  let p = lawless.get(game);
  if (p) return p;
  for (let i = 0; i < 2000 && !p; i++) {
    const x = 78_000 + ((i * 7919) % 12_000), y = 64_000 + ((i * 104_729) % 12_000);
    if (game.regionAt(x, y) !== 'ashen_isles') continue;
    let clear = true;
    for (let a = 0; a < 16 && clear; a++) for (const r of [300, 800, 1400]) if (isLand(game.world, x + Math.cos(a) * r, y + Math.sin(a) * r)) clear = false;
    for (let a = 0; a < 32 && clear; a++) for (const r of [100, 250, 450, 700, 1000]) if (depthAt(game.world, x + Math.cos(a * 0.196) * r, y + Math.sin(a * 0.196) * r) < 12) clear = false;
    if (clear) p = { x, y };
  }
  p ??= spot(game);
  lawless.set(game, p);
  return p;
}

/** Her hired escorts (the Admiral's) lie astern of her, beam on to the mark, and fire as they load. */
function escorts(game: Game, me: ShipEntity, foe: ShipEntity): void {
  let i = 0;
  for (const o of game.ships.values()) {
    if (o.ownerId !== me.id || !o.alive) continue;
    const brain = game.npcs.get(o.id);
    if (brain) brain.active = false;
    i++;
    // (in her line, a cable's length astern of her: within her guns' reach of the mark)
    const back = me.state.heading + Math.PI;
    o.state.x = me.state.x + Math.sin(back) * 85 * i;
    o.state.y = me.state.y - Math.cos(back) * 85 * i;
    o.state.heading = me.state.heading;
    o.state.speed = 0;
    o.input = { rudder: 0, sailTarget: 0 };
    game.grid.upsert(o.id, o.state.x, o.state.y);
    if (o.reload.starboard <= 0) fireBroadside(game, o, 'starboard', Math.hypot(foe.state.x - o.state.x, foe.state.y - o.state.y), { x: foe.state.x, y: foe.state.y }, 1, {});
  }
}

const ready = (game: Game, s: ShipEntity, id: string) => (game.profileOf(s)!.cooldowns[id] ?? 0) <= game.now;

/** Her kit as a captain who knows it: `attack` — on the mark she fires upon; `defend` — fired upon. */
function castKit(game: Game, me: ShipEntity, foe: ShipEntity, side: KitSide, casts: Record<string, number>, memo: { lastRam: number }, mode: 'attack' | 'defend'): void {
  const may = (id: string) => (!side.only || side.only.includes(id)) && ready(game, me, id);
  const cast = (id: string, tx = foe.state.x, ty = foe.state.y): boolean => {
    if (!may(id)) return false;
    const why = useAbility(game, me, id, tx, ty);
    if (why) return false;
    casts[id] = (casts[id] ?? 0) + 1;
    return true;
  };
  const full = me.resolve >= 100;
  const loadIn = me.reload.starboard; // seconds to her next broadside
  if (mode === 'attack') {
    switch (me.captain) {
      case 'corsair':
        // The helm hard over just before the guns bear (the rake's window), the double charge with it (the combo).
        if (loadIn <= 1 && may('hard_over')) {
          cast('hard_over');
          cast('double_shot');
        } else if (loadIn <= 1 && !may('hard_over')) cast('double_shot');
        cast('spotters_eye');
        if (full) cast('last_volley');
        break;
      case 'admiral': {
        cast('call_escort');
        cast('form_line');
        // The mark first, the barrage into it within its window (the combo); the mark when it is ready.
        const markedAgo = game.now - (me.kit.cast.mark_target ?? -1e9);
        const markIn = (game.profileOf(me)!.cooldowns.mark_target ?? 0) - game.now;
        if (full && may('mark_target')) {
          cast('mark_target');
          cast('admiralty_barrage');
        } else if (full && (markedAgo <= 4 || markIn > 20 || (side.only && !side.only.includes('mark_target')))) cast('admiralty_barrage');
        else cast('mark_target');
        break;
      }
      case 'reaver':
        // The cry, then the run-in (the combo); a ram when Ramming Speed is up and she has had time to come about.
        if (may('ramming_speed') && game.now - memo.lastRam >= RAM_AGAIN) {
          cast('war_cry');
          if (cast('ramming_speed')) {
            game.ram(me, foe, me.stats.maxSpeed * RAM_CLOSING);
            memo.lastRam = game.now;
          }
        }
        if (full) cast('red_hook_boarding');
        break;
      case 'smuggler':
        // Dark, then the first broadside out of it (the combo); the fog's knife when her resolve is full.
        if (loadIn <= 1) cast('dark_running');
        if (loadIn <= 1) cast('smoke_pots');
        if (full) cast('vanish_into_fog');
        break;
      case 'navigator':
        // The star fix, then the broadsides along her weak line (the combo); the storm when her resolve is full.
        if (loadIn <= 1) cast('star_fix');
        cast('current_rider');
        if (full) cast('storm_chaser');
        break;
      case 'drowned': {
        // The call, then the maw into the hands (the combo); the call alone when the ultimate is far off.
        const call = kitNums(game, me, 'deep_call')?.n.dread ?? 30; // (its facet may cut it)
        if (full && me.dread >= call + 50 && may('deep_call')) {
          cast('deep_call');
          cast('maw_of_the_deep');
        } else if (full && me.dread >= 50 && (!may('deep_call') || me.dread < call + 50)) cast('maw_of_the_deep');
        // (the call again only while the maw is far off, or with Dread enough for both: the maw is her blow)
        else if (!full && me.dread >= call && (me.resolve < 30 || me.dread >= call + 50)) cast('deep_call');
        break;
      }
    }
  } else {
    switch (me.captain) {
      case 'smuggler':
        cast('smoke_pots', me.state.x, me.state.y);
        if (full) cast('vanish_into_fog', me.state.x, me.state.y);
        break;
      case 'drowned':
        if (me.hull < me.stats.hullMax * 0.8 && me.dread >= 25) cast('brine_mend', me.state.x, me.state.y);
        break;
      case 'reaver':
        cast('war_cry');
        break;
      case 'corsair':
        cast('hard_over');
        break;
      case 'navigator':
        cast('current_rider');
        break;
      case 'admiral':
        cast('form_line');
        break;
    }
  }
}

/** The mean of a few fights by seed (the casts summed). */
export function kitMedian(game: Game, a: KitSide, b: KitSide, seeds: number[], maxSec = 900): KitFight & { all: number[] } {
  const rs = seeds.map((s) => kitFight(game, a, b, s, maxSec));
  const all = rs.map((r) => r.sec).sort((p, q) => p - q);
  const mean = (f: (r: KitFight) => number) => rs.reduce((n, r) => n + f(r), 0) / rs.length;
  const casts: Record<string, number> = {};
  for (const r of rs) for (const k in r.casts) casts[k] = (casts[k] ?? 0) + r.casts[k] / rs.length;
  for (const k in casts) casts[k] = Math.round(casts[k] * 10) / 10;
  return { sec: Math.round(mean((r) => r.sec) * 10) / 10, raw: Math.round(mean((r) => r.raw) * 10) / 10, volleys: Math.round(mean((r) => r.volleys) * 10) / 10, sunk: rs.every((r) => r.sunk), casts, all };
}

export { CAPTAINS };

// ------------------------------------------------------------------------------------------------ the report

export const KIT_CAPTAINS: CaptainId[] = ['corsair', 'admiral', 'reaver', 'smuggler', 'navigator', 'drowned'];

export interface KitRow {
  anchor: number;
  level: number;
  gear: Gear;
  captain: CaptainId;
  /** The plain fight (no kit either side), her kit on, fired upon with her kit on (seconds, medians). */
  plain: number;
  on: number;
  def: number;
  casts: Record<string, number>;
}

/** Her whole kit at sea, ⚓ by ⚓: shorter by it as the attacker, longer by it as the one fired upon. */
export function kitRows(game: Game, anchors: number[], gears: Gear[], seeds: number[], captains = KIT_CAPTAINS, levelOf: (a: number) => number): KitRow[] {
  const rows: KitRow[] = [];
  for (const a of anchors) for (const gear of gears) {
    const level = levelOf(a);
    const side = (captain: CaptainId, kit: boolean): KitSide => ({ anchor: a, gear, captain, level, kit });
    const plain = kitMedian(game, side('navigator', false), side('navigator', false), seeds).sec;
    for (const c of captains) {
      const on = kitMedian(game, side(c, true), side('navigator', false), seeds);
      const def = kitMedian(game, side('navigator', false), side(c, true), seeds);
      rows.push({ anchor: a, level, gear, captain: c, plain, on: on.sec, def: def.sec, casts: on.casts });
    }
  }
  return rows;
}

/** One ability alone (the rest of her kit kept, her passive with it if `passive`): its share of the fight. */
export function abilityShare(game: Game, captain: CaptainId, id: string, anchor: number, level: number, gear: Gear, seeds: number[], mode: 'attack' | 'defend', facets?: Record<string, 'a' | 'b'>): number {
  const s = (kit: boolean, only?: string[]): KitSide => ({ anchor, gear, captain, level, kit, only, facets });
  const foe: KitSide = { anchor, gear, captain: 'navigator', level, kit: false };
  if (mode === 'attack') {
    const off = kitMedian(game, s(true, []), foe, seeds).sec;
    const on = kitMedian(game, s(true, [id]), foe, seeds).sec;
    return 1 - on / off;
  }
  const off = kitMedian(game, foe, s(true, []), seeds).sec;
  const on = kitMedian(game, foe, s(true, [id]), seeds).sec;
  return on / off - 1;
}
