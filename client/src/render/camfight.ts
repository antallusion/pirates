// docs/23 (owner, 2026-10-09: «Отдалять камеру в бою на ПК? — да, можно тряску при попадании небольшую добавить»): the
// sea fight's camera. On a desk the view steps back while she fights, so a mark at a broadside's range (~140 m) on
// either beam stands inside the screen, not at its edge (1500×600: 17 px past the bottom edge before); it eases out,
// and back in a few seconds after the fight. The wheel stays the captain's: turned in a fight, the view is hers from
// what is on the screen till the fight ends. A phone keeps its view: it already spans a broadside's reach round her
// (Renderer.resize), and stepping back there would shrink her to a speck. A ball on her hull knocks the view a few
// pixels away from the blow — by its share of her hull, for 0.4 s; none with «меньше движения» or the shake turned off.
// Pure: the renderer (renderer.ts) feeds it each frame and reads it.

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The band the fight's view keeps in sight all round her (m): a broadside's 140 m and the mark's half-beam. */
export const FIGHT_BAND = 150;
/** The room between the band and the screen's edge: an eighth of the short side, never under 40 px — the HUD's bands
 *  (her mark's strip at the top, «Атаковать» and its hint at the bottom: 70 px of a 600 px desk) and the mark's name. */
export const FIGHT_MARGIN = 0.125;
/** Never further out than this share of her own zoom: the ships stay ships. */
export const FIGHT_MIN = 0.62;
/** How long the view stays out after the fight's last sign (a shot, a ball on her hull, the mark in the band). */
export const FIGHT_HOLD = 4;
/** The ease out, and back in (per second of the game's clock): ~1 s out, ~2 s in. */
export const FIGHT_OUT = 2.2;
export const FIGHT_IN = 1.1;

/** The share of her zoom a fight wants on a screen w×h: the band in sight with its margin; 1 when it already is. */
export function fightShare(base: number, w: number, h: number): number {
  const short = Math.min(w, h);
  const room = short / 2 - Math.max(40, short * FIGHT_MARGIN);
  return base > 0 ? clamp(room / FIGHT_BAND / base, FIGHT_MIN, 1) : 1;
}

/** The fight's view: how far out it is now (0 at peace, 1 all the way), eased on the game's clock. */
export class FightView {
  /** 0 at peace, 1 the view all the way out. */
  w = 0;
  /** Seconds since the fight's last sign. */
  quiet = Infinity;
  /** The wheel turned in this fight: the view is the captain's till it ends. */
  user = false;

  /** One frame: `sign` — a sign of the fight this frame; `desk` — a desk's screen (a phone keeps its view). */
  step(dt: number, sign: boolean, desk: boolean): void {
    this.quiet = sign ? 0 : this.quiet + dt;
    const on = this.quiet < FIGHT_HOLD;
    if (!on) this.user = false;
    const want = on && desk && !this.user ? 1 : 0;
    this.w += (want - this.w) * Math.min(1, dt * (want > this.w ? FIGHT_OUT : FIGHT_IN));
    if (Math.abs(want - this.w) < 1e-3) this.w = want;
  }

  /** The zoom to ease to: her own, stepped back by the fight's share as far as the view is out. */
  zoom(base: number, share: number): number {
    return base * (1 - this.w * (1 - share));
  }

  /** The wheel turned in a fight: her zoom from the one on the screen, the fight's view handed over to her. Returns
   *  the new zoom to ease to for a wheel's `next` (the zoom it asked for from her own `base`). */
  wheel(base: number, next: number, share: number): number {
    if (this.w <= 0) return next;
    const now = this.zoom(base, share);
    this.user = true;
    this.w = 0;
    return now * (next / base);
  }
}

/** The knock's size for a blow of `share` of her hull (a broadside's balls together): 1.5 px for a scratch, 6 px for a
 *  tenth of her hull or more. */
export const SHAKE_MIN = 1.5;
export const SHAKE_MAX = 6;
export const SHAKE_SEC = 0.4;
export function knockPx(share: number): number {
  return share > 0 ? clamp(SHAKE_MIN + 45 * share, SHAKE_MIN, SHAKE_MAX) : 0;
}

/** A ball on her hull: the view knocked away from it and swinging back, damped, for SHAKE_SEC. The balls of one
 *  broadside (within 0.3 s) add up to one knock. */
export class HitShake {
  private t = Infinity;
  private sum = 0;
  private amp = 0;
  private dx = 0;
  private dy = 1;

  /** A blow of `share` of her hull; (dx, dy) the way it pushes her (from the ball to her). */
  kick(share: number, dx: number, dy: number): void {
    if (!(share > 0)) return;
    if (this.t > 0.3) this.sum = 0;
    this.sum += share;
    this.amp = knockPx(this.sum);
    this.t = 0;
    const l = Math.hypot(dx, dy);
    if (l > 1e-6) {
      this.dx = dx / l;
      this.dy = dy / l;
    }
  }

  /** The knock's offset of the whole view at `t` seconds after it (px): along the blow, a little across it. */
  at(t: number): { x: number; y: number } {
    if (!(t >= 0) || t >= SHAKE_SEC || this.amp <= 0) return { x: 0, y: 0 };
    const e = Math.exp(-t / 0.12) * (1 - t / SHAKE_SEC);
    const a = this.amp * e * Math.cos(2 * Math.PI * 9 * t), b = this.amp * 0.3 * e * Math.sin(2 * Math.PI * 13 * t);
    return { x: this.dx * a - this.dy * b, y: this.dy * a + this.dx * b };
  }

  /** The offset now, and on with the clock. */
  step(dt: number): { x: number; y: number } {
    const o = this.at(this.t);
    this.t += dt;
    return o;
  }

  /** Still knocking. */
  get busy(): boolean {
    return this.t < SHAKE_SEC && this.amp > 0;
  }

  stop(): void {
    this.t = Infinity;
    this.sum = 0;
  }
}
