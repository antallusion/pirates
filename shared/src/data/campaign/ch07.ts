// Chapter 7 — Copperhook (Act II, The Merchants' Road). Gideon Farr's convoy war; a forced alliance with Corvin Hale,
// and his fate (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 7,
  region: 'gravewater',
  hub: 'copperhook',
  title: ['Copperhook', 'Медный Крюк'],
  blurb: [
    'Green copper roofs, cranes over every quay, and a convoy road the Choir’s hired wolves are closing ship by ship. To keep it open you will have to sail beside Corvin Hale, and then decide what he is worth.',
    'Позеленевшие медные крыши, краны над каждым причалом и конвойная дорога, которую наёмные волки Хора закрывают корабль за кораблём. Чтобы удержать её, придётся идти бок о бок с Корвином Хейлом — а потом решить, чего он стоит.',
  ],
  giver: ['Gideon Farr, convoy master', 'Гидеон Фарр, конвойный мастер'],
  portrait: 'giver_garrison_captain_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['The Convoy Road', 'Конвойная дорога'],
      b: [
        'Under the green copper roofs of {hub}, the convoy master Gideon Farr has lost four convoys this season and all his patience with them. He will hear about the Choir’s silver only after you have seen one convoy home.',
        'Под позеленевшими медными крышами порта {hub} конвойный мастер Гидеон Фарр потерял в этом сезоне четыре конвоя и всякое терпение. О серебре Хора он станет слушать только после того, как вы приведёте домой хотя бы один конвой.',
      ],
      d: ['The convoy comes in whole. Farr pours two glasses and asks to see the ledgers.', 'Конвой приходит целым. Фарр наливает два стакана и просит показать книги.'],
      s: ['escort', 'hub'],
    },
    {
      t: ['Iron for the Cranes', 'Железо для кранов'],
      b: [
        'The cranes of {hub} stand idle: the iron for their chains lies in {port}, and no master will sail it without an escort. Farr wants it carried to {port2}, where his smiths are waiting.',
        'Краны порта {hub} стоят без дела: железо для их цепей лежит в порту {port}, и ни один шкипер не повезёт его без охраны. Фарр хочет доставить его в порт {port2}, где ждут его кузнецы.',
      ],
      d: ['By the week’s end the cranes are swinging again, and their chains ring like bells.', 'К концу недели краны снова поворачиваются, а их цепи звенят, как колокола.'],
      s: ['carry:iron'],
    },
    {
      t: ['Grey Pennants', 'Серые вымпелы'],
      b: [
        'The pirates who hunt the convoy road fly no colours now, only grey pennants. Farr wants one of their captains taken alive, to learn who pays him.',
        'Пираты, что охотятся на конвойной дороге, больше не поднимают флагов — только серые вымпелы. Фарр хочет взять живым одного из их капитанов, чтобы узнать, кто ему платит.',
      ],
      d: [
        'His pay chest holds old Crown silver, so fresh from the die that it still smells of the forge.',
        'В его сундуке старое серебро Короны — настолько свежей чеканки, что ещё пахнет кузней.',
      ],
      s: ['sink:3:pirate', 'board:1'],
    },
    {
      t: ['A Heron in the Convoy', 'Цапля в конвое'],
      b: [
        'A brig with a heron on her flag limps into the convoy’s wake, her mainmast gone and three grey ships on her heels. Corvin Hale is asking, politely as ever, for help.',
        'В кильватер конвоя, хромая, входит бриг с цаплей на флаге: грот-мачты нет, на хвосте три серых корабля. Корвин Хейл, как всегда учтиво, просит о помощи.',
      ],
      d: [
        'Hale climbs aboard soaked to the skin, the ledgers in oilskin against his chest. “I believe,” he says, “we are on the same side for once.”',
        'Хейл поднимается на борт, промокший до нитки, прижимая к груди книги в промасленной ткани. «Похоже, — говорит он, — на этот раз мы на одной стороне».',
      ],
      s: ['sink:3', 'rescue'],
    },
    {
      t: ['The Price of Shelter', 'Цена убежища'],
      b: [
        'Farr will shelter Hale’s brig in {hub} only if you vouch for him, and you will vouch for nothing until the scrap he stole is back in Isolde’s hands at {at}.',
        'Фарр приютит бриг Хейла в порту {hub}, только если вы за него поручитесь, а вы не поручитесь ни за что, пока украденный обрывок не вернётся в руки Изольды в порту {at}.',
      ],
      d: [
        'Hale hands the scrap over with a bow. Isolde takes it without a word, and counts its corners.',
        'Хейл с поклоном отдаёт обрывок. Изольда молча берёт его и пересчитывает уголки.',
      ],
      s: ['at:hollowmere', 'hub'],
    },
    {
      t: ['A Mast for the Heron', 'Мачта для «Цапли»'],
      b: [
        'The Heron cannot fight without a mainmast, and Farr’s yard will not spend League timber on a man the League would gladly hang. Bring the timber yourself.',
        'Без грот-мачты «Цапля» не боец, а верфь Фарра не станет тратить лес Лиги на человека, которого Лига с радостью вздёрнула бы. Привезите лес сами.',
      ],
      d: ['The new mast goes up crooked by a hair. Hale says it gives her character.', 'Новая мачта встаёт чуть-чуть криво. Хейл говорит, что это придаёт бригу характер.'],
      s: ['bring:timber'],
    },
    {
      t: ['Where the Wolves Drink', 'Где пьют волки'],
      b: [
        'Hale knows where the grey-pennant pirates take on water: a camp on {isle}, where they share out the Choir’s silver once a month. He also knows the day.',
        'Хейл знает, где пираты с серыми вымпелами берут воду: в лагере на острове {isle}, где раз в месяц делят серебро Хора. Знает он и день.',
      ],
      d: [
        'The camp is burned and the silver shared out among Farr’s sailors. Hale keeps one coin, for luck.',
        'Лагерь сожжён, серебро роздано матросам Фарра. Хейл оставляет себе одну монету — на удачу.',
      ],
      s: ['land:pirate_camp', 'hub'],
    },
    {
      t: ['A Battery over the Road', 'Батарея над дорогой'],
      b: [
        'Your island lies a few hours from the convoy road. Farr offers League guns if you will lay a battery there and keep watch while the next convoy passes under it.',
        'Ваш остров лежит в нескольких часах хода от конвойной дороги. Фарр предлагает пушки Лиги, если вы поставите там батарею и проследите, как под ней пройдёт следующий конвой.',
      ],
      d: ['The new battery fires its first salute as the convoy goes by, and Farr’s merchants dip their flags.', 'Новая батарея даёт первый салют проходящему конвою, и купцы Фарра приспускают флаги.'],
      s: ['build', 'escort'],
    },
    {
      t: ['Ringing Under the Keel', 'Звон под килем'],
      b: [
        'Orcas follow the convoy road this year, drawn by a ringing under the water that only they can hear. They have holed two boats already, and the crews will not row out again.',
        'В этом году за конвойной дорогой следуют косатки: их манит звон под водой, который слышат только они. Две лодки они уже пробили, и команды больше не хотят садиться на вёсла.',
      ],
      d: [
        'When the orcas fall silent, so does the sea. Jory says he can still hear the ringing; nobody else can.',
        'Когда косатки затихают, затихает и море. Джори говорит, что всё ещё слышит звон; больше никто не слышит.',
      ],
      s: ['beast:orca'],
    },
    {
      t: ['Bronze Under the Iron', 'Бронза под железом'],
      b: [
        'Hale swears that one convoy in five carries bell-bronze for the Choir under House of Vane papers, and that Farr does not know. Prove it without starting a war with the League.',
        'Хейл клянётся, что каждый пятый конвой везёт колокольную бронзу для Хора по бумагам дома Вейна и что Фарр об этом не знает. Докажите это, не развязав войны с Лигой.',
      ],
      d: [
        'The bronze is there, under the iron. Farr reads the papers twice, then tears up his contract with the Vanes.',
        'Бронза на месте, под железом. Фарр дважды перечитывает бумаги, а потом рвёт свой договор с Вейнами.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['A Warrant for Hale', 'Ордер на Хейла'],
      b: [
        'A Crown frigate has put in at {port} with a warrant for Corvin Hale, thief of Admiralty property. Her commodore wants a word with whoever sails beside him.',
        'Королевский фрегат зашёл в порт {port} с ордером на арест Корвина Хейла, похитителя имущества Адмиралтейства. Его коммодор желает поговорить с тем, кто ходит с Хейлом бок о бок.',
      ],
      d: [
        'The commodore is courteous and patient. Hale can wait, he says, until the convoy road is clear. Not a day longer.',
        'Коммодор учтив и терпелив. Хейл может подождать, говорит он, пока конвойная дорога не очистится. Но ни днём дольше.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Grieve’s Anchorage', 'Стоянка Грива'],
      b: [
        'The grey-pennant fleet answers to one captain, Tollan Grieve, who keeps his ships off {isle} between raids. Hale wants to go in at night; Farr wants to go in at noon. You choose the hour.',
        'Флот серых вымпелов подчиняется одному капитану — Толлану Гриву, который между набегами держит корабли у острова {isle}. Хейл хочет напасть ночью, Фарр — в полдень. Час выбирать вам.',
      ],
      d: [
        'Grieve’s ships burn off {isle}. Grieve himself escapes in a boat, swearing that the Warden will hear of this.',
        'Корабли Грива горят у острова {isle}. Сам Грив уходит на шлюпке, клянясь, что Звонарь об этом узнает.',
      ],
      s: ['isle', 'sink:3:pirate', 'board:1'],
    },
    {
      t: ['The Great Convoy', 'Большой конвой'],
      b: [
        'The year’s great convoy, forty sail of copper, cloth and spice, leaves {hub} at the turn of the month. Farr asks you to lead it; Hale asks to ride on the flank.',
        'Главный конвой года — сорок вымпелов с медью, сукном и пряностями — выходит из порта {hub} в начале месяца. Фарр просит вас вести его, Хейл просит место на фланге.',
      ],
      d: [
        'Forty sail out, forty sail in. Hale is the first to raise his glass to you in Farr’s counting house.',
        'Сорок вымпелов ушло, сорок пришло. В конторе Фарра Хейл первым поднимает за вас бокал.',
      ],
      s: ['escort', 'sink:3:pirate', 'hub'],
    },
    {
      t: ['The Heron’s Head Start', 'Фора для «Цапли»'],
      alt: {
        key: 'hale',
        label: [['Let Hale go', 'Отпустить Хейла'], ['Hand him over', 'Сдать Адмиралтейству']],
        t: ['A Warrant Served', 'Ордер исполнен'],
        b: [
          'The commodore’s day has come. Hale knows it and makes sail at dusk. Take the Heron before she reaches open water, and bring her captain to the frigate at {port}.',
          'День коммодора настал. Хейл это знает и в сумерках ставит паруса. Возьмите «Цаплю», пока она не вышла в открытое море, и доставьте её капитана на фрегат в порт {port}.',
        ],
        d: [
          'Hale goes aboard the frigate in irons and looks back only once. “Next time,” he calls, “I shall bring the brandy.”',
          'Хейл поднимается на фрегат в кандалах и оглядывается лишь однажды. «В следующий раз, — кричит он, — бренди за мной».',
        ],
        s: ['board:1', 'port'],
      },
      b: [
        'The commodore’s day has come, and Hale knows it. He asks only for a head start. See the Heron safely past {isle}, and the frigate will find nothing but her wake.',
        'День коммодора настал, и Хейл это знает. Он просит лишь фору. Проводите «Цаплю» мимо острова {isle}, и фрегат найдёт только её кильватерный след.',
      ],
      d: [
        'Off {isle} Hale dips his flag to you and is gone into the rain. A heron’s feather lies on your chart table.',
        'У острова {isle} Хейл приспускает перед вами флаг и исчезает в дожде. На вашем штурманском столе лежит перо цапли.',
      ],
      s: ['escort', 'isle'],
    },
    {
      t: ['Grieve’s Last Hiding Place', 'Последнее укрытие Грива'],
      b: [
        'Grieve has come back with new ships and an old grudge, and he hides among the smugglers of {isle}, waiting for the Warden. Farr wants this finished.',
        'Грив вернулся с новыми кораблями и старой обидой и прячется у контрабандистов на острове {isle}, дожидаясь Звонаря. Фарр хочет с этим покончить.',
      ],
      d: [
        'Grieve is taken. He laughs: the Warden never wanted the road, only the bronze that went down with the ships.',
        'Грив схвачен. Он смеётся: Звонарю никогда не была нужна дорога — только бронза, ушедшая на дно вместе с кораблями.',
      ],
      s: ['land:smugglers', 'board:1'],
    },
    {
      t: ['New Roads for Old', 'Новые пути взамен старых'],
      b: [
        'With Grieve gone the road is open, but Farr will not trust it again. He asks you to chart islands off the old road, so that the convoys can change course each season and no one can sell it.',
        'Грива больше нет, и дорога открыта, но Фарр ей больше не доверяет. Он просит нанести на карту острова в стороне от старого пути, чтобы конвои каждый сезон меняли курс и никто не мог его продать.',
      ],
      d: [
        'Farr pays for the charts in copper and says the League owes you more than it will ever admit.',
        'Фарр платит за карты медью и говорит, что Лига обязана вам куда больше, чем когда-либо признает.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Bell on the Road', 'Колокол на дороге'],
      b: [
        'On the last night of the season a bell rings under the convoy road, and three of Farr’s ships turn towards {isle} as if their helmsmen were asleep. Grey ships wait there with grapples ready.',
        'В последнюю ночь сезона под конвойной дорогой звонит колокол, и три корабля Фарра поворачивают к острову {isle}, словно их рулевые спят. Там уже ждут серые корабли с абордажными кошками наготове.',
      ],
      d: [
        'The ships are saved and the grey ones taken. In the deepest hold hangs a bell cast this year, painted with a town on stilts and one word: “Come.”',
        'Корабли спасены, серые взяты. В самом глубоком трюме висит колокол, отлитый в этом году, а на нём нарисован город на сваях и одно слово: «Приди».',
      ],
      s: ['isle', 'board:2', 'dive', 'hub'],
    },
  ],
};
