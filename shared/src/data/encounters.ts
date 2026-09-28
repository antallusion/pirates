// The sea director's encounters (docs/12 P2): forty things that happen to a ship under way, so the sea is never
// empty — people on rafts and in boats, things in the water, the sea's own moods, dangers and the uncanny. Each shows
// first as a sign on the horizon (smoke, birds, a spout, a glint), opens as a card when the ship comes near, and is
// settled by the captain's choice. The words are here in both languages; the server sends only ids and numbers.

import type { IslandBiome, RegionId } from '../world/regions.ts';

export type SightKind = 'raft' | 'boat' | 'smoke' | 'flare' | 'birds' | 'lantern' | 'glint' | 'wreck' | 'fire' | 'debris' | 'mine' | 'bubbles' | 'beacon'
  | 'fins' | 'spout' | 'squall' | 'twister' | 'glow' | 'ice' | 'turtle' | 'tentacle' | 'calm' | 'albatross' | 'sails' | 'ghostlight' | 'song' | 'wisps' | 'fog';

export type EncounterGroup = 'people' | 'finds' | 'nature' | 'danger' | 'mystic';

export type EncounterId =
  | 'raft' | 'convict' | 'sinking_merchant' | 'peddler' | 'fishermen' | 'pilot' | 'deserters' | 'pilgrims' | 'smuggler' | 'mapmaker'
  | 'bottle' | 'barrel' | 'derelict' | 'burning_ship' | 'flotsam' | 'mine' | 'skeleton_raft' | 'sunken_bell' | 'signal_fire'
  | 'dolphins' | 'orcas_whale' | 'squall' | 'waterspout' | 'glowing_sea' | 'iceberg' | 'giant_turtle' | 'sharks' | 'tentacle' | 'calm' | 'albatross' | 'bird_shoal'
  | 'ambush' | 'patrol_search' | 'mutiny_brewing' | 'rats' | 'galley_fire'
  | 'ghost_bargain' | 'sirens' | 'wisps' | 'voice_in_fog';

export type Tr = [string, string];

export interface EncounterWhere {
  safety?: ('safe' | 'contested' | 'lawless')[];
  regions?: RegionId[];
  /** The nearest island's biome must be one of these (and within 4 km). */
  biomes?: IslandBiome[];
  night?: boolean;
  day?: boolean;
  fog?: boolean;
  /** Within 2.5 km of land (else: open water, more than 3 km out). */
  coast?: boolean;
  open?: boolean;
  /** Stolen or contraband goods aboard. */
  hot?: boolean;
  /** The crew's morale under 25. */
  lowMorale?: boolean;
  /** At sea for over 20 minutes. */
  longVoyage?: boolean;
}

export interface EncounterDef {
  id: EncounterId;
  group: EncounterGroup;
  /** Its sign on the horizon; none: it happens aboard, the card opens at once. */
  sight: SightKind | null;
  where: EncounterWhere;
  weight: number;
  title: Tr;
  text: Tr;
  /** The captain's choices; none: it simply happens (one "So be it" button). */
  choices: { id: string; label: Tr }[];
  /** What came of it, by outcome id; {n}, {silver}, {good}, {item} filled from the server's numbers. */
  outcomes: Record<string, Tr>;
}

const E = (d: EncounterDef): EncounterDef => d;

const LAWLESS_DEEP: RegionId[] = ['drowned_crown', 'dead_mans_expanse', 'the_abyss'];

export const ENCOUNTERS: Record<EncounterId, EncounterDef> = {
  // ------------------------------------------------------------------ people
  raft: E({
    id: 'raft', group: 'people', sight: 'raft', where: { open: true }, weight: 10,
    title: ['Castaways on a raft', 'Потерпевшие на плоту'],
    text: ['A raft of lashed spars, a rag on an oar, and people waving it with the last of their strength.', 'Плот из связанных рей, тряпка на весле — и люди, машущие ею из последних сил.'],
    choices: [{ id: 'take', label: ['Take them aboard', 'Взять на борт'] }, { id: 'pass', label: ['Sail on', 'Пройти мимо'] }],
    outcomes: {
      taken: ['{n} half-drowned souls come aboard. Given a dry shirt and a tot of rum, they ask to sign on.', '{n} полуутопленников поднимаются на борт. Получив сухую рубаху и чарку рома, они просятся в команду.'],
      taken_vet: ['{n} come aboard — and one of them is an old gunner who knows his trade. They all sign on.', 'На борт поднимаются {n} — и один из них старый канонир, знающий своё дело. Все просятся в команду.'],
      passed: ['The raft falls astern. The crew watch it go and say nothing.', 'Плот уходит за корму. Команда провожает его взглядом и молчит.'],
    },
  }),
  convict: E({
    id: 'convict', group: 'people', sight: 'boat', where: { safety: ['safe', 'contested'] }, weight: 5,
    title: ['A convict’s boat', 'Лодка беглого каторжника'],
    text: ['A gig with a broken chain in the bilge. The man at the oars shows you the brand on his wrist and begs you not to give him up.', 'Ялик с обрывком цепи на дне. Гребец показывает клеймо на запястье и умоляет не выдавать его.'],
    choices: [{ id: 'hide', label: ['Hide him below', 'Спрятать в трюме'] }, { id: 'hand', label: ['Hand him to the Crown', 'Выдать Короне'] }],
    outcomes: {
      hidden: ['He signs on under a false name, a marine who has fought worse than you.', 'Он записывается под чужим именем — морской пехотинец, видавший драки и похуже.'],
      handed: ['A Crown cutter takes him off. The warrant pays {silver}.', 'Его забирает катер Короны. По ордеру выплачено {silver}.'],
    },
  }),
  sinking_merchant: E({
    id: 'sinking_merchant', group: 'people', sight: 'flare', where: { safety: ['safe', 'contested'] }, weight: 6,
    title: ['A merchant going down', 'Тонущий купец'],
    text: ['A flute low in the water and listing, a red flare over her. Her master shouts across: take what you can before she goes.', 'Флейт сидит низко и кренится, над ним красная ракета. Шкипер кричит: забирайте, что успеете, пока она не ушла.'],
    choices: [{ id: 'save', label: ['Save her cargo', 'Спасти груз'] }, { id: 'leave', label: ['Leave her', 'Оставить'] }],
    outcomes: {
      saved: ['You swing {n} of {good} across before she goes down. The League will hear of it.', 'До того как она ушла под воду, вы успеваете перекинуть: {good} — {n}. Лига об этом узнает.'],
      trap: ['A trap! The "wreck" rights herself, and two pirates come round the headland.', 'Ловушка! «Тонущий» корабль выпрямляется, а из-за мыса выходят двое пиратов.'],
      left: ['She goes down with her flare still burning.', 'Она уходит под воду с ещё горящей ракетой.'],
    },
  }),
  peddler: E({
    id: 'peddler', group: 'people', sight: 'boat', where: { coast: true }, weight: 7,
    title: ['A peddler’s boat', 'Лодка коробейника'],
    text: ['A boat heaped with bundles pulls alongside. The old man in it swears he has one thing no port on this coast can sell you.', 'К борту подходит лодка, заваленная тюками. Старик клянётся, что у него есть вещь, какой не продаст ни один порт на этом берегу.'],
    choices: [{ id: 'buy', label: ['Buy it', 'Купить'] }, { id: 'haggle', label: ['Haggle (Trade)', 'Торговаться (Торговля)'] }, { id: 'pass', label: ['No, thank you', 'Нет, спасибо'] }],
    outcomes: {
      bought: ['{item} for {silver}. The old man bites the coin and rows away singing.', '{item} за {silver}. Старик пробует монету на зуб и отгребает с песней.'],
      haggled: ['He throws up his hands and lets {item} go for {silver}.', 'Он всплёскивает руками и отдаёт {item} за {silver}.'],
      offended: ['He spits in the sea and rows off. Some things are not for haggling.', 'Он плюёт в море и отгребает. Кое-что не для торга.'],
      poor: ['You cannot meet his price. He rows off shaking his head.', 'Вам не по карману его цена. Он отгребает, качая головой.'],
      passed: ['He shrugs and rows on to the next sail.', 'Он пожимает плечами и гребёт к следующему парусу.'],
    },
  }),
  fishermen: E({
    id: 'fishermen', group: 'people', sight: 'birds', where: { coast: true, safety: ['safe', 'contested'] }, weight: 8,
    title: ['Fishermen in trouble', 'Рыбаки в беде'],
    text: ['Two boats with their net fouled on a rock, the catch thrashing and the tide coming in.', 'Две лодки, сеть зацепилась за камень, улов бьётся, а прилив всё выше.'],
    choices: [{ id: 'help', label: ['Lend a hand', 'Помочь'] }, { id: 'pass', label: ['Sail on', 'Пройти мимо'] }],
    outcomes: {
      helped: ['Your hands clear the net. The fishermen fill your stores: {n} provisions.', 'Ваши люди распутывают сеть. Рыбаки пополняют ваши запасы: провизии — {n}.'],
      helped_gift: ['Your hands clear the net, and the old skipper gives you his spare one: {item}.', 'Ваши люди распутывают сеть, и старый шкипер дарит вам запасную: {item}.'],
      passed: ['Their curses follow you down the wind.', 'Их проклятья летят вам вслед по ветру.'],
    },
  }),
  pilot: E({
    id: 'pilot', group: 'people', sight: 'boat', where: { regions: ['whispering', 'drowned_crown', 'ashen_isles'], coast: true }, weight: 5,
    title: ['A pilot among the reefs', 'Лоцман на отмелях'],
    text: ['A lean man in a dugout offers to take you through the reefs by a channel no chart shows.', 'Худой человек в долблёнке предлагает провести вас через рифы протокой, которой нет ни на одной карте.'],
    choices: [{ id: 'hire', label: ['Hire him (200 silver)', 'Нанять (200 серебра)'] }, { id: 'refuse', label: ['We know our way', 'Сами знаем путь'] }],
    outcomes: {
      hired: ['He stands by your helmsman for a while: for ten minutes the reefs do you no harm and the way is quicker.', 'Он встаёт рядом с рулевым: десять минут рифы вам не страшны, а путь короче.'],
      poor: ['You have not the silver. He paddles off.', 'У вас нет серебра. Он уплывает.'],
      refused: ['He grins and paddles off. You hear him laughing a long way.', 'Он ухмыляется и уплывает. Его смех слышен ещё долго.'],
    },
  }),
  deserters: E({
    id: 'deserters', group: 'people', sight: 'boat', where: { safety: ['contested'] }, weight: 4,
    title: ['Deserters from the fleet', 'Дезертиры с флота'],
    text: ['A navy cutter’s boat, and in it gunners in torn uniforms. They have had enough of the lash and want to sail with you.', 'Шлюпка с флотского катера, в ней канониры в драных мундирах. Им надоела плеть, они хотят ходить с вами.'],
    choices: [{ id: 'take', label: ['Take them on', 'Взять к себе'] }, { id: 'refuse', label: ['Turn them away', 'Отказать'] }],
    outcomes: {
      taken: ['{n} trained gunners join your batteries. The Crown will not love you for it.', '{n} обученных канониров встают к вашим орудиям. Корона вам этого не простит.'],
      refused: ['They row off towards the next sail, cursing officers of every flag.', 'Они гребут к следующему парусу, проклиная офицеров всех флагов.'],
    },
  }),
  pilgrims: E({
    id: 'pilgrims', group: 'people', sight: 'boat', where: { regions: ['dead_mans_expanse', 'drowned_crown'] }, weight: 5,
    title: ['Pilgrims of the Choir', 'Паломники Хора'],
    text: ['A barge of grey-robed pilgrims bound for Saint Maw, their water long gone. They sing as they row.', 'Баржа паломников в серых рясах идёт в Сент-Мо; вода у них давно кончилась. Они поют на вёслах.'],
    choices: [{ id: 'give', label: ['Give them provisions', 'Отдать провизию'] }, { id: 'refuse', label: ['We have none to spare', 'Лишнего нет'] }],
    outcomes: {
      given: ['They bless your ship. Your crew’s dread lifts, and the Choir remembers kindness.', 'Они благословляют ваш корабль. Страх отпускает команду, а Хор помнит добро.'],
      none: ['You have no provisions to give. They bless you all the same.', 'Провизии у вас нет. Они всё равно вас благословляют.'],
      refused: ['Their hymn follows you a long way over the water.', 'Их гимн ещё долго слышен над водой.'],
    },
  }),
  smuggler: E({
    id: 'smuggler', group: 'people', sight: 'lantern', where: { fog: true }, weight: 4,
    title: ['A smuggler in the fog', 'Контрабандист в тумане'],
    text: ['A schooner with her lanterns shaded. Her master offers a hold of dreamleaf far below its price — no questions.', 'Шхуна с прикрытыми фонарями. Её шкипер предлагает трюм дримлифа намного дешевле цены — без вопросов.'],
    choices: [{ id: 'buy', label: ['Buy the leaf', 'Купить'] }, { id: 'report', label: ['Report her to the Crown', 'Донести Короне'] }, { id: 'pass', label: ['Not our business', 'Не наше дело'] }],
    outcomes: {
      bought: ['{n} bales of dreamleaf for {silver}. Keep it from the customs men.', 'Тюков дримлифа — {n} за {silver}. Держите их подальше от таможни.'],
      poor: ['You cannot pay. She slips back into the fog.', 'Заплатить нечем. Шхуна тает в тумане.'],
      reported: ['Your signal brings a Crown cutter. The informer’s fee is {silver}.', 'Ваш сигнал приводит катер Короны. Плата доносчику — {silver}.'],
      passed: ['She is gone into the fog as if she had never been.', 'Она исчезает в тумане, будто её и не было.'],
    },
  }),
  mapmaker: E({
    id: 'mapmaker', group: 'people', sight: 'raft', where: {}, weight: 4,
    title: ['A boy on a spar', 'Юнга на обломке'],
    text: ['A ship’s boy clinging to a spar, a leather tube strapped to his back. He says his captain was a mapmaker.', 'Юнга держится за обломок рея, за спиной кожаный тубус. Говорит, его капитан был картографом.'],
    choices: [{ id: 'rescue', label: ['Pull him aboard', 'Вытащить на борт'] }, { id: 'pass', label: ['Sail on', 'Пройти мимо'] }],
    outcomes: {
      map: ['He signs on as your cabin boy, and gives you what was in the tube: a piece of a chart with a cross on it.', 'Он поступает к вам юнгой и отдаёт то, что было в тубусе: клочок карты с крестиком.'],
      boy: ['He signs on as your cabin boy. The tube held only wet paper.', 'Он поступает к вам юнгой. В тубусе была лишь размокшая бумага.'],
      passed: ['You look back once. The spar is empty.', 'Вы оборачиваетесь один раз. Обломок пуст.'],
    },
  }),
  // ------------------------------------------------------------------ finds
  bottle: E({
    id: 'bottle', group: 'finds', sight: 'glint', where: {}, weight: 9,
    title: ['A bottle in the water', 'Бутылка в воде'],
    text: ['Something green bobs in your wake, corked and sealed with wax.', 'В кильватере покачивается что-то зелёное, закупоренное и залитое воском.'],
    choices: [{ id: 'fish', label: ['Fish it out', 'Выловить'] }, { id: 'pass', label: ['Let it drift', 'Пусть плывёт'] }],
    outcomes: {
      letter: ['A letter from long ago. You add it to your collection of the sea’s letters ({n} of 24).', 'Письмо из давних времён. Оно ложится в вашу коллекцию писем моря ({n} из 24).'],
      map: ['Inside, a scrap of a chart with a cross on it.', 'Внутри — клочок карты с крестиком.'],
      empty: ['Only sand and a dried seahorse.', 'Только песок и засохший морской конёк.'],
      passed: ['It drifts away on the current.', 'Течение уносит её прочь.'],
    },
  }),
  barrel: E({
    id: 'barrel', group: 'finds', sight: 'glint', where: {}, weight: 7,
    title: ['A cask adrift', 'Дрейфующий бочонок'],
    text: ['A stout cask rolling in the swell, still sealed.', 'Крепкий бочонок перекатывается на волне, всё ещё запечатанный.'],
    choices: [{ id: 'fish', label: ['Hoist it in', 'Поднять на борт'] }, { id: 'pass', label: ['Leave it', 'Оставить'] }],
    outcomes: {
      got: ['{n} of {good}, and not a drop spoiled.', '{good} — {n}, и ни капли не испорчено.'],
      full: ['There is no room in the hold for it.', 'В трюме для него нет места.'],
      passed: ['It rolls away astern.', 'Он уплывает за корму.'],
    },
  }),
  derelict: E({
    id: 'derelict', group: 'finds', sight: 'wreck', where: { fog: true }, weight: 4,
    title: ['An empty ship', 'Покинутый корабль'],
    text: ['A ship with all sail set and nobody aboard. The table in her cabin is laid for supper; the tea is still warm.', 'Корабль под всеми парусами, и на борту ни души. В каюте накрыт стол к ужину, чай ещё тёплый.'],
    choices: [{ id: 'search', label: ['Search her', 'Обыскать'] }, { id: 'leave', label: ['Leave her be', 'Не трогать'] }],
    outcomes: {
      riches: ['Her strongbox gives up {silver} and her hold {n} of {good}.', 'Её сундук отдаёт {silver}, а трюм — {good}: {n}.'],
      curse: ['Your men come back pale and will not say what they saw. The sea takes note of you.', 'Ваши люди возвращаются бледными и молчат о том, что видели. Море вас запомнило.'],
      cat: ['The only soul aboard is a ship’s cat, who walks across the plank and makes your ship his own.', 'Единственная живая душа на борту — корабельный кот. Он переходит по сходне и делает ваш корабль своим.'],
      left: ['When you look again, she is gone.', 'Когда вы оглядываетесь, её уже нет.'],
    },
  }),
  burning_ship: E({
    id: 'burning_ship', group: 'finds', sight: 'fire', where: { safety: ['contested', 'lawless'] }, weight: 5,
    title: ['A ship on fire', 'Горящий корабль'],
    text: ['A hulk burning to the waterline after some fight. Her hold may still hold something — if you are quick.', 'После какого-то боя корпус догорает до ватерлинии. В трюме ещё может что-то остаться — если поспешить.'],
    choices: [{ id: 'grab', label: ['Board her quickly', 'Быстро на абордаж'] }, { id: 'leave', label: ['Stand off', 'Держаться подальше'] }],
    outcomes: {
      grabbed: ['You haul out {n} of {good} before the flames reach it.', 'Вы вытаскиваете: {good} — {n}, прежде чем туда добирается огонь.'],
      blast: ['Her magazine goes up as your men come back over the side. Your hull is scorched.', 'Её крюйт-камера взрывается, когда ваши люди перелезают обратно. Корпус опалён.'],
      left: ['She burns down to nothing and hisses under.', 'Она сгорает дотла и с шипением уходит под воду.'],
    },
  }),
  flotsam: E({
    id: 'flotsam', group: 'finds', sight: 'debris', where: {}, weight: 7,
    title: ['Flotsam', 'Обломки на воде'],
    text: ['Spars, planks and a few crates spread over a cable’s length of water.', 'Реи, доски и несколько ящиков разбросаны по воде на кабельтов вокруг.'],
    choices: [{ id: 'gather', label: ['Gather it', 'Собрать'] }, { id: 'pass', label: ['Sail on', 'Пройти мимо'] }],
    outcomes: {
      gathered: ['Good timber for the carpenter: {n} of {good}.', 'Хороший материал для плотника: {good} — {n}.'],
      full: ['There is no room in the hold.', 'В трюме нет места.'],
      passed: ['You leave it to the gulls.', 'Вы оставляете это чайкам.'],
    },
  }),
  mine: E({
    id: 'mine', group: 'finds', sight: 'mine', where: { safety: ['contested', 'lawless'] }, weight: 4,
    title: ['A drifting mine', 'Дрейфующая мина'],
    text: ['A black ball of iron with horns, drifting on the tide. Someone’s war left it here.', 'Чёрный железный шар с рожками дрейфует по течению. Чья-то война оставила его здесь.'],
    choices: [{ id: 'shoot', label: ['Blow it up from a distance', 'Взорвать издали'] }, { id: 'powder', label: ['Hook it for its powder', 'Подцепить ради пороха'] }, { id: 'avoid', label: ['Steer clear', 'Обойти'] }],
    outcomes: {
      shot: ['A column of water and a cheer from the gun deck. The gunners are pleased with themselves.', 'Столб воды и радостный крик с орудийной палубы. Канониры довольны собой.'],
      powder: ['Delicately done: {n} of gunpowder out of it.', 'Ювелирная работа: из неё извлечено пороха — {n}.'],
      blast: ['It goes off against your side. Your hull is holed.', 'Мина взрывается у борта. В корпусе пробоина.'],
      avoided: ['You give it a wide berth.', 'Вы обходите её стороной.'],
    },
  }),
  skeleton_raft: E({
    id: 'skeleton_raft', group: 'finds', sight: 'raft', where: { safety: ['lawless'] }, weight: 4,
    title: ['A skeleton on a raft', 'Скелет на плоту'],
    text: ['A raft with a skeleton sitting against a chest, one bony hand still on the lid.', 'Плот, на нём скелет сидит, привалившись к сундуку, костлявая рука всё ещё на крышке.'],
    choices: [{ id: 'open', label: ['Open the chest', 'Открыть сундук'] }, { id: 'leave', label: ['Let him keep it', 'Пусть остаётся при нём'] }],
    outcomes: {
      silver: ['{silver} in old coin. The skeleton does not object.', '{silver} старой монетой. Скелет не возражает.'],
      trap: ['A powder trap! The chest blows apart and sets your bow on fire.', 'Пороховая ловушка! Сундук разлетается и поджигает вам нос.'],
      left: ['You leave him to his watch.', 'Вы оставляете его сторожить дальше.'],
    },
  }),
  sunken_bell: E({
    id: 'sunken_bell', group: 'finds', sight: 'bubbles', where: { regions: ['drowned_crown', 'the_abyss'] }, weight: 5,
    title: ['A bell under the water', 'Колокол под водой'],
    text: ['From below comes the slow toll of a bell, though there is nothing on the water.', 'Из-под воды доносится медленный звон колокола, хотя на воде ничего нет.'],
    choices: [{ id: 'dive', label: ['Send a diver down', 'Отправить ныряльщика'] }, { id: 'leave', label: ['Sail away from it', 'Уйти от этого места'] }],
    outcomes: {
      relic: ['Your diver comes up blue with cold and a relic in his fist: {n} of {good}.', 'Ныряльщик выныривает, посиневший от холода, с реликвией в кулаке: {good} — {n}.'],
      mad: ['Your diver comes up babbling about a city under the sea. The crew’s nerve is shaken.', 'Ныряльщик выныривает и бормочет о городе под водой. Команда в смятении.'],
      left: ['The tolling fades behind you.', 'Звон затихает за кормой.'],
    },
  }),
  signal_fire: E({
    id: 'signal_fire', group: 'finds', sight: 'beacon', where: { coast: true }, weight: 6,
    title: ['A signal fire on the shore', 'Сигнальный костёр на берегу'],
    text: ['A column of smoke from an islet no chart calls inhabited. Someone is keeping a fire going.', 'Столб дыма над островком, который ни одна карта не считает обитаемым. Кто-то поддерживает огонь.'],
    choices: [{ id: 'land', label: ['Send a boat ashore', 'Отправить шлюпку на берег'] }, { id: 'pass', label: ['Sail on', 'Пройти мимо'] }],
    outcomes: {
      hermit: ['An old hermit who has seen every ship pass for thirty years. He tells you where one of them lies.', 'Старый отшельник, тридцать лет глядящий на проходящие корабли. Он рассказывает, где лежит один из них.'],
      survivor: ['A lone survivor of a wreck, thin as a rake. He signs on gladly.', 'Единственный выживший после крушения, худой как щепка. Он охотно идёт к вам в команду.'],
      ambush: ['A trap: the fire was bait. Two pirate sloops come out from behind the islet.', 'Ловушка: костёр был приманкой. Из-за островка выходят два пиратских шлюпа.'],
      passed: ['The smoke is still there when it drops below the horizon.', 'Дым всё ещё там, когда остров скрывается за горизонтом.'],
    },
  }),
  // ------------------------------------------------------------------ nature
  dolphins: E({
    id: 'dolphins', group: 'nature', sight: 'fins', where: { regions: ['black_coast', 'gravewater', 'whispering', 'ashen_isles'], day: true }, weight: 7,
    title: ['Dolphins at the bow', 'Дельфины у форштевня'],
    text: ['A school of dolphins takes station under your bow, leaping in the bow wave.', 'Стая дельфинов идёт у вас под форштевнем, выпрыгивая из носовой волны.'],
    choices: [],
    outcomes: { blessed: ['The crew take it for luck and sail her harder: +8% speed for two minutes.', 'Команда считает это добрым знаком и гонит корабль быстрее: +8% к ходу на две минуты.'] },
  }),
  orcas_whale: E({
    id: 'orcas_whale', group: 'nature', sight: 'spout', where: { regions: ['leviathan_reach', 'gravewater'] }, weight: 5,
    title: ['Orcas hunting a whale', 'Касатки загоняют кита'],
    text: ['A pod of orcas is running down a young whale; the water is white with their hunt.', 'Стая касаток загоняет молодого кита; вода побелела от их охоты.'],
    choices: [{ id: 'save', label: ['Drive the orcas off', 'Отогнать касаток'] }, { id: 'hunt', label: ['Take the whale yourself', 'Забрать кита себе'] }, { id: 'leave', label: ['Leave the sea to itself', 'Пусть море решает само'] }],
    outcomes: {
      saved: ['A broadside over the water scatters the orcas. The whale swims beside you a while, and the Choir hears of it.', 'Залп над водой разгоняет касаток. Кит какое-то время плывёт рядом, а Хор узнаёт об этом.'],
      hunted: ['You finish what the orcas began: {n} of {good}. The Choir will not forget.', 'Вы заканчиваете то, что начали касатки: {good} — {n}. Хор этого не забудет.'],
      left: ['The hunt goes on behind you.', 'Охота продолжается за кормой.'],
    },
  }),
  squall: E({
    id: 'squall', group: 'nature', sight: 'squall', where: {}, weight: 6,
    title: ['A squall coming down', 'Шквал'],
    text: ['A black line on the water to windward, coming fast. There is time for one order.', 'Чёрная полоса на воде с наветра, и она быстро приближается. Времени — на один приказ.'],
    choices: [{ id: 'reef', label: ['Shorten sail!', 'Убрать паруса!'] }, { id: 'hold', label: ['Hold on and ride it', 'Держать и оседлать шквал'] }],
    outcomes: {
      reefed: ['It passes over with a roar and leaves you untouched.', 'Шквал проносится с рёвом и оставляет вас нетронутыми.'],
      rode: ['You ride the squall: +15% speed for a minute.', 'Вы оседлали шквал: +15% к ходу на минуту.'],
      torn: ['The squall tears your canvas: a fifth of your sails gone.', 'Шквал рвёт полотно: пятая часть парусов потеряна.'],
    },
  }),
  waterspout: E({
    id: 'waterspout', group: 'nature', sight: 'twister', where: { biomes: ['jungle', 'atoll', 'mangrove'] }, weight: 4,
    title: ['A waterspout', 'Водяной смерч'],
    text: ['A grey funnel joins sea and sky, crossing your course.', 'Серая воронка соединяет море и небо и пересекает ваш курс.'],
    choices: [{ id: 'around', label: ['Steer around it', 'Обойти'] }, { id: 'through', label: ['Go through it', 'Пройти насквозь'] }],
    outcomes: {
      around: ['You let it cross your bow at a safe distance.', 'Вы пропускаете его перед носом на безопасном расстоянии.'],
      through: ['It hammers your hull, and drops something on your deck as it passes: {item}.', 'Он бьёт по корпусу и, уходя, роняет вам на палубу: {item}.'],
      through_empty: ['It hammers your hull and leaves nothing but wet decks.', 'Он бьёт по корпусу и не оставляет ничего, кроме мокрой палубы.'],
    },
  }),
  glowing_sea: E({
    id: 'glowing_sea', group: 'nature', sight: 'glow', where: { night: true, regions: ['black_coast', 'gravewater', 'whispering', 'ashen_isles'] }, weight: 5,
    title: ['A glowing sea', 'Светящееся море'],
    text: ['Every wave breaks in blue fire; your wake is a river of light.', 'Каждая волна рассыпается голубым огнём; ваш кильватер — река света.'],
    choices: [],
    outcomes: { glow: ['The crew stand at the rail in silence. Their spirits rise, and luck is with you for a while.', 'Команда молча стоит у борта. Дух поднимается, и удача какое-то время на вашей стороне.'] },
  }),
  iceberg: E({
    id: 'iceberg', group: 'nature', sight: 'ice', where: { regions: ['leviathan_reach'] }, weight: 6,
    title: ['An iceberg', 'Айсберг'],
    text: ['A mountain of ice drifts past, and something dark is frozen in its side.', 'Мимо дрейфует ледяная гора, и в её боку вмёрзло что-то тёмное.'],
    choices: [{ id: 'boat', label: ['Send a boat to it', 'Отправить к нему шлюпку'] }, { id: 'clear', label: ['Keep well clear', 'Держаться подальше'] }],
    outcomes: {
      chest: ['A chest frozen in the ice. Chipped out, it holds {silver}.', 'В лёд вмёрз сундук. Его вырубают — внутри {silver}.'],
      seals: ['Only seals on the ice — but seals are meat: {n} provisions.', 'На льду только тюлени — но тюлени это мясо: провизии {n}.'],
      clear: ['It slides away into the mist.', 'Он уплывает в туман.'],
    },
  }),
  giant_turtle: E({
    id: 'giant_turtle', group: 'nature', sight: 'turtle', where: { biomes: ['atoll', 'jungle'] }, weight: 4,
    title: ['An island that moves', 'Остров, который движется'],
    text: ['What you took for an islet has a head as big as a longboat. A turtle older than the Crown, with a grove on its back.', 'То, что вы приняли за островок, поднимает голову размером с баркас. Черепаха старше Короны, с рощей на спине.'],
    choices: [{ id: 'land', label: ['Land on its back', 'Высадиться ей на спину'] }, { id: 'watch', label: ['Just watch it pass', 'Просто смотреть'] }],
    outcomes: {
      treasure: ['In a hollow of the shell: {n} pearls and {silver} in a rotted purse.', 'В ложбине панциря: жемчужин — {n} и {silver} в истлевшем кошеле.'],
      dived: ['It dives! Your landing party swims for it; {n} of them are lost.', 'Она ныряет! Высадка бросается вплавь; потеряно человек: {n}.'],
      watched: ['It passes slowly. The crew will talk of it for years.', 'Она медленно проплывает мимо. Команда будет говорить об этом годами.'],
    },
  }),
  sharks: E({
    id: 'sharks', group: 'nature', sight: 'fins', where: { safety: ['contested', 'lawless'] }, weight: 5,
    title: ['Sharks', 'Акулы'],
    text: ['Grey fins circle the ship, patient.', 'Серые плавники терпеливо кружат вокруг корабля.'],
    choices: [{ id: 'fish', label: ['Bait a hook', 'Наживить крюк'] }, { id: 'ignore', label: ['Keep the hands aboard', 'Никого за борт'] }],
    outcomes: {
      caught: ['Shark steak for the whole crew: {n} provisions.', 'Акулий стейк на всю команду: провизии {n}.'],
      bitten: ['The shark takes the hook — and the hand that held it. {n} provisions and one man in the surgeon’s care.', 'Акула берёт крюк — и руку, что его держала. Провизии {n}, и один человек у лекаря.'],
      ignored: ['They follow a while, then lose interest.', 'Они какое-то время следуют за вами, потом теряют интерес.'],
    },
  }),
  tentacle: E({
    id: 'tentacle', group: 'nature', sight: 'tentacle', where: { regions: LAWLESS_DEEP, open: true }, weight: 4,
    title: ['A tentacle over the rail', 'Щупальце над бортом'],
    text: ['A grey arm as thick as a mast comes over the rail and closes on your shrouds.', 'Серая рука толщиной с мачту переваливается через борт и обвивает ванты.'],
    choices: [{ id: 'hack', label: ['Hack at it (Fencing)', 'Рубить (Фехтование)'] }, { id: 'guns', label: ['Turn a gun on it', 'Развернуть пушку'] }, { id: 'cut', label: ['Cut the shrouds and run', 'Рубить ванты и уходить'] }],
    outcomes: {
      hacked: ['Axes and cutlasses do it: the arm lets go and leaves its tip on your deck — {n} of {good}.', 'Топоры и сабли делают своё: рука отпускает и оставляет на палубе свой кончик — {good}: {n}.'],
      dragged: ['It drags {n} men over the side before it lets go.', 'Прежде чем отпустить, оно утаскивает за борт человек: {n}.'],
      shot: ['The gun blows it off, and your own rail with it.', 'Выстрел отрывает его — вместе с куском вашего борта.'],
      cut: ['You cut free and run, leaving a length of rigging to the deep.', 'Вы вырываетесь и уходите, оставив глубине кусок такелажа.'],
    },
  }),
  calm: E({
    id: 'calm', group: 'nature', sight: 'calm', where: { open: true }, weight: 5,
    title: ['A dead calm', 'Мёртвый штиль'],
    text: ['The wind dies away to nothing and the sails hang like washing.', 'Ветер стихает совсем, и паруса висят, как бельё на верёвке.'],
    choices: [{ id: 'tow', label: ['Tow her with the boats', 'Буксировать шлюпками'] }, { id: 'yarns', label: ['Let them spin yarns', 'Пусть травят байки'] }],
    outcomes: {
      towed: ['An hour at the oars gets you out of it. The men are worn out.', 'Час на вёслах вытаскивает вас из штиля. Люди выбились из сил.'],
      yarns: ['The calm holds a while, but the crew are in fine spirits after it.', 'Штиль держится ещё немного, зато команда после него в отличном настроении.'],
    },
  }),
  albatross: E({
    id: 'albatross', group: 'nature', sight: 'albatross', where: { open: true }, weight: 5,
    title: ['An albatross', 'Альбатрос'],
    text: ['A great white albatross has followed you for a day, and now settles on your mainyard.', 'Огромный белый альбатрос сутки летел за вами, а теперь садится на грота-рей.'],
    choices: [{ id: 'let', label: ['Let it be', 'Не трогать'] }, { id: 'shoot', label: ['Shoot it for the pot', 'Подстрелить на ужин'] }],
    outcomes: {
      blessed: ['The old hands nod. Luck sails with you for an hour.', 'Старые матросы одобрительно кивают. Час удача идёт с вами.'],
      cursed: ['Silence on deck. The men will not look at you, and the sea has marked you.', 'На палубе тишина. Люди не смотрят на вас, а море вас пометило.'],
    },
  }),
  bird_shoal: E({
    id: 'bird_shoal', group: 'nature', sight: 'birds', where: { coast: true }, weight: 6,
    title: ['Birds over a shoal', 'Птицы над косяком'],
    text: ['Gulls wheel and dive over a patch of boiling water: a shoal right under your bow.', 'Чайки кружат и ныряют над бурлящим пятном воды: прямо под носом косяк.'],
    choices: [{ id: 'fish', label: ['Put lines over', 'Закинуть лески'] }, { id: 'pass', label: ['Sail on', 'Пройти мимо'] }],
    outcomes: {
      fished: ['Fresh fish for every mess: {n} provisions.', 'Свежая рыба на каждый стол: провизии {n}.'],
      passed: ['The gulls have it all to themselves.', 'Чайкам всё достаётся самим.'],
    },
  }),
  // ------------------------------------------------------------------ danger
  ambush: E({
    id: 'ambush', group: 'danger', sight: null, where: { safety: ['contested', 'lawless'] }, weight: 8,
    title: ['Sails on the horizon', 'Паруса на горизонте'],
    text: ['A lookout’s cry: sails to windward, and they are coming for you.', 'Крик впередсмотрящего: паруса с наветра, и они идут к вам.'],
    choices: [],
    outcomes: { come: ['Clear for action!', 'К бою!'] },
  }),
  patrol_search: E({
    id: 'patrol_search', group: 'danger', sight: 'sails', where: { safety: ['safe', 'contested'], hot: true }, weight: 6,
    title: ['A Crown patrol hails you', 'Патруль Короны требует лечь в дрейф'],
    text: ['A cutter with the Crown’s ensign fires a gun to leeward: heave to and show your hold.', 'Катер под флагом Короны даёт выстрел под ветер: лечь в дрейф и предъявить трюм.'],
    choices: [{ id: 'submit', label: ['Heave to', 'Лечь в дрейф'] }, { id: 'bribe', label: ['Offer a bribe (Trade)', 'Предложить взятку (Торговля)'] }, { id: 'run', label: ['Crack on and run', 'Поставить все паруса и уйти'] }],
    outcomes: {
      seized: ['They take what should not be aboard: {n} of it goes into the Crown’s boat.', 'Изымают то, чего не должно быть на борту: {n} уходит в шлюпку Короны.'],
      bribed: ['{silver} changes hands, and the officer sees nothing.', '{silver} переходит из рук в руки, и офицер ничего не видит.'],
      refused: ['The officer pockets nothing and takes everything: {n} seized, and your name goes in his book.', 'Офицер не берёт ни гроша и забирает всё: изъято {n}, а ваше имя — в его книгу.'],
      run: ['You crack on. The cutter comes after you, and your name goes on the Crown’s list.', 'Вы ставите все паруса. Катер идёт следом, а ваше имя — в списке Короны.'],
    },
  }),
  mutiny_brewing: E({
    id: 'mutiny_brewing', group: 'danger', sight: null, where: { lowMorale: true }, weight: 10,
    title: ['Mutterings below decks', 'Ропот в кубрике'],
    text: ['The bosun comes aft: the men are talking of a new captain. They want their share, or worse.', 'На ют приходит боцман: люди поговаривают о новом капитане. Они хотят свою долю — или хуже.'],
    choices: [{ id: 'pay', label: ['Pay them a share', 'Выплатить долю'] }, { id: 'face', label: ['Face them down (Leadership)', 'Осадить их (Лидерство)'] }, { id: 'maroon', label: ['Maroon the ringleaders', 'Высадить зачинщиков'] }],
    outcomes: {
      paid: ['{silver} across the capstan, and a cheer for the captain.', '{silver} на шпиль — и «ура» капитану.'],
      faced: ['You stand before them and they look away first. The talk stops.', 'Вы встаёте перед ними, и они первыми отводят глаза. Разговоры стихают.'],
      failed: ['They do not look away. It will take more than words.', 'Они не отводят глаз. Одних слов тут мало.'],
      marooned: ['{n} ringleaders are put in a boat with a keg of water. The rest go quiet.', 'Зачинщиков ({n}) сажают в шлюпку с бочонком воды. Остальные затихают.'],
    },
  }),
  rats: E({
    id: 'rats', group: 'danger', sight: null, where: { longVoyage: true }, weight: 4,
    title: ['Rats in the bread room', 'Крысы в хлебной кладовой'],
    text: ['The cook comes up white-faced: rats have been at the stores.', 'Кок поднимается бледный: до запасов добрались крысы.'],
    choices: [],
    outcomes: { eaten: ['{n} provisions eaten or fouled.', 'Съедено или испорчено провизии: {n}.'], cat: ['The ship’s cat has been busy: not a crumb lost.', 'Корабельный кот не терял времени: ни крошки не пропало.'] },
  }),
  galley_fire: E({
    id: 'galley_fire', group: 'danger', sight: null, where: {}, weight: 3,
    title: ['Fire in the galley!', 'Пожар на камбузе!'],
    text: ['Smoke pours up the fore hatch: the galley stove has overturned.', 'Из носового люка валит дым: опрокинулась камбузная печь.'],
    choices: [{ id: 'fight', label: ['All hands to the buckets!', 'Все к вёдрам!'] }, { id: 'flood', label: ['Flood the fore hold', 'Затопить носовой трюм'] }],
    outcomes: {
      out: ['The fire is out in minutes. The cook will not live it down.', 'Пожар потушен за минуты. Коку этого не забудут.'],
      burned: ['It is out, but {n} men are burned.', 'Потушили, но обожжено человек: {n}.'],
      flooded: ['The fire drowns, and so does a part of your stores: {n} provisions spoiled.', 'Огонь тонет, а с ним и часть запасов: испорчено провизии {n}.'],
    },
  }),
  // ------------------------------------------------------------------ the uncanny
  ghost_bargain: E({
    id: 'ghost_bargain', group: 'mystic', sight: 'ghostlight', where: { night: true, regions: LAWLESS_DEEP }, weight: 4,
    title: ['A bargain from the drowned', 'Сделка с утопленниками'],
    text: ['A pale ship comes alongside without a sound. Her captain, water running from his coat, holds out a gift — and asks nothing, yet.', 'Бледный корабль бесшумно подходит к борту. Её капитан, с камзола которого стекает вода, протягивает дар — и пока ничего не просит.'],
    choices: [{ id: 'accept', label: ['Accept the gift', 'Принять дар'] }, { id: 'refuse', label: ['Refuse him', 'Отказаться'] }, { id: 'fight', label: ['Open fire', 'Открыть огонь'] }],
    outcomes: {
      accepted: ['{item} is yours. The sea’s claim on you grows.', '{item} теперь ваш. Права моря на вас растут.'],
      refused: ['He bows and the fog swallows his ship.', 'Он кланяется, и туман поглощает его корабль.'],
      fight: ['His ship turns her guns on you.', 'Его корабль разворачивает к вам орудия.'],
    },
  }),
  sirens: E({
    id: 'sirens', group: 'mystic', sight: 'song', where: { fog: true, coast: true }, weight: 4,
    title: ['Singing on the rocks', 'Пение на скалах'],
    text: ['Out of the fog, from the rocks, comes a song no woman on land ever sang. The helmsman’s hands turn the wheel by themselves.', 'Из тумана, со скал, доносится песня, какой не пела ни одна женщина на суше. Руки рулевого сами поворачивают штурвал.'],
    choices: [{ id: 'hold', label: ['Take the helm yourself (Navigation)', 'Самому встать к штурвалу (Навигация)'] }, { id: 'wax', label: ['Wax in every ear', 'Воск в уши всем'] }, { id: 'listen', label: ['Listen', 'Слушать'] }],
    outcomes: {
      held: ['You hold her off the rocks, and the song fades behind you.', 'Вы удерживаете корабль у скал, и песня стихает за кормой.'],
      aground: ['You cannot hold her. She grinds on the rocks before you get her off.', 'Удержать не удаётся. Прежде чем вы снимаетесь, корабль скрежещет по камням.'],
      waxed: ['A deaf crew sails a deaf ship past the rocks. Nobody enjoys it.', 'Глухая команда проводит глухой корабль мимо скал. Удовольствия никакого.'],
      listened: ['You listen. It is the most beautiful thing you have ever heard, and your mind is not quite your own afterwards. At dawn there are pearls on the deck: {n}.', 'Вы слушаете. Это прекраснее всего, что вы слышали, и потом разум ваш уже не совсем ваш. На рассвете на палубе жемчуг: {n}.'],
    },
  }),
  wisps: E({
    id: 'wisps', group: 'mystic', sight: 'wisps', where: { night: true, biomes: ['mangrove', 'mossy', 'fungal'] }, weight: 4,
    title: ['Lights among the roots', 'Огоньки среди корней'],
    text: ['Blue lights drift among the mangrove roots, going ahead of you, waiting when you slow.', 'Голубые огоньки плывут среди корней мангров, уходят вперёд и ждут, когда вы сбавляете ход.'],
    choices: [{ id: 'follow', label: ['Follow them', 'Идти за ними'] }, { id: 'ignore', label: ['Hold your course', 'Держать курс'] }],
    outcomes: {
      treasure: ['They lead you to a cairn on a sandbar, and under it an old chart.', 'Они приводят вас к груде камней на отмели, а под ней — старая карта.'],
      aground: ['They lead you onto a mudbank and go out. It takes an hour to kedge her off.', 'Они заводят вас на илистую мель и гаснут. Сниматься приходится целый час.'],
      ignored: ['The lights drift away into the dark.', 'Огоньки уплывают в темноту.'],
    },
  }),
  voice_in_fog: E({
    id: 'voice_in_fog', group: 'mystic', sight: 'fog', where: { fog: true }, weight: 5,
    title: ['A voice in the fog', 'Голос из тумана'],
    text: ['Someone out in the fog is calling your name. Not your ship’s — yours.', 'Кто-то в тумане зовёт вас по имени. Не корабль — вас.'],
    choices: [{ id: 'answer', label: ['Answer', 'Откликнуться'] }, { id: 'silent', label: ['Keep silent', 'Молчать'] }],
    outcomes: {
      rumor: ['The voice tells you where something lies, and falls silent. The chart shows the place.', 'Голос говорит, где что-то лежит, и умолкает. Место отмечено на карте.'],
      fear: ['The voice laughs. The crew cross themselves and will not meet your eye.', 'Голос смеётся. Команда крестится и не смотрит вам в глаза.'],
      silent: ['The calling goes on a while, then stops.', 'Зов звучит ещё какое-то время, потом смолкает.'],
    },
  }),
};

export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS) as EncounterId[];

/** The letters of the sea (docs/12 P2): found in bottles, collected in the journal. */
export const SEA_LETTERS: Tr[] = [
  ['“To whoever finds this: the Mary Dane went down off the Teeth. Tell my wife I kept her ring.”', '«Тому, кто найдёт: «Мэри Дейн» затонула у Зубов. Передайте жене, что кольцо её я сохранил.»'],
  ['“I buried it under the leaning palm. The palm is gone now. God help me.”', '«Я закопал его под наклонной пальмой. Пальмы больше нет. Господи, помоги.»'],
  ['“Mother — I am a sailor now. Do not believe what they say of us.”', '«Мама, я теперь моряк. Не верь тому, что про нас говорят.»'],
  ['“Day forty. The water tastes of rust. The captain talks to someone who is not there.”', '«День сороковой. Вода отдаёт ржавчиной. Капитан разговаривает с кем-то, кого нет.»'],
  ['“If you are reading this, the Choir was right, and the sea remembers.”', '«Если вы это читаете, значит, Хор был прав: море помнит.»'],
  ['“Owed to Jack Harrow, two hundred silver and a pair of boots. Pay it to his daughter.”', '«Должен Джеку Харроу двести серебра и пару сапог. Отдайте его дочери.»'],
  ['“The lighthouse keeper on Grey Holm is a murderer. Tell the Admiralty.”', '«Смотритель маяка на Сером Холме — убийца. Сообщите Адмиралтейству.»'],
  ['“We saw the Kraken’s eye open under the ship. It was the size of a church door.”', '«Мы видели, как под днищем открылся глаз Кракена. Он был размером с церковную дверь.»'],
  ['“My dearest — the voyage is long, but every wave brings me nearer. Wait for me at the quay.”', '«Любимая, путь долог, но каждая волна приближает меня. Жди меня на причале.»'],
  ['“Salt pork, 3 barrels. Rum, 2. Hope, none.”', '«Солонины — 3 бочки. Рома — 2. Надежды — ни одной.»'],
  ['“The silver galleon sails at the dark of the moon. Do not tell Vex I told you.”', '«Серебряный галеон выходит в новолуние. Не говорите Вексу, что это я сказал.»'],
  ['“I am the last. The others went into the fog, singing.”', '«Я последний. Остальные ушли в туман, распевая песни.»'],
  ['“A recipe for grog that cures the scurvy and the blues: lime, rum, and a good captain.”', '«Рецепт грога от цинги и хандры: лайм, ром и хороший капитан.»'],
  ['“The map is a lie. The cross is a lie. The treasure is the friends we drowned along the way.”', '«Карта лжёт. Крестик лжёт. Сокровище — это друзья, которых мы утопили по дороге.»'],
  ['“Forgive me, brother. I took the Lark and left you on the beach. She sank anyway.”', '«Прости, брат. Я увёл «Жаворонка», а тебя оставил на берегу. Она всё равно затонула.»'],
  ['“Beware the woman with the silver hook. She collects more than debts.”', '«Берегитесь женщины с серебряным крюком. Она собирает не только долги.»'],
  ['“Found an island that moved. Nobody believes me. You won’t either.”', '«Нашёл остров, который двигался. Мне никто не верит. И вы не поверите.»'],
  ['“Latitude unknown. Longitude unknown. Spirits high.”', '«Широта неизвестна. Долгота неизвестна. Настроение отличное.»'],
  ['“To the League: your insurance does not cover krakens. We checked.”', '«Лиге: ваша страховка не покрывает кракенов. Мы проверили.»'],
  ['“A wager: whoever finds this owes me a drink at Saltmarrow. — Old Tam.”', '«Пари: кто найдёт это, тот должен мне выпивку в Солтмарроу. — Старый Тэм.»'],
  ['“The drowned walk on the water at midwinter. We saw them. We rowed faster.”', '«В середине зимы утопленники ходят по воде. Мы видели. Мы гребли быстрее.»'],
  ['“Let it be known that the Hollow Admiral once had a name, and it was Drey.”', '«Да будет известно, что у Пустого Адмирала когда-то было имя, и имя это — Дрей.»'],
  ['“The pearls are real. The sharks are real. Choose.”', '«Жемчуг настоящий. Акулы тоже. Выбирайте.»'],
  ['“Whoever you are, sailor: the sea is wide, and you are not alone on it.”', '«Кто бы ты ни был, моряк: море широкое, и ты на нём не один.»'],
];

/** The server's lines about encounters, English → Russian. */
export function encounterPatterns(): [string, string][] {
  return [
    ['That moment has passed', 'Этот миг уже прошёл'],
    ['No such choice', 'Такого выбора нет'],
    ['harboured a convict', 'укрыли каторжника'],
    ['offered a bribe to the Crown', 'предложили взятку Короне'],
    ['ran from a Crown patrol', 'ушли от патруля Короны'],
  ];
}
