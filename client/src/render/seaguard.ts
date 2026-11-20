// The sea's safety net (forum 118, Эдуард: «графика и движение рывками, видеокарта и процессор греются»): when the
// frames at sea run long for a while, the costly extras are eased — first the rain's density, its rings on the water
// and the sea's sun facets (step 1), then the vignette and a step of resolution (step 2) — and given back once the
// frames are quick again. It only follows the frames under «Эффекты: авто» (the default): a player who chose her
// effects herself keeps them; her own settings are never written. No DOM: the node tests drive it
// (tests/seaguard.test.ts).

/** The median frame (ms) over the window that counts as slow, and as quick again. */
export const GUARD_SLOW_MS = 40;
export const GUARD_FAST_MS = 24;
/** The window whose median frame decides a step down (ms), and how long the frames must stay quick before a step back. */
export const GUARD_SLOW_FOR = 10_000;
export const GUARD_FAST_FOR = 20_000;
/** The resolution's share at step 2. */
export const GUARD_SCALE = 0.8;
/** The deepest step. */
export const GUARD_MAX = 2;

export class SeaGuard {
  /** 0 everything as she set it, 1 the weather's extras eased, 2 the vignette and a step of resolution too. */
  level = 0;
  private win: number[] = [];
  private at: number[] = [];
  private fastSince = -1;
  private lastCheck = -1;
  /** How long the frames must stay quick before a step back (doubled each time the eased look had to come back at
   *  once — no see-saw between the two). */
  private holdFast = GUARD_FAST_FOR;
  private raisedAt = -1e12;

  /** Her frame's time (ms) at `now` (ms); `active` false (in port, on the island, a battle, effects she set herself)
   *  holds the count. Returns true when the level changed. */
  frame(ms: number, now: number, active: boolean): boolean {
    if (!active) {
      this.win.length = this.at.length = 0;
      this.fastSince = -1;
      return false;
    }
    // (a tab come back from the background, a long load: no frame time)
    if (ms > 0 && ms < 250) {
      this.win.push(ms);
      this.at.push(now);
    }
    // the window: the last GUARD_SLOW_FOR of frames
    let drop = 0;
    while (drop < this.at.length && this.at[drop] < now - GUARD_SLOW_FOR) drop++;
    if (drop) {
      this.win.splice(0, drop);
      this.at.splice(0, drop);
    }
    if (now - this.lastCheck < 1000) return false;
    this.lastCheck = now;
    // (a full window: frames over most of the span)
    if (this.at.length < 10 || now - this.at[0] < GUARD_SLOW_FOR * 0.8) return false;
    const med = median(this.win);
    if (med > GUARD_SLOW_MS) {
      this.fastSince = -1;
      if (this.level >= GUARD_MAX) return false;
      this.level++;
      if (now - this.raisedAt < GUARD_FAST_FOR * 3) this.holdFast = Math.min(this.holdFast * 2, 300_000);
      this.win.length = this.at.length = 0; // (the next step only after a whole window again)
      return true;
    }
    if (med < GUARD_FAST_MS) {
      if (this.fastSince < 0) this.fastSince = now;
      if (now - this.fastSince >= this.holdFast && this.level > 0) {
        this.level--;
        this.raisedAt = now;
        this.fastSince = now;
        this.win.length = this.at.length = 0;
        return true;
      }
    } else this.fastSince = -1;
    return false;
  }

  /** Back to everything as she set it (her settings changed). Returns true when it was eased. */
  reset(): boolean {
    const was = this.level > 0;
    this.level = 0;
    this.win.length = this.at.length = 0;
    this.fastSince = this.lastCheck = -1;
    this.holdFast = GUARD_FAST_FOR;
    this.raisedAt = -1e12;
    return was;
  }
}

export function median(a: readonly number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}
