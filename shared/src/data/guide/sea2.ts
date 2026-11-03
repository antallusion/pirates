// «Лоцманская книга», the sea (part two: the ship by hand). The engine's two samples sit in sea.ts; these are merged
// after them (the merge: `[...sea.ARTICLES, ...sea2.ARTICLES]`). Pictures: tools/guide/shots-voyage.mjs.
import type { GuideArticle } from './types.ts';

export const ARTICLES: GuideArticle[] = [
  {
    id: 'sea-helm',
    section: 'sea',
    title: ['The wheel and the sails', 'Штурвал и паруса'],
    tags: ['wheel', 'helm', 'sails', 'speed', 'keys', 'штурвал', 'паруса', 'скорость', 'клавиши', 'управление'],
    summary: [
      'Drag the wheel the way to sail; «+» and «−» set the sail; the arc shows how much canvas is set; on a keyboard, W/A/S/D.',
      'Тяните штурвал, куда плыть; «+» и «−» ставят и убирают паруса; дуга показывает, сколько парусов поднято; на клавиатуре — W/A/S/D.',
    ],
    slides: [
      {
        img: 'sea-helm-1.webp',
        text: [
          'The wheel, bottom left. Press it and pull towards where you want to go: the ship turns that way. The farther from the middle, the more sail. Hold the very middle for half a second to furl everything; a quick double tap is a dash (once in 14 s).',
          'Штурвал — внизу слева. Нажмите и тяните в сторону, куда плыть: корабль повернёт туда. Чем дальше от центра, тем больше парусов. Удержите самый центр полсекунды — паруса убраны. Двойной тап — рывок, раз в 14 секунд.',
        ],
      },
      {
        img: 'sea-helm-2.webp',
        text: [
          '«+» and «−» beside the wheel add or take in one step of sail. There are four steps: a quarter, a half, three quarters and full; the pips between the buttons show which is set.',
          '«+» и «−» рядом со штурвалом прибавляют или убавляют паруса на одну ступень. Ступеней четыре: четверть, половина, три четверти и полные. Огоньки между кнопками показывают, сколько поднято сейчас.',
        ],
      },
      {
        img: 'sea-helm-3.webp',
        text: [
          'The gold arc round the wheel is the canvas actually drawing; a fainter part is what you ordered but the torn sails cannot give. Under it, the speed in knots. When the sails fall below a fifth the arc turns red-brown.',
          'Золотая дуга вокруг штурвала — паруса, которые сейчас тянут. Бледная часть — то, что вы заказали, но рваная парусина не даёт. Под дугой — скорость в узлах. Если парусов меньше пятой части, дуга становится красно-бурой.',
        ],
      },
      {
        img: 'sea-helm-4.webp',
        text: [
          'On a keyboard: W or ↑ adds sail, S or ↓ takes it in, A/D or ←/→ turn the rudder, a lone Shift is the dash, Space fires, Q and E fire a broadside, R repairs, M opens the chart. Every key can be changed: Settings → «More settings» → «Controls».',
          'На клавиатуре: W или ↑ — прибавить парусов, S или ↓ — убавить, A и D или ← и → — руль, одиночный Shift — рывок, Пробел — огонь, Q и E — залп бортом, R — ремонт, M — карта. Любую клавишу можно сменить: «Настройки» → «Подробнее» → «Управление».',
        ],
        show: { open: 'keys' },
      },
    ],
    related: ['sea-autosail', 'sea-wind', 'sea-storm'],
  },
  {
    id: 'sea-autosail',
    section: 'sea',
    title: ['A course by tap', 'Курс по тапу'],
    tags: ['autosail', 'course', 'tap', 'helmsman', 'автоплавание', 'курс', 'рулевой', 'тап', 'метка'],
    summary: [
      'Tap the open sea and the helmsman takes her there; the pill on top shows the way left and «stop». Any turn of the wheel takes the helm back.',
      'Тапните по открытой воде — рулевой поведёт корабль туда. Плашка наверху показывает, сколько осталось, и кнопку «стоп». Любой поворот штурвала возвращает руль вам.',
    ],
    slides: [
      {
        img: 'sea-autosail-1.webp',
        text: [
          'Tap the open water: a dashed course runs from the ship to the mark, and the pill «to the mark · 320 m» comes up on top. The helmsman keeps the sail you had (three quarters if you were nearly stopped) and stops close by the mark.',
          'Тапните по открытой воде: от корабля к метке ляжет пунктир курса, а наверху появится плашка «к метке · 320 м». Рулевой держит ваши паруса (если вы почти стояли — три четверти) и останавливается рядом с меткой.',
        ],
      },
      {
        img: 'sea-autosail-2.webp',
        text: [
          'Far away is easier on the chart. With a finger, a tap on the sea sets off at once; with a mouse, a click sets the mark, then press «Sail there». «Remove the mark» clears it. A long press on the minimap does the same.',
          'Далёкую цель удобнее ставить на карте. Пальцем: тап по морю — и сразу в путь. Мышью: щелчок ставит метку, затем нажмите «Плыть туда». «Снять отметку» убирает её. Долгое нажатие на мини-карту делает то же самое.',
        ],
        show: { open: 'map', point: '.map-wp-sail' },
      },
      {
        img: 'sea-autosail-3.webp',
        text: [
          'To take the helm back, turn the wheel (or A/D) or press «stop» on the pill. «+» and «−» only change the helmsman\'s sail; the course stays. A fight pauses the course: if you set it yourself, it carries on 5 s after the fight is over.',
          'Чтобы взять руль, поверните штурвал (или A/D) либо нажмите «стоп» на плашке. «+» и «−» меняют только паруса рулевого, курс остаётся. Бой ставит курс на паузу; если курс ставили вы сами, он продолжится через 5 секунд после боя.',
        ],
      },
    ],
    related: ['sea-chart', 'sea-helm'],
  },
  {
    id: 'sea-chart',
    section: 'sea',
    title: ['The chart, «Where am I» and the minimap', 'Карта, «Где я» и мини-карта'],
    tags: ['chart', 'map', 'minimap', 'layers', 'where', 'карта', 'мини-карта', 'слои', 'где я', 'метка'],
    window: 'map',
    summary: [
      'The minimap (top right) opens the chart. Its chips switch the layers; «Where am I» brings your ship back into view.',
      'Мини-карта справа вверху открывает большую карту. Кнопки слоёв включают и выключают значки; «Где я» возвращает взгляд к вашему кораблю.',
    ],
    slides: [
      {
        img: 'sea-chart-1.webp',
        text: [
          'The chart of the known sea. The chips on top are layers: «Ports», «Goals», «Lairs», «Treasure», «All», «Shipyards». Tap one to show or hide it; the choice is remembered. «All» also draws the currents.',
          'Карта известного моря. Кнопки наверху — слои: «Порты», «Цели», «Логова», «Сокровища», «Всё», «Верфи». Тап включает или прячет слой, выбор запоминается. Слой «Всё» рисует ещё и течения.',
        ],
        show: { open: 'map', point: '[data-mlayer]' },
      },
      {
        img: 'sea-chart-2.webp',
        text: [
          '«Where am I» centres the chart on your ship, zooms in and makes your mark pulse for a moment. Lost after scrolling far? One tap.',
          '«Где я» ставит ваш корабль в центр карты, приближает и на миг заставляет вашу отметку мигать. Улистали далеко — один тап, и вы снова видите себя.',
        ],
        show: { open: 'map', point: '[data-mwhere]' },
      },
      {
        img: 'sea-chart-3.webp',
        text: [
          'The minimap shows 4.5 km around the ship. A tap opens the big chart; a long press sets a mark and sends the helmsman to it. The arrow on its rim is the wind.',
          'Мини-карта показывает 4,5 км вокруг корабля. Тап открывает большую карту, долгое нажатие ставит метку и отправляет туда рулевого. Стрелка на её ободе — ветер.',
        ],
      },
    ],
    related: ['sea-autosail', 'sea-wind', 'travel-home'],
  },
  {
    id: 'sea-wind',
    section: 'sea',
    title: ['Wind and currents', 'Ветер и течения'],
    tags: ['wind', 'current', 'speed', 'ветер', 'течение', 'скорость', 'фордевинд', 'бейдевинд'],
    summary: [
      'With the wind behind, up to +45 % speed; into the wind, slower, and dead into it you barely move. Currents carry the ship on their own.',
      'С ветром в корму — до +45 % скорости, против ветра — медленнее, а прямо в лоб почти не идёте. Течения несут корабль сами.',
    ],
    slides: [
      {
        img: 'sea-wind-1.webp',
        text: [
          'The arrow on the minimap\'s rim is the wind. Green: it helps your course. Red: it is against you. Blue: it blows across your beam.',
          'Стрелка на ободе мини-карты — ветер. Зелёная — он помогает вашему курсу. Красная — дует навстречу. Синяя — бьёт в борт.',
        ],
      },
      {
        img: 'sea-wind-2.webp',
        text: [
          'The wind behind adds up to +45 % to the speed, a head wind takes up to a fifth off. Every rig has a "dead" angle into the wind: square sails 65°, fore-and-aft 42°, mixed 52°. Turn off the wind a little and the knots come back.',
          'Попутный ветер даёт до +45 % к скорости, встречный отнимает до пятой части. У каждого типа парусов есть «мёртвый» угол к ветру: прямые паруса — 65°, косые — 42°, смешанные — 52°. Отверните чуть в сторону — и узлы вернутся.',
        ],
      },
      {
        img: 'sea-wind-3.webp',
        text: [
          'Currents are the pale lines with chevrons on the chart (layer «All»). They run at 3–4.6 m/s and carry the ship whether her sails are up or not: ride them for free speed, and steer across them carefully.',
          'Течения — бледные линии со стрелками на карте (слой «Всё»). Они идут со скоростью 3–4,6 м/с и несут корабль, подняты паруса или нет. Ловите их ради даровой скорости, а поперёк держите курс внимательнее.',
        ],
        show: { open: 'map', point: '[data-mlayer="all"]' },
      },
    ],
    related: ['sea-helm', 'sea-storm', 'sea-chart'],
  },
  {
    id: 'sea-storm',
    section: 'sea',
    title: ['Storms and the jury sail', 'Шторм и аварийный парус'],
    tags: ['storm', 'weather', 'sails', 'jury', 'шторм', 'погода', 'паруса', 'аварийный парус', 'рифы'],
    firstTime: 'storm',
    summary: [
      'In a storm, never sail with full canvas: it tears. Three quarters is safe. With the sails gone and no sailcloth, raise the jury sail.',
      'В шторм не идите под полными парусами — порвёт. Три четверти безопасны. Если паруса сорваны, а парусины нет, ставьте аварийный парус.',
    ],
    slides: [
      {
        img: 'sea-storm-1.webp',
        text: [
          'The toast «Storm! Reef the sails or lose them.» means the storm is on you. A storm also shortens the lookouts\' sight; a black storm takes 15 off the crew\'s morale.',
          'Сообщение «Шторм! Рифьте паруса, или лишитесь их.» — шторм уже над вами. В шторм впередсмотрящие видят хуже, а чёрный шторм ещё и роняет боевой дух команды на 15.',
        ],
      },
      {
        img: 'sea-storm-2.webp',
        text: [
          'Take one step off with «−»: under full sail the storm tears your canvas every moment, at three quarters it does not. The helmsman on a course reefs to three quarters by himself. Weather it out and you get experience and flotsam nearby.',
          'Уберите одну ступень кнопкой «−»: под полными парусами шторм рвёт парусину каждую секунду, под тремя четвертями — нет. Рулевой на курсе сам рифит до трёх четвертей. Переждали шторм — получите опыт, а рядом всплывут обломки с добычей.',
        ],
      },
      {
        img: 'sea-storm-3.webp',
        text: [
          'Sails below a fifth and no sailcloth in the hold? Press «Jury sail». The crew rig it for free, up to a quarter of the canvas, in a minute. It pauses under fire and when a fire is aboard.',
          'Парусов меньше пятой части, а парусины в трюме нет? Нажмите «Аварийный парус». Команда поставит его бесплатно, до четверти парусов, за минуту. Под обстрелом и при пожаре работа встаёт.',
        ],
      },
      {
        img: 'sea-storm-4.webp',
        text: [
          'The sails bar in the corner grows as the crew work. Even torn sails keep at least 40 % of the way. Stuck dead in the water? «Scuttle» sinks her and brings you back to port.',
          'Полоска парусов в углу растёт, пока команда работает. Даже с рваными парусами корабль сохраняет не меньше 40 % хода. Совсем встали? Кнопка «Затопить» пустит корабль ко дну и вернёт вас в порт.',
        ],
      },
    ],
    related: ['sea-helm', 'sea-repair', 'sea-stores'],
  },
  {
    id: 'sea-hold',
    section: 'sea',
    title: ['The hold and overload', 'Трюм и перегруз'],
    tags: ['hold', 'cargo', 'overload', 'trade', 'трюм', 'груз', 'перегруз', 'товары', 'скорость'],
    firstTime: 'overload',
    window: 'port:market',
    summary: [
      'Trade goods over half the hold (three quarters on a trader\'s hull) — overload, −20 % speed. Over the brim — −35 %. Ship\'s stores do not count.',
      'Товары больше половины трюма (на торговом корпусе — трёх четвертей) — перегруз, скорость −20 %. Трюм забит доверху — −35 %. Судовые припасы не считаются.',
    ],
    slides: [
      {
        img: 'sea-hold-1.webp',
        text: [
          'The fourth bar under the portrait is the hold. The tick on it is the overload line: half the hold, or three quarters on trade and hauler hulls. The bar turns amber as you come near.',
          'Четвёртая полоска под портретом — трюм. Засечка на ней — черта перегруза: половина трюма или три четверти на торговых и грузовых корпусах. Подходите к черте — полоска желтеет.',
        ],
      },
      {
        img: 'sea-hold-2.webp',
        text: [
          'Past the line the bar reads «OVERLOAD» and the ship loses 20 % of her speed. Only trade goods count; provisions, sailcloth and planks never do. Over 100 % of the hold, everything counted, it is −35 %.',
          'За чертой на полоске загорается «ПЕРЕГРУЗ», и корабль теряет 20 % скорости. Считаются только товары; провизия, парусина и доски — никогда. Если трюм забит больше чем на 100 % со всем вместе — −35 %.',
        ],
      },
      {
        img: 'sea-hold-3.webp',
        text: [
          'The effect «Overloaded» shows by the portrait with its penalty. Tap it for the card: what fills the hold and how much speed it costs.',
          'Рядом с портретом появляется значок «Перегруз» со штрафом. Тап по нему открывает карточку: чем занят трюм и сколько скорости это стоит.',
        ],
      },
      {
        img: 'sea-hold-4.webp',
        text: [
          'The cure is simple: sell in port («Sell» on the market) or put goods in the warehouse. An overloaded hold also blocks the neutral flag and the passage between hubs.',
          'Лекарство простое: продайте в порту («Продать» на рынке) или сложите товар на склад. Перегруженный трюм к тому же не даёт поднять нейтральный флаг и взять переход между гаванями.',
        ],
        show: { open: 'port:market' },
      },
    ],
    related: ['trade-volume', 'trade-warehouse', 'flags-three', 'travel-rules'],
  },
  {
    id: 'sea-stores',
    section: 'sea',
    title: ['Ship\'s stores', 'Судовые припасы'],
    tags: ['provisions', 'food', 'sailcloth', 'planks', 'stores', 'провизия', 'еда', 'парусина', 'доски', 'припасы'],
    window: 'port:market',
    summary: [
      'Provisions feed the crew, sailcloth mends the sails, planks mend the hull. They are light, every harbour sells them, and they cannot be sold.',
      'Провизия кормит команду, парусина чинит паруса, доски — корпус. Они лёгкие, продаются в любой гавани и не продаются обратно.',
    ],
    slides: [
      {
        img: 'sea-stores-1.webp',
        text: [
          'Provisions, sailcloth and «Planks & Pitch» stand first on every market, marked as ship\'s stores. Every harbour has them without limit. They are light: 0.05 m³ a unit (planks 0.075).',
          'Провизия, парусина и «Доски и смола» стоят первыми на любом рынке с пометкой судового припаса. В каждой гавани их сколько угодно. Они лёгкие: 0,05 м³ за штуку, доски — 0,075.',
        ],
        show: { open: 'port:market' },
      },
      {
        img: 'sea-stores-2.webp',
        text: [
          'Instead of «Sell» they show a greyed «Store»: stores are kept for the voyage, not for trade. In return they never count towards overload, the neutral flag\'s free hold or the passage\'s limit.',
          'Вместо «Продать» у них серая кнопка «Припас»: припасы — запас для плавания, а не товар. Зато они не идут в перегруз, в свободный трюм нейтрального флага и в предел для перехода.',
        ],
      },
      {
        img: 'sea-stores-3.webp',
        text: [
          'Cast off short of something, and a window lists what is missing for a normal voyage: food, repairs, shot, hands — with prices. Buy item by item, «Buy all», or «Sail as she is».',
          'Если выходите в море, чего-то не докупив, появится окно: чего не хватает для нормального плавания — еды, ремонта, ядер, людей — и почём. Купите по строчке, нажмите «Докупить всё» или отплывайте как есть.',
        ],
      },
      {
        img: 'sea-stores-4.webp',
        text: [
          'The provisions row shows how much is aboard. At sea the crew eat about half a unit a minute per 40 hands. When the last biscuit is gone, morale slides towards 25. One plank mends 40 points of hull, one bolt of sailcloth 20 points of sails.',
          'В строке провизии видно, сколько её на борту. В море команда съедает около половины единицы провизии в минуту на каждые 40 человек. Кончилась еда — боевой дух сползает к 25. Одна доска чинит 40 единиц корпуса, один рулон парусины — 20 единиц парусов.',
        ],
      },
    ],
    related: ['sea-repair', 'sea-crew', 'sea-hold'],
  },
  {
    id: 'sea-repair',
    section: 'sea',
    title: ['Repairs', 'Ремонт'],
    tags: ['repair', 'hull', 'sails', 'shipyard', 'ремонт', 'корпус', 'паруса', 'верфь', 'доски'],
    summary: [
      'At sea, out of a fight: «Repair» (R) — the crew mend with planks and sailcloth. In port the yard mends everything for silver.',
      'В море вне боя — «Ремонт» (R): команда чинит досками и парусиной. В порту верфь чинит всё за серебро.',
    ],
    slides: [
      {
        img: 'sea-repair-1.webp',
        text: [
          'The bars under the portrait: red is the hull, blue the crew, white the sails. When the hull or the sails drop, it is time to mend.',
          'Полоски под портретом: красная — корпус, синяя — команда, белая — паруса. Корпус или паруса просели — пора чиниться.',
        ],
      },
      {
        img: 'sea-repair-2.webp',
        text: [
          '«Repair» appears at the bottom when nothing is shooting at you (or press R). The crew mend as fast as their numbers allow, using planks for the hull and sailcloth for the sails; «Stop repair» stops. Under fire the work goes ten times slower.',
          '«Ремонт» появляется внизу, когда по вам никто не стреляет (или нажмите R). Команда чинит тем быстрее, чем больше людей, и тратит доски на корпус, а парусину на паруса. «Хватит чинить» останавливает работу. Под обстрелом дело идёт в десять раз медленнее.',
        ],
      },
      {
        img: 'sea-repair-3.webp',
        text: [
          'In port, «Shipyard» → «Repair» mends the hull, sails, rudder, guns and mast at once. Small ships pay less. Short of silver? The yard mends what you can pay for. A whole ship shows «Sound» on the button.',
          'В порту «Верфь» → «Починить» чинит сразу корпус, паруса, руль, пушки и мачту. Малые корабли платят меньше. Не хватает серебра — верфь починит на сколько хватит. Если чинить нечего, на кнопке написано «Цел».',
        ],
        show: { open: 'port:shipyard', point: '[data-act="repair"]' },
      },
    ],
    related: ['sea-stores', 'sea-storm'],
  },
  {
    id: 'sea-crew',
    section: 'sea',
    title: ['The crew and morale', 'Команда и боевой дух'],
    tags: ['crew', 'morale', 'mutiny', 'rum', 'команда', 'боевой дух', 'бунт', 'ром', 'матросы'],
    window: 'crew',
    summary: [
      'Morale tends to 70. Hunger, curses and black storms lower it, rum raises it. High spirits load faster and board harder; low ones slow everything.',
      'Боевой дух стремится к 70. Голод, проклятия и чёрный шторм его роняют, ром поднимает. Бодрая команда быстрее заряжает и лучше идёт на абордаж, упавшая — всё делает медленнее.',
    ],
    slides: [
      {
        img: 'sea-crew-1.webp',
        text: [
          'The crew window («The Company») shows the hands aboard, your army\'s stacks and «Morale». It drifts towards 70: +8 with rum in the hold, down to 25 with no food, lower still with cursed relics and on long voyages.',
          'Окно «Команда» показывает людей на борту, отряды армии и «Дух» — боевой дух. Он плывёт к 70: с ромом в трюме +8, без еды — к 25, а проклятые реликвии и долгое плавание опускают его ещё ниже.',
        ],
        show: { open: 'crew' },
      },
      {
        img: 'sea-crew-2.webp',
        text: [
          '80 and up — «inspired»: reload −10 %, boarding +10 %. Below 50 the guns reload slower and repairs go worse; below 30 the icon «Low morale» appears; below 15 the crew refuse to board. Low morale and low loyalty together lead to mutiny.',
          'От 80 — «воодушевлены»: перезарядка −10 %, абордаж +10 %. Ниже 50 пушки заряжаются медленнее, ремонт идёт хуже; ниже 30 появляется значок «Низкий боевой дух»; ниже 15 команда отказывается идти на абордаж. Низкий дух вместе с низкой верностью ведёт к бунту.',
        ],
      },
      {
        img: 'sea-crew-3.webp',
        text: [
          'Hands are hired in the «Tavern». Keep the crew above the ship\'s minimum: fewer hands mean slower repairs and slower guns. In panic (morale 15–29) some sailors desert when you dock.',
          'Людей нанимают в «Таверне». Держите команду выше минимума корабля: меньше людей — медленнее ремонт и пушки. В панике (дух 15–29) часть матросов сбегает при заходе в порт.',
        ],
        show: { open: 'port:tavern' },
      },
    ],
    related: ['sea-stores', 'sea-fx', 'combat-hexrules'],
  },
  {
    id: 'sea-exit',
    section: 'sea',
    title: ['Leaving the game', 'Выход из игры'],
    tags: ['exit', 'logout', 'quit', 'выход', 'выйти', 'отключение'],
    summary: [
      'In port you leave at once. At sea press «Exit» in the «⋯» tray: 30 s, and any order cancels it. A dropped connection leaves the ship at sea for 2 minutes.',
      'В порту выходите сразу. В море нажмите «Выход» в меню «⋯»: 30 секунд, и любой приказ это отменит. При обрыве связи корабль остаётся в море ещё на 2 минуты.',
    ],
    slides: [
      {
        img: 'sea-exit-1.webp',
        text: [
          'Open the «⋯» tray by the portrait and press «Exit». In port that is all: you are out at once.',
          'Откройте меню «⋯» у портрета и нажмите «Выход». В порту на этом всё: вы выходите сразу.',
        ],
      },
      {
        img: 'sea-exit-2.webp',
        text: [
          'At sea the banner «EXIT IN 0:30» counts down. Any order or a shot at you cancels it, and you cannot leave in the middle of a fight. «Cancel» stops it by hand.',
          'В море наверху идёт отсчёт «ВЫХОД ЧЕРЕЗ 0:30». Любой приказ или выстрел по вам его отменяет, а посреди боя выйти нельзя. «Отмена» — остановить вручную.',
        ],
      },
      {
        img: 'sea-exit-3.webp',
        text: [
          'Simply closing the game is not safe: the ship stays at sea for 2 minutes with your last order still running, and anyone can attack her. Leave in port, or through «Exit»: then the screen «You have left» offers «Return».',
          'Просто закрыть игру небезопасно: корабль ещё 2 минуты остаётся в море и выполняет последний приказ, и напасть на него может кто угодно. Выходите в порту или через «Выход» — тогда появится экран «Вы вышли» с кнопкой «Вернуться».',
        ],
      },
    ],
    related: ['sea-fx'],
  },
  {
    id: 'sea-fx',
    section: 'sea',
    title: ['Buffs and debuffs', 'Бафы и дебафы'],
    tags: ['effects', 'buffs', 'debuffs', 'timer', 'эффекты', 'бафы', 'дебафы', 'таймер', 'значки'],
    summary: [
      'The icons by the portrait are everything working on you now, the bad ones first, with the time left as a ring. Tap one for its card.',
      'Значки у портрета — всё, что сейчас действует на вас: сначала плохое, оставшееся время — кольцом. Тап открывает карточку.',
    ],
    slides: [
      {
        img: 'sea-fx-1.webp',
        text: [
          'Red rims are troubles: «Rudder damaged», «Canvas torn», «Fire aboard», «Leaks», «Overloaded», «Low morale». Green rims help: «High spirits», «Under protection», «Dash». The ring is the time left, the number in the corner the strength.',
          'Красная кайма — беды: «Руль повреждён», «Паруса порваны», «Пожар», «Течи», «Перегруз», «Низкий боевой дух». Зелёная — подмога: «Высокий боевой дух», «Под защитой», «Рывок». Кольцо — оставшееся время, число в углу — сила.',
        ],
      },
      {
        img: 'sea-fx-2.webp',
        text: [
          'A tap opens the effect\'s card: what it is, how long it lasts and what exactly it changes — speed, reload, damage.',
          'Тап открывает карточку эффекта: что это, сколько ещё продлится и что именно меняет — скорость, перезарядку, урон.',
        ],
      },
      {
        img: 'sea-fx-3.webp',
        text: [
          'A phone shows six icons, a wide screen eight; the rest hide behind «+3». Tap it for «Effects on you», the whole list with timers.',
          'На телефоне видно шесть значков, на широком экране — восемь, остальные прячутся за «+3». Тап по нему открывает «Эффекты на вас» — весь список с таймерами.',
        ],
      },
    ],
    related: ['sea-crew', 'sea-hold', 'sea-repair'],
  },
];
