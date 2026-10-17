// Chapter 25 — Steeplewater (Act V, the Drowned Crown). Oren Galt, freed, pilots the captain through the forest of
// sunken spires; the Choir's Cantor races for the third bell, and it is silenced (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 25,
  region: 'drowned_crown',
  hub: 'steeplewater',
  title: ['Steeplewater', 'Шпилевая Вода'],
  blurb: [
    'A town built on the roofs of drowned bell towers, and a forest of spires under the keel. Galt lied to the Choir about one mark on the Black Chart; now the Choir’s Cantor has guessed it, and the race for the third bell begins.',
    'Город, выстроенный на крышах утонувших колоколен, и лес шпилей под килем. Галт солгал Хору об одной отметке на Чёрной карте; теперь Кантор Хора догадался об обмане, и начинается гонка за третьим колоколом.',
  ],
  giver: ['Oren Galt, pilot', 'Орен Галт, лоцман'],
  portrait: 'giver_old_salt_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Hands That Remember', 'Руки помнят'],
      b: [
        'Galt can barely stand, but he will not stay ashore while the Choir hunts the third bell. He asks for the helm once, among the spires off {isle}, to see whether his hands still know the way.',
        'Галт едва держится на ногах, но оставаться на берегу, пока Хор ищет третий колокол, не желает. Он просит штурвал хотя бы раз — среди шпилей у острова {isle}, — чтобы проверить, помнят ли руки дорогу.',
      ],
      d: ['“The hands remember,” Galt says. “The head can catch up.”', '«Руки помнят, — говорит Галт. — А голова пусть догоняет».'],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Lie in the Chart', 'Ложь на карте'],
      b: [
        'For a year Galt read the Black Chart for the Choir and lied about a single mark. Their divers should still be searching the wrong spire, off {isle}. He wants to see it with his own eyes.',
        'Целый год Галт читал Хору Чёрную карту и солгал лишь об одной отметке. Их ныряльщики должны до сих пор искать не тот шпиль — у острова {isle}. Он хочет увидеть это своими глазами.',
      ],
      d: ['Choir divers go down at the wrong spire, again and again. Galt smiles into his beard.', 'Ныряльщики Хора раз за разом спускаются у не того шпиля. Галт улыбается в бороду.'],
      s: ['isle', 'escort'],
    },
    {
      t: ['A Town on Steeples', 'Город на колокольнях'],
      b: [
        'The people of {hub} live on the roofs of drowned bell towers and cross between them on plank walkways. Last night’s swell tore half the walkways away, and children are stranded on the far spires.',
        'Жители порта {hub} живут на крышах утонувших колоколен и ходят друг к другу по дощатым мосткам. Ночная зыбь сорвала половину мостков, и дети остались на дальних шпилях.',
      ],
      d: ['New planks bridge the gaps, and the children run home across water that was empty yesterday.', 'Новые доски перекинуты через провалы, и дети бегут домой там, где вчера была только вода.'],
      s: ['bring:planks'],
    },
    {
      t: ['A Pipe for Galt', 'Трубка для Галта'],
      b: [
        'The Choir broke Galt’s pipe on the first day. Jory says an old tobacconist at {port} was a pilot once, and keeps the tide tables of the spires in his back room as well as his leaf.',
        'Хор сломал трубку Галта в первый же день. Джори говорит, что старый табачник в порту {port} когда-то был лоцманом и держит в задней комнате не только табак, но и таблицы приливов среди шпилей.',
      ],
      d: ['Galt lights the new pipe, reads the tables, and for the first time since the rock he laughs.', 'Галт раскуривает новую трубку, читает таблицы и впервые после скалы смеётся.'],
      s: ['port', 'hub'],
    },
    {
      t: ['Soundings Among Spires', 'Промеры среди шпилей'],
      b: [
        'The spires shift with the silt, and an old sounding is worth less than a guess. Galt wants the islands round the spire forest charted afresh before anyone takes a deep ship in.',
        'Шпили уходят и выходят из ила, и старый промер стоит меньше догадки. Галт хочет заново нанести на карту острова вокруг леса шпилей, прежде чем кто-нибудь поведёт туда глубокий корабль.',
      ],
      d: ['Galt pins your chart beside the Black Chart and draws one line between them, slowly.', 'Галт прикалывает вашу карту рядом с Чёрной и медленно проводит между ними одну линию.'],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Cantor’s Divers', 'Ныряльщики Кантора'],
      b: [
        'The Choir’s diving ships answer to a man called the Cantor, who sings his orders instead of shouting them. Take one of his ships and find out how much he knows.',
        'Ныряльщиками Хора командует человек по прозвищу Кантор: он не кричит приказы, а поёт их. Возьмите один из его кораблей и узнайте, что ему известно.',
      ],
      d: ['The Cantor’s orders: “The old man lied. Search every spire in order, from the deepest.”', 'Приказ Кантора: «Старик солгал. Обыскать все шпили по порядку, начиная с самого глубокого».'],
      s: ['board', 'hub'],
    },
    {
      t: ['The Spire Wells', 'Колодцы у шпилей'],
      b: [
        'When the bells stir below, the water round the spires turns into wells that suck boats down. Two fishing boats off {isle} have already gone in. Pull out whoever is still afloat.',
        'Когда внизу шевелятся колокола, вода вокруг шпилей закручивается воронками, и они затягивают лодки. У острова {isle} в воронку уже ушли две рыбацкие лодки. Вытащите всех, кто ещё держится на воде.',
      ],
      d: ['A soaked fisherman swears the well hummed as it turned, like a top spun by a child.', 'Промокший рыбак клянётся, что воронка гудела, крутясь, как волчок, запущенный ребёнком.'],
      s: ['isle', 'rescue'],
    },
    {
      t: ['Ore for the Collars', 'Руда для ошейников'],
      b: [
        'Ansel’s iron collars held a small bell. Galt has seen the third one, and says iron will split on it like ice. Only abyssal ore will hold: take it on at {port} and carry it to the forge at {port2}.',
        'Железные ошейники Ансельма удержали маленький колокол. Галт видел третий и говорит, что на нём железо лопнет, как лёд. Выдержит только абиссальная руда: примите её в порту {port} и доставьте в кузню в порту {port2}.',
      ],
      d: ['The new collars are black and cold, and the smith says they hum faintly when no one is looking.', 'Новые ошейники черны и холодны, и кузнец говорит, что они тихо гудят, когда на них никто не смотрит.'],
      s: ['carry:abyssal_ore'],
    },
    {
      t: ['The Builders’ Shrine', 'Святилище строителей'],
      b: [
        'At the lowest ebb a shrine rises from the water on {isle}: the builders of the spires kept their records there. Galt believes they wrote down which tower held which bell.',
        'В самый низкий отлив на острове {isle} из воды поднимается святилище: строители шпилей хранили там свои записи. Галт верит, что они записали, в какой башне какой колокол висел.',
      ],
      d: ['On a slate in the shrine: a tower drawn with a bell inside it, and beneath it the word “Mercy”.', 'На каменной доске в святилище нарисована башня с колоколом внутри, а под ней одно слово: «Милосердие».'],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['Divers Wanted', 'Нужны ныряльщики'],
      b: [
        'The third bell hangs deeper than any of your men has gone. The pearl divers of {port} go deeper still, but they will want good pay and a captain who brings them back.',
        'Третий колокол висит глубже, чем спускался кто-либо из ваших людей. Ловцы жемчуга из порта {port} ныряют ещё глубже, но им нужна хорошая плата и капитан, который вернёт их обратно.',
      ],
      d: ['The eldest diver looks at Galt and nods. “Him I trust. You I will learn to.”', 'Старший ныряльщик смотрит на Галта и кивает: «Ему я верю. А вам научусь».'],
      s: ['port', 'recruit'],
    },
    {
      t: ['The Bell Pit', 'Колокольная яма'],
      b: [
        'Galt wants a pit dug on your own island and flooded, with a cracked bell hung at the bottom, so the divers can practise the collars before they go down for real.',
        'Галт хочет, чтобы на вашем острове вырыли и залили водой яму, а на дне подвесили треснувший колокол: пусть ныряльщики потренируются с ошейниками, прежде чем спуститься по-настоящему.',
      ],
      d: ['By the tenth try the divers close a collar in one breath. Galt times them with his pipe.', 'К десятой попытке ныряльщики защёлкивают ошейник за один вдох. Галт засекает время по своей трубке.'],
      s: ['build', 'hub'],
    },
    {
      t: ['The Cantor’s Escort', 'Охрана Кантора'],
      b: [
        'The Cantor has called ghost ships to guard his divers, and they drift among the spires with their lanterns doused. Break the guard and take one of his tenders.',
        'Кантор призвал корабли-призраки охранять своих ныряльщиков, и они дрейфуют среди шпилей с погашенными фонарями. Разбейте охрану и возьмите один из его тендеров.',
      ],
      d: ['The tender is full of empty bell-cradles, waiting for a bell they have not yet found.', 'Тендер полон пустых колокольных люлек, которые ждут ещё не найденного колокола.'],
      s: ['sink::ghost', 'board:1'],
    },
    {
      t: ['The Warden’s Price', 'Цена смотрителя'],
      b: [
        'The water warden of {hub} sells the right to dive in town waters. The Choir paid him in bronze; you will pay him in pearls — and he will stop telling the Choir where you dive.',
        'Смотритель вод в порту {hub} продаёт право нырять в городских водах. Хор платил ему бронзой; вы заплатите жемчугом — и он перестанет рассказывать Хору, где вы ныряете.',
      ],
      d: ['The warden weighs the pearls and suddenly remembers nothing at all.', 'Смотритель взвешивает жемчуг и вдруг ничего больше не помнит.'],
      s: ['bring:pearls'],
    },
    {
      t: ['A Diving Bell', 'Водолазный колокол'],
      b: [
        'On the bottom off {isle} lies the wreck of a salvage ship, and in her hold an old diving bell big enough for three men. Galt says it is the only way to stay down long enough.',
        'На дне у острова {isle} лежит спасательное судно, а в его трюме — старый водолазный колокол на троих. Галт говорит, что иначе внизу не продержаться достаточно долго.',
      ],
      d: ['The diving bell comes up sound. Jory grins: a bell to silence a bell.', 'Водолазный колокол поднят целым. Джори ухмыляется: колоколом заглушать колокол.'],
      s: ['isle', 'dive'],
    },
    {
      t: ['Spire Pirates', 'Пираты шпилей'],
      b: [
        'Pirates hide among the spires and cut the lines of anyone who dives, then take what comes up. They have already cut two of the town’s divers loose.',
        'Среди шпилей прячутся пираты: они перерезают канаты ныряльщикам и забирают всё, что поднимут. Двоих городских ныряльщиков они уже оставили на дне без каната.',
      ],
      d: ['The pirates are gone, and the town’s divers go down again with their lines whole.', 'Пиратов больше нет, и городские ныряльщики снова спускаются на целых канатах.'],
      s: ['sink::pirate', 'hub'],
    },
    {
      t: ['Something Under the Spires', 'Что-то под шпилями'],
      b: [
        'Something large circles the deepest spire, and every diver who has seen it came up without a word. Galt will not send men down until it is gone.',
        'Вокруг самого глубокого шпиля кружит что-то большое, и каждый ныряльщик, кто его видел, поднимался молча. Галт не пошлёт людей вниз, пока оно там.',
      ],
      d: ['The beast is hauled up at last, and its hide is scarred in rings, as if it had wrapped itself round a bell.', 'Зверя наконец поднимают, и его шкура исполосована кольцами, будто он обвивался вокруг колокола.'],
      s: ['beast', 'escort'],
    },
    {
      t: ['The Cantor’s Camp', 'Лагерь Кантора'],
      b: [
        'The Cantor has found the lie, and pirates in his pay are making camp on {isle}, right above the true spire. Land before they can bring the cradles down.',
        'Кантор раскрыл обман, и нанятые им пираты разбивают лагерь на острове {isle} — прямо над настоящим шпилем. Высадитесь раньше, чем они спустят люльки.',
      ],
      d: ['In the camp: the Cantor’s songbook, and on its last page Galt’s own name, crossed out.', 'В лагере — певческая книга Кантора, а на последней странице имя Галта, вычеркнутое.'],
      s: ['land:pirate_camp', 'hub'],
    },
    {
      t: ['The Cantor’s Hired Blade', 'Наёмник Кантора'],
      b: [
        'With his camp gone the Cantor has hired a captain off the Hunters’ Guild’s list to keep you from the spire. Galt says such men are cheaper to sink than to outrun.',
        'Лишившись лагеря, Кантор нанял капитана из списка Гильдии охотников, чтобы не подпускать вас к шпилю. Галт говорит, что таких дешевле потопить, чем от них уйти.',
      ],
      d: ['The hired captain goes down cursing the Cantor, who paid him in bronze that rings.', 'Наёмник идёт на дно, проклиная Кантора, который заплатил ему звенящей бронзой.'],
      s: ['named', 'hub'],
    },
    {
      t: ['Word from Ansel', 'Слово Ансельма'],
      b: [
        'Before you go down, Galt wants Ansel’s last word on binding a great bell. Ansel hides in {at}, under the Choir’s nose, in the cellar of an old chapel, and he trusts nothing to paper.',
        'Прежде чем спускаться, Галт хочет услышать последнее слово Ансельма о том, как связывают большой колокол. Ансельм прячется в порту {at}, под самым носом у Хора, в подвале старой часовни, и бумаге ничего не доверяет.',
      ],
      d: ['Ansel’s word: “On the lowest ebb. Three collars, top to bottom. And do not listen when it strikes.”', 'Слово Ансельма: «В самый низкий отлив. Три ошейника, сверху вниз. И не слушайте, когда он ударит».'],
      s: ['at:saint_maw', 'hub'],
    },
    {
      t: ['The Night Ebb', 'Ночной отлив'],
      b: [
        'The lowest ebb of the month falls at night, and the Cantor knows it too. Hold the waters above the spire until it comes, and take any ship that tries to anchor there first.',
        'Самый низкий отлив месяца приходится на ночь, и Кантор тоже это знает. Держите воды над шпилем, пока он не наступит, и берите любой корабль, что попробует встать там на якорь раньше вас.',
      ],
      d: ['By midnight the sea above the spire is yours, and the water begins to fall.', 'К полуночи море над шпилем ваше, и вода начинает уходить.'],
      s: ['escort', 'board'],
    },
    {
      t: ['Into the Spire', 'Внутрь шпиля'],
      b: [
        'The diving bell goes down beside the spire off {isle}, and the divers swim in through a window into the drowned belfry. Galt holds the line himself and will not hand it to anyone.',
        'Водолазный колокол опускают рядом со шпилем у острова {isle}, и ныряльщики вплывают через окно в затопленную звонницу. Галт сам держит канат и никому его не отдаёт.',
      ],
      d: ['The divers come back up with shaking hands: the bell is there, and it is already swinging.', 'Ныряльщики поднимаются с дрожащими руками: колокол там, и он уже раскачивается.'],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Third Bell', 'Третий колокол'],
      b: [
        'The bell named Mercy is swinging, and the Cantor’s flagship is coming down on the spire with every ghost ship he has. Break them on the surface while the divers close the three collars below.',
        'Колокол по имени Милосердие раскачивается, а флагман Кантора идёт на шпиль со всеми кораблями-призраками, какие у него есть. Разбейте их наверху, пока внизу ныряльщики замыкают три ошейника.',
      ],
      d: [
        'The bell strikes once into silk and ore, and the whole forest of spires falls silent. In the silence Galt lifts his head: far to the north, in the Choir’s city, another bell answers. The Widow has heard.',
        'Колокол бьёт один раз в шёлк и руду, и весь лес шпилей замолкает. В тишине Галт поднимает голову: далеко на севере, в городе Хора, отвечает другой колокол. Вдова услышала.',
      ],
      s: ['sink:5:ghost', 'board:1', 'dive', 'hub'],
    },
  ],
};
