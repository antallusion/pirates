// The hero in the boarding battle — her path, her book (docs/18 I, items 1–12). Each of the six captains' paths
// brings its own battle identity onto the HoMM3-style deck fight of docs/17:
//
//  1. An innate move, once a battle and free (no will, no stamina): the corsair's Last Volley, the smuggler's Smoke
//     Screen, the Reaver's Blood Harvest, the navigator's Following Squall, the Drowned's Call of the Depths, the
//     Black Admiral's Line.
//  2. Each path has a home school among the order book's six. The four of H2 stay (fire and powder, wind, water and
//     the deep, steel and men) and two are added beside them (the hook and the boarding; fog and shadow). Three
//     schools are physical, three magical. Her home school is cheaper and stronger for her (HoMM3's native magic);
//     another path's page costs her more.
//  3. Six path books of six pages, levels 1–5, three physical and three magical a path: a fresh page opens as her
//     hero grows (PAGE_UNLOCK); the common pages of docs/17 stay common.
//  4. Stamina beside Will: physical moves spend Stamina (her Attack and Defense make it; it comes back a share every
//     round, and whole with rest), magical ones spend Will as before.
//  5. Her path's ultimate from hero level 20: once a battle, a great effect, drawn with the battle's own procedural
//     effects (client/src/ui/tactical.ts).
//  6. Talents: two or three nodes in every tree also lift her path book in the battle (TALENT_BOOK). Their sea side
//     is untouched.
//  7. The officers' own small abilities on their stacks live in shared/src/data/tactical.ts (TAC_ORDER_OF).
//  8. Named captains of the sea — pirates, barons, hunters — fight with paths and books (npcPathOf).
// 10. Scrolls of pages from lairs and bosses (each a page for one battle cast), and another path's page taught at a
//     guild for twice the price.
//
// Pure data and reckoning; the battle applies it in server/src/game/tacbattle.ts, the hero keeps it in
// server/src/game/hero.ts and server/src/game/pathbook.ts.

import type { CaptainId } from './captains.ts';

/** The order book's six schools (docs/17 H2's four, and the two the paths add). */
export type School = 'fire' | 'wind' | 'water' | 'steel' | 'board' | 'fog';
/** Physical (Stamina) or magical (Will). */
export type SchoolKind = 'phys' | 'magic';
export const SCHOOL_KIND: Record<School, SchoolKind> = { fire: 'phys', steel: 'phys', board: 'phys', wind: 'magic', water: 'magic', fog: 'magic' };
/** Each path's home school. */
export const PATH_SCHOOL: Record<CaptainId, School> = { corsair: 'fire', reaver: 'board', admiral: 'steel', navigator: 'wind', drowned: 'water', smuggler: 'fog' };
export const PATH_KIND: Record<CaptainId, SchoolKind> = { corsair: 'phys', reaver: 'phys', admiral: 'phys', navigator: 'magic', drowned: 'magic', smuggler: 'magic' };
export const PATH_IDS: CaptainId[] = ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'];

/** Her home school: its orders this much stronger and this much cheaper (HoMM3's native magic). */
export const HOME_MUL = 1.1;
export const HOME_COST = 0.85;
/** Another path's own page: this much dearer. */
export const FOREIGN_COST = 1.5;
/** Another path's page at a guild: twice the price of a common order of its level. */
export const FOREIGN_PRICE = 2;

/** What a move lays on stacks for a while (summed over everything that holds). Shares are fractions (+0.2 = 20%). */
export interface BtMods {
  /** Her blows (and the answers) and her shots, harder by a share. */
  melee?: number;
  shot?: number;
  /** Damage she takes, more (+) or less (−) by a share; and from shots only. */
  taken?: number;
  shotTaken?: number;
  speed?: number;
  init?: number;
  /** Morale and luck points. */
  morale?: number;
  luck?: number;
  /** Her shooters cannot see to fire. */
  blind?: boolean;
  /** Her blows draw no answer. */
  noRet?: boolean;
  /** She cannot answer a blow. */
  noAnswer?: boolean;
  /** She never freezes in fear. */
  steady?: boolean;
}
export type BtModKey = keyof BtMods;

/** What a page, an innate move or an ultimate does when given. Damage is a share of the captain's blast (a share of
 *  her side's strength as it came aboard, the ladder on it, her Power and school on it); heals are shares of each
 *  stack's strength. `rounds` 0: for this round only; 1: this round and the next (as the H2 orders hold). */
export interface PageFx {
  target: 'enemy' | 'own' | 'none';
  /** A blow on the target, and half-blows on those beside it. */
  dmg?: number;
  ring?: number;
  /** A blow on every one of her stacks; on her shooters only. */
  all?: number;
  shooters?: number;
  /** A share of every one of her stacks dragged down (men, not damage). */
  drain?: number;
  /** Every stack of hers heals a share; `raise` stands the fallen up again, the dead men too. */
  heal?: number;
  raise?: number;
  /** On her own side, on hers, on the stack pointed at. */
  self?: BtMods;
  foe?: BtMods;
  one?: BtMods;
  rounds?: number;
  /** The stack pointed at acts again this round; every stack of hers acts once more (or, `allShare`, her strongest
   *  share of them). */
  again?: boolean;
  allAgain?: boolean;
  allShare?: number;
  /** Her side's next blows draw no answer (how many; a weak hand fewer). */
  free?: number;
  /** The crew's heart (0..100) up, hers down. */
  heart?: number;
  dread?: number;
}

/** A page of a path book (an order of the book, shared/src/data/hero.ts makes it one). */
export interface PathPage {
  id: PathPageId;
  path: CaptainId;
  school: School;
  level: 1 | 2 | 3 | 4 | 5;
  /** Stamina or Will, by the school. */
  cost: number;
  /** Rounds before it may be given again. */
  cd: number;
  icon: string;
  name: [string, string];
  text: [string, string];
  fx: PageFx;
}

export type PathPageId =
  | 'cs_chain_shot' | 'cs_spotter' | 'cs_pistol_line' | 'cs_gunsmoke' | 'cs_grape' | 'cs_iron_tide'
  | 'sm_knives' | 'sm_fog_veil' | 'sm_caltrops' | 'sm_false_colours' | 'sm_powder_trail' | 'sm_blind_fog'
  | 'rv_hook' | 'rv_blood_scent' | 'rv_berserk' | 'rv_howl' | 'rv_butcher' | 'rv_red_mist'
  | 'nv_marlinspike' | 'nv_tailwind' | 'nv_flank_drill' | 'nv_squall' | 'nv_harpoon_line' | 'nv_eye_of_storm'
  | 'dr_drowning_grip' | 'dr_brine_kiss' | 'dr_anchor_chain' | 'dr_undertow' | 'dr_barnacles' | 'dr_abyss'
  | 'ad_volley_order' | 'ad_signal_flags' | 'ad_square' | 'ad_fog_of_war' | 'ad_bayonets' | 'ad_admiralty';

/** How hard each path's moves land (docs/18 item 11, `node tools/balance-paths.ts --tune`): every share a page, the
 *  innate move and the ultimate deal, heal, drag down or lay on stacks is multiplied by its path's figure here (the
 *  points of speed, initiative, morale and luck, and the yes-or-no holds, stay as written). */
export const PATH_POWER: Record<CaptainId, [number, number, number]> = {
  corsair: [0.39, 0.14, 0.27], smuggler: [1.34, 0.26, 0.22], reaver: [0.59, 0.19, 0.17], navigator: [0.85, 0.26, 0.15], drowned: [0.89, 0.37, 0.37], admiral: [1.84, 0.27, 0.21],
};
/** The hero levels PATH_POWER's three figures stand at (between them, the line between; beyond, the last). */
export const PATH_POWER_AT = [10, 30, 55] as const;
export function pathPower(path: CaptainId, level: number): number {
  const k = PATH_POWER[path] ?? [1, 1, 1];
  const [a, b, c] = PATH_POWER_AT;
  if (level <= a) return k[0];
  if (level <= b) return k[0] + ((k[1] - k[0]) * (level - a)) / (b - a);
  if (level <= c) return k[1] + ((k[2] - k[1]) * (level - b)) / (c - b);
  return k[2];
}

const SHARE_KEYS = ['melee', 'shot', 'taken', 'shotTaken'] as const;
const POINT_KEYS = ['speed', 'init', 'morale', 'luck'] as const;
const FX_KEYS = ['dmg', 'ring', 'all', 'shooters', 'drain', 'heal', 'raise'] as const;
const scaled = new Map<PageFx, Map<number, PageFx>>();
/** A move's fx with its path's power at the caster's hero level on it. */
export function powered(fx: PageFx, path: CaptainId, level: number): PageFx {
  const k = Math.round(pathPower(path, level) * 1000) / 1000;
  let byK = scaled.get(fx);
  if (!byK) scaled.set(fx, (byK = new Map()));
  const c = byK.get(k);
  if (c) return c;
  const out: PageFx = { ...fx };
  for (const key of FX_KEYS) if (out[key] !== undefined) out[key] = out[key]! * k;
  // Points of speed, initiative, morale and luck go as far as whole points go; a weak hand holds a round less; the
  // stacks that act again are her strongest share.
  for (const m of ['self', 'foe', 'one'] as const) {
    const src = fx[m];
    if (!src) continue;
    const mm: BtMods = { ...src };
    for (const key of SHARE_KEYS) if (mm[key] !== undefined) mm[key] = mm[key]! * k;
    for (const key of POINT_KEYS) if (mm[key] !== undefined) mm[key] = Math.sign(mm[key]!) * Math.round(Math.abs(mm[key]!) * Math.min(1.5, k));
    out[m] = mm;
  }
  if (out.rounds && k < 0.6) out.rounds = Math.max(0, out.rounds - 1);
  if (out.allAgain) out.allShare = Math.min(1, k);
  if (out.free) out.free = Math.max(1, Math.round(out.free * Math.min(1.5, k)));
  byK.set(k, out);
  return out;
}
/** Forget the powered fx (the tuner changes PATH_POWER as it goes). */
export function clearPowered(): void {
  scaled.clear();
}

/** The hero level each page level opens at. */
export const PAGE_UNLOCK: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 1, 2: 8, 3: 15, 4: 25, 5: 35 };
/** The ultimate opens at this hero level. */
export const ULT_LEVEL = 20;

const P = (id: PathPageId, path: CaptainId, school: School, level: PathPage['level'], cost: number, cd: number, icon: string, name: [string, string], text: [string, string], fx: PageFx): PathPage =>
  ({ id, path, school, level, cost, cd, icon, name, text, fx });

export const PATH_PAGES: Record<PathPageId, PathPage> = Object.fromEntries([
  // The corsair: fire and powder at home; a gunner's eye and an officer's discipline.
  P('cs_chain_shot', 'corsair', 'fire', 1, 4, 3, 'ab_double_shot', ['Chain shot', 'Книппель'], ['Two balls on a chain into one stack of hers: a hard blow, and she is slower.', 'Два ядра на цепи в один её отряд: тяжёлый удар, и он медленнее.'],
    { target: 'enemy', dmg: 1.1, one: { speed: -1 }, rounds: 1 }),
  P('cs_spotter', 'corsair', 'wind', 1, 4, 3, 'ab_spotters_eye', ["Spotter's call", 'Корректировщик'], ['A spotter in the tops: your shots harder and your luck up.', 'Корректировщик на марсе: ваши выстрелы сильнее, удача выше.'],
    { target: 'none', self: { shot: 0.3, luck: 1 }, rounds: 1 }),
  P('cs_pistol_line', 'corsair', 'steel', 2, 6, 3, 'bt_volley', ['Pistol line', 'Пистолетная шеренга'], ['A line of pistols: every blow and shot of yours harder.', 'Шеренга пистолетов: каждый ваш удар и выстрел сильнее.'],
    { target: 'none', self: { melee: 0.2, shot: 0.2 }, rounds: 1 }),
  P('cs_gunsmoke', 'corsair', 'fog', 3, 8, 4, 'ab_smoke_pots', ['Gunsmoke', 'Пороховой дым'], ['A bank of powder smoke over her deck: her shots fly wide.', 'Пелена порохового дыма над её палубой: её выстрелы уходят мимо.'],
    { target: 'none', foe: { shot: -0.4, melee: -0.25 }, rounds: 1 }),
  P('cs_grape', 'corsair', 'fire', 4, 12, 4, 'ab_grapeshot_frenzy', ['Grape at the rail', 'Картечь в упор'], ['A swivel gun of grape into her: a terrible blow on one stack, and a heavy one on those beside it.', 'Фальконет с картечью в упор: страшный удар по одному отряду и тяжёлый — по соседним.'],
    { target: 'enemy', dmg: 1.8, ring: 0.9 }),
  P('cs_iron_tide', 'corsair', 'water', 5, 15, 5, 'ab_brine_mend', ['Iron tide', 'Железный прилив'], ['The brine and the drill: every stack of yours heals and takes less.', 'Солёная вода и выучка: каждый ваш отряд лечится и получает меньше урона.'],
    { target: 'none', heal: 0.2, self: { taken: -0.2 }, rounds: 1 }),
  // The smuggler: fog and shadow at home; knives in the dark.
  P('sm_knives', 'smuggler', 'board', 1, 4, 3, 'item_quill_cutlass', ['Knives in the dark', 'Ножи в темноте'], ['Thrown knives into one stack of hers; it cannot answer a blow this round.', 'Метательные ножи в один её отряд; в этом раунде он не может ответить на удар.'],
    { target: 'enemy', dmg: 1.0, one: { noAnswer: true }, rounds: 0 }),
  P('sm_fog_veil', 'smuggler', 'fog', 1, 4, 3, 'ab_vanish_into_fog', ['Fog veil', 'Туманная вуаль'], ['A veil of fog: your stacks take less from her shots.', 'Туманная вуаль: ваши отряды получают меньше от её выстрелов.'],
    { target: 'none', self: { shotTaken: -0.33 }, rounds: 1 }),
  P('sm_caltrops', 'smuggler', 'steel', 2, 6, 3, 'item_iron_belt', ['Caltrops', 'Чеснок'], ['Iron caltrops on her deck: her men slower and their blows lighter.', 'Железный чеснок на её палубе: её люди медленнее, удары слабее.'],
    { target: 'none', foe: { speed: -1, melee: -0.15 }, rounds: 1 }),
  P('sm_false_colours', 'smuggler', 'fog', 3, 8, 4, 'item_black_flag', ['False colours', 'Чужой флаг'], ['A false flag and a false word: her morale and her luck fall.', 'Чужой флаг и ложное слово: её дух и удача падают.'],
    { target: 'none', foe: { morale: -2, luck: -1 }, rounds: 1, dread: 5 }),
  P('sm_powder_trail', 'smuggler', 'fire', 4, 12, 4, 'ab_admiralty_barrage', ['Powder trail', 'Пороховая дорожка'], ['A trail of powder under her feet, lit: a terrible blow on one stack and a lesser on those beside it.', 'Подожжённая дорожка пороха у неё под ногами: страшный удар по отряду и слабее — по соседним.'],
    { target: 'enemy', dmg: 1.9, ring: 0.7 }),
  P('sm_blind_fog', 'smuggler', 'fog', 5, 15, 5, 'ab_dark_running', ['Blinding fog', 'Слепой туман'], ['Her shooters see nothing to fire on, and her blows are lighter.', 'Её стрелкам не во что целиться, а её удары слабее.'],
    { target: 'none', foe: { blind: true, melee: -0.2 }, rounds: 1 }),
  // The Reaver: the hook and the boarding at home; blood and nerve.
  P('rv_hook', 'reaver', 'board', 1, 4, 3, 'item_boarding_axe', ['The hook', 'Крюк'], ['The hook in one stack of hers: a hard blow, and it cannot answer this round.', 'Крюк в её отряд: тяжёлый удар, и в этом раунде он не может ответить.'],
    { target: 'enemy', dmg: 1.2, one: { noAnswer: true }, rounds: 0 }),
  P('rv_blood_scent', 'reaver', 'water', 1, 4, 3, 'ab_war_cry', ['Blood in the water', 'Кровь в воде'], ['Blood in the water: your blows harder and your morale up.', 'Кровь в воде: ваши удары сильнее, дух выше.'],
    { target: 'none', self: { melee: 0.15, morale: 1 }, rounds: 1 }),
  P('rv_berserk', 'reaver', 'board', 2, 5, 3, 'tree_boarding', ['Berserk', 'Берсерк'], ['One stack of yours goes berserk: it strikes far harder and takes more.', 'Один ваш отряд впадает в раж: бьёт много сильнее, но и получает больше.'],
    { target: 'own', one: { melee: 0.5, taken: 0.2 }, rounds: 1 }),
  P('rv_howl', 'reaver', 'fog', 3, 8, 4, 'ab_deep_call', ['The howl', 'Вой'], ['A howl over the decks: her morale falls.', 'Вой над палубами: её дух падает.'],
    { target: 'none', foe: { morale: -2 }, rounds: 1, dread: 8 }),
  P('rv_butcher', 'reaver', 'steel', 4, 12, 4, 'bt_charge', ['Butcher\'s cut', 'Мясницкий удар'], ['Cleavers into one stack of hers: the heaviest blow a hand can give.', 'Тесаки в один её отряд: самый тяжёлый удар, на какой способна рука.'],
    { target: 'enemy', dmg: 2.6 }),
  P('rv_red_mist', 'reaver', 'water', 5, 15, 5, 'ab_red_hook_boarding', ['Red mist', 'Красный туман'], ['Red mist: every stack of yours heals and strikes harder.', 'Красный туман: каждый ваш отряд лечится и бьёт сильнее.'],
    { target: 'none', heal: 0.14, self: { melee: 0.3 }, rounds: 1 }),
  // The navigator: the wind at home; speed and the lie of the deck.
  P('nv_marlinspike', 'navigator', 'steel', 1, 4, 3, 'prof_helmsman', ['Marlinspike', 'Свайка'], ['A spike where it hurts: a blow on one stack of hers.', 'Свайка туда, где больно: удар по одному её отряду.'],
    { target: 'enemy', dmg: 1.0 }),
  P('nv_tailwind', 'navigator', 'wind', 1, 4, 3, 'ab_trim_sails', ['Tailwind', 'Ветер в корму'], ['The wind at your back: your men faster and quicker to act.', 'Ветер в корму: ваши люди быстрее и раньше в очереди.'],
    { target: 'none', self: { speed: 1, init: 3 }, rounds: 1 }),
  P('nv_flank_drill', 'navigator', 'board', 2, 6, 3, 'bt_officers', ['Flank drill', 'Удар во фланг'], ['The flank drill: every blow of yours harder.', 'Удар во фланг: каждый ваш удар сильнее.'],
    { target: 'none', self: { melee: 0.2 }, rounds: 1 }),
  P('nv_squall', 'navigator', 'wind', 3, 9, 4, 'ab_storm_chaser', ['Squall', 'Шквал'], ['A squall across her deck: every stack of hers is hurt, and she is later to act.', 'Шквал по её палубе: ранен каждый её отряд, и она позже в очереди.'],
    { target: 'none', all: 0.2, foe: { init: -2 }, rounds: 1 }),
  P('nv_harpoon_line', 'navigator', 'fire', 4, 12, 4, 'role_harpooner', ['Harpoon line', 'Гарпун на линь'], ['A harpoon gun into one stack of hers: a terrible blow, and it is much slower.', 'Гарпунная пушка по её отряду: страшный удар, и он намного медленнее.'],
    { target: 'enemy', dmg: 2.0, one: { speed: -2 }, rounds: 1 }),
  P('nv_eye_of_storm', 'navigator', 'wind', 5, 15, 5, 'ab_current_rider', ['The quiet in the storm', 'Тишина в буре'], ['The quiet in the storm: your men faster, quicker to act and luckier.', 'Тишина в буре: ваши люди быстрее, раньше в очереди и удачливее.'],
    { target: 'none', self: { speed: 2, init: 4, luck: 2 }, rounds: 1 }),
  // The Drowned: water and the deep at home; the grip of the drowned.
  P('dr_drowning_grip', 'drowned', 'board', 1, 4, 3, 'ab_undertow', ['Drowning grip', 'Хватка утопленника'], ['Cold hands on one stack of hers: a blow, and it is much slower.', 'Холодные руки на её отряде: удар, и он намного медленнее.'],
    { target: 'enemy', dmg: 0.9, one: { speed: -2 }, rounds: 1 }),
  P('dr_brine_kiss', 'drowned', 'water', 1, 4, 3, 'ab_brine_mend', ['Brine kiss', 'Поцелуй соли'], ['A share of every stack of yours stands again — the drowned too.', 'Часть каждого вашего отряда снова на ногах — и утопленники тоже.'],
    { target: 'none', raise: 0.1 }),
  P('dr_anchor_chain', 'drowned', 'steel', 2, 6, 3, 'item_iron_rigging', ['Anchor chain', 'Якорная цепь'], ['An anchor chain swung through one stack of hers: a heavy blow.', 'Якорная цепь проходит сквозь её отряд: тяжёлый удар.'],
    { target: 'enemy', dmg: 1.4 }),
  P('dr_undertow', 'drowned', 'water', 3, 9, 4, 'ab_maw_of_the_deep', ['Undertow', 'Отбойное течение'], ['The undertow drags a share of every stack of hers under; she is later to act.', 'Течение утаскивает часть каждого её отряда; она позже в очереди.'],
    { target: 'none', drain: 0.0625, foe: { init: -2 }, rounds: 1 }),
  P('dr_barnacles', 'drowned', 'steel', 4, 12, 4, 'mod_serpent_scale', ['Barnacle hide', 'Шкура из ракушек'], ['A hide of barnacles: every stack of yours takes less.', 'Шкура из ракушек: каждый ваш отряд получает меньше.'],
    { target: 'none', self: { taken: -0.25 }, rounds: 1 }),
  P('dr_abyss', 'drowned', 'water', 5, 15, 5, 'ab_deep_call', ['The abyss looks back', 'Бездна смотрит'], ['The abyss looks back: every stack of hers is hurt, and her morale falls.', 'Бездна смотрит: ранен каждый её отряд, её дух падает.'],
    { target: 'none', all: 0.3, foe: { morale: -1 }, rounds: 1 }),
  // The Black Admiral: steel and men at home; the line, the signal, the square.
  P('ad_volley_order', 'admiral', 'fire', 1, 4, 3, 'bt_volley', ['Volley by order', 'Залп по команде'], ['A volley on her shooters, and your shots harder after it.', 'Залп по её стрелкам, и ваши выстрелы потом сильнее.'],
    { target: 'none', shooters: 0.5, self: { shot: 0.25 }, rounds: 1 }),
  P('ad_signal_flags', 'admiral', 'wind', 1, 4, 3, 'ab_form_line', ['Signal flags', 'Сигнальные флаги'], ['Signal flags: your men quicker to act and your morale up.', 'Сигнальные флаги: ваши люди раньше в очереди, дух выше.'],
    { target: 'none', self: { init: 2, morale: 1 }, rounds: 1 }),
  P('ad_square', 'admiral', 'steel', 2, 6, 3, 'mod_hull_plating', ['Form square', 'В каре'], ['Form square: every stack of yours takes less.', 'В каре: каждый ваш отряд получает меньше.'],
    { target: 'none', self: { taken: -0.2 }, rounds: 1 }),
  P('ad_fog_of_war', 'admiral', 'fog', 3, 8, 4, 'ab_smoke_pots', ['Fog of war', 'Туман войны'], ['The fog of war: her shots fly wide and she is later to act.', 'Туман войны: её выстрелы мимо, и она позже в очереди.'],
    { target: 'none', foe: { shot: -0.3, init: -2 }, rounds: 1 }),
  P('ad_bayonets', 'admiral', 'steel', 4, 12, 4, 'item_cutlass', ['Bayonet charge', 'Штыковая'], ['A bayonet charge into one stack of hers: a heavy blow, and your blows harder after it.', 'Штыковая на её отряд: тяжёлый удар, и ваши удары потом сильнее.'],
    { target: 'enemy', dmg: 1.6, self: { melee: 0.2 }, rounds: 1 }),
  P('ad_admiralty', 'admiral', 'water', 5, 15, 5, 'item_admiral_hat', ['The Admiralty\'s surgeons', 'Лекари адмиралтейства'], ["The Admiralty's surgeons: a share of every stack of yours stands again.", 'Лекари адмиралтейства: часть каждого вашего отряда снова на ногах.'],
    { target: 'none', heal: 0.25 }),
].map((p) => [p.id, p])) as Record<PathPageId, PathPage>;

export const PATH_PAGE_IDS = Object.keys(PATH_PAGES) as PathPageId[];
export const isPathPage = (id: string): id is PathPageId => id in PATH_PAGES;

/** Her path's book. */
export function pathBook(path: CaptainId): PathPageId[] {
  return PATH_PAGE_IDS.filter((id) => PATH_PAGES[id].path === path).sort((a, b) => PATH_PAGES[a].level - PATH_PAGES[b].level);
}
/** The pages of her path's book open at her hero level. */
export function pathPagesAt(path: CaptainId, level: number): PathPageId[] {
  return pathBook(path).filter((id) => level >= PAGE_UNLOCK[PATH_PAGES[id].level]);
}

// ------------------------------------------------------------------ 1. innate moves, 5. ultimates

export interface PathMove {
  path: CaptainId;
  icon: string;
  name: [string, string];
  text: [string, string];
  fx: PageFx;
}

export const INNATE: Record<CaptainId, PathMove> = {
  corsair: { path: 'corsair', icon: 'ab_last_volley', name: ['Last Volley', 'Последний залп'], text: ['Once a battle, free: every gun and pistol aboard at one stack of hers — a great blow, no answer.', 'Раз за бой, даром: все пушки и пистолеты разом по одному её отряду — страшный удар, без ответа.'],
    fx: { target: 'enemy', dmg: 1.2 } },
  smuggler: { path: 'smuggler', icon: 'ab_smoke_pots', name: ['Smoke Screen', 'Дымовая завеса'], text: ['Once a battle, free: tar pots over her deck — her shooters are blind.', 'Раз за бой, даром: смоляные горшки на её палубу — её стрелки слепнут.'],
    fx: { target: 'none', foe: { blind: true }, rounds: 1 } },
  reaver: { path: 'reaver', icon: 'ab_red_hook_boarding', name: ['Blood Harvest', 'Кровавая жатва'], text: ['Once a battle, free: the first blows of your men this round draw no answer, and land harder.', 'Раз за бой, даром: первые удары ваших людей в этом раунде остаются без ответа и бьют сильнее.'],
    fx: { target: 'none', free: 2, self: { melee: 0.1 }, rounds: 0 } },
  navigator: { path: 'navigator', icon: 'ab_storm_chaser', name: ['Following Squall', 'Попутный шквал'], text: ['Once a battle, free: one stack of yours acts twice this round, and is faster.', 'Раз за бой, даром: один ваш отряд ходит в этом раунде дважды и становится быстрее.'],
    fx: { target: 'own', again: true, one: { speed: 1 }, rounds: 1 } },
  drowned: { path: 'drowned', icon: 'ab_deep_call', name: ['Call of the Depths', 'Зов глубин'], text: ['Once a battle, free: the fallen rise — a share of every stack of yours stands again, the dead men too.', 'Раз за бой, даром: встают павшие — часть каждого вашего отряда снова на ногах, и мёртвые тоже.'],
    fx: { target: 'none', raise: 0.12 } },
  admiral: { path: 'admiral', icon: 'ab_form_line', name: ['The Line', 'Строй'], text: ['Once a battle, free: the line is formed — morale up for every stack of yours.', 'Раз за бой, даром: строй сомкнут — дух выше у каждого вашего отряда.'],
    fx: { target: 'none', self: { morale: 2 }, rounds: 1, heart: 6 } },
};

export const ULTIMATE: Record<CaptainId, PathMove> = {
  corsair: { path: 'corsair', icon: 'ab_admiralty_barrage', name: ["Hell's Broadside", 'Адский бортовой'], text: ['From level 20, once a battle: every gun of the ship fires into her deck — every stack of hers takes a blow.', 'С 20-го уровня, раз за бой: все пушки корабля бьют по её палубе — удар по каждому её отряду.'],
    fx: { target: 'none', all: 0.15 } },
  smuggler: { path: 'smuggler', icon: 'ab_vanish_into_fog', name: ['Killing Fog', 'Туман-убийца'], text: ['From level 20, once a battle: she is blind, her blows lighter, and she takes more.', 'С 20-го уровня, раз за бой: она слепа, её удары слабее, а получает она больше.'],
    fx: { target: 'none', foe: { blind: true, melee: -0.2, taken: 0.1 }, rounds: 1 } },
  reaver: { path: 'reaver', icon: 'ab_grapeshot_frenzy', name: ['Red Tide', 'Красный прилив'], text: ['From level 20, once a battle: your men strike unanswered, again and again, and harder.', 'С 20-го уровня, раз за бой: ваши люди бьют без ответа, раз за разом, и сильнее.'],
    fx: { target: 'none', free: 5, self: { melee: 0.2 }, rounds: 1 } },
  navigator: { path: 'navigator', icon: 'ab_current_rider', name: ['Eye of the Storm', 'Глаз бури'], text: ['From level 20, once a battle: your strongest stacks act once more this round.', 'С 20-го уровня, раз за бой: ваши сильнейшие отряды ходят в этом раунде ещё раз.'],
    fx: { target: 'none', allAgain: true } },
  drowned: { path: 'drowned', icon: 'ab_maw_of_the_deep', name: ['Tide of the Dead', 'Прилив мертвецов'], text: ['From level 20, once a battle: a share of every stack of yours rises again, and the deep drags some of hers under.', 'С 20-го уровня, раз за бой: часть каждого вашего отряда встаёт снова, а глубина утаскивает часть её людей.'],
    fx: { target: 'none', raise: 0.18, drain: 0.03 } },
  admiral: { path: 'admiral', icon: 'item_admiral_hat', name: ['Line of Battle', 'Линия баталии'], text: ['From level 20, once a battle: a broadside along her deck, then morale up, blows harder, less taken.', 'С 20-го уровня, раз за бой: бортовой залп вдоль её палубы, затем дух выше, удары сильнее, урона меньше.'],
    fx: { target: 'none', all: 0.1, self: { morale: 2, melee: 0.12, taken: -0.1 }, rounds: 2, heart: 8 } },
};

// ------------------------------------------------------------------ 4. stamina

/** Three points of stamina for each point of her Attack and Defense (and a base of ten). */
export function stamMaxOf(atk: number, def: number): number {
  return 10 + 3 * (Math.max(0, Math.round(atk)) + Math.max(0, Math.round(def)));
}
/** A share of her stamina comes back every round of a battle. */
export const STAM_ROUND = 0.1;
/** At sea her stamina comes back whole in this many seconds of rest; in port at once. */
export const STAM_REST_SEC = 300;

// ------------------------------------------------------------------ 6. talents that lift the path book

/** Per rank: the path book's pages stronger (`mul`), cheaper (`cost`), more stamina or will in the battle, the
 *  innate move and the ultimate stronger. Two or three nodes in every tree; their sea side is untouched. */
export interface TalentBook {
  mul?: number;
  cost?: number;
  stam?: number;
  will?: number;
  innate?: number;
}
export const TALENT_BOOK: Record<string, TalentBook> = {
  // Gunnery.
  gun_powder_discipline: { stam: 3 },
  gun_crew_drill: { mul: 0.03 },
  gun_spotter: { cost: 0.05 },
  // Navigation.
  nav_weather_gauge: { will: 3 },
  nav_second_wind: { stam: 6, innate: 0.1 },
  // Boarding.
  brd_cutlass_drill: { mul: 0.02 },
  brd_blooded: { innate: 0.1 },
  brd_warlord: { stam: 5 },
  // Command.
  cmd_drill_master: { mul: 0.03 },
  cmd_iron_discipline: { cost: 0.05 },
  cmd_legend_at_the_helm: { innate: 0.15 },
  // Trade.
  trd_ledger_keeper: { cost: 0.03 },
  trd_market_sense: { will: 2 },
  // Smuggling.
  smg_false_colors: { innate: 0.1 },
  smg_fog_sense: { mul: 0.03 },
  smg_shadow_strike: { cost: 0.06 },
  // Survival.
  srv_hardened_crew: { stam: 4 },
  srv_grim_endurance: { mul: 0.03, stam: 3 },
  // Shipwright.
  shp_master_fitter: { cost: 0.03 },
  shp_masterwork: { mul: 0.03 },
  // Exploration.
  exp_star_reader: { will: 3 },
  exp_legend_seeker: { mul: 0.03 },
  // Abyssal.
  abs_whispers_below: { will: 3 },
  abs_hymn_of_the_choir: { mul: 0.03 },
  abs_rising_dead: { innate: 0.12 },
};

export interface BookLift {
  mul: number;
  cost: number;
  stam: number;
  will: number;
  innate: number;
}
/** What her talents lift her book by (ranks × per rank; the cost cut at most a third). */
export function talentBook(ranks: Record<string, number> | null | undefined): BookLift {
  const out: BookLift = { mul: 0, cost: 0, stam: 0, will: 0, innate: 0 };
  if (!ranks) return out;
  for (const id in ranks) {
    const t = TALENT_BOOK[id], r = ranks[id] ?? 0;
    if (!t || r <= 0) continue;
    out.mul += (t.mul ?? 0) * r;
    out.cost += (t.cost ?? 0) * r;
    out.stam += (t.stam ?? 0) * r;
    out.will += (t.will ?? 0) * r;
    out.innate += (t.innate ?? 0) * r;
  }
  out.cost = Math.min(0.33, out.cost);
  return out;
}

// ------------------------------------------------------------------ 10. scrolls

/** A scroll of a page from a lair or a boss: one battle cast of it, free, whatever her path. Drawn by the source's
 *  strength (the page's level at most `top`). */
export function scrollPool(top: number): PathPageId[] {
  return PATH_PAGE_IDS.filter((id) => PATH_PAGES[id].level <= Math.max(1, Math.min(5, top)));
}
/** Scroll chances: a boss, a stormed lair, a guard's chest. */
export const SCROLL_CHANCE = { boss: 0.5, lair: 0.35, guard: 0.12 } as const;
/** At most this many scrolls of a kind in her bag. */
export const SCROLL_MAX = 5;

// ------------------------------------------------------------------ 8. the named captains of the sea

/** The path a named pirate's trick says she walks; a baron's by his sea; a hunter's from her hull's number. */
export function pathOfTrick(trick: string): CaptainId {
  return trick === 'fog' ? 'smuggler' : trick === 'pack' ? 'admiral' : trick === 'fireship' ? 'corsair' : 'reaver';
}
export const BARON_PATH: Record<string, CaptainId> = {
  black_coast: 'reaver', whispering: 'smuggler', ashen_isles: 'corsair', gravewater: 'drowned', leviathan_reach: 'navigator', dead_mans_expanse: 'admiral', drowned_crown: 'drowned',
};
export function hunterPath(id: number): CaptainId {
  return (['corsair', 'admiral', 'navigator'] as const)[Math.abs(id) % 3];
}

// ------------------------------------------------------------------ words

/** The server's words about the paths, English → Russian. */
export function pathPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const id of PATH_PAGE_IDS) out.push(PATH_PAGES[id].name);
  for (const c of PATH_IDS) out.push(INNATE[c].name, ULTIMATE[c].name);
  return out;
}
