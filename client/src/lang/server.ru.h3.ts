// The server's lines of docs/17 H3 (the Heroes' economy), English → Russian: the week, the dwellings and recruiting,
// the island's town and market, the mines and their flags, the admin's replies. The names the sentences carry (the
// weeks, the town's buildings, the mines, the kinds of men) are here too, for the sentences' parts.

import { WEEKS } from '../../../shared/src/data/week.ts';
import { TOWN } from '../../../shared/src/data/town.ts';
import { MINES } from '../../../shared/src/data/mines.ts';

const names: Record<string, string> = {};
for (const w of Object.values(WEEKS)) {
  names[w.name[0]] = w.name[1];
  names[w.text[0]] = w.text[1];
}
for (const t of Object.values(TOWN)) for (const n of t.names) names[n[0]] = n[1];
for (const m of Object.values(MINES)) names[m.name[0]] = m.name[1];

export const SERVER_RU_H3: Record<string, string> = {
  ...names,
  // The kinds of men, as a sentence counts them.
  'deckhands': 'юнги',
  'seasoned sailors': 'бывалые матросы',
  'marines': 'морпехи',
  'sea guards': 'морская гвардия',
  'musketeers': 'мушкетёры',
  'sharpshooters': 'меткие стрелки',
  'gunners': 'канониры',
  'bombardiers': 'бомбардиры',
  'boarders': 'абордажники',
  'cutthroats': 'головорезы',
  'officers’ guards': 'офицерская гвардия',
  'life guards': 'лейб-гвардия',
  'drowned': 'утопленники',
  'spawn of the deep': 'порождения бездны',
  // 10. the week
  'Week {0} begins: {1}. {2}': 'Началась неделя {0}: {1}. {2}',
  'Week {0}, day {1}: {2}. Next week in {3} min.': 'Неделя {0}, день {1}: {2}. Следующая неделя через {3} мин.',
  // 11. dwellings and recruiting
  'Bring your ship to the island to take the men aboard.': 'Подведите корабль к острову, чтобы взять людей на борт.',
  'No dwelling of theirs here.': 'Здесь нет их жилища.',
  'Only an upgraded dwelling trains those.': 'Таких готовит только улучшенное жилище.',
  'Only a captain of the Choir or of a cursed ship keeps the drowned.': 'Утопленники служат только капитанам Хора и проклятым кораблям.',
  'Nobody waiting in that dwelling this week.': 'В этом жилище на этой неделе никого нет.',
  'No free slot in the army for a new kind of man.': 'В армии нет свободного слота для нового вида бойцов.',
  'Not in the middle of a boarding': 'Не посреди абордажа',
  'The crew holds the ship: nobody signs on now': 'Корабль в руках команды: сейчас никто не наймётся',
  'The hold lacks {0} {1}.': 'В трюме не хватает: {1} — {0}.',
  'Unknown kind of man': 'Неизвестный вид бойцов',
  'Men of tier {0} serve a ship of level {1} and up.': 'Бойцы {0}-го уровня служат на кораблях от уровня {1}.',
  'silver': 'серебро',
  'A ship of level {0} berths {1} picked men (tier 4 and up) at most.': 'Корабль уровня {0} берёт не больше {1} отборных бойцов (4-го уровня и выше).',
  'They cannot be trained further.': 'Дальше их не выучить.',
  'None of them aboard.': 'Таких на борту нет.',
  '{0} {1} sign on for {2} silver.': 'В армию вступают {1}: {0} за {2} серебра.',
  '{0} {1} trained up into {2} for {3} silver.': 'Обучены: {1} → {2}, {0} за {3} серебра.',
  // 13. the town and its market
  'Build the keep first.': 'Сначала постройте крепость.',
  'Raise the keep to a castle first.': 'Сначала поднимите крепость до замка.',
  '{0} rises on {1}.': 'Построено на острове {1}: {0}.',
  'The island has no market.': 'На острове нет рынка.',
  'The market will not trade so little.': 'Рынок не меняет так мало.',
  'The market sells you {0} {1} for {2} silver.': 'Рынок продаёт вам {1}: {0} за {2} серебра.',
  'The market pays {0} silver for {1} {2}.': 'Рынок платит {0} серебра за {2}: {1}.',
  'The market takes {0} {1} for {2} {3}.': 'Рынок меняет {1} ({0}) на {3} ({2}).',
  // 12. the mines
  'A captain holds {0} mines at most.': 'Капитан держит не больше {0} шахт.',
  'A flag was planted there only minutes ago.': 'Флаг там подняли всего несколько минут назад.',
  'Too few hands to beat the raiders ashore ({0} of them).': 'Слишком мало людей, чтобы выбить налётчиков с берега (их {0}).',
  '{0} (held by raiders, {1} men)': '{0} (заняли налётчики, {1} чел.)',
  '{0} (plant your flag)': '{0} (поднять свой флаг)',
  '{0} (your pile: {1})': '{0} (ваш запас: {1})',
  'Boats away to haul the pile at the {0} on {1} ({2}s).': 'Шлюпки идут за запасом: {0}, остров {1} ({2} с).',
  'Boats away: {0} hands row for the {1} on {2} with your flag ({3}s).': 'Шлюпки на воде: {0} чел. везут ваш флаг — {1}, остров {2} ({3} с).',
  'The party is back before the flag went up on the {0}.': 'Отряд вернулся, не успев поднять флаг: {0}.',
  'The raiders on {0} are beaten off; {1} of the party fell.': 'Налётчиков на острове {0} выбили; из отряда погибло {1}.',
  'Your flag flies over the {0} on {1}: {2} {3} a day.': 'Ваш флаг поднят: {0}, остров {1} — {3}: {2} в день.',
  'Hauled the pile at the {0}: {1}.': 'Запас забран ({0}): {1}.',
  'No room in the hold for the pile.': 'В трюме нет места для запаса.',
  'The mine’s overseer': 'Смотритель шахты',
  'Raiders have taken your mine': 'Налётчики захватили вашу шахту',
  'Raiders have taken your {0} on {1}. Beat them ashore and plant your flag again.': 'Налётчики захватили вашу шахту ({0}, остров {1}). Выбейте их с берега и поднимите флаг снова.',
  'Your mine is taken': 'Вашу шахту захватили',
  '{0} has planted a flag over your {1} on {2}.': 'Капитан {0} поднял свой флаг над вашей шахтой ({1}, остров {2}).',
  'a captain': 'капитан',
  // The admin's replies.
  'Dwellings — {0}.': 'Жилища — {0}.',
  'The dwellings here and on your island are full: two weeks of men.': 'Жилища здесь и на вашем острове полны: бойцы за две недели.',
  'No dwellings here: dock in a port or build them on your island.': 'Здесь нет жилищ: встаньте в порту или постройте их на своём острове.',
  'no dwellings': 'жилищ нет',
  'Mines: {0}; yours {1}. Nearest: the {2} on {3}, {4} m away.': 'Шахт: {0}; ваших {1}. Ближайшая: {2}, остров {3}, в {4} м.',
  'The {0} on {1} is now {2}.': 'Шахта ({0}, остров {1}) теперь {2}.',
  'yours': 'ваша',
  'nobody’s': 'ничья',
  'No mines in this sea.': 'В этом море нет шахт.',
  'The mines have paid a day.': 'Шахты выплатили за день.',
  'Off {0}, by the {1}.': 'У острова {0}, рядом: {1}.',
  'Off {0}.': 'У острова {0}.',
  'the raiders’': 'у налётчиков',
  'Town raised: {0}; the dwellings full ({1}).': 'Город построен: {0}; жилища полны ({1}).',
  '{0} of each resource in the hold{1}.': 'По {0} каждого ресурса в трюме{1}.',
  ' and in the island’s yard': ' и во дворе острова',
};
