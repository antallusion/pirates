// Strictly top-down renderer (Canvas 2D). Layer order:
// ocean → currents & wind streaks → shallows/islands → ports & props → wakes → loot → ships →
// projectiles & particles → darkness/light pass → fog/rain → screen-space overlays.
// Art rules: docs/06_ART_DIRECTION.md (near-black water, warm lanterns vs cold ocean, turquoise ≤ 8%).

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GUNS, SHIP_CLASSES, AMMO, CHASER_CONE } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { nightFactor } from '../../../shared/src/constants.ts';
import { clamp, headingVec } from '../../../shared/src/math.ts';
import type { IslandData, ShipInfo } from '../../../shared/src/protocol.ts';
import { SF, curseStageFromFlags } from '../../../shared/src/protocol.ts';
import { fbm } from '../../../shared/src/rng.ts';
import type { SailState } from '../../../shared/src/sim/sailing.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { IslandBiome } from '../../../shared/src/world/regions.ts';
import { pattern, sprite } from '../assets.ts';
import type { ClientState, RemoteShip } from '../state.ts';
import { Fx } from './fx.ts';
import { drawBossZones, drawMonster, drawPveSites } from './monsters.ts';
import { GlSea, GlSky, glWanted } from './gl.ts';
import { CELL, SpriteAtlas } from './atlas.ts';
import type { SailKey } from './atlas.ts';
import { FACTION_SIGN } from './relation.ts';
import { buildRelief } from './terrain.ts';
import type { Palette } from './terrain.ts';
import { dict } from '../i18n.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';

const L = dict(REN, RRU);
const hasRole = (r: string): r is 'merchant' => `role.${r}` in REN;
import { cbColor, settings } from '../settings.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';

const BIOME_TINT: Record<IslandBiome, string> = {
  temperate: 'rgba(40,52,40,0.35)',
  mossy: 'rgba(38,58,48,0.4)',
  volcanic: 'rgba(40,18,14,0.55)',
  ice: 'rgba(170,185,200,0.45)',
  ruins: 'rgba(40,60,62,0.45)',
  bone: 'rgba(150,145,130,0.4)',
  barren: 'rgba(70,64,55,0.4)',
};
const BIOME_BASE: Record<IslandBiome, string> = {
  temperate: '#2a3026', mossy: '#26322b', volcanic: '#1d1614', ice: '#8d98a3', ruins: '#2a3131', bone: '#6f6a5f', barren: '#3b372f',
};

/** Higgsfield art by biome: the land, its shore, and what grows or lies on it. */
const BIOME_LAND: Record<IslandBiome, string> = {
  temperate: 'tex.land_temperate', mossy: 'tex.land_mossy', volcanic: 'tex.land_volcanic', ice: 'tex.land_ice', ruins: 'tex.land_ruins', bone: 'tex.land_bone', barren: 'tex.land_barren',
};
const BIOME_SHORE: Record<IslandBiome, string> = {
  temperate: 'tex.sand', mossy: 'tex.rock', volcanic: 'tex.shore_black', ice: 'tex.shore_ice', ruins: 'tex.rock', bone: 'tex.land_bone', barren: 'tex.rock',
};
const BIOME_DECOR: Record<IslandBiome, string> = {
  temperate: 'prop.decor_temperate', mossy: 'prop.decor_mossy', volcanic: 'prop.decor_volcanic', ice: 'prop.decor_ice', ruins: 'prop.decor_barren', bone: 'prop.decor_bone', barren: 'prop.decor_barren',
};
/** Island features: the sprite, its size in metres, where it stands (salt, inset toward the centre). */
const FEATURE_ART: Record<string, { id: string; size: number; salt: number; inset: number }> = {
  lighthouse: { id: 'prop.lighthouse', size: 70, salt: 1, inset: 0.04 },
  wreck: { id: 'prop.shipwreck', size: 80, salt: 2, inset: -0.1 },
  ruins: { id: 'prop.ruins', size: 110, salt: 3, inset: 0.3 },
  shrine: { id: 'prop.shrine', size: 70, salt: 4, inset: 0.35 },
  grove: { id: 'prop.grove', size: 120, salt: 5, inset: 0.4 },
  mine: { id: 'prop.mine', size: 70, salt: 6, inset: 0.3 },
  pearl_bank: { id: 'prop.pearl_bank', size: 80, salt: 7, inset: -0.06 },
  cache: { id: 'prop.cache', size: 34, salt: 8, inset: 0.25 },
};

interface Decor {
  x: number;
  y: number;
  rot: number;
  size: number;
  /** A big clump on a green island is a whole grove. */
  grove: boolean;
}

/** A small deterministic generator (the same island always wears the same decor). */
function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function inPoly(poly: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface DrawShip {
  id: number;
  x: number;
  y: number;
  h: number;
  spd: number;
  sail: number;
  hull: number;
  sails: number;
  flags: number;
  classId: ShipClassId;
  info: ShipInfo | null;
  own: boolean;
  sinkT: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly fx = new Fx();
  w = 0;
  h = 0;
  dpr = 1;
  camX = 0;
  camY = 0;
  zoom = 2.6; // px per meter
  targetZoom = 2.6;
  time = 0;
  mouseX = 0;
  mouseY = 0;
  onLightning: () => void = () => {};
  private dark: HTMLCanvasElement;
  private dg: CanvasRenderingContext2D;
  private noise: HTMLCanvasElement;
  private noisePattern: CanvasPattern | null = null;
  private rain: { x: number; y: number; s: number }[] = [];
  private streaks: { x: number; y: number; t: number }[] = [];
  private lightning = 0;
  private nextLightning = 5;
  private sinkStarts = new Map<number, number>();
  readonly atlas = new SpriteAtlas();
  /** A look-ahead offset in metres (the gamepad's right stick). */
  look = { x: 0, y: 0 };
  private shipCache = new Map<string, { canvas: HTMLCanvasElement; extentY: number; cx: number; cy: number }>();
  private wakes = new Map<number, { x: number; y: number; t: number; w: number }[]>();

  /** WebGL layers: the shader sea below, the fog and lightning above (null: the 2D fallback draws them). */
  readonly sea: GlSea | null;
  readonly sky: GlSky | null;
  private bolt: [number, number][] | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const want = glWanted();
    this.sea = want ? GlSea.create() : null;
    this.sky = this.sea ? GlSky.create() : null;
    if (this.sea) canvas.before(this.sea.canvas);
    if (this.sky) canvas.after(this.sky.canvas);
    // Over a shader sea the world canvas is transparent where there is only water.
    this.g = canvas.getContext('2d', { alpha: !!this.sea })!;
    this.dark = document.createElement('canvas');
    this.dg = this.dark.getContext('2d')!;
    this.noise = this.makeNoise(256);
    this.resize();
    addEventListener('resize', () => this.resize());
    for (let i = 0; i < 260; i++) this.rain.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
    for (let i = 0; i < 70; i++) this.streaks.push({ x: Math.random(), y: Math.random(), t: Math.random() * 4 });
  }

  resize(): void {
    // Phones and tablets draw at 1.5× at most: three full-screen layers at 3× cost more than they show.
    this.dpr = Math.min(matchMedia('(pointer: coarse)').matches ? 1.5 : 2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.sea?.resize(this.w, this.h, this.dpr);
    this.sky?.resize(this.w, this.h, this.dpr);
    this.dark.width = Math.round(this.w / 2);
    this.dark.height = Math.round(this.h / 2);
  }

  private makeNoise(size: number): HTMLCanvasElement {
    // Tileable fog/wave noise generated once (fallback when the ocean texture is unavailable).
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    const period = 8;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * period, v = (y / size) * period;
        // Tile by blending four offset samples.
        const fx = x / size, fy = y / size;
        const n =
          fbm(u, v, 7) * (1 - fx) * (1 - fy) + fbm(u - period, v, 7) * fx * (1 - fy) + fbm(u, v - period, 7) * (1 - fx) * fy + fbm(u - period, v - period, 7) * fx * fy;
        const i = (y * size + x) * 4;
        const val = Math.round(n * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  sx(x: number): number {
    return (x - this.camX) * this.zoom + this.w / 2;
  }
  sy(y: number): number {
    return (y - this.camY) * this.zoom + this.h / 2;
  }
  toWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.w / 2) / this.zoom + this.camX, y: (py - this.h / 2) / this.zoom + this.camY };
  }

  /** Main frame. */
  private frameNo = 0;

  render(state: ClientState, own: SailState | null, dt: number, aim: { side: 'port' | 'starboard' | null; dist: number; boardTarget: number | null; chaser: 'bow' | 'stern' | null }): void {
    this.time += dt;
    this.frameNo++;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 8);
    const g = this.g;
    if (own) {
      // Look slightly ahead of the ship.
      const v = headingVec(own.heading);
      const lead = clamp(own.speed * 5, 0, 90);
      this.camX += (own.x + v.x * lead + this.look.x - this.camX) * Math.min(1, dt * 4);
      this.camY += (own.y + v.y * lead + this.look.y - this.camY) * Math.min(1, dt * 4);
    }
    // Particle LOD: the frame time picks it; nothing decorative is born off screen.
    this.fx.frame(dt * 1000);
    {
      const mx = this.w / 2 / this.zoom + 120, my = this.h / 2 / this.zoom + 120;
      this.fx.view = { x0: this.camX - mx, y0: this.camY - my, x1: this.camX + mx, y1: this.camY + my };
    }
    this.fx.update(dt);
    const opt = settings();
    const shake = opt.screenShake ? this.fx.shake : 0;
    const shx = shake ? (Math.random() - 0.5) * shake * 8 : 0, shy = shake ? (Math.random() - 0.5) * shake * 8 : 0;
    g.setTransform(this.dpr, 0, 0, this.dpr, shx * this.dpr, shy * this.dpr);

    const night = nightFactor(state.estServerTime());
    const region = REGIONS[state.region];
    this.drawOcean(state, region.waterTint);
    this.drawCurrents(state);
    const islands = this.visibleIslands(state);
    this.drawWhirlpools(state);
    this.drawReefs(state);
    for (const is of islands) this.drawShallows(is);
    for (const is of islands) this.drawIsland(is, state);
    this.drawPorts(state);

    // Ships.
    const ships: DrawShip[] = [];
    for (const s of state.ships.values()) ships.push(this.toDraw(s));
    if (own && state.you && state.self) {
      ships.push({
        id: state.entityId, x: own.x, y: own.y, h: own.heading, spd: own.speed, sail: own.sail, hull: state.you.hull / state.you.hullMax,
        sails: state.you.sails / state.you.sailsMax, flags: state.you.flags, classId: state.self.loadout.classId, info: null, own: true, sinkT: 0,
      });
    }
    for (const s of ships) this.updateWake(s, dt);
    this.drawWakes();
    this.drawLoot(state);
    this.drawDuelRing(state);
    drawPveSites(g, state.pveSites, (x) => this.sx(x), (y) => this.sy(y), this.zoom, this.time, this.w, this.h);
    drawBossZones(g, state.bosses, (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, false); // no pulsing zones when motion is reduced
    for (const s of ships) this.drawShip(s, state);
    this.drawTethers(state, ships);
    this.drawBalls();
    this.drawParticles(false);

    // The Islands of Light burn in the Abyss's dark.
    for (const l of state.self?.abyss?.lights ?? []) this.fx.light(l.x, l.y, 700, 'rgba(255,245,210,1)', 0.9, 0.05);
    this.drawLighting(state, ships, night);
    drawBossZones(g, state.bosses, (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, true);
    this.drawParticles(true);
    this.drawWeather(state, dt);

    // Overlays (not affected by darkness).
    if (own && state.you && state.self) this.drawAim(state, own, aim);
    for (const s of ships) if (!s.own) this.drawLabel(s, state, aim.boardTarget === s.id);
    this.drawTexts();
    this.drawVignette(state.fog, night);
    if (this.fx.flash > 0) {
      // Reduced flashes: a gentle 30% lift instead of a white-out.
      // Lightning lights the sea for an instant; it must not wash the whole screen white.
      g.fillStyle = `rgba(210,225,255,${this.fx.flash * (opt.reduceFlashes ? 0.08 : 0.22)})`;
      g.fillRect(0, 0, this.w, this.h);
    }
  }

  // ------------------------------------------------------------------ ocean

  private drawOcean(state: ClientState, tint: string): void {
    const g = this.g;
    if (this.sea) {
      // The shader sea: the 2D canvas is cleared to let it through; wind streaks stay for reading the wind.
      g.clearRect(-20, -20, this.w + 40, this.h + 40);
      // The painted sea and mist join the shaders once they have loaded.
      if (!this.sea.hasTexture) {
        const t = sprite('tex.ocean');
        if (t) this.sea.setTexture(t.img);
      }
      if (this.sky && !this.sky.hasTexture) {
        const f = sprite('tex.fog');
        if (f) this.sky.setTexture(f.img);
      }
      const wakes: { x: number; y: number; age: number; w: number }[] = [];
      for (const w of this.wakes.values()) for (let i = Math.max(0, w.length - 12); i < w.length; i++) wakes.push({ x: w[i].x, y: w[i].y, age: this.time - w[i].t, w: w[i].w * (1 + (this.time - w[i].t) * 0.35) });
      wakes.sort((a, b) => b.age - a.age);
      const wv = headingVec(state.wind[0]);
      this.sea.draw({
        camX: this.camX, camY: this.camY, zoom: this.zoom, time: this.time, tint: hexRgb(tint), wind: [wv.x, wv.y, clamp(state.wind[1], 0, 1.4)],
        night: nightFactor(state.estServerTime()), wakes,
      });
      this.drawStreaks(state);
      return;
    }
    g.fillStyle = tint;
    g.fillRect(-20, -20, this.w + 40, this.h + 40);
    const tex = pattern(g, 'tex.ocean');
    const wind = headingVec(state.wind[0]);
    const tile = 240; // meters per texture tile
    if (tex) {
      const s = sprite('tex.ocean')!;
      const k = (tile * this.zoom) / s.img.naturalWidth;
      const drift = this.time * 1.6;
      for (const [alpha, scale, dx, dy] of [
        [0.55, 1, wind.x * drift, wind.y * drift],
        [0.22, 0.63, -wind.y * drift * 0.7 + 90, wind.x * drift * 0.7 + 40],
      ] as const) {
        const m = new DOMMatrix().translate(this.sx(dx), this.sy(dy)).scale(k * scale);
        tex.setTransform(m);
        g.globalAlpha = alpha;
        g.fillStyle = tex;
        g.fillRect(0, 0, this.w, this.h);
      }
      g.globalAlpha = 1;
    } else {
      this.noisePattern ??= g.createPattern(this.noise, 'repeat');
      const p = this.noisePattern!;
      const k = (tile * this.zoom) / 256;
      const drift = this.time * 2;
      p.setTransform(new DOMMatrix().translate(this.sx(wind.x * drift), this.sy(wind.y * drift)).scale(k));
      g.globalAlpha = 0.07;
      g.fillStyle = p;
      g.globalCompositeOperation = 'screen';
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    // Moonlit sheen band that slowly moves.
    const grd = g.createLinearGradient(0, 0, this.w, this.h);
    const t = (Math.sin(this.time * 0.05) + 1) / 2;
    grd.addColorStop(clamp(t - 0.25, 0, 1), 'rgba(120,150,180,0)');
    grd.addColorStop(t, 'rgba(120,150,180,0.05)');
    grd.addColorStop(clamp(t + 0.25, 0, 1), 'rgba(120,150,180,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, this.w, this.h);

    this.drawStreaks(state);
  }

  /** Wind streaks: short pale dashes drifting downwind (readability of wind direction). */
  private drawStreaks(state: ClientState): void {
    const g = this.g;
    const wind = headingVec(state.wind[0]);
    g.strokeStyle = 'rgba(200,215,225,0.10)';
    g.lineWidth = 1;
    const len = 10 + state.wind[1] * 16;
    for (const st of this.streaks) {
      st.t += 0.016;
      const life = (st.t % 4) / 4;
      const px = ((st.x * this.w + wind.x * life * 180) % this.w + this.w) % this.w;
      const py = ((st.y * this.h + wind.y * life * 180) % this.h + this.h) % this.h;
      g.globalAlpha = Math.sin(life * Math.PI) * clamp(state.wind[1], 0.2, 1);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + wind.x * len, py + wind.y * len);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawCurrents(state: ClientState): void {
    const g = this.g;
    const navigator = state.self?.captain === 'navigator';
    g.save();
    g.lineCap = 'butt';
    for (const c of state.currents) {
      g.beginPath();
      for (let i = 0; i < c.points.length; i++) {
        const [x, y] = c.points[i];
        if (i === 0) g.moveTo(this.sx(x), this.sy(y));
        else g.lineTo(this.sx(x), this.sy(y));
      }
      g.setLineDash([14 * this.zoom, 60 * this.zoom]);
      g.lineDashOffset = -this.time * c.strength * 4 * this.zoom;
      g.strokeStyle = navigator ? 'rgba(140,200,220,0.2)' : 'rgba(140,180,200,0.06)';
      g.lineWidth = clamp(c.width * 0.004 * this.zoom, 1, 6);
      g.stroke();
    }
    g.restore();
  }

  // ------------------------------------------------------------------ islands

  private visibleIslands(state: ClientState): IslandData[] {
    const out: IslandData[] = [];
    const margin = 200;
    const hw = this.w / 2 / this.zoom + margin, hh = this.h / 2 / this.zoom + margin;
    for (const is of state.islands.values()) {
      if (Math.abs(is.x - this.camX) - is.r > hw || Math.abs(is.y - this.camY) - is.r > hh) continue;
      out.push(is);
    }
    return out;
  }

  /** A coast or reef outline, rounded: curves through the edges' midpoints with the vertices as control points. */
  private path(poly: number[], scale = 1, cx = 0, cy = 0): void {
    const g = this.g;
    const n = poly.length / 2;
    const px = (i: number) => this.sx(cx + (poly[(i % n) * 2] - cx) * scale);
    const py = (i: number) => this.sy(cy + (poly[(i % n) * 2 + 1] - cy) * scale);
    g.beginPath();
    if (n < 4) {
      for (let i = 0; i < n; i++) (i ? g.lineTo(px(i), py(i)) : g.moveTo(px(i), py(i)));
      g.closePath();
      return;
    }
    g.moveTo((px(0) + px(1)) / 2, (py(0) + py(1)) / 2);
    for (let i = 1; i <= n; i++) g.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
    g.closePath();
  }

  private drawWhirlpools(state: ClientState): void {
    const g = this.g;
    for (const w of state.whirlpools) {
      const reach = w.radius * 2.2;
      if (Math.abs(w.x - this.camX) - reach > this.w / 2 / this.zoom || Math.abs(w.y - this.camY) - reach > this.h / 2 / this.zoom) continue;
      const cx = this.sx(w.x), cy = this.sy(w.y);
      // Darkening funnel.
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, reach * this.zoom);
      grd.addColorStop(0, 'rgba(0,0,0,0.75)');
      grd.addColorStop(0.3, 'rgba(2,6,8,0.45)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, reach * this.zoom, 0, Math.PI * 2);
      g.fill();
      // Spiral foam arms rotating with the flow: the painted maelstrom when it has loaded.
      const dirSign = w.clockwise ? 1 : -1;
      const spin = this.time * 0.25 * dirSign;
      const art = sprite('prop.whirlpool');
      if (art) {
        const size = reach * 2 * this.zoom;
        g.save();
        g.translate(cx, cy);
        g.rotate(spin * 1.6);
        if (!w.clockwise) g.scale(-1, 1);
        g.globalAlpha = 0.85;
        g.drawImage(art.img, -size / 2, -size / 2, size, size);
        g.restore();
      }
      g.lineWidth = Math.max(1, 2 * this.zoom);
      for (let arm = 0; arm < (art ? 0 : 5); arm++) {
        g.beginPath();
        for (let i = 0; i <= 60; i++) {
          const t = i / 60;
          const r = reach * (1 - t * 0.95);
          const a = spin + (arm / 5) * Math.PI * 2 + dirSign * t * Math.PI * 3.2;
          const x = cx + Math.sin(a) * r * this.zoom, y = cy - Math.cos(a) * r * this.zoom;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokeStyle = `rgba(200,212,220,${0.08 + (arm % 2) * 0.05})`;
        g.stroke();
      }
      if (this.zoom < 2.5) {
        g.font = 'italic 14px "Cormorant Garamond", Georgia, serif';
        g.fillStyle = 'rgba(208,106,94,0.6)';
        g.textAlign = 'center';
        g.fillText(w.name, cx, cy - w.radius * 0.4 * this.zoom);
      }
    }
  }

  private drawReefs(state: ClientState): void {
    const g = this.g;
    const hw = this.w / 2 / this.zoom + 300, hh = this.h / 2 / this.zoom + 300;
    for (const rf of state.reefs.values()) {
      if (Math.abs(rf.x - this.camX) - rf.r > hw || Math.abs(rf.y - this.camY) - rf.r > hh) continue;
      g.save();
      g.lineJoin = 'round';
      this.path(rf.poly);
      // Pale water over coral and sand: reads as danger without shouting. The painted seabed shows through.
      const bed = this.tiled('tex.reef', 120, rf.x | 0);
      if (bed) {
        g.globalAlpha = 0.55;
        g.fillStyle = bed;
        g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(52,96,92,0.18)';
      g.fill();
      g.lineWidth = 24 * this.zoom;
      g.strokeStyle = 'rgba(40,84,82,0.10)';
      g.stroke();
      this.path(rf.poly, 0.55, rf.x, rf.y);
      g.fillStyle = 'rgba(120,150,130,0.16)';
      g.fill();
      // Breakers.
      this.path(rf.poly);
      g.setLineDash([2 * this.zoom, 7 * this.zoom]);
      g.lineDashOffset = -this.time * 3 * this.zoom;
      g.strokeStyle = 'rgba(215,225,228,0.30)';
      g.lineWidth = Math.max(1, 1.6 * this.zoom);
      g.stroke();
      g.setLineDash([]);
      if (this.zoom > 1.2) {
        g.font = 'italic 11px "Cormorant Garamond", Georgia, serif';
        g.fillStyle = 'rgba(200,215,210,0.55)';
        g.textAlign = 'center';
        g.fillText(L('reef', { m: rf.depth.toFixed(1) }), this.sx(rf.x), this.sy(rf.y));
      }
      g.restore();
    }
  }

  private drawShallows(is: IslandData): void {
    const g = this.g;
    g.save();
    g.lineJoin = 'round';
    this.path(is.poly);
    const strange = REGIONS[is.region].strangeness;
    const base = strange > 0.4 ? '20,70,72' : '40,70,80';
    for (const [w, a] of [[110, 0.05], [60, 0.07], [28, 0.1]] as const) {
      g.lineWidth = w * this.zoom;
      g.strokeStyle = `rgba(${base},${a})`;
      g.stroke();
    }
    g.restore();
  }

  private drawIsland(is: IslandData, state: ClientState): void {
    const g = this.g;
    g.save();
    g.lineJoin = 'round';
    // Height: the land throws a soft shadow on the water, away from the moon (south-east).
    g.save();
    g.translate(7 * this.zoom, 10 * this.zoom);
    this.path(is.poly);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fill();
    g.restore();
    // The shore: sand, black sand, ice or rock by biome, a band along the coast.
    this.path(is.poly);
    const shore = this.tiled(BIOME_SHORE[is.biome], 60, is.id) ?? this.tiled('tex.sand', 60, is.id);
    g.strokeStyle = shore ?? (is.biome === 'volcanic' ? '#241c19' : is.biome === 'ice' ? '#9aa4ad' : '#4d463b');
    g.lineWidth = 20 * this.zoom;
    g.stroke();
    // The land in its biome's painting (the old flat tint only when the art is missing).
    const land = this.tiled(BIOME_LAND[is.biome], 150, is.id) ?? this.tiled('tex.land', 150, is.id);
    g.fillStyle = land ?? BIOME_BASE[is.biome];
    g.fill();
    if (!sprite(BIOME_LAND[is.biome])) {
      g.fillStyle = BIOME_TINT[is.biome];
      g.fill();
    }
    // Relief: hill-shaded height, cliffs and beaches (terrain.ts), clipped to the coast. Until an island's mask
    // is built (at most one a frame), concentric cores stand in.
    const relief = this.reliefOf(is);
    if (relief) {
      this.path(is.poly);
      g.save();
      g.clip();
      g.globalAlpha = sprite(BIOME_LAND[is.biome]) ? 0.5 : 1;
      g.drawImage(relief.canvas, this.sx(relief.x0), this.sy(relief.y0), relief.size * this.zoom, relief.size * this.zoom);
      g.restore();
    } else {
      for (const [sc, a] of [[0.72, 0.18], [0.45, 0.2]] as const) {
        this.path(is.poly, sc, is.x, is.y);
        g.fillStyle = is.biome === 'ice' ? `rgba(230,238,245,${a * 0.8})` : `rgba(8,10,8,${a})`;
        g.fill();
      }
    }
    // What grows and lies on the island.
    const decor = sprite(BIOME_DECOR[is.biome]);
    const grove = sprite('prop.grove');
    if (decor && this.zoom > 0.3) {
      for (const d of this.decorOf(is, state)) {
        const size = d.size * this.zoom;
        const x = this.sx(d.x), y = this.sy(d.y);
        if (x < -size || y < -size || x > this.w + size || y > this.h + size) continue;
        g.save();
        g.translate(x, y);
        g.rotate(d.rot);
        g.drawImage((d.grove && grove ? grove : decor).img, -size / 2, -size / 2, size, size);
        g.restore();
      }
    }
    // Surf: two soft broken lines of foam working along the coast.
    this.path(is.poly);
    g.setLineDash([3 * this.zoom, 9 * this.zoom]);
    g.lineDashOffset = this.time * 4 * this.zoom;
    g.strokeStyle = 'rgba(210,220,225,0.2)';
    g.lineWidth = Math.max(1, 2.2 * this.zoom);
    g.stroke();
    this.path(is.poly, 1.035, is.x, is.y);
    g.setLineDash([2 * this.zoom, 13 * this.zoom]);
    g.lineDashOffset = -this.time * 3 * this.zoom;
    g.strokeStyle = 'rgba(200,212,220,0.1)';
    g.stroke();
    g.setLineDash([]);
    // Name label when zoomed out enough to matter or discovered.
    const known = state.discovered.has(is.id);
    if (known && is.r > 180 && this.zoom < 2.2) {
      g.font = `italic ${Math.round(clamp(is.r * this.zoom * 0.08, 11, 18))}px "Cormorant Garamond", Georgia, serif`;
      g.fillStyle = 'rgba(216,210,196,0.55)';
      g.textAlign = 'center';
      g.fillText(is.name, this.sx(is.x), this.sy(is.y));
    }
    g.restore();
    this.drawFeatures(is);
  }

  /** A texture tiled in world space: `metres` per tile, shifted by `seed` so neighbours do not match. */
  private tiled(id: string, metres: number, seed = 0): CanvasPattern | null {
    const p = pattern(this.g, id);
    const s = sprite(id);
    if (!p || !s) return null;
    p.setTransform(new DOMMatrix().translate(this.sx(seed * 137), this.sy(seed * 91)).scale((this.zoom * metres) / s.img.naturalWidth));
    return p;
  }

  private decorCache = new Map<number, Decor[]>();

  /** Where an island's decor stands: inside the coast, clear of its port town and of each other. */
  private decorOf(is: IslandData, state: ClientState): Decor[] {
    const hit = this.decorCache.get(is.id);
    if (hit) return hit;
    const rnd = seeded(is.id * 7919 + 17);
    const inner = is.poly.map((v, i) => (i % 2 === 0 ? is.x + (v - is.x) * 0.78 : is.y + (v - is.y) * 0.78));
    const port = is.portId ? state.ports.find((p) => p.id === is.portId) : null;
    // Decor by area: a rock has a clump or two, a great island is wooded and strewn.
    const want = Math.max(3, Math.min(40, Math.round((is.r * is.r) / 26000)));
    const out: Decor[] = [];
    for (let k = 0; k < want * 6 && out.length < want; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * is.r;
      const x = is.x + Math.cos(a) * r, y = is.y + Math.sin(a) * r;
      if (!inPoly(inner, x, y)) continue;
      if (port && Math.hypot(x - port.x, y - port.y) < 380) continue;
      const size = 42 + rnd() * Math.min(120, 30 + is.r / 10);
      if (out.some((d) => Math.hypot(d.x - x, d.y - y) < (d.size + size) * 0.55)) continue;
      out.push({ x, y, rot: rnd() * Math.PI * 2, size, grove: size > 95 && (is.biome === 'temperate' || is.biome === 'mossy') });
    }
    this.decorCache.set(is.id, out);
    if (this.decorCache.size > 200) this.decorCache.delete(this.decorCache.keys().next().value!);
    return out;
  }

  private reliefCache = new Map<number, { canvas: HTMLCanvasElement; x0: number; y0: number; size: number }>();
  private reliefBuiltAt = -1;

  /** The island's relief mask, built lazily (one per frame) and kept for the 60 most recently seen islands. */
  private reliefOf(is: IslandData): { canvas: HTMLCanvasElement; x0: number; y0: number; size: number } | null {
    const hit = this.reliefCache.get(is.id);
    if (hit) {
      this.reliefCache.delete(is.id);
      this.reliefCache.set(is.id, hit);
      return hit;
    }
    if (this.reliefBuiltAt === this.frameNo) return null;
    this.reliefBuiltAt = this.frameNo;
    const palette: Palette = is.biome === 'ice' ? 'ice' : is.biome === 'volcanic' ? 'dark' : is.biome === 'bone' || is.biome === 'barren' ? 'pale' : 'green';
    const r = buildRelief(is.poly, is.x, is.y, 0x51ed + is.id * 977, palette, is.biome === 'volcanic' || is.biome === 'ruins' ? 1 : is.biome === 'mossy' ? 0 : 0.5);
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d')!.putImageData(new ImageData(r.rgba as unknown as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0);
    const entry = { canvas: c, x0: r.x0, y0: r.y0, size: r.w * r.res };
    this.reliefCache.set(is.id, entry);
    while (this.reliefCache.size > 60) this.reliefCache.delete(this.reliefCache.keys().next().value!);
    return entry;
  }

  private featurePoint(is: IslandData, salt: number, inset: number): { x: number; y: number } {
    const n = is.poly.length / 2;
    const i = ((is.id * 7 + salt * 13) % n) * 2;
    const px = is.poly[i], py = is.poly[i + 1];
    return { x: px + (is.x - px) * inset, y: py + (is.y - py) * inset };
  }

  private drawFeatures(is: IslandData): void {
    const g = this.g;
    for (const f of is.features) {
      const art = FEATURE_ART[f];
      if (!art) continue;
      const p = this.featurePoint(is, art.salt, art.inset);
      const spr = sprite(art.id);
      const size = art.size * this.zoom;
      const x = this.sx(p.x), y = this.sy(p.y);
      if (x < -size || y < -size || x > this.w + size || y > this.h + size) continue;
      if (spr) {
        g.save();
        g.translate(x, y);
        // Everything but the lighthouse turns a little, so no two islands look stamped.
        if (f !== 'lighthouse') g.rotate(((is.id * 37 + art.salt * 11) % 628) / 100);
        if (f === 'wreck' || f === 'pearl_bank') g.globalAlpha = 0.9;
        g.drawImage(spr.img, -size / 2, -size / 2, size, size);
        g.restore();
      } else if (f === 'lighthouse') {
        g.fillStyle = '#5c5a55';
        g.beginPath();
        g.arc(x, y, 6 * this.zoom, 0, Math.PI * 2);
        g.fill();
      } else if (f === 'ruins' || f === 'shrine') {
        g.save();
        g.translate(x, y);
        g.strokeStyle = 'rgba(160,160,150,0.45)';
        g.lineWidth = Math.max(1, 1.5 * this.zoom);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + is.id;
          g.strokeRect(Math.sin(a) * 12 * this.zoom - 3 * this.zoom, -Math.cos(a) * 12 * this.zoom - 3 * this.zoom, 6 * this.zoom, 6 * this.zoom);
        }
        g.restore();
      }
    }
  }

  /** Where each port town stands: on the land behind its anchorage, its quays at the shore (computed once). */
  private portLayout = new Map<string, { x: number; y: number; ang: number; size: number } | null>();

  private layoutPort(p: ClientState['ports'][number], island: { x: number; y: number; r: number; poly: number[] }): { x: number; y: number; ang: number; size: number } {
    const dx = island.x - p.x, dy = island.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // The ray from the anchorage to the island's heart: where it makes landfall and where it leaves the land again.
    const hits: number[] = [];
    const poly = island.poly;
    for (let i = 0; i < poly.length; i += 2) {
      const ax = poly[i], ay = poly[i + 1], bx = poly[(i + 2) % poly.length], by = poly[(i + 3) % poly.length];
      const ex = bx - ax, ey = by - ay;
      const den = ux * ey - uy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - p.x) * ey - (ay - p.y) * ex) / den;
      const u = ((ax - p.x) * uy - (ay - p.y) * ux) / den;
      if (t > 0 && u >= 0 && u <= 1) hits.push(t);
    }
    hits.sort((m, n) => m - n);
    // An anchorage already on the land (a river mouth, a lagoon) starts the town where it lies.
    const ashore = inPoly(poly, p.x, p.y);
    const tIn = ashore ? 0 : hits[0] ?? d * 0.6;
    const tOut = (ashore ? hits[0] : hits[1]) ?? d + island.r * 0.5;
    // The town's body fills the upper three quarters of the painting, the quays the foot: the body must fit the land.
    const depth = Math.max(80, tOut - tIn);
    const size = Math.max(140, Math.min(230 + p.size * 80, (depth * 0.8) / 0.64));
    const shoreX = p.x + ux * tIn, shoreY = p.y + uy * tIn;
    // Local +y turns to the sea, so the quays at the painting's foot reach into the water.
    return { x: shoreX + ux * size * 0.24, y: shoreY + uy * size * 0.24, ang: Math.atan2(-dx, dy) + Math.PI, size };
  }

  private drawPorts(state: ClientState): void {
    const g = this.g;
    for (const p of state.ports) {
      if (Math.abs(p.x - this.camX) * this.zoom > this.w + 600 * this.zoom || Math.abs(p.y - this.camY) * this.zoom > this.h + 600 * this.zoom) continue;
      const spr = sprite(`prop.port_${p.faction}`) ?? sprite('prop.port_town');
      const island = [...state.islands.values()].find((is) => is.portId === p.id);
      if (!island) continue;
      let lay = this.portLayout.get(p.id);
      if (!lay) this.portLayout.set(p.id, (lay = this.layoutPort(p, island)));
      const size = lay.size * this.zoom;
      const path = () => {
        g.beginPath();
        for (let i = 0; i < island.poly.length; i += 2) {
          if (i === 0) g.moveTo(this.sx(island.poly[i]), this.sy(island.poly[i + 1]));
          else g.lineTo(this.sx(island.poly[i]), this.sy(island.poly[i + 1]));
        }
        g.closePath();
      };
      const town = () => {
        g.translate(this.sx(lay.x), this.sy(lay.y));
        g.rotate(lay.ang);
        if (spr) g.drawImage(spr.img, -size / 2, -size / 2, size, size);
        else {
          g.fillStyle = '#26272a';
          g.fillRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.64);
        }
      };
      // The town's streets and walls stand only on the land — no ship sails through a house.
      g.save();
      path();
      g.clip();
      town();
      g.restore();
      // The quays: only the painting's foot, out over the water from the shore.
      g.save();
      g.translate(this.sx(lay.x), this.sy(lay.y));
      g.rotate(lay.ang);
      g.beginPath();
      g.rect(-size / 2, size * 0.23, size, size * 0.27);
      g.clip();
      g.rotate(-lay.ang);
      g.translate(-this.sx(lay.x), -this.sy(lay.y));
      town();
      g.restore();
      // Name & flag.
      g.font = `${Math.round(clamp(14 * this.zoom, 12, 22))}px "IM Fell English SC", Georgia, serif`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillText(p.name, this.sx(p.x) + 1, this.sy(p.y) - 40 * this.zoom + 1);
      g.fillStyle = FACTIONS[p.faction].lantern;
      g.fillText(p.name, this.sx(p.x), this.sy(p.y) - 40 * this.zoom);
      // The harbour's reach: a faint ring of calmer water, no dashes.
      g.strokeStyle = 'rgba(176,141,87,0.14)';
      g.lineWidth = Math.max(1, 2 * this.zoom);
      g.beginPath();
      g.arc(this.sx(p.x), this.sy(p.y), 420 * this.zoom, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // ------------------------------------------------------------------ ships

  private toDraw(s: RemoteShip): DrawShip {
    const c = s.cur;
    const classId = s.info?.classId ?? 'sloop';
    let sinkT = 0;
    if (c.flags & SF.SINKING) {
      if (!this.sinkStarts.has(s.id)) this.sinkStarts.set(s.id, this.time);
      sinkT = this.time - (this.sinkStarts.get(s.id) ?? this.time);
    }
    return { id: s.id, x: c.x, y: c.y, h: c.h, spd: c.spd, sail: c.sail, hull: c.hull, sails: c.sails, flags: c.flags, classId, info: s.info, own: false, sinkT };
  }

  private updateWake(s: DrawShip, dt: number): void {
    let w = this.wakes.get(s.id);
    if (!w) this.wakes.set(s.id, (w = []));
    const last = w[w.length - 1];
    const cls = SHIP_CLASSES[s.classId];
    if (s.spd > 0.8 && (!last || Math.hypot(last.x - s.x, last.y - s.y) > 4)) {
      const back = headingVec(s.h + Math.PI);
      w.push({ x: s.x + back.x * cls.length * 0.45, y: s.y + back.y * cls.length * 0.45, t: this.time, w: cls.beam * (0.6 + s.spd / 20) });
    }
    while (w.length && this.time - w[0].t > 7) w.shift();
    void dt;
  }

  private drawWakes(): void {
    // Over the shader sea the wake is churned water in the shader itself: no lines on top of it.
    if (this.sea) {
      for (const [id, w] of this.wakes) if (!w.length) this.wakes.delete(id);
      return;
    }
    const soft = 1;
    const g = this.g;
    g.save();
    g.lineCap = 'round';
    for (const [id, w] of this.wakes) {
      if (w.length < 2) {
        if (!w.length) this.wakes.delete(id);
        continue;
      }
      for (let i = 1; i < w.length; i++) {
        const a = w[i - 1], b = w[i];
        const age = this.time - b.t;
        const alpha = clamp(0.16 * (1 - age / 7), 0, 0.16);
        const spread = b.w * (1 + age * 0.35);
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        g.strokeStyle = `rgba(200,212,220,${alpha * soft})`;
        g.lineWidth = Math.max(1, 1.6 * this.zoom * (1 - age / 8));
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(this.sx(a.x + nx * spread * side * 0.5 * (1 - 0.1)), this.sy(a.y + ny * spread * side * 0.5 * (1 - 0.1)));
          g.lineTo(this.sx(b.x + nx * spread * side * 0.5), this.sy(b.y + ny * spread * side * 0.5));
          g.stroke();
        }
        g.strokeStyle = `rgba(160,180,190,${alpha * 0.5})`;
        g.lineWidth = Math.max(1, b.w * 0.5 * this.zoom * (1 - age / 8));
        g.beginPath();
        g.moveTo(this.sx(a.x), this.sy(a.y));
        g.lineTo(this.sx(b.x), this.sy(b.y));
        g.stroke();
      }
    }
    g.restore();
  }

  private drawLoot(state: ClientState): void {
    const g = this.g;
    const spr = sprite('prop.flotsam') ?? sprite('prop.wreckage');
    for (const l of state.loot.values()) {
      const size = 38 * this.zoom;
      const bob = Math.sin(this.time * 1.5 + l.x) * 0.1;
      g.save();
      g.translate(this.sx(l.x), this.sy(l.y));
      g.rotate(bob);
      if (spr) g.drawImage(spr.img, -size / 2, -size / 2, size, size);
      else {
        g.fillStyle = '#6b5436';
        for (let k = 0; k < 5; k++) g.fillRect(Math.sin(k * 2.1) * size * 0.3, Math.cos(k * 1.7) * size * 0.3, size * 0.18, size * 0.12);
      }
      g.restore();
      g.fillStyle = 'rgba(224,184,98,0.8)';
      g.font = '11px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText(L('salvage', { n: l.value }), this.sx(l.x), this.sy(l.y) + size * 0.7);
    }
  }

  private drawShip(s: DrawShip, state: ClientState): void {
    const g = this.g;
    const cls = SHIP_CLASSES[s.classId];
    const len = cls.length * this.zoom, beam = cls.beam * this.zoom;
    const x = this.sx(s.x), y = this.sy(s.y);
    if (x < -len * 2 || y < -len * 2 || x > this.w + len * 2 || y > this.h + len * 2) return;
    if (cls.monster) {
      drawMonster(g, { id: s.id, x, y, h: s.h, classId: s.classId, flags: s.flags, hull: s.hull, sinkT: s.sinkT }, this.zoom, this.time);
      if (s.classId === 'lantern_maw' && !(s.flags & SF.SUBMERGED)) {
        const v = headingVec(s.h);
        this.fx.light(s.x + v.x * cls.length * 0.62, s.y + v.y * cls.length * 0.62, 160, 'rgba(255,225,150,1)', 0.9, 0.05);
      }
      // Every horror of the deep glows a little: pale eyes, rot-light, the sheen of wet hide.
      if (!(s.flags & SF.SUBMERGED) && s.classId !== 'kraken_tentacle' && s.classId !== 'hulk') this.fx.light(s.x, s.y, cls.length * 0.6, s.classId === 'black_serpent' ? 'rgba(201,224,74,1)' : 'rgba(150,190,200,1)', 0.2, 0.05);
      if (s.classId === 'wreck_core' || s.classId === 'whale_heart') this.fx.light(s.x, s.y, 60, s.classId === 'wreck_core' ? 'rgba(46,230,200,1)' : 'rgba(200,40,50,1)', 0.6, 0.05);
      return;
    }
    // Inside the Lantern Maw: only her own captain sees her, a shadow in its gut.
    if ((s.flags & SF.SWALLOWED) && !s.own) return;
    const hidden = (s.flags & SF.HIDDEN) !== 0 || (s.flags & SF.SWALLOWED) !== 0;
    const sinking = s.sinkT > 0 || (s.flags & SF.SINKING) !== 0;
    const sinkF = sinking ? clamp(s.sinkT / 6, 0, 1) : 0;
    // Heel: she leans to leeward with the wind on her beam and her canvas set; water in the hold adds a list.
    const heel = shipHeel(s.h, state.wind[0], state.wind[1], s.sail, cls.tier, s.own ? state.you?.water ?? 0 : 0, settings().reduceMotion ? 0 : Math.sin(this.time * 0.9 + s.id));
    g.save();
    g.translate(x, y);
    // Engine shadow: offset toward the moon-lit side (south-east), softened; a heeled hull throws it wider to leeward.
    g.save();
    g.rotate(s.h);
    g.fillStyle = `rgba(0,0,0,${0.35 * (1 - sinkF)})`;
    g.beginPath();
    g.ellipse(beam * (0.35 + heel * 0.5), beam * 0.45, beam * (0.62 + Math.abs(heel) * 0.35), len * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.rotate(s.h + (sinking ? sinkF * 0.35 : 0));
    const scale = 1 - sinkF * 0.25;
    g.scale(scale, scale);
    // Seen from above, a heeled ship shows less deck and her masts lean out to leeward.
    if (heel) {
      g.translate(heel * beam * 0.18, 0);
      g.transform(1 - Math.abs(heel) * 0.14, 0, heel * 0.06, 1, 0, 0);
    }
    g.globalAlpha = (hidden ? 0.45 : 1) * (1 - sinkF * 0.85);
    const stage = curseStageFromFlags(s.flags);
    const hullImg = this.shipImage(cls.id, stage);
    // Scale so the drawn subject matches hull length.
    const imgH = len / hullImg.extentY;
    const imgW = imgH * (hullImg.canvas.width / hullImg.canvas.height);
    // From the atlas, in the colours she flies; the full image when she is drawn larger than her cell.
    const a = this.atlas.get(`${cls.id}|${stage}|${hullImg.canvas.width}x${hullImg.canvas.height}`, () => hullImg.canvas, this.sailKey(s));
    if (Math.max(imgW, imgH) * this.dpr > CELL) g.drawImage(a.full, -imgW * hullImg.cx, -imgH * hullImg.cy, imgW, imgH);
    else g.drawImage(a.page, a.sx, a.sy, a.sw, a.sh, -imgW * hullImg.cx, -imgH * hullImg.cy, imgW, imgH);
    this.drawPennant(s, len, beam, state);
    // Sail damage tint (torn canvas reads as darker patches).
    if (s.sails < 0.6) {
      g.fillStyle = `rgba(10,10,10,${(0.6 - s.sails) * 0.5})`;
      g.fillRect(-beam * 0.9, -len * 0.3, beam * 1.8, len * 0.5);
    }
    g.restore();

    // Damage smoke and fire.
    if (s.hull < 0.5 && Math.random() < (0.5 - s.hull) * 0.5) this.fx.smoke(s.x + (Math.random() - 0.5) * cls.beam, s.y + (Math.random() - 0.5) * cls.length * 0.6, 1, 5, true);
    if ((s.flags & SF.FIRE) && Math.random() < 0.6) {
      this.fx.add({ kind: 'fire', x: s.x + (Math.random() - 0.5) * cls.beam, y: s.y + (Math.random() - 0.5) * cls.length * 0.5, vy: -2, life: 0.6, size: 3, grow: 4, color: '#ff8a3c' });
      this.fx.light(s.x, s.y, 60, 'rgba(255,140,60,1)', 0.5, 0.1);
    }
    if (s.flags & SF.BOARDING) {
      // Grapple lines to the ship we're locked with.
      for (const o of state.ships.values()) {
        if (o.id === s.id || !(o.cur.flags & SF.BOARDING)) continue;
        if (Math.hypot(o.cur.x - s.x, o.cur.y - s.y) > 60) continue;
        g.strokeStyle = 'rgba(180,160,120,0.7)';
        g.lineWidth = 1;
        for (let k = -1; k <= 1; k++) {
          g.beginPath();
          g.moveTo(x + k * 4, y + k * 4);
          g.lineTo(this.sx(o.cur.x) - k * 4, this.sy(o.cur.y) - k * 4);
          g.stroke();
        }
      }
    }
  }

  /**
   * Ship image with curse growth baked in, clipped to the hull silhouette ('source-atop').
   * Cached per class and stage; procedural hull and growth when sprites are unavailable.
   */
  private shipImage(id: ShipClassId, stage: number): { canvas: HTMLCanvasElement; extentY: number; cx: number; cy: number } {
    const spr = sprite(SHIP_CLASSES[id].sprite);
    const key = `${id}|${stage}|${spr ? 1 : 0}|${sprite('fx.curse_growth') ? 1 : 0}`;
    const hit = this.shipCache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    const cls = SHIP_CLASSES[id];
    let entry: { canvas: HTMLCanvasElement; extentY: number; cx: number; cy: number };
    if (spr) {
      c.width = spr.img.naturalWidth;
      c.height = spr.img.naturalHeight;
      c.getContext('2d')!.drawImage(spr.img, 0, 0);
      entry = { canvas: c, extentY: spr.extentY, cx: spr.cx, cy: spr.cy };
    } else {
      // Procedural hull at 6 px per meter.
      const k = 6;
      c.width = Math.ceil(cls.beam * k * 2.4);
      c.height = Math.ceil(cls.length * k * 1.1);
      const pg = c.getContext('2d')!;
      pg.translate(c.width / 2, c.height / 2);
      const prev = this.g;
      (this as unknown as { g: CanvasRenderingContext2D }).g = pg;
      this.proceduralShip(id, cls.length * k, cls.beam * k, 0.8, 1);
      (this as unknown as { g: CanvasRenderingContext2D }).g = prev;
      entry = { canvas: c, extentY: 1 / 1.1, cx: 0.5, cy: 0.5 };
    }
    if (stage > 0) {
      const cg = c.getContext('2d')!;
      cg.globalCompositeOperation = 'source-atop';
      const growth = sprite('fx.curse_growth');
      const veins = sprite('fx.curse_veins');
      if (growth) {
        cg.globalAlpha = [0, 0.35, 0.65, 0.85][stage];
        cg.drawImage(growth.img, 0, 0, c.width, c.height);
      } else {
        // Barnacle crust: pale speckles, denser with each stage.
        let seed = id.length * 97 + stage;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        cg.fillStyle = 'rgba(190,185,168,0.55)';
        for (let i = 0; i < 120 * stage; i++) {
          cg.beginPath();
          cg.arc(rnd() * c.width, rnd() * c.height, 1 + rnd() * 3, 0, Math.PI * 2);
          cg.fill();
        }
      }
      if (stage >= 3) {
        if (veins) {
          cg.globalAlpha = 0.8;
          cg.drawImage(veins.img, 0, 0, c.width, c.height);
        } else {
          cg.strokeStyle = 'rgba(46,230,200,0.55)';
          cg.lineWidth = 1.5;
          for (let i = 0; i < 8; i++) {
            cg.beginPath();
            cg.moveTo(c.width * (0.3 + 0.05 * i), c.height * 0.1);
            cg.bezierCurveTo(c.width * 0.2, c.height * 0.4, c.width * 0.8, c.height * 0.6, c.width * (0.35 + 0.04 * i), c.height * 0.9);
            cg.stroke();
          }
        }
      }
      cg.globalAlpha = 1;
      cg.globalCompositeOperation = 'source-over';
    }
    this.shipCache.set(key, entry);
    return entry;
  }

  /** Sail colours: navies and factions dye theirs; a captain under the Black Flag tars them. */
  private sailKey(s: DrawShip): SailKey {
    if (s.classId === 'ghost_ship') return 'none';
    if (s.own || s.info?.isPlayer) return s.flags & SF.BLACK_FLAG ? 'black' : 'none';
    const f = s.info?.faction;
    return f && f !== 'player' ? f : 'none';
  }

  /** Faction pennant at the masthead, streaming downwind. Players fly black. */
  private drawPennant(s: DrawShip, len: number, beam: number, state: ClientState): void {
    const g = this.g;
    // A captain's colours: the Black Flag, the Green Pennant, or plain slate.
    const player = s.own || s.info?.isPlayer;
    const season = s.own ? state.self?.pennant : s.info?.pennant;
    const color = player ? (s.flags & SF.BLACK_FLAG ? '#0b0b0b' : s.flags & SF.GREEN_PENNANT ? '#3f7d4a' : season ?? '#3b4652') : s.info && s.info.faction !== 'player' ? FACTIONS[s.info.faction].flag : '#444';
    const trim = s.own || s.info?.isPlayer ? '#d8d2c4' : 'rgba(0,0,0,0.6)';
    const wave = Math.sin(this.time * 6 + s.id) * beam * 0.12;
    const y0 = -len * 0.18;
    g.beginPath();
    g.moveTo(0, y0);
    g.quadraticCurveTo(beam * 0.5, y0 + len * 0.04 + wave, beam * 1.05, y0 + len * 0.09 + wave * 1.5);
    g.lineTo(0, y0 + len * 0.07);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = trim;
    g.lineWidth = Math.max(0.5, this.zoom * 0.3);
    g.stroke();
  }

  private proceduralShip(id: ShipClassId, len: number, beam: number, sail: number, sailHp: number): void {
    const g = this.g;
    const ghost = id === 'ghost_ship';
    // Hull.
    g.beginPath();
    g.moveTo(0, -len / 2);
    g.bezierCurveTo(beam * 0.55, -len * 0.3, beam * 0.55, len * 0.3, beam * 0.4, len / 2);
    g.lineTo(-beam * 0.4, len / 2);
    g.bezierCurveTo(-beam * 0.55, len * 0.3, -beam * 0.55, -len * 0.3, 0, -len / 2);
    g.closePath();
    g.fillStyle = ghost ? '#141a1a' : '#241b14';
    g.fill();
    g.strokeStyle = ghost ? 'rgba(46,230,200,0.5)' : '#0a0806';
    g.lineWidth = 1.5;
    g.stroke();
    // Deck.
    g.fillStyle = ghost ? '#1d2322' : '#4a3b2b';
    g.beginPath();
    g.ellipse(0, 0, beam * 0.34, len * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    // Masts & sails.
    const cls = SHIP_CLASSES[id];
    const masts = cls.tier >= 3 ? 3 : cls.tier === 2 ? 2 : 1;
    for (let m = 0; m < masts; m++) {
      const my = -len * 0.25 + (m * len * 0.5) / Math.max(1, masts - 1 || 1) - (masts === 1 ? -len * 0.05 : 0);
      const w = beam * (0.9 + sail * 0.6);
      g.fillStyle = `rgba(${ghost ? '120,130,125' : '190,184,165'},${0.35 + sail * 0.55 * (0.4 + sailHp * 0.6)})`;
      if (cls.rig === 'fore_aft') {
        g.beginPath();
        g.moveTo(0, my - len * 0.08);
        g.lineTo(w * 0.5, my + len * 0.12);
        g.lineTo(0, my + len * 0.14);
        g.fill();
      } else {
        g.fillRect(-w / 2, my - 2, w, Math.max(2, len * 0.05 * (0.5 + sail)));
      }
      g.fillStyle = '#15100b';
      g.beginPath();
      g.arc(0, my, Math.max(1.5, beam * 0.08), 0, Math.PI * 2);
      g.fill();
    }
  }

  /** The duel ring: a dashed red circle on the water. */
  private drawDuelRing(state: ClientState): void {
    const d = state.duel;
    if (!d) return;
    const g = this.g;
    g.save();
    g.strokeStyle = d.startsIn > 0 ? 'rgba(224,184,98,0.7)' : 'rgba(208,90,80,0.75)';
    g.lineWidth = 2;
    g.setLineDash([14, 10]);
    g.beginPath();
    g.arc(this.sx(d.cx), this.sy(d.cy), d.r * this.zoom, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  private drawTethers(state: ClientState, ships: DrawShip[]): void {
    const g = this.g;
    const now = state.estServerTime();
    const pos = new Map(ships.map((s) => [s.id, s]));
    this.fx.tethers = this.fx.tethers.filter((t) => t.until > now && pos.has(t.a) && pos.has(t.b) && pos.get(t.b)!.flags & SF.TETHERED);
    g.save();
    for (const t of this.fx.tethers) {
      const a = pos.get(t.a)!, b = pos.get(t.b)!;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 6; // the cable sags
      g.strokeStyle = 'rgba(150,130,95,0.9)';
      g.lineWidth = Math.max(1, 0.6 * this.zoom);
      g.beginPath();
      g.moveTo(this.sx(a.x), this.sy(a.y));
      g.quadraticCurveTo(this.sx(mx), this.sy(my), this.sx(b.x), this.sy(b.y));
      g.stroke();
    }
    for (const bm of this.fx.beams) {
      const a = 1 - bm.t / 0.6;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(46,230,200,${a})`;
      g.lineWidth = Math.max(2, 3 * this.zoom * a);
      g.beginPath();
      g.moveTo(this.sx(bm.x), this.sy(bm.y));
      g.lineTo(this.sx(bm.x2), this.sy(bm.y2));
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  private drawBalls(): void {
    const g = this.g;
    for (const b of this.fx.balls) {
      if (b.delay > 0) continue;
      const r = Math.max(1.4, (b.ammo === 'grape' ? 0.5 : 0.9) * this.zoom);
      if (b.trail.length > 1) {
        g.strokeStyle = 'rgba(40,40,40,0.35)';
        g.lineWidth = r;
        g.beginPath();
        g.moveTo(this.sx(b.trail[0][0]), this.sy(b.trail[0][1]));
        for (const [tx, ty] of b.trail) g.lineTo(this.sx(tx), this.sy(ty));
        g.stroke();
      }
      g.fillStyle = b.ammo === 'chain' ? '#3b3b3b' : '#111';
      g.beginPath();
      g.arc(this.sx(b.x), this.sy(b.y), r, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawParticles(emissive: boolean): void {
    const g = this.g;
    // Painted particles (Higgsfield `part.*`) where they exist; the drawn shapes otherwise.
    const smokeArt = sprite('part.smoke'), splashArt = sprite('part.splash'), fireArt = sprite('part.fire'), blastArt = sprite('part.explosion');
    for (const p of this.fx.particles) {
      const isEm = p.kind === 'flash' || p.kind === 'fire' || p.kind === 'spark' || p.kind === 'ring';
      if (isEm !== emissive || p.kind === 'text') continue;
      const a = 1 - p.t / p.life;
      const x = this.sx(p.x), y = this.sy(p.y), s = Math.max(0.5, p.size * this.zoom);
      const spin = ((p.x * 13 + p.y * 7) % 6.28) + p.t * 0.4;
      const art = p.kind === 'smoke' && smokeArt && !/^#0/.test(p.color) ? smokeArt : p.kind === 'splash' ? splashArt : p.kind === 'fire' ? fireArt : p.kind === 'flash' && p.size * this.zoom > 3 ? blastArt : null;
      if (art) {
        const d = s * (p.kind === 'smoke' ? 2.0 : p.kind === 'splash' ? 2.4 : 2.2);
        g.save();
        if (p.kind === 'fire' || p.kind === 'flash') g.globalCompositeOperation = 'lighter';
        g.globalAlpha = p.kind === 'smoke' ? a * a * 0.3 : p.kind === 'splash' ? a * 0.85 : a;
        g.translate(x, y);
        g.rotate(spin);
        // Powder smoke is grey and thin, never a white cloud: a darkened copy made once.
        g.drawImage(art === smokeArt ? this.greySmoke(art.img) : art.img, -d / 2, -d / 2, d, d);
        g.restore();
        continue;
      }
      switch (p.kind) {
        case 'smoke':
          g.fillStyle = p.color;
          g.globalAlpha = a * a * 0.2;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          break;
        case 'splash':
          g.strokeStyle = p.color;
          g.globalAlpha = a * 0.7;
          g.lineWidth = Math.max(1, this.zoom);
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.stroke();
          break;
        case 'foam':
        case 'splinter':
          g.fillStyle = p.color;
          g.globalAlpha = a;
          g.fillRect(x - s / 2, y - s / 2, s, s);
          break;
        case 'glow':
          g.fillStyle = p.color;
          g.globalAlpha = a * 0.8;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          break;
        case 'flash':
        case 'fire':
        case 'spark': {
          g.globalCompositeOperation = 'lighter';
          const grd = g.createRadialGradient(x, y, 0, x, y, s);
          grd.addColorStop(0, p.color);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd;
          g.globalAlpha = a;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ring':
          g.strokeStyle = p.color;
          g.globalAlpha = a * 0.6;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.stroke();
          break;
      }
    }
    g.globalAlpha = 1;
  }

  private smokeGrey: HTMLCanvasElement | null = null;

  private greySmoke(img: HTMLImageElement): HTMLCanvasElement {
    if (this.smokeGrey) return this.smokeGrey;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cg = c.getContext('2d')!;
    cg.drawImage(img, 0, 0);
    cg.globalCompositeOperation = 'source-atop';
    cg.fillStyle = 'rgba(40,44,48,0.45)';
    cg.fillRect(0, 0, c.width, c.height);
    return (this.smokeGrey = c);
  }

  private drawTexts(): void {
    const g = this.g;
    g.textAlign = 'center';
    for (const p of this.fx.particles) {
      if (p.kind !== 'text' || !p.text) continue;
      const a = 1 - p.t / p.life;
      g.globalAlpha = a;
      g.font = `600 ${p.size}px Inter, sans-serif`;
      g.fillStyle = '#000';
      g.fillText(p.text, this.sx(p.x) + 1, this.sy(p.y) + 1);
      g.fillStyle = p.color;
      g.fillText(p.text, this.sx(p.x), this.sy(p.y));
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ light

  private drawLighting(state: ClientState, ships: DrawShip[], night: number): void {
    const dg = this.dg;
    const W = this.dark.width, H = this.dark.height;
    const k = 0.5; // dark canvas is half resolution
    // Night falls hard but not blind: a phone in a lit room must still read the sea (docs/06 §5.8).
    const darkness = 0.12 + night * 0.4 + (state.weather === 'storm' || state.weather === 'black_storm' ? 0.1 : 0);
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = `rgba(3,6,14,${darkness})`;
    dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = 'destination-out';
    const hole = (wx: number, wy: number, r: number, strength: number) => {
      const x = this.sx(wx) * k, y = this.sy(wy) * k, rr = r * this.zoom * k;
      if (x < -rr || y < -rr || x > W + rr || y > H + rr) return;
      const grd = dg.createRadialGradient(x, y, 0, x, y, rr);
      grd.addColorStop(0, `rgba(0,0,0,${strength})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = grd;
      dg.beginPath();
      dg.arc(x, y, rr, 0, Math.PI * 2);
      dg.fill();
    };
    const glows: { x: number; y: number; r: number; color: string; a: number }[] = [];
    const marks: { x: number; y: number; sign: string; color: string }[] = [];
    const opt = settings();
    for (const s of ships) {
      if (s.flags & SF.LANTERNS_OUT || s.sinkT > 0) continue;
      const cls = SHIP_CLASSES[s.classId];
      const back = headingVec(s.h + Math.PI);
      const lx = s.x + back.x * cls.length * 0.4, ly = s.y + back.y * cls.length * 0.4;
      hole(lx, ly, 55 + cls.length, 0.75);
      if (s.own) hole(s.x, s.y, 140, 0.35);
      const fac = s.own ? '#f2b35a' : s.info && s.info.faction !== 'player' ? cbColor(opt.colorblind, FACTIONS[s.info.faction].lantern) : '#f2b35a';
      // Lanterns flicker a little (unless the options still them).
      const flick = opt.lanternFlicker ? 0.88 + 0.12 * Math.sin(this.time * 9 + s.id * 1.7) * Math.sin(this.time * 3.1 + s.id) : 1;
      glows.push({ x: lx, y: ly, r: 16 + cls.length * 0.4, color: fac, a: 0.55 * flick });
      // Lantern marks: the faction's sign by her lantern at battle zoom.
      if (opt.lanternMarks && this.zoom >= 1.4 && s.info && s.info.faction !== 'player') marks.push({ x: lx, y: ly, sign: FACTION_SIGN[s.info.faction], color: fac });
    }
    for (const p of state.ports) {
      hole(p.x, p.y, 520, 0.8);
      glows.push({ x: p.x, y: p.y, r: 90, color: cbColor(opt.colorblind, FACTIONS[p.faction].lantern), a: 0.28 });
    }
    for (const is of state.islands.values()) {
      if (!is.features.includes('lighthouse')) continue;
      const p = this.featurePoint(is, 1, 0.04);
      hole(p.x, p.y, 260, 0.85);
      glows.push({ x: p.x, y: p.y, r: 40, color: '#f5c77a', a: 0.6 });
      // Rotating beam.
      const a = this.time * 0.6 + is.id;
      const v = headingVec(a);
      hole(p.x + v.x * 500, p.y + v.y * 500, 260, 0.35);
      if (REGIONS[is.region].strangeness > 0.3 && is.features.includes('shrine')) glows.push({ x: is.x, y: is.y, r: 70, color: '#2ee6c8', a: 0.25 });
    }
    for (const l of this.fx.lights) {
      const f = 1 - l.t / l.life;
      hole(l.x, l.y, l.r, l.intensity * f);
      glows.push({ x: l.x, y: l.y, r: l.r * 0.4, color: l.color, a: 0.5 * l.intensity * f });
    }
    dg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.drawImage(this.dark, 0, 0, this.w, this.h);
    // Additive lantern glow (warm against cold water).
    g.globalCompositeOperation = 'lighter';
    for (const gl of glows) {
      const x = this.sx(gl.x), y = this.sy(gl.y), r = gl.r * this.zoom;
      if (x < -r || y < -r || x > this.w + r || y > this.h + r) continue;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, hexA(gl.color, gl.a * (0.4 + night * 0.6)));
      grd.addColorStop(1, hexA(gl.color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    if (marks.length) {
      g.font = '600 13px Inter, sans-serif';
      g.textAlign = 'left';
      for (const m of marks) {
        const x = this.sx(m.x) + 7, y = this.sy(m.y) + 4;
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillText(m.sign, x + 1, y + 1);
        g.fillStyle = m.color;
        g.fillText(m.sign, x, y);
      }
    }
    // Cold moonlight grade.
    g.fillStyle = `rgba(40,70,110,${0.04 + night * 0.05})`;
    g.globalCompositeOperation = 'soft-light';
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'source-over';
  }

  private drawWeather(state: ClientState, dt: number): void {
    const g = this.g;
    // Fog: noise layer drifting with the wind (the shader sky draws it when WebGL is on).
    if (state.fog > 0.08 && !this.sky) {
      this.noisePattern ??= g.createPattern(this.noise, 'repeat');
      const p = this.noisePattern!;
      const wind = headingVec(state.wind[0]);
      const drift = this.time * 6;
      p.setTransform(new DOMMatrix().translate(this.sx(wind.x * drift), this.sy(wind.y * drift)).scale((900 * this.zoom) / 256));
      g.fillStyle = p;
      g.globalAlpha = state.fog * 0.22;
      g.globalCompositeOperation = 'screen';
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(70,82,92,${state.fog * 0.16})`;
      g.fillRect(0, 0, this.w, this.h);
      g.globalAlpha = 1;
    }
    const raining = state.weather === 'rain' || state.weather === 'storm' || state.weather === 'black_storm';
    if (raining) {
      const heavy = state.weather !== 'rain';
      const wind = headingVec(state.wind[0]);
      g.strokeStyle = state.weather === 'black_storm' ? 'rgba(120,200,190,0.25)' : 'rgba(180,195,210,0.28)';
      g.lineWidth = 1;
      g.beginPath();
      const n = heavy ? this.rain.length : this.rain.length / 2;
      for (let i = 0; i < n; i++) {
        const r = this.rain[i];
        r.y += dt * r.s * 1.6;
        r.x += dt * wind.x * 0.3;
        if (r.y > 1) r.y -= 1;
        if (r.x > 1) r.x -= 1;
        if (r.x < 0) r.x += 1;
        const x = r.x * this.w, y = r.y * this.h;
        g.moveTo(x, y);
        g.lineTo(x + wind.x * 6, y + 14 * r.s);
      }
      g.stroke();
      if (heavy) {
        this.nextLightning -= dt;
        if (this.nextLightning <= 0) {
          this.nextLightning = 6 + Math.random() * 12; // series of strikes at least 4 s apart
          this.lightning = 1;
          this.fx.screenFlash(0.8);
          this.onLightning();
          // A bolt from the top of the sky down to somewhere over the sea.
          let x = this.w * (0.15 + Math.random() * 0.7), y = -10;
          const pts: [number, number][] = [[x, y]];
          for (let i = 0; i < 7; i++) {
            x += (Math.random() - 0.5) * this.w * 0.08;
            y += this.h * (0.06 + Math.random() * 0.06);
            pts.push([x, y]);
          }
          this.bolt = pts;
        }
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3);
    if (this.lightning <= 0) this.bolt = null;
    if (this.sky) {
      const wv = headingVec(state.wind[0]);
      this.sky.draw({
        camX: this.camX, camY: this.camY, zoom: this.zoom, time: this.time, wind: [wv.x * (0.5 + state.wind[1]), wv.y * (0.5 + state.wind[1])],
        fog: clamp(state.fog, 0, 1), flash: settings().reduceFlashes ? this.fx.flash * 0.25 : this.fx.flash, night: nightFactor(state.estServerTime()), bolt: this.bolt, boltOn: settings().reduceFlashes ? 0 : this.lightning,
      });
    }
  }

  private drawVignette(fog: number, night: number): void {
    const g = this.g;
    const grd = g.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(0,0,0,${0.4 + night * 0.15 + fog * 0.12})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, this.w, this.h);
  }

  // ------------------------------------------------------------------ overlays

  private drawAim(state: ClientState, own: SailState, aim: { side: 'port' | 'starboard' | null; dist: number; chaser: 'bow' | 'stern' | null }): void {
    const g = this.g;
    const you = state.you!;
    const self = state.self!;
    if (aim.chaser) {
      const cls = SHIP_CLASSES[self.loadout.classId];
      const has = aim.chaser === 'bow' ? cls.bowChasers : cls.sternChasers;
      if (has) {
        const ready = you.reload[aim.chaser] >= 1;
        const keel = aim.chaser === 'bow' ? own.heading : own.heading + Math.PI;
        const r = GUNS.long_9.range * (state.ownStats?.rangeMul ?? 1) * AMMO[you.ammoSel === 'grape' ? 'round' : you.ammoSel].rangeMul * this.zoom;
        const x = this.sx(own.x), y = this.sy(own.y);
        // A soft fan of light that fades toward the range, and the range itself as a short bright arc — no rays
        // running off the screen.
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, ready ? 'rgba(143,179,217,0.16)' : 'rgba(90,100,110,0.08)');
        grd.addColorStop(1, 'rgba(143,179,217,0)');
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, r, keel - Math.PI / 2 - CHASER_CONE, keel - Math.PI / 2 + CHASER_CONE);
        g.closePath();
        g.fillStyle = grd;
        g.fill();
        g.beginPath();
        g.arc(x, y, r, keel - Math.PI / 2 - CHASER_CONE, keel - Math.PI / 2 + CHASER_CONE);
        g.strokeStyle = ready ? 'rgba(143,179,217,0.55)' : 'rgba(90,100,110,0.35)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    for (const side of ['port', 'starboard'] as const) {
      const gun = GUNS[self.loadout.guns[side]];
      const range = gun.range * (state.ownStats?.rangeMul ?? 1) * AMMO[you.ammoSel].rangeMul;
      const ready = you.reload[side] >= 1;
      const active = aim.side === side;
      const h = own.heading + (side === 'port' ? -Math.PI / 2 : Math.PI / 2);
      const spread = (gun.spreadDeg * Math.PI) / 180 * 3 + 0.12;
      const x = this.sx(own.x), y = this.sy(own.y);
      const r = range * this.zoom;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, active ? (ready ? 'rgba(224,184,98,0.2)' : 'rgba(150,120,90,0.1)') : ready ? 'rgba(224,184,98,0.06)' : 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(224,184,98,0)');
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, r, h - Math.PI / 2 - spread, h - Math.PI / 2 + spread);
      g.closePath();
      g.fillStyle = grd;
      g.fill();
      if (active) {
        g.beginPath();
        g.arc(x, y, r, h - Math.PI / 2 - spread, h - Math.PI / 2 + spread);
        g.strokeStyle = ready ? 'rgba(224,184,98,0.5)' : 'rgba(150,120,90,0.35)';
        g.lineWidth = 1.5;
        g.stroke();
        // Aim distance marker.
        const d = clamp(aim.dist, 40, range) * this.zoom;
        g.beginPath();
        g.arc(x, y, d, h - Math.PI / 2 - spread, h - Math.PI / 2 + spread);
        g.strokeStyle = ready ? 'rgba(240,200,110,0.9)' : 'rgba(150,120,90,0.6)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
  }

  private drawLabel(s: DrawShip, state: ClientState, boardTarget: boolean): void {
    const g = this.g;
    if (!s.info || s.flags & SF.HIDDEN) return;
    const cls = SHIP_CLASSES[s.classId];
    // Monsters and their parts: the boss panel names them; over the water only a thin bar of their strength.
    if (cls.monster) {
      if (s.flags & SF.SUBMERGED) return;
      const bx = this.sx(s.x), by = this.sy(s.y) - (Math.min(cls.length, 60) * this.zoom) / 2 - 8;
      const w = Math.min(70, 26 + cls.length * 0.3);
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(bx - w / 2 - 1, by - 1, w + 2, 5);
      g.fillStyle = '#b23a3a';
      g.fillRect(bx - w / 2, by, w * clamp(s.hull, 0, 1), 3);
      return;
    }
    const x = this.sx(s.x), y = this.sy(s.y) - (cls.length * this.zoom) / 2 - 16;
    const hostile = (s.flags & SF.HOSTILE) !== 0;
    const info = s.info;
    const faction = info.faction !== 'player' ? FACTIONS[info.faction] : null;
    g.textAlign = 'center';
    g.font = '600 11px Inter, sans-serif';
    // The faction's sign leads every NPC's name (§11.1): never the lantern's colour alone.
    const label = info.isPlayer ? `${info.captainName} · ${info.name}` : `${faction ? FACTION_SIGN[info.faction as FactionId] + ' ' : ''}${info.name}`;
    const cb = settings().colorblind;
    g.fillStyle = '#000';
    g.fillText(label, x + 1, y + 1);
    g.fillStyle = cbColor(cb, hostile ? '#e0776b' : info.isPlayer ? '#cfe0f2' : faction ? faction.lantern : '#ccc');
    g.fillText(label, x, y);
    g.font = '10px Inter, sans-serif';
    g.fillStyle = 'rgba(180,180,180,0.8)';
    const role = info.npcRole && hasRole(info.npcRole) ? L(`role.${info.npcRole}`) : info.npcRole;
    const tag = info.isPlayer ? `${info.title ? info.title + ' · ' : ''}${L('level', { n: info.level ?? 1 })}${info.wanted ? ' · ' + '☠'.repeat(info.wanted) : ''}` : info.npcRole === 'boss' ? L('boss') : cls.monster ? L('hulk') : `${cls.name} · ${faction?.short ?? ''}${role ? ' ' + role : ''}`;
    const marks = info.isPlayer
      ? `${s.flags & SF.BLACK_FLAG ? L('blackFlag') : ''}${s.flags & SF.GREEN_PENNANT ? L('greenPennant') : ''}${s.flags & SF.SHAME ? L('shame') : ''}${s.flags & SF.BOUNTY ? L('bounty') : ''}${s.flags & SF.DUEL ? L('duel') : ''}`
      : '';
    if (s.flags & SF.SHAME) g.fillStyle = 'rgba(224,119,107,0.9)';
    g.fillText(tag + marks + (s.flags & SF.SURRENDERED ? L('struck') : ''), x, y + 11);
    // Hull and sails bars.
    const w = 46;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(x - w / 2 - 1, y + 15, w + 2, 7);
    g.fillStyle = s.hull > 0.5 ? '#9b5a44' : s.hull > 0.25 ? '#b0703a' : '#c23d33';
    g.fillRect(x - w / 2, y + 16, w * clamp(s.hull, 0, 1), 2.5);
    g.fillStyle = '#b3ab96';
    g.fillRect(x - w / 2, y + 19, w * clamp(s.sails, 0, 1), 2);
    // Admiral's Eye: what your glass reads of her.
    const eye = state.self?.inspect.find((i) => i.id === s.id);
    if (eye) {
      g.font = '10px Inter, sans-serif';
      g.fillStyle = 'rgba(0,0,0,0.8)';
      const line = L('eye', { hull: eye.hull, crew: eye.crew, morale: eye.morale, port: eye.port ? '●' : '○', stbd: eye.starboard ? '●' : '○' });
      g.fillText(line, x + 1, y + 34);
      g.fillStyle = '#d9c9a0';
      g.fillText(line, x, y + 33);
    }
    if (boardTarget || s.flags & SF.MARKED) {
      g.strokeStyle = boardTarget ? 'rgba(224,184,98,0.9)' : 'rgba(208,106,94,0.9)';
      g.setLineDash([5, 4]);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(this.sx(s.x), this.sy(s.y), cls.length * this.zoom * 0.7, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
  }
}

function hexA(color: string, a: number): string {
  if (color.startsWith('rgba')) return color.replace(/,\s*[\d.]+\)$/, `,${a})`);
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** '#0c141c' → [r, g, b] in 0..1. */
function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * How far a ship heels, −1 (to port) … 1 (to starboard): the wind's push across her (strongest on the beam) times
 * the canvas set, less for heavier hulls; a flooded hold adds a steady list; the swell rocks her a little.
 */
export function shipHeel(heading: number, windDir: number, windStrength: number, sail: number, tier: number, water: number, swell: number): number {
  const across = Math.sin(windDir - heading); // > 0: the wind blows toward her starboard side
  const push = across * clamp(windStrength, 0, 1.5) * sail * (1.2 / (0.6 + tier * 0.4));
  const list = water * 0.35;
  return clamp(push * 0.8 + Math.sign(push || 1) * list + swell * 0.04 * (0.5 + windStrength), -1, 1);
}
