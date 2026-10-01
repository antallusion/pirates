// The server's lines of docs/18 III (more islands, islands by their levels), English → Russian: the hidden islands, the
// danger of a landing above one's level, the turtle islands, the sandbars, the supply routes, the admin's replies. The
// names the sentences carry (the turtles, the kinds of island) are here too.

import { ISLE_TYPE_DEFS } from '../../../shared/src/world/archipelago.ts';

const names: Record<string, string> = {};
for (const d of Object.values(ISLE_TYPE_DEFS)) names[d.name[0]] = d.name[1];

export const SERVER_RU_ISLES18: Record<string, string> = {
  ...names,
  'Old Shellback': 'Старый Панцирь',
  'The Wandering Isle': 'Бродячий Остров',
  // 30. the hidden islands
  'A hidden island comes out of the mist on your chart: {0}. What lies ashore there no one has touched.': 'Из тумана на вашей карте проступает тайный остров: {0}. На его берег ещё никто не ступал.',
  // 28. the danger
  '{0} is an island of ⚓{1}, two levels above your ship: what lives there is stronger than your crew.': '{0} — остров ⚓{1}, на два уровня выше вашего корабля: те, кто там обитает, сильнее вашей команды.',
  '{0} is an island of ⚓{1}, {2} levels above your ship: what lives there is beyond your crew.': '{0} — остров ⚓{1}, выше вашего корабля на {2} ур.: тем, кто там обитает, ваша команда не соперник.',
  // 31. the turtle islands and the sandbars
  'the back of the great turtle': 'спина великой черепахи',
  'Boats away: {0} hands row for the back of {1} while she basks ({2}s).': 'Шлюпки на воду: {0} человек гребут к спине острова «{1}», пока черепаха греется на солнце ({2} с).',
  'The party combs the back of {0} while she basks: {1} silver and {2} {3}.': 'Пока черепаха греется, отряд обшаривает спину острова «{0}»: {1} серебра и {3} — {2}.',
  'The party combs the back of {0} while she basks: {1} silver.': 'Пока черепаха греется, отряд обшаривает спину острова «{0}»: {1} серебра.',
  "{0} sounds under the party's feet: {1} drowned, the rest swim back to the boats empty-handed.": '{0} уходит под воду прямо из-под ног отряда: утонуло {1}, остальные вплавь возвращаются к шлюпкам ни с чем.',
  'On the turtle’s back': 'На спине черепахи',
  // 32. the supply routes
  '{0} is yours now: link it to your own island for a supply route (My island → Supply).': '{0} теперь ваш: свяжите его со своим островом путём снабжения («Мой остров» → «Снабжение»).',
  'You have no island of your own to send it to': 'У вас нет своего острова, куда возить припасы',
  'This is your own island': 'Это ваш собственный остров',
  'Too far from your island for a supply route': 'Слишком далеко от вашего острова для пути снабжения',
  'No more than {0} supply routes': 'Не больше {0} путей снабжения',
  'That island is not yours': 'Этот остров не ваш',
  'A supply route runs from {0} to your island: its first delivery comes with the next week.': 'Путь снабжения связал остров {0} с вашим: первая поставка придёт с началом новой недели.',
  "The supply boats from {0} are in: {1} {2} in your island's yard.": 'Пришли лодки снабжения с острова {0}: на дворе вашего острова {2} — {1}.',
  "The supply boats from {0} are in, but your island's yard is full.": 'Пришли лодки снабжения с острова {0}, но двор вашего острова полон.',
  'Your supply routes': 'Ваши пути снабжения',
  'The week’s supply': 'Поставка недели',
  // the tester's console
  '{0}: ⚓{1} · {2} (your ship ⚓{3}).': '{0}: ⚓{1} · {2} (ваш корабль ⚓{3}).',
  'Kinds: {0}.': 'Виды: {0}.',
  'No island.': 'Нет острова.',
  'No hidden island.': 'Нет тайного острова.',
  'No island that far above your ship.': 'Нет острова настолько выше вашего корабля.',
  'Usage: /isle level|type kind|atoll|ridge|small|hidden [reveal]|danger [deadly]': 'Как: /isle level|type вид|atoll|ridge|small|hidden [reveal]|danger [deadly]',
  'No zone.': 'Нет зоны.',
  '{0} zones; nearest of ⚓{1}: {2} (⚓{3}, {4} islands), {5} km.': 'Зон: {0}; ближайшая ⚓{1}: {2} (⚓{3}, островов: {4}), {5} км.',
  'No turtle.': 'Нет черепахи.',
  '{0} dives.': '{0} уходит под воду.',
  '{0} is up.': '{0} поднимается из воды.',
  '{0} keeps her own time again.': '{0} снова живёт своим временем.',
  'Off {0}: land on her back.': 'У острова «{0}»: высаживайтесь на спину.',
  'No sandbars.': 'Нет отмелей.',
  'A sandbar is bared before you: {0}.': 'Перед вами обнажилась отмель: {0}.',
  'The week’s supply delivered.': 'Поставка недели доставлена.',
  '{0} is yours and linked to your island.': '{0} теперь ваш и связан с вашим островом.',
  '{0} is yours.': '{0} теперь ваш.',
};
