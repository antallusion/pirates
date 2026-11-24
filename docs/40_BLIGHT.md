# 40. The Blighted Sea — the secret endgame water («Море Скверны»)

Owner, 2026-11-24: «давай сделаем секретную локацию, которая открывается после 90% пройденной игры (из ассетов,
которые у нас уже есть), где будет какой-то бесконечный эндгейм, куча интересного и прям лютый махач, что-то типа
пвп-локации с опытом, блекджеком и всем таким… море с водой, похожей на скверну… где хочется остаться надолго» —
«ну и глава там должна быть своя с квестами».

Hard rules for this feature:

- **Break nothing.** No new `RegionId`, no change to `REGIONS`, worldgen, `regionGrid`, sector levels or any world
  count. No 37th chapter in `campaign/plan.ts` (it would re-pace all 720 quests). Everything is an overlay.
- **No new art.** Only what is in `assets/manifest.json` already, procedural drawing and shader tint. No bones, skulls
  or blood (CLAUDE.md §2). No Higgsfield or any image generation.
- Every player-visible word in English and Russian. Every new random system its own `Rng`.
- Server strings in English with their Russian in a pattern table; `tests/server-ru-scan.test.ts` must pass.

## 1. The place

- An **overlay zone**: a circle `BLIGHT = { x, y, r }` of open water in **Dead Man's Expanse** (lawless already),
  radius about 5 km, chosen once by a deterministic search (its own `Rng`, fixed seed) for the circle with the least
  land, no port, town, waystation, citadel or outpost inside, at least 6 km from any port and from the region's
  borders. The result is written into the code as constants and pinned by a test (so the world can never move it).
  If Dead Man's Expanse has no such circle, the Drowned Crown is the second choice.
- Module layout: `shared/src/data/blight.ts` (constants, tiers, quests, shop, patterns, pure maths),
  `server/src/game/blight.ts` (the zone's life), `shared/src/blightproto.ts` if the messages are many,
  `client/src/ui/blight.ts`, `client/src/lang/ui/blight.ts`.
- **The Veil.** A captain who is not cleared and crosses the rim is turned back exactly as the Abyss' Maelstrom Wall
  does it (`abyss.ts abyssSecond`, the fixed version of forum 147: thrown back once, the way she came, just past the
  rim), with no hull damage and a line: «Зелёная вода не пускает вас: море ещё не считает вас своим».
- **Cleared** (`blightCleared`): `campaign.at >= ceil(0.9 * CAMPAIGN_SIZE)` (648 of 720) **and** level >= 55. No
  group pass: each captain earns it. Admins pass.
- **Secret.** Nothing on any chart, list or help until she is cleared. At the moment she becomes cleared: one letter
  («Зелёный огонь за Простором мертвецов») with the bearing, a chart mark from then on, a log line.
- The server tells the client `blight: BlightView | null` in `PrivateState` (null: not cleared and not inside).

## 2. The water

- While her ship is inside the circle the client draws fel water: the sea shader gets a green tint and grade
  (a sickly luminous green, not the Abyss' black), a slow pulse, green fog wash and green lantern glows. It is a
  screen-wide override keyed by `state.blight?.inside`, eased in over ~1.5 s at the rim — **not** a `GRADES` entry
  (so `tests/livesea.test.ts` stays as it is).
- From outside (cleared captains only) the zone shows on the sea as a faint green ring and haze, and on the chart
  as a green disc with its name.
- Reuse: `fx.curse_growth` / `fx.curse_veins`, `fx.bt_poison_*`, `tex.fog`, `prop.bd_ghost_lamp`,
  `card.enc_glowing_sea` (the zone's card), `bg.descent` or `bg.way_tavern` (the raft), `flag.c_green`,
  `cos.frame_abyss`, `icon.st_poison`, `icon.sk_rot`, `icon.sk_curse`.
- Music: the Abyss' theme (no new entry in `REGION_THEME`).

## 3. The loop: the Taint (push your luck, without end)

- Inside, a captain gathers **Taint** («Скверна»): a personal number that only grows while she stays.
  It rises with time under way (slowly) and with every kill (fast). Every `TAINT_PER_TIER` it raises her
  **tier** I, II, III… with no cap.
- Each tier: the zone's foes sent at her are stronger (⚓ and might scaled; past ⚓10 by `setNpcLevel` + hull/gun
  multipliers), more of them, and every reward of the zone is multiplied (`1 + 0.15 * tier`, experience capped at
  ×4, marks uncapped).
- **Marks** («Метки Скверны») are the zone's own currency. Marks earned inside are **unbanked**: they ride in her
  hold. She banks them by (a) mooring at the Raft in the middle (takes a 10 % cut), or (b) sailing out across the
  rim alive (no cut). Leaving or banking resets her Taint to 0.
- **Sunk inside:** she loses all unbanked marks; half of them float as a green cask anyone may take, and if a
  captain sank her, that captain gets the other half at once. Her ship and cargo follow the lawless water's usual
  rules — nothing harsher.
- The HUD shows the tier, the Taint bar, unbanked marks and the multiplier while inside.
- Foes (all existing classes and brains): `ghost_ship`, `phantom_brig`, `ghost_clipper`, `cursed_frigate`,
  `drowned_cathedral`, `black_corsair`, `storm_reaver`, Choir faction; spawned out of sight and sent after her
  like the campaign's foes (`spawnCampaignFoe` pattern, `huntAccount`), one more hunter each few tiers, never more
  than 4 on one captain. Beasts of the deep roam it.
- **The Blight's Heart** every 3 hours of wall time: a boss in the middle (reuse a `bossmonsters.ts` monster
  through the world-boss machinery, or a `zb_*` hull with its level raised), announced to cleared captains
  ten minutes before; contribution spoils in marks; everyone inside is in one fight, PvP stays on.
- Rewards never mint silver past the sea's hour: silver per kill as an Abyss kill of that ⚓; the extra is marks
  and experience (glory past 60). Balance rule (memory): a bare ship may fail at tier I; a full build (skills,
  gear, ship, island) wins tier I–III ~75–90 % and is pressed hard from VI on.

## 4. PvP

- The zone is lawless water with **every protection off**: no Green Pennant, no bubble after being sunk inside
  (she respawns outside it), no minnow shame. No infamy and no reputation loss for kills inside.
- A player sunk or taken inside pays the victor: experience ×2 of the usual `prizeXp` (×tier multiplier, capped),
  PvP rank points as usual, and marks: `20 + 10 * victim tier` plus half the victim's unbanked marks.
- **Anti-farm:** the same victim pays full once an hour, then 25 %; a victim with no kill and under two minutes
  inside pays no marks; group-mates and guild-mates pay nothing.
- **Bounty of the Tide:** the captain with the highest tier inside is marked on every cleared captain's chart
  inside («Избранник Скверны»); sinking her pays double marks. She earns +25 % marks while marked.
- A weekly board: the highest tier reached, marks banked, captains sunk. Top three get a title for the week
  («Избранник Скверны», «Длань Скверны», «Тень Скверны») and marks.

## 5. The Raft («Плот Скверны») — blackjack and the rest

- A neutral mooring at the centre (drawn with `prop.way_tavern` art, green lamps). Moored there she cannot be
  attacked and cannot attack; mooring takes 5 s hove to, and she may not moor within 30 s of taking or dealing
  damage. Mooring banks her marks (10 % cut) and resets Taint.
- **Blackjack («Двадцать одно»)** against the house, in silver (stakes 100 / 1 000 / 10 000) or in banked marks
  (5 / 25 / 100). Standard rules: one deck shuffled each hand (its own `Rng`, server-side), dealer stands on 17,
  blackjack pays 3:2, double down on the first two cards, no split, no insurance; push returns the stake.
  The server deals; the client only shows. Limits: 60 hands an hour, and a silver loss cap of 200 000 a day (told
  kindly: the dealer closes the table). Every hand in the ledger. UI as the dice window (`client/src/ui/dice.ts`);
  cards drawn procedurally (rank + suit glyphs on parchment, no new art).
- Dead Man's Dice stays as it is and is also offered here (this gives Davy Jones' table a real place: a port with
  `region === 'the_abyss'` never existed).
- **The shop** for banked marks — nothing that sells power for free:
  cosmetics (title «Плаватель Скверны», the green pennant/flag `flag.c_green`, the `cos.frame_abyss` frame, a green
  wake trail if a trail slot exists), build speed-ups, relic parts, a re-roll of one item's secondary stat, and
  the «Тёмный фонарь» consumable (+1 tier's worth of marks for the next 10 minutes inside). Prices grow with each
  purchase of the same thing in a week.

## 6. The chapter — «Глава XXXVII. Зелёный огонь»

- A **post-campaign track of its own**, not in `PLAN`: state `p.blight.ch = { at, done[] }`, shown in the campaign
  book as an extra card after chapter 36 only for cleared captains, with `card.lore_epilogue` /
  `card.enc_glowing_sea` art. Giver: a keeper of the Raft (an existing portrait).
- 14 story quests, each 1–3 steps of the zone's own step kinds (no campaign builder): reach the zone, moor at the
  Raft, sink N hunters, reach tier N, bank N marks at once, win N hands of blackjack, sink the Heart, sink a
  captain or (for those who will not fight people) three tier-V hunters, survive N minutes at tier ≥ N, carry a
  green cask out across the rim. Each with a title, a briefing and a completion line in both tongues, written in
  the campaign's voice (see ch34–36). Rewards: marks, experience, the chapter's title «Хозяин зелёной воды» and a
  pennant at the end.
- After the 14th: **endless contracts** — three a day drawn from the same step kinds with numbers that scale with
  her best tier, paying marks and experience. This is the endless endgame's daily reason to come back.

## 7. Safety, honesty, measurement

- Nothing here touches a captain who never enters. Outside the circle not one rule changes.
- All timers on the server; the client never decides a reward. Reconnect inside: Taint and unbanked marks kept for
  5 minutes, then she is treated as having left alive.
- Admin: `/blight` (tp to the rim, clear me, set tier N, give marks N, spawn the Heart) with its Russian help pair.
- Tests: the zone pinned; the Veil (cleared / not); Taint and tiers; banking, the cut and the loss on sinking;
  PvP pay and every anti-farm rule; blackjack (every outcome from a fixed deck, limits, the ledger); the shop's
  prices; the chapter's 14 quests completing in order and the endless contracts scaling; every word in Russian.
- A balance run (`tests/balance/blight.ts`): a reference ⚓10 full build's win rate against the hunters of tiers
  I–VIII, written into this doc as a table once measured.

### 7.1 The balance table (measured)

`node --disable-warning=ExperimentalWarning tests/balance/blight.ts 40 1 8 2000` — 40 runs a tier, a fresh sea every
ten runs. What a run is: the reference ⚓10 captain of the sea bench (`tests/balance/seakit.ts captainShip`: a
man-of-war with her level's talents and hero; «bare» — no gear, her captain's kit off; «full build» — full gear of
⚓10, her captain's kit on), fought by the sea's own fighting mind with an average captain's craft, against the tier's
hunters as `server/src/game/blight.ts blightHunterAt` makes them, **one after another with no mending between**
(`underway`: two ships under way from 900 m, broadsides only, until one is down). A run is won when every hunter of
the tier is sunk. This is the strict single-file case: in the live sea she may mend, use her abilities by hand, or
leave across the rim at any moment — and the next hunter may close before the last is down. Not measured: other
captains, the Heart, the island's bonuses.

| Tier | Hunters | ⚓ | hull × | guns × | bare ⚓10: won | full build ⚓10: won | hull left (full) | a run, s (full) |
|---|---|---|---|---|---|---|---|---|
| I | 1 | 10 | 3.00 | 1.85 | 13 % (5/40) | 90 % (36/40) | 26 % | 134 |
| II | 1 | 10 | 3.05 | 1.89 | 5 % (2/40) | 90 % (36/40) | 25 % | 137 |
| III | 1 | 10 | 3.10 | 1.93 | 8 % (3/40) | 70 % (28/40) | 28 % | 134 |
| IV | 2 | 10 | 1.35 | 1.50 | 0 % (0/40) | 53 % (21/40) | 20 % | 165 |
| V | 2 | 10 | 1.45 | 1.62 | 0 % (0/40) | 55 % (22/40) | 15 % | 161 |
| VI | 2 | 10 | 1.55 | 1.74 | 0 % (0/40) | 30 % (12/40) | 7 % | 164 |
| VII | 3 | 10 | 1.00 | 1.55 | 0 % (0/40) | 33 % (13/40) | 7 % | 182 |
| VIII | 3 | 10 | 1.05 | 1.65 | 0 % (0/40) | 3 % (1/40) | 10 % | 173 |

Read against the rule (a bare ship may fail at tier I; a full build wins I–III ~75–90 % and is pressed hard from VI
on): bare 13 % at tier I and nothing from IV; the full build 90 · 90 · 70 % at I–III (III a little under the band,
inside the bench's noise), about half at IV–V, 30 % at VI with 7 % of her hull left, 3 % at VIII. Tier IX and on (three
heavier hunters, then four) were not run: single file without mending they are not won. §10 has the hunters' numbers. The bench is noisy (some ±10 points at 40
runs between seeds: the start geometry and a magazine hit decide close fights).

## 8. Build order

1. Server + shared + tests (this doc §1, §3–§7): one helper.
2. Client (§2, HUD, chart, the Raft's windows, blackjack, the chapter card, lang) + browser QA: one helper, after 1.
3. Integration: merge, full type-check, the touched tests, deploy, forum news.

## 9. Protocol for the client

Nothing here raises `PROTOCOL_VERSION` (31): one optional field in `PrivateState`, one client message kind, two server
message kinds. A client that knows none of it is not disturbed. Types: `shared/src/blightproto.ts`; texts and
constants: `shared/src/data/blight.ts` (the client reads the chapter's and the shop's words there — the wire carries
only numbers).

### 9.1 `PrivateState.blight?: BlightView | null`

Absent or `null`: the green water has not taken this captain — draw **nothing** (no chart mark, no card, no help).
Present: she is cleared (648 campaign quests and level 55), and from that moment the zone is on her chart.

| Field | Meaning |
|---|---|
| `zone {x,y,r}` | The circle in world metres: `48500, 34200`, r `4000`. Chart: a green disc with the name «Море Скверны» (`BLIGHT_NAME`); sea, from outside: a faint green ring and haze. |
| `raft {x,y}` | The Raft «Плот Скверны» (`RAFT_NAME`) at `48500, 34200`. It is **not** in the world's waystation stream: draw it from this field. |
| `inside` | Her ship is counted inside: fel water on (ease ~1.5 s), the HUD block on. |
| `tier`, `taint`, `per` | Tier (1…, no cap; show as Roman), Taint within the tier `0…per` (`per` = 100): the bar is `taint / per`. |
| `hold` | Marks in the hold — **unbanked**, lost if she is sunk inside. |
| `marks` | Banked marks: the coin of the shop and of the table's marks stakes. |
| `mul`, `xpMul` | Her multipliers now, two decimals: marks (the Dark Lantern and the Chosen's quarter are in it), experience (stops at 4). |
| `best` | The best tier she ever reached. |
| `lantern` | Wall-clock ms until which the Dark Lantern burns (0: unlit). |
| `moored` | Made fast at the Raft: open the Raft's window (tabs: marks, blackjack, dice, shop, the chapter, contracts, the week). |
| `mooring` | World second (as `welcome.time` and the snapshots count) at which the lines are fast; 0: not mooring. Show a 5 s ring. |
| `atRaft` | Within 160 m of the Raft: offer «Пришвартоваться». |
| `chosen` | «Избранник Скверны» while she is inside: `{name,x,y,tier,me?}` — a mark on the chart and the sea; `me`: it is she. `null`: nobody. |
| `heart` | `null` (more than ten minutes off) · `{at}` wall ms of the rise (a countdown) · `{id,x,y,hp,until}` risen: ship id, place, hull 0–1, the world second she leaves. |
| `casks` | Green casks afloat (inside only): `[x, y, marks][]`. Taken by sailing within ~90 m plus half her length. |
| `cask` | A green cask is aboard (for the «вывезите бочонок» step). |
| `hunters` | Ship ids of the hunters sent after her: tint them green, mark them on the radar. |
| `ch` | The chapter: `at` quests behind her (0–14), `size` 14, `cur` the quest under way `{step, steps, progress, need}` or `null` (not taken / chapter done), `canClaim`. Texts: `BLIGHT_QUESTS[at]` (`t` title, `b` briefing, `d` completion line, `s` steps → `stepText(step)`), `BLIGHT_CHAPTER` (title, blurb, giver, portrait, cards). A «survive» step counts seconds (`need` = minutes × 60). |
| `contracts` | After the chapter: the day's three `{id, ask, marks, xp, paid, step, steps, progress, need}`; `ask` is a `BlightStep` → `stepText(ask)`; `step === 1`: ready to hand in. Empty before. |
| `shop` | `{id, price, owned}` for each ware of `BLIGHT_SHOP` (names, hints and art keys are there). `price` is this week's, already raised. |
| `bj {hands, silver}` | Hands left this hour (of 60) and silver she may still lose today (of 200 000). |
| `week` | The week's board, top ten `{name, tier, banked, sunk, me?}` plus her own row. Order: marks banked, tier, captains sunk. |
| `weekTitle` | The title of last week she holds now (English key; Russian via the server table), or `null`. |
| `dice`, `davy`, `tables` | Moored: Dead Man's Dice may be opened here with the **existing** `{t:'dice', …}` orders and `dice` views (the Raft stands in for a port); `davy`: Davy Jones' table is open now; `tables`: open tables at the Raft to join. |

### 9.2 Client → server: `{ t: 'blight', action, … }`

| Message | What it does | Refused when |
|---|---|---|
| `{action:'moor'}` | Starts the mooring: 5 s hove to within 160 m of the Raft; then her hold is banked (10 % to the Raft), the Taint washed off. | Not inside; too far; a shot given or taken in the last 30 s; boarded or sinking. |
| `{action:'leave'}` | Casts off. A hand on the table is stood on as it is. | — |
| `{action:'bj', op:'deal', coin:'silver'/'marks', stake}` | A hand. Stakes: silver 100 / 1 000 / 10 000, marks 5 / 25 / 100. | Not moored; a hand open; off the slate; 60 hands this hour; 200 000 silver lost today; not enough coin. |
| `{action:'bj', op:'hit'/'stand'/'double'}` | Her move. Double: first two cards only, one card, stake twice. | No hand; double after a hit; coin or the day's cap. |
| `{action:'buy', id, uid?, line?}` | A ware for banked marks. `id`: `title` `pennant` `speedup` `relic` `reroll` `lantern`. `reroll` names a piece (`uid`, locker or worn) and its extra line (`line`, 0-based). | Not moored; owned; not enough marks; speed-ups full; locker full (relic); no such piece or line. |
| `{action:'take'}` | Takes the chapter's next quest (anywhere, once cleared). | A quest under way; chapter done. |
| `{action:'claim'}` | Hands the quest in. | Steps undone; not moored. |
| `{action:'contract', id}` | Hands in a contract of the day (0–2). | Not done; paid; not moored. |

Refusals come as ordinary `toast` (`kind:'bad'`) in English with their Russian in the server table.

### 9.3 Server → client

| Message | Meaning |
|---|---|
| `{t:'blight_bj', view}` | The dealer's table (`BjView`) after every order; `null`: no hand (cast off). Cards are 0–51: rank `c % 13` (0 ace, 1–9 two…ten, 10–12 J Q K), suit `⌊c/13⌋` (♠ ♥ ♦ ♣). `dealer[1] === -1`: face down until `result` is set. `result`: `blackjack` `win` `push` `lose` `bust`; `back`: what returned to her (stake included). `canDouble`, `total`, `soft`, `dealerTotal` are ready for the buttons and the counts. |
| `{t:'blight_ev', ev, n?, cut?, id?}` | A flourish for the HUD (the words arrive as a toast beside it): `bank` (n banked, cut to the Raft) · `lost` (n marks gone with the ship) · `tier` (n) · `quest` (n marks; show `BLIGHT_QUESTS[at-1].d`) · `contract` (n) · `veil` (thrown back) · `bought` (id, n price) · `cask` (n). |
| `toast`, `chron`, letters | Every sentence is in `BLIGHT_WORDS` with its Russian (`blightPatterns()` is merged into `client/src/lang/server.ts TABLE`). |

### 9.4 Art assumed (all keys checked in `assets/manifest.json`; nothing new)

| Thing | Key |
|---|---|
| The zone's card, the chapter's card | `card.enc_glowing_sea`; the chapter done: `card.lore_epilogue` |
| The Raft on the sea | `prop.way_tavern` with green lamps `prop.bd_ghost_lamp`; its window: `bg.way_tavern` |
| Hunters | Ship class `ghost_ship` → `ship.ghost_ship` (role `hunter`, flag Choir); ids in `blight.hunters` for the green tint |
| The Heart | The same `ship.ghost_ship`, her id in `blight.heart.id`: draw her ~1.6× with `fx.curse_veins` / `fx.curse_growth` |
| Green casks | `prop.bt_barrels` tinted green (card: `card.enc_barrel`) |
| Marks, Taint, tier | `icon.st_poison`, `icon.sk_curse`, `icon.sk_rot` |
| Shop wares | `BLIGHT_SHOP[i].art` (`card.enc_glowing_sea`, `flag.c_green`, `icon.sk_curse`, `fx.curse_veins`, `icon.sk_rot`, `prop.bd_ghost_lamp`) |
| The keeper | `portrait.giver_lighthouse_keeper_f` (Mother Sedge / Матушка Осока); the dealer Quill / Перо has no face |
| Fog, water | `tex.fog`, a shader tint keyed by `blight.inside` (not a `GRADES` entry) |
| Pennants | Colours, as the seasons' pennants: the shop's `#58c96b`, the chapter's `#9dff6a` |
| Music | The Abyss' theme while `blight.inside` |

## 10. As built (step 1): the numbers chosen, and where the build departs from the plan

**Pinned place.** `BLIGHT = { x: 48500, y: 34200, r: 4000 }`, the Raft at its middle. The search (a 100 m grid of Dead
Man's Expanse; a grid, so no `Rng` was needed) found only two neighbourhoods six kilometres from every port and the
border; at r = 5 000 two islands reach into the circle, at r = 4 000 none (the nearest coast is 4 232 m from the
middle). So the radius is 4 km, not 5. Towns `dead_mans_expanse_t0`, `_t1`, `_t5`, `_v2` lie 6.2–6.8 km from the
middle. The world's floating waystations stand every ~500 m of every sea: 97 of them are inside, and 24 sea marks —
«no waystation inside» cannot be had anywhere in this world. They stay as they are.

**The Veil stands open by default.** The wall is built and tested as §1 asks (thrown back once, the way she came, no
hull lost, the line) — but a wall across 50 km² of live water between four towns would turn back every captain below
the gate who sails there today, strand the helmsman's courses that cross it, and close the waystations, marks,
wrecks and quest fights that fall inside. That breaks «ниче не сломай». So it is a stored switch, **off**:
`/blight veil wall` shuts it, `/blight veil open` opens it. Open, the zone is inert for a captain it has not taken:
she crosses it as the lawless water it was, sees nothing, is told nothing, is hunted by nothing, can take no cask,
give no order at the Raft, and earns nothing from a hunter or from a captain she sinks there. The zone's own rules
(no infamy, no standing lost, no minnow's shame) hold only between captains it has taken. **The owner's decision is
wanted before the wall is shut on the live sea.**

**Hunters.** The premium ghost hulls of §3 (phantom brig, ghost clipper, drowned cathedral, black corsair, storm
reaver) are never sailed by the sea (`spawnNpcShip` → `silverKin`: a hull sold for doubloons is never a prize), and
`cursed_frigate` is not a ship class. Every hunter is the sea's own `ghost_ship` under the Choir's flag. The role
`ghost` is off the broadside table (measured: a ⚓10 ghost falls to five broadsides whatever is done to her), so the
hunters sail as role `hunter`: ships of the ladder, an elite's hull and guns of ⚓10 (and a common ship's wreck — no
elite gear or artifact chance), fought **with the guns alone**: they board nobody and cannot be boarded, so no ghost
ship is ever had as a prize and a captain's marks are lost only by sinking or to another captain. All are ⚓10 from
tier I: the gate is level 55, and a full build sinks an elite ⚓9 five times in five with four fifths of her hull
left. Their might, over an elite ⚓10 (`HUNTER_BANDS`):

| Tiers | Hunters kept on her | hull × | guns × |
|---|---|---|---|
| I · II · III | 1 | 3.00 · 3.05 · 3.10 | 1.85 · 1.89 · 1.93 |
| IV · V · VI | 2 | 1.35 · 1.45 · 1.55 | 1.50 · 1.62 · 1.74 |
| VII · VIII · IX | 3 | 1.00 · 1.05 · 1.10 | 1.55 · 1.65 · 1.75 |
| X and on | 4 | 1.00 + 0.05 a tier | 1.20 + 0.05 a tier |

A band's first tier is lighter ship for ship than the last tier of the band before it — there is one more of them.
Tuned in four passes of the bench (the first passes ran every tier on one sea for hours of its clock and read tier VI
at 2 % for a captain long out of stores: the bench now makes the sea anew every ten runs).

The first sail 20 s after she enters, the next 25 s after the last was sent (8 s after a kill at the soonest), out of
every captain's sight 1.7–2.3 km off her, inside the circle and not within 700 m of the Raft. «Beasts of the deep
roam it»: the sea's own beasts, roamers and drifts of Dead Man's Expanse are there as before; none were added.

**Other numbers chosen.**

- Taint: 100 a tier; +0.1 a second under way (none lying still or moored); +30 a hunter, +60 a captain, +100 the Heart.
- Marks: a hunter 8 × her multiplier; a green cask from a hunter from tier II at 20 % (10 × the multiplier), and always
  when a step of hers asks for a cask she lacks; a cask floats 5 minutes.
- Captains: experience = the usual prize × 2 × her experience multiplier (the usual one is already paid; the rest on
  top), × ¼ for a repeat. The Chosen: at least two captains inside and tier III; she earns ×1.25 marks, pays ×2.
- The week: ranked by marks banked, then the highest tier, then captains sunk; 300 / 200 / 100 marks; the three titles
  are held until the next week's turn and then taken back.
- The Heart: `ghost_ship` ⚓10, hull ×14 and guns ×1.5 over an elite; rises 900 m north of the Raft every three hours
  of the wall clock **only if a cleared captain is aboard the server** (a server just started raises nothing); stays
  30 minutes; 1 200 marks shared by each captain's part of her hull × her own multiplier (a part under 3 %: nothing;
  only those still inside are paid); guns only.
- The Raft: reach 160 m, the lines part at 260 m; a hand left on the table at cast-off is stood on.
- Blackjack: 3:2 rounded down for the house (5 marks pay 7); the day's cap is on **net** silver lost; a hand that
  would pass the cap is refused (so is a double).
- The shop (banked marks, +25 % for each one of the same bought in the week): title «Плаватель Скверны» 300 (once),
  the green pennant 500 (once), a build speed-up 60, a relic part 400, a line re-forged 150 (`reforgeLine`, as a
  port's forge does it), «Тёмный фонарь» 80 (ten minutes, marks as one tier higher; two stack to twenty minutes).
  **Not sold:** `cos.frame_abyss` — it is the Super Pass's own («Только с Суперпропуском»), selling it for marks would
  break that promise; a green wake — every trail in the table is a paid one and a new trail is new art in the
  wardrobe's tables.
- The chapter: marks 30 · 40 · 40 · 60 · 70 · 80 · 90 · 150 · 110 · 130 · 150 · 170 · 220 · 400 (1 740 in all), experience
  4–20 of the sea's units (`lumpXp`, glory past the 60th), the title «Хозяин зелёной воды» and the pennant `#9dff6a`.
  A quest is taken anywhere and handed in moored at the Raft. Giver: Mother Sedge; the dealer is Quill.
- Contracts: three a day (UTC day) by the day and the account, drawn without repeats from seven asks; their numbers
  by the best tier she had at the day's turn; 25 + 10 × best marks and 4 units each; handed in at the Raft.
- Sunk inside: she respawns in port as after any sinking, with no bubble; a bubble from elsewhere bursts at the rim.
  A lost boarding to another captain inside loses the hold as a sinking does.
- Away: the run is kept in her save; back within 5 minutes she goes on, later she is banked with no cut.
- Silver: the zone mints none. A hunter's wreck is a common ⚓10 ship's, as anywhere.

## 11. As built (step 2): the client

Nothing outside `client/` changed: the server and the shared data are as step 1 left them. A captain whose
`state.self.blight` is null or absent gets none of what follows — no block, no card, no mark, no tint.

- **The water** (`client/src/render/blight.ts`, hooked in `renderer.ts`): no `GRADES` entry and no new shader pass.
  The sea shader's own `tint` and `grade` uniforms are blended toward the fel green (`felTint`, `felGrade`, a slow
  pulse in the grade), the lighting's one soft-light wash turns green in place of the region's (`felWash`), the mist
  takes a green multiply through one new uniform of the sky shader (`fogTint`, 1·1·1 everywhere else), and the ships'
  lanterns burn `#7dff8a`. Eased over 1.5 s **by the wall's clock** (the game's step is capped: on a slow device the rim
  took many seconds). The canvas sea (no WebGL) takes the same measure: a green fill and the painted tile thinner.
  From outside: the rim as one ring stroked in seven faint passes (a haze with no edge) and a bright line.
  Unseen water lies under the fog of war's mist there as anywhere.
- **On the sea**: the Raft (`prop.way_tavern`, four `prop.bd_ghost_lamp` with green light, its name, its reach as a
  dashed ring), the casks (`prop.bt_barrels` in a green light), the hunters and the Heart lit green from under and
  over the hull (one glow sprite made once — the hulls' own paint is not re-baked), the Heart drawn 1.6× on
  `fx.curse_veins` / `fx.curse_growth`, the Chosen's turning ring and name, the mooring's five-second ring.
- **The charts**: a green disc with «Море Скверны» on the chart (over the fog of war, as her goals are) and on the far
  view; on the minimap the disc, the Raft, the Heart, the Chosen and the hunters' dots.
- **The HUD** (`client/src/ui/blight.ts BlightHud`, a block of the top stack as the spot work's pill): tier (Roman),
  the Taint's bar, the hold, the multiplier; chips for the Chosen, the Heart's clock or hull, the lantern, a cask
  aboard, and a `blight_ev` just come (3.5 s); «Пришвартоваться» within reach and «Плот» while moored with the window
  shut. Outside it shows only the Heart's clock. In a narrow upright window it takes a strip of its own above the helm
  (a phone held upright shows the «поверните телефон» lock as before).
- **«Пришвартоваться» heaves her to first.** The server refuses a mooring at more than 3 m/s and breaks one a second
  later, so the button (and the dock key off the Raft) takes her sails down and sends the order once she is under
  2 m/s (15 s at most). The server was not touched.
- **The Raft's window** (`Modal 'blight'`, opened as she moors, shut as she casts off; closing it does not cast off):
  tabs «Плот» (banked, hold, best tier, the week's title, the lantern), «Двадцать одно» (cards drawn in SVG — rank and
  suit on parchment, a green back; deal / hit / stand / double; silver or marks; the hour's hands and the day's
  silver told kindly), «Лавка» (prices of the week; the re-forge picks a piece and its line), «Кости» (the port's
  own `dice` orders; the dice window closes back into the Raft's), «Глава» (the quest, its steps, take / hand in, then
  the day's contracts), «Неделя». Its foot («Отчалить», «Закрыть») never scrolls away.
- **The chapter's card** in the campaign book after chapter 36 (`campaignBookHtml(…, blight)`), the same body as the
  Raft's page; the journal is redrawn when her chapter moves.
- **Music**: the director is given `the_abyss` for its region while she is inside (no `REGION_THEME` entry).
- **Words**: `client/src/lang/ui/blight.ts` (EN and RU); the chapter's, the shop's and the steps' words are read from
  `shared/src/data/blight.ts`.
