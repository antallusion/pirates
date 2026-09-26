// Legendary ships (docs/02 §14.A.5): one of each on the server, built from the first victories over the great
// monsters by a commission the whole sea can feed. Each is a side-grade: a gift and a price, no more than about
// five per cent over its base hull.

import type { BossId } from './bosses.ts';
import type { GoodId } from './goods.ts';
import type { ShipClassId } from './ships.ts';
import type { Flag, StatMods } from './stats.ts';

export type LegendaryId = 'first_rib' | 'saint_maws_bell' | 'crowns_sorrow' | 'widows_lament' | 'lamplighter';

export interface LegendaryDef {
  id: LegendaryId;
  name: string;
  base: ShipClassId;
  boss: BossId; // the first victory over it lays the keel
  port: string; // the yard that builds her
  need: Partial<Record<GoodId, number>>;
  mods: StatMods;
  flags: Flag[];
  gift: string;
  price: string;
}

export const LEGENDARY: Record<LegendaryId, LegendaryDef> = {
  first_rib: {
    id: 'first_rib', name: 'First Rib', base: 'frigate', boss: 'leviathan', port: 'harpoon_rest',
    need: { leviathan_bone: 120, timber: 200, iron: 60 }, mods: { ramTaken: -1, ramDealt: 0.15, holdVolume: -0.1 }, flags: [],
    gift: 'Her bow is the Leviathan\'s own rib: a ram never hurts her, and hits 15% harder.', price: 'The bone takes room: −10% hold.',
  },
  saint_maws_bell: {
    id: 'saint_maws_bell', name: "Saint Maw's Bell", base: 'brigantine', boss: 'drowned_whale', port: 'saint_maw',
    need: { drowned_silk: 60, cursed_relics: 40, timber: 150 }, mods: {}, flags: ['choir_bell', 'saint_maws_bell'],
    gift: 'The Choir\'s bell rings from her masthead: it quiets the Song, and her guns hit monsters 20% harder.', price: 'The Crown hates her: −10 reputation an hour in Crown waters.',
  },
  crowns_sorrow: {
    id: 'crowns_sorrow', name: "Crown's Sorrow", base: 'man_o_war', boss: 'hollow_admiral', port: 'gravesend',
    need: { cursed_relics: 60, timber: 400, iron: 150 }, mods: { reloadMul: -0.05 }, flags: ['crowns_sorrow'],
    gift: 'Drey\'s old flagship reborn: she and the ships in her line reload 5% faster.', price: 'She remembers the dead: −1 morale every ten minutes at sea.',
  },
  widows_lament: {
    id: 'widows_lament', name: "Widow's Lament", base: 'schooner', boss: 'storm_widow', port: 'fogmouth',
    need: { sailcloth: 150, sulfur_iron: 40, timber: 120 }, mods: { sailHpMax: -0.2, stormSailDamage: -0.6 }, flags: ['widows_lament'],
    gift: 'Storm canvas: +10% speed in a storm, and the storm tears at her sails far less.', price: 'Fine canvas is thin: −20% sail strength.',
  },
  lamplighter: {
    id: 'lamplighter', name: 'Lamplighter', base: 'brig', boss: 'lantern_maw', port: 'wrecktide',
    need: { pearls: 60, whale_oil: 80, timber: 150 }, mods: { chaserDamage: 0.3, detection: 0.05 }, flags: ['lantern_gland', 'lamplighter'],
    gift: 'Lantern cannon fore and aft: chasers +30%, and the Maw\'s gland at her bow.', price: 'Her lights draw the monsters of the deep from twice as far.',
  },
};

export const LEGENDARY_IDS = Object.keys(LEGENDARY) as LegendaryId[];
