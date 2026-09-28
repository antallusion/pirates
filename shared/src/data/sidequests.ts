// Side quests with perks (docs/12 P9): tattoos — a captain's perks, inked by Old Needle in the Brethren's havens for
// deeds done at sea and for chains of side quests; the chains themselves, written by hand, each with its giver in a
// port; and hidden quests that begin with something a captain does rather than someone who asks.

import type { QuestDef, QuestStep } from './quests.ts';
import type { Flag, StatMods } from './stats.ts';

export type Tr = [string, string];

// ------------------------------------------------------------------------------------------------ tattoos

export type TattooTrigger =
  | { kind: 'chain'; chain: string }
  | { kind: 'miles'; km: number }
  | { kind: 'storm' }
  | { kind: 'crossing' }
  | { kind: 'abyss' }
  | { kind: 'fought'; n: number }
  | { kind: 'beasts'; n: number }
  | { kind: 'flensed'; n: number }
  | { kind: 'hits'; n: number }
  | { kind: 'charted'; n: number }
  | { kind: 'wonders'; n: number }
  | { kind: 'sirens'; n: number }
  | { kind: 'dives'; n: number }
  | { kind: 'rescued'; n: number }
  | { kind: 'star' }
  | { kind: 'boss' }
  | { kind: 'level'; n: number }
  | { kind: 'island' };

export interface TattooDef {
  id: string;
  name: Tr;
  how: Tr;
  gives: Tr;
  trigger: TattooTrigger;
  mods?: StatMods;
  flags?: Flag[];
}

const T = (id: string, name: Tr, how: Tr, gives: Tr, trigger: TattooTrigger, mods?: StatMods, flags?: Flag[]): TattooDef => ({ id, name, how, gives, trigger, mods, flags });

export const TATTOOS: TattooDef[] = [
  T('swallow', ['Swallow', 'Ласточка'], ['Sail a thousand kilometres', 'Пройти тысячу километров'], ['+3% speed', '+3% к ходу'], { kind: 'miles', km: 1000 }, { maxSpeed: 0.03 }),
  T('anchor', ['Anchor', 'Якорь'], ['Ride out a Storm of the Century at sea', 'Пережить шторм века в море'], ['Storms do a third less to hull and sails', 'Шторм наносит корпусу и парусам на треть меньше'], { kind: 'storm' }, { stormHull: -0.3, stormSailDamage: -0.3 }),
  T('turtle', ['Turtle', 'Черепаха'], ['Sail from the northern ice to the southern coast', 'Пройти от северных льдов до южного берега'], ['The crew’s wits hold on a long voyage (sanity loss halved)', 'Рассудок команды держится в долгом пути (потеря вдвое меньше)'], { kind: 'crossing' }, { sanityLoss: -0.5 }),
  T('golden_dragon', ['Golden Dragon', 'Золотой дракон'], ['Reach the Abyss', 'Дойти до Бездны'], ['+5% plunder in lawless water', '+5% добычи в беззаконных водах'], { kind: 'abyss' }, undefined, ['tattoo_dragon']),
  T('fish', ['Fish', 'Рыба'], ['Mika the fisherman’s chain', 'Цепочка рыбака Мики'], ['+10% catch', '+10% улова'], { kind: 'chain', chain: 'mika' }, undefined, ['tattoo_fish']),
  T('hook', ['Hook', 'Крючок'], ['Land fifty fish on the line', 'Вывести на леске пятьдесят рыб'], ['A fish on the line is easier to play', 'Рыбу на леске вываживать легче'], { kind: 'fought', n: 50 }, undefined, ['tattoo_hook']),
  T('octopus', ['Octopus', 'Осьминог'], ['The lobsterman’s chain', 'Цепочка ловца омаров'], ['One more pot', 'Ещё одна ловушка'], { kind: 'chain', chain: 'lobster' }, undefined, ['tattoo_octopus']),
  T('orca', ['Orca', 'Касатка'], ['Hank the whaler’s chain', 'Цепочка китобоя Хэнка'], ['+10% damage against the beasts of the sea', '+10% урона по морским зверям'], { kind: 'chain', chain: 'hank' }, undefined, ['tattoo_orca']),
  T('white_fin', ['White Fin', 'Белый плавник'], ['Ingrid the orca-hunter’s chain', 'Цепочка охотницы на касаток Ингрид'], ['Orcas never strike first', 'Касатки никогда не нападают первыми'], { kind: 'chain', chain: 'ingrid' }, undefined, ['fh_white_orca']),
  T('harpoon', ['Harpoon', 'Гарпун'], ['Take twenty beasts of the sea', 'Добыть двадцать морских зверей'], ['The harpoon line parts 15% less readily', 'Линь рвётся на 15% реже'], { kind: 'beasts', n: 20 }, undefined, ['tattoo_harpoon']),
  T('shark_tooth', ['Shark’s Tooth', 'Акулий зуб'], ['Flense thirty carcasses', 'Разделать тридцать туш'], ['Sharks no longer get in the way of the flensing knives', 'Акулы больше не мешают разделке'], { kind: 'flensed', n: 30 }, undefined, ['tattoo_shark']),
  T('skull', ['Skull', 'Череп'], ['The Brethren’s quartermaster’s chain', 'Цепочка квартирмейстера Братства'], ['+4% boarding power', '+4% к натиску в абордаже'], { kind: 'chain', chain: 'quartermaster' }, { boardingPower: 0.04 }),
  T('sabres', ['Crossed Sabres', 'Скрещённые сабли'], ['The bounty hunter’s chain', 'Цепочка охотника за головами'], ['+5% in the captains’ duel and the melee', '+5% в дуэли капитанов и рукопашной'], { kind: 'chain', chain: 'hunter' }, { meleeDamage: 0.05 }),
  T('cannon', ['Cannon', 'Пушка'], ['Land a thousand hits', 'Попасть тысячу раз'], ['−4% reload', '−4% перезарядки'], { kind: 'hits', n: 1000 }, { reloadMul: -0.04 }),
  T('compass_rose', ['Compass Rose', 'Роза ветров'], ['Find ten wonders of the sea', 'Найти десять чудес моря'], ['Fog does not throw you off your course (+20% sight in fog)', 'Туман не сбивает с курса (+20% обзора в тумане)'], { kind: 'wonders', n: 10 }, { fogSight: 0.2 }),
  T('coin', ['Coin', 'Монета'], ['The League clerk’s chain', 'Торговая цепочка писаря Лиги'], ['+3% on what you sell', '+3% к цене продажи'], { kind: 'chain', chain: 'clerk' }, { sellMul: 0.03 }),
  T('mermaid', ['Mermaid', 'Русалка'], ['Live through the sirens three times', 'Трижды пережить сирен'], ['The sirens’ song does not reach your crew', 'Песнь сирен не действует на команду'], { kind: 'sirens', n: 3 }, undefined, ['tattoo_mermaid']),
  T('eye', ['Eye', 'Глаз'], ['The Choir chaplain’s chain', 'Цепочка капеллана Хора'], ['Ghosts and monsters show on the chart from afar', 'Призраки и чудовища видны на карте издалека'], { kind: 'chain', chain: 'chaplain' }, undefined, ['eyes_of_choir']),
  T('bell', ['Bell', 'Колокол'], ['Go down to ten wrecks in the diving bell', 'Опуститься в колоколе к десяти затонувшим судам'], ['+20% deeper in the bell', 'Колокол опускается на 20% глубже'], { kind: 'dives', n: 10 }, { diveDepth: 0.2 }),
  T('heart', ['Heart', 'Сердце'], ['Save fifty souls from the sea', 'Спасти из моря пятьдесят душ'], ['+10 morale whenever you put out of port', '+10 к морали при выходе из порта'], { kind: 'rescued', n: 50 }, undefined, ['tattoo_heart']),
  T('star', ['Star', 'Звезда'], ['Claim a fallen star', 'Забрать упавшую звезду'], ['+1 Luck: treasure comes a little easier', '+1 к Удаче: сокровища даются чуть легче'], { kind: 'star' }, { treasureHunter: 0.05 }),
  T('map', ['Old Map', 'Старая карта'], ['The cartographer’s chain', 'Цепочка картографа'], ['+10% to charting', '+10% к картографии'], { kind: 'chain', chain: 'cartographer' }, { cartography: 0.1 }),
  T('needle', ['Needle', 'Игла'], ['Old Needle’s own chain', 'Цепочка самой Старой Иглы'], ['One more place for a tattoo', 'Ещё одно место для татуировки'], { kind: 'chain', chain: 'needle' }),
  T('cat', ['Ship’s Cat', 'Корабельный кот'], ['The ship’s cat’s chain', 'Цепочка корабельного кота'], ['Rats keep off, and the crew’s spirits mend faster', 'Крысы держатся подальше, дух команды восстанавливается быстрее'], { kind: 'chain', chain: 'cat' }, { moraleRegen: 0.05 }, ['tattoo_cat']),
  T('lantern', ['Lantern', 'Фонарь'], ['“Who called?” — the chain from the fog', '«Кто звал?» — цепочка из тумана'], ['+15% sight in fog; the uncanny shakes the crew less', '+15% обзора в тумане; жуть меньше бьёт по команде'], { kind: 'chain', chain: 'fog' }, { fogSight: 0.15, mysticMorale: 0.1 }),
  T('bottle', ['Bottle', 'Бутылка'], ['The chain of the letters of the sea', 'Цепочка «Письма моря»'], ['+1 Luck: bottles and treasure', '+1 к Удаче: бутылки и клады'], { kind: 'chain', chain: 'letters' }, { treasureHunter: 0.05 }),
  T('dutchman', ['Flying Dutchman', 'Летучий Голландец'], ['The mystery of the Flying Dutchman', 'Тайна Летучего Голландца'], ['Ghost ships do not fire on you first', 'Корабли-призраки не стреляют первыми'], { kind: 'chain', chain: 'dutchman' }, undefined, ['tattoo_dutchman']),
  T('kraken', ['Kraken', 'Кракен'], ['Take part in killing a world boss', 'Участвовать в убийстве мирового босса'], ['+2% to armour', '+2% к броне'], { kind: 'boss' }, { armorPct: 0.02 }),
  T('crown', ['Crown', 'Корона'], ['Reach the fiftieth level', 'Достичь пятидесятого уровня'], ['+5 to the crew’s morale', '+5 к морали команды'], { kind: 'level', n: 50 }, { moraleBase: 5 }),
  T('rose', ['Rose', 'Роза'], ['Own an island', 'Стать хозяином острова'], ['−5% to the crew’s wages', '−5% к жалованью команды'], { kind: 'island' }, { wages: -0.05 }),
];

export const TATTOO_BY_ID: Record<string, TattooDef> = Object.fromEntries(TATTOOS.map((t) => [t.id, t]));

/** Places for tattoos: two at first, one more at levels 15, 30 and 45, and one for Old Needle's own. */
export function tattooSlots(level: number, owned: string[]): number {
  return 2 + (level >= 15 ? 1 : 0) + (level >= 30 ? 1 : 0) + (level >= 45 ? 1 : 0) + (owned.includes('needle') ? 1 : 0);
}

// ------------------------------------------------------------------------------------------------ the chains

type StepSpec = [Omit<QuestStep, 'text'>, Tr];

interface SideSpec {
  id: string;
  chain: string;
  port: string;
  giver: Tr;
  portrait: string;
  level: number;
  name: Tr;
  summary: Tr;
  steps: StepSpec[];
  xp: number;
  silver: number;
  tattoo?: string;
  choice?: boolean;
  after?: string;
}

const S = (s: SideSpec): SideSpec => s;

export const SIDE_SPECS: SideSpec[] = [
  // Mika the fisherman, Saltmarrow: the Fish.
  S({ id: 'side_mika_1', chain: 'mika', port: 'saltmarrow', giver: ['Mika the fisherman', 'Рыбак Мика'], portrait: 'giver_old_salt_m', level: 2, name: ['Mika’s Nets', 'Сети Мики'], summary: ['Old Mika’s back is bad and his nets are idle. Fill them for him.', 'У старого Мики болит спина, и сети простаивают. Наполните их за него.'], steps: [[{ type: 'catch', count: 30 } as never, ['Take fish: 30.', 'Наловите рыбы: 30.']], [{ type: 'deliver', port: 'saltmarrow', good: 'fish', qty: 20 } as never, ['Bring Mika 20 fish.', 'Привезите Мике 20 рыбы.']]], xp: 300, silver: 400 }),
  S({ id: 'side_mika_2', chain: 'mika', port: 'saltmarrow', giver: ['Mika the fisherman', 'Рыбак Мика'], portrait: 'giver_old_salt_m', level: 4, after: 'side_mika_1', name: ['The One That Got Away', 'Та, что ушла'], summary: ['Forty years ago a cod the size of a boy broke Mika’s line. He wants to see one like it before he dies.', 'Сорок лет назад треска размером с мальчишку оборвала Мике леску. Он хочет увидеть такую перед смертью.'], steps: [[{ type: 'catch', count: 1, minKg: 6 } as never, ['Land a fish of 6 kg or more on the line.', 'Выведите на леске рыбу от 6 кг.']], [{ type: 'visit', port: 'saltmarrow' } as never, ['Show it to Mika in Saltmarrow.', 'Покажите её Мике в Солтмарроу.']]], xp: 500, silver: 600, choice: true }),
  S({ id: 'side_mika_3', chain: 'mika', port: 'saltmarrow', giver: ['Mika the fisherman', 'Рыбак Мика'], portrait: 'giver_old_salt_m', level: 6, after: 'side_mika_2', name: ['Salt for the Winter', 'Соль на зиму'], summary: ['The village must eat through the winter. Mika asks for salted fish — and gives you his own mark in return.', 'Деревне надо пережить зиму. Мика просит солёной рыбы — и в благодарность отдаёт свою метку.'], steps: [[{ type: 'deliver', port: 'saltmarrow', good: 'salted_fish', qty: 20 } as never, ['Bring 20 salted fish to Saltmarrow.', 'Привезите в Солтмарроу 20 солёной рыбы.']]], xp: 800, silver: 900, tattoo: 'fish' }),
  // The lobsterman, Blackwater: the Octopus.
  S({ id: 'side_lobster_1', chain: 'lobster', port: 'blackwater', giver: ['Pell the lobsterman', 'Ловец омаров Пелл'], portrait: 'giver_fishwife_f', level: 15, name: ['Pots on the Shallows', 'Ловушки на отмели'], summary: ['Pell’s pots were stolen. Set your own and bring her the catch.', 'У Пелл украли ловушки. Поставьте свои и привезите ей улов.'], steps: [[{ type: 'catch', count: 15 } as never, ['Take 15 catches from pots, nets or lines.', 'Наловите 15 штук — ловушками, сетями или удочкой.']], [{ type: 'visit', port: 'blackwater' } as never, ['Return to Blackwater.', 'Вернитесь в Блэкуотер.']]], xp: 900, silver: 900 }),
  S({ id: 'side_lobster_2', chain: 'lobster', port: 'blackwater', giver: ['Pell the lobsterman', 'Ловец омаров Пелл'], portrait: 'giver_fishwife_f', level: 17, after: 'side_lobster_1', name: ['The Pot Thieves', 'Воры ловушек'], summary: ['The thieves sail out of the fog at night. Sink them.', 'Воры выходят из тумана по ночам. Потопите их.'], steps: [[{ type: 'sink', count: 3, role: 'pirate' } as never, ['Sink pirates: 3.', 'Потопите пиратов: 3.']]], xp: 1200, silver: 1200, choice: true }),
  S({ id: 'side_lobster_3', chain: 'lobster', port: 'blackwater', giver: ['Pell the lobsterman', 'Ловец омаров Пелл'], portrait: 'giver_fishwife_f', level: 19, after: 'side_lobster_2', name: ['The Lobster Feast', 'Пир омаров'], summary: ['Pell throws a feast for the harbour, and you are the guest of honour — bring the prime catch.', 'Пелл устраивает пир для всей гавани, и вы — почётный гость. Привезите лучший улов.'], steps: [[{ type: 'deliver', port: 'blackwater', good: 'prime_fish', qty: 15 } as never, ['Bring 15 prime fish to Blackwater.', 'Привезите в Блэкуотер 15 отборной рыбы.']]], xp: 1500, silver: 1500, tattoo: 'octopus' }),
  // Hank the whaler, Harpoon's Rest: the Orca.
  S({ id: 'side_hank_1', chain: 'hank', port: 'harpoon_rest', giver: ['Hank the whaler', 'Китобой Хэнк'], portrait: 'giver_whaler_m', level: 20, name: ['Blubber and Bone', 'Жир и кость'], summary: ['Hank’s boat is holed; his try-works are cold. Bring him a whale.', 'У Хэнка пробита шлюпка, салотопка остыла. Добудьте ему кита.'], steps: [[{ type: 'beast', count: 1, group: 'whale' } as never, ['Take a whale.', 'Добудьте кита.']], [{ type: 'deliver', port: 'harpoon_rest', good: 'whale_oil', qty: 8 } as never, ['Bring 8 whale oil to Harpoon’s Rest.', 'Привезите в Гарпунную Гавань 8 китового жира.']]], xp: 1500, silver: 1400 }),
  S({ id: 'side_hank_2', chain: 'hank', port: 'harpoon_rest', giver: ['Hank the whaler', 'Китобой Хэнк'], portrait: 'giver_whaler_m', level: 22, after: 'side_hank_1', name: ['Wolves of the Reach', 'Волки Предела'], summary: ['The orcas took Hank’s son’s boat. He wants them to learn fear.', 'Касатки забрали шлюпку сына Хэнка. Он хочет, чтобы они узнали страх.'], steps: [[{ type: 'beast', count: 5, group: 'orca' } as never, ['Kill orcas: 5.', 'Убейте касаток: 5.']]], xp: 1900, silver: 1800, choice: true }),
  S({ id: 'side_hank_3', chain: 'hank', port: 'harpoon_rest', giver: ['Hank the whaler', 'Китобой Хэнк'], portrait: 'giver_whaler_m', level: 25, after: 'side_hank_2', name: ['The Last Hunt', 'Последняя охота'], summary: ['Hank is too old for the boats. Take a sperm whale for him, and he will give you the mark of the Reach.', 'Хэнк слишком стар для шлюпок. Добудьте за него кашалота — и он даст вам знак Предела.'], steps: [[{ type: 'beast', count: 1, group: 'whale' } as never, ['Take a great whale.', 'Добудьте большого кита.']], [{ type: 'visit', port: 'harpoon_rest' } as never, ['Return to Harpoon’s Rest.', 'Вернитесь в Гарпунную Гавань.']]], xp: 2500, silver: 2500, tattoo: 'orca' }),
  // Ingrid the orca-hunter, Harpoon's Rest: the White Fin.
  S({ id: 'side_ingrid_1', chain: 'ingrid', port: 'harpoon_rest', giver: ['Ingrid the orca-hunter', 'Охотница Ингрид'], portrait: 'giver_harbour_master_f', level: 30, after: 'side_hank_3', name: ['The Scarred Pod', 'Стая в шрамах'], summary: ['Ingrid hunts one pod only — the White Orca’s. First she wants to see you fight orcas.', 'Ингрид охотится лишь на одну стаю — стаю Белой касатки. Сначала она хочет увидеть, как вы бьётесь с касатками.'], steps: [[{ type: 'beast', count: 8, group: 'orca' } as never, ['Kill orcas: 8.', 'Убейте касаток: 8.']]], xp: 3000, silver: 2800 }),
  S({ id: 'side_ingrid_2', chain: 'ingrid', port: 'harpoon_rest', giver: ['Ingrid the orca-hunter', 'Охотница Ингрид'], portrait: 'giver_harbour_master_f', level: 33, after: 'side_ingrid_1', name: ['Under the Ice', 'Подо льдом'], summary: ['Spend time in the Reach when the orcas run; learn their songs.', 'Проведите время в Пределе, когда идут касатки; выучите их песни.'], steps: [[{ type: 'time_in', region: 'leviathan_reach', seconds: 1200 } as never, ['Sail twenty minutes in Leviathan Reach.', 'Проведите двадцать минут в Пределе Левиафана.']]], xp: 3500, silver: 3000, choice: true }),
  S({ id: 'side_ingrid_3', chain: 'ingrid', port: 'harpoon_rest', giver: ['Ingrid the orca-hunter', 'Охотница Ингрид'], portrait: 'giver_harbour_master_f', level: 36, after: 'side_ingrid_2', name: ['The White Fin', 'Белый плавник'], summary: ['Ingrid names you a friend of the pod. The orcas will know it on your skin.', 'Ингрид называет вас другом стаи. Касатки узнают это по вашей коже.'], steps: [[{ type: 'beast', count: 3, group: 'any' } as never, ['Take beasts of the sea: 3.', 'Добудьте морских зверей: 3.']], [{ type: 'visit', port: 'harpoon_rest' } as never, ['Return to Harpoon’s Rest.', 'Вернитесь в Гарпунную Гавань.']]], xp: 4000, silver: 3600, tattoo: 'white_fin' }),
  // The bounty hunter, Gravesend: Crossed Sabres.
  S({ id: 'side_hunter_1', chain: 'hunter', port: 'gravesend', giver: ['Serjeant Vosk', 'Сержант Воск'], portrait: 'giver_garrison_captain_m', level: 10, name: ['A Name on the Board', 'Имя на доске'], summary: ['The Hunters’ Guild wants proof you can bring a wanted captain down.', 'Гильдии охотников нужно доказательство, что вы способны свалить разыскиваемого капитана.'], steps: [[{ type: 'named', count: 1 } as never, ['Sink a named pirate.', 'Потопите именного пирата.']], [{ type: 'visit', port: 'gravesend' } as never, ['Report in Gravesend.', 'Доложите в Грейвсенде.']]], xp: 1200, silver: 1500 }),
  S({ id: 'side_hunter_2', chain: 'hunter', port: 'gravesend', giver: ['Serjeant Vosk', 'Сержант Воск'], portrait: 'giver_garrison_captain_m', level: 14, after: 'side_hunter_1', name: ['The Lieutenants', 'Лейтенанты'], summary: ['Every captain has men who know her hideouts. Take their ships.', 'У каждого капитана есть люди, знающие её логова. Возьмите их корабли.'], steps: [[{ type: 'board', count: 2 } as never, ['Take ships by boarding: 2.', 'Возьмите корабли на абордаж: 2.']]], xp: 1600, silver: 1800, choice: true }),
  S({ id: 'side_hunter_3', chain: 'hunter', port: 'gravesend', giver: ['Serjeant Vosk', 'Сержант Воск'], portrait: 'giver_garrison_captain_m', level: 18, after: 'side_hunter_2', name: ['Three Heads', 'Три головы'], summary: ['Three named captains, and the Guild will give you its mark.', 'Три именных капитана — и Гильдия даст вам свой знак.'], steps: [[{ type: 'named', count: 3 } as never, ['Sink named pirates: 3.', 'Потопите именных пиратов: 3.']]], xp: 2400, silver: 3000, tattoo: 'sabres' }),
  // The League clerk, Hollowmere: the Coin.
  S({ id: 'side_clerk_1', chain: 'clerk', port: 'hollowmere', giver: ['Clerk Abernethy', 'Писарь Абернети'], portrait: 'giver_merchant_m', level: 5, name: ['The Ledger’s Errand', 'Поручение Гроссбуха'], summary: ['The League wants a captain who delivers on time.', 'Лиге нужен капитан, который доставляет вовремя.'], steps: [[{ type: 'deliver', port: 'tidewrack', good: 'cloth', qty: 20 } as never, ['Bring 20 cloth to Tidewrack.', 'Привезите в Тайдрэк 20 ткани.']], [{ type: 'visit', port: 'hollowmere' } as never, ['Return to Hollowmere.', 'Вернитесь в Холлоумир.']]], xp: 700, silver: 900 }),
  S({ id: 'side_clerk_2', chain: 'clerk', port: 'hollowmere', giver: ['Clerk Abernethy', 'Писарь Абернети'], portrait: 'giver_merchant_m', level: 8, after: 'side_clerk_1', name: ['A Race to Market', 'Гонка на рынок'], summary: ['Spices spoil the price by the hour. Get them to Blackwater before the others.', 'Специи дешевеют с каждым часом. Доставьте их в Блэкуотер раньше других.'], steps: [[{ type: 'race', port: 'blackwater', seconds: 1800 } as never, ['Reach Blackwater within 30 minutes.', 'Дойдите до Блэкуотера за 30 минут.']]], xp: 1000, silver: 1200, choice: true }),
  S({ id: 'side_clerk_3', chain: 'clerk', port: 'hollowmere', giver: ['Clerk Abernethy', 'Писарь Абернети'], portrait: 'giver_merchant_m', level: 11, after: 'side_clerk_2', name: ['The Gilded Signature', 'Позолоченная подпись'], summary: ['Sell goods to the League’s ports; the Ledger will sign you in gold.', 'Торгуйте с портами Лиги — Гроссбух распишется за вас золотом.'], steps: [[{ type: 'deliver', port: 'hollowmere', good: 'spices', qty: 20 } as never, ['Bring 20 spices to Hollowmere.', 'Привезите в Холлоумир 20 специй.']]], xp: 1400, silver: 1600, tattoo: 'coin' }),
  // The Brethren's quartermaster, Cinderhold: the Skull.
  S({ id: 'side_qm_1', chain: 'quartermaster', port: 'cinderhold', giver: ['Quartermaster Rook', 'Квартирмейстер Рук'], portrait: 'giver_bosun_m', level: 12, name: ['Earn Your Share', 'Заработай долю'], summary: ['The Brethren feed those who bring. Take tribute from a merchant.', 'Братство кормит тех, кто приносит. Возьмите дань с торговца.'], steps: [[{ type: 'tribute', count: 2 } as never, ['Take tribute: 2.', 'Возьмите дань: 2.']]], xp: 1300, silver: 1400 }),
  S({ id: 'side_qm_2', chain: 'quartermaster', port: 'cinderhold', giver: ['Quartermaster Rook', 'Квартирмейстер Рук'], portrait: 'giver_bosun_m', level: 15, after: 'side_qm_1', name: ['Prizes for the Fleet', 'Призы для флота'], summary: ['The Brethren need hulls. Bring a prize to a prize court.', 'Братству нужны корпуса. Приведите приз к призовому суду.'], steps: [[{ type: 'prize', count: 1 } as never, ['Bring a prize home.', 'Приведите приз домой.']]], xp: 1700, silver: 1800, choice: true }),
  S({ id: 'side_qm_3', chain: 'quartermaster', port: 'cinderhold', giver: ['Quartermaster Rook', 'Квартирмейстер Рук'], portrait: 'giver_bosun_m', level: 18, after: 'side_qm_2', name: ['The Articles', 'Статьи'], summary: ['Board three ships and sign the Brethren’s articles in ink under your skin.', 'Возьмите на абордаж три корабля и подпишите статьи Братства чернилами под кожей.'], steps: [[{ type: 'board', count: 3 } as never, ['Take ships by boarding: 3.', 'Возьмите корабли на абордаж: 3.']]], xp: 2300, silver: 2500, tattoo: 'skull' }),
  // The Choir's chaplain, Saint Maw: the Eye.
  S({ id: 'side_chaplain_1', chain: 'chaplain', port: 'saint_maw', giver: ['Chaplain Ysolde', 'Капеллан Изольда'], portrait: 'giver_priest_f', level: 25, name: ['Rest for the Drowned', 'Покой утопленникам'], summary: ['The drowned walk the water here. Lay three of them to rest.', 'Здесь по воде ходят утопленники. Упокойте троих.'], steps: [[{ type: 'sink', count: 3, role: 'ghost' } as never, ['Sink ghost ships: 3.', 'Потопите корабли-призраки: 3.']]], xp: 2500, silver: 2200 }),
  S({ id: 'side_chaplain_2', chain: 'chaplain', port: 'saint_maw', giver: ['Chaplain Ysolde', 'Капеллан Изольда'], portrait: 'giver_priest_f', level: 28, after: 'side_chaplain_1', name: ['The Bells Below', 'Колокола внизу'], summary: ['The drowned churches still ring. Go down to them.', 'Утонувшие церкви всё ещё звонят. Спуститесь к ним.'], steps: [[{ type: 'dive', count: 2 } as never, ['Go down in a diving bell: 2.', 'Спуститесь в колоколе: 2.']]], xp: 2900, silver: 2600, choice: true }),
  S({ id: 'side_chaplain_3', chain: 'chaplain', port: 'saint_maw', giver: ['Chaplain Ysolde', 'Капеллан Изольда'], portrait: 'giver_priest_f', level: 31, after: 'side_chaplain_2', name: ['The Open Eye', 'Открытый глаз'], summary: ['The Choir gives its sight to those who have looked into the deep.', 'Хор дарует своё зрение тем, кто заглянул в глубину.'], steps: [[{ type: 'reach', region: 'the_abyss' } as never, ['Reach the Abyss.', 'Дойдите до Бездны.']], [{ type: 'visit', port: 'saint_maw' } as never, ['Return to Saint Maw.', 'Вернитесь в Сент-Мо.']]], xp: 3500, silver: 3000, tattoo: 'eye' }),
  // The cartographer, Fogmouth: the Old Map.
  S({ id: 'side_carto_1', chain: 'cartographer', port: 'fogmouth', giver: ['Ottilie the cartographer', 'Картограф Оттилия'], portrait: 'giver_cartographer_f', level: 6, name: ['Blank Spaces', 'Белые пятна'], summary: ['Ottilie’s chart has holes. Fill them.', 'На карте Оттилии дыры. Заполните их.'], steps: [[{ type: 'chart', count: 6 } as never, ['Chart islands: 6.', 'Нанесите на карту острова: 6.']]], xp: 800, silver: 800 }),
  S({ id: 'side_carto_2', chain: 'cartographer', port: 'fogmouth', giver: ['Ottilie the cartographer', 'Картограф Оттилия'], portrait: 'giver_cartographer_f', level: 9, after: 'side_carto_1', name: ['The Edge of the Fog', 'Край тумана'], summary: ['Sail where the Whispering fog is thickest and come back to tell of it.', 'Пройдите туда, где туман Шепчущего архипелага гуще всего, и вернитесь рассказать.'], steps: [[{ type: 'time_in', region: 'whispering', seconds: 900 } as never, ['Sail fifteen minutes in the Whispering Archipelago.', 'Проведите пятнадцать минут в Шепчущем архипелаге.']], [{ type: 'chart', count: 4 } as never, ['Chart islands: 4.', 'Нанесите на карту острова: 4.']]], xp: 1100, silver: 1100, choice: true }),
  S({ id: 'side_carto_3', chain: 'cartographer', port: 'fogmouth', giver: ['Ottilie the cartographer', 'Картограф Оттилия'], portrait: 'giver_cartographer_f', level: 12, after: 'side_carto_2', name: ['The Last Leaf of the Atlas', 'Последний лист атласа'], summary: ['Ottilie inks her own compass rose — the old way — on the captain who finished her atlas.', 'Оттилия набивает свою розу — по-старому — капитану, закончившему её атлас.'], steps: [[{ type: 'chart', count: 8 } as never, ['Chart islands: 8.', 'Нанесите на карту острова: 8.']]], xp: 1500, silver: 1500, tattoo: 'map' }),
  // Old Needle herself, Cinderhold: the Needle.
  S({ id: 'side_needle_1', chain: 'needle', port: 'cinderhold', giver: ['Old Needle', 'Старая Игла'], portrait: 'giver_hermit_f', level: 20, name: ['Ink and Ash', 'Тушь и пепел'], summary: ['Old Needle’s ink is made of ash and whale oil. Bring her both.', 'Тушь Старой Иглы делается из пепла и китового жира. Привезите ей и то и другое.'], steps: [[{ type: 'deliver', port: 'cinderhold', good: 'whale_oil', qty: 10 } as never, ['Bring 10 whale oil to Cinderhold.', 'Привезите в Синдерхолд 10 китового жира.']], [{ type: 'deliver', port: 'cinderhold', good: 'coal', qty: 10 } as never, ['Bring 10 coal to Cinderhold.', 'Привезите в Синдерхолд 10 угля.']]], xp: 1800, silver: 1500 }),
  S({ id: 'side_needle_2', chain: 'needle', port: 'cinderhold', giver: ['Old Needle', 'Старая Игла'], portrait: 'giver_hermit_f', level: 24, after: 'side_needle_1', name: ['A Needle of Bone', 'Игла из кости'], summary: ['Her needles are narwhal ivory. Hers broke.', 'Её иглы — из бивня нарвала. Иглы сломались.'], steps: [[{ type: 'deliver', port: 'cinderhold', good: 'narwhal_tusk', qty: 1 } as never, ['Bring a narwhal tusk to Cinderhold.', 'Привезите в Синдерхолд бивень нарвала.']]], xp: 2200, silver: 2000, choice: true }),
  S({ id: 'side_needle_3', chain: 'needle', port: 'cinderhold', giver: ['Old Needle', 'Старая Игла'], portrait: 'giver_hermit_f', level: 28, after: 'side_needle_2', name: ['Her Own Mark', 'Её собственный знак'], summary: ['Old Needle gives her own mark to few: a place for one more tattoo.', 'Свой знак Старая Игла даёт немногим: место ещё для одной татуировки.'], steps: [[{ type: 'sink', count: 5 } as never, ['Sink ships: 5.', 'Потопите корабли: 5.']], [{ type: 'visit', port: 'cinderhold' } as never, ['Return to Cinderhold.', 'Вернитесь в Синдерхолд.']]], xp: 2800, silver: 2500, tattoo: 'needle' }),
  // The ship's cat, Tidewrack: the Ship's Cat.
  S({ id: 'side_cat_1', chain: 'cat', port: 'tidewrack', giver: ['Mother Grisel, the ship’s-cat breeder', 'Матушка Гризель, разводчица корабельных котов'], portrait: 'giver_widow_f', level: 3, name: ['A Cat Overboard', 'Кот за бортом'], summary: ['One of Grisel’s cats went to sea on a merchantman that never came back. Look for the wreck.', 'Один из котов Гризель ушёл в море на торговце, который не вернулся. Поищите обломки.'], steps: [[{ type: 'land', island: -1 } as never, ['Land a party ashore anywhere.', 'Высадите десант на любой берег.']], [{ type: 'visit', port: 'tidewrack' } as never, ['Return to Tidewrack.', 'Вернитесь в Тайдрэк.']]], xp: 400, silver: 500 }),
  S({ id: 'side_cat_2', chain: 'cat', port: 'tidewrack', giver: ['Mother Grisel, the ship’s-cat breeder', 'Матушка Гризель, разводчица корабельных котов'], portrait: 'giver_widow_f', level: 5, after: 'side_cat_1', name: ['Rats in the Grain', 'Крысы в зерне'], summary: ['Grisel’s cats need feeding: fish, and plenty of it.', 'Котов Гризель надо кормить: рыбой, и побольше.'], steps: [[{ type: 'deliver', port: 'tidewrack', good: 'fish', qty: 25 } as never, ['Bring 25 fish to Tidewrack.', 'Привезите в Тайдрэк 25 рыбы.']]], xp: 600, silver: 700, choice: true }),
  S({ id: 'side_cat_3', chain: 'cat', port: 'tidewrack', giver: ['Mother Grisel, the ship’s-cat breeder', 'Матушка Гризель, разводчица корабельных котов'], portrait: 'giver_widow_f', level: 7, after: 'side_cat_2', name: ['Nine Lives', 'Девять жизней'], summary: ['The finest of her litter chooses you. So does the ink.', 'Лучший котёнок помёта выбирает вас. И тушь тоже.'], steps: [[{ type: 'rescue', count: 3 } as never, ['Save souls from the sea: 3.', 'Спасите из моря: 3.']]], xp: 900, silver: 900, tattoo: 'cat' }),
  // "Who called?" from the fog, Fogmouth: the Lantern.
  S({ id: 'side_fog_1', chain: 'fog', port: 'fogmouth', giver: ['A voice in the fog', 'Голос в тумане'], portrait: 'giver_cultist_m', level: 14, name: ['Who Called?', 'Кто звал?'], summary: ['Something calls your name from the fog off Fogmouth. Answer it.', 'Что-то зовёт вас по имени из тумана у Фогмута. Откликнитесь.'], steps: [[{ type: 'time_in', region: 'whispering', seconds: 600 } as never, ['Sail ten minutes in the Whispering Archipelago.', 'Проведите десять минут в Шепчущем архипелаге.']]], xp: 1300, silver: 1000 }),
  S({ id: 'side_fog_2', chain: 'fog', port: 'fogmouth', giver: ['A voice in the fog', 'Голос в тумане'], portrait: 'giver_cultist_m', level: 17, after: 'side_fog_1', name: ['The Lights in the Water', 'Огни в воде'], summary: ['The voice wants the drowned freed from their ships.', 'Голос хочет, чтобы утопленники освободились от своих кораблей.'], steps: [[{ type: 'sink', count: 2, role: 'ghost' } as never, ['Sink ghost ships: 2.', 'Потопите корабли-призраки: 2.']]], xp: 1700, silver: 1400, choice: true }),
  S({ id: 'side_fog_3', chain: 'fog', port: 'fogmouth', giver: ['A voice in the fog', 'Голос в тумане'], portrait: 'giver_cultist_m', level: 20, after: 'side_fog_2', name: ['The Lantern-Bearer', 'Фонарщик'], summary: ['It was a drowned lamplighter. He leaves you his lantern — in ink.', 'Это был утонувший фонарщик. Он оставляет вам свой фонарь — в туши.'], steps: [[{ type: 'visit', port: 'fogmouth' } as never, ['Return to Fogmouth.', 'Вернитесь в Фогмут.']]], xp: 2000, silver: 1800, tattoo: 'lantern' }),
  // The letters of the sea, Wrecktide: the Bottle.
  S({ id: 'side_letters_1', chain: 'letters', port: 'wrecktide', giver: ['Ada the letter-keeper', 'Хранительница писем Ада'], portrait: 'giver_lighthouse_keeper_f', level: 8, name: ['Letters Nobody Sent', 'Письма, которых никто не отправлял'], summary: ['Ada keeps the letters the sea brings. Find her one.', 'Ада хранит письма, которые приносит море. Найдите ей одно.'], steps: [[{ type: 'letters', count: 1 } as never, ['Find a letter of the sea.', 'Найдите письмо моря.']]], xp: 900, silver: 900 }),
  S({ id: 'side_letters_2', chain: 'letters', port: 'wrecktide', giver: ['Ada the letter-keeper', 'Хранительница писем Ада'], portrait: 'giver_lighthouse_keeper_f', level: 11, after: 'side_letters_1', name: ['The Answer', 'Ответ'], summary: ['One letter asks a question. Ada wants the answer, three letters later.', 'Одно письмо задаёт вопрос. Ада хочет ответ — ещё через три письма.'], steps: [[{ type: 'letters', count: 3 } as never, ['Find letters of the sea: 3.', 'Найдите письма моря: 3.']]], xp: 1300, silver: 1300, choice: true }),
  S({ id: 'side_letters_3', chain: 'letters', port: 'wrecktide', giver: ['Ada the letter-keeper', 'Хранительница писем Ада'], portrait: 'giver_lighthouse_keeper_f', level: 14, after: 'side_letters_2', name: ['Postmarked by the Sea', 'Со штемпелем моря'], summary: ['Ada seals your skin with the bottle — a keeper of letters.', 'Ада запечатывает вашу кожу бутылкой — вы теперь хранитель писем.'], steps: [[{ type: 'visit', port: 'wrecktide' } as never, ['Return to Wrecktide.', 'Вернитесь в Рэктайд.']]], xp: 1600, silver: 1500, tattoo: 'bottle' }),
  // The mystery of the Flying Dutchman, Wrecktide: the Dutchman.
  S({ id: 'side_dutch_1', chain: 'dutchman', port: 'wrecktide', giver: ['Wendel, the last of her crew', 'Вендель, последний из её команды'], portrait: 'giver_old_salt_m', level: 35, name: ['The Ship That Would Not Sink', 'Корабль, что не тонет'], summary: ['Wendel swears he sailed on the Dutchman and lived. He wants proof he isn’t mad.', 'Вендель клянётся, что ходил на «Голландце» и выжил. Ему нужно доказательство, что он не безумен.'], steps: [[{ type: 'sink', count: 5, role: 'ghost' } as never, ['Sink ghost ships: 5.', 'Потопите корабли-призраки: 5.']]], xp: 4000, silver: 3500 }),
  S({ id: 'side_dutch_2', chain: 'dutchman', port: 'wrecktide', giver: ['Wendel, the last of her crew', 'Вендель, последний из её команды'], portrait: 'giver_old_salt_m', level: 38, after: 'side_dutch_1', name: ['Her Course', 'Её курс'], summary: ['The Dutchman sails the edge of the Abyss at the change of the tide.', 'Голландец ходит по краю Бездны, когда меняется прилив.'], steps: [[{ type: 'time_in', region: 'the_abyss', seconds: 600 } as never, ['Sail ten minutes in the Abyss.', 'Проведите десять минут в Бездне.']]], xp: 4600, silver: 4000, choice: true }),
  S({ id: 'side_dutch_3', chain: 'dutchman', port: 'wrecktide', giver: ['Wendel, the last of her crew', 'Вендель, последний из её команды'], portrait: 'giver_old_salt_m', level: 41, after: 'side_dutch_2', name: ['Free of Her', 'Свободен от неё'], summary: ['Wendel is free at last. The ghosts will know you as one of hers — and hold their fire.', 'Вендель наконец свободен. Призраки узнают в вас одного из её людей — и не будут стрелять.'], steps: [[{ type: 'visit', port: 'wrecktide' } as never, ['Return to Wrecktide.', 'Вернитесь в Рэктайд.']]], xp: 5200, silver: 5000, tattoo: 'dutchman' }),
];

/** Hidden quests: begun by a deed, not by a giver. */
export const HIDDEN_SPECS: (SideSpec & { trigger: { kind: 'skulls' | 'rescued' | 'fog_ghosts' | 'herring'; n: number } })[] = [
  { ...S({ id: 'hidden_curse', chain: 'hidden', port: 'saint_maw', giver: ['The skull in your net', 'Череп в вашей сети'], portrait: 'giver_cultist_f', level: 1, name: ['The Fisherman’s Curse', 'Проклятие рыбака'], summary: ['Three skulls in your nets — the same one each time. It wants to go home, to Saint Maw.', 'Три черепа в ваших сетях — и каждый раз один и тот же. Он хочет домой, в Сент-Мо.'], steps: [[{ type: 'visit', port: 'saint_maw' } as never, ['Bring the skull to Saint Maw.', 'Отвезите череп в Сент-Мо.']]], xp: 2000, silver: 1500, choice: true }), trigger: { kind: 'skulls', n: 3 } },
  { ...S({ id: 'hidden_grateful', chain: 'hidden', port: 'wrecktide', giver: ['The grateful drowned', 'Благодарные утопленники'], portrait: 'giver_widow_f', level: 1, name: ['The Grateful Drowned', 'Благодарные утопленники'], summary: ['Ten souls saved: the sea owes you, and pays at Wrecktide.', 'Десять спасённых душ: море у вас в долгу и платит в Рэктайде.'], steps: [[{ type: 'visit', port: 'wrecktide' } as never, ['Sail to Wrecktide.', 'Идите в Рэктайд.']]], xp: 1500, silver: 2000, choice: true }), trigger: { kind: 'rescued', n: 10 } },
  { ...S({ id: 'hidden_fog', chain: 'hidden', port: 'fogmouth', giver: ['Whispers in the fog', 'Шёпот в тумане'], portrait: 'giver_cultist_m', level: 1, name: ['Whispers in the Fog', 'Шёпот в тумане'], summary: ['The ghosts you sank in the fog whisper a name — a cove near Fogmouth.', 'Призраки, потопленные вами в тумане, шепчут имя — бухта у Фогмута.'], steps: [[{ type: 'chart', count: 3 } as never, ['Chart islands: 3.', 'Нанесите на карту острова: 3.']], [{ type: 'visit', port: 'fogmouth' } as never, ['Return to Fogmouth.', 'Вернитесь в Фогмут.']]], xp: 2500, silver: 2000, choice: true }), trigger: { kind: 'fog_ghosts', n: 3 } },
  { ...S({ id: 'hidden_herring', chain: 'hidden', port: 'saltmarrow', giver: ['The herring king', 'Селёдочный король'], portrait: 'giver_fishwife_f', level: 1, name: ['The Herring King', 'Селёдочный король'], summary: ['A hundred herring — and among them one with a crown. The fishwives of Saltmarrow will want to see it.', 'Сотня сельди — и среди неё одна с короной. Рыбачки Солтмарроу захотят на неё посмотреть.'], steps: [[{ type: 'visit', port: 'saltmarrow' } as never, ['Sail to Saltmarrow.', 'Идите в Солтмарроу.']]], xp: 1200, silver: 1200, choice: true }), trigger: { kind: 'herring', n: 100 } },
];

function build(s: SideSpec, kind: 'side' | 'hidden'): QuestDef {
  return {
    id: s.id, kind: 'story', name: s.name[0], mentor: s.giver[0], port: s.port, summary: s.summary[0],
    requires: { level: s.level, ...(s.after ? { done: [s.after] } : {}) },
    steps: s.steps.map(([st, text]) => ({ ...(st as object), text: text[0] }) as QuestStep),
    reward: { xp: s.xp, silver: s.silver, ...(s.tattoo ? { tattoo: s.tattoo } : {}), ...(s.choice ? { choice: true } : {}) },
    category: kind, portrait: s.portrait, template: s.chain,
    ...(kind === 'hidden' ? { hidden: true } : {}),
  };
}

export const SIDE_QUESTS: QuestDef[] = SIDE_SPECS.map((s) => build(s, 'side'));
export const HIDDEN_QUESTS: QuestDef[] = HIDDEN_SPECS.map((s) => build(s, 'hidden'));

export function sidePatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const t of TATTOOS) out.push(t.name, t.how, t.gives);
  for (const s of [...SIDE_SPECS, ...HIDDEN_SPECS]) {
    out.push(s.name, s.summary, s.giver);
    for (const [, text] of s.steps) out.push(text);
  }
  out.push(
    ['Old Needle will ink {0} for you in any haven of the Brethren.', 'Старая Игла набьёт вам «{0}» в любой гавани Братства.'],
    ['Old Needle inks {0}.', 'Старая Игла набивает «{0}».'],
    ['A new quest begins: {0}.', 'Начинается новый квест: {0}.'],
    ['Too late: {0} is lost.', 'Опоздали: «{0}» провален.'],
    ['Choose your reward.', 'Выберите награду.'],
    ['No tattoo of that kind is yours.', 'У вас нет такой татуировки.'],
    ['That place is not yours yet.', 'Это место ещё не открыто.'],
    ['Tattoos are changed in a tavern.', 'Татуировки меняют в таверне.'],
    ['{0} is set in its place.', '«{0}» на своём месте.'],
    ['Nothing to choose from.', 'Выбирать не из чего.'],
    ['A skull in the net.', 'В сети — череп.'],
    ['Take tribute: {0}.', 'Возьмите дань: {0}.'],
    ['Sink named pirates: {0}.', 'Потопите именных пиратов: {0}.'],
    ['Find letters of the sea: {0}.', 'Найдите письма моря: {0}.'],
    ['Reach {0} within {1} minutes.', 'Дойдите до порта {0} за {1} мин.'],
  );
  return out;
}
