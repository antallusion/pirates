// «Лоцманская книга», the flags: the three colours, skulls, «Boarding: off», the patent, PvP. Pictures:
// tools/guide/shots-voyage.mjs.
import type { GuideArticle } from './types.ts';

export const ARTICLES: GuideArticle[] = [
  {
    id: 'flags-three',
    section: 'flags',
    title: ['The three flags', 'Три флага'],
    tags: ['flag', 'colours', 'neutral', 'city', 'guild', 'pirate', 'флаг', 'нейтральный', 'город', 'гильдия', 'пиратский'],
    window: 'port:colours',
    summary: [
      'Neutral — quiet scouting with an 85 % free hold. City or guild — peace with the law, fights with pirates and monsters. Pirate — hardcore: rob anyone, and pay with skulls.',
      'Нейтральный — тихая разведка, трюм свободен на 85 %. Город или гильдия — мир с законом, бой с пиратами и чудовищами. Пиратский — хардкор: грабьте кого угодно и платите черепами.',
    ],
    slides: [
      {
        img: 'flags-three-1.webp',
        text: [
          'The flag is chosen in port: the «Colours» chip in the port window\'s second row. Each card says what the flag lets you do; the flying one is marked «Flying».',
          'Флаг выбирают в порту: кнопка «Флаг» во втором ряду окна порта. На каждой карточке написано, что этот флаг разрешает; поднятый отмечен словом «Поднят».',
        ],
        show: { open: 'port:colours', point: '.fl-opts' },
      },
      {
        img: 'flags-three-2.webp',
        text: [
          '«Neutral»: scouting and fishing. Captains leave you alone and you cannot touch captains or peaceful ships; pirates attack only rarely. Only while trade goods fill at most 15 % of the hold — load more and the city flag goes up by itself. Only here «Boarding: off» works against captains.',
          '«Нейтральный»: разведка и промысел. Капитаны вас не трогают, вы — ни капитанов, ни мирных; пираты нападают лишь изредка. Только пока товары занимают не больше 15 % трюма — загрузили больше, и сам поднимется флаг города. Только под ним «Абордаж: выкл.» действует против капитанов.',
        ],
      },
      {
        img: 'flags-three-3.webp',
        text: [
          '«City or guild» — a new captain\'s flag: peace with the law. Merchants, fishers and patrols leave you alone and you them; pirates, monsters and enemy captains attack.',
          '«Город или гильдия» — флаг нового капитана: мир с законом. Купцы, рыбаки и патрули вас не трогают, и вы их; нападают пираты, чудовища и капитаны-враги.',
        ],
      },
      {
        img: 'flags-three-4.webp',
        text: [
          '«Pirate» — hardcore: rob merchants, fishers, patrols and captains. Every victim is a skull. Merchants flee, patrols hunt you; the sea\'s pirates count you as one of theirs until you fire on them.',
          '«Пиратский» — хардкор: грабьте купцов, рыбаков, патрули и капитанов. Каждая жертва — череп. Купцы бегут, патрули охотятся; пираты моря считают вас своим, пока вы их не тронете.',
        ],
      },
      {
        img: 'flags-three-5.webp',
        text: [
          'Tap another flag and it goes up in a minute — but never sooner than 10 minutes after your last fight with a captain. Leave port before that and the order is cancelled. In lawless waters no flag protects anyone.',
          'Тапните по другому флагу — он поднимется через минуту, но не раньше чем через 10 минут после последнего боя с капитаном. Ушли из порта раньше — заказ отменён. В беззаконных водах не защищает никакой флаг.',
        ],
      },
    ],
    related: ['flags-skulls', 'flags-noboard', 'flags-patent'],
  },
  {
    id: 'flags-skulls',
    section: 'flags',
    title: ['Skulls and how to wash them', 'Черепа и как отмыться'],
    tags: ['skulls', 'wanted', 'infamy', 'pardon', 'черепа', 'розыск', 'дурная слава', 'помилование'],
    firstTime: 'first-skull',
    summary: [
      'Under the pirate flag every peaceful victim is a skull. With one, the flag is locked; with two, lawful ports are shut. Wash them by time out of a fight or buy a pardon in a pirate haven.',
      'Под пиратским флагом каждая мирная жертва — череп. С одним флаг не сменить, с двумя закрыты законные порты. Отмываются временем вне боя или помилованием в пиратской гавани.',
    ],
    slides: [
      {
        img: 'flags-skulls-1.webp',
        text: [
          'The badge «☠1», «☠2» by the portrait is your skulls. One comes with the first blow on a merchant, fisher, lawful patrol or a captain who was not fair game. Patrols chase a skulled ship, and lawful harbours near by send ships after her.',
          'Значок «☠1», «☠2» у портрета — ваши черепа. Череп даётся за первый удар по купцу, рыбаку, законному патрулю или капитану, на которого нельзя было нападать. За кораблём с черепами гонятся патрули, а законные гавани поблизости высылают погоню.',
        ],
      },
      {
        img: 'flags-skulls-2.webp',
        text: [
          'While you carry a skull the flag cannot be changed: only the pirate one flies. With two skulls the ports of the Crown, the League and the Harpoon will not let you in.',
          'Пока на вас есть череп, флаг не сменить: только пиратский. С двумя черепами порты Короны, Лиги и Гарпуна вас не пустят.',
        ],
        show: { open: 'port:colours' },
      },
      {
        img: 'flags-skulls-3.webp',
        text: [
          'Time washes them: out of a fight, about 10 minutes a skull. Faster — a pardon, sold in the ports of the Free Harbors, the Fog Brokers and the Red Tide Confederacy: «Buy a pardon» on the flag card clears every skull at once. The price grows with your infamy and level.',
          'Отмывает время: вне боя — около 10 минут на череп. Быстрее — помилование. Его продают в портах Вольных гаваней, Туманных маклеров и Конфедерации Красного прилива: «Купить помилование» на карточке флага снимает все черепа сразу. Цена растёт с дурной славой и уровнем.',
        ],
        show: { open: 'port:colours', point: '[data-pardon]' },
      },
      {
        img: 'flags-skulls-4.webp',
        text: [
          'The same pardon is sold in «Harbour» under «Letters of pardon».',
          'То же помилование продаётся в «Гавани», в разделе «Грамоты о помиловании».',
        ],
        show: { open: 'port:harbour', point: '[data-act="pardon"]' },
      },
    ],
    related: ['flags-three', 'flags-names', 'travel-rules'],
  },
  {
    id: 'flags-noboard',
    section: 'flags',
    title: ['«Boarding: off»', '«Абордаж: выкл.»'],
    tags: ['boarding', 'noboard', 'guns only', 'neutral', 'абордаж', 'выкл', 'нейтральный', 'только пушки'],
    window: 'port:colours',
    summary: [
      'A switch on the flag card: no one boards you and you board no one — guns only. Against captains it works only under the neutral flag.',
      'Переключатель на карточке флага: вас не берут на абордаж, и вы никого — только пушки. Против капитанов действует лишь под нейтральным флагом.',
    ],
    slides: [
      {
        img: 'flags-noboard-1.webp',
        text: [
          'Under the flag cards there is the switch «Boarding: on / off». It is changed only in port and works at once.',
          'Под карточками флагов есть переключатель «Абордаж: вкл. / выкл.». Его меняют только в порту, и он действует сразу.',
        ],
        show: { open: 'port:colours', point: '.fl-board' },
      },
      {
        img: 'flags-noboard-2.webp',
        text: [
          'The note beside it says it: against captains it protects only under the neutral flag (under another flag, switched off, it reads «Not in effect: your flag is not neutral»). Against the sea\'s pirates it works under any flag.',
          'Подпись рядом объясняет: от капитанов он защищает только под нейтральным флагом (под другим, когда абордаж выключен, видно «Не действует: флаг не нейтральный»). Против пиратов моря он работает под любым флагом.',
        ],
      },
      {
        img: 'flags-noboard-3.webp',
        text: [
          'With boarding off, fights are settled by the guns. In lawless waters it does not work at all.',
          'С выключенным абордажем всё решают пушки. В беззаконных водах переключатель не действует совсем.',
        ],
      },
    ],
    related: ['flags-three', 'combat-boarding'],
  },
  {
    id: 'flags-patent',
    section: 'flags',
    title: ['The privateer patent', 'Каперский патент'],
    tags: ['patent', 'privateer', 'marque', 'патент', 'капер', 'каперство'],
    window: 'port:colours',
    summary: [
      'A licence to hunt your city\'s enemies without skulls: sold in the ports of the Crown, the League and the Harpoon, from level 10, for 7 days.',
      'Право охотиться на врагов своего города без черепов: продаётся в портах Короны, Лиги и Гарпуна, с 10-го уровня, на 7 дней.',
    ],
    slides: [
      {
        img: 'flags-patent-1.webp',
        text: [
          'The «Privateer patent» card is on the flag tab of a Crown, League or Harpoon port, while you fly that city\'s flag. You need level 10, no skulls, no oath to the Code, and at least −10 standing with the city.',
          'Карточка «Каперский патент» — на вкладке флага в порту Короны, Лиги или Гарпуна, пока поднят флаг этого города. Нужны 10-й уровень, ни одного черепа, никакой клятвы Кодексу и отношение с городом не ниже −10.',
        ],
        show: { open: 'port:colours', point: '.fl-pat' },
      },
      {
        img: 'flags-patent-2.webp',
        text: [
          '«Buy» — 7 days, renewable up to 14 days ahead. The price grows with your level: 3750 at levels 10–12, 6350 at 19–24, 13 900 at 37–42; marque rank takes up to a fifth off.',
          '«Купить» — 7 дней, продлить можно до 14 дней вперёд. Цена растёт с уровнем: 3750 на 10–12-м, 6350 на 19–24-м, 13 900 на 37–42-м; ранг капера даёт скидку до пятой части.',
        ],
      },
      {
        text: [
          'The rules: 20 % of your prize silver goes to the city, PvP points ×0.75, enemy patrols hunt you within 9 km of their ports and their ports are closed to you. Attack a ship that is neither an enemy nor an ally of your city — that is piracy: the patent burns and you get a skull.',
          'Правила: 20 % добытого серебра уходит городу, очки ПвП ×0,75, вражеские патрули охотятся на вас в 9 км от своих портов, а их порты для вас закрыты. Напали на корабль, который городу ни враг, ни союзник, — это пиратство: патент сгорает, и вы получаете череп.',
        ],
        img: 'flags-patent-3.webp',
      },
    ],
    related: ['flags-three', 'flags-pvp', 'flags-skulls'],
  },
  {
    id: 'flags-pvp',
    section: 'flags',
    title: ['PvP points and the monthly rewards', 'Очки ПвП и награды месяца'],
    tags: ['pvp', 'points', 'season', 'rewards', 'rank', 'пвп', 'очки', 'сезон', 'награды', 'рейтинг'],
    window: 'pvp',
    summary: [
      'Sinking a captain is 10 points, boarding 14, a duel won 5. Each calendar month the top ten get silver, doubloons and titles; everyone with 50+ gets 3000 silver.',
      'Потопить капитана — 10 очков, взять на абордаж — 14, выиграть дуэль — 5. Каждый календарный месяц десятка лучших получает серебро, дублоны и титулы; все, у кого 50+ очков, — 3000 серебра.',
    ],
    slides: [
      {
        img: 'flags-pvp-1.webp',
        text: [
          "The ranking is in the captain's window, under the «PvP» chip: your points, your place and the season's leaders.",
          'Рейтинг — в окне капитана, на кнопке «ПвП»: ваши очки, ваше место и лидеры сезона.',
        ],
        show: { open: 'pvp' },
      },
      {
        img: 'flags-pvp-2.webp',
        text: [
          'Points scale with the victim\'s strength against yours (up to ×2.5); a captain under half your strength gives nothing. The same captain again within a day gives ×1, then ½, then ¼, then nothing. A guild-war kill ×1.5; a helper gets 40 %.',
          'Очки зависят от силы жертвы против вашей (до ×2,5); капитан слабее вас вдвое не даёт ничего. Тот же капитан повторно за сутки — ×1, потом ½, потом ¼, потом ноль. Победа в войне гильдий — ×1,5; помощник получает 40 %.',
        ],
      },
      {
        img: 'flags-pvp-3.webp',
        text: [
          'The season is the calendar month (Moscow time). First place: 30 000 silver, 500 doubloons and the title «Terror of the Seas»; second and third — 25 000 and 22 000 with their titles; places 4–10 from 20 000 down to 5000. You need at least 50 points.',
          'Сезон — календарный месяц по Москве. Первое место — 30 000 серебра, 500 дублонов и титул «Гроза морей»; второе и третье — 25 000 и 22 000 со своими титулами; места 4–10 — от 20 000 до 5000. Нужно хотя бы 50 очков.',
        ],
      },
    ],
    related: ['flags-three', 'flags-patent'],
  },
  {
    id: 'flags-names',
    section: 'flags',
    title: ['Name colours', 'Цвета имён'],
    tags: ['names', 'nameplate', 'colour', 'level', 'имена', 'цвет', 'уровень', 'черепа'],
    summary: [
      'Other captains\' names are blue, a skulled captain\'s are red, and under the pirate flag the level is hidden behind «?».',
      'Имена других капитанов — синие, капитана с черепами — красные, а под пиратским флагом уровень спрятан за «?».',
    ],
    slides: [
      {
        img: 'flags-names-1.webp',
        text: [
          'Over every ship there is her name and level. Other players\' captains are written in bright blue — easy to tell from the sea\'s own ships.',
          'Над каждым кораблём — имя и уровень. Капитаны-игроки подписаны ярко-синим — их легко отличить от кораблей моря.',
        ],
      },
      {
        img: 'flags-names-2.webp',
        text: [
          'Red name — the captain carries skulls: a pirate who has robbed someone. Keep your distance or be ready.',
          'Красное имя — на капитане черепа: это пират, который уже кого-то ограбил. Держитесь подальше или будьте готовы.',
        ],
      },
      {
        img: 'flags-names-3.webp',
        text: [
          'Under the pirate flag the level badge shows «?»: you do not know how strong she is. Open her card (ⓘ) before you start a fight.',
          'Под пиратским флагом вместо уровня — «?»: насколько он силён, не видно. Откройте его карточку (ⓘ), прежде чем ввязываться в бой.',
        ],
      },
    ],
    related: ['flags-skulls', 'combat-ring'],
  },
];
