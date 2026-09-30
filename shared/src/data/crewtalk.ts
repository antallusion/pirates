// The crew speaks (docs/16 #16–19): a named officer's short line on the sea's events, told in his role's own voice
// (several per event, both tongues); the men's grumbling at low morale and the shanty at high; the trades' practice,
// which grows slowly by doing the work and gives a small edge; the wounded after a fight, whom the surgeon and the
// medicine chest bring back.

import type { OfficerRole, Profession } from './crew.ts';

export type TalkEvent = 'storm' | 'victory' | 'hunger' | 'new_sea' | 'low_morale' | 'boss' | 'merchant';
export const TALK_EVENTS: TalkEvent[] = ['storm', 'victory', 'hunger', 'new_sea', 'low_morale', 'boss', 'merchant'];

/** A line in English and Russian; `{x}` is the event's name (a sea, a ship, a beast), filled in by the reader's client. */
export type Line = [string, string];

/** Seconds between any two officers' lines, and between two of the same event. */
export const TALK_GAP = 75;
export const TALK_EVENT_GAP = 240;

/** Whom the event concerns most: they speak first (weight 3 against 1). */
export const TALK_PREFERS: Record<TalkEvent, OfficerRole[]> = {
  storm: ['pilot', 'sailmaker', 'boatswain'],
  victory: ['master_gunner', 'lieutenant', 'quartermaster'],
  hunger: ['quartermaster', 'boatswain'],
  new_sea: ['pilot', 'deep_pastor', 'harpooner'],
  low_morale: ['lieutenant', 'quartermaster', 'deep_pastor'],
  boss: ['harpooner', 'deep_pastor', 'master_gunner'],
  merchant: ['quartermaster', 'master_gunner', 'boatswain'],
};

export const TALK: Record<OfficerRole, Record<TalkEvent, Line[]>> = {
  lieutenant: {
    storm: [
      ['Secure the guns and double the lashings. Nobody goes over the side on my watch.', 'Крепить пушки, найтовы вдвое. На моей вахте за борт никто не уходит.'],
      ['Reef topsails, lively now! The glass is falling like a stone.', 'Брать рифы на марселях, живее! Барометр падает камнем.'],
      ['Storm or no storm, the watch changes on the bell.', 'Шторм или нет, а вахта сменяется по склянкам.'],
    ],
    victory: [
      ['Well fought, Captain. I shall enter it in the log in my best hand.', 'Славный бой, капитан. Запишу в журнал лучшим почерком.'],
      ['The men did their duty. They will want to hear you say so.', 'Люди исполнили долг. Им захочется услышать это от вас.'],
      ['{x} strikes — and not one of ours flinched.', '«{x}» сдаётся — и никто из наших не дрогнул.'],
    ],
    hunger: [
      ['The bread room is bare, Captain. Discipline holds a day, no longer.', 'В хлебной кладовой пусто, капитан. Дисциплина продержится день, не больше.'],
      ['Half rations were yesterday. Today there are no rations.', 'Вчера было полпайка. Сегодня нет никакого.'],
      ['An empty belly is the first mutineer. We must make port.', 'Пустое брюхо — первый бунтовщик. Нужно в порт.'],
    ],
    new_sea: [
      ['{x}, Captain. I have the chart marked and the watch warned.', '{x}, капитан. Карту отметил, вахту предупредил.'],
      ['New water. I would keep the guns run out, if it were my ship.', 'Новые воды. Будь корабль моим, я бы держал пушки выкаченными.'],
      ['{x} — the log will want the hour and the bearing.', '{x} — в журнал нужно занести час и пеленг.'],
    ],
    low_morale: [
      ['The men are sullen, Captain. A word from you would go a long way.', 'Люди мрачны, капитан. Ваше слово многое бы значило.'],
      ['I hear talk below. Not mutiny yet — but talk.', 'Внизу разговоры. Ещё не бунт — но разговоры.'],
      ['Rum, pay or a harbour. They need one of the three.', 'Ром, жалованье или гавань. Им нужно хоть что-то одно.'],
    ],
    boss: [
      ['All hands to quarters! That is no ship out there.', 'Все по местам! Это там не корабль.'],
      ['{x}. Steady, lads — it bleeds like anything else.', '{x}. Спокойно, ребята — оно тоже истекает кровью.'],
      ['I have read of {x} in reports. I never believed them.', 'Я читал о нём в донесениях — {x}. Никогда не верил.'],
    ],
    merchant: [
      ['A merchant, low in the water. {x}, by her colours.', 'Купец, глубоко сидит. «{x}», судя по флагу.'],
      ['{x} carries more than ballast, Captain. Your orders?', '«{x}» везёт не балласт, капитан. Ваши приказы?'],
      ['A fat prize under easy sail. The men have seen her too.', 'Жирная добыча под лёгкими парусами. Люди тоже её заметили.'],
    ],
  },
  boatswain: {
    storm: [
      ['Pumps manned, hatches battened. Let her blow.', 'Помпы укомплектованы, люки задраены. Пусть дует.'],
      ['Hold on to something that is nailed down, you lubbers!', 'Держитесь за то, что прибито, сухопутные крысы!'],
      ['I’ve seen worse. Not much worse, mind.', 'Видал и похуже. Ненамного, правда.'],
    ],
    victory: [
      ['Ha! Tell the cook — double grog tonight.', 'Ха! Скажите коку — сегодня двойной грог.'],
      ['{x} won’t trouble anyone again. Splice the mainbrace!', '«{x}» больше никому не помешает. Всем по чарке!'],
      ['Clear the deck, sweep the splinters. Good work, all of you.', 'Очистить палубу, смести щепу. Хорошая работа, все.'],
    ],
    hunger: [
      ['The lads are chewing their belts, Captain.', 'Ребята уже ремни жуют, капитан.'],
      ['No biscuit, no work. That’s the sea’s law and theirs.', 'Нет сухаря — нет работы. Таков закон моря и их тоже.'],
      ['I’ve got men fainting at the capstan. We need stores.', 'У меня люди падают у кабестана. Нужны припасы.'],
    ],
    new_sea: [
      ['{x}. Smells different here. Keep an eye on the rigging.', '{x}. Тут и пахнет иначе. Следите за такелажем.'],
      ['New water, same old ropes. On with it.', 'Воды новые, канаты старые. За работу.'],
      ['Never thought I’d see {x}. My mother won’t believe it.', 'Не думал, что увижу: {x}. Мать не поверит.'],
    ],
    low_morale: [
      ['They drag their feet at every order. I can’t flog them all.', 'Каждый приказ исполняют нога за ногу. Всех не перепорешь.'],
      ['The whistle don’t move them like it did, Captain.', 'Дудка их уже не поднимает, как раньше, капитан.'],
      ['Give ’em something to cheer about, or they’ll find something to grumble about.', 'Дайте им повод порадоваться, не то найдут повод поворчать.'],
    ],
    boss: [
      ['By all the drowned — look at the size of it!', 'Всеми утопленниками — вы гляньте, какое оно!'],
      ['{x}! Every hand on deck, and the carpenter by the pumps!', '{x}! Все наверх, плотника к помпам!'],
      ['My knees are knocking, Captain. Tell me we’re not fighting that.', 'У меня колени трясутся, капитан. Скажите, что мы не будем с этим драться.'],
    ],
    merchant: [
      ['{x}, wallowing like a pig. She’d be easy meat.', '«{x}» переваливается, как свинья. Лёгкая добыча.'],
      ['Look at her waterline! She’s stuffed to the hatches.', 'Гляньте на ватерлинию! Набита по самые люки.'],
      ['Grapnels are ready if you want her, Captain.', 'Кошки наготове, если она вам нужна, капитан.'],
    ],
  },
  quartermaster: {
    storm: [
      ['Every cask lashed? A storm spoils more cargo than pirates do.', 'Все бочки принайтовлены? Шторм портит больше груза, чем пираты.'],
      ['If we lose the hold, Captain, we lose the shares with it.', 'Потеряем трюм, капитан, — потеряем и доли.'],
      ['I’ll count the damage after. If there’s an after.', 'Ущерб посчитаю потом. Если будет «потом».'],
    ],
    victory: [
      ['I make the prize share at a fair sum. The men will be pleased.', 'Призовая доля выходит честная. Люди будут довольны.'],
      ['{x} — down in the ledger, and the shares ready by nightfall.', '«{x}» — в книгу, а доли к вечеру.'],
      ['A good day for the Articles. Nobody can say we cheat them.', 'Хороший день для Статей. Никто не скажет, что мы их обманываем.'],
    ],
    hunger: [
      ['The stores are out, Captain. I cannot share out what we have not got.', 'Припасы кончились, капитан. Я не могу делить то, чего нет.'],
      ['Hungry men count every coin twice. Make port before they count yours.', 'Голодные пересчитывают каждую монету дважды. В порт, пока не взялись за ваши.'],
      ['I’ve written “provisions: none” in the book. I dislike that line.', 'Записал в книгу: «провизии — нет». Не люблю эту строку.'],
    ],
    new_sea: [
      ['{x}. Prices will be different here — and so will the dangers.', '{x}. Цены тут будут другие — и опасности тоже.'],
      ['New water means new buyers. I’ll keep my ears open in port.', 'Новые воды — новые покупатели. В порту буду держать ухо востро.'],
      ['I’ve heard {x} makes men rich or makes them dead.', 'Говорят, {x} либо делает богатым, либо мёртвым.'],
    ],
    low_morale: [
      ['They say the shares are thin. They are not wrong.', 'Говорят, доли тощие. И не ошибаются.'],
      ['A little silver on the capstan would quiet a lot of mouths.', 'Немного серебра на кабестане заткнуло бы немало ртов.'],
      ['I keep the peace below, Captain, but I cannot keep it for ever.', 'Я держу мир внизу, капитан, но не вечно.'],
    ],
    boss: [
      ['That thing is worth a fortune dead — and we are worth nothing dead.', 'Эта тварь мёртвой стоит целое состояние — а мы мёртвые не стоим ничего.'],
      ['{x}. The guild pays for its head, if we keep ours.', '{x}. Гильдия платит за его голову, если сохраним свои.'],
      ['I will note the risk in the book. In red ink.', 'Отмечу риск в книге. Красными чернилами.'],
    ],
    merchant: [
      ['{x}. I would put her cargo at a handsome sum, Captain.', '«{x}». Её груз я оценил бы в кругленькую сумму, капитан.'],
      ['Rich hold, thin guard. The arithmetic is simple.', 'Богатый трюм, слабая охрана. Арифметика простая.'],
      ['The men are already dividing her cargo in their heads.', 'Люди уже делят её груз в уме.'],
    ],
  },
  master_gunner: {
    storm: [
      ['Keep the powder dry, or we fight the next one with oaths.', 'Порох держать сухим, иначе следующий бой будем вести руганью.'],
      ['Tompions in, ports closed. The sea wants in through my guns.', 'Пробки в стволы, порты закрыть. Море лезет через мои пушки.'],
      ['A loose gun in this sea kills more than grapeshot.', 'Сорвавшаяся пушка в такую волну убивает больше картечи.'],
    ],
    victory: [
      ['Did you see that last broadside? Poetry, Captain. Poetry.', 'Видели последний залп? Поэзия, капитан. Поэзия.'],
      ['{x} — holed between wind and water, just as I laid her.', '«{x}» — пробоина у ватерлинии, куда я и целил.'],
      ['Sponge the guns, count the shot. They earned their grog.', 'Пробанить орудия, пересчитать ядра. Свой грог они заработали.'],
    ],
    hunger: [
      ['My gun crews can’t run out an eighteen-pounder on an empty stomach.', 'Мои расчёты не выкатят восемнадцатифунтовку на пустой желудок.'],
      ['We have shot and powder, Captain. Not a crumb of bread.', 'Ядра и порох есть, капитан. Хлеба — ни крошки.'],
      ['A hungry gunner is a slow gunner. And a slow gunner is dead.', 'Голодный канонир — медленный канонир. А медленный — мёртвый.'],
    ],
    new_sea: [
      ['{x}. Let’s hope they have powder merchants here.', '{x}. Будем надеяться, здесь торгуют порохом.'],
      ['New water. I’ll keep a round in every gun.', 'Новые воды. Держу по заряду в каждом орудии.'],
      ['I’ve never laid a gun in {x}. First time for everything.', 'В этих водах я ещё не наводил: {x}. Всё когда-то впервые.'],
    ],
    low_morale: [
      ['My crews miss their marks when their hearts aren’t in it.', 'Мои расчёты мажут, когда не лежит душа.'],
      ['The lads are slow on the rammers. It isn’t the arms, it’s the spirit.', 'Ребята медленно работают банниками. Дело не в руках, а в духе.'],
      ['Give them a fight they can win, Captain. Nothing cheers a gunner like that.', 'Дайте им бой, который можно выиграть, капитан. Ничто так не радует канонира.'],
    ],
    boss: [
      ['{x}! Heavy shot, all batteries — I want every ball to count.', '{x}! Тяжёлые ядра, все батареи — каждое ядро должно лечь в цель.'],
      ['I always wanted to see what an eighteen-pounder does to one of those.', 'Всегда хотел посмотреть, что восемнадцатифунтовка делает с такой тварью.'],
      ['Aim for the eye. It’s the only thing on it I understand.', 'Целься в глаз. Это единственное в нём, что мне понятно.'],
    ],
    merchant: [
      ['{x}. One ball through her rigging and she’ll heave to.', '«{x}». Одно ядро по такелажу — и она ляжет в дрейф.'],
      ['Chain shot for the masts, if you want her whole.', 'Книппели по мачтам, если нужна целой.'],
      ['She has four guns, maybe. Toys.', 'У неё пушки четыре, от силы. Игрушки.'],
    ],
  },
  pilot: {
    storm: [
      ['I felt it coming in my bones. Two points to starboard, and hold her there.', 'Чуял его костями. Два румба вправо, и держите так.'],
      ['The swell comes from the southwest. Meet it on the bow, not the beam.', 'Зыбь с юго-запада. Встречайте носом, не бортом.'],
      ['Listen to the wind in the shrouds. It is telling us where to run.', 'Послушайте ветер в вантах. Он говорит, куда бежать.'],
    ],
    victory: [
      ['I put her where you wanted her, Captain. The guns did the rest.', 'Я поставил её, куда вы хотели, капитан. Остальное сделали пушки.'],
      ['{x} never read the water. We did.', '«{x}» не читала воду. А мы читали.'],
      ['A fine piece of sailing, that. The fight was almost an afterthought.', 'Отменно сходили. Бой был почти между делом.'],
    ],
    hunger: [
      ['I can find the nearest harbour blind, Captain. Say the word.', 'Ближайшую гавань найду вслепую, капитан. Только скажите.'],
      ['Hunger makes the helm heavy. Let me set a course for port.', 'От голода штурвал тяжелеет. Позвольте проложить курс в порт.'],
      ['Three days to the nearest stores, maybe two with this wind.', 'До ближайших припасов три дня, может, два при таком ветре.'],
    ],
    new_sea: [
      ['{x}. The water tastes of iron here.', '{x}. Вода здесь отдаёт железом.'],
      ['{x}. Mind the shallows — I hear them before I see them.', '{x}. Осторожнее с мелями — я слышу их раньше, чем вижу.'],
      ['The currents change here. I can feel her pull.', 'Здесь меняются течения. Я чувствую, как её тянет.'],
    ],
    low_morale: [
      ['They look at the horizon too much. Men do that when they want to be elsewhere.', 'Они слишком часто смотрят на горизонт. Так делают, когда хотят быть в другом месте.'],
      ['A fair wind and a known harbour cure most sulks.', 'Попутный ветер и знакомая гавань лечат почти любую хандру.'],
      ['The sea feels their fear, Captain. So do I.', 'Море чувствует их страх, капитан. И я тоже.'],
    ],
    boss: [
      ['The water just went still. That is never good.', 'Вода вдруг затихла. Это никогда не к добру.'],
      ['{x}. I can keep us on its blind side, if you let me steer.', '{x}. Удержу нас с его слепой стороны, если дадите править.'],
      ['I hear it breathing under the keel.', 'Я слышу, как оно дышит под килем.'],
    ],
    merchant: [
      ['{x} steers a lazy course. She thinks she is alone.', '«{x}» идёт ленивым курсом. Думает, что одна.'],
      ['I can put us across her bow in ten minutes.', 'За десять минут выведу нас ей под нос.'],
      ['Deep-laden, and to leeward of us. The wind favours you, Captain.', 'Тяжело гружёная, и под ветром у нас. Ветер на вашей стороне, капитан.'],
    ],
  },
  alchemist: {
    storm: [
      ['Lightning! Do you know what I could do with a jar of that?', 'Молния! Знаете, что я могла бы сделать с банкой такого?'],
      ['My flasks are wrapped in wool. If one breaks, stand well back.', 'Колбы обёрнуты шерстью. Если одна разобьётся — отойдите подальше.'],
      ['Salt water and my powders do not get on. Keep the hatch shut.', 'Солёная вода и мои порошки не ладят. Держите люк закрытым.'],
    ],
    victory: [
      ['Did you see the colour of that fire? Copper salts. Beautiful.', 'Видели цвет того огня? Медные соли. Красота.'],
      ['{x} burned exactly as the formula said.', '«{x}» горела точно по формуле.'],
      ['I only lost one eyebrow this time. A good day.', 'На этот раз потеряла только одну бровь. Хороший день.'],
    ],
    hunger: [
      ['I could brew something from the rats. You would not like it.', 'Могу сварить что-нибудь из крыс. Вам не понравится.'],
      ['Hunger makes the hands shake. Not what you want near my flasks.', 'От голода трясутся руки. Не то, что нужно рядом с моими колбами.'],
      ['There is nothing edible aboard. I checked. Twice.', 'На борту нет ничего съедобного. Я проверила. Дважды.'],
    ],
    new_sea: [
      ['{x}! I must take samples of this water.', '{x}! Надо взять пробы этой воды.'],
      ['The air here smells of sulphur. Interesting.', 'Воздух здесь пахнет серой. Любопытно.'],
      ['{x}. They say the weeds here glow at night. I want some.', '{x}. Говорят, водоросли здесь светятся ночью. Хочу себе.'],
    ],
    low_morale: [
      ['They are afraid of my workshop now. More than usual, I mean.', 'Теперь они боятся моей мастерской. Больше обычного, я имею в виду.'],
      ['A little fireworks display might cheer them. Or burn the ship.', 'Небольшой фейерверк мог бы их развеселить. Или спалить корабль.'],
      ['Gloomy crews make careless mistakes. Careless mistakes near powder are loud.', 'Мрачная команда делает небрежные ошибки. Небрежность рядом с порохом — громкая.'],
    ],
    boss: [
      ['{x}! I wonder what it is made of. Inside, I mean.', '{x}! Интересно, из чего оно сделано. Внутри, я имею в виду.'],
      ['Fire shot, Captain. Everything burns, if it is hot enough.', 'Зажигательные, капитан. Всё горит, если достаточно жарко.'],
      ['Its hide would make a marvellous crucible.', 'Из его шкуры вышел бы чудесный тигель.'],
    ],
    merchant: [
      ['{x}. I smell spices on the wind. Or is it saltpetre?', '«{x}». Чую пряности по ветру. Или это селитра?'],
      ['Rich cargo burns so nicely. Pity to waste it, though.', 'Богатый груз так хорошо горит. Жаль, правда, тратить.'],
      ['If she has sulphur aboard, I want it.', 'Если у неё на борту сера — она моя.'],
    ],
  },
  deep_pastor: {
    storm: [
      ['The deep is restless tonight. Pray it is only the weather.', 'Пучина неспокойна этой ночью. Молитесь, чтобы это была лишь погода.'],
      ['I will say the words for the drowned. Just in case.', 'Прочту слова за утонувших. На всякий случай.'],
      ['Every storm is a sermon, if you listen.', 'Каждый шторм — проповедь, если вслушаться.'],
    ],
    victory: [
      ['The sea has taken its tithe from them, not from us. Give thanks.', 'Море взяло десятину с них, а не с нас. Возблагодарите.'],
      ['{x} goes down to the choir below. May they sing well.', '«{x}» уходит к хору внизу. Пусть поют хорошо.'],
      ['I will bless the dead of both ships tonight.', 'Ночью благословлю мёртвых с обоих кораблей.'],
    ],
    hunger: [
      ['Fasting is good for the soul. Not for the rigging.', 'Пост полезен душе. Не такелажу.'],
      ['The men are starting to look at the sea as if it were a larder.', 'Люди начинают смотреть на море, как на кладовую.'],
      ['I have no loaves to multiply, Captain. Make port.', 'У меня нет хлебов, чтобы их умножить, капитан. Идите в порт.'],
    ],
    new_sea: [
      ['{x}. The dead are closer to the surface here.', '{x}. Мёртвые здесь ближе к поверхности.'],
      ['I feel them looking up at us from below.', 'Я чувствую, как они смотрят на нас снизу.'],
      ['{x}. I will need more candles.', '{x}. Мне понадобится больше свечей.'],
    ],
    low_morale: [
      ['Their faith is low, and fear fills the space it leaves.', 'Их вера слабеет, и страх заполняет пустоту.'],
      ['I hear confessions every night now. That is not a good sign.', 'Теперь я каждую ночь выслушиваю исповеди. Это недобрый знак.'],
      ['Give them a reason to hope, Captain. I can only give them prayers.', 'Дайте им повод надеяться, капитан. Я могу дать им лишь молитвы.'],
    ],
    boss: [
      ['{x}. It is older than the prayers we have for it.', '{x}. Оно старше молитв, что у нас для него есть.'],
      ['Do not look into its eyes for long. I mean it.', 'Не смотрите ему в глаза подолгу. Я серьёзно.'],
      ['The deep has sent its herald. We must answer.', 'Пучина прислала своего вестника. Мы должны ответить.'],
    ],
    merchant: [
      ['{x}. Greed is a sin, Captain. But so is waste.', '«{x}». Алчность — грех, капитан. Но и расточительство тоже.'],
      ['A rich ship, and a heavy conscience. Whose, I wonder?', 'Богатый корабль и тяжёлая совесть. Чья же, интересно?'],
      ['The crew’s eyes shine at her. I have seen that look before.', 'Глаза команды горят при виде неё. Я видел этот взгляд.'],
    ],
  },
  sailmaker: {
    storm: [
      ['Every seam will be tested tonight. I sewed them well.', 'Этой ночью проверят каждый шов. Я шил на совесть.'],
      ['Take in the topgallants before the wind takes them for us!', 'Убрать брамсели, пока ветер не убрал их за нас!'],
      ['I have needles, palm and thread ready. Go on, tear something.', 'Иглы, гардаман и нитки наготове. Давай, порвись.'],
    ],
    victory: [
      ['A few holes in the mainsail. I will have it patched by the dog watch.', 'Пара дыр в гроте. К собачьей вахте залатаю.'],
      ['{x}’s canvas is worth salvaging, Captain. Good cloth.', 'Парусину с «{x}» стоит снять, капитан. Хорошее полотно.'],
      ['We won, and my sails are still mostly sails. Excellent.', 'Мы победили, а мои паруса всё ещё в основном паруса. Отлично.'],
    ],
    hunger: [
      ['I could sew a sail into a soup, but I would not eat it.', 'Могу сшить из паруса суп, но есть бы не стал.'],
      ['My hands shake on the needle. The men are no better.', 'Руки дрожат на игле. Людям не лучше.'],
      ['No bread, Captain. My apprentice fainted in the loft.', 'Хлеба нет, капитан. Мой подмастерье упал в обморок в парусной.'],
    ],
    new_sea: [
      ['{x}. The wind here is steadier. The canvas likes it.', '{x}. Ветер здесь ровнее. Парусине нравится.'],
      ['New water, new winds. I’ll watch how she draws.', 'Новые воды, новые ветра. Посмотрю, как она тянет.'],
      ['{x}. Salt here eats canvas faster. I can smell it.', '{x}. Здешняя соль ест парусину быстрее. Я чую.'],
    ],
    low_morale: [
      ['Nobody sings in the sail loft any more.', 'В парусной больше никто не поёт.'],
      ['The men handle the sheets like they have forgotten how.', 'Люди работают со шкотами, будто забыли как.'],
      ['Morale is like canvas, Captain. Once it tears, it tears fast.', 'Дух как парусина, капитан. Порвётся — и пошло рваться.'],
    ],
    boss: [
      ['{x}! If it gets a claw into the rigging, we are finished.', '{x}! Если оно зацепит такелаж — нам конец.'],
      ['All sail she can carry, Captain. Please.', 'Все паруса, что она выдержит, капитан. Пожалуйста.'],
      ['I will need more thread after this. A lot more.', 'После этого мне понадобится больше ниток. Гораздо больше.'],
    ],
    merchant: [
      ['{x} has patched sails. A sloppy crew.', 'У «{x}» латаные паруса. Неряшливая команда.'],
      ['Her canvas alone would pay my wages for a year.', 'Одна её парусина покрыла бы моё жалованье за год.'],
      ['She sails like a barn. We can catch her.', 'Идёт, как сарай. Догоним.'],
    ],
  },
  harpooner: {
    storm: [
      ['Big seas bring big things up. Keep your eyes on the water.', 'Большая волна поднимает больших тварей. Не сводите глаз с воды.'],
      ['My irons are stowed. I don’t want one flying loose in this.', 'Гарпуны убраны. В такую погоду не хочу, чтобы какой-нибудь сорвался.'],
      ['Whales dive in weather like this. So should we, if we could.', 'Киты в такую погоду уходят на глубину. Мы бы тоже, если бы могли.'],
    ],
    victory: [
      ['A clean kill. The sea likes a clean kill.', 'Чистая работа. Море любит чистую работу.'],
      ['{x} is done. Next time, something with fins.', '«{x}» готова. В следующий раз — что-нибудь с плавниками.'],
      ['I didn’t even need my iron. A shame.', 'Даже гарпун не понадобился. Жаль.'],
    ],
    hunger: [
      ['Give me a boat and an hour and I’ll bring back meat.', 'Дайте шлюпку и час — привезу мяса.'],
      ['I’ve eaten worse than nothing. But not by much.', 'Ел и хуже, чем ничего. Но ненамного.'],
      ['Hungry men make bad hunters. Bad hunters get eaten.', 'Голодный — плохой охотник. Плохих охотников съедают.'],
    ],
    new_sea: [
      ['{x}. I can smell whale on the wind.', '{x}. Чую кита по ветру.'],
      ['New water, new beasts. I’ll sharpen the irons.', 'Новые воды — новые твари. Наточу гарпуны.'],
      ['The birds are different here. The fish will be too.', 'Птицы здесь другие. И рыба будет другая.'],
    ],
    low_morale: [
      ['Long faces all round. A good hunt would cure that.', 'Кругом кислые лица. Хорошая охота всё бы вылечила.'],
      ['They’re jumping at shadows in the water. Not good.', 'Шарахаются от теней в воде. Нехорошо.'],
      ['When the crew stops telling tall tales, you know it’s bad.', 'Когда команда перестаёт травить байки — дело плохо.'],
    ],
    boss: [
      ['{x}! Now THAT is a beast worth the iron.', '{x}! Вот ЭТО тварь, достойная гарпуна.'],
      ['Steady… let me get the mount on it. Just once.', 'Спокойно… дайте навести станок. Один раз.'],
      ['I’ve waited my whole life to see one of those. Maybe to kill one.', 'Всю жизнь ждал увидеть такое. А может, и убить.'],
    ],
    merchant: [
      ['{x}. She’s slow and heavy. Like a sick whale.', '«{x}». Медленная и тяжёлая. Как больной кит.'],
      ['I could put an iron in her stern from here.', 'Отсюда всадил бы ей гарпун в корму.'],
      ['Merchant meat. Easy, but it pays.', 'Купеческое мясо. Легко, зато платит.'],
    ],
  },
};

/** The men themselves: the grumbling below at low morale. */
export const GRUMBLES: Line[] = [
  ['“Another week of this and I jump ship,” someone mutters by the capstan.', '«Ещё неделя такого — и я сбегу», — бормочет кто-то у кабестана.'],
  ['The men eat in silence. Nobody laughs at the cook’s jokes any more.', 'Люди едят молча. Шутки кока больше никого не смешат.'],
  ['“The captain’ll get us all killed,” goes the whisper in the forecastle.', '«Капитан нас всех угробит», — шепчутся на баке.'],
  ['Orders are obeyed, slowly, with a look you do not like.', 'Приказы исполняют — медленно, с таким взглядом, что не по себе.'],
  ['Someone has carved a black spot into the mess table.', 'Кто-то вырезал на столе в кубрике чёрную метку.'],
  ['The watch below will not come up until the bosun kicks them.', 'Подвахта не поднимается, пока боцман не пнёт.'],
];

/** The shanty at high morale: a verse the men sing at the capstan. */
export const SHANTIES: Line[] = [
  ['♪ Way, hey, and up she rises, early in the morning! ♪', '♪ Эй, взяли, и вверх она идёт — рано поутру! ♪'],
  ['♪ Haul away, joe — the gale’s behind us, and the port ahead! ♪', '♪ Тяни, ребята — шторм за кормой, а порт впереди! ♪'],
  ['♪ Leave her, Johnny, leave her — but not before the grog is poured! ♪', '♪ Брось её, Джонни, брось — но не раньше, чем нальют грог! ♪'],
  ['♪ Roll the old chariot along, and we’ll all hang on behind! ♪', '♪ Катим старую колесницу, а мы все держимся сзади! ♪'],
  ['♪ Blow, boys, blow, for Gravetide and the silver! ♪', '♪ Дуй, ребята, дуй — за Грейвтайд и серебро! ♪'],
];

/** Morale below this: the men grumble; at or above that one: they may sing. */
export const GRUMBLE_BELOW = 30;
export const SHANTY_AT = 80;
/** Seconds between two grumbles, and between two shanties; how long the shanty's lift lasts, and what it gives. */
export const GRUMBLE_EVERY = 180;
export const SHANTY_EVERY = 480;
export const SHANTY_TIME = 120;
export const SHANTY_MODS = { reloadMul: -0.03, sailChangeRate: 0.03, turnRate: 0.03 } as const;

// ------------------------------------------------------------------ the trades' practice (docs/16 #18)

/** Practice points for each level of a trade (0 to 5): slow — a level is many fights, many leagues, many repairs. */
export const PRACTICE_LEVELS = [0, 200, 600, 1400, 3000, 6000];
export const PRACTICE_MAX = PRACTICE_LEVELS.length - 1;

/** What doing the work is worth: per shot fired and per hit (gunners), per km sailed (helmsmen, sailors), per % of the
 *  hull mended (carpenters), per boarding won (marines), per wounded man healed (surgeons), per hour fed at sea (cooks). */
export const PRACTICE_GAIN = { shot: 0.25, hit: 0.5, km: 4, kmSailor: 2, repairPct: 2, boarding: 40, healed: 3, cookHour: 60 } as const;

/** Each level's small edge, by trade. */
export const PRACTICE_PER_LEVEL: Record<Profession, { key: 'reloadMul' | 'turnRate' | 'sailChangeRate' | 'repairRate' | 'boardingPower' | 'heal' | 'moraleBase'; v: number }> = {
  gunner: { key: 'reloadMul', v: -0.01 },
  helmsman: { key: 'turnRate', v: 0.01 },
  sailor: { key: 'sailChangeRate', v: 0.02 },
  carpenter: { key: 'repairRate', v: 0.03 },
  marine: { key: 'boardingPower', v: 0.02 },
  surgeon: { key: 'heal', v: 0.1 },
  cook: { key: 'moraleBase', v: 1 },
};

export function practiceLevel(points: number): number {
  let l = 0;
  for (let i = 1; i < PRACTICE_LEVELS.length; i++) if (points >= PRACTICE_LEVELS[i]) l = i;
  return l;
}

/** 0..1 of the way to the next level (1 at the top). */
export function practiceProgress(points: number): number {
  const l = practiceLevel(points);
  if (l >= PRACTICE_MAX) return 1;
  return (points - PRACTICE_LEVELS[l]) / (PRACTICE_LEVELS[l + 1] - PRACTICE_LEVELS[l]);
}

// ------------------------------------------------------------------ the wounded (docs/16 #19)

/** Of the men struck down in a fight, the share only wounded without any surgeon; a surgeon's share adds to it. */
export const WOUNDED_BASE = 0.25;
export const WOUNDED_MAX = 0.75;
/** Men healed a minute: with no surgeon, with surgeons (the first and each more, to five), and twice with medicine. */
export const HEAL_NO_SURGEON = 1;
export const HEAL_SURGEON = 3;
export const HEAL_PER_SURGEON = 2;
export const HEAL_MEDICINE_MUL = 2;
/** The share of the wounded who die a minute: no surgeon, no surgeon but medicine, a surgeon but no medicine. */
export const DIE_ALONE = 0.08;
export const DIE_MEDICINE = 0.03;
export const DIE_SURGEON = 0.01;
/** Medicine used: one chest per this many men healed with it. */
export const HEALED_PER_MEDICINE = 10;
/** The fight must be this far behind before the surgeon can work. */
export const HEAL_AFTER = 30;

export interface WoundRates {
  healPerMin: number;
  diePerMin: number;
}

/** How fast her wounded come back and how many die, a minute, for this many wounded. */
export function woundRates(wounded: number, surgeons: number, medicine: boolean, surgeonLevel = 0): WoundRates {
  const s = Math.min(5, surgeons);
  const heal = (s > 0 ? HEAL_SURGEON + HEAL_PER_SURGEON * (s - 1) : HEAL_NO_SURGEON) * (medicine ? HEAL_MEDICINE_MUL : 1) * (1 + 0.1 * surgeonLevel);
  const die = s > 0 ? (medicine ? 0 : DIE_SURGEON) : medicine ? DIE_MEDICINE : DIE_ALONE;
  return { healPerMin: Math.min(wounded, heal), diePerMin: wounded * die };
}
