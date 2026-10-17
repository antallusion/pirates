// Chapter 4 — The Tide Fair (Act II, The Merchants' Road). Sabine Vosk, the free port's auctioneer; the Choir's bell-charm (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 4,
  region: 'gravewater',
  hub: 'tidewrack',
  title: ['The Tide Fair', 'Приливная ярмарка'],
  blurb: [
    'A free port where everything has a price, a trophy auction, and on its list a little bronze bell that rings by itself when the tide turns. Galt said east; the road east runs through the fair.',
    'Вольный порт, где у всего есть цена, трофейный аукцион, а в его списке — маленький бронзовый колокол, который сам звонит при смене прилива. Галт сказал: на восток. Дорога на восток идёт через ярмарку.',
  ],
  giver: ['Sabine Vosk, auctioneer', 'Сабина Воск, аукционистка'],
  portrait: 'giver_merchant_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['The Road East', 'Дорога на восток'],
      b: [
        'Galt’s journal says east, and to the east lies {region}, where every trade road meets. Jory says that if anyone there has heard of bells, it will be the people who sell everything: the free port of {hub}.',
        'В журнале Галта сказано: на восток, а на востоке лежат воды «{region}», где сходятся все торговые дороги. Джори говорит: если кто там и слышал о колоколах, так это те, кто продаёт всё на свете, — вольный порт {hub}.',
      ],
      d: [
        'Sabine Vosk, who runs the trophy auction of {hub}, hears your story out and smiles like a woman counting money.',
        'Сабина Воск, хозяйка трофейного аукциона в порту {hub}, выслушивает вашу историю и улыбается, как женщина, пересчитывающая деньги.',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['A Seat at the Auction', 'Место на торгах'],
      b: [
        'No one bids at Sabine’s auction without first selling there. She wants a prize: a ship taken fairly and brought before a prize court, with her papers in order.',
        'На торгах Сабины не покупает тот, кто прежде ничего там не продал. Ей нужен приз: корабль, взятый честно и приведённый в призовой суд, с бумагами в порядке.',
      ],
      d: [
        'Your prize fetches a fair price, and Sabine writes your name in her book in red ink.',
        'Ваш приз уходит за хорошую цену, и Сабина вписывает ваше имя в свою книгу красными чернилами.',
      ],
      s: ['board:1', 'prize'],
    },
    {
      t: ['Lot Forty-One', 'Лот сорок первый'],
      b: [
        'Among the lots of the coming sale: a bronze bell no bigger than a fist, which rings by itself when the tide turns. It was consigned by a captain from {port} who wanted no questions asked. Ask them anyway.',
        'Среди лотов будущих торгов — бронзовый колокольчик размером с кулак, который сам звонит при смене прилива. Его сдал на торги капитан из порта {port}, просивший не задавать вопросов. Задайте их всё равно.',
      ],
      d: [
        'In {port} you learn the captain took the bell off a sinking grey-sailed sloop, and has not slept a night through since.',
        'В порту {port} вы узнаёте, что капитан снял колокольчик с тонущего шлюпа под серыми парусами — и с тех пор ни одной ночи не спал спокойно.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Wolves on the Fair Road', 'Волки на ярмарочной дороге'],
      b: [
        'Every merchant sailing to the fair pays the pirates of {region} a toll or goes down. Sabine would like the hall full this year. Clear the road, and she will remember who did it.',
        'Каждый купец, идущий на ярмарку, платит пиратам в водах «{region}» пошлину — или идёт ко дну. Сабина хочет, чтобы в этом году зал был полон. Расчистите дорогу, и она запомнит, кто это сделал.',
      ],
      d: ['Ships come in all week. Sabine raises her glass to you across the auction hall.', 'Всю неделю в гавань входят корабли. Сабина поднимает за вас бокал через весь аукционный зал.'],
      s: ['sink:3:pirate', 'hub'],
    },
    {
      t: ['The Quiet Bidder', 'Тихий покупатель'],
      b: [
        'Three bidders have asked after the bronze bell: a League clerk, Corvin Hale’s quartermaster, and a quiet man in grey whose ship flies no flag. Sabine suggests you meet the quiet one at sea.',
        'О бронзовом колокольчике спрашивали трое: писарь Лиги, квартирмейстер Корвина Хейла и тихий человек в сером, чей корабль не несёт флага. Сабина советует встретиться с тихим в море.',
      ],
      d: [
        'His purse holds a letter of credit on a League bank, for ten times what the bell could ever fetch.',
        'В его кошельке — аккредитив на банк Лиги, в десять раз больше того, что колокольчик мог бы стоить.',
      ],
      s: ['escort', 'board:1'],
    },
    {
      t: ['Sugar for the Purse', 'Сахар для кошелька'],
      b: [
        'The League clerk can outbid you twice over. Sabine, who loves a contest, points you to a cargo of sugar in {port} that a distiller in {port2} wants more than his supper.',
        'Писарь Лиги может перебить вашу ставку вдвое. Сабина, которая любит хорошее состязание, указывает на партию сахара в порту {port}: винокур из порта {port2} хочет её больше, чем ужина.',
      ],
      d: ['The sugar sells at a profit that makes Jory whistle through his teeth.', 'Сахар уходит с такой прибылью, что Джори присвистывает сквозь зубы.'],
      s: ['carry:sugar'],
    },
    {
      t: ['The Quartermaster’s Price', 'Цена квартирмейстера'],
      b: [
        'Hale’s quartermaster, a gloomy giant called Bastien, says his captain will drop out of the bidding if you save the Heron’s men. Pirates ran their boat down this morning, and they are still in the water.',
        'Квартирмейстер Хейла, мрачный великан по имени Бастьен, говорит, что его капитан откажется от торгов, если вы спасёте людей с «Серой цапли». Утром пираты потопили их лодку, и они всё ещё в воде.',
      ],
      d: [
        'Bastien keeps his word, and Hale’s name is struck from the bidders. Hale himself, they say, laughed.',
        'Бастьен держит слово: имя Хейла вычеркнуто из списка покупателей. Сам Хейл, говорят, смеялся.',
      ],
      s: ['sink:2:pirate', 'rescue'],
    },
    {
      t: ['Thieves from the Water', 'Воры со стороны воды'],
      b: [
        'The night before the sale, someone tries Sabine’s vault from the water side. The thieves fled in two boats towards {isle}, and Sabine wants to know who sent them.',
        'В ночь перед торгами кто-то пытается вскрыть хранилище Сабины со стороны воды. Воры ушли на двух лодках к острову {isle}, и Сабина хочет знать, кто их послал.',
      ],
      d: [
        'Their camp holds bell-rope, tallow and a hymn-book of the Choir of the Tide, inscribed in a hand you have seen before.',
        'В их лагере — колокольная верёвка, сало и сборник гимнов Хора Прилива с надписью, сделанной знакомым вам почерком.',
      ],
      s: ['isle', 'land'],
    },
    {
      t: ['Going, Going, Gone', 'Продано!'],
      b: [
        'The hall smells of wet wool and tobacco, and the League clerk bids against you lot by lot. Sabine takes payment in kind, and spices speak louder than promises.',
        'В зале пахнет мокрой шерстью и табаком, и писарь Лиги перебивает вас на каждом лоте. Сабина принимает плату товаром, а пряности говорят громче обещаний.',
      ],
      d: [
        'The hammer falls. The little bell is yours, and the clerk leaves the hall already writing a letter.',
        'Молоток опускается. Колокольчик ваш, и писарь покидает зал, на ходу сочиняя письмо.',
      ],
      s: ['bring:spices'],
    },
    {
      t: ['The Bell That Listens', 'Колокол, который слушает'],
      b: [
        'Jory hangs the little bell over the binnacle and lets no one touch it. At sea it hums as the ship passes certain islands. Sail by {isle} and {isle2}, and watch it.',
        'Джори подвешивает колокольчик над нактоузом и никому не даёт к нему прикасаться. В море он гудит, когда корабль проходит мимо некоторых островов. Пройдите мимо островов {isle} и {isle2} и понаблюдайте.',
      ],
      d: ['Off {isle2} the bell rings so hard it jumps on its cord. Far below, something answers.', 'У острова {isle2} колокольчик звенит так, что прыгает на шнурке. Далеко внизу что-то ему отвечает.'],
      s: ['isle', 'isle2'],
    },
    {
      t: ['What Rings Below', 'Что звенит в глубине'],
      b: [
        'Where the little bell rang loudest, Sabine’s own divers refuse to go down for any money. Send yours.',
        'Там, где колокольчик звенел громче всего, ныряльщики Сабины отказываются спускаться ни за какие деньги. Отправьте своих.',
      ],
      d: [
        'Below lies a League merchantman, her hold full of bronze quarters, her name painted over in grey.',
        'Внизу лежит торговец Лиги: трюм полон бронзовых четвертей, а имя закрашено серой краской.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['The Painted-Over Name', 'Закрашенное имя'],
      b: [
        'Under the grey paint your divers read a League name. The ship was insured at {at}, and someone there was paid well when she sank.',
        'Под серой краской водолазы прочли имя корабля Лиги. Он был застрахован в порту {at}, и кому-то там хорошо заплатили, когда он затонул.',
      ],
      d: [
        'The insurance went to a trading house that does not exist, through a bank that very much does.',
        'Страховка ушла торговому дому, которого не существует, через банк, который существует вполне.',
      ],
      s: ['at:copperhook', 'hub'],
    },
    {
      t: ['A Price on the Bell', 'Цена за колокол'],
      b: [
        'Word has gone round the docks that you carry a bell worth a fortune. Now pirates of {region} who never cared for bells are hunting you for it.',
        'По причалам разошёлся слух, что у вас на борту колокол, стоящий целое состояние. Теперь за вами охотятся пираты из вод «{region}», которым прежде не было дела до колоколов.',
      ],
      d: ['The last captain swears a man in grey paid him in advance, in old Crown silver.', 'Последний капитан клянётся, что человек в сером заплатил ему вперёд — старым серебром Короны.'],
      s: ['sink:3:pirate', 'board:1'],
    },
    {
      t: ['Bread for the Free Port', 'Хлеб для вольного порта'],
      b: [
        'The League clerk has had the free port’s credit stopped, and the grain ships turn back at sea. Sabine needs provisions, and someone to keep the lanes open while the first ships come in.',
        'Писарь Лиги добился, чтобы вольному порту закрыли кредит, и хлебные корабли поворачивают назад. Сабине нужна провизия и кто-то, кто удержит морские пути, пока не придут первые суда.',
      ],
      d: [
        'Bread is back on the stalls. Sabine says she has never owed a captain before, and does not care for it.',
        'Хлеб снова на прилавках. Сабина говорит, что никогда прежде не была в долгу у капитана, и ей это не нравится.',
      ],
      s: ['escort', 'bring:provisions'],
    },
    {
      t: ['The Clerk’s Rendezvous', 'Свидание писаря'],
      b: [
        'The League clerk has left {hub} on a fast cutter, bound not for his bank but for {isle}. Sabine would very much like to know whom he meets there.',
        'Писарь Лиги покинул порт {hub} на быстром катере — и идёт не в свой банк, а к острову {isle}. Сабине очень хочется знать, с кем он там встречается.',
      ],
      d: [
        'He meets a black brig under grey sails. You take his cutter while the brig slips away into the rain.',
        'Его встречает чёрный бриг под серыми парусами. Вы берёте катер, пока бриг уходит в дождь.',
      ],
      s: ['isle', 'board:1'],
    },
    {
      t: ['The Shark-Guarded Cove', 'Бухта под охраной акул'],
      b: [
        'The clerk’s papers name a cove on {isle} where bronze changes hands. On the seaward side sharks gather: the grey boats throw them fish to keep them close.',
        'В бумагах писаря названа бухта на острове {isle}, где бронза переходит из рук в руки. С моря её стерегут акулы: серые лодки подкармливают их рыбой, чтобы те держались рядом.',
      ],
      d: [
        'The cove is empty but for crates marked with a shuttered lantern: the sign of the smugglers of the northern fog.',
        'В бухте пусто, только ящики с меткой — закрытым фонарём, знаком контрабандистов северных туманов.',
      ],
      s: ['beast:shark', 'land'],
    },
    {
      t: ['The Fair Burns', 'Ярмарка в огне'],
      b: [
        'At the turn of the tide the little bell begins to ring and will not stop. Grey sails come out of the rain off {isle}, more than you have ever seen together, and they steer straight for {hub}.',
        'При смене прилива колокольчик начинает звенеть и не умолкает. Из дождя у острова {isle} выходят серые паруса — столько вместе вы ещё не видели, — и они держат курс прямо на порт {hub}.',
      ],
      d: [
        'The raiders are broken and the hall saved. Sabine presses a shuttered brass lantern into your hand: “Show this in the fog. The smugglers will know you.”',
        'Налётчики разбиты, зал спасён. Сабина вкладывает вам в руку медный фонарь с заслонкой: «Покажите его в тумане. Контрабандисты вас узнают».',
      ],
      s: ['isle', 'sink:3', 'board:2', 'hub'],
    },
  ],
};
