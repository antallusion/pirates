// The campaign's step codes (types.ts StepCode): parsed, counted by the quest's level, and worded — each kind with a few
// wordings in both tongues, picked by the quest so that seven hundred quests do not read as one.

import type { BeastGroup } from '../beasts.ts';
import type { GoodId } from '../goods.ts';
import { GOODS } from '../goods.ts';
import type { T } from './types.ts';

export type StepKind =
  | 'hub' | 'at' | 'port' | 'port2' | 'isle' | 'isle2' | 'land' | 'land2' | 'board' | 'sink' | 'lair' | 'beast' | 'chart' | 'dive' | 'catch' | 'named'
  | 'rescue' | 'prize' | 'tribute' | 'carry' | 'bring' | 'escort' | 'reach' | 'claim' | 'build' | 'recruit' | 'customs' | 'contraband';

export const STEP_KINDS: readonly StepKind[] = ['hub', 'at', 'port', 'port2', 'isle', 'isle2', 'land', 'land2', 'board', 'sink', 'lair', 'beast', 'chart', 'dive', 'catch', 'named',
  'rescue', 'prize', 'tribute', 'carry', 'bring', 'escort', 'reach', 'claim', 'build', 'recruit', 'customs', 'contraband'];

export type SinkRole = 'pirate' | 'ghost' | 'patrol' | 'merchant' | 'hunter';
export const SINK_ROLES: readonly SinkRole[] = ['pirate', 'ghost', 'patrol', 'merchant', 'hunter'];
export const SITES = ['ruins', 'shrine', 'bell', 'fishers', 'smugglers', 'pirate_camp', 'seals', 'crabs', 'turtles'] as const;
export type Site = (typeof SITES)[number];
export const BEAST_GROUPS: readonly (BeastGroup | 'any')[] = ['whale', 'orca', 'shark', 'any'];

/** A step's code read. */
export interface StepSpec {
  kind: StepKind;
  /** The count asked (null: the builder's, by the level). */
  n: number | null;
  role?: SinkRole;
  site?: Site;
  group?: BeastGroup | 'any';
  good?: GoodId;
  /** `at`: the port named. */
  port?: string;
}

/** A code read, or the reason it cannot be. */
export function parseStep(code: string): StepSpec | string {
  const [k, ...rest] = code.split(':');
  const kind = k as StepKind;
  if (!STEP_KINDS.includes(kind)) return `unknown step «${k}»`;
  const num = (s: string | undefined): number | null | string => {
    if (s === undefined || s === '') return null;
    const v = Number(s);
    return Number.isInteger(v) && v >= 1 && v <= 60 ? v : `bad count «${s}»`;
  };
  const out: StepSpec = { kind, n: null };
  switch (kind) {
    case 'at':
      if (rest.length !== 1 || !/^[a-z_]+$/.test(rest[0])) return `«${code}» wants a port`;
      out.port = rest[0];
      return out;
    case 'land':
    case 'land2':
      if (rest.length > 1) return `too many parts in «${code}»`;
      if (rest[0]) {
        if (!(SITES as readonly string[]).includes(rest[0])) return `unknown site «${rest[0]}»`;
        out.site = rest[0] as Site;
      }
      return out;
    case 'sink': {
      if (rest.length > 2) return `too many parts in «${code}»`;
      if (rest.length === 1 && (SINK_ROLES as readonly string[]).includes(rest[0])) rest.unshift(''); // sink:<role>
      const n = num(rest[0]);
      if (typeof n === 'string') return n;
      out.n = n;
      if (rest[1]) {
        if (!(SINK_ROLES as readonly string[]).includes(rest[1])) return `unknown role «${rest[1]}»`;
        out.role = rest[1] as SinkRole;
      }
      return out;
    }
    case 'beast': {
      if (rest.length > 2) return `too many parts in «${code}»`;
      const g = rest[0] || 'any';
      if (!(BEAST_GROUPS as readonly string[]).includes(g)) return `unknown beasts «${g}»`;
      out.group = g as BeastGroup | 'any';
      const n = num(rest[1]);
      if (typeof n === 'string') return n;
      out.n = n;
      return out;
    }
    case 'carry':
    case 'bring': {
      if (rest.length < 1 || rest.length > 2) return `«${code}» wants a good`;
      if (!GOODS[rest[0] as GoodId]) return `unknown good «${rest[0]}»`;
      out.good = rest[0] as GoodId;
      const n = num(rest[1]);
      if (typeof n === 'string') return n;
      out.n = n;
      return out;
    }
    case 'board':
    case 'lair':
    case 'chart':
    case 'dive':
    case 'catch':
    case 'rescue':
    case 'tribute':
    case 'escort':
    case 'build':
    case 'recruit':
    case 'contraband': {
      if (rest.length > 1) return `too many parts in «${code}»`;
      const n = num(rest[0]);
      if (typeof n === 'string') return n;
      out.n = n;
      return out;
    }
    default:
      return rest.length ? `«${k}» takes no parts` : out;
  }
}

/** How many quest steps a code makes (a `carry` is a pickup and a delivery). */
export const stepsOf = (s: StepSpec): number => (s.kind === 'carry' ? 2 : 1);

/** The count of a step by the ship level the quest is for (⚓1–10), when the chapter leaves it to the builder. */
export function defaultCount(kind: StepKind, band: number): number {
  const b = Math.max(1, Math.min(10, band)) - 1;
  switch (kind) {
    case 'board': return [1, 1, 2, 2, 2, 3, 3, 3, 4, 4][b];
    case 'sink': return [2, 2, 3, 3, 4, 4, 5, 5, 6, 6][b];
    case 'lair': return [1, 1, 1, 1, 2, 2, 2, 2, 2, 3][b];
    case 'beast': return [1, 1, 1, 1, 1, 2, 2, 2, 2, 2][b];
    case 'chart': return [2, 2, 3, 3, 3, 4, 4, 4, 5, 5][b];
    case 'dive': return [1, 1, 1, 1, 2, 2, 2, 2, 2, 3][b];
    case 'catch': return [3, 3, 4, 4, 5, 5, 6, 6, 6, 6][b];
    case 'rescue': return [2, 2, 2, 3, 3, 3, 4, 4, 4, 5][b];
    case 'tribute': return [1, 1, 1, 2, 2, 2, 2, 3, 3, 3][b];
    case 'carry':
    case 'bring': return [6, 8, 10, 10, 12, 12, 14, 14, 16, 16][b];
    case 'escort': return [2, 2, 3, 3, 3, 4, 4, 4, 5, 5][b];
    case 'build': return 1;
    case 'recruit': return [6, 8, 10, 12, 15, 18, 20, 25, 30, 35][b];
    case 'contraband': return [4, 4, 6, 6, 8, 8, 10, 10, 12, 12][b];
    default: return 1;
  }
}

/** The wordings of each step (a quest picks one by its id). {giver} is put in by the chapter, the rest by the world. */
export const STEP_WORDS: Record<string, T[]> = {
  hub: [
    ['Return to {hub}: {giver} is waiting.', 'Вернитесь в порт {hub}: вас ждёт {giver}.'],
    ['Bring the news to {giver} at {hub}.', 'Отвезите вести в порт {hub} — их ждёт {giver}.'],
    ['Report to {giver} at {hub}.', 'Явитесь в порт {hub}: {giver} ждёт доклада.'],
  ],
  at: [
    ['Sail to {at}.', 'Плывите в порт {at}.'],
    ['Put in at {at}.', 'Зайдите в порт {at}.'],
  ],
  hub_isle: [
    ['Return to the anchorage off {isle}: {giver} is waiting.', 'Вернитесь к стоянке у острова {isle}: вас ждёт {giver}.'],
    ['Bring the news to {giver}, whose ship rides at anchor off {isle}.', 'Отвезите вести: {giver} ждёт на якоре у острова {isle}.'],
  ],
  isle_coast: [
    ['Sail along the coast of {isle} to the marked cove.', 'Пройдите вдоль берега острова {isle} к отмеченной бухте.'],
    ['Round the point of {isle} and look.', 'Обогните мыс острова {isle} и осмотритесь.'],
  ],
  land_coast: [
    ['Put a party ashore on the spit of {isle}.', 'Высадите десант на косу острова {isle}.'],
    ['Land the boats on the far beach of {isle}.', 'Высадитесь на дальнем пляже острова {isle}.'],
  ],
  port: [
    ['Put in at {port}.', 'Зайдите в порт {port}.'],
    ['Make for {port} and ask along the quays.', 'Идите в порт {port} и расспросите на причалах.'],
    ['Sail to {port}: someone there knows more.', 'Плывите в порт {port}: там знают больше.'],
  ],
  port2: [
    ['Then put in at {port2}.', 'Затем зайдите в порт {port2}.'],
    ['Sail on to {port2}.', 'Плывите дальше, в порт {port2}.'],
    ['Make for {port2} and ask there.', 'Идите в порт {port2} и расспросите там.'],
  ],
  isle: [
    ['Sail into the waters of {isle}.', 'Подойдите к острову {isle}.'],
    ['Bring her close off {isle} and look.', 'Пройдите вдоль берега острова {isle} и осмотритесь.'],
    ['Find {isle} and see it with your own eyes.', 'Найдите остров {isle} и осмотрите его своими глазами.'],
  ],
  isle2: [
    ['Then sail into the waters of {isle2}.', 'Затем подойдите к острову {isle2}.'],
    ['Go on to {isle2} and look.', 'Идите дальше, к острову {isle2}, и осмотритесь.'],
  ],
  land: [
    ['Land a party on {isle}.', 'Высадите десант на остров {isle}.'],
    ['Put the boats ashore on {isle}.', 'Спустите шлюпки и высадитесь на остров {isle}.'],
    ['Send men ashore on {isle} and search it.', 'Высадитесь на острове {isle} и обыщите берег.'],
  ],
  land2: [
    ['Then land a party on {isle2}.', 'Затем высадите десант на остров {isle2}.'],
    ['Put the boats ashore on {isle2}.', 'Спустите шлюпки и высадитесь на остров {isle2}.'],
  ],
  land_site: [
    ['Land at the {site} on {isle}.', 'Высадитесь у места «{site}» на острове {isle}.'],
    ['Go ashore at the {site} of {isle}.', 'Сойдите на берег у места «{site}», остров {isle}.'],
  ],
  land2_site: [['Land at the {site} on {isle2}.', 'Высадитесь у места «{site}» на острове {isle2}.']],
  board: [
    ['Take ships by boarding: {n}.', 'Возьмите корабли на абордаж: {n}.'],
    ['Board and take ships: {n}.', 'Захватите корабли абордажем: {n}.'],
    ['Go over the rail and take ships: {n}.', 'Сойдитесь борт о борт и возьмите корабли: {n}.'],
  ],
  sink: [
    ['Sink ships: {n}.', 'Потопите корабли: {n}.'],
    ['Send ships to the bottom: {n}.', 'Отправьте корабли на дно: {n}.'],
  ],
  sink_pirate: [
    ['Sink pirate ships: {n}.', 'Потопите пиратские корабли: {n}.'],
    ['Send pirates to the bottom: {n}.', 'Отправьте пиратов на дно: {n}.'],
  ],
  sink_ghost: [['Send ghost ships back to the deep: {n}.', 'Верните на дно корабли-призраки: {n}.']],
  sink_patrol: [['Sink patrol ships: {n}.', 'Потопите патрульные корабли: {n}.']],
  sink_merchant: [['Sink merchant ships: {n}.', 'Потопите торговые корабли: {n}.']],
  sink_hunter: [['Sink the hunters on your trail: {n}.', 'Потопите охотников, что идут по вашему следу: {n}.']],
  lair: [
    ['Break the lairs of the land’s creatures: {n}.', 'Разорите логова тварей суши: {n}.'],
    ['Clear lairs of creatures: {n}.', 'Очистите логова тварей: {n}.'],
  ],
  beast_whale: [['Hunt whales: {n}.', 'Добудьте китов: {n}.']],
  beast_orca: [['Hunt orcas: {n}.', 'Добудьте косаток: {n}.']],
  beast_shark: [['Hunt sharks: {n}.', 'Добудьте акул: {n}.']],
  beast_any: [['Hunt the beasts of the sea: {n}.', 'Добудьте морских зверей: {n}.']],
  chart: [
    ['Chart islands you have never seen: {n}.', 'Нанесите на карту новые острова: {n}.'],
    ['Put new islands on the chart: {n}.', 'Отметьте на карте неизвестные острова: {n}.'],
  ],
  dive: [['Send divers down to wrecks: {n}.', 'Спустите водолазов к затонувшим кораблям: {n}.']],
  catch: [['Take fish: {n}.', 'Наловите рыбы: {n}.']],
  named: [['Sink a named pirate captain.', 'Потопите пиратского капитана из списка разыскиваемых.']],
  rescue: [['Save souls from the sea: {n}.', 'Спасите людей из моря: {n}.']],
  prize: [['Bring a prize to a prize court.', 'Приведите захваченный корабль в призовой суд.']],
  tribute: [['Take tribute from merchants: {n}.', 'Возьмите дань с купцов: {n}.']],
  carry_pick: [['Take on {good} × {n} at {port}.', 'Примите груз в порту {port}: {good} × {n}.']],
  carry_drop: [['Carry the cargo to {port2}.', 'Доставьте груз в порт {port2}.']],
  bring: [['Bring {good} × {n} to {hub}.', 'Привезите в порт {hub}: {good} × {n}.']],
  escort: [
    ['Hold the waters of {region} for {n} min.', 'Продержитесь в водах «{region}»: {n} мин.'],
    ['Keep watch at sea in {region} for {n} min.', 'Несите дозор в водах «{region}»: {n} мин.'],
  ],
  reach: [['Sail into {region}.', 'Войдите в воды «{region}».']],
  claim: [['Claim an island of your own.', 'Займите собственный остров.']],
  build: [['Lay works on your island: {n}.', 'Заложите постройки на своём острове: {n}.']],
  recruit: [['Sign on men for the ship’s army: {n}.', 'Наберите бойцов в армию корабля: {n}.']],
  customs: [['Pass a Crown inspection with contraband aboard.', 'Пройдите досмотр Короны с контрабандой в трюме.']],
  contraband: [['Sell contraband at a black market: {n}.', 'Продайте контрабанду на чёрном рынке: {n}.']],
};

/** The wordings a step takes. */
export function wordsOf(s: StepSpec, part: 'pick' | 'drop' = 'pick'): T[] {
  switch (s.kind) {
    case 'land':
    case 'land2':
      return STEP_WORDS[s.site ? `${s.kind}_site` : s.kind];
    case 'sink':
      return STEP_WORDS[s.role ? `sink_${s.role}` : 'sink'];
    case 'beast':
      return STEP_WORDS[`beast_${s.group ?? 'any'}`];
    case 'carry':
      return STEP_WORDS[part === 'pick' ? 'carry_pick' : 'carry_drop'];
    default:
      return STEP_WORDS[s.kind];
  }
}
