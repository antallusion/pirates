// Procedural sound (WebAudio): no files to download, every sound reacts to the scene.
// Layers: ocean bed (wind-driven brown noise), rain, thunder, cannon fire, hull hits, splashes,
// harbour bells, coins. Positional: gain and stereo pan from the listener (own ship).

import type { GameEvent, WeatherKind } from '../../shared/src/protocol.ts';
import { MusicDirector } from './music.ts';
import type { MusicInput } from './music.ts';

const HEARING = 1600; // meters beyond which a cannon is not heard

/** Distance attenuation and stereo pan for a world-space source. Pure, unit-tested. */
export function spatial(lx: number, ly: number, sx: number, sy: number, range = HEARING): { gain: number; pan: number } {
  const dx = sx - lx, dy = sy - ly;
  const d = Math.hypot(dx, dy);
  if (d >= range) return { gain: 0, pan: 0 };
  const gain = Math.pow(1 - d / range, 1.6);
  const pan = Math.max(-1, Math.min(1, dx / 400));
  return { gain, pan };
}

/** The watch of the day (docs/16 #39): six of four hours, the first from midnight. */
export function watchIndex(timeOfDay01: number): number {
  return Math.floor((((timeOfDay01 % 1) + 1) % 1) * 6) % 6;
}

/** How hard the timbers work on a turn (docs/16 #39): nothing on a gentle one or with no way on, up to 1 on a hard
 *  turn at speed. `rate` in radians a second, `speed` in metres a second. */
export function turnCreakLoad(rate: number, speed: number): number {
  const r = Math.abs(rate);
  if (r < 0.18 || speed < 1.2) return 0;
  return Math.min(1, ((r - 0.18) / 0.4) * Math.min(1, speed / 6) + 0.25);
}

export type Bus = 'sea' | 'combat' | 'ui' | 'music';
export type CaptionKind = 'volley' | 'explosion' | 'deep' | 'thunder' | 'sinking';
export type CaptionDir = 'ahead' | 'astern' | 'port' | 'starboard' | 'near';

/** Where a sound lies from the listener, on screen terms (north is up). */
export function direction(lx: number, ly: number, sx: number, sy: number): CaptionDir {
  const dx = sx - lx, dy = sy - ly;
  if (Math.hypot(dx, dy) < 120) return 'near';
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'port' : 'starboard';
  return dy < 0 ? 'ahead' : 'astern';
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private sea: GainNode | null = null;
  private seaFilter: BiquadFilterNode | null = null;
  private rain: GainNode | null = null;
  /** Buses (docs/07 §11.5): the sea and weather, the fighting, the interface. */
  private buses: Record<Bus, GainNode> | null = null;
  muted = localStorage.getItem('gravetide.muted') === '1';
  volume = Number(localStorage.getItem('gravetide.volume') ?? 0.7);
  levels: Record<Bus, number> = { sea: 1, combat: 1, ui: 1, music: 0.8 };
  /** The score and the ship's own voice (music.ts). */
  readonly music = new MusicDirector();
  mono = false;
  /** Sound captions: "[broadside to port, far]" — set by the options. */
  onCaption: ((kind: CaptionKind, dir: CaptionDir, far: boolean) => void) | null = null;
  ownId = 0;
  private captionAt = new Map<string, number>();
  listener = { x: 0, y: 0 };
  private lastThunder = 0;
  /** The ship's own voice (options): the watch bells and pipe, the lookout's cry, the timbers on a hard turn. */
  voices = true;
  private watch = -1;
  private lastCry = 0;
  private lastTurnCreak = 0;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = (globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    const bus = (k: Bus) => {
      const g = ctx.createGain();
      g.gain.value = this.levels[k];
      g.connect(this.master!);
      return g;
    };
    this.buses = { sea: bus('sea'), combat: bus('combat'), ui: bus('ui'), music: bus('music') };
    this.noise = this.makeNoise(2, false);
    this.brown = this.makeNoise(4, true);
    // Ocean bed.
    const sea = ctx.createBufferSource();
    sea.buffer = this.brown;
    sea.loop = true;
    this.seaFilter = ctx.createBiquadFilter();
    this.seaFilter.type = 'lowpass';
    this.seaFilter.frequency.value = 500;
    this.sea = ctx.createGain();
    this.sea.gain.value = 0.25;
    sea.connect(this.seaFilter).connect(this.sea).connect(this.buses.sea);
    sea.start();
    // Rain.
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    this.rain = ctx.createGain();
    this.rain.gain.value = 0;
    rain.connect(hp).connect(this.rain).connect(this.buses.sea);
    rain.start();
    this.music.attach(ctx, this.buses.music, this.noise);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('gravetide.muted', this.muted ? '1' : '0');
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private makeNoise(seconds: number, brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      } else data[i] = w;
    }
    return buf;
  }

  /** Per-frame ambience: sea follows the wind, rain follows the weather. */
  ambience(wind: number, weather: WeatherKind, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sea || !this.seaFilter || !this.rain) return;
    const t = ctx.currentTime;
    const surge = 0.5 + 0.5 * Math.sin(t * 0.35) * Math.sin(t * 0.13 + 1);
    this.sea.gain.setTargetAtTime(0.12 + wind * 0.22 + surge * 0.06, t, 0.5);
    this.seaFilter.frequency.setTargetAtTime(250 + wind * 700 + surge * 150, t, 0.5);
    const rain = weather === 'rain' ? 0.05 : weather === 'storm' || weather === 'black_storm' ? 0.1 : 0;
    this.rain.gain.setTargetAtTime(rain, t, 1.5);
    void dt;
  }

  /** Master volume, the three buses and mono, from the options. */
  configure(master: number, levels: Partial<Record<Bus, number>>, mono: boolean): void {
    this.volume = master;
    this.levels = { ...this.levels, ...levels };
    this.mono = mono;
    localStorage.setItem('gravetide.volume', String(master));
    if (!this.ctx || !this.master || !this.buses) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : master, t, 0.05);
    for (const k of Object.keys(this.buses) as Bus[]) this.buses[k].gain.setTargetAtTime(this.levels[k], t, 0.05);
  }

  /** Once a frame: the score, the creak of the rigging, the bells of the watch. */
  frame(dt: number, scene: MusicInput, wind: number, sail: number, heel: number, timeOfDay01: number, atSea: boolean): void {
    if (!this.ctx || !this.buses) return;
    this.music.update(dt, scene);
    if (atSea) this.music.creak(dt, wind, sail, heel, this.buses.sea);
    if (this.voices) this.music.shipsBell(timeOfDay01, this.buses.ui);
    // The change of the watch (docs/16 #39): the bosun's pipe calls the new watch after its eight bells.
    const w = watchIndex(timeOfDay01);
    if (w !== this.watch) {
      const first = this.watch < 0;
      this.watch = w;
      if (!first && this.voices && atSea) this.bosunPipe(4.8);
    }
  }

  /** The bosun's call: a thin whistle that rises, trills and falls, quiet on the interface bus. */
  bosunPipe(delay = 0): void {
    const ctx = this.ctx;
    const v = this.voice(0.07, 0, delay, 'ui');
    if (!ctx || !v) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = o.frequency, t = v.at;
    f.setValueAtTime(1500, t);
    f.exponentialRampToValueAtTime(2300, t + 0.35);
    for (let i = 0; i < 6; i++) f.setValueAtTime(i % 2 ? 2300 : 2550, t + 0.45 + i * 0.07);
    f.setValueAtTime(2300, t + 0.9);
    f.exponentialRampToValueAtTime(1400, t + 1.5);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.08);
    env.gain.setValueAtTime(0.5, t + 1.3);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(env).connect(v.out);
    o.start(t);
    o.stop(t + 1.7);
  }

  /** The lookout's cry from the masthead (docs/16 #39): «Sail ho!» or «Land ho!» — a voice of two syllables, a
   *  rising call and a long falling vowel, through two formants; far and a little muffled. At most every 12 s. */
  lookoutCry(kind: 'sail' | 'land', pan = 0): void {
    const ctx = this.ctx;
    const now = performance.now();
    if (!ctx || !this.voices || now - this.lastCry < 12_000) return;
    this.lastCry = now;
    const v = this.voice(0.09, this.mono ? 0 : Math.max(-0.6, Math.min(0.6, pan)), 0.05, 'sea');
    if (!v) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.connect(v.out);
    const syllable = (at: number, dur: number, f0: number, f1: number, formants: [number, number]) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, at);
      o.frequency.linearRampToValueAtTime(f1, at + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.6, at + 0.05);
      env.gain.setValueAtTime(0.6, at + dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.001, at + dur);
      for (const [fq, q, g] of [[formants[0], 6, 1], [formants[1], 8, 0.6]] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fq;
        bp.Q.value = q;
        const gg = ctx.createGain();
        gg.gain.value = g;
        o.connect(bp).connect(gg).connect(env);
      }
      env.connect(lp);
      o.start(at);
      o.stop(at + dur + 0.05);
    };
    // «Sail» /eɪ/ or «Land» /æ/, then «ho» /oʊ/ held and falling.
    syllable(v.at, 0.32, kind === 'sail' ? 250 : 235, kind === 'sail' ? 290 : 270, kind === 'sail' ? [520, 1900] : [700, 1700]);
    syllable(v.at + 0.38, 0.85, 320, 230, [480, 900]);
    // The wind across the masthead under it.
    this.noiseBurst(v.out, v.at, 1.3, 'bandpass', 900, 0.8, 0.08);
  }

  /** The timbers on a hard turn (docs/16 #39): a low groan of the hull and the rudder stock, louder the harder she
   *  turns. At most every 1.1 s. */
  turnCreak(load: number): void {
    const ctx = this.ctx;
    const now = performance.now();
    if (!ctx || !this.noise || !this.voices || load <= 0 || now - this.lastTurnCreak < 1100 + Math.random() * 900) return;
    this.lastTurnCreak = now;
    const v = this.voice(0.16 * Math.min(1, load), 0, 0, 'sea');
    if (!v) return;
    const dur = 0.45 + load * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 14;
    const f0 = 210 + Math.random() * 90;
    bp.frequency.setValueAtTime(f0, v.at);
    bp.frequency.exponentialRampToValueAtTime(f0 * 0.62, v.at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, v.at);
    env.gain.linearRampToValueAtTime(1, v.at + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, v.at + dur);
    src.connect(bp).connect(env).connect(v.out);
    src.start(v.at, Math.random() * 1.5);
    src.stop(v.at + dur + 0.05);
    this.tone(v.out, v.at + 0.02, 96, dur * 0.8, 0.12, 'triangle', 70);
  }

  private voice(gain: number, pan: number, delay = 0, bus: Bus = 'combat'): { out: GainNode; at: number } | null {
    const ctx = this.ctx;
    if (!ctx || !this.buses || gain <= 0.001) return null;
    const out = ctx.createGain();
    out.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = this.mono ? 0 : pan;
    out.connect(p).connect(this.buses[bus]);
    return { out, at: ctx.currentTime + delay };
  }

  private noiseBurst(dest: AudioNode, at: number, dur: number, type: BiquadFilterType, freq: number, q = 1, peak = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(env).connect(dest);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }

  private tone(dest: AudioNode, at: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(env).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  cannon(x: number, y: number, delay: number, weight = 1): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y);
    const v = this.voice(gain * 0.55 * weight, pan, delay);
    if (!v) return;
    this.tone(v.out, v.at, 70, 0.6, 1, 'sine', 32);
    this.noiseBurst(v.out, v.at, 0.9, 'lowpass', 900 - gain * 300, 0.7, 0.9);
    this.noiseBurst(v.out, v.at, 0.12, 'bandpass', 2400, 0.8, 0.4);
  }

  hit(x: number, y: number, crit: boolean): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y);
    const v = this.voice(gain * 0.5, pan);
    if (!v) return;
    this.noiseBurst(v.out, v.at, 0.25, 'bandpass', 1400, 2.5, 1);
    this.tone(v.out, v.at, 180, 0.18, 0.4, 'triangle', 90);
    if (crit) this.noiseBurst(v.out, v.at + 0.05, 0.5, 'bandpass', 700, 1.5, 0.6);
  }

  splash(x: number, y: number, big: boolean): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, big ? 2200 : 900);
    const v = this.voice(gain * (big ? 0.5 : 0.18), pan);
    if (!v) return;
    this.noiseBurst(v.out, v.at, big ? 1.4 : 0.45, 'highpass', 900, 0.5, 1);
  }

  explosion(x: number, y: number): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 3000);
    const v = this.voice(gain * 0.9, pan);
    if (!v) return;
    this.tone(v.out, v.at, 55, 1.6, 1, 'sine', 25);
    this.noiseBurst(v.out, v.at, 2.2, 'lowpass', 600, 0.5, 1);
  }

  /** Muskets along a rail: a crackle of small reports. */
  muskets(x: number, y: number, n = 8): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 1400);
    for (let i = 0; i < n; i++) {
      const v = this.voice(gain * 0.28, pan + (Math.random() - 0.5) * 0.3, i * 0.045 + Math.random() * 0.05);
      if (!v) return;
      this.noiseBurst(v.out, v.at, 0.14, 'bandpass', 2200 + Math.random() * 900, 1.1, 0.9);
      this.tone(v.out, v.at, 150, 0.09, 0.25, 'square', 70);
    }
  }

  /** Steel on steel: a few bright rings over a scuffle. */
  clash(x: number, y: number, n = 5): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 1100);
    for (let i = 0; i < n; i++) {
      const v = this.voice(gain * 0.2, pan + (Math.random() - 0.5) * 0.4, i * 0.12 + Math.random() * 0.08);
      if (!v) return;
      const f = 2300 + Math.random() * 1600;
      this.tone(v.out, v.at, f, 0.22, 0.35, 'triangle');
      this.tone(v.out, v.at, f * 1.51, 0.16, 0.18, 'sine');
      this.noiseBurst(v.out, v.at, 0.05, 'highpass', 3500, 0.8, 0.5);
    }
  }

  /** A crew's roar: a band of voices rising and falling. */
  shout(x: number, y: number, big: boolean): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 1400);
    const v = this.voice(gain * (big ? 0.35 : 0.2), pan);
    if (!v) return;
    this.noiseBurst(v.out, v.at, big ? 1.3 : 0.8, 'bandpass', 520, 2.2, 0.9);
    this.noiseBurst(v.out, v.at + 0.05, big ? 1.1 : 0.7, 'bandpass', 1050, 2.8, 0.55);
    this.tone(v.out, v.at, 190, big ? 1.1 : 0.6, 0.12, 'sawtooth', 150);
  }

  thunder(): void {
    const now = performance.now();
    if (now - this.lastThunder < 3000) return;
    this.lastThunder = now;
    if (this.onCaption && (this.captionAt.get('thunder') ?? 0) < now - 2000) {
      this.captionAt.set('thunder', now);
      this.onCaption('thunder', 'near', true);
    }
    const v = this.voice(0.5, (Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.2);
    if (!v) return;
    this.noiseBurst(v.out, v.at, 3.5, 'lowpass', 180, 0.4, 1);
    this.noiseBurst(v.out, v.at + 0.1, 0.6, 'lowpass', 900, 0.4, 0.5);
  }

  /** Harbour bell: inharmonic partials of a cast bronze bell. */
  bell(): void {
    const v = this.voice(0.25, 0, 0, 'ui');
    if (!v) return;
    for (const [ratio, amp] of [[1, 1], [2.0, 0.5], [2.4, 0.4], [3.0, 0.25], [4.2, 0.15]] as const) this.tone(v.out, v.at, 220 * ratio, 3.5 / ratio + 0.8, amp * 0.4);
  }

  /** The men's shanty at the capstan (docs/16 #17): a Dorian call-and-answer in two voices over stamping feet,
   *  about six seconds on the music bus. */
  shanty(): void {
    const v = this.voice(0.22, 0, 0.05, 'music');
    if (!v) return;
    // D Dorian: the call (a lone voice), then the whole crew answering an octave lower with a fifth above.
    const D = 146.83;
    const st = (n: number) => D * Math.pow(2, n / 12);
    const beat = 0.36;
    const call: [number, number][] = [[7, 1], [7, 0.5], [7, 0.5], [7, 1], [0, 1], [3, 1], [7, 1], [10, 2]];
    const answer: [number, number][] = [[5, 1], [5, 0.5], [5, 0.5], [5, 1], [-2, 1], [2, 1], [5, 1], [9, 2]];
    let t = v.at;
    for (const [n, d] of call) {
      this.tone(v.out, t, st(n + 12), d * beat * 0.95, 0.35, 'triangle');
      t += d * beat;
    }
    for (const [n, d] of answer) {
      this.tone(v.out, t, st(n), d * beat * 0.95, 0.4, 'sawtooth');
      this.tone(v.out, t, st(n + 7), d * beat * 0.9, 0.18, 'triangle');
      t += d * beat;
    }
    // Stamping on the deck on every beat, heavier on the downbeat.
    for (let i = 0; i < 16; i++) this.noiseBurst(v.out, v.at + i * beat, 0.12, 'lowpass', 160, 0.7, i % 4 === 0 ? 0.9 : 0.5);
  }

  coins(): void {
    const v = this.voice(0.2, 0, 0, 'ui');
    if (!v) return;
    for (let i = 0; i < 4; i++) this.tone(v.out, v.at + i * 0.045, 2600 + Math.random() * 900, 0.12, 0.3, 'triangle');
  }

  eerie(x: number, y: number): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 2500);
    const v = this.voice(gain * 0.4, pan);
    if (!v) return;
    this.tone(v.out, v.at, 92, 3, 0.6, 'sine', 61);
    this.tone(v.out, v.at + 0.2, 138.6, 2.5, 0.3, 'sine', 90);
  }

  /** A caption for a sound that matters, with where it came from (at most one of a kind every 2 s). */
  private caption(kind: CaptionKind, x: number, y: number, range: number): void {
    if (!this.onCaption) return;
    const now = performance.now();
    if ((this.captionAt.get(kind) ?? 0) > now - 2000) return;
    const d = Math.hypot(x - this.listener.x, y - this.listener.y);
    if (d > range) return;
    this.captionAt.set(kind, now);
    this.onCaption(kind, direction(this.listener.x, this.listener.y, x, y), d > range * 0.45);
  }

  onEvent(e: GameEvent): void {
    // Captions do not need the sound to be on — that is the point of them.
    switch (e.k) {
      case 'volley':
        if (e.ship !== this.ownId && e.balls.length) this.caption('volley', e.balls[0][0], e.balls[0][1], 1600);
        break;
      case 'fx':
        if (e.fx === 'explosion' || e.fx === 'mortar') this.caption('explosion', e.x, e.y, 3000);
        else if (e.fx === 'deep_call' || e.fx === 'maw' || e.fx === 'boss_roar' || e.fx === 'rise' || e.fx === 'song' || e.fx === 'plankton') this.caption('deep', e.x, e.y, 2500);
        break;
      case 'sunk':
        this.caption('sinking', e.x, e.y, 2200);
        break;
    }
    if (!this.ctx) return;
    switch (e.k) {
      case 'volley':
        for (const [x, y, , , delay] of e.balls.slice(0, 8)) this.cannon(x, y, delay / 1000, e.perfect ? 1.05 : 0.8);
        break;
      case 'dash':
        this.splash(e.x, e.y, true);
        break;
      case 'hit':
        if (e.dmg <= 0) this.splash(e.x, e.y, false);
        else this.hit(e.x, e.y, !!e.crit);
        break;
      case 'sunk':
        this.splash(e.x, e.y, true);
        break;
      case 'lance':
        this.eerie(e.x2, e.y2);
        break;
      case 'board_round':
        for (const t of [e.ta, e.tb]) {
          if (t === 'volley' || t === 'officers') this.muskets(e.x, e.y);
          else if (t === 'grenades') for (let i = 0; i < 3; i++) this.cannon(e.x, e.y, 0.12 + i * 0.16, 0.35);
          else if (t === 'charge' || t === 'captain' || t === 'colours') this.clash(e.x, e.y);
        }
        this.shout(e.x, e.y, e.ta === 'captain' || e.tb === 'captain' || e.ka + e.kb > 8);
        if (e.ka + e.kb > 0) this.splash(e.x, e.y, false);
        break;
      case 'fx':
        if (e.fx === 'explosion') this.explosion(e.x, e.y);
        else if (e.fx === 'deep_call' || e.fx === 'maw') this.eerie(e.x, e.y);
        else if (e.fx === 'barrage') for (let i = 0; i < 6; i++) this.cannon(e.x, e.y, i * 0.1, 0.6);
        else if (e.fx === 'ram') this.hit(e.x, e.y, true);
        else if (e.fx === 'mortar_launch') this.cannon(e.x, e.y, 0, 1.4);
        else if (e.fx === 'mortar') this.explosion(e.x, e.y);
        else if (e.fx === 'harpoon_miss' || e.fx === 'breach') this.splash(e.x, e.y, false);
        else if (e.fx === 'broken_mast' || e.fx === 'axes' || e.fx === 'ice' || e.fx === 'claws') this.hit(e.x, e.y, true);
        else if (e.fx === 'lightning') this.thunder();
        else if (e.fx === 'boss_roar' || e.fx === 'song' || e.fx === 'rise' || e.fx === 'swallow' || e.fx === 'plankton') this.eerie(e.x, e.y);
        else if (e.fx === 'white_water' || e.fx === 'spit' || e.fx === 'bile' || e.fx === 'ink') this.splash(e.x, e.y, true);
        break;
    }
  }
}
