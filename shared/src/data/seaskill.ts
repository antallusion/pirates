// The captains' sea abilities and how they grow (docs/25 items 13–43; owner, 2026-10-09: «нужно еще у каждого капитана
// проверить личные способности, придумать логику развития их … с 1 по последний уровень будет супер работать»).
//
//  - Ranks (item 37): Z, X, C and the passive 1–5 at levels 1 / 12 / 24 / 36 / 48; the ultimate (V) 1–4 at 6 / 20 / 35 /
//    50 (it opens at 6, as it always did).
//  - Facets (item 38): at rank 3 and rank 5 of Z, X and C, and at rank 3 of V, one of two; kept on her sheet, chosen
//    free the first time, changed in a port for silver.
//  - Every number is a share (item 39): of her hull, of a broadside of her ⚓, of a crew; never a flat one. What she does
//    again and again in a fight (a ram, a leak, a mend) is reckoned in broadsides of her ⚓ — a fight at ⚓10 has twice
//    the broadsides of one at ⚓1 and room for twice the casts, so a share of her hull would grow with her ⚓; what she
//    does once a fight (an ultimate) in shares of the hull, which a fight of any length holds once.
//  - Talents (item 42): one node of her favoured trees for each ability, +power or +duration a rank.
//  - Mastery (item 43): past the cap the Throne's glory (docs/19 E1): +2% to her abilities' power a rank of glory, each
//    a little less, to +20%.
// The server's rules are server/src/game/abilities.ts and server/src/game/seaskill.ts; the numbers are held to the role
// (a kit used well takes 15–25% off a sea fight, the Corsair's to 30%; no captain 15% ahead of another) by
// tests/balance/captains-sea.test.ts and tools/balance-sea.ts --abilities.

import type { CaptainId } from './captains.ts';
import { gearDefCeil, gearOffCeil, seaBase } from './seabalance.ts';
import type { TalentRanks } from './talents.ts';

export type SkillKey = 'P' | 'Z' | 'X' | 'C' | 'V';
type T2 = [string, string];

/** The levels at which Z, X, C and the passive reach ranks 1–5, and the ultimate ranks 1–4. */
export const RANK_AT = [1, 12, 24, 36, 48];
export const ULT_RANK_AT = [6, 20, 35, 50];
export const MAX_RANK = 5;
export const ULT_MAX_RANK = 4;

const isUlt = (key: SkillKey) => key === 'V';

/** Her rank in an ability at her level (0: not yet — an ultimate below the 6th). */
export function skillRank(level: number, key: SkillKey): number {
  const at = isUlt(key) ? ULT_RANK_AT : RANK_AT;
  let r = 0;
  for (const l of at) if (level >= l) r++;
  return r;
}

/** The next rank and the level it comes at (null at the last). */
export function nextRank(level: number, key: SkillKey): { rank: number; level: number } | null {
  const at = isUlt(key) ? ULT_RANK_AT : RANK_AT;
  const r = skillRank(level, key);
  return r < at.length ? { rank: r + 1, level: at[r] } : null;
}

/** The ranks at which a facet is chosen. */
export function facetRanks(key: SkillKey): number[] {
  return key === 'P' ? [] : isUlt(key) ? [3] : [3, 5];
}

/** Mastery past the cap (docs/19 E1, item 43): +2% a rank of glory at first, each rank a little less, to +20%. */
export const MASTERY_CAP = 0.2;
export function skillMastery(glory: number): number {
  const g = Math.max(0, glory);
  return MASTERY_CAP * (1 - Math.exp(-g / 9.5));
}

/** A broadside of her ⚓ as a share of a hull: the table's broadside in full gear (§1.1: 1/5.1 at ⚓1, 1/13.6 at ⚓10). */
export function volleyShare(anchor: number): number {
  return gearOffCeil(anchor) / (seaBase(anchor) * gearDefCeil(anchor));
}

/** A plain ram at her class's top speed into an equal: this share of a hull at ⚓1, the same share of a broadside of her
 *  ⚓ higher (docs/25 item 22: «10% корпуса + скорость сближения, с поправкой на ступени»; Game.ts ram). */
export const RAM_SHARE = 0.05;

/** A burst of her guns (Last Volley, Storm Chaser) as a share of a fight (item 39): the reload cut that gives `q` of the
 *  table's broadsides more in `dur` seconds at her reload `reload` — a fight at any ⚓ is shortened alike. */
export function burstReload(q: number, dur: number, reload: number, anchor: number): number {
  const extra = q / volleyShare(anchor); // broadsides more
  const x = (extra * reload) / Math.max(1, dur);
  return Math.min(0.8, x / (1 + x));
}

export interface FacetDef {
  name: T2;
  text: T2;
  /** × the ability's numbers. */
  mul?: Record<string, number>;
  /** + the ability's numbers. */
  add?: Record<string, number>;
}

export type Fmt = 'pct' | 'sec' | 'x' | 'n' | 'vol' | 'm' | 'pcts';

export interface SeaSkill {
  id: string;
  captain: CaptainId;
  key: SkillKey;
  /** Her numbers by rank (index 0 = rank 1); a single number holds at every rank. */
  by: Record<string, number | number[]>;
  /** The numbers mastery and the talent's power raise. */
  pow: string[];
  /** How each number reads. */
  fmt: Record<string, Fmt>;
  /** What the rank does, in words, with the numbers in {braces}. */
  text: T2;
  facets?: { 3?: [FacetDef, FacetDef]; 5?: [FacetDef, FacetDef] };
  /** Her talent of a favoured tree that feeds it (item 42): +power or +duration a rank. */
  node?: { talent: string; kind: 'power' | 'dur'; per: number; /** the number a +duration node lengthens (default dur) */ key?: string };
  /** The combo it opens (item 41): the second ability within `win` seconds. */
  combo?: { then: string; win: number; name: T2; text: T2 };
}

const F = (en: string, ru: string, ten: string, tru: string, o: Omit<FacetDef, 'name' | 'text'> = {}): FacetDef => ({ name: [en, ru], text: [ten, tru], ...o });

/** The six captains' abilities at sea. */
export const SEA_SKILLS: Record<string, SeaSkill> = {
  // ------------------------------------------------------------------------------------------------ the Corsair
  broadside_discipline: {
    id: 'broadside_discipline', captain: 'corsair', key: 'P', by: { reload: 0.15, spread: 0.1 }, pow: [], fmt: { reload: 'pct', spread: 'pct' },
    text: ['A full broadside reloads {reload} faster and flies {spread} tighter.', 'Полный бортовой залп перезаряжается на {reload} быстрее и ложится на {spread} кучнее.'],
  },
  double_shot: {
    id: 'double_shot', captain: 'corsair', key: 'Z', by: { bonus: [0.12, 0.17, 0.22, 0.26, 0.3], win: 12 }, pow: ['bonus'], fmt: { bonus: 'pct', win: 'sec' },
    text: ['Your next broadside within {win}: two balls from every gun, +{bonus} damage.', 'Следующий залп в течение {win}: по два ядра из каждого орудия, +{bonus} урона.'],
    facets: {
      3: [F('Into the hull', 'В корпус', 'The double charge goes into her timbers: +20% to its bonus.', 'Двойной заряд — в борт: его прибавка +20%.', { mul: { bonus: 1.2 } }),
        F('Into the rigging', 'По парусам', 'The double charge goes high: her canvas takes three times as much, and she loses 20% way for 6 s.', 'Двойной заряд — по рангоуту: паруса получают втрое, и она теряет 20% хода на 6 с.', { add: { sails: 1 } })],
      5: [F('Two charges', 'Два заряда', 'Two broadsides are double-charged, each at 65% of the bonus.', 'Двойной заряд на двух залпах подряд, каждый — 65% прибавки.', { add: { twice: 1 }, mul: { bonus: 0.65 } }),
        F('Heated shot', 'Калёные ядра', 'The double broadside sets her afire.', 'Двойной залп поджигает её.', { add: { fire: 1 } })],
    },
    node: { talent: 'gun_double_charge', kind: 'power', per: 0.15 },
  },
  hard_over: {
    id: 'hard_over', captain: 'corsair', key: 'X', by: { turn: [0.8, 0.88, 0.95, 1.03, 1.1], rake: [0.1, 0.13, 0.16, 0.18, 0.2], win: 3, dur: 4, every: 45 }, pow: ['rake'], fmt: { turn: 'pct', rake: 'pct', win: 'sec', dur: 'sec', every: 'sec' },
    text: ['Helm hard over: turn +{turn} for {dur} (−10% way). The broadside fired in it or {win} after rakes her: +{rake} (a rake again after {every}).', 'Руль на борт: поворот +{turn} на {dur} (−10% хода). Залп в это время или {win} после — продольный: +{rake} (снова через {every}).'],
    facets: {
      3: [F('Keep her way', 'Без потери хода', 'No way lost in the turn, and it is 20% sharper.', 'Поворот без потери хода и на 20% круче.', { add: { keepWay: 1, turn: 0.2 } }),
        F('Evasion', 'Уклонение', 'For 1.5 s after the helm goes over half the balls aimed at her fly wide.', '1,5 с после перекладки половина ядер по ней летит мимо.', { add: { evade: 1 } })],
      5: [F('Long rake', 'Долгий продольный', 'The rake window is 3 s longer and takes two broadsides.', 'Окно продольного огня на 3 с дольше и берёт два залпа.', { add: { win: 3, twice: 1 } }),
        F('Point-blank', 'В упор', 'The raking broadside kills half as many men again.', 'Продольный залп убивает в полтора раза больше людей.', { add: { men: 0.5 } })],
    },
    node: { talent: 'nav_tacking_drill', kind: 'dur', per: 0.25, key: 'win' },
    combo: { then: 'double_shot', win: 4, name: ['Helm → broadside', 'Руль → залп'], text: ['A double charge in the raking broadside: +10% more.', 'Двойной заряд в продольном залпе: ещё +10%.'] },
  },
  spotters_eye: {
    id: 'spotters_eye', captain: 'corsair', key: 'C', by: { spread: [0.2, 0.24, 0.28, 0.31, 0.35], dmg: [0.03, 0.035, 0.04, 0.045, 0.05], range: 0.15, crit: [0.15, 0.2, 0.25, 0.3, 0.35], dur: 10 }, pow: ['dmg'], fmt: { spread: 'pct', dmg: 'pct', range: 'pct', crit: 'pct', dur: 'sec' },
    text: ['A spotter in the tops for {dur}: spread −{spread}, damage +{dmg}, range +{range}; each broadside has {crit} to wreck her rudder or a mast.', 'Наводчик на марсе на {dur}: разброс −{spread}, урон +{dmg}, дальность +{range}; каждый залп с шансом {crit} бьёт её руль или мачту.'],
    facets: {
      3: [F('The mast', 'По мачте', 'The spotter calls the masts: every critical brings a topmast down.', 'Наводчик бьёт по мачтам: каждый крит роняет стеньгу.', { add: { mast: 1 } }),
        F('The rudder', 'По рулю', 'The spotter calls the stern: every critical wrecks her rudder.', 'Наводчик бьёт в корму: каждый крит ломает руль.', { add: { rudder: 1 } })],
      5: [F('Spotter for all', 'Корректировщик', 'Her mark is ranged in for everyone (spread −15%) and takes 6% more from all.', 'Её цель пристреляна для всех (разброс −15%) и получает от всех на 6% больше.', { add: { all: 1 } }),
        F('Marksman', 'Снайпер', 'Range +15% more and the critical chance +10%.', 'Дальность ещё +15%, шанс крита +10%.', { add: { range: 0.15, crit: 0.1 } })],
    },
    node: { talent: 'gun_spotter', kind: 'dur', per: 0.3 },
  },
  last_volley: {
    id: 'last_volley', captain: 'corsair', key: 'V', by: { dur: [8, 9.5, 11, 12], q: [0.025, 0.03, 0.035, 0.04], dmg: 0.1 }, pow: ['q'], fmt: { dur: 'sec', q: 'pct', dmg: 'pct' },
    text: ['ULTIMATE. For {dur} the gun crews work like demons: as many broadsides more as {q} of a fight of her ⚓, damage +{dmg}. At rank 4 her broadsides ignore the alpha limit.', 'УЛЬТА. {dur} расчёты работают как черти: лишних залпов на {q} боя её ступени, урон +{dmg}. На 4-м ранге её залпы не упираются в предел.'],
    facets: {
      3: [F('Rapid fire', 'Беглый огонь', 'A quarter more broadsides.', 'Залпов на четверть больше.', { mul: { q: 1.25 } }),
        F('Last word', 'Последний довод', 'Damage twice as much more, a quarter fewer broadsides more.', 'Прибавка урона вдвое, лишних залпов на четверть меньше.', { mul: { dmg: 2, q: 0.75 } })],
    },
    node: { talent: 'gun_powder_mastery', kind: 'power', per: 0.1 },
  },
  // ------------------------------------------------------------------------------------------------ the Black Admiral
  chain_of_command: {
    id: 'chain_of_command', captain: 'admiral', key: 'P', by: { reload: [0.08, 0.1, 0.12, 0.135, 0.15] }, pow: ['reload'], fmt: { reload: 'pct' },
    text: ['Allied and escort ships within 500 m reload {reload} faster.', 'Союзники и эскорт в 500 м перезаряжаются на {reload} быстрее.'],
  },
  form_line: {
    id: 'form_line', captain: 'admiral', key: 'Z', by: { spread: [0.3, 0.33, 0.35, 0.38, 0.4], reload: [0.08, 0.085, 0.09, 0.095, 0.1], dur: 15 }, pow: ['reload'], fmt: { spread: 'pct', reload: 'pct', dur: 'sec' },
    text: ['Signal flags: she and allies within 500 m get spread −{spread} and reload −{reload} for {dur}.', 'Сигнальные флаги: ей и союзникам в 500 м разброс −{spread} и перезарядка −{reload} на {dur}.'],
    facets: {
      3: [F('Close order', 'Плотный строй', 'Spread −10% more and damage +5%.', 'Разброс ещё −10% и урон +5%.', { add: { spread: 0.1, dmg: 0.05 } }),
        F('Long signal', 'Долгий сигнал', 'The line holds 5 s longer.', 'Строй держится на 5 с дольше.', { add: { dur: 5 } })],
      5: [F('Chain of command', 'Цепь команды', 'In the line she and hers have her passive twice over.', 'В строю её пассивка действует вдвое — и на неё саму.', { add: { chain: 1 } }),
        F('Line of battle', 'Линия баталии', 'The reload part of it +25%.', 'Перезарядка строя +25%.', { mul: { reload: 1.25 } })],
    },
    node: { talent: 'cmd_line_of_battle', kind: 'power', per: 0.2 },
  },
  mark_target: {
    id: 'mark_target', captain: 'admiral', key: 'X', by: { mark: [0.07, 0.075, 0.08, 0.085, 0.09], dur: 15 }, pow: ['mark'], fmt: { mark: 'pct', dur: 'sec' },
    text: ['Mark the ship nearest the cursor: she takes +{mark} damage from everyone for {dur}. From rank 3 her weak side shows: everyone is ranged in on her.', 'Метка на ближнем к курсору корабле: {dur} она получает от всех +{mark} урона. С 3-го ранга виден её слабый борт: все пристреляны по ней.'],
    facets: {
      3: [F('Admiralty mark', 'Метка Адмиралтейства', 'The mark holds 5 s longer.', 'Метка держится на 5 с дольше.', { add: { dur: 5 } }),
        F('Weak side', 'Слабый борт', 'Every ball at her goes through 15% of her armour.', 'Каждое ядро по ней проходит 15% её брони.', { add: { pierce: 0.15 } })],
      5: [F('Two marks', 'Две метки', 'The two ships nearest the cursor are marked.', 'Метка ложится на два ближних корабля.', { add: { two: 1 } }),
        F('Sentence', 'Приговор', 'A quarter stronger, 5 s shorter.', 'На четверть сильнее, на 5 с короче.', { mul: { mark: 1.25 }, add: { dur: -5 } })],
    },
    node: { talent: 'cmd_concentrate_fire', kind: 'power', per: 0.2 },
    combo: { then: 'admiralty_barrage', win: 5, name: ['Mark → barrage', 'Метка → обстрел'], text: ['The barrage within 5 s of the mark homes on the marked ship: the shells fall within 60 m of her, 15% harder.', 'Обстрел в 5 с после метки ложится на помеченный корабль: снаряды в 60 м от неё, на 15% сильнее.'] },
  },
  call_escort: {
    id: 'call_escort', captain: 'admiral', key: 'C', by: { guns: [0.1, 0.1, 0.1, 0.1, 0.1], dur: 180 }, pow: ['guns'], fmt: { guns: 'pct', dur: 'sec' },
    text: ['Pay the hire: an escort a ⚓ below hers (a brig, a frigate, from the 50th a ship of the line; from the 60th two) joins her for {dur}, her guns at {guns} of a captain\'s of her ⚓.', 'Плата за найм: эскорт на ступень ниже её (бриг, фрегат, с 50-го линейный; с 60-го — двое) идёт с ней {dur}, его пушки — {guns} от капитанских её ступени.'],
    facets: {
      3: [F('Heavy escort', 'Тяжёлый эскорт', 'Her hull ×1.5.', 'Корпус эскорта ×1,5.', { add: { heavy: 1 } }),
        F('Swift escort', 'Быстрый эскорт', 'A minute longer at sea, a minute sooner again.', 'На минуту дольше в море и на минуту раньше снова.', { add: { dur: 60, cdDelta: -60 } })],
      5: [F('Squadron', 'Эскадра', 'A second escort sails with the first.', 'С первым идёт второй эскорт.', { add: { two: 1 } }),
        F('Flagship\'s fire', 'Огонь флагмана', 'Her guns ×1.3.', 'Пушки эскорта ×1,3.', { mul: { guns: 1.3 } })],
    },
    node: { talent: 'cmd_escort_captain', kind: 'dur', per: 0.25 },
  },
  admiralty_barrage: {
    id: 'admiralty_barrage', captain: 'admiral', key: 'V', by: { shells: [12, 14, 16, 18], shell: 0.008, radius: 90 }, pow: ['shell'], fmt: { shells: 'n', shell: 'pct', radius: 'm' },
    text: ['ULTIMATE. After 3 s, {shells} mortar shells fall within {radius} of the point, each {shell} of the hull it strikes.', 'УЛЬТА. Через 3 с в {radius} от точки падают {shells} мортирных снарядов, каждый — {shell} корпуса, в который попал.'],
    facets: {
      3: [F('Ranged in', 'Пристрелка', 'The shells fall within 60 m.', 'Снаряды ложатся в 60 м.', { add: { radius: -30 } }),
        F('Incendiary', 'Зажигательные', 'Each shell that strikes has 15% to set her afire.', 'Каждый попавший снаряд поджигает с шансом 15%.', { add: { fire: 0.15 } })],
    },
    node: { talent: 'gun_mortar_lore', kind: 'power', per: 0.15 },
  },
  // ------------------------------------------------------------------------------------------------ the Reaver
  blood_in_the_water: {
    id: 'blood_in_the_water', captain: 'reaver', key: 'P', by: { board: 0.2 }, pow: [], fmt: { board: 'pct' },
    text: ['Against crews below 50%: +{board} boarding power. Kills during a boarding raise his morale.', 'Против команд ниже 50%: +{board} к силе абордажа. Убитые в абордаже поднимают его дух.'],
  },
  grapeshot_frenzy: {
    id: 'grapeshot_frenzy', captain: 'reaver', key: 'Z', by: { crew: [0.3, 0.38, 0.46, 0.53, 0.6], army: [0.05, 0.07, 0.08, 0.1, 0.12], dur: 10 }, pow: ['crew', 'army'], fmt: { crew: 'pct', army: 'pct', dur: 'sec' },
    text: ['For {dur} grapeshot reloads twice as fast and kills {crew} more men; the first grape broadside that lands takes {army} of her boarding army besides.', '{dur} картечь заряжается вдвое быстрее и косит на {crew} больше; первый лёгший картечный залп вдобавок снимает {army} её абордажной армии.'],
    facets: {
      3: [F('Bloody grape', 'Кровавая картечь', 'Men killed +25% more.', 'Убитых ещё на 25% больше.', { mul: { crew: 1.25 } }),
        F('Ragged canvas', 'Рваные паруса', 'The frenzied grape tears her canvas twice as hard.', 'Неистовая картечь рвёт паруса вдвое сильнее.', { add: { sails: 1 } })],
      5: [F('Slaughter', 'Резня', 'Her army −50% more from the first broadside.', 'Первый залп снимает на 50% больше её армии.', { mul: { army: 1.5 } }),
        F('Volley of dread', 'Залп ужаса', 'Each frenzied grape broadside costs her 8 morale.', 'Каждый неистовый залп картечью — −8 её духа.', { add: { morale: 8 } })],
    },
    node: { talent: 'brd_pistol_volley', kind: 'power', per: 0.2 },
  },
  ramming_speed: {
    id: 'ramming_speed', captain: 'reaver', key: 'X', by: { ram: [3, 3.3, 3.5, 3.75, 4], speed: 0.35, dur: 5 }, pow: ['ram'], fmt: { ram: 'x', speed: 'pct', dur: 'sec' },
    text: ['Every hand to the braces: +{speed} speed and double acceleration for {dur}; a ram strikes ×{ram} (a plain ram at full way: 10% of a hull at ⚓1, the same share of a broadside of her ⚓ higher).', 'Все на брасы: +{speed} хода и двойной разгон на {dur}; таран бьёт ×{ram} (простой таран на полном ходу — 10% корпуса на ⚓1, выше — та же доля залпа её ступени).'],
    facets: {
      3: [F('Iron bow', 'Окованный нос', 'He takes half the ram\'s blow back.', 'Отдача тарана ему — вдвое меньше.', { add: { bow: 1 } }),
        F('Boarding ram', 'Абордажный таран', 'The ram is a grapple: the boarding begins at once.', 'Таран — это абордаж: сцепка сразу.', { add: { grapple: 1 } })],
      5: [F('Holed', 'Пробоина', 'The ram opens two leaks in her.', 'Таран открывает ей две течи.', { add: { leaks: 2 } }),
        F('Shock', 'Удар', 'The ram costs her 15 morale and 3% of her men.', 'Таран стоит ей 15 духа и 3% людей.', { add: { shock: 1 } })],
    },
    node: { talent: 'brd_match_speed', kind: 'power', per: 0.12 },
  },
  war_cry: {
    id: 'war_cry', captain: 'reaver', key: 'C', by: { morale: [15, 17, 19, 22, 25], slow: [0.12, 0.15, 0.18, 0.21, 0.25], dur: [8, 9, 10, 11, 12], r: 300 }, pow: ['slow'], fmt: { morale: 'n', slow: 'pct', dur: 'sec', r: 'm' },
    text: ['His crew roars: +20 morale. Enemy crews within {r} lose {morale} morale and, shaken, reload {slow} slower for {dur} (twice that while their morale is below 30).', 'Команда ревёт: +20 духа. Враги в {r} теряют {morale} духа и, дрогнув, заряжают на {slow} медленнее {dur} (вдвое — пока их дух ниже 30).'],
    facets: {
      3: [F('Roar', 'Рёв', 'Heard within 450 m.', 'Слышно в 450 м.', { add: { r: 150 } }),
        F('Heart', 'Кураж', 'His own guns reload 10% faster for 6 s.', 'Его пушки 6 с заряжаются на 10% быстрее.', { add: { heart: 1 } })],
      5: [F('Break them', 'Сломить дух', 'Morale lost ×1.5.', 'Потеря духа ×1,5.', { mul: { morale: 1.5 } }),
        F('Long dread', 'Долгий страх', 'Shaken half as long again.', 'Дрожат в полтора раза дольше.', { mul: { dur: 1.5 } })],
    },
    node: { talent: 'brd_terror', kind: 'power', per: 0.2 },
    combo: { then: 'ramming_speed', win: 5, name: ['Cry → ram', 'Клич → таран'], text: ['A ram within 5 s of the cry strikes +25% and takes 3% of her men.', 'Таран в 5 с после клича: +25% и 3% её людей.'] },
  },
  red_hook_boarding: {
    id: 'red_hook_boarding', captain: 'reaver', key: 'V', by: { power: [0.3, 0.35, 0.4, 0.45], range: [1, 1.1, 1.2, 1.3], army: [0, 0, 0.1, 0.15], dur: 10 }, pow: ['power', 'army'], fmt: { power: 'pct', range: 'pct', army: 'pct', dur: 'sec' },
    text: ['ULTIMATE. For {dur} he may board from +{range} range whatever the speed or damage, with +{power} power; from rank 3 the hooks take {army} of her army before the fight on the hexes.', 'УЛЬТА. {dur} абордаж с дистанции +{range}, при любой скорости и повреждениях, сила +{power}; с 3-го ранга крюки снимают {army} её армии до боя на гексах.'],
    facets: {
      3: [F('Hook in the throat', 'Крюк в горло', 'The hooks take 5% more of her army.', 'Крюки снимают ещё 5% её армии.', { add: { army: 0.05 } }),
        F('Long hooks', 'Длинные крюки', 'Range +50% more.', 'Дистанция ещё +50%.', { add: { range: 0.5 } })],
    },
    node: { talent: 'brd_grapples', kind: 'power', per: 0.1 },
  },
  // ------------------------------------------------------------------------------------------------ the Smuggler
  false_bottom: {
    id: 'false_bottom', captain: 'smuggler', key: 'P', by: { hold: 0.3 }, pow: [], fmt: { hold: 'pct' },
    text: ['Contraband takes {hold} less hold and is never found by patrol inspections. −10% detection signature.', 'Контрабанда занимает на {hold} меньше места и не находится при досмотре. −10% к заметности.'],
  },
  smoke_pots: {
    id: 'smoke_pots', captain: 'smuggler', key: 'Z', by: { cut: [0.4, 0.405, 0.41, 0.415, 0.42], dur: [8, 8.4, 8.8, 9.2, 9.6] }, pow: ['cut'], fmt: { cut: 'pct', dur: 'sec' },
    text: ['Tar pots over the side: a smoke bank for {dur}. Incoming fire −{cut}, NPCs lose their lock; her first broadside out of it is an ambush.', 'Смоляные горшки за борт: дымовая завеса на {dur}. Входящий огонь −{cut}, НПС теряют цель; её первый залп из дыма — засада.'],
    facets: {
      3: [F('Fire from the smoke', 'Стрелять из дыма', 'Firing does not unmask her: the smoke still hides her.', 'Выстрел её не раскрывает: дым по-прежнему скрывает.', { add: { keep: 1 } }),
        F('Acrid smoke', 'Едкий дым', 'Enemies within 150 m aim 30% worse while it lasts.', 'Враги в 150 м целятся на 30% хуже, пока он стоит.', { add: { acrid: 0.3 } })],
      5: [F('Thick smoke', 'Густой дым', 'The bank stands 3 s longer.', 'Завеса стоит на 3 с дольше.', { add: { dur: 3 } }),
        F('Cover the convoy', 'Прикрыть своих', 'Allies within 150 m take 20% less too.', 'Союзники в 150 м тоже получают на 20% меньше.', { add: { allies: 0.2 } })],
    },
    node: { talent: 'smg_slip_away', kind: 'dur', per: 0.25 },
  },
  dark_running: {
    id: 'dark_running', captain: 'smuggler', key: 'X', by: { ambush: [0.55, 0.57, 0.6, 0.61, 0.62], seen: 0.4, every: 50, dur: 60 }, pow: ['ambush'], fmt: { ambush: 'pct', seen: 'pct', every: 'sec', dur: 'sec' },
    text: ['All lanterns out for {dur}: NPCs notice her at {seen} of the usual distance, −10% speed. Ambush: her first broadside out of the dark or the smoke +{ambush}, and a critical — her rudder or her powder (again after {every}).', 'Фонари погашены на {dur}: НПС замечают её на {seen} дистанции, −10% хода. Засада: первый залп из тьмы или дыма +{ambush} и крит — по рулю или по пороху (снова через {every}).'],
    facets: {
      3: [F('Black lanterns', 'Чёрные фонари', 'Seen at a quarter of the distance.', 'Видна лишь с четверти дистанции.', { add: { seen: -0.15 } }),
        F('Silent running', 'Тихий ход', 'No speed lost.', 'Без потери хода.', { add: { silent: 1 } })],
      5: [F('Knife in the ribs', 'Нож под ребро', 'The ambush +15% more, and the critical is always the powder.', 'Засада ещё +15%, крит — всегда по пороху.', { mul: { ambush: 1.15 }, add: { powder: 1 } }),
        F('Back into the dark', 'Снова в тень', 'The ambush comes again after 20 s.', 'Засада снова через 20 с.', { add: { every: -10 } })],
    },
    node: { talent: 'smg_dark_lanterns', kind: 'power', per: 0.2 },
    combo: { then: 'ambush', win: 5, name: ['Dark → ambush', 'Тьма → засада'], text: ['An ambush within 5 s of lighting out: +10% more and the critical is certain.', 'Засада в 5 с после «Тьмы»: ещё +10%, крит наверняка.'] },
  },
  bribe_signal: {
    id: 'bribe_signal', captain: 'smuggler', key: 'C', by: { dur: [60, 75, 90, 105, 120] }, pow: [], fmt: { dur: 'sec' },
    text: ['Hoist the right flag and pay (the price grows with her level): Crown and League patrols ignore her for {dur}; from rank 3 the pirates of the sea too.', 'Нужный флаг и плата (цена растёт с уровнем): патрули Короны и Лиги не замечают её {dur}; с 3-го ранга — и пираты моря.'],
    facets: {
      3: [F('Cheap', 'Сходная цена', 'The bribe costs 40% less.', 'Взятка на 40% дешевле.', { add: { cheap: 0.4 } }),
        F('Long bribe', 'Долгая взятка', 'Half as long again.', 'В полтора раза дольше.', { mul: { dur: 1.5 } })],
      5: [F('Hunters too', 'И охотники', 'The sea\'s hunters look away too.', 'Охотники моря тоже отворачиваются.', { add: { hunters: 1 } }),
        F('Credit', 'В долг', 'Ready again 30 s sooner.', 'Снова готов на 30 с раньше.', { add: { cdDelta: -30 } })],
    },
    node: { talent: 'smg_greased_palms', kind: 'dur', per: 0.2 },
  },
  vanish_into_fog: {
    id: 'vanish_into_fog', captain: 'smuggler', key: 'V', by: { knife: [0.15, 0.2, 0.25, 0.3], pierce: [0.3, 0.4, 0.5, 0.6], knives: 2, speed: 0.25, dur: 20 }, pow: ['knife'], fmt: { knife: 'pct', pierce: 'pct', knives: 'n', speed: 'pct', dur: 'sec' },
    text: ['ULTIMATE. A fog bank swallows her: invisible beyond 250 m, +{speed} speed for {dur}. Knife in the fog: her next {knives} broadsides go through {pierce} of armour, +{knife}.', 'УЛЬТА. Туман поглощает корабль: невидима дальше 250 м, +{speed} хода на {dur}. Нож в тумане: следующие {knives} залпа проходят {pierce} брони, +{knife}.'],
    facets: {
      3: [F('Thick fog', 'Густой туман', '5 s longer, +10% speed.', 'На 5 с дольше, ещё +10% хода.', { add: { dur: 5, speed: 0.1 } }),
        F('Three knives', 'Три ножа', 'Three broadsides of the knife.', 'Три залпа ножа.', { add: { knives: 1 } })],
    },
    node: { talent: 'smg_ghost_wake', kind: 'dur', per: 0.15 },
  },
  // ------------------------------------------------------------------------------------------------ the Navigator
  reading_the_wind: {
    id: 'reading_the_wind', captain: 'navigator', key: 'P', by: { wind: [0.07, 0.075, 0.08, 0.09, 0.1] }, pow: ['wind'], fmt: { wind: 'pct' },
    text: ['Sees wind forecasts and currents; no-go zone −8°, currents +25%. The weather gauge: upwind of her mark, damage and range +{wind}.', 'Видит прогноз ветра и течения; мёртвая зона −8°, течения +25%. Наветренная позиция: с наветра от цели урон и дальность +{wind}.'],
  },
  trim_sails: {
    id: 'trim_sails', captain: 'navigator', key: 'Z', by: { speed: [0.2, 0.23, 0.25, 0.28, 0.3], dur: 12 }, pow: ['speed'], fmt: { speed: 'pct', dur: 'sec' },
    text: ['Perfect trim for {dur}: +{speed} speed.', 'Идеальная настройка парусов на {dur}: +{speed} хода.'],
    facets: {
      3: [F('Flying jib', 'Бом-кливер', 'Acceleration +30%.', 'Разгон +30%.', { add: { accel: 0.3 } }),
        F('Long trim', 'Долгая настройка', '6 s longer.', 'На 6 с дольше.', { add: { dur: 6 } })],
      5: [F('Race', 'Гонка', 'Speed +5% more.', 'Ещё +5% хода.', { add: { speed: 0.05 } }),
        F('Intercept', 'Перехват', 'Turn +20% too.', 'И поворот +20%.', { add: { turn: 0.2 } })],
    },
    node: { talent: 'nav_quick_trim', kind: 'power', per: 0.12 },
  },
  current_rider: {
    id: 'current_rider', captain: 'navigator', key: 'X', by: { slow: [0.1, 0.125, 0.15, 0.175, 0.2], turn: [0.15, 0.18, 0.2, 0.23, 0.25], r: 300, dur: 20 }, pow: ['slow', 'turn'], fmt: { slow: 'pct', turn: 'pct', r: 'm', dur: 'sec' },
    text: ['Ride the stream for {dur}: currents push her 150% harder, turn +20%; enemies within {r} fight her current — way −{slow}, turn −{turn} — and give her their side.', 'Встать на струю на {dur}: течения несут на 150% сильнее, поворот +20%; враги в {r} идут против её течения — ход −{slow}, поворот −{turn} — и сами подставляют борт.'],
    facets: {
      3: [F('Race of the tide', 'Стремнина', 'Felt within 450 m.', 'Действует в 450 м.', { add: { r: 150 } }),
        F('Head sea', 'Встречная волна', 'Their turn lost ×1.5.', 'Потеря поворота ×1,5.', { mul: { turn: 1.5 } })],
      5: [F('Show me your side', 'Подставь борт', 'Her broadsides on them +8%.', 'Её залпы по ним +8%.', { add: { side: 0.08 } }),
        F('Her own stream', 'Своя струя', 'Her own speed +15%.', 'Её ход +15%.', { add: { own: 0.15 } })],
    },
    node: { talent: 'nav_current_reader', kind: 'dur', per: 0.3 },
  },
  star_fix: {
    id: 'star_fix', captain: 'navigator', key: 'C', by: { rake: [0.1, 0.12, 0.14, 0.16, 0.18], dur: 20 }, pow: ['rake'], fmt: { rake: 'pct', dur: 'sec' },
    text: ['A star fix: every island within 7 km charted, and for {dur} the weak angles of enemies within 1.5 km shown — her broadsides on them rake, +{rake}.', 'Звёздный отсчёт: все острова в 7 км на карте, и {dur} видны слабые углы врагов в 1,5 км — её залпы по ним продольные, +{rake}.'],
    facets: {
      3: [F('Star chart', 'Звёздная карта', '6 s longer.', 'На 6 с дольше.', { add: { dur: 6 } }),
        F('Exact fix', 'Точный отсчёт', '+8% more and range +10%.', 'Ещё +8% и дальность +10%.', { add: { rake: 0.08, range: 0.1 } })],
      5: [F('For all', 'Для всех', 'Allies within 500 m see the angles too.', 'Союзники в 500 м тоже видят углы.', { add: { all: 1 } }),
        F('Weak spot', 'Слабое место', 'The rake ×1.2, and the combo\'s critical is certain.', 'Продольный ×1,2, крит связки наверняка.', { mul: { rake: 1.2 }, add: { sure: 1 } })],
    },
    node: { talent: 'exp_star_reader', kind: 'dur', per: 0.3 },
    combo: { then: 'broadside', win: 5, name: ['Fix → rake', 'Отсчёт → продольный'], text: ['The first broadside within 5 s of the fix is a true rake: +10% more and a critical on her stern.', 'Первый залп в 5 с после отсчёта — настоящий продольный: ещё +10% и крит в корму.'] },
  },
  storm_chaser: {
    id: 'storm_chaser', captain: 'navigator', key: 'V', by: { speed: 0.3, q: [0.04, 0.045, 0.05, 0.055], dur: 20 }, pow: ['q'], fmt: { speed: 'pct', q: 'pct', dur: 'sec' },
    text: ['ULTIMATE. The wind follows her: for {dur} she always sails at the best angle, +{speed} speed, and her guns load faster on the best course — as many broadsides more as {q} of a fight of her ⚓. At rank 4 allies within 500 m sail her wind.', 'УЛЬТА. Ветер следует за ней: {dur} всегда лучший курс, +{speed} хода, и на лучшем курсе пушки заряжаются быстрее — лишних залпов на {q} боя её ступени. На 4-м ранге союзники в 500 м идут её ветром.'],
    facets: {
      3: [F('Eye of the storm', 'Око бури', '5 s longer.', 'На 5 с дольше.', { add: { dur: 5 } }),
        F('Squall', 'Шквал', 'Damage +10% while it blows.', 'Урон +10%, пока дует.', { add: { dmg: 0.1 } })],
    },
    node: { talent: 'exp_eye_of_the_storm', kind: 'power', per: 0.1 },
  },
  // ------------------------------------------------------------------------------------------------ the Drowned
  drowned_once: {
    id: 'drowned_once', captain: 'drowned', key: 'P', by: { shake: [0.03, 0.035, 0.04, 0.045, 0.05], wake: 30 }, pow: ['shake'], fmt: { shake: 'pct', wake: 'n' },
    text: ['Once per 5 min, lethal damage leaves her between water and light for 12 s (−50% incoming); mend to 10% or sink. She enters every fight with {wake} Dread. Dread as a weapon: every 25 Dread costs enemies within 400 m 5 morale each 15 s, and below 30 morale they reload {shake} slower.', 'Раз в 5 мин смертельный урон оставляет её между водой и светом на 12 с (−50% входящего); залатать до 10% — или ко дну. В каждый бой она входит с {wake} Ужаса. Ужас как оружие: каждые 25 Ужаса снимают врагам в 400 м 5 духа раз в 15 с, а ниже 30 духа они заряжают на {shake} медленнее.'],
  },
  deep_call: {
    id: 'deep_call', captain: 'drowned', key: 'Z', by: { leak: [0.6, 0.65, 0.7, 0.75, 0.8], r: 60, dur: 6, dread: 30 }, pow: ['leak'], fmt: { leak: 'vol', r: 'm', dur: 'sec', dread: 'n' },
    text: ['{dread} Dread. Drowned hands rise at the point ({r}) for {dur}: −40% speed and −30% turn inside, and every ship caught leaks {leak} over those seconds.', '{dread} Ужаса. Руки утопленников в точке ({r}) на {dur}: внутри −40% хода и −30% поворота, и каждый пойманный корабль течёт на {leak} за эти секунды.'],
    facets: {
      3: [F('Grasping', 'Цепкие руки', 'The hands reach 90 m.', 'Руки тянутся на 90 м.', { add: { r: 30 } }),
        F('From the deep', 'Из глубины', 'The leak ×1.25, the hands in 45 m.', 'Течь ×1,25, руки в 45 м.', { mul: { leak: 1.25 }, add: { r: -15 } })],
      5: [F('Long hold', 'Долгая хватка', 'The hands hold 3 s longer (the leak with them).', 'Руки держат на 3 с дольше (и течь с ними).', { add: { dur: 3 }, mul: { leak: 1.25 } }),
        F('Cheap call', 'Дешёвый зов', '20 Dread instead of 30.', '20 Ужаса вместо 30.', { add: { dread: -10 } })],
    },
    node: { talent: 'abs_grasp_of_the_deep', kind: 'power', per: 0.2 },
    combo: { then: 'maw_of_the_deep', win: 6, name: ['Call → maw', 'Зов → пасть'], text: ['A maw opened on a ship the hands hold: +25%.', 'Пасть на корабле в руках утопленников: +25%.'] },
  },
  brine_mend: {
    id: 'brine_mend', captain: 'drowned', key: 'X', by: { heal: [0.55, 0.56, 0.57, 0.58, 0.6], dur: 8, dread: 25 }, pow: ['heal'], fmt: { heal: 'vol', dur: 'sec', dread: 'n' },
    text: ['{dread} Dread. The sea knits her planks: {heal} back over {dur}, a leak sealed, the rudder mended. Crew morale −6, and 2% of the crew go into the water.', '{dread} Ужаса. Море сращивает доски: {heal} за {dur}, течь заделана, руль исправлен. Дух −6, и 2% команды уходит в воду.'],
    facets: {
      3: [F('Deep mend', 'Глубокая штопка', 'Two leaks sealed.', 'Заделаны две течи.', { add: { leaks: 1 } }),
        F('No toll', 'Без платы', 'No man goes into the water; morale −3 only.', 'Никто не уходит в воду; дух лишь −3.', { add: { free: 1 } })],
      5: [F('Long mend', 'Долгая штопка', 'Over 12 s, a fifth more.', 'За 12 с, на пятую часть больше.', { add: { dur: 4 }, mul: { heal: 1.2 } }),
        F('Swift mend', 'Быстрая штопка', 'Ready again 15 s sooner.', 'Снова готова на 15 с раньше.', { add: { cdDelta: -15 } })],
    },
    node: { talent: 'srv_carpenters', kind: 'power', per: 0.08 },
  },
  undertow: {
    id: 'undertow', captain: 'drowned', key: 'C', by: { pull: [1, 1.1, 1.2, 1.3, 1.4], dur: 10, dread: 35 }, pow: ['pull'], fmt: { pull: 'x', dur: 'sec', dread: 'n' },
    text: ['{dread} Dread. A 400 × 60 m race of current from her toward the point for {dur}, ×{pull}: ships with it gain way, against it lose it, a ship with no way on is dragged along.', '{dread} Ужаса. Стремнина 400 × 60 м от неё к точке на {dur}, ×{pull}: по течению — быстрее, против — медленнее, судно без хода тащит.'],
    facets: {
      3: [F('Wide race', 'Широкая стремнина', '100 m wide.', 'Шириной 100 м.', { add: { wide: 1 } }),
        F('Long race', 'Долгая стремнина', '5 s longer.', 'На 5 с дольше.', { add: { dur: 5 } })],
      5: [F('Rip', 'Разрыв', 'Ships against it lose 20% turn too.', 'Идущие против теряют и 20% поворота.', { add: { rip: 0.2 } }),
        F('Ride it', 'Оседлать', 'She gains 20% way in it.', 'Ей в ней +20% хода.', { add: { ride: 0.2 } })],
    },
    node: { talent: 'abs_black_water', kind: 'dur', per: 0.3 },
  },
  maw_of_the_deep: {
    id: 'maw_of_the_deep', captain: 'drowned', key: 'V', by: { hull: 0.2, cd: [300, 270, 240, 210], r: 45, dread: 50 }, pow: ['hull'], fmt: { hull: 'pct', cd: 'sec', r: 'm', dread: 'n' },
    text: ['ULTIMATE (100 resolve + {dread} Dread). The water boils for 3 s, then a maw {r} wide opens: {hull} of each ship\'s hull (through armour; a boss to 150 × her level), a mast and two leaks; ships within 90 m are dragged in. Again after {cd}.', 'УЛЬТА (100 решимости + {dread} Ужаса). Вода кипит 3 с, затем пасть шириной {r}: {hull} корпуса каждого корабля (сквозь броню; боссу — до 150 × её уровень), мачта и две течи; корабли в 90 м затягивает. Снова через {cd}.'],
    facets: {
      3: [F('Hungry maw', 'Голодная пасть', '+20% to its bite.', 'Укус +20%.', { mul: { hull: 1.2 } }),
        F('Wide maw', 'Широкая пасть', '65 m wide.', 'Шириной 65 м.', { add: { r: 20 } })],
    },
    node: { talent: 'abs_mark_of_the_drowned_king', kind: 'power', per: 0.15 },
  },
};

/** Her four abilities and her passive, in the bar's order. */
export function captainSkills(captain: CaptainId): SeaSkill[] {
  const order: SkillKey[] = ['P', 'Z', 'X', 'C', 'V'];
  return Object.values(SEA_SKILLS).filter((s) => s.captain === captain).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** The talent each ability feeds on, by talent (item 42). */
export const SKILL_NODES: Record<string, { skill: string; kind: 'power' | 'dur'; per: number }> = Object.fromEntries(
  Object.values(SEA_SKILLS).filter((s) => s.node).map((s) => [s.node!.talent, { skill: s.id, kind: s.node!.kind, per: s.node!.per }]),
);

export type FacetPick = 'a' | 'b';
export type Facets = Record<string, FacetPick>;
/** The key of a facet on her sheet: «ability@rank». */
export const facetKey = (id: string, rank: number): string => `${id}@${rank}`;

export interface SkillCtx {
  level: number;
  facets: Facets;
  glory: number;
  talents: TalentRanks;
}

export interface SkillNums {
  rank: number;
  n: Record<string, number>;
  /** The facets she has chosen of those open to her. */
  picks: Record<number, FacetPick>;
  /** The power her mastery and her talent give (×). */
  power: number;
}

const at = (v: number | number[], rank: number) => (Array.isArray(v) ? v[Math.max(0, Math.min(v.length - 1, rank - 1))] : v);

/** Her numbers in an ability at her rank, with her facets, her talent and her mastery. `rank` overrides her level's. */
export function skillNums(id: string, ctx: SkillCtx, rank?: number): SkillNums {
  const s = SEA_SKILLS[id];
  const r = rank ?? skillRank(ctx.level, s.key);
  const n: Record<string, number> = {};
  for (const k in s.by) n[k] = at(s.by[k], Math.max(1, r));
  const node = s.node ? (ctx.talents[s.node.talent] ?? 0) : 0;
  const power = (1 + skillMastery(ctx.glory)) * (1 + (s.node?.kind === 'power' ? s.node.per * node : 0));
  for (const k of s.pow) if (k in n) n[k] *= power;
  if (s.node?.kind === 'dur' && node > 0) {
    const k = s.node.key ?? ('dur' in n ? 'dur' : null);
    if (k) n[k] *= 1 + s.node.per * node;
  }
  const picks: Record<number, FacetPick> = {};
  for (const fr of facetRanks(s.key)) {
    if (r < fr) continue;
    const pick = ctx.facets[facetKey(id, fr)];
    const f = pick && s.facets?.[fr as 3 | 5]?.[pick === 'a' ? 0 : 1];
    if (!f) continue;
    picks[fr] = pick;
    for (const k in f.mul ?? {}) n[k] = (n[k] ?? 0) * f.mul![k];
    for (const k in f.add ?? {}) n[k] = (n[k] ?? 0) + f.add![k];
  }
  return { rank: r, n, picks, power };
}

// ------------------------------------------------------------------------------------------------ the words

/** A number as her sheet reads it. */
export function fmtNum(v: number, f: Fmt, ru: boolean, anchor = 1): string {
  const dec = (x: number, d = 0) => {
    const s = x.toFixed(d).replace(/\.0+$/, '');
    return ru ? s.replace('.', ',') : s;
  };
  switch (f) {
    case 'pct': return `${dec(v * 100, Math.abs(v * 100 - Math.round(v * 100)) > 0.05 ? 1 : 0)}%`;
    case 'pcts': return `${dec(v * 100, 1)}%`;
    case 'sec': return ru ? `${dec(v, v % 1 ? 1 : 0)} с` : `${dec(v, v % 1 ? 1 : 0)} s`;
    case 'x': return dec(v, 2);
    case 'n': return dec(v);
    case 'm': return ru ? `${dec(v)} м` : `${dec(v)} m`;
    case 'vol': {
      // A share of a broadside of her ⚓, and what it comes to of her hull.
      const hull = v * volleyShare(anchor) * 100;
      return ru ? `${dec(v, 2)} залпа (${dec(hull, 1)}% корпуса)` : `${dec(v, 2)} broadside (${dec(hull, 1)}% of a hull)`;
    }
  }
}

/** What an ability does at her numbers, in her language. */
export function skillText(id: string, nums: SkillNums, ru: boolean, anchor = 1): string {
  const s = SEA_SKILLS[id];
  return s.text[ru ? 1 : 0].replace(/\{(\w+)\}/g, (m, k: string) => (k in nums.n ? fmtNum(nums.n[k], s.fmt[k] ?? 'n', ru, anchor) : m));
}

/** What the next rank changes: the numbers that grow, as «name: was → will be». */
export function rankGain(id: string, ctx: SkillCtx, ru: boolean, anchor = 1): { level: number; rank: number; lines: string[] } | null {
  const s = SEA_SKILLS[id];
  const nx = nextRank(ctx.level, s.key);
  if (!nx) return null;
  const now = skillNums(id, ctx), next = skillNums(id, ctx, nx.rank);
  const lines: string[] = [];
  for (const k in next.n) {
    if (Math.abs((next.n[k] ?? 0) - (now.n[k] ?? 0)) < 1e-9) continue;
    if (now.rank === 0) lines.push(fmtNum(next.n[k], s.fmt[k] ?? 'n', ru, anchor));
    else lines.push(`${fmtNum(now.n[k], s.fmt[k] ?? 'n', ru, anchor)} → ${fmtNum(next.n[k], s.fmt[k] ?? 'n', ru, anchor)}`);
  }
  return { level: nx.level, rank: nx.rank, lines };
}

/** Silver to change a facet chosen before (in a port): her level's worth. */
export function facetCost(level: number): number {
  return 50 * Math.max(1, level);
}
/** The hire of an escort (the Admiral's C) and a bribe (the Smuggler's C): their price grows with her level. */
export function escortCost(level: number): number {
  return Math.round(150 + 25 * Math.max(1, level));
}
export function bribeCost(level: number): number {
  return Math.round(80 + 12 * Math.max(1, level));
}
