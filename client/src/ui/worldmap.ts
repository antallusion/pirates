// World map: a dark nautical chart. Only what the captain has charted is drawn — information is a resource.

import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import { sprite } from '../assets.ts';
import type { ClientState } from '../state.ts';

export class WorldMap {
  private zoom = 1;
  private cx = WORLD_SIZE / 2;
  private cy = WORLD_SIZE / 2;
  private drag: { x: number; y: number; cx: number; cy: number } | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private centred = false;

  open(root: HTMLElement, state: ClientState): void {
    root.innerHTML = `<div class="modal-head"><div><h2>Chart of the Known Sea</h2><div class="sub">${state.discovered.size} islands charted · drag to pan, wheel to zoom</div></div><div class="muted">[M] close</div></div>
      <div class="map-wrap"><canvas id="worldmap-canvas"></canvas>
      <div class="map-legend"><span style="color:#e0b862">■</span> port · <span style="color:#f0e6c8">▲</span> you · <span style="color:#8fb3d9">- -</span> currents · <span style="color:#d06a5e">◆</span> contract destination</div></div>`;
    const c = root.querySelector('canvas')!;
    this.canvas = c;
    if (!this.centred && state.ownDisplay) {
      this.cx = state.ownDisplay.x;
      this.cy = state.ownDisplay.y;
      this.zoom = 3;
      this.centred = true;
    }
    c.onwheel = (e) => {
      e.preventDefault();
      this.zoom = Math.max(1, Math.min(14, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      this.draw(state);
    };
    c.onmousedown = (e) => (this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy });
    c.onmousemove = (e) => {
      if (!this.drag) return;
      const k = this.scale();
      this.cx = this.drag.cx - (e.clientX - this.drag.x) / k;
      this.cy = this.drag.cy - (e.clientY - this.drag.y) / k;
      this.draw(state);
    };
    c.onmouseup = c.onmouseleave = () => (this.drag = null);
    this.draw(state);
  }

  private scale(): number {
    const c = this.canvas!;
    return (Math.min(c.clientWidth, c.clientHeight) / WORLD_SIZE) * this.zoom;
  }

  draw(state: ClientState): void {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = c.clientWidth, H = c.clientHeight;
    const k = this.scale();
    const tx = (x: number) => (x - this.cx) * k + W / 2;
    const ty = (y: number) => (y - this.cy) * k + H / 2;
    const chart = sprite('tex.chart');
    g.fillStyle = '#070a0e';
    g.fillRect(0, 0, W, H);
    if (chart) {
      g.globalAlpha = 0.9;
      g.drawImage(chart.img, tx(0), ty(0), WORLD_SIZE * k, WORLD_SIZE * k);
      g.globalAlpha = 1;
    }
    // Grid.
    g.strokeStyle = 'rgba(176,141,87,0.12)';
    g.lineWidth = 1;
    for (let v = 0; v <= WORLD_SIZE; v += 8000) {
      g.beginPath();
      g.moveTo(tx(v), ty(0));
      g.lineTo(tx(v), ty(WORLD_SIZE));
      g.moveTo(tx(0), ty(v));
      g.lineTo(tx(WORLD_SIZE), ty(v));
      g.stroke();
    }
    // Maelstrom wall.
    g.strokeStyle = 'rgba(142,42,42,0.5)';
    g.setLineDash([6, 6]);
    g.strokeRect(tx(2500), ty(2500), (WORLD_SIZE - 5000) * k, (WORLD_SIZE - 5000) * k);
    g.setLineDash([]);
    // Currents (common sailor knowledge).
    g.strokeStyle = 'rgba(143,179,217,0.35)';
    g.setLineDash([8, 8]);
    for (const cur of state.currents) {
      g.beginPath();
      cur.points.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
      g.lineWidth = Math.max(1, cur.width * k * 0.15);
      g.stroke();
    }
    g.setLineDash([]);
    // Region names: only regions the captain has entered are named.
    g.textAlign = 'center';
    for (const id of REGION_IDS) {
      const r = REGIONS[id];
      g.font = `${Math.round(Math.max(12, 16 * Math.sqrt(this.zoom)))}px "IM Fell English SC", serif`;
      g.fillStyle = id === state.region ? 'rgba(224,184,98,0.55)' : 'rgba(216,210,196,0.22)';
      g.fillText(r.name.toUpperCase(), tx(r.center[0]), ty(r.center[1]));
    }
    // Charted islands.
    for (const id of state.discovered) {
      const is = state.islands.get(id);
      if (!is) continue;
      g.beginPath();
      for (let i = 0; i < is.poly.length; i += 2) {
        if (i === 0) g.moveTo(tx(is.poly[i]), ty(is.poly[i + 1]));
        else g.lineTo(tx(is.poly[i]), ty(is.poly[i + 1]));
      }
      g.closePath();
      g.fillStyle = REGIONS[is.region].strangeness > 0.4 ? '#3a4744' : '#4a4637';
      g.fill();
      g.strokeStyle = 'rgba(216,210,196,0.5)';
      g.lineWidth = 0.8;
      g.stroke();
      if (this.zoom > 4 && is.r > 150) {
        g.font = `italic 11px "Cormorant Garamond", serif`;
        g.fillStyle = 'rgba(216,210,196,0.6)';
        g.fillText(is.name, tx(is.x), ty(is.y) + 3);
      }
    }
    // Ports: key ports are on every chart; villages only once found.
    for (const p of state.ports) {
      const known = !p.id.includes('_v') || [...state.discovered].some((id) => state.islands.get(id)?.portId === p.id);
      if (!known) continue;
      g.fillStyle = FACTIONS[p.faction].lantern;
      g.fillRect(tx(p.x) - 4, ty(p.y) - 4, 8, 8);
      g.font = `${this.zoom > 2 ? 13 : 11}px "IM Fell English SC", serif`;
      g.fillStyle = 'rgba(240,230,200,0.85)';
      g.fillText(p.name, tx(p.x), ty(p.y) - 8);
    }
    // Contract destinations.
    for (const ct of state.self?.contracts ?? []) {
      const p = state.ports.find((q) => q.id === ct.toPort);
      if (!p) continue;
      g.fillStyle = '#d06a5e';
      g.beginPath();
      g.moveTo(tx(p.x), ty(p.y) - 12);
      g.lineTo(tx(p.x) + 6, ty(p.y) - 6);
      g.lineTo(tx(p.x), ty(p.y));
      g.lineTo(tx(p.x) - 6, ty(p.y) - 6);
      g.fill();
    }
    // You.
    const own = state.ownDisplay;
    if (own) {
      g.save();
      g.translate(tx(own.x), ty(own.y));
      g.rotate(own.heading);
      g.fillStyle = '#f0e6c8';
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(6, 7);
      g.lineTo(-6, 7);
      g.closePath();
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(240,230,200,0.4)';
      g.beginPath();
      g.arc(tx(own.x), ty(own.y), 2200 * k, 0, Math.PI * 2);
      g.stroke();
    }
  }
}
