// «Дальний переход» (owner, 2026-10-28: «выбирая дальние точки плавания корабль спустя 15 сек плавания должен ускоряться
// на полном ходу в 5 раз, но при этом он не сможет остановиться пока не доплывет до нужного места … и становится
// неактивным для окружения»). The numbers both sides share; the server (server/src/game/passage.ts) decides, the client
// shows the pill by the chart and the small toast.

/** Whether far marks turn into passages at all (owner, 2026-10-29: taken out after a player's word on the forum — on a
 *  passage nobody can be caught, and the raiding and the long hauls of trade lose their point). The code stays; the
 *  tests turn it on for themselves. */
export const VOYAGE = { on: false };

/** Her way through the water on a passage: this many times her top speed (owner, 2026-10-28: «х5 наверное даже мало,
 *  давай х10 скорость»). */
export const VOYAGE_MUL = 10;
/** Seconds of unbroken sailing for a far mark before the passage begins. */
export const VOYAGE_SPIN = 15;
/** A mark is far when the planned way to it is longer than this many seconds at her top speed… */
export const VOYAGE_FAR_SEC = 60;
/** …and never shorter than this (metres). */
export const VOYAGE_FAR_MIN = 2500;
/** The passage ends this far (metres along the way) short of the run's end: the last of it she sails as ever, the
 *  helmsman bringing her up to the mark in water he has sounded. */
export const VOYAGE_TAIL = 400;

/** Why a passage ended. */
export type VoyageEnd = 'arrived' | 'invalid' | 'lost';
