// Chapter 14 — Dead Calms (Act III, The Northern Waters). The only charts of the pack past the seal grounds went south
// with Corvin Hale, into the dead calms round the eastern anchorage, where crews go mad from a ringing under the still
// water. The choice: help Hale or drive him off (key hale_help); either way the ice charts come aboard (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 14,
  region: 'dead_mans_expanse',
  more: ['gravewater'],
  hub: 'lotus_anchorage',
  title: ['Dead Calms', 'Мёртвые штили'],
  blurb: [
    'Junks at anchor, silk under awnings, and a pagoda bell with its tongue tied fast. Around the anchorage the wind has died, and in the stillness the crews hear ringing that is not there.',
    'Джонки на якоре, шёлк под навесами и колокол пагоды с крепко подвязанным языком. Вокруг стоянки умер ветер, и в тишине команды слышат звон, которого нет.',
  ],
  giver: ['Hao Wen, keeper of the pagoda bell', 'Хао Вэнь, хранитель пагодного колокола'],
  portrait: 'giver_priest_m',
  reward: { map: 2 },
  quests: [
    {
      t: ['Where the Wind Dies', 'Где умирает ветер'],
      b: [
        'No chart of the pack past the seal grounds is left in the north: Corvin Hale bought them all and sailed for the eastern anchorage at {hub}. A day out, the wind drops as if cut, and the sails hang like washing.',
        'На севере не осталось ни одной карты льдов за тюленьими лежбищами: Корвин Хейл скупил их все и ушёл к восточной стоянке, в порт {hub}. В дне пути ветер падает, будто его отрезали, и паруса висят, как бельё.',
      ],
      d: [
        'A junk’s boat tows you the last mile in silence. On the quay an old man in a grey robe bows and does not straighten up for a long time.',
        'Последнюю милю вас молча буксирует лодка с джонки. На причале старик в сером халате кланяется и долго не разгибается.',
      ],
      s: [['escort', 'Drift through the calm for {n} min.', 'Продержитесь в штиле: {n} мин.'], 'hub'],
    },
    {
      t: ['The Tied Tongue', 'Подвязанный язык'],
      b: [
        'Hao Wen tied the tongue of the pagoda bell with silk the day the calm came: whenever it rang, something under the sea answered. Three junks are becalmed off {isle}, and their crews have stopped answering the signal flags.',
        'Хао Вэнь подвязал язык колокола пагоды шёлком в тот день, когда пришёл штиль: стоило ему зазвонить, как что-то под водой отвечало. У острова {isle} заштилели три джонки, и их команды перестали отвечать на флажные сигналы.',
      ],
      d: [
        'The crews sit on deck with their hands over their ears. You take off everyone who will let go of the rail.',
        'Команды сидят на палубе, зажав уши ладонями. Вы снимаете всех, кто соглашается отпустить поручень.',
      ],
      s: ['isle', 'rescue'],
    },
    {
      t: ['Poppy and Willow Bark', 'Мак и ивовая кора'],
      b: [
        'The men you brought in cannot sleep: they hear the ringing even with their ears stopped with wax. Hao Wen knows a draught that quiets it, and the anchorage has run out of everything it needs. Bring medicine to {hub}.',
        'Привезённые вами люди не могут спать: они слышат звон, даже залепив уши воском. Хао Вэнь знает отвар, который его заглушает, а на стоянке кончилось всё, из чего его варят. Привезите в порт {hub} лекарства.',
      ],
      d: [
        'The first of them sleeps through the night. In the morning he says he dreamed of a church full of water.',
        'Первый из них проспал всю ночь. Утром он говорит, что ему снилась церковь, полная воды.',
      ],
      s: ['bring:medicine'],
    },
    {
      t: ['The Ship That Rings', 'Корабль, который звонит'],
      b: [
        'A merchantman lies becalmed within sight of the anchorage, and her crew have been ringing her own bell for two days without stopping. The sound carries for miles, and the calm spreads with it. Board her and stop the ringing.',
        'Неподалёку от стоянки заштилел торговец, и его команда уже двое суток без передышки звонит в судовой колокол. Звук разносится на мили, и штиль расползается вместе с ним. Возьмите его на абордаж и прекратите звон.',
      ],
      d: [
        'The man at the rope fights to keep ringing. When he is pulled off, the wind stirs the pennant for the space of a breath.',
        'Человек у верёвки отбивается, лишь бы звонить дальше. Когда его оттаскивают, ветер на один вздох шевелит вымпел.',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['Sails That Never Fill', 'Паруса без ветра'],
      b: [
        'In the calm, ships move that should not: lanterns lit, sails slack, wakes behind them all the same. Hao Wen says the dead calm draws them up from below. Send them back before they reach the anchorage.',
        'В штиле движутся корабли, которым двигаться не положено: фонари горят, паруса обвисли, а за кормой всё равно тянется след. Хао Вэнь говорит, что их поднимает со дна мёртвый штиль. Верните их назад, пока они не дошли до стоянки.',
      ],
      d: [
        'They go down without a sound. The water where they sank stays smooth as oil until morning.',
        'Они уходят под воду беззвучно. Там, где они затонули, вода до утра остаётся гладкой, как масло.',
      ],
      s: ['sink:3:ghost', 'escort'],
    },
    {
      t: ['Silk Through the Calm', 'Шёлк сквозь штиль'],
      b: [
        'The anchorage lives on trade, and the junks cannot sail. Hao Wen’s people have silk lying at {port} and buyers waiting at {port2}. Carry it, or the eastern traders will have nothing left to pay for rice.',
        'Стоянка живёт торговлей, а джонки не могут выйти в море. У людей Хао Вэня лежит шёлк в порту {port}, а покупатели ждут в порту {port2}. Довезите его, иначе восточным купцам нечем будет платить за рис.',
      ],
      d: [
        'The buyers pay in old square coins and ask whether the eastern anchorage is cursed. You tell them it is only becalmed.',
        'Покупатели платят старыми квадратными монетами и спрашивают, не проклята ли восточная стоянка. Вы отвечаете, что её всего лишь заштилило.',
      ],
      s: ['carry:cloth'],
    },
    {
      t: ['Hale’s Wake', 'След Хейла'],
      b: [
        'Hale put in at {port} before the calm closed in, sold half his rum and none of his charts. Ask the quays where the Grey Heron went, and how her crew looked when she left.',
        'До того как сомкнулся штиль, Хейл заходил в порт {port}, продал половину рома и ни одной карты. Расспросите на причалах, куда ушла «Серая цапля» и как выглядела её команда.',
      ],
      d: [
        'The Grey Heron sailed into the heart of the calm. Her crew were singing, the harbour-boys say, and none of them knew the song.',
        '«Серая цапля» ушла в самое сердце штиля. Её команда пела, говорят портовые мальчишки, и ни один не знал этой песни.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Grey Oars', 'Серые вёсла'],
      b: [
        'A calm stops ships, but not galleys. Choir galleys under grey awnings are rowing among the becalmed hulls and stripping them. Wind or no wind, they must be stopped.',
        'Штиль останавливает корабли, но не галеры. Галеры Хора под серыми навесами ходят на вёслах среди заштилевших корпусов и обирают их. Ветер или нет, их нужно остановить.',
      ],
      d: [
        'The galley-slaves are freed and take your oars willingly. One of the galleys carried a coil of bell-rope, newly tarred.',
        'Освобождённые гребцы охотно садятся за ваши вёсла. На одной из галер нашлась бухта колокольной верёвки, свежепросмолённой.',
      ],
      s: ['board:1', 'sink:2'],
    },
    {
      t: ['The Edge of the Calm', 'Край штиля'],
      b: [
        'Hao Wen wants to know how far the calm reaches and whether it is growing. Chart the islands at its edge, and note where the water turns from glass to ripple.',
        'Хао Вэнь хочет знать, далеко ли тянется штиль и растёт ли он. Нанесите на карту острова у его края и отметьте, где вода из стекла становится рябью.',
      ],
      d: [
        'The calm is a circle, and it grows a little every night. At its centre, on your chart, there is nothing at all.',
        'Штиль — это круг, и он понемногу растёт каждую ночь. В его центре, на вашей карте, нет ничего.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Crabs on the Sand', 'Крабы на песке'],
      b: [
        'Hao Wen’s divers say the crabs have left the water by the thousand and crowded onto the beaches of {isle}, a thing the eastern books record only once before. Land there and see what drove them out.',
        'Ныряльщики Хао Вэня говорят, что крабы тысячами вышли из воды и толпятся на пляжах острова {isle} — восточные книги отмечали такое лишь однажды. Высадитесь и посмотрите, что их выгнало.',
      ],
      d: [
        'Among the crabs: keel marks, coils of bell-rope and a boat’s lantern hooded in grey cloth.',
        'Среди крабов — следы килей, бухты колокольной верёвки и шлюпочный фонарь, завешенный серой тряпкой.',
      ],
      s: ['land:crabs', 'hub'],
    },
    {
      t: ['Oarsmen for the Calm', 'Гребцы для штиля'],
      b: [
        'In a calm only oars carry a ship, and you will need many to reach its heart. The freed galley-men and the junk crews will row for you, if you sign them on and see them through their first day at sea.',
        'В штиль корабль движут только вёсла, а чтобы дойти до сердца штиля, их понадобится много. Освобождённые гребцы и команды джонок пойдут к вам, если вы наймёте их и проведёте через первый день в море.',
      ],
      d: [
        'They row to a drum that Hao Wen beats himself, and the drum drowns out the ringing that only they can hear.',
        'Они гребут под барабан, в который бьёт сам Хао Вэнь, и барабан заглушает звон, слышный только им.',
      ],
      s: ['recruit', 'escort'],
    },
    {
      t: ['The Grey Heron Becalmed', 'Заштилевшая «Цапля»'],
      b: [
        'You find the Grey Heron near the heart of the calm: water casks empty, half her crew tied below for their own good. Hale hails you, hoarse but smiling. He has charts of the ice; you have oars and water. Tow him out.',
        'Вы находите «Серую цаплю» у сердца штиля: бочки без воды, половина команды связана в трюме ради её же блага. Хейл окликает вас — охрипший, но с улыбкой. У него карты льдов, у вас вёсла и вода. Выведите его на буксире.',
      ],
      d: [
        'At the edge of the calm Hale throws the chart case across. “Call it a debt,” he says. “I hate debts. Don’t get used to it.”',
        'У края штиля Хейл перебрасывает вам футляр с картами. «Считай, что я должен, — говорит он. — Ненавижу долги. Не привыкай».',
      ],
      s: ['escort', 'rescue'],
      alt: {
        key: 'hale_help',
        label: [['Help him', 'Помочь ему'], ['Drive him off', 'Прогнать его']],
        t: ['Drive Off the Heron', 'Прогнать «Цаплю»'],
        b: [
          'You find the Grey Heron near the heart of the calm, and Hale is already lowering boats: he means to take your water by force. Meet his boats at the rail, sink what he sends after them, and keep the chart case he brought to bargain with.',
          'Вы находите «Серую цаплю» у сердца штиля, а Хейл уже спускает шлюпки: он намерен взять вашу воду силой. Встретьте его шлюпки у борта, потопите тех, кого он пошлёт следом, и заберите футляр с картами, который он вёз для торга.',
        ],
        d: [
          'The Heron’s boats row off empty. Hale shouts across the glassy water that he will remember this, and the ice charts stay on your table.',
          'Шлюпки «Цапли» уходят пустыми. Хейл кричит через стеклянную воду, что он это запомнит, а карты льдов остаются у вас на столе.',
        ],
        s: ['board:1', 'sink:2'],
      },
    },
    {
      t: ['What the Charts Show', 'Что показывают карты'],
      b: [
        'Hale’s charts show the pack past the seal grounds, and one more thing in another hand: a ring around the heart of the calm, near {isle}, and a single word: “Calling”. Go and look before anyone else does.',
        'На картах Хейла — льды за тюленьими лежбищами и ещё кое-что, другой рукой: кружок вокруг сердца штиля, у острова {isle}, и одно слово — «зов». Сходите посмотреть, пока не успел кто-то другой.',
      ],
      d: [
        'From the masthead you see a ring of grey hulls lying on the still water like stones laid out around a grave.',
        'С мачты видно кольцо серых корпусов, лежащих на неподвижной воде, словно камни вокруг могилы.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['A Quiet Harbour', 'Тихая гавань'],
      b: [
        'Hao Wen asks what you keep in your hidden harbour, and goes pale when you tell him. A raised bell answers its sisters, he says. Build a wall of earth and timber around its slip, the way the eastern temples muffle theirs.',
        'Хао Вэнь спрашивает, что вы держите в своей тайной гавани, и бледнеет, услышав ответ. Поднятый колокол откликается сёстрам, говорит он. Возведите вокруг его эллинга стену из земли и брёвен — так восточные храмы глушат свои колокола.',
      ],
      d: [
        'Behind the wall the bell falls silent at last. Jory says it is like having a toothache stop.',
        'За стеной колокол наконец умолкает. Джори говорит, что это как если бы перестал болеть зуб.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['The Calm-Reaper', 'Жнец штиля'],
      b: [
        'A pirate the Hunters’ Guild calls the Calm-Reaper sails a galley that needs no wind, and he takes becalmed ships one by one like fruit off a tree. The junks of {port} have lost three this month.',
        'Пират, которого Гильдия охотников зовёт Жнецом штиля, ходит на галере, которой ветер не нужен, и берёт заштилевшие корабли один за другим, как плоды с дерева. Джонки порта {port} за месяц потеряли три.',
      ],
      d: [
        'The Reaper is on the bottom. The junk masters of {port} send a crate of tea and a bow that lasts a long time.',
        'Жнец на дне. Хозяева джонок порта {port} присылают ящик чая и долгий поклон.',
      ],
      s: ['named', 'port'],
    },
    {
      t: ['Down in the Still Water', 'В неподвижной воде'],
      b: [
        'In a calm the water is clear to a great depth, and Hao Wen’s divers have seen hulls below that are on no chart. Send your own divers down to the wrecks and learn what lies around the heart of the calm.',
        'В штиль вода прозрачна на большую глубину, и ныряльщики Хао Вэня видели внизу корпуса, которых нет ни на одной карте. Спустите своих водолазов к затонувшим кораблям и узнайте, что лежит вокруг сердца штиля.',
      ],
      d: [
        'The wrecks all lie with their bows towards the centre, as if they had been pulled there.',
        'Все обломки лежат носом к центру, будто их туда стянуло.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['The Shrine of the Tide', 'Святилище прилива'],
      b: [
        'On {isle} stands an eastern shrine, older than the anchorage, whose monks write down every great tide. Hao Wen asks you to land and ask them about the last time the sea stood still.',
        'На острове {isle} стоит восточное святилище, старше самой стоянки, и его монахи записывают каждый большой прилив. Хао Вэнь просит высадиться и расспросить их о том, когда море стояло так в прошлый раз.',
      ],
      d: [
        'The monks show a scroll a hundred years old: the calm, the ringing, and then a tide that came ashore and did not go back.',
        'Монахи показывают свиток столетней давности: штиль, звон, а потом прилив, который вышел на берег и не вернулся.',
      ],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['The Bell-Ringers’ Boats', 'Лодки звонарей'],
      b: [
        'Every evening longboats leave the grey ring and row out to the becalmed ships with small hand-bells, to ring at their sterns until the crews go mad. Take the longboats and their ringers.',
        'Каждый вечер из серого кольца выходят баркасы и гребут к заштилевшим кораблям с ручными колокольчиками — звонить у них за кормой, пока команды не сойдут с ума. Захватите баркасы вместе со звонарями.',
      ],
      d: [
        'The ringers are boys of the Choir, no older than Jory. They say the bell in the ring is new-cast, and it is calling the old drowned bells awake.',
        'Звонари — мальчишки Хора, не старше Джори. Они говорят, что колокол в кольце отлит недавно и созывает старые утонувшие колокола — будит их.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Hounds in the Calm', 'Гончие в штиле'],
      b: [
        'The Bell-Warden’s hunters have come south on oars to guard the ring, and they have been told whose ship carries the first bell’s scent. Meet them before they find your harbour, then warn {port}.',
        'Охотники Звонаря пришли на юг на вёслах стеречь кольцо, и им сказали, чей корабль пахнет первым колоколом. Встретьте их, пока они не нашли вашу гавань, а потом предупредите порт {port}.',
      ],
      d: [
        'The hunters are sunk. At {port} you learn that the Bell-Warden himself is in the north, in his ice, and waits only for this ring to ring.',
        'Охотники на дне. В порту {port} вы узнаёте, что сам Звонарь на севере, в своих льдах, и ждёт только, когда зазвонит это кольцо.',
      ],
      s: ['sink:3:hunter', 'port'],
    },
    {
      t: ['The Ring of Grey Hulls', 'Кольцо серых корпусов'],
      b: [
        'Before you go in, Hao Wen wants the ring watched for one whole night: which hulls are manned, where the bell hangs, when its ringers change. Lie off {isle} with lanterns out.',
        'Прежде чем вы туда пойдёте, Хао Вэнь хочет, чтобы за кольцом проследили целую ночь: какие корпуса с командой, где висит колокол, когда сменяются звонари. Встаньте у острова {isle} с погашенными фонарями.',
      ],
      d: [
        'The bell hangs from a sheer-legs over the water between the four largest hulls, and it is rung at every turn of the glass.',
        'Колокол подвешен на треноге над водой между четырьмя самыми большими корпусами, и в него бьют при каждом повороте склянок.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['Breaking the Calm', 'Разбить штиль'],
      b: [
        'At the turn of the glass the oars dig in, and Hao Wen beats the drum on your quarterdeck. Break the grey ring, take its four great hulls, and send divers to cut the bell from its sheer-legs into the deep.',
        'На повороте склянок вёсла врезаются в воду, и Хао Вэнь бьёт в барабан на ваших шканцах. Разбейте серое кольцо, возьмите четыре больших корпуса и пошлите водолазов срезать колокол с треноги в глубину.',
      ],
      d: [
        'The bell sinks without a sound, and a wind comes up from the south. In the anchorage Hao Wen unties the pagoda bell, and it rings clean.',
        'Колокол уходит вниз без звука, и с юга поднимается ветер. На стоянке Хао Вэнь отвязывает колокол пагоды, и тот звенит чисто.',
      ],
      s: ['sink:4', 'board:2', 'dive', 'hub'],
    },
  ],
};
