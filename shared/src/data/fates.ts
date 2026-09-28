// Crew with fates (docs/12 P10 #11): every officer carries a past; now and then one asks something of the captain —
// a brother's fine in a penal port, a letter home, a goodbye at an old captain's grave, a debt, rum for the lads —
// and remembers whether she did it; one falls in love in a port and pines when the ship stays away; the dead go on
// her island's memorial wall.

type Tr = [string, string];

export type RequestKind = 'brother' | 'letter' | 'grave' | 'debt' | 'rum';
export const REQUEST_KINDS: RequestKind[] = ['brother', 'letter', 'grave', 'debt', 'rum'];

export const PASTS: Tr[] = [
  ['A deserter from a Crown frigate, after a friend was flogged to death.', 'Дезертир с фрегата Короны — не простил, что друга засекли насмерть.'],
  ['A fisher’s child from the Black Coast; the sea took the whole family but one.', 'Дитя рыбаков с Чёрного побережья: море забрало всю семью, кроме одного.'],
  ['Once a League clerk; cooked the books, and ran before the audit.', 'Бывший писарь Лиги: подправил книги и сбежал до ревизии.'],
  ['Pressed into the Navy at fourteen, and never went home.', 'Забран на флот силой в четырнадцать — и домой так и не вернулся.'],
  ['Survived a shipwreck on a raft for eleven days, and does not talk about the ninth.', 'Одиннадцать дней на плоту после крушения — и ни слова о девятом.'],
  ['A preacher’s child who lost the faith in the Drowned Crown.', 'Дитя проповедника — веру потерял в Утонувшей Короне.'],
  ['Sailed with the Brethren of the Coast, until the Code was broken.', 'Ходил с Береговым братством — пока не нарушили Кодекс.'],
  ['Hunted whales off Leviathan Reach; keeps a tooth for luck.', 'Бил китов у Предела Левиафана; носит зуб на удачу.'],
  ['Escaped the penal hulks of Gravesend with a chain still on one ankle.', 'Бежал с каторжных барж Грейвсенда — с цепью на лодыжке.'],
  ['A smuggler’s runner from the Whispering isles, born in the fog.', 'Посыльный контрабандистов с Шепчущих островов, рождён в тумане.'],
  ['A surgeon’s apprentice who could not stand the sight of land.', 'Ученик хирурга, который не выносил вида суши.'],
  ['Won a ship at dice once, and lost it the same night.', 'Однажды выиграл в кости корабль — и проиграл его той же ночью.'],
  ['The last of a ship’s company the Choir took; hears bells at night.', 'Последний из команды, которую забрал Хор; по ночам слышит колокола.'],
  ['A gunsmith’s child from Cinderhold, deaf in one ear from the proving range.', 'Дитя оружейника из Синдерхолда, глух на одно ухо после стрельбища.'],
  ['Crossed the Dead Man’s Expanse in an open boat, and came back alone.', 'Пересёк Простор Мертвеца в открытой шлюпке — и вернулся один.'],
  ['A lighthouse keeper’s child who went to sea to see what the light was for.', 'Дитя смотрителя маяка — ушёл в море посмотреть, для кого горит огонь.'],
];

/** A request in her crew window: {port}, {island} and {n} filled in. */
export const REQUESTS: Record<RequestKind, Tr> = {
  brother: ['My brother rots on the penal hulks at {port}. His fine is {n} silver — pay it when we are there.', 'Мой брат гниёт на каторжной барже в {port}. Штраф за него — {n} серебра; заплатите, когда будем там.'],
  letter: ['Carry my letter to my mother in {port}. Just put in there, that is all.', 'Отвезите моё письмо матери в {port}. Просто зайдите туда — и всё.'],
  grave: ['My old captain lies on {island}. Land a party there, so I can say goodbye.', 'На острове {island} лежит мой старый капитан. Высадите десант — хочу попрощаться.'],
  debt: ['There is a debt of {n} silver on my name in {port}. Unpaid, it means the rope next time.', 'За мной долг — {n} серебра в {port}. Не заплатим — в следующий раз петля.'],
  rum: ['The lads’ saint’s day is coming. Five casks of rum in the hold at the next port, captain?', 'У ребят близится день святого. Пять бочонков рома в трюме к следующему порту, капитан?'],
};

export const LOVERS: string[] = ['Isolde', 'Mercy', 'Nell', 'Tamsin', 'Hester', 'Esme', 'Juno', 'Lark', 'Silas', 'Tobias', 'Jonah', 'Caleb', 'Rook', 'Anne', 'Maud', 'Ezra'];

/** An officer's fate (kept on the officer). */
export interface OfficerFate {
  past: number;
  request: { kind: RequestKind; port?: string; island?: number; n?: number; until: number } | null;
  lastAsk: number;
  love: { port: string; name: string; seen: number } | null;
  pinedAt: number;
}

export const REQUEST_EVERY_DAYS = 2;
export const REQUEST_LASTS_DAYS = 3;
export const LOVE_PINE_DAYS = 7;

export function fatePatterns(): [string, string][] {
  return [
    ['{0} has a favour to ask. (Crew window.)', 'У офицера {0} есть просьба. (Окно команды.)'],
    ['{0} will not forget this.', 'Офицер {0} этого не забудет.'],
    ['{0} is hurt: the favour was forgotten.', 'Офицер {0} обижен: о просьбе забыли.'],
    ['{0} has given their heart to {1} of {2}.', 'Сердце офицера {0} отдано: {1} из {2}.'],
    ['{0} is ashore with {1} tonight: the whole ship is merrier.', 'Офицер {0} сегодня на берегу с {1} — весь корабль повеселел.'],
    ['{0} pines for {1} of {2}.', 'Офицер {0} тоскует по {1} из {2}.'],
    ['Not here.', 'Не здесь.'],
    ['Nothing to do for that one.', 'Для этого офицера делать нечего.'],
  ];
}
