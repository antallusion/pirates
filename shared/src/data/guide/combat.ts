// «Лоцманская книга», sea combat and boarding. Pictures: tools/guide/shots-voyage.mjs.
import type { GuideArticle } from './types.ts';

export const ARTICLES: GuideArticle[] = [
  {
    id: 'combat-ring',
    section: 'combat',
    title: ['The ring of actions', 'Кольцо действий'],
    tags: ['ring', 'target', 'tap', 'details', 'кольцо', 'цель', 'тап', 'подробнее', 'карточка'],
    summary: [
      'Tap a ship: a ring of what you can do with her comes up. «Attack», «Board» within 100 m, «Talk»; ⓘ opens her card.',
      'Тапните по кораблю — вокруг него появится кольцо действий: «Атаковать», в пределах 100 м «На абордаж», «Поговорить»; ⓘ открывает её карточку.',
    ],
    slides: [
      {
        img: 'combat-ring-1.webp',
        text: [
          'Tap a ship (on a desk, hover over her) and the ring opens round her; tap again on a choice. «Attack» is always there; «Board» appears within 100 m; «Talk» for every ship but the creatures of the deep. A greyed choice is forbidden by your flag: tap it to see why.',
          'Тапните по кораблю (на компьютере — наведите мышь), и вокруг него раскроется кольцо; второй тап — выбор. «Атаковать» есть всегда, «На абордаж» — в пределах 100 м, «Поговорить» — у всех, кроме тварей глубин. Серый пункт запрещён вашим флагом: тапните — скажут почему.',
        ],
      },
      {
        img: 'combat-ring-2.webp',
        text: [
          'The small ⓘ «Details» beside the ring opens her card. Beasts, monsters, ghosts and bosses get a single big «Attack» — they cannot be talked to or boarded from the sea.',
          'Маленькая ⓘ «Подробнее» у кольца открывает её карточку. У зверей, чудовищ, призраков и боссов кольца нет — одна большая кнопка «Атаковать»: с ними не поговоришь и абордажем с моря не возьмёшь.',
        ],
      },
      {
        img: 'combat-ring-3.webp',
        text: [
          'The card: her captain, class, ship level, flag and role, guns a side, top speed, hold, the distance — and the two numbers that matter: «Against you» and how many of your broadsides it takes to sink her.',
          'Карточка: капитан, класс, уровень корабля, флаг и роль, пушки на борт, наибольшая скорость, трюм, расстояние — и два главных числа: «Против вас» и сколько ваших залпов нужно, чтобы её потопить.',
        ],
      },
      {
        img: 'combat-ring-4.webp',
        text: [
          'The bars are her hull, sails and crew right now; a beast shows only its body. The card refreshes twice a second, so you can watch the fight on it, and closes by itself if she is gone.',
          'Полоски — её корпус, паруса и команда прямо сейчас; у зверя только тело. Карточка обновляется дважды в секунду — по ней можно следить за боем, — и закрывается сама, если цель пропала.',
        ],
      },
      {
        img: 'combat-ring-5.webp',
        text: [
          'At the bottom of the card: «Target» (pin her), «Attack», «Sail to», «Inspect». The boarding odds show there too, once they have been reckoned.',
          'Внизу карточки — «Цель» (закрепить), «Атаковать», «Плыть», «Осмотреть». Там же появляется шанс абордажа, когда он посчитан.',
        ],
      },
    ],
    related: ['combat-attack', 'combat-boarding', 'combat-beasts'],
  },
  {
    id: 'combat-attack',
    section: 'combat',
    title: ['«Attack», «Close in», «Stand off»', '«Атаковать», «Сближение», «На выстрел»'],
    tags: ['attack', 'pursuit', 'broadside', 'distance', 'атаковать', 'погоня', 'залп', 'дистанция', 'сближение', 'на выстрел'],
    summary: [
      '«Attack» puts the helmsman on her: he keeps gun range and turns your broadside to her. «Close in» goes for boarding, «Stand off» back to the guns, «Hold off» gives the wheel back.',
      '«Атаковать» — рулевой берёт цель: держит дистанцию выстрела и разворачивает к ней борт. «Сближение» — идти на абордаж, «На выстрел» — снова на пушки, «Отставить» — штурвал вам.',
    ],
    slides: [
      {
        img: 'combat-attack-1.webp',
        text: [
          'In the ring tap «Attack». The helmsman takes the wheel: he holds her at about 0.6 of your guns\' reach (90–140 m) and lays your broadside to her; the gunners fire when she is in reach. No grapples are thrown on their own.',
          'В кольце нажмите «Атаковать». Штурвал берёт рулевой: держит цель примерно на 0,6 дальности ваших пушек (90–140 м) и разворачивает к ней борт; канониры стреляют, как только она в досягаемости. Кошки сами не летят.',
        ],
      },
      {
        img: 'combat-attack-2.webp',
        text: [
          'While you hunt, the bar at the bottom changes: «Close in» and «Hold off». The helmsman breaks off by himself if she is lost, faster than you, sunk — or your hull is under a quarter.',
          'Пока идёт погоня, внизу другие кнопки: «Сближение» и «Отставить». Рулевой бросит погоню сам, если цель потеряна, она быстрее, потоплена — или ваш корпус ниже четверти.',
        ],
      },
      {
        img: 'combat-attack-3.webp',
        text: [
          '«Close in» brings you alongside for boarding; within 100 m «Board» comes up. The same button now reads «Stand off»: it opens the distance again, out of grapple reach, back to the guns. Beasts and monsters have no «Close in».',
          '«Сближение» ведёт борт о борт для абордажа; ближе 100 м появляется «На абордаж». Та же кнопка теперь называется «На выстрел»: снова разорвать дистанцию, подальше от кошек, и бить из пушек. У зверей и чудовищ «Сближения» нет.',
        ],
      },
      {
        img: 'combat-attack-4.webp',
        text: [
          '«Hold off» ends the pursuit and gives you the wheel. Turning the wheel yourself does the same.',
          '«Отставить» прекращает погоню и возвращает штурвал вам. Повернуть штурвал самому — то же самое.',
        ],
      },
    ],
    related: ['combat-ammo', 'combat-range', 'combat-boarding'],
  },
  {
    id: 'combat-ammo',
    section: 'combat',
    title: ['Round, chain and grape', 'Ядра, книппели, картечь'],
    tags: ['ammo', 'shot', 'chain', 'grape', 'reload', 'снаряды', 'ядра', 'книппели', 'картечь', 'перезарядка'],
    summary: [
      'Round shot breaks the hull, chain tears the sails (she cannot run), grape kills the crew (before boarding). Tap the shot button to change it.',
      'Ядра ломают корпус, книппели рвут паруса (не убежит), картечь косит команду (перед абордажем). Тап по кнопке снаряда — сменить.',
    ],
    slides: [
      {
        img: 'combat-ammo-1.webp',
        text: [
          'The shot button beside «Fire» shows what is loaded and how many are aboard. A tap takes the next kind; keys 1–5 pick round, chain, grape, fire and heavy shot.',
          'Кнопка снаряда рядом с «Огонь» показывает, чем заряжено и сколько на борту. Тап — следующий вид; клавиши 1–5 — ядра, книппели, картечь, зажигательные и тяжёлые.',
        ],
      },
      {
        img: 'combat-ammo-2.webp',
        text: [
          'Hold it for the wheel «Shots» with every kind, the abilities and the talents. Round shot: full damage to the hull, longest reach. Chain: a quarter to the hull but 45 times more to the sails — a fast ship stops running. Grape: little to the hull, the most crew killed, but only half the reach.',
          'Удержите её — откроется колесо «Снаряды» со всеми видами, умениями и талантами. Ядра — полный урон корпусу и наибольшая дальность. Книппели — четверть урона корпусу, зато в 45 раз больше парусам: быстрая цель перестаёт убегать. Картечь — корпусу почти ничего, но больше всех убитых, а дальность вдвое меньше.',
        ],
      },
      {
        img: 'combat-ammo-3.webp',
        text: [
          '«Fire» fills up as the guns reload. Changing the shot costs part of a reload, so choose before the volley. Hold «Fire» for 1.2 s for a charged broadside: let go near the end of the charge for a tighter, harder volley.',
          '«Огонь» наполняется по мере перезарядки. Смена снаряда съедает часть перезарядки — выбирайте до залпа. Удержите «Огонь» 1,2 секунды — заряженный залп: отпустите ближе к концу заряда, и он ляжет кучнее и сильнее.',
        ],
      },
    ],
    related: ['combat-attack', 'combat-range'],
  },
  {
    id: 'combat-range',
    section: 'combat',
    title: ['Ranges', 'Дальность'],
    tags: ['range', 'reach', 'distance', 'volleys', 'дальность', 'дистанция', 'залпы', 'пушки'],
    summary: [
      'Every gun reaches 100 m farther than its base: a long nine fires round shot to 305 m. Chain reaches less, grape least.',
      'Любая пушка бьёт на 100 м дальше своей основы: длинная девятифунтовка шлёт ядро на 305 м. Книппели летят ближе, картечь — ближе всех.',
    ],
    slides: [
      {
        img: 'combat-range-1.webp',
        text: [
          'The target line on top shows her name, the distance and «≈ 4 volleys» — how many of your broadsides she will take — and, close enough, the boarding odds.',
          'Строка цели наверху показывает имя, расстояние и «≈ 4 залпа» — сколько ваших залпов она выдержит, — а вблизи ещё и шанс абордажа.',
        ],
      },
      {
        img: 'combat-range-2.webp',
        text: [
          'Reach = the gun\'s base × the ship\'s range × the shot\'s range + 100 m. A long 9-pounder: 305 m with round, about 248 with chain, 213 with grape. A 24-pound carronade: 200 m. Mortars throw to 550 m.',
          'Дальность = основа пушки × дальность корабля × дальность снаряда + 100 м. Длинная девятифунтовка: 305 м ядрами, около 248 книппелями, 213 картечью. Двадцатичетырёхфунтовая карронада — 200 м. Мортира — до 550 м.',
        ],
      },
      {
        img: 'combat-range-3.webp',
        text: [
          'Far shots still lose up to 30 % of their damage towards the edge of the reach. Pirate ships open fire from 250 m but like to fight at 105–140 m.',
          'Дальний выстрел по-прежнему теряет до 30 % урона к краю дальности. Пиратские корабли открывают огонь с 250 м, а дерутся охотнее на 105–140 м.',
        ],
      },
    ],
    related: ['combat-ammo', 'combat-attack'],
  },
  {
    id: 'combat-boarding',
    section: 'combat',
    title: ['Boarding', 'Абордаж'],
    tags: ['boarding', 'grapple', 'odds', 'risk', 'абордаж', 'кошки', 'шанс', 'риск'],
    firstTime: 'first-boarding',
    summary: [
      'Within 100 m (hull to hull) «Board» throws the grapples: 2–4 s, and the ships are hauled together. Then the battle on the hexes.',
      'Ближе 100 м (борт к борту) «На абордаж» бросает кошки: 2–4 секунды — и корабли стянуты. Дальше — бой на гексах.',
    ],
    slides: [
      {
        img: 'combat-boarding-1.webp',
        text: [
          '«Board» appears in the ring when she is within 100 m, hull edge to hull edge, from any side — and only if your flag allows the attack.',
          '«На абордаж» появляется в кольце, когда до неё меньше 100 м от борта до борта, с любой стороны — и только если флаг разрешает нападение.',
        ],
      },
      {
        img: 'combat-boarding-2.webp',
        text: [
          'Before you go, check the odds. The target line on top shows her hull and whether she is in reach; close by it adds «Boarding 62%» — your chance to win on deck (her card ⓘ has the same «Boarding odds»). Grape first is the classic way to raise them.',
          'Перед броском проверьте шансы. Строка цели наверху показывает её корпус и дальность, а вблизи — «Абордаж 62%», шанс выиграть бой на палубе (то же — «Шанс абордажа» в её карточке ⓘ). Картечь перед абордажем — проверенный способ его поднять.',
        ],
      },
      {
        img: 'combat-boarding-3.webp',
        text: [
          '«Grapples away: hauling her alongside». The haul takes 2–4 s, the lighter ship moves more and the other cannot sail off. If your odds are under 35 % or she is 2+ levels above you, the game asks first: «Risk it» or «Back off».',
          '«Кошки брошены: подтягиваем её к борту». Стяжка длится 2–4 секунды, лёгкий корабль сдвигается сильнее, а уплыть никто не может. Если шанс ниже 35 % или цель на 2 уровня и больше выше вас, игра спросит: «Рискнуть» или «Отступить».',
        ],
      },
    ],
    related: ['combat-hex', 'combat-ammo', 'flags-noboard'],
  },
  {
    id: 'combat-hex',
    section: 'combat',
    title: ['The boarding battle: the basics', 'Бой на гексах: основы'],
    tags: ['hex', 'battle', 'initiative', 'flank', 'cover', 'shooting', 'гексы', 'бой', 'инициатива', 'фланг', 'укрытие', 'стрелки'],
    summary: [
      'A turn-based fight on an 11×9 field, as in Heroes. Initiative sets the order; shots at up to 6 hexes do full damage; flank +15 %, rear +30 %; cover −25 %.',
      'Пошаговый бой на поле 11×9, как в «Героях». Порядок ходов задаёт инициатива; выстрел до 6 клеток — полный урон; удар с фланга +15 %, с тыла +30 %; укрытие −25 %.',
    ],
    slides: [
      {
        img: 'combat-hex-1.webp',
        text: [
          'The deck becomes a field of 11×9 hexes: your stacks on one side, hers on the other. First, 20 s to place your stacks; then each stack has 20 s for its move, and you have a chess clock for the whole fight.',
          'Палуба превращается в поле 11×9 клеток: ваши отряды с одной стороны, её — с другой. Сначала 20 секунд на расстановку, потом у каждого отряда 20 секунд на ход, а на весь бой — шахматные часы.',
        ],
      },
      {
        img: 'combat-hex-2.webp',
        text: [
          'The queue on top is the order of turns: higher initiative acts first, ties go to the dice. Tap a foe to strike: the stack walks up and hits.',
          'Очередь наверху — порядок ходов: у кого инициатива выше, тот ходит раньше, при равной решает жребий. Тапните по врагу, чтобы ударить: отряд подойдёт и ударит.',
        ],
      },
      {
        img: 'combat-hex-3.webp',
        text: [
          'Tap a foe: the preview shows the damage, how many fall and her answer, and «Attack» comes up at the bottom. From the side a blow does +15 %, from behind +30 % — walk round before you strike.',
          'Тапните по врагу: подсказка покажет урон, сколько падёт и её ответный удар, а внизу появится «Атаковать». С фланга удар сильнее на 15 %, с тыла — на 30 %: обойдите, прежде чем бить.',
        ],
      },
      {
        img: 'combat-hex-4.webp',
        text: [
          'Shooters hit with full damage up to 6 hexes, beyond that «long shot: half». A mast, barrel, crate, gun or barricade by the target or on the line of fire gives «in cover: −25 %». A shooter with a foe next to it hits at half.',
          'Стрелки бьют в полную силу до 6 клеток, дальше — «далеко: половина». Мачта, бочка, ящик, пушка или баррикада рядом с целью или на линии огня дают «в укрытии: −25 %». Стрелок, к которому подошёл враг, бьёт вполсилы.',
        ],
      },
    ],
    related: ['combat-hexrules', 'combat-auto', 'combat-boarding'],
  },
  {
    id: 'combat-hexrules',
    section: 'combat',
    title: ['Morale, luck and the twenty rounds', 'Мораль, удача и двадцать раундов'],
    tags: ['morale', 'luck', 'rounds', 'card', 'мораль', 'удача', 'раунды', 'карточка', 'атака', 'защита'],
    summary: [
      'Good morale may give a stack another turn, bad morale may freeze it; luck doubles a blow. After round 20 the side with more of its strength left wins.',
      'Высокая мораль может дать отряду лишний ход, низкая — сковать его; удача удваивает удар. После 20-го раунда побеждает сторона, у которой осталось больше сил.',
    ],
    slides: [
      {
        img: 'combat-hexrules-1.webp',
        text: [
          'The queue on top runs round after round. There are at most 20 rounds: then the deck goes to the side with the larger share of its starting strength left (in a siege, to the defenders).',
          'Очередь наверху идёт раунд за раундом. Раундов не больше 20: после этого палуба достаётся стороне, у которой осталась большая доля начальных сил (при осаде — защитникам).',
        ],
      },
      {
        img: 'combat-hexrules-2.webp',
        text: [
          'Morale and luck come from your crew\'s morale and your captain. Each point is a 4 % chance: good morale — an extra turn, bad — the stack freezes; luck — a double blow. Attack over Defence adds 5 % a point (up to +100 %), the other way takes 2.5 % (down to −50 %).',
          'Мораль и удача зависят от боевого духа команды и капитана. Каждое очко — 4 % шанса: высокая мораль — лишний ход, низкая — отряд замирает; удача — двойной удар. Атака выше Защиты даёт +5 % за очко (до +100 %), наоборот — −2,5 % (до −50 %).',
        ],
      },
      {
        img: 'combat-hexrules-3.webp',
        text: [
          'Long-press a stack (right click on a desk) for its card: men, Attack, Defence, damage, health, speed, initiative, shots and whether it strikes back, plus its special abilities and how far it threatens.',
          'Долгое нажатие на отряд (на компьютере — правый щелчок) открывает его карточку: люди, Атака, Защита, урон, здоровье, скорость, инициатива, выстрелы, ответный удар, а ещё особые умения и докуда он достаёт.',
        ],
      },
    ],
    related: ['combat-hex', 'combat-auto', 'sea-crew'],
  },
  {
    id: 'combat-auto',
    section: 'combat',
    title: ['Auto-battle and the order book', 'Автобой и книга приказов'],
    tags: ['auto', 'autobattle', 'quick', 'book', 'scroll', 'автобой', 'быстрый бой', 'книга', 'свиток', 'приказы'],
    summary: [
      '«Auto» lets the crew fight for you (one auto-battle scroll a battle); «Quick combat» is free against a clearly weaker ship. The book holds your orders.',
      '«Авто» — команда дерётся сама (один свиток автобоя за бой); «Быстрый бой» бесплатен против явно слабого корабля. В книге — ваши приказы.',
    ],
    slides: [
      {
        img: 'combat-auto-1.webp',
        text: [
          'The round «Auto» button on the left. While auto is on it reads «Take the helm» — tap it to fight by hand again.',
          'Круглая кнопка «Авто» слева. Пока автобой идёт, она называется «Взять штурвал» — тап, и снова воюете сами.',
        ],
      },
      {
        img: 'combat-auto-2.webp',
        text: [
          'Its wheel: «Auto to the end», «Quick combat», cutting the grapples or falling back, a ransom, and «Strike the colours». Auto spends one scroll a battle (packs in the shop); quick combat against a ship one and a half times weaker costs nothing.',
          'Её колесо: «Авто до конца», «Быстрый бой», «Рубить абордажные концы» или «Отступить», откуп и «Спустить флаг». Автобой тратит один свиток за бой (наборы — в лавке), быстрый бой против корабля в полтора раза слабее — бесплатно.',
        ],
      },
      {
        img: 'combat-auto-3.webp',
        text: [
          'The round book bottom right is the «Order book»: your officer\'s words and your path\'s orders, each with its cost. A gold dot on it means something is ready.',
          'Круглая книга справа внизу — «Книга приказов»: слово офицера и приказы вашего пути, у каждого своя цена. Золотая точка на ней — что-то готово.',
        ],
      },
    ],
    related: ['combat-hex', 'combat-hexrules'],
  },
  {
    id: 'combat-struck',
    section: 'combat',
    title: ['A pirate strikes her colours', 'Пират спускает флаг'],
    tags: ['surrender', 'struck', 'sink', 'spare', 'mercy', 'сдача', 'флаг', 'утопить', 'отпустить', 'пощада'],
    firstTime: 'struck-pirate',
    summary: [
      'A beaten pirate, patrol or hunter may ask for mercy. «Take all and sink her» — her purse and hold; «Take her crew and let her go» — 30 % of her crew and purse.',
      'Побитый пират, патруль или охотник может попросить пощады. «Забрать всё и затопить» — её кошелёк и трюм; «Забрать экипаж и отпустить» — 30 % команды и кошелька.',
    ],
    slides: [
      {
        img: 'combat-struck-1.webp',
        text: [
          '«The ship strikes her colours!» She gives up when her hull is under a quarter, her crew under 30 % or her morale broken, and you clearly out-gun her. Only pirates, patrols and hunters do; monsters, bosses and named captains never.',
          '«… спускает флаг!» Корабль сдаётся, когда его корпус ниже четверти, команда меньше 30 % или дух сломлен, а вы явно сильнее. Так поступают только пираты, патрули и охотники; чудовища, боссы и именные капитаны — никогда.',
        ],
      },
      {
        img: 'combat-struck-2.webp',
        text: [
          '«Take all and sink her»: her whole purse, her hold as far as yours takes it, 15 % of her survivors join you, and a wreck with timber and the rest floats up.',
          '«Забрать всё и затопить»: весь её кошелёк, трюм — сколько влезет в ваш, 15 % уцелевших переходят к вам, а на воде остаются обломки с досками и тем, что не поместилось.',
        ],
      },
      {
        img: 'combat-struck-3.webp',
        text: [
          '«Take her crew and let her go»: 30 % of her crew join, you take 30 % of her purse, and she sails away. Hands join only while you have free hammocks.',
          '«Забрать экипаж и отпустить»: 30 % её команды переходят к вам, вы берёте 30 % кошелька, и она уходит. Люди переходят, только пока есть свободные койки.',
        ],
      },
      {
        img: 'combat-struck-4.webp',
        text: [
          'The card shows how far she is; she will not wait long (75 s). Alongside your choice works at once; from farther the helmsman lays you alongside. «Later» hides the card; firing on her refuses the surrender and the fight goes on.',
          'На карточке — расстояние до неё; ждать она будет недолго (75 секунд). Борт о борт выбор срабатывает сразу, издалека рулевой сам подведёт корабль. «Позже» прячет карточку, а выстрел по ней — отказ от сдачи: бой продолжается.',
        ],
      },
    ],
    related: ['combat-attack', 'combat-boarding'],
  },
  {
    id: 'combat-beasts',
    section: 'combat',
    title: ['Beasts and monsters', 'Звери и чудовища'],
    tags: ['beasts', 'monsters', 'orca', 'shark', 'whale', 'kraken', 'звери', 'чудовища', 'касатка', 'акула', 'кит', 'кракен'],
    summary: [
      'Orcas, sharks, whales, narwhals and serpents bite the hull, never the crew. Only «Attack» — no grapples. Flense the carcass for oil, bone and teeth.',
      'Касатки, акулы, киты, нарвалы и змеи кусают корпус, но не команду. Только «Атаковать» — без кошек. С туши — жир, кость и зубы.',
    ],
    slides: [
      {
        img: 'combat-beasts-1.webp',
        text: [
          'A beast has no ring of choices: just «Attack». It has no guns; it bites, and its bite grows with its level.',
          'У зверя нет кольца выбора — только «Атаковать». Пушек у него нет, он кусает, и укус растёт с его уровнем.',
        ],
      },
      {
        img: 'combat-beasts-2.webp',
        text: [
          'Each has its way: orcas and sharks go for the rudder, a narwhal\'s tusk opens a leak, a serpent coils round the hull, a sperm whale rams. They never kill crew. A wounded beast flees for a few seconds, then turns at bay.',
          'У каждого свой приём: касатки и акулы рвут руль, бивень нарвала открывает течь, змей обвивает корпус, кашалот таранит. Команду они не убивают. Раненый зверь пару секунд убегает, потом разворачивается и бьётся насмерть.',
        ],
      },
      {
        img: 'combat-beasts-3.webp',
        text: [
          'The kill gives experience, and the carcass floats for 5 minutes: heave to alongside to flense it. An orca gives whale oil, teeth and whalebone; a sperm whale oil, whalebone and sometimes ambergris. Blood in the water draws sharks.',
          'За победу — опыт, а туша держится на воде 5 минут: встаньте рядом, чтобы разделать её. Касатка даёт ворвань, зубы и китовый ус, кашалот — ворвань, ус и изредка амбру. Кровь в воде приманивает акул.',
        ],
      },
    ],
    related: ['combat-ring', 'combat-attack'],
  },
];
