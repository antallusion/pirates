// The ships' wakes (forum 118, Эдуард: «раз в несколько дней игра начинает дико лагать … на своём острове
// успокаивается»): a wake was aged only while its ship was drawn, so every ship that left sight under way left her
// points behind for good — the list grew all session long, was walked, copied and sorted every frame, and its stale
// points (age far past the shader's 7 s) filled the shader's 48 slots, a loop of two exp() per pixel per slot over
// the whole screen. Now a wake whose ship is gone ages out like any other, and the shader is given only the live
// points that can touch the screen. No DOM: the node tests drive it (tests/wakes.test.ts).

export interface WakePt {
  x: number;
  y: number;
  /** When it was laid (the renderer's clock, s). */
  t: number;
  /** Its width at birth (m). */
  w: number;
  /** Its life (s): the shader's 7-unit age scale is spread over it. */
  life: number;
}

export interface ShaderWake {
  x: number;
  y: number;
  age: number;
  w: number;
}

/** The shader's age scale: a point is gone (its fade 0) at 7. */
export const WAKE_AGE_END = 7;
/** The points of one ship the shader takes (her newest). */
export const WAKE_PER_SHIP = 12;

/** Every expired point dropped, and the wake of a ship gone from sight (not in `live`) aged out with the rest; an
 *  empty wake forgotten. Returns how many wakes are left. */
export function pruneWakes(wakes: Map<number, WakePt[]>, live: ReadonlySet<number>, now: number): number {
  for (const [id, w] of wakes) {
    if (live.has(id)) {
      if (!w.length) wakes.delete(id);
      continue; // (her own update ages a drawn ship's wake)
    }
    while (w.length && now - w[0].t > w[0].life) w.shift();
    if (!w.length) wakes.delete(id);
  }
  return wakes.size;
}

/** The points for the shader: live ones only (age < 7), each ship's newest few, none that cannot reach the view
 *  (`view` the world rectangle on screen), the youngest `max` of them, oldest first (as the shader adds them). */
export function shaderWakes(wakes: Map<number, WakePt[]>, now: number, view: { x0: number; y0: number; x1: number; y1: number }, max: number, out: ShaderWake[] = []): ShaderWake[] {
  out.length = 0;
  for (const w of wakes.values()) {
    for (let i = Math.max(0, w.length - WAKE_PER_SHIP); i < w.length; i++) {
      const p = w[i];
      const dt = now - p.t;
      const age = (dt * WAKE_AGE_END) / p.life;
      if (age >= WAKE_AGE_END) continue;
      const r = p.w * (1 + dt * 0.35);
      // (the ring's arm and its glow reach about two radii out)
      const m = r * 2 + 4;
      if (p.x < view.x0 - m || p.x > view.x1 + m || p.y < view.y0 - m || p.y > view.y1 + m) continue;
      out.push({ x: p.x, y: p.y, age, w: r });
    }
  }
  out.sort((a, b) => b.age - a.age);
  if (out.length > max) out.splice(0, out.length - max);
  return out;
}
