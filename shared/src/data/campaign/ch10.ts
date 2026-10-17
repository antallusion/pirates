// Chapter 10 — Burning Cane (Act II, The Merchants' Road). The Bell-Warden burns the League's cane to draw the captain
// out and win back the first bell; she raises a battery over her hidden harbour, beats him there, and he flees north
// (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 10,
  region: 'gravewater',
  hub: 'sugarloaf',
  title: ['Burning Cane', 'Горящий тростник'],
  blurb: [
    'The mill bells ring the alarm instead of the shifts, and the cane burns to the hills. The masked man wants his bell back, and he will burn the whole coast to get it.',
    'Мельничные колокола бьют тревогу вместо смен, и тростник горит до самых холмов. Человек в маске хочет вернуть свой колокол — и ради этого сожжёт всё побережье.',
  ],
  giver: ['Celia Brandt, mistress of the cane mills', 'Селия Брандт, хозяйка сахарных мельниц'],
  portrait: 'giver_merchant_f',
  reward: { title: ['Bane of the Bell-Warden', 'Гроза Звонаря'] },
  quests: [
    {
      t: ['Smoke Over the Cane', 'Дым над тростником'],
      b: [
        'You make for {hub} with the first bell hidden behind you and find the mill bells ringing the alarm. Three ships under grey sails are firing the cane along the shore, unhurried, as if they were paid by the field.',
        'Вы идёте в порт {hub}, оставив первый колокол в тайной гавани, и слышите, как мельничные колокола бьют тревогу. Три корабля под серыми парусами поджигают тростник вдоль берега — не торопясь, будто им платят за каждое поле.',
      ],
      d: [
        'Celia Brandt meets you on the quay with soot on her cuffs. “Whoever you are,” she says, “they were waiting for you.”',
        'Селия Брандт встречает вас на причале, манжеты в саже. «Кто бы вы ни были, — говорит она, — ждали они вас».',
      ],
      s: ['sink:3', 'hub'],
    },
    {
      t: ['Wet Canvas', 'Мокрая парусина'],
      b: [
        'The fire is in the lower fields, and water alone will not stop it. Brandt’s people beat the flames with wet sailcloth, and they have none left. Bring canvas to {hub}, as much as the hold takes.',
        'Огонь уже в нижних полях, и одной водой его не остановить. Люди Брандт сбивают пламя мокрой парусиной, а парусины больше нет. Привезите её в порт {hub} — столько, сколько возьмёт трюм.',
      ],
      d: [
        'By nightfall the fire stops at the ditch. Brandt counts what is left and does not say the number aloud.',
        'К ночи огонь останавливается у канавы. Брандт подсчитывает, что уцелело, и не произносит число вслух.',
      ],
      s: ['bring:sailcloth'],
    },
    {
      t: ['A Letter on the Mill Door', 'Письмо на двери мельницы'],
      b: [
        'In the morning a letter is nailed to the mill door, sealed with a little grey bell: “The cane for the bell.” Its courier boats are still lying off {isle}. Take one and learn where they report.',
        'Утром на двери мельницы прибито письмо с печатью в виде серого колокольчика: «Тростник за колокол». Лодки гонца ещё стоят у острова {isle}. Возьмите одну и узнайте, кому они докладывают.',
      ],
      d: [
        'The courier talks: the Bell-Warden himself lies off the coast with a squadron, and he counts the fields as they burn.',
        'Гонец говорит: сам Звонарь стоит у побережья с эскадрой и считает поля, пока они горят.',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['Who Lit the Fields', 'Кто поджёг поля'],
      b: [
        'The fire-raisers need tar and a place to sleep, and Brandt’s overseers saw boats beached on {isle}. Land there and find the camp before the next field goes up.',
        'Поджигателям нужны смола и место для ночлега, а надсмотрщики Брандт видели лодки, вытащенные на берег острова {isle}. Высадитесь и найдите их лагерь, пока не вспыхнуло следующее поле.',
      ],
      d: [
        'Tar barrels, slow-match and a sack of grey cloth masks, each cut to the same pattern.',
        'Бочки смолы, фитили и мешок серых масок, скроенных по одному образцу.',
      ],
      s: ['land:pirate_camp', 'hub'],
    },
    {
      t: ['The Next Field', 'Следующее поле'],
      b: [
        'The camp’s ledger names the plantation on {isle} for tonight. Brandt cannot spare a single cutter from the fire ditches. Stand off the shore and keep watch until the moon goes down.',
        'В записях лагеря на эту ночь назначена плантация на острове {isle}. Брандт не может снять с пожарных канав ни одного работника. Встаньте у берега и несите дозор, пока не зайдёт луна.',
      ],
      d: [
        'Their boats saw your lanterns and turned away. The cane on that shore still stands, green and whole.',
        'Их лодки увидели ваши фонари и повернули прочь. Тростник на том берегу стоит зелёный и нетронутый.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['Iron for the Battery', 'Железо для батареи'],
      b: [
        'Brandt has seen men like the Bell-Warden before: when burning does not work, they go for what you love. Your hidden harbour is open to the sea. Bring iron to {hub} for gun carriages.',
        'Брандт уже видела таких, как Звонарь: если поджоги не помогают, они бьют по тому, что вам дорого. Ваша тайная гавань открыта с моря. Привезите в порт {hub} железо для орудийных лафетов.',
      ],
      d: [
        'Her smiths forge through the night, and the mill bells ring the shifts again, for the first time in a week.',
        'Её кузнецы работают всю ночь, и мельничные колокола впервые за неделю снова отбивают смены.',
      ],
      s: ['bring:iron'],
    },
    {
      t: ['Guns Over the Harbour', 'Пушки над гаванью'],
      b: [
        'The carriages are ready and the guns are bought. Take them to your island and set them in stone above the slip where the bell sleeps.',
        'Лафеты готовы, пушки куплены. Отвезите их на свой остров и поставьте в камень над эллингом, где спит колокол.',
      ],
      d: [
        'The battery looks down on the harbour mouth. Jory chalks a name on the first gun: “Wren’s Temper”.',
        'Батарея смотрит на вход в гавань. Джори мелом пишет на первом орудии: «Нрав Рена».',
      ],
      s: [['build', 'Raise a gun battery over your hidden harbour.', 'Поставьте батарею над своей тайной гаванью.'], 'hub'],
    },
    {
      t: ['Gun Crews from the Stills', 'Расчёты с винокурен'],
      b: [
        'A battery without crews is a heap of iron. The best gunners on this sea drink at {at}, among the stills on stilts, and they hate the masked man for a burned still of their own.',
        'Батарея без расчётов — просто груда железа. Лучшие канониры этого моря пьют в порту {at}, среди винокурен на сваях, и ненавидят человека в маске за свою сгоревшую винокурню.',
      ],
      d: [
        'They come aboard smelling of spirits and powder, and the eldest asks only one thing: “Where do we aim?”',
        'Они поднимаются на борт, пропахшие брагой и порохом, и старший спрашивает только одно: «Куда целиться?»',
      ],
      s: ['at:rotgut_landing', 'recruit'],
    },
    {
      t: ['The League Will Not Pay', 'Лига платить не станет'],
      b: [
        'The League’s factors at {at} refuse to pay for burned cane. Brandt suspects someone in their counting house knew of the fire before it was lit. Ask to see the books.',
        'Поверенные Лиги в порту {at} отказываются платить за сгоревший тростник. Брандт подозревает, что в их конторе кто-то знал о пожаре раньше, чем его зажгли. Потребуйте показать книги.',
      ],
      d: [
        'In the books: a payment “for clearing fields”, made a month ago to a buyer signed only with a bell.',
        'В книгах — платёж «за расчистку полей», сделанный месяц назад покупателю, который подписался одним колокольчиком.',
      ],
      s: ['at:hollowmere', 'hub'],
    },
    {
      t: ['The Harvest Must Sail', 'Урожай должен уйти'],
      b: [
        'What the fire spared lies in sacks at {port}, and the buyers at {port2} will wait three days, no longer. If the sugar does not sail now, Brandt’s cutters will not be paid this year.',
        'Всё, что пощадил огонь, лежит в мешках в порту {port}, а покупатели в порту {port2} будут ждать три дня, не больше. Если сахар не уйдёт сейчас, работники Брандт в этом году останутся без платы.',
      ],
      d: [
        'The sugar is sold at a fair price. Brandt pays her cutters on the quay, coin by coin, in front of everyone.',
        'Сахар продан по честной цене. Брандт платит работникам прямо на причале, монета за монетой, у всех на глазах.',
      ],
      s: ['carry:sugar'],
    },
    {
      t: ['Fireships', 'Брандеры'],
      b: [
        'The tide brings burning hulks into the harbour of {hub}, packed with tar and loose powder, steered by men who jump at the last moment. Sink them before they reach the cane wharves.',
        'Прилив гонит в гавань порта {hub} горящие корпуса, набитые смолой и россыпью пороха; рулевые прыгают за борт в последний миг. Потопите их, пока они не дошли до тростниковых пристаней.',
      ],
      d: [
        'The last fireship burns out on the bar, and the harbour reflects only the morning.',
        'Последний брандер догорает на отмели, и в гавани отражается только утро.',
      ],
      s: ['sink:3', 'hub'],
    },
    {
      t: ['Masks Among the Pirates', 'Маски среди пиратов'],
      b: [
        'The Bell-Warden has bought himself a captain the Hunters’ Guild has wanted for years, and that captain now flies a grey pennant. Sink him, and board one of his consorts while they scatter.',
        'Звонарь купил себе капитана, которого Гильдия охотников разыскивает уже много лет, и тот теперь ходит под серым вымпелом. Потопите его и, пока его спутники разбегаются, возьмите одного на абордаж.',
      ],
      d: [
        'Among the consort’s papers is the masked man’s sailing order: “When the battery is manned, go for the island.”',
        'Среди бумаг захваченного корабля — приказ человека в маске: «Когда батарею укомплектуют, идти на остров».',
      ],
      s: ['named', 'board:1'],
    },
    {
      t: ['Signals from the Hill', 'Сигналы с холма'],
      b: [
        'Every night a fire flickers on the hill of {isle}, three short and one long, and every night a field burns after it. Someone there is talking to the squadron. Put him out.',
        'Каждую ночь на холме острова {isle} мигает огонь — три коротких, один длинный, — и после этого горит очередное поле. Кто-то оттуда переговаривается с эскадрой. Погасите его.',
      ],
      d: [
        'The signaller is one of Brandt’s own overseers. He weeps and says the masked man promised him the mill.',
        'Сигнальщик оказался надсмотрщиком самой Брандт. Он плачет и говорит, что человек в маске обещал ему мельницу.',
      ],
      s: ['isle', 'land'],
    },
    {
      t: ['The Bell Hums', 'Колокол гудит'],
      b: [
        'Jory comes back from the island pale: the bell under the turf roof hums when the wind is from the south, and the masked man’s ships are coming from the south. Meet whatever he sends ahead.',
        'Джори возвращается с острова бледный: колокол под дерновой крышей гудит, когда ветер с юга, а корабли человека в маске идут как раз с юга. Встретьте тех, кого он пошлёт вперёд.',
      ],
      d: [
        'The scouts are sunk, but the bell does not fall silent. Jory says it is not humming. It is answering.',
        'Разведчики на дне, но колокол не замолкает. Джори говорит, что он не гудит. Он отвечает.',
      ],
      s: ['escort', 'sink:3:hunter'],
    },
    {
      t: ['Out of the Burning Mill', 'Из горящей мельницы'],
      b: [
        'The upper mill caught at dawn, and the cutters fled into the bay on anything that floats: doors, barrels, a cane cart. The current is taking them out to sea. Pick them up.',
        'На рассвете загорелась верхняя мельница, и работники бросились в залив на всём, что держится на воде: на дверях, бочках, тростниковой телеге. Течение уносит их в море. Подберите их.',
      ],
      d: [
        'The last one you haul out is a boy with a mill bell clutched in both hands, saved before anything else.',
        'Последним вы вытаскиваете мальчишку, который обеими руками прижимает к себе мельничный колокол — его он спасал первым.',
      ],
      s: ['rescue', 'hub'],
    },
    {
      t: ['Bait in the Taverns', 'Приманка в тавернах'],
      b: [
        'Brandt proposes a trap. Let it be said loudly in the taverns of {port} that the bell will sail tomorrow under a light escort, and wait for whoever comes to take it.',
        'Брандт предлагает ловушку. Пусть в тавернах порта {port} громко расскажут, что колокол завтра уйдёт под лёгкой охраной, — и ждите тех, кто придёт за ним.',
      ],
      d: [
        'They came, and their ships are yours. The masked man has no more hounds to send; now he must come himself.',
        'Они пришли, и их корабли теперь ваши. Больше гончих у человека в маске нет — теперь ему придётся идти самому.',
      ],
      s: ['port', 'board:2'],
    },
    {
      t: ['The Bell-Warden at the Gate', 'Звонарь у ворот'],
      b: [
        'At dusk his squadron rounds the point of your island, a masked figure at the flagship’s rail and a bell hung at her bow. The battery opens fire. Hold the harbour mouth and go over his rail.',
        'В сумерках его эскадра огибает мыс вашего острова: у борта флагмана — фигура в маске, на носу подвешен колокол. Батарея открывает огонь. Удержите вход в гавань и сойдитесь с ним борт о борт.',
      ],
      d: [
        'His flagship breaks off burning and turns north. Across the water he calls: “The north remembers its bells, captain.”',
        'Его флагман выходит из боя горящим и поворачивает на север. Над водой доносится его голос: «Север помнит свои колокола, капитан».',
      ],
      s: [['escort', 'Hold the mouth of your hidden harbour for {n} min.', 'Удержите вход в свою тайную гавань: {n} мин.'], 'sink:4', 'board:2', 'hub'],
    },
  ],
};
