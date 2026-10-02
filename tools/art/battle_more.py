"""The rest of the battle's art (owner, 2026-10-02: «под каждый корабль своё поле, в проекции как герои; сеты иконок для
заклинаний, книги и так далее»): a deck for every hull, the night sea round them, the captain's spell book, the
battle's command and status icons, the effects and the missiles — and the whole painting queue in its order.

    python tools/art/battle_more.py     # sheets into tools/art/sheets.json; the full queue into assets/raw/q_all.json

A deck is half the boarding field: one ship's midship deck, bow at the top, her rail down the picture's right side; the
game lays the boarders' deck on the left and the other ship's, mirrored, on the right, the sea between. Effects are
painted on black (they are added onto the field as light); the missiles are keyed off magenta like the figures.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
OUT = os.path.join(ROOT, 'assets', 'raw', 'q_all.json')

NO_TEXT = 'NO text, NO letters, NO numbers, NO symbols, NO frames, NO borders, NO watermark.'

DECK_HEAD = ('Painted battlefield background for a turn-based hex battle in a dark Pirate Gothic game, in the style of the battle screens '
             'of Heroes of Might and Magic III but grim and realistic. The open weather deck of ONE ship — {ship} — seen from high above '
             'at a steep angle, about 60 degrees down, looking along a straight midship section of the deck from the stern toward the bow, '
             'so that both rails run straight and parallel down the picture: the bow end at the TOP of the picture, the stern end at the '
             'BOTTOM. The deck fills the whole picture from edge to edge. The ship\'s starboard rail — a heavy timber bulwark — runs straight '
             'down along the RIGHT edge of the picture, a thin strip of dark night sea beyond it; the port rail runs straight down along the '
             'LEFT edge. The planks run lengthwise from top to bottom. The middle of the deck, at least four fifths of the picture, is open, '
             'flat, evenly lit and uncluttered: wet worn planks with only flat details lying in the deck — seams, nail heads, a flush hatch '
             'grating, ring bolts, a coil of rope, scattered straw. NO masts, NO cannons, NO barrels, NO crates, NO people anywhere on the '
             'open deck. Along the two rails only: ')
DECK_TAIL = ('. Night: warm light from lanterns hung on the rails, a cool moonlight sheen on the wet planks. Muted palette: charcoal, '
             'weathered brown oak, tar black, rust, old brass, cold blue-grey; low saturation with small warm highlights. ' + NO_TEXT +
             ' Avoid: cartoon, anime, a flat top-down map, a side view, a perspective vanishing far into the distance, people, figures, '
             'bright colours.')
DECKS = [
    ('sloop', 'a small fast pirate sloop', 'a narrow deck of pale weathered pine, a low rail, a pair of small swivel-gun posts and belaying pins'),
    ('cutter', 'a lean naval cutter', 'light grey planks, a low rail with a row of belaying pins, a coiled anchor cable'),
    ('schooner', "a smuggler's schooner", 'dark tarred planks, a low rail lined with bundles of fishing nets and small kegs half hidden under tarpaulins'),
    ('brigantine', 'a raider brigantine', 'warm brown planks scarred by old fights, racks of boarding pikes and grapnels on the rails'),
    ('fluyt', 'a broad merchant fluyt', 'wide pale planks, cargo nets and lashed bales against the rails, a big cargo hatch grating just inside the top edge'),
    ('brig', 'a sturdy gun brig', 'dark oak planks, a high bulwark with closed gun ports and coiled cannon tackle along both rails'),
    ('frigate', 'a naval frigate', 'clean scrubbed planks, a high bulwark painted black with a yellow-ochre band, closed gun ports and rolled hammocks in nettings along both rails'),
    ('galleon', 'a treasure galleon', 'broad dark planks, a high carved bulwark with faded gilt and dark red paint, a carved stair rail at the bottom edge rising toward the stern castle'),
    ('man_o_war', 'a great ship of the line', 'wide pale planks, a massive high bulwark painted black and buff with closed gun ports, heavy brass fittings, fire buckets in a rack'),
    ('ghost_ship', 'a ghost ship', 'rotten grey planks with gaps between them, kelp and barnacles on the broken rails, a pale green mist pooling low, tattered rope'),
    ('xebec', 'a corsair xebec', 'a narrow deck of honey-coloured planks, rails painted with faded red and blue geometric patterns, long oars stowed along both rails'),
    ('bomb_ketch', 'a bomb ketch', 'heavy reinforced dark planks crossed by iron bands, racks of round black mortar shells against the rails'),
    ('fireship', 'a fireship', 'tar-blackened scorched planks, bundles of brushwood and barrels of pitch lashed along the rails'),
    ('fishing_ketch', 'a fishing ketch', 'worn grey planks, nets heaped along the rails, wicker fish baskets, cork floats and a gaff'),
    ('harpoon_whaler', 'a whaling ship', 'greasy dark planks, harpoons and lances racked along the rails, coils of whale line in tubs, the brick try-works furnace just inside the top edge'),
]

SEA = ('Painted background for a turn-based battle in a dark Pirate Gothic game, in the style of the battle screens of Heroes of Might '
       'and Magic III but grim and realistic: the open sea at night seen from high above at a steep angle, filling the whole picture '
       'edge to edge — long dark swells, lines of white foam, a cold moonlight sheen on the water, a few drifting splinters and a torn '
       'rope; no ships, no land, no horizon, no sky, nothing standing out in the middle. Muted palette: black-green, slate, cold '
       'blue-grey, foam white. ' + NO_TEXT + ' Avoid: cartoon, bright Caribbean turquoise, a sunny sky.')

BOOK = ("An old captain's grimoire lying open on a dark wooden table, seen from directly above and filling most of the picture: two large "
        'facing pages of aged cream parchment with stains and foxing, COMPLETELY BLANK — no writing, no letters, no symbols, no drawings '
        'on them; a worn black leather cover with tarnished brass corners and clasps around the pages; three ribbon bookmarks (dark red, '
        'sea green, faded blue) hanging out at the bottom; warm candlelight from the upper left, the table edges in shadow. ' + NO_TEXT +
        ' Avoid: cartoon, flat vector, bright colours, any writing on the pages.')

ICON_HEAD = ('Sheet of sixteen square game icons for a dark Pirate Gothic turn-based battle game, in the painterly style of the icons of '
             'Heroes of Might and Magic III and World of Warcraft but grim and realistic, laid out in a strict 4 by 4 grid of equal square '
             'tiles separated by thin pure black gutters. Each tile is its own icon: one object or scene filling the tile edge to edge on a '
             'dark painted background, a strong focal point readable at small size, rich painted detail, the same lighting and finish across '
             'all sixteen. The icons, left to right and top to bottom: ')
ICON_TAIL = (' Muted palette: charcoal, graphite, cold blue-grey, dirty silver, old brass, very dark burgundy, with small warm highlights. '
             'NO frames, NO borders inside the tiles, NO text, NO letters, NO numbers, NO watermark. Avoid: cartoon, flat vector, emoji, '
             'cel shading, thick outlines, bright saturated colours, blood, gore, skeletons.')
COMMANDS = [
    ('icon.bt_book', 'a closed black leather grimoire with tarnished brass corners and a clasp'),
    ('icon.bt_wait', 'a brass-and-dark-wood hourglass, its sand running'),
    ('icon.bt_defend', 'a round iron-bound buckler raised before a cutlass'),
    ('icon.bt_auto', "two crossed cutlasses over a brass ship's wheel"),
    ('icon.bt_quick', 'two worn dice tumbling on a drumhead'),
    ('icon.bt_retreat', "a small rowing boat pulling away from a ship's dark side"),
    ('icon.bt_strike', 'a tattered white flag on a broken spar'),
    ('icon.bt_ransom', 'a heavy leather purse spilling silver coins'),
    ('icon.bt_order', 'a brass speaking trumpet'),
    ('icon.school_corsair', 'two crossed flintlock pistols over a burst of powder flame'),
    ('icon.school_smuggler', 'a shuttered lantern glowing faintly in grey fog'),
    ('icon.school_reaver', 'a notched great axe wrapped in a dark red sash'),
    ('icon.school_navigator', 'a brass compass rose with a sextant'),
    ('icon.school_drowned', 'a rusted anchor wound with kelp sinking into dark water'),
    ('icon.school_admiral', 'a gold-hilted sword over a navy-blue pennant'),
    ('icon.school_common', "a captain's black tricorne with a grey feather on a coil of rope"),
]
STATUSES = [
    ('icon.st_poison', 'a drop of green venom running down a dagger blade'),
    ('icon.st_terror', 'a pale face with wide staring eyes in darkness'),
    ('icon.st_fear', 'a trembling hand letting a sword fall'),
    ('icon.st_regen', 'a wound closing under a wash of silver sea water'),
    ('icon.st_shell', 'a heavy armoured crab shell'),
    ('icon.st_marked', 'a chalk cross target drawn on a dark plank'),
    ('icon.st_blind', 'a dark cloth blindfold'),
    ('icon.st_burning', 'flames licking up a scorched plank'),
    ('icon.st_morale_up', 'a black pirate flag raised high and streaming in the wind'),
    ('icon.st_morale_down', 'a torn flag drooping from a broken staff'),
    ('icon.st_luck_up', 'a gold doubloon standing on its edge, spinning'),
    ('icon.st_luck_down', 'a cracked hand mirror'),
    ('icon.st_again', 'an hourglass inside a circling arrow of rope'),
    ('icon.st_no_ret', 'a sword broken across a shield'),
    ('icon.st_braced', 'boots planted on a deck behind a raised shield'),
    ('icon.st_diving', 'a dark dorsal fin cutting through the water'),
]

FX_HEAD = ('Visual effect animation sheet for a dark Pirate Gothic turn-based battle game, painted in the style of the battle effects of '
           'Heroes of Might and Magic III: exactly FOUR frames of ONE effect side by side in ONE horizontal row, evenly spaced with wide '
           'empty gaps between them so that no two touch, each frame the same size, the effect growing and fading from left to right like '
           'four frames of one animation: ')
FX_TAIL = (' Background: pure black (RGB 0, 0, 0) everywhere, so the effect can be added onto the battlefield as light. ' + NO_TEXT +
           ' NO dividing lines, NO panels. Avoid: cartoon, flat vector, thick outlines.')
FX = [
    ('fx.bt_blast', 'a gunpowder explosion — first a small white-hot flash, then a ball of orange fire, then fire breaking into dark smoke and sparks, then thin grey smoke and a few embers'),
    ('fx.bt_muzzle', 'a musket muzzle flash pointing right — first a sharp yellow-white flash, then a cone of orange flame and white smoke, then a puff of grey smoke, then thin drifting smoke'),
    ('fx.bt_fire', 'flames burning on a deck, a looping fire — four slightly different shapes of the same tall orange-yellow flames with sparks'),
    ('fx.bt_splash', 'a splash of sea water — first a small white spout, then a tall burst of white foam and droplets, then falling spray, then a fading ring of foam'),
    ('fx.bt_heal', 'a healing tide — first a few silver motes, then a swirl of pale silver-blue water light rising, then bright silver sparkles, then fading motes'),
    ('fx.bt_deep', 'a call of the deep — first a dim turquoise ripple, then a swirling vortex of dark turquoise light, then pale hands of water light rising, then a fading turquoise glow'),
    ('fx.bt_poison', 'a cloud of poison — first a small green puff, then a spreading sickly green-yellow vapour, then a thick drifting cloud, then thin fading wisps'),
    ('fx.bt_lightning', 'a lightning strike — first a thin bright fork from above, then a blinding white-blue bolt with branches, then crackling remnants, then a faint blue afterglow'),
]

MISSILE_HEAD = ('Game sprite sheet of sixteen small separate battle missiles for a dark Pirate Gothic turn-based battle game, painted in the '
                'style of Heroes of Might and Magic III, laid out in a strict grid of 4 columns and 4 rows, each one centred in its own '
                'equal cell, every missile flying toward the RIGHT, seen from the side, with wide even gaps between the cells so that no '
                'two touch. Left to right, top to bottom: ')
MISSILE_TAIL = (' Background: flat, fully saturated pure magenta #FF00FF (RGB 255, 0, 255) everywhere, uniform, no gradient, NO cast '
                'shadows. ' + NO_TEXT + ' Avoid: cartoon, flat vector, thick outlines, bright saturated colours.')
MISSILES = [
    ('part.ms_ball', 'a lead musket ball with a short grey smoke trail'),
    ('part.ms_cannonball', 'a black iron cannonball with a short smoke trail'),
    ('part.ms_chain', 'chain shot: two iron balls joined by a chain'),
    ('part.ms_grenade', 'a round black grenade with a sparking fuse'),
    ('part.ms_harpoon', 'a barbed iron harpoon trailing a rope line'),
    ('part.ms_knife', 'a thrown knife'),
    ('part.ms_flask', 'a corked glass flask of dark liquid tumbling'),
    ('part.ms_arrow', 'an arrow with grey fletching'),
    ('part.ms_dart', 'a small blowgun dart with a tuft'),
    ('part.ms_stone', 'a sling stone'),
    ('part.ms_rocket', 'an iron war rocket on a stick with a burst of sparks behind'),
    ('part.ms_net', 'a weighted fishing net flying open'),
    ('part.ms_spear', 'a wooden spear with a shark-tooth tip'),
    ('part.ms_brine', 'a bolt of pale green-grey brine light'),
    ('part.ms_smokebomb', 'a round clay smoke bomb trailing grey smoke'),
    ('part.ms_bell', 'a small ring of rippling air from a conch, seen edge-on'),
]


def listing(rows):
    return ' '.join(f'{i + 1}. {r}.' for i, r in enumerate(rows))


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []

    def sheet(name, grid, mode, px, square, out_dir, aspect, ids, prompt, **extra):
        old = sheets.get(name, {})
        sheets[name] = {'grid': grid, 'mode': mode, 'px': px, 'square': square, 'dir': out_dir, 'aspect': aspect, 'ids': ids, 'prompt': prompt, **extra}
        if old.get('cut'):
            sheets[name]['cut'] = old['cut']
        else:
            sheets[name]['painting'] = True
            jobs.append({'name': f'sheet.{name}', 'aspect': aspect, 'prompt': prompt})

    battle = {j['name']: j for j in json.load(open(os.path.join(ROOT, 'assets', 'raw', 'q_battle.json'), encoding='utf-8'))}
    creatures = json.load(open(os.path.join(ROOT, 'assets', 'raw', 'q_creatures.json'), encoding='utf-8'))
    single = lambda name, aspect, prompt: {'name': name, 'aspect': aspect, 'prompt': prompt}

    decks = [single(f'bg.deck_{sid}', '2:3', DECK_HEAD.format(ship=ship) + details + DECK_TAIL) for sid, ship, details in DECKS]
    sheet('bt_commands', [4, 4], 'tiles', 128, True, 'icons', '1:1', [i for i, _ in COMMANDS], ICON_HEAD + listing([d for _, d in COMMANDS]) + ICON_TAIL)
    sheet('bt_statuses', [4, 4], 'tiles', 96, True, 'icons', '1:1', [i for i, _ in STATUSES], ICON_HEAD + listing([d for _, d in STATUSES]) + ICON_TAIL)
    sheet('bt_missiles', [4, 4], 'keyed', 160, False, 'fx', '1:1', [i for i, _ in MISSILES], MISSILE_HEAD + listing([d for _, d in MISSILES]) + MISSILE_TAIL)
    ui = jobs[:]
    fx = [single(fid, '16:9', FX_HEAD + desc + '.' + FX_TAIL) for fid, desc in FX]

    # The order: the kinds already fighting (their animations) first, then the grounds they fight on, the orders and their
    # book, then the world's new kinds.
    in_game = [j for j in creatures if j['name'].split('anim_')[1] in IN_GAME]
    new = [j for j in creatures if j not in in_game]
    grounds = [battle[k] for k in ('bg.field_tropical', 'bg.field_rocky', 'bg.field_volcanic', 'bg.field_swamp', 'bg.field_graveyard', 'bg.field_dead', 'bg.field_fort')]
    spells = [battle[f'sheet.spells_{k}'] for k in range(1, 5)] + [battle['sheet.battle_props']]
    queue = in_game[:8] + [single('bg.battle_sea', '16:9', SEA)] + decks[:5] + in_game[8:20] + grounds + decks[5:] + in_game[20:] + spells + ui + [single('bg.spellbook', '16:9', BOOK)] + fx + new
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(queue, f, ensure_ascii=False)
    print(len(queue), 'jobs;', len(in_game), 'in-game kinds,', len(new), 'new kinds,', len(decks), 'decks')


IN_GAME = {'deckhand', 'sailor', 'marine', 'sea_guard', 'musketeer', 'sharpshooter', 'gunner', 'bombardier', 'boarder', 'cutthroat', 'guard',
           'life_guard', 'drowned', 'deep_spawn', 'crab', 'gull', 'seal', 'reef_shark', 'rock_turtle', 'sea_turtle', 'marsh_serpent', 'hermit',
           'lagoon_tentacle', 'mermaid', 'cultist', 'surf_drowned', 'young_serpent', 'lantern_maw', 'ancient_turtle', 'shoal_leviathan',
           'white_whale', 'young_kraken'}

if __name__ == '__main__':
    main()
