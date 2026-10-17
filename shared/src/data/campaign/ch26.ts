// Chapter 26 — The Choir (Act V, the Drowned Crown). The Widow comes to Saint Maw; Ilse Harrow teaches the crew to hear
// the drowned bells; Brother Ansel is taken. The choice `ansel`: rescue him, or run down the Widow instead (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 26,
  region: 'drowned_crown',
  hub: 'saint_maw',
  title: ['The Choir', 'Хор'],
  blurb: [
    'The Widow has come to her city, and its bells ring all night with no hand on the ropes. In an old chapel by the sea gate a keeper of the older faith teaches your crew to hear what lies under the water.',
    'Вдова пришла в свой город, и его колокола звонят всю ночь, хотя к верёвкам никто не прикасается. В старой часовне у морских ворот хранительница прежней веры учит вашу команду слышать то, что лежит под водой.',
  ],
  giver: ['Ilse Harrow, keeper of the old chapel', 'Ильзе Харроу, хранительница старой часовни'],
  portrait: 'giver_priest_f',
  reward: { map: 3 },
  quests: [
    {
      t: ['By the Sea Gate', 'Через морские ворота'],
      b: [
        'The Widow’s black brig lies in the harbour of {hub}, and the city’s bells have rung all night with no ringer. A woman named Ilse Harrow sends word: come by way of {isle} and the sea gate, never by the quay.',
        'В гавани порта {hub} стоит чёрный бриг Вдовы, и городские колокола всю ночь звонят без звонаря. Женщина по имени Ильзе Харроу присылает весть: идите мимо острова {isle} и через морские ворота, только не к причалу.',
      ],
      d: ['Ilse lays her palm flat on the chapel floor. “Do you hear it? No? I will teach you.”', 'Ильзе кладёт ладонь на пол часовни. «Слышите? Нет? Научу».'],
      s: ['isle', 'hub'],
    },
    {
      t: ['A Palm on the Planks', 'Ладонь на досках'],
      b: [
        'Ilse’s first lesson: put out to open water, ship the oars, and have every hand lay a palm on the planks and keep silent. “The sea talks through wood,” she says, “if you let it.”',
        'Первый урок Ильзе: выйти в открытое море, убрать вёсла, и пусть каждый положит ладонь на доски и молчит. «Море говорит через дерево, — говорит она, — если ему не мешать».',
      ],
      d: ['In the third hour the crew feel it: a hum in the planks, like an organ heard from a long way off.', 'На третий час команда чувствует это: доски гудят, как орган, который слышно издалека.'],
      s: ['escort', 'hub'],
    },
    {
      t: ['Iron in the Keel', 'Железо в киле'],
      b: [
        'Palms are for beginners. Ilse wants iron rods set into the keel, one for each watch, so that the ship herself becomes an ear. Bring iron to {hub}, and her smith will do the rest.',
        'Ладони — для новичков. Ильзе хочет вделать в киль железные прутья, по одному на каждую вахту, чтобы ухом стал сам корабль. Привезите железо в порт {hub}, остальное сделает её кузнец.',
      ],
      d: ['Each rod hums its own note. Jory names them, as if they were the ship’s cats.', 'Каждый прут гудит своей нотой. Джори даёт им имена, будто это корабельные кошки.'],
      s: ['bring:iron'],
    },
    {
      t: ['Voices on a Stave', 'Голоса на нотном стане'],
      b: [
        'Now listen properly, Ilse says. Lie off {isle}, then off {isle2}, and let the rods ring. Every drowned bell has its own voice, and she will write each one down.',
        'Теперь слушайте как следует, говорит Ильзе. Встаньте у острова {isle}, потом у острова {isle2} и дайте прутьям звучать. У каждого утонувшего колокола свой голос, и она запишет каждый.',
      ],
      d: ['On Ilse’s stave the bells you silenced are gaps. The rest still ring.', 'На нотном стане Ильзе заглушённые вами колокола — пустые места. Остальные всё ещё звучат.'],
      s: ['isle', 'isle2', 'hub'],
    },
    {
      t: ['The Purge', 'Чистка'],
      b: [
        'The Widow’s men are searching the city house by house for the traitor ringer. Pilgrims flee in anything that floats, and the Choir’s guard boats run them down in the harbour mouth.',
        'Люди Вдовы обыскивают город дом за домом в поисках звонаря-предателя. Паломники бегут на всём, что держится на воде, а сторожевые лодки Хора топят их в горле гавани.',
      ],
      d: ['The pilgrims you pull from the water will not say Ansel’s name aloud, but every one of them knows it.', 'Спасённые паломники не произносят имени Ансельма вслух, но знают его все до одного.'],
      s: ['rescue', 'hub'],
    },
    {
      t: ['Boats at the Sea Gate', 'Лодки у морских ворот'],
      b: [
        'The Choir has found the sea gate and set search boats across it. Ilse’s chapel has only one other way out, and it is under the water. Clear the gate before the boats come ashore.',
        'Хор нашёл морские ворота и поставил поперёк них досмотровые лодки. Другой выход из часовни Ильзе только один, и тот под водой. Очистите ворота, пока лодки не причалили.',
      ],
      d: ['The gate is clear. In the bow of one boat lies a list of houses — the chapel is next.', 'Ворота свободны. На носу одной из лодок лежит список домов, и часовня в нём следующая.'],
      s: ['board', 'hub'],
    },
    {
      t: ['A Deaf Man Listens', 'Глухой слушает'],
      b: [
        'Ilse says the best listener in these waters is a fisherman on {isle} who has been deaf since birth and hears the bells through the soles of his feet. Go ashore and ask him what he hears now.',
        'Ильзе говорит, что лучший слушатель в этих водах — рыбак с острова {isle}: он глух от рождения и слышит колокола ступнями. Сойдите на берег и спросите, что он слышит теперь.',
      ],
      d: ['The deaf man stamps out a rhythm on the sand: the bells are ringing faster, as though they were being called.', 'Глухой выстукивает ногой ритм на песке: колокола звонят всё быстрее, будто их зовут.'],
      s: ['land:fishers', 'hub'],
    },
    {
      t: ['The Lead Line Sings', 'Лот поёт'],
      b: [
        'A lead line, Ilse says, is an ear that reaches the bottom. Sound the waters round the city, and mark every island where the wet line hums in your hand.',
        'Лот, говорит Ильзе, — это ухо, которое достаёт до дна. Промерьте воды вокруг города и отметьте каждый остров, где мокрый линь гудит у вас в руке.',
      ],
      d: ['Ilse traces your marks with a fingertip and stops at each one, as if feeling for a pulse.', 'Ильзе ведёт пальцем по вашим отметкам и задерживается на каждой, словно нащупывает пульс.'],
      s: [['chart', 'Sound and chart the islands where the lead line hums: {n}.', 'Промерьте лотом и нанесите на карту острова, где гудит линь: {n}.'], 'hub'],
    },
    {
      t: ['The Cellar Under the Altar', 'Подвал под алтарём'],
      b: [
        'Ansel hides in the cellar under Ilse’s altar, and the bells the Widow rings for him have made him ill: he shakes and cannot sleep. Bring medicine to {hub}, quietly.',
        'Ансельм прячется в подвале под алтарём Ильзе, и колокола, которыми Вдова зовёт его, довели его до болезни: его трясёт, и он не спит. Тихо привезите лекарства в порт {hub}.',
      ],
      d: ['Ansel sleeps at last. Awake for a moment, he whispers: “She came for me, not for the bells.”', 'Ансельм наконец засыпает. Очнувшись на миг, он шепчет: «Она пришла за мной, а не за колоколами».'],
      s: ['bring:medicine'],
    },
    {
      t: ['The Widow’s Sermon', 'Проповедь Вдовы'],
      b: [
        'The Widow sails out to bless her fleet off {isle}, and Ilse wants you close enough to hear her. Keep the sea there, at the edge of her lanterns, and do not fire.',
        'Вдова выходит благословлять свой флот у острова {isle}, и Ильзе хочет, чтобы вы оказались достаточно близко, чтобы её услышать. Держитесь там, на краю света её фонарей, и не стреляйте.',
      ],
      d: ['Her voice carries over the water without effort: “All that the sea took, it will give back.” Jory crosses himself.', 'Её голос без усилия разносится над водой: «Всё, что взяло море, оно вернёт». Джори крестится.'],
      s: ['isle', 'escort'],
    },
    {
      t: ['A Bell That Never Drowned', 'Колокол, что не утонул'],
      b: [
        'The old chapel’s own bell was cast by Ilse’s husband and has never touched the sea. The Choir wants it melted. Raise a bell-house for it on your island, where no tide will ever reach.',
        'Колокол старой часовни отлил муж Ильзе, и он ни разу не касался моря. Хор хочет его переплавить. Поставьте для него звонницу на своём острове — там, куда не дойдёт ни один прилив.',
      ],
      d: ['The bell is hung high on your island. Ilse touches it once and does not ring it.', 'Колокол поднят высоко на вашем острове. Ильзе касается его один раз и не звонит.'],
      s: ['build', 'hub'],
    },
    {
      t: ['Bread for the Fled', 'Хлеб для беглецов'],
      b: [
        'The pilgrims who escaped the purge are starving on the quays of {port2}, and no one there will feed a heretic. Provisions wait at {port}; Ilse asks you to carry them yourself.',
        'Паломники, бежавшие от чистки, голодают на причалах порта {port2}, и кормить там еретиков никто не станет. Провизия ждёт в порту {port}; Ильзе просит отвезти её самим.',
      ],
      d: ['The pilgrims share the bread, and an old woman sings a hymn from before the Choir.', 'Паломники делят хлеб, и старуха поёт гимн, который пели ещё до Хора.'],
      s: ['carry:provisions'],
    },
    {
      t: ['Listening Below', 'Слушать в глубине'],
      b: [
        'Some voices are too faint for rods or lines. Ilse sends divers down off {isle} to press their ears to the bottom and come back with what they heard.',
        'Иные голоса слишком слабы для прутьев и линя. Ильзе посылает водолазов вниз у острова {isle}: прижаться ухом ко дну и вернуться с тем, что услышат.',
      ],
      d: ['The divers come up and hum the same three notes, each one alone, without having spoken to the others.', 'Водолазы поднимаются и напевают одни и те же три ноты, хотя каждый поднимался один и ни с кем не говорил.'],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Novice Who Talked', 'Послушник проговорился'],
      b: [
        'One of the novices freed from the training ship has gone missing, and so has a skiff. Ilse is afraid he knows about the cellar. Catch the skiff before it reaches the Widow’s brig.',
        'Пропал один из послушников, освобождённых с учебного корабля, а с ним и ялик. Ильзе боится, что мальчик знает о подвале. Перехватите ялик, пока он не дошёл до брига Вдовы.',
      ],
      d: ['Too late: the boy has already spoken. The skiff carried only the silver he was paid.', 'Поздно: мальчик уже всё рассказал. В ялике только серебро, которое ему заплатили.'],
      s: ['board', 'hub'],
    },
    {
      t: ['Ansel Taken', 'Ансельма взяли'],
      b: [
        'They came for the chapel at the third bell of night. Ilse held the door; Ansel was carried out through the water passage. Chase the boats into the dark before they reach open sea.',
        'Они пришли к часовне на третьем ударе ночи. Ильзе держала дверь, а Ансельма вынесли через подводный ход. Гонитесь за лодками в темноте, пока они не вышли в открытое море.',
      ],
      d: ['The boats get away under the guns of their ghost escort. Ilse binds her split hand and says only: “Find him.”', 'Лодки уходят под прикрытием кораблей-призраков. Ильзе перевязывает разбитую руку и говорит одно: «Найдите его».'],
      s: ['sink:3:ghost', 'escort'],
    },
    {
      t: ['The Barge of Silence', 'Баржа молчания'],
      b: [
        'Ilse listens to the planks all night and at dawn names a place: off {isle} lies a barge where the Choir takes ringers who have sinned, to unlearn their bells. Go and look.',
        'Всю ночь Ильзе слушает доски, а на рассвете называет место: у острова {isle} стоит баржа, куда Хор свозит провинившихся звонарей, чтобы те разучились звонить. Сходите посмотреть.',
      ],
      d: ['The barge has no bell and no lantern, and its rowers keep time by a drum with a muffled skin.', 'На барже нет ни колокола, ни фонаря, а гребцы держат ритм по барабану с обмотанной кожей.'],
      s: ['isle', 'hub'],
    },
    {
      t: ['Riders from the Ash', 'Вестники с пепелищ'],
      b: [
        'A Code sloop limps into {hub} with burnt sails: pirates in the Choir’s pay are raiding the sea lanes to the east, and the Choir’s fleet is said to be following them. Find out if it is true.',
        'В порт {hub} приковыливает шлюп Кодекса с обгоревшими парусами: пираты на жалованье у Хора грабят морские пути на востоке, а за ними, говорят, идёт флот Хора. Узнайте, правда ли это.',
      ],
      d: ['The prisoners confirm it: half the Choir’s fleet has gone east, towards the Code’s islands.', 'Пленные подтверждают: половина флота Хора ушла на восток, к островам Кодекса.'],
      s: ['sink::pirate', 'hub'],
    },
    {
      t: ['A Bell No Chart Shows', 'Колокол, которого нет на картах'],
      b: [
        'Ilse’s last lesson is to find a bell by ear alone. She has heard one under {isle} that no chart shows, not even the Black Chart. Land at the old bell-stone and send divers down from it.',
        'Последний урок Ильзе — найти колокол одним слухом. Под островом {isle} она услышала колокол, которого нет ни на одной карте, даже на Чёрной. Высадитесь у старого колокольного камня и спустите оттуда водолазов.',
      ],
      d: ['The bell is there, small and green with age. Ilse marks it on her own chart, in her own hand.', 'Колокол там — маленький, зелёный от времени. Ильзе отмечает его на своей карте, своей рукой.'],
      s: ['land:bell', 'dive'],
    },
    {
      t: ['Brother Ansel’s Rescue', 'Спасение Ансельма'],
      alt: {
        key: 'ansel',
        label: [['Save Ansel', 'Спасти Ансельма'], ['Chase the Widow', 'Гнаться за Вдовой']],
        t: ['After the Black Brig', 'За чёрным бригом'],
        b: [
          'The barge can wait; the Widow cannot. Run down the black brig before she reaches open water, break her escort, and make her pay for every bell she ever rang.',
          'Баржа подождёт, Вдова — нет. Догоните чёрный бриг, пока он не вышел в открытое море, разбейте охрану и заставьте Вдову заплатить за каждый колокол, в который она звонила.',
        ],
        d: [
          'The brig slips into the fog, but her consort is yours, and in its cabin lies her chart of the southern waters.',
          'Бриг уходит в туман, но его спутник ваш, и в каюте лежит её карта южных вод.',
        ],
        s: ['sink:4:ghost', 'board:1'],
      },
      b: [
        'At dawn the barge of silence weighs anchor, and in the same hour the Widow’s brig slips out of the harbour. You cannot catch both. Ilse says nothing: the choice is yours. Take the barge and bring Ansel out.',
        'На рассвете баржа молчания снимается с якоря, и в тот же час чёрный бриг Вдовы выскальзывает из гавани. Обоих не догнать. Ильзе молчит: выбор за вами. Возьмите баржу и выведите Ансельма.',
      ],
      d: [
        'Ansel comes up from the hold grey and silent, his hands bound in silk. “She wanted me to forget how to ring,” he says.',
        'Ансельм поднимается из трюма серый и молчаливый, руки его обмотаны шёлком. «Она хотела, чтобы я разучился звонить», — говорит он.',
      ],
      s: ['board:2', 'rescue'],
    },
    {
      t: ['The Note Beneath', 'Нота под звоном'],
      b: [
        'With the Widow gone, the city’s bells fall quiet one by one, and under them Ilse hears something new: a single note, like a wet finger on the rim of a glass. Lie still at sea and let her listen.',
        'Вдова ушла, и городские колокола один за другим смолкают, а под ними Ильзе слышит новое: одну ноту, словно мокрым пальцем провели по краю бокала. Замрите в море и дайте ей слушать.',
      ],
      d: [
        'Every drowned bell is tuned to that one note, Ilse says, and it sounds from the south, from the lighthouse at the very edge of the deep.',
        'Все утонувшие колокола настроены на эту ноту, говорит Ильзе, и звучит она с юга — от маяка на самом краю глубины.',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['The Choir Sails East', 'Хор уходит на восток'],
      b: [
        'The Choir’s fleet is leaving the harbour of {hub} in long lines, its green lanterns turned east. Take a straggler and learn where it is bound.',
        'Флот Хора длинными колоннами выходит из гавани порта {hub}, и его зелёные фонари повёрнуты на восток. Возьмите отставший корабль и узнайте, куда он идёт.',
      ],
      d: ['The straggler’s orders are a single line: “Burn the islands that gave her powder.”', 'Приказ на отставшем корабле — одна строка: «Сжечь острова, что дали ей порох».'],
      s: ['sink::ghost', 'board:1'],
    },
    {
      t: ['A City Without Bells', 'Город без колоколов'],
      b: [
        'Only the Choir’s garrison is left in {hub}, and its great tower still commands the harbour from {isle}. Ilse asks you to finish it: sink the guard ships, land under the tower and take its belfry before the fleet can turn back.',
        'В порту {hub} остался лишь гарнизон Хора, но его большая башня на острове {isle} по-прежнему держит гавань. Ильзе просит довести дело до конца: потопите сторожевые корабли, высадитесь под башней и возьмите звонницу, пока флот не повернул назад.',
      ],
      d: [
        'The city sleeps without bells for the first time in years. Ilse gives you a chart of every voice she has heard — then the night lamps speak from the east: the Code’s islands are burning.',
        'Впервые за много лет город спит без колоколов. Ильзе отдаёт вам карту всех голосов, что она слышала, — а ночью с востока говорят сигнальные фонари: острова Кодекса горят.',
      ],
      s: ['sink:4:ghost', 'land:bell', 'board:1', 'hub'],
    },
  ],
};
