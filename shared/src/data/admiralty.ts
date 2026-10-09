// docs/19 E15: the Admiralty's contracts. Every week the Admiralty posts three hard contracts for the captains of the
// cap, on its boards in the great harbours (the key ports) and in the Throne's «Contracts» tab: three of four kinds,
// one resting each week by turns —
//  - legend: a legend of the trials gone rogue sails the deep waters (a spot of ⚓9–10 open sea, the gold mark); her
//    ship comes alongside a contract-holder who closes it and grapples at once (as the Abyss's legends do), her army and
//    hero those of a tier of the Abyss (2–4, by the week); what the captain cuts of it stays cut for her next boarding;
//  - citadel: watches on the citadels' walls this week — an hour of her men in her guild's garrison, an assault made, a
//    citadel taken or a siege held;
//  - seal: mythic depths of a seal of 10–12 or higher won within their rounds;
//  - delivery: the Admiralty's cargo from a great harbour to a port in lawless waters, through raiders who have word of
//    it (questgen's own pickup and delivery steps).
// A captain may take any of the week's three, each once (the choice is what her ship, her seal and her guild let her
// do); a contract lapses with its week. The pay is reckoned by the hours a geared captain spends on it: silver in hours
// at sea at ⚓10 (seaHourOf), glory in the experience of such an hour (seaHourXp), and a chance at a relic's part.
// Everything here is a function of the week and the world, the same for the server, the client and the tests: the
// contracts are QuestDefs (registered by id like the ports' group contracts, shared/src/data/elite.ts), so the journal,
// the pointers and the cargo steps of the quests carry them.

import { MAX_LEVEL } from '../constants.ts';
import { Rng, hashString } from '../rng.ts';
import { REGIONS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import { sectorAt } from '../world/sectors.ts';
import type { Port, World } from '../world/worldgen.ts';
import { openWater } from './advmap.ts';
import { CIT_WEEK_EPOCH, CIT_WEEK_MS, buildCitadels } from './citadels.ts';
import type { Tr } from './estate.ts';
import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import { SKILL_IDS } from './hero.ts';
import type { SkillId } from './hero.ts';
import { GIVER_FIRST, GIVER_LAST, GIVER_MEN, GIVER_WOMEN, PROFESSION_SEX, STEP_TEXT, fill, giverPortrait, numberedPattern } from './questgen.ts';
import type { Profession } from './questgen.ts';
import { QUESTS_BY_ID } from './quests.ts';
import type { QuestDef, QuestStep } from './quests.ts';
import { seaHourXp } from './roamers.ts';
import { seaHourOf } from './seamarks.ts';
import { LEGENDS } from './throne.ts';

export type AdmKind = 'legend' | 'citadel' | 'seal' | 'delivery';
export const ADM_KINDS: AdmKind[] = ['legend', 'citadel', 'seal', 'delivery'];
/** Contracts a week. */
export const ADM_PER_WEEK = 3;
/** A contract's id: its week and its place on the board. */
export const admId = (week: number, n: number): string => `adm_${week}_${n}`;
export const isAdmId = (id: string): boolean => id.startsWith('adm_');
/** The week of a contract's id (NaN: not a contract). */
export const admWeekOf = (id: string): number => Number(/^adm_(-?\d+)_\d+$/.exec(id)?.[1] ?? NaN);

/** The pay of an hour a geared captain spends on a contract (over what the work itself pays: the depth's spoils, the
 *  battle's lesson, the ambushers' purses): silver in hours at sea at ⚓10, glory in an hour's experience at ⚓10, and
 *  the relic part's chance — a base and so much an hour, up to a cap. */
export const ADM_PAY = { silver: 0.6, glory: 1, partBase: 0.2, partHour: 0.12, partMax: 0.55 };

/** The legend's tiers of the Abyss (its army and hero), and the hours a geared captain spends on each: the boardings it
 *  asks (tests/balance/abyssraid.ts raidBoardings(1.3): tier 2 — 2, 3 — 2, 4 — 3), the sailing out, the men hired again
 *  between them. */
export const ADM_LEGEND_TIERS = [2, 3, 4] as const;
export const ADM_LEGEND_HOURS: Record<number, number> = { 2: 1.25, 3: 1.5, 4: 2.25 };
/** Within this of the legend's mark her ship comes alongside. */
export const ADM_LEGEND_R = 1500;

/** The seal's asks (the level and the depths won in time) and a geared captain's chance in time at each
 *  (tests/balance/seals.ts: 10 — 80 %, 12 — 43 %): the hours are the depths' (a quarter of an hour each, the misses
 *  with them) and half an hour of sailing. */
export const ADM_SEAL_ASKS: { lv: number; count: number }[] = [{ lv: 10, count: 2 }, { lv: 11, count: 2 }, { lv: 12, count: 1 }];
export const ADM_SEAL_TIMED: Record<number, number> = { 10: 0.8, 11: 0.62, 12: 0.43 };

/** The citadels' watches: so many make the contract; what each deed counts. An hour counts when at least
 *  `ADM_GARRISON_MEN` of her men stand in her guild's garrison. */
export const ADM_WATCHES = 12;
export const ADM_WATCH = { hour: 1, assault: 4, take: 12, hold: 12 };
export const ADM_GARRISON_MEN = 40;
export const ADM_CITADEL_HOURS = 2;

/** The cargo run: the Admiralty's depot (a great harbour off the lawless waters) to a port in them this far away, the
 *  raiders' bands on the way (each of this many ships of her level), and what it carries. */
export const ADM_RUN_KM: [number, number] = [16, 32];
export const ADM_BANDS = 3;
export const ADM_BAND_SHIPS = 2;
const RUN_GOODS: { good: GoodId; qty: number }[] = [{ good: 'weapons', qty: 30 }, { good: 'gunpowder', qty: 40 }, { good: 'medicine', qty: 60 }];

/** The pay of a contract of so many hours. */
export function admPay(hours: number): { silver: number; glory: number; part: number } {
  return {
    silver: Math.round((seaHourOf(10) * hours * ADM_PAY.silver) / 10) * 10,
    glory: Math.round(seaHourXp(10) * hours * ADM_PAY.glory),
    part: Math.round(Math.min(ADM_PAY.partMax, ADM_PAY.partBase + ADM_PAY.partHour * hours) * 100) / 100,
  };
}

/** The hours of a seal's ask. */
export const sealHours = (lv: number, count: number): number => Math.round((0.5 + (count * 0.25) / (ADM_SEAL_TIMED[lv] ?? 0.5)) * 100) / 100;
/** The hours of a cargo run of so many km: the depot and the loading, the sailing (some 40 km an hour under way), a
 *  band of raiders fought or outrun. */
export const runHours = (km: number, bands = ADM_BANDS): number => Math.round((0.5 + km / 40 + bands * 0.12) * 100) / 100;

/** The week's three kinds: the four by turns, one resting. */
export function weekKinds(week: number): AdmKind[] {
  const rest = ((week % ADM_KINDS.length) + ADM_KINDS.length) % ADM_KINDS.length;
  return ADM_KINDS.filter((_, i) => i !== rest);
}

/** When a week ends (wall ms): the Admiralty's week is the citadels' (from a Monday, UTC). */
export const admWeekEnd = (week: number): number => CIT_WEEK_EPOCH + (week + 1) * CIT_WEEK_MS;

// ------------------------------------------------------------------ the words

const MENTOR: Tr = ['{giver}, the Admiralty’s commissioner', '{giver}, комиссар Адмиралтейства'];

const NAMES: Record<AdmKind, Tr[]> = {
  legend: [
    ['The Admiralty’s Warrant: {name}', 'Ордер Адмиралтейства: {name}'],
    ['A Legend Gone Rogue', 'Легенда вне закона'],
    ['Strike Her Colours', 'Спустить её флаг'],
  ],
  citadel: [
    ['A Watch on the Walls', 'Вахта на стенах'],
    ['The Throne’s Walls', 'Стены Престола'],
    ['Hold the Citadels', 'Удержать цитадели'],
  ],
  seal: [
    ['The Deep Must Answer', 'Глубина должна ответить'],
    ['Seals for the Admiralty', 'Печати для Адмиралтейства'],
    ['Down to the Mythic Depths', 'В мифические глубины'],
  ],
  delivery: [
    ['Cargo for {port2}', 'Груз для порта {port2}'],
    ['Through the Gauntlet', 'Сквозь строй'],
    ['The Admiralty’s Cargo', 'Груз Адмиралтейства'],
  ],
};

const SUMMARY: Record<AdmKind, Tr> = {
  legend: [
    'The legend {name} has left the Throne’s trials for the open sea: the {ship} takes what she likes in the waters of {region}. The Admiralty wants her colours struck.',
    'Легенда {name} оставила испытания Престола и вышла в открытое море: «{ship}» берёт что хочет в водах «{region}». Адмиралтейство требует спустить её флаг.',
  ],
  citadel: [
    'The Admiralty pays the captains who stand in the citadels’ war: keep your men in your guild’s garrison, storm a citadel or hold one against a siege this week.',
    'Адмиралтейство платит капитанам, что стоят в войне за цитадели: держите своих людей в гарнизоне цитадели гильдии, штурмуйте цитадель или отстойте её в осаде на этой неделе.',
  ],
  seal: [
    'The Admiralty charts the mythic depths and pays for proof: win depths of seal {lv} or higher within their rounds.',
    'Адмиралтейство наносит мифические глубины на карту и платит за доказательства: возьмите в срок глубины печати {lv} или выше.',
  ],
  delivery: [
    'The garrison of {port2} waits for the Admiralty’s {good}. Raiders know the cargo sails from {port}, and they will come for it on the way.',
    'Гарнизон порта {port2} ждёт груз Адмиралтейства: {good}. Налётчики знают, что он идёт из порта {port}, и выйдут ему навстречу.',
  ],
};

const STEP: Record<'legend' | 'citadel' | 'seal', Tr> = {
  legend: ['Board the {ship} in the waters of {region} (the gold mark) and make her strike.', 'Возьмите «{ship}» на абордаж в водах «{region}» (золотая метка) и заставьте спустить флаг.'],
  citadel: [
    'Watches on the citadels’ walls: {n} (an hour of your men in your guild’s garrison — 1, an assault — 4, a citadel taken or held — all).',
    'Вахты на стенах цитаделей: {n} (час ваших людей в гарнизоне гильдии — 1, штурм — 4, взятая или отстоянная цитадель — все).',
  ],
  seal: ['Win mythic depths of seal {lv}+ within their rounds: {n}.', 'Возьмите в срок мифические глубины печати {lv}+: {n}.'],
};

/** The giver of each kind (questgen's trades: the portraits are theirs). */
const GIVER: Record<AdmKind, Profession> = { legend: 'garrison_captain', citadel: 'garrison_captain', seal: 'cartographer', delivery: 'harbour_master' };

// ------------------------------------------------------------------ the contracts

export interface AdmContract {
  id: string;
  week: number;
  n: number;
  kind: AdmKind;
  /** The hours a geared captain spends on it, and what it pays. */
  hours: number;
  pay: { silver: number; glory: number; part: number };
  legend?: { skill: SkillId; tier: number; x: number; y: number; region: RegionId };
  seal?: { lv: number; count: number };
  citadel?: { need: number };
  delivery?: { from: string; to: string; good: GoodId; qty: number; bands: number; km: number };
  quest: QuestDef;
}

/** The world the contracts are drawn on (the server registers it when the world is made; the tests' games too). */
let WORLD: World | null = null;
const weeks = new WeakMap<World, Map<number, AdmContract[]>>();
export function registerAdmiralty(world: World): void {
  WORLD = world;
}

/** The Admiralty's boards: the great harbours (the key ports). */
export function admiraltyPorts(world: World): Port[] {
  return world.ports.filter((p) => p.key && !p.raft);
}
export const isAdmiraltyPort = (p: Port | undefined | null): boolean => !!p && p.key && !p.raft;

/** The legend's mark: open deep water of ⚓9–10 (lower if the sea has none), off the ports and the citadels, yet within
 *  a harbour's reach (4–15 km: the men she loses are hired again between the boardings). */
function legendSpot(world: World, rng: Rng): { x: number; y: number; region: RegionId } {
  const ports = world.ports.filter((p) => !p.raft);
  const cits = buildCitadels(world);
  for (const min of [9, 8, 7, 1]) {
    for (let k = 0; k < 800; k++) {
      const x = 4000 + rng.float() * 88000, y = 4000 + rng.float() * 88000;
      const sec = sectorAt(world, x, y);
      if (sec.level < min || !openWater(world, x, y)) continue;
      const near = Math.min(...ports.map((p) => Math.hypot(p.x - x, p.y - y)));
      if (near < 4000 || near > 15000 || cits.some((c) => Math.hypot(c.x - x, c.y - y) < 3000)) continue;
      return { x: Math.round(x), y: Math.round(y), region: sec.region };
    }
  }
  return { x: 48000, y: 48000, region: 'black_coast' };
}

/** The cargo run: a depot (a great harbour off the lawless waters) and a port in them 16–32 km away. */
function cargoRun(world: World, rng: Rng): { from: Port; to: Port; km: number } | null {
  const depots = admiraltyPorts(world).filter((p) => REGIONS[p.region].safety !== 'lawless');
  const wild = world.ports.filter((p) => !p.raft && REGIONS[p.region].safety === 'lawless');
  const pairs: { from: Port; to: Port; km: number }[] = [];
  for (const a of depots) for (const b of wild) {
    const km = Math.hypot(a.x - b.x, a.y - b.y) / 1000;
    if (km >= ADM_RUN_KM[0] && km <= ADM_RUN_KM[1]) pairs.push({ from: a, to: b, km });
  }
  if (!pairs.length) {
    for (const a of depots) for (const b of wild) pairs.push({ from: a, to: b, km: Math.hypot(a.x - b.x, a.y - b.y) / 1000 });
    pairs.sort((p, q) => Math.abs(p.km - 24) - Math.abs(q.km - 24));
    pairs.length = Math.min(pairs.length, 4);
  }
  return pairs.length ? pairs[rng.int(0, pairs.length - 1)] : null;
}

/** The Admiralty's three of a week on a world (the same for every call). Registered as quests by their ids. */
export function admiraltyWeek(week: number, world: World | null = WORLD): AdmContract[] {
  if (!world) return [];
  let map = weeks.get(world);
  if (!map) weeks.set(world, (map = new Map()));
  const hit = map.get(week);
  if (hit) return hit;
  const out: AdmContract[] = [];
  const home = admiraltyPorts(world);
  weekKinds(week).forEach((kind, n) => {
    const id = admId(week, n);
    // The week's own dice (never the sea's: the same week is the same everywhere and a test can replay it).
    const rng = new Rng((hashString(`adm:${week}:${n}:${kind}`) ^ Math.imul(world.seed | 0, 2654435761)) >>> 0);
    const sex = PROFESSION_SEX[GIVER[kind]];
    const giver = `${rng.pick(sex === 'f' ? GIVER_WOMEN : sex === 'm' ? GIVER_MEN : GIVER_FIRST)} ${rng.pick(GIVER_LAST)}`;
    const fi = rng.int(0, NAMES[kind].length - 1);
    let hours = 1, steps: QuestStep[] = [], name = '', summary = '';
    let port = home.length ? home[rng.int(0, home.length - 1)].id : world.ports[0]?.id ?? '';
    const c: Omit<AdmContract, 'quest' | 'pay' | 'hours'> = { id, week, n, kind };
    if (kind === 'legend') {
      const skill = SKILL_IDS[rng.int(0, SKILL_IDS.length - 1)];
      const tier = ADM_LEGEND_TIERS[rng.int(0, ADM_LEGEND_TIERS.length - 1)];
      const spot = legendSpot(world, rng);
      c.legend = { skill, tier, ...spot };
      hours = ADM_LEGEND_HOURS[tier];
      const lg = LEGENDS[skill];
      const vals = { name: lg.name[0], ship: lg.ship[0], region: REGIONS[spot.region].name };
      name = fill(NAMES.legend[fi][0], vals);
      summary = fill(SUMMARY.legend[0], vals);
      steps = [{ type: 'legend', count: 1, text: fill(STEP.legend[0], vals) }];
    } else if (kind === 'citadel') {
      c.citadel = { need: ADM_WATCHES };
      hours = ADM_CITADEL_HOURS;
      name = NAMES.citadel[fi][0];
      summary = SUMMARY.citadel[0];
      steps = [{ type: 'citadel', count: ADM_WATCHES, text: fill(STEP.citadel[0], { n: String(ADM_WATCHES) }) }];
    } else if (kind === 'seal') {
      const ask = ADM_SEAL_ASKS[rng.int(0, ADM_SEAL_ASKS.length - 1)];
      c.seal = { ...ask };
      hours = sealHours(ask.lv, ask.count);
      const vals = { lv: String(ask.lv), n: String(ask.count) };
      name = NAMES.seal[fi][0];
      summary = fill(SUMMARY.seal[0], vals);
      steps = [{ type: 'seal', count: ask.count, minLv: ask.lv, text: fill(STEP.seal[0], vals) }];
    } else {
      const run = cargoRun(world, rng);
      const cargo = RUN_GOODS[rng.int(0, RUN_GOODS.length - 1)];
      if (run) {
        const km = Math.round(run.km * 10) / 10;
        c.delivery = { from: run.from.id, to: run.to.id, good: cargo.good, qty: cargo.qty, bands: ADM_BANDS, km };
        hours = runHours(km);
        port = run.from.id;
        const good = GOODS[cargo.good].name;
        const vals = { good, n: String(cargo.qty), port: run.from.name, port2: run.to.name };
        name = fill(NAMES.delivery[fi][0], vals);
        summary = fill(SUMMARY.delivery[0], { ...vals, good: good.toLowerCase() });
        // questgen's own steps: the cargo taken on at the depot, carried to the lawless port.
        steps = [
          { type: 'pickup', port: run.from.id, good: cargo.good, qty: cargo.qty, text: fill(STEP_TEXT.pickup[0], vals) },
          { type: 'deliver', port: run.to.id, good: cargo.good, qty: cargo.qty, text: fill(STEP_TEXT.deliver2[0], vals) },
        ];
      }
    }
    if (!steps.length) return;
    const pay = admPay(hours);
    const quest: QuestDef = {
      id, kind: 'job', name, mentor: fill(MENTOR[0], { giver }), port, summary, requires: { level: MAX_LEVEL }, steps,
      reward: { xp: pay.glory, silver: pay.silver }, category: 'admiralty', portrait: giverPortrait(GIVER[kind], giver),
    };
    QUESTS_BY_ID[id] = quest;
    out.push({ ...c, hours, pay, quest });
  });
  map.set(week, out);
  // (a few weeks kept: the tester turns them, a saved journal looks one up)
  for (const k of [...map.keys()]) if (Math.abs(k - week) > 4) map.delete(k);
  return out;
}

/** A contract by its id (a saved captain's journal after a restart): its week's, registered as a quest. */
export function admiraltyById(id: string): AdmContract | null {
  const week = admWeekOf(id);
  if (!Number.isFinite(week)) return null;
  return admiraltyWeek(week).find((c) => c.id === id) ?? null;
}

// ------------------------------------------------------------------ what the captain sees

/** A contract as the Throne's tab and the Admiralty's board show it. */
export interface AdmRow {
  id: string;
  n: number;
  kind: AdmKind;
  name: string;
  mentor: string;
  summary: string;
  portrait?: string;
  steps: string[];
  /** open: on the board; taken: in her journal (the step she is on, its progress); done: fulfilled this week. */
  state: 'open' | 'taken' | 'done';
  step: number;
  progress: number;
  need: number;
  hours: number;
  pay: { silver: number; glory: number; part: number };
  /** Why she cannot take it now (null: she can, here). */
  why: string | null;
  /** Where its course leads now (the legend's mark, the cargo's next port, her seal's lair, a citadel). */
  at?: { x: number; y: number; d: number };
  legend?: { skill: SkillId; name: string; ship: string; path: string; tier: number; share: number; left: { u: string; n: number }[]; why: string | null; fighting?: boolean };
  seal?: { lv: number; count: number; mine: number };
  delivery?: { from: string; to: string; good: string; qty: number; bands: number; km: number };
}

export interface AdmView {
  week: number;
  /** Seconds to the week's end. */
  endsIn: number;
  /** She lies at an Admiralty board now. */
  board: boolean;
  /** The boards' harbours (port ids). */
  ports: string[];
  rows: AdmRow[];
  /** Contracts fulfilled this week. */
  done: number;
}

// ------------------------------------------------------------------ the words of the server

/** Every template's English and Russian, numbered as the translator wants them (questgen numberedPattern). */
export function admiraltyPatterns(): [string, string][] {
  const out: [string, string][] = [numberedPattern(MENTOR[0], MENTOR[1])];
  for (const k of ADM_KINDS) {
    for (const nm of NAMES[k]) out.push(numberedPattern(nm[0], nm[1]));
    out.push(numberedPattern(SUMMARY[k][0], SUMMARY[k][1]));
  }
  for (const k of ['legend', 'citadel', 'seal'] as const) out.push(numberedPattern(STEP[k][0], STEP[k][1]));
  return out;
}

/** The kinds' names for the tab and the board, and their marks. */
export const ADM_KIND_NAMES: Record<AdmKind, Tr> = {
  legend: ['Hunt a legend', 'Охота на легенду'],
  citadel: ['Hold the citadels', 'Удержание цитаделей'],
  seal: ['Seal of the deep', 'Печать глубин'],
  delivery: ['Cargo under threat', 'Доставка под угрозой'],
};
export const ADM_KIND_ICON: Record<AdmKind, string> = { legend: 'bt_charge', citadel: 'build_fort', seal: 'ab_deep_call', delivery: 'good_weapons' };
/** The tab's and the board's mark. */
export const ADM_ICON = 'map_contract';
