// Localization helper: walks the shared data tables and lists every displayable text field as a flat path
// ("goods.rum.description", "captains.corsair.abilities.0.name") → English text. The Russian table
// client/src/lang/data.ru.ts is keyed by the same paths; tests/i18n.test.ts checks it covers this list.
//   node tools/i18n-data.ts [--fields]    (prints JSON)

import * as bosses from '../shared/src/data/bosses.ts';
import * as captains from '../shared/src/data/captains.ts';
import * as crew from '../shared/src/data/crew.ts';
import * as deeds from '../shared/src/data/deeds.ts';
import * as factions from '../shared/src/data/factions.ts';
import * as goods from '../shared/src/data/goods.ts';
import * as holdings from '../shared/src/data/holdings.ts';
import * as legendary from '../shared/src/data/legendary.ts';
import * as quests from '../shared/src/data/quests.ts';
import * as seasons from '../shared/src/data/seasons.ts';
import * as shipbuild from '../shared/src/data/shipbuild.ts';
import * as ships from '../shared/src/data/ships.ts';
import * as talents from '../shared/src/data/talents.ts';
import * as regions from '../shared/src/world/regions.ts';

/** Text fields a player reads. */
export const TEXT_FIELDS = new Set(['name', 'description', 'bio', 'playstyle', 'epithet', 'archetype', 'role', 'title', 'text', 'flavor', 'mood', 'short', 'lore', 'hint', 'label', 'summary', 'blurb', 'effect', 'tagline', 'motto', 'note', 'story', 'riddle', 'announce', 'warning', 'goal', 'desc']);

export const MODULES: Record<string, Record<string, unknown>> = { bosses, captains, crew, deeds, factions, goods, holdings, legendary, quests, seasons, shipbuild, ships, talents, regions };

/** Every exported table (object or array of objects) → flat paths of its text fields. */
export function textPaths(): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new WeakSet<object>();
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 6 || v === null || typeof v !== 'object') return;
    if (seen.has(v as object)) return;
    seen.add(v as object);
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = `${path}.${k}`;
      if (typeof x === 'string') {
        if (TEXT_FIELDS.has(k) && /[a-z]/i.test(x) && x.length > 1) out[p] = x;
      } else walk(x, p, depth + 1);
    }
  };
  for (const [mod, exports] of Object.entries(MODULES)) {
    for (const [name, v] of Object.entries(exports)) {
      if (v && typeof v === 'object' && !(v instanceof Set) && !(v instanceof Map)) walk(v, `${mod}.${name}`, 0);
    }
  }
  return out;
}

if (import.meta.main) {
  const paths = textPaths();
  if (process.argv.includes('--fields')) {
    const c: Record<string, number> = {};
    for (const p of Object.keys(paths)) c[p.split('.').slice(0, 2).join('.')] = (c[p.split('.').slice(0, 2).join('.')] ?? 0) + 1;
    console.log(JSON.stringify(c, null, 1), Object.keys(paths).length);
  } else console.log(JSON.stringify(paths, null, 1));
}
