// Chapter 27 — Ash over the Water (Act V). The Choir takes its revenge on the Code's islands; Hask Morrow holds the
// bay, the Code levies tribute for the war, and Corvin Hale comes back to decide his own fate (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 27,
  region: 'ashen_isles',
  more: ['drowned_crown'],
  hub: 'brimstone_bay',
  title: ['Ash over the Water', 'Пепел над водой'],
  blurb: [
    'The Choir has come east to punish the islands that armed you. Fireships drift into the harbours, the powder mills burn, and out of the smoke sails a grey brig you know very well.',
    'Хор пришёл на восток покарать острова, которые дали вам оружие. В гавани вплывают брандеры, горят пороховые мельницы, а из дыма выходит серый бриг, который вы слишком хорошо знаете.',
  ],
  giver: ['Hask Morrow, chief of the Code', 'Хаск Морроу, вожак Кодекса'],
  portrait: 'giver_bosun_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Ash on the Wind', 'Пепел на ветру'],
      b: [
        'The sky over {hub} is black at noon. Hask Morrow’s signal reached you at sea: the Choir has struck the outer islands first. A fishing village on {isle} is burning — sail in and take off whoever is left.',
        'Небо над портом {hub} чёрное в полдень. Сигнал Хаска Морроу застал вас в море: Хор ударил сперва по внешним островам. На острове {isle} горит рыбацкая деревня — подойдите и заберите всех, кто остался.',
      ],
      d: [
        'Hask meets you on the quay with ash in his beard. “They came under green lanterns,” he says. “For you. Because of you. I am not complaining.”',
        'Хаск встречает вас на причале, борода в пепле. «Пришли под зелёными фонарями, — говорит он. — За вами. Из-за вас. Я не жалуюсь».',
      ],
      s: ['isle', 'rescue', 'hub'],
    },
    {
      t: ['Fireships in the Roads', 'Брандеры на рейде'],
      b: [
        'At dusk the tide brings fireships into the outer roads of {hub}: old hulks packed with pitch, steered by no one, burning green. Sink them before they touch the moored ships.',
        'В сумерках прилив несёт на внешний рейд порта {hub} брандеры: старые корпуса, набитые смолой, без рулевых, горящие зелёным огнём. Потопите их, пока они не коснулись кораблей на стоянке.',
      ],
      d: ['The last fireship goes down hissing a cable’s length from the powder hulk. Nobody on the quay breathes until it does.', 'Последний брандер с шипением тонет в кабельтове от пороховой баржи. Пока он не скрылся, на причале никто не дышит.'],
      s: ['sink::ghost', 'hub'],
    },
    {
      t: ['The Mills Are Burning', 'Горят мельницы'],
      b: [
        'The powder mills at {port} are on fire, and the millers are trapped on the jetty between the flames and the sea. Get there before the magazines go up.',
        'В порту {port} горят пороховые мельницы, и мельники оказались заперты на пристани между огнём и морем. Успейте до того, как взлетят склады.',
      ],
      d: ['The magazines go up just as your boats pull clear. The millers watch their life’s work burn and say nothing.', 'Склады взлетают в тот миг, когда ваши шлюпки отваливают. Мельники молча смотрят, как горит дело всей их жизни.'],
      s: ['port', 'rescue'],
    },
    {
      t: ['The Code’s Due', 'Сбор Кодекса'],
      b: [
        'War costs more than the Code has. Hask has called the old law: every merchant passing the islands pays the Code’s due until the Choir is gone. Crown merchants will grumble. Collect it anyway.',
        'Война стоит больше, чем есть у Кодекса. Хаск поднял старый закон: каждый купец, что идёт мимо островов, платит сбор Кодексу, пока не уйдёт Хор. Купцы Короны будут ворчать. Соберите всё равно.',
      ],
      d: ['Hask weighs the purse and grins: “Admiral Dray would hang me for this. Then he would ask for a share.”', 'Хаск взвешивает кошель и скалится: «Адмирал Дрей повесил бы меня за это. А потом попросил бы долю».'],
      s: ['tribute', 'hub'],
    },
    {
      t: ['Who Showed Them the Way', 'Кто указал им путь'],
      b: [
        'The Choir’s ships came through channels only smugglers know. Hask wants to know which smugglers. Their hideout is on {isle}, and they will be expecting the Code, not you.',
        'Корабли Хора прошли протоками, которые знают одни контрабандисты. Хаск хочет знать, какие именно. Их укрытие на острове {isle}, и ждут они людей Кодекса, а не вас.',
      ],
      d: ['The smugglers were paid in bronze that still rings when you drop it. Their leader names his buyer: a woman in grey.', 'Контрабандистам заплатили бронзой, которая звенит, если её уронить. Их главарь называет покупательницу: женщина в сером.'],
      s: ['land:smugglers', 'hub'],
    },
    {
      t: ['Smoke over the Caldera', 'Дым над кальдерой'],
      b: [
        'The Choir has turned on {at}, where the Code was born. Ghost ships lie off the caldera mouth and shell the town. Hask cannot leave his own bay; go in his place.',
        'Хор обрушился на порт {at}, где родился Кодекс. Корабли-призраки стоят у входа в кальдеру и обстреливают город. Хаск не может оставить свою бухту — идите вместо него.',
      ],
      d: ['The ghost ships break off, and the town fires every gun it has left in salute.', 'Корабли-призраки отходят, и город салютует из всех уцелевших пушек.'],
      s: ['at:cinderhold', 'sink:3:ghost'],
    },
    {
      t: ['A Grey Heron in the Smoke', '«Серая цапля» в дыму'],
      b: [
        'A grey brig without colours has been seen off {isle}, keeping clear of everyone. The lookouts swear it is the Grey Heron — Corvin Hale’s ship. Go and see, and keep your guns quiet.',
        'У острова {isle} замечен серый бриг без флага: он держится в стороне от всех. Вахтенные клянутся, что это «Серая цапля» — корабль Корвина Хейла. Сходите посмотреть и не трогайте пушки.',
      ],
      d: ['The Heron raises one signal flag: “Hold fire. I am here on business.”', 'На «Цапле» поднимается один сигнальный флаг: «Не стреляйте. Я по делу».'],
      s: ['isle', 'escort'],
    },
    {
      t: ['Hale’s Terms', 'Условия Хейла'],
      b: [
        'Hale comes aboard alone, as easy as ever, and does not explain where he has been. Whatever lies between you, he wants to fight the Choir — but first he wants you to take one of its ships with him, side by side.',
        'Хейл поднимается на борт один, всё такой же беспечный, и не объясняет, где пропадал. Что бы ни лежало между вами, он хочет драться с Хором — но сперва предлагает взять вместе один из его кораблей, борт о борт.',
      ],
      d: ['“Like old times,” Hale says, wiping his sword. Jory mutters that the old times were not that good.', '«Как в старые времена», — говорит Хейл, вытирая шпагу. Джори бурчит, что старые времена были не такие уж хорошие.'],
      s: ['board', 'hub'],
    },
    {
      t: ['Coal for the Foundries', 'Уголь для литеен'],
      b: [
        'The foundries of the islands can cast new guns in a week, if they have coal. Coal waits at {port}; the foundry at {port2} has let its fires go cold for the first time in a hundred years.',
        'Литейни островов за неделю отольют новые пушки, если будет уголь. Уголь ждёт в порту {port}, а литейня в порту {port2} впервые за сто лет погасила печи.',
      ],
      d: ['The furnaces roar again, and the first gun out of the mould is stamped with your mark.', 'Печи снова ревут, и на первой пушке из формы выбито ваше клеймо.'],
      s: ['carry:coal'],
    },
    {
      t: ['Bread for the Burned', 'Хлеб погорельцам'],
      b: [
        'The burned-out villages have crowded into {hub}, and the town’s stores are gone in three days. Hask asks for provisions, as much as your holds will carry.',
        'Погорельцы из деревень набились в порт {hub}, и за три дня городские запасы кончились. Хаск просит провизии — сколько поместится в ваши трюмы.',
      ],
      d: ['The children of the burned villages eat their fill and fall asleep on the sacks.', 'Дети погорельцев наедаются досыта и засыпают прямо на мешках.'],
      s: ['bring:provisions'],
    },
    {
      t: ['A Harbour for the Homeless', 'Гавань для бездомных'],
      b: [
        'Not all the burned can stay in {hub}. Hask asks whether your own island has room. Lay out houses and a pier for them behind your walls, where the Choir has never found its way.',
        'Не все погорельцы могут остаться в порту {hub}. Хаск спрашивает, найдётся ли место на вашем острове. Поставьте для них дома и причал за вашими стенами, куда Хор ещё ни разу не нашёл дороги.',
      ],
      d: ['The first families come ashore on your island with their nets and their goats.', 'Первые семьи сходят на берег вашего острова — с сетями и козами.'],
      s: ['build', 'hub'],
    },
    {
      t: ['The Choir’s Landing', 'Десант Хора'],
      b: [
        'The Choir has put men ashore on {isle} and fortified a camp there to raid the islands from inside. Land and burn it out before they dig in.',
        'Хор высадил людей на острове {isle} и укрепил там лагерь, чтобы грабить острова изнутри. Высадитесь и выжгите его, пока они не окопались.',
      ],
      d: ['The camp is empty but for a green lantern still burning on a pole. Jory knocks it into the sea.', 'В лагере пусто, лишь на шесте ещё горит зелёный фонарь. Джори сбивает его в море.'],
      s: ['land:pirate_camp', 'hub'],
    },
    {
      t: ['Merchants Who Pay Twice', 'Купцы, что платят дважды'],
      b: [
        'Some merchants pay the Code’s due by day and the Choir’s tithe by night. Hask wants them stopped at sea and their holds searched, and the Choir’s share taken as the Code’s.',
        'Иные купцы днём платят сбор Кодексу, а ночью — десятину Хору. Хаск хочет, чтобы их останавливали в море, обыскивали трюмы и забирали долю Хора в казну Кодекса.',
      ],
      d: ['Under the cargo of one merchant you find bronze bells wrapped in sackcloth, bound for the deep.', 'Под грузом одного из купцов находятся бронзовые колокола в мешковине — их везли к глубине.'],
      s: ['tribute', 'board'],
    },
    {
      t: ['Hale’s Scrap', 'Обрывок Хейла'],
      b: [
        'Hale lays a scrap of the Black Chart on your table — the one he took from the Admiralty long ago. It marks a wreck off {isle}, with a bell beside it. “I never dared go down,” he admits.',
        'Хейл кладёт на ваш стол обрывок Чёрной карты — тот самый, что он когда-то увёл у Адмиралтейства. На нём отмечено крушение у острова {isle}, а рядом колокол. «Я так и не решился спуститься», — признаётся он.',
      ],
      d: ['The wreck is the Choir’s own: its bell was cut down and hidden there, waiting to be fetched.', 'Это корабль самого Хора: колокол сняли и спрятали там до поры, чтобы потом забрать.'],
      s: ['isle', 'dive', 'hub'],
    },
    {
      t: ['The Bronze Captain', 'Бронзовый капитан'],
      b: [
        'A pirate on the Hunters’ Guild’s list leads the Choir’s raids along the island shores and is paid by the bell he brings back. Hask wants his flag nailed to the harbour gate.',
        'Пират из списка Гильдии охотников ведёт набеги Хора вдоль берегов и получает плату за каждый привезённый колокол. Хаск хочет прибить его флаг к воротам гавани.',
      ],
      d: ['The flag goes up on the gate, and the Code’s captains spit on it as they pass.', 'Флаг прибит к воротам, и капитаны Кодекса плюют на него, проходя мимо.'],
      s: ['named', 'hub'],
    },
    {
      t: ['Powder Through the Smoke', 'Порох сквозь дым'],
      b: [
        'The last powder from the surviving mills must reach the fleet, and the Choir’s hired pirates are waiting for it in the smoke. Keep the sea open until the convoy is through.',
        'Последний порох с уцелевших мельниц должен дойти до флота, а пираты на жалованье у Хора поджидают его в дыму. Держите море открытым, пока конвой не пройдёт.',
      ],
      d: ['The convoy comes through blackened but whole. The gunners kiss the barrels.', 'Конвой проходит закопчённым, но целым. Канониры целуют бочки.'],
      s: ['escort', 'sink::pirate'],
    },
    {
      t: ['Gunners from the Mills', 'Канониры с мельниц'],
      b: [
        'The millers of {port} have lost their mills, but not their knowledge of powder. Many would rather fight than rebuild. Sign them on.',
        'Мельники из порта {port} лишились мельниц, но не знания пороха. Многие из них хотят не отстраиваться, а драться. Наберите их в команду.',
      ],
      d: ['The new gunners measure every charge by hand and mutter at the old ones.', 'Новые канониры отмеряют каждый заряд на ощупь и ворчат на старых.'],
      s: ['port', 'recruit'],
    },
    {
      t: ['Timber for New Hulls', 'Лес для новых корпусов'],
      b: [
        'The Code lost a third of its ships to the fireships. Its shipwrights in {hub} can lay new keels at once, if they have timber.',
        'Кодекс потерял треть кораблей от брандеров. Его корабелы в порту {hub} сразу заложат новые кили, если будет лес.',
      ],
      d: ['Three keels are laid on one day, and Hask names the first one after the burned village.', 'В один день заложены три киля, и первый Хаск называет в честь сгоревшей деревни.'],
      s: ['bring:timber'],
    },
    {
      t: ['Hale Decides', 'Хейл решает'],
      b: [
        'A Choir ship under a white flag comes for Hale, not for you: the Widow offers him the whole Black Chart and a pardon from the sea itself, if he sails away tonight. Hale asks you to come with him to give his answer.',
        'За Хейлом — не за вами — приходит корабль Хора под белым флагом: Вдова предлагает ему всю Чёрную карту и прощение самого моря, если он уйдёт этой ночью. Хейл просит вас пойти с ним, когда он будет отвечать.',
      ],
      d: [
        'Hale gives his answer from the rail, with a boarding axe. Afterwards he tears up the Widow’s letter: “Under your flag, captain. To the end.”',
        'Хейл отвечает с фальшборта — абордажным топором. Потом рвёт письмо Вдовы: «Под вашим флагом, капитан. До конца».',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['The Cinder Channel', 'Пепельная протока'],
      b: [
        'The Choir’s main fleet lies in the outer road, and there is only one way to take it from behind: a channel choked with ash, which no one has sounded since the last eruption. Chart it, as far as {isle}.',
        'Главный флот Хора стоит на внешнем рейде, и зайти ему в тыл можно лишь одним путём — протокой, забитой пеплом, которую никто не промерял с последнего извержения. Пройдите и нанесите её на карту до острова {isle}.',
      ],
      d: ['The channel is shallow but passable. Hale whistles: “They will never look for us there.”', 'Протока мелкая, но проходимая. Хейл присвистывает: «Там нас искать не станут».'],
      s: ['chart', 'isle'],
    },
    {
      t: ['The Night of Fireships', 'Ночь брандеров'],
      b: [
        'The Choir sends everything that will burn against {hub} at once, to clear the way for its fleet at dawn. Sink the fireships and pull the crews of the burning boats out of the water.',
        'Хор бросает на порт {hub} всё, что может гореть, разом, чтобы на рассвете расчистить путь своему флоту. Потопите брандеры и вытащите из воды экипажи горящих лодок.',
      ],
      d: ['By the grey of morning the roads are black with ash, but every hull in the harbour still floats.', 'К серому рассвету рейд чёрен от пепла, но все корабли в гавани на плаву.'],
      s: ['sink:5:ghost', 'rescue'],
    },
    {
      t: ['Fire on the Water', 'Огонь на воде'],
      b: [
        'At dawn the Choir’s fleet comes into the bay under green lanterns. Hask takes the Code’s line, Hale’s Grey Heron takes the wing, and you go round through the ash channel past {isle}. Break them.',
        'На рассвете флот Хора входит в бухту под зелёными фонарями. Хаск ведёт строй Кодекса, «Серая цапля» Хейла держит крыло, а вы заходите через пепельную протоку мимо острова {isle}. Разбейте их.',
      ],
      d: [
        'The Choir’s flagship strikes her lanterns. Her captain laughs in chains: “We only kept you busy. The Widow is already sailing for the lighthouse at the edge of the deep.”',
        'Флагман Хора гасит фонари. Его капитан смеётся в цепях: «Мы лишь отвлекали вас. Вдова уже плывёт к маяку на краю глубины».',
      ],
      s: ['isle', 'sink:6:ghost', 'board:2', 'hub'],
    },
  ],
};
