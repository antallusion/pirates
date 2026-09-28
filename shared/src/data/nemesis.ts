// The nemesis (docs/12 P10 #1, after Shadow of Mordor's): a named pirate who sank a captain, or got away from her,
// remembers her — rises in rank against her, takes a scar and a new name from the meeting ("Crane Two-Fingers"),
// writes to mock her, finds her wake, falls on her caravans. Sunk at last, he pays for it: rich plunder and his
// head in her trophies.

import { namedPirates } from './pirates.ts';
import type { NamedPirate } from './pirates.ts';

type Tr = [string, string];

/** How a meeting ended: it names the scar and the new name. */
export type NemesisCause = 'sank_you' | 'fled' | 'fire' | 'boarding' | 'cannon' | 'ram';
export const NEMESIS_CAUSES: NemesisCause[] = ['sank_you', 'fled', 'fire', 'boarding', 'cannon', 'ram'];

/** The ranks of a grudge, one to five. */
export const NEMESIS_RANKS: Tr[] = [['Grudge', 'Обида'], ['Rival', 'Соперник'], ['Sworn Foe', 'Заклятый враг'], ['Nemesis', 'Немезида'], ['Doom', 'Рок']];
export const NEMESIS_MAX_RANK = 5;
/** Levels over the captain's own a nemesis sails at, by rank (the ladder of levels still rules the fight). */
export const NEMESIS_LEVEL_BONUS = [0, 1, 1, 2, 3, 4];
/** A captain keeps three grudges at most (a new one pushes out the weakest). */
export const NEMESIS_MAX = 3;

/** The new names (nouns, like the Brethren's own: they sit after the surname without a gender to agree with). */
export const EPITHETS: Record<NemesisCause, Tr[]> = {
  sank_you: [['Captain-Drowner', 'Топитель Капитанов'], ['Wreck-Maker', 'Гроза Корпусов'], ['the Undertaker', 'Могильщик']],
  fled: [['the Eel', 'Угорь'], ['Quicksilver', 'Ртуть'], ['Ghost-Wake', 'Призрачный След']],
  fire: [['Scorch-Hide', 'Палёная Шкура'], ['Ash-Hand', 'Пепельная Рука'], ['Smoke', 'Дым']],
  boarding: [['Two-Fingers', 'Два Пальца'], ['One-Ear', 'Одно Ухо'], ['Stitch-Neck', 'Штопаная Шея']],
  cannon: [['Splinter-Cheek', 'Рваная Щека'], ['Iron-Jaw', 'Железная Челюсть'], ['Glass-Eye', 'Стеклянный Глаз']],
  ram: [['Broken-Nose', 'Ломаный Нос'], ['Crooked-Spine', 'Кривой Хребет'], ['Cracked-Skull', 'Треснутый Череп']],
};

/** The scar each kind of meeting leaves (for the dossier). */
export const SCARS: Record<NemesisCause, Tr> = {
  sank_you: ['your ship’s bell, worn at the belt', 'колокол вашего корабля — на поясе'],
  fled: ['a grudge for the chase', 'обида за погоню'],
  fire: ['a burn across the neck', 'ожог через всю шею'],
  boarding: ['fingers left on your deck', 'пальцы, оставленные на вашей палубе'],
  cannon: ['a splinter scar down the cheek', 'шрам от щепы через щёку'],
  ram: ['a nose broken on the rail', 'нос, сломанный о планширь'],
};

/** The first word of a named pirate's name: his surname ("Crane the Knife" → "Crane"). */
export function surnameOf(np: NamedPirate): Tr {
  return [np.name[0].split(' ')[0], np.name[1].split(' ')[0]];
}

/** An epithet by its key ("boarding:0"). */
export function epithetOf(key: string): Tr | undefined {
  const [cause, i] = key.split(':');
  return EPITHETS[cause as NemesisCause]?.[Number(i)];
}

/** A nemesis's name: his surname and the name the meeting gave him. */
export function nemesisName(np: NamedPirate, key: string): Tr {
  const s = surnameOf(np), e = epithetOf(key);
  return e ? [`${s[0]} ${e[0]}`, `${s[1]} ${e[1]}`] : np.name;
}

/** The mocking letters, by what happened (the captain's name in {0}). */
export const NEMESIS_LETTERS: Record<'sank_you' | 'fled' | 'scar', { subject: Tr; body: Tr }[]> = {
  sank_you: [
    { subject: ['Your bell rings for me now', 'Твой колокол теперь звонит для меня'], body: ['Captain {0}, I keep your ship’s bell by my bunk. It rings so sweetly when I think of you. Come and ask for it back.', 'Капитан {0}, колокол твоего корабля висит у моей койки. Он так сладко звонит, когда я думаю о тебе. Приходи, попроси назад.'] },
    { subject: ['How is the water?', 'Как водичка?'], body: ['Captain {0}, I hope the sea was warm. Buy a stouter ship next time — I like a fight that lasts.', 'Капитан {0}, надеюсь, море было тёплым. В следующий раз купи корабль покрепче — люблю долгую драку.'] },
  ],
  fled: [
    { subject: ['Too slow, captain', 'Медленно, капитан'], body: ['Captain {0}, you chase me like a dog chases a cart. Keep practising: one day you might even catch me.', 'Капитан {0}, ты гонишься за мной, как пёс за телегой. Тренируйся: может, когда-нибудь и догонишь.'] },
    { subject: ['Until next time', 'До следующего раза'], body: ['Captain {0}, today I make you a gift of your life. Expect no such kindness when we meet again.', 'Капитан {0}, сегодня я дарю тебе жизнь. При следующей встрече доброты не жди.'] },
  ],
  scar: [
    { subject: ['Your mark on me', 'Твоя метка на мне'], body: ['Captain {0}, your mark is on me. Every morning the mirror says your name. I will mark you back — and deeper.', 'Капитан {0}, твоя метка теперь на мне. Каждое утро зеркало повторяет твоё имя. Я отвечу тем же — и глубже.'] },
    { subject: ['A new name', 'Новое имя'], body: ['Captain {0}, the Brethren call me by a new name now, thanks to you. I mean to make you famous for it too.', 'Капитан {0}, благодаря тебе Братство зовёт меня новым именем. Я собираюсь прославить и тебя.'] },
  ],
};

/** Every line the nemesis speaks, English → Russian (the surnames and new names as names). */
export function nemesisPatterns(): [string, string][] {
  const out: [string, string][] = [...NEMESIS_RANKS];
  // The surnames alone (a nemesis goes by his surname and his new name).
  for (const np of namedPirates()) out.push(surnameOf(np));
  for (const list of Object.values(EPITHETS)) out.push(...list);
  for (const s of Object.values(SCARS)) out.push(s);
  for (const list of Object.values(NEMESIS_LETTERS)) for (const l of list) out.push(l.subject, l.body);
  out.push(
    ['{0} {1}, your nemesis', '{0} {1}, ваш заклятый враг'],
    ['{0} will remember you: a new nemesis.', '«{0}» запомнит вас: у вас новый заклятый враг.'],
    ['Your nemesis {0} {1} rises: {2}.', 'Ваш заклятый враг {0} {1} крепнет: {2}.'],
    ['Your nemesis {0} {1} has found your wake!', 'Ваш заклятый враг {0} {1} идёт по вашему следу!'],
    ['Revenge! {0} {1} goes down at last.', 'Месть! {0} {1} наконец идёт ко дну.'],
    ['WORLD: {0} took revenge on {1} {2}.', 'Вести: капитан {0} свершает месть — {1} {2} на дне.'],
    ['Revenge pays: {0} silver from the cabin.', 'Месть окупается: {0} серебра из капитанской каюты.'],
    ['The head of {0} {1}, your nemesis', 'Голова капитана {0} {1}, вашего заклятого врага'],
    ['{0} {1}, your nemesis, falls on caravan {2} near {3}!', 'Ваш заклятый враг {0} {1} нападает на караван {2} у {3}!'],
  );
  return out;
}
