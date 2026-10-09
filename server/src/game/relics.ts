// docs/19 E12 on the server: the relics, HoMM3's combination artifacts (shared/src/data/artifacts.ts RELICS). Their
// parts are artifacts in the captain's slots; worn all together they assemble the relic — its great gift on top, and
// its parts' slots its own (HoMM3's rule): artTotals reckons it, the hero window shows it. Here:
//  - relicPartDrop: a chance at a part (one she lacks first) — the seals' mythic depths won in time (seals.ts), the
//    Abyss's tiers by each one's share (abyssraid.ts), the Choir's invasions beaten (invasions.ts), and the citadels
//    (docs/19 E4–E8: their helper calls it, see below);
//  - relicCheck: after her gear changed, a relic newly assembled is told (the first time, the sea's chronicle too);
//  - /relic, the tester's console.
// Every roll here is on this system's own Rng.

import { ARTIFACTS, RELICS, RELIC_IDS, fullRelics, makeArtifact } from '../../../shared/src/data/artifacts.ts';
import type { RelicId } from '../../../shared/src/data/artifacts.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Game } from './Game.ts';
import { artifactFind, applyHero } from './hero.ts';
import { applyWorn } from './gear.ts';
import type { PlayerSession, Profile } from './player.ts';
import { chronicle } from './renown.ts';

/** What a captain keeps of her relics: those assembled now, those she ever assembled, the parts the drops gave her. */
export interface RelicRec {
  on: RelicId[];
  made: RelicId[];
  drops: number;
}

/** Where a part comes from (the drop's own words in her log). */
export type RelicSource = 'seal' | 'abyss' | 'invasion' | 'citadel' | 'contract' | 'admin';

/** A part she lacks weighs this many times one she has (a relic's own part over a common artifact that is a part). */
export const PART_WEIGHT = { lackOnly: 4, lackCommon: 1, held: 0.25 };

const rngs = new WeakMap<Game, Rng>();
function rr(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x7e11c5a3)));
  return r;
}

export function relicRec(p: Profile): RelicRec {
  const r = (p.relics ??= { on: [], made: [], drops: 0 });
  r.on = (r.on ?? []).filter((x) => RELIC_IDS.includes(x));
  r.made = (r.made ?? []).filter((x) => RELIC_IDS.includes(x));
  r.drops = Math.max(0, Math.floor(r.drops ?? 0));
  return r;
}

const wornOf = (p: Profile): Item[] => Object.values(p.captainGear ?? {}).filter((x): x is Item => !!x);

/** The parts she has: worn, and in her locker. */
export function partsHeld(p: Profile): { worn: Set<string>; locker: Set<string> } {
  const worn = new Set(wornOf(p).map((it) => it.art).filter((x): x is string => !!x && !!ARTIFACTS[x]?.part));
  const locker = new Set((p.stash ?? []).map((it) => it.art).filter((x): x is string => !!x && !!ARTIFACTS[x]?.part));
  return { worn, locker };
}

/** The part a drop gives her: the ones she lacks first, a relic's own parts over the common artifacts among them. */
export function pickPart(rng: Rng, p: Profile, only?: RelicId): string {
  const { worn, locker } = partsHeld(p);
  const list: [string, number][] = [];
  for (const r of only ? [only] : RELIC_IDS) for (const id of RELICS[r].parts) {
    const has = worn.has(id) || locker.has(id);
    list.push([id, has ? PART_WEIGHT.held : ARTIFACTS[id].only ? PART_WEIGHT.lackOnly : PART_WEIGHT.lackCommon]);
  }
  return rng.weighted(list);
}

/**
 * FOR THE CITADELS (docs/19 E4–E8; the citadels' helper calls this where a citadel's spoils are shared — a storm won,
 * a week held): a chance at one relic part for a captain. On a hit the part (one she lacks first, PART_WEIGHT) goes
 * into her locker with a toast naming its relic and how many of its parts she holds; returns its id, or null (no luck,
 * or her locker full — the part is left in the water as any find). `source` is only for the ledger and the log.
 */
export function relicPartDrop(game: Game, s: PlayerSession, source: RelicSource, chance: number): string | null {
  const p = s.profile;
  if (!p || !s.ship) return null;
  const rng = rr(game);
  if (chance < 1 && !rng.chance(Math.max(0, chance))) return null;
  const id = pickPart(rng, p);
  const it = artifactFind(game, s, 'boss', id);
  if (!it) return null;
  const rec = relicRec(p);
  rec.drops++;
  const r = ARTIFACTS[id].part!;
  const { worn, locker } = partsHeld(p);
  const have = RELICS[r].parts.filter((x) => worn.has(x) || locker.has(x)).length;
  game.toastShip(s.ship, `A part of the ${RELICS[r].name[0]}: ${ARTIFACTS[id].name[0]} (${have}/${RELICS[r].parts.length}).`, 'gold');
  game.log(`[relic] ${s.name} ${source}: ${id}`);
  return id;
}

/** After her gear changed (Game's equip and unequip): a relic newly assembled is told; one taken apart, too. */
export function relicCheck(game: Game, s: PlayerSession): void {
  const p = s.profile;
  if (!p) return;
  const rec = relicRec(p);
  const now = fullRelics(wornOf(p));
  for (const r of now) {
    if (rec.on.includes(r)) continue;
    game.toastShip(s.ship ?? null, `The ${RELICS[r].name[0]} is whole: its parts are one relic.`, 'gold');
    if (!rec.made.includes(r)) {
      rec.made.push(r);
      chronicle(game, `${s.name} assembles the ${RELICS[r].name[0]}.`);
    }
  }
  for (const r of rec.on) if (!now.includes(r)) game.toastShip(s.ship ?? null, `The ${RELICS[r].name[0]} comes apart into its parts.`, 'info');
  rec.on = now;
}

/** `/relic [id|parts id|all|drop [N]|clear]`: a relic's parts into the locker (or worn at once), a drop rolled. */
export function adminRelic(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  const rec = relicRec(p);
  const a = args[0];
  const ids = RELIC_IDS.join('|');
  if (!a) {
    const { worn, locker } = partsHeld(p);
    return `Relic parts: ${worn.size} worn, ${locker.size} in the locker, ${rec.drops} dropped; relics assembled: ${rec.on.length}.`;
  }
  if (a === 'drop') {
    const n = Math.max(1, Math.min(20, Math.round(Number(args[1] ?? 1)) || 1));
    const got: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = relicPartDrop(game, s, 'admin', 1);
      if (id) got.push(id);
    }
    return `Parts dropped: ${got.length} of ${n}.`;
  }
  if (a === 'clear') {
    for (const k of Object.keys(p.captainGear) as (keyof typeof p.captainGear)[]) if (relicOfItem(p.captainGear[k])) delete p.captainGear[k];
    p.stash = p.stash.filter((it) => !relicOfItem(it));
    p.relics = { on: [], made: [], drops: 0 };
    applyWorn(game, s);
    applyHero(game, s);
    return 'Every relic part is gone.';
  }
  if (a === 'all') {
    for (const r of RELIC_IDS) for (const id of RELICS[r].parts) artifactFind(game, s, 'boss', id);
    return `The locker holds ${p.stash.length}.`;
  }
  const parts = a === 'parts';
  const r = (parts ? args[1] : a) as RelicId;
  if (!RELICS[r]) return `Usage: /relic [${ids}|parts id|all|drop [N]|clear]`;
  if (parts) {
    for (const id of RELICS[r].parts) artifactFind(game, s, 'boss', id);
    return `The ${RELICS[r].name[0]}: its parts are in the locker.`;
  }
  // Worn at once: each part into its slot (what was there goes into the locker).
  for (const id of RELICS[r].parts) {
    const d = ARTIFACTS[id];
    const was = p.captainGear[d.slot];
    if (was) p.stash.push(was);
    p.captainGear[d.slot] = makeArtifact(id, p.itemSeq++);
  }
  applyWorn(game, s);
  applyHero(game, s);
  relicCheck(game, s);
  game.pushSelf(s, true);
  return `The ${RELICS[r].name[0]} is worn.`;
}

const relicOfItem = (it: Item | undefined): boolean => !!it?.art && !!ARTIFACTS[it.art]?.part;
