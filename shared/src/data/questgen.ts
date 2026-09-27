// The quest generator (docs/11 P4): some three thousand quests, the same for every server on a world seed. Each
// port's people — harbour masters, widows, smugglers, priests — give jobs built from ~32 plots told five ways
// each (160 templates): carry, hunt, rescue, scout, smuggle, dive for treasure, carry word, take revenge,
// investigate. Every text is a template with named places; its Russian twin sits beside it, and the client
// turns both into translation patterns (client/src/lang/quests.ts), so every generated sentence reads in Russian.

import { Rng, hashString } from '../rng.ts';
import type { GoodId } from './goods.ts';
import { GOODS } from './goods.ts';
import { REGIONS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import type { Island, Port, World } from '../world/worldgen.ts';
import { islandLife } from '../world/islandlife.ts';
import type { QuestDef, QuestStep } from './quests.ts';

// ------------------------------------------------------------------ the people who give the jobs

/** Names drawn only from parts the Russian name table knows (client/src/lang/names.ts). */
export const GIVER_MEN = ['Ansel', 'Bram', 'Fenn', 'Gideon', 'Jonas', 'Oswin', 'Quint', 'Silas', 'Ulric', 'Aldous', 'Cato', 'Fenwick', 'Ivo', 'Magnus', 'Osric', 'Rurik', 'Wynn'];
export const GIVER_WOMEN = ['Edda', 'Isolde', 'Nell', 'Tamsin', 'Vesper', 'Bess', 'Dagny', 'Esme', 'Hester', 'Juno', 'Leda', 'Petra', 'Yara', 'Lark'];
export const GIVER_FIRST = [...GIVER_MEN, ...GIVER_WOMEN];
export const GIVER_LAST = ['Blackwater', 'Coldharbour', 'Drummond', 'Farrow', 'Gault', 'Holloway', 'Jessop', 'Kell', 'Lowe', 'Marrow', 'Nettle', 'Orme', 'Pike', 'Quill', 'Reeve', 'Thorne', 'Umber', 'Wick', 'Yeats', 'Crane', 'Marlow', 'Holt', 'Varga', 'Pryce', 'Lamb', 'Maddox', 'Blackwood', 'Moor', 'Frost', 'Tarrow', 'Grimsby', 'Vale', 'Hawthorne', 'Doyle', 'Carrow', 'Stroud'];

/** Russian trades that change for a woman: the stories write the man's word before the giver's name — «купца (…)»,
 *  «…, купец» — and a woman giver takes hers. (Words that stay the same for both, like «картограф», are not here.) */
const FEMININE_RU: [string, string][] = [
  ['аптекаря', 'аптекарши'], ['аптекарь', 'аптекарша'], ['купца', 'купчихи'], ['купцу', 'купчихе'], ['купец', 'купчиха'],
  ['скупщика', 'скупщицы'], ['скупщику', 'скупщице'], ['скупщик', 'скупщица'], ['скупщик краденого', 'скупщица краденого'], ['контрабандиста', 'контрабандистки'],
  ['контрабандисту', 'контрабандистке'], ['контрабандист', 'контрабандистка'], ['ловца', 'ныряльщицы'], ['ловец жемчуга', 'ныряльщица за жемчугом'],
  ['посланника', 'посланницы'], ['посланник', 'посланница'], ['сектанта', 'сектантки'], ['сектант', 'сектантка'],
  ['священника', 'жрицы'], ['священник', 'жрица'], ['отшельника', 'отшельницы'], ['отшельник', 'отшельница'],
  ['смотрителя маяка', 'смотрительницы маяка'], ['смотритель маяка', 'смотрительница маяка'],
];
const FEM_BEFORE = new Map(FEMININE_RU);

/** A job's Russian line when its giver is a woman (her name in the English line): the trade before «(name)» and
 *  after «name, » takes the woman's word. Lines about a man, or about no giver, come back as they are. */
export function feminineRu(en: string, ru: string): string {
  if (!GIVER_WOMEN.some((w) => en.includes(`${w} `))) return ru;
  return ru
    .replace(/([А-Яа-яЁё]+(?: маяка| жемчуга| краденого)?) \(/g, (m, w: string) => {
      const f = FEM_BEFORE.get(w.toLowerCase());
      return f ? `${w[0] === w[0].toUpperCase() ? f[0].toUpperCase() + f.slice(1) : f} (` : m;
    })
    .replace(/, ([а-яё]+(?: маяка| жемчуга| краденого)?)$/, (m, w: string) => (FEM_BEFORE.has(w) ? `, ${FEM_BEFORE.get(w)}` : m));
}

export type Profession = 'harbour_master' | 'fishwife' | 'shipwright' | 'priest' | 'widow' | 'merchant' | 'smuggler' | 'old_salt' | 'apothecary' | 'cartographer'
  | 'garrison_captain' | 'tavern_keeper' | 'pearl_diver' | 'fence' | 'envoy' | 'hermit' | 'bosun' | 'lighthouse_keeper' | 'whaler' | 'cultist';

/** The giver's portrait id: one face for each profession and sex (docs/11 P5). */
export function giverPortrait(profession: Profession, giver: string): string {
  const first = giver.split(' ')[0];
  const sex = GIVER_WOMEN.includes(first) ? 'f' : GIVER_MEN.includes(first) ? 'm' : PROFESSION_SEX[profession] ?? 'm';
  return `giver_${profession}_${sex}`;
}

/** Whom the stories speak of as "she" or "he" (the rest may be either). */
export const PROFESSION_SEX: Partial<Record<Profession, 'f' | 'm'>> = {
  widow: 'f', fishwife: 'f', old_salt: 'm', tavern_keeper: 'm', bosun: 'm', whaler: 'm', priest: 'm', garrison_captain: 'm', hermit: 'm', fence: 'm',
};

export const PROFESSIONS: Record<Profession, [string, string]> = {
  harbour_master: ['harbour master', 'начальник порта'], fishwife: ['fishwife', 'торговка рыбой'], shipwright: ['shipwright', 'корабел'],
  priest: ['priest', 'священник'], widow: ['widow', 'вдова'], merchant: ['merchant', 'купец'], smuggler: ['smuggler', 'контрабандист'],
  old_salt: ['old salt', 'старый моряк'], apothecary: ['apothecary', 'аптекарь'], cartographer: ['cartographer', 'картограф'],
  garrison_captain: ['garrison captain', 'капитан гарнизона'], tavern_keeper: ['tavern keeper', 'трактирщик'], pearl_diver: ['pearl diver', 'ловец жемчуга'],
  fence: ['fence', 'скупщик краденого'], envoy: ['envoy', 'посланник'], hermit: ['hermit', 'отшельник'], bosun: ['bosun', 'боцман'],
  lighthouse_keeper: ['lighthouse keeper', 'смотритель маяка'], whaler: ['whaler', 'китобой'], cultist: ['cultist', 'сектант'],
};

// ------------------------------------------------------------------ what each kind of step says

/** Step kinds a plot is made of; each becomes a quest step with its text. */
export type StepKind = 'pickup' | 'deliver2' | 'deliver3' | 'visit2' | 'visit3' | 'home' | 'back' | 'sink_pirates' | 'sink_ghosts' | 'sink_hunters' | 'sink_any'
  | 'board' | 'prize' | 'land_site' | 'land_any' | 'land_any2' | 'dive' | 'chart' | 'reach' | 'time_in' | 'contraband' | 'customs';

export const STEP_TEXT: Record<StepKind, [string, string]> = {
  pickup: ['Take on {good} × {n} at {port}.', 'Примите груз в порту {port}: {good} × {n}.'],
  deliver2: ['Deliver {good} × {n} to {port2}.', 'Доставьте в порт {port2}: {good} × {n}.'],
  deliver3: ['Deliver {good} × {n} to {port3}.', 'Доставьте в порт {port3}: {good} × {n}.'],
  visit2: ['Sail to {port2}.', 'Идите в порт {port2}.'],
  visit3: ['Sail on to {port3}.', 'Затем — в порт {port3}.'],
  home: ['Return to {port}: {giver} is waiting.', 'Вернитесь в порт {port}: вас ждёт {giver}.'],
  back: ['Return to the {site} on {island}: {giver} is waiting.', 'Вернитесь к месту «{site}» на острове {island}: вас ждёт {giver}.'],
  sink_pirates: ['Sink pirate ships in {region}: {n}.', 'Потопите пиратские корабли в водах «{region}»: {n}.'],
  sink_ghosts: ['Send ghost ships back to the deep: {n}.', 'Верните на дно корабли-призраки: {n}.'],
  sink_hunters: ['Sink the hunters and patrols that come for you: {n}.', 'Потопите охотников и патрули, что придут за вами: {n}.'],
  sink_any: ['Sink ships of any flag in {region}: {n}.', 'Потопите корабли под любым флагом в водах «{region}»: {n}.'],
  board: ['Take ships by boarding: {n}.', 'Возьмите корабли на абордаж: {n}.'],
  prize: ['Bring in prizes: {n}.', 'Приведите призы: {n}.'],
  land_site: ['Land a party at the {site} on {island}.', 'Высадите десант: {site}, остров {island}.'],
  land_any: ['Land a party on {island}.', 'Высадите десант на остров {island}.'],
  land_any2: ['Then land a party on {island2}.', 'Затем высадите десант на остров {island2}.'],
  dive: ['Send divers down to sunken wrecks: {n}.', 'Спустите водолазов к затонувшим судам: {n}.'],
  chart: ['Chart islands you have never seen: {n}.', 'Нанесите на карту острова, которых не видели: {n}.'],
  reach: ['Sail into {region}.', 'Войдите в воды «{region}».'],
  time_in: ['Keep the sea in {region} for {n} min.', 'Проведите в водах «{region}» {n} мин.'],
  contraband: ['Sell contraband at {port2}: {n}.', 'Продайте контрабанду в порту {port2}: {n}.'],
  customs: ['Pass a customs inspection without a fine.', 'Пройдите таможенный досмотр без штрафа.'],
};

// ------------------------------------------------------------------ plots and the ways they are told

export type Category = 'delivery' | 'hunt' | 'rescue' | 'scouting' | 'smuggling' | 'treasure' | 'diplomacy' | 'revenge' | 'investigation';

interface Flavor {
  giver: Profession;
  name: [string, string];
  summary: [string, string];
}

export interface Plot {
  id: string;
  category: Category;
  steps: StepKind[];
  /** The goods this plot moves (one is picked). */
  goods?: GoodId[];
  /** Where it may be offered. */
  where?: 'safe' | 'unsafe' | 'lawless' | 'strange' | 'any';
  level: number;
  pay: number;
  xp: number;
  /** Which kind of site a land_site step goes for. */
  site?: 'people' | 'beasts' | 'pirate_camp' | 'smugglers' | 'ruins';
  flavors: Flavor[];
}

const F = (giver: Profession, nameEn: string, nameRu: string, sumEn: string, sumRu: string): Flavor => ({ giver, name: [nameEn, nameRu], summary: [sumEn, sumRu] });

export const PLOTS: Plot[] = [
  // ---------------------------------------------------------------- delivery
  {
    id: 'courier', category: 'delivery', steps: ['pickup', 'deliver2', 'home'], goods: ['cloth', 'rum', 'sugar', 'tobacco', 'salt', 'planks'], level: 1, pay: 260, xp: 180, flavors: [
      F('merchant', 'Cargo for {port2}', 'Груз для порта {port2}', '{giver} has a hold of goods sold ahead to {port2} and no ship to carry them.', '{giver} продал груз заранее в порт {port2}, а везти его некому.'),
      F('widow', 'The Widow\'s Bargain', 'Сделка вдовы', 'Her husband\'s last bargain must reach {port2}, or {giver} loses the house.', 'Последняя сделка её мужа должна дойти до порта {port2}, иначе {giver} лишится дома.'),
      F('harbour_master', 'A Berth Too Many', 'Лишний причал', '{giver} needs the quay cleared: take this cargo to {port2} before the tide turns.', '{giver} просит освободить пристань: отвезите этот груз в порт {port2}, пока не сменился прилив.'),
      F('tavern_keeper', 'Owed in {port2}', 'Долг в порту {port2}', 'A tavern in {port2} was promised this load; {giver} keeps promises.', 'Трактиру в порту {port2} обещали этот груз; {giver} держит слово.'),
      F('old_salt', 'One Last Run', 'Последний рейс', '{giver} is too old for the run to {port2}. Sail it for him.', '{giver} слишком стар для рейса в порт {port2}. Сходите вместо него.'),
    ],
  },
  {
    id: 'supply', category: 'delivery', steps: ['deliver2', 'home'], goods: ['provisions', 'timber', 'iron', 'coal', 'medicine', 'sailcloth'], level: 1, pay: 320, xp: 160, flavors: [
      F('harbour_master', 'Short in {port2}', 'Нехватка в порту {port2}', '{port2} runs short of {good}. Buy it where you will; {giver} pays well for the kindness.', 'В порту {port2} кончается {good}. Купите где угодно — {giver} хорошо заплатит за услугу.'),
      F('shipwright', 'Timber and Iron', 'Лес и железо', 'The yard at {port2} stands idle for want of {good}. {giver} vouches for the price.', 'Верфь в порту {port2} стоит без дела: нет товара «{good}». {giver} ручается за цену.'),
      F('apothecary', 'Before the Fever', 'Пока не пришла лихорадка', 'Word from {port2}: they need {good} before the fever season. {giver} asks you to go.', 'Весть из порта {port2}: там нужен товар «{good}» до сезона лихорадки. {giver} просит вас сходить.'),
      F('priest', 'Alms for {port2}', 'Подаяние для порта {port2}', 'The poor of {port2} go hungry. {giver} will bless any captain who brings {good}.', 'Бедняки порта {port2} голодают. {giver} благословит капитана, что привезёт товар «{good}».'),
      F('merchant', 'A Gap in the Market', 'Пустая полка на рынке', '{giver} has heard {port2} pays over the odds for {good}. Prove it, and share the tale.', '{giver} слышал, что в порту {port2} за товар «{good}» платят втридорога. Проверьте и расскажите.'),
    ],
  },
  {
    id: 'medicine_run', category: 'delivery', steps: ['pickup', 'deliver2', 'home'], goods: ['medicine'], level: 5, pay: 420, xp: 260, flavors: [
      F('apothecary', 'The Cure', 'Лекарство', '{giver} has the only medicine for a sickness in {port2}. Every hour counts.', 'У аптекаря ({giver}) единственное лекарство от болезни в порту {port2}. Каждый час на счету.'),
      F('priest', 'A Chest of Remedies', 'Сундук со снадобьями', 'The sick of {port2} pray for this chest; {giver} begs you carry it.', 'Больные порта {port2} молятся об этом сундуке; {giver} умоляет вас отвезти его.'),
      F('widow', 'For Her Son', 'Ради сына', '{giver}\'s son lies sick in {port2}. Carry the medicine; she can pay a little.', 'Сын этой вдовы ({giver}) болен в порту {port2}. Отвезите лекарство — она заплатит, сколько сможет.'),
      F('harbour_master', 'Quarantine Supplies', 'Припасы для карантина', '{port2} is under quarantine and needs medicine. {giver} will see you paid.', 'Порт {port2} на карантине и ждёт лекарств. {giver} проследит, чтобы вам заплатили.'),
      F('old_salt', 'The Doctor\'s Order', 'Заказ лекаря', 'A ship\'s doctor in {port2} ordered medicine a month ago. {giver} still has it.', 'Корабельный лекарь из порта {port2} заказал снадобья месяц назад. Они до сих пор у моряка ({giver}).'),
    ],
  },
  {
    id: 'two_stops', category: 'delivery', steps: ['pickup', 'deliver2', 'deliver3', 'home'], goods: ['rum', 'cloth', 'salt', 'provisions', 'sugar'], level: 8, pay: 620, xp: 380, flavors: [
      F('merchant', 'Split Cargo', 'Груз на двоих', '{giver} sold half to {port2} and half to {port3}. Carry both halves.', '{giver} продал половину груза в порт {port2}, половину — в {port3}. Отвезите обе.'),
      F('tavern_keeper', 'The Round of Taverns', 'По трактирам', 'Two taverns, {port2} and {port3}, wait for the same barrels. {giver} counts on you.', 'Два трактира, в портах {port2} и {port3}, ждут одних и тех же бочек. {giver} на вас рассчитывает.'),
      F('harbour_master', 'Along the Coast', 'Вдоль берега', '{giver} has goods for two harbours on the coast: {port2}, then {port3}.', '{giver} собрал груз для двух гаваней: сначала {port2}, потом {port3}.'),
      F('fishwife', 'Salt for Two Ports', 'Соль для двух портов', 'The curing sheds of {port2} and {port3} both wait on this load, says {giver}.', 'Засолочные сараи в портах {port2} и {port3} ждут этого груза, говорит {giver}.'),
      F('priest', 'Two Parishes', 'Два прихода', '{giver} has gifts for two parishes: {port2} and {port3}.', '{giver} собрал дары для двух приходов: {port2} и {port3}.'),
    ],
  },
  {
    id: 'outpost', category: 'delivery', steps: ['deliver2', 'land_site', 'home'], goods: ['provisions', 'rum', 'medicine'], site: 'people', level: 4, pay: 380, xp: 260, flavors: [
      F('fishwife', 'The Hamlet\'s Winter', 'Зима в посёлке', 'The folk at the {site} on {island} will not last the winter. Bring {good} to {port2} and row it ashore.', 'Люди у места «{site}» на острове {island} не переживут зиму. Доставьте товар «{good}» в порт {port2} и отвезите на берег.'),
      F('priest', 'The Forgotten Shore', 'Забытый берег', '{giver} remembers the people at the {site} on {island}. Nobody else does.', '{giver} помнит людей у места «{site}» на острове {island}. Больше их не помнит никто.'),
      F('old_salt', 'Old Friends', 'Старые друзья', '{giver} has friends at the {site} on {island}. Take them something from {port2}.', 'У моряка ({giver}) друзья у места «{site}» на острове {island}. Отвезите им что-нибудь из порта {port2}.'),
      F('merchant', 'A New Customer', 'Новый покупатель', 'The {site} on {island} could be a market. {giver} wants to know.', 'Место «{site}» на острове {island} может стать рынком. {giver} хочет это знать.'),
      F('widow', 'Her Brother\'s Hut', 'Хижина брата', '{giver}\'s brother lives at the {site} on {island}. She sends what she can.', 'Брат этой вдовы ({giver}) живёт у места «{site}» на острове {island}. Она посылает, что может.'),
    ],
  },
  {
    id: 'powder', category: 'delivery', steps: ['deliver2', 'home'], goods: ['gunpowder', 'weapons'], level: 10, pay: 520, xp: 300, flavors: [
      F('garrison_captain', 'Dry Powder', 'Сухой порох', 'The battery at {port2} has wet powder and a pirate sail on the horizon, says {giver}.', 'На батарее порта {port2} отсырел порох, а на горизонте пиратский парус, — говорит {giver}.'),
      F('smuggler', 'Guns for {port2}', 'Оружие для порта {port2}', '{giver} knows buyers in {port2} who ask no questions about {good}.', '{giver} знает покупателей в порту {port2}, что не задают вопросов о товаре «{good}».'),
      F('bosun', 'Arm the Watch', 'Вооружить дозор', 'The watch at {port2} fights with belaying pins. {giver} wants them armed.', 'Дозор в порту {port2} воюет нагелями. {giver} хочет его вооружить.'),
      F('merchant', 'A Dangerous Load', 'Опасный груз', 'Nobody in {port} will carry {good} to {port2}. {giver} pays double.', 'Никто в порту {port} не возьмётся везти товар «{good}» в {port2}. {giver} платит вдвое.'),
      F('harbour_master', 'The Fort\'s Order', 'Заказ форта', '{giver} holds the fort\'s order for {good}; {port2} needs it now.', 'У начальника порта ({giver}) заказ форта на товар «{good}»; в порту {port2} он нужен сейчас.'),
    ],
  },
  // ---------------------------------------------------------------- hunt
  {
    id: 'pirate_hunt', category: 'hunt', steps: ['sink_pirates', 'home'], level: 5, pay: 520, xp: 420, flavors: [
      F('garrison_captain', 'Clear the Lanes', 'Очистить пути', 'Pirates prey on the lanes of {region}. {giver} wants them gone.', 'Пираты охотятся на путях в водах «{region}». {giver} хочет, чтобы их не стало.'),
      F('merchant', 'Wolves at Sea', 'Волки на море', 'Three of {giver}\'s ships never came home from {region}. Make someone pay.', 'Три корабля купца ({giver}) не вернулись из вод «{region}». Пусть кто-то за это заплатит.'),
      F('widow', 'For the Drowned', 'За утонувших', '{giver}\'s husband went down to pirates in {region}. She wants no mercy for them.', 'Муж этой вдовы ({giver}) погиб от пиратов в водах «{region}». Она не хочет им пощады.'),
      F('harbour_master', 'The Harbour\'s Bounty', 'Награда гавани', '{giver} pays a bounty for every pirate hull sunk in {region}.', '{giver} платит награду за каждый пиратский корпус, потопленный в водах «{region}».'),
      F('fishwife', 'Safe Nets', 'Сети без опаски', 'The fishing boats dare not leave harbour for pirates in {region}, says {giver}.', 'Рыбацкие лодки не смеют выйти из гавани из-за пиратов в водах «{region}», — говорит {giver}.'),
    ],
  },
  {
    id: 'privateer', category: 'hunt', steps: ['board', 'home'], level: 8, pay: 560, xp: 480, where: 'unsafe', flavors: [
      F('fence', 'Goods Wanted', 'Нужен товар', '{giver} has buyers and no goods. Take ships by boarding and bring the tale back.', 'У скупщика ({giver}) есть покупатели и нет товара. Возьмите корабли на абордаж и возвращайтесь.'),
      F('smuggler', 'Over the Rail', 'Через борт', '{giver} wants to see if you have the stomach for boarding.', '{giver} хочет увидеть, хватит ли у вас духу на абордаж.'),
      F('bosun', 'Blooding the Crew', 'Кровь для команды', 'A crew is made at the rail, says {giver}. Board a few and learn.', 'Команду куют у борта, говорит {giver}. Возьмите нескольких на абордаж — и научитесь.'),
      F('tavern_keeper', 'A Wager', 'Спор', '{giver} bet a barrel that you cannot take ships by boarding. Prove him wrong.', '{giver} поспорил на бочку, что вам не взять корабли на абордаж. Докажите обратное.'),
      F('old_salt', 'The Old Way', 'По старинке', '{giver} remembers when captains fought hand to hand. Show him it is not forgotten.', '{giver} помнит времена, когда капитаны дрались врукопашную. Покажите, что это не забыто.'),
    ],
  },
  {
    id: 'ghost_hunt', category: 'hunt', steps: ['sink_ghosts', 'home'], level: 20, pay: 900, xp: 800, where: 'strange', flavors: [
      F('priest', 'Lay Them to Rest', 'Упокоить их', 'Ghost ships sail where the living drowned. {giver} asks you send them back.', 'Корабли-призраки ходят там, где тонули живые. {giver} просит вернуть их на дно.'),
      F('cultist', 'The Choir\'s Price', 'Цена Хора', '{giver} will pay for every ghost you send down — and will not say why.', '{giver} заплатит за каждого призрака, что вы отправите на дно, — и не скажет зачем.'),
      F('widow', 'Her Husband\'s Ship', 'Корабль её мужа', '{giver} saw her dead husband\'s ship sail past the harbour. Sink it.', '{giver} видела, как мимо гавани прошёл корабль её мёртвого мужа. Потопите его.'),
      F('lighthouse_keeper', 'Lights Without Crews', 'Огни без экипажей', '{giver} sees lanterns at sea with no crew to light them.', '{giver} видит в море фонари, которые некому зажигать.'),
      F('old_salt', 'What Sails at Night', 'Что ходит ночью', '{giver} has seen them — the ships that do not answer hails.', '{giver} их видел — корабли, что не отвечают на оклик.'),
    ],
  },
  {
    id: 'patrol_duty', category: 'hunt', steps: ['time_in', 'sink_pirates', 'home'], level: 6, pay: 560, xp: 460, where: 'safe', flavors: [
      F('garrison_captain', 'Patrol Duty', 'Дозор', '{giver} is short of ships. Keep the sea in {region} and sink what comes.', 'У капитана гарнизона ({giver}) не хватает кораблей. Проведите время в водах «{region}» и топите, что появится.'),
      F('harbour_master', 'The Night Watch', 'Ночная вахта', '{giver} wants a warship on watch in {region}.', '{giver} хочет, чтобы в водах «{region}» стоял на вахте боевой корабль.'),
      F('merchant', 'Escort the Lanes', 'Охрана путей', 'The merchant houses pay for a guard on the lanes of {region}, says {giver}.', 'Торговые дома платят за охрану путей в водах «{region}», — говорит {giver}.'),
      F('lighthouse_keeper', 'Under the Light', 'Под светом маяка', '{giver} has seen dark sails in {region}. Keep watch where his light cannot.', '{giver} видел тёмные паруса в водах «{region}». Несите вахту там, куда не достаёт его свет.'),
      F('bosun', 'Show the Flag', 'Показать флаг', '{giver} says a flag seen at sea keeps the wolves in their dens.', '{giver} говорит: флаг, замеченный в море, держит волков в логове.'),
    ],
  },
  {
    id: 'prize_taker', category: 'hunt', steps: ['prize', 'home'], level: 12, pay: 780, xp: 560, where: 'unsafe', flavors: [
      F('fence', 'Hulls Wanted', 'Нужны корпуса', '{giver} buys hulls, no questions asked. Bring them in under a prize crew.', '{giver} покупает корпуса без вопросов. Приведите их с призовой командой.'),
      F('shipwright', 'Ships to Mend', 'Корабли в починку', '{giver}\'s yard needs hulls to mend and sell. Bring in prizes.', 'Верфи корабела ({giver}) нужны корпуса для починки и продажи. Приведите призы.'),
      F('smuggler', 'A Fleet of Our Own', 'Свой флот', '{giver} is building a fleet one prize at a time.', '{giver} собирает флот — по одному призу за раз.'),
      F('garrison_captain', 'The Prize Court', 'Призовой суд', 'The prize court sits in {port}; {giver} will see your prizes judged fairly.', 'Призовой суд заседает в порту {port}; {giver} проследит, чтобы призы оценили честно.'),
      F('merchant', 'Speculation', 'Спекуляция', '{giver} speculates in captured ships. Supply him.', '{giver} спекулирует захваченными кораблями. Снабдите его.'),
    ],
  },
  {
    id: 'hunters_hunt', category: 'hunt', steps: ['sink_hunters', 'home'], level: 15, pay: 820, xp: 640, where: 'lawless', flavors: [
      F('smuggler', 'Hunt the Hunters', 'Охота на охотников', 'The bounty hunters grow bold. {giver} wants them to fear the sea again.', 'Охотники за головами осмелели. {giver} хочет, чтобы они снова боялись моря.'),
      F('fence', 'Bad for Business', 'Плохо для дела', 'Patrols are bad for business, says {giver}. Sink the ones that come.', 'Патрули вредят делу, говорит {giver}. Топите тех, что придут.'),
      F('tavern_keeper', 'The Brethren\'s Toast', 'Тост Братства', 'The brethren drink to every patrol sunk. {giver} keeps the tally.', 'Братство пьёт за каждый потопленный патруль. {giver} ведёт счёт.'),
      F('old_salt', 'Old Scores', 'Старые счёты', '{giver} was hanged once and cut down alive. He has scores to settle.', 'Моряка ({giver}) однажды вешали — и сняли живым. У него счёты.'),
      F('bosun', 'Free Waters', 'Вольные воды', '{giver} says the sea belongs to no crown. Prove it.', '{giver} говорит, что море не принадлежит ни одной короне. Докажите это.'),
    ],
  },
  // ---------------------------------------------------------------- rescue
  {
    id: 'castaways', category: 'rescue', steps: ['land_any', 'home'], level: 3, pay: 340, xp: 300, flavors: [
      F('widow', 'A Signal Fire', 'Сигнальный костёр', 'Fishermen saw a signal fire on {island}. {giver} prays it is her son.', 'Рыбаки видели сигнальный костёр на острове {island}. {giver} молится, чтобы это был её сын.'),
      F('harbour_master', 'Overdue', 'Опоздавшие', 'A boat from {port} is overdue. {giver} thinks the crew is ashore on {island}.', 'Лодка из порта {port} не вернулась в срок. {giver} думает, что команда на острове {island}.'),
      F('fishwife', 'Nets Ashore', 'Сети на берегу', '{giver}\'s nets washed ashore on {island}, and her boys were with them.', 'Сети торговки ({giver}) выбросило на остров {island}, а с ними были её сыновья.'),
      F('priest', 'The Lost Flock', 'Заблудшая паства', '{giver}\'s pilgrims were wrecked on {island}. Bring them home.', 'Паломники священника ({giver}) потерпели крушение у острова {island}. Верните их домой.'),
      F('lighthouse_keeper', 'Smoke on the Horizon', 'Дым на горизонте', '{giver} saw smoke rising from {island} three nights running.', '{giver} три ночи подряд видел дым над островом {island}.'),
    ],
  },
  {
    id: 'hostages', category: 'rescue', steps: ['land_site', 'home'], site: 'pirate_camp', level: 12, pay: 760, xp: 620, where: 'unsafe', flavors: [
      F('merchant', 'Ransom Refused', 'Выкуп отвергнут', 'Pirates hold {giver}\'s factor at the {site} on {island}. The ransom was too much.', 'Пираты держат приказчика купца ({giver}) у места «{site}» на острове {island}. Выкуп им показался мал.'),
      F('widow', 'Taken', 'Похищенная', '{giver}\'s daughter was taken to the {site} on {island}. Bring her back.', 'Дочь этой вдовы ({giver}) увезли к месту «{site}» на острове {island}. Верните её.'),
      F('garrison_captain', 'Prisoners of War', 'Пленники', 'Men of the garrison are held at the {site} on {island}. {giver} cannot spare a ship.', 'Люди гарнизона в плену у места «{site}» на острове {island}. {giver} не может выделить корабль.'),
      F('priest', 'The Captive Brother', 'Брат в плену', 'A brother of the order is chained at the {site} on {island}.', 'Брат ордена в цепях у места «{site}» на острове {island}.'),
      F('tavern_keeper', 'My Best Cook', 'Мой лучший повар', '{giver}\'s cook was carried off to the {site} on {island}. The tavern starves.', 'Повара трактирщика ({giver}) утащили к месту «{site}» на острове {island}. Трактир голодает.'),
    ],
  },
  {
    id: 'lost_divers', category: 'rescue', steps: ['dive', 'home'], level: 10, pay: 640, xp: 520, flavors: [
      F('pearl_diver', 'The Deep Men', 'Люди глубины', '{giver}\'s crew went down to the wrecks and did not come up. Find what they found.', 'Команда ловца ({giver}) спустилась к затонувшим судам и не поднялась. Найдите то, что нашли они.'),
      F('widow', 'What the Sea Keeps', 'Что хранит море', '{giver}\'s husband drowned with his ship. She wants his ring from the wreck.', 'Муж этой вдовы ({giver}) утонул вместе с кораблём. Она хочет его кольцо с затонувшего судна.'),
      F('shipwright', 'Timbers from Below', 'Брёвна со дна', '{giver} wants old oak from the wrecks. Send your divers down.', '{giver} хочет старый дуб с затонувших судов. Спустите водолазов.'),
      F('merchant', 'A Lost Strongbox', 'Потерянный сундук', 'A strongbox of {giver}\'s went down in a wreck. There is a share in it for you.', 'Сундук купца ({giver}) ушёл на дно с кораблём. Вам — доля.'),
      F('old_salt', 'Old Wrecks', 'Старые обломки', '{giver} knows every wreck on this coast. Dive them before the sand does.', '{giver} знает каждое затонувшее судно у этого берега. Спуститесь, пока их не занёс песок.'),
    ],
  },
  {
    id: 'shipwrecked', category: 'rescue', steps: ['reach', 'land_any', 'home'], level: 14, pay: 880, xp: 700, flavors: [
      F('harbour_master', 'The Missing Brig', 'Пропавший бриг', 'A brig out of {port} was lost in {region}. {giver} believes survivors reached {island}.', 'Бриг из порта {port} пропал в водах «{region}». {giver} верит, что выжившие добрались до острова {island}.'),
      F('widow', 'Across the Water', 'Через море', '{giver} dreams of her husband alive on {island}, far out in {region}.', '{giver} видит во сне мужа живым на острове {island}, далеко в водах «{region}».'),
      F('cartographer', 'The Survey Ship', 'Экспедиционное судно', '{giver}\'s survey ship vanished in {region}. Her last bearing pointed to {island}.', 'Судно картографа ({giver}) исчезло в водах «{region}». Последний пеленг указывал на остров {island}.'),
      F('whaler', 'The Whaleboat', 'Китобойная шлюпка', 'A whaleboat was blown to {region}. {giver} saw it make for {island}.', 'Китобойную шлюпку унесло в воды «{region}». {giver} видел, как она шла к острову {island}.'),
      F('priest', 'The Missionaries', 'Миссионеры', 'Missionaries sailed for {region} and were never heard from. Look on {island}.', 'Миссионеры ушли в воды «{region}» и пропали. Ищите на острове {island}.'),
    ],
  },
  // ---------------------------------------------------------------- scouting
  {
    id: 'chart_waters', category: 'scouting', steps: ['chart', 'home'], level: 2, pay: 300, xp: 320, flavors: [
      F('cartographer', 'Blank Spaces', 'Белые пятна', '{giver}\'s chart has too many blank spaces. Fill them.', 'На карте картографа ({giver}) слишком много белых пятен. Заполните их.'),
      F('merchant', 'New Markets', 'Новые рынки', '{giver} wants to know what lies beyond the known lanes.', '{giver} хочет знать, что лежит за известными путями.'),
      F('lighthouse_keeper', 'Rocks in the Dark', 'Камни в темноте', '{giver} wants every rock charted before another ship finds one.', '{giver} хочет, чтобы каждый камень был на карте прежде, чем на него налетит ещё корабль.'),
      F('old_salt', 'Where I Never Went', 'Где я не бывал', '{giver} never saw the islands past the horizon. Tell him of them.', '{giver} так и не увидел острова за горизонтом. Расскажите ему о них.'),
      F('harbour_master', 'The Pilot Book', 'Лоцманская книга', '{giver} is writing a pilot book and needs new islands for it.', '{giver} пишет лоцманскую книгу, и ему нужны новые острова.'),
    ],
  },
  {
    id: 'far_reach', category: 'scouting', steps: ['reach', 'time_in', 'home'], level: 12, pay: 720, xp: 640, flavors: [
      F('cartographer', 'Beyond the Lanes', 'За пределами путей', '{giver} needs soundings from {region}. Stay long enough to take them.', 'Картографу ({giver}) нужны промеры из вод «{region}». Задержитесь, чтобы их снять.'),
      F('envoy', 'The Far Coast', 'Дальний берег', '{giver} must know what moves in {region} before the council sits.', '{giver} должен знать, что творится в водах «{region}», до заседания совета.'),
      F('whaler', 'The Whale Road', 'Китовый путь', '{giver} says the whales have gone to {region}. See for yourself.', '{giver} говорит, что киты ушли в воды «{region}». Посмотрите сами.'),
      F('garrison_captain', 'Reconnaissance', 'Разведка', '{giver} wants eyes in {region}: how many sails, whose flags.', 'Капитану гарнизона ({giver}) нужны глаза в водах «{region}»: сколько парусов, чьи флаги.'),
      F('cultist', 'The Listening', 'Вслушивание', '{giver} says the sea speaks in {region}. Go and listen.', '{giver} говорит, что море говорит в водах «{region}». Идите и слушайте.'),
    ],
  },
  {
    id: 'survey', category: 'scouting', steps: ['land_any', 'land_any2', 'home'], level: 6, pay: 480, xp: 460, flavors: [
      F('cartographer', 'Two Islands', 'Два острова', '{giver} needs landings on {island} and {island2} to fix the chart.', 'Картографу ({giver}) нужны высадки на островах {island} и {island2}, чтобы выверить карту.'),
      F('shipwright', 'Good Timber', 'Добрый лес', '{giver} wants to know if {island} or {island2} has timber worth cutting.', '{giver} хочет знать, есть ли на островах {island} или {island2} лес, годный в дело.'),
      F('merchant', 'A Place to Trade', 'Место для торговли', '{giver} seeks a place for a trading post: {island} or {island2}.', '{giver} ищет место для фактории: остров {island} или {island2}.'),
      F('priest', 'A Place for a Chapel', 'Место для часовни', '{giver} wants a chapel on one of two islands: {island} or {island2}.', '{giver} хочет поставить часовню на одном из островов: {island} или {island2}.'),
      F('garrison_captain', 'Sites for a Battery', 'Место для батареи', '{giver} is looking for a battery site. Land on {island} and {island2}.', '{giver} ищет место для батареи. Высадитесь на островах {island} и {island2}.'),
    ],
  },
  {
    id: 'storm_watch', category: 'scouting', steps: ['time_in', 'home'], level: 4, pay: 360, xp: 340, flavors: [
      F('lighthouse_keeper', 'Weather Log', 'Журнал погоды', '{giver} keeps a weather log and needs a captain\'s days in {region}.', '{giver} ведёт журнал погоды, и ему нужны капитанские записи из вод «{region}».'),
      F('old_salt', 'Reading the Sea', 'Читать море', '{giver} says you cannot know {region} until you have sailed it a while.', '{giver} говорит: воды «{region}» не узнать, пока в них не походишь.'),
      F('whaler', 'Spouts', 'Фонтаны', '{giver} wants a count of spouts in {region}.', 'Китобою ({giver}) нужен счёт фонтанов в водах «{region}».'),
      F('harbour_master', 'The Tide Tables', 'Таблицы приливов', '{giver} is fixing the tide tables for {region}.', '{giver} выверяет таблицы приливов для вод «{region}».'),
      F('cartographer', 'Currents', 'Течения', '{giver} maps the currents of {region}. Drift with them a while.', '{giver} наносит на карту течения в водах «{region}». Походите по ним.'),
    ],
  },
  // ---------------------------------------------------------------- smuggling
  {
    id: 'run_contraband', category: 'smuggling', steps: ['contraband', 'home'], level: 6, pay: 560, xp: 420, where: 'unsafe', flavors: [
      F('smuggler', 'Quiet Cargo', 'Тихий груз', '{giver} has buyers in {port2} for what the customs men do not like.', 'У контрабандиста ({giver}) в порту {port2} есть покупатели на то, что не любит таможня.'),
      F('fence', 'Moving Goods', 'Сбыт', '{giver} needs contraband moved through {port2}.', 'Скупщику ({giver}) нужно сбыть контрабанду через порт {port2}.'),
      F('tavern_keeper', 'The Cellar', 'Погреб', '{giver}\'s cellar is empty; {port2} will buy what fills it.', 'Погреб трактирщика ({giver}) пуст; в порту {port2} купят то, чем его наполняют.'),
      F('old_salt', 'Like the Old Days', 'Как в былые времена', '{giver} ran contraband to {port2} in his youth. He wants to hear it still can be done.', '{giver} в молодости возил контрабанду в порт {port2}. Он хочет услышать, что это ещё можно.'),
      F('merchant', 'Off the Books', 'Мимо книг', '{giver} does some trade off the books through {port2}.', '{giver} ведёт кое-какую торговлю мимо книг через порт {port2}.'),
    ],
  },
  {
    id: 'customs_dodge', category: 'smuggling', steps: ['customs', 'deliver2', 'home'], goods: ['tobacco', 'rum', 'cloth'], level: 8, pay: 580, xp: 440, flavors: [
      F('smuggler', 'Clean Papers', 'Чистые бумаги', 'Show {giver} you can face a customs cutter and keep your hold, then carry {good} to {port2}.', 'Покажите контрабандисту ({giver}), что выдержите досмотр и сохраните трюм, — потом отвезите товар «{good}» в порт {port2}.'),
      F('merchant', 'Honest Face', 'Честное лицо', '{giver} wants a captain the customs men trust. Pass an inspection and deliver to {port2}.', '{giver} хочет капитана, которому верит таможня. Пройдите досмотр и доставьте груз в порт {port2}.'),
      F('fence', 'The Test', 'Проверка', 'Before {giver} trusts you with real goods: a clean inspection and a load to {port2}.', 'Прежде чем скупщик ({giver}) доверит настоящий товар: чистый досмотр и груз в порт {port2}.'),
      F('harbour_master', 'By the Book', 'По закону', '{giver} runs a clean harbour. Pass inspection, then take {good} to {port2}.', '{giver} держит чистую гавань. Пройдите досмотр, потом отвезите товар «{good}» в порт {port2}.'),
      F('envoy', 'Diplomatic Bags', 'Дипломатический груз', '{giver} sends {good} to {port2} as a gift — and the customs must see it is clean.', '{giver} посылает товар «{good}» в порт {port2} в дар — и таможня должна убедиться, что всё чисто.'),
    ],
  },
  {
    id: 'cove_drop', category: 'smuggling', steps: ['pickup', 'deliver2', 'home'], goods: ['dreamleaf', 'tobacco'], level: 10, pay: 720, xp: 500, where: 'unsafe', flavors: [
      F('smuggler', 'The Drop', 'Закладка', 'Take {good} from {port} to {port2}. Do not open it; do not lose it.', 'Отвезите товар «{good}» из порта {port} в {port2}. Не открывать, не терять.'),
      F('fence', 'Package', 'Посылка', '{giver} has a package for a friend in {port2}.', 'У скупщика ({giver}) посылка для друга в порту {port2}.'),
      F('apothecary', 'Special Herbs', 'Особые травы', '{giver}\'s special herbs are wanted in {port2}. Very wanted.', 'Особые травы аптекаря ({giver}) нужны в порту {port2}. Очень нужны.'),
      F('tavern_keeper', 'Under the Counter', 'Из-под прилавка', 'What {giver} sells under the counter, {port2} sells too.', 'Что трактирщик ({giver}) продаёт из-под прилавка, продают и в порту {port2}.'),
      F('cultist', 'The Dreaming Leaf', 'Лист сновидений', '{giver} sends the dreaming leaf to the faithful in {port2}.', '{giver} посылает лист сновидений верным в порт {port2}.'),
    ],
  },
  {
    id: 'smugglers_friend', category: 'smuggling', steps: ['land_site', 'contraband', 'home'], site: 'smugglers', level: 9, pay: 640, xp: 520, where: 'unsafe', flavors: [
      F('smuggler', 'The Beach Camp', 'Лагерь на пляже', '{giver}\'s friends wait at the {site} on {island}. Meet them, then sell what they give you at {port2}.', 'Друзья контрабандиста ({giver}) ждут у места «{site}» на острове {island}. Встретьтесь, потом сбудьте полученное в порту {port2}.'),
      F('fence', 'An Introduction', 'Знакомство', '{giver} will introduce you to the {site} on {island}, and to buyers in {port2}.', '{giver} сведёт вас с людьми у места «{site}» на острове {island} и с покупателями в порту {port2}.'),
      F('old_salt', 'Old Company', 'Старая компания', '{giver}\'s old company still camps at the {site} on {island}.', 'Старая компания моряка ({giver}) до сих пор стоит лагерем у места «{site}» на острове {island}.'),
      F('tavern_keeper', 'Supply Line', 'Линия поставок', '{giver} gets his rum from the {site} on {island} and sells in {port2}.', '{giver} берёт ром у места «{site}» на острове {island} и продаёт в порту {port2}.'),
      F('merchant', 'A Second Ledger', 'Вторая книга', '{giver} keeps a second ledger for the {site} on {island}.', '{giver} ведёт вторую книгу для дел у места «{site}» на острове {island}.'),
    ],
  },
  // ---------------------------------------------------------------- treasure
  {
    id: 'treasure_rumor', category: 'treasure', steps: ['land_any', 'dive', 'home'], level: 10, pay: 700, xp: 620, flavors: [
      F('old_salt', 'The Old Story', 'Старая история', '{giver} swears the captain of an old wreck buried gold on {island} and sank nearby.', '{giver} клянётся, что капитан старого судна зарыл золото на острове {island} и затонул неподалёку.'),
      F('cartographer', 'The Marked Chart', 'Карта с отметкой', '{giver} found a mark on an old chart: {island}, and a wreck close by.', '{giver} нашёл отметку на старой карте: остров {island} и затонувшее судно рядом.'),
      F('tavern_keeper', 'Drunk Talk', 'Пьяные разговоры', 'A drunk in {giver}\'s tavern talked of {island} and a wreck. Then he vanished.', 'Пьяница в трактире ({giver}) болтал об острове {island} и затонувшем судне. Потом исчез.'),
      F('pearl_diver', 'Glint Below', 'Блеск внизу', '{giver} saw a glint below the waters off {island}.', '{giver} видел блеск под водой у острова {island}.'),
      F('widow', 'His Secret', 'Его тайна', '{giver}\'s husband kept a secret about {island}. She wants it found.', 'Муж этой вдовы ({giver}) хранил тайну острова {island}. Она хочет её раскрыть.'),
    ],
  },
  {
    id: 'relic_hunt', category: 'treasure', steps: ['land_site', 'home'], site: 'ruins', level: 16, pay: 900, xp: 760, where: 'strange', flavors: [
      F('cultist', 'The Relic', 'Реликвия', '{giver} wants a relic from the {site} on {island}. Do not look at it too long.', '{giver} хочет реликвию из места «{site}» на острове {island}. Не смотрите на неё слишком долго.'),
      F('priest', 'Holy Ground', 'Святая земля', 'The {site} on {island} was holy once. {giver} wants to know what is left.', 'Место «{site}» на острове {island} когда-то было святым. {giver} хочет знать, что осталось.'),
      F('cartographer', 'Old Stones', 'Старые камни', '{giver} copies inscriptions. The {site} on {island} has some.', '{giver} переписывает надписи. У места «{site}» на острове {island} они есть.'),
      F('fence', 'Antiquities', 'Древности', '{giver} has a buyer for anything from the {site} on {island}.', 'У скупщика ({giver}) есть покупатель на всё из места «{site}» на острове {island}.'),
      F('hermit', 'What I Left Behind', 'Что я оставил', '{giver} fled the {site} on {island} years ago and left something there.', '{giver} много лет назад бежал из места «{site}» на острове {island} и кое-что там оставил.'),
    ],
  },
  {
    id: 'wreck_salvage', category: 'treasure', steps: ['dive', 'deliver2', 'home'], goods: ['planks', 'iron'], level: 12, pay: 760, xp: 600, flavors: [
      F('shipwright', 'Salvage', 'Подъём со дна', 'Dive the wrecks, says {giver}, then bring {good} to the yard at {port2}.', 'Спуститесь к затонувшим судам, говорит {giver}, потом доставьте товар «{good}» на верфь в порт {port2}.'),
      F('merchant', 'Salvage Rights', 'Право на подъём', '{giver} bought salvage rights and needs a diver captain.', '{giver} купил право на подъём, и ему нужен капитан с водолазами.'),
      F('harbour_master', 'Clear the Channel', 'Расчистить фарватер', 'Wrecks foul the channel. Dive them and bring {good} to {port2}.', 'Затонувшие суда загромождают фарватер. Спуститесь к ним и доставьте товар «{good}» в порт {port2}.'),
      F('pearl_diver', 'Deep Work', 'Глубокая работа', '{giver}\'s lungs are gone; yours are not. Dive, then deliver to {port2}.', 'Лёгкие ловца ({giver}) уже не те, а ваши — в порядке. Ныряйте, потом доставьте груз в порт {port2}.'),
      F('bosun', 'Spares', 'Запчасти', 'The fleet needs spares. {giver} says the wrecks have them — and {port2} wants {good}.', 'Флоту нужны запчасти. {giver} говорит, что они есть на затонувших судах, а в порту {port2} ждут товар «{good}».'),
    ],
  },
  // ---------------------------------------------------------------- diplomacy
  {
    id: 'envoy', category: 'diplomacy', steps: ['visit2', 'visit3', 'home'], level: 6, pay: 520, xp: 480, flavors: [
      F('envoy', 'Letters of State', 'Государственные письма', '{giver} carries letters for {port2} and {port3}, and needs a ship that will not be searched.', 'У посланника ({giver}) письма для портов {port2} и {port3}, и ему нужен корабль, который не станут обыскивать.'),
      F('merchant', 'Terms of Trade', 'Условия торговли', '{giver} proposes terms to the houses of {port2} and {port3}.', '{giver} предлагает условия торговым домам портов {port2} и {port3}.'),
      F('priest', 'The Synod', 'Синод', '{giver} calls a synod: carry the summons to {port2} and {port3}.', '{giver} созывает синод: отвезите приглашения в порты {port2} и {port3}.'),
      F('harbour_master', 'The Harbour League', 'Лига гаваней', '{giver} wants {port2} and {port3} in a league of harbours.', '{giver} хочет собрать порты {port2} и {port3} в лигу гаваней.'),
      F('garrison_captain', 'Dispatches', 'Донесения', '{giver} sends dispatches to {port2} and {port3}.', '{giver} шлёт донесения в порты {port2} и {port3}.'),
    ],
  },
  {
    id: 'peace_offering', category: 'diplomacy', steps: ['deliver2', 'home'], goods: ['rum', 'spices', 'cloth', 'pearls'], level: 8, pay: 600, xp: 460, flavors: [
      F('envoy', 'A Peace Offering', 'Дар примирения', '{giver} sends {good} to {port2} to mend an old quarrel.', '{giver} посылает товар «{good}» в порт {port2}, чтобы уладить старую ссору.'),
      F('merchant', 'Goodwill', 'Добрая воля', 'Goodwill in {port2} is worth a gift of {good}, says {giver}.', 'Добрая воля порта {port2} стоит подарка — товара «{good}», — говорит {giver}.'),
      F('priest', 'Reconciliation', 'Примирение', '{giver} would reconcile two harbours with a gift to {port2}.', '{giver} хочет примирить две гавани даром для порта {port2}.'),
      F('widow', 'An Apology', 'Извинение', '{giver}\'s late husband wronged someone in {port2}. She wants to make it right.', 'Покойный муж этой вдовы ({giver}) обидел кого-то в порту {port2}. Она хочет всё исправить.'),
      F('tavern_keeper', 'A Wedding Gift', 'Свадебный подарок', '{giver}\'s daughter marries in {port2}. The gift must arrive before she does.', 'Дочь трактирщика ({giver}) выходит замуж в порту {port2}. Подарок должен успеть раньше неё.'),
    ],
  },
  {
    id: 'letters', category: 'diplomacy', steps: ['visit2', 'home'], level: 1, pay: 220, xp: 160, flavors: [
      F('widow', 'A Letter', 'Письмо', '{giver} has a letter for {port2}. She will not say to whom.', 'У вдовы ({giver}) письмо в порт {port2}. Кому — не говорит.'),
      F('old_salt', 'Word to a Friend', 'Весточка другу', '{giver} has word for an old friend in {port2}.', 'У моряка ({giver}) весточка для старого друга в порту {port2}.'),
      F('harbour_master', 'The Pilot\'s Notice', 'Извещение лоцманам', '{giver} sends a notice to the pilots of {port2}.', '{giver} посылает извещение лоцманам порта {port2}.'),
      F('merchant', 'A Bill of Exchange', 'Вексель', '{giver} has a bill of exchange to present in {port2}.', 'У купца ({giver}) вексель, который надо предъявить в порту {port2}.'),
      F('fishwife', 'News of the Catch', 'Вести об улове', '{giver} sends word to {port2} that the shoals have turned.', '{giver} шлёт весть в порт {port2}: косяки повернули.'),
    ],
  },
  // ---------------------------------------------------------------- revenge
  {
    id: 'revenge', category: 'revenge', steps: ['sink_any', 'board', 'home'], level: 14, pay: 860, xp: 720, where: 'unsafe', flavors: [
      F('widow', 'Blood for Blood', 'Кровь за кровь', '{giver}\'s husband was killed in {region}. She wants ships sunk and a crew taken.', 'Мужа этой вдовы ({giver}) убили в водах «{region}». Она хочет потопленных кораблей и захваченную команду.'),
      F('bosun', 'My Captain', 'Мой капитан', '{giver}\'s captain died in {region}. The bosun has not forgotten.', 'Капитан боцмана ({giver}) погиб в водах «{region}». Боцман не забыл.'),
      F('smuggler', 'Crossed', 'Предательство', '{giver} was crossed by a crew that sails {region}. Teach them.', 'Контрабандиста ({giver}) предала команда, что ходит в водах «{region}». Проучите их.'),
      F('garrison_captain', 'The Garrison\'s Honour', 'Честь гарнизона', 'A ship of the garrison was lost in {region}. {giver} wants an answer.', 'Корабль гарнизона пропал в водах «{region}». {giver} хочет ответа.'),
      F('old_salt', 'Settle It', 'Свести счёты', '{giver} lost everything in {region}. He wants it settled before he dies.', '{giver} потерял всё в водах «{region}». Он хочет свести счёты перед смертью.'),
    ],
  },
  // ---------------------------------------------------------------- investigation
  {
    id: 'investigation', category: 'investigation', steps: ['land_any', 'land_any2', 'visit2', 'home'], level: 11, pay: 820, xp: 700, flavors: [
      F('garrison_captain', 'Who Sank the Mary?', 'Кто потопил «Мэри»?', 'A ship was found burned. {giver} suspects men hiding on {island} or {island2}, with friends in {port2}.', 'Нашли сгоревший корабль. {giver} подозревает людей, прячущихся на островах {island} или {island2}, с друзьями в порту {port2}.'),
      F('merchant', 'Missing Cargo', 'Пропавший груз', '{giver}\'s cargo disappeared. The trail leads to {island}, {island2} and {port2}.', 'Груз купца ({giver}) пропал. След ведёт на острова {island}, {island2} и в порт {port2}.'),
      F('priest', 'The Heretics', 'Еретики', '{giver} hears of heretics on {island} and {island2}, and a patron in {port2}.', '{giver} слышал о еретиках на островах {island} и {island2} и о покровителе в порту {port2}.'),
      F('harbour_master', 'False Lights', 'Ложные огни', 'Someone shows false lights to wreck ships. {giver} suspects {island}, {island2}, and a buyer in {port2}.', 'Кто-то зажигает ложные огни, чтобы разбивать корабли. {giver} подозревает острова {island}, {island2} и скупщика в порту {port2}.'),
      F('cultist', 'The Whispers', 'Шёпот', '{giver} follows whispers from {island} and {island2} to a door in {port2}.', '{giver} идёт за шёпотом с островов {island} и {island2} к двери в порту {port2}.'),
    ],
  },
];

// ------------------------------------------------------------------ the generator

const PER_PORT = 70;

export interface GenParams {
  giver: string;
  profession: Profession;
  port: Port;
  port2?: Port;
  port3?: Port;
  island?: Island;
  island2?: Island;
  site?: string;
  good?: GoodId;
  n: number;
  region: RegionId;
}

/** Fill a template's named places with values (English names; the client translates them). */
export function fill(t: string, v: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
}

function safetyOk(plot: Plot, port: Port): boolean {
  const reg = REGIONS[port.region];
  switch (plot.where ?? 'any') {
    case 'safe':
      return reg.safety === 'safe' || reg.safety === 'contested';
    case 'unsafe':
      return reg.safety !== 'safe';
    case 'lawless':
      return reg.safety === 'lawless';
    case 'strange':
      return reg.strangeness >= 0.2;
    default:
      return true;
  }
}

const REGION_LEVEL: Record<string, number> = { safe: 0, contested: 6, lawless: 14 };

/** Every generated quest on a world: about seventy per port, the same for every server on this seed. */
export function generateQuests(world: World, seed: number): QuestDef[] {
  const out: QuestDef[] = [];
  const ports = world.ports;
  const lifeCache = new Map<number, string[]>();
  const sitesOf = (is: Island): string[] => {
    let hit = lifeCache.get(is.id);
    if (!hit) {
      hit = islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: Math.round(is.radius), poly: is.poly, features: is.features, portId: is.portId }).map((s) => s.kind);
      lifeCache.set(is.id, hit);
    }
    return hit;
  };
  for (const port of ports) {
    const rng = new Rng((hashString(port.id) ^ (seed * 2654435761)) >>> 0);
    const home = world.islands[port.islandId];
    const near = ports.filter((p) => p.id !== port.id).map((p) => ({ p, d: Math.hypot(p.x - port.x, p.y - port.y) })).sort((a, b) => a.d - b.d).map((x) => x.p);
    const islandsNear = world.islands.filter((is) => !is.portId && is.id !== home?.id && Math.hypot(is.x - port.x, is.y - port.y) < 26000);
    const plots = PLOTS.filter((pl) => safetyOk(pl, port));
    const levelBase = REGION_LEVEL[REGIONS[port.region].safety] ?? 0;
    let made = 0;
    for (let round = 0; made < PER_PORT && round < 6; round++) {
      for (const plot of [...plots].sort(() => rng.float() - 0.5)) {
        if (made >= PER_PORT) break;
        const k = Math.floor(rng.float() * plot.flavors.length);
        const flavor = plot.flavors[k];
        const params = rollParams(rng, plot, flavor, port, near, islandsNear, sitesOf);
        if (!params) continue;
        const id = `g_${port.id}_${plot.id}_${k}_${round}`;
        if (out.some((q) => q.id === id)) continue;
        out.push(build(id, plot, flavor, params, levelBase));
        made++;
      }
    }
  }
  return out;
}

function rollParams(rng: Rng, plot: Plot, flavor: Flavor, port: Port, near: Port[], islands: Island[], sitesOf: (is: Island) => string[]): GenParams | null {
  const sex = PROFESSION_SEX[flavor.giver];
  const giver = `${rng.pick(sex === 'f' ? GIVER_WOMEN : sex === 'm' ? GIVER_MEN : GIVER_FIRST)} ${rng.pick(GIVER_LAST)}`;
  const reach = near.slice(0, 8);
  const port2 = reach.length ? rng.pick(reach) : undefined;
  const port3 = reach.filter((p) => p !== port2).length ? rng.pick(reach.filter((p) => p !== port2)) : undefined;
  const good = plot.goods ? rng.pick(plot.goods) : undefined;
  const needs = (k: StepKind) => plot.steps.includes(k);
  if ((needs('visit2') || needs('deliver2') || needs('contraband')) && !port2) return null;
  if ((needs('visit3') || needs('deliver3')) && !port3) return null;
  let island: Island | undefined, island2: Island | undefined, site: string | undefined;
  if (needs('land_site')) {
    const want = plot.site;
    const fits = (is: Island): string | undefined => {
      const here = [...is.features, ...sitesOf(is)];
      if (want === 'people') return here.find((f) => f === 'fishers' || f === 'smugglers');
      if (want === 'beasts') return here.find((f) => f === 'seals' || f === 'crabs' || f === 'turtles');
      if (want === 'ruins') return here.find((f) => f === 'ruins' || f === 'shrine' || f === 'bell');
      return here.find((f) => f === want);
    };
    const cands = islands.filter((is) => fits(is));
    if (!cands.length) return null;
    island = rng.pick(cands);
    site = fits(island);
  } else if (needs('land_any')) {
    const cands = islands.filter((is) => is.features.some((f) => f !== 'port') || sitesOf(is).some((s) => s !== 'gulls'));
    if (!cands.length) return null;
    island = rng.pick(cands);
  }
  if (needs('land_any2')) {
    const cands = islands.filter((is) => is !== island && (is.features.some((f) => f !== 'port') || sitesOf(is).some((s) => s !== 'gulls')));
    if (!cands.length) return null;
    island2 = rng.pick(cands);
  }
  // A far region for the scouting and rescue plots, the home region for the hunts.
  const far = needs('reach');
  const region: RegionId = far ? rng.pick(Object.keys(REGIONS).filter((r) => r !== port.region) as RegionId[]) : port.region;
  if (far && island) {
    // The island lies in that region.
    const inReg = islands.filter((is) => is.region === region);
    if (inReg.length) island = rng.pick(inReg);
  }
  const counted = plot.steps.some((s) => s.startsWith('sink') || s === 'board' || s === 'prize' || s === 'dive' || s === 'chart' || s === 'contraband');
  const n = needs('pickup') || needs('deliver2') || needs('deliver3') ? rng.int(4, 12) * (good === 'pearls' || good === 'medicine' ? 1 : 2)
    : needs('time_in') ? rng.int(3, 8)
    : counted ? rng.int(1, needs('chart') ? 6 : needs('contraband') ? 10 : 3) : 1;
  void flavor;
  return { giver, profession: flavor.giver, port, port2, port3, island, island2, site, good, n, region };
}

function build(id: string, plot: Plot, flavor: Flavor, p: GenParams, levelBase: number): QuestDef {
  const v: Record<string, string> = {
    giver: p.giver, port: p.port.name, port2: p.port2?.name ?? '', port3: p.port3?.name ?? '', island: p.island?.name ?? '', island2: p.island2?.name ?? '',
    good: p.good ? GOODS[p.good].name : '', n: String(p.n), region: REGIONS[p.region].name, site: p.site ? SITE_NAMES[p.site] ?? p.site : '',
  };
  const steps: QuestStep[] = plot.steps.map((k) => stepOf(k, p, fill(STEP_TEXT[k][0], v)));
  const level = Math.max(1, plot.level + levelBase);
  const scale = 1 + level / 10;
  return {
    id, kind: 'job', name: fill(flavor.name[0], v), mentor: `${p.giver}, ${PROFESSIONS[p.profession][0]}`, port: p.port.id,
    summary: fill(flavor.summary[0], v), requires: { level },
    steps, reward: { xp: Math.round(plot.xp * scale), silver: Math.round(plot.pay * scale) },
    category: plot.category, template: `${plot.id}.${plot.flavors.indexOf(flavor)}`, portrait: giverPortrait(p.profession, p.giver),
  };
}

function stepOf(k: StepKind, p: GenParams, text: string): QuestStep {
  switch (k) {
    case 'pickup':
      return { type: 'pickup', port: p.port.id, good: p.good!, qty: p.n, text };
    case 'deliver2':
      return { type: 'deliver', port: p.port2!.id, good: p.good!, qty: p.n, text };
    case 'deliver3':
      return { type: 'deliver', port: p.port3!.id, good: p.good!, qty: p.n, text };
    case 'visit2':
      return { type: 'visit', port: p.port2!.id, text };
    case 'visit3':
      return { type: 'visit', port: p.port3!.id, text };
    case 'home':
      return { type: 'visit', port: p.port.id, text };
    case 'back':
      return { type: 'land', island: p.island!.id, site: p.site, text };
    case 'sink_pirates':
      return { type: 'sink', count: p.n, role: 'pirate', region: p.region, text };
    case 'sink_ghosts':
      return { type: 'sink', count: p.n, role: 'ghost', text };
    case 'sink_hunters':
      return { type: 'sink', count: p.n, role: 'patrol', text };
    case 'sink_any':
      return { type: 'sink', count: p.n, region: p.region, text };
    case 'board':
      return { type: 'board', count: p.n, text };
    case 'prize':
      return { type: 'prize', count: p.n, text };
    case 'land_site':
      return { type: 'land', island: p.island!.id, site: p.site, text };
    case 'land_any':
      return { type: 'land', island: p.island!.id, text };
    case 'land_any2':
      return { type: 'land', island: p.island2!.id, text };
    case 'dive':
      return { type: 'dive', count: p.n, text };
    case 'chart':
      return { type: 'chart', count: p.n, text };
    case 'reach':
      return { type: 'reach', region: p.region, text };
    case 'time_in':
      return { type: 'time_in', region: p.region, seconds: p.n * 60, text };
    case 'contraband':
      return { type: 'sell_contraband', qty: p.n, port: p.port2!.id, text };
    case 'customs':
      return { type: 'customs', text };
  }
}

/** The plots an island's people can give (no other island in them: the giver's own is where it ends). */
const ISLAND_PLOTS = ['supply', 'letters', 'pirate_hunt', 'chart_waters', 'lost_divers', 'storm_watch', 'run_contraband'];

/** Jobs from the people of the islands (docs/11 P4): one a peopled island, given when a party lands at their
 *  hamlet or camp, ending back on their beach. */
export function generateIslandJobs(world: World, seed: number): QuestDef[] {
  const out: QuestDef[] = [];
  for (const is of world.islands) {
    if (is.portId) continue;
    const people = islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: Math.round(is.radius), poly: is.poly, features: is.features, portId: is.portId })
      .find((s) => s.kind === 'fishers' || s.kind === 'smugglers');
    if (!people) continue;
    const rng = new Rng((is.id * 7919 + seed * 31 + 3) >>> 0);
    const near = world.ports.slice().sort((a, b) => Math.hypot(a.x - is.x, a.y - is.y) - Math.hypot(b.x - is.x, b.y - is.y));
    const port = near[0];
    const plots = PLOTS.filter((pl) => ISLAND_PLOTS.includes(pl.id) && (people.kind === 'smugglers' || pl.id !== 'run_contraband'));
    const plot = rng.pick(plots);
    const flavors = plot.flavors.filter((f) => (people.kind === 'fishers' ? ['fishwife', 'old_salt', 'widow', 'priest', 'harbour_master'] : ['smuggler', 'fence', 'old_salt', 'tavern_keeper']).includes(f.giver));
    const flavor = flavors.length ? rng.pick(flavors) : plot.flavors[0];
    const params = rollParams(rng, plot, flavor, port, near.slice(1, 9), [], () => []);
    if (!params) continue;
    params.island = is;
    params.site = people.kind;
    const q = build(`i_${is.id}`, { ...plot, steps: plot.steps.map((k) => (k === 'home' ? 'back' : k)) }, flavor, params, REGION_LEVEL[REGIONS[is.region].safety] ?? 0);
    out.push({ ...q, island: is.id });
  }
  return out;
}

/** Sites by the English names the server writes (the client translates them as names). */
export const SITE_NAMES: Record<string, string> = {
  fishers: 'fishing hamlet', smugglers: "smugglers' camp", pirate_camp: 'pirate camp', garrison: 'garrisoned fort', seals: 'seal colony', crabs: 'crab beach', turtles: 'turtle beach',
  ruins: 'ruins', shrine: 'drowned shrine', bell: 'drowned bell tower',
};

/** A template pair with its named places numbered by their first use in the English. */
export function numberedPattern(en: string, ru: string): [string, string] {
  const names: string[] = [];
  const num = (s: string, collect: boolean) => s.replace(/\{(\w+)\}/g, (_, k: string) => {
    let i = names.indexOf(k);
    if (i < 0 && collect) {
      names.push(k);
      i = names.length - 1;
    }
    return `{${i}}`;
  });
  const e = num(en, true);
  return [e, num(ru, false)];
}

/** Every template's English and Russian texts, for the translation patterns (placeholders numbered by first use). */
export function questPatterns(): [string, string][] {
  const out: [string, string][] = [];
  const add = (en: string, ru: string) => out.push(numberedPattern(en, ru));
  for (const pl of PLOTS) for (const f of pl.flavors) {
    add(f.name[0], f.name[1]);
    add(f.summary[0], f.summary[1]);
  }
  for (const [en, ru] of Object.values(STEP_TEXT)) add(en, ru);
  for (const [en, ru] of Object.values(PROFESSIONS)) add(`{giver}, ${en}`, `{giver}, ${ru}`);
  return out;
}
