// docs/19 D5 on the server: the sea's small things between a captain's goals (shared/src/data/seafinds.ts). Every so
// often in quiet sailing one shows near her, hers for a few minutes — a bottle bobbing, flying fish coming aboard, a
// bank of fog on a dead calm, gulls wheeling over a shoal, a boat going down with her sailors, a chest afloat with
// sharks round it — and her action bar has its button while she is at it: the boats to the bottle, the fish gathered,
// a search of the fog, the shoal marked, the sailors taken aboard, the sharks driven off on the battle at sea. Each kind
// rolls on its own dice; what each gives is modest, and past her day's count of them half (seahaul.ts). Not saved:
// they are the sea's for a few minutes. Every second this module also counts her time at sea for the day's caps.

import { pointsXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { advHour } from '../../../shared/src/data/advmap.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import {
  BOTTLE_COIN, BOTTLE_MAP, BOTTLE_WORTH, CALM_CACHE, CALM_WORTH, CHEST_GOODS, CHEST_WORTH, FIND_AT, FIND_EVERY, FIND_KINDS, FIND_REACH, FIND_SLOW, FIND_TTL, FIND_WEIGHT, FIND_WORK, FISH_SHARE,
  boatHands, chestSharks, isFindKind,
} from '../../../shared/src/data/seafinds.ts';
import type { FindKind } from '../../../shared/src/data/seafinds.ts';
import type { FindClientMsg, FindView } from '../../../shared/src/findproto.ts';
import type { LairLoot } from '../../../shared/src/lairproto.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { Rng, hashString } from '../../../shared/src/rng.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { advQuiet } from './advmap.ts';
import { landFighting, startCreatureFight } from './beastlairs.ts';
import { reconcile } from './crew.ts';
import { giveGoods, quietSea } from './director.ts';
import { grantMap, makeMap } from './explorefx.ts';
import { shoalNear } from './fishing.ts';
import type { Game } from './Game.ts';
import { onboardingProtected } from './onboarding.ts';
import type { PlayerSession } from './player.ts';
import { haulNote, haulPeek, stepHaul } from './seahaul.ts';

/** A small thing on the water (its owner's alone). */
export interface Find {
  id: number;
  kind: FindKind;
  x: number;
  y: number;
  born: number;
  until: number;
  owner: number;
  level: number;
  /** The sharks round the chest (whatever is left of them after a fight lost). */
  n?: number;
  /** In a fight now. */
  fighting?: boolean;
}

interface Busy {
  id: number;
  until: number;
  total: number;
}

interface FS {
  list: Map<number, Find>;
  seq: number;
  /** The spawning's own dice, and each kind's. */
  rng: Rng;
  dice: Record<FindKind, Rng>;
  next: Map<number, number>;
  busy: WeakMap<PlayerSession, Busy>;
  sent: WeakMap<PlayerSession, string>;
}

const all = new WeakMap<Game, FS>();
const still = new WeakSet<Game>();

function F(game: Game): FS {
  let x = all.get(game);
  if (!x) {
    const dice = {} as Record<FindKind, Rng>;
    for (const k of FIND_KINDS) dice[k] = new Rng((hashString(`find:${k}`) ^ 0x19d5) >>> 0);
    all.set(game, (x = { list: new Map(), seq: 1, rng: new Rng(0x19d5f1), dice, next: new Map(), busy: new WeakMap(), sent: new WeakMap() }));
  }
  return x;
}

/** The small things kept still (the tests of other systems keep them still with the adventure map). */
export function quietFinds(game: Game, on = true): void {
  if (on) still.add(game);
  else still.delete(game);
}
const quiet = (game: Game): boolean => advQuiet(game) || still.has(game);

/** A kind's own dice (the tests may set them). */
export const findRng = (game: Game, k: FindKind): Rng => F(game).dice[k];
export function setFindRng(game: Game, k: FindKind, rng: Rng): void {
  F(game).dice[k] = rng;
}

export const findById = (game: Game, id: number): Find | undefined => F(game).list.get(id);
export const findsOf = (game: Game, s: PlayerSession): Find[] => [...F(game).list.values()].filter((f) => f.owner === s.accountId);

function openWater(game: Game, x: number, y: number): boolean {
  if (!game.inZone(x, y) || isLand(game.world, x, y)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (isLand(game.world, x + Math.sin(a) * 180, y - Math.cos(a) * 180)) return false;
  }
  return true;
}

/** One of a kind put on the water near her (the fish aboard at her own place). */
export function putFind(game: Game, s: PlayerSession, kind: FindKind, at?: { x: number; y: number }): Find | null {
  const S = F(game);
  const ship = s.ship!;
  let spot = at ?? null;
  if (!spot && kind === 'flyfish') spot = { x: ship.state.x, y: ship.state.y };
  for (let k = 0; k < 12 && !spot; k++) {
    const v = headingVec(ship.state.heading + S.rng.range(-1.1, 1.1));
    const far = S.rng.range(FIND_AT[0], FIND_AT[1]);
    const x = ship.state.x + v.x * far, y = ship.state.y + v.y * far;
    if (openWater(game, x, y)) spot = { x, y };
  }
  if (!spot) return null;
  // (the chest's sharks no stronger than her own ship's level: a small fight, not a toll)
  const level = kind === 'chest' ? Math.max(1, Math.min(sectorAt(game.world, spot.x, spot.y).level, ship.shipLevel)) : sectorAt(game.world, spot.x, spot.y).level;
  const ttl = kind === 'flyfish' ? 30 : S.rng.range(FIND_TTL[0], FIND_TTL[1]);
  const f: Find = { id: S.seq++, kind, x: Math.round(spot.x), y: Math.round(spot.y), born: game.now, until: game.now + ttl, owner: s.accountId, level, ...(kind === 'chest' ? { n: chestSharks(level) } : {}) };
  S.list.set(f.id, f);
  sendFinds(game, s, true);
  return f;
}

/** The next kind for her: by the weights, the fish only at speed, the sharks' chest not for a novice. */
function pickKind(game: Game, s: PlayerSession): FindKind {
  const S = F(game);
  const ship = s.ship!;
  const pool = FIND_KINDS.filter((k) => (k !== 'flyfish' || ship.state.speed >= 4) && (k !== 'chest' || !onboardingProtected(s)));
  const tot = pool.reduce((a, k) => a + FIND_WEIGHT[k], 0);
  let r = S.rng.float() * tot;
  for (const k of pool) {
    r -= FIND_WEIGHT[k];
    if (r <= 0) return k;
  }
  return pool[pool.length - 1];
}

/** The one within reach of her (the fish: aboard while they last). */
export function findAtHand(game: Game, s: PlayerSession): Find | null {
  const ship = s.ship;
  if (!ship) return null;
  let best: Find | null = null, bd = Infinity;
  for (const f of F(game).list.values()) {
    if (f.owner !== s.accountId) continue;
    const d = f.kind === 'flyfish' ? 0 : dist(f.x, f.y, ship.state.x, ship.state.y);
    if (d <= FIND_REACH[f.kind] && d < bd) [best, bd] = [f, d];
  }
  return best;
}

/** Every second: her time at sea for the caps; the small things gone with their time, new ones, the boats' work. */
export function stepSeaFinds(game: Game): void {
  stepHaul(game);
  const S = F(game);
  const calm = quiet(game);
  for (const f of [...S.list.values()]) {
    if (game.now < f.until || f.fighting) continue;
    S.list.delete(f.id);
    const o = game.sessionByAccount(f.owner);
    if (o) sendFinds(game, o, true);
  }
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || !ship.alive || ship.ghost) continue;
    const b = S.busy.get(s);
    if (b) {
      const f = S.list.get(b.id);
      if (!f || ship.docked) cancelFind(game, s);
      else if (ship.state.speed > FIND_SLOW[f.kind] + 1.5) cancelFind(game, s, 'The boats are called back: she made way.');
      else if (dist(f.x, f.y, ship.state.x, ship.state.y) > FIND_REACH[f.kind] + 80) cancelFind(game, s, 'The boats are called back: she drifted off.');
      else if (ship.underFire(game.now)) cancelFind(game, s, 'The boats are called back: under fire.');
      else if (game.now >= b.until) {
        S.busy.delete(s);
        resolveFind(game, s, f);
      }
    }
    if (game.directorOn && !calm && !ship.docked) {
      const due = S.next.get(s.accountId);
      if (due === undefined) S.next.set(s.accountId, game.now + S.rng.range(FIND_EVERY[0], FIND_EVERY[1]) * 0.5);
      else if (game.now >= due) {
        if (!quietSea(game, s)) S.next.set(s.accountId, game.now + 20); // a fight or a harbour puts it off
        else {
          S.next.set(s.accountId, game.now + S.rng.range(FIND_EVERY[0], FIND_EVERY[1]));
          if (!findsOf(game, s).length) putFind(game, s, pickKind(game, s));
        }
      }
    }
    if (!S.sent.has(s)) sendFinds(game, s, false);
  }
}

/** Her small things and the boats' work, sent when they change. */
export function sendFinds(game: Game, s: PlayerSession, force: boolean): void {
  const S = F(game);
  const list: FindView[] = findsOf(game, s).map((f) => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, left: Math.max(0, Math.round(f.until - game.now)), ttl: Math.round(f.until - f.born), level: f.level, ...(f.n ? { n: f.n } : {}) }));
  const b = S.busy.get(s) ?? null;
  const key = JSON.stringify([list.map((f) => [f.id, f.n ?? 0]), b]);
  if (!force && S.sent.get(s) === key) return;
  S.sent.set(s, key);
  game.sendTo(s, { t: 'seafinds', list, busy: b ? { ...b } : null });
}

function whyNot(game: Game, s: PlayerSession, f: Find | undefined): string | null {
  const ship = s.ship!;
  if (!f || f.owner !== s.accountId) return 'It is gone.';
  if (ship.docked || !ship.alive || ship.ghost) return 'Out at sea, alongside it.';
  if (f.kind !== 'flyfish' && dist(f.x, f.y, ship.state.x, ship.state.y) > FIND_REACH[f.kind]) return 'Come within a cable of it first.';
  if (ship.underFire(game.now)) return 'Not under fire.';
  if (ship.boarding || ship.grappled || ship.landing || landFighting(game, s)) return 'Not now';
  if (ship.state.speed > FIND_SLOW[f.kind]) return 'Shorten sail first: the boats cannot be lowered at speed.';
  return null;
}

/** Her order at a small thing: the boats away (a few seconds hove to), the fish gathered at once, the fight begun. */
export function startFind(game: Game, s: PlayerSession, id: number): string | null {
  if (!s.ship || !s.profile) return 'No captain';
  const S = F(game);
  const f = S.list.get(id);
  const why = whyNot(game, s, f);
  if (why) return why;
  if (S.busy.get(s)?.id === id) return null;
  if (f!.kind === 'chest') return fightChest(game, s, f!);
  const secs = FIND_WORK[f!.kind];
  if (secs <= 0) {
    resolveFind(game, s, f!);
    return null;
  }
  S.busy.set(s, { id, until: game.now + secs, total: secs });
  sendFinds(game, s, true);
  return null;
}

export function cancelFind(game: Game, s: PlayerSession, why?: string): void {
  const S = F(game);
  if (!S.busy.has(s)) return;
  S.busy.delete(s);
  if (why && s.ship) game.toastShip(s.ship, why, 'bad');
  sendFinds(game, s, true);
}

function giveSilver(game: Game, s: PlayerSession, n: number, why: string): number {
  const k = Math.max(1, Math.round(n));
  s.profile!.gold += k;
  game.db.ledger(s.accountId, 'seafind', k, why);
  return k;
}

/** The nearest island not on her chart within `r` (a hidden one first, when she is near it). */
function unchartedNear(game: Game, s: PlayerSession, x: number, y: number, r: number): (typeof game.world.islands)[number] | null {
  let best: (typeof game.world.islands)[number] | null = null, bd = Infinity;
  for (const is of game.world.islands) {
    if (is.minor || is.slot || s.discovered.has(is.id)) continue;
    if (Math.abs(is.x - x) > r || Math.abs(is.y - y) > r) continue;
    const d = dist(is.x, is.y, x, y) - is.radius - (is.hidden ? 2500 : 0);
    if (d < r && d < bd) [best, bd] = [is, d];
  }
  return best;
}

const compass = (x: number, y: number, tx: number, ty: number): string => {
  const a = ((Math.atan2(tx - x, -(ty - y)) * 180) / Math.PI + 360) % 360;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / 45) % 8];
};

/** What a small thing gives (the chest's is its fight's end). Returns the toast's words. */
export function resolveFind(game: Game, s: PlayerSession, f: Find): string {
  const S = F(game);
  const ship = s.ship!, p = s.profile!;
  const rng = S.dice[f.kind];
  const hour = advHour(Math.max(1, Math.min(10, ship.shipLevel)));
  const haul = haulPeek(game, s, 'finds');
  let line = '';
  let kind: 'good' | 'gold' | 'info' | 'bad' = 'good';
  let given = true;
  switch (f.kind) {
    case 'bottle': {
      const r = rng.float();
      if (r < BOTTLE_MAP) {
        if (grantMap(game, s, makeMap(game, 1), 'Rolled up in the bottle')) {
          line = 'The bottle holds a piece of a treasure chart!';
          kind = 'gold';
        } else line = `The bottle holds only a sodden chart: ${giveSilver(game, s, hour * BOTTLE_WORTH * haul, 'bottle')} silver for the glass.`;
      } else if (r < BOTTLE_MAP + BOTTLE_COIN) {
        line = `A message in a bottle, and coins rolled in it: ${giveSilver(game, s, hour * BOTTLE_WORTH * 2 * haul, 'bottle')} silver.`;
      } else {
        const is = unchartedNear(game, s, f.x, f.y, 9000);
        if (is) {
          game.chartIsland(s, is);
          game.grantXp(s, pointsXp(s.profile!.level, 50), null);
          line = `A message in a bottle: a castaway's directions to ${is.name}, ${Math.max(1, Math.round(dist(is.x, is.y, f.x, f.y) / 1000))} km to the ${compass(f.x, f.y, is.x, is.y)}. It is on your chart.`;
          kind = 'gold';
        } else {
          let port = game.world.ports[0], pd = Infinity;
          for (const pt of game.world.ports) {
            const d = dist(pt.x, pt.y, f.x, f.y);
            if (d < pd) [port, pd] = [pt, d];
          }
          line = `A message in a bottle: "${port.name} is ${Math.max(1, Math.round(pd / 1000))} km to the ${compass(f.x, f.y, port.x, port.y)}, and they pay for news there." ${giveSilver(game, s, hour * BOTTLE_WORTH * haul, 'bottle')} silver in the cork.`;
          kind = 'info';
        }
      }
      break;
    }
    case 'flyfish': {
      const n = Math.max(2, Math.round(ship.crew * FISH_SHARE * haul));
      const a = giveGoods(ship, 'provisions', n), b = giveGoods(ship, 'fish', Math.max(1, Math.round(n / 2)));
      if (a + b > 0) line = `Flying fish come aboard in a shower: ${a} provisions and ${b} fish for the galley.`;
      else given = false;
      break;
    }
    case 'calm': {
      if (rng.chance(CALM_CACHE)) {
        const silver = giveSilver(game, s, hour * CALM_WORTH * 0.7 * haul, 'calm');
        const good: GoodId = rng.pick(['rum', 'tobacco', 'cloth'] as GoodId[]);
        const k = giveGoods(ship, good, Math.max(1, Math.round((hour * CALM_WORTH * 0.3 * haul) / GOODS[good].basePrice)));
        line = k > 0 ? `In the dead calm the boats find a cache in the fog, lashed to a sunken mast: ${silver} silver and ${k} ${GOODS[good].name.toLowerCase()}.` : `In the dead calm the boats find a cache in the fog, lashed to a sunken mast: ${silver} silver.`;
        kind = 'gold';
      } else {
        line = 'The boats row the fog bank through: only dead water and the drip of the oars.';
        kind = 'info';
      }
      break;
    }
    case 'gulls': {
      const marked = shoalNear(game, f.x, f.y, regionAt(game.world, f.x, f.y));
      game.grantXp(s, pointsXp(s.profile!.level, 28), null);
      line = marked ? 'The gulls are over a shoal: the fishing is marked on your chart. Cast a net there.' : 'The gulls scatter: the shoal has gone deep.';
      kind = marked ? 'good' : 'info';
      break;
    }
    case 'boat': {
      const want = Math.max(1, Math.round(boatHands(f.level) * Math.max(0.5, haul)));
      const k = Math.max(0, Math.min(want, ship.stats.crewMax - ship.crew));
      if (k > 0) {
        const c = p.company;
        reconcile(game, c, ship.crew);
        ship.addMen('deckhand', k);
        c.pools.sailor += k;
        ship.companyKey = '';
        p.rescued = (p.rescued ?? 0) + k;
        line = `The sailors of the sinking boat come aboard: ${k} deckhands sign on for nothing but their lives.`;
      } else {
        line = 'No hammocks for the sailors of the sinking boat: you give them water and a course for the nearest port.';
        kind = 'info';
        ship.morale = Math.min(100, ship.morale + 2);
      }
      break;
    }
    case 'chest':
      break;
  }
  if (!given) {
    line = 'Your hold is full: the boats leave it to the sea.';
    kind = 'bad';
  } else {
    haulNote(game, s, 'finds', haul);
    const rec = (p.seaFinds ??= {});
    rec[f.kind] = (rec[f.kind] ?? 0) + 1;
  }
  F(game).list.delete(f.id);
  game.toastShip(ship, line, kind);
  sendFinds(game, s, true);
  game.pushSelf(s, true);
  return line;
}

/** The chest afloat: her boarders against the sharks round it, on the battle at sea of the drifts. */
function fightChest(game: Game, s: PlayerSession, f: Find): string | null {
  const men: ArmyStack[] = [{ u: 'reef_shark', n: f.n ?? chestSharks(f.level) }];
  f.fighting = true;
  f.until = Math.max(f.until, game.now + 60);
  const e = startCreatureFight(game, s, {
    type: 'tropical', kind: 'find_chest', place: 'Sharks round a Chest', level: f.level,
    onEnd: (g, ss, won, bt) => chestEnd(g, ss, f, won, bt.stacks.filter((x) => x.side === 1 && x.count > 0).reduce((a, x) => a + x.count, 0)),
  }, 'Sharks round a Chest', men, 'monster.shark', f.level);
  if (e) {
    f.fighting = false;
    return e;
  }
  game.toastShip(s.ship!, 'Boats away against the sharks round the chest.', 'info');
  return null;
}

function chestEnd(game: Game, s: PlayerSession, f: Find, won: boolean, left: number): LairLoot | undefined {
  f.fighting = false;
  const ship = s.ship!, p = s.profile!;
  if (!won) {
    if (left > 0) f.n = left;
    game.toastShip(ship, 'The sharks throw your boats back from the chest.', 'bad');
    sendFinds(game, s, true);
    return undefined;
  }
  const rng = F(game).dice.chest;
  const haul = haulPeek(game, s, 'finds');
  const hour = advHour(Math.max(1, Math.min(10, f.level)));
  const silver = giveSilver(game, s, hour * CHEST_WORTH * 0.7 * haul, 'chest');
  const good = rng.pick(CHEST_GOODS);
  const k = giveGoods(ship, good, Math.max(1, Math.round((hour * CHEST_WORTH * 0.3 * haul) / GOODS[good].basePrice)));
  haulNote(game, s, 'finds', haul);
  const rec = (p.seaFinds ??= {});
  rec.chest = (rec.chest ?? 0) + 1;
  F(game).list.delete(f.id);
  game.toastShip(ship, k > 0 ? `The sharks are driven off and the chest hauled up: ${silver} silver and ${k} ${GOODS[good].name.toLowerCase()}.` : `The sharks are driven off and the chest hauled up: ${silver} silver.`, 'gold');
  sendFinds(game, s, true);
  return { silver: 0, xp: 0, goods: [], res: {}, find: { silver, goods: k > 0 ? [{ g: good, n: k }] : [] } };
}

export function findMessage(game: Game, s: PlayerSession, msg: FindClientMsg): void {
  if (!s.ship || !s.profile) return;
  if (msg.action === 'cancel') return cancelFind(game, s);
  if (msg.action !== 'work') return;
  const e = startFind(game, s, Math.trunc(Number(msg.id)));
  if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
}

// ------------------------------------------------------------------------------------------------ the tester's console

const FIND_WORD: Record<FindKind, string> = {
  bottle: 'message in a bottle', flyfish: 'flying fish', calm: 'fog bank on a dead calm', gulls: 'gulls over a shoal', boat: 'sinking boat', chest: 'chest among the sharks',
};

/** `/find [kind] [go|done|reset]`: one of a kind put beside her (go: hove to within reach of it), the one at hand had at
 *  once (done), all of hers gone and the day's count of finds forgotten (reset); without arguments, what is at hand. */
export function adminFind(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  const kind = args.find((a) => isFindKind(a)) as FindKind | undefined;
  const order = args.find((a) => ['go', 'done', 'reset'].includes(a)) ?? (kind ? 'go' : 'info');
  if (order === 'reset') {
    for (const f of findsOf(game, s)) F(game).list.delete(f.id);
    cancelFind(game, s);
    if (s.profile) s.profile.seaHaul = undefined;
    sendFinds(game, s, true);
    return 'Your small things of the sea are gone, and the day’s count of your finds is forgotten.';
  }
  if (order === 'go') {
    const k = kind ?? pickKind(game, s);
    if (ship.docked) game.undock(s);
    ship.state = { ...ship.state, speed: 0, sail: 0 };
    ship.input = { rudder: 0, sailTarget: 0 };
    for (const f of findsOf(game, s)) F(game).list.delete(f.id);
    // Within reach of her, ahead (the fish aboard).
    const v = headingVec(ship.state.heading);
    let at: { x: number; y: number } | undefined;
    for (const d of [Math.min(110, FIND_REACH[k] * 0.6), 60, 30]) {
      const x = ship.state.x + v.x * d, y = ship.state.y + v.y * d;
      if (!isLand(game.world, x, y)) {
        at = { x, y };
        break;
      }
    }
    const f = putFind(game, s, k, k === 'flyfish' ? undefined : at);
    if (!f) return 'No open water about her for it.';
    game.pushSelf(s, true);
    return `Beside you: the ${FIND_WORD[k]} (find ${f.id}).`;
  }
  const f = findAtHand(game, s);
  if (!f) return 'No small thing of the sea within reach.';
  if (order === 'done') {
    cancelFind(game, s);
    if (f.kind === 'chest') return fightChest(game, s, f) ?? `Boats away against the ${FIND_WORD.chest}.`;
    return resolveFind(game, s, f);
  }
  return `The ${FIND_WORD[f.kind]} (find ${f.id}): ${Math.max(0, Math.round(f.until - game.now))} s left.`;
}
