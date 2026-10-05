// Trade goods. Weight in "tons-ish" units, volume in hold slots. Prices in silver reales.
// `spoilPerHour` is the fraction of a stack that rots per economy hour (15 real minutes) at sea (0 = never).
// `danger` > 0 means the cargo can detonate/ignite when the hold takes hits (gunpowder, relics).

export type GoodId =
  | 'provisions' | 'rum' | 'sugar' | 'tobacco' | 'timber' | 'planks' | 'sailcloth'
  | 'iron' | 'coal' | 'gunpowder' | 'cloth' | 'spices' | 'medicine' | 'weapons'
  | 'whale_oil' | 'salt' | 'pearls' | 'dreamleaf' | 'cursed_relics' | 'abyssal_ore'
  | 'leviathan_bone' | 'sulfur_iron' | 'drowned_silk' | 'kraken_ink'
  // The catch (docs/12 P3).
  | 'fish' | 'prime_fish' | 'salted_fish'
  // The hunt (docs/12 P4).
  | 'baleen' | 'ambergris' | 'orca_tooth' | 'whalebone' | 'narwhal_tusk' | 'shark_skin' | 'serpent_scale'
  // The island's trades (docs/12 P7).
  | 'tar' | 'smoked_fish' | 'scrimshaw';

export type GoodCategory = 'staple' | 'luxury' | 'industrial' | 'military' | 'supply' | 'contraband' | 'mystic' | 'rare';

export interface GoodDef {
  id: GoodId;
  name: string;
  category: GoodCategory;
  basePrice: number;
  weight: number;
  volume: number;
  spoilPerHour: number;
  danger: number;
  contraband: boolean;
  description: string;
}

const g = (
  id: GoodId, name: string, category: GoodCategory, basePrice: number, weight: number, volume: number,
  spoilPerHour: number, danger: number, contraband: boolean, description: string,
): GoodDef => ({ id, name, category, basePrice, weight, volume, spoilPerHour, danger, contraband, description });

export const GOODS: Record<GoodId, GoodDef> = {
  provisions: g('provisions', 'Provisions', 'supply', 12, 1, 1, 0.04, 0, false, 'Salt pork, hardtack and water casks. Crew eats it; hungry crews lose morale.'),
  rum: g('rum', 'Rum', 'staple', 30, 1, 1, 0, 0, false, 'Dark cane rum. Every port drinks it, pirate havens drink more.'),
  sugar: g('sugar', 'Sugar', 'staple', 24, 1, 1, 0.01, 0, false, 'Raw cane sugar in damp sacks. Feeds distilleries.'),
  tobacco: g('tobacco', 'Tobacco', 'luxury', 38, 0.5, 1, 0.005, 0, false, 'Cured leaf bales. Crown taxes it heavily.'),
  timber: g('timber', 'Timber', 'industrial', 16, 2, 2, 0, 0, false, 'Rough logs. Shipyards consume it endlessly.'),
  planks: g('planks', 'Planks & Pitch', 'supply', 22, 1, 1.5, 0, 0, false, 'Cut planks and tar. Used by the carpenters to repair the hull.'),
  sailcloth: g('sailcloth', 'Sailcloth', 'supply', 26, 0.5, 1, 0, 0, false, 'Heavy canvas and cordage. Used to repair sails and rigging.'),
  iron: g('iron', 'Iron', 'industrial', 34, 3, 1, 0, 0, false, 'Pig iron from the Ashen foundries.'),
  coal: g('coal', 'Coal', 'industrial', 14, 2, 1.5, 0, 0, false, 'Black coal for forges and foundries.'),
  gunpowder: g('gunpowder', 'Gunpowder', 'military', 45, 1, 1, 0, 0.6, false, 'Dangerous. A hit to a hold full of powder can end a voyage in one flash.'),
  cloth: g('cloth', 'Cloth', 'staple', 30, 0.5, 1, 0, 0, false, 'Wool and linen bolts.'),
  spices: g('spices', 'Spices', 'luxury', 70, 0.3, 0.5, 0.005, 0, false, 'Pepper, clove, black cardamom. Light and precious.'),
  medicine: g('medicine', 'Medicine', 'luxury', 90, 0.2, 0.5, 0.02, 0, false, 'Laudanum, quinine, bone-saws. Epidemics make it priceless.'),
  weapons: g('weapons', 'Weapons', 'military', 80, 1.5, 1, 0, 0.1, false, 'Muskets, cutlasses, boarding axes.'),
  whale_oil: g('whale_oil', 'Whale Oil', 'industrial', 40, 1, 1, 0, 0.2, false, 'Lamp oil rendered in Leviathan Reach. Burns bright and long.'),
  salt: g('salt', 'Salt', 'staple', 10, 1, 1, 0, 0, false, 'Preserves provisions. Cheap everywhere except the far north.'),
  pearls: g('pearls', 'Pearls', 'luxury', 220, 0.05, 0.1, 0, 0, false, 'Black and grey pearls from the Whispering shoals.'),
  dreamleaf: g('dreamleaf', 'Dreamleaf', 'contraband', 120, 0.5, 1, 0.01, 0, true, 'Narcotic leaf. Forbidden in Crown ports, adored in Fogmouth.'),
  cursed_relics: g('cursed_relics', 'Cursed Relics', 'mystic', 300, 0.3, 0.5, 0, 0.4, true, 'Idols from the Drowned Crown. They whisper. The crew hates them.'),
  abyssal_ore: g('abyssal_ore', 'Abyssal Ore', 'mystic', 260, 3, 1, 0, 0.1, false, 'Deep-sea metal that never rusts. Shipwrights pay a fortune.'),
  // Rare shipbuilding materials (docs/02 §3.A.4): only where they come from.
  leviathan_bone: g('leviathan_bone', 'Leviathan Bone', 'rare', 420, 2, 1, 0, 0, false, 'Keel-bone of the great beasts. A keel of it will not break.'),
  sulfur_iron: g('sulfur_iron', 'Sulfur Iron', 'rare', 180, 3, 1, 0, 0, false, 'Volcanic iron from the Ashen Isles. Guns cast from it rarely burst.'),
  drowned_silk: g('drowned_silk', 'Drowned Silk', 'rare', 520, 0.3, 0.5, 0, 0, false, 'Sailcloth woven in the Drowned Crown. It mends itself. The crew does not like the sound it makes.'),
  kraken_ink: g('kraken_ink', 'Kraken Ink', 'rare', 380, 0.5, 0.3, 0, 0, false, 'Ink of the deep. A hull painted with it is hard to see.'),
  // The catch (docs/12 P3): fresh fish rots fast at sea; salted it keeps.
  fish: g('fish', 'Fresh Fish', 'supply', 7, 1, 1, 0.3, 0, false, 'Herring, cod and mackerel on ice or on nothing. Sell it quickly or salt it.'),
  prime_fish: g('prime_fish', 'Prime Fish', 'luxury', 32, 1, 1, 0.3, 0, false, 'Tuna, swordfish, lobster and squid for the captains’ tables. It will not wait.'),
  tar: g('tar', 'Tar', 'industrial', 22, 1, 1, 0, 0, false, 'Pine tar boiled in a kiln: for seams, rigging and every yard in the sea.'),
  smoked_fish: g('smoked_fish', 'Smoked Fish', 'staple', 34, 1, 1, 0.02, 0, false, 'Fish hung in oak smoke for a week. A delicacy in the southern ports.'),
  scrimshaw: g('scrimshaw', 'Scrimshaw', 'luxury', 380, 0.2, 0.2, 0, 0, false, 'Teeth and bone carved by long evenings ashore: ships, mermaids, a captain’s face.'),
  baleen: g('baleen', 'Baleen', 'industrial', 60, 1, 1, 0, 0, false, 'Whalebone plates from a whale’s mouth: stays, whips, springs. Every tailor wants it.'),
  ambergris: g('ambergris', 'Ambergris', 'luxury', 900, 0.2, 0.2, 0, 0, false, 'A grey lump from a sperm whale’s gut. Perfumers pay its weight in gold.'),
  orca_tooth: g('orca_tooth', 'Beast Teeth', 'luxury', 120, 0.2, 0.2, 0, 0, false, 'Teeth of orcas, sharks and whales, for scrimshaw and charms.'),
  whalebone: g('whalebone', 'Whalebone', 'industrial', 45, 2, 1, 0, 0, false, 'Great bones of the whale: ribs for boats, knees for hulls.'),
  narwhal_tusk: g('narwhal_tusk', 'Narwhal Tusk', 'luxury', 380, 1, 1, 0, 0, false, 'A spiral tusk of ivory. Sold as a unicorn’s horn in the southern ports.'),
  shark_skin: g('shark_skin', 'Shark Skin', 'industrial', 55, 1, 1, 0, 0, false, 'Rough as a file: for grips, sword hilts and polishing wood.'),
  serpent_scale: g('serpent_scale', 'Serpent Scale', 'luxury', 300, 1, 1, 0, 0, false, 'Scales of a sea serpent, hard as iron and green as bottle glass.'),
  salted_fish: g('salted_fish', 'Salted Fish', 'staple', 16, 1, 1, 0, 0, false, 'Fish packed in salt in a barrel. Keeps a year; cold ports pay well for it.'),
};

export const GOOD_IDS = Object.keys(GOODS) as GoodId[];

/** How hard a port's price answers its stock: price ∝ (target / stock) ^ this (server/src/game/economy.ts). */
export const MARKET_ELASTICITY = 0.6;

/** What `n` units cost from a market row (its first unit's price and its stock): each one bought leaves one less in
 *  stock and the next dearer, as the harbour's quote walks it (a «Buy 5 · 100» button charged 111 at a thin stock). */
export function walkBuyCost(good: GoodId, buy: number, stock: number, n: number): number {
  // (the price's own ceiling: 3.2 times the good's base, with the buying spread)
  const cap = Math.max(buy, GOODS[good].basePrice * 3.2 * 1.055);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.min(cap, buy * Math.pow(Math.max(1, stock) / Math.max(1, stock - i), MARKET_ELASTICITY));
  return Math.ceil(total);
}
