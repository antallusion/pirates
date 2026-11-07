// «Лоцманская книга» · Рост капитана: levels and experience, talents, skills, the campaign, quests, contracts and
// dailies, the season card, the «Мощь» rating and the PvP board, promo codes, the daily gift, the shop. Numbers as in
// the code on 2026-11-02 (shared/src/constants.ts, data/xpcurve.ts, talents.ts, hero.ts, seasonskill.ts, campaign/,
// dailies.ts, seasonpass.ts, power.ts, pvprank.ts, promocodes.ts, dailygift.ts, shop.ts). Shots: tools/guide/shots-qa.mjs.
import type { GuideArticle } from './types.ts';

/** A slide's shot: assets/guide/<article>-<n>.webp, given by its bare file name (the engine's way). */
const img = (id: string, n: number): string => `${id}-${n}.webp`;

export const ARTICLES: GuideArticle[] = [
  {
    id: 'prog-levels',
    section: 'progress',
    title: ['Levels and experience', 'Уровни и опыт'],
    tags: ['level', 'experience', 'xp', 'rested', 'уровень', 'опыт', 'отдых', 'очки таланта'],
    summary: [
      'Up to level 60. Quests are the steadiest source of experience; each level gives a talent point.',
      'До 60-го уровня. Задания — самый ровный источник опыта; каждый уровень даёт очко таланта.',
    ],
    slides: [
      {
        img: img('prog-levels', 1),
        text: [
          'The number on your portrait is your captain\'s level, up to 60.',
          'Число на портрете — уровень капитана, до 60-го.',
        ],
      },
      {
        img: img('prog-levels', 2),
        text: [
          'The Captain window shows the bar to the next level. Experience: a quest pays like ten ships of your level, a boarding two sinkings, the daily chest fourteen; grey targets give nothing, stronger ones up to half again more.',
          'Окно «Капитан» показывает полоску до следующего уровня. Опыт: задание стоит как десяток кораблей вашего уровня, абордаж — как два потопления, сундук поручений дня — как четырнадцать; серые цели не дают ничего, сильнее вас — до полутора раз больше.',
        ],
        show: { open: 'hero' },
      },
      {
        img: img('prog-levels', 3),
        text: [
          'Every level after the first is one talent point («Free: N points»). Resting in port fills a pool — 1/20 of a level per 8 hours, up to 1.5 levels — and battle experience counts double until it is spent.',
          'Каждый уровень после первого — очко таланта («Свободно: N очков»). Отдых в порту копит запас — 1/20 уровня за 8 часов, до полутора уровней, — и опыт за бои идёт вдвойне, пока он не кончится.',
        ],
        show: { open: 'talents' },
      },
    ],
    related: ['prog-talents', 'prog-skills'],
    firstTime: 'level-2',
  },
  {
    id: 'prog-talents',
    section: 'progress',
    title: ['Talents: the wind rose', 'Таланты: роза ветров'],
    tags: ['talents', 'tree', 'points', 'respec', 'таланты', 'ветвь', 'очки', 'переучивание', 'роза ветров'],
    summary: [
      'Ten trees around the wind rose; tiers open at 0/5/10/15/20 points in a tree.',
      'Десять ветвей вокруг розы ветров; ярусы открываются при 0/5/10/15/20 очках в ветви.',
    ],
    slides: [
      {
        img: img('prog-talents', 1),
        text: [
          'Open «Talents» (key T, or the Captain window → «Talents»). Ten trees around the wind rose: Navigation, Exploration, the Abyss, Survival, Shipwright, Command, Gunnery, Boarding, Smuggling, Trade.',
          'Откройте «Таланты» (клавиша T или окно «Капитан» → «Таланты»). Вокруг розы ветров десять ветвей: Навигация, Исследование, Бездна, Живучесть, Корабельное дело, Командование, Артиллерия, Абордаж, Контрабанда, Торговля.',
        ],
        show: { open: 'talents' },
      },
      {
        img: img('prog-talents', 2),
        text: [
          'Tap a tree: its tiers open at 0, 5, 10, 15 and 20 points spent in it; keystones want 25 points and level 25. Tap a talent to learn a rank.',
          'Нажмите на ветвь: её ярусы открываются при 0, 5, 10, 15 и 20 очках в ней; краеугольные таланты — при 25 очках и 25-м уровне. Нажмите на талант, чтобы взять ранг.',
        ],
      },
      {
        img: img('prog-talents', 3),
        text: [
          'Respec works only in port, with a 10-minute break between changes; two sets («1» and «2») keep two builds.',
          'Переучиться можно только в порту, с перерывом 10 минут; два набора («1» и «2») хранят две сборки.',
        ],
      },
    ],
    related: ['prog-levels', 'exp-nav'],
    window: 'talents',
  },
  {
    id: 'prog-skills',
    section: 'progress',
    title: ['Skills of the captain', 'Навыки и умения капитана'],
    tags: ['skills', 'primary', 'secondary', 'abilities', 'навыки', 'первичные', 'вторичные', 'умения', 'атака', 'защита'],
    summary: [
      'HoMM-style: primary skills grow every level, secondary skills are picked one of two; sea abilities rank up with the level.',
      'Как в «Героях»: первичные навыки растут каждый уровень, вторичные выбираются один из двух; морские умения растут с уровнем.',
    ],
    slides: [
      {
        img: img('prog-skills', 1),
        text: [
          'Captain → «Hero»: the primary skills — Attack, Defence, Order Power, Will. One grows each level.',
          'Капитан → «Герой»: первичные навыки — Атака, Защита, Сила приказов, Воля. Каждый уровень один из них растёт.',
        ],
        show: { open: 'hero' },
      },
      {
        img: img('prog-skills', 2),
        text: [
          '«New level: choose a skill»: one of two secondary skills, «Take». There are 12 of them and 8 slots; each is kin to a talent tree.',
          '«Новый уровень: выберите навык»: один из двух вторичных навыков, «Взять». Всего их 12, ячеек 8; каждый родствен своей ветви талантов.',
        ],
      },
      {
        img: img('prog-skills', 3),
        text: [
          '«Abilities»: your sea abilities Z, X, C and the passive rank up at levels 1, 12, 24, 36, 48, the ultimate V at 6, 20, 35, 50. Facets open at ranks 3 and 5.',
          '«Умения»: морские умения Z, X, C и пассивное растут на 1, 12, 24, 36 и 48-м уровнях, высшее V — на 6, 20, 35 и 50-м. Грани открываются на 3-м и 5-м рангах.',
        ],
        show: { open: 'skills' },
      },
    ],
    related: ['prog-levels', 'prog-talents'],
    window: 'hero',
  },
  {
    id: 'prog-campaign',
    section: 'progress',
    title: ['The campaign', 'Кампания'],
    tags: ['campaign', 'story', 'chapter', 'кампания', 'сюжет', 'глава'],
    summary: [
      '36 chapters, 720 quests: one at a time, the next comes by itself when your level allows.',
      '36 глав, 720 заданий: одно за раз, следующее приходит само, когда позволяет уровень.',
    ],
    slides: [
      {
        img: img('prog-campaign', 1),
        text: [
          '«Journal» → «Quests»: the campaign is on top, under «Story». Tap it for the giver, the steps and the pay.',
          '«Журнал» → «Задания»: кампания — сверху, в группе «Сюжет». Нажмите — откроются её даритель, шаги и плата.',
        ],
        show: { open: 'journal' },
      },
      {
        img: img('prog-campaign', 2),
        text: [
          '«Campaign» opens the chapter book: where you are and what is ahead, each chapter with its levels. Some steps are forks where you choose a way.',
          '«Кампания» открывает книгу глав: где вы и что впереди, у каждой главы — её уровни. Некоторые шаги — развилки, где вы выбираете путь.',
        ],
      },
      {
        img: img('prog-campaign', 3),
        text: [
          'The next quest comes by itself once your level allows («the next from level N»). «Goals and news» at sea shows the current one. Playing only the campaign brings you to level 60 by its end; past chapter 31 the way through the Maelstrom Wall opens.',
          'Следующее задание приходит само, когда позволяет уровень («следующее с уровня N»). «Цели и вести» в море показывают текущее. Одна кампания приводит к 60-му уровню к своему концу; после 31-й главы открывается путь сквозь Стену Мальстрима.',
        ],
      },
    ],
    related: ['prog-quests'],
    window: 'journal',
  },
  {
    id: 'prog-quests',
    section: 'progress',
    title: ['Quests, grouped by the giver', 'Задания по местам выдачи'],
    tags: ['quests', 'journal', 'giver', 'distance', 'sail there', 'задания', 'журнал', 'сдавать здесь', 'плыть туда', 'доска'],
    summary: [
      'Take quests from a port\'s board; the journal groups them by the place to hand them in, nearest first.',
      'Берите задания с доски порта; журнал группирует их по месту сдачи, ближайшие — сверху.',
    ],
    slides: [
      {
        img: img('prog-quests', 1),
        text: [
          'Port → «Quests»: the board, best for you first, with chips «All», «Side», «Jobs», «Contracts», «Urgent», «For the day», «Guild», «Taken». «Take» opens the giver\'s words, the steps and the pay.',
          'Порт → «Задания»: доска, лучшее для вас — первым, с фильтрами «Все», «Побочные», «Поручения», «Контракты», «Срочные», «На день», «Гильдия», «Взятые». «Взять» откроет слова дарителя, шаги и плату.',
        ],
        show: { open: 'port:quests' },
      },
      {
        img: img('prog-quests', 2),
        text: [
          'In the journal quests are grouped: «Story», then each port and island with «hand in here · N km to it», nearest first, then «Contracts» and «Dailies».',
          'В журнале задания сгруппированы: «Сюжет», потом каждый порт и остров с пометкой «сдавать здесь · до него N км», ближайшие — первыми, затем «Контракты» и «Ежедневные».',
        ],
        show: { open: 'journal' },
      },
      {
        img: img('prog-quests', 3),
        text: [
          'Every quest has its distance and a «Sail there» button: the helmsman lays the course.',
          'У каждого задания — расстояние и кнопка «Плыть туда»: рулевой проложит курс.',
        ],
      },
    ],
    related: ['prog-contracts', 'prog-campaign'],
    window: 'journal',
    firstTime: 'first-quest',
  },
  {
    id: 'prog-contracts',
    section: 'progress',
    title: ['Contracts and daily orders', 'Контракты и поручения дня'],
    tags: ['contracts', 'dailies', 'orders', 'chest', 'streak', 'контракты', 'ежедневные', 'поручения дня', 'сундук', 'серия'],
    summary: [
      'Contracts pay silver and experience; three daily orders and their chest reset at midnight UTC.',
      'Контракты платят серебром и опытом; три поручения дня и их сундук обновляются в полночь по UTC.',
    ],
    slides: [
      {
        img: img('prog-contracts', 1),
        text: [
          '«Contracts» on the board: deliveries, couriers, bounties (only in lawful ports). Each port posts 4, renewed every 15 minutes; you may hold up to 60. Each also gives 45 season experience.',
          '«Контракты» на доске: доставки, курьеры, охота за головами (только в законных портах). В каждом порту их 4, обновляются каждые 15 минут; взять можно до 60. Каждый даёт и 45 опыта сезона.',
        ],
        show: { open: 'port:quests' },
      },
      {
        img: img('prog-contracts', 2),
        text: [
          '«For the day»: three daily orders by your level. All three open a chest; its silver grows 10 % a day for a streak, up to 5 days.',
          '«На день»: три поручения дня по вашему уровню. Все три открывают сундук; его серебро растёт на 10 % за каждый день подряд, до 5 дней.',
        ],
      },
      {
        img: img('prog-contracts', 3),
        text: [
          'The same orders are in the journal under «Dailies», with the weekly contests and the common goal of the sea.',
          'Те же поручения — в журнале, в группе «Ежедневные», вместе с испытаниями недели и общим делом моря.',
        ],
        show: { open: 'journal' },
      },
    ],
    related: ['prog-quests', 'prog-pass'],
    window: 'port:quests',
  },
  {
    id: 'prog-pass',
    section: 'progress',
    title: ['The season card', 'Сезонная карта'],
    tags: ['season', 'pass', 'premium', 'super pass', 'tiers', 'сезон', 'пропуск', 'премиум', 'суперпропуск', 'ступени', 'испытания'],
    summary: [
      '100 tiers in two months; a free track and a premium one. Season experience comes from almost everything you do.',
      '100 ступеней за два месяца; бесплатная дорожка и премиум. Опыт сезона дают почти все дела.',
    ],
    slides: [
      {
        img: img('prog-pass', 1),
        text: [
          'The «Season» button opens the season card: your tier, the season experience bar and two tracks of rewards, «Free» and «Premium». «Claim all» takes what you have earned.',
          'Кнопка «Сезон» открывает сезонную карту: ступень, полоска опыта сезона и две дорожки наград — «Бесплатно» и «Премиум». «Забрать всё» забирает заработанное.',
        ],
        show: { open: 'pass' },
      },
      {
        img: img('prog-pass', 2),
        text: [
          'The premium track opens with the «Premium pass»; the «Super pass» is the premium track plus 20 tiers at once and the «Abyss» frame. Tier 100 gives a ⚓7 «Thunderer».',
          'Премиум-дорожку открывает «Премиум-пропуск»; «Суперпропуск» — это премиум и сразу 20 ступеней, плюс рамка «Бездна». На 100-й ступени — «Громовержец» ⚓7.',
        ],
      },
      {
        img: img('prog-pass', 3),
        text: [
          '«Challenges»: 3 daily (150 each) and 4 weekly (900 each). Season experience also comes from quests, contracts, lairs, bosses, PvP, treasures and the island, each with a daily limit.',
          '«Испытания»: 3 дневных (по 150) и 4 недельных (по 900). Опыт сезона дают и задания, контракты, логова, боссы, ПвП, клады и остров — у каждого свой дневной предел.',
        ],
      },
      {
        img: img('prog-pass', 4),
        text: [
          '«Pass ★» compares the passes and their prices.',
          '«Пропуск ★» сравнивает пропуска и их цены.',
        ],
      },
      {
        img: img('prog-pass', 5),
        text: [
          'A season lasts two calendar months: season 1, «Storm over Gravewater», runs to 31 December; the card shows how long is left.',
          'Сезон длится два календарных месяца: первый, «Шторм над Гравуотером», — до 31 декабря; сколько осталось, видно на карте.',
        ],
      },
    ],
    related: ['prog-contracts', 'prog-shop', 'prog-creatures', 'prog-hunts'],
    window: 'pass',
    firstTime: 'season-pass',
  },
  {
    // forum 2026-11-07, Эдуард: «Победите в 3 боях с существами: логова, стаи или дрейфы — что это и где почитать?»
    id: 'prog-creatures',
    section: 'progress',
    title: ['Creature fights: lairs, stacks, drifts', 'Бои с тварями: логова, отряды, дрейфы'],
    tags: ['lair', 'stack', 'drift', 'creatures', 'challenge', 'логово', 'отряд', 'дрейф', 'твари', 'испытание'],
    summary: [
      'Three kinds of creature fights: a lair on an island, a stack roaming the sea, a creature adrift. Each one won counts for the season challenge.',
      'Три вида боёв с тварями: логово на острове, отряд в море, тварь в дрейфе. Каждый выигранный засчитывается в испытание сезона.',
    ],
    slides: [
      {
        img: img('prog-creatures', 1),
        text: [
          'A lair is a den of creatures on an island: a mark with its name and a word of its strength («A few», «Many»). Come in to its beach and press «Landing»: the boats take your men ashore and the fight goes on the hexes.',
          'Логово — гнездо тварей на острове: метка с названием и словом силы («Горстка», «Много»). Подойдите к его берегу и нажмите «Высадка»: шлюпки свезут бойцов на берег, и бой пойдёт на гексах.',
        ],
      },
      {
        img: img('prog-creatures', 2),
        text: [
          'A stack of creatures roams the sea between the islands: seals, sharks, crabs and worse. Tap it and «Attack»: the helmsman takes you in and the boats go over by themselves.',
          'Отряд тварей бродит по морю между островами: тюлени, акулы, крабы и кто похуже. Нажмите на него и «Атаковать» — рулевой подведёт корабль, а шлюпки пойдут сами.',
        ],
      },
      {
        img: img('prog-creatures', 3),
        text: [
          'A drift is a creature on floating wreckage or an ice floe, sighted by your lookout. It waits for you alone a while: rescue it for a gift, or fight it. Every creature fight won, of any level, counts for the season challenge; «Sail» on its card takes you to the nearest one your landing party can beat.',
          'Дрейф — тварь на плавучих обломках или льдине, её замечает впередсмотрящий. Какое-то время она ждёт только вас: спасите её ради подарка или бейтесь. Каждый выигранный бой с тварями любого уровня идёт в испытание сезона; «Плыть» в его карточке ведёт к ближайшему, который по силам вашему десанту.',
        ],
      },
    ],
    related: ['exp-lairs', 'prog-pass', 'prog-hunts'],
    window: 'pass',
  },
  {
    // forum 2026-11-07, Эдуард: «Поучаствуйте в 5 охотах: боссы или события мира — что это?»; «события мира мелькают
    // вверху экрана, не прочитать»
    id: 'prog-hunts',
    section: 'progress',
    title: ['Hunts and world events', 'Охоты и события мира'],
    tags: ['hunt', 'boss', 'world event', 'events', 'invasion', 'охота', 'босс', 'событие мира', 'события', 'вторжение'],
    summary: [
      'World events come into the chat\'s «Events» tab; a tap on one sails you there. A hunt is any part in a fight with a boss or an event\'s squadron.',
      'События мира приходят во вкладку «События» в чате; нажмите на строку — и корабль поплывёт туда. Охота — любое участие в бою с боссом или эскадрой события.',
    ],
    slides: [
      {
        img: img('prog-hunts', 1),
        text: [
          'World events come into the chat\'s «Events» tab, not over the sea: a boss rising, a zone boss on the horizon, the Choir\'s invasion, the Armada, a blockade, the silver galleon, a legend adrift. The small red-flag icon by the chart counts the ones not read: tap it and the tab opens. Tap «sail there» on a line and the helmsman marks it and sails; a boss that moves is followed.',
          'События мира приходят во вкладку «События» в чате, а не поверх моря: поднимается босс, на горизонте босс зоны, вторжение Хора, Армада, блокада, серебряный галеон, легенда в дрейфе. Иконка с красным флажком у карты считает непрочитанные — нажмите на неё, и вкладка откроется. Нажмите «плыть туда» на строке, и рулевой поставит метку и поведёт корабль; за боссом, который движется, он идёт следом.',
        ],
      },
      {
        img: img('prog-hunts', 3),
        text: [
          'A hunt is any part in a fight with a great foe: a hit on a sea boss or a zone boss, a great one ashore beaten, a ship of an event\'s squadron sunk or taken. The season challenge «Take part in N hunts» counts each of them.',
          'Охота — любое участие в бою с великим противником: попадание по морскому боссу или боссу зоны, побеждённый великан на берегу, потопленный или захваченный корабль эскадры события. Испытание сезона «Поучаствуйте в N охотах» считает каждый такой бой.',
        ],
        show: { open: 'pass' },
      },
      {
        img: img('prog-hunts', 4),
        text: [
          'Every challenge opens its card on a tap: what counts, where, how it works, and one gold «Sail» to the nearest place for it — a boss or an event up now, a ship to board, a lair.',
          'Каждое испытание по нажатию открывает карточку: что засчитывается, где и как это делать, и одна золотая кнопка «Плыть» к ближайшему месту — к боссу или событию, которое идёт сейчас, к кораблю для абордажа, к логову.',
        ],
      },
    ],
    related: ['prog-pass', 'prog-creatures', 'combat-boarding'],
    window: 'pass',
  },
  {
    id: 'prog-rating',
    section: 'progress',
    title: ['The rating: «Level» and «Might»', 'Рейтинг: «Уровень» и «Мощь»'],
    tags: ['rating', 'might', 'power', 'leaderboard', 'рейтинг', 'мощь', 'таблица', 'место'],
    summary: [
      '«Might» is 35 % army, 25 % ship, 20 % island and 20 % gear; the site\'s rating has boards for each.',
      '«Мощь» — это 35 % армии, 25 % корабля, 20 % острова и 20 % снаряжения; в рейтинге на сайте таблицы по каждому.',
    ],
    slides: [
      {
        img: img('prog-rating', 1),
        text: [
          'Captain → «Might»: your might and your place among all captains.',
          'Капитан → «Мощь»: ваша мощь и место среди всех капитанов.',
        ],
        show: { open: 'hero' },
      },
      {
        img: img('prog-rating', 2),
        text: [
          'Its four parts, each with your place: the army 35 %, the ship 25 %, the island 20 %, the gear 20 %. Each is out of about 10 000 for a captain with everything upgraded.',
          'Четыре её части, у каждой ваше место: армия — 35 %, корабль — 25 %, остров — 20 %, снаряжение — 20 %. Каждая — примерно из 10 000 у капитана, у которого всё улучшено.',
        ],
      },
      {
        img: img('prog-rating', 3),
        text: [
          '«The mightiest captains» below. The rating on the site has boards for level, might, army, ship, island, gear, glory, PvP and more — the top 100, refreshed every minute; a tap on a captain opens his profile.',
          'Ниже — «Самые могучие капитаны». В рейтинге на сайте — таблицы по уровню, мощи, армии, кораблю, острову, снаряжению, славе, ПвП и другим: сотня лучших, обновляется раз в минуту; нажатие на капитана открывает его профиль.',
        ],
      },
    ],
    related: ['prog-pvp'],
    window: 'hero',
  },
  {
    id: 'prog-pvp',
    section: 'progress',
    title: ['The PvP board', 'Таблица ПвП'],
    tags: ['pvp', 'points', 'season', 'rewards', 'пвп', 'очки', 'сезон', 'награды', 'гроза морей'],
    summary: [
      'Points for captains sunk and boarded; the month\'s top ten get titles, doubloons and silver.',
      'Очки за потопленных и взятых на абордаж капитанов; десятка месяца получает звания, дублоны и серебро.',
    ],
    slides: [
      {
        img: img('prog-pvp', 1),
        text: [
          'Captain → «PvP»: the month\'s season, your points, captains beaten, deaths, duels and streaks.',
          'Капитан → «ПвП»: сезон месяца, ваши очки, побеждённые капитаны, смерти, дуэли и серии.',
        ],
        show: { open: 'pvp' },
      },
      {
        img: img('prog-pvp', 2),
        text: [
          'Rewards at the month\'s end: titles «Storm of the Seas», «Sea Hawk», «Boarder» for the top three, silver and doubloons to the tenth place, a share of silver for everyone with 50+ points.',
          'Награды в конце месяца: звания «Гроза морей», «Морской ястреб» и «Абордажник» первой тройке, серебро и дублоны до 10-го места, доля серебра всем, у кого 50+ очков.',
        ],
      },
      {
        img: img('prog-pvp', 3),
        text: [
          'A sinking gives 10 points, a boarding 14, a duel 5; up to ×2.5 against stronger captains, ×1.5 in a guild war. The same captain again within a day gives half, then a quarter, then nothing. The board resets on the 1st.',
          'Потопление — 10 очков, абордаж — 14, дуэль — 5; против сильных — до ×2,5, в войне гильдий ×1,5. Тот же капитан повторно за сутки — половина, потом четверть, потом ничего. Таблица обнуляется 1-го числа.',
        ],
      },
    ],
    related: ['prog-rating'],
    window: 'pvp',
  },
  {
    id: 'prog-promo',
    section: 'progress',
    title: ['Promo codes', 'Промокоды'],
    tags: ['promo', 'code', 'gift', 'settings', 'промокод', 'код', 'подарок', 'настройки'],
    summary: [
      '«Settings» → «Promo code» → «Enter»: type the code and press «Activate».',
      '«Настройки» → «Промокод» → «Ввести»: наберите код и нажмите «Активировать».',
    ],
    slides: [
      {
        img: img('prog-promo', 1),
        text: [
          'Open «Settings» (the menu «⋯» or the captain\'s menu) and press «Enter» by «Promo code».',
          'Откройте «Настройки» (меню «⋯» или меню капитана) и нажмите «Ввести» у строки «Промокод».',
        ],
        show: { open: 'settings' },
      },
      {
        img: img('prog-promo', 2),
        text: [
          'Type the code into the field and press «Activate». Letters may be in any case.',
          'Наберите код в поле и нажмите «Активировать». Регистр букв не важен.',
        ],
        show: { open: 'settings:promo' },
      },
      {
        img: img('prog-promo', 3),
        text: [
          'The answer is right under it: what you got, or why the code did not fit (spent, expired, not for your level). Each code works once a captain; codes for newcomers work up to level 15.',
          'Ответ — прямо под полем: что вы получили или почему код не подошёл (уже использован, истёк, не для вашего уровня). Каждый код — один раз на капитана; коды для новичков действуют до 15-го уровня.',
        ],
      },
    ],
    related: ['prog-gift'],
    window: 'settings:promo',
  },
  {
    id: 'prog-gift',
    section: 'progress',
    title: ['The daily gift', 'Награда за вход'],
    tags: ['daily', 'gift', 'login', 'streak', 'награда за вход', 'ежедневный подарок', 'подарок', 'дни подряд'],
    summary: [
      'A 28-day track, one claim a day; one missed day is forgiven.',
      'Дорожка на 28 дней, одна награда в день; один пропущенный день прощается.',
    ],
    slides: [
      {
        img: img('prog-gift', 1),
        text: [
          'The gift opens by itself when you are free (or from «⋯»): four weeks of seven days. Press «Claim» — or «Later».',
          'Награда открывается сама, когда вы свободны (или из меню «⋯»): четыре недели по семь дней. Нажмите «Забрать» — или «Позже».',
        ],
      },
      {
        img: img('prog-gift', 2),
        text: [
          'The 7th day of each week gives doubloons (25 in the 4th week); silver grows by a quarter every week.',
          'Седьмой день каждой недели — дублоны (в четвёртую неделю 25); серебро растёт на четверть с каждой неделей.',
        ],
      },
      {
        img: img('prog-gift', 3),
        text: [
          '«Days in a row»: one missed day is forgiven, two — and the count starts over. One claim per day (UTC).',
          '«Дней подряд»: один пропущенный день прощается, два — и счёт начнётся заново. Одна награда в сутки (по UTC).',
        ],
      },
    ],
    related: ['prog-promo', 'prog-shop'],
  },
  {
    id: 'prog-shop',
    section: 'progress',
    title: ['The doubloon shop', 'Лавка за дублоны'],
    tags: ['shop', 'doubloons', 'premium', 'offers', 'лавка', 'дублоны', 'акции', 'набор новичка', 'пополнить'],
    summary: [
      'Doubloons buy speed-ups, supplies, scrolls, ship looks and island help; «Top up» buys doubloons.',
      'За дублоны — ускорения, припасы, свитки, облик корабля и помощь острову; «Пополнить» — купить дублоны.',
    ],
    slides: [
      {
        img: img('prog-shop', 1),
        text: [
          'The shop has four tabs: «Sea», «Boarding», «Island», «Cosmetics»; «Deals» are on top.',
          'В лавке четыре вкладки: «Море», «Абордаж», «Остров», «Косметика»; «Акции» — сверху.',
        ],
        show: { open: 'shop' },
      },
      {
        img: img('prog-shop', 2),
        text: [
          'Deals: the «Newcomer\'s kit» once an account, the «Captain\'s subscription» (30 days of 100 doubloons a day), the «Weekly chest», a gift for each 10th level. The first top-up is doubled (up to 2 600).',
          'Акции: «Набор новичка» — один раз на счёт, «Капитанская подписка» (30 дней по 100 дублонов в день), «Недельный сундук», подарок за каждый 10-й уровень. Первое пополнение — вдвойне (до 2 600).',
        ],
      },
      {
        img: img('prog-shop', 3),
        text: [
          '«Boarding»: autobattle scrolls, luck talismans, the elixir of experience and more. «Sea» has ammunition, repair kits, crews, fair winds, pardons, treasure maps.',
          '«Абордаж»: свитки автобоя, талисманы удачи, эликсир опыта и другое. В «Море» — снаряды, ремкомплекты, команда, попутный ветер, помилование, карты сокровищ.',
        ],
      },
    ],
    related: ['isle-rush', 'prog-pass'],
    window: 'shop',
  },
];
