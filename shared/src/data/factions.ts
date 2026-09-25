// Factions, their relations and their port policies. See docs/00_CANON.md.

export type FactionId = 'crown' | 'league' | 'confederacy' | 'harpoon' | 'brokers' | 'choir' | 'free';

export interface FactionDef {
  id: FactionId;
  name: string;
  short: string;
  lantern: string; // lantern/light color used by the renderer for faction readability from top-down
  flag: string; // primary flag color
  lawful: boolean;
  /** Max Wanted level at which this faction's ports still allow docking. */
  dockMaxWanted: number;
  description: string;
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  crown: { id: 'crown', name: 'The Crown Admiralty', short: 'Crown', lantern: '#dfe8f0', flag: '#c9ced6', lawful: true, dockMaxWanted: 1, description: 'Law, patrols, licences and bounties.' },
  league: { id: 'league', name: 'The Gilded Ledger', short: 'League', lantern: '#f2b35a', flag: '#8a6a2a', lawful: true, dockMaxWanted: 2, description: 'Merchant league: convoys, banks, insurance.' },
  confederacy: { id: 'confederacy', name: 'The Red Tide Confederacy', short: 'Confederacy', lantern: '#d2473a', flag: '#5a1418', lawful: false, dockMaxWanted: 5, description: 'Pirate havens bound by the Code.' },
  harpoon: { id: 'harpoon', name: 'Order of the Harpoon', short: 'Harpoon', lantern: '#e8d27a', flag: '#6d6440', lawful: true, dockMaxWanted: 3, description: 'Monster hunters and whalers of the north.' },
  brokers: { id: 'brokers', name: 'The Fog Brokers', short: 'Brokers', lantern: '#7fa38a', flag: '#2c3a33', lawful: false, dockMaxWanted: 5, description: 'Smugglers, forgers and information merchants.' },
  choir: { id: 'choir', name: 'The Choir of the Deep', short: 'Choir', lantern: '#2ee6c8', flag: '#0f3a37', lawful: false, dockMaxWanted: 5, description: 'A cult that prays downward.' },
  free: { id: 'free', name: 'Free Harbors', short: 'Free', lantern: '#e0a060', flag: '#4a4a4a', lawful: false, dockMaxWanted: 4, description: 'Neutral ports that ask few questions.' },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

/** Base relation between factions, -100..100. Used for NPC aggression and reputation spillover. */
const REL: Partial<Record<FactionId, Partial<Record<FactionId, number>>>> = {
  crown: { league: 50, confederacy: -100, harpoon: 30, brokers: -60, choir: -80, free: 0 },
  league: { confederacy: -70, harpoon: 20, brokers: -30, choir: -50, free: 20 },
  confederacy: { harpoon: -10, brokers: 40, choir: -20, free: 30 },
  harpoon: { brokers: -10, choir: -90, free: 10 },
  brokers: { choir: 0, free: 40 },
  choir: { free: -10 },
};

export function factionRelation(a: FactionId, b: FactionId): number {
  if (a === b) return 100;
  return REL[a]?.[b] ?? REL[b]?.[a] ?? 0;
}

export const WANTED_TITLES = ['Unknown', 'Suspect', 'Known Pirate', 'Dangerous Criminal', 'Legendary Pirate', 'Enemy of the Crown'] as const;

/** Infamy points thresholds for wanted levels 1..5. */
export const WANTED_THRESHOLDS = [0, 20, 60, 140, 280, 500];

export function wantedLevel(infamy: number): number {
  let lvl = 0;
  for (let i = 1; i < WANTED_THRESHOLDS.length; i++) if (infamy >= WANTED_THRESHOLDS[i]) lvl = i;
  return lvl;
}
