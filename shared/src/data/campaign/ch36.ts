// Chapter 36 — The Gravetide (Act VI, the Abyss). The end of the campaign: Oren Galt rings the great bell backward, the
// tide sleeps, the old pilot goes into the light, and the captain brings his lantern home to Saltmarrow (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 36,
  region: 'the_abyss',
  more: ['drowned_crown'],
  hub: 'last_light',
  title: ['The Gravetide', 'Гробовой прилив'],
  blurb: [
    'Under the Eye the great bell is swinging on its own, and only a pilot can ring it backward. Oren Galt, who once would not trust you with a word, asks you to hold his course one last time.',
    'Под Оком сам собой раскачивается великий колокол, и прозвонить его задом наперёд может только лоцман. Орен Галт, который когда-то не доверял вам ни слова, просит в последний раз удержать его курс.',
  ],
  giver: ['Oren Galt, pilot of Saltmarrow', 'Орен Галт, лоцман Солтмарроу'],
  portrait: 'giver_old_salt_m',
  reward: { title: ['Master of the Tide', 'Хозяин прилива'] },
  quests: [
    {
      t: ['Hold Her Steady', 'Держите ровно'],
      b: [
        'Oren Galt stands on the quay at {hub} with his old lantern and looks at you the way he did on the first day. Before he takes your ship down the slope of the Eye, he wants to see you hold a course past {isle}.',
        'Орен Галт стоит на причале порта {hub} со своим старым фонарём и смотрит на вас так же, как в первый день. Прежде чем повести ваш корабль по склону Ока, он хочет посмотреть, как вы держите курс мимо острова {isle}.',
      ],
      d: [
        '“You hold her steady,” Galt says, and this time he does not grumble. “You always did.”',
        '«Держишь ровно, — говорит Галт, и на этот раз не ворчит. — Ты с первого дня держишь ровно».',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Little Brass Bell', 'Медный колокольчик'],
      b: [
        'Galt has kept the wreckers’ lantern from Saltmarrow all these years, the one with the small brass bell on its handle. Near the Eye the bell has begun to hum. He wants to carry it ashore on {isle} and see which way it points.',
        'Все эти годы Галт хранил фонарь мародёров из Солтмарроу — тот самый, с медным колокольчиком на ручке. У Ока колокольчик начал гудеть. Галт хочет вынести его на берег острова {isle} и посмотреть, куда он укажет.',
      ],
      d: [
        'On the shingle the little bell rings once by itself and swings toward the centre of the light, steady as a compass needle.',
        'На гальке колокольчик звякает сам по себе и поворачивается к центру света, твёрдо, как стрелка компаса.',
      ],
      s: ['isle', 'land'],
    },
    {
      t: ['The Sea Comes Ashore', 'Море выходит на берег'],
      b: [
        'With every swing of the great bell the tide climbs higher on every coast at once. At the Order’s outposts the water is in the lower rooms of the lighthouses, and the keepers are on the roofs. Take them off.',
        'С каждым качанием великого колокола прилив поднимается выше сразу на всех берегах. На аванпостах Ордена вода уже в нижних комнатах маяков, и смотрители сидят на крышах. Снимите их.',
      ],
      d: [
        'The keepers come aboard with their lamps still lit, carried in their arms like children.',
        'Смотрители поднимаются на борт с горящими лампами, которые несут на руках, как детей.',
      ],
      s: ['rescue', 'escort'],
    },
    {
      t: ['The Faithful Few', 'Последние верные'],
      b: [
        'Some of the Choir’s ships never heard that the Widow’s fleet was broken, or will not believe it. They are making for the Eye to ring the great bell forward with their own hands. They must not get there.',
        'Часть кораблей Хора так и не узнала, что флот Вдовы разбит, или не хочет в это верить. Они идут к Оку, чтобы своими руками прозвонить великий колокол по порядку. Дойти они не должны.',
      ],
      d: [
        'Their captains ask, when taken, whether it is true. When you tell them, most of them look relieved.',
        'Их капитаны, сдаваясь, спрашивают, правда ли это. Услышав ответ, почти все выглядят так, будто у них гора с плеч свалилась.',
      ],
      s: ['board:2', 'sink:3'],
    },
    {
      t: ['The Ship Jory Swam From', 'Корабль, с которого уплыл Джори'],
      b: [
        'An echo comes up out of the light: a merchantman with a broken foremast, the very ship that went onto the rocks at Saltmarrow while Jory Penn swam for the shore. Jory asks to go aboard her. Lay him alongside.',
        'Из света поднимается эхо: торговое судно со сломанной фок-мачтой — тот самый корабль, что разбился о скалы у Солтмарроу, пока Джори Пенн плыл к берегу. Джори просит пустить его на борт. Подведите его.',
      ],
      d: [
        'Jory finds his old hammock still slung in the forecastle. He stands there a minute, then closes the hatch gently behind him.',
        'Джори находит в кубрике свой старый гамак, всё ещё подвешенный. Он стоит там минуту, потом бережно закрывает за собой люк.',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['Under the Eye', 'Под самым Оком'],
      b: [
        'Galt wants to know how deep the great bell hangs before he decides how to ring it. Over the centre of the light the pressure makes the planks sing. Hold the ship there while your divers go down on the longest lines you have.',
        'Прежде чем решить, как звонить, Галт хочет знать, на какой глубине висит великий колокол. Над центром света от давления поют доски. Держите корабль там, пока водолазы спускаются на самых длинных линях, какие у вас есть.',
      ],
      d: [
        'The bell is the size of a church and hangs from nothing anyone can see. Its tongue is missing.',
        'Колокол размером с церковь и висит ни на чём, что можно разглядеть. Языка у него нет.',
      ],
      s: ['dive', 'escort'],
    },
    {
      t: ['Wardens of the Deep', 'Стражи глубины'],
      b: [
        'Things older than the leviathans rise to look at your ship when she lies over the Eye, and not all of them only look. Ilse sends word that the Eldest will not interfere. Drive them back from {isle} yourself.',
        'Когда корабль стоит над Оком, к нему поднимаются посмотреть существа старше левиафанов, и не все из них только смотрят. Ильзе передаёт, что Древнейший вмешиваться не станет. Отгоните их от острова {isle} сами.',
      ],
      d: [
        'They sink away into the light. One of them, going, turns its great eye on Galt and holds it there a long time.',
        'Они уходят вниз, в свет. Один из них, уходя, долго не сводит огромного глаза с Галта.',
      ],
      s: ['isle', 'beast:any'],
    },
    {
      t: ['A Tongue of Deep Ore', 'Язык из глубинной руды'],
      b: [
        'A bell without a tongue cannot be rung, forward or backward. Galt says only abyssal ore will do for a bell that hangs from nothing. Take on ore at {port} and bring it to the founders at {port2}, who have the moulds ready.',
        'Колокол без языка не прозвонить — ни по порядку, ни задом наперёд. Галт говорит, что для колокола, висящего ни на чём, годится только абиссальная руда. Примите руду в порту {port} и доставьте литейщикам в порт {port2}: формы у них готовы.',
      ],
      d: [
        'The new tongue comes out of the mould dark and cool, and it does not ring when the founders drop it. Galt nods: “Good. It knows how to wait.”',
        'Новый язык выходит из формы тёмным и холодным и не звенит, когда литейщики его роняют. Галт кивает: «Хорошо. Он умеет ждать».',
      ],
      s: ['carry:abyssal_ore'],
    },
    {
      t: ['Sailing Directions for the Bowl', 'Лоция чаши'],
      b: [
        'Galt will not take a ship down a slope he has not sounded; it is a habit of fifty years. He asks you to chart every island on the inner rim, and copies them into his own book, slowly, by lantern light.',
        'Галт не поведёт корабль по склону, который сам не промерил: это привычка пятидесяти лет. Он просит нанести на карту каждый остров внутреннего края и медленно переносит их в свою книгу при свете фонаря.',
      ],
      d: [
        'When the chart is done Galt closes the book and puts his hand flat on it, as if to keep it from blowing away.',
        'Закончив, Галт закрывает книгу и кладёт на неё ладонь, будто боится, что её унесёт ветром.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Every Light at Once', 'Все огни разом'],
      b: [
        'Aurora Sayle means to light every lamp beyond the Wall on the night Galt goes down, so that he will have something to steer by. The light on {isle} has been dark since the Widow turned it. Land the brothers there and guard them while they work.',
        'Аврора Сейл хочет в ночь, когда Галт пойдёт вниз, зажечь все огни за Стеной, чтобы ему было по чему держать курс. Огонь на острове {isle} не горит с тех пор, как его повернула Вдова. Высадите туда братьев и охраняйте их, пока они работают.',
      ],
      d: [
        'One after another the Islands of Light flare up across the dark, until the Abyss is ringed with them like a harbour.',
        'Один за другим Острова Света вспыхивают во тьме, пока Бездна не оказывается окружена ими, как гавань.',
      ],
      s: ['land:ruins', 'escort'],
    },
    {
      t: ['Morwen in Her Boat', 'Морвен в лодке'],
      b: [
        'A small boat with a grey lantern drifts at the edge of the light off {isle}, a woman alone at the oars. Morwen has not gone home. She has been waiting to see who would ring the bell, and Galt asks you to take him to her.',
        'У края света, возле острова {isle}, дрейфует лодка с серым фонарём, и на вёслах сидит одна женщина. Морвен не ушла домой. Она ждала, чтобы увидеть, кто зазвонит в колокол, и Галт просит отвезти его к ней.',
      ],
      d: [
        '“He wrote ‘Do not ring’,” Morwen says, “and I never listened.” She turns her boat toward the Wall and rows away without looking back.',
        '«Он написал: „Не звонить“, — говорит Морвен, — а я так и не послушала». Она разворачивает лодку к Стене и уходит на вёслах, не оглядываясь.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Last of the Ringers', 'Последние из звонарей'],
      b: [
        'Not all of the Choir followed Morwen in her grief. A few ringers of the old order have taken a squadron and mean to strike the great bell forward before Galt can reach it, out of faith alone. Stop them, and take their flagship.',
        'Не весь Хор шёл за Морвен в её горе. Несколько звонарей старого чина увели эскадру и собираются ударить в великий колокол по порядку раньше, чем Галт до него доберётся, из одной лишь веры. Остановите их и захватите их флагман.',
      ],
      d: [
        'Their leader gives up his gloves to Galt, not to you. The two old men look at each other a long time and say nothing.',
        'Их предводитель отдаёт свои перчатки Галту, а не вам. Два старика долго смотрят друг на друга и молчат.',
      ],
      s: ['sink:4', 'board:2'],
    },
    {
      t: ['Captain Penn', 'Капитан Пенн'],
      b: [
        'There is a prize to sail and a crew to find for her, and Galt says the boy who swam ashore at Saltmarrow is a boy no longer. Give Jory Penn his first command, sign men on for her, and let him take a ship of his own.',
        'Есть приз, которому нужна команда, и Галт говорит, что мальчишка, доплывший до берега у Солтмарроу, давно уже не мальчишка. Дайте Джори Пенну первое командование, наберите ему людей, и пусть он возьмёт корабль сам.',
      ],
      d: [
        'Jory names his ship the Lost Net, after the first thing you ever went looking for together.',
        'Джори называет свой корабль «Пропавшая сеть» — в честь того, что вы впервые искали вместе.',
      ],
      s: ['recruit', 'board'],
    },
    {
      t: ['A Full Magazine', 'Полный пороховой погреб'],
      b: [
        'Galt says what he said in Saltmarrow, years ago: a captain with an empty magazine is a captain on borrowed time. Nothing is left to fight, perhaps. Bring powder to {hub} all the same.',
        'Галт повторяет то, что сказал в Солтмарроу много лет назад: капитан с пустым пороховым погребом живёт взаймы. Сражаться, быть может, уже не с кем. Всё равно привезите порох в порт {hub}.',
      ],
      d: [
        'The powder is stowed. Galt pats the casks and laughs, the first time anyone aboard has heard him laugh.',
        'Порох уложен. Галт похлопывает бочки и смеётся — впервые на памяти всей команды.',
      ],
      s: ['bring:gunpowder'],
    },
    {
      t: ['The Pilot’s Song', 'Песня лоцмана'],
      b: [
        'There is a way down the slope of the Eye, Galt says, and a pilot knows it the way a man knows a song: by going over it until it goes by itself. Sail the rim with him for a full watch and let him sing it to you.',
        'По склону Ока есть дорога, говорит Галт, и лоцман знает её, как песню: повторяет, пока она не пойдёт сама. Пройдите с ним вдоль края целую вахту, и пусть он вам её пропоёт.',
      ],
      d: [
        'Galt sings in a cracked voice, and the helmsman follows every turn without being told. Jory, on the Lost Net, sings along.',
        'Галт поёт надтреснутым голосом, и рулевой без команды повторяет каждый поворот. Джори на «Пропавшей сети» подпевает.',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['Into the Heart of the Eye', 'В сердце Ока'],
      b: [
        'The way down is open, but the echoes of every ship the Abyss has ever taken have gathered on the slope to see who comes. Galt says they are not enemies, only lost. Lay them to rest on your way down to {isle}.',
        'Дорога вниз открыта, но эхо всех кораблей, какие когда-либо забрала Бездна, собралось на склоне посмотреть, кто идёт. Галт говорит, что они не враги, а лишь заблудились. Упокойте их на пути вниз, к острову {isle}.',
      ],
      d: [
        'The echoes sink one by one into the light, and each one, going, rings its own ship’s bell once, softly, backward.',
        'Эхо одно за другим уходит в свет, и каждое, уходя, один раз тихо бьёт в свой судовой колокол — задом наперёд.',
      ],
      s: ['sink:5:ghost', 'isle'],
    },
    {
      t: ['The Great Bell', 'Великий колокол'],
      b: [
        'At the bottom of the bowl, over the great bell, Galt takes the wheel from you for the first time. Hold the waters round him while the divers hang the new tongue, then keep her steady while he strikes. Once, he says, is enough.',
        'На дне чаши, над великим колоколом, Галт впервые берёт у вас штурвал. Удерживайте воды вокруг, пока водолазы вешают новый язык, а потом держите корабль ровно, пока он бьёт. Одного раза, говорит он, хватит.',
      ],
      d: [
        'The great bell gives one low note, backward, and the sea lies down like an old dog by the hearth. Slowly, the Eye closes.',
        'Великий колокол издаёт одну низкую ноту, задом наперёд, и море ложится, как старый пёс у очага. Медленно, очень медленно Око закрывается.',
      ],
      s: ['escort', 'dive', 'hub'],
    },
    {
      t: ['The Pilot’s Farewell', 'Прощание лоцмана'],
      b: [
        'Galt is tired, and he asks to spend a night up in the lamp-room of {hub}, where Aurora keeps her light. Take him there, and sit with him a while, as long as he wants to talk.',
        'Галт устал и просит провести ночь наверху, в фонарной комнате маяка в порту {hub}, где Аврора хранит свой огонь. Отвезите его туда и посидите с ним, сколько он захочет говорить.',
      ],
      d: [
        'Near dawn Galt walks up the last stairs into the light with his lantern, and the light grows brighter. When Aurora climbs after him, only the lantern is there, its little bell still.',
        'Перед рассветом Галт с фонарём поднимается по последним ступеням в свет, и свет становится ярче. Когда Аврора поднимается следом, там стоит только фонарь, и колокольчик на нём молчит.',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['Home to Saltmarrow', 'Домой, в Солтмарроу'],
      b: [
        'The tide is asleep, the Wall is quiet, and the lantern of Oren Galt sits on your binnacle. Take it home. Sail out past the Islands of Light, say your farewells along the way, and bring it back to the lighthouse where all this began.',
        'Прилив спит, Стена затихла, а фонарь Орена Галта стоит на вашем нактоузе. Отвезите его домой. Пройдите мимо Островов Света, попрощайтесь со всеми по пути и верните его на маяк, с которого всё началось.',
      ],
      d: [
        'The lighthouse of Saltmarrow burns again. Jory writes his name in the keeper’s book, in full this time, and under the water, for the first time in a hundred years, no bell is ringing.',
        'Маяк Солтмарроу снова горит. Джори вписывает своё имя в книгу смотрителя, на этот раз полностью, а под водой впервые за сто лет не звонит ни один колокол.',
      ],
      s: [
        ['isle', 'Pass {isle}: its keepers have turned the lens up to the stars at last.', 'Пройдите мимо острова {isle}: смотрители наконец повернули линзу к звёздам.'],
        ['at:last_light', 'Put in at {at} and dip your colours to the lamp.', 'Зайдите в порт {at} и приспустите флаг перед огнём маяка.'],
        ['at:gravesend', 'Put in at {at}: Isolde Marrow wants the Black Chart back, to burn it.', 'Зайдите в порт {at}: Изольда Марроу хочет забрать Чёрную карту, чтобы сжечь её.'],
        ['at:saltmarrow', 'Bring Galt’s lantern home to {at} and light the lighthouse.', 'Привезите фонарь Галта домой, в порт {at}, и зажгите маяк.'],
      ],
    },
  ],
};
