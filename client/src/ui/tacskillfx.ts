// Owner, 2026-10-18 («придумай эффекты визуальные для них»): the creatures' abilities (shared/src/data/creatureskills.ts)
// and the magic of the ranged kinds, drawn on the boarding field by hand — strokes, rings, blobs and pseudo-random
// motes on the canvas, no picture made for them (owner's rule: nothing generated; no blood, no skulls or bones). Each
// kind has its own look, readable on a phone held sideways (844×390): a missile or a wave from the caster, a burst on
// what it falls on, a hold's sign left a moment over the stacks.
//
// Cheap by design: nothing is allocated while an effect plays (its motes are an index's pseudo-random, the same every
// frame), the list is capped (SKFX_CAP: the oldest let go), each effect draws at most a few dozen strokes, and on
// «меньше движения» a soft glow stands in for the motion. The beat (shared TAC_PACE.skill) lands what the ability lays
// on the stacks at `hit`; the effect plays from `t0` to `t0 + dur`.

import type { SkillId, ShotKind } from '../../../shared/src/data/creatureskills.ts';
import { blob } from './tacvfx.ts';

export interface Pt {
  x: number;
  y: number;
}
/** One ability played: from the caster (`from`) to its mark (`to`), on the stacks it fell on (`pts`); `end` a line's far
 *  end (a harpoon through to the rail); `mine` her side's (a gold edge) or the foe's (red). */
export interface SkFx {
  id: SkillId;
  t0: number;
  hit: number;
  dur: number;
  from: Pt;
  to: Pt;
  pts: Pt[];
  end?: Pt;
  mine: boolean;
  seed: number;
}
/** The most played at once (a quick fight's last blows, a death blast after a fireball): the oldest let go. */
export const SKFX_CAP = 10;
/** How long each plays past its start (ms): the beat's own (TAC_PACE.skill, 1.05 s) and the sign it leaves. */
export const SKFX_MS = 1500;

const h01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const ease = (k: number) => 1 - (1 - k) * (1 - k);
const clamp = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** Each kind's colour (and the magic shots'). */
export const SK_RGB: Record<SkillId, string> = {
  mend: '120,230,160', mass_mend: '120,230,170', raise: '170,240,220', ward: '120,180,245', bulwark: '220,180,110', cleanse: '200,235,255', haste: '170,225,255',
  rally: '255,206,110', toast: '255,220,120', fear: '150,150,170', stun: '255,232,120', freeze: '170,225,255', slow: '70,58,48', entangle: '120,190,90', siren: '120,230,220',
  curse: '170,90,220', mark: '40,30,30', ink: '30,30,44', taunt: '230,90,60', rot: '150,170,70', miasma: '130,210,90', chain: '170,210,255', fireball: '255,150,60',
  firepot: '255,130,40', cone: '255,180,90', pierce: '210,210,220', volley: '255,220,160', aimed: '255,240,200', drain: '200,60,130', devour: '90,150,170', toll: '210,170,90',
  grapple: '190,170,140', tidal: '110,190,230', blink: '170,120,240', frenzy: '255,110,60', summon: '90,200,190', death_blast: '255,140,50',
};

function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number, lw: number, dash?: number[]): void {
  if (a <= 0.01 || r <= 0.5) return;
  g.strokeStyle = `rgba(${rgb},${Math.min(1, a)})`;
  g.lineWidth = lw;
  if (dash) g.setLineDash(dash);
  g.beginPath();
  g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
  g.stroke();
  if (dash) g.setLineDash([]);
}
/** A jagged bolt from a to b (lightning), its kinks seeded. */
function bolt(g: CanvasRenderingContext2D, a: Pt, b: Pt, seed: number, w: number, rgb: string, al: number): void {
  const n = 7;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (const [lw, c] of [[Math.max(4, w * 0.16), `rgba(${rgb},${0.35 * al})`], [Math.max(1.6, w * 0.05), `rgba(255,255,255,${0.95 * al})`]] as const) {
    g.strokeStyle = c;
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(a.x, a.y);
    for (let i = 1; i < n; i++) {
      const q = i / n, off = (h01(seed + i * 7) - 0.5) * w * 0.7;
      g.lineTo(a.x + dx * q + nx * off, a.y + dy * q + ny * off);
    }
    g.lineTo(b.x, b.y);
    g.stroke();
  }
}
/** A glowing orb with a trail along a(n arcing) path from a to b at k (0..1). */
function orb(g: CanvasRenderingContext2D, a: Pt, b: Pt, k: number, arc: number, w: number, rgb: string, size = 0.22): void {
  const at = (q: number): Pt => ({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q - arc * 4 * q * (1 - q) });
  for (let i = 5; i >= 0; i--) {
    const q = Math.max(0, k - i * 0.045);
    const p = at(q);
    blob(g, rgb, p.x, p.y, w * size * (1 - i * 0.12), (1 - i / 6) * 0.9, 0.35);
  }
  const p = at(k);
  blob(g, '255,255,255', p.x, p.y, w * size * 0.45, 0.9, 0.4);
}
/** A burst of motes out of (x, y): `n` of them, thrown `r` far by k, of `rgb`. */
function motes(g: CanvasRenderingContext2D, c: Pt, k: number, n: number, r: number, rgb: string, al: number, seed: number, rise = 0, size = 0.07, w = 30): void {
  for (let i = 0; i < n; i++) {
    const a = h01(seed + i) * Math.PI * 2, d = r * (0.4 + 0.6 * h01(seed + i * 3)) * ease(k);
    blob(g, rgb, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.55 - rise * k * (0.5 + h01(seed + i * 5)), w * size * (1 - 0.5 * k), al * (1 - k), 0.5);
  }
}

/** Draw one ability's effect at time `t` (performance ms); `w` the hex's width; `still`: reduced motion. */
export function drawSkFx(g: CanvasRenderingContext2D, f: SkFx, t: number, w: number, still: boolean): void {
  const dur = f.dur;
  const k = (t - f.t0) / dur;
  if (k < 0 || k >= 1) return;
  const rgb = SK_RGB[f.id];
  const fly = clamp((t - f.t0) / Math.max(1, f.hit - f.t0)); // the missile's way, 0 → 1 as it lands
  const after = clamp((t - f.hit) / Math.max(1, f.t0 + dur - f.hit)); // the burst and the sign, 0 → 1 after it lands
  const landed = t >= f.hit;
  const fade = 1 - after;
  const body = (p: Pt) => ({ x: p.x, y: p.y - w * 0.55 });
  const src = body(f.from), dst = body(f.to);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (still) {
    g.globalCompositeOperation = 'lighter';
    for (const p of f.pts.length ? f.pts : [f.to]) blob(g, rgb, p.x, p.y - w * 0.5, w * 0.9, 0.4 * (1 - k), 0.3);
    g.restore();
    return;
  }
  // The caster gathers herself: a ring of her colour round her feet as she gives it.
  if (k < 0.35) ring(g, f.from.x, f.from.y, w * (0.3 + 0.5 * ease(k / 0.35)), f.mine ? '255,214,120' : '230,100,80', 0.8 * (1 - k / 0.35), Math.max(1.5, w * 0.05));
  switch (f.id) {
    case 'mend':
    case 'mass_mend':
    case 'raise':
    case 'cleanse': {
      g.globalCompositeOperation = 'lighter';
      const pts = f.pts.length ? f.pts : [f.to];
      // a thread of light from her to each, then motes rising and a cross of light over it (a pillar for the raised)
      for (const [i, p] of pts.slice(0, 8).entries()) {
        if (!landed) {
          const q = lerp(src, body(p), ease(fly));
          blob(g, rgb, q.x, q.y, w * 0.18, 0.9, 0.4);
          continue;
        }
        const c = body(p);
        if (f.id === 'raise') {
          g.fillStyle = `rgba(${rgb},${0.28 * fade})`;
          g.fillRect(p.x - w * 0.28, p.y - w * 1.7 * ease(Math.min(1, after * 2)), w * 0.56, w * 1.7 * ease(Math.min(1, after * 2)));
          for (let j = 0; j < 6; j++) blob(g, '220,255,245', p.x + (h01(f.seed + j + i * 9) - 0.5) * w * 0.5, p.y - w * 1.6 * ((after * 1.3 + h01(j * 3 + i)) % 1), w * 0.06, 0.9 * fade, 0.5);
        } else if (f.id === 'cleanse') {
          // water rising off her and falling as drops
          for (let j = 0; j < 8; j++) {
            const a = (j / 8) * Math.PI * 2, up = Math.sin(after * Math.PI);
            blob(g, '220,240,255', c.x + Math.cos(a) * w * 0.4 * after, c.y - w * 0.6 * up + Math.sin(a) * w * 0.15, w * 0.07, 0.95 * fade, 0.5);
          }
          ring(g, p.x, p.y, w * (0.3 + 0.6 * ease(after)), '200,235,255', 0.9 * fade, Math.max(1.5, w * 0.05));
        } else {
          g.strokeStyle = `rgba(${rgb},${0.9 * fade})`;
          g.lineWidth = Math.max(2, w * 0.08);
          const s = w * 0.22 * (0.8 + 0.4 * ease(after));
          g.beginPath();
          g.moveTo(c.x - s, c.y);
          g.lineTo(c.x + s, c.y);
          g.moveTo(c.x, c.y - s);
          g.lineTo(c.x, c.y + s);
          g.stroke();
          motes(g, { x: p.x, y: p.y - w * 0.2 }, after, 6, w * 0.45, rgb, 0.9, f.seed + i * 13, w * 1.1, 0.07, w);
          if (f.id === 'mass_mend') ring(g, p.x, p.y, w * (0.3 + 0.5 * ease(after)), rgb, 0.8 * fade, Math.max(1.5, w * 0.05));
        }
      }
      break;
    }
    case 'ward':
    case 'bulwark': {
      // a bubble (ward: sea-blue; bulwark: a bronze shield of six facets) closing round her
      const p = f.id === 'bulwark' ? f.from : f.to, c = body(p);
      const q = ease(Math.min(1, k * 2.5));
      g.globalCompositeOperation = 'lighter';
      if (f.id === 'ward') {
        blob(g, rgb, c.x, c.y, w * 0.85 * q, 0.35 * fade, 0.6);
        g.strokeStyle = `rgba(190,225,255,${0.9 * fade})`;
        g.lineWidth = Math.max(1.5, w * 0.05);
        g.beginPath();
        g.ellipse(c.x, c.y, w * 0.7 * q, w * 0.8 * q, 0, 0, Math.PI * 2);
        g.stroke();
        blob(g, '255,255,255', c.x - w * 0.25, c.y - w * 0.3, w * 0.12 * q, 0.7 * fade, 0.5);
      } else {
        g.strokeStyle = `rgba(${rgb},${0.95 * fade})`;
        g.lineWidth = Math.max(2, w * 0.07);
        g.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          const x = c.x + Math.cos(a) * w * 0.75 * q, y = c.y + Math.sin(a) * w * 0.8 * q;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
        blob(g, rgb, c.x, c.y, w * 0.8 * q, 0.25 * fade, 0.5);
      }
      break;
    }
    case 'haste':
    case 'frenzy': {
      // wind streaks round her (haste) or a red-orange aura licking up (fury)
      const p = f.id === 'frenzy' ? f.from : f.to;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const x = p.x + (h01(f.seed + i) - 0.5) * w * 1.1;
        const q = (k * 1.6 + h01(f.seed + i * 3)) % 1;
        if (f.id === 'haste') {
          g.strokeStyle = `rgba(${rgb},${0.85 * (1 - k)})`;
          g.lineWidth = Math.max(1.2, w * 0.035);
          g.beginPath();
          g.moveTo(x - w * 0.5 + w * q, p.y - w * (0.2 + 0.8 * h01(i * 5 + f.seed)));
          g.lineTo(x - w * 0.1 + w * q, p.y - w * (0.2 + 0.8 * h01(i * 5 + f.seed)));
          g.stroke();
        } else blob(g, i % 2 ? '255,90,40' : '255,170,60', x, p.y - w * 1.3 * q, w * 0.14 * (1 - q), 0.9 * (1 - k), 0.4);
      }
      if (f.id === 'frenzy') blob(g, rgb, p.x, p.y - w * 0.5, w * 0.8, 0.35 * (1 - k), 0.3);
      break;
    }
    case 'rally':
    case 'toast': {
      // a drum's beats: gold rings out of her, then a gold ripple at every stack of hers (a toast: sparkles)
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const q = clamp(k * 2 - i * 0.25);
        ring(g, f.from.x, f.from.y, w * (0.3 + 1.6 * ease(q)), rgb, 0.8 * (1 - q), Math.max(1.5, w * 0.05));
      }
      if (landed) for (const [i, p] of f.pts.slice(0, 8).entries()) {
        if (f.id === 'rally') ring(g, p.x, p.y, w * (0.25 + 0.45 * ease(after)), rgb, 0.85 * fade, Math.max(1.5, w * 0.05));
        else for (let j = 0; j < 5; j++) {
          const a = h01(f.seed + i * 7 + j) * Math.PI * 2;
          const r = w * 0.4 * h01(j + i * 3);
          const tw = 0.5 + 0.5 * Math.sin((after * 8 + j) * Math.PI);
          blob(g, '255,236,170', p.x + Math.cos(a) * r, p.y - w * (0.4 + 0.7 * h01(i + j * 11)), w * 0.07 * (0.6 + tw), 0.95 * fade, 0.4);
        }
      }
      break;
    }
    case 'fear': {
      // a grey pall flows from her to the foe; over it two pale eyes open and a dark shroud sinks
      if (!landed) {
        g.globalCompositeOperation = 'source-over';
        const q = lerp(src, dst, ease(fly));
        blob(g, '40,40,52', q.x, q.y, w * 0.5, 0.7, 0.4);
        break;
      }
      blob(g, '20,20,30', dst.x, dst.y - w * 0.2 + w * 0.5 * after, w * 1.1, 0.6 * fade, 0.4);
      g.globalCompositeOperation = 'lighter';
      for (const sx of [-1, 1]) blob(g, '200,210,240', dst.x + sx * w * 0.18, dst.y - w * 0.55, w * 0.09 * (0.5 + Math.sin(Math.min(1, after * 3) * Math.PI)), 0.95 * fade, 0.5);
      ring(g, f.to.x, f.to.y, w * (0.9 - 0.45 * ease(after)), '180,180,200', 0.9 * fade, Math.max(2, w * 0.06), [w * 0.1, w * 0.08]);
      break;
    }
    case 'stun': {
      // a crack of thunder from her to the foe, a starburst, and stars turning over its head
      if (!landed) {
        bolt(g, src, lerp(src, dst, ease(fly)), f.seed, w, '255,240,170', 0.9);
        break;
      }
      g.globalCompositeOperation = 'lighter';
      blob(g, rgb, dst.x, dst.y, w * (0.5 + 0.8 * ease(after)), 0.7 * fade, 0.2);
      g.strokeStyle = `rgba(255,245,190,${0.95 * fade})`;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2, r0 = w * 0.2, r1 = w * (0.4 + 0.6 * ease(Math.min(1, after * 2)));
        g.lineWidth = Math.max(1.5, w * 0.05);
        g.beginPath();
        g.moveTo(dst.x + Math.cos(a) * r0, dst.y + Math.sin(a) * r0);
        g.lineTo(dst.x + Math.cos(a) * r1, dst.y + Math.sin(a) * r1);
        g.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const a = after * Math.PI * 4 + (i / 4) * Math.PI * 2;
        blob(g, '255,236,140', f.to.x + Math.cos(a) * w * 0.4, f.to.y - w * 1.05 + Math.sin(a) * w * 0.12, w * 0.09, 0.95 * fade, 0.4);
      }
      break;
    }
    case 'freeze': {
      // a cold bolt, then ice: six shards closing to a hexagon round her and a frost glow
      if (!landed) {
        g.globalCompositeOperation = 'lighter';
        orb(g, src, dst, ease(fly), w * 0.4, w, rgb);
        break;
      }
      g.globalCompositeOperation = 'lighter';
      blob(g, rgb, dst.x, dst.y, w * 0.9, 0.4 * fade, 0.3);
      g.strokeStyle = `rgba(220,245,255,${0.95 * fade})`;
      g.lineWidth = Math.max(1.5, w * 0.05);
      const q = ease(Math.min(1, after * 2.5));
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = dst.x + Math.cos(a) * w * 0.6 * (1.6 - 0.6 * q), y = dst.y + Math.sin(a) * w * 0.7 * (1.6 - 0.6 * q);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        g.beginPath();
        g.moveTo(dst.x, dst.y);
        g.lineTo(dst.x + Math.cos(a) * w * 0.45 * q, dst.y + Math.sin(a) * w * 0.5 * q);
        g.stroke();
      }
      break;
    }
    case 'slow':
    case 'firepot':
    case 'fireball': {
      // a pot of tar, a pot of fire or a ball of fire arcing over, then its splash: a ring and a pool on every hex it took
      const arc = Math.hypot(dst.x - src.x, dst.y - src.y) * (f.id === 'fireball' ? 0.15 : 0.32);
      if (!landed) {
        g.globalCompositeOperation = f.id === 'slow' ? 'source-over' : 'lighter';
        if (f.id === 'slow') {
          const q = { x: src.x + (dst.x - src.x) * fly, y: src.y + (dst.y - src.y) * fly - arc * 4 * fly * (1 - fly) };
          g.fillStyle = 'rgba(40,30,22,0.95)';
          g.beginPath();
          g.arc(q.x, q.y, w * 0.13, 0, Math.PI * 2);
          g.fill();
        } else orb(g, src, dst, fly, arc, w, rgb, f.id === 'fireball' ? 0.3 : 0.18);
        break;
      }
      for (const [i, p] of (f.pts.length ? f.pts : [f.to]).slice(0, 7).entries()) {
        const main = i === 0;
        if (f.id === 'slow') {
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = `rgba(30,22,16,${0.7 * fade})`;
          g.beginPath();
          g.ellipse(p.x, p.y, w * 0.5 * ease(Math.min(1, after * 3)), w * 0.2 * ease(Math.min(1, after * 3)), 0, 0, Math.PI * 2);
          g.fill();
          for (let j = 0; j < 5; j++) {
            const a = h01(f.seed + j + i * 5) * Math.PI * 2;
            g.fillStyle = `rgba(36,28,20,${0.9 * fade})`;
            g.beginPath();
            g.arc(p.x + Math.cos(a) * w * 0.4 * after, p.y - w * 0.6 + Math.sin(a) * w * 0.2 + w * 0.8 * after * after, w * 0.05, 0, Math.PI * 2);
            g.fill();
          }
        } else {
          g.globalCompositeOperation = 'lighter';
          blob(g, rgb, p.x, p.y - w * 0.4, w * (main ? 1.3 : 0.8) * (0.5 + ease(after)), 0.8 * fade, 0.25);
          ring(g, p.x, p.y, w * (0.3 + (main ? 1.1 : 0.6) * ease(after)), '255,200,120', 0.9 * fade, Math.max(2, w * 0.07));
          motes(g, { x: p.x, y: p.y - w * 0.4 }, after, main ? 10 : 5, w * (main ? 1.1 : 0.6), '255,170,70', 1, f.seed + i * 17, w * 0.6, 0.08, w);
        }
      }
      break;
    }
    case 'chain': {
      // a bolt from her to the first, then leap after leap along the struck, each a beat later
      const pts = [f.from, ...(f.pts.length ? f.pts : [f.to])].map(body);
      g.globalCompositeOperation = 'lighter';
      const hops = pts.length - 1;
      for (let i = 0; i < hops; i++) {
        const t0 = f.t0 + (f.hit - f.t0) * 0.6 + i * 90;
        const q = (t - t0) / 380;
        if (q < 0 || q > 1) continue;
        bolt(g, pts[i], lerp(pts[i], pts[i + 1], ease(Math.min(1, q * 2))), f.seed + i * 31 + Math.floor(t / 60), w, rgb, 1 - q * 0.6);
        if (q > 0.4) blob(g, '220,235,255', pts[i + 1].x, pts[i + 1].y, w * 0.6, 0.8 * (1 - q), 0.3);
      }
      break;
    }
    case 'cone': {
      // a fan of scalding breath out of her toward the foe, puffs rolling along it
      const a0 = Math.atan2(dst.y - src.y, dst.x - src.x), len = Math.max(w * 1.5, Math.hypot(dst.x - src.x, dst.y - src.y) * 1.3);
      g.globalCompositeOperation = 'lighter';
      const q = ease(Math.min(1, k * 2));
      for (let i = 0; i < 16; i++) {
        const a = a0 + (h01(f.seed + i) - 0.5) * 1.1, d = len * q * (0.3 + 0.7 * h01(f.seed + i * 3));
        blob(g, i % 3 ? rgb : '255,240,200', src.x + Math.cos(a) * d, src.y + Math.sin(a) * d, w * (0.15 + 0.3 * (d / len)), 0.8 * (1 - k), 0.35);
      }
      if (landed) for (const p of f.pts.slice(0, 7)) blob(g, '255,160,80', p.x, p.y - w * 0.4, w * 0.6, 0.6 * fade, 0.3);
      break;
    }
    case 'pierce':
    case 'grapple': {
      // a harpoon (or a hook) flying straight with its line behind it; the hook hauls back
      const end = f.id === 'pierce' ? body(f.end ?? f.to) : dst;
      const out = f.id === 'pierce' ? ease(Math.min(1, k * 1.8)) : fly;
      const back = f.id === 'grapple' && landed ? ease(after) : 0;
      const tip = lerp(src, end, out * (1 - back * 0.85));
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(150,128,96,${0.95 * (1 - Math.max(0, k - 0.8) * 5)})`;
      g.lineWidth = Math.max(1.5, w * 0.04);
      g.beginPath();
      g.moveTo(src.x, src.y);
      g.quadraticCurveTo((src.x + tip.x) / 2, (src.y + tip.y) / 2 + w * 0.2 * (1 - out), tip.x, tip.y);
      g.stroke();
      const ang = Math.atan2(end.y - src.y, end.x - src.x);
      g.save();
      g.translate(tip.x, tip.y);
      g.rotate(ang);
      g.strokeStyle = 'rgba(225,228,236,0.95)';
      g.lineWidth = Math.max(2, w * 0.06);
      g.beginPath();
      g.moveTo(-w * 0.3, 0);
      g.lineTo(w * 0.12, 0);
      if (f.id === 'pierce') {
        g.moveTo(w * 0.12, 0);
        g.lineTo(0, -w * 0.08);
        g.moveTo(w * 0.12, 0);
        g.lineTo(0, w * 0.08);
      } else {
        g.moveTo(w * 0.12, 0);
        g.arc(w * 0.02, 0, w * 0.1, 0, Math.PI * 0.9);
        g.moveTo(w * 0.12, 0);
        g.arc(w * 0.02, 0, w * 0.1, 0, -Math.PI * 0.9, true);
      }
      g.stroke();
      g.restore();
      if (f.id === 'pierce') for (const p of f.pts.slice(0, 6)) {
        const c = body(p);
        const reached = Math.hypot(c.x - src.x, c.y - src.y) <= Math.hypot(tip.x - src.x, tip.y - src.y) + 2;
        if (reached) motes(g, c, Math.min(1, after + 0.3), 6, w * 0.5, '200,190,170', 0.9, f.seed + p.x, 0, 0.06, w);
      }
      break;
    }
    case 'volley':
    case 'aimed': {
      // tracer lines to each mark (a volley's three a beat apart; the aimed shot one bright line and a closing sight)
      const pts = (f.pts.length ? f.pts : [f.to]).map(body);
      g.globalCompositeOperation = 'lighter';
      pts.slice(0, 4).forEach((p, i) => {
        const q = clamp((t - f.t0 - i * 90) / Math.max(1, f.hit - f.t0));
        if (q <= 0) return;
        const head = lerp(src, p, ease(q)), tail = lerp(src, p, Math.max(0, ease(q) - 0.25));
        g.strokeStyle = `rgba(${rgb},${0.95 * (1 - Math.max(0, k - 0.7) / 0.3)})`;
        g.lineWidth = Math.max(1.5, w * (f.id === 'aimed' ? 0.06 : 0.04));
        g.beginPath();
        g.moveTo(tail.x, tail.y);
        g.lineTo(head.x, head.y);
        g.stroke();
        if (q >= 1) blob(g, '255,220,160', p.x, p.y, w * 0.5, 0.8 * fade, 0.3);
      });
      if (f.id === 'aimed') {
        const r = w * (1.1 - 0.6 * ease(Math.min(1, k * 2)));
        g.strokeStyle = `rgba(255,90,70,${0.9 * (1 - k)})`;
        g.lineWidth = Math.max(1.5, w * 0.045);
        g.beginPath();
        g.arc(dst.x, dst.y, r, 0, Math.PI * 2);
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          g.moveTo(dst.x + Math.cos(a) * r * 0.6, dst.y + Math.sin(a) * r * 0.6);
          g.lineTo(dst.x + Math.cos(a) * r * 1.3, dst.y + Math.sin(a) * r * 1.3);
        }
        g.stroke();
      }
      break;
    }
    case 'drain':
    case 'devour': {
      if (f.id === 'devour') {
        // jaws: two dark arcs snapping shut on the foe
        const q = ease(Math.min(1, fly * 1.2));
        g.strokeStyle = `rgba(30,50,60,${0.9 * (1 - after)})`;
        g.lineWidth = Math.max(3, w * 0.1);
        for (const sy of [-1, 1]) {
          g.beginPath();
          g.ellipse(dst.x, dst.y + sy * w * 0.5 * (1 - q), w * 0.7, w * 0.35, 0, sy < 0 ? 0 : Math.PI, sy < 0 ? Math.PI : Math.PI * 2);
          g.stroke();
        }
        g.globalCompositeOperation = 'lighter';
      } else if (!landed) {
        g.globalCompositeOperation = 'lighter';
        orb(g, src, dst, ease(fly), w * 0.3, w, '170,60,200', 0.2);
      }
      // what she drank flows back into her: red-violet beads along a curve
      if (landed) {
        g.globalCompositeOperation = 'lighter';
        const mid = { x: (src.x + dst.x) / 2, y: Math.min(src.y, dst.y) - w * 0.8 };
        for (let i = 0; i < 6; i++) {
          const q = clamp(after * 1.4 - i * 0.08);
          const x = (1 - q) * (1 - q) * dst.x + 2 * (1 - q) * q * mid.x + q * q * src.x, y = (1 - q) * (1 - q) * dst.y + 2 * (1 - q) * q * mid.y + q * q * src.y;
          blob(g, rgb, x, y, w * 0.12, 0.9 * (1 - after * 0.6), 0.4);
        }
      }
      break;
    }
    case 'rot':
    case 'miasma':
    case 'ink': {
      // a lump thrown over, then a cloud spreading on every one it took (rot: a brown-green bloom and flies; miasma:
      // green puffs; ink: black blots)
      if (!landed) {
        g.globalCompositeOperation = f.id === 'ink' ? 'source-over' : 'lighter';
        if (f.id === 'ink') {
          const q = lerp(src, dst, fly);
          g.fillStyle = 'rgba(20,20,30,0.95)';
          g.beginPath();
          g.arc(q.x, q.y - Math.sin(fly * Math.PI) * w * 0.6, w * 0.14, 0, Math.PI * 2);
          g.fill();
        } else orb(g, src, dst, fly, w * 0.6, w, rgb, 0.16);
        break;
      }
      for (const [i, p] of (f.pts.length ? f.pts : [f.to]).slice(0, 7).entries()) {
        const c = body(p);
        g.globalCompositeOperation = f.id === 'ink' ? 'source-over' : 'lighter';
        for (let j = 0; j < 6; j++) {
          const a = h01(f.seed + j + i * 7) * Math.PI * 2, d = w * 0.5 * ease(after) * h01(j * 3 + i);
          const r = w * (0.25 + 0.25 * h01(j + i * 5)) * (0.6 + 0.6 * ease(after));
          if (f.id === 'ink') {
            g.fillStyle = `rgba(16,16,26,${0.6 * fade})`;
            g.beginPath();
            g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.6, r * 0.6, 0, Math.PI * 2);
            g.fill();
          } else blob(g, rgb, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.6 - w * 0.2 * after, r, 0.5 * fade, 0.45);
        }
        if (f.id === 'rot') for (let j = 0; j < 4; j++) {
          const a = after * Math.PI * 6 + j * 1.7;
          blob(g, '40,40,30', c.x + Math.cos(a) * w * 0.35, c.y - w * 0.3 + Math.sin(a * 1.3) * w * 0.2, w * 0.035, 0.9 * fade, 0.8);
        }
      }
      break;
    }
    case 'curse':
    case 'mark': {
      // a hex bolt, then a sigil turning over the foe (curse: violet, five-pointed); a black spot stamped on her
      if (!landed) {
        g.globalCompositeOperation = 'lighter';
        orb(g, src, dst, ease(fly), w * 0.35, w, f.id === 'curse' ? rgb : '120,110,110', 0.18);
        break;
      }
      if (f.id === 'curse') {
        g.globalCompositeOperation = 'lighter';
        const r = w * 0.55, rot = after * Math.PI;
        g.strokeStyle = `rgba(200,130,255,${0.95 * fade})`;
        g.lineWidth = Math.max(1.5, w * 0.045);
        g.beginPath();
        for (let i = 0; i <= 5; i++) {
          const a = rot + (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const x = dst.x + Math.cos(a) * r, y = dst.y - w * 0.4 + Math.sin(a) * r * 0.5;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
        ring(g, dst.x, dst.y - w * 0.4, r * 1.1, '170,90,220', 0.9 * fade, Math.max(1.5, w * 0.04));
      } else {
        g.globalCompositeOperation = 'source-over';
        const q = ease(Math.min(1, after * 3));
        g.fillStyle = `rgba(10,8,8,${0.85 * fade})`;
        g.beginPath();
        g.arc(dst.x, dst.y - w * 0.6, w * 0.22 * (1.6 - 0.6 * q), 0, Math.PI * 2);
        g.fill();
        ring(g, f.to.x, f.to.y, w * 0.6, '230,210,170', 0.9 * fade, Math.max(1.5, w * 0.05), [w * 0.08, w * 0.06]);
      }
      break;
    }
    case 'siren':
    case 'toll':
    case 'taunt': {
      // waves out of her: a siren's sea-green sine ribbons to the foe; a knell's bronze rings; a challenge's red rings
      // and a line to every foe it caught
      g.globalCompositeOperation = 'lighter';
      if (f.id === 'siren') {
        const end = landed ? dst : lerp(src, dst, ease(fly));
        const len = Math.hypot(end.x - src.x, end.y - src.y) || 1, nx = -(end.y - src.y) / len, ny = (end.x - src.x) / len;
        for (let r = 0; r < 2; r++) {
          g.strokeStyle = `rgba(${r ? '255,190,220' : rgb},${0.85 * (1 - k)})`;
          g.lineWidth = Math.max(1.5, w * 0.04);
          g.beginPath();
          for (let i = 0; i <= 20; i++) {
            const q = i / 20, off = Math.sin(q * Math.PI * 4 + t / 90 + r * Math.PI) * w * 0.18;
            const x = src.x + (end.x - src.x) * q + nx * off, y = src.y + (end.y - src.y) * q + ny * off;
            if (i) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.stroke();
        }
        if (landed) {
          blob(g, rgb, dst.x, dst.y, w * 0.8, 0.4 * fade, 0.3);
          for (let i = 0; i < 3; i++) {
            const a = after * Math.PI * 3 + i * 2.1;
            blob(g, '255,200,230', dst.x + Math.cos(a) * w * 0.45, dst.y - w * 0.5 + Math.sin(a) * w * 0.2, w * 0.08, 0.9 * fade, 0.5);
          }
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const q = clamp(k * 1.6 - i * 0.2);
          ring(g, f.from.x, f.from.y, w * (0.4 + 1.9 * ease(q)), rgb, 0.85 * (1 - q), Math.max(2, w * 0.06));
        }
        if (landed) for (const p of f.pts.slice(0, 7)) {
          if (f.id === 'taunt') {
            g.strokeStyle = `rgba(${rgb},${0.7 * fade})`;
            g.lineWidth = Math.max(1, w * 0.03);
            g.setLineDash([w * 0.1, w * 0.08]);
            g.beginPath();
            g.moveTo(p.x, p.y - w * 0.5);
            g.lineTo(src.x, src.y);
            g.stroke();
            g.setLineDash([]);
          }
          blob(g, rgb, p.x, p.y - w * 0.5, w * 0.5, 0.5 * fade, 0.3);
        }
      }
      break;
    }
    case 'tidal': {
      // a wave rolling from her over the foe: a crest of foam sweeping on, spray where it breaks
      const a0 = Math.atan2(dst.y - src.y, dst.x - src.x);
      const d = Math.hypot(dst.x - src.x, dst.y - src.y) * (0.2 + 1.0 * ease(k));
      const cx = src.x + Math.cos(a0) * d, cy = src.y + Math.sin(a0) * d;
      g.globalCompositeOperation = 'lighter';
      for (let i = -4; i <= 4; i++) {
        const along = a0 + Math.PI / 2;
        const x = cx + Math.cos(along) * i * w * 0.28, y = cy + Math.sin(along) * i * w * 0.28;
        blob(g, i % 2 ? rgb : '230,245,255', x, y - Math.abs(Math.sin(i + k * 6)) * w * 0.2, w * 0.3, 0.75 * (1 - k), 0.35);
      }
      if (landed) for (const [i, p] of f.pts.slice(0, 7).entries()) motes(g, { x: p.x, y: p.y - w * 0.5 }, after, 7, w * 0.8, '200,235,255', 1, f.seed + i * 19, w * 0.4, 0.06, w);
      break;
    }
    case 'blink': {
      // a violet vortex where she was and where she comes out
      g.globalCompositeOperation = 'lighter';
      for (const [p, q] of [[f.from, 1 - clamp(k * 1.5)], [f.to, clamp(k * 1.5 - 0.2)]] as const) {
        const c = body(p);
        if (q <= 0) continue;
        g.strokeStyle = `rgba(${rgb},${0.9 * q * (1 - k * 0.5)})`;
        g.lineWidth = Math.max(1.5, w * 0.045);
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
          const s = i / 24, a = s * Math.PI * 4 + t / 120, r = w * 0.6 * s;
          const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r * 0.5;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
        blob(g, rgb, c.x, c.y, w * 0.6, 0.4 * q, 0.3);
      }
      break;
    }
    case 'summon': {
      // a portal of the deep opening on the hex: a dark-teal swirl, mist rising off it
      const p = f.end ?? f.to, c = { x: p.x, y: p.y - w * 0.1 };
      const q = ease(Math.min(1, k * 2));
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(10,30,34,${0.75 * (1 - k)})`;
      g.beginPath();
      g.ellipse(c.x, c.y, w * 0.6 * q, w * 0.26 * q, 0, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'lighter';
      for (let r = 0; r < 3; r++) ring(g, c.x, c.y, w * (0.2 + 0.2 * r) * q * (1 + 0.1 * Math.sin(t / 100 + r)), rgb, 0.85 * (1 - k), Math.max(1.5, w * 0.04));
      for (let i = 0; i < 8; i++) blob(g, '150,230,220', c.x + (h01(f.seed + i) - 0.5) * w, c.y - w * 1.4 * ((k * 1.2 + h01(i * 3)) % 1), w * 0.12, 0.7 * (1 - k), 0.5);
      break;
    }
    case 'death_blast': {
      // the powder goes up: a white flash, a fire ball, a ring of blast running out and embers flung
      const c = body(f.from);
      g.globalCompositeOperation = 'lighter';
      blob(g, '255,250,220', c.x, c.y, w * 1.2 * (1 - k), 0.9 * (1 - k * 2), 0.2);
      blob(g, rgb, c.x, c.y, w * (0.6 + 1.6 * ease(k)), 0.85 * (1 - k), 0.3);
      ring(g, f.from.x, f.from.y, w * (0.4 + 2.0 * ease(k)), '255,210,140', 0.95 * (1 - k), Math.max(2.5, w * 0.08));
      motes(g, c, k, 14, w * 1.8, '255,160,60', 1, f.seed, -w * 0.2, 0.07, w);
      g.globalCompositeOperation = 'source-over';
      blob(g, '60,56,52', c.x, c.y - w * 0.8 * k, w * (0.4 + 1.2 * k), 0.4 * k * (1 - k) * 4, 0.5);
      break;
    }
  }
  g.restore();
}

/** The magic kinds of shot (creatureskills.ts MAGIC_SHOTS), in flight: a hex bolt's violet, ghost fire's pale green-blue
 *  flicker, a spark's blue-white jag, lightning straight down the line, a fire bolt's orange with embers. `k` its way. */
export function drawMagicShot(g: CanvasRenderingContext2D, kind: ShotKind, a: Pt, b: Pt, k: number, w: number, t: number, seed: number): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (kind === 'bolt' || kind === 'spark') {
    bolt(g, a, lerp(a, b, ease(k)), seed + Math.floor(t / 50), kind === 'bolt' ? w : w * 0.6, kind === 'bolt' ? '180,210,255' : '150,220,255', 1);
  } else {
    const rgb = kind === 'hex' ? '180,90,230' : kind === 'ghost' ? '150,240,210' : '255,140,50';
    orb(g, a, b, k, Math.hypot(b.x - a.x, b.y - a.y) * 0.1, w, rgb, kind === 'fire' ? 0.24 : 0.2);
    if (kind === 'ghost') blob(g, '210,255,240', a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - w * 0.1 * Math.sin(t / 40), w * 0.12, 0.8, 0.4);
  }
  g.restore();
}
/** Where a magic shot lands: its colour's flash and a few motes (a moment after it lands, `q` 0..1). */
export function drawMagicHit(g: CanvasRenderingContext2D, kind: ShotKind, c: Pt, q: number, w: number, seed: number): void {
  if (q < 0 || q >= 1) return;
  const rgb = kind === 'hex' ? '190,110,240' : kind === 'ghost' ? '160,240,215' : kind === 'fire' ? '255,150,60' : '190,220,255';
  g.save();
  g.globalCompositeOperation = 'lighter';
  blob(g, rgb, c.x, c.y, w * (0.4 + 0.6 * ease(q)), 0.85 * (1 - q), 0.25);
  motes(g, c, q, 7, w * 0.7, rgb, 1, seed, w * (kind === 'ghost' ? 0.6 : 0.1), 0.06, w);
  g.restore();
}
