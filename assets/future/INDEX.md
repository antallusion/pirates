# Future art (not wired into the game)

Generated with Higgsfield `gpt_image_2_5`, 2K, quality high, in the house formulas of docs/06 §17.4.
Each file is an original; bake with tools/art/process.py when it is wired in. `job` restores the prompt (`job_display`).
PNG files are gitignored (OneDrive keeps them); this index, jobs.tsv and ts.txt are enough to re-download (python fetch.py).

**403 / 403 downloaded.**

## Notes
- `__v2` files are a second roll of the same prompt (gap families only); they come out near-identical, keep either.
- Re-rolled after Higgsfield moderation ("nsfw" on blood/skeletons): talent_brd_terror, talent_brd_blooded, talent_shp_boneyard_secrets, trait_bloodthirsty.
- set_bounty_hunter: faint letter-like marks on the rolled poster; check at icon size or re-roll.
- boon_black_water is almost black by design; may need lifting when baked.
- Baking hints: square scene icons (talent, trait, deed, boon, omen, wonder, variant) → `fit: opaque:192` like `icon.ab_*`; transparent objects (set, wood, harness, service, figurehead) → `sprite:192`; bosses → monster sprite like `monster.leviathan`; holiday / happening → 16:9 cards like `card.enc_*`; textures → `tex.*` as in skin.ts.
- Code still needed before these show: a talent-node icon lookup in client/src/ui/talents.ts, and call sites for omen, wonder, holiday, happening, trait, deed, boon, set, variant, wood, harness and service art. Only boss, figurehead and texture ids are already requested by the game.

## omen — `icon.omen_<id>` (20)
Data: `shared/src/data/omens.ts OMENS`. Goes to: omen notice and journal; currently no art (audit: omen 0/10).

| id | file | job |
|---|---|---|
| `icon.omen_albatross` | omen/omen_albatross.png | `2ca36429-3d9d-48b2-995a-4e4da4c8ad73` |
| `icon.omen_albatross` | omen/omen_albatross__v2.png | `a05b3676-330d-422c-92b7-043a8519c9e4` |
| `icon.omen_whistle` | omen/omen_whistle.png | `94a88477-2e06-458a-89b3-5b4c13241189` |
| `icon.omen_whistle` | omen/omen_whistle__v2.png | `aba23217-926b-4ef9-a83e-768815677ec7` |
| `icon.omen_dolphins` | omen/omen_dolphins.png | `cdb886ad-487f-436b-8a3d-a9cffaf1d37c` |
| `icon.omen_dolphins` | omen/omen_dolphins__v2.png | `24b3c0fd-70b0-484e-8f43-27df789ea278` |
| `icon.omen_st_elmo` | omen/omen_st_elmo.png | `674835f4-ef8c-492a-a5dc-86655f5de569` |
| `icon.omen_st_elmo` | omen/omen_st_elmo__v2.png | `01409977-9b69-470d-909e-aa719342508d` |
| `icon.omen_drowned_bell` | omen/omen_drowned_bell.png | `275861c6-71ac-4660-8591-38cc7a39d6a3` |
| `icon.omen_drowned_bell` | omen/omen_drowned_bell__v2.png | `7a769f50-221a-4074-a4cb-ee4ebd272164` |
| `icon.omen_new_moon` | omen/omen_new_moon.png | `eb318c5d-a661-437d-8369-6859961209c8` |
| `icon.omen_new_moon` | omen/omen_new_moon__v2.png | `fc87418f-69fc-44f1-9d0b-678c3287dbac` |
| `icon.omen_black_cat` | omen/omen_black_cat.png | `95c977d5-de43-448b-8986-63f8a5f15bb5` |
| `icon.omen_black_cat` | omen/omen_black_cat__v2.png | `5e796639-7033-4a64-8752-1294d04f1c76` |
| `icon.omen_whale_spout` | omen/omen_whale_spout.png | `83d564e1-a37f-4ef8-8516-59c6cbdf15c6` |
| `icon.omen_whale_spout` | omen/omen_whale_spout__v2.png | `de97a33a-0753-4fb2-8a62-f7a4b605478f` |
| `icon.omen_red_sky` | omen/omen_red_sky.png | `3f108159-715c-40fb-9c10-0ced79804137` |
| `icon.omen_red_sky` | omen/omen_red_sky__v2.png | `36ed3940-ed18-483d-b53f-096c21d61659` |
| `icon.omen_coin_mast` | omen/omen_coin_mast.png | `73cfa0b3-b698-4071-99df-bf25de32d134` |
| `icon.omen_coin_mast` | omen/omen_coin_mast__v2.png | `2b0608d0-8f95-4a63-bcda-5d712b2ba577` |

## wonder — `icon.wonder_<kind>` (16)
Data: `shared/src/data/wonders.ts WONDER_KIND_IDS`. Goes to: Atlas of Wonders in the journal and map star; currently no art (0/8).

| id | file | job |
|---|---|---|
| `icon.wonder_cathedral` | wonder/wonder_cathedral.png | `c6060a17-a9bc-498a-8be5-1190f272c700` |
| `icon.wonder_cathedral` | wonder/wonder_cathedral__v2.png | `5f617854-f39c-4057-9f28-fd368d7f06ca` |
| `icon.wonder_lagoon` | wonder/wonder_lagoon.png | `6507eec7-4a07-438e-b357-bf6663baaea6` |
| `icon.wonder_lagoon` | wonder/wonder_lagoon__v2.png | `ef394197-44b7-452e-869c-332dc8d90b63` |
| `icon.wonder_bones` | wonder/wonder_bones.png | `383a1287-2370-4a02-8035-45c35e5a684a` |
| `icon.wonder_bones` | wonder/wonder_bones__v2.png | `e0c73a05-5bfc-47a5-b37a-10ec7fdafdd0` |
| `icon.wonder_arch` | wonder/wonder_arch.png | `6939b773-9504-47ab-b034-47d985e57ef7` |
| `icon.wonder_arch` | wonder/wonder_arch__v2.png | `29c1b113-d08c-480c-9111-3b1c4e6b2210` |
| `icon.wonder_geyser` | wonder/wonder_geyser.png | `0f880d82-eacc-43d8-a044-9f565cd4e9eb` |
| `icon.wonder_geyser` | wonder/wonder_geyser__v2.png | `2c007761-23ce-4d54-86bf-dd8c8f05dd93` |
| `icon.wonder_ice` | wonder/wonder_ice.png | `22f71652-11ef-445e-8174-1b8b27e21a01` |
| `icon.wonder_ice` | wonder/wonder_ice__v2.png | `7b7d2034-67c8-4943-9657-dac19ffd3c53` |
| `icon.wonder_coral` | wonder/wonder_coral.png | `61036684-5b56-4c09-a968-89ed888ead99` |
| `icon.wonder_coral` | wonder/wonder_coral__v2.png | `0680a4e2-8d22-43be-80fc-8950bfbac566` |
| `icon.wonder_singing` | wonder/wonder_singing.png | `3fc80e18-d5d4-4eb5-b098-d0ae20631bbc` |
| `icon.wonder_singing` | wonder/wonder_singing__v2.png | `7ce915ed-e7ca-48e5-bf6a-9ad655d6114a` |

## holiday — `card.holiday_<id>` (8)
Data: `shared/src/data/holidays.ts HOLIDAYS`. Goes to: holiday announcement card; currently no art (0/4).

| id | file | job |
|---|---|---|
| `card.holiday_herring_run` | holiday/holiday_herring_run.png | `5e1b2873-894d-4200-8cea-c50e2b30b2c5` |
| `card.holiday_drowned_night` | holiday/holiday_drowned_night.png | `eef805b7-ddd0-4bfe-98bf-cdfd438c938f` |
| `card.holiday_drowned_night` | holiday/holiday_drowned_night__v2.png | `2c73b500-e7cc-4c5c-839b-dcc0f4d8348b` |
| `card.holiday_powder_night` | holiday/holiday_powder_night.png | `ab23f6ac-6bc9-44fc-99a4-1ec918e0870f` |
| `card.holiday_powder_night` | holiday/holiday_powder_night__v2.png | `32e372d3-8bfc-4902-9128-b80b5e214e5e` |
| `card.holiday_league_day` | holiday/holiday_league_day.png | `d63efcd9-6b82-4fb4-9868-f4ef40c5036d` |
| `card.holiday_league_day` | holiday/holiday_league_day__v2.png | `e9408880-2d3d-4909-9043-6f611ea0dd4c` |
| `card.holiday_herring_run` | holiday/holiday_herring_run__v2.png | `aa2d4113-1f7c-42fa-9d95-e35fffa99026` |

## boss — `monster.<id>` (4)
Data: `shared/src/data/bosses.ts BOSSES`. Goes to: boss sprite at sea, client/src/render/beasts.ts (monster.${id}); top-down, head up.

| id | file | job |
|---|---|---|
| `monster.ancient_leviathan` | boss/ancient_leviathan.png | `54654538-2730-4720-be9e-d033a64acb1c` |
| `monster.ancient_leviathan` | boss/ancient_leviathan__v2.png | `ab22f3f9-dc56-4fa0-88c8-61e99bc899fe` |
| `monster.hollow_admiral` | boss/hollow_admiral.png | `63c5cca2-89b6-4cf6-993c-5ddb44950d84` |
| `monster.hollow_admiral` | boss/hollow_admiral__v2.png | `12fc82fd-140d-4131-b843-2ae6dbd701e3` |

## figurehead — `icon.fh_<id>` (4)
Data: `shared/src/data/shipbuild.ts FIGUREHEADS`. Goes to: figurehead icon at the shipyard; the last 2 of 11 missing.

| id | file | job |
|---|---|---|
| `icon.fh_dutchman` | figurehead/fh_dutchman.png | `f3bcc065-f38a-4cf0-a61c-18a8399177f8` |
| `icon.fh_dutchman` | figurehead/fh_dutchman__v2.png | `1a3dde6e-f171-4461-942c-b4a80c502e97` |
| `icon.fh_white_orca` | figurehead/fh_white_orca.png | `8aeb8955-4d6a-4ab0-8a7e-ace7f6d56485` |
| `icon.fh_white_orca` | figurehead/fh_white_orca__v2.png | `b36f215e-099b-46b8-b971-44bc4df60719` |

## texture — `tex.<id>` (4)
Data: `client/src/ui/skin.ts SKIN`. Goes to: UI skin texture, already requested by skin.ts but missing.

| id | file | job |
|---|---|---|
| `tex.parchment` | texture/parchment.png | `0f807bb1-5501-49c6-83de-7a9852f67af6` |
| `tex.parchment` | texture/parchment__v2.png | `97d9d86a-e838-448d-809d-e3712081afce` |
| `tex.panel` | texture/panel.png | `34e75fd8-0fca-4213-ad92-3b90f71944a9` |
| `tex.panel` | texture/panel__v2.png | `695440bb-42cb-4ba6-aae1-780aea60edd2` |

## talent — `icon.talent_<id>` (256)
Data: `shared/src/data/talents.ts TALENTS`. Goes to: node icon in the talent tree, client/src/ui/talents.ts (needs a lookup; nodes have no icons today).

| id | file | job |
|---|---|---|
| `icon.talent_nav_windborn` | talent/talent_nav_windborn.png | `6feb8397-23c9-4bd6-9f87-ab6cbb5205d1` |
| `icon.talent_nav_close_hauled` | talent/talent_nav_close_hauled.png | `a7686bcf-b23d-4d69-9ca8-1aefdbfd7cba` |
| `icon.talent_nav_quick_trim` | talent/talent_nav_quick_trim.png | `1e4fa9f7-8c1d-40a3-8ed4-618e55f3625d` |
| `icon.talent_nav_helmsmans_hands` | talent/talent_nav_helmsmans_hands.png | `99b0aabf-e675-459e-9de6-e439bbf44433` |
| `icon.talent_nav_running_free` | talent/talent_nav_running_free.png | `54749593-781a-4942-a92f-72f45245699d` |
| `icon.talent_nav_sea_legs` | talent/talent_nav_sea_legs.png | `9ceca853-6431-40c8-9bcb-193471a63603` |
| `icon.talent_nav_night_runner` | talent/talent_nav_night_runner.png | `091943f5-d85c-42a1-b52e-893f5800a1a0` |
| `icon.talent_nav_current_reader` | talent/talent_nav_current_reader.png | `5abc3c5c-fe13-49af-90c6-8fed6de4a2a2` |
| `icon.talent_nav_tacking_drill` | talent/talent_nav_tacking_drill.png | `fdae89d9-8095-418b-b989-e7e391c2a1d2` |
| `icon.talent_nav_weather_gauge` | talent/talent_nav_weather_gauge.png | `36b56898-d63f-4b6b-8d89-cb0785e0b4cf` |
| `icon.talent_nav_shallow_draft` | talent/talent_nav_shallow_draft.png | `b6b07282-77ca-4606-8eb1-ea22fe0094eb` |
| `icon.talent_nav_sweeps` | talent/talent_nav_sweeps.png | `2ba28bd7-fa47-4f41-9b5e-f13ddbc9bf74` |
| `icon.talent_nav_spill_the_wind` | talent/talent_nav_spill_the_wind.png | `555744e1-0949-42ab-b88f-e6bca21728db` |
| `icon.talent_nav_storm_canvas` | talent/talent_nav_storm_canvas.png | `292c127d-a195-46e5-b3c4-6a10ebddeff4` |
| `icon.talent_nav_wake_rider` | talent/talent_nav_wake_rider.png | `e329de0d-c45d-4fb3-8146-4c9b6cb9a3c4` |
| `icon.talent_nav_dead_reckoning` | talent/talent_nav_dead_reckoning.png | `60c019a4-5091-472a-84e0-ffa4f749193a` |
| `icon.talent_nav_serpentine` | talent/talent_nav_serpentine.png | `edb0279a-d76c-409a-bb56-0a1cebfa7ac4` |
| `icon.talent_nav_lee_shore` | talent/talent_nav_lee_shore.png | `4da9445e-2eea-4633-a7b0-a99cd51b86fd` |
| `icon.talent_nav_stolen_wind` | talent/talent_nav_stolen_wind.png | `30bc6a74-85ec-4ce7-b2ab-ff520fdc2053` |
| `icon.talent_nav_flying_jib` | talent/talent_nav_flying_jib.png | `3c5b3ea4-04c2-49a4-bb2f-b4a13d20692a` |
| `icon.talent_nav_anchor_pivot` | talent/talent_nav_anchor_pivot.png | `6c3b4e1e-dfa2-4b94-ac51-a9a994f93e07` |
| `icon.talent_nav_trade_winds` | talent/talent_nav_trade_winds.png | `8fa40132-d071-481e-8c61-e7e3e4c1b56b` |
| `icon.talent_nav_master_of_sail` | talent/talent_nav_master_of_sail.png | `020d6034-ffbd-4f9a-b321-f1bbccd7a658` |
| `icon.talent_nav_second_wind` | talent/talent_nav_second_wind.png | `e93a8293-2b01-42b0-8851-d7aa32e8ef14` |
| `icon.talent_nav_iron_tiller` | talent/talent_nav_iron_tiller.png | `12ef9714-8927-4b37-a882-99d983f7896d` |
| `icon.talent_nav_storm_rider` | talent/talent_nav_storm_rider.png | `70b9e829-def5-4ac3-84c3-711c48c4d4a6` |
| `icon.talent_gun_fast_hands` | talent/talent_gun_fast_hands.png | `b9d030ec-9b87-44e0-90e3-a427427db1b1` |
| `icon.talent_gun_steady_aim` | talent/talent_gun_steady_aim.png | `0331df51-b3da-4fc0-95e5-8e48aa376fc0` |
| `icon.talent_gun_range_finder` | talent/talent_gun_range_finder.png | `0ca17cbc-8746-417c-9279-6410e1ac3c09` |
| `icon.talent_gun_chain_master` | talent/talent_gun_chain_master.png | `60ae48d0-5497-4cb8-932a-2dc6309d6962` |
| `icon.talent_gun_powder_discipline` | talent/talent_gun_powder_discipline.png | `1463940d-5592-4531-9304-2a00f97e6861` |
| `icon.talent_gun_tangled_rigging` | talent/talent_gun_tangled_rigging.png | `b3efbc1d-57b8-4076-a18b-f3c1f8c26aed` |
| `icon.talent_gun_grapeshot_storm` | talent/talent_gun_grapeshot_storm.png | `0ef838d0-22bd-41a9-9754-2321dbb04628` |
| `icon.talent_gun_heated_shot` | talent/talent_gun_heated_shot.png | `b559b98a-971a-49f7-a682-10f9aae9d53c` |
| `icon.talent_gun_rolling_broadside` | talent/talent_gun_rolling_broadside.png | `88542bbb-e60d-4342-9929-7f7ca7ce8914` |
| `icon.talent_gun_crew_drill` | talent/talent_gun_crew_drill.png | `ae859690-373f-4090-8af1-6e4f94d2ece2` |
| `icon.talent_gun_swivel_guns` | talent/talent_gun_swivel_guns.png | `54d808cc-6e00-4d61-813c-5ef949235db9` |
| `icon.talent_gun_double_charge` | talent/talent_gun_double_charge.png | `fc23fa16-d817-4aae-b0f6-6764405bae86` |
| `icon.talent_gun_raking_fire` | talent/talent_gun_raking_fire.png | `d1430ed1-eed4-48f6-a085-facb281ac75b` |
| `icon.talent_gun_mast_breaker` | talent/talent_gun_mast_breaker.png | `8d63a2bc-3777-4658-a8db-22e70a99b517` |
| `icon.talent_gun_skipping_shot` | talent/talent_gun_skipping_shot.png | `f2dbd55b-f067-42d8-b2b0-f639104e4572` |
| `icon.talent_gun_waterline` | talent/talent_gun_waterline.png | `a52854ed-e04a-4b79-a184-bfce7fb03a19` |
| `icon.talent_gun_quick_swap` | talent/talent_gun_quick_swap.png | `8c6ab2c1-a02f-4ba8-afa1-f8148915f464` |
| `icon.talent_gun_chaser_master` | talent/talent_gun_chaser_master.png | `564d425d-064b-49c3-bc9e-09c08b9baba5` |
| `icon.talent_gun_spotter` | talent/talent_gun_spotter.png | `f6e43b47-36be-41f4-b2d6-12284d8e89d8` |
| `icon.talent_gun_splinter_storm` | talent/talent_gun_splinter_storm.png | `52d345c6-fe78-494a-af86-748917cd2e39` |
| `icon.talent_gun_mortar_lore` | talent/talent_gun_mortar_lore.png | `ce0bb54f-e24e-4457-9989-561298cc83a7` |
| `icon.talent_gun_thunder_broadside` | talent/talent_gun_thunder_broadside.png | `dae66b8f-12f0-4551-91a6-46e68b429b6e` |
| `icon.talent_gun_powder_mastery` | talent/talent_gun_powder_mastery.png | `8b80232d-02b0-465b-8b30-082e69efd15a` |
| `icon.talent_gun_crossfire` | talent/talent_gun_crossfire.png | `a1e1c936-c1b7-4ff0-a7e2-ee3497b1dfe3` |
| `icon.talent_gun_iron_rain` | talent/talent_gun_iron_rain.png | `b602c90d-2841-43b8-a8f4-5caf033efe1c` |
| `icon.talent_gun_red_hot_barrels` | talent/talent_gun_red_hot_barrels.png | `2a53f458-7b24-4be1-a167-943efdb2340c` |
| `icon.talent_brd_grapples` | talent/talent_brd_grapples.png | `417d244c-c36c-4e15-82d3-6edb9531099b` |
| `icon.talent_brd_careful_hands` | talent/talent_brd_careful_hands.png | `f03e87df-3562-460e-b9b0-0b1b3ac33f44` |
| `icon.talent_brd_cutlass_drill` | talent/talent_brd_cutlass_drill.png | `3e85bf0a-ab10-488d-9ea2-89ff271e03db` |
| `icon.talent_brd_boarding_nets` | talent/talent_brd_boarding_nets.png | `606e2294-2ebd-4565-a0fc-ee450db45b76` |
| `icon.talent_brd_match_speed` | talent/talent_brd_match_speed.png | `a7ea33f9-fdd7-4d87-bce7-778dd2749599` |
| `icon.talent_brd_victory_cheer` | talent/talent_brd_victory_cheer.png | `6e0dfd47-8eb0-4568-a0a7-34b98e25eb52` |
| `icon.talent_brd_pistol_volley` | talent/talent_brd_pistol_volley.png | `c41157e8-e192-4ffe-a428-7a12dbf70f76` |
| `icon.talent_brd_marines` | talent/talent_brd_marines.png | `ed72c362-e9a6-4c29-8029-ccdc7210078e` |
| `icon.talent_brd_swift_plunder` | talent/talent_brd_swift_plunder.png | `121cb298-8b1c-435c-be44-904a96d04671` |
| `icon.talent_brd_bow_and_stern` | talent/talent_brd_bow_and_stern.png | `2a2cb188-593a-489d-807f-cb72008791ce` |
| `icon.talent_brd_terror` | talent/talent_brd_terror.png | `e8d8d60d-81af-4772-89e7-bc0f63d30ddb` |
| `icon.talent_brd_boarding_axes` | talent/talent_brd_boarding_axes.png | `5e829ff9-2624-4d7e-8dc3-fb3edbe994cf` |
| `icon.talent_brd_first_over_the_rail` | talent/talent_brd_first_over_the_rail.png | `9f4d90a0-5e54-42a6-bd8f-efeb0a342515` |
| `icon.talent_brd_prize_crew` | talent/talent_brd_prize_crew.png | `3d03783b-84c7-41df-b454-ac83e57454e9` |
| `icon.talent_brd_blooded` | talent/talent_brd_blooded.png | `9046d520-bb59-4172-a9f2-1645fcbc03f1` |
| `icon.talent_brd_surrender_terms` | talent/talent_brd_surrender_terms.png | `02ae3c7e-5fb9-4798-9a8c-64ab4b655078` |
| `icon.talent_brd_iron_grip` | talent/talent_brd_iron_grip.png | `59479a1f-1b90-4221-9ef8-3413c5380d01` |
| `icon.talent_brd_hold_the_line` | talent/talent_brd_hold_the_line.png | `da6100d6-2d45-4ad0-ae57-73a6c8e62437` |
| `icon.talent_brd_jolly_boat` | talent/talent_brd_jolly_boat.png | `9139dc22-2bda-4d26-8c52-5b00d2d714fd` |
| `icon.talent_brd_hull_to_hull` | talent/talent_brd_hull_to_hull.png | `58d20956-3f4b-4783-946d-8135a2dee07b` |
| `icon.talent_brd_warlord` | talent/talent_brd_warlord.png | `24b1bc8c-75e8-41ce-bc9c-fc4504691d5a` |
| `icon.talent_brd_ransom` | talent/talent_brd_ransom.png | `87c3e0a7-ff0c-49d3-847a-c19e95ab540e` |
| `icon.talent_brd_blood_tide` | talent/talent_brd_blood_tide.png | `dbfba723-c4c5-4c8b-be9c-79bd4e2b5856` |
| `icon.talent_brd_no_quarter` | talent/talent_brd_no_quarter.png | `275e5364-d688-467e-9a55-82df65b464b0` |
| `icon.talent_cmd_steady_voice` | talent/talent_cmd_steady_voice.png | `993efeaf-87f6-42ba-8c5b-3e040ea9859d` |
| `icon.talent_cmd_fair_share` | talent/talent_cmd_fair_share.png | `e98c29d4-71a0-4ef0-bfe0-a9d7c7df77f1` |
| `icon.talent_cmd_press_gang` | talent/talent_cmd_press_gang.png | `53bb2512-5dde-4af7-949d-93bad6f87c9e` |
| `icon.talent_cmd_signal_flags` | talent/talent_cmd_signal_flags.png | `1f6f7e61-4b1d-412c-9afd-53a595569dd4` |
| `icon.talent_cmd_rally` | talent/talent_cmd_rally.png | `b343a38d-f178-445f-8b11-b820b4a1619b` |
| `icon.talent_cmd_escort_captain` | talent/talent_cmd_escort_captain.png | `28ddfc5b-5b7d-4d41-863f-4d34361cb7d0` |
| `icon.talent_cmd_sea_shanty` | talent/talent_cmd_sea_shanty.png | `d17a8028-4bf7-414f-b348-0b10b33da900` |
| `icon.talent_cmd_drill_master` | talent/talent_cmd_drill_master.png | `e17d81bc-2db6-4234-b1c5-2c0a6e67b519` |
| `icon.talent_cmd_inspiring_presence` | talent/talent_cmd_inspiring_presence.png | `c0eb8ee4-5b0a-4990-9ccf-51885bc6f779` |
| `icon.talent_cmd_iron_discipline` | talent/talent_cmd_iron_discipline.png | `8962a8dc-5c6d-46b7-8ac5-4904b2f2ed9d` |
| `icon.talent_cmd_line_of_battle` | talent/talent_cmd_line_of_battle.png | `477b87cf-f559-43f4-a26a-b735247444de` |
| `icon.talent_cmd_veteran_officers` | talent/talent_cmd_veteran_officers.png | `7edee792-7fac-48f1-94e9-eab7fd80d9e1` |
| `icon.talent_cmd_fear_and_respect` | talent/talent_cmd_fear_and_respect.png | `a799fc75-a31b-45a4-ad5b-ffa9326b2955` |
| `icon.talent_cmd_field_promotion` | talent/talent_cmd_field_promotion.png | `999dfb6e-1180-40ab-88e2-502e3c79af98` |
| `icon.talent_cmd_fleet_logistics` | talent/talent_cmd_fleet_logistics.png | `995c3c2e-7a5c-4b79-b8e2-abbde1e78400` |
| `icon.talent_cmd_concentrate_fire` | talent/talent_cmd_concentrate_fire.png | `710ca095-0845-4b0a-a981-e136374f72a0` |
| `icon.talent_cmd_screen_the_flagship` | talent/talent_cmd_screen_the_flagship.png | `67fd5840-1ccc-459f-ba74-246d536f91f8` |
| `icon.talent_cmd_cat_o_nine_tails` | talent/talent_cmd_cat_o_nine_tails.png | `8543ef3c-cfcb-46c6-a7d3-2378fb4debe0` |
| `icon.talent_cmd_black_flag` | talent/talent_cmd_black_flag.png | `768c5c61-c484-491c-aef1-33882b4da065` |
| `icon.talent_cmd_admirals_eye` | talent/talent_cmd_admirals_eye.png | `43005fa5-50dc-4f80-9914-cea6a2c43063` |
| `icon.talent_cmd_legend_at_the_helm` | talent/talent_cmd_legend_at_the_helm.png | `e160e9e0-795b-4708-9e9a-c5279ebea894` |
| `icon.talent_cmd_admirals_pennant` | talent/talent_cmd_admirals_pennant.png | `baa5679e-68ac-4662-be47-2b0984467155` |
| `icon.talent_cmd_rule_of_the_lash` | talent/talent_cmd_rule_of_the_lash.png | `29341d10-fc07-4f8f-aa84-1feebca7050e` |
| `icon.talent_trd_haggler` | talent/talent_trd_haggler.png | `d56903ae-dd86-4053-bed2-00366261ad17` |
| `icon.talent_trd_packer` | talent/talent_trd_packer.png | `a22297a1-5f6b-419c-9bbe-5cc0089d3d95` |
| `icon.talent_trd_ledger_keeper` | talent/talent_trd_ledger_keeper.png | `2a14310f-9c2b-48f4-af65-72aff583d473` |
| `icon.talent_trd_local_contacts` | talent/talent_trd_local_contacts.png | `98ee0aad-7174-4e57-a6ca-cab4bf0cb2ce` |
| `icon.talent_trd_bulk_buyer` | talent/talent_trd_bulk_buyer.png | `93dbc8f5-3269-4f2d-9ccd-0b9560655262` |
| `icon.talent_trd_market_sense` | talent/talent_trd_market_sense.png | `2e8529fc-2aee-422b-9868-c9c3cdbac250` |
| `icon.talent_cmd_officers_mess` | talent/talent_cmd_officers_mess.png | `430857d7-8ce2-4426-a974-fd4f8fc82867` |
| `icon.talent_trd_false_bottom` | talent/talent_trd_false_bottom.png | `045e7097-f651-49e0-bff7-eec947df0b1d` |
| `icon.talent_trd_contract_broker` | talent/talent_trd_contract_broker.png | `a7ab930c-1825-4a06-8e3b-2994e4a63b47` |
| `icon.talent_trd_cold_hold` | talent/talent_trd_cold_hold.png | `288bb55e-45e1-44b5-bbc0-6ef4968fea6b` |
| `icon.talent_trd_appraiser` | talent/talent_trd_appraiser.png | `1c75f802-e631-48ab-bf61-610c8471bfdf` |
| `icon.talent_trd_gilded_insurance` | talent/talent_trd_gilded_insurance.png | `d7b09abc-937a-4cc1-b664-b276d92ed87c` |
| `icon.talent_trd_convoy_rights` | talent/talent_trd_convoy_rights.png | `3ca260b1-208c-4960-95e1-5941131d8f44` |
| `icon.talent_trd_price_memory` | talent/talent_trd_price_memory.png | `a55c9c55-b7c1-4111-bf50-852ac5d8035b` |
| `icon.talent_trd_speculator` | talent/talent_trd_speculator.png | `e4929417-8a82-4260-aa0e-44e797658c88` |
| `icon.talent_trd_dockhands` | talent/talent_trd_dockhands.png | `1f069d93-146a-4c48-977a-2bd271edf123` |
| `icon.talent_trd_established_route` | talent/talent_trd_established_route.png | `1dcbe081-00f2-4294-95c7-080491e04e58` |
| `icon.talent_trd_rumor_mill` | talent/talent_trd_rumor_mill.png | `4e2587bd-bde5-46fb-8caa-bb20718c268b` |
| `icon.talent_trd_heavy_hauler` | talent/talent_trd_heavy_hauler.png | `07a69c1b-2266-40c9-bad7-7b1118f7d9c9` |
| `icon.talent_trd_league_patron` | talent/talent_trd_league_patron.png | `3dd50fa7-7392-47a5-a76c-9d18b4378b14` |
| `icon.talent_trd_monopolist` | talent/talent_trd_monopolist.png | `3aa5122e-e3dd-4b4e-9915-e0f4d8607c5e` |
| `icon.talent_trd_profit_share` | talent/talent_trd_profit_share.png | `56c54316-60b7-4806-95a3-5c8d6d54d33a` |
| `icon.talent_trd_prize_broker` | talent/talent_trd_prize_broker.png | `2881a2be-002d-4e73-a48d-925f88289679` |
| `icon.talent_trd_honest_merchant` | talent/talent_trd_honest_merchant.png | `caafc430-3a13-4e50-a343-ea14527e88b1` |
| `icon.talent_trd_counting_house` | talent/talent_trd_counting_house.png | `d247d645-ba27-44a8-b61e-046cbd2f6331` |
| `icon.talent_smg_hidden_compartments` | talent/talent_smg_hidden_compartments.png | `e8ba08e1-acc3-4741-bd7b-4782d2c5fafd` |
| `icon.talent_smg_low_profile` | talent/talent_smg_low_profile.png | `eb69c575-8880-46fe-a341-f3ec9e915420` |
| `icon.talent_smg_fence_contacts` | talent/talent_smg_fence_contacts.png | `cb5ae17c-8020-442b-98e3-bbc84d7bac3f` |
| `icon.talent_smg_dark_lanterns` | talent/talent_smg_dark_lanterns.png | `8d8ff57f-ae94-4456-9f91-5a0fa42b5317` |
| `icon.talent_smg_quick_dump` | talent/talent_smg_quick_dump.png | `deb47baa-d841-4f6c-8b1b-2e7f3038c88e` |
| `icon.talent_smg_forged_papers` | talent/talent_smg_forged_papers.png | `b4c968f1-98f6-472e-ab57-2646579daf0b` |
| `icon.talent_smg_fog_sense` | talent/talent_smg_fog_sense.png | `46ccd069-5fcb-4264-80e4-33e0872586e7` |
| `icon.talent_smg_false_colors` | talent/talent_smg_false_colors.png | `b54c3a00-1ea8-443f-a32b-911dc23f0740` |
| `icon.talent_smg_silent_running` | talent/talent_smg_silent_running.png | `c0ac4c82-6a12-4c11-bfd1-ee56431be442` |
| `icon.talent_smg_greased_palms` | talent/talent_smg_greased_palms.png | `2b72cc08-a36e-4020-a088-0a4bcf577662` |
| `icon.talent_smg_cove_knowledge` | talent/talent_smg_cove_knowledge.png | `39516842-ffb9-4ca6-83db-1daac8fa2ae2` |
| `icon.talent_smg_slip_away` | talent/talent_smg_slip_away.png | `8dfbea26-959d-49ac-bf2a-a1c32bd35af0` |
| `icon.talent_smg_clean_slate` | talent/talent_smg_clean_slate.png | `ddf64854-648c-4c09-96a5-bf7a3a36f527` |
| `icon.talent_smg_decoy_barrels` | talent/talent_smg_decoy_barrels.png | `15964a58-bedf-4603-9858-699c11416eb9` |
| `icon.talent_smg_smugglers_luck` | talent/talent_smg_smugglers_luck.png | `467b15f4-4a08-4042-88fc-882f6acab764` |
| `icon.talent_smg_night_market` | talent/talent_smg_night_market.png | `f7126a96-04d7-417a-b15c-7b9bcef20b1c` |
| `icon.talent_smg_ghost_wake` | talent/talent_smg_ghost_wake.png | `d7353401-48fd-4931-b9b1-1f8ea0d3de51` |
| `icon.talent_smg_insider` | talent/talent_smg_insider.png | `76a76685-e668-497a-a960-d4ccf45d2f88` |
| `icon.talent_smg_dangerous_goods` | talent/talent_smg_dangerous_goods.png | `aab42cd3-0efa-43ee-98b4-92d9ee65ff9e` |
| `icon.talent_smg_shadow_strike` | talent/talent_smg_shadow_strike.png | `8aeb6cb0-194a-4c22-835e-0b2c93221df6` |
| `icon.talent_smg_broker_friend` | talent/talent_smg_broker_friend.png | `d81234ef-d2b9-4fcb-b83f-420df8076325` |
| `icon.talent_smg_ghost_cargo` | talent/talent_smg_ghost_cargo.png | `1a878769-9249-4a67-88c2-131013a6f0fd` |
| `icon.talent_smg_nobodys_ship` | talent/talent_smg_nobodys_ship.png | `6a23188b-0794-43bd-95ab-9b5b8e775294` |
| `icon.talent_smg_black_ledger` | talent/talent_smg_black_ledger.png | `ac9bbb88-7ae9-43e0-9311-9e73617d9f9d` |
| `icon.talent_srv_carpenters` | talent/talent_srv_carpenters.png | `7dc3b6f1-12b5-462a-bb2f-e1e154eb9d02` |
| `icon.talent_srv_ration_master` | talent/talent_srv_ration_master.png | `65e63f30-cca5-49a8-8469-ce2adbc892c6` |
| `icon.talent_srv_bucket_brigade` | talent/talent_srv_bucket_brigade.png | `351fed96-9a9c-41fe-833d-ec7d57f76abd` |
| `icon.talent_srv_bilge_pumps` | talent/talent_srv_bilge_pumps.png | `eff741fc-38ac-467a-8c5b-c6ee19f62648` |
| `icon.talent_srv_ships_surgeon` | talent/talent_srv_ships_surgeon.png | `394e5f89-de26-48a7-b580-fe55ccbeda4d` |
| `icon.talent_srv_iron_hull` | talent/talent_srv_iron_hull.png | `0659c3ad-685f-4705-8812-9751ea5c8fd7` |
| `icon.talent_srv_lime_and_salt` | talent/talent_srv_lime_and_salt.png | `78f619b0-cc05-4944-b802-0e0aa6c23eb9` |
| `icon.talent_srv_storm_lashings` | talent/talent_srv_storm_lashings.png | `a4ad6511-a47f-4649-8a9b-fb31197e68e8` |
| `icon.talent_srv_spare_timber` | talent/talent_srv_spare_timber.png | `3e79b608-954c-488d-bac7-aa2f24f7817c` |
| `icon.talent_srv_brace` | talent/talent_srv_brace.png | `6e2f2666-fe02-4908-9f6a-328b9fc5bca4` |
| `icon.talent_srv_battle_repair` | talent/talent_srv_battle_repair.png | `dc9428f5-7fa9-44c9-a374-3f6479767a31` |
| `icon.talent_srv_damage_control` | talent/talent_srv_damage_control.png | `16e1320a-503e-46b0-b489-50509a9265f4` |
| `icon.talent_srv_hardened_crew` | talent/talent_srv_hardened_crew.png | `23168594-e4b7-4ca7-8acc-6a023046f9af` |
| `icon.talent_srv_sealed_magazine` | talent/talent_srv_sealed_magazine.png | `977aab64-52fb-49e9-91be-a79048d4ac84` |
| `icon.talent_srv_long_voyage` | talent/talent_srv_long_voyage.png | `8e35863f-7545-4b21-8aea-36ebd0c716cc` |
| `icon.talent_srv_plug_the_breach` | talent/talent_srv_plug_the_breach.png | `c9fe03ce-0b59-43ee-99e6-b40f8b849e9d` |
| `icon.talent_srv_lifeboats` | talent/talent_srv_lifeboats.png | `1e979fb0-0c86-4140-ba81-f12cff3fcdf8` |
| `icon.talent_srv_double_planking` | talent/talent_srv_double_planking.png | `f5dcf1dc-63c1-4ffe-a287-d4182433e538` |
| `icon.talent_srv_wet_decks` | talent/talent_srv_wet_decks.png | `605b10d5-ad4e-4414-acea-8c0b4d330288` |
| `icon.talent_srv_grim_endurance` | talent/talent_srv_grim_endurance.png | `183fe4ca-d06a-4944-95aa-6022adda41a8` |
| `icon.talent_srv_scuttle_charges` | talent/talent_srv_scuttle_charges.png | `c359a3dc-6225-4f28-8ca0-d7de9f6ced2f` |
| `icon.talent_srv_old_salt` | talent/talent_srv_old_salt.png | `ae843e3f-4620-42e2-9dc7-0739cd6f2e1e` |
| `icon.talent_srv_unsinkable` | talent/talent_srv_unsinkable.png | `ae5e0cc3-b7ee-4cdd-ad65-a4b1c6567c55` |
| `icon.talent_srv_patchwork_hull` | talent/talent_srv_patchwork_hull.png | `eb776632-5a74-4705-b0c5-e555d2ac9a28` |
| `icon.talent_shp_sound_timbers` | talent/talent_shp_sound_timbers.png | `e3bf1124-596c-461e-95f1-fe5eabe79921` |
| `icon.talent_shp_trim_ballast` | talent/talent_shp_trim_ballast.png | `fffd01c2-fa77-47d7-977a-376a39809bc9` |
| `icon.talent_shp_salvager` | talent/talent_shp_salvager.png | `b945e951-9ad6-429e-9e24-9481c13d1b36` |
| `icon.talent_shp_yard_credit` | talent/talent_shp_yard_credit.png | `33b74254-3dc1-48c0-a232-06e8836642df` |
| `icon.talent_shp_copper_sheathing` | talent/talent_shp_copper_sheathing.png | `4607dafd-b0e6-460f-8a04-ba39de5fceee` |
| `icon.talent_shp_master_fitter` | talent/talent_shp_master_fitter.png | `d4c3afb4-9f32-408b-a478-93da6363da97` |
| `icon.talent_shp_reinforced_bow` | talent/talent_shp_reinforced_bow.png | `657b4396-9617-4aa3-bbb8-80ca1897e860` |
| `icon.talent_shp_improved_carriages` | talent/talent_shp_improved_carriages.png | `3b895297-cc51-402b-8902-f35c754fd0b2` |
| `icon.talent_shp_sail_loft` | talent/talent_shp_sail_loft.png | `d0ff2170-6ea3-45fb-a4d4-adcdc57cc486` |
| `icon.talent_shp_field_forge` | talent/talent_shp_field_forge.png | `4ee0fec0-84e2-42c0-b2d2-d32e891cdaa8` |
| `icon.talent_shp_bulkheads` | talent/talent_shp_bulkheads.png | `d8d23a28-cc51-4a29-aa83-eacafc4649e3` |
| `icon.talent_shp_modular_refit` | talent/talent_shp_modular_refit.png | `cb611b14-494a-43bd-92d8-020079bdbdfd` |
| `icon.talent_shp_masterwork` | talent/talent_shp_masterwork.png | `a63e95dd-8bd4-476b-9252-a64db9fec063` |
| `icon.talent_shp_ironbound_masts` | talent/talent_shp_ironbound_masts.png | `ab9eb318-2120-443a-a1d7-7ebc19dd9b71` |
| `icon.talent_shp_light_frame` | talent/talent_shp_light_frame.png | `09a98d07-ce93-435d-926d-2ce79ae670e9` |
| `icon.talent_shp_iron_strapping` | talent/talent_shp_iron_strapping.png | `cca27927-1350-49c0-976e-cc939071fc81` |
| `icon.talent_shp_hold_expansion` | talent/talent_shp_hold_expansion.png | `232539c8-bcd9-44b7-9436-7e866cf67c58` |
| `icon.talent_shp_spare_rigging` | talent/talent_shp_spare_rigging.png | `c9918b18-db76-40a6-ad18-d65d26690507` |
| `icon.talent_shp_prize_refit` | talent/talent_shp_prize_refit.png | `c6b30b64-4ecf-40f3-8bc3-449ac3c62631` |
| `icon.talent_shp_legendary_keel` | talent/talent_shp_legendary_keel.png | `7d850bc5-0a66-441b-9967-baf8921fa983` |
| `icon.talent_shp_perfect_balance` | talent/talent_shp_perfect_balance.png | `3a3e7c72-36a3-46aa-b891-a8be9cc767a7` |
| `icon.talent_shp_boneyard_secrets` | talent/talent_shp_boneyard_secrets.png | `1ebc6ee3-815c-4edf-adda-ee681d0be820` |
| `icon.talent_shp_iron_coffin` | talent/talent_shp_iron_coffin.png | `7e9da8e8-09fb-4ccc-904c-50206fe08407` |
| `icon.talent_shp_overgunned` | talent/talent_shp_overgunned.png | `f50b9c16-5a72-4a43-8077-c18f516503d8` |
| `icon.talent_exp_keen_spyglass` | talent/talent_exp_keen_spyglass.png | `c43638b2-4a49-4a66-a5ba-1a71f9d5cec1` |
| `icon.talent_exp_cartographer` | talent/talent_exp_cartographer.png | `98720ca9-fd42-420d-b7d5-573328b768eb` |
| `icon.talent_exp_weather_eye` | talent/talent_exp_weather_eye.png | `62fee28e-63d6-4c45-9fca-a9cb473ca39a` |
| `icon.talent_exp_beachcomber` | talent/talent_exp_beachcomber.png | `0cee90f9-e89b-42b1-9afd-8b1d27a4ed0c` |
| `icon.talent_exp_star_reader` | talent/talent_exp_star_reader.png | `b3bbee34-b4ff-481c-af22-f92904850686` |
| `icon.talent_exp_treasure_hunter` | talent/talent_exp_treasure_hunter.png | `484505d1-cb2b-4dfc-9e07-212ea1ac7fb2` |
| `icon.talent_exp_pearl_diver` | talent/talent_exp_pearl_diver.png | `5d783b33-804e-46f3-95f7-9746e3fcde48` |
| `icon.talent_exp_rumor_hound` | talent/talent_exp_rumor_hound.png | `017ceeab-957f-43e9-aee3-d0ef731c3434` |
| `icon.talent_exp_pathfinder` | talent/talent_exp_pathfinder.png | `7cb5c3ea-a0f4-4ed3-82eb-a9b47a7e3c6d` |
| `icon.talent_exp_sounding_line` | talent/talent_exp_sounding_line.png | `06d05226-8c43-49bc-9313-9bde53f1451b` |
| `icon.talent_exp_trackers` | talent/talent_exp_trackers.png | `c1354b19-efff-4a07-be47-9afad8fb9a34` |
| `icon.talent_exp_ruin_reader` | talent/talent_exp_ruin_reader.png | `45896a6c-1e9e-4367-a73d-1c8f32ce27ec` |
| `icon.talent_exp_map_of_the_dead` | talent/talent_exp_map_of_the_dead.png | `6cbd7fd7-3f53-441c-b1ca-733ed2ccd0a9` |
| `icon.talent_exp_frontier_spirit` | talent/talent_exp_frontier_spirit.png | `bdf028b1-2928-47b9-8dd9-035e0edd3b95` |
| `icon.talent_exp_anomaly_sense` | talent/talent_exp_anomaly_sense.png | `32b53b02-c545-4c68-b28e-48a70e462998` |
| `icon.talent_exp_charted_waters` | talent/talent_exp_charted_waters.png | `380298a7-807f-4979-b7f7-bc6e3cab0402` |
| `icon.talent_exp_lucky_dig` | talent/talent_exp_lucky_dig.png | `1ed40555-d0d3-4378-9779-a37a350964a2` |
| `icon.talent_exp_expedition_stores` | talent/talent_exp_expedition_stores.png | `1de4ebea-196f-4644-8199-afe1f8feaeea` |
| `icon.talent_exp_leviathan_lore` | talent/talent_exp_leviathan_lore.png | `1896aaa9-0ee7-4699-97d8-0b03df9b8e1a` |
| `icon.talent_exp_legend_seeker` | talent/talent_exp_legend_seeker.png | `e5b1195b-2090-49a1-8d33-db3029be1b96` |
| `icon.talent_exp_eye_of_the_storm` | talent/talent_exp_eye_of_the_storm.png | `a983d1af-a322-4901-b9d3-a537b66d560f` |
| `icon.talent_exp_crows_nest` | talent/talent_exp_crows_nest.png | `8f985586-de86-47d8-868e-d9f9ef653c26` |
| `icon.talent_exp_gold_fever` | talent/talent_exp_gold_fever.png | `9e6bc7a8-c7fa-4dc9-be06-7132a1209088` |
| `icon.talent_exp_beyond_the_edge` | talent/talent_exp_beyond_the_edge.png | `4b2c19c4-eb29-4c54-bc78-9748b89a2236` |
| `icon.talent_abs_grasp_of_the_deep` | talent/talent_abs_grasp_of_the_deep.png | `0a1d89de-47fc-4861-9ef7-0e6fb55fe69c` |
| `icon.talent_abs_whispers_below` | talent/talent_abs_whispers_below.png | `aab0df14-030a-406f-b008-b2d1133bfc26` |
| `icon.talent_abs_salt_ward` | talent/talent_abs_salt_ward.png | `0d4d5711-208e-43e3-9ba2-fd46c7bf3750` |
| `icon.talent_abs_drowned_eyes` | talent/talent_abs_drowned_eyes.png | `6b4ae025-5ae1-4b4a-b946-a4c82238b102` |
| `icon.talent_abs_offering` | talent/talent_abs_offering.png | `27abb1fb-8eff-417f-8768-0a6bf9c7003c` |
| `icon.talent_abs_drowned_shot` | talent/talent_abs_drowned_shot.png | `34d1a191-a6b2-4ece-977b-60b5429dcf3f` |
| `icon.talent_abs_hymn_of_the_choir` | talent/talent_abs_hymn_of_the_choir.png | `a23dede5-7bab-4542-a9b2-c1c94744b029` |
| `icon.talent_abs_still_waters` | talent/talent_abs_still_waters.png | `8b1969f6-7e85-4b46-a4ba-41029c796e7a` |
| `icon.talent_abs_eyes_of_the_choir` | talent/talent_abs_eyes_of_the_choir.png | `20ea4a22-d8ac-4588-8444-bf68116ca7d9` |
| `icon.talent_abs_small_bargain` | talent/talent_abs_small_bargain.png | `eb10c017-2266-4337-9c41-4961535a658f` |
| `icon.talent_abs_rising_dead` | talent/talent_abs_rising_dead.png | `b028339b-bfc6-474b-90ca-085d93e1aa15` |
| `icon.talent_abs_black_water` | talent/talent_abs_black_water.png | `e985c0ae-26a4-4f7f-84a8-72d4780ef1c5` |
| `icon.talent_abs_sirens_call` | talent/talent_abs_sirens_call.png | `430c9840-9abb-451c-8795-11562d769fc9` |
| `icon.talent_abs_cursed_cargo` | talent/talent_abs_cursed_cargo.png | `4c176c2e-978a-4d97-b61d-46ad8bfe80bf` |
| `icon.talent_abs_creeping_horror` | talent/talent_abs_creeping_horror.png | `1a93a262-bd58-4629-8adb-4db58f014f4b` |
| `icon.talent_abs_krakens_embrace` | talent/talent_abs_krakens_embrace.png | `be6391ed-e943-481b-a049-657a12dcb3fa` |
| `icon.talent_abs_hollow_men` | talent/talent_abs_hollow_men.png | `2c7cd1b4-f98d-456f-bb76-9de0d027bf1c` |
| `icon.talent_abs_sea_rot` | talent/talent_abs_sea_rot.png | `40e0240e-a7a1-40a2-a028-13150fbf23d2` |
| `icon.talent_abs_abyss_step` | talent/talent_abs_abyss_step.png | `ffe07dd5-a2b0-4aa7-b00d-2caa65d4705c` |
| `icon.talent_abs_voice_of_the_choir` | talent/talent_abs_voice_of_the_choir.png | `896b2529-81f5-481b-9cca-7d23616dab8a` |
| `icon.talent_abs_pact_of_salt_and_bone` | talent/talent_abs_pact_of_salt_and_bone.png | `419a7db2-792f-40c2-97a5-51ca1189a23a` |
| `icon.talent_abs_mark_of_the_drowned_king` | talent/talent_abs_mark_of_the_drowned_king.png | `c8e00cf2-692d-44c3-854d-2f1700c9c183` |
| `icon.talent_abs_crew_of_the_drowned` | talent/talent_abs_crew_of_the_drowned.png | `ae681127-db19-4265-8d1c-53e9af153c85` |
| `icon.talent_abs_heart_of_the_abyss` | talent/talent_abs_heart_of_the_abyss.png | `c64381b0-ce3d-4d15-a33e-f37f9dde2c9b` |
| `icon.talent_brg_chain_and_grapple` | talent/talent_brg_chain_and_grapple.png | `0106c02f-fafe-45b4-998b-d07d9003856e` |
| `icon.talent_brg_storm_gunner` | talent/talent_brg_storm_gunner.png | `d90330da-80f2-41fc-814d-16eab1c14bfa` |
| `icon.talent_brg_ghost_trader` | talent/talent_brg_ghost_trader.png | `14777f87-ae6a-43bd-ab22-10b18f0730d9` |
| `icon.talent_brg_blood_and_salt` | talent/talent_brg_blood_and_salt.png | `50024258-5f7f-4254-a83f-021a8b64f9d8` |
| `icon.talent_brg_drowned_boarders` | talent/talent_brg_drowned_boarders.png | `dbe4ef0b-811a-4298-aa51-59acadd581f7` |
| `icon.talent_brg_flagship_yard` | talent/talent_brg_flagship_yard.png | `c5461669-809d-4f1d-a555-f89c8bec94c4` |
| `icon.talent_brg_exotic_goods` | talent/talent_brg_exotic_goods.png | `ef15b347-ed5f-46d6-959f-311bc8a62676` |
| `icon.talent_brg_night_raider` | talent/talent_brg_night_raider.png | `d1446f54-e7ea-407d-8557-f9dc88411bcf` |
| `icon.talent_brg_tide_whisperer` | talent/talent_brg_tide_whisperer.png | `ee3627dc-d5cf-41be-8255-e0925edc7560` |
| `icon.talent_brg_salvage_king` | talent/talent_brg_salvage_king.png | `c7cb5ea8-3f01-48ee-80d7-5226064751cb` |
| `icon.talent_brg_grand_battery` | talent/talent_brg_grand_battery.png | `90d07fc0-48b1-47c6-ba70-da2ce47cd1b5` |
| `icon.talent_brg_iron_will` | talent/talent_brg_iron_will.png | `84650823-425e-4090-bd3f-5397ab69bf8d` |

## trait — `icon.trait_<id>` (19)
Data: `shared/src/data/crew.ts TRAITS`. Goes to: crew / officer trait badge.

| id | file | job |
|---|---|---|
| `icon.trait_deep_touched` | trait/trait_deep_touched.png | `e9b19217-1062-4b59-a827-4a716bc8d64c` |
| `icon.trait_sharp_eyed` | trait/trait_sharp_eyed.png | `7420add9-2ef1-4af9-9f8d-62c48012e1bd` |
| `icon.trait_storm_veteran` | trait/trait_storm_veteran.png | `48c523b0-55a7-4257-b4e5-d881f8348b57` |
| `icon.trait_quick_hands` | trait/trait_quick_hands.png | `4a39da1d-06e0-4915-ab22-41239403b86d` |
| `icon.trait_lucky` | trait/trait_lucky.png | `de2b7306-d237-4888-93f2-9cb3ee903746` |
| `icon.trait_devout` | trait/trait_devout.png | `bb4644b4-b9b8-4ede-b581-4ba5e9ef8df2` |
| `icon.trait_crown_sailor` | trait/trait_crown_sailor.png | `bfefa9a4-5a7b-48b7-afe5-314aae673ef4` |
| `icon.trait_bloodthirsty` | trait/trait_bloodthirsty.png | `8a1d37af-e206-4a9c-83dc-d3cb8c720618` |
| `icon.trait_drunkard` | trait/trait_drunkard.png | `918ffcb0-5db1-4c39-8942-22a6b627af9a` |
| `icon.trait_coward` | trait/trait_coward.png | `93ac4889-3d03-444c-bed1-c79deddbb315` |
| `icon.trait_greedy` | trait/trait_greedy.png | `5b5a4b49-a74b-467b-a074-a7263ca81891` |
| `icon.trait_superstitious` | trait/trait_superstitious.png | `8b0e9bd9-e5aa-4983-9ba4-0e957248c45b` |
| `icon.trait_ex_convict` | trait/trait_ex_convict.png | `b245b201-e31d-4c0e-a1f7-c212882c4a8b` |
| `icon.trait_cruel` | trait/trait_cruel.png | `8c33fa34-0dd0-49a5-a15a-00aaa64d2970` |
| `icon.trait_pressed` | trait/trait_pressed.png | `4dba689b-72fe-4d54-9721-dc69231e2258` |
| `icon.trait_former_enemy` | trait/trait_former_enemy.png | `2d558ffd-81cd-4f5f-a49f-9aac18db03da` |
| `icon.trait_one_legged` | trait/trait_one_legged.png | `7170e8f2-05c9-494a-8282-23c7b072c874` |
| `icon.trait_seasoned` | trait/trait_seasoned.png | `06a334ed-d853-4fa4-affd-ee04429de410` |
| `icon.trait_fog_born` | trait/trait_fog_born.png | `37242e04-ffd8-44b4-9ad4-71e47536d6bf` |

## deed — `icon.deed_<id>` (24)
Data: `shared/src/data/deeds.ts DEEDS`. Goes to: deed (achievement) badge.

| id | file | job |
|---|---|---|
| `icon.deed_first_prize` | deed/deed_first_prize.png | `ad8d1582-a8cf-44af-9c17-397c723a2a92` |
| `icon.deed_hundred_wrecks` | deed/deed_hundred_wrecks.png | `09889824-811f-4d48-b288-4a8f6f06b093` |
| `icon.deed_ship_of_the_line` | deed/deed_ship_of_the_line.png | `a6f324e2-89d2-40d2-807f-269abeba424c` |
| `icon.deed_convoy_breaker` | deed/deed_convoy_breaker.png | `33abcdd6-f2e7-4d81-bd25-c031d047ed17` |
| `icon.deed_captain_killer` | deed/deed_captain_killer.png | `b3de3721-da61-4fcf-83f3-8410be47302c` |
| `icon.deed_hundred_thousand` | deed/deed_hundred_thousand.png | `bf9f84ab-1546-4fff-8b49-034b93c6795d` |
| `icon.deed_grand_circuit` | deed/deed_grand_circuit.png | `03965498-94b2-4052-814c-0c5ffce3b11f` |
| `icon.deed_fog_courier` | deed/deed_fog_courier.png | `96b7f310-052b-464d-861d-442d01a43be8` |
| `icon.deed_ledger_partner` | deed/deed_ledger_partner.png | `08d4020b-ee7e-4db8-bcc9-fdb8a700cd04` |
| `icon.deed_black_flag_oath` | deed/deed_black_flag_oath.png | `b85802bb-bb1c-450a-a210-2d9e7b37d319` |
| `icon.deed_whispering_chart` | deed/deed_whispering_chart.png | `2f48a00a-ae43-4cb2-8446-4ba359c78029` |
| `icon.deed_expanse_crossing` | deed/deed_expanse_crossing.png | `ce8dfd9c-1665-4a14-8069-442426953055` |
| `icon.deed_ice_edge` | deed/deed_ice_edge.png | `9141cce8-2f1a-488c-a3f1-46d10090b0e9` |
| `icon.deed_legendary_hoard` | deed/deed_legendary_hoard.png | `925021c8-01ab-44cc-a6d9-1c2784e42e2b` |
| `icon.deed_leviathan_slain` | deed/deed_leviathan_slain.png | `bf6991d1-22fa-4a66-88b2-9eb948f83c60` |
| `icon.deed_harpoon_contracts` | deed/deed_harpoon_contracts.png | `a5f21f99-be94-4e33-9e5c-4139a9687289` |
| `icon.deed_first_descent` | deed/deed_first_descent.png | `f50689a3-5915-432f-99e1-b96979251d40` |
| `icon.deed_black_storm` | deed/deed_black_storm.png | `3f121dff-5ffb-4d98-90ca-54cd2fe289f8` |
| `icon.deed_last_plank` | deed/deed_last_plank.png | `f328bab2-0d15-4fbb-811d-1b4d8353eeb7` |
| `icon.deed_mutiny` | deed/deed_mutiny.png | `837c2d3d-6e2e-4df1-ac09-a46465654b99` |
| `icon.deed_fleet_victory` | deed/deed_fleet_victory.png | `253f024f-7c3f-4880-ba1a-76ceff6623c7` |
| `icon.deed_masterwork_ship` | deed/deed_masterwork_ship.png | `577118c3-5e0c-4230-897a-02ce8c8aa2ee` |
| `icon.deed_wanted_legend` | deed/deed_wanted_legend.png | `e2fc24fd-2dd5-47c8-822b-05b276b20ee2` |
| `icon.deed_legend_quest` | deed/deed_legend_quest.png | `9abc341d-1d0f-4a93-a636-a92222143307` |

## boon — `icon.boon_<id>` (10)
Data: `shared/src/data/descent.ts BOONS`. Goes to: boon choice in the Descent.

| id | file | job |
|---|---|---|
| `icon.boon_salt_fury` | boon/boon_salt_fury.png | `9d1d211e-ab87-4131-8206-e3abf3582f33` |
| `icon.boon_swift_current` | boon/boon_swift_current.png | `a62fbbae-c3d3-4477-a514-6ce8bebc34d9` |
| `icon.boon_iron_skin` | boon/boon_iron_skin.png | `6757ee2c-2d61-4927-be8f-c1e67b034594` |
| `icon.boon_quick_hands` | boon/boon_quick_hands.png | `666ad425-4fe8-4acb-9e78-c263c0f2911e` |
| `icon.boon_tide_mending` | boon/boon_tide_mending.png | `0497a496-5142-4dd9-bf28-40e9ca4ee01c` |
| `icon.boon_lantern` | boon/boon_lantern.png | `a74ffefa-e865-4201-acd5-2d60ac4a7c97` |
| `icon.boon_blood_in_water` | boon/boon_blood_in_water.png | `877741ac-796a-407e-88c8-9f8bbcabc307` |
| `icon.boon_drowned_hands` | boon/boon_drowned_hands.png | `d2d8c6a3-3d60-439e-9ce7-90779cb3d565` |
| `icon.boon_black_water` | boon/boon_black_water.png | `54cd42dc-5848-44fd-b4fc-1c32074d901c` |
| `icon.boon_undertow_curse` | boon/boon_undertow_curse.png | `5b688bb1-62da-4905-acd8-61fe2381a896` |

## happening — `card.happen_<kind>` (10)
Data: `shared/src/data/happenings.ts HAPPENING_KINDS`. Goes to: world-event announcement card.

| id | file | job |
|---|---|---|
| `card.happen_silver_convoy` | happening/happen_silver_convoy.png | `f9b4b743-cd91-41c4-a4cc-eeadce28f9a6` |
| `card.happen_brethren` | happening/happen_brethren.png | `4e141d18-328b-42dd-8470-8c854dee6434` |
| `card.happen_star` | happening/happen_star.png | `c4d51423-c65d-4710-abac-da038ec42670` |
| `card.happen_eclipse` | happening/happen_eclipse.png | `f5c8d3c7-596c-43e3-816c-fedcb98d18c2` |
| `card.happen_lost_fleet` | happening/happen_lost_fleet.png | `8df9e5b8-cacc-4156-a674-ac27ec333ebe` |
| `card.happen_festival` | happening/happen_festival.png | `09b10377-9caf-42a8-95fd-b3df61bf49b0` |
| `card.happen_herring_run` | happening/happen_herring_run.png | `8f998c47-36c5-4b17-9aa5-ec2d73052f2d` |
| `card.happen_red_tide` | happening/happen_red_tide.png | `bfd384c8-0e2c-4136-b088-7b2c41b81607` |
| `card.happen_orca_migration` | happening/happen_orca_migration.png | `5be82359-0438-468c-acc5-b2854faea6bc` |
| `card.happen_white_orca` | happening/happen_white_orca.png | `fe4db0df-ad30-4128-a7dc-9750f486e05b` |

## set — `icon.set_<id>` (8)
Data: `shared/src/data/items.ts SETS`. Goes to: item-set emblem in the gear window.

| id | file | job |
|---|---|---|
| `icon.set_whaler` | set/set_whaler.png | `1bd170a2-4060-4388-96f3-29eb0076c4ad` |
| `icon.set_bounty_hunter` | set/set_bounty_hunter.png | `920a35d3-611e-4c87-b146-15ac15bd11bf` |
| `icon.set_fisher` | set/set_fisher.png | `40fd6f0d-75e3-4782-8f60-cdd2f4acd91b` |
| `icon.set_league` | set/set_league.png | `3eb5ac2e-bf48-483f-b9c4-634997943e06` |
| `icon.set_sea_terror` | set/set_sea_terror.png | `4688b747-5c29-433b-8f8c-81e22c4babbd` |
| `icon.set_admiralty` | set/set_admiralty.png | `e249aebf-450c-4c50-898a-896dbdc9e5bc` |
| `icon.set_drowned` | set/set_drowned.png | `dd1c4040-fec7-4baf-b38f-b7ea6db59d16` |
| `icon.set_storm` | set/set_storm.png | `27e785d4-2eea-43f7-90f9-7e964ad16440` |

## variant — `icon.variant_<id>` (8)
Data: `shared/src/data/shipbuild.ts VARIANTS`. Goes to: hull variant choice at the shipyard.

| id | file | job |
|---|---|---|
| `icon.variant_roomy_hold` | variant/variant_roomy_hold.png | `5bc95a69-825c-43ef-bfc5-081f6ec2266a` |
| `icon.variant_stiff_frame` | variant/variant_stiff_frame.png | `9ad41650-3eea-4548-84db-4388e299f571` |
| `icon.variant_light_rig` | variant/variant_light_rig.png | `e38cc4dd-f43b-46f4-9891-e72c6bf75b10` |
| `icon.variant_gun_deck` | variant/variant_gun_deck.png | `7dc6f796-75ac-4efc-b59b-6804d8ec1a84` |
| `icon.variant_fast_lines` | variant/variant_fast_lines.png | `f9cb6a8c-d2f8-478e-9b0d-972e03d59cfb` |
| `icon.variant_thick_skin` | variant/variant_thick_skin.png | `51b4fd8c-8380-40b4-abf2-ca8a373f830c` |
| `icon.variant_wide_beam` | variant/variant_wide_beam.png | `2dbedfb7-de04-4964-b4f6-d0581a172a2a` |
| `icon.variant_sharp_helm` | variant/variant_sharp_helm.png | `53e2868e-a2eb-4922-8ad8-f4f9c32ee0e3` |

## wood — `icon.wood_<id>` (6)
Data: `shared/src/data/shipbuild.ts WOODS`. Goes to: shipbuilding timber choice.

| id | file | job |
|---|---|---|
| `icon.wood_pine` | wood/wood_pine.png | `c58e9173-c77c-4f39-96f4-e6348a7caa30` |
| `icon.wood_oak` | wood/wood_oak.png | `12cefc24-b8f4-4ba8-8c67-b0de3ea6f268` |
| `icon.wood_teak` | wood/wood_teak.png | `6d6b421f-d3a5-4b7c-a377-05e8da1da7d7` |
| `icon.wood_black_oak` | wood/wood_black_oak.png | `70d1cd5a-a90b-4a34-b837-a0df4daa09b2` |
| `icon.wood_ironwood` | wood/wood_ironwood.png | `d8bba0b7-cf91-4e5d-b281-63f8b467e9e8` |
| `icon.wood_cursed_wood` | wood/wood_cursed_wood.png | `3ff17f00-2937-498a-b296-25500f967a77` |

## harness — `icon.harness_<id>` (3)
Data: `shared/src/data/companions.ts HARNESSES`. Goes to: orca companion harness.

| id | file | job |
|---|---|---|
| `icon.harness_leather` | harness/harness_leather.png | `23feadfb-27dc-416c-980f-7f63f1118579` |
| `icon.harness_iron` | harness/harness_iron.png | `76b3649b-66d7-4944-aa69-b22599abaa88` |
| `icon.harness_bell` | harness/harness_bell.png | `ca8aa0d4-de94-40e6-877a-a6a807ddefa3` |

## service — `icon.service_<id>` (3)
Data: `shared/src/data/marque.ts SERVICES`. Goes to: letter-of-marque service emblem.

| id | file | job |
|---|---|---|
| `icon.service_crown` | service/service_crown.png | `d4c020f9-b860-4b64-a5cf-68e3a2a5eb90` |
| `icon.service_league` | service/service_league.png | `578939df-64db-449a-b44b-c8214560c734` |
| `icon.service_confederacy` | service/service_confederacy.png | `73d1cf7e-4f2b-42ca-8a20-a8a251f3b332` |
