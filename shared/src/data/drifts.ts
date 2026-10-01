// Drifting creatures (docs/18 IV, items 34–42): what drifts on the open sea now and then — an injured serpent on
// wreckage, seals on an ice floe, the drowned in a boat, a mermaid in a fisherman's nets, a turtle caught in the weed,
// gulls on a floating mast, a tentacle fouled in a lost anchor chain — and, once a season, a legend (the white whale,
// the young kraken); the ways a captain may save them without a fight (cut the nets, drive the sharks off, haul them
// out, lure them with fish, read the rite over the drowned, bind a wound) and how her crew's numbers, her skills and
// her path weigh on the chance; what they give, joining as a stack or as a gift; the share of the beaten who may
// follow her after a fight won; and the creatures as a family of the army — their peoples (the morale of a mixed army,
// HoMM3's), their own food (fish, rum or bone for the drowned), their attachment (hunger and low morale send them
// away; fed and victorious, they rise in rank), the pen on her island that keeps those beyond her slots, and the
// tamers of some ports who buy and sell them. Everything here is a function of its arguments: the server rolls the
// dice on its own Rng, and the client, the tests and the balance tools read the same numbers.

import type { CaptainId } from './captains.ts';
import { UNITS } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import { advHour, advLevelXp, guardBaseMight } from './advmap.ts';
import { armyPower } from './army.ts';
import { CREATURE_IDS, isCreature } from './bestiary.ts';
import type { CreatureId } from './bestiary.ts';
import type { Tr } from './estate.ts';
import type { GoodId } from './goods.ts';
import { GOODS } from './goods.ts';
import { GROWTH } from './town.ts';
import type { IsleType } from '../world/archipelago.ts';
import type { RegionId } from '../world/regions.ts';
import { Rng, hashString } from '../rng.ts';

// ------------------------------------------------------------------------------------------------ 38. the peoples

/** The peoples of an army, as HoMM3's towns: the crew (men), the deep's own (the drowned, the Choir), the sea's
 *  creatures and the land's beasts. */
export type People = 'men' | 'deep' | 'sea' | 'land';
export const PEOPLES: People[] = ['men', 'deep', 'sea', 'land'];

const CREATURE_PEOPLE: Record<CreatureId, Exclude<People, 'men'>> = {
  crab: 'land', gull: 'land', seal: 'sea', reef_shark: 'sea', rock_turtle: 'land', marsh_serpent: 'land', hermit: 'land', lagoon_tentacle: 'sea',
  cultist: 'deep', surf_drowned: 'deep', young_serpent: 'sea', lantern_maw: 'deep', ancient_turtle: 'land', shoal_leviathan: 'sea',
  mermaid: 'sea', sea_turtle: 'sea', white_whale: 'sea', young_kraken: 'deep',
};

export function peopleOf(u: UnitId): People {
  if (isCreature(u)) return CREATURE_PEOPLE[u];
  return u === 'drowned' || u === 'deep_spawn' ? 'deep' : 'men';
}

/** The path that keeps a people as its own (docs/18 #38): the Drowned with the deep's, the Navigator with the sea's,
 *  the Reaver with the land's beasts. */
export const NATIVE: Partial<Record<CaptainId, People>> = { drowned: 'deep', navigator: 'sea', reaver: 'land' };

/** The morale a mixed army fights with (HoMM3's): a point less for every people beyond the first, the crew and the
 *  path's own counted as one. An army of men alone — as every ship of the sea and every ladder's crew — is as it was
 *  (the docs/17 targets do not move); only creatures aboard can split it. −3 at the worst. */
export function mixMorale(army: readonly { u: UnitId; n: number }[], path: CaptainId | null | undefined): number {
  if (!army.some((s) => s.n > 0 && UNITS[s.u]?.beast)) return 0;
  const native = path ? NATIVE[path] : undefined;
  const set = new Set<People>();
  for (const s of army) {
    if (!(s.n > 0)) continue;
    const p = peopleOf(s.u);
    set.add(p === native ? 'men' : p);
  }
  return -Math.min(3, Math.max(0, set.size - 1));
}

/** The peoples of an army as the screens list them (the path's own marked). */
export function armyPeoples(army: readonly { u: UnitId; n: number }[], path: CaptainId | null | undefined): { p: People; n: number; native: boolean }[] {
  const by = new Map<People, number>();
  for (const s of army) if (s.n > 0) by.set(peopleOf(s.u), (by.get(peopleOf(s.u)) ?? 0) + s.n);
  const native = path ? NATIVE[path] : undefined;
  return PEOPLES.filter((p) => by.has(p)).map((p) => ({ p, n: by.get(p)!, native: p === native }));
}

export const PEOPLE_NAME: Record<People, Tr> = { men: ['the crew', 'команда'], deep: ['the deep’s own', 'глубинные'], sea: ['sea creatures', 'морские твари'], land: ['land beasts', 'звери суши'] };

// ------------------------------------------------------------------------------------------------ 37. their food

/** What a creature eats instead of provisions: fish (fresh, salted or smoked) for the sea's and the land's, rum —
 *  or the land's bone from her store — for the deep's. */
export type Food = 'fish' | 'rum';
export const foodOf = (u: UnitId): Food => (peopleOf(u) === 'deep' ? 'rum' : 'fish');

/** Units of its food a creature eats a minute at sea, by its tier (a crew man eats 0.15 provisions). */
export const FOOD_PER_MIN: Record<Food, number> = { fish: 0.03, rum: 0.012 };
export function foodPerMin(u: UnitId, n = 1): number {
  const d = UNITS[u];
  if (!d?.beast) return 0;
  return FOOD_PER_MIN[foodOf(u)] * d.tier * Math.max(0, n) * (d.legend ? 2 : 1);
}

/** The hold's goods a creature eats as its food, and how many units of it each is. */
export const FOOD_GOODS: Record<Food, [GoodId, number][]> = {
  fish: [['fish', 1], ['salted_fish', 2], ['smoked_fish', 2], ['prime_fish', 1]],
  rum: [['rum', 1]],
};

/** Silver a unit of each food is reckoned at (the cheapest good that feeds it). */
export const FOOD_VALUE: Record<Food, number> = { fish: GOODS.fish.basePrice, rum: GOODS.rum.basePrice };

/** Silver an hour the creatures of an army cost to feed at sea (fish and rum at their base prices). */
export function upkeepHour(army: readonly ArmyStack[]): number {
  let v = 0;
  for (const s of army) v += foodPerMin(s.u, s.n) * 60 * FOOD_VALUE[foodOf(s.u)];
  return v;
}

// ------------------------------------------------------------------------------------------------ 39. attachment

/** Seconds a creature goes unfed before it is hungry (a word on the screens), and before it may slip away. */
export const HUNGRY_AFTER = 120;
export const SLIP_AFTER = 300;
/** Each minute a starving kind may slip over the side — this share of it — and with the crew's morale under
 *  LOW_MORALE, any creature kind may, less often. */
export const SLIP_CHANCE = 0.3;
export const SLIP_SHARE = 0.2;
export const LOW_MORALE = 30;
export const LOW_SLIP_CHANCE = 0.1;
export const LOW_SLIP_SHARE = 0.1;

/** Battles won, fed, that raise a kind a rank (the third is its upgrade): seasoned, hardened, elder. Each rank lifts
 *  its attack, defence and hit points by a tenth (HoMM3's experience, as WoG gave it). */
export const RANK_WINS = [0, 3, 7, 12];
export const RANK_MAX = 3;
export const RANK_BONUS = 0.1;
export const RANK_NAME: Tr[] = [['', ''], ['seasoned', 'бывалые'], ['hardened', 'закалённые'], ['elder', 'матёрые']];
export function rankFor(wins: number): number {
  let r = 0;
  for (let k = 1; k <= RANK_MAX; k++) if (wins >= RANK_WINS[k]) r = k;
  return r;
}

// ------------------------------------------------------------------------------------------------ 34. the drifts

export type DriftKind = 'serpent_wreck' | 'seal_floe' | 'drowned_boat' | 'mermaid_net' | 'turtle_weed' | 'gull_mast' | 'tentacle_chain' | 'white_whale' | 'young_kraken';
export const DRIFT_KINDS: DriftKind[] = ['serpent_wreck', 'seal_floe', 'drowned_boat', 'mermaid_net', 'turtle_weed', 'gull_mast', 'tentacle_chain', 'white_whale', 'young_kraken'];
export const LEGEND_KINDS: DriftKind[] = ['white_whale', 'young_kraken'];

/** How a captain may save them without a fight (docs/18 #35). */
export type RescueWay = 'cut' | 'shoot' | 'haul' | 'feed' | 'rite' | 'heal';
export const RESCUE_WAYS: RescueWay[] = ['cut', 'shoot', 'haul', 'feed', 'rite', 'heal'];

/** What a saved drift gives instead of joining (no room, or the drowned for a living crew). */
export interface DriftGift {
  good: GoodId;
  /** A share of the worth (the rest silver). */
  share: number;
}

export interface DriftDef {
  kind: DriftKind;
  name: Tr;
  text: Tr;
  /** The creature, and the share of the guards' might its group is reckoned at (docs/17 H4's guardBaseMight). */
  u: CreatureId;
  share: number;
  lv: [number, number];
  /** Waters it is met in (absent: any but the Abyss), and how often against the others. */
  regions?: RegionId[];
  weight: number;
  ways: RescueWay[];
  gift: DriftGift;
  /** The battlefield its fight is laid on (the wreckage, the floe, the weed: the land field's kinds). */
  field: IsleType;
  /** Sharks round it: driving them off is one of its ways. */
  sharks?: boolean;
  /** A legend of the season (docs/18 #40). */
  legend?: boolean;
}

const D = (kind: DriftKind, name: Tr, text: Tr, u: CreatureId, share: number, lv: [number, number], weight: number, ways: RescueWay[], gift: DriftGift, field: IsleType, o: Partial<Pick<DriftDef, 'regions' | 'sharks' | 'legend'>> = {}): DriftDef =>
  ({ kind, name, text, u, share, lv, weight, ways, gift, field, ...o });

export const DRIFTS: Record<DriftKind, DriftDef> = {
  serpent_wreck: D('serpent_wreck', ['Serpent on the Wreckage', 'Змей на обломках'], ['A young serpent, torn by a harpoon, lies coiled over a raft of broken spars. It watches the ship with one eye.', 'Молодой змей, разорванный гарпуном, лежит, обвившись вокруг плота из сломанных рей, и следит за кораблём одним глазом.'], 'young_serpent', 0.32, [5, 10], 2, ['heal', 'feed', 'haul'], { good: 'serpent_scale', share: 0.4 }, 'graveyard'),
  seal_floe: D('seal_floe', ['Seals on a Floe', 'Тюлени на льдине'], ['A rotten floe drifts south with a rookery on it; the ice cracks under the bulls with every swell.', 'Гнилая льдина дрейфует на юг с целым лежбищем; под самцами лёд трещит на каждой волне.'], 'seal', 0.25, [1, 6], 3, ['haul', 'feed', 'shoot'], { good: 'fish', share: 0.3 }, 'rocky', { regions: ['leviathan_reach', 'whispering', 'gravewater', 'black_coast', 'ashen_isles'], sharks: true }),
  drowned_boat: D('drowned_boat', ['The Drowned in a Boat', 'Утопленники в шлюпке'], ['A ship’s boat full of the drowned, rowing nowhere. They lift their oars as she comes up, waiting for a word.', 'Шлюпка, полная утопленников, гребёт в никуда. Завидев корабль, они поднимают вёсла и ждут слова.'], 'surf_drowned', 0.28, [4, 10], 2, ['rite', 'feed', 'haul'], { good: 'pearls', share: 0.5 }, 'dead', { regions: ['gravewater', 'dead_mans_expanse', 'drowned_crown', 'whispering', 'leviathan_reach', 'ashen_isles'] }),
  mermaid_net: D('mermaid_net', ['A Mermaid in the Nets', 'Русалка в сетях'], ['A drift net torn off some fishing boat, and in it something that sings. Sharks circle it.', 'Дрейфующая сеть, сорванная с рыбацкой лодки, а в ней кто-то поёт. Вокруг кружат акулы.'], 'mermaid', 0.26, [3, 9], 2, ['cut', 'shoot', 'feed'], { good: 'pearls', share: 0.6 }, 'tropical', { sharks: true }),
  turtle_weed: D('turtle_weed', ['Turtles in the Weed', 'Черепахи в водорослях'], ['A raft of weed as big as a field, and sea turtles caught in it, too weak to dive.', 'Плот водорослей величиной с поле, и в нём запутались морские черепахи — слишком слабые, чтобы нырнуть.'], 'sea_turtle', 0.26, [2, 7], 3, ['cut', 'haul', 'feed'], { good: 'tar', share: 0.3 }, 'swamp'),
  gull_mast: D('gull_mast', ['Gulls on a Mast', 'Чайки на мачте'], ['A broken mast afloat, white with gulls too tired to fly on. They scream at the ship.', 'Обломок мачты на воде, белый от чаек, которым уже не долететь. Они кричат на корабль.'], 'gull', 0.25, [1, 4], 3, ['haul', 'feed', 'cut'], { good: 'fish', share: 0.3 }, 'rocky'),
  tentacle_chain: D('tentacle_chain', ['A Tentacle in the Chain', 'Щупальце в цепи'], ['A lost anchor chain with a buoy, and round it the arms of something from the lagoons, fouled and bleeding ink.', 'Потерянная якорная цепь с буем, а на ней — щупальца кого-то из лагун, запутавшиеся и истекающие чернилами.'], 'lagoon_tentacle', 0.28, [4, 9], 2, ['cut', 'haul', 'heal'], { good: 'kraken_ink', share: 0.4 }, 'volcanic'),
  white_whale: D('white_whale', ['The White Whale', 'Белый кит'], ['The legend of the season: the white whale, an old harpoon line trailing from its flank and the sea red behind it.', 'Легенда сезона: белый кит, за его боком тянется старый гарпунный линь, а море позади красное.'], 'white_whale', 0, [6, 10], 0, ['cut', 'heal', 'haul'], { good: 'ambergris', share: 0.6 }, 'rocky', { legend: true }),
  young_kraken: D('young_kraken', ['The Young Kraken', 'Молодой кракен'], ['The legend of the season: a young kraken thrown up from the deep, its arms in a wreck’s rigging, too young to know the sea’s surface.', 'Легенда сезона: молодой кракен, выброшенный из бездны; его щупальца в такелаже затонувшего корабля, он ещё не знает поверхности моря.'], 'young_kraken', 0, [6, 10], 0, ['rite', 'cut', 'feed'], { good: 'kraken_ink', share: 0.6 }, 'dead', { legend: true }),
};

export const isDriftKind = (k: string): k is DriftKind => (DRIFT_KINDS as string[]).includes(k);

/** The everyday kinds a sector of ⚓L and its waters may show (weights). */
export function driftKindsFor(level: number, region: RegionId): [DriftKind, number][] {
  return DRIFT_KINDS.filter((k) => {
    const d = DRIFTS[k];
    return !d.legend && level >= d.lv[0] && level <= d.lv[1] && (!d.regions || d.regions.includes(region));
  }).map((k) => [k, DRIFTS[k].weight]);
}

/** Its creatures, by the sector's level: the share of the guards' might at its level (a legend: one, two at ⚓9+). */
export function driftCount(kind: DriftKind, level: number): number {
  const d = DRIFTS[kind];
  const L = Math.max(1, Math.min(10, Math.round(level)));
  if (d.legend) return L >= 9 ? 2 : 1;
  return Math.max(1, Math.round((guardBaseMight(L) * d.share) / armyPower([{ u: d.u, n: 1 }])));
}

/** Seconds a drift lasts before it sinks, drifts off or the sharks finish it; a legend lasts three hours. */
export const DRIFT_TTL: [number, number] = [420, 600];
export const LEGEND_TTL = 3 * 3600;
/** Seconds between the lookout's next look for a captain under way, and the share of looks that find one. */
export const DRIFT_EVERY: [number, number] = [240, 420];
export const DRIFT_FIND = 0.75;
/** Metres: where it is put (off her bow), seen from (a mark on the minimap and in the world), the card's reach. */
export const DRIFT_AT: [number, number] = [1300, 2300];
export const DRIFT_SEE = 3500;
export const DRIFT_CARD_R = 520;
export const DRIFT_REACH = 380;

// ------------------------------------------------------------------------------------------------ 35. the rescue

/** What the ways look at: her men, her shooters, the skills of her hero, her path, the food in her hold. */
export interface RescueCtx {
  level: number;
  men: number;
  shooters: number;
  leadership: number;
  firstAid: number;
  mysticism: number;
  will: number;
  path: CaptainId | null;
  /** She has the food the way asks (for 'feed'), and the medicine (for 'heal'). */
  food: boolean;
  medicine: boolean;
}

/** What a way costs from her hold: fish or rum to lure them, medicine to bind a wound. */
export function wayCost(kind: DriftKind, way: RescueWay, level: number): { good: GoodId; n: number } | null {
  const L = Math.max(1, Math.min(10, level));
  if (way === 'feed') return foodOf(DRIFTS[kind].u) === 'rum' ? { good: 'rum', n: 3 + L } : { good: 'fish', n: 6 + 3 * L };
  if (way === 'heal') return { good: 'medicine', n: 1 + Math.floor(L / 3) };
  return null;
}

/** The chance a way saves them before the mini-game (each hit of it +0.12, each miss −0.06). */
export function wayChance(kind: DriftKind, way: RescueWay, c: RescueCtx): number {
  const d = DRIFTS[kind];
  const L = Math.max(1, Math.min(10, c.level));
  let p = 0;
  switch (way) {
    case 'cut':
      p = 0.5 + 0.15 * Math.min(1, c.men / (20 + 8 * L));
      break;
    case 'shoot':
      p = c.shooters > 0 ? 0.3 + 0.5 * Math.min(1, c.shooters / (6 + 3 * L)) : 0.05;
      break;
    case 'haul':
      p = 0.35 + 0.35 * Math.min(1, c.men / (30 + 12 * L));
      break;
    case 'feed':
      p = c.food ? 0.78 : 0;
      break;
    case 'rite':
      p = 0.3 + 0.12 * c.mysticism + 0.015 * Math.min(20, c.will) + (c.path === 'drowned' ? 0.25 : 0);
      break;
    case 'heal':
      p = c.medicine ? 0.45 + 0.15 * c.firstAid : 0;
      break;
  }
  if (p <= 0) return 0;
  p += 0.03 * c.leadership;
  const native = c.path ? NATIVE[c.path] : undefined;
  if (native && native === peopleOf(d.u)) p += 0.1;
  if (d.legend) p -= 0.2;
  return Math.max(0.05, Math.min(0.95, p));
}

/** The rescue's mini-game: three taps of a swinging needle — each in the band lifts the chance, each out of it costs. */
export const MINI_TAPS = 3;
export const MINI_HIT = 0.12;
export const MINI_MISS = 0.06;
/** The needle swings across and back in this many seconds; the band is this wide (a share of the swing). */
export const MINI_PERIOD = 1.6;
export const MINI_BAND = 0.22;
/** The needle's place (0..1) `t` seconds after it began, with its phase. */
export function needleAt(t: number, phase: number): number {
  const x = ((t / MINI_PERIOD + phase) % 1 + 1) % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

/** What a saved drift is worth (a gift's whole, an eighth of an hour at sea at its level; a legend's two hours), and
 *  the experience of saving it (3% of a level, a legend's 25%). */
export function driftWorth(kind: DriftKind, level: number): { silver: number; xp: number } {
  const L = Math.max(1, Math.min(10, level));
  const legend = !!DRIFTS[kind].legend;
  return { silver: Math.round((advHour(L) * (legend ? 2 : 0.12)) / 10) * 10, xp: Math.max(10, Math.round((advLevelXp(L) * (legend ? 0.25 : 0.03)) / 10) * 10) };
}

/** The gift as she gets it: its good, how many, and the silver for the rest. */
export function driftGift(kind: DriftKind, level: number): { good: GoodId; n: number; silver: number } {
  const d = DRIFTS[kind];
  const w = driftWorth(kind, level).silver;
  const n = Math.max(1, Math.round((w * d.gift.share) / GOODS[d.gift.good].basePrice));
  return { good: d.gift.good, n, silver: Math.max(0, Math.round((w - n * GOODS[d.gift.good].basePrice) / 10) * 10) };
}

/** A drift beaten in a fight: silver for a tenth of an hour at sea over the creatures (a legend's three hours and a
 *  half a level of experience). */
export function driftFightPay(kind: DriftKind, level: number): { silver: number; xp: number } {
  const L = Math.max(1, Math.min(10, level));
  const legend = !!DRIFTS[kind].legend;
  return { silver: Math.round((advHour(L) * (legend ? 3 : 0.1)) / 10) * 10, xp: Math.max(10, Math.round((advLevelXp(L) * (legend ? 0.5 : 0.04)) / 10) * 10) };
}

// ------------------------------------------------------------------------------------------------ 36. the capture

/** A captain's crew below this morale takes no beaten creature aboard. */
export const CAPTURE_MORALE = 40;

/** The share of the beaten who may follow her (docs/18 #36): by her might over theirs, her Leadership, her path (its
 *  own people) and her crew's morale — a tenth at an even fight, up to three tenths. */
export function captureShare(o: { ratio: number; leadership: number; native: boolean; morale: number }): number {
  if (o.morale < CAPTURE_MORALE) return 0;
  const strength = Math.max(0, Math.min(1, (o.ratio - 1) / 3));
  const p = 0.1 + 0.1 * strength + 0.025 * o.leadership + (o.native ? 0.06 : 0) + Math.max(-0.03, Math.min(0.03, (o.morale - 60) / 600));
  return Math.max(0, Math.min(0.3, p));
}

/** How many of `beaten` follow her at a share (whole creatures; none of a great beast fewer than two). */
export function captureCount(beaten: number, share: number): number {
  return Math.max(0, Math.floor(beaten * share + 1e-9));
}

// ------------------------------------------------------------------------------------------------ 41. the pen

/** What the pen on her island keeps beyond her slots (docs/18 #41), in heads by their tier (a crab one, a serpent
 *  six), by the pen's level. */
export const PEN_STOCK = [0, 120, 400];
export function penLoad(stock: Partial<Record<CreatureId, number>>): number {
  let v = 0;
  for (const [u, n] of Object.entries(stock) as [CreatureId, number][]) v += (n ?? 0) * (UNITS[u]?.tier ?? 1);
  return v;
}

// ------------------------------------------------------------------------------------------------ 42. the tamers

/** A port keeps a tamer (docs/18 #42): every port of the Choir, near half the great and middling, a fifth of the rest
 *  (by the port's own hash). */
export function hasTamer(port: { id: string; size: number; faction: string }): boolean {
  if (port.faction === 'choir') return true;
  return hashString(`tamer:${port.id}`) % 100 < (port.size >= 2 ? 45 : 20);
}

/** She pays this share of a creature's worth (its rank lifts it), and asks this share for her own. */
export const TAMER_BUY = 0.55;
export const TAMER_SELL = 1.35;
export function tamerPays(u: UnitId, rank = 0): number {
  return Math.max(1, Math.round(UNITS[u].cost * TAMER_BUY * (1 + 0.15 * rank)));
}
export function tamerAsks(u: UnitId): number {
  return Math.max(1, Math.round(UNITS[u].cost * TAMER_SELL));
}

/** The tamer's pens this week: three kinds of the creatures of the waters about her port (tiers by its level), each with
 *  half a creature dwelling's week waiting — on her own dice of the port and the week. */
export function tamerStock(portId: string, level: number, week: number, deep: boolean): { u: CreatureId; n: number }[] {
  const L = Math.max(1, Math.min(10, level));
  const top = Math.max(2, Math.min(7, Math.ceil(L * 0.7)));
  const pool = CREATURE_IDS.filter((u) => !UNITS[u].legend && UNITS[u].tier <= top && (deep || peopleOf(u) !== 'deep'));
  const rng = new Rng((hashString(`tamer:${portId}:${week}`) ^ 0x7a3e) >>> 0);
  const out: { u: CreatureId; n: number }[] = [];
  for (let k = 0; k < 3 && pool.length; k++) {
    const u = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    out.push({ u, n: Math.max(1, Math.round(GROWTH[UNITS[u].tier] / 2)) });
  }
  return out.sort((a, b) => UNITS[a.u].tier - UNITS[b.u].tier);
}
