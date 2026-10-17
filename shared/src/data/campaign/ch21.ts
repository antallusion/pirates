// Chapter 21 — Wreckhold (Act IV, Ash and the Code). The wreck-fleet: hulls raised from the reef, crews from nowhere,
// a fleet for the Code; it sails as the Choir falls on the Ashen Isles (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 21,
  region: 'dead_mans_expanse',
  hub: 'wreckhold',
  title: ['Wreckhold', 'Обломная Твердь'],
  blurb: [
    'A town built of the ships the reef took, and a bosun who swears he can build them back. The Code needs a fleet, and these waters are full of hulls that only look dead.',
    'Город, выстроенный из кораблей, что забрал риф, и боцман, который клянётся, что сумеет отстроить их заново. Кодексу нужен флот, а эти воды полны корпусов, которые лишь кажутся погибшими.',
  ],
  giver: ['Nils Kettle, bosun of the wreck-fleet', 'Нильс Кеттл, боцман флота обломков'],
  portrait: 'giver_bosun_m',
  reward: { map: 2 },
  quests: [
    {
      t: ['Every House a Hull', 'Каждый дом был кораблём'],
      b: [
        'Hask Morrow has sent you to the one man who can give the Code a fleet by spring. Nils Kettle knocks on his own front door, once a hatch, and says: “Twenty hulls lie off {isle}. Go and look at them before you tell me it can’t be done.”',
        'Хаск Морроу послал вас к единственному человеку, который может дать Кодексу флот к весне. Нильс Кеттл стучит по своей входной двери, бывшей когда-то люком, и говорит: «У острова {isle} лежат двадцать корпусов. Сходите посмотрите на них, прежде чем говорить, что это невозможно».',
      ],
      d: [
        'Twenty hulls on the reef, half of them sound below the waterline. Kettle grins: “Told you.”',
        'Двадцать корпусов на рифе, и у половины цело всё ниже ватерлинии. Кеттл ухмыляется: «Я же говорил».',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['Keel Timber', 'Килевой лес'],
      b: [
        'A ship can live without a mast for a while, Kettle says, but never without a keel. The reef has broken a dozen of them. Bring him timber, oak if the market has it, and he will start in the morning.',
        'Без мачты корабль какое-то время проживёт, говорит Кеттл, а без киля — никогда. Риф сломал их с дюжину. Привезите ему лес, лучше дуб, если найдётся, и утром он начнёт.',
      ],
      d: [
        'The first new keel is laid on the slip at dawn, and the whole town comes down to watch.',
        'На рассвете на стапель ложится первый новый киль, и весь город сходится посмотреть.',
      ],
      s: ['bring:timber'],
    },
    {
      t: ['Anchors and Guns', 'Якоря и пушки'],
      b: [
        'The best fittings never reached the reef: they went down with the ships that sank outright in deep water. Kettle’s divers know where. Send them down, and stand by in case something else is down there with them.',
        'Лучшая оснастка до рифа так и не доплыла: она ушла на дно вместе с кораблями, затонувшими на глубине. Водолазы Кеттла знают где. Спустите их и будьте наготове на случай, если там внизу есть ещё кто-то.',
      ],
      d: [
        'Anchors, guns, a ship’s bell with the clapper wired shut. Kettle orders that one left on the bottom.',
        'Якоря, пушки и судовой колокол с прикрученным проволокой языком. Этот Кеттл велит оставить на дне.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['Crews from Nowhere', 'Команды ниоткуда'],
      b: [
        'Every tavern in {hub} is full of men the sea spat out: survivors of wrecks, deserters, castaways with no port to go home to. Kettle says they will sail anything that floats, for anyone who feeds them.',
        'Все таверны в порту {hub} полны людей, которых выплюнуло море: уцелевших после крушений, дезертиров, выброшенных на берег, которым некуда вернуться. Кеттл говорит, что они пойдут на чём угодно, лишь бы кормили.',
      ],
      d: [
        'They sign the articles with crosses, knots and a few with names. Kettle calls them the drowned men’s crew.',
        'Они подписывают договор крестиками, узелками, а кое-кто и именем. Кеттл называет их командой утопленников.',
      ],
      s: ['recruit', 'hub'],
    },
    {
      t: ['A Prize Is a Ship', 'Приз — тоже корабль'],
      b: [
        'Kettle is practical: a hull taken at sea is a hull he does not have to raise from the reef. Take a ship by boarding, and bring it before a prize court so the Code holds it lawfully — by its own laws.',
        'Кеттл человек практичный: корпус, взятый в море, — это корпус, который не нужно поднимать с рифа. Захватите корабль абордажем и приведите его в призовой суд, чтобы Кодекс владел им законно — по своим законам.',
      ],
      d: [
        'The court’s seal is still wet when Kettle’s men start stripping her for the fleet.',
        'Печать суда ещё не высохла, а люди Кеттла уже разбирают его для флота.',
      ],
      s: ['board:1', 'prize'],
    },
    {
      t: ['Planks for the Yards', 'Доски для верфей'],
      b: [
        'Sawn planks are cheap at {port} and dear everywhere else in these waters. Kettle has a yard at {port2} where three hulls wait for new strakes.',
        'Пилёные доски дёшевы в порту {port} и дороги во всех остальных портах этих вод. У Кеттла верфь в порту {port2}, где три корпуса ждут новой обшивки.',
      ],
      d: [
        'Three hulls are planked in a week. They smell of fresh pine instead of the reef.',
        'За неделю три корпуса обшиты заново. Пахнут они свежей сосной, а не рифом.',
      ],
      s: ['carry:planks', 'hub'],
    },
    {
      t: ['Crews That Never Left', 'Команды, что не ушли'],
      b: [
        'The soundest hulls on the reef still have their crews — drowned, and still at their posts. Every night they put out on the old ships and sail the reef in a line. Send them down for good, then let the divers in.',
        'На самых крепких корпусах рифа до сих пор остаются их команды — утонувшие, но всё ещё на своих местах. Каждую ночь они выходят на старых кораблях и идут вдоль рифа строем. Отправьте их на дно насовсем, а потом пустите водолазов.',
      ],
      d: [
        'When the last of them goes down, the reef is quiet, and the divers come up with whole sets of rigging.',
        'Когда уходит последний, риф затихает, и водолазы поднимают целые комплекты такелажа.',
      ],
      s: ['sink:3:ghost', 'dive'],
    },
    {
      t: ['An Old Friend’s Shipwrights', 'Корабелы старого друга'],
      b: [
        'Tobias Wren still keeps the ship graveyard at {at}, and he has written to say he can spare shipwrights who know dead hulls better than living ones. Fetch them, and guard their boats on the way back.',
        'Тобиас Рен по-прежнему хранит кладбище кораблей в порту {at} и написал, что может отпустить корабелов, которые знают мёртвые корпуса лучше живых. Заберите их и охраняйте их лодки на обратном пути.',
      ],
      d: [
        'With the shipwrights comes a note in Wren’s hand: “Two more marks have woken on the Black Chart.”',
        'Вместе с корабелами приходит записка рукой Рена: «На Чёрной карте проснулись ещё две отметки».',
      ],
      s: ['at:wrecktide', 'escort'],
    },
    {
      t: ['The Reef’s Due', 'Плата за риф'],
      b: [
        'By old custom of {hub}, every merchant who passes the reef in safety owes the town a share, for the lights it keeps and the wrecks it does not make. Kettle wants that due collected for the fleet.',
        'По старому обычаю порта {hub} каждый купец, благополучно прошедший риф, должен городу долю — за огни, которые тот держит, и за крушения, которых он не устраивает. Кеттл хочет собрать эту плату на нужды флота.',
      ],
      d: [
        'The merchants pay with sour faces, and Kettle buys copper sheathing with every coin.',
        'Купцы платят с кислыми лицами, а Кеттл на каждую монету покупает медную обшивку.',
      ],
      s: ['tribute', 'hub'],
    },
    {
      t: ['Canvas for Twenty', 'Парусина на двадцать'],
      b: [
        'Twenty ships want twenty suits of sails, and the sailmakers of {hub} have sewn their fingers raw. Kettle needs sailcloth by the bolt.',
        'Двадцати кораблям нужно двадцать комплектов парусов, а парусные мастера в порту {hub} стёрли пальцы до мозолей. Кеттлу нужна парусина кипами.',
      ],
      d: [
        'Sails go up on the first five hulls, patched and many-coloured, like flags of every nation.',
        'Над первыми пятью корпусами поднимаются паруса — латаные, разноцветные, будто флаги всех народов.',
      ],
      s: ['bring:sailcloth'],
    },
    {
      t: ['Gunners Wanted', 'Нужны канониры'],
      b: [
        'The drowned men’s crew can haul and reef, but few of them have ever laid a gun. Kettle hears there are idle gunners in {port}, paid off from a Crown frigate and drinking their wages.',
        'Команда утопленников умеет тянуть шкоты и брать рифы, но мало кто из них хоть раз наводил пушку. Кеттл слышал, что в порту {port} сидят без дела канониры, списанные с фрегата Короны и пропивающие жалованье.',
      ],
      d: [
        'The gunners come aboard still half drunk. By evening they have the drowned men loading in time.',
        'Канониры поднимаются на борт ещё навеселе. К вечеру команда утопленников заряжает у них в лад.',
      ],
      s: ['port', 'recruit'],
    },
    {
      t: ['The Iron-Bound Frigate', 'Окованный фрегат'],
      b: [
        'An old frigate of the Crown lies stranded on {isle}, too high on the rocks for the sea to finish her. Kettle wants to know if she can be floated off on the spring tide.',
        'На острове {isle} лежит старый фрегат Короны, выброшенный на скалы так высоко, что море не может его добить. Кеттл хочет знать, удастся ли снять его на весеннем приливе.',
      ],
      d: [
        'Her hull is sound, her guns still in their ports. Kettle names her the Second Chance on the spot.',
        'Корпус крепок, пушки всё ещё в портах. Кеттл тут же нарекает его «Вторым шансом».',
      ],
      s: ['isle', 'land', 'hub'],
    },
    {
      t: ['Shipbreakers', 'Корабельные мародёры'],
      b: [
        'Pirate shipbreakers have been stripping the reef by night, tearing out the copper and the guns Kettle meant for the fleet. Sink them, and take one of their boats whole — it will make a tender.',
        'Пираты-разборщики по ночам обдирают риф, выламывая медь и пушки, которые Кеттл предназначил флоту. Потопите их, а одну лодку возьмите целой — пригодится как посыльное судно.',
      ],
      d: [
        'The captured shipbreaker becomes the fleet’s first tender. Her old crew are too ashamed to refuse the articles.',
        'Захваченная лодка разборщиков становится первым посыльным судном флота. Её бывшей команде слишком стыдно, чтобы отказаться от договора.',
      ],
      s: ['sink:3:pirate', 'board:1'],
    },
    {
      t: ['A Slip on Your Island', 'Стапель на вашем острове'],
      b: [
        'The yards of {hub} cannot hold twenty hulls at once. Kettle asks to lay a slipway in the hidden harbour of your island, where the Choir’s spies cannot count the ships. Bring iron for the cradles.',
        'Верфи в порту {hub} не вместят двадцать корпусов разом. Кеттл просит заложить стапель в тайной гавани вашего острова, где шпионы Хора не смогут пересчитать корабли. Привезите железо для опор.',
      ],
      d: [
        'Two hulls go up on your new slip. Your island’s quiet harbour rings with mallets.',
        'На новом стапеле встают два корпуса. Тихая гавань вашего острова звенит киянками.',
      ],
      s: ['build', 'bring:iron'],
    },
    {
      t: ['The Reef’s New Shoals', 'Новые мели рифа'],
      b: [
        'The reef grows, Kettle says, the way a town grows: a new wreck every month, a new shoal under it. The fleet must come out through those shoals. Put the islands of the outer reef on the chart.',
        'Риф растёт, говорит Кеттл, как растёт город: каждый месяц новое крушение, а под ним новая мель. Флоту предстоит выходить через эти мели. Нанесите на карту острова внешнего рифа.',
      ],
      d: [
        'Kettle marks a channel through your chart in red chalk: “That is how we get out.”',
        'Кеттл прочерчивает по вашей карте красным мелом проход: «Вот так мы и выйдем».',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Bells in the Hulls', 'Колокола в трюмах'],
      b: [
        'The divers came up white: in the hulls off {isle}, small hand-bells are nailed to the keelsons, dozens of them, as if to call the crews back. Kettle wants every one torn out before his men sail those ships.',
        'Водолазы поднялись бледными: в корпусах у острова {isle} к кильсонам прибиты маленькие ручные колокольчики, десятки, будто чтобы звать команды обратно. Кеттл хочет, чтобы их выдрали все до единого, прежде чем его люди выйдут на этих кораблях.',
      ],
      d: [
        'The bells are melted down in the town forge. For one night, the whole reef sings under the water.',
        'Колокольчики переплавляют в городской кузнице. Одну ночь весь риф поёт под водой.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['Ship’s Biscuit', 'Сухари на флот'],
      b: [
        'A fleet that cannot eat cannot sail. Provisions for twenty crews wait at {port}; the victuallers of {port2} will barrel and salt them for the voyage.',
        'Флот, которому нечего есть, никуда не выйдет. Провизия на двадцать команд ждёт в порту {port}; поставщики в порту {port2} разложат её по бочкам и засолят в дорогу.',
      ],
      d: [
        'Barrels stand in rows on every quay. The drowned men’s crew eats its first full meal in years.',
        'На каждой пристани рядами стоят бочки. Команда утопленников впервые за годы ест досыта.',
      ],
      s: ['carry:provisions'],
    },
    {
      t: ['Sea Trials', 'Ходовые испытания'],
      b: [
        'The first five ships of the wreck-fleet are ready for sea trials. Kettle wants them out in {region} for a day, under your eye, and anything that comes for them sent to the bottom.',
        'Первые пять кораблей флота обломков готовы к ходовым испытаниям. Кеттл хочет на день вывести их в воды «{region}» под вашим присмотром, а всё, что на них нападёт, отправить на дно.',
      ],
      d: [
        'Not one seam opens. Kettle stands at the rail with his hat off and does not speak for a long time.',
        'Ни один шов не разошёлся. Кеттл долго стоит у борта со снятой шляпой и молчит.',
      ],
      s: ['escort', 'sink:2'],
    },
    {
      t: ['The Choir Counts Ships', 'Хор считает корабли'],
      b: [
        'Grey sloops have begun to circle the reef, counting the masts. If the Choir learns how many ships the Code will have, it will strike before the fleet is ready. Take the sloops before they sail home.',
        'Вокруг рифа начали кружить серые шлюпы, пересчитывая мачты. Если Хор узнает, сколько кораблей будет у Кодекса, он ударит прежде, чем флот будет готов. Возьмите шлюпы, пока они не ушли домой.',
      ],
      d: [
        'The sloops’ tallies are all wrong. Kettle laughs: “Half of what they counted were scarecrows on the reef.”',
        'Счёт на шлюпах весь неверен. Кеттл смеётся: «Половина того, что они насчитали, — пугала на рифе».',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Lenses for the Flagship', 'Линзы для флагмана'],
      b: [
        'Ottilie Brand has ground a listening lens for the wreck-fleet’s flagship, so the Code will hear the Choir’s bells before it sees the Choir’s sails. Fetch it from {at}.',
        'Оттилия Бранд отшлифовала для флагмана флота обломков слушающую линзу, чтобы Кодекс слышал колокола Хора раньше, чем увидит его паруса. Заберите её в порту {at}.',
      ],
      d: [
        'The lens is set in the flagship’s binnacle. It is humming already, very faintly, toward the east.',
        'Линзу устанавливают в нактоуз флагмана. Она уже гудит — очень тихо — в сторону востока.',
      ],
      s: ['at:saltglass', 'hub'],
    },
    {
      t: ['The Wreck-Fleet Sails', 'Флот обломков выходит в море'],
      b: [
        'Twenty ships in patched sails come out through the channel Kettle chalked on your chart, and the drowned crews of the outer reef rise to meet them one last time. See the fleet through, and bring it south to the Code’s cones.',
        'Двадцать кораблей под латаными парусами выходят проходом, который Кеттл прочертил на вашей карте, и утонувшие команды внешнего рифа в последний раз поднимаются им навстречу. Проведите флот и приведите его на юг, к вулканам Кодекса.',
      ],
      d: [
        'As the fleet clears the reef, the lens in the binnacle screams, and a mirror flashes from the fog: the Choir has sailed against the Code’s islands.',
        'Едва флот минует риф, линза в нактоузе срывается на визг, а из тумана вспыхивает зеркало: Хор выступил на острова Кодекса.',
      ],
      s: ['escort', 'sink:3:ghost', 'board:1', 'at:brimstone_bay'],
    },
  ],
};
