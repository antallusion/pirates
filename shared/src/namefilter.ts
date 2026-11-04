// The name filter (forum post 66, the tester Эдуард, with a chat screenshot of a captain named «ПИДОРАС»: «Сделайте хоть
// какую-то проверку того, как игроки называют своих пиратов»). Every name a player types — her captain's (the account's,
// which is also her forum nickname), her ship's, her guild's and its tag, her companion's, a wonder's, an island's — is
// asked `badName` before it is taken; a refused one gets NAME_BAD («Имя не подходит: выберите другое»). The chat and
// the forum's words are masked word by word through `badWord` (shared/src/chat.ts maskBadWords: never refused).
//
// How a word is read: lowered, ё→е, separators inside it dropped («п.и.д.о.р», «пи_дор»), the letters doubled for show
// collapsed («пииидор»), and then three ways at once — Latin look-alikes as the Cyrillic letters they imitate
// («xуй», «сyка», «3алупа», «6ля»), Latin read by its sound («pidor», «huy», «blyat»), Cyrillic look-alikes as Latin for
// the English list («fцck» is rare, «ѕhit» rarer, but «аss»…). Roots match three ways: anywhere in the word (the long,
// unmistakable ones: пизд, хуй, пидор…), at its start (бля, говн, the еб- family after its prefixes), or only as the whole
// word (сука, жид, fag…), so «команда», «гребля», «рубля», «корабля», «скипидар», «оскорблять», «застрахуй», «сук»,
// «мебель», «хлеб», «Педро», «Dickens», «Scunthorpe», «Yamashita» and «Nazim» pass. A name is also read with its spaces
// taken out («П И Д О Р», «ПИД ОР») against the long roots only. No lookbehind anywhere: Safari before 16.4 cannot parse it.

/** What a refused name is told (the client's Russian: «Имя не подходит: выберите другое»). */
export const NAME_BAD = 'That name will not do: choose another.';

// ------------------------------------------------------------------------------------------ the three readings

/** Latin (and digit) look-alikes of Cyrillic letters, one for one. */
const LOOK_RU: Record<string, string> = {
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', u: 'и', n: 'п', r: 'г',
  '0': 'о', '3': 'з', '6': 'б', '4': 'ч', '@': 'а',
};
/** Latin read by its sound (the digraphs first). */
const SOUND_RU2: [string, string][] = [['sch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ya', 'я'], ['ja', 'я'], ['yu', 'ю'], ['ju', 'ю'], ['yo', 'е'], ['jo', 'е'], ['ye', 'е']];
const SOUND_RU: Record<string, string> = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з', '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а',
};
/** Cyrillic and digit look-alikes of Latin letters (the English list). */
const LOOK_EN: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', и: 'u', п: 'n', г: 'r', ѕ: 's', і: 'i',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i', '|': 'i',
};

/** Lowered, ё as е, and the look-alike digits kept (they are letters here); everything else not a letter dropped. */
function base(raw: string): string {
  return raw.toLowerCase().replace(/ё/g, 'е');
}
const LETTERS = /[^a-zа-я#]/g;
const collapse = (s: string): string => s.replace(/(.)\1+/g, '$1');

function mapEach(s: string, m: Record<string, string>): string {
  let out = '';
  for (const ch of s) out += m[ch] ?? ch;
  return out;
}
function sound(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; ) {
    const two = SOUND_RU2.find(([k]) => s.startsWith(k, i));
    if (two) {
      out += two[1];
      i += two[0].length;
      continue;
    }
    out += SOUND_RU[s[i]] ?? s[i];
    i++;
  }
  return out;
}

/** A word's Russian readings (look-alike and by sound) and its English ones (as typed and look-alike), letters only. */
export function readings(word: string): { ru: string[]; en: string[] } {
  // (an innocent Latin word that would read as a Russian root, «Hue», is cut out first: «#» parts the rest)
  const w = cut(base(word), EN_FINE);
  const ru1 = mapEach(w, LOOK_RU).replace(LETTERS, '');
  const ru2 = sound(w).replace(LETTERS, '');
  const en = mapEach(w, LOOK_EN).replace(LETTERS, '');
  const ru = [...new Set([collapse(ru1), collapse(ru2)])].filter(Boolean);
  return { ru, en: [...new Set([en, collapse(en)])].filter(Boolean) };
}

// ------------------------------------------------------------------------------------------ the roots

/** Russian roots anywhere in a word. */
const RU_ANY = [
  'хуй', 'хуе', 'хуя', 'хуил', 'пизд', 'пезд', 'пидор', 'пидар', 'пидр', 'педик', 'педераст', 'педрил', 'педофил', 'залуп', 'гандон', 'гондон',
  'мудак', 'мудач', 'мудил', 'шлюх', 'шлюш', 'дроч', 'бляд', 'долбоеб', 'долбаеб', 'дерьм', 'сучк', 'сучар', 'сучон', 'гитлер', 'нацис', 'фашис',
  'нигер', 'жидяр', 'жидовк', 'зигхайл', 'ублюд', 'выблядок',
];
/** Russian roots at a word's start. */
const RU_START = ['бля', 'уеб', 'говн', 'гавн', 'жоп', 'сукин', 'мраз', 'дебил', 'минет', 'порн', 'черномаз', 'хуйл'];
/** The еб- family: a prefix (or none), then the root and one of the letters that make it the coarse word. */
const EB_PREFIX = ['', 'на', 'за', 'вы', 'по', 'от', 'отъ', 'оть', 'до', 'при', 'раз', 'разъ', 'рас', 'об', 'объ', 'у', 'въ', 'вь', 'съ', 'сь', 'под', 'подъ', 'долбо', 'долба', 'недо', 'пере', 'изъ', 'вз', 'взъ'];
const EB_NEXT = ['а', 'у', 'л', 'н', 'и', 'ет', 'еш', 'ыр', 'ись', 'ырь'];
/** Russian words refused only whole (each has an innocent longer cousin: «сукно», «жидкий», «хачапури», «бляха» aside). */
const RU_WHOLE = new Set(['сука', 'суки', 'суку', 'суке', 'сукой', 'сучка', 'сучара', 'чмо', 'жид', 'жиды', 'жидов', 'хач', 'хачи', 'чурка', 'чурки', 'пидарас', 'нахер', 'похер']);
/** English roots anywhere. */
const EN_ANY = ['fuck', 'motherf', 'nigg', 'faggot', 'fagot', 'whore', 'bitch', 'asshole', 'ashole', 'dickhead', 'cocksuck', 'pussy', 'pusy', 'penis', 'porn', 'rapist', 'hitler', 'wanker', 'bastard', 'jerkoff', 'siegheil', 'cunt'];
/** English roots at a word's start. */
const EN_START = ['shit', 'slut', 'retard', 'twat', 'cunt'];
/** English words refused only whole. */
const EN_WHOLE = new Set(['fag', 'fags', 'dick', 'dicks', 'cock', 'cocks', 'rape', 'kike', 'spic', 'nazi', 'nazis', 'nazism', 'heil', 'kkk', 'niga', 'nigas', 'niger', 'nigers', 'sex', 'anal', 'cum']);
/** Innocent words that hold a root: cut out before the roots are looked for. */
const RU_FINE = ['страху', 'скипидар', 'педикюр', 'хлеб', 'ебенез', 'оскорбл', 'употребл', 'истребл', 'гребл', 'колебл'];
const EN_FINE = ['scunthorpe', 'hue', 'huey', 'hues', 'shitake', 'shiitake', 'cocktail', 'cockpit', 'peacock', 'hancock', 'dickens', 'pussycat'];
/** The long roots looked for across a name's words run together («П И Д О Р», «ПИД ОР»). */
const RU_SQUASH = ['пизд', 'хуй', 'пидор', 'пидар', 'педераст', 'залуп', 'гандон', 'гондон', 'бляд', 'мудак', 'шлюх', 'дроч', 'гитлер', 'зигхайл', 'ебан', 'ебат', 'ебуч', 'долбоеб'];
const EN_SQUASH = ['fuck', 'nigg', 'hitler', 'whore', 'bitch', 'cunt', 'faggot', 'siegheil'];

function cut(s: string, fine: string[]): string {
  let out = s;
  for (const f of fine) if (out.includes(f)) out = out.split(f).join('#');
  return out;
}

function ruBad(r: string): boolean {
  if (RU_WHOLE.has(r)) return true;
  const s = cut(r, RU_FINE);
  if (RU_ANY.some((x) => s.includes(x))) return true;
  // a start: of the word, or of a part the innocent cut left (never a part inside a word)
  if (RU_START.some((x) => s.startsWith(x))) return true;
  for (const p of EB_PREFIX) {
    if (!s.startsWith(`${p}еб`)) continue;
    const rest = s.slice(p.length + 2);
    if (EB_NEXT.some((n) => rest.startsWith(n))) return true;
  }
  return false;
}
function enBad(e: string): boolean {
  if (EN_WHOLE.has(e)) return true;
  return EN_ANY.some((x) => e.includes(x)) || EN_START.some((x) => e.startsWith(x));
}

/** One word (a run of non-spaces): is it coarse, a slur or a swastika-wearer's, in any of its readings? */
export function badWord(word: string): boolean {
  if ((word.match(/[\p{L}\p{N}@$]/gu) ?? []).length < 3) return false;
  const r = readings(word);
  return r.ru.some(ruBad) || r.en.some(enBad);
}

/** A player's name (a captain's, a ship's, a guild's or its tag, a pet's, a wonder's, an island's): refused when any word
 *  is coarse, when its words run together hold a long root, or when it wears 1488. */
export function badName(raw: string): boolean {
  const name = String(raw ?? '');
  if (/1\W*4\W*8\W*8/.test(name)) return true;
  const words = name.split(/[\s_\-'’.,]+/).filter(Boolean);
  // (separators inside a word are dropped by its readings; spaces and dashes part words, so each is read alone first)
  if (name.split(/\s+/).some(badWord) || words.some(badWord)) return true;
  if (words.length < 2) return false;
  const all = readings(words.join(''));
  const ruCut = all.ru.map((x) => cut(x, RU_FINE));
  return ruCut.some((x) => RU_SQUASH.some((k) => x.includes(k))) || all.en.some((x) => EN_SQUASH.some((k) => x.includes(k)));
}
