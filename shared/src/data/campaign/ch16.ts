// Chapter 16 — The Gates Close (Act III, the Northern Waters). The siege of the Harpoon Order's town; the Bell-Warden's
// flagship taken by boarding and the second drowned bell won (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 16,
  region: 'leviathan_reach',
  hub: 'frostgate',
  title: ['The Gates Close', 'Ворота закрываются'],
  blurb: [
    'The Bell-Warden has come back for the town that defied him. The fjord freezes shut, the try-works burn day and night, and at the mouth of the ice his flagship rings a bell that cracks the floes.',
    'Звонарь вернулся за городом, который посмел ему отказать. Фьорд смерзается, салотопни горят днём и ночью, а в устье льда его флагман бьёт в колокол, от которого трескаются льдины.',
  ],
  giver: ['Eirik Sund, marshal of the Harpoon Order', 'Эйрик Сунд, маршал Гарпунного ордена'],
  portrait: 'giver_garrison_captain_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Nine Sails in the Fjord', 'Девять парусов во фьорде'],
      b: [
        'Marshal Eirik Sund meets you on the ice-boom with a spyglass frozen to his glove. Nine sails stand off {isle}, and their pickets already cut the sledge road. Count them, and drive the pickets off.',
        'Маршал Эйрик Сунд встречает вас на ледяном боне; подзорная труба примёрзла к его перчатке. У острова {isle} стоят девять парусов, и их дозоры уже перерезали санный путь. Пересчитайте их и отгоните дозорных.',
      ],
      d: [
        'Nine sails, and among them a black flagship with a bell slung under her bowsprit.',
        'Девять парусов, а среди них чёрный флагман с колоколом, подвешенным под бушпритом.',
      ],
      s: ['isle', 'sink:2', 'hub'],
    },
    {
      t: ['Links for the Boom', 'Звенья для бона'],
      b: [
        'At night the Bell-Warden’s sawyers creep out in a launch and file through the chain that holds the fjord. Take their launch, and bring iron so the Order’s smiths can forge new links before the ice gives way.',
        'По ночам пильщики Звонаря подбираются на баркасе и перепиливают цепь, что держит фьорд. Захватите их баркас и привезите железо, чтобы кузнецы ордена выковали новые звенья, пока лёд не поддался.',
      ],
      d: [
        'The new links ring under the hammers all night. The boom holds.',
        'Новые звенья всю ночь звенят под молотами. Бон держится.',
      ],
      s: ['board:1', 'bring:iron'],
    },
    {
      t: ['Oil for the Walls', 'Ворвань для стен'],
      b: [
        'The try-works are the town’s heart: they light the walls and keep the harbour from freezing solid. The whales fled the bell’s ringing under the ice, and the vats are nearly dry. Hunt them where they have gone.',
        'Салотопни — сердце города: они освещают стены и не дают гавани промёрзнуть насквозь. Киты ушли от звона подо льдом, и чаны почти пусты. Добудьте их там, куда они ушли.',
      ],
      d: [
        'The fires under the vats roar again, and the walls are lit to the last tower.',
        'Под чанами снова гудит огонь, и стены освещены до последней башни.',
      ],
      s: ['beast:whale', 'hub'],
    },
    {
      t: ['Orcas in the Wake', 'Косатки в кильватере'],
      b: [
        'Orcas follow the Bell-Warden’s ships like hounds, maddened by the toll, and ram any boat that strays from the ice. A sealer’s skiff went over this morning with four men aboard.',
        'Косатки идут за кораблями Звонаря, как гончие, обезумев от звона, и таранят любую лодку, что отходит ото льда. Утром перевернулся ялик зверобоев, а в нём четверо.',
      ],
      d: [
        'The pack is broken, and the sealers are hauled out blue with cold but breathing.',
        'Стая разбита, а зверобоев вытаскивают из воды — синих от холода, но живых.',
      ],
      s: ['beast:orca', 'rescue'],
    },
    {
      t: ['Men of the North', 'Люди севера'],
      b: [
        'Hunters and sealers have come down to {port} from the far floes, angry that the bell has driven off the game. Sund says a man who has speared a walrus does not fear a boarding pike. Sign them on.',
        'С дальних льдов в порт {port} спустились охотники и зверобои: звон распугал всю добычу, и они злы. Сунд говорит, что тот, кто бил моржа острогой, абордажной пики не испугается. Наберите их.',
      ],
      d: [
        'They come aboard in furs, with their own harpoons, and ask only where the enemy is.',
        'Они поднимаются на борт в мехах, со своими гарпунами, и спрашивают только, где враг.',
      ],
      s: ['port', 'recruit', 'hub'],
    },
    {
      t: ['The Sledge Depot', 'Санный склад'],
      b: [
        'The Order keeps a depot of food and furs on {isle}, where the sledges rest on their way in. The bell has woken the creatures of the ice, and now they have dug into the stores.',
        'У ордена на острове {isle} склад провизии и мехов: там отдыхают сани на пути в город. Звон разбудил ледяных тварей, и теперь они зарылись прямо в припасы.',
      ],
      d: [
        'The lairs are cleared, and the first sledges are already loading at the depot.',
        'Логова разорены, и на складе уже грузят первые сани.',
      ],
      s: ['land', 'lair'],
    },
    {
      t: ['Bread Through the Ice', 'Хлеб сквозь лёд'],
      b: [
        'The town has bread for nine days. A grain ship waits at {port}, but no merchant will sail the last leg past the siege. Load her stores yourself and run them to {port2}, where the Order’s sledges can reach them.',
        'Хлеба в городе на девять дней. В порту {port} ждёт хлебное судно, но ни один купец не решится пройти мимо осады. Примите груз сами и доставьте его в порт {port2}, куда могут дойти сани ордена.',
      ],
      d: [
        'The sledges come in at dusk, and the bakers of {hub} light their ovens for the first time in a week.',
        'Сани приходят в сумерках, и пекари в порту {hub} впервые за неделю растапливают печи.',
      ],
      s: ['carry:provisions', 'hub'],
    },
    {
      t: ['A Deserter in a Mask', 'Дезертир в маске'],
      b: [
        'A ringer of the Choir slipped off the Bell-Warden’s ship and swam for the fishers’ huts on {isle}. He still wears his grey mask and will speak only to the captain who broke the ice fortress.',
        'Звонарь из Хора сбежал с корабля Эзры Велла и доплыл до рыбацких хижин на острове {isle}. Он до сих пор в серой маске и говорить согласен только с тем капитаном, что взял ледяную крепость.',
      ],
      d: [
        'He names the flagship, the Mourning Toll, and says the bell in her hold was raised from the belfry under the ice.',
        'Он называет флагман — «Поминальный звон» — и говорит, что колокол в его трюме подняли из колокольни подо льдом.',
      ],
      s: ['land:fishers', 'hub'],
    },
    {
      t: ['The Mourning Toll', 'Поминальный звон'],
      b: [
        'The flagship lies in the lee of {isle}, out of range of the walls. Sund wants to know her habits before he spends a single man on her: when she rings, and what happens when she does.',
        'Флагман стоит под прикрытием острова {isle}, вне досягаемости стен. Прежде чем тратить на него хоть одного человека, Сунд хочет знать его повадки: когда он звонит и что случается, когда он звонит.',
      ],
      d: [
        'She rings at each turn of the tide, and at every stroke a new crack runs through the ice toward the town.',
        'Он звонит на каждой смене прилива, и с каждым ударом к городу по льду бежит новая трещина.',
      ],
      s: ['isle', 'escort', 'hub'],
    },
    {
      t: ['The Ice-Cutters', 'Ледорезы'],
      b: [
        'Following the cracks, squat hulks with iron-shod bows are cutting a channel toward the harbour wall. Sink them before the channel is wide enough for the flagship, and take one whole for the Order to study.',
        'Вслед за трещинами к стене гавани пробивают канал приземистые громады с окованными форштевнями. Потопите их, пока канал не стал шире флагмана, а одну возьмите целой, чтобы орден её изучил.',
      ],
      d: [
        'The captured cutter has a bell-rope run from her bow to her helm: she steers by the toll.',
        'На захваченном ледорезе от форштевня к штурвалу протянута колокольная верёвка: он идёт на звон.',
      ],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['A Dry Magazine', 'Сухой погреб'],
      b: [
        'Frost sweats into the casks and the Order’s powder cakes like wet sand. Sund asks you to lay a dry magazine on your own hidden island, far to the south, and bring good powder north from it.',
        'Мороз оседает в бочонках, и порох ордена слёживается, как мокрый песок. Сунд просит заложить сухой пороховой погреб на вашем тайном острове, далеко на юге, и везти оттуда на север хороший порох.',
      ],
      d: [
        'Your powder runs black and loose through Sund’s fingers. He smiles for the first time in a month.',
        'Ваш порох течёт сквозь пальцы Сунда чёрный и сыпучий. Маршал впервые за месяц улыбается.',
      ],
      s: ['build', 'bring:gunpowder'],
    },
    {
      t: ['Coal for the Choir', 'Уголь для Хора'],
      b: [
        'The Bell-Warden’s ships burn coal in braziers on deck to keep their ringers alive through the nights. Colliers bring it in under the Choir’s grey pennant. Take them, and let the court of prizes have their hulls.',
        'Корабли Звонаря жгут уголь в жаровнях на палубе, чтобы их звонари пережили ночь. Угольщики идут под серым вымпелом Хора. Захватите их и отдайте корпуса призовому суду.',
      ],
      d: [
        'Tonight the decks off the fjord are dark and cold, and the toll comes slower.',
        'Этой ночью палубы у фьорда темны и холодны, и звон звучит реже.',
      ],
      s: ['board:2', 'prize'],
    },
    {
      t: ['Chimes on the Ice', 'Колокольцы на льду'],
      b: [
        'Runners crossing the ice at night follow a chime that sounds like the town’s own bell, and walk off the edge. Sund has traced the sound to an old shrine on {isle}. Find what rings there.',
        'Гонцы, что ночью идут по льду, слышат звон, похожий на городской колокол, и уходят за край полыньи. Сунд проследил звук до старого святилища на острове {isle}. Выясните, что там звонит.',
      ],
      d: [
        'Dozens of small bells hang from the shrine’s eaves, tuned to the very note of the town’s bell.',
        'Под стрехой святилища висят десятки колокольчиков, настроенных точно в тон городскому колоколу.',
      ],
      s: ['isle', 'land:shrine'],
    },
    {
      t: ['Channels the Bell Made', 'Протоки, что пробил звон'],
      b: [
        'Every stroke of the bell has opened new leads in the ice, and some of them run behind the enemy’s line. Chart what the ice has opened, and Sund will know where a ship could slip around the siege.',
        'Каждый удар колокола открывает во льду новые разводья, и некоторые из них уходят за вражескую линию. Нанесите на карту то, что открыл лёд, и Сунд узнает, где корабль может обойти осаду.',
      ],
      d: [
        'Sund pins your chart over the war-table and draws one long line behind the flagship.',
        'Сунд прибивает вашу карту над столом совета и проводит одну длинную черту за флагманом.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Sealers’ Boats', 'Лодки зверобоев'],
      b: [
        'The sealers of {at} promised the Order every boat they have, if someone will bring them through the floes alive. Sund cannot spare a ship. You can.',
        'Зверобои из порта {at} пообещали ордену все свои лодки — если кто-нибудь проведёт их сквозь льды живыми. Сунду некого послать. А вам есть с кем идти.',
      ],
      d: [
        'Thirty boats come in behind your stern, each with a harpoon gun lashed to the bow.',
        'За вашей кормой в гавань входят тридцать лодок, и на носу у каждой принайтовлена гарпунная пушка.',
      ],
      s: ['at:sealhold', ['escort', 'See the sealers’ boats through the ice for {n} min.', 'Проведите лодки зверобоев сквозь льды: {n} мин.']],
    },
    {
      t: ['The Night Sortie', 'Ночная вылазка'],
      b: [
        'Sund will lead the sealers’ boats out under the dark of the moon to burn the enemy’s pickets. He needs a real ship among them to take the guard-boats before they can ring the alarm.',
        'Сунд поведёт лодки зверобоев в безлунную ночь, чтобы сжечь вражеские дозоры. Ему нужен среди них настоящий корабль, чтобы взять сторожевые лодки, пока они не подняли тревогу.',
      ],
      d: [
        'The pickets burn, and not one bell rang out before they did.',
        'Дозоры горят, и ни один колокол не успел ударить.',
      ],
      s: ['board:2', 'sink:2', 'hub'],
    },
    {
      t: ['The Holed Whaler', 'Пробитый китобой'],
      b: [
        'A whaler that tried to run the siege is settling by the stern with her crew in the rigging. The surgeons of {at} have room for them, if you can pull them out of the water in time.',
        'Китобой, что пытался прорвать осаду, оседает на корму, а его команда висит на вантах. У лекарей в порту {at} найдутся для них койки — если вы успеете вытащить их из воды.',
      ],
      d: [
        'The surgeons take them in. The whaler’s mate gives you his harpoon in thanks.',
        'Лекари принимают их. Помощник китобоя в благодарность отдаёт вам свой гарпун.',
      ],
      s: ['rescue', 'at:harpoon_rest'],
    },
    {
      t: ['The Empty Cradle', 'Пустая люлька'],
      b: [
        'Sund wants proof before he risks his fleet: is the bell really aboard the flagship? Send your divers down to the drowned belfry off {isle} and look at the place where it hung.',
        'Прежде чем рисковать флотом, Сунд хочет доказательств: действительно ли колокол на флагмане? Спустите водолазов к затонувшей колокольне у острова {isle} и осмотрите место, где он висел.',
      ],
      d: [
        'The cradle is empty, its chains sawn through. Fresh rope fibre still hangs in the beam.',
        'Люлька пуста, цепи перепилены. На балке ещё висят свежие волокна каната.',
      ],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['A Sword for Hire', 'Наёмный клинок'],
      b: [
        'One of the captains guarding the flagship is no ringer, only a wanted pirate who sold his guns to the Bell-Warden. The hunters have a price on his head. Take it, and the flagship loses a flank.',
        'Один из капитанов, что охраняют флагман, вовсе не звонарь, а разыскиваемый пират, продавший свои пушки Звонарю. За него назначена награда. Заберите её — и флагман лишится фланга.',
      ],
      d: [
        'His ship goes down, and the gap he leaves in the line is plain from the walls.',
        'Его корабль уходит на дно, и брешь в линии видна со стен невооружённым глазом.',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['Fireships of Oil', 'Брандеры на ворвани'],
      b: [
        'Sund’s plan is old and simple: three hulks soaked in whale oil, drifted into the escort on the night wind. Bring the oil, then break the escort ships that will try to turn the fire away.',
        'План Сунда стар и прост: три старых корпуса, пропитанных ворванью, ночным ветром несёт на охрану. Привезите ворвань, а потом разбейте корабли охраны, что попытаются отвести огонь.',
      ],
      d: [
        'Three fires drift down the fjord. When they burn out, the flagship stands alone.',
        'По фьорду плывут три пожара. Когда они догорают, флагман остаётся один.',
      ],
      s: ['bring:whale_oil', 'sink:3'],
    },
    {
      t: ['The Breach', 'Пролом'],
      b: [
        'At midnight the Mourning Toll rings thirteen times, and the boom tears loose with a sound like a gun. The Choir’s boats are pouring into the gap. Hold the harbour mouth until dawn.',
        'В полночь «Поминальный звон» бьёт тринадцать раз, и бон срывается с грохотом, будто выстрел. В пролом валят лодки Хора. Удержите вход в гавань до рассвета.',
      ],
      d: [
        'At first light the gap is choked with wreckage, and the town is still the Order’s.',
        'На рассвете пролом завален обломками, а город всё ещё принадлежит ордену.',
      ],
      s: ['escort', 'sink:3'],
    },
    {
      t: ['The Second Bell', 'Второй колокол'],
      b: [
        'At dawn the flagship comes in through the broken ice by the channel the cutters made, her bell tolling at every stroke of her sweeps. Sund puts every harpooneer he has on your deck. “Take her,” he says, “and the gates stay ours.”',
        'На рассвете флагман входит по каналу ледорезов сквозь разбитый лёд, и колокол бьёт на каждый взмах его вёсел. Сунд ставит на вашу палубу всех своих гарпунщиков. «Возьмите его, — говорит он, — и ворота останутся за нами».',
      ],
      d: [
        'The bell is yours, chained in the vault under the try-works. The Bell-Warden went over the side into the fog and left only his mask on the deck — and set inside it, a lens of black glass.',
        'Колокол ваш: его заковали в подвале под салотопнями. Звонарь ушёл за борт в туман и оставил на палубе лишь маску, а в ней — линзу из чёрного стекла.',
      ],
      s: ['isle', 'sink:4', 'board:2', 'hub'],
    },
  ],
};
