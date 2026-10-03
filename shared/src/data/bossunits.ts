// The four great ones that come ashore (owner, 2026-10-03: «еще больше всяких там боссов»; docs/02 §11.A.4, «Боссы на
// суше»): each a single creature on the hex battle of the land (docs/17 H1, docs/18 II), fought by one captain's
// landing party at a time. They are units as the land's creatures are, so the battle, its figures and its reckoning
// read them as any other kind — UNITS takes them in with one line (army.ts) — but no lair, tamer, drift, roaming stack,
// capture nor egg ever hands one out: they stand only where shared/src/data/shorebosses.ts raises them, and what they
// do beyond their numbers (the Mire Mother's tongue and brood, the Salamander's breath, the Abbess's bell, the
// Walrus's charge) is played by server/src/game/shorebosses.ts between the battle's turns.
//
// Until its own four-pose sheet is painted (tools/art/bosses.py: `unit.<id>`, `_b`, `_atk`, `_hit`) a great one stands
// on the field as the figure of a kind of like shape, tinted and drawn larger (BOSS_UNIT_STAND_IN, client/src/ui/
// tactical.ts); once `unit.<id>` is registered the client draws its own, with no change to any code.

import type { UnitDef } from './army.ts';
import type { Tr } from './estate.ts';

export type BossUnitId = 'mire_mother' | 'cinder_salamander' | 'drowned_abbess' | 'walrus_tyrant';
export const BOSS_UNIT_IDS: BossUnitId[] = ['mire_mother', 'cinder_salamander', 'drowned_abbess', 'walrus_tyrant'];

type Stats = Omit<UnitDef, 'id' | 'tier' | 'up' | 'base' | 'upgrade'>;
const G = (id: BossUnitId, s: Stats): UnitDef => ({ id, tier: 7, up: false, base: id, upgrade: null, beast: true, ...s });

/** One of each (HoMM3's scale: half again a white whale, a black dragon's match before the island's level is laid on). */
export const BOSS_UNITS: Record<BossUnitId, UnitDef> = {
  mire_mother: G('mire_mother', { atk: 18, def: 17, dmin: 12, dmax: 20, hp: 210, speed: 3, init: 5, shots: 0, specials: ['poison', 'regen'], art: 'unit.giant_toad', cost: 3000 }),
  cinder_salamander: G('cinder_salamander', { atk: 22, def: 15, dmin: 14, dmax: 22, hp: 180, speed: 5, init: 8, shots: 0, specials: ['retaliate_all'], art: 'unit.cave_wyrm', cost: 3000 }),
  drowned_abbess: G('drowned_abbess', { atk: 17, def: 18, dmin: 10, dmax: 18, hp: 190, speed: 4, init: 7, shots: 0, specials: ['undead', 'terror'], art: 'unit.cultist', cost: 3000 }),
  walrus_tyrant: G('walrus_tyrant', { atk: 21, def: 20, dmin: 14, dmax: 24, hp: 230, speed: 4, init: 6, shots: 0, specials: ['steady'], art: 'unit.seal', cost: 3000 }),
};

export const isBossUnit = (u: string): u is BossUnitId => (BOSS_UNIT_IDS as string[]).includes(u);

/** Their names and what they are, for the battle's card and the reckoning (English, Russian). */
export const BOSS_UNIT_NAMES: Record<BossUnitId, { name: Tr; note: Tr }> = {
  mire_mother: {
    name: ['Mire Mother', 'Мать Трясины'],
    note: ['A toad-queen the size of a longboat, her back heaped with spawn; her tongue drags the far ones in, and her brood hatches as the fight goes on.', 'Жаба-королева величиной со шлюпку, спина её вся в икре; язык её затягивает дальних, а выводок вылупляется по ходу боя.'],
  },
  cinder_salamander: {
    name: ['Cinder Salamander', 'Пепельная саламандра'],
    note: ['A salamander of black, ember-cracked hide; its breath sets the ground it marks alight, and wounded, its hide burns whoever strikes it.', 'Саламандра в чёрной шкуре с тлеющими трещинами; её дыхание поджигает землю, которую она наметила, а раненая — её шкура жжёт всякого, кто бьёт вплотную.'],
  },
  drowned_abbess: {
    name: ['Abbess of the Drowned Bell', 'Аббатиса Утонувшего Колокола'],
    note: ['A drowned abbess in a habit of weed and pale coral, the bell of her sunken abbey on a chain; her bell-ringers’ prayer shields her, and her toll raises her drowned and stills the living near her.', 'Утонувшая аббатиса в рясе из водорослей и бледного коралла, с колоколом затонувшего аббатства на цепи; молитва звонарей хранит её, а её звон поднимает её утопленников и сковывает живых рядом.'],
  },
  walrus_tyrant: {
    name: ['Walrus Tyrant', 'Морж-тиран'],
    note: ['A walrus bull as big as a rowing boat with tusks like ship’s knees; he lowers them at one of yours and charges it the next round.', 'Самец моржа величиной с шлюпку, с бивнями как корабельные кницы; он наводит их на одного из ваших и в следующем раунде бросается на него.'],
  },
};

/** Until `unit.<id>` is painted: the kind whose figure stands in for it, its tint, and how tall it stands (a hex's
 *  width, as FIGURE_SIZE reckons the others). */
export const BOSS_UNIT_STAND_IN: Record<BossUnitId, { u: string; tint: string; size: number }> = {
  mire_mother: { u: 'giant_toad', tint: 'hue-rotate(35deg) saturate(1.3) brightness(0.75) contrast(1.15)', size: 1.9 },
  cinder_salamander: { u: 'cave_wyrm', tint: 'sepia(1) saturate(2.4) hue-rotate(-30deg) brightness(0.55) contrast(1.25)', size: 1.8 },
  drowned_abbess: { u: 'cultist', tint: 'hue-rotate(110deg) saturate(0.55) brightness(0.85)', size: 1.75 },
  walrus_tyrant: { u: 'seal', tint: 'sepia(0.55) brightness(0.8) contrast(1.25)', size: 1.9 },
};
