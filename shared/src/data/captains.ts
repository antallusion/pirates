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
      { id: 'double_shot', name: 'Double Shot', kind: 'active', key: 'Z', cooldown: 60, duration: 12, targeting: 'self', description: 'Your next broadside within 12 s fires two balls from every gun: +12% damage at rank 1 … +30% at rank 5.' },
      { id: 'hard_over', name: 'Hard Over', kind: 'active', key: 'X', cooldown: 20, duration: 4, targeting: 'self', description: 'Throw the helm over: +80% … +110% turn rate for 4 s at the cost of 10% speed. The broadside fired in it or 3 s after rakes her: +10% … +20% (a rake every 45 s).' },
      { id: 'spotters_eye', name: "Spotter's Eye", kind: 'active', key: 'C', cooldown: 50, duration: 10, targeting: 'self', description: 'A spotter in the tops for 10 s: spread −20% … −35%, damage +3% … +5%, range +15%; each broadside has 15% … 35% to wreck her rudder or a mast.' },
      { id: 'last_volley', name: 'Last Volley', kind: 'ultimate', key: 'V', cooldown: 150, duration: 8, targeting: 'self', description: 'ULTIMATE. For 8 s (12 s at rank 4) the gun crews work like demons: broadsides more by a share of the fight, damage +10%. At rank 4 they ignore the alpha limit.' },
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
      { id: 'smoke_pots', name: 'Smoke Pots', kind: 'active', key: 'Z', cooldown: 35, duration: 8, targeting: 'self', flags: ['hidden'], description: 'Tar pots over the side: a smoke bank for 8 … 10 s. Incoming fire −45% … −50%, NPCs lose their lock; her first broadside out of it is an ambush.' },
      { id: 'dark_running', name: 'Dark Running', kind: 'active', key: 'X', cooldown: 10, duration: 60, targeting: 'self', flags: ['dark_running'], description: 'All lanterns out for 60 s: NPCs notice you at 40% of the usual distance; −10% speed. Ambush: her first broadside out of the dark or the smoke +65% … +66%, often with a critical on her rudder or her powder (again after 50 s).' },
      { id: 'bribe_signal', name: 'Bribe Signal', kind: 'active', key: 'C', cooldown: 90, duration: 60, targeting: 'self', description: 'Hoist the right flag and pay (the price grows with your level): Crown and League patrols ignore you for 60 … 120 s; from rank 3 the pirates of the sea too.' },
      { id: 'vanish_into_fog', name: 'Vanish into Fog', kind: 'ultimate', key: 'V', cooldown: 180, duration: 20, targeting: 'self', flags: ['hidden', 'dark_running'], description: 'ULTIMATE. A fog bank swallows your ship: invisible beyond 250 m, +25% speed for 20 s. Knife in the fog: her next two broadsides go through 30% … 60% of armour, +15% … +30%.' },
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
      { id: 'grapeshot_frenzy', name: 'Grapeshot Frenzy', kind: 'active', key: 'Z', cooldown: 40, duration: 10, targeting: 'self', description: 'For 10 s grapeshot reloads twice as fast and kills 30% … 60% more crew; the first grape broadside that lands takes 5% … 12% of her boarding army besides.' },
      { id: 'ramming_speed', name: 'Ramming Speed', kind: 'active', key: 'X', cooldown: 30, duration: 5, targeting: 'self', description: 'Every hand to the braces: +35% speed and double acceleration for 5 s. A ram strikes ×2.9 … ×4.3: a share of her hull by your way into her (5% at ⚓1 for a plain ram at full way, a broadside\'s share higher).' },
      { id: 'war_cry', name: 'War Cry', kind: 'active', key: 'C', cooldown: 45, duration: 0, targeting: 'self', description: 'Your crew roars: +20 morale. Enemy crews within 300 m lose 15 … 25 morale and, shaken, reload 12% … 25% slower for 8 … 12 s.' },
      { id: 'red_hook_boarding', name: 'Red Hook Boarding', kind: 'ultimate', key: 'V', cooldown: 150, duration: 10, targeting: 'self', flags: ['boarding_anywhere'], description: 'ULTIMATE. For 10 s you may board from double range regardless of speed or damage, with +30% … +45% power; from rank 3 the hooks take 10% … 15% of her army before the fight.' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 28, gold: 1000, cargo: { provisions: 12, planks: 4, sailcloth: 2, weapons: 2 } },
  },
  navigator: {
    id: 'navigator', archetype: 'The Navigator', name: 'Tobias Wren', epithet: 'The Stargazer', premium: false, portrait: 'portrait.navigator',
    bio: 'Charted the Dead Man\'s Expanse alone in a cutter and came back with a map nobody believed. Half of it has since been proven true. He does not talk about the other half.',
    playstyle: 'Speed, weather, currents and exploration. First to every discovery, impossible to catch.',
    favoredTrees: ['navigation', 'exploration', 'trade'],
    passive: { id: 'reading_the_wind', name: 'Reading the Wind', description: 'Sees wind forecasts and currents. No-go zone −8°, currents +25%. The weather gauge: upwind of her mark, damage and range +10% (+25% by rank 5).', mods: { noGoDeg: -8, currentMul: 0.25 } },
    abilities: [
      { id: 'trim_sails', name: 'Trim Sails', kind: 'active', key: 'Z', cooldown: 25, duration: 12, targeting: 'self', description: 'Perfect trim for 12 s: +20% … +30% speed.' },
      { id: 'current_rider', name: 'Current Rider', kind: 'active', key: 'X', cooldown: 40, duration: 20, targeting: 'self', description: 'Ride the stream for 20 s: currents push 150% harder, +20% turn rate; enemies within 300 m fight her current and lose 10% … 20% way and 15% … 25% turn.' },
      { id: 'star_fix', name: 'Star Fix', kind: 'active', key: 'C', cooldown: 50, duration: 0, targeting: 'self', description: 'Take a star fix: reveal every island within 7 km, and for 20 s the weak angles of enemies within 1.5 km — her broadsides on them rake, +12% … +20%.' },
      { id: 'storm_chaser', name: 'Storm Chaser', kind: 'ultimate', key: 'V', cooldown: 180, duration: 20, targeting: 'self', flags: ['personal_wind'], description: 'ULTIMATE. The wind follows you: for 20 s you always sail at the best angle, +30% speed, and the guns load faster on it. At rank 4 allies within 500 m sail her wind.' },
    ],
    start: { ship: 'cutter', gun: 'long_9', crew: 18, gold: 1300, cargo: { provisions: 10, planks: 3, sailcloth: 3 } },
  },
  drowned: {
    id: 'drowned', archetype: 'The Drowned Captain', name: 'Ilse Harrow', epithet: 'The Drowned', premium: true, portrait: 'portrait.drowned',
    bio: 'Went down with the Saint Verity in the Drowned Crown. Walked out of the surf at Wrecktide eleven years later, dripping, calm, and very hungry for something that is not food.',
    playstyle: 'Deep-sea mysticism. Area control, slows and attrition. Every miracle costs the crew\'s nerve.',
    favoredTrees: ['abyssal', 'survival', 'boarding'],
    passive: { id: 'drowned_once', name: 'Drowned Once', description: 'Once per 5 min, lethal damage leaves you between water and light for 12 s: incoming damage −50%, guns still firing. Mend her to 10% hull or she sinks. Crown ports charge 20% more. Dread as a weapon: every 25 Dread costs enemies within 400 m 5 morale each 15 s; below 30 morale they reload 3% … 4% slower. She enters every fight with 30 … 40 Dread.', flags: ['unsinkable'] },
    abilities: [
      { id: 'deep_call', name: 'Deep Call', kind: 'active', key: 'Z', cooldown: 60, duration: 0, targeting: 'point', range: 500, dreadCost: 30, description: '30 Dread. After 1 s drowned hands rise at the target point (60 m) for 6 s: −40% speed and −30% turn inside, and every ship caught is holed and leaks 0.8 of a broadside over those seconds.' },
      { id: 'brine_mend', name: 'Brine Mend', kind: 'active', key: 'X', cooldown: 90, duration: 8, targeting: 'self', dreadCost: 25, moraleCost: 6, description: '25 Dread. The sea knits your planks: 0.8 … 1 broadside of hull back over 8 s, a leak sealed, the rudder mended. Crew morale −6, and 2% of the crew go into the water.' },
      { id: 'undertow', name: 'Undertow', kind: 'active', key: 'C', cooldown: 50, duration: 10, targeting: 'point', range: 500, dreadCost: 35, description: '35 Dread. A 400 × 60 m race of current from you toward the target for 10 s (×1 … ×1.4 by rank): ships sailing with it gain speed, against it lose it, and a ship with no way on is dragged along.' },
      { id: 'maw_of_the_deep', name: 'Maw of the Deep', kind: 'ultimate', key: 'V', cooldown: 300, duration: 0, targeting: 'point', range: 600, dreadCost: 50, moraleCost: 15, description: 'ULTIMATE (100 resolve + 50 Dread). The water boils for 3 s, then a maw 45 m wide opens: 15% of each ship\'s hull (through armour), a mast and two leaks; ships within 90 m are dragged toward it. Again after 300 s (210 s at rank 4).' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 22, gold: 1100, cargo: { provisions: 8, planks: 3, sailcloth: 2, cursed_relics: 1 } },
  },
  admiral: {
    id: 'admiral', archetype: 'The Black Admiral', name: 'Cassius Dray', epithet: 'The Black Admiral', premium: true, portrait: 'portrait.admiral',
    bio: 'Commanded the Crown\'s Black Squadron until he sold its route charts to the Confederacy for a single signature. He still signs his letters "Admiral". Nobody corrects him.',
    playstyle: 'Fleet command. Buffs allies, marks targets, calls escorts and bombardments. Strongest with friends.',
    favoredTrees: ['command', 'gunnery', 'shipwright'],
    passive: { id: 'chain_of_command', name: 'Chain of Command', description: 'Allied and escort ships within 500 m reload 8% faster (15% by rank 5). +5% boarding power.', mods: { boardingPower: 0.05 } },
    abilities: [
      { id: 'form_line', name: 'Form Line', kind: 'active', key: 'Z', cooldown: 45, duration: 15, targeting: 'self', description: 'Signal flags: you and allies within 500 m get −30% … −40% spread and −8% … −10% reload for 15 s.' },
      { id: 'mark_target', name: 'Mark Target', kind: 'active', key: 'X', cooldown: 30, duration: 15, targeting: 'ship', range: 900, description: 'Mark the ship nearest your cursor: she takes +7% … +9% damage from everyone for 15 s; from rank 3 everyone is ranged in on her weak side.' },
      { id: 'call_escort', name: 'Call Escort', kind: 'active', key: 'C', cooldown: 240, duration: 180, targeting: 'self', description: 'Pay the hire (it grows with your level): an escort a level below yours — a brig, a frigate, from the 50th a ship of the line; from the 60th two — joins you for 3 minutes, her broadsides a tenth of yours.' },
      { id: 'admiralty_barrage', name: 'Admiralty Barrage', kind: 'ultimate', key: 'V', cooldown: 180, duration: 0, targeting: 'point', range: 650, description: 'ULTIMATE. After 3 s, 12 … 18 mortar shells fall within 90 m of the target point, each 0.8% of the hull it strikes.' },
    ],
    start: { ship: 'sloop', gun: 'light_6', crew: 24, gold: 1300, cargo: { provisions: 10, planks: 3, sailcloth: 2 } },
  },
};

export const CAPTAIN_IDS = Object.keys(CAPTAINS) as CaptainId[];

export function findAbility(captain: CaptainId, abilityId: string): AbilityDef | undefined {
  return CAPTAINS[captain].abilities.find((a) => a.id === abilityId);
}
