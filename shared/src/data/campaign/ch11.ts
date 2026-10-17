// Chapter 11 — The Keepers' Conspiracy (Act III, The Northern Waters). The lighthouse keepers of the fog have been
// bought: false lights across the archipelago, ships on the rocks, and a letter in the Widow's hand about «the northern
// bells» (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 11,
  region: 'whispering',
  hub: 'widows_wick',
  title: ['The Keepers’ Conspiracy', 'Заговор смотрителей'],
  blurb: [
    'A cliff village round the tallest light in the fog, where half the women wear black. The lights of the archipelago have begun to lie, and their keepers are paid for it.',
    'Деревня на скале вокруг самого высокого маяка в тумане, где половина женщин носит чёрное. Огни архипелага начали лгать, и их смотрителям за это платят.',
  ],
  giver: ['Hester Lume, keeper of the tall light', 'Эстер Люм, смотрительница высокого маяка'],
  portrait: 'giver_lighthouse_keeper_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['The Tallest Light', 'Самый высокий маяк'],
      b: [
        'The Bell-Warden has gone north, but on the way after him the fog has grown thick with wrecks. Only one light in the archipelago still burns true, and its keeper has sent for you to {hub}.',
        'Звонарь ушёл на север, но на пути за ним туман полон свежих крушений. Во всём архипелаге честно горит лишь один маяк, и его смотрительница зовёт вас в порт {hub}.',
      ],
      d: [
        'Hester Lume trims the wick without looking up. “My husband went onto the rocks under a light he trusted. Sit down.”',
        'Эстер Люм подрезает фитиль, не поднимая глаз. «Мой муж разбился о скалы под огнём, которому верил. Садитесь».',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['A Light That Lies', 'Огонь, который лжёт'],
      b: [
        'Hester has kept the book of lights for thirty years. The light on {isle} should burn green over the safe channel; three ships swore it burned red. Go and see which.',
        'Эстер тридцать лет ведёт книгу огней. Маяк на острове {isle} должен гореть зелёным над безопасным проходом, а три корабля клянутся, что он горел красным. Сходите и посмотрите сами.',
      ],
      d: [
        'Red, steady and bright, over the one channel that ends on the reef.',
        'Красный, ровный и яркий — над тем самым проходом, что кончается рифом.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['A Stranger at the Lamp', 'Чужой у лампы'],
      b: [
        'The keeper of {isle} is listed in Hester’s book as an old man with one hand. Land and see who trims his wick now.',
        'В книге Эстер смотритель острова {isle} записан как старик с одной рукой. Высадитесь и посмотрите, кто теперь подрезает там фитиль.',
      ],
      d: [
        'A young man with two good hands and a Choir medal under his shirt. Of the old keeper he says only, “Retired.”',
        'Молодой человек с двумя здоровыми руками и медалью Хора под рубахой. О старом смотрителе говорит одно: «Ушёл на покой».',
      ],
      s: ['isle', 'land'],
    },
    {
      t: ['Wrecked to Order', 'Крушение по заказу'],
      b: [
        'A grain ship followed the red light last night and broke her back on the reef. Her crew are clinging to the rocks with the tide coming in. Take off whoever you can and land them at {port}.',
        'Прошлой ночью зерновоз пошёл на красный огонь и переломился на рифе. Его команда держится за скалы, а прилив поднимается. Снимите всех, кого сможете, и высадите их в порту {port}.',
      ],
      d: [
        'The mate says the light was moving. Lights on towers do not move. Lights on boats do.',
        'Помощник шкипера говорит, что огонь двигался. Огни на башнях не двигаются. Двигаются огни на лодках.',
      ],
      s: ['rescue', 'port'],
    },
    {
      t: ['The Oil Boats', 'Масляные лодки'],
      b: [
        'Every false light needs oil, and in the fog oil travels by small boats with muffled oars. Hester knows their hour. Stop them at sea and see whose barrels they carry.',
        'Каждому ложному огню нужно масло, а в тумане масло возят на лодках с обмотанными вёслами. Эстер знает их час. Перехватите их в море и посмотрите, чьи на них бочки.',
      ],
      d: [
        'The barrels are branded with a small bell, and the oil smells of the Choir’s incense.',
        'На бочках выжжен колокольчик, а масло пахнет ладаном Хора.',
      ],
      s: ['board:1', 'sink:2'],
    },
    {
      t: ['Messages in Mirrors', 'Вести в зеркалах'],
      b: [
        'The keepers talk to one another through the Brokers’ mirror towers, and the Brokers keep a copy of every flash. A Broker at {at} owes Hester a favour from a winter long ago.',
        'Смотрители переговариваются через зеркальные башни Брокеров, а Брокеры хранят копию каждой вспышки. Один Брокер в порту {at} должен Эстер услугу с давней зимы.',
      ],
      d: [
        'He hands over a strip of paper covered in dots. “I never saw you,” he says, “and this is not a cipher.”',
        'Он отдаёт полоску бумаги, покрытую точками. «Я вас не видел, — говорит он, — а это не шифр».',
      ],
      s: ['at:mirrorfen', 'hub'],
    },
    {
      t: ['The Price of a Key', 'Цена ключа'],
      b: [
        'The dots are a cipher after all, and the only man who reads it lives among the houseboats of {at}. He wants no money, only a favour: sell some goods for him where the Crown cannot see.',
        'Точки всё-таки шифр, и прочесть его может лишь один человек — он живёт среди плавучих домов порта {at}. Денег он не хочет, только услугу: продать за него кое-какой товар там, где Корона не видит.',
      ],
      d: [
        'He reads the strip aloud: “On the night of no moon, every light at once.”',
        'Он читает полоску вслух: «В безлунную ночь — все огни разом».',
      ],
      s: ['at:hushwater', 'contraband'],
    },
    {
      t: ['Honest Oil', 'Честное масло'],
      b: [
        'The honest keepers who are left have run short of oil, because the Choir has bought up the whole season. Take whale oil from {port} to the true light at {port2} before it gutters.',
        'Честным смотрителям, которые ещё остались, не хватает масла: Хор скупил его на весь сезон. Отвезите китовый жир из порта {port} к честному огню в порту {port2}, пока тот не погас.',
      ],
      d: [
        'The old keeper fills the lamp with shaking hands and keeps a lantern lit by the door all night, for you.',
        'Старый смотритель дрожащими руками заливает лампу и всю ночь держит у двери зажжённый фонарь — для вас.',
      ],
      s: ['carry:whale_oil'],
    },
    {
      t: ['The Smugglers Saw', 'Контрабандисты видели'],
      b: [
        'Smugglers love a dark coast and hate a false one: a false light wrecks them too. Their cove on {isle} sees every boat that passes. Land and ask what they saw.',
        'Контрабандисты любят тёмный берег и ненавидят лживый: ложный огонь топит и их. Из их бухты на острове {isle} видна каждая проходящая лодка. Высадитесь и спросите, что они видели.',
      ],
      d: [
        'They saw a boat that changes the glass in the lamps, and a woman in grey who paid the boatmen.',
        'Они видели лодку, которая меняет стёкла в фонарях, и женщину в сером, которая платила лодочникам.',
      ],
      s: ['land:smugglers', 'hub'],
    },
    {
      t: ['Sons of the Village', 'Сыновья деревни'],
      b: [
        'The widows of {hub} will not let their sons sail with a stranger, but they will let them sail against the lights that made them widows. Hester vouches for you. Take the ones who come.',
        'Вдовы порта {hub} не отпустят сыновей с чужим капитаном, но отпустят их воевать с огнями, что сделали их вдовами. Эстер ручается за вас. Возьмите тех, кто придёт.',
      ],
      d: [
        'The mothers stand on the cliff and do not wave. That, Hester says, is how they wish you luck here.',
        'Матери стоят на скале и не машут. Так, говорит Эстер, здесь желают удачи.',
      ],
      s: ['recruit', 'escort'],
    },
    {
      t: ['Red Glass, Green Glass', 'Красное стекло, зелёное стекло'],
      b: [
        'Hester has cut true glass for two of the false lights. Land on {isle} and put the green back over the channel, then sail past {isle2} and see whether its light has turned as well.',
        'Эстер нарезала честные стёкла для двух лживых маяков. Высадитесь на острове {isle} и верните зелёный огонь над проходом, а потом пройдите мимо острова {isle2} и посмотрите, не переменился ли и его огонь.',
      ],
      d: [
        'The first light burns green again. The second is dark altogether, and its door is nailed shut from outside.',
        'Первый маяк снова горит зелёным. Второй тёмен совсем, а его дверь заколочена снаружи.',
      ],
      s: ['land', 'isle2', 'hub'],
    },
    {
      t: ['The Keepers’ Guard', 'Стража смотрителей'],
      b: [
        'Now the false lights have guards: pirate sloops paid to wait at the foot of each tower. Hester says pirates love a wreck more than any coin. Show them a wreck of their own.',
        'Теперь у ложных маяков есть охрана: пиратские шлюпы, нанятые стоять у подножия каждой башни. Эстер говорит, что пираты любят крушение больше любой монеты. Устройте им собственное.',
      ],
      d: [
        'One of the sloops carries a keeper’s bell, the kind rung to warn ships off the rocks. Its tongue has been cut out.',
        'На одном шлюпе нашёлся сторожевой колокол — из тех, что звонят, отгоняя корабли от скал. Язык у него вырезан.',
      ],
      s: ['sink:3:pirate', 'board:1'],
    },
    {
      t: ['A Keeper Turns', 'Смотритель сдаётся'],
      b: [
        'One of the bought keepers rows out each night to collect his pay. Hester wants him alive and frightened, not drowned. Take his boat and bring him to {hub}.',
        'Один из купленных смотрителей каждую ночь выходит на лодке за платой. Эстер нужен он живым и напуганным, а не утопленным. Захватите его лодку и привезите его в порт {hub}.',
      ],
      d: [
        'He talks before the kettle boils: the bought keepers meet once a season on a rock with no name, and they meet soon.',
        'Он заговаривает раньше, чем закипает чайник: купленные смотрители собираются раз в сезон на безымянной скале, и сбор уже скоро.',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['A Light of Your Own', 'Свой огонь'],
      b: [
        'Hester will not have you go blind into your own harbour while the coast lies. She draws you a small tower with a hooded lamp, seen only from the one true approach. Build it on your island.',
        'Эстер не хочет, чтобы вы входили в свою гавань вслепую, пока берег лжёт. Она чертит вам маленькую башню с закрытым фонарём, видным только с одного верного подхода. Постройте её на своём острове.',
      ],
      d: [
        'The hooded light burns for the first time. From the sea it is a single star, and only from the right place.',
        'Закрытый огонь загорается впервые. С моря это одна звезда — и только если смотреть с верного места.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Paid for the Dark', 'Плата за темноту'],
      b: [
        'The bought keepers are paid through a chandler at {port}, who sells wicks and buys silence. Find out who pays him, and follow the money on to {port2}.',
        'Купленным смотрителям платят через лавочника в порту {port}, который продаёт фитили и покупает молчание. Узнайте, кто платит ему, и проследите деньги дальше, до порта {port2}.',
      ],
      d: [
        'The money comes from a Choir house that buys no wicks at all, yet keeps a ledger of every light in the fog.',
        'Деньги идут из дома Хора, который не покупает ни одного фитиля, зато ведёт книгу всех огней в тумане.',
      ],
      s: ['port', 'port2'],
    },
    {
      t: ['Creatures in the Lamp-House', 'Твари в фонарной'],
      b: [
        'An old light on {isle} has stood dead for years, and something nests in its lamp-house now. Hester wants it relit as a true light, so the false ones have honest company. Clear it first.',
        'Старый маяк на острове {isle} давно мёртв, и в его фонарной теперь гнездится всякая тварь. Эстер хочет снова зажечь его честным огнём, чтобы лживым было с кем спорить. Сначала расчистите его.',
      ],
      d: [
        'On the stair you find the old keeper’s log. Its last page reads: “They asked me to change the glass. I said no.”',
        'На лестнице вы находите журнал старого смотрителя. На последней странице: «Меня просили сменить стекло. Я отказался».',
      ],
      s: ['lair', 'land:ruins'],
    },
    {
      t: ['The Wreck-Looter', 'Грабитель крушений'],
      b: [
        'Every ship that goes onto the rocks is stripped by morning, and always by the same captain, one the Hunters’ Guild has long wanted. He follows the false lights like a gull follows a trawler.',
        'Каждый разбитый корабль к утру обобран, и всегда одним и тем же капитаном — тем, кого Гильдия охотников давно разыскивает. Он идёт за ложными огнями, как чайка за траулером.',
      ],
      d: [
        'In his cabin, a calendar of the moon with one night circled in grey.',
        'В его каюте — лунный календарь, где одна ночь обведена серым.',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['Soundings by Day', 'Промеры при свете дня'],
      b: [
        'If the lights all lie at once, the only safe chart will be one made by daylight. Hester asks you to chart the islands the fog has hidden, while the sun still shows the rocks.',
        'Если все огни солгут разом, надёжной останется только карта, снятая при свете дня. Эстер просит нанести на неё острова, которые прятал туман, пока солнце ещё показывает скалы.',
      ],
      d: [
        'Hester copies your chart three times and sends the copies to three honest keepers.',
        'Эстер переписывает вашу карту трижды и рассылает копии трём честным смотрителям.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['A Bell Under the Light', 'Колокол под маяком'],
      b: [
        'On calm nights the fishermen hear a bell beneath the old tower off {isle}. Hester has heard it too, and says no keeper she knew ever hung a bell under water. Send divers down.',
        'В тихие ночи рыбаки слышат колокол под старой башней у острова {isle}. Эстер тоже его слышала и говорит, что ни один знакомый ей смотритель не вешал колокола под водой. Спустите водолазов.',
      ],
      d: [
        'Chained to the foot of the tower hangs a small bronze bell, new-cast, with the Choir’s mark. It rings with the tide.',
        'К подножию башни прикован маленький бронзовый колокол, свежей отливки, с клеймом Хора. Он звонит в такт приливу.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Moonless Night', 'Безлунная ночь'],
      b: [
        'The night circled in grey has come. The bought keepers are rowing out to their rock, and their pirate guard rows with them. Hold the water around {hub} so the tall light stays lit.',
        'Обведённая серым ночь настала. Купленные смотрители гребут к своей скале, а с ними пиратская охрана. Удержите воды вокруг порта {hub}, чтобы высокий маяк не погас.',
      ],
      d: [
        'The tall light burns all night. On the horizon the others go out one by one, as if someone were counting.',
        'Высокий маяк горит всю ночь. На горизонте остальные гаснут один за другим, будто кто-то их считает.',
      ],
      s: ['escort', 'sink:3', 'hub'],
    },
    {
      t: ['Every Light Goes Out', 'Гаснут все огни'],
      b: [
        'Hester has found the rock with no name: it lies off {isle}, and the bought keepers are on it now, with their boats drawn up below. Sail there in the dark, take their boats and land.',
        'Эстер нашла безымянную скалу: она у острова {isle}, и купленные смотрители сейчас на ней, а их лодки вытащены внизу. Идите туда в темноте, захватите лодки и высаживайтесь.',
      ],
      d: [
        'The keepers’ purse holds a letter in the Widow’s hand: “When the northern bells ring, let every light go dark.” Hester looks north and says nothing.',
        'В кошеле смотрителей — письмо, написанное рукой Вдовы: «Когда зазвонят северные колокола, пусть погаснут все огни». Эстер смотрит на север и молчит.',
      ],
      s: ['isle', 'board:2', 'land', 'hub'],
    },
  ],
};
