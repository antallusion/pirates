// The Blighted Sea («Море Скверны», docs/40): the secret endgame water. An overlay — a circle of open water in Dead
// Man's Expanse — and nothing of the world's own: no region, no port, no waystation, no chapter in the campaign's plan.
// Here: where it lies, who may enter, the Taint and its tiers, the hunters' strength, the marks, the Raft's blackjack
// and shop, the chapter «Зелёный огонь» with its fourteen quests, the endless contracts, and every word the server
// says about it with its Russian twin (blightPatterns, merged into client/src/lang/server.ts TABLE).
//
// Pure: the server (server/src/game/blight.ts), the client and the tests all read it.

import { Rng } from '../rng.ts';
import { CAMPAIGN_SIZE } from './campaign/plan.ts';

type Tr = [string, string];

// ================================================================================================ the place

/** The circle (docs/40 §1). Found once over the live world (WORLD_SEED) by a search of a 100 m grid of Dead Man's
 *  Expanse: no land at all within it (the nearest coast is 4 232 m from its middle), no port or town within 6 219 m of
 *  its middle, no citadel within 5 km, the region's border 8 500 m off. tests/blight.test.ts pins it: the world may
 *  never move under it. The world's floating waystations stand every half kilometre of every sea, so some lie inside
 *  it; they are the world's own and stay as they are. */
export const BLIGHT = { x: 48500, y: 34200, r: 4000 } as const;
/** The Raft («Плот Скверны») at its middle: the zone's own mooring, in no list of the world's. */
export const BLIGHT_RAFT = { x: 48500, y: 34200 } as const;
/** Within this of the Raft she may moor (metres from its middle to her hull's middle). */
export const RAFT_REACH = 160;
/** Moored, she drifts no farther than this before the lines part. */
export const RAFT_LEAVE = 260;
/** Seconds hove to before the lines are made fast. */
export const RAFT_MOOR_SECS = 5;
/** No mooring within this many seconds of taking or dealing damage. */
export const RAFT_QUIET_SECS = 30;
/** The Raft's cut of the marks banked by mooring (sailing out across the rim alive costs nothing). */
export const RAFT_CUT = 0.1;
/** The Raft's place for the tavern tables (dice.ts keeps a table by its port's id; the Raft is no port). */
export const RAFT_TABLE = 'blight_raft';

/** Quests of the campaign behind her before the green water takes her (90 % of it), and her level. */
export const BLIGHT_NEED_AT = Math.ceil(0.9 * CAMPAIGN_SIZE);
export const BLIGHT_LEVEL = 55;

export const inBlight = (x: number, y: number): boolean => (x - BLIGHT.x) * (x - BLIGHT.x) + (y - BLIGHT.y) * (y - BLIGHT.y) < BLIGHT.r * BLIGHT.r;

/** Cleared by her own road: the campaign's 648th quest behind her and the 55th level. No group pass. */
export function blightOpen(campaignAt: number, level: number): boolean {
  return campaignAt >= BLIGHT_NEED_AT && level >= BLIGHT_LEVEL;
}

// ================================================================================================ the Taint

/** Taint to a tier. Her tier is 1 + ⌊taint / TAINT_PER_TIER⌋: I on entry, with no cap. */
export const TAINT_PER_TIER = 100;
/** Taint a second under way inside (a tier in some seventeen minutes of sailing alone). */
export const TAINT_PER_SEC = 0.1;
/** Taint for a hunter sunk or taken, a captain, the Heart's fall. */
export const TAINT_HUNTER = 30;
export const TAINT_CAPTAIN = 60;
export const TAINT_HEART = 100;
/** Away (the line dropped, the game shut) this long with Taint aboard: treated as having left alive. */
export const BLIGHT_AWAY_MS = 5 * 60_000;

export const tierOf = (taint: number): number => 1 + Math.floor(Math.max(0, taint) / TAINT_PER_TIER);
/** Every reward of the zone by her tier. */
export const blightMul = (tier: number): number => 1 + 0.15 * Math.max(0, tier);
/** Experience stops at ×4 (tier XX); marks do not stop. */
export const BLIGHT_XP_CAP = 4;
export const blightXpMul = (tier: number): number => Math.min(BLIGHT_XP_CAP, blightMul(tier));

// ================================================================================================ the hunters

/** Never more than this on one captain. */
export const HUNTERS_MAX = 4;
/** Seconds inside before the first sail, and between one hunter and the next. */
export const HUNTER_FIRST_S = 20;
export const HUNTER_GAP_S = 25;
/** Marks for a hunter (× her multiplier). */
export const HUNTER_MARKS = 8;
/** From this tier a hunter sunk may leave a green cask (this chance, these marks × her multiplier). */
export const CASK_TIER = 2;
export const CASK_CHANCE = 0.2;
export const CASK_MARKS = 10;
/** A green cask floats this long, and is taken within this of a hull. */
export const CASK_SECS = 300;
export const CASK_REACH = 90;

export interface HunterSpec {
  /** Her ⚓: always 10, an elite of the sea's table (a captain the green water takes sails ⚓9–10: measured, a full
   *  build sinks an elite ⚓9 five times in five with four fifths of her hull left). */
  anchor: number;
  /** How many are kept on the captain: one more each three tiers, never more than HUNTERS_MAX. */
  n: number;
  /** Her hull and her guns over an elite ⚓10 ship of the sea's. */
  hull: number;
  guns: number;
}

/** The hunters' might by how many of them a tier keeps on her (one, two, three, four): the first tier of each band,
 *  and what each tier further into the band adds. One great ship at tiers I–III; from IV two lesser ones, from VII
 *  three, from X four (the last band has no end: it grows a tier at a time for ever). Tuned on tests/balance/blight.ts
 *  (docs/40 §7). */
export const HUNTER_BANDS: { hull: number; hullStep: number; guns: number; gunsStep: number }[] = [
  { hull: 3.0, hullStep: 0.1, guns: 1.85, gunsStep: 0.07 },
  { hull: 1.35, hullStep: 0.1, guns: 1.5, gunsStep: 0.1 },
  { hull: 1.0, hullStep: 0.05, guns: 1.5, gunsStep: 0.1 },
  { hull: 1.0, hullStep: 0.05, guns: 1.2, gunsStep: 0.05 },
];
/** Every hunter sails this hull (the one ghost ship of the sea's own yards: `ship.ghost_ship`). */
export const HUNTER_HULL = 'ghost_ship';

/** The hunters of a tier (docs/40 §3; the table measured by tests/balance/blight.ts is in docs/40 §7). */
export function hunterSpec(tier: number): HunterSpec {
  const t = Math.max(1, Math.floor(tier));
  const band = Math.min(HUNTERS_MAX - 1, Math.floor((t - 1) / 3));
  const into = t - 1 - band * 3; // tiers into the band (the last band: without end)
  const b = HUNTER_BANDS[band];
  return { anchor: 10, n: band + 1, hull: Math.round((b.hull + b.hullStep * into) * 100) / 100, guns: Math.round((b.guns + b.gunsStep * into) * 100) / 100 };
}

/** The names the green water gives its ships. */
export const HUNTER_NAMES: Tr[] = [
  ['The Green Psalm', 'Зелёный псалом'], ['The Lamp Unlit', 'Погасшая лампа'], ['The Patient Tide', 'Терпеливый прилив'], ['The Sleeper’s Oath', 'Клятва спящего'],
  ['The Mirewake', 'Топкий след'], ['The Hollow Bell', 'Пустой колокол'], ['The Long Dream', 'Долгий сон'], ['The Verdigris', 'Патина'],
  ['The Unmoored', 'Сорвавшийся с якоря'], ['The Stillwater', 'Тихая вода'], ['The Marsh Light', 'Болотный огонь'], ['The Tarnished Hour', 'Потускневший час'],
];
export const HUNTER_CAPTAIN: Tr = ['a captain the tide dreamed', 'капитан, приснившийся приливу'];

// ================================================================================================ the Heart

/** The Blight's Heart rises every three hours of wall time, told ten minutes before, and stays half an hour. */
export const HEART_EVERY_MS = 3 * 3_600_000;
export const HEART_WARN_MS = 10 * 60_000;
export const HEART_STAY_S = 1800;
/** Her hull and guns over a ⚓10 ghost ship of the sea's. */
export const HEART_HULL = 14;
export const HEART_GUNS = 1.5;
/** The marks shared by each captain's part of her hull (each one's × her own multiplier); under this part: nothing. */
export const HEART_POOL = 1200;
export const HEART_MIN_PART = 0.03;
export const HEART_NAME: Tr = ['The Blight’s Heart', 'Сердце Скверны'];
export const HEART_CAPTAIN: Tr = ['the green fire itself', 'сам зелёный огонь'];

// ================================================================================================ captains

/** A captain sunk or taken inside pays the victor this, and half of what rode in her hold. */
export const pvpMarks = (victimTier: number): number => 20 + 10 * Math.max(1, victimTier);
/** The same victim pays in full once an hour, then this share. */
export const PVP_REPEAT_MS = 3_600_000;
export const PVP_REPEAT_SHARE = 0.25;
/** A victim with no kill and under this long inside pays no marks. */
export const PVP_FRESH_S = 120;
/** «Избранник Скверны»: the highest tier inside (two captains inside or more, tier III or more) earns this much more
 *  marks while marked, and sinking her pays this much more. */
export const CHOSEN_MIN_TIER = 3;
export const CHOSEN_EARNS = 1.25;
export const CHOSEN_PAYS = 2;

/** The week's three: their titles and marks. */
export const WEEK_TITLES: Tr[] = [['Chosen of the Blight', 'Избранник Скверны'], ['Hand of the Blight', 'Длань Скверны'], ['Shadow of the Blight', 'Тень Скверны']];
export const WEEK_MARKS = [300, 200, 100];

// ================================================================================================ blackjack

export type BjCoin = 'silver' | 'marks';
export const BJ_STAKES: Record<BjCoin, number[]> = { silver: [100, 1000, 10000], marks: [5, 25, 100] };
export const BJ_HANDS_HOUR = 60;
export const BJ_SILVER_DAY = 200_000;

/** A card: 0–51; its rank 0 (ace), 1–9 (two to ten), 10–12 (jack, queen, king); its suit 0–3 (♠ ♥ ♦ ♣). */
export const bjRank = (c: number): number => c % 13;
export const bjSuit = (c: number): number => Math.floor(c / 13) % 4;

/** A hand's count: aces as eleven while it does not break her. */
export function bjTotal(cards: readonly number[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = bjRank(c);
    if (r === 0) {
      aces++;
      total += 11;
    } else total += Math.min(10, r + 1);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const bjNatural = (cards: readonly number[]): boolean => cards.length === 2 && bjTotal(cards).total === 21;

/** One deck, shuffled for the hand (Fisher–Yates on the table's own Rng). */
export function bjDeck(rng: Rng): number[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export type BjResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

/** The dealer's hand played out from the deck: he draws to 17 and stands on every 17. */
export function bjDealer(dealer: number[], deck: number[]): number[] {
  const out = [...dealer];
  while (bjTotal(out).total < 17 && deck.length) out.push(deck.pop()!);
  return out;
}

/** The hand's end (the dealer's hand already played out). */
export function bjResult(player: readonly number[], dealer: readonly number[]): BjResult {
  const p = bjTotal(player).total, d = bjTotal(dealer).total;
  if (p > 21) return 'bust';
  const pn = bjNatural(player), dn = bjNatural(dealer);
  if (pn && dn) return 'push';
  if (pn) return 'blackjack';
  if (dn) return 'lose';
  if (d > 21 || p > d) return 'win';
  return p === d ? 'push' : 'lose';
}

/** What comes back to her of a `stake` laid (the stake itself with it): blackjack 3:2, a win 1:1, a push the stake. */
export function bjReturn(result: BjResult, stake: number): number {
  return result === 'blackjack' ? stake + Math.floor(stake * 1.5) : result === 'win' ? stake * 2 : result === 'push' ? stake : 0;
}

// ================================================================================================ the shop

export type BlightWare = 'title' | 'pennant' | 'speedup' | 'relic' | 'reroll' | 'lantern';

export interface BlightWareDef {
  id: BlightWare;
  name: Tr;
  hint: Tr;
  /** Banked marks, the first of a week. */
  price: number;
  /** Had once and for good. */
  once?: boolean;
  /** An art key of assets/manifest.json for its card (no new art). */
  art: string;
}

/** The title and the pennant's colour the shop sells; the chapter's own at its end. */
export const BLIGHT_TITLE: Tr = ['Sailor of the Blight', 'Плаватель Скверны'];
export const BLIGHT_PENNANT = '#58c96b';
export const CHAPTER_TITLE: Tr = ['Master of the Green Water', 'Хозяин зелёной воды'];
export const CHAPTER_PENNANT = '#9dff6a';
/** «Тёмный фонарь»: a tier's worth more marks for this long inside. */
export const LANTERN_SECS = 600;

export const BLIGHT_SHOP: BlightWareDef[] = [
  { id: 'title', name: BLIGHT_TITLE, hint: ['A title for your name plate.', 'Титул для вашей таблички.'], price: 300, once: true, art: 'card.enc_glowing_sea' },
  { id: 'pennant', name: ['The Green Pennant of the Blight', 'Зелёный вымпел Скверны'], hint: ['A pennant in the colour of the green water.', 'Вымпел цвета зелёной воды.'], price: 500, once: true, art: 'flag.c_green' },
  { id: 'speedup', name: ['A build speed-up', 'Ускорение стройки'], hint: ['One speed-up for the works on your island.', 'Одно ускорение для работ на вашем острове.'], price: 60, art: 'icon.sk_curse' },
  { id: 'relic', name: ['A relic part', 'Часть реликвии'], hint: ['One part of a relic, one you lack first.', 'Одна часть реликвии — сначала та, которой у вас нет.'], price: 400, art: 'fx.curse_veins' },
  { id: 'reroll', name: ['A line re-forged', 'Перековка свойства'], hint: ['One extra line of one piece of gear rolled anew.', 'Одно дополнительное свойство одной вещи выпадает заново.'], price: 150, art: 'icon.sk_rot' },
  { id: 'lantern', name: ['The Dark Lantern', 'Тёмный фонарь'], hint: ['Ten minutes inside, marks as if one tier higher.', 'Десять минут в зелёной воде метки идут как на ступень выше.'], price: 80, art: 'prop.bd_ghost_lamp' },
];

/** Each purchase of the same thing in a week makes the next a quarter dearer. */
export const SHOP_STEP = 0.25;
export const shopPrice = (base: number, boughtThisWeek: number): number => Math.round(base * (1 + SHOP_STEP * Math.max(0, boughtThisWeek)));

// ================================================================================================ the chapter

/** A step of the zone's own (no campaign builder). Steps are done in order. */
export type BlightStep =
  /** Enter the green water. */
  | { k: 'reach' }
  /** Moor at the Raft. */
  | { k: 'moor' }
  /** Sink or take `n` hunters (while her tier is `tier` or more, if given). */
  | { k: 'sink'; n: number; tier?: number }
  /** Reach tier `n`. */
  | { k: 'tier'; n: number }
  /** Bank `n` marks at once (at the Raft or across the rim). */
  | { k: 'bank'; n: number }
  /** Win `n` hands of blackjack. */
  | { k: 'bj'; n: number }
  /** Have a part in sinking the Blight's Heart. */
  | { k: 'heart' }
  /** Sink or take one captain inside — or `n` hunters at tier `tier` or more. */
  | { k: 'duel'; n: number; tier: number }
  /** Stay alive inside `min` minutes at tier `tier` or more (the minutes need not be in a row). */
  | { k: 'survive'; min: number; tier: number }
  /** Carry a green cask out across the rim. */
  | { k: 'cask' };

/** How many the step counts to. */
export function stepNeed(s: BlightStep): number {
  return s.k === 'sink' || s.k === 'bj' || s.k === 'duel' ? s.n : s.k === 'survive' ? s.min * 60 : 1;
}

/** The step in words. */
export function stepText(s: BlightStep): Tr {
  switch (s.k) {
    case 'reach': return ['Sail into the green water', 'Войдите в зелёную воду'];
    case 'moor': return ['Moor at the Raft', 'Пришвартуйтесь к Плоту'];
    case 'sink': return s.tier ? [`Sink ${s.n} hunters at tier ${s.tier} or higher`, `Потопите охотников на ступени ${s.tier} и выше: ${s.n}`] : [`Sink ${s.n} hunters of the green water`, `Потопите охотников зелёной воды: ${s.n}`];
    case 'tier': return [`Reach tier ${s.n} of the Taint`, `Дойдите до ступени Скверны ${s.n}`];
    case 'bank': return [`Bank ${s.n} marks at once`, `Сдайте разом меток: ${s.n}`];
    case 'bj': return [`Win ${s.n} hands of twenty-one at the Raft`, `Выиграйте на Плоту раздач в двадцать одно: ${s.n}`];
    case 'heart': return ['Have a part in sinking the Blight’s Heart', 'Примите участие в потоплении Сердца Скверны'];
    case 'duel': return [`Sink a captain in the green water — or ${s.n} hunters at tier ${s.tier} or higher`, `Потопите капитана в зелёной воде — или охотников на ступени ${s.tier} и выше: ${s.n}`];
    case 'survive': return [`Stay alive ${s.min} minutes at tier ${s.tier} or higher`, `Продержитесь ${s.min} мин на ступени ${s.tier} и выше`];
    case 'cask': return ['Carry a green cask out across the rim', 'Вывезите зелёный бочонок за кромку'];
  }
}

export interface BlightQuest {
  /** Title, briefing, completion line. */
  t: Tr;
  b: Tr;
  d: Tr;
  s: BlightStep[];
  /** Banked marks, and experience in the sea's units (xpcurve.ts lumpXp: glory past the 60th). */
  marks: number;
  units: number;
}

export const BLIGHT_CHAPTER = {
  n: 37,
  title: ['The Green Fire', 'Зелёный огонь'] as Tr,
  blurb: [
    'The tide was rung to sleep, and a sleeper dreams. Past Dead Man’s Expanse one stretch of water has gone green and will not go dark at night. The people who live on it call it the Blight, and they have a table laid for you.',
    'Прилив убаюкали звоном, а спящему снятся сны. За Простором мертвецов одна полоса воды позеленела и не темнеет по ночам. Те, кто на ней живёт, зовут её Скверной, и стол для вас у них уже накрыт.',
  ] as Tr,
  giver: ['Mother Sedge, keeper of the Raft', 'Матушка Осока, хранительница Плота'] as Tr,
  portrait: 'giver_lighthouse_keeper_f',
  card: 'card.enc_glowing_sea',
  cardDone: 'card.lore_epilogue',
  reward: { title: CHAPTER_TITLE, pennant: CHAPTER_PENNANT },
} as const;

export const BLIGHT_QUESTS: BlightQuest[] = [
  {
    t: ['The Green Fire', 'Зелёный огонь'],
    b: [
      'A letter in a hand you do not know: “Captain. You helped put the tide to sleep, so you had better come and see what it dreams. Steer for the green light past Dead Man’s Expanse. Tie up at the Raft and ask for Sedge. Do not drink the water.”',
      'Письмо, написанное незнакомой рукой: «Капитан. Вы помогли усыпить прилив — так придите и посмотрите, что ему снится. Держите на зелёный свет за Простором мертвецов. Швартуйтесь к Плоту и спросите Осоку. Воду не пейте».',
    ],
    d: [
      'Mother Sedge looks at your hull, then at your hands, and nods. “It let you in. That is all the welcome there is here. Sit down.”',
      'Матушка Осока смотрит на ваш борт, потом на ваши руки и кивает. «Она вас впустила. Другого привета тут не бывает. Садитесь».',
    ],
    s: [{ k: 'reach' }, { k: 'moor' }],
    marks: 30, units: 4,
  },
  {
    t: ['What the Tide Dreams', 'Что снится приливу'],
    b: [
      'The ships that come at you here were never built, Sedge says. The sleeping tide dreams them out of every wreck it remembers, and they sail until someone wakes them. Wake two. What they leave on the water is yours: the Raft calls it a mark.',
      'Корабли, что идут на вас здесь, никто никогда не строил, говорит Осока. Спящий прилив видит их во сне — из каждого крушения, какое помнит, — и они ходят, пока их не разбудят. Разбудите двоих. То, что останется на воде, ваше: на Плоту это зовут меткой.',
    ],
    d: [
      'The marks are cold and a little damp, and they hum when you put two together. Sedge counts them without touching them.',
      'Метки холодные, чуть влажные и гудят, если сложить две вместе. Осока пересчитывает их, не прикасаясь.',
    ],
    s: [{ k: 'sink', n: 2 }, { k: 'bank', n: 10 }],
    marks: 40, units: 5,
  },
  {
    t: ['Twenty-One', 'Двадцать одно'],
    b: [
      'There is one game on the Raft older than the dice. The dealer is a thin man called Quill, who has not left his chair since the water turned. He plays for silver or for marks and never hurries. Sedge says you learn the Raft at his table or not at all.',
      'На Плоту есть игра постарше костей. Сдаёт худой человек по имени Перо; он не вставал со стула с тех пор, как позеленела вода. Играет на серебро или на метки и никогда не торопится. Осока говорит: Плот узнают за его столом — или не узнают вовсе.',
    ],
    d: [
      'Quill pays you without looking up. “The house remembers,” he says, and squares the deck.',
      'Перо расплачивается, не поднимая глаз. «Дом запоминает», — говорит он и подравнивает колоду.',
    ],
    s: [{ k: 'bj', n: 2 }],
    marks: 40, units: 4,
  },
  {
    t: ['Second Water', 'Вторая вода'],
    b: [
      'The longer a ship stays, the more the green takes to her. The Raft counts it in waters: first water, second, third. In the second water the dreamed ships are heavier and what they leave is worth more. Stay until your wake glows, and sink three of them there.',
      'Чем дольше корабль остаётся, тем сильнее к нему липнет зелень. На Плоту её считают водами: первая, вторая, третья. Во второй воде приснившиеся корабли тяжелее, а остаётся после них больше. Останьтесь, пока не засветится ваш след, и потопите там троих.',
    ],
    d: [
      'Your bosun scrubs the green off the wales for an hour. It comes off. He does not look comforted.',
      'Боцман битый час оттирает зелень с бортов. Она сходит. Спокойнее ему от этого не становится.',
    ],
    s: [{ k: 'tier', n: 2 }, { k: 'sink', n: 3, tier: 2 }],
    marks: 60, units: 6,
  },
  {
    t: ['What the Sea Gives Back', 'Что море отдаёт'],
    b: [
      'Now and then a dreamed ship leaves a cask behind, sealed and glowing faintly through the staves. Sedge wants one carried out past the rim, into ordinary water, to see whether it stays green out there. Nobody on the Raft has been willing to leave long enough to try.',
      'Иногда приснившийся корабль оставляет после себя бочонок — запечатанный, слабо светящийся сквозь клёпки. Осока хочет, чтобы один вывезли за кромку, в обычную воду, и посмотрели, останется ли он там зелёным. На Плоту никто не решился уйти так надолго, чтобы проверить.',
    ],
    d: [
      'Out in the dark water the cask goes on glowing, steady as a lamp. Sedge takes the news quietly. “Then it travels,” she says.',
      'В тёмной воде бочонок продолжает светиться — ровно, как лампа. Осока принимает новость тихо. «Значит, она путешествует», — говорит она.',
    ],
    s: [{ k: 'cask' }, { k: 'moor' }],
    marks: 70, units: 6,
  },
  {
    t: ['Third Water', 'Третья вода'],
    b: [
      'In the third water the compass card turns slowly on its own and the men stop singing. Sedge asks you to hold there a while and write down what the lookouts see. She has a book of such pages, and no two agree.',
      'В третьей воде картушка компаса медленно поворачивается сама, а матросы перестают петь. Осока просит продержаться там немного и записать, что видят вперёдсмотрящие. У неё целая книга таких листов, и нет двух одинаковых.',
    ],
    d: [
      'Your page says: a harbour with every lamp lit, and nobody on the quays. Sedge reads it twice and files it under “Saltmarrow”.',
      'На вашем листе: гавань, где горят все фонари, а на причалах ни души. Осока читает дважды и кладёт лист в папку «Солтмарроу».',
    ],
    s: [{ k: 'tier', n: 3 }, { k: 'survive', min: 5, tier: 2 }],
    marks: 80, units: 8,
  },
  {
    t: ['The House Remembers', 'Дом запоминает'],
    b: [
      'Quill has asked for you by name, which Sedge says he has done for three people in all. He wants five hands won at his table and a proper weight of marks laid on the Raft’s scales in one go. He will not say why. He is smiling, a little.',
      'Перо спросил вас по имени — Осока говорит, такое с ним случалось всего трижды. Он хочет, чтобы вы выиграли за его столом пять раздач и разом положили на весы Плота приличный вес меток. Зачем — не говорит. Он чуть-чуть улыбается.',
    ],
    d: [
      '“Good,” Quill says. “Now the house knows your hand. When the Heart comes up, it will know which ship is yours.”',
      '«Хорошо, — говорит Перо. — Теперь дом знает вашу руку. Когда поднимется Сердце, он будет знать, который корабль ваш».',
    ],
    s: [{ k: 'bj', n: 5 }, { k: 'bank', n: 60 }],
    marks: 90, units: 8,
  },
  {
    t: ['The Blight’s Heart', 'Сердце Скверны'],
    b: [
      'Every three hours the water in the middle of the Blight brightens until the Raft throws a shadow at midnight, and a ship comes up that is larger than any wreck the tide could remember. The Raft calls her the Heart. Every captain in the green water fires on her together, and on each other after. Be there.',
      'Каждые три часа вода посреди Скверны светлеет так, что Плот в полночь отбрасывает тень, и поднимается корабль крупнее любого крушения, какое мог запомнить прилив. На Плоту его зовут Сердцем. Все капитаны в зелёной воде бьют по нему разом — а потом друг по другу. Будьте там.',
    ],
    d: [
      'The Heart goes down without a sound and the light goes with her. For a few minutes the Blight is only water. Then, far below, something begins to glow again.',
      'Сердце уходит под воду беззвучно, и свет уходит вместе с ним. Несколько минут Скверна — просто вода. Потом далеко внизу что-то снова начинает светиться.',
    ],
    s: [{ k: 'heart' }],
    marks: 150, units: 12,
  },
  {
    t: ['A Heavy Hold', 'Тяжёлый трюм'],
    b: [
      'The Raft is lashed from other people’s ships, and the lashings rot. Sedge needs marks to buy cable from the few who still trade here, and she needs them in one load, because Quill’s scales cheat on small ones. Sink six dreamed ships and bring it all in at once.',
      'Плот связан из чужих кораблей, и связки гниют. Осоке нужны метки, чтобы купить канат у тех немногих, кто ещё здесь торгует, и нужны одной ношей: на мелких весы Пера обсчитывают. Потопите шесть приснившихся кораблей и привезите всё разом.',
    ],
    d: [
      'The new cable goes round the Raft twice. Sedge pulls on it with both hands, like a woman testing a child’s tooth.',
      'Новый канат дважды обходит Плот. Осока тянет за него обеими руками — так проверяют молочный зуб у ребёнка.',
    ],
    s: [{ k: 'sink', n: 6 }, { k: 'bank', n: 120 }],
    marks: 110, units: 9,
  },
  {
    t: ['Fifth Water', 'Пятая вода'],
    b: [
      'Nobody on the Raft has a page from the fifth water. The ships that went that deep either did not come back or would not talk. Sedge does not ask you to go. She only leaves the book open on the table, at the first empty leaf.',
      'С пятой воды ни у кого на Плоту нет листа. Корабли, ушедшие так глубоко, либо не вернулись, либо не захотели говорить. Осока не просит вас идти. Она просто оставляет книгу на столе открытой — на первом пустом листе.',
    ],
    d: [
      'You write one line and close the book. Sedge does not open it while you are watching.',
      'Вы пишете одну строку и закрываете книгу. При вас Осока её не открывает.',
    ],
    s: [{ k: 'tier', n: 5 }, { k: 'sink', n: 3, tier: 4 }],
    marks: 130, units: 10,
  },
  {
    t: ['No Colours Here', 'Здесь нет флагов'],
    b: [
      'The green water keeps no law, and other captains know your hold is heavy. Sooner or later one of them will come for it. Quill is taking bets on whether you will sink a captain first, or wait. Sedge says three of the deep dreamers will prove the same thing, if you would rather not fire on the living.',
      'Зелёная вода не знает закона, а другие капитаны знают, что ваш трюм тяжёл. Рано или поздно кто-то за ним придёт. Перо принимает ставки: потопите ли вы капитана первым или станете ждать. Осока говорит: три глубоких сновидца докажут то же самое, если вы не хотите стрелять по живым.',
    ],
    d: [
      'Quill pays out the bets with a face like a shut door. He will not tell you which way he wagered.',
      'Перо выплачивает ставки с лицом, похожим на закрытую дверь. На что ставил сам — не говорит.',
    ],
    s: [{ k: 'duel', n: 3, tier: 5 }],
    marks: 150, units: 10,
  },
  {
    t: ['The Long Watch', 'Долгая вахта'],
    b: [
      'Sedge has noticed that the Heart rises sooner when a ship holds the deep water for a long time, as if the Blight came up to see who was keeping it awake. She wants ten minutes in the fourth water or deeper. Bring the ship back. The rest she can do without.',
      'Осока заметила: Сердце поднимается раньше, когда какой-нибудь корабль долго держится на глубокой воде, — словно Скверна выходит посмотреть, кто не даёт ей спать. Ей нужно десять минут в четвёртой воде или глубже. Корабль верните. Без остального она обойдётся.',
    ],
    d: [
      'Ten minutes by the glass. The lookouts come down from the tops very carefully and ask for their rum in silence.',
      'Десять минут по склянкам. Вперёдсмотрящие спускаются с марсов очень осторожно и молча просят свой ром.',
    ],
    s: [{ k: 'survive', min: 10, tier: 4 }],
    marks: 170, units: 12,
  },
  {
    t: ['The Blight Chooses', 'Скверна выбирает'],
    b: [
      'When one ship carries more of the green than any other, the water marks her, and every captain inside can see where she is. The Raft calls her the Chosen and drinks to her health while laying odds against it. Go to the seventh water. Come back with three hundred marks in one hold.',
      'Когда один корабль несёт на себе больше зелени, чем любой другой, вода его отмечает, и каждый капитан внутри видит, где он. На Плоту такого зовут Избранником и пьют за его здоровье, тут же ставя против. Дойдите до седьмой воды. Вернитесь с тремя сотнями меток в одном трюме.',
    ],
    d: [
      'The whole Raft comes out to watch you tie up. Nobody cheers. Somebody has chalked your ship’s name on the dealer’s slate.',
      'Весь Плот выходит посмотреть, как вы швартуетесь. Никто не кричит «ура». Кто-то написал мелом название вашего корабля на доске сдающего.',
    ],
    s: [{ k: 'tier', n: 7 }, { k: 'bank', n: 300 }],
    marks: 220, units: 14,
  },
  {
    t: ['Master of the Green Water', 'Хозяин зелёной воды'],
    b: [
      'Sedge has read every page in her book and thinks she knows what the Blight is: not a sickness, only the tide turning over in its sleep. It cannot be cured and must not be woken. It can only be kept company. She asks three things of you, and then she will stop asking: the Heart sunk once more, five minutes held in the sixth water, and one cask carried out so the sea beyond does not forget this place.',
      'Осока прочла все листы своей книги и думает, что знает, что такое Скверна: не болезнь, а всего лишь прилив, который ворочается во сне. Вылечить её нельзя, будить нельзя. С ней можно только побыть рядом. Она просит вас о трёх вещах — и больше просить не станет: ещё раз потопить Сердце, пять минут продержаться в шестой воде и вывезти один бочонок, чтобы море снаружи не забыло это место.',
    ],
    d: [
      'Sedge hangs a green pennant at your masthead herself, standing on a cask to reach. “There is no end to it,” she says. “That is the good news. Come back tomorrow.”',
      'Осока сама вешает зелёный вымпел на вашу мачту, встав на бочонок, чтобы дотянуться. «Конца у этого нет, — говорит она. — Это и есть хорошая новость. Приходите завтра».',
    ],
    s: [{ k: 'heart' }, { k: 'survive', min: 5, tier: 6 }, { k: 'cask' }],
    marks: 400, units: 20,
  },
];

// ================================================================================================ the endless contracts

export interface BlightContract {
  /** Its place in the day's three (0–2). */
  id: number;
  step: BlightStep;
  marks: number;
  units: number;
}

export const CONTRACTS_A_DAY = 3;

/** The day's three for a captain (after the fourteenth quest): drawn by the day and her account from the chapter's own
 *  step kinds, their numbers by the best tier she has reached. The same three all day, whatever she does. */
export function dayContracts(day: number, account: number, best: number): BlightContract[] {
  const rng = new Rng(((day * 2654435761) ^ (account * 40503) ^ 0xb11c47) >>> 0);
  const b = Math.max(1, Math.floor(best));
  const deep = Math.max(1, Math.min(b - 1, 12));
  const kinds: (() => BlightStep)[] = [
    () => ({ k: 'sink', n: 3 + Math.floor(b / 2), tier: deep }),
    () => ({ k: 'tier', n: Math.max(2, b) }),
    () => ({ k: 'bank', n: 30 + 15 * b }),
    () => ({ k: 'bj', n: 3 }),
    () => ({ k: 'survive', min: 5, tier: deep }),
    () => ({ k: 'cask' }),
    () => ({ k: 'duel', n: 3, tier: Math.max(2, deep) }),
  ];
  const pool = kinds.map((_, i) => i);
  const out: BlightContract[] = [];
  for (let i = 0; i < CONTRACTS_A_DAY; i++) {
    const at = rng.int(0, pool.length - 1);
    const kind = pool.splice(at, 1)[0];
    out.push({ id: i, step: kinds[kind](), marks: 25 + 10 * b, units: 4 });
  }
  return out;
}

// ================================================================================================ the words

/** Every sentence the server says of the green water, by its key: English as sent, Russian for the table. `{0}`… are
 *  filled by `say`. */
export const BLIGHT_WORDS = {
  veil: ['The green water will not have you: the sea does not yet count you its own.', 'Зелёная вода не пускает вас: море ещё не считает вас своим.'],
  letterFrom: ['The Raft', 'Плот'],
  letterSubject: ['The green fire past Dead Man’s Expanse', 'Зелёный огонь за Простором мертвецов'],
  letterBody: [
    'Captain. Past Dead Man’s Expanse, north-west of Wrecktide, a stretch of water burns green at night. It lets in only those the sea counts its own, and it counts you. Steer for it; it is on your chart from today. Tie up at the Raft in its middle and ask for Sedge. What you earn there rides in your hold until you bank it, and what you carry, others may take.',
    'Капитан. За Простором мертвецов, к северо-западу от Рэктайда, полоса воды по ночам горит зелёным. Она впускает только тех, кого море считает своими, — вас оно считает. Держите туда: с сегодняшнего дня она на вашей карте. Швартуйтесь к Плоту посреди неё и спросите Осоку. Что добудете там — едет в трюме, пока не сдадите, а что везёте — могут отнять.',
  ],
  logOpen: ['A green fire burns past Dead Man’s Expanse: the Blighted Sea is on your chart.', 'За Простором мертвецов горит зелёный огонь: Море Скверны теперь на вашей карте.'],
  enter: ['The water turns green under your keel: the Blighted Sea. No law, no colours, no mercy here.', 'Вода под килем зеленеет: Море Скверны. Здесь нет ни закона, ни флагов, ни пощады.'],
  tier: ['The Taint deepens: tier {0}. Rewards ×{1}.', 'Скверна густеет: ступень {0}. Награды ×{1}.'],
  hunter: ['A sail out of the green haze: the Blight sends a hunter after you.', 'Парус из зелёной мглы: Скверна послала за вами охотника.'],
  marks: ['+{0} marks of the Blight (in the hold: {1}).', '+{0} меток Скверны (в трюме: {1}).'],
  bankRim: ['You cross the rim alive: {0} marks banked. The Taint washes off.', 'Вы вышли за кромку живыми: сдано меток — {0}. Скверна смыта.'],
  bankRaft: ['Moored at the Raft: {0} marks banked ({1} to the Raft). The Taint washes off.', 'Вы у Плота: сдано меток — {0} (Плоту — {1}). Скверна смыта.'],
  moored: ['Moored at the Raft. No gun reaches you here, and yours stay silent.', 'Вы у Плота. Здесь вас не достанет ни одна пушка, и ваши молчат.'],
  mooring: ['Heaving to at the Raft: hold her still.', 'Ложимся в дрейф у Плота: держите корабль на месте.'],
  mooringOff: ['The lines never reached the Raft: she moved, or a shot flew.', 'Швартовы до Плота не дошли: корабль сдвинулся или прозвучал выстрел.'],
  castOff: ['Cast off from the Raft.', 'Отдали швартовы у Плота.'],
  notCleared: ['The green water is not yours yet.', 'Зелёная вода пока не ваша.'],
  moorFar: ['Sail closer to the Raft to moor.', 'Подойдите ближе к Плоту, чтобы пришвартоваться.'],
  moorHot: ['No mooring within half a minute of a shot given or taken.', 'Нельзя швартоваться в течение полминуты после выстрела — своего или по вам.'],
  moorBusy: ['Not while she is boarded or going down.', 'Не во время абордажа и не когда корабль тонет.'],
  raftOnly: ['That is done moored at the Raft.', 'Это делается у Плота.'],
  raftPeace: ['She lies at the Raft: no gun is fired there, hers or yours.', 'Корабль стоит у Плота: там не стреляет никто — ни он, ни вы.'],
  heartNoBoard: ['The ships the Blight sends cannot be boarded — guns only.', 'Корабли Скверны не взять на абордаж — только пушки.'],
  sunkLost: ['The green water keeps what rode in your hold: {0} marks lost.', 'Зелёная вода оставляет себе то, что было в трюме: потеряно меток — {0}.'],
  pvpPaid: ['{0} is sent down in the green water: +{1} marks.', '{0} идёт ко дну в зелёной воде: +{1} меток.'],
  pvpNone: ['{0} pays no marks: a mate of yours, or one barely through the rim.', '{0} не платит меток: это свой — или тот, кто едва переступил кромку.'],
  pvpRepeat: ['{0} was yours within the hour: a quarter of the marks.', '{0} уже был вашим в этот час: четверть меток.'],
  cask: ['A green cask hauled aboard: +{0} marks in the hold.', 'Зелёный бочонок на борту: +{0} меток в трюм.'],
  chosen: ['The Blight marks you: you are its Chosen. Every captain here sees you; your marks come a quarter richer.', 'Скверна отметила вас: вы её Избранник. Вас видит каждый капитан здесь; меток вам идёт на четверть больше.'],
  chosenOther: ['The Blight has chosen {0}: sinking her pays double marks.', 'Скверна выбрала капитана {0}: за потопление — двойные метки.'],
  heartSoon: ['The middle of the Blight is brightening: its Heart rises in ten minutes.', 'Середина Скверны светлеет: через десять минут поднимется её Сердце.'],
  heartUp: ['The Blight’s Heart has risen by the Raft. Every gun in the green water is wanted.', 'Сердце Скверны поднялось у Плота. Нужна каждая пушка в зелёной воде.'],
  heartDown: ['The Blight’s Heart goes down, and the light with her.', 'Сердце Скверны уходит под воду, и свет — вместе с ним.'],
  heartGone: ['The Blight’s Heart sinks back into the green, unbeaten.', 'Сердце Скверны уходит обратно в зелень непобеждённым.'],
  heartShare: ['Your part in the Heart: +{0} marks in the hold.', 'Ваша доля за Сердце: +{0} меток в трюм.'],
  xp: ['The green water', 'Зелёная вода'],
  bjStake: ['The dealer takes only the stakes on his slate.', 'Сдающий принимает только ставки со своей доски.'],
  bjBusy: ['Finish the hand on the table first.', 'Сначала доиграйте раздачу на столе.'],
  bjNone: ['There is no hand on the table.', 'На столе нет раздачи.'],
  bjDouble: ['Doubling is for the first two cards only.', 'Удвоить можно только на первых двух картах.'],
  bjMarks: ['Not enough banked marks: {0} needed.', 'Не хватает сданных меток: нужно {0}.'],
  bjHour: ['The dealer squares the deck: sixty hands an hour is the Raft’s rule. Come back shortly.', 'Сдающий подравнивает колоду: шестьдесят раздач в час — правило Плота. Загляните чуть позже.'],
  bjDay: ['The dealer closes the silver table for you today, kindly: you have lost enough. Marks are still welcome.', 'Сдающий на сегодня по-доброму закрывает для вас стол на серебро: вы проиграли достаточно. На метки — милости просим.'],
  bjWin: ['Twenty-one: you win {0}.', 'Двадцать одно: ваш выигрыш — {0}.'],
  bjNatural: ['Twenty-one on the deal: the house pays three to two — {0}.', 'Двадцать одно со сдачи: дом платит три к двум — {0}.'],
  bjPush: ['A push: your stake comes back.', 'Ровно: ставка возвращается.'],
  bjLose: ['The house takes the hand.', 'Раздачу забирает дом.'],
  bjBust: ['Over twenty-one: the house takes the stake.', 'Перебор: ставку забирает дом.'],
  shopNone: ['The Raft sells nothing of that kind.', 'Такого Плот не продаёт.'],
  shopOwned: ['That is yours already.', 'Это у вас уже есть.'],
  shopFull: ['Your speed-ups are at their limit.', 'Ускорений у вас уже предел.'],
  shopNoRelic: ['The Raft has no part for you now: make room in the locker.', 'Сейчас у Плота нет для вас части: освободите место в рундуке.'],
  shopNoPiece: ['No such piece, or no such line on it.', 'Нет такой вещи или такого свойства у неё.'],
  shopLantern: ['The Dark Lantern is lit: ten minutes of richer marks in the green water.', 'Тёмный фонарь зажжён: десять минут метки в зелёной воде идут богаче.'],
  shopBought: ['Bought at the Raft: {0} (−{1} marks).', 'Куплено на Плоту: {0} (−{1} меток).'],
  rerolled: ['Re-forged at the Raft: {0}.', 'Перековано на Плоту: {0}.'],
  qNone: ['No quest of the green water waits for that.', 'Такого задания зелёной воды нет.'],
  qTaken: ['A quest of the green water is yours: {0}.', 'Задание зелёной воды взято: {0}.'],
  qHave: ['You have a quest of the green water already.', 'У вас уже есть задание зелёной воды.'],
  qUndone: ['Its steps are not done yet.', 'Его шаги ещё не выполнены.'],
  qDone: ['The green water’s quest is done: {0} (+{1} marks).', 'Задание зелёной воды выполнено: {0} (+{1} меток).'],
  qStep: ['The green water: {0} — done.', 'Зелёная вода: {0} — готово.'],
  chapterDone: ['Chapter XXXVII is behind you. The green water has no end: its contracts come each day.', 'Глава XXXVII позади. У зелёной воды нет конца: её контракты приходят каждый день.'],
  cDone: ['A contract of the Blight is done: +{0} marks.', 'Контракт Скверны выполнен: +{0} меток.'],
  cNone: ['No such contract today.', 'Сегодня такого контракта нет.'],
  weekTop: ['The week in the green water is closed: {0} is its {1}.', 'Неделя в зелёной воде закрыта: {0} — {1}.'],
  weekLetter: ['The week in the green water', 'Неделя в зелёной воде'],
  weekBody: ['The Raft’s slate for the week is wiped. Your place on it: {0}. The title is yours until the next slate, and these marks with it.', 'Доску Плота за неделю стёрли. Ваше место на ней: {0}. Титул ваш до следующей доски, и эти метки — вместе с ним.'],
  weekPaid: ['The Raft’s week: place {0}, +{1} marks.', 'Неделя Плота: место {0}, +{1} меток.'],
  adminHelp: ['Usage: /blight [go|clear|tier N|marks N|heart|week|veil wall|open|status]', 'Usage: /blight [go|clear|tier N|marks N|heart|week|veil wall|open|status]'],
  adminVeilWall: ['The Veil is a wall: a captain the sea does not count its own is turned back at the rim.', 'Завеса — стена: капитана, которого море не считает своим, разворачивает у кромки.'],
  adminVeilOpen: ['The Veil is open: a captain the sea does not count its own crosses that water as any other, and the green water is not there for her.', 'Завеса открыта: капитан, которого море не считает своим, проходит эту воду как любую другую, а зелёной воды для него нет.'],
  adminGo: ['At the rim of the Blighted Sea.', 'У кромки Моря Скверны.'],
  adminClear: ['The green water is yours: the Veil lets this captain through.', 'Зелёная вода ваша: Завеса пропускает этого капитана.'],
  adminTier: ['Tier {0} of the Taint.', 'Ступень Скверны {0}.'],
  adminMarks: ['Banked marks: {0}.', 'Сданных меток: {0}.'],
  adminHeart: ['The Blight’s Heart rises now.', 'Сердце Скверны поднимается сейчас.'],
  adminWeek: ['The week of the green water is closed.', 'Неделя зелёной воды закрыта.'],
  adminStatus: ['Blight: cleared {0}, inside {1}, tier {2}, hold {3}, banked {4}, quest {5}.', 'Скверна: допуск {0}, внутри {1}, ступень {2}, в трюме {3}, сдано {4}, задание {5}.'],
} satisfies Record<string, Tr>;

export type BlightWord = keyof typeof BLIGHT_WORDS;

/** The English sentence of a key, its `{n}` filled. */
export function say(key: BlightWord, ...a: (string | number)[]): string {
  return BLIGHT_WORDS[key][0].replace(/\{(\d)\}/g, (_, i: string) => String(a[Number(i)] ?? ''));
}

/** The Raft's dealer and keeper, by name (the tables' logs and the windows). */
export const RAFT_DEALER: Tr = ['Quill', 'Перо'];
export const BLIGHT_NAME: Tr = ['The Blighted Sea', 'Море Скверны'];
export const RAFT_NAME: Tr = ['The Raft of the Blight', 'Плот Скверны'];
export const MARKS_NAME: Tr = ['Marks of the Blight', 'Метки Скверны'];

/** For client/src/lang/server.ts TABLE: every English line above with its Russian. */
export function blightPatterns(): [string, string][] {
  const out: [string, string][] = Object.entries(BLIGHT_WORDS).filter(([k]) => k !== 'adminHelp').map(([, v]) => [v[0], v[1]]);
  out.push(...HUNTER_NAMES, HUNTER_CAPTAIN, HEART_NAME, HEART_CAPTAIN, ...WEEK_TITLES, BLIGHT_TITLE, CHAPTER_TITLE, RAFT_DEALER, BLIGHT_NAME, RAFT_NAME, MARKS_NAME);
  out.push(BLIGHT_CHAPTER.title, BLIGHT_CHAPTER.giver);
  for (const w of BLIGHT_SHOP) out.push(w.name);
  for (const q of BLIGHT_QUESTS) out.push(q.t);
  // the steps as the «done» toast names them: the chapter's own and every number a contract may ask
  const steps = new Map<string, string>();
  const add = (s: BlightStep) => {
    const [en, ru] = stepText(s);
    steps.set(en, ru);
  };
  for (const q of BLIGHT_QUESTS) for (const s of q.s) add(s);
  for (const [en, ru] of contractStepPatterns()) steps.set(en, ru);
  out.push(...steps);
  return out;
}

/** The contracts' steps with their numbers left open (`{0}`, `{1}`): any number a day may ask reads in Russian. */
function contractStepPatterns(): [string, string][] {
  return [
    ['Sink {0} hunters at tier {1} or higher', 'Потопите охотников на ступени {1} и выше: {0}'],
    ['Sink {0} hunters of the green water', 'Потопите охотников зелёной воды: {0}'],
    ['Reach tier {0} of the Taint', 'Дойдите до ступени Скверны {0}'],
    ['Bank {0} marks at once', 'Сдайте разом меток: {0}'],
    ['Win {0} hands of twenty-one at the Raft', 'Выиграйте на Плоту раздач в двадцать одно: {0}'],
    ['Sink a captain in the green water — or {0} hunters at tier {1} or higher', 'Потопите капитана в зелёной воде — или охотников на ступени {1} и выше: {0}'],
    ['Stay alive {0} minutes at tier {1} or higher', 'Продержитесь {0} мин на ступени {1} и выше'],
  ];
}
