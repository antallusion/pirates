// The art of the yard's wider trade (owner, 2026-10-03): an icon for every new gun, shot, fitting, deck mount,
// figurehead and set, in the hand of the item icons (shared/src/data/itemart.ts), sixteen to a sheet in this order.
// Till a sheet is painted and cut, a painted kindred icon stands in for each (client/src/assets.ts asks here), so no
// row of the yard, the hold or the gear window is ever blank. An icon once painted needs no stand-in; tests/arms.test.ts
// keeps it so, and keeps every stand-in a painted one.

export const ARMS_ART: [id: string, standIn: string, look: string][] = [
  // Sheet A: the guns and the shot.
  ['icon.gun_minion_4', 'icon.gun_light_6', 'a small short iron cannon with a bronze muzzle ring on a light two-wheeled carriage'],
  ['icon.gun_perrier', 'icon.gun_carronade_24', 'a squat wide-mouthed perrier on a low carriage beside a heap of round grey stone shot'],
  ['icon.gun_culverin_8', 'icon.gun_long_9', 'a very long slender iron culverin with dolphin-shaped lifting handles, on a narrow carriage'],
  ['icon.gun_whaling_gun', 'icon.gun_medium_12', 'a stout whaling gun with a barbed iron bomb-lance jutting from its muzzle'],
  ['icon.gun_gunbreaker_14', 'icon.gun_heavy_18', 'a short thick-walled iron gun with a heavy breech ring, laid low on a squat carriage'],
  ['icon.gun_shell_gun', 'icon.gun_heavy_18', 'a smooth black shell gun beside a hollow iron shell with a burning wooden fuse'],
  ['icon.gun_drowned_bronze', 'icon.gun_medium_12', 'a verdigris-green bronze cannon crusted with barnacles, seawater dripping from its muzzle'],
  ['icon.gun_demi_cannon_32', 'icon.gun_heavy_18', 'a massive long black iron cannon on a heavy four-wheeled carriage with thick breeching rope'],
  ['icon.ammo_bar', 'icon.ammo_chain', 'two iron half-balls joined by a solid iron bar'],
  ['icon.ammo_long_shot', 'icon.ammo_round', 'a smaller polished iron ball seated in a thick wad of tarred rope'],
  ['icon.ammo_star', 'icon.ammo_incendiary', 'an iron ball with a fierce white star-flare burning out of its fuse hole'],
  ['icon.ammo_salt', 'icon.ammo_round', 'a pale iron ball crusted with glittering white salt, tied with a twist of black ribbon'],
  ['icon.ammo_stinkpot', 'icon.ammo_incendiary', 'a round clay pot with a rag fuse, yellow sulphur smoke curling out of it'],
  ['icon.ammo_drag', 'icon.ammo_chain', 'an iron ball trailing a short chain that ends in a barbed hook'],
  ['icon.set_master_gunner', 'icon.set_admiralty', 'a gunner’s linstock crossed over a brass quadrant and a cannonball'],
  ['icon.set_smuggler', 'icon.set_drowned', 'a dark lantern with its shutter half closed over a corded bale'],
  // Sheet B: the fittings of the gun deck, the well and the tops; the first of the bosses' plans.
  ['icon.mod_gun_carriages', 'icon.talent_shp_improved_carriages', 'a cannon carriage on iron-shod trucks with side tackles coiled beside it'],
  ['icon.mod_powder_hoists', 'icon.talent_gun_powder_discipline', 'a rope-and-pulley hoist lifting a leather powder bucket through a deck hatch'],
  ['icon.mod_shot_furnace', 'icon.talent_gun_heated_shot', 'a small brick shot furnace with red-hot cannonballs glowing on an iron grate'],
  ['icon.mod_mortar_bed', 'icon.talent_gun_mortar_lore', 'a squat sea mortar sunk in a timbered well on heavy oak bedding'],
  ['icon.mod_chain_pumps', 'icon.talent_srv_bilge_pumps', 'a ship’s chain pump with a crank wheel and an iron chain running down into a wooden well'],
  ['icon.mod_fire_engine', 'icon.talent_srv_bucket_brigade', 'a brass hand-pumped fire engine on a small wooden cart with a leather hose'],
  ['icon.mod_carpenters_walk', 'icon.talent_srv_carpenters', 'a narrow lantern-lit passage along the inside of a hull, a mallet and wooden plugs on a ledge'],
  ['icon.mod_magazine_lining', 'icon.talent_srv_sealed_magazine', 'a powder room lined with copper sheet, kegs behind a wet felt curtain'],
  ['icon.mod_davits', 'icon.talent_srv_lifeboats', 'a longboat hanging from two curved iron davits at a ship’s stern'],
  ['icon.mod_boarding_nets', 'icon.talent_brd_boarding_nets', 'a heavy rope net triced up above a ship’s rail on short spars'],
  ['icon.mod_lookout_top', 'icon.talent_exp_crows_nest', 'a railed lookout’s top high on a mast, a spyglass resting on its rail'],
  ['icon.mod_iron_masts', 'icon.talent_shp_ironbound_masts', 'a thick mast bound with riveted iron hoops'],
  ['icon.mod_sail_locker', 'icon.talent_shp_spare_rigging', 'an open locker of folded spare canvas, coiled cordage and a sailmaker’s palm'],
  ['icon.mod_bilge_keels', 'icon.talent_nav_sea_legs', 'the round of a hull’s bilge seen from below, a long timber keel fixed along it'],
  ['icon.mod_galley', 'icon.prof_cook', 'a copper galley stove with a steaming pot and a ladle on a hook'],
  ['icon.mod_leviathan_ribs', 'icon.good_leviathan_bone', 'great curved pale leviathan ribs set as frames inside a dark hull'],
  // Sheet C: the rest of the bosses' plans and the deck mounts.
  ['icon.mod_ink_sacs', 'icon.good_kraken_ink', 'a glass-and-iron tank of black kraken ink with a valve, ink seeping at its seam'],
  ['icon.mod_serpent_spine', 'icon.talent_nav_serpentine', 'a long knotted serpent spine bolted along a ship’s keel timber'],
  ['icon.mod_drowned_gunlocks', 'icon.talent_gun_fast_hands', 'a corroded green-bronze cannon lock with a dripping flint and a faint teal glow'],
  ['icon.mod_wreck_bulwarks', 'icon.talent_shp_iron_strapping', 'a ship’s side patched with mismatched riveted iron plates taken from many wrecks'],
  ['icon.mod_tiller_chains', 'icon.talent_nav_iron_tiller', 'a tiller bar hung on heavy iron chains running to a rudder head'],
  ['icon.mod_eye_lantern', 'icon.boon_lantern', 'a masthead lantern holding a jagged black shard that glows cold blue'],
  ['icon.mod_maw_grapnels', 'icon.talent_brd_iron_grip', 'a grappling hook whose flukes are long pale curved teeth, on an iron chain'],
  ['icon.mod_widow_ribbons', 'icon.talent_nav_second_wind', 'black silk ribbons tied in a ship’s shrouds, streaming out in a gale'],
  ['icon.mount_swivel_gun', 'icon.talent_gun_swivel_guns', 'three short brass musketoons on swivel forks along a ship’s rail'],
  ['icon.mount_long_tom', 'icon.gun_long_9', 'a long heavy cannon on a pivoting slide carriage over a circular iron track'],
  ['icon.mount_rocket_frame', 'icon.ab_admiralty_barrage', 'a wooden frame of six war rockets on long sticks, one fuse sparking'],
  ['icon.mount_fire_siphon', 'icon.mount_fire_charge', 'a bronze siphon nozzle shaped like a beast’s head, spitting a jet of burning oil'],
  ['icon.mount_net_thrower', 'icon.mount_harpoon', 'a pivot gun throwing a weighted rope net that spreads open in the air'],
  ['icon.mount_smoke_pots', 'icon.ab_smoke_pots', 'clay smoke pots on a ship’s rail pouring out thick grey smoke'],
  ['icon.mount_powder_kegs', 'icon.sp_powder_keg', 'two small powder kegs with burning fuses rolling off a ship’s stern rail'],
  ['icon.mount_war_drums', 'icon.ab_war_cry', 'a pair of battered war drums with crossed sticks on a ship’s deck'],
  // Sheet D: the figureheads (two places spare).
  ['icon.fh_fishwife', 'icon.fh_weeping_widow', 'a carved figurehead of a stout fishwife with a basket of fish on her hip'],
  ['icon.fh_doge', 'icon.fh_gilded_scale', 'a carved figurehead of a doge in a horned ducal cap, the gilt flaking'],
  ['icon.fh_admiral', 'icon.fh_crown_lion', 'a carved figurehead of an old admiral in a cocked hat, pointing ahead with a telescope'],
  ['icon.fh_mermaid', 'icon.fh_weeping_widow', 'a carved figurehead of a mermaid with long hair, her scaled tail curling under the bowsprit'],
  ['icon.fh_jolly_jack', 'icon.fh_red_devil', 'a carved figurehead of a grinning sailor with a cutlass between his teeth'],
  ['icon.fh_veiled_lady', 'icon.fh_fog_owl', 'a carved figurehead of a lady whose face is hidden under a carved veil'],
  ['icon.fh_salamander', 'icon.fh_serpent', 'a carved figurehead of a red-and-black salamander wreathed in carved flames'],
  ['icon.fh_narwhal', 'icon.fh_harpooneer', 'a carved figurehead of a narwhal, its long spiral ivory tusk thrust forward'],
  ['icon.fh_wrecker', 'icon.fh_saint_of_wrecks', 'a carved figurehead of a hooded wrecker swinging a lantern on a pole'],
  ['icon.fh_seraph', 'icon.fh_saint_of_wrecks', 'a carved figurehead of a six-winged seraph with closed eyes, wings folded along the bow'],
  ['icon.fh_leviathan', 'icon.mod_figurehead_kraken', 'a figurehead carved as a leviathan’s head with a gaping jaw of ivory teeth'],
  ['icon.fh_storm_widow', 'icon.fh_weeping_widow', 'a carved figurehead of a widow in a streaming black veil, lightning carved in her hair'],
  ['icon.fh_hermit_crab', 'icon.mod_figurehead_kraken', 'a figurehead of a giant hermit crab’s claws and shell grown over with wreck timbers'],
  ['icon.fh_hollow_admiral', 'icon.fh_drowned_man', 'a carved figurehead of a hollow-eyed drowned admiral in a barnacled bicorne'],
];

/** The new item bases (sheets 5–7 of the item icons) and the painted piece that stands in for each meanwhile. */
const ITEM_STAND_IN: Record<string, string> = {
  lateen_sails: 'silk_sails', black_sails: 'storm_sails', studding_sails: 'canvas_sails', quick_braces: 'hemp_rigging', spare_spars: 'iron_rigging',
  fighting_tops: 'marines_berth', double_planking: 'oak_plating', felt_lining: 'copper_sheathing', iron_stem: 'iron_belt', ship_wheel: 'balanced_rudder',
  shoal_rudder: 'iron_rudder', bread_room: 'deep_hold', timber_racks: 'oak_plating', smugglers_nook: 'false_hold', sick_bay: 'hammocks', armoury: 'marines_berth',
  splinter_screens: 'hammocks', gun_tackle: 'aiming_wedges', grape_bags: 'powder_cartridges', chain_lockers: 'double_charge', gunlocks: 'duelling_pistols',
  signal_hoist: 'league_pennant', grey_pennant: 'crown_ensign', hand_of_glory: 'saint_bone', bottled_wind: 'storm_glass', coffin_nail: 'drowned_compass',
  merchant_hat: 'tricorne', gunner_cap: 'bandana', buff_coat: 'longcoat', smugglers_cloak: 'oilskin', powder_horn: 'cartridge_belt', buccaneer_boots: 'seaboots',
  boarding_pike: 'boarding_axe', officer_sabre: 'rapier', pepperbox: 'blunderbuss', ranging_glass: 'brass_glass', sun_stone: 'brass_compass',
  lucky_doubloon: 'saint_medal', witch_bottle: 'rabbit_foot', gold_hoop: 'signet',
};

/** Every icon still being painted → the painted icon that stands in for it. */
export const ICON_STAND_IN: Record<string, string> = {
  ...Object.fromEntries(ARMS_ART.map(([id, stand]) => [id, stand])),
  ...Object.fromEntries(Object.entries(ITEM_STAND_IN).map(([id, stand]) => [`icon.item_${id}`, `icon.item_${stand}`])),
};
