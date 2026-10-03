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


def main() -> None:
    jobs = [{'name': f"video.{x['id']}", 'aspect': '16:9', 'prompt': x['prompt']} for x in V]
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(jobs), 'clips; longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
