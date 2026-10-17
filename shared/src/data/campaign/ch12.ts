// Chapter 12 — The Whales Are Leaving (Act III, The Northern Waters). The herds flee a ringing under the ice; the old
// whalers starve; the ringing is led back to the Bell-Warden's ice-cutters and to a tower drowned in the fjord (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 12,
  region: 'leviathan_reach',
  hub: 'harpoon_rest',
  title: ['The Whales Are Leaving', 'Киты уходят'],
  blurb: [
    'For the first time in forty winters the try-works are cold. The whales are fleeing something that rings beneath the ice, and the whalers have nothing left to hunt but the reason.',
    'Впервые за сорок зим салотопни остыли. Киты бегут от чего-то, что звонит подо льдом, и китобоям больше не на кого охотиться, кроме самой причины.',
  ],
  giver: ['Gunnar Teal, old whaler', 'Гуннар Тил, старый китобой'],
  portrait: 'giver_whaler_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Cold Try-Works', 'Остывшие салотопни'],
      b: [
        'At {hub} the boats lie keel-up on the shingle, and the harpoons are rusting in their racks. Gunnar Teal will not talk to a southerner until she has taken a whale in these waters. He says it as a dare.',
        'В порту {hub} лодки лежат на гальке кверху килем, гарпуны ржавеют в стойках. Гуннар Тил не станет говорить с южанкой, пока та не добудет кита в здешних водах. Он говорит это как вызов.',
      ],
      d: [
        'Gunnar runs his hand over the whale’s flank: old scars like rope burns, and every one of them faces north.',
        'Гуннар проводит ладонью по боку кита: старые шрамы, как ожоги от каната, и все обращены к северу.',
      ],
      s: ['beast:whale:1', 'hub'],
    },
    {
      t: ['Stores Against the Winter', 'Запасы на зиму'],
      b: [
        'No whales means no oil to sell and no meat for the winter. The town will eat its boats before spring. Bring provisions to {hub}, and Gunnar will remember who did.',
        'Нет китов — нет ни жира на продажу, ни мяса на зиму. До весны город съест собственные лодки. Привезите провизию в порт {hub}, и Гуннар запомнит, кто это сделал.',
      ],
      d: [
        'The sacks are stacked in the cold try-house. Gunnar pours you a cup of something that burns like tar.',
        'Мешки сложены в остывшей салотопне. Гуннар наливает вам кружку чего-то, что жжёт, как смола.',
      ],
      s: ['bring:provisions'],
    },
    {
      t: ['The Herd Runs South', 'Стадо уходит на юг'],
      b: [
        'A herd was sighted off {isle}, swimming hard and not feeding. Gunnar wants to see them with his own eyes, and to take one, to know what they are running from.',
        'Стадо видели у острова {isle}: идут быстро и не кормятся. Гуннар хочет увидеть их своими глазами и добыть одного — чтобы понять, от чего они бегут.',
      ],
      d: [
        'The herd passes under your keel without slowing. The one you took has not eaten for many days.',
        'Стадо проходит под вашим килем, не сбавляя хода. Добытый кит не ел уже много дней.',
      ],
      s: ['isle', 'beast:whale'],
    },
    {
      t: ['Orcas at the Boats', 'Косатки у лодок'],
      b: [
        'The few boats still hunting are being rammed by orcas, and orcas do not ram boats. Gunnar says something has driven them mad. Drive them off, and pull the men from the water.',
        'Те немногие лодки, что ещё выходят на промысел, таранят косатки, а косатки лодок не таранят. Гуннар говорит, что их что-то свело с ума. Отгоните их и вытащите людей из воды.',
      ],
      d: [
        'A rescued harpooner shivers by the stove: “They were not hunting us. They were trying to make us stop listening.”',
        'Спасённый гарпунёр дрожит у печки: «Они не охотились на нас. Они хотели, чтобы мы перестали слушать».',
      ],
      s: ['beast:orca', 'rescue'],
    },
    {
      t: ['An Ear to the Ice', 'Ухом ко льду'],
      b: [
        'Gunnar takes you onto the shelf of {isle} and lies down on the ice with his ear to it, as his father taught him. He wants a second ear that does not belong to a whaler.',
        'Гуннар ведёт вас на ледяной шельф острова {isle} и ложится, прижавшись ухом ко льду, как учил его отец. Ему нужно второе ухо — не китобойское.',
      ],
      d: [
        'Under the ice, slow and patient, a bell: one stroke, then a long silence, then another.',
        'Подо льдом, медленно и терпеливо, звонит колокол: удар, долгая тишина, ещё удар.',
      ],
      s: ['land', 'hub'],
    },
    {
      t: ['The Last Barrels', 'Последние бочки'],
      b: [
        'Gunnar’s last oil, from the summer’s hunt, lies at {port}, and the lamp-makers of {port2} will pay double now that oil is scarce. That money will keep the town alive until the whales come back.',
        'Последний жир Гуннара, от летней охоты, лежит в порту {port}, а мастера ламп в порту {port2} теперь платят вдвое: жира стало мало. Эти деньги продержат город, пока не вернутся киты.',
      ],
      d: [
        'The lamp-makers pay without haggling. One of them asks, very quietly, whether it is true the ice is ringing.',
        'Мастера ламп платят не торгуясь. Один из них совсем тихо спрашивает, правда ли, что лёд звонит.',
      ],
      s: ['carry:whale_oil'],
    },
    {
      t: ['Lance-Boats Without a Flag', 'Ланцетные лодки без флага'],
      b: [
        'Ships with no flag are slaughtering the fleeing herds with bomb-lances and leaving the kill to the gulls. Gunnar calls it a sin against the whole north. Stop them.',
        'Корабли без флага бьют убегающие стада разрывными гарпунами и бросают добычу чайкам. Гуннар называет это грехом против всего севера. Остановите их.',
      ],
      d: [
        'They were not after oil. Their orders were to drive the herds south, towards the sound, and to sink anyone who followed.',
        'Им был нужен не жир. По приказу они гнали стада на юг, к звону, и топили всех, кто шёл следом.',
      ],
      s: ['board:1', 'sink:2'],
    },
    {
      t: ['Grey Fins', 'Серые плавники'],
      b: [
        'Where the lance-boats killed, sharks gathered, and now they follow every hull in the strait, even the fishing skiffs. Thin them out, then set lines yourself to show the boys of {hub} the strait is safe.',
        'Там, где били ланцетные лодки, собрались акулы, и теперь они идут за каждым корпусом в проливе, даже за рыбачьими ялами. Проредите их, а потом сами поставьте снасти, чтобы мальчишки порта {hub} поверили: в проливе снова можно ловить.',
      ],
      d: [
        'The strait is quiet. In the morning three skiffs put out, and Gunnar watches them from the slipway until they vanish.',
        'В проливе тихо. Утром выходят три яла, и Гуннар провожает их взглядом со слипа, пока они не скрываются из виду.',
      ],
      s: ['beast:shark', 'catch'],
    },
    {
      t: ['The Whalers’ Moot', 'Сход китобоев'],
      b: [
        'Gunnar will not act alone. He sends you with his harpoon as a token to the sealers at {at}, then to the Order’s walled town, to call their elders to a moot.',
        'Гуннар не станет действовать в одиночку. Он посылает вас со своим гарпуном вместо грамоты к зверобоям в порт {at}, а потом в обнесённый стенами город Ордена — созвать их старейшин на сход.',
      ],
      d: [
        'Both send word: they will come. The sealers have heard the ringing too. The Order says it has heard nothing at all.',
        'Оба шлют ответ: придут. Зверобои тоже слышали звон. Орден утверждает, что не слышал ничего.',
      ],
      s: ['at:sealhold', 'at:frostgate'],
    },
    {
      t: ['A Chain into the Dark', 'Цепь в темноту'],
      b: [
        'Off {isle} the fishermen found a buoy painted grey, moored where no buoy should be. Its chain goes straight down. Send divers along the chain and see what hangs at the end.',
        'У острова {isle} рыбаки нашли выкрашенный в серое буй, поставленный там, где буев не бывает. Его цепь уходит прямо вниз. Спустите водолазов по цепи и посмотрите, что висит на её конце.',
      ],
      d: [
        'At the end of the chain, a small bell with a weighted tongue that the current swings back and forth. Someone is sowing them.',
        'На конце цепи — маленький колокол с утяжелённым языком, который раскачивает течение. Кто-то их сеет.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Buoy-Layers', 'Те, кто ставит буи'],
      b: [
        'A grey-sailed tender is laying new buoys along the whale road, one each mile, and her escort keeps the whalers off. Watch the strait until she comes back for more, then take her.',
        'Тендер под серыми парусами ставит новые буи вдоль китовой дороги, по одному на милю, а его охрана отгоняет китобоев. Караульте пролив, пока он не вернётся за новыми, и возьмите его.',
      ],
      d: [
        'Her hold is full of little bells, packed in straw like eggs. Her master has the mark of the Choir burned into his palm.',
        'Её трюм полон колокольчиков, переложенных соломой, как яйца. У шкипера на ладони выжжено клеймо Хора.',
      ],
      s: ['escort', 'board:1'],
    },
    {
      t: ['Harpooners for Hire', 'Гарпунёры в найм'],
      b: [
        'With the boats idle, the best harpooners of {hub} sit in the tavern and drink their last coin. Gunnar says a harpooner can put iron through a gunport at sixty yards. Sign them on.',
        'Пока лодки стоят, лучшие гарпунёры порта {hub} сидят в таверне и пропивают последнюю монету. Гуннар говорит, что гарпунёр на шестьдесят ярдов всадит железо прямо в орудийный порт. Наберите их.',
      ],
      d: [
        'They bring their own irons and their own songs, and the songs are better than the irons.',
        'Они приносят свои гарпуны и свои песни, и песни у них лучше гарпунов.',
      ],
      s: ['recruit', 'hub'],
    },
    {
      t: ['A Try-Works of Your Own', 'Своя салотопня'],
      b: [
        'Gunnar says no captain should go north without her own oil, and offers you his old try-pots for your island, if you build the furnace to hold them.',
        'Гуннар говорит, что ни один капитан не должен идти на север без своего жира, и отдаёт вам старые котлы для вашего острова — если вы сложите под них печь.',
      ],
      d: [
        'The furnace smokes for the first time over your hidden harbour, and the bell under its turf roof is warm for once.',
        'Над вашей тайной гаванью впервые дымит печь, и колокол под дерновой крышей хоть раз лежит в тепле.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Leads in the Pack', 'Разводья во льдах'],
      b: [
        'The ice moves every week, and the old charts lead into dead ends. Gunnar’s eyes are not what they were. Chart the islands the pack has opened, so the whalers can follow you.',
        'Лёд движется каждую неделю, и старые карты заводят в тупики. Глаза у Гуннара уже не те. Нанесите на карту острова, которые открылись среди льдов, чтобы китобои могли идти за вами.',
      ],
      d: [
        'Every lead you chart bends the same way, as if the ice itself were being drawn towards one place.',
        'Каждое разводье, нанесённое вами, изгибается в одну сторону, будто сам лёд тянет к одному месту.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Old Bull', 'Старый самец'],
      b: [
        'The old bull that has led the herds for sixty years has turned on the boats, and he has already stove in four. Gunnar knew him as a calf. He asks you to end it cleanly, and to let him watch.',
        'Старый самец, что шестьдесят лет водил стада, стал бросаться на лодки и уже разбил четыре. Гуннар знал его ещё китёнком. Он просит покончить с этим чисто — и позволить ему смотреть.',
      ],
      d: [
        'In the old bull’s hide a bell-buoy’s chain is wound three times. Gunnar takes off his cap and says nothing for a long while.',
        'Шкура старого самца трижды перехвачена цепью от колокольного буя. Гуннар снимает шапку и долго молчит.',
      ],
      s: [['beast:whale:1', 'Hunt down the old bull of the herds.', 'Добудьте старого вожака стад.'], 'hub'],
    },
    {
      t: ['Whalers in Masks', 'Китобои в масках'],
      b: [
        'Two whale-ships are working the strait under the colours of {port}, but no whaler there owns them, and their crews wear grey cloth over their faces against the cold. Gunnar does not believe in that cold.',
        'В проливе промышляют два китобойца под флагом порта {port}, только ни один тамошний китобой ими не владеет, а их команды прячут лица под серыми масками — якобы от холода. Гуннар в такой холод не верит.',
      ],
      d: [
        'The harbour master at {port} has never heard of them. In their holds: no oil, only ice saws and chain.',
        'Начальник порта {port} о них никогда не слышал. В их трюмах — ни капли жира, только ледовые пилы и цепи.',
      ],
      s: ['board:2', 'port'],
    },
    {
      t: ['The Empty Rookery', 'Пустое лежбище'],
      b: [
        'The seals have left their rookery on {isle}, a thing the sealers say has never happened. Land among the empty breathing-holes and see what frightened them.',
        'Тюлени ушли со своего лежбища на острове {isle} — зверобои говорят, такого не бывало никогда. Высадитесь среди опустевших продухов и посмотрите, что их напугало.',
      ],
      d: [
        'The breathing-holes are frozen over, all but one, and that one has been sawn square and wide enough for a bell.',
        'Продухи затянуло льдом, все, кроме одного, а тот выпилен ровным квадратом — как раз под колокол.',
      ],
      s: ['land:seals', 'hub'],
    },
    {
      t: ['A Heron in the North', 'Цапля на севере'],
      b: [
        'A brig with a grey heron on her flag put in at {port} last week and left before the tide. Gunnar did not like her captain’s laugh. Find out what she bought.',
        'Бриг с серой цаплей на флаге на прошлой неделе заходил в порт {port} и ушёл до прилива. Гуннару не понравилось, как смеётся его капитан. Узнайте, что он купил.',
      ],
      d: [
        'Corvin Hale bought every chart of the ice shelf there was, paid in Crown silver, and sailed for the dead calms of the south.',
        'Корвин Хейл скупил все карты ледового шельфа, какие были, заплатил серебром Короны и ушёл на юг, к мёртвым штилям.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Thin Ice', 'Тонкий лёд'],
      b: [
        'At night ships with iron bows are cutting a channel through the fast ice towards the fjord, and the whalers who went to look did not come back. Gunnar wants that channel closed with their own hulls.',
        'По ночам корабли с железными форштевнями прорубают канал в припае к фьорду, а китобои, что ходили посмотреть, не вернулись. Гуннар хочет, чтобы этот канал закрыли их же корпусами.',
      ],
      d: [
        'The channel is choked with wreckage. Frost will seal it by morning, and whoever comes next must cut it again.',
        'Канал забит обломками. К утру его скуёт мороз, и тем, кто придёт следом, придётся рубить заново.',
      ],
      s: ['sink:4', 'hub'],
    },
    {
      t: ['Follow the Ringing', 'Идти на звон'],
      b: [
        'With the buoys cut, one sound is left: the deep, slow bell that Gunnar heard through the ice. Take soundings past {isle} and on to {isle2}, and let Jory listen at the rail.',
        'Буи срезаны, и остался один звук — тот глубокий, медленный колокол, что Гуннар слышал сквозь лёд. Пройдите с промерами мимо острова {isle} и дальше, к острову {isle2}, а Джори пусть слушает у борта.',
      ],
      d: [
        'Jory points every time, and every time towards the fjord where the Order keeps its walled town.',
        'Джори всякий раз указывает в одну сторону — к фьорду, где стоит обнесённый стенами город Ордена.',
      ],
      s: ['isle', 'isle2', 'hub'],
    },
    {
      t: ['The Whale Road Closed', 'Китовая дорога закрыта'],
      b: [
        'The Bell-Warden’s ice-cutters have come out in force to close the whale road for good, and the maddened orcas run ahead of them. Gunnar takes his place in your bow with his father’s harpoon. Break the line.',
        'Ледорезы Звонаря вышли всей силой, чтобы закрыть китовую дорогу навсегда, а впереди них идут обезумевшие косатки. Гуннар встаёт к вам на нос с отцовским гарпуном. Прорвите их строй.',
      ],
      d: [
        'On the flagship of the cutters: a chart with a church tower drawn beneath the ice of the fjord. Gunnar says, “So that is where the herds are fleeing from.”',
        'На флагмане ледорезов — карта, где подо льдом фьорда нарисована колокольня. Гуннар говорит: «Так вот от чего бегут стада».',
      ],
      s: ['escort', 'beast:orca', 'board:2', 'hub'],
    },
  ],
};
