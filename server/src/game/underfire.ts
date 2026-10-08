// Under fire (owner, 2026-10-07: «я должен со всем взаимодействовать, ошибок типа "не под огнём" или ещё что-то быть
// не должно абсолютно»): a captain's every order to the land, the lairs, the marks, the finds, the harbour, her island
// and her gear is refused for the fight only while another ship's fire is striking her (ShipEntity.underFire: her own
// shots, a beast she has marked or that bites her and the sea's own blows are no fire) — and even then not refused: the
// order stands and is given again the moment the shot stops (Game.holdUnderFire), and she is told once that it waits.

/** The words of every order's refusal for the fight: an order refused with these is held, never refused. */
export const UNDER_FIRE_WORDS = new Set<string>([
  'Not while under fire',
  'Not under fire.',
  'Not in the heat of battle',
  'The harbour chain stays up while you are in a fight',
  'Not with shot flying',
  'Not in the middle of a fight',
  'Not in the middle of a fight.',
  'The forge is cold while the guns speak',
  'Carpenters cannot work under fire (needs Battle Repair).',
]);

/** What she is told, once, of an order that waits for the shot to stop (an "info", not a refusal). */
export const HELD_UNDER_FIRE = 'Done as soon as the firing stops.';

/** An order held this long at most: past it, the moment is gone. */
export const HOLD_UNDER_FIRE = 30;

/** The words of a refusal for her way through the water (the boats are not lowered at speed, the harbour is not
 *  entered under full sail): held too — she takes in sail and heaves to, and the order is given again once she lies
 *  still enough — with the most way she may have for it. */
export const WAY_WORDS = new Map<string, number>([
  ['Heave to first — the boats cannot be lowered at speed', 2.4],
  ['Heave to first', 2.4],
  ['Take in sail before entering harbour', 6.5],
]);

/** What she is told, once, of an order that waits for her to lie still (or slow for the harbour). */
export const HELD_FOR_WAY = 'Heaving to: done as soon as she lies still.';

/** An order that sends her boats or her hands to a place (the land, a lair, a drift, a sea mark, a find): it ends her
 *  «Атаковать» on a beast or a ship that is not firing on her — her helmsman steering after the shark recalled the
 *  boats the moment they were lowered. */
export function workOrder(msg: { t: string; action?: string }): boolean {
  switch (msg.t) {
    case 'land':
      return true;
    case 'seamark':
    case 'seafind':
      return msg.action === 'work';
    case 'lair':
      return msg.action === 'fight' || msg.action === 'join';
    case 'drift':
      return msg.action === 'fight' || msg.action === 'way' || msg.action === 'tap' || msg.action === 'roll';
  }
  return false;
}
