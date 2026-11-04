// «Лоцманская книга» · Разведка: treasure maps, divers and wrecks, landings, the spot-work countdown, mines, lairs, sea
// marks, lookouts and lights, the chart, the «Хроника», the fog of war, the navigator's distance perks. Numbers as in the
// code on 2026-11-02 (server/src/game/explorefx.ts, treasure.ts, exploration.ts, spotwork.ts, mines.ts, isles.ts,
// charting.ts; shared/src/data/mines.ts, lairs.ts, seamarks.ts, fog.ts). Shots: tools/guide/shots-qa.mjs.
import type { GuideArticle } from './types.ts';

/** A slide's shot: assets/guide/<article>-<n>.webp, given by its bare file name (the engine's way). */
const img = (id: string, n: number): string => `${id}-${n}.webp`;

export const ARTICLES: GuideArticle[] = [
  {
    id: 'exp-treasure',
    section: 'explore',
    title: ['Treasure maps', 'Карты сокровищ'],
    tags: ['treasure', 'map', 'dig', 'circle', 'scroll', 'warm', 'клад', 'карта сокровищ', 'копать', 'круг', 'свиток', 'тепло', 'горячо', 'кладоискатель'],
    summary: [
      'A map draws a search circle on the chart; inside it «Warm → Warmer → Hot!» leads you to a scroll on the water — dig there.',
      'Карта рисует на карте моря круг поиска; внутри него «Тепло → Теплее → Горячо!» ведёт к свитку на воде — там и копайте.',
    ],
    slides: [
      {
        img: img('exp-treasure', 1),
        text: [
          'Open the chart and turn on the «Treasure» layer: each map you hold shows its search circle — 900, 1 400 or 2 000 m by its tier — with «Treasure: <place>». The exact spot is never drawn.',
          'Откройте карту моря и включите слой «Сокровища»: у каждой вашей карты — круг поиска (900, 1 400 или 2 000 м по её ступени) с подписью «Клад: <место>». Точное место не рисуется.',
        ],
        show: { open: 'map', point: '[data-mlayer="treasure"]' },
      },
      {
        img: img('exp-treasure', 2),
        text: [
          '«Sail to the treasure» takes the ship to the circle. Maps come from tavern rumours, the cartographer, wrecks and finds; the chest holds 6.',
          '«Плыть к кладу» доведёт корабль до круга. Карты дают слухи таверны, картограф, обломки и находки; в сундуке их помещается 6.',
        ],
      },
      {
        img: img('exp-treasure', 3),
        text: [
          'Inside the circle the hint guides you: «Warm» far off, «Warmer» within 1.3 km, «Hot!» within 700 m. Look for the scroll on the water.',
          'Внутри круга подсказка ведёт вас: «Тепло» — далеко, «Теплее» — ближе 1,3 км, «Горячо!» — ближе 700 м. Ищите свиток на воде.',
        ],
      },
      {
        img: img('exp-treasure', 4),
        text: [
          'The scroll shows within 400 m: «scroll in sight». Sail up to it, or tap it and the ship comes by itself.',
          'Свиток виден за 400 м: «свиток на виду». Подойдите к нему — или нажмите на него, и корабль подойдёт сам.',
        ],
      },
      {
        img: img('exp-treasure', 5),
        text: [
          'Over the spot press «Dig» (key L). The boats go ashore with spades: 60, 95 or 130 s by the tier. Digging is heard 2 km off, and rich maps may raise guardians.',
          'Над местом нажмите «Копать» (клавиша L). Шлюпки уходят на берег с лопатами: 60, 95 или 130 с по ступени карты. Раскопки слышно за 2 км, а у богатых карт бывают стражи.',
        ],
      },
      {
        img: img('exp-treasure', 6),
        text: [
          'The «Treasure Hunter» talent (Exploration tree) shrinks the circle by 20 % a rank and digs 15 % faster a rank.',
          'Талант «Кладоискатель» (ветвь «Исследование») сужает круг на 20 % за ранг и ускоряет раскопки на 15 % за ранг.',
        ],
        show: { open: 'talents' },
      },
    ],
    related: ['exp-spot', 'exp-chart'],
    window: 'map',
    firstTime: 'treasure-map',
  },
  {
    id: 'exp-wrecks',
    section: 'explore',
    title: ['Wrecks and divers', 'Затонувшие корабли и водолазы'],
    tags: ['wreck', 'dive', 'divers', 'depth', 'pearl diver', 'затонувший', 'остов', 'ныряльщики', 'водолазы', 'глубина', 'ловец жемчуга'],
    summary: [
      'Over a sunken wreck press «Divers»: in 25 s they bring up its cargo; the depth decides if they reach it.',
      'Над затонувшим кораблём нажмите «Ныряльщики»: за 25 с они поднимут груз; хватит ли им глубины — решает талант.',
    ],
    slides: [
      {
        img: img('exp-wrecks', 1),
        text: [
          'Stand over the wreck (within 30 m): the action bar shows «Divers» with its name. Press it or key L.',
          'Встаньте над остовом (ближе 30 м): на панели действий появится «Ныряльщики» с его именем. Нажмите или клавишу L.',
        ],
      },
      {
        img: img('exp-wrecks', 2),
        text: [
          'Wrecks for divers are on the chart\'s «Goals» layer with their depth, «<name> · N m». Each can be dived again 2 hours later.',
          'Остовы для водолазов — на слое «Цели» карты моря, с глубиной: «<имя> · N м». Один и тот же можно обыскать снова через 2 часа.',
        ],
        show: { open: 'map', point: '[data-mlayer="goals"]' },
      },
      {
        img: img('exp-wrecks', 3),
        text: [
          'The countdown «Divers on the bottom»: going down, searching, coming up. The ship lies at anchor meanwhile.',
          'Отсчёт «Водолазы на дне»: спуск, поиск на дне, всплытие. Корабль в это время стоит на якоре.',
        ],
      },
      {
        img: img('exp-wrecks', 4),
        text: [
          'Without a talent divers reach only 8 m. «Pearl Diver» (Exploration) takes them to 20 m at rank 1 and 40 m at rank 2 — most wrecks lie deep.',
          'Без таланта водолазы достают лишь с 8 м. «Ловец жемчуга» (ветвь «Исследование») — 20 м на 1-м ранге и 40 м на 2-м: большинство остовов лежат глубоко.',
        ],
        show: { open: 'talents' },
      },
    ],
    related: ['exp-spot', 'exp-marks'],
    window: 'map',
    firstTime: 'wreck-near',
  },
  {
    id: 'exp-landing',
    section: 'explore',
    title: ['Landing parties', 'Высадка на остров'],
    tags: ['landing', 'party', 'ruins', 'cache', 'ashore', 'высадка', 'десант', 'руины', 'тайник', 'берег'],
    summary: [
      'At a ruin, a cache or a mine, «Land» sends a party ashore; it comes back with the haul.',
      'У руин, тайника или шахты «Высадка» отправляет десант на берег; он вернётся с добычей.',
    ],
    slides: [
      {
        img: img('exp-landing', 1),
        text: [
          'Near a feature of an island the action bar offers «Land» (key L). The party is 30 % of the crew, 3 to 12 men; the boats reach 30 m from the shore — if a beach is close, the helmsman sails in first.',
          'У приметного места острова панель действий предложит «Высадка» (клавиша L). Десант — 30 % команды, от 3 до 12 человек; шлюпки достают на 30 м от берега — если пляж рядом, рулевой сам подведёт корабль.',
        ],
      },
      {
        img: img('exp-landing', 2),
        text: [
          'The countdown «Landing party ashore»: the boats on the water, on the shore, rowing back. A cache takes 20 s, ruins 40, a lookout 15.',
          'Отсчёт «Десант на острове»: шлюпки на воде, на берегу, гребут назад. Тайник — 20 с, руины — 40, смотровая — 15.',
        ],
      },
      {
        img: img('exp-landing', 3),
        text: [
          'Back aboard: «The party is back» with the haul. Ruins sometimes hide a find with its own riddle. A place restocks 2 hours later.',
          'Вернулись: «Отряд вернулся» и добыча. В руинах иногда прячется находка со своей загадкой. Место снова полно через 2 часа.',
        ],
      },
    ],
    related: ['exp-spot', 'exp-mines'],
  },
  {
    id: 'exp-spot',
    section: 'explore',
    title: ['Work at a spot: the countdown', 'Дела на месте: отсчёт'],
    tags: ['countdown', 'anchor', 'call off', 'timer', 'dig', 'dive', 'отсчёт', 'якорь', 'прервать', 'таймер', 'дрейф'],
    summary: [
      'Divers, a landing, a dig: a countdown at the top, the ship at anchor; «Call off» brings the men back.',
      'Водолазы, десант, раскопки: сверху отсчёт, корабль на якоре; «Прервать» вернёт людей.',
    ],
    slides: [
      {
        img: img('exp-spot', 1),
        text: [
          'While your men work, a pill sits at the top: what they do, the phase («boats on the water», «digging»…) and the time left.',
          'Пока люди заняты, сверху висит плашка: что они делают, этап («шлюпки на воде», «копают»…) и сколько осталось.',
        ],
      },
      {
        img: img('exp-spot', 2),
        text: [
          '«Call off» recalls them. Before half the time — nothing found; after half — half the haul. Setting sail or turning the wheel calls them off too.',
          '«Прервать» отзывает людей. До половины срока — ничего, после половины — половина добычи. Поднятые паруса или руль тоже отзовут их.',
        ],
      },
      {
        img: img('exp-spot', 3),
        text: [
          'The ship glides to a stop over 2–3 seconds and lies at anchor: wind and current do not carry her off. The same timer sits by the portrait. Under fire before half time, up to 30 % of the party may be lost.',
          'Корабль за 2–3 секунды гасит ход и встаёт на якорь: ветер и течение его не сносят. Такой же таймер — у портрета. Под огнём до половины срока можно потерять до 30 % десанта.',
        ],
      },
    ],
    related: ['exp-treasure', 'exp-wrecks', 'exp-landing'],
    firstTime: 'dive',
  },
  {
    id: 'exp-mines',
    section: 'explore',
    title: ['Mines and your flag', 'Шахты и ваш флаг'],
    tags: ['mine', 'flag', 'yield', 'silver mine', 'guards', 'шахта', 'рудник', 'флаг', 'добыча', 'стража', 'поднять флаг'],
    summary: [
      'Beat a mine\'s guards, land and raise your flag: it pays every sea day. Up to 7 mines.',
      'Разбейте стражу шахты, высадитесь и поднимите флаг: она платит каждые сутки моря. До 7 шахт.',
    ],
    slides: [
      {
        img: img('exp-mines', 1),
        text: [
          'At a mine the prompt says what it needs: «guards stand before the mine: beat them first». A mine held by raiders wants a party at least as big as their garrison (4, 8 or 14 men).',
          'У шахты подсказка скажет, что нужно: «перед шахтой стоят стражи: сначала разбейте их». Шахту налётчиков берёт десант не меньше их гарнизона (4, 8 или 14 человек).',
        ],
      },
      {
        img: img('exp-mines', 2),
        text: [
          'Guards beaten: press «Land» (key L) by the mine.',
          'Стража разбита — нажмите «Высадка» (клавиша L) у шахты.',
        ],
      },
      {
        img: img('exp-mines', 3),
        text: [
          '«Raising the flag»: 20 seconds. A fresh flag is safe for 10 minutes.',
          '«Поднимают флаг»: 20 секунд. Свежий флаг 10 минут под защитой.',
        ],
      },
      {
        img: img('exp-mines', 4),
        text: [
          'Your flag flies: the yield goes to your island every sea day (48 minutes) — a silver mine 250 a day, timber 14, iron 7, tar 10, powder 5, pearls 1, rum 8; ×0.75 in safe waters, ×1.5 in lawless ones. Without an island it piles up at the mine, up to a week.',
          'Флаг поднят: добыча каждые сутки моря (48 минут) идёт на ваш остров — серебряный рудник 250 в день, лес 14, железо 7, смола 10, порох 5, жемчуг 1, ром 8; в безопасных водах ×0,75, в вольных ×1,5. Без острова она копится на шахте, до недели.',
        ],
      },
      {
        img: img('exp-mines', 5),
        text: [
          'Mines are on the chart\'s «All» layer: «Your mine», «· raiders», «· nobody\'s». You hold at most 7; raiders may come for a mine once in a while.',
          'Шахты — на слое «Всё» карты моря: «Ваша шахта», «· налётчики», «· ничья». Держать можно не больше 7; налётчики иногда приходят за шахтой.',
        ],
        show: { open: 'map', point: '[data-mlayer="all"]' },
      },
    ],
    related: ['faq-mines', 'exp-landing'],
  },
  {
    id: 'exp-lairs',
    section: 'explore',
    title: ['Lairs and their return', 'Логова и когда они возвращаются'],
    tags: ['lair', 'creatures', 'respawn', 'loot', 'pirate lair', 'логово', 'твари', 'вернётся', 'добыча', 'пиратское логово', 'штурм'],
    summary: [
      'A beaten lair comes back in 2–4 sea days; its full loot is yours once a week.',
      'Разбитое логово возвращается через 2–4 суток моря; полная добыча — раз в неделю.',
    ],
    slides: [
      {
        img: img('exp-lairs', 1),
        text: [
          'At a creatures\' lair the action bar offers «Assault» (key L): a hex battle on the shore against its beasts. «Look…» tells what lives there.',
          'У логова тварей панель действий предложит «Штурм» (клавиша L): бой на гексах на берегу. «Осмотреть…» расскажет, кто там живёт.',
        ],
      },
      {
        img: img('exp-lairs', 2),
        text: [
          'On the «Lairs» layer a beaten lair is grey with «comes back in …»: a shore lair after 1 h 36 min, a grotto after 2 h 24 min, a guardian after 3 h 12 min. Its full loot is each captain\'s once a sea week. A pirate battery is rebuilt after 6 hours.',
          'На слое «Логова» разбитое логово серое, с подписью «вернётся через …»: береговое через 1 ч 36 мин, грот через 2 ч 24 мин, страж через 3 ч 12 мин. Полная добыча — каждому раз в неделю моря. Пиратская батарея отстраивается через 6 часов.',
        ],
        show: { open: 'map', point: '[data-mlayer="lairs"]' },
      },
      {
        img: img('exp-lairs', 3),
        text: [
          '«Look…» shows its card at the top: how many, what kind and level, «Land and fight» or «Let them be». Named pirates come back 12–24 hours after they are sunk.',
          '«Осмотреть…» покажет карточку сверху: сколько их, кто и какого уровня, «Высадиться и биться» или «Отпустить». Именные пираты возвращаются через 12–24 часа после того, как их потопили.',
        ],
      },
    ],
    related: ['faq-lairs'],
  },
  {
    id: 'exp-marks',
    section: 'explore',
    title: ['Sea marks', 'Морские знаки'],
    tags: ['sea mark', 'buoy', 'wreckage', 'driftwood', 'lantern', 'знак', 'бакен', 'поле обломков', 'плавник', 'фонарь', 'льдина'],
    summary: [
      'Driftwood, wreck fields, fairway buoys, lanterns, floating bones, ice floes: stop by one and press its button.',
      'Плавник, поля обломков, знаки фарватера, фонари на поплавках, плавучие кости, льдины: встаньте рядом и нажмите кнопку.',
    ],
    slides: [
      {
        img: img('exp-marks', 1),
        text: [
          'Within 30 m of a mark its button appears: «Pick up», «Search», «Read», «Trim the lantern», «Fish out the bones», «Cut ice».',
          'В 30 м от знака появится его кнопка: «Подобрать», «Обыскать», «Прочесть», «Поправить фонарь», «Выловить кости», «Наколоть льда».',
        ],
      },
      {
        img: img('exp-marks', 2),
        text: [
          '«Boats at the mark»: 2 to 4 seconds. A wreck field may hold a treasure map (4 %).',
          '«Шлюпки у знака»: от 2 до 4 секунд. В поле обломков бывает карта сокровищ (4 %).',
        ],
      },
      {
        img: img('exp-marks', 3),
        text: [
          'A fairway buoy «Read» charts an island within 4 km. Wrecks, driftwood and bones are yours again after 48 hours, the rest after 24.',
          '«Прочесть» знак фарватера — и на карту ляжет остров в 4 км. Обломки, плавник и кости снова ваши через 48 часов, остальные знаки — через 24.',
        ],
      },
    ],
    related: ['exp-wrecks'],
  },
  {
    id: 'exp-lights',
    section: 'explore',
    title: ['Lookouts and lighthouses', 'Смотровые и маяки'],
    tags: ['lookout', 'lighthouse', 'keeper', 'night', 'shoals', 'смотровая', 'маяк', 'смотритель', 'ночь', 'мели'],
    summary: [
      'Climb a lookout to chart 5 km of sea; a lit lighthouse shows the shoals at night.',
      'Поднимитесь на смотровую — и 5 км моря лягут на карту; зажжённый маяк ночью показывает мели.',
    ],
    slides: [
      {
        img: img('exp-lights', 1),
        text: [
          'A lookout on a cape: «Land» by it (key L). The chart marks it ▲ — red until climbed, grey after.',
          'Смотровая на мысе: «Высадка» у неё (клавиша L). На карте она отмечена ▲ — красным, пока не поднимались, серым — после.',
        ],
      },
      {
        img: img('exp-lights', 2),
        text: [
          '«Climbing the lookout»: 15 seconds. Islands, reefs and wrecks within 5 km go on the chart and the fog lifts there (60 % of it if called off after half). Again after 2 hours.',
          '«Подъём на смотровую»: 15 секунд. Острова, рифы и обломки в 5 км лягут на карту, и туман там рассеется (60 %, если отозвать после половины). Снова — через 2 часа.',
        ],
      },
      {
        img: img('exp-lights', 3),
        text: [
          'The chart\'s key explains the rest: a lit lighthouse shows shoals and reefs in its light, 3.5 km, by night. Crown lights always burn; in contested waters a keeper lights his for 30 minutes — pay him («Keeper») at dusk or by night.',
          '«Условные знаки» карты расскажут остальное: зажжённый маяк ночью показывает мели и рифы в своём свете, 3,5 км. Маяки Короны горят всегда; в спорных водах смотритель зажигает огонь на 30 минут — заплатите ему («Смотритель») в сумерки или ночью.',
        ],
        show: { open: 'map', point: 'details.map-legend' },
      },
    ],
    related: ['exp-chart', 'exp-fog'],
    firstTime: 'lighthouse',
  },
  {
    id: 'exp-chart',
    section: 'explore',
    title: ['The chart of the known sea', 'Карта известного моря'],
    tags: ['chart', 'map', 'layers', 'legend', 'key', 'where am i', 'карта', 'слои', 'условные знаки', 'где я', 'найти врага', 'к острову', 'find', 'search', 'найти', 'поиск', 'поиск острова'],
    summary: [
      'Key M. Layers pick what is drawn; «Key» explains every mark; buttons find you, your island, a foe — and «Find» a place you know by its name.',
      'Клавиша M. Слои выбирают, что рисовать; «Условные знаки» объясняют каждый значок; кнопки находят вас, ваш остров, врага, а «Найти» — знакомое место по имени.',
    ],
    slides: [
      {
        img: img('exp-chart', 1),
        text: [
          'Layers: «Ports», «Goals», «Lairs», «Treasure», «All» and «Shipyards» (with the yard\'s rank and ship levels, e.g. «Shipyard 2 · ⚓1–6»: only the yards you have found, or those of a sea whose chart you bought).',
          'Слои: «Порты», «Цели», «Логова», «Сокровища», «Всё» и «Верфи» (с рангом верфи и уровнями кораблей, например «Верфь 2 · ⚓1–6»: только найденные верфи или верфи моря, чью карту вы купили).',
        ],
        show: { open: 'map' },
      },
      {
        img: img('exp-chart', 2),
        text: [
          '«Key» opens the legend: every circle, colour and sign of the chart in words.',
          '«Условные знаки» открывают легенду: каждый круг, цвет и знак карты — словами.',
        ],
      },
      {
        img: img('exp-chart', 3),
        text: [
          '«Where am I» centres on your ship, «To the island» lays the course home, «Find a foe» lists pirates, beasts and lairs nearby by level and distance — a tap sets the course.',
          '«Где я» покажет ваш корабль, «К острову» проложит курс домой, «Найти врага» — пираты, звери и логова рядом, по уровню и расстоянию; касание прокладывает курс.',
        ],
      },
      {
        img: img('exp-chart', 4),
        text: [
          '«Where is my level»: the nearest archipelago of your ship\'s level and «Show on the chart». Below — the day\'s orders and the common goal.',
          '«Где мой уровень»: ближайший архипелаг уровня вашего корабля и «Показать на карте». Ниже — поручения дня и общее дело.',
        ],
      },
    ],
    related: ['exp-fog', 'exp-treasure'],
    window: 'map',
  },
  {
    id: 'exp-chronicle',
    section: 'explore',
    title: ['«Chronicle»: everything that happened', '«Хроника»: всё, что случилось'],
    tags: ['chronicle', 'log', 'journal', 'history', 'хроника', 'журнал', 'история', 'добыча', 'бои'],
    summary: [
      '«Journal» → «Chronicle»: the last 300 events with filters.',
      '«Журнал» → «Хроника»: последние 300 событий с фильтрами.',
    ],
    slides: [
      {
        img: img('exp-chronicle', 1),
        text: [
          '«Journal» → «Chronicle» records everything: cargo raised, finds of divers and landings, treasures, bottles, boardings with their loot, who you sank and who sank you, rewards, deals, buildings.',
          '«Журнал» → «Хроника» записывает всё: поднятый груз, находки водолазов и высадок, клады, бутылки, абордажи с добычей, кого потопили вы и кто вас, награды, сделки, постройки.',
        ],
        show: { open: 'journal', point: '[data-jtab="chronicle"]' },
      },
      {
        img: img('exp-chronicle', 2),
        text: [
          'Filters: «All», «Loot», «Battles», «Quests», «Island». The last 300 entries, by days.',
          'Фильтры: «Всё», «Добыча», «Бои», «Задания», «Остров». Последние 300 записей, по дням.',
        ],
      },
      {
        img: img('exp-chronicle', 3),
        text: [
          'Simple reports — weekly supplies, the island\'s news — go here, not to the mail: letters come only with an attachment or something to do.',
          'Простые отчёты — поставки недели, вести острова — идут сюда, а не в почту: письмом приходит только то, где есть вложение или нужно действовать.',
        ],
      },
    ],
    related: ['prog-quests'],
    window: 'journal',
  },
  {
    id: 'exp-fog',
    section: 'explore',
    title: ['The fog of war', 'Туман войны'],
    tags: ['fog', 'unknown', 'sight', 'scouts', 'туман', 'неизвестно', 'обзор', 'разведчики'],
    summary: [
      'The sea is dark until you see it; once seen, it stays on your chart.',
      'Море тёмное, пока вы его не увидели; увиденное остаётся на карте навсегда.',
    ],
    slides: [
      {
        img: img('exp-fog', 1),
        text: [
          'A new captain\'s chart is mostly fog: only the start port (6 km around) and what she has sailed past. Unknown ports show as dim signs without a name.',
          'Карта нового капитана почти вся в тумане: виден только стартовый порт (6 км вокруг) и то, мимо чего она прошла. Неоткрытые порты — тусклыми знаками без названия.',
        ],
        show: { open: 'map' },
      },
      {
        img: img('exp-fog', 2),
        text: [
          'Your ship sees 2.4 km around (less in rain and fog, at least 1.5 km); every port visited opens 3.5 km. Lookouts and buoys chart more.',
          'Корабль видит на 2,4 км вокруг (в дождь и туман меньше, но не меньше 1,5 км); каждый посещённый порт открывает 3,5 км. Смотровые и знаки фарватера наносят больше.',
        ],
      },
      {
        img: img('exp-fog', 3),
        text: [
          'Your island sees 4 km plus 1 km per Town Hall level; a lighthouse and a signal tower add 1.5 km each, a chart house 2 km. Up to 3 scouts sail out to 30 km.',
          'Ваш остров видит на 4 км и ещё 1 км за уровень ратуши; маяк и сигнальная вышка добавляют по 1,5 км, картографическая — 2 км. До трёх разведчиков уходят на 30 км.',
        ],
        show: { open: 'isle' },
      },
    ],
    related: ['exp-chart', 'exp-lights'],
  },
  {
    id: 'exp-nav',
    section: 'explore',
    title: ['The navigator\'s distance perks', 'Таланты штурмана за пройденный путь'],
    tags: ['navigator', 'cartographer', 'pathfinder', 'star fix', 'distance', 'штурман', 'картограф', 'первопроходец', 'обсервация', 'путь', 'вахтенный журнал'],
    summary: [
      'Every 100 km sailed is a page of the log: «Cartographer» pays experience, «Pathfinder» morale and speed.',
      'Каждые 100 км пути — страница вахтенного журнала: «Картограф» даёт опыт, «Первопроходец» — дух и скорость.',
    ],
    slides: [
      {
        img: img('exp-nav', 1),
        text: [
          'A leg counts after 5 km in a straight line from the last one; circling in place counts nothing, and at most 120 km an hour. «Cartographer» pays experience for each 100 km page, up to 12 pages a day.',
          'Отрезок засчитывается через 5 км по прямой от прошлого; кружение на месте не считается, и не больше 120 км в час. «Картограф» даёт опыт за каждую страницу в 100 км, до 12 страниц в сутки.',
        ],
        show: { open: 'talents' },
      },
      {
        img: img('exp-nav', 2),
        text: [
          '«Pathfinder»: each page gives +5 morale and +2 % speed a rank until the next page (an hour at most); a new island +10 morale.',
          '«Первопроходец»: каждая страница даёт +5 духа и +2 % хода за ранг до следующей страницы (не дольше часа); новый остров — +10 духа.',
        ],
      },
      {
        img: img('exp-nav', 3),
        text: [
          'The navigator\'s «Star Fix» (key C): islands, wrecks and sea marks within 7 km go on the chart, and +8 % speed for 3 minutes plus a minute per 10 km since the last fix (10 at most).',
          '«Обсервация по звёздам» штурмана (клавиша C): острова, обломки и знаки в 7 км ложатся на карту, а ход +8 % на 3 минуты и ещё по минуте за каждые 10 км с прошлой обсервации (до 10).',
        ],
      },
    ],
    related: ['exp-chart', 'prog-talents'],
  },
];
