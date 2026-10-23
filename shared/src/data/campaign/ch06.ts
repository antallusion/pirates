// Chapter 6 — The Bank of Hollowmere (Act II, The Merchants' Road). Isolde Marrow follows the Choir's money; your own island
// becomes the chart's hidden harbour (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 6,
  region: 'gravewater',
  hub: 'hollowmere',
  title: ['The Bank of Hollowmere', 'Банк Холлоумира'],
  blurb: [
    'Brass counting rooms above a flooded market, a banking house with a bell on its seal, and a chart that needs a harbour no bank or Admiralty can reach. The Choir’s silver has to come from somewhere.',
    'Медные конторы над затопленным рынком, банкирский дом с колоколом на печати и карта, которой нужна гавань, недоступная ни банку, ни Адмиралтейству. Серебро Хора откуда-то берётся.',
  ],
  giver: ['Isolde Marrow, Admiralty cartographer', 'Изольда Марроу, картограф Адмиралтейства'],
  portrait: 'giver_cartographer_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['Isolde Comes East', 'Изольда едет на восток'],
      b: [
        'Isolde Marrow writes that the Admiralty archive was searched again in the night and Thorne’s drawings nearly lost. She will not stay in {at} another week, and asks you to bring her and her chests to {hub}.',
        'Изольда Марроу пишет, что ночью архив Адмиралтейства снова обыскали и рисунки Торна едва не пропали. Она не останется в порту {at} ни на неделю дольше и просит отвезти её вместе с сундуками в порт {hub}.',
      ],
      d: [
        'Isolde steps onto the quay with three iron-bound chests and the look of a woman who has stopped trusting locks.',
        'Изольда сходит на причал с тремя окованными сундуками и видом женщины, которая перестала доверять замкам.',
      ],
      s: ['at:gravesend', 'hub'],
    },
    {
      t: ['A Depositor’s Pledge', 'Залог вкладчика'],
      b: [
        'The bell-in-a-coin seal belongs to the House of Vane, whose brass counting rooms stand over the flooded market of {hub}. The House opens its doors only to depositors. Isolde suggests you become one: bring a pledge of costly goods and ask for a strongroom.',
        'Печать с колоколом в монете принадлежит дому Вейна, чьи медные конторы стоят над затопленным рынком порта {hub}. Двери дома открыты только вкладчикам. Изольда предлагает вам им стать: привезите в залог дорогой товар и попросите отдельное хранилище.',
      ],
      d: [
        'The strongroom you are given stands next to one whose lock is stamped with a small bell.',
        'Вам отводят хранилище по соседству с другим, на замке которого выбит маленький колокол.',
      ],
      s: ['bring:pearls'],
    },
    {
      t: ['The Belled Strongroom', 'Хранилище с колоколом'],
      b: [
        'Every Friday a sealed boat leaves the House of Vane for {isle}, carrying whatever lies in the belled strongroom. Isolde wants to know what that is, and who is waiting for it.',
        'Каждую пятницу из дома Вейна к острову {isle} уходит опечатанная лодка с тем, что лежит в хранилище с колоколом. Изольда хочет знать, что это и кто это ждёт.',
      ],
      d: [
        'The boat carries old Crown silver in sacks: wages, by the look of the lists, for hundreds of men.',
        'Лодка везёт старое серебро Короны в мешках — судя по спискам, жалованье для сотен людей.',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['Wages for the Choir', 'Жалованье Хора'],
      b: [
        'The wage lists name ships, not men, and Isolde knows some of them from your own log: the pirates who closed the smugglers’ channels. Hunt down the rest before they spend their silver.',
        'В платёжных списках названы корабли, а не люди, и некоторые Изольда узнаёт по вашему же журналу: это пираты, перекрывавшие протоки контрабандистов. Выследите остальных, пока они не потратили серебро.',
      ],
      d: ['Isolde strikes ship after ship off the list with a steady pen.', 'Изольда твёрдой рукой вычёркивает из списка корабль за кораблём.'],
      s: ['sink:3:pirate', 'hub'],
    },
    {
      t: ['Nowhere Safe', 'Нигде не безопасно'],
      b: [
        'Isolde’s lodgings in {hub} were searched while she was at the bank. Nothing was taken, because nothing was there: she carries the scraps on her. The chart needs a harbour of its own, she says. Find her islands nobody has charted.',
        'Пока Изольда была в банке, её комнаты в порту {hub} обыскали. Ничего не взяли, потому что ничего там не было: обрывки она носит при себе. Карте нужна своя гавань, говорит она. Найдите острова, которых никто ещё не наносил на карту.',
      ],
      d: [
        'Isolde lays your new charts side by side and puts her finger on the smallest island. “That one. Nobody would bother.”',
        'Изольда раскладывает ваши новые карты и указывает на самый маленький остров. «Вот этот. На него никто и не взглянет».',
      ],
      s: ['chart'],
    },
    {
      t: ['An Island of Your Own', 'Свой остров'],
      b: [
        'The island has no name and no master. Raise your flag over it, and it is yours by the law of the sea, which is older than the League’s and kinder than the Crown’s.',
        'У острова нет ни имени, ни хозяина. Поднимите над ним свой флаг — и он ваш по морскому закону, который старше закона Лиги и милосерднее закона Короны.',
      ],
      d: ['The flag snaps in the wind. Jory carves the ship’s name into the first post of the jetty.', 'Флаг хлопает на ветру. Джори вырезает имя корабля на первой свае причала.'],
      s: ['claim'],
    },
    {
      t: ['A Room Beneath the Floor', 'Комната под полом'],
      b: [
        'Isolde wants a store on your island with a dry room beneath the floor, where the scraps and Thorne’s drawings can lie in oilcloth and lead. Lay the first works, then fetch her from {hub}.',
        'Изольде нужен склад на вашем острове с сухой комнатой под полом, где обрывки и рисунки Торна будут лежать в промасленной ткани и свинце. Заложите первые постройки, а потом заберите её из порта {hub}.',
      ],
      d: [
        'The scraps go down into the dark under the floor. That night, for the first time in months, Isolde sleeps.',
        'Обрывки опускают в темноту под полом. В ту ночь Изольда впервые за много месяцев спит.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['The Banker’s Son', 'Сын банкира'],
      b: [
        'Corliss Vane, who heads the House, has a son who drinks in {port} and talks too much when he loses at cards. Isolde gives you a purse to lose to him, slowly.',
        'У Корлисса Вейна, главы дома, есть сын, который пьёт в порту {port} и болтает лишнее, когда проигрывает в карты. Изольда даёт вам кошелёк, чтобы проиграть ему — не спеша.',
      ],
      d: [
        'Ludo Vane, drunk and generous, says his father has slept badly ever since a woman in grey became his best client.',
        'Пьяный и щедрый Людо Вейн рассказывает, что отец плохо спит с тех пор, как его лучшей клиенткой стала женщина в сером.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Sugar, Sugar, Bronze', 'Сахар, сахар, бронза'],
      b: [
        'The House of Vane owns ships as well as gold, and Ludo swears they carry more than sugar. Take one with her papers and bring her before a prize court, where the League cannot hush it up.',
        'Дому Вейна принадлежат не только деньги, но и корабли, и Людо клянётся, что возят они не один сахар. Захватите судно вместе с бумагами и приведите в призовой суд, где Лиге не удастся замять дело.',
      ],
      d: [
        'The prize court reads the manifest aloud: sugar, sugar, sugar, and forty quarters of bell-bronze.',
        'В призовом суде манифест зачитывают вслух: сахар, сахар, сахар — и сорок четвертей колокольной бронзы.',
      ],
      s: ['board:2', 'prize'],
    },
    {
      t: ['Ships Without Flags', 'Корабли без флагов'],
      b: [
        'The House of Vane does not take a prize court lightly. Ships without flags have been seen off your island, sounding the shallows. Isolde fears they are looking for the chart.',
        'Дом Вейна не прощает призовых судов. У вашего острова видели корабли без флагов: они промеряли глубины. Изольда боится, что они ищут карту.',
      ],
      d: [
        'The flagless ships are gone. On one of them: a sketch of your island’s jetty, drawn from the sea.',
        'Корабли без флагов ушли. На одном из них нашёлся набросок причала вашего острова, сделанный с моря.',
      ],
      s: ['escort', 'sink:3'],
    },
    {
      t: ['A Garrison for the Island', 'Гарнизон острова'],
      b: [
        'A store with no guard is only a promise to thieves. Isolde asks you to sign on men to keep your island: quiet men, she says, who do not drink in {hub}.',
        'Склад без охраны — лишь обещание ворам. Изольда просит набрать людей для охраны острова: тихих, говорит она, таких, что не пьют в порту {hub}.',
      ],
      d: [
        'Your garrison rows out at dusk. Jory goes with them to show them the store, and comes back quieter than he left.',
        'В сумерках ваш гарнизон отплывает на остров. Джори отправляется с ними показать склад и возвращается молчаливее, чем уезжал.',
      ],
      s: ['recruit'],
    },
    {
      t: ['The Flooded Market', 'Затопленный рынок'],
      b: [
        'The old market of {hub} flooded fifty years ago, and the House of Vane built its vaults on the drowned arcades. Isolde says every vault has a back door; this one’s must be under water.',
        'Старый рынок порта {hub} затопило полвека назад, и дом Вейна построил свои хранилища прямо на затонувших аркадах. Изольда говорит, что у каждого хранилища есть чёрный ход; у этого он должен быть под водой.',
      ],
      d: [
        'Your divers find a grating under the vault with its bars freshly sawn. Someone else has had the same idea.',
        'Водолазы находят под хранилищем решётку со свежеподпиленными прутьями. Кому-то пришла в голову та же мысль.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['Someone Else’s Idea', 'Чужая затея'],
      b: [
        'A brig with a heron on her flag has lain off {isle} for a week, and her boats go out only at night. Isolde knows that heron, and would like a word with its captain about her scrap.',
        'Бриг с цаплей на флаге уже неделю стоит у острова {isle}, и его шлюпки выходят только ночью. Изольда знает эту цаплю и хотела бы поговорить с её капитаном о своём обрывке.',
      ],
      d: [
        'Hale will not return the scrap yet, but he grins: he wants the Vane ledgers as much as you do, and he has already done the sawing.',
        'Обрывок Хейл пока не возвращает, но ухмыляется: книги Вейна нужны ему не меньше, чем вам, а пилить он уже закончил.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['A Gift for the Sergeant', 'Подарок для сержанта'],
      b: [
        'The vault’s night watch is six men and a sergeant, and the sergeant is fond of rum. Hale’s plan, which Isolde hates, begins with a generous gift.',
        'Ночная стража хранилища — шестеро солдат и сержант, а сержант любит ром. План Хейла, который Изольда терпеть не может, начинается с щедрого подарка.',
      ],
      d: ['By midnight the sergeant is singing, and the watch is singing with him.', 'К полуночи сержант поёт, и стража поёт вместе с ним.'],
      s: ['bring:rum'],
    },
    {
      t: ['The Water Gate', 'Водяные ворота'],
      b: [
        'While the watch sings, Hale’s men go in through the grating. One guard boat still patrols the water gate, and it must be taken quietly, without a shot, or the whole quarter wakes.',
        'Пока стража поёт, люди Хейла проникают через решётку. У водяных ворот всё ещё ходит сторожевая лодка, и взять её нужно тихо, без единого выстрела, иначе проснётся весь квартал.',
      ],
      d: [
        'The Vane ledgers are yours, and Hale’s: he insists on copying every page before he gives them up.',
        'Книги Вейна у вас — и у Хейла: он настаивает на том, чтобы переписать каждую страницу, прежде чем их отдать.',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['The Pirates’ Paymaster', 'Казначей пиратов'],
      b: [
        'The ledgers show that the Choir’s silver goes out in a single paymaster’s ketch, which meets the pirates of {region} at sea. Isolde says cut off the pay, and the wolves will turn on one another.',
        'Книги показывают, что серебро Хора уходит на одном-единственном кече казначея, который встречает пиратов вод «{region}» прямо в море. Изольда говорит: перекройте жалованье, и волки перегрызутся между собой.',
      ],
      d: [
        'The paymaster’s chest is full, and his last orders read: “All ships to the convoy road. The Warden wants it closed.”',
        'Сундук казначея полон, а последний приказ гласит: «Всем кораблям на конвойную дорогу. Звонарь хочет её закрыть».',
      ],
      s: ['board:1', 'sink:2:pirate'],
    },
    {
      t: ['Vane Takes Flight', 'Бегство Вейна'],
      b: [
        'With his ledgers gone, Corliss Vane has fled to his country house on {isle}, with his gold and four hired guns. Isolde wants him alive and talking.',
        'Лишившись книг, Корлисс Вейн бежал в загородный дом на острове {isle} — с золотом и четырьмя наёмниками. Изольде он нужен живым и разговорчивым.',
      ],
      d: [
        'Vane is taken in his nightshirt. He begs for one thing only: that the Widow never learn he was caught.',
        'Вейна берут в ночной рубашке. Он умоляет лишь об одном: чтобы Вдова никогда не узнала, что его поймали.',
      ],
      s: ['isle', 'land'],
    },
    {
      t: ['The Widow’s Collectors', 'Сборщики Вдовы'],
      b: [
        'Grey sails come at dawn, not for Vane but for the island where the chart lies. Isolde stays at the store with the garrison and a loaded pistol. Meet them at sea before they reach the jetty.',
        'На рассвете приходят серые паруса — не за Вейном, а за островом, где лежит карта. Изольда остаётся на складе с гарнизоном и заряженным пистолетом. Встретьте их в море, пока они не дошли до причала.',
      ],
      d: [
        'The grey ships break on your guns. A prisoner laughs: the Warden has put a price on Corvin Hale, who sailed for the convoy road last night with every page of the ledgers.',
        'Серые корабли разбиваются о ваши пушки. Пленный смеётся: Звонарь назначил цену за голову Корвина Хейла, который прошлой ночью ушёл на конвойную дорогу со всеми страницами книг.',
      ],
      s: ['escort', 'sink:3', 'board:2', 'hub'],
    },
  ],
};
