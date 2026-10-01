// The server's lines of docs/18 IV (drifting creatures, the creatures of the army), English → Russian: the lookout's
// word, the rescue and its outcomes, the fight and the beaten who follow, the legend of the season and its tidings,
// the creatures' food, hunger, slipping away and ranks, the pen, the tamer, the creatures on the barter table, the
// admin's replies. The names the sentences carry (the drifts, the ranks, the bearings) are here too.

import { DRIFTS, RANK_NAME } from '../../../shared/src/data/drifts.ts';

const names: Record<string, string> = {};
for (const d of Object.values(DRIFTS)) names[d.name[0]] = d.name[1];
for (const r of RANK_NAME) if (r[0]) names[r[0]] = r[1];

export const SERVER_RU_DRIFTS: Record<string, string> = {
  ...names,
  'off the bow': 'прямо по курсу',
  'astern': 'за кормой',
  'to starboard': 'по правому борту',
  'to larboard': 'по левому борту',
  // the lookout and the card
  'Lookout: {0} adrift {1}, {2} km.': 'Впередсмотрящий: «{0}» в дрейфе {1}, {2} км.',
  'Another captain is at it already.': 'Этим уже занят другой капитан.',
  'Come alongside: within the boats’ reach.': 'Подойдите борт о борт: на расстояние шлюпок.',
  'No medicine aboard for it.': 'Для этого нет лекарств на борту.',
  'No rum aboard for it.': 'Для этого нет рома на борту.',
  'Not enough fish aboard for it.': 'Для этого не хватает рыбы на борту.',
  'No shooters in your army.': 'В вашей армии нет стрелков.',
  'No such way': 'Так не выйдет',
  'Nothing to do': 'Делать нечего',
  // the rescue
  'Saved the {0}': 'Спасение: «{0}»',
  'Saved: {0} {1} join your army.': 'Спасены: {1} ({0}) встают в вашу армию.',
  'Saved: {0} {1} join your army; {2} more go home to the pen of your island.': 'Спасены: {1} ({0}) встают в вашу армию; ещё {2} отправляются в загон вашего острова.',
  'Saved: the {0} give you what they have — {1} {2} and {3} silver.': 'Спасены: «{0}» отдают, что у них есть, — {2} ({1}) и {3} серебра.',
  'Saved: the {0} give you what they have — {1} silver.': 'Спасены: «{0}» отдают, что у них есть, — {1} серебра.',
  'The serpent thrashes free of the wreckage and sounds, bleeding. It is gone.': 'Змей вырывается из обломков и уходит на глубину, истекая кровью. Его больше нет.',
  'The floe breaks up under the boats and the seals go down with it.': 'Льдина раскалывается под шлюпками, и тюлени уходят под воду вместе с ней.',
  'The drowned turn their faces away and row off into the haze.': 'Утопленники отворачиваются и уходят на вёслах в дымку.',
  'The sharks are quicker: the net goes under, and the song stops.': 'Акулы оказались быстрее: сеть уходит под воду, и песня обрывается.',
  'The weed closes over the turtles before the boats are through.': 'Водоросли смыкаются над черепахами прежде, чем шлюпки пробиваются к ним.',
  'The gulls rise screaming and scatter over the sea.': 'Чайки с криком взлетают и разлетаются над морем.',
  'The chain parts and the arms go down into the dark.': 'Цепь рвётся, и щупальца уходят во тьму.',
  'The white whale sounds, the old line trailing; the sea is empty where it was.': 'Белый кит уходит на глубину, волоча старый линь; там, где он был, — пустое море.',
  'The young kraken lets go of the rigging and sinks back to the deep.': 'Молодой кракен отпускает такелаж и опускается обратно в бездну.',
  // the fight
  'Boats away against the {0}.': 'Шлюпки на воду: против «{0}».',
  'Won the fight with the {0}': 'Победа в бою: «{0}»',
  'The {0} throw your boats back.': '«{0}» отбрасывают ваши шлюпки.',
  'The {0} are beaten: {1} silver.': '«{0}» побеждены: {1} серебра.',
  'Nobody waits to follow you.': 'Никто не ждёт, чтобы пойти за вами.',
  'Chosen already': 'Уже выбрано',
  'You let the beaten {0} go.': 'Вы отпускаете побеждённых: {0}.',
  '{0} {1} follow you aboard.': 'За вами на борт идут {1} ({0}).',
  '{0} {1} follow you aboard; {2} more go home to your pen.': 'За вами на борт идут {1} ({0}); ещё {2} отправляются в ваш загон.',
  '{0} {1} are sent home to the pen of your island.': 'Домой, в загон вашего острова, отправлены {1} ({0}).',
  'Your pen has no room for them.': 'В вашем загоне для них нет места.',
  // the legend
  '{0} has risen in {1}.': 'В водах {1} показалась легенда — «{0}».',
  'WORLD: {0} has risen in {1}. One captain may save it or take it.': 'Вести: в водах {1} показалась легенда — «{0}». Спасти её или одолеть сможет лишь один капитан.',
  '{0} has saved {1}.': '{0} спасает легенду — «{1}».',
  '{0} has slain {1}.': '{0} одолевает легенду — «{1}».',
  'WORLD: {0} has saved {1}.': 'Вести: {0} спасает легенду — «{1}».',
  'WORLD: {0} has slain {1}.': 'Вести: {0} одолевает легенду — «{1}».',
  // food, hunger, ranks
  'The {0} are hungry: fish for them in the hold, or they will slip away.': 'Голодны: {0}. Нужна рыба в трюме, иначе они уйдут.',
  'The {0} want rum: there is none aboard, nor bone in your store.': 'Просят рома: {0}. На борту его нет, и кости в запасе тоже.',
  '{0} of the {1} slip over the side in the night: they were starving.': 'Голодные {1} уходят за борт ({0}).',
  '{0} of the {1} slip away: the crew’s heart is low and they feel it.': 'Уходят {1} ({0}): дух команды упал, и они это чуют.',
  'Your {0} have fought well and grown: they are {1} now.': 'Ваши {0} хорошо дрались и выросли: теперь они {1}.',
  // the pen
  '{0} {1} go ashore to the pen of your island.': 'В загон вашего острова сходят {1} ({0}).',
  '{0} {1} come aboard from the pen.': 'Из загона на борт поднимаются {1} ({0}).',
  'None of them in the pen.': 'В загоне их нет.',
  'The pen is full: raise it a level for more room.': 'Загон полон: поднимите его уровень, чтобы стало просторнее.',
  'No such creatures aboard': 'Таких тварей на борту нет',
  'Keep at least one stack aboard': 'Оставьте на борту хотя бы один отряд',
  'You let {0} {1} go.': 'Вы отпускаете: {1} ({0}).',
  // the tamer
  'No tamer in this port.': 'В этом порту нет укротителя.',
  'The tamer buys creatures, not men.': 'Укротитель покупает тварей, а не людей.',
  'Not even a tamer would put a price on a legend.': 'Даже укротитель не возьмётся назначить цену легенде.',
  'The tamer takes {0} {1} for {2} silver.': 'Укротитель забирает {1} ({0}) за {2} серебра.',
  'The tamer has none of them this week.': 'На этой неделе у укротителя таких нет.',
  '{0} {1} join your army from the tamer’s pens for {2} silver.': 'Из загонов укротителя в вашу армию встают {1} ({0}) за {2} серебра.',
  // the barter
  'A legend does not change hands': 'Легенда не переходит из рук в руки',
  'You have only {0} {1}': 'У вас только {0}: {1}',
  '{0} no longer has those creatures': 'У капитана {0} больше нет этих тварей',
  '{0} has no hammocks for the creatures': 'У капитана {0} нет коек для тварей',
  '{0} has no free slot for the creatures': 'У капитана {0} нет свободного слота для тварей',
  // the admin
  '{0} adrift off your bow (⚓{1}, {2} {3}).': '«{0}» в дрейфе прямо по курсу (⚓{1}, {3}: {2}).',
  'The {0} are saved.': '«{0}» спасены.',
  'The {0} are lost to the sea.': '«{0}» потеряны в море.',
  'Boats away against the {0} (⚓{1}, {2}).': 'Шлюпки на воду: против «{0}» (⚓{1}, {2}).',
  'Every drift is gone; the season’s legend is new again.': 'Все дрейфы убраны; легенда сезона начинается заново.',
  'No drifts at sea. Kinds: {0}.': 'В море нет дрейфов. Виды: {0}.',
  'Drifts at sea: {0}. Nearest: the {1} (⚓{2}, {3} {4}), {5} m away, {6} s left. Legend of the season ({7}): {8}.': 'Дрейфов в море: {0}. Ближайший — «{1}» (⚓{2}, {4}: {3}), {5} м, осталось {6} с. Легенда сезона («{7}»): {8}.',
  'had by {0}': 'досталась капитану {0}',
  'none yet': 'ещё нет',
  'on the water': 'на воде',
  'rises in {0} min': 'покажется через {0} мин',
  'No creatures in your army: /creature kind n first.': 'В армии нет тварей: сначала /creature вид n.',
  '{0}: {1} wins, rank {2}, {3} s unfed; morale of the army {4}.': 'Твари «{0}»: побед {1}, ранг {2}, без корма {3} с; мораль армии {4}.',
  '{0} {1} into your pen.': 'В ваш загон: {1} ({0}).',
  'No fish nor rum aboard; your creatures are starving.': 'На борту нет ни рыбы, ни рома; ваши твари голодают.',
  '{0} fish and {1} rum into your hold; your creatures are fed.': 'В трюм — рыбы {0} и рома {1}; ваши твари накормлены.',
  'No port keeps a tamer.': 'Ни в одном порту нет укротителя.',
  'The nearest tamer: {0}, {1} km.': 'Ближайший укротитель: {0}, {1} км.',
  "In port at {0}: the tamer's pens are open.": 'В порту {0}: загоны укротителя открыты.',
};
