// The campaign's plan (docs/36): thirty-six chapters through the seas in the order of their levels, the number of quests
// in each (720 in all), their sea and their mentor's port. The quests' levels come from the pacing (pacing.ts): a
// captain who does only the campaign stands at the level of each quest as she reaches it, and at the 60th at its end.

import type { RegionId } from '../../world/regions.ts';

export interface ChapterPlan {
  n: number;
  size: number;
  region: RegionId;
  hub: string;
}

const P = (n: number, size: number, region: RegionId, hub: string): ChapterPlan => ({ n, size, region, hub });

export const PLAN: ChapterPlan[] = [
  // Act I — Fog over Saltmarrow (the Black Coast, ⚓1–2)
  P(1, 22, 'black_coast', 'saltmarrow'),
  P(2, 18, 'black_coast', 'gravesend'),
  P(3, 19, 'black_coast', 'gallowsmouth'),
  // Act II — The Merchants' Road (Gravewater, the Whispering Archipelago, Dead Man's Expanse, ⚓3–4)
  P(4, 17, 'gravewater', 'tidewrack'),
  P(5, 17, 'whispering', 'hushwater'),
  P(6, 18, 'gravewater', 'hollowmere'),
  P(7, 17, 'gravewater', 'copperhook'),
  P(8, 17, 'whispering', 'fogmouth'),
  P(9, 17, 'dead_mans_expanse', 'wrecktide'),
  P(10, 17, 'gravewater', 'sugarloaf'),
  // Act III — The Northern Waters (⚓5–6)
  P(11, 21, 'whispering', 'widows_wick'),
  P(12, 21, 'leviathan_reach', 'harpoon_rest'),
  P(13, 21, 'leviathan_reach', 'frostgate'),
  P(14, 21, 'dead_mans_expanse', 'lotus_anchorage'),
  P(15, 22, 'leviathan_reach', 'sealhold'),
  P(16, 22, 'leviathan_reach', 'frostgate'),
  P(17, 22, 'dead_mans_expanse', 'saltglass'),
  P(18, 22, 'whispering', 'mirrorfen'),
  // Act IV — Ash and the Code (the Ashen Isles, ⚓7)
  P(19, 21, 'ashen_isles', 'cinderhold'),
  P(20, 21, 'ashen_isles', 'slagport'),
  P(21, 21, 'dead_mans_expanse', 'wreckhold'),
  P(22, 21, 'ashen_isles', 'brimstone_bay'),
  P(23, 21, 'drowned_crown', 'tidehallow'),
  // Act V — The Drowned Crown (⚓8–9)
  P(24, 22, 'drowned_crown', 'saint_maw'),
  P(25, 22, 'drowned_crown', 'steeplewater'),
  P(26, 22, 'drowned_crown', 'saint_maw'),
  P(27, 22, 'ashen_isles', 'brimstone_bay'),
  P(28, 21, 'drowned_crown', 'last_light'),
  P(29, 20, 'drowned_crown', 'crownfall'),
  P(30, 20, 'drowned_crown', 'marrowdeep'),
  // Act VI — Beyond the Wall (the Abyss, ⚓9–10)
  P(31, 20, 'the_abyss', 'last_light'),
  P(32, 19, 'drowned_crown', 'crownfall'),
  P(33, 19, 'the_abyss', 'marrowdeep'),
  P(34, 19, 'the_abyss', 'last_light'),
  P(35, 19, 'the_abyss', 'marrowdeep'),
  P(36, 19, 'the_abyss', 'last_light'),
];

export const CAMPAIGN_SIZE = PLAN.reduce((a, c) => a + c.size, 0);

/** The first chapter of the Abyss: from it on the Maelstrom Wall lets her through (abyss.ts abyssCleared). */
export const WALL_CHAPTER = 31;
