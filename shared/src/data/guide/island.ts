// «Лоцманская книга» · Остров: claiming, the town and its dwellings, costs and the treasury, «Завезти», demolishing,
// the guided first steps, the forge and the workshop, the producers, the island boats, «Где взять», the rush.
// Numbers as in the code on 2026-11-02 (shared/src/data/isletree.ts, startcost.ts, town.ts, base.ts, islandboats.ts,
// shop.ts; server/src/game/baseclaim.ts, islefirst.ts, raze.ts, base.ts). Shots: tools/guide/shots-qa.mjs.
import type { GuideArticle } from './types.ts';

/** A slide's shot: assets/guide/<article>-<n>.webp, given by its bare file name (the engine's way). */
const img = (id: string, n: number): string => `${id}-${n}.webp`;

export const ARTICLES: GuideArticle[] = [
  {
    id: 'isle-claim',
    section: 'island',
    title: ['Claiming an island', 'Как занять остров'],
    tags: ['island', 'claim', 'base', 'move', 'остров', 'занять', 'база', 'переезд', 'свой город'],
    summary: [
      'Any island without a port can be yours: the first one is free and immediate.',
      'Любой остров без порта может стать вашим: первый — бесплатно и сразу.',
    ],
    slides: [
      {
        img: img('isle-claim', 1),
        text: [
          'Sail up to the shore of a wild island. When the ship is close enough, the action bar shows «Claim» with the island\'s name: tap it.',
          'Подойдите к берегу дикого острова. Когда корабль у самого берега, на панели действий появится «Занять» с именем острова — нажмите.',
        ],
      },
      {
        img: img('isle-claim', 2),
        text: [
          'The claim card opens: its waters, its danger and the price. The first island costs nothing — press «Claim free» and confirm.',
          'Откроется карточка острова: воды, опасность налётов и цена. Первый остров ничего не стоит — нажмите «Занять бесплатно» и подтвердите.',
        ],
      },
      {
        img: img('isle-claim', 3),
        text: [
          'Next to it — other free islands nearby with «Sail» and the distance. A bigger island has more plots and outposts.',
          'Рядом — другие свободные острова поблизости с кнопкой «Плыть» и расстоянием. На большом острове больше участков и аванпостов.',
        ],
      },
      {
        img: img('isle-claim', 4),
        text: [
          'The Town Hall stands from the first day. Many captains may hold a base on the same island; port islands and pirate fortresses cannot be claimed.',
          'Ратуша стоит с первого дня. На одном острове могут жить базы многих капитанов; острова с портом и пиратские крепости занять нельзя.',
        ],
      },
      {
        img: img('isle-claim', 5),
        text: [
          'Moving to another island: the first move is free, then 1 000 000 silver or 2 600 doubloons. The old buildings are pulled down; the treasury, the goods, the residents and your ships go with you.',
          'Переезд на другой остров: первый бесплатно, дальше 1 000 000 серебра или 2 600 дублонов. Старые здания сносятся, а казна, товары, жители и ваши корабли переезжают с вами.',
        ],
      },
    ],
    related: ['isle-first', 'isle-town'],
    window: 'company',
  },
  {
    id: 'isle-first',
    section: 'island',
    title: ['First steps on the island', 'Первые шаги на острове'],
    tags: ['island', 'tutorial', 'steps', 'barracks', 'marines', 'остров', 'шаги', 'казарма', 'морпехи', 'стрельбище', 'губернатор'],
    summary: [
      'Three guided steps with rewards: the Marine Barracks, hiring marines, the Shooting Range.',
      'Три шага с подсказками и наградами: Казарма морпехов, наём морпехов, Стрельбище.',
    ],
    slides: [
      {
        img: img('isle-first', 1),
        text: [
          'Right after the claim a line appears at the top: «Island 1/3: build the Marine Barracks». Its button opens the right card on the island.',
          'Сразу после занятия сверху появится строка «Остров 1/3: постройте Казарму морпехов». Кнопка на ней открывает нужную карточку острова.',
        ],
      },
      {
        img: img('isle-first', 2),
        text: [
          'The Barracks need the Crew Quarters first — almost free: about 50 silver and a few logs. Then the Barracks: +300 silver and timber, iron and powder into the yard.',
          'Казарме нужен сначала Кубрик — почти даром: около 50 серебра и пара брёвен. Потом сама Казарма: награда +300 серебра и брёвна, железо и порох на склад.',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('isle-first', 3),
        text: [
          'Step 2: «Hire marines in any port». The ranks opened on your island are sold in every port, marked «your island». Reward: +400 silver.',
          'Шаг 2: «Наймите морпехов в любом порту». Ранги, открытые на острове, продаются в каждом порту с меткой «ваш остров». Награда: +400 серебра.',
        ],
        show: { open: 'hire' },
      },
      {
        img: img('isle-first', 4),
        text: [
          'Step 3: build the Shooting Range — musketeers, tier 3. Reward: +600 silver. A step counts only once the building stands, not while it is going up.',
          'Шаг 3: постройте Стрельбище — мушкетёры, третий ранг. Награда: +600 серебра. Шаг засчитывается, когда здание достроено, а не пока идёт стройка.',
        ],
      },
      {
        img: img('isle-first', 5),
        text: [
          'Short of money for the first buildings? Once, the governor helps: the missing goods go to the yard and the silver to the treasury.',
          'Не хватает на первые постройки? Один раз поможет губернатор: недостающие товары лягут на склад, а серебро — в казну.',
        ],
      },
    ],
    related: ['isle-claim', 'isle-town', 'army-island'],
    window: 'isle',
    firstTime: 'first-isle',
  },
  {
    id: 'isle-town',
    section: 'island',
    title: ['The town and its dwellings', 'Город и жилища'],
    tags: ['town', 'hall', 'dwellings', 'keep', 'market', 'guild', 'город', 'ратуша', 'жилища', 'крепость', 'рынок', 'гильдия', 'кубрик', 'казарма'],
    summary: [
      'The Town Hall sets the island\'s level; seven dwellings train your army tier by tier.',
      'Ратуша задаёт уровень острова, а семь жилищ растят армию ранг за рангом.',
    ],
    slides: [
      {
        img: img('isle-town', 1),
        text: [
          'Open the island and tap «Town» on the left. Here is the whole HoMM-style town: the Town Hall, the walls, the dwellings and the market.',
          'Откройте остров и нажмите «Город» слева. Здесь весь город в духе «Героев»: ратуша, стены, жилища и рынок.',
        ],
        show: { open: 'isle', point: '[data-iside="town"]' },
      },
      {
        img: img('isle-town', 2),
        text: [
          'The Town Hall pays silver into the treasury every dawn (60 to 400 a day) and raises the island\'s level. No building may stand higher than the Hall. Its name grows with the level: the Council House, the Town Office, the Governor\'s House…',
          'Ратуша каждый рассвет платит серебро в казну (от 60 до 400 в день) и поднимает уровень острова. Ни одно здание не может быть выше ратуши. Имя растёт с уровнем: Дом совета, Городская управа, Губернаторский дом…',
        ],
      },
      {
        img: img('isle-town', 3),
        text: [
          'Seven dwellings: Crew Quarters, Marine Barracks, Shooting Range, Gun Yard, Veterans\' Den, Admiralty, Shrine of the Drowned. Each opens its tier for hire; from level 3 it trains the upgraded kind.',
          'Семь жилищ: Кубрик, Казарма морпехов, Стрельбище, Пушечный двор, Притон ветеранов, Адмиралтейство, Святилище утопленников. Каждое открывает свой ранг для найма, с 3-го уровня — улучшенный.',
        ],
      },
      {
        img: img('isle-town', 4),
        text: [
          'The Keep makes every dwelling grow more men: the Citadel (level 3) by half, the Castle (level 5) twice. The Market trades resources, the Guild of Orders teaches orders.',
          'Крепость даёт всем жилищам больше бойцов: цитадель (3-й уровень) в полтора раза, замок (5-й) вдвое. Рынок меняет ресурсы, Гильдия приказов учит приказам.',
        ],
      },
      {
        img: img('isle-town', 5),
        text: [
          'Each card says what it needs first («First raise: …»). Not sure what to build? The «Next» card bottom right names the next useful step: tap it.',
          'На каждой карточке написано, что нужно сначала: «Сначала поднимите: …». Не знаете, что строить? Карточка «Далее» справа внизу подскажет следующий шаг — нажмите на неё.',
        ],
      },
    ],
    related: ['isle-cost', 'isle-first', 'army-tiers'],
    window: 'isle',
  },
  {
    id: 'isle-cost',
    section: 'island',
    title: ['Building costs and the treasury', 'Цены построек и казна'],
    tags: ['cost', 'treasury', 'silver', 'build', 'brigade', 'цена', 'казна', 'серебро', 'стройка', 'бригада', 'дешево'],
    summary: [
      'Levels 1 and 2 are almost free; the treasury pays first, then your purse.',
      'Первый и второй уровни почти даром; платит сначала казна, потом кошелёк.',
    ],
    slides: [
      {
        img: img('isle-cost', 1),
        text: [
          'The price is on the card: silver, resources and time. Level 1 costs 40–300 silver and a few logs, level 2 — 100–600. The whole first level is about 740 silver.',
          'Цена — на карточке: серебро, ресурсы и время. Первый уровень стоит 40–300 серебра и несколько брёвен, второй — 100–600. Весь первый уровень — около 740 серебра.',
        ],
      },
      {
        img: img('isle-cost', 2),
        text: [
          'From level 3 it grows steeply: the Town Hall 3 costs 5 350 silver and 8 hours, Hall 4 — 48 000, Hall 5 — 95 000. Build the cheap levels everywhere first.',
          'С третьего уровня цены круто растут: ратуша 3 — 5 350 серебра и 8 часов, ратуша 4 — 48 000, ратуша 5 — 95 000. Сначала берите дешёвые уровни везде.',
        ],
      },
      {
        img: img('isle-cost', 3),
        text: [
          'The coin at the top is the island\'s treasury. Building, the market and the barge are paid from it first, then from your purse — from anywhere, at sea or in port.',
          'Монетка вверху — казна острова. Стройка, рынок и барка платятся сначала из неё, потом из кошелька капитана — откуда угодно, в море или в порту.',
        ],
      },
      {
        img: img('isle-cost', 4),
        text: [
          'Builders: «Brigades» at the bottom. One crew at first, a second from island level 3. Each brigade builds one thing at a time.',
          'Строители — «Бригады» внизу. Сначала одна бригада, вторая — с 3-го уровня острова. Каждая строит что-то одно.',
        ],
      },
    ],
    related: ['isle-haul', 'isle-rush', 'isle-where'],
    window: 'isle',
  },
  {
    id: 'isle-haul',
    section: 'island',
    title: ['«Bring in»: silver and goods to the island', '«Завезти»: серебро и товары на остров'],
    tags: ['haul', 'treasury', 'deposit', 'barge', 'unload', 'yard', 'завезти', 'казна', 'положить', 'барка', 'выгрузить', 'склад'],
    summary: [
      'Silver goes into the treasury from anywhere; goods are unloaded off the island; the barge brings timber, coal and iron.',
      'Серебро кладётся в казну откуда угодно, товары выгружаются у острова, барка привозит лес, уголь и железо.',
    ],
    slides: [
      {
        img: img('isle-haul', 1),
        text: [
          'In the island window tap «Bring in» on the left (or the treasury coin at the top).',
          'В окне острова нажмите «Завезти» слева (или монетку казны вверху).',
        ],
        show: { open: 'isle', point: '[data-iside="haul"]' },
      },
      {
        img: img('isle-haul', 2),
        text: [
          'Treasury: type an amount and press «Put in the treasury», or «All the silver». It works from anywhere. «Take out» works only off the island or in a port of its region.',
          'Казна: введите сумму и нажмите «Положить в казну» или «Всё серебро». Работает откуда угодно. «Забрать» — только у острова или в порту его области.',
        ],
      },
      {
        img: img('isle-haul', 3),
        text: [
          '«Order a barge»: it brings 30 timber, 20 coal and 5 iron per Town Hall level straight to the yard, for silver, from anywhere. The price is on the button.',
          '«Заказать барку»: она сразу привозит на склад 30 брёвен, 20 угля и 5 железа за каждый уровень ратуши — за серебро, откуда угодно. Цена на кнопке.',
        ],
      },
      {
        img: img('isle-haul', 4),
        text: [
          '«Unload to the yard»: lying off your island, timber, coal, tar, iron, provisions, powder, pearls and rum go from the hold to the yard, up to its limit. Goods never go back out.',
          '«Выгрузить на склад»: когда корабль стоит у острова, брёвна, уголь, смола, железо, провизия, порох, жемчуг и ром переходят из трюма на склад до его предела. Обратно не забрать.',
        ],
      },
      {
        img: img('isle-haul', 5),
        text: [
          'While the ship lies off the island, building takes what it needs straight from the hold. The yard holds 150 + 50 per island level + 250 per Warehouse level of each good.',
          'Пока корабль стоит у острова, стройка берёт нужное прямо из трюма. Склад вмещает 150 + 50 за уровень острова + 250 за уровень Склада каждого товара.',
        ],
      },
    ],
    related: ['isle-cost', 'faq-silver-isle', 'isle-where'],
    window: 'isle',
  },
  {
    id: 'isle-raze',
    section: 'island',
    title: ['Demolishing a building', 'Как снести здание'],
    tags: ['raze', 'demolish', 'refund', 'снести', 'снос', 'вернуть', 'участок'],
    summary: [
      'A building can be razed for half its cost back; the plot is freed.',
      'Здание можно снести — вернётся половина его стоимости, участок освободится.',
    ],
    slides: [
      {
        img: img('isle-raze', 1),
        text: [
          'Tap a standing building on the island: its card opens with «Raze» at the bottom.',
          'Нажмите на построенное здание на острове: откроется его карточка, внизу — «Снести».',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('isle-raze', 2),
        text: [
          'The game asks once more. Half of every standing level comes back: silver to the treasury, goods to the yard. Work in progress is refunded in full.',
          'Игра переспросит. Вернётся половина стоимости каждого уровня: серебро — в казну, товары — на склад. Незаконченная стройка возвращается целиком.',
        ],
      },
      {
        img: img('isle-raze', 3),
        text: [
          'You cannot raze what others stand on («something rests on it») — nor the Town Hall or the Grail. A razed dwelling loses its waiting men, and its tier is no longer hired.',
          'Нельзя снести то, на чём держатся другие здания, а также ратушу и Грааль. Снесённое жилище теряет ждущих бойцов, и его ранг больше не нанимается.',
        ],
      },
    ],
    related: ['isle-town', 'isle-cost'],
    window: 'isle',
  },
  {
    id: 'isle-forge',
    section: 'island',
    title: ['Forge, workshop and anvil', 'Кузница, мастерская и наковальня'],
    tags: ['forge', 'temper', 'gear', 'artifact', 'anvil', 'workshop', 'craft', 'кузница', 'закалка', 'шмот', 'снаряжение', 'артефакт', 'наковальня', 'мастерская'],
    summary: [
      'Gear is tempered in the Forge (Town Hall 3+); artifacts are made in the Workshop and reforged on the Anvil (a Market is needed).',
      'Снаряжение закаляют в «Кузнице» (ратуша 3+), артефакты куют в «Мастерской» и перековывают на «Наковальне» (нужен «Рынок»).',
    ],
    slides: [
      {
        img: img('isle-forge', 1),
        text: [
          'The Forge is a plot building, open from Town Hall 3. While the ship lies off the island it works as a shipyard for gear: tempering, reforging, mending.',
          '«Кузница» — здание на участке, открывается с ратуши 3. Пока корабль стоит у острова, она работает как верфь для снаряжения: закалка, перековка, починка.',
        ],
      },
      {
        img: img('isle-forge', 2),
        text: [
          'Tempering is in the gear window: tap a piece, then «Temper to +N». Each step adds 3 % to the main line, up to 5 times («tempered +5»); it costs silver, iron and planks from the hold. «Reforge a line» rolls one line anew. A port with a shipyard of rank 2+ does the same.',
          'Закалка — в окне снаряжения: нажмите на вещь, затем «Закалить до +N». Каждая ступень даёт +3 % к главному свойству, до 5 раз («закалка +5»); платится серебром, железом и досками из трюма. «Перековать строку» заново выковывает одно свойство. То же умеет порт с верфью от 2-го ранга.',
        ],
        show: { open: 'gear' },
      },
      {
        img: img('isle-forge', 3),
        text: [
          'The «Workshop» in the island\'s Town makes artifacts from land trophies (shell, bone, venom from the lairs) and silver: the mail-lined coat, the marksman\'s bandolier, the orca talisman, the medal of Saint Mercy. It needs a Market of level 1 to 3 and the ship off the island.',
          '«Мастерская» в «Городе» острова куёт артефакты из трофеев суши (панцирь, кость, яд из логов) и серебра: камзол на кольчуге, патронташ стрелка, талисман косатки, медаль святой Милости. Нужен «Рынок» 1–3-го уровня и корабль у острова.',
        ],
        show: { open: 'isle', point: '[data-iside="town"]' },
      },
      {
        img: img('isle-forge', 4),
        text: [
          'The «Anvil» reforges an artifact: its primary skills or one forged line. The new work lies next to the old until you choose. Each strike costs half the first price more, up to three times it.',
          '«Наковальня» перековывает артефакт: первичные навыки или одно выкованное свойство. Новая работа лежит рядом с прежней, пока вы не выберете. Каждый удар дороже на половину первого, до трёх раз.',
        ],
      },
    ],
    related: ['faq-gear', 'isle-town'],
    window: 'isle',
  },
  {
    id: 'isle-producers',
    section: 'island',
    title: ['Producers and the yard', 'Промыслы и склад'],
    tags: ['producers', 'lumber', 'mine', 'yield', 'collect', 'yard', 'промысел', 'лесоповал', 'каменоломня', 'рудник', 'собрать', 'склад', 'ресурсы'],
    summary: [
      'Lumber camps, quarries and mines fill the yard by the hour; collect with «Collect».',
      'Лесоповал, каменоломня, рудник и другие промыслы каждый час пополняют склад; забирайте кнопкой «Собрать».',
    ],
    slides: [
      {
        img: img('isle-producers', 1),
        text: [
          'Tap a free plot («+») and choose a producer. At level 1 per hour: lumber camp 8 timber, quarry 6 coal, tar kiln 4 tar, iron mine 3 iron, fishing crew 8 provisions.',
          'Нажмите на свободный участок («+») и выберите промысел. На 1-м уровне в час: лесоповал 8 брёвен, каменоломня 6 угля, смолокурня 4 смолы, железный рудник 3 железа, рыбная артель 8 провизии.',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('isle-producers', 2),
        text: [
          'Each level adds half again (×3 at level 5), then the island\'s land decides: on some islands a producer gives more, on some it cannot be built at all.',
          'Каждый уровень добавляет половину (×3 на 5-м), а дальше решает земля острова: где-то промысел даёт больше, а где-то его вовсе нельзя поставить.',
        ],
      },
      {
        img: img('isle-producers', 3),
        text: [
          'The yard counters run along the top: what is stored and the limit. When producers have made something, «Collect» on the left lights up.',
          'Вверху — счётчики склада: сколько лежит и предел. Когда промыслы что-то наработали, загорается кнопка «Собрать» слева.',
        ],
        show: { open: 'isle', point: '[data-iside="collect"]' },
      },
      {
        img: img('isle-producers', 4),
        text: [
          'How many of each kind: one, plus one more every three island levels. No producer may be higher than the Town Hall.',
          'Сколько промыслов одного вида: один и ещё по одному за каждые три уровня острова. Промысел не может быть выше ратуши.',
        ],
      },
    ],
    related: ['isle-haul', 'isle-town'],
    window: 'isle',
  },
  {
    id: 'isle-boats',
    section: 'island',
    title: ['Island boats', 'Шлюпы с острова'],
    tags: ['boats', 'reinforcements', 'hire', 'away', 'шлюпы', 'подкрепление', 'найм', 'далеко', 'доставка'],
    summary: [
      'Far from home, load men from your island\'s dwellings into boats: they catch you up anywhere at sea.',
      'Вдали от дома грузите бойцов с жилищ острова в шлюпы — они догонят вас где угодно в море.',
    ],
    slides: [
      {
        img: img('isle-boats', 1),
        text: [
          'At sea, far from the island, open «⋯» → «Boats» (or the island\'s Town → «Send the boats», or the crew window).',
          'В море, вдали от острова, откройте «⋯» → «Шлюпы» (или «Город» острова → «Отправить шлюпы», или окно команды).',
        ],
      },
      {
        img: img('isle-boats', 2),
        text: [
          'The hire window opens in its boats mode. Choose a kind, set the number and press «Into the boats»: the fill bar at the top shows how full they are.',
          'Окно найма откроется в режиме шлюпов. Выберите бойцов, задайте число и нажмите «В шлюпы»: полоска сверху покажет, насколько они заполнены.',
        ],
        show: { open: 'hire' },
      },
      {
        img: img('isle-boats', 3),
        text: [
          'Press «Send the boats». Island prices plus a small delivery fee: the farther you are and the lower the Town Hall, the dearer.',
          'Нажмите «Отправить шлюпы». Цены островные плюс небольшая плата за доставку: чем дальше вы и чем ниже ратуша, тем дороже.',
        ],
      },
      {
        img: img('isle-boats', 4),
        text: [
          'Under way, the «Boats coming» pill shows the time and the distance, and a dashed line runs on the dial. They come alongside and the men step aboard.',
          'В пути плашка «Шлюпы идут» показывает время и расстояние, а на компасе — пунктир. Шлюпы подойдут к борту, и бойцы поднимутся на корабль.',
        ],
      },
      {
        img: img('isle-boats', 5),
        text: [
          'The Town Hall decides everything: 10 to 14 times your speed, 1 to 3 stacks a trip, a quarter to all of your hammocks, and a break of 10 minutes down to 3.',
          'Ратуша решает всё: от 10 до 14 раз быстрее корабля, от 1 до 3 отрядов за рейс, от четверти до всех коек и перерыв между рейсами от 10 до 3 минут.',
        ],
      },
    ],
    related: ['army-island', 'army-hire'],
    window: 'hire',
  },
  {
    id: 'isle-where',
    section: 'island',
    title: ['«Where to get it»', '«Где взять»'],
    tags: ['where', 'source', 'tooltip', 'resource', 'где взять', 'подсказка', 'ресурс', 'не хватает'],
    summary: [
      'Every cost chip tells where to get what is missing and can sail you to the nearest seller.',
      'Каждый значок цены подскажет, где взять недостающее, и может довести до ближайшего продавца.',
    ],
    slides: [
      {
        img: img('isle-where', 1),
        text: [
          'Short of something? Tap its chip in the price (red means not enough): a «Where to get it» card opens.',
          'Чего-то не хватает? Нажмите на значок в цене (красный — мало): откроется подсказка «Где взять».',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('isle-where', 2),
        text: [
          'It lists the sources: which ports sell it, the island\'s Market (it sells straight to the yard), the barge, the producers.',
          'В ней — откуда это берётся: какие порты продают, рынок острова (продаёт прямо на склад), барка, промыслы.',
        ],
      },
      {
        img: img('isle-where', 3),
        text: [
          '«Sail to the nearest seller» lays the course; «More» opens the good\'s full card.',
          '«Плыть к ближайшему продавцу» прокладывает курс, «Подробнее» открывает полную карточку товара.',
        ],
      },
    ],
    related: ['isle-haul', 'isle-producers'],
    window: 'isle',
  },
  {
    id: 'isle-rush',
    section: 'island',
    title: ['Rushing a build', 'Ускорить стройку'],
    tags: ['rush', 'speed up', 'finish', 'doubloons', 'tokens', 'ускорить', 'ускорение', 'завершить', 'дублоны', 'жетоны'],
    summary: [
      'Free 15-minute speed-ups come every day; the rest is finished for doubloons.',
      'Бесплатные ускорения по 15 минут приходят каждый день, остальное завершается за дублоны.',
    ],
    slides: [
      {
        img: img('isle-rush', 1),
        text: [
          'A building under way shows its timer at the bottom with «Speed up»: it spends your free tokens first (15 minutes each), then the shop\'s minutes.',
          'У строящегося здания внизу — таймер и кнопка «Ускорить»: сначала тратятся бесплатные жетоны (по 15 минут), потом минуты из лавки.',
        ],
        show: { open: 'isle' },
      },
      {
        img: img('isle-rush', 2),
        text: [
          'Tokens: +2 for the daily login and +1 for each daily order, at most 20. Speed-ups are never paid in silver.',
          'Жетоны: +2 за ежедневный вход и +1 за каждое ежедневное поручение, не больше 20. Серебром ускорить нельзя.',
        ],
      },
      {
        img: img('isle-rush', 3),
        text: [
          '«Finish for ◉N» ends it at once for doubloons: 0.6 a minute, from 290 to 9 900 — so 290 covers up to about 8 hours.',
          '«Завершить за ◉N» заканчивает сразу за дублоны: 0,6 за минуту, от 290 до 9 900 — то есть 290 хватает примерно на 8 часов.',
        ],
      },
      {
        img: img('isle-rush', 4),
        text: [
          'Packs of speed-ups and extra brigades are in the shop: «Island» → «Building».',
          'Наборы ускорений и дополнительные бригады — в лавке: «Остров» → «Стройка».',
        ],
        show: { open: 'shop' },
      },
    ],
    related: ['isle-cost', 'prog-shop'],
    window: 'isle',
  },
];
