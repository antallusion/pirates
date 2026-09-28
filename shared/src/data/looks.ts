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
export const EMBLEM_COUNT = GLYPHS.length * 3;
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
  regatta: ['sail:7', 'color:7', 'field:9'],
  dutchman: ['lamp:1', 'emblem:57', 'emblem:58', 'emblem:59', 'hull:7'],
  revenge: ['emblem:1', 'emblem:2', 'emblem:4', 'emblem:5', 'hull:2'],
  wonders: ['hull:3', 'hull:4', 'hull:5', 'hull:6', 'field:3', 'field:4', 'sail:4', 'sail:5', 'lamp:2', 'color:8', 'color:9', 'color:10', 'color:11'],
  dice: ['emblem:27', 'emblem:28', 'emblem:29', 'lamp:3', 'field:6', 'field:7', 'field:8'],
  quest: ['sail:2', 'sail:3', 'sail:6', ...Array.from({ length: 30 }, (_, i) => `emblem:${12 + i}`)],
};

export function emblemName(i: number): Tr {
  const g = GLYPHS[Math.floor(i / 3)], st = EMBLEM_STYLES[i % 3];
  return [`${g.name[0]} (${st[0]})`, `${g.name[1]} (${st[1]})`];
}

export function lookPatterns(): [string, string][] {
  return [
    ['A new look for your ship: {0}.', 'Новое для облика корабля: {0}.'],
    ['The look is changed in port.', 'Облик меняют в порту.'],
    ['That is not yours yet.', 'Это вам пока не открыто.'],
    ['Her new colours are flown.', 'Новые цвета подняты.'],
    ['sails', 'паруса'], ['a hull paint', 'краска корпуса'], ['lanterns', 'фонари'], ['an emblem', 'эмблема'], ['a colour', 'цвет'], ['a flag field', 'поле флага'],
  ];
}
