# GRAVETIDE — чего не хватает в арте (аудит 2026-10-24) + промпты для ChatGPT

Read-only audit of `main` @ c90ffe4f (the commit that added a parcel and a letter to every harbour's board). Method: every art table and
stand-in map in the code was checked against `assets/manifest.json` (3531 ids). The world (seed `WORLD_SEED`) and the
campaign were built once in node to count the ports.

## 0. Что уже закрыто (больше не заглушки)

These are drawn with their own pictures now. No stand-in from these maps is used any more:

- **Figures:** all 271 kinds in `UNITS` have `unit.<id>` and all three poses (`_b`, `_atk`, `_hit`). No attack or hit frames are missing.
  `FIGURES` (unitart.ts), `BOSS_UNIT_STAND_IN` and `TITAN_STAND_IN` are all painted.
- **Ships:** every `SHIP_CLASSES` sprite and every deck `bg.deck_*` of a purchasable hull is painted. Every key of `FLEET_STAND_IN` is in the manifest.
- **Icons:** `ICON_STAND_IN` (item sheets 5–7 and the arms sheets) is fully painted. So are the icon stand-ins in dom.ts (goods, doubloon, tattoo needle),
  all 30 tattoos, 4 pets, 3 harnesses, 7 boarding orders, 37 goods, 15 fish, 28 buildings with their 3 stages, and 10 omens.
- **Portraits:** all 18 entries of `PORTRAIT_STAND_IN` (residents, Old Needle, the skipper) and all 24 pirate faces are painted.
- **Cards:** all 40 encounter cards `card.enc_*`, 4 holidays and 5 legendary cards are painted. The `ENC_ART` borrow map no longer fires.
- **Other:** all 7 sea-boss sprites `monster.*` are painted. So are the island buildings in isometry (36 sheets × 8 stages), the 4 iso maps, the 3 waystations on the sea (`prop.way_*`),
  the plates, frames, emblems and emotes, and the bundles' icons.
- **HUD:** every icon id in the client code is in the manifest. Nothing on the HUD is a stand-in.

What is left is mostly **scenes, not icons**: ports, story cards, window headers and the shared "kindred" pictures listed below.

## 1. Порты — главная дыра

| | count | own harbour (`bg.port_<id>`) | own town on the chart (`prop.port_<id>`) |
|---|---|---|---|
| all harbours in the world | **318** | 20 | 20 |
| — key ports (capitals of the old map) | 10 | **0** | **0** |
| — 20 new named ports (ports.py) | 20 | 20 | 20 |
| — villages `<sea>_v<n>` | 35 | 0 | 0 |
| — floating towns `raft_<n>` | 13 | 0 | (drawn from hulls) |
| — step-9 towns `<sea>_t<n>` | 240 | 0 | 0 |
| ports the campaign uses (in quests and stops) | **60** (50 of them are stops, with 38 free passages) | 10 | 10 |

**What the player sees now:**
- The harbour window header (`client/src/ui/port.ts:252`, CSS `window.css:186`, `center / cover`, left side darkened) tries `bg.port_<id>` first.
  If that is missing it falls back to `bg.port_<faction>`, so **298 harbours show one of 7 faction pictures**.
  This includes **Saltmarrow, the start town**. It is the 1st, 2nd and 36th chapter (31 quests) and uses the Crown picture `bg.port_crown`.
  133 "free" ports (ice, swamp, ash, drowned ruins) share one picture, `bg.port_free`.
- The town on the chart (`renderer.ts townArt`) falls back the same way: `prop.port_<id>`, then `prop.port_<faction>`, then `prop.port_town`.
- The arrival film `cut_port_<id>` falls back to `cut_port_<faction>`. The 10 key ports have none of their own.
- The world chart uses the faction crest `icon.faction_*` for every port. That is acceptable.

**Courier and letter jobs (since c90ffe4f).** The pair on the board now goes to the nearest place within a leg: another harbour,
a hamlet within 1.5 km of the quay, a fishers' cove on her own island, or a waystation. Hamlets are drawn from `prop.life_*`
and coves from the decor. The goods are handed over "at the spot" with a toast only, so **there is no scene picture**. Saltmarrow's board has these jobs too, so this matters in the first hour.

**Campaign ports with no art of their own (50 of 60).** Columns: first quest | id | name | flag/sea/biome | number of quests:

```
c01 saltmarrow        Saltmarrow        crown/black_coast/temperate   31  (ch 1,2,36)  ← START, P1
c02 black_coast_t24   Shell Sound       crown/black_coast/temperate   14               P1
c02 gravesend         Port Gravesend    crown/black_coast/temperate    6  (hub ch2)    P1
c03 black_coast_t0    Driftwood Reach   league/black_coast/saltflat   12               P1
c03 gravewater_t22    Kelp Pier         league/gravewater/temperate   12               P1
c04 whispering_t32    Raven Stockade    brokers/whispering/mossy       7               P1
c04 whispering_t62    Brine Sound       brokers/whispering/mossy      12               P1
c05 whispering_t7     Fog Sound         free/whispering/mossy         16
c06 gravewater_t17    Gale Creek        free/gravewater/temperate      9
c06 hollowmere        Hollowmere        league/gravewater (hub ch6)    4
c07 gravewater_t20    Tallow Roads      free/gravewater/temperate      7
c07 whispering_v3     Hushreed Key      brokers/whispering/mossy       6
c07 whispering_t71    Sail Wharf        brokers/whispering/mossy       6
c08 whispering_t13    Mermaid Cove      brokers/whispering/fungal      6
c08 whispering_t70    Widows Cove       brokers/whispering/mossy       7
c08 whispering_t45    Mermaid Pier      brokers/whispering/mossy      10
c09 dead_mans_expanse_t9  Moon Haven    free/dead_mans/saltflat       12
c09 dead_mans_expanse_v3  Lastisle      free/dead_mans/atoll           1
c09 wrecktide         Wrecktide         free/dead_mans (hub ch9)       4
c11 whispering_t79    Moon Quarter      free/whispering/fungal        12
c11 whispering_t23    Brine Rest        brokers/whispering/mossy       5
c11 whispering_t51    Mermaid Quarter   free/whispering/mangrove       9
c12 leviathan_reach_t10 Seal Wharf      harpoon/leviathan/barren      11
c12 harpoon_rest      Harpoon's Rest    harpoon/leviathan (hub ch12)   6
c13 leviathan_reach_t21 Rope Tavern     harpoon/leviathan/ice          6
c13 dead_mans_expanse_t10 Gale Haven    confederacy/dead_mans/saltflat 17
c13 dead_mans_expanse_t5  Coal Reach    free/dead_mans/barren          7
c14 leviathan_reach_t14 Herring Reach   harpoon/leviathan/barren      22
c15 leviathan_reach_t15 Gull Tavern     free/leviathan/ice            11
c16 dead_mans_expanse_t1  Cod Bay       confederacy/dead_mans/atoll   17
c16 dead_mans_expanse_t7  Coal Pier     confederacy/dead_mans/atoll    9
c17 whispering_t35    Shell Backwater   brokers/whispering/mossy      18
c17 whispering_t59    Lucky Pier        brokers/whispering/mangrove    7
c18 whispering_t3     Tallow Point      free/whispering/mangrove      22
c19 ashen_isles_t13   Old Moorings      confederacy/ashen/volcanic    20
c20 ashen_isles_t6    Rum Roads         free/ashen/volcanic           10
c22 ashen_isles_t3    Coal Watch        free/ashen/volcanic           16
c23 drowned_crown_t31 Last Cove         free/drowned/ruins            16
c23 saint_maw         Saint Maw         choir/drowned (hub ch24,26)   14
c24 drowned_crown_t11 Sunken Roads      choir/drowned/fungal          21
c25 drowned_crown_t8  Gold Reach        choir/drowned/crystal         17
c26 drowned_crown_t2  Sail Roads        free/drowned/ruins            17
c27 ashen_isles_t17   Copper Backwater  confederacy/ashen/volcanic    22
c28 drowned_crown_t22 Pearl Tavern      choir/drowned/crystal         19
c29 drowned_crown_t9  Last Moorings     choir/drowned/mangrove        18
c30 drowned_crown_t6  Sail Landing      free/drowned/ruins            15
c33 drowned_crown_t13 Lucky Reach       free/drowned/ruins            10
c34 drowned_crown_t19 Salt Pier         choir/drowned/ruins            9
c35 drowned_crown_t28 Black Watch       choir/drowned/ruins           14
c36 drowned_crown_t0  Cod Landing       choir/drowned/ruins           14
```
Chapter hubs that are not campaign stops but are capitals: **fogmouth** (ch8), **cinderhold** (ch19), **blackwater** and **tidewrack** (ch4 hub).
They are added to the list below.

The other ~250 harbours: no picture of their own is planned. Instead there is a set of **generic harbours by sea × flag**
(15 groups, list in §3). An id can be registered in the manifest to point at a shared file, so a generic picture can be assigned to each port with no code change. Alternatively, add one fallback step in port.ts: `bg.port_<region>_<faction>`.

## 2. Сводка недостающего по приоритетам

**P1 = 26 pictures, P2 = 174, P3 = 42 (+12 videos, not for ChatGPT). Total 242 pictures in 56 prompt sheets.**

### P1 — seen by every player in the first hour and the first chapters

| # | what | count | where it shows | what it uses now |
|---|---|---|---|---|
| 1 | Saltmarrow harbour (`bg.port_saltmarrow`) | 1 | start port's window, ch1–2 and 36, 31 quests | Crown's `bg.port_crown` |
| 2 | Saltmarrow town on the chart (`prop.port_saltmarrow`) | 1 | the first screen at sea | Crown's `prop.port_crown` |
| 3 | Port Gravesend harbour + town | 2 | ch2 hub, capital of the start sea | Crown's |
| 4 | Porto Blackwater and Tidewrack harbour + town | 4 | the start sea's second port, ch4 hub | League's / Free's |
| 5 | ch1–4 towns: Shell Sound, Driftwood Reach, Kelp Pier, Raven Stockade, Brine Sound (harbour) | 5 | ch2–5 quests (7–14 each) | faction's |
| 6 | generic Black Coast villages: Crown ×2, League ×2 | 4 | the other ~40 harbours of the start sea | `bg.port_crown` / `bg.port_league` |
| 7 | delivery scenes for the board's parcel and letter: hamlet, fishers' cove, waystation | 3 | every harbour's board now, Saltmarrow included | toast only, no picture (**needs a hook**) |
| 8 | prologue and epilogue lore cards | 2 | the card before the first story quest, the campaign's end | text only (**needs a hook**) |
| 9 | chapter openers ch1–4 | 4 | a chapter's first quest | none (**needs a hook**) |

### P2 — seen often

| # | what | count | what it uses now |
|---|---|---|---|
| 1 | harbours of the remaining campaign ports (39 towns + Hollowmere, Wrecktide, Harpoon's Rest, Saint Maw, Fogmouth, Cinderhold) | 45 | faction's |
| 2 | chart towns of those 6 key ports | 6 | faction's |
| 3 | floating towns `raft_0..12`: harbour, 2 variants | 2 | `bg.port_free` |
| 4 | generic harbours by sea × flag (the other 12 groups) | 12 | 7 faction pictures |
| 5 | chapter openers ch5–36 | 32 | none (**hook**) |
| 6 | world-boss painting on the boss bar (`card.<kind>`, `hud.ts:933`): old_moorings, old_tithe, fog_changeling, cinder_ray, drowned_prelate, rime_twins | 6 | empty band |
| 7 | island mini-games (`MINIGAMES[].art`): all 20 borrow encounter cards | 20 | `card.enc_*` |
| 8 | island trek header (`trek.ts:69`): all 15 events show one card | 2 | `card.enc_signal_fire` |
| 9 | waystation window header: tavern, chapel, market | 3 | island building icons (**hook**) |
| 10 | artifacts: all 40 show the plain item's icon (`icon: item_*`) | 40 | base item icon (kindred) |
| 11 | relic icons (crown_of_the_deep, storm_orb, boarding_union, throne_compass) | 4 | none |
| 12 | iso maps for the biomes that borrow another map: dry (saltflat/barren) and drowned ruins (ruins/bone/crystal) | 2 | `isle.map.volcanic` (**hook**: `ISO_MAP_OF` + `ISO_CORNERS`) |

### P3 — rare

| # | what | count | what it uses now |
|---|---|---|---|
| 1 | Abyss and Throne window headers: Maelstrom Stair (descent), Abyss raid, Throne of the Sea, citadel | 4 | icons only |
| 2 | chart props: citadel's own fort, lookout cairn, castaways on a spar, the pen on the island | 4 | `prop.life_fort` / hand-drawn / icon |
| 3 | small icons: port marker by size (capital, town, village, floating town), level gifts lv10–60 (now all `tattoo_star`), trails ×6 (now all `cos_trails`) | 16 | shared icon |
| 4 | flag cloths ×10 in the shop (now all `cos_flags`) | 10 | shared icon |
| 5 | zone-boss banner cards ×8 (warning, target): Iron Lion, Gilded Leviathan, Fog Mother, White Harrow, Cinder Throne, Stitched Hulk, Drowned Regent, Abyssal Ark | 8 | sprite only (**hook**) |
| 6 | lair films `cut_frog_pools, rat_wreck, iguana_rocks, ghost_strand, centipede_ravine, spider_grove, bull_savanna, cinder_slopes, harpy_crags, banshee_hollow, titan_wreck, serpent_temple` | 12 videos | `NOT_FILMED` in videos.py; the prompts are in videos.py (Higgsfield, not ChatGPT) |

### Топ-10

1. `bg.port_saltmarrow`: the start harbour (Crown's picture now)
2. `prop.port_saltmarrow`: the start town on the chart
3. delivery scenes for the board's parcel and letter (hamlet, cove, waystation)
4. `bg.port_gravesend` + `prop.port_gravesend`
5. prologue lore card
6. generic Black Coast villages (Crown, League): about 40 harbours of the start sea
7. ch2–5 towns: Shell Sound, Driftwood Reach, Kelp Pier, Raven Stockade, Brine Sound
8. Blackwater and Tidewrack (harbour + town)
9. chapter openers 1–4
10. world-boss bar paintings (6), then the remaining 45 campaign harbours

## 3. Как подключать (для того, кто будет резать)

- **Harbour** `bg.port_<id>`: wide picture. The game picks it up with no code change (port.ts:252). Existing ones are 1672×941. Cut from a 2×2 sheet,
  a cell is 768×512, enough for the header band. Keep the main buildings in the middle and right half, because the left third is darkened under the title.
- **Town on the chart** `prop.port_<id>`: a square sprite, keyed (`process.py` keyed mode, key `#00ff00`). **After cutting, run `tools/art/quay_piers.py`** to add
  `QUAY_PIERS` in `shared/src/data/quays.ts`. If you skip it, collisions use the faction's piers (solids.ts:206) while the picture shows other piers.
- **Generic harbours by sea × flag:** in the manifest, point the `bg.port_<id>` of every port in the group at one file.
  Groups (no art of their own; number of ports): black_coast/crown 24, black_coast/league 16, gravewater/league 17, gravewater/free 16, whispering/brokers 47,
  whispering/free 44, ashen_isles/confederacy 16, ashen_isles/free 15, leviathan_reach/harpoon 23, leviathan_reach/free 16, dead_mans_expanse/free 15,
  dead_mans_expanse/confederacy 8, drowned_crown/choir 20, drowned_crown/free 20 (+ black_coast/free 1).
- **Needs code (a hook) before a picture shows:** lore cards (`card.lore_prologue/epilogue` in `campaignnews.ts loreCard`), chapter openers
  (`card.ch_01..36`), delivery scenes (`card.drop_hamlet/cove/waystation`), waystation header (`bg.way_<kind>`), trek header (`card.trek_lush/stark`
  instead of enc_signal_fire), artifacts (`icon.art_<id>` instead of `icon: item_*` in artifacts.ts), relics (`icon.relic_<id>`), Abyss/Throne headers,
  zone-boss cards, iso maps (+ corners), cosmetics tiles (premium.ts `famArt` reads the family icon).
- **Boss bar** `card.<kind>`: works with no code change. Existing ones are 960×411.
- **Mini-games:** change `art:` in minigames.ts to `card.mg_<id>`.

---

## 4. Промпты (вставлять в ChatGPT как есть)

Save the results under `C:\Users\enosi\Downloads\gravetide_art\` in the folders named below.
"Cell order" means left to right, top row first.

### P1

#### Порт Солтмарроу — гавань (стартовый город)
File: `C:\Users\enosi\Downloads\gravetide_art\ports_p1\bg_port_saltmarrow.png` (1774×887)
```
Generate a new image now (no reference needed). A single wide 2:1 painted game background, full-bleed, no grid: the harbour of Saltmarrow, a small grey fishing town at the end of the world, seen at night from the water from the deck of an arriving ship. A rocky temperate headland; grey stone cottages with wet slate roofs crowd around a crooked little harbour; fishing nets dry on poles; small fishing boats are drawn up on the shingle; a squat old stone bell tower stands above the roofs; a modest wooden quay with two moored fishing ketches and one small sloop; a little blue and gold pennant on a pole. Far out on black rocks to the right a single false light burns. The main buildings sit in the middle and the right half of the picture; the left third is calmer and darker. The lower third is calm dark water with nothing in it, reflecting a few warm lanterns. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight through thin cloud, low sea fog; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights and small warm amber lantern accents. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no frames, no borders, no watermark. Avoid cartoon, anime, bright turquoise water, clean new ships.
```

#### Порт Грейвсенд — гавань (столица Короны, глава 2)
File: `...\ports_p1\bg_port_gravesend.png` (1774×887)
```
Generate a new image now (no reference needed). A single wide 2:1 painted game background, full-bleed, no grid: the harbour of Port Gravesend, the grey stone capital of the Crown, seen at night from the water from the deck of an arriving ship. Tiers of wet slate roofs climb a hill to a great cathedral with many bell towers; an admiralty palace with tall windows; massive grey stone quays; two stone dry docks; a star-shaped bastion on the point with cannon; three tall warships at anchor flying plain blue and gold ensigns with no emblems; many small lanterns along the quays. The main buildings fill the middle and the right half; the left third is calmer and darker. The lower third is calm black water with nothing in it. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight through thin cloud, drizzle and low sea fog; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights and small warm amber lantern accents. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no frames, no borders, no watermark.
```

#### Порто Блэкуотер и Тайдрэк — гавани
File: `...\ports_p1\bg_port_blackwater_tidewrack.png` (1536×1024). Cut into `bg.port_blackwater` (top) and `bg.port_tidewrack` (bottom).
```
Generate a new image now (no reference needed). A wide 3:2 image split into a strict grid of 2 rows by 1 column: two equal wide panels stacked, separated by a thin pure black gutter, each a painted game background of a harbour seen at night from the water from the deck of an arriving ship, the lower third of each panel calm dark water with nothing in it, the main buildings in the middle and right half. Panel 1 (top): Porto Blackwater, a League sugar-and-rum port in the rain: brick distilleries with steaming copper chimneys, long warehouses with verdigris-green copper roofs, barrels stacked on a stone quay, wooden cargo cranes, a merchant fluyt and a barque moored, black and gold pennants. Panel 2 (bottom): Tidewrack, a free port of auctions: a crowded jumble of timber houses and taverns on piles, a big auction hall with lanterns hung under its eaves, patched sails stretched as awnings, mismatched flags, a dozen small ships of every kind moored any old way. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight, rain and low fog; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights and warm amber lanterns. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no borders inside the panels, no watermark.
```

#### Города на карте: Солтмарроу, Грейвсенд, Блэкуотер, Тайдрэк (спрайты)
File: `...\ports_p1\prop_ports_key_1.png` (1254×1254). Cells in order: `prop.port_saltmarrow`, `prop.port_gravesend`, `prop.port_blackwater`, `prop.port_tidewrack`.
```
Generate a new image now (no reference needed). A square image: a game sprite sheet of four port towns for an adventure map, in a strict grid of 2 rows by 2 columns, each town alone in its own quarter with wide empty gaps so nothing touches, on a solid flat chroma green #00FF00 background (no sea, no shadows on the background, no green anywhere in the towns themselves). Each town is seen in a strict top-down orthographic view, the camera pointing straight down at 90 degrees like a satellite photo or a map plan: only roofs, courtyards, streets and the tops of walls are visible, no front faces or side walls of buildings, no perspective, no horizon, no tilt; streets, walls and quays run square to the edges (not rotated, not isometric); the town compact on its own patch of shore filling most of its quarter, three or four piers and jetties reaching straight down toward the bottom of its quarter. 1 (top left): Saltmarrow, a small grey fishing town: stone cottages with slate roofs, net poles, boats drawn up on shingle, a squat bell tower, one wooden quay. 2 (top right): Port Gravesend, a large grey stone naval capital: a cathedral with several bell towers, an admiralty palace, two dry docks, a star-shaped bastion on one corner, long stone quays. 3 (bottom left): Porto Blackwater, a League sugar-and-rum town: brick distilleries with copper chimneys, long warehouses with green copper roofs, barrels on the quay, cranes. 4 (bottom right): Tidewrack, a crowded free port: timber houses and taverns on piles, a big auction hall, patched sail awnings, rickety jetties. Style: smooth painterly digital painting with the painterly finish of Heroes of Might and Magic III but drawn strictly as a top-down map plan seen from directly overhead, grim and weathered; night, warm lantern light in windows and cold moonlight on wet roofs; muted charcoal, slate, tarred black wood, rust, old brass, cold blue-grey with small warm highlights. No text, no letters, no numbers, no labels, no frames, no skulls, no bones, no blood.
```

#### Ранние города глав 2–5 — гавани (лист 1)
File: `...\ports_p1\bg_ports_early_1.png` (1536×1024). Cells: `black_coast_t24` Shell Sound, `black_coast_t0` Driftwood Reach, `gravewater_t22` Kelp Pier, `whispering_t32` Raven Stockade.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a painted game background of a small harbour seen at night from the water from the deck of an arriving ship; in every panel the lower third is calm dark water with nothing in it and the buildings sit in the middle and right of the panel. 1: Shell Sound, a small Crown fishing and salt village in a sheltered sound: grey stone cottages with slate roofs, salt-boiling sheds with smoke, heaps of pale shells along the strand, a short stone pier with a blue and gold pennant, wet green hills behind. 2: Driftwood Reach, a low League trading post on white salt flats: driftwood-timber warehouses with green copper roofs, a long plank jetty over shallow pale water, one wooden crane, black and gold pennants, shimmering salt pans under the moon. 3: Kelp Pier, a League rum and timber landing: a long pier with racks of drying kelp, a small brick distillery with a steaming copper chimney, stacks of logs, dark pine hills in rain. 4: Raven Stockade, a timber stockade town on stilts in mossy fog woods: a palisade of dark posts with ravens on it, shuttered lanterns, firs hung with moss, plank walkways over black water. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight, low fog; palette of deep sea teal, navy, charcoal and slate with old brass highlights and warm amber lanterns. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

#### Брайн-Саунд + деревни Чёрного берега (типовые)
File: `...\ports_p1\bg_ports_early_2.png` (1536×1024). Cells: `whispering_t62` Brine Sound, `bg.port_gen_black_coast_crown_a`, `bg.port_gen_black_coast_crown_b`, `bg.port_gen_black_coast_league_a`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a painted game background of a small harbour seen at night from the water from the deck of an arriving ship; in every panel the lower third is calm dark water with nothing in it and the buildings sit in the middle and right. 1: Brine Sound, houseboats and stilt houses crowded in a narrow foggy sound, moss on every roof, racks of smoked fish, shuttered lanterns glowing faintly. 2: a Crown fishing village on a temperate rocky coast: a dozen grey stone cottages with slate roofs, a small chapel with a bell, a stone pier, a blue and gold pennant, green hills. 3: a Crown coastal hamlet under a cliff: a small stone watch-house with a cannon, whitewashed cottages, a slipway with a half-built boat, a lantern on a post at the end of a jetty. 4: a League trading village: two brick warehouses with green copper roofs, a wooden crane over a plank wharf, bales and barrels, a moored fluyt, black and gold pennants. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight, drizzle and low fog; palette of deep sea teal, navy, charcoal and slate with old brass highlights and warm amber lanterns. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

#### Деревня Лиги + сцены доставки (посылка/письмо)
File: `...\ports_p1\bg_league_b_and_drops.png` (1536×1024). Cells: `bg.port_gen_black_coast_league_b`, `card.drop_hamlet`, `card.drop_cove`, `card.drop_waystation`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a cinematic painted game scene at night. 1: a League rum village harbour seen from the water: a squat brick distillery with a steaming copper chimney, a row of timber storehouses, barrels on a wooden wharf, a small merchant sloop moored, the lower third calm dark water. 2: a ship's boat run up on a beach below a small island hamlet of thatched huts among palms and rocks, a sailor in a long coat handing a sealed oilcloth parcel tied with cord to a villager holding a lantern, warm light from a hut door. 3: a fishers' cove: a few fishing boats drawn up on shingle, nets on poles, a smokehouse with a thin plume, a sailor handing a folded sealed letter to an old fisherwoman with a lantern at the waterline. 4: a floating waystation tavern on a timber raft at sea, lanterns on its eaves, a ship's boat tied alongside, a sailor passing a wooden crate up to the tavern keeper on the raft. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight and low sea fog with warm amber lantern pools; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights; faces small and in shadow. No text, no letters, no numbers, no writing on the parcel or letter, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

#### Пролог, эпилог, главы 1–2
File: `...\story\story_1.png` (1536×1024). Cells: `card.lore_prologue`, `card.lore_epilogue`, `card.ch_01`, `card.ch_02`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal story-card illustrations separated by thin pure black gutters, each a cinematic painted scene. 1 (prologue): a vast dark sea at night under a pale moon; far below the surface a great drowned bronze bell glows faintly teal, a ring of ripples spreading above it; on the horizon a lonely fishing town with one lit tower. 2 (epilogue): dawn breaking over a calm sea after a storm, a single battered ship under patched sails heading for a distant lighthouse, a huge bronze bell sinking gently into the clear deep below, gold light on the water. 3 (chapter one, Saltmarrow): an old pilot in a weathered coat holding a lantern on a rocky shore at night, looking out at false lights burning on black rocks, a grey fishing town behind him. 4 (chapter two, the Bells of Gravesend): a grey stone capital of many bell towers in the rain at night, a cartographer's lit window high in a tower, a black sea chart torn into pieces on a table by the window. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights and small warm amber accents. No text, no letters, no numbers, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

#### Главы 3–6
File: `...\story\story_2.png` (1536×1024). Cells: `card.ch_03`, `card.ch_04`, `card.ch_05`, `card.ch_06`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal story-card illustrations separated by thin pure black gutters, each a cinematic painted scene. 1 (Gallowsmouth): a grim prison port on a black rock at night, old dismasted prison hulks rotting at their chains, a bell-founder in iron fetters looking through barred windows at the sea. 2 (the Tide Fair): a crowded free-port auction hall lit by lanterns, a small bronze bell on a velvet cushion on the auctioneer's table, rough captains bidding in the shadows. 3 (the Whispering Fog): dark houseboats lashed in rings around a half-sunken stone bell tower in thick fog, a smugglers' longboat slipping through a narrow channel with its lantern shuttered. 4 (the Bank of Hollowmere): brass counting rooms with tall arched windows above a flooded market hall, ledgers and brass scales on a desk, the water below reflecting lamplight. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold moonlight, fog, warm amber lamps; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No text, no letters, no numbers, no writing in the ledgers, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

### P2

#### Ключевые порты — гавани (6 отдельных картинок)
Files: `C:\Users\enosi\Downloads\gravetide_art\ports_p2\bg_port_<id>.png` (1774×887 each). Paste this template 6 times, each time replacing `<HARBOUR>` with one of the lines below:
```
Generate a new image now (no reference needed). A single wide 2:1 painted game background, full-bleed, no grid: <HARBOUR>, seen at night from the water from the deck of an arriving ship, the town spread across the width, a few ships moored; the main buildings in the middle and right half, the left third calmer and darker; the lower third calm dark water with nothing in it. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight through thin cloud, low sea fog, warm lanterns reflected in black water; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no frames, no borders, no watermark.
```
- `hollowmere`: the harbour of Hollowmere, the League's banking city: tall brick counting houses with brass-framed windows above a flooded market hall, arcades half in water, copper domes, merchant galleons at stone quays
- `wrecktide`: the harbour of Wrecktide, a town of beached hulks on a grey barren shore at the edge of a ship graveyard, dozens of broken masts standing out of the shallows, lanterns in old stern windows
- `harpoon_rest`: the harbour of Harpoon's Rest, a whalers' town on an icy coast, two great carved arches of bleached timber shaped like whale flukes over the harbour mouth, smoking try-works, whale boats on the ice-rimmed quay
- `saint_maw`: the harbour of Saint Maw, the Choir's city of drowned grey churches, pale green lanterns burning on every tower, bell towers standing in the water, a chain boom across the harbour mouth
- `fogmouth`: the harbour of Fogmouth, a stilt town of the Fog Brokers in dense fog, dark houses on tall piles linked by rope bridges, lanterns shuttered, low boats gliding between the stilts
- `cinderhold`: the harbour of Cinderhold, a pirate capital inside a volcanic caldera, black cliffs ringing the bay, a glow of lava high on the rim, iron-roofed forts and taverns on black sand, red and black banners

#### Ключевые порты — города на карте (2 листа)
File: `...\ports_p2\prop_ports_key_2.png` (1254×1254, 2×2): `prop.port_hollowmere`, `prop.port_wrecktide`, `prop.port_harpoon_rest`, `prop.port_saint_maw`.
File: `...\ports_p2\prop_ports_key_3.png` (1774×887, 1×2): `prop.port_fogmouth`, `prop.port_cinderhold`.
```
Generate a new image now (no reference needed). A square image: a game sprite sheet of four port towns for an adventure map, in a strict grid of 2 rows by 2 columns, each town alone in its own quarter with wide empty gaps so nothing touches, on a solid flat chroma green #00FF00 background (no sea, no shadows on the background, no green anywhere in the towns). Each town seen in a strict top-down orthographic view, the camera pointing straight down at 90 degrees like a satellite photo or a map plan: only roofs, courtyards, streets and the tops of walls are visible, no front faces or side walls of buildings, no perspective, no horizon, no tilt; streets and quays square to the edges, not rotated, not isometric; compact on its own patch of shore, three or four piers reaching straight down toward the bottom of its quarter. 1: Hollowmere, a League banking city: tall brick counting houses, copper domes, a flooded market square with arcades. 2: Wrecktide, a town of upturned and beached ship hulks used as houses, broken masts as poles, rope walkways. 3: Harpoon's Rest, a snowy whalers' town: dark timber longhouses, smoking try-works with iron pots, two carved timber whale-fluke arches over the quay. 4: Saint Maw, a city of grey drowned churches and bell towers with pale green lanterns, a walled cathedral close. Style: smooth painterly digital painting with the painterly finish of Heroes of Might and Magic III but drawn strictly as a top-down map plan seen from directly overhead, grim and weathered; night, warm lantern light and cold moonlight on wet roofs; muted charcoal, slate, tarred wood, rust, old brass, cold blue-grey. No text, no letters, no numbers, no labels, no frames, no skulls, no bones, no blood.
```
(For the second sheet use the same text with "A wide 2:1 image … in a strict grid of 1 row by 2 columns", and two towns: 1: Fogmouth, a stilt town of dark houses on tall piles linked by rope bridges. 2: Cinderhold, a pirate capital inside a volcanic caldera: iron-roofed forts, forges and taverns on black sand within a ring of black cliffs.)

#### Города кампании — гавани (10 листов по 4)
Files: `...\ports_p2\bg_ports_campaign_NN.png` (1536×1024 each, 2×2). For each sheet, paste the template and put in the four lines of that sheet, in order.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a painted game background of a small harbour seen at night from the water from the deck of an arriving ship; in every panel the lower third is calm dark water with nothing in it and the buildings sit in the middle and right of the panel. 1: <A>. 2: <B>. 3: <C>. 4: <D>. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight, low fog, warm lanterns reflected in black water; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No people in the foreground. No text, no letters, no numbers, no signs with writing, no skulls, no bones, no blood, no borders inside panels, no watermark.
```
- **01** (whispering, gravewater): A `whispering_t7` Fog Sound, a free smugglers' village of tarred shacks on mossy rocks in thick fog, a single lantern on a pole at the end of a sagging jetty · B `gravewater_t17` Gale Creek, a windswept free village up a narrow creek, timber houses leaning in the wind, a tavern with a lit door, small sloops moored · C `gravewater_t20` Tallow Roads, a free chandlers' village where tallow and candles are boiled, smoking vats, racks of candles, a muddy road down to a plank wharf · D `whispering_v3` Hushreed Key, a reed-roofed Brokers' village on a low key among tall rushes, stilt huts, shuttered lanterns
- **02**: A `whispering_t71` Sail Wharf, a Brokers' wharf where old sails are mended, grey canvas stretched on frames along the quay, moss-covered roofs · B `whispering_t13` Mermaid Cove, a Brokers' cove among giant pale glowing mushrooms, huts built under their caps, a carved mermaid figurehead on a post at the landing · C `whispering_t70` Widows Cove, a mossy cove of black-shuttered cottages, women's shawls hung to dry, a small chapel with a bell, one lantern lit · D `whispering_t45` Mermaid Pier, a long rickety pier on stilts into fog with a few houseboats tied along it, dreamleaf drying in bundles under the eaves
- **03**: A `dead_mans_expanse_t9` Moon Haven, a free salt village on white salt flats under a huge moon, flat-roofed adobe huts, salt heaps glowing pale · B `dead_mans_expanse_v3` Lastisle, a tiny atoll village of palm-thatched huts around a coral lagoon, pearl divers' boats pulled up on white sand · C `whispering_t79` Moon Quarter, a free village among giant glowing pale-blue mushrooms on a mossy shore, apothecary huts with herbs drying · D `whispering_t23` Brine Rest, a Brokers' pearl-diving village of houseboats around a mossy rock, pearl baskets, shuttered lanterns
- **04**: A `whispering_t51` Mermaid Quarter, a free village built in mangrove roots, huts on stilts joined by rope bridges, lanterns in the tangled roots · B `leviathan_reach_t10` Seal Wharf, a whalers' wharf on a bare grey rocky shore, seals on the rocks, timber sheds, a small whale boat · C `leviathan_reach_t21` Rope Tavern, a snowbound whalers' tavern town in a fjord, a long timber ropewalk, a lit tavern, ice along the jetty · D `dead_mans_expanse_t10` Gale Haven, a Confederacy salt port on white salt flats, iron-roofed sheds, a squat stone fort with two cannon, red and black banners
- **05**: A `dead_mans_expanse_t5` Coal Reach, a grim free coaling station on a barren grey island, heaps of coal, a timber coal chute to the quay, soot everywhere · B `leviathan_reach_t14` Herring Reach, a whalers' and herring village on bare grey rock, herring racks, salt barrels, smoking chimneys · C `leviathan_reach_t15` Gull Tavern, a free ice-bound tavern village under the aurora, snow-heavy roofs, gulls on every ridge, a frozen jetty · D `dead_mans_expanse_t1` Cod Bay, a Confederacy fishing hamlet on a coral atoll, palm huts, cod drying on racks, red and black pennants, an iron gun on the beach
- **06**: A `dead_mans_expanse_t7` Coal Pier, a Confederacy coaling pier on an atoll, a long timber pier heaped with coal sacks, a black-hulled collier moored · B `whispering_t35` Shell Backwater, a Brokers' backwater among mossy islets, huts on stilts, heaps of pale shells, fog lying on still water · C `whispering_t59` Lucky Pier, a Brokers' mangrove landing, a gambling house with lanterns on a pier among mangrove roots · D `whispering_t3` Tallow Point, a free chandlers' point in the mangroves, candle-works with smoking vats, plank walkways on roots
- **07**: A `ashen_isles_t13` Old Moorings, a Confederacy anchorage of old rusted mooring chains and hulks under a smoking volcano, black sand, iron sheds · B `ashen_isles_t6` Rum Roads, a free volcanic port of taverns and iron foundries on black rock, a glowing forge, red and black flags · C `ashen_isles_t3` Coal Watch, a free watch-post on a volcanic headland, a stone tower with a fire basket, coal heaps, a small iron jetty · D `drowned_crown_t31` Last Cove, a free salvagers' cove among drowned gothic ruins, shacks built against broken arches, pearl baskets
- **08**: A `drowned_crown_t11` Sunken Roads, a Choir village on a fungal shore, pale glowing mushrooms among drowned stone chapels, green lanterns · B `drowned_crown_t8` Gold Reach, a Choir settlement among pale crystal spires rising from the sea, small stone chapels, iron mine carts · C `drowned_crown_t2` Sail Roads, a free salvagers' anchorage in drowned ruins, broken colonnades in the water, hulks moored to them · D `ashen_isles_t17` Copper Backwater, a Confederacy smelting backwater under ash clouds, copper furnaces glowing, slag heaps, iron-roofed huts
- **09**: A `drowned_crown_t22` Pearl Tavern, a Choir tavern built into a pale crystal reef, green lanterns, divers' boats · B `drowned_crown_t9` Last Moorings, a Choir mangrove village with drowned bell towers among the roots, green lanterns · C `drowned_crown_t6` Sail Landing, a free landing in the drowned ruins of a gothic town, wooden walkways between upper windows · D `drowned_crown_t13` Lucky Reach, a free salvagers' town among drowned ruins, wooden cranes over flooded courts, salvage heaped on rafts
- **10**: A `drowned_crown_t19` Salt Pier, a Choir pier among drowned grey ruins, pearl racks, a small chapel bell over the landing · B `drowned_crown_t28` Black Watch, a Choir watch-tower town of black stone on a drowned ruin, a beacon burning pale green · C `drowned_crown_t0` Cod Landing, a Choir fishing landing in the shadow of a half-drowned cathedral, small boats, green lanterns · D floating town (`bg.port_raft_a`, register it for `raft_0..6`): a town of old ship hulks lashed together side by side at open sea, plank walkways across their decks, lanterns, taverns built in their sterns

#### Плавучий город (вариант Б) + заголовки трека
File: `...\ports_p2\bg_raft_b_and_trek.png` (1536×1024). Cells: `bg.port_raft_b` (register for `raft_7..12`), `bg.way_market`, `card.trek_lush`, `card.trek_stark`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a cinematic painted game scene at night. 1: a floating town at open sea seen from the water: a ring of rafts and lashed hulks around a calm pool, a market of sailcloth stalls on the rafts, small boats moored round it, the lower third calm dark water. 2: a floating market on a broad timber raft at sea: sailcloth stalls, crates and barrels, hanging lanterns, boats tied round it. 3: a landing party of sailors with lanterns pushing inland on a lush jungle island path, huge ferns and palms, a stream, a glimpse of the ship's boat on the beach behind. 4: a landing party with lanterns climbing a stark rocky island trail of black stone and wind-bent scrub, a cold sea and the ship far below. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold blue moonlight and low fog with warm amber lantern pools; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights; figures small and in shadow. No text, no letters, no numbers, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

#### Типовые гавани по морю и флагу (3 листа)
Files: `...\ports_p2\bg_ports_generic_1..3.png` (1536×1024, 2×2). Use the same template as the campaign towns.
- **1:** A `gen_gravewater_league` a League sugar village under rain: white-walled warehouses with red tile roofs, a stone windmill, cane fields on a green hill · B `gen_gravewater_free` a free rum village on mudflats, leaning shacks on stilts, copper stills smoking · C `gen_whispering_brokers` a Brokers' houseboat village in fog among mossy islets, shuttered lanterns, rope bridges · D `gen_whispering_free` a free smugglers' village in the mangroves, huts high in the roots, a hidden channel
- **2:** A `gen_ashen_confederacy` a Confederacy foundry village on black sand under a smoking cone, glowing furnaces, cannon barrels stacked · B `gen_ashen_free` a free volcanic hamlet of stone huts on black rock, a steaming hot spring, iron jetty · C `gen_leviathan_harpoon` a snowbound whalers' village in a fjord, try-works smoking, whale boats on the ice · D `gen_leviathan_free` a free sealers' hamlet on an ice shelf under the aurora, turf huts, sealskins on frames
- **3:** A `gen_dead_free` a free village on a barren grey island, huts made from wreck timbers, a lighthouse of stacked stones · B `gen_dead_confederacy` a Confederacy salt fort on a white atoll, a squat fort with cannon, palm huts · C `gen_drowned_choir` a Choir hamlet of drowned grey chapels and bell towers rising from shallow water, green lanterns · D `gen_drowned_free` a free salvagers' hamlet in drowned marble ruins, cranes and diving platforms

#### Главы 7–34 (7 листов по 4) и 35–36 + путевые станции
Files: `C:\Users\enosi\Downloads\gravetide_art\story\story_3..9.png` (1536×1024, 2×2) → `card.ch_07` … `card.ch_34`; `story_10.png` → `card.ch_35`, `card.ch_36`, `bg.way_tavern`, `bg.way_chapel`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal story-card illustrations separated by thin pure black gutters, each a cinematic painted scene. 1: <A>. 2: <B>. 3: <C>. 4: <D>. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold moonlight, sea fog and warm amber lamplight; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights; people small or seen from behind. No text, no letters, no numbers, no skulls, no bones, no blood, no gore, no borders inside panels, no watermark.
```
- **story_3** (ch7–10): ch7 a merchant convoy under green copper roofs and cranes, two captains' ships sailing side by side against grey wolf-like raiders on the horizon · ch8 a town on stilts with shuttered lanterns, a tall cloaked figure in a bell-shaped hood stepping out of the fog on a walkway · ch9 a ship graveyard of masts in the currents, an old salvager reading a black chart by lantern, a bronze bell glimmering under clear water · ch10 burning cane fields up the hills at night, mill bells swinging, a masked man silhouetted against the fire
- **story_4** (ch11–14): ch11 a cliff village around the tallest lighthouse in the fog, the beam pointing the wrong way onto rocks, women in black shawls watching · ch12 cold try-works by a frozen harbour, a pod of whales fleeing across the sea away from ice · ch13 a walled whaling town in a fjord, a sunken church spire frozen under clear ice, men sawing a hole down through the ice by lantern · ch14 junks at anchor on a glassy dead-calm sea, a pagoda bell with its tongue tied, crews listening
- **story_5** (ch15–18): ch15 a fortress carved of blue ice beyond a seal ground under the aurora · ch16 a flagship at the mouth of a frozen fjord ringing a great bell, ice floes cracking around it · ch17 white salt pans and glowing glass kilns, crates of black glass lenses humming with faint light · ch18 mirror towers flashing light through fog over mangrove huts, an old woman with a lantern on a rope bridge
- **story_6** (ch19–22): ch19 a pirate town in the throat of a volcano, a war council round a table of charts by forge light · ch20 foundries on black sand, a saboteur's lit fuse creeping toward powder barrels · ch21 shipwrights raising old wrecks off a reef with chains and cranes, hulls coming back to the light · ch22 yellow sulphur terraces at dawn, a grey fleet appearing on the horizon
- **story_7** (ch23–26): ch23 a royal squadron and a pirate fleet anchored in one bay with guns run out, an admiral's barge between them · ch24 a city of drowned churches with green lanterns on every tower, a chain boom closing the harbour · ch25 a town built on the roofs of drowned bell towers, a forest of spires under a ship's keel · ch26 a city's bells swinging at night with no one at the ropes, a ghostly pale woman's ship at the sea gate
- **story_8** (ch27–30): ch27 fireships drifting into a burning harbour, powder mills ablaze, a grey brig coming out of the smoke · ch28 a fortress lighthouse whose lenses look down into the sea, armoured knights on its wall · ch29 a drowned capital a few fathoms under the keel, straight streets and churches seen through clear water, a black chart laid over the view · ch30 a singing reef glowing under the water at night, a dark fleet waiting beyond, a great wall of storm on the horizon
- **story_9** (ch31–34): ch31 beyond a wall of storm: dead calm, wrong stars, lonely lighthouses on islands with their lenses turned down into the sea · ch32 three glowing marks on the seabed under a drowned city, a fleet coming back through the storm wall · ch33 colossal shadowy sea creatures rising toward ships in the deep, bells hung from the ships' bows · ch34 a vast glowing eye-shaped whirlpool in the deep, a ring of dark ships at its rim, lighthouses going dark one by one
- **story_10**: ch35 seven great bronze bells hung around a vast whirlpool in the deep, one on a dark flagship · ch36 a giant bell swinging by itself under a glowing maelstrom, an old pilot at the wheel of a battered ship holding course · waystation tavern: a floating tavern on a timber raft at sea, inside view of its warm common room with lanterns, barrels and a small hearth · waystation chapel: an old hulk at anchor turned into a chapel, candles on her deck around a ship's bell

#### Мировые боссы — полоса на панели босса
File: `C:\Users\enosi\Downloads\gravetide_art\bosses\boss_cards_1.png` (1536×1024). Cells (2 columns × 3 rows): `card.old_moorings`, `card.old_tithe`, `card.fog_changeling`, `card.cinder_ray`, `card.drowned_prelate`, `card.rime_twins`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 3 rows by 2 columns: six equal very wide panels separated by thin pure black gutters, each a cinematic painted banner of a sea monster at night seen from the water at sea level, the creature large and filling the panel. Order, left to right then down: 1: a colossal conger eel as thick as a mainmast rising out of silt by old breakwaters, rusted mooring chains wound about its body. 2: a huge old grey shark as long as a frigate, its scarred hide crusted with barnacles and broken harpoon heads, a torn scrap of sailcloth on one fin, following a convoy. 3: a giant cuttlefish the size of a brig in fog, its skin shifting pale grey and mother-of-pearl, a faint ghostly copy of its shape thrown on the fog. 4: a manta as broad as a frigate gliding over the surface, black glassy hide seamed with glowing ember cracks, ash falling. 5: a vast mitred shape of weed and pale coral rising from the sea, three bronze bells hanging from it and tolling. 6: two white narwhals as long as frigates surfacing side by side, long spiral ivory tusks, frost on their backs, ice floes. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; cold moonlight, spray and fog; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No text, no letters, no numbers, no skulls, no bones, no blood, no gore, no borders inside panels, no watermark.
```

#### Мини-игры на островах (5 листов по 4)
Files: `C:\Users\enosi\Downloads\gravetide_art\minigames\mg_1..5.png` (1536×1024, 2×2) → `card.mg_<id>`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a cinematic painted scene on a lonely island shore or cave at night, as a dimmed background for a small game. 1: <A>. 2: <B>. 3: <C>. 4: <D>. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; moonlight, fog, warm lantern or campfire light; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No text, no letters, no numbers, no skulls, no bones, no skeletons, no blood, no borders inside panels, no watermark.
```
- **mg_1**: talking_skull: a grinning carved driftwood mask on a boarding pike stuck in the sand of a beach · drowned_ferryman: a grey man with weed in his beard in a grey rowing boat at the waterline, holding out a hand · old_parrot: an ancient grey parrot on the shoulder of an empty rotten sea coat draped on a driftwood chair, a silver chain glinting · bosuns_lore: a one-legged bosun with a pipe sitting on a barrel by a campfire
- **mg_2**: star_bearing: a pilot with a broken sextant on a rock under a brilliant starry sky · liars_dice: a grog shack counter with a leather dice cup and five dice, a lantern · crown_anchor: a deserter's painted gaming cloth on a crate with three large dice, coins · castaway_coin: a ragged castaway grinning, a gold doubloon spinning in the air above his hand
- **mg_3**: three_shells: three big shells and a pearl on an upturned barrel, quick hands · bosun_whistle: an old marooned bosun on a crag holding up a silver bosun's call · flag_hoist: a signal mast on a crag with a hoist of plain coloured signal flags, no symbols · compass_needle: a brass compass lying open on a stone cairn, its needle blurred in motion
- **mg_4**: harpoon_lagoon: a harpooner on wet rocks over a moonlit lagoon full of darting fish · beach_trader: a merchant selling from an upturned boat on the beach, one fine sword on display · marooned_sailor: a long-bearded marooned man stepping out of a driftwood hut with an old pistol · cursed_idol: a golden idol with ruby eyes inside a ring of black standing stones, an eerie glow
- **mg_5**: smugglers_cave: a half-drowned sea cave, rope marks on the rock, an iron lantern hook, rum barrels in the dark · mutineers_grave: a lonely driftwood grave marker on a dune with freshly turned earth and a spade · three_levers: an iron-bound chest bolted to rock with three levers on its lid of brass, iron and pale carved horn · split_map: a one-eyed woman at a campfire holding up half of a torn treasure map with no writing

#### Артефакты (3 листа) + реликвии
Files: `C:\Users\enosi\Downloads\gravetide_art\icons\artifacts_1.png`, `artifacts_2.png` (1254×1254, 4×4) and `artifacts_3.png` (1536×1024, 4 columns × 3 rows: 8 artifacts + 4 relics) → `icon.art_<id>` / `icon.relic_<id>`.
```
Generate a new image now (no reference needed). A square image: a game icon sheet of 16 item icons in a strict grid of 4 rows by 4 columns of equal square tiles separated by thin pure black gutters, in the painterly style of the item icons of World of Warcraft and the artifacts of Heroes of Might and Magic III but grim and realistic. Each tile is one magical artifact painted large and centred on a dark, softly lit background with a faint aura (teal for the deep, gold for command, cold blue for storms), readable at small size, the same lighting and finish across all. Old brass and gold highlights, deep sea teal and navy. No text, no letters, no numbers, no skulls, no bones, no blood. The icons, left to right and top to bottom: <LIST>.
```
- **artifacts_1**: 1 drowned_bicorne, an admiral's bicorne crusted with salt and gold braid, dripping · 2 kelp_coat, a long coat woven of dark kelp with pearl buttons · 3 needle_of_the_deep, a compass whose needle points straight down into a glowing teal depth · 4 red_hook_axe, a boarding axe with a red-lacquered hooked blade and forty notches on its haft · 5 hook_brace, two brass blunderbusses on one leather strap · 6 bloodied_baldric, a dark crimson leather baldric with tarnished brass studs · 7 squall_glass, a spyglass with tiny storm clouds swirling in its lens · 8 deck_grip_boots, tarred boots with iron-cleated soles · 9 ring_of_the_gale, a pale silver ring with a swirl of wind inside its stone · 10 first_mate_cutlass, a heavily notched cutlass with a worn brass hilt · 11 quartermaster_rapier, a slim rapier with a hilt shaped like coin scales · 12 mail_lined_coat, a heavy coat open to show chain mail lining · 13 dress_uniform, a navy dress coat with gold epaulettes and a sash · 14 tricorne_of_command, a black tricorne with a gold cockade and gold edging · 15 bandana_of_fury, a fiery red bandana knotted, glowing at the edges · 16 cartridge_bandolier, a marksman's bandolier of polished cartridge tubes
- **artifacts_2**: duellist_pistols, a pair of silver-chased duelling pistols crossed · tide_boots, sea boots with wave patterns of water curling round them · watch_glass, a night-watch spyglass with a small lit lantern hung from it · lodestone_compass, a compass with a dark lodestone rose pulling filings · lucky_doubloon, a gold doubloon showing the same face on both sides, glinting · mercy_medal, a silver saint's medal on a chain with a soft white glow · ring_of_brine, a ring with a salt-crusted sea-green stone · orca_talisman, a black and white carved orca talisman on a cord · admirals_signet, a heavy gold signet ring with an anchor and crown seal · last_volley_tricorne, a battered black tricorne with a red plume and two bullet holes, smoke curling · white_orca_fang, a pale fang carved with flowing patterns, faint glow · union_pike, a boarding pike with a bound brass collar · union_pepperbox, a six-barrelled pepperbox pistol with brass bands · union_buff_coat, a stiff salt-stained buff leather coat · union_boots, buccaneer boots with iron toe caps · deep_bell, a small barnacled bronze bell with a teal light inside
- **artifacts_3** (grid 4×3): drowned_sunstone, a sunstone glowing gold under water bubbles · storm_bottle, a corked bottle with a lightning gale inside · storm_glass_eye, a storm glass with clouding crystals and a blue glow · thunder_cap, a gunner's cap singed with lightning marks · thunder_horn, a powder horn crackling with small sparks · throne_needle, a compass needle of gold pointing to a tiny crown · throne_hoop, a heavy gold earring hoop with a tiny compass rose · throne_cloak, a dark courier's cloak with a gold clasp · relic crown_of_the_deep, a drowned crown of coral and bronze with a teal glow · relic storm_orb, a glass orb with a living storm and lightning inside · relic boarding_union, crossed pike, pistol and cutlass bound together with a brass band · relic throne_compass, a large ornate gold compass with a crown on its lid

#### Изо-карты острова для «сухих» и «утонувших» биомов
Files: `C:\Users\enosi\Downloads\gravetide_art\isle\isle_map_dry.png`, `isle_map_drowned.png` (1536×1024 each). These need a code change: new entries in `ISO_MAP_OF` and `ISO_CORNERS`.
```
Generate a new image now (no reference needed). A single wide 3:2 painted game background, full-bleed: one island standing in a dark night sea, seen in isometric 2:1 projection from above at the same angle as a classic isometric strategy game; in the middle of the island a large flat empty paved plateau shaped like a wide diamond, taking about sixty percent of the picture's width, edged by low cliffs, completely empty of buildings, ready for buildings to be placed on it; around it <BIOME>; the sea all round the island calm and dark with faint moonlight. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture, deep chiaroscuro; palette of deep sea teal, navy, charcoal and slate with old brass highlights. No text, no letters, no numbers, no skulls, no bones, no blood, no frames, no watermark.
```
- dry: white salt flats and bare grey rock, wind-bent thorny scrub, a few salt pans shining
- drowned: broken drowned gothic ruins and arches at the island's edge, pale crystal shards in the rocks, green-glowing pools

### P3

#### Бездна, Трон, цитадель — заголовки окон
File: `C:\Users\enosi\Downloads\gravetide_art\p3\headers_endgame.png` (1536×1024, 2×2) → `bg.descent`, `bg.abyss_raid`, `bg.throne`, `bg.citadel`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a wide painted window-header scene. 1: the Maelstrom Stair, a vast slowly turning maelstrom in a dark sea with a pale green light far below its eye, steps of foam spiralling down. 2: the Maw of the World, an abyssal chasm in the sea floor seen from above the water, a ring of legendary dark ships around it, green lights in their gun ports. 3: the Throne of the Sea, a colossal throne of coral and old gold standing on a reef in a stormy sea, lit by lightning. 4: a star fort citadel on a rocky island at night, guild pennants of plain colours over its walls, a siege fleet offshore. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No text, no letters, no numbers, no skulls, no bones, no blood, no borders inside panels, no watermark.
```

#### Предметы на карте: цитадель, наблюдательный пост, потерпевшие, загон
File: `...\p3\props_map_1.png` (1254×1254, 2×2, green) → `prop.citadel`, `prop.lookout`, `prop.castaways`, `isle.pen`.
```
Generate a new image now (no reference needed). A square image: a game sprite sheet of four objects for an adventure map, in a strict grid of 2 rows by 2 columns, each object alone in its quarter with wide empty gaps so nothing touches, on a solid flat chroma green #00FF00 background (no shadows on the background, no green in the objects). Objects 1 to 3 are for the sea chart and are seen in a strict top-down orthographic view, the camera pointing straight down at 90 degrees like a satellite photo or a map plan: only roofs, courtyards, streets and the tops of walls are visible, no front faces or side walls of buildings, no perspective, no horizon, no tilt. Object 4 is for the island screen and is seen in isometric 2:1 projection, the same angle as a classic isometric strategy game. 1: a massive star-shaped stone citadel with bastions and a keep. 2: a lookout cairn of piled stones on a rocky headland with a tall pole and a small pennant. 3: three castaways clinging to a broken spar in the water, one waving an arm, a little white foam around them. 4: an island animal pen of timber fences with a feeding trough and a small shelter. Style: smooth painterly digital painting with the painterly finish of Heroes of Might and Magic III, grim and weathered, night light, muted charcoal, slate, tarred wood, rust, old brass. No text, no letters, no numbers, no skulls, no bones, no blood, no frames.
```

#### Мелкие иконки: метки портов, подарки уровней, следы
File: `...\p3\icons_small_1.png` (1254×1254, 4×4) → `icon.map_port_capital, _town, _village, _raft`, `icon.gift_lv10…lv60`, `icon.trail_plankton, _ink, _frost, _mist, _fire, _gold`.
```
Generate a new image now (no reference needed). A square image: a game icon sheet of 16 square icons in a strict grid of 4 rows by 4 columns of equal tiles separated by thin pure black gutters, in the painterly style of World of Warcraft ability icons but grim and realistic, each one object centred on a dark softly lit background, readable at small size, the same lighting across all, old brass and gold highlights on deep sea teal and navy. No text, no letters, no numbers, no skulls, no bones, no blood. The icons, left to right and top to bottom: 1. a walled harbour city with towers, seen from above, inside a brass ring. 2. a harbour town with a church spire and a quay. 3. a tiny fishing village with two huts and a boat. 4. a floating town of hulks lashed together. 5. a small wooden gift chest with a brass lock. 6. a larger iron-bound gift chest with a silver clasp. 7. an ornate chest with gold corners, slightly open, warm light inside. 8. a gold-banded chest overflowing with coins. 9. a treasure chest with gems and a gold chain. 10. a royal gold chest with a crown on the lid, glowing. 11. a ship's wake glowing blue-green with plankton. 12. a ship's wake trailing black ink clouds. 13. a ship's wake of white frost crystals. 14. a ship's wake of drifting grey mist. 15. a ship's wake of small flames and embers. 16. a ship's wake of glittering gold dust.
```

#### Полотнища флагов в магазине (10 цветов)
File: `...\p3\icons_cloths.png` (1774×887, 2 rows × 5 columns) → `icon.cloth_black, crimson, navy, ivory, ochre, forest, plum, teal, ember, slate`.
```
Generate a new image now (no reference needed). A wide 2:1 image: a game icon sheet of 10 square icons in a strict grid of 2 rows by 5 columns of equal square tiles separated by thin pure black gutters, each a folded bolt of heavy flag cloth with a rope tie, painted large and centred on a dark softly lit background, the same lighting across all, in the painterly style of World of Warcraft item icons but grim and realistic. The cloths in order: 1 black, 2 crimson, 3 navy blue, 4 ivory, 5 ochre, 6 forest green (dark, not bright), 7 plum, 8 deep teal, 9 ember orange, 10 slate grey. No text, no letters, no numbers, no emblems, no skulls, no bones, no blood.
```

#### Боссы морей — карточки-баннеры (2 листа)
Files: `C:\Users\enosi\Downloads\gravetide_art\bosses\zb_cards_1.png`, `zb_cards_2.png` (1536×1024, 2×2) → `card.zb_<region>`.
```
Generate a new image now (no reference needed). A wide 3:2 image in a strict grid of 2 rows by 2 columns: four equal panels separated by thin pure black gutters, each a cinematic painted banner of one monstrous warship at sea at night seen from water level, the ship large and filling the panel. 1: <A>. 2: <B>. 3: <C>. 4: <D>. Style: dark painterly pirate fantasy in the spirit of Heroes of Might and Magic III, oil-painting texture over realism, deep chiaroscuro; moonlight, spray, cannon smoke; palette of deep sea teal, navy, charcoal and slate with old brass and gold highlights. No text, no letters, no numbers, no skulls, no bones, no blood, no borders inside panels, no watermark.
```
- **zb_cards_1**: The Iron Lion, a three-decked man-of-war with a black hull banded with rusted iron and a crowned lion figurehead · The Gilded Leviathan, a monstrous treasure galleon with a gilded stern gallery, four masts of dark sails, brass swivel guns · The Fog Mother, a huge black ship of the line under charcoal sails with dozens of dim green lanterns · The White Harrow, an ice-armoured whaling dreadnought with plates of white ice, harpoon guns and a great ram
- **zb_cards_2**: The Cinder Throne, a colossal fire-galleon with glowing forges on deck and squat mortars, smoke-black sails · The Stitched Hulk, a vast hulk stitched together from wrecks lashed side by side, crooked masts and mismatched sails · The Drowned Regent, an ancient royal galleon risen from the sea, crusted with grey coral, water pouring from her gun ports, torn purple and gold banners · The Abyssal Ark, a colossal black three-masted ark with pale green lights in her gun ports and sails like grey smoke

---

## 5. Счёт листов

P1: 9 prompt sheets (3 single harbour pictures in the Saltmarrow/Gravesend/Blackwater–Tidewrack files, 1 sprite sheet, 2 early-town sheets, 1 delivery sheet, 2 story sheets).
P2: 41 (6 key harbours, 2 key-town sprite sheets, 10 campaign-town sheets, 1 raft+trek sheet, 3 generic, 8 story, 1 boss cards, 5 mini-games, 3 artifacts, 2 iso maps).
P3: 6 (endgame headers, map props, small icons, cloths, 2 zone-boss card sheets).
**Total: 56 prompt sheets → 242 pictures** (+12 lair videos from videos.py `NOT_FILMED`).

## 6. Сделано (2026-10-24): все 56 листов сгенерированы, нарезаны на 242 картинки

- Листы: `C:\Users\enosi\Downloads\gravetide_art\<folder>\<file>` — ровно имена из §4.
- Нарезка: `python -I tools/art/cut_todo_sheets.py` → `C:\Users\enosi\Downloads\gravetide_art\_cells\<asset id>.png` (242 файла) и `_cells\index.json` (`{ id: { sheet, box, size, kind } }`). Резчик ищет чёрные швы у каждого ожидаемого реза; ряды на некоторых листах ChatGPT нарисовал неровными (artifacts_2, mg_5, boss_cards_1, icons_small_1), резы идут по настоящим швам.
- **Проекции, как в игре:** всё на морской карте — строго сверху (`prop.port_*`, `prop.citadel`, `prop.lookout`, `prop.castaways`; лист `prop_ports_key_1` переделан, первый вариант был с наклоном). Шапки гаваней `bg.port_*` — вид с воды, как нынешние `bg.port_<фракция>`. Карточки `card.*` — картины. `isle.map.dry/drowned` и `isle.pen` — изометрия экрана острова.
- **Что сделать при подключении:**
  - `kind: green` (города и предметы карты) — ключевать (`process.py` keyed, ключ `#00ff00`), обрезать по нарисованному; для городов — `tools/art/quay_piers.py`.
  - Иконки (`icon.art_*`, `icon.relic_*`, `icon.gift_*`, `icon.trail_*`, `icon.map_port_*`, `icon.cloth_*`) — обрезать чёрную рамку внутри ячейки и привести к квадрату.
  - Крючки в коде из §3 (лор, главы, доставка, путевые станции, трек, артефакты, реликвии, Бездна/Трон, боссы морей, изо-карты).
  - Проверить глазами `icon.art_red_hook_axe`: красный лак на лезвии местами похож на кровь — при необходимости обесцветить пятна.
