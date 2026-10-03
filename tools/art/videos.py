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
  'Rain begins to fall. The camera moves slowly around the circle of angry faces.')
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


def main() -> None:
    jobs = [{'name': f"video.{x['id']}", 'aspect': '16:9', 'prompt': x['prompt']} for x in V]
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(jobs), 'clips; longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
