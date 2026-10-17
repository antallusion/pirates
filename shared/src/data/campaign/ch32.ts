// Chapter 32 — The Crown on the Seabed (Act VI, back in the Drowned Crown). The last bells of the Crown under the ruins
// of its capital; Corvin Hale's last stand (the branch `hale_end`: fight beside him to the end, or send him home).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 32,
  region: 'drowned_crown',
  hub: 'crownfall',
  title: ['The Crown on the Seabed', 'Корона на дне'],
  blurb: [
    'Three marks on the Black Chart are still unrung, and all three lie under the drowned capital. The Widow’s fleet comes back through the Wall to take them, and Corvin Hale comes back with the Grey Heron, for the last time.',
    'Три метки Чёрной карты ещё не прозвонены, и все три лежат под утонувшей столицей. Флот Вдовы возвращается из-за Стены, чтобы забрать их, а Корвин Хейл возвращается на «Серой цапле» — в последний раз.',
  ],
  giver: ['Isolde Marrow, Admiralty cartographer', 'Изольда Марроу, картограф Адмиралтейства'],
  portrait: 'giver_cartographer_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['Three Marks Unrung', 'Три непрозвоненные метки'],
      b: [
        'Isolde Marrow has pinned the whole Black Chart to a table in {hub}, every scrap you brought her over all these years. Three bells remain, she says, all under the city. The first lies off {isle}.',
        'Изольда Марроу приколола к столу в порту {hub} всю Чёрную карту — каждый обрывок, что вы привозили ей за эти годы. Осталось три колокола, говорит она, и все под городом. Первый лежит у острова {isle}.',
      ],
      d: [
        'The water off {isle} trembles in a ring, as if something under it had just been struck.',
        'Вода у острова {isle} дрожит кольцом, словно под ней только что ударили во что-то.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Drowned Belfry', 'Затопленная звонница'],
      b: [
        'Under {isle} stands the belfry of the Crown’s cathedral, its spire a fathom below the surface at low water. Isolde needs to know whether its bell still hangs. Send your divers in through the louvres.',
        'Под островом {isle} стоит звонница кафедрального собора Короны; в малую воду её шпиль всего в сажени под поверхностью. Изольде нужно знать, висит ли ещё колокол. Отправьте водолазов внутрь через жалюзи звонницы.',
      ],
      d: [
        'The bell hangs, green and enormous. Someone has already cut its rope and fitted a new one, of grey hemp.',
        'Колокол висит, зелёный и огромный. Кто-то уже срезал старую верёвку и привязал новую, из серой пеньки.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Grey Heron Returns', 'Возвращение «Серой цапли»'],
      b: [
        'A brig comes in with half her masts shot away and four of the Widow’s ships on her heels: the Grey Heron, and Corvin Hale at her wheel, waving his hat as though he had planned it all.',
        'В порт входит бриг с наполовину сбитым рангоутом, и четыре корабля Вдовы висят у него на хвосте: это «Серая цапля», а у штурвала Корвин Хейл, машет шляпой, будто всё так и задумывал.',
      ],
      d: [
        '“Did you miss me?” Hale shouts across the water. His hands are shaking, and he does not seem to notice.',
        '«Скучали по мне?» — кричит Хейл через воду. Руки у него дрожат, и он, кажется, этого не замечает.',
      ],
      s: ['sink:4', 'board:1'],
    },
    {
      t: ['What Hale Knows', 'Что знает Хейл'],
      b: [
        'Hale has spent a season raiding the Widow’s convoys and knows which hulk is fitted with the cranes to lift a cathedral bell. He offers to show you, if you buy the drinks after. Take the hulk, and the crane crews with it.',
        'Хейл целый сезон грабил конвои Вдовы и знает, на каком блокшиве стоят краны, способные поднять соборный колокол. Он готов показать — если потом выпивка за ваш счёт. Возьмите блокшив вместе с крановыми командами.',
      ],
      d: [
        'Without its cranes the Choir cannot lift anything heavier than a church candle. Hale insists on the drinks anyway.',
        'Без кранов Хор не поднимет ничего тяжелее церковной свечи. Хейл всё равно требует выпивку.',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['Canvas for the Heron', 'Парусина для «Цапли»'],
      b: [
        'The Heron cannot fight under the rags she came in with, and the sailmakers of {port2} owe Hale nothing but curses. Take on sailcloth at {port} and bring it there, where his crew is waiting with needles.',
        'Под теми лохмотьями, в которых «Цапля» пришла, ей не сражаться, а парусные мастера порта {port2} должны Хейлу одни проклятия. Примите парусину в порту {port} и доставьте туда, где его команда уже ждёт с иглами.',
      ],
      d: [
        'Hale’s crew sews through the night and sings rude songs about you, every one of them affectionate.',
        'Команда Хейла шьёт всю ночь и поёт про вас непристойные песни, и все до одной — ласковые.',
      ],
      s: ['carry:sailcloth'],
    },
    {
      t: ['The Last Bastion', 'Последний бастион'],
      b: [
        'Isolde has made a second copy of the whole chart and will trust it to only one place: your island. If the Widow learns of it, she will come for it. Arm the garrison and raise one more work on the walls.',
        'Изольда сделала вторую копию всей карты и доверит её только одному месту — вашему острову. Если Вдова узнает о ней, она придёт за ней сама. Вооружите гарнизон и поставьте на стенах ещё одно укрепление.',
      ],
      d: [
        'The copy is sealed in a lead box under the new tower. Isolde makes you swear not to tell even her where.',
        'Копия запаяна в свинцовый ящик под новой башней. Изольда берёт с вас клятву не говорить, где он, даже ей самой.',
      ],
      s: ['bring:weapons', 'build'],
    },
    {
      t: ['Ringers of the Ruins', 'Звонари руин'],
      b: [
        'Choir landing parties are winching bells out of the cellars of the old palace on {isle}, slowly, at night, by the light of shuttered lanterns. Break up the work and sink the ships waiting to load.',
        'Десантные отряды Хора по ночам воротами вытаскивают колокола из подвалов старого дворца на острове {isle}, медленно, при свете прикрытых фонарей. Сорвите работы и потопите корабли, ждущие погрузки.',
      ],
      d: [
        'They leave a bell half-raised in the palace stairwell, hanging from a groaning beam.',
        'Они бросают колокол поднятым наполовину: он висит в лестничном пролёте дворца на стонущей балке.',
      ],
      s: ['land:ruins', 'sink:3'],
    },
    {
      t: ['The Dome at Low Water', 'Купол в малую воду'],
      b: [
        'Twice a year, at the lowest ebb, the cathedral dome breaks the surface off {isle}, and the old men of {hub} say the drowned streets around it can be read from the masthead. Isolde wants them on paper before the tide turns.',
        'Дважды в год, в самый низкий отлив, купол собора показывается из воды у острова {isle}, и старики порта {hub} говорят, что с мачты тогда видны затопленные улицы вокруг. Изольда хочет нанести их на бумагу, пока не начался прилив.',
      ],
      d: [
        'From the crosstrees the drowned city lies spread like a hand, and every finger points at the dome.',
        'С салинга утонувший город раскинут, как ладонь, и каждый палец указывает на купол.',
      ],
      s: ['isle', 'chart'],
    },
    {
      t: ['A Bell in Tow', 'Колокол на буксире'],
      b: [
        'The Choir has raised one bell after all and is towing it toward the Wall slung under two hulks, bow to bow. If it gets through the Wall, Isolde says, the Widow is one bell nearer her tide.',
        'Один колокол Хор всё-таки поднял и тянет его к Стене, подвесив между двумя блокшивами, нос к носу. Если он пройдёт за Стену, говорит Изольда, Вдова станет на колокол ближе к своему приливу.',
      ],
      d: [
        'Both hulks are yours. The bell hangs between them, swaying, and every time it swings the whole sea hums.',
        'Оба блокшива ваши. Колокол качается между ними, и с каждым качанием гудит всё море.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Bronze for Sale', 'Бронза на продажу'],
      b: [
        'Salvagers at {port} have been buying bronze off the Choir and selling it on at a profit, bells included. Isolde wants a list of the buyers. The salvage master will talk to a captain with a full broadside.',
        'Ныряльщики-подъёмщики в порту {port} скупают у Хора бронзу и перепродают её с наваром, колокола тоже. Изольде нужен список покупателей. Старший подъёмщик заговорит с капитаном, у которого полный бортовой залп.',
      ],
      d: [
        'The list has one buyer only, written thirty times: a woman in grey, paying in old Crown silver.',
        'В списке всего один покупатель, записанный тридцать раз: женщина в сером, платит старым серебром Короны.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['The Stolen Copy', 'Украденная копия'],
      b: [
        'A page of Isolde’s work copy has gone from her table, and a captain on the Hunters’ Guild list has been seen putting out with a sealed packet. He means to sell it beyond the Wall. He must not get there.',
        'Со стола Изольды пропал лист её рабочей копии, а капитан из списка Гильдии охотников вышел в море с запечатанным пакетом. Он собирается продать его за Стеной. Туда он доплыть не должен.',
      ],
      d: [
        'The packet comes up from the wreck intact. Isolde dries the page by the stove without a word and pins it back.',
        'Пакет поднимают с обломков целым. Изольда молча сушит лист у печки и прикалывает его на место.',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['A Quiet Night Over the Crown', 'Тихая ночь над Короной'],
      b: [
        'The Heron and your ship stand watch together off {isle}. Jory has been talking to Hale on the quarterdeck for an hour. He comes to you afterwards with a question he has been carrying since Saltmarrow.',
        '«Цапля» и ваш корабль вместе несут дозор у острова {isle}. Джори уже час разговаривает с Хейлом на шканцах. Потом он подходит к вам с вопросом, который носит в себе с самого Солтмарроу.',
      ],
      d: [
        '“How do you stand,” Jory asks, “when you know you’ll lose?” Hale answers before you can: “Facing the right way, lad.”',
        '«Как стоять, — спрашивает Джори, — когда знаешь, что проиграешь?» Хейл отвечает раньше вас: «Лицом в нужную сторону, малой».',
      ],
      s: ['escort', 'isle'],
    },
    {
      t: ['Powder for the Strait', 'Порох для пролива'],
      b: [
        'The only way to the cathedral runs through a strait between two drowned towers, and whoever holds it holds the bell. Isolde has worked out how many broadsides it will take. Bring that much powder, and some over.',
        'К собору ведёт лишь один путь — пролив между двумя утонувшими башнями, и кто держит пролив, тот держит колокол. Изольда подсчитала, сколько бортовых залпов понадобится. Привезите столько пороха, и с запасом.',
      ],
      d: [
        'The powder is stowed in the cathedral’s own crypt, above the waterline. Isolde says the old bishops would not have minded.',
        'Порох уложен в крипте самого собора, выше уровня воды. Изольда говорит, что старые епископы не стали бы возражать.',
      ],
      s: ['bring:gunpowder'],
    },
    {
      t: ['The Choir’s Drowned Guard', 'Утонувшая стража Хора'],
      b: [
        'The Widow has raised the ships of the old Crown’s home fleet to guard the cathedral, and they move under the water like shadows of clouds. Put them back where they lay, then send divers down to see what they were guarding.',
        'Вдова подняла корабли старого флота метрополии сторожить собор, и они движутся под водой, как тени облаков. Верните их туда, где они лежали, а потом спустите водолазов посмотреть, что они охраняли.',
      ],
      d: [
        'They were guarding the cathedral doors, which someone has chained shut from the inside.',
        'Они охраняли двери собора, которые кто-то запер цепью изнутри.',
      ],
      s: ['sink:5:ghost', 'dive'],
    },
    {
      t: ['Hale’s Vow', 'Обет Хейла'],
      b: [
        'Hale has sounded the strait off {isle} himself, at night, in his gig. He comes back soaked and grinning: the Widow’s fleet will come through it at dawn, and he means to stop it there, with the Heron or without her.',
        'Хейл ночью сам промерил пролив у острова {isle} на своей гичке. Он возвращается промокший и улыбающийся: флот Вдовы пройдёт там на рассвете, и Хейл собирается остановить его — с «Цаплей» или без неё.',
      ],
      d: [
        'He shakes your hand, which he has never done before, and goes off whistling to load his guns.',
        'Он пожимает вам руку — впервые за все годы — и уходит, насвистывая, заряжать пушки.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['Beside Hale to the End', 'Рядом с Хейлом до конца'],
      b: [
        'Dawn. The Widow’s line comes into the strait, and the Heron turns broadside across it, alone and laughing. Lay your ship beside his and fight it out together, rail to rail, as long as either of you has a gun.',
        'Рассвет. Строй Вдовы входит в пролив, и «Цапля» становится поперёк, бортом к нему, одна и смеющаяся. Встаньте рядом с Хейлом и деритесь вместе, борт к борту, пока хоть у одного из вас стреляет пушка.',
      ],
      d: [
        'The strait holds. When the smoke clears the Heron is gone, and on the water floats only Hale’s hat with its grey feather, turning slowly toward the sun.',
        'Пролив устоял. Когда рассеивается дым, «Цапли» уже нет, и на воде плавает только шляпа Хейла с серым пером, медленно поворачиваясь к солнцу.',
      ],
      s: ['board:3', 'sink:4'],
      alt: {
        key: 'hale_end',
        label: [['Fight beside Hale', 'Сражаться рядом с Хейлом'], ['Send Hale home', 'Отпустить Хейла домой']],
        t: ['Send Hale Home', 'Отпустить Хейла домой'],
        b: [
          'Before dawn you row across to the Heron and tell Hale the strait is yours to hold and his to leave. He has a sister in the north, and a debt to no one. Hold the strait without him while he sails away.',
          'До рассвета вы переправляетесь на «Цаплю» и говорите Хейлу: пролив держать вам, а ему — уходить. На севере у него сестра, и он никому ничего не должен. Удерживайте пролив без него, пока он уходит.',
        ],
        d: [
          'The strait holds. Far to the north the Heron’s stern lantern blinks one word in the old signal code: “Thanks.”',
          'Пролив устоял. Далеко на севере кормовой фонарь «Цапли» мигает одно слово старым сигнальным кодом: «Спасибо».',
        ],
        s: ['sink:6', 'board:2', 'escort'],
      },
    },
    {
      t: ['The Cathedral Bell', 'Соборный колокол'],
      b: [
        'With the strait clear, the cathedral is open. Isolde wants its great bell brought up before the Widow sends another fleet: send your divers through the chained doors and take the salvage barge the Choir left moored above.',
        'Пролив свободен, и собор открыт. Изольда хочет поднять большой колокол, пока Вдова не прислала новый флот: отправьте водолазов за запертые на цепь двери и захватите подъёмную баржу, которую Хор оставил на якоре наверху.',
      ],
      d: [
        'The bell comes up in the barge’s slings, streaming water. It does not ring. It has no tongue.',
        'Колокол поднимается в стропах баржи, с него льётся вода. Он не звонит. У него нет языка.',
      ],
      s: ['dive', 'board', 'hub'],
    },
    {
      t: ['The Back of the Chart', 'Оборотная сторона карты'],
      b: [
        'Isolde has turned the Black Chart over at last. On its back, in faded ink, runs a list of the bells in the order they were first rung, a century ago. She thinks Brother Ansel can read what it means. He is at Saint Maw.',
        'Изольда наконец перевернула Чёрную карту. На обороте выцветшими чернилами написан список колоколов в том порядке, в каком их впервые прозвонили сто лет назад. Она думает, что брат Ансельм сумеет понять, что это значит. Он в Святой Пасти.',
      ],
      d: [
        'Ansel reads the list and laughs, and then weeps a little. “Backwards,” he says. “Ring them backwards, and the tide will sleep.”',
        'Ансельм читает список, смеётся, а потом тихо плачет. «Задом наперёд, — говорит он. — Прозвоните их в обратном порядке, и прилив уснёт».',
      ],
      s: ['at:saint_maw', 'hub'],
    },
    {
      t: ['The Battle for the Last Bell', 'Бой за последний колокол'],
      b: [
        'The Widow herself comes back through the Wall for the bell you took from her, with every ship she has left on this side. Isolde will not leave {hub}. Meet the fleet off {isle} and break it before it reaches the city.',
        'Сама Вдова возвращается из-за Стены за колоколом, который вы у неё отняли, со всеми кораблями, что остались у неё по эту сторону. Изольда не уйдёт из порта {hub}. Встретьте флот у острова {isle} и разбейте его, пока он не дошёл до города.',
      ],
      d: [
        'The Widow withdraws behind the Wall again. In {hub} the last bell of the Crown stands on the quay, silent, and the children dare each other to touch it.',
        'Вдова снова уходит за Стену. В порту {hub} на причале стоит последний колокол Короны, безмолвный, и дети подзадоривают друг друга его потрогать.',
      ],
      s: ['isle', 'sink:5', 'board:2', 'hub'],
    },
  ],
};
