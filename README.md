# GRAVETIDE

**A Pirate Gothic × Deep-Sea Horror multiplayer sandbox RPG.** Strict top-down camera, a 96 km living ocean,
a physical player-and-NPC economy, tactical broadside combat, boarding, six captain Paths and deep talent trees.

> «Океан — это мир. Корабль — это персонаж. Капитан — это билд игрока».

This repository contains the complete **Game Design Foundation** (`docs/`) and a **playable Phase 1 prototype**:
an authoritative multiplayer server and a browser client, built with zero runtime dependencies.

![key art](https://d8j0ntlcm91z4.cloudfront.net/user_3F3RPvUVQudjpmbCHoHOQv37FWv/hf_20260925_220207_3f62a999-76f0-4087-b19a-e8c9f9a5d11b_min.webp)

## Quick start

Requires **Node.js ≥ 22.18** (runs TypeScript natively; uses built-in `node:sqlite`).

```bash
npm start                 # http://localhost:8080
npm test                  # 23 tests: sim, economy, server integration, real WebSocket
npm run typecheck         # needs `npm install` (typescript, @types/node) or a global tsc
npm run assets:fetch      # optional: vendor the Higgsfield art into assets/ (otherwise loaded from CDN)
```

Open the page, name your captain, choose a Path, and set sail from Saltmarrow on the Black Coast.

## Controls

| Key | Action |
|---|---|
| **W / S** | raise / lower sail (5 steps) — watch the compass no-go wedge |
| **A / D** | rudder |
| **Q / E**, **LMB** | port / starboard broadside; cursor distance sets elevation; LMB fires the side facing the cursor |
| **1 2 3** | round shot (hull) · chain shot (sails) · grapeshot (crew) |
| **Z X C / V** | captain abilities / Ultimate (level 6) |
| **B** (Shift careful, Ctrl brutal) | board a crippled ship in grappling range |
| **R** | repairs (consume planks & sailcloth) |
| **F** | dock / set sail · **P** reopen harbour |
| **M · T · I · H** | world chart · talents · ship & hold · handbook |
| wheel · Enter | zoom · chat |

## What is in the prototype

- **World**: deterministic 96 × 96 km ocean, 8 regions with a strangeness gradient, 580 islands, 24 ports, 6 currents, per-region weather (fog, rain, storms, black storms), day/night.
- **Living ocean**: ~100 NPC ships with purpose — merchants haul real cargo between real markets, pirates raid them, Crown/League/Harpoon patrols, fishers, ghost ships, bounty hunters. Level-of-detail simulation: far NPCs move abstractly along cached A* routes and can be raided off-screen, creating shortages and tavern rumours.
- **Economy**: 20 goods with weight/volume/spoilage/danger/contraband; port stocks drive prices; buying and selling walk the price curve; world events shock markets.
- **Ships**: 10 classes (sloop → man-o-war, ghost ship), wind polar model per rig, per-side gun batteries (5 gun types), 6 shipyard modules, trade-in.
- **Combat**: broadsides with spread and elevation, angle-of-impact and raking fire, hull/sails/rudder/crew/gun damage, powder explosions, fire, ramming.
- **Boarding**: conditions, melee rounds, morale, careful/standard/brutal aggression, 10–25 % cargo destroyed, plunder selection, prize fate (scuttle, release, ransom).
- **RPG**: 6 captain Paths (4 base + 2 premium side-grades) with passive, 3 actives and an Ultimate; 5 playable talent trees with keystones; XP from trade, war, boarding and exploration.
- **Law & factions**: 7 factions, reputation spillover, Wanted 0–5, port access by wanted level, customs seizures, pardons, bounty hunters, safe/contested/lawless waters, newbie protection.
- **Risk**: sinking loses cargo (part floats as salvage), some crew and a repair fee — never the ship, level or talents; League insurance.

## Documentation

| Doc | Content |
|---|---|
| [00 Canon](docs/00_CANON.md) | names, ids, cross-document decisions |
| [01 World & Economy](docs/01_GDD_WORLD_ECONOMY.md) | core loop, regions, living ocean, economy, islands, factions, wanted, weather, horror, exploration, treasure, events, system interconnections |
| [02 Ships, Combat & RPG](docs/02_GDD_SHIPS_COMBAT_RPG.md) | ships, shipbuilding, artillery, combat, boarding, captains, crew, death & loss, PvP, PvE, guilds, progression, endgame |
| [03 Talent Trees](docs/03_TALENT_TREES.md) | 10 trees, 244 talents, keystones, bridges, builds, balance |
| [04 Technical Architecture](docs/04_TECHNICAL_ARCHITECTURE.md) | authority, simulation, partitioning, NPC LOD, persistence, network, anti-cheat |
| [05 Stack & Structure](docs/05_STACK_AND_STRUCTURE.md) | technology choices and repository layout |
| [06 Art Direction](docs/06_ART_DIRECTION.md) | Pirate Gothic × Deep-Sea Horror, 80/20 rule, palette, lighting, asset pipeline |
| [07 UI/UX](docs/07_UI_UX.md) | HUD, port screens, talent tree, world map, accessibility |
| [08 Roadmap](docs/08_ROADMAP.md) | phases 1–10, MVP checklist, prototype plan |

## Art

All art is generated with **Higgsfield** (`gpt_image_2_5`, quality high; sprites with transparent backgrounds) following
`docs/06_ART_DIRECTION.md`, and listed in `assets/manifest.json`. The client loads local files first, then the Higgsfield CDN,
and falls back to procedural drawing — the game always renders.
