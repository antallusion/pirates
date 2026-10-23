// A stray ball (QA 2026-10-22: «шальной выстрел по мирному рыбаку рядом с целью кампании даёт розыск 1»). A newcomer's
// broadside at the campaign's pirate struck the lawful fisher beside it, and the law wanted her at once. The rule now
// (docs/24, the law): a ball that strays onto a lawful ship of the sea while she is fighting another — her mark is
// another ship, a foe of hers is about (one at war with her, one that struck her or she struck, the campaign's own
// foes) — is no crime for a newcomer (the First Watch, the campaign's first chapter, the first levels): no infamy, no
// standing lost (the ship struck still knows who hit her: she flees, the raiders' bookkeeping holds). She is told once.
// A ball she aims at a lawful ship with nothing else about is her own doing, as before. Only a blow that lands counts at all: the battles' isolation
// (inbattle.ts battleBlocked) stops the rest before this is asked.

import { FIRST_SLOT, gateOf } from '../../../shared/src/data/campaign/progress.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { campaignFoes } from './campaign.ts';
import type { Game } from './Game.ts';
import { fresh } from './onboarding.ts';
import type { Profile } from './player.ts';
import { pursuitOf } from './pursuit.ts';
import type { ShipEntity } from './ship.ts';

/** A newcomer to the law's eyes up to this level (and through the campaign's first chapter, and the First Watch). */
export const LAW_NEWBIE_LEVEL = 5;
/** The campaign's chapters in the Crown's safe sea (the Black Coast, plan.ts): a newcomer's to the law through them. */
export const CROWN_CHAPTERS = 3;
/** Another ship in a fight with her within this many seconds, or this near (m), makes a ball on a third one stray. */
export const STRAY_FIGHT_SECS = 30;
export const STRAY_NEAR = 1600;
export const STRAY_FORGIVEN = 'A stray ball struck a lawful ship: the harbour forgives a newcomer this once.';

/** A newcomer the law forgives a stray ball: the First Watch, the campaign's opening chapter, the first levels. */
export function lawNewbie(p: Profile | null | undefined): boolean {
  if (!p) return false;
  if (fresh(p)) return true;
  if (p.level <= LAW_NEWBIE_LEVEL) return true;
  // (the campaign's chapters of the Crown's safe sea, the Black Coast's three, for a captain of their levels — not a
  // seasoned one whose campaign never began. Mid-game QA 2026-10-23: at the eighth level, chapter 3, a ball that strayed
  // off the campaign's pirates onto a Crown merchant by Salt Stockade made her Wanted 2, and the chapter's own Crown
  // harbours shut their quays to her: «Возьмите груз в Соляном Остроге» could not be done.)
  return !!p.campaign && p.campaign.at < (FIRST_SLOT[CROWN_CHAPTERS] ?? 0) && p.level <= gateOf(FIRST_SLOT[CROWN_CHAPTERS] ?? 0) + 2;
}

/** `b` (a lawful ship of the sea) struck by `a`'s ball while `a` is fighting another: the ball strayed. */
export function strayOnto(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  if (b.isPlayer || b.faction === 'player' || !FACTIONS[b.faction]?.lawful) return false;
  const mark = pursuitOf(a)?.target;
  if (mark !== undefined && mark >= 0) return mark !== b.id;
  const now = game.now;
  for (const [id, t] of a.attackers) if (id !== b.id && now - t < STRAY_FIGHT_SECS) return true;
  const s = game.sessionOf(a);
  if (s && campaignFoes(game, s).some((id) => id !== b.id)) return true;
  let fight = false;
  game.forShipsNear(a.state.x, a.state.y, STRAY_NEAR, (x) => {
    if (fight || x.id === a.id || x.id === b.id || !x.alive || x.docked) return;
    if ((x.attackers.get(a.id) ?? -1e9) > now - STRAY_FIGHT_SECS || (x.npcRole && game.isHostile(x, a))) fight = true;
  });
  return fight;
}

const told = new WeakMap<ShipEntity, number>();
/** A newcomer's stray ball: forgiven (true) — she is told once a minute. */
export function forgiveStray(game: Game, a: ShipEntity, b: ShipEntity): boolean {
  if (!a.isPlayer || !lawNewbie(game.profileOf(a)) || !strayOnto(game, a, b)) return false;
  if ((told.get(a) ?? -1e9) < game.now - 60) {
    told.set(a, game.now);
    game.toastShip(a, STRAY_FORGIVEN, 'info');
  }
  return true;
}
