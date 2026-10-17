// Chapter 19 — The Caldera (Act IV, Ash and the Code). Hask Morrow and the Code, who serve no Crown; prove yourself.
// The branch `code_oath`: swear to the Code (the Crown's letter burned) or keep the Crown's letter of marque (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 19,
  region: 'ashen_isles',
  hub: 'cinderhold',
  title: ['The Caldera', 'Кальдера'],
  blurb: [
    'A town in the throat of a volcano, where the Code is the only law and the Crown’s name is spat into the ash. Hask Morrow has the powder and the ships. He has no use for you — yet.',
    'Город в жерле вулкана, где Кодекс — единственный закон, а имя Короны сплёвывают в пепел. У Хаска Морроу есть порох и корабли. А вот вы ему пока ни к чему.',
  ],
  giver: ['Hask Morrow, captain of the Code', 'Хаск Морроу, капитан Кодекса'],
  portrait: 'giver_smuggler_m',
  reward: { ammo: true },
  quests: [
    {
      t: ['Ash on the Deck', 'Пепел на палубе'],
      b: [
        'You sail into {region}, and ash falls on your deck for a day and a night before you sight the smoking cone. At {hub} the Brokers’ letter must reach Hask Morrow’s own hand, and no one else’s.',
        'Вы входите в воды «{region}», и целые сутки на палубу сыплется пепел, прежде чем впереди встаёт дымящийся конус. В порту {hub} письмо Брокеров нужно передать лично Хаску Морроу, и никому больше.',
      ],
      d: [
        'Morrow weighs the letter in his palm and drops it unread into the brazier. “The Code serves no Crown, no Brokers, and no you. Show me what you are.”',
        'Морроу взвешивает письмо на ладони и бросает его нераспечатанным в жаровню. «Кодекс не служит ни Короне, ни Брокерам, ни вам. Покажите, чего вы стоите».',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['The Toll of the Cone', 'Дань вулкана'],
      b: [
        'Every merchant who passes the cone pays the Code, and in return no one touches him in these waters. Morrow wants to see whether you can collect without sinking the purse.',
        'Каждый купец, что проходит мимо вулкана, платит Кодексу, а взамен никто не трогает его в этих водах. Морроу хочет посмотреть, сумеете ли вы собрать дань, не утопив кошелёк.',
      ],
      d: [
        'Morrow counts the coin and grunts. “Nobody drowned. That is a start.”',
        'Морроу пересчитывает монеты и хмыкает. «Никто не утонул. Для начала неплохо».',
      ],
      s: ['tribute', 'hub'],
    },
    {
      t: ['Raiders Outside the Code', 'Налётчики вне Кодекса'],
      b: [
        'Not every pirate in the ash keeps the Code. A pack of them has been taking the sulphur boats that pay Morrow for protection, and that makes the Code a liar. Sink them, and bring one in for judgement.',
        'Не каждый пират в пепле чтит Кодекс. Шайка таких перехватывает серные лодки, что платят Морроу за защиту, — а значит, выставляет Кодекс лжецом. Потопите их, а одного приведите на суд.',
      ],
      d: [
        'The captured captain is marooned on a cinder rock with a pistol and one shot, as the Code demands.',
        'Пленного капитана, как велит Кодекс, высаживают на шлаковую скалу с пистолетом и одним зарядом.',
      ],
      s: ['sink:3:pirate', 'board:1'],
    },
    {
      t: ['Names in Black Glass', 'Имена в чёрном стекле'],
      b: [
        'Every captain of the Code has cut his name in the black glass of the old shrine on {isle}. Morrow sends you there to read them. “Then you will know who you are asking to die for you.”',
        'Каждый капитан Кодекса вырезал своё имя в чёрном стекле старого святилища на острове {isle}. Морроу отправляет вас прочесть их. «Тогда вы будете знать, кого просите умирать за вас».',
      ],
      d: [
        'Hundreds of names, the oldest worn smooth. The newest was cut a week ago, under a small grey bell.',
        'Сотни имён, старейшие почти стёрлись. Самое новое вырезано неделю назад — под маленьким серым колоколом.',
      ],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['Iron for the Forges', 'Железо для кузниц'],
      b: [
        'The Code forges its own shot, and the forges are hungry. Iron waits at {port}, bought and paid for; the smiths at {port2} are standing idle by cold anvils.',
        'Кодекс сам куёт свои ядра, и кузницы голодны. Железо ждёт в порту {port}, купленное и оплаченное; кузнецы в порту {port2} стоят без дела у холодных наковален.',
      ],
      d: [
        'The anvils ring all night, and the first round shot cools in the ash by morning.',
        'Всю ночь звенят наковальни, и к утру первые ядра остывают в пепле.',
      ],
      s: ['carry:iron'],
    },
    {
      t: ['The Crown’s Eyes', 'Глаза Короны'],
      b: [
        'Someone in {hub} sends the Admiralty word of every ship that leaves the cone, and Morrow’s captains say it began when you arrived. Find the courier’s ship off {port} and take it — or carry the blame.',
        'Кто-то в порту {hub} сообщает Адмиралтейству о каждом корабле, покидающем вулкан, и капитаны Морроу говорят, что началось это с вашим приходом. Найдите судно гонца у порта {port} и захватите его — или примите вину на себя.',
      ],
      d: [
        'The courier’s letters are in the hand of Morrow’s own quartermaster. Morrow says nothing, but he looks at you differently.',
        'Письма гонца написаны рукой квартирмейстера самого Морроу. Морроу молчит, но смотрит на вас уже иначе.',
      ],
      s: ['port', 'board:1'],
    },
    {
      t: ['The Code’s Hunting List', 'Список Кодекса'],
      b: [
        'One captain broke the Code’s oldest article: he sold a crew of the Code to the Crown’s gallows. The hunters have posted his name, and the Code wants him at the bottom of the sea.',
        'Один капитан нарушил древнейшую статью Кодекса: продал его команду на виселицы Короны. Охотники вывесили его имя, а Кодекс хочет видеть его на дне.',
      ],
      d: [
        'When the news comes in, the taverns of {hub} drink to you without being asked.',
        'Когда приходит весть, таверны в порту {hub} пьют за вас без всякой просьбы.',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['The Steaming Isle', 'Парящий остров'],
      b: [
        'Fishermen say grey boats have been landing on {isle}, where the ground steams and nothing grows. The Code never goes there. Look from the water first, then land and see what they left.',
        'Рыбаки говорят, что серые лодки высаживались на острове {isle}, где земля парит и ничего не растёт. Люди Кодекса туда не ходят. Сначала осмотритесь с воды, потом высадитесь и посмотрите, что оставили чужаки.',
      ],
      d: [
        'In a steaming crack in the rock: a bell-mould of fired clay, still warm.',
        'В парящей трещине скалы — глиняная колокольная форма, ещё тёплая.',
      ],
      s: ['isle', 'land', 'hub'],
    },
    {
      t: ['The Oath of Ash', 'Присяга пепла'],
      alt: {
        key: 'code_oath',
        label: [['Swear to the Code', 'Присягнуть Кодексу'], ['Keep the Crown’s letter', 'Сохранить патент Короны']],
        t: ['Two Masters', 'Два хозяина'],
        b: [
          'You keep the Crown’s letter of marque in your chest. Morrow shrugs: a captain with two masters pays twice. Take the Code’s tribute, and bring him a ship that sailed for the Choir, and the Code will sail beside you all the same.',
          'Патент Короны остаётся в вашем сундуке. Морроу пожимает плечами: у капитана с двумя хозяевами и плата двойная. Возьмите дань для Кодекса и приведите ему корабль, что ходил на Хор, — и Кодекс всё равно пойдёт рядом с вами.',
        ],
        d: [
          '“Keep your paper,” Morrow says. “I will keep an eye on you. That is fair.”',
          '«Храните свою бумагу, — говорит Морроу. — А я буду приглядывать за вами. Это честно».',
        ],
        s: ['tribute', 'board:1'],
      },
      b: [
        'The captains of the Code gather on the caldera’s rim, and Morrow holds out his hand for the Crown’s letter of marque. Burn it in the brazier, swear to the Code, and take your first tribute under the ash-grey flag.',
        'Капитаны Кодекса собираются на краю кальдеры, и Морроу протягивает руку за патентом Короны. Сожгите его в жаровне, присягните Кодексу и возьмите первую дань под пепельным флагом.',
      ],
      d: [
        'The letter curls black in the fire. Morrow grips your hand: “Now you are ours, and we are yours.”',
        'Патент чернеет и сворачивается в огне. Морроу сжимает вашу руку: «Теперь вы наши, а мы — ваши».',
      ],
      s: ['hub', 'tribute'],
    },
    {
      t: ['Short Weight', 'Недовес'],
      b: [
        'The Code’s powder tallies come up short every week, a few casks at a time. Morrow suspects the barges that run the powder down the coast. Ride with them, and sink whatever comes alongside in the night.',
        'Каждую неделю в пороховых счетах Кодекса недостаёт по нескольку бочонков. Морроу подозревает баржи, что возят порох вдоль берега. Сопроводите их и потопите всё, что ночью подойдёт к борту.',
      ],
      d: [
        'The boats that came alongside had grey sails and empty holds, waiting to be filled.',
        'У подошедших лодок были серые паруса и пустые трюмы, готовые принять груз.',
      ],
      s: ['escort', 'sink:2'],
    },
    {
      t: ['Bronze for Sale', 'Бронза на продажу'],
      b: [
        'Some Code smugglers have found that the Choir pays double for bronze, and they are not asking what it is for. Morrow wants the deals broken and the bronze brought to {hub}. The smugglers may keep their lives.',
        'Кое-кто из контрабандистов Кодекса прознал, что Хор платит за бронзу вдвое, и не спрашивает, зачем она ему. Морроу хочет, чтобы сделки сорвались, а бронза оказалась в порту {hub}. Жизни контрабандистам можно оставить.',
      ],
      d: [
        'Morrow has the bronze cast into a gun and names it Choir’s Regret.',
        'Морроу велит отлить из бронзы пушку и называет её «Горе Хора».',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Maps of the Cones', 'Карта вулканов'],
      b: [
        'New islands rise from the sea here every few years, and old ones sink in a night. The Code’s charts are already wrong. Morrow wants a captain who can draw what is really there.',
        'Здесь каждые несколько лет из моря встают новые острова, а старые уходят под воду за одну ночь. Карты Кодекса уже устарели. Морроу нужен капитан, способный нарисовать то, что есть на самом деле.',
      ],
      d: [
        'Morrow hangs your chart in the council hall, beside the black glass of the old names.',
        'Морроу вешает вашу карту в зале совета, рядом с чёрным стеклом старых имён.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Renegades on Black Sand', 'Отступники на чёрном песке'],
      b: [
        'A camp of Code renegades on {isle} has sworn to the Choir for silver. Their ships lie drawn up on the black sand. Land, burn the camp, and sink the boats that try to slip away.',
        'В лагере отступников Кодекса на острове {isle} присягнули Хору за серебро. Их суда вытащены на чёрный песок. Высадитесь, сожгите лагерь и потопите лодки, что попытаются ускользнуть.',
      ],
      d: [
        'The camp burns. On a post by the fire, a grey ribbon flutters in the hot wind.',
        'Лагерь горит. На столбе у огня бьётся на горячем ветру серая лента.',
      ],
      s: ['land:pirate_camp', 'sink:2:pirate'],
    },
    {
      t: ['Guns from the Foundries', 'Пушки из литейных'],
      b: [
        'The foundries at {at} have cast a battery of long guns for the Code, and the gun-barge that carries them is slow and fat. Morrow wants you at its side all the way home.',
        'Литейные в порту {at} отлили для Кодекса батарею длинных пушек, а баржа, что их везёт, медлительна и неповоротлива. Морроу хочет, чтобы вы шли рядом с ней до самого дома.',
      ],
      d: [
        'The guns are hauled up the caldera road by fifty men on ropes. The Code is arming.',
        'Пятьдесят человек втаскивают пушки на канатах вверх по дороге к кальдере. Кодекс вооружается.',
      ],
      s: ['at:slagport', ['escort', 'Stay beside the gun-barge for {n} min.', 'Держитесь рядом с пушечной баржей: {n} мин.']],
    },
    {
      t: ['The Captains’ Vote', 'Голос капитанов'],
      b: [
        'War against the Choir must be voted by the Code’s captains, and two of them sit far from the cone, one at {port} and one at {port2}. Morrow will not sail without their votes. Go and win them.',
        'Войну Хору должны одобрить капитаны Кодекса, а двое из них сидят далеко от вулкана — один в порту {port}, другой в порту {port2}. Без их голосов Морроу не выйдет в море. Отправляйтесь и добудьте их.',
      ],
      d: [
        'The first captain votes yes for the fight. The second votes yes for the plunder. Both votes count.',
        'Первый капитан голосует «за» ради боя. Второй — ради добычи. Оба голоса засчитаны.',
      ],
      s: ['port', 'port2', 'hub'],
    },
    {
      t: ['A Mooring for the Code', 'Стоянка для Кодекса'],
      b: [
        'If the Code sails north with you, its ships will need a harbour on the way where the Crown cannot find them. Morrow asks the one thing a captain of the Code never asks: lay a mooring for them on your own island.',
        'Если Кодекс пойдёт с вами на север, его кораблям понадобится гавань на пути, где их не найдёт Корона. Морроу просит то, о чём капитан Кодекса никогда не просит: устройте для них стоянку на вашем собственном острове.',
      ],
      d: [
        'The first ship of the Code ties up at your new quay and fires a salute that echoes round the island.',
        'Первый корабль Кодекса швартуется у вашего нового причала и даёт салют, который эхом обходит остров.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['The Grey Envoy', 'Серый посланник'],
      b: [
        'A ship under a white flag lies off {isle}: an envoy of the Choir has come to offer Morrow a chest of old Crown silver for the Code’s neutrality. Morrow wants the chest — and the envoy — brought to him.',
        'У острова {isle} стоит корабль под белым флагом: посланник Хора привёз Морроу сундук старого серебра Короны в уплату за нейтралитет Кодекса. Морроу хочет получить и сундук, и посланника.',
      ],
      d: [
        'Morrow pours the silver into the sea before the envoy’s eyes. “That is the Code’s answer. You may swim after it.”',
        'Морроу высыпает серебро в море на глазах у посланника. «Вот ответ Кодекса. Можете плыть за ним».',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['Rum for the Rim', 'Ром для кальдеры'],
      b: [
        'When the Code goes to war, the captains drink on the caldera’s rim until the cone itself seems to sway. Morrow says no one remembers a war that began sober. Bring the rum.',
        'Когда Кодекс идёт на войну, капитаны пьют на краю кальдеры, пока не начинает качаться сам вулкан. Морроу говорит: никто не помнит войны, начатой на трезвую голову. Привезите ром.',
      ],
      d: [
        'They drink to the Code, to the cone, and last of all — grudgingly — to you.',
        'Пьют за Кодекс, за вулкан и под конец — нехотя — за вас.',
      ],
      s: ['bring:rum'],
    },
    {
      t: ['Grey Sails at Dawn', 'Серые паруса на рассвете'],
      b: [
        'The Choir answers the vote at once: grey ships fall on the Code’s fishing fleet at dawn, and boats are already overturned in the swell. Sink the raiders and pull the fishermen out.',
        'Хор отвечает на голосование сразу: на рассвете серые корабли обрушиваются на рыбацкий флот Кодекса, и лодки уже переворачиваются на зыби. Потопите налётчиков и вытащите рыбаков.',
      ],
      d: [
        'The fishermen come in on your deck, cursing the Choir in words the cone has never heard.',
        'Рыбаки поднимаются к вам на палубу и проклинают Хор такими словами, каких вулкан ещё не слышал.',
      ],
      s: ['sink:3', 'rescue'],
    },
    {
      t: ['Watch from the Rock', 'Дозор со скалы'],
      b: [
        'Morrow wants eyes on the southern approaches, where the smoke hides ships until they are close enough to fire. Take your ship off {isle} and keep the watch through the night.',
        'Морроу нужен дозор на южных подходах, где дым скрывает корабли, пока они не подойдут на выстрел. Встаньте у острова {isle} и несите вахту всю ночь.',
      ],
      d: [
        'Near dawn, far to the south, the sky begins to glow a dull and steady red.',
        'Перед рассветом далеко на юге небо начинает светиться тусклым ровным красным.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['Fire at the Mills', 'Огонь на мельницах'],
      b: [
        'The red in the south is the powder mills burning. Morrow is already at the rail: “Choir’s work. Go, and take whoever lit it.” Grey ships are running from the fire across your bow.',
        'Красное зарево на юге — это горят пороховые мельницы. Морроу уже у борта: «Работа Хора. Идите и возьмите того, кто поджёг». Через ваш курс от пожара уходят серые корабли.',
      ],
      d: [
        'You come into {at} through the smoke too late to save the eastern mill. On the quay, in the ash, lies a small brass bell.',
        'Вы входите в порт {at} сквозь дым — слишком поздно, чтобы спасти восточную мельницу. На пристани, в пепле, лежит маленький медный колокольчик.',
      ],
      s: ['sink:3', 'board:1', 'at:slagport'],
    },
  ],
};
