// Chapter 17 — Saltglass (Act III, the Northern Waters). Lenses of abyssal glass that sing when the drowned bells ring;
// the Widow Morwen comes herself in a storm and sinks half the squadron (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 17,
  region: 'dead_mans_expanse',
  hub: 'saltglass',
  title: ['Saltglass', 'Соляное Стекло'],
  blurb: [
    'Salt pans white as sails, glassworks that never sleep, and lenses of black glass that hum when the drowned bells ring. Someone has been buying them by the crate.',
    'Солеварни, белые, как паруса, стекловарни, что не гаснут ни днём ни ночью, и линзы из чёрного стекла, которые гудят, когда звонят утонувшие колокола. Кто-то скупает их ящиками.',
  ],
  giver: ['Ottilie Brand, master glassmaker', 'Оттилия Бранд, мастер-стеклодув'],
  portrait: 'giver_shipwright_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['The Lens in the Mask', 'Линза в маске'],
      b: [
        'Ottilie Brand turns the Bell-Warden’s lens to the furnace light and goes pale: it is her own work, ground from the black sand that only {isle} gives. She wants to see the sand-pit with her own eyes.',
        'Оттилия Бранд подносит линзу Звонаря к свету печи и бледнеет: это её работа, отшлифованная из чёрного песка, какой даёт только остров {isle}. Она хочет своими глазами увидеть песчаный карьер.',
      ],
      d: [
        'The pit is dug out to the bedrock and the diggers gone. Keel marks lead from the beach straight out to sea.',
        'Карьер выбран до скалы, копателей нет. От берега прямо в море ведут следы килей.',
      ],
      s: ['isle', 'land', 'hub'],
    },
    {
      t: ['Paid in Old Silver', 'Плата старым серебром'],
      b: [
        'The orders for black lenses went through a League clerk at {port}. Ottilie never asked who stood behind him. Now she wants to know, and she wants you to ask for her.',
        'Заказы на чёрные линзы шли через писаря Лиги в порту {port}. Оттилия никогда не спрашивала, кто стоит за ним. Теперь она хочет знать — и просит вас спросить за неё.',
      ],
      d: [
        'Forty lenses in three years, every one paid in old Crown silver — the same coin the woman in grey once paid the bell-founder.',
        'Сорок линз за три года, и за каждую заплачено старым серебром Короны — той же монетой, которой женщина в сером когда-то платила литейщику.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Runners of Black Glass', 'Перевозчики чёрного стекла'],
      b: [
        'Fast cutters still slip out of the haze with crates packed in straw and salt. Ottilie says a lens that leaves these waters never comes back. Stop them before the next one does.',
        'Из марева по-прежнему выскальзывают быстрые катера с ящиками, переложенными соломой и солью. Оттилия говорит: линза, покинувшая эти воды, больше не возвращается. Остановите их, пока не ушла следующая.',
      ],
      d: [
        'Twelve lenses in the straw, each wrapped in grey cloth and marked with a small bell.',
        'В соломе двенадцать линз, каждая завёрнута в серую ткань и помечена маленьким колоколом.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Salt for the League', 'Соль для Лиги'],
      b: [
        'The League pays for the glassworks with salt, and the salt road runs through dead calms where ships sit for days. A cargo waits at {port}; the League factor at {port2} will not wait much longer.',
        'Лига платит стекловарням солью, а соляная дорога идёт через мёртвые штили, где корабли стоят по нескольку дней. Груз ждёт в порту {port}; фактор Лиги в порту {port2} долго ждать не станет.',
      ],
      d: [
        'The factor weighs the salt twice and pays without a word. The furnaces will burn another season.',
        'Фактор дважды взвешивает соль и платит молча. Печи прогорят ещё один сезон.',
      ],
      s: ['carry:salt', 'escort'],
    },
    {
      t: ['Lights Over the Pans', 'Огни над солеварнями'],
      b: [
        'At night pale ships drift in over the salt pans, their sails hanging slack in a wind that is not blowing. The pan-workers have stopped going out after dark. Send the drowned back down.',
        'По ночам над солеварнями дрейфуют бледные корабли, и паруса их висят в безветрии, будто наполненные. Солевары больше не выходят после заката. Верните утонувших на дно.',
      ],
      d: [
        'The pale ships sink without a sound, and the pans lie white and empty under the moon.',
        'Бледные корабли тонут без единого звука, и солеварни лежат под луной белые и пустые.',
      ],
      s: ['sink:3:ghost', 'hub'],
    },
    {
      t: ['Coal for the Furnaces', 'Уголь для печей'],
      b: [
        'A glass furnace that goes cold cracks, and a cracked furnace takes a year to rebuild. Pirates have been taking the colliers on the way in. Bring coal, and teach the pirates to choose other prey.',
        'Остывшая стекловаренная печь трескается, а треснувшую строят заново целый год. Пираты перехватывают угольщиков на подходе. Привезите уголь и научите пиратов выбирать другую добычу.',
      ],
      d: [
        'The furnaces glow orange again, and the glassblowers sing at their pipes.',
        'Печи снова светятся оранжевым, и стеклодувы поют над своими трубками.',
      ],
      s: ['sink:2:pirate', 'bring:coal'],
    },
    {
      t: ['Becalmed', 'В мёртвом штиле'],
      b: [
        'A League galley carrying glass has sat becalmed off {isle} for eleven days. Her last boat came in with one man who said the crew had started climbing over the side to follow a bell.',
        'Галера Лиги со стеклом одиннадцать дней стоит в штиле у острова {isle}. Её последняя шлюпка привезла одного человека: он сказал, что команда начала прыгать за борт, идя на звон колокола.',
      ],
      d: [
        'You pull the last of them out with cotton stuffed in their ears. They are still humming the same note.',
        'Последних вытаскивают с ватой в ушах. Они всё ещё напевают одну и ту же ноту.',
      ],
      s: ['isle', 'rescue', 'hub'],
    },
    {
      t: ['The Lost Apprentice', 'Пропавший подмастерье'],
      b: [
        'Ottilie’s best apprentice, Pell Ashby, vanished with the moulds for the black lenses. He was seen boarding a grey-sailed ship at {port}. Bring him back — alive, she says, twice.',
        'Лучший подмастерье Оттилии, Пелл Эшби, пропал вместе с формами для чёрных линз. Его видели, когда он садился на корабль под серым парусом в порту {port}. Верните его — живым, повторяет она дважды.',
      ],
      d: [
        'Pell weeps: the Choir promised that in the bells he would hear his drowned mother’s voice.',
        'Пелл плачет: Хор обещал, что в звоне колоколов он услышит голос своей утонувшей матери.',
      ],
      s: ['port', 'board:1'],
    },
    {
      t: ['The Listening Glass', 'Слушающее стекло'],
      b: [
        'Ottilie and Pell grind a lens that hums louder the nearer it comes to a drowned bell. She wants it tested at sea, over waters no chart has drawn, and over a wreck where her divers can go down.',
        'Оттилия и Пелл шлифуют линзу, которая гудит тем громче, чем ближе утонувший колокол. Она хочет проверить её в море — над водами, которых нет ни на одной карте, и над затонувшим кораблём, куда спустятся водолазы.',
      ],
      d: [
        'Over the wreck the lens hums so hard it fogs. Down below, the divers find a bell’s clapper in the sand.',
        'Над затонувшим кораблём линза гудит так, что запотевает. Внизу водолазы находят в песке колокольный язык.',
      ],
      s: ['chart', 'dive'],
    },
    {
      t: ['The Order’s Squadron', 'Эскадра ордена'],
      b: [
        'Marshal Sund has sent a squadron south to carry Ottilie’s great lens north, where it can hear every bell beneath the ice. They put into {port} with their canvas torn to rags. They need sailcloth.',
        'Маршал Сунд прислал на юг эскадру, чтобы увезти великую линзу Оттилии на север, где она услышит каждый колокол подо льдом. Корабли зашли в порт {port} с парусами, изорванными в клочья. Им нужна парусина.',
      ],
      d: [
        'The squadron bends on new canvas. Its commodore salutes you from the quarterdeck.',
        'Эскадра ставит новые паруса. Коммодор отдаёт вам честь со шканцев.',
      ],
      s: ['port', 'bring:sailcloth'],
    },
    {
      t: ['Pearl for the Polish', 'Жемчуг для полировки'],
      b: [
        'The great lens must be polished with pearl ground to dust, nothing coarser. The pearling grounds are watched by pirates who think every pearl in these waters is theirs.',
        'Великую линзу полируют только жемчугом, стёртым в пыль, — ничем грубее. За жемчужными отмелями следят пираты, которые считают каждую жемчужину в этих водах своей.',
      ],
      d: [
        'Under the pearl dust the great lens turns clear as cold water — and deep as a well.',
        'Под жемчужной пылью великая линза становится прозрачной, как холодная вода, и глубокой, как колодец.',
      ],
      s: ['sink:2:pirate', 'bring:pearls'],
    },
    {
      t: ['Moths to the Lens', 'Мотыльки на свет'],
      b: [
        'Since the great lens was finished, the haze off {isle} glows every night, and the drowned ships gather there like moths at a lantern. Ottilie wants them gone before the squadron sails past.',
        'С тех пор как великая линза готова, марево у острова {isle} каждую ночь светится, и туда, как мотыльки на фонарь, слетаются утонувшие корабли. Оттилия хочет, чтобы их не было, когда мимо пойдёт эскадра.',
      ],
      d: [
        'The glow fades as the last of them goes under. The lens in the workshop falls silent.',
        'Свечение гаснет, когда последний из них уходит под воду. Линза в мастерской замолкает.',
      ],
      s: ['isle', 'sink:3:ghost'],
    },
    {
      t: ['Smoke and Rumour', 'Дым и слухи'],
      b: [
        'The dreamleaf dealers of {at} trade in rumours as freely as in smoke. Ottilie wants to know who carries the black lenses north, and the dealers want goods no customs house will pass.',
        'Торговцы дурман-листом в порту {at} торгуют слухами так же легко, как дымом. Оттилия хочет знать, кто возит чёрные линзы на север, а торговцы хотят товара, который не пропустит ни одна таможня.',
      ],
      d: [
        'A dealer laughs through the smoke: the lenses go to a black brig that never puts in, only waits for storms.',
        'Торговец смеётся сквозь дым: линзы уходят на чёрный бриг, который никогда не заходит в порт, а только ждёт штормов.',
      ],
      s: ['at:lotus_anchorage', 'contraband'],
    },
    {
      t: ['The Glass Barge', 'Стеклянная баржа'],
      b: [
        'With Pell gone, the Choir has found another glassworks, and a barge of its lenses is crawling across the calms under tow. Board her, and sink the tow-ships so she cannot be dragged away.',
        'Без Пелла Хор нашёл другую стекловарню, и баржа с её линзами ползёт через штиль на буксире. Возьмите её на абордаж и потопите буксиры, чтобы её не утащили.',
      ],
      d: [
        'The lenses on the barge are crude and cloudy. Ottilie smashes them one by one with a hammer.',
        'Линзы на барже грубые и мутные. Оттилия разбивает их одну за другой молотком.',
      ],
      s: ['board:2', 'sink:2'],
    },
    {
      t: ['A Lamp for Your Island', 'Фонарь для вашего острова'],
      b: [
        'In thanks Ottilie gives you a lens for your own hidden island: set on a hill, it will throw a light the Choir’s boats can be seen by, long before they see your harbour. Raise a tower for it.',
        'В благодарность Оттилия дарит вам линзу для вашего тайного острова: установленная на холме, она даст свет, в котором лодки Хора будут видны задолго до того, как они заметят вашу гавань. Поставьте для неё башню.',
      ],
      d: [
        'The first night the lamp is lit, your lookouts see three grey sails turn away from the island.',
        'В первую же ночь, когда зажигают фонарь, ваши дозорные видят, как от острова отворачивают три серых паруса.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Lighthouse Turned Downward', 'Маяк, смотрящий вниз'],
      b: [
        'Ottilie has heard of an old lighthouse of the Drowned Crown standing in ruins on {isle}, its lenses still in their frames. She wants to know how the old makers ground them.',
        'Оттилия слышала о старом маяке Утонувшей Короны, что стоит в руинах на острове {isle}, и линзы его до сих пор в своих рамах. Она хочет знать, как их шлифовали старые мастера.',
      ],
      d: [
        'The lenses are of black glass, and they were set facing down — into the sea, toward the bells.',
        'Линзы из чёрного стекла, и установлены они вниз — в море, к колоколам.',
      ],
      s: ['land:ruins', 'hub'],
    },
    {
      t: ['Hunters in the Haze', 'Охотники в мареве'],
      b: [
        'The Choir has hired hunters to follow you, and they have been seen working the haze in pairs, waiting for a ship alone. Turn on them before the squadron sails, and let all {region} see it.',
        'Хор нанял охотников, чтобы они шли по вашему следу; их видели в мареве парами, поджидающими одинокий корабль. Обернитесь к ним, пока не вышла эскадра, — пусть это увидят все воды «{region}».',
      ],
      d: [
        'One hunter’s log has your ship drawn in it, and beside it a small bell.',
        'В журнале одного из охотников нарисован ваш корабль, а рядом маленький колокол.',
      ],
      s: ['sink:3:hunter', 'hub'],
    },
    {
      t: ['Pilots of the Reef', 'Лоцманы рифа'],
      b: [
        'The glass in Ottilie’s barometers sings though no bell rings, and she does not like it. The squadron will need pilots who know every reef of these waters. The best are in {at}.',
        'Стекло в барометрах Оттилии поёт, хотя никакой колокол не звонит, и ей это не нравится. Эскадре понадобятся лоцманы, знающие каждый риф этих вод. Лучшие из них живут в порту {at}.',
      ],
      d: [
        'Two old pilots agree to come. Both look at the sky and say nothing.',
        'Двое старых лоцманов соглашаются идти. Оба смотрят на небо и молчат.',
      ],
      s: ['at:wreckhold', 'hub'],
    },
    {
      t: ['Loading the Great Lens', 'Погрузка великой линзы'],
      b: [
        'The great lens leaves the workshop on a lighter, packed in salt and wool, for the squadron’s flagship anchored off {isle}. Ottilie rides with it and will not let it out of her sight.',
        'Великая линза покидает мастерскую на лихтере, упакованная в соль и шерсть, — к флагману эскадры, что стоит у острова {isle}. Оттилия плывёт рядом и не сводит с неё глаз.',
      ],
      d: [
        'The lens is hoisted aboard and lashed below. Ottilie stays with it, one hand on the crate.',
        'Линзу поднимают на борт и крепят в трюме. Оттилия остаётся рядом, положив ладонь на ящик.',
      ],
      s: ['isle', ['escort', 'Guard the lighter on its way out for {n} min.', 'Охраняйте лихтер на пути к флагману: {n} мин.']],
    },
    {
      t: ['A Shadow in Grey', 'Серая тень'],
      b: [
        'A grey ship has been shadowing the squadron at the edge of sight since it anchored. If she carries word to whoever waits for the lens, the voyage is lost before it starts. Take her before she signals.',
        'С тех пор как эскадра встала на якорь, на краю видимости держится серый корабль. Если он донесёт весть тем, кто ждёт линзу, плавание проиграно ещё до начала. Возьмите его, пока он не подал сигнал.',
      ],
      d: [
        'The last line in her log, in a careful hand: “She comes with the storm.”',
        'Последняя строка в его журнале, выведенная аккуратным почерком: «Она придёт со штормом».',
      ],
      s: ['board:1', 'sink:2'],
    },
    {
      t: ['The Squadron Weighs', 'Эскадра снимается с якоря'],
      b: [
        'The squadron gathers at {port} to take on water before the long run north. The sky to the west has gone the colour of slate, and the old pilots are arguing with the commodore.',
        'Эскадра собирается в порту {port}, чтобы взять воду перед долгим переходом на север. Небо на западе стало цвета сланца, и старые лоцманы спорят с коммодором.',
      ],
      d: [
        'The commodore will not wait. The anchors come up, and the first gust heels the whole line over.',
        'Коммодор ждать не хочет. Якоря выбраны, и первый порыв кренит всю линию разом.',
      ],
      s: ['port', 'escort'],
    },
    {
      t: ['The Widow in the Storm', 'Вдова в шторме'],
      b: [
        'Halfway across, the glass in every binnacle begins to sing. A black brig comes out of the storm with no wind in her sails, and a woman in grey stands at her rail. Morwen has come herself.',
        'На полпути стекло в каждом нактоузе начинает петь. Из шторма выходит чёрный бриг — паруса его недвижны, хотя кругом ревёт ветер, — а у борта стоит женщина в сером. Морвен пришла сама.',
      ],
      d: [
        'The sea rose under her hand, and half the squadron went down with the great lens. She looked at you once, spoke your name across the water, and was gone with the storm.',
        'Море поднялось по мановению её руки, и половина эскадры ушла на дно вместе с великой линзой. Она посмотрела на вас лишь раз, произнесла над водой ваше имя — и ушла вместе со штормом.',
      ],
      s: ['escort', 'sink:3:ghost', 'rescue', 'hub'],
    },
  ],
};
