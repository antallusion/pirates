// Chapter 2 — The Bells of Gravesend (Act I, Fog over Saltmarrow). Isolde Marrow, the Admiralty's cartographer (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 2,
  region: 'black_coast',
  hub: 'gravesend',
  title: ['The Bells of Gravesend', 'Колокола Грейвсенда'],
  blurb: [
    'The capital of a thousand bells, a cartographer who keeps what the Admiralty would rather forget, and a rival with a charming smile. Scraps of a black chart are not safe even behind Crown locks.',
    'Столица тысячи колоколов, картограф, хранящая то, о чём Адмиралтейство предпочло бы забыть, и соперник с обаятельной улыбкой. Обрывки чёрной карты не в безопасности даже под замками Короны.',
  ],
  giver: ['Isolde Marrow, Admiralty cartographer', 'Изольда Марроу, картограф Адмиралтейства'],
  portrait: 'giver_cartographer_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['A Letter in Oilcloth', 'Письмо в промасленной ткани'],
      b: [
        'Galt will not leave his coast dark again, so the two scraps of the black chart go to {hub} with you, sewn into oilcloth, with a letter for Isolde Marrow of the Admiralty. Since dawn a grey sail has kept to your wake.',
        'Галт больше не оставит свой берег без огня, поэтому два обрывка чёрной карты отправляются в порт {hub} с вами — зашитые в промасленную ткань, вместе с письмом к Изольде Марроу из Адмиралтейства. С рассвета за вашей кормой держится серый парус.',
      ],
      d: [
        'Isolde Marrow spreads the scraps on her desk and lays a third beside them, older, worn to velvet at the folds.',
        'Изольда Марроу раскладывает обрывки на столе и кладёт рядом третий — старше, истёртый на сгибах до бархата.',
      ],
      s: ['sink:2', 'hub'],
    },
    {
      t: ['The Lords Laugh', 'Лорды смеются'],
      b: [
        'The Lords of the Admiralty call the scraps a fishermen’s tale. Isolde says lords believe only in ink: chart the islands that the black scraps show and the Crown’s charts do not.',
        'Лорды Адмиралтейства называют обрывки рыбацкой байкой. Изольда говорит, что лорды верят только чернилам: нанесите на карту острова, которые есть на чёрных обрывках и которых нет на картах Короны.',
      ],
      d: [
        'Every island you mark is already on the black scraps, drawn two hundred years before you were born.',
        'Каждый отмеченный вами остров уже есть на чёрных обрывках — нарисованный за двести лет до вашего рождения.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Two Dark Lamps', 'Два тёмных маяка'],
      b: [
        'On the night Galt’s light went out, two Crown lighthouses went dark for an hour as well, and their keepers swear nothing happened. Isolde wants their lamps looked at from the sea: {isle} first, then {isle2}.',
        'В ту ночь, когда погас огонь Галта, на час потемнели ещё два маяка Короны, а смотрители клянутся, что ничего не случилось. Изольда хочет, чтобы их фонари осмотрели с моря: сначала на острове {isle}, затем на острове {isle2}.',
      ],
      d: [
        'Both lamps wear a new brass shutter that no Crown fitter put there, stamped with a small bell.',
        'На обоих фонарях новая медная заслонка, которую не ставил ни один мастер Короны, и на ней выбит колокольчик.',
      ],
      s: ['isle', 'isle2', 'hub'],
    },
    {
      t: ['The Keeper Who Ran', 'Сбежавший смотритель'],
      b: [
        'Isolde asks you to land on {isle} and ask its keeper who fitted the shutter. Gently, she says: he is an old man, and old men frighten easily.',
        'Изольда просит высадиться на острове {isle} и спросить смотрителя, кто поставил заслонку. Мягко, говорит она: он старик, а старики пугаются легко.',
      ],
      d: [
        'The lighthouse is empty. You catch the keeper’s boat a mile out, a purse of old Crown silver under the thwart.',
        'Маяк пуст. Лодку смотрителя вы настигаете в миле от берега — под банкой лежит кошель со старым серебром Короны.',
      ],
      s: ['land', 'board:1'],
    },
    {
      t: ['Silver of a Sunken Navy', 'Серебро затонувшего флота'],
      b: [
        'The keeper’s coins were struck for a navy that went down a century ago. Isolde wants to know who in {port} still pays with them, and who is fool enough to take them.',
        'Монеты смотрителя чеканили для флота, ушедшего на дно сто лет назад. Изольда хочет знать, кто в порту {port} до сих пор ими платит и кому хватает глупости их брать.',
      ],
      d: [
        'The trail ends at a money-changer in {port2}, who buys such coins by weight for a buyer who sends a grey boat every new moon.',
        'След приводит к меняле в порту {port2}: он скупает такие монеты на вес для заказчика, который каждое новолуние присылает серую лодку.',
      ],
      s: ['port', 'port2'],
    },
    {
      t: ['Quartered Bells', 'Распиленные колокола'],
      b: [
        'Bell-metal belongs to the Crown: no one may cast or carry it without an Admiralty seal. Yet scrap bronze is leaving the coast by the shipload. Stop the carriers and look under their ballast.',
        'Колокольная бронза принадлежит Короне: без печати Адмиралтейства её нельзя ни лить, ни возить. И всё же медный лом уходит с побережья целыми трюмами. Остановите перевозчиков и загляните под балласт.',
      ],
      d: [
        'Under the shingle lie broken bells, sawn into quarters so that they cannot ring.',
        'Под галечным балластом лежат разбитые колокола, распиленные на четверти, чтобы не звенели.',
      ],
      s: ['board', 'sink:2'],
    },
    {
      t: ['The Bronze Road', 'Бронзовый путь'],
      b: [
        'One carrier slipped away to the east. Isolde asks you to keep to the sea lanes of {region} and watch where the next one runs.',
        'Один перевозчик ускользнул на восток. Изольда просит держаться морских путей в водах «{region}» и проследить, куда пойдёт следующий.',
      ],
      d: [
        'It anchors off {isle} at dusk and unloads into a cave with a grey cloth hung over its mouth.',
        'В сумерках он бросает якорь у острова {isle} и разгружается в пещеру, вход в которую завешен серой тканью.',
      ],
      s: ['escort', 'isle'],
    },
    {
      t: ['Behind the Grey Cloth', 'За серой тканью'],
      b: [
        'The cave on {isle} is a smugglers’ store, and in the dunes behind it nests something the smugglers feed and nobody else goes near. Go ashore by night.',
        'Пещера на острове {isle} — склад контрабандистов, а в дюнах за ней гнездится что-то, что они подкармливают и к чему больше никто не подходит. Высадитесь ночью.',
      ],
      d: [
        'Crates of bronze, and an order in a clerk’s hand: deliver to Admiralty Warehouse Seven.',
        'Ящики бронзы и накладная, написанная рукой писаря: «Доставить в Седьмой склад Адмиралтейства».',
      ],
      s: ['land:smugglers', 'lair'],
    },
    {
      t: ['The Grey Heron', 'Серая цапля'],
      b: [
        'A brig with a heron on her flag has been everywhere you go, always a day ahead. Her captain, Corvin Hale, sends word: he would like to meet you off {isle}, guns run in, like gentlemen.',
        'Бриг с цаплей на флаге побывал везде, куда вы ходили, и всякий раз на день раньше. Его капитан, Корвин Хейл, передаёт: он хотел бы встретиться с вами у острова {isle} — с убранными пушками, как подобает джентльменам.',
      ],
      d: [
        'Hale doffs his hat, praises your ship, and asks, as if in passing, how many scraps Isolde keeps.',
        'Хейл снимает шляпу, хвалит ваш корабль и словно невзначай спрашивает, сколько обрывков хранит Изольда.',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['Hale’s Wager', 'Пари Хейла'],
      b: [
        'Hale bets a cask of brandy that he can take more of the Widow’s tenders than you before the tide turns. Isolde says let him, and watch what he does with what he takes.',
        'Хейл ставит бочонок бренди на то, что до смены прилива возьмёт больше тендеров Вдовы, чем вы. Изольда говорит: пусть, а вы смотрите, что он сделает с добычей.',
      ],
      d: [
        'Hale wins by a single boat, and keeps every letter he found aboard to himself.',
        'Хейл выигрывает с перевесом в одну лодку — и все письма, найденные на борту, оставляет себе.',
      ],
      s: ['board:2', 'sink:2'],
    },
    {
      t: ['Guns for the Lighthouse', 'Пушки для маяка'],
      b: [
        'Isolde has won one thing from the Lords: a gun crew for the lighthouse at {port2}. The guns wait in {port}; the Lords forgot to pay for the carriage.',
        'Изольда всё-таки кое-чего добилась от лордов: на маяк в порту {port2} поставят пушечный расчёт. Пушки ждут в порту {port}, а оплатить перевозку лорды забыли.',
      ],
      d: ['The guns are mounted by nightfall. The keeper of {port2} sleeps in his boots.', 'К ночи пушки стоят на местах. Смотритель в порту {port2} спит не разуваясь.'],
      s: ['carry:weapons'],
    },
    {
      t: ['Warehouse Seven', 'Седьмой склад'],
      b: [
        'Warehouse Seven belongs to the Crown’s dockyard at {at}. Its ledgers say it holds rope. Isolde asks you to put in and count what it truly holds.',
        'Седьмой склад принадлежит верфи Короны в порту {at}. По книгам там хранится канат. Изольда просит зайти туда и пересчитать, что лежит на самом деле.',
      ],
      d: [
        'No rope at all: two hundred quarters of bell-bronze, signed for by Commissioner Thale, a Lord of the Admiralty.',
        'Каната нет и в помине: двести четвертей колокольной бронзы, за которые расписался комиссар Тейл, один из лордов Адмиралтейства.',
      ],
      s: ['at:bellhaven', 'hub'],
    },
    {
      t: ['The Commissioner’s Sloop', 'Шлюп комиссара'],
      b: [
        'A Lord of the Admiralty cannot be touched without proof. Thale’s sloop leaves for the islands every second night, and Isolde wants his strongbox open on her desk before he misses it.',
        'Лорда Адмиралтейства без доказательств не тронешь. Шлюп Тейла уходит к островам каждую вторую ночь, и Изольда хочет увидеть его сундук открытым на своём столе раньше, чем он хватится пропажи.',
      ],
      d: [
        'In the strongbox: a letter in a woman’s hand, signed M., thanking him for “the sea’s own metal.”',
        'В сундуке письмо, написанное женской рукой и подписанное буквой «М»: благодарность «за металл, принадлежащий морю».',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['The Widow’s Name', 'Имя Вдовы'],
      b: [
        'The hand matches a letter in the Admiralty archive: Morwen, widow of the last admiral of a drowned empire, whose flagship went down off {isle}. Isolde wants to know what lies there now.',
        'Почерк совпадает с письмом из архива Адмиралтейства: Морвен, вдова последнего адмирала утонувшей империи, чей флагман затонул у острова {isle}. Изольда хочет знать, что лежит там сейчас.',
      ],
      d: [
        'In the admiral’s sunken cabin the divers find a bell-rope, cut through not a month ago.',
        'В затопленной каюте адмирала водолазы находят колокольную верёвку, перерезанную не больше месяца назад.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['Singing on the Water', 'Пение над водой'],
      b: [
        'Another merchantman has struck the rocks near {isle}, steering for a light that should not be there. Her men cling to the wreck, and they swear they heard singing over the water.',
        'Ещё один торговец разбился о скалы у острова {isle}, держа курс на огонь, которого там быть не должно. Его люди цепляются за обломки и клянутся, что слышали над водой пение.',
      ],
      d: [
        'The bosun hums what they heard: three slow notes, like a bell-rope pulled by many hands. Jory goes white; he heard the same the night his ship was lost.',
        'Боцман напевает услышанное: три медленные ноты, будто колокольную верёвку тянут много рук. Джори бледнеет: он слышал то же самое в ночь, когда погиб его корабль.',
      ],
      s: ['isle', 'rescue'],
    },
    {
      t: ['The Commissioner Runs', 'Бегство комиссара'],
      b: [
        'Warned by someone, Commissioner Thale has slipped out of {hub} aboard a grey-sailed cutter with an escort. If he reaches the fog, Isolde’s proof goes with him.',
        'Кто-то предупредил комиссара Тейла, и он ускользнул из порта {hub} на катере под серым парусом, с охраной. Если он доберётся до тумана, вместе с ним уйдут и доказательства Изольды.',
      ],
      d: ['Thale is brought back in irons. He says only that the Widow will want her metal back.', 'Тейла привозят в кандалах. Он говорит лишь одно: Вдова захочет вернуть свой металл.'],
      s: ['sink:3', 'board:1', 'hub'],
    },
    {
      t: ['Hale Makes an Offer', 'Предложение Хейла'],
      b: [
        'Corvin Hale waits in a tavern in {port} and offers to buy the scraps at any price you care to name. Isolde says go, refuse him, and see who he drinks with afterwards.',
        'Корвин Хейл ждёт в таверне в порту {port} и предлагает купить обрывки за любую цену, какую вы назовёте. Изольда говорит: поезжайте, откажите и посмотрите, с кем он будет пить после.',
      ],
      d: [
        'He takes the refusal with a smile, and leaves arm in arm with the night watchman of the Admiralty archive.',
        'Отказ он принимает с улыбкой — и уходит под руку с ночным сторожем архива Адмиралтейства.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Fire in the Archive', 'Пожар в архиве'],
      b: [
        'At midnight grey boats slip into {hub}, and the Admiralty archive goes up in flames. Isolde runs for the scraps; you are to meet the raiders at the harbour mouth and catch whoever runs for {isle}.',
        'В полночь в порт {hub} проскальзывают серые лодки, и архив Адмиралтейства вспыхивает. Изольда бежит спасать обрывки, а вам нужно встретить налётчиков у входа в гавань и перехватить того, кто уйдёт к острову {isle}.',
      ],
      d: [
        'The raiders are beaten, but off {isle} you find only a wake, and in the archive one scrap is gone. On the desk: a heron’s feather and a note, “Borrowed. C. H.”',
        'Налётчики разбиты, но у острова {isle} вы находите лишь кильватерный след, а в архиве недостаёт одного обрывка. На столе — перо цапли и записка: «Взял на время. К. Х.»',
      ],
      s: ['sink:3', 'board:2', 'isle', 'hub'],
    },
  ],
};
