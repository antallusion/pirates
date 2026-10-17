// Chapter 35 — The Last Peal (Act VI, the Abyss). Brother Ansel rings the Widow's bells backwards, from the last to the
// first; the duel of flagships with the Widow (the branch `widow`: silence her bell and spare her, or sink her ship).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 35,
  region: 'the_abyss',
  more: ['drowned_crown'],
  hub: 'marrowdeep',
  title: ['The Last Peal', 'Последний звон'],
  blurb: [
    'Around the Eye the Widow has hung the bells she gathered over a hundred years, seven of them, waiting for one stroke. Brother Ansel knows how to ring them backwards, from the last to the first, and the first hangs on her own flagship.',
    'Вокруг Ока Вдова развесила колокола, собранные за сто лет, — семь колоколов, ждущих одного удара. Брат Ансельм знает, как прозвонить их задом наперёд, от последнего к первому, а первый висит на её собственном флагмане.',
  ],
  giver: ['Brother Ansel, disgraced ringer of the Choir', 'Брат Ансельм, опальный звонарь Хора'],
  portrait: 'giver_cultist_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Ansel Comes to the Wall', 'Ансельм приходит к Стене'],
      b: [
        'Brother Ansel has come to {hub} with nothing but a ringer’s gloves and a list copied from the back of the Black Chart. He has not been past the Wall. Take him to {isle}, so he can hear what he is about to undo.',
        'Брат Ансельм приехал в порт {hub}, не взяв с собой ничего, кроме перчаток звонаря и списка, переписанного с оборота Чёрной карты. За Стеной он ещё не бывал. Отвезите его к острову {isle}, чтобы он услышал то, что ему предстоит отменить.',
      ],
      d: [
        'Ansel listens with his gloves pressed to his ears. “Seven,” he says. “She has hung seven, and every one of them is waiting.”',
        'Ансельм слушает, прижав перчатки к ушам. «Семь, — говорит он. — Она развесила семь, и каждый ждёт».',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Order of the Peal', 'Порядок звона'],
      b: [
        'A peal rung forward wakes the tide; rung backward, Ansel says, it sings it to sleep. But to ring backward you must know exactly where each bell hangs. Chart the islands round the Eye and find all seven.',
        'Звон, прозвоненный по порядку, будит прилив; прозвоненный задом наперёд, говорит Ансельм, — убаюкивает его. Но чтобы звонить задом наперёд, надо точно знать, где висит каждый колокол. Нанесите на карту острова вокруг Ока и найдите все семь.',
      ],
      d: [
        'Seven islands, seven bells, in a spiral round the Eye. The last of them hangs closest to the edge.',
        'Семь островов, семь колоколов, по спирали вокруг Ока. Последний висит ближе всех к краю.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Seventh Bell', 'Седьмой колокол'],
      b: [
        'The seventh bell hangs from a dead tree on {isle}, a ship’s bell from a Crown frigate, its clapper tied back with grey cord. Ansel must strike it first, once, with the cord still on. Land him there.',
        'Седьмой колокол висит на сухом дереве на острове {isle}: судовой колокол с фрегата Короны, язык подвязан серым шнуром. Ансельм должен ударить в него первым, один раз, не снимая шнура. Высадите его там.',
      ],
      d: [
        'The bell gives a muffled, backward sound, like a word said while breathing in. Out at sea the swell drops a hand’s breadth.',
        'Колокол издаёт глухой, обратный звук — будто слово, сказанное на вдохе. В открытом море зыбь опускается на ладонь.',
      ],
      s: ['isle', 'land:bell'],
    },
    {
      t: ['The Sixth Bell', 'Шестой колокол'],
      b: [
        'The sixth hangs underwater, in the bell-tower of a drowned chapel, and a Choir cutter lies above it with divers ready to go down. Take the cutter, then send your own divers with Ansel’s gloves.',
        'Шестой висит под водой, в звоннице утонувшей часовни, а над ним стоит катер Хора с водолазами наготове. Захватите катер, а потом отправьте вниз своих водолазов с перчатками Ансельма.',
      ],
      d: [
        'Your diver strikes the bell with a gloved fist. The sound comes up through the water and every man on deck yawns at once.',
        'Ваш водолаз бьёт в колокол кулаком в перчатке. Звук поднимается сквозь воду, и все на палубе разом зевают.',
      ],
      s: ['board', 'dive'],
    },
    {
      t: ['Muffles of Sailcloth', 'Глушители из парусины'],
      b: [
        'Each bell, once rung backward, must be muffled at once, or it will ring forward again in the next swell. Ansel wants sailcloth by the bolt and needles and tarred twine to stitch it with.',
        'Каждый колокол, прозвоненный задом наперёд, надо сразу же заглушить, иначе со следующей волной он снова зазвонит по порядку. Ансельму нужна парусина штуками, иглы и смолёная нить, чтобы её сшивать.',
      ],
      d: [
        'The sailmakers sew bell-hoods all night by lantern light, and in the morning the deck is piled with grey sacks the size of men.',
        'Парусные мастера всю ночь при фонарях шьют чехлы для колоколов, и к утру палуба завалена серыми мешками ростом с человека.',
      ],
      s: ['bring:sailcloth'],
    },
    {
      t: ['Ringers of the Choir', 'Звонари Хора'],
      b: [
        'The Widow has learned what Ansel is doing and has sent ringers to every remaining bell, with orders to strike forward the moment they see your sails. Catch them on the water, before they reach the islands.',
        'Вдова узнала, что делает Ансельм, и отправила звонарей ко всем оставшимся колоколам с приказом бить по порядку, едва покажутся ваши паруса. Перехватите их в море, пока они не добрались до островов.',
      ],
      d: [
        'Among the prisoners is a boy who was Ansel’s pupil once. Ansel gives him his own gloves and says nothing more.',
        'Среди пленных — мальчик, когда-то учившийся у Ансельма. Ансельм отдаёт ему свои перчатки и больше ничего не говорит.',
      ],
      s: ['board:2', 'sink:3'],
    },
    {
      t: ['The Fifth Bell', 'Пятый колокол'],
      b: [
        'The fifth bell hangs over the water from a stone arch off {isle}, and it can only be rung from a boat at slack tide. Hold the waters round the arch while Ansel’s boat goes in and does its work.',
        'Пятый колокол висит над водой в каменной арке у острова {isle}, и звонить в него можно только с лодки, в стоячую воду. Удерживайте воды вокруг арки, пока шлюпка Ансельма входит под неё и делает своё дело.',
      ],
      d: [
        'The fifth bell is hooded. Ansel rows back with his eyes closed, counting under his breath.',
        'Пятый колокол в чехле. Ансельм возвращается на вёслах с закрытыми глазами и что-то считает себе под нос.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['The Fourth Bell', 'Четвёртый колокол'],
      b: [
        'The fourth bell stands in a shrine on {isle}, and the Widow has filled the caves around it with creatures that hate the sound of a bell more than anything. Clear the way, and bring Ansel through.',
        'Четвёртый колокол стоит в святилище на острове {isle}, а пещеры вокруг Вдова заполнила тварями, которые ненавидят звон колокола больше всего на свете. Расчистите дорогу и проведите Ансельма.',
      ],
      d: [
        'When the fourth bell is rung backward, the creatures in the caves go quiet and curl up to sleep.',
        'Когда четвёртый колокол прозвонен задом наперёд, твари в пещерах затихают и сворачиваются спать.',
      ],
      s: ['land:shrine', 'lair'],
    },
    {
      t: ['Ansel’s Doubt', 'Сомнение Ансельма'],
      b: [
        'Halfway through, Ansel loses his nerve: what if a bell rung backward sends the drowned further away, for ever? He asks to go back to his old cell at Saint Maw, where a book of the Choir’s first ringers is hidden.',
        'На полпути Ансельм теряет решимость: а что, если колокол, прозвоненный задом наперёд, уведёт утонувших ещё дальше — навсегда? Он просит отвезти его в старую келью в Сент-Мо, где спрятана книга первых звонарей Хора.',
      ],
      d: [
        'The book says only: “The tide rung to sleep keeps what it holds, and holds it gently.” Ansel reads it twice and puts on his gloves.',
        'В книге сказано лишь: «Прилив, убаюканный звоном, хранит то, что держит, и держит бережно». Ансельм читает дважды и надевает перчатки.',
      ],
      s: ['at:saint_maw', 'hub'],
    },
    {
      t: ['The Third Bell', 'Третий колокол'],
      b: [
        'The third bell hangs in the wreck of the ship that first carried it, and the wreck has company: echoes of every ship that ever struck that reef, drifting round it in a slow ring. Send them back, then send your divers down.',
        'Третий колокол висит в обломках корабля, который когда-то первым его вёз, и у обломков есть свита: эхо всех кораблей, что когда-либо разбились об этот риф, медленно кружит вокруг. Верните их на дно, а потом спустите водолазов.',
      ],
      d: [
        'Struck backward, the third bell sends a long sigh through the water, and the ring of echoes settles slowly onto the sand.',
        'Прозвоненный задом наперёд, третий колокол посылает сквозь воду долгий вздох, и кольцо эха медленно ложится на песок.',
      ],
      s: ['sink:5:ghost', 'dive'],
    },
    {
      t: ['Covering Fire', 'Огонь прикрытия'],
      b: [
        'With every bell that goes silent, the Widow’s remaining ships grow more desperate. Ansel needs a clear sea round the last two islands. Keep it clear, and take whatever comes at you broadside.',
        'С каждым умолкшим колоколом уцелевшие корабли Вдовы становятся всё отчаяннее. Ансельму нужно чистое море вокруг двух последних островов. Держите его чистым и берите на абордаж всё, что подойдёт к вам бортом.',
      ],
      d: [
        'The sea around the islands is yours. Ansel waves his hat from the boat, like a boy at a fair.',
        'Море вокруг островов ваше. Ансельм машет шляпой из шлюпки, как мальчишка на ярмарке.',
      ],
      s: ['escort', 'board:2'],
    },
    {
      t: ['The Second Bell', 'Второй колокол'],
      b: [
        'The second bell is cast in two halves that must be struck together: one hangs on {isle}, the other on {isle2}, a mile of sea between them. Ansel takes one; Jory Penn, gloved, takes the other.',
        'Второй колокол отлит из двух половин, в которые надо ударить одновременно: одна висит на острове {isle}, другая — на острове {isle2}, и между ними миля моря. Одну берёт Ансельм, другую — Джори Пенн в перчатках звонаря.',
      ],
      d: [
        'Two lanterns blink, two strokes fall together, and across the whole Abyss the sea lies down a little.',
        'Мигают два фонаря, два удара падают разом, и по всей Бездне море немного ложится.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['Iron for the Yoke', 'Железо для хомута'],
      b: [
        'The first bell, the Widow’s own, must be held still while it is struck, or it will swing and ring forward. Ansel has drawn an iron yoke to clamp it. The smiths of {port2} can forge it if someone brings them iron from {port}.',
        'Первый колокол, собственный колокол Вдовы, надо держать неподвижно, пока по нему бьют, иначе он качнётся и зазвонит по порядку. Ансельм начертил железный хомут, чтобы его зажать. Кузнецы порта {port2} выкуют его, если им привезут железо из порта {port}.',
      ],
      d: [
        'The yoke is ready, black and ugly and strong enough to hold a church. The smiths will not take payment for it.',
        'Хомут готов: чёрный, уродливый и такой крепкий, что удержит целую церковь. Кузнецы не берут за него платы.',
      ],
      s: ['carry:iron'],
    },
    {
      t: ['The Last Admiral Sighted', 'Замечен «Последний адмирал»'],
      b: [
        'The Widow’s flagship is named for her husband: the Last Admiral. Jory sights her at dawn in the lee of {isle}, her great bell hooded, her guns run out, waiting for you as a duellist waits at the appointed tree.',
        'Флагман Вдовы назван в честь её мужа — «Последний адмирал». Джори замечает его на рассвете с подветренной стороны острова {isle}: большой колокол в чехле, пушки выкачены, он ждёт вас, как дуэлянт ждёт у условленного дерева.',
      ],
      d: [
        'She dips her colours once, in the old salute between equals. Your gunner asks if he should answer. Answer.',
        'Он один раз приспускает флаг — старый салют равному. Ваш канонир спрашивает, отвечать ли. Ответьте.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['Her Last Escort', 'Последний конвой Вдовы'],
      b: [
        'Before the duel, the Widow’s last loyal captains place themselves between you and her flagship, and will not move. They are old men of the Choir who have followed her for forty years. Get past them.',
        'Перед поединком последние верные Вдове капитаны встают между вами и её флагманом и не сдвигаются с места. Это старики Хора, идущие за ней сорок лет. Пройдите сквозь них.',
      ],
      d: [
        'The old captains strike one by one and are rowed away to the islands. Between you and the Last Admiral there is only water.',
        'Старые капитаны спускают флаги один за другим, и их отвозят на острова. Между вами и «Последним адмиралом» остаётся только вода.',
      ],
      s: ['sink:4', 'board:2'],
    },
    {
      t: ['Silence the Widow’s Bell', 'Заглушить колокол Вдовы'],
      b: [
        'Lay your ship alongside the Last Admiral and go over her rail. Fight your way to the quarterdeck, clamp the great bell in Ansel’s yoke, and let him strike it backward. Leave Morwen her life, if she will take it.',
        'Встаньте борт к борту с «Последним адмиралом» и поднимитесь на его палубу. Пробейтесь к шканцам, зажмите большой колокол хомутом Ансельма и дайте ему ударить задом наперёд. Оставьте Морвен жизнь, если она её примет.',
      ],
      d: [
        'The first bell is silent. Morwen sits on the deck in her grey coat with her hands in her lap, and does not look up when you leave her a boat.',
        'Первый колокол молчит. Морвен сидит на палубе в сером плаще, сложив руки на коленях, и не поднимает глаз, когда вы оставляете ей шлюпку.',
      ],
      s: ['sink:3', ['board:1', 'Board the Last Admiral and silence her bell.', 'Возьмите на абордаж «Последнего адмирала» и заглушите его колокол.']],
      alt: {
        key: 'widow',
        label: [['Silence her bell, spare her', 'Заглушить колокол, пощадить'], ['Sink her flagship', 'Потопить её флагман']],
        t: ['Sink the Last Admiral', 'Потопить «Последнего адмирала»'],
        b: [
          'The Widow will not be stopped while her ship floats, and Ansel says the first bell can be rung backward on its way down as well as on a deck. Duel the Last Admiral broadside to broadside, and put her on the bottom.',
          'Вдову не остановить, пока её корабль на плаву, а Ансельм говорит, что первый колокол можно прозвонить задом наперёд и тогда, когда он идёт ко дну, — не хуже, чем на палубе. Сойдитесь с «Последним адмиралом» борт на борт и отправьте его на дно.',
        ],
        d: [
          'As the Last Admiral goes down, her bell tolls once, backward, as if the ship herself knew. A small boat rows away from the wreck toward the light.',
          'Уходя под воду, «Последний адмирал» отбивает колоколом один удар — задом наперёд, словно корабль сам всё понял. От обломков к свету уходит на вёслах маленькая лодка.',
        ],
        s: [['sink:4', 'Sink the Last Admiral and her consorts: {n}.', 'Потопите «Последнего адмирала» и его спутников: {n}.'], 'board:1'],
      },
    },
    {
      t: ['The Silence After', 'Тишина после'],
      b: [
        'For the first time since you sailed through the Wall, nothing is ringing anywhere. Ansel asks you to keep the ship still and the crew quiet for one watch, so that he can listen to the deep and be sure.',
        'Впервые с тех пор, как вы прошли за Стену, нигде ничего не звонит. Ансельм просит держать корабль неподвижно, а команду — молча одну вахту, чтобы он мог послушать глубину и убедиться.',
      ],
      d: [
        'At the end of the watch Ansel opens his eyes. “Almost,” he says. “Something is still awake down there.”',
        'К концу вахты Ансельм открывает глаза. «Почти, — говорит он. — Там, внизу, ещё кое-что не спит».',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['The Great Bell Stirs', 'Великий колокол шевелится'],
      b: [
        'Under the Eye, deeper than any of the seven, hangs a bell no one has ever seen: the Gravetide itself. Ansel says it has begun to swing on its own. Go to {isle}, over the centre of the light, and send divers down as far as they can go.',
        'Под Оком, глубже всех семи, висит колокол, которого никто никогда не видел, — сам Гробовой прилив. Ансельм говорит, что он начал раскачиваться сам. Идите к острову {isle}, над самым центром света, и спустите водолазов так глубоко, как они смогут.',
      ],
      d: [
        'The divers come up with their lines humming. Far below, something vast is moving slowly from side to side, like a pendulum.',
        'Водолазы поднимаются, и их лини гудят. Глубоко внизу что-то огромное медленно ходит из стороны в сторону, как маятник.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Backward Peal', 'Обратный звон'],
      b: [
        'For the peal to hold, all seven hooded bells must be struck once more together, backward, at the turn of the tide. The Choir’s last ships are making for the islands to strike forward first. Hold them off while Ansel’s ringers go ashore.',
        'Чтобы звон удержался, все семь колоколов в чехлах надо ещё раз ударить вместе, задом наперёд, на повороте прилива. Последние корабли Хора идут к островам, чтобы ударить по порядку первыми. Сдержите их, пока звонари Ансельма высаживаются на берег.',
      ],
      d: [
        'Seven muffled strokes, and the whole sea sinks a fathom with a sigh. Only the great bell still swings below. “That one,” Ansel says, “only a pilot can ring.”',
        'Семь глухих ударов, и всё море со вздохом опускается на сажень. Внизу качается только великий колокол. «В этот, — говорит Ансельм, — может позвонить только лоцман».',
      ],
      s: ['sink:5', 'board:2', 'land:bell', 'hub'],
    },
  ],
};
