// Fishing (docs/12 P3): fifteen kinds of fish, where and when each is found and how it is taken — nets through a
// shoal, trolling rods on open water, pots on the shallows, a lamp by night, a deep line over the drop — the craft
// that grows with every catch, and the fight with a big fish on the line ("playing" it), simulated the same way on the
// client (to draw it) and the server (to judge it): the server replays the captain's holds of the line.

import type { IslandBiome, RegionId } from '../world/regions.ts';

export type FishId = 'herring' | 'mackerel' | 'cod' | 'crab' | 'ray' | 'squid' | 'moray' | 'tuna' | 'lobster' | 'sunfish' | 'swordfish' | 'silver_eel' | 'lanternfish' | 'anglerfish' | 'goldfish';
export type FishMethod = 'net' | 'rod' | 'trap' | 'lamp' | 'deep';

export interface FishDef {
  id: FishId;
  name: [string, string];
  methods: FishMethod[];
  regions?: RegionId[];
  biomes?: IslandBiome[];
  /** Within 2.5 km of land (else open water, 3 km out). */
  coast?: boolean;
  open?: boolean;
  time?: 'day' | 'night' | 'fog';
  kg: [number, number];
  good: 'fish' | 'prime_fish';
  /** The craft it wants. */
  skill: number;
  /** How often, among what fits. */
  weight: number;
  /** A fight on the line: the fish's strength and the force of its runs. */
  fight?: { stamina: number; surge: number };
  trophy?: boolean;
  mythic?: boolean;
}

const WARM: RegionId[] = ['black_coast', 'gravewater', 'whispering', 'ashen_isles'];
const COLD: RegionId[] = ['leviathan_reach', 'gravewater', 'black_coast'];
const DEEP: RegionId[] = ['drowned_crown', 'the_abyss'];

export const FISH: Record<FishId, FishDef> = {
  herring: { id: 'herring', name: ['Herring', 'Сельдь'], methods: ['net'], regions: ['black_coast', 'gravewater', 'leviathan_reach'], coast: true, time: 'day', kg: [0.2, 0.4], good: 'fish', skill: 1, weight: 10 },
  mackerel: { id: 'mackerel', name: ['Mackerel', 'Макрель'], methods: ['net', 'rod'], regions: WARM, kg: [0.4, 1.2], good: 'fish', skill: 1, weight: 8, fight: { stamina: 12, surge: 0.25 } },
  cod: { id: 'cod', name: ['Cod', 'Треска'], methods: ['net', 'deep'], regions: COLD, kg: [1, 8], good: 'fish', skill: 1, weight: 8, fight: { stamina: 20, surge: 0.3 } },
  crab: { id: 'crab', name: ['Crab', 'Краб'], methods: ['trap'], coast: true, kg: [0.3, 2], good: 'fish', skill: 15, weight: 8 },
  ray: { id: 'ray', name: ['Stingray', 'Скат-хвостокол'], methods: ['net'], biomes: ['mangrove', 'atoll', 'saltflat', 'jungle'], coast: true, time: 'day', kg: [3, 20], good: 'fish', skill: 5, weight: 4 },
  squid: { id: 'squid', name: ['Squid', 'Кальмар'], methods: ['lamp'], open: true, time: 'night', kg: [0.5, 5], good: 'prime_fish', skill: 30, weight: 8 },
  moray: { id: 'moray', name: ['Moray', 'Мурена'], methods: ['rod'], regions: ['whispering', 'ashen_isles', 'drowned_crown'], coast: true, time: 'night', kg: [2, 10], good: 'prime_fish', skill: 20, weight: 4, fight: { stamina: 30, surge: 0.6 } },
  tuna: { id: 'tuna', name: ['Tuna', 'Тунец'], methods: ['rod'], open: true, time: 'day', kg: [20, 200], good: 'prime_fish', skill: 25, weight: 6, fight: { stamina: 60, surge: 0.5 } },
  lobster: { id: 'lobster', name: ['Lobster', 'Омар'], methods: ['trap'], biomes: ['atoll', 'jungle', 'mossy', 'volcanic', 'crystal'], coast: true, kg: [0.5, 4], good: 'prime_fish', skill: 20, weight: 4 },
  sunfish: { id: 'sunfish', name: ['Ocean Sunfish', 'Рыба-луна'], methods: ['net'], regions: WARM, open: true, time: 'day', kg: [200, 1000], good: 'prime_fish', skill: 35, weight: 1, trophy: true },
  swordfish: { id: 'swordfish', name: ['Swordfish', 'Меч-рыба'], methods: ['rod'], regions: ['gravewater', 'whispering', 'ashen_isles', 'dead_mans_expanse', 'leviathan_reach'], open: true, time: 'day', kg: [50, 400], good: 'prime_fish', skill: 45, weight: 2, fight: { stamina: 100, surge: 0.8 }, trophy: true },
  silver_eel: { id: 'silver_eel', name: ['Silver Eel', 'Серебряный угорь'], methods: ['lamp'], regions: ['whispering'], time: 'fog', kg: [1, 4], good: 'prime_fish', skill: 40, weight: 2 },
  lanternfish: { id: 'lanternfish', name: ['Lanternfish', 'Рыба-фонарь'], methods: ['lamp'], regions: DEEP, time: 'night', kg: [0.3, 1], good: 'prime_fish', skill: 50, weight: 3, mythic: true },
  anglerfish: { id: 'anglerfish', name: ['Deep Angler', 'Глубинный удильщик'], methods: ['deep'], regions: DEEP, time: 'night', kg: [10, 60], good: 'prime_fish', skill: 60, weight: 2, fight: { stamina: 80, surge: 1.0 }, trophy: true, mythic: true },
  goldfish: { id: 'goldfish', name: ['Golden Fish', 'Золотая рыбка'], methods: ['net', 'rod', 'trap', 'lamp', 'deep'], kg: [0.1, 0.2], good: 'prime_fish', skill: 1, weight: 0 },
};

export const FISH_IDS = Object.keys(FISH) as FishId[];

/** The craft a method wants first (and the reading of the water at 25). */
export const METHOD_SKILL: Record<FishMethod, number> = { net: 1, rod: 1, trap: 15, lamp: 30, deep: 60 };
export const READ_WATER = 25;
export const SKILL_MAX = 100;

/** The method a tackle base serves. */
export const TACKLE_METHOD: Record<string, FishMethod> = { drift_net: 'net', trolling_rods: 'rod', crab_traps: 'trap', squid_lamp: 'lamp' };

/** Experience of the craft to its next point: slow at the top. */
export function craftXpNext(skill: number): number {
  return Math.round(20 + skill * skill * 0.6);
}

/** How many pots a captain may have out: three, one more for every 25 points of the craft. */
export function trapsAllowed(skill: number): number {
  return 3 + Math.floor(skill / 25);
}

/** Pots fill for half an hour at most; less than ten minutes gives nothing yet. */
export const TRAP_MIN_SEC = 10 * 60;
export const TRAP_FULL_SEC = 30 * 60;

// ------------------------------------------------------------------------------------------------ the fight on the line

export interface FightParams {
  stamina: number;
  /** Surges: [start, end, force] in seconds from the bite. */
  surges: [number, number, number][];
  /** The longest a fight lasts before the fish is simply gone. */
  limit: number;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fish's fight from its kind, weight and the seed of the bite: its strength and when it runs. */
export function fightParams(fish: FishId, kg: number, seed: number): FightParams {
  const def = FISH[fish];
  const f = def.fight ?? { stamina: 10, surge: 0.2 };
  const heavy = (kg - def.kg[0]) / Math.max(0.001, def.kg[1] - def.kg[0]);
  const rnd = mulberry(seed);
  const surges: [number, number, number][] = [];
  for (let t = 1 + rnd() * 1.2; t < 40; t += 1.2 + rnd() * 1.8) {
    const len = 0.5 + rnd() * 0.8;
    surges.push([t, t + len, f.surge * (0.6 + rnd() * 0.6) * (0.8 + heavy * 0.5)]);
    t += len;
  }
  return { stamina: f.stamina * (0.7 + heavy * 0.6), surges, limit: 40 };
}

export interface FightState {
  t: number;
  tension: number;
  stamina: number;
  slack: number;
  done: 'landed' | 'snapped' | 'escaped' | null;
}

export const FIGHT_DT = 0.05;

/** One step of the fight: the line held (reeling in) or let run. */
export function fightStep(p: FightParams, st: FightState, holding: boolean, craft: number): FightState {
  if (st.done) return st;
  const dt = FIGHT_DT;
  const t = st.t + dt;
  const surge = p.surges.find((s) => t >= s[0] && t < s[1]);
  // A good hand (the craft) keeps the line a little slacker under the same pull.
  const give = 1 - Math.min(0.35, craft / 300);
  let tension = st.tension + dt * (holding ? 26 * give : -34) + (surge ? surge[2] * 46 * dt * give : 0);
  tension = Math.max(0, tension);
  let stamina = st.stamina;
  if (holding) stamina -= dt * (5 + tension * 0.09);
  const slack = tension < 8 ? st.slack + dt : 0;
  let done: FightState['done'] = null;
  if (tension >= 100) done = 'snapped';
  else if (stamina <= 0) done = 'landed';
  else if (slack >= 3) done = 'escaped';
  else if (t >= p.limit) done = 'escaped';
  return { t, tension: Math.min(100, tension), stamina: Math.max(0, stamina), slack, done };
}

export function fightStart(p: FightParams): FightState {
  return { t: 0, tension: 30, stamina: p.stamina, slack: 0, done: null };
}

/**
 * The whole fight from the captain's holds of the line ([from, to] seconds): what the server judges by.
 * Holds are sorted and clipped; anything past the limit is ignored.
 */
export function playFight(p: FightParams, holds: [number, number][], craft: number): FightState {
  const hs = holds.filter((h) => Array.isArray(h) && h.length === 2 && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[1] > h[0]).slice(0, 400).sort((a, b) => a[0] - b[0]);
  let st = fightStart(p);
  let i = 0;
  while (!st.done) {
    while (i < hs.length && hs[i][1] <= st.t) i++;
    const holding = i < hs.length && st.t >= hs[i][0] && st.t < hs[i][1];
    st = fightStep(p, st, holding, craft);
  }
  return st;
}

// ------------------------------------------------------------------------------------------------ hauling the net

/**
 * Hauling a net (owner, 2026-09-30: «fishing must not be automatic»): the captain casts, the net's floats dip one by
 * one, and a pull in time on each dip brings that stretch of net in full. A pull too soon spooks it (the stretch is
 * lost), none at all lets it go. The floats twitch now and then before they dip — only the dip counts. The same
 * seed makes the same haul on the client (to play it) and the server (to judge the pulls sent back).
 */
export interface HaulParams {
  /** When each float dips, seconds from the cast. */
  dips: number[];
  /** How long a dip lasts: a pull within it counts. */
  window: number;
  /** Twitches before the dips (seconds from the cast): feints, they count for nothing. */
  twitches: number[];
  /** The haul is over (and judged) by then. */
  end: number;
}

export const HAUL_FLOATS = 3;
/** What a haul brings for 0..3 floats pulled in time, as a share of the net's full haul. */
export const HAUL_SHARE = [0, 0.6, 1, 1.3];
/** Seconds between casts of the net, from one cast to the next. */
export const CAST_COOLDOWN = 10;

export function haulParams(seed: number, craft: number): HaulParams {
  const rnd = mulberry(seed ^ 0x5eed);
  const window = Math.round((0.55 + Math.min(0.25, Math.max(0, craft) / 200)) * 100) / 100;
  const dips: number[] = [];
  const twitches: number[] = [];
  let t = 0.4;
  for (let i = 0; i < HAUL_FLOATS; i++) {
    const wait = (i === 0 ? 1.0 : 1.1) + rnd() * 1.4;
    // A feint in the wait now and then (never within half a second of the dip itself).
    if (rnd() < 0.75) twitches.push(Math.round((t + 0.25 + rnd() * Math.max(0.1, wait - 0.8)) * 100) / 100);
    t += wait;
    dips.push(Math.round(t * 100) / 100);
    t += window;
  }
  return { dips, window, twitches, end: Math.round((t + 0.4) * 100) / 100 };
}

export type HaulMark = 'hit' | 'early' | 'missed';

/** The haul judged from the captain's pulls (seconds from the cast): the first pull in each float's turn decides it. */
export function judgeHaul(p: HaulParams, pulls: number[]): { hits: number; marks: HaulMark[] } {
  const ps = (Array.isArray(pulls) ? pulls : []).filter((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0).slice(0, 40).sort((a, b) => a - b);
  const marks: HaulMark[] = [];
  let from = 0;
  for (const d of p.dips) {
    const to = d + p.window;
    const first = ps.find((x) => x >= from && x <= to);
    marks.push(first === undefined ? 'missed' : first >= d ? 'hit' : 'early');
    from = to + 1e-6;
  }
  return { hits: marks.filter((m) => m === 'hit').length, marks };
}

/** The server's lines about fishing, English → Russian. */
export function fishingPatterns(): [string, string][] {
  const out: [string, string][] = [
    ['No tackle in that slot', 'Снасти нет'],
    ['Your craft is not up to it yet ({0} of {1})', 'Промысел пока не тот ({0} из {1})'],
    ['Pots go down in the shallows, within a mile of land', 'Ловушки ставят на мелководье, не дальше мили от берега'],
    ['You have {0} pots out already', 'У вас уже стоит ловушек: {0}'],
    ['A pot goes down: haul it in ten minutes or more.', 'Ловушка опущена: поднимайте через десять минут или позже.'],
    ['No pot of yours near', 'Рядом нет вашей ловушки'],
    ['Too soon: the pot has been down {0} min', 'Рано: ловушка стоит всего {0} мин'],
    ['The pot comes up: {0} {1}.', 'Ловушка поднята: {1} — {0}.'],
    ['The pot comes up empty.', 'Ловушка поднята пустой.'],
    ['Someone hauls your pot off {0}: gone, catch and all.', 'Кто-то поднял вашу ловушку у острова {0}: пропала вместе с уловом.'],
    ['A bite! Play it: hold to reel in, let it run when the line is taut.', 'Клюёт! Выводите: держите — сматываете, отпускайте, когда леска натянута.'],
    ['Landed: {0}, {1} kg.', 'Вытащили: {0}, {1} кг.'],
    ['The line snaps. It was a big one.', 'Леска лопнула. Крупная была.'],
    ['It shakes the hook and is gone.', 'Сорвалась и ушла.'],
    ['The deep line goes down into the dark.', 'Донная леска уходит в темноту.'],
    ['The deep line wants still water over a deep drop', 'Донной леске нужна стоячая вода над глубиной'],
    ['Something enormous takes the line and the whole reel with it.', 'Что-то огромное утаскивает леску вместе с катушкой.'],
    ['Salted: {0} fish into {1} barrels.', 'Засолено: {0} рыбы — в {1} бочек.'],
    ['Nothing to salt: fresh fish and salt are both needed', 'Нечего солить: нужны и свежая рыба, и соль'],
    ['Your fishing craft rises to {0}.', 'Промысел вырос до {0}.'],
    ['You can read the water now: every shoal shows what swims in it.', 'Теперь вы читаете воду: у каждого косяка видно, что в нём ходит.'],
    ['A new record: {0}, {1} {2} kg!', 'Новый рекорд: {0}, {1} — {2} кг!'],
    ['A golden fish! It begs for its life and grants you luck for an hour.', 'Золотая рыбка! Она просит отпустить её и дарит удачу на час.'],
    ['In the net: a bottle with a letter inside.', 'В сети — бутылка с письмом внутри.'],
    ['In the net: a scrap of an old chart.', 'В сети — клочок старой карты.'],
    ['A moray bites a hand on the line.', 'Мурена кусает руку на леске.'],
    ['A stingray lashes a man in the net.', 'Скат хлещет хвостом человека у сети.'],
    ['The net tears on the rocks.', 'Сеть рвётся о камни.'],
    ['The hold is full: the catch goes back over the side.', 'Трюм полон: улов уходит обратно за борт.'],
  ];
  for (const f of Object.values(FISH)) out.push(f.name);
  return out;
}
