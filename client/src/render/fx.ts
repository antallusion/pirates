// Visual effects: cannonballs (simulated from volley events), smoke, splashes, splinters, fire,
// explosions, ability effects and floating combat text. Pure presentation — never game state.

import { dict } from '../i18n.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';
import { AMMO } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';
import type { GameEvent } from '../../../shared/src/protocol.ts';

const L = dict(REN, RRU);

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
  /** Damage a hit number carries: the hits of one broadside on one ship add up into it. */
  sum?: number;
  /** A critical hit on one of her parts (docs/16 #2): the word goes up on a plate with its picture. */
  badge?: CritPart;
  /** The ship it stands over. */
  ship?: number;
  /** A broadside's number past its alpha limit (docs/25 item 1): drawn with the shield of «броня держит». */
  guard?: boolean;
}

/** The grey of a ball her armour held (past the broadside's alpha limit). */
export const GUARD_GREY = '#a9a49a';

/** A broadside's number by its sum (docs/25 item 11): 18 px for a few, about 27 for thousands; an elite's or a boss's
 *  a third bigger again. */
export function sumSize(sum: number, big: boolean): number {
  const s = 15 + 3.2 * Math.log10(Math.max(1, sum));
  return Math.round(Math.min(big ? 44 : 32, big ? s * 1.35 : s));
}

/** Her parts a critical hit can strike, each with its plate over the target (docs/16 #2). */
export type CritPart = 'rudder' | 'mast' | 'powder' | 'gun' | 'fire' | 'leak' | 'breach';
export const CRIT_PARTS: readonly CritPart[] = ['rudder', 'mast', 'powder', 'gun', 'fire', 'leak', 'breach'];

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
  /** A shore gun's flash, drawn from the painted muzzle blast (docs/16 #7): where, which way, how old. */
  muzzles: { x: number; y: number; dir: number; t: number; life: number }[] = [];
  /** When each lair gun last fired (x,y key → performance seconds), so the fort's barrel follows its shot. */
  gunShots = new Map<string, { dir: number; at: number }>();
  lights: Light[] = [];
  tethers: { a: number; b: number; until: number }[] = [];
  beams: { x: number; y: number; x2: number; y2: number; t: number }[] = [];
  shake = 0;
  /** Balls on her own hull since the renderer last looked (docs/23, 2026-10-09: the camera's knock, by the blow). */
  blows: { dmg: number; x: number; y: number }[] = [];
  /** She fired or was hit since the renderer last looked: a sign of the fight for its camera (camfight.ts). */
  fought = false;
  /** An elite, a boss or one of the deep's great ones: her broadside numbers are drawn bigger (set by the renderer). */
  bigTarget: (ship: number) => boolean = () => false;
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

  /** A round of a deck fight between two hulls lashed together: powder smoke for volleys, sparks where steel
   *  meets steel, grenades bursting, and men over the side for the dead. */
  deckFight(x: number, y: number, ta: string, tb: string, dead: number): void {
    for (const t of [ta, tb]) {
      if (t === 'volley' || t === 'officers') {
        for (let i = 0; i < 8; i++) {
          const px = x + (Math.random() - 0.5) * 26, py = y + (Math.random() - 0.5) * 26;
          setTimeout(() => {
            this.add({ kind: 'flash', x: px, y: py, life: 0.12, size: 1.5, grow: 16, color: '#ffe0a0' });
            this.smoke(px, py, 2, 5);
          }, i * 45);
        }
      } else if (t === 'charge' || t === 'captain' || t === 'colours') {
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 10;
          this.add({ kind: 'fire', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, life: 0.25 + Math.random() * 0.2, size: 1, color: '#fff2c0' });
        }
      } else if (t === 'grenades') {
        for (let i = 0; i < 3; i++) {
          const px = x + (Math.random() - 0.5) * 30, py = y + (Math.random() - 0.5) * 30;
          setTimeout(() => this.explosion(px, py, 12), 120 + i * 160);
        }
      }
    }
    // Men who fall go over the side.
    for (let i = 0; i < Math.min(6, Math.ceil(dead / 3)); i++) {
      const a = Math.random() * Math.PI * 2;
      setTimeout(() => this.splash(x + Math.sin(a) * 22, y - Math.cos(a) * 22, false), 200 + i * 110);
    }
  }

  /** A critical hit on one of her parts (docs/16 #2): the damage as ever, and over the ship a plate with the part's
   *  picture and its word — «Руль!», «Мачта!», «Погреб!» — that pops up and climbs; a gold ring and a burst of sparks
   *  where it struck (a white-hot flash for the powder room). One plate per part and ship at a time. */
  critHit(x: number, y: number, ship: number, part: CritPart, dmg: number, own: boolean): void {
    if (dmg > 0) this.add({ kind: 'text', x, y: y - 6, vy: -9, life: 1.3, size: 13, color: own ? '#e07a6a' : '#f0c060', text: String(dmg) });
    const color = own ? '#ff9a86' : '#ffd66e';
    if (!this.particles.some((p) => p.badge === part && p.ship === ship && p.t < 0.9)) {
      this.add({ kind: 'text', x, y: y - 26, vy: -6, life: 2.2, size: 16, color, text: L(`critBig.${part}`), badge: part, ship });
    }
    this.add({ kind: 'ring', x, y, life: 0.5, size: 6, grow: 70, color: own ? '#ff8a70' : '#ffd66e' });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 30;
      this.add({ kind: 'spark', x, y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, life: 0.35 + Math.random() * 0.3, size: 1.2, grow: 0, color: '#ffe0a0' });
    }
    if (part === 'powder') this.add({ kind: 'flash', x, y, life: 0.25, size: 10, grow: 90, color: '#fff4d0' });
    if (own) this.shake = Math.max(this.shake, part === 'powder' ? 0.7 : 0.45);
  }

  text(x: number, y: number, text: string, color: string): void {
    this.add({ kind: 'text', x, y, vy: -9, life: 1.3, size: 13, color, text });
  }

  onEvent(e: GameEvent, ownId: number): void {
    switch (e.k) {
      case 'volley': {
        const ammo = AMMO[e.ammo];
        const spd = ammo.speed * (e.spd ?? 1) * SPEED_SCALE;
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
        if (e.ship === ownId) {
          this.shake = Math.max(this.shake, e.perfect ? 0.45 : 0.25);
          this.fought = true;
        }
        // A held broadside released in its window: the crews' shout over the smoke.
        if (e.perfect && e.balls.length) {
          const [x, y] = e.balls[Math.floor(e.balls.length / 2)];
          if (e.ship === ownId) this.text(x, y - 14, L('perfect'), '#ffe28c');
          this.add({ kind: 'ring', x, y, life: 0.6, size: 8, grow: 90, color: '#ffe28c' });
        }
        break;
      }
      case 'dash': {
        // White water thrown up as she heels hard over.
        const v = headingVec(e.h);
        for (let i = 0; i < 6; i++) setTimeout(() => this.splash(e.x - v.x * i * 8 + (Math.random() - 0.5) * 10, e.y - v.y * i * 8 + (Math.random() - 0.5) * 10, i < 2), i * 70);
        if (e.ship === ownId) this.shake = Math.max(this.shake, 0.3);
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
        // Only a ball that flew wide in her dash is a miss to the eye (docs/25 item 2): one that struck is never drawn as a
        // splash — one the rules kept off her (protection, a duel) still knocks splinters from her side.
        if (e.evaded) {
          this.splash(e.x, e.y);
          if (!this.particles.some((p) => p.kind === 'text' && p.text === L('evaded') && p.t < 0.5 && Math.hypot(p.x - e.x, p.y - e.y) < 60)) this.text(e.x, e.y - 8, L('evaded'), '#9fc3d6');
          break;
        }
        if (e.dmg <= 0) {
          this.splinters(e.x, e.y, 3);
          break;
        }
        this.splinters(e.x, e.y, e.ammo === 'grape' ? 3 : 8);
        this.smoke(e.x, e.y, 2, 5, true);
        this.light(e.x, e.y, 50, 'rgba(255,170,90,1)', 0.5, 0.2);
        // Past the broadside's alpha limit (docs/25 item 1) the ball strikes a quarter as hard: a grey number with the
        // shield of «броня держит».
        const color = e.capped ? GUARD_GREY : e.ship === ownId ? '#e07a6a' : e.crit ? '#f0c060' : '#e8e0cc';
        if (e.crit && (CRIT_PARTS as readonly string[]).includes(e.crit)) this.critHit(e.x, e.y, e.ship, e.crit as CritPart, e.dmg, e.ship === ownId);
        else if (e.crit) this.text(e.x, e.y - 6, `${e.dmg} ${`crit.${e.crit}` in REN ? L(`crit.${e.crit}` as 'crit.fire') : e.crit.toUpperCase()}`, color);
        else {
          // The balls of one broadside on one ship land together: their damage reads as one rising number over her
          // (docs/25 item 11), as big as the sum (it grows as the captain does), bigger still on an elite or a boss.
          const big = this.bigTarget(e.ship);
          const near = this.particles.find((p) => p.kind === 'text' && p.sum !== undefined && p.ship === e.ship && p.t < 0.6 && (p.color === color || (p.guard && e.capped)));
          if (near) {
            near.sum! += e.dmg;
            near.text = String(near.sum);
            near.size = sumSize(near.sum!, big);
            if (e.capped) near.guard = true;
          } else this.add({ kind: 'text', x: e.x, y: e.y - 6, vy: -9, life: big ? 2 : 1.6, size: sumSize(e.dmg, big), color, text: String(e.dmg), sum: e.dmg, ship: e.ship, ...(e.capped ? { guard: true } : {}) });
        }
        // Her own hull: the camera's knock by the blow's share of her hull (renderer.ts, camfight.ts), not the jitter.
        if (e.ship === ownId) {
          this.blows.push({ dmg: e.dmg, x: e.x, y: e.y });
          this.fought = true;
        }
        break;
      }
      case 'men':
        // Men of her stacks fallen to a broadside or a fire (docs/17 H1): a "−N men" rising over her.
        this.add({ kind: 'text', x: e.x, y: e.y - 34, vy: -6, life: 2.2, size: 17, color: e.ship === ownId ? '#ff8f7a' : '#ffd08a', text: L('menLost', { n: e.n }) });
        break;
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
      case 'board_round':
        this.deckFight(e.x, e.y, e.ta, e.tb, e.ka + e.kb);
        break;
      case 'fx':
        switch (e.fx) {
          case 'lair_gun': {
            // A lair's shore gun (docs/16 #7): the muzzle blast from the painted flash, a bank of powder smoke rolling
            // off the battery, the ball in flight — and splinters where it strikes, a splash where it misses.
            const d = e.dir ?? 0, r = e.r ?? 300, v = headingVec(d);
            const spd = AMMO.round.speed * SPEED_SCALE;
            const mx = e.x + v.x * 9, my = e.y + v.y * 9;
            this.muzzles.push({ x: mx, y: my, dir: d, t: 0, life: 0.5 });
            this.gunShots.set(`${e.x},${e.y}`, { dir: d, at: (globalThis.performance?.now() ?? Date.now()) / 1000 });
            this.add({ kind: 'flash', x: mx, y: my, life: 0.18, size: 7, grow: 70, color: '#ffd28a' });
            this.light(mx, my, 160, 'rgba(255,190,110,1)', 0.9, 0.3);
            for (let i = 0; i < 10; i++) {
              this.add({
                kind: 'smoke', x: mx + v.x * (3 + i * 6) + (Math.random() - 0.5) * 10, y: my + v.y * (3 + i * 6) + (Math.random() - 0.5) * 10,
                vx: v.x * (6 - i * 0.5) + (Math.random() - 0.5) * 3, vy: v.y * (6 - i * 0.5) + (Math.random() - 0.5) * 3,
                life: 6 + Math.random() * 4, size: 12 + Math.random() * 10, grow: 6, color: '#7c7f83',
              });
            }
            const left = Math.max(10, r - 9);
            this.balls.push({ x: mx, y: my, vx: v.x * spd, vy: v.y * spd, left, delay: 0, ammo: 'round', owner: -1, alive: true, trail: [] });
            if (e.hit) {
              const hx = e.x + v.x * r, hy = e.y + v.y * r;
              setTimeout(() => {
                this.splinters(hx, hy, 12);
                this.add({ kind: 'flash', x: hx, y: hy, life: 0.2, size: 5, grow: 45, color: '#ffc27a' });
              }, (left / spd) * 1000);
            }
            break;
          }
          case 'struck':
            // She strikes her colours (docs/16 #3): a white ring and the word over her.
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 0.9, size: 10, grow: 60, color: '#f4f0e6' });
            this.add({ kind: 'text', x: e.x, y: e.y - 30, vy: -5, life: 2.6, size: 15, color: '#f4f0e6', text: L('strikes') });
            break;
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
          case 'strike': {
            // A hull on the rocks (owner, 2026-10-08): her planks splintering, the white water thrown up where she struck,
            // a short shake when she is the captain's own — harder the more knots she carried into it.
            const kn = e.r ?? 4;
            this.splinters(e.x, e.y, Math.round(10 + Math.min(26, kn * 2)));
            this.splash(e.x, e.y, kn > 5);
            this.add({ kind: 'ring', x: e.x, y: e.y, life: 0.7, size: 4, grow: 40 + kn * 4, color: '#dfe8ee' });
            if (e.ship === ownId) this.shake = Math.max(this.shake, Math.min(0.8, 0.25 + kn * 0.04));
            break;
          }
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
          case 'firework': {
            // A holiday firework (docs/12 P10 #18): a burst of gold, red and pale sparks, a flash, a slow fall.
            const cols = ['#ffd27a', '#ff6a4a', '#e8f0ff', '#9fe8d0'];
            const col = cols[Math.floor(Math.random() * cols.length)];
            const r = e.r ?? 40;
            this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.4, size: 4, grow: r * 1.5, color: col });
            this.light(e.x, e.y, r * 8, 'rgba(255,210,140,1)', 0.8, 1.2);
            for (let i = 0; i < 26; i++) {
              const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, s = r * (0.8 + Math.random() * 0.6);
              this.add({ kind: 'glow', x: e.x, y: e.y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, life: 1.1 + Math.random() * 0.6, size: 2.2, grow: -0.6, color: col });
            }
            break;
          }
          case 'rocket': {
            // A distress rocket: a spark climbing, a flash, sparks falling.
            this.add({ kind: 'flash', x: e.x, y: e.y, life: 0.5, size: 6, grow: 60, color: '#ffcf6a' });
            this.light(e.x, e.y, 600, 'rgba(255,190,90,1)', 0.9, 1.4);
            for (let i = 0; i < 12; i++) setTimeout(() => this.add({ kind: 'glow', x: e.x + (Math.random() - 0.5) * 60, y: e.y + (Math.random() - 0.5) * 60, life: 1.4, size: 3, grow: 0, color: '#ffd27a' }), 200 + i * 40);
            break;
          }
          case 'spout': {
            // A whale blows: a column of spray drifting on the wind.
            for (let i = 0; i < 14; i++) setTimeout(() => this.add({ kind: 'smoke', x: e.x + (Math.random() - 0.5) * 4, y: e.y + (Math.random() - 0.5) * 4, life: 2.2, size: 5 + Math.random() * 5, grow: 5, color: '#dfe9ee' }), i * 40);
            this.splash(e.x, e.y, false);
            break;
          }
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
    for (const m of this.muzzles) m.t += dt;
    this.muzzles = this.muzzles.filter((m) => m.t < m.life);
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
