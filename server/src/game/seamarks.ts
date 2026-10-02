// The dense sea's marks at work (owner, 2026-10-02): driftwood to pick up, a field of wrecks to search, a lane buoy to
// read, a lantern float to trim, floating bones, an ice floe. Hove to within a cable of one, her boats work it for a
// few seconds; what it gives is small (two to five hundredths of an hour at sea at her ship's level) and each mark is
// hers to work once a day. The marks are the world's (shared/src/world/worldgen.ts); what she has worked is kept on
// her profile. Every roll here is on its own Rng (the sea's stream is the fights' and the landings').

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import {
  MARK_AGAIN_MS, MARK_CHART_R, MARK_MAP_CHANCE, MARK_OMEN_CHANCE, MARK_SEAL_CHANCE, MARK_SLOW, MARK_SLOW_BREAK, MARK_TIME, isMarkKind, markInReach, markWorth,
} from '../../../shared/src/data/seamarks.ts';
import type { MarkKind } from '../../../shared/src/data/seamarks.ts';
import { dist } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { marksNear } from '../../../shared/src/world/worldgen.ts';
import type { SeaMark } from '../../../shared/src/world/worldgen.ts';
import { giveGoods } from './director.ts';
import { sealsOnFloe } from './drifts.ts';
import { grantMap, makeMap } from './explorefx.ts';
import type { Game } from './Game.ts';
import { addLand } from './landecon.ts';
import type { PlayerSession, Profile } from './player.ts';

/** Her boats at a mark: which, and when they are done (world seconds). */
interface Busy {
  id: number;
  until: number;
  total: number;
}

interface MS {
  rng: Rng;
  busy: WeakMap<PlayerSession, Busy>;
  sent: WeakMap<PlayerSession, string>;
}

const all = new WeakMap<Game, MS>();
function M(game: Game): MS {
  let x = all.get(game);
  if (!x) all.set(game, (x = { rng: new Rng(0x5ea3a7c5), busy: new WeakMap(), sent: new WeakMap() }));
  return x;
}

/** The marks' own dice (the tests may set them). */
export const markRng = (game: Game): Rng => M(game).rng;
export function setMarkRng(game: Game, rng: Rng): void {
  M(game).rng = rng;
}

/** The marks she has worked and when (real milliseconds), those a day old let go. */
export function marksWorked(game: Game, p: Profile): Record<string, number> {
  const rec = (p.seaMarks ??= {});
  const now = game.wallNow();
  for (const [k, at] of Object.entries(rec)) if (!(typeof at === 'number' && now - at < MARK_AGAIN_MS)) delete rec[k];
  return rec;
}

/** Milliseconds before a mark is hers to work again (0: now). */
export function markAgain(game: Game, p: Profile, id: number): number {
  const at = marksWorked(game, p)[String(id)];
  return at === undefined ? 0 : Math.max(0, at + MARK_AGAIN_MS - game.wallNow());
}

export const markById = (game: Game, id: number): SeaMark | undefined => (Number.isInteger(id) && id >= 0 ? game.world.marks[id] : undefined);

/** The nearest mark within the boats' reach of her (any, worked or not). */
export function markWithin(game: Game, s: PlayerSession): SeaMark | null {
  const ship = s.ship;
  if (!ship) return null;
  let best: SeaMark | null = null, bd = Infinity;
  for (const m of marksNear(game.world, ship.state.x, ship.state.y, 400)) {
    const d = dist(m.x, m.y, ship.state.x, ship.state.y) - m.r;
    if (markInReach(m, ship.state.x, ship.state.y) && d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

export const markBusy = (game: Game, s: PlayerSession): Busy | null => M(game).busy.get(s) ?? null;

const WORK_WORD: Record<MarkKind, string> = {
  drift: 'driftwood', wreck: 'wreck field', buoy: 'lane buoy', lantern: 'lantern float', bones: 'floating bones', floe: 'ice floe',
};

/** Why her boats cannot work a mark now (null: they can). */
function whyNot(game: Game, s: PlayerSession, m: SeaMark | undefined): string | null {
  const ship = s.ship!;
  if (!m || !isMarkKind(m.kind)) return 'Nothing there to work.';
  if (ship.docked || !ship.alive || ship.ghost) return 'Out at sea, alongside a mark.';
  if (!markInReach(m, ship.state.x, ship.state.y)) return 'Come within a cable of it first.';
  if (ship.inCombat(game.now)) return 'Not under fire.';
  if (markAgain(game, s.profile!, m.id) > 0) return 'Your boats worked this one today already.';
  if (ship.state.speed > MARK_SLOW) return 'Shorten sail first: the boats cannot work it at speed.';
  return null;
}

/** Boats away to the mark: a few seconds' work, hove to. */
export function startMark(game: Game, s: PlayerSession, id: number): string | null {
  if (!s.ship || !s.profile) return 'No captain';
  const m = markById(game, id);
  const why = whyNot(game, s, m);
  if (why) return why;
  const S = M(game);
  const cur = S.busy.get(s);
  if (cur?.id === id) return null;
  const total = MARK_TIME[m!.kind];
  S.busy.set(s, { id, until: game.now + total, total });
  sendMarks(game, s, true);
  return null;
}

export function cancelMark(game: Game, s: PlayerSession, why?: string): void {
  const S = M(game);
  if (!S.busy.has(s)) return;
  S.busy.delete(s);
  if (why && s.ship) game.toastShip(s.ship, why, 'bad');
  sendMarks(game, s, true);
}

/** Every second: the boats at their marks — called back if she makes way or drifts off, else done when due. */
export function stepSeaMarks(game: Game): void {
  const S = M(game);
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile) continue;
    const b = S.busy.get(s);
    if (b) {
      const m = markById(game, b.id)!;
      if (ship.docked || !ship.alive) cancelMark(game, s);
      else if (ship.state.speed > MARK_SLOW_BREAK) cancelMark(game, s, 'The boats are called back: she made way.');
      else if (Math.hypot(m.x - ship.state.x, m.y - ship.state.y) - m.r > 220) cancelMark(game, s, 'The boats are called back: she drifted off.');
      else if (ship.inCombat(game.now)) cancelMark(game, s, 'The boats are called back: under fire.');
      else if (game.now >= b.until) {
        S.busy.delete(s);
        workMark(game, s, m);
        sendMarks(game, s, true);
      }
    }
    if (!S.sent.has(s)) sendMarks(game, s, false);
  }
}

/** What she has worked (for her sea and her HUD), when it changed. */
export function sendMarks(game: Game, s: PlayerSession, force: boolean): void {
  const S = M(game);
  if (!s.profile) return;
  const done = Object.keys(marksWorked(game, s.profile)).map(Number).sort((a, b) => a - b);
  const b = S.busy.get(s);
  const busy = b ? { id: b.id, until: b.until, total: b.total } : null;
  const key = JSON.stringify([done, busy]);
  if (!force && S.sent.get(s) === key) return;
  S.sent.set(s, key);
  game.sendTo(s, { t: 'seamarks', done, busy });
}

/** A good of a list into her hold for about `worth` silver: how many went in (0: no room). */
function goodsFor(ship: NonNullable<PlayerSession['ship']>, good: GoodId, worth: number): number {
  return giveGoods(ship, good, Math.max(1, Math.min(40, Math.round(worth / GOODS[good].basePrice))));
}

function giveSilver(game: Game, s: PlayerSession, n: number, kind: MarkKind): number {
  const k = Math.max(1, Math.round(n));
  s.profile!.gold += k;
  game.db.ledger(s.accountId, 'seamark', k, kind);
  return k;
}

const WRECK_GOODS: GoodId[] = ['planks', 'sailcloth', 'tar', 'iron', 'rum', 'cloth', 'weapons'];

/** The bearing of a point from her, in the compass's words. */
function compass(x: number, y: number, tx: number, ty: number): string {
  const a = ((Math.atan2(tx - x, -(ty - y)) * 180) / Math.PI + 360) % 360;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / 45) % 8];
}

/** The work done: what the mark gives, and that it is hers no more today. Returns the toast's words. */
export function workMark(game: Game, s: PlayerSession, m: SeaMark): string {
  const S = M(game);
  const ship = s.ship!, p = s.profile!;
  const rng = S.rng;
  const worth = markWorth(ship.shipLevel, rng.float());
  let line = '';
  let kind: 'good' | 'gold' | 'info' | 'bad' = 'good';
  let given = true;
  switch (m.kind) {
    case 'drift': {
      const good: GoodId = rng.chance(0.5) ? 'planks' : 'timber';
      const n = goodsFor(ship, good, worth);
      if (n > 0) line = `Driftwood hauled aboard: ${n} ${GOODS[good].name}.`;
      else given = false;
      break;
    }
    case 'wreck': {
      if (rng.chance(0.35)) line = `The wreck field searched: ${giveSilver(game, s, worth, 'wreck')} silver in a drowned purse.`;
      else {
        const good = rng.pick(WRECK_GOODS);
        const n = goodsFor(ship, good, worth);
        if (n > 0) line = `The wreck field searched: ${n} ${GOODS[good].name}.`;
        else line = `The wreck field searched: ${giveSilver(game, s, worth * 0.6, 'wreck')} silver, no room for the rest.`;
      }
      if (rng.chance(MARK_MAP_CHANCE * (ship.hasFlag('gold_fever') ? 2 : 1))) {
        kind = 'gold';
        grantMap(game, s, makeMap(game, 1), 'In an oilskin in the wreckage');
      }
      break;
    }
    case 'buoy': {
      // The lane mark's chart: the nearest island not yet on hers, else the way to the nearest port.
      let near: (typeof game.world.islands)[number] | null = null, nd = Infinity;
      for (const is of game.world.islands) {
        if (is.minor || is.hidden || s.discovered.has(is.id)) continue;
        const d = dist(is.x, is.y, m.x, m.y) - is.radius;
        if (d < MARK_CHART_R && d < nd) {
          nd = d;
          near = is;
        }
      }
      if (near) {
        game.chartIsland(s, near);
        game.grantXp(s, Math.round(worth / 4), null);
        line = `The lane mark charts ${near.name}, ${Math.max(1, Math.round(nd / 100) / 10)} km to the ${compass(m.x, m.y, near.x, near.y)}.`;
        kind = 'gold';
      } else {
        let port = game.world.ports[0], pd = Infinity;
        for (const pt of game.world.ports) {
          const d = dist(pt.x, pt.y, m.x, m.y);
          if (d < pd) {
            pd = d;
            port = pt;
          }
        }
        const silver = giveSilver(game, s, worth, 'buoy');
        line = `The lane mark reads: ${port.name}, ${Math.max(1, Math.round(pd / 1000))} km to the ${compass(m.x, m.y, port.x, port.y)}. A pilot's tin on the buoy: ${silver} silver.`;
        kind = 'info';
      }
      break;
    }
    case 'lantern': {
      const morale = 3 + Math.round(rng.float() * 3);
      ship.morale = Math.min(100, ship.morale + morale);
      ship.sanity = Math.min(100, ship.sanity + 2);
      line = `The lantern float trimmed and burning: morale +${morale}, nerve +2.`;
      break;
    }
    case 'bones': {
      if (rng.chance(MARK_OMEN_CHANCE)) {
        if (rng.chance(0.5)) {
          ship.morale = Math.min(100, ship.morale + 4);
          line = 'The crew reads the floating bones as a good omen: morale +4.';
        } else {
          ship.morale = Math.max(0, ship.morale - 3);
          ship.sanity = Math.max(0, ship.sanity - 2);
          line = 'The crew mutters over the floating bones, an ill omen: morale −3, nerve −2.';
          kind = 'bad';
        }
      } else {
        const n = Math.max(1, Math.round(worth / LAND_RES_DEF.bone.value));
        const got = addLand(game, s, 'bone', n).given;
        if (got > 0) line = `Bones fished out for the store: ${got} bone.`;
        else given = false;
      }
      break;
    }
    case 'floe': {
      if (rng.chance(MARK_SEAL_CHANCE) && sealsOnFloe(game, s, m.x, m.y)) {
        line = 'Seals hauled out on the floe! Their card is open.';
        kind = 'gold';
      } else {
        const n = goodsFor(ship, 'provisions', worth);
        if (n > 0) line = `Ice cut from the floe for fresh water: ${n} ${GOODS.provisions.name}.`;
        else given = false;
      }
      break;
    }
  }
  if (!given) {
    line = `Your hold is full: the boats leave the ${WORK_WORD[m.kind]} as it is.`;
    kind = 'bad';
  } else marksWorked(game, p)[String(m.id)] = game.wallNow();
  game.toastShip(ship, line, kind);
  game.pushSelf(s, true);
  return line;
}

export function seamarkMessage(game: Game, s: PlayerSession, msg: { action: string; id?: number }): void {
  if (!s.ship || !s.profile) return;
  if (msg.action === 'cancel') return cancelMark(game, s);
  if (msg.action !== 'work') return;
  const e = startMark(game, s, Math.trunc(Number(msg.id)));
  if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
}

// ------------------------------------------------------------------------------------------------ the tester's console

/** `/seamark [kind] [go|done|reset]`: to the nearest mark (of a kind) and hove to within reach of it; its work done
 *  at once; every mark hers to work again. Without arguments: the mark within reach and its state. */
export function adminSeaMark(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  const kind = args.find((a) => isMarkKind(a)) as MarkKind | undefined;
  const order = args.find((a) => ['go', 'done', 'reset'].includes(a)) ?? (kind ? 'go' : 'info');
  if (order === 'reset') {
    s.profile!.seaMarks = {};
    cancelMark(game, s);
    sendMarks(game, s, true);
    return 'Every sea mark is yours to work again.';
  }
  if (order === 'go') {
    let best: SeaMark | null = null, bd = Infinity;
    for (const m of game.world.marks) {
      if (kind && m.kind !== kind) continue;
      if (!game.inZone(m.x, m.y)) continue;
      const d = dist(m.x, m.y, ship.state.x, ship.state.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best) return 'No such mark in these waters.';
    if (ship.docked) game.undock(s);
    ship.state = { ...ship.state, x: best.x, y: best.y + best.r + 90, speed: 0, sail: 0 };
    ship.input = { rudder: 0, sailTarget: 0 };
    ship.region = game.regionAt(ship.state.x, ship.state.y);
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
    game.pushSelf(s, true);
    return `Hove to by the ${WORK_WORD[best.kind]} (mark ${best.id}).`;
  }
  const m = markWithin(game, s);
  if (!m) return 'No sea mark within reach.';
  if (order === 'done') {
    cancelMark(game, s);
    return workMark(game, s, m);
  }
  const again = markAgain(game, s.profile!, m.id);
  return `The ${WORK_WORD[m.kind]} (mark ${m.id}): ${again > 0 ? `worked, again in ${Math.ceil(again / 3_600_000)} h` : 'yours to work'}.`;
}
