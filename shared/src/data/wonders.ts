// The Atlas of Sea Wonders (docs/12 P10 #8): seventy wonders about the world — glowing lagoons, a leviathan's bones on
// a shoal, stone arches, drowned cathedrals, fire springs, ice spires, coral gardens, singing rocks — the same on every
// world of a seed. The first captain to find one names it for the whole server; every ten found paint a new pennant
// colour, and the first ten bring the Compass Rose tattoo.

import type { Island } from '../world/worldgen.ts';
import type { IslandBiome, RegionId } from '../world/regions.ts';
import { Rng } from '../rng.ts';

type Tr = [string, string];

export type WonderKind = 'lagoon' | 'bones' | 'arch' | 'cathedral' | 'geyser' | 'ice' | 'coral' | 'singing';
export const WONDER_COUNT = 70;
export const WONDER_R = 600;
/** Every ten found: a pennant colour. */
export const WONDER_PENNANTS = ['#35b8a8', '#7a9ed8', '#c8a2e0', '#e0c070', '#8ed06a', '#e07a5a', '#f0f0f0'];

export const WONDER_KINDS: Record<WonderKind, { name: Tr; text: Tr; biomes: IslandBiome[] | null }> = {
  lagoon: { name: ['Glowing Lagoon', 'Светящаяся лагуна'], text: ['At night the water burns blue under the keel.', 'Ночью вода горит синим под килем.'], biomes: ['atoll', 'mangrove', 'jungle', 'temperate'] },
  bones: { name: ['Leviathan’s Bones', 'Кости левиафана'], text: ['Ribs like the vault of a church rise from the shoal.', 'Рёбра, как своды собора, поднимаются с отмели.'], biomes: ['bone', 'barren', 'saltflat', 'ice'] },
  arch: { name: ['Stone Arch', 'Каменная арка'], text: ['The sea has cut a gate through the rock; a sloop could pass under it.', 'Море прорезало в скале ворота — под ними пройдёт шлюп.'], biomes: ['temperate', 'mossy', 'barren', 'blacksand'] },
  cathedral: { name: ['Drowned Cathedral', 'Затонувший собор'], text: ['Spires under a fathom of water; a bell rings down there when the tide turns.', 'Шпили под саженью воды; на смене прилива внизу звонит колокол.'], biomes: ['ruins', 'fungal', 'crystal'] },
  geyser: { name: ['Fire Spring', 'Огненный источник'], text: ['The sea boils in a ring, and steam hides the sun.', 'Море кипит кольцом, и пар закрывает солнце.'], biomes: ['volcanic', 'blacksand'] },
  ice: { name: ['Ice Spires', 'Ледяные шпили'], text: ['Towers of blue ice, singing as they crack.', 'Башни синего льда поют, когда трескаются.'], biomes: ['ice'] },
  coral: { name: ['Coral Garden', 'Коралловый сад'], text: ['Every colour the sea keeps, a fathom below the surface.', 'Все цвета, что хранит море, — в сажени под водой.'], biomes: ['atoll', 'jungle', 'mangrove', 'crystal'] },
  singing: { name: ['Singing Rocks', 'Поющие скалы'], text: ['The wind through the holes in the rocks sounds like a choir.', 'Ветер в дырах скал звучит как хор.'], biomes: ['mossy', 'fungal', 'barren', 'temperate'] },
};
export const WONDER_KIND_IDS = Object.keys(WONDER_KINDS) as WonderKind[];

export interface WonderDef {
  id: string;
  kind: WonderKind;
  x: number;
  y: number;
  region: RegionId;
  island: number;
  /** Its default name: the kind and the island it lies off. */
  name: Tr;
}

/** Seventy wonders off the islands of a world (deterministic by its seed). */
export function placeWonders(seed: number, islands: Island[]): WonderDef[] {
  const rng = new Rng((seed ^ 0x57a73) >>> 0);
  const out: WonderDef[] = [];
  const free = islands.filter((is) => !is.portId && is.radius > 120);
  const used = new Set<number>();
  for (let tries = 0; out.length < WONDER_COUNT && tries < 5000; tries++) {
    const kind = WONDER_KIND_IDS[out.length % WONDER_KIND_IDS.length];
    const def = WONDER_KINDS[kind];
    const pool = free.filter((is) => !used.has(is.id) && (!def.biomes || def.biomes.includes(is.biome)));
    const cand = pool.length ? pool : free.filter((is) => !used.has(is.id));
    if (!cand.length) break;
    const is = cand[Math.floor(rng.float() * cand.length)];
    used.add(is.id);
    const a = rng.float() * Math.PI * 2;
    const r = is.radius + 220;
    out.push({ id: `w${out.length}`, kind, x: Math.round(is.x + Math.sin(a) * r), y: Math.round(is.y - Math.cos(a) * r), region: is.region, island: is.id, name: [`${def.name[0]} of ${is.name}`, `${def.name[1]} у острова ${is.name}`] });
  }
  return out;
}

/** A name a finder may give: 3–24 letters (Latin or Cyrillic), spaces, apostrophes, hyphens. */
export const WONDER_NAME_RE = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё' -]{2,23}$/;

export function wonderPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const k of Object.values(WONDER_KINDS)) {
    out.push(k.name, k.text);
    out.push([`${k.name[0]} of {0}`, `${k.name[1]} у острова {0}`]);
  }
  out.push(
    ['A wonder of the sea: {0}.', 'Чудо моря: {0}.'],
    ['You are the first to find it! Name it in the journal’s atlas.', 'Вы первым нашли его! Дайте ему имя в атласе журнала.'],
    ['WORLD: {0} names a wonder of the sea: {1}.', 'Вести: капитан {0} даёт имя чуду моря — {1}.'],
    ['Wonders found: {0}. A new pennant colour.', 'Чудес найдено: {0}. Новый цвет вымпела.'],
    ['Only its first finder names a wonder.', 'Имя чуду даёт только тот, кто нашёл его первым.'],
    ['That wonder is named already.', 'У этого чуда уже есть имя.'],
  );
  return out;
}
