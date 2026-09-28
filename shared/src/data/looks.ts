// A ship's look (docs/12 P10 #12): her flag — a field pattern, two or three colours, an emblem of sixty — her hull
// paint, her sails' pattern, her lanterns. Some are hers from the start; the rest are opened by deeds (a regatta, the
// Dutchman, a revenge, the wonders, the dice). Everyone sees the flag over her ship.

type Tr = [string, string];

export const LOOK_COLORS: { hex: string; name: Tr }[] = [
  { hex: '#161616', name: ['Black', 'Чёрный'] },
  { hex: '#e3dccb', name: ['Bone', 'Костяной'] },
  { hex: '#8e2a2a', name: ['Blood', 'Кровавый'] },
  { hex: '#2f5f8a', name: ['Sea Blue', 'Морской синий'] },
  { hex: '#3f7d4a', name: ['Green', 'Зелёный'] },
  { hex: '#c9a25a', name: ['Gold', 'Золотой'] },
  { hex: '#5b3a6e', name: ['Purple', 'Пурпурный'] },
  { hex: '#2f86b0', name: ['Regatta Blue', 'Регатный синий'] },
  { hex: '#7a5230', name: ['Brown', 'Бурый'] },
  { hex: '#4a5a66', name: ['Slate', 'Сланцевый'] },
  { hex: '#b8643a', name: ['Rust', 'Ржавый'] },
  { hex: '#2a6f6a', name: ['Teal', 'Бирюзовый'] },
];

export const FIELDS: Tr[] = [
  ['Plain', 'Гладкое'], ['Halved across', 'Рассечённое поперёк'], ['Halved down', 'Рассечённое вдоль'], ['Quartered', 'Четверочастное'],
  ['Bend', 'Перевязь'], ['Bordure', 'Кайма'], ['Cross', 'Крест'], ['Saltire', 'Андреевский крест'], ['Chevron', 'Стропило'], ['Stripes', 'Полосы'],
];

/** Twenty glyphs in a 100×100 box (even-odd fill); each comes filled, outlined and ringed: sixty emblems. */
export const GLYPHS: { name: Tr; d: string }[] = [
  { name: ['Skull', 'Череп'], d: 'M50 18c-17 0-28 12-28 27 0 9 4 15 10 19v12h36V64c6-4 10-10 10-19 0-15-11-27-28-27zM39 42a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm22 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM46 60h8l-4 7z' },
  { name: ['Crossbones', 'Кости'], d: 'M22 22l6-6 56 56-6 6zM78 22l-6-6-56 56 6 6z' },
  { name: ['Anchor', 'Якорь'], d: 'M50 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM47 20h6v8h12v6H53v42c9-1 16-7 18-15l-6 1 10-12 4 14-4-2c-3 14-14 23-29 23S24 76 21 62l-4 2 4-14 10 12-6-1c2 8 9 14 18 15V34H35v-6h12z' },
  { name: ['Star', 'Звезда'], d: 'M50 12l10 27h28L65 56l9 28-24-17-24 17 9-28-23-17h28z' },
  { name: ['Compass Star', 'Роза ветров'], d: 'M50 8l6 36 36 6-36 6-6 36-6-36-36-6 36-6z' },
  { name: ['Crown', 'Корона'], d: 'M18 68l-4-38 18 16 18-26 18 26 18-16-4 38zM18 74h64v8H18z' },
  { name: ['Sword', 'Меч'], d: 'M47 8h6v58h10v6H53v18h-6V72H37v-6h10z' },
  { name: ['Crossed Sabres', 'Скрещённые сабли'], d: 'M18 14l5-4 52 52 6-2-4 8 6 8-4 4-8-6-8 4 2-6zM82 14l-5-4-52 52-6-2 4 8-6 8 4 4 8-6 8 4-2-6z' },
  { name: ['Heart', 'Сердце'], d: 'M50 84L18 50c-9-10-6-26 7-31 10-4 20 1 25 10 5-9 15-14 25-10 13 5 16 21 7 31z' },
  { name: ['Hourglass', 'Песочные часы'], d: 'M26 14h48v6L56 50l18 30v6H26v-6l18-30-18-30z' },
  { name: ['Key', 'Ключ'], d: 'M32 30a14 14 0 1 1 0 28 14 14 0 0 1 0-28zm0 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM44 40h42v8h-6v10h-7V48h-6v8h-7v-8H44z' },
  { name: ['Bell', 'Колокол'], d: 'M50 14c-13 0-22 10-22 24v18l-8 12h60l-8-12V38c0-14-9-24-22-24zM42 72a8 8 0 0 0 16 0z' },
  { name: ['Crescent', 'Полумесяц'], d: 'M62 14a36 36 0 1 0 0 72a40 40 0 0 1 0-72z' },
  { name: ['Sun', 'Солнце'], d: 'M50 30a20 20 0 1 1 0 40 20 20 0 0 1 0-40zM47 6h6v16h-6zM47 78h6v16h-6zM6 47h16v6H6zM78 47h16v6H78z' },
  { name: ['Wheel', 'Штурвал'], d: 'M50 22a28 28 0 1 1 0 56 28 28 0 0 1 0-56zm0 8a20 20 0 1 0 0 40 20 20 0 0 0 0-40zM47 8h6v84h-6zM8 47h84v6H8z' },
  { name: ['Trident', 'Трезубец'], d: 'M47 30h6v62h-6zM22 12h6v26c0 8 6 14 14 14h16c8 0 14-6 14-14V12h6v26c0 12-9 20-20 20H42c-11 0-20-8-20-20zM47 6l3-5 3 5v20h-6z' },
  { name: ['Fish', 'Рыба'], d: 'M10 50c14-18 36-22 54-10l20-14v48L64 60C46 72 24 68 10 50z' },
  { name: ['Gull', 'Чайка'], d: 'M8 44c14-6 28-4 42 8 14-12 28-14 42-8-12 0-26 6-42 22C34 50 20 44 8 44z' },
  { name: ['Serpent', 'Змей'], d: 'M20 84c22 0 20-22 40-22s18-18 0-18-20-24 4-26c10-1 16 4 18 10l-6 2c-2-4-6-6-11-5-12 2-6 12 1 12 26 0 26 32 0 32-14 0-14 18-46 18z' },
  { name: ['Tower', 'Башня'], d: 'M30 88V40l-6-6V16h10v8h8v-8h16v8h8v-8h10v18l-6 6v48z' },
];

/** The sixty flags (docs/12 P10 #12; painted in sheets of twelve, `flag.fNN`): a name, the painter's brief, and the
 *  procedural stand-in until the paint is in (field, field colour, second colour, emblem colour, glyph, glyph style). */
export interface FlagDef {
  name: Tr;
  art: string;
  fb: [number, number, number, number, number, number];
}

export const FLAGS: FlagDef[] = [
  { name: ['Jolly Roger', 'Весёлый Роджер'], art: 'a bone-white grinning skull above two crossed thigh bones on a black field', fb: [0, 0, 0, 1, 0, 0] },
  { name: ['Crimson Cutlass', 'Багровая сабля'], art: 'a single bone-white cutlass, blade raised, on a dried-blood red field', fb: [0, 2, 2, 1, 6, 0] },
  { name: ['Winged Hourglass', 'Крылатые часы'], art: 'a bone-white hourglass with small bat wings on a black field', fb: [0, 0, 0, 1, 9, 0] },
  { name: ['Pierced Heart', 'Пронзённое сердце'], art: 'a dark red heart pierced by a bone-white dagger, three drops of blood, on a black field', fb: [0, 0, 0, 2, 8, 0] },
  { name: ['Crossed Sabres', 'Скрещённые сабли'], art: 'two crossed bone-white sabres on a slate-grey field', fb: [0, 9, 9, 1, 7, 0] },
  { name: ['Red Skull', 'Красный череп'], art: 'a black skull on a dried-blood red field', fb: [0, 2, 2, 0, 0, 0] },
  { name: ['Black Anchor', 'Чёрный якорь'], art: 'a black anchor on a bone-white field', fb: [0, 1, 1, 0, 2, 0] },
  { name: ['Sea Serpent', 'Морской змей'], art: 'a coiled bone-white sea serpent on a deep sea-blue field', fb: [0, 3, 3, 1, 18, 0] },
  { name: ['Hoist Stripe', 'Полоса у древка'], art: 'a black field with one broad bone-white vertical stripe at the hoist and a small bone-white skull in the middle', fb: [2, 0, 1, 1, 0, 2] },
  { name: ['The Gallows', 'Виселица'], art: 'a bone-white gallows with a hanging noose on a slate-grey field', fb: [0, 9, 9, 1, 19, 1] },
  { name: ['Raven', 'Ворон'], art: 'a black raven with spread wings on a bone-white field', fb: [0, 1, 1, 0, 17, 0] },
  { name: ['Trident', 'Трезубец'], art: 'a bone-white trident on a deep sea-blue field', fb: [0, 3, 3, 1, 15, 0] },
  { name: ['Kraken', 'Кракен'], art: 'a dark red kraken with curling tentacles on a black field', fb: [0, 0, 0, 2, 18, 1] },
  { name: ['Ship’s Wheel', 'Штурвал'], art: 'a tarnished gold ship’s wheel on a black field', fb: [0, 0, 0, 5, 14, 0] },
  { name: ['Compass Rose', 'Роза ветров'], art: 'a tarnished gold compass rose on a deep sea-blue field', fb: [0, 3, 3, 5, 4, 0] },
  { name: ['Crowned Skull', 'Череп в короне'], art: 'a bone-white skull wearing a tarnished gold crown on a black field', fb: [0, 0, 0, 5, 5, 0] },
  { name: ['Burning Ship', 'Горящий корабль'], art: 'a black ship silhouette in dull orange flames on a charcoal field', fb: [0, 0, 0, 10, 16, 0] },
  { name: ['Three Skulls', 'Три черепа'], art: 'three small bone-white skulls in a row on a dried-blood red field', fb: [0, 2, 2, 1, 0, 1] },
  { name: ['Shark Jaws', 'Акулья пасть'], art: 'open bone-white shark jaws with rows of teeth on a slate-grey field', fb: [0, 9, 9, 1, 16, 1] },
  { name: ['Mermaid', 'Русалка'], art: 'a bone-white mermaid silhouette on a deep sea-blue field', fb: [0, 3, 3, 1, 16, 0] },
  { name: ['Crescent and Star', 'Полумесяц со звездой'], art: 'a bone-white crescent moon and a small star on a midnight purple field', fb: [0, 6, 6, 1, 12, 0] },
  { name: ['Lighthouse', 'Маяк'], art: 'a bone-white lighthouse tower with a faint amber light on a black field', fb: [0, 0, 0, 1, 19, 0] },
  { name: ['Sperm Whale', 'Кашалот'], art: 'a bone-white sperm whale on a grey-blue field', fb: [0, 9, 9, 1, 16, 0] },
  { name: ['Watching Eye', 'Всевидящее око'], art: 'a single staring eye with a dim teal iris wrapped by an octopus tentacle, on a black field', fb: [0, 0, 0, 11, 13, 1] },
  { name: ['The Noose', 'Петля'], art: 'a bone-white hangman’s noose on a dark bottle-green field', fb: [0, 4, 4, 1, 12, 1] },
  { name: ['Storm Lantern', 'Штормовой фонарь'], art: 'a lit amber ship’s lantern on a black field', fb: [0, 0, 0, 5, 11, 1] },
  { name: ['Brass Bell', 'Медный колокол'], art: 'a tarnished gold ship’s bell on a dried-blood red field', fb: [0, 2, 2, 5, 11, 0] },
  { name: ['Bone Dice', 'Костяные кости'], art: 'two bone-white dice showing six and one on a black field', fb: [0, 0, 0, 1, 3, 1] },
  { name: ['Ace of Spades', 'Пиковый туз'], art: 'a large black spade symbol on a bone-white field', fb: [0, 1, 1, 0, 8, 0] },
  { name: ['Gold Doubloon', 'Золотой дублон'], art: 'a large tarnished gold coin stamped with a skull on a black field', fb: [0, 0, 0, 5, 13, 2] },
  { name: ['Skeletal Hand', 'Костлявая рука'], art: 'a bone-white skeletal hand reaching upward on a dried-blood red field', fb: [0, 2, 2, 1, 6, 1] },
  { name: ['Eye in the Triangle', 'Око в треугольнике'], art: 'a tarnished gold eye inside a triangle on a black field', fb: [0, 0, 0, 5, 3, 2] },
  { name: ['Harpoon and Fluke', 'Гарпун и хвост'], art: 'a bone-white harpoon crossed over a whale’s tail fluke on a slate-grey field', fb: [0, 9, 9, 1, 15, 1] },
  { name: ['Crossed Keys', 'Скрещённые ключи'], art: 'two crossed tarnished gold keys on a dark bottle-green field', fb: [0, 4, 4, 5, 10, 0] },
  { name: ['Black Sun', 'Чёрное солнце'], art: 'a black sun with a grim face and long straight rays on a dull gold field', fb: [0, 5, 5, 0, 13, 0] },
  { name: ['Dagger and Rose', 'Кинжал и роза'], art: 'a dark red rose with a bone-white dagger through its stem on a black field', fb: [0, 0, 0, 2, 6, 0] },
  { name: ['Chained Skull', 'Скованный череп'], art: 'a bone-white skull bound in rusted iron chains on a slate-grey field', fb: [0, 9, 9, 1, 0, 2] },
  { name: ['Fish Bones', 'Рыбий скелет'], art: 'a bone-white fish skeleton on a deep sea-blue field', fb: [0, 3, 3, 1, 16, 1] },
  { name: ['Black Galleon', 'Чёрный галеон'], art: 'a black galleon silhouette under full sail on a bone-white field', fb: [0, 1, 1, 0, 16, 0] },
  { name: ['Sea Wolf', 'Морской волк'], art: 'a snarling grey wolf’s head on a black field', fb: [0, 0, 0, 9, 0, 1] },
  { name: ['Gull over Waves', 'Чайка над волнами'], art: 'a bone-white gull above three stylized waves on a slate-blue field', fb: [1, 9, 3, 1, 17, 0] },
  { name: ['Skull Candle', 'Свеча на черепе'], art: 'a bone-white skull with a lit candle on its crown on a midnight purple field', fb: [0, 6, 6, 1, 0, 0] },
  { name: ['Crown Ensign', 'Кормовой флаг Короны'], art: 'a bone-white cross on a sea-blue field with a small tarnished gold crown in the upper corner by the hoist', fb: [6, 3, 1, 5, 5, 0] },
  { name: ['Crown and Anchors', 'Корона и якоря'], art: 'a tarnished gold crown above two crossed anchors on a sea-blue field quartered by a bone-white cross', fb: [6, 3, 1, 5, 2, 0] },
  { name: ['Admiralty Standard', 'Штандарт Адмиралтейства'], art: 'a tarnished gold crown on a bone-white cross over a sea-blue field, edged with a thin gold border', fb: [5, 3, 5, 5, 5, 2] },
  { name: ['League Scales', 'Весы Лиги'], art: 'tarnished gold merchant’s scales on a field halved vertically black and dull gold', fb: [2, 0, 5, 1, 10, 1] },
  { name: ['Ledger and Key', 'Гроссбух и ключ'], art: 'a tarnished gold key laid across an open ledger on a black field', fb: [2, 0, 5, 5, 10, 0] },
  { name: ['League Galleon', 'Галеон Лиги'], art: 'a tarnished gold galleon above gold scales on a black field', fb: [5, 0, 5, 5, 16, 2] },
  { name: ['Red Tide', 'Красный прилив'], art: 'a dried-blood red breaking wave across the lower half of a black field', fb: [1, 0, 2, 2, 18, 1] },
  { name: ['Skull on the Tide', 'Череп на приливе'], art: 'a bone-white skull riding a dried-blood red wave on a black field', fb: [1, 0, 2, 1, 0, 0] },
  { name: ['Commodore of the Tide', 'Коммодор прилива'], art: 'a bone-white skull over crossed cutlasses above a red wave, crowned in tarnished gold, on a black field', fb: [1, 0, 2, 5, 7, 2] },
  { name: ['Storm Heart', 'Сердце шторма'], art: 'a jagged pale lightning bolt splitting a dark storm cloud on a black-blue field', fb: [0, 3, 0, 1, 3, 0] },
  { name: ['Broken Blade', 'Сломанный клинок'], art: 'a bone-white sword snapped in two on a dried-blood red field', fb: [0, 2, 2, 1, 6, 2] },
  { name: ['Weeping Skull', 'Плачущий череп'], art: 'a bone-white skull weeping one dark red tear on a black field', fb: [0, 0, 0, 2, 0, 1] },
  { name: ['Wind-Catcher', 'Ветролов'], art: 'a bone-white swallow in flight on a dull regatta-blue field with a swallowtail fly edge', fb: [0, 7, 7, 1, 17, 0] },
  { name: ['Star of the Lagoon', 'Звезда лагуны'], art: 'a tarnished gold star above a calm lagoon on a dark teal field', fb: [0, 11, 11, 5, 3, 0] },
  { name: ['Loaded Die', 'Налитая кость'], art: 'a single tarnished gold die with skull pips on a dried-blood red field', fb: [0, 2, 2, 5, 3, 1] },
  { name: ['Ghost Ship', 'Корабль-призрак'], art: 'a pale ghostly green ship silhouette on a black field', fb: [0, 0, 0, 4, 16, 0] },
  { name: ['Green Lantern Skull', 'Череп с зелёным фонарём'], art: 'a bone-white skull holding a pale green lantern in its jaws on a black field', fb: [0, 0, 0, 4, 0, 2] },
  { name: ['Drowned Hourglass', 'Утонувшие часы'], art: 'a pale green hourglass wrapped in rusted chains on a tattered black field', fb: [0, 0, 0, 4, 9, 1] },
];
export const EMBLEM_COUNT = FLAGS.length;
export const EMBLEM_STYLES: Tr[] = [['filled', 'сплошной'], ['outlined', 'контур'], ['ringed', 'в кольце']];

export const HULLS: { hex: string | null; name: Tr }[] = [
  { hex: null, name: ['Natural wood', 'Дерево'] },
  { hex: '#141414', name: ['Tarred black', 'Смоляной'] },
  { hex: '#4a1a14', name: ['Oxblood', 'Бычья кровь'] },
  { hex: '#1b2a3a', name: ['Navy', 'Флотский синий'] },
  { hex: '#1c2e22', name: ['Bottle green', 'Бутылочный'] },
  { hex: '#6a655a', name: ['Weathered grey', 'Выветренный серый'] },
  { hex: '#5a4420', name: ['Ochre', 'Охра'] },
  { hex: '#2e2440', name: ['Midnight', 'Полночный'] },
];

export const SAILS: Tr[] = [
  ['Plain canvas', 'Простое полотно'], ['Tarred', 'Просмолённые'], ['Blood red', 'Кроваво-красные'], ['Striped', 'Полосатые'],
  ['Crossed', 'С крестом'], ['Chequered', 'В клетку'], ['Halved', 'Двухцветные'], ['Regatta', 'Регатные'],
];

export const LAMPS: { color: string; name: Tr }[] = [
  { color: '#f2b35a', name: ['Warm oil', 'Тёплое масло'] },
  { color: '#8cffaa', name: ['Ghost green', 'Призрачно-зелёный'] },
  { color: '#8cc8ff', name: ['Cold blue', 'Холодно-синий'] },
  { color: '#ff6a5a', name: ['Red', 'Красный'] },
];

export interface Look {
  field: number;
  c1: number;
  c2: number;
  c3: number;
  emblem: number;
  hull: number;
  sail: number;
  lamp: number;
}

export const DEFAULT_LOOK: Look = { field: 0, c1: 0, c2: 1, c3: 2, emblem: 0, hull: 0, sail: 0, lamp: 0 };

export function encodeLook(l: Look): string {
  return [l.field, l.c1, l.c2, l.c3, l.emblem, l.hull, l.sail, l.lamp].join('.');
}

export function decodeLook(s: string | null | undefined): Look | null {
  if (!s) return null;
  const n = s.split('.').map(Number);
  if (n.length !== 8 || n.some((x) => !Number.isInteger(x) || x < 0)) return null;
  const [field, c1, c2, c3, emblem, hull, sail, lamp] = n;
  if (field >= FIELDS.length || c1 >= LOOK_COLORS.length || c2 >= LOOK_COLORS.length || c3 >= LOOK_COLORS.length || emblem >= EMBLEM_COUNT || hull >= HULLS.length || sail >= SAILS.length || lamp >= LAMPS.length) return null;
  return { field, c1, c2, c3, emblem, hull, sail, lamp };
}

/** What every captain has from the start. */
export const STARTING_UNLOCKS: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `emblem:${i}`),
  ...[0, 1, 2, 3, 4, 5].map((i) => `color:${i}`),
  'field:0', 'field:1', 'field:2', 'field:5',
  'hull:0', 'hull:1', 'sail:0', 'sail:1', 'lamp:0',
];

/** What a deed opens. */
export const DEED_UNLOCKS: Record<string, string[]> = {
  regatta: ['sail:7', 'color:7', 'field:9', 'emblem:54'],
  dutchman: ['lamp:1', 'emblem:57', 'emblem:58', 'emblem:59', 'hull:7'],
  revenge: ['emblem:52', 'emblem:53', 'hull:2'],
  wonders: ['hull:3', 'hull:4', 'hull:5', 'hull:6', 'field:3', 'field:4', 'sail:4', 'sail:5', 'lamp:2', 'color:8', 'color:9', 'color:10', 'color:11', 'emblem:55'],
  dice: ['emblem:56', 'emblem:27', 'emblem:28', 'emblem:29', 'lamp:3', 'field:6', 'field:7', 'field:8'],
  quest: ['sail:2', 'sail:3', 'sail:6', ...Array.from({ length: 30 }, (_, i) => `emblem:${12 + i}`)],
  // The Storm of the Century's heart (docs/12 P10 #14) and the services' ranks (docs/12 P10 #15).
  storm: ['emblem:51'],
  crown_1: ['emblem:42'], crown_3: ['emblem:43'], crown_4: ['emblem:44'],
  league_1: ['emblem:45'], league_3: ['emblem:46'], league_4: ['emblem:47'],
  confederacy_1: ['emblem:48'], confederacy_3: ['emblem:49'], confederacy_4: ['emblem:50'],
};

export function emblemName(i: number): Tr {
  return FLAGS[i]?.name ?? ['Flag', 'Флаг'];
}

/** A painted flag's asset id. */
export function flagAsset(i: number): string {
  return `flag.f${String(i).padStart(2, '0')}`;
}

export function lookPatterns(): [string, string][] {
  return [
    ['A new look for your ship: {0}.', 'Новое для облика корабля: {0}.'],
    ['The look is changed in port.', 'Облик меняют в порту.'],
    ['That is not yours yet.', 'Это вам пока не открыто.'],
    ['Her new colours are flown.', 'Новые цвета подняты.'],
    ['sails', 'паруса'], ['a hull paint', 'краска корпуса'], ['lanterns', 'фонари'], ['an emblem', 'эмблема'], ['a colour', 'цвет'], ['a flag field', 'поле флага'], ['a flag', 'флаг'],
  ];
}
