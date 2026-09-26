// The six captains. Premium captains are side-grades: different mechanics and aesthetics,
// same power budget, and all six are unlockable through play (see docs/02_GDD_SHIPS_COMBAT_RPG.md).

import type { Flag, StatMods } from './stats.ts';
import type { ShipClassId, GunId } from './ships.ts';
import type { GoodId } from './goods.ts';
import type { TreeId } from './talents.ts';

export type CaptainId = 'corsair' | 'smuggler' | 'reaver' | 'navigator' | 'drowned' | 'admiral';

export type AbilityTargeting = 'self' | 'point' | 'ship';

export interface AbilityDef {
  id: string;
  name: string;
  kind: 'active' | 'ultimate';
  key: 'Z' | 'X' | 'C' | 'V';
  cooldown: number;
  duration: number; // seconds of the resulting status effect (0 = instant)
  targeting: AbilityTargeting;
  range?: number;
  goldCost?: number;
  moraleCost?: number;
  /** The Drowned Captain's miracles are paid in Dread (docs/02 §7.5). */
  dreadCost?: number;
  mods?: StatMods; // applied to the caster while the effect lasts
  flags?: Flag[];
  description: string;
}

export interface CaptainDef {
  id: CaptainId;
  archetype: string;
  name: string;
  epithet: string;
  premium: boolean;
  portrait: string;
  bio: string;
  playstyle: string;
  favoredTrees: TreeId[];
  passive: { id: string; name: string; description: string; mods?: StatMods; flags?: Flag[] };
  abilities: AbilityDef[];
  start: { ship: ShipClassId; gun: GunId; crew: number; gold: number; cargo: Partial<Record<GoodId, number>> };
}

export const CAPTAINS: Record<CaptainId, CaptainDef> = {
  corsair: {
    id: 'corsair', archetype: 'The Corsair', name: 'Edric Vane', epithet: 'Last Volley', premium: false, portrait: 'portrait.corsair',
    bio: 'Former Crown gunnery lieutenant, cashiered after he refused to fire on a surrendered merchant. He kept his discipline and lost his flag.',
    playstyle: 'Universal naval fighter. Rewards clean broadsides, positioning and ammo choice.',
    favoredTrees: ['gunnery', 'navigation', 'command'],
    passive: { id: 'broadside_discipline', name: 'Broadside Discipline', description: 'A full broadside (every gun on that side loaded) reloads 15% faster and flies 10% tighter.', mods: { spreadMul: -0.1 } },
    abilities: [
      { id: 'double_shot', name: 'Double Shot', kind: 'active', key: 'Z', cooldown: 30, duration: 12, targeting: 'self', description: 'Your next broadside within 12 s fires two balls from every gun, with 40% wider spread.' },
      { id: 'hard_over', name: 'Hard Over', kind: 'active', key: 'X', cooldown: 20, duration: 4, targeting: 'self', mods: { turnRate: 0.8, maxSpeed: -0.1 }, description: 'Throw the helm over: +80% turn rate for 4 s at the cost of 10% speed.' },
      { id: 'spotters_eye', name: "Spotter's Eye", kind: 'active', key: 'C', cooldown: 40, duration: 10, targeting: 'self', mods: { gunDamageMul: 0.15, rangeMul: 0.15 }, description: 'A spotter in the tops calls the fall of shot: +15% damage and range for 10 s.' },
      { id: 'last_volley', name: 'Last Volley', kind: 'ultimate', key: 'V', cooldown: 150, duration: 8, targeting: 'self', mods: { reloadMul: -0.7, gunDamageMul: 0.2 }, description: 'ULTIMATE. For 8 s the gun crews work like demons: reload −70%, damage +20%.' },
    ],
    start: { ship: 'sloop', gun: 'long_9', crew: 24, gold: 1200, cargo: { provisions: 10, planks: 4, sailcloth: 3 } },
  },
  smuggler: {
    id: 'smuggler', archetype: 'The Smuggler', name: 'Mara Quill', epithet: 'The Fog Ledger', premium: false, portrait: 'portrait.smuggler',
    bio: 'Keeps two ledgers: one for the Crown, one for the truth. Every Fog Broker in the Whispering Archipelago owes her a favour — or fears the page with their name.',
    playstyle: 'Trade, stealth and contraband. Avoids fights, wins by never being where the enemy looks.',
    favoredTrees: ['trade', 'smuggling', 'navigation'],
    passive: { id: 'false_bottom', name: 'False Bottom', description: 'Contraband uses 30% less hold volume and is never found by patrol inspections. −10% detection signature.', mods: { contrabandVolumeMul: -0.3 }, flags: ['false_bottom'] },
    abilities: [
      { id: 'smoke_pots', name: 'Smoke Pots', kind: 'active', key: 'Z', cooldown: 35, duration: 8, targeting: 'self', mods: { incomingDamageMul: -0.4 }, flags: ['hidden'], description: 'Tar pots over the side: a smoke bank. Incoming fire −40%, NPCs lose their lock for 8 s.' },
      { id: 'dark_running', name: 'Dark Running', kind: 'active', key: 'X', cooldown: 10, duration: 60, targeting: 'self', mods: { maxSpeed: -0.1 }, flags: ['dark_running'], description: 'All lanterns out. NPCs notice you at 40% of the usual distance; −10% speed. 60 s.' },
      { id: 'bribe_signal', name: 'Bribe Signal', kind: 'active', key: 'C', cooldown: 90, duration: 60, targeting: 'self', goldCost: 200, description: 'Hoist the right flag and pay 200 silver: Crown and League patrols ignore you for 60 s.' },
      { id: 'vanish_into_fog', name: 'Vanish into Fog', kind: 'ultimate', key: 'V', cooldown: 180, duration: 20, targeting: 'self', mods: { maxSpeed: 0.25 }, flags: ['hidden', 'dark_running'], description: 'ULTIMATE. A fog bank swallows your ship: invisible beyond 250 m, +25% speed for 20 s.' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 20, gold: 1400, cargo: { provisions: 10, planks: 3, sailcloth: 2, dreamleaf: 4 } },
  },
  reaver: {
    id: 'reaver', archetype: 'The Reaver', name: 'Hask Morrow', epithet: 'Red Hook', premium: false, portrait: 'portrait.reaver',
    bio: 'Lost his hand to a Crown boarding axe at fourteen and replaced it with the axe-head. Forty ships later, merchants strike their colours when they see his hook painted on the sail.',
    playstyle: 'Aggressive close combat. Grapeshot, ramming, boarding. Wins with crew and nerve, not range.',
    favoredTrees: ['boarding', 'command', 'survival'],
    passive: { id: 'blood_in_the_water', name: 'Blood in the Water', description: 'Against crews below 50%: +20% boarding power. Kills during boarding raise your morale.', mods: { boardingPower: 0.05 } },
    abilities: [
      { id: 'grapeshot_frenzy', name: 'Grapeshot Frenzy', kind: 'active', key: 'Z', cooldown: 40, duration: 10, targeting: 'self', mods: { crewKillMul: 0.3 }, description: 'For 10 s grapeshot reloads twice as fast and kills 30% more crew.' },
      { id: 'ramming_speed', name: 'Ramming Speed', kind: 'active', key: 'X', cooldown: 30, duration: 5, targeting: 'self', mods: { maxSpeed: 0.35, accel: 1.0 }, description: 'Every hand to the braces: +35% speed and double acceleration for 5 s. Rams deal triple damage.' },
      { id: 'war_cry', name: 'War Cry', kind: 'active', key: 'C', cooldown: 45, duration: 0, targeting: 'self', description: 'Your crew roars: +20 morale. Enemy crews within 300 m lose 15 morale.' },
      { id: 'red_hook_boarding', name: 'Red Hook Boarding', kind: 'ultimate', key: 'V', cooldown: 150, duration: 10, targeting: 'self', mods: { boardingRange: 1.0, boardingPower: 0.3 }, flags: ['boarding_anywhere'], description: 'ULTIMATE. For 10 s you may board from double range regardless of speed or damage, with +30% power.' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 28, gold: 1000, cargo: { provisions: 12, planks: 4, sailcloth: 2, weapons: 2 } },
  },
  navigator: {
    id: 'navigator', archetype: 'The Navigator', name: 'Tobias Wren', epithet: 'The Stargazer', premium: false, portrait: 'portrait.navigator',
    bio: 'Charted the Dead Man\'s Expanse alone in a cutter and came back with a map nobody believed. Half of it has since been proven true. He does not talk about the other half.',
    playstyle: 'Speed, weather, currents and exploration. First to every discovery, impossible to catch.',
    favoredTrees: ['navigation', 'exploration', 'trade'],
    passive: { id: 'reading_the_wind', name: 'Reading the Wind', description: 'Sees wind forecasts and currents. No-go zone −8°, currents +25%.', mods: { noGoDeg: -8, currentMul: 0.25 } },
    abilities: [
      { id: 'trim_sails', name: 'Trim Sails', kind: 'active', key: 'Z', cooldown: 25, duration: 12, targeting: 'self', mods: { maxSpeed: 0.2 }, description: 'Perfect trim for 12 s: +20% speed.' },
      { id: 'current_rider', name: 'Current Rider', kind: 'active', key: 'X', cooldown: 40, duration: 20, targeting: 'self', mods: { currentMul: 1.5, turnRate: 0.2 }, description: 'Ride the stream: currents push 150% harder and +20% turn rate for 20 s.' },
      { id: 'star_fix', name: 'Star Fix', kind: 'active', key: 'C', cooldown: 60, duration: 0, targeting: 'self', description: 'Take a star fix: reveal every island within 7 km on your chart.' },
      { id: 'storm_chaser', name: 'Storm Chaser', kind: 'ultimate', key: 'V', cooldown: 180, duration: 20, targeting: 'self', mods: { maxSpeed: 0.3 }, flags: ['personal_wind'], description: 'ULTIMATE. The wind follows you: for 20 s you always sail at the best angle, +30% speed.' },
    ],
    start: { ship: 'cutter', gun: 'long_9', crew: 18, gold: 1300, cargo: { provisions: 10, planks: 3, sailcloth: 3 } },
  },
  drowned: {
    id: 'drowned', archetype: 'The Drowned Captain', name: 'Ilse Harrow', epithet: 'The Drowned', premium: true, portrait: 'portrait.drowned',
    bio: 'Went down with the Saint Verity in the Drowned Crown. Walked out of the surf at Wrecktide eleven years later, dripping, calm, and very hungry for something that is not food.',
    playstyle: 'Deep-sea mysticism. Area control, slows and attrition. Every miracle costs the crew\'s nerve.',
    favoredTrees: ['abyssal', 'survival', 'boarding'],
    passive: { id: 'drowned_once', name: 'Drowned Once', description: 'Once per 5 min, lethal damage leaves you between water and light for 12 s: incoming damage −50%, guns still firing. Mend her to 10% hull or she sinks. Crown ports charge 20% more.', flags: ['unsinkable'] },
    abilities: [
      { id: 'deep_call', name: 'Deep Call', kind: 'active', key: 'Z', cooldown: 40, duration: 0, targeting: 'point', range: 500, dreadCost: 30, description: '30 Dread. After 1 s drowned hands rise at the target point (60 m) for 6 s: −40% speed and −30% turn inside, and every ship caught is holed once.' },
      { id: 'brine_mend', name: 'Brine Mend', kind: 'active', key: 'X', cooldown: 45, duration: 8, targeting: 'self', dreadCost: 25, moraleCost: 6, description: '25 Dread. The sea knits your planks: +12% hull over 8 s, and a share of it goes where only yards reach — a leak sealed, the rudder mended. Crew morale −6, and 2% of the crew go into the water.' },
      { id: 'undertow', name: 'Undertow', kind: 'active', key: 'C', cooldown: 50, duration: 10, targeting: 'point', range: 500, dreadCost: 35, description: '35 Dread. A 400 × 60 m race of current from you toward the target for 10 s: ships sailing with it gain speed, against it lose it, and a ship with no way on is dragged along.' },
      { id: 'maw_of_the_deep', name: 'Maw of the Deep', kind: 'ultimate', key: 'V', cooldown: 300, duration: 0, targeting: 'point', range: 600, dreadCost: 50, moraleCost: 15, description: 'ULTIMATE (100 resolve + 50 Dread). The water boils for 3 s, then a maw 45 m wide opens: 20% of each ship\'s hull (to 4 000, through armour), a mast and two leaks; ships within 90 m are dragged toward it.' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 22, gold: 1100, cargo: { provisions: 8, planks: 3, sailcloth: 2, cursed_relics: 1 } },
  },
  admiral: {
    id: 'admiral', archetype: 'The Black Admiral', name: 'Cassius Dray', epithet: 'The Black Admiral', premium: true, portrait: 'portrait.admiral',
    bio: 'Commanded the Crown\'s Black Squadron until he sold its route charts to the Confederacy for a single signature. He still signs his letters "Admiral". Nobody corrects him.',
    playstyle: 'Fleet command. Buffs allies, marks targets, calls escorts and bombardments. Strongest with friends.',
    favoredTrees: ['command', 'gunnery', 'shipwright'],
    passive: { id: 'chain_of_command', name: 'Chain of Command', description: 'Allied and escort ships within 500 m reload 8% faster.', mods: { boardingPower: 0.05 } },
    abilities: [
      { id: 'form_line', name: 'Form Line', kind: 'active', key: 'Z', cooldown: 45, duration: 15, targeting: 'self', mods: { spreadMul: -0.3, reloadMul: -0.1 }, description: 'Signal flags: you and allies within 500 m get −30% spread and −10% reload for 15 s.' },
      { id: 'mark_target', name: 'Mark Target', kind: 'active', key: 'X', cooldown: 30, duration: 15, targeting: 'ship', range: 900, description: 'Mark the ship nearest your cursor: it takes +15% damage from everyone for 15 s.' },
      { id: 'call_escort', name: 'Call Escort', kind: 'active', key: 'C', cooldown: 240, duration: 180, targeting: 'self', goldCost: 300, description: 'Pay 300 silver: a hired escort brig joins you for 3 minutes.' },
      { id: 'admiralty_barrage', name: 'Admiralty Barrage', kind: 'ultimate', key: 'V', cooldown: 180, duration: 0, targeting: 'point', range: 650, description: 'ULTIMATE. After 3 s, 12 mortar shells fall within 90 m of the target point, 120 damage each.' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 24, gold: 1300, cargo: { provisions: 10, planks: 3, sailcloth: 2 } },
  },
};

export const CAPTAIN_IDS = Object.keys(CAPTAINS) as CaptainId[];

export function findAbility(captain: CaptainId, abilityId: string): AbilityDef | undefined {
  return CAPTAINS[captain].abilities.find((a) => a.id === abilityId);
}
