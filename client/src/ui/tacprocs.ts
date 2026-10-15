// Owner, 2026-10-15 («надо не просто текстом показывать еще ход а с какимто эффектом и если есть еще какието плюшки то
// надо еще показываать их эффектами не только текстом»): what a turn or a blow carried beyond its harm, drawn on the
// field for a moment (0.6–1.2 s) over the stack it fell on — by hand on the canvas, in the deck's own dark gold, grey,
// sea-green and blood-free red: no picture made for it, no word needed (the small label stays with the numbers).
//   again   another turn at once (high morale, an order): a golden flare rising round her, a halo pulse
//   fear    a turn lost to fear or dread: a grey droop sinking over her
//   still   bound (the Siren's song, a bite that binds): chain links closing round her
//   mad     Fog Madness: a violet swirl
//   luck    a lucky blow, twice the harm: a four-leafed gold spark burst on the struck
//   heal    a stack mended, growing back, raised: green motes rising, a soft ring
//   drain   a drinker's draught: a red-violet thread from the struck to her, a bead running along it
//   shield  a stack in defence: a blue ripple round her feet
//   noret   a blow none answers (an ability): a pale blade's glint struck through a grey ring
//   all     the answer of one who answers every blow: a doubled orange ring
//   twice   her second blow: two crossed gold slashes
//   sweep   a sweep over every foe about her: an arc slashed round her
//   chill   chilled: ice-blue shards
//   poison  a bite left in her: green drips
//   resist  an order shrugged off: a blue shimmer on her hex
// Each is cheap: a few strokes and blobs a frame while it lasts, the list capped; with «меньше движения» (reduced
// motion) nothing moves, a short glow only.

import { blob } from './tacvfx.ts';

export type ProcKind = 'again' | 'fear' | 'still' | 'mad' | 'luck' | 'heal' | 'drain' | 'shield' | 'noret' | 'all' | 'twice' | 'sweep' | 'chill' | 'poison' | 'resist';

/** One effect: its kind, where (stage px: the stack's feet), since when, how long; `x2,y2` a thread's other end. */
export interface Proc {
  k: ProcKind;
  x: number;
  y: number;
  t0: number;
  dur: number;
  x2?: number;
  y2?: number;
  /** a tint for the kind that has two (heal: green, or a raise's pale gold) */
  rgb?: string;
}

export const PROC_MS: Record<ProcKind, number> = {
  again: 1100, fear: 950, still: 1000, mad: 950, luck: 750, heal: 1000, drain: 850, shield: 800, noret: 700, all: 700, twice: 650, sweep: 600, chill: 750, poison: 800, resist: 750,
};
/** The most drawn at once (a sweep over six, a volley's): older ones let go. */
export const PROC_CAP = 24;

const ease = (k: number) => 1 - (1 - k) * (1 - k);

/** A ring on the deck round (x, y): an ellipse, the deck seen from above at the figures' slant. */
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

/** Small pseudo-random by an index (the same every frame: no allocation, no jitter). */
const h01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Draw one effect at time `t`; `w` the hex's width; `still`: reduced motion (a glow only, nothing moving). */
export function drawProc(g: CanvasRenderingContext2D, p: Proc, t: number, w: number, still: boolean): void {
  const k = (t - p.t0) / p.dur;
  if (k < 0 || k >= 1) return;
  const fade = k < 0.15 ? k / 0.15 : 1 - Math.max(0, k - 0.55) / 0.45;
  const { x, y } = p;
  const body = y - w * 0.55; // the figure's middle
  g.save();
  g.lineCap = 'round';
  if (still) {
    const rgb = STILL_RGB[p.k];
    g.globalCompositeOperation = 'lighter';
    blob(g, rgb, x, body, w * 0.9, 0.35 * fade, 0.3);
    g.restore();
    return;
  }
  switch (p.k) {
    case 'again': {
      // a column of gold light rising round her, a halo pulsing out at her feet, motes climbing
      g.globalCompositeOperation = 'lighter';
      blob(g, '255,206,110', x, body - w * 0.2 * ease(k), w * (0.7 + 0.5 * k), 0.55 * fade, 0.25);
      ring(g, x, y, w * (0.35 + 0.65 * ease(k)), '255,214,120', 0.9 * fade, Math.max(1.5, w * 0.06));
      ring(g, x, y, w * (0.2 + 0.4 * ease(k)), '255,236,180', 0.6 * fade, Math.max(1, w * 0.035));
      for (let i = 0; i < 7; i++) {
        const a = h01(i + 1) * Math.PI * 2, r = w * (0.25 + 0.3 * h01(i + 9));
        const yy = y - w * (0.1 + 1.5 * ((k * 1.2 + h01(i + 4) * 0.4) % 1));
        blob(g, '255,220,140', x + Math.cos(a) * r, yy, w * 0.08, 0.9 * fade, 0.5);
      }
      break;
    }
    case 'fear': {
      // a grey droop: a pall sinking over her, a dim ring tightening
      g.globalCompositeOperation = 'source-over';
      blob(g, '40,42,48', x, body - w * 0.5 + w * 0.6 * ease(k), w * 0.85, 0.55 * fade, 0.4);
      ring(g, x, y, w * (0.75 - 0.35 * ease(k)), '150,150,160', 0.7 * fade, Math.max(1.5, w * 0.05), [w * 0.12, w * 0.08]);
      for (let i = 0; i < 4; i++) {
        const xx = x + (h01(i + 2) - 0.5) * w * 0.9;
        blob(g, '90,92,100', xx, body - w * 0.6 + w * 0.9 * ((k + h01(i + 7) * 0.5) % 1), w * 0.12, 0.6 * fade, 0.5);
      }
      break;
    }
    case 'still': {
      // chain links closing round her: two dashed rings turning against each other, drawing in
      const r = w * (0.85 - 0.25 * ease(k));
      const lw = Math.max(2, w * 0.07);
      g.lineDashOffset = k * w * 1.4;
      ring(g, x, body + w * 0.25, r, '176,184,196', 0.95 * fade, lw, [w * 0.14, w * 0.07]);
      g.lineDashOffset = -k * w * 1.4;
      ring(g, x, body - w * 0.15, r * 0.9, '120,128,140', 0.85 * fade, lw * 0.8, [w * 0.14, w * 0.07]);
      g.lineDashOffset = 0;
      break;
    }
    case 'mad': {
      // a violet swirl over her head
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(178,110,230,${0.85 * fade})`;
      g.lineWidth = Math.max(1.5, w * 0.05);
      g.beginPath();
      for (let i = 0; i <= 28; i++) {
        const q = i / 28, a = q * Math.PI * 4 + k * Math.PI * 3, r = w * 0.55 * q;
        const xx = x + Math.cos(a) * r, yy = body - w * 0.35 + Math.sin(a) * r * 0.45;
        if (i) g.lineTo(xx, yy);
        else g.moveTo(xx, yy);
      }
      g.stroke();
      blob(g, '160,90,220', x, body - w * 0.35, w * 0.6, 0.35 * fade, 0.3);
      break;
    }
    case 'luck': {
      // a four-leafed gold spark burst on the struck, rays thrown out and fading
      g.globalCompositeOperation = 'lighter';
      blob(g, '255,224,120', x, body, w * (0.5 + 0.6 * ease(k)), 0.7 * fade, 0.2);
      g.strokeStyle = `rgba(255,232,140,${0.95 * fade})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8, long = i % 2 ? 0.55 : 1;
        const r0 = w * 0.18 * ease(k), r1 = w * (0.3 + 0.75 * long) * ease(k);
        g.lineWidth = Math.max(1.5, w * (i % 2 ? 0.04 : 0.07));
        g.beginPath();
        g.moveTo(x + Math.cos(a) * r0, body + Math.sin(a) * r0);
        g.lineTo(x + Math.cos(a) * r1, body + Math.sin(a) * r1);
        g.stroke();
      }
      // the clover's four leaves
      g.fillStyle = `rgba(150,220,110,${0.8 * fade})`;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + k;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * w * 0.13, body + Math.sin(a) * w * 0.13, w * 0.11, w * 0.07, a, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'heal': {
      // motes rising, a soft ring at her feet
      const rgb = p.rgb ?? '120,230,160';
      g.globalCompositeOperation = 'lighter';
      ring(g, x, y, w * (0.4 + 0.3 * ease(k)), rgb, 0.7 * fade, Math.max(1.5, w * 0.05));
      for (let i = 0; i < 9; i++) {
        const xx = x + (h01(i + 3) - 0.5) * w * 1.0;
        const yy = y - w * 1.6 * ((k * 1.1 + h01(i + 11) * 0.6) % 1);
        blob(g, rgb, xx, yy, w * (0.06 + 0.05 * h01(i)), 0.9 * fade, 0.5);
      }
      blob(g, rgb, x, body, w * 0.7, 0.25 * fade, 0.3);
      break;
    }
    case 'drain': {
      // a red-violet thread from the struck (x2, y2) to her, a bead of it running home
      const x2 = p.x2 ?? x, y2 = (p.y2 ?? y) - w * 0.55;
      const mx = (x + x2) / 2, my = Math.min(body, y2) - w * 0.7;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(196,60,120,${0.85 * fade})`;
      g.lineWidth = Math.max(1.5, w * 0.05);
      g.beginPath();
      g.moveTo(x2, y2);
      g.quadraticCurveTo(mx, my, x, body);
      g.stroke();
      const q = ease(Math.min(1, k * 1.25));
      const bx = (1 - q) * (1 - q) * x2 + 2 * (1 - q) * q * mx + q * q * x, by = (1 - q) * (1 - q) * y2 + 2 * (1 - q) * q * my + q * q * body;
      blob(g, '230,80,150', bx, by, w * 0.2, fade, 0.4);
      break;
    }
    case 'shield': {
      // a blue ripple round her feet, twice
      for (let i = 0; i < 2; i++) {
        const q = Math.min(1, Math.max(0, k * 1.4 - i * 0.3));
        ring(g, x, y, w * (0.3 + 0.55 * ease(q)), '120,180,240', (1 - q) * 0.95 * fade, Math.max(1.5, w * 0.055));
      }
      g.globalCompositeOperation = 'lighter';
      blob(g, '90,150,230', x, body, w * 0.65, 0.22 * fade, 0.35);
      break;
    }
    case 'noret': {
      // no answer: a pale blade's glint struck through a grey ring at her middle
      ring(g, x, body, w * 0.42, '170,170,176', 0.85 * fade, Math.max(1.5, w * 0.05));
      const q = ease(Math.min(1, k * 2));
      g.strokeStyle = `rgba(235,240,250,${0.95 * fade})`;
      g.lineWidth = Math.max(2, w * 0.06);
      g.beginPath();
      g.moveTo(x - w * 0.45, body + w * 0.25);
      g.lineTo(x - w * 0.45 + w * 0.9 * q, body + w * 0.25 - w * 0.5 * q);
      g.stroke();
      break;
    }
    case 'all': {
      ring(g, x, y, w * (0.45 + 0.2 * ease(k)), '240,140,70', 0.9 * fade, Math.max(1.5, w * 0.05));
      ring(g, x, y, w * (0.62 + 0.25 * ease(k)), '240,170,90', 0.6 * fade, Math.max(1, w * 0.035));
      break;
    }
    case 'twice': {
      // two crossed gold slashes, one after the other
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = Math.max(2, w * 0.07);
      for (let i = 0; i < 2; i++) {
        const q = ease(Math.min(1, Math.max(0, k * 2.2 - i * 0.45)));
        if (q <= 0) continue;
        const sx = i ? 1 : -1;
        g.strokeStyle = `rgba(255,214,120,${0.95 * fade})`;
        g.beginPath();
        g.moveTo(x + sx * w * 0.4, body - w * 0.4);
        g.lineTo(x + sx * w * 0.4 - sx * w * 0.8 * q, body - w * 0.4 + w * 0.8 * q);
        g.stroke();
      }
      break;
    }
    case 'sweep': {
      // an arc slashed round her, sweeping the hexes beside her
      const a0 = -Math.PI * 0.9, span = Math.PI * 1.8 * ease(k);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(230,236,245,${0.9 * fade})`;
      g.lineWidth = Math.max(2.5, w * 0.08);
      g.beginPath();
      g.ellipse(x, body + w * 0.2, w * 1.05, w * 0.5, 0, a0, a0 + span);
      g.stroke();
      g.strokeStyle = `rgba(160,190,230,${0.5 * fade})`;
      g.lineWidth = Math.max(1.5, w * 0.04);
      g.beginPath();
      g.ellipse(x, body + w * 0.2, w * 1.2, w * 0.58, 0, a0, a0 + span * 0.9);
      g.stroke();
      break;
    }
    case 'chill': {
      // ice-blue shards about her
      g.globalCompositeOperation = 'lighter';
      blob(g, '150,210,255', x, body, w * 0.7, 0.3 * fade, 0.3);
      g.strokeStyle = `rgba(200,236,255,${0.95 * fade})`;
      g.lineWidth = Math.max(1.5, w * 0.045);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + h01(i) * 0.5, r0 = w * 0.25, r1 = w * (0.35 + 0.3 * ease(k));
        g.beginPath();
        g.moveTo(x + Math.cos(a) * r0, body + Math.sin(a) * r0 * 0.8);
        g.lineTo(x + Math.cos(a) * r1, body + Math.sin(a) * r1 * 0.8);
        g.stroke();
      }
      break;
    }
    case 'poison': {
      // green drips running down her
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const xx = x + (h01(i + 5) - 0.5) * w * 0.8;
        const yy = body - w * 0.4 + w * 0.9 * ((k * 1.2 + h01(i + 13) * 0.5) % 1);
        blob(g, '130,220,90', xx, yy, w * 0.08, 0.95 * fade, 0.5);
      }
      blob(g, '100,190,70', x, body, w * 0.55, 0.22 * fade, 0.3);
      break;
    }
    case 'resist': {
      // a blue shimmer standing on her hex
      g.globalCompositeOperation = 'lighter';
      blob(g, '140,190,230', x, body, w * (0.6 + 0.2 * Math.sin(k * Math.PI * 4)), 0.45 * fade, 0.3);
      ring(g, x, y, w * 0.6, '170,210,240', 0.8 * fade, Math.max(1.5, w * 0.05), [w * 0.06, w * 0.06]);
      break;
    }
  }
  g.restore();
}

const STILL_RGB: Record<ProcKind, string> = {
  again: '255,206,110', fear: '120,120,130', still: '170,180,196', mad: '170,100,220', luck: '255,224,120', heal: '120,230,160', drain: '200,70,130', shield: '110,170,240',
  noret: '200,200,210', all: '240,150,80', twice: '255,214,120', sweep: '220,230,245', chill: '170,220,255', poison: '130,220,90', resist: '150,200,235',
};
