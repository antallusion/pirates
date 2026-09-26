// Legend Deeds (docs/03_TALENT_TREES.md §2.2): milestones of a captain's fate. Each grants one talent point,
// at most 16 count. At least 18 are reachable without PvP and 16 without entering the Abyss.
// `awaits` names the system a deed is checked by when that system is not part of the current build.

export type DeedPath = 'combat' | 'trade' | 'smuggling' | 'factions' | 'exploration' | 'monsters' | 'abyss' | 'survival' | 'crew' | 'command' | 'shipwright' | 'law' | 'story';

export interface DeedDef {
  id: string;
  name: string;
  condition: string;
  path: DeedPath;
  awaits?: string;
}

export const MAX_COUNTED_DEEDS = 16;

export const DEEDS: DeedDef[] = [
  { id: 'deed_first_prize', name: 'First Prize', condition: 'Take a ship by boarding.', path: 'combat' },
  { id: 'deed_hundred_wrecks', name: 'Hundred Wrecks', condition: 'Sink 100 ships.', path: 'combat' },
  { id: 'deed_ship_of_the_line', name: 'Ship of the Line', condition: 'Sink a man-o\'-war.', path: 'combat' },
  { id: 'deed_convoy_breaker', name: 'Convoy Breaker', condition: 'Break a League convoy: every ship of it sunk or taken.', path: 'combat', awaits: 'League convoys (Phase 7 world events)' },
  { id: 'deed_captain_killer', name: 'Captain Killer', condition: 'Defeat one of the eight named Legends of the Sea.', path: 'combat', awaits: 'named NPC captains (Phase 7)' },
  { id: 'deed_hundred_thousand', name: 'Hundred Thousand', condition: 'Sell 100,000 silver worth of goods.', path: 'trade' },
  { id: 'deed_grand_circuit', name: 'Grand Circuit', condition: 'Trade in 6 different ports in one voyage (between sinkings).', path: 'trade' },
  { id: 'deed_fog_courier', name: 'Fog Courier', condition: 'Sell 1,000 units of contraband in Fogmouth.', path: 'smuggling' },
  { id: 'deed_ledger_partner', name: 'Ledger Partner', condition: 'Reach Respect (50) with the Gilded Ledger.', path: 'trade' },
  { id: 'deed_black_flag_oath', name: 'Black Flag Oath', condition: 'Swear to the Code in Cinderhold, or take a Crown letter of marque in Gravesend.', path: 'factions' },
  { id: 'deed_whispering_chart', name: 'Whispering Chart', condition: 'Chart 90% of the Whispering Archipelago.', path: 'exploration' },
  { id: 'deed_expanse_crossing', name: 'Expanse Crossing', condition: "Cross Dead Man's Expanse from south to north without making port.", path: 'exploration' },
  { id: 'deed_ice_edge', name: 'Ice Edge', condition: 'Reach the ice edge of Leviathan Reach.', path: 'exploration' },
  { id: 'deed_legendary_hoard', name: 'Legendary Hoard', condition: 'Find a legendary hoard.', path: 'exploration' },
  { id: 'deed_leviathan_slain', name: 'Leviathan Slain', condition: 'Take part in killing a leviathan (10% of its damage).', path: 'monsters', awaits: 'sea monsters (Phase 7)' },
  { id: 'deed_harpoon_contracts', name: 'Harpoon Contracts', condition: "Complete 10 contracts from Harpoon's Rest.", path: 'monsters' },
  { id: 'deed_first_descent', name: 'The First Descent', condition: 'Complete "The First Descent" at Saint Maw.', path: 'abyss' },
  { id: 'deed_black_storm', name: 'Black Storm', condition: 'Ride out two minutes of a black storm in the Abyss.', path: 'abyss' },
  { id: 'deed_last_plank', name: 'Last Plank', condition: 'Make port with less than 5% hull.', path: 'survival' },
  { id: 'deed_mutiny', name: 'Mutiny', condition: 'Put down a mutiny, or live through one.', path: 'crew' },
  { id: 'deed_fleet_victory', name: 'Fleet Victory', condition: 'Sink a ship while commanding three: yourself and two escorts.', path: 'command' },
  { id: 'deed_masterwork_ship', name: 'Masterwork Ship', condition: 'Build an Excellent ship at a yard.', path: 'shipwright' },
  { id: 'deed_wanted_legend', name: 'Wanted Legend', condition: 'Stay at Wanted 4+ for two hours, or claim the bounty on a Wanted 3+ criminal.', path: 'law' },
  { id: 'deed_legend_quest', name: 'Legend Quest', condition: "Finish any captain's Legend quest.", path: 'story' },
];

export const DEEDS_BY_ID: Record<string, DeedDef> = Object.fromEntries(DEEDS.map((d) => [d.id, d]));
