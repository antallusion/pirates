// Chapter 28 — The Last Light (Act V, the Drowned Crown). The fortress-lighthouse of the Order at the edge of the Abyss,
// whose lenses point down; Aurora Sayle reveals the Drowned Grail; the Widow's fleet comes to put out the light (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 28,
  region: 'drowned_crown',
  more: ['the_abyss'],
  hub: 'last_light',
  title: ['The Last Light', 'Последний Огонь'],
  blurb: [
    'At the edge of the deep stands a fortress-lighthouse whose lenses look not out to sea but down into it. Its knights trust no pirate, and they guard a secret older than the Choir: the Drowned Grail.',
    'На краю глубины стоит маяк-крепость, чьи линзы смотрят не в море, а вниз, в его толщу. Его рыцари не доверяют пиратам и хранят тайну старше самого Хора — Грааль Утонувших.',
  ],
  giver: ['Aurora Sayle, Master of the Order of the Last Light', 'Аврора Сейл, магистр Ордена Последнего Огня'],
  portrait: 'giver_lighthouse_keeper_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['The Light That Looks Down', 'Свет, что смотрит вниз'],
      b: [
        'The lighthouse of {hub} burns by day and by night, and its great lenses point straight down into black water. The Order’s gate is shut to your fleet. Lie off the fortress and wait to be noticed.',
        'Маяк порта {hub} горит и днём и ночью, а его огромные линзы направлены прямо вниз, в чёрную воду. Ворота Ордена закрыты для вашего флота. Встаньте у крепости и ждите, пока вас заметят.',
      ],
      d: [
        'On the second day a woman in a white cloak comes down to the water gate. “I am Aurora Sayle,” she says. “Tell me why I should not sink you.”',
        'На второй день к водяным воротам спускается женщина в белом плаще. «Я Аврора Сейл, — говорит она. — Объясните, почему мне не стоит вас потопить».',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['A Letter from the Admiral', 'Письмо адмирала'],
      b: [
        'Aurora will not take a pirate’s word, but she once served beside Cassius Dray. Sail to {at} and bring back his letter under the Crown’s seal.',
        'Аврора не верит слову пирата, но когда-то служила вместе с Кассием Дреем. Сходите в порт {at} и привезите его письмо под печатью Короны.',
      ],
      d: ['Aurora reads Dray’s letter twice and almost smiles. “He says you are worse than a pirate, and the only one who can do it.”', 'Аврора дважды перечитывает письмо Дрея и почти улыбается. «Он пишет, что вы хуже пирата — и что сделать это можете только вы».'],
      s: ['at:tidehallow', 'hub'],
    },
    {
      t: ['Ghosts at the Foot', 'Призраки у подножия'],
      b: [
        'Every night ghost ships gather in the waters of {isle}, just beyond the edge of the downward beam, and wait for it to falter. Aurora wants to see how a pirate deals with them.',
        'Каждую ночь у острова {isle}, сразу за краем нижнего луча, собираются корабли-призраки и ждут, когда свет дрогнет. Аврора хочет посмотреть, как с ними управится пират.',
      ],
      d: ['The knights on the walls watch in silence. In the morning the water gate stands open.', 'Рыцари на стенах смотрят молча. Наутро водяные ворота открыты.'],
      s: ['isle', 'sink::ghost'],
    },
    {
      t: ['Oil for the Downward Lamp', 'Масло для нижнего огня'],
      b: [
        'The downward lamp burns a whole ship’s load of oil in a month, and the Order’s last supply ship never came. Whale oil waits at {port}; carry it to the Order’s store at {port2}, then on to the fortress.',
        'Нижний огонь за месяц сжигает целый трюм масла, а последний корабль Ордена с припасами так и не пришёл. Китовый жир ждёт в порту {port}; доставьте его на склад Ордена в порту {port2}, а затем в крепость.',
      ],
      d: ['The knights pour the oil in by hand, cup by cup, and pray over every cup.', 'Рыцари заливают масло вручную, кружка за кружкой, и над каждой кружкой молятся.'],
      s: ['carry:whale_oil', 'hub'],
    },
    {
      t: ['A Cracked Lens', 'Треснувшая линза'],
      b: [
        'One of the great lenses has cracked, and the downward beam has a dark seam in it. Only abyssal glass can mend it, and the nearest is in the hold of a wreck off {isle}.',
        'Одна из больших линз треснула, и в нижнем луче появилась тёмная полоса. Залатать её можно только абиссальным стеклом, а ближайшее лежит в трюме разбитого корабля у острова {isle}.',
      ],
      d: ['The glass is raised whole. Through it the sea floor looks close enough to touch.', 'Стекло поднято целым. Сквозь него морское дно кажется таким близким, что его можно потрогать.'],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['The Knights Who Went Ashore', 'Рыцари, что сошли на берег'],
      b: [
        'Three knights of the Order went to tend a little shrine on {isle} and have not come back. The Order does not ask pirates for help. Aurora is asking.',
        'Трое рыцарей Ордена отправились присмотреть за маленьким святилищем на острове {isle} и не вернулись. Орден не просит пиратов о помощи. Аврора просит.',
      ],
      d: ['The knights are found on the shrine’s roof, their lantern still lit, the tide all round them full of singing.', 'Рыцарей находят на крыше святилища: их фонарь всё ещё горит, а прилив вокруг полон пения.'],
      s: ['land:shrine', 'rescue'],
    },
    {
      t: ['The Order’s Chronicle', 'Летопись Ордена'],
      b: [
        'At last Aurora speaks of the Drowned Grail, but only the Order’s chronicle tells it whole, and its keeper lives at {port}, far from the light, so the chronicle can never sink with it.',
        'Наконец Аврора заговаривает о Граале Утонувших, но целиком эту историю рассказывает лишь летопись Ордена, а её хранитель живёт в порту {port}, подальше от маяка, чтобы летопись никогда не утонула вместе с ним.',
      ],
      d: [
        'The chronicle says it plainly: the Grail is no holy relic. It is a tuning fork, and every drowned bell was cast to its note.',
        'Летопись говорит прямо: Грааль — не святыня. Это камертон, и каждый утонувший колокол отлит под его ноту.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Glass Robbers', 'Расхитители стекла'],
      b: [
        'Pirates have learned that abyssal glass sells for gold in the north, and they strip the Order’s old wrecks bare. Aurora wants them stopped, and one of their ships brought in for the Order to judge.',
        'Пираты прознали, что абиссальное стекло на севере продаётся на вес золота, и обдирают старые корабли Ордена до самого днища. Аврора хочет их остановить, а один корабль привести на суд Ордена.',
      ],
      d: ['The captured pirates are put to scrubbing the lenses. Aurora calls it mercy; they call it something else.', 'Пленных пиратов ставят чистить линзы. Аврора называет это милосердием; пираты называют иначе.'],
      s: ['sink::pirate', 'board:1'],
    },
    {
      t: ['Eyes That Looked Down', 'Глаза, смотревшие вниз'],
      b: [
        'The knights who keep the downward watch go blind for days at a time from staring into the beam. The Order’s infirmary at {hub} has run out of salves.',
        'Рыцари, что несут нижнюю вахту, на целые дни слепнут, вглядываясь в луч. В лечебнице Ордена в порту {hub} закончились мази.',
      ],
      d: ['A young knight takes the bandage off and blinks at you: “So that is what a pirate looks like.”', 'Молодой рыцарь снимает повязку и моргает, глядя на вас: «Так вот как выглядит пират».'],
      s: ['bring:medicine'],
    },
    {
      t: ['A Mirror of Deep Ore', 'Зеркало из глубинной руды'],
      b: [
        'Behind the lenses hangs a great mirror, and the salt has eaten it grey. Aurora wants it recast from abyssal ore, which the sea itself cannot rust.',
        'За линзами висит огромное зеркало, и соль разъела его до серости. Аврора хочет перелить его из абиссальной руды, которую не берёт даже море.',
      ],
      d: ['The new mirror is hung, and the downward beam reaches deeper than anyone in the Order remembers.', 'Новое зеркало повешено, и нижний луч уходит глубже, чем помнит кто-либо в Ордене.'],
      s: ['bring:abyssal_ore'],
    },
    {
      t: ['A Light of Your Own', 'Свой нижний огонь'],
      b: [
        'Aurora gives you what the Order has never given anyone: the drawing of a downward lens. Build a small one on your own island, so nothing will ever rise unseen in your harbour.',
        'Аврора отдаёт вам то, чего Орден не давал никому: чертёж нижней линзы. Постройте такую же, только меньше, на своём острове, чтобы в вашей гавани ничто не поднялось незамеченным.',
      ],
      d: ['Your harbour water glows faintly green at night now, all the way to the bottom.', 'Теперь вода вашей гавани по ночам слабо светится до самого дна.'],
      s: ['build', 'hub'],
    },
    {
      t: ['The Widow’s Eyes', 'Глаза Вдовы'],
      b: [
        'Small, fast Choir ships have begun to circle the fortress at a distance, counting its guns and its knights. Take one before it carries the count home.',
        'Маленькие быстрые корабли Хора начали кружить вокруг крепости на расстоянии, пересчитывая её пушки и рыцарей. Возьмите один, пока он не отвёз счёт домой.',
      ],
      d: ['In the scout’s log, every gun of the fortress is counted — and the night the lamp oil runs low is ringed.', 'В журнале разведчика пересчитана каждая пушка крепости — и обведена ночь, когда в лампе кончится масло.'],
      s: ['board', 'hub'],
    },
    {
      t: ['The Edge of the Chart', 'Край карты'],
      b: [
        'South of the fortress the charts simply stop. Aurora wants the islands at the very edge of the deep marked, so the Order knows from where the Widow’s fleet will come.',
        'К югу от крепости карты просто обрываются. Аврора хочет нанести на карту острова на самом краю глубины, чтобы Орден знал, откуда придёт флот Вдовы.',
      ],
      d: ['The last island you chart has no birds on it, and no sound at all, not even the surf.', 'На последнем нанесённом острове нет птиц и нет никаких звуков — даже прибоя.'],
      s: ['chart', 'hub'],
    },
    {
      t: ['Things That Rise to the Light', 'То, что поднимается к свету'],
      b: [
        'With the new mirror the beam reaches deeper, and things that lived below it have begun to rise. Hold the sea round the fortress and hunt what comes up.',
        'С новым зеркалом луч ушёл глубже, и то, что жило под ним, начало подниматься. Держите море вокруг крепости и добывайте всё, что всплывёт.',
      ],
      d: ['The thing you haul aboard has no eyes, only a pale patch where the light has always fallen.', 'У поднятого на борт зверя нет глаз — только бледное пятно там, куда всегда падал свет.'],
      s: ['escort', 'beast'],
    },
    {
      t: ['The Knights’ Oath', 'Клятва рыцарей'],
      b: [
        'Some of the younger knights are tired of waiting on the walls and ask leave to fight from your deck. Aurora grants it, on one condition: they swear before her, in the chapel of {hub}.',
        'Часть молодых рыцарей устала ждать на стенах и просит разрешения драться с вашей палубы. Аврора позволяет при одном условии: пусть принесут клятву перед ней, в часовне порта {hub}.',
      ],
      d: ['They swear on the light, not on the Crown and not on the Code, and come aboard with their lanterns.', 'Они клянутся светом — не Короной и не Кодексом — и поднимаются на борт со своими фонарями.'],
      s: ['recruit', 'hub'],
    },
    {
      t: ['The Darkened Rock', 'Погасшая скала'],
      b: [
        'The Order keeps a lesser downward light on {isle}, and last night it went out. Creatures from below have already crawled up into its tower. Land, clear it and light it again.',
        'На острове {isle} у Ордена есть малый нижний огонь, и прошлой ночью он погас. Твари из глубины уже заползли в его башню. Высадитесь, очистите её и зажгите огонь снова.',
      ],
      d: ['The small light burns again, and far below something turns away from it, slowly.', 'Малый огонь горит снова, и далеко внизу что-то медленно от него отворачивается.'],
      s: ['land', 'lair'],
    },
    {
      t: ['The Black Brig at the Edge', 'Чёрный бриг на краю'],
      b: [
        'The Widow’s black brig has been seen off {isle}, lying still at the edge of the deep, as if listening. Go and see what she is doing there, and sink whatever guards her.',
        'Чёрный бриг Вдовы видели у острова {isle}: он неподвижно стоит на краю глубины, будто прислушивается. Сходите посмотреть, что она там делает, и потопите тех, кто её охраняет.',
      ],
      d: ['The brig is gone by the time the guards are down, but where she lay the water is still faintly humming.', 'Когда охрана потоплена, брига уже нет, но там, где он стоял, вода всё ещё тихо гудит.'],
      s: ['isle', 'sink:2:ghost'],
    },
    {
      t: ['A Ship for the Order', 'Корабль для Ордена'],
      b: [
        'Aurora wants a Choir ship taken whole and brought before a prize court, so that the Crown’s law, not only the Order’s, names the Choir an enemy at last.',
        'Аврора хочет, чтобы корабль Хора взяли целым и привели в призовой суд: пусть не только Орден, но и закон Короны наконец назовёт Хор врагом.',
      ],
      d: ['The court rules the Choir’s ship a lawful prize. For the first time the Crown writes the word “enemy”.', 'Суд признаёт корабль Хора законным призом. Впервые Корона пишет слово «враг».'],
      s: ['board:1', 'prize'],
    },
    {
      t: ['The Cartographer Comes', 'Картограф в пути'],
      b: [
        'Aurora has sent for Isolde Marrow, who has kept the scraps of the Black Chart since the beginning. Her ship has put in at {port} and dare not cross the drowned sea alone. Bring her through.',
        'Аврора послала за Изольдой Марроу, которая с самого начала хранит обрывки Чёрной карты. Её корабль стоит в порту {port} и не решается в одиночку пересечь утонувшее море. Проведите его.',
      ],
      d: ['Isolde steps ashore with a case of charts under each arm and kisses Jory on both cheeks.', 'Изольда сходит на берег с футляром карт под каждой рукой и целует Джори в обе щеки.'],
      s: ['port', 'escort', 'hub'],
    },
    {
      t: ['The Night the Light Wavered', 'Ночь, когда дрогнул свет'],
      b: [
        'At midnight the downward beam flickers: Choir divers are cutting the chains of the great lens from below, while their ships wait in the dark. Send your divers down after them and sink the waiting ships.',
        'В полночь нижний луч мигает: ныряльщики Хора снизу подпиливают цепи большой линзы, а их корабли ждут в темноте. Пошлите своих водолазов следом и потопите тех, кто ждёт.',
      ],
      d: ['The chains hold. A Choir diver brought up alive says only: “She is coming tomorrow.”', 'Цепи выдержали. Поднятый живым ныряльщик Хора говорит лишь: «Она придёт завтра».'],
      s: ['dive', 'sink:3:ghost'],
    },
    {
      t: ['The Green Fleet at Dusk', 'Зелёный флот в сумерках'],
      b: [
        'The Widow’s fleet comes out of the deep at dusk, every lantern green, to put out the light for good. Aurora holds the walls; the sea is yours. Break the line, take her flagship’s consort, and keep the waters of {isle} clear of her.',
        'В сумерках из глубины выходит флот Вдовы, все фонари зелёные, — погасить свет навсегда. Аврора держит стены, море за вами. Прорвите строй, возьмите спутника её флагмана и не подпускайте её к острову {isle}.',
      ],
      d: [
        'The light holds. In its beam, far below, everyone sees the roofs of a drowned city and a glimmer in its cathedral. “The Grail,” Aurora says. “Lead, captain. The Order will follow you to it.”',
        'Свет выстоял. В его луче, далеко внизу, все видят крыши утонувшего города и отблеск в его соборе. «Грааль, — говорит Аврора. — Ведите, капитан. Орден пойдёт за вами до него».',
      ],
      s: ['sink:6:ghost', 'board:2', 'isle', 'hub'],
    },
  ],
};
