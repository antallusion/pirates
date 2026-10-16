// Music as feedback (docs/07 §10.4), procedural like the rest of the sound: no files, a few voices on WebAudio.
// States: calm sea (sparse strings over the wind), fog (near silence, distant buoy bells), chase (a rising pulse),
// battle (drums and low brass), storm (the music yields to the sea), anomaly (the music fades to a low tone and a
// faint choir), port (a tavern fiddle), the Abyss (almost nothing — silence is a signal too).
// Changes fade over 2–4 s and come no oftener than every 20 s, so a sail on the horizon does not jerk it about.
// Also the ship's own voice: rigging that creaks with the wind and the heel, and the bells of the watch every half hour.

export type MusicState = 'calm' | 'fog' | 'chase' | 'battle' | 'storm' | 'anomaly' | 'port' | 'abyss' | 'isle';

export interface MusicInput {
  docked: boolean;
  combat: boolean; // shots exchanged in the last seconds
  chased: boolean; // a hostile close and closing
  weather: string;
  region: string;
  anomaly: boolean; // a boss, a whirlpool's eye, a black storm
  /** Her island's scene open (the sound pass, 2026-10-16: a lute of its own). */
  isle?: boolean;
  /** A fight on the hexes (boarding, a lair): the drums, as a battle at sea. */
  tactical?: boolean;
}

/** What the scene calls for (pure; the director adds the 20 s hysteresis). */
export function wantedState(i: MusicInput): MusicState {
  if (i.tactical) return 'battle';
  if (i.isle) return 'isle';
  if (i.docked) return 'port';
  if (i.region === 'the_abyss') return 'abyss';
  if (i.anomaly) return 'anomaly';
  if (i.combat) return 'battle';
  if (i.weather === 'storm' || i.weather === 'black_storm') return 'storm';
  if (i.chased) return 'chase';
  if (i.weather === 'fog') return 'fog';
  return 'calm';
}

export const MIN_HOLD = 20; // seconds a state is held
/** Battle breaks through the hold: a fight never waits twenty seconds for its drums. */
export function mayChange(from: MusicState, to: MusicState, heldFor: number): boolean {
  if (from === to) return false;
  if (to === 'battle') return true;
  return heldFor >= MIN_HOLD;
}

/** Ship's bells: strikes for a half-hour of the watch (1–8), from the world clock. */
export function bellsAt(timeOfDay01: number): number {
  const halfHours = Math.floor(timeOfDay01 * 48);
  return (halfHours % 8) || 8;
}

// D dorian: the sea's own mode — and each sea its own colour of it (the sound pass, 2026-10-16: «музыка по контексту»):
// the same voices and patterns, the mode and the key moved a little, so a sea is told by ear without a new track.
export const REGION_THEME: Record<string, { scale: number[]; shift: number }> = {
  black_coast: { scale: [0, 2, 3, 5, 7, 9, 10], shift: 0 }, // dorian: home waters
  gravewater: { scale: [0, 2, 4, 5, 7, 9, 10], shift: 3 }, // mixolydian: the warm south
  whispering: { scale: [0, 2, 3, 5, 7, 8, 10], shift: -2 }, // aeolian: the mists
  ashen_isles: { scale: [0, 1, 3, 5, 7, 8, 10], shift: -1 }, // phrygian: fire and ash
  leviathan_reach: { scale: [0, 2, 3, 5, 7, 8, 11], shift: 2 }, // harmonic minor: the ice
  dead_mans_expanse: { scale: [0, 1, 4, 5, 7, 8, 10], shift: -3 }, // phrygian dominant: the empty sea
  drowned_crown: { scale: [0, 1, 3, 5, 6, 8, 10], shift: 1 }, // locrian: the drowned court
  the_abyss: { scale: [0, 1, 3, 5, 6, 8, 10], shift: -4 },
};
let SCALE = REGION_THEME.black_coast.scale;
let ROOT = 146.83; // D3
const note = (deg: number, oct = 0) => ROOT * Math.pow(2, (SCALE[((deg % 7) + 7) % 7] + 12 * (oct + Math.floor(deg / 7))) / 12);

export class MusicDirector {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  state: MusicState = 'calm';
  private since = 0;
  private t = 0;
  private next = 0; // next scheduled event (ctx time)
  private step = 0;
  private lastBell = -1;
  private creakAt = 0;
  private region = '';
  /** A change of state dips the music for a moment before the new one rises (the crossfade). */
  private dipUntil = 0;

  attach(ctx: AudioContext, out: GainNode, noise: AudioBuffer): void {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(out);
    this.noise = noise;
    this.next = ctx.currentTime + 0.5;
  }

  /** Every frame: the state, the fade, the notes of the next few hundred milliseconds. */
  update(dt: number, input: MusicInput): void {
    this.t += dt;
    this.since += dt;
    const ctx = this.ctx, out = this.out;
    if (!ctx || !out) return;
    const want = wantedState(input);
    if (mayChange(this.state, want, this.since)) {
      this.state = want;
      this.since = 0;
      this.step = 0;
      this.dipUntil = ctx.currentTime + 1.2;
    }
    // Each sea its colour: the key and mode follow her sea (heard from the next notes on).
    if (input.region !== this.region) {
      this.region = input.region;
      const th = REGION_THEME[input.region] ?? REGION_THEME.black_coast;
      SCALE = th.scale;
      ROOT = 146.83 * Math.pow(2, th.shift / 12);
    }
    // The level of each state; the old one dips over a second, the new one rises over about three.
    const level = { calm: 0.5, fog: 0.25, chase: 0.6, battle: 0.8, storm: 0.08, anomaly: 0.45, port: 0.45, abyss: 0.12, isle: 0.42 }[this.state];
    out.gain.setTargetAtTime(ctx.currentTime < this.dipUntil ? level * 0.2 : level, ctx.currentTime, ctx.currentTime < this.dipUntil ? 0.35 : 1);
    while (this.next < ctx.currentTime + 0.25) this.schedule(this.next);
  }

  private schedule(at: number): void {
    const s = this.state;
    this.step++;
    switch (s) {
      case 'calm': {
        // A slow string chord every eight seconds, a lone melody note between.
        if (this.step % 4 === 1) for (const d of [0, 2, 4]) this.pad(at, note(d + ((this.step >> 2) % 4 === 3 ? 3 : 0)), 7, 0.08);
        else if (Math.random() < 0.5) this.pad(at, note(Math.floor(Math.random() * 7), 1), 3, 0.05);
        this.next = at + 2;
        break;
      }
      case 'fog':
        // Distant buoy bells, nothing else.
        if (Math.random() < 0.35) this.bell(at, 587 + Math.random() * 40, 0.06, 5);
        this.next = at + 4;
        break;
      case 'chase': {
        // A pulse that quickens the longer the chase lasts (90 → 130 a minute).
        const bpm = Math.min(130, 90 + this.since * 1.5);
        this.drum(at, this.step % 2 ? 0.25 : 0.45, 90);
        if (this.step % 4 === 0) this.brass(at, note(this.step % 8 === 0 ? 0 : -3, -1), 0.5, 0.08);
        this.next = at + 60 / bpm / 2;
        break;
      }
      case 'battle': {
        // Drums on every beat, a heavy one on the first; low brass on the chord changes.
        const beat = this.step % 8;
        this.drum(at, beat === 0 ? 0.9 : beat % 2 ? 0.3 : 0.55, beat === 0 ? 55 : 80);
        if (beat === 0) {
          const chord = [0, -2, -3, -4][(this.step >> 3) % 4];
          for (const d of [chord, chord + 4]) this.brass(at, note(d, -1), 2.2, 0.1);
        }
        this.next = at + 60 / 104 / 2;
        break;
      }
      case 'storm':
        // The sea has the stage; a low drone now and then.
        if (Math.random() < 0.3) this.pad(at, note(0, -1), 6, 0.05);
        this.next = at + 5;
        break;
      case 'anomaly':
      case 'abyss':
        // A whale-deep tone; in the anomaly a faint choir above it.
        this.pad(at, note(0, -2), 9, s === 'abyss' ? 0.05 : 0.1);
        if (s === 'anomaly') for (const d of [0, 1, 4]) this.pad(at + 1, note(d, 1), 7, 0.018);
        this.next = at + (s === 'abyss' ? 14 : 8);
        break;
      case 'isle': {
        // Her island: a lute plucked over a slow drone, the sea's own mode in a pentatonic walk.
        const walk = [0, 2, 4, 1, 3, 4, 2, 0, 4, 3, 1, 0];
        if (this.step % 8 === 1) this.pad(at, note(0, -1), 6, 0.04);
        this.pluck(at, note(walk[this.step % walk.length], 1), 0.06);
        this.next = at + (this.step % 4 === 3 ? 0.9 : 0.45);
        break;
      }
      case 'port': {
        // A tavern fiddle: a jig in 6/8.
        const tune = [0, 2, 4, 4, 2, 0, 1, 3, 5, 4, 2, 1];
        this.fiddle(at, note(tune[this.step % tune.length], 1), 0.22, 0.05);
        this.next = at + (this.step % 3 === 0 ? 0.36 : 0.24);
        break;
      }
    }
  }

  private env(at: number, attack: number, dur: number, peak: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    g.connect(this.out!);
    return g;
  }

  private osc(type: OscillatorType, freq: number, at: number, dur: number, dest: AudioNode, detune = 0): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(dest);
    o.start(at);
    o.stop(at + dur + 0.1);
  }

  /** Strings: two detuned saws through a soft low-pass, slow bow. */
  private pad(at: number, f: number, dur: number, peak: number): void {
    const lp = this.ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(this.env(at, dur * 0.35, dur, peak));
    this.osc('sawtooth', f, at, dur, lp, -6);
    this.osc('sawtooth', f, at, dur, lp, 6);
  }

  private brass(at: number, f: number, dur: number, peak: number): void {
    const lp = this.ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, at);
    lp.frequency.linearRampToValueAtTime(1200, at + 0.15);
    lp.connect(this.env(at, 0.06, dur, peak));
    this.osc('sawtooth', f, at, dur, lp);
  }

  private fiddle(at: number, f: number, dur: number, peak: number): void {
    const bp = this.ctx!.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 1.2;
    bp.connect(this.env(at, 0.02, dur, peak));
    this.osc('sawtooth', f, at, dur, bp);
  }

  /** A lute's string: a bright attack and a quick decay. */
  private pluck(at: number, f: number, peak: number): void {
    const lp = this.ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, at);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.5);
    lp.connect(this.env(at, 0.004, 1.1, peak));
    this.osc('triangle', f, at, 1.1, lp);
    this.osc('sawtooth', f * 2, at, 0.3, lp, 4);
  }

  private drum(at: number, peak: number, f: number): void {
    const g = this.env(at, 0.004, 0.35, peak * 0.5);
    const o = this.ctx!.createOscillator();
    o.frequency.setValueAtTime(f * 1.8, at);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, at + 0.25);
    o.connect(g);
    o.start(at);
    o.stop(at + 0.4);
    if (this.noise) {
      const n = this.ctx!.createBufferSource();
      n.buffer = this.noise;
      const hp = this.ctx!.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 1800;
      n.connect(hp).connect(this.env(at, 0.002, 0.08, peak * 0.12));
      n.start(at, Math.random());
      n.stop(at + 0.1);
    }
  }

  private bell(at: number, f: number, peak: number, dur: number): void {
    const g = this.env(at, 0.005, dur, peak);
    for (const [r, a] of [[1, 1], [2.0, 0.5], [2.76, 0.3], [5.4, 0.12]] as const) {
      const gg = this.ctx!.createGain();
      gg.gain.value = a;
      gg.connect(g);
      this.osc('sine', f * r, at, dur, gg);
    }
  }

  /** The bells of the watch: pairs of strikes on each half hour. `dest` is the interface bus (the ship's bell). */
  shipsBell(timeOfDay01: number, dest: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const half = Math.floor(timeOfDay01 * 48);
    if (half === this.lastBell) return;
    const first = this.lastBell < 0;
    this.lastBell = half;
    if (first) return; // not on joining
    const n = bellsAt(timeOfDay01);
    const at0 = ctx.currentTime + 0.1;
    for (let i = 0; i < n; i++) {
      const at = at0 + Math.floor(i / 2) * 1.1 + (i % 2) * 0.35;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.12, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, at + 2.5);
      g.connect(dest);
      for (const [r, a] of [[1, 1], [2.4, 0.4], [3.0, 0.25]] as const) {
        const o = ctx.createOscillator();
        o.frequency.value = 880 * r;
        const gg = ctx.createGain();
        gg.gain.value = a;
        o.connect(gg).connect(g);
        o.start(at);
        o.stop(at + 2.6);
      }
    }
  }

  /** Rigging and timbers under load: more often and louder with the wind, the sail set and the heel. */
  creak(dt: number, wind: number, sail: number, heel: number, dest: GainNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    this.creakAt -= dt;
    if (this.creakAt > 0) return;
    const load = Math.min(1, wind * (0.4 + sail) * (1 + heel * 2));
    this.creakAt = 1.5 + Math.random() * (7 - load * 5);
    if (load < 0.08) return;
    const at = ctx.currentTime + 0.05;
    const dur = 0.25 + Math.random() * 0.5;
    // A resonant groan: noise through a narrow band sliding down, and a faint wooden tone under it.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 18;
    const f0 = 380 + Math.random() * 260;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(f0 * 0.7, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.25 * load, at + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }
}
