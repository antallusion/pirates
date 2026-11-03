// «Лоцманская книга» · Армия: hiring in ports and from the island, stacks (split, merge, dismiss), the might cap, tiers
// and upgrades, gift stacks, the surgeon and resurrection, berths, the convoy. Numbers as in the code on 2026-11-02
// (shared/src/data/army.ts, town.ts, resurrect.ts, berths.ts; server/src/game/dwell.ts, armyops.ts, shipbuilding.ts,
// fleet.ts). Shots: tools/guide/shots-qa.mjs.
import type { GuideArticle } from './types.ts';

/** A slide's shot: assets/guide/<article>-<n>.webp, given by its bare file name (the engine's way). */
const img = (id: string, n: number): string => `${id}-${n}.webp`;

export const ARTICLES: GuideArticle[] = [
  {
    id: 'army-hire',
    section: 'army',
    title: ['Hiring an army', 'Как нанять армию'],
    tags: ['hire', 'recruit', 'army', 'dwellings', 'tavern', 'найм', 'нанять', 'армия', 'жилища', 'таверна', 'юнги', 'морпехи'],
    summary: [
      'In port: «Army» → «Recruit an army». Pick a kind, set the number, «Hire».',
      'В порту: «Армия» → «Нанять армию». Выберите бойцов, задайте число, «Нанять».',
    ],
    slides: [
      {
        img: img('army-hire', 1),
        text: [
          'In any port open the «Army» tab and press «Recruit an army». The card above it is the surgeon.',
          'В любом порту откройте вкладку «Армия» и нажмите «Нанять армию». Карточка над ней — лекарь.',
        ],
        show: { open: 'port:army', point: '[data-dwell]' },
      },
      {
        img: img('army-hire', 2),
        text: [
          'The «Recruit» window lists every dwelling you can hire from: its name, how many wait and how many grow a week. Each kind is a card with its price.',
          'Окно «Найм» показывает все жилища, где можно нанять: название, сколько бойцов ждёт и сколько прибывает за неделю. Каждый вид — карточка с ценой.',
        ],
        show: { open: 'hire' },
      },
      {
        img: img('army-hire', 3),
        text: [
          'Tap a card: its stats appear on the right. Move the slider or press «Max», check the price and press «Hire».',
          'Нажмите на карточку: справа появятся её характеристики. Сдвиньте ползунок или нажмите «Макс.», проверьте цену и нажмите «Нанять».',
        ],
      },
      {
        img: img('army-hire', 4),
        text: [
          'The top row tells the limits: «Hammocks» (men aboard), «Stacks» (slots for squads), «Picked» (tier 4 and up) and «Might».',
          'Вверху — пределы: «Койки» (люди на борту), «Отряды» (места под отряды), «Отборные» (ранги от 4-го) и «Сила».',
        ],
      },
      {
        img: img('army-hire', 5),
        text: [
          'Plain deckhands are also hired in the «Tavern»: the slider and «Hire N». Officers are there too.',
          'Простых матросов нанимают и в «Таверне»: ползунок и «Нанять N». Там же — офицеры.',
        ],
        show: { open: 'port:tavern' },
      },
    ],
    related: ['army-island', 'army-stacks', 'army-might'],
    window: 'hire',
    firstTime: 'first-hire',
  },
  {
    id: 'army-island',
    section: 'army',
    title: ['Island troops in any port', 'Бойцы острова в любом порту'],
    tags: ['island', 'dwellings', 'your island', 'deckhands ashore', 'остров', 'ваш остров', 'жилища', 'юнги на берег', 'наценка'],
    summary: [
      'Every dwelling of tier 2–7 on your island opens that tier for hire in every port.',
      'Каждое жилище 2–7-го ранга на вашем острове открывает этот ранг для найма в любом порту.',
    ],
    slides: [
      {
        img: img('army-island', 1),
        text: [
          'Dwellings of your island are marked «your island» in the hire window — in every port, on rafts and at floating waystations. Their men are your island\'s pool.',
          'Жилища вашего острова в окне найма отмечены «ваш остров» — в любом порту, на плотах и в плавучих портах. Бойцы в них — из запаса вашего острова.',
        ],
        show: { open: 'hire' },
      },
      {
        img: img('army-island', 2),
        text: [
          'Away from the island they cost a quarter more (marines: 75 instead of 60). Deckhands always come from the tavern. On the island itself the price is the plain one, but the ship must lie off it.',
          'Вдали от острова они на четверть дороже (морпехи: 75 вместо 60). Юнги всегда берутся в таверне. На самом острове цена обычная, но корабль должен стоять у берега.',
        ],
      },
      {
        img: img('army-island', 3),
        text: [
          'Hammocks full of deckhands? Hire a higher tier anyway: the line «Deckhands go ashore: N» shows how many make room.',
          'Койки заняты юнгами? Нанимайте старший ранг смело: строка «Юнги сойдут на берег: N» покажет, сколько уступят место.',
        ],
      },
      {
        img: img('army-island', 4),
        text: [
          'Some kinds need more: gunners from ship level ⚓2, boarders from ⚓4, guards from ⚓6. The drowned serve only captains of the Choir and cursed ships.',
          'Для некоторых нужен уровень корабля: канониры с ⚓2, абордажники с ⚓4, гвардия с ⚓6. Утопленники служат только капитанам Хора и проклятым кораблям.',
        ],
      },
    ],
    related: ['army-hire', 'isle-town', 'isle-boats'],
    window: 'hire',
  },
  {
    id: 'army-stacks',
    section: 'army',
    title: ['Stacks: split, merge, dismiss', 'Отряды: разделить, объединить, уволить'],
    tags: ['stacks', 'split', 'merge', 'dismiss', 'slots', 'crew', 'отряды', 'разделить', 'объединить', 'уволить', 'команда', 'ячейки'],
    summary: [
      'In «The Company» (key O) or «Recruit»: tap a stack, then «Split» or «Dismiss»; drop it on its kind to merge.',
      'В окне «Команда» (клавиша O) или «Найм»: нажмите на отряд, потом «Разделить» или «Уволить»; на отряд того же вида — объединить.',
    ],
    slides: [
      {
        img: img('army-stacks', 1),
        text: [
          'Open «The Company» (key O, or «⋯» → «Army» at sea). The «Army» card shows your stacks: tier, might and the number of men.',
          'Откройте «Команду» (клавиша O, в море — «⋯» → «Армия»). Карточка «Армия» показывает отряды: ранг, силу и число бойцов.',
        ],
        show: { open: 'crew' },
      },
      {
        img: img('army-stacks', 2),
        text: [
          'Tap a stack: «Split», «Dismiss» and «Cancel» appear. The hint says it: drag it onto a stack of the same kind to merge, onto an empty slot to split.',
          'Нажмите на отряд: появятся «Разделить», «Уволить» и «Отмена». Подсказка напомнит: перетащите на отряд того же вида — объединить, на пустую ячейку — разделить.',
        ],
      },
      {
        img: img('army-stacks', 3),
        text: [
          '«Split»: move the slider — «Stays: a · New stack: b» — and confirm. At least one man moves and one stays, and a free slot is needed.',
          '«Разделить»: сдвиньте ползунок — «Останется: a · Новый отряд: b» — и подтвердите. Уходит хотя бы один боец, и хотя бы один остаётся; нужна свободная ячейка.',
        ],
      },
      {
        img: img('army-stacks', 4),
        text: [
          'Two stacks of one kind fight as two squads in the boarding — handy to shield the shooters. Stack slots grow with the hull: a sloop 4, a brig 6, a galleon and up 7.',
          'Два отряда одного вида в абордаже ходят отдельно — удобно прикрыть стрелков. Число ячеек растёт с корпусом: у шлюпа 4, у брига 6, у галеона и выше 7.',
        ],
      },
      {
        img: img('army-stacks', 5),
        text: [
          '«Dismiss» asks once more: the men leave the ship for good. One stack always stays aboard; none of this works in a boarding or with a party ashore.',
          '«Уволить» переспросит: бойцы навсегда покинут корабль. Один отряд всегда остаётся на борту; во время абордажа и с десантом на берегу всё это недоступно.',
        ],
      },
    ],
    related: ['army-hire', 'army-gift'],
    window: 'crew',
  },
  {
    id: 'army-might',
    section: 'army',
    title: ['«Might X/Y»: the ship\'s limit', '«Сила X/Y»: предел корабля'],
    tags: ['might', 'power', 'cap', 'limit', 'picked', 'сила', 'предел', 'отборные', 'уровень корабля'],
    summary: [
      'The ship\'s level caps how strong an army it carries; deckhands are never capped.',
      'Уровень корабля ограничивает силу армии на борту; юнги в предел не входят.',
    ],
    slides: [
      {
        img: img('army-might', 1),
        text: [
          '«Might X/Y» in the hire window: X is your army now, Y the most your ship takes. Might is the army\'s boarding strength counted in deckhands.',
          '«Сила X/Y» в окне найма: X — сила армии сейчас, Y — сколько выдержит корабль. Сила — это абордажная мощь армии, пересчитанная в юнгах.',
        ],
        show: { open: 'hire' },
      },
      {
        img: img('army-might', 2),
        text: [
          '«Picked» is a second limit: tier 4 and up may fill only part of the hammocks (from 15 % at ⚓1 to 45 %).',
          '«Отборные» — второй предел: бойцы от 4-го ранга занимают лишь часть коек (от 15 % на ⚓1 до 45 %).',
        ],
      },
      {
        img: img('army-might', 3),
        text: [
          'Y grows with the ship\'s level, its hammocks and its slots: a new hull or a refit raises it. When the army is as strong as the ship allows, the game says so and the hire stops; deckhands and titans are never capped.',
          'Y растёт с уровнем корабля, его койками и ячейками: новый корпус или перестройка поднимают предел. Когда армия упёрлась в предел, игра скажет об этом и найм остановится; юнги и титаны в предел не входят.',
        ],
        show: { open: 'crew' },
      },
    ],
    related: ['army-hire', 'army-tiers'],
    window: 'hire',
  },
  {
    id: 'army-tiers',
    section: 'army',
    title: ['Tiers and upgrades', 'Ранги и улучшение'],
    tags: ['tier', 'upgrade', 'rank', 'units', 'ранг', 'улучшение', 'улучшить', 'бойцы', 'морская гвардия', 'меткие стрелки'],
    summary: [
      'Seven tiers, each with an upgraded kind; an upgraded dwelling retrains men for the price difference.',
      'Семь рангов, у каждого есть улучшенный вид; улучшенное жилище переучивает бойцов за разницу в цене.',
    ],
    slides: [
      {
        img: img('army-tiers', 1),
        text: [
          'Every dwelling has two cards: the plain kind and the upgraded one (gunners → bombardiers). The Roman numeral on a stack is its tier; a gold chevron marks the upgraded kind.',
          'У каждого жилища две карточки: обычный вид и улучшенный (канониры → бомбардиры). Римская цифра на отряде — ранг, золотой шеврон — улучшенный вид.',
        ],
        show: { open: 'hire' },
      },
      {
        img: img('army-tiers', 2),
        text: [
          '«Unit upgrades» at the bottom of the hire window: «Upgrade N» retrains a stack for the price difference — only where the dwelling is upgraded, and within the might limit.',
          '«Улучшение отрядов» внизу окна найма: «Улучшить N» переучивает отряд за разницу в цене — только там, где жилище улучшено, и в пределах силы.',
        ],
      },
      {
        img: img('army-tiers', 3),
        text: [
          'On your island a dwelling trains the upgraded kind from level 3. Some men want goods besides silver: musketeers powder, gunners powder and iron, boarders rum, guards pearls.',
          'На острове жилище с 3-го уровня учит улучшенный вид. Некоторым бойцам кроме серебра нужны товары: мушкетёрам порох, канонирам порох и железо, абордажникам ром, гвардии жемчуг.',
        ],
        show: { open: 'isle', point: '[data-iside="town"]' },
      },
    ],
    related: ['army-might', 'isle-town'],
    window: 'hire',
  },
  {
    id: 'army-gift',
    section: 'army',
    title: ['Gift stacks', 'Подарочные отряды'],
    tags: ['gift', 'present', 'letter', 'no refill', 'подарок', 'подарочный', 'письмо', 'не восполняются', 'мушкетёры'],
    summary: [
      'A stack marked «gift» fights like any other, but its losses are never refilled.',
      'Отряд с пометкой «подарок» воюет как обычный, но его потери не восполняются.',
    ],
    slides: [
      {
        img: img('army-gift', 1),
        text: [
          'Gift stacks come in letters: «Journal» → «Letters», the attachment with the «gift» tag, «Receive». No room aboard? Dismiss someone in «The Company»: the letter waits.',
          'Подарочные отряды приходят в письмах: «Журнал» → «Письма», вложение с пометкой «подарок», кнопка «Получить». Нет места на борту? Увольте кого-нибудь в «Команде» — письмо подождёт.',
        ],
        show: { open: 'journal' },
      },
      {
        img: img('army-gift', 2),
        text: [
          'The stack wears a red «gift» ribbon. It fights, trains and splits like any other.',
          'На отряде — красная лента «подарок». Он воюет, обучается и делится как обычный.',
        ],
        show: { open: 'crew' },
      },
      {
        img: img('army-gift', 3),
        text: [
          'But nothing refills its losses: no hire, no first aid, no resurrection, no merging with hired men of the same kind. Keep it out of the hardest blows.',
          'Но его потери ничем не восполнить: ни наймом, ни первой помощью, ни воскрешением, ни слиянием с нанятыми бойцами того же вида. Берегите его от самых тяжёлых ударов.',
        ],
      },
    ],
    related: ['army-stacks', 'army-healer'],
    window: 'crew',
  },
  {
    id: 'army-healer',
    section: 'army',
    title: ['The surgeon and resurrection', 'Лекарь и воскрешение'],
    tags: ['surgeon', 'healer', 'resurrect', 'fallen', 'лекарь', 'воскресить', 'павшие', 'потери', 'лечение'],
    summary: [
      'Men fallen in the last 24 hours come back for silver at the surgeon in any port.',
      'Павшие за последние сутки возвращаются за серебро у лекаря в любом порту.',
    ],
    slides: [
      {
        img: img('army-healer', 1),
        text: [
          'After a won boarding a third of the fallen stand up by themselves (more with First Aid and artifacts, up to two thirds). The rest wait for the surgeon.',
          'После выигранного абордажа треть павших встаёт сама (с «Первой помощью» и артефактами — больше, до двух третей). Остальные ждут лекаря.',
        ],
        show: { open: 'port:army' },
      },
      {
        img: img('army-healer', 2),
        text: [
          'Port → «Army» → «Surgeon» → «Raise the fallen». It works at a floating waystation too; at sea within 2 km of either it costs a quarter more.',
          'Порт → «Армия» → «Лекарь» → «Воскресить павших». Так же — в плавучем порту; в море в 2 км от них — на четверть дороже.',
        ],
      },
      {
        img: img('army-healer', 3),
        text: [
          'The list shows who fell and the price; «Raise all» brings everyone back. The fallen wait 24 hours (and 20 battles). Shop creatures come back only for doubloons, at half price.',
          'В списке — кто пал и цена; «Воскресить всех» возвращает всех. Павшие ждут сутки (и 20 боёв). Существа из лавки возвращаются только за дублоны, за полцены.',
        ],
      },
    ],
    related: ['army-gift', 'faq-resurrect'],
    window: 'port:army',
  },
  {
    id: 'army-berths',
    section: 'army',
    title: ['Berths: keeping several ships', 'Причал: несколько кораблей'],
    tags: ['berths', 'ships', 'swap', 'keep', 'buy', 'причал', 'пересесть', 'корабли', 'стоянка', 'оставить старый'],
    summary: [
      '3 berths are free besides the ship you sail; each more costs 300 doubloons, up to 10. Swapping takes 2 minutes.',
      'Три места на причале бесплатно, кроме корабля под вами; каждое следующее — 300 дублонов, до десяти. Пересесть — 2 минуты.',
    ],
    slides: [
      {
        img: img('army-berths', 1),
        text: [
          'Port → «Berths»: «Berths N/3», the ship under you and the ships you keep. Each keeps its upgrades, guns, gear and level.',
          'Порт → «Причал»: «Причал N/3», корабль под вами и корабли на стоянке. Каждый хранит улучшения, пушки, снаряжение и уровень.',
        ],
        show: { open: 'port:berths' },
      },
      {
        img: img('army-berths', 2),
        text: [
          'Buying a new hull at the shipyard asks: «Trade in (hand the old over)» or «Buy and keep the old one at the berth».',
          'При покупке нового корпуса на верфи игра спросит: «Обменять (сдать старый)» или «Купить и оставить старый на причале».',
        ],
        show: { open: 'port:shipyard' },
      },
      {
        img: img('army-berths', 3),
        text: [
          'To change ships press «Board her» on a kept ship — in any port with a shipyard. Your army and hold move with you (if the hold fits).',
          'Чтобы сменить корабль, нажмите «Пересесть» у корабля на причале — в любом порту с верфью. Армия и трюм переходят с вами (если трюм вмещает).',
        ],
      },
      {
        img: img('army-berths', 4),
        text: [
          'More room: «+1 berth · 300» doubloons each, up to ten in all.',
          'Больше мест: «+1 место · 300» дублонов за каждое, всего до десяти.',
        ],
      },
      {
        img: img('army-berths', 5),
        text: [
          'The ship sails to you from her last mooring: «Coming to you 1:58». Stay in port — leaving cancels the call.',
          'Корабль плывёт к вам с прошлой стоянки: «Плывёт к вам 1:58». Оставайтесь в порту — выход в море отменит вызов.',
        ],
      },
    ],
    related: ['faq-berths', 'faq-big-ships'],
    window: 'port:berths',
  },
  {
    id: 'army-escorts',
    section: 'army',
    title: ['Convoy and hired guards', 'Конвой и наёмная охрана'],
    tags: ['escort', 'convoy', 'guards', 'fleet', 'конвой', 'сопровождение', 'охрана', 'нанять в охрану', 'командование'],
    summary: [
      'Convoy ships are hired at the harbour master once you command; merchants at sea can be hired as guards for a while.',
      'Корабли конвоя нанимают у начальника порта, когда вы командор; торговцев в море можно нанять в охрану на время.',
    ],
    slides: [
      {
        img: img('army-escorts', 1),
        text: [
          'Port → «Harbour» → «Convoy (N/M)»: a cutter, a brig or a brigantine sail with you in formation and fight at your side. Upkeep is paid by the hour at sea.',
          'Порт → «Гавань» → «Конвой (N/M)»: тендер, бриг или бригантина идут с вами строем и сражаются бок о бок. Содержание платится за каждый час в море.',
        ],
        show: { open: 'port:harbour' },
      },
      {
        img: img('army-escorts', 2),
        text: [
          'Convoy captains obey only a commander: ten points in the «Command» tree open the first berth, the Escort Captain talent and the Admiral\'s Pennant one more each (up to 3).',
          'Капитаны конвоя подчиняются лишь командору: десять очков в ветви «Командование» открывают первое место, талант «Капитан эскорта» и «Адмиральский вымпел» — ещё по одному (до 3).',
        ],
        show: { open: 'talents' },
      },
      {
        img: img('army-escorts', 3),
        text: [
          'In port the shipyard patches the convoy with your ship; at sea their carpenters mend them slowly out of battle. One that falls behind speeds up and catches the formation. A merchant of your level can also be hailed — «Hire as guard» for 10–20 minutes.',
          'В порту верфь латает конвой вместе с вашим кораблём, а в море вне боя их плотники понемногу чинятся сами. Отставший корабль ускоряется и догоняет строй. Ещё торговца вашего уровня можно окликнуть — «Нанять в охрану» на 10–20 минут.',
        ],
        show: { open: 'port:shipyard' },
      },
    ],
    related: ['army-berths'],
    window: 'port:harbour',
  },
];
