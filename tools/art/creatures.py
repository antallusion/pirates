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
    'man': 'flinching from a blow while still facing right: leaning back onto the rear foot, shoulders hunched, eyes squeezed shut, still holding the same weapon',
    'big': 'reeling back from a heavy blow while still facing right: leaning back, shoulders hunched, still holding the same weapon',
    'beast': 'recoiling from a blow while still facing right: head pulled back, body hunched low',
    'fly': 'jolted back in the air by a blow while still facing right, wings thrown up',
    'water': 'jerking back from a blow while still facing right, sinking a little lower into its water',
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
c('drowned', 'red_tide', 7, 'Drowned', 'Утопленник', 'man', 'a drowned sailor risen from the sea: grey waterlogged skin, lank hair woven with kelp, barnacles on a rotted sea coat, water dripping from him, a rusted boarding axe', 'his head lolling to one side, the axe hanging lower', 'a slow, heavy overhead chop with the rusted axe toward the right', 'flinching from a blow while still facing right, the kelp in his hair swinging, still holding the axe')
c('deep_spawn', 'red_tide', 7, 'Deep Spawn', 'Порождение глубин', 'big', 'a hulking deep spawn brute born of the sea: thick grey-blue hide, pale coral growing out of its shoulders, webbed clawed hands, a heavy rusted anchor chain wound round its right forearm, a very faint turquoise glint in its small eyes', 'its chest heaving, the chain swinging a little', 'swinging the anchor chain in a wide sweeping arc toward the right')

# ---- The land's and the sea's creatures (docs/18, in the game) -------------------------------------------------------
c('crab', 'wild', 1, 'Giant Crab', 'Гигантский краб', 'beast', 'a giant armoured shore crab as big as a hound, a dark red-brown barnacled shell, big raised claws toward the right', 'its claws opened a little wider, eyestalks turned', 'lunging toward the right and snapping its big claw shut', 'pulling back while still facing right, its claws drawn in before its shell')
c('gull', 'wild', 1, 'Giant Gull', 'Гигантская чайка', 'fly', 'a giant grey sea gull with a hooked grey-yellow beak, its wings spread wide, flying toward the right', 'its wings at the bottom of their beat', 'diving toward the right beak first, talons thrust forward')
c('seal', 'wild', 2, 'Bull Seal', 'Морской котик', 'beast', 'a big scarred grey bull seal with a thick neck and whiskers, propped up on its front flippers, head toward the right', 'its head lifted, nostrils flared', 'rearing up and slamming forward toward the right with open jaws')
c('reef_shark', 'wild', 2, 'Reef Shark', 'Рифовая акула', 'water', 'a reef shark, its head and upper body out of the water, facing right', 'its jaws opened a little, water streaming off it', 'lunging out of the water toward the right with jaws wide open')
c('rock_turtle', 'wild', 3, 'Rock Turtle', 'Каменная черепаха', 'beast', 'a massive land turtle whose high shell is crusted with grey stones and lichen, thick scaly legs, its head toward the right', 'its neck stretched out a little further', 'snapping forward toward the right with its hooked beak, neck at full stretch', 'pulling its head half into its shell while still facing right')
c('sea_turtle', 'wild', 3, 'Sea Turtle', 'Морская черепаха', 'beast', 'a great sea turtle with a barnacled domed shell and long front flippers, its head toward the right', 'its front flippers lifted a little', 'biting forward toward the right, flippers spread', 'pulling its head half into its shell while still facing right')
c('marsh_serpent', 'wild', 3, 'Marsh Serpent', 'Болотный змей', 'beast', 'an olive-brown marsh serpent, its coils on the ground and its head reared high, facing right, a hood of scales spread', 'its head swaying a little lower', 'striking toward the right with fangs bared')
c('hermit', 'wild', 4, 'Island Hermit', 'Островной отшельник', 'man', 'a wild island castaway gone savage: tattered rags, a long matted grey beard, a rope belt, barefoot, a bundle of short rusted harpoons on his back and one in his hand', 'the harpoon lifted to his shoulder', 'hurling the short harpoon toward the right')
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
# The Crown's elites (owner, 2026-10-03: «около 100 существ»; docs/18 VII): the healer, the luck-bringer, the binder.
c('crown_surgeon', 'crown', 1, "Surgeon's Mate", 'Лекарский помощник', 'man', "a Crown naval surgeon's mate in a navy-blue coat with white facings and rolled sleeves under a stained canvas apron, a leather satchel of rolled bandages and wooden splints at his hip with a corked rum bottle in it, a short curved hanger in his right hand", 'the satchel hitched higher, the hanger lowered', 'a quick cut with the hanger toward the right')
c('crown_midshipman', 'crown', 1, 'Signal Midshipman', 'Сигнальный мичман', 'man', "a young Crown signal midshipman in a short navy-blue jacket with white collar patches and a small black cocked hat, a bundle of rolled bright signal flags under his left arm, a slim midshipman's dirk with a brass hilt in his right hand", 'the flags tucked tighter under his arm, the dirk lifted a little', 'a quick dirk thrust toward the right, the signal flags still under his arm')
c('crown_provost', 'crown', 2, 'Provost Marshal', 'Профос', 'man', 'a stern Crown provost marshal in a navy-blue greatcoat with a white crossbelt and a black tricorne, a ring of iron manacles on a short chain at his belt, a heavy brass-bound baton in his right hand', 'the baton tapped against his left palm', 'a heavy overhead blow of the brass-bound baton toward the right, the manacles swinging at his belt')
# The second dozen (owner, 2026-10-04: «еще больше … существ»), four to a sheet (QUADS below): the boarding pikemen.
c('crown_pikeman', 'crown', 2, 'Boarding Pikeman', 'Абордажный пикинёр', 'man', 'a Crown boarding pikeman in a navy-blue coat with white crossbelts and a round black-lacquered steel helmet, a long boarding pike with a narrow steel head held low in both hands', 'the pike point lifted a little', 'a long two-handed pike thrust toward the right')

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
# The Choir's elites (2026-10-03, docs/18 VII): the healer, the binder, the drinker of strength.
c('brine_sister', 'choir', 1, 'Sister of the Brine', 'Сестра рассола', 'man', 'a sister of the brine: a barefoot woman of the Choir in a sodden grey-green habit and a wimple of fishing net hung with small shells, a bundle of dried kelp bandages at her rope girdle, a short hooked knife of pale shell in her right hand', 'the kelp bundle lifted in her free hand', 'a quick slash with the hooked shell knife toward the right')
c('choir_toller', 'choir', 3, 'Toller of the Drowned Bell', 'Звонарь утопшего колокола', 'man', 'a hooded toller of the drowned god: a broad man in a sodden black robe, a small barnacled green-bronze bell hung from a short pole on his back so it rises over his shoulder (part of the figure in every frame), a long iron hammer in both hands', 'the hammer drawn back, the bell swaying a little', 'swinging the hammer up to strike the bell, a faint ring of rippling air rolling out of it toward the right')
c('lamprey_zealot', 'choir', 2, 'Lamprey Zealot', 'Фанатик-минога', 'man', "a zealot of the drowned god in a sodden dark robe, the face hidden behind a round grey leather mask with a lamprey's ring of small hooked teeth around its mouth hole, a short barbed spear", 'the masked head tilted, the spear point lowered', 'a hard thrust of the barbed spear toward the right')
# The second dozen (2026-10-04): the rime witches.
c('rime_witch', 'choir', 3, 'Rime Witch', 'Ведьма инея', 'man', 'a rime witch of the Choir: a gaunt pale woman in a sodden grey-blue shawl of fishing net furred with white frost, long white hair stiff with ice, a staff of pale driftwood tipped with a cluster of ice crystals', 'the frost on her shawl glinting, the staff tilted', 'thrusting the staff toward the right, a spray of freezing brine and white frost bursting from its tip')

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
# The Order's life guard, filled (2026-10-03, docs/18 VII), its preceptors and the try-pot men.
c('harpoon_preceptor', 'harpoon', 2, 'Preceptor of the Order', 'Прецептор Ордена', 'man', 'a preceptor of the Order of the Harpoon: a grey-bearded knight in dark riveted leather and polished baleen plates, a long white cloak with a black harpoon sigil, a tall standard pole tipped with a barbed harpoon head and hung with a small white pennant', 'the pennant stirring, the standard planted upright', 'thrusting the harpoon head of the standard toward the right')
c('harpoon_commander', 'harpoon', 6, 'Knight-Commander', 'Рыцарь-командор', 'man', 'a knight-commander of the Order of the Harpoon in heavy plate of bleached whalebone over dark leather, a helm crested with a short narwhal tusk, a long two-handed harpoon-glaive with a barbed blade', 'the harpoon-glaive lifted onto his shoulder', 'a sweeping cut of the harpoon-glaive toward the right')
c('try_pot', 'harpoon', 4, 'Try-Pot Man', 'Котловой', 'man', 'a try-pot man of the whalers: a soot-stained brute in a scorched leather apron and heavy gloves, a small iron try-pot of steaming whale oil hung on a chain at his side (part of the figure in every frame), a long iron ladle in his right hand', 'the ladle dipped toward the pot, steam rising from it', 'flinging a ladle of hot oil toward the right in a short arc of steaming amber droplets')
# The second dozen (2026-10-04): the line harpooners and the masters of the hunt.
c('line_harpooner', 'harpoon', 3, 'Line Harpooner', 'Гарпунёр с линём', 'man', 'a line harpooner of the Order: a lean whaler in a short tarred jacket and a knitted cap, a small tub of coiled whale line at his hip (part of the figure in every frame), a light barbed harpoon made fast to the line in his right hand', 'the line paid out a little between his fingers', 'hurling the harpoon toward the right, the line snaking out behind it')
c('hunt_master', 'harpoon', 3, 'Master of the Hunt', 'Мастер охоты', 'man', 'a master of the hunt of the Order of the Harpoon: a broad grey-bearded whaler in a long oilskin coat over plates of polished baleen, a great curved horn of whale ivory slung at his side, a heavy barbed harpoon in his right hand', 'raising the ivory horn toward his lips', 'hurling the heavy harpoon toward the right, its line trailing')

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
# The Brokers' elites (2026-10-03, docs/18 VII): the cutpurses, the cardsharps, the vipers.
c('fog_cutpurse', 'brokers', 1, 'Cutpurse', 'Карманник', 'man', 'a wiry Fog Broker cutpurse in a patched dark grey coat with deep pockets and a low grey cap pulled down over the eyes, a small hooked purse-knife in his right hand', 'crouched a little lower, the knife hidden along his wrist', 'a quick darting slash with the hooked knife toward the right')
c('fog_cardsharp', 'brokers', 1, 'Cardsharp', 'Шулер', 'man', 'a smiling Fog Broker cardsharp in a faded wine-dark waistcoat with a loose cravat and a battered grey top hat, a fan of playing cards in his left hand, a short thin stiletto in his right', 'the cards fanned wider, a die rolling across his knuckles', 'a quick stiletto thrust toward the right, the cards still fanned in his other hand')
c('fog_viper', 'brokers', 3, 'Fog Viper', 'Туманная гадюка', 'man', 'a lithe Fog Broker viper in a close charcoal hood and a scarf of grey-green scale pattern over the lower face, a belt of small stoppered green vials, a long slim blowpipe banded with green', 'the blowpipe lowered, the hooded head turned', 'blowing a dart through the blowpipe toward the right')
# The second dozen (2026-10-04): the fog chemists.
c('fog_chemist', 'brokers', 3, 'Fog Chemist', 'Туманный химик', 'man', 'a Fog Broker chemist in a long grey leather coat and a hood, a cloth mask over the mouth and round smoked-glass goggles, a bandolier of round glass flasks swirling with pale fog, one flask in his raised hand', 'the flask swirled, a wisp of grey fog curling from its stopper', 'hurling the fog flask toward the right, a trail of grey vapour behind it')

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
# The Ledger's guns, filled (2026-10-03, docs/18 VII), and the factors.
c('company_cannoneer', 'league', 4, 'Company Cannoneer', 'Канонир Компании', 'man', 'a cannoneer of the Gilded Ledger in a black coat with gold buttons and a gold-banded hat, standing beside a small swivel gun with a gilded barrel on a short black post (the gun is part of the figure and stands beside him in every frame), a brass linstock in his hand', 'the linstock lifted, smoke curling from its match', 'touching the linstock to the gilded swivel gun, which fires toward the right with a small bright flash and a puff of grey smoke, the cannoneer leaning away')
c('petardier', 'league', 4, 'Petardier', 'Петардист', 'man', 'a Ledger petardier in a black leather jerkin with gold piping and a plain steel cap, a satchel of small brass-cased petards at his hip, one lit petard in his right hand', 'the petard hand drawn back a little, the fuse sparking', 'hurling the lit brass petard overarm toward the right, the fuse sparking')
c('ledger_factor', 'league', 3, 'Company Factor', 'Фактор Компании', 'man', 'a factor of the Gilded Ledger: a lean clerkly man in a long black coat with gold frogging and a high collar, small round spectacles, a heavy ledger held under his left arm, a long gilded pistol in his right hand', 'glancing down at the ledger under his arm, the pistol lowered', 'firing the gilded pistol toward the right, a small bright muzzle flash and a puff of grey smoke, the ledger still under his arm')
# The second dozen (2026-10-04): the bounty hunters.
c('bounty_hunter', 'league', 2, 'Bounty Hunter', 'Охотник за наградой', 'man', 'a Ledger bounty hunter in a black leather coat with gold buttons and a wide black hat, a weighted net gathered over his left shoulder, a heavy iron-bound cudgel in his right hand', 'the net gathered in his left hand, the cudgel tapping his boot', 'flinging the weighted net open toward the right, the cudgel raised behind it')

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
# The islands' elites (2026-10-03, docs/18 VII): the reef raiders, the shark dancers, the elders.
c('reef_raider', 'free', 2, 'Reef Raider', 'Рифовый налётчик', 'man', 'a lean island reef raider tattooed with dark wave patterns, a woven fibre kilt and a collar of white shells, a short wooden club edged with sharp grey coral in each hand', 'both coral clubs lifted a little, his chest risen', 'leaping forward to the right with both coral clubs swinging in a cross')
c('shark_dancer', 'free', 1, 'Shark Dancer', 'Танцующий с акулами', 'man', 'an island shark dancer: a lithe warrior with rows of shark-tooth tattoos down his arms, a band of grey sharkskin round his brow and a short woven skirt, a curved knife of shark teeth set in dark wood in each hand', 'his weight shifted onto one foot as in a dance, both knives crossed low', 'a spinning slash with both shark-tooth knives toward the right')
c('island_elder', 'free', 1, 'Island Elder', 'Старейшина острова', 'man', 'an island elder and healer: a white-haired old man with deep tattoos on his face and arms, a cloak of woven palm fibre and dark feathers, a pouch of dried herbs at his belt, a tall staff of dark carved wood topped with a carved sea turtle', 'leaning on the staff, the feathers of his cloak stirring', 'striking the carved staff down toward the right')
# The second dozen (2026-10-04): the stone-axe warriors, the masked archers, the island chiefs.
c('stone_axeman', 'free', 2, 'Stone-Axe Warrior', 'Воин с каменными топорами', 'man', 'an island stone-axe warrior: a broad tattooed man in a woven fibre cuirass and a collar of white shells, a hafted axe of polished black stone in each hand', 'both axes lifted a little, his chest risen', 'two crossing chops of the stone axes toward the right')
c('mask_archer', 'free', 3, 'Masked Archer', 'Лучник в маске', 'man', 'an island archer in a tall carved wooden spirit mask painted with dark wave spirals and fringed with dried palm fibre, a woven fibre cuirass, a tall bow of dark wood', 'an arrow nocked, the masked head tilted', 'loosing an arrow toward the right, the bow at full draw')
c('island_chief', 'free', 4, 'Island Chief', 'Вождь острова', 'man', 'an island chief: a tall powerful man with a face of deep tattoos, a long cloak of dark feathers over his shoulders, a broad collar of white shells, a great war club of dark carved wood inlaid with mother-of-pearl', 'the war club lifted onto his shoulder, his chin raised', 'a sweeping blow of the great war club toward the right')

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

# The islands' great beasts of the grottos and the guardians' seats (2026-10-03: the world's richness).
c('crab_queen', 'wild', 5, 'Coconut Crab Queen', 'Королева пальмовых крабов', 'beast', 'a colossal coconut crab queen with a deep blue and orange armoured shell crusted with barnacles and pale coral, thick jointed legs, two huge uneven claws toward the right', 'one great claw raised high', 'smashing her great claw down toward the right')
c('cave_wyrm', 'wild', 6, 'Cave Wyrm', 'Пещерный змей', 'beast', 'a long pale blind cave wyrm with milky white scales, a heavy sinuous body on short clawed legs, a long narrow head toward the right with small sightless eyes', 'its head raised, tasting the air', 'lunging toward the right with its jaws wide')
c('mangrove_hydra', 'wild', 6, 'Mangrove Hydra', 'Мангровая гидра', 'big', 'a three-headed swamp hydra with olive-green and brown mottled scales, three long necks rising from a heavy low body, moss and weed hanging from its back, all three heads toward the right', 'its three heads swaying apart', 'all three heads striking toward the right with jaws wide', 'recoiling from a blow while still facing right: its three heads pulled back, its body hunched low')
c('ape_king', 'wild', 7, 'Ape King', 'Король обезьян', 'big', 'a colossal old silverback ape king, grey and scarred, a crown of coral and carved stone on his head and strings of shells round his neck, knuckles on the ground, facing right', 'rising up and beating his chest', 'rearing up and smashing both fists down toward the right', 'reeling back from a heavy blow while still facing right: leaning back, shoulders hunched')
c('storm_roc', 'wild', 7, 'Storm Roc', 'Грозовой рух', 'fly', 'a colossal storm roc, a giant bird of prey with slate-grey and white feathers, a hooked dark beak and great talons, faint sparks of lightning along its wings, flying toward the right', 'its great wings tilted the other way', 'diving toward the right, talons forward and beak open')

# ---- Premium (owner, 2026-10-03: «премиум существа за премиум валюту много»; «уникальные существа для этого корабля») ---------
# Each premium ship's own kind (tools/art/ships.py), then the shop's own creatures; sold only for the premium currency.
c('corsair_phantom', 'premium_ship', 5, 'Corsair Phantoms', 'Фантомы корсара', 'man', 'a shadowy corsair duellist in a black long coat with a deep crimson sash, a black half-mask and a thin rapier, faint dark smoke trailing from his coat-tails', 'the rapier raised in salute', 'lunging toward the right with a swift rapier thrust')
c('dragon_lancer', 'premium_ship', 4, 'Dragon Lancers', 'Драконьи копейщики', 'man', 'an eastern marine in lacquered dark red scale armour and a round helmet, holding a long bamboo fire lance with a tube of black powder at its tip', 'the fire lance lowered, its fuse smoking', 'thrusting the fire lance toward the right as it spurts a short tongue of flame')
c('iron_marine', 'premium_ship', 5, 'Ironclad Marines', 'Закованные морпехи', 'man', 'a huge marine in heavy riveted black iron plate armour over a tarred coat, a closed iron helm with a slit visor, a heavy boarding axe', 'the axe lifted onto his shoulder', 'swinging the heavy boarding axe toward the right')
c('storm_caller', 'premium_ship', 5, 'Storm Callers', 'Призыватели бури', 'man', 'a gaunt sailor in a rain-soaked oilskin coat holding a tall copper rod crackling with small blue sparks at its tip', 'the copper rod raised, sparks running down it', 'thrusting the rod toward the right as a small bolt of lightning leaps from its tip')
c('sea_wyvern', 'premium_ship', 6, 'Sea Wyvern', 'Морская виверна', 'fly', 'a sea wyvern with grey-green scales, membranous wings like a ray, a long finned tail and a crested head, flying toward the right', 'its wings at the top of their beat', 'diving toward the right, jaws open and talons forward')
c('war_orca', 'premium_ship', 6, 'War Orca', 'Боевая косатка', 'water', 'a huge black-and-white orca rising out of the sea in an iron-studded leather harness, facing right', 'its head higher out of the water, mouth slightly open', 'lunging toward the right out of the water with its jaws open')
c('crimson_guard', 'premium_ship', 6, 'Crimson Guard', 'Багровая гвардия', 'man', 'an elite pirate guardsman in a long deep-red coat with black facings, a black steel breastplate and a red-plumed black tricorne, a long halberd', 'the halberd planted upright', 'sweeping the halberd toward the right')
c('mist_wraith', 'premium_ship', 4, 'Mist Wraith', 'Туманный призрак', 'fly', 'a wraith made of swirling grey sea mist in the shape of a hooded sailor, faint pale eyes, no face, trailing ragged mist instead of legs, hovering', 'its misty form swirling wider', 'reaching toward the right with long misty arms')
c('storm_berserker', 'premium_ship', 5, 'Storm Berserkers', 'Штормовые берсерки', 'man', 'a huge bare-chested raider with storm-blue war paint in jagged stripes, braided hair and beard, a bearskin over his shoulders, a heavy two-handed axe', 'roaring with the axe lifted high', 'swinging the two-handed axe down toward the right')
c('sun_guard', 'premium_ship', 6, 'Sun Guard', 'Солнечная стража', 'man', 'a Crown knight-marine in a gilded breastplate and helmet engraved with suns, a white and gold surcoat, a round shield with a golden sun and a long sword', 'the shield raised, the sword resting on it', 'striking toward the right with the long sword behind the sun shield')
c('gilded_golem', 'premium_ship', 6, 'Gilded Golem', 'Позолоченный голем', 'big', 'a towering automaton of riveted brass and tarnished gold plates with a furnace glow in its chest, heavy fists, facing right', 'its chest furnace flaring brighter', 'slamming a heavy brass fist toward the right', 'reeling back from a heavy blow while still facing right, plates rattling')
c('spice_djinn', 'premium_ship', 6, 'Spice Djinn', 'Пряный джинн', 'fly', 'a djinn of swirling saffron and cinnamon-coloured smoke, a bearded torso with gold armbands rising from a smoky tail, glowing amber eyes, facing right', 'its smoky arms spread wide', 'hurling a swirl of burning spice smoke toward the right')
c('silk_blade', 'premium_ship', 4, 'Silk Blades', 'Шёлковые клинки', 'man', 'a lithe duellist in flowing dark blue silk robes and a sash, a curved sword in each hand, a silk scarf over the lower face', 'both blades crossed before the chest', 'whirling forward toward the right with both blades slashing')
c('night_smuggler', 'premium_ship', 3, 'Night Smugglers', 'Ночные контрабандисты', 'man', 'a smuggler in a dark hooded oilskin and a scarf, a shuttered lantern at the belt and a short blunderbuss', 'the blunderbuss lowered, glancing aside', 'firing the blunderbuss toward the right with a burst of smoke')
c('pearl_siren', 'premium_ship', 5, 'Pearl Sirens', 'Жемчужные сирены', 'water', 'a mermaid with pale pearl-white scales and long dark hair threaded with pearls, rising from the water with a spear of white coral, facing right', 'her spear raised, hair swaying', 'thrusting the coral spear toward the right')
c('bazaar_monkeys', 'premium_ship', 1, 'Bazaar Monkeys', 'Базарные мартышки', 'beast', 'a small band of three thieving capuchin monkeys in tiny red fezzes and vests, one clutching a stolen purse, facing right', 'one monkey scratching, another chattering', 'all three leaping toward the right, grabbing and biting')
c('rum_brawler', 'premium_ship', 3, 'Rum Brawlers', 'Ромовые драчуны', 'man', 'a burly red-faced pirate brawler with rolled sleeves, a rum bottle in one fist and a heavy belaying pin in the other', 'swigging from the bottle', 'swinging the belaying pin toward the right')
c('ledger_enforcer', 'premium_ship', 5, 'Ledger Enforcers', 'Взыскатели', 'man', 'a grim Brokers enforcer in a long black coat with silver buttons and a grey tricorne, a heavy iron-bound ledger chained to his belt, a brace of pistols', 'checking the ledger, a pistol in the other hand', 'firing both pistols toward the right')
c('jade_guard', 'premium_ship', 5, 'Jade Guards', 'Нефритовая стража', 'man', 'an eastern guard in green-lacquered armour with jade plates, a tall glaive with a curved blade, a fierce lacquered half-mask', 'the glaive held across the body', 'sweeping the glaive toward the right')
c('vault_crab', 'premium_ship', 5, 'Vault Crab', 'Краб-хранитель', 'beast', 'a giant crab whose shell is an iron-bound treasure strongbox with a heavy padlock, gold coins spilling from the seams, big claws toward the right', 'its claws opened wide', 'snapping its great claw toward the right')
c('giant_hawk', 'premium_ship', 4, 'Giant Sea Hawk', 'Гигантский морской ястреб', 'fly', 'a giant sea hawk with brown and white barred plumage, a hooked beak and great talons, flying toward the right', 'its wings tilted the other way', 'diving toward the right, talons forward')
c('wind_sprite', 'premium_ship', 3, 'Wind Sprites', 'Духи ветра', 'fly', 'a pale translucent wind sprite like a small whirling figure of air and sea spray with long streaming hair, faint and glimmering, hovering', 'its form spinning wider', 'darting toward the right in a sharp gust')
c('great_white', 'premium_ship', 5, 'Great White', 'Большая белая', 'water', 'a great white shark bursting from the water, a scarred grey back and white belly, rows of teeth, facing right', 'its jaws opened a little, water streaming off it', 'lunging out of the water toward the right with its jaws wide')
c('ghost_navigator', 'premium_ship', 4, 'Ghost Navigators', 'Призрачные штурманы', 'man', 'a pale ghostly navigator in a faded blue coat, grey and translucent at the edges, holding a brass sextant and a long old pistol', 'raising the sextant to his eye', 'firing the long pistol toward the right with a pale grey flash')
c('flying_fish', 'premium_ship', 1, 'Flying Fish', 'Летучие рыбы', 'fly', 'a shoal of five silver flying fish gliding together over a splash of water on wide wing-like fins, facing right', 'the fish banking the other way', 'darting toward the right together')
c('white_albatross', 'premium_ship', 5, 'White Albatross', 'Белый альбатрос', 'fly', 'a huge pure-white albatross with long narrow wings and a pale golden beak, a faint silver sheen on its feathers, flying toward the right', 'its wings tilted the other way', 'diving toward the right with its beak open')
c('silver_archer', 'premium_ship', 4, 'Silver Archers', 'Серебряные лучники', 'man', 'a lean archer in a grey hooded cloak over silver-grey scale armour, a tall recurve bow of pale wood with silver tips', 'nocking an arrow', 'drawing and loosing an arrow toward the right')
c('storm_petrels', 'premium_ship', 2, 'Storm Petrels', 'Буревестники', 'fly', 'a flock of four dark storm petrels flying close together, sooty grey with white rumps, facing right', 'the flock banking the other way', 'swooping toward the right together, beaks open')
c('mermaid_queen', 'premium_ship', 6, 'Mermaid Queen', 'Королева русалок', 'water', 'a regal mermaid with sea-green scales, a crown of coral and pearls and a trident of white shell, rising tall from the water, facing right', 'her trident raised, her hair floating', 'hurling a jet of water from her trident toward the right')
c('sea_viper', 'premium_ship', 4, 'Sea Viper', 'Морская гадюка', 'water', 'a giant banded sea viper rising out of the water, black and pale yellow bands, a flat paddle tail, facing right', 'its head swaying back, tongue flicking', 'striking toward the right with its fangs bared')
c('leviathan_calf', 'premium_ship', 6, 'Leviathan Calf', 'Детёныш левиафана', 'water', 'a young leviathan rising from the sea, a long armoured blue-grey body with plated ridges and small fins, wide jaws, facing right', 'its head rising higher, gills flaring', 'lunging toward the right with its jaws wide')
c('turtle_knight', 'premium_ship', 5, 'Turtle Knights', 'Черепашьи рыцари', 'man', 'a warrior in armour made from great turtle shell plates, a round shell shield and a heavy short spear, a shell-ridged helmet', 'the shell shield raised', 'thrusting the spear toward the right from behind the shield')
c('bastion_gunner', 'premium_ship', 5, 'Bastion Gunners', 'Бастионные канониры', 'man', 'a stout gunner in a stone-grey coat and a steel morion helmet, carrying a short heavy hand-cannon on his shoulder, a smouldering match cord', 'the hand-cannon lowered, blowing on the match', 'firing the hand-cannon toward the right with a burst of smoke')
c('sea_chimera', 'premium_ship', 7, 'Sea Chimera', 'Морская химера', 'big', "a monstrous sea chimera with a lion's maned head and forelegs, a shark's grey body and tail and folded eagle wings, standing on the deck, facing right", 'roaring with its wings half-spread', 'pouncing toward the right with claws and jaws', 'recoiling from a blow while still facing right, wings flung up')
c('whale_calf', 'premium_ship', 5, 'Whale Calf', 'Китёнок', 'water', 'a young grey-blue whale calf breaching from the water, a white belly with grooves, a gentle eye, facing right', 'blowing a spout of spray', 'ramming toward the right with its head')
c('coral_elemental', 'premium_ship', 6, 'Coral Elemental', 'Коралловый элементаль', 'big', 'a towering humanoid shape grown of living pink and orange coral, sea anemones and barnacles, glowing faintly within, facing right', 'its coral arms rising', 'slamming a coral-crusted fist toward the right', 'reeling back from a heavy blow while still facing right, coral chips flying')
c('bell_priest', 'premium_ship', 5, 'Bell Priests', 'Колокольные жрецы', 'man', 'a gaunt priest of the Choir in grey wet robes with a tarnished bronze hand bell, kelp in the hair and a faint green glow in the eyes', 'raising the bell to ring it', 'ringing the bell toward the right as a ghostly ripple of sound rolls out')
c('jade_dragon', 'premium_ship', 7, 'Jade Dragon', 'Нефритовый дракон', 'fly', 'a long eastern dragon with jade-green scales, golden whiskers and a pearl in its claw, its serpentine body coiling in the air, facing right', 'its body coiling the other way', 'lunging toward the right with its jaws open, breathing a gust of mist')
c('pirate_lord', 'premium_ship', 7, 'Pirate Lords', 'Пиратские лорды', 'man', 'a towering pirate lord in a long black velvet coat embroidered with gold, a great plumed hat, a jewelled cutlass and a brace of gilded pistols, a commanding scarred face', 'his hand on his hip, chin raised', 'cutting toward the right with the jewelled cutlass')
c('bell_diver', 'premium_ship', 5, 'Bell Divers', 'Водолазы', 'man', 'a diver in a heavy brass diving helmet with round windows and a canvas suit, weighted boots, a short heavy harpoon gun', 'the harpoon gun lowered, bubbles rising from his helmet valve', 'firing the harpoon gun toward the right')
c('sea_dragon', 'premium', 7, 'Sea Dragon', 'Морской дракон', 'fly', 'a great sea dragon with dark blue-green scales, finned wings, a long tail ending in a fin and a crested horned head, flying toward the right', 'its wings at the top of their beat', 'diving toward the right breathing a jet of steaming sea water')
c('hippocampus', 'premium', 5, 'Hippocampus', 'Гиппокамп', 'water', 'a hippocampus — the front half of a sea-grey horse with a finned mane and webbed hooves, the back half a long scaled fish tail — rearing from the water, facing right', 'its finned mane flaring', 'rearing and striking toward the right with its webbed hooves')
c('kraken_spawn', 'premium', 6, 'Kraken Spawn', 'Отпрыск кракена', 'water', 'a young kraken rising from the water, a dark red mantle and eight thick arms lashing up around it, a great golden eye, facing right', 'its arms curling differently', 'lashing its arms toward the right')
c('dragon_turtle', 'premium', 7, 'Dragon Turtle', 'Драконья черепаха', 'beast', "a colossal dragon turtle with a craggy domed shell crusted with coral, a dragon's horned head and a long neck, heavy clawed feet, facing right", 'its neck stretching, smoke curling from its nostrils', 'lunging its head toward the right breathing a cloud of steam')
c('storm_eagle', 'premium', 6, 'Storm Eagle', 'Грозовой орёл', 'fly', 'a giant eagle with storm-grey plumage, white-tipped wings crackling with small sparks and fierce yellow eyes, flying toward the right', 'its wings tilted the other way', 'diving toward the right with its talons forward and lightning flickering on its wings')
c('coral_basilisk', 'premium', 5, 'Coral Basilisk', 'Коралловый василиск', 'beast', 'a coral basilisk — a long six-legged lizard covered in spiny pink and grey coral growths, a crested head with pale stony eyes, facing right', 'its crest raised, tongue flicking', 'lunging toward the right with its jaws wide')
c('abyssal_angler', 'premium', 6, 'Abyssal Angler', 'Глубинный удильщик', 'water', 'a huge deep-sea anglerfish rising from dark water, a gaping mouth of long needle teeth and a glowing pale blue lure on a stalk, facing right', 'its lure swaying', 'lunging toward the right with its jaws gaping')
c('frost_serpent', 'premium', 6, 'Frost Serpent', 'Ледяной змей', 'water', 'a great sea serpent with pale ice-blue scales and frost on its crest, rising out of cold water in coils, facing right', 'its head swaying back, breath misting', 'striking toward the right breathing a cloud of freezing mist')
c('golden_crab', 'premium', 4, 'Golden Crab', 'Золотой краб', 'beast', 'a large crab whose shell gleams like old gold with a dark patina, jewelled with small barnacles, big claws toward the right', 'its claws opened wider', 'snapping its big claw toward the right')
c('thunderbird', 'premium', 7, 'Thunderbird', 'Громовая птица', 'fly', 'a colossal thunderbird with dark storm-grey and white feathers, a hooked beak and lightning running along its wings, flying toward the right', 'its wings raised high, thunder rumbling', 'diving toward the right as a bolt of lightning cracks from its wings')
c('nautilus_knight', 'premium', 6, 'Nautilus Knight', 'Рыцарь-наутилус', 'man', 'a knight in armour shaped from great spiral nautilus shells, striped cream and rust, a helm like a shell, a long trident', 'the trident held upright', 'thrusting the trident toward the right')
c('siren_queen', 'premium', 6, 'Siren Queen', 'Королева сирен', 'fly', 'a siren queen with great dark feathered wings, a pale face, long black hair and a crown of shells, hovering above the waves, facing right', 'her wings spread wide, singing', 'swooping toward the right with her talons forward')
c('giant_manta', 'premium', 4, 'Giant Manta', 'Гигантский скат', 'fly', 'a giant manta ray gliding through the air above the sea, dark on top and pale beneath, its wide wing-fins spread, facing right', 'its wings curling at the tips', 'swooping toward the right, wings sweeping down')
c('tidal_elemental', 'premium', 6, 'Tidal Elemental', 'Приливной элементаль', 'big', 'a towering figure made of surging green-grey sea water and foam with a dark rocky core, arms of breaking waves, facing right', 'its watery body swelling higher', 'crashing a wave-arm down toward the right', 'reeling back from a blow while still facing right, spray flying')
c('ember_salamander', 'premium', 4, 'Ember Salamander', 'Огненная саламандра', 'beast', 'a large black salamander with glowing orange cracks along its body like cooling lava, a wide head and a long tail, facing right', 'its body glowing brighter', 'lunging toward the right and spitting a gout of embers')
c('obsidian_golem', 'premium', 6, 'Obsidian Golem', 'Обсидиановый голем', 'big', 'a towering golem of glossy black volcanic glass and basalt with faint red light in its cracks, heavy fists, facing right', 'its cracks glowing brighter', 'slamming a glassy black fist toward the right', 'reeling back from a heavy blow while still facing right, black shards flying')
c('lava_drake', 'premium', 6, 'Lava Drake', 'Лавовый дракон', 'fly', 'a lava drake with dark basalt scales, glowing ember-orange wing membranes and a smouldering tail, flying toward the right', 'its wings at the top of their beat, embers falling', 'diving toward the right breathing a short gout of fire')
c('sea_wolf', 'premium', 4, 'Sea Wolf', 'Морской волк', 'beast', 'a big grey wolf with a finned ridge down its back, webbed paws and kelp tangled in its wet fur, crouched to spring, facing right', 'its hackles raised, snarling', 'leaping toward the right with its jaws open')
c('abyss_knight', 'premium', 7, 'Abyss Knight', 'Рыцарь бездны', 'man', 'a towering knight in dark barnacle-crusted plate armour with a faint turquoise glow in the visor slit, a long cloak of kelp and a great sword', 'the great sword planted point-down before him', 'cutting toward the right with the great sword')
# The shop's second dozen (owner, 2026-10-04: «еще больше … существ»), four to a sheet (QUADS below).
c('lantern_jelly', 'premium', 4, 'Lantern Jelly', 'Фонарная медуза', 'water', 'a giant pale jellyfish rising out of the water, a tall translucent bell glowing with a soft blue-green light from within and long trailing stinging tendrils, facing right', 'its bell pulsing a little smaller, the tendrils drifting the other way', 'lashing its long tendrils out toward the right in a crackle of pale light')
c('mantis_shrimp', 'premium', 4, 'Giant Mantis Shrimp', 'Гигантский рак-богомол', 'beast', 'a giant mantis shrimp as big as a hound, an armoured segmented body in deep green, orange and blue, stalked eyes, two folded club-like forelimbs held ready, its head toward the right', 'its stalked eyes swivelling, its clubs folded tighter', 'punching both club-like forelimbs out toward the right in a blur')
c('hammerhead', 'premium', 4, 'Hammerhead Shark', 'Акула-молот', 'water', 'a big grey hammerhead shark rising out of the water, its wide hammer-shaped head with dark eyes at the tips, a tall dorsal fin, facing right', 'its head swinging the other way', 'snapping its jaws forward toward the right')
c('walrus_bull', 'premium', 5, 'Walrus Bull', 'Морж-вожак', 'beast', 'a huge scarred walrus bull with long ivory tusks, thick folded brown hide and bristling whiskers, rearing on its front flippers, its head toward the right', 'its head lifted, whiskers twitching', 'driving its long tusks down toward the right')
c('merrow_warden', 'premium', 5, 'Merrow Warden', 'Страж мерроу', 'man', 'a merrow warden: a tall sea-folk warrior with blue-grey scaled skin, a finned crest, webbed hands and wide dark eyes, armour of overlapping shells and a long coral-tipped trident', 'the trident lifted upright, his crest raised', 'a hard thrust of the trident toward the right')
c('sea_naga', 'premium', 5, 'Sea Naga', 'Морская нага', 'water', 'a sea naga rising out of the water: the upper body of a woman with dark green scales, long black hair and gold armbands above a long serpent tail coiled in the sea, a curved bronze sword in each hand, facing right', 'her tail coiling a little higher, the swords crossed', 'two crossing cuts of the curved swords toward the right')
c('brass_automaton', 'premium', 5, 'Brass Automaton', 'Латунный автомат', 'big', 'a tall brass automaton marine: a riveted body of tarnished brass and iron plates with a small glowing furnace grate in its chest, a round shield on its left arm and a heavy brass mace in its right', 'a puff of steam from its shoulder vents, the shield raised a little', 'a heavy blow of the brass mace toward the right from behind the shield')
c('storm_giant', 'premium', 6, 'Storm Giant', 'Штормовой великан', 'big', 'a storm giant: a towering bearded giant with grey skin, long wild hair streaming as in a gale, a kilt of old sailcloth and a great iron anchor-hook for a weapon, small sparks of lightning crawling over his arms', 'his hair streaming the other way, sparks at his fingertips', 'swinging the anchor-hook toward the right, a crackle of lightning running down it')
c('ember_phoenix', 'premium', 6, 'Ember Phoenix', 'Угольный феникс', 'fly', 'an ember phoenix: a great bird of prey with smouldering dark red and charcoal feathers, glowing ember-orange edges on its wings and a long trailing tail of embers, flying toward the right', 'its wings at the top of their beat, embers drifting', 'diving toward the right, talons forward and a burst of embers from its wings')
c('megalodon', 'premium', 7, 'Megalodon', 'Мегалодон', 'water', 'a colossal ancient shark rising out of the sea, a scarred slate-grey back, a pale belly and a vast jaw of serrated teeth, facing right', 'its jaws closing, water streaming from its snout', 'lunging toward the right with its vast jaws wide open')
c('marid', 'premium', 7, 'Marid', 'Марид', 'water', 'a marid, a djinn of the sea: a towering bearded torso of deep blue-green skin with gold armbands and a turban, rising out of the water on a swirling column of sea water and foam, facing right', 'its arms folded, the water of its column swirling', 'thrusting both hands toward the right, a wave of foaming sea water surging from its palms', 'jerking back from a blow while still facing right, its arms thrown up, sinking a little lower into its water')
c('ice_wyvern', 'premium', 7, 'Ice Wyvern', 'Ледяная виверна', 'fly', 'a great ice wyvern with pale blue-white scales and frosted membranous wings, a long tail ending in a spike of ice, a horned head, flying toward the right', 'its wings tilted the other way, frost drifting from them', 'breathing a jet of freezing white mist toward the right')
c('sea_griffin', 'premium', 6, 'Sea Griffin', 'Морской грифон', 'fly', "a sea griffin with an eagle's white head and grey wings and the body of a sleek grey sea lion with webbed paws, flying toward the right", 'its wings tilted the other way', 'diving toward the right with its beak open and talons forward')

# ---- The Dutchman's ghosts: pale, solid, tattered, a faint green glow ------------------------------------------------
c('ghost_sailor', 'dutchman', 2, 'Ghost Sailor', 'Призрачный матрос', 'man', 'a ghost sailor of the Flying Dutchman: pale grey-green solid spectral skin, hollow dark eyes, tattered sea clothes hung with chains and kelp, a rusted cutlass, a faint green glow about him', 'his head tilted, the cutlass lowered', 'a slashing cutlass blow toward the right')
c('ghost_bosun', 'dutchman', 3, 'Ghost Bosun', 'Призрачный боцман', 'man', 'a tall ghost bosun: pale grey-green spectral skin, a bosun\'s whistle on a chain, a coil of wet rope as a whip, a faint green glow', 'the rope swinging loose', 'lashing the rope whip toward the right')
c('lantern_wraith', 'dutchman', 4, 'Lantern Wraith', 'Фонарный призрак', 'fly', "a lantern wraith: a hooded spectral shape in tattered grey robes drifting above the ground with no legs, holding a ship's lantern with a faint green flame", 'the robes drifting the other way', 'thrusting the lantern forward toward the right, a burst of cold green flame')
c('ghost_musketeer', 'dutchman', 4, 'Ghost Musketeer', 'Призрачный мушкетёр', 'man', 'a ghost musketeer of the Dutchman: a pale spectral marine in a rotted coat and a tricorne green with mould, a long musket, a faint green glow', 'the musket brought up', 'firing the musket toward the right, a pale green muzzle flash and grey-green smoke')
c('phantom_gunner', 'dutchman', 5, 'Phantom Gunner', 'Фантомный канонир', 'man', 'a phantom gunner of the Dutchman beside a small rusted cannon wrapped in kelp (part of the figure in every frame), pale spectral skin, a smoking linstock, a faint green glow', 'the linstock lifted', 'touching off the cannon, which fires toward the right with a pale green flash and smoke')
c('dutchman_boarder', 'dutchman', 5, 'Dutchman Boarder', 'Абордажник «Голландца»', 'man', 'a spectral boarder of the Dutchman with a barnacle-crusted boarding axe and a broken round shield, pale grey-green skin, a faint green glow', 'the shield raised a little', 'a heavy axe blow toward the right')
c('drowned_officer', 'dutchman', 6, 'Drowned Officer', 'Утопший офицер', 'man', 'a drowned officer of the Dutchman: pale spectral skin, a rotted officer\'s coat with tarnished epaulettes, a tricorne, a long sword, a faint green glow', 'the sword raised in salute', 'a long sword lunge toward the right')
c('dutchman_mate', 'dutchman', 7, "Dutchman's Mate", 'Старпом «Голландца»', 'big', "a towering spectral first mate of the Dutchman in a long rotted greatcoat, chains wound round his arms, a heavy anchor hook, pale grey-green skin, a faint green glow", 'the chains swinging', 'swinging the anchor hook in a wide arc toward the right')
# The Dutchman's shields, marksmen and knives, filled (2026-10-03, docs/18 VII).
c('dutchman_bulwark', 'dutchman', 2, 'Barnacled Bulwark', 'Ракушечный заслон', 'man', 'a spectral bulwark of the Dutchman: pale grey-green spectral skin, a rotted sea coat, a heavy round wooden hatch cover studded with plain round grey barnacles and limpets (nothing on it shaped like a skull or a face) carried as a shield on the left arm, a short rusted cutlass, a faint green glow about him', 'the hatch-cover shield raised a little', 'thrusting the rusted cutlass toward the right from behind the hatch-cover shield')
c('ghost_marksman', 'dutchman', 3, 'Ghost Marksman', 'Призрачный меткий стрелок', 'man', 'a ghost marksman of the Dutchman: a gaunt pale spectral rifleman in a rotted green-black coat and a drooping hat, a long rusted rifle with a cracked brass-bound stock, a faint green glow', 'the rifle lowered, his hollow eyes lifted to look', 'kneeling on one knee and firing the long rifle toward the right, a pale green muzzle flash and a puff of grey-green smoke')
c('ghost_cutthroat', 'dutchman', 5, 'Ghost Cutthroat', 'Призрачный головорез', 'man', 'a ghost cutthroat of the Dutchman: a lean pale spectral man in a rotted black long coat with a tattered scarf over the lower face, a long thin rusted knife, the edges of his coat fraying into faint green mist, a faint green glow', 'the knife turned in his fingers, his head lowered', 'darting forward with a low knife stab toward the right')
# The second dozen (2026-10-04): the frostbound, the ghost bombers, the ghost commodores.
c('frostbound', 'dutchman', 2, 'Frostbound', 'Обледеневший', 'man', 'a frostbound sailor of the Dutchman, lost with a ship in the ice: pale grey-green spectral skin, a faded sea coat crusted with white frost and small icicles, a faint cold blue light in his hollow eyes, a short boarding axe rimed with ice', 'frost drifting off his shoulders, the axe lowered', 'a chopping blow of the frosted axe toward the right, a puff of cold white mist')
c('ghost_bomber', 'dutchman', 3, 'Ghost Bomber', 'Призрачный бомбометатель', 'man', 'a ghost bomber of the Dutchman: pale grey-green spectral skin, a rotted grey coat and a tarred hat, a satchel of round iron bombs at his hip, one bomb with a sputtering cold green fuse in his right hand, a faint green glow', 'the bomb hand drawn back a little, the green fuse sputtering', 'hurling the bomb overarm toward the right, its fuse trailing a thread of cold green sparks')
c('ghost_commodore', 'dutchman', 7, 'Ghost Commodore', 'Призрачный коммодор', 'man', "a ghost commodore of the Dutchman's lost fleet: a tall gaunt spectral officer with pale grey-green skin in a long rotted coat with tarnished gold braid and a cocked hat, a long heavy sword, a faint green glow about him", 'the sword lifted to his shoulder, his coat stirring as in a wind', 'a powerful downward cut of the long sword toward the right')

# ---- The captains at the field's corners (the six paths) ------------------------------------------------------------
c('hero_corsair', 'hero', 0, 'Corsair', 'Корсар', 'man', 'a corsair captain: a weathered older man with a short grey beard, a black tricorne, a long black coat with brass buttons, a cutlass and a brace of pistols', 'his free hand on his belt, chin raised', 'raising the cutlass high and pointing it toward the right, shouting an order')
c('hero_smuggler', 'hero', 0, 'Smuggler', 'Контрабандист', 'man', 'a smuggler captain: a dark-haired woman in a deep black hooded cloak over a dark leather coat, a ledger book at her belt, a shuttered brass lantern in one hand and a pistol in the other', 'the lantern lowered, her head tilted a little, still facing right', 'levelling the pistol toward the right, a small muzzle flash')
c('hero_reaver', 'hero', 0, 'Reaver', 'Рейвер', 'man', 'a reaver captain: a huge bald man with a thick dark beard and a scarred face, an iron hook in place of his left hand, a long dark-red and black leather coat, a heavy boarding axe in his right hand', 'the axe lifted onto his shoulder', 'roaring and swinging the great axe toward the right')
c('hero_navigator', 'hero', 0, 'Navigator', 'Навигатор', 'man', 'a navigator captain: a lean man with long dark hair and a dark beard, no hat, a long weathered charcoal coat, a brass sextant hanging at his belt, a long brass spyglass and a sabre', 'the spyglass raised to his eye', 'pointing the sabre toward the right, giving the order')
c('hero_drowned', 'hero', 0, 'Drowned Captain', 'Утопший капитан', 'man', 'a drowned captain: grey waterlogged skin, a rotted captain\'s coat dripping water, kelp in the hair, a rusted anchor hook in one hand, a very faint turquoise glint in the eyes', 'water dripping, the hook lowered', 'raising the anchor hook toward the right, calling the deep')
c('hero_admiral', 'hero', 0, 'Admiral', 'Адмирал', 'man', 'the Black Admiral: a dark-haired, clean-shaven man with no hat, a long black coat with dark crimson lapels and a crimson sash, heavy gold epaulettes, a gold-hilted sword', 'his hand on the sword hilt', 'pointing the drawn sword toward the right, commanding the line')

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
        f'Every pose, the hit included, faces the RIGHT side of the picture in three-quarter view from a high camera about 30 degrees above the ground, {facing}. '
        f'The whole {who} is visible in every pose, nothing cut off by the picture edges, {frame}. '
        'The same warm lantern light from the upper left and a cool moonlight rim from behind on all four. '
        'Muted palette: charcoal, tarred black leather, weathered wool and canvas, rust, old brass, faded red and cold blue-grey; low saturation '
        'with small warm highlights. '
        'Background: flat, fully saturated pure magenta #FF00FF (RGB 255, 0, 255) behind everything, uniform, no gradient. NO ground, NO floor, '
        'NO cast shadows, NO ground line, NO horizon, NO dust, NO motion blur, NO speed lines. NO dividing lines, NO panels, NO frames, NO borders, NO captions, NO text, '
        'NO letters, NO numbers, NO watermark. '
        'Avoid: a different character in any pose, a pose seen from the back, more or fewer than four poses, cartoon, chibi, anime, cel shading, thick outlines, flat '
        'vector, pixel art, bright saturated colours, front view, back view, blood, gore, skeletons.'
    )


def gpt_prompt(k: dict) -> str:
    """The same sheet asked of ChatGPT (2026-10-03): it refuses long technical prompts and names of games (it takes them
    for an edit of a picture it does not have), so the same content in plain words, shorter."""
    _, idle = BASE[k['body']]
    who = 'character' if k['body'] in ('man', 'big') else 'creature'
    water = (' Each pose rises out of the same small oval patch of dark sea water ringed with white foam.' if k['body'] == 'water' else
             ' It hovers in the air in every pose.' if k['body'] == 'fly' else '')
    return (
        f'Draw a wide 3:2 image: a game sprite sheet with four poses of the same {who} side by side in one row, left to right: '
        f"1) idle, {idle}; 2) the same pose a breath later, {k['idle2']}; 3) attack, {k['attack']}; 4) hit, {k['hit']}. "
        f"The {who}: {k['look']}.{water} "
        'All four poses show exactly the same face, clothes, colours and size; all face right in three-quarter view from slightly above; '
        'the whole body is visible; the figures are large, about three quarters of the image height, with wide empty gaps between them. '
        'Smooth painterly digital painting with soft edges and no ink outlines, like the hand-painted unit sprites of 1990s fantasy '
        'strategy games, grim and weathered; muted colours: charcoal, tarred leather, wool, rust, old brass, faded red, cold blue-grey. '
        'No blood, no wounds and no red stains anywhere; each weapon stays in his hands in every pose. '
        'Solid flat magenta #FF00FF background, no floor, no shadows, no lines, no frames, no text.'
    )


FRAMES = ('', '_b', '_atk', '_hit')

# The second dozen of the shop and of the world's armies (owner, 2026-10-04: «еще больше … существ»), painted four to a
# sheet: each row one kind in its four poses, a 4×4 grid that slice_sheet.py cuts by its shapes in reading order (`split:
# blobs`), row by row. tools/art/fleet_next.py puts them on the sheets anim4_1–anim4_6 and in the painter's queue;
# main() leaves them out of the one-kind sheets. The like with the like, so a sheet is painted at one scale.
QUADS = [
    ['crown_pikeman', 'rime_witch', 'line_harpooner', 'hunt_master'],
    ['fog_chemist', 'bounty_hunter', 'stone_axeman', 'mask_archer'],
    ['island_chief', 'frostbound', 'ghost_bomber', 'ghost_commodore'],
    ['lantern_jelly', 'mantis_shrimp', 'hammerhead', 'walrus_bull'],
    ['merrow_warden', 'sea_naga', 'brass_automaton', 'storm_giant'],
    ['ember_phoenix', 'megalodon', 'marid', 'ice_wyvern'],
]
IN_QUADS = {cid for q in QUADS for cid in q}


def kind(cid: str) -> dict:
    return next(k for k in K if k['id'] == cid)


def _place(k: dict, long: bool) -> str:
    if k['body'] == 'water':
        return (' It rises out of its own small flat oval patch of dark sea water ringed with white foam, the same patch in every pose.' if long else
                ' It rises out of the same small oval patch of dark sea water ringed with white foam in every pose.')
    return ' It hovers in the air in every pose.' if k['body'] == 'fly' else ''


def quad_prompt(group: list) -> str:
    """Four kinds on one sheet, a row each, in the words of prompt()."""
    rows = []
    for i, k in enumerate(group):
        _, idle = BASE[k['body']]
        rows.append(f"Row {i + 1} — {k['look']}.{_place(k, True)} Its poses: first — idle: {idle}; second — idle a breath later: the same pose "
                    f"with a tiny change only, {k['idle2']}; third — attack: {k['attack']}; fourth — hit: {k['hit']}.")
    return (
        'Animation pose sheet of FOUR different figures for a dark Pirate Gothic turn-based battle game, painted in the style of the battle creatures of '
        'Heroes of Might and Magic III and Warcraft III: rich painterly realism, grim and weathered, bold readable silhouettes. '
        'The picture is a strict grid of FOUR rows and FOUR columns, sixteen poses in all: each row is ONE figure in four poses side by side, '
        'left to right — idle, idle a breath later, attack, hit — each pose centred in its own equal cell with wide empty gaps so that no two touch, '
        'all four poses of a row at exactly the same size and scale, the lowest points of a row at the same height near the bottom of its cell. '
        + ' '.join(rows) + ' '
        'In every row the four poses are exactly the same figure — the same face, build, clothes, colours and equipment — like four frames of one animation. '
        'Every pose, the hit included, faces the RIGHT side of the picture in three-quarter view from a high camera about 30 degrees above the ground. '
        "The whole figure is visible in every pose, each about 75% of its cell's height, nothing cut off by the cell or the picture edges. "
        'The same warm lantern light from the upper left and a cool moonlight rim from behind on all sixteen. '
        'Muted palette: charcoal, tarred black leather, weathered wool and canvas, rust, old brass, faded red and cold blue-grey; low saturation '
        'with small warm highlights. '
        'Background: flat, fully saturated pure magenta #FF00FF (RGB 255, 0, 255) behind everything, uniform, no gradient. NO ground, NO floor, '
        'NO cast shadows, NO ground line, NO horizon, NO dust, NO motion blur, NO speed lines. NO dividing lines, NO panels, NO frames, NO borders, '
        'NO captions, NO text, NO letters, NO numbers, NO watermark. '
        'Avoid: a different figure within a row, a pose seen from the back, more or fewer than four poses in a row, cartoon, chibi, anime, cel shading, '
        'thick outlines, flat vector, pixel art, bright saturated colours, front view, back view, blood, gore, skeletons.'
    )


def quad_gpt_prompt(group: list) -> str:
    """The same sheet asked of ChatGPT, in gpt_prompt()'s plain and shorter words."""
    rows = []
    for i, k in enumerate(group):
        _, idle = BASE[k['body']]
        rows.append(f"Row {i + 1}: {k['look']}.{_place(k, False)} Its poses: 1) idle, {idle}; 2) the same pose a breath later, {k['idle2']}; "
                    f"3) attack, {k['attack']}; 4) hit, {k['hit']}.")
    return (
        'Draw a square image: a game sprite sheet of four different figures, one to a row, each in four poses side by side — sixteen figures '
        'in a 4 by 4 grid, each centred in its own cell with wide empty gaps between them so that no two touch. '
        + ' '.join(rows) + ' '
        'In each row all four poses show exactly the same figure — the same face, clothes, colours and size; every pose faces right in '
        "three-quarter view from slightly above; the whole body is visible; each figure is about three quarters of its cell's height. "
        'Smooth painterly digital painting with soft edges and no ink outlines, like the hand-painted unit sprites of 1990s fantasy '
        'strategy games, grim and weathered; muted colours: charcoal, tarred leather, wool, rust, old brass, faded red, cold blue-grey. '
        'No blood, no wounds and no red stains anywhere; each weapon stays in its hands in every pose. '
        'Solid flat magenta #FF00FF background, no floor, no shadows, no lines, no frames, no text.'
    )


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    for k in K:
        if k['id'] in IN_QUADS:
            continue  # painted four to a sheet (tools/art/fleet_next.py)
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
    # ChatGPT's wording of the same sheets (assets/raw/q_gpt.json, by job name).
    with open(os.path.join(ROOT, 'assets', 'raw', 'q_gpt.json'), 'w', encoding='utf-8') as f:
        json.dump({f"sheet.anim_{k['id']}": gpt_prompt(k) for k in K if k['id'] not in IN_QUADS}, f, ensure_ascii=False)
    by = {}
    for k in K:
        by[k['faction']] = by.get(k['faction'], 0) + 1
    print(len(K), 'kinds', by, 'longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
