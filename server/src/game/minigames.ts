// Island scenes and mini-games (2026-09-30): one engine for the twenty games of shared/src/data/minigames.ts. A
// landing party finds one at an island's haunt (every island with nothing else ashore has one, by her id), now and
// then after an ordinary landing, and now and then a passing boat offers one at sea through the sea director. The
// server picks it (weighted, never the same one twice running for a captain), rolls every die and coin, checks every
// answer, and pays through the game's own helpers. The shores tire of a captain who plays too often: past six games
// in half an hour the purses and stakes shrink.

import { MINIGAMES, MINIGAME_IDS, islandHaunt } from '../../../shared/src/data/minigames.ts';
import type { HauntId, MinigameDef, MinigameId, Outcome } from '../../../shared/src/data/minigames.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { MinigameVars, MinigameView } from '../../../shared/src/protocol.ts';
import { giveGoods, giveHands, loseHands, purse } from './director.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import type { PlayerSession } from './player.ts';
import { questEvent } from './quests.ts';

/** How long an open game waits for its captain before it lapses (as if she walked away). */
export const MINI_LIFE_SEC = 180;
/** The shores' memory of a captain's games, and how many before the purses shrink. */
const WEARY_WINDOW = 30 * 60;
const WEARY_AFTER = 6;
/** A passing boat offers a game instead of the sea director's next encounter this often. */
export const SEA_MINI_CHANCE = 0.12;
/** After an ordinary landing, the party stumbles on a game this often. */
export const LANDING_MINI_CHANCE = 0.08;

export interface MiniLive {
  id: number;
  def: MinigameId;
  account: number;
  until: number;
  islandId: number | null;
  /** From an island's haunt (it counts as a landing for the quests), not a bonus or the sea. */
  scene: boolean;
  share: number;
  weary: number;
  step: string;
  done: boolean;
  stake: number;
  q?: number[];
  order?: number[][];
  qi: number;
  right: number;
  dice?: number[];
  keeper?: number[];
  bid?: [number, number];
  seq?: number[];
  pea?: number;
  swaps?: number[];
  palmed?: boolean;
  period?: number[];
  phase?: number[];
  hits: boolean[];
  price?: number;
  full?: number;
  reserve?: number;
  item?: Item;
  result?: { outcome: string; win: boolean; vars: MinigameVars };
}

interface MiniState {
  live: Map<number, MiniLive>;
  last: Map<number, MinigameId>;
  played: Map<number, number[]>;
  seq: number;
}

const states = new WeakMap<Game, MiniState>();
function st(game: Game): MiniState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { live: new Map(), last: new Map(), played: new Map(), seq: 1 }));
  return s;
}

/** The game a captain has open, if any. */
export function openMinigame(game: Game, s: PlayerSession): MiniLive | null {
  for (const l of st(game).live.values()) if (l.account === s.accountId && !l.done) return l;
  return null;
}

/** The shores' weariness with her: 1 fresh, ½ past six games in half an hour, ¼ past twelve. */
export function wearyOf(game: Game, s: PlayerSession): number {
  const list = (st(game).played.get(s.accountId) ?? []).filter((t) => game.now - t < WEARY_WINDOW);
  st(game).played.set(s.accountId, list);
  return list.length < WEARY_AFTER ? 1 : list.length < WEARY_AFTER * 2 ? 0.5 : 0.25;
}

function stakeOf(s: PlayerSession, def: MinigameDef, weary: number): number {
  return def.stake ? Math.max(10, Math.round(purse(s, def.stake) * weary)) : 0;
}

/** Whether a game may be offered to her here: its haunt or the sea, and her purse for a stake or a price. */
function offerable(game: Game, s: PlayerSession, def: MinigameDef, where: { haunt?: HauntId; sea?: boolean }): boolean {
  if (where.sea ? !def.sea : !def.haunts.includes(where.haunt!)) return false;
  const gold = s.profile!.gold;
  if (def.stake && gold < stakeOf(s, def, wearyOf(game, s))) return false;
  if (def.kind === 'haggle' && gold < purse(s, 150)) return false;
  return true;
}

/** The pick: weighted, fitting the place, never the one she played last (unless nothing else fits). */
export function pickMinigame(game: Game, s: PlayerSession, where: { haunt?: HauntId; sea?: boolean }): MinigameId | null {
  const last = st(game).last.get(s.accountId);
  const fit = MINIGAME_IDS.filter((id) => offerable(game, s, MINIGAMES[id], where));
  const pool = fit.filter((id) => id !== last);
  const use = pool.length ? pool : fit;
  if (!use.length) return null;
  return game.rng.weighted(use.map((id) => [id, MINIGAMES[id].weight] as [MinigameId, number]));
}

function shuffle(game: Game, n: number): number[] {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = game.rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const die = (game: Game) => game.rng.int(1, 6);

/** The haggle's full price of a piece of gear (the sea peddler's reckoning). */
function gearPrice(it: Item): number {
  return Math.round(120 * (1 + 0.06 * (it.ilvl - 1)) * it.ilvl * [1, 2.5, 6, 15, 40][it.rarity] * 0.8);
}

/** Opens a game for a captain: at an island's haunt, after a landing, or at sea. Null if she has one open or none fits. */
export function startMinigame(game: Game, s: PlayerSession, where: { haunt?: HauntId; sea?: boolean; islandId?: number; scene?: boolean; share?: number; def?: MinigameId }): MiniLive | null {
  if (!s.ship || !s.profile || openMinigame(game, s)) return null;
  const id = where.def ?? pickMinigame(game, s, where);
  if (!id) return null;
  const def = MINIGAMES[id];
  const S = st(game);
  const weary = wearyOf(game, s);
  const rng = game.rng;
  const live: MiniLive = {
    id: S.seq++, def: id, account: s.accountId, until: game.now + MINI_LIFE_SEC, islandId: where.islandId ?? null, scene: !!where.scene,
    share: where.share ?? 1, weary, step: def.start ?? 'play', done: false, stake: stakeOf(s, def, weary), qi: 0, right: 0, hits: [],
  };
  switch (def.kind) {
    case 'riddle':
    case 'stars': {
      const qs = def.questions!;
      live.q = shuffle(game, qs.length).slice(0, Math.min(def.rounds ?? 1, qs.length));
      live.order = live.q.map((qi) => shuffle(game, qs[qi].options.length));
      break;
    }
    case 'dice': {
      live.dice = Array.from({ length: 5 }, () => die(game));
      live.keeper = Array.from({ length: 5 }, () => die(game));
      // The keeper bids on his best face: what he holds, what he guesses of hers, and a bluff.
      const counts = [0, 0, 0, 0, 0, 0, 0];
      for (const d of live.keeper) counts[d]++;
      let face = 6;
      for (let f = 6; f >= 1; f--) if (counts[f] > counts[face]) face = f;
      const bluff = rng.weighted([[-1, 2], [0, 4], [1, 4], [2, 2]] as [number, number][]);
      live.bid = [Math.max(1, Math.min(9, counts[face] + 1 + bluff)), face];
      break;
    }
    case 'memory': {
      const k = def.symbols!.length;
      live.seq = Array.from({ length: def.length ?? 5 }, () => rng.int(0, k - 1));
      break;
    }
    case 'shells':
      live.pea = rng.int(0, 2);
      live.swaps = Array.from({ length: 8 }, () => rng.int(0, 2));
      live.palmed = rng.chance(0.18);
      break;
    case 'timing': {
      const n = def.tries ?? 3;
      live.period = Array.from({ length: n }, (_, i) => Math.round((def.period ?? 2200) * (1 - 0.12 * i)));
      live.phase = Array.from({ length: n }, () => Math.round(rng.float() * 1000) / 1000);
      break;
    }
    case 'haggle': {
      const it = makeItem(rng, 0, { ilvl: s.ship.shipLevel, rarity: rng.chance(0.25) ? 2 : 1 });
      live.item = it;
      live.full = gearPrice(it);
      live.price = live.full;
      live.reserve = Math.round(live.full * rng.range(0.62, 0.92));
      break;
    }
    default:
      break;
  }
  S.live.set(live.id, live);
  S.last.set(s.accountId, id);
  const played = S.played.get(s.accountId) ?? [];
  played.push(game.now);
  S.played.set(s.accountId, played);
  send(game, s, live);
  return live;
}

/** What the captain may see of a game (never the keeper's dice, the palmed pearl, or the trader's floor). */
export function minigameView(live: MiniLive): MinigameView {
  const v: MinigameView = { id: live.id, def: live.def, step: live.step };
  if (live.q) {
    v.q = live.q;
    v.order = live.order;
    v.qi = live.qi;
  }
  if (live.stake) v.stake = live.stake;
  if (live.dice) {
    v.dice = live.dice;
    v.bid = live.bid;
  }
  if (live.seq) v.seq = live.seq;
  if (live.swaps) {
    v.pea = live.pea;
    v.swaps = live.swaps;
  }
  if (live.period) {
    v.period = live.period;
    v.phase = live.phase;
    v.hits = live.hits;
  }
  if (live.item) {
    v.item = live.item;
    v.price = live.price;
  }
  if (live.weary < 1) v.weary = true;
  if (live.result) v.result = live.result;
  return v;
}

function send(game: Game, s: PlayerSession, live: MiniLive): void {
  game.sendTo(s, { t: 'minigame', view: minigameView(live) });
}

/** Where the pearl ends up after the swaps. */
export function shellsEnd(pea: number, swaps: number[]): number {
  const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]];
  let at = pea;
  for (const w of swaps) {
    const [a, b] = pairs[w];
    if (at === a) at = b;
    else if (at === b) at = a;
  }
  return at;
}

/** The needle's place (−1..1) `ms` into a try: a swing about the zone at 0. */
export function needleAt(period: number, phase: number, ms: number): number {
  return Math.sin(2 * Math.PI * (ms / period + phase));
}

/** A captain's move in her open game. */
export function playMinigame(game: Game, s: PlayerSession, id: number, pick: string, ms?: unknown, seq?: unknown): string | null {
  const live = st(game).live.get(id);
  if (!live || live.done || live.account !== s.accountId || !s.ship || !s.profile) return 'That moment has passed';
  const def = MINIGAMES[live.def];
  const rng = game.rng;
  if (pick === 'walk') return settle(game, s, live, 'walk');
  switch (def.kind) {
    case 'riddle':
    case 'stars': {
      const qi = live.q![live.qi];
      const opt = Math.trunc(Number(pick));
      if (!Number.isInteger(opt) || opt < 0 || opt >= def.questions![qi].options.length) return 'No such choice';
      if (opt === def.questions![qi].answer) live.right++;
      live.qi++;
      if (live.qi < live.q!.length) {
        send(game, s, live);
        return null;
      }
      return settle(game, s, live, `r${live.right}`);
    }
    case 'dice': {
      if (pick !== 'liar' && pick !== 'raise') return 'No such choice';
      const [count, face] = live.bid!;
      const total = [...live.dice!, ...live.keeper!].filter((d) => d === face).length;
      const win = pick === 'liar' ? total < count : total >= count + 1;
      return settle(game, s, live, win ? 'win' : 'lose', { roll: live.keeper, count: total });
    }
    case 'anchor': {
      const sym = Math.trunc(Number(pick));
      if (!Number.isInteger(sym) || sym < 0 || sym > 5) return 'No such choice';
      const roll = [rng.int(0, 5), rng.int(0, 5), rng.int(0, 5)];
      return settle(game, s, live, `h${roll.filter((r) => r === sym).length}`, { roll });
    }
    case 'coin': {
      if (pick === 'inspect') return settle(game, s, live, rng.chance(0.3) ? 'cheat' : 'honest');
      if (pick !== 'crown' && pick !== 'ship') return 'No such choice';
      if (rng.chance(0.04)) return settle(game, s, live, 'edge');
      const face = rng.int(0, 1);
      return settle(game, s, live, (face === 0) === (pick === 'crown') ? 'win' : 'lose', { roll: [face] });
    }
    case 'shells': {
      const end = shellsEnd(live.pea!, live.swaps!);
      if (pick === 'wrist') return settle(game, s, live, live.palmed ? 'caught' : 'wrong');
      const at = Math.trunc(Number(pick));
      if (!Number.isInteger(at) || at < 0 || at > 2) return 'No such choice';
      if (live.palmed) return settle(game, s, live, 'palmed');
      return settle(game, s, live, at === end ? 'win' : 'lose', { count: end });
    }
    case 'memory': {
      const got = Array.isArray(seq) ? seq.map((x) => Math.trunc(Number(x))) : [];
      const want = live.seq!;
      let wrong = Math.abs(got.length - want.length);
      for (let i = 0; i < Math.min(got.length, want.length); i++) if (got[i] !== want[i]) wrong++;
      return settle(game, s, live, wrong === 0 ? 'win' : wrong === 1 ? 'near' : 'lose');
    }
    case 'timing': {
      const t = Number(ms);
      if (!Number.isFinite(t) || t < 0 || t > 60000) return 'No such choice';
      const i = live.hits.length;
      live.hits.push(Math.abs(needleAt(live.period![i], live.phase![i], t)) < (def.zone ?? 0.2));
      if (live.hits.length < live.period!.length) {
        send(game, s, live);
        return null;
      }
      return settle(game, s, live, `t${live.hits.filter(Boolean).length}`);
    }
    case 'haggle': {
      const full = live.full!;
      let offer = 0;
      if (live.step === 'play') {
        if (pick === 'pay') offer = full;
        else if (pick === 'o80') offer = Math.round(full * 0.8);
        else if (pick === 'o60') offer = Math.round(full * 0.6);
        else return 'No such choice';
        if (offer < live.reserve!) {
          // Too low: he walks off in a huff, or comes down halfway.
          if (pick === 'o60' && rng.chance(0.45)) return settle(game, s, live, 'insulted');
          live.step = 'counter';
          live.price = Math.round((live.reserve! + full) / 2);
          send(game, s, live);
          return null;
        }
      } else {
        if (pick !== 'accept') return 'No such choice';
        offer = live.price!;
      }
      const p = s.profile;
      if (p.gold < offer) return settle(game, s, live, 'poor');
      if (!takeItem(game, s, live.item!)) return settle(game, s, live, 'full');
      p.gold -= offer;
      game.db.ledger(s.accountId, 'minigame', -offer, def.id);
      return settle(game, s, live, 'bought', { lost: offer, item: live.item });
    }
    case 'quest': {
      const stp = def.steps![live.step];
      const ch = stp?.choices.find((c) => c.id === pick);
      if (!ch) return 'No such choice';
      if (ch.go) {
        live.step = ch.go;
        send(game, s, live);
        return null;
      }
      if (ch.to) return settle(game, s, live, ch.to);
      return settle(game, s, live, rng.chance(ch.chance ?? 0.5) ? ch.win! : ch.lose!);
    }
  }
  return 'No such choice';
}

/** Pays or charges what an outcome says; fills the numbers for its words. */
function settle(game: Game, s: PlayerSession, live: MiniLive, outcome: string, extra: MinigameVars = {}): null {
  const def = MINIGAMES[live.def];
  const o: Outcome = def.outcomes[outcome] ?? def.outcomes.walk;
  live.done = true;
  const vars = payOut(game, s, live, o, extra);
  live.result = { outcome: def.outcomes[outcome] ? outcome : 'walk', win: o.win, vars };
  send(game, s, live);
  // A landing party at an island's haunt: the quests and the day's orders count it as a landing.
  if (live.scene && live.islandId !== null && outcome !== 'walk') questEvent(game, s, { k: 'land', island: live.islandId, feature: 'scene' });
  game.pushSelf(s, true);
  return null;
}

function payOut(game: Game, s: PlayerSession, live: MiniLive, o: Outcome, extra: MinigameVars): MinigameVars {
  const ship = s.ship!;
  const p = s.profile!;
  const rng = game.rng;
  const pay = o.pay;
  const gain = live.share * live.weary;
  const vars: MinigameVars = { ...extra };
  if (pay.silver) {
    const n = Math.round(purse(s, rng.int(pay.silver[0], pay.silver[1])) * gain);
    if (n > 0) {
      p.gold += n;
      game.db.ledger(s.accountId, 'minigame', n, live.def);
      vars.silver = n;
    }
  }
  if (pay.loseSilver) {
    const n = Math.min(p.gold, purse(s, rng.int(pay.loseSilver[0], pay.loseSilver[1])));
    p.gold -= n;
    if (n) game.db.ledger(s.accountId, 'minigame', -n, live.def);
    vars.lost = n;
  }
  if (pay.stake && live.stake) {
    const n = pay.stake > 0 ? live.stake * pay.stake : Math.min(p.gold, live.stake);
    p.gold += pay.stake > 0 ? n : -n;
    game.db.ledger(s.accountId, 'minigame', pay.stake > 0 ? n : -n, live.def);
    vars.stake = n;
  }
  if (pay.goods) {
    const [g, lo, hi] = pay.goods;
    vars.n = giveGoods(ship, g, Math.max(1, Math.round(rng.int(lo, hi) * gain)));
    vars.good = g;
  }
  if (pay.hands) giveHands(s, pay.hands);
  if (pay.crew) vars.crew = loseHands(s, pay.crew);
  if (pay.morale) ship.morale = Math.max(0, Math.min(100, ship.morale + pay.morale));
  if (pay.sanity) ship.sanity = Math.max(0, Math.min(100, ship.sanity + pay.sanity));
  if (pay.curse) ship.curse = Math.max(0, Math.min(100, ship.curse + pay.curse));
  if (pay.map) {
    const before = p.explore.maps.length;
    mapChance(game, s, pay.map * gain, 1, live.islandId === null ? 'A gift at sea' : 'Found ashore');
    if (p.explore.maps.length > before) vars.map = true;
  }
  if (pay.item && rng.chance(pay.item * gain)) {
    const it = makeItem(rng, 0, { ilvl: ship.shipLevel, source: 'common' });
    if (takeItem(game, s, it)) vars.item = it;
  }
  if (pay.xp) {
    const xp = Math.round(pay.xp * gain * (1 + 0.15 * (ship.shipLevel - 1)));
    if (xp > 0) {
      game.grantXp(s, xp, null);
      vars.xp = xp;
    }
  }
  return vars;
}

/** Every second: games left open too long lapse; a captain gone leaves hers behind. */
export function stepMinigames(game: Game): void {
  const S = st(game);
  for (const live of [...S.live.values()]) {
    if (live.done) {
      S.live.delete(live.id);
      continue;
    }
    const s = game.sessionByAccount(live.account);
    if (!s || !s.ship) {
      S.live.delete(live.id);
      continue;
    }
    if (game.now > live.until) {
      settle(game, s, live, 'walk');
      S.live.delete(live.id);
    }
  }
}

/** The sea director's hook: a passing boat offers a game (a riddle, dice, a hoist, the stars). */
export function seaMinigame(game: Game, s: PlayerSession): boolean {
  return !!startMinigame(game, s, { sea: true });
}

/** After an ordinary landing: now and then the party stumbles on a game at the island's haunt too. */
export function landingMinigame(game: Game, s: PlayerSession, islandId: number, share: number): void {
  if (!game.rng.chance(LANDING_MINI_CHANCE)) return;
  startMinigame(game, s, { haunt: islandHaunt(islandId), islandId, share });
}
