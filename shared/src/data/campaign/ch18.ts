// Chapter 18 — Mirrorfen (Act III, the Northern Waters). The Brokers reveal the Widow's design: ring the Gravetide,
// raise the Drowned Crown, drown the living coasts. Powder and a fleet must come from the Code (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 18,
  region: 'whispering',
  hub: 'mirrorfen',
  title: ['Mirrorfen', 'Зеркальная Топь'],
  blurb: [
    'Huts in the mangrove roots, mirror towers flashing through the fog, and an old woman who sells the truth at its full price. The Brokers know what the Widow wants. They want something in return.',
    'Хижины в корнях мангров, зеркальные башни, мигающие сквозь туман, и старуха, которая продаёт правду по полной цене. Брокеры знают, чего хочет Вдова. И хотят кое-что взамен.',
  ],
  giver: ['Wenna Sedge, oracle of the Brokers', 'Венна Седж, оракул Брокеров'],
  portrait: 'giver_hermit_f',
  reward: { title: ['North Wind', 'Северный ветер'] },
  quests: [
    {
      t: ['Through the Fog by Mirror', 'Сквозь туман по зеркалам'],
      b: [
        'The Brokers flashed word the night the squadron sank: bring the survivors to {hub}, and their old oracle will answer one question for nothing. The only way in is past {isle}, following the mirrors.',
        'В ночь гибели эскадры Брокеры передали зеркалами: привезите уцелевших в порт {hub}, и их старый оракул ответит на один вопрос даром. Пройти туда можно лишь мимо острова {isle}, следуя за вспышками зеркал.',
      ],
      d: [
        'Wenna Sedge hears the survivors out, then turns her blind eyes to you. “One question. Choose it well.”',
        'Венна Седж выслушивает уцелевших и обращает к вам незрячие глаза. «Один вопрос. Выбирайте его с умом».',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Price of an Answer', 'Цена ответа'],
      b: [
        'You ask what the Widow wants. Wenna laughs: that is not one question but a hundred, and the Brokers sell them one at a time. First, a captain owes them a year of secrets and has stopped paying. Collect.',
        'Вы спрашиваете, чего хочет Вдова. Венна смеётся: это не один вопрос, а сотня, и Брокеры продают их по одному. Для начала — капитан, задолжавший им год тайн, перестал платить. Взыщите долг.',
      ],
      d: [
        'In the debtor’s cabin: a locked box of letters, every one sealed with grey wax.',
        'В каюте должника — запертый ящик писем, и каждое запечатано серым воском.',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['The Dark Tower', 'Тёмная башня'],
      b: [
        'One mirror tower has gone dark on {isle}, and with it the Brokers’ chain to the south. Its keeper has not answered for a week. Something has made its nest in the roots below the tower.',
        'На острове {isle} погасла одна зеркальная башня, а с ней оборвалась цепь Брокеров на юг. Смотритель не отвечает уже неделю. Что-то свило гнездо в корнях под башней.',
      ],
      d: [
        'The tower flashes again. The keeper’s mirror lay face down, with a grey ribbon tied around it.',
        'Башня снова мигает. Зеркало смотрителя лежало лицом вниз, перевязанное серой лентой.',
      ],
      s: ['land', 'lair'],
    },
    {
      t: ['Mara Quill’s Bundle', 'Свёрток Мары Квилл'],
      b: [
        'Wenna says the Brokers have kept the Widow’s letters for years against a day like this. Mara Quill holds them at {at}, and she will hand them only to the captain who dealt with her before.',
        'Венна говорит, что Брокеры годами хранили письма Вдовы на такой вот день. Они у Мары Квилл в порту {at}, и отдаст она их только тому капитану, с которым уже имела дело.',
      ],
      d: [
        'Letters to the last admiral of the Drowned Crown, in the same woman’s hand as the wreckers’ ledger — and dated more than a century ago.',
        'Письма последнему адмиралу Утонувшей короны, написанные той же женской рукой, что и счётная книга мародёров, — и датированные больше чем столетием назад.',
      ],
      s: ['at:fogmouth', 'hub'],
    },
    {
      t: ['Bronze in the Channels', 'Бронза в протоках'],
      b: [
        'The Choir runs bell-bronze through the fen’s back channels in flat boats too low to see in the fog. The Brokers want them gone, and one taken whole, so they can read where it was going.',
        'Хор возит колокольную бронзу задними протоками топи на плоскодонках, таких низких, что в тумане их не разглядеть. Брокеры хотят, чтобы их не стало, а одну взяли целой — чтобы узнать, куда она шла.',
      ],
      d: [
        'The captured boat’s pilot-book lists the bronze by weight, and every weight ends in the same mark: a ringed bell.',
        'В лоцманской книге захваченной лодки бронза расписана по весу, и каждая запись кончается одним знаком — колоколом в круге.',
      ],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['The Old Cipher', 'Старый шифр'],
      b: [
        'Half of the Widow’s letters are written in the old Crown cipher. The key, Wenna says, was carved on a stone at the drowned shrine of {isle}, where the Crown’s admirals swore their oaths.',
        'Половина писем Вдовы написана старым шифром Короны. Ключ, говорит Венна, вырезан на камне в затопленном святилище острова {isle}, где адмиралы Короны приносили присягу.',
      ],
      d: [
        'You copy the key by lantern-light, with the tide rising round your boots.',
        'Вы переписываете ключ при свете фонаря, а прилив поднимается к самым сапогам.',
      ],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['Fen Fever', 'Болотная лихорадка'],
      b: [
        'The squadron’s survivors are down with fen fever, and more still drift in the fog on spars and hatch-covers. Pull the last of them out, and bring medicine before the fever takes those already saved.',
        'Уцелевших моряков эскадры свалила болотная лихорадка, а в тумане на обломках рангоута и крышках люков дрейфуют всё новые. Вытащите последних и привезите лекарства, пока лихорадка не забрала уже спасённых.',
      ],
      d: [
        'The fever breaks. The commodore, still weak, asks only whether the Widow was real.',
        'Лихорадка отступает. Коммодор, ещё слабый, спрашивает лишь об одном: была ли Вдова на самом деле.',
      ],
      s: ['rescue', 'bring:medicine'],
    },
    {
      t: ['The Mirror Watch', 'Зеркальный дозор'],
      b: [
        'Tonight the towers will carry the deciphered letters to every Broker in the archipelago. Choir hunters know it, and they are out in the fog, waiting for the flashes. Keep the waters clear until the last signal is sent.',
        'Этой ночью башни передадут расшифрованные письма всем Брокерам архипелага. Охотники Хора знают об этом и ждут вспышек в тумане. Держите воды чистыми, пока не уйдёт последний сигнал.',
      ],
      d: [
        'The last flash goes out at dawn. Across the archipelago, the Brokers are reading the Widow’s mind.',
        'Последняя вспышка гаснет на рассвете. По всему архипелагу Брокеры читают мысли Вдовы.',
      ],
      s: ['escort', 'sink:2:hunter'],
    },
    {
      t: ['Only the Drowned Hear', 'Слышат только утопленники'],
      b: [
        'A message has come along the mirrors from far in the east, relayed across a hundred islands, and the chain broke at {isle}. The last tower there is dark. Carry the final words across to {isle2} by hand.',
        'По зеркалам с далёкого востока, через сотню островов, пришло послание, и цепь оборвалась у острова {isle}. Последняя башня там темна. Перенесите последние слова к острову {isle2} сами.',
      ],
      d: [
        'The message is signed Ilse Harrow, and it is a single line: “Only the drowned hear the bells.”',
        'Послание подписано именем Ильзе Харроу, и в нём одна строка: «Колокола слышат только утопленники».',
      ],
      s: ['isle', 'isle2', 'hub'],
    },
    {
      t: ['Smoke for the Oracle', 'Дым для оракула'],
      b: [
        'Wenna reads the fog through the smoke of dreamleaf, and her store is gone. The Crown’s patrols have been seizing every leaf in the archipelago. Bring her a cargo, and see the patrols do not take it.',
        'Венна читает туман сквозь дым дурман-листа, а её запас иссяк. Патрули Короны изымают по архипелагу каждый лист. Привезите ей груз — и проследите, чтобы патрули его не отняли.',
      ],
      d: [
        'Wenna breathes the smoke and her blind eyes move, as if following ships no one else can see.',
        'Венна вдыхает дым, и её незрячие глаза движутся, будто следят за кораблями, которых не видит никто другой.',
      ],
      s: ['sink:2:patrol', 'bring:dreamleaf'],
    },
    {
      t: ['A Broker Who Sold Out', 'Продажный брокер'],
      b: [
        'The deciphered letters name a Broker at {port} who has sold every flash he ever read to the Choir. The fen does not hang its traitors. It takes their ships and lets them swim.',
        'В расшифрованных письмах назван брокер из порта {port}, который продавал Хору каждую прочитанную вспышку. Топь не вешает своих предателей. Она забирает их корабли и даёт им плыть.',
      ],
      d: [
        'He swims for the reeds without a word. In his cabin, a mirror that flashes only grey.',
        'Он молча плывёт к камышам. В его каюте — зеркало, которое вспыхивает только серым.',
      ],
      s: ['port', 'board:1'],
    },
    {
      t: ['She Is Tuning Them', 'Она их настраивает'],
      b: [
        'Wenna will read the fog for you tonight, but a reading lasts until dawn and the Choir would pay well to break it. Keep watch over the fen while she reads.',
        'Этой ночью Венна прочтёт для вас туман, но гадание длится до рассвета, и Хор щедро заплатит тому, кто его прервёт. Несите дозор над топью, пока она читает.',
      ],
      d: [
        'At dawn Wenna speaks: “She is not collecting the bells. She is tuning them, one to the next, like a choir.”',
        'На рассвете Венна говорит: «Она не собирает колокола. Она настраивает их, один к другому, как хор».',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['The Reed Cache', 'Тайник в камышах'],
      b: [
        'The Choir keeps bronze at a smugglers’ landing on {isle}, waiting for a ship to carry it east. The Brokers want it in the fen’s own vaults, and the ship that comes for it taken before it can sail.',
        'Хор держит бронзу у стоянки контрабандистов на острове {isle} в ожидании корабля, который отвезёт её на восток. Брокеры хотят видеть её в хранилищах топи, а пришедший за ней корабль — захваченным, прежде чем он отчалит.',
      ],
      d: [
        'Two tons of bell-bronze sink into the fen’s black water, where no Choir diver will ever find them.',
        'Две тонны колокольной бронзы уходят в чёрную воду топи, где их не найдёт ни один водолаз Хора.',
      ],
      s: ['land:smugglers', 'board:1'],
    },
    {
      t: ['Channels Without Names', 'Безымянные протоки'],
      b: [
        'Wenna says the fen moves: every spring the channels change, and the Choir’s pilots know the new ones before the Brokers do. Put the islands no one has drawn this year on the chart.',
        'Венна говорит, что топь движется: каждую весну протоки меняются, и лоцманы Хора узнают новые раньше Брокеров. Нанесите на карту острова, которых в этом году ещё никто не рисовал.',
      ],
      d: [
        'Wenna runs her fingers over your marks and nods, as if she could see them.',
        'Венна проводит пальцами по вашим пометкам и кивает, будто видит их.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['A Mirror of Your Own', 'Собственное зеркало'],
      b: [
        'The Brokers do not give gifts; they make investments. Wenna sends a mirror-wright to raise a tower on your hidden island, so that the fen can speak to you wherever you sail.',
        'Брокеры не делают подарков — они вкладываются. Венна отправляет мастера зеркал поставить башню на вашем тайном острове, чтобы топь могла говорить с вами, куда бы вы ни ушли.',
      ],
      d: [
        'The new tower flashes its first word across the fog: “Welcome.” The second is a bill.',
        'Новая башня шлёт сквозь туман первое слово: «Добро пожаловать». Второе — счёт.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Papers for the Crown', 'Бумаги для Короны'],
      b: [
        'Wenna needs a chest of the Brokers’ papers carried past the Crown’s inspectors, who have been told to seize anything that comes out of the fen. Get it through, and do not let them open the lid.',
        'Венне нужно провезти мимо досмотрщиков Короны сундук с бумагами Брокеров, а тем велено изымать всё, что выходит из топи. Пройдите досмотр и не дайте им поднять крышку.',
      ],
      d: [
        'The inspector stamps your manifest and never asks what the chest holds. It was a list of his own debts.',
        'Досмотрщик ставит печать на вашу опись и даже не спрашивает про сундук. В нём был список его собственных долгов.',
      ],
      s: ['customs', 'hub'],
    },
    {
      t: ['The Carving Under the Water', 'Резьба под водой'],
      b: [
        'Wenna has one last thing to show you, and it lies below the water off {isle}: a drowned wall of the old Crown, carved with what the Gravetide does. Send your divers to read it.',
        'Венне осталось показать вам последнее, и лежит оно под водой у острова {isle}: затонувшая стена старой Короны, на которой вырезано, что творит Гробовой прилив. Спустите водолазов прочесть её.',
      ],
      d: [
        'The divers draw it from memory: bells ringing in a ring, a crown rising from the waves, and every coast beneath them going under.',
        'Водолазы рисуют по памяти: колокола, звонящие по кругу, корона, встающая из волн, и все берега под ними, уходящие под воду.',
      ],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['The Widow’s Design', 'Замысел Вдовы'],
      b: [
        'Now Wenna tells it whole. A Choir envoy is in hiding at {port}, ready to bargain with the Brokers for passage east. Bring him to the fen under your guns, and hear the oracle out in front of him.',
        'Теперь Венна рассказывает всё. В порту {port} прячется посланник Хора, готовый выторговать у Брокеров проход на восток. Доставьте его в топь под прикрытием ваших пушек и выслушайте оракула при нём.',
      ],
      d: [
        'She will ring the Gravetide, raise the Drowned Crown and drown the living coasts. The envoy does not deny a word of it.',
        'Она прозвонит Гробовой прилив, поднимет Утонувшую корону и утопит живые берега. Посланник не отрицает ни слова.',
      ],
      s: ['port', 'escort'],
    },
    {
      t: ['Powder and Ships', 'Порох и корабли'],
      b: [
        'The Crown will not believe the Brokers, and the Order has spent its ships. Wenna says the only powder and the only fleet that can stand against the Choir belong to the Code, far south among the smoking cones. She writes you a letter for Hask Morrow.',
        'Корона не поверит Брокерам, а орден растратил свои корабли. Венна говорит: единственный порох и единственный флот, способные выстоять против Хора, принадлежат Кодексу — далеко на юге, среди дымящихся вулканов. Она пишет вам письмо к Хаску Морроу.',
      ],
      d: [
        '“Morrow serves no one,” Wenna warns, sealing it. “He will make you prove yourself. Let him.”',
        '«Морроу не служит никому, — предупреждает Венна, запечатывая письмо. — Он заставит вас доказать, чего вы стоите. Не мешайте ему».',
      ],
      s: ['hub'],
    },
    {
      t: ['The Choir Answers', 'Ответ Хора'],
      b: [
        'The Choir has learned what the Brokers know. Fireboats came out of the fog at midnight and set a tower burning. Sink the raiders, and take one of their ships for the Brokers to question.',
        'Хор узнал то, что знают Брокеры. В полночь из тумана вышли брандеры и подожгли одну из башен. Потопите налётчиков и возьмите один из их кораблей, чтобы Брокеры могли допросить команду.',
      ],
      d: [
        'The prisoners say the Choir will come for the fen in force, before the fog lifts.',
        'Пленные говорят, что Хор придёт за топью всей силой, прежде чем поднимется туман.',
      ],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['The Keepers Who Signal', 'Смотрители, подающие знаки'],
      b: [
        'The old lighthouse conspiracy at {at} was never broken root and branch. Two of its keepers are flashing the fen’s positions to the Choir’s ships. Put in, find the lamps, and sink the ships that answer them.',
        'Старый заговор смотрителей маяков в порту {at} так и не вырвали с корнем. Двое смотрителей передают кораблям Хора положение топи. Зайдите в порт, найдите их фонари и потопите корабли, что им отвечают.',
      ],
      d: [
        'The lamps are smashed. Out in the fog, the Choir’s ships are blind.',
        'Фонари разбиты. В тумане корабли Хора ослепли.',
      ],
      s: ['at:widows_wick', 'sink:2'],
    },
    {
      t: ['When the Fog Lifts', 'Когда поднимется туман'],
      b: [
        'The Choir comes for the fen at dawn, a line of grey sails pushing through the channels toward the mirror towers. The Brokers have no fleet. Wenna has only you.',
        'Хор приходит за топью на рассвете: линия серых парусов пробивается протоками к зеркальным башням. Флота у Брокеров нет. У Венны есть только вы.',
      ],
      d: [
        'The fen burns at its edges, but the towers stand. Wenna presses the sealed letter into your hand: “Go south, North Wind. Ash is waiting.”',
        'Топь горит по краям, но башни стоят. Венна вкладывает вам в руку запечатанное письмо: «Идите на юг, Северный ветер. Вас ждёт пепел».',
      ],
      s: ['escort', 'sink:4', 'board:1', 'hub'],
    },
  ],
};
