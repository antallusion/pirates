// Crew as people (docs/02 §8): professions in pools with a shared veterancy, named officers with traits,
// loyalty, orders and wounds, the character a crew earns from its history, and the Codex share.

import type { CaptainId } from './captains.ts';
import type { Flag, StatMods } from './stats.ts';

export type Profession = 'sailor' | 'gunner' | 'helmsman' | 'carpenter' | 'surgeon' | 'marine' | 'cook';
export const PROFESSIONS: Profession[] = ['sailor', 'gunner', 'helmsman', 'carpenter', 'surgeon', 'marine', 'cook'];

export interface ProfessionDef {
  id: Profession;
  name: string;
  /** Silver per hour at sea. */
  wage: number;
  /** Weight in a boarding fight (docs/02 §6 w_role). */
  boardW: number;
  /** Signing bounty relative to a sailor's. */
  hireMul: number;
  description: string;
}

export const PROFESSION_DEFS: Record<Profession, ProfessionDef> = {
  sailor: { id: 'sailor', name: 'Sailors', wage: 1, boardW: 1, hireMul: 1, description: 'Sails, pumps and fire parties; the backbone of any boarding.' },
  gunner: { id: 'gunner', name: 'Gunners', wage: 1.5, boardW: 0.9, hireMul: 1.4, description: 'Gun crews: reload and accuracy grow with their veterancy. One per gun on a side is a full battery.' },
  helmsman: { id: 'helmsman', name: 'Helmsmen', wage: 2.5, boardW: 1, hireMul: 2, description: 'The wheel: +2% turn for every star of veterancy above three.' },
  carpenter: { id: 'carpenter', name: 'Carpenters', wage: 2, boardW: 0.8, hireMul: 1.6, description: 'Repairs and leaks. About one in twenty of the crew.' },
  surgeon: { id: 'surgeon', name: 'Surgeons', wage: 3, boardW: 0.5, hireMul: 2.5, description: 'Each one per fifty men turns deaths into wounds; the wounded come back sooner.' },
  marine: { id: 'marine', name: 'Marines', wage: 2.5, boardW: 2, hireMul: 2, description: 'Muskets and cutlasses: double weight in a boarding, and they put down mutinies.' },
  cook: { id: 'cook', name: 'Cooks', wage: 1.5, boardW: 0.6, hireMul: 1.2, description: 'One per forty men: +5 morale, 10% less provisions, no scurvy.' },
};

/** Veterancy multiplier: ★1 0.8 · ★2 0.9 · ★3 1.0 · ★4 1.2 · ★5 1.4 (interpolated). */
export function skillMul(stars: number): number {
  const s = Math.max(1, Math.min(5, stars));
  return s <= 3 ? 0.7 + s * 0.1 : 1 + (s - 3) * 0.2;
}

// ------------------------------------------------------------------ officers

export type OfficerRole = 'lieutenant' | 'boatswain' | 'quartermaster' | 'master_gunner' | 'pilot' | 'alchemist' | 'deep_pastor' | 'sailmaker' | 'harpooner';
export const OFFICER_ROLES: OfficerRole[] = ['lieutenant', 'boatswain', 'quartermaster', 'master_gunner', 'pilot', 'alchemist', 'deep_pastor', 'sailmaker', 'harpooner'];

export interface OrderDef {
  id: string;
  name: string;
  cooldown: number;
  description: string;
}

export interface OfficerRoleDef {
  id: OfficerRole;
  name: string;
  wage: number; // silver per hour at sea at level 1
  rare: boolean;
  description: string;
  mods?: StatMods;
  flags?: Flag[];
  order: OrderDef;
}

export const OFFICER_DEFS: Record<OfficerRole, OfficerRoleDef> = {
  lieutenant: { id: 'lieutenant', name: 'Lieutenant', wage: 10, rare: false, description: 'Heads the watch: morale recovers 20% faster.', mods: { moraleRegen: 0.08 },
    order: { id: 'rally', name: 'Steady, lads!', cooldown: 120, description: '+15 morale.' } },
  boatswain: { id: 'boatswain', name: 'Boatswain', wage: 15, rare: true, description: 'Moves men between stations 40% faster; the pumps and fire parties work harder.', mods: { leakInflow: -0.1 }, flags: ['boatswain'],
    order: { id: 'all_hands', name: 'All hands!', cooldown: 90, description: 'For 15 s repairs and pumps +25%.' } },
  quartermaster: { id: 'quartermaster', name: 'Quartermaster', wage: 20, rare: true, description: 'Keeps the shares: loyalty grows 20% faster, mutiny is half as likely, the crew expects 5 points less.', flags: ['quartermaster'],
    order: { id: 'fair_shares', name: 'Fair shares', cooldown: 1800, description: 'Pay out 2% of your purse: +8 loyalty.' } },
  master_gunner: { id: 'master_gunner', name: 'Master Gunner', wage: 25, rare: true, description: 'Batteries reload 10% faster.', mods: { reloadMul: -0.1 },
    order: { id: 'lay_true', name: 'Lay her true', cooldown: 60, description: 'For 20 s: −30% spread.' } },
  pilot: { id: 'pilot', name: 'Pilot', wage: 20, rare: true, description: 'Hears the shallows (Sounding Line) and reads the weather three minutes ahead.', mods: { forecast: 180 }, flags: ['sounding_line'],
    order: { id: 'sound_ahead', name: 'Sound ahead', cooldown: 90, description: 'For 12 s: +20% turn rate.' } },
  alchemist: { id: 'alchemist', name: 'Alchemist', wage: 25, rare: true, description: 'Fire shot catches 20% more often.', flags: ['alchemist'],
    order: { id: 'brew_fire', name: 'Brew fire', cooldown: 120, description: 'One whale oil and one powder make 10 fire shot.' } },
  deep_pastor: { id: 'deep_pastor', name: 'Deep Pastor', wage: 30, rare: true, description: 'Mysticism costs the crew 40% less morale and sanity; Dread +10%. Crown customs dislike him (−10 standing per search).', mods: { mysticMorale: -0.4, sanityLoss: -0.4, dreadGain: 0.1 }, flags: ['deep_pastor'],
    order: { id: 'last_rites', name: 'Last rites', cooldown: 600, description: '+12 sanity and +5 morale.' } },
  sailmaker: { id: 'sailmaker', name: 'Sailmaker', wage: 15, rare: true, description: 'Mends canvas under fire twice as fast.', flags: ['sailmaker'],
    order: { id: 'bend_canvas', name: 'Bend new canvas', cooldown: 90, description: '+15% sails.' } },
  harpooner: { id: 'harpooner', name: 'Harpooner', wage: 15, rare: true, description: 'Harpoon guns reach 25% further.', flags: ['harpooner'],
    order: { id: 'steady_iron', name: 'Steady iron', cooldown: 60, description: 'The deck mount is loaded at once.' } },
};

// ------------------------------------------------------------------ traits

export type TraitId =
  | 'sharp_eyed' | 'storm_veteran' | 'quick_hands' | 'lucky' | 'devout' | 'crown_sailor' | 'bloodthirsty'
  | 'drunkard' | 'coward' | 'greedy' | 'superstitious' | 'ex_convict' | 'deep_touched' | 'cruel'
  | 'pressed' | 'former_enemy' | 'one_legged' | 'seasoned' | 'fog_born';

export interface TraitDef {
  id: TraitId;
  name: string;
  good: boolean;
  description: string;
  mods?: StatMods;
  /** Can be rolled on a new officer. */
  rollable: boolean;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  sharp_eyed: { id: 'sharp_eyed', name: 'Sharp-eyed', good: true, rollable: true, description: '−8% spread.', mods: { spreadMul: -0.08 } },
  storm_veteran: { id: 'storm_veteran', name: 'Storm veteran', good: true, rollable: true, description: '−20% weather damage.', mods: { stormHull: -0.2 } },
  quick_hands: { id: 'quick_hands', name: 'Quick hands', good: true, rollable: true, description: '−5% reload, +8% repairs.', mods: { reloadMul: -0.05, repairRate: 0.08 } },
  lucky: { id: 'lucky', name: 'Lucky', good: true, rollable: true, description: 'Half as likely to die; wounds are lighter.' },
  devout: { id: 'devout', name: 'Devout', good: true, rollable: true, description: 'Mysticism costs the crew a quarter less.', mods: { mysticMorale: -0.25, sanityLoss: -0.1 } },
  crown_sailor: { id: 'crown_sailor', name: 'Crown sailor', good: true, rollable: true, description: 'Discipline: morale +10% faster. Loses loyalty while you are wanted.', mods: { moraleRegen: 0.04 } },
  bloodthirsty: { id: 'bloodthirsty', name: 'Bloodthirsty', good: true, rollable: true, description: '+10% boarding power.', mods: { boardingPower: 0.1 } },
  drunkard: { id: 'drunkard', name: 'Drunkard', good: false, rollable: true, description: '+3% reload time, but +10 morale when the rum comes round.', mods: { reloadMul: 0.03 } },
  coward: { id: 'coward', name: 'Coward', good: false, rollable: true, description: '−10% boarding power; panics in fog.', mods: { boardingPower: -0.1 } },
  greedy: { id: 'greedy', name: 'Greedy', good: false, rollable: true, description: 'Wants half again the share, and may betray you when loyalty runs low.' },
  superstitious: { id: 'superstitious', name: 'Superstitious', good: false, rollable: true, description: '−5 morale near cursed cargo and black storms.' },
  ex_convict: { id: 'ex_convict', name: 'Ex-convict', good: false, rollable: true, description: '+5% boarding power; resents a Crown licence.', mods: { boardingPower: 0.05 } },
  deep_touched: { id: 'deep_touched', name: 'Touched by the deep', good: false, rollable: true, description: '+10% Dread, but he hears voices: +10% sanity loss.', mods: { dreadGain: 0.1, sanityLoss: 0.1 } },
  cruel: { id: 'cruel', name: 'Cruel', good: false, rollable: true, description: 'Letting prisoners go costs 10 loyalty; prisoners will not sign on.' },
  pressed: { id: 'pressed', name: 'Pressed', good: false, rollable: false, description: 'Taken by force: loyalty grows at half speed.' },
  former_enemy: { id: 'former_enemy', name: 'Former enemy', good: false, rollable: false, description: 'Signed on after a boarding.' },
  one_legged: { id: 'one_legged', name: 'One-legged', good: false, rollable: false, description: 'Maimed: +2% reload time, but the crew loves his stories (+5 morale).', mods: { reloadMul: 0.02, moraleBase: 5 } },
  seasoned: { id: 'seasoned', name: 'Seasoned', good: true, rollable: false, description: 'Fifty fights together: −5% reload and spread, morale +10% faster.', mods: { reloadMul: -0.05, spreadMul: -0.05, moraleRegen: 0.04 } },
  fog_born: { id: 'fog_born', name: 'Fog is home', good: true, rollable: false, description: '+10% sighting in fog.' },
};

export interface Officer {
  id: string;
  name: string;
  role: OfficerRole;
  level: number; // 1..20
  xp: number;
  traits: TraitId[];
  loyalty: number; // 0..100
  wound: { until: number; heavy: boolean } | null;
  unique?: string;
  hiredAt: number;
  warnedAt?: number; // betrayal warned (a game day ahead)
  awayUntil?: number; // taken captive when the ship went down
  orderReady: number;
}

export interface UniqueOfficer {
  id: string;
  name: string;
  role: OfficerRole;
  port: string;
  traits: TraitId[];
  level: number;
  rep: number; // standing needed with the port's faction
  minShare?: number;
  loyaltyFor?: CaptainId;
  story: string;
}

export const UNIQUE_OFFICERS: UniqueOfficer[] = [
  { id: 'old_bones', name: 'Jory "Old Bones" Pike', role: 'boatswain', port: 'saltmarrow', traits: ['lucky', 'drunkard'], level: 6, rep: 0, story: 'Survived three sinkings. Swears his luck lies in the wreck of his first ship.' },
  { id: 'anwen_coil', name: 'Sister Anwen Coil', role: 'deep_pastor', port: 'wrecktide', traits: ['devout', 'deep_touched'], level: 7, rep: 0, story: 'A renegade of the Choir who fled Saint Maw. The Choir sends hunters after her.' },
  { id: 'ruy_ketch', name: 'Ruy Salazar-Ketch', role: 'master_gunner', port: 'gravesend', traits: ['sharp_eyed', 'crown_sailor'], level: 8, rep: 10, loyaltyFor: 'corsair', story: 'Vane\'s gunner on the Resolute. Drinks at the Powder Keg.' },
  { id: 'tallow_marsh', name: 'Nell "Tallow" Marsh', role: 'alchemist', port: 'harpoon_rest', traits: ['quick_hands', 'storm_veteran'], level: 6, rep: 10, story: 'Boils blubber and powder; lost her eyebrows in three explosions.' },
  { id: 'ezekiel_thorne', name: 'Ezekiel Thorne', role: 'pilot', port: 'fogmouth', traits: ['fog_born', 'superstitious'], level: 7, rep: 10, story: 'A blind pilot who hears the shallows.' },
  { id: 'iron_jaw', name: 'Magda "Iron-Jaw" Rusk', role: 'quartermaster', port: 'cinderhold', traits: ['greedy', 'bloodthirsty'], level: 8, rep: 20, minShare: 30, story: 'Once paymistress of a tribunal. Wants her share, halves your mutinies.' },
];

/** Officer berths by ship tier (+1 with a full wardroom). */
export function officerSlots(tier: number, crewQuarters: number): number {
  return [1, 1, 2, 2, 3, 3, 4][Math.max(0, Math.min(6, tier))] + (crewQuarters >= 2 ? 1 : 0);
}

export const FIRST_NAMES = ['Ansel', 'Bram', 'Cobb', 'Dorran', 'Edda', 'Fenn', 'Gideon', 'Hale', 'Isolde', 'Jonas', 'Kestrel', 'Lark', 'Morrow', 'Nell', 'Oswin', 'Pell', 'Quint', 'Rook', 'Silas', 'Tamsin', 'Ulric', 'Vesper', 'Wren', 'Yarrow'];
export const LAST_NAMES = ['Blackwater', 'Coldharbour', 'Drummond', 'Farrow', 'Gault', 'Holloway', 'Ickes', 'Jessop', 'Kell', 'Lowe', 'Marrow', 'Nettle', 'Orme', 'Pike', 'Quill', 'Reeve', 'Salt', 'Thorne', 'Umber', 'Vane', 'Wick', 'Yeats'];
