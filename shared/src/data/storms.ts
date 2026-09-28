// Storm chasers (docs/12 P10 #14): in the Storm of the Century a heart of the storm wanders the sea. Near it the
// lightning seeks masts (a lightning rod grounds most of it); in its core a ship gathers the storm's charge, and whoever
// holds there long enough catches the heart: the stuff of the Storm-Chaser set, and of a ship's tenth level (shiplevel.ts).

import type { Slot } from './items.ts';

/** Within this of the heart the lightning strikes. */
export const HEART_R = 1800;
/** Within this of the heart a ship gathers its charge. */
export const CORE_R = 380;
/** Seconds held in the core to catch the heart. */
export const CHARGE_NEED = 40;
/** A bolt every this many seconds on the ships near the heart. */
export const STRIKE_EVERY = 3;
/** Metres a second the heart moves: a ship under sail can keep with it, a lazy one cannot. */
export const HEART_SPEED = 4;
/** Once caught, the heart is gone this long (seconds) before the storm makes another. */
export const HEART_REST = 8 * 60;
/** Hearts one captain may catch in one storm. */
export const HEARTS_PER_STORM = 2;
/** What a bolt does: a share of her hull, of her canvas, and hands lost (a rod takes 60% of it). */
export const BOLT = { hull: 0.05, sails: 0.1, crew: 2, rod: 0.4, fire: 0.3 };

/** The Storm-Chaser set at a forge: hearts and silver for a piece of it (her ship's level, epic, bound). */
export const STORM_FORGE = { hearts: 2, silver: 4000 };
export const STORM_SLOTS: Slot[] = ['sails', 'rigging', 'relic', 'coat', 'boots', 'spyglass'];

export function stormPatterns(): [string, string][] {
  return [
    ['Lightning! The rod takes most of it.', 'Молния! Громоотвод принял почти весь удар.'],
    ['Lightning strikes your mainmast! (A Lightning Rod would ground it.)', 'Молния бьёт в грот-мачту! (Громоотвод увёл бы её в море.)'],
    ['You are in the heart of the storm: hold here to catch it.', 'Вы в сердце шторма: держитесь в нём, чтобы поймать его.'],
    ['You have caught the heart of the storm! ({0} in all)', 'Вы поймали сердце шторма! (всего: {0})'],
    ['{0} has caught the heart of the storm over {1}.', 'Сердце шторма поймано: капитан {0}, {1}.'],
    ['The heart of the storm is gone; the sky will make another.', 'Сердце шторма ушло; небо сделает новое.'],
    ['You have caught all this storm will give you.', 'Этот шторм уже отдал вам всё, что мог.'],
    ['Needs {0} hearts of the storm', 'Нужно сердец шторма: {0}'],
    ['Needs a heart of the storm in her keel (caught in the Storm of the Century)', 'Нужно сердце шторма в киль (ловят в шторм века)'],
    ['No forge here: the Storm-Chaser set wants a yard of the second rank or better', 'Здесь нет кузни: штормовой комплект куют на верфи второго ранга и выше'],
    ['The forge makes {0} of the storm’s heart.', 'Кузня выковала из сердца шторма: {0}.'],
    ['That is not a piece of the Storm-Chaser set', 'Это не часть штормового комплекта'],
  ];
}
