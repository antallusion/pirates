"""The fleet of eighty (owner, 2026-10-03: «80 разных кораблей: 20 боевых, 20 торговых, 20 быстрых, 20 медленных, но с большой
вместимостью; по 10 из каждого списка — премиум, с уникальными фишками: особая способность, уникальные существа для этого
корабля»). The fourteen sailable hulls already in the game stand in the four lists; these are the sixty-six new ones, each
with its list, tier, whether it is premium (sold for the premium currency), its names and how it is painted — the top-down
sprite on the sea (four to a sheet, cut like the creatures') and the deck its men fight on (one painting each).

    python tools/art/ships.py      # sheets into tools/art/sheets.json, ChatGPT jobs into assets/raw/q_ships.json

The game's side (stats, abilities, unique creatures, prices) is shared/src/data/ships.ts and friends; this file only paints.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_ships.json')

# The hulls already sailing, by list (ghost_ship is the Dutchman's alone and stands in none).
EXISTING = {
    'combat': ['brig', 'frigate', 'man_o_war', 'bomb_ketch', 'fireship'],
    'trade': ['fluyt', 'fishing_ketch', 'harpoon_whaler'],
    'fast': ['sloop', 'cutter', 'schooner', 'brigantine', 'xebec'],
    'hauler': ['galleon'],
}

S = []


def s(sid, cat, tier, premium, en, ru, look, deck_ship, deck_details):
    S.append({'id': sid, 'cat': cat, 'tier': tier, 'premium': premium, 'en': en, 'ru': ru, 'look': look, 'deck_ship': deck_ship, 'deck': deck_details})


# ---- Combat: fifteen new (ten premium) ----------------------------------------------------------------------------------
s('gunboat', 'combat', 1, False, 'Gunboat', 'Канонерка', 'a small single-masted gunboat, a short broad hull with one heavy long gun on a slide at the bow and a gaff sail', 'a small gunboat', 'a heavy long gun on its slide just inside the top edge, shot racks and rammers along the rails')
s('war_galley', 'combat', 2, False, 'War Galley', 'Боевая галера', 'a long narrow war galley with two lateen sails, rows of long oars along both sides and a bronze ram at the bow', 'a war galley', 'rowing benches along both rails with long oars shipped inboard, a bronze ram fitting just inside the top edge')
s('corvette', 'combat', 3, False, 'Corvette', 'Корвет', 'a sleek three-masted corvette, ten guns a side on a single flush deck, square sails', 'a naval corvette', 'a low black bulwark with closed gun ports, neat coils of cannon tackle and a row of water buckets')
s('razee', 'combat', 4, False, 'Razee', 'Разе', 'a razee — a cut-down ship of the line with a flush upper deck, very heavy guns along both sides and three tall masts', 'a cut-down heavy warship', 'a thick bulwark scarred by old shot, very heavy closed gun ports and heaps of chain along the rails')
s('ship_of_the_line', 'combat', 5, False, 'Ship of the Line', 'Линейный корабль', 'a 74-gun two-decker ship of the line, a long massive hull with two rows of guns and three tall masts of square sails', 'a ship of the line', 'a towering bulwark painted black and ochre, rows of closed gun ports, fire buckets and rolled hammocks in nettings')
s('black_corsair', 'combat', 4, True, 'Black Corsair', 'Чёрный корсар', 'a lean black-hulled corsair frigate with deep crimson sails, gilded black stern carving and a fanged black figurehead', 'a black corsair frigate', 'a black lacquered bulwark with thin gold trim, crimson rope, racks of cutlasses and pistols along the rails')
s('dragon_junk', 'combat', 3, True, 'Dragon Junk', 'Драконья джонка', 'an eastern battle junk with ribbed batten sails of dark red, a high stern and a carved dragon-head prow, fire-lance tubes along its rails', 'an eastern battle junk', 'dark red lacquered rails carved with dragons, racks of fire lances and bamboo rocket tubes, paper lanterns (unlit)')
s('iron_ram', 'combat', 4, True, 'Iron Ram', 'Железный таран', 'a heavy ram ship whose bow is sheathed in riveted black iron ending in a huge iron ram, two masts, iron plates along the waterline', 'an iron-bowed ram ship', 'iron plates riveted along both rails, heavy chain and grapnels, the iron-sheathed bow rising just inside the top edge')
s('thunderer', 'combat', 4, True, 'Thunderer', 'Громовержец', 'a dark frigate with tall copper lightning rods on every masthead, copper-sheathed rails and storm-grey sails', 'a storm frigate', 'copper-sheathed rails with copper lightning chains running down them into the sea, coiled copper wire, rain-wet planks')
s('wyvern_galleass', 'combat', 5, True, 'Wyvern Galleass', 'Галеас «Виверна»', 'a great galleass with three lateen-rigged masts, banks of oars along both sides, a heavy gun platform at the bow and a carved winged wyvern figurehead', 'a great galleass', 'banks of oars stowed along both rails, a heavy gun platform at the top edge, a carved wyvern wing along the rail')
s('kraken_hunter', 'combat', 5, True, 'Kraken Hunter', 'Охотник на кракенов', 'a heavy warship-whaler with harpoon cannons along both sides, a reinforced iron-banded hull and tentacle-scarred planking', 'a kraken-hunting warship', 'harpoon cannons on swivels along both rails, huge coils of iron chain line, giant scarred planks')
s('crimson_tide', 'combat', 5, True, 'Crimson Tide', 'Багровый прилив', 'a three-decker flagship with blood-red sails, a towering carved stern castle in black and red and a hundred guns', 'a pirate flagship', 'a towering black and dark red carved bulwark, heavy closed gun ports, captured flags folded on the rails')
s('phantom_brig', 'combat', 3, True, 'Phantom Brig', 'Бриг-фантом', 'a pale ghostly brig with torn translucent grey sails and weathered silver-grey timbers, wisps of mist clinging to its rigging', 'a phantom brig', 'pale weathered silver-grey planks, wisps of low mist along the rails, torn grey canvas and old rusted chains')
s('storm_reaver', 'combat', 4, True, 'Storm Reaver', 'Штормовой рейвер', 'a brutal raider brig with spiked iron bulwarks, a beak-shaped boarding bridge at the bow and dark sails painted with a jagged white stripe', 'a raider brig', 'spiked iron-capped bulwarks, folded boarding bridges and grapnels, racks of axes along both rails')
s('sun_galleon', 'combat', 5, True, 'Sun Galleon', 'Солнечный галеон', 'a gilded war galleon of the Crown, a high castle stern covered in carved golden suns, white and gold sails and many guns', 'a gilded war galleon', 'a gilded carved bulwark with golden suns, polished brass fittings, closed gun ports and the Crown\'s pennants furled on the rails')
# ---- Trade: seventeen new (ten premium) ---------------------------------------------------------------------------------
s('tartane', 'trade', 1, False, 'Tartane', 'Тартана', 'a small Mediterranean tartane with one big lateen sail and a small jib, a short beamy hull full of crates', 'a small tartane', 'stacked crates and wine casks lashed along both rails, a small hatch near the top edge')
s('hoy', 'trade', 1, False, 'Hoy', 'Гой', 'a stubby coastal hoy with a single gaff-rigged mast and leeboards on both sides', 'a coastal hoy', 'sacks of grain and lashed bales along both rails, a leeboard winch')
s('pinnace', 'trade', 1, False, 'Pinnace', 'Пинас', 'a light two-masted pinnace with square sails, a narrow hull and a small stern cabin', 'a light pinnace', 'barrels and rolled sailcloth along both rails, a small cargo hatch')
s('snow', 'trade', 2, False, 'Snow', 'Шнява', 'a two-masted snow, square-rigged on both masts with a small trysail mast behind the mainmast, a roomy merchant hull', 'a merchant snow', 'cargo nets of bales and casks along both rails, a broad hatch grating near the top edge')
s('barque', 'trade', 2, False, 'Barque', 'Барк', 'a three-masted barque, square-rigged fore and main with a fore-and-aft mizzen, a deep broad merchant hull', 'a merchant barque', 'casks and crates in cargo nets along the rails, a big cargo boom and tackle')
s('carrack', 'trade', 3, False, 'Carrack', 'Каррака', 'a carrack with a tall rounded forecastle and stern castle, three masts with square and lateen sails, a deep round hull', 'a merchant carrack', 'carved dark wooden rails, heaped spice sacks and chests along both sides')
s('east_indiaman', 'trade', 4, False, 'East Indiaman', 'Ост-индиец', 'a big East Indiaman, a heavy armed merchant ship with three tall masts, a gilded stern gallery and a few guns', 'an East Indiaman', 'tea chests and bolts of cloth lashed along the rails, a few closed gun ports, brass fittings')
s('golden_carrack', 'trade', 4, True, 'Golden Carrack', 'Золотая каррака', 'a richly gilded carrack whose castles are covered in gold leaf and carvings, cream and gold sails, chests of treasure on deck', 'a gilded carrack', 'gilded carved rails, iron-bound treasure chests and gold-trimmed bales along both sides')
s('spice_dhow', 'trade', 2, True, 'Spice Dhow', 'Пряная доу', 'an Arabian dhow with two great triangular lateen sails of faded saffron, a sewn teak hull and bright patterned rugs over the cargo', 'a spice dhow', 'patterned rugs over bales, jars and sacks of spices, brass lamps (unlit) along both rails')
s('silk_junk', 'trade', 3, True, 'Silk Junk', 'Шёлковая джонка', 'an elegant trading junk with batten sails of dark blue silk, a painted eye on the bow and bolts of silk under awnings', 'a silk-trading junk', 'awnings over bolts of silk, lacquered chests and porcelain jars along both rails')
s('smugglers_lugger', 'trade', 2, True, "Smuggler's Lugger", 'Люггер контрабандиста', 'a low dark lugger with dark grey lug sails, painted almost black, with hidden hatches in its deck and blackened oars', 'a smuggler\'s lugger', 'blackened planks with hidden hatch seams, tarred kegs and muffled oars along the rails')
s('pearl_schooner', 'trade', 3, True, 'Pearl Schooner', 'Жемчужная шхуна', 'a graceful schooner with pale sails, diving stones and baskets of shells along its rails and a pearl-white hull', 'a pearl-diving schooner', 'baskets of oyster shells, diving stones on ropes and coiled lines along both rails')
s('floating_bazaar', 'trade', 4, True, 'Floating Bazaar', 'Плавучий базар', 'a broad trading barge with two masts and colourful striped awnings over market stalls all along its deck', 'a floating market barge', 'striped awnings over market stalls along both rails, hanging lanterns (unlit), baskets and carpets')
s('rum_runner', 'trade', 2, True, 'Rum Runner', 'Ромовый бегун', 'a fast two-masted merchant schooner loaded with rum barrels lashed under nets, dark sails and a slender hull', 'a rum-running schooner', 'rows of rum barrels lashed under nets along both rails, funnels and a tasting cup on a hook')
s('ledger_galleon', 'trade', 4, True, 'Ledger Galleon', 'Галеон-гроссбух', 'a dark galleon of the Brokers with a black and silver hull, iron strongboxes on deck and the stern carved as a giant open ledger', 'a Brokers\' galleon', 'iron strongboxes chained along both rails, a writing desk by the rail, black and silver trim')
s('tea_clipper', 'trade', 3, True, 'Tea Clipper', 'Чайный клипер', 'a sleek tall clipper with a long sharp bow and a cloud of square sails on three tall raked masts, tea chests on deck', 'a tea clipper', 'stacked tea chests stencilled with shapes (no letters) along both rails, polished brass')
s('treasure_fluyt', 'trade', 3, True, 'Treasure Fluyt', 'Кладовая флейта', 'a pear-shaped fluyt with a reinforced iron-bound hull, a narrow upper deck and iron-barred hatches over its treasure hold', 'a treasure fluyt', 'iron-barred hatch gratings, chained coffers and padlocked chests along both rails')
# ---- Fast: fifteen new (ten premium) ------------------------------------------------------------------------------------
s('felucca', 'fast', 1, False, 'Felucca', 'Фелука', 'a narrow felucca with two lateen sails and a slim hull, light and quick', 'a felucca', 'a narrow light deck, coiled sheets and a few water jars along the rails')
s('lugger', 'fast', 1, False, 'Lugger', 'Люггер', 'a three-masted lugger with dark lug sails and a sharp narrow hull', 'a lugger', 'a light narrow deck, coiled lines and oars along the rails')
s('galiot', 'fast', 2, False, 'Galiot', 'Галиот', 'a small two-masted galiot with lateen sails and a bank of oars, low and quick', 'a galiot', 'oars stowed along both rails, a light swivel gun at each side')
s('topsail_schooner', 'fast', 2, False, 'Topsail Schooner', 'Марсельная шхуна', 'a two-masted topsail schooner with a square topsail on the foremast, raked masts and a sleek hull', 'a topsail schooner', 'neat coiled lines and light guns along the rails, a slim deck')
s('baltimore_clipper', 'fast', 3, False, 'Baltimore Clipper', 'Балтиморский клипер', 'a sharp Baltimore clipper with two steeply raked masts, a long low hull and huge fore-and-aft sails', 'a Baltimore clipper', 'a low sleek deck, light guns and coiled sheets along both rails')
s('sea_hawk', 'fast', 3, True, 'Sea Hawk', 'Морской ястреб', 'a slender raider schooner with dark sails painted with a hawk\'s wing pattern and a carved hawk figurehead', 'a hawk-prowed raider', 'a sleek dark deck, light guns and hawk-feather carvings on the rails')
s('wind_dancer', 'fast', 2, True, 'Wind Dancer', 'Танцующая с ветром', 'an elegant sloop with a huge sail plan of pale grey sails, a delicate carved hull and fluttering long pennants', 'a racing sloop', 'polished light planks, long pennants tied to the rails, coiled racing lines')
s('shark_cutter', 'fast', 2, True, 'Shark Cutter', 'Акулий катер', 'a lean cutter whose bow is carved like a shark\'s jaw with rows of white teeth, grey sails with a fin-shaped stripe', 'a shark-jawed cutter', 'grey-painted rails with shark-fin carvings, chum barrels and gaffs along both sides')
s('ghost_clipper', 'fast', 4, True, 'Ghost Clipper', 'Призрачный клипер', 'a pale clipper with thin translucent grey sails that seem to drift like mist and pale silver-grey timbers', 'a ghostly clipper', 'pale silver-grey planks, mist pooling along the rails, faint pale lanterns (unlit)')
s('flying_fish', 'fast', 1, True, 'Flying Fish', 'Летучая рыба', 'a tiny swift sloop with wide wing-like sails spread to both sides like a flying fish\'s fins, a blue-grey hull', 'a tiny swift sloop', 'a narrow blue-grey deck, wing-like booms along both rails, coiled lines')
s('albatross_xebec', 'fast', 3, True, 'Albatross', 'Альбатрос', 'a long xebec with three huge white-grey lateen sails like albatross wings and a carved albatross figurehead', 'an albatross-winged xebec', 'honey-coloured planks, carved feathers along the rails, long oars stowed')
s('silver_arrow', 'fast', 4, True, 'Silver Arrow', 'Серебряная стрела', 'a very long narrow clipper with a silver-sheathed hull, a needle-sharp bow and towering raked masts', 'a silver-sheathed clipper', 'a long narrow deck of pale planks, silver-sheathed rails, neat coiled lines')
s('storm_petrel', 'fast', 3, True, 'Storm Petrel', 'Буревестник', 'a dark brigantine built for storms with storm sails of black canvas, a reinforced bow and a petrel figurehead', 'a storm brigantine', 'wet black planks, storm sails folded on the rails, lifelines strung along both sides')
s('mermaid_grace', 'fast', 2, True, "Mermaid's Grace", 'Милость русалки', 'a graceful schooner with sea-green sails, a mermaid figurehead and shells and pearls set into its rails', 'a mermaid-prowed schooner', 'sea-green painted rails set with shells and pearls, nets of kelp and a small pool tank near the top edge')
s('viper', 'fast', 3, True, 'Viper', 'Гадюка', 'a sleek black galley-raider with a single lateen sail, oars along both sides and a carved serpent head at the bow', 'a serpent-headed raider', 'black planks, oars stowed along both rails, a carved serpent coiling along the rail')
# ---- Haulers, slow and roomy: nineteen new (ten premium) ----------------------------------------------------------------
s('cog', 'hauler', 1, False, 'Cog', 'Когг', 'a round-bellied cog with a single square sail, high clinker-built sides and small castles fore and aft', 'a round cog', 'heaped sacks and barrels along both high rails, a big hatch')
s('buss', 'hauler', 1, False, 'Herring Buss', 'Бусс', 'a broad herring buss with three short masts and a deep beamy hull full of barrels', 'a herring buss', 'rows of herring barrels and salt sacks along both rails')
s('pink', 'hauler', 2, False, 'Pink', 'Пинка', 'a pink with a narrow high stern, three masts and a broad round cargo hull', 'a pink', 'cargo nets of bales and casks along the rails, a big hatch grating')
s('hulk', 'hauler', 2, False, 'Hulk', 'Хольк', 'a massive round-ended hulk with high sides, three short masts and a huge cargo hold', 'a hulk', 'high plain rails with heaped cargo, a huge hatch grating near the top edge')
s('collier', 'hauler', 2, False, 'Collier', 'Угольщик', 'a blunt, flat-bottomed collier with three masts, a black sooty hull and heaps of coal sacks', 'a collier', 'heaps of coal sacks and coal dust on the planks along the rails, shovels and baskets')
s('storeship', 'hauler', 3, False, 'Storeship', 'Транспорт', 'a deep naval storeship with three masts and few guns, its deck crowded with stores', 'a naval storeship', 'crates of stores, spare spars and rolled sails lashed along both rails')
s('cargo_frigate', 'hauler', 3, False, 'Cargo Frigate', 'Грузовой фрегат', 'a frigate converted to carry cargo, its gun deck turned into hold, three masts and a broad hull', 'a cargo frigate', 'closed gun ports, heaped cargo nets and barrels along the rails')
s('plate_galleon', 'hauler', 4, False, 'Plate Galleon', 'Серебряный галеон', 'a huge plate galleon with a towering stern castle, four masts and a deep hull for silver', 'a plate galleon', 'a carved high bulwark, iron-bound silver chests along both rails')
s('great_galleon', 'hauler', 5, False, 'Great Galleon', 'Великий галеон', 'an enormous four-masted great galleon with three decks of hold, towering castles fore and aft', 'a great galleon', 'a towering carved bulwark, heaped cargo and spare spars along both rails')
s('leviathan_ark', 'hauler', 5, True, 'Leviathan Ark', 'Ковчег левиафана', 'a colossal ark-ship with a vast broad hull, great sea-water pens in its open deck where young sea creatures swim, four masts', 'a colossal ark', 'great timber pens of sea water along both rails, feeding buckets and nets')
s('turtle_barge', 'hauler', 4, True, 'Turtle Barge', 'Черепаховая баржа', 'a broad barge built on the back of a colossal ancient sea turtle\'s shell, timber decks and a mast set into the shell', 'a turtle-shell barge', 'the ridged edge of a giant turtle shell forming both rails, ropes and cargo lashed to it')
s('floating_fortress', 'hauler', 5, True, 'Floating Fortress', 'Плавучая крепость', 'a huge square-ish floating fortress-ship with stone-grey battlements, corner towers with guns and two stubby masts', 'a floating fortress', 'grey stone-like battlements along both rails, gun embrasures and stacked cannonballs')
s('menagerie', 'hauler', 4, True, 'Menagerie', 'Зверинец', 'a big galleon with iron-barred cages for strange creatures along its deck and canvas awnings over them', 'a menagerie galleon', 'iron-barred cages with straw along both rails, feeding pails and chains')
s('whale_mother', 'hauler', 5, True, 'Whale Mother', 'Китовая матка', 'a colossal whaling mothership with try-works furnaces, whale boats hung on davits all around and five masts', 'a whaling mothership', 'whale boats on davits along both rails, coils of line in tubs, try-works furnace at the top edge')
s('coral_hulk', 'hauler', 4, True, 'Coral Hulk', 'Коралловый хольк', 'a massive old hulk overgrown with living coral and sea anemones in pink and orange, kelp hanging from its yards', 'a coral-grown hulk', 'living coral and anemones growing along both rails, kelp-hung ropes, tide pools in the planks')
s('drowned_cathedral', 'hauler', 5, True, 'Drowned Cathedral', 'Утонувший собор', 'a vast ship of the Choir built like a drowned cathedral, gothic spires on its castles, stained-glass stern windows and bells in its rigging', 'a cathedral ship', 'gothic carved rails with niches, tarnished bells and dripping candles (unlit), dark stone-grey planks')
s('treasure_junk', 'hauler', 4, True, 'Treasure Junk', 'Сокровищница-джонка', 'a gigantic treasure junk with nine batten-sailed masts, a towering stern and painted red and gold hull', 'a treasure junk', 'red lacquered rails, chests of porcelain and jade, lanterns (unlit)')
s('pirate_haven', 'hauler', 5, True, 'Pirate Haven', 'Пиратская гавань', 'a floating pirate town built on a huge old hull — shacks, a tavern with a crooked chimney, rope bridges and three masts', 'a floating pirate town', 'ramshackle shacks and a tavern door along both rails, rope bridges, barrels and bunting')
s('iron_whale', 'hauler', 5, True, 'Iron Whale', 'Железный кит', 'a colossal iron-plated whale-shaped hull with riveted plates, small square sails on four masts and a gaping whale-mouth bow', 'an iron-plated whale ship', 'riveted iron plates along both rails, heavy chain and huge iron hatches')

# ---- The lines made whole (owner, 2026-10-04: «еще больше … кораблей»; docs/20 §6): eight silver hulls ------------
# where a list had none of its own. Kept apart from S, so the sixty-six's sheets keep their numbers: tools/art/fleet_next.py
# paints them on sheets of their own (ships_19, ships_20) and their decks, in the words of sprite_prompt and deck_prompt.
NEXT = []


def s_next(sid, cat, tier, en, ru, look, deck_ship, deck_details):
    NEXT.append({'id': sid, 'cat': cat, 'tier': tier, 'premium': False, 'en': en, 'ru': ru, 'look': look, 'deck_ship': deck_ship, 'deck': deck_details})


s_next('polacre', 'fast', 4, 'Polacre', 'Полакр', 'a Mediterranean polacre with three single-spar pole masts — square sails on the main, big lateen sails on the fore and mizzen — and a slim low hull', 'a Mediterranean polacre', 'coiled halyards at the foot of the pole masts along the rails, light guns and water jars')
s_next('dunkirk_frigate', 'fast', 4, 'Dunkirk Frigate', 'Дюнкеркский фрегат', 'a long, low, lightly built privateer frigate with three raked masts of square sails, a single row of light guns along its open deck and a sharp narrow bow', 'a privateer frigate', 'a long row of light guns behind closed ports along both rails, grapnels and boarding pikes in racks')
s_next('great_xebec', 'fast', 5, 'Great Xebec', 'Большая шебека', 'a large three-masted war xebec with three huge lateen sails, a long overhanging bow and stern, rows of long oars along both sides and many guns', 'a great war xebec', 'long oars stowed along both rails between light guns, a raised gun platform at the bow just inside the top edge')
s_next('race_galleon', 'fast', 5, 'Race-built Galleon', 'Низкобортный галеон', 'a long race-built galleon with low cut-down castles fore and aft, four masts with square sails and lateen mizzens, and a long slim hull', 'a race-built galleon', 'a low carved bulwark with closed gun ports, coiled sheets and lanterns (unlit) along both rails')
s_next('sloop_of_war', 'combat', 2, 'Sloop-of-War', 'Военный шлюп', 'a small ship-rigged sloop-of-war with three short masts of square sails, seven light guns along each side of its single deck and a plain black-and-ochre hull', 'a naval sloop-of-war', 'small guns behind closed ports along both rails, rammers and sponges in racks, a ship\'s bell just inside the top edge')
s_next('armed_fluyt', 'hauler', 3, 'Armed Fluyt', 'Вооружённый флейт', 'a pear-shaped fluyt with a narrow upper deck pierced for a few guns, three masts of square sails, a round stern and a deep broad hull', 'an armed fluyt', 'a few small guns behind closed ports along the rails, cargo nets of casks and bales between them, a big hatch near the top edge')
s_next('great_indiaman', 'trade', 5, 'Great Indiaman', 'Большой ост-индиец', 'a great three-masted East Indiaman of a thousand tons, a broad deep hull, a gilded stern gallery, a row of guns and cargo lashed on deck', 'a great East Indiaman', 'tea chests, bolts of cloth and spice sacks lashed along both rails between closed gun ports, polished brass fittings')
s_next('manila_galleon', 'trade', 5, 'Manila Galleon', 'Манильский галеон', 'a huge Manila galleon with a towering stern castle, four masts of square sails and a deep wide hull, bales of silk and crates of porcelain on deck', 'a Manila galleon', 'bales of silk, crates of porcelain and iron-bound silver chests along both rails, a carved high bulwark')

# ---- The third batch (owner, 2026-10-04: «еще больше … кораблей»): eight premium hulls, two a list ------------------
# where her list's premium choice was thinnest. Kept apart like NEXT: tools/art/fleet_b3.py paints them on sheets of
# their own (ships_21, ships_22) and their decks, in the words of sprite_prompt and deck_prompt.
B3 = []


def s_b3(sid, cat, tier, en, ru, look, deck_ship, deck_details):
    B3.append({'id': sid, 'cat': cat, 'tier': tier, 'premium': True, 'en': en, 'ru': ru, 'look': look, 'deck_ship': deck_ship, 'deck': deck_details})


s_b3('bulldog', 'combat', 1, 'Bulldog', 'Бульдог', 'a stubby, broad little gun-sloop with a single gaff-rigged mast, a heavy long gun on a slide at the bow, three small guns a side and iron-bound bulwarks bristling with short spikes', 'a stubby gun-sloop', 'iron-bound bulwarks with short iron spikes along both rails, a heavy long gun on its slide just inside the top edge, a coiled chain and a spiked iron collar hung on a peg')
s_b3('lantern_sampan', 'trade', 1, 'Lantern Sampan', 'Фонарный сампан', 'a small eastern river sampan with a single batten-ribbed sail, a curved woven bamboo cabin roof in the middle hung with red paper lanterns (unlit) and a long steering oar at the stern', 'an eastern river sampan', 'a woven bamboo cabin wall along the top edge hung with red paper lanterns (unlit), rice sacks, bundles of cloth and salt jars along both rails, two wooden bird perches')
s_b3('dolphin', 'fast', 1, 'Dolphin', 'Дельфин', 'a slim little felucca with two raked lateen sails, a narrow pale hull and a carved dolphin at the bow', 'a slim felucca', 'coiled lines and water jars along both rails, a carved dolphin figurehead just inside the top edge')
s_b3('saint_elmo', 'combat', 2, 'Saint Elmo', 'Святой Эльм', 'a navy brig-sloop with two masts of square sails, copper-sheathed masts gleaming, seven guns a side, a black-and-ochre hull and a small carved figure of a saint at the bow', 'a navy brig-sloop', 'closed gun ports along both rails, rammers and sponges in racks, copper sheathing at the foot of the mast just inside the top edge, a small carved shrine of a saint with unlit candles')
s_b3('mimic_barge', 'hauler', 2, 'Mimic Barge', 'Баржа мимиков', 'a broad, crooked old cargo barge with one stubby mast of square sail, an open hold heaped with oak barrels bound in iron hoops and a lopsided deckhouse at the stern', 'a crooked cargo barge', 'oak barrels and casks bound in rusted iron hoops stacked along both rails, a few of their lids slightly ajar, cargo nets and a big open hatch near the top edge')
s_b3('icebound_hulk', 'hauler', 3, 'Icebound Hulk', 'Ледяной халк', 'a broad northern hulk sheathed in pale blue ice, three masts of frost-white square sails, icicles hanging from her yards and rails and frost on her deck', 'an icebound northern hulk', 'rails crusted with pale blue ice and hanging icicles, frost on the planks near the rails, blocks of ice and frozen barrels along both rails')
s_b3('sailfish', 'fast', 5, 'Sailfish', 'Рыба-парус', 'a long, razor-bowed war frigate with a sharp narrow spur at the bow, a huge fan-shaped mainsail spread high like a sailfish\'s fin, square sails on the foremast, fifteen guns a side and a dark blue hull', 'a razor-bowed war frigate', 'a long row of closed gun ports along both rails, coiled sheets and grapnels, the foot of a huge mast with fan-shaped sail spars just inside the top edge')
s_b3('golden_lion', 'trade', 5, 'Golden Lion', 'Золотой лев', 'a great gilded merchant galleass with three tall lateen sails, a long hull with banks of long oars along both sides, a gilded winged-lion figurehead at the bow and a red-and-gold stern pavilion', 'a great merchant galleass', 'rowing benches with long oars shipped inboard along both rails, gilded carved rails, bales of silk and casks of wine, a furled red-and-gold banner just inside the top edge')

# The style every ship sprite shares (docs/06 §17.4, the sprite template, for ChatGPT on magenta).
SPRITE_STYLE = ('Every ship is viewed STRICTLY TOP-DOWN: an orthographic view from directly overhead at exactly 90 degrees, no perspective, '
                'no tilt, no visible hull sides; each ship\'s bow points straight UP to the top edge and its stern down, perfectly vertical '
                'and centred in its own quarter, filling most of the image height, its bowsprit and yard tips inside its quarter. Decks of '
                'dark wet tarred planks with hatches, coiled ropes, capstans and barrels; sails weathered and patched (dark grey-brown unless '
                'stated); near-black wet wood, rusted iron, tarnished old brass; lanterns unlit. Realistic, heavy, grounded Pirate Gothic, '
                'painterly; muted palette of charcoal, graphite, cold blue-grey, dirty silver, old brass and very dark burgundy. Neutral soft '
                'even light from overhead, no cast shadows. Solid flat magenta #FF00FF background: no water, no waves, no wake, no foam, no '
                'reflections, no border, no text, no letters.')

# No game is named in a prompt (owner, 2026-10-04): the painter takes a title for an edit of a picture it has not got.
LOOK = ('Painterly digital painting, grim and weathered, like the hand-painted battle screens of 1990s fantasy strategy games; '
        'muted palette: charcoal, tarred black wood, rust, old brass, faded red, cold blue-grey.')


def sprite_prompt(group):
    rows = ' '.join(f'{i + 1}) {x["look"]};' for i, x in enumerate(group))
    n = ['one', 'two', 'three', 'four'][len(group) - 1]
    part = 'quarter' if len(group) == 4 else 'third' if len(group) == 3 else 'half'
    style = SPRITE_STYLE if part == 'quarter' else SPRITE_STYLE.replace('its own quarter', f'its own {part}').replace('inside its quarter', f'inside its {part}')
    return (f'Draw a wide 3:2 image: a game sprite sheet of {n} different sailing ships side by side in one row, left to right, each '
            f'alone in its own {part} of the image with wide empty gaps between them: {rows} {style}')


def deck_prompt(x):
    return (f'Draw a tall 2:3 image: a painted game battlefield — the open main deck of {x["deck_ship"]}, seen from high above at a steep '
            'angle, the bow end at the top and the stern end at the bottom, the deck filling the whole picture, its two rails running '
            'straight down both sides with a sliver of dark night sea beyond the right rail. The middle of the deck is open and '
            'uncluttered — wet worn planks running top to bottom, a flush hatch grating, ring bolts, a coil of rope — with no masts, no '
            f'cannons, no barrels, no crates and no people in it; only along the rails: {x["deck"]}. Night, warm lantern light on the rails '
            f'and cool moonlight on the wet planks. {LOOK} No text, no letters, no frames.')


def groups():
    """Four to a sheet, the like with the like (same list, near tiers), so a sheet's ships are painted at one scale."""
    out = []
    for cat in ('combat', 'trade', 'fast', 'hauler'):
        xs = sorted([x for x in S if x['cat'] == cat], key=lambda x: x['tier'])
        k = -(-len(xs) // 4)  # sheets, then as even as they go (17 → 4, 4, 3, 3, 3)
        sizes = [len(xs) // k + (1 if i < len(xs) % k else 0) for i in range(k)]
        at = 0
        for n in sizes:
            out.append(xs[at:at + n])
            at += n
    return out


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    for n, g in enumerate(groups(), 1):
        key = f'ships_{n}'
        ids = [f"ship.{x['id']}" for x in g]
        p = sprite_prompt(g)
        old = sheets.get(key, {})
        sheets[key] = {'grid': [len(g), 1], 'mode': 'keyed', 'whole': True, 'px': 768, 'square': False, 'dir': 'ships', 'aspect': '3:2', 'ids': ids, 'prompt': p}
        if old.get('cut'):
            sheets[key]['cut'] = old['cut']
        else:
            sheets[key]['painting'] = True
            jobs.append({'name': f'sheet.{key}', 'prompt': p})
    for x in S:
        jobs.append({'name': f"bg.deck_{x['id']}", 'prompt': deck_prompt(x)})
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    by = {}
    for x in S:
        k = x['cat'] + (' premium' if x['premium'] else '')
        by[k] = by.get(k, 0) + 1
    print(len(S), 'new hulls', by, '·', len(jobs), 'jobs')


if __name__ == '__main__':
    main()
