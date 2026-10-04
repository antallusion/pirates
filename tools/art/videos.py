"""GRAVETIDE's films (owner, 2026-10-03: «в хигсфилде генерируй видосы для нашего ресурса… катсцены, главный видос собери
из 7 разных видео, какие-то нападения; очень длинные и подробные промты со стилем игры»).

    python tools/art/videos.py      # the jobs into assets/raw/q_video.json (Higgsfield, Kling 3.0, 720p, 5 s, Unlimited)

Every clip is one continuous five-second shot in the game's look. The trailer is seven of them cut together in order
(tools/art/cut_trailer.py); the cutscenes play in the game where their `use` says.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'raw', 'q_video.json')

STYLE = (
    'Visual style: a dark Pirate Gothic world in the age of sail, around 1720 — cinematic, grim and weathered, painterly realism like '
    'the opening cinematic of a high-end fantasy strategy game. A muted, low-saturation palette of charcoal, slate, black-green sea, '
    'cold blue-grey moonlight, tarred black oak, rust, old brass and faded red cloth, broken only by small warm pools of lantern and '
    'fire light. Heavy atmosphere: sea fog, drifting rain, salt spray, smoke from black powder. Ships are true to the period — oak '
    'hulls, hemp rigging, patched canvas, iron cannon on wooden carriages, swivel guns on the rails — with nothing modern in sight. '
    'People wear period clothes: tricornes, long coats, bandanas, sashes, boots; their faces are weathered and serious. '
    'Smooth, steady, deliberate camera work; natural motion; film grain; anamorphic depth of field; 24 frames per second. '
    'No text, no titles, no letters, no logos, no watermark, no modern objects, no blood, no gore.'
)

V = []


def v(vid, use, title, shot):
    V.append({'id': vid, 'use': use, 'title': title, 'prompt': shot + ' ' + STYLE})


# ---- The trailer: seven shots, cut together in this order --------------------------------------------------------------
v('trailer_1_fog', 'trailer', 'Из тумана',
  'Night on the open sea. The camera skims low and slow over long black swells toward a wall of grey fog lit from above by a '
  'hidden moon. Out of the fog, bow first, glides a lean pirate brig under patched black sails, lanterns swinging on her rails, '
  'a carved figurehead of a drowned woman on her bow; the fog tears around her as she comes on, water hissing along her hull. '
  'The camera holds its low angle as she grows huge in the frame, ominous and silent.')
v('trailer_2_broadside', 'trailer', 'Бортовой залп',
  'A Crown navy frigate — a black hull with a pale ochre band, two rows of open gun ports — heels in a rough grey sea under '
  'storm clouds. Side-on, the camera slowly pushes in as her whole broadside fires in a rolling ripple from bow to stern: '
  'tongues of orange flame, thunderous puffs of white smoke rolling out over the waves, the hull shuddering, spray thrown up. '
  'Smoke drifts across the frame and half-hides her sails.')
v('trailer_3_grapples', 'trailer', 'Абордажные крючья',
  'Close and low on the rail of a pirate ship in driving rain. Iron grappling hooks fly across a narrow gap of churning black water '
  'and bite into the other ship\'s rail; the ropes snap taut and the two oak hulls grind together with a jolt, splinters flying. '
  'Pirates in bandanas and sashes, cutlasses in their teeth and fists, leap from the rail and swing across on ropes past the camera.')
v('trailer_4_melee', 'trailer', 'Схватка на палубе',
  'A wide, slowly circling shot of a boarding fight on a wet deck at night, lit by swinging lanterns and a burning sail overhead. '
  'Pirates with cutlasses and axes clash with Crown marines in faded red coats with bayonets; a gunner fires a swivel gun in a '
  'burst of smoke; men push and parry among barrels and coiled ropes; sparks fly from crossing blades. Chaotic but readable, '
  'like a painted battle come to life.')
v('trailer_5_kraken', 'trailer', 'Ответ глубины',
  'From a low angle beside a ship at night, the black sea bulges and a colossal dark-mottled tentacle as thick as the mainmast rises '
  'slowly out of the water, streaming foam, suckers glistening in the moonlight; it curls over the rail and wraps around the mast '
  'while tiny sailors flee across the deck below and lanterns sway. The ship lurches toward the water.')
v('trailer_6_dutchman', 'trailer', 'Летучий Голландец',
  'Through rolling fog under a flicker of lightning, a ghost ship drifts into view: a rotten pale-grey hull hung with kelp, tattered '
  'sails glowing faintly green, a crew of silent pale figures lining her rails holding green lanterns. The camera slowly dollies '
  'back as she bears down, her bell swinging, the sea flat and black beneath her.')
v('trailer_7_black_flag', 'trailer', 'Чёрный флаг на рассвете',
  'Dawn breaks blood-orange through storm clouds over a heaving grey sea. On the quarterdeck of a captured ship a pirate captain in '
  'a long black coat and feathered tricorne hauls a black flag up the staff; it unfurls and snaps in the wind. Behind him, out of '
  'focus, a beaten Crown frigate burns and smokes on the horizon. The camera rises slowly past the flag into the sky.')

# ---- Cutscenes in the game ----------------------------------------------------------------------------------------------
v('cut_prologue', 'prologue', 'Пролог: выброшенный на берег',
  'A grey shingle beach at night under a low moon. Surf washes over a shipwreck survivor lying among broken planks and torn rope; '
  'he stirs, coughs, pushes himself up on his hands and slowly gets to his knees, then reaches for a battered cutlass half-buried '
  'in the sand. Behind him, far out on the black sea, the wreck of his ship burns low on the horizon.')
v('cut_port', 'port', 'Заход в порт',
  'Dusk over a gloomy pirate harbour town: crooked timber houses stacked up a dark hillside, lanterns in the windows, wet stone '
  'wharves crowded with barrels and crates, masts of moored ships. A pirate brig glides slowly in under shortened sail, sailors on '
  'the yards furling canvas, a bell tolling on the quay. The camera drifts along the quay toward her.')
v('cut_storm', 'storm', 'Шторм',
  'A ship caught in a monstrous storm at night: towering black waves crash over the bow and sweep the deck, rigging whips in the '
  'gale, lightning splits the sky and lights the spray white; sailors cling to lifelines and the helmsman fights the wheel. The '
  'camera rolls with the ship as she climbs a wave and plunges down the other side.')
v('cut_boarding', 'boarding', 'Начало абордажа',
  'Two ships side by side in the night, hulls almost touching. Along the pirate ship\'s rail a line of boarders crouches with '
  'cutlasses and pistols, faces lit by a single lantern; the captain raises his sword, shouts silently, and brings it down — the '
  'whole line surges up onto the rail and over. The camera pushes in along the rail.')
v('cut_victory', 'victory', 'Победа',
  'On a battered deck after a fight, morning light through drifting smoke: a pirate crew cheers, raising cutlasses and tankards, '
  'a captured Crown flag thrown down on the planks, a chest of silver coins being dragged into the middle. The camera slowly '
  'cranes up over the cheering crew.')
v('cut_defeat', 'defeat', 'Поражение',
  'A burning pirate ship sinking at night: flames climb the rigging, the mainmast cracks and falls in a shower of sparks, the bow '
  'tilts up as the stern goes under. Two small boats of survivors pull away across the black water lit orange by the fire. '
  'The camera holds steady from the boats.')
v('cut_white_whale', 'legend', 'Белый кит',
  'A grey morning at sea beside a whaling ship. The White Whale, huge and pale and scarred, old harpoons stuck in its hide, '
  'breaches out of the water right beside the ship in a slow, enormous arc; harpooners on the bow hurl their irons; the whale '
  'crashes down sending a wall of spray over the deck.')
v('cut_kraken_boss', 'boss', 'Кракен',
  'From high above at night, a ship spins in a whirlpool as a gigantic kraken rises around her: a dozen huge tentacles break the '
  'surface in a ring and close over the hull, the masts snap one by one, and the ship is slowly dragged down into the black '
  'water. The camera descends slowly toward the vortex.')
v('cut_choir', 'choir', 'Хор глубин',
  'On a black rock in the middle of the sea at midnight, hooded cultists in sodden green robes stand in a circle holding lanterns '
  'with pale green flames, chanting; the sea around the rock begins to glow a faint turquoise from below and slowly rises in a '
  'silent swell. The camera circles slowly around the rock.')
v('cut_abyss', 'abyss', 'Бездна',
  'Deep underwater in the dark abyss, faint turquoise light filtering down, a sunken ship lying broken on a ledge of black rock '
  'covered in pale coral. Far below, in the darkness, an enormous eye slowly opens, its pupil a slit, and the water trembles. '
  'The camera sinks slowly toward it.')
v('cut_landing', 'landing', 'Высадка на остров',
  'A rowing boat full of armed pirates pulls through the surf toward a black volcanic beach under a red, smoking mountain; palm '
  'trees bend in the wind; the bow grinds onto the sand and the men leap out into the shallows with torches and cutlasses, wading '
  'ashore. The camera follows the boat from behind.')
v('cut_lair', 'lair', 'Логово',
  'A torchlit band of pirates creeps through a misty jungle ruin at night: vine-covered stone arches, a broken statue of a sea '
  'saint, glowing eyes in the darkness ahead; something huge stirs behind the arch and a giant crab claw slams into the stone. '
  'The camera moves forward with the torches.')
v('cut_treasure', 'treasure', 'Сокровище',
  'Inside a dripping sea cave lit by a single lantern, a pirate captain kneels before an old iron-bound chest, breaks the lock with '
  'a pistol butt and lifts the lid: the warm glint of gold coins and jewels lights his weathered face from below. The camera '
  'pushes in slowly over his shoulder.')
v('cut_smugglers', 'brokers', 'Контрабандисты',
  'A hidden cove at night, fog over the water: smugglers in dark hoods unload kegs and crates from a rowing boat by the light of a '
  'shuttered lantern, passing them hand to hand up a narrow rock stair; a lookout on the cliff above signals with three blinks of '
  'his lantern. The camera glides low over the water toward the boat.')
v('cut_crown_chase', 'crown', 'Погоня Короны',
  'In a gale under a low grey sky, a sleek Crown cutter with a white ensign chases a small pirate sloop through great rolling '
  'waves; the cutter\'s bow chaser fires and a waterspout bursts beside the sloop\'s stern. The camera flies alongside the cutter '
  'at wave height.')
v('cut_dutchman_bell', 'dutchman', 'Колокол Голландца',
  'Close on a ship\'s bell, green with age and hung with kelp, swinging slowly on the fog-wrapped deck of a ghost ship; a pale '
  'spectral hand pulls the rope; with each toll a ring of faint green light spreads through the fog. The camera pulls back to reveal '
  'the silent ghostly crew standing motionless along the deck.')
v('cut_harpoon', 'harpoon', 'Орден Гарпуна',
  'From the bow of a whaleboat in a grey swell, a grizzled master harpooner in an oilskin coat braces, raises a heavy barbed harpoon '
  'and hurls it; the line whips out of its tub smoking as the boat lurches forward. The camera is at the oarsmen\'s shoulders.')
v('cut_fort', 'fort', 'Штурм форта',
  'Night assault on a stone sea fort: from the water the camera rises toward crenellated walls lit by flashes of cannon fire from '
  'the embrasures; ladders thump against the wall and pirates climb with cutlasses in their teeth while musket smoke drifts '
  'across the moon.')
v('cut_tavern', 'port', 'Таверна',
  'Inside a crowded smoky harbour tavern at night: low beams hung with lanterns, pirates at long tables playing dice and drinking '
  'from tankards, a fiddler in the corner, a one-eyed barkeep wiping a mug; a scarred captain at the back table leans into the '
  'light and slides a sealed map across the table. The camera drifts slowly through the room toward him.')


# ---- The second reel (owner, 2026-10-03: «генерируй прям много»): the rest of the world's armies, its legends, its
# holidays and the turns of a captain's life — each a moment in the game (client/src/main.ts, filmMoments) --------------
v('cut_league', 'league', 'Золочёный Гроссбух',
  'Dawn in a busy merchant harbour of the Gilded Ledger: a tall, richly gilded East-India galleon with carved gold scrollwork on '
  'her stern and a faded ochre company flag rides at anchor; along her quarterdeck rail a disciplined line of company musketeers '
  'in ochre coats and polished breastplates shoulders their muskets in one movement, while a stout paymaster in a fur-trimmed coat '
  'snaps shut a heavy brass-bound ledger and points toward the camera. Gulls wheel through the cold morning haze. The camera '
  'glides low across the water toward the galleon\'s towering stern.')
v('cut_free', 'free', 'Вольные Гавани',
  'Sunrise over a jagged black-rock island fringed with palms: a dozen long outrigger war canoes burst out through the white surf '
  'of the reef, paddled hard by tattooed island warriors with shark-tooth clubs and bone-tipped spears; in the lead canoe a tide '
  'shaman in a cloak of woven kelp and shells raises a carved staff and the sea around the prow glows a faint turquoise. A conch '
  'horn sounds. The camera skims low over the waves just ahead of the lead canoe as it charges toward the lens.')
v('cut_ancient_turtle', 'legend', 'Древняя черепаха',
  'A calm, misty sea at dawn where a small mossy island with three bent palms and an old stone shrine sits alone. A rowing boat of '
  'pirates drifts close; suddenly the whole island shudders and slowly rises out of the water — it is the barnacle-crusted shell of '
  'a colossal ancient sea turtle; its enormous wrinkled head, as big as a ship\'s hull, lifts from the sea streaming water and '
  'seaweed and opens one ancient amber eye. The pirates freeze in the boat. The camera tilts slowly up from the boat to the eye.')
v('cut_leviathan', 'legend', 'Левиафан отмелей',
  'A shallow turquoise-grey sea over pale sandbanks under a heavy overcast sky. A long dark shape glides beneath a small pirate '
  'sloop; then a vast scaled leviathan, its back ridged like a reef and crusted with shells, surges out of the shallows beside her '
  'in a rolling arc, its gill-slits flaring open, its long tail slamming the water and throwing the sloop sideways in a curtain of '
  'spray. Sailors clutch the shrouds. The camera holds at sea level as the creature towers over the frame.')
v('cut_lantern_maw', 'legend', 'Пасть с фонарём',
  'Utter darkness on the open sea at midnight, black water and no moon. A single soft greenish light bobs on the swell like a '
  'lantern of a lost boat; a pirate boat rows slowly toward it, a sailor leaning out from the bow with a boat hook. The light rises — '
  'it hangs from a long fleshy lure — and beneath it a gigantic anglerfish maw opens out of the sea, rows of needle teeth glinting '
  'in the green glow, water pouring from its jaws. The camera stays behind the rowers, looking past them at the rising maw.')
v('cut_serpent', 'legend', 'Морской змей',
  'Late afternoon in a rain squall: a brigantine heels under reefed sails through choppy grey sea. Off her beam a great sea serpent '
  'rises in looping coils, scales of dark green and bronze shining wet, a spiny frill fanning open behind its long horned head; it '
  'arches high over the deck, hissing, as the gun crews swing a swivel gun toward it. The camera circles slowly along the rail '
  'below the rearing coils.')
v('cut_mutiny', 'mutiny', 'Бунт',
  'Night on the deck of a pirate brig, a single lantern swaying from the boom. A grim crowd of sailors closes in around the '
  'mainmast, cutlasses and belaying pins in hand; the scarred ringleader steps forward into the lantern light and flings a black '
  'spot — a small round paper — onto the planks at the captain\'s boots; the captain, back to the mast, slowly draws his pistol. '
  'Rain begins to fall. The masts, yards and rigging above are empty — no one hangs, climbs or sits anywhere above the deck; '
  'everyone stands on the planks. The camera moves slowly around the circle of angry faces.')
v('cut_sunk', 'sunk', 'Кораблекрушение',
  'Grey dawn after a lost battle: a calm, oily sea strewn with floating wreckage — broken spars, a torn sail, barrels, a drifting '
  'hatch cover. A lone captain in a torn coat clings to a broken mast, exhausted, his tricorne floating beside him; he lifts his '
  'head as, far away through the morning mist, the faint silhouette of a small boat with a lantern appears and turns toward him. '
  'The camera rises slowly from the water up and away over the wreckage.')
v('cut_strike_colours', 'surrender', 'Спустить флаг',
  'Midday, a merchant fluyt dead in the water with her sails hanging slack and holes in her canvas, a pirate brig looming close '
  'alongside with all guns run out. On the merchant\'s stern a frightened old captain hauls down his company flag hand over hand; '
  'it slides down the staff and drops to the deck; his crew raise empty hands along the rail. The camera slowly pushes in from the '
  'pirate ship\'s rail past a smoking gun muzzle toward the falling flag.')
v('cut_descent', 'descent', 'Мальстрём',
  'Night on a black, glassy sea under a sky of torn cloud. In the middle of the water a vast maelstrom opens like a spiral stair: '
  'its walls of water turn slowly downward, faint turquoise light glowing from somewhere deep in its throat. A lone pirate ship '
  'with lanterns lit slides over the lip and begins to spiral down along the turning wall of water. The camera follows from high '
  'above and behind, slowly descending after her into the vortex.')
v('cut_black_storm', 'black_storm', 'Чёрный шторм',
  'A black storm at sea: the sky is pitch black and the wind seems to blow from every side at once; spiralling clouds turn above '
  'a ship that lies over on her beam ends; sheets of rain run sideways, green lightning crawls along the cloud and strikes the sea; '
  'a sail tears free and flies away into the dark like a ghost. Sailors cut away tangled rigging with axes. The camera tilts and '
  'rolls violently with the ship.')
v('cut_launch', 'launch', 'Спуск корабля',
  'A shipyard on a grey estuary at morning: a newly built ship, her fresh oak hull gleaming with tar, sits on the slipway with '
  'scaffolding around her bow; a shipwright knocks out the last wedge with a heavy mallet, the hull begins to slide, faster and '
  'faster, down the greased ways and into the water with a great white splash, rocking upright as workers on the slip throw their '
  'caps in the air. The camera holds low by the water as the stern rushes toward it.')
v('cut_duel', 'duel', 'Дуэль',
  'A misty dawn on a narrow sandbar between two anchored ships, the sea flat and pale. Two captains in long coats face each other '
  'with rapiers; they salute, then lunge, blades flashing and ringing, boots kicking up wet sand, one parrying and spinning away '
  'as the other presses forward. Their crews watch silently from the boats. The camera circles the duellists slowly at chest '
  'height.')
v('cut_orca', 'companion', 'Косатка',
  'A bright cold morning on a calm, dark-blue sea beside a pirate brig. A young orca calf, glossy black and white, surfaces '
  'right by the ship\'s hull, blows a misty spout, and rolls on its side to look up at the deck with one eye; a weathered captain '
  'leans over the rail and lowers his hand toward it with a fish; the calf leaps playfully clear of the water beside the bow. '
  'The camera hangs low over the water beside the calf.')
v('cut_drowned_night', 'holiday_drowned_night', 'Ночь Утопленников',
  'A pirate harbour on the Night of the Drowned: hundreds of small paper lanterns float out across the black water of the bay, '
  'each one set down by townsfolk kneeling on the wet stone steps of the quay; the lanterns drift out toward the anchored ships '
  'in a slow river of warm light, and far out in the dark water faint pale shapes seem to rise and watch them pass. A bell tolls '
  'softly. The camera drifts slowly out over the water with the lanterns.')
v('cut_herring_run', 'holiday_herring_run', 'Сельдяной ход',
  'Early morning of the Herring Run: a crowded fleet of small fishing boats and ketches with patched brown sails works a sea that '
  'boils with silver herring; fishermen haul bulging nets full of flashing fish over the gunwales, gulls dive screaming all around, '
  'and the rising sun turns the spray to gold. The camera glides low between the boats through the wheeling gulls.')
v('cut_powder_night', 'holiday_powder_night', 'Пороховая ночь',
  'Powder Night in a pirate harbour: from the decks of the ships in the bay, fireworks and signal rockets burst over the water in '
  'showers of gold, red and green, their light flashing on the wet rigging and the crowded quay; crews cheer and fire pistols into '
  'the air; a keg on a raft explodes in a fountain of sparks. The camera rises slowly from the crowded quay to look out over the '
  'bay full of bursting light.')
v('cut_league_day', 'holiday_league_day', 'День Гроссбуха',
  'The League\'s holiday in a grand merchant port: a stone market square by the harbour hung with ochre banners; merchants in fine '
  'coats strike bargains at stalls piled with spices, silks and silver; a company clerk on a balcony rings a brass bell and opens a '
  'great gilded ledger, and gold coins shower from a guild hall window onto the cheering crowd. The camera moves slowly along '
  'the stalls toward the balcony.')
v('cut_trek', 'trek', 'Через остров',
  'A landing party of six pirates pushes through a steaming jungle on a mountainous island: giant ferns, hanging vines, rotting '
  'stone steps of a forgotten road climbing uphill; the leader hacks a vine away with his cutlass and stops — ahead the trees open '
  'on a cliff edge with a vast misty valley and a smoking volcano beyond. Parrots burst up from the canopy. The camera follows '
  'close behind the party and rises over the leader\'s shoulder as the view opens.')
v('cut_tame', 'tame', 'Приручение',
  'A rocky shore at sunset: a huge armoured crab, its shell barnacled and its claws raised, faces a lone pirate who stands still '
  'with an open hand and a bucket of fish at his feet; slowly the crab lowers its claws, edges sideways closer, and takes a fish '
  'from his palm with surprising gentleness, while the sea washes around their feet in the golden light. The camera pushes in '
  'slowly at ground level.')
v('cut_base', 'base', 'Своя гавань',
  'A small hidden bay on a wild island at golden evening: pirates build their own harbour — a new timber jetty reaching into the '
  'water, a stockade of sharpened logs going up on the slope, a watchtower being raised by ropes, cannons hauled ashore on rollers, '
  'and on the highest rock a black flag being run up a fresh pole. The camera sweeps slowly across the bay from the water to the '
  'flag.')
v('cut_throne', 'throne', 'Пиратский трон',
  'Inside a vast sea cave turned into a pirate hall, lit by braziers and hundreds of candles: a throne built of ship\'s timber, '
  'figureheads and an old captain\'s chair stands on a heap of chests and coins; pirate captains in their finest stolen coats '
  'line the walls and bang their tankards; a new pirate lord climbs the steps and sits down, laying a cutlass across his knees, '
  'and the hall roars. The camera rises slowly up the steps toward the throne.')
v('cut_grail', 'grail', 'Грааль',
  'Night on a windswept hill above the sea: by the light of two lanterns, pirates dig in a deep pit among the roots of a dead tree; '
  'a spade strikes stone; the men clear the earth from a stone lid carved with a sea-saint\'s sign, heave it aside, and a soft '
  'golden light rises from inside onto their astonished faces as an ancient chalice is revealed. The camera looks down into the pit '
  'and slowly descends toward the glow.')
v('cut_raid', 'raid', 'Ночной налёт',
  'Midnight in a quiet anchorage: a fat merchant ship rides at anchor, her watch dozing by a lantern. Out of the dark water glide '
  'two longboats with muffled oars full of silent pirates; grappling hooks fly up and catch the rail, the first men swarm up the '
  'side with knives in their teeth, and the lantern is snuffed out. The camera moves with the boats low over the black water '
  'toward the looming hull.')


# ---- The third reel: the world bosses' first rising, the first fight at each lair of the land's creatures, and the
# landing party's moments (client/src/main.ts: BOSS_FILM, LAIR_FILM, LANDING_FILM) -------------------------------------
v('cut_drowned_whale', 'boss', 'Утопленный Кит',
  'Night over a black, still sea in the Drowned Crown: a colossal pale whale surfaces slowly beside a small ship, its back crusted '
  'with barnacles, kelp and the broken timbers of old wrecks, an ancient bronze ship\'s bell grown into the flesh of its back and '
  'glowing a faint sea-green; each slow toll of the bell sends a ring of green light across the water as the whale rolls one huge '
  'clouded eye toward the ship. The camera rises slowly from the water up along its flank to the bell.')
v('cut_hollow_admiral', 'boss', 'Пустой Адмирал',
  'Dead calm at midnight in the Dead Man\'s Expanse, yet a wind of its own fills the sails of three ships of the line coming out '
  'of a wall of green fog in battle order: their sails are pale and torn, their gunports glow a cold green, and their crews are only '
  'faint silhouettes of light; on the flagship\'s high stern a single great lantern burns with a pale green flame. The ghost line '
  'turns broadside on, every port opening at once. The camera holds low on the water as they glide past.')
v('cut_mother_of_wrecks', 'boss', 'Мать Обломков',
  'Grey morning over a sea littered with flotsam: a vast floating mound built of hundreds of broken ships — masts, hulls, figureheads, '
  'anchors and chains knotted together into a living shell — heaves slowly on the swell; deep inside its maze of timber a pulsing '
  'amber glow beats like a heart, and with each beat loose planks creak and crawl back into place. A pirate sloop edges toward a '
  'narrow channel into it. The camera circles slowly around the mound at wave height.')
v('cut_storm_widow', 'boss', 'Вдова Бурь',
  'A towering storm over Leviathan Reach: in the middle of a ring of black cloud a vast pale shape like a veiled woman made of '
  'rain and cloud bends over the sea, her veil streaming in the gale; lightning forks from her outstretched hands down to the tallest '
  'mast of a battered frigate below, and the wind whips round in a circle as the eye of the storm moves across the water. The camera '
  'looks up from the frigate\'s deck into the turning eye.')
v('cut_ancient_leviathan', 'boss', 'Древний Левиафан',
  'Deep in the Abyss beyond the Wall, black water lit only by ships\' lanterns far above: an unimaginably huge leviathan, armoured '
  'with plates of old bone and coral, its back a ridge of jagged spines, rises out of the dark beneath three small ships, its single '
  'pale eye opening as large as a sail; the sea bulges and the ships tilt on the swell it pushes up. The camera falls slowly '
  'away down past its eye into the dark.')
v('cut_crab_beach', 'lair', 'Крабовый пляж',
  'Dawn on a black volcanic beach: the sand begins to move as dozens of huge armoured crabs, their shells barnacled and red-brown, '
  'dig themselves out and scuttle sideways toward a landing party of pirates wading ashore from their boat, claws raised and '
  'clacking. Steam drifts from the warm sand. The camera skims low along the beach just ahead of the advancing crabs.')
v('cut_gull_cliffs', 'lair', 'Скалы чаек',
  'A windswept sea cliff white with nesting gulls: a pirate party climbing a narrow path along the cliff face is struck by a '
  'screaming storm of huge grey-backed gulls that burst off the ledges, wheeling and diving at them; the men duck and swing their '
  'hats and cutlasses as feathers whirl in the gale. The camera hangs in the air beside the cliff among the diving birds.')
v('cut_seal_rookery', 'lair', 'Лежбище тюленей',
  'A grey rocky shore under drizzle crowded with big grey seals: the great scarred bull of the rookery rears up on his flippers, '
  'roaring, as a landing party steps onto the rocks, and the whole rookery lifts its heads and begins to bellow and heave toward '
  'them across the wet stones. The camera holds low among the rocks behind the bull.')
v('cut_shark_shallows', 'lair', 'Акулья отмель',
  'A turquoise shallow over white sand at noon: a pirate longboat rows across the reef while a dozen dark shark fins circle it, '
  'closing in; one great reef shark surges past just under the clear water beside the oars, its shadow sliding over the sand, '
  'and the oarsmen pull harder. The camera looks down from above through the clear water at the boat and the circling sharks.')
v('cut_turtle_rocks', 'lair', 'Черепашьи камни',
  'A cove of smooth grey boulders at low tide: as a pirate party picks its way across them, several of the boulders lift on thick '
  'scaly legs — they are giant rock turtles with stone-grey shells crusted with limpets — and turn their beaked heads toward the '
  'men, slowly closing the way back to the boat. The camera tracks slowly between the rising turtles.')
v('cut_serpent_marsh', 'lair', 'Змеиное болото',
  'A misty mangrove marsh at dusk, still brown water and twisted roots: a pirate party wades knee-deep with torches when a long '
  'green-bronze serpent glides silently past their legs beneath the surface, its ripple running ahead, and then rises in the reeds '
  'before them with its hood flared, hissing. The camera follows the ripple through the water.')
v('cut_hermit_camp', 'lair', 'Лагерь отшельника',
  'A ruined fishing camp on a lonely beach: an enormous hermit crab has made its home in the overturned hull of a wrecked boat and '
  'carries it on its back; it heaves up out of the sand, pincers as big as a man, and turns toward the pirates who were picking '
  'over the camp. Broken nets and barrels tumble off the hull. The camera pulls back as the hull rises.')
v('cut_tentacle_lagoon', 'lair', 'Лагуна щупалец',
  'A still, glassy turquoise lagoon ringed by palms under a hot sky: a pirate rowing boat crosses it when long dark tentacles, '
  'mottled and ringed with suckers, rise silently out of the water all around it in a wide circle, swaying, and begin to close in. '
  'The camera rises slowly above the boat to reveal the ring of tentacles.')
v('cut_drowned_surf', 'lair', 'Прибой утопленников',
  'A grey beach at night under a low moon: out of the breaking surf walk tall pale figures made of seawater and foam in the shape '
  'of drowned sailors, their outlines glowing faintly blue-green, water streaming from them; they come up the beach toward a '
  'line of pirates with lanterns who back away. The camera holds at the waterline behind the advancing figures.')
v('cut_lighthouse', 'lookout', 'Маяк',
  'A storm-lashed headland at dusk: a lone old lighthouse of black stone stands on the cliff edge; a pirate climbs the last steps '
  'of its spiral stair and pushes open the lantern room, and the great lamp swings round, its beam sweeping out across a sea full '
  'of distant sails and islands far below. The camera rises past the lantern and out along the beam.')
v('cut_wreck_dive', 'dive', 'Погружение к затонувшему',
  'Under clear green water on a bright day: a pirate diver in a leather helmet with a glass window and a weighted belt sinks slowly '
  'past shafts of sunlight toward a sunken merchantman lying on white sand among coral, fish scattering; he reaches the broken '
  'stern and pulls open a small sea-chest that spills silver coins into the sand. The camera sinks beside him.')
v('cut_regatta', 'regatta', 'Регата',
  'A bright windy afternoon off a harbour: a dozen small racing sloops and cutters under full sail heel hard as they round a red '
  'buoy close together, bows smashing through the chop, spray flying over the crews hanging out on the windward rails; a cannon '
  'on the harbour wall fires a puff of smoke. The camera races alongside the leading sloop at deck height.')
v('cut_hunt', 'hunt', 'Зверь на лине',
  'A rough grey sea: a pirate brig is being towed at speed by a harpoon line running taut from her bow into the water, where a huge '
  'dark sea beast plunges and surfaces ahead of her in bursts of spray; the crew on the bow pay out the smoking line and brace a '
  'second harpoon gun. The camera flies low ahead of the bow, looking back at the straining ship.')


# ---- The fourth reel: the first harbour of each power of the sea (client/src/main.ts, PORT_FILM), the first fog,
# the first night watch ------------------------------------------------------------------------------------------------
v('cut_port_crown', 'port_crown', 'Гавань Короны',
  'Morning in a fortified Crown harbour: a grey stone citadel with a great white ensign stands over a crescent of quays where '
  'warships of the line lie at anchor in perfect rows; red-coated marines drill on the parade ground by the customs house, a '
  'drum beats, and a harbour boat with a uniformed officer rows out to meet the arriving pirate brig flying false colours. The '
  'camera glides in low over the water past the anchored warships toward the citadel.')
v('cut_port_league', 'port_league', 'Гавань Гроссбуха',
  'A rich merchant harbour of the Gilded Ledger at golden evening: tall ochre warehouses with timber cranes line the quays, bales '
  'and casks swing ashore from fat merchantmen, clerks with ledgers count crates under hanging lanterns, and the gilded dome of the '
  'company counting house glows above the roofs. The camera drifts slowly along the busy quay toward the counting house.')
v('cut_port_confederacy', 'port_confederacy', 'Гавань Красного Прилива',
  'A pirate haven of the Red Tide Confederacy at night: a crooked town of rope bridges and shacks built over the hulks of '
  'captured ships in a hidden cove, red lanterns everywhere, blood-red flags on every mast, a bonfire on the beach where captains '
  'argue over a chart, fiddles and shouting from the taverns. The camera sweeps in from the cove\'s mouth over the anchored '
  'raiders toward the bonfire.')
v('cut_port_harpoon', 'port_harpoon', 'Гавань Ордена Гарпуна',
  'A cold northern whaling harbour of the Order of the Harpoon under grey skies and drifting snow: stout whaleboats hauled up '
  'on a stony beach, harpoon racks and try-works smoking along the quay, the vast jawbone arch of a sea monster over the harbour '
  'gate, and grim hunters in oilskins sharpening irons. The camera moves slowly in through the jawbone arch.')
v('cut_port_brokers', 'port_brokers', 'Гавань Туманных Маклеров',
  'A smugglers\' harbour of the Fog Brokers hidden in a sea cave, its mouth veiled in thick fog: inside, lantern-lit wooden '
  'jetties and stairs climb the cave walls, cloaked figures trade sealed letters and small chests in whispers, and a slim black '
  'sloop slips silently in through the fog curtain. The camera follows the sloop through the fog into the glowing cave.')
v('cut_port_choir', 'port_choir', 'Гавань Хора Глубин',
  'A strange harbour of the Choir of the Deep on a black volcanic island: a drowned stone town half sunk into the sea, its '
  'towers leaning, pale-green lanterns on long poles over the water, hooded figures in sea-green robes walking slowly down stone '
  'steps that lead straight into the waves, and a low chant drifting over the still water. The camera glides in over the '
  'submerged streets toward the steps.')
v('cut_port_free', 'port_free', 'Вольная Гавань',
  'A ramshackle free harbour on a tropical island at noon: a jumble of patched sails and flags of every colour, a market of '
  'stalls along a long timber pier, islanders, sailors and traders of every kind haggling, a monkey running along the ropes, '
  'and outrigger canoes weaving between the anchored ships. The camera floats slowly along the pier through the noisy crowd.')
v('cut_fog', 'fog', 'Туман',
  'A pirate brig sails slowly into a wall of thick grey fog: the bowsprit vanishes first, then the foremast, the lanterns become '
  'faint blurred halos; a lookout in the bow leans forward, listening, as a ship\'s bell tolls somewhere unseen ahead and a dark '
  'shape of another hull glides past close by and is gone. The camera stays at the bow beside the lookout.')
v('cut_night_watch', 'night', 'Ночная вахта',
  'Deep night on a calm sea under a sky full of stars and a thin moon: on the quarterdeck of a pirate brig a lone helmsman '
  'holds the wheel by the light of the binnacle lamp, an old sailor smokes a pipe on watch at the rail, the sails breathe softly '
  'and the wake glows faintly with phosphorescence. The camera rises slowly from the binnacle up the mast to the stars.')


# ---- The fifth reel: «Набеги» — seven attacks cut into the second trailer (tools/art/cut_trailer.py raids), which the
# title screen plays in turn with the first --------------------------------------------------------------------------
v('raid_1_broadside', 'trailer2', 'Ночной бортовой',
  'Night on a heaving black sea: two ships of war run side by side a cable apart, and the nearer one fires a full broadside — a '
  'rippling line of orange muzzle flashes runs down her hull from bow to stern, lighting her sails, her rigging and the white '
  'smoke that rolls out across the water; the cannon jump back on their carriages. The camera tracks along her side at deck '
  'height through the smoke.')
v('raid_2_chain', 'trailer2', 'Книппели',
  'A Crown frigate under full sail in a grey morning: a whirling chain shot tears into her rigging, sails rip from head to foot, '
  'ropes whip loose, and her main topmast cracks and topples slowly forward in a tangle of canvas and line while her crew scatter '
  'from beneath it on the deck. The camera looks up from her quarterdeck as the mast falls.')
v('raid_3_fireship', 'trailer2', 'Брандер',
  'Night in a crowded anchorage: a small ship wrapped in roaring flames drifts on the tide straight toward a line of anchored '
  'merchantmen, its burning sails throwing sparks high into the dark; on the merchant decks sailors frantically cut their anchor '
  'cables and push off with long poles as the glow lights their faces. The camera glides ahead of the fireship toward the line.')
v('raid_4_mortar', 'trailer2', 'Мортира',
  'Dusk off a rocky coast: on the deck of a squat bomb ketch a huge mortar fires upward with a deep thump and a gout of smoke; the '
  'camera follows the black shell climbing in a high arc trailing a sputtering fuse against the purple sky, then looks down as it '
  'bursts in a flash of fire over the stone walls of a harbour fort far below.')
v('raid_5_ram', 'trailer2', 'Таран',
  'A heavy sea under a storm sky: a pirate brigantine charges bow first through the waves and rams the side of a merchant ship '
  'amidships; timbers crack and splinter, both hulls shudder and heel, spray bursts high, and grappling lines fly across as the '
  'pirates brace on the bow. The camera rides on the brigantine\'s bowsprit into the impact.')
v('raid_6_town', 'trailer2', 'Набег на город',
  'Night raid on a small colonial harbour town: pirates with torches run up from the boats along a cobbled street between white '
  'houses with shuttered windows, a church bell clangs, townsfolk flee into the alleys, and two pirates heave an iron-bound chest '
  'out of the customs house doors toward the waiting boats. The camera runs with the pirates up the street.')
v('raid_7_swivel', 'trailer2', 'Картечь с борта',
  'Close on the rail of a pirate ship in a boarding fight at dusk: a grizzled gunner swings a brass swivel gun on its post and '
  'fires it across the narrow gap at the enemy\'s rail in a blast of smoke and sparks, the recoil jolting the post; behind him '
  'boarders crouch ready with hooks and cutlasses. The camera holds tight beside the gunner\'s shoulder.')


# ---- The sixth reel: the sea's weather and hours, the ship's pets, and the moments of a captain's life (client/src/main.ts
# filmMoments and the windows that open them) ----------------------------------------------------------------------------
v('cut_calm', 'calm', 'Штиль',
  'A dead calm at noon in the tropics: the sea lies flat as polished glass to the horizon, mirroring a pale white sky; a pirate '
  'brig sits motionless, her patched sails hanging limp from the yards and her flag drooping against the mast. On deck the '
  'sweating crew lounge in the scraps of shade — one fans himself with his tricorne, one lowers a bucket on a rope for '
  'seawater, the cook squints up at the sun. The camera drifts very slowly down from the masthead, past the limp canvas, to '
  'the still water barely lapping the hull.')
v('cut_rain', 'rain', 'Шквал',
  'A squall line marches across a grey sea: a curtain of driving rain sweeps over a pirate brig; her deck turns dark and '
  'streaming, sailors in tarred coats haul on the halyards and clamber up the shrouds to reef the topsails as they snap and '
  'thunder, and the helmsman leans into the wheel with rain pouring off his hat brim. The camera stands on the quarterdeck '
  'behind the helmsman looking forward as the rain hits.')
v('cut_dawn', 'dawn', 'Рассвет',
  'Dawn at sea after a long night: the first sliver of sun rises out of a calm grey-gold sea, its light running along the '
  'water to the bow of a pirate brig; the night lanterns are blown out one by one, the watch below climbs up yawning and '
  'stretching, a sailor washes his face in a bucket, the galley chimney begins to smoke and gulls wheel round the mastheads. '
  'The camera moves slowly along the deck from stern to bow into the sunrise.')
v('cut_pet_parrot', 'pet_parrot', 'Попугай',
  'The warm lamplight of a captain\'s cabin, its stern windows open on a blue evening sea: a bright green and scarlet parrot '
  'flutters in through the window, lands on the back of a carved chair, cocks its head, then hops onto the shoulder of the '
  'weathered pirate captain bent over a chart, who smiles and offers it a seed. The camera pushes in slowly on the bird and '
  'the captain.')
v('cut_pet_cat', 'pet_cat', 'Корабельный кот',
  'Below decks in a ship\'s hold lit by a single hanging lantern among barrels, sacks and coiled ropes: a lean grey-striped '
  'ship\'s cat stalks along a beam, freezes, then springs down into the shadows between the casks; a moment later it trots '
  'out into the light, tail high and nothing in its mouth, and rubs against the boots of an old sailor who chuckles and '
  'scratches its ears. The camera follows the cat low along the beam.')
v('cut_pet_monkey', 'pet_monkey', 'Обезьянка',
  'On the sunny deck of a pirate brig a small brown capuchin monkey in a tiny red sash scampers up the rigging, swings from '
  'a ratline, snatches a sailor\'s bandana and races out along the yardarm with it while the crew below laugh and point; it '
  'perches on the end of the yard against the blue sky and puts the bandana on its own head. The camera tilts up following '
  'the monkey into the rigging.')
v('cut_pet_dog', 'pet_dog', 'Корабельный пёс',
  'At the bow of a pirate brig cutting through a bright, choppy sea, a big shaggy black dog stands with its front paws on the '
  'rail, ears flying in the wind and spray, barking happily at a pod of dolphins leaping beside the bow wave, while a young '
  'sailor holds its rope collar and laughs. The camera is low on the deck beside the dog, looking out over the bow.')
v('cut_party', 'party', 'Эскадра',
  'Morning on a wide, glittering sea: three pirate ships of different sizes — a lean sloop, a brig and a heavy frigate under '
  'black and red pennants — sail in line abreast with the wind on their quarter, close enough that their crews wave and shout '
  'across the water; signal flags run up and down the lead ship\'s halyards and all three set more sail together. The camera '
  'flies low and slowly ahead of the squadron, turning to take in all three.')
v('cut_wanted', 'wanted', 'Охотники',
  'Late afternoon on a hazy sea: at the stern of a pirate brig the captain raises a brass spyglass; far off on the horizon two '
  'sleek Crown sloops of war with white sails and long red pennants turn together onto her wake, their bow waves rising as they '
  'crowd on sail to give chase. The camera starts close behind the captain\'s shoulder, then pushes out along the line of the '
  'spyglass toward the distant hunters.')
v('cut_repair', 'repair', 'Кренгование',
  'A pirate brig careened on a quiet white-sand beach at low tide, heeled over on her side with tackles run to the palm trees: '
  'carpenters on rope cradles hammer new oak planks over a shattered patch of her hull, others drive oakum into the seams and '
  'smear hot black tar from a smoking iron pot, and a sailmaker sitting on the sand stitches a torn sail across his knees. The '
  'camera tracks slowly along the exposed hull from stern to bow.')
v('cut_rank', 'rank', 'Слава капитана',
  'Night on the main deck of a pirate brig lit by lanterns and a fire in an iron brazier: the whole crew crowds round, raising '
  'tankards and cheering as their captain, in a fine new dark long coat with brass buttons, climbs up onto a cannon; a grizzled '
  'bosun hangs a silver-buckled sword belt across the captain\'s shoulder and a fiddler strikes up a tune. The camera rises '
  'slowly over the cheering crowd toward the captain.')
v('cut_nethaul', 'nethaul', 'Улов',
  'On the deck of a pirate sloop in a grey dawn swell, six sailors heave together on a capstan as a huge bulging net rises '
  'dripping over the rail, crammed with flashing silver fish, a tangle of kelp, a big lobster and a round barnacled jar; the '
  'net swings inboard and spills its glittering catch across the wet planks. The camera is low on the deck as the catch pours '
  'toward it.')
v('cut_quest', 'quest', 'Расчёт',
  'Inside a harbour master\'s office in a stone customs house, warm lamplight through dusty windows: a stout harbour master in '
  'a powdered wig counts heavy silver coins from an iron strongbox into a leather purse, ties it and slides it across the '
  'scarred oak table to a weathered pirate captain, who weighs it in one hand and gives a slow nod. The camera starts on the '
  'coins and rises to the captain\'s face.')
v('cut_saga', 'saga', 'Судовой журнал',
  'Deep night in a captain\'s cabin: by a single guttering candle a weathered captain writes slowly in a thick leather-bound '
  'ship\'s log with a quill — only blurred lines of ink, nothing legible — then pauses to look out of the stern windows at the '
  'moonlit wake; around the desk lie a brass astrolabe, a sheathed sword, a pistol and a small carved figurehead. The camera '
  'moves slowly from the candle flame across the pages to the window.')
v('cut_trophy_hall', 'trophy_hall', 'Зал трофеев',
  'A long timber hall above a pirate harbour, lit by lanterns and a roaring hearth: its walls hung with trophies — a great '
  'stuffed shark hanging from the beams, the mounted head of a giant swordfish, a colossal crab claw, captured flags in faded '
  'colours, a ship\'s bell and crossed boarding axes — while a few captains stand admiring them with tankards in hand. The '
  'camera glides slowly along the wall of trophies.')
v('cut_tattoo', 'tattoo', 'Татуировщик',
  'In the dim back room of a harbour tavern, lit by an oil lamp, an old tattoo artist with ringed fingers carefully paints a '
  'dark blue compass rose onto the forearm of a seated sailor with a fine brush, a tray of small ink pots beside him; on the '
  'walls hang sheets of sketched designs — anchors, swallows, mermaids and sea serpents. The camera pushes in slowly from the '
  'lamp to the finished design.')
v('cut_dice', 'dice', 'Кости',
  'A smoky harbour tavern at night: around an upturned barrel lit by a candle in a bottle, four rough pirates lean in as one '
  'shakes a leather cup and slams it down; a dozen silver coins lie in the middle, faces glow in the candlelight, one grins, '
  'another scowls and pushes back his tricorne, and the cup lifts to reveal the bone dice. The camera circles slowly at '
  'table height.')


# ---- The seventh reel: the seven new lairs of the islands' wild beasts (shared/src/data/lairs.ts), each the first
# time she lands against one (client/src/main.ts LAIR_FILM) -----------------------------------------------------------
v('cut_jaguar_den', 'lair_jaguar_den', 'Логово ягуаров',
  'A landing party with cutlasses and muskets pushes into a dark green tropical jungle from a white beach, hacking at vines '
  'in the dripping heat; shafts of light fall through the canopy, parrots scream and fly up, and on a mossy fallen trunk above '
  'the path a rosetted jaguar lies flat, its gold eyes following them, its tail twitching, then it bares its teeth. The camera '
  'creeps forward low along the path behind the sailors.')
v('cut_ape_ridge', 'lair_ape_ridge', 'Обезьяний хребет',
  'A rocky ridge of grey stone and stunted palms over a beach at dusk: on its crest a huge grey-backed ape rises onto its legs '
  'and beats its chest, its roar echoing over the bay, while more apes appear among the rocks and wild boars root in the scrub '
  'below; the pirates\' longboat grinds onto the sand beneath them. The camera tilts slowly up from the boat to the roaring ape.')
v('cut_croc_mangroves', 'lair_croc_mangroves', 'Крокодильи мангры',
  'A longboat glides slowly through a maze of mangrove roots in brown, still water under a hazy sky, sailors poling it '
  'carefully and peering into the gloom. Close beside the boat in the foreground lies a huge saltwater crocodile, longer than '
  'the boat, its ridged armoured grey-green back and long narrow toothed snout just above the water like a floating log; it '
  'opens a yellow eye and slides silently under the hull. No frogs or toads. The camera floats low on the water just ahead '
  'of the bow.')
v('cut_bat_cave', 'lair_bat_cave', 'Пещера летучих мышей',
  'Dusk at the black mouth of a cave in a sea cliff: pirates with torches and drawn cutlasses step in over wet rocks, and a '
  'vast cloud of giant bats bursts out over their heads with a roar of wings, the torchlight flickering on leathery wings and '
  'small fangs, while a huge grey monitor lizard watches from a ledge with its tongue flicking. The camera stands just inside '
  'the cave looking out at the sailors.')
v('cut_moray_reef', 'lair_moray_reef', 'Риф мурен',
  'A shallow coral reef close to a tropical shore, the surf washing over it in turquoise sheets: a sailor wades waist-deep with '
  'a boat hook, and from a dark hole in the coral a giant mottled moray rises with its jaws gaping, while silver barracudas '
  'flash through the channel beside him; his mates shout from the longboat. The camera hangs half under the clear water at '
  'the reef\'s edge.')
v('cut_albatross_rock', 'lair_albatross_rock', 'Скала альбатросов',
  'A bare wind-scoured rock far out at sea under racing grey clouds, white with nesting seabirds: giant albatrosses with long '
  'narrow wings wheel and hang on the gale above it, gulls scream and dive, and a longboat of pirates rows in through the '
  'heavy swell toward its foot. The camera soars with the albatrosses along the face of the rock.')
v('cut_octopus_wreck', 'lair_octopus_wreck', 'Осьминожий остов',
  'Low tide on a desolate beach of black sand and grey mist where the broken hull of an old ship lies on her side, ribs and '
  'planks covered in weed: from her shattered hold a giant dark-red octopus heaves itself out, its arms curling over the '
  'timbers, and beside it a giant hermit crab in an old green-bronze ship\'s bell clatters down the planks toward the pirates '
  'wading ashore. The camera moves slowly toward the wreck.')


# ---- The eighth reel: the great beasts' grottos and the guardians' seats (shared/src/data/lairs.ts) -------------------
v('cut_crab_hollow', 'lair_crab_hollow', 'Полость краб-королевы',
  'Inside a hollow of black rock and palm roots behind a tropical beach, lit by shafts of green light: the ground is littered '
  'with split coconuts and old ship\'s bells, and out of the shadows a colossal coconut crab queen with a blue and orange '
  'coral-crusted shell rises on her jointed legs and opens her huge uneven claws at the pirates\' torches. The camera pushes '
  'slowly in from the entrance.')
v('cut_wyrm_gallery', 'lair_wyrm_gallery', 'Галерея змея',
  'Deep in a cave gallery of grey stone, water dripping from the roof: pirates with lanterns creep along a ledge as clouds of '
  'bats stir overhead, and below them a long pale blind wyrm with milky scales slides out of a black pool, lifts its narrow '
  'head and tastes the air toward the lantern light. The camera looks down from the ledge past the lanterns.')
v('cut_hydra_pool', 'lair_hydra_pool', 'Омут гидры',
  'A still black pool in the heart of a mangrove swamp under hanging moss and grey mist: the water bulges, and a three-headed '
  'hydra with mossy olive scales rises from it, its three heads swaying apart on long necks and hissing at a longboat of '
  'pirates frozen among the roots, a crocodile sliding away beside them. The camera floats low on the water toward the pool.')
v('cut_ape_throne', 'lair_ape_throne', 'Трон короля обезьян',
  'The summit of a jungle island at sunset, a ring of mossy carved stones round a great flat rock: apes gather on the stones, '
  'and on the rock a colossal scarred silverback with a crown of coral and carved stone rises to his full height, beats his '
  'chest and roars over the treetops as pirates climb into the clearing below. The camera rises slowly from the pirates to '
  'the ape king.')
v('cut_roc_eyrie', 'lair_roc_eyrie', 'Гнездо руха',
  'A needle of bare rock rising from a storm-tossed sea, lightning flickering in the clouds behind it: on its summit, in a '
  'nest of driftwood and broken masts, a colossal storm roc spreads its slate-grey wings with sparks running along the '
  'feathers and screams into the wind, albatrosses wheeling round it, while far below a longboat fights the swell. The '
  'camera circles the summit.')


# ---- The ninth reel: the ten new bosses (shared/src/data/bosses.ts, shorebosses.ts) and six of the twenty new ports
# (tools/art/ports.py), each the first time she meets it -----------------------------------------------------------------
v('cut_old_moorings', 'boss_old_moorings', 'Старый Швартов',
  'A grey dawn over a silted harbour mouth on a black coast, old breakwaters of stone and rotten piles: a small brig drifts '
  'slowly past, and the grey silt beside her heaves as a colossal conger eel as thick as a mainmast rears up out of the mud, '
  'rusted mooring chains and frayed hawsers wound round its body, weed streaming from it, its blunt head with small pale eyes '
  'swinging toward the ship. The camera stays low on the water beside the brig.')
v('cut_old_tithe', 'boss_old_tithe', 'Сборщица Десятины',
  'A convoy of three laden merchant ships on a hazy grey-green sea: behind the last one a tall scarred dorsal fin cuts the '
  'water, and a huge old grey shark as long as a frigate rises alongside, its hide crusted with barnacles and broken harpoon '
  'heads, rolls one pale eye up at the cargo nets and takes a crate from the rail in its jaws. The camera follows the fin '
  'along the hull.')
v('cut_fog_changeling', 'boss_fog_changeling', 'Подменыш туманов',
  'Thick white fog on a still sea at dusk, a lone frigate creeping through it with her lanterns lit: around her four dim '
  'shapes of a giant cuttlefish appear in the fog at once, their skins rippling with pale bands of pearl and violet light, '
  'and only one of them leaves a wake on the water as it glides closer. The camera slowly turns round the frigate\'s bow.')
v('cut_cinder_ray', 'boss_cinder_ray', 'Пепельный скат',
  'Night among volcanic islands, the sky red with a distant eruption and ash falling like snow: out of a drifting cloud of '
  'ash a colossal manta ray glides low over the black water, its glassy black wings seamed with glowing orange cracks, and '
  'where its wingtips touch the sea the water hisses and steams as two warships turn their broadsides toward it. The camera '
  'looks up from the water as the ray passes over.')
v('cut_drowned_prelate', 'boss_drowned_prelate', 'Утонувший Прелат',
  'Midnight over the drowned ruins of a sunken capital, three broken church spires standing out of the black sea with green '
  'bronze bells swinging in their belfries: between them a vast hunched shape rises from the water, a tall mitre of pale '
  'coral and a cope of dark kelp, long pale hands lifting a crozier of driftwood as every bell begins to toll and the ships '
  'nearby turn away. The camera rises slowly between the spires.')
v('cut_rime_twins', 'boss_rime_twins', 'Инеевые близнецы',
  'A grey arctic sea among floating ice under a low sun: two white narwhals with long spiral tusks burst together out of '
  'white water ahead of a whaling ship, frost glittering on their backs, and dive again side by side as the whalers at the '
  'bow raise their harpoons and the ice cracks around the hull. The camera skims the water behind the twins.')
v('cut_mire_mother', 'lair_mire_mother', 'Мать Трясины',
  'A steaming swamp at dusk under hanging moss, frogs croaking among the reeds: pirates with torches wade knee-deep toward a '
  'mound of mud, and the mound opens two huge golden eyes, a colossal toad-queen with mottled olive hide and pale glistening '
  'spawn heaped on her back swells her throat and flicks out a long tongue at the nearest torch. The camera floats low over '
  'the black water behind the pirates.')
v('cut_cinder_salamander', 'lair_cinder_salamander', 'Пепельная саламандра',
  'A black lava field on a volcanic island at night, cracks glowing orange in the ground: a landing party with muskets '
  'crosses it carefully, and from a fissure ahead a great black salamander as long as a pinnace crawls out, its hide cracked '
  'with glowing embers, sparks rising off its back, and breathes a gout of fire across the rocks. The camera looks along the '
  'muskets toward the beast.')
v('cut_drowned_abbess', 'lair_drowned_abbess', 'Аббатиса Утонувшего Колокола',
  'Night in a graveyard of wrecked ships on a grey beach, fog drifting between the broken hulls and lanterns burning on poles: '
  'robed bell-ringers toll small bronze bells in a circle, and out of the shallows walks a tall drowned abbess in a habit of '
  'dark weed and pale coral, an old bronze church bell swinging on a rusted chain in her hands, water streaming from her. '
  'The camera moves slowly toward her through the fog.')
v('cut_walrus_tyrant', 'lair_walrus_tyrant', 'Морж-тиран',
  'A rocky northern shore under a cold grey sky, a herd of walruses hauled out on the stones: the herd parts as a colossal '
  'old walrus bull with a scarred brown hide and long yellowed tusks heaves himself up, bellows a cloud of steam and lunges '
  'down the rocks toward a landing party with lowered pikes. The camera stays low among the rocks before the pirates.')
v('cut_port_bellhaven', 'port_bellhaven', 'Колокольная Гавань',
  'Morning fog over the Crown\'s great dockyard: two half-built warships stand on their stocks in long stone dry docks, '
  'carpenters swarming over their bare ribs, a ropewalk shed stretches along the quay, and from a tall grey bell tower the '
  'Admiralty bell rings as a frigate is towed slowly out past the star bastion. The camera glides in over the water toward '
  'the dry docks.')
v('cut_port_slagport', 'port_slagport', 'Шлаковый Порт',
  'Night at a soot-black foundry town on black volcanic sand under a smoking cone: brick furnaces glow along the shore, '
  'molten iron pours into cannon moulds in showers of sparks, rows of new cannon barrels lie on the quay, and a pirate brig '
  'is loading them by lantern light. The camera drifts in toward the glowing furnaces.')
v('cut_port_frostgate', 'port_frostgate', 'Ледяные Ворота',
  'A snowy fjord between dark mountains at twilight: a walled whaling town with steep timber longhouses, its gate two giant crossed '
  'ivory narwhal tusks, the try-works smoking over the harbour and floes of ice knocking against the piers as a whaler comes in '
  'with her boats towing behind her. The camera moves in under the tusk gate.')
v('cut_port_steeplewater', 'port_steeplewater', 'Шпилевая Вода',
  'Night in a half-drowned gothic cathedral town: the upper storeys and spires of grey stone churches rise from the black '
  'sea, wooden walkways run between their windows, a pale green light glows in a great rose window, and at low tide the '
  'drowned bells below the water toll as a boat rows in between the spires. The camera glides along the walkways.')
v('cut_port_lotus_anchorage', 'port_lotus_anchorage', 'Лотосовая Стоянка',
  'Evening at an eastern trading enclave: curved tiled roofs, a tall five-storey pagoda and red lacquered gates over a stone '
  'quay, two great junks with ribbed batten sails moored alongside, paper lanterns glowing and merchants unrolling bolts of '
  'silk under awnings as a pagoda bell rings the tide. The camera moves slowly in past the junks\' sterns.')
v('cut_port_wreckhold', 'port_wreckhold', 'Обломная Крепь',
  'Dusk on a coral reef where a whole town has been built from shipwrecks: upturned hulls serve as roofs, ship sterns with '
  'their gallery windows are houses, broken masts carry rope bridges, and a beached galleon has become a tavern with lamps in '
  'every gun port, pirates drinking on her slanted deck. The camera rises slowly over the wrecks.')


# ---- The tenth reel: the rest of the twenty new ports, each on her first call (tools/art/ports.py) ---------------------
v('cut_port_gallowsmouth', 'port_gallowsmouth', 'Висельная Губа',
  'A grey squall over a black rock in the sea: a dark star fort crowns it, a square stone gaol with barred windows stands over '
  'the quay, and two old dismasted prison hulks lie moored in the harbour with lanterns in their ports as a Crown cutter rows '
  'a boat of chained prisoners toward the steps. The camera drifts in low past the hulks.')
v('cut_port_copperhook', 'port_copperhook', 'Медный Крюк',
  'Dusk in a rich League town cut by canals: tall narrow brick counting houses with green copper roofs lean over the water, '
  'wooden cranes swing bales onto the quays, clerks in black coats hurry over little arched bridges and a domed guildhall '
  'glows at the end of the main canal. The camera glides along the canal on a barge.')
v('cut_port_rotgut_landing', 'port_rotgut_landing', 'Сивушная Пристань',
  'Night over grey mudflats: a ramshackle town of leaning plank shacks and taverns on stilts, copper stills smoking and '
  'glowing, rope walkways swaying between them, drunken sailors singing on a rickety jetty and barrels rolling down a ramp '
  'into a waiting boat. The camera weaves slowly between the stilts at the height of the walkways.')
v('cut_port_sugarloaf', 'port_sugarloaf', 'Сахарная Голова',
  'Morning under a conical green hill: cane fields climb the slopes, three stone windmills turn slowly, the chimneys of the '
  'boiling house smoke over white warehouses with red tile roofs, and casks of sugar and rum are rolled down to a League '
  'merchantman at the quay. The camera rises slowly from the quay toward the mills.')
v('cut_port_hushwater', 'port_hushwater', 'Тихая Вода',
  'Thick night fog on still water: dark wooden houseboats lashed together in rings around a half-sunken stone bell tower, '
  'shuttered lanterns leaking thin lines of light, cloaked figures passing sealed letters across the gaps between the boats '
  'in silence as a slim black boat slides in. The camera glides silently between the houseboats.')
v('cut_port_mirrorfen', 'port_mirrorfen', 'Зеркальная Топь',
  'Grey dawn in a vast mangrove forest: dark huts are built high in the roots of the huge trees, joined by rope bridges, and '
  'on two thin wooden towers men tilt great round bronze mirrors that flash signals across the fog as a longboat poles in '
  'below. The camera rises from the water up to the mirror towers.')
v('cut_port_widows_wick', 'port_widows_wick', 'Вдовий Фитиль',
  'Night on a grey cliff over a rough sea: a very tall striped lighthouse sweeps its beam through the fog over a village of '
  'stone cottages, women in dark shawls stand on the cliff path watching the sea, and a single fishing boat fights its way '
  'in toward the stone jetty at the foot of a steep stair. The camera circles the lighthouse lamp.')
v('cut_port_brimstone_bay', 'port_brimstone_bay', 'Серная Бухта',
  'A volcanic bay under a hazy yellow sky: terraced slopes of bright yellow sulphur rock steam from a hundred vents, miners '
  'with cloths over their faces push carts of yellow lumps along rails to wooden chutes, and the sulphur pours down the '
  'chutes into the hold of a moored brig. The camera moves slowly up the steaming terraces.')
v('cut_port_sealhold', 'port_sealhold', 'Тюленья Крепь',
  'Night on an ice shelf under green and violet aurora: a tiny settlement of low round turf huts half buried in snow, frames '
  'of stretched sealskins, dogs and sledges, a channel cut through the ice with a short timber jetty where a small sloop is '
  'frozen in. The camera drifts slowly over the huts toward the sky.')
v('cut_port_saltglass', 'port_saltglass', 'Соляное Стекло',
  'Blinding noon on a sun-bleached island: a white town of flat-roofed adobe houses beside a chequerboard of shallow white '
  'salt pans, workers raking salt into glittering heaps, the domed brick glass kilns glowing as a glassblower lifts a molten '
  'bottle on his pipe. The camera moves slowly across the salt pans toward the town.')
v('cut_port_tidehallow', 'port_tidehallow', 'Приливная Обитель',
  'Evening on wide tidal flats: a walled grey-stone monastery of the Choir stands on a rocky islet at the end of a long stone '
  'causeway, the tide is racing in over the sands and closing the road, and hooded monks with lanterns hurry the last cart '
  'across as the bell tolls. The camera rises slowly over the causeway.')
v('cut_port_crownfall', 'port_crownfall', 'Павшая Корона',
  'Morning in the drowned capital: broken marble colonnades and a cracked dome rise from flooded courtyards, salvagers on '
  'wooden platforms work cranes that haul dripping statues and chests out of the water, and a diver in a brass helmet is '
  'hoisted up from the green depths. The camera glides past the colonnades.')
v('cut_port_last_light', 'port_last_light', 'Последний Огонь',
  'Night at the edge of the deep: a fortress lighthouse on a sheer black sea stack throws its great beam over a dark, '
  'endless sea where the water falls away into blackness, huge pale timber buttresses brace its walls, and heavy guns stand on the '
  'curtain walls as a lone frigate comes in under the beam. The camera slowly climbs the tower toward the lamp.')
v('cut_port_marrowdeep', 'port_marrowdeep', 'Костный Омут',
  'Night on a reef of tall pale coral pillars rising from black water: chapels of black stone and pale coral arches, faint '
  'green glowing pools, robed singers of the Choir chanting on the shore as small bronze bells sway in the wind and the '
  'water glows where they sing. The camera floats slowly in across the glowing water.')

# ---- The premium hulls' launches (docs/02 §1.A.9): the first premium hull of each list she sails out of the yard ----------
v('cut_premium_combat', 'premium_combat', 'Флагман на воду',
  'Dawn in a great stone dry dock: the shores are knocked away and a black-hulled war frigate with deep crimson sails slides '
  'down the ways into the harbour in a wave of white spray, her gilded stern catching the first light, the yard crew '
  'cheering and hats flying as her guns run out along both sides. The camera follows her down the slipway into the water.')
v('cut_premium_trade', 'premium_trade', 'Золотая каррака',
  'Morning in a busy merchant harbour: a richly gilded carrack with cream and gold sails is warped out from the quay, her '
  'castles covered in carved gold leaf, chests and bales lashed on her deck, merchants in fine coats watching from the quay '
  'as her sails fill and the harbour bells ring. The camera rises slowly beside her gilded stern.')
v('cut_premium_fast', 'premium_fast', 'Призрачный клипер',
  'Night on a calm sea under a full moon: a long pale clipper with silver-grey timbers and sheer torn grey sails glides out '
  'of a fog bank at great speed, mist streaming off her rigging, her wake a thin silver line, leaving the fog behind as the '
  'crew trim the sails. The camera races low along the water beside her bow.')
v('cut_premium_hauler', 'premium_hauler', 'Ковчег левиафана',
  'Grey morning on a wide bay: a colossal five-masted ark heavier than any ship afloat is towed out by a line of longboats, '
  'great timber pens of sea water along her deck, a young leviathan calf surfacing in one of them and blowing a spout of '
  'spray as gulls wheel over her masts. The camera pulls slowly back to show her whole length.')
v('cut_premium_beast', 'premium_beast', 'Существа из лавки',
  'Night alongside a pirate ship at anchor in a quiet bay lit by her stern lanterns: the black water bulges and a great sea '
  'dragon with dark blue-green scales and finned wings rises slowly beside the hull, water streaming off it, and lowers its '
  'crested head to the rail where the captain stands holding up a lantern while the crew step back in awe. The camera rises '
  'with the dragon past the side of the ship.')


# ---- The twelfth reel: windows that are places of their own, each the first time she opens it -------------------------
v('cut_shop', 'shop', 'Лавка дублонов',
  'A narrow lamp-lit shop under the arches of a harbour, its shelves crowded with gilded ship models, carved figureheads and '
  'small cages, a grey-bearded merchant in a velvet coat weighing heavy gold doubloons on brass scales and sliding one '
  'across the counter as the candlelight glints on the coins. The camera moves slowly in over the counter.')
v('cut_barter', 'barter', 'Торг на палубе',
  'Two pirate captains facing each other across a barrel head on the deck of a ship at dusk, one setting down a small chest of '
  'silver and the other a bolt of fine cloth, their crews watching from the rails as the two ships lie lashed side by side '
  'and the captains shake hands over the deal. The camera circles slowly round the barrel.')
v('cut_company', 'company', 'Зал компании',
  'A long timbered hall above a harbour tavern at night: captains of one company gather round a great table spread with '
  'charts and a carved company flag, tankards raised as their chosen admiral pins a new mark on the chart and the fire '
  'roars in the hearth behind. The camera moves slowly down the length of the table.')
v('cut_crew', 'crew', 'Сбор команды',
  'Morning on the main deck of a pirate frigate: the whole crew mustered in ragged lines, the bosun walking along them with '
  'a lantern and a list, gunners, topmen, cooks and boys answering to their names as the captain watches from the '
  'quarterdeck rail. The camera tracks slowly along the lines of faces.')
v('cut_gear', 'gear', 'Оружейная',
  'Inside the armoury of a ship lit by a single lantern: racks of cutlasses, boarding pikes and pistols along the walls, a '
  'captain buckling on a worn leather baldric and a steel gorget, the gunner handing her a pair of polished pistols as the '
  'ship creaks around them. The camera moves slowly along the racks to the captain.')
v('cut_recruit', 'recruit', 'Вербовка на причале',
  'A crowded quay in the rain: rough sailors, deserters and young dockhands line up before a recruiting table with a '
  'ledger and a jug of rum, a one-eyed quartermaster signing them on one by one as the longboat waits at the steps. '
  'The camera moves slowly along the line toward the table.')

# ---- The thirteenth reel: each sea the first time she sails into it (shared/src/world/regions.ts) ----------------------
v('cut_sea_gravewater', 'sea_gravewater', 'Могильные Воды',
  'A flat grey-green sea under low cloud, the masts of old wrecks standing out of the shallows like a drowned forest, buoys '
  'with tolling bells marking the channels and a League convoy threading between them in single file, gulls on every '
  'spar. The camera glides low between the wreck masts.')
v('cut_sea_whispering', 'sea_whispering', 'Шепчущее море',
  'A ship slips into a wall of white fog so thick the bowsprit vanishes, the sea gone silent and glassy, faint lanterns of '
  'unseen boats drifting past in the murk and a lookout in the shrouds cupping a hand to his ear as a distant voice calls '
  'across the water. The camera moves slowly forward into the fog from the bow.')
v('cut_sea_ashen_isles', 'sea_ashen_isles', 'Пепельные острова',
  'A ship sails under a dark red sky into a sea of volcanic islands, black cones smoking on every side, grey ash falling '
  'like snow on the deck, the water warm and steaming where a lava flow meets the sea in a hiss of white vapour. The camera '
  'rises from the deck over the bow toward the burning islands.')
v('cut_sea_leviathan_reach', 'sea_leviathan_reach', 'Предел Левиафана',
  'A cold grey northern sea among drifting ice, a whaling ship pushing through the floes under a pale sun, and far off the '
  'vast dark back of something enormous rising slowly from the water and sinking again as the crew fall silent at the '
  'rail. The camera holds on the horizon past the bow.')
v('cut_sea_dead_mans_expanse', 'sea_dead_mans_expanse', 'Простор Мертвеца',
  'An endless flat sea under a white-hot sky, no wind, the sails hanging slack, a lonely atoll of bleached sand and dead '
  'palms on the horizon and an empty longboat drifting past the becalmed ship, the crew watching it go by in silence. The '
  'camera drifts slowly past the empty boat.')
v('cut_sea_drowned_crown', 'sea_drowned_crown', 'Утонувшая Корона',
  'Dusk over a sea strewn with the ruins of a sunken capital: the tops of marble towers, broken arches and a great dome '
  'stand out of the water, green light glowing faintly beneath the waves, and a ship picks her way between the spires as '
  'a bell tolls somewhere below. The camera glides slowly through the drowned towers.')

# ---- The fourteenth reel: the great ones ashore brought down, each the first time (shared/src/data/shorebosses.ts) -------
v('cut_mire_mother_down', 'down_mire_mother', 'Мать Трясины повержена',
  'Dawn mist over a swamp: the colossal toad-queen sinks slowly back into the black water among the reeds, her golden eyes '
  'closing, as the landing party lowers their torches and muskets on the bank and a pale sun breaks through the hanging '
  'moss. The camera pulls slowly back across the still water.')
v('cut_cinder_salamander_down', 'down_cinder_salamander', 'Пепельная саламандра повержена',
  'On a black lava field at night the great salamander collapses in a shower of sparks, the ember cracks along its back '
  'fading to dull grey one by one, as the musketeers stand in the smoke and a cool rain begins to hiss on the glowing '
  'rocks. The camera circles slowly round the fallen beast.')
v('cut_drowned_abbess_down', 'down_drowned_abbess', 'Аббатиса повержена',
  'In the fog of a ship graveyard the drowned abbess, robed in dark green weed and pale coral, lets the great bronze bell '
  'fall from her hands into the shallows, its last toll rolling out over the wrecks as she sinks back beneath the grey '
  'water and only floating green kelp is left, and the bell-ringers drop their bells and flee into the mist. Nothing red '
  'anywhere in the water. The camera moves slowly toward the fallen bell.')
v('cut_walrus_tyrant_down', 'down_walrus_tyrant', 'Морж-тиран повержен',
  'On a cold rocky shore the old walrus bull heaves himself back into the grey sea with a last bellow, the herd following '
  'him into the surf, as the landing party leans on their pikes on the stones and snow begins to fall. The camera rises '
  'slowly over the empty rocks.')

# ---- The fifteenth reel: the six new sea bosses brought down, each the first time she has a share in it ----------------
v('cut_old_moorings_down', 'down_old_moorings', 'Старый Швартов повержен',
  'Grey dawn at a harbour mouth: the great conger thrashes once among the old breakwaters, its rusted chains snapping, and '
  'sinks slowly back into the silt in a swirl of brown water as the brigs around it cease fire and their crews cheer from '
  'the rigging. The camera stays low on the water as the silt settles.')
v('cut_old_tithe_down', 'down_old_tithe', 'Сборщица Десятины повержена',
  'A grey-green sea after a fight, crates and casks floating everywhere: the huge old shark rolls slowly onto her side '
  'beside a battered merchantman, the broken harpoon heads in her barnacled hide catching the light, and sinks away into '
  'the deep as sailors haul the floating cargo aboard. The camera looks down through the water as she sinks.')
v('cut_fog_changeling_down', 'down_fog_changeling', 'Подменыш туманов повержен',
  'In thick white fog the false shapes of the giant cuttlefish dissolve one by one like smoke, and the last true one sinks '
  'beside a frigate in a cloud of dark ink, its pale banded skin fading to grey, as the fog itself begins to thin and the '
  'first stars appear. The camera turns slowly as the fog lifts.')
v('cut_cinder_ray_down', 'down_cinder_ray', 'Пепельный скат повержен',
  'Among the volcanic islands the great manta crashes into the sea between two warships in a burst of steam, its ember '
  'cracks hissing out one by one, and the ash cloud around it drifts away on the wind to show a clear red dawn. The camera '
  'rises slowly through the steam.')
v('cut_drowned_prelate_down', 'down_drowned_prelate', 'Утонувший Прелат повержен',
  'At midnight among the drowned spires the vast mitred shape sinks slowly back into the black water, its crozier falling '
  'from its pale hands, and one by one the bronze bells in the spires stop swinging and fall silent as the ships close in. '
  'The camera moves slowly between the silent spires.')
v('cut_rime_twins_down', 'down_rime_twins', 'Инеевые близнецы повержены',
  'On a grey arctic sea the two white narwhals sink together side by side beneath the ice floes, their long spiral tusks '
  'the last to vanish, as the frost on the water melts away around the whaling ships and the crews lower their harpoons in '
  'silence. The camera skims slowly over the place where they went down.')

# ---- The sixteenth reel: the old world bosses brought down, each the first time she has a share in it ------------------
v('cut_leviathan_down', 'down_leviathan', 'Левиафан повержен',
  'A cold grey northern sea after a long fight: the vast leviathan rolls slowly over among the ice floes, its plated back '
  'sinking beneath the surface in a great swirl of white water, as the battered warships around it lower their guns and '
  'a pale sun breaks through the clouds. The camera rises slowly over the swirling water.')
v('cut_kraken_down', 'down_kraken', 'Кракен повержен',
  'A storm-tossed sea at dusk: the colossal kraken releases the ships it was gripping, its great arms slipping back one by '
  'one into the dark water, its huge golden eye closing as it sinks into the deep, and the crews pull their shattered '
  'masts upright. The camera looks down as the last arm vanishes.')
v('cut_drowned_whale_down', 'down_drowned_whale', 'Утонувший кит повержен',
  'Midnight over the drowned ruins: the vast grey whale crusted with barnacles and old chains gives a last slow beat of '
  'its flukes and sinks back between the sunken towers, a pale green light fading beneath it, and the sea falls still. '
  'The camera follows the flukes down into the dark.')
v('cut_lantern_maw_down', 'down_lantern_maw', 'Фонарная Пасть повержена',
  'A black night on a flat sea, three-masted pirate ships with lit lanterns standing round in a ring: in their midst a '
  'gigantic anglerfish sea monster, its huge dark head and needle-toothed jaws above the water, hangs a greenish glowing '
  'lure on a long fleshy stalk; the lure flickers and goes out, and the monster sinks slowly away beneath the black water, '
  'leaving only the lanterns of the ships reflected on the still sea. The camera holds on the lure as its light dies.')
v('cut_black_serpent_down', 'down_black_serpent', 'Чёрный змей повержен',
  'Among smoking volcanic islands the great black serpent sinks in coils back into the steaming sea, its spines sliding '
  'under one by one, as the warships round it come about and the ash clouds drift away on the wind. The camera circles '
  'the last coils as they go under.')
v('cut_hollow_admiral_down', 'down_hollow_admiral', 'Пустой Адмирал повержен',
  'On a moonlit sea the ghostly flagship of the Hollow Admiral breaks apart into pale mist, its torn grey sails and '
  'lantern-lit gunports fading like smoke, until only drifting fog and floating spars remain around the victorious ships. '
  'The camera moves slowly through the dissolving ship.')
v('cut_mother_of_wrecks_down', 'down_mother_of_wrecks', 'Мать Обломков повержена',
  'At dawn off a reef the huge shape built of a hundred wrecks groans and collapses into the sea, masts, hulls and spars '
  'tumbling apart and sinking in a great churn of water, as the ships around it cheer and the gulls return. The camera '
  'pulls back slowly from the falling timbers.')
v('cut_storm_widow_down', 'down_storm_widow', 'Вдова Бури повержена',
  'In the heart of a storm over leviathan waters the ship of the Storm Widow is struck by her own lightning and goes dark, the '
  'black clouds tearing open above her to show stars, the rain stopping and the sea calming around the battered ships. '
  'The camera rises slowly into the clearing sky.')
v('cut_ancient_leviathan_down', 'down_ancient_leviathan', 'Древний Левиафан повержен',
  'At the edge of the abyss the ancient leviathan, vast as an island and grown over with coral and weed, sinks slowly '
  'back into the black depths, the sea pouring off its back in waterfalls, as a great swell lifts the tiny ships around '
  'it. The camera holds high above as the shadow fades below.')
v('cut_abyss_eye_down', 'down_abyss_eye', 'Око Бездны повержено',
  'Night mist over the black abyss, seen low from the deck of a battered three-masted ship: out in the slow whirlpool '
  'ahead, half under the water, a vast monstrous eye as big as a ship, with a pale green iris and a narrow slit pupil '
  'and a heavy wrinkled grey lid crusted with barnacles, glows faintly; the lid slowly closes, the green light under the '
  'water fades, and the whirlpool slows and stills until the sea is flat and dark beneath the stars. The camera holds '
  'past the sailors at the rail.')

# ---- The fifteenth reel: the great old lairs ashore won, each the first time (shared/src/data/lairs.ts) ---------------
v('cut_ape_throne_down', 'down_ape_throne', 'Король обезьян уступил трон',
  'Late afternoon light through jungle haze on a throne of fallen rock: the old silverback ape king, crowned with coral and '
  'stone, slowly lowers his great head, steps down from his throne and walks away into the green with his apes, as the '
  'landing party lowers their pikes in the clearing. The camera rises slowly over the empty throne.')
v('cut_roc_eyrie_down', 'down_roc_eyrie', 'Грозовой рух покинул гнездо',
  'A storm breaking over the highest crag of a rocky island: the colossal storm roc spreads its grey wings over its nest '
  'of driftwood, gives one last cry and beats away into the clouds with the albatrosses wheeling after it, as the sky '
  'clears and the climbers stand on the crag. The camera follows the roc into the light.')
v('cut_hydra_pool_down', 'down_hydra_pool', 'Гидра ушла в омут',
  'Dawn mist over a black pool among mangrove roots: the three heads of the great hydra sway, droop and slide slowly back '
  'beneath the weed one after another, the water closing smooth over them, as the pirates on the roots lower their '
  'torches and the crocodiles slip away. The camera drifts low over the still pool.')
v('cut_wyrm_gallery_down', 'down_wyrm_gallery', 'Пещерный змей уполз во тьму',
  'Deep galleries in the rock lit by torches: the blind white cave wyrm coils back from the light, its pale body sliding '
  'away into a black crevice, as a cloud of bats pours out over the heads of the landing party and daylight shows at the '
  'end of the tunnel. The camera follows the bats toward the light.')
v('cut_serpent_grotto_down', 'down_serpent_grotto', 'Молодой змей покинул грот',
  'A sea cave inland, green light rippling on the wet rock: the young sea serpent uncoils from its brood of pale speckled '
  'eggs and slides away down a flooded channel toward the open sea, its scales flashing, as the pirates stand in the '
  'shallows and watch it go. The camera follows the serpent out to the sea.')
v('cut_maw_pit_down', 'down_maw_pit', 'Светоч в яме погас',
  'A drowned stone pit at night, seen from its rim, hooded cultists fleeing up the steps with their lanterns: deep in the '
  'black water below hangs a monstrous deep-sea anglerfish as big as a longboat, with black warty skin, a huge gaping '
  'jaw of long glassy needle teeth and a glowing greenish lure on a long stalk over its head; the lure flickers and '
  'goes out and the great dark shape sinks slowly out of sight into the deep, as the pirates raise their own lanterns '
  'over the edge. The camera looks down into the darkening pit.')
v('cut_octopus_wreck_down', 'down_octopus_wreck', 'Осьминог оставил обломки',
  'A rotting wreck on a reef at low tide: the great octopus slowly unwinds its arms from the broken hull, pales to a mottled '
  'grey and slips away into a dark pool, as the pirates climb onto the wreck and pry open the hatch to the hold. '
  'The camera rises slowly over the wreck.')
v('cut_turtle_guardian_down', 'down_turtle_guardian', 'Древняя черепаха уплыла',
  'Golden evening on a beach of black rock: the ancient turtle guardian, its great shell grown with coral and moss, turns '
  'slowly and wades out into the surf, sinking beneath the waves as the tide washes over the rocks where it lay, and the '
  'pirates on the shore take off their hats. The camera holds on the sea as it disappears.')

# ---- The sixteenth reel: the other lairs ashore won, each the first time (shared/src/data/lairs.ts) -------------------
v('cut_leviathan_shoal_down', 'down_leviathan_shoal', 'Левиафан ушёл с отмели',
  'A spring tide at dusk over a grey shoal: the old leviathan that lay beached there for a hundred years, its back grown '
  'with weed and barnacles, heaves itself free as the high water lifts it and slides slowly out into the deep channel, '
  'the pale drowned men on the sand turning to watch it go. The camera rises slowly over the empty shoal.')
v('cut_crab_hollow_down', 'down_crab_hollow', 'Королева крабов отступила',
  'Late light under the palms in a hollow heaped with split coconuts and old shells: the coconut crab queen, as big as a '
  'longboat, lowers her great blue claws and backs slowly into a cleft in the rock, her court of little hermit crabs '
  'scuttling after her, as the pirates step into the hollow with lanterns. The camera moves slowly in among the shells.')
v('cut_tentacle_lagoon_down', 'down_tentacle_lagoon', 'Щупальца ушли в лагуну',
  'Moonlight on a still lagoon at low tide: the long grey arms that lay across the sand curl back one by one and slide '
  'into the dark water, the last tip vanishing with a ripple, as the landing party stands on the beach with their '
  'boat hooks lowered. The camera holds low over the calm lagoon.')
v('cut_choir_circle_down', 'down_choir_circle', 'Круг Хора умолк',
  'Night in a ring of tall standing stones on a grey headland: the hooded cultists flee down the slope with their '
  'lanterns, the pale drowned figures among the stones walk slowly back into the sea, and the green glow on the stones '
  'fades as the pirates step into the silent circle. The camera circles the stones.')
v('cut_drowned_surf_down', 'down_drowned_surf', 'Утопленники вернулись в море',
  'A grey dawn on a long beach: the pale drowned sailors in rotted coats who walked up from the surf turn and wade slowly '
  'back into the waves until the sea closes over them, and the tide smooths their footprints from the sand as the '
  'pirates lower their cutlasses. The camera pulls slowly back along the beach.')
v('cut_croc_mangroves_down', 'down_croc_mangroves', 'Крокодилы ушли в мангры',
  'Morning haze in the mangroves: the great crocodiles slide one after another off the roots into the brown water and '
  'sink until only their eyes show, then vanish, as the pirates wade forward with muskets held high and the toads fall '
  'silent. The camera skims low over the water between the roots.')
v('cut_jaguar_den_down', 'down_jaguar_den', 'Ягуары покинули логово',
  'Green jungle light: the spotted jaguars on the fallen trunk rise, look back once with golden eyes and melt away '
  'into the leaves one by one, as the landing party pushes through the ferns with cutlasses lowered. The camera moves '
  'slowly up the empty trunk.')
v('cut_ape_ridge_down', 'down_ape_ridge', 'Обезьяны отступили с гребня',
  'Evening on a rocky jungle ridge over a beach: the grey-backed apes stop beating their chests, gather their young and '
  'climb away over the crest into the trees, as the pirates come up the slope from the boats. The camera rises over '
  'the ridge to the sunset sea.')
v('cut_serpent_marsh_down', 'down_serpent_marsh', 'Змеи уползли в тростник',
  'A steaming black marsh at dusk: the long marsh serpents uncoil from the reeds and glide away through the dark water, '
  'their wakes fanning out and fading, as the landing party wades in with torches. The camera follows a wake into the '
  'reeds.')
v('cut_shark_shallows_down', 'down_shark_shallows', 'Акулы ушли с мелководья',
  'Bright warm shallows over white sand: the reef sharks turn away from the surf one after another and glide out into '
  'the deep blue beyond the reef, their fins sinking from sight, as the pirates wade ashore from the boat. The camera '
  'looks down through the clear water as the last shadow goes.')
v('cut_moray_reef_down', 'down_moray_reef', 'Мурены спрятались в риф',
  'Clear water over a coral reef at low tide: the great morays draw back slowly into their holes in the coral and the '
  'silver barracudas wheel away into the channel, as the pirates step carefully across the reef with poles. The camera '
  'glides low over the coral.')
v('cut_bat_cave_down', 'down_bat_cave', 'Летучие мыши покинули пещеру',
  'Dusk at a cave mouth in a sea cliff: a great cloud of bats pours out of the dark and streams away over the sea '
  'against the red-gold sky, and a big monitor lizard slips off the rocks below, as the pirates light their torches at '
  'the cave mouth. The camera turns to follow the bats out to sea.')

# ---- The seventeenth reel: a hull of each list launched (shared/src/data/ships.ts), and the small lairs ashore won ------
v('cut_launch_combat', 'launch_combat', 'Боевой корабль спущен на воду',
  'Grey morning in a naval dockyard: a new black-hulled warship with two rows of closed gun ports slides stern first down '
  'the greased slipway into the harbour in a great wave of spray, the shipwrights cheering from the scaffolds as her '
  'gun crews on deck run out the first cannon. The camera follows her down the ways into the water.')
v('cut_launch_trade', 'launch_trade', 'Торговый корабль спущен на воду',
  'A bright harbour morning on a busy merchant quay: a new broad-bellied trading ship is warped out from the fitting '
  'berth, her hold hatches open as cranes swing the first bales and casks aboard, clerks with ledgers checking each '
  'load and gulls wheeling over her yards. The camera moves slowly along her side from the quay.')
v('cut_launch_fast', 'launch_fast', 'Быстрый корабль спущен на воду',
  'A fresh wind at the harbour mouth: a new lean schooner with raked masts shakes out all her canvas at once and heels '
  'over, racing out past the breakwater and the lighthouse, spray flying from her sharp bow as her crew haul the '
  'sheets. The camera chases low beside her as she gathers speed.')
v('cut_launch_hauler', 'launch_hauler', 'Грузовой корабль спущен на воду',
  'Evening at a deepwater wharf: a huge new hauler, wide and high-sided like a floating warehouse, sits low in the water '
  'as teams of men and oxen load the last great crates up broad ramps into her side ports, her deck stacked with cargo '
  'under tarpaulins and her lanterns being lit one by one. The camera rises slowly along her towering side.')
v('cut_albatross_rock_down', 'down_albatross_rock', 'Альбатросы покинули скалу',
  'A bare grey rock in the open sea under a windy sky: the great albatrosses lift off their nests one after another on '
  'long white wings and glide away low over the waves, the gulls scattering, as the pirates climb up onto the empty '
  'ledges. The camera rises with the last bird.')
v('cut_crab_beach_down', 'down_crab_beach', 'Крабы ушли с пляжа',
  'A wide sandy beach at low sun: hundreds of small shore crabs scuttle sideways into the surf and down their holes '
  'all at once, the moving sand going still, as the pirates walk up from the boats and the gulls lift away. The camera '
  'skims low over the sand.')
v('cut_gull_cliffs_down', 'down_gull_cliffs', 'Чайки покинули утёс',
  'A tall white cliff over a grey sea: a great cloud of gulls bursts from the ledges screaming and wheels away along the '
  'coast, and the cliff falls quiet as the pirates climb the path up its face. The camera pans up the empty cliff.')
v('cut_seal_rookery_down', 'down_seal_rookery', 'Тюлени ушли в море',
  'A rocky shore under a cold grey sky: the big seal bulls bark once more and then slide off the rocks into the sea with '
  'their cows and pups, their round heads bobbing out among the waves, as the landing party steps onto the rocks. '
  'The camera holds low over the water as the heads go under.')
v('cut_turtle_rocks_down', 'down_turtle_rocks', 'Черепахи ушли в прибой',
  'Warm evening on a beach of round boulders: some of the boulders slowly lift their heads and turn out to be huge old '
  'turtles, which crawl down the sand into the surf one by one and swim away, as the pirates stand among their nests. '
  'The camera follows the last turtle into the waves.')
v('cut_hermit_camp_down', 'down_hermit_camp', 'Отшельники сдались',
  'A camp of driftwood huts in the dunes at dusk: the wild-haired castaways in sun-bleached rags throw down their '
  'harpoons on the sand and sit by their fire, and the pirates walk in and sit down with them, passing them a bottle. '
  'The camera moves slowly in toward the fire.')

# ---- Reel 18 (owner, 2026-10-04: «прокачку кораблей можно сделать как в игре world of tanks»; docs/20): the yard's
# tree of hulls and the island's companions ------------------------------------------------------------------------------
v('cut_research', 'research', 'Новый корпус изучен',
  "A shipwright's loft high under the roof of an old harbour yard at night. On a long scarred oak table lit by two brass "
  "lanterns lies a great plan of a ship's hull drawn in faded brown lines on yellowed paper, with no writing anywhere on it; "
  'the weathered hands of an old master shipwright smooth it flat and set a pair of brass dividers on it, then lift a half-model '
  'of the same hull, carved in pale wood, into the lantern light beside the plan. Through a small round window behind, the masts '
  'of the yard stand black against a moonlit sky. The camera moves slowly down from above the table toward the half-model.')
v('cut_research_great', 'research_great', 'Изучен великий корпус',
  'Grey dawn at a great stone slipway in a royal harbour yard: the curved oak frames of an enormous new warship rise on the ways, '
  'taller than the warehouses around them, scaffolding and ladders on every side, shipwrights with mallets and adzes swarming over '
  'them, steam rising from a long steaming box where planks are bent, a crane of timber lifting a heavy oak beam into place. The '
  'camera rises slowly along the stern frames until the whole hull and the waking harbour lie below.')
v('cut_isle_escorts', 'isle_escort', 'Спутники на учениях',
  'A clear cold morning at a small fortified island harbour of your own: two small escort ships, a cutter and a brigantine, sail '
  'out side by side past a stone pier and a squat watchtower, their crews hauling on the lines as both ships come about together '
  'in a tight turn, spray at their bows; at the end of the pier a captain in a long dark coat watches them through a brass spyglass '
  'while the sea fog lifts off the water. The camera tracks low alongside the two ships as they turn.')
v('cut_isle_calf', 'isle_calf', 'Касатка подросла',
  'Late afternoon at a quiet island cove with a wooden pier: a young black-and-white orca, sleek and playful, circles close to the '
  'pier and then leaps clear of the green water in a long arc beside a moored sloop, its tall young fin cutting the surface as it '
  'lands; sailors on the pier lean on the rail and watch. Warm low sun, glittering water. The camera follows the leap in slow motion.')


# ---- Reel 19 (owner, 2026-10-04: «еще больше роликов генерируй»; «ассетов для островов … на разные острова»): the first
# sight of each kind of island, once, when the ship first comes near one at peace (client/src/main.ts) -----------------
ISLE_SHOTS = {
    'temperate': 'a green island of oak woods and pale meadows, a small stone cottage with a slate roof and a windmill on a low hill, sheep-grey stone walls running down to a pebble beach',
    'mossy': 'a dark island furred with moss and spruce, a ring of mossy standing stones on a headland, mist lying in the hollows and a peat pond reflecting the grey sky',
    'volcanic': 'a black volcanic island under a smoking cone, cooled lava flows running into the sea in steaming tongues, sulphur-yellow vents and a ruined watchtower half buried in ash',
    'ice': 'an island of ice and snow, blue ice spires and a frozen waterfall, a small wooden boat locked in the ice of a cove and a snowed-under hut with a thin line of smoke',
    'ruins': 'an island of ancient ruins, a broken colonnade and a toppled statue among wild grass, a sunken courtyard and a ruined chapel apse open to the sky',
    'bone': 'a grey dead island of white bare trees and grey stones, a leaning menhir on the ridge and a rusted anchor half sunk in the grey sand, utterly still',
    'barren': 'a barren island of cracked rock and dry gullies, a lone twisted juniper and a stone cairn on the summit, dust blowing off the cliffs',
    'jungle': 'a jungle island of tall palms and giant ferns, a carved stone idol head among the vines, the thatched roofs of stilt huts and a waterfall into a green pool',
    'mangrove': "a mangrove island of arched roots in dark water, a fisher's hut on stilts, reed beds and a narrow channel winding into the green gloom",
    'atoll': 'a ring-shaped coral atoll around a turquoise lagoon, coconut palms on a white sand bar, a lean-to of palm leaves and bleached driftwood on the beach',
    'saltflat': "a flat white salt island, glittering salt pans and mounds, a salt worker's plank shack and stacks of cut salt blocks under a pale sky",
    'blacksand': 'an island of black sand and black rock, white surf breaking on a black beach, a black rock arch and the ruined base of an old lighthouse',
    'fungal': 'a strange island overgrown with giant pale mushrooms and clusters of faintly glowing violet caps, spore haze drifting between them in the dusk',
    'crystal': 'a strange island of pale blue-white crystal spires rising from grey rock, crystals catching the low light, a ruined pillar wrapped in crystal',
}
for kind, what in ISLE_SHOTS.items():
    v(f'cut_isle_{kind}', f'isle_{kind}', f'Остров: {kind}',
      f'A slow aerial approach from the sea toward {what}. The camera glides low over the waves toward the shore and then rises '
      'gently to reveal the whole island, with a small pirate sloop at anchor in its lee.')


# ---- Reel 20 (owner, 2026-10-04: «еще всяких боссов… корабли плавающие по всей карте… на каждую зону свой босс»): each
# sea's great warship coming out of the haze, played once when she first rises in the captain's waters -----------------
ZBOSS_SHOTS = {
    'black_coast': 'a towering rogue privateer man-of-war with three gun decks, a black hull banded with rusted iron and a crowned lion figurehead, its long red pennant streaming',
    'gravewater': 'a monstrous armed treasure galleon of the trade routes, gilded stern gallery, four masts of dark sails, brass swivel guns crowding its rails',
    'whispering': "a huge black smugglers' ship-of-the-line with charcoal sails and dozens of dim green lanterns along its rails, gliding through thick fog between islets",
    'ashen_isles': 'a colossal fire-galleon of the volcanic isles, forges glowing on its deck, squat mortars in iron rings, smoke-blackened sails, a volcano smoking behind it',
    'leviathan_reach': 'an ice-armoured whaling dreadnought with plates of white ice along its hull, rows of harpoon guns and a great bow ram, sails stiff with frost, ice floes around it',
    'dead_mans_expanse': 'a vast patchwork hulk stitched together from several wrecked ships lashed side by side, many crooked masts and mismatched sails, on a flat grey ocean',
    'drowned_crown': 'an ancient royal galleon rising from the sea, its hull crusted with grey coral and barnacles, water pouring from its gun ports, torn purple and gold banners',
    'the_abyss': 'a colossal black three-masted ark with pale green lights in its gun ports and sails like grey smoke, under a black storm with no wind',
}
for sea, ship in ZBOSS_SHOTS.items():
    v(f'cut_zboss_{sea}', f'zboss_{sea}', f'Босс моря: {sea}',
      f'Out of the sea haze comes {ship}. The camera is low on the water as the huge ship looms closer and turns broadside, '
      'its gun ports opening one by one along the whole length of the hull. A long, slow, menacing shot.')


# ---- Reel 21: the twelve new lairs of the islands (shared/src/data/lairs.ts), each the first time she lands against
# one (client/src/main.ts LAIR_FILM) — no blood, no bones, no skulls ---------------------------------------------------
v('cut_frog_pools', 'lair_frog_pools', 'Лягушачьи заводи',
  'A warm green swamp at dawn, mist on still pools among mangrove roots and giant lily pads: dozens of tiny poison frogs as '
  'bright as jewels — red, blue and yellow — hop across the pads, and a huge warty toad on a mossy log puffs out its throat '
  'and croaks as a pirate longboat noses in through the reeds. The camera glides low over the water toward the toad.')
v('cut_rat_wreck', 'lair_rat_wreck', 'Крысиный остов',
  'An old merchant ship run aground long ago on a grey beach, listing on her side, her planks green with weed: from the open '
  'hatches of her hold a river of brown bilge rats pours down the hull onto the sand, and red shore crabs scuttle among the '
  'barrels as pirates with lanterns wade ashore. The camera moves slowly along the stranded hull at the waterline.')
v('cut_iguana_rocks', 'lair_iguana_rocks', 'Игуановые камни',
  'Black lava rocks at the edge of a bright sea, surf bursting white over them: heaps of dark marine iguanas bask in the sun, '
  'one raises its spiny head and sneezes salt, gulls wheel and scream overhead, and a longboat of pirates rows in through the '
  'swell. The camera sweeps slowly over the basking iguanas toward the boat.')
v('cut_ghost_strand', 'lair_ghost_strand', 'Берег крабов-призраков',
  'A pale empty beach under a low moon, the sand silver and still: suddenly a thousand pale ghost crabs burst from their holes '
  'and race sideways across the sand like a wave, and brown rats run out from a half-buried wreck behind them, as pirates '
  'with torches step back at the tide line. The camera is low on the sand as the crabs rush past.')
v('cut_centipede_ravine', 'lair_centipede_ravine', 'Овраг сколопендр',
  'A steep jungle ravine under a dark green canopy, the floor deep in rotting leaves and ferns, water dripping: a giant '
  'orange-and-black centipede, longer than a man, ripples out from under a fallen log, its many legs rustling, while small '
  'bright frogs leap away; pirates with cutlasses edge down the slope. The camera creeps forward at ground level.')
v('cut_spider_grove', 'lair_spider_grove', 'Паучья роща',
  'A grove of tall jungle trees grey with thick webs from root to crown, shafts of light glittering on the silk: a huge hairy '
  'jungle spider waits at the centre of a vast web between two trunks, and a giant centipede moves through the leaves below as '
  'pirates part the webs with their blades. The camera pushes slowly in through the hanging webs.')
v('cut_bull_savanna', 'lair_bull_savanna', 'Саванна диких быков',
  'Tall golden grass on a wide island savanna under a hot sky: a herd of wild long-horned cattle, left by old ships long ago, '
  'grazes and then lifts its heads as one; a great black bull paws the ground and snorts, and wild boars root in the grass '
  'among the herd as a line of pirates comes up from the beach. The camera rises slowly over the grass toward the bull.')
v('cut_cinder_slopes', 'lair_cinder_slopes', 'Пепельные склоны',
  'Black slopes of ash and cinders under a smoking volcanic cone, the air hazy and orange: lean hounds with dark smouldering '
  'coats, faint embers glowing in their fur, run along a ridge and stop to watch, and a giant centipede slips into a warm crack '
  'in the rock as pirates climb from the shore. The camera tracks the running hounds along the ridge.')
v('cut_harpy_crags', 'lair_harpy_crags', 'Утёсы гарпий',
  'Sheer grey sea cliffs above crashing surf under racing clouds: winged harpies with long dark feathered wings and fierce '
  'faces shriek from nests on the ledges and launch into the wind, while albatrosses glide far off; a pirate longboat rows '
  'beneath the cliffs. The camera soars up the cliff face with the harpies.')
v('cut_banshee_hollow', 'lair_banshee_hollow', 'Лощина банши',
  'A hollow of dead grey trees in the heart of an island at night, mist lying between the twisted roots, pale moonlight: a '
  'translucent wailing banshee in a tattered pale gown drifts between the trunks with her long hair floating, her cry shaking '
  'the leaves, and pale ghost crabs scatter over the roots as pirates hold up their lanterns. The camera drifts slowly '
  'through the mist toward her.')
v('cut_titan_wreck', 'lair_titan_wreck', 'Титан обломков',
  'A reef at low tide covered with the broken hulls of a hundred old ships: from the wreckage a colossal figure rises, built '
  'of timbers, planks, masts and rusted anchors, water pouring off it, glowing green lantern-eyes in its head, while hermits in '
  'patched coats kneel on the rocks before it and a pirate longboat backs away. The camera tilts up the rising titan.')
v('cut_serpent_temple', 'lair_serpent_temple', 'Храм пернатого змея',
  'An ancient stepped stone temple swallowed by the jungle, vines over its carved steps, sunlight through the canopy: a huge '
  'feathered serpent with green and gold plumes uncoils from the top of the temple and spreads a crest of bright feathers, '
  'and two jaguars pace on the steps below as pirates step out of the trees. The camera rises slowly up the temple steps.')


def main() -> None:
    jobs = [{'name': f"video.{x['id']}", 'aspect': '16:9', 'prompt': x['prompt']} for x in V]
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(jobs), 'clips; longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
