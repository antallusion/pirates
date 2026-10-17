// Chapter 8 — The Town on Stilts (Act II, The Merchants' Road). Mara Quill of the Fog Brokers; the Bell-Warden steps out
// of the fog for the first time (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 8,
  region: 'whispering',
  hub: 'fogmouth',
  title: ['The Town on Stilts', 'Город на сваях'],
  blurb: [
    'A town of stilts and shuttered lanterns, where secrets are sold by the ounce. Here the Bell-Warden steps out of the fog for the first time, and he already knows your name.',
    'Город на сваях и закрытых фонарях, где тайны продают на вес. Здесь из тумана впервые выходит Звонарь — и он уже знает ваше имя.',
  ],
  giver: ['Mara Quill, Fog Broker', 'Мара Квилл, брокер Тумана'],
  portrait: 'giver_fence_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['Lanterns Out', 'Фонари погашены'],
      b: [
        'The bell from the convoy road showed a town on stilts, and there is only one: {hub}, where the Fog Brokers trade in secrets with their lanterns out. Mara Quill, who sells the best of them, has been expecting you.',
        'На колоколе с конвойной дороги был нарисован город на сваях, а такой всего один — порт {hub}, где брокеры Тумана торгуют тайнами при погашенных фонарях. Мара Квилл, у которой лучшие из них, давно вас ждёт.',
      ],
      d: [
        'Mara sits in the dark and names your ship, your crew and the bell in your hold before you open your mouth.',
        'Мара сидит в темноте и называет ваш корабль, вашу команду и колокол в вашем трюме прежде, чем вы успеваете открыть рот.',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['Fever on the Stilts', 'Лихорадка на сваях'],
      b: [
        'Mara does not sell to strangers; she lets them owe her. The fever has come to the stilt-houses with the fog, and the first thing you will owe her is medicine.',
        'Мара не продаёт чужакам — она позволяет им быть у неё в долгу. С туманом в дома на сваях пришла лихорадка, и первое, чем вы ей обязаны, — лекарства.',
      ],
      d: [
        'The medicine goes from house to house in the dark. Mara writes your name in a book that has no other names in it.',
        'Лекарства в темноте расходятся от дома к дому. Мара вписывает ваше имя в книгу, где других имён нет.',
      ],
      s: ['bring:medicine'],
    },
    {
      t: ['Wax on the Water', 'Воск на воде'],
      b: [
        'The man who cast the bell you carry is called the Bell-Warden, Mara says, and he comes into the fog when he pleases. Two islands have seen his ship this month: {isle} and {isle2}.',
        'Человека, отлившего колокол у вас в трюме, зовут Звонарём, говорит Мара, и он приходит в туман, когда пожелает. В этом месяце его корабль видели у двух островов: {isle} и {isle2}.',
      ],
      d: [
        'Off both islands the water is ringed with floating wax, the drippings of a hundred candles burned at sea.',
        'У обоих островов по воде кругами плавает воск — натёкший с сотни свечей, сожжённых прямо в море.',
      ],
      s: ['isle', 'isle2', 'hub'],
    },
    {
      t: ['A Name on the Guild Board', 'Имя на доске гильдии'],
      b: [
        'The Hunters’ Guild has nailed a new name to its board: a captain who sails in the Warden’s escort. Mara will tell you more once he is on the bottom.',
        'Гильдия охотников прибила к своей доске новое имя — капитана, который ходит в охране Звонаря. Мара расскажет больше, когда он окажется на дне.',
      ],
      d: [
        'His log floats up from the wreck, its last page reading: “The Warden asks for the captain with the little bell.”',
        'Из-под обломков всплывает его журнал, и на последней странице написано: «Звонарь спрашивает о капитане с колокольчиком».',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['The Mirror That Lies', 'Лживое зеркало'],
      b: [
        'One of the Brokers’ mirror towers at {at} flashes messages no Broker sent. Mara wants the tower found and its keeper asked why.',
        'Одна из зеркальных башен брокеров в порту {at} передаёт послания, которых ни один брокер не отправлял. Мара хочет найти эту башню и спросить смотрителя, зачем он это делает.',
      ],
      d: [
        'The keeper confesses: the Warden pays him to flash one word each night towards the open sea, the hour of the tide.',
        'Смотритель признаётся: Звонарь платит ему за то, чтобы каждую ночь он посылал в открытое море одно слово — час прилива.',
      ],
      s: ['at:mirrorfen', 'hub'],
    },
    {
      t: ['A New Master in the Fog', 'Новый хозяин тумана'],
      b: [
        'The pirates of {region} who used to pay the Brokers for passage have stopped paying. Mara says someone is paying them better, and wants to know who before the fog changes hands.',
        'Пираты вод «{region}», что прежде платили брокерам за проход, платить перестали. Мара говорит, что кто-то платит им больше, и хочет узнать кто, пока туман не сменил хозяина.',
      ],
      d: [
        'The captured mate says they have a new master now: a captain in a silver mask who never raises his voice.',
        'Пленный помощник капитана говорит, что у них теперь новый хозяин — капитан в серебряной маске, который никогда не повышает голоса.',
      ],
      s: ['sink:3:pirate', 'board:1'],
    },
    {
      t: ['Kitty’s Runner', 'Гонец от Китти'],
      b: [
        'A runner from Kitty Marsh reaches {hub}: the masked captain has been seen in her channels, and her boats have stopped coming home. She asks you to come to {at} at once.',
        'В порт {hub} прибегает гонец от Китти Марш: капитана в маске видели в её протоках, и её лодки перестали возвращаться. Она просит вас немедленно прийти в порт {at}.',
      ],
      d: [
        'Kitty’s channels are quiet again. She says the masked ship passed so close that she could hear its crew singing: three notes, slow.',
        'В протоках Китти снова тихо. Она говорит, что корабль в маске прошёл так близко, что было слышно, как поёт команда: три медленные ноты.',
      ],
      s: ['at:hushwater', 'escort'],
    },
    {
      t: ['The Masked Captain', 'Капитан в маске'],
      b: [
        'A letter is left on your chart table while you sleep, sealed with a bell: the Bell-Warden asks you to speak with him at the old shrine on {isle}. Mara says go; Jory says do not go alone.',
        'Пока вы спите, на штурманском столе появляется письмо с колоколом на печати: Звонарь приглашает вас поговорить в старом святилище на острове {isle}. Мара говорит — идите, Джори говорит — только не в одиночку.',
      ],
      d: [
        'Ezra Vell wears a mask of beaten silver and speaks like a priest. He offers you a place in the Choir, and the name of a man who knows where Galt went.',
        'Эзра Велл носит маску из чеканного серебра и говорит, как священник. Он предлагает вам место в Хоре — и имя человека, который знает, куда делся Галт.',
      ],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['No Answer for the Warden', 'Без ответа Звонарю'],
      b: [
        'You gave the Warden no answer, and he did not wait for one. His escort is lying in wait off the stilt town when you next put to sea.',
        'Вы не дали Звонарю ответа, и он не стал его ждать. Когда вы снова выходите в море, у города на сваях вас уже поджидает его охрана.',
      ],
      d: [
        'The escort is broken. The Warden’s own ship never fired a shot: it watched, and went back into the fog.',
        'Охрана разбита. Корабль самого Звонаря не сделал ни выстрела: он смотрел, а потом ушёл обратно в туман.',
      ],
      s: ['board:2', 'sink:2:pirate'],
    },
    {
      t: ['A Mirror for the Island', 'Зеркало для острова'],
      b: [
        'A captain the Warden has noticed needs ears, Mara says. The Brokers will raise a mirror tower on your island, if you lay the footings, so that her warnings reach the chart before the Warden does.',
        'Капитану, на которого обратил внимание Звонарь, нужны уши, говорит Мара. Брокеры поставят на вашем острове зеркальную башню, если вы заложите основание, чтобы её предупреждения доходили до карты раньше Звонаря.',
      ],
      d: [
        'The first mirror message from your island flickers into {hub} at dusk: all quiet, the chart dry.',
        'В сумерках в порт {hub} доходит первое зеркальное послание с вашего острова: всё тихо, карта сухая.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Galt’s Lantern', 'Фонарь Галта'],
      b: [
        'The Warden named a fisher in {port} who sold a lantern with a brass bell on its handle. Mara trusts no gift from the Warden; you go anyway.',
        'Звонарь назвал рыбака из порта {port}, продавшего фонарь с медным колокольчиком на ручке. Мара не верит подаркам Звонаря, но вы всё равно отправляетесь.',
      ],
      d: [
        'The lantern is Galt’s, his initials scratched under the bell. The fisher found it adrift off {port2}, still burning, weeks after Galt was lost.',
        'Фонарь принадлежит Галту — под колокольчиком нацарапаны его инициалы. Рыбак нашёл его в море у порта {port2}, всё ещё горящим, спустя недели после того, как Галт пропал.',
      ],
      s: ['port', 'port2'],
    },
    {
      t: ['Still Burning', 'Всё ещё горит'],
      b: [
        'A lantern does not burn for weeks on its own. Mara thinks it was relit and left where you would find it. The fishers say a wreck lies under that water, and boats have been seen over it at night.',
        'Фонарь не горит неделями сам по себе. Мара думает, что его зажгли заново и оставили там, где вы его найдёте. Рыбаки говорят, что под той водой лежит затонувший корабль и что по ночам над ним видели лодки.',
      ],
      d: [
        'Below lies a Choir ship, scuttled on purpose, her hold full of empty cages and candle-ends. On a beam, scratched with a knife: “O. G.”',
        'Внизу лежит корабль Хора, затопленный нарочно; трюм полон пустых клеток и огарков. На балке ножом нацарапано: «О. Г.»',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['The Broker Who Sold You', 'Брокер, который вас продал'],
      b: [
        'The Warden knew where your boat would land and when. Only one Broker knew both. Mara has a name, and that Broker’s courier sails for {port} tonight.',
        'Звонарь знал, где и когда пристанет ваша шлюпка. Это знал лишь один брокер. У Мары есть имя, и курьер этого брокера уходит сегодня ночью в порт {port}.',
      ],
      d: [
        'The courier carried your next three courses in Mara’s own cipher. She burns the papers and changes the cipher before morning.',
        'Курьер вёз три ваших следующих курса, записанных собственным шифром Мары. Она сжигает бумаги и до утра меняет шифр.',
      ],
      s: ['board:1', 'port'],
    },
    {
      t: ['Men of the Stilts', 'Люди со свай'],
      b: [
        'Mara says the Warden will come for {hub} itself before long, and the stilt town has more boatmen than fighters. Sign on those willing to learn, and keep the waters while they do.',
        'Мара говорит, что скоро Звонарь придёт за самим портом {hub}, а в городе на сваях лодочников больше, чем бойцов. Наберите тех, кто готов учиться, и стерегите воды, пока они учатся.',
      ],
      d: [
        'The new hands learn to fight in the dark with lanterns shuttered, the way the Brokers do everything.',
        'Новички учатся драться в темноте, при закрытых фонарях, — так, как брокеры делают всё.',
      ],
      s: ['recruit', 'escort'],
    },
    {
      t: ['The Candle Ships', 'Корабли со свечами'],
      b: [
        'Ships lit with candles from stem to stern are gathering off {isle}, singing. Mara says it is a vigil; the Choir keeps one before a great ringing.',
        'У острова {isle} собираются корабли, освещённые свечами от носа до кормы, и поют. Мара говорит, что это бдение: Хор устраивает его перед великим звоном.',
      ],
      d: [
        'Off {isle} the candles go out one by one as the ships go down. The last one sings to the end.',
        'У острова {isle} свечи гаснут одна за другой, пока корабли уходят на дно. Последний поёт до конца.',
      ],
      s: ['isle', 'sink:3:pirate'],
    },
    {
      t: ['The Choir’s Own Copy', 'Список Хора'],
      b: [
        'Mara has bought one secret too dear to keep: the Warden’s tender carries a copy of the black chart, made by the Choir’s own hand. It sails tonight from the fog for open water.',
        'Мара купила тайну, которую слишком дорого держать при себе: тендер Звонаря везёт копию чёрной карты, сделанную рукой самого Хора. Сегодня ночью он уходит из тумана в открытое море.',
      ],
      d: [
        'The copy is yours. Its marks match your scraps, then run on east, into a sea of wrecks that no pilot alive has charted.',
        'Копия ваша. Её пометки совпадают с вашими обрывками, а дальше уходят на восток — в море затонувших кораблей, которого не наносил на карту ни один живой лоцман.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['The Bell Over the Stilts', 'Колокол над сваями'],
      b: [
        'At midnight a great bell rings out of the fog, and every lantern in {hub} goes dark at once. The Warden’s ships come in from {isle} with their candles lit. Mara asks you to meet them before they reach the stilts.',
        'В полночь из тумана раздаётся звон большого колокола, и в порту {hub} разом гаснут все фонари. От острова {isle} идут корабли Звонаря с зажжёнными свечами. Мара просит встретить их, пока они не дошли до свай.',
      ],
      d: [
        'The Warden’s flagship breaks off and vanishes, its bell still ringing. Mara lights a lantern: “Your chart wants a reader. Go to the wreck-town, and find Tobias Wren.”',
        'Флагман Звонаря выходит из боя и исчезает, а его колокол всё звонит. Мара зажигает фонарь: «Вашей карте нужен чтец. Идите в город из обломков и найдите Тобиаса Рена».',
      ],
      s: ['isle', 'sink:3:pirate', 'board:2', 'hub'],
    },
  ],
};
