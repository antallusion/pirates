// The turn-based boarding battle (docs/16 P4, «like Heroes of Might and Magic III»): two decks side by side on a
// hex field, joined by planks where the grapples bit; the crews fight as stacks (hands, marines, musketeers, an
// officer's party) in the order of their initiative, the captains stand on the side panel with two orders each.
// The server holds the battle (server/src/game/tactical.ts); the client draws it (client/src/ui/tactical.ts).

import type { CaptainId } from './captains.ts';
import type { OfficerRole } from './crew.ts';
import { UNITS } from './army.ts';
import { BOSS_UNITS } from './bossunits.ts';
import type { UnitId } from './army.ts';
import { BOOK_PAGES, BOOK_PAGE_IDS, PATH_PAGES, PATH_PAGE_IDS } from './paths.ts';
import type { BookPageId, BtMods, PathPageId } from './paths.ts';

/** The field: 11 columns by 9 rows of hexes, odd rows pushed half a hex to the right and one hex shorter ('#'). */
export const TAC_W = 11;
export const TAC_H = 9;
/** The water between the hulls; the planks cross it on a few rows. */
export const TAC_GAP = 5;
/** Seconds a captain has for each of his stacks' turns at the top (from level 31); then the stack defends. */
export const TAC_TURN = 30;
/** docs/25 item 48 (owner, 2026-10-09: «на низких 1 минуты норма»): a stack's turn by the battle's level — 10 s at
 *  levels 1–10, 20 s at 11–30, 30 s from 31. A battle of no level (a test's bare armies) keeps the 30 s. docs/25 item
 *  70: 15 → 10 s at 1–10. The time model's decision (tests/balance/boardlen.ts HUMAN_DECIDE, 6 s a stack) sits inside
 *  it, and a low stack's choice is the smallest of all: four of hers against four, three or four orders and two pages,
 *  no ultimate — some ten choices against sixteen at level 30 and nineteen at 55, so by Hick's law (a + b·log2(n+1))
 *  its decision is a tenth shorter than at level 30, never longer. The modelled mean is the same (its turns are 6 s);
 *  a slow captain's worst is cut by a third. */
export function tacTurnSecs(level: number): number {
  return level <= 0 ? TAC_TURN : level <= 10 ? 10 : level <= 30 ? 20 : TAC_TURN;
}
/** docs/25 item 48: each captain's chess clock over a whole boarding — a minute at levels 1–10, a minute more every ten
 *  levels, six at 51–60. A turn's seconds come off it; once it is spent her stacks' turns go to defence. With it no
 *  fight between two captains runs past ~10–12 minutes (the legends, the Abyss raid and the citadels keep none). */
export function tacBankSecs(level: number): number {
  return 60 * Math.max(1, Math.min(6, Math.ceil(Math.max(1, level) / 10)));
}

/** docs/25 block Е (owner, 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и умения
 *  решали … делай все пункты»): a boarding fought by a group.
 *  - `range`: a mate of her group within this many metres of the grapple, at sea and in no other fight, may join (64);
 *  - `side`: captains a side at most, the one who grappled (or was grappled) among them;
 *  - `bring`: stacks of her own army an ally brings (her choice, else her strongest) — one below level `bringFrom` (a
 *    crew of three or four stacks: her strongest is most of it), two from it;
 *  - `late`: the last round an ally arriving mid-battle comes aboard at (as a round opens);
 *  - `foe`: item 66 — a ship of the sea, a legend, the raid's tier or a citadel's garrison against a group grows by
 *    `share(level)` of the strength her allies brought (the square law, sideStrength), and `order(level)` more for each
 *    ally's book and path;
 *  - `pace`: a group's blows and orders land harder by `pace(level)` an ally on the field (both sides counted), so its
 *    rounds are fewer than one captain's and its many stacks keep §1.2's length; `paceSea` against the sea's mind (its
 *    fights shorter, as item 50 has them: a group of the low levels is quicker than one captain alone);
 *  - `echo`: item 65 — the second captain of one path to give her path's page or move in a round gives it at ×echo,
 *    the third at its square (her foe has just read that book); and what another captain of her side laid of the same
 *    page holds once (tacbattle.ts layFx: the later renews it, it does not stack). Three of one path weigh less than a
 *    mixed group. docs/25 item 70: by level (`tacEcho`) — ×0.35 to level 22, ×0.6 from 30: in the short fights of the
 *    low levels three Corsairs' blows and three Navigators' double turns beat an average mixed group 61–74% at ×0.6
 *    (tools/balance-group.ts --roles); an echoed «another turn» is given that share of the times. */
export const TAC_GROUP = {
  range: 600,
  side: 3,
  bring: 2,
  bringFrom: 11,
  late: 3,
  echo: [[1, 0.35], [22, 0.35], [30, 0.6], [60, 0.6]] as [number, number][],
  foe: { share: [[1, 0.7], [10, 0.7], [11, 1], [20, 1], [30, 0.9], [60, 1]] as [number, number][], order: [[1, 0], [30, 0.15], [60, 0.3]] as [number, number][] },
  pace: [[1, 2.2], [10, 1.8], [20, 1], [30, 0.4], [60, 0.2]] as [number, number][],
  paceSea: [[1, 2.5], [10, 2.2], [20, 1.6], [30, 0.8], [60, 0.7]] as [number, number][],
};
/** docs/25 items 65 and 70: the echo of a second captain of one path at a boarding's level (TAC_GROUP.echo). */
export function tacEcho(level: number): number {
  return tacLevel(TAC_GROUP.echo, Math.max(1, level));
}
/** docs/25 block Е: the lift on a boarding's blows and orders with `allies` allied captains on the field (both sides;
 *  `sea`: against the sea's mind, `paceSea`). */
export function tacGroupPace(level: number, allies: number, sea = false): number {
  return allies <= 0 ? 1 : 1 + Math.max(0, allies) * tacLevel(sea ? TAC_GROUP.paceSea : TAC_GROUP.pace, Math.max(1, level));
}
/** docs/25 item 65 (owner: «у каждого пути своя роль на поле — Адмирал держит строй, Утопленница поднимает павших,
 *  Навигатор даёт лишние ходы, Корсар бьёт»): the paths' roles in a group's boarding. Each path among a side's captains
 *  — once, however many of them walk it — lays its role on every stack of the side (the allies' too) while the battle
 *  lasts: `self` on hers, `foe` on the other side's, `raise` a share of each of her stacks standing up again as every
 *  round from the second opens. Only when a side fights as a group (a captain alone has her path's book and moves as
 *  before): a mixed group brings three roles, three of one path one. */
export const TAC_ROLES: Record<CaptainId, { self?: BtMods; foe?: BtMods; raise?: number; name: [string, string]; text: [string, string] }> = {
  admiral: { self: { taken: -0.05 }, name: ['Holds the line', 'Держит строй'], text: ['Every stack of the group takes 5% less.', 'Каждый отряд группы получает на 5% меньше.'] },
  drowned: { raise: 0.02, name: ['Raises the fallen', 'Поднимает павших'], text: ['As each round opens, 2% of every stack of the group stands up again.', 'В начале каждого раунда встают 2% каждого отряда группы.'] },
  navigator: { self: { speed: 1, luck: 1 }, name: ['Gives the turns', 'Даёт лишние ходы'], text: ['Every stack of the group a hex faster and a point luckier.', 'Каждый отряд группы на гекс быстрее и на очко удачливее.'] },
  corsair: { self: { melee: 0.04, shot: 0.06 }, name: ['Strikes', 'Бьёт'], text: ["The group's blows 4% and shots 6% harder.", 'Удары группы на 4%, выстрелы на 6% сильнее.'] },
  smuggler: { foe: { shot: -0.12, luck: -1 }, name: ['Blinds', 'Слепит'], text: ["The foe's shots 12% lighter and her luck a point lower.", 'Выстрелы противника на 12% слабее, удача на очко ниже.'] },
  reaver: { self: { melee: 0.03 }, foe: { morale: -1 }, name: ['Breaks', 'Ломает'], text: ["The group's blows 3% harder, the foe's morale a point lower.", 'Удары группы на 3% сильнее, дух противника на очко ниже.'] },
};

/** docs/25 item 64: the stacks an ally brings to a boarding of `level` (0: a battle of no level — two). */
export function tacBring(level: number): number {
  return level > 0 && level < TAC_GROUP.bringFrom ? 1 : TAC_GROUP.bring;
}
/** Seconds the sea's captains wait before a stack's turn, once what was done before it has been played on the screen
 *  (owner, 2026-10-08: «там как-то слишком быстро всё перемещается, непонятно даже» — docs/23 item 60 had it 0.45 s
 *  and the walks 0.25 s, too quick to follow). docs/25 item 50 (owner, 2026-10-09: «с нпс можно быстрее сражаться»):
 *  0.7 → 0.35 s — the walks and blows keep their own pace (TAC_PACE), only the breath before her turn is shorter. */
export const TAC_AI_DELAY = 0.35;

/** docs/25 block Г (owner, 2026-10-09: «абордаж на высоких уровнях должен быть такой, чтобы люди играли по 5-10 минут…
 *  На низких 1 минуты норма»): how long a boarding runs by its level.
 *  Each table is by level, straight between its points (tacLevel).
 *  - `tempo`: every blow and shot of a boarding of level L lands ×tempo(L) — the army's strength grows with the level
 *    faster than a blow does (item 44): a fight of level 1 is two or three rounds, one of level 60 five to seven.
 *  - `blastMax`: the captains' orders slow with the tempo but speed up no more than this — a low level's orders
 *    already land hard (her path's power is at its highest there); its quick fights come from the men's blows.
 *  - `open`: round 1's blows and orders land ×open(L) (item 44: the share of an equal army cut in round 1 goes from
 *    ~35% at levels 1–10 to 15–18% at 51–60) — the crews cross the rail and feel each other out; the big fights are
 *    decided in the rounds after, by the captains' moves and the stacks' places, not by the first volley.
 *  - `npc`: a boarding against the sea's mind lands this much harder on both sides than one between two captains of its
 *    level (item 50, owner: «с нпс можно быстрее сражаться»): the odds stay, the fight is shorter.
 *  - `npcFewer`: the stacks fewer a ship of the sea brings than a captain of her level (item 50).
 *  - `fatigue`: from round `from` every blow lands `step` harder a round, both sides (item 51) — nobody holds out.
 *  - `flag`: from level `level` the quarterdeck's flag stands on each deck's stern; a stack of hers on the other's for
 *    `rounds` whole rounds takes the ship (item 52).
 *  - `quick`: a quick fight is offered at once when her side is this many times the other's strength (item 49). */
export const TAC_LEN = {
  tempo: [[1, 2], [10, 1.9], [20, 1.15], [30, 0.74], [40, 0.57], [50, 0.47], [60, 0.4]] as [number, number][],
  blastMax: 1,
  open: [[1, 1], [10, 0.85], [20, 0.7], [30, 0.65], [40, 0.62], [50, 0.66], [60, 0.7]] as [number, number][],
  npc: [[1, 1.8], [10, 2.2], [20, 2.8], [30, 2.8], [40, 1.9], [60, 1.15]] as [number, number][],
  npcFewer: 2,
  fatigue: { from: 8, step: 0.15 },
  flag: { level: 40, rounds: 2 },
  quick: 1.5,
};
/** A TAC_LEN table at `level`: straight between its points, flat past its ends. */
export function tacLevel(pts: readonly (readonly [number, number])[], level: number): number {
  const L = Math.max(pts[0][0], Math.min(pts[pts.length - 1][0], level));
  for (let i = 1; i < pts.length; i++) {
    const [l1, t1] = pts[i - 1], [l2, t2] = pts[i];
    if (L <= l2) return t1 + ((t2 - t1) * (L - l1)) / Math.max(1, l2 - l1);
  }
  return pts[pts.length - 1][1];
}
/** docs/25 §1.2: the stacks a captain brings to a boarding by her level (her hull's slots, as the ships open by level:
 *  3–4 at 1–10, 4–5 at 11–20, 5–6 at 21–30, 6–7 at 31–40, 7 and her officers from 41) — the most of them. */
export function boardSlots(level: number): number {
  return level <= 10 ? 4 : level <= 20 ? 5 : level <= 30 ? 6 : 7;
}
/** docs/25 item 50: a ship of the sea fights with one stack fewer than a captain of her level (two from level 31) —
 *  the same men in fewer, fuller stacks, so the fight with her is quicker and as hard. */
export function npcBoardSlots(level: number): number {
  return Math.max(2, boardSlots(level) - TAC_LEN.npcFewer);
}

/** item 44: the blows' scale in a boarding of `level` (1 for a battle of no level). */
export function tacTempo(level: number): number {
  return level <= 0 ? 1 : tacLevel(TAC_LEN.tempo, level);
}
/** item 44: round 1's scale in a boarding of `level`. */
export function tacOpen(level: number): number {
  return level <= 0 ? 1 : tacLevel(TAC_LEN.open, level);
}
/** item 50: a boarding against the sea's mind, its blows' and orders' lift at `level`. */
export function tacNpc(level: number): number {
  return level <= 0 ? 1 : tacLevel(TAC_LEN.npc, level);
}
/** item 51: the blows' lift in round `round` (1 before TAC_LEN.fatigue.from). */
export function tacFatigue(round: number): number {
  const f = TAC_LEN.fatigue;
  return round >= f.from ? 1 + f.step * (round - f.from + 1) : 1;
}
/** item 52: the quarterdeck's flag of side `side`: on her own deck, at her stern (the bottom rail), a hex in from the
 *  edge — side 0's on the left deck, side 1's its mirror. The other side takes it. */
export function tacFlagHex(side: 0 | 1): number {
  const own = hexIndex(1, TAC_H - 1);
  return side ? hexMirror(own) : own;
}
/** «Ускорить ×2» (docs/23 item 60): the sea's breath and the field's pace, × while a captain on the field has asked
 *  for it. */
export const TAC_FAST = 0.5;

/** The field's pace (owner, 2026-10-08), seconds at ×1: a stack walks hex by hex, eased in and out; a blow is a lunge
 *  that lands, the struck stack's flash and its numbers rising, and the answer is a beat of its own after a breath; a
 *  shot is the muzzle and the ball's flight, then the same. The server waits as long before the sea's next turn (and
 *  her own clock starts after it), so every foe's turn is seen whole: who moved, who struck whom, how many fell. */
export const TAC_PACE = {
  /** A step of a walk. */
  hex: 0.42,
  /** A flier's glide over the field, a hex of it; and its bounds. */
  glide: 0.3,
  glideMin: 0.5,
  glideMax: 1.4,
  /** The wind-up and the blow landing (the struck stack's flash at its end). */
  lunge: 0.34,
  /** The struck stack's flash and its numbers rising, before anything else moves. */
  hit: 0.55,
  /** The breath before the answer. */
  answer: 0.3,
  /** The muzzle and the ball in flight (the struck stack's flash at its end). */
  shot: 0.38,
  /** A captain's order, a path's innate move and her ultimate; an officer's word; the poison, the fire, a creature
   *  growing back; a stack frozen in fear; a morale or luck mark; a stack waiting or defending; a round opening; a great
   *  one ashore. */
  spell: 0.9,
  innate: 1.2,
  ult: 2.2,
  order: 0.7,
  mark: 0.45,
  fear: 0.6,
  morale: 0.45,
  idle: 0.25,
  round: 0.35,
  boss: 1,
} as const;

/** The most of a turn's events the screens play (the view carries the last dozen of the log); and of the battle's last
 *  (a quick combat's end is shown by its last blows, not the whole fight again). */
export const TAC_PLAY_WINDOW = 12;
export const TAC_END_WINDOW = 6;

/** What the schedule reads of an event (shared/src/protocol.ts TacEvent). */
export interface TacBeatEvent {
  k: string;
  id?: string;
  n?: number;
}
/** One event's place on the screen's clock: from when, how long, and the moment its blow lands. Seconds from the first. */
export interface TacBeat {
  at: number;
  dur: number;
  impact: number;
}

/** A walk's (or a glide's) length on the screen: `steps` hexes, `fly` over the field. */
export function walkSecs(steps: number, fly = false, speed = 1): number {
  const n = Math.max(1, steps);
  return (fly ? Math.max(TAC_PACE.glideMin, Math.min(TAC_PACE.glideMax, n * TAC_PACE.glide)) : n * TAC_PACE.hex) / Math.max(1, speed);
}

/** The screen's clock over a run of events (one turn's, or whatever came in one view): each event's start, length and
 *  the moment it lands, and the whole. The client plays them so; the server waits as long before the sea's next turn.
 *  A blow that spills on to one more (a breath, a chain, a swivel's burst) lands with the blow it came from; a
 *  volley's shots overlap. `speed` 2 under «×2». */
export function tacSchedule(events: readonly TacBeatEvent[], speed = 1): { beats: TacBeat[]; total: number } {
  const P = TAC_PACE;
  const k = 1 / Math.max(1, speed);
  const beats: TacBeat[] = [];
  let at = 0, last: TacBeat | null = null, volley = false;
  const held: number[] = [];
  const put = (start: number, dur: number, impact = start): TacBeat => {
    const b = { at: start, dur, impact };
    beats.push(b);
    at = Math.max(at, start + dur);
    for (const i of held.splice(0)) beats[i] = { at: impact, dur: 0, impact };
    return b;
  };
  for (const e of events) {
    const rides = (e.k === 'hit' || e.k === 'shot') && (e.id === 'breath' || e.id === 'chain' || e.id === 'blast');
    if (rides && last) {
      const impact = last.impact + 0.12 * k;
      for (const i of held.splice(0)) beats[i] = { at: impact, dur: 0, impact };
      beats.push({ at: last.at, dur: 0, impact });
      continue;
    }
    const wasVolley = volley;
    volley = (e.k === 'shot' && e.id === 'volley') || (e.k === 'siege' && e.id === 'gun');
    switch (e.k) {
      case 'siege': {
        // docs/19 E5: a stone of the catapult or a tower's shot is a shot's beat; the ship's broadside before the
        // assault fires gun after gun, a third of a second apart, as a volley's muskets do.
        const start = volley && wasVolley && last ? last.at + 0.32 * k : at;
        last = put(start, (P.shot + P.hit) * k, start + P.shot * k);
        break;
      }
      case 'move':
        last = put(at, walkSecs(e.n ?? 1, e.id === 'fly', speed));
        break;
      case 'hit':
        last = put(at, (P.lunge + P.hit) * k, at + P.lunge * k);
        break;
      case 'ret':
        last = put(at, (P.answer + P.lunge + P.hit) * k, at + (P.answer + P.lunge) * k);
        break;
      case 'shot': {
        // A volley's muskets fire one after another, a quarter second apart, not each its own whole beat.
        const start = volley && wasVolley && last ? last.at + 0.25 * k : at;
        last = put(start, (P.shot + P.hit) * k, start + P.shot * k);
        break;
      }
      case 'die':
      case 'luck':
        // The fallen go when the blow that felled them lands, luck is told with the blow it doubles: both are told
        // before that blow (the battle's log), so they wait for it.
        held.push(beats.length);
        beats.push({ at, dur: 0, impact: at });
        break;
      case 'spell':
        last = put(at, P.spell * k, at + P.spell * 0.35 * k);
        break;
      case 'innate':
      case 'ult':
        last = put(at, P[e.k] * k, at + P[e.k] * 0.3 * k);
        break;
      case 'order':
        last = put(at, P.order * k, at + P.order * 0.4 * k);
        break;
      case 'poison':
      case 'burn':
      case 'regen':
        last = put(at, P.mark * k, at);
        break;
      case 'fear':
        last = put(at, P.fear * k, at);
        break;
      case 'morale':
      case 'again':
        last = put(at, P.morale * k, at);
        break;
      case 'round':
        last = put(at, P.round * k, at);
        break;
      case 'boss':
        last = put(at, P.boss * k, at + P.boss * 0.4 * k);
        break;
      default:
        // A wait, a defence, the clock run out.
        last = put(at, P.idle * k, at);
    }
  }
  for (const i of held) beats[i] = { at: last?.impact ?? at, dur: 0, impact: last?.impact ?? at };
  return { beats, total: at };
}

/** The six ways a hex looks, as the board lies (y down): 0 east, 1 south-east, 2 south-west, 3 west, 4 north-west, 5
 *  north-east. */
export type HexDir = 0 | 1 | 2 | 3 | 4 | 5;

/** Which of the six ways `to` lies from `from` (the nearest of them for a hex further off); −1 for the hex itself. */
export function hexDir(from: number, to: number): number {
  const fy = hexY(from), ty = hexY(to);
  const dq = hexX(to) - (ty - (ty & 1)) / 2 - (hexX(from) - (fy - (fy & 1)) / 2), dr = ty - fy;
  const x = Math.sqrt(3) * (dq + dr / 2), y = 1.5 * dr;
  if (!x && !y) return -1;
  return ((Math.round(Math.atan2(y, x) / (Math.PI / 3)) % 6) + 6) % 6;
}

/** Blows into a stack's side and from behind (owner, 2026-10-08: «удары сзади должны наносить больше урона»): the
 *  front three hexes of the way it faces strike as ever, its two sides a sixth and a half more, the one behind it 30%
 *  more. Its answer is the same from anywhere. */
export const TAC_FLANK = [1, 1.15, 1.3] as const;

/** How a blow from the hex `from` comes in at a stack on `at` facing `face`: 0 from its front, 1 into its side, 2
 *  from behind. */
export function flankOf(face: number, at: number, from: number): 0 | 1 | 2 {
  const d = hexDir(at, from);
  if (d < 0 || face < 0) return 0;
  const k = Math.abs(d - face) % 6;
  const off = Math.min(k, 6 - k);
  return off >= 3 ? 2 : off === 2 ? 1 : 0;
}
/** A battle not decided in this many rounds goes to the side with the more of its strength left. */
export const TAC_MAX_ROUNDS = 20;
/** Shots at more than this many hexes do half damage. */
export const TAC_LONG_SHOT = 6;
/** Each point of morale or luck: 4% a turn (HoMM3), at most three points. */
export const TAC_CHANCE_PER_POINT = 0.04;

/** Terrain of a hex: deck, water between the hulls, a plank across it, and what stands on the deck — and what the
 *  guns left of her deck before the grapples bit (docs/17 H1): a hole shot through it ('H', no footing) and a fire
 *  ('F', burning whoever stands in it as his turn comes). */
export type TacCell = '.' | '~' | '=' | 'M' | 'C' | 'B' | 'K' | '#' | 'H' | 'F'
  /** docs/18 II, the battlefield ashore: a rock, a palm (both give cover from shots to a stack beside them), the surf
   *  (no footing but for the creatures that dive). The sand is '.'. */
  | 'R' | 'P' | 'W'
  /** docs/19 E5, a citadel's siege: a wall segment whole and cracked ('X', 'Y'), the gate whole and cracked ('G', 'J':
   *  the defenders' way out, nobody else's), an arrow tower whole, cracked and silenced ('T', 'U', 'V'), the rubble of
   *  what fell ('r', ground again), the moat ('O': a stack that steps in stops there) and the causeway before the gate
   *  ('D', ground). */
  | 'X' | 'Y' | 'G' | 'J' | 'T' | 'U' | 'V' | 'r' | 'O' | 'D';
export const TAC_BLOCKING: ReadonlySet<TacCell> = new Set(['~', 'M', 'C', 'B', 'K', '#', 'H', 'R', 'P', 'W', 'X', 'Y', 'G', 'J', 'T', 'U', 'V']);

/** docs/19 E5: the siege of a citadel on the same hexes (as HoMM3's castle battle). The wall line stands down the
 *  column `wallX` (it bars the field from edge to edge: no hex steps across a whole column), the gate in its middle row,
 *  an arrow tower two rows from each end; the moat runs down the column before it but for the causeway at the gate.
 *  The defenders stand behind it (side 1, the right). A segment, the gate or a tower takes `hp` stones to bring down —
 *  a broken segment or gate is rubble, ground for both; a silenced tower is a stump. */
export const SIEGE = {
  wallX: 7,
  moatX: 6,
  gateY: 4,
  towers: [1, 7] as readonly number[],
  hp: 2,
  /** A stack in the moat, wet to the waist: its defence. */
  moatDef: 0.8,
  /** Shots from without the wall at a stack within it. */
  cover: 0.5,
  /** The catapult's stone (and the ship's ball) finds the stone it is laid on. */
  hit: 0.75,
  /** A cracked tower shoots this share of a whole one's shot. */
  cracked: 0.5,
} as const;

export type SiegePart = 'wall' | 'gate' | 'tower';
/** What stands in a row of the wall line. */
export const siegePart = (y: number): SiegePart => (y === SIEGE.gateY ? 'gate' : SIEGE.towers.includes(y) ? 'tower' : 'wall');
/** The cell a part of the wall line shows with `hp` of its `max` left. */
export function siegeCell(part: SiegePart, hp: number, max: number): TacCell {
  if (part === 'tower') return hp <= 0 ? 'V' : hp < max ? 'U' : 'T';
  if (hp <= 0) return 'r';
  if (part === 'gate') return hp < max ? 'J' : 'G';
  return hp < max ? 'Y' : 'X';
}
export const isGateCell = (c: string): boolean => c === 'G' || c === 'J';
/** Within the walls: behind the wall line. */
export const insideWalls = (i: number): boolean => hexX(i) > SIEGE.wallX;
/** Cover ashore: a shot at a stack beside a rock or a palm does this share of its harm. */
export const TAC_COVER = 0.75;
/** docs/25 item 62 (owner, 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и умения
 *  решали»): on a ship's deck the mast, the barrels, the crates and the guns run in stand between a stack and a shot —
 *  a shot at a stack with one of them beside it, on the shooter's side of it, does this share of its harm. Where she
 *  stands and the way round decide, not the figures alone. */
export const TAC_DECK_COVER = 0.6;
export const TAC_COVER_CELLS: ReadonlySet<TacCell> = new Set(['M', 'B', 'K', 'C']);
/** The hex of what covers a stack on `hex` from a shot out of `from` on a deck (−1: nothing). */
export function deckCover(cells: ArrayLike<string>, hex: number, from: number): number {
  const d = hexDist(hex, from);
  for (const j of hexNeighbors(hex)) if (TAC_COVER_CELLS.has(cells[j] as TacCell) && hexDist(j, from) < d) return j;
  return -1;
}
/** docs/25 item 56: the great ones shrug off a share of the captains' orders and path pages — of their harm, and as
 *  often of what they would lay on them (her path's innate move and ultimate pass): a legend of the sea, a titan, a
 *  great one ashore. A side may bring its own (a legend of the trials, a great ship of the sea). */
export const TAC_RESIST = { legend: 0.3, titan: 0.4, boss: 0.5 } as const;
export function unitResist(u: UnitId): number {
  const d = UNITS[u];
  if (!d) return 0;
  return u in BOSS_UNITS ? TAC_RESIST.boss : d.titan ? TAC_RESIST.titan : d.legend ? TAC_RESIST.legend : 0;
}
/** A stack on a burning hex loses this share of its strength (at least a man's hit points) as its turn comes. */
export const TAC_BURN = 0.1;
/** The deep's own freeze a living stack of the other side one turn in ten. */
export const TAC_FEAR = 0.1;

/** What a stack is, broadly (the old four, and the tiers above them). */
export type TacKind = 'hands' | 'marines' | 'gunners' | 'officer' | 'boarders' | 'guard' | 'deep';
export const TAC_KINDS: TacKind[] = ['hands', 'marines', 'gunners', 'officer', 'boarders', 'guard', 'deep'];

/** The broad kind of a kind of man. */
export function kindOfUnit(u: UnitId): TacKind {
  const d = UNITS[u];
  if (d.specials.includes('shooter')) return 'gunners';
  return d.tier <= 1 ? 'hands' : d.tier === 5 ? 'boarders' : d.tier === 6 ? 'guard' : d.tier >= 7 ? 'deep' : 'marines';
}

export interface TacUnitDef {
  kind: TacKind;
  atk: number;
  def: number;
  dmin: number;
  dmax: number;
  hp: number;
  speed: number;
  init: number;
  /** Musket balls a stack carries (0: steel only). */
  shots: number;
  /** The painted icon it shows. */
  icon: string;
}

/** One man of each kind (HoMM3 scale). Gunners carry the muskets and pistols; the officer's party is picked men. */
export const TAC_UNITS: Record<'hands' | 'marines' | 'gunners' | 'officer', TacUnitDef> = {
  hands: { kind: 'hands', atk: 4, def: 3, dmin: 1, dmax: 3, hp: 6, speed: 4, init: 5, shots: 0, icon: 'icon.prof_sailor' },
  marines: { kind: 'marines', atk: 7, def: 6, dmin: 2, dmax: 4, hp: 9, speed: 4, init: 7, shots: 0, icon: 'icon.prof_marine' },
  gunners: { kind: 'gunners', atk: 5, def: 3, dmin: 2, dmax: 3, hp: 5, speed: 3, init: 4, shots: 4, icon: 'icon.prof_gunner' },
  officer: { kind: 'officer', atk: 8, def: 7, dmin: 3, dmax: 5, hp: 10, speed: 5, init: 8, shots: 0, icon: 'icon.role_lieutenant' },
};

/** A captain's orders from the side panel (one a round, each with its cooldown in rounds). */
export type TacSpellId = 'grenades' | 'point_blank' | 'smoke_and_knives' | 'red_harvest' | 'turn_the_flank' | 'call_of_the_deep' | 'iron_discipline'
  /** The order book's common pages (docs/17 H1), after the captains' own abilities at sea. */
  | 'mark_target' | 'double_shot' | 'war_cry' | 'brine_mend'
  /** The order book's further pages (docs/17 H2, shared/src/data/hero.ts): learnt at guilds and shrines. */
  | 'musket_storm' | 'powder_keg' | 'following_wind' | 'head_wind' | 'tide_returns' | 'maelstrom' | 'shield_wall' | 'fury' | 'dread'
  /** The path books (docs/18 item 3, shared/src/data/paths.ts), and the common pages after them (BOOK_PAGES). */
  | PathPageId | BookPageId;
export interface TacSpellDef {
  id: TacSpellId;
  /** Rounds before it may be given again. */
  cd: number;
  /** 'enemy': the captain points at a foe's stack; 'own': at one of her own (docs/18); 'none': the whole deck. */
  target: 'enemy' | 'own' | 'none';
  icon: string;
}
export const TAC_SPELLS: Record<TacSpellId, TacSpellDef> = {
  grenades: { id: 'grenades', cd: 3, target: 'enemy', icon: 'icon.bt_grenades' },
  point_blank: { id: 'point_blank', cd: 4, target: 'enemy', icon: 'icon.bt_volley' },
  smoke_and_knives: { id: 'smoke_and_knives', cd: 4, target: 'none', icon: 'icon.bt_hold' },
  red_harvest: { id: 'red_harvest', cd: 4, target: 'none', icon: 'icon.bt_charge' },
  turn_the_flank: { id: 'turn_the_flank', cd: 4, target: 'none', icon: 'icon.bt_officers' },
  call_of_the_deep: { id: 'call_of_the_deep', cd: 5, target: 'none', icon: 'icon.bt_colours' },
  iron_discipline: { id: 'iron_discipline', cd: 4, target: 'none', icon: 'icon.bt_captain' },
  mark_target: { id: 'mark_target', cd: 3, target: 'enemy', icon: 'icon.ab_mark_target' },
  double_shot: { id: 'double_shot', cd: 4, target: 'none', icon: 'icon.ab_double_shot' },
  war_cry: { id: 'war_cry', cd: 4, target: 'none', icon: 'icon.ab_war_cry' },
  brine_mend: { id: 'brine_mend', cd: 5, target: 'none', icon: 'icon.ab_brine_mend' },
  musket_storm: { id: 'musket_storm', cd: 4, target: 'none', icon: 'icon.bt_volley' },
  powder_keg: { id: 'powder_keg', cd: 5, target: 'enemy', icon: 'icon.ab_admiralty_barrage' },
  following_wind: { id: 'following_wind', cd: 3, target: 'none', icon: 'icon.ab_current_rider' },
  head_wind: { id: 'head_wind', cd: 3, target: 'none', icon: 'icon.ab_hard_over' },
  tide_returns: { id: 'tide_returns', cd: 6, target: 'none', icon: 'icon.prof_surgeon' },
  maelstrom: { id: 'maelstrom', cd: 5, target: 'none', icon: 'icon.ab_maw_of_the_deep' },
  shield_wall: { id: 'shield_wall', cd: 3, target: 'none', icon: 'icon.ab_smoke_pots' },
  fury: { id: 'fury', cd: 4, target: 'none', icon: 'icon.ab_red_hook_boarding' },
  dread: { id: 'dread', cd: 5, target: 'none', icon: 'icon.ab_deep_call' },
  ...(Object.fromEntries(PATH_PAGE_IDS.map((id) => [id, { id, cd: PATH_PAGES[id].cd, target: PATH_PAGES[id].fx.target, icon: `icon.${PATH_PAGES[id].icon}` }])) as Record<PathPageId, TacSpellDef>),
  ...(Object.fromEntries(BOOK_PAGE_IDS.map((id) => [id, { id, cd: BOOK_PAGES[id].cd, target: BOOK_PAGES[id].fx.target, icon: `icon.${BOOK_PAGES[id].icon}` }])) as Record<BookPageId, TacSpellDef>),
};
/** Each captain's own order (the Boarding 2.0 captain's move, docs/11 P1) beside the grenades everyone has. */
export const TAC_SIGNATURE: Record<CaptainId, TacSpellId> = {
  corsair: 'point_blank', smuggler: 'smoke_and_knives', reaver: 'red_harvest', navigator: 'turn_the_flank', drowned: 'call_of_the_deep', admiral: 'iron_discipline',
};
/** The captain's order book (docs/17 H1, as a HoMM3 hero's spell book): his own move, the grenades everyone has, and
 *  two pages after his abilities at sea — the corsair's Double Shot and Mark Target, the Reaver's War Cry, the
 *  Drowned's Brine Mend… One order a round from the side panel. */
export const TAC_BOOK: Record<CaptainId, TacSpellId[]> = {
  corsair: ['point_blank', 'grenades', 'double_shot', 'mark_target'],
  smuggler: ['smoke_and_knives', 'grenades', 'mark_target', 'brine_mend'],
  reaver: ['red_harvest', 'grenades', 'war_cry', 'mark_target'],
  navigator: ['turn_the_flank', 'grenades', 'mark_target', 'brine_mend'],
  drowned: ['call_of_the_deep', 'grenades', 'brine_mend', 'war_cry'],
  admiral: ['iron_discipline', 'grenades', 'double_shot', 'war_cry'],
};
export function captainSpells(captain: CaptainId | null): TacSpellId[] {
  return captain ? [...TAC_BOOK[captain]] : ['grenades'];
}

/** An officer's party acts on the officer's word once a fight (instead of striking): what each post gives. Each post
 *  its own small ability (docs/18 item 7): the boatswain's stack braces (steady, a third less taken), the master
 *  gunner calls a volley from every musket that can see, the alchemist binds wounds, the sailmaker hangs wet canvas
 *  against her shot, the harpooner pins her worst stack. */
export type TacOrderId = 'rally' | 'all_hands' | 'lay_true' | 'steady' | 'brace' | 'volley' | 'bandage' | 'canvas' | 'harpoon';
export const TAC_ORDER_OF: Record<OfficerRole, TacOrderId> = {
  lieutenant: 'rally', boatswain: 'brace', quartermaster: 'steady', master_gunner: 'volley', pilot: 'all_hands',
  alchemist: 'bandage', deep_pastor: 'rally', sailmaker: 'canvas', harpooner: 'harpoon',
};
export const TAC_ORDER_IDS: TacOrderId[] = ['rally', 'all_hands', 'lay_true', 'steady', 'brace', 'volley', 'bandage', 'canvas', 'harpoon'];

// ------------------------------------------------------------------ hexes

export const hexIndex = (x: number, y: number): number => y * TAC_W + x;
export const hexX = (i: number): number => i % TAC_W;
export const hexY = (i: number): number => Math.floor(i / TAC_W);
export const onField = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < TAC_W && y < TAC_H;

const EVEN: [number, number][] = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
const ODD: [number, number][] = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];

/** The (up to) six hexes around one. */
export function hexNeighbors(i: number): number[] {
  const x = hexX(i), y = hexY(i);
  const out: number[] = [];
  for (const [dx, dy] of y & 1 ? ODD : EVEN) if (onField(x + dx, y + dy)) out.push(hexIndex(x + dx, y + dy));
  return out;
}

/** The same hex seen from the other rail. */
export function hexMirror(i: number): number {
  const x = hexX(i), y = hexY(i);
  return hexIndex((y & 1 ? TAC_W - 2 : TAC_W - 1) - x, y);
}

/** Steps between two hexes. */
export function hexDist(a: number, b: number): number {
  const ay = hexY(a), by = hexY(b);
  const aq = hexX(a) - (ay - (ay & 1)) / 2, bq = hexX(b) - (by - (by & 1)) / 2;
  const dq = aq - bq, dr = ay - by;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
