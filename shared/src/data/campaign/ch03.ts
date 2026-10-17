// Chapter 3 — Gallowsmouth (Act I, Fog over Saltmarrow). Oren Galt again; the bell-founder in irons; Galt lost (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 3,
  region: 'black_coast',
  hub: 'gallowsmouth',
  title: ['Gallowsmouth', 'Висельная Губа'],
  blurb: [
    'The Crown’s prison port, where the hulks rot at their chains. A bell-founder in irons knows where the drowned bells were cast, and Oren Galt will not wait for the Crown’s leave.',
    'Тюремный порт Короны, где на цепях гниют плавучие тюрьмы. Литейщик в кандалах знает, где отливали утонувшие колокола, и Орен Галт не станет ждать позволения Короны.',
  ],
  giver: ['Oren Galt, pilot', 'Орен Галт, лоцман'],
  portrait: 'giver_old_salt_m',
  reward: { title: ['Child of the Fog', 'Дитя тумана'] },
  quests: [
    {
      t: ['A Letter to the Lighthouse', 'Письмо на маяк'],
      b: [
        'Isolde’s letter reaches Galt at {at}: a prisoner of {hub} once cast bells for the Widow. Galt will not sail on a Crown ship. He asks for a berth on yours.',
        'Письмо Изольды настигает Галта в порту {at}: один узник порта {hub} когда-то отливал колокола для Вдовы. На королевском корабле Галт не поплывёт. Он просит место на вашем.',
      ],
      d: [
        'Galt stands at the rail, looking at the hulks. “One of those holds our man,” he says, “and the Crown will not give him up for the asking.”',
        'Галт стоит у борта и смотрит на плавучие тюрьмы. «В одной из них наш человек, — говорит он. — И Корона не отдаст его по первой просьбе».',
      ],
      s: ['at:saltmarrow', 'hub'],
    },
    {
      t: ['The Roll of the Hulks', 'Список узников'],
      b: [
        'The prison governor counts every biscuit twice. Bring provisions for his hungry hulks, and he may let Galt read the prisoners’ roll.',
        'Тюремный губернатор пересчитывает каждый сухарь дважды. Привезите провизию для его голодных плавучих тюрем — и он, быть может, позволит Галту прочесть список узников.',
      ],
      d: [
        'On the roll of the third hulk: Silas Thorne, bell-founder, for life, for casting without a Crown seal.',
        'В списке третьей тюрьмы значится: Сайлас Торн, литейщик колоколов, пожизненно — за литьё без печати Короны.',
      ],
      s: ['bring:provisions'],
    },
    {
      t: ['The Founder’s Daughter', 'Дочь литейщика'],
      b: [
        'Thorne speaks through the grating: he will say nothing while his daughter lives among the fishers of {isle}, where the Widow’s people know to find her.',
        'Торн говорит сквозь решётку: он не скажет ни слова, пока его дочь живёт среди рыбаков острова {isle}, где люди Вдовы знают, как её найти.',
      ],
      d: [
        'Ada Thorne packs her father’s tools and comes aboard without a word. Grey sails already stand on the horizon.',
        'Ада Торн укладывает отцовские инструменты и молча поднимается на борт. На горизонте уже стоят серые паруса.',
      ],
      s: ['land:fishers'],
    },
    {
      t: ['Grey Sails at the Fishers', 'Серые паруса у рыбаков'],
      b: [
        'The grey sails that came for Ada follow your wake into the evening. Galt says a hunter who loses his quarry comes back with friends; better to settle it now.',
        'Серые паруса, пришедшие за Адой, идут по вашему следу до самого вечера. Галт говорит: охотник, упустивший добычу, возвращается с друзьями, так что лучше покончить с этим сейчас.',
      ],
      d: [
        'Aboard the captured tender: a sketch of the hulks of {hub}, the third one marked in grey.',
        'На захваченном тендере находят набросок плавучих тюрем порта {hub}, третья помечена серым.',
      ],
      s: ['sink:2', 'board:1', 'hub'],
    },
    {
      t: ['The Old Foundry', 'Старая литейня'],
      b: [
        'With Ada safe, Thorne talks. The Widow’s bells were cast in a ruined Crown foundry on {isle}, from metal raised off the sea floor. Galt wants to see the moulds.',
        'Теперь, когда Ада в безопасности, Торн заговаривает. Колокола Вдовы отливали в разрушенной литейне Короны на острове {isle} — из металла, поднятого со дна моря. Галт хочет увидеть формы.',
      ],
      d: [
        'The moulds are still there, and each one bears the name of a church the sea has taken.',
        'Формы на месте, и на каждой выведено имя церкви, которую забрало море.',
      ],
      s: ['land:ruins', 'hub'],
    },
    {
      t: ['The Gallows Shoals', 'Висельные мели'],
      b: [
        'No honest pilot charts the shoals around {hub}: the Crown keeps them secret so that no prisoner can get away. Galt says that is exactly why you must know them.',
        'Ни один честный лоцман не наносит на карту мели вокруг порта {hub}: Корона держит их в тайне, чтобы ни один узник не сбежал. Галт говорит, что именно поэтому вам их надо знать.',
      ],
      d: [
        'Galt corrects your marks with a stub of pencil. “Here,” he says. “At low water, a boat could get out here.”',
        'Галт огрызком карандаша правит ваши пометки. «Вот здесь, — говорит он. — В отлив здесь пройдёт лодка».',
      ],
      s: ['chart'],
    },
    {
      t: ['The Chapel Under the Sea', 'Часовня под водой'],
      b: [
        'One mould names a chapel that slid into the sea off {isle} in a storm two generations ago. Its bell was never raised, or so the parish believes.',
        'На одной из форм — имя часовни, которая два поколения назад во время шторма сползла в море у острова {isle}. Её колокол так и не подняли — по крайней мере, так думают прихожане.',
      ],
      d: [
        'The belfry is there, green with weed. The bell is not: its yoke has been sawn clean through.',
        'Колокольня на месте, зелёная от водорослей. Колокола нет: его ярмо аккуратно перепилено.',
      ],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['Silence for the Founder', 'Тишина для литейщика'],
      b: [
        'A guard of the third hulk has been paid in old Crown silver to leave a door unbarred tonight. A boatman has told Galt: the men who mean to silence Thorne will come by water.',
        'Стражнику третьей тюрьмы заплатили старым серебром Короны, чтобы этой ночью он оставил дверь незапертой. Об этом Галту шепнул лодочник: те, кто хочет заставить Торна замолчать, придут по воде.',
      ],
      d: ['The boats are sunk and the guard has fled. Thorne will not last long in the hulks now.', 'Лодки потоплены, стражник сбежал. Теперь Торну в плавучей тюрьме долго не продержаться.'],
      s: ['escort', 'sink:2'],
    },
    {
      t: ['The Heron Returns', 'Цапля возвращается'],
      b: [
        'Corvin Hale sends a boy with a message: he is in {port}, he has Isolde’s scrap, and he would like to talk about bells. Galt spits over the rail, then fetches his coat.',
        'Корвин Хейл присылает мальчишку с запиской: он в порту {port}, обрывок Изольды у него, и он хотел бы поговорить о колоколах. Галт сплёвывает за борт, а потом идёт за плащом.',
      ],
      d: [
        'Hale shows the scrap but will not part with it. “The founder,” he says, “is worth more to all of us out of irons.”',
        'Хейл показывает обрывок, но расставаться с ним не собирается. «Литейщик, — говорит он, — полезнее нам всем без кандалов».',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['The Governor’s Debts', 'Долги губернатора'],
      b: [
        'Galt learns that the governor owes money to the smugglers who run rum past his own fort. His notes of hand are kept in their camp on {isle}.',
        'Галт узнаёт, что губернатор в долгу у контрабандистов, которые возят ром мимо его же форта. Его долговые расписки хранятся в их лагере на острове {isle}.',
      ],
      d: ['The governor’s notes, signed and sealed. Lawful or not, there is a way in now.', 'Расписки губернатора, подписанные и скреплённые печатью. Законно или нет, но теперь путь открыт.'],
      s: ['land:smugglers', 'hub'],
    },
    {
      t: ['Out of the Third Hulk', 'Из третьей тюрьмы'],
      alt: {
        key: 'founder',
        label: [['Free him by force', 'Освободить силой'], ['Buy his release', 'Выкупить законно']],
        t: ['A Pardon Bought', 'Купленное помилование'],
        b: [
          'With the governor’s notes in your pocket, a pardon is only paperwork. He asks one thing more: medicine for the fever in the hulks, delivered in plain sight, so that his clerks see an honest bargain.',
          'С расписками губернатора в кармане помилование — всего лишь бумаги. Он просит лишь об одном: доставить лекарства от лихорадки для плавучих тюрем у всех на виду, чтобы писари видели честную сделку.',
        ],
        d: [
          'The governor signs, the irons are struck off, and Thorne walks down the gangway a free man.',
          'Губернатор подписывает бумаги, кандалы сбивают, и Торн сходит по сходням свободным человеком.',
        ],
        s: ['bring:medicine', 'hub'],
      },
      b: [
        'At low water Galt’s gap in the shoals is open for an hour. Take the guard boats, cut Thorne out of the third hulk, and run past {isle} before the fort’s gunners wake.',
        'В отлив проход Галта в мелях открыт всего на час. Захватите сторожевые лодки, вызволите Торна из третьей тюрьмы и уходите мимо острова {isle}, пока пушкари форта не проснулись.',
      ],
      d: [
        'Thorne is aboard, his irons still on. Behind you the fort’s bell rings the alarm far too late.',
        'Торн на борту, всё ещё в кандалах. За кормой колокол форта бьёт тревогу — слишком поздно.',
      ],
      s: ['board:2', 'isle'],
    },
    {
      t: ['A Harbour for the Thornes', 'Убежище для Торнов'],
      b: [
        'Runaway or pardoned, Thorne knows too much to stay on this coast. Galt sends father and daughter to Isolde at {at}, who knows how to lose a man among the Admiralty’s own papers.',
        'Беглый или помилованный, Торн знает слишком много, чтобы оставаться на этом берегу. Галт отправляет отца и дочь к Изольде в порт {at}: она умеет спрятать человека среди бумаг самого Адмиралтейства.',
      ],
      d: [
        'Before he goes ashore, Thorne draws twelve bells from memory and writes a wreck’s name beside each.',
        'Прежде чем сойти на берег, Торн по памяти рисует двенадцать колоколов и возле каждого пишет название затонувшего корабля.',
      ],
      s: ['at:gravesend', 'hub'],
    },
    {
      t: ['Twelve Bells', 'Двенадцать колоколов'],
      b: [
        'Thorne’s twelve names match twelve bells drawn on the black scraps. The nearest lies off {isle}, where, the fishers say, a bell-frame shows above the water at low tide.',
        'Двенадцать названий Торна совпадают с двенадцатью колоколами на чёрных обрывках. Ближайший — у острова {isle}, где, по словам рыбаков, в отлив из воды показывается колокольная рама.',
      ],
      d: [
        'The frame stands empty on the rock, its ropes fresh and tarred. Someone comes here to ring a bell that is not there.',
        'Рама на скале пуста, но верёвки на ней свежие, просмолённые. Кто-то приходит сюда звонить в колокол, которого нет.',
      ],
      s: ['isle', 'land:bell'],
    },
    {
      t: ['The Ringers’ Boats', 'Лодки звонарей'],
      b: [
        'The boats that come to the empty frame carry no cargo, only men in grey who sing as they row. Galt wants one of them alive.',
        'Лодки, что приходят к пустой раме, не везут груза — только людей в сером, которые поют на вёслах. Галт хочет взять одного из них живым.',
      ],
      d: [
        'The captured ringer will not speak, but he hums three slow notes, and Jory leaves the deck.',
        'Пленный звонарь молчит, но напевает три медленные ноты, и Джори уходит с палубы.',
      ],
      s: ['sink:2', 'board:1'],
    },
    {
      t: ['Honest Lamps', 'Честные огни'],
      b: [
        'Galt wants honest lamps burning in {port2} through the nights to come, when the fog lies thick and false lights are lit. The oil is in {port}, and no Crown carrier will touch it.',
        'Галт хочет, чтобы в грядущие ночи, когда ляжет густой туман и зажгутся ложные огни, в порту {port2} горели честные фонари. Масло лежит в порту {port}, а королевские перевозчики не желают к нему прикасаться.',
      ],
      d: ['The lamps of {port2} burn steady all night. Galt does not say what he is afraid of.', 'Фонари в порту {port2} всю ночь горят ровно. Галт не говорит, чего он боится.'],
      s: ['carry:whale_oil'],
    },
    {
      t: ['A Bell That Calls by Name', 'Колокол зовёт по имени'],
      b: [
        'The fog has not lifted for three days, and somewhere out in it a bell keeps ringing. Fishing boats that steered for the sound have not come home.',
        'Туман не рассеивается уже три дня, и где-то в нём не умолкает колокол. Рыбацкие лодки, что пошли на звук, не вернулись.',
      ],
      d: [
        'The fishers you pull from the water all say the same: the bell was calling each of them by name.',
        'Все рыбаки, которых вы вытаскиваете из воды, говорят одно и то же: колокол звал каждого по имени.',
      ],
      s: ['rescue', 'hub'],
    },
    {
      t: ['The Grey Cordon', 'Серое оцепление'],
      b: [
        'Grey sails have drawn a ring round the water where the bell rings. Galt says a ring like that is a door under guard, and he means to go through it.',
        'Серые паруса взяли в кольцо воду, где звонит колокол. Галт говорит, что такое кольцо — это охраняемая дверь, и он намерен в неё войти.',
      ],
      d: ['The ring is broken. Galt spends the night at the chart table and does not sleep.', 'Кольцо прорвано. Галт всю ночь сидит над картами и не смыкает глаз.'],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['Hands for the Fog', 'Люди для тумана'],
      b: [
        'Galt asks you to sign on men who are not afraid of the fog: prisoners whose terms have run out and who have nowhere left to go but the sea.',
        'Галт просит набрать людей, которые не боятся тумана: бывших узников, чей срок вышел и кому больше некуда идти, кроме моря.',
      ],
      d: ['The new hands watch the fog in silence. One of them crosses himself at the sound of a bell.', 'Новички молча смотрят в туман. Один из них крестится, заслышав колокол.'],
      s: ['recruit', 'hub'],
    },
    {
      t: ['Into the Fog', 'В туман'],
      b: [
        'At dawn the bell rings thirteen times. Before anyone can stop him, Galt takes the ship’s boat and a lantern and rows for {isle} alone. Follow him through the Widow’s guard.',
        'На рассвете колокол бьёт тринадцать раз. Прежде чем кто-нибудь успевает его остановить, Галт берёт шлюпку и фонарь и в одиночку гребёт к острову {isle}. Идите за ним сквозь охрану Вдовы.',
      ],
      d: [
        'Galt’s boat drifts empty in the fog. In his journal, one line in a shaking hand: “Seek those who hear the bells. In the east.”',
        'Шлюпка Галта дрейфует в тумане пустой. В его журнале одна строка, выведенная дрожащей рукой: «Ищи тех, кто слышит колокола. На востоке».',
      ],
      s: ['isle', 'sink:2', 'dive', 'hub'],
    },
  ],
};
