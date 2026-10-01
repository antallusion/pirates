// The Grail's chart (docs/17 H4 item 16), as HoMM3's puzzle map: a sheet of old parchment cut into sixteen pieces,
// each obelisk read lifting one away to show the coasts beneath; the rest a blur of ink and water. The coasts come
// from the server only for the pieces she has opened, so the blur is a blur to her too. When the spot's own piece is
// open, the X; once half the pieces are open, the name of the waters. "Dig here" sends the boats ashore with spades.

import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { PuzzleView } from '../../../shared/src/h4proto.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h4.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

/** A small fixed noise so a blurred piece looks the same every time it is drawn. */
function noise(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/** One jigsaw edge between two corners, with a tab bulging out (`out` 1) or in (−1). */
function edge(g: Path2D, x0: number, y0: number, x1: number, y1: number, out: number): void {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const nx = (-dy / len) * out, ny = (dx / len) * out;
  const p = (t: number, o: number) => [x0 + dx * t + nx * o * len, y0 + dy * t + ny * o * len] as const;
  g.lineTo(...p(0.36, 0));
  g.bezierCurveTo(...p(0.4, 0.12), ...p(0.3, 0.22), ...p(0.5, 0.22));
  g.bezierCurveTo(...p(0.7, 0.22), ...p(0.6, 0.12), ...p(0.64, 0));
  g.lineTo(x1, y1);
}

export function drawPuzzle(c: HTMLCanvasElement, v: PuzzleView): void {
  const size = Math.min(c.clientWidth || 360, 560);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.height = `${size}px`;
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = size / v.w;
  const cell = size / v.grid;
  // The chart beneath: parchment sea, and the coasts she has (only those of her open pieces came).
  const sea = g.createLinearGradient(0, 0, size, size);
  sea.addColorStop(0, '#b9b08a');
  sea.addColorStop(1, '#a39a74');
  g.fillStyle = sea;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(70,60,40,0.18)';
  g.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    g.beginPath();
    g.moveTo((size * i) / 8, 0);
    g.lineTo((size * i) / 8, size);
    g.moveTo(0, (size * i) / 8);
    g.lineTo(size, (size * i) / 8);
    g.stroke();
  }
  for (const poly of v.coasts) {
    g.beginPath();
    for (let i = 0; i < poly.length; i += 2) {
      const x = poly[i] * k, y = poly[i + 1] * k;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = '#c9a86a';
    g.fill();
    g.strokeStyle = '#4a3a22';
    g.lineWidth = 1.4;
    g.stroke();
    // Hatching along the shore, as an old chart draws it.
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(90,70,40,0.25)';
    for (let d = -size; d < size * 2; d += 6) {
      g.beginPath();
      g.moveTo(d, 0);
      g.lineTo(d - size, size);
      g.stroke();
    }
    g.restore();
  }
  // The spot, once its own piece is open.
  if (v.x) {
    const [sx, sy] = [v.x[0] * k, v.x[1] * k];
    g.strokeStyle = '#a3241c';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(sx - 9, sy - 9);
    g.lineTo(sx + 9, sy + 9);
    g.moveTo(sx + 9, sy - 9);
    g.lineTo(sx - 9, sy + 9);
    g.stroke();
    g.font = 'italic 600 14px "Cormorant Garamond", Georgia, serif';
    g.fillStyle = '#5a1812';
    g.textAlign = 'center';
    g.fillText(L('pz.here'), sx, sy + 26);
  }
  // The pieces still in place: torn parchment with a blur of ink under it.
  const open = new Set(v.open);
  for (let i = 0; i < v.grid * v.grid; i++) {
    if (open.has(i)) continue;
    const cx = (i % v.grid) * cell, cy = Math.floor(i / v.grid) * cell;
    const r = noise(i * 7919 + v.season * 131 + 17);
    const piece = new Path2D();
    piece.moveTo(cx, cy);
    const tab = (a: number, b: number) => ((a * 31 + b * 17) % 2 ? 1 : -1);
    const col = i % v.grid, row = Math.floor(i / v.grid);
    if (row > 0) edge(piece, cx, cy, cx + cell, cy, -tab(col, row));
    else piece.lineTo(cx + cell, cy);
    if (col < v.grid - 1) edge(piece, cx + cell, cy, cx + cell, cy + cell, -tab(col + 1, row + 7));
    else piece.lineTo(cx + cell, cy + cell);
    if (row < v.grid - 1) edge(piece, cx + cell, cy + cell, cx, cy + cell, -tab(col, row + 1));
    else piece.lineTo(cx, cy + cell);
    if (col > 0) edge(piece, cx, cy + cell, cx, cy, -tab(col, row + 7));
    else piece.lineTo(cx, cy);
    piece.closePath();
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 6;
    const paper = g.createLinearGradient(cx, cy, cx + cell, cy + cell);
    paper.addColorStop(0, '#d9c596');
    paper.addColorStop(1, '#bea36c');
    g.fillStyle = paper;
    g.fill(piece);
    g.restore();
    g.save();
    g.clip(piece);
    // The blur: soft blots of ink where coasts might be.
    g.filter = 'blur(7px)';
    for (let b = 0; b < 6; b++) {
      g.fillStyle = `rgba(96,76,44,${0.22 + r() * 0.22})`;
      g.beginPath();
      g.ellipse(cx + r() * cell, cy + r() * cell, cell * (0.08 + r() * 0.2), cell * (0.06 + r() * 0.16), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.filter = 'none';
    g.restore();
    g.strokeStyle = 'rgba(60,45,25,0.8)';
    g.lineWidth = 1.5;
    g.stroke(piece);
  }
  // The frame.
  g.strokeStyle = '#3b2e1a';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, size - 3, size - 3);
}

export class PuzzleWindow {
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(): void {
    this.send({ t: 'h4', action: 'puzzle' });
  }

  /** Seconds of the dig (or of the diggers' rest) left now. */
  private left(state: ClientState, n: number): number {
    return Math.max(0, Math.ceil(n - (Date.now() - state.puzzleAt) / 1000));
  }

  render(root: HTMLElement, state: ClientState): void {
    const v = state.puzzle;
    if (!v) {
      root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('pz.title'))}</h2></div></div>`;
      return;
    }
    const digging = this.left(state, v.digging), wait = this.left(state, v.wait);
    const status = v.found ? `${esc(L('pz.found'))}${v.held ? ` ${esc(L('pz.held'))}` : v.built ? ` ${esc(L('pz.built'))}` : ''}` : '';
    const region = v.region ? REGIONS[v.region].name : '';
    const dig = v.found ? '' : `<button class="btn btn-primary" data-pzdig${digging || wait ? ' disabled' : ''}>${icon('map_treasure', '', 'ico-sm')}${esc(digging ? L('pz.digging', { n: digging }) : wait ? L('pz.wait', { n: wait }) : L('pz.dig'))}</button>`;
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('pz.title'))}</h2><div class="sub">${esc(L('pz.sub', { n: v.n, of: v.of }))}</div></div></div>
      <div class="pz-body"><div class="pz-wrap"><canvas class="pz-canvas"></canvas></div>
      <div class="pz-side"><p class="muted">${esc(v.n ? L('pz.hint') : L('pz.none'))}</p>
      ${region ? `<p class="pz-region">${esc(L('pz.region', { r: region.charAt(0).toUpperCase() + region.slice(1) }))}</p>` : ''}
      ${status ? `<p class="pz-status good">${status}</p>` : ''}${dig}</div></div>`;
    const c = root.querySelector<HTMLCanvasElement>('.pz-canvas')!;
    requestAnimationFrame(() => drawPuzzle(c, v));
    root.querySelector<HTMLButtonElement>('[data-pzdig]')?.addEventListener('click', () => this.send({ t: 'h4', action: 'dig' }));
  }
}
