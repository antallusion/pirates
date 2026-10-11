// Step 9 of the generation (owner, 2026-10-11: «Очень мало городов сделано, нужно больше. Каждый 4 остров должен держать
// какой-то порт куда можно заплыть починиться что-то докупить особенно людей»; docs/29_ISLANDS.md): a harbour town on
// about every fourth island. Each sea is brought to a quarter as many ports as it has islands (the islets of the dense
// sea apart), the new towns spread as evenly as the sea allows — each where it lies farthest from every harbour before
// it — on islands of their own sea that nothing else uses (no mine, no citadel, no pirates' camp, no lighthouse), with
// a small town's market, its tavern's hands to hire and its yard to mend a hull (every port has them: town.ts
// portDwellings, ports.ts).
//
// Nothing that was is moved: the islands keep their ids, shapes and every feature, and keep no `portId` either — the
// mines, the lairs, the quests, the wonders and everything else placed from the islands stand where they always stood
// (the island a town stands on is told by portOfIsland). The ports before keep their ids and places; the new ones go
// on the end (ids `<sea>_t<n>`), their anchorages cleared on the helmsman's grid. The Abyss keeps none (docs/01 §3.10).
//
// Their names are composed (an epithet and a harbour word: «Gull Landing» — «Чаячья Пристань»); the Russian is made
// from the same parts (townNameRu), so every chart and every sentence reads them in both tongues.

import { NAV_CELL } from '../constants.ts';
import type { FactionId } from '../data/factions.ts';
import { buildMines } from '../data/mines.ts';
import { buildCitadels } from '../data/citadels.ts';
import { buildAdv } from '../data/advmap.ts';
import { Rng, hashString } from '../rng.ts';
import { islandLife } from './islandlife.ts';
import { REGIONS, REGION_IDS } from './regions.ts';
import type { RegionId } from './regions.ts';
import type { Island, Port, World } from './worldgen.ts';
import { beforePortsOf, coastAnchor, isLand, legacyOf, randomPortProfile, regionAt } from './worldgen.ts';
import { advAtGen } from './newports.ts';

/** A harbour keeps the adventure map's things out of its guns (advmap.ts), and the floating towns far out at sea. */
const ADV_HARBOUR = 1600;
const RAFT_GAP = 5500;

/** One port for this many islands of a sea. */
export const ISLES_PER_PORT = 4;
/** The seas that take no port (docs/01 §3.10: no markets behind the Maelstrom Wall). */
export const NO_TOWNS: RegionId[] = ['the_abyss'];

/** The flags of a sea's small towns (as its villages': worldgen.ts step 3). */
const FLAGS: Record<RegionId, FactionId[]> = {
  black_coast: ['crown', 'league'], gravewater: ['league', 'free'], whispering: ['brokers', 'free'], ashen_isles: ['confederacy', 'free'],
  leviathan_reach: ['harpoon', 'free'], dead_mans_expanse: ['free', 'confederacy'], drowned_crown: ['choir', 'free'], the_abyss: [],
};

// ------------------------------------------------------------------------------------------------ names

type Gender = 'm' | 'f';
/** The epithets: English, then the Russian for a masculine and a feminine harbour word. */
export const TOWN_EPITHETS: [string, string, string][] = [
  ['Gull', 'Чаячий', 'Чаячья'], ['Rope', 'Канатный', 'Канатная'], ['Tallow', 'Сальный', 'Сальная'], ['Salt', 'Соляной', 'Соляная'], ['Tar', 'Смоляной', 'Смоляная'],
  ['Anchor', 'Якорный', 'Якорная'], ['Lantern', 'Фонарный', 'Фонарная'], ['Herring', 'Селёдочный', 'Селёдочная'], ['Driftwood', 'Плавниковый', 'Плавниковая'],
  ['Copper', 'Медный', 'Медная'], ['Rum', 'Ромовый', 'Ромовая'], ['Bell', 'Колокольный', 'Колокольная'], ['Fog', 'Туманный', 'Туманная'], ['Gale', 'Штормовой', 'Штормовая'],
  ['Black', 'Чёрный', 'Чёрная'], ['Grey', 'Серый', 'Серая'], ['Mermaid', 'Русалочий', 'Русалочья'], ['Oyster', 'Устричный', 'Устричная'], ['Coral', 'Коралловый', 'Коралловая'],
  ['Whale', 'Китовый', 'Китовая'], ['Smugglers', 'Контрабандный', 'Контрабандная'], ['Crab', 'Крабовый', 'Крабовая'], ['Shell', 'Ракушечный', 'Ракушечная'],
  ['Cod', 'Тресковый', 'Тресковая'], ['Pearl', 'Жемчужный', 'Жемчужная'], ['Iron', 'Железный', 'Железная'], ['Coal', 'Угольный', 'Угольная'], ['Sail', 'Парусный', 'Парусная'],
  ['Lucky', 'Счастливый', 'Счастливая'], ['Old', 'Старый', 'Старая'], ['Last', 'Последний', 'Последняя'], ['Crooked', 'Кривой', 'Кривая'], ['Sunken', 'Затопленный', 'Затопленная'],
  ['Widows', 'Вдовий', 'Вдовья'], ['Raven', 'Вороний', 'Воронья'], ['Seal', 'Тюлений', 'Тюленья'], ['Silver', 'Серебряный', 'Серебряная'], ['Thunder', 'Грозовой', 'Грозовая'],
  ['Quiet', 'Тихий', 'Тихая'], ['Red', 'Красный', 'Красная'], ['Green', 'Зелёный', 'Зелёная'], ['Moon', 'Лунный', 'Лунная'], ['Lower', 'Нижний', 'Нижняя'],
  ['Kelp', 'Ламинарный', 'Ламинарная'], ['Brine', 'Рассольный', 'Рассольная'], ['Cannon', 'Пушечный', 'Пушечная'], ['Barrel', 'Бочарный', 'Бочарная'], ['Gold', 'Золотой', 'Золотая'],
];
/** The harbour words: English, Russian, gender. */
export const TOWN_WORDS: [string, string, Gender][] = [
  ['Landing', 'Пристань', 'f'], ['Haven', 'Гавань', 'f'], ['Wharf', 'Причал', 'm'], ['Cove', 'Бухта', 'f'], ['Moorings', 'Стоянка', 'f'], ['Pier', 'Пирс', 'm'],
  ['Port', 'Порт', 'm'], ['Backwater', 'Затон', 'm'], ['Rest', 'Приют', 'm'], ['Point', 'Мыс', 'm'], ['Creek', 'Протока', 'f'], ['Bay', 'Залив', 'm'],
  ['Watch', 'Дозор', 'm'], ['Town', 'Посад', 'm'], ['Roads', 'Рейд', 'm'], ['Tavern', 'Корчма', 'f'], ['Stockade', 'Острог', 'm'], ['Sound', 'Пролив', 'm'],
  ['Quarter', 'Слобода', 'f'], ['Reach', 'Плёс', 'm'],
];

/** A town's Russian name from its parts (null: not one of step 9's names). */
export function townNameRu(en: string): string | null {
  const sp = en.indexOf(' ');
  if (sp < 0) return null;
  const a = TOWN_EPITHETS.find((x) => x[0] === en.slice(0, sp));
  const w = TOWN_WORDS.find((x) => x[0] === en.slice(sp + 1));
  if (!a || !w) return null;
  return `${w[2] === 'f' ? a[2] : a[1]} ${w[1]}`;
}

// ------------------------------------------------------------------------------------------------ the placing

/** The islands of a sea that count (the dense sea's islets and the floating towns apart). */
export function countedIsles(world: World, rid: RegionId): Island[] {
  return world.islands.filter((is) => is.region === rid && !is.minor && !is.raft && !is.slot);
}

/** Step 9: the world with a harbour town on about every fourth island (a new world object; the one before stays as it
 *  was, and the worlds the placements are made on — legacyWorld, beforePorts — are the same as before this step). */
export function appendTowns(old: World): World {
  const seed = old.seed;
  const ports = old.ports.slice();
  const townsFrom = ports.length;
  const navGrid = old.navGrid.slice();
  const n = old.navSize;
  // What the islands already carry: a port, a mine, a citadel, a pirates' camp (a named pirate's lair), a lighthouse.
  const taken = new Set<number>();
  for (const p of old.ports) if (p.islandId >= 0) taken.add(p.islandId);
  for (const m of buildMines(old)) taken.add(m.islandId);
  for (const c of buildCitadels(old)) taken.add(c.island);
  const harbours: { x: number; y: number }[] = old.ports.map((p) => ({ x: p.x, y: p.y }));
  // Kept off, as step 8's towns were: the adventure map's things and guards out of a harbour's guns (advmap.ts keeps
  // them 1.6 km from every port), and the floating towns far out at sea (5.5 km from any harbour of the land).
  const advPts = advAtGen.get(old) ?? ((a) => [...a.objs, ...a.guards].map((o) => [o.x, o.y] as [number, number]))(buildAdv(old, false));
  const keep: [number, number, number][] = advPts.map(([x, y]) => [x, y, ADV_HARBOUR] as [number, number, number]);
  for (const p of old.ports) if (p.raft) keep.push([p.x, p.y, RAFT_GAP]);
  const clear = (x: number, y: number) => keep.every(([kx, ky, g]) => Math.abs(kx - x) > g || Math.abs(ky - y) > g || Math.hypot(kx - x, ky - y) >= g);
  const names = new Set(old.ports.map((p) => p.name));
  for (const rid of REGION_IDS) {
    if (NO_TOWNS.includes(rid) || !FLAGS[rid].length) continue;
    const isles = countedIsles(old, rid);
    const want = Math.round(isles.length / ISLES_PER_PORT) - ports.filter((p) => p.region === rid).length;
    if (want <= 0) continue;
    const rng = new Rng((hashString(`towns:${rid}`) ^ (seed * 2654435761)) >>> 0);
    const cands = isles.filter((is) => !taken.has(is.id) && !is.portId && !is.hidden && is.radius >= 150 && is.radius <= 1600 && !is.features.includes('lighthouse')
      && !islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: Math.round(is.radius), poly: is.poly, features: is.features, portId: is.portId }).some((l) => l.kind === 'pirate_camp'));
    // Each candidate's anchorage (null: no clear water off her coast) and its own die for ties.
    const anchor = new Map<number, [number, number]>();
    const die = new Map<number, number>();
    for (const is of cands) {
      const a = anchorFor(old, is, rid, clear);
      if (a) {
        anchor.set(is.id, a);
        die.set(is.id, (hashString(`town:${seed}:${is.id}`) >>> 0) / 4294967296);
      }
    }
    const pool = cands.filter((is) => anchor.has(is.id));
    // Farthest first: each new town where the nearest harbour is farthest (every sea's harbours count, the new too).
    const near = new Map<number, number>();
    for (const is of pool) {
      const [ax, ay] = anchor.get(is.id)!;
      near.set(is.id, Math.min(...harbours.map((h) => Math.hypot(h.x - ax, h.y - ay))));
    }
    let made = 0;
    for (let k = 0; k < want && pool.length; k++) {
      let best = -1, bestD = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const d = near.get(pool[i].id)! * (0.97 + 0.06 * die.get(pool[i].id)!);
        if (d > bestD) {
          bestD = d;
          best = i;
        }
      }
      const is = pool.splice(best, 1)[0];
      const [ax, ay] = anchor.get(is.id)!;
      for (const o of pool) {
        const [ox, oy] = anchor.get(o.id)!;
        near.set(o.id, Math.min(near.get(o.id)!, Math.hypot(ox - ax, oy - ay)));
      }
      harbours.push({ x: ax, y: ay });
      taken.add(is.id);
      const size: 1 | 2 = is.radius >= 900 ? 2 : 1;
      const faction = rng.pick(FLAGS[rid]);
      let name = '';
      for (let t = 0; t < 40 && (!name || names.has(name)); t++) name = `${rng.pick(TOWN_EPITHETS)[0]} ${rng.pick(TOWN_WORDS)[0]}`;
      if (names.has(name)) name = `${name} ${made + 1}`;
      names.add(name);
      ports.push({
        id: `${rid}_t${made}`, name, region: rid, faction, x: ax, y: ay, islandId: is.id, size, shipyardTier: size,
        blackMarket: faction === 'brokers' || faction === 'confederacy' || faction === 'free',
        profile: randomPortProfile(rng, is.biome, size), description: `A small ${REGIONS[rid].biome} settlement under ${faction} colours.`, key: false,
      });
      // Her anchorage is open water on the helmsman's grid (the coast's band is not a route, but her berth is).
      const gx = Math.floor(ax / NAV_CELL), gy = Math.floor(ay / NAV_CELL);
      if (gx >= 0 && gy >= 0 && gx < n && gy < n) navGrid[gy * n + gx] = 0;
      made++;
    }
  }
  const world: World = { ...old, ports, navGrid, townsFrom };
  legacyOf.set(world, legacyOf.get(old) ?? old);
  beforePortsOf.set(world, beforePortsOf.get(old) ?? old);
  return world;
}

/** A town's anchorage off an island's coast: open water of her own sea 140 m out (and 260 m out), facing her sea's
 *  middle first, then round the coast from a side of her own. */
function anchorFor(world: World, is: Island, rid: RegionId, clear: (x: number, y: number) => boolean): [number, number] | null {
  const [rcx, rcy] = REGIONS[rid].center;
  const toMiddle = Math.atan2(rcx - is.x, -(rcy - is.y));
  for (let k = 0; k < 16; k++) {
    const ang = toMiddle + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
    const [ax, ay] = coastAnchor(is.poly, is.x, is.y, ang, 140);
    const [bx, by] = coastAnchor(is.poly, is.x, is.y, ang, 260);
    if (isLand(world, ax, ay) || isLand(world, bx, by)) continue;
    if (regionAt(world, ax, ay) !== rid || !clear(ax, ay)) continue;
    return [Math.round(ax), Math.round(ay)];
  }
  return null;
}
