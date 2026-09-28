// Signs on the horizon (docs/12 P2), drawn by hand on the canvas: smoke, birds over a shoal, a spout, a glint, a raft,
// a fire, fins, a squall line, lights in the dark — each a small moving thing that makes a captain turn to look, and
// a gold "?" over it while it is still far off.

import type { ShoalView, SightView } from '../../../shared/src/protocol.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { lang } from '../i18n.ts';

type G = CanvasRenderingContext2D;

export function drawSights(g: G, list: SightView[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, own: { x: number; y: number } | null, w: number, h: number): void {
  for (const s of list) {
    const x = sx(s.x), y = sy(s.y);
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) {
      edgeMark(g, x, y, w, h, t + s.id);
      continue;
    }
    const k = Math.max(0.55, zoom);
    g.save();
    g.translate(x, y);
    drawOne(g, s.kind, k, t + s.id * 1.7);
    g.restore();
    // The question over it while she is still a way off.
    const d = own ? Math.hypot(s.x - own.x, s.y - own.y) : 0;
    if (d > 420) {
      const bob = Math.sin(t * 2 + s.id) * 3;
      g.font = `700 ${Math.round(15 + 4 * Math.min(1, zoom))}px Inter, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.strokeText('?', x, y - 34 * k + bob);
      g.fillStyle = '#e8c46a';
      g.fillText('?', x, y - 34 * k + bob);
    }
  }
}

/** A sign beyond the screen's edge: a gold "?" at the rim, pointing the way. */
function edgeMark(g: G, x: number, y: number, w: number, h: number, t: number): void {
  const cx = w / 2, cy = h / 2;
  const a = Math.atan2(y - cy, x - cx);
  const pad = 34;
  const k = Math.min((w / 2 - pad) / Math.max(1e-6, Math.abs(Math.cos(a))), (h / 2 - pad) / Math.max(1e-6, Math.abs(Math.sin(a))));
  const ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
  const pulse = 0.75 + 0.25 * Math.sin(t * 3);
  g.save();
  g.translate(ex, ey);
  g.fillStyle = `rgba(232,196,106,${0.85 * pulse})`;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, 11, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // The arrowhead toward it.
  g.rotate(a);
  g.beginPath();
  g.moveTo(17, 0);
  g.lineTo(11, -5);
  g.lineTo(11, 5);
  g.closePath();
  g.fill();
  g.rotate(-a);
  g.fillStyle = '#1a1206';
  g.font = '700 14px Inter, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 0, 1);
  g.restore();
}

function puff(g: G, x: number, y: number, r: number, a: number, color = '120,120,125'): void {
  g.fillStyle = `rgba(${color},${a})`;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function drawOne(g: G, kind: string, k: number, t: number): void {
  switch (kind) {
    case 'smoke':
    case 'beacon':
    case 'fire': {
      if (kind === 'fire') {
        const f = 0.6 + 0.4 * Math.sin(t * 9);
        const glow = g.createRadialGradient(0, 0, 0, 0, 0, 30 * k);
        glow.addColorStop(0, `rgba(255,170,60,${0.8 * f})`);
        glow.addColorStop(1, 'rgba(255,90,20,0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(0, 0, 30 * k, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2a1e14';
        g.fillRect(-12 * k, -3 * k, 24 * k, 6 * k);
      }
      for (let i = 0; i < 5; i++) {
        const life = (t * 0.35 + i / 5) % 1;
        puff(g, Math.sin(t * 0.7 + i) * 4 * k + life * 10 * k, -life * 60 * k, (4 + life * 10) * k, 0.45 * (1 - life), kind === 'fire' ? '60,55,55' : '150,150,155');
      }
      if (kind === 'beacon') puff(g, 0, 0, 4 * k, 0.9, '255,150,60');
      break;
    }
    case 'flare': {
      const life = (t * 0.4) % 1;
      puff(g, 0, -life * 70 * k, 5 * k, 1 - life, '255,70,60');
      puff(g, 0, -life * 70 * k, 14 * k, 0.25 * (1 - life), '255,70,60');
      g.fillStyle = '#5a4630';
      g.beginPath();
      g.ellipse(0, 0, 14 * k, 5 * k, 0.3, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'birds': {
      g.strokeStyle = 'rgba(235,235,230,0.9)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = t * 0.9 + (i * Math.PI * 2) / 6;
        const r = (14 + (i % 3) * 7) * k;
        const bx = Math.cos(a) * r, by = Math.sin(a) * r * 0.6 - 10 * k;
        const flap = Math.sin(t * 8 + i) * 2.5 * k;
        g.beginPath();
        g.moveTo(bx - 4 * k, by - flap);
        g.lineTo(bx, by);
        g.lineTo(bx + 4 * k, by - flap);
        g.stroke();
      }
      // The boiling water under them.
      for (let i = 0; i < 4; i++) puff(g, Math.sin(t * 3 + i * 2) * 8 * k, Math.cos(t * 2.4 + i) * 5 * k, 2.5 * k, 0.6, '220,235,240');
      break;
    }
    case 'raft':
    case 'boat': {
      const bob = Math.sin(t * 1.6) * 0.12;
      g.rotate(bob);
      g.fillStyle = kind === 'raft' ? '#6b5436' : '#5a4630';
      if (kind === 'raft') g.fillRect(-10 * k, -7 * k, 20 * k, 14 * k);
      else {
        g.beginPath();
        g.ellipse(0, 0, 14 * k, 5 * k, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#1c1612';
      g.beginPath();
      g.arc(-3 * k, 0, 2.2 * k, 0, Math.PI * 2);
      g.arc(4 * k, 1 * k, 2.2 * k, 0, Math.PI * 2);
      g.fill();
      // A rag on an oar, waving.
      g.strokeStyle = '#3a2e22';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(6 * k, 0);
      g.lineTo(6 * k, -18 * k);
      g.stroke();
      g.fillStyle = 'rgba(230,225,210,0.9)';
      g.beginPath();
      g.moveTo(6 * k, -18 * k);
      g.lineTo((13 + Math.sin(t * 6) * 2) * k, -15 * k);
      g.lineTo(6 * k, -12 * k);
      g.fill();
      break;
    }
    case 'lantern':
    case 'ghostlight':
    case 'glow': {
      const color = kind === 'lantern' ? '255,210,120' : kind === 'ghostlight' ? '160,255,200' : '90,210,255';
      const f = 0.6 + 0.4 * Math.sin(t * (kind === 'glow' ? 1.2 : 3));
      const r = (kind === 'glow' ? 60 : 22) * k;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(${color},${0.55 * f})`);
      gr.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'glint': {
      const f = Math.max(0, Math.sin(t * 3));
      g.strokeStyle = `rgba(255,236,170,${0.4 + 0.6 * f})`;
      g.lineWidth = 1.5;
      const r = (4 + 5 * f) * k;
      g.beginPath();
      g.moveTo(-r, 0);
      g.lineTo(r, 0);
      g.moveTo(0, -r);
      g.lineTo(0, r);
      g.stroke();
      puff(g, 0, 0, 3 * k, 0.8, '120,190,120');
      break;
    }
    case 'wreck': {
      g.rotate(0.5 + Math.sin(t * 0.5) * 0.05);
      g.fillStyle = 'rgba(40,34,30,0.9)';
      g.beginPath();
      g.ellipse(0, 0, 22 * k, 7 * k, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(200,200,190,0.5)';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -26 * k);
      g.stroke();
      break;
    }
    case 'debris': {
      g.fillStyle = '#6b5436';
      for (let i = 0; i < 7; i++) {
        g.save();
        g.translate(Math.sin(i * 2.3) * 22 * k, Math.cos(i * 1.7) * 14 * k);
        g.rotate(i + Math.sin(t + i) * 0.2);
        g.fillRect(-5 * k, -1.5 * k, 10 * k, 3 * k);
        g.restore();
      }
      break;
    }
    case 'mine': {
      const bob = Math.sin(t * 1.3) * 2 * k;
      g.fillStyle = '#141414';
      g.beginPath();
      g.arc(0, bob, 7 * k, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#141414';
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(Math.cos(a) * 7 * k, bob + Math.sin(a) * 7 * k);
        g.lineTo(Math.cos(a) * 11 * k, bob + Math.sin(a) * 11 * k);
        g.stroke();
      }
      break;
    }
    case 'bubbles': {
      for (let i = 0; i < 6; i++) {
        const life = (t * 0.6 + i / 6) % 1;
        g.strokeStyle = `rgba(210,235,245,${0.8 * (1 - life)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(Math.sin(i * 2.4) * 10 * k, Math.cos(i * 1.9) * 8 * k, (1.5 + life * 5) * k, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'fins': {
      g.fillStyle = '#2e3438';
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + (i * Math.PI * 2) / 3;
        const fx = Math.cos(a) * 18 * k, fy = Math.sin(a) * 10 * k;
        g.beginPath();
        g.moveTo(fx - 4 * k, fy);
        g.lineTo(fx, fy - 8 * k);
        g.lineTo(fx + 3 * k, fy);
        g.fill();
      }
      break;
    }
    case 'spout':
    case 'twister': {
      if (kind === 'twister') {
        g.strokeStyle = 'rgba(160,170,180,0.55)';
        g.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const y0 = -i * 12 * k;
          g.beginPath();
          g.ellipse(Math.sin(t * 3 + i) * 3 * k, y0, (5 + i * 3) * k, 2.5 * k, 0, 0, Math.PI * 2);
          g.stroke();
        }
      } else {
        const life = (t * 0.5) % 1;
        const hgt = Math.sin(life * Math.PI) * 30 * k;
        for (let i = 0; i < 8; i++) puff(g, Math.sin(i * 1.3) * 5 * k, -hgt * (i / 8), (2 + i * 0.6) * k, 0.55 * (1 - i / 10), '235,240,245');
        g.fillStyle = 'rgba(30,40,50,0.8)';
        g.beginPath();
        g.ellipse(0, 3 * k, 16 * k, 4 * k, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'squall': {
      g.fillStyle = 'rgba(15,18,24,0.45)';
      g.beginPath();
      g.ellipse(0, 0, 70 * k, 18 * k, 0.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(170,185,200,0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const rx = (i - 5) * 12 * k, ry = ((t * 40 + i * 13) % 30) * k - 15 * k;
        g.beginPath();
        g.moveTo(rx, ry);
        g.lineTo(rx - 3 * k, ry + 8 * k);
        g.stroke();
      }
      break;
    }
    case 'ice': {
      g.fillStyle = 'rgba(225,240,250,0.95)';
      g.strokeStyle = 'rgba(140,180,210,0.9)';
      g.beginPath();
      g.moveTo(-18 * k, 6 * k);
      g.lineTo(-8 * k, -14 * k);
      g.lineTo(6 * k, -8 * k);
      g.lineTo(18 * k, 4 * k);
      g.lineTo(4 * k, 10 * k);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
    case 'turtle': {
      g.rotate(Math.sin(t * 0.3) * 0.1);
      g.fillStyle = '#4a5a34';
      g.beginPath();
      g.ellipse(0, 0, 26 * k, 18 * k, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2f5a2a';
      for (let i = 0; i < 4; i++) puff(g, Math.sin(i * 2) * 10 * k, Math.cos(i * 2) * 7 * k, 5 * k, 0.95, '47,90,42');
      g.fillStyle = '#4a5a34';
      g.beginPath();
      g.ellipse(28 * k, 0, 7 * k, 5 * k, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'tentacle': {
      g.strokeStyle = 'rgba(120,70,120,0.95)';
      g.lineWidth = 5 * k;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 6 * k);
      g.quadraticCurveTo(10 * k * Math.sin(t * 1.5), -14 * k, 6 * k * Math.cos(t), -26 * k);
      g.stroke();
      break;
    }
    case 'calm': {
      g.strokeStyle = 'rgba(200,220,235,0.25)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const r = ((t * 10 + i * 20) % 60) * k;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'albatross': {
      const a = t * 0.6;
      const bx = Math.cos(a) * 20 * k, by = Math.sin(a) * 10 * k - 14 * k;
      const flap = Math.sin(t * 4) * 3 * k;
      g.strokeStyle = 'rgba(250,250,245,0.95)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx - 10 * k, by - flap);
      g.quadraticCurveTo(bx - 4 * k, by - 3 * k, bx, by);
      g.quadraticCurveTo(bx + 4 * k, by - 3 * k, bx + 10 * k, by - flap);
      g.stroke();
      break;
    }
    case 'sails': {
      g.fillStyle = 'rgba(235,230,215,0.9)';
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(i * 16 * k - 8 * k, 4 * k);
        g.lineTo(i * 16 * k - 8 * k, -16 * k);
        g.lineTo(i * 16 * k + 2 * k, 4 * k);
        g.fill();
      }
      break;
    }
    case 'song': {
      g.strokeStyle = 'rgba(210,190,240,0.6)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        for (let x = -24; x <= 24; x += 3) {
          const yy = Math.sin(x * 0.3 + t * 3 + i) * 3 - i * 8;
          if (x === -24) g.moveTo(x * k, yy * k);
          else g.lineTo(x * k, yy * k);
        }
        g.stroke();
      }
      break;
    }
    case 'wisps': {
      for (let i = 0; i < 5; i++) {
        const wx = Math.sin(t * 0.7 + i * 1.3) * 22 * k, wy = Math.cos(t * 0.9 + i * 2.1) * 12 * k;
        const gr = g.createRadialGradient(wx, wy, 0, wx, wy, 7 * k);
        gr.addColorStop(0, 'rgba(140,200,255,0.9)');
        gr.addColorStop(1, 'rgba(140,200,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(wx, wy, 7 * k, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'fog': {
      for (let i = 0; i < 6; i++) puff(g, Math.sin(i * 1.7 + t * 0.2) * 30 * k, Math.cos(i * 2.3) * 16 * k, 22 * k, 0.12, '200,205,210');
      break;
    }
    default:
      puff(g, 0, 0, 6 * k, 0.8, '232,196,106');
  }
}

/** Shoals (docs/12 P3): a darker boil on the water with birds over it; what swims in it once the craft reads the water.
 *  And a captain's own pots, as red buoys. */
export function drawShoals(g: G, list: ShoalView[], traps: { x: number; y: number }[], sx: (x: number) => number, sy: (y: number) => number, zoom: number, t: number, w: number, h: number): void {
  for (const s of list) {
    const x = sx(s.x), y = sy(s.y);
    const r = s.r * zoom;
    if (x < -r - 60 || y < -r - 60 || x > w + r + 60 || y > h + r + 60) continue;
    g.save();
    g.translate(x, y);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(10,30,40,${0.18 + 0.2 * s.full})`);
    gr.addColorStop(1, 'rgba(10,30,40,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    // The boil of the water.
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8 + t * 0.4, rr = r * (0.2 + ((i * 37) % 60) / 100);
      puff(g, Math.cos(a) * rr, Math.sin(a) * rr, (1.5 + (i % 3)) * Math.max(0.6, zoom), 0.45 * s.full + 0.15, '210,230,238');
    }
    drawOne(g, 'birds', Math.max(0.55, zoom), t + s.id);
    if (s.fish) {
      g.font = `600 ${Math.round(10 + 2 * Math.min(1, zoom))}px Inter, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      const label = FISH[s.fish].name[lang() === 'ru' ? 1 : 0];
      g.strokeText(label, 0, r + 12);
      g.fillStyle = '#bfe3ee';
      g.fillText(label, 0, r + 12);
    }
    g.restore();
  }
  for (const tr of traps) {
    const x = sx(tr.x), y = sy(tr.y);
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    const bob = Math.sin(t * 2 + tr.x) * 2;
    g.fillStyle = '#c23d33';
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y + bob, 4.5 * Math.max(0.7, zoom), 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = '#e8e2d0';
    g.beginPath();
    g.moveTo(x, y + bob - 4 * Math.max(0.7, zoom));
    g.lineTo(x, y + bob - 12 * Math.max(0.7, zoom));
    g.stroke();
  }
}
