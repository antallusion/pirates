// Bridge talents — docs/03_TALENT_TREES.md §5. Twelve talents that reward a combination of roles:
// each needs points in two trees, costs one point, is not counted in tree gates; at most three per build.
// Rules live in server/src/game/bridgefx.ts and the systems they touch.

import type { TalentDef } from '../talents.ts';

const b = (d: Omit<TalentDef, 'tree' | 'tier' | 'maxRank' | 'keystone'>): TalentDef => ({ ...d, tree: 'bridge', tier: 1, maxRank: 1, keystone: false });

export const BRIDGES: TalentDef[] = [
  b({ id: 'brg_chain_and_grapple', name: 'Chain and Grapple', bridge: { trees: ['gunnery', 'boarding'], min: 10 }, flags: ['chain_and_grapple'], description: 'Against a ship with tangled rigging: boarding range +50%, grapples at any speed, and for the first 5 s she cannot cut the lines.' }),
  b({ id: 'brg_storm_gunner', name: 'Storm Gunner', bridge: { trees: ['navigation', 'gunnery'], min: 10 }, flags: ['storm_gunner'], description: 'Heavy seas and storms no longer spread your shot; a broadside fired on the crest of a swell (watch the sight) reaches 15% further.' }),
  b({ id: 'brg_ghost_trader', name: 'Ghost Trader', bridge: { trees: ['trade', 'smuggling'], min: 10 }, flags: ['ghost_trader'], description: 'Honest cargo hides the rest: every 10 units of legal goods cut the chance of contraband being found by 1% (to −25%).' }),
  b({ id: 'brg_blood_and_salt', name: 'Blood and Salt', bridge: { trees: ['boarding', 'survival'], min: 10 }, flags: ['blood_and_salt'], description: 'Every enemy killed in a boarding mends 0.3% of your hull (to 10% a boarding). Not with an Iron Coffin.' }),
  b({ id: 'brg_drowned_boarders', name: 'Drowned Boarders', bridge: { trees: ['abyssal', 'boarding'], min: 10 }, flags: ['drowned_boarders'], description: 'The drowned go over the rail first: for 6 s your living crew takes no losses — the dead take them. With no drowned aboard, five rise from the water as the grapples bite.' }),
  b({ id: 'brg_flagship_yard', name: 'Flagship Yard', bridge: { trees: ['command', 'shipwright'], min: 10 }, flags: ['flagship_yard'], description: 'Your escorts get half the bonuses of your own fittings.' }),
  b({ id: 'brg_exotic_goods', name: 'Exotic Goods', bridge: { trees: ['exploration', 'trade'], min: 10 }, flags: ['exotic_goods'], description: 'Goods bought in lawless waters sell for 10% more in safe ones; relics, ore of the deep and charts sell 15% higher.' }),
  b({ id: 'brg_night_raider', name: 'Night Raider', bridge: { trees: ['navigation', 'smuggling'], min: 10 }, flags: ['night_raider'], description: 'At night or in fog, your first broadside at a ship that has not seen you for 10 s deals +25% damage, and you gain +10% speed for 5 s. Does not stack with Shadow Strike\'s damage (the larger counts).' }),
  b({ id: 'brg_tide_whisperer', name: 'Tide Whisperer', bridge: { trees: ['navigation', 'abyssal'], min: 10 }, flags: ['tide_whisperer'], description: 'In the dead wind of the Abyss the deep currents carry you at 60% speed; Abyss Step recharges 30% faster.' }),
  b({ id: 'brg_salvage_king', name: 'Salvage King', bridge: { trees: ['shipwright', 'exploration'], min: 10 }, flags: ['salvage_king'], description: 'Once a day, raise a ship that went down near you (L within 200 m, within 10 min) and tow her to port as a prize with 10% hull; towing slows you 40%.' }),
  b({ id: 'brg_grand_battery', name: 'Grand Battery', bridge: { trees: ['command', 'gunnery'], min: 10 }, flags: ['grand_battery'], description: 'When you and at least two allied ships hit the same target within 2 s, each of those volleys deals +10% and she loses 10 morale.' }),
  b({ id: 'brg_iron_will', name: 'Iron Will', bridge: { trees: ['survival', 'command'], min: 15 }, flags: ['iron_will'], description: 'While morale is above 60, hull damage −8%. While the hull is above 60%, morale losses −25%.' }),
];
