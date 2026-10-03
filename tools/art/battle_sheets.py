"""HoMM-style battle art (owner, 2026-10-02): full-figure units, spell icons, battlefields, obstacles.

    python tools/art/battle_sheets.py   # writes the sheets into tools/art/sheets.json and the jobs into
                                        # assets/raw/q_battle.json (the web queue's job list)

Painted on higgsfield.ai, Nano Banana 2 Unlimited at 2K: the web has no transparent background, so figures and props
stand on flat magenta and are keyed when cut (slice_sheet.py); icons are opaque tiles with black gutters; a
battlefield is one opaque picture (register.py + process.py).
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_battle.json')


def listing(rows):
    return ' '.join(f'{i + 1}. {r}.' for i, r in enumerate(rows))


NO_TEXT = ('NO captions or labels, NO words anywhere in the picture, NO frames, NO borders, NO grid lines, NO text, '
           'NO letters, NO numbers, NO watermark.')
MAGENTA = ('Background: flat, fully saturated pure magenta #FF00FF (RGB 255, 0, 255) everywhere between and around them, '
           'not pink, no gradient, NO floor, NO ground plane, NO cast shadows on the background.')

# --- 1. Units: full figures, high three-quarter camera, facing right (the enemy's are mirrored in the game) --------
UNIT_HEAD = ('Game sprite sheet for a dark Pirate Gothic turn-based battle game, in the painterly style of the battle '
             'units of Heroes of Might and Magic III and Warcraft III but grim and realistic: {n} separate full-body '
             'battle figures laid out in a strict grid of {grid}, each one centred in its own equal cell with its feet '
             'on the same invisible baseline near the bottom of the cell and the figure filling about 75% of the '
             "cell's height, with wide even gaps of empty background between the cells so that no two figures touch "
             'or overlap. Every figure is seen from a high three-quarter camera about 35 degrees above the ground, '
             'turned to face the RIGHT side of the picture in a ready combat stance, the whole body visible from the '
             'top of the head to the feet, {scale}, the same warm lantern key light from the upper left and a cool '
             'moonlight rim from behind on all of them, one consistent painted style across the whole sheet, bold '
             'readable silhouettes at small size. Left to right, top to bottom: ')
UNIT_TAIL = (' Muted palette: charcoal, graphite, tarred black leather, weathered wool, rust, old brass, faded red, cold '
             'blue-grey; low saturation, with small warm highlights. ' + MAGENTA + ' ' + NO_TEXT +
             ' Avoid: cartoon, chibi, anime, flat vector, cel shading, thick outlines, glowing magic, bright saturated '
             'colours, front view, back view, flat side profile, blood, gore, skeletons.')

MEN = [
    ('unit.deckhand', 'a barefoot young deckhand in a torn striped shirt and canvas trousers, gripping a belaying pin like a club'),
    ('unit.sailor', 'a seasoned sailor in a tarred jacket and a knitted cap, a short cutlass in one hand and a marlinspike in the other'),
    ('unit.marine', 'a ship\'s marine in a faded red coat with white crossbelts, a musket with a fixed bayonet held at the ready'),
    ('unit.sea_guard', 'a sea guard in a dented steel breastplate and a morion helmet, a round iron-bound buckler and a short boarding pike'),
    ('unit.musketeer', 'a musketeer in a long weathered coat and a wide-brimmed hat, aiming a long matchlock musket'),
    ('unit.sharpshooter', 'a sharpshooter in a dark hooded oilskin with a powder horn, kneeling on one knee and taking careful aim with a long rifled musket'),
    ('unit.gunner', 'a burly gunner in a leather apron beside a small swivel gun on a timber post, holding a smoking linstock'),
    ('unit.bombardier', 'a bombardier in a scorched leather apron with a soot-black face, a lit grenade raised in one hand and a bandolier of grenades across his chest'),
    ('unit.boarder', 'a boarder with a cutlass in each hand, bare scarred arms, a red sash and a bandana'),
    ('unit.cutthroat', 'a lean cutthroat in a black long coat with a black scarf over the lower face, a curved knife in one hand and a flintlock pistol in the other'),
    ('unit.guard', 'an officers\' guardsman in a heavy dark navy coat and a tricorne, standing firm with a halberd'),
    ('unit.life_guard', 'a captain\'s life guard in a black steel cuirass over a dark burgundy coat with gold braid, a basket-hilted broadsword and a pistol'),
    ('unit.drowned', 'a drowned sailor risen from the sea, grey waterlogged skin, kelp in the hair, barnacles on a rotted coat, a rusted boarding axe'),
    ('unit.deep_spawn', 'a hulking deep spawn brute born of the sea, coral growing through its shoulders, webbed hands, a heavy anchor chain wound round one arm, a very faint turquoise glint in its eyes'),
    ('unit.captain', 'a pirate captain on foot in a long black coat with brass buttons and a feathered tricorne, sword raised to command'),
    ('unit.officer', 'a ship\'s lieutenant in a dark blue coat with epaulettes, a spyglass in one hand and a sabre in the other'),
]
BEASTS = [
    ('unit.crab', 'a giant armoured shore crab as big as a hound, claws raised, a barnacled shell'),
    ('unit.gull', 'a giant grey sea gull in flight with wings spread wide and a hooked beak'),
    ('unit.seal', 'a big scarred grey bull seal rearing up on its flippers'),
    ('unit.reef_shark', 'a reef shark lunging up out of a small round splash of dark water, jaws open'),
    ('unit.rock_turtle', 'a massive rock turtle whose shell is crusted with stones and lichen'),
    ('unit.sea_turtle', 'a great sea turtle with a barnacled domed shell and long flippers'),
    ('unit.marsh_serpent', 'an olive-brown marsh serpent coiled and rearing to strike, fangs bared'),
    ('unit.hermit', 'a wild island hermit in rags with a long grey beard, whirling a sling'),
    ('unit.lagoon_tentacle', 'a single huge dark kraken tentacle rising out of a small round splash of water, its suckers showing'),
    ('unit.mermaid', 'a sinister mermaid with pale grey skin and long black hair, rising from a small round splash of water with a bone spear'),
    ('unit.cultist', 'a hooded cultist of the drowned god in a sodden dark robe, holding up a lantern with a faint green flame'),
    ('unit.surf_drowned', 'a drowned castaway risen from the surf in a tattered sailcloth shroud draped with seaweed, reaching forward'),
    ('unit.young_serpent', 'a young sea serpent rearing high, a dark green-black scaled body with a crest of fins'),
    ('unit.lantern_maw', 'a lantern maw, a deep-sea anglerfish monster on short thick limbs with a huge toothy jaw and a glowing lure on a stalk'),
    ('unit.ancient_turtle', 'an ancient colossal turtle whose mossy rock shell is like a small island with a twisted tree on it'),
    ('unit.shoal_leviathan', 'a young leviathan, a long armoured serpent-whale rising out of a splash with bone spines along its back'),
]
LEGENDS = [
    ('unit.white_whale', 'the White Whale, a huge pale sperm whale breaching out of a burst of dark sea water, its scarred hide stuck with old harpoons'),
    ('unit.young_kraken', 'a young kraken with a mottled dark burgundy body and many tentacles raised, rising out of dark water'),
]

# --- 2. Orders and spells: opaque square tiles in a 4×4 grid -------------------------------------------------------
SPELL_HEAD = ('Sheet of sixteen square battle-spell icons for a dark Pirate Gothic turn-based battle game, in the '
              'painterly style of the spell icons of Heroes of Might and Magic III and the ability icons of World of '
              'Warcraft but grim and realistic, laid out in a strict 4 by 4 grid of equal square tiles separated by '
              'thin pure black gutters. Each tile is its own icon: one dramatic scene filling the whole tile edge to '
              'edge, a strong focal point readable at small size, rich painted detail, the same lighting and finish '
              'across all sixteen. The icons, left to right and top to bottom: ')
SPELL_TAIL = (' Muted palette: charcoal, graphite, cold blue-grey, dirty silver, old brass, very dark burgundy; fiery '
              'orange only for fire and gunpowder, a very faint turquoise only for the deep. NO frames, NO borders '
              'inside the tiles, NO text, NO letters, NO numbers, NO watermark. Avoid: cartoon, flat vector, emoji, '
              'cel shading, thick outlines, bright saturated colours, blood, gore, skeletons.')
SPELLS = [
    ('grenades', 'a hand hurling a black iron grenade with a sputtering fuse over a ship\'s rail into a crowd of enemies'),
    ('point_blank', 'a flintlock pistol fired at arm\'s length, a bright muzzle flash and a burst of smoke'),
    ('smoke_and_knives', 'a bank of grey smoke on a deck with daggers flashing out of it'),
    ('red_harvest', 'a crew of pirates surging forward with raised cutlasses in a crimson haze'),
    ('turn_the_flank', 'pirates sweeping round the end of an enemy line on a deck'),
    ('call_of_the_deep', 'pale drowned hands rising from black water and dragging sailors over the side'),
    ('iron_discipline', 'a line of sailors standing shoulder to shoulder behind an officer\'s raised sword'),
    ('mark_target', 'the barrels of many muskets converging on one enemy sailor marked with a chalk cross'),
    ('double_shot', 'two musket balls leaving one long barrel in a double burst of flame'),
    ('war_cry', 'a scarred pirate captain roaring with a raised cutlass, his crew shouting behind him'),
    ('brine_mend', 'seawater washing over a wounded sailor\'s arm and closing the cut, a faint silver light'),
    ('musket_storm', 'a whole crew firing pistols and muskets at once, a wall of flashes and smoke'),
    ('powder_keg', 'a powder keg with a burning fuse rolling across a deck into the enemy'),
    ('following_wind', 'a strong wind at the backs of sailors running forward, sails billowing behind them'),
    ('head_wind', 'a fierce wind blowing into the faces of enemy sailors, hats and spray flying back'),
    ('tide_returns', 'fallen sailors rising to their feet again as a wave washes across the deck'),
    ('maelstrom', 'the sea boiling into a whirlpool across an enemy deck, planks and men swept round'),
    ('shield_wall', 'round iron bucklers locked edge to edge in a wall on a deck'),
    ('fury', 'a pirate in a wild frenzy swinging a heavy axe, sparks and splinters flying'),
    ('dread', 'the towering shadow of a horned sea god looming over terrified enemy sailors'),
    ('cs_chain_shot', 'two cannonballs joined by a chain whirling through gunsmoke'),
    ('cs_spotter', 'an officer on the rail with a brass spyglass pointing out a target'),
    ('cs_pistol_line', 'a row of pirates aiming a line of flintlock pistols together'),
    ('cs_gunsmoke', 'a thick bank of white powder smoke rolling over an enemy deck, shots flying wide'),
    ('cs_grape', 'a swivel gun on the rail blasting a cone of grapeshot'),
    ('cs_iron_tide', 'a wave of seawater breaking over a drilled line of sailors who stand firm'),
    ('sm_knives', 'three thrown knives flying through the dark toward an enemy'),
    ('sm_fog_veil', 'a veil of fog hiding a crew while musket balls pass through it harmlessly'),
    ('sm_caltrops', 'iron caltrops scattered across wet deck planks'),
    ('sm_false_colours', 'a plain merchant flag being hoisted over a hidden black pirate flag'),
    ('sm_powder_trail', 'a lit trail of black powder racing across the deck toward a barrel'),
    ('sm_blind_fog', 'enemy musketeers lost in thick blinding fog, aiming at nothing'),
    ('rv_hook', 'an iron boarding hook on a rope catching an enemy\'s coat and pulling him off balance'),
    ('rv_blood_scent', 'shark fins circling in dark water round a boarding fight at dusk'),
    ('rv_berserk', 'a wild-eyed pirate charging alone into the enemy with two axes raised'),
    ('rv_howl', 'a reaver howling at the moon from the rail while enemy sailors cower'),
    ('rv_butcher', 'two heavy cleavers crossing in a mighty downward chop, sparks flying'),
    ('rv_red_mist', 'a red mist drifting over the deck as a crew charges with new strength'),
    ('nv_marlinspike', 'a pointed iron marlinspike gripped in a sailor\'s fist, striking'),
    ('nv_tailwind', 'full sails straining with a steady wind astern, the crew moving quickly'),
    ('nv_flank_drill', 'sailors drilling a flanking movement on deck, an officer signalling with his sword'),
    ('nv_squall', 'a sudden squall of rain and wind lashing across an enemy deck, men thrown down'),
    ('nv_harpoon_line', 'a harpoon gun firing a barbed harpoon trailing its rope'),
    ('nv_eye_of_storm', 'a calm bright circle of sky in the eye of a storm above the ship, the crew steady'),
    ('dr_drowning_grip', 'cold hands of seawater gripping an enemy sailor\'s legs and holding him back'),
    ('dr_brine_kiss', 'drowned sailors rising from the water to stand beside the living crew'),
    ('dr_anchor_chain', 'a heavy anchor on its chain swung in a wide arc through the enemy ranks'),
    ('dr_undertow', 'an undertow dragging enemy sailors across a flooding deck toward black water'),
    ('dr_barnacles', 'a forearm and armour crusted with hard barnacles and shells like a hide'),
    ('dr_abyss', 'a vast eye opening in the black abyss below the ship, the enemy recoiling'),
    ('ad_volley_order', 'an officer\'s sword sweeping down as a line of marines fires a volley'),
    ('ad_signal_flags', 'a hoist of signal flags snapping in the wind above a disciplined crew'),
    ('ad_square', 'marines formed in a tight square with bayonets pointing outward'),
    ('ad_fog_of_war', 'smoke and fog over a battle, the enemy\'s shots flying wide and lost'),
    ('ad_bayonets', 'a line of marines charging with fixed bayonets'),
    ('ad_admiralty', 'naval surgeons in aprons bandaging wounded sailors who stand up again'),
    ('becalm', 'slack sails hanging from a ship in a dead calm on a glassy sea'),
    ('deep_sight', 'a pair of pale drowned eyes glowing faintly beneath the waves, seeing far'),
    ('fair_wind', 'a fair wind filling the sails of a ship heeling under a bright grey sky'),
    ('fog_bank', 'a thick fog bank rolling over the sea and swallowing a ship'),
    ('gale', 'a ship racing before a howling gale, spray flying, sails strained'),
    ('mend_hull', 'the sea knitting a ship\'s broken planks back together beside a shipwright\'s tools'),
    ('bt_wait', 'an hourglass on a ship\'s deck, its sand running'),
    ('bt_defend', 'a raised iron-bound buckler and a cutlass held on guard'),
]

# --- 3. Battlefields: one opaque painting each (16:9) ---------------------------------------------------------------
FIELD_HEAD = ('Painted battlefield background for a turn-based hex battle in a dark Pirate Gothic game, in the style of '
              'the battle screens of Heroes of Might and Magic III but grim and realistic: a wide open fighting ground '
              'seen from a high three-quarter camera, the ground filling the whole picture, mostly flat and even; the '
              'middle two thirds of the picture kept open, uncluttered and evenly lit so that a hex grid and troops '
              'can stand on it; scenery only along the top edge and at the far left and right edges. ')
FIELD_TAIL = (' No troops, no people, no creatures, nothing standing in the middle. Muted palette: charcoal, graphite, '
              'cold blue-grey, weathered brown, dirty silver, with small warm highlights; low saturation. NO frames, '
              'NO borders, NO text, NO letters, NO watermark. Avoid: cartoon, anime, top-down map view, flat side '
              'view, bright colours, Caribbean turquoise water.')
FIELDS = [
    ('bg.field_deck', 'The wet black-oak plank decks of two pirate ships lashed together side by side: the left ship\'s deck fills the left half and the right ship\'s deck the right half, a narrow strip of dark sea between the two hulls down the middle with a few boarding planks across it, heavy rails along the top and bottom edges, coiled ropes, a mast foot and lanterns only at the edges, at night'),
    ('bg.field_tropical', 'A tropical beach of pale grey-gold sand with scattered shells, a few leaning palm trees and the surf line only along the edges, under an overcast sky'),
    ('bg.field_rocky', 'A rocky shore of grey stone and gravel, a few boulders and tide pools only at the edges, cold grey light'),
    ('bg.field_volcanic', 'Black volcanic sand and cracked lava rock, faint glowing cracks and drifting ash only at the edges'),
    ('bg.field_swamp', 'A mangrove swamp of muddy olive ground with shallow puddles, twisted roots and reeds only at the edges, low mist'),
    ('bg.field_graveyard', 'An old sailors\' graveyard of brown earth, leaning gravestones and a broken iron fence only along the top edge, fog'),
    ('bg.field_dead', 'A dead grey wasteland of cracked earth and bleached driftwood, cold blue-grey light'),
    ('bg.field_fort', 'The stone-paved courtyard of a pirate fort under siege: grey flagstones, a crenellated stone wall with a gate and a round tower along the top and right edges, scattered cannonballs at the edges, at night'),
]

# --- 4. Obstacles on the hexes: separate objects on magenta --------------------------------------------------------
PROP_HEAD = ('Game prop sheet for a dark Pirate Gothic turn-based battle game, in the painterly style of the battlefield '
             'obstacles of Heroes of Might and Magic III but grim and realistic: sixteen separate objects laid out in a '
             'strict grid of 4 columns and 4 rows, each one centred in its own equal cell with its base near the '
             'bottom of the cell, filling about 75% of the cell, with wide even gaps of empty background between the '
             'cells so that no two touch. Every object is seen from the same high three-quarter camera about 35 '
             'degrees above the ground, the same warm light from the upper left, one consistent painted style. Left '
             'to right, top to bottom: ')
PROP_TAIL = (' Muted palette: charcoal, graphite, weathered wood, wet stone, rust, old brass; low saturation. ' + MAGENTA +
             ' ' + NO_TEXT + ' Avoid: cartoon, flat vector, cel shading, thick outlines, bright colours.')
PROPS = [
    ('prop.bt_mast', 'the thick foot of a ship\'s mast with ropes belayed round it'),
    ('prop.bt_cannon', 'a black iron cannon on a wooden truck carriage'),
    ('prop.bt_barrels', 'a cluster of three wooden barrels'),
    ('prop.bt_crates', 'a stack of wooden crates tied with rope'),
    ('prop.bt_boulder', 'a grey granite boulder'),
    ('prop.bt_palm', 'a short leaning palm tree with a few fronds'),
    ('prop.bt_lava', 'a black lava rock with faint glowing cracks'),
    ('prop.bt_mangrove', 'a twisted mangrove stump with arching roots'),
    ('prop.bt_graves', 'two leaning weathered gravestones'),
    ('prop.bt_deadtree', 'a bare bleached dead tree'),
    ('prop.bt_coral', 'a pale coral rock crusted with shells'),
    ('prop.bt_surfrock', 'a dark rock hung with seaweed'),
    ('prop.bt_anchor', 'a rusted ship\'s anchor stuck upright in the ground'),
    ('prop.bt_wreck', 'the broken ribs and planks of a small wreck'),
    ('prop.bt_campfire', 'a small campfire of driftwood with a cooking pot'),
    ('prop.bt_statue', 'a broken stone statue of a sailor saint'),
]


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []

    def sheet(name, grid, mode, px, square, out_dir, aspect, ids, prompt, **extra):
        # A sheet still with the painter is flagged `painting` (tests/art14 waits for it); slice_sheet.py clears the flag.
        was = sheets.get(name, {})
        sheets[name] = {'grid': grid, 'mode': mode, 'px': px, 'square': square, 'dir': out_dir, 'aspect': aspect, 'ids': ids, 'prompt': prompt, **extra}
        if was.get('cut'):
            sheets[name]['cut'] = was['cut']
        else:
            sheets[name]['painting'] = True
        jobs.append({'name': f'sheet.{name}', 'aspect': aspect, 'prompt': prompt})

    sheet('units_men', [4, 4], 'keyed', 320, False, 'units', '1:1', [i for i, _ in MEN],
          UNIT_HEAD.format(n='sixteen', grid='4 columns and 4 rows', scale='every man at the same height and scale') + listing([d for _, d in MEN]) + UNIT_TAIL, uniform=1.0)
    sheet('units_beasts', [4, 4], 'keyed', 320, False, 'units', '1:1', [i for i, _ in BEASTS],
          UNIT_HEAD.format(n='sixteen', grid='4 columns and 4 rows', scale='each creature filling its cell big or small, creatures that live in water rising from a small round splash that stays inside the cell') + listing([d for _, d in BEASTS]) + UNIT_TAIL)
    sheet('units_legends', [2, 1], 'keyed', 512, False, 'units', '16:9', [i for i, _ in LEGENDS],
          UNIT_HEAD.format(n='two', grid='2 columns and 1 row', scale='each creature huge and filling its cell, rising from a splash that stays inside the cell') + listing([d for _, d in LEGENDS]) + UNIT_TAIL)
    for k in range(4):
        part = SPELLS[k * 16:(k + 1) * 16]
        sheet(f'spells_{k + 1}', [4, 4], 'tiles', 192, True, 'icons', '1:1', [f'icon.sp_{i}' for i, _ in part],
              SPELL_HEAD + listing([d for _, d in part]) + SPELL_TAIL)
    sheet('battle_props', [4, 4], 'keyed', 256, False, 'props', '1:1', [i for i, _ in PROPS],
          PROP_HEAD + listing([d for _, d in PROPS]) + PROP_TAIL)
    for fid, desc in FIELDS:
        jobs.append({'name': fid, 'aspect': '16:9', 'prompt': FIELD_HEAD + desc + '.' + FIELD_TAIL})

    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    for j in jobs:
        print(f"{j['name']:28} {j['aspect']:5} {len(j['prompt'])}")


if __name__ == '__main__':
    main()
