// Isometric island city-builder art (owner 2026-10-14): one map + every island building as a sheet of 8 states.
// Sheet grid 4×2, landscape 3:2 (ChatGPT 1536×1024): 1 plot staked, 2 half-built in scaffolding, 3–7 levels 1–5,
// 8 upgrade in progress (level 3 in scaffolding). Flat magenta #FF00FF background for keying.
// Run: node assets/future/isle_iso/jobs.mjs <stem>  → prints the prompt.

const STYLE = 'Materials: near-black wet wood, tarred planks, dark basalt stone, rusted iron, salt-stained slate and wooden shingle roofs, tarnished old brass trim, barnacles and dark kelp on the low parts, wet ropes. A few windows glow with warm amber lantern light against cold blue moonlight from the top-left; wet reflective surfaces. Realistic painted style, rich detail, one consistent hand across all eight. Muted palette: charcoal, graphite, cold blue-grey, dirty silver, old brass, very dark burgundy; low saturation. Background: flat solid pure magenta #FF00FF everywhere between and around the buildings, no gradient, no ground beyond the footprint, no cast shadow on the background. NO people, NO text, NO letters, NO numbers, NO labels, NO watermark, NO frame. Avoid: cartoon, Clash of Clans look, bright colours, cel shading, thick outlines, glossy 3D render, steampunk, glowing runes, skulls, bones, blood.';

export const sheet = (name, what, n, lv) =>
  `Generate a new image now (no reference needed): Game asset sheet for a dark Pirate Gothic naval MMORPG island city-builder: the ${name} — ${what}. ` +
  `Eight versions of the SAME building in a strict grid of 4 columns and 2 rows, all in the same classic isometric city-builder projection (2:1 dimetric, camera about 30 degrees above the ground, every building facing the same front corner), each standing on an identical diamond footprint of ${n}×${n} ground tiles of bare dark packed earth, the same size and scale in every cell, centred in its cell with wide even gaps. ` +
  `Cells, left to right, top to bottom: 1) construction start: the cleared diamond plot with wooden stakes, string lines, a few squared foundation stones, a stack of timber and a barrel; 2) construction in progress: the half-built stone base and timber frame of the ${name.toLowerCase()} wrapped in rough wooden scaffolding with ropes, ladders and a small hoist; ` +
  `3) level 1: ${lv[0]}; 4) level 2: ${lv[1]}; 5) level 3: ${lv[2]}; 6) level 4: ${lv[3]}; 7) level 5: ${lv[4]}; 8) upgrade in progress: the level 3 building partly wrapped in wooden scaffolding with ropes and planks. ` +
  `Each level is clearly bigger, taller and richer than the one before but keeps exactly the same footprint. ${STYLE} Landscape 3:2.`;

export const MAP = (biome) =>
  `Generate a new image now (no reference needed): Game map background for a dark Pirate Gothic naval MMORPG — a captain's own island base, seen in classic isometric city-builder projection (2:1 dimetric, camera about 30 degrees above the ground, no perspective convergence). ` +
  `The island fills most of the frame. In its middle lies a large flat buildable plateau shaped as one wide diamond aligned to the isometric grid: ${biome.ground}, with a very faint subtle tile grid barely visible; the plateau is completely EMPTY — no buildings, no people, no props on it. ` +
  `Around the plateau: ${biome.rim}; a small old wooden pier on the front-left shore with two dim warm lanterns. The island lies in a near-black night sea with slow cold swells and a thin ring of pale foam at the shore, cold fog drifting over the water. ` +
  `Lighting: cold blue moonlight from the top-left, wet reflective surfaces, faint rain sheen. Realistic painted style, heavy, grounded, adult, Pirate Gothic. Muted palette: charcoal, graphite, cold blue-grey, ${biome.tint}, dirty silver, old brass; low saturation. Landscape 3:2. ` +
  `NO text, NO UI, NO border, NO watermark. Avoid: cartoon, Clash of Clans look, bright Caribbean colours, turquoise water, lush bright green, cel shading, thick outlines, steampunk, glowing runes, skulls, bones, blood.`;

export const MAPS = {
  map_temperate: { ground: 'packed dark earth, wet cobble patches, moss and trampled grey-green grass', rim: 'low black basalt cliffs, a wet black-sand beach, dark pines and a few dead twisted trees, the ruins of an old stone wall on the far rim, barnacled rocks', tint: 'moss grey-green' },
  map_volcanic: { ground: 'black volcanic ash ground, cracked basalt slabs and patches of grey pumice', rim: 'jagged black lava cliffs with faint dull-orange cracks, steam vents, charred dead trees, a black-sand beach', tint: 'ash grey, dull ember orange' },
  map_ice: { ground: 'frozen packed earth, grey snow patches and frosted flagstones', rim: 'grey ice-crusted cliffs, frozen black pines, ice floes in the water, snow on the rocks', tint: 'frost white-grey' },
  map_jungle: { ground: 'dark wet earth, moss and flattened dark ferns, puddles', rim: 'dense dark palms and mangrove roots, vines over old ruined stone steps, a muddy beach', tint: 'deep olive green' },
};

// [name, what it is, footprint in tiles, five levels] — the tree (docs/29) first, then the producers, then the base.
export const B = {
  hall: ['Town Hall', "the captain's seat that commands the whole island", 4, [
    "a squat stone-and-timber longhouse with a slate roof, a lantern over the door and a small captain's pennant",
    "a two-storey stone hall with a timber gallery, a bell turret and an old ship's figurehead over the door",
    'a fortified hall of dark stone with corner towers, a clock face of tarnished brass and iron-bound doors',
    "a grand gothic hall with two towers, dim amber stained-glass windows, a cannon at the steps and a huge ship's lantern",
    "a tall gothic citadel-hall of black basalt with three spires, a brass dome, a great anchor monument and a large captain's banner"]],
  keep: ['Keep', "the island's stronghold that strengthens every dwelling", 4, [
    'a square timber palisade fort with a single wooden watchtower',
    'a stone tower keep with a timber hoarding and a wooden gate',
    'a small citadel: stone curtain walls, two round towers, a gatehouse with a portcullis',
    'a strong citadel with four towers, battlements, cannons on the walls and a drawbridge over a dry ditch',
    'a dark castle of black basalt with a tall central donjon, four towers with conical slate roofs and heavy cannons']],
  market: ['Market', 'traders buy and sell the goods of the island', 3, [
    'two weathered canvas stalls with crates, barrels and a hand cart',
    'a timber market shed with several stalls under a shingle roof, sacks and scales',
    'a stone market hall with an open arcade, hanging lanterns and stacked goods',
    'a two-storey merchant exchange with a covered courtyard, a weighing crane and bales of cloth',
    'a grand gothic market hall with a brass-domed clock tower, arcades and a small warehouse wing']],
  guild: ['Guild of Orders', 'a guild where captains learn naval orders and tactics from old charts', 3, [
    'a small timber chart-hut with a round window and a brass telescope on a post',
    'a stone house with a library window, a weathervane and stacked sea chests',
    'a narrow gothic guildhouse with a tall arched window and a small observatory dome',
    'a guild tower of dark stone with an armillary sphere of tarnished brass on top',
    'a tall gothic guild spire with an observatory, a great brass astrolabe and lit lancet windows']],
  dw1: ["Deckhands' Bunkhouse", 'the dwelling where common deckhands are hired', 3, [
    'a rough timber shack made from old ship planks with a canvas awning and hammocks',
    'a long timber bunkhouse with a tarred roof and a washing line',
    'a two-storey timber bunkhouse on a stone base with an outside stair and lanterns',
    'a stone-and-timber lodging house with a galley chimney and a small yard of barrels',
    'a large gothic lodging house with dormer windows, a bell and an upturned boat hull as a porch roof']],
  dw2: ["Marines' Barracks", 'the dwelling where marines with muskets and sabres are hired', 3, [
    'a timber barracks hut with a weapon rack of muskets and a drum',
    'a long stone barracks with a small drill yard and a flagpole',
    'a two-storey stone barracks with arched windows, a guard box and racks of pikes',
    'a fortified barracks with a crenellated parapet, an armoury wing and stacked shot',
    'a grand gothic barracks hall with a gate tower, a bronze bell and a parade ground']],
  dw3: ['Shooting Range', 'the dwelling of musketeers and sharpshooters', 3, [
    'a fenced dirt range with straw targets and a small timber shed',
    'a covered timber firing line with targets and powder kegs behind a sandbag wall',
    'a stone range house with a long shooting gallery and iron targets',
    'a two-storey range with a marksman tower, racks of long muskets and a powder bunker',
    'a dark stone range fortress with a tall marksman tower, a brass spyglass and armoured galleries']],
  dw4: ['Gun Foundry', 'the dwelling of gunners where cannons are cast', 3, [
    'an open-air forge with an anvil, a small furnace and a cannon barrel cooling on trestles',
    'a timber foundry shed with a brick furnace chimney and moulds',
    'a stone foundry with two furnace chimneys, a casting pit and a crane holding a cannon',
    'a large foundry hall with tall smoking chimneys, rails and a row of finished cannons',
    'a huge dark foundry with three chimneys glowing dull orange, an iron crane and a great mortar on display']],
  dw5: ["Veterans' Den", 'a smoky tavern-den where hardened veteran boarders are hired', 3, [
    'a crooked timber shack with a hanging lantern sign and two barrels outside',
    'a two-storey timber tavern with a porch, rum barrels and a hanging anchor sign',
    'a stone-and-timber inn with a balcony, warm windows and a courtyard of crates',
    "a big gothic den with a tower room, a ship's bow built into the facade and a lantern-lit yard",
    "a sprawling dark gothic den with towers, a captured ship's stern as a wing and many warm windows"]],
  dw6: ['Admiralty', 'the dwelling where officers and elite naval troops are hired', 3, [
    'a modest stone office with a flagpole and a naval bell',
    'a stately two-storey stone house with columns and a signal mast',
    'a gothic admiralty building with a clock, a semaphore tower and brass cannons at the door',
    'a large admiralty palace with wings, a dome and a ship model in a glass bay window',
    'a grand admiralty of black stone with a tall signal tower, a dome of old brass and naval banners']],
  dw7: ['Drowned Shrine', 'a cursed sea shrine where the drowned are called up from the deep', 3, [
    'a ring of barnacle-covered standing stones around a tide pool with a dim turquoise glow',
    'a small stone shrine overgrown with kelp and shells, dripping water, a faint turquoise glow',
    'a half-sunken gothic chapel of coral-crusted stone with a dim turquoise rose window',
    'a tall drowned temple with coral spires, pearl inlays and thin turquoise veins in the stone',
    'a great cathedral of coral and black stone rising from a dark pool, branching dim turquoise bioluminescent veins (under 8% of the image)']],
  warehouse: ['Warehouse', 'the store for timber, coal, iron, tar and other goods', 3, [
    'an open timber shed with a few crates, sacks and barrels under canvas',
    'a closed timber storehouse with a loading door and a hoist beam',
    'a stone warehouse with two loading doors, a crane and stacked crates',
    'a large stone warehouse with a gabled roof, two cranes and full yards',
    'a huge gothic warehouse with iron-bound gates, a tall crane tower and mountains of barrels and bales']],
  shipyard: ['Shipyard', 'the yard where the captain builds and repairs ships, at the shore', 3, [
    'a timber slipway on the shore with a small boat hull on trestles',
    'a timber slipway with a half-built sloop in ribs, a crane and stacked planks',
    'a covered slipway shed with a brig hull inside, a saw pit and a capstan',
    'a big stone shipyard with two slipways, a tall timber crane and a frigate hull',
    'a grand covered dock hall of dark stone and timber with a warship hull, great cranes and brass lanterns']],
  battery: ['Coastal Battery', 'a gun battery that defends the island from the sea', 2, [
    'a low earth bank with gabions and one old cannon',
    'a timber-reinforced emplacement with two cannons and a powder box',
    'a stone battery with three cannons behind embrasures and a shot pile',
    'a heavy stone battery with four long guns, a mortar and an ammunition bunker',
    'a massive black-stone battery with great iron guns on turntables and a small lantern watchtower']],
  fort: ['Fort', 'a sea fort with heavy guns that guards the island', 4, [
    'a star-shaped earthwork with a timber palisade and a few guns',
    'a low stone redoubt with cannons and a wooden watchtower',
    'a stone bastion fort with two bastions, a gate and a flag',
    'a star fort with four bastions, a central keep and many cannons',
    'a massive black-stone star fortress with tall bastions, a central round tower and heavy mortars']],
  lumber: ['Logging Camp', "fells the island's trees for timber", 3, [
    'a few felled logs, a sawhorse and an axe stump among dark pines',
    'a timber camp with a log pile, a pit saw and a small hut',
    'a camp with a log slide, a hut and stacked squared timber',
    'a large camp with a water-driven saw shed and big log stacks',
    'a big lumber yard with a sawmill wheel house, a crane and mountains of squared timber']],
  quarry: ['Quarry', "breaks the island's rock for stone and coal", 3, [
    'a small rock face with picks, a wheelbarrow and a few cut blocks',
    'a stepped quarry pit with a wooden ramp and a coal heap',
    'a deeper quarry with a timber crane, rails and stacked blocks',
    'a large quarry with a treadwheel crane, carts and a coal shed',
    'a vast stepped quarry with two cranes, mine carts on rails and a stone office']],
  tar: ['Tar Kiln', "boils pine tar from the island's wood", 3, [
    'a small smoking earth-mound kiln with a few barrels',
    'a brick kiln with a chimney and rows of tar barrels',
    'a kiln house with two kilns, a cauldron and a drying shed',
    'a large tar works with three smoking kilns and a barrel store',
    'a big dark tar works with tall chimneys, copper cauldrons and pyramids of tar barrels']],
  mine: ['Iron Mine', 'digs iron ore from the rock', 3, [
    'a timber-framed adit entrance in a rock face with a cart',
    'a mine entrance with a head frame, rails and an ore heap',
    'a stone mine house with a winding wheel and ore carts',
    'a large mine with a tall timber headframe, a smelter chimney and ore bins',
    'a deep mine complex with an iron headframe, a smelter and glowing furnace windows']],
  fishery: ['Fishing Crew', 'nets and smokes the catch for provisions, at the shore', 3, [
    'a beached rowing boat, nets on poles and a fish basket',
    'a fishing hut with drying racks of fish and nets',
    'a timber fishing station with a small jetty, a smokehouse and boats',
    'a larger fishery with a jetty, two smokehouses and barrels of salted fish',
    'a big fishing yard with a long jetty, smoking sheds, cranes and many boats']],
  pier: ['Pier', 'a jetty where boats moor at the island', 3, [
    'a short plank jetty on wooden piles with a bollard',
    'a longer jetty with a lantern post and coiled ropes',
    'an L-shaped pier with a small crane and crates',
    'a stone-footed pier with two berths, cranes and a harbour lantern',
    'a big stone-and-timber quay with a warehouse hut, a crane and tall harbour lanterns']],
  tavern: ['Tavern', 'a tavern where sailors drink and crew is hired', 3, [
    'a timber shack with a bench, barrels and a hanging lantern sign',
    'a two-storey timber tavern with a porch and a sign of a mug',
    'a stone tavern with a balcony and warm windows',
    'a large gothic tavern with a tower and a yard of barrels',
    "a grand old inn with a ship's bow facade, many warm windows and a lantern-lit yard"]],
  farm: ['Farm', 'grows food for the island', 3, [
    'a small field patch with a scarecrow and a fence',
    'a farmhouse with a vegetable field and a well',
    'a farmstead with a barn, a field and a goat pen',
    'a big farm with a barn, a windmill and fields',
    'a large estate farm with a stone barn, a tall windmill and a granary']],
  fishing_village: ['Fishing Village', 'a hamlet of fisher families by the shore', 3, [
    'one fisher hut and a beached boat',
    'two huts with nets and drying racks',
    'a cluster of huts with a jetty',
    'a village of stone-footed houses, a chapel bell and boats',
    'a large fishing village with a market jetty and many warm windows']],
  residents_house: ["Residents' House", "a house for the island's residents", 2, [
    'a small timber cottage',
    'a two-storey timber house',
    'a stone-and-timber townhouse',
    'a large gothic townhouse with dormers',
    'a tall gothic mansion with a turret']],
  workshop: ['Workshop', 'craftsmen make tools and ship fittings', 3, [
    'a lean-to with a workbench and tools',
    'a timber workshop with a chimney',
    'a stone workshop with a lathe wheel and crates',
    'a two-storey workshop with a crane and a forge chimney',
    'a large guild workshop with a water wheel and several chimneys']],
  sawmill: ['Sawmill', 'saws logs into planks', 3, [
    'a sawpit with a log and a sawhorse',
    'a timber shed with a hand-driven saw',
    'a mill with a water wheel and plank stacks',
    'a large mill with two wheels and a log yard',
    'a big sawmill with a tall wheel house, a crane and mountains of planks']],
  smokehouse: ['Smokehouse', 'smokes fish and meat into provisions', 2, [
    'a small smoking hut with fish racks',
    'a timber smokehouse with a chimney',
    'a stone smokehouse with two chimneys',
    'a large smokehouse with hanging fish and barrels',
    'a big smokehouse complex with three chimneys and a store']],
  chapel: ['Chapel', "a small sailors' chapel that lifts the crew's morale", 3, [
    'a wayside shrine with a bell on a post',
    'a timber chapel with a small bell tower',
    'a stone chapel with a pointed arch window',
    'a gothic chapel with a spire and a small yard of rusted anchors',
    'a dark gothic church with a tall spire, a rose window and a bronze bell']],
  lighthouse: ['Lighthouse', 'guides ships to the island, on the shore', 2, [
    'a timber beacon pole with a brazier',
    'a short stone tower with a lantern',
    "a tall stone lighthouse with a keeper's cottage",
    'a tall banded lighthouse with a brass lantern room',
    "a huge gothic lighthouse with a great brass lantern room and a keeper's house"]],
  caravan_office: ['Caravan Office', 'sends trade boats between islands', 3, [
    'a tent with a ledger table and crates',
    'a timber office with a sign post and bales',
    'a stone office with a stable for mules and carts',
    'a large trading house with a courtyard of carts',
    'a grand trading house with a clock tower and a yard full of goods']],
  signal_tower: ['Signal Tower', 'signals ships with flags and fire', 2, [
    'a timber pole with signal flags',
    'a timber tower with a flag yard',
    'a stone tower with a fire basket',
    'a tall stone tower with a semaphore arm',
    'a tall gothic signal tower with a semaphore, a brass lantern and flags']],
  forge: ['Forge', 'smiths forge iron fittings, anchors and weapons', 3, [
    'an anvil and a small open hearth under a lean-to',
    'a timber smithy with a stone chimney',
    'a stone forge with two hearths and an anchor on display',
    'a large forge with a water-powered hammer',
    'a great forge hall with tall chimneys glowing dull orange and a giant anchor']],
  distillery: ['Distillery', 'distils rum from sugar', 3, [
    'a still on a fire under a lean-to with barrels',
    'a timber distillery with a copper still and barrels',
    'a stone distillery with two copper stills',
    'a large distillery with a barrel cellar and a chimney',
    'a grand distillery with tall copper stills, a warehouse and barrel pyramids']],
  chart_house: ['Chart House', 'cartographers draw sea charts', 2, [
    'a small hut with a telescope',
    'a timber chart house with a round window',
    'a stone chart house with a little dome',
    'a tower with an observatory dome',
    'a gothic observatory with a big brass telescope']],
  trophy_hall: ['Trophy Hall', "shows the captain's trophies from the sea", 3, [
    "a timber shed with a ship's figurehead outside",
    'a timber hall with an anchor and a cannon at the door',
    'a stone hall with a carved wooden sea-serpent arch over the door',
    'a gothic hall with crossed broken masts and captured banners',
    'a grand trophy hall with a huge carved kraken figure, figureheads and banners']],
  barracks: ['Barracks', "lodging for the island's guard", 3, [
    'a guard tent and a weapon rack',
    'a timber barracks hut',
    'a stone barracks with a yard',
    'a fortified barracks with a parapet',
    'a large gothic barracks with a gate tower']],
  try_works: ['Try-works', 'renders whale blubber into oil', 3, [
    'a brick hearth with an iron pot',
    'a try-works with two pots and barrels',
    'a shed over three pots with a chimney',
    'a large try-works with a crane and an oil store',
    'a big rendering works with tall chimneys and barrel pyramids']],
  hidden_cove: ['Hidden Cove', 'a secret mooring for smugglers, at the shore', 3, [
    'a rope ladder and a hidden boat under a rock',
    'a cave mouth with a small jetty',
    'a cave with a timber jetty and crates',
    'a big sea cave with a jetty, a crane and lanterns',
    'a large hidden harbour cave with two jetties, a crane and a sloop']],
  smuggler_store: ["Smugglers' Store", 'a secret store for contraband', 2, [
    'a trapdoor in the ground with crates',
    'a shed half-dug into the ground',
    'a stone cellar store with a hidden door',
    'a large cellar store with a crane',
    'a fortified underground vault entrance with iron doors']],
  plantation: ['Plantation', 'grows sugar cane', 3, [
    'a small cane patch with a hut',
    'cane fields with a drying shed',
    'fields with a press house',
    'big fields with a mill and a boiling house',
    'a large plantation with a manor, a mill and a boiling house']],
  powder_mill: ['Powder Mill', 'grinds gunpowder', 3, [
    'a mortar and pestle under a shed with kegs',
    'a timber mill with a small wheel',
    'a stone mill with blast walls and kegs',
    'a large mill with two wheels and a powder magazine',
    'a great powder works with blast walls, wheels and a domed magazine']],
  dry_dock: ['Dry Dock', 'a stone dock where ships are hauled out for repair, at the shore', 4, [
    'a muddy slip with timber props',
    'a timber-lined dock pit with gates',
    'a stone dock with gates and a pump house',
    'a large stone dock with a crane and a ship inside',
    'a huge dry dock with great gates, cranes and a warship on keel blocks']],
};

export const ORDER = [...Object.keys(MAPS), ...Object.keys(B)];

const stem = process.argv[2];
if (stem) console.log(MAPS[stem] ? MAP(MAPS[stem]) : sheet(...B[stem]));
