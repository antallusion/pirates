// Chapter 29 — Fallen Crown (Act V, the Drowned Crown). The ruins of the drowned capital read with the whole Black
// Chart; the Drowned Grail raised from the cathedral. The choice `grail`: keep it, or give it to the Order (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 29,
  region: 'drowned_crown',
  hub: 'crownfall',
  title: ['Fallen Crown', 'Павшая корона'],
  blurb: [
    'The capital of the drowned empire lies a few fathoms under the keel, its streets still straight, its churches still standing. Isolde Marrow lays the Black Chart over it and sees at last what it always was: a plan of the city.',
    'Столица утонувшей империи лежит в нескольких саженях под килем: улицы всё так же прямы, церкви всё так же стоят. Изольда Марроу кладёт на неё Чёрную карту и наконец видит, чем та была всегда, — планом города.',
  ],
  giver: ['Isolde Marrow, cartographer of the Admiralty', 'Изольда Марроу, картограф Адмиралтейства'],
  portrait: 'giver_cartographer_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['A City Under the Keel', 'Город под килем'],
      b: [
        '{hub} is a scavengers’ port built on the roofs of the drowned capital. Isolde wants to see the city before she believes it: sail out over the old streets to {isle} and look down.',
        'Порт {hub} — пристанище мародёров, выстроенное на крышах утонувшей столицы. Прежде чем поверить, Изольда хочет увидеть город своими глазами: пройдите над старыми улицами до острова {isle} и посмотрите вниз.',
      ],
      d: ['Under the keel a street slides past, then a square with a fountain, then a church door standing open.', 'Под килем проплывает улица, потом площадь с фонтаном, потом распахнутая дверь церкви.'],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Chart Is a Street Plan', 'Карта — это план улиц'],
      b: [
        'Isolde lays the Black Chart over an old plan of the capital and gasps: every bell on it is a church of this city. She needs the islands round the ruins charted to fix the plan in place.',
        'Изольда кладёт Чёрную карту на старый план столицы и ахает: каждый колокол на ней — церковь этого города. Чтобы закрепить план, ей нужны на карте острова вокруг руин.',
      ],
      d: ['The two charts lock together like two halves of a broken plate.', 'Две карты сходятся, как половинки разбитой тарелки.'],
      s: ['chart', 'hub'],
    },
    {
      t: ['Scavengers of the Ruins', 'Мародёры руин'],
      b: [
        'The scavengers of {hub} hook bells out of the drowned churches and sell them to whoever pays — lately, only to the Choir. Isolde wants their ships stopped and their hooks taken.',
        'Мародёры порта {hub} вытаскивают крючьями колокола из утонувших церквей и продают тому, кто заплатит, — а в последнее время только Хору. Изольда хочет остановить их корабли и отобрать крючья.',
      ],
      d: ['In the scavengers’ hold: a small church bell, its tongue already wrapped in green rag by someone who knew.', 'В трюме мародёров — маленький церковный колокол; кто-то знающий уже обмотал его язык зелёной тряпкой.'],
      s: ['board', 'hub'],
    },
    {
      t: ['The Palace Roof', 'Крыша дворца'],
      b: [
        'The roof of the old palace still stands above the water on {isle}, and something has nested in its throne hall. Isolde wants the palace archive, if anything is left of it.',
        'Крыша старого дворца всё ещё поднимается над водой на острове {isle}, а в тронном зале кто-то свил гнёзда. Изольде нужен дворцовый архив, если от него хоть что-то осталось.',
      ],
      d: ['The archive is a single chest, sealed in wax. Inside: the order of service for the last coronation.', 'Весь архив — один сундук, запечатанный воском. Внутри — чин последней коронации.'],
      s: ['land:ruins', 'lair'],
    },
    {
      t: ['Air for the Divers', 'Воздух для ныряльщиков'],
      b: [
        'The cathedral lies deeper than the diving bell can hang. Isolde’s plan is tarred sailcloth hoses, pumped from the deck. Bring sailcloth to {hub}, a great deal of it.',
        'Собор лежит глубже, чем можно опустить водолазный колокол. Изольда придумала рукава из просмолённой парусины с насосом на палубе. Привезите в порт {hub} парусину, и побольше.',
      ],
      d: ['The first diver on a hose stays down an hour and comes up talking of streets paved with green glass.', 'Первый ныряльщик на рукаве пробыл внизу час и поднимается, рассказывая о мостовых из зелёного стекла.'],
      s: ['bring:sailcloth'],
    },
    {
      t: ['The Choir Dives Too', 'Хор тоже ныряет'],
      b: [
        'Choir diving ships have anchored over the old market, guarded by ghost ships. Their divers are working towards the cathedral from the other side. Sink the guard and send your divers to see how far they have come.',
        'Над старым рынком встали на якорь водолазные корабли Хора под охраной призраков. Их ныряльщики пробиваются к собору с другой стороны. Потопите охрану и пошлите своих водолазов узнать, как далеко те продвинулись.',
      ],
      d: ['The Choir’s divers had reached the cathedral steps. They left a green lantern burning on the lowest one.', 'Ныряльщики Хора дошли до ступеней собора. На нижней они оставили гореть зелёный фонарь.'],
      s: ['sink::ghost', 'dive'],
    },
    {
      t: ['Knights in Grey Water', 'Рыцари в серой воде'],
      b: [
        'Aurora Sayle has kept her word: three ships of the Order wait at {port} to join you. They have never sailed this far from their light, and their captains are uneasy. See them through.',
        'Аврора Сейл сдержала слово: три корабля Ордена ждут вас в порту {port}. Так далеко от своего света они никогда не ходили, и их капитанам не по себе. Проведите их.',
      ],
      d: ['The knights hang their lanterns over the side, and the water round the ruins turns clear as glass.', 'Рыцари вывешивают фонари за борт, и вода вокруг руин становится прозрачной, как стекло.'],
      s: ['port', 'escort'],
    },
    {
      t: ['The Street of Founders', 'Улица литейщиков'],
      b: [
        'By Isolde’s plan the bell-founders of the capital worked on one street, off {isle}. Their foundry ledger would say which bell was cast for which tower, and for what.',
        'По плану Изольды литейщики колоколов работали на одной улице — у острова {isle}. Их литейная книга должна сказать, какой колокол для какой башни отлит и зачем.',
      ],
      d: ['The ledger is stone tablets, not paper. The last entry reads: “The Grail, for the great bell. Not to be rung.”', 'Книга оказалась каменными плитами, а не бумагой. Последняя запись: «Грааль — для великого колокола. Не звонить».'],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['Whispering Idols', 'Шепчущие идолы'],
      b: [
        'Idols raised from the ruins are sold openly at {port}, and every buyer’s crew starts hearing voices within a week. Isolde wants them bought up and carried to the Order’s keeping at {port2}.',
        'Идолов, поднятых из руин, открыто продают в порту {port}, и через неделю у каждого покупателя команда начинает слышать голоса. Изольда хочет выкупить их и отвезти на хранение Ордену в порт {port2}.',
      ],
      d: ['The knights take the idols in lead-lined chests. Your crew sleeps soundly for the first time in days.', 'Рыцари принимают идолов в ящиках со свинцовой обивкой. Ваша команда впервые за много дней спит спокойно.'],
      s: ['carry:cursed_relics'],
    },
    {
      t: ['A Vault Behind Walls', 'Хранилище за стенами'],
      b: [
        'What is raised from the capital cannot stay in a scavengers’ port. Isolde asks for a vault on your own island, dry, deep in the rock, with one door and one key.',
        'То, что поднято из столицы, нельзя оставлять в порту мародёров. Изольда просит устроить на вашем острове хранилище — сухое, глубоко в скале, с одной дверью и одним ключом.',
      ],
      d: ['Isolde locks the vault and hangs the key round her own neck. “Until we know what we are keeping,” she says.', 'Изольда запирает хранилище и вешает ключ себе на шею. «Пока не поймём, что храним», — говорит она.'],
      s: ['build', 'hub'],
    },
    {
      t: ['Camp on the Arch', 'Лагерь на арке'],
      b: [
        'The triumphal arch of the capital rises above the water on {isle}, and a pirate crew has made it a fortress, firing on every boat that passes under. Land, take the camp, and take their ship too.',
        'Триумфальная арка столицы поднимается над водой на острове {isle}, и пиратская шайка устроила в ней крепость, обстреливая каждую лодку, что проходит под ней. Высадитесь, возьмите лагерь, а заодно и их корабль.',
      ],
      d: ['From the top of the arch the whole drowned city can be seen at low water, shining under the surface.', 'С вершины арки в отлив виден весь утонувший город — он светится под водой.'],
      s: ['land:pirate_camp', 'board:1'],
    },
    {
      t: ['The Warden of the Nave', 'Страж нефа'],
      b: [
        'A bell hangs in the cathedral door, and it rings whenever a diver comes near, calling up everything that sleeps in the ruins. Bring drowned silk to {hub}, then send divers down to bind its tongue as Ansel taught.',
        'В дверях собора висит колокол, и он звонит, стоит ныряльщику приблизиться, поднимая всё, что спит в руинах. Привезите в порт {hub} утопленный шёлк, а потом пошлите водолазов обмотать его язык, как учил Ансельм.',
      ],
      d: ['The warden bell swings in silence. Beyond it the great nave opens, dark and enormous.', 'Колокол-страж качается беззвучно. За ним открывается огромный тёмный неф.'],
      s: ['bring:drowned_silk', 'dive'],
    },
    {
      t: ['The Last Admiral’s Fleet', 'Флот последнего адмирала'],
      b: [
        'At night the fleet that sank with the capital rises round the cathedral, every ship lit green, as if to defend it once more. Hold the waters till dawn and send back what will not go down by itself.',
        'Ночью вокруг собора поднимается флот, затонувший вместе со столицей: все корабли горят зелёным, будто снова встали на защиту. Продержитесь в этих водах до рассвета и верните на дно то, что не уйдёт само.',
      ],
      d: ['At first light the drowned fleet sinks back all at once, as if a single order had been given.', 'С первым светом утонувший флот разом уходит вниз, словно по одной команде.'],
      s: ['escort', 'sink:5:ghost'],
    },
    {
      t: ['What Sleeps in the Nave', 'Что спит в нефе'],
      b: [
        'Something vast sleeps coiled under the cathedral dome, and the divers’ lanterns are waking it. Isolde will not send anyone in until it has been drawn out and hunted down at sea.',
        'Под куполом собора спит, свернувшись кольцом, что-то огромное, и фонари ныряльщиков его будят. Изольда не пустит туда никого, пока его не выманят и не добьют в открытом море.',
      ],
      d: ['The beast follows the bait into open water and does not come back. The dome is empty.', 'Зверь идёт за приманкой в открытое море и больше не возвращается. Купол пуст.'],
      s: ['beast', 'hub'],
    },
    {
      t: ['The Nave Gives Way', 'Неф обрушился'],
      b: [
        'A pillar of the nave gives way while your divers are inside, and the hoses are pinned under the stone. Send everyone you have down after them.',
        'Пока ваши водолазы внутри, одна из колонн нефа рушится, и камень придавливает рукава. Пошлите вниз всех, кто у вас есть.',
      ],
      d: ['Every diver comes up alive. One of them holds out his fist: he had touched the altar, and his palm is green.', 'Все водолазы поднимаются живыми. Один протягивает кулак: он коснулся алтаря, и его ладонь позеленела.'],
      s: ['dive', 'rescue'],
    },
    {
      t: ['Hale Holds the Road', 'Хейл держит рейд'],
      b: [
        'Corvin Hale and the Grey Heron keep the outer road while you work over the cathedral, and tonight a Choir squadron is trying to slip past him in the dark. He signals for help, which he has never done before.',
        'Корвин Хейл на «Серой цапле» держит внешний рейд, пока вы работаете над собором, и этой ночью эскадра Хора пытается проскользнуть мимо него в темноте. Он сигналит о помощи — впервые в жизни.',
      ],
      d: ['“I would have managed,” Hale says, his sails in rags. “But it was nice of you to come.”', '«Я бы справился, — говорит Хейл; паруса у него в лохмотьях. — Но мило, что вы пришли».'],
      s: ['escort', 'board:1'],
    },
    {
      t: ['The Drowned Grail', 'Грааль Утонувших'],
      b: [
        'The way is clear. On the high altar of the drowned cathedral, off {isle}, stands the cup the last admiral drank the sea’s oath from. Isolde will go down herself.',
        'Путь свободен. На главном алтаре утонувшего собора у острова {isle} стоит чаша, из которой последний адмирал пил клятву моря. Изольда спустится сама.',
      ],
      d: [
        'A plain cup of dark bronze. When Isolde runs a wet finger round its rim, every bell under the city hums in answer.',
        'Простая чаша из тёмной бронзы. Когда Изольда проводит мокрым пальцем по её краю, все колокола под городом отзываются гулом.',
      ],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['The Grail Stays With You', 'Грааль остаётся у вас'],
      alt: {
        key: 'grail',
        label: [['Keep the Grail', 'Оставить Грааль'], ['Give it to the Order', 'Отдать Ордену']],
        t: ['The Grail to the Order', 'Грааль — Ордену'],
        b: [
          'Aurora asks for the Grail: the Order has kept its secret for three hundred years and will keep the cup itself under the downward light. You give it. Carry it to {at} under the knights’ escort and see it laid away.',
          'Аврора просит отдать Грааль: Орден триста лет хранил его тайну и сохранит саму чашу под нижним светом. Вы отдаёте. Отвезите её в порт {at} под охраной рыцарей и проследите, чтобы её укрыли.',
        ],
        d: [
          'The Grail is lowered into a well beneath the lighthouse, and the beam closes over it like water. Aurora bows — the first knight of the Order to bow to a pirate.',
          'Грааль опускают в колодец под маяком, и луч смыкается над ним, как вода. Аврора кланяется — первый рыцарь Ордена, поклонившийся пирату.',
        ],
        s: ['escort', 'at:last_light'],
      },
      b: [
        'Aurora asks for the Grail: the Order has kept its secret for three hundred years. Isolde says whoever holds the cup holds the bells, and she will not trust that to any order. You keep it. See the Order’s ships away without a quarrel.',
        'Аврора просит отдать Грааль: Орден триста лет хранил его тайну. Изольда говорит, что у кого чаша — у того и колокола, и никакому ордену она этого не доверит. Вы оставляете Грааль себе. Проводите корабли Ордена без ссоры.',
      ],
      d: [
        'The Order’s ships turn for home without a salute. Aurora’s last lamp signal reads: “May you never need it.”',
        'Корабли Ордена уходят домой без салюта. Последний сигнал фонаря Авроры гласит: «Пусть он вам никогда не понадобится».',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['The Widow’s Herald', 'Глашатай Вдовы'],
      b: [
        'A Choir ship under a white flag comes into {hub} with a herald on its bow and a ghost escort behind it. The escort opens fire before the herald has finished speaking.',
        'В порт {hub} входит корабль Хора под белым флагом — с глашатаем на носу и призраками в охране. Охрана открывает огонь, прежде чем глашатай договорил.',
      ],
      d: [
        'The herald, taken alive, finishes his message anyway: “Keep the cup wherever you like. The bells will wake without it.”',
        'Взятый живым глашатай всё равно договаривает: «Держите чашу где хотите. Колокола проснутся и без неё».',
      ],
      s: ['sink:3:ghost', 'board:1'],
    },
    {
      t: ['The Bells of the Capital', 'Колокола столицы'],
      b: [
        'The Widow’s whole fleet falls on the drowned capital at night, and under the water the churches begin to ring. Her men are landing on the palace ruins of {isle} to ring the city from above. Break the fleet, take the ruins and hold them till dawn.',
        'Ночью весь флот Вдовы обрушивается на утонувшую столицу, и под водой начинают звонить церкви. Её люди высаживаются на дворцовых руинах острова {isle}, чтобы звонить в город сверху. Разбейте флот, возьмите руины и удержите их до рассвета.',
      ],
      d: [
        'At dawn every bell of the capital rings once, all together, and falls silent. Far to the south a reef answers in song, and Galt takes the pipe from his mouth: “She is making for the Wall.”',
        'На рассвете все колокола столицы разом бьют один раз и смолкают. Далеко на юге им отвечает пением риф, и Галт вынимает трубку изо рта: «Она идёт к Стене».',
      ],
      s: ['sink:6:ghost', 'board:2', 'land:ruins', 'hub'],
    },
  ],
};
