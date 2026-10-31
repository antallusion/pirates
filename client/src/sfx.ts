// The sound map (owner, 2026-10-16, the retention batch's sound pass; recorded since the sound design of 2026-11-01):
// every game event that should be heard, the recipe of AudioEngine (audio.ts) that plays it and its bus — each recipe
// plays its recording from assets/audio (sounds.ts, tools/audio/recipe.ts) and its old procedural sound only until the
// recording is decoded. The UI modules that know an event (the hex fight, the calendar, the shop…)
// call `cue(kind)` and need not hold the engine: main.ts sets the player once. A cue is skipped while the engine is
// muted, locked (no gesture yet) or the page is hidden (audio.ts), and each kind keeps a least gap so a burst of the
// same event (a sweep's six blows) is one sound and not a buzz.

export type Bus = 'sea' | 'combat' | 'ui' | 'music';

/** The cues the UI asks for by name (the sea's own events go through AudioEngine.onEvent). */
export type SoundCue =
  | 'blow' | 'shot' | 'luck' | 'rally' | 'heal' | 'fear' | 'spell' | 'win' | 'lose'
  | 'click' | 'buy' | 'level' | 'built' | 'gift' | 'notice' | 'undock'
  // the sound design (2026-11-01): the interface's windows and tabs, the world's small doings, the hex fight's voices
  | 'hover' | 'tab' | 'open' | 'close' | 'error' | 'chat' | 'equip' | 'quest' | 'map' | 'found' | 'cast' | 'reel'
  | 'anchor' | 'sail' | 'turn' | 'death' | 'step' | 'roar' | 'bite' | 'moan' | 'drum';

export interface CueDef {
  /** The AudioEngine method that plays it. */
  recipe: string;
  bus: Bus;
  /** The least time between two of the kind (ms). */
  gap: number;
}

export const CUES: Record<SoundCue, CueDef> = {
  blow: { recipe: 'blow', bus: 'combat', gap: 70 },
  shot: { recipe: 'tacShot', bus: 'combat', gap: 70 },
  luck: { recipe: 'luck', bus: 'combat', gap: 250 },
  rally: { recipe: 'rally', bus: 'combat', gap: 400 },
  heal: { recipe: 'heal', bus: 'combat', gap: 250 },
  fear: { recipe: 'fear', bus: 'combat', gap: 300 },
  spell: { recipe: 'spell', bus: 'combat', gap: 200 },
  win: { recipe: 'victory', bus: 'music', gap: 3000 },
  lose: { recipe: 'defeat', bus: 'music', gap: 3000 },
  click: { recipe: 'click', bus: 'ui', gap: 45 },
  buy: { recipe: 'purchase', bus: 'ui', gap: 400 },
  level: { recipe: 'levelUp', bus: 'ui', gap: 3000 },
  built: { recipe: 'built', bus: 'ui', gap: 1500 },
  gift: { recipe: 'gift', bus: 'ui', gap: 1500 },
  notice: { recipe: 'notice', bus: 'ui', gap: 1200 },
  undock: { recipe: 'anchorUp', bus: 'sea', gap: 5000 },
  hover: { recipe: 'hover', bus: 'ui', gap: 60 },
  tab: { recipe: 'tab', bus: 'ui', gap: 90 },
  open: { recipe: 'openWin', bus: 'ui', gap: 250 },
  close: { recipe: 'closeWin', bus: 'ui', gap: 250 },
  error: { recipe: 'error', bus: 'ui', gap: 600 },
  chat: { recipe: 'chat', bus: 'ui', gap: 700 },
  equip: { recipe: 'equip', bus: 'ui', gap: 150 },
  quest: { recipe: 'quest', bus: 'ui', gap: 2500 },
  map: { recipe: 'mapOpen', bus: 'ui', gap: 800 },
  found: { recipe: 'found', bus: 'ui', gap: 2000 },
  cast: { recipe: 'cast', bus: 'ui', gap: 800 },
  reel: { recipe: 'reel', bus: 'ui', gap: 1500 },
  anchor: { recipe: 'anchorDown', bus: 'sea', gap: 5000 },
  sail: { recipe: 'sailSet', bus: 'sea', gap: 900 },
  turn: { recipe: 'turnPing', bus: 'ui', gap: 600 },
  death: { recipe: 'death', bus: 'combat', gap: 120 },
  step: { recipe: 'step', bus: 'combat', gap: 400 },
  roar: { recipe: 'roar', bus: 'combat', gap: 300 },
  bite: { recipe: 'bite', bus: 'combat', gap: 120 },
  moan: { recipe: 'moan', bus: 'combat', gap: 400 },
  drum: { recipe: 'drum', bus: 'combat', gap: 4000 },
};

/** Every event of the audit (owner's list, 2026-10-16) and what plays it: a cue, or the engine's own handling of the
 *  sea's events (onEvent) and the scene (ambience, frame). The test holds every one of them to a real recipe. */
export const SOUND_MAP: Record<string, { recipe: string; via: 'cue' | 'event' | 'scene' }> = {
  'sea: own and others\' firing': { recipe: 'cannon', via: 'event' },
  'sea: a ball home': { recipe: 'hit', via: 'event' },
  'sea: a ball wide': { recipe: 'splash', via: 'event' },
  'sea: a ship sunk, an explosion': { recipe: 'explosion', via: 'event' },
  'sea: boarding rounds (muskets, steel, the roar)': { recipe: 'clash', via: 'event' },
  'hex fight: a blow and its answer': { recipe: 'blow', via: 'cue' },
  'hex fight: a shot': { recipe: 'tacShot', via: 'cue' },
  'hex fight: a lucky blow': { recipe: 'luck', via: 'cue' },
  'hex fight: high morale, another turn': { recipe: 'rally', via: 'cue' },
  'hex fight: a heal, a regrowth, a raise': { recipe: 'heal', via: 'cue' },
  'hex fight: a turn lost to fear': { recipe: 'fear', via: 'cue' },
  'hex fight: an order cast': { recipe: 'spell', via: 'cue' },
  'hex fight: won': { recipe: 'victory', via: 'cue' },
  'hex fight: lost': { recipe: 'defeat', via: 'cue' },
  'ui: a button pressed': { recipe: 'click', via: 'cue' },
  'ui: a purchase': { recipe: 'purchase', via: 'cue' },
  'ui: silver and gold toasts': { recipe: 'coins', via: 'event' },
  'ui: level up': { recipe: 'levelUp', via: 'cue' },
  'island: a building finished': { recipe: 'built', via: 'cue' },
  'daily gift taken': { recipe: 'gift', via: 'cue' },
  'notices: news, mail, a world call': { recipe: 'notice', via: 'cue' },
  'port: docking (the harbour bell)': { recipe: 'bell', via: 'event' },
  'port: leaving (the anchor weighed, the bosun\'s pipe)': { recipe: 'anchorUp', via: 'cue' },
  'port: docking (the anchor let go)': { recipe: 'anchorDown', via: 'cue' },
  'ui: hover': { recipe: 'hover', via: 'cue' },
  'ui: a tab (a page turned)': { recipe: 'tab', via: 'cue' },
  'ui: a window opens (the book)': { recipe: 'openWin', via: 'cue' },
  'ui: a window closes': { recipe: 'closeWin', via: 'cue' },
  'ui: an error, a refusal': { recipe: 'error', via: 'cue' },
  'ui: a chat message': { recipe: 'chat', via: 'cue' },
  'ui: an item equipped': { recipe: 'equip', via: 'cue' },
  'ui: a quest done, a goal reached': { recipe: 'quest', via: 'cue' },
  'ui: the map opened': { recipe: 'mapOpen', via: 'cue' },
  'treasure: the spade (the dig fx)': { recipe: 'dig', via: 'event' },
  'treasure: found': { recipe: 'found', via: 'cue' },
  'fishing: the line cast': { recipe: 'cast', via: 'cue' },
  'fishing: the haul (the reel)': { recipe: 'reel', via: 'cue' },
  'ship: sails set or struck': { recipe: 'sailSet', via: 'cue' },
  'ship: the rudder hard over (the timbers)': { recipe: 'turnCreak', via: 'scene' },
  'hex fight: your turn': { recipe: 'turnPing', via: 'cue' },
  'hex fight: men fall': { recipe: 'death', via: 'cue' },
  'hex fight: a stack moves (feet on the deck)': { recipe: 'step', via: 'cue' },
  'hex fight: a beast strikes (a roar)': { recipe: 'roar', via: 'cue' },
  'hex fight: a beast bites': { recipe: 'bite', via: 'cue' },
  'hex fight: the drowned strike (a moan)': { recipe: 'moan', via: 'cue' },
  'hex fight: the drums of its start': { recipe: 'drum', via: 'cue' },
  'sea: a sea beast or a boss roars': { recipe: 'deepRoar', via: 'event' },
  'sea: chain shot tears the sails': { recipe: 'sailRip', via: 'event' },
  'sea: a ball overhead': { recipe: 'whistle', via: 'event' },
  'sea: a ship sinking (groan and gurgle)': { recipe: 'sink', via: 'event' },
  'sea: grapples thrown, ropes taut': { recipe: 'grapple', via: 'event' },
  'sea: rockets, fireworks': { recipe: 'firework', via: 'event' },
  'ambience: waves, wind, gale, rain, hull, gulls, harbour, tavern': { recipe: 'ambience', via: 'scene' },
  'weather: thunder': { recipe: 'thunder', via: 'scene' },
  'weather: wind and rain': { recipe: 'ambience', via: 'scene' },
  'ship: the watch bells, the creak of the rigging': { recipe: 'frame', via: 'scene' },
  'music: by the scene (calm, fog, chase, battle, storm, port, island, the deep)': { recipe: 'frame', via: 'scene' },
};

type Player = (cue: SoundCue, delay: number) => void;
let player: Player | null = null;
const lastAt = new Map<SoundCue, number>();

/** main.ts: the engine that plays the cues. */
export function setCuePlayer(p: Player | null): void {
  player = p;
}

/** Whether a cue may play at `now` (ms) after the last of its kind: pure. */
export function mayCue(kind: SoundCue, now: number, last: number | undefined): boolean {
  return last === undefined || now - last >= CUES[kind].gap;
}

/** A cue now, or `delayMs` from now (a blow lands when its lunge does). */
export function cue(kind: SoundCue, delayMs = 0): void {
  if (!player) return;
  const now = (globalThis.performance?.now() ?? Date.now()) + Math.max(0, delayMs);
  if (!mayCue(kind, now, lastAt.get(kind))) return;
  lastAt.set(kind, now);
  player(kind, Math.max(0, delayMs) / 1000);
}

/** The voice of a blow on the hexes by who strikes (the sound design, 2026-11-01): the drowned and the undead moan, a
 *  beast of the deep or the shore roars or bites (by the blow's number, so a fight has both), men cross steel. Pure. */
export function blowVoice(u: { beast?: boolean; deep?: boolean; specials?: readonly string[] } | null | undefined, n = 0): 'blow' | 'roar' | 'bite' | 'moan' {
  if (!u) return 'blow';
  if (u.specials?.includes('undead')) return 'moan';
  if (u.beast || u.deep) return n % 3 === 0 ? 'roar' : 'bite';
  return 'blow';
}
