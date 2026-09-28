// The Flying Dutchman (docs/12 P10 #10): a riddle a week for the whole server. Each day of the week's first five the
// Dutchman is seen somewhere new and leaves a torn page of his log, a green lantern on the water; a captain who sails
// to it takes the page (and her group near her with her). The five pages together name the place where he waits;
// the first to sink him there wins his figurehead and a title. A new riddle every week.

type Tr = [string, string];

export const WEEK_MS = 7 * 86_400_000;
export const DAY_MS = 86_400_000;
export const PAGES = 5;
export const PAGE_R = 250;
export const SHARE_R = 3000;
export const BATTLE_R = 1500;
export const DUTCHMAN_TITLE = 'Dutchman’s Bane';

/** The log's pages: four riddles in turn, the last line naming his island ({isle}). */
export const RIDDLES: Tr[][] = [
  [
    ['I sailed from Amsterdam against God’s own wind,', 'Я вышел из Амстердама против Божьего ветра,'],
    ['and swore to round the Cape though the Last Day came.', 'и поклялся обогнуть Мыс, хоть бы пришёл Судный день.'],
    ['The Day came. I did not round it.', 'День пришёл. Мыс я не обогнул.'],
    ['Now I sail where the drowned keep their bells,', 'Теперь я хожу там, где утопленники хранят свои колокола,'],
    ['and I wait for you off {isle}, when the lantern goes out.', 'и жду тебя у острова {isle}, когда погаснет фонарь.'],
  ],
  [
    ['My crew are bones that still haul the sheets.', 'Моя команда — кости, что всё ещё тянут шкоты.'],
    ['My sails are holes the wind remembers.', 'Мои паруса — дыры, которые помнит ветер.'],
    ['Every seventh year I may touch land,', 'Раз в семь лет мне можно коснуться земли,'],
    ['but no harbour will take my letters.', 'но ни одна гавань не берёт моих писем.'],
    ['Bring me your guns off {isle}, and we shall see who rests.', 'Приведи свои пушки к острову {isle} — и посмотрим, кто обретёт покой.'],
  ],
  [
    ['Who sees my ship will not see port again,', 'Кто увидит мой корабль — не увидит порта,'],
    ['or so the old salts say, and drink.', 'так говорят старые моряки и пьют.'],
    ['I have seen a thousand of them drown.', 'Я видел, как тонут тысячи из них.'],
    ['I have not seen one that could sink me.', 'Я не видел ни одного, кто бы потопил меня.'],
    ['Try, then. Off {isle}. I am patient.', 'Что ж, попробуй. У острова {isle}. Я терпелив.'],
  ],
  [
    ['The storm that took me never ended;', 'Шторм, что забрал меня, так и не кончился;'],
    ['I carry it in my hold like cargo.', 'я везу его в трюме, как груз.'],
    ['I will trade it to whoever asks —', 'Я отдам его любому, кто попросит, —'],
    ['a fair price: their ship for my rest.', 'цена честная: их корабль за мой покой.'],
    ['Come and bargain off {isle}.', 'Приходи торговаться к острову {isle}.'],
  ],
];

export function dutchmanPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const r of RIDDLES) for (const line of r) out.push(line[0].includes('{isle}') ? [line[0].replace('{isle}', '{0}'), line[1].replace('{isle}', '{0}')] : line);
  out.push(
    [DUTCHMAN_TITLE, 'Гроза Голландца'],
    ['The Flying Dutchman', 'Летучий Голландец'],
    ['Van der Decken', 'Ван дер Деккен'],
    ['The Flying Dutchman was seen near {0}: a green lantern burns on the water there.', 'Летучего Голландца видели у острова {0}: там на воде горит зелёный фонарь.'],
    ['A torn page of the Dutchman’s log ({0} of 5).', 'Обрывок вахтенного журнала Голландца ({0} из 5).'],
    ['All five pages: the Dutchman waits off {0}. Go there, and he will come.', 'Все пять обрывков: Голландец ждёт у острова {0}. Идите туда — и он придёт.'],
    ['The Flying Dutchman rises from the sea!', 'Из моря поднимается Летучий Голландец!'],
    ['WORLD: {0} sent the Flying Dutchman to his rest — until next week.', 'Вести: капитан {0} упокоил Летучего Голландца — до следующей недели.'],
    ['The Dutchman’s figurehead is yours.', 'Носовая фигура Голландца — ваша.'],
    ['The Dutchman has gone down this week already; his echo pays you in silver.', 'Голландец на этой неделе уже упокоен; его эхо платит вам серебром.'],
  );
  return out;
}
