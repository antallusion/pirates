// docs/19 D7: the creatures roaming the sea as HoMM3's neutral stacks, strictly from above: the white water where the
// stack breaks the swell and its shadow in the water, the creature's token — its own picture (or a tinted one that
// stands in for it) set in the UI's brass ring, a thin enamel bezel inside the brass in the ladder's colour against her
// ship; over it the level in its frame and HoMM3's word for their number («[1] Горстка»), as a ship's name wears her
// level; a few of them about it, painted (gulls wheeling, seals, fins, coils); «в бою», a grey token and gun smoke
// while another captain's party fights it (owner, 2026-10-07: no unfinished signs — all from the art). Each wanders
// slowly round its spot by the world's clock (the server reckons the same). On the minimap a small mark in the
// ladder's colour, one to a few pixels, fainter the further it is; the tooltip names it.

import type { UnitId } from '../../../shared/src/data/army.ts';
import { beastFace, drawFace } from './beastface.ts';
import { ROAMS, ROAM_MINI, ROAM_REACH, roamPos } from '../../../shared/src/data/roamers.ts';
import type { RoamKind } from '../../../shared/src/data/roamers.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import type { RoamView } from '../../../shared/src/roamproto.ts';
import { sprite } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/roamers.ts';
import type { ClientState } from '../state.ts';
import { strengthWord } from '../ui/army.ts';
import { esc } from '../ui/dom.ts';
import { RING_OUTER, TOKEN_IN, addHot, bezel, circlers, foam, levelTag, markRing, put, tokenStamp, word } from './seaart.ts';

type G = CanvasRenderingContext2D;
const L = dict(EN, RU);

export interface RoamCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  w: number;
  h: number;
}

export const roamName = (k: RoamKind): string => L(`k.${k}`);

/** Where a stack is now (its wander round its spot by the world's clock). */
export function roamNow(state: ClientState, v: RoamView): { x: number; y: number } {
  return roamPos(v.seed, v.x, v.y, state.estServerTime());
}

/** Its colour against her ship's level (the ladder's). */
function colourOf(state: ClientState, v: RoamView): string {
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  return THREAT_COLOR[threatOf(mine, v.level)];
}

/** The kinds that show a few of their own about the token (docs/19 D7): the painted creature from above, and whether it
 *  is in the air (full, its shadow below) or under the water (dim, as the deep dims it). */
const AROUND: Partial<Record<RoamKind, { id: string; air: boolean; k: number }>> = {
  gull: { id: 'creature.gull', air: true, k: 0.62 },
  albatross: { id: 'creature.gull', air: true, k: 0.8 },
  seal: { id: 'creature.seal', air: false, k: 0.62 },
  reef_shark: { id: 'monster.shark', air: false, k: 0.9 },
  barracuda: { id: 'monster.shark', air: false, k: 0.7 },
  sea_turtle: { id: 'creature.turtle', air: false, k: 0.6 },
  ancient_turtle: { id: 'creature.turtle', air: false, k: 0.75 },
  marsh_serpent: { id: 'monster.young_serpent', air: false, k: 1 },
  young_serpent: { id: 'monster.young_serpent', air: false, k: 1.1 },
  moray: { id: 'monster.young_serpent', air: false, k: 0.85 },
  lagoon_tentacle: { id: 'monster.kraken_tentacle', air: false, k: 0.9 },
  giant_octopus: { id: 'monster.kraken_tentacle', air: false, k: 1 },
  shoal_leviathan: { id: 'creature.leviathan', air: false, k: 1 },
  lantern_maw: { id: 'monster.lantern_maw', air: false, k: 0.9 },
};

/** The water about it: the white water where the stack breaks the swell (the painted spray, not a drawn ring), and —
 *  for a flock, a school or a pod — a few of them about the token, painted, from above. */
function water(g: G, x: number, y: number, R: number, v: RoamView, t: number, swimmers: boolean): void {
  foam(g, x, y, R * 1.05, t, v.id, 0.16);
  const many = swimmers ? Math.min(3, Math.max(0, Math.round(Math.log2(Math.max(1, v.n)) / 1.5))) : 0;
  const a = AROUND[v.kind];
  if (!many || !a) return;
  if (a.air) {
    // Wheeling over it, their shadows on the water.
    circlers(g, a.id, x + R * 0.35, y + R * 0.55, R * 1.75, R * a.k, many, t, v.id, 0.9, 0.18);
    circlers(g, a.id, x, y, R * 1.75, R * a.k, many, t, v.id, 0.9, 0.95);
  } else circlers(g, a.id, x, y, R * 1.8, R * a.k, many, t, v.id, 0.35, 0.55);
}

/** The creature's picture in the token's disc: its own figure from the head down, or the picture that stands in for
 *  it, tinted; grey in battle. */
function face(u: UnitId, grey: boolean): (g: G, cx: number, cy: number, r: number) => boolean {
  return (g, cx, cy, r) => {
    const f = beastFace(u);
    const sp = sprite(f.id);
    if (!sp) return false;
    g.filter = grey ? `${f.tint ?? ''} grayscale(1) brightness(0.62)`.trim() : f.tint ?? 'none';
    drawFace(g, sp.img, cx, cy, r, f.fig);
    g.filter = 'none';
    return true;
  };
}

/** The token: the painted picture in the UI's brass ring (stamped once a kind, size and state), the thin enamel bezel
 *  in the ladder's colour inside the brass, breathing; grey and in gun smoke while another party fights it. Until the
 *  art is in, a plain disc and ring stand in. */
function token(g: G, x: number, y: number, R: number, v: RoamView, col: string, t: number): void {
  const u = ROAMS[v.kind].u as UnitId;
  const grey = !!v.fight;
  const c = tokenStamp(`roam|${u}`, R, face(u, grey), grey);
  if (c) put(g, c, x, y);
  else {
    g.fillStyle = '#10161a';
    g.beginPath();
    g.arc(x, y, R * TOKEN_IN, 0, Math.PI * 2);
    g.fill();
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 2 + v.id);
  bezel(g, x, y, R, grey ? 'rgba(170,170,160,0.9)' : col, grey ? 0.6 : 0.65 + 0.35 * pulse);
}

/** Every stack about her on the sea. */
export function drawRoamsWorld(g: G, state: ClientState, c: RoamCtx): void {
  const list = state.roams;
  if (!list.length || c.zoom < 0.05) return;
  const now = state.estServerTime();
  const R = Math.max(11, Math.min(22, 19 * c.zoom));
  const small = c.zoom < 0.13;
  const own = state.ownDisplay;
  for (const v of list) {
    const p = roamPos(v.seed, v.x, v.y, now);
    const x = c.sx(p.x), y = c.sy(p.y);
    if (x < -R * 4 || y < -R * 4 || x > c.w + R * 4 || y > c.h + R * 4) continue;
    const col = colourOf(state, v);
    g.save();
    if (small) {
      // Far out: a mark, not a token (the sea stays readable).
      g.fillStyle = v.fight ? 'rgba(170,170,160,0.8)' : col;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
      continue;
    }
    addHot(x, y, R * RING_OUTER * TOKEN_IN + 2);
    if (c.zoom >= 0.2) water(g, x, y, R, v, c.time, c.zoom >= 0.8);
    token(g, x, y, R, v, col, c.time);
    if (state.roamMark === v.id) {
      // Marked by a tap or a click (owner, 2026-10-07): the engraved ring of a mark in its ladder colour, as a ship's
      // target ring — bright within the boats' reach (the fight can start), fainter while she is still too far.
      const near = !!own && Math.hypot(p.x - own.x, p.y - own.y) <= ROAM_REACH;
      markRing(g, x, y, R * 1.6, col, near, near ? 1 : 0.85 + 0.15 * Math.sin(c.time * 2.4));
    }
    const big = c.zoom > 0.45 ? 12 : 11;
    if (v.fight) {
      // «в бою» under it (her ship's own name rides over the fight), the kind beside it.
      word(g, c.zoom > 0.5 ? `${L('fight')} · ${roamName(v.kind)}` : L('fight'), x, y + R * 1.2 + 9, '#f0a890', big);
    } else {
      // The level in its frame in the ladder's colour, HoMM3's word beside it (as a ship's name wears hers).
      levelTag(g, strengthWord(v.n).word, v.level, col, x, y - R * 1.2 - 8, big);
      if (c.zoom > 0.5) word(g, roamName(v.kind), x, y + R * 1.2 + 8, '#cfdcdf', 10.5);
    }
    g.restore();
  }
}

/** The stacks on her minimap: one mark to a few pixels (the nearest wins), fainter toward the dial's edge and past
 *  ROAM_MINI; a fight's grey and hollow. */
export function drawRoamsMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number): void {
  if (!state.roams.length) return;
  const cells = new Set<number>();
  const list = state.roams.filter((v) => Math.abs(v.x - own.x) <= range && Math.abs(v.y - own.y) <= range)
    .sort((a, b) => Math.abs(a.x - own.x) + Math.abs(a.y - own.y) - (Math.abs(b.x - own.x) + Math.abs(b.y - own.y)));
  for (const v of list) {
    const px = tx(v.x), py = ty(v.y);
    const cell = Math.floor(px / 6) * 4096 + Math.floor(py / 6);
    if (cells.has(cell)) continue;
    cells.add(cell);
    const d = Math.max(Math.abs(v.x - own.x), Math.abs(v.y - own.y));
    g.globalAlpha = d > ROAM_MINI ? 0.35 : 1 - 0.45 * (d / ROAM_MINI);
    g.beginPath();
    g.moveTo(px, py - 3);
    g.lineTo(px + 3, py);
    g.lineTo(px, py + 3);
    g.lineTo(px - 3, py);
    g.closePath();
    if (v.fight) {
      g.strokeStyle = 'rgba(190,190,180,0.9)';
      g.lineWidth = 1.2;
      g.stroke();
    } else {
      g.fillStyle = colourOf(state, v);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.lineWidth = 0.8;
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}

/** The world map close in: the stacks she has word of, a small diamond each in the ladder's colour (grey in battle). */
export function drawRoamsChart(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number): void {
  for (const v of state.roams) {
    const px = tx(v.x), py = ty(v.y);
    g.beginPath();
    g.moveTo(px, py - 3.5);
    g.lineTo(px + 3.5, py);
    g.lineTo(px, py + 3.5);
    g.lineTo(px - 3.5, py);
    g.closePath();
    g.fillStyle = v.fight ? 'rgba(170,170,160,0.8)' : colourOf(state, v);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 0.8;
    g.stroke();
  }
}

/** The minimap's tooltip over one. */
export function roamTip(state: ClientState, x: number, y: number, slack: number): string | null {
  let best: RoamView | null = null, bd = slack + 120;
  for (const v of state.roams) {
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bd) [best, bd] = [v, d];
  }
  if (!best) return null;
  return esc(best.fight ? L('tipFight', { what: roamName(best.kind) }) : L('tip', { what: roamName(best.kind), word: strengthWord(best.n).word, lv: best.level }));
}
