// Chapter 1 — Saltmarrow (Act I, Fog over Saltmarrow). The written model of a chapter (docs/36).

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
    {
      t: ['Salt and Fog', 'Соль и туман'],
      b: [
        'Oren Galt has piloted ships past the Teeth for twenty years. Before he trusts you with a word, he wants to see you hold a course.',
        'Орен Галт двадцать лет водит корабли мимо Зубьев. Прежде чем доверить вам хоть слово, он хочет посмотреть, как вы держите курс.',
      ],
      d: ['“You hold her steady,” Galt grumbles. “That will do for a start.”', '«Держишь ровно, — ворчит Галт. — Для начала сойдёт».'],
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
      t: ['Tallow and Lanterns', 'Сало и фонари'],
      b: [
        'Someone keeps tallow and lanterns on the islands — that is how false lights are lit. Galt wants to know whose men they are.',
        'Кто-то держит на островах сало и фонари — так зажигают ложные огни. Галт хочет знать, чьи это люди.',
      ],
      d: ['On the captured launch: a lantern with a small brass bell on its handle.', 'На захваченном баркасе нашёлся фонарь с медным колокольчиком на ручке.'],
      s: ['board:1', 'hub'],
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
      t: ['Grey Sails', 'Серые паруса'],
      b: [
        'Small boats under grey sails slip between the islands at dusk. Galt calls them the wreckers’ tenders. Stop a few and see what they carry.',
        'В сумерках между островами шныряют лодки под серыми парусами. Галт зовёт их тендерами мародёров. Остановите несколько и посмотрите, что они везут.',
      ],
      d: ['Bales of rope, a crate of lamp oil and a chart with three islands ringed in grey.', 'Бухты канатов, ящик лампового масла и карта, где серым обведены три острова.'],
      s: ['board:1', 'sink:2'],
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
      t: ['Shot and Powder', 'Ядра и порох'],
      b: [
        'Galt says a captain with an empty magazine is a captain on borrowed time. Bring powder to {hub} before the wreckers come back for their light.',
        'Галт говорит: капитан с пустым пороховым погребом живёт взаймы. Привезите порох в порт {hub}, пока мародёры не вернулись за своим огнём.',
      ],
      d: ['The powder is stowed in the old customs cellar. The town sleeps easier.', 'Порох уложен в старом таможенном погребе. Город спит спокойнее.'],
      s: ['bring:gunpowder'],
    },
    {
      t: ['Lights on the Water', 'Огни на воде'],
      b: [
        'Tonight the wreckers’ boats are out again. Meet them at sea before they reach the coast.',
        'Этой ночью лодки мародёров снова вышли в море. Встретьте их в открытой воде, пока они не добрались до берега.',
      ],
      d: ['Two boats are sunk; the third ran for the fog with its lights out.', 'Две лодки на дне; третья ушла в туман, погасив огни.'],
      s: ['sink:2', 'hub'],
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
      t: ['Charts of the Teeth', 'Лоции Зубьев'],
      b: [
        'Galt is old, and the Teeth change every winter. He asks you to chart the islands he no longer has the eyes for.',
        'Галт стар, а Зубья меняются каждую зиму. Он просит нанести на карту острова, до которых его глаза уже не достают.',
      ],
      d: ['Galt copies your marks into his own chart, slowly, by candlelight.', 'Галт медленно переносит ваши пометки на свою карту при свече.'],
      s: ['chart', 'hub'],
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
