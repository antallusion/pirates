// Visual effects: cannonballs (simulated from volley events), smoke, splashes, splinters, fire,
// explosions, ability effects and floating combat text. Pure presentation — never game state.

import { AMMO } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import { headingVec } from '../../../shared/src/math.ts';
import type { GameEvent } from '../../../shared/src/protocol.ts';

export interface Particle {
  kind: 'smoke' | 'flash' | 'splash' | 'splinter' | 'fire' | 'ring' | 'text' | 'spark' | 'foam' | 'glow';
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  grow: number;
  color: string;
  text?: string;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number; // meters remaining
  delay: number;
  ammo: AmmoId;
  owner: number;
  alive: boolean;
  trail: [number, number][];
}

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  intensity: number;
  life: number;
  t: number;
}

/** Decoration the LOD may thin; flashes, fire, rings and combat text always show — they carry information. */
const DECOR = new Set<Particle['kind']>(['smoke', 'foam', 'spark', 'splinter', 'glow', 'splash']);
export const PARTICLE_CAP = [2400, 1000, 400];
const THIN = [0, 0.4, 0.7];

export class Fx {
  particles: Particle[] = [];
  balls: Ball[] = [];
  lights: Light[] = [];
  tethers: { a: number; b: number; until: number }[] = [];
  beams: { x: number; y: number; x2: number; y2: number; t: number }[] = [];
  shake = 0;
  flash = 0; // lightning / explosion screen flash

  private lastFlash = -1;

  /** A screen flash — never more than three a second (docs/07 §11.3), whatever sets them off. */
  screenFlash(v: number): boolean {
    const now = (globalThis.performance?.now() ?? Date.now()) / 1000;
    if (now - this.lastFlash < 1 / 3) return false;
    this.lastFlash = now;
    this.flash = Math.max(this.flash, v);
    return true;
  }

  /** Particle LOD: 0 full, 1 thinned, 2 sparse. Chosen from the frame time (or pinned low by the options). */
  lod = 0;
  /** Pinned by the effects option; null follows the frame time. */
  forceLod: number | null = null;
  /** The visible world rectangle (with a margin): decorative particles outside it are never born. */
  view: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private frameEma = 16;

  /** Feeds a frame time; raises the LOD when frames run long, lowers it again (with hysteresis) when they recover. */
  frame(ms: number): void {
    this.frameEma += (Math.min(ms, 100) - this.frameEma) * 0.05;
    if (this.forceLod !== null) {
      this.lod = this.forceLod;
      return;
    }
    if (this.frameEma > 28) this.lod = 2;
    else if (this.frameEma > 21 && this.lod < 1) this.lod = 1;
    else if (this.frameEma < 18 && this.lod === 2) this.lod = 1;
    else if (this.frameEma < 15) this.lod = 0;
  }

  add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>): void {
    if (DECOR.has(p.kind) && !this.admit(p.x, p.y)) return;
    this.particles.push({ vx: 0, vy: 0, t: 0, life: 1, size: 4, grow: 0, color: '#fff', ...p });
  }

  /** Whether a decorative particle is born: on screen, under the cap, and past the LOD's thinning. */
  admit(x: number, y: number): boolean {
    const v = this.view;
    if (v && (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1)) return false;
    if (this.particles.length >= PARTICLE_CAP[this.lod]) return false;
    return this.lod === 0 || Math.random() >= THIN[this.lod];
  }

  light(x: number, y: number, r: number, color: string, intensity: number, life: number): void {
    this.lights.push({ x, y, r, color, intensity, life, t: 0 });
  }

  smoke(x: number, y: number, n: number, size = 8, dark = false): void {
    for (let i = 0; i < n; i++) {
      this.add({
        kind: 'smoke', x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 2.5 + Math.random() * 2.5,
        size: size * (0.6 + Math.random() * 0.6), grow: 5 + Math.random() * 4, color: dark ? '#1b1c1e' : '#8d8f92',
      });
    }
  }

  splash(x: number, y: number, big = false): void {
    this.add({ kind: 'splash', x, y, life: big ? 1.6 : 0.9, size: big ? 6 : 2, grow: big ? 22 : 14, color: '#c9d6de' });
    for (let i = 0; i < (big ? 14 : 5); i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * (big ? 10 : 5);
      this.add({ kind: 'foam', x, y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, life: 0.6 + Math.random() * 0.6, size: 1 + Math.random() * 1.5, color: '#dfe8ee' });
    }
  }

  splinters(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 16;
      this.add({ kind: 'splinter', x, y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, life: 0.8 + Math.random() * 0.8, size: 1 + Math.random() * 1.6, color: Math.random() < 0.5 ? '#5b4630' : '#8a6d4b' });
    }
  }

  explosion(x: number, y: number, r: number): void {
    this.add({ kind: 'flash', x, y, life: 0.35, size: r * 0.6, grow: r * 2, color: '#ffcf7a' });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, s = 8 + Math.random() * 30;
      this.add({ kind: 'fire', x, y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, life: 0.6 + Math.random() * 0.9, size: 3 + Math.random() * 5, grow: 3, color: '#ff8a3c' });
    }
    this.smoke(x, y, 16, 14, true);
    this.splinters(x, y, 20);
    this.light(x, y, r * 6, 'rgba(255,150,70,1)', 1, 1.2);
    this.shake = Math.max(this.shake, 0.6);
  }

  text(x: number, y: number, text: string, color: string): void {
    this.add({ kind: 'text', x, y, vy: -9, life: 1.3, size: 13, color, text });
  }

  onEvent(e: GameEvent, ownId: number): void {
    switch (e.k) {
      case 'volley': {
        const ammo = AMMO[e.ammo];
        const spd = ammo.speed * (e.spd ?? 1);
        for (const [x, y, h, d, delay] of e.balls) {
          const v = headingVec(h);
          this.balls.push({ x, y, vx: v.x * spd, vy: v.y * spd, left: d, delay: delay / 1000, ammo: e.ammo, owner: e.ship, alive: true, trail: [] });
          const flashDelay = delay / 1000;
          setTimeout(() => {
            this.add({ kind: 'flash', x: x + v.x * 3, y: y + v.y * 3, life: 0.14, size: 5, grow: 40, color: '#ffd28a' });
            this.light(x, y, 90, 'rgba(255,190,110,1)', 0.8, 0.25);
            for (let i = 0; i < 3; i++) {
              this.add({
                kind: 'smoke', x: x + v.x * (4 + i * 5), y: y + v.y * (4 + i * 5), vx: v.x * (6 - i) + (Math.random() - 0.5) * 2, vy: v.y * (6 - i) + (Math.random() - 0.5) * 2,
                life: 3 + Math.random() * 3, size: 5 + Math.random() * 4, grow: 5, color: '#7c7f83',
              });
            }
          }, flashDelay * 1000);
        }
        if (e.ship === ownId) this.shake = Math.max(this.shake, 0.25);
        break;
      }
      case 'hit': {
        // Stop the closest in-flight ball.
        let best: Ball | null = null, bd = 50 * 50;
        for (const b of this.balls) {
          if (!b.alive || b.delay > 0) continue;
          const d = (b.x - e.x) ** 2 + (b.y - e.y) ** 2;
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
        if (best) best.alive = false;
        if (e.dmg <= 0) {
          this.splash(e.x, e.y);
          break;
        }
        this.splinters(e.x, e.y, e.ammo === 'grape' ? 3 : 8);
        this.smoke(e.x, e.y, 2, 5, true);
        this.light(e.x, e.y, 50, 'rgba(255,170,90,1)', 0.5, 0.2);
        const color = e.ship === ownId ? '#e07a6a' : e.crit ? '#f0c060' : '#e8e0cc';
        this.text(e.x, e.y - 6, e.crit ? `${e.dmg} ${e.crit.toUpperCase()}` : String(e.dmg), color);
        if (e.ship === ownId) this.shake = Math.max(this.shake, 0.35);
        break;
      }
      case 'tether':
        this.tethers = this.tethers.filter((t) => t.a !== e.a);
        this.tethers.push({ a: e.a, b: e.b, until: e.until });
        break;
      case 'lance':
        this.beams.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, t: 0 });
        this.light(e.x2, e.y2, 160, 'rgba(46,230,200,1)', 1, 0.8);
        this.splash(e.x2, e.y2, false);
        break;
      case 'sunk':
        this.splash(e.x, e.y, true);
        this.smoke(e.x, e.y, 20, 16, true);
        this.splinters(e.x, e.y, 30);
        break;
      case 'fx':
        switch (e.fx) {
          case 'explosion':
            this.explosion(e.x, e.y, e.r ?? 40);
            break;
          case 'deep_call':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 1.2, size: 10, grow: 70, color: '#2ee6c8' });
            this.splash(e.x, e.y, true);
            this.light(e.x, e.y, 160, 'rgba(46,230,200,1)', 0.9, 1.4);
            break;
          case 'maw':
            this.add({ kind: 'glow', x: e.x, y: e.y, life: 3, size: (e.r ?? 75) * 1.2, grow: 0, color: '#021614' });
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 2.5, size: 20, grow: 60, color: '#2ee6c8' });
            for (let i = 0; i < 3; i++) this.splash(e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60, true);
            this.light(e.x, e.y, 320, 'rgba(46,230,200,1)', 1, 2.5);
            this.shake = 1;
            break;
          case 'maw_warn':
            // Boiling water where the Maw will open: everyone sees it coming.
            for (let i = 0; i < 24; i++) {
              const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (e.r ?? 45);
              setTimeout(() => this.splash(e.x + Math.sin(a) * r, e.y - Math.cos(a) * r, false), i * 120);
            }
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 3, size: e.r ?? 45, grow: 0, color: '#2ee6c8' });
            break;
          case 'drowned_hands':
            this.add({ kind: 'glow', x: e.x, y: e.y, life: 6, size: e.r ?? 60, grow: 0, color: '#062a26' });
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 6, size: e.r ?? 60, grow: 0, color: '#2ee6c8' });
            this.splash(e.x, e.y, true);
            break;
          case 'undertow': {
            const d = e.dir ?? 0, len = e.r ?? 200;
            for (let i = -4; i <= 4; i++) {
              const x = e.x + Math.sin(d) * (len * i) / 4, y = e.y - Math.cos(d) * (len * i) / 4;
              this.add({ kind: 'glow', x, y, life: 10, size: 34, grow: 0, color: '#0a2f2b' });
            }
            break;
          }
          case 'between_worlds':
            this.add({ kind: 'glow', x: e.x, y: e.y, life: 12, size: (e.r ?? 40) * 1.6, grow: 0, color: '#010807' });
            this.light(e.x, e.y, 200, 'rgba(46,230,200,1)', 0.6, 3);
            break;
          case 'barrage':
            for (let i = 0; i < 12; i++) {
              const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (e.r ?? 90);
              const x = e.x + Math.sin(a) * r, y = e.y - Math.cos(a) * r;
              setTimeout(() => {
                this.splash(x, y, true);
                this.add({ kind: 'flash', x, y, life: 0.2, size: 4, grow: 50, color: '#ffc27a' });
                this.light(x, y, 80, 'rgba(255,170,90,1)', 0.7, 0.3);
              }, i * 90);
            }
            this.shake = 0.8;
            break;
          case 'smoke':
            for (let i = 0; i < 40; i++) {
              const a = Math.random() * Math.PI * 2, r = Math.random() * (e.r ?? 100);
              this.add({ kind: 'smoke', x: e.x + Math.sin(a) * r, y: e.y - Math.cos(a) * r, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 8 + Math.random() * 4, size: 18 + Math.random() * 14, grow: 3, color: '#57595c' });
            }
            break;
          case 'war_cry':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 1, size: 20, grow: 300, color: '#b08d57' });
            break;
          case 'star_fix':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 2.5, size: 50, grow: 900, color: '#8fb3d9' });
            break;
          case 'mortar_launch':
            this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.25, size: 6, grow: 60, color: '#ffc27a' });
            this.smoke(e.x, e.y, 6, 9, true);
            this.shake = Math.max(this.shake, 0.3);
            break;
          case 'mortar':
            this.explosion(e.x, e.y, e.r ?? 55);
            this.splash(e.x, e.y, true);
            break;
          case 'harpoon_miss':
            this.splash(e.x, e.y, false);
            break;
          case 'ram':
            this.splinters(e.x, e.y, 24);
            this.splash(e.x, e.y, true);
            this.shake = 0.6;
            break;
          case 'hot_barrels':
            // Red-hot guns: a dull orange glow along the gun deck, readable to the enemy.
            this.add({ kind: 'glow', x: e.x, y: e.y, life: 1.2, size: 26, grow: 4, color: '#ff7a2a' });
            this.light(e.x, e.y, 90, 'rgba(255,120,40,1)', 0.55, 1.2);
            break;
          case 'broken_mast':
            this.splinters(e.x, e.y, 30);
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 0.8, size: 10, grow: 60, color: '#b08d57' });
            break;
          case 'crossfire':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 0.9, size: 12, grow: 80, color: '#d06a5e' });
            break;
          case 'breach':
            this.splash(e.x, e.y, false);
            break;
          // World bosses.
          case 'boss_roar':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 2, size: 30, grow: (e.r ?? 400) / 2, color: '#9aa9b0' });
            for (let i = 0; i < 10; i++) this.splash(e.x + (Math.random() - 0.5) * 120, e.y + (Math.random() - 0.5) * 120, true);
            this.shake = Math.max(this.shake, 0.9);
            break;
          case 'white_water':
            for (let i = 0; i < 30; i++) {
              const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (e.r ?? 70);
              setTimeout(() => this.splash(e.x + Math.sin(a) * r, e.y - Math.cos(a) * r, false), i * 90);
            }
            break;
          case 'lightning':
            this.screenFlash(0.9);
            this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.3, size: 10, grow: 120, color: '#d8e4ff' });
            this.light(e.x, e.y, 400, 'rgba(210,225,255,1)', 1, 0.4);
            this.splinters(e.x, e.y, 12);
            break;
          case 'ink':
            for (let i = 0; i < 16; i++) {
              const a = Math.random() * Math.PI * 2, r = Math.random() * (e.r ?? 180);
              this.add({ kind: 'smoke', x: e.x + Math.sin(a) * r, y: e.y - Math.cos(a) * r, life: 10, size: 30 + Math.random() * 20, grow: 2, color: '#07070c' });
            }
            break;
          case 'bile':
            this.add({ kind: 'glow', x: e.x, y: e.y, life: 3, size: e.r ?? 70, grow: 0, color: '#6a8a1a' });
            this.smoke(e.x, e.y, 8, 10, false);
            break;
          case 'swallow':
          case 'spit':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 1.2, size: 20, grow: 80, color: '#ffe19a' });
            for (let i = 0; i < 6; i++) this.splash(e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 50, true);
            this.shake = Math.max(this.shake, 0.5);
            break;
          case 'song':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 4, size: 40, grow: (e.r ?? 1600) / 4, color: '#9b6bd0' });
            break;
          case 'plankton': {
            // Bioluminescence wakes around the hull: slow teal motes and a soft light (the First Watch's strangeness).
            const r = e.r ?? 220;
            for (let i = 0; i < 90; i++) {
              const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
              this.particles.push({ kind: 'glow', x: e.x + Math.sin(a) * d, y: e.y - Math.cos(a) * d, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, t: 0, life: 6 + Math.random() * 6, size: 2 + Math.random() * 3, grow: 0.3, color: Math.random() < 0.7 ? '#2ee6c8' : '#8ff7e6' });
            }
            this.light(e.x, e.y, r * 1.4, 'rgba(46,230,200,1)', 0.7, 10);
            break;
          }
          case 'ice':
            this.splinters(e.x, e.y, 18);
            this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.3, size: 8, grow: 40, color: '#dff4ff' });
            break;
          case 'claws':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 0.8, size: 20, grow: (e.r ?? 130), color: '#6b4a35' });
            this.splinters(e.x, e.y, 16);
            break;
          case 'coil':
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 2, size: e.r ?? 320, grow: 0, color: '#c9e04a' });
            break;
          case 'rise':
            this.add({ kind: 'glow', x: e.x, y: e.y, life: 4, size: e.r ?? 60, grow: 10, color: '#0a2f2b' });
            this.light(e.x, e.y, 180, 'rgba(46,230,200,1)', 0.8, 3);
            break;
          case 'axes':
            this.splinters(e.x, e.y, 10);
            break;
          case 'dig':
            // Gulls over the pit by day, a lantern by night: either way, it can be seen.
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 2, size: 8, grow: 30, color: '#e0d6b8' });
            this.light(e.x, e.y, 90, 'rgba(255,200,120,1)', 0.6, 10);
            break;
        }
        break;
      case 'ability':
        if (e.id === 'vanish_into_fog' || e.id === 'smoke_pots') this.onEvent({ k: 'fx', fx: 'smoke', x: e.x ?? 0, y: e.y ?? 0, r: 140 }, ownId);
        break;
    }
  }

  update(dt: number): void {
    for (const b of this.balls) {
      if (!b.alive) continue;
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      const step = Math.min(b.left, Math.hypot(b.vx, b.vy) * dt);
      const sp = Math.hypot(b.vx, b.vy) || 1;
      b.x += (b.vx / sp) * step;
      b.y += (b.vy / sp) * step;
      b.left -= step;
      b.trail.push([b.x, b.y]);
      if (b.trail.length > 6) b.trail.shift();
      if (b.left <= 0.01) {
        b.alive = false;
        this.splash(b.x, b.y);
      }
    }
    this.balls = this.balls.filter((b) => b.alive);
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.2 * dt;
      p.vy *= 1 - 1.2 * dt;
      p.size += p.grow * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const l of this.lights) l.t += dt;
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < 0.6);
    this.lights = this.lights.filter((l) => l.t < l.life);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }
}
