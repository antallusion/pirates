// Island scenes and mini-games (2026-09-30: every island has something ashore): twenty short games that open in one
// window — riddles of the age of sail, sea lore and the stars, dice and coins with castaways and tavern keepers, a
// shell game, the bosun's calls and the flag hoists to repeat, a needle and a harpoon to time, a haggle, and short
// branching tales. The words are here in both languages; the server rolls every chance, checks every answer and
// sends only ids and numbers. Silver is a base the server scales by the ship's level (like the sea director's purse).

import type { GoodId } from './goods.ts';

export type Tr = [string, string];

export type MiniKind = 'riddle' | 'stars' | 'dice' | 'anchor' | 'coin' | 'shells' | 'memory' | 'timing' | 'haggle' | 'quest';

/** What a landing party finds ashore on an island with nothing else: each island has one, by her id. */
export type HauntId = 'camp' | 'shack' | 'cairn' | 'cave' | 'crag';
export const HAUNT_IDS: HauntId[] = ['camp', 'shack', 'cairn', 'cave', 'crag'];
/** The haunts' names as the server says them (the client's table has them in Russian too). */
export const HAUNT_NAMES: Record<HauntId, Tr> = {
  camp: ["castaway's fire", 'костёр отшельника'],
  shack: ['grog shack', 'хижина с грогом'],
  cairn: ['old cairn', 'старый каменный курган'],
  cave: ['sea cave', 'морской грот'],
  crag: ['lookout crag', 'дозорная скала'],
};

/** An island's haunt: fixed by her id, so every captain finds the same place there. */
export function islandHaunt(islandId: number): HauntId {
  const h = Math.imul(islandId + 0x9e37, 0x85ebca6b) >>> 0;
  return HAUNT_IDS[((h ^ (h >>> 13)) >>> 0) % HAUNT_IDS.length];
}

export type MinigameId =
  | 'talking_skull' | 'drowned_ferryman' | 'old_parrot' | 'bosuns_lore' | 'star_bearing'
  | 'liars_dice' | 'crown_anchor' | 'castaway_coin' | 'three_shells'
  | 'bosun_whistle' | 'flag_hoist' | 'compass_needle' | 'harpoon_lagoon'
  | 'beach_trader'
  | 'marooned_sailor' | 'cursed_idol' | 'smugglers_cave' | 'mutineers_grave' | 'three_levers' | 'split_map';

/** What an outcome pays or costs. `silver` and `loseSilver` are bases the server scales by the ship's level. */
export interface Pay {
  silver?: [number, number];
  loseSilver?: [number, number];
  /** Won or lost stakes: the stake times this (−1 lost, 1 won even, 2 or 3 at Crown and Anchor). */
  stake?: number;
  xp?: number;
  goods?: [GoodId, number, number];
  /** The chance of a treasure map (tier 1). */
  map?: number;
  /** The chance of a piece of gear of her level. */
  item?: number;
  /** Hands who sign on. */
  hands?: number;
  /** Hands lost. */
  crew?: number;
  morale?: number;
  sanity?: number;
  curse?: number;
}

export interface Outcome {
  /** {silver}, {lost}, {stake}, {n}, {good}, {item}, {crew}, {roll}, {count} filled from the server's numbers. */
  text: Tr;
  win: boolean;
  pay: Pay;
}

export interface Question {
  q: Tr;
  options: Tr[];
  /** The right option's index (checked on the server). */
  answer: number;
}

export interface QuestChoice {
  id: string;
  label: Tr;
  /** On to another step of the tale. */
  go?: string;
  /** Or settled: a fixed outcome, or a roll of the server's dice between two. */
  to?: string;
  chance?: number;
  win?: string;
  lose?: string;
}

export interface QuestStep {
  text: Tr;
  choices: QuestChoice[];
}

export interface MinigameDef {
  id: MinigameId;
  kind: MiniKind;
  title: Tr;
  text: Tr;
  /** The header's painting (an existing card) and a face or thing over it (a portrait, an icon or a prop). */
  art: string;
  face: string;
  /** The island haunts it may be found at, and whether a passing boat may offer it at sea. */
  haunts: HauntId[];
  sea: boolean;
  weight: number;
  /** Riddles and the stars: the pool, and how many are asked. */
  questions?: Question[];
  rounds?: number;
  /** The tale's steps, from `start`. */
  steps?: Record<string, QuestStep>;
  start?: string;
  /** Games of chance: the stake's base (scaled by level, never more than she has). */
  stake?: number;
  /** Memory: the symbols and the length of the call to repeat. */
  symbols?: Tr[];
  length?: number;
  /** Timing: the needle's half-zone (share of its swing), its first period (ms) and the number of tries. */
  zone?: number;
  period?: number;
  tries?: number;
  /** The buttons of the one-step games (the labels; the server knows what they mean). */
  choices?: { id: string; label: Tr }[];
  outcomes: Record<string, Outcome>;
}

const M = (d: MinigameDef): MinigameDef => d;
const WALK: Outcome = { text: ['You leave it be and row back to the ship.', 'Вы оставляете всё как есть и гребёте обратно к кораблю.'], win: false, pay: {} };
/** "Walk away", on every game: the window closed is the same. */
export const WALK_CHOICE = { id: 'walk', label: ['Walk away', 'Уйти'] as Tr };

export const MINIGAMES: Record<MinigameId, MinigameDef> = {
  // ------------------------------------------------------------------ riddles and lore
  talking_skull: M({
    id: 'talking_skull', kind: 'riddle', art: 'card.enc_skeleton_raft', face: 'icon.tattoo_skull', haunts: ['cairn', 'cave'], sea: false, weight: 10, rounds: 1,
    title: ['The Talking Skull', 'Говорящий череп'],
    text: ['A skull on a boarding pike grins at the beach. As your men come near, its jaw clacks: "Answer me, and my captain\'s purse is yours. Answer wrong, and carry my curse to sea."', 'Череп на абордажной пике скалится на пляж. Когда ваши люди подходят, его челюсть щёлкает: «Ответьте — и кошель моего капитана ваш. Ошибётесь — унесёте моё проклятие в море».'],
    questions: [
      { q: ['The more of them you make, the more of them you leave behind. What are they?', 'Чем больше их делаешь, тем больше оставляешь за спиной. Что это?'], options: [['Footsteps', 'Шаги'], ['Debts', 'Долги'], ['Widows', 'Вдовы'], ['Knots', 'Узлы']], answer: 0 },
      { q: ['I have a neck but no head, a cork for a hat, and sailors love me best when I am full. What am I?', 'У меня есть горло, но нет головы, пробка вместо шляпы, и моряки любят меня полной. Кто я?'], options: [['A cannon', 'Пушка'], ['A bottle', 'Бутылка'], ['A powder horn', 'Пороховница'], ['A purser', 'Казначей']], answer: 1 },
      { q: ['What grows wetter the more it dries?', 'Что становится тем мокрее, чем больше сушит?'], options: [['A sail in the rain', 'Парус под дождём'], ['Salt', 'Соль'], ['A towel', 'Полотенце'], ['The deck', 'Палуба']], answer: 2 },
    ],
    outcomes: {
      r1: { text: ['The jaw drops open and a purse falls out of it: {silver}. "Well answered," it sighs, and says no more.', 'Челюсть отваливается, и из неё выпадает кошель: {silver}. «Верно», — вздыхает череп и больше не говорит ни слова.'], win: true, pay: { silver: [100, 220], xp: 60 } },
      r0: { text: ['The skull laughs until its teeth rattle loose. Your men row back crossing themselves; a chill follows the boat.', 'Череп хохочет, пока не расшатываются зубы. Люди гребут назад, крестясь; за шлюпкой тянется холод.'], win: false, pay: { xp: 15, morale: -4, curse: 5 } },
      walk: WALK,
    },
  }),
  drowned_ferryman: M({
    id: 'drowned_ferryman', kind: 'riddle', art: 'card.enc_voice_in_fog', face: 'portrait.drowned', haunts: ['cairn', 'crag'], sea: true, weight: 8, rounds: 1,
    title: ['The Drowned Ferryman', 'Утопленник-перевозчик'],
    text: ['A grey man in a grey boat, weed in his beard, holds out a hand of wet bones. "I ferry the dead. Tell me my riddle and I ferry you nowhere tonight — and pay you for the trouble."', 'Серый человек в серой лодке, в бороде водоросли, протягивает руку из мокрых костей. «Я вожу мёртвых. Отгадай мою загадку — и этой ночью я тебя никуда не повезу. Да ещё заплачу за беспокойство».'],
    questions: [
      { q: ['He who makes it sells it. He who buys it never uses it. He who uses it never knows. What is it?', 'Кто делает — продаёт. Кто покупает — не пользуется. Кто пользуется — не знает о том. Что это?'], options: [['A hangman\'s rope', 'Верёвка палача'], ['A coffin', 'Гроб'], ['A last will', 'Завещание'], ['A ship\'s bell', 'Корабельный колокол']], answer: 1 },
      { q: ['It runs but never walks, has a mouth but never speaks, has a bed but never sleeps. What is it?', 'Бежит, но не ходит; есть устье, но не говорит; есть ложе, но не спит. Что это?'], options: [['A current', 'Течение'], ['A river', 'Река'], ['A rumour', 'Слух'], ['A tide', 'Прилив']], answer: 1 },
      { q: ['Feed me and I live. Give me a drink and I die. What am I?', 'Накорми меня — и я живу. Напои — и я умру. Кто я?'], options: [['Scurvy', 'Цинга'], ['Rust', 'Ржавчина'], ['Fire', 'Огонь'], ['A ship\'s cat', 'Корабельный кот']], answer: 2 },
    ],
    outcomes: {
      r1: { text: ['"Not tonight, then." He drops {silver} of drowned men\'s coin into your boat and pulls away into the fog.', '«Значит, не сегодня». Он бросает в шлюпку {silver} монетами утопленников и уходит в туман.'], win: true, pay: { silver: [110, 230], xp: 60, sanity: 5 } },
      r0: { text: ['"Soon, then." He smiles with no lips and is gone. The men will not look at the water for an hour.', '«Значит, скоро». Он улыбается безгубым ртом и исчезает. Целый час люди не смотрят на воду.'], win: false, pay: { xp: 15, sanity: -8, morale: -3 } },
      walk: WALK,
    },
  }),
  old_parrot: M({
    id: 'old_parrot', kind: 'riddle', art: 'card.enc_signal_fire', face: 'icon.pet_parrot', haunts: ['camp', 'crag'], sea: false, weight: 8, rounds: 1,
    title: ['The Dead Captain\'s Parrot', 'Попугай мёртвого капитана'],
    text: ['On a skeleton in a rotten coat sits a parrot older than your ship. It cocks its head and screeches its master\'s last riddle — and a silver chain glints under the coat.', 'На скелете в истлевшем камзоле сидит попугай старше вашего корабля. Он склоняет голову и выкрикивает последнюю загадку хозяина — а под камзолом поблёскивает серебряная цепь.'],
    questions: [
      { q: ['"Always coming, never here! Always coming, never here!"', '«Всегда идёт, никогда не приходит! Всегда идёт, никогда не приходит!»'], options: [['The tide', 'Прилив'], ['Tomorrow', 'Завтра'], ['Rescue', 'Спасение'], ['The wind', 'Ветер']], answer: 1 },
      { q: ['"The poor have it, the rich need it, eat it and you die! Awk!"', '«У бедного есть, богатому нужно, а съешь — умрёшь! Кар-р!»'], options: [['Nothing', 'Ничего'], ['Gold', 'Золото'], ['Salt pork', 'Солонина'], ['Poison', 'Яд']], answer: 0 },
      { q: ['"Black when bought, red when used, grey when thrown away!"', '«Покупают чёрным, пользуют красным, выбрасывают серым!»'], options: [['Powder', 'Порох'], ['Tar', 'Смола'], ['Coal', 'Уголь'], ['Rum', 'Ром']], answer: 2 },
    ],
    outcomes: {
      r1: { text: ['The parrot bobs its head and flutters off the bones. The chain and the purse on it are yours: {silver}.', 'Попугай кивает и слетает с костей. Цепь и кошель на ней — ваши: {silver}.'], win: true, pay: { silver: [90, 200], xp: 55, morale: 3 } },
      r0: { text: ['"Wrong! Wrong! Wrong!" The bird bites the bosun to the bone and screams curses all the way back to the boat.', '«Невер-рно! Невер-рно!» Птица кусает боцмана до кости и орёт проклятия до самой шлюпки.'], win: false, pay: { xp: 15, morale: -3 } },
      walk: WALK,
    },
  }),
  bosuns_lore: M({
    id: 'bosuns_lore', kind: 'riddle', art: 'card.enc_calm', face: 'portrait.giver_bosun_m', haunts: ['shack', 'camp'], sea: true, weight: 9, rounds: 2,
    title: ['The Old Bosun\'s Questions', 'Вопросы старого боцмана'],
    text: ['A one-legged bosun with a pipe of black tobacco squints at your crew. "Two questions of the sea. Answer both and I\'ll stand you a purse. Answer none and you\'re no sailors at all."', 'Одноногий боцман с трубкой чёрного табака щурится на вашу команду. «Два вопроса о море. Ответите на оба — ставлю кошель. Ни на один — так вы и не моряки вовсе».'],
    questions: [
      { q: ['How many bells are struck at the end of a four-hour watch?', 'Сколько склянок бьют в конце четырёхчасовой вахты?'], options: [['Four', 'Четыре'], ['Six', 'Шесть'], ['Eight', 'Восемь'], ['Twelve', 'Двенадцать']], answer: 2 },
      { q: ['Where lies Davy Jones\' locker?', 'Где стоит рундук Дэви Джонса?'], options: [['Under the purser\'s bunk', 'Под койкой казначея'], ['At the bottom of the sea', 'На дне морском'], ['In the brig', 'В карцере'], ['In a Fogmouth tavern', 'В таверне Фогмута']], answer: 1 },
      { q: ['Facing the bow, which side is starboard?', 'Если стоять лицом к носу — где правый борт?'], options: [['On your right', 'Справа'], ['On your left', 'Слева'], ['Behind you', 'За спиной'], ['Whichever is to windward', 'С наветренной стороны']], answer: 0 },
      { q: ['A knot is a measure of what?', 'Узел — мера чего?'], options: [['Depth', 'Глубины'], ['The thickness of a rope', 'Толщины каната'], ['Speed: a sea mile in an hour', 'Скорости: морская миля в час'], ['The length of an anchor chain', 'Длины якорной цепи']], answer: 2 },
      { q: ['"Red sky at night" — what does it promise a sailor?', '«Красный закат» — что он сулит моряку?'], options: [['A storm by morning', 'Шторм к утру'], ['Fair weather tomorrow', 'Ясную погоду назавтра'], ['A death aboard', 'Смерть на борту'], ['A fair wind from the south', 'Попутный южный ветер']], answer: 1 },
    ],
    outcomes: {
      r2: { text: ['"Sailors after all!" He slaps the table and pays up: {silver}, and a yarn the crew will tell for a week.', '«Всё-таки моряки!» Он хлопает по столу и платит: {silver} — и байку, которую команда будет пересказывать неделю.'], win: true, pay: { silver: [150, 280], xp: 80, morale: 5 } },
      r1: { text: ['"Half a sailor." He tosses you {silver} for the one you knew.', '«Полморяка». Он бросает вам {silver} за то, что вы знали.'], win: true, pay: { silver: [50, 110], xp: 40 } },
      r0: { text: ['"Landlubbers." He spits in the fire. The crew are ashamed of their captain.', '«Сухопутные крысы». Он сплёвывает в огонь. Команде стыдно за капитана.'], win: false, pay: { xp: 15, morale: -4 } },
      walk: WALK,
    },
  }),
  star_bearing: M({
    id: 'star_bearing', kind: 'stars', art: 'card.enc_glowing_sea', face: 'icon.ab_star_fix', haunts: ['crag'], sea: true, weight: 9, rounds: 2,
    title: ['The Lost Pilot', 'Заблудившийся лоцман'],
    text: ['A pilot with a broken sextant has lost his reckoning. "Help me find my way by the sky, captain, and my charts are yours to copy." Above you the stars are out.', 'Лоцман со сломанным секстантом потерял счисление. «Помогите найти дорогу по небу, капитан, и мои карты — ваши, копируйте». Над вами высыпали звёзды.'],
    questions: [
      { q: ['In northern waters, which star stands still over the pole while all the others wheel around it?', 'В северных водах какая звезда стоит неподвижно над полюсом, пока остальные кружат вокруг неё?'], options: [['The Evening Star', 'Вечерняя звезда'], ['The Pole Star', 'Полярная звезда'], ['Sirius, the Dog Star', 'Сириус, Пёсья звезда'], ['Red Mars', 'Красный Марс']], answer: 1 },
      { q: ['At dusk the sun sets square on your left hand, on the port beam. Where is your bow pointing?', 'В сумерках солнце садится точно слева, на траверзе левого борта. Куда смотрит нос корабля?'], options: [['North', 'На север'], ['South', 'На юг'], ['East', 'На восток'], ['West', 'На запад']], answer: 0 },
      { q: ['At noon in northern waters, where does the sun stand?', 'В полдень в северных водах где стоит солнце?'], options: [['Due north', 'Точно на севере'], ['Due east', 'Точно на востоке'], ['Due south', 'Точно на юге'], ['Straight overhead, always', 'Всегда прямо над головой']], answer: 2 },
      { q: ['You steer due north, then come about sixteen points of the compass. What is your heading now?', 'Вы шли точно на север и повернули на шестнадцать румбов. Каков теперь курс?'], options: [['East', 'Восток'], ['West', 'Запад'], ['North-east', 'Северо-восток'], ['South', 'Юг']], answer: 3 },
    ],
    outcomes: {
      r2: { text: ['"By the Pole, you\'re a navigator!" He lets you copy his charts, and presses {silver} on you besides.', '«Клянусь Полярной, да вы штурман!» Он даёт скопировать карты, да ещё суёт вам {silver}.'], win: true, pay: { silver: [120, 240], xp: 80, map: 0.35 } },
      r1: { text: ['He finds his way, more or less. {silver} for your trouble.', 'Он кое-как находит дорогу. {silver} за хлопоты.'], win: true, pay: { silver: [50, 100], xp: 40 } },
      r0: { text: ['He sails off by your reckoning — the wrong way. You hope he never finds out whose.', 'Он уходит по вашему счислению — не в ту сторону. Остаётся надеяться, что он не узнает, чьему.'], win: false, pay: { xp: 15, morale: -2 } },
      walk: WALK,
    },
  }),
  // ------------------------------------------------------------------ games of chance (the server rolls)
  liars_dice: M({
    id: 'liars_dice', kind: 'dice', art: 'card.enc_smuggler', face: 'portrait.giver_tavern_keeper_m', haunts: ['shack'], sea: true, weight: 10, stake: 60,
    title: ['Liar\'s Dice', 'Кости лжеца'],
    text: ['The keeper of a grog shack rattles five bone dice in a leather cup. "Five for you, five for me. I bid, you call me a liar — or you raise." You see your own dice; his stay under the cup.', 'Хозяин хижины с грогом трясёт пять костяных кубиков в кожаном стакане. «Пять тебе, пять мне. Я делаю ставку, ты зовёшь меня лжецом — или повышаешь». Свои кости вы видите; его остаются под стаканом.'],
    choices: [{ id: 'liar', label: ['Liar!', 'Лжёшь!'] }, { id: 'raise', label: ['Raise by one', 'Поднять на одну'] }],
    outcomes: {
      win: { text: ['The cup comes up: {roll}. There are {count} of the face on the table. You were right — his stake is yours: {stake}.', 'Стакан поднят: {roll}. На столе таких граней: {count}. Вы правы — его ставка ваша: {stake}.'], win: true, pay: { stake: 1, xp: 30 } },
      lose: { text: ['The cup comes up: {roll}. There are {count} of the face on the table. He grins and sweeps up your stake: {stake}.', 'Стакан поднят: {roll}. На столе таких граней: {count}. Он ухмыляется и сгребает вашу ставку: {stake}.'], win: false, pay: { stake: -1, xp: 15 } },
      walk: WALK,
    },
  }),
  crown_anchor: M({
    id: 'crown_anchor', kind: 'anchor', art: 'card.enc_mutiny_brewing', face: 'icon.tattoo_crown', haunts: ['shack', 'camp'], sea: true, weight: 9, stake: 50,
    title: ['Crown and Anchor', 'Корона и якорь'],
    text: ['A deserter with a painted cloth and three dice: crown, anchor, heart, diamond, spade, club. "Put your silver on a sign. Every die that shows it pays you the stake again."', 'Дезертир с расписанной скатертью и тремя кубиками: корона, якорь, черви, бубны, пики, трефы. «Ставь серебро на знак. Каждый кубик, что его покажет, платит тебе ставку сверху».'],
    choices: [{ id: '0', label: ['Crown', 'Корона'] }, { id: '1', label: ['Anchor', 'Якорь'] }, { id: '2', label: ['Heart', 'Черви'] }, { id: '3', label: ['Diamond', 'Бубны'] }, { id: '4', label: ['Spade', 'Пики'] }, { id: '5', label: ['Club', 'Трефы'] }],
    symbols: [['Crown', 'Корона'], ['Anchor', 'Якорь'], ['Heart', 'Черви'], ['Diamond', 'Бубны'], ['Spade', 'Пики'], ['Club', 'Трефы']],
    outcomes: {
      h0: { text: ['The dice show {roll}. Not one of yours: he takes the stake, {stake}.', 'Выпало: {roll}. Ни одного вашего знака — он забирает ставку, {stake}.'], win: false, pay: { stake: -1, xp: 15 } },
      h1: { text: ['The dice show {roll}. One of yours: {stake} back to you and your stake besides.', 'Выпало: {roll}. Один ваш знак: {stake} вам, и ставка при вас.'], win: true, pay: { stake: 1, xp: 25 } },
      h2: { text: ['The dice show {roll}. Two of yours! He pays you {stake} with a sour face.', 'Выпало: {roll}. Два ваших знака! Он с кислой миной платит {stake}.'], win: true, pay: { stake: 2, xp: 35 } },
      h3: { text: ['The dice show {roll} — three of a kind, and all of them yours! {stake}, and the whole beach cheering.', 'Выпало: {roll} — все три ваши! {stake}, и весь пляж ликует.'], win: true, pay: { stake: 3, xp: 50, morale: 6 } },
      walk: WALK,
    },
  }),
  castaway_coin: M({
    id: 'castaway_coin', kind: 'coin', art: 'card.enc_raft', face: 'icon.coin', haunts: ['camp'], sea: true, weight: 8, stake: 70,
    title: ['Crown or Ship', 'Корона или корабль'],
    text: ['A castaway with nothing but a gold doubloon and a mad grin. "Crown or ship, captain? Call it, and double or nothing — it\'s all I have left, and I\'m bored to death."', 'Отшельник, у которого нет ничего, кроме золотого дублона и безумной ухмылки. «Корона или корабль, капитан? Говори — всё или ничего. Это всё, что у меня осталось, а скука смертная».'],
    choices: [{ id: 'crown', label: ['Crown', 'Корона'] }, { id: 'ship', label: ['Ship', 'Корабль'] }, { id: 'inspect', label: ['Ask to see the coin', 'Попросить монету'] }],
    outcomes: {
      win: { text: ['It spins, falls — {roll}. You win {stake}. He laughs as if losing were the best thing in years.', 'Монета крутится, падает — {roll}. Вы выиграли {stake}. Он хохочет, будто проигрыш — лучшее, что с ним случилось за годы.'], win: true, pay: { stake: 1, xp: 25 } },
      lose: { text: ['It spins, falls — {roll}. You lose {stake}. "Better luck at sea," he says, biting your silver.', 'Монета крутится, падает — {roll}. Вы проиграли {stake}. «Удачи в море», — говорит он, пробуя ваше серебро на зуб.'], win: false, pay: { stake: -1, xp: 15 } },
      edge: { text: ['It lands on its edge in the sand and stays there. He goes white. "An omen." He gives you his map and will not say another word.', 'Монета встаёт на ребро в песке и так и стоит. Он бледнеет. «Знамение». Отдаёт вам свою карту и больше не говорит ни слова.'], win: true, pay: { xp: 60, map: 1 } },
      cheat: { text: ['Crown on both sides! Caught, he pays you {stake} and begs you not to tell the crew.', 'Корона с обеих сторон! Пойманный, он платит {stake} и умоляет не говорить команде.'], win: true, pay: { stake: 1, xp: 40, morale: 3 } },
      honest: { text: ['An honest coin. He is offended to the bottom of his soul and will not play any more.', 'Честная монета. Он оскорблён до глубины души и больше играть не станет.'], win: false, pay: { xp: 10, morale: -2 } },
      walk: WALK,
    },
  }),
  three_shells: M({
    id: 'three_shells', kind: 'shells', art: 'card.enc_peddler', face: 'portrait.giver_fence_m', haunts: ['shack', 'cave'], sea: false, weight: 9, stake: 60,
    title: ['Three Shells', 'Три ракушки'],
    text: ['A fence with quick hands puts a pearl under one of three shells and shuffles them on an upturned barrel. "Follow the pearl, captain. Find it, and I pay what you put down."', 'Скупщик с ловкими руками прячет жемчужину под одну из трёх ракушек и тасует их на перевёрнутой бочке. «Следите за жемчужиной, капитан. Найдёте — плачу, сколько поставите».'],
    choices: [{ id: '0', label: ['Left', 'Левая'] }, { id: '1', label: ['Middle', 'Средняя'] }, { id: '2', label: ['Right', 'Правая'] }, { id: 'wrist', label: ['Grab his wrist!', 'Схватить за руку!'] }],
    outcomes: {
      win: { text: ['The pearl is there. He pays {stake} and smiles like a man who has lost worse.', 'Жемчужина на месте. Он платит {stake} и улыбается, как тот, кто терял и больше.'], win: true, pay: { stake: 1, xp: 30 } },
      lose: { text: ['Empty. The pearl was under the {count}. Your {stake} goes into his coat.', 'Пусто. Жемчужина была под {count} ракушкой. Ваши {stake} исчезают у него в кармане.'], win: false, pay: { stake: -1, xp: 15 } },
      palmed: { text: ['Empty — and so are the other two. He palmed the pearl all along. Your {stake} is gone.', 'Пусто — и под двумя другими тоже. Он с самого начала прятал жемчужину в ладони. Ваши {stake} пропали.'], win: false, pay: { stake: -1, xp: 15 } },
      caught: { text: ['You twist his wrist and the pearl drops out of his sleeve. He pays double to keep his fingers: {stake}.', 'Вы выкручиваете ему руку, и жемчужина выпадает из рукава. Чтобы сохранить пальцы, он платит вдвое: {stake}.'], win: true, pay: { stake: 2, xp: 45, morale: 4 } },
      wrong: { text: ['His sleeve is empty. He shouts for his friends; you pay {stake} to leave with your teeth.', 'Рукав пуст. Он зовёт дружков; вы платите {stake}, чтобы уйти с целыми зубами.'], win: false, pay: { stake: -1, xp: 10, morale: -3 } },
      walk: WALK,
    },
  }),
  // ------------------------------------------------------------------ memory and timing
  bosun_whistle: M({
    id: 'bosun_whistle', kind: 'memory', art: 'card.enc_squall', face: 'icon.omen_whistle', haunts: ['crag', 'shack'], sea: false, weight: 8, length: 5,
    title: ['The Bosun\'s Call', 'Боцманская дудка'],
    text: ['An old bosun marooned on the crag still keeps his silver call. "Pipe it back to me, note for note, and my pipe is your crew\'s. Miss a note and you\'re no crew of mine."', 'Старый боцман, высаженный на скалу, всё ещё хранит серебряную дудку. «Повтори мой сигнал нота в ноту — и дудка ваша. Собьёшься — какая из вас команда».'],
    symbols: [['Long', 'Долгий'], ['Short', 'Короткий'], ['Trill', 'Трель'], ['Low', 'Низкий']],
    outcomes: {
      win: { text: ['Note for note! He weeps into his beard and gives you his purse, {silver}. The crew pipe the call all the way home.', 'Нота в ноту! Он плачет в бороду и отдаёт вам кошель, {silver}. Команда насвистывает сигнал всю дорогу.'], win: true, pay: { silver: [110, 220], xp: 60, morale: 6 } },
      near: { text: ['One note wrong at the end. "Close," he grunts, and gives you {silver} for trying.', 'Одна нота мимо в конце. «Почти», — ворчит он и даёт {silver} за старание.'], win: true, pay: { silver: [40, 90], xp: 35 } },
      lose: { text: ['He covers his ears. "That\'s the call to abandon ship, you fool." The crew snigger.', 'Он затыкает уши. «Это же сигнал покинуть корабль, дурень». Команда хихикает.'], win: false, pay: { xp: 15, morale: -2 } },
      walk: WALK,
    },
  }),
  flag_hoist: M({
    id: 'flag_hoist', kind: 'memory', art: 'card.enc_pilot', face: 'icon.talent_cmd_signal_flags', haunts: ['crag'], sea: true, weight: 8, length: 6,
    title: ['Flag Hoist', 'Флажный сигнал'],
    text: ['A signal mast on the crag runs up a hoist of flags and hauls it down again. Repeat the hoist in the same order, and whoever keeps the station will know you for a friend.', 'Сигнальная мачта на скале поднимает гирлянду флагов и тут же спускает её. Повторите сигнал в том же порядке — и тот, кто держит пост, признает в вас друга.'],
    symbols: [['Red', 'Красный'], ['Yellow', 'Жёлтый'], ['Blue', 'Синий'], ['White', 'Белый'], ['Black', 'Чёрный']],
    outcomes: {
      win: { text: ['The station answers: "Well met." A keg of their stores comes down the cliff on a line: {n} {good}, and {silver} in a sealed pouch.', 'Пост отвечает: «Рады встрече». По канату со скалы спускают бочонок припасов: {n} {good}, и {silver} в запечатанном мешочке.'], win: true, pay: { silver: [80, 160], goods: ['provisions', 6, 12], xp: 60 } },
      near: { text: ['The station hesitates, then answers "Pass." {silver} for the effort.', 'Пост медлит, затем отвечает: «Проходите». {silver} за старание.'], win: true, pay: { silver: [30, 70], xp: 35 } },
      lose: { text: ['Your hoist reads "I am on fire and have plague aboard". The station fires a warning gun.', 'Ваш сигнал читается как «У меня пожар и чума на борту». Пост даёт предупредительный выстрел.'], win: false, pay: { xp: 15, morale: -3 } },
      walk: WALK,
    },
  }),
  compass_needle: M({
    id: 'compass_needle', kind: 'timing', art: 'card.enc_wisps', face: 'icon.item_brass_compass', haunts: ['cairn', 'crag'], sea: false, weight: 8, zone: 0.22, period: 2400, tries: 3,
    title: ['The Dead Man\'s Compass', 'Компас мертвеца'],
    text: ['On a cairn lies a brass compass whose needle swings like a pendulum. Scratched on the lid: "Stop it on north three times and it will show you what it hid." Stop the needle in the gold.', 'На кургане лежит медный компас, стрелка которого качается, как маятник. На крышке нацарапано: «Трижды останови на севере — и он покажет, что спрятал». Остановите стрелку на золоте.'],
    outcomes: {
      t3: { text: ['Three times true north! The lid springs open: {silver} in old coin and a scrap of chart.', 'Трижды точно на север! Крышка отщёлкивается: {silver} старой монетой и клочок карты.'], win: true, pay: { silver: [140, 260], xp: 70, map: 0.4 } },
      t2: { text: ['Twice north. The lid gives a little: {silver} slips out of it.', 'Дважды на север. Крышка чуть поддаётся: из неё выскальзывает {silver}.'], win: true, pay: { silver: [70, 150], xp: 45 } },
      t1: { text: ['Once north. The needle stops swinging and points at your ship. You take {silver} from under the stones.', 'Лишь однажды на север. Стрелка замирает и указывает на ваш корабль. Под камнями — {silver}.'], win: true, pay: { silver: [25, 60], xp: 30 } },
      t0: { text: ['The needle spins and spins. Whoever sleeps under the cairn is not pleased.', 'Стрелка крутится и крутится. Тот, кто спит под курганом, недоволен.'], win: false, pay: { xp: 15, sanity: -5, morale: -2 } },
      walk: WALK,
    },
  }),
  harpoon_lagoon: M({
    id: 'harpoon_lagoon', kind: 'timing', art: 'card.enc_giant_turtle', face: 'icon.mount_harpoon', haunts: ['camp', 'crag'], sea: false, weight: 8, zone: 0.26, period: 2100, tries: 3,
    title: ['Spear the Lagoon', 'Острога в лагуне'],
    text: ['The lagoon is thick with fat fish, but they dart like lightning. Your best harpooner stands on the rocks. Throw when the shadow crosses the mark — three throws.', 'Лагуна кишит жирной рыбой, но та мечется, как молния. Ваш лучший гарпунщик стоит на камнях. Бросайте, когда тень пересекает метку, — три броска.'],
    outcomes: {
      t3: { text: ['Three throws, three fish, and one of them with a pearl in its belly! {n} {good} and {silver}.', 'Три броска — три рыбы, и в брюхе одной жемчужина! {n} {good} и {silver}.'], win: true, pay: { goods: ['provisions', 10, 16], silver: [60, 140], xp: 60, morale: 6 } },
      t2: { text: ['Two fine fish: {n} {good} for the galley.', 'Две славные рыбины: {n} {good} на камбуз.'], win: true, pay: { goods: ['provisions', 6, 10], xp: 40, morale: 3 } },
      t1: { text: ['One small fish: {n} {good}. The cook is not impressed.', 'Одна рыбёшка: {n} {good}. Кок не впечатлён.'], win: true, pay: { goods: ['provisions', 2, 4], xp: 25 } },
      t0: { text: ['Three throws, three splashes. The fish laugh at you, and so does the crew.', 'Три броска — три всплеска. Рыба смеётся над вами, и команда тоже.'], win: false, pay: { xp: 10, morale: -2 } },
      walk: WALK,
    },
  }),
  // ------------------------------------------------------------------ the haggle
  beach_trader: M({
    id: 'beach_trader', kind: 'haggle', art: 'card.enc_fishermen', face: 'portrait.giver_merchant_m', haunts: ['camp', 'shack'], sea: false, weight: 7,
    title: ['The Beachcomber\'s Stall', 'Лавка на берегу'],
    text: ['A merchant washed ashore with his last crate sells from an upturned boat. One piece of fine gear, and a price he swears is robbery — his own.', 'Выброшенный на берег купец торгует с перевёрнутой лодки последним ящиком. Одна добрая вещь — и цена, которую он зовёт грабежом. Своим.'],
    outcomes: {
      bought: { text: ['Done. {item} is yours for {lost}.', 'По рукам. {item} ваш за {lost}.'], win: true, pay: { xp: 30 } },
      insulted: { text: ['"Robbery!" He spits at your feet, packs his crate and will not sell to you at any price.', '«Грабёж!» Он плюёт вам под ноги, закрывает ящик и не продаст вам ничего ни за какие деньги.'], win: false, pay: { xp: 10 } },
      poor: { text: ['Your purse is lighter than your words. He shrugs and packs up.', 'Ваш кошель легче ваших слов. Он пожимает плечами и собирает товар.'], win: false, pay: {} },
      full: { text: ['Your locker is full; there is nowhere to put it. He shrugs and packs up.', 'Ваш рундук полон — положить некуда. Он пожимает плечами и собирает товар.'], win: false, pay: {} },
      walk: WALK,
    },
  }),
  // ------------------------------------------------------------------ tales
  marooned_sailor: M({
    id: 'marooned_sailor', kind: 'quest', art: 'card.enc_deserters', face: 'portrait.giver_old_salt_m', haunts: ['camp'], sea: false, weight: 9, start: 'hut',
    title: ['The Marooned Man', 'Высаженный на остров'],
    text: ['A man with a beard to his belt stumbles out of a driftwood hut. Marooned three years ago, he says, with a pistol and one shot — and he never spent the shot.', 'Из хижины из плавника, спотыкаясь, выходит человек с бородой до пояса. Высажен три года назад, говорит он, с пистолетом и одним зарядом — и заряд так и не потратил.'],
    steps: {
      hut: {
        text: ['He begs to be taken off the island. His eyes keep going to a crooked palm up the beach.', 'Он умоляет забрать его с острова. Его взгляд то и дело возвращается к кривой пальме выше по берегу.'],
        choices: [
          { id: 'take', label: ['Take him aboard', 'Взять на борт'], go: 'secret' },
          { id: 'why', label: ['Ask why they marooned him', 'Спросить, за что его высадили'], go: 'why' },
          { id: 'leave', label: ['Leave him a cask of water', 'Оставить ему бочонок воды'], to: 'left' },
        ],
      },
      why: {
        text: ['He looks away. "I counted the plunder," he says. "Twice. They did not like my sums." Then, quietly: "They buried the rest under that palm."', 'Он отводит глаза. «Я пересчитал добычу, — говорит он. — Дважды. Им не понравились мои цифры». Потом тихо: «А остальное они зарыли под той пальмой».'],
        choices: [
          { id: 'dig', label: ['Dig under the palm', 'Копать под пальмой'], chance: 0.6, win: 'chest', lose: 'vipers' },
          { id: 'take', label: ['Take him aboard', 'Взять на борт'], go: 'secret' },
        ],
      },
      secret: {
        text: ['As the boat pushes off he grips your arm. "The palm, captain. Their chest is under the crooked palm. A share for me, and it is yours."', 'Когда шлюпка отваливает, он хватает вас за руку. «Пальма, капитан. Их сундук под кривой пальмой. Долю мне — и он ваш».'],
        choices: [
          { id: 'dig', label: ['Turn back and dig', 'Вернуться и копать'], chance: 0.65, win: 'chest_share', lose: 'vipers' },
          { id: 'home', label: ['Just take him home', 'Просто отвезти его'], to: 'joined' },
        ],
      },
    },
    outcomes: {
      joined: { text: ['He signs on and swears he will never count anything again. The crew like him.', 'Он записывается в команду и клянётся больше никогда ничего не считать. Команда его полюбила.'], win: true, pay: { hands: 1, xp: 45, morale: 4 } },
      chest: { text: ['Three feet down, a sea chest: {silver}. He weeps; you let him keep a handful, and he signs on.', 'На глубине трёх футов — морской сундук: {silver}. Он плачет; вы оставляете ему горсть, и он записывается в команду.'], win: true, pay: { silver: [200, 380], hands: 1, xp: 80, map: 0.2 } },
      chest_share: { text: ['The chest is there, as he swore: {silver} after his share. He signs on, grinning with three teeth.', 'Сундук на месте, как он и клялся: {silver} за вычетом его доли. Он записывается в команду, скалясь тремя зубами.'], win: true, pay: { silver: [170, 330], hands: 1, xp: 80, map: 0.2 } },
      vipers: { text: ['Under the palm is a nest of vipers, not a chest. {crew} of the diggers do not come back to the boat.', 'Под пальмой — гнездо гадюк, а не сундук. {crew} из копавших не вернулись к шлюпке.'], win: false, pay: { crew: 1, xp: 30, morale: -4 } },
      left: { text: ['You leave him water and sail on. He is still waving when the island drops astern.', 'Вы оставляете ему воду и уходите. Он всё ещё машет, когда остров скрывается за кормой.'], win: false, pay: { xp: 15, morale: -3 } },
      walk: WALK,
    },
  }),
  cursed_idol: M({
    id: 'cursed_idol', kind: 'quest', art: 'card.enc_ghost_bargain', face: 'icon.good_cursed_relics', haunts: ['cairn', 'cave'], sea: false, weight: 9, start: 'altar',
    title: ['The Cursed Idol', 'Проклятый идол'],
    text: ['In a ring of black stones sits a golden idol with ruby eyes. Around it lie the bones of men who reached for it, their fingers still pointing.', 'В кольце чёрных камней сидит золотой идол с рубиновыми глазами. Вокруг лежат кости тех, кто к нему тянулся, — их пальцы до сих пор указывают на него.'],
    steps: {
      altar: {
        text: ['The rubies catch the light. Nothing moves but the surf.', 'Рубины ловят свет. Не шевелится ничего, кроме прибоя.'],
        choices: [
          { id: 'take', label: ['Take the idol', 'Взять идола'], go: 'hum' },
          { id: 'swap', label: ['Swap it for a bag of sand', 'Подменить мешком песка'], chance: 0.5, win: 'swapped', lose: 'trap' },
          { id: 'offer', label: ['Leave an offering', 'Оставить подношение'], to: 'blessed' },
        ],
      },
      hum: {
        text: ['The stones begin to hum. The ground under the altar shivers, and your men look at you.', 'Камни начинают гудеть. Земля под алтарём дрожит, и люди смотрят на вас.'],
        choices: [
          { id: 'run', label: ['Run for the boats!', 'Бегом к шлюпкам!'], chance: 0.65, win: 'escaped', lose: 'crushed' },
          { id: 'back', label: ['Put it back, gently', 'Осторожно вернуть на место'], to: 'spared' },
        ],
      },
    },
    outcomes: {
      swapped: { text: ['The sand weighs true. The idol is yours; a Fogmouth fence would pay well, but you break the rubies out here: {silver}.', 'Песок весит как надо. Идол ваш; скупщик в Фогмуте заплатил бы щедро, но вы выковыриваете рубины здесь же: {silver}.'], win: true, pay: { silver: [250, 450], xp: 90, curse: 5 } },
      trap: { text: ['The altar sinks an inch — and the stones fall. {crew} of your men stay in the ring for ever.', 'Алтарь опускается на дюйм — и камни рушатся. {crew} ваших людей навсегда остаются в кольце.'], win: false, pay: { crew: 2, xp: 40, morale: -6 } },
      blessed: { text: ['You leave a coin and a tot of rum. The rubies seem to soften. The crew sleep well that night.', 'Вы оставляете монету и чарку рома. Рубины будто теплеют. В ту ночь команда спит спокойно.'], win: true, pay: { loseSilver: [10, 20], xp: 40, sanity: 12, morale: 5 } },
      escaped: { text: ['You run, the idol under your arm, and the stones close behind you like teeth. {silver} in gold and rubies — and something follows you to sea.', 'Вы бежите с идолом под мышкой, и камни смыкаются за спиной, как зубы. {silver} золотом и рубинами — и что-то увязывается за вами в море.'], win: true, pay: { silver: [300, 500], xp: 100, curse: 20, sanity: -10 } },
      crushed: { text: ['The ring closes. You get out with a ruby — {silver} — and without {crew} of your men.', 'Кольцо смыкается. Вы выбираетесь с одним рубином — {silver} — и без {crew} своих людей.'], win: false, pay: { silver: [120, 220], crew: 2, xp: 50, curse: 15, morale: -6 } },
      spared: { text: ['The hum dies. The bones seem to relax. Whatever lives here lets you go.', 'Гул стихает. Кости будто расслабляются. Тот, кто здесь живёт, отпускает вас.'], win: false, pay: { xp: 35, morale: -1 } },
      walk: WALK,
    },
  }),
  smugglers_cave: M({
    id: 'smugglers_cave', kind: 'quest', art: 'card.enc_barrel', face: 'portrait.giver_smuggler_f', haunts: ['cave'], sea: false, weight: 9, start: 'mouth',
    title: ['The Smugglers\' Cave', 'Грот контрабандистов'],
    text: ['A sea cave, half drowned at high tide. Fresh rope marks on the rock, a lantern hook, and the smell of rum.', 'Морской грот, наполовину затопленный в прилив. Свежие следы каната на камне, крюк для фонаря и запах рома.'],
    steps: {
      mouth: {
        text: ['The tide is still in. The water in the cave mouth is black and cold.', 'Прилив ещё не спал. Вода у входа в грот чёрная и холодная.'],
        choices: [
          { id: 'wait', label: ['Wait for low tide', 'Дождаться отлива'], go: 'inside' },
          { id: 'swim', label: ['Swim in now', 'Плыть сейчас'], chance: 0.5, win: 'stash', lose: 'undertow' },
        ],
      },
      inside: {
        text: ['Inside: casks, a ledger on a crate — and footsteps coming down the cliff path. The smugglers are back.', 'Внутри — бочонки, конторская книга на ящике… и шаги по тропе со скалы. Контрабандисты возвращаются.'],
        choices: [
          { id: 'hide', label: ['Hide and watch', 'Спрятаться и следить'], chance: 0.6, win: 'ledger', lose: 'found' },
          { id: 'grab', label: ['Grab the casks and run', 'Схватить бочонки и бежать'], chance: 0.55, win: 'casks', lose: 'fight' },
          { id: 'parley', label: ['Step out and parley', 'Выйти и договориться'], chance: 0.55, win: 'deal', lose: 'robbed' },
        ],
      },
    },
    outcomes: {
      stash: { text: ['You come up in an air pocket beside a stash: {n} {good} and {silver} in a tarred bag.', 'Вы выныриваете в воздушном кармане рядом с тайником: {n} {good} и {silver} в просмолённом мешке.'], win: true, pay: { goods: ['rum', 4, 8], silver: [100, 200], xp: 60 } },
      undertow: { text: ['The undertow drags your swimmers against the rocks. {crew} does not come up.', 'Подводное течение бьёт пловцов о камни. {crew} не выплыл.'], win: false, pay: { crew: 1, xp: 25, morale: -4 } },
      ledger: { text: ['They count their casks and leave. You take the ledger — their buyers, their coves, a chart — and {silver} from the strongbox.', 'Они пересчитывают бочонки и уходят. Вы забираете книгу — покупатели, бухты, карта — и {silver} из сундучка.'], win: true, pay: { silver: [120, 220], map: 0.6, xp: 70 } },
      found: { text: ['A lantern swings your way. Knives out; you get away, but lose {crew} and {lost} dropped in the dark.', 'Фонарь поворачивается в вашу сторону. Ножи наголо; вы уходите, но теряете {crew} и {lost}, обронённые в темноте.'], win: false, pay: { crew: 1, loseSilver: [40, 90], xp: 30, morale: -3 } },
      casks: { text: ['You roll the casks out under their noses: {n} {good}.', 'Вы выкатываете бочонки у них из-под носа: {n} {good}.'], win: true, pay: { goods: ['rum', 6, 12], xp: 55, morale: 3 } },
      fight: { text: ['A fight in the dark. You get out with nothing, and {crew} of your men stay behind.', 'Драка в темноте. Вы уходите ни с чем, а {crew} ваших людей остаются там.'], win: false, pay: { crew: 2, xp: 35, morale: -5 } },
      deal: { text: ['"Bold." Their leader laughs and sells you {n} {good} for a song — and a name to ask for in any cove.', '«Смело». Их главарь смеётся и продаёт вам {n} {good} за бесценок — и имя, которое стоит называть в любой бухте.'], win: true, pay: { goods: ['tobacco', 4, 8], xp: 55 } },
      robbed: { text: ['They take your purse for your trouble: {lost}. At least they let you keep your boots.', 'За беспокойство они забирают кошель: {lost}. Хорошо хоть сапоги оставили.'], win: false, pay: { loseSilver: [60, 120], xp: 25, morale: -3 } },
      walk: WALK,
    },
  }),
  mutineers_grave: M({
    id: 'mutineers_grave', kind: 'quest', art: 'card.enc_sunken_bell', face: 'icon.deed_mutiny', haunts: ['cairn'], sea: false, weight: 8, start: 'grave',
    title: ['The Mutineer\'s Grave', 'Могила бунтовщика'],
    text: ['A driftwood cross: "HERE LIES JACK RENNARD, WHO TOOK THE SHIP AND LOST HER. DIG AT YOUR PERIL." The earth over him is freshly turned.', 'Крест из плавника: «ЗДЕСЬ ЛЕЖИТ ДЖЕК РЕННАРД, КОТОРЫЙ ЗАХВАТИЛ КОРАБЛЬ И ПОГУБИЛ ЕГО. КОПАЙ НА СВОЙ СТРАХ». Земля над ним свежевскопана.'],
    steps: {
      grave: {
        text: ['Someone has been digging here — and stopped. A spade lies on the mound.', 'Кто-то здесь копал — и бросил. На холмике лежит лопата.'],
        choices: [
          { id: 'dig', label: ['Dig', 'Копать'], go: 'coffin' },
          { id: 'read', label: ['Read the rest of the carving', 'Прочесть надпись до конца'], go: 'carving' },
        ],
      },
      carving: {
        text: ['Below, smaller: "His share went down with him. God forgive the man who takes it."', 'Ниже, мелко: «Его доля ушла в землю вместе с ним. Да простит Бог того, кто её возьмёт».'],
        choices: [
          { id: 'dig', label: ['Dig anyway', 'Всё равно копать'], go: 'coffin' },
          { id: 'pray', label: ['Say a prayer for him', 'Помолиться за него'], to: 'prayed' },
        ],
      },
      coffin: {
        text: ['The spade strikes wood. The lid is nailed shut — from the inside.', 'Лопата стучит о дерево. Крышка заколочена — изнутри.'],
        choices: [
          { id: 'open', label: ['Prise it open', 'Вскрыть'], chance: 0.55, win: 'share', lose: 'rennard' },
          { id: 'rebury', label: ['Fill it in and go', 'Засыпать и уйти'], to: 'reburied' },
        ],
      },
    },
    outcomes: {
      share: { text: ['Jack Rennard lies on his share like a dragon on its hoard: {silver}. He does not object.', 'Джек Реннард лежит на своей доле, как дракон на кладе: {silver}. Он не возражает.'], win: true, pay: { silver: [220, 420], xp: 90, curse: 10 } },
      rennard: { text: ['Jack Rennard sits up. The men scatter; when they stop running, {crew} is missing and nobody sleeps.', 'Джек Реннард садится в гробу. Люди разбегаются; когда они останавливаются, одного не хватает, и никто не спит. Потеряно: {crew}.'], win: false, pay: { crew: 1, sanity: -15, curse: 12, xp: 45, morale: -5 } },
      prayed: { text: ['You say the words over him. The wind drops. The crew are quiet and grateful.', 'Вы читаете над ним молитву. Ветер стихает. Команда притихла и благодарна.'], win: true, pay: { xp: 45, morale: 6, sanity: 10 } },
      reburied: { text: ['You fill in the grave and leave the spade on it, for the next fool.', 'Вы засыпаете могилу и оставляете лопату на холмике — для следующего дурака.'], win: false, pay: { xp: 35 } },
      walk: WALK,
    },
  }),
  three_levers: M({
    id: 'three_levers', kind: 'quest', art: 'card.enc_derelict', face: 'prop.cache', haunts: ['cave', 'cairn'], sea: false, weight: 8, start: 'chest',
    title: ['The Chest of Three Levers', 'Сундук с тремя рычагами'],
    text: ['An iron-bound chest bolted to the rock, three levers on its lid — brass, iron and bone — and words cut above each. Over them all: "ONE OF US SPEAKS TRUE."', 'Окованный железом сундук, прикрученный к скале, на крышке три рычага — медный, железный и костяной, — и над каждым вырезаны слова. Над всеми: «ЛИШЬ ОДИН ИЗ НАС ГОВОРИТ ПРАВДУ».'],
    steps: {
      chest: {
        text: ['Brass: "The treasure lever is not me." Iron: "The treasure lever is the bone." Bone: "The iron lies." The wrong lever, the old hands say, fires the trap.', 'Медный: «Кладовый рычаг — не я». Железный: «Кладовый рычаг — костяной». Костяной: «Железный лжёт». Не тот рычаг, говорят бывалые, спускает ловушку.'],
        choices: [
          { id: 'brass', label: ['Pull the brass', 'Потянуть медный'], to: 'opened' },
          { id: 'iron', label: ['Pull the iron', 'Потянуть железный'], to: 'dart' },
          { id: 'bone', label: ['Pull the bone', 'Потянуть костяной'], to: 'blade' },
          { id: 'axe', label: ['Take an axe to it', 'Рубить топором'], chance: 0.3, win: 'smashed', lose: 'blast' },
        ],
      },
    },
    outcomes: {
      opened: { text: ['Only the brass spoke true, as a moment\'s thought shows. The lid swings up: {silver}, and more.', 'Правду говорил лишь медный — стоит немного подумать. Крышка откидывается: {silver}, и не только.'], win: true, pay: { silver: [230, 420], item: 0.35, xp: 100 } },
      dart: { text: ['A dart from the lock. The man at the lever falls, and {crew} is lost. The chest stays shut.', 'Из замка вылетает дротик. Человек у рычага падает — потерян {crew}. Сундук остаётся закрытым.'], win: false, pay: { crew: 1, xp: 30, morale: -4 } },
      blade: { text: ['A blade springs from the lid and takes a hand. {crew} will pull no more ropes. The chest stays shut.', 'Из крышки выскакивает лезвие и отсекает руку. {crew} больше не тянуть канатов. Сундук остаётся закрытым.'], win: false, pay: { crew: 1, xp: 30, morale: -4 } },
      smashed: { text: ['The hinges give before the trap does. Half the coin is bent, but it spends: {silver}.', 'Петли сдаются раньше ловушки. Половина монет погнута, но и такими платят: {silver}.'], win: true, pay: { silver: [100, 200], xp: 50 } },
      blast: { text: ['A powder charge in the lid. The chest and {crew} of your men go up together.', 'В крышке пороховой заряд. Сундук и {crew} ваших людей взлетают на воздух вместе.'], win: false, pay: { crew: 2, xp: 30, morale: -6 } },
      walk: WALK,
    },
  }),
  split_map: M({
    id: 'split_map', kind: 'quest', art: 'card.enc_mapmaker', face: 'icon.map_treasure', haunts: ['camp', 'cave'], sea: false, weight: 8, start: 'stranger',
    title: ['Half a Map', 'Половина карты'],
    text: ['A one-eyed woman at a campfire holds up half a map. "You have a ship. I have the half that matters. We dig together, and we split it fair."', 'Одноглазая женщина у костра показывает половину карты. «У тебя корабль. У меня — та половина, что важна. Копаем вместе и делим честно».'],
    steps: {
      stranger: {
        text: ['Her half shows a skull-shaped rock just up the beach. Her hand stays near her knife.', 'На её половине — скала в форме черепа чуть выше по берегу. Её рука не отходит от ножа.'],
        choices: [
          { id: 'trust', label: ['Dig together', 'Копать вместе'], go: 'dig' },
          { id: 'buy', label: ['Buy her half outright', 'Выкупить её половину'], to: 'bought' },
        ],
      },
      dig: {
        text: ['At the skull rock your spade strikes a chest. She watches you, and you watch her.', 'У скалы-черепа лопата ударяет в сундук. Она следит за вами, а вы — за ней.'],
        choices: [
          { id: 'split', label: ['Split it fair', 'Поделить честно'], to: 'fair' },
          { id: 'all', label: ['Take it all', 'Забрать всё'], chance: 0.5, win: 'greed', lose: 'knifed' },
          { id: 'give', label: ['Let her have it, keep her map', 'Отдать ей всё, взять её карту'], to: 'keepsake' },
        ],
      },
    },
    outcomes: {
      bought: { text: ['She takes {lost} and is gone before you look up from the map. The X is not here — but the map is real.', 'Она берёт {lost} и исчезает, пока вы разглядываете карту. Крестик не здесь — но карта настоящая.'], win: true, pay: { loseSilver: [60, 110], map: 1, xp: 40 } },
      fair: { text: ['Half each, as agreed: {silver} for you. She tips her hat. "An honest pirate. I\'ll tell the coves."', 'Пополам, как договаривались: {silver} вам. Она приподнимает шляпу. «Честный пират. Расскажу в бухтах».'], win: true, pay: { silver: [160, 300], xp: 70, morale: 4 } },
      greed: { text: ['You take it all and leave her on the sand. {silver} — and the crew look at you a little differently.', 'Вы забираете всё и оставляете её на песке. {silver} — и команда смотрит на вас немного иначе.'], win: true, pay: { silver: [280, 480], xp: 60, morale: -6, curse: 5 } },
      knifed: { text: ['Her knife is quicker than your greed. She runs with the chest; you run with {silver} spilled from it, and without {crew}.', 'Её нож быстрее вашей жадности. Она убегает с сундуком; вам достаётся {silver}, просыпанное из него, — и вы теряете {crew}.'], win: false, pay: { silver: [60, 120], crew: 1, xp: 40, morale: -4 } },
      keepsake: { text: ['She stares, then laughs and hands you her half of the map — "the other X is yours". The crew think you mad, and love you for it.', 'Она смотрит во все глаза, потом смеётся и отдаёт вам свою половину — «второй крестик твой». Команда считает вас безумцем и любит за это.'], win: true, pay: { map: 0.8, xp: 60, morale: 8 } },
      walk: WALK,
    },
  }),
};

export const MINIGAME_IDS = Object.keys(MINIGAMES) as MinigameId[];

/** The largest silver base any outcome pays (the balance test holds every outcome to it). */
export const MINI_SILVER_CAP = 500;
