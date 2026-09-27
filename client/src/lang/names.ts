// Russian names for the places the world generator composes (shared/src/world/worldgen.ts): an island is a
// first part and a second ("Iron" + "reach"), sometimes with a kind after it ("Ironreach Isle"). They are
// transliterated the way the key ports are ("Saltmarrow" — «Солтмарроу»), so a village and its island read
// the same everywhere; the kind after the name is transliterated as well ("Айронрич-Айл") — a Russian word in front
// ("остров") would break the case of every sentence the name sits in ("в остров").

import { lang } from '../i18n.ts';
import { NAME_RU } from './data.ts';

const FIRST: Record<string, string> = {
  Grey: 'Грей', Raven: 'Рейвен', Salt: 'Солт', Widow: 'Видоу', Bell: 'Белл', Cold: 'Колд', Lantern: 'Лантерн', Gallows: 'Гэллоуз', Mourn: 'Морн', Iron: 'Айрон',
  Hush: 'Хаш', Moss: 'Мосс', Whisper: 'Уиспер', Murk: 'Мерк', Veil: 'Вейл', Sallow: 'Сэллоу', Drift: 'Дрифт', Fen: 'Фен', Low: 'Лоу', Silt: 'Силт',
  Cinder: 'Синдер', Ash: 'Эш', Brim: 'Брим', Char: 'Чар', Slag: 'Слэг', Ember: 'Эмбер', Soot: 'Сут', Pyre: 'Пайр', Scorch: 'Скорч', Clinker: 'Клинкер',
  Rime: 'Райм', Frost: 'Фрост', Pale: 'Пейл', White: 'Уайт', Whale: 'Уэйл', Sorrow: 'Сорроу', Hoar: 'Хор', Glass: 'Гласс', Bleak: 'Блик', North: 'Норт',
  Drowned: 'Драунд', Sunk: 'Санк', Saint: 'Сейнт', Hollow: 'Холлоу', Crown: 'Краун', Choir: 'Куайр', Idol: 'Айдол', Altar: 'Олтар', Vesper: 'Веспер',
  Marrow: 'Марроу', Rib: 'Риб', Skull: 'Скалл', Black: 'Блэк', Silent: 'Сайлент', Lightless: 'Лайтлесс', Deep: 'Дип', Grave: 'Грейв', Eyeless: 'Айлесс',
  Dead: 'Дэд', Bleached: 'Бличт', Lost: 'Лост', Wreck: 'Рэк', Last: 'Ласт', Empty: 'Эмпти', Gull: 'Галл', Tern: 'Терн', Drear: 'Дрир',
};

const SECOND: Record<string, string> = {
  rock: 'рок', holm: 'холм', cliff: 'клифф', reach: 'рич', mouth: 'маут', point: 'пойнт', wick: 'вик', stead: 'стед', isle: 'айл', haven: 'хейвен',
  key: 'ки', cay: 'кей', holt: 'холт', islet: 'айлет', shoal: 'шоул', reed: 'рид', mere: 'мир', hollow: 'холлоу', bank: 'бэнк', wisp: 'висп',
  crag: 'крэг', cone: 'коун', vent: 'вент', maw: 'мо', forge: 'фордж', spire: 'спайр', caldera: 'кальдера', scar: 'скар', tooth: 'тут', heap: 'хип',
  berg: 'берг', fjord: 'фьорд', skerry: 'скерри', ness: 'несс', fell: 'фелл', bone: 'боун', shelf: 'шелф', tusk: 'таск', spur: 'спер', drift: 'дрифт',
  chapel: 'чепел', gate: 'гейт', throne: 'троун', arch: 'арч', steps: 'степс', nave: 'нейв', crypt: 'крипт', court: 'корт', tomb: 'тум',
  reef: 'риф', spine: 'спайн', jaw: 'джо', coil: 'койл', teeth: 'тиз', ossuary: 'оссуари', vault: 'волт', rift: 'рифт', pit: 'пит', shell: 'шелл',
  bar: 'бар', stack: 'стэк', mark: 'марк', ledge: 'ледж',
};

const KIND: Record<string, string> = { Isle: 'Айл', Rock: 'Рок', Key: 'Ки', Holm: 'Холм' };

/** Named places that are not composed: the great whirlpools. */
const FIXED: Record<string, string> = {
  "The Widow's Eye": 'Вдовий Глаз',
  'The Gullet': 'Глотка',
  'Saltmouth Drain': 'Солёная Воронка',
  'The Throat': 'Горло',
};

const firstKeys = Object.keys(FIRST).sort((a, b) => b.length - a.length);

/** The Russian name of a generated place, or null when the name is not one of the generator's. */
export function composedNameRu(en: string): string | null {
  if (FIXED[en]) return FIXED[en];
  const m = /^([A-Z][a-z]+)(?: (Isle|Rock|Key|Holm))?(?: (\d+))?$/.exec(en);
  if (!m) return null;
  const word = m[1];
  const first = firstKeys.find((f) => word.startsWith(f));
  const second = first ? SECOND[word.slice(first.length)] : undefined;
  // A key port's own island ("Cinderhold Isle"): the port's Russian name with the kind.
  const known = !second && m[2] ? NAME_RU.get(word) : undefined;
  if (!second && !known) return null;
  const base = known ?? FIRST[first!] + second;
  const named = m[2] ? `${base}-${KIND[m[2]]}` : base;
  return m[3] ? `${named} ${m[3]}` : named;
}

/** People's names, part by part: the officers' first and last names (shared/src/data/crew.ts) and the
 * captains the sea throws up (server/src/game/npc.ts), transliterated the way the playable captains are. */
const PERSON: Record<string, string> = {
  Ansel: 'Ансел', Bram: 'Брам', Cobb: 'Кобб', Dorran: 'Доррен', Edda: 'Эдда', Fenn: 'Фенн', Gideon: 'Гидеон', Hale: 'Хейл', Isolde: 'Изольда',
  Jonas: 'Джонас', Kestrel: 'Кестрел', Lark: 'Ларк', Morrow: 'Морроу', Nell: 'Нелл', Oswin: 'Освин', Pell: 'Пелл', Quint: 'Квинт', Rook: 'Рук',
  Silas: 'Сайлас', Tamsin: 'Тамсин', Ulric: 'Ульрик', Vesper: 'Веспер', Wren: 'Рен', Yarrow: 'Ярроу',
  Blackwater: 'Блэкуотер', Coldharbour: 'Колдхарбор', Drummond: 'Драммонд', Farrow: 'Фарроу', Gault: 'Голт', Holloway: 'Холлоуэй', Ickes: 'Икс',
  Jessop: 'Джессоп', Kell: 'Келл', Lowe: 'Лоу', Marrow: 'Марроу', Nettle: 'Неттл', Orme: 'Орм', Pike: 'Пайк', Quill: 'Квилл', Reeve: 'Рив',
  Salt: 'Солт', Thorne: 'Торн', Umber: 'Амбер', Vane: 'Вейн', Wick: 'Уик', Yeats: 'Йейтс',
  Aldous: 'Олдос', Crane: 'Крейн', Bess: 'Бесс', Marlow: 'Марлоу', Cato: 'Катон', Wrenfield: 'Ренфилд', Dagny: 'Дагни', Holt: 'Холт',
  Esme: 'Эсме', Varga: 'Варга', Fenwick: 'Фенвик', Pryce: 'Прайс', Hester: 'Эстер', Lamb: 'Лэмб', Ivo: 'Иво', Maddox: 'Мэддокс',
  Juno: 'Юнона', Blackwood: 'Блэквуд', Moor: 'Мур', Leda: 'Леда', Frost: 'Фрост', Magnus: 'Магнус', Tarrow: 'Тарроу', Grimsby: 'Гримсби',
  Osric: 'Осрик', Vale: 'Вейл', Petra: 'Петра', Hawthorne: 'Хоторн', Rurik: 'Рюрик', Ash: 'Эш', Reed: 'Рид', Doyle: 'Дойл', Wynn: 'Уинн',
  Carrow: 'Кэрроу', Yara: 'Яра', Stroud: 'Страуд',
};

/** A person's Russian name when every part of it is known ("Morrow Ickes" → «Морроу Икс»), else null. */
export function personNameRu(en: string): string | null {
  const parts = en.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 3) return null;
  const ru = parts.map((p) => PERSON[p]);
  return ru.every(Boolean) ? ru.join(' ') : null;
}

/** A person's name as the reader should see it. */
export function personName(en: string): string {
  return lang() === 'ru' ? personNameRu(en) ?? en : en;
}
