// The ship's army (docs/17 H1, «Heroes of Might and Magic III, only pirate»): a crew is not a number but up to seven
// stacks of fighting men — seven tiers, each with its upgraded kind — and the ship's class sets how many stacks she
// can carry. The head count the rest of the game reads (`ship.crew`) is always the sum of the stacks. Cannon fire
// kills men out of the stacks, the weaker and the less armoured first; the hull is the wall they stand behind.
// The boarding battle (server/src/game/tacbattle.ts) lays these stacks out on the hexes as they are.

import { BEASTS, SEA_BEASTS } from './bestiary.ts';
import type { BeastId, SeaBeastId } from './bestiary.ts';
import { FACTION_ELITES, FACTION_KINDS, FACTION_KIND_IDS, rosterKind } from './factionunits.ts';
import type { FactionKindId, Roster } from './factionunits.ts';
import { PREMIUM_BEASTS } from './premiumbeasts.ts';
import type { PremiumBeastId } from './premiumbeasts.ts';
import { SHIP_BEASTS, type ShipBeastId } from './shipbeasts.ts'; // the premium hulls' own kinds (owner, 2026-10-03)
import { BOSS_UNITS, type BossUnitId } from './bossunits.ts'; // the great ones ashore (2026-10-03), never hired

/** Every kind of fighting man: seven tiers, a plain and an upgraded kind of each — and the land's creatures beside
 *  them (docs/18 II, shared/src/data/bestiary.ts), the world's armies, the shop's creatures (premiumbeasts.ts), the
 *  premium hulls' own kinds (shipbeasts.ts) and the great ones ashore (bossunits.ts). */
export type UnitId = MenId | BeastId | SeaBeastId | FactionKindId | PremiumBeastId | ShipBeastId | BossUnitId;
export type MenId =
  | 'deckhand' | 'sailor'
  | 'marine' | 'sea_guard'
  | 'musketeer' | 'sharpshooter'
  | 'gunner' | 'bombardier'
  | 'boarder' | 'cutthroat'
  | 'guard' | 'life_guard'
  | 'drowned' | 'deep_spawn';

/** The men (the creatures' kinds are BEAST_IDS). */
export const UNIT_IDS: MenId[] = ['deckhand', 'sailor', 'marine', 'sea_guard', 'musketeer', 'sharpshooter', 'gunner', 'bombardier', 'boarder', 'cutthroat', 'guard', 'life_guard', 'drowned', 'deep_spawn'];

/** What makes a kind of man more than his numbers (as the specials of HoMM3's creatures). */
export type UnitSpecial =
  /** Fires from afar while no foe stands beside it; half its blow in melee. */
  | 'shooter'
  /** No penalty for long range nor for a foe at arm's length (the melee blow is full). */
  | 'no_penalty'
  /** A swivel gun's burst: the stacks beside the target are hit too. */
  | 'blast'
  /** Strikes twice. */
  | 'double_strike'
  /** Its blow is not answered. */
  | 'no_retaliation'
  /** Answers every blow of the round, not just the first. */
  | 'retaliate_all'
  /** Its side fights with a point more morale. */
  | 'leader'
  /** Never freezes with fear nor with a crew's broken heart. */
  | 'steady'
  /** Dead men: morale neither lifts nor breaks them. */
  | 'undead'
  /** The living beside the deep's own may freeze in terror. */
  | 'fear'
  /** Strikes every foe beside it at once, and none of them answers. */
  | 'sweep'
  /** Half the harm from shots (a wall of shields and hammocks). */
  | 'shield_wall'
  // docs/18 item 16: the land's creatures.
  /** A shell: shots barely scratch it (a little over a third of their harm). */
  | 'shell'
  /** Its bite poisons: the stack it struck loses men again as its next two turns come. */
  | 'poison'
  /** Many small things: every blow on it lands as from the flank, and its foes' answers are half as hard. */
  | 'swarm'
  /** It grows back: a share of its strength at the start of each of its turns. */
  | 'regen'
  /** The living beside it may freeze in terror as their turn comes (one in five). */
  | 'terror'
  /** Flies over the rocks, the palms, the surf and the stacks. */
  | 'flying'
  /** Goes into the surf and comes out of it anywhere along the shore (the surf is one water); half the harm from shots
   *  while it is in it. */
  | 'diving'
  // Owner, 2026-10-03 («около 100 существ»): the shop's creatures and the factions' healers and elites (docs/18 VII).
  /** A healer: as its turn comes, every living stack of its side within two hexes takes back a share of its strength. */
  | 'mend'
  /** One blow or shot in four binds the struck stack: it loses its next turn unless something strikes it first. */
  | 'bind'
  /** Its blow chills: the struck stack walks two hexes less and acts later to the end of the next round. */
  | 'chill'
  /** Half the harm it does the living comes back to it as strength (its fallen rise). */
  | 'drain'
  /** Its blow scalds the foe behind the struck one too, half as hard, and that one does not answer. */
  | 'breath'
  /** Its blow or shot leaps to one more foe beside the struck one, half as hard. */
  | 'chain'
  /** Its side fights with a point more luck. */
  | 'fortune';

export interface UnitDef {
  id: UnitId;
  tier: number;
  /** The upgraded kind of its tier. */
  up: boolean;
  /** The plain kind of its tier, and the upgrade of a plain kind (null for an upgraded one). */
  base: UnitId;
  upgrade: UnitId | null;
  atk: number;
  def: number;
  dmin: number;
  dmax: number;
  hp: number;
  speed: number;
  init: number;
  /** Shots it carries (0: steel only). */
  shots: number;
  specials: UnitSpecial[];
  /** The painted face it shows (the portraits and icons already in assets/). */
  art: string;
  /** Silver a man of this kind is worth (a ransom, the sea's reckoning of an army). */
  cost: number;
  /** Only the Choir's and the cursed ships carry them. */
  deep?: boolean;
  /** One of the land's creatures (docs/18 II), not a man. */
  beast?: boolean;
  /** A legend of the sea (docs/18 #40): the white whale, the young kraken — one a captain, never sold. */
  legend?: boolean;
  /** One of the world's armies (shared/src/data/factionunits.ts): whose, and the pirate kind it fights as. */
  roster?: Roster;
  as?: MenId;
  /** Sold for doubloons in the premium shop (shared/src/data/premium.ts, docs/01 P7) and found nowhere at sea. */
  premium?: PremiumUnit;
}

/** A kind sold for doubloons (owner, 2026-10-03): no tamer, lair, drift, roaming stack, capture nor egg ever hands it
 *  out — it comes only from the shop, or aboard the premium hull it is sold with (ShipClassDef.premium.beasts). */
export interface PremiumUnit {
  /** Doubloons for one purchase. */
  price: number;
  /** How many come in one purchase: one great beast, or a stack of small ones. */
  n: number;
  /** What sets it apart, the line on its card: English, Russian. */
  note: [string, string];
}

const U = (id: UnitId, tier: number, up: boolean, base: UnitId, upgrade: UnitId | null, s: Omit<UnitDef, 'id' | 'tier' | 'up' | 'base' | 'upgrade'>): UnitDef => ({ id, tier, up, base, upgrade, ...s });

/** One man of each kind (the HoMM3 scale: a pikeman 4/5 1–3 10 hp, a black dragon 25/25 40–50 300 hp). */
const BASE_UNITS: Record<MenId | BeastId | SeaBeastId, UnitDef> = {
  ...BEASTS,
  ...SEA_BEASTS,
  deckhand: U('deckhand', 1, false, 'deckhand', 'sailor', { atk: 3, def: 2, dmin: 1, dmax: 2, hp: 5, speed: 4, init: 5, shots: 0, specials: [], art: 'portrait.pirate_15', cost: 20 }),
  sailor: U('sailor', 1, true, 'deckhand', null, { atk: 4, def: 3, dmin: 1, dmax: 3, hp: 6, speed: 4, init: 6, shots: 0, specials: [], art: 'portrait.giver_old_salt_m', cost: 30 }),
  marine: U('marine', 2, false, 'marine', 'sea_guard', { atk: 7, def: 6, dmin: 2, dmax: 4, hp: 9, speed: 4, init: 7, shots: 0, specials: [], art: 'portrait.pirate_06', cost: 60 }),
  sea_guard: U('sea_guard', 2, true, 'marine', null, { atk: 8, def: 8, dmin: 3, dmax: 4, hp: 11, speed: 5, init: 8, shots: 0, specials: ['shield_wall'], art: 'portrait.giver_garrison_captain_m', cost: 80 }),
  musketeer: U('musketeer', 3, false, 'musketeer', 'sharpshooter', { atk: 6, def: 3, dmin: 2, dmax: 3, hp: 6, speed: 3, init: 5, shots: 4, specials: ['shooter'], art: 'portrait.pirate_09', cost: 70 }),
  sharpshooter: U('sharpshooter', 3, true, 'musketeer', null, { atk: 8, def: 4, dmin: 2, dmax: 4, hp: 7, speed: 3, init: 7, shots: 6, specials: ['shooter', 'no_penalty'], art: 'portrait.pirate_23', cost: 100 }),
  gunner: U('gunner', 4, false, 'gunner', 'bombardier', { atk: 8, def: 5, dmin: 3, dmax: 6, hp: 10, speed: 3, init: 5, shots: 2, specials: ['shooter', 'blast'], art: 'portrait.res_gunner_m', cost: 120 }),
  bombardier: U('bombardier', 4, true, 'gunner', null, { atk: 9, def: 6, dmin: 4, dmax: 7, hp: 12, speed: 3, init: 6, shots: 3, specials: ['shooter', 'blast'], art: 'portrait.pirate_00', cost: 160 }),
  boarder: U('boarder', 5, false, 'boarder', 'cutthroat', { atk: 10, def: 8, dmin: 4, dmax: 6, hp: 16, speed: 5, init: 8, shots: 0, specials: ['double_strike'], art: 'portrait.pirate_03', cost: 180 }),
  cutthroat: U('cutthroat', 5, true, 'boarder', null, { atk: 12, def: 9, dmin: 5, dmax: 7, hp: 18, speed: 6, init: 10, shots: 0, specials: ['double_strike', 'no_retaliation'], art: 'portrait.pirate_16', cost: 240 }),
  guard: U('guard', 6, false, 'guard', 'life_guard', { atk: 13, def: 12, dmin: 6, dmax: 9, hp: 25, speed: 5, init: 9, shots: 0, specials: ['leader', 'steady'], art: 'portrait.pirate_14', cost: 300 }),
  life_guard: U('life_guard', 6, true, 'guard', null, { atk: 15, def: 14, dmin: 7, dmax: 10, hp: 30, speed: 6, init: 10, shots: 0, specials: ['leader', 'steady', 'retaliate_all'], art: 'portrait.pirate_21', cost: 400 }),
  drowned: U('drowned', 7, false, 'drowned', 'deep_spawn', { atk: 14, def: 12, dmin: 8, dmax: 12, hp: 35, speed: 4, init: 7, shots: 0, specials: ['undead', 'fear'], art: 'portrait.pirate_22', cost: 450, deep: true }),
  deep_spawn: U('deep_spawn', 7, true, 'drowned', null, { atk: 17, def: 15, dmin: 10, dmax: 15, hp: 45, speed: 5, init: 9, shots: 0, specials: ['undead', 'fear', 'sweep'], art: 'icon.ab_deep_call', cost: 600, deep: true }),
};

/** The world's armies: each faction's kind fights with the numbers of the pirate kind whose place it takes, its plain
 *  and upgraded kinds paired as the pirates' are; its face is the pirate kind's until its own figure is painted. An
 *  elite (FACTION_ELITES) keeps the place's health, defence and pace and brings its own blows and craft. */
function factionUnits(): Record<FactionKindId, UnitDef> {
  const out = {} as Record<FactionKindId, UnitDef>;
  for (const id of FACTION_KIND_IDS) {
    const { roster, as } = FACTION_KINDS[id];
    const t = BASE_UNITS[as];
    out[id] = { ...t, ...FACTION_ELITES[id]?.own, id, base: rosterKind(roster, t.base as MenId), upgrade: t.upgrade ? rosterKind(roster, t.upgrade as MenId) : null, roster, as };
  }
  return out;
}

export const UNITS: Record<UnitId, UnitDef> = { ...BASE_UNITS, ...factionUnits(), ...PREMIUM_BEASTS, ...SHIP_BEASTS, ...BOSS_UNITS };

export const hasSpecial = (u: UnitId, s: UnitSpecial): boolean => UNITS[u].specials.includes(s);

/** A kind only the premium shop sells: every free source passes it over. */
export const isPremiumUnit = (u: UnitId): boolean => !!UNITS[u]?.premium;

/** One slot of the army: a kind of man and how many of him. */
export interface ArmyStack {
  u: UnitId;
  n: number;
}

export const ARMY_SLOTS_MAX = 7;

/** Stacks a hull carries by her class's tier: a sloop four, a brigantine five, a brig six, a galleon and up seven. */
export function armySlots(tier: number): number {
  return Math.max(3, Math.min(ARMY_SLOTS_MAX, 3 + Math.round(tier)));
}

export function armyMen(army: readonly ArmyStack[]): number {
  let n = 0;
  for (const s of army) n += s.n;
  return n;
}

/** Same kinds in one slot, empty slots gone, the strongest first (as the stacks stand in the ship's screen). */
export function armyTidy(army: readonly ArmyStack[]): ArmyStack[] {
  const by = new Map<UnitId, number>();
  for (const s of army) if (s && UNITS[s.u] && s.n > 0) by.set(s.u, (by.get(s.u) ?? 0) + Math.floor(s.n));
  return [...by].map(([u, n]) => ({ u, n })).sort((a, b) => UNITS[b.u].tier - UNITS[a.u].tier || Number(UNITS[b.u].up) - Number(UNITS[a.u].up));
}

/** How exposed one man of a kind is to shot and splinters beside a deckhand: the tougher and the better covered, the
 *  fewer fall (his hit points, and his defence as HoMM3 reckons it, 5% a point). */
export function exposure(u: UnitId): number {
  const d = UNITS[u], t1 = UNITS.deckhand;
  return (t1.hp / d.hp) * ((1 + 0.05 * t1.def) / (1 + 0.05 * d.def));
}

/** Men of this army that fall where a deckhand crew would lose one (1 for deckhands, less for tougher stacks). */
export function armyKillFactor(army: readonly ArmyStack[]): number {
  const m = armyMen(army);
  if (m <= 0) return 1;
  let w = 0;
  for (const s of army) w += s.n * exposure(s.u);
  return w / m;
}

/** Take `k` men off the army (in place), the stacks losing by their share of the exposed men; what each lost. */
export function armyRemove(army: ArmyStack[], k: number): ArmyStack[] {
  const out = new Map<UnitId, number>();
  let left = Math.max(0, Math.floor(k));
  for (let guard = 0; left > 0 && guard < 20; guard++) {
    const live = army.filter((s) => s.n > 0);
    if (!live.length) break;
    const w = live.map((s) => s.n * exposure(s.u));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    const want = live.map((s, i) => (left * w[i]) / tot);
    const take = live.map((s, i) => Math.min(s.n, Math.floor(want[i])));
    let rest = left - take.reduce((a, b) => a + b, 0);
    // The largest remainders take the rest (a tie falls on the lower tier).
    const order = live.map((_, i) => i).sort((a, b) => want[b] - Math.floor(want[b]) - (want[a] - Math.floor(want[a])) || UNITS[live[a].u].tier - UNITS[live[b].u].tier);
    for (const i of order) {
      if (rest <= 0) break;
      if (take[i] < live[i].n) {
        take[i]++;
        rest--;
      }
    }
    live.forEach((s, i) => {
      if (!take[i]) return;
      s.n -= take[i];
      left -= take[i];
      out.set(s.u, (out.get(s.u) ?? 0) + take[i]);
    });
  }
  for (let i = army.length - 1; i >= 0; i--) if (army[i].n <= 0) army.splice(i, 1);
  return [...out].map(([u, n]) => ({ u, n }));
}

/** One man's hit points against shot and splinters: his health with his defence as HoMM3 reckons it, 5% a point (a
 *  deckhand's 5.5). `exposure` is a deckhand's over his. */
export function shotHp(u: UnitId): number {
  const d = UNITS[u];
  return d.hp * (1 + 0.05 * d.def);
}

/** The order the cannon's dead fall in (docs/24 B3, owner 2026-10-07: «убиваются сперва существа с маленьким HP и
 *  потом по возрастанию»): the fewest hit points a man first, then the less armoured, the lower tier, the plain kind. */
export function shotOrder(army: readonly ArmyStack[]): ArmyStack[] {
  return [...army].sort((a, b) => UNITS[a.u].hp - UNITS[b.u].hp || UNITS[a.u].def - UNITS[b.u].def || UNITS[a.u].tier - UNITS[b.u].tier || Number(UNITS[a.u].up) - Number(UNITS[b.u].up));
}

/** The cannon's dead (docs/24 B3), in place: a hit worth `k` men of the army as she stands (the hit points the old
 *  reckoning by exposure took with them — `k` times her men's harmonic mean of `shotHp`, so a shot weighs what it
 *  weighed) falls on the stack with the fewest hit points a man until it is gone, then on the next, and up, as
 *  HoMM3's damage rolls over its stacks. What is left of it wounds the next man (`wound` in, the new wound out, in
 *  hit points). No more than `cap` men fall (a floor the ladder keeps). Returns what each stack lost. */
export function armyShot(army: ArmyStack[], k: number, wound = 0, cap = Infinity): { lost: ArmyStack[]; wound: number } {
  const lost: ArmyStack[] = [];
  let inv = 0;
  for (const s of army) if (s.n > 0) inv += s.n / shotHp(s.u);
  if (inv <= 0) return { lost, wound: 0 };
  let left = Math.max(0, k) * (armyMen(army) / inv) + Math.max(0, wound);
  let out = 0;
  let room = Math.max(0, Math.floor(cap));
  for (const s of shotOrder(army)) {
    if (s.n <= 0) continue;
    const per = shotHp(s.u);
    const kill = Math.min(s.n, room, Math.floor((left + 1e-9) / per));
    if (kill > 0) {
      s.n -= kill;
      room -= kill;
      left -= kill * per;
      lost.push({ u: s.u, n: kill });
    }
    if (room <= 0) break;
    if (s.n > 0) {
      out = Math.max(0, Math.min(per, left));
      break;
    }
  }
  for (let i = army.length - 1; i >= 0; i--) if (army[i].n <= 0) army.splice(i, 1);
  return { lost, wound: army.length ? out : 0 };
}

/** Put `n` men of a kind aboard (in place): into their own stack, a new slot, or — the slots full — the lowest stack. */
export function armyAdd(army: ArmyStack[], n: number, slots: number, u: UnitId = 'deckhand'): void {
  n = Math.floor(n);
  if (n <= 0) return;
  const own = army.find((s) => s.u === u);
  if (own) {
    own.n += n;
    return;
  }
  if (army.length < slots) {
    army.push({ u, n });
    return;
  }
  let low = army[0];
  for (const s of army) if (UNITS[s.u].tier < UNITS[low.u].tier || (UNITS[s.u].tier === UNITS[low.u].tier && !UNITS[s.u].up)) low = s;
  if (low) low.n += n;
  else army.push({ u, n });
}

/** Keep at most `slots` stacks (in place): the smallest folded into the lowest that stays. */
export function armyFit(army: ArmyStack[], slots: number): void {
  const t = armyTidy(army);
  army.length = 0;
  army.push(...t);
  while (army.length > slots) {
    let small = 0;
    for (let i = 1; i < army.length; i++) if (army[i].n < army[small].n) small = i;
    const [s] = army.splice(small, 1);
    let low = 0;
    for (let i = 1; i < army.length; i++) if (UNITS[army[i].u].tier < UNITS[army[low].u].tier) low = i;
    army[low].n += s.n;
  }
}

/** Whose men a ship carries: a merchant's hands, a pirate's boarders, a navy's marines and guards, the deep's dead, a
 *  captain's company, a boss's picked crew. */
export type ArmyMix = 'merchant' | 'pirate' | 'navy' | 'deep' | 'player' | 'boss';

/** Each tier's share against the ladder's rule, by who she is (tier 1 takes whatever is left). The pirates' row is
 *  their own (`pirateShares`): a few marines, many shooters, gunners, some boarders. */
const MIX: Record<ArmyMix, number[]> = {
  merchant: [1, 0, 0.4, 0, 0, 0, 0],
  pirate: [1, 1, 1.3, 0.7, 1, 0.5, 0],
  navy: [1, 1.4, 1.2, 1.2, 0.6, 1.5, 0],
  deep: [1, 0.6, 0.6, 0.4, 1, 0.5, 2.5],
  player: [1, 1, 1, 0.8, 0.8, 0.6, 0],
  boss: [1, 1.3, 1.3, 1.3, 1.5, 1.5, 1],
};

const TIER_BASE: UnitId[] = ['deckhand', 'marine', 'musketeer', 'gunner', 'boarder', 'guard', 'drowned'];

/** The share of each tier a crew of ship level ⚓`level` (1–10) carries, before the mix. */
function tierShares(level: number): number[] {
  const L = Math.max(1, Math.min(10, level));
  return [
    0,
    Math.min(0.25, 0.03 * L),
    Math.min(0.2, 0.025 * L),
    L >= 3 ? Math.min(0.12, 0.02 * (L - 2)) : 0,
    L >= 4 ? Math.min(0.12, 0.02 * (L - 3)) : 0,
    L >= 6 ? Math.min(0.06, 0.015 * (L - 5)) : 0,
    L >= 5 ? Math.min(0.12, 0.02 * (L - 4)) : 0,
  ];
}

/** The upgraded share of every tier at ship level ⚓`level`: none at ⚓1, four in five at ⚓9 and up. */
export function upgradedShare(level: number): number {
  return Math.max(0, Math.min(0.8, 0.1 * (Math.max(1, level) - 1)));
}

/** The sea's pirates (docs/17, after H5): the hands, marines, many musketeers, gunners and some boarders — one kind
 *  a tier above the hands, the plain kinds to ⚓8 and the upgraded from ⚓9 (PIRATE_UP_LEVEL). Their marines and
 *  musketeers (the first number) and their gunners, boarders and guards (the second) are scaled by PIRATE_CAL,
 *  measured by the boarding battle itself so that the ladder's own crew of the level and her hammocks wins half the
 *  boardings at every level (`node tools/balance-h5.ts`; tests/heroes6.test.ts holds it). At ⚓1–2, before the
 *  gunners and the boarders, a pirate's crew is the sea's common one. (Eight kinds folded into seven slots made a
 *  pirate's might jump with a man more or less; one kind a tier keeps it smooth in the head count.) */
export const PIRATE_CAL: [number, number][] = [[1, 1], [1, 1], [1, 1], [0.6, 1.8], [1.4, 1], [0.5, 1], [0.63, 0.63], [0.76, 0.76], [0.92, 0.92], [0.69, 0.69], [0.69, 0.69]];
export const PIRATE_UP_LEVEL = 9;

function pirateShares(level: number): { u: UnitId; x: number }[] {
  const L = Math.max(1, Math.min(10, Math.round(level)));
  const [common, elite] = PIRATE_CAL[L];
  const share = tierShares(L).map((b, i) => (i ? b * MIX.pirate[i] * (i >= 3 ? elite : common) : 0));
  const upper = share.reduce((a, b) => a + b, 0);
  const k = upper > 0.75 ? 0.75 / upper : 1;
  for (let i = 1; i < 7; i++) share[i] *= k;
  share[0] = 1 - share.reduce((a, b) => a + b, 0);
  const up = upgradedShare(L);
  const out: { u: UnitId; x: number }[] = [{ u: 'deckhand', x: share[0] * (1 - up) }, { u: 'sailor', x: share[0] * up }];
  for (let i = 1; i < 7; i++) if (share[i] > 0) out.push({ u: L >= PIRATE_UP_LEVEL ? UNITS[TIER_BASE[i]].upgrade! : TIER_BASE[i], x: share[i] });
  return out;
}

/** An army of `men` for a crew of ship level ⚓`level`, spread over the tiers by the ladder and the mix, in at most
 *  `slots` stacks. No dice: the same ship always carries the same men. */
export function armyForLevel(level: number, men: number, slots: number, mix: ArmyMix = 'player'): ArmyStack[] {
  men = Math.max(0, Math.floor(men));
  if (men <= 0) return [];
  const want: { u: UnitId; x: number }[] = [];
  if (mix === 'pirate' && level >= 3) for (const w of pirateShares(level)) want.push({ u: w.u, x: w.x * men });
  else {
    const base = tierShares(level);
    const m = MIX[mix === 'pirate' ? 'player' : mix];
    const share = base.map((b, i) => (i ? b * m[i] : 0));
    const upper = share.reduce((a, b) => a + b, 0);
    const k = upper > 0.75 ? 0.75 / upper : 1;
    for (let i = 1; i < 7; i++) share[i] *= k;
    share[0] = 1 - share.reduce((a, b) => a + b, 0);
    const up = upgradedShare(level);
    share.forEach((s, i) => {
      if (s <= 0) return;
      const b = TIER_BASE[i];
      const upg = UNITS[b].upgrade!;
      want.push({ u: b, x: s * (1 - up) * men });
      if (up > 0) want.push({ u: upg, x: s * up * men });
    });
  }
  // Whole men by the largest remainders; a kind under one man is not a stack.
  const alloc = want.map((w) => ({ u: w.u, n: Math.floor(w.x), r: w.x - Math.floor(w.x) }));
  let rest = men - alloc.reduce((a, b) => a + b.n, 0);
  for (const a of [...alloc].sort((x, y) => y.r - x.r)) {
    if (rest <= 0) break;
    a.n++;
    rest--;
  }
  const army = alloc.filter((a) => a.n > 0).map((a) => ({ u: a.u, n: a.n }));
  armyFit(army, slots);
  return army;
}

/** The army's might as the sea reckons it (for its captains' choices and quick sums): each man's hit points by his
 *  mean blow, lifted by his attack and defence. */
export function armyPower(army: readonly ArmyStack[]): number {
  let p = 0;
  for (const s of army) {
    const d = UNITS[s.u];
    p += s.n * d.hp * ((d.dmin + d.dmax) / 2) * (1 + 0.05 * (d.atk + d.def) / 2) * (d.shots ? 1.15 : 1);
  }
  return p;
}

/** The army's weight in a boarding battle (docs/17 H5): HoMM3's square law — the fight an army puts up grows with
 *  its blows times its hit points, not man by man — as the head count of plain deckhands it is worth. A few elite men
 *  are no longer reckoned a whole crew. */
export function armyWeight(army: readonly ArmyStack[]): number {
  let blows = 0, hp = 0;
  for (const s of army) {
    const d = UNITS[s.u];
    const k = 1 + 0.05 * (d.atk + d.def) / 2;
    blows += s.n * ((d.dmin + d.dmax) / 2) * k * (d.shots ? 1.15 : 1) * (d.specials.includes('double_strike') ? 1.5 : 1);
    hp += s.n * d.hp * k;
  }
  const one = UNITS.deckhand;
  const k1 = 1 + 0.05 * (one.atk + one.def) / 2;
  return Math.sqrt((blows * hp) / (((one.dmin + one.dmax) / 2) * k1 * one.hp * k1));
}

/** Silver the army is worth, man by man. */
export function armyCost(army: readonly ArmyStack[]): number {
  let c = 0;
  for (const s of army) c += s.n * UNITS[s.u].cost;
  return c;
}

/** HoMM3's words for the size of an army seen from afar: Few 1–4, Several 5–9, Pack 10–19, Lots 20–49, Horde 50–99,
 *  Throng 100–249, Swarm 250 and more. */
export const ARMY_WORD_MIN = [1, 5, 10, 20, 50, 100, 250];
export const ARMY_WORDS = ['few', 'several', 'pack', 'lots', 'horde', 'throng', 'swarm'] as const;
export type ArmyWord = (typeof ARMY_WORDS)[number];

export function armyWord(men: number): ArmyWord {
  let i = 0;
  for (let k = 0; k < ARMY_WORD_MIN.length; k++) if (men >= ARMY_WORD_MIN[k]) i = k;
  return ARMY_WORDS[i];
}

/** A saved army made whole against the head count it was saved with (docs/17 H1): a save from before the stacks
 *  becomes the ladder's spread of its level (deckhands and sailors, and the higher tiers as the level allows); one
 *  that disagrees with its count loses men by exposure or signs deckhands on. */
export function armyFromSave(saved: unknown, crew: number, level: number, slots: number): ArmyStack[] {
  crew = Math.max(0, Math.floor(Number.isFinite(crew) ? crew : 0));
  if (!Array.isArray(saved)) return armyForLevel(level, crew, slots, 'player');
  const army = armyTidy(saved.filter((s): s is ArmyStack => !!s && typeof s === 'object' && typeof (s as ArmyStack).u === 'string' && Number.isFinite((s as ArmyStack).n)));
  armyFit(army, slots);
  const d = crew - armyMen(army);
  if (d < 0) armyRemove(army, -d);
  else if (d > 0) armyAdd(army, d, slots);
  return armyTidy(army);
}
