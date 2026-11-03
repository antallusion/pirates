// «Лоцманская книга», travel: the passage between the hubs, the quiet harbour, «To my island», «Find a foe». Pictures:
// tools/guide/shots-voyage.mjs.
import type { GuideArticle } from './types.ts';

export const ARTICLES: GuideArticle[] = [
  {
    id: 'travel-ferry',
    section: 'travel',
    title: ['The passage between hubs', 'Переход между гаванями'],
    tags: ['ferry', 'passage', 'hub', 'travel', 'переход', 'гавань', 'узел', 'путешествие'],
    window: 'port:ferry',
    summary: [
      'Seven hub harbours are linked by the «Passage»: 800 to 15 000 silver by distance, a trip at ten times the speed, untouchable, docking on arrival.',
      'Семь гаваней-узлов связаны «Переходом»: от 800 до 15 000 серебра по расстоянию, плавание в десять раз быстрее, вас никто не тронет, на месте — сразу в порт.',
    ],
    slides: [
      {
        img: 'travel-ferry-1.webp',
        text: [
          'In a hub harbour the port window has the «Passage» chip first in its second row (the same list sits at the top of «Harbour»). The hubs: Port Gravesend, Hollowmere, Tidewrack, Fogmouth, Widow\'s Wick, Frostgate and Sealhold.',
          'В гавани-узле в окне порта первой во втором ряду стоит кнопка «Переход» (тот же список — вверху «Гавани»). Узлы: Порт-Грейвсенд, Холлоумир, Тайдрэк, Фогмут, Вдовий Фитиль, Ледяные Ворота и Тюленья Крепь.',
        ],
        show: { open: 'port:ferry' },
      },
      {
        img: 'travel-ferry-2.webp',
        text: [
          'Each row is a hub with its price: 800 silver for the nearest pair, up to 15 000 for the farthest. A hub you have not discovered yet is greyed out: «Discover this port first».',
          'Каждая строка — узел и цена: 800 серебра за ближайшую пару, до 15 000 за самую дальнюю. Ещё не открытый узел — серый: «Сначала откройте этот порт».',
        ],
      },
      {
        img: 'travel-ferry-3.webp',
        text: [
          'Press the price button and you are off. The ship sails there by herself at ten times the speed; no one can touch her and she cannot act.',
          'Нажмите кнопку с ценой — и в путь. Корабль сам идёт туда в десять раз быстрее; его никто не тронет, и сам он ничего делать не может.',
        ],
      },
      {
        img: 'travel-ferry-4.webp',
        text: [
          'On the way a pill on top shows where you are going and how long is left. On arrival you dock in the hub at once.',
          'В пути плашка наверху показывает, куда идёте и сколько осталось. По прибытии корабль сразу заходит в гавань.',
        ],
      },
    ],
    related: ['travel-rules', 'travel-haven'],
  },
  {
    id: 'travel-rules',
    section: 'travel',
    title: ['The passage\'s rules', 'Правила перехода'],
    tags: ['ferry', 'passage', 'cooldown', 'price', 'pirate', 'quest', 'hold', 'переход', 'перезарядка', 'цена', 'пират', 'задание', 'трюм'],
    window: 'port:ferry',
    summary: [
      'Once in 30 minutes. Under the pirate flag ×2, towards a quest\'s goal ×0.25. Not with skulls, not in a fight, and not with trade goods over 60 % of the hold.',
      'Раз в 30 минут. Под пиратским флагом цена ×2, к цели задания ×0,25. Нельзя с черепами, в бою и если товары занимают больше 60 % трюма.',
    ],
    slides: [
      {
        img: 'travel-rules-1.webp',
        text: [
          'Under the pirate flag every passage costs twice as much. With a skull it is refused altogether: «wash first».',
          'Под пиратским флагом любой переход стоит вдвое дороже. А с черепом его не дадут вовсе — сначала отмойтесь.',
        ],
      },
      {
        img: 'travel-rules-2.webp',
        text: [
          'Going to the hub nearest an active quest\'s goal costs a quarter, with the tag «quest discount».',
          'Переход к узлу, ближайшему к цели взятого задания, стоит четверть цены — с пометкой «скидка за задание».',
        ],
      },
      {
        img: 'travel-rules-3.webp',
        text: [
          'If trade goods take more than 60 % of the hold, the passage refuses: sell or store some first. Ship\'s stores do not count. It is also refused in a fight, in a mutiny and during a refit.',
          'Если товары занимают больше 60 % трюма, переход откажет: сначала продайте или сложите часть на склад. Судовые припасы не считаются. Отказ будет и в бою, и во время бунта, и пока корабль на переделке.',
        ],
      },
      {
        img: 'travel-rules-4.webp',
        text: [
          'After a passage the next one waits 30 minutes of real time; the status line under the list and the «Passage cooldown» icon show how long.',
          'После перехода следующий — через 30 минут реального времени: сколько осталось, видно в строке под списком и на значке «Перезарядка перехода».',
        ],
      },
    ],
    related: ['travel-ferry', 'flags-skulls', 'sea-hold'],
  },
  {
    id: 'travel-haven',
    section: 'travel',
    title: ['The quiet harbour', 'Тихая гавань'],
    tags: ['haven', 'safe', 'protection', 'hub', 'тихая гавань', 'защита', 'безопасность', 'узел'],
    summary: [
      'Within 1 km of every hub no captain can attack another. After a passage the protection follows you for 3 more minutes.',
      'В километре от каждого узла ни один капитан не может напасть на другого. После перехода защита ещё 3 минуты идёт за вами.',
    ],
    slides: [
      {
        img: 'travel-haven-1.webp',
        text: [
          'On the chart the hubs carry a brass ⇄ badge and a green dashed ring: the «Quiet harbour», 1000 m round the port. Inside it captains cannot fight each other.',
          'На карте у узлов латунный значок ⇄ и зелёное пунктирное кольцо — «Тихая гавань», 1000 м вокруг порта. Внутри капитаны не могут драться друг с другом.',
        ],
        show: { open: 'map' },
      },
      {
        img: 'travel-haven-2.webp',
        text: [
          'Arrived by passage? Once you leave the ring you keep «Harbour\'s protection» for 180 s more. It guards against captains only: the sea\'s pirates and beasts attack as usual.',
          'Пришли переходом? Выйдя из кольца, вы ещё 180 секунд под «Защитой гавани». Она бережёт только от капитанов: пираты моря и звери нападают как обычно.',
        ],
      },
    ],
    related: ['travel-ferry', 'flags-three'],
  },
  {
    id: 'travel-home',
    section: 'travel',
    title: ['«To my island»', '«К острову»'],
    tags: ['island', 'home', 'course', 'остров', 'домой', 'курс'],
    summary: [
      '«To my island» in the «⋯» tray or at the bottom of the chart sets the course home; with no island yet, to the nearest free one.',
      '«К острову» в меню «⋯» или внизу карты прокладывает курс домой; если острова ещё нет — к ближайшему свободному.',
    ],
    slides: [
      {
        img: 'travel-home-1.webp',
        text: [
          'Open the «⋯» tray by the portrait: «To my island» is there.',
          'Откройте меню «⋯» у портрета: там есть «К острову».',
        ],
      },
      {
        img: 'travel-home-2.webp',
        text: [
          'A tap sets the course and the helmsman takes her; the pill on top shows the way. No island yet? The course goes to the nearest free one: «No island yet: course to the nearest free one».',
          'Тап — курс проложен, рулевой ведёт корабль, плашка наверху показывает путь. Острова пока нет? Курс ляжет к ближайшему свободному.',
        ],
      },
      {
        img: 'travel-home-3.webp',
        text: [
          'The same button stands at the bottom of the chart, beside «Where am I» and «Find foe».',
          'Та же кнопка есть внизу карты — рядом с «Где я» и «Найти врага».',
        ],
        show: { open: 'map', point: '[data-mhome]' },
      },
    ],
    related: ['travel-foe', 'sea-autosail', 'sea-chart'],
  },
  {
    id: 'travel-foe',
    section: 'travel',
    title: ['«Find foe»', '«Найти врага»'],
    tags: ['foe', 'hunt', 'pirates', 'beasts', 'lairs', 'враг', 'охота', 'пираты', 'звери', 'логова'],
    summary: [
      'A list of the pirates, beasts, monsters and lairs you can see or have charted within 30 km, filtered by kind and level. Tap a row for the course.',
      'Список пиратов, зверей, чудовищ и логов, которых вы видите или уже нанесли на карту, в пределах 30 км, с отбором по виду и уровню. Тап по строке — курс.',
    ],
    slides: [
      {
        img: 'travel-foe-1.webp',
        text: [
          '«Find foe» is in the «⋯» tray by the portrait (and at the bottom of the chart).',
          '«Найти врага» — в меню «⋯» у портрета (и внизу карты).',
        ],
      },
      {
        img: 'travel-foe-2.webp',
        text: [
          'The panel lists what is in sight or already charted — never anything under the fog. The chips «All», «Pirates», «Beasts», «Monsters», «Lairs» filter by kind.',
          'В панели — то, что видно или уже нанесено на карту; ничего из-под тумана. Кнопки «Все», «Пираты», «Звери», «Чудовища», «Логова» отбирают по виду.',
        ],
      },
      {
        img: 'travel-foe-3.webp',
        text: [
          'The level chips: «⚓ yours ±2» for a fair fight, «⚓ ±5», «Any ⚓». The search reaches 30 km.',
          'Кнопки уровня: «⚓ ваш ±2» — для честного боя, «⚓ ±5», «Любой ⚓». Поиск достаёт на 30 км.',
        ],
      },
      {
        img: 'travel-foe-4.webp',
        text: [
          'Tap a row and the course is set: the helmsman takes you to the foe. Turn the wheel to take over.',
          'Тап по строке — курс проложен, рулевой ведёт к врагу. Поверните штурвал, чтобы взять руль.',
        ],
      },
    ],
    related: ['travel-home', 'combat-attack', 'combat-beasts'],
  },
];
