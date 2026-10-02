"""The battle's creatures (owner, 2026-10-02: «about a hundred different creatures with small animations in the right
projection», the battle as in Heroes): every kind that fights on the hex field, its faction and tier, and how it is
painted — one animation sheet per kind, four poses in a row (idle, idle a breath later, its attack, flinching from a hit), in the high
three-quarter view of HoMM3's battle creatures, facing right (the other side's are mirrored in the game).

    python tools/art/creatures.py            # sheets into tools/art/sheets.json, jobs into assets/raw/q_creatures.json

The 32 kinds already in the game (H1's men, docs/18's creatures) come first; the factions of the world follow, seven
tiers each where the faction fields a full army (a base kind and its upgrade a tier), five where it fields a warband;
then the wild beasts, the Dutchman's ghosts and the six captains who stand at the field's corners.

Each kind: (id, faction, tier, English, Russian, body, look, idle a breath later, attack, hit).
body: man — on its feet; beast — on its feet or belly, head to the right; fly — in the air; water — rising from a patch
of sea water; big — a large creature on its feet. The hit frame has a default per body when left empty.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_creatures.json')

HIT = {
    'man': 'staggering back on his heels from a blow, the free arm raised before the face, head turned away',
    'big': 'reeling back from a heavy blow, head and shoulders jerked away, one arm thrown up',
    'beast': 'recoiling from a blow, head pulled back and away, body hunched',
    'fly': 'tumbling back in the air from a blow, wings thrown up and feathers or skin ruffled',
    'water': 'jerking back from a blow, sinking a little lower into its water',
}

K = []


def c(cid, faction, tier, en, ru, body, look, idle2, attack, hit=''):
    K.append({'id': cid, 'faction': faction, 'tier': tier, 'en': en, 'ru': ru, 'body': body, 'look': look, 'idle2': idle2, 'attack': attack, 'hit': hit or HIT[body]})


# ---- The Red Tide: the pirate crew (H1's fourteen men, in the game) -------------------------------------------------
c('deckhand', 'red_tide', 1, 'Deckhand', 'Юнга', 'man', 'a barefoot young pirate deckhand: lean and sunburnt, tousled dark hair, a torn blue-and-white striped shirt, patched canvas trousers rolled to the knee, a rope belt, a wooden belaying pin gripped like a club', 'his chest risen and the club lifted a hand higher', 'swinging the belaying pin in a wide overhead blow toward the right, his weight thrown onto the front foot')
c('sailor', 'red_tide', 1, 'Sailor', 'Матрос', 'man', 'a seasoned pirate sailor: a weathered face with a grey-shot beard, a knitted wool cap, a tarred black jacket over a grey shirt, canvas trousers and boots, a short cutlass in the right hand and a marlinspike in the left', 'his shoulders rolled and the cutlass point lifted a little', 'slashing the cutlass in a fast diagonal cut toward the right, the marlinspike drawn back for a second strike')
c('marine', 'red_tide', 2, 'Marine', 'Морпех', 'man', 'a pirate marine in a faded, patched red coat with dirty white crossbelts and a battered black tricorne, a musket with a fixed bayonet held at the ready', 'the musket shifted a little higher in his hands', 'lunging forward in a long bayonet thrust toward the right, the musket level at the hip')
c('sea_guard', 'red_tide', 2, 'Sea Guard', 'Морской страж', 'man', 'a pirate sea guard in a dented steel breastplate and a morion helmet over a dark coat, a round iron-bound buckler on the left arm and a short boarding pike', 'the buckler raised a little and the pike point lowered', 'thrusting the pike hard toward the right from behind the raised buckler')
c('musketeer', 'red_tide', 3, 'Musketeer', 'Мушкетёр', 'man', 'a pirate musketeer in a long weathered grey-brown coat and a wide-brimmed hat, a long matchlock musket, a powder horn and a bandolier of powder charges', 'the musket shifted on his shoulder, his head turned a little', 'firing the musket toward the right, the butt against his shoulder, a small bright muzzle flash and a puff of grey smoke at the end of the barrel')
c('sharpshooter', 'red_tide', 3, 'Sharpshooter', 'Стрелок', 'man', 'a pirate sharpshooter in a dark hooded oilskin cloak, a long rifled musket with a brass-bound stock, a powder horn at the hip', 'the rifle lowered a little, his hooded head lifted to look', 'kneeling on one knee and firing the long rifle toward the right, a small bright muzzle flash and a puff of smoke at the barrel tip')
c('gunner', 'red_tide', 4, 'Gunner', 'Канонир', 'man', 'a burly pirate gunner in a leather apron with rolled sleeves and a red kerchief, standing beside a small bronze swivel gun mounted on a short timber post (the gun is part of the figure and stands beside him in every frame), a smoking linstock in his hand', 'the linstock lifted, smoke curling from its match', 'touching the linstock to the swivel gun, which fires toward the right with a small bright flash and a burst of grey smoke, the gunner leaning away')
c('bombardier', 'red_tide', 4, 'Bombardier', 'Бомбардир', 'man', 'a pirate bombardier in a scorched leather apron, a soot-blackened face, a bandolier of round black grenades across his chest, a lit grenade in his right hand', 'the grenade hand drawn back a little, the fuse sparking', 'hurling the lit grenade overarm toward the right, the fuse sparking')
c('boarder', 'red_tide', 5, 'Boarder', 'Абордажник', 'man', 'a pirate boarder with bare scarred muscular arms, a red sash and a red bandana, a broad cutlass in each hand', 'both blades lifted a little, his chest risen', 'leaping forward to the right with both cutlasses slashing in a cross')
c('cutthroat', 'red_tide', 5, 'Cutthroat', 'Головорез', 'man', 'a lean pirate cutthroat in a black long coat with a black scarf over the lower face, a curved knife in the right hand and a flintlock pistol in the left', 'the knife turned in his fingers, the pistol lowered a little', 'darting forward with a low knife stab toward the right, the pistol raised')
c('guard', 'red_tide', 6, 'Guardsman', 'Гвардеец', 'man', "a captain's guardsman: a tall broad man in a heavy dark navy coat with brass buttons and a black tricorne, a tall halberd held upright", 'the halberd tilted a little forward', 'bringing the halberd down in a heavy chopping blow toward the right')
c('life_guard', 'red_tide', 6, 'Life Guard', 'Лейб-гвардеец', 'man', "a captain's life guard in a black steel cuirass and gorget over a dark burgundy coat with tarnished gold braid, a basket-hilted broadsword, a pistol in his belt", 'the broadsword raised to his shoulder', 'a powerful forward lunge with the broadsword toward the right')
c('drowned', 'red_tide', 7, 'Drowned', 'Утопленник', 'man', 'a drowned sailor risen from the sea: grey waterlogged skin, lank hair woven with kelp, barnacles on a rotted sea coat, water dripping from him, a rusted boarding axe', 'his head lolling to one side, the axe hanging lower', 'a slow, heavy overhead chop with the rusted axe toward the right', 'jerking back from a blow, the kelp in his hair swinging, the axe arm flung wide')
c('deep_spawn', 'red_tide', 7, 'Deep Spawn', 'Порождение глубин', 'big', 'a hulking deep spawn brute born of the sea: thick grey-blue hide, pale coral growing out of its shoulders, webbed clawed hands, a heavy rusted anchor chain wound round its right forearm, a very faint turquoise glint in its small eyes', 'its chest heaving, the chain swinging a little', 'swinging the anchor chain in a wide sweeping arc toward the right')

# ---- The land's and the sea's creatures (docs/18, in the game) -------------------------------------------------------
c('crab', 'wild', 1, 'Giant Crab', 'Гигантский краб', 'beast', 'a giant armoured shore crab as big as a hound, a dark red-brown barnacled shell, big raised claws toward the right', 'its claws opened a little wider, eyestalks turned', 'lunging toward the right and snapping its big claw shut', 'pulling back, its claws drawn in before its shell')
c('gull', 'wild', 1, 'Giant Gull', 'Гигантская чайка', 'fly', 'a giant grey sea gull with a hooked grey-yellow beak, its wings spread wide, flying toward the right', 'its wings at the bottom of their beat', 'diving toward the right beak first, talons thrust forward')
c('seal', 'wild', 2, 'Bull Seal', 'Морской котик', 'beast', 'a big scarred grey bull seal with a thick neck and whiskers, propped up on its front flippers, head toward the right', 'its head lifted, nostrils flared', 'rearing up and slamming forward toward the right with open jaws')
c('reef_shark', 'wild', 2, 'Reef Shark', 'Рифовая акула', 'water', 'a reef shark, its head and upper body out of the water, facing right', 'its jaws opened a little, water streaming off it', 'lunging out of the water toward the right with jaws wide open')
c('rock_turtle', 'wild', 3, 'Rock Turtle', 'Каменная черепаха', 'beast', 'a massive land turtle whose high shell is crusted with grey stones and lichen, thick scaly legs, its head toward the right', 'its neck stretched out a little further', 'snapping forward toward the right with its hooked beak, neck at full stretch', 'pulling its head half into its shell')
c('sea_turtle', 'wild', 3, 'Sea Turtle', 'Морская черепаха', 'beast', 'a great sea turtle with a barnacled domed shell and long front flippers, its head toward the right', 'its front flippers lifted a little', 'biting forward toward the right, flippers spread', 'pulling its head half into its shell')
c('marsh_serpent', 'wild', 3, 'Marsh Serpent', 'Болотный змей', 'beast', 'an olive-brown marsh serpent, its coils on the ground and its head reared high, facing right, a hood of scales spread', 'its head swaying a little lower', 'striking toward the right with fangs bared')
c('hermit', 'wild', 4, 'Island Hermit', 'Островной отшельник', 'man', 'a wild island hermit in tattered rags, a long matted grey beard, a rope belt, barefoot, a leather sling in his hand', 'the sling swinging low at his side', 'whirling and releasing the sling toward the right, the stone flying')
c('lagoon_tentacle', 'wild', 4, 'Lagoon Tentacle', 'Щупальце лагуны', 'water', 'a single huge dark-mottled kraken tentacle rising tall out of the water, its pale suckers on the underside, its tip curling toward the right', 'its tip curled the other way', 'the tentacle lashing down hard toward the right')
c('mermaid', 'wild', 4, 'Mermaid', 'Русалка', 'water', 'a sinister mermaid with pale grey skin and long wet black hair, a dark scaled tail, her upper body out of the water, a spear of pale driftwood tipped with a shark tooth', 'her hair swept back, the spear raised a little', 'hurling the spear toward the right')
c('cultist', 'wild', 5, 'Cultist', 'Сектант', 'man', 'a hooded cultist of the drowned god in a sodden dark-green robe hung with shells, an iron lantern with a faint green flame held up in one hand, a wavy ritual knife in the other', 'the lantern lifted higher, the robe stirring', 'thrusting the lantern toward the right, a thin bolt of pale green-grey brine-light leaping from it')
c('surf_drowned', 'wild', 5, 'Surf Drowned', 'Утопленник прибоя', 'man', 'a drowned castaway risen from the surf in a tattered sailcloth shroud draped with seaweed, grey skin, hands reaching forward', 'its head tilted, the hands lower', 'clawing forward toward the right with both hands')
c('young_serpent', 'wild', 6, 'Young Sea Serpent', 'Молодой змей', 'water', 'a young sea serpent rising high in an S-curve out of the water, green-black scales, a crest of webbed fins, a long jaw, facing right', 'its neck swaying back a little', 'striking down toward the right with jaws open')
c('lantern_maw', 'wild', 6, 'Lantern Maw', 'Пасть-фонарь', 'big', 'a lantern maw: a deep-sea anglerfish monster walking on short thick webbed legs, a huge underbite full of needle teeth, a glowing pale-green lure on a stalk over its head, facing right', 'its lure swaying, jaw a little more open', 'lunging toward the right with its huge jaws gaping')
c('ancient_turtle', 'wild', 7, 'Ancient Turtle', 'Древняя черепаха', 'big', 'an ancient colossal turtle whose mossy rock shell carries a small twisted tree and ferns like a little island, deep-wrinkled grey skin, its head toward the right', 'its head lifted a little', 'slamming its beak down toward the right')
c('shoal_leviathan', 'wild', 7, 'Shoal Leviathan', 'Отмельный левиафан', 'water', 'a young leviathan: a long armoured serpent-whale with a ridge of bone spines along its back, rising out of the water, its head toward the right', 'its head risen higher, water streaming', 'crashing forward toward the right with its armoured head')
c('white_whale', 'wild', 8, 'White Whale', 'Белый кит', 'water', 'the White Whale: a huge pale scarred sperm whale breaching out of the water, old harpoons and broken lines stuck in its hide, its head toward the right', 'its head risen a little higher, water streaming down', 'its massive head ramming down toward the right, its narrow jaw open')
c('young_kraken', 'wild', 8, 'Young Kraken', 'Молодой кракен', 'water', 'a young kraken: a bulbous mottled dark-burgundy body with a hooked beak and a mass of tentacles raised high, rising out of the water', 'its tentacles curled the other way', 'all its tentacles lashing forward toward the right')

# ---- The Crown Admiralty: navy-blue coats with white facings, polished brass ------------------------------------------
c('crown_boy', 'crown', 1, 'Powder Monkey', 'Пороховой юнга', 'man', 'a Crown navy ship\'s boy in a short navy-blue jacket and white trousers, barefoot, a leather cartridge case slung on his back, a short dirk', 'the dirk lifted a little', 'stabbing the dirk forward toward the right')
c('crown_drummer', 'crown', 1, 'Drummer', 'Барабанщик', 'man', 'a Crown drummer boy in a navy-blue coat with white lace and a black tricorne, a brass snare drum at his hip, two drumsticks', 'both drumsticks raised high', 'beating the drum hard with both sticks, his mouth open in a shout')
c('crown_marine', 'crown', 2, 'Crown Marine', 'Морпех Короны', 'man', 'a Crown marine in a navy-blue coat with white crossbelts and polished brass buttons, a black tricorne with white tape, a musket with a long bayonet', 'the musket shifted a little higher', 'a long bayonet thrust toward the right')
c('crown_grenadier', 'crown', 2, 'Grenadier', 'Гренадер', 'man', 'a tall Crown grenadier in a navy-blue coat and a tall brass-fronted mitre cap, a short hanger sword at his side, a black grenade in his right hand', 'the grenade hand drawn back a little', 'hurling a lit grenade overarm toward the right')
c('crown_line', 'crown', 3, 'Line Infantry', 'Линейный стрелок', 'man', 'a Crown line infantryman in a navy-blue coat with white facings, white gaiters and a black tricorne, a long musket', 'the musket brought to his shoulder', 'firing the musket toward the right, a small bright muzzle flash and a puff of grey smoke')
c('crown_rifleman', 'crown', 3, 'Rifleman', 'Егерь', 'man', 'a Crown rifleman in a dark green jacket and a black cap with a short plume, a short rifle, a sword-bayonet at his belt', 'the rifle lowered, his head lifted to look', 'kneeling and firing the rifle toward the right, a small muzzle flash and a puff of smoke')
c('crown_mortar', 'crown', 4, 'Mortar Crew', 'Мортирщик', 'man', 'a Crown mortar gunner in a navy coat beside a small squat bronze coehorn mortar on a wooden bed at his feet (the mortar is part of the figure in every frame), a linstock in his hand', 'the linstock lifted, smoke curling from it', 'the mortar firing upward toward the right with a flash and a puff of smoke, the gunner leaning away')
c('crown_rocketeer', 'crown', 4, 'Rocketeer', 'Ракетчик', 'man', 'a Crown rocket gunner in a navy coat and a leather cap beside a long iron rocket resting on a small tripod frame (part of the figure in every frame), a linstock in his hand', 'the linstock lifted', 'the rocket launching toward the right in a burst of sparks and smoke, the gunner shielding his face')
c('crown_chaplain', 'crown', 5, 'Naval Chaplain', 'Корабельный капеллан', 'man', 'a Crown naval chaplain in a long black cassock with a white collar, a silver chain at his chest, a heavy brass censer on a chain in his right hand', 'the censer swinging the other way, a thread of smoke', 'swinging the brass censer on its chain toward the right, a trail of grey smoke behind it')
c('crown_inquisitor', 'crown', 5, 'Inquisitor', 'Инквизитор', 'man', 'a Crown witch-hunter inquisitor in a black wide-brimmed hat and a long black leather coat with silver buckles, a silver-tipped rapier and a flintlock pistol', 'the rapier point lowered, the pistol raised a little', 'a fencing lunge with the rapier toward the right')
c('crown_cuirassier', 'crown', 6, 'Cuirassier', 'Кирасир', 'man', 'a heavy Crown cuirassier officer in black-lacquered steel half-armour over a navy coat, a burgonet helmet with a white plume, a heavy broadsword', 'the broadsword lifted to his shoulder', 'a powerful downward cut toward the right')
c('crown_ironclad', 'crown', 6, 'Ironclad', 'Латник Адмиралтейства', 'man', 'an Admiralty ironclad marine in full riveted dark-iron plate armour, a tall tower shield with a brass anchor emblem, a heavy boarding axe', 'the shield edged forward, the axe lifted', 'bashing forward toward the right with the tower shield, the axe raised behind it')
c('crown_diver', 'crown', 7, 'Brass Diver', 'Латунный водолаз', 'big', 'a hulking Crown diver in a riveted copper-and-brass diving suit, a round helmet with three small portholes, lead boots, air hoses at the back, a long harpoon lance', 'the lance lowered a little, a stream of tiny bubbles from the helmet valve', 'driving the harpoon lance forward toward the right')
c('crown_dreadnought', 'crown', 7, 'Dreadnought Diver', 'Водолаз-дредноут', 'big', 'a colossal Crown dreadnought diver in a heavy dark-iron diving suit, a domed helmet with a single round faintly lit porthole, a huge riveted hammer, air hoses', 'the hammer lifted onto its shoulder', 'smashing the hammer down toward the right')

# ---- The Choir of the Deep: sodden robes, shells, coral, kelp, faint turquoise ---------------------------------------
c('choir_acolyte', 'choir', 1, 'Acolyte', 'Послушник', 'man', 'a young barefoot acolyte of the drowned god in a sodden grey-green hooded robe hung with small shells, a small iron hand bell and a curved knife', 'the bell lifted, the hood turned', 'a quick slash with the curved knife toward the right')
c('choir_bellringer', 'choir', 1, 'Bellringer', 'Звонарь', 'man', 'a hooded bellringer of the drowned god carrying a heavy green-bronze bell on a wooden yoke over his shoulder, a short iron mallet', 'the mallet raised', 'striking the bell hard with the mallet, his mouth open in a chant')
c('tide_zealot', 'choir', 2, 'Tide Zealot', 'Фанатик прилива', 'man', 'a zealot of the drowned god, the face hidden behind a pale fish-scale mask, a sodden dark robe, a hooked spear', 'the spear point lowered', 'a hard thrust of the hooked spear toward the right')
c('deep_zealot', 'choir', 2, 'Deep Zealot', 'Фанатик глубин', 'man', 'a zealot of the deep in a mask of pale coral, a ragged kelp mantle over dark scale armour, a hooked spear and a round shell shield', 'the shield raised a little', 'a thrust of the hooked spear toward the right from behind the shield')
c('choir_chanter', 'choir', 3, 'Chanter', 'Певчий', 'man', 'a hooded choir chanter in a long sea-green robe, holding a large spiral conch shell', 'the conch lifted toward the lips', 'blowing the conch toward the right, a faint ring of rippling air leaving its mouth')
c('choir_cantor', 'choir', 3, 'Cantor', 'Кантор', 'man', 'a tall choir cantor in a high-hooded black robe with a silver chain of shells, a carved conch horn ringed with brass', 'the horn lowered, the hood turned', 'blowing the conch horn toward the right, a faint ring of rippling air leaving its mouth')
c('brine_witch', 'choir', 4, 'Brine Witch', 'Солёная ведьма', 'man', 'an old sea witch with long white hair, a ragged dark shawl of fishing net, a staff of twisted driftwood hung with shells and dried starfish', 'the staff tilted, her fingers spread', 'thrusting the staff toward the right, a jet of cold sea water spraying from its tip')
c('storm_witch', 'choir', 4, 'Storm Witch', 'Ведьма бурь', 'man', 'a storm witch in a billowing dark-grey cloak, wild grey hair, a staff of black driftwood topped with a glass jar holding a faint trapped spark', 'her cloak billowing the other way', 'pointing the staff toward the right, a thin fork of pale lightning leaping from it')
c('drowned_priest', 'choir', 5, 'Drowned Priest', 'Утопший жрец', 'man', 'a drowned priest of the deep: grey waterlogged skin, a heavy sodden vestment of dark green and black, a crown of pale coral, a hooked green-bronze crozier', 'the crozier lifted, water dripping', 'swinging the crozier in a heavy arc toward the right')
c('deep_abbot', 'choir', 5, 'Abbot of the Deep', 'Аббат глубин', 'man', 'an abbot of the deep: a towering robed figure in layered black vestments heavy with water, a tall mitre of pale coral, a censer of green bronze on a chain', 'the censer swinging back', 'swinging the censer toward the right, a cloud of grey-green smoke pouring from it')
c('deep_one', 'choir', 6, 'Deep One', 'Глубинный', 'man', 'a deep one: a muscular fish-man warrior with grey-green scaled skin, a finned crest, wide black eyes, gill slits, webbed hands, a belt of shells, a rusted trident', 'its gills flared, the trident lowered', 'a hard trident thrust toward the right')
c('deep_one_champion', 'choir', 6, 'Deep One Champion', 'Чемпион глубин', 'big', 'a deep one champion: a large fish-man warrior in barnacle-crusted black armour plates, a tall crest of fins, a huge serrated trident', 'its crest raised, gills flared', 'a sweeping trident thrust toward the right')
c('abyss_herald', 'choir', 7, 'Abyss Herald', 'Вестник бездны', 'big', 'an abyss herald: a towering faceless figure of dark coral, kelp and wet black stone in a hooded shape, long arms ending in hooked coral claws, a faint turquoise light deep in the hollow of its hood', 'its arms drawn in, the kelp stirring', 'raking down toward the right with both coral claws')
c('abyss_ascendant', 'choir', 7, 'Ascended Herald', 'Вознесённый вестник', 'big', 'an ascended herald of the abyss: a colossal hooded giant of black coral and trailing kelp with a crown of pale coral spires, a faint turquoise light in its hood, a great hooked staff of coral', 'the staff lifted, kelp swaying', 'bringing the coral staff down toward the right')

# ---- The Order of the Harpoon: whalers and hunters of the deep's great beasts ----------------------------------------
c('flenser', 'harpoon', 1, 'Flenser', 'Разделочник', 'man', 'a whaler flenser in a greasy grey oilskin coat and a sou\'wester hat, a long-handled flensing spade', 'the spade lifted a little', 'a heavy stabbing thrust of the flensing spade toward the right')
c('boat_steerer', 'harpoon', 1, 'Boat Steerer', 'Рулевой вельбота', 'man', 'a whaleboat steerer in a tar-stained jacket and a knitted cap, a long steering oar held like a quarterstaff', 'the oar turned across his body', 'swinging the steering oar in a wide blow toward the right')
c('harpooner', 'harpoon', 2, 'Harpooner', 'Гарпунёр', 'man', 'a harpooner with tattooed forearms in a short grey oilskin, a bundle of iron harpoons on his back, one held ready to throw', 'the harpoon drawn back a little further', 'hurling the harpoon toward the right, its line trailing')
c('master_harpooner', 'harpoon', 2, 'Master Harpooner', 'Мастер-гарпунёр', 'man', 'a scarred grey-bearded master harpooner in a long oilskin coat with whalebone toggles, a heavy barbed harpoon', 'the harpoon lifted to his shoulder', 'hurling the heavy harpoon toward the right, its line trailing')
c('net_thrower', 'harpoon', 3, 'Net Thrower', 'Метатель сетей', 'man', 'a whaler net thrower with a weighted fishing net over his shoulder and an iron gaff hook', 'the net gathered in his hand', 'casting the weighted net forward toward the right, the net spreading open')
c('net_master', 'harpoon', 3, 'Net Master', 'Мастер сетей', 'man', 'a burly net master with a wide weighted net of tarred rope and a long iron gaff', 'the net swung back', 'casting the wide net toward the right, the weights flying')
c('lancer', 'harpoon', 4, 'Whaling Lancer', 'Китобой-копейщик', 'man', 'a whaling lancer in a leather jerkin reinforced with strips of baleen, a long whaling lance with a leaf-shaped blade', 'the lance lowered a little', 'a long two-handed lance thrust toward the right')
c('baleen_knight', 'harpoon', 4, 'Baleen Knight', 'Рыцарь Гарпуна', 'man', 'a knight of the Order of the Harpoon in armour of dark riveted leather and polished baleen plates, a tall harpoon-headed lance and a round shield painted with a white harpoon', 'the shield raised a little', 'a lance thrust toward the right from behind the shield')
c('harpoon_gunner', 'harpoon', 5, 'Harpoon Gunner', 'Гарпунный стрелок', 'man', 'a heavy harpoon gunner with a shoulder-held brass harpoon gun and a coil of line at his hip', 'the gun lowered a little', 'firing the harpoon gun toward the right, a puff of smoke, the barbed harpoon flying out on its line')
c('leviathan_slayer', 'harpoon', 5, 'Leviathan Slayer', 'Убийца левиафанов', 'big', 'a leviathan slayer: a grizzled giant of a whaler in a long scarred oilskin coat, a necklace of whale teeth, a huge two-handed harpoon-axe', 'the harpoon-axe lifted onto his shoulder', 'a huge cleaving blow with the harpoon-axe toward the right')

# ---- The Fog Brokers: smugglers, spies and knives ---------------------------------------------------------------------
c('smuggler', 'brokers', 1, 'Smuggler', 'Контрабандист', 'man', 'a smuggler in a dark knitted cap and a worn pea coat, a sack over one shoulder and a short knife', 'the knife turned in his hand', 'a quick knife slash toward the right')
c('fog_runner', 'brokers', 1, 'Fog Runner', 'Туманный бегун', 'man', 'a lean fog runner in dark grey rags and a hood, two short knives, light on his feet', 'his weight shifted onto the other foot', 'a fast double knife slash toward the right')
c('fog_thief', 'brokers', 2, 'Fog Thief', 'Туманный вор', 'man', 'a thief of the Fog Brokers in a long grey hooded cloak and a plain grey half-mask, a short sword and a round smoke bomb', 'the smoke bomb tossed lightly in his hand', 'throwing the smoke bomb toward the right, a small puff of grey smoke')
c('fog_shadow', 'brokers', 2, 'Shadow', 'Тень', 'man', 'a fog shadow: a slim figure wrapped in charcoal cloth from head to toe with only the eyes showing, a curved short sword', 'crouched a little lower', 'a low lunging cut with the curved sword toward the right')
c('duelist', 'brokers', 3, 'Duelist', 'Дуэлянт', 'man', 'a Fog Broker duelist in a dark grey doublet and a short cape, a black hat with a grey feather, a long rapier and a parrying dagger', 'the rapier point lifted a little', 'a deep fencing lunge with the rapier toward the right')
c('bravo', 'brokers', 3, 'Bravo', 'Бретёр', 'man', 'a swaggering bravo in a slashed black doublet and a wide black hat with a grey plume, a rapier, a cloak wrapped round his left arm', 'the cloaked arm raised a little', 'a fast rapier thrust toward the right behind the cloaked arm')
c('poisoner', 'brokers', 4, 'Poisoner', 'Отравитель', 'man', 'a hunched poisoner in a dark hooded coat with rows of small glass vials across the chest, a long blowpipe', 'the blowpipe lifted toward the lips', 'blowing a dart through the blowpipe toward the right')
c('alchemist', 'brokers', 4, 'Alchemist', 'Алхимик', 'man', 'a Fog Broker alchemist in a stained leather apron and round smoked-glass goggles, a bandolier of corked flasks, one flask raised in his hand', 'the flask swirled, a wisp of vapour', 'hurling the corked flask toward the right')
c('assassin', 'brokers', 5, 'Assassin', 'Убийца', 'man', 'a Fog Broker assassin in a close black hood and mask and a dark grey leather coat, twin stilettos', 'the stilettos turned point down', 'a fast double stab toward the right')
c('fog_master', 'brokers', 5, 'Fog Master', 'Мастер тумана', 'man', 'a fog master: a tall gaunt figure in a long tattered charcoal cloak whose hem frays into drifting grey fog, a grey porcelain mask, a slender sword', 'the fog at the hem drifting the other way', 'a sweeping cut with the slender sword toward the right, the cloak flaring')

# ---- The Gilded Ledger: the merchant company's hired arms, black and gold -------------------------------------------
c('porter', 'league', 1, 'Dock Porter', 'Портовый грузчик', 'man', 'a burly dock porter in a sweat-stained shirt and a leather back harness, a short iron-bound cudgel', 'the cudgel tapped against his palm', 'swinging the cudgel in a heavy blow toward the right')
c('dock_bruiser', 'league', 1, 'Dock Bruiser', 'Портовый громила', 'man', 'a dock bruiser with a shaved head and a broken nose, a leather vest, brass knuckles on both fists', 'his fists raised a little higher', 'a heavy straight punch toward the right')
c('company_guard', 'league', 2, 'Company Guard', 'Стражник Компании', 'man', 'a company guard of the Gilded Ledger in a black coat with gold buttons and gold-trimmed lapels, a black tricorne, a short pike', 'the pike point lowered', 'a pike thrust toward the right')
c('ledger_halberdier', 'league', 2, 'Halberdier', 'Алебардщик', 'man', 'a Ledger halberdier in a black-and-gold striped doublet and a polished steel morion with a gold crest, a gilded halberd', 'the halberd tilted forward', 'a chopping halberd blow toward the right')
c('arquebusier', 'league', 3, 'Arquebusier', 'Аркебузир', 'man', 'a hired arquebusier of the Gilded Ledger in a black coat with a gold sash and a wide hat, a heavy arquebus resting on a forked stand', 'his cheek lowered to the stock', 'firing the arquebus from its forked stand toward the right, a muzzle flash and a puff of smoke')
c('company_musketeer', 'league', 3, 'Company Musketeer', 'Мушкетёр Компании', 'man', 'a company musketeer in a black-and-gold coat and a gold-banded hat, a long musket with a gilded lock', 'the musket raised to his shoulder', 'firing the musket toward the right, a muzzle flash and a puff of smoke')
c('debt_collector', 'league', 4, 'Debt Collector', 'Сборщик долгов', 'man', 'a heavy debt collector in a black greatcoat with a ledger chained to his belt, a spiked iron flail', 'the flail head swinging slowly', 'swinging the flail in a wide arc toward the right')
c('enforcer', 'league', 4, 'Enforcer', 'Каратель', 'man', 'a Ledger enforcer in a black breastplate etched with gold, a heavy war hammer', 'the hammer lifted onto his shoulder', 'a heavy hammer blow toward the right')
c('gilded_cuirassier', 'league', 5, 'Gilded Cuirassier', 'Золочёный кирасир', 'man', 'a gilded cuirassier mercenary in gold-chased black plate armour and a burgonet with a black plume, a long sword and a gilded pistol', 'the sword lifted to his shoulder', 'a powerful sword cut toward the right')
c('paymaster', 'league', 5, 'Paymaster', 'Казначей', 'man', "the Ledger's paymaster: a stout man in rich black velvet with a heavy gold chain and gold rings, a cane-sword, a small iron strongbox at his feet (part of the figure in every frame)", 'his hand on the cane, his chin raised', 'drawing the sword from his cane in a quick lunge toward the right')

# ---- The Free Harbors: the islands' fishers and warriors -------------------------------------------------------------
c('fisher', 'free', 1, 'Fisher', 'Рыбак', 'man', 'an island fisherman in a straw hat and rolled trousers, barefoot, a long gaff hook', 'the gaff lifted a little', 'swinging the gaff hook toward the right')
c('spear_fisher', 'free', 1, 'Spear Fisher', 'Острогер', 'man', 'an island spear fisher with a three-pronged fishing spear and a woven basket on his back', 'the spear drawn back a little', 'a quick spear thrust toward the right')
c('island_warrior', 'free', 2, 'Island Warrior', 'Островной воин', 'man', 'an island warrior in a woven fibre cuirass, a long wooden spear and an oval wooden shield painted with a dark wave pattern', 'the shield raised a little', 'a spear thrust toward the right from behind the shield')
c('sharktooth', 'free', 2, 'Sharktooth Warrior', 'Воин акульего зуба', 'man', 'a sharktooth warrior with a heavy wooden club edged with rows of shark teeth, a fibre cuirass and a shell necklace', 'the club lifted onto his shoulder', 'a sweeping club blow toward the right')
c('blowgun_hunter', 'free', 3, 'Blowgun Hunter', 'Охотник с трубкой', 'man', 'an island hunter in a palm-fibre cape with a long bamboo blowgun and a quiver of darts', 'the blowgun lifted toward the lips', 'blowing a dart through the long blowgun toward the right')
c('island_archer', 'free', 3, 'Island Archer', 'Островной лучник', 'man', 'an island archer with a tall bow of dark wood, a fibre cuirass and a feather-trimmed headband', 'an arrow nocked, the bow half drawn', 'loosing an arrow toward the right, the bow at full draw')
c('tide_shaman', 'free', 4, 'Tide Shaman', 'Шаман прилива', 'man', 'an old island shaman in a long cape of dried seaweed and feathers, a carved wooden sea-turtle mask, a rattle staff hung with shells', 'the staff shaken, the shells swinging', 'shaking the shell staff toward the right, a spray of sea water flying from it')
c('tide_caller', 'free', 4, 'Tide Caller', 'Зовущий прилив', 'man', 'a tide caller: a tall shaman in a cape of dark feathers and kelp, a carved wooden shark mask, a staff topped with a big conch', 'the staff lifted high', 'thrusting the conch staff toward the right, a jet of sea water bursting from the conch')
c('basalt_guardian', 'free', 5, 'Basalt Guardian', 'Базальтовый страж', 'big', 'an island guardian: a hulking humanoid of black basalt blocks bound with ropes and roots, moss and coral on its shoulders, carved spiral marks, two dull amber eyes', 'its fists lowered, moss stirring', 'a heavy two-fisted smash toward the right')
c('volcano_guardian', 'free', 5, 'Volcano Guardian', 'Вулканический страж', 'big', 'a volcano guardian: a hulking humanoid of cracked black lava rock with a faint orange heat in its cracks, ash drifting from its shoulders', 'the heat in its cracks dimmer, ash drifting', 'a heavy overhead smash with both fists toward the right')

# ---- New wild beasts: the islands' and the shallows' ----------------------------------------------------------------
c('wild_boar', 'wild', 2, 'Wild Boar', 'Дикий кабан', 'beast', 'a big bristly island wild boar with long curved tusks, its head toward the right', 'its head lowered, snout twitching', 'charging toward the right, tusks first')
c('island_ape', 'wild', 4, 'Island Ape', 'Островная обезьяна', 'big', 'a huge grey-backed island ape with long arms, knuckles on the ground, facing right', 'its chest puffed, one arm lifted', 'rearing up and smashing both fists down toward the right')
c('jaguar', 'wild', 3, 'Jaguar', 'Ягуар', 'beast', 'a dark jungle jaguar with black rosettes on dark gold fur, crouched to spring, head toward the right', 'its tail curled, ears back', 'pouncing toward the right, claws out')
c('crocodile', 'wild', 4, 'Swamp Crocodile', 'Болотный крокодил', 'beast', 'a big swamp crocodile with armoured olive-dark scales, long and low, its head toward the right', 'its jaws opened slightly', 'lunging toward the right with jaws snapping')
c('monitor', 'wild', 3, 'Giant Monitor', 'Гигантский варан', 'beast', 'a giant grey monitor lizard with a forked tongue and a long heavy tail, its head toward the right', 'its tongue flicking out', 'biting forward toward the right, jaws wide')
c('giant_toad', 'wild', 2, 'Giant Toad', 'Гигантская жаба', 'beast', 'a giant warty swamp toad the size of a calf, dull olive and brown, facing right', 'its throat sac puffed out', 'lashing a long sticky tongue out toward the right')
c('cave_bat', 'wild', 2, 'Cave Bat', 'Пещерная летучая мышь', 'fly', 'a giant cave bat with leathery dark wings spread wide, big ears and small fangs, flying toward the right', 'its wings at the bottom of their beat', 'swooping toward the right, claws forward and mouth open')
c('albatross', 'wild', 3, 'Albatross', 'Альбатрос', 'fly', 'a giant albatross with long narrow wings, white and dark grey, flying toward the right', 'its wings tilted the other way', 'diving toward the right, its hooked beak open')
c('moray', 'wild', 3, 'Giant Moray', 'Гигантская мурена', 'water', 'a giant mottled brown moray eel rising out of the water, its jaws open, facing right', 'its head swaying back', 'striking toward the right with its jaws gaping')
c('barracuda', 'wild', 2, 'Barracuda', 'Барракуда', 'water', 'a giant barracuda leaping out of the water, a long silver body and a jaw full of fangs, facing right', 'its body arched a little higher', 'snapping forward toward the right')
c('giant_octopus', 'wild', 5, 'Giant Octopus', 'Гигантский осьминог', 'beast', 'a giant dark-red octopus crawling on land on its tentacles, its mantle raised, its tentacles reaching toward the right', 'its tentacles curled differently', 'its tentacles lashing out toward the right')
c('bell_hermit', 'wild', 3, 'Bell Hermit', 'Краб-колокол', 'beast', "a giant hermit crab living in an old green-bronze ship's bell instead of a shell, big claws toward the right", 'its claws opened wider', 'snapping its big claw toward the right')

# ---- The Dutchman's ghosts: pale, solid, tattered, a faint green glow ------------------------------------------------
c('ghost_sailor', 'dutchman', 2, 'Ghost Sailor', 'Призрачный матрос', 'man', 'a ghost sailor of the Flying Dutchman: pale grey-green solid spectral skin, hollow dark eyes, tattered sea clothes hung with chains and kelp, a rusted cutlass, a faint green glow about him', 'his head tilted, the cutlass lowered', 'a slashing cutlass blow toward the right')
c('ghost_bosun', 'dutchman', 3, 'Ghost Bosun', 'Призрачный боцман', 'man', 'a tall ghost bosun: pale grey-green spectral skin, a bosun\'s whistle on a chain, a coil of wet rope as a whip, a faint green glow', 'the rope swinging loose', 'lashing the rope whip toward the right')
c('lantern_wraith', 'dutchman', 4, 'Lantern Wraith', 'Фонарный призрак', 'fly', "a lantern wraith: a hooded spectral shape in tattered grey robes drifting above the ground with no legs, holding a ship's lantern with a faint green flame", 'the robes drifting the other way', 'thrusting the lantern forward toward the right, a burst of cold green flame')
c('ghost_musketeer', 'dutchman', 4, 'Ghost Musketeer', 'Призрачный мушкетёр', 'man', 'a ghost musketeer of the Dutchman: a pale spectral marine in a rotted coat and a tricorne green with mould, a long musket, a faint green glow', 'the musket brought up', 'firing the musket toward the right, a pale green muzzle flash and grey-green smoke')
c('phantom_gunner', 'dutchman', 5, 'Phantom Gunner', 'Фантомный канонир', 'man', 'a phantom gunner of the Dutchman beside a small rusted cannon wrapped in kelp (part of the figure in every frame), pale spectral skin, a smoking linstock, a faint green glow', 'the linstock lifted', 'touching off the cannon, which fires toward the right with a pale green flash and smoke')
c('dutchman_boarder', 'dutchman', 5, 'Dutchman Boarder', 'Абордажник «Голландца»', 'man', 'a spectral boarder of the Dutchman with a barnacle-crusted boarding axe and a broken round shield, pale grey-green skin, a faint green glow', 'the shield raised a little', 'a heavy axe blow toward the right')
c('drowned_officer', 'dutchman', 6, 'Drowned Officer', 'Утопший офицер', 'man', 'a drowned officer of the Dutchman: pale spectral skin, a rotted officer\'s coat with tarnished epaulettes, a tricorne, a long sword, a faint green glow', 'the sword raised in salute', 'a long sword lunge toward the right')
c('dutchman_mate', 'dutchman', 7, "Dutchman's Mate", 'Старпом «Голландца»', 'big', "a towering spectral first mate of the Dutchman in a long rotted greatcoat, chains wound round his arms, a heavy anchor hook, pale grey-green skin, a faint green glow", 'the chains swinging', 'swinging the anchor hook in a wide arc toward the right')

# ---- The captains at the field's corners (the six paths) ------------------------------------------------------------
c('hero_corsair', 'hero', 0, 'Corsair', 'Корсар', 'man', 'a corsair captain: a dashing pirate captain in a long black coat with brass buttons and a feathered black tricorne, a cutlass and a brace of pistols', 'his free hand on his belt, chin raised', 'raising the cutlass high and pointing it toward the right, shouting an order')
c('hero_smuggler', 'hero', 0, 'Smuggler', 'Контрабандист', 'man', 'a smuggler captain in a dark grey hooded oilskin coat and a scarf, a shuttered lantern in one hand and a pistol in the other', 'the lantern lowered, the hood turned', 'levelling the pistol toward the right, a small muzzle flash')
c('hero_reaver', 'hero', 0, 'Reaver', 'Рейвер', 'man', 'a reaver captain: a huge scarred pirate in a coat of black leather and iron rings, a red sash, a great axe', 'the axe lifted onto his shoulder', 'roaring and swinging the great axe toward the right')
c('hero_navigator', 'hero', 0, 'Navigator', 'Навигатор', 'man', 'a navigator captain in a long weathered blue coat and a wide hat, a brass sextant on the belt, a long spyglass and a sabre', 'the spyglass raised to his eye', 'pointing the sabre toward the right, giving the order')
c('hero_drowned', 'hero', 0, 'Drowned Captain', 'Утопший капитан', 'man', 'a drowned captain: grey waterlogged skin, a rotted captain\'s coat dripping water, kelp in the hair, a rusted anchor hook in one hand, a very faint turquoise glint in the eyes', 'water dripping, the hook lowered', 'raising the anchor hook toward the right, calling the deep')
c('hero_admiral', 'hero', 0, 'Admiral', 'Адмирал', 'man', 'an admiral in a navy-blue coat with heavy gold epaulettes and a black cocked hat, medals on the chest, a gold-hilted sword', 'his hand on the sword hilt', 'pointing the drawn sword toward the right, commanding the line')

BASE = {
    'man': ('each figure about 72% of the picture height', 'standing ready in a combat stance'),
    'big': ('each figure about 80% of the picture height', 'standing ready, looming'),
    'beast': ('each creature about 22% of the picture width', 'poised and alert'),
    'fly': ('each creature hovering at the same height in the air, its spread wings about 22% of the picture width', 'hovering with its wings spread'),
    'water': ('each rising out of its own small flat oval patch of dark sea water ringed with white foam — the same patch in every pose, all four patches at the same height — the creature about 72% of the picture height', 'risen out of the water, watchful'),
}


def prompt(k: dict) -> str:
    frame, idle = BASE[k['body']]
    who = 'character' if k['body'] in ('man', 'big') else 'creature'
    facing = ('nose, chest and toes pointing right, so we see its left side and a little of its front'
              if who == 'character' else 'its head toward the right')
    return (
        f'Animation pose sheet of ONE {who} for a dark Pirate Gothic turn-based battle game, painted in the style of the battle creatures of '
        'Heroes of Might and Magic III and Warcraft III: rich painterly realism, grim and weathered, a bold readable silhouette. '
        f"The {who}: {k['look']}. "
        f'The picture shows exactly FOUR poses of this same {who} side by side in ONE horizontal row, evenly spaced across the whole width, '
        'with wide empty gaps between them so that no two touch, all four at exactly the same size and scale, the lowest points of all '
        'four at the same height near the bottom of the picture. From left to right: '
        f'first — idle: {idle}; '
        f"second — idle a breath later: the same pose with a tiny change only, {k['idle2']}, like the next frame of an idle animation; "
        f"third — attack: {k['attack']}; "
        f"fourth — hit: {k['hit']}. "
        f'Exactly the same {who} in all four poses — the same face, build, clothes, colours and equipment — like four frames of one animation. '
        f'Every pose faces the RIGHT side of the picture in three-quarter view from a high camera about 30 degrees above the ground, {facing}. '
        f'The whole {who} is visible in every pose, nothing cut off by the picture edges, {frame}. '
        'The same warm lantern light from the upper left and a cool moonlight rim from behind on all four. '
        'Muted palette: charcoal, tarred black leather, weathered wool and canvas, rust, old brass, faded red and cold blue-grey; low saturation '
        'with small warm highlights. '
        'Background: flat, fully saturated pure magenta #FF00FF (RGB 255, 0, 255) behind everything, uniform, no gradient. NO ground, NO floor, '
        'NO cast shadows, NO ground line, NO horizon, NO dust, NO motion blur, NO speed lines. NO dividing lines, NO panels, NO frames, NO borders, NO captions, NO text, '
        'NO letters, NO numbers, NO watermark. '
        'Avoid: a different character in any pose, more or fewer than four poses, cartoon, chibi, anime, cel shading, thick outlines, flat '
        'vector, pixel art, bright saturated colours, front view, back view, blood, gore, skeletons.'
    )


FRAMES = ('', '_b', '_atk', '_hit')


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    for k in K:
        ids = [f"unit.{k['id']}{f}" for f in FRAMES]
        p = prompt(k)
        old = sheets.get(f"anim_{k['id']}", {})
        sheets[f"anim_{k['id']}"] = {'grid': [4, 1], 'mode': 'keyed', 'split': 'blobs', 'px': 512, 'square': False, 'uniform': 0.45, 'dir': 'units',
                                     'aspect': '16:9', 'ids': ids, 'creature': {x: k[x] for x in ('faction', 'tier', 'en', 'ru', 'body')}, 'prompt': p}
        if old.get('cut'):
            sheets[f"anim_{k['id']}"]['cut'] = old['cut']
        else:
            sheets[f"anim_{k['id']}"]['painting'] = True
            jobs.append({'name': f"sheet.anim_{k['id']}", 'aspect': '16:9', 'prompt': p})
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    by = {}
    for k in K:
        by[k['faction']] = by.get(k['faction'], 0) + 1
    print(len(K), 'kinds', by, 'longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
