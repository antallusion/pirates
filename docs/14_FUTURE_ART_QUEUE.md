# GRAVETIDE Future Art Queue — Phase 14 Complete Art List

Status: Planning document. Owner: Art Director + Claude.  
Generated: 2026-09-29 after batch 7 (20 encounter cards, 42 building stages, 2 icons).  
Total assets needed: **~180 new painted assets** to complete Phase 14 core loop.

---

## Current State (2026-09-29)

✅ **Painted (64 assets):**
- 20 encounter cards (cards_1–10)
- 42 building stage icons (builds_1–6: weathered _2 + ruined _1 for 21 buildings)
- 2 item icons (mod_false_bulwark, storm_heart)
- 16 ships, 19 monsters, 94 portraits, 5 creatures, 46 props, 25 textures, 13 UI, 12 BG

⏳ **Unpainted (purely procedural, ~180 assets):**
- Goods (no icons; ~20 types rendered dynamically)
- Residents (no icons; ~15 types as NPC faces)
- Monuments (no icons; ~8 types)
- Perks/tattoos (no icons; ~40 types)
- Fishing-related assets (nets, rods, traps, floats, fish)
- Named pirates (bounty targets; ~10 key figures)
- Caravan UI / convoy sprites
- Outpost production icons
- Curse stages 0–3 overlays (ship hull corruption)
- Weather / storm effects (enhanced)
- Additional props (fishing docks, traps, barrels for fishing, etc.)

---

## Priority Batches (by Phase 14 dependencies)

### Batch 8: Goods family (20 icons)
**Why first:** Goods are UI-heavy, appear in inventory, caravans, trade. Procedural fallback is obvious.  
**Style:** Single icon per item on magenta, keyed mode, WoW-style painterly, 192px square.  
**List (from goods.ts):**
```
good_salt, good_spice, good_cotton, good_iron, good_wood, good_sugar, good_tea, good_silk, 
good_tobacco, good_furs, good_wine, good_cocoa, good_linen, good_hemp, good_dye, good_wool, 
good_corn, good_rum, good_glass, good_soap
```
**Grid:** 5×4 sheet (20 icons), aspect 1:1.

### Batch 9: Residents family (15 icons)
**Why next:** Residents appear in island UI, faction displays, settlement screens.  
**Style:** Portrait-like but smaller, isometric quarter-view busts on magenta, 192px square.  
**List (types from residents.ts):**
```
resident_farmer, resident_mason, resident_merchant, resident_smith, resident_scribe,
resident_priest, resident_sailor, resident_hunter, resident_cook, resident_guard,
resident_healer, resident_scholar, resident_shipwright, resident_ranger, resident_captain
```
**Grid:** 5×3 sheet, aspect 1:1.

### Batch 10: Monuments (7–8 icons)
**Why:** Decorative building-like objects that appear on islands, semi-procedural now.  
**Style:** Dioramas like buildings, isometric, keyed on magenta, 192px square.  
**List:**
```
monument_obelisk, monument_statue, monument_fountain, monument_well, monument_shrine,
monument_gallows, monument_anchor, monument_lighthouse_ruin
```
**Grid:** 2×4 sheet, aspect 1:1.

### Batch 11: Perks/tattoos (40 icons)
**Why:** Tattoo perks are entire UI subsystem; currently text-only or emoji placeholders.  
**Style:** Tattoo designs, hand-drawn on magenta, variable sizes, 128–192px.  
**Note:** Could split into smaller batches by category (combat, sailing, defense, evasion, economics).

### Batch 12: Fishing assets (12–16 icons)
**Why:** Phase 14 core mechanic; nets, rods, traps, floats, bait are currently missing.  
**Style:** Tool icons + creature catches, keyed on magenta, 192px square or variable.  
**List:**
```
icon.rod_basic, icon.rod_improved, icon.net_cast, icon.net_trawl, icon.trap_crab,
icon.trap_lobster, icon.float_cork, icon.float_bone, icon.bait_fish, icon.bait_worm,
icon.catch_fish_common, icon.catch_fish_rare, icon.catch_lobster, icon.catch_crab
```

### Batch 13: Named pirates (10 bounty targets)
**Why:** Individuality, player engagement. Currently no unique named pirate portraits.  
**Style:** Portraits similar to merchant/captain but darker, more villainous, 128px square.  
**Placeholder names:** Captain Blackscale, Siren's Reach, Bonecutter, The Rot, etc. (to be finalized from canon).

### Batch 14: Curse stages 0–3 (4 overlays)
**Why:** Visual progression of ship corruption; currently subtle/missing.  
**Style:** Hull damage, coral growth, bone protrusions, bioluminescence progression on ship sprites.  
**Technical:** May require compositing with existing ships rather than standalone sheets.

### Batch 15: Enhanced weather/storm effects (6–8 assets)
**Why:** Seas director generates random encounters; enhanced VFX sell the danger.  
**Style:** Particle systems, mist layers, lightning flashes, rain, hail effects.

### Batch 16: Caravan / convoy UI (4–6 icons)
**Why:** Caravans are new mechanic; UI needs painted assets for cargo, convoy state, escort status.  
**List:** convoy_armed, convoy_merchant, cargo_secure, cargo_breached, escort_active, escort_failed.

---

## Batches 8–16 Summary

| Batch | Family | Count | Grid | Priority |
|-------|--------|-------|------|----------|
| 8 | Goods | 20 | 5×4 | **P0** |
| 9 | Residents | 15 | 5×3 | **P0** |
| 10 | Monuments | 8 | 2×4 | **P1** |
| 11 | Perks/tattoos | 40 | Split | **P1** |
| 12 | Fishing | 16 | 4×4 or split | **P0** |
| 13 | Named pirates | 10 | 2×5 | **P2** |
| 14 | Curse overlays | 4 | N/A (overlays) | **P2** |
| 15 | Weather/FX | 8 | N/A (particle) | **P1** |
| 16 | Caravan UI | 6 | 2×3 | **P1** |

**Total: ~167 assets across 9 batches.**

---

## Generation Strategy

Each batch follows the pattern:
1. **Define prompt** using docs/06 §17.4 formula + item descriptions.
2. **Generate** via Higgsfield Nano Banana 2 Unlimited.
3. **Slice** via tools/art/slice_sheet.py.
4. **Register** in assets/manifest.json, add to sheets.json.
5. **Mark** painted flag in sheets.json, remove when done.
6. **Test** & commit.

**Prompt template for Batch 8 (Goods):**
```
Sheet of twenty game inventory icons for a dark Pirate Gothic naval MMORPG, laid out in a 5×4 grid 
of equal square cells separated by thin pure black gutters. Each icon is a single tradeable good, 
centred and filling ~75% of its cell, with a slight three-quarter view and warm lantern light from 
the upper left, bold readable silhouette at small size, rich painted detail.

Items (top to bottom, left to right):
1. Salt, a pile of coarse sea salt crystals...
2. Spice, dried cinnamon sticks and star anise...
[etc.]

Muted palette: charcoal, graphite, old rust, weathered brass, cream, dark burgundy.
Background: flat, fully saturated pure magenta #FF00FF everywhere, no gradient, NO cast shadows.
NO text, NO labels, NO watermark. Avoid: cartoon, flat vector, cel shading.
```

---

## Future Considerations

- **Art polish pass:** Existing shipped assets (cards 1–5, builds 1–3, residents 1, etc.) may need re-rendering if quality standards shift.
- **Animation:** Weather, sail ripple, water waves currently sprite-based. Consider animated sequences if engine timeline allows.
- **Regional theming:** Safe water (Gravesend) → contested → lawless should have visual progression beyond colour shift.
- **Procedural fallback:** When a painted asset is missing, the engine renders silhouette + colour. Document this for QA.

---

## Next Steps

1. **Validate priority order** with owner.
2. **Begin Batch 8 (Goods)** on next generation cycle.
3. **Maintain loop:** 1 batch every 48–72 hours on Higgsfield.
4. **Track coverage:** Update this doc as batches complete.
