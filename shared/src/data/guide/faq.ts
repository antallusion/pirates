// «Лоцманская книга» · Вопросы капитанов: short answers to the questions captains asked on the forum (forum.db of
// 2026-10-28…11-02, read-only) and what we answered, as the game stands now. Shots: tools/guide/shots-qa.mjs.
import type { GuideArticle } from './types.ts';

/** A slide's shot: assets/guide/<article>-<n>.webp, given by its bare file name (the engine's way). */
const img = (id: string, n: number): string => `${id}-${n}.webp`;

export const ARTICLES: GuideArticle[] = [
  {
    id: 'faq-big-ships',
    section: 'faq',
    title: ['Where do I buy a bigger ship?', 'Где купить корабль побольше?'],
    tags: ['ship', 'bigger', 'shipyard', 'yard rank', 'корабль', 'больше', 'верфь', 'ранг верфи', 'где купить'],
    summary: [
      'Bigger hulls are sold only at higher-rank shipyards: the chart\'s «Shipyards» layer shows each yard\'s rank and ship levels.',
      'Большие корпуса продают только верфи высокого ранга: слой «Верфи» на карте показывает ранг каждой и уровни кораблей.',
    ],
    slides: [
      {
        img: img('faq-big-ships', 1),
        text: [
          'Chart → «Shipyards»: «Shipyard 2 · ⚓1–6» — the yard\'s rank and the ship levels it sells. Only the yards you have found are shown: sail and find them, or buy a sea’s chart in port («Charts»).',
          'Карта → «Верфи»: «Верфь 2 · ⚓1–6» — ранг верфи и уровни кораблей, что она продаёт. Видны только найденные верфи: плывите искать или купите карту моря в порту («Карты»).',
        ],
        show: { open: 'map', point: '[data-mlayer="yards"]' },
      },
      {
        img: img('faq-big-ships', 2),
        text: [
          'In such a port: «Shipyard» → «All ships». Port Gravesend has a rank-4 yard right by the start.',
          'В таком порту: «Верфь» → «Все корабли». Верфь 4-го ранга — в Порт-Грейвсенде, недалеко от старта.',
        ],
        show: { open: 'port:shipyard' },
      },
      {
        img: img('faq-big-ships', 3),
        text: [
          'Buying asks: trade the old one in, or keep it at the berth. Every hull\'s full card — hold, crew, slots, guns, where it is sold — is in the ship tree and on the site\'s «Fleet» page.',
          'При покупке игра спросит: сдать старый или оставить на причале. Полная карточка каждого корпуса — трюм, команда, ячейки, пушки, где продаётся — в «Дереве кораблей» и на сайте, раздел «Флот».',
        ],
      },
    ],
    related: ['army-berths', 'exp-chart'],
  },
  {
    id: 'faq-silver-isle',
    section: 'faq',
    title: ['How do I bring silver and goods to my island?', 'Как завезти серебро и товары на остров?'],
    tags: ['island', 'silver', 'goods', 'treasury', 'barge', 'остров', 'серебро', 'ресурсы', 'казна', 'барка', 'завезти'],
    summary: [
      'Island → «Bring in»: silver into the treasury from anywhere, goods unloaded off the island, or a barge for silver.',
      'Остров → «Завезти»: серебро в казну откуда угодно, товары — выгрузить у острова, или барка за серебро.',
    ],
    slides: [
      {
        img: img('faq-silver-isle', 1),
        text: [
          'The island window → «Bring in» (or tap the treasury coin at the top).',
          'Окно острова → «Завезти» (или нажмите на монетку казны вверху).',
        ],
        show: { open: 'isle', point: '[data-iside="haul"]' },
      },
      {
        img: img('faq-silver-isle', 2),
        text: [
          '«Put in the treasury» or «All the silver» — at sea or in port. The treasury pays for building, the market and the barge first.',
          '«Положить в казну» или «Всё серебро» — в море или в порту. Казна первой платит за стройку, рынок и барку.',
        ],
      },
      {
        img: img('faq-silver-isle', 3),
        text: [
          'Goods: lie off your island and press «Unload all» — they go from the hold to the yard. No ship nearby? «Order a barge» brings timber, coal and iron, and the island\'s Market sells resources straight to the yard.',
          'Товары: встаньте у своего острова и нажмите «Выгрузить всё» — они перейдут из трюма на склад. Корабля рядом нет? «Заказать барку» привезёт лес, уголь и железо, а рынок острова продаёт ресурсы прямо на склад.',
        ],
      },
    ],
    related: ['isle-haul'],
  },
  {
    id: 'faq-mines',
    section: 'faq',
    title: ['How do I take a mine?', 'Как взять шахту?'],
    tags: ['mine', 'flag', 'guards', 'шахта', 'флаг', 'стража', 'добыча'],
    summary: [
      'Beat its guards, land by it and raise your flag in 20 seconds. Up to 7 mines.',
      'Разбейте стражу, высадитесь у шахты и за 20 секунд поднимите флаг. До 7 шахт.',
    ],
    slides: [
      {
        img: img('faq-mines', 1),
        text: [
          'At a nobody\'s mine the prompt says: «guards stand before the mine: beat them first».',
          'У ничьей шахты подсказка скажет: «перед шахтой стоят стражи: сначала разбейте их».',
        ],
      },
      {
        img: img('faq-mines', 2),
        text: [
          'Then «Land» by the mine: the party raises your flag in 20 seconds.',
          'Потом «Высадка» у шахты: десант поднимет ваш флаг за 20 секунд.',
        ],
      },
      {
        img: img('faq-mines', 3),
        text: [
          'The yield goes to your island every sea day, or piles up at the mine for up to a week. At most 7 mines at once.',
          'Добыча каждые сутки моря идёт на остров или копится на шахте до недели. Одновременно — не больше 7 шахт.',
        ],
      },
    ],
    related: ['exp-mines'],
  },
  {
    id: 'faq-gear',
    section: 'faq',
    title: ['Where do I temper gear and forge artifacts?', 'Где закаляют снаряжение и куют артефакты?'],
    tags: ['gear', 'temper', 'forge', 'artifact', 'anvil', 'шмот', 'снаряжение', 'закалка', 'кузница', 'артефакт', 'наковальня'],
    summary: [
      'Gear: the island\'s «Forge» (Town Hall 3+) or a port with a shipyard of rank 2+. Artifacts: the «Workshop» and the «Anvil» (a Market is needed).',
      'Снаряжение — в «Кузнице» на острове (ратуша 3+) или в порту с верфью от 2-го ранга. Артефакты — в «Мастерской» и на «Наковальне» (нужен «Рынок»).',
    ],
    slides: [
      {
        img: img('faq-gear', 1),
        text: [
          'Build the «Forge» on a plot of your island (from Town Hall 3): lying off the island you temper, reforge and mend gear.',
          'Постройте «Кузницу» на участке острова (с ратуши 3): стоя у острова, вы закаляете, перековываете и чините снаряжение.',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('faq-gear', 2),
        text: [
          'Artifacts are made in the island Town\'s «Workshop» — a Market of level 1 or higher is needed, and the ship off the island.',
          'Артефакты куют в «Мастерской» в «Городе» острова — нужен «Рынок» от 1-го уровня и корабль у острова.',
        ],
        show: { open: 'isle', point: '[data-iside="town"]' },
      },
      {
        img: img('faq-gear', 3),
        text: [
          'The «Anvil» next to it reforges an artifact you carry: its primaries or one forged line.',
          '«Наковальня» рядом перековывает артефакт, что при вас: первичные навыки или одно выкованное свойство.',
        ],
      },
    ],
    related: ['isle-forge'],
  },
  {
    id: 'faq-berths',
    section: 'faq',
    title: ['How many ships can I keep?', 'Сколько кораблей можно держать?'],
    tags: ['berths', 'ships', 'how many', 'причал', 'корабли', 'сколько', 'места'],
    summary: [
      'Three berths free plus the ship under you — four in all; more for 300 doubloons each, up to ten.',
      'Три места на причале бесплатно плюс корабль под вами — всего четыре; больше — по 300 дублонов, до десяти.',
    ],
    slides: [
      {
        img: img('faq-berths', 1),
        text: [
          'Port → «Berths»: «Berths N/3» — three places are free, and the ship you sail is not counted.',
          'Порт → «Причал»: «Причал N/3» — три места бесплатно, корабль под вами не в счёт.',
        ],
        show: { open: 'port:berths' },
      },
      {
        img: img('faq-berths', 2),
        text: [
          '«+1 berth · 300»: each more costs 300 doubloons, up to ten.',
          '«+1 место · 300»: каждое следующее — 300 дублонов, всего до десяти.',
        ],
      },
      {
        img: img('faq-berths', 3),
        text: [
          'Changing ships takes 2 minutes: the ship sails to you from her last mooring. A ship kept at your island is taken out at the island.',
          'Пересесть — 2 минуты: корабль плывёт к вам с прошлой стоянки. Корабль, оставленный у вашего острова, забирают у острова.',
        ],
      },
    ],
    related: ['army-berths'],
  },
  {
    id: 'faq-lairs',
    section: 'faq',
    title: ['When does a lair come back?', 'Когда возвращается логово?'],
    tags: ['lair', 'respawn', 'when', 'логово', 'вернётся', 'когда', 'добыча'],
    summary: [
      'A shore lair in 1 h 36 min, a grotto in 2 h 24 min, a guardian in 3 h 12 min; full loot once a sea week.',
      'Береговое — через 1 ч 36 мин, грот — через 2 ч 24 мин, страж — через 3 ч 12 мин; полная добыча — раз в неделю моря.',
    ],
    slides: [
      {
        img: img('faq-lairs', 1),
        text: [
          'Chart → «Lairs»: a beaten lair is grey with «comes back in …».',
          'Карта → «Логова»: разбитое логово серое, с подписью «вернётся через …».',
        ],
        show: { open: 'map', point: '[data-mlayer="lairs"]' },
      },
      {
        img: img('faq-lairs', 2),
        text: [
          'Shore lairs return after 2 sea days (1 h 36 min), grottoes after 3 (2 h 24 min), guardians after 4 (3 h 12 min).',
          'Береговые возвращаются через 2 суток моря (1 ч 36 мин), гроты — через 3 (2 ч 24 мин), стражи — через 4 (3 ч 12 мин).',
        ],
      },
      {
        img: img('faq-lairs', 3),
        text: [
          'The full loot is each captain\'s once a sea week (5 h 36 min). «Look…» by the lair tells who lives there and how strong.',
          'Полная добыча — каждому раз в неделю моря (5 ч 36 мин). «Осмотреть…» у логова расскажет, кто там живёт и насколько силён.',
        ],
      },
    ],
    related: ['exp-lairs'],
  },
  {
    id: 'faq-marines',
    section: 'faq',
    title: ['Why can\'t I hire marines?', 'Почему не нанимаются морпехи?'],
    tags: ['marines', 'barracks', 'hire', 'морпехи', 'казарма', 'нанять', 'не нанимаются'],
    summary: [
      'Your island\'s marines are hired only once the Marine Barracks stand; big ports have marines of their own.',
      'Морпехов острова можно нанять только когда Казарма морпехов достроена; в больших портах есть свои морпехи.',
    ],
    slides: [
      {
        img: img('faq-marines', 1),
        text: [
          'While the barracks are going up, the card shows how long is left: nothing is hired until it stands.',
          'Пока казарма строится, карточка показывает, сколько осталось: до конца стройки никого не нанять.',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('faq-marines', 2),
        text: [
          'Big ports (and Crown and League harbours) have their own Marine Barracks: «Army» lists the dwellings of this port.',
          'В больших портах (и в гаванях Короны и Лиги) есть своя Казарма морпехов: вкладка «Армия» перечисляет жилища этого порта.',
        ],
        show: { open: 'port:army' },
      },
      {
        img: img('faq-marines', 3),
        text: [
          'Marines are tier 2, open from ship level ⚓1. If the hire stops, look at «Hammocks», «Stacks» and «Might» at the top.',
          'Морпехи — 2-й ранг, доступны с ⚓1. Если найм не идёт — смотрите «Койки», «Отряды» и «Сила» вверху окна.',
        ],
        show: { open: 'hire' },
      },
    ],
    related: ['isle-first', 'army-might'],
  },
  {
    id: 'faq-ferry',
    section: 'faq',
    title: ['How does the «Passage» between ports work?', 'Как работает «Переход» между портами?'],
    tags: ['ferry', 'passage', 'hub', 'travel', 'переход', 'узел', 'порт-узел', 'тихая гавань'],
    summary: [
      'Seven hub ports; open the «Passage» tab, pick an opened hub, pay. 800 to 15 000 silver, 30 minutes\' cooldown.',
      'Семь портов-узлов: вкладка «Переход», выберите открытый узел, оплатите. От 800 до 15 000 серебра, перерыв 30 минут.',
    ],
    slides: [
      {
        img: img('faq-ferry', 1),
        text: [
          'In a hub port (⇄ on the chart) open «Passage»: the other hubs with their price. Unopened ones are grey, «Open this port first».',
          'В порту-узле (⇄ на карте) откройте «Переход»: другие узлы и цена. Неоткрытые — серые, «Сначала откройте этот порт».',
        ],
        show: { open: 'port:ferry' },
      },
      {
        img: img('faq-ferry', 2),
        text: [
          'The price grows with the distance (800 to the next hub, 15 000 across the sea), double under the pirate flag, a quarter for your quest\'s hub. Not with skulls, in a mutiny or with trade cargo over 60 % of the hold.',
          'Цена растёт с расстоянием (800 до соседнего узла, 15 000 через всё море), под пиратским флагом — вдвое, до узла вашего задания — четверть. Нельзя с черепами, при бунте и с торговым грузом больше 60 % трюма.',
        ],
      },
      {
        img: img('faq-ferry', 3),
        text: [
          'Within 1 km of every hub lies the «Quiet harbour»: captains do not attack each other there, and a newcomer by passage is under its ward for 3 minutes more.',
          'В 1 км от каждого узла — «Тихая гавань»: капитаны там друг на друга не нападают, а пришедший переходом ещё 3 минуты под её защитой.',
        ],
        show: { open: 'map' },
      },
    ],
    related: ['exp-chart'],
  },
  {
    id: 'faq-away',
    section: 'faq',
    title: ['What does my crew do while I am away?', 'Что делает команда, пока меня нет?'],
    tags: ['away', 'offline', 'upkeep', 'provisions', 'morale', 'офлайн', 'без меня', 'провизия', 'дух', 'жалованье'],
    summary: [
      'At sea they eat provisions, in port they drink silver — a quarter of the usual, for at most a day.',
      'В море едят провизию, в порту пропивают серебро — четверть обычного, не больше чем за сутки.',
    ],
    slides: [
      {
        img: img('faq-away', 1),
        text: [
          'Left at sea, the crew eats a quarter of its rations; take provisions before you log off («Supplies» in the market).',
          'В море команда ест четверть пайка; запаситесь провизией, прежде чем выйти из игры («Припасы» на рынке).',
        ],
        show: { open: 'port:market' },
      },
      {
        img: img('faq-away', 2),
        text: [
          'In port they spend a quarter of their wages. At most 24 hours are counted, nothing below a quarter of an hour, and it never goes below zero.',
          'В порту они тратят четверть жалованья. Считается не больше суток, ничего — меньше четверти часа, и в минус не уходит.',
        ],
      },
      {
        img: img('faq-away', 3),
        text: [
          'Short of it, morale falls (up to −30) and up to 15 % may desert. Below level 6 the bill is halved and nobody deserts. The account waits for you: «Settlement for your absence».',
          'Если не хватило — падает дух (до −30) и может сбежать до 15 % людей. До 6-го уровня счёт вдвое меньше и никто не бежит. При входе — «Расчёт за время отсутствия».',
        ],
        show: { open: 'crew' },
      },
    ],
    related: ['faq-logout'],
  },
  {
    id: 'faq-logout',
    section: 'faq',
    title: ['Can I just close the tab at sea?', 'Можно ли просто закрыть вкладку в море?'],
    tags: ['exit', 'logout', 'close', 'escape', 'выход', 'закрыть', 'сбежать', 'оффлайн'],
    summary: [
      'No escape that way: at sea the ship stays 2 minutes and can be attacked. Use «Exit»: 30 seconds.',
      'Так не сбежать: в море корабль ещё 2 минуты остаётся на месте и его можно атаковать. Используйте «Выход»: 30 секунд.',
    ],
    slides: [
      {
        img: img('faq-logout', 1),
        text: [
          '«⋯» → «Exit» (⏻).',
          '«⋯» → «Выход» (⏻).',
        ],
      },
      {
        img: img('faq-logout', 2),
        text: [
          'At sea: «EXIT IN 0:30». Any order of yours or a shot at you cancels it.',
          'В море: «ВЫХОД ЧЕРЕЗ 0:30». Любой ваш приказ или выстрел по вам его отменит.',
        ],
      },
      {
        img: img('faq-logout', 3),
        text: [
          'Lost the connection or closed the game at sea? The ship stays 2 minutes on her last order — she can be attacked, boarded and sunk. Back within those 2 minutes, you are at the wheel again. In port the exit is instant.',
          'Пропала связь или закрыли игру в море — корабль ещё 2 минуты выполняет последний приказ: его можно атаковать, взять на абордаж и потопить. Вернулись за эти 2 минуты — снова за штурвалом. В порту выход мгновенный.',
        ],
      },
    ],
    related: ['faq-away'],
  },
  {
    id: 'faq-gift-letter',
    section: 'faq',
    title: ['Where is my gift letter?', 'Где письмо с подарком?'],
    tags: ['gift', 'letter', 'mail', 'musketeers', 'подарок', 'письмо', 'почта', 'мушкетёры', 'получить'],
    summary: [
      '«Journal» → «Letters», in any port: «Receive». No room aboard — dismiss someone, the letter waits.',
      '«Журнал» → «Письма», в любом порту: «Получить». Нет места на борту — увольте кого-нибудь, письмо подождёт.',
    ],
    slides: [
      {
        img: img('faq-gift-letter', 1),
        text: [
          'Open «Journal» → «Letters»: the letter with its attachment.',
          'Откройте «Журнал» → «Письма»: письмо и его вложение.',
        ],
        show: { open: 'journal' },
      },
      {
        img: img('faq-gift-letter', 2),
        text: [
          'Press «Receive» in any port: the silver goes to your purse and the stack aboard.',
          'Нажмите «Получить» в любом порту: серебро ляжет в кошелёк, отряд встанет на борт.',
        ],
      },
      {
        img: img('faq-gift-letter', 3),
        text: [
          'No free hammocks or slots? Dismiss someone in «The Company» («Dismiss») — the letter waits until there is room.',
          'Не хватает коек или ячеек? Увольте кого-нибудь в окне «Команда» («Уволить») — письмо подождёт, пока не освободится место.',
        ],
        show: { open: 'crew' },
      },
    ],
    related: ['army-gift', 'army-stacks'],
  },
  {
    id: 'faq-resurrect',
    section: 'faq',
    title: ['Why does the surgeon offer to raise deckhands?', 'Почему лекарь предлагает воскресить юнг?'],
    tags: ['surgeon', 'resurrect', 'deckhands', 'fallen', 'лекарь', 'воскресить', 'юнги', 'павшие'],
    summary: [
      'The surgeon raises exactly who fell in the last 24 hours — by kind, at the price of their kind.',
      'Лекарь возвращает ровно тех, кто пал за последние сутки, — по видам, по цене своего вида.',
    ],
    slides: [
      {
        img: img('faq-resurrect', 1),
        text: [
          'Port → «Army» → «Surgeon»: «Fallen: N» counts everyone lost in the last day.',
          'Порт → «Армия» → «Лекарь»: «Павших: N» — все, кого вы потеряли за последние сутки.',
        ],
        show: { open: 'port:army' },
      },
      {
        img: img('faq-resurrect', 2),
        text: [
          'The list is by kind: if deckhands fell, it offers deckhands — those men, not «any 12 sailors». Their price is a share of their kind\'s cost.',
          'Список — по видам: если пали юнги, предлагаются юнги — именно они, а не «любые 12 матросов». Цена — доля стоимости этого вида.',
        ],
      },
      {
        img: img('faq-resurrect', 3),
        text: [
          'The fallen wait a day and up to 20 battles. Missing men of any kind are simply hired — in the tavern or the hire window.',
          'Павшие ждут сутки и до 20 боёв. Недостающих людей любого вида можно просто нанять — в таверне или в окне найма.',
        ],
      },
    ],
    related: ['army-healer'],
  },
];
