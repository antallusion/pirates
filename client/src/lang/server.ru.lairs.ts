// The server's lines of docs/18 II (the lairs of the land's creatures), English → Russian: the battle ashore, the
// spoils, the island's chain and its chest, the offer of a beaten lair's creatures, the dwellings, the pen and the
// eggs, the admin's replies. The names the sentences carry (the lairs, the creatures) are here too.

import { BEAST_PLURAL, LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';

const names: Record<string, string> = {};
for (const l of Object.values(LAIRS)) names[l.name[0]] = l.name[1];
for (const b of Object.values(BEAST_PLURAL)) names[b[0]] = b[1];
for (const r of Object.values(LAND_RES_DEF)) names[r.name[0]] = r.name[1];

export const SERVER_RU_LAIRS: Record<string, string> = {
  ...names,
  'a sandbar': 'отмель',
  'an island': 'остров',
  'the turtle island': 'остров-черепаха',
  // the battle ashore
  'Boats away: {0} hands land on {1} against the {2}.': 'Шлюпки на воду: {0} человек высаживаются на {1} против логова «{2}».',
  'Your party is ashore already.': 'Ваш отряд уже на берегу.',
  'Come in to the shore: within the boats’ reach.': 'Подойдите к берегу: на расстояние шлюпок.',
  'Fall back to the boats instead': 'Лучше отступите к шлюпкам',
  'Clear the shore lair first: the grotto lies beyond it.': 'Сначала разбейте прибрежное логово: грот за ним.',
  'Clear the grotto first: the guardian lies at the heart of the island.': 'Сначала разбейте грот: страж — в самом сердце острова.',
  'The party falls back to the boats from the {0}.': 'Отряд отступает к шлюпкам от логова «{0}».',
  'The {0} throws your party back into the surf.': '«{0}» сбрасывает ваш отряд обратно в прибой.',
  'Won the fight ashore with the {0}': 'Победа на берегу: «{0}»',
  // the spoils
  'The {0} is beaten. You had its spoils this week already.': 'Логово «{0}» разбито. Его добыча уже была вашей на этой неделе.',
  "The {0} is beaten: {1} silver and the land's spoils.": 'Логово «{0}» разбито: {1} серебра и трофеи суши.',
  'Cleared the {0}': 'Очищено логово «{0}»',
  "The party brings back a young one of the {0}: lay it in the pen of your island's town.": 'Отряд приносит детёныша — {0}: отнесите его в загон города на своём острове.',
  'The chest of {0} is yours: {1} silver for the whole of its chain.': 'Сундук острова {0} ваш: {1} серебра за всю цепочку.',
  'Cleared the chain of {0}': 'Пройдена цепочка острова {0}',
  '{0} has cleared {1} from its shore to its guardian.': '{0} очистил остров {1} — от берега до стража.',
  // the offer
  'They will not go with you.': 'Они не пойдут с вами.',
  '{0} of the {1} come aboard with you; the rest scatter.': '{0} из логова «{1}» идут к вам на борт; остальные разбегаются.',
  'The {0} sees your strength and scatters inland.': '«{0}» видит вашу силу и разбегается вглубь острова.',
  // the dwellings
  'No dwelling here.': 'Здесь нет жилища.',
  'Beat its creatures first.': 'Сначала разбейте его существ.',
  'No more than {0} creature dwellings under your flag.': 'Не больше {0} жилищ существ под вашим флагом.',
  'Your flag flies over the {0} on {1}: {2} grow there each week for you to hire.': 'Ваш флаг над логовом «{0}» на острове {1}: {2} растут там каждую неделю, их можно нанимать.',
  '{0} has taken your creature dwelling on {1}.': '{0} захватил ваше жилище существ на острове {1}.',
  'No creature dwelling of yours within the boats’ reach.': 'В досягаемости шлюпок нет вашего жилища существ.',
  'Creatures of tier {0} serve a ship of level {1} and up.': 'Существа {0}-го уровня служат на кораблях с {1}-го уровня.',
  '{0} {1} join your army for {2} silver.': '{1} ({0}) вступают в армию за {2} серебра.',
  // the pen and the eggs
  'Build a pen in your town first.': 'Сначала постройте в городе загон.',
  'No such egg': 'Нет такого яйца',
  'Bring your ship to the island to carry it ashore.': 'Подведите корабль к острову, чтобы снести его на берег.',
  'The pen is full: raise it a level for more nests.': 'Загон полон: поднимите его уровень ради новых гнёзд.',
  'A young one of the {0} is laid in the pen: it hatches and grows in nine days of the sea.': 'Детёныш — {0} — в загоне: вылупится и вырастет за девять дней.',
  // the tester's console
  'All {0} lairs stand again; your spoils are forgotten.': 'Все логова ({0}) снова на месте; ваша добыча забыта.',
  'Off the {0}.': 'У логова: {0}.',
  'Ashore: the {0}.': 'На берегу: {0}.',
  '{0} on {1} (⚓{2}, {3} creatures)': '«{0}» на острове {1} (⚓{2}, существ: {3})',
  'The {0} is thinned to {1} creatures.': 'Логово «{0}» поредело до {1} существ.',
  'Your flag over the {0}.': 'Ваш флаг над логовом: {0}.',
  'Lairs: {0}, standing {1}. Nearest: the {2}, {3} m away.': 'Логов: {0}, стоят: {1}. Ближайшее: {2}, в {3} м.',
  '{0} {1} in your army.': '{1} в армии: {0}.',
  'An egg of the {0} in your hold.': 'Яйцо — {0} — в трюме.',
  'No more than {0} eggs carried.': 'Больше {0} яиц не увезти.',
  "The pen's eggs have hatched ({0}).": 'Яйца в загоне вылупились ({0}).',
  "The pen's young are grown ({0}).": 'Детёныши в загоне выросли ({0}).',
  '{0} of shell, bone and venom in your store.': 'Панциря, кости и яда — по {0} на складе.',
};
