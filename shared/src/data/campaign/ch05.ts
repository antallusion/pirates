// Chapter 5 — The Whispering Fog (Act II, The Merchants' Road). Kitty Marsh and the smugglers' channels of the Choir's bronze (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 5,
  region: 'whispering',
  hub: 'hushwater',
  title: ['The Whispering Fog', 'Шепчущий туман'],
  blurb: [
    'A hundred islets lost in fog, houseboats lashed round a drowned bell tower, and smugglers who know every channel the Choir’s bronze runs through. They will tell you, once you have run their goods.',
    'Сотня островков в тумане, плавучие дома вокруг затонувшей колокольни и контрабандисты, знающие каждую протоку, по которой Хор возит бронзу. Они расскажут — когда вы повозите их товар.',
  ],
  giver: ['Kitty Marsh, smuggler', 'Китти Марш, контрабандистка'],
  portrait: 'giver_smuggler_f',
  reward: { map: 1 },
  quests: [
    {
      t: ['The Lantern Shown', 'Знак фонаря'],
      b: [
        'Sabine’s brass lantern means nothing by daylight. In the fog of {region}, among a hundred islets, you must show it off {isle} and wait for a light to answer.',
        'Днём медный фонарь Сабины ничего не значит. В тумане вод «{region}», среди сотни островков, покажите его у острова {isle} и ждите, когда ответит огонь.',
      ],
      d: [
        'A shuttered light answers and leads you to the houseboats of {hub}, where Kitty Marsh, who runs half the channels in the fog, wants a look at you.',
        'Отвечает закрытый фонарь и ведёт вас к плавучим домам порта {hub}, где на вас желает взглянуть Китти Марш — хозяйка половины проток в тумане.',
      ],
      s: ['reach', 'isle', 'hub'],
    },
    {
      t: ['A Smuggler’s Welcome', 'Испытание контрабандой'],
      b: [
        'Kitty does not talk to strangers; she trades with them. Carry a hold of her goods past a Crown inspection, and sell them where she tells you.',
        'С чужаками Китти не разговаривает — она с ними торгует. Провезите трюм её товара мимо досмотра Короны и продайте там, где она скажет.',
      ],
      d: ['Kitty counts the coin twice, then pours you a cup of something green and bitter.', 'Китти дважды пересчитывает монеты, а потом наливает вам чашку чего-то зелёного и горького.'],
      s: ['customs', 'contraband'],
    },
    {
      t: ['The Drowned Belfry', 'Затопленная колокольня'],
      b: [
        'The houseboats of {hub} are lashed round a drowned bell tower. Its bell hung silent for a century; a month ago it rang, and by morning it was gone. Kitty wants to know if the other wrecks in the fog have lost theirs.',
        'Плавучие дома порта {hub} привязаны к затонувшей колокольне. Сто лет её колокол молчал; месяц назад он зазвонил, а к утру исчез. Китти хочет знать, лишились ли своих колоколов другие затонувшие корабли в тумане.',
      ],
      d: [
        'Every wreck has the same wound: a cut bell-rope and fresh grapple scars on the timbers.',
        'У всех затонувших кораблей одна и та же рана: перерезанная колокольная верёвка и свежие следы кошки на досках.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['Closed Channels', 'Закрытые протоки'],
      b: [
        'Since spring, boats under grey pennants have been closing channels the smugglers have used for fifty years. Kitty’s runners turn back or vanish. She wants her water back.',
        'С весны лодки под серыми вымпелами перекрывают протоки, которыми контрабандисты пользовались полвека. Бегуны Китти поворачивают назад или пропадают. Она хочет вернуть свою воду.',
      ],
      d: [
        'The grey boats were crewed by pirates hired for the season and paid by someone they never saw.',
        'На серых лодках ходили пираты, нанятые на сезон; платил им человек, которого они ни разу не видели.',
      ],
      s: ['sink:2:pirate', 'board:1'],
    },
    {
      t: ['Leaf for a Broker', 'Сонный лист для брокера'],
      b: [
        'Kitty owes the Fog Brokers a cargo of dreamleaf, and a Broker owes Kitty a secret. Carry the leaf from {port} to {port2}, and do not breathe too deep in the hold.',
        'Китти задолжала брокерам Тумана партию сонного листа, а один брокер задолжал Китти тайну. Доставьте лист из порта {port} в порт {port2} и не дышите глубоко в трюме.',
      ],
      d: [
        'The Broker of {port2} pays with one sentence: the Choir’s bronze moves only in the thickest fog, and bells lead it.',
        'Брокер в порту {port2} расплачивается одной фразой: бронза Хора ходит только в самом густом тумане, и ведут её колокола.',
      ],
      s: ['carry:dreamleaf'],
    },
    {
      t: ['The Old Pilots’ Channels', 'Протоки старых лоцманов'],
      b: [
        'Kitty’s channels live only in the heads of her old pilots, and the old pilots are dying off. She asks you to chart the islets no Crown map shows, so the young ones need not learn by wrecking.',
        'Протоки Китти живут только в головах её старых лоцманов, а старые лоцманы уходят один за другим. Она просит нанести на карту островки, которых нет ни на одной карте Короны, чтобы молодым не пришлось учиться на крушениях.',
      ],
      d: ['Kitty locks your charts in an oilskin bag and hangs it round her own neck.', 'Китти прячет ваши карты в непромокаемый мешок и вешает его себе на шею.'],
      s: ['chart'],
    },
    {
      t: ['Bells on Stakes', 'Колокола на кольях'],
      b: [
        'On fog nights the smugglers hear bells where no buoy should be. Kitty thinks the Choir has hung its own bells to mark a channel. Find them off {isle} and {isle2}.',
        'В туманные ночи контрабандисты слышат колокола там, где не должно быть ни одного буя. Китти думает, что Хор развесил свои колокола, чтобы отметить протоку. Найдите их у островов {isle} и {isle2}.',
      ],
      d: [
        'Small bells hang from stakes driven into the shoals, each tuned a little lower than the last. Follow them, and they lead somewhere.',
        'На кольях, вбитых в мели, висят колокольчики, и каждый настроен чуть ниже предыдущего. Если идти за ними, они куда-то приведут.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['The Bell-Tenders’ Camp', 'Лагерь смотрителей'],
      b: [
        'Someone tends the stake bells every night, oiling the clappers and mending the ropes. Their camp is on {isle}: hired men, Kitty says, and not many of them.',
        'Кто-то каждую ночь ухаживает за колоколами на кольях: смазывает языки, чинит верёвки. Их лагерь на острове {isle} — наёмники, говорит Китти, и немного.',
      ],
      d: [
        'The camp’s captain keeps a list of the coming tides, each marked with the same word: “Ring.”',
        'У начальника лагеря есть список грядущих приливов, и против каждого стоит одно и то же слово: «Звонить».',
      ],
      s: ['land:pirate_camp', 'hub'],
    },
    {
      t: ['Sold to the Customs', 'Проданы таможне'],
      b: [
        'Someone has sold Kitty’s runs to the Crown customs, and cutters wait at every channel mouth. Kitty asks you to slip a cargo through under their noses, then take the boat that carries the informer’s letters.',
        'Кто-то продал рейсы Китти таможне Короны, и катера ждут у каждого устья. Китти просит провезти груз у них под носом, а потом захватить лодку, которая возит письма доносчика.',
      ],
      d: [
        'Aboard the courier boat: letters to the customs house, each signed with a little bell drawn in ink.',
        'На борту курьерской лодки — письма в таможню, и каждое подписано маленьким колоколом, нарисованным чернилами.',
      ],
      s: ['customs', 'board:1'],
    },
    {
      t: ['The Informer', 'Доносчик'],
      b: [
        'The bell-signed letters were sent from {port}, where Kitty’s own lieutenant, Dace, keeps a sweetheart. Kitty asks you to go and look, and not to tell her what you hope to find.',
        'Письма с колоколом отправляли из порта {port}, где у собственного помощника Китти, Дейса, есть зазноба. Китти просит съездить и посмотреть — и не говорить ей, на что вы надеетесь.',
      ],
      d: [
        'Dace is gone, and so is his sweetheart. In their room: a grey cloak and a hymn-book of the Choir.',
        'Дейса нет, его зазнобы тоже. В их комнате — серый плащ и сборник гимнов Хора.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Dace Runs for the Fog', 'Дейс уходит в туман'],
      b: [
        'Dace has taken Kitty’s fastest lugger and her best pilot’s charts. If the Choir gets those charts, no smuggler in the fog will be safe again.',
        'Дейс увёл самый быстрый люгер Китти и карты её лучшего лоцмана. Если эти карты попадут к Хору, ни одному контрабандисту в тумане больше не будет покоя.',
      ],
      d: ['Dace is brought back wet and silent. The charts are saved; Kitty does not look at him once.', 'Дейса привозят мокрым и молчаливым. Карты спасены; Китти ни разу на него не смотрит.'],
      s: ['escort', 'board:1', 'hub'],
    },
    {
      t: ['The Cold Forge', 'Холодная кузня'],
      b: [
        'In the end Dace talks, to Jory of all people: the Choir’s bronze is loaded at the ruins on {isle}, where an old chapel stands with its tower in the water.',
        'В конце концов Дейс заговаривает — и не с кем-нибудь, а с Джори: бронзу Хора грузят у развалин на острове {isle}, где стоит старая часовня с башней по пояс в воде.',
      ],
      d: [
        'In the chapel: a cold forge, and ingots stamped with a mark of a bell inside a coin.',
        'В часовне — остывшая кузня и слитки, на которых выбит знак: колокол внутри монеты.',
      ],
      s: ['isle', 'land:ruins'],
    },
    {
      t: ['A Bell Inside a Coin', 'Колокол в монете'],
      b: [
        'Kitty has seen that mark before, on letters of credit. The Brokers’ mirror towers at {at} pass messages for every bank in the east; someone there will know whose seal it is.',
        'Китти уже видела этот знак — на аккредитивах. Зеркальные башни брокеров в порту {at} передают послания для всех банков востока; там кто-нибудь да знает, чья это печать.',
      ],
      d: [
        'The mirror-keeper names a League banking house, and asks, very politely, that you forget he did.',
        'Смотритель зеркал называет банкирский дом Лиги — и очень вежливо просит забыть, что он это сделал.',
      ],
      s: ['at:mirrorfen', 'hub'],
    },
    {
      t: ['What Gathers at the Bells', 'Кто собирается на звон'],
      b: [
        'The pearl divers of {hub} will not go down where the stake bells ring: beasts gather there, more every week, as if called to supper. Kitty asks you to thin them before the divers starve.',
        'Ловцы жемчуга из порта {hub} не спускаются туда, где звенят колокола на кольях: там собираются морские звери, с каждой неделей всё больше, будто их зовут к ужину. Китти просит проредить их, пока ловцы не начали голодать.',
      ],
      d: [
        'With the beasts gone, the divers bring you a pearl, and a tiny bell they found inside an oyster.',
        'Когда звери уходят, ловцы приносят вам жемчужину — и крошечный колокольчик, найденный внутри устрицы.',
      ],
      s: ['beast:any'],
    },
    {
      t: ['Hands for the Ambush', 'Люди для засады'],
      b: [
        'The tide-list says the next bronze convoy runs on the night of the thickest fog. Kitty’s smugglers will fight beside you, but they are runners, not soldiers: sign on men who can hold a deck.',
        'Список приливов говорит, что следующий бронзовый конвой пойдёт в ночь самого густого тумана. Контрабандисты Китти будут драться рядом с вами, но они бегуны, а не солдаты: наберите людей, способных удержать палубу.',
      ],
      d: [
        'Kitty’s runners and your new hands drink together, which Kitty calls a good sign and Jory a bad one.',
        'Бегуны Китти и ваши новички пьют вместе, и Китти считает это добрым знаком, а Джори — дурным.',
      ],
      s: ['recruit', 'hub'],
    },
    {
      t: ['Silence the Stakes', 'Заглушить колокола'],
      b: [
        'Without its bells the convoy will be blind in the fog. Kitty wants the stakes off {isle} pulled up on the night itself, not one night sooner, and the bell-tenders’ guard boats sent down.',
        'Без колоколов конвой ослепнет в тумане. Китти хочет, чтобы колья у острова {isle} выдернули именно в ту ночь, ни ночью раньше, а сторожевые лодки смотрителей отправили на дно.',
      ],
      d: [
        'One by one the bells go quiet. Somewhere out in the fog, oars stop and voices begin to argue.',
        'Колокола смолкают один за другим. Где-то в тумане замирают вёсла и начинают спорить голоса.',
      ],
      s: ['land', 'sink:2:pirate'],
    },
    {
      t: ['The Hidden Channel', 'Тайная протока'],
      b: [
        'The fog comes down thick as wool. Somewhere near {isle} the Choir’s convoy is feeling its way without bells. Kitty’s lugger shows a shuttered lantern once, and the hunt begins.',
        'Туман ложится густой, как шерсть. Где-то у острова {isle} конвой Хора на ощупь ищет дорогу без колоколов. С люгера Китти один раз мигает закрытый фонарь — и начинается охота.',
      ],
      d: [
        'The bronze ships are yours. In the convoy master’s cabin lies a ledger: every ingot paid for by a League bank, under a seal with a bell inside a coin.',
        'Бронзовые корабли ваши. В каюте начальника конвоя — счётная книга: каждый слиток оплачен банком Лиги, под печатью с колоколом внутри монеты.',
      ],
      s: ['isle', 'board:2', 'sink:2:pirate', 'hub'],
    },
  ],
};
