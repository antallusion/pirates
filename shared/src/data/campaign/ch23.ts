// Chapter 23 — Tidehallow (Act IV, Ash and the Code). Admiral Cassius Dray brings the Crown's squadron and the Code's
// raiders under the captain's flag into the Drowned Crown; the Bell Gate is forced (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 23,
  region: 'drowned_crown',
  more: ['ashen_isles'],
  hub: 'tidehallow',
  title: ['Tidehallow', 'Приливная Лощина'],
  blurb: [
    'At the edge of the drowned sea the Crown’s squadron and the Code’s raiders anchor in one bay and eye each other over their guns. Admiral Dray has one order for them both: follow her flag.',
    'На краю утонувшего моря эскадра Короны и рейдеры Кодекса стоят в одной бухте и косятся друг на друга поверх пушек. У адмирала Дрея для всех один приказ: идти за вашим флагом.',
  ],
  giver: ['Cassius Dray, admiral of the Crown', 'Кассий Дрей, адмирал Короны'],
  portrait: 'giver_garrison_captain_m',
  reward: { title: ['Admiral of Ash', 'Адмирал пепла'] },
  quests: [
    {
      t: ['Two Fleets, One Flag', 'Два флота, один флаг'],
      b: [
        'Admiral Cassius Dray has brought the Crown’s squadron to {hub}; across the bay the Code’s captains ride at anchor with their guns run out. Dray wants both to see whose flag they follow. Lead the line into the drowned sea.',
        'Адмирал Кассий Дрей привёл в порт {hub} эскадру Короны, а через бухту стоят на якоре капитаны Кодекса — пушки выкачены. Дрей хочет, чтобы и те и другие увидели, за чьим флагом идут. Выведите строй в утонувшее море.',
      ],
      d: ['Crown and Code dip their colours as you pass. Dray watches and says nothing.', 'Корона и Кодекс приспускают флаги, когда вы проходите мимо. Дрей смотрит и молчит.'],
      s: ['reach', 'hub'],
    },
    {
      t: ['Green Lanterns', 'Зелёные фонари'],
      b: [
        'Every night green lanterns drift beyond {isle}, low over the water, and the fleet’s lookouts swear they hear singing. Dray wants to know who is watching his ships.',
        'Каждую ночь за островом {isle} над самой водой плывут зелёные фонари, и вахтенные клянутся, что слышат пение. Дрей хочет знать, кто следит за его кораблями.',
      ],
      d: ['Under every lantern sailed a ship with no hand at the helm. They sank without a sound.', 'Под каждым фонарём шёл корабль, у штурвала которого никто не стоял. Они ушли на дно без единого звука.'],
      s: ['isle', 'sink::ghost'],
    },
    {
      t: ['The Code’s Share', 'Доля Кодекса'],
      b: [
        'Meg Caldwell, eldest of the Code’s captains, will not sail under a Crown admiral until she is paid her share of the last battle. Dray does not pay pirates. The Choir’s supply ships will.',
        'Мэг Колдуэлл, старшая из капитанов Кодекса, не пойдёт под началом коронного адмирала, пока ей не выплатят долю за последнюю битву. Дрей пиратам не платит. Заплатят снабженцы Хора.',
      ],
      d: ['“Under your flag, then,” Meg says, counting the silver. “Not his.”', '«Значит, под вашим флагом, — говорит Мэг, пересчитывая серебро. — Не под его».'],
      s: ['board', 'hub'],
    },
    {
      t: ['A Pilot Who Prays', 'Лоцман, который молится'],
      b: [
        'No Crown chart reaches past {hub}: the channels wander between sunken spires. The only pilots are the fishers of {isle}, who still pray to the bells. Go ashore and ask for one.',
        'Ни одна карта Короны не доходит дальше порта {hub}: протоки петляют между затонувшими шпилями. Лоцманы здесь — только рыбаки острова {isle}, а они до сих пор молятся колоколам. Сойдите на берег и попросите одного.',
      ],
      d: ['Old Wenn agrees on one condition: no cannon fire near the spires. “The bells don’t like it.”', 'Старый Венн соглашается при одном условии: не стрелять у шпилей. «Колокола этого не любят».'],
      s: ['land:fishers', 'hub'],
    },
    {
      t: ['Charts Beyond the Line', 'Карты за чертой'],
      b: [
        'Dray’s cartographers give up where the old Crown soundings end. He asks you to chart the islands beyond them, and to lay your copy of the Black Chart beside theirs.',
        'Картографы Дрея опускают руки там, где кончаются старые промеры Короны. Он просит нанести на карту острова дальше и положить рядом вашу копию Чёрной карты.',
      ],
      d: ['Three of the new islands lie exactly where the Black Chart draws a bell.', 'Три новых острова лежат точно там, где на Чёрной карте нарисованы колокола.'],
      s: ['chart', 'hub'],
    },
    {
      t: ['Powder for the Line', 'Порох для строя'],
      b: [
        'The last battle emptied half the fleet’s magazines. Powder waits at {port}; the fleet’s tenders lie at {port2} and dare not sail without an escort.',
        'Последняя битва опустошила половину пороховых погребов флота. Порох ждёт в порту {port}, а тендеры флота стоят в порту {port2} и без конвоя выйти не смеют.',
      ],
      d: ['Dray signs the receipt himself — the first paper he has ever put his name to for a pirate.', 'Дрей сам подписывает расписку — первую бумагу, под которой он поставил имя ради пирата.'],
      s: ['carry:gunpowder', 'hub'],
    },
    {
      t: ['The Bronze Tithe', 'Бронзовая десятина'],
      b: [
        'The Choir’s tithe ships take bronze from the coastal villages — and men, when the bronze runs short. Chased, they throw the men overboard to lighten ship. Take the ships and pull the men out of the water.',
        'Десятинные корабли Хора собирают бронзу с прибрежных деревень, а когда бронзы мало — людей. В погоне они бросают людей за борт, чтобы облегчить ход. Возьмите корабли и вытащите людей из воды.',
      ],
      d: ['The rescued fishermen say the taken men are sent to the Choir’s city — “to sing”.', 'Спасённые рыбаки говорят, что пленных увозят в город Хора — «петь».'],
      s: ['board', 'rescue'],
    },
    {
      t: ['Cards and Pistols', 'Карты и пистолеты'],
      b: [
        'A Crown lieutenant and a Code bosun have called each other out over a hand of cards. Dray would hang the bosun; the Code would burn the lieutenant’s sloop. Give both crews a common enemy: the pirates looting the drowned villages.',
        'Лейтенант Короны и боцман Кодекса вызвали друг друга из-за карточной игры. Дрей готов повесить боцмана, Кодекс — сжечь шлюп лейтенанта. Дайте обеим командам общего врага: пиратов, что грабят прибрежные деревни.',
      ],
      d: ['They come back sharing one pipe and one story, and nobody mentions the cards.', 'Они возвращаются с одной трубкой на двоих и одной историей, и про карты никто не вспоминает.'],
      s: ['sink::pirate', 'hub'],
    },
    {
      t: ['A Spire at Low Water', 'Шпиль в отлив'],
      b: [
        'At low water the tip of a sunken spire breaks the surface off {isle}, and a wreck hangs snagged on it like a coat on a peg. Send divers down before the tide turns.',
        'В отлив у острова {isle} из воды показывается верхушка затонувшего шпиля, а на ней, как плащ на крюке, висит разбитый корабль. Спустите водолазов, пока не начался прилив.',
      ],
      d: ['A Crown frigate lost a century ago. Her bell has been cut away — and the cut is fresh.', 'Фрегат Короны, пропавший сто лет назад. Его колокол срезан — и срез свежий.'],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['The Salt-Sleep', 'Солёный сон'],
      b: [
        'Since the fleet came into these waters, men fall asleep at their posts and wake humming a tune nobody taught them. The surgeons at {hub} call it the salt-sleep and beg for medicine.',
        'С тех пор как флот вошёл в эти воды, люди засыпают на вахте и просыпаются, напевая мотив, которому их никто не учил. Лекари в порту {hub} зовут это солёным сном и просят лекарств.',
      ],
      d: ['The surgeons stop the men’s ears with wax and dose them. The humming stops — almost.', 'Лекари затыкают людям уши воском и поят снадобьями. Пение стихает — почти.'],
      s: ['bring:medicine'],
    },
    {
      t: ['Lamps, Not Bells', 'Фонари, а не колокола'],
      b: [
        'Dray wants a signal tower on your own island, so the fleet can speak by lamps across the drowned sea. “Not bells,” he says. “Never bells.”',
        'Дрей хочет сигнальную башню на вашем острове, чтобы флот переговаривался фонарями через всё утонувшее море. «Не колоколами, — говорит он. — Никогда колоколами».',
      ],
      d: ['The first lamp burns on your tower, and far off a Code sloop answers it.', 'На вашей башне загорается первый фонарь, и вдалеке ему отвечает шлюп Кодекса.'],
      s: ['build', 'hub'],
    },
    {
      t: ['Sharks Astern', 'Акулы за кормой'],
      b: [
        'For three days sharks have followed the fleet and bitten through the oars of its boats. Old Wenn says they follow the bells, and whatever the bells call is no friend of yours.',
        'Третий день за флотом идут акулы и перекусывают вёсла шлюпок. Старый Венн говорит, что они идут на звон, а всё, что зовут колокола, вам не друг.',
      ],
      d: ['The water astern is quiet again, and the boats keep their oars.', 'Вода за кормой снова спокойна, и вёсла шлюпок целы.'],
      s: ['beast:shark', 'escort'],
    },
    {
      t: ['The Picket Line', 'Дозорная цепь'],
      b: [
        'Ahead, the Choir’s pickets lie in a line across the deep channel under green lanterns. Dray wants one of them taken whole: he must learn how they signal.',
        'Впереди поперёк глубокой протоки стоит цепь дозорных кораблей Хора под зелёными фонарями. Дрею нужен один из них целым: он должен понять, как они переговариваются.',
      ],
      d: ['In the captain’s cabin lies a hymnbook, every signal written as notes.', 'В капитанской каюте лежит псалтырь, где каждый сигнал записан нотами.'],
      s: ['sink:3:ghost', 'board:1'],
    },
    {
      t: ['The Old Organist', 'Старый органист'],
      b: [
        'Nobody in the fleet reads music. Dray remembers an organist of the Crown chapel who has retired to {port}. Take him the hymnbook.',
        'Во всём флоте никто не читает ноты. Дрей вспоминает органиста королевской часовни, который доживает век в порту {port}. Отвезите ему псалтырь.',
      ],
      d: [
        'The old man hums the second verse and goes grey: “The shepherd is coming home.” It is their signal to let a ship pass.',
        'Старик напевает второй куплет и сереет лицом: «Пастырь возвращается домой». Это их сигнал пропустить корабль.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['The Smugglers’ Gut', 'Контрабандная протока'],
      b: [
        'The smugglers of {isle} have run bronze past the Choir for years. Their price for the channel is a fleet that looks away from their cargo. Land, strike the bargain, and run the channel to {isle2} yourself.',
        'Контрабандисты острова {isle} годами возят бронзу мимо Хора. За проход они просят, чтобы флот не замечал их груза. Высадитесь, ударьте по рукам и сами пройдите протокой до острова {isle2}.',
      ],
      d: ['The channel is real, narrow and deep. Dray pretends not to see the bronze.', 'Протока настоящая — узкая и глубокая. Дрей делает вид, что не видит бронзы.'],
      s: ['land:smugglers', 'isle2'],
    },
    {
      t: ['The Lost Frigate', 'Пропавший фрегат'],
      b: [
        'The frigate Steadfast vanished from the line in the night without firing a shot. Her last lamp signal was seen off {isle}. Find what is left of her, and whoever still breathes.',
        'Фрегат «Стойкий» ночью пропал из строя, не сделав ни выстрела. Последний сигнал его фонаря видели у острова {isle}. Найдите, что от него осталось, и тех, кто ещё дышит.',
      ],
      d: ['The survivors say the sea sang, and the helmsman steered onto a spire, smiling.', 'Спасённые говорят, что море запело, а рулевой с улыбкой направил фрегат прямо на шпиль.'],
      s: ['isle', 'rescue'],
    },
    {
      t: ['The Gull Sells Signals', 'Чайка торгует сигналами'],
      b: [
        'A pirate the Hunters’ Guild calls the Gull sells the fleet’s lamp signals to the Choir for bronze. Dray wants him silenced before the push.',
        'Пират, которого Гильдия охотников зовёт Чайкой, продаёт Хору сигналы флота за бронзу. Дрей хочет, чтобы он замолчал до начала наступления.',
      ],
      d: ['Among the Gull’s papers are the Choir’s receipts, sealed with a bell beneath a breaking wave.', 'Среди бумаг Чайки — расписки Хора с печатью: колокол под гребнем волны.'],
      s: ['named', 'hub'],
    },
    {
      t: ['Water Among the Ruins', 'Вода среди руин'],
      b: [
        'The fleet is short of fresh water, and the only spring rises in the ruins on {isle}, where creatures have nested in a drowned chapel.',
        'Флоту не хватает пресной воды, а единственный родник бьёт в руинах на острове {isle}, где твари свили гнёзда в затопленной часовне.',
      ],
      d: ['The casks are full. On the chapel wall someone has scratched the Choir’s hymn — upside down.', 'Бочки полны. На стене часовни кто-то нацарапал гимн Хора — вверх ногами.'],
      s: ['land:ruins', 'lair'],
    },
    {
      t: ['Boarders of Two Fleets', 'Абордажники двух флотов'],
      b: [
        'Before the push Dray calls for volunteers from both fleets to fight from your deck. Crown marines and Code cutthroats will have to learn to stand in one line.',
        'Перед наступлением Дрей вызывает охотников из обоих флотов на вашу палубу. Морской пехоте Короны и головорезам Кодекса придётся научиться стоять в одной шеренге.',
      ],
      d: ['Jory Penn drills them himself and calls them all “lads”. Nobody objects.', 'Джори Пенн сам гоняет их по палубе и зовёт всех «ребятами». Никто не возражает.'],
      s: ['recruit', 'hub'],
    },
    {
      t: ['The Shepherd Comes Home', 'Пастырь возвращается'],
      b: [
        'Jory can whistle the Choir’s second verse. Dray’s plan is simple: sing the pickets their own signal, let them come close in the dark, and take them before they understand.',
        'Джори умеет насвистывать второй куплет гимна Хора. План Дрея прост: спеть дозорным их собственный сигнал, подпустить их в темноте и взять, пока они не опомнились.',
      ],
      d: ['Two pickets are taken without a shot fired. The way to the Bell Gate is open.', 'Два дозорных корабля взяты без единого выстрела. Путь к Колокольным воротам открыт.'],
      s: ['escort', 'board:2'],
    },
    {
      t: ['Through the Bell Gate', 'Через Колокольные ворота'],
      b: [
        'At the mouth of the drowned sea two spires rise from the water, a bell hung between them on chains, and behind it lies the Choir’s line. Dray gives you the fleet: break the line, cut the bell down and take the anchorage at {isle}.',
        'В горле утонувшего моря из воды встают два шпиля, между ними на цепях висит колокол, а за ним стоит строй Хора. Дрей отдаёт вам флот: прорвите строй, срежьте колокол и займите стоянку у острова {isle}.',
      ],
      d: [
        'Before both fleets Dray names you Admiral of Ash, then hands you a letter from the Choir’s flagship, sealed with a cracked bell: “Come to the Choir’s city. — A.”',
        'Перед обоими флотами Дрей называет вас Адмиралом пепла и протягивает письмо с флагмана Хора, запечатанное треснувшим колоколом: «Приходите в город Хора. — А.»',
      ],
      s: ['sink:5:ghost', 'board:2', 'isle', 'hub'],
    },
  ],
};
