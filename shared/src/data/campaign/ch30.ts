// Chapter 30 — The Singing Reef (Act V, the Drowned Crown). The Widow slips beyond the Maelstrom Wall; Tobias Wren
// gives the captain his Last Leaf, the passage through it (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 30,
  region: 'drowned_crown',
  hub: 'marrowdeep',
  title: ['The Singing Reef', 'Поющий риф'],
  blurb: [
    'Off Marrowdeep a reef has begun to sing, and the Widow’s fleet waits there for the one night the Maelstrom Wall breathes out. An old reader of wrecks keeps the last page of a voyage no one came back from.',
    'У края Бездны запел риф, и флот Вдовы ждёт там единственной ночи, когда Стена Мальстрима делает выдох. Старый чтец крушений хранит последнюю страницу плавания, из которого никто не вернулся.',
  ],
  giver: ['Tobias Wren, reader of wrecks', 'Тобиас Рен, чтец крушений'],
  portrait: 'giver_cartographer_m',
  reward: { title: ['Key to the Wall', 'Ключ от Стены'] },
  quests: [
    {
      t: ['The Reader of Wrecks', 'Чтец крушений'],
      b: [
        'Tobias Wren has come down from Wrecktide on a fishing smack, a satchel of wet charts under his arm. “The reef off {isle} has started to sing,” he says. “Go and listen before you believe me.”',
        'Тобиас Рен спустился из Рэктайда на рыбацком смэке, с сумкой мокрых карт под мышкой. «Риф у острова {isle} запел, — говорит он. — Сходите послушайте, прежде чем мне верить».',
      ],
      d: [
        'The reef hums one low note, and the crew falls silent: it is the note that rang under the water at Saltmarrow.',
        'Риф гудит одной низкой нотой, и команда замолкает: это та самая нота, что звучала под водой у Солтмарроу.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['Deaf Divers', 'Оглохшие ныряльщики'],
      b: [
        'The pearl divers of {hub} come up from the reef deaf in one ear, and this morning one of them did not come up at all. Her brother stands on the quay with a coil of rope and will not go home.',
        'Ловцы жемчуга из порта {hub} поднимаются с рифа оглохшими на одно ухо, а сегодня утром одна из них не поднялась вовсе. Её брат стоит на причале с бухтой каната и не уходит домой.',
      ],
      d: [
        'She is alive, wrapped round a bronze bell-tongue as warm as a hand. She will not let go of it until Wren comes.',
        'Она жива и обнимает бронзовый колокольный язык, тёплый, как ладонь. Она не выпускает его, пока не приходит Рен.',
      ],
      s: ['dive', 'rescue'],
    },
    {
      t: ['Whose Tongue Is This', 'Чей это язык'],
      b: [
        'Wren reads the letters on the bronze: the tongue was cast for a flagship’s bell, and the mark is the Widow’s. Choir cutters circle the reef at night. Take one and bring its log.',
        'Рен читает буквы на бронзе: язык отлит для колокола флагмана, и клеймо на нём — Вдовы. По ночам у рифа кружат катера Хора. Возьмите один и привезите его журнал.',
      ],
      d: [
        'The log has one line, written over and over: “We wait for the low tide of the Wall.”',
        'В журнале одна строка, переписанная много раз: «Ждём отлива у Стены».',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['The Low Tide of the Wall', 'Отлив у Стены'],
      b: [
        'Once in a long while the Maelstrom Wall thins for a few nights, Wren says, as a sleeper breathes out. Sound the waters beyond {isle} and see whether the current has begun to turn.',
        'Раз в долгие годы Стена Мальстрима истончается на несколько ночей, говорит Рен, как спящий делает выдох. Промерьте воды за островом {isle} и посмотрите, не начало ли поворачивать течение.',
      ],
      d: [
        'Beyond the reef the water is already turning, slowly, like a millstone no one is pushing.',
        'За рифом вода уже кружит, медленно, как жёрнов, который никто не толкает.',
      ],
      s: ['isle', 'chart'],
    },
    {
      t: ['Stores for a Long Dark', 'Запас на долгую тьму'],
      b: [
        'Tenders under grey sails ferry stores out to the Widow’s anchorage. Wren wants to know how far she means to go. Stop them: what they carry will tell you.',
        'Тендеры под серыми парусами возят припасы к стоянке Вдовы. Рен хочет знать, как далеко она собралась. Остановите их: груз скажет сам.',
      ],
      d: [
        'Salt fish for a year, lamp oil for two, and not one barrel of fresh water. Where she is going, Wren says, the sea is sweet.',
        'Солёной рыбы на год, лампового масла на два и ни одной бочки пресной воды. Там, куда она идёт, говорит Рен, море пресное.',
      ],
      s: ['sink:4', 'board:1'],
    },
    {
      t: ['Guns Over Your Own Harbour', 'Пушки над своей гаванью'],
      b: [
        'If the Widow gets through the Wall, Wren says, nothing on this side of it will be safe. Your island holds a copy of the Black Chart. Give it iron and a battery that can answer a fleet.',
        'Если Вдова пройдёт за Стену, говорит Рен, на этой стороне ничто не будет в безопасности. На вашем острове хранится копия Чёрной карты. Дайте ему железо и батарею, способную ответить целому флоту.',
      ],
      d: [
        'The new battery fires its first salvo at nothing, to settle the guns. Your people cheer as if it were a victory.',
        'Новая батарея даёт первый залп в пустое море, чтобы пушки сели на место. Ваши люди кричат «ура», будто это победа.',
      ],
      s: ['bring:iron', 'build'],
    },
    {
      t: ['The Pilots’ Tally', 'Зарубки лоцманов'],
      b: [
        'There was once a Crown pilot station on {isle}, where men kept count of the Wall’s breathing. Wren cannot climb the cliff any more. Land and read the walls for him.',
        'Когда-то на острове {isle} стояла лоцманская станция Короны: там вели счёт дыханию Стены. Рен уже не поднимется на утёс. Высадитесь и прочтите стены за него.',
      ],
      d: [
        'Tally marks in rows of nineteen years. The last mark was cut nineteen years ago, and the knife still lies beneath it.',
        'Зарубки рядами по девятнадцать лет. Последняя сделана девятнадцать лет назад, и нож всё ещё лежит под ней.',
      ],
      s: ['land:ruins', 'hub'],
    },
    {
      t: ['Divers in Irons', 'Ныряльщики в кандалах'],
      b: [
        'The Choir has taken a dozen divers of {hub} to work its bells in the reef, chained by the ankle to the anchor cables. Their wives have brought Wren every coin in the town. He gives the purse back and sends for you.',
        'Хор увёз дюжину ныряльщиков из порта {hub} работать на своих колоколах в рифе — прикованных за лодыжку к якорным канатам. Их жёны принесли Рену все монеты города. Он вернул кошель и послал за вами.',
      ],
      d: [
        'The divers come home with the fetters still on. The smith of {hub} works through the night and does not take a penny.',
        'Ныряльщики возвращаются домой в кандалах. Кузнец порта {hub} работает всю ночь и не берёт ни гроша.',
      ],
      s: ['board:2', 'rescue'],
    },
    {
      t: ['Stop the Reef’s Mouth', 'Заткнуть рифу рот'],
      b: [
        'Bells are wedged in the coral of the reef, dozens of them, and each one sings a little louder every night. Wren wants them packed with sailcloth until the Wall has had its breath.',
        'В кораллах рифа застряли колокола, десятки колоколов, и каждый с каждой ночью поёт чуть громче. Рен хочет набить их парусиной, пока Стена не сделает свой выдох.',
      ],
      d: [
        'One by one the bells go dumb. The reef’s note grows thin, then breaks off like a held breath.',
        'Колокола один за другим немеют. Нота рифа истончается и обрывается, как задержанное дыхание.',
      ],
      s: ['bring:sailcloth', 'dive'],
    },
    {
      t: ['A Letter in Grey Wax', 'Письмо под серым сургучом'],
      b: [
        'A sloop under a parley flag waits off {isle} with a letter for the captain who keeps sinking the Widow’s tenders. Go and take it. Her escort lies a mile behind, and it is not there for courtesy.',
        'У острова {isle} ждёт шлюп под флагом переговоров с письмом для капитана, который топит тендеры Вдовы. Подойдите и примите его. Её охрана держится в миле позади, и не из вежливости.',
      ],
      d: [
        '“Go home,” the letter says. “The sea remembers who stood aside.” The escort did not wait for an answer, and neither did your guns.',
        '«Ступайте домой, — сказано в письме. — Море помнит тех, кто стоял в стороне». Охрана не стала ждать ответа, ваши пушки тоже.',
      ],
      s: ['isle', 'sink:3'],
    },
    {
      t: ['The Torn-Out Page', 'Вырванная страница'],
      b: [
        'Forty years ago Wren went through the Wall as a ship’s boy and came back alone. He tore the last page from his captain’s log and hid it with a friend at {port}. He has not asked for it since.',
        'Сорок лет назад Рен юнгой прошёл за Стену и вернулся один. Последнюю страницу капитанского журнала он вырвал и спрятал у друга в порту {port}. С тех пор он ни разу о ней не спрашивал.',
      ],
      d: [
        'The page is blank. Wren turns it in his fingers and smiles for the first time: “Hold it to a lighthouse lens.”',
        'Страница пуста. Рен вертит её в пальцах и впервые улыбается: «Поднесите её к линзе маяка».',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Light to Read By', 'Свет, чтобы прочесть'],
      b: [
        'Only a lens of abyssal glass will bring up ink that was written beyond the Wall, and the nearest one burns at Last Light. Carry the page to Aurora Sayle and ask her to lend you her lamp for an hour.',
        'Чернила, написанные за Стеной, проявит только линза из абиссального стекла, а ближайшая горит в Последнем Огне. Отвезите страницу Авроре Сейл и попросите одолжить вам её огонь на час.',
      ],
      d: [
        'Under Aurora’s lens the page fills with soundings in a dead captain’s hand: a crooked passage through the Wall, and beside it the words “Last Leaf”.',
        'Под линзой Авроры страница заполняется промерами, сделанными рукой давно утонувшего капитана: кривой проход сквозь Стену, а рядом слова «Последний лист».',
      ],
      s: ['at:last_light', 'hub'],
    },
    {
      t: ['Drawn by the Note', 'Звери на звук'],
      b: [
        'The reef has fallen silent, but the beasts it called are still coming, great shapes nosing at the hulls in {hub} harbour. Wren will not let you sail through the Wall with them at your stern.',
        'Риф умолк, но звери, которых он созвал, всё идут: огромные тени тычутся в днища кораблей в гавани порта {hub}. Рен не отпустит вас к Стене, пока они висят у вас за кормой.',
      ],
      d: [
        'The last of them rolls over and sinks slowly, like a ship let go of its moorings.',
        'Последний зверь переворачивается и медленно уходит вниз, как корабль, отданный со швартовов.',
      ],
      s: ['beast:any', 'escort'],
    },
    {
      t: ['Powder for the Fireships', 'Порох для брандеров'],
      b: [
        'The Order of the Last Light is fitting out fireships at {port2} to break the Widow’s anchorage before the Wall opens. They have hulls and pitch. They need powder, and they need it before the moon is full.',
        'Орден Последнего Огня снаряжает брандеры в порту {port2}, чтобы разбить стоянку Вдовы до того, как откроется Стена. Корпуса и смола у них есть. Нужен порох, и нужен до полнолуния.',
      ],
      d: [
        'Six fireships lie ready, their holds stacked to the beams. The brothers bless them as if they were boats going fishing.',
        'Шесть брандеров стоят наготове, трюмы набиты до бимсов. Братья благословляют их, будто лодки, уходящие на лов.',
      ],
      s: ['carry:gunpowder'],
    },
    {
      t: ['Fire on the Anchorage', 'Огонь на стоянке'],
      b: [
        'At midnight the fireships drift down on the Widow’s fleet. Follow them in, take whatever cuts loose, and send the rest to the bottom while her line is in disorder.',
        'В полночь брандеры спускаются по течению на флот Вдовы. Идите следом, берите всё, что сорвётся с якоря, а остальных отправляйте на дно, пока её строй сломан.',
      ],
      d: [
        'Half her anchorage burns. The black flagship never moves: her crew rings a bell, and the fire walks around her.',
        'Полстоянки горит. Чёрный флагман даже не трогается с места: на нём звонят в колокол, и огонь обходит его стороной.',
      ],
      s: ['board:2', 'sink:5'],
    },
    {
      t: ['Jory in the Crosstrees', 'Джори на салинге'],
      b: [
        'Jory Penn no longer climbs for a dare. He keeps the masthead watch himself these nights, and at dawn he calls down that grey sails are slipping past {isle}, all heading one way.',
        'Джори Пенн давно не лазает на мачту на спор. Эти ночи он сам несёт вахту на салинге, и на рассвете кричит сверху: мимо острова {isle} уходят серые паруса, и все в одну сторону.',
      ],
      d: [
        '“They’re not running,” Jory says when he comes down. “They’re going somewhere they’ve been told to go.”',
        '«Они не бегут, — говорит Джори, спустившись. — Они идут туда, куда им велели».',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['The Drowned Rearguard', 'Утонувший арьергард'],
      b: [
        'The Widow has called up ships the reef took long ago to cover her withdrawal: hulls green with weed, sails like cobwebs, gunports open. Break her rearguard and take a live ship from among them.',
        'Чтобы прикрыть отход, Вдова подняла корабли, которые риф забрал давным-давно: зелёные от водорослей корпуса, паруса как паутина, порты открыты. Разбейте её арьергард и возьмите из него живой корабль.',
      ],
      d: [
        'The drowned ships go down without a sound. The living one strikes her colours, and her captain asks only to be sent far from the Wall.',
        'Утонувшие корабли уходят на дно без звука. Живой спускает флаг, и его капитан просит лишь одного — увезти его подальше от Стены.',
      ],
      s: ['sink:6:ghost', 'board:2'],
    },
    {
      t: ['The Wall Breathes Out', 'Стена делает выдох'],
      b: [
        'Tonight the Wall breathes out. Wren says you will not catch her, but you must see where she goes in. Run for the gap past {isle} and hold your course in the current as long as the hull will bear it.',
        'Этой ночью Стена делает выдох. Рен говорит, что вы её не догоните, но должны увидеть, где она войдёт. Идите к разрыву мимо острова {isle} и держите курс в течении, сколько выдержит корпус.',
      ],
      d: [
        'Through the spray you see the black flagship slide into the gap, and the Wall close behind her like a curtain.',
        'Сквозь брызги вы видите, как чёрный флагман скользит в разрыв, и Стена смыкается за ним, как занавес.',
      ],
      s: ['isle', 'escort', 'hub'],
    },
    {
      t: ['The Bell of the Marigold', 'Колокол «Бархатца»'],
      b: [
        'Wren asks one thing for his page. His ship, the Marigold, came back from the Wall without her crew and went down in sight of {hub}. Her bell lies there still. He wants to hear it once more, on dry land.',
        'За свою страницу Рен просит одного. Его корабль, «Бархатец», вернулся от Стены без команды и затонул на виду у порта {hub}. Его колокол до сих пор лежит там. Рен хочет услышать его ещё раз, на суше.',
      ],
      d: [
        'Wren strikes the bell once with his knuckle and listens until the sound is gone. “Now I can give you the rest,” he says.',
        'Рен стучит в колокол согнутым пальцем и слушает, пока звук не затихнет. «Теперь я могу отдать вам остальное», — говорит он.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['Through the Maelstrom Wall', 'Сквозь Стену Мальстрима'],
      b: [
        'With the Last Leaf on the binnacle and Wren at your elbow, steer for the Wall while it is still thin. The Widow has left her last ships to hold the gap off {isle}. Go through them, and go through.',
        'С Последним листом на нактоузе и Реном у локтя ведите корабль к Стене, пока она ещё тонка. Последние корабли Вдовы держат разрыв у острова {isle}. Пройдите сквозь них — и сквозь Стену.',
      ],
      d: [
        'The wind dies. The stars above are wrong. Far below the black water a light is burning. “The Wall knows your ship now,” Wren whispers. “It will open for you again.”',
        'Ветер умирает. Звёзды над головой не те. Глубоко под чёрной водой горит свет. «Теперь Стена знает ваш корабль, — шепчет Рен. — Она откроется вам снова».',
      ],
      s: ['sink:4', 'board:1', 'isle', ['at:last_light', 'Bring Wren and the Last Leaf back to {at}.', 'Доставьте Рена и Последний лист в порт {at}.']],
    },
  ],
};
