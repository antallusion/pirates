// Group contracts on the server (docs/11 P6): a port's contract of the day, and its quarry — one flagship with two
// escorts in the port's waters, shared by every captain who took the contract that day. Sunk (or gone at the end
// of her two hours), she is put to sea again for whoever still holds the contract.

import { dayOf } from '../../../shared/src/data/dailies.ts';
import { eliteContractFor, eliteLevel } from '../../../shared/src/data/elite.ts';
import type { QuestDef } from '../../../shared/src/data/quests.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { spawnElite } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** Each contract's flagship at sea: contract id → ship id. */
const quarry = new WeakMap<Game, Map<string, number>>();

/** The port's contract of the day. */
export function todaysElite(game: Game, port: Port): QuestDef | null {
  return eliteContractFor(port.id, dayOf(game.wallNow()));
}

/** The contract's flagship: the one at sea, else a new one put out in the port's waters. */
export function ensureElite(game: Game, q: QuestDef): ShipEntity | null {
  let map = quarry.get(game);
  if (!map) quarry.set(game, (map = new Map()));
  const id = map.get(q.id);
  const at = id !== undefined ? game.ships.get(id) : undefined;
  if (at?.alive) return at;
  const st = q.steps[0];
  const region = st.type === 'sink' ? st.region : undefined;
  if (!region) return null;
  const flag = spawnElite(game, region, eliteLevel(region));
  if (flag) map.set(q.id, flag.id);
  return flag;
}

/** Word of the quarry to the captain who takes the contract. */
export function eliteWord(game: Game, s: PlayerSession, flag: ShipEntity, q: QuestDef): void {
  const st = q.steps[0];
  const region = st.type === 'sink' && st.region ? REGIONS[st.region].name : '';
  game.sendTo(s, { t: 'toast', msg: `${flag.captainName} sails the ${flag.name} with two escorts in ${region}. Take a company.`, kind: 'info' });
}
