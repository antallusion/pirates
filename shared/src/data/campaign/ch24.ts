// Chapter 24 — Saint Maw (Act V, the Drowned Crown). In the Choir's own city Brother Ansel betrays the Widow and teaches
// the captain to silence a bell; Oren Galt is found alive on the Choir's prison rock and freed (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 24,
  region: 'drowned_crown',
  hub: 'saint_maw',
  title: ['Saint Maw', 'Святая Пасть'],
  blurb: [
    'The Choir’s own city, where green lanterns burn on every tower and no warship is let in. A disgraced bell-ringer has sent for you — and somewhere on a rock out at sea an old pilot is still alive.',
    'Город самого Хора: на каждой башне горят зелёные фонари, и ни один военный корабль сюда не пускают. Вас позвал опальный звонарь, а где-то в море, на голой скале, всё ещё жив старый лоцман.',
  ],
  giver: ['Brother Ansel, disgraced ringer of the Choir', 'Брат Ансельм, опальный звонарь Хора'],
  portrait: 'giver_cultist_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Oil for the Lanterns', 'Масло для фонарей'],
      b: [
        'The letter sealed with a cracked bell says: come as pilgrims, with oil for the lanterns. The Choir lets no warship into {hub}, but it never turns away oil for its green lights.',
        'Письмо с печатью треснувшего колокола гласит: приходите паломниками, с маслом для фонарей. Хор не пускает в порт {hub} ни одного военного корабля, но масла для своих зелёных огней не отвергает никогда.',
      ],
      d: [
        'The harbour monks take the oil and wave you in. A beggar presses a note into your hand: “Tonight, at the cracked bell.”',
        'Портовые монахи принимают масло и пропускают вас. Нищий суёт вам в руку записку: «Ночью, у треснувшего колокола».',
      ],
      s: ['bring:whale_oil'],
    },
    {
      t: ['The Cracked Bell', 'Треснувший колокол'],
      b: [
        'The note names an old cracked bell on {isle}, abandoned by the Choir when it would not sing true. Go ashore after dark, quietly, with no more men than one boat holds.',
        'Записка указывает на старый треснувший колокол на острове {isle}: Хор бросил его, когда тот перестал петь чисто. Сойдите на берег после заката, тихо, не больше одной шлюпки людей.',
      ],
      d: [
        'Brother Ansel is thin and grey, with a ringer’s hard palms. “She would drown the whole world to bring back one man,” he says. “I mean to stop her.”',
        'Брат Ансельм худ и сед, у него жёсткие ладони звонаря. «Она утопит весь мир, чтобы вернуть одного человека, — говорит он. — Я хочу её остановить».',
      ],
      s: ['land:bell', 'hub'],
    },
    {
      t: ['Novices in Chains', 'Послушники в цепях'],
      b: [
        'The Choir takes boys from the fishing villages to make ringers of them, and their training ship lies off {isle}. Ansel was one of those boys once. He asks you to bring the next ones home.',
        'Хор забирает мальчишек из рыбацких деревень, чтобы сделать из них звонарей, и их учебный корабль стоит у острова {isle}. Когда-то Ансельм был одним из этих мальчишек. Он просит вернуть следующих домой.',
      ],
      d: ['The boys were taught one thing only: to ring, and never to listen.', 'Мальчишек учили одному: звонить и никогда не слушать.'],
      s: ['isle', 'board'],
    },
    {
      t: ['Silk for the Tongue', 'Шёлк для языка'],
      b: [
        'To silence a bell, Ansel says, you must first bind its tongue in something the sea itself has woven. Bring drowned silk to {hub}, and he will show you on a ship’s bell.',
        'Чтобы заглушить колокол, говорит Ансельм, сперва надо обмотать его язык тем, что соткало само море. Привезите в порт {hub} утопленный шёлк, и он покажет всё на судовом колоколе.',
      ],
      d: ['Ansel winds the silk round the tongue and strikes. The bell swings, and no sound comes.', 'Ансельм обматывает язык шёлком и бьёт. Колокол качается, но звука нет.'],
      s: ['bring:drowned_silk'],
    },
    {
      t: ['The Iron Collar', 'Железный ошейник'],
      b: [
        'Silk will hold a ship’s bell. A drowned bell needs its bound tongue locked in iron. Iron waits at {port}, and a smith at {port2} will forge collars without asking what they are for.',
        'Шёлк удержит судовой колокол. Утонувшему нужен ещё и железный замок поверх обмотки. Железо ждёт в порту {port}, а кузнец в порту {port2} скуёт ошейники и не спросит, зачем они.',
      ],
      d: ['The smith hands over iron collars that close round a bell’s tongue like a fist.', 'Кузнец отдаёт железные ошейники: они смыкаются на языке колокола, как кулак.'],
      s: ['carry:iron'],
    },
    {
      t: ['A Bell in the Shallows', 'Колокол на мелководье'],
      b: [
        'A small drowned bell rings in the shallows off {isle} at every tide, and the fishers there have not slept a whole night in years. Ansel says it is the right bell to learn on.',
        'У острова {isle} на мелководье лежит небольшой утонувший колокол и звонит в каждый прилив, и рыбаки там уже много лет не спят ночами. Ансельм говорит, что учиться лучше всего на нём.',
      ],
      d: ['The divers clamp the collar shut. The shallows go quiet, and the fishers come down to the water to stare.', 'Водолазы защёлкивают ошейник. На мелководье наступает тишина, и рыбаки выходят к воде посмотреть.'],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['Hounds of the Choir', 'Ищейки Хора'],
      b: [
        'The Choir has counted its ringers and found one missing. Its hunting ships have put out to search every cove, and sooner or later they will search yours.',
        'Хор пересчитал своих звонарей и одного недосчитался. Его охотничьи корабли вышли обыскивать каждую бухту и рано или поздно доберутся до вашей.',
      ],
      d: ['The hunters are gone. Ansel watches them sink and does not pray for them.', 'Охотников больше нет. Ансельм смотрит, как они тонут, и не молится за них.'],
      s: ['sink::hunter', 'hub'],
    },
    {
      t: ['The Old Pilot', 'Старый лоцман'],
      b: [
        'Ansel has heard the novices speak of a prisoner the Choir calls the Old Pilot, kept alive to read the Black Chart for them. A Choir quartermaster at {port} drinks too much. Find out where the prisoner’s bread is shipped.',
        'Ансельм слышал, как послушники говорили об узнике, которого Хор зовёт Старым лоцманом: его держат живым, чтобы он читал им Чёрную карту. Интендант Хора в порту {port} много пьёт. Узнайте, куда отправляют хлеб для узника.',
      ],
      d: [
        'Bread and pipe tobacco for one man, shipped weekly to a rock without a name. Jory knows the blend: it is Galt’s.',
        'Хлеб и трубочный табак на одного человека, каждую неделю, на скалу без имени. Джори узнаёт сорт табака: это табак Галта.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['A Rock Without a Name', 'Скала без имени'],
      b: [
        'The bread boat follows no chart. Jory will not sleep until the rock is found: chart every islet on the boat’s way, and the last of them should be {isle}.',
        'Хлебная лодка ходит не по картам. Джори не уснёт, пока скалу не найдут: нанесите на карту каждый островок на её пути — последним должен оказаться {isle}.',
      ],
      d: [
        'A rock with a tower on it, green lanterns on every wall — and at the top, one yellow candle.',
        'Скала, на ней башня, на каждой стене зелёные фонари — а на самом верху горит одна жёлтая свеча.',
      ],
      s: ['chart', 'isle'],
    },
    {
      t: ['The Bread Boat', 'Хлебная лодка'],
      b: [
        'The boat that carries Galt’s bread also carries the guards’ orders. Take it at sea before it reaches the rock, and do not let it burn.',
        'Лодка, что возит Галту хлеб, возит и приказы страже. Возьмите её в море, пока она не дошла до скалы, и не дайте ей сгореть.',
      ],
      d: [
        'The orders are plain: the guard changes at the third bell of night, and the tower’s only door is under the sea.',
        'Приказы просты: стража меняется на третьем ударе ночи, а единственная дверь башни — под водой.',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['A Quiet House', 'Тихий дом'],
      b: [
        'Ansel warns that the Choir’s prisoners hear bells for months after they are freed. Build a quiet house on your own island, its walls thick enough to keep the sound of the sea out.',
        'Ансельм предупреждает: узники Хора ещё много месяцев после освобождения слышат колокола. Постройте на своём острове тихий дом со стенами такой толщины, чтобы шум моря не проходил внутрь.',
      ],
      d: ['The masons stop their own ears to test it. Inside, for the first time in weeks, there is silence.', 'Каменщики затыкают уши, чтобы проверить. Внутри впервые за много недель стоит тишина.'],
      s: ['build', 'hub'],
    },
    {
      t: ['The Choir’s Foundry', 'Литейня Хора'],
      b: [
        'On {isle} the Choir casts new bells from tithe bronze, in a shrine whose fires never go out. Creatures drawn by the ringing nest round its walls. Land and break the moulds.',
        'На острове {isle} Хор отливает новые колокола из десятинной бронзы — в святилище, где печи не гаснут никогда. Вокруг стен гнездятся твари, которых приманил звон. Высадитесь и разбейте формы.',
      ],
      d: ['Molten bronze runs hissing into the sea. The bell it was meant for will never ring.', 'Расплавленная бронза с шипением стекает в море. Колокол, для которого она предназначалась, не зазвонит никогда.'],
      s: ['land:shrine', 'lair'],
    },
    {
      t: ['The Pilgrims’ Road', 'Дорога паломников'],
      b: [
        'Real pilgrims still sail to {hub}, and pirates in the Choir’s pay strip them on the way. Ansel says the city will remember who kept its pilgrims safe.',
        'В порт {hub} до сих пор плывут настоящие паломники, а пираты на жалованье у Хора обирают их по дороге. Ансельм говорит, что город запомнит, кто сберёг его паломников.',
      ],
      d: ['In the market a woman in a pilgrim’s hood whispers your name and a blessing, not the Choir’s.', 'На рынке женщина в капюшоне паломницы шепчет ваше имя и благословение — не то, что поёт Хор.'],
      s: ['escort', 'sink::pirate'],
    },
    {
      t: ['Men Who Can Climb', 'Верхолазы'],
      b: [
        'The prison tower must be climbed from the sea. The fishers of {isle} gather gulls’ eggs on cliffs no sailor would try. Go ashore and sign on the best of them.',
        'На тюремную башню придётся лезть с моря. Рыбаки острова {isle} собирают чаячьи яйца на таких обрывах, куда не сунется ни один матрос. Сойдите на берег и наймите лучших.',
      ],
      d: ['They climb your mainmast barefoot in a breath and ask only to be paid in rum.', 'Они взлетают босиком на грот-мачту за один вдох и просят платить им только ромом.'],
      s: ['land:fishers', 'recruit'],
    },
    {
      t: ['The Reversed Peal', 'Звон наоборот'],
      b: [
        'At the evening vigil Ansel will ring the city’s bells in reverse. The Choir’s ships at sea steer by that peal, and tonight they will steer wrong. Be waiting where they come out.',
        'На вечернем бдении Ансельм прозвонит городские колокола в обратном порядке. Корабли Хора в море держат курс по этому звону, и сегодня они пойдут не туда. Ждите их там, где они выйдут.',
      ],
      d: [
        'The ghost ships run into one another in the dark. From every tower of the city Ansel’s name is cursed: he can never go back.',
        'Корабли-призраки сталкиваются в темноте. С каждой башни города проклинают имя Ансельма: дороги назад у него больше нет.',
      ],
      s: ['sink::ghost', 'hub'],
    },
    {
      t: ['The Widow’s Letter', 'Письмо Вдовы'],
      b: [
        'The Widow has sent a warship of her own to bring Ansel back, under a black pennant with a silver bell. Meet it before it finds your anchorage.',
        'Вдова прислала за Ансельмом собственный корабль — под чёрным вымпелом с серебряным колоколом. Встретьте его раньше, чем он найдёт вашу стоянку.',
      ],
      d: ['In the captain’s desk lies a letter in the Widow’s hand: “Come home. You were my finest voice.”', 'В капитанском столе — письмо, написанное рукой Вдовы: «Вернись домой. Ты был моим лучшим голосом».'],
      s: ['sink:2:ghost', 'board:1'],
    },
    {
      t: ['The Crown’s Engraver', 'Гравёр Короны'],
      b: [
        'The tower door opens only to the Choir’s seal. Admiral Dray keeps an engraver at {at} who forged a governor’s seal once and was pardoned for his skill. Fetch him.',
        'Дверь башни открывается только перед печатью Хора. У адмирала Дрея в порту {at} есть гравёр, который однажды подделал печать губернатора и был помилован за мастерство. Привезите его.',
      ],
      d: ['By candlelight the engraver cuts a bell beneath a wave into brass, and Ansel cannot tell it from the true seal.', 'При свече гравёр вырезает на латуни колокол под волной, и Ансельм не может отличить его от настоящей печати.'],
      s: ['at:tidehallow', 'hub'],
    },
    {
      t: ['Sharks at the Door', 'Акулы у двери'],
      b: [
        'The guards on the rock feed the sharks every day, so that nobody swims to the door beneath the tower. Sail into the waters of {isle} and thin them out.',
        'Стража на скале каждый день кормит акул, чтобы никто не доплыл до двери под башней. Подойдите к острову {isle} и проредите стаю.',
      ],
      d: ['The water by the rock is empty. The guards on the wall shout for more meat, and nothing comes.', 'Вода у скалы пуста. Стражники на стене кричат, швыряя мясо, но никто не приплывает.'],
      s: ['isle', 'beast:shark'],
    },
    {
      t: ['Lights Turned Round', 'Перевёрнутые огни'],
      b: [
        'The Choir has hung false lights on the reefs of {isle} to wreck anyone who comes for the rock. Land and turn the lanterns round, as Galt himself taught you on your very first voyage.',
        'Хор развесил ложные огни на рифах острова {isle}, чтобы разбить любого, кто придёт к скале. Высадитесь и разверните фонари — так, как учил вас сам Галт в самом первом плавании.',
      ],
      d: ['Now the false lights point the safe way in. Jory laughs: the old man will like that.', 'Теперь ложные огни указывают безопасный проход. Джори смеётся: старику это понравится.'],
      s: ['land', 'hub'],
    },
    {
      t: ['The Feint', 'Ложный удар'],
      b: [
        'Meg Caldwell’s Code ships will make a show against the harbour of {hub} to draw the Choir’s fleet away from the rock. Hold the sea with them, and make the feint look real.',
        'Корабли Кодекса под началом Мэг Колдуэлл сделают вид, что идут на гавань порта {hub}, и оттянут флот Хора от скалы. Держите море вместе с ними и сделайте так, чтобы удар выглядел настоящим.',
      ],
      d: ['The Choir’s fleet turns for the city. Behind it, the rock stands alone.', 'Флот Хора разворачивается к городу. За его кормой скала остаётся одна.'],
      s: ['escort', 'sink::ghost'],
    },
    {
      t: ['The Third Bell of Night', 'Третий удар ночи'],
      b: [
        'At the third bell of night the guard boat rows out to change the watch. Take it quietly, and send divers to find the door under the tower before the new watch is missed.',
        'На третьем ударе ночи сторожевая лодка идёт менять караул. Возьмите её без шума и пошлите водолазов искать дверь под башней, пока новую смену не хватились.',
      ],
      d: ['The forged seal fits the lock under the water. The door swings inward on green-lit stairs.', 'Поддельная печать подходит к замку под водой. Дверь открывается внутрь, на лестницу в зелёном свете.'],
      s: ['board:1', 'dive'],
    },
    {
      t: ['The Prison Rock', 'Тюремная скала'],
      b: [
        'Tonight or never. Ansel rings a false alarm in the city, the climbers go up the wall, the divers up the stairs, and you must hold the sea round {isle} while Galt is brought down.',
        'Сегодня или никогда. Ансельм поднимает в городе ложную тревогу, верхолазы идут по стене, водолазы — по лестнице, а вам держать море вокруг острова {isle}, пока Галта спускают вниз.',
      ],
      d: [
        'Galt comes down thin, white-bearded, and asks first for his pipe. “I lied to them about one mark,” he says. “The third bell is in the sunken spires, and they are looking in the wrong place.”',
        'Галт спускается исхудавший, с белой бородой и первым делом просит трубку. «Про одну отметку я им соврал, — говорит он. — Третий колокол среди затонувших шпилей, а ищут они не там».',
      ],
      s: ['isle', 'board:2', 'land', 'hub'],
    },
  ],
};
