// Chapter 9 — The Ship Graveyard (Act II, The Merchants' Road). Tobias Wren reads the Black Chart: every mark on it is a
// drowned bell of the old Drowned Crown. The first bell is raised, and the Bell-Warden learns where it went (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 9,
  region: 'dead_mans_expanse',
  hub: 'wrecktide',
  title: ['The Ship Graveyard', 'Кладбище кораблей'],
  blurb: [
    'A town of hulks among the currents, where every reef keeps a ship. An old salvager reads the Black Chart at last, and under the water the first bell waits.',
    'Город из старых корпусов среди течений, где у каждого рифа лежит корабль. Старый спасатель наконец читает Чёрную карту, а под водой ждёт первый колокол.',
  ],
  giver: ['Tobias Wren, wreck-master of the graveyard', 'Тобиас Рен, хозяин кладбища кораблей'],
  portrait: 'giver_cartographer_m',
  reward: { map: 1 },
  quests: [
    {
      t: ['The Man in the Hulk', 'Человек в старом корпусе'],
      b: [
        'Mara Quill gave you one name: Tobias Wren, who lives in a beached hulk at {hub} and knows every wreck between the currents. The currents have drowned better ships than yours. Get there whole.',
        'Мара Квилл назвала вам одно имя: Тобиас Рен. Он живёт в вытащенном на берег корпусе в порту {hub} и знает каждое крушение между течениями. Течения топили корабли и получше вашего. Доберитесь целыми.',
      ],
      d: [
        'Wren looks at the scraps a long time, then shuts the hatch. “Not with the door open,” he says. “Never with the door open.”',
        'Рен долго смотрит на обрывки, потом закрывает люк. «Не при открытой двери, — говорит он. — Никогда при открытой двери».',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['Salvage Rights', 'Право на обломки'],
      b: [
        'Strippers are cutting the brass from wrecks Wren has not yet charted, and they do not ask whose reef it is. He wants them taught to ask.',
        'Мародёры срезают латунь с крушений, которые Рен ещё не нанёс на карту, и не спрашивают, чей это риф. Он хочет, чтобы их научили спрашивать.',
      ],
      d: [
        'In their hold, among the brass: fittings from a ship’s belfry, sawn off clean under water.',
        'В их трюме среди латуни — оковка судовой звонницы, аккуратно отпиленная под водой.',
      ],
      s: ['board:1', 'sink:2:pirate'],
    },
    {
      t: ['The Humming Wreck', 'Гудящий остов'],
      b: [
        'At slack water the sea off {isle} hums like a struck glass, and the fishermen will not cast there. Wren asks you to send divers down and see what is humming.',
        'В стоячую воду море у острова {isle} гудит, как тронутый бокал, и рыбаки там сетей не бросают. Рен просит спустить водолазов и посмотреть, что там гудит.',
      ],
      d: [
        'The divers bring up a bell-rope gone stiff with salt and cut through with a knife — not long ago.',
        'Водолазы поднимают колокольную верёвку, задубевшую от соли и перерезанную ножом — совсем недавно.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['Oil for Long Nights', 'Масло для долгих ночей'],
      b: [
        'Wren reads by lamplight, and the Black Chart is drawn in ink that only shows at an angle to the flame. He will need whale oil for many nights. Bring it to {hub}.',
        'Рен читает при лампе, а Чёрная карта нарисована чернилами, которые видны только под углом к огню. Ему понадобится китовый жир на много ночей. Привезите его в порт {hub}.',
      ],
      d: [
        'Three lamps burn down before dawn. In the morning Wren says only one word: “Bronze.”',
        'К рассвету догорают три лампы. Утром Рен говорит только одно слово: «Бронза».',
      ],
      s: ['bring:whale_oil'],
    },
    {
      t: ['Bells of the Drowned Crown', 'Колокола Утонувшей Короны'],
      b: [
        'To be sure, Wren needs the old founders’ rolls of the Drowned Crown, and a copy is kept by a glass-burner’s widow at {port}. She sells nothing to strangers. Go anyway.',
        'Чтобы увериться, Рену нужны старые литейные списки Утонувшей Короны, а их копию хранит вдова стекольщика в порту {port}. Чужим она ничего не продаёт. Всё равно сходите.',
      ],
      d: [
        'The rolls match the chart mark for mark. Every sign on it is a bell of the old Crown, sunk where its ship went down.',
        'Списки сходятся с картой знак в знак. Каждая отметка на ней — колокол старой Короны, утонувший там, где пошёл ко дну его корабль.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Lanterns Without Crews', 'Фонари без команд'],
      b: [
        'At night ships with no one at the helm drift through the graveyard, their lanterns lit, their sails whole. Wren says they come when the bells are disturbed. Send them back down.',
        'По ночам через кладбище дрейфуют корабли без рулевых: фонари зажжены, паруса целы. Рен говорит, что они приходят, когда кто-то тревожит колокола. Верните их на дно.',
      ],
      d: [
        'The last of them sinks without a sound, and somewhere far below a bell rings once in answer.',
        'Последний уходит под воду беззвучно, и где-то глубоко внизу ему в ответ один раз звонит колокол.',
      ],
      s: ['sink:3:ghost', 'escort'],
    },
    {
      t: ['Grapnels in the Deep', 'Кошки на дне'],
      b: [
        'Boats under grey sails are dragging grapnels over the marked wrecks off {isle}. Someone else can read the chart too. Take one of their boats and find out who taught them.',
        'Лодки под серыми парусами тащат кошки по отмеченным крушениям у острова {isle}. Значит, карту умеет читать кто-то ещё. Возьмите одну из лодок и узнайте, кто их научил.',
      ],
      d: [
        'Their chart is a copy of yours, only older, and the marks already dragged are crossed out in grey.',
        'Их карта — копия вашей, только старше, и отметки, которые уже обшарили, перечёркнуты серым.',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['Men Born in Hulls', 'Люди из старых корпусов'],
      b: [
        'Wren needs divers who do not fear the dark, and the only ones he trusts were born in the hull-houses of {at}. Go there and sign on whoever will come.',
        'Рену нужны водолазы, которые не боятся темноты, а доверяет он только тем, кто родился в домах-корпусах порта {at}. Сходите туда и наберите всех, кто пойдёт.',
      ],
      d: [
        'They come aboard barefoot, with their own lead and their own knives, and do not look back at the shore.',
        'Они поднимаются на борт босиком, со своими грузилами и своими ножами, и ни разу не оглядываются на берег.',
      ],
      s: ['at:wreckhold', 'recruit'],
    },
    {
      t: ['The Deep Sickness', 'Глубинная хворь'],
      b: [
        'Two of Wren’s divers came up too fast and lie at {port2} with their joints locked and their eyes on the ceiling. Fetch medicine from {port} before the sickness settles in.',
        'Двое водолазов Рена поднялись слишком быстро и лежат в порту {port2}: суставы свело, взгляд в потолок. Привезите лекарства из порта {port}, пока хворь не взяла своё.',
      ],
      d: [
        'Both live. One of them whispers that down there someone was ringing — slowly, as if counting.',
        'Оба выжили. Один шепчет, что там, внизу, кто-то звонил — медленно, будто считал.',
      ],
      s: ['carry:medicine'],
    },
    {
      t: ['A Name Cast in Bronze', 'Имя, отлитое в бронзе'],
      b: [
        'On {isle} stand the stumps of an old Crown chapel, and Wren believes its bell went down with the flagship that carried it away. Land and read what is left on the stones.',
        'На острове {isle} стоят обломки старой часовни Короны, и Рен уверен, что её колокол ушёл на дно вместе с флагманом, который его увозил. Высадитесь и прочтите, что осталось на камнях.',
      ],
      d: [
        'Above the empty arch the name is still legible: “The Mourner”. The same name stands by the deepest mark on the chart.',
        'Над пустой аркой ещё читается имя: «Плакальщица». Это же имя стоит у самой глубокой отметки на карте.',
      ],
      s: ['land:ruins', 'hub'],
    },
    {
      t: ['The Masked Man’s Hounds', 'Гончие человека в маске'],
      b: [
        'Since the stilt town the same sails keep to your wake. Wren says the Bell-Warden never hunts himself; he sends hounds. Turn on them before they close.',
        'Со времён города на сваях за вашей кормой держатся одни и те же паруса. Рен говорит, что Звонарь никогда не охотится сам — он посылает гончих. Развернитесь, пока они не подошли.',
      ],
      d: [
        'Their captain’s orders, in a neat hand: “Let her find the bell. Then take it from her.”',
        'В приказе их капитана, ровным почерком: «Пусть она найдёт колокол. Потом заберите его у неё».',
      ],
      s: ['sink:2:hunter', 'board:1'],
    },
    {
      t: ['Jory Hears It', 'Джори слышит'],
      b: [
        'Jory Penn wakes the watch in the middle of the night: something is ringing under the keel, he swears, and it is moving towards {isle}. Nobody else hears a thing. Follow him.',
        'Джори Пенн будит вахту в полночь: под килем что-то звонит, клянётся он, и звон уходит к острову {isle}. Больше никто ничего не слышит. Идите за ним.',
      ],
      d: [
        'Where Jory stops and points, the chart has a mark that Wren had not yet read.',
        'Там, где Джори останавливается и показывает рукой, на карте стоит отметка, которую Рен ещё не прочёл.',
      ],
      s: ['isle', 'chart'],
    },
    {
      t: ['Down Among the Hulls', 'Среди остовов'],
      b: [
        'To find “The Mourner” Wren must rule out the wrecks around her. Send the hull-born divers down, one wreck after another, and bring him what they see.',
        'Чтобы найти «Плакальщицу», Рену нужно исключить крушения вокруг неё. Спускайте водолазов из старых корпусов к одному остову за другим и докладывайте ему обо всём.',
      ],
      d: [
        'One hull after another is empty. Wren draws a ring on the chart and says, “Then it is here.”',
        'Остов за остовом пуст. Рен обводит кружок на карте и говорит: «Значит, здесь».',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['A Quiet Berth for Bronze', 'Тихий причал для бронзы'],
      b: [
        'A raised bell cannot lie in a town where every door was a hatch and every ear is for sale. Wren says it must go to your own hidden harbour. Lay a covered slip there to take it.',
        'Поднятый колокол нельзя держать в городе, где каждая дверь когда-то была люком, а каждое ухо продаётся. Рен говорит: только в вашу тайную гавань. Заложите там крытый эллинг, чтобы его принять.',
      ],
      d: [
        'The slip stands under a turf roof, and from the sea it looks like nothing at all.',
        'Эллинг стоит под дерновой крышей, и с моря его совсем не видно.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['The Choir’s Crane Ship', 'Кран-корабль Хора'],
      b: [
        'A broad ship with a crane on her waist and a grey pennant has come into the graveyard, and her escort is sweeping the water clear. She is going for “The Mourner”. Get there first.',
        'На кладбище вошёл широкий корабль с краном на шкафуте и серым вымпелом, а его охрана расчищает воду. Он идёт к «Плакальщице». Успейте первыми.',
      ],
      d: [
        'The crane ship is yours, her chains still wet. Her master swears the Widow herself paid for the voyage.',
        'Кран-корабль ваш, его цепи ещё мокрые. Шкипер клянётся, что рейс оплатила сама Вдова.',
      ],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['Caught in the Current', 'Во власти течения'],
      b: [
        'The crane ship’s escort fled into the current and the current took them, as it takes everyone. Wren says the graveyard does not ask whose men they were. Pull them out, then take the survivors to {port}.',
        'Охрана кран-корабля ушла в течение, и течение забрало её, как забирает всех. Рен говорит, что кладбищу всё равно, чьи это были люди. Вытащите их, а потом отвезите уцелевших в порт {port}.',
      ],
      d: [
        'One of them, wrapped in your blanket, says the Bell-Warden is in the south, at the cane fields, waiting.',
        'Один из них, завёрнутый в ваше одеяло, говорит, что Звонарь на юге, у тростниковых полей, — и ждёт.',
      ],
      s: ['rescue', 'port'],
    },
    {
      t: ['The First Bell', 'Первый колокол'],
      b: [
        'Slack water comes at dawn and lasts an hour. Wren takes the helm himself to {isle}, the divers go down with the crane’s chains, and grey sails are already gathering at the edge of the current.',
        'Стоячая вода наступает на рассвете и длится час. Рен сам встаёт к штурвалу и ведёт корабль к острову {isle}, водолазы уходят вниз с цепями крана, а у кромки течения уже собираются серые паруса.',
      ],
      d: [
        'The bell comes up green and silent, “The Mourner” on its lip. At {hub} a note waits: the cane fields are burning, and the masked man wants his bell.',
        'Колокол поднимается зелёный и безмолвный, на ободе — «Плакальщица». В порту {hub} ждёт записка: тростниковые поля горят, а человек в маске требует свой колокол.',
      ],
      s: ['isle', 'dive', 'board:2', 'hub'],
    },
  ],
};
