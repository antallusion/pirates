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

## 8. Build order

1. Server + shared + tests (this doc §1, §3–§7): one helper.
2. Client (§2, HUD, chart, the Raft's windows, blackjack, the chapter card, lang) + browser QA: one helper, after 1.
3. Integration: merge, full type-check, the touched tests, deploy, forum news.
