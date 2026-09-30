// docs/16 Batch C — the economy and the port: what the chart says of each port's prices, the merchants' chained
// runs, the trophy auction of the free ports, the tavern's paid whispers, and repairs at sea against the yard's.
// The numbers both sides read (the server rules by them, the screens explain them).

// ------------------------------------------------------------------ 11. port demand on the chart

/** A good whose price there stands this far above (dear) or below (cheap) its base price is marked on the chart. */
export const DEAR_AT = 1.12;
export const CHEAP_AT = 0.88;
/** At most this many of each by a port. */
export const DEMAND_MARKS = 2;
/** Knowledge fades on the chart over this many seconds (the faintest after it). */
export const INTEL_FADE = 5400;
/** Docking, the harbour's talk tells of this many other ports near (within the range), a while old. */
export const HEARD_PORTS = 2;
export const HEARD_RANGE = 26_000;
export const HEARD_AGE: [number, number] = [900, 3600];

// ------------------------------------------------------------------ 12. chained trade runs

/** Runs a captain may carry at once, and how many legs a merchant house chains before it pays off. */
export const RUN_SLOTS = 2;
export const RUN_LEGS = 5;
/** Each leg further in the chain adds this much to the bonus for speed. */
export const RUN_CHAIN_STEP = 0.2;
/** The window to sail it: a fixed part and a part for every metre. */
export function runWindow(d: number): number {
  return Math.round(300 + d / 6);
}
/** The full bonus is paid while at least this share of the window is left; it falls to nothing at the deadline. */
export const RUN_EARLY_SHARE = 0.45;
/** The share of the speed bonus earned when she arrives `left` seconds before the deadline of a `window`. */
export function earlyShare(left: number, window: number): number {
  if (left <= 0) return 0;
  return Math.max(0, Math.min(1, left / (window * RUN_EARLY_SHARE)));
}
/** A next leg waits for her at the port she delivered to this long. */
export const RUN_NEXT_TTL = 900;
/** The merchant houses that write the runs, in English and Russian. */
export const RUN_HOUSES: [string, string][] = [
  ['House Varro', 'Дом Варро'], ['The Saltmere Company', 'Солтмирская компания'], ['Widow Ashcombe & Sons', 'Вдова Эшкомб и сыновья'],
  ['The Lantern Factors', 'Фонарные факторы'], ['House Oakhelm', 'Дом Окхельм'], ['The Brine Street Ring', 'Товарищество Рассольной улицы'],
];

// ------------------------------------------------------------------ 13. the trophy auction

/** A lot runs this long (seconds of world time); a bid in its last minute holds it open a minute more. */
export const LOT_TIME = 600;
export const SNIPE_WINDOW = 60;
/** The least raise: this share of the standing bid, and never less than the floor. */
export const BID_STEP = 0.05;
export const BID_STEP_MIN = 10;
/** The house's cut of a sale; lots on the block in a free port at once; her own lots at a time. */
export const AUCTION_CUT = 0.1;
export const HOUSE_LOTS = 3;
export const OWN_LOTS = 2;
/** A captain's reserve may be from this share of the piece's worth up to this many times it. */
export const RESERVE_MIN = 0.25;
export const RESERVE_MAX = 3;
/** The house opens its own lots at this share of the piece's worth. */
export const HOUSE_OPEN = 0.3;
/** The bidders of the sea in the room, in English and Russian. */
export const AUCTION_BIDDERS: [string, string][] = [
  ['a Broker in grey', 'Брокер в сером'], ['Madam Kell of Tidewrack', 'мадам Келл из Тайдрэка'], ['a Crown purser', 'казначей Короны'],
  ['old Hobb the fence', 'старый скупщик Хобб'], ['a Choir penitent', 'кающийся из Хора'], ['a League factor', 'фактор Лиги'],
];
/** The house's lots go on the block only in the free ports' own harbours (not their villages). */
export function hasAuction(port: { faction: string; id: string }): boolean {
  return port.faction === 'free' && !port.id.includes('_v');
}
/** The least raise over a standing bid. */
export function minRaise(bid: number): number {
  return Math.max(BID_STEP_MIN, Math.ceil(bid * BID_STEP));
}

// ------------------------------------------------------------------ 14. the tavern's paid whispers

export type HearsayKind = 'cache' | 'caravan';
export type Reliability = 'sure' | 'likely' | 'doubtful';
/** How often each grade of whisper is true. */
export const RELIABILITY: Record<Reliability, number> = { sure: 0.9, likely: 0.7, doubtful: 0.45 };
/** Its price, by grade, as a share of what it leads to. */
export const HEARSAY_PRICE: Record<Reliability, number> = { sure: 0.45, likely: 0.3, doubtful: 0.14 };
/** How long a bought whisper holds (a cache waits; a caravan sails on). */
export const HEARSAY_TTL: Record<HearsayKind, number> = { cache: 3600, caravan: 900 };
/** She has come to the place within this many metres. */
export const HEARSAY_ARRIVE: Record<HearsayKind, number> = { cache: 450, caravan: 1500 };
/** Whispers she may hold at once. */
export const HEARSAY_SLOTS = 3;

// ------------------------------------------------------------------ 15. repairs at sea

/** Carpenters at sea mend this share of the hull and of the sails a minute (by the ship's repair rate and hands). */
export const SEA_HULL_PER_MIN = 0.06;
export const SEA_SAILS_PER_MIN = 0.1;
/** And the rudder: this much of it a minute. */
export const SEA_RUDDER_PER_MIN = 0.1;
/** What they use: a plank for this many points of hull, a bolt of sailcloth for this many of sail. */
export const HULL_PER_PLANK = 40;
export const SAILS_PER_CLOTH = 20;
