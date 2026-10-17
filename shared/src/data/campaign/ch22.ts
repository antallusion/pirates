// Chapter 22 — Brimstone Bay (Act IV, Ash and the Code). The Choir falls on the Ashen Isles; the Code and the
// wreck-fleet meet it in a great sea battle; the Crown's frigates come over the horizon (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 22,
  region: 'ashen_isles',
  hub: 'brimstone_bay',
  title: ['Brimstone Bay', 'Серная Бухта'],
  blurb: [
    'Yellow terraces of sulphur, the best powder on the sea, and a grey fleet coming over the horizon to burn it all. The Code has its powder and its wreck-fleet. Now it must fight.',
    'Жёлтые террасы серы, лучший порох на всём море и серый флот, идущий из-за горизонта, чтобы всё это сжечь. У Кодекса есть порох и флот обломков. Теперь ему предстоит драться.',
  ],
  giver: ['Hask Morrow, captain of the Code', 'Хаск Морроу, капитан Кодекса'],
  portrait: 'giver_smuggler_m',
  more: ['dead_mans_expanse'],
  reward: { ammo: true },
  quests: [
    {
      t: ['Grey on the Horizon', 'Серое на горизонте'],
      b: [
        'Hask Morrow meets the wreck-fleet on the sulphur quay with a spyglass in one hand and a lit pipe in the other. The Choir’s scouts have been sighted off {isle}. He wants them blind before their fleet comes up.',
        'Хаск Морроу встречает флот обломков на серной пристани с подзорной трубой в одной руке и раскуренной трубкой в другой. У острова {isle} заметили разведчиков Хора. Он хочет ослепить их прежде, чем подойдёт их флот.',
      ],
      d: [
        'The scouts go down, but one of them fired a rocket first. Grey smoke hangs over the sea where it burst.',
        'Разведчики идут на дно, но один из них успел пустить ракету. Там, где она лопнула, над морем висит серый дым.',
      ],
      s: ['isle', 'sink:2'],
    },
    {
      t: ['Off the Terraces', 'Прочь с террас'],
      b: [
        'The diggers’ families live on the open terraces of {isle}, where the first broadside will fall. Morrow wants them taken off before the Choir arrives. They will not leave without their goats.',
        'Семьи копателей живут на открытых террасах острова {isle}, куда упадёт первый же залп. Морроу хочет снять их до прихода Хора. Без своих коз они уходить не желают.',
      ],
      d: [
        'The last boat leaves the terraces loaded to the gunwales with children, grandmothers and goats.',
        'Последняя лодка отходит от террас, по самый планширь гружённая детьми, бабками и козами.',
      ],
      s: ['land:fishers', 'hub'],
    },
    {
      t: ['Bettany’s Powder', 'Порох Беттани'],
      b: [
        'Bettany Crake has a powder ship waiting at {at}, and the line of battle will need every cask of it. Put in, take your orders from her, and fill the bay’s magazines.',
        'У Беттани Крейк в порту {at} ждёт пороховое судно, и боевой линии понадобится каждый бочонок. Зайдите в порт, получите у неё указания и заполните погреба бухты.',
      ],
      d: [
        'The magazines are full to the roof. Bettany chalks “For the Choir” on every cask.',
        'Погреба забиты под самый потолок. На каждом бочонке Беттани пишет мелом: «Для Хора».',
      ],
      s: ['at:slagport', 'bring:gunpowder'],
    },
    {
      t: ['Hulks for Fire', 'Корпуса для огня'],
      b: [
        'Morrow wants fireships, and he wants them made from the Choir’s own hulls. Their supply ships are already in the outer islands. Take them whole and bring them in to be packed with sulphur.',
        'Морроу нужны брандеры, и сделать их он хочет из корпусов самого Хора. Их суда снабжения уже у внешних островов. Возьмите их целыми и приведите в бухту, чтобы набить серой.',
      ],
      d: [
        'The captured hulls lie in the bay, stinking of brimstone, with their grey sails still bent.',
        'Захваченные корпуса стоят в бухте, воняя серой, а их серые паруса так и не сняты.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['A Levy for the War', 'Военный сбор'],
      b: [
        'The Code levies a war tribute from every merchant in its waters, and Morrow says the merchants should be glad: if the Choir wins, it will take everything. Collect the levy, and keep the sea-lanes while you do.',
        'Кодекс взимает военную дань с каждого купца в своих водах, и Морроу говорит, что купцам впору радоваться: если победит Хор, он заберёт всё. Соберите сбор и держите морские пути, пока собираете.',
      ],
      d: [
        'One old merchant pays double and asks only that you sink a Choir ship for him.',
        'Один старый купец платит вдвойне и просит лишь потопить за него один корабль Хора.',
      ],
      s: ['tribute', 'escort'],
    },
    {
      t: ['Eyes in the Smoke', 'Глаза в дыму'],
      b: [
        'The Choir has sent more scouts, and they are using the cone’s smoke to come close. Morrow wants every one of them on the bottom before they can count the wreck-fleet.',
        'Хор выслал ещё разведчиков, и те подходят вплотную, прячась в дыму вулкана. Морроу хочет, чтобы все они легли на дно, прежде чем пересчитают флот обломков.',
      ],
      d: [
        'The smoke clears. For the first time in a week, nothing grey is watching the bay.',
        'Дым рассеивается. Впервые за неделю за бухтой не следит ничего серого.',
      ],
      s: ['sink:3', 'hub'],
    },
    {
      t: ['Into the Line', 'Встать в линию'],
      b: [
        'The last ships of the wreck-fleet are coming in from the open sea, slow and low in the water. Nils Kettle is aboard the hindmost and swears she will make it. Bring them in under your guns.',
        'Последние корабли флота обломков подходят из открытых вод, медленные и низко сидящие. Нильс Кеттл на самом последнем и клянётся, что тот дойдёт. Проведите их под прикрытием своих пушек.',
      ],
      d: [
        'The hindmost ship drops anchor and starts to settle at once. Kettle wades ashore laughing.',
        'Последний корабль бросает якорь и тут же начинает садиться. Кеттл со смехом бредёт к берегу по пояс в воде.',
      ],
      s: [['escort', 'Bring the last of the wreck-fleet in for {n} min.', 'Проводите последние корабли флота обломков: {n} мин.'], 'hub'],
    },
    {
      t: ['A Chain Across the Bay', 'Цепь через бухту'],
      b: [
        'Morrow means to close the bay with a chain, as the Order once closed its fjord. The iron is waiting at {port}, and the smiths at {port2} have the forge hot for the links.',
        'Морроу хочет закрыть бухту цепью, как когда-то орден закрыл свой фьорд. Железо ждёт в порту {port}, а кузнецы в порту {port2} уже раскалили горн для звеньев.',
      ],
      d: [
        'The chain is hauled across on floats and made fast. Morrow spits on it for luck.',
        'Цепь протягивают через бухту на поплавках и крепят. Морроу на удачу плюёт на неё.',
      ],
      s: ['carry:iron', 'hub'],
    },
    {
      t: ['The Bell Ship', 'Колокольный корабль'],
      b: [
        'Ahead of the Choir’s fleet sails a ship that carries nothing but a great bell, and she has anchored off {isle} to ring it. Ottilie’s lens in the flagship hums at every stroke. Silence her.',
        'Впереди флота Хора идёт корабль, на котором нет ничего, кроме огромного колокола, и он встал у острова {isle}, чтобы звонить. Линза Оттилии на флагмане гудит при каждом ударе. Заставьте его замолчать.',
      ],
      d: [
        'The bell is a copy, cast in the Code’s own stolen bronze. It was ringing to lead the fleet in.',
        'Колокол — подделка, отлитая из украденной бронзы Кодекса. Он звонил, чтобы привести флот.',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['A Price on the Vanguard', 'Цена за авангард'],
      b: [
        'The Choir has bought pirate captains to lead its vanguard, and the hunters have posted a price on the worst of them. Morrow wants his ship gone before the line can form behind him.',
        'Хор купил пиратских капитанов вести свой авангард, и охотники назначили награду за худшего из них. Морроу хочет, чтобы его корабля не стало, прежде чем за ним выстроится линия.',
      ],
      d: [
        'With their leader sunk, two of the bought captains turn their ships around and sail home.',
        'Когда их вожак уходит на дно, двое купленных капитанов разворачивают корабли и уходят домой.',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['Pirates in the Sulphur Smoke', 'Пираты в серном дыму'],
      b: [
        'Free pirates who never kept the Code have smelled the war and come to pick over the bay. They raid the powder lighters in the yellow smoke from the terraces. Hold the water and sink them.',
        'Вольные пираты, никогда не чтившие Кодекс, учуяли войну и слетелись поживиться в бухте. Они нападают на пороховые лихтеры в жёлтом дыму с террас. Удержите воду и потопите их.',
      ],
      d: [
        'The lighters come through. The surviving pirates offer to join the Code. Morrow takes them.',
        'Лихтеры проходят. Уцелевшие пираты просятся в Кодекс. Морроу их берёт.',
      ],
      s: ['escort', 'sink:2:pirate'],
    },
    {
      t: ['A Battery on Your Island', 'Батарея на вашем острове'],
      b: [
        'Your hidden island lies on the road the Choir must take to reach the bay. Morrow asks you to raise a battery there, so the grey fleet will have to pass under your guns before it ever sees his.',
        'Ваш тайный остров лежит на пути, которым Хору придётся идти к бухте. Морроу просит поставить там батарею, чтобы серый флот прошёл под вашими пушками раньше, чем увидит его собственные.',
      ],
      d: [
        'The battery is dug into the cliff. From the parapet you can see the whole southern sea.',
        'Батарея врыта в утёс. С бруствера видно всё южное море.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Lint and Laudanum', 'Корпия и лауданум'],
      b: [
        'The surgeons of the Code have one chest of medicine between forty ships, and the battle has not even begun. Morrow says a man who knows he will be patched up fights twice as hard.',
        'У лекарей Кодекса один сундук лекарств на сорок кораблей, а битва ещё даже не началась. Морроу говорит: тот, кто знает, что его залатают, дерётся вдвое злее.',
      ],
      d: [
        'The chests go out to every ship. The surgeons start laying out their tables in the cockpits.',
        'Сундуки расходятся по всем кораблям. Лекари начинают расставлять столы в кубриках.',
      ],
      s: ['bring:medicine'],
    },
    {
      t: ['The Approaches', 'Подходы к бухте'],
      b: [
        'Morrow wants to fight on ground he knows, and the cone has thrown up new rocks in the approaches since the last chart was drawn. Chart them, so the Code’s ships can use them and the Choir’s cannot.',
        'Морроу хочет драться там, где знает каждый камень, а вулкан со времени последней карты поднял на подходах новые скалы. Нанесите их на карту, чтобы корабли Кодекса могли ими пользоваться, а корабли Хора — нет.',
      ],
      d: [
        'Morrow studies your chart and smiles a slow, unpleasant smile. “There. We take them there.”',
        'Морроу изучает вашу карту и медленно, недобро улыбается. «Вот здесь. Здесь мы их и возьмём».',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Morrow’s Wager', 'Пари Морроу'],
      b: [
        'Morrow bets you a cask of his best rum that you cannot take more Choir ships in a day than he can. The Choir’s outriders are already in the outer islands. The wager stands.',
        'Морроу ставит бочонок лучшего рома на то, что за день вы не возьмёте больше кораблей Хора, чем он. Передовые дозоры Хора уже у внешних островов. Пари в силе.',
      ],
      d: [
        'Morrow pays the cask without argument, and drinks half of it with you on the spot.',
        'Морроу без споров отдаёт бочонок и тут же выпивает с вами половину.',
      ],
      s: ['board:2', 'sink:2'],
    },
    {
      t: ['Landing on the Yellow Isle', 'Высадка на жёлтом острове'],
      b: [
        'The Choir has put men ashore on {isle} to burn the sulphur works from the land side. Their camp is on the beach below the terraces, and their boats are still drawn up. Sail in close and land.',
        'Хор высадил людей на острове {isle}, чтобы сжечь серные промыслы с суши. Их лагерь — на берегу под террасами, и лодки ещё вытащены на песок. Подойдите вплотную и высаживайтесь.',
      ],
      d: [
        'The camp is taken, its torches unlit. The sulphur works will not burn tonight.',
        'Лагерь взят, факелы так и не зажжены. Сегодня ночью серные промыслы не сгорят.',
      ],
      s: ['isle', 'land:pirate_camp'],
    },
    {
      t: ['Out of the Burning Water', 'Из горящей воды'],
      b: [
        'A Code sloop caught fire in the outer islands, and her crew went over the side into water where the burning sulphur floats. Pull them out before the fire spreads across the swell.',
        'В дальних островах загорелся шлюп Кодекса, и команда бросилась за борт — в воду, где плавает горящая сера. Вытащите их, пока огонь не разошёлся по волнам.',
      ],
      d: [
        'The sloop’s crew come aboard singed and coughing, and ask at once for another ship.',
        'Команда шлюпа поднимается на борт опалённой и кашляющей и сразу просит другой корабль.',
      ],
      s: ['rescue', 'hub'],
    },
    {
      t: ['The Last Convoy Out', 'Последний конвой'],
      b: [
        'The merchants still in the bay want to leave before the battle, and Morrow will not have it said the Code let them die. Gather their convoy at {port} and see it clear of the islands.',
        'Купцы, что ещё остались в бухте, хотят уйти до битвы, а Морроу не допустит, чтобы о Кодексе говорили, будто он дал им погибнуть. Соберите их конвой в порту {port} и выведите его из островов.',
      ],
      d: [
        'The convoy clears the islands at dusk. Behind it, the sea to the east is full of grey sails.',
        'В сумерках конвой выходит из островов. За ним море на востоке полно серых парусов.',
      ],
      s: ['port', 'escort'],
    },
    {
      t: ['The Night Before', 'Ночь перед битвой'],
      b: [
        'No one sleeps on the night before the battle. Jory Penn sits on the capstan and sings the old songs of the coast, and the drowned men’s crew joins in. Keep the watch until dawn.',
        'В ночь перед битвой никто не спит. Джори Пенн сидит на шпиле и поёт старые песни побережья, а команда утопленников подхватывает. Несите вахту до рассвета.',
      ],
      d: [
        'At dawn the singing stops. Across the water, very faint, a bell answers it.',
        'На рассвете пение смолкает. Над водой, очень тихо, ему отвечает колокол.',
      ],
      s: ['escort', 'hub'],
    },
    {
      t: ['The Choir’s Vanguard', 'Авангард Хора'],
      b: [
        'The grey vanguard comes in on the morning wind and runs straight onto the rocks you charted. Morrow lets the fireships go. Finish what the rocks and the fire begin, and take their leading ship.',
        'Серый авангард идёт с утренним ветром и прямо выносится на нанесённые вами скалы. Морроу пускает брандеры. Довершите то, что начали скалы и огонь, и возьмите их головной корабль.',
      ],
      d: [
        'The vanguard is broken on the rocks and burning. Behind it, the Choir’s main line is already forming.',
        'Авангард разбит о скалы и горит. За ним уже выстраивается главная линия Хора.',
      ],
      s: ['sink:4', 'board:1'],
    },
    {
      t: ['The Battle of the Bay', 'Битва в бухте'],
      b: [
        'The Choir’s line comes on in grey, forty sails, with bells ringing from every masthead. The Code and the wreck-fleet go to meet it, and Morrow puts you in the centre. “Break their middle,” he says, “and the rest will run.”',
        'Линия Хора идёт серой стеной — сорок парусов, и с каждой мачты бьют колокола. Кодекс и флот обломков выходят навстречу, и Морроу ставит вас в центр. «Проломите им середину, — говорит он, — и остальные побегут».',
      ],
      d: [
        'The Choir’s line breaks and flees into the smoke. And over the northern horizon come the white sails of the Crown: Admiral Cassius Drey has come to talk.',
        'Линия Хора ломается и бежит в дым. А из-за северного горизонта выходят белые паруса Короны: адмирал Кассий Дрей пришёл говорить.',
      ],
      s: ['escort', 'sink:6', 'board:2', 'hub'],
    },
  ],
};
