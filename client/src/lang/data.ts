// The shared data tables in the player's language. The client carries its own copy of shared/src/data, so its
// display strings (names, descriptions, captains' bios, talents, quests…) can be swapped in place: the Russian
// overlay is keyed by flat paths ("goods.GOODS.rum.name", from tools/i18n-data.ts); the English originals are
// remembered so switching back restores them. Ids never change, so nothing in the game logic notices.

import * as bosses from '../../../shared/src/data/bosses.ts';
import * as captains from '../../../shared/src/data/captains.ts';
import * as crew from '../../../shared/src/data/crew.ts';
import * as deeds from '../../../shared/src/data/deeds.ts';
import * as factions from '../../../shared/src/data/factions.ts';
import * as goods from '../../../shared/src/data/goods.ts';
import * as holdings from '../../../shared/src/data/holdings.ts';
import * as legendary from '../../../shared/src/data/legendary.ts';
import * as quests from '../../../shared/src/data/quests.ts';
import * as seasons from '../../../shared/src/data/seasons.ts';
import * as shipbuild from '../../../shared/src/data/shipbuild.ts';
import * as ships from '../../../shared/src/data/ships.ts';
import * as talents from '../../../shared/src/data/talents.ts';
import * as regions from '../../../shared/src/world/regions.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { typeset } from '../i18n.ts';
import type { Lang } from '../i18n.ts';
import { DATA_RU_CORE } from './data.ru.ts';
import { DATA_RU_TALENTS } from './data.talents.ru.ts';
import { DATA_RU_ARMS } from './data.arms.ru.ts';
import { DATA_RU_BOSSES } from './server.ru.bosses.ts'; // the ten bosses (owner, 2026-10-03)

const MODULES: Record<string, Record<string, unknown>> = { bosses, captains, crew, deeds, factions, goods, holdings, legendary, quests, seasons, shipbuild, ships, talents, regions };
export const DATA_RU: Record<string, string> = { ...DATA_RU_CORE, ...DATA_RU_TALENTS, ...DATA_RU_ARMS, ...DATA_RU_BOSSES };

const originals = new Map<string, string>();
/** English display name → Russian, for names that arrive inside server sentences. */
export const NAME_RU = new Map<string, string>();
/** Russian names of common things (goods), which are written small inside a sentence: «доставить соль». */
export const COMMON_RU = new Set<string>();
/** Every English data text → Russian (descriptions that reach the client through the server, e.g. a port's). */
export const TEXT_RU = new Map<string, string>();
// The catch carries both names in its own table (not the flat overlay): the fish in a server sentence, in Russian.
for (const f of Object.values(FISH)) NAME_RU.set(f.name[0], f.name[1]);

function resolve(path: string): { obj: Record<string, unknown>; key: string } | null {
  const parts = path.split('.');
  const mod = MODULES[parts[0]];
  if (!mod) return null;
  let o: unknown = mod;
  for (let i = 1; i < parts.length - 1; i++) {
    if (o === null || typeof o !== 'object') return null;
    o = (o as Record<string, unknown>)[parts[i]];
  }
  if (o === null || typeof o !== 'object') return null;
  const key = parts[parts.length - 1];
  return typeof (o as Record<string, unknown>)[key] === 'string' ? { obj: o as Record<string, unknown>, key } : null;
}

export function applyDataLocale(lang: Lang): void {
  for (const [path, ru] of Object.entries(DATA_RU)) {
    const at = resolve(path);
    if (!at) continue;
    if (!originals.has(path)) originals.set(path, at.obj[at.key] as string);
    const en = originals.get(path)!;
    // Module namespaces are frozen, but the tables inside them are plain objects.
    try {
      at.obj[at.key] = lang === 'ru' ? typeset(ru) : en;
    } catch {
      /* a frozen table keeps its English */
    }
    if (path.endsWith('.name')) NAME_RU.set(en, ru);
    if (path.startsWith('goods.') && path.endsWith('.name')) COMMON_RU.add(ru);
    TEXT_RU.set(en, typeset(ru));
  }
}
