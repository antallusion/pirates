// The world's armies (owner, 2026-10-02: «about a hundred different creatures», the battle as in Heroes): every
// faction that sails the sea fields its own men — the Crown's marines and divers, the Choir's zealots and heralds, the
// Harpoon's whalers, the Fog Brokers' knives, the Ledger's hired arms, the Free Harbors' islanders and the Dutchman's
// ghosts. Each of their kinds stands in for one of the pirate crew's kinds (its role in the line: the hands, the
// marines, the shooters, the guns, the boarders, the guard, the dead) and fights with exactly its numbers and
// specials, so a crew of the Crown is as strong as a pirate crew of the same make — only its face and its name are
// its own. Their painted figures are tools/art/creatures.py's.

import type { MenId } from './army.ts';

/** Who fields them: the sea's factions, and the Dutchman's dead. */
export type Roster = 'crown' | 'choir' | 'harpoon' | 'brokers' | 'league' | 'free' | 'dutchman';

/** Every faction kind and the pirate kind whose place (and numbers) it takes. */
export const FACTION_KINDS = {
  // The Crown Admiralty.
  crown_boy: { roster: 'crown', as: 'deckhand' },
  crown_drummer: { roster: 'crown', as: 'sailor' },
  crown_marine: { roster: 'crown', as: 'marine' },
  crown_ironclad: { roster: 'crown', as: 'sea_guard' },
  crown_line: { roster: 'crown', as: 'musketeer' },
  crown_rifleman: { roster: 'crown', as: 'sharpshooter' },
  crown_mortar: { roster: 'crown', as: 'gunner' },
  crown_rocketeer: { roster: 'crown', as: 'bombardier' },
  crown_grenadier: { roster: 'crown', as: 'boarder' },
  crown_inquisitor: { roster: 'crown', as: 'cutthroat' },
  crown_chaplain: { roster: 'crown', as: 'guard' },
  crown_cuirassier: { roster: 'crown', as: 'life_guard' },
  crown_diver: { roster: 'crown', as: 'drowned' },
  crown_dreadnought: { roster: 'crown', as: 'deep_spawn' },
  // The Choir of the Deep (its drowned are the drowned).
  choir_acolyte: { roster: 'choir', as: 'deckhand' },
  choir_bellringer: { roster: 'choir', as: 'sailor' },
  tide_zealot: { roster: 'choir', as: 'marine' },
  deep_zealot: { roster: 'choir', as: 'sea_guard' },
  choir_chanter: { roster: 'choir', as: 'musketeer' },
  choir_cantor: { roster: 'choir', as: 'sharpshooter' },
  brine_witch: { roster: 'choir', as: 'gunner' },
  storm_witch: { roster: 'choir', as: 'bombardier' },
  deep_one: { roster: 'choir', as: 'boarder' },
  deep_one_champion: { roster: 'choir', as: 'cutthroat' },
  drowned_priest: { roster: 'choir', as: 'guard' },
  deep_abbot: { roster: 'choir', as: 'life_guard' },
  abyss_herald: { roster: 'choir', as: 'deep_spawn' },
  // The Order of the Harpoon.
  flenser: { roster: 'harpoon', as: 'deckhand' },
  boat_steerer: { roster: 'harpoon', as: 'sailor' },
  lancer: { roster: 'harpoon', as: 'marine' },
  baleen_knight: { roster: 'harpoon', as: 'sea_guard' },
  harpooner: { roster: 'harpoon', as: 'musketeer' },
  master_harpooner: { roster: 'harpoon', as: 'sharpshooter' },
  net_thrower: { roster: 'harpoon', as: 'gunner' },
  harpoon_gunner: { roster: 'harpoon', as: 'bombardier' },
  leviathan_slayer: { roster: 'harpoon', as: 'boarder' },
  net_master: { roster: 'harpoon', as: 'cutthroat' },
  // The Fog Brokers.
  smuggler: { roster: 'brokers', as: 'deckhand' },
  fog_runner: { roster: 'brokers', as: 'sailor' },
  fog_thief: { roster: 'brokers', as: 'marine' },
  fog_shadow: { roster: 'brokers', as: 'sea_guard' },
  poisoner: { roster: 'brokers', as: 'musketeer' },
  alchemist: { roster: 'brokers', as: 'sharpshooter' },
  duelist: { roster: 'brokers', as: 'boarder' },
  assassin: { roster: 'brokers', as: 'cutthroat' },
  fog_master: { roster: 'brokers', as: 'guard' },
  bravo: { roster: 'brokers', as: 'life_guard' },
  // The Gilded Ledger.
  porter: { roster: 'league', as: 'deckhand' },
  dock_bruiser: { roster: 'league', as: 'sailor' },
  company_guard: { roster: 'league', as: 'marine' },
  ledger_halberdier: { roster: 'league', as: 'sea_guard' },
  arquebusier: { roster: 'league', as: 'musketeer' },
  company_musketeer: { roster: 'league', as: 'sharpshooter' },
  enforcer: { roster: 'league', as: 'boarder' },
  debt_collector: { roster: 'league', as: 'cutthroat' },
  paymaster: { roster: 'league', as: 'guard' },
  gilded_cuirassier: { roster: 'league', as: 'life_guard' },
  // The Free Harbors.
  fisher: { roster: 'free', as: 'deckhand' },
  spear_fisher: { roster: 'free', as: 'sailor' },
  sharktooth: { roster: 'free', as: 'marine' },
  island_warrior: { roster: 'free', as: 'sea_guard' },
  blowgun_hunter: { roster: 'free', as: 'musketeer' },
  island_archer: { roster: 'free', as: 'sharpshooter' },
  tide_shaman: { roster: 'free', as: 'gunner' },
  tide_caller: { roster: 'free', as: 'bombardier' },
  basalt_guardian: { roster: 'free', as: 'life_guard' },
  // The Dutchman's dead (the ghost ships; their drowned are the drowned).
  ghost_sailor: { roster: 'dutchman', as: 'deckhand' },
  ghost_bosun: { roster: 'dutchman', as: 'sailor' },
  dutchman_boarder: { roster: 'dutchman', as: 'marine' },
  ghost_musketeer: { roster: 'dutchman', as: 'musketeer' },
  phantom_gunner: { roster: 'dutchman', as: 'gunner' },
  lantern_wraith: { roster: 'dutchman', as: 'boarder' },
  drowned_officer: { roster: 'dutchman', as: 'guard' },
  dutchman_mate: { roster: 'dutchman', as: 'deep_spawn' },
} as const satisfies Record<string, { roster: Roster; as: MenId }>;

export type FactionKindId = keyof typeof FACTION_KINDS;
export const FACTION_KIND_IDS = Object.keys(FACTION_KINDS) as FactionKindId[];

/** A roster's kind in a pirate kind's place (none: the pirate kind itself serves). */
const SWAP = new Map<string, FactionKindId>();
for (const id of FACTION_KIND_IDS) SWAP.set(`${FACTION_KINDS[id].roster}:${FACTION_KINDS[id].as}`, id);
export function rosterKind<T extends string>(roster: Roster | null, u: T): T | FactionKindId {
  return (roster && SWAP.get(`${roster}:${u}`)) || u;
}

/** Their names (as a stack: plural) and a line on each — English, Russian. */
export const FACTION_NAMES: Record<FactionKindId, [string, string, string, string]> = {
  crown_boy: ['Powder monkeys', 'Пороховые юнги', "The Crown's ship's boys: a dirk and quick feet.", 'Корабельные юнги Короны: кортик и быстрые ноги.'],
  crown_drummer: ['Drummers', 'Барабанщики', "Drummer boys who beat the Crown's men into line.", 'Барабанщики, что держат строй Короны.'],
  crown_marine: ['Crown marines', 'Морпехи Короны', 'Drilled marines in navy blue: bayonet and discipline.', 'Вымуштрованные морпехи в синем: штык и дисциплина.'],
  crown_ironclad: ['Admiralty ironclads', 'Латники Адмиралтейства', 'Marines in riveted plate behind tower shields: shot does them half the harm.', 'Морпехи в клёпаных латах за ростовыми щитами: пули вредят вдвое меньше.'],
  crown_line: ['Line infantry', 'Линейные стрелки', "The Crown's line: steady volleys, poor at arm's length.", 'Линия Короны: ровные залпы, слабы вплотную.'],
  crown_rifleman: ['Riflemen', 'Егеря', 'Marksmen in green: no range too long, no foe too close.', 'Стрелки в зелёном: им не далеко и не близко.'],
  crown_mortar: ['Mortar crews', 'Мортирщики', 'A coehorn on the deck: its bomb bursts on a stack and those beside it.', 'Мортирка на палубе: бомба рвётся на отряде и соседях.'],
  crown_rocketeer: ['Rocketeers', 'Ракетчики', 'Congreve rockets: a burst on a stack and those beside it.', 'Ракеты Конгрива: разрыв на отряде и соседях.'],
  crown_grenadier: ['Grenadiers', 'Гренадеры', 'Tall men in mitre caps: a grenade, then the sword — two blows for every one of yours.', 'Рослые парни в митрах: граната, потом тесак — два удара на каждый ваш.'],
  crown_inquisitor: ['Inquisitors', 'Инквизиторы', 'Witch-hunters of the Crown: they strike twice and are never answered.', 'Охотники на ведьм Короны: бьют дважды, им не отвечают.'],
  crown_chaplain: ['Naval chaplains', 'Корабельные капелланы', "The chaplain's censer: the Crown's men fight harder beside him.", 'Кадило капеллана: рядом с ним люди Короны бьются злее.'],
  crown_cuirassier: ['Cuirassiers', 'Кирасиры', 'Officers in black steel: they answer every blow.', 'Офицеры в чёрной стали: отвечают на каждый удар.'],
  crown_diver: ['Brass divers', 'Латунные водолазы', 'Men in brass diving suits walking up out of the deep: no fear in them, and terror in the living.', 'Люди в латунных скафандрах выходят из глубины: им не страшно, а живым страшно.'],
  crown_dreadnought: ['Dreadnought divers', 'Водолазы-дредноуты', 'Iron giants of the Admiralty: they sweep the deck about them.', 'Железные великаны Адмиралтейства: сметают всех вокруг.'],
  choir_acolyte: ['Acolytes', 'Послушники', 'Novices of the drowned god: a curved knife and a bell.', 'Послушники утонувшего бога: кривой нож и колокольчик.'],
  choir_bellringer: ['Bellringers', 'Звонари', "They carry the Choir's bells into the fight.", 'Несут в бой колокола Хора.'],
  tide_zealot: ['Tide zealots', 'Фанатики прилива', 'Masked zealots with hooked spears.', 'Фанатики в масках с крючковатыми копьями.'],
  deep_zealot: ['Deep zealots', 'Фанатики глубин', 'Coral masks and shell shields: shot does them half the harm.', 'Коралловые маски и щиты из раковин: пули вредят вдвое меньше.'],
  choir_chanter: ['Chanters', 'Певчие', "Their conches send the deep's voice across the deck, poor at arm's length.", 'Их раковины шлют через палубу голос глубин; вплотную слабы.'],
  choir_cantor: ['Cantors', 'Канторы', "The Choir's voices: no range too long, no foe too close.", 'Голоса Хора: им не далеко и не близко.'],
  brine_witch: ['Brine witches', 'Солёные ведьмы', 'A jet of cold brine bursts on a stack and those beside it.', 'Струя ледяного рассола бьёт по отряду и соседям.'],
  storm_witch: ['Storm witches', 'Ведьмы бурь', "A fork of the storm's fire across a stack and those beside it.", 'Вилка небесного огня по отряду и соседям.'],
  deep_one: ['Deep ones', 'Глубинные', 'Fish-men with tridents: two blows for every one of yours.', 'Рыболюди с трезубцами: два удара на каждый ваш.'],
  deep_one_champion: ['Deep one champions', 'Чемпионы глубин', 'They strike twice and are never answered.', 'Бьют дважды, им не отвечают.'],
  drowned_priest: ['Drowned priests', 'Утопшие жрецы', 'The Choir fights harder under their crozier.', 'Под их посохом Хор бьётся злее.'],
  deep_abbot: ['Abbots of the deep', 'Аббаты глубин', 'Towering in sodden vestments: they answer every blow.', 'Высятся в мокрых облачениях: отвечают на каждый удар.'],
  abyss_herald: ['Heralds of the abyss', 'Вестники бездны', 'Coral and black stone in a hood: they sweep the deck about them.', 'Коралл и чёрный камень под капюшоном: сметают всех вокруг.'],
  flenser: ['Flensers', 'Разделочники', 'Whalers with flensing spades.', 'Китобои с разделочными лопатами.'],
  boat_steerer: ['Boat steerers', 'Рулевые вельботов', 'The steering oar makes a fine quarterstaff.', 'Рулевое весло — отличный шест.'],
  lancer: ['Whaling lancers', 'Китобои-копейщики', "Lances for the whale's heart, turned on men.", 'Копья для сердца кита, обращённые против людей.'],
  baleen_knight: ['Baleen knights', 'Рыцари Гарпуна', 'Knights of the Order behind round shields: shot does them half the harm.', 'Рыцари Ордена за круглыми щитами: пули вредят вдвое меньше.'],
  harpooner: ['Harpooners', 'Гарпунёры', "Irons thrown from afar, poor at arm's length.", 'Гарпуны издалека, слабы вплотную.'],
  master_harpooner: ['Master harpooners', 'Мастера-гарпунёры', 'Old hands with the iron: no range too long, no foe too close.', 'Старые мастера гарпуна: им не далеко и не близко.'],
  net_thrower: ['Net throwers', 'Метатели сетей', 'A weighted net over a stack and those beside it.', 'Утяжелённая сеть на отряд и соседей.'],
  harpoon_gunner: ['Harpoon gunners', 'Гарпунные стрелки', 'The harpoon gun: its line tears through a stack and those beside it.', 'Гарпунная пушка: линь рвёт отряд и соседей.'],
  leviathan_slayer: ['Leviathan slayers', 'Убийцы левиафанов', 'Giants with harpoon-axes: two blows for every one of yours.', 'Великаны с гарпунными топорами: два удара на каждый ваш.'],
  net_master: ['Net masters', 'Мастера сетей', 'A netted foe cannot answer: they strike twice, unanswered.', 'Опутанный не ответит: бьют дважды, без ответа.'],
  smuggler: ['Smugglers', 'Контрабандисты', 'A sack, a knife and no questions.', 'Мешок, нож и никаких вопросов.'],
  fog_runner: ['Fog runners', 'Туманные бегуны', 'Two short knives and light feet.', 'Два коротких ножа и лёгкие ноги.'],
  fog_thief: ['Fog thieves', 'Туманные воры', 'Masked thieves with smoke bombs and short swords.', 'Воры в масках с дымовыми бомбами и короткими мечами.'],
  fog_shadow: ['Shadows', 'Тени', 'Wrapped in grey: shot does them half the harm.', 'Закутаны в серое: пули вредят вдвое меньше.'],
  poisoner: ['Poisoners', 'Отравители', "Darts from a blowpipe, poor at arm's length.", 'Дротики из трубки, слабы вплотную.'],
  alchemist: ['Alchemists', 'Алхимики', 'Flasks that burst anywhere: no range too long, no foe too close.', 'Колбы, что рвутся где угодно: им не далеко и не близко.'],
  duelist: ['Duelists', 'Дуэлянты', 'Rapier and dagger: two blows for every one of yours.', 'Рапира и дага: два удара на каждый ваш.'],
  assassin: ['Assassins', 'Убийцы', 'Twin stilettos: they strike twice and are never answered.', 'Два стилета: бьют дважды, им не отвечают.'],
  fog_master: ['Fog masters', 'Мастера тумана', 'The Brokers fight harder with their master watching.', 'Под взглядом мастера Маклеры бьются злее.'],
  bravo: ['Bravos', 'Бретёры', 'Swaggering blades: they answer every blow.', 'Задиристые клинки: отвечают на каждый удар.'],
  porter: ['Dock porters', 'Портовые грузчики', 'Broad backs and iron-bound cudgels.', 'Широкие спины и окованные дубинки.'],
  dock_bruiser: ['Dock bruisers', 'Портовые громилы', 'Brass knuckles on both fists.', 'Кастеты на обоих кулаках.'],
  company_guard: ['Company guards', 'Стражники Компании', "The Ledger's guards in black and gold, with pikes.", 'Стража Книги в чёрном с золотом, с пиками.'],
  ledger_halberdier: ['Ledger halberdiers', 'Алебардщики Книги', 'Gilded halberds in a wall: shot does them half the harm.', 'Стена золочёных алебард: пули вредят вдвое меньше.'],
  arquebusier: ['Arquebusiers', 'Аркебузиры', "Heavy arquebuses on forked rests, poor at arm's length.", 'Тяжёлые аркебузы на сошках, слабы вплотную.'],
  company_musketeer: ['Company musketeers', 'Мушкетёры Компании', 'Gilded locks, steady aim: no range too long, no foe too close.', 'Золочёные замки, твёрдая рука: им не далеко и не близко.'],
  enforcer: ['Enforcers', 'Каратели', 'War hammers for debts: two blows for every one of yours.', 'Боевые молоты за долги: два удара на каждый ваш.'],
  debt_collector: ['Debt collectors', 'Сборщики долгов', 'The flail comes twice and is never answered.', 'Цеп приходит дважды, ему не отвечают.'],
  paymaster: ['Paymasters', 'Казначеи', "The Ledger's men fight harder while the strongbox is open.", 'Пока сундук открыт, люди Книги бьются злее.'],
  gilded_cuirassier: ['Gilded cuirassiers', 'Золочёные кирасиры', 'Mercenaries in gold-chased plate: they answer every blow.', 'Наёмники в чеканных латах: отвечают на каждый удар.'],
  fisher: ['Fishers', 'Рыбаки', 'Islanders with gaff hooks.', 'Островитяне с багорами.'],
  spear_fisher: ['Spear fishers', 'Острогеры', 'The fishing spear is quick in a fight.', 'Острога быстра и в драке.'],
  sharktooth: ['Sharktooth warriors', 'Воины акульего зуба', 'Clubs edged with shark teeth.', 'Дубины с рядами акульих зубов.'],
  island_warrior: ['Island warriors', 'Островные воины', 'Spears behind oval shields: shot does them half the harm.', 'Копья за овальными щитами: пули вредят вдвое меньше.'],
  blowgun_hunter: ['Blowgun hunters', 'Охотники с трубками', "Darts from the reeds, poor at arm's length.", 'Дротики из тростника, слабы вплотную.'],
  island_archer: ['Island archers', 'Островные лучники', 'Tall bows: no range too long, no foe too close.', 'Высокие луки: им не далеко и не близко.'],
  tide_shaman: ['Tide shamans', 'Шаманы прилива', 'A spray of the sea over a stack and those beside it.', 'Брызги моря на отряд и соседей.'],
  tide_caller: ['Tide callers', 'Зовущие прилив', 'The conch calls a wave over a stack and those beside it.', 'Раковина зовёт волну на отряд и соседей.'],
  basalt_guardian: ['Basalt guardians', 'Базальтовые стражи', 'Stone bound with roots: they answer every blow.', 'Камень, скреплённый корнями: отвечают на каждый удар.'],
  ghost_sailor: ['Ghost sailors', 'Призрачные матросы', "The Dutchman's crew, pale and cold.", 'Команда «Голландца», бледная и холодная.'],
  ghost_bosun: ['Ghost bosuns', 'Призрачные боцманы', "The rope's end still stings.", 'Линёк и после смерти жалит.'],
  dutchman_boarder: ['Dutchman boarders', 'Абордажники «Голландца»', 'Barnacled axes and broken shields.', 'Топоры в ракушках и разбитые щиты.'],
  ghost_musketeer: ['Ghost musketeers', 'Призрачные мушкетёры', "Muskets that fire green smoke, poor at arm's length.", 'Мушкеты, что палят зелёным дымом, слабы вплотную.'],
  phantom_gunner: ['Phantom gunners', 'Фантомные канониры', 'A drowned cannon: its shot bursts on a stack and those beside it.', 'Утопленная пушка: ядро рвётся на отряде и соседях.'],
  lantern_wraith: ['Lantern wraiths', 'Фонарные призраки', 'Cold green fire: two blows for every one of yours.', 'Холодный зелёный огонь: два удара на каждый ваш.'],
  drowned_officer: ['Drowned officers', 'Утопшие офицеры', 'The dead fight harder under their old officers.', 'Под старыми офицерами мёртвые бьются злее.'],
  dutchman_mate: ["Dutchman's mates", 'Старпомы «Голландца»', 'A towering ghost with an anchor hook: he sweeps the deck about him.', 'Призрак-великан с якорным крюком: сметает всех вокруг.'],
};
