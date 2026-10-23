// Russian numerals and their nouns (mid-game QA 2026-10-23: «22 человек» — «22 человека»). The server writes a count in
// English («22 men», «3 days»), the table (server.ts TABLE) gives one Russian word for every number («{0} человек»);
// this puts the noun after a number in the form the number takes: 1 корабль, 2 корабля, 5 кораблей (i18n.ts plural).
// Only where the count is the phrase's subject or object: after a preposition that governs another case («из 22
// человек», «по 5 человек») the table's word is already right and is left alone. A fraction takes the second form
// («1,5 минуты»).

/** The nouns a count is put before: [one, few, many] — any of the three in a line is set to the number's own. */
export const COUNT_WORDS: readonly (readonly [string, string, string])[] = [
  ['человек', 'человека', 'человек'], ['матрос', 'матроса', 'матросов'], ['боец', 'бойца', 'бойцов'], ['моряк', 'моряка', 'моряков'],
  ['пират', 'пирата', 'пиратов'], ['капитан', 'капитана', 'капитанов'], ['пленник', 'пленника', 'пленников'],
  ['корабль', 'корабля', 'кораблей'], ['судно', 'судна', 'судов'], ['шлюпка', 'шлюпки', 'шлюпок'], ['отряд', 'отряда', 'отрядов'],
  ['серебро', 'серебра', 'серебра'], ['монета', 'монеты', 'монет'], ['единица', 'единицы', 'единиц'], ['очко', 'очка', 'очков'],
  ['день', 'дня', 'дней'], ['неделя', 'недели', 'недель'], ['час', 'часа', 'часов'], ['минута', 'минуты', 'минут'], ['секунда', 'секунды', 'секунд'],
  ['раз', 'раза', 'раз'], ['уровень', 'уровня', 'уровней'], ['задание', 'задания', 'заданий'], ['шаг', 'шага', 'шагов'],
  ['остров', 'острова', 'островов'], ['порт', 'порта', 'портов'], ['логово', 'логова', 'логов'], ['зверь', 'зверя', 'зверей'],
  ['кит', 'кита', 'китов'], ['акула', 'акулы', 'акул'], ['косатка', 'косатки', 'косаток'], ['рыба', 'рыбы', 'рыб'],
  ['пушка', 'пушки', 'пушек'], ['ядро', 'ядра', 'ядер'], ['бочка', 'бочки', 'бочек'], ['ящик', 'ящика', 'ящиков'], ['тюк', 'тюка', 'тюков'],
  ['слиток', 'слитка', 'слитков'], ['доска', 'доски', 'досок'], ['мешок', 'мешка', 'мешков'], ['письмо', 'письма', 'писем'],
];

const FORMS = new Map<string, readonly [string, string, string]>();
for (const w of COUNT_WORDS) for (const f of w) if (!FORMS.has(f)) FORMS.set(f, w);
const WORDS = [...FORMS.keys()].sort((a, b) => b.length - a.length).join('|');

/** The prepositions after which a count is in another case (its noun left as the table wrote it). */
const OTHER_CASE = /(?:^|[\s(«„"—])(?:из|от|до|для|без|около|после|кроме|вместо|среди|у|с|со|по|о|об|при|к|ко|над|под|перед|между|сверх|свыше|более|менее|больше|меньше)[\s ]+$/i;

/** The form for a number: one (1, 21, 101…), few (2–4, 22–24…; a fraction), many (0, 5–20, 25…). */
export function countForm(n: string, w: readonly [string, string, string]): string {
  if (/[.,]\d/.test(n)) return w[1];
  const v = Number(n.replace(/[\s  ]/g, ''));
  if (!Number.isFinite(v)) return w[2];
  const m10 = v % 10, m100 = v % 100;
  if (m10 === 1 && m100 !== 11) return w[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return w[1];
  return w[2];
}

/** A Russian line with every counted noun after its number in the number's form. */
export function ruCounts(s: string): string {
  if (!/\d/.test(s)) return s;
  const re = new RegExp(`(\\d{1,3}(?:[\\u00a0\\u202f ]\\d{3})+|\\d+(?:[.,]\\d+)?)([ \\u00a0])(${WORDS})(?![А-Яа-яЁё])`, 'g');
  return s.replace(re, (m, n: string, sp: string, word: string, at: number) => {
    // (a range's or a date's number, a word inside a longer one, another case after its preposition: as written)
    if (OTHER_CASE.test(s.slice(Math.max(0, at - 16), at))) return m;
    if (at > 0 && /[A-Za-zА-Яа-яЁё]/.test(s[at - 1])) return m;
    const w = FORMS.get(word.toLowerCase());
    if (!w) return m;
    const f = countForm(n, w);
    return `${n}${sp}${word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase() ? f[0].toUpperCase() + f.slice(1) : f}`;
  });
}
