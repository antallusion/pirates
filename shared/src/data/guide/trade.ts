// «Лоцманская книга», trade: markets and prices, the port card, the room goods take, the warehouse, contracts, the
// exchange and the auction, doubloons into silver. Pictures: tools/guide/shots-voyage.mjs.
import type { GuideArticle } from './types.ts';

export const ARTICLES: GuideArticle[] = [
  {
    id: 'trade-market',
    section: 'trade',
    title: ['The market and prices', 'Рынок и цены'],
    tags: ['market', 'prices', 'buy', 'sell', 'trend', 'рынок', 'цены', 'купить', 'продать', 'тенденция'],
    window: 'port:market',
    summary: [
      'Each port has its own prices, and they change every 8 hours. ▲ and ▼ show the trend; luxuries swing the most. Buy cheap here, sell dear there.',
      'В каждом порту свои цены, и меняются они каждые 8 часов. ▲ и ▼ показывают тенденцию; сильнее всего качаются предметы роскоши. Купите дёшево здесь — продайте дорого там.',
    ],
    slides: [
      {
        img: 'trade-market-1.webp',
        text: [
          '«Market» in the port window: a row a good — its picture, what you have aboard, the stock, the buy and sell prices, «Buy» and «Sell». Below are the shot and the ship\'s stores.',
          '«Рынок» в окне порта: строка на товар — картинка, сколько у вас на борту, запас порта, цены покупки и продажи, «Купить» и «Продать». Ниже — снаряды и судовые припасы.',
        ],
        show: { open: 'port:market' },
      },
      {
        img: 'trade-market-2.webp',
        text: [
          '«New prices in …» counts down the price period: every 8 hours each port sets new prices. Supplies move by about ±10 %, staples ±18 %, wares ±22 %, luxuries ±30 %, contraband and rarities ±35 %.',
          '«Новые цены через …» — отсчёт ценового периода: каждые 8 часов каждый порт ставит новые цены. Припасы гуляют примерно на ±10 %, основные товары — на ±18 %, ремесло и военное — на ±22 %, роскошь — на ±30 %, контрабанда и редкости — на ±35 %.',
        ],
      },
      {
        img: 'trade-market-3.webp',
        text: [
          '▲ — dearer than the last period, ▼ — cheaper. Selling back where you bought within 16 hours pays at most 92 % of what you paid: real profit is carried, not flipped. Lawful ports take a duty on sales: the Crown 8 %, the League 5 %, the Harpoon 3 %.',
          '▲ — дороже прошлого периода, ▼ — дешевле. Продать там же, где купили, в течение 16 часов можно не дороже 92 % уплаченного: настоящая прибыль — в перевозке, а не в перепродаже. Законные порты берут пошлину с продаж: Корона 8 %, Лига 5 %, Гарпун 3 %.',
        ],
      },
    ],
    related: ['trade-portcard', 'trade-volume', 'sea-hold'],
  },
  {
    id: 'trade-portcard',
    section: 'trade',
    title: ['The port card and «Market Sense»', 'Карточка порта и «Чутьё рынка»'],
    tags: ['port card', 'prices', 'chart', 'market sense', 'карточка порта', 'цены', 'карта', 'чутьё рынка'],
    summary: [
      'Tap a port on the chart for its card: what it sells and buys, cheap or dear. The «Market Sense» talent shows the exact prices you remember.',
      'Тап по порту на карте открывает его карточку: что продаёт и покупает, дёшево или дорого. Талант «Чутьё рынка» показывает точные цены, которые вы запомнили.',
    ],
    slides: [
      {
        img: 'trade-portcard-1.webp',
        text: [
          'The card of a port: its flag, how safe its waters are, «New prices in …», the passage from it — and at the bottom «Sail here» or «Open the port».',
          'Карточка порта: его флаг, насколько безопасны воды, «Новые цены через …», переходы отсюда — а внизу «Плыть сюда» или «Открыть порт».',
        ],
      },
      {
        img: 'trade-portcard-2.webp',
        text: [
          'Further down: the market («Food & stores», what it sells and buys), the yard, the tavern, your goods in its warehouse. For a port you have visited each good says «cheap», «usual» or «dear». With the trade talent «Market Sense» you see the exact prices you saw there and the trends of every port you know.',
          'Ниже — рынок («Еда и припасы», что продаёт и покупает), верфь, таверна, ваши товары на его складе. Для порта, где вы бывали, у каждого товара стоит «дёшево», «обычно» или «дорого». С торговым талантом «Чутьё рынка» видны точные цены, которые вы там застали, и тенденции всех знакомых портов.',
        ],
      },
    ],
    related: ['trade-market', 'sea-chart'],
  },
  {
    id: 'trade-volume',
    section: 'trade',
    title: ['How much room goods take', 'Сколько места занимает товар'],
    tags: ['volume', 'hold', 'room', 'cargo', 'объём', 'трюм', 'место', 'груз', 'кубометры'],
    summary: [
      'Every good says its room per unit, «m³/unit». Cheap goods are compact, valuable ones bulky: a unit of ambergris takes more than 80 bolts of sailcloth.',
      'У каждого товара написан объём штуки — «м³/шт». Дешёвое компактно, ценное громоздко: одна амбра занимает больше места, чем 80 рулонов парусины.',
    ],
    slides: [
      {
        img: 'trade-volume-1.webp',
        text: [
          'Under the name of a good: «0.9 m³/unit» and so on. Valuable goods take more: spices 0.9, medicine 1.1, pearls 1.8, abyssal ore 2.0, kraken ink 2.5, drowned silk 3.0, ambergris 4.2.',
          'Под названием товара — «0,9 м³/шт» и так далее. Ценное занимает больше: пряности 0,9, лекарства 1,1, жемчуг 1,8, руда бездны 2,0, чернила кракена 2,5, утопленный шёлк 3,0, амбра 4,2.',
        ],
      },
      {
        img: 'trade-volume-2.webp',
        text: [
          'Cheap goods are compact: fish 0.25, salt 0.3, rum 0.55, tobacco 0.65, gunpowder 0.7. Ship\'s stores are smaller still: 0.05 (planks 0.075).',
          'Дешёвое — компактно: рыба 0,25, соль 0,3, ром 0,55, табак 0,65, порох 0,7. Судовые припасы ещё меньше — 0,05 (доски 0,075).',
        ],
      },
      {
        img: 'trade-volume-3.webp',
        text: [
          'The hold\'s figure in the port window\'s head shows the room taken and the whole. Count before you buy: half the hold in trade goods is overload (three quarters on a trader).',
          'Цифра трюма в шапке окна порта показывает, сколько занято и сколько всего. Считайте до покупки: половина трюма в товарах — уже перегруз (на торговом корпусе — три четверти).',
        ],
      },
    ],
    related: ['sea-hold', 'trade-market', 'trade-warehouse'],
  },
  {
    id: 'trade-warehouse',
    section: 'trade',
    title: ['The warehouse', 'Склад'],
    tags: ['warehouse', 'storage', 'holdings', 'склад', 'хранение', 'владения'],
    window: 'port:holdings',
    summary: [
      'A warehouse of 120 m³ in any port: rent is paid once, on the first deposit. «Store all» and «Take all» for each good.',
      'Склад на 120 м³ в любом порту: аренда платится один раз, при первой закладке. «Сложить всё» и «Забрать всё» — для каждого товара.',
    ],
    slides: [
      {
        img: 'trade-warehouse-1.webp',
        text: [
          'The warehouse is under «Holdings» in the port window\'s second row.',
          'Склад — во «Владениях», во втором ряду окна порта.',
        ],
        show: { open: 'port:holdings' },
      },
      {
        img: 'trade-warehouse-2.webp',
        text: [
          'Each good in the hold has «Store all» and «Take all». The first deposit pays the rent: 60 + 24 a level, never more than 300.',
          'У каждого товара в трюме — «Сложить всё» и «Забрать всё». Первая закладка оплачивает аренду: 60 + 24 за уровень, не больше 300.',
        ],
      },
      {
        img: 'trade-warehouse-3.webp',
        text: [
          'The warehouse holds 120 m³. Keep goods there to wait for a better price, to stay under the overload line, or to take the passage with a light hold.',
          'На складе помещается 120 м³. Держите там товар, чтобы дождаться лучшей цены, не уйти в перегруз или взять переход с лёгким трюмом.',
        ],
      },
    ],
    related: ['sea-hold', 'travel-rules', 'trade-exchange'],
  },
  {
    id: 'trade-contracts',
    section: 'trade',
    title: ['Contracts and merchants\' runs', 'Контракты и торговые поручения'],
    tags: ['contracts', 'runs', 'delivery', 'admiralty', 'контракты', 'поручения', 'доставка', 'адмиралтейство'],
    window: 'port:quests',
    summary: [
      '«Quests» → «Contracts»: the port\'s contracts and bounties, the merchants\' runs (buy here, deliver there by the deadline) and the Admiralty\'s board.',
      '«Задания» → «Контракты»: контракты и награды порта, торговые поручения (купить здесь, доставить туда к сроку) и доска Адмиралтейства.',
    ],
    slides: [
      {
        img: 'trade-contracts-1.webp',
        text: [
          'In the port window open «Quests» and the «Contracts» chip: everything for the trader and the hunter on one page.',
          'В окне порта откройте «Задания» и кнопку «Контракты»: всё для торговца и охотника на одной странице.',
        ],
        show: { open: 'port:quests' },
      },
      {
        img: 'trade-contracts-2.webp',
        text: [
          '«Merchants\' runs»: buy the lot here at the market price and bring it there by the deadline. The house pays its price and a bonus for speed — all of it while nearly half the time is left. Deliver, and it offers the next leg; the fifth closes the chain with a present.',
          '«Торговые поручения»: купите партию здесь по рыночной цене и доставьте туда к сроку. Дом платит свою цену и премию за скорость — всю, пока осталось почти полсрока. Доставили — предложат следующий отрезок, а пятый закрывает цепочку подарком.',
        ],
      },
    ],
    related: ['trade-market', 'trade-exchange'],
  },
  {
    id: 'trade-exchange',
    section: 'trade',
    title: ['The exchange and the auction', 'Биржа и аукцион'],
    tags: ['exchange', 'forwards', 'orders', 'bank', 'auction', 'биржа', 'форварды', 'заявки', 'банк', 'аукцион'],
    window: 'port:exchange',
    summary: [
      'In bigger ports the «Exchange»: forwards, buy orders and the bank. In the Free Harbors the trophy auction: 10-minute lots, the house keeps a tenth.',
      'В крупных портах — «Биржа»: форварды, заявки на покупку и банк. В Вольных гаванях — аукцион трофеев: торги по 10 минут, дом берёт десятую часть.',
    ],
    slides: [
      {
        img: 'trade-exchange-1.webp',
        text: [
          '«Exchange» → «Forwards»: lock today\'s price for a good delivered to another port by a deadline. The deposit comes back on full delivery. Lawful exchanges take no plunder.',
          '«Биржа» → «Форварды»: закрепите сегодняшнюю цену за товар, доставленный в другой порт до срока. Залог вернётся при полной поставке. Законные биржи награбленное не принимают.',
        ],
        show: { open: 'port:exchange' },
      },
      {
        img: 'trade-exchange-2.webp',
        text: [
          '«Orders»: put silver down and let other captains bring you the goods; they wait in your warehouse here. An order lives 3 hours, the fee is 2 %.',
          '«Заявки»: внесите серебро в залог — и пусть другие капитаны везут вам товар; доставленное ждёт на вашем складе здесь. Заявка живёт 3 часа, сбор — 2 %.',
        ],
      },
      {
        img: 'trade-exchange-3.webp',
        text: [
          '«Bank»: silver in the bank survives a sinking (a tenth of what you carry goes down with the ship). Withdrawal costs a small fee; a credit is offered too. The bank’s office is only in League ports and the big free ports.',
          '«Банк»: серебро на счёте уцелеет, если вы пойдёте ко дну (десятая часть того, что при вас, тонет вместе с кораблём). Снятие стоит небольшой процент, есть и кредит. Контора банка есть только в портах Лиги и больших вольных портах.',
        ],
      },
      {
        img: 'trade-exchange-4.webp',
        text: [
          '«Auction» in the ports of the Free Harbors: rare pieces on the block for 10 minutes. A bid holds your silver; outbid, it comes back at once. A bid in the last minute adds a minute. The house keeps a tenth of a sale.',
          '«Аукцион» в портах Вольных гаваней: редкие вещи на торгах по 10 минут. Ставка удерживает ваше серебро; перебили — оно сразу вернётся. Ставка в последнюю минуту продлевает торги на минуту. Дом берёт десятую часть продажи.',
        ],
        show: { open: 'port:auction' },
      },
      {
        img: 'trade-exchange-5.webp',
        text: [
          'Each lot shows its piece, its rarity and level, the standing bid and what it is worth to the room. Tap the piece for its card.',
          'У каждого лота — вещь, редкость и уровень, текущая ставка и сколько она стоит для зала. Тап по вещи открывает её карточку.',
        ],
      },
    ],
    related: ['trade-warehouse', 'trade-doubloons'],
  },
  {
    id: 'trade-doubloons',
    section: 'trade',
    title: ['Doubloons into silver', 'Дублоны в серебро'],
    tags: ['doubloons', 'silver', 'exchange', 'shop', 'дублоны', 'серебро', 'обмен', 'лавка'],
    window: 'shop',
    summary: [
      'In the shop «Exchange» turns doubloons into silver at 1 : 200. One way only.',
      'В лавке кнопка «Обмен» меняет дублоны на серебро по курсу 1 : 200. Только в одну сторону.',
    ],
    slides: [
      {
        img: 'trade-doubloons-1.webp',
        text: [
          'Open the shop (the «+» by your doubloons) and press «Exchange» at the top.',
          'Откройте лавку («+» у дублонов) и нажмите «Обмен» наверху.',
        ],
        show: { open: 'shop', point: '[data-pmex]' },
      },
      {
        img: 'trade-doubloons-2.webp',
        text: [
          'Pick how many — 10, 50, 100, 500 or «All» — and press «Exchange». Each doubloon gives 200 silver. Silver cannot be turned back into doubloons.',
          'Выберите сколько — 10, 50, 100, 500 или «Все» — и нажмите «Обменять». Каждый дублон даёт 200 серебра. Обратно серебро в дублоны не меняется.',
        ],
      },
    ],
    related: ['trade-market', 'trade-exchange'],
  },
];
