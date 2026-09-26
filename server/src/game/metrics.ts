// Server health for load tests and /health: how long ticks take (the budget at 20 Hz is 50 ms), how much of
// that is snapshots and the once-a-second pass, how often the loop had to drop time, and bytes sent.

const WINDOW = 600; // ticks: 30 s at 20 Hz

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export class Metrics {
  private ticks = new Float64Array(WINDOW);
  private snaps = new Float64Array(WINDOW);
  private seconds = new Float64Array(WINDOW);
  private n = 0;
  overruns = 0; // times the loop fell 5 ticks behind and dropped time
  bytesText = 0;
  bytesBinary = 0;
  private rateAt = performance.now();
  private rateBytes = 0;
  kbPerSec = 0;
  textShare = 0;

  tick(ms: number, snapMs: number, secondMs: number): void {
    const i = this.n++ % WINDOW;
    this.ticks[i] = ms;
    this.snaps[i] = snapMs;
    this.seconds[i] = secondMs;
    const now = performance.now();
    if (now - this.rateAt >= 1000) {
      const total = this.bytesText + this.bytesBinary;
      this.kbPerSec = Math.round(((total - this.rateBytes) / 1024 / ((now - this.rateAt) / 1000)) * 10) / 10;
      this.textShare = total ? Math.round((this.bytesText / total) * 100) / 100 : 0;
      this.rateBytes = total;
      this.rateAt = now;
    }
  }

  summary(): Record<string, number> {
    const len = Math.min(this.n, WINDOW);
    const t = [...this.ticks.subarray(0, len)].sort((a, b) => a - b);
    const avg = (a: Float64Array) => (len ? a.subarray(0, len).reduce((x, y) => x + y, 0) / len : 0);
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      tickAvgMs: r(avg(this.ticks)),
      tickP95Ms: r(pct(t, 0.95)),
      tickP99Ms: r(pct(t, 0.99)),
      tickMaxMs: r(t[t.length - 1] ?? 0),
      snapAvgMs: r(avg(this.snaps)),
      secondPassMaxMs: r(len ? Math.max(...this.seconds.subarray(0, len)) : 0),
      overruns: this.overruns,
      kbOutPerSec: this.kbPerSec,
      textShare: this.textShare,
    };
  }
}

/**
 * Per-subsystem timings (Phase 10 profiling): the step calls `lap(name)` after each stage; each stage keeps a
 * running mean and max over the same 30 s window. The report tells which system would be worth moving to
 * native code — and so far none is: see docs/04 §Profiling.
 */
export class Profiler {
  private at = 0;
  private sums = new Map<string, number>();
  private maxes = new Map<string, number>();
  private windowSteps = 0;
  private last: Record<string, { avgMs: number; maxMs: number; share: number }> = {};

  begin(): void {
    this.at = performance.now();
  }

  lap(name: string): void {
    const now = performance.now();
    const ms = now - this.at;
    this.at = now;
    this.sums.set(name, (this.sums.get(name) ?? 0) + ms);
    if (ms > (this.maxes.get(name) ?? 0)) this.maxes.set(name, ms);
  }

  /** Closes a step; every WINDOW steps the averages roll over into the report. */
  end(): void {
    if (++this.windowSteps < WINDOW) return;
    this.roll();
  }

  private roll(): void {
    let total = 0;
    for (const v of this.sums.values()) total += v;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    const out: typeof this.last = {};
    for (const [k, v] of [...this.sums].sort((a, b) => b[1] - a[1])) {
      out[k] = { avgMs: r(v / this.windowSteps), maxMs: r(this.maxes.get(k) ?? 0), share: total ? Math.round((v / total) * 1000) / 1000 : 0 };
    }
    this.last = out;
    this.sums.clear();
    this.maxes.clear();
    this.windowSteps = 0;
  }

  /** The last full window, or the partial one when none has closed yet. */
  report(): Record<string, { avgMs: number; maxMs: number; share: number }> {
    if (!Object.keys(this.last).length && this.windowSteps) {
      const saved = { sums: new Map(this.sums), maxes: new Map(this.maxes), n: this.windowSteps };
      this.roll();
      const out = this.last;
      this.last = {};
      this.sums = saved.sums;
      this.maxes = saved.maxes;
      this.windowSteps = saved.n;
      return out;
    }
    return this.last;
  }
}
