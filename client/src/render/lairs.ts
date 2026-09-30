// A named pirate's lair on its island (docs/16 #7), drawn from the props already painted: the fort (`prop.fort`, in
// ruins once silenced — `prop.ruins`), its guns on the shore (small forts, `prop.life_fort`, each with a barrel drawn
// by hand that follows its last shot), the pirates' tents and crates and boats (`prop.life_*`) and the black flag.
// The shots themselves — the painted muzzle blast, the smoke, the ball — are the effects' (fx.ts `lair_gun`).

import type { LairView } from '../../../shared/src/protocol.ts';
import { sprite } from '../assets.ts';
import type { Fx } from './fx.ts';

type G = CanvasRenderingContext2D;

export interface LairCtx {
  sx: (x: number) => number;
  sy: (y: number) => number;
  zoom: number;
  time: number;
  night: number;
  w: number;
  h: number;
  fx: Fx;
  label: (l: LairView) => { name: string; state: string | null; color: string };
}

/** A painted prop at world size `size` (m), turned by rot; false when it has not loaded. A soft shadow under it. */
function art(g: G, id: string, x: number, y: number, size: number, rot = 0, shadow = 0.35): boolean {
  const sp = sprite(id);
  if (!sp) return false;
  const k = size / Math.max(sp.img.naturalWidth, sp.img.naturalHeight);
  const w = sp.img.naturalWidth * k, h = sp.img.naturalHeight * k;
  if (shadow > 0) {
    g.fillStyle = `rgba(0,0,0,${shadow})`;
    g.beginPath();
    g.ellipse(x + size * 0.07, y + size * 0.09, (w * sp.extentX) / 2, (h * sp.extentY) / 2, rot, 0, Math.PI * 2);
    g.fill();
  }
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.drawImage(sp.img, -w / 2, -h / 2, w, h);
  g.restore();
  return true;
}

export function drawLair(g: G, l: LairView, c: LairCtx): void {
  const z = c.zoom;
  const x = c.sx(l.x), y = c.sy(l.y);
  const reach = 260 * z;
  if (x < -reach || y < -reach || x > c.w + reach || y > c.h + reach) return;
  const down = l.hp <= 0;
  // Seaward: from the fort to its middle gun.
  const [mgx, mgy] = l.guns[1] ?? l.guns[0] ?? [l.x, l.y - 1];
  const ox0 = mgx - l.x, oy0 = mgy - l.y, ol = Math.hypot(ox0, oy0) || 1;
  const ox = ox0 / ol, oy = oy0 / ol, tx = -oy, ty = ox;
  const facingSea = Math.atan2(ox, -oy);
  // The cleared ground of the fort and its guns: bare earth and trodden sand, so the stone stands out of the green.
  g.fillStyle = 'rgba(150,132,104,0.42)';
  g.beginPath();
  g.ellipse(x, y, 62 * z, 62 * z, 0, 0, Math.PI * 2);
  g.fill();
  for (const [gx, gy] of l.guns) {
    g.beginPath();
    g.arc(c.sx(gx), c.sy(gy), 20 * z, 0, Math.PI * 2);
    g.fill();
  }
  // The camp behind the fort: two tents, the stores.
  for (const side of [-1, 1]) {
    const px = x + (-ox * 34 + tx * side * 30) * z, py = y + (-oy * 34 + ty * side * 30) * z;
    art(g, 'prop.life_pirate_tent', px, py, 20 * z, facingSea + side * 0.3);
  }
  art(g, 'prop.life_crates', x + (-ox * 18 + tx * 44) * z, y + (-oy * 18 + ty * 44) * z, 15 * z, facingSea);
  // The fort, or its ruins with the smoke still going up.
  if (down) {
    if (!art(g, 'prop.ruins', x, y, 90 * z, facingSea)) fallbackFort(g, x, y, z, true);
    if (Math.random() < 0.05) c.fx.smoke(l.x + (Math.random() - 0.5) * 40, l.y + (Math.random() - 0.5) * 40, 1, 12, true);
  } else if (!art(g, 'prop.fort', x, y, 96 * z, facingSea)) fallbackFort(g, x, y, z, false);
  // The black flag over it (struck when the lair is stormed).
  if (!l.stormed) {
    const fx = x - ox * 6 * z, fy = y - oy * 6 * z;
    g.strokeStyle = '#1e1812';
    g.lineWidth = Math.max(1, 1.4 * z);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx, fy - 30 * z);
    g.stroke();
    const flap = Math.sin(c.time * 4 + l.x) * 2.5 * z;
    g.fillStyle = '#0c0c0c';
    g.beginPath();
    g.moveTo(fx, fy - 30 * z);
    g.lineTo(fx + 16 * z, fy - 26 * z + flap);
    g.lineTo(fx, fy - 20 * z);
    g.closePath();
    g.fill();
    g.fillStyle = '#d8d0bc';
    g.beginPath();
    g.arc(fx + 6 * z, fy - 25.5 * z + flap * 0.4, 1.6 * z, 0, Math.PI * 2);
    g.fill();
  }
  // The guns on the shore: a stone emplacement each, the barrel following its last shot.
  const nowS = (globalThis.performance?.now() ?? Date.now()) / 1000;
  for (const [gx, gy] of l.guns) {
    const px = c.sx(gx), py = c.sy(gy);
    const shot = c.fx.gunShots.get(`${gx},${gy}`);
    const aim = shot && nowS - shot.at < 30 ? shot.dir : Math.atan2(gx - l.x, -(gy - l.y));
    // A stone platform with a parapet, the painted small fort on it, the gun's black barrel over it.
    g.fillStyle = down ? '#4a463f' : '#8d877b';
    g.strokeStyle = 'rgba(20,16,12,0.9)';
    g.lineWidth = Math.max(1, 1.6 * z);
    g.beginPath();
    g.arc(px, py, 11 * z, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    art(g, 'prop.life_fort', px, py, 26 * z, aim, 0.3);
    const since = shot ? nowS - shot.at : 99;
    const recoil = since < 0.5 ? (1 - since / 0.5) * 4 * z : 0;
    g.save();
    g.translate(px, py);
    g.rotate(down ? aim + 0.6 : aim);
    g.fillStyle = down ? '#2a2724' : '#0d0f11';
    g.fillRect(-2.6 * z, -19 * z + recoil, 5.2 * z, 18 * z);
    g.fillRect(-3.4 * z, -20 * z + recoil, 6.8 * z, 3 * z);
    g.fillStyle = down ? '#3a3632' : '#2a2e33';
    g.beginPath();
    g.arc(0, recoil * 0.3, 4.4 * z, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // After the shot: the barrel's mouth glows and a bank of powder smoke hangs over the gun for a few seconds.
    if (since < 4) {
      const k = 1 - since / 4;
      const smoke = sprite('part.smoke');
      const mx = px + Math.sin(aim) * 20 * z, my = py - Math.cos(aim) * 20 * z;
      if (smoke) {
        g.save();
        g.globalAlpha = 0.55 * k;
        const d = (34 + 40 * (1 - k)) * z;
        g.translate(mx + Math.sin(aim) * (1 - k) * 18 * z, my - Math.cos(aim) * (1 - k) * 18 * z);
        g.rotate(aim + since * 0.3);
        g.filter = 'grayscale(1) brightness(0.8)';
        g.drawImage(smoke.img, -d / 2, -d / 2, d, d);
        g.restore();
      }
      if (since < 0.6) {
        const grd = g.createRadialGradient(mx, my, 0, mx, my, 14 * z);
        grd.addColorStop(0, `rgba(255,200,120,${0.9 * (1 - since / 0.6)})`);
        grd.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(mx, my, 14 * z, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (down && Math.random() < 0.02) c.fx.smoke(gx, gy, 1, 8, true);
    // Its boat drawn up below it.
    art(g, 'prop.life_boat', px + ox * 24 * z, py + oy * 24 * z, 12 * z, facingSea + Math.PI / 2, 0.25);
  }
  // Torches by night.
  if (c.night > 0.25 && !l.stormed) c.fx.light(l.x, l.y, 160, 'rgba(255,160,80,1)', 0.6 * c.night, 0.05);
  // Its name and state above it, when near enough to read.
  if (z < 0.3) return;
  const lb = c.label(l);
  g.save();
  g.textAlign = 'center';
  g.font = `600 ${Math.round(Math.max(11, Math.min(14, 12 * Math.sqrt(z))))}px Inter, sans-serif`;
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  const ly = y - 62 * z;
  g.strokeText(lb.name, x, ly);
  g.fillStyle = '#e8d8b8';
  g.fillText(lb.name, x, ly);
  if (lb.state) {
    g.font = `500 ${Math.round(Math.max(10, Math.min(12, 11 * Math.sqrt(z))))}px Inter, sans-serif`;
    g.strokeText(lb.state, x, ly + 14);
    g.fillStyle = lb.color;
    g.fillText(lb.state, x, ly + 14);
  }
  g.restore();
}

/** The fort drawn by hand while its painting loads: a star of grey stone, broken when silenced. */
function fallbackFort(g: G, x: number, y: number, z: number, broken: boolean): void {
  g.fillStyle = broken ? '#4a4640' : '#6a6760';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = (i % 2 ? 18 : 32) * z * (broken && i % 3 === 0 ? 0.7 : 1);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#3c3a36';
  g.fillRect(x - 9 * z, y - 9 * z, 18 * z, 18 * z);
}

/** The shore guns' flashes: the painted muzzle blast, turned along the shot, bright and brief. */
export function drawMuzzles(g: G, fx: Fx, sx: (x: number) => number, sy: (y: number) => number, zoom: number): void {
  const sp = sprite('part.muzzle');
  for (const m of fx.muzzles) {
    const a = 1 - m.t / m.life;
    const size = (26 + 20 * (1 - a)) * zoom;
    const x = sx(m.x), y = sy(m.y);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a;
    g.translate(x, y);
    g.rotate(m.dir);
    if (sp) {
      const k = size / Math.max(sp.img.naturalWidth, sp.img.naturalHeight);
      const w = sp.img.naturalWidth * k, h = sp.img.naturalHeight * k;
      g.drawImage(sp.img, -w / 2, -h * 0.85, w, h);
    } else {
      const grd = g.createRadialGradient(0, -size * 0.3, 0, 0, -size * 0.3, size * 0.6);
      grd.addColorStop(0, '#fff4d0');
      grd.addColorStop(0.4, '#ffb050');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, -size * 0.3, size * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
