// The sound design's recipe (owner 2026-11-01: «бесплатную музыку и звуки … на пиратскую тематику, каждый звук»): every
// key the client plays (client/src/sounds.ts), its variants and where each one comes from. Only free, legally safe
// sources: CC0 (Kenney.nl, Freesound items marked CC0, OpenGameArt items marked CC0) and CC-BY music with its credit
// (assets/audio/CREDITS.md, the options' «Об игре», the site's credits). No AI audio, nothing non-commercial.
// tools/audio/build.ts downloads what is missing into assets/raw/audio-src (gitignored), cuts, normalises and encodes
// each into assets/audio/<kind>/<key>-<n>.ogg (Opus) and .m4a (AAC, for Safari / iOS), and writes
// assets/audio/index.json and sources.json.
//
// A source: 'fs:<id>' (Freesound, its HQ preview), 'kenney:<pack>/<file>' (assets/raw/audio-src/kenney),
// 'oga:<slug>/<file>' (assets/raw/audio-src/oga, downloaded from opengameart.org/content/<slug>).

export type Kind = 'sfx' | 'amb' | 'music';
/** The engine's buses (audio.ts): the sea and weather (ambience), the fighting (sfx), the interface, the score. */
export type Bus = 'sea' | 'combat' | 'ui' | 'music';

export interface Clip {
  src: string;
  /** Seconds into the source. */
  at?: number;
  /** Seconds to take (the rest is cut; a fade-out at its end). */
  dur?: number;
  /** A fade-out at the end (s); sfx 0.04 by default. */
  fade?: number;
  /** Extra gain after the normalisation (dB). */
  gain?: number;
  /** Played faster / slower (pitch with it): 1.1 = up ~a tone and a half. */
  rate?: number;
  /** Keep the leading silence (a sound that starts soft on purpose). */
  keepHead?: boolean;
}

export interface SoundDef {
  kind: Kind;
  bus: Bus;
  clips: (Clip | string)[];
  /** Fetched on the first gesture with the core set (≤ 1.5 MB in all); the rest when first asked for. */
  preload?: boolean;
  /** Looped (ambience, music): the tail is crossfaded into the head so the seam is not heard. */
  loop?: boolean;
  /** The crossfade of a loop's seam (s). 0 for a file made to loop. */
  xfade?: number;
  /** Stereo (music). */
  stereo?: boolean;
  /** The loudness target (LUFS); sfx −16, ambience −22, music −16. */
  lufs?: number;
  /** What it is for (the credits table). */
  what: string;
}

const fs = (id: number, o: Omit<Clip, 'src'> = {}): Clip => ({ src: `fs:${id}`, ...o });
const k = (p: string, o: Omit<Clip, 'src'> = {}): Clip => ({ src: `kenney:${p}`, ...o });
const oga = (p: string, o: Omit<Clip, 'src'> = {}): Clip => ({ src: `oga:${p}`, ...o });

export const SOUNDS: Record<string, SoundDef> = {
  // ------------------------------------------------------------------------------------------------- music (streamed)
  'mus.title': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 0, what: 'title and menu', clips: [oga('blackmoor-tides-epic-pirate-battle-theme/unz/Epic Pirate Battle Theme/Blackmoor Tides Loop.wav')] },
  'mus.calm': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 3, what: 'open sea, calm', clips: [oga('ocean-music-pack/01_exploring_the_ocean.wav')] },
  'mus.calm2': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 3, what: 'open sea, calm (second)', clips: [oga('a-sailors-chant/oga_jam_menu_music_loopable_0.ogg')] },
  'mus.fog': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 3, what: 'fog, the quiet sea', clips: [oga('ocean-music-pack/03_hearts_separated_by_the_ocean.wav')] },
  'mus.storm': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 3, what: 'storm', clips: [oga('ocean-music-pack/05_stranded_in_the_ocean.wav')] },
  'mus.chase': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 0, what: 'sea battle and chase', clips: [oga('ocean-music-pack/07_ready_cannons_and_fire.wav')] },
  'mus.battle': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 0, what: 'boarding / hex battle', clips: [oga('blackmoor-tides-epic-pirate-battle-theme/unz/Epic Pirate Battle Theme/Blackmoor Tides Loop (No Chants).wav')] },
  'mus.boss': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 0, what: 'boss fight', clips: [oga('ocean-music-pack/06_the_kraken_loop.wav')] },
  'mus.anomaly': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 3, what: 'anomaly, the Abyss', clips: [oga('ocean-music-pack/04_sirens_call.wav')] },
  'mus.port': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 3, what: 'port', clips: [oga('ocean-music-pack/02_seaside_village.wav')] },
  'mus.tavern': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 0, what: 'tavern', clips: [oga('medieval-the-old-tower-inn/Loop_The_Old_Tower_Inn.wav')] },
  'mus.isle': { kind: 'music', bus: 'music', stereo: true, loop: true, xfade: 0, what: 'island and building view', clips: [oga('medieval-kings-feast/Loop_Kings_Feast_0.wav')] },
  'mus.win': { kind: 'music', bus: 'music', stereo: true, what: 'victory sting', clips: [oga('victory-fanfare-short/Heavy_ConceptB.wav')] },
  'mus.lose': { kind: 'music', bus: 'music', stereo: true, what: 'defeat sting', clips: [fs(427803, { dur: 4.4, fade: 1.2 })] },

  // ------------------------------------------------------------------------------------------- ambience (decoded loops)
  'amb.sea': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'waves along the hull', clips: [fs(360631, { at: 10, dur: 20 })] },
  'amb.waves': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'open-sea waves (rough)', clips: [fs(531015, { at: 8, dur: 20 })] },
  'amb.wind': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'wind', clips: [fs(117136, { at: 5, dur: 18 })] },
  'amb.gale': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'storm wind howl', clips: [fs(117611, { at: 4, dur: 18 })] },
  'amb.rain': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'rain', clips: [fs(200273, { at: 10, dur: 16 })] },
  'amb.creak': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -24, what: 'creaking hull', clips: [fs(397620, { at: 6, dur: 18 })] },
  'amb.gulls': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -24, what: 'gulls near land', clips: [fs(537854, { at: 2, dur: 18 })] },
  'amb.harbour': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'harbour bustle', clips: [fs(254130, { at: 2, dur: 20 })] },
  'amb.tavern': { kind: 'amb', bus: 'sea', loop: true, xfade: 2, lufs: -22, what: 'tavern crowd', clips: [fs(695295, { at: 5, dur: 22 })] },
  'amb.fire': { kind: 'amb', bus: 'combat', loop: true, xfade: 1.5, lufs: -22, what: 'fire crackle aboard', clips: [fs(363092, { at: 2, dur: 12 })] },

  // ---------------------------------------------------------------------------------------------------- naval combat
  'cannon': { kind: 'sfx', bus: 'combat', preload: true, what: 'cannon (broadside gun)', clips: [fs(448002, { dur: 2.6, fade: 1 }), fs(162455, { dur: 2.4, fade: 0.8 }), fs(184651, { dur: 1.4, fade: 0.5 }), fs(106850, { dur: 2.6, fade: 1 })] },
  'cannon.heavy': { kind: 'sfx', bus: 'combat', preload: true, what: 'heavy gun, carronade, mortar launch', clips: [fs(853281, { dur: 2.4, fade: 1 }), fs(621003, { dur: 2.6, fade: 1 }), fs(186930, { dur: 2.4, fade: 1 })] },
  'swivel': { kind: 'sfx', bus: 'combat', what: 'swivel gun, grapeshot', clips: [fs(244345, { dur: 1.6, fade: 0.6, rate: 0.85 }), fs(234869, { dur: 1.6, fade: 0.6, rate: 0.85 })] },
  'whistle': { kind: 'sfx', bus: 'combat', what: 'a ball overhead', clips: [fs(789222, { dur: 1.3 }), fs(241840, { dur: 1.6, fade: 0.3 })] },
  'splash': { kind: 'sfx', bus: 'combat', preload: true, what: 'a ball falls short', clips: [fs(737233), fs(398032, { dur: 1.2, fade: 0.4 }), fs(9508, { dur: 1.4, fade: 0.5 })] },
  'splash.big': { kind: 'sfx', bus: 'combat', preload: true, what: 'a big splash, a ship goes down, a beast dives', clips: [fs(442773, { dur: 2.2, fade: 0.6 }), fs(212143, { dur: 2, fade: 0.6 })] },
  'hull': { kind: 'sfx', bus: 'combat', preload: true, what: 'a ball home: the hull cracks', clips: [fs(183450, { dur: 1.2, fade: 0.4 }), fs(183453, { dur: 1.2, fade: 0.4 }), fs(183452, { dur: 1.2, fade: 0.4 }), k('impact-sounds/impactWood_heavy_002.ogg')] },
  'hull.crit': { kind: 'sfx', bus: 'combat', what: 'a crushing hit, a ram, a hull on the rocks', clips: [fs(241601, { dur: 2, fade: 0.6 }), fs(501302, { dur: 1.4, fade: 0.4 })] },
  'sail.rip': { kind: 'sfx', bus: 'combat', what: 'chain shot tears the sails', clips: [fs(507756), fs(565970, { dur: 1 }), fs(221680, { dur: 0.8 })] },
  'explosion': { kind: 'sfx', bus: 'combat', preload: true, what: 'powder explosion', clips: [fs(182429, { dur: 3, fade: 1.2 }), fs(523089, { dur: 1.2, fade: 0.4 }), fs(398283, { dur: 3, fade: 1.2 })] },
  'sink': { kind: 'sfx', bus: 'combat', what: 'a ship sinking: groan and gurgle', clips: [fs(31574, { at: 20, dur: 5, fade: 2 }), fs(423959, { dur: 5, fade: 2 })] },
  'grapple': { kind: 'sfx', bus: 'combat', what: 'grapples thrown', clips: [fs(541975), fs(346373, { gain: -4 })] },
  'rope': { kind: 'sfx', bus: 'combat', what: 'the ropes go taut', clips: [fs(596513, { at: 2, dur: 3, fade: 1 }), fs(145786, { at: 2, dur: 3, fade: 1 })] },
  'bell': { kind: 'sfx', bus: 'ui', preload: true, what: "ship's bell: alerts, docking, the watch", clips: [fs(353233, { fade: 1.5 })] },
  'bell.double': { kind: 'sfx', bus: 'ui', what: "ship's bell, two strikes", clips: [fs(353232, { fade: 1.2 })] },
  'drum': { kind: 'sfx', bus: 'combat', what: 'battle drums: a fight begins', clips: [fs(209546, { dur: 3.2, fade: 1 }), fs(475246, { dur: 2.6, fade: 0.8 })] },
  'roar.deep': { kind: 'sfx', bus: 'combat', what: 'a sea beast, a boss roars', clips: [fs(837799, { dur: 4, fade: 1.5 }), fs(341173, { dur: 4, fade: 1.5 }), fs(398908, { dur: 3.5, fade: 1.2 })] },
  'whale': { kind: 'sfx', bus: 'combat', what: 'the deep call, a song from below', clips: [fs(88449, { dur: 5, fade: 1.5 }), fs(684188, { dur: 6, fade: 2 })] },
  'thunder': { kind: 'sfx', bus: 'sea', what: 'thunder', clips: [fs(244053, { dur: 8, fade: 3 }), fs(399656, { dur: 8, fade: 3 }), fs(193170, { dur: 6, fade: 2 })] },
  'firework': { kind: 'sfx', bus: 'combat', what: 'rocket, firework', clips: [fs(774236, { dur: 3.2, fade: 1 })] },

  // --------------------------------------------------------------------------------------------- the hex battle
  'clash': { kind: 'sfx', bus: 'combat', preload: true, what: 'sword clash', clips: [fs(471095, { dur: 1, fade: 0.3 }), fs(334169), fs(326868, { dur: 1, fade: 0.3 }), fs(364530, { dur: 1.2, fade: 0.4 })] },
  'swing': { kind: 'sfx', bus: 'combat', preload: true, what: 'a blade swung, a miss', clips: [fs(60013), fs(243400, { dur: 0.8 }), fs(683101, { dur: 0.8 })] },
  'thud': { kind: 'sfx', bus: 'combat', preload: true, what: 'a blow lands', clips: [fs(118513), fs(104183, { dur: 0.6 }), k('impact-sounds/impactPunch_heavy_001.ogg')] },
  'musket': { kind: 'sfx', bus: 'combat', preload: true, what: 'musket / pistol shot', clips: [fs(244345, { dur: 1.4, fade: 0.5 }), fs(234869, { dur: 1.4, fade: 0.5 }), fs(347647, { dur: 1.4, fade: 0.5 }), fs(538795, { dur: 1.4, fade: 0.5 })] },
  'roar': { kind: 'sfx', bus: 'combat', what: 'a creature attacks: roar', clips: [fs(489901, { dur: 2, fade: 0.6 }), fs(342204, { dur: 2, fade: 0.6 }), fs(171178, { dur: 2, fade: 0.6 })] },
  'bite': { kind: 'sfx', bus: 'combat', what: 'a creature bites', clips: [fs(467701, { dur: 1.2, fade: 0.3 }), fs(348112)] },
  'moan': { kind: 'sfx', bus: 'combat', what: 'the drowned and the undead', clips: [fs(643741, { dur: 2.6, fade: 1 }), fs(426628, { dur: 2.4, fade: 0.8 })] },
  'spell': { kind: 'sfx', bus: 'combat', what: 'an order or a path cast', clips: [fs(442774), fs(241809, { dur: 2, fade: 0.6 }), fs(455341, { dur: 2.4, fade: 0.8 })] },
  'heal': { kind: 'sfx', bus: 'combat', what: 'a heal, a regrowth, a raise', clips: [fs(562292)] },
  'fear': { kind: 'sfx', bus: 'combat', what: 'a turn lost to fear', clips: [fs(204963, { dur: 2.4, fade: 0.8 })] },
  'rally': { kind: 'sfx', bus: 'combat', what: 'high morale: the crew cheers', clips: [fs(764158, { at: 0.5, dur: 2.4, fade: 0.8 })] },
  'luck': { kind: 'sfx', bus: 'combat', what: 'a lucky blow', clips: [fs(351408, { dur: 1.6, fade: 0.6 })] },
  'death': { kind: 'sfx', bus: 'combat', what: 'men fall', clips: [fs(447922), fs(417994, { dur: 1.2, fade: 0.3 }), fs(416839)] },
  'step': { kind: 'sfx', bus: 'combat', what: 'footsteps on deck', clips: [k('impact-sounds/footstep_wood_000.ogg'), k('impact-sounds/footstep_wood_001.ogg'), k('impact-sounds/footstep_wood_002.ogg'), k('impact-sounds/footstep_wood_003.ogg')] },
  'turn': { kind: 'sfx', bus: 'ui', what: 'your turn', clips: [k('interface-sounds/question_002.ogg')] },
  'crowd': { kind: 'sfx', bus: 'combat', what: 'a crew roars (boarding)', clips: [fs(764158, { at: 2, dur: 3.2, fade: 1 })] },

  // --------------------------------------------------------------------------------------------------------- the UI
  'click': { kind: 'sfx', bus: 'ui', preload: true, what: 'a button', clips: [k('ui-audio/click1.ogg', { gain: -4 }), k('ui-audio/click3.ogg', { gain: -4 }), k('ui-audio/click2.ogg', { gain: -4 })] },
  'hover': { kind: 'sfx', bus: 'ui', preload: true, what: 'hover (quiet)', clips: [k('ui-audio/rollover2.ogg', { gain: -10 }), k('ui-audio/rollover3.ogg', { gain: -10 })] },
  'tab': { kind: 'sfx', bus: 'ui', preload: true, what: 'a tab, a page turned', clips: [k('rpg-audio/bookFlip1.ogg'), k('rpg-audio/bookFlip2.ogg'), k('rpg-audio/bookFlip3.ogg')] },
  'open': { kind: 'sfx', bus: 'ui', preload: true, what: 'a window opens (a book, parchment)', clips: [k('rpg-audio/bookOpen.ogg')] },
  'close': { kind: 'sfx', bus: 'ui', preload: true, what: 'a window closes', clips: [k('rpg-audio/bookClose.ogg')] },
  'coins': { kind: 'sfx', bus: 'ui', preload: true, what: 'coins: buy, sell, silver', clips: [k('rpg-audio/handleCoins.ogg'), k('rpg-audio/handleCoins2.ogg'), fs(17502, { dur: 1.4, fade: 0.5 })] },
  'coins.big': { kind: 'sfx', bus: 'ui', what: 'doubloons, a big sum', clips: [fs(184372, { dur: 2.4, fade: 0.8 }), fs(161315, { dur: 2.4, fade: 0.8 })] },
  'level': { kind: 'sfx', bus: 'ui', what: 'level up fanfare', clips: [fs(456966, { fade: 0.8 })] },
  'quest': { kind: 'sfx', bus: 'ui', what: 'a quest done, a goal reached', clips: [fs(166540, { dur: 3.4, fade: 1 })] },
  'equip': { kind: 'sfx', bus: 'ui', what: 'an item equipped (metal)', clips: [k('rpg-audio/drawKnife1.ogg'), k('rpg-audio/drawKnife2.ogg'), k('rpg-audio/metalLatch.ogg'), k('rpg-audio/beltHandle1.ogg')] },
  'build': { kind: 'sfx', bus: 'ui', what: 'a building placed / finished (hammering)', clips: [fs(207782, { dur: 2.4, fade: 0.6 }), fs(17012, { fade: 0.4 })] },
  'notice': { kind: 'sfx', bus: 'ui', preload: true, what: 'a notice: news, mail, a world call', clips: [k('interface-sounds/confirmation_002.ogg'), k('interface-sounds/confirmation_001.ogg')] },
  'error': { kind: 'sfx', bus: 'ui', preload: true, what: 'an error, a refusal', clips: [k('interface-sounds/error_006.ogg'), k('interface-sounds/error_004.ogg')] },
  'chat': { kind: 'sfx', bus: 'ui', what: 'a chat message', clips: [k('interface-sounds/pluck_001.ogg'), k('interface-sounds/pluck_002.ogg')] },
  'chest': { kind: 'sfx', bus: 'ui', what: 'a reward chest opens', clips: [fs(202092, { dur: 2.6, fade: 0.6 }), fs(771164)] },
  'map': { kind: 'sfx', bus: 'ui', what: 'the map unfolds', clips: [fs(447931), fs(360646, { dur: 1.6, fade: 0.5 })] },
  'dig': { kind: 'sfx', bus: 'combat', what: 'digging for treasure', clips: [fs(353907, { dur: 2.4, fade: 0.5 }), fs(213005)] },
  'found': { kind: 'sfx', bus: 'ui', what: 'treasure found: the chime', clips: [fs(351408, { dur: 2.4, fade: 0.8, rate: 1.12 })] },
  'reel': { kind: 'sfx', bus: 'ui', what: 'the fishing reel', clips: [fs(464701, { fade: 0.4 }), fs(118973, { dur: 2.4, fade: 0.6 })] },
  'cast': { kind: 'sfx', bus: 'ui', what: 'a line cast', clips: [fs(346373), fs(72191)] },
  'anchor.down': { kind: 'sfx', bus: 'sea', what: 'the anchor dropped', clips: [fs(675781, { dur: 4, fade: 1.2 })] },
  'anchor.up': { kind: 'sfx', bus: 'sea', what: 'the anchor weighed', clips: [fs(477129, { at: 2, dur: 4, fade: 1.2 })] },
  'sail': { kind: 'sfx', bus: 'sea', what: 'sails set / struck', clips: [fs(701647, { at: 1, dur: 1.6, fade: 0.6 }), fs(448975, { at: 3, dur: 1.6, fade: 0.6 })] },
  'creak': { kind: 'sfx', bus: 'sea', what: 'timbers on a hard turn, the rudder', clips: [k('rpg-audio/creak1.ogg'), k('rpg-audio/creak2.ogg'), k('rpg-audio/creak3.ogg')] },
};
