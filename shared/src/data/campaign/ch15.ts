// Chapter 15 — The Ice Fortress (Act III, The Northern Waters). With Hale's charts of the pack, the sealers, the clans
// and the whalers come together under the captain's flag and storm the Bell-Warden's ice fortress; he breaks out on his
// flagship with the bell of the fjord and makes for the Order's walled town (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 15,
  region: 'leviathan_reach',
  hub: 'sealhold',
  title: ['The Ice Fortress', 'Ледяная крепость'],
  blurb: [
    'Turf huts on the ice shelf, sealskins on every frame, and beyond the seal grounds a fortress of ice that the north took for a tale. The masked man is in it, and so is the bell of the fjord.',
    'Землянки на ледовом шельфе, тюленьи шкуры на каждой раме, а за лежбищами — ледяная крепость, которую север считал сказкой. В ней человек в маске, а с ним и колокол фьорда.',
  ],
  giver: ['Agna Strell, headwoman of the sealers', 'Агна Стрелл, старшина зверобоев'],
  portrait: 'giver_fishwife_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['Raiders on the Shelf', 'Налётчики на шельфе'],
      b: [
        'You come into {hub} with Hale’s charts and find the sealers’ boats burning on the shingle. A raider with an iron bow is backing off the shelf, her deck full of stolen sealskins. Take her before she reaches the pack.',
        'Вы входите в порт {hub} с картами Хейла и видите, что лодки зверобоев горят на гальке. Налётчик с железным форштевнем отходит от шельфа, палуба завалена крадеными шкурами. Возьмите его, пока он не ушёл во льды.',
      ],
      d: [
        'Agna Strell wipes the soot from her hands with snow. “They come every week now. Tell me those charts show where from.”',
        'Агна Стрелл оттирает сажу с рук снегом. «Теперь они приходят каждую неделю. Скажите, что на этих картах видно — откуда».',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['Wool Against the Frost', 'Шерсть от мороза'],
      b: [
        'Your southern crew is losing fingers to the frost, and Agna will not send a single sealer out beside men who cannot hold a line. Bring cloth to {hub}, and her women will sew it into something fit for the ice.',
        'Ваша южная команда теряет пальцы на морозе, а Агна не отправит ни одного зверобоя рядом с людьми, которые не удержат линь. Привезите в порт {hub} сукно, и её женщины сошьют из него то, в чём можно ходить по льду.',
      ],
      d: [
        'Your crew go about in sealskin and wool, and the sealers stop calling them “the southerners” — almost.',
        'Ваша команда ходит в тюленьих шкурах и шерсти, и зверобои почти перестают звать их «южанами».',
      ],
      s: ['bring:cloth'],
    },
    {
      t: ['The Abandoned Grounds', 'Брошенные лежбища'],
      b: [
        'The best seal grounds lie on {isle}, and no sealer has gone there since the ice began to ring. Agna wants to know whether the herds are coming back, or whether something holds the grounds.',
        'Лучшие лежбища — на острове {isle}, и с тех пор как лёд зазвонил, туда не ходил ни один зверобой. Агна хочет знать, возвращаются ли стада, или лежбища кто-то держит.',
      ],
      d: [
        'The grounds are empty, and across them runs a sledge road, swept smooth, leading north towards the pack.',
        'Лежбища пусты, а через них тянется санный путь, гладко выметенный, — на север, ко льдам.',
      ],
      s: ['land:seals', 'hub'],
    },
    {
      t: ['Bears on the Floe', 'Медведи на льдине'],
      b: [
        'The sledge road passes the floes of {isle}, where the white bears have made their dens closer to the shore than ever before. Nothing passes there now without a fight. Clear the way for Agna’s sledges.',
        'Санный путь проходит мимо льдин острова {isle}, где белые медведи устроили логова ближе к берегу, чем когда-либо. Теперь там ничто не пройдёт без боя. Расчистите дорогу для саней Агны.',
      ],
      d: [
        'Behind the dens lie broken sledges of the masked man’s men and a crate of new saw-blades, never used.',
        'За логовами — разбитые сани людей человека в маске и ящик новых пильных полотен, ещё не тронутых.',
      ],
      s: ['lair', 'land'],
    },
    {
      t: ['Orcas at the Ice Edge', 'Косатки у кромки льда'],
      b: [
        'At the ice edge orcas are tipping sealers off the floes, working in pairs, as if someone had taught them. Two of Agna’s boats are in the water now. Drive the orcas off and pull the men out.',
        'У кромки льда косатки сталкивают зверобоев с льдин — работают парами, будто кто-то их выучил. Две лодки Агны уже в воде. Отгоните косаток и вытащите людей.',
      ],
      d: [
        'Agna counts her men twice. All of them are here. She says nothing, but she brings you her own knife.',
        'Агна дважды пересчитывает своих людей. Все на месте. Она ничего не говорит, но приносит вам свой нож.',
      ],
      s: ['beast:orca', 'rescue'],
    },
    {
      t: ['Men of the North', 'Люди севера'],
      b: [
        'For an assault on walls of ice you need men who know how to cut steps in it. The young sealers of {hub} will go with you, if Agna says so. She says so, and adds: bring them back.',
        'Для штурма ледяных стен нужны люди, умеющие вырубать в них ступени. Молодые зверобои порта {hub} пойдут с вами, если Агна скажет. Она говорит — и добавляет: «Верните их».',
      ],
      d: [
        'They come aboard with ice-axes over their shoulders and seal-oil lamps on their belts, and they sing as they come.',
        'Они поднимаются на борт с ледорубами на плечах и жировыми лампами на поясах — и идут с песней.',
      ],
      s: ['recruit', 'hub'],
    },
    {
      t: ['The Walls of Ice', 'Ледяные стены'],
      b: [
        'Hale’s charts show a way through the pack past {isle} to {isle2}, where the fortress should stand. Sail as close as you dare and see the walls with your own eyes, without being seen.',
        'Карты Хейла показывают проход через льды мимо острова {isle} к острову {isle2}, где должна стоять крепость. Подойдите так близко, как решитесь, и осмотрите стены своими глазами, оставаясь незамеченными.',
      ],
      d: [
        'Walls of blue ice twice a mast high, with guns behind them, and above the gate a bell-frame, empty, waiting.',
        'Стены синего льда высотой в две мачты, за ними пушки, а над воротами — пустая звонница, которая чего-то ждёт.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['The Water Gate', 'Водяные ворота'],
      b: [
        'Agna’s grandfather spoke of a water gate under every ice fortress, where the sea comes in under the walls. Send divers down beneath the shelf and find it.',
        'Дед Агны рассказывал, что под каждой ледяной крепостью есть водяные ворота, где море заходит под стены. Спустите водолазов под шельф и найдите их.',
      ],
      d: [
        'The divers find the water gate, barred with chain, and inside the dark under the walls a slow bell, rung by no one.',
        'Водолазы находят водяные ворота, заложенные цепью, а внутри, в темноте под стенами, медленно звонит колокол, в который никто не бьёт.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['Powder Through the Pack', 'Порох сквозь льды'],
      b: [
        'Ice does not burn, but it breaks. The powder for the walls lies at {port}, and the assault fleet is gathering at {port2}. Carry it through the pack, and keep it dry.',
        'Лёд не горит, но ломается. Порох для стен лежит в порту {port}, а флот штурма собирается в порту {port2}. Проведите его сквозь льды и сохраните сухим.',
      ],
      d: [
        'The kegs are unloaded wrapped in sealskin. Not one has taken a drop of water.',
        'Бочонки выгружают, завёрнутые в тюленьи шкуры. Ни один не набрал ни капли воды.',
      ],
      s: ['carry:gunpowder'],
    },
    {
      t: ['The Ice-Cutters’ Convoy', 'Конвой ледорезов'],
      b: [
        'Every week a convoy of iron-bowed cutters runs from the fortress to the open sea and back, bringing food and bronze. Break the convoy, take one cutter whole, and Agna will learn from her crew how the fortress eats.',
        'Каждую неделю из крепости к открытому морю и обратно идёт конвой ледорезов с железными форштевнями — везёт еду и бронзу. Разбейте конвой, возьмите один ледорез целым, и Агна узнает от его команды, чем кормится крепость.',
      ],
      d: [
        'The fortress eats from the south: grain and salt from the Widow’s grey ships, brought in every new moon.',
        'Крепость кормится с юга: зерно и соль везут серые корабли Вдовы, каждое новолуние.',
      ],
      s: ['board:1', 'sink:2'],
    },
    {
      t: ['Oil for the Fire-Pots', 'Жир для огненных горшков'],
      b: [
        'Agna has an old sealers’ trick: clay pots of burning oil, thrown onto the walls, so the ice runs and the guns slip in their beds. She needs whale oil, a great deal of it, at {hub}.',
        'У Агны есть старая хитрость зверобоев: глиняные горшки с горящим жиром, которые бросают на стены, — лёд течёт, и пушки съезжают со своих мест. Ей нужен китовый жир, и много, в порт {hub}.',
      ],
      d: [
        'The women of the shelf fill the pots by lamplight and seal them with tallow, a hundred in a night.',
        'Женщины шельфа наполняют горшки при свете ламп и запечатывают их салом — по сотне за ночь.',
      ],
      s: ['bring:whale_oil'],
    },
    {
      t: ['The Whalers Come North', 'Китобои идут на север'],
      b: [
        'Gunnar Teal promised his harpooners for the day the north rose. Sail to {at} and tell him the day is close, then see his whaleboats through the pack in one piece.',
        'Гуннар Тил обещал своих гарпунёров на тот день, когда поднимется север. Плывите в порт {at}, скажите ему, что день близок, и проведите его вельботы через льды целыми.',
      ],
      d: [
        'Gunnar stands in the first boat with his father’s harpoon. “I said I would remember who fed the town,” he says.',
        'Гуннар стоит в первом вельботе с отцовским гарпуном. «Я говорил, что запомню, кто кормил город», — говорит он.',
      ],
      s: ['at:harpoon_rest', 'escort'],
    },
    {
      t: ['The Envoy’s Pledge', 'Слово посланницы'],
      b: [
        'Ingrid Holm promised the clans’ warriors, but the clans will not move until their pledge is spoken before the Order. Carry Agna’s word to {at} and stand beside Ingrid while she speaks.',
        'Ингрид Хольм обещала воинов кланов, но кланы не двинутся, пока их слово не прозвучит перед Орденом. Отвезите весть от Агны в порт {at} и встаньте рядом с Ингрид, пока она говорит.',
      ],
      d: [
        'The Order’s commander hears the pledge and adds one of his own: if the masked man runs, the gates of the fjord will be shut against him.',
        'Командор Ордена выслушивает клятву и добавляет свою: если человек в маске побежит, ворота фьорда для него закроют.',
      ],
      s: ['at:frostgate', 'hub'],
    },
    {
      t: ['Grain from the Grey Ships', 'Зерно серых кораблей'],
      b: [
        'It is the new moon, and the Widow’s grey ships are coming north with grain and salt for the fortress. A fortress that does not eat does not fight. Starve it.',
        'Новолуние, и серые корабли Вдовы идут на север с зерном и солью для крепости. Крепость, которая не ест, не воюет. Заморите её голодом.',
      ],
      d: [
        'The grain goes to Agna’s storehouses. Among the grey ship’s papers: “The Warden is to hold the bell until the Widow sends for it.”',
        'Зерно уходит на склады Агны. Среди бумаг серого корабля: «Звонарю держать колокол, пока Вдова не пришлёт за ним».',
      ],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['The Fortress Paymaster', 'Казначей крепости'],
      b: [
        'The masked man pays his garrison through a pirate the Hunters’ Guild has wanted for years, who sails from the fortress each month with an empty chest and comes back with a full one. Sink him, and the garrison goes unpaid.',
        'Человек в маске платит гарнизону через пирата, которого Гильдия охотников разыскивает много лет: тот каждый месяц выходит из крепости с пустым сундуком и возвращается с полным. Потопите его — и гарнизон останется без жалованья.',
      ],
      d: [
        'The chest goes down with him. Agna says hungry men grumble, but unpaid men open gates.',
        'Сундук уходит на дно вместе с ним. Агна говорит, что голодные ворчат, а те, кому не платят, открывают ворота.',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['Ladders and Rams', 'Лестницы и тараны'],
      b: [
        'Nothing on the shelf is long enough to make a scaling ladder, but your island has timber and a forge. Lay out a yard there for ice-hooks, ladders and a ram with an iron head.',
        'На шельфе нет ничего достаточно длинного для штурмовой лестницы, а на вашем острове есть лес и кузня. Заложите там мастерскую для ледовых крючьев, лестниц и тарана с железной головой.',
      ],
      d: [
        'The ram is finished by the clans’ warriors, who carve its name into the beam: “Long Winter’s End”.',
        'Таран доделывают воины кланов и вырезают на бревне его имя: «Конец долгой зимы».',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['Planks for the Skin-Boats', 'Доски для кожаных лодок'],
      b: [
        'Agna’s skin-boats will carry the sealers to the foot of the walls, but their frames have cracked in the cold. Bring planks to {hub} so they can be rebuilt before the leads close.',
        'Кожаные лодки Агны довезут зверобоев до подножия стен, но их каркасы потрескались на морозе. Привезите в порт {hub} доски, чтобы лодки успели перебрать, пока не сомкнулись разводья.',
      ],
      d: [
        'Twenty skin-boats lie on the shingle, new-framed and stretched, light enough for two men to carry.',
        'На гальке лежат двадцать кожаных лодок с новыми каркасами — каждую могут унести двое.',
      ],
      s: ['bring:planks'],
    },
    {
      t: ['The Hunters’ Net', 'Сеть охотников'],
      b: [
        'The fortress knows a fleet is gathering. Its hunters are spreading through the leads to cut off any ship that strays from the rest. Keep the leads open and sink whoever closes them.',
        'Крепость знает, что собирается флот. Её охотники расходятся по разводьям, чтобы перехватывать всякий корабль, отбившийся от своих. Держите разводья открытыми и топите тех, кто их закрывает.',
      ],
      d: [
        'The net is torn. The hunters who are left draw back behind the walls, and the leads stay open behind them.',
        'Сеть порвана. Уцелевшие охотники уходят за стены, а разводья за ними остаются открытыми.',
      ],
      s: ['sink:3:hunter', 'escort'],
    },
    {
      t: ['Lanes Through the Pack', 'Проходы во льдах'],
      b: [
        'Hale’s charts are good, but the pack has moved since he bought them. Before the fleet sails, chart the islands that have come free of the ice, so no ship is caught in a dead end under the guns.',
        'Карты Хейла хороши, но с тех пор, как он их купил, льды сдвинулись. Пока флот не вышел, нанесите на карту острова, освободившиеся ото льда, чтобы ни один корабль не попал в тупик под пушками.',
      ],
      d: [
        'Agna sets your chart beside Hale’s and nods slowly. “Now it is ours,” she says.',
        'Агна кладёт вашу карту рядом с картой Хейла и медленно кивает. «Теперь она наша», — говорит она.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Watchtower', 'Сторожевая башня'],
      b: [
        'On {isle} the old ruins of a Crown watchtower look down over the approaches, and the masked man keeps a lookout there with a signal bell. Land quietly and silence it before the fleet sails past.',
        'На острове {isle} стоят руины старой сторожевой башни Короны, откуда видны все подходы, и человек в маске держит там дозорного с сигнальным колоколом. Высадитесь тихо и заглушите его, прежде чем мимо пройдёт флот.',
      ],
      d: [
        'The lookout is bound, and Jory stuffs the bell’s mouth with a sealskin mitten. It will not ring tonight.',
        'Дозорный связан, а Джори затыкает колоколу пасть тюленьей рукавицей. Этой ночью он не зазвонит.',
      ],
      s: ['isle', 'land:ruins'],
    },
    {
      t: ['Eve of the Assault', 'Канун штурма'],
      b: [
        'On the last night the fortress sends out its guard-ships to break up the fleet before dawn. Agna’s sealers row out with lamps to light them for your guns. Go over their rails before they reach the skin-boats.',
        'В последнюю ночь крепость высылает сторожевые корабли, чтобы разбить флот до рассвета. Зверобои Агны выходят на вёслах с лампами, подсвечивая их для ваших пушек. Сойдитесь с ними борт о борт, пока они не добрались до кожаных лодок.',
      ],
      d: [
        'The guard-ships are yours. In the grey before dawn the walls of the fortress stand silent, as if listening.',
        'Сторожевые корабли ваши. В сером предрассветье стены крепости стоят безмолвно, будто прислушиваются.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['Storm the Ice Fortress', 'Штурм ледяной крепости'],
      b: [
        'At dawn the fire-pots arc over the walls of {isle}, the ram breaks the water gate, and the sealers cut steps into the ice under fire. Take the ships in the fortress harbour and put your people over the walls.',
        'На рассвете огненные горшки летят через стены острова {isle}, таран вышибает водяные ворота, а зверобои под огнём вырубают ступени во льду. Возьмите корабли в гавани крепости и пустите своих людей через стены.',
      ],
      d: [
        'The fortress is yours, but the bell-frame is empty: the masked man broke out on his flagship with the bell of the fjord, and he is running for the Order’s gates.',
        'Крепость ваша, но звонница пуста: человек в маске прорвался на флагмане с колоколом фьорда и уходит к воротам Ордена.',
      ],
      s: ['isle', 'board:3', 'land', 'hub'],
    },
  ],
};
