// The server's lines of the fleet of eighty (owner, 2026-10-03; docs/02 §1.A.9), English → Russian: the premium hulls'
// gifts as their crews cry them (each its own whole sentence, made from shared/src/data/shipgifts.ts), their own
// creatures coming back aboard, the hands paid off to make room for them, and the yard and the tamer who will not turn
// doubloons into silver. The creatures' names are here too, as a sentence counts them.

import { SHIP_BEAST_IDS, SHIP_BEAST_PLURAL } from '../../../shared/src/data/shipbeasts.ts';
import { SHIP_GIFTS } from '../../../shared/src/data/shipgifts.ts';

const lines: Record<string, string> = {};
for (const g of Object.values(SHIP_GIFTS)) if (g && (g.kind === 'rally' || g.kind === 'muster')) lines[`${g.name[0]}! ${g.cry[0]}`] = `${g.name[1]}! ${g.cry[1]}`;
for (const u of SHIP_BEAST_IDS) lines[SHIP_BEAST_PLURAL[u][0]] = SHIP_BEAST_PLURAL[u][1];

export const SERVER_RU_FLEET: Record<string, string> = {
  ...lines,
  '{0} {1} come back aboard the {2}.': 'На «{2}» возвращаются её существа: {1} — {0}.',
  '{0} hands are paid off at the quay to make room for her own.': 'Чтобы освободить место её существам, у причала рассчитаны люди: {0}.',
  'No yard buys a hull bought with doubloons': 'Ни одна верфь не покупает корабль, купленный за дублоны',
  'The tamer buys no creature that came for doubloons.': 'Укротитель не покупает существ, полученных за дублоны.',
};
