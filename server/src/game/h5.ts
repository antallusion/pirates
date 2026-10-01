// docs/17 H5: the Heroes' sections wired to one another. The adventure map (H4) hands its hooks to the hero (H2): a
// chest on the map may hold an artifact for her this week, a beaten guard's chest one now and then, an altar teaches
// a primary skill of the hero's (HoMM3's Marletto Tower and the rest), a well fills her will. (The island's guild of
// orders — H3 — teaches through learnOrder in town.ts; the Grail's will is reckoned in hero.ts.)
//
// The chest's artifact is drawn on the chest's own dice for her and the week (the card shows what the boats will find);
// the guard's on the hero's own (maybeArtifact). Neither touches the sea's rng.

import { CHEST_ART, GUARD_ART, altarPrim } from '../../../shared/src/data/advmap.ts';
import { ARTIFACTS, rollArtifact } from '../../../shared/src/data/artifacts.ts';
import { PRIM_NAMES } from '../../../shared/src/data/hero.ts';
import { STASH_SIZE } from '../../../shared/src/data/items.ts';
import { hashString, Rng } from '../../../shared/src/rng.ts';
import { advHooks } from './advmap.ts';
import { thisWeek } from './calendar.ts';
import { applyHero, artifactFind, fillWill, heroOf, maybeArtifact } from './hero.ts';

/** The artifact a chest on the map holds for her this week (null: none). */
export function chestArtifact(week: number, account: number, chestId: string, guarded: boolean): string | null {
  const rng = new Rng(hashString(`chest-art:${chestId}:${week}:${account}`));
  if (!rng.chance(guarded ? CHEST_ART.guarded : CHEST_ART.open)) return null;
  return rollArtifact(rng, 'chest');
}

let installed = false;

/** Hand the adventure map's hooks to the hero (once; Game's constructor calls it). */
export function installHeroHooks(): void {
  if (installed) return;
  installed = true;
  advHooks.chestReward = (game, s, o) => {
    const p = s.profile;
    if (!p || p.stash.length >= STASH_SIZE) return null;
    const id = chestArtifact(thisWeek(game), s.accountId, o.id, !!o.guard);
    if (!id) return null;
    const name = ARTIFACTS[id].name;
    return {
      id: 'art', label: [`Artifact: ${name[0]}`, `Артефакт: ${name[1]}`],
      take: () => (artifactFind(game, s, 'chest', id) ? `In the chest: ${name[0]}.` : 'Your locker is full.'),
    };
  };
  advHooks.altar = (game, s, o) => {
    const p = s.profile;
    if (!p) return null;
    const prim = altarPrim(o.id);
    heroOf(p).prim[prim] += 1;
    applyHero(game, s);
    return `The bell’s note stays with you: ${PRIM_NAMES[prim][0]} +1.`;
  };
  advHooks.well = (_game, s) => {
    if (!s.profile) return false;
    fillWill(s.profile);
    return true;
  };
  advHooks.guardChest = (game, s, g) => {
    maybeArtifact(game, s, 'guard', GUARD_ART[g.size]);
    return null;
  };
}
