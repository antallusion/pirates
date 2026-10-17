// Chapter 20 — Slagport (Act IV, Ash and the Code). The Code's powder mills and the Choir's sabotage; a bell cast in
// the Code's own foundry; the fireship. The Code has powder now, and no ships (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 20,
  region: 'ashen_isles',
  hub: 'slagport',
  title: ['Slagport', 'Шлаковый порт'],
  blurb: [
    'Foundries on black sand, powder mills under the smoking cone, and a saboteur of the Choir on every third shift. The Code’s war will be fought with what is made here — if anything is left of it.',
    'Литейные на чёрном песке, пороховые мельницы под дымящимся конусом и диверсант Хора в каждой третьей смене. Войну Кодекса будут вести тем, что сделано здесь, — если отсюда хоть что-нибудь останется.',
  ],
  giver: ['Bettany Crake, powder-mistress of the Code', 'Беттани Крейк, пороховых дел мастерица Кодекса'],
  portrait: 'giver_apothecary_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['A Fuse of Bell-Rope', 'Запал из колокольной верёвки'],
      b: [
        'Bettany Crake stands in the ruin of the eastern mill with her eyebrows singed off. The men who fired it fled in a boat toward {isle}, and she wants them before they reach the open sea.',
        'Беттани Крейк стоит на пепелище восточной мельницы с опалёнными бровями. Те, кто её поджёг, ушли на лодке к острову {isle}, и она хочет получить их прежде, чем они выйдут в открытое море.',
      ],
      d: [
        'In the boat’s bilge: a coil of slow-match, plaited from old bell-rope.',
        'На дне лодки — бухта фитиля, сплетённого из старой колокольной верёвки.',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['Seawater in the Casks', 'Морская вода в бочонках'],
      b: [
        'Half the new casks came up wet, and wet powder is no powder at all. Someone is boring the staves and filling them with brine. Bettany wants to know who sells the casks at {port}.',
        'Половина новых бочонков отсырела, а сырой порох — уже не порох. Кто-то сверлит клёпки и заливает рассол. Беттани хочет знать, кто продаёт бочонки в порту {port}.',
      ],
      d: [
        'The cooper was paid in old Crown silver, and he has already fled the town.',
        'Бондарю заплатили старым серебром Короны, и он уже сбежал из города.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Yellow Cargo', 'Жёлтый груз'],
      b: [
        'The mills eat sulphur by the ton, and the ore boats keep vanishing on the run in. Load the next cargo at {port} yourself and bring it to the stamping mill at {port2}.',
        'Мельницы пожирают серу тоннами, а рудные лодки то и дело пропадают на подходе. Примите следующий груз в порту {port} сами и доставьте его на толчею в порт {port2}.',
      ],
      d: [
        'The stamps start up again with a noise like a broadside that never ends.',
        'Толчея снова оживает с грохотом, похожим на бесконечный бортовой залп.',
      ],
      s: ['carry:sulfur_iron'],
    },
    {
      t: ['Coal for the Foundry', 'Уголь для литейной'],
      b: [
        'The gun foundry burns coal day and night, and the colliers are being picked off by pirates who sell what they steal to the Choir. Clear the road, and bring coal before the furnaces go cold.',
        'Пушечная литейная жжёт уголь круглые сутки, а угольщиков перехватывают пираты, что сбывают награбленное Хору. Расчистите дорогу и привезите уголь, пока печи не остыли.',
      ],
      d: [
        'The furnace doors open, and the whole quay goes orange in the glare.',
        'Заслонки печей распахиваются, и вся пристань окрашивается оранжевым.',
      ],
      s: ['sink:2:pirate', 'bring:coal'],
    },
    {
      t: ['A Bell in the Mould', 'Колокол в литейной форме'],
      b: [
        'Bettany found it at dawn in the foundry pit: a bell, cast in the night from the Code’s own bronze. The night crew has gone to ground with the smugglers on {isle}.',
        'Беттани нашла его на рассвете в литейной яме: колокол, отлитый ночью из бронзы самого Кодекса. Ночная смена укрылась у контрабандистов на острове {isle}.',
      ],
      d: [
        'The casters swear they never knew what they made. They only heard it ring once, and wept.',
        'Литейщики клянутся, что не знали, что отливают. Они лишь раз услышали, как он звонит, и заплакали.',
      ],
      s: ['land:smugglers', 'hub'],
    },
    {
      t: ['The Night Shift', 'Ночная смена'],
      b: [
        'Bettany has doubled the guard ashore, but the mills face the sea, and a boat can come in under the smoke. Keep the water in front of them for one night, and sink anything without a lantern.',
        'Беттани удвоила стражу на берегу, но мельницы смотрят на море, и лодка может подойти под прикрытием дыма. Держите воду перед ними одну ночь и топите всё, что идёт без огня.',
      ],
      d: [
        'Two boats came in dark. Both carried barrels of oil and nothing else.',
        'Две лодки шли без огней. В обеих — бочки с маслом и больше ничего.',
      ],
      s: ['escort', 'sink:2'],
    },
    {
      t: ['Barges of Brimstone', 'Серные баржи'],
      b: [
        'The Choir has started boarding the Code’s sulphur barges at sea and dumping the cargo over the side. Bettany says the Code answers in kind. Board theirs.',
        'Хор начал брать серные баржи Кодекса на абордаж и сбрасывать груз за борт. Беттани говорит, что Кодекс отвечает тем же. Берите их корабли.',
      ],
      d: [
        'The Choir’s ships are towed into the harbour, and the Code’s captains cheer from the foundry roofs.',
        'Корабли Хора буксируют в гавань, и капитаны Кодекса кричат «ура» с крыш литейных.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Not All in One Place', 'Не всё в одном месте'],
      b: [
        'Bettany will not keep every cask in one town again. She asks you to dig a powder store into the rock of your hidden island, and to see the first powder hoys safely there.',
        'Беттани больше не станет держать все бочонки в одном городе. Она просит вырубить в скале вашего тайного острова пороховой погреб и проводить туда первые пороховые суда.',
      ],
      d: [
        'Behind three iron doors in the rock, the Code’s powder sleeps where no saboteur can reach it.',
        'За тремя железными дверями в скале порох Кодекса спит там, куда не доберётся ни один диверсант.',
      ],
      s: ['build', ['escort', 'See the powder hoys to your island for {n} min.', 'Проводите пороховые суда к своему острову: {n} мин.']],
    },
    {
      t: ['Doubts in the Caldera', 'Сомнения в кальдере'],
      b: [
        'Word has gone round {at} that the mill burned on your watch, and some of Morrow’s captains are saying it aloud. Morrow wants you there in person, to answer them to their faces.',
        'В порту {at} пошли разговоры, что мельница сгорела у вас на глазах, и кое-кто из капитанов Морроу говорит это вслух. Морроу хочет, чтобы вы явились туда сами и ответили им в лицо.',
      ],
      d: [
        'You lay the bell-rope fuse on the council table. The loudest captain goes quiet.',
        'Вы кладёте на стол совета фитиль из колокольной верёвки. Самый громкий из капитанов умолкает.',
      ],
      s: ['at:cinderhold', 'hub'],
    },
    {
      t: ['The Mill Clerk', 'Писарь мельниц'],
      b: [
        'Every attack has struck the mills on a night the guard was changing. Only the clerk who writes the rosters knew. He sailed this morning for {port}, with a satchel he would not let out of his hand.',
        'Каждый удар приходился на ночь смены караула. Знал об этом лишь писарь, составлявший расписание. Утром он отплыл в порт {port} с сумкой, которую не выпускал из рук.',
      ],
      d: [
        'In the satchel, every roster for a year, copied out fair for the Choir.',
        'В сумке — все расписания за год, начисто переписанные для Хора.',
      ],
      s: ['port', 'board:1'],
    },
    {
      t: ['Timber for the Mills', 'Лес для мельниц'],
      b: [
        'The eastern mill must be rebuilt, and the Code pays for its timber the way it pays for everything: with tribute from the merchants who pass the cone. Collect the tribute, then bring the timber.',
        'Восточную мельницу надо отстраивать, и Кодекс платит за лес так же, как за всё прочее, — данью с купцов, что проходят мимо вулкана. Соберите дань, потом привезите лес.',
      ],
      d: [
        'The new mill-wheel turns for the first time, and Bettany pours a cup of rum into the race for luck.',
        'Новое мельничное колесо делает первый оборот, и Беттани на удачу выливает в лоток кружку рома.',
      ],
      s: ['tribute', 'bring:timber'],
    },
    {
      t: ['Black Glass Timers', 'Часы из чёрного стекла'],
      b: [
        'One of the saboteurs’ boats sank off {isle} before it could be taken. Bettany thinks the Choir times its charges with something cleverer than a fuse. Send your divers down to the wreck.',
        'Одна из лодок диверсантов затонула у острова {isle}, прежде чем её успели взять. Беттани думает, что Хор отмеряет время зарядов чем-то похитрее фитиля. Спустите водолазов к затонувшей лодке.',
      ],
      d: [
        'An hourglass of black glass: it runs only while a bell is ringing somewhere far away.',
        'Песочные часы из чёрного стекла: песок в них сыплется, лишь пока где-то далеко звонит колокол.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['Hunters at the Harbour Mouth', 'Охотники у входа в гавань'],
      b: [
        'The Choir has hired hunters to wait outside the harbour and pick off the powder ships one by one. Bettany will not send another cargo out until they are gone.',
        'Хор нанял охотников, чтобы те караулили у входа в гавань и топили пороховые суда по одному. Беттани не отправит больше ни одного груза, пока они там.',
      ],
      d: [
        'The harbour mouth is clear. The first powder ship sails with a cheer from the quay.',
        'Вход в гавань чист. Первое пороховое судно уходит под крики с пристани.',
      ],
      s: ['sink:3:hunter', 'hub'],
    },
    {
      t: ['Long Guns for the Line', 'Длинные пушки для линии'],
      b: [
        'The foundry has cast twenty long guns for the Code’s new line of battle, waiting at {port}. The captains at {port2} have hulls and no guns. Carry them across, and come back for the next order.',
        'Литейная отлила двадцать длинных пушек для новой боевой линии Кодекса; они ждут в порту {port}. У капитанов в порту {port2} есть корпуса, но нет пушек. Перевезите их и возвращайтесь за следующим заказом.',
      ],
      d: [
        'Twenty guns are run out on new carriages. Bettany fires the first herself.',
        'Двадцать пушек выкатывают на новых лафетах. Первую Беттани стреляет сама.',
      ],
      s: ['carry:weapons', 'hub'],
    },
    {
      t: ['The Choir’s Founder', 'Литейщик Хора'],
      b: [
        'The casters named the man who taught them the bell’s shape: a founder of the Choir who sails between the islands in a ship of his own. Take him alive, and sink the escort that guards him.',
        'Литейщики назвали человека, что научил их форме колокола: литейщика Хора, который ходит между островами на собственном корабле. Возьмите его живым и потопите охрану.',
      ],
      d: [
        'He smiles in chains: “One bell more or less. The song is already written.”',
        'Он улыбается в кандалах: «Одним колоколом больше, одним меньше. Песня уже написана».',
      ],
      s: ['board:1', 'sink:2'],
    },
    {
      t: ['Things in the Slag', 'Твари в шлаке'],
      b: [
        'The sulphur diggers on {isle} have refused to go back down the pits. Something has made its lairs in the warm slag, and it comes out at the change of shift.',
        'Копатели серы на острове {isle} отказываются спускаться в шахты. В тёплом шлаке завелись твари со своими логовами, и выходят они на смене.',
      ],
      d: [
        'The diggers go back down with lanterns, singing to keep their courage up.',
        'Копатели спускаются обратно с фонарями и поют, чтобы не робеть.',
      ],
      s: ['land', 'lair'],
    },
    {
      t: ['The Cone Coughs', 'Вулкан кашляет'],
      b: [
        'The cone threw up a cloud of ash at noon, and a wave of hot water swept the boats of the diggers’ families out to sea. They are still out there in the grey.',
        'В полдень вулкан выбросил тучу пепла, и волна горячей воды унесла в море лодки с семьями копателей. Они всё ещё где-то там, в сером мареве.',
      ],
      d: [
        'The families come ashore coughing, children wrapped in your crew’s coats.',
        'Семьи выходят на берег, кашляя, а дети закутаны в куртки вашей команды.',
      ],
      s: ['rescue', 'hub'],
    },
    {
      t: ['The Brimstone Road', 'Серная дорога'],
      b: [
        'The finest powder on the sea is ground at {at}, and Bettany wants a shipment of it for the Code’s flagships. The convoy will come in only under a strong escort.',
        'Лучший порох на всём море мелют в порту {at}, и Беттани хочет получить партию для флагманов Кодекса. Обоз пойдёт лишь под сильной охраной.',
      ],
      d: [
        'The convoy comes in whole. Bettany tastes a pinch of the powder and nods.',
        'Обоз приходит целым. Беттани пробует щепотку пороха на язык и кивает.',
      ],
      s: ['at:brimstone_bay', 'escort'],
    },
    {
      t: ['Reefs of Fire', 'Огненные рифы'],
      b: [
        'New lava reefs have risen across the approaches since the cone coughed, and the powder ships will tear their bottoms out on them. Chart what has come up from the sea.',
        'С тех пор как вулкан кашлянул, на подходах поднялись новые лавовые рифы, и пороховые суда распорют о них днища. Нанесите на карту всё, что вышло из моря.',
      ],
      d: [
        'Bettany posts your chart at the harbour mouth. Not one hull is holed that month.',
        'Беттани вешает вашу карту у входа в гавань. В тот месяц не пробит ни один корпус.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Saboteurs’ Nest', 'Гнездо диверсантов'],
      b: [
        'The mill clerk’s papers name the place the saboteurs sail from: a ruined chapel on {isle}, where the Choir trains them. Look it over, land, and sink the boats in its cove.',
        'Бумаги писаря называют место, откуда выходят диверсанты: разрушенную часовню на острове {isle}, где Хор их обучает. Осмотритесь, высадитесь и потопите лодки в её бухте.',
      ],
      d: [
        'On the chapel wall, a plan of the main mill, with one quay ringed in grey.',
        'На стене часовни — план главной мельницы, и одна пристань обведена серым.',
      ],
      s: ['isle', 'land:ruins', 'sink:2'],
    },
    {
      t: ['The Fireship', 'Брандер'],
      b: [
        'The quay ringed in grey is the one beside the great powder store. At dusk a hulk comes out of the smoke under full sail, her decks stacked with casks and a bell ringing in her bow. Board her before she touches.',
        'Обведённая серым пристань — та, что у главного порохового склада. В сумерках из дыма выходит старый корпус под всеми парусами; палуба заставлена бочонками, а на носу звонит колокол. Возьмите его на абордаж, пока он не коснулся причала.',
      ],
      d: [
        'You cut the fuse a hand’s breadth from the casks. Bettany sits down on the quay and laughs until she cries. “Powder we have now,” she says. “Ships, we have not. And she knows it.”',
        'Вы перерезаете фитиль в ладони от бочонков. Беттани садится прямо на пристань и смеётся до слёз. «Порох у нас теперь есть, — говорит она. — А кораблей нет. И она это знает».',
      ],
      s: ['sink:3', 'board:1', 'escort', 'hub'],
    },
  ],
};
