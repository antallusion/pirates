// Gamepad (docs/07 §12), standard mapping (Xbox layout; PlayStation alike).
// At sea: left stick the helm, L3 holds the course, RB/LB sails, LT/RT hold to aim a broadside and release to fire
// (the right stick sets range and lead; without a trigger it looks ahead), X/Y/B the abilities, LB+RB the ultimate,
// the d-pad cycles shot (hold: a radial menu), d-pad down the actions radial, d-pad up the chasers, A the context
// action, View the chart, Menu the options, R3 locks the nearest ship toward the right stick.
// In menus: a virtual cursor on the left stick, A clicks, B backs out, LB/RB change tabs, triggers scroll.
// Side-split rumble: a port broadside in the left (strong) motor, starboard in the right (weak).
// `PadInput` is pure (edge detection, dead zones, chords, holds) and unit-tested.

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export interface PadSnapshot {
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}

export type PadEvent =
  | { k: 'press'; b: number }
  | { k: 'release'; b: number; held: number } // held: seconds
  | { k: 'hold'; b: number } // crossed the hold threshold
  | { k: 'chord' }; // LB + RB together

export const DEAD = 0.2;
export const HOLD = 0.3; // seconds before a d-pad press becomes a radial menu

export function dead(v: number, z = DEAD): number {
  if (Math.abs(v) < z) return 0;
  return (Math.sign(v) * (Math.abs(v) - z)) / (1 - z);
}

export class PadInput {
  private down: number[] = [];
  private since: number[] = [];
  private held = new Set<number>();
  private chorded = false;
  t = 0;

  /** One poll: the events since the last one. */
  poll(p: PadSnapshot, dt: number): PadEvent[] {
    this.t += dt;
    const out: PadEvent[] = [];
    for (let i = 0; i < p.buttons.length; i++) {
      const b = p.buttons[i];
      const on = b.pressed || b.value > 0.5;
      const was = this.down[i] === 1;
      if (on && !was) {
        this.since[i] = this.t;
        // A shoulder button pressed alone starts a fresh gesture; the second of a pair makes it a chord.
        if ((i === BTN.LB && !this.isDown(BTN.RB)) || (i === BTN.RB && !this.isDown(BTN.LB))) this.chorded = false;
        out.push({ k: 'press', b: i });
        if ((i === BTN.LB && this.isDown(BTN.RB)) || (i === BTN.RB && this.isDown(BTN.LB))) {
          this.chorded = true;
          out.push({ k: 'chord' });
        }
      } else if (!on && was) {
        out.push({ k: 'release', b: i, held: this.t - (this.since[i] ?? this.t) });
        this.held.delete(i);
      } else if (on && was && !this.held.has(i) && this.t - this.since[i] >= HOLD) {
        this.held.add(i);
        out.push({ k: 'hold', b: i });
      }
      this.down[i] = on ? 1 : 0;
    }
    return out;
  }

  isDown(b: number): boolean {
    return this.down[b] === 1;
  }

  /** LB+RB went down together: the sail steps of that chord are taken back. */
  get chord(): boolean {
    return this.chorded;
  }
}

/** Which sector of an n-way radial the stick points at (0 = up, clockwise), or -1 in the dead zone. */
export function radialSector(x: number, y: number, n: number): number {
  if (Math.hypot(x, y) < 0.5) return -1;
  const a = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / ((Math.PI * 2) / n)) % n;
}

/**
 * Where a broadside aims from the pad: abeam of the chosen side at `range` metres, pushed along the keel by the
 * right stick's lead. Returns a world point.
 */
export function padAimPoint(x: number, y: number, heading: number, side: 'port' | 'starboard', range: number, lead: number): { x: number; y: number } {
  const fx = Math.sin(heading), fy = -Math.cos(heading); // forward
  const s = side === 'starboard' ? 1 : -1;
  const rx = -fy * s, ry = fx * s; // abeam
  return { x: x + rx * range + fx * lead, y: y + ry * range + fy * lead };
}

/** Rumble: the dual motors, strong (left, low) and weak (right, high). */
export function rumble(pad: Gamepad | null, strong: number, weak: number, ms: number): void {
  const act = (pad as unknown as { vibrationActuator?: { playEffect(t: string, o: object): Promise<unknown> } } | null)?.vibrationActuator;
  if (!act) return;
  void act.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => undefined);
}
