// Chapter 31 — Beyond the Wall (Act VI, the Abyss). The Islands of Light, the depth's pressure, the echoes of the ships
// the Abyss has taken; at the end the light below opens like an eye (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 31,
  region: 'the_abyss',
  more: ['drowned_crown'],
  hub: 'last_light',
  title: ['Beyond the Wall', 'За Стеной'],
  blurb: [
    'Beyond the Maelstrom Wall the wind is dead, the stars lie, and lighthouses stand on lonely islands with their lenses turned down into the sea. Somewhere ahead is the Widow, and far below, a light.',
    'За Стеной Мальстрима ветер мёртв, звёзды лгут, а на одиноких островах стоят маяки, чьи линзы повёрнуты вниз, в море. Где-то впереди Вдова, а глубоко внизу — свет.',
  ],
  giver: ['Aurora Sayle, Master of the Order of the Last Light', 'Аврора Сейл, магистр Ордена Последнего света'],
  portrait: 'giver_lighthouse_keeper_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['The First Watch Beyond', 'Первая вахта за Стеной'],
      b: [
        'Aurora Sayle has kept the lamp of Last Light for thirty years and never once sailed past the Wall. “Go in, come back, and tell me what you saw,” she says. “Leave nothing out, even what you think is madness.”',
        'Аврора Сейл тридцать лет хранит огонь Последнего света и ни разу не ходила за Стену. «Войдите, вернитесь и расскажите, что видели, — говорит она. — Ничего не упускайте, даже то, что покажется безумием».',
      ],
      d: [
        'The compass needles turn slowly round and round. The stars mirrored in the water are not the stars overhead.',
        'Стрелки компасов медленно ходят по кругу. Звёзды, отражённые в воде, — не те, что над головой.',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['Stars That Lie', 'Звёзды, которые лгут'],
      b: [
        'Your navigator has thrown his sextant overboard in a rage: by the stars, you have been sailing north all week and are now somewhere in the sky. Aurora says to forget the stars and sound the bottom instead, island by island.',
        'Ваш штурман в сердцах выбросил секстант за борт: по звёздам вы всю неделю шли на север и теперь находитесь где-то на небе. Аврора велит забыть о звёздах и промерять дно, от острова к острову.',
      ],
      d: [
        'The new chart is made of soundings alone, without a single star on it. It is the first honest map of the Abyss.',
        'Новая карта составлена из одних промеров, на ней нет ни одной звезды. Это первая честная карта Бездны.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['An Island of Light', 'Остров Света'],
      b: [
        'A light is burning on {isle}, where no keeper has lived for three hundred years. Aurora’s order has a word for such places in its oldest books, and she will not say it until you have seen one.',
        'На острове {isle} горит огонь, хотя смотрителя там нет уже триста лет. В старейших книгах Ордена у таких мест есть особое имя, и Аврора не назовёт его, пока вы сами не увидите.',
      ],
      d: [
        'The lens is turned downward. Its beam goes straight into the sea, and from far below, something answers with a slow pulse.',
        'Линза повёрнута вниз. Её луч уходит прямо в море, и откуда-то из глубины ему отвечает медленная вспышка.',
      ],
      s: ['isle', 'land:ruins'],
    },
    {
      t: ['The Weight of the Deep', 'Тяжесть глубины'],
      b: [
        'Beyond the Wall the sea presses up from below. Planks groan at anchor, ears ring, and the cook swears the water in the casks is heavier. Aurora wants to know how long a hull can bear it before it learns to give way.',
        'За Стеной море давит снизу. Доски стонут даже на якоре, в ушах звенит, а кок клянётся, что вода в бочках стала тяжелее. Аврора хочет знать, сколько корпус выдержит, прежде чем научится поддаваться.',
      ],
      d: [
        'The hull creaks like a cellar door the whole watch. A sailor says he can hear the sea breathing under the keel. No one laughs.',
        'Всю вахту корпус скрипит, как дверь погреба. Матрос говорит, что слышит, как под килем дышит море. Никто не смеётся.',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['A Keel Against the Deep', 'Киль против глубины'],
      b: [
        'Aurora’s shipwrights have drawn a doubled keel that will let a ship bend with the deep instead of breaking. They need planks by the hundred and a slip on your island where the work can be done in secret.',
        'Корабелы Авроры начертили двойной киль, с которым корабль будет гнуться вместе с глубиной, а не ломаться. Им нужны доски сотнями и стапель на вашем острове, где работу можно вести втайне.',
      ],
      d: [
        'On your island the first doubled keel is laid. The old shipwright pats it like a horse: “Now let the deep push.”',
        'На вашем острове заложен первый двойной киль. Старый корабел хлопает его, как коня: «Теперь пусть глубина давит».',
      ],
      s: ['bring:planks', 'build'],
    },
    {
      t: ['A Ship Out of Time', 'Корабль вне времени'],
      b: [
        'A brig crosses your bows under full sail in a dead calm, her crew trimming yards that no wind is filling. Aurora’s books call these echoes: ships the Abyss has taken and still remembers. Board her before she fades.',
        'В мёртвый штиль у вас под носом проходит бриг под всеми парусами, и команда брасопит реи, которые не наполняет никакой ветер. В книгах Авроры такие корабли зовут эхом: их забрала Бездна и до сих пор помнит. Возьмите его на абордаж, пока он не растаял.',
      ],
      d: [
        'Her crew walks through your boarders like fog. The log on her chart table is dated a hundred and nine years ago.',
        'Её команда проходит сквозь ваших абордажников, как туман. Журналу на её штурманском столе сто девять лет.',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['A Log a Century Old', 'Журнал столетней давности'],
      b: [
        'The echo’s log speaks of two more lights, at {isle} and at {isle2}, and of a keeper who came out in a boat to warn them off. Aurora wants to know whether those lights still burn.',
        'Журнал эха говорит ещё о двух огнях, у острова {isle} и у острова {isle2}, и о смотрителе, который вышел к ним на лодке, чтобы предостеречь. Аврора хочет знать, горят ли эти огни до сих пор.',
      ],
      d: [
        'Both burn, both point down. At the second, an empty boat is drawn up on the shingle, its oars still shipped.',
        'Оба горят, оба смотрят вниз. У второго на гальке вытащена пустая лодка, вёсла всё ещё уложены.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['The Lost Lamplighters', 'Пропавшие фонарщики'],
      b: [
        'Twenty years ago the Order sent four brothers through the Wall to tend the far lights. None came back. Aurora has kept their names on a slate by her door. A fire has been seen on {isle}.',
        'Двадцать лет назад Орден отправил за Стену четверых братьев следить за дальними огнями. Ни один не вернулся. Аврора хранит их имена на грифельной доске у двери. На острове {isle} видели костёр.',
      ],
      d: [
        'Two of the four are alive, grey and gentle, and they ask what year it is. Aurora wipes two names off the slate herself.',
        'Двое из четверых живы, седые и тихие, и спрашивают, какой нынче год. Аврора сама стирает два имени с доски.',
      ],
      s: ['land', 'rescue'],
    },
    {
      t: ['Sweet Water, Short Rations', 'Пресная вода, скудный паёк'],
      b: [
        'Beyond the Wall the sea is sweet, and the crews drink it gladly; but the salt meat spoils within a day and the hardtack grows soft. Bring provisions enough to hold the Order’s outposts through the dark.',
        'За Стеной море пресное, и команды пьют его охотно; зато солонина портится за день, а сухари размокают. Привезите провизии столько, чтобы аванпосты Ордена продержались всю тьму.',
      ],
      d: [
        'The stores are stacked in the lighthouse cellars, and the brothers count them twice, as misers count gold.',
        'Припасы сложены в подвалах маяка, и братья пересчитывают их дважды, как скупцы золото.',
      ],
      s: ['bring:provisions'],
    },
    {
      t: ['A Voice Under the Keel', 'Голос под килем'],
      b: [
        'Jory Penn has been hearing his name called from under the hull. He is not frightened; he is curious, and he asks to go down with the divers himself. You have known him since he signed on with a cross.',
        'Джори Пенн слышит, как его зовут из-под днища. Он не боится, ему любопытно, и он просит отпустить его вниз вместе с водолазами. Вы знаете его с тех пор, как он поставил крестик в судовых бумагах.',
      ],
      d: [
        'Jory comes up calm and thoughtful. “It isn’t calling me,” he says. “It’s counting us.”',
        'Джори поднимается спокойным и задумчивым. «Оно не меня зовёт, — говорит он. — Оно нас считает».',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['Eaters of Light', 'Пожиратели света'],
      b: [
        'Something comes up from the deep at night to lie in the beams of the lights, and when it goes down again, the lamp is weaker. The keepers of {isle} have seen it twice. Drive it off, whatever it is.',
        'Ночью из глубины что-то поднимается полежать в лучах маяков, а когда уходит обратно, огонь становится слабее. Смотрители острова {isle} видели это дважды. Отгоните его, что бы это ни было.',
      ],
      d: [
        'They were beasts after all, pale and blind, with lamps of their own along their flanks. The light of {isle} burns steady again.',
        'Это всё-таки звери, бледные и слепые, со своими фонарями вдоль боков. Огонь острова {isle} снова горит ровно.',
      ],
      s: ['isle', 'beast:any'],
    },
    {
      t: ['The Choir Beyond the Wall', 'Хор за Стеной'],
      b: [
        'The Widow’s boats have been landing small bells on the Islands of Light and leaving them to toll in the dark, hung from the lantern galleries. Aurora calls it defiling a church. Stop the boats and the ships that carry them.',
        'Лодки Вдовы высаживаются на Острова Света и оставляют на галереях маяков маленькие колокола звенеть в темноте. Аврора называет это осквернением храма. Остановите лодки и корабли, что их возят.',
      ],
      d: [
        'Every captured boat has a small bell aboard, wrapped in grey wool, and a list of islands. Yours are crossed off it now.',
        'В каждой захваченной лодке — колокольчик, завёрнутый в серую шерсть, и список островов. Ваши теперь из него вычеркнуты.',
      ],
      s: ['board:2', 'sink:3'],
    },
    {
      t: ['Why the Lenses Look Down', 'Почему линзы смотрят вниз'],
      b: [
        'On {isle} stands a shrine older than the lighthouse beside it. Aurora believes the first keepers wrote there what their lights were for. She asks you to land and copy every line, however strange.',
        'На острове {isle} стоит святилище старше маяка, что рядом с ним. Аврора верит, что первые смотрители записали там, для чего горят их огни. Она просит высадиться и переписать каждую строку, какой бы странной та ни была.',
      ],
      d: [
        'Aurora reads your copy by her lamp and puts it down slowly: “They were not guiding ships. They were keeping watch.”',
        'Аврора читает вашу копию у своей лампы и медленно откладывает: «Они не вели корабли. Они несли дозор».',
      ],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['Oil for the Far Lights', 'Масло для дальних огней'],
      b: [
        'The Order’s depot at {port2} is nearly dry, and the far lights must not go out, not now. Take on whale oil at {port} and see it there before the next dark watch begins.',
        'Склад Ордена в порту {port2} почти пуст, а дальние огни гаснуть не должны, тем более сейчас. Примите китовый жир в порту {port} и доставьте его туда до начала следующей тёмной вахты.',
      ],
      d: [
        'The brothers roll the casks up the hill in a long line, singing a lamplighters’ song you have never heard.',
        'Братья длинной цепочкой катят бочки на холм и поют песню фонарщиков, которой вы ещё не слышали.',
      ],
      s: ['carry:whale_oil'],
    },
    {
      t: ['Oars in a Dead Calm', 'Вёсла в мёртвый штиль'],
      b: [
        'The wind has been dead for three days, and the Widow’s galleys come out of the dark on oars while your sails hang slack. Keep your guns warm and your boarders ready: they mean to take you where you lie.',
        'Ветра нет уже три дня, и галеры Вдовы выходят из темноты на вёслах, пока ваши паруса висят тряпками. Держите пушки наготове, а абордажников при оружии: они хотят взять вас прямо на якоре.',
      ],
      d: [
        'Their oarsmen were free men, not slaves. They row back with you now, and sing as they pull.',
        'Их гребцы были вольными людьми, а не рабами. Теперь они гребут на вашей стороне и поют на каждом гребке.',
      ],
      s: ['escort', 'board:2'],
    },
    {
      t: ['The Lost Fleet Passes', 'Мимо проходит пропавший флот'],
      b: [
        'At the turn of the night a whole fleet comes up out of the water: the Crown squadron that sailed for the Wall a hundred years ago and vanished. Their guns are run out, and they are steering for Last Light.',
        'На повороте ночи из воды поднимается целый флот: эскадра Короны, что сто лет назад ушла к Стене и пропала. Пушки выкачены, и курс у них на Последний свет.',
      ],
      d: [
        'The echoes sink back one by one. The last of them dips its colours to you before it goes.',
        'Эхо уходит под воду корабль за кораблём. Последний, прежде чем исчезнуть, приспускает перед вами флаг.',
      ],
      s: ['sink:5:ghost', 'hub'],
    },
    {
      t: ['People of the Low Shore', 'Люди низкого берега'],
      b: [
        'There are fishers on {isle}, beyond the Wall, where no one should live: grandchildren of castaways who never found the way home. They know where the Widow’s ships went, and some of them want to leave.',
        'На острове {isle}, за Стеной, где жить не должен никто, живут рыбаки — внуки потерпевших крушение, так и не нашедших дорогу домой. Они знают, куда ушли корабли Вдовы, и кое-кто из них хочет уехать.',
      ],
      d: [
        'The young ones sign on. The old ones point south, toward a light in the water, and turn back to their nets.',
        'Молодые записываются в команду. Старики показывают на юг, туда, где в воде светится огонь, и возвращаются к сетям.',
      ],
      s: ['land:fishers', 'recruit'],
    },
    {
      t: ['Grey Ash on the Water', 'Серый пепел на воде'],
      b: [
        'Wherever the Widow’s flagship passes, she burns something, and grey ash floats for a day after. A trail of it runs past {isle}. Follow it and put down every island along it that is not yet on your chart.',
        'Где бы ни прошёл флагман Вдовы, она что-то жжёт, и серый пепел держится на воде ещё сутки. След из пепла тянется мимо острова {isle}. Идите по нему и нанесите на карту каждый остров, которого на ней ещё нет.',
      ],
      d: [
        'The ash is burnt letters, the Widow’s own. One scrap still reads: “…forgive me, but I will bring you home.”',
        'Пепел — это сожжённые письма, её собственные. На одном клочке ещё можно прочесть: «…прости меня, но я верну тебя домой».',
      ],
      s: ['isle', 'chart'],
    },
    {
      t: ['A Light Put Out', 'Погашенный огонь'],
      b: [
        'For the first time in three hundred years, a light beyond the Wall has gone out, on {isle}. The Widow’s men are still there with their bell. Land, drive them off, and take the ship they came in.',
        'Впервые за триста лет за Стеной погас огонь — на острове {isle}. Люди Вдовы всё ещё там, со своим колоколом. Высадитесь, прогоните их и захватите корабль, на котором они пришли.',
      ],
      d: [
        'Aurora’s brothers relight the lamp with your galley fire. As the lens warms, the sea below it seems to sigh.',
        'Братья Авроры зажигают лампу заново от огня с вашего камбуза. Когда линза нагревается, море под ней будто вздыхает.',
      ],
      s: ['land', 'board'],
    },
    {
      t: ['The Light Below', 'Свет внизу'],
      b: [
        'All the lenses of the Abyss point at one place in the deep, south of {isle}. Aurora sails with you this time. Send your divers down as far as the line will go, and hold the waters above them against whatever comes.',
        'Все линзы Бездны направлены в одну точку глубины, к югу от острова {isle}. На этот раз Аврора идёт с вами. Спустите водолазов так глубоко, как позволит линь, и удерживайте воды над ними, что бы ни пришло.',
      ],
      d: [
        'Far under the keel a light as wide as a city opens slowly, like an eye. Aurora grips the rail: “The Eye. They watched it for three hundred years.”',
        'Глубоко под килем медленно раскрывается свет шириной с целый город — как глаз. Аврора стискивает поручень: «Око. Триста лет они стерегли его».',
      ],
      s: ['isle', 'dive', 'sink:4', 'hub'],
    },
  ],
};
