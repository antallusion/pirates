// Player options (docs/07 §11): accessibility, controls, sound and graphics. Kept in localStorage, applied at
// once. Pure parts (the keymap, presets, conflicts, colour-blind remapping) are unit-tested.

import { lang } from './i18n.ts';

export type Action =
  | 'sailUp' | 'sailDown' | 'rudderLeft' | 'rudderRight' | 'firePort' | 'fireStarboard' | 'chasers'
  | 'ammo1' | 'ammo2' | 'ammo3' | 'ammo4' | 'ammo5' | 'cursedShot'
  | 'talent1' | 'talent2' | 'talent3' | 'talent4' | 'talent5'
  | 'abilityZ' | 'abilityX' | 'abilityC' | 'abilityV' | 'fireMode'
  | 'board' | 'land' | 'orders' | 'repair' | 'dock' | 'formation' | 'harbour'
  | 'map' | 'talents' | 'ship' | 'crew' | 'company' | 'help' | 'mute' | 'readAloud';

export const ACTIONS: Action[] = [
  'sailUp', 'sailDown', 'rudderLeft', 'rudderRight', 'firePort', 'fireStarboard', 'chasers',
  'ammo1', 'ammo2', 'ammo3', 'ammo4', 'ammo5', 'cursedShot', 'talent1', 'talent2', 'talent3', 'talent4', 'talent5',
  'abilityZ', 'abilityX', 'abilityC', 'abilityV', 'fireMode', 'board', 'land', 'orders', 'repair', 'dock', 'formation', 'harbour',
  'map', 'talents', 'ship', 'crew', 'company', 'help', 'mute', 'readAloud',
];

/** Two bindings per action (the second may be empty). Keys are `KeyboardEvent.key`, lower-cased. */
export type Keymap = Record<Action, [string, string]>;

const CLASSIC: Keymap = {
  sailUp: ['w', 'arrowup'], sailDown: ['s', 'arrowdown'], rudderLeft: ['a', 'arrowleft'], rudderRight: ['d', 'arrowright'],
  firePort: ['q', ''], fireStarboard: ['e', ''], chasers: [' ', ''],
  ammo1: ['1', ''], ammo2: ['2', ''], ammo3: ['3', ''], ammo4: ['4', ''], ammo5: ['5', ''], cursedShot: ['u', ''],
  talent1: ['6', ''], talent2: ['7', ''], talent3: ['8', ''], talent4: ['9', ''], talent5: ['0', ''],
  abilityZ: ['z', ''], abilityX: ['x', ''], abilityC: ['c', ''], abilityV: ['v', ''], fireMode: ['k', ''],
  board: ['b', ''], land: ['l', ''], orders: ['g', ''], repair: ['r', ''], dock: ['f', ''], formation: ['j', ''], harbour: ['p', ''],
  map: ['m', ''], talents: ['t', ''], ship: ['i', ''], crew: ['o', ''], company: ['y', ''], help: ['h', 'f1'], mute: ['n', ''], readAloud: ['f2', ''],
};

/** The four presets of §11.4. */
export const PRESETS: Record<'classic' | 'arrows' | 'lefthand' | 'onehand', Keymap> = {
  classic: CLASSIC,
  // Arrows steer; the broadsides sit under the right hand's neighbours.
  arrows: {
    ...CLASSIC,
    sailUp: ['arrowup', ''], sailDown: ['arrowdown', ''], rudderLeft: ['arrowleft', ''], rudderRight: ['arrowright', ''],
    firePort: [',', 'q'], fireStarboard: ['.', 'e'], chasers: ['/', ' '],
  },
  // The left hand on ESDF, everything it needs within reach.
  lefthand: {
    ...CLASSIC,
    sailUp: ['e', ''], sailDown: ['d', ''], rudderLeft: ['s', ''], rudderRight: ['f', ''],
    firePort: ['w', ''], fireStarboard: ['r', ''], chasers: [' ', ''],
    repair: ['t', ''], dock: ['g', ''], orders: ['v', ''], abilityV: ['b', ''], board: ['c', ''], talents: ['y', ''], company: ['u', ''], cursedShot: ['', ''],
    abilityZ: ['z', ''], abilityX: ['x', ''], abilityC: ['q', ''], land: ['a', ''], formation: ['', ''], fireMode: ['', ''],
  },
  // Mouse and six keys: the helm and the sails on four, board and dock on two; the mouse fires.
  onehand: {
    ...Object.fromEntries(ACTIONS.map((a) => [a, ['', ''] as [string, string]])),
    sailUp: ['w', 'arrowup'], sailDown: ['s', 'arrowdown'], rudderLeft: ['a', 'arrowleft'], rudderRight: ['d', 'arrowright'],
    board: ['e', ''], dock: ['q', ''], help: ['f1', ''], map: ['m', ''], readAloud: ['f2', ''],
  } as Keymap,
};

/**
 * The key a press stands for in a keymap, whatever the keyboard layout: letters and digits by their physical
 * place (a Russian layout's «ц» is still W), everything else by name. Keymaps store these names.
 */
export function keyOf(e: { key: string; code?: string }): string {
  const code = e.code ?? '';
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1].toLowerCase();
  m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (m) return m[1];
  return e.key.toLowerCase();
}

/** The action a key triggers, if any. */
export function actionFor(map: Keymap, key: string): Action | null {
  const k = key.toLowerCase();
  if (!k) return null;
  for (const a of ACTIONS) if (map[a][0] === k || map[a][1] === k) return a;
  return null;
}

/** Keys bound to more than one action. */
export function conflicts(map: Keymap): Map<string, Action[]> {
  const by = new Map<string, Action[]>();
  for (const a of ACTIONS) for (const k of map[a]) if (k) by.set(k, [...(by.get(k) ?? []), a]);
  for (const [k, list] of [...by]) if (list.length < 2) by.delete(k);
  return by;
}

/** How a key reads on screen. */
export function keyLabel(k: string): string {
  if (!k) return '—';
  if (k === ' ') return lang() === 'ru' ? 'Пробел' : 'Space';
  if (k.startsWith('arrow')) return { arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' }[k] ?? k;
  return k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1);
}

// ------------------------------------------------------------------ colour-blind palettes (§11.1)

export type Colorblind = 'off' | 'protan' | 'deutan' | 'tritan';

/**
 * Remaps the colours that carry meaning (ember-red danger, teal anomaly, moon-blue friends, amber targets) to
 * pairs each kind of colour blindness still tells apart. Everything else passes through.
 */
const REMAP: Record<Exclude<Colorblind, 'off'>, Record<string, string>> = {
  // Red-weak: danger goes orange-yellow, teal goes blue.
  protan: { '#d4542b': '#e8a13a', '#d2473a': '#e8a13a', '#c9372c': '#e8a13a', '#2ee6c8': '#3a8fe8', '#3f7d4a': '#5a7bd8', '#7fb0d0': '#9cc8ff' },
  // Green-weak: the same axis, a touch warmer.
  deutan: { '#d4542b': '#f0a030', '#d2473a': '#f0a030', '#c9372c': '#f0a030', '#2ee6c8': '#4a8cff', '#3f7d4a': '#6a6ad8', '#7fb0d0': '#a8c8ff' },
  // Blue-weak: teal to magenta, moon-blue to pink, amber stays apart from red.
  tritan: { '#2ee6c8': '#e84ac8', '#7fb0d0': '#e89ab8', '#e0b862': '#f2f2f2', '#3f7d4a': '#2c9a3a' },
};

export function cbColor(mode: Colorblind, hex: string): string {
  if (mode === 'off') return hex;
  return REMAP[mode][hex.toLowerCase()] ?? hex;
}

// ------------------------------------------------------------------ the options

export interface Settings {
  uiScale: number; // 0.7–2
  textScale: number; // 0.9–1.5
  colorblind: Colorblind;
  highContrast: boolean;
  plainFont: boolean;
  lanternMarks: boolean; // faction glyphs by the lanterns at battle zoom
  reduceFlashes: boolean; // lightning and muzzle flashes become a gentle brightening
  screenShake: boolean;
  lanternFlicker: boolean;
  reduceMotion: boolean; // UI transitions and animations
  effects: 'auto' | 'low';
  webgl: boolean;
  plainTerms: boolean; // "close to the wind" for "close-hauled"
  captions: boolean; // sound captions with direction
  mono: boolean;
  volume: { master: number; sea: number; combat: number; ui: number; music: number };
  keys: Keymap;
}

export function defaults(): Settings {
  return {
    uiScale: 1, textScale: 1, colorblind: 'off', highContrast: false, plainFont: false, lanternMarks: false,
    reduceFlashes: false, screenShake: true, lanternFlicker: true, reduceMotion: false, effects: 'auto', webgl: true,
    plainTerms: false, captions: false, mono: false, volume: { master: 0.7, sea: 1, combat: 1, ui: 1, music: 0.8 },
    keys: structuredClone(CLASSIC),
  };
}

/** Fills what an older save lacks and clamps what is out of range. */
export function sanitize(raw: Partial<Settings> | null): Settings {
  const d = defaults();
  const s = { ...d, ...(raw ?? {}) } as Settings;
  s.volume = { ...d.volume, ...(raw?.volume ?? {}) };
  s.keys = { ...d.keys, ...(raw?.keys ?? {}) };
  for (const a of ACTIONS) if (!Array.isArray(s.keys[a]) || s.keys[a].length !== 2) s.keys[a] = d.keys[a];
  s.uiScale = Math.min(2, Math.max(0.7, Number(s.uiScale) || 1));
  s.textScale = Math.min(1.5, Math.max(0.9, Number(s.textScale) || 1));
  if (!['off', 'protan', 'deutan', 'tritan'].includes(s.colorblind)) s.colorblind = 'off';
  for (const k of ['master', 'sea', 'combat', 'ui', 'music'] as const) s.volume[k] = Math.min(1, Math.max(0, Number(s.volume[k]) || 0));
  return s;
}

const KEY = 'gravetide.settings';
let current: Settings = load();
const listeners: ((s: Settings) => void)[] = [];

function load(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const s = sanitize(raw ? (JSON.parse(raw) as Partial<Settings>) : null);
    // Older switches, kept where they were.
    if (globalThis.localStorage?.getItem('gravetide.gl') === 'off') s.webgl = false;
    const vol = globalThis.localStorage?.getItem('gravetide.volume');
    if (!raw && vol !== null && vol !== undefined) s.volume.master = Number(vol) || 0.7;
    return s;
  } catch {
    return defaults();
  }
}

export function settings(): Settings {
  return current;
}

export function update(patch: Partial<Settings>): void {
  current = sanitize({ ...current, ...patch });
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
    globalThis.localStorage?.setItem('gravetide.gl', current.webgl ? 'on' : 'off');
  } catch {
    /* no storage */
  }
  for (const f of listeners) f(current);
}

export function onSettings(f: (s: Settings) => void): void {
  listeners.push(f);
}

/** The page-level half: CSS variables and classes on <body>. */
export function applyToDocument(s: Settings): void {
  if (!globalThis.document) return;
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(s.uiScale));
  root.style.setProperty('--text-scale', String(s.textScale));
  const b = document.body.classList;
  b.toggle('hi-contrast', s.highContrast);
  b.toggle('plain-font', s.plainFont);
  b.toggle('reduce-motion', s.reduceMotion);
  for (const m of ['protan', 'deutan', 'tritan']) b.toggle(`cb-${m}`, s.colorblind === m);
}
