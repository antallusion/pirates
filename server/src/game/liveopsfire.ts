// The live ops' triggers wired to the world (docs/34): kept apart from liveops.ts so the shop, the offers and the
// funnel do not pull the sea's events, invasions and bosses in with them. main.ts (and a test) call wireLiveOps once.

import { opsHappening } from './events.ts';
import { opsInvasion } from './invasions.ts';
import { setOpsFirers } from './liveops.ts';
import { opsZoneBoss } from './zonebosses.ts';

export function wireLiveOps(): void {
  setOpsFirers({ happening: opsHappening, invasion: opsInvasion, zboss: opsZoneBoss });
}
