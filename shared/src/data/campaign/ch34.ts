// Chapter 34 — The Eye (Act VI, the Abyss). The way to the Eye sung by the Eldest; the Widow puts out the Islands of
// Light one by one; the echo of her husband's flagship; the battle at the Eye's rim (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 34,
  region: 'the_abyss',
  more: ['drowned_crown'],
  hub: 'last_light',
  title: ['The Eye', 'Око'],
  blurb: [
    'The way to the Eye is known at last, and so is the Widow’s plan: put out the Islands of Light one by one until nothing keeps watch on the deep. Her fleet waits at the rim, and her husband’s ship still sails among the echoes.',
    'Путь к Оку наконец известен, а с ним и замысел Вдовы: гасить Острова Света один за другим, пока за глубиной никто не будет присматривать. Её флот ждёт на краю, а среди эха всё ещё ходит корабль её мужа.',
  ],
  giver: ['Aurora Sayle, Master of the Order of the Last Light', 'Аврора Сейл, магистр Ордена Последнего Огня'],
  portrait: 'giver_lighthouse_keeper_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['A Course for the Eye', 'Курс на Око'],
      b: [
        'Aurora has laid Ilse’s song-chart over the soundings you made beyond the Wall, and the two agree to the last fathom. Only the islands nearest the Eye are blank. Fill them in before any ship of hers sails there.',
        'Аврора наложила песенную карту Ильзе на промеры, сделанные вами за Стеной, и они сходятся до последней сажени. Пусты только острова у самого Ока. Нанесите их, прежде чем туда пойдёт хоть один её корабль.',
      ],
      d: [
        'The finished chart looks like a whirlpool drawn in ink, every island turning slowly toward the centre.',
        'Готовая карта похожа на водоворот, нарисованный чернилами: каждый остров медленно поворачивается к центру.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Lights Go Out', 'Огни гаснут'],
      b: [
        'Word comes from the far keepers: the light on {isle} is dark, and the next one is failing. The Widow is putting them out in order, from the edge inward. Land and find out how.',
        'От дальних смотрителей приходит весть: огонь на острове {isle} погас, и следующий слабеет. Вдова гасит их по порядку, от края к центру. Высадитесь и выясните, как она это делает.',
      ],
      d: [
        'The lamp has not been broken. It has been turned, lens to the sky, and the deep below has stopped answering.',
        'Лампа не разбита. Её повернули линзой к небу, и глубина внизу перестала отвечать.',
      ],
      s: ['isle', 'land'],
    },
    {
      t: ['Her Fleet at the Rim', 'Её флот на краю'],
      b: [
        'Aurora wants to see the Widow’s strength with her own eyes, but she will not leave the lamp. Lie off {isle} through a whole watch, count the ships at the rim of the Eye, and do not be seen counting.',
        'Аврора хочет своими глазами увидеть силу Вдовы, но не может оставить огонь. Простойте у острова {isle} целую вахту, пересчитайте корабли на краю Ока и не дайте заметить, что вы считаете.',
      ],
      d: [
        'Forty sail at anchor in a ring, and at the centre the black flagship, with a bell on her quarterdeck as big as a chapel.',
        'Сорок вымпелов на якоре кольцом, а в центре чёрный флагман с колоколом на шканцах размером с часовню.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['Pickets in the Dark', 'Дозоры во тьме'],
      b: [
        'The Widow’s pickets lie between the Islands of Light and her fleet, and every one of them carries a lamp-turner, a man with a key that unlocks a lighthouse lens. Take the pickets, and the keys with them.',
        'Дозорные корабли Вдовы стоят между Островами Света и её флотом, и на каждом есть поворотчик — человек с ключом, отпирающим линзу маяка. Захватите дозоры, а вместе с ними и ключи.',
      ],
      d: [
        'You come back with eleven iron keys on a cord. Aurora hangs them round her own neck.',
        'Вы возвращаетесь с одиннадцатью железными ключами на шнурке. Аврора вешает их себе на шею.',
      ],
      s: ['board:2', 'sink:3'],
    },
    {
      t: ['Sails That Will Not Tear', 'Паруса, которые не рвутся'],
      b: [
        'At the rim of the Eye the wind comes up from below, in gusts that split canvas like paper. Only drowned silk will hold there, Aurora’s sailmakers say, the kind the Crown wove and the sea mends. Bring enough for a suit.',
        'На краю Ока ветер дует снизу, порывами, которые рвут парусину, как бумагу. Там выдержит только утонувший шёлк, говорят парусные мастера Авроры, — тот, что ткала Корона и чинит само море. Привезите его на целый комплект.',
      ],
      d: [
        'The new sails whisper in the lightest air. The crew dislikes the sound, and trusts them anyway.',
        'Новые паруса шепчут при самом слабом ветре. Команде этот звук не нравится, но парусам она верит.',
      ],
      s: ['bring:drowned_silk'],
    },
    {
      t: ['The Besieged Keepers', 'Осаждённые смотрители'],
      b: [
        'Three brothers of the Order have barred themselves in the lighthouse on {isle} with their lamp still burning, and the Widow’s landing party is cutting at the door. Get ashore and bring them off.',
        'Трое братьев Ордена заперлись в маяке на острове {isle}, и огонь у них всё ещё горит, а десант Вдовы рубит дверь. Высадитесь и вывезите их.',
      ],
      d: [
        'The brothers come down the stairs with the lamp’s wick in a tin box, still alight. “It must not go out,” they say, “not even on your ship.”',
        'Братья спускаются по лестнице, неся фитиль лампы в жестяной коробке, всё ещё горящий. «Он не должен погаснуть, — говорят они, — даже на вашем корабле».',
      ],
      s: ['land', 'rescue'],
    },
    {
      t: ['The Admiral’s Echo', 'Эхо адмирала'],
      b: [
        'Among the echoes one ship sails alone: a great three-decker flying the colours of the old Crown, her admiral’s lantern lit. The Widow’s pickets steer clear of her. Aurora thinks you should not.',
        'Среди эха один корабль ходит в одиночестве: огромный трёхпалубник под флагом старой Короны, с зажжённым адмиральским фонарём. Дозоры Вдовы обходят его стороной. Аврора думает, что вам не следует.',
      ],
      d: [
        'On the quarterdeck, nailed to the mast in the admiral’s own hand, is his last order: “Do not ring.”',
        'На шканцах, прибитый к мачте, висит последний приказ адмирала, написанный его рукой: «Не звонить».',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['The Order Nailed to the Mast', 'Приказ на мачте'],
      b: [
        'Aurora reads the admiral’s order over and over. He drowned his own crown, she says, rather than ring the tide, and his widow has spent a hundred years undoing what he died for. His escort still sails. Put it to rest.',
        'Аврора снова и снова перечитывает приказ адмирала. Он утопил собственную корону, говорит она, лишь бы не звонить в прилив, а его вдова сто лет разрушает то, ради чего он погиб. Его конвой всё ещё в море. Упокойте его.',
      ],
      d: [
        'The escort goes down in line ahead, as on parade. The great three-decker alone stays above, waiting for something.',
        'Конвой уходит под воду в кильватерной колонне, как на смотру. Только огромный трёхпалубник остаётся наверху, будто чего-то ждёт.',
      ],
      s: ['sink:3:ghost', 'hub'],
    },
    {
      t: ['Hands and Arms', 'Люди и оружие'],
      b: [
        'For the battle at the rim you will need every boarder you can berth and arms enough for twice that many. Aurora has emptied the Order’s armoury already. Sign on fighting men and bring weapons for them.',
        'Для боя на краю вам понадобятся все абордажники, каких только можно разместить, и оружие на вдвое большее число. Аврора уже опустошила арсенал Ордена. Наберите бойцов и привезите для них оружие.',
      ],
      d: [
        'Your ship rides lower with men and steel. The cook complains, and no one listens.',
        'Корабль осел от людей и стали. Кок ворчит, и его никто не слушает.',
      ],
      s: ['recruit', 'bring:weapons'],
    },
    {
      t: ['Deeper Still', 'Ещё глубже'],
      b: [
        'Near the Eye the pressure doubles. Aurora wants to know whether your doubled keel will bear it before you bet a battle on it. Send divers down along your own hull, and hold the ship over the deep while they look.',
        'У Ока давление удваивается. Аврора хочет знать, выдержит ли ваш двойной киль, прежде чем ставить на него исход боя. Спустите водолазов вдоль собственного корпуса и держите корабль над глубиной, пока они осматривают его.',
      ],
      d: [
        'The keel has bent a finger’s width and held. The old shipwright, when he hears, goes off to get drunk from relief.',
        'Киль прогнулся на палец и выдержал. Старый корабел, услышав это, уходит напиться от облегчения.',
      ],
      s: ['dive', 'escort'],
    },
    {
      t: ['Guardians of the Rim', 'Стражи края'],
      b: [
        'Beasts no one has named circle the rim of the Eye off {isle}, pale and quick, and they go for anything that floats. The Widow’s ships pass among them unharmed. Yours will not, unless you clear the way.',
        'Вокруг края Ока у острова {isle} кружат безымянные звери, бледные и быстрые, и бросаются на всё, что держится на воде. Корабли Вдовы проходят между ними невредимыми. Ваши не пройдут, если не расчистите путь.',
      ],
      d: [
        'They are gone, and on the water floats a scrap of grey wool. The Widow had been feeding them.',
        'Их больше нет, а на воде плавает клочок серой шерсти. Вдова их подкармливала.',
      ],
      s: ['isle', 'beast:any'],
    },
    {
      t: ['A Ringer Who Ran', 'Сбежавший звонарь'],
      b: [
        'A Choir sloop is running from the Widow’s fleet with its own ships firing on it. Aboard is a ringer who knows the order of her line. Take the sloop before her ships do, and bring him to Aurora alive.',
        'Шлюп Хора уходит от флота Вдовы, а по нему палят её же корабли. На борту звонарь, который знает её боевой порядок. Возьмите шлюп раньше, чем это сделают они, и доставьте его к Авроре живым.',
      ],
      d: [
        '“She does not want to drown the world,” the ringer says. “She wants him back. She thinks that is the same thing.”',
        '«Она не хочет утопить мир, — говорит звонарь. — Она хочет вернуть его. Ей кажется, что это одно и то же».',
      ],
      s: ['board', 'hub'],
    },
    {
      t: ['False Stars', 'Ложные звёзды'],
      b: [
        'Above {isle} hang stars that were not there yesterday: lanterns on kites, flown by the Widow’s ships to draw a navigator onto the reefs. It is the oldest trick on the Black Coast. Put them out the old way.',
        'Над островом {isle} висят звёзды, которых вчера не было: фонари на воздушных змеях, их запускают корабли Вдовы, чтобы заманить штурмана на рифы. Это старейший трюк Чёрного побережья. Погасите их по-старому.',
      ],
      d: [
        'One by one the false stars fall into the sea. Jory says it is like being home, and nobody can tell if he is joking.',
        'Ложные звёзды одна за другой падают в море. Джори говорит, что это как дома, и никто не может понять, шутит ли он.',
      ],
      s: ['isle', 'sink:4'],
    },
    {
      t: ['The Widow’s Pilot', 'Лоцман Вдовы'],
      b: [
        'One captain leads the Widow’s ships through the reefs at the rim, a renegade pilot with a price on his head in every port of the Crown. Without him her line will have to feel its way. Hunt him, and take his consort.',
        'Корабли Вдовы через рифы у края ведёт один капитан — лоцман-отступник, за чью голову назначена награда во всех портах Короны. Без него её строю придётся пробираться ощупью. Выследите его и захватите его спутника.',
      ],
      d: [
        'His charts come up in an oilskin wallet. Aurora finds your own soundings copied on them, every one.',
        'Его карты поднимают в промасленном бумажнике. Аврора находит на них ваши собственные промеры, все до единого.',
      ],
      s: ['named', 'board'],
    },
    {
      t: ['Jory Leads the Boarders', 'Джори ведёт абордаж'],
      b: [
        'Jory Penn has come to ask, standing very straight, whether he may lead the boarders. He has been in every fight since Saltmarrow. Give him the cutlass and the first boat, and watch him from the quarterdeck.',
        'Джори Пенн пришёл спросить, вытянувшись в струнку, можно ли ему вести абордажную партию. Он был в каждом бою с самого Солтмарроу. Дайте ему абордажную саблю и первую шлюпку и смотрите на него со шканцев.',
      ],
      d: [
        'Jory takes every ship he goes over the rail of and loses no one. Afterwards he sits on a hatch and cannot stop his hands shaking.',
        'Джори берёт каждый корабль, на который поднимается, и не теряет ни одного человека. Потом садится на люк и никак не может унять дрожь в руках.',
      ],
      s: ['board:3', 'hub'],
    },
    {
      t: ['The Rim of the Eye', 'Край Ока'],
      b: [
        'At the rim the sea slopes downward like the side of a bowl, and a ship can sail it, Aurora says, but not twice. Find the two islands that stand on the very lip, {isle} and {isle2}, and mark a way between them.',
        'На краю море идёт под уклон, как стенка чаши, и корабль может пройти по нему, говорит Аврора, но не дважды. Найдите два острова на самой кромке, {isle} и {isle2}, и отметьте путь между ними.',
      ],
      d: [
        'From {isle2} you can see straight down into the light. It is not one light. It is thousands, turning slowly, like a shoal.',
        'С острова {isle2} видно прямо вниз, в свет. Это не один свет. Это тысячи огней, медленно кружащих, как косяк рыбы.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['The Last Island of Light', 'Последний Остров Света'],
      b: [
        'Only one light still points down into the Eye, on {isle}, and its keeper is a girl of fourteen whose father went to fetch oil and never came back. The Widow’s fleet is coming for it next. Land, and hold it until it is over.',
        'Только один огонь всё ещё смотрит вниз, в Око, — на острове {isle}, и смотритель там девочка четырнадцати лет: её отец уплыл за маслом и не вернулся. Флот Вдовы идёт туда следующим. Высадитесь и удерживайте маяк, пока всё не кончится.',
      ],
      d: [
        'The light holds. The girl will not leave it, and Aurora, who never leaves hers, does not ask her to.',
        'Огонь устоял. Девочка не уходит от него, и Аврора, которая сама никогда не покидает свой, не просит её об этом.',
      ],
      s: ['land:ruins', 'escort'],
    },
    {
      t: ['The Widow Speaks', 'Вдова говорит'],
      b: [
        'A boat with a grey lantern comes out alone and lies off {isle}, and a voice across the water asks for the captain by name. Morwen, the Widow of the Tide, wants to talk before the battle. Go and hear her.',
        'Лодка с серым фонарём выходит одна и ложится в дрейф у острова {isle}, и голос над водой зовёт капитана по имени. Морвен, Вдова Прилива, хочет поговорить перед боем. Подойдите и выслушайте её.',
      ],
      d: [
        '“He is down there, with all of them,” Morwen says. “You would ring them home too, if you had someone there.” Then her lantern goes out.',
        '«Он там, внизу, вместе со всеми, — говорит Морвен. — Вы бы тоже позвонили им домой, будь у вас там кто-нибудь». Потом её фонарь гаснет.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['Battle at the Eye', 'Битва у Ока'],
      b: [
        'At the turn of the tide the Widow’s fleet weighs anchor and comes out of its ring at you, forty sail with the black flagship at the centre. Aurora’s ships hold the lights. Break the line, board its flagships, and keep the rim.',
        'На повороте прилива флот Вдовы снимается с якорей и выходит из кольца прямо на вас: сорок вымпелов, в центре чёрный флагман. Корабли Авроры охраняют огни. Прорвите строй, возьмите на абордаж его флагманы и удержите край.',
      ],
      d: [
        'Her fleet is broken, but the black flagship slips over the rim and down the slope of the bowl. “She will ring at the next tide,” Aurora says.',
        'Её флот разбит, но чёрный флагман перескальзывает через край и уходит вниз по склону чаши. «Она зазвонит со следующим приливом», — говорит Аврора.',
      ],
      s: ['sink:6', 'board:3', 'escort', 'hub'],
    },
  ],
};
