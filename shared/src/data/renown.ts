// docs/16 Batch F — progress and goals: careers in the Crown, the League and the Brethren (built from standing and the
// deeds done for the flag), the week's challenges by sea with their tables, the album of collections, the titles won
// by feats and flown over the ship, and the welcome back after a long time ashore.

import { BOSSES } from './bosses.ts';
import { BEAST_IDS } from './beasts.ts';
import { CREATURE_IDS } from './bestiary.ts';
import { FISH_IDS } from './fishing.ts';
import { OMEN_IDS } from './omens.ts';
import { WONDER_KIND_IDS } from './wonders.ts';
import type { RegionId } from '../world/regions.ts';

type Tr = [string, string];

// ================================================================== 26. careers

export type CareerId = 'crown' | 'league' | 'confederacy';
export const CAREER_IDS: CareerId[] = ['crown', 'league', 'confederacy'];

export interface CareerDef {
  id: CareerId;
  name: Tr;
  /** The five ranks, which are also the titles. */
  ranks: Tr[];
  /** What counts as a deed for this flag. */
  deeds: Tr;
}

export const CAREERS: Record<CareerId, CareerDef> = {
  crown: {
    id: 'crown', name: ['The Crown', 'Корона'],
    ranks: [['Friend of the Crown', 'Друг Короны'], ['Crown Agent', 'Агент Короны'], ['Knight of the Sea', 'Рыцарь моря'], ['Admiralty Captain', 'Капитан Адмиралтейства'], ['Admiral of the Crown', 'Адмирал Короны']],
    deeds: ['Pirates, ghosts, Brethren and smugglers sunk or taken; merit in the Crown’s service.', 'Потопленные и взятые пираты, призраки, корабли Братства и контрабандисты; заслуги на службе Короне.'],
  },
  league: {
    id: 'league', name: ['The League', 'Лига'],
    ranks: [['League Factor', 'Фактор Лиги'], ['Trusted Trader', 'Доверенный купец'], ['League Partner', 'Компаньон Лиги'], ['Master of the Ledger', 'Мастер Гроссбуха'], ['The Gilded Seal', 'Позолоченная печать']],
    deeds: ['Silver traded in the League’s ports; Brethren raiders sunk; merit in the League’s service.', 'Серебро оборота в портах Лиги; потопленные налётчики Братства; заслуги на службе Лиге.'],
  },
  confederacy: {
    id: 'confederacy', name: ['The Brethren', 'Братство'],
    ranks: [['Deckhand of the Code', 'Юнга Кодекса'], ['Sworn Brother', 'Названый брат'], ['Raider of the Tide', 'Налётчик прилива'], ['Captain of the Code', 'Капитан Кодекса'], ['Captain of the Red Tide', 'Капитан Красного прилива']],
    deeds: ['Crown and League ships sunk or taken; silver traded in the havens; merit among the Brethren.', 'Потопленные и взятые корабли Короны и Лиги; серебро оборота в гаванях; заслуги в Братстве.'],
  },
};

/** Career points wanted for ranks 1..5, and the standing each rank asks as well. */
export const CAREER_POINTS = [100, 300, 700, 1300, 2200];
export const CAREER_REP = [10, 20, 35, 55, 75];
/** Points: ten a point of standing above nought, and the deeds. */
export const REP_POINTS = 10;
/** Deeds: a ship sunk for the flag, one taken by boarding, silver traded per point. */
export const DEED_SUNK = 12;
export const DEED_BOARDED = 16;
export const DEED_RAIDER = 8;
export const TRADE_PER_POINT = 100;
/** The price off goods in the flag's ports, by rank 0..5. */
export const CAREER_DISCOUNT = [0, 0, 0.03, 0.06, 0.08, 0.1];
/** Rank 3 and rank 5: the quartermaster's gift (a piece of this rarity). */
export const CAREER_GIFTS: Record<number, 1 | 2 | 3> = { 3: 2, 5: 3 };
/** Rank 4: the flag's yards build her a hull one class above their own. */
export const CAREER_YARD_RANK = 4;
/** Rank 5: the flag's own pennant. */
export const CAREER_PENNANT_RANK = 5;

export type CareerReward = 'title' | 'discount' | 'gift' | 'yard' | 'pennant';
export function careerRewards(rank: number): CareerReward[] {
  const out: CareerReward[] = ['title'];
  if (CAREER_DISCOUNT[rank] > CAREER_DISCOUNT[rank - 1]) out.push('discount');
  if (CAREER_GIFTS[rank]) out.push('gift');
  if (rank === CAREER_YARD_RANK) out.push('yard');
  if (rank === CAREER_PENNANT_RANK) out.push('pennant');
  return out;
}

export function careerPoints(rep: number, deeds: number, merit: number): number {
  return Math.max(0, Math.floor(rep)) * REP_POINTS + Math.floor(deeds) + Math.floor(merit);
}

/** Her rank (0: none yet) by points and standing. */
export function careerRank(rep: number, points: number): number {
  let r = 0;
  for (let i = 0; i < CAREER_POINTS.length; i++) if (points >= CAREER_POINTS[i] && rep >= CAREER_REP[i]) r = i + 1;
  return r;
}

export function careerTitle(id: CareerId, rank: number): string {
  return CAREERS[id].ranks[rank - 1][0];
}

// ================================================================== 27. the week's challenges

export type WeeklyKind = 'pirates' | 'catch' | 'trade' | 'distance' | 'prizes';
export const WEEKLY_KINDS: WeeklyKind[] = ['pirates', 'catch', 'trade', 'distance', 'prizes'];

export const WEEKLY: Record<WeeklyKind, { text: Tr; unit: Tr; icon: string; regions: RegionId[]; best?: boolean }> = {
  pirates: { text: ['Most pirates sunk in {r}', 'Больше всех потопить пиратов — {r}'], unit: ['pirates', 'пиратов'], icon: 'wanted', regions: ['gravewater', 'whispering', 'ashen_isles', 'dead_mans_expanse', 'drowned_crown'] },
  catch: { text: ['The heaviest catch in {r}', 'Самый тяжёлый улов — {r}'], unit: ['kg', 'кг'], icon: 'fish_tuna', regions: ['leviathan_reach', 'gravewater', 'black_coast', 'whispering', 'ashen_isles'], best: true },
  trade: { text: ['Most silver traded in {r}', 'Больше всех серебра в торговле — {r}'], unit: ['silver', 'серебра'], icon: 'coin', regions: ['black_coast', 'gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'drowned_crown', 'dead_mans_expanse'] },
  distance: { text: ['The longest log in {r}', 'Самый долгий путь под парусом — {r}'], unit: ['km', 'км'], icon: 'wind', regions: ['gravewater', 'whispering', 'leviathan_reach', 'dead_mans_expanse', 'black_coast'] },
  prizes: { text: ['Most prizes taken by boarding in {r}', 'Больше всех призов абордажем — {r}'], unit: ['prizes', 'призов'], icon: 'deed_first_prize', regions: ['gravewater', 'whispering', 'ashen_isles', 'dead_mans_expanse'] },
};

export const WEEK_MS = 7 * 86_400_000;
export const WEEKLY_COUNT = 3;
/** Silver to the first, second and third of each challenge; the first also takes the title. */
export const WEEKLY_PRIZES = [5000, 3000, 1500];
export const WEEKLY_TITLE = 'Champion of the Week';
export const WEEKLY_TOP = 5;

export function weekNumber(wallMs: number): number {
  return Math.floor(Math.floor(wallMs / 86_400_000) / 7);
}

export interface WeeklyChallenge {
  kind: WeeklyKind;
  region: RegionId;
}

/** The week's three challenges: three kinds in turn, each in a sea of its own (the same for everyone). */
export function weeklyChallenges(week: number): WeeklyChallenge[] {
  const out: WeeklyChallenge[] = [];
  const used = new Set<RegionId>();
  for (let i = 0; i < WEEKLY_COUNT; i++) {
    const kind = WEEKLY_KINDS[(week + i * 2) % WEEKLY_KINDS.length];
    const regs = WEEKLY[kind].regions;
    let j = (((week * 7 + i * 3) % regs.length) + regs.length) % regs.length;
    for (let k = 0; k < regs.length && used.has(regs[j]); k++) j = (j + 1) % regs.length;
    used.add(regs[j]);
    out.push({ kind, region: regs[j] });
  }
  return out;
}

// ================================================================== 28. the album

export type SetId = 'fish' | 'wonders' | 'omens' | 'trophies' | 'beasts' | 'letters' | 'bestiary';
export const SET_IDS: SetId[] = ['fish', 'wonders', 'omens', 'trophies', 'beasts', 'letters', 'bestiary'];

export interface SetDef {
  name: Tr;
  text: Tr;
  /** The pieces of the set. */
  items: string[];
  silver: number;
  title: Tr;
}

export const TROPHY_IDS = Object.values(BOSSES).map((b) => b.trophy);
/** The trophies' names in Russian (they come from the bosses' table). */
export const TROPHY_RU: Record<string, string> = {
  'Leviathan Skull': 'Череп левиафана', 'Kraken Eye': 'Глаз кракена', 'Bell of the Whale': 'Колокол кита', 'Lure of the Maw': 'Приманка Пасти',
  'Serpent Fang': 'Клык змея', "Drey's Lantern": 'Фонарь Дрея', 'Crown of Wrecks': 'Корона обломков', 'Veil of the Widow': 'Вуаль вдовы',
  'Skull of an Ancient': 'Череп древнего', 'A Shard of the Eye': 'Осколок Ока',
  // The six of 2026-10-03 (owner: «еще больше всяких там боссов»).
  'Jaw of Old Moorings': 'Челюсть Старого Швартова', 'Tithe-Tooth': 'Зуб Десятины', 'Mirror-Skin of the Changeling': 'Зеркальная кожа Подменыша',
  'Ember Barb of the Ray': 'Тлеющий шип Ската', 'The Prelate’s Mitre': 'Митра Прелата', 'The Twin Tusks': 'Бивни близнецов',
};

export function setDefs(letters: number): Record<SetId, SetDef> {
  return {
    fish: { name: ['Fish of the Seas', 'Рыбы морей'], text: ['Land every kind of fish at least once.', 'Поймайте каждую рыбу хотя бы раз.'], items: FISH_IDS.filter((f) => f !== 'goldfish'), silver: 2500, title: ['Master Angler', 'Мастер-рыболов'] },
    wonders: { name: ['Wonders of the Sea', 'Чудеса моря'], text: ['Find a wonder of every kind.', 'Найдите чудо каждого вида.'], items: [...WONDER_KIND_IDS], silver: 3000, title: ['Keeper of the Atlas', 'Хранитель атласа'] },
    omens: { name: ['Omens of the Day', 'Приметы дня'], text: ['Be at sea under every omen.', 'Выйдите в море под каждой приметой.'], items: [...OMEN_IDS], silver: 2000, title: ['Reader of Omens', 'Толкователь примет'] },
    trophies: { name: ['Trophies of the Deep', 'Трофеи глубин'], text: ['Take the trophy of every great beast of the sea.', 'Добудьте трофей каждого великого чудища моря.'], items: TROPHY_IDS, silver: 12000, title: ['Lord of Trophies', 'Владыка трофеев'] },
    beasts: { name: ['The Hunt', 'Охота'], text: ['Take a beast of every kind.', 'Добудьте зверя каждого вида.'], items: [...BEAST_IDS], silver: 4000, title: ['Master of the Hunt', 'Мастер охоты'] },
    letters: { name: ['Letters of the Sea', 'Письма моря'], text: ['Gather every letter found in a bottle.', 'Соберите все письма из бутылок.'], items: Array.from({ length: letters }, (_, i) => String(i)), silver: 1500, title: ['Keeper of Letters', 'Хранитель писем'] },
    // docs/18 #46: a page for each kind of creature, written at the first fight with it.
    bestiary: { name: ['The Bestiary', 'Бестиарий'], text: ['Fight every kind of creature of the islands and the sea at least once: each first fight writes its page.', 'Сразитесь с каждым видом существ островов и моря хотя бы раз: первый бой с видом вписывает его страницу.'], items: [...CREATURE_IDS], silver: 6000, title: ['Keeper of the Bestiary', 'Хранитель бестиария'] },
  };
}

// ================================================================== 29. titles for feats

export type FeatStat = 'league' | 'crown' | 'pirates' | 'ghosts' | 'kraken' | 'leviathan' | 'orca' | 'sunk' | 'boarded' | 'trade' | 'distance' | 'seas';

export interface FeatDef {
  id: string;
  title: Tr;
  text: Tr;
  stat: FeatStat;
  need: number;
  icon: string;
}

export const FEATS: FeatDef[] = [
  { id: 'league_bane', title: ['Scourge of the League', 'Гроза Лиги'], text: ['Sink or take 25 League ships.', 'Потопите или возьмите 25 кораблей Лиги.'], stat: 'league', need: 25, icon: 'deed_convoy_breaker' },
  { id: 'crown_bane', title: ['Scourge of the Crown', 'Гроза Короны'], text: ['Sink or take 25 Crown ships.', 'Потопите или возьмите 25 кораблей Короны.'], stat: 'crown', need: 25, icon: 'deed_ship_of_the_line' },
  { id: 'pirate_bane', title: ['Bane of Pirates', 'Гроза пиратов'], text: ['Sink 50 pirates.', 'Потопите 50 пиратов.'], stat: 'pirates', need: 50, icon: 'deed_captain_killer' },
  { id: 'ghost_breaker', title: ['Ghost-Breaker', 'Гроза призраков'], text: ['Send 20 ghost ships to their rest.', 'Упокойте 20 кораблей-призраков.'], stat: 'ghosts', need: 20, icon: 'map_graveyard' },
  { id: 'kraken_slayer', title: ['Kraken-Slayer', 'Кракеноборец'], text: ['Fight down the Kraken.', 'Одолейте Кракена.'], stat: 'kraken', need: 1, icon: 'tattoo_kraken' },
  { id: 'leviathan_slayer', title: ['Leviathan-Slayer', 'Левиафаноборец'], text: ['Fight down a Leviathan.', 'Одолейте левиафана.'], stat: 'leviathan', need: 1, icon: 'deed_leviathan_slain' },
  { id: 'whale_friend', title: ['Friend of Whales', 'Друг китов'], text: ['Win the trust of the White Orca: her calf follows your wake.', 'Заслужите доверие Белой косатки: её детёныш идёт за вашей кормой.'], stat: 'orca', need: 1, icon: 'tattoo_orca' },
  { id: 'sea_wolf', title: ['Sea Wolf', 'Морской волк'], text: ['Sink 100 ships.', 'Потопите 100 кораблей.'], stat: 'sunk', need: 100, icon: 'deed_hundred_wrecks' },
  { id: 'boarding_master', title: ['Master of Boarding', 'Мастер абордажа'], text: ['Take 25 prizes by boarding.', 'Возьмите абордажем 25 призов.'], stat: 'boarded', need: 25, icon: 'deed_first_prize' },
  { id: 'merchant_prince', title: ['Merchant Prince', 'Торговый князь'], text: ['Make 100,000 silver of trading profit.', 'Заработайте торговлей 100 000 серебра прибыли.'], stat: 'trade', need: 100000, icon: 'deed_hundred_thousand' },
  { id: 'far_voyager', title: ['Far Voyager', 'Дальний ходок'], text: ['Sail 1,000 km.', 'Пройдите под парусом 1000 км.'], stat: 'distance', need: 1000, icon: 'deed_expanse_crossing' },
  { id: 'pathfinder', title: ['Pathfinder', 'Первопроходец'], text: ['Sail every one of the eight seas.', 'Побывайте во всех восьми морях.'], stat: 'seas', need: 8, icon: 'talent_exp_pathfinder' },
];

// ================================================================== 30. the welcome back

/** Away at least this long, a captain is told what happened and given a gift. */
export const AWAY_MIN_H = 12;
/** The gift: silver a day away (by level), counted to a week at most; a builders' speed-up from two days. */
export const AWAY_CAP_DAYS = 7;
export function awayGift(hours: number, level: number): { silver: number; speedups: number; provisions: number } {
  if (!(hours >= AWAY_MIN_H)) return { silver: 0, speedups: 0, provisions: 0 };
  const days = Math.min(AWAY_CAP_DAYS, hours / 24);
  return { silver: Math.round((days * (120 + 20 * Math.max(1, level))) / 10) * 10, speedups: days >= 2 ? 1 : 0, provisions: Math.min(30, Math.round(5 + days * 3)) };
}

// ================================================================== Russian for the server's lines

export function renownPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const c of Object.values(CAREERS)) {
    out.push(c.name, c.deeds);
    for (const r of c.ranks) out.push(r);
  }
  for (const f of FEATS) out.push(f.title, f.text);
  for (const d of Object.values(setDefs(0))) out.push(d.title, d.name);
  for (const t of TROPHY_IDS) out.push([t, TROPHY_RU[t] ?? t]);
  for (const w of Object.values(WEEKLY)) out.push([w.text[0].replace('{r}', '{0}'), w.text[1].replace('{r}', '{0}')]);
  out.push(
    [WEEKLY_TITLE, 'Чемпион недели'],
    ['A new rank: {0} ({1}).', 'Новое звание: {0} ({1}).'],
    ['{0}: the quartermaster sends you {1}.', '{0}: интендант присылает вам — {1}.'],
    ['{0}: your pennant is yours to fly.', '{0}: теперь у вас свой вымпел.'],
    ['{0}: the yards of the flag build you a hull one class above their own.', '{0}: верфи флага строят для вас корпус на класс выше своего.'],
    ['A new title: “{0}”. Choose it in the company window.', 'Новый титул: «{0}». Выберите его в окне компании.'],
    ['The album: {0} is complete! {1} silver and the title “{2}”.', 'Альбом: собрано «{0}»! {1} серебра и титул «{2}».'],
    ['The week’s challenge: {0} — place {1}.', 'Испытание недели: {0} — место {1}.'],
    ['You took place {0} in the week’s challenge “{1}”. The harbour masters send your prize.', 'Вы заняли {0}-е место в испытании недели «{1}». Начальники портов шлют вашу награду.'],
    ['The Harbour Masters', 'Начальники портов'],
    ['The week’s challenges are closed: {0}.', 'Испытания недели завершены: {0}.'],
    ['Welcome back, captain: {0} h away. A gift waits for you.', 'С возвращением, капитан: вас не было {0} ч. Вас ждёт подарок.'],
    ['The welcome gift: {0} silver.', 'Подарок к возвращению: {0} серебра.'],
    ['No gift waits for you.', 'Подарка для вас нет.'],
  );
  return out;
}
