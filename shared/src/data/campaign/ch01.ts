// Chapter 1 — Saltmarrow (Act I, Fog over Saltmarrow). The written model of a chapter (docs/36). Its first five quests
// are the campaign's opening (owner, 2026-10-19): the shops, a ship sunk, a ship boarded, a neutral stack, a town founded.

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 1,
  region: 'black_coast',
  hub: 'saltmarrow',
  title: ['Saltmarrow', 'Солтмарроу'],
  blurb: [
    'A fishing town at the end of the world, an old pilot who trusts no one, and false lights on the rocks. Somewhere under the water a bell is ringing.',
    'Рыбацкий городок на краю света, старый лоцман, который никому не верит, и ложные огни на скалах. Где-то под водой звонит колокол.',
  ],
  giver: ['Oren Galt, pilot of Saltmarrow', 'Орен Галт, лоцман Солтмарроу'],
  portrait: 'giver_old_salt_m',
  reward: { ammo: true },
  quests: [
    // The opening (owner, 2026-10-19: «Кампания должна начинаться так — обучение по покупкам разным в магазинам, дальше
    // атака корабля, дальше абордаж, дальше нападение на нейтралов, и дальше к ближайшему острову основать свой город.
    // Все это должно быть сделано в первые условно там минут 5-10 с учетом плаваний»): the shops of the start's quay,
    // a ship sunk and one boarded and a stack of the sea's creatures beaten on the lane out to the nearest island, and the
    // town founded there. Then the story begins («Соль и туман»).
    {
      t: ['The Harbour’s Shops', 'Портовые лавки'],
      b: [
        'Oren Galt meets you on the quay of {hub} with a list in his hand. “A ship sails on her stores, not on her flag. Provisions, canvas, guns or hands, and a cargo to sell: the shops of the quay will teach you more than I can.”',
        'Орен Галт встречает вас на причале порта {hub} со списком в руке. «Корабль ходит на припасах, а не на флаге. Провизия, парусина, пушки или люди и товар на продажу — лавки на набережной научат вас большему, чем я».',
      ],
      d: ['Galt ticks off the last line. “Now you are a ship, not a boat with a name.”', 'Галт вычёркивает последнюю строку. «Теперь вы корабль, а не лодка с именем»'],
      s: ['buy:provisions', 'buy:sailcloth', 'buy:arms', 'buy:trade'],
    },
    {
      t: ['The First Broadside', 'Первый залп'],
      lane: { at: 0.35, r: 700 },
      b: [
        'A wreckers’ tender under grey sails prowls outside the harbour, waiting for a fishing boat to stray. Galt points out to sea: “There. Show her your guns.”',
        'За гаванью рыщет тендер мародёров под серыми парусами — ждёт, когда рыбачья лодка отобьётся от своих. Галт указывает в море: «Вон там. Покажите ей свои пушки».',
      ],
      d: ['The tender goes down with her grey sails still set. The fishermen on the quay cheer.', 'Тендер уходит на дно, так и не спустив серых парусов. Рыбаки на причале кричат «ура».'],
      s: [['sink:1', 'Attack the wreckers’ tender and sink her.', 'Атакуйте тендер мародёров и потопите его.']],
    },
    {
      t: ['Over the Rail', 'Борт о борт'],
      lane: { at: 0.35, r: 700 },
      b: [
        'A second tender comes on to avenge the first. Galt wants her whole: “Grapples, not guns. A ship on the bottom tells no tales.”',
        'Второй тендер идёт мстить за первый. Галт хочет взять его целым: «Крючья, а не пушки. Корабль на дне ничего не расскажет».',
      ],
      d: ['In her hold: a lantern with a small brass bell on its handle, and a chart with three islands ringed in grey.', 'В её трюме — фонарь с медным колокольчиком на ручке и карта, где серым обведены три острова.'],
      s: [['board:1', 'Close with the second tender and take her by boarding.', 'Сблизьтесь со вторым тендером и возьмите его на абордаж.']],
    },
    {
      t: ['Creatures of the Shoals', 'Твари на отмели'],
      lane: { at: 0.6, r: 1500 },
      b: [
        'The way to the islands is held by the sea’s creatures: they rise at every boat that passes. Galt says a captain clears her own road.',
        'Путь к островам держат морские твари: они бросаются на каждую проходящую лодку. Галт говорит, что капитан сам расчищает себе дорогу.',
      ],
      d: ['The creatures scatter into the deep. The road to the islands is open.', 'Твари уходят в глубину. Дорога к островам открыта.'],
      s: [['neutral:1', 'Attack a stack of the sea’s creatures on the way to the islands and beat it.', 'Атакуйте отряд морских тварей на пути к островам и разбейте его.']],
    },
    {
      t: ['A Shore of Your Own', 'Свой берег'],
      b: [
        '“Every captain of this coast needs a shore to come home to,” Galt says, and points at {isle}. “Nobody holds it. Raise your flag there, and a town will grow around it.”',
        '«Каждому капитану на этом берегу нужна своя земля, куда можно вернуться», — говорит Галт и указывает на остров {isle}. «Он ничей. Поднимите там флаг — и вокруг вырастет город».',
      ],
      d: ['A town hall of fresh timber stands on {isle}, and your flag snaps over it in the wind.', 'На острове {isle} стоит ратуша из свежего бруса, и над ней на ветру хлопает ваш флаг.'],
      s: ['found'],
    },
    {
      t: ['Salt and Fog', 'Соль и туман'],
      b: [
        'That night Galt sits with you on the quay of {hub} and tells you why the coast is afraid: once in a hundred years the drowned bells ring under the sea, and the Gravetide comes ashore. Before he says more, he wants to see you hold a course.',
        'Ночью Галт сидит с вами на причале порта {hub} и рассказывает, почему побережье живёт в страхе: раз в сто лет под водой звонят утонувшие колокола, и на берег выходит Гробовой прилив. Прежде чем сказать больше, он хочет посмотреть, как вы держите курс.',
      ],
      d: ['“You hold her steady,” Galt grumbles. “Then listen: the bells have started again.”', '«Держишь ровно, — ворчит Галт. — Тогда слушай: колокола снова зазвонили»'],
      s: ['isle', 'hub'],
    },
    {
      t: ['The Lost Net', 'Пропавшая сеть'],
      b: [
        'The fishermen of {hub} did not come home last night. Their net was found empty off {isle}, torn as if from below.',
        'Рыбаки из порта {hub} не вернулись прошлой ночью. Их сеть нашли пустой у острова {isle} — разорванной, будто снизу.',
      ],
      d: ['Boat tracks on the shingle and barrels of tallow. This was no storm.', 'На гальке следы лодок и бочки с салом. Это был не шторм.'],
      s: ['land', 'hub'],
    },
    {
      t: ['A Bell on the Handle', 'Колокольчик на ручке'],
      b: [
        'Galt turns the lantern over and goes quiet. Such bells were cast at {port}, he says, and asks you to find out who ordered them.',
        'Галт вертит фонарь в руках и мрачнеет. Такие колокольчики отливали в порту {port}, говорит он, и просит узнать, кто их заказывал.',
      ],
      d: ['The founder remembers the buyer: a woman in grey who paid in old Crown silver.', 'Литейщик помнит заказчицу: женщина в сером, платила старым серебром Короны.'],
      s: ['port', 'hub'],
    },
    {
      t: ['Three Grey Rings', 'Три серых круга'],
      b: [
        'The first island ringed on the wreckers’ chart is {isle}. Go and look — quietly, without landing.',
        'Первый остров, обведённый на карте мародёров, — {isle}. Сходите посмотреть, тихо, без высадки.',
      ],
      d: ['A fire on the hill and a ship’s lantern hung on a dead pine, swinging like a beacon.', 'На холме костровище, а на сухой сосне висит судовой фонарь и качается, как маяк.'],
      s: ['isle', 'isle2', 'hub'],
    },
    {
      t: ['The False Beacon', 'Ложный маяк'],
      b: [
        'A false beacon on {isle} has already drawn one ship onto the rocks. Galt asks you to land and put the light out for good.',
        'Ложный маяк на острове {isle} уже заманил на скалы один корабль. Галт просит высадиться и погасить этот огонь навсегда.',
      ],
      d: ['The lantern is smashed, the tallow thrown into the sea. The coast is darker and safer.', 'Фонарь разбит, сало выброшено в море. На берегу стало темнее — и безопаснее.'],
      s: ['land', 'hub'],
    },
    {
      t: ['Jory Penn', 'Джори Пенн'],
      b: [
        'A ship’s boy called Jory Penn was the only one to swim ashore from the wreck. He says he can show where the wreckers moor — if you take him aboard.',
        'Юнга Джори Пенн — единственный, кто доплыл до берега после крушения. Он говорит, что покажет, где швартуются мародёры, если вы возьмёте его на борт.',
      ],
      d: ['Jory signs the ship’s articles with a cross and a grin.', 'Джори ставит крестик в судовых бумагах и широко ухмыляется.'],
      s: ['recruit', 'isle'],
    },
    {
      t: ['The Wreckers’ Mooring', 'Стоянка мародёров'],
      b: [
        'Jory leads you to a cove on {isle}. Their boats are drawn up on the beach. Land, and take them by surprise.',
        'Джори приводит вас к бухте на острове {isle}. Лодки мародёров вытащены на песок. Высадитесь и застаньте их врасплох.',
      ],
      d: ['The mooring is empty now. In the ashes of their fire — a scrap of a black chart.', 'Стоянка пуста. В золе их костра — обрывок чёрной карты.'],
      s: ['land', 'board:1'],
    },
    {
      t: ['A Scrap of Black Chart', 'Обрывок чёрной карты'],
      b: [
        'The scrap shows the coast as no Crown chart shows it: every old wreck is marked, and beside each one a small bell is drawn. Galt wants to see it at once.',
        'На обрывке берег, каким его не рисует ни одна карта Короны: отмечено каждое старое крушение, и возле каждого нарисован маленький колокол. Галт хочет видеть его немедленно.',
      ],
      d: ['Galt lights his pipe with shaking hands. “The Gravetide,” he says, and nothing more.', 'Галт раскуривает трубку дрожащими руками. «Гробовой прилив», — говорит он, и больше ни слова.'],
      s: ['hub'],
    },
    {
      t: ['What the Old Men Say', 'Что говорят старики'],
      b: [
        'Galt will not speak of the Gravetide, but the old men of {port} will, for a cup of rum. Bring the rum and listen.',
        'Галт молчит о Гробовом приливе, но старики в порту {port} разговорятся за кружку рома. Привезите ром и послушайте.',
      ],
      d: ['The old men say: once in a hundred years the drowned bells ring, and the sea comes ashore to take back what it lost.', 'Старики говорят: раз в сто лет звонят утонувшие колокола, и море выходит на берег забрать то, что потеряло.'],
      s: ['carry:rum', 'hub'],
    },
    {
      t: ['The Patrol’s Doubt', 'Сомнения патруля'],
      b: [
        'The Crown patrol does not believe in wreckers. Their lieutenant will believe a captured boat. Bring him one.',
        'Королевский патруль не верит в мародёров. Их лейтенант поверит захваченной лодке. Доставьте ему одну.',
      ],
      d: ['The lieutenant reads the black scrap twice and sends a rider to {port}.', 'Лейтенант дважды перечитывает чёрный обрывок и отправляет гонца в порт {port}.'],
      s: ['board:1', 'port'],
    },
    {
      t: ['Creatures of the Dunes', 'Твари дюн'],
      b: [
        'The wreckers keep their stores where no one goes: on {isle}, where creatures nest in the dunes. Clear the way.',
        'Мародёры прячут свои запасы туда, куда никто не ходит: на остров {isle}, где в дюнах гнездятся твари. Расчистите путь.',
      ],
      d: ['Behind the nests: a storehouse of grey sailcloth and a ledger written in a woman’s hand.', 'За гнёздами — склад серой парусины и счётная книга, написанная женской рукой.'],
      s: ['lair', 'land'],
    },
    {
      t: ['A Woman’s Hand', 'Женская рука'],
      b: [
        'The ledger is signed with a single letter, M, and paid out to ships that sailed from {port}. Galt asks you to go and ask quietly.',
        'Счётная книга подписана одной буквой «М», а деньги выплачены кораблям из порта {port}. Галт просит съездить и тихо расспросить.',
      ],
      d: ['The harbour clerk turns pale at the letter M and shuts his window.', 'Портовый писарь бледнеет при виде буквы «М» и захлопывает окошко.'],
      s: ['port', 'hub'],
    },
    {
      t: ['Silence the Clerk', 'Заткнуть писаря'],
      alt: {
        key: 'clerk',
        label: [['Watch him', 'Следить за ним'], ['Frighten him', 'Припугнуть его']],
        t: ['Frighten the Clerk', 'Припугнуть писаря'],
        b: [
          'Galt says a frightened man talks fastest. Take the boat that brings the clerk his letters, and let him know you know.',
          'Галт говорит: напуганный человек говорит быстрее. Захватите лодку, что возит писарю письма, и дайте ему понять, что вы всё знаете.',
        ],
        d: ['The clerk talks: the woman in grey sails a black brig, and her men call her the Widow.', 'Писарь заговорил: женщина в сером ходит на чёрном бриге, и её люди зовут её Вдовой.'],
        s: ['board:1', 'port'],
      },
      b: [
        'The clerk sends letters out every night. Follow his boat at a distance and see where it goes.',
        'Писарь каждую ночь отправляет письма. Проследите за его лодкой издали и посмотрите, куда она идёт.',
      ],
      d: ['The boat meets a black brig off the islands. Her captain is a woman in grey; her men call her the Widow.', 'У островов лодку встречает чёрный бриг. Его капитан — женщина в сером; её люди зовут её Вдовой.'],
      s: ['escort', 'isle'],
    },
    {
      t: ['The Widow’s Escort', 'Охрана Вдовы'],
      b: [
        'The black brig is gone, but her escort still hunts the coast. Galt wants them taught that {hub} has a captain now.',
        'Чёрный бриг ушёл, но её охрана по-прежнему рыщет у берега. Галт хочет, чтобы они узнали: у порта {hub} теперь есть свой капитан.',
      ],
      d: ['The escort scatters. The fishing boats put out again at dawn.', 'Охрана рассеяна. На рассвете рыбачьи лодки снова выходят в море.'],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['The Drowned Wreck', 'Затонувший корабль'],
      b: [
        'The black scrap marks a wreck near {isle} with a bell drawn beside it. Send your divers down and see what lies there.',
        'На чёрном обрывке у острова {isle} отмечено крушение, а рядом нарисован колокол. Спустите водолазов и посмотрите, что там лежит.',
      ],
      d: ['The divers come up white-faced: down there, in the dark, a bell rang once — by itself.', 'Водолазы поднимаются бледные: там, внизу, в темноте, колокол прозвонил один раз — сам.'],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Tide Turns', 'Прилив меняется'],
      b: [
        'The tide came in higher than any man in {hub} remembers. Galt says the Widow’s people will try for the lighthouse tonight. Be at sea when they come.',
        'Прилив поднялся выше, чем помнит кто-либо в порту {hub}. Галт говорит, что люди Вдовы этой ночью пойдут на маяк. Будьте в море, когда они явятся.',
      ],
      d: ['They came, and they went down. But one of the boats was carrying a bell.', 'Они пришли — и пошли на дно. Но в одной из лодок везли колокол.'],
      s: ['sink:3', 'board:1', 'hub'],
    },
    {
      t: ['The Lighthouse Goes Dark', 'Маяк гаснет'],
      b: [
        'At midnight the light of {hub} goes out, and from under the water a bell answers it. Galt takes his lantern and says only: “Now. With me, to {isle}.”',
        'В полночь огонь маяка в порту {hub} гаснет, и из-под воды ему отвечает колокол. Галт берёт фонарь и говорит только: «Сейчас. Со мной, к острову {isle}».',
      ],
      d: [
        'On the rocks you find a second scrap of the black chart. Galt holds it to the light: “This is no wreckers’ map. It is a map of the sea’s own graves.”',
        'На скалах вы находите второй обрывок чёрной карты. Галт подносит его к огню: «Это не карта мародёров. Это карта морских могил».',
      ],
      s: ['isle', 'board:2', 'land', 'hub'],
    },
  ],
};
